import os
import json
from datetime import datetime

# Check which database to use
DATABASE_URL = os.getenv("DATABASE_URL")
USE_POSTGRES = DATABASE_URL and DATABASE_URL.startswith("postgres")

if USE_POSTGRES:
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        import sqlite3  # Still import for the exception types
        
        def get_conn():
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
            return conn
        
        PH = "%s"  # SQL placeholder for PostgreSQL
        
        def sql(query):
            """Replace {PH} placeholders in query string"""
            return query.replace("{PH}", PH)
        
        print("✅ Using PostgreSQL database")
    except ImportError as e:
        print(f"⚠️ PostgreSQL import failed: {e}")
        print("⚠️ Falling back to SQLite")
        USE_POSTGRES = False
        import sqlite3
        
        DB_PATH = os.getenv("DB_PATH", "app.db")
        
        def get_conn():
            conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA busy_timeout=30000;")
            return conn
        
        PH = "?"  # SQL placeholder for SQLite
        
        def sql(query):
            """Replace {PH} placeholders in query string"""
            return query.replace("{PH}", PH)
else:
    import sqlite3
    
    DB_PATH = os.getenv("DB_PATH", "app.db")
    
    def get_conn():
        conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=30000;")
        return conn
    
    PH = "?"  # SQL placeholder for SQLite
    
    def sql(query):
        """Replace {PH} placeholders in query string"""
        return query.replace("{PH}", PH)
    
    print("⚠️ Using SQLite database (local dev)")
    
    # SQL placeholder for SQLite
    def sql_placeholder():
        return "?"
    
    print("⚠️ Using SQLite database (local dev)")

def add_column_if_missing(conn, table, column, coltype):
    """Add column to table if it doesn't exist - works with both SQLite and PostgreSQL.
    Silently skips if the table doesn't exist yet."""
    cur = conn.cursor()

    if USE_POSTGRES:
        # First check the table exists (works with both tuple and dict cursors)
        cur.execute(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = %s", (table,)
        )
        row = cur.fetchone()
        count = (list(row.values())[0] if isinstance(row, dict) else row[0]) if row else 0
        if not count:
            return  # table doesn't exist yet — skip
        # Check if column already exists
        cur.execute(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_name = %s AND column_name = %s", (table, column)
        )
        row = cur.fetchone()
        col_count = (list(row.values())[0] if isinstance(row, dict) else row[0]) if row else 0
        if not col_count:
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
                conn.commit()
            except Exception:
                try: conn.rollback()
                except: pass
    else:
        # SQLite: Use PRAGMA (returns empty list for non-existent tables)
        cur.execute(f"PRAGMA table_info({table})")
        cols = [row[1] for row in cur.fetchall()]
        if column not in cols:
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
                conn.commit()
            except Exception:
                pass

