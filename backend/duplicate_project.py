"""
Duplicate a project (all measurements, observations, photos) to another user.
Each table row is a new independent record — deleting the original doesn't affect the copy.
Run: python duplicate_project.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_URL", open(".env").read().split("DATABASE_URL=")[1].split("\n")[0].strip())

from app.db.database import SessionLocal
from app.models.models import (
    User, FermentationProject, MeasurementLog, ObservationNote,
    ProjectPhoto, ProjectYeastConnection,
)

FROM_EMAIL  = "skyler.shin@cooper.edu"
TO_EMAIL    = "abigail.lin@cooper.edu"
PROJECT_NAME_FRAGMENT = "Radish"   # case-insensitive substring match


def run():
    db = SessionLocal()
    try:
        src_user = db.query(User).filter_by(email=FROM_EMAIL).first()
        dst_user = db.query(User).filter_by(email=TO_EMAIL).first()

        if not src_user:
            print(f"Source user not found: {FROM_EMAIL}"); return
        if not dst_user:
            print(f"Destination user not found: {TO_EMAIL}"); return

        src_project = (
            db.query(FermentationProject)
            .filter(
                FermentationProject.user_id == src_user.id,
                FermentationProject.name.ilike(f"%{PROJECT_NAME_FRAGMENT}%"),
            )
            .first()
        )
        if not src_project:
            print(f"No project matching '{PROJECT_NAME_FRAGMENT}' found for {FROM_EMAIL}"); return

        print(f"Duplicating '{src_project.name}' to {TO_EMAIL}")

        # ── Duplicate the project itself ──────────────────────────────────────
        new_project = FermentationProject(
            user_id                 = dst_user.id,
            name                    = src_project.name,
            fermentation_type       = src_project.fermentation_type,
            status                  = src_project.status,
            description             = src_project.description,
            batch_size_liters       = src_project.batch_size_liters,
            start_date              = src_project.start_date,
            end_date                = src_project.end_date,
            target_end_date         = src_project.target_end_date,
            initial_gravity         = src_project.initial_gravity,
            final_gravity           = src_project.final_gravity,
            initial_ph              = src_project.initial_ph,
            fermentation_temp_celsius = src_project.fermentation_temp_celsius,
            vessel_type             = src_project.vessel_type,
            notes                   = src_project.notes,
            cover_photo_url         = src_project.cover_photo_url,
            sugar_amount_grams      = src_project.sugar_amount_grams,
            is_public               = src_project.is_public,
            visibility              = src_project.visibility,
        )
        db.add(new_project)
        db.flush()  # get new_project.id

        # ── Measurements ──────────────────────────────────────────────────────
        measurements = db.query(MeasurementLog).filter_by(project_id=src_project.id).all()
        for m in measurements:
            db.add(MeasurementLog(
                project_id          = new_project.id,
                logged_at           = m.logged_at,
                specific_gravity    = m.specific_gravity,
                ph                  = m.ph,
                temperature_celsius = m.temperature_celsius,
                co2_psi             = m.co2_psi,
                brix                = m.brix,
                alcohol_by_volume   = m.alcohol_by_volume,
                notes               = m.notes,
            ))
        print(f"  Copied {len(measurements)} measurements")

        # ── Observations ──────────────────────────────────────────────────────
        observations = db.query(ObservationNote).filter_by(project_id=src_project.id).all()
        for o in observations:
            db.add(ObservationNote(
                project_id = new_project.id,
                user_id    = dst_user.id,
                content    = o.content,
                tags       = o.tags,
                photo_url  = o.photo_url,
                created_at = o.created_at,
            ))
        print(f"  Copied {len(observations)} observations")

        # ── Album photos ──────────────────────────────────────────────────────
        photos = db.query(ProjectPhoto).filter_by(project_id=src_project.id).all()
        for p in photos:
            db.add(ProjectPhoto(
                project_id = new_project.id,
                user_id    = dst_user.id,
                url        = p.url,
                caption    = p.caption,
                taken_at   = p.taken_at,
            ))
        print(f"  Copied {len(photos)} album photos")

        # ── Yeast connections ─────────────────────────────────────────────────
        yeast_conns = db.query(ProjectYeastConnection).filter_by(project_id=src_project.id).all()
        for yc in yeast_conns:
            db.add(ProjectYeastConnection(
                project_id = new_project.id,
                yeast_id   = yc.yeast_id,
            ))
        print(f"  Copied {len(yeast_conns)} yeast connections")

        db.commit()
        print(f"\nDone — new project id={new_project.id} owned by {TO_EMAIL}")
        print("Deleting the original will NOT affect this copy.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
