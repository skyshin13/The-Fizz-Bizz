"""
Upload day-1 pickled red onion photo to Supabase Storage
and attach it to the matching observation note.
"""
import os, time, requests, jwt
from sqlalchemy import create_engine, text

DATABASE_URL    = "postgresql://postgres.ilijgndxhamiqtuabaoz:PRhjnJKVC89j2k5v@aws-1-us-east-2.pooler.supabase.com:6543/postgres"
SUPABASE_URL    = "https://ilijgndxhamiqtuabaoz.supabase.co"
JWT_SECRET      = "XHbTQKeiiM6+CLGrwC5R7c5seRbWy8CM2Q27Imzu3wPdRsHXk/5iXt/qSjiHkzyn+1aES+VrwQfRZ1jbIJFdLA=="
IMAGE_PATH      = r"C:\Users\skyle\OneDrive\Desktop\databases\pictures\lactoferment\onions\IMG_3310-1665x2048.jpg"
BUCKET          = "project-photos"
STORAGE_PATH    = "observations/red-onions-day1.jpg"

# ── 1. Mint service-role JWT ──────────────────────────────────────────────────
payload = {
    "role": "service_role",
    "iss": "supabase",
    "iat": int(time.time()),
    "exp": int(time.time()) + 3600,
}
token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
headers = {"Authorization": f"Bearer {token}", "apikey": token}

# ── 2. Upload image ───────────────────────────────────────────────────────────
upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{STORAGE_PATH}"
with open(IMAGE_PATH, "rb") as f:
    resp = requests.post(
        upload_url,
        headers={**headers, "Content-Type": "image/jpeg", "x-upsert": "true"},
        data=f,
    )
print(f"Upload status: {resp.status_code} — {resp.text[:200]}")
resp.raise_for_status()

public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{STORAGE_PATH}"
print(f"Public URL: {public_url}")

# ── 3. Find day-1 observation note and update photo_url ──────────────────────
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    # Find the pickled red onion project
    row = conn.execute(text(
        "SELECT id, name FROM fermentation_projects "
        "WHERE user_id = 2 AND LOWER(name) LIKE '%pickled%onion%' LIMIT 1"
    )).fetchone()
    if not row:
        raise SystemExit("Could not find pickled red onion project for user 2")
    project_id, project_name = row
    print(f"Project: id={project_id} name={project_name!r}")

    # List all observation notes for context
    notes = conn.execute(text(
        "SELECT id, created_at, LEFT(content, 80) AS snippet "
        "FROM observation_notes WHERE project_id = :pid ORDER BY created_at"
    ), {"pid": project_id}).fetchall()
    print("\nObservation notes:")
    for n in notes:
        print(f"  id={n.id}  created_at={n.created_at}  snippet={n.snippet!r}")

    # Insert a day 1 observation note (project start: 2026-03-01, Day 1 = 2026-03-01)
    result = conn.execute(text("""
        INSERT INTO observation_notes (project_id, user_id, content, photo_url, created_at)
        VALUES (:pid, 2, 'Day 1: just packed the jar — thinly sliced red onions submerged in warm apple cider vinegar brine with salt, sugar, and peppercorns. Onions are crisp and bright purple.', :url, '2026-03-01 10:00:00+00:00')
        RETURNING id
    """), {"pid": project_id, "url": public_url})
    new_id = result.fetchone().id
    conn.commit()
    print(f"Created day 1 observation note id={new_id} with photo attached.")