def init_db():
    conn = get_conn()
    cur = conn.cursor()
    
    # Determine SQL syntax based on database type
    if USE_POSTGRES:
        # PostgreSQL syntax
        ID = "SERIAL PRIMARY KEY"
        REAL = "NUMERIC(10,4)"
        TIMESTAMP = "TIMESTAMP"
    else:
        # SQLite syntax
        ID = "INTEGER PRIMARY KEY AUTOINCREMENT"
        REAL = "REAL"
        TIMESTAMP = "TEXT"

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS tenants (
        id {ID},
        phone_number TEXT UNIQUE,
        agent_prompt TEXT
    )
    """)
    
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS users (
        id {ID},
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        tenant_phone TEXT,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS agents (
        id {ID},
        owner_user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        business_name TEXT,
        system_prompt TEXT,
        voice TEXT,
        provider TEXT,
        phone_number TEXT,
        assistant_name TEXT,
        first_message TEXT,
        tools_json TEXT,
        google_calendar_credentials TEXT,
        google_calendar_id TEXT,
        twilio_number_sid TEXT,
        deleted_at {TIMESTAMP},
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP,
        updated_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(owner_user_id) REFERENCES users(id)
    )
    """)
    
    # Add deleted_at column if it doesn't exist (migration)
    add_column_if_missing(conn, 'agents', 'deleted_at', f'{TIMESTAMP}')
    
    # Add twilio_number_sid column if it doesn't exist (migration)
    add_column_if_missing(conn, 'agents', 'twilio_number_sid', 'TEXT')

    # Add model column for per-agent OpenAI Realtime model selection (migration)
    add_column_if_missing(conn, 'agents', 'model', 'TEXT')

    # Add tts_provider column for GPT-4o pipeline TTS choice (migration)
    add_column_if_missing(conn, 'agents', 'tts_provider', 'TEXT')

    # Add llm_provider column: "openai" (default) or "anthropic"
    add_column_if_missing(conn, 'agents', 'llm_provider', 'TEXT')
    
    # Add detailed cost breakdown columns to call_usage (migration)
    add_column_if_missing(conn, 'call_usage', 'input_tokens', 'INTEGER DEFAULT 0')
    add_column_if_missing(conn, 'call_usage', 'output_tokens', 'INTEGER DEFAULT 0')
    add_column_if_missing(conn, 'call_usage', 'input_audio_minutes', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'output_audio_minutes', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'cost_input_tokens', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'cost_output_tokens', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'cost_input_audio', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'cost_output_audio', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'cost_twilio_phone', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'revenue_input_tokens', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'revenue_output_tokens', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'revenue_input_audio', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'revenue_output_audio', f'{REAL} DEFAULT 0.0')
    add_column_if_missing(conn, 'call_usage', 'revenue_twilio_phone', f'{REAL} DEFAULT 0.0')
    
    # Add partial unique index for phone numbers (only for non-deleted agents)
    if USE_POSTGRES:
        try:
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS agents_phone_active_unique 
                ON agents (phone_number) 
                WHERE deleted_at IS NULL AND phone_number IS NOT NULL
            """)
        except:
            pass  # Index might already exist
    
    # Usage tracking table
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS call_usage (
        id {ID},
        user_id INTEGER NOT NULL,
        agent_id INTEGER NOT NULL,
        call_sid TEXT,
        call_from TEXT,
        call_to TEXT,
        duration_seconds INTEGER DEFAULT 0,
        cost_usd {REAL} DEFAULT 0.0,
        revenue_usd {REAL} DEFAULT 0.0,
        profit_usd {REAL} DEFAULT 0.0,
        started_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP,
        ended_at {TIMESTAMP},
        status TEXT DEFAULT 'active',
        
        -- Detailed cost breakdown
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        input_audio_minutes {REAL} DEFAULT 0.0,
        output_audio_minutes {REAL} DEFAULT 0.0,
        
        -- Cost components (what YOU pay)
        cost_input_tokens {REAL} DEFAULT 0.0,
        cost_output_tokens {REAL} DEFAULT 0.0,
        cost_input_audio {REAL} DEFAULT 0.0,
        cost_output_audio {REAL} DEFAULT 0.0,
        cost_twilio_phone {REAL} DEFAULT 0.0,
        
        -- Revenue components (what CUSTOMER pays)
        revenue_input_tokens {REAL} DEFAULT 0.0,
        revenue_output_tokens {REAL} DEFAULT 0.0,
        revenue_input_audio {REAL} DEFAULT 0.0,
        revenue_output_audio {REAL} DEFAULT 0.0,
        revenue_twilio_phone {REAL} DEFAULT 0.0,
        
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(agent_id) REFERENCES agents(id)
    )
    """)
    
    # Monthly usage summary table
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS monthly_usage (
        id {ID},
        user_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        total_calls INTEGER DEFAULT 0,
        total_minutes {REAL} DEFAULT 0.0,
        total_cost_usd {REAL} DEFAULT 0.0,
        total_revenue_usd {REAL} DEFAULT 0.0,
        total_profit_usd {REAL} DEFAULT 0.0,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(user_id, month)
    )
    """)
    
    # Credits balance table
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS user_credits (
        id {ID},
        user_id INTEGER NOT NULL UNIQUE,
        balance {REAL} DEFAULT 0.0,
        total_purchased {REAL} DEFAULT 0.0,
        total_used {REAL} DEFAULT 0.0,
        updated_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)
    
    # Credit transactions table
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS credit_transactions (
        id {ID},
        user_id INTEGER NOT NULL,
        amount {REAL} NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        balance_after {REAL} NOT NULL,
        call_id INTEGER,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(call_id) REFERENCES call_usage(id)
    )
    """)
    
    # User-level Google credentials
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS user_google_credentials (
        id {ID},
        user_id INTEGER NOT NULL UNIQUE,
        google_calendar_credentials TEXT,
        google_calendar_id TEXT DEFAULT 'primary',
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP,
        updated_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)
    
    # Pricing plans table
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS pricing_plans (
        id {ID},
        name TEXT NOT NULL,
        price_per_minute {REAL} NOT NULL,
        included_minutes INTEGER DEFAULT 0,
        monthly_fee {REAL} DEFAULT 0.0,
        active INTEGER DEFAULT 1
    )
    """)

    # Website Agent orders table
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS contacts (
        id {ID},
        user_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT,
        phone_number TEXT NOT NULL,
        email TEXT,
        company TEXT,
        address TEXT,
        tags TEXT,
        notes TEXT,
        status TEXT DEFAULT 'new_lead',
        disposition TEXT,
        source TEXT,
        next_followup TEXT,
        last_contacted TEXT,
        call_count INTEGER DEFAULT 0,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP,
        updated_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS contact_notes (
        id {ID},
        contact_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        note TEXT NOT NULL,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS contact_sms (
        id {ID},
        contact_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        direction TEXT NOT NULL DEFAULT 'outbound',
        message TEXT NOT NULL,
        twilio_sid TEXT,
        status TEXT DEFAULT 'sent',
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS contact_emails (
        id {ID},
        contact_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        direction TEXT NOT NULL DEFAULT 'outbound',
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        from_address TEXT,
        to_address TEXT,
        status TEXT DEFAULT 'sent',
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS contact_appointments (
        id {ID},
        contact_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time {TIMESTAMP} NOT NULL,
        end_time {TIMESTAMP},
        location TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS contact_tasks (
        id {ID},
        contact_id INTEGER,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT,
        priority TEXT DEFAULT 'medium',
        completed INTEGER DEFAULT 0,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS crm_calls (
        id {ID},
        user_id INTEGER NOT NULL,
        contact_id INTEGER,
        contact_name TEXT,
        phone_number TEXT,
        direction TEXT DEFAULT 'outbound',
        duration_seconds INTEGER DEFAULT 0,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        called_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS website_agent_orders (
        id {ID},
        -- Contact
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        business_name TEXT,
        business_address TEXT,
        business_hours TEXT,
        current_website TEXT,
        -- About the business
        business_description TEXT,
        services_offered TEXT,
        competitive_advantage TEXT,
        -- Goals
        website_goals TEXT,
        customer_actions TEXT,
        -- Services / products
        services_list TEXT,
        pricing_info TEXT,
        special_offers TEXT,
        -- Design
        preferred_colors TEXT,
        website_examples TEXT,
        has_logo TEXT DEFAULT 'no',
        has_photos TEXT DEFAULT 'no',
        -- Features
        features_needed TEXT,
        -- Social media
        social_facebook TEXT,
        social_instagram TEXT,
        social_tiktok TEXT,
        social_google TEXT,
        -- Uploaded files (base64 data-URLs)
        logo_data TEXT,
        logo_filename TEXT,
        photos_data TEXT,
        photos_filenames TEXT,
        -- Misc
        additional_notes TEXT,
        payment_status TEXT DEFAULT 'pending',
        stripe_session_id TEXT,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # --- MIGRATIONS (keep Render DB in sync) ---
    add_column_if_missing(conn, "agents", "phone_number", "TEXT")
    add_column_if_missing(conn, "agents", "provider", "TEXT")
    add_column_if_missing(conn, "agents", "first_message", "TEXT")
    add_column_if_missing(conn, "agents", "business_name", "TEXT")
    add_column_if_missing(conn, "agents", "assistant_name", "TEXT")
    add_column_if_missing(conn, "agents", "system_prompt", "TEXT")
    add_column_if_missing(conn, "agents", "voice", "TEXT")
    add_column_if_missing(conn, "agents", "tools_json", "TEXT")  # store JSON as TEXT
    add_column_if_missing(conn, "agents", "settings_json", "TEXT")  # for future use
    add_column_if_missing(conn, "agents", "google_calendar_credentials", "TEXT")  # Google OAuth tokens
    add_column_if_missing(conn, "agents", "google_calendar_id", "TEXT")  # Calendar ID (default = 'primary')
    
    # Slack integration columns
    add_column_if_missing(conn, "users", "slack_bot_token", "TEXT")
    add_column_if_missing(conn, "users", "slack_default_channel", "TEXT")
    add_column_if_missing(conn, "users", "slack_enabled", "BOOLEAN DEFAULT FALSE")
    add_column_if_missing(conn, "agents", "slack_channel", "TEXT")  # Per-agent channel override
    
    # Microsoft Teams integration columns
    add_column_if_missing(conn, "users", "teams_webhook_url", "TEXT")
    add_column_if_missing(conn, "users", "teams_enabled", "BOOLEAN DEFAULT FALSE")
    
    # Square payment integration columns
    add_column_if_missing(conn, "users", "square_access_token", "TEXT")
    add_column_if_missing(conn, "users", "square_environment", "TEXT")
    add_column_if_missing(conn, "users", "square_enabled", "BOOLEAN DEFAULT FALSE")
    
    # ElevenLabs voice integration columns
    add_column_if_missing(conn, "users", "elevenlabs_api_key", "TEXT")
    add_column_if_missing(conn, "users", "elevenlabs_enabled", "BOOLEAN DEFAULT FALSE")
    add_column_if_missing(conn, "agents", "elevenlabs_voice_id", "TEXT")  # Per-agent voice selection
    add_column_if_missing(conn, "agents", "voice_provider", "TEXT DEFAULT 'openai'")  # openai or elevenlabs
    add_column_if_missing(conn, "agents", "language", "TEXT DEFAULT 'en'")  # Agent response language
    
    # Voice Activity Detection (VAD) settings for noise suppression
    add_column_if_missing(conn, "agents", "vad_threshold", "REAL")  # 0.0-1.0, higher = less sensitive
    add_column_if_missing(conn, "agents", "vad_silence_duration_ms", "INTEGER")  # Milliseconds of silence before ending turn
    
    # Auto-recharge settings
    add_column_if_missing(conn, "users", "auto_recharge_enabled", "BOOLEAN DEFAULT FALSE")
    add_column_if_missing(conn, "users", "auto_recharge_amount", "REAL DEFAULT 10.0")
    add_column_if_missing(conn, "users", "stripe_customer_id", "TEXT")
    add_column_if_missing(conn, "users", "stripe_payment_method_id", "TEXT")
    
    # Shopify integration
    add_column_if_missing(conn, "users", "shopify_shop_name", "TEXT")
    add_column_if_missing(conn, "users", "shopify_access_token", "TEXT")
    add_column_if_missing(conn, "users", "shopify_enabled", "BOOLEAN DEFAULT FALSE")
    
    # Password reset
    add_column_if_missing(conn, "users", "reset_token", "TEXT")
    add_column_if_missing(conn, "users", "reset_token_expires", "TIMESTAMP")
    
    # Usage tracking migrations
    add_column_if_missing(conn, "call_usage", "revenue_usd", "REAL DEFAULT 0.0")
    add_column_if_missing(conn, "call_usage", "profit_usd", "REAL DEFAULT 0.0")
    add_column_if_missing(conn, "monthly_usage", "total_revenue_usd", "REAL DEFAULT 0.0")
    add_column_if_missing(conn, "monthly_usage", "total_profit_usd", "REAL DEFAULT 0.0")

    # AI SMS tables
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS ai_sms_sessions (
        id {ID},
        user_id INTEGER NOT NULL,
        contact_id INTEGER,
        phone_number TEXT NOT NULL,
        from_number TEXT NOT NULL,
        system_prompt TEXT,
        status TEXT DEFAULT 'active',
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS ai_sms_messages (
        id {ID},
        session_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        twilio_sid TEXT,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── SMS Marketing ────────────────────────────────────────────────────────
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS sms_preset_texts (
        id {ID},
        user_id INTEGER NOT NULL,
        preset_type TEXT NOT NULL DEFAULT 'initial',
        message TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        send_vcard INTEGER DEFAULT 0,
        include_optout INTEGER DEFAULT 1,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS sms_drip_sequences (
        id {ID},
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        days_after INTEGER NOT NULL DEFAULT 1,
        send_time TEXT DEFAULT '08:00',
        message TEXT NOT NULL,
        disposition_filter TEXT,
        is_active INTEGER DEFAULT 1,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS sms_keywords (
        id {ID},
        user_id INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        auto_reply TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS sms_preset_replies (
        id {ID},
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        shortcut TEXT,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── Lead Vendors ─────────────────────────────────────────────────────────
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS lead_vendors (
        id {ID},
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        vendor_type TEXT DEFAULT 'personal_leads',
        status TEXT DEFAULT 'unverified',
        webhook_token TEXT,
        email_address TEXT,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── Campaigns ────────────────────────────────────────────────────────────
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS campaigns (
        id {ID},
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        campaign_type TEXT DEFAULT 'sms',
        status TEXT DEFAULT 'draft',
        leads_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        response_count INTEGER DEFAULT 0,
        filter_json TEXT,
        scheduled_at {TIMESTAMP},
        sent_at {TIMESTAMP},
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS email_preset_texts (
        id {ID}, user_id INTEGER NOT NULL,
        preset_type TEXT NOT NULL DEFAULT 'initial',
        subject TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL, is_active INTEGER DEFAULT 1,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS email_drip_sequences (
        id {ID}, user_id INTEGER NOT NULL,
        name TEXT NOT NULL, days_after INTEGER NOT NULL DEFAULT 1,
        send_time TEXT DEFAULT '08:00', subject TEXT DEFAULT '',
        message TEXT NOT NULL, disposition_filter TEXT, is_active INTEGER DEFAULT 1,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS email_preset_replies (
        id {ID}, user_id INTEGER NOT NULL,
        title TEXT NOT NULL, subject TEXT DEFAULT '',
        message TEXT NOT NULL, shortcut TEXT,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # User profile fields
    add_column_if_missing(conn, 'users', 'first_name', 'TEXT')
    add_column_if_missing(conn, 'users', 'last_name', 'TEXT')
    add_column_if_missing(conn, 'users', 'forward_calls_to', 'TEXT')
    add_column_if_missing(conn, 'users', 'default_timezone', "TEXT DEFAULT 'Eastern'")
    add_column_if_missing(conn, 'users', 'agent_website', 'TEXT')
    add_column_if_missing(conn, 'users', 'agent_id_str', 'TEXT')
    add_column_if_missing(conn, 'users', 'stop_texting_at', "TEXT DEFAULT '10 PM'")
    add_column_if_missing(conn, 'users', 'pref_dark_mode', 'INTEGER DEFAULT 1')
    add_column_if_missing(conn, 'users', 'pref_auto_save_notes', 'INTEGER DEFAULT 1')
    add_column_if_missing(conn, 'users', 'pref_keep_recording', 'INTEGER DEFAULT 0')
    add_column_if_missing(conn, 'users', 'alert_new_lead', 'INTEGER DEFAULT 1')
    add_column_if_missing(conn, 'users', 'alert_new_text', 'INTEGER DEFAULT 1')
    add_column_if_missing(conn, 'users', 'alert_missed_call', 'INTEGER DEFAULT 0')

    conn.commit()
    conn.close()

def get_tenant_by_number(phone):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        sql("SELECT id, phone_number FROM tenants WHERE phone_number = {PH}"),
        (phone,)
    )

    row = cur.fetchone()
    conn.close()
    return row


def get_agent_prompt(tenant_id):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        sql("SELECT agent_prompt FROM tenants WHERE id = {PH}"),
        (tenant_id,)
    )

    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


def set_agent_prompt(tenant_id, prompt):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        sql("UPDATE tenants SET agent_prompt = {PH} WHERE id = {PH}"),
        (prompt, tenant_id)
    )

    conn.commit()
    conn.close()

 
def create_tenant_if_missing(phone_number: str):
    conn = get_conn()
    cur = conn.cursor()

    if USE_POSTGRES:
        # PostgreSQL syntax
        cur.execute(
            sql("INSERT INTO tenants (phone_number, agent_prompt) VALUES ({PH}, {PH}) ON CONFLICT (phone_number) DO NOTHING"),
            (phone_number, "")
        )
    else:
        # SQLite syntax
        cur.execute(
            sql("INSERT OR IGNORE INTO tenants (phone_number, agent_prompt) VALUES ({PH}, {PH})"),
            (phone_number, "")
        )

    conn.commit()
    conn.close()


# --- AUTH HELPERS (customer login) ---
import bcrypt

def ensure_user_columns():
    """Add new user columns if they don't exist (safe to call multiple times)."""
    # Define SQL type macros the same way init_db() does
    if USE_POSTGRES:
        ID = "SERIAL PRIMARY KEY"
        TIMESTAMP = "TIMESTAMP"
    else:
        ID = "INTEGER PRIMARY KEY AUTOINCREMENT"
        TIMESTAMP = "TIMESTAMP"

    conn = get_conn()
    add_column_if_missing(conn, 'users', 'account_type', "TEXT DEFAULT 'developer'")
    add_column_if_missing(conn, 'users', 'status', "TEXT DEFAULT 'approved'")
    add_column_if_missing(conn, 'users', 'is_banned', 'BOOLEAN DEFAULT FALSE')
    add_column_if_missing(conn, 'users', 'full_name', 'TEXT')
    add_column_if_missing(conn, 'users', 'company_name', 'TEXT')
    add_column_if_missing(conn, 'users', 'website', 'TEXT')
    add_column_if_missing(conn, 'users', 'use_case', 'TEXT')
    add_column_if_missing(conn, 'users', 'call_volume', 'TEXT')

    # website_agent_orders — ensure all columns exist on existing tables
    add_column_if_missing(conn, 'website_agent_orders', 'phone', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'business_name', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'business_address', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'business_hours', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'current_website', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'business_description', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'services_offered', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'competitive_advantage', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'website_goals', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'customer_actions', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'services_list', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'pricing_info', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'special_offers', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'preferred_colors', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'website_examples', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'has_logo', "TEXT DEFAULT 'no'")
    add_column_if_missing(conn, 'website_agent_orders', 'has_photos', "TEXT DEFAULT 'no'")
    add_column_if_missing(conn, 'website_agent_orders', 'features_needed', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'social_facebook', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'social_instagram', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'social_tiktok', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'social_google', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'additional_notes', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'stripe_session_id', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'logo_data', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'logo_filename', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'photos_data', 'TEXT')
    add_column_if_missing(conn, 'website_agent_orders', 'photos_filenames', 'TEXT')

    # contacts — CRM fields
    add_column_if_missing(conn, 'contacts', 'status', "TEXT DEFAULT 'new_lead'")
    add_column_if_missing(conn, 'contacts', 'disposition', 'TEXT')
    add_column_if_missing(conn, 'contacts', 'source', 'TEXT')
    add_column_if_missing(conn, 'contacts', 'address', 'TEXT')
    add_column_if_missing(conn, 'contacts', 'next_followup', 'TEXT')
    add_column_if_missing(conn, 'contacts', 'last_contacted', 'TEXT')
    add_column_if_missing(conn, 'contacts', 'call_count', 'INTEGER DEFAULT 0')

    # crm_calls — recording + call type fields
    add_column_if_missing(conn, 'crm_calls', 'call_type', "TEXT DEFAULT 'ai'")
    add_column_if_missing(conn, 'crm_calls', 'call_sid', 'TEXT')
    add_column_if_missing(conn, 'crm_calls', 'recording_url', 'TEXT')

    cur = conn.cursor()
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS email_signatures (
        id {ID},
        user_id INTEGER NOT NULL UNIQUE,
        full_name TEXT,
        job_title TEXT,
        company_name TEXT,
        phone TEXT,
        email TEXT,
        website TEXT,
        address TEXT,
        logo_url TEXT,
        profile_image_url TEXT,
        social_linkedin TEXT,
        social_twitter TEXT,
        social_instagram TEXT,
        social_facebook TEXT,
        cta_text TEXT,
        cta_link TEXT,
        tagline TEXT,
        template TEXT DEFAULT 'modern',
        updated_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS user_contact_numbers (
        id {ID},
        user_id INTEGER NOT NULL,
        label TEXT NOT NULL DEFAULT 'Mobile',
        phone_number TEXT NOT NULL,
        phone_type TEXT DEFAULT 'mobile',
        is_primary INTEGER DEFAULT 0,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS user_contact_emails (
        id {ID},
        user_id INTEGER NOT NULL,
        label TEXT NOT NULL DEFAULT 'Work',
        email_address TEXT NOT NULL,
        email_type TEXT DEFAULT 'work',
        is_primary INTEGER DEFAULT 0,
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS email_domains (
        id {ID},
        user_id INTEGER NOT NULL,
        domain TEXT NOT NULL,
        resend_domain_id TEXT,
        status TEXT DEFAULT 'pending',
        dns_records TEXT,
        region TEXT DEFAULT 'us-east-1',
        created_at {TIMESTAMP} DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()

def create_user(
    email: str,
    password: str,
    tenant_phone: str | None = None,
    account_type: str = "developer",
    full_name: str | None = None,
    company_name: str | None = None,
    website: str | None = None,
    use_case: str | None = None,
    call_volume: str | None = None,
):
    ensure_user_columns()
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    # Developers start as 'pending' until approved; customers are auto-approved
    initial_status = "pending" if account_type == "developer" else "approved"

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        sql("""INSERT INTO users
               (email, password_hash, tenant_phone, account_type, status,
                full_name, company_name, website, use_case, call_volume)
               VALUES ({PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH})"""),
        (email.strip().lower(), password_hash, tenant_phone, account_type,
         initial_status, full_name, company_name, website, use_case, call_volume),
    )
    conn.commit()
    conn.close()

def get_user_by_email(email: str):
    ensure_user_columns()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        sql("""SELECT id, email, password_hash, tenant_phone,
                      account_type, status, is_banned
               FROM users WHERE email = {PH}"""),
        (email.strip().lower(),),
    )
    row = cur.fetchone()
    conn.close()
    return row

def verify_user(email: str, password: str):
    row = get_user_by_email(email)
    if not row:
        return None

    if isinstance(row, dict):
        user_id       = row['id']
        user_email    = row['email']
        password_hash = row['password_hash']
        tenant_phone  = row.get('tenant_phone')
        account_type  = row.get('account_type', 'developer')
        status        = row.get('status', 'approved')
        is_banned     = row.get('is_banned', False)
    else:
        user_id, user_email, password_hash, tenant_phone, account_type, status, is_banned = row

    ok = bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    if not ok:
        return None
    return {
        "id": user_id,
        "email": user_email,
        "tenant_phone": tenant_phone,
        "account_type": account_type or "developer",
        "status": status or "approved",
        "is_banned": bool(is_banned),
    }

def create_agent(
    owner_user_id: int,
    name: str,
    phone_number: str = None,
    system_prompt: str = "",
    business_name: str = None,
    voice: str = None,
    voice_provider: str = "openai",  # NEW: default to openai
    elevenlabs_voice_id: str = None,  # NEW: ElevenLabs voice ID
    provider: str = None,
    first_message: str = None,
    tools: dict = None,   # example: {"google_calendar": True, "slack": False}
    twilio_number_sid: str = None,
    model: str = None,         # Realtime model (e.g. gpt-4o-realtime-preview-2025-06-03)
    tts_provider: str = None,  # TTS for GPT-4o pipeline: "openai" or "elevenlabs"
    llm_provider: str = "openai",  # LLM provider: "openai" or "anthropic"
    language: str = "en",  # Agent response language code (e.g. "en", "es")
):
    conn = get_conn()
    cur = conn.cursor()

    tools_json = json.dumps(tools or {})

    cur.execute(
        sql("""
        INSERT INTO agents (
            owner_user_id,
            name,
            business_name,
            phone_number,
            system_prompt,
            voice,
            voice_provider,
            elevenlabs_voice_id,
            provider,
            first_message,
            tools_json,
            twilio_number_sid,
            model,
            tts_provider,
            llm_provider,
            language
        )
        VALUES ({PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH})
        """ + (" RETURNING id" if USE_POSTGRES else "")),
        (
            owner_user_id,
            name,
            business_name,
            phone_number,
            system_prompt,
            voice,
            voice_provider,
            elevenlabs_voice_id,
            provider,
            first_message,
            tools_json,
            twilio_number_sid,
            model,
            tts_provider,
            llm_provider,
            language,
        )
    )

    if USE_POSTGRES:
        row = cur.fetchone()
        agent_id = row['id'] if isinstance(row, dict) else row[0]
    else:
        agent_id = cur.lastrowid
    
    conn.commit()
    conn.close()
    return agent_id

def list_agents(owner_user_id: int):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        sql("""
        SELECT
            id,
            name,
            business_name,
            phone_number,
            system_prompt,
            voice,
            voice_provider,
            elevenlabs_voice_id,
            provider,
            first_message,
            tools_json,
            model,
            tts_provider,
            llm_provider,
            language,
            created_at,
            updated_at
        FROM agents
        WHERE owner_user_id = {PH} AND deleted_at IS NULL
        ORDER BY id DESC
        """),
        (owner_user_id,)
    )

    rows = cur.fetchall()
    conn.close()

    agents = []
    for r in rows:
        # Handle both SQLite (tuple/list) and PostgreSQL (dict) formats
        if isinstance(r, dict):
            tools_raw = r.get('tools_json') or "{}"
            agent_dict = {
                "id": r['id'],
                "name": r['name'],
                "business_name": r.get('business_name'),
                "phone_number": r.get('phone_number'),
                "system_prompt": r.get('system_prompt'),
                "voice": r.get('voice'),
                "provider": r.get('provider'),
                "first_message": r.get('first_message'),
                "created_at": str(r.get('created_at')) if r.get('created_at') else None,
                "updated_at": str(r.get('updated_at')) if r.get('updated_at') else None,
            }
        else:
            # SQLite tuple format
            tools_raw = r[8] or "{}"
            agent_dict = {
                "id": r[0],
                "name": r[1],
                "business_name": r[2],
                "phone_number": r[3],
                "system_prompt": r[4],
                "voice": r[5],
                "provider": r[6],
                "first_message": r[7],
                "created_at": r[9],
                "updated_at": r[10],
            }
        
        try:
            tools = json.loads(tools_raw)
        except Exception:
            tools = {}

        agent_dict["tools"] = tools
        agents.append(agent_dict)

    return agents

def get_agent(owner_user_id: int, agent_id: int):
    conn = get_conn()  # Uses row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        sql("""
        SELECT
            id, owner_user_id, name, business_name, phone_number,
            system_prompt, voice, voice_provider, elevenlabs_voice_id,
            provider, first_message, tools_json, model, tts_provider,
            llm_provider, language,
            vad_silence_duration_ms,
            created_at, updated_at
        FROM agents
        WHERE id = {PH} AND owner_user_id = {PH} AND deleted_at IS NULL
        """),
        (agent_id, owner_user_id)
    )

    row = cur.fetchone()
    conn.close()

    if not row:
        return None

    # Convert Row to dict
    agent_dict = dict(row)
    
    # Convert datetime objects to strings for PostgreSQL
    if agent_dict.get("created_at") and not isinstance(agent_dict["created_at"], str):
        agent_dict["created_at"] = str(agent_dict["created_at"])
    if agent_dict.get("updated_at") and not isinstance(agent_dict["updated_at"], str):
        agent_dict["updated_at"] = str(agent_dict["updated_at"])
    
    # Parse tools_json if present
    tools_raw = agent_dict.get("tools_json") or "{}"
    try:
        agent_dict["tools"] = json.loads(tools_raw)
    except Exception:
        agent_dict["tools"] = {}

    return agent_dict

def update_agent(owner_user_id: int, agent_id: int, **fields):
    # Allowed fields that can be updated from the UI
    allowed = {
        "name",
        "business_name",
        "phone_number",
        "system_prompt",
        "voice",
        "voice_provider",  # NEW: openai or elevenlabs
        "elevenlabs_voice_id",  # NEW: ElevenLabs voice ID
        "provider",
        "first_message",
        "tools_json",   # store JSON string
        "model",        # Realtime model selection
        "tts_provider", # TTS provider for GPT-4o pipeline
        "llm_provider", # LLM provider: "openai" or "anthropic"
        "language",     # Agent response language code
    }

    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}

    # If UI passes tools as dict, convert to tools_json string
    if "tools" in fields and fields["tools"] is not None:
        updates["tools_json"] = json.dumps(fields["tools"])

    if not updates:
        return False  # nothing to update

    set_clause = ", ".join([f"{k} = {{PH}}" for k in updates.keys()])
    params = list(updates.values())
    params += [agent_id, owner_user_id]

    conn = get_conn()
    cur = conn.cursor()

    query = f"""
        UPDATE agents
        SET {set_clause},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = {{PH}} AND owner_user_id = {{PH}} AND deleted_at IS NULL
    """
    
    cur.execute(sql(query), params)

    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    return changed

def delete_agent(owner_user_id: int, agent_id: int):
    """
    Soft delete an agent (marks as deleted but keeps for historical call data).
    Only the owner can delete their own agents.
    """
    conn = get_conn()
    cur = conn.cursor()
    
    # Soft delete - set deleted_at timestamp instead of actual deletion
    cur.execute(
        sql("UPDATE agents SET deleted_at = CURRENT_TIMESTAMP WHERE id = {PH} AND owner_user_id = {PH} AND deleted_at IS NULL"),
        (agent_id, owner_user_id)
    )
    
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


# ========== Usage Tracking Functions ==========

def start_call_tracking(user_id: int, agent_id: int, call_sid: str, call_from: str, call_to: str):
    """Start tracking a new call"""
    conn = get_conn()
    cur = conn.cursor()
    
    if USE_POSTGRES:
        # PostgreSQL - use RETURNING to get the ID
        cur.execute(sql("""
            INSERT INTO call_usage (user_id, agent_id, call_sid, call_from, call_to, status)
            VALUES ({PH}, {PH}, {PH}, {PH}, {PH}, 'active')
            RETURNING id
        """), (user_id, agent_id, call_sid, call_from, call_to))
        row = cur.fetchone()
        call_id = row['id'] if isinstance(row, dict) else row[0]
    else:
        # SQLite - use lastrowid
        cur.execute(sql("""
            INSERT INTO call_usage (user_id, agent_id, call_sid, call_from, call_to, status)
            VALUES ({PH}, {PH}, {PH}, {PH}, {PH}, 'active')
        """), (user_id, agent_id, call_sid, call_from, call_to))
        call_id = cur.lastrowid
    
    conn.commit()
    conn.close()
    
    return call_id


def end_call_tracking(call_sid: str, duration_seconds: int, cost_usd: float, revenue_usd: float, 
                     usage_details: dict = None):
    """
    End call tracking and calculate cost, revenue, and profit
    
    usage_details can include:
    {
        "input_tokens": 1000,
        "output_tokens": 2000,
        "input_audio_seconds": 120,
        "output_audio_seconds": 130
    }
    """
    conn = get_conn()
    cur = conn.cursor()
    
    profit_usd = revenue_usd - cost_usd
    
    # Default empty usage details if not provided
    if not usage_details:
        usage_details = {}
    
    # Extract usage metrics
    input_tokens = usage_details.get('input_tokens', 0)
    output_tokens = usage_details.get('output_tokens', 0)
    input_audio_seconds = usage_details.get('input_audio_seconds', 0)
    output_audio_seconds = usage_details.get('output_audio_seconds', 0)
    
    # Convert seconds to minutes for audio
    input_audio_minutes = input_audio_seconds / 60.0
    output_audio_minutes = output_audio_seconds / 60.0
    
    # OpenAI Realtime API Pricing (as of Feb 2025)
    # Text: $5/1M input tokens, $20/1M output tokens
    # Audio: $100/1M input tokens (~$0.06/min), $200/1M output tokens (~$0.24/min)
    # Approximations: 1 min audio ≈ 1,500 tokens
    
    # Calculate YOUR costs (what you pay OpenAI + Twilio)
    cost_input_tokens = (input_tokens / 1_000_000) * 5.0  # $5 per 1M tokens
    cost_output_tokens = (output_tokens / 1_000_000) * 20.0  # $20 per 1M tokens
    cost_input_audio = input_audio_minutes * 0.06  # ~$0.06/min
    cost_output_audio = output_audio_minutes * 0.24  # ~$0.24/min
    cost_twilio_phone = (duration_seconds / 60.0) * 0.0085  # $0.0085/min
    
    # Calculate total cost
    total_component_cost = (cost_input_tokens + cost_output_tokens + 
                           cost_input_audio + cost_output_audio + cost_twilio_phone)
    
    # Use provided cost_usd or calculated cost
    final_cost_usd = cost_usd if cost_usd > 0 else total_component_cost
    
    # Calculate CUSTOMER revenue (what you charge them) - 2x markup
    revenue_input_tokens = cost_input_tokens * 2
    revenue_output_tokens = cost_output_tokens * 2
    revenue_input_audio = cost_input_audio * 2
    revenue_output_audio = cost_output_audio * 2
    revenue_twilio_phone = cost_twilio_phone * 2
    
    # Calculate total revenue
    total_component_revenue = (revenue_input_tokens + revenue_output_tokens + 
                               revenue_input_audio + revenue_output_audio + revenue_twilio_phone)
    
    # Use provided revenue or calculated revenue
    final_revenue_usd = revenue_usd if revenue_usd > 0 else total_component_revenue
    
    # Update call record with detailed breakdown
    cur.execute(sql("""
        UPDATE call_usage 
        SET duration_seconds = {PH},
            cost_usd = {PH},
            revenue_usd = {PH},
            profit_usd = {PH},
            ended_at = CURRENT_TIMESTAMP,
            status = 'completed',
            
            input_tokens = {PH},
            output_tokens = {PH},
            input_audio_minutes = {PH},
            output_audio_minutes = {PH},
            
            cost_input_tokens = {PH},
            cost_output_tokens = {PH},
            cost_input_audio = {PH},
            cost_output_audio = {PH},
            cost_twilio_phone = {PH},
            
            revenue_input_tokens = {PH},
            revenue_output_tokens = {PH},
            revenue_input_audio = {PH},
            revenue_output_audio = {PH},
            revenue_twilio_phone = {PH}
        WHERE call_sid = {PH}
    """), (duration_seconds, final_cost_usd, final_revenue_usd, profit_usd,
           input_tokens, output_tokens, input_audio_minutes, output_audio_minutes,
           cost_input_tokens, cost_output_tokens, cost_input_audio, cost_output_audio, cost_twilio_phone,
           revenue_input_tokens, revenue_output_tokens, revenue_input_audio, revenue_output_audio, revenue_twilio_phone,
           call_sid))
    
    # Get user_id for monthly summary
    cur.execute(sql("SELECT user_id FROM call_usage WHERE call_sid = {PH}"), (call_sid,))
    row = cur.fetchone()
    
    if row:
        # Handle both dict (PostgreSQL) and tuple (SQLite)
        user_id = row['user_id'] if isinstance(row, dict) else row[0]
        month = datetime.now().strftime("%Y-%m")
        minutes = duration_seconds / 60.0
        
        # Update monthly summary
        if USE_POSTGRES:
            # PostgreSQL - use EXCLUDED prefix to avoid ambiguity
            cur.execute(sql("""
                INSERT INTO monthly_usage (user_id, month, total_calls, total_minutes, total_cost_usd, total_revenue_usd, total_profit_usd)
                VALUES ({PH}, {PH}, 1, {PH}, {PH}, {PH}, {PH})
                ON CONFLICT(user_id, month) DO UPDATE SET
                    total_calls = monthly_usage.total_calls + 1,
                    total_minutes = monthly_usage.total_minutes + {PH},
                    total_cost_usd = monthly_usage.total_cost_usd + {PH},
                    total_revenue_usd = monthly_usage.total_revenue_usd + {PH},
                    total_profit_usd = monthly_usage.total_profit_usd + {PH}
            """), (user_id, month, minutes, cost_usd, revenue_usd, profit_usd, minutes, cost_usd, revenue_usd, profit_usd))
        else:
            # SQLite - use INSERT OR REPLACE
            cur.execute(sql("""
                INSERT INTO monthly_usage (user_id, month, total_calls, total_minutes, total_cost_usd, total_revenue_usd, total_profit_usd)
                VALUES ({PH}, {PH}, 1, {PH}, {PH}, {PH}, {PH})
                ON CONFLICT(user_id, month) DO UPDATE SET
                    total_calls = total_calls + 1,
                    total_minutes = total_minutes + {PH},
                    total_cost_usd = total_cost_usd + {PH},
                    total_revenue_usd = total_revenue_usd + {PH},
                    total_profit_usd = total_profit_usd + {PH}
            """), (user_id, month, minutes, cost_usd, revenue_usd, profit_usd, minutes, cost_usd, revenue_usd, profit_usd))
    
    conn.commit()
    conn.close()


def get_user_usage(user_id: int, month: str = None):
    """Get usage statistics for a user"""
    conn = get_conn()
    cur = conn.cursor()
    
    if not month:
        month = datetime.now().strftime("%Y-%m")
    
    # Get monthly summary
    cur.execute(sql("""
        SELECT total_calls, total_minutes, total_cost_usd, total_revenue_usd, total_profit_usd
        FROM monthly_usage
        WHERE user_id = {PH} AND month = {PH}
    """), (user_id, month))
    
    row = cur.fetchone()
    
    if row:
        # Handle both dict (PostgreSQL) and tuple (SQLite)
        if isinstance(row, dict):
            result = {
                "month": month,
                "total_calls": row['total_calls'],
                "total_minutes": round(float(row['total_minutes']), 2),
                "total_cost_usd": round(float(row['total_cost_usd']), 4),
                "total_revenue_usd": round(float(row['total_revenue_usd']), 2),
                "total_profit_usd": round(float(row['total_profit_usd']), 2)
            }
        else:
            result = {
                "month": month,
                "total_calls": row[0],
                "total_minutes": round(row[1], 2),
                "total_cost_usd": round(row[2], 4),
                "total_revenue_usd": round(row[3], 2),
                "total_profit_usd": round(row[4], 2)
            }
    else:
        result = {
            "month": month,
            "total_calls": 0,
            "total_minutes": 0.0,
            "total_cost_usd": 0.0,
            "total_revenue_usd": 0.0,
            "total_profit_usd": 0.0
        }
    
    conn.close()
    return result


def get_call_history(user_id: int, limit: int = 50):
    """Get recent call history for a user"""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        SELECT c.*, a.name as agent_name
        FROM call_usage c
        LEFT JOIN agents a ON c.agent_id = a.id
        WHERE c.user_id = {PH}
        ORDER BY c.started_at DESC
        LIMIT {PH}
    """), (user_id, limit))
    
    calls = []
    for row in cur.fetchall():
        call_dict = dict(row)
        
        # Convert datetime objects to strings for PostgreSQL
        if call_dict.get("started_at") and not isinstance(call_dict["started_at"], str):
            call_dict["started_at"] = str(call_dict["started_at"])
        if call_dict.get("ended_at") and not isinstance(call_dict["ended_at"], str):
            call_dict["ended_at"] = str(call_dict["ended_at"])
            
        calls.append(call_dict)
    
    conn.close()
    
    return calls


