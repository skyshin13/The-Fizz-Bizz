"""
Fix fermentation_type enum labels: convert native PG enum columns to VARCHAR
with lowercase values so they match the Python FermentationType enum values.
"""
from sqlalchemy import create_engine, text

engine = create_engine(
    'postgresql://postgres.ilijgndxhamiqtuabaoz:PRhjnJKVC89j2k5v@aws-1-us-east-2.pooler.supabase.com:6543/postgres'
)

RENAMES = [
    ('KOMBUCHA',          'kombucha'),
    ('PROBIOTIC_SODA',    'probiotic_soda'),
    ('LACTO_FERMENTATION','lacto_fermentation'),
    ('ALCOHOL_BREWING',   'alcohol_brewing'),
    ('KIMCHI',            'kimchi'),
    ('WATER_KEFIR',       'water_kefir'),
    ('MILK_KEFIR',        'milk_kefir'),
    ('MEAD',              'mead'),
    ('CIDER',             'cider'),
    ('BEER',              'beer'),
    ('WINE',              'wine'),
    ('GENERAL',           'general'),
]

with engine.connect() as conn:
    # Step 1: convert each table's column from native enum → VARCHAR with lowercase values
    for table, col in [
        ('fermentation_projects', 'fermentation_type'),
        ('yeast_profiles',        'fermentation_type'),
        ('recipes',               'fermentation_type'),
    ]:
        try:
            conn.execute(text(
                f"ALTER TABLE {table} "
                f"ALTER COLUMN {col} TYPE VARCHAR "
                f"USING LOWER({col}::text)"
            ))
            print(f"Converted {table}.{col} to VARCHAR with lowercase")
        except Exception as e:
            print(f"Skipped {table}.{col}: {e}")
            conn.execute(text("ROLLBACK"))
            conn.execute(text("BEGIN"))

    conn.commit()

    # Verify
    rows = conn.execute(text(
        "SELECT DISTINCT fermentation_type FROM fermentation_projects ORDER BY 1"
    )).fetchall()
    print("fermentation_projects values after fix:", [r[0] for r in rows])
