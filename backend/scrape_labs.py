"""
Lab Website Enrichment Scraper
Pulls extended descriptions and recommended styles from:
  - White Labs  (whitelabs.com)
  - Wyeast      (wyeastlab.com)
  - Fermentis   (fermentis.com)

Usage (from backend/ directory):
    uv run alembic upgrade head        # add new columns first
    uv run python scrape_labs.py       # enrich the DB

Strains that can't be matched or whose lab page fails are skipped with a warning.
"""

import re
import time
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

import httpx
from bs4 import BeautifulSoup

from app.db.database import SessionLocal
from app.models.models import YeastProfile

# ── HTTP client ───────────────────────────────────────────────────────────────

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}


def get(url: str, **kw) -> BeautifulSoup:
    resp = httpx.get(url, headers=HEADERS, timeout=30, follow_redirects=True, **kw)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, 'html.parser')


def first_text(*elements) -> str | None:
    """Return stripped text of the first non-empty element."""
    for el in elements:
        if el:
            t = el.get_text(separator=' ', strip=True)
            if t:
                return t
    return None


# ── White Labs ────────────────────────────────────────────────────────────────

def build_whitelabs_index() -> dict[str, str]:
    """
    Scrape the White Labs yeast bank listing (all pages) and return
    a dict mapping WLP strain code → numeric page ID.
    e.g. {'WLP001': '101', 'WLP002': '102', ...}
    """
    index: dict[str, str] = {}
    page = 1
    print("  Building White Labs index…")

    while True:
        url = (
            f"https://www.whitelabs.com/yeast-bank"
            f"?categoryID=3&searchType=YEAST&keyword=0"
            f"&att_first=0&att_sec=100&fer_first=0&fer_sec=100&page={page}"
        )
        try:
            soup = get(url)
        except Exception as e:
            print(f"    [WL] listing page {page} failed: {e}")
            break

        links = soup.select('a[href*="yeast-single"]')
        if not links:
            break

        for link in links:
            href = link.get('href', '')
            id_match = re.search(r'id=(\d+)', href)
            if not id_match:
                continue
            wl_id = id_match.group(1)
            text = link.get_text()
            code_match = re.search(r'(WLP\d+[A-Z]?)', text)
            if code_match:
                index[code_match.group(1)] = wl_id

        print(f"    page {page}: {len(links)} links found, index now {len(index)} strains")
        page += 1
        time.sleep(0.4)
        if page > 20:
            break

    return index


def scrape_whitelabs_strain(wl_id: str) -> dict:
    """Scrape a single White Labs strain page and return enrichment data."""
    url = f"https://www.whitelabs.com/yeast-single?id={wl_id}&type=YEAST"
    soup = get(url)

    data: dict = {}

    # Description — try several common Drupal field selectors
    desc = first_text(
        soup.select_one('.field--name-field-yeast-description'),
        soup.select_one('.field--name-body'),
        soup.select_one('[class*="description"] p'),
        soup.select_one('main p'),
    )
    if desc:
        data['lab_description'] = desc

    # Recommended beer styles
    style_els = (
        soup.select('.field--name-field-beer-styles .field__item') or
        soup.select('[class*="beer-style"]') or
        soup.select('[class*="styles"] li')
    )
    styles = [el.get_text(strip=True) for el in style_els if el.get_text(strip=True)]
    if styles:
        data['recommended_styles'] = styles

    return data


def enrich_whitelabs(db, yeasts: list[YeastProfile]) -> tuple[int, int]:
    wl_yeasts = [y for y in yeasts if (y.brand or '').lower().startswith('white labs')]
    if not wl_yeasts:
        return 0, 0

    index = build_whitelabs_index()
    if not index:
        print("  [WL] Could not build index — skipping White Labs")
        return 0, 0

    updated = skipped = 0
    for yeast in wl_yeasts:
        # Extract WLP code from name, e.g. "WLP001 California Ale" → "WLP001"
        code_match = re.search(r'(WLP\d+[A-Z]?)', yeast.name or '')
        if not code_match:
            skipped += 1
            continue

        code = code_match.group(1)
        wl_id = index.get(code)
        if not wl_id:
            print(f"    [WL] {code} not found in index")
            skipped += 1
            continue

        try:
            enrichment = scrape_whitelabs_strain(wl_id)
            if enrichment:
                for k, v in enrichment.items():
                    setattr(yeast, k, v)
                updated += 1
                print(f"    [WL] ✓ {yeast.name} — {len(enrichment.get('recommended_styles', []))} styles")
            else:
                skipped += 1
        except Exception as e:
            print(f"    [WL] ✗ {yeast.name}: {e}")
            skipped += 1

        time.sleep(0.35)

    return updated, skipped


