# Developer API Endpoints
# Add these to your portal.py file

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import secrets
import hashlib
from datetime import datetime
from auth import verify_token
from db import get_conn, sql

# ========== Models ==========

class CreateAPIKeyRequest(BaseModel):
    name: str
    description: Optional[str] = None

class APIKeyResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    key_prefix: str  # Only show first 8 chars
    created_at: str
    last_used: Optional[str]
    is_active: bool

class WebhookRequest(BaseModel):
    url: str
    events: List[str]  # ["call.started", "call.ended", "call.failed"]
    is_active: bool = True

# ========== API Key Endpoints ==========

@router.post("/api/developer/keys")
def create_api_key(payload: CreateAPIKeyRequest, user=Depends(verify_token)):
    """Generate a new API key for the user"""
    user_id = user["id"]
    
    # Generate a secure random API key
    api_key = f"sk_live_{secrets.token_urlsafe(32)}"
    
    # Hash the key for storage (never store plain text!)
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    # Store in database
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        INSERT INTO api_keys 
        (user_id, name, description, key_hash, key_prefix, created_at, is_active)
        VALUES ({PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH})
        RETURNING id
    """), (
        user_id,
        payload.name,
        payload.description,
        key_hash,
        api_key[:12],  # Store prefix for display
        datetime.now().isoformat(),
        True
    ))
    
    key_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "API key created successfully",
        "api_key": api_key,  # Only returned ONCE - user must save it!
        "key_id": key_id,
        "warning": "Save this key now - you won't be able to see it again!"
    }


@router.get("/api/developer/keys")
def list_api_keys(user=Depends(verify_token)):
    """List all API keys for the user (without revealing the actual keys)"""
    user_id = user["id"]
    
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        SELECT id, name, description, key_prefix, created_at, last_used, is_active
        FROM api_keys
        WHERE user_id = {PH}
        ORDER BY created_at DESC
    """), (user_id,))
    
    keys = cur.fetchall()
    conn.close()
    
    return {
        "success": True,
        "keys": [
            {
                "id": k[0] if isinstance(k, tuple) else k["id"],
                "name": k[1] if isinstance(k, tuple) else k["name"],
                "description": k[2] if isinstance(k, tuple) else k["description"],
                "key_prefix": k[3] if isinstance(k, tuple) else k["key_prefix"],
                "created_at": k[4] if isinstance(k, tuple) else k["created_at"],
                "last_used": k[5] if isinstance(k, tuple) else k["last_used"],
                "is_active": k[6] if isinstance(k, tuple) else k["is_active"]
            }
            for k in keys
        ]
    }


@router.delete("/api/developer/keys/{key_id}")
def delete_api_key(key_id: int, user=Depends(verify_token)):
    """Delete an API key"""
    user_id = user["id"]
    
    conn = get_conn()
    cur = conn.cursor()
    
    # Verify ownership
    cur.execute(sql("""
        DELETE FROM api_keys
        WHERE id = {PH} AND user_id = {PH}
    """), (key_id, user_id))
    
    if cur.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="API key not found")
    
    conn.commit()
    conn.close()
    
    return {"success": True, "message": "API key deleted"}


@router.put("/api/developer/keys/{key_id}/toggle")
def toggle_api_key(key_id: int, user=Depends(verify_token)):
    """Enable or disable an API key"""
    user_id = user["id"]
    
    conn = get_conn()
    cur = conn.cursor()
    
    # Get current status
    cur.execute(sql("""
        SELECT is_active FROM api_keys
        WHERE id = {PH} AND user_id = {PH}
    """), (key_id, user_id))
    
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="API key not found")
    
    current_status = row[0] if isinstance(row, tuple) else row["is_active"]
    new_status = not current_status
    
    # Update status
    cur.execute(sql("""
        UPDATE api_keys
        SET is_active = {PH}
        WHERE id = {PH} AND user_id = {PH}
    """), (new_status, key_id, user_id))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "is_active": new_status,
        "message": f"API key {'enabled' if new_status else 'disabled'}"
    }


# ========== Webhook Endpoints ==========

@router.post("/api/developer/webhooks")
def create_webhook(payload: WebhookRequest, user=Depends(verify_token)):
    """Create a webhook endpoint"""
    user_id = user["id"]
    
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        INSERT INTO webhooks
        (user_id, url, events, is_active, created_at)
        VALUES ({PH}, {PH}, {PH}, {PH}, {PH})
        RETURNING id
    """), (
        user_id,
        payload.url,
        ",".join(payload.events),
        payload.is_active,
        datetime.now().isoformat()
    ))
    
    webhook_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "webhook_id": webhook_id,
        "message": "Webhook created successfully"
    }


@router.get("/api/developer/webhooks")
def list_webhooks(user=Depends(verify_token)):
    """List all webhooks for the user"""
    user_id = user["id"]
    
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        SELECT id, url, events, is_active, created_at, last_triggered
        FROM webhooks
        WHERE user_id = {PH}
        ORDER BY created_at DESC
    """), (user_id,))
    
    webhooks = cur.fetchall()
    conn.close()
    
    return {
        "success": True,
        "webhooks": [
            {
                "id": w[0] if isinstance(w, tuple) else w["id"],
                "url": w[1] if isinstance(w, tuple) else w["url"],
                "events": (w[2] if isinstance(w, tuple) else w["events"]).split(","),
                "is_active": w[3] if isinstance(w, tuple) else w["is_active"],
                "created_at": w[4] if isinstance(w, tuple) else w["created_at"],
                "last_triggered": w[5] if isinstance(w, tuple) else w["last_triggered"]
            }
            for w in webhooks
        ]
    }


@router.delete("/api/developer/webhooks/{webhook_id}")
def delete_webhook(webhook_id: int, user=Depends(verify_token)):
    """Delete a webhook"""
    user_id = user["id"]
    
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        DELETE FROM webhooks
        WHERE id = {PH} AND user_id = {PH}
    """), (webhook_id, user_id))
    
    if cur.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    conn.commit()
    conn.close()
    
    return {"success": True, "message": "Webhook deleted"}


# ========== Usage Stats Endpoint ==========

@router.get("/api/developer/stats")
def get_api_stats(user=Depends(verify_token)):
    """Get API usage statistics"""
    user_id = user["id"]
    
    conn = get_conn()
    cur = conn.cursor()
    
    # Get total API calls (you'll track this when API keys are used)
    cur.execute(sql("""
        SELECT COUNT(*) as total_calls,
               SUM(CASE WHEN created_at > datetime('now', '-30 days') THEN 1 ELSE 0 END) as calls_last_30_days
        FROM api_requests
        WHERE user_id = {PH}
    """), (user_id,))
    
    stats = cur.fetchone()
    conn.close()
    
    return {
        "success": True,
        "stats": {
            "total_api_calls": stats[0] if stats else 0,
            "calls_last_30_days": stats[1] if stats else 0,
            "active_keys": 0,  # You can query this from api_keys table
            "active_webhooks": 0  # You can query this from webhooks table
        }
    }
