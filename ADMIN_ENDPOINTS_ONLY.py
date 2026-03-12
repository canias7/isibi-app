
# ========== ADMIN ENDPOINTS ==========
# APPEND THIS TO THE END OF YOUR EXISTING portal.py FILE
# DO NOT REPLACE YOUR FILE - JUST ADD THIS TO THE END!

from admin import (
    get_admin_dashboard_stats,
    get_all_users,
    get_recent_activity,
    get_revenue_chart_data,
    is_admin
)

def verify_admin(user=Depends(verify_token)):
    """Verify user is an admin"""
    user_id = user["id"]
    
    if not is_admin(user_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user

@router.get("/admin/dashboard")
def get_admin_dashboard(user=Depends(verify_admin)):
    """Get admin dashboard statistics"""
    stats = get_admin_dashboard_stats()
    return stats


@router.get("/admin/users")
def get_admin_users(user=Depends(verify_admin), limit: int = 100, offset: int = 0):
    """Get all users with statistics"""
    users = get_all_users(limit=limit, offset=offset)
    return {"users": users, "total": len(users)}


@router.get("/admin/activity")
def get_admin_activity(user=Depends(verify_admin), limit: int = 50):
    """Get recent platform activity"""
    activity = get_recent_activity(limit=limit)
    return {"activity": activity}


@router.get("/admin/revenue-chart")
def get_admin_revenue_chart(user=Depends(verify_admin), days: int = 30):
    """Get revenue chart data"""
    chart_data = get_revenue_chart_data(days=days)
    return chart_data


@router.get("/admin/voice-chat-logs")
def get_admin_voice_chat_logs(user=Depends(verify_admin), limit: int = 50):
    """Get voice chat logs from Talk to ISIBI"""
    try:
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute(sql("""
            SELECT id, session_id, conversation_log, total_turns, client_ip, created_at
            FROM voice_chat_logs
            ORDER BY created_at DESC
            LIMIT {PH}
        """), (limit,))
        
        logs = []
        for row in cur.fetchall():
            if isinstance(row, dict):
                conversation = row.get('conversation_log')
                if isinstance(conversation, str):
                    import json
                    conversation = json.loads(conversation)
                
                logs.append({
                    "id": row['id'],
                    "session_id": row['session_id'],
                    "conversation": conversation,
                    "total_turns": row['total_turns'],
                    "client_ip": row['client_ip'],
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None
                })
            else:
                conversation = row[2]
                if isinstance(conversation, str):
                    import json
                    conversation = json.loads(conversation)
                
                logs.append({
                    "id": row[0],
                    "session_id": row[1],
                    "conversation": conversation,
                    "total_turns": row[3],
                    "client_ip": row[4],
                    "created_at": row[5].isoformat() if row[5] else None
                })
        
        conn.close()
        return {"logs": logs, "total": len(logs)}
    
    except Exception as e:
        print(f"❌ Failed to get voice chat logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")


@router.post("/admin/users/{user_id}/credits")
def admin_add_credits(user_id: int, amount: float, user=Depends(verify_admin)):
    """Manually add credits to a user (admin only)"""
    try:
        from datetime import datetime

        add_credits(
            user_id=user_id,
            amount=amount,
            description=f"Admin credit adjustment by {user['email']}",
            transaction_id=f"ADMIN-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        )

        return {"success": True, "message": f"Added ${amount:.2f} to user {user_id}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add credits: {str(e)}")


# ── Ban / Unban ────────────────────────────────────────────────────────────────

@router.post("/admin/users/{user_id}/ban")
def admin_ban_user(user_id: int, user=Depends(verify_admin)):
    """Ban a user — blocks login."""
    from db import get_conn, sql, ensure_user_columns
    ensure_user_columns()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT id, email FROM users WHERE id = {PH}"), (user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    email = row['email'] if isinstance(row, dict) else row[1]
    cur.execute(sql("UPDATE users SET is_banned = TRUE WHERE id = {PH}"), (user_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "email": email}


@router.post("/admin/users/{user_id}/unban")
def admin_unban_user(user_id: int, user=Depends(verify_admin)):
    """Reinstate a banned user."""
    from db import get_conn, sql, ensure_user_columns
    ensure_user_columns()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT id, email FROM users WHERE id = {PH}"), (user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    email = row['email'] if isinstance(row, dict) else row[1]
    cur.execute(sql("UPDATE users SET is_banned = FALSE WHERE id = {PH}"), (user_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "email": email}


# ── Developer Access Requests ──────────────────────────────────────────────────

@router.get("/admin/access-requests")
def admin_list_access_requests(user=Depends(verify_admin)):
    """List all developer signup applications."""
    from db import get_conn, sql, ensure_user_columns
    ensure_user_columns()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        SELECT id, email, full_name, company_name, website,
               use_case, call_volume, status, created_at
        FROM users
        WHERE account_type = 'developer'
        ORDER BY
            CASE WHEN status = 'pending' THEN 0
                 WHEN status = 'approved' THEN 1
                 ELSE 2 END,
            created_at DESC
    """))
    requests = []
    for row in cur.fetchall():
        if isinstance(row, dict):
            requests.append({
                "id": row['id'],
                "email": row['email'],
                "full_name": row.get('full_name'),
                "company_name": row.get('company_name'),
                "website": row.get('website'),
                "use_case": row.get('use_case'),
                "call_volume": row.get('call_volume'),
                "status": row.get('status') or 'pending',
                "created_at": row['created_at'].isoformat() if row['created_at'] else None,
            })
        else:
            requests.append({
                "id": row[0],
                "email": row[1],
                "full_name": row[2],
                "company_name": row[3],
                "website": row[4],
                "use_case": row[5],
                "call_volume": row[6],
                "status": row[7] or 'pending',
                "created_at": row[8].isoformat() if row[8] else None,
            })
    conn.close()
    return {"requests": requests}


@router.post("/admin/access-requests/{user_id}/approve")
def admin_approve_request(user_id: int, user=Depends(verify_admin)):
    """Approve a developer access request."""
    from db import get_conn, sql, ensure_user_columns
    ensure_user_columns()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT id FROM users WHERE id = {PH}"), (user_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    cur.execute(sql("UPDATE users SET status = 'approved' WHERE id = {PH}"), (user_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.post("/admin/access-requests/{user_id}/reject")
def admin_reject_request(user_id: int, user=Depends(verify_admin)):
    """Reject a developer access request."""
    from db import get_conn, sql, ensure_user_columns
    ensure_user_columns()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT id FROM users WHERE id = {PH}"), (user_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    cur.execute(sql("UPDATE users SET status = 'rejected' WHERE id = {PH}"), (user_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
