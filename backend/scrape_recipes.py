"""
Homebrew Academy Recipe Scraper
Scrapes beer recipes from homebrewacademy.com and seeds the local database.

Usage (from the backend/ directory):
    uv run python scrape_recipes.py

Requirements:
    uv sync --dev   (installs beautifulsoup4 and httpx)
"""

import re
import sys
import os
import time

sys.path.insert(0, os.path.dirname(__file__))

import httpx
from bs4 import BeautifulSoup

from app.db.database import SessionLocal
from app.models.models import Recipe, RecipeIngredient, FermentationType

INDEX_URL = "https://homebrewacademy.com/beer-recipes/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def get(url: str) -> BeautifulSoup:
    resp = httpx.get(url, headers=HEADERS, timeout=30, follow_redirects=True)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


# ── Helpers ───────────────────────────────────────────────────────────────────

def gallons_to_liters(gallons: float) -> float:
    return round(gallons * 3.785, 2)


def lbs_to_g(lbs: float) -> float:
    return round(lbs * 453.592, 1)


def oz_to_g(oz: float) -> float:
    return round(oz * 28.3495, 1)


def parse_quantity(raw: str) -> tuple[float | None, str | None, str]:
    """
    Parse ingredient strings like:
      "7 lbs American 2-Row"
      "2.0 oz Hallertauer Pellets"
      "1 package Wyeast #1007"
      "8 oz Corn Sugar/Dextrose"
    Returns (quantity_in_base_unit, unit, cleaned_name).
    Units are normalised to grams where possible.
    """
    raw = raw.strip()

    # Match patterns like "7 lbs", "1 lb 8 oz", "2.0 oz", "1 package"
    m = re.match(
        r'^([\d./]+)\s*(lb|lbs|oz|g|kg|ml|l|litre|liter|gallon|gal|package|pkg|tsp|tbsp|cup|cups)s?\b\.?\s*(?:([\d./]+)\s*(oz|g|ml)\s*)?(.+)$',
        raw, re.IGNORECASE
    )
    if not m:
        return None, None, raw

    qty_str, unit, sub_qty_str, sub_unit, name = m.groups()

    try:
        qty = float(qty_str.replace('/', '.'))
    except ValueError:
        qty = None

    unit = unit.lower()
    name = name.strip().strip('()').strip()

    # Handle "1 lb 8 oz" compound
    if sub_qty_str and sub_unit:
        try:
            sub_qty = float(sub_qty_str)
            if sub_unit.lower() == 'oz':
                qty = (qty or 0) + sub_qty / 16  # convert to lbs
        except ValueError:
            pass

    # Normalise to grams
    if unit in ('lb', 'lbs'):
        return lbs_to_g(qty or 0), 'g', name
    if unit == 'oz':
        return oz_to_g(qty or 0), 'g', name
    if unit in ('gallon', 'gal'):
        return gallons_to_liters(qty or 0), 'L', name
    if unit in ('litre', 'liter', 'l'):
        return qty, 'L', name
    if unit in ('package', 'pkg'):
        return 1.0, 'package', name
    if unit in ('tsp',):
        return qty, 'tsp', name
    if unit in ('tbsp',):
        return qty, 'tbsp', name
    if unit in ('cup', 'cups'):
        return qty, 'cups', name
    if unit in ('g',):
        return qty, 'g', name
    if unit in ('kg',):
        return (qty or 0) * 1000, 'g', name
    if unit in ('ml',):
        return qty, 'ml', name

    return qty, unit, name


def infer_fermentation_type(name: str, description: str) -> FermentationType:
    """Map recipe style keywords to FermentationType enum values."""
    text = (name + ' ' + description).lower()
    if any(k in text for k in ('sour', 'gose', 'lambic', 'berliner', 'saison', 'farmhouse', 'belgian', 'witbier', 'tripel', 'dubbel', 'quad')):
        return FermentationType.BEER
    if any(k in text for k in ('mead', 'honey wine')):
        return FermentationType.MEAD
    if any(k in text for k in ('cider', 'apple', 'pear')):
        return FermentationType.CIDER
    if any(k in text for k in ('wine', 'grape')):
        return FermentationType.WINE
    if any(k in text for k in ('kombucha',)):
        return FermentationType.KOMBUCHA
    return FermentationType.BEER


