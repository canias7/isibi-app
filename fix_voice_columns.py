#!/usr/bin/env python3
"""
Voice Column Fix Script
Run this to ensure voice columns exist and fix agent 68's voice settings
"""

import os
import psycopg2
from urllib.parse import urlparse

def get_db_connection():
    """Get database connection from DATABASE_URL"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise Exception("DATABASE_URL not set!")
    
    # Parse the URL
    url = urlparse(database_url)
    
    conn = psycopg2.connect(
        database=url.path[1:],
        user=url.username,
        password=url.password,
        host=url.hostname,
        port=url.port
    )
    return conn

def check_columns():
    """Check if voice columns exist"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    print("🔍 Checking voice columns...")
    
    cur.execute("""
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'agents' 
        AND column_name IN ('voice_provider', 'elevenlabs_voice_id', 'voice')
        ORDER BY column_name
    """)
    
    columns = cur.fetchall()
    
    print(f"\n✅ Found {len(columns)} columns:")
    for col in columns:
        print(f"   - {col[0]}: {col[1]} (default: {col[2]})")
    
    conn.close()
    return len(columns) == 3

def add_missing_columns():
    """Add missing voice columns"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    print("\n🔧 Adding missing columns...")
    
    # Add voice_provider
    try:
        cur.execute("""
            ALTER TABLE agents 
            ADD COLUMN IF NOT EXISTS voice_provider VARCHAR(20) DEFAULT 'openai'
        """)
        print("   ✅ voice_provider column added/verified")
    except Exception as e:
        print(f"   ⚠️  voice_provider: {e}")
    
    # Add elevenlabs_voice_id
    try:
        cur.execute("""
            ALTER TABLE agents 
            ADD COLUMN IF NOT EXISTS elevenlabs_voice_id VARCHAR(255)
        """)
        print("   ✅ elevenlabs_voice_id column added/verified")
    except Exception as e:
        print(f"   ⚠️  elevenlabs_voice_id: {e}")
    
    conn.commit()
    conn.close()

def check_agent_68():
    """Check current voice settings for agent 68"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    print("\n🔍 Checking Agent 68 voice settings...")
    
    cur.execute("""
        SELECT id, name, voice_provider, elevenlabs_voice_id, voice
        FROM agents
        WHERE id = 68
    """)
    
    agent = cur.fetchone()
    
    if agent:
        print(f"   ID: {agent[0]}")
        print(f"   Name: {agent[1]}")
        print(f"   voice_provider: {agent[2]}")
        print(f"   elevenlabs_voice_id: {agent[3]}")
        print(f"   voice (OpenAI): {agent[4]}")
    else:
        print("   ❌ Agent 68 not found!")
    
    conn.close()
    return agent

def fix_agent_68_to_rachel():
    """Set agent 68 to use Rachel (ElevenLabs)"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    print("\n🔧 Setting Agent 68 to Rachel (ElevenLabs)...")
    
    cur.execute("""
        UPDATE agents
        SET voice_provider = 'elevenlabs',
            elevenlabs_voice_id = '21m00Tcm4TlvDq8ikWAM',
            voice = NULL
        WHERE id = 68
    """)
    
    rows = cur.rowcount
    conn.commit()
    
    print(f"   ✅ Updated {rows} row(s)")
    
    # Verify
    cur.execute("""
        SELECT voice_provider, elevenlabs_voice_id, voice
        FROM agents
        WHERE id = 68
    """)
    
    updated = cur.fetchone()
    print(f"\n   Verification:")
    print(f"   voice_provider: {updated[0]}")
    print(f"   elevenlabs_voice_id: {updated[1]}")
    print(f"   voice: {updated[2]}")
    
    conn.close()

def main():
    print("="*60)
    print("🎤 Voice Column Fix Script")
    print("="*60)
    
    # Check if columns exist
    if not check_columns():
        print("\n⚠️  Some columns are missing!")
        add_missing_columns()
        print("\n✅ Columns added!")
        check_columns()
    
    # Check agent 68
    agent = check_agent_68()
    
    # Fix if needed
    if agent:
        if agent[2] != 'elevenlabs' or agent[3] != '21m00Tcm4TlvDq8ikWAM':
            print("\n⚠️  Agent 68 is not set to Rachel!")
            fix_agent_68_to_rachel()
            print("\n✅ Agent 68 fixed!")
        else:
            print("\n✅ Agent 68 is already set to Rachel!")
    
    print("\n" + "="*60)
    print("✅ Done! Call agent 68 to test.")
    print("="*60)

if __name__ == "__main__":
    main()
