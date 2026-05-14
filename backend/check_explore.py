from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres.ilijgndxhamiqtuabaoz:PRhjnJKVC89j2k5v@aws-1-us-east-2.pooler.supabase.com:6543/postgres')
with engine.connect() as conn:
    print('=== USERS ===')
    for r in conn.execute(text('SELECT id, username FROM users ORDER BY id')):
        print(r)

    print('\n=== PUBLIC PROJECTS ===')
    q = "SELECT id, user_id, name, fermentation_type FROM fermentation_projects WHERE visibility='everyone' OR is_public=true ORDER BY id"
    for r in conn.execute(text(q)):
        print(r)

    print('\n=== EXISTING LIKES ===')
    for r in conn.execute(text('SELECT project_id, user_id FROM project_likes ORDER BY project_id')):
        print(r)

    print('\n=== EXISTING COMMENTS ===')
    for r in conn.execute(text('SELECT id, project_id, user_id, LEFT(content,60) AS snippet FROM project_comments ORDER BY project_id')):
        print(r)