def infer_difficulty(soup: BeautifulSoup, url: str) -> str:
    text = soup.get_text().lower()
    if 'beginner' in text or 'easy' in text or 'simple' in text:
        return 'beginner'
    if 'advanced' in text or 'expert' in text:
        return 'advanced'
    return 'intermediate'


def parse_abv(text: str) -> float | None:
    m = re.search(r'(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*%\s*abv', text, re.IGNORECASE)
    if m:
        return round((float(m.group(1)) + float(m.group(2))) / 2, 1)
    m = re.search(r'abv[:\s]*(\d+\.?\d*)\s*%', text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    return None


def parse_batch_size(text: str) -> float | None:
    # "5 gallon" or "5-gallon" or "19 liters"
    m = re.search(r'(\d+\.?\d*)\s*[-\s]?gallon', text, re.IGNORECASE)
    if m:
        return gallons_to_liters(float(m.group(1)))
    m = re.search(r'(\d+\.?\d*)\s*(liter|litre|L)\b', text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    return None


def parse_duration(text: str) -> int | None:
    # "7 days", "2 weeks"
    m = re.search(r'(\d+)\s*week', text, re.IGNORECASE)
    if m:
        return int(m.group(1)) * 7
    m = re.search(r'(\d+)\s*day', text, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None


# ── Index scraper ─────────────────────────────────────────────────────────────

def scrape_index() -> list[str]:
    """Return all recipe URLs from the index page."""
    print(f"Fetching index: {INDEX_URL}")
    soup = get(INDEX_URL)

    urls = set()
    base = "https://homebrewacademy.com"

    for a in soup.select('a[href]'):
        href = a['href']
        # Only internal recipe links — skip categories, cocktails, anchors
        if not href.startswith('http'):
            href = base + href
        if (
            href.startswith(base)
            and href != INDEX_URL
            and '/beer-recipes/' not in href
            and '#' not in href
            and not any(skip in href for skip in [
                'category', 'tag', 'page', 'wp-', 'feed', 'comment',
                'cocktail', 'shandy', 'paloma', 'beermosa', 'michelada',
                'radler', 'privacy', 'about', 'contact', 'shop',
            ])
            and href.count('/') >= 4  # must be a post URL, not a top-level page
        ):
            urls.add(href.rstrip('/') + '/')

    print(f"Found {len(urls)} candidate recipe URLs")
    return sorted(urls)


# ── Recipe page scraper ───────────────────────────────────────────────────────

def scrape_recipe(url: str) -> dict | None:
    """
    Scrape a single recipe page. Returns a dict ready to insert, or None if
    the page doesn't look like a recipe.
    """
    try:
        soup = get(url)
    except Exception as e:
        print(f"  [SKIP] {url} — fetch error: {e}")
        return None

    full_text = soup.get_text(separator=' ')

    # Must have ingredient-like content to be considered a recipe
    if not re.search(r'\b(lbs?|oz|gallon|yeast|malt|hops?)\b', full_text, re.IGNORECASE):
        print(f"  [SKIP] {url} — doesn't look like a recipe")
        return None

    # ── Name ──
    h1 = soup.find('h1')
    name = h1.get_text(strip=True) if h1 else url.rstrip('/').split('/')[-1].replace('-', ' ').title()

    # ── Description ──
    desc_el = soup.select_one('.entry-content p, article p, .post-content p')
    description = desc_el.get_text(strip=True)[:500] if desc_el else None

    # ── Stats ──
    batch_size = parse_batch_size(full_text)
    duration = parse_duration(full_text)
    difficulty = infer_difficulty(soup, url)
    fermentation_type = infer_fermentation_type(name, full_text)

    # ── Instructions ──
    # Grab ordered list items or paragraphs that look like steps
    steps = []
    for ol in soup.select('ol'):
        items = [li.get_text(strip=True) for li in ol.find_all('li')]
        if items:
            steps.extend(items)
            break  # take first ordered list only

    instructions = '\n'.join(f"{i+1}. {s}" for i, s in enumerate(steps)) if steps else None

    # ── Tips ──
    tips_section = None
    for heading in soup.find_all(['h2', 'h3']):
        if 'tip' in heading.get_text().lower() or 'note' in heading.get_text().lower():
            nxt = heading.find_next_sibling()
            if nxt:
                tips_section = nxt.get_text(strip=True)[:300]
            break

    # ── Ingredients ──
    ingredients = []
    seen_names = set()
    idx = 0

    for heading in soup.find_all(['h2', 'h3', 'h4']):
        heading_text = heading.get_text().lower()
        if any(k in heading_text for k in ('ingredient', 'grain', 'malt', 'hop', 'yeast', 'fermentable', 'adjunct', 'addition')):
            # Collect list items under this heading
            sibling = heading.find_next_sibling()
            while sibling and sibling.name not in ('h2', 'h3', 'h4'):
                if sibling.name in ('ul', 'ol'):
                    for li in sibling.find_all('li'):
                        raw = li.get_text(separator=' ', strip=True)
                        qty, unit, ing_name = parse_quantity(raw)
                        if ing_name and ing_name.lower() not in seen_names and len(ing_name) > 1:
                            seen_names.add(ing_name.lower())
                            # Flag yeast entries
                            is_yeast = any(k in ing_name.lower() for k in ('yeast', 'wyeast', 'white labs', 'safale', 'lalvin', 'fermentis'))
                            ingredients.append({
                                'name': ing_name,
                                'quantity': qty,
                                'unit': unit,
                                'notes': 'yeast' if is_yeast else None,
                                'order_index': idx,
                            })
                            idx += 1
                sibling = sibling.find_next_sibling()

    # Also scan tables (some pages use tables for grain bills)
    for table in soup.find_all('table'):
        for row in table.find_all('tr')[1:]:  # skip header
            cells = [td.get_text(strip=True) for td in row.find_all('td')]
            if len(cells) >= 2:
                # Try "Name | Amount" or "Amount | Name" layouts
                raw = ' '.join(cells[:2])
                qty, unit, ing_name = parse_quantity(raw)
                if not ing_name or ing_name.lower() in seen_names or len(ing_name) <= 1:
                    continue
                seen_names.add(ing_name.lower())
                is_yeast = any(k in ing_name.lower() for k in ('yeast', 'wyeast', 'white labs', 'safale', 'lalvin'))
                ingredients.append({
                    'name': ing_name,
                    'quantity': qty,
                    'unit': unit,
                    'notes': 'yeast' if is_yeast else None,
                    'order_index': idx,
                })
                idx += 1

    if not ingredients:
        print(f"  [SKIP] {url} — no ingredients parsed")
        return None

    return {
        'name': name,
        'fermentation_type': fermentation_type,
        'description': description,
        'difficulty': difficulty,
        'batch_size_liters': batch_size,
        'estimated_duration_days': duration,
        'instructions': instructions,
        'tips': tips_section,
        'is_public': True,
        'creator_id': None,
        'ingredients': ingredients,
    }


# ── Seeder ────────────────────────────────────────────────────────────────────

def seed():
    urls = scrape_index()
    db = SessionLocal()

    added = skipped = failed = 0

    try:
        for url in urls:
            print(f"\nScraping: {url}")
            data = scrape_recipe(url)
            if not data:
                skipped += 1
                time.sleep(0.3)
                continue

            # Skip if recipe with same name already exists
            existing = db.query(Recipe).filter(Recipe.name == data['name']).first()
            if existing:
                print(f"  [EXISTS] {data['name']}")
                skipped += 1
                time.sleep(0.3)
                continue

            ingredients = data.pop('ingredients')
            recipe = Recipe(**data)
            db.add(recipe)
            db.flush()

            for ing in ingredients:
                db.add(RecipeIngredient(recipe_id=recipe.id, **ing))

            db.commit()
            print(f"  [OK] {recipe.name} — {len(ingredients)} ingredients")
            added += 1
            time.sleep(0.4)

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

    print(f"\nDone — {added} recipes added, {skipped} skipped, {failed} failed.")


if __name__ == '__main__':
    seed()
