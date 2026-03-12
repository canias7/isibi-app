import os
from datetime import datetime, timedelta
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

def get_admin_dashboard_stats() -> Dict:
    """
    Get comprehensive dashboard statistics for admin

    Returns:
    {
        "users": {...},
        "revenue": {...},
        "calls": {...},
        "agents": {...},
        "credits": {...}
    }
    """
    from db import get_conn, sql

    conn = get_conn()
    cur = conn.cursor()

    # === USER STATISTICS ===
    cur.execute("""
    SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_month
    FROM users
    """)
    user_stats = cur.fetchone()

    # === REVENUE STATISTICS ===
    # credit_transactions.type holds 'purchase', 'deduction', etc.
    cur.execute("""
    SELECT
        COALESCE(SUM(amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN amount END), 0) as revenue_week,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN amount END), 0) as revenue_month
    FROM credit_transactions
    WHERE type = 'purchase'
    """)
    revenue_stats = cur.fetchone()

    # === CALL STATISTICS ===
    # Table is call_usage; duration column is duration_seconds; timestamp is started_at
    cur.execute("""
    SELECT
        COUNT(*) as total_calls,
        COUNT(CASE WHEN started_at >= NOW() - INTERVAL '7 days' THEN 1 END) as calls_week,
        COUNT(CASE WHEN started_at >= NOW() - INTERVAL '30 days' THEN 1 END) as calls_month,
        COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds
    FROM call_usage
    """)
    call_stats = cur.fetchone()

    # === AGENT STATISTICS ===
    cur.execute("""
    SELECT
        COUNT(*) as total_agents,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_agents_week,
        COUNT(DISTINCT owner_user_id) as active_users_with_agents
    FROM agents
    """)
    agent_stats = cur.fetchone()

    # === CREDIT STATISTICS ===
    cur.execute("""
    SELECT
        COALESCE(SUM(balance), 0) as total_balance,
        COALESCE(SUM(total_purchased), 0) as total_purchased,
        COALESCE(SUM(total_used), 0) as total_used
    FROM user_credits
    """)
    credit_stats = cur.fetchone()

    conn.close()

    def _get(row, key, index, default=0):
        """Access a row by column name (dict) or index (tuple)."""
        if row is None:
            return default
        if isinstance(row, dict):
            return row.get(key, default)
        return row[index]

    # Format results
    return {
    "users": {
        "total": _get(user_stats, 'total_users', 0),
        "new_week": _get(user_stats, 'new_users_week', 1),
        "new_month": _get(user_stats, 'new_users_month', 2)
    },
    "revenue": {
        "total": float(_get(revenue_stats, 'total_revenue', 0, 0.0)),
        "week": float(_get(revenue_stats, 'revenue_week', 1, 0.0)),
        "month": float(_get(revenue_stats, 'revenue_month', 2, 0.0))
    },
    "calls": {
        "total": _get(call_stats, 'total_calls', 0),
        "week": _get(call_stats, 'calls_week', 1),
        "month": _get(call_stats, 'calls_month', 2),
        "avg_duration": int(_get(call_stats, 'avg_duration_seconds', 3, 0))
    },
    "agents": {
        "total": _get(agent_stats, 'total_agents', 0),
        "new_week": _get(agent_stats, 'new_agents_week', 1),
        "active_users": _get(agent_stats, 'active_users_with_agents', 2)
    },
    "credits": {
        "total_balance": float(_get(credit_stats, 'total_balance', 0, 0.0)),
        "total_purchased": float(_get(credit_stats, 'total_purchased', 1, 0.0)),
        "total_used": float(_get(credit_stats, 'total_used', 2, 0.0))
    }
    }


def get_all_users(limit: int = 100, offset: int = 0) -> List[Dict]:
    """
    Get all users with their statistics

    Returns:
    List of users with credits, agents, calls
    """
    from db import get_conn, sql


    conn = get_conn()
    cur = conn.cursor()

    # call_tracking -> call_usage
    cur.execute(sql("""
        SELECT
            u.id,
            u.email,
            u.created_at,
            COALESCE(uc.balance, 0) as balance,
            COALESCE(uc.total_purchased, 0) as total_purchased,
            COALESCE(uc.total_used, 0) as total_used,
            COUNT(DISTINCT a.id) as agent_count,
            COUNT(DISTINCT c.id) as call_count,
            COALESCE(u.account_type, 'developer') as account_type,
            COALESCE(u.status, 'approved') as status,
            COALESCE(u.is_banned, FALSE) as is_banned
        FROM users u
        LEFT JOIN user_credits uc ON u.id = uc.user_id
        LEFT JOIN agents a ON u.id = a.owner_user_id
        LEFT JOIN call_usage c ON u.id = c.user_id
        GROUP BY u.id, u.email, u.created_at, uc.balance, uc.total_purchased, uc.total_used,
                 u.account_type, u.status, u.is_banned
        ORDER BY u.created_at DESC
        LIMIT {PH} OFFSET {PH}
    """), (limit, offset))

    users = []
    for row in cur.fetchall():
        if isinstance(row, dict):
            users.append({
                "id": row['id'],
                "email": row['email'],
                "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                "balance": float(row['balance']),
                "total_purchased": float(row['total_purchased']),
                "total_used": float(row['total_used']),
                "agent_count": row['agent_count'],
                "call_count": row['call_count'],
                "account_type": row.get('account_type', 'developer'),
                "status": row.get('status', 'approved'),
                "is_banned": bool(row.get('is_banned', False)),
            })
        else:
            users.append({
                "id": row[0],
                "email": row[1],
                "created_at": row[2].isoformat() if row[2] else None,
                "balance": float(row[3]),
                "total_purchased": float(row[4]),
                "total_used": float(row[5]),
                "agent_count": row[6],
                "call_count": row[7],
                "account_type": row[8] or 'developer',
                "status": row[9] or 'approved',
                "is_banned": bool(row[10]),
            })

    conn.close()
    return users


