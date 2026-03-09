# Migrate from SQLite to PostgreSQL on Render

## Why PostgreSQL?

✅ **Better for production** - More reliable, concurrent connections
✅ **Persistent storage** - SQLite on Render gets wiped on redeploy
✅ **Better performance** - Optimized for web apps
✅ **ACID compliance** - Better data integrity

## Step-by-Step Migration

### 1. Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Settings:
   - **Name**: `isibi-database`
   - **Database**: `isibi`
   - **Region**: Same as your backend
   - **Plan**: Free (testing) or Starter $7/month (production)
4. Click **"Create Database"**
5. Wait for provisioning (~2 minutes)

### 2. Get Database URL

After creation, copy the **Internal Database URL**:
```
postgresql://isibi_user:password@host.oregon-postgres.render.com:5432/isibi
```

### 3. Add to Render Environment Variables

Go to your backend service → Environment:

```
DATABASE_URL=postgresql://isibi_user:password@host:5432/isibi
```

**Important**: Render may auto-add this if you "link" the database to your service.

### 4. Update requirements.txt

Add PostgreSQL driver:

```txt
psycopg2-binary==2.9.9
```

### 5. Update db.py to Support Both SQLite and PostgreSQL

Replace the connection code in `db.py`:

```python
import os
import json
from datetime import datetime

# Check which database to use
DATABASE_URL = os.getenv("DATABASE_URL")
USE_POSTGRES = DATABASE_URL and DATABASE_URL.startswith("postgres")

if USE_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    
    def get_conn():
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
else:
    import sqlite3
    
    DB_PATH = os.getenv("DB_PATH", "app.db")
    
    def get_conn():
        conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=30000;")
        return conn
```

### 6. Update Schema Creation for PostgreSQL

In `init_db()`, update table definitions:

**SQLite:**
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
```

**PostgreSQL:**
```sql
id SERIAL PRIMARY KEY
```

**SQLite:**
```sql
cost_usd REAL DEFAULT 0.0
```

**PostgreSQL:**
```sql
cost_usd NUMERIC(10,4) DEFAULT 0.0
```

### 7. Deploy

```bash
git add db.py requirements.txt
git commit -m "Add PostgreSQL support"
git push origin main
```

Render will:
1. Install psycopg2
2. Connect to PostgreSQL
3. Run init_db() automatically
4. Create all tables

### 8. Verify

Check logs in Render:
```
✅ PostgreSQL database initialized successfully
```

## Quick Migration Script

If you want to migrate existing SQLite data to PostgreSQL:

```python
# migrate_to_postgres.py
import sqlite3
import psycopg2
from psycopg2.extras import execute_values

# Connect to both
sqlite_conn = sqlite3.connect('app.db')
sqlite_conn.row_factory = sqlite3.Row

pg_conn = psycopg2.connect(os.getenv('DATABASE_URL'))

# Migrate users
sqlite_cur = sqlite_conn.cursor()
pg_cur = pg_conn.cursor()

sqlite_cur.execute("SELECT * FROM users")
users = sqlite_cur.fetchall()

for user in users:
    pg_cur.execute("""
        INSERT INTO users (email, password_hash, tenant_phone, created_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (email) DO NOTHING
    """, (user['email'], user['password_hash'], user['tenant_phone'], user['created_at']))

pg_conn.commit()
print(f"✅ Migrated {len(users)} users")

# Repeat for agents, credits, etc...
```

## Testing

1. **Check connection:**
```bash
# In Render shell
python -c "from db import get_conn; conn = get_conn(); print('Connected!')"
```

2. **Test API:**
```bash
curl https://isibi-backend.onrender.com/api/agents
```

3. **Create test user:**
```bash
curl -X POST https://isibi-backend.onrender.com/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test123"}'
```

## Key Differences: SQLite vs PostgreSQL

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| AUTO_INCREMENT | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| Decimal | `REAL` | `NUMERIC(10,4)` |
| Boolean | `INTEGER` (0/1) | `BOOLEAN` |
| Placeholder | `?` | `%s` |
| Transactions | Auto-commit or manual | Explicit commit required |
| Concurrent writes | Limited | Excellent |

## Troubleshooting

**Error: "relation does not exist"**
- Tables weren't created
- Run: `init_db()` manually in Render shell

**Error: "no password supplied"**
- DATABASE_URL missing or incorrect
- Check environment variables

**Error: "psycopg2 not found"**
- Add `psycopg2-binary==2.9.9` to requirements.txt

**Slow queries**
- Add indexes (already included in schema)
- Use connection pooling for high traffic

## Production Best Practices

1. **Use connection pooling:**
```python
from psycopg2 import pool

db_pool = pool.SimpleConnectionPool(
    minconn=1,
    maxconn=10,
    dsn=DATABASE_URL
)
```

2. **Backup regularly:**
- Render Free: Manual backups only
- Render Starter ($7/mo): Automatic daily backups

3. **Monitor performance:**
- Check slow queries in Render dashboard
- Add indexes where needed

4. **Use migrations:**
- For schema changes in production
- Tools: Alembic, Flask-Migrate

## Summary

✅ **More reliable** - No data loss on redeploy
✅ **Better performance** - Optimized for concurrent users
✅ **Production-ready** - Industry standard
✅ **Easy migration** - Just add DATABASE_URL

Deploy and your backend will automatically use PostgreSQL! 🐘