def calculate_call_cost(duration_seconds: int, cost_per_minute: float = 0.05) -> float:
    """Calculate YOUR cost based on duration"""
    minutes = duration_seconds / 60.0
    return round(minutes * cost_per_minute, 4)


def calculate_call_revenue(duration_seconds: int, revenue_per_minute: float = 0.10) -> float:
    """Calculate revenue to charge customer (2x your cost)"""
    minutes = duration_seconds / 60.0
    return round(minutes * revenue_per_minute, 4)


def calculate_call_profit(cost_usd: float, revenue_usd: float) -> float:
    """Calculate profit (revenue - cost)"""
    return round(revenue_usd - cost_usd, 4)


# ========== Credits System ==========

def get_user_credits(user_id: int):
    """Get user's current credit balance"""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        SELECT balance, total_purchased, total_used
        FROM user_credits
        WHERE user_id = {PH}
    """), (user_id,))
    
    row = cur.fetchone()
    
    if row:
        # Handle both SQLite (tuple) and PostgreSQL (dict)
        if isinstance(row, dict):
            result = {
                "balance": round(float(row['balance']), 2),
                "total_purchased": round(float(row['total_purchased']), 2),
                "total_used": round(float(row['total_used']), 2)
            }
        else:
            result = {
                "balance": round(row[0], 2),
                "total_purchased": round(row[1], 2),
                "total_used": round(row[2], 2)
            }
        conn.close()
        return result
    
    # User doesn't have credits record yet - create one
    try:
        cur.execute(sql("""
            INSERT INTO user_credits (user_id, balance, total_purchased, total_used)
            VALUES ({PH}, 0.0, 0.0, 0.0)
        """), (user_id,))
        conn.commit()
    except sqlite3.IntegrityError:
        # Race condition - record was created by another thread
        # Just fetch it again
        cur.execute(sql("""
            SELECT balance, total_purchased, total_used
            FROM user_credits
            WHERE user_id = {PH}
        """), (user_id,))
        row = cur.fetchone()
        if row:
            if isinstance(row, dict):
                result = {
                    "balance": round(float(row['balance']), 2),
                    "total_purchased": round(float(row['total_purchased']), 2),
                    "total_used": round(float(row['total_used']), 2)
                }
            else:
                result = {
                    "balance": round(row[0], 2),
                    "total_purchased": round(row[1], 2),
                    "total_used": round(row[2], 2)
                }
            conn.close()
            return result
    
    conn.close()
    return {
        "balance": 0.0,
        "total_purchased": 0.0,
        "total_used": 0.0
    }


def add_credits(user_id: int, amount: float, description: str = "Credit purchase", transaction_id: str = None):
    """Add credits to user's account (when they buy credits)"""
    conn = get_conn()
    cur = conn.cursor()
    
    # Get or create user credits
    get_user_credits(user_id)
    
    # Update balance
    cur.execute(sql("""
        UPDATE user_credits
        SET balance = balance + {PH},
            total_purchased = total_purchased + {PH},
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = {PH}
    """), (amount, amount, user_id))
    
    # Get new balance
    cur.execute(sql("SELECT balance FROM user_credits WHERE user_id = {PH}"), (user_id,))
    row = cur.fetchone()
    
    # Handle both dict and tuple
    if isinstance(row, dict):
        new_balance = float(row['balance'])
    else:
        new_balance = row[0]
    
    # Record transaction
    cur.execute(sql("""
        INSERT INTO credit_transactions (user_id, amount, type, description, balance_after)
        VALUES ({PH}, {PH}, 'purchase', {PH}, {PH})
    """), (user_id, amount, description, new_balance))
    
    conn.commit()
    conn.close()
    
    # Send invoice email
    try:
        from invoice_email import send_invoice_email
        
        # Get user email
        conn2 = get_conn()
        cur2 = conn2.cursor()
        cur2.execute(sql("SELECT email FROM users WHERE id = {PH}"), (user_id,))
        user_row = cur2.fetchone()
        conn2.close()
        
        if user_row:
            user_email = user_row[0] if isinstance(user_row, tuple) else user_row.get('email')
            
            # Check if this is an auto-recharge
            is_auto_recharge = "auto-recharge" in description.lower()
            
            print(f"📧 Sending invoice email to {user_email} for ${amount:.2f}")
            
            result = send_invoice_email(
                email=user_email,
                amount=amount,
                transaction_type="auto_recharge" if is_auto_recharge else "purchase",
                payment_method="Credit Card",
                transaction_id=transaction_id,
                is_auto_recharge=is_auto_recharge
            )
            
            if result.get("success"):
                print(f"✅ Invoice email sent successfully to {user_email}")
            else:
                print(f"❌ Invoice email failed: {result.get('error')}")
        else:
            print(f"⚠️ No user found with ID {user_id}")
    except Exception as e:
        print(f"⚠️ Failed to send invoice email: {e}")
        import traceback
        traceback.print_exc()
    
    return new_balance