# ── Wyeast ────────────────────────────────────────────────────────────────────

WYEAST_CATEGORIES = [
    'beer', 'cider', 'wild-sour', 'wine', 'mead', 'spirits', 'sake',
]


def build_wyeast_index() -> dict[str, str]:
    """
    Scrape all Wyeast category pages and return
    a dict mapping strain number string → product URL.
    e.g. {'1056': 'https://wyeastlab.com/product/american-ale/', ...}
    """
    index: dict[str, str] = {}
    print("  Building Wyeast index…")

    for cat in WYEAST_CATEGORIES:
        url = f"https://wyeastlab.com/yeast-cultures/{cat}/about"
        try:
            soup = get(url)
        except Exception as e:
            print(f"    [WY] category '{cat}' failed: {e}")
            continue

        # Product links typically look like /product/[slug]/
        for link in soup.select('a[href*="/product/"]'):
            href = link.get('href', '')
            full_url = href if href.startswith('http') else f"https://wyeastlab.com{href}"

            # Try to extract strain number from link text or nearby element
            text = link.get_text()
            num_match = re.search(r'\b(\d{4})\b', text)
            if num_match:
                index[num_match.group(1)] = full_url

        time.sleep(0.4)

    print(f"    Wyeast index: {len(index)} strains")
    return index


def scrape_wyeast_strain(url: str) -> dict:
    """Scrape a single Wyeast strain product page."""
    soup = get(url)
    data: dict = {}

    # Description
    desc = first_text(
        soup.select_one('.entry-content'),
        soup.select_one('.woocommerce-product-details__short-description'),
        soup.select_one('[class*="product-description"]'),
        soup.select_one('article .content'),
    )
    if desc:
        data['lab_description'] = desc[:2000]  # cap length

    # Recommended styles
    style_els = (
        soup.select('[class*="yeast-style"]') or
        soup.select('[class*="beer-style"]') or
        soup.select('.styles li') or
        soup.select('[class*="styles"] .item')
    )
    styles = [el.get_text(strip=True) for el in style_els if el.get_text(strip=True)]
    if styles:
        data['recommended_styles'] = styles

    return data


def enrich_wyeast(db, yeasts: list[YeastProfile]) -> tuple[int, int]:
    wy_yeasts = [y for y in yeasts if (y.brand or '').lower().startswith('wyeast')]
    if not wy_yeasts:
        return 0, 0

    index = build_wyeast_index()
    if not index:
        print("  [WY] Could not build index — skipping Wyeast")
        return 0, 0

    updated = skipped = 0
    for yeast in wy_yeasts:
        # Extract 4-digit strain number from name, e.g. "1056 American Ale" → "1056"
        num_match = re.search(r'\b(\d{4})\b', yeast.name or '')
        if not num_match:
            skipped += 1
            continue

        num = num_match.group(1)
        strain_url = index.get(num)
        if not strain_url:
            print(f"    [WY] {num} not found in index")
            skipped += 1
            continue

        try:
            enrichment = scrape_wyeast_strain(strain_url)
            if enrichment:
                for k, v in enrichment.items():
                    setattr(yeast, k, v)
                updated += 1
                print(f"    [WY] ✓ {yeast.name}")
            else:
                skipped += 1
        except Exception as e:
            print(f"    [WY] ✗ {yeast.name}: {e}")
            skipped += 1

        time.sleep(0.35)

    return updated, skipped


# ── Fermentis ─────────────────────────────────────────────────────────────────

def build_fermentis_index() -> dict[str, str]:
    """
    Scrape Fermentis beer yeast listing and return
    a dict mapping product slug → full URL.
    e.g. {'safale-us-05': 'https://fermentis.com/en/product/safale-us-05/', ...}
    """
    index: dict[str, str] = {}
    print("  Building Fermentis index…")

    url = "https://fermentis.com/en/fermentation-solutions/beer-brewing-yeast/"
    try:
        soup = get(url)
    except Exception as e:
        print(f"  [FE] listing page failed: {e}")
        return index

    for link in soup.select('a[href*="/en/product/"]'):
        href = link.get('href', '')
        full_url = href if href.startswith('http') else f"https://fermentis.com{href}"
        slug_match = re.search(r'/en/product/([^/]+)/', full_url)
        if slug_match:
            slug = slug_match.group(1)
            index[slug] = full_url

    print(f"    Fermentis index: {len(index)} products")
    return index


