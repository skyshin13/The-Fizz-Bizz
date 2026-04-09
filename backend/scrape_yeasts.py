"""
Yeast Database Scraper
Fetches yeast data from brewunited.com and seeds the local database.

Usage (from the backend/ directory):
    uv run python scrape_yeasts.py

Requirements:
    uv sync --dev   (installs beautifulsoup4)
"""

import re
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

import httpx
from bs4 import BeautifulSoup

from app.db.database import SessionLocal
from app.models.models import YeastProfile

URL = "https://www.brewunited.com/yeast_database.php"


# ── Helpers ───────────────────────────────────────────────────────────────────

def f_to_c(f: float) -> float:
    return round((f - 32) * 5 / 9, 1)


def parse_temp(cell: str):
    """Return (min_c, max_c) from strings like '62–75°F' or '62-75°F'."""
    m = re.search(r'(\d+)\s*[–\-]\s*(\d+)\s*°?F', cell)
    if m:
        return f_to_c(int(m.group(1))), f_to_c(int(m.group(2)))
    return None, None


def parse_attenuation(cell: str):
    """Return (min%, max%) from '76.5%' or '72-78%' or '72–78%'."""
    m = re.search(r'(\d+\.?\d*)\s*[–\-]\s*(\d+\.?\d*)\s*%', cell)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = re.search(r'(\d+\.?\d*)\s*%', cell)
    if m:
        v = float(m.group(1))
        return v, v
    return None, None


def split_notes(raw: str):
    """
    Split raw notes text into (description, best_for).
    Handles patterns like:  '...notes text... Best for:** IPAs, pale ales.'
    """
    # Match "Best for:" optionally followed by asterisks/colons
    parts = re.split(r'Best\s+for\s*:?\*{0,2}', raw, maxsplit=1, flags=re.IGNORECASE)
    if len(parts) == 2:
        description = parts[0].strip().rstrip(':').strip()
        best_for = parts[1].strip().lstrip('*').lstrip(':').strip()
        return description, best_for
    return raw.strip(), None


def normalize_flocculation(raw: str) -> str | None:
    raw = raw.lower().strip()
    if raw in ('low', 'medium', 'high', 'very high'):
        return raw
    return raw or None


# ── Scraper ───────────────────────────────────────────────────────────────────

def scrape() -> list[dict]:
    print(f"Fetching {URL} …")
    resp = httpx.get(URL, timeout=30, follow_redirects=True)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, 'html.parser')
    table = soup.find('table')
    if not table:
        raise RuntimeError("Could not find yeast table on page")

    rows = table.find_all('tr')
    records = []

    for row in rows[1:]:  # skip header row
        cells = row.find_all('td')
        if len(cells) < 8:
            continue

        name       = cells[0].get_text(strip=True)
        lab        = cells[1].get_text(strip=True)
        yeast_type = cells[2].get_text(strip=True).lower()
        # cells[3] = Form (liquid/dry) — not stored in model yet
        temp_str   = cells[4].get_text(strip=True)
        att_str    = cells[5].get_text(strip=True)
        flocc_str  = cells[6].get_text(strip=True)
        notes_raw  = cells[7].get_text(separator=' ', strip=True)

        # Skip empty rows and header rows (site uses <td> for headers)
        if not name or name.lower() in ('name', 'yeast name', 'strain'):
            continue

        temp_min_c, temp_max_c = parse_temp(temp_str)
        att_min, att_max       = parse_attenuation(att_str)
        description, best_for  = split_notes(notes_raw)
        flocculation           = normalize_flocculation(flocc_str)

        records.append({
            'name':             name,
            'brand':            lab,
            'yeast_type':       yeast_type,
            'temp_range_min_c': temp_min_c,
            'temp_range_max_c': temp_max_c,
            'attenuation_min':  att_min,
            'attenuation_max':  att_max,
            'flocculation':     flocculation,
            'description':      description,
            'best_for':         best_for,
            'is_public':        True,
            'creator_id':       None,
        })

    return records


# ── Seeder ────────────────────────────────────────────────────────────────────

def seed():
    records = scrape()
    print(f"Scraped {len(records)} yeast strains")

    db = SessionLocal()
    try:
        # Remove any header rows mistakenly inserted as data
        db.query(YeastProfile).filter(
            YeastProfile.name.in_(['Name', 'name', 'Yeast Name', 'Strain'])
        ).delete(synchronize_session=False)
        db.commit()

        added = updated = 0
        for data in records:
            existing = (
                db.query(YeastProfile)
                .filter(
                    YeastProfile.name == data['name'],
                    YeastProfile.brand == data['brand'],
                )
                .first()
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                db.add(YeastProfile(**data))
                added += 1

        db.commit()
        print(f"Done — added {added} new strains, updated {updated} existing.")
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == '__main__':
    seed()