def deduct_credits(user_id: int, amount: float, call_id: int = None, description: str = "Call usage"):
    """Deduct credits from user's account (when they use the service)"""
    print(f"📝 deduct_credits called: user_id={user_id}, amount={amount}, description={description}")
    
    conn = get_conn()
    cur = conn.cursor()
    
    # Check balance
    cur.execute(sql("SELECT balance FROM user_credits WHERE user_id = {PH}"), (user_id,))
    row = cur.fetchone()
    
    if not row:
        print(f"❌ No credit account found for user {user_id}")
        conn.close()
        return {"success": False, "error": "No credit account found"}
    
    # Handle both dict (PostgreSQL) and tuple (SQLite)
    current_balance = float(row['balance']) if isinstance(row, dict) else row[0]
    print(f"💰 Current balance: ${current_balance:.2f}")
    
    if current_balance < amount:
        print(f"❌ Insufficient credits: has ${current_balance:.2f}, needs ${amount:.2f}")
        conn.close()
        return {"success": False, "error": "Insufficient credits", "balance": current_balance}
    
    # Deduct credits
    new_balance = current_balance - amount
    print(f"💳 Deducting ${amount:.2f}, new balance will be ${new_balance:.2f}")
    
    cur.execute(sql("""
        UPDATE user_credits
        SET balance = {PH},
            total_used = total_used + {PH},
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = {PH}
    """), (new_balance, amount, user_id))
    
    print(f"✅ Updated user_credits table, rows affected: {cur.rowcount}")
    
    # Record transaction
    cur.execute(sql("""
        INSERT INTO credit_transactions (user_id, amount, type, description, balance_after, call_id)
        VALUES ({PH}, {PH}, 'usage', {PH}, {PH}, {PH})
    """), (user_id, -amount, description, new_balance, call_id))
    
    print(f"✅ Inserted transaction record, rows affected: {cur.rowcount}")
    
    conn.commit()
    print(f"✅ Transaction committed to database")
    conn.close()
    
    # Check if auto-recharge should trigger
    if new_balance < 2.00:
        print(f"⚠️ Low balance detected: ${new_balance:.2f} - checking auto-recharge")
        try:
            from auto_recharge import check_and_auto_recharge
            recharge_result = check_and_auto_recharge(user_id, new_balance)
            
            if recharge_result.get("success"):
                print(f"💳 Auto-recharge successful: Added ${recharge_result.get('amount_added'):.2f}")
                new_balance = recharge_result.get("new_balance")
            elif recharge_result.get("triggered"):
                print(f"❌ Auto-recharge failed: {recharge_result.get('error')}")
        except Exception as e:
            print(f"⚠️ Auto-recharge check failed: {e}")
    
    return {"success": True, "balance": new_balance, "deducted": amount}