def fermentis_slug_for(yeast: YeastProfile) -> str | None:
    """
    Derive the Fermentis product slug from the yeast name.
    e.g. "Safale US-05" → "safale-us-05"
         "SafLager W-34/70" → "saflager-w-34-70"
    """
    name = (yeast.name or '').lower()
    # Remove special chars, replace spaces/slashes with hyphens
    slug = re.sub(r'[\s/]+', '-', name)
    slug = re.sub(r'[^\w\-]', '', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug or None


def scrape_fermentis_strain(url: str) -> dict:
    """Scrape a single Fermentis product page."""
    soup = get(url)
    data: dict = {}

    # Description — Fermentis uses WooCommerce
    desc = first_text(
        soup.select_one('.woocommerce-product-details__short-description'),
        soup.select_one('.product_title ~ div p'),
        soup.select_one('[class*="description"]'),
    )
    if desc:
        data['lab_description'] = desc

    # Recommended styles (if listed)
    style_els = (
        soup.select('[class*="beer-style"]') or
        soup.select('[class*="styles"] li') or
        soup.select('.field--name-field-beer-styles .field__item')
    )
    styles = [el.get_text(strip=True) for el in style_els if el.get_text(strip=True)]
    if styles:
        data['recommended_styles'] = styles

    return data


def enrich_fermentis(db, yeasts: list[YeastProfile]) -> tuple[int, int]:
    # Fermentis brands include "Fermentis", "DCL", "Lallemand" (SafAle/SafLager)
    fe_yeasts = [
        y for y in yeasts
        if any(b in (y.brand or '').lower() for b in ('fermentis', 'dcl', 'saflager', 'safale'))
        or re.match(r'(safale|saflager|safbrew)', (y.name or '').lower())
    ]
    if not fe_yeasts:
        return 0, 0

    index = build_fermentis_index()
    if not index:
        print("  [FE] Could not build index — skipping Fermentis")
        return 0, 0

    updated = skipped = 0
    for yeast in fe_yeasts:
        slug = fermentis_slug_for(yeast)
        strain_url = index.get(slug)

        # Fuzzy match: try partial slug match if exact not found
        if not strain_url and slug:
            for idx_slug, idx_url in index.items():
                if slug in idx_slug or idx_slug in slug:
                    strain_url = idx_url
                    break

        if not strain_url:
            print(f"    [FE] '{yeast.name}' not matched in index")
            skipped += 1
            continue

        try:
            enrichment = scrape_fermentis_strain(strain_url)
            if enrichment:
                for k, v in enrichment.items():
                    setattr(yeast, k, v)
                updated += 1
                print(f"    [FE] ✓ {yeast.name}")
            else:
                skipped += 1
        except Exception as e:
            print(f"    [FE] ✗ {yeast.name}: {e}")
            skipped += 1

        time.sleep(0.35)

    return updated, skipped


# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    db = SessionLocal()
    try:
        yeasts = db.query(YeastProfile).filter(YeastProfile.is_public == True).all()
        print(f"Loaded {len(yeasts)} public yeast strains from DB\n")

        total_updated = total_skipped = 0

        print("── White Labs ──────────────────────────────────────")
        u, s = enrich_whitelabs(db, yeasts)
        total_updated += u; total_skipped += s
        print(f"   {u} updated, {s} skipped\n")

        print("── Wyeast ──────────────────────────────────────────")
        u, s = enrich_wyeast(db, yeasts)
        total_updated += u; total_skipped += s
        print(f"   {u} updated, {s} skipped\n")

        print("── Fermentis ───────────────────────────────────────")
        u, s = enrich_fermentis(db, yeasts)
        total_updated += u; total_skipped += s
        print(f"   {u} updated, {s} skipped\n")

        db.commit()
        print(f"Done — {total_updated} strains enriched, {total_skipped} skipped.")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == '__main__':
    run()