def get_recent_activity(limit: int = 50) -> List[Dict]:
    """
    Get recent platform activity (calls, purchases, signups)

    Returns:
    List of recent activities
    """
    from db import get_conn, sql

    conn = get_conn()
    cur = conn.cursor()

    activities = []

    # Recent calls — table: call_usage, timestamp: started_at, duration: duration_seconds
    cur.execute(sql("""
        SELECT
            'call' as type,
            c.id,
            c.started_at,
            u.email as user_email,
            COALESCE(c.call_to, 'Unknown') as agent_name,
            c.duration_seconds as duration
        FROM call_usage c
        JOIN users u ON c.user_id = u.id
        WHERE c.started_at >= NOW() - INTERVAL '7 days'
        ORDER BY c.started_at DESC
        LIMIT {PH}
    """), (limit,))

    for row in cur.fetchall():
        if isinstance(row, dict):
            activities.append({
                "type": "call",
                "id": row['id'],
                "timestamp": row['started_at'].isoformat() if row['started_at'] else None,
                "user_email": row['user_email'],
                "details": f"Call to {row['agent_name']} ({int(row['duration'] or 0)}s)"
            })
        else:
            activities.append({
                "type": "call",
                "id": row[1],
                "timestamp": row[2].isoformat() if row[2] else None,
                "user_email": row[3],
                "details": f"Call to {row[4]} ({int(row[5] or 0)}s)"
            })

    # Recent credit purchases — column is 'type' not 'transaction_type'
    cur.execute(sql("""
        SELECT
            'purchase' as type,
            ct.id,
            ct.created_at,
            u.email as user_email,
            ct.amount
        FROM credit_transactions ct
        JOIN users u ON ct.user_id = u.id
        WHERE ct.type = 'purchase'
        AND ct.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY ct.created_at DESC
        LIMIT {PH}
    """), (limit,))

    for row in cur.fetchall():
        if isinstance(row, dict):
            activities.append({
                "type": "purchase",
                "id": row['id'],
                "timestamp": row['created_at'].isoformat() if row['created_at'] else None,
                "user_email": row['user_email'],
                "details": f"Purchased ${row['amount']:.2f} credits"
            })
        else:
            activities.append({
                "type": "purchase",
                "id": row[1],
                "timestamp": row[2].isoformat() if row[2] else None,
                "user_email": row[3],
                "details": f"Purchased ${row[4]:.2f} credits"
            })

    # Recent signups
    cur.execute(sql("""
        SELECT
            'signup' as type,
            id,
            created_at,
            email
        FROM users
        WHERE created_at >= NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT {PH}
    """), (limit,))

    for row in cur.fetchall():
        if isinstance(row, dict):
            activities.append({
                "type": "signup",
                "id": row['id'],
                "timestamp": row['created_at'].isoformat() if row['created_at'] else None,
                "user_email": row['email'],
                "details": "New user signup"
            })
        else:
            activities.append({
                "type": "signup",
                "id": row[1],
                "timestamp": row[2].isoformat() if row[2] else None,
                "user_email": row[3],
                "details": "New user signup"
            })

    conn.close()

    # Sort all activities by timestamp
    activities.sort(key=lambda x: x['timestamp'], reverse=True)

    return activities[:limit]

def get_revenue_chart_data(days: int = 30) -> Dict:
    """
    Get revenue data for charts

    Returns:
    {"labels": [...], "data": [...]}
    """
    from db import get_conn, sql

    conn = get_conn()
    cur = conn.cursor()

    # credit_transactions.type = 'purchase'; use PostgreSQL interval syntax
    cur.execute(sql("""
        SELECT
            DATE(created_at) as date,
            SUM(amount) as revenue
        FROM credit_transactions
        WHERE type = 'purchase'
        AND created_at >= NOW() - ({PH} * INTERVAL '1 day')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    """), (days,))

    labels = []
    data = []

    for row in cur.fetchall():
        if isinstance(row, dict):
            labels.append(row['date'].strftime('%Y-%m-%d'))
            data.append(float(row['revenue']))
        else:
            labels.append(row[0].strftime('%Y-%m-%d'))
            data.append(float(row[1]))

    conn.close()

    return {"labels": labels, "data": data}

def is_admin(user_id: int) -> bool:
    """
    Check if user is an admin.
    For now, you can set this manually or check email.
    """
    from db import get_conn, sql

    conn = get_conn()
    cur = conn.cursor()

    # Get user email
    cur.execute(sql("SELECT email FROM users WHERE id = {PH}"), (user_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return False

    email = row[0] if isinstance(row, tuple) else row.get('email')

    # Admin emails (you can add yours here)
    ADMIN_EMAILS = os.getenv("ADMIN_EMAILS", "").split(",")

    return email.lower().strip() in [e.lower().strip() for e in ADMIN_EMAILS if e]
