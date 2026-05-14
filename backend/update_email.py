from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres.ilijgndxhamiqtuabaoz:PRhjnJKVC89j2k5v@aws-1-us-east-2.pooler.supabase.com:6543/postgres')
with engine.connect() as conn:
    row = conn.execute(text('SELECT id, username, email FROM users WHERE id = 2')).fetchone()
    print('Before:', row)
    conn.execute(text("UPDATE users SET email = 'skyler.shin@cooper.edu' WHERE id = 2"))
    conn.commit()
    row = conn.execute(text('SELECT id, username, email FROM users WHERE id = 2')).fetchone()
    print('After:', row)