def get_credit_transactions(user_id: int, limit: int = 50):
    """Get credit transaction history"""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        SELECT *
        FROM credit_transactions
        WHERE user_id = {PH}
        ORDER BY created_at DESC
        LIMIT {PH}
    """), (user_id, limit))
    
    transactions = []
    for row in cur.fetchall():
        tx_dict = dict(row)
        
        # Convert datetime objects to strings for PostgreSQL
        if tx_dict.get("created_at") and not isinstance(tx_dict["created_at"], str):
            tx_dict["created_at"] = str(tx_dict["created_at"])
            
        transactions.append(tx_dict)
    
    conn.close()
    
    return transactions


def check_credits_available(user_id: int, required_amount: float) -> bool:
    """Check if user has enough credits"""
    credits = get_user_credits(user_id)
    return credits["balance"] >= required_amount


# ========== User-Level Google Calendar Functions ==========

def get_user_google_credentials(user_id: int):
    """Get user's Google Calendar credentials (before assigning to agent)"""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        SELECT google_calendar_credentials, google_calendar_id
        FROM user_google_credentials
        WHERE user_id = {PH}
    """), (user_id,))
    
    row = cur.fetchone()
    conn.close()
    
    if row and row[0]:
        return {
            "credentials": row[0],
            "calendar_id": row[1] or "primary"
        }
    return None


def save_user_google_credentials(user_id: int, credentials_json: str, calendar_id: str = "primary"):
    """Save Google credentials at user level (during OAuth flow)"""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        INSERT INTO user_google_credentials (user_id, google_calendar_credentials, google_calendar_id)
        VALUES ({PH}, {PH}, {PH})
        ON CONFLICT(user_id) DO UPDATE SET
            google_calendar_credentials = {PH},
            google_calendar_id = {PH},
            updated_at = CURRENT_TIMESTAMP
    """), (user_id, credentials_json, calendar_id, credentials_json, calendar_id))
    
    conn.commit()
    conn.close()


def assign_google_calendar_to_agent(user_id: int, agent_id: int):
    """Copy user's Google credentials to a specific agent"""
    # Get user credentials
    user_creds = get_user_google_credentials(user_id)
    
    if not user_creds:
        return False
    
    # Assign to agent
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        UPDATE agents
        SET google_calendar_credentials = {PH},
            google_calendar_id = {PH}
        WHERE id = {PH} AND owner_user_id = {PH} AND deleted_at IS NULL
    """), (user_creds["credentials"], user_creds["calendar_id"], agent_id, user_id))
    
    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    
    return changed

def get_agent_by_id(agent_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT * FROM agents WHERE id = {PH} AND deleted_at IS NULL"), (agent_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def get_agent_by_phone(phone_number: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT * FROM agents WHERE phone_number = {PH} AND deleted_at IS NULL LIMIT 1"), (phone_number,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


# ── Website Agent Orders ───────────────────────────────────────────────────────

def create_website_order(
    full_name: str,
    email: str,
    phone: str | None = None,
    business_name: str | None = None,
    business_address: str | None = None,
    business_hours: str | None = None,
    current_website: str | None = None,
    business_description: str | None = None,
    services_offered: str | None = None,
    competitive_advantage: str | None = None,
    website_goals: str | None = None,
    customer_actions: str | None = None,
    services_list: str | None = None,
    pricing_info: str | None = None,
    special_offers: str | None = None,
    preferred_colors: str | None = None,
    website_examples: str | None = None,
    has_logo: str = 'no',
    has_photos: str = 'no',
    features_needed: str | None = None,
    social_facebook: str | None = None,
    social_instagram: str | None = None,
    social_tiktok: str | None = None,
    social_google: str | None = None,
    additional_notes: str | None = None,
    stripe_session_id: str | None = None,
    logo_data: str | None = None,
    logo_filename: str | None = None,
    photos_data: str | None = None,
    photos_filenames: str | None = None,
) -> int:
    """Insert a new website order and return its ID."""
    ensure_user_columns()   # run migrations so new columns exist before insert
    conn = get_conn()
    cur = conn.cursor()
    cols = ("full_name,email,phone,business_name,business_address,business_hours,"
            "current_website,business_description,services_offered,competitive_advantage,"
            "website_goals,customer_actions,services_list,pricing_info,special_offers,"
            "preferred_colors,website_examples,has_logo,has_photos,features_needed,"
            "social_facebook,social_instagram,social_tiktok,social_google,"
            "additional_notes,stripe_session_id,logo_data,logo_filename,photos_data,photos_filenames")
    vals = (full_name, email, phone, business_name, business_address, business_hours,
            current_website, business_description, services_offered, competitive_advantage,
            website_goals, customer_actions, services_list, pricing_info, special_offers,
            preferred_colors, website_examples, has_logo, has_photos, features_needed,
            social_facebook, social_instagram, social_tiktok, social_google,
            additional_notes, stripe_session_id, logo_data, logo_filename, photos_data, photos_filenames)
    placeholders = ",".join(["{PH}"] * len(vals))
    if USE_POSTGRES:
        cur.execute(sql(f"INSERT INTO website_agent_orders ({cols}) VALUES ({placeholders}) RETURNING id"), vals)
        row = cur.fetchone()
        order_id = row["id"] if isinstance(row, dict) else row[0]
    else:
        cur.execute(sql(f"INSERT INTO website_agent_orders ({cols}) VALUES ({placeholders})"), vals)
        order_id = cur.lastrowid
    conn.commit()
    conn.close()
    return order_id


def get_all_website_orders(limit: int = 100) -> list:
    """Return all website orders, newest first."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        SELECT id, full_name, email, phone, business_name, business_address, business_hours,
               current_website, business_description, services_offered, competitive_advantage,
               website_goals, customer_actions, services_list, pricing_info, special_offers,
               preferred_colors, website_examples, has_logo, has_photos, features_needed,
               social_facebook, social_instagram, social_tiktok, social_google,
               additional_notes, payment_status, stripe_session_id, created_at,
               logo_data, logo_filename, photos_data, photos_filenames
        FROM website_agent_orders
        ORDER BY created_at DESC
        LIMIT {PH}
    """), (limit,))
    rows = cur.fetchall()
    conn.close()
    keys = ['id','full_name','email','phone','business_name','business_address','business_hours',
            'current_website','business_description','services_offered','competitive_advantage',
            'website_goals','customer_actions','services_list','pricing_info','special_offers',
            'preferred_colors','website_examples','has_logo','has_photos','features_needed',
            'social_facebook','social_instagram','social_tiktok','social_google',
            'additional_notes','payment_status','stripe_session_id','created_at',
            'logo_data','logo_filename','photos_data','photos_filenames']
    result = []
    for row in rows:
        if isinstance(row, dict):
            d = dict(row)
            d['created_at'] = d['created_at'].isoformat() if d.get('created_at') else None
        else:
            d = dict(zip(keys, row))
            if d.get('created_at') and hasattr(d['created_at'], 'isoformat'):
                d['created_at'] = d['created_at'].isoformat()
        result.append(d)
    return result


def update_website_order_payment(order_id: int, stripe_session_id: str, status: str = 'paid'):
    """Update payment status after Stripe webhook or redirect."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        sql("UPDATE website_agent_orders SET payment_status={PH}, stripe_session_id={PH} WHERE id={PH}"),
        (status, stripe_session_id, order_id),
    )
    conn.commit()
    conn.close()
