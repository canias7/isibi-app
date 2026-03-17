"""
Voice Command endpoint — interprets natural language commands from the
isibi mobile app and executes them on behalf of the logged-in customer.
"""
import os, json, logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from auth_routes import verify_token
from db import get_conn, sql

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/voice-command", tags=["voice-command"])
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ── helpers ───────────────────────────────────────────────────────────────────

def _agents(user_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT id, name, is_active, phone_number FROM agents WHERE owner_user_id={PH}"), (user_id,))
    rows = cur.fetchall()
    conn.close()
    if not rows:
        return []
    if isinstance(rows[0], dict):
        return rows
    return [{"id": r[0], "name": r[1], "is_active": r[2], "phone_number": r[3]} for r in rows]

def _contacts(user_id: int, query: str = ""):
    conn = get_conn()
    cur = conn.cursor()
    if query:
        like = f"%{query}%"
        cur.execute(sql("""SELECT id, first_name, last_name, phone_number, email
                           FROM crm_contacts
                           WHERE user_id={PH} AND (first_name ILIKE {PH} OR last_name ILIKE {PH} OR phone_number LIKE {PH})
                           LIMIT 5"""), (user_id, like, like, like))
    else:
        cur.execute(sql("SELECT id, first_name, last_name, phone_number, email FROM crm_contacts WHERE user_id={PH} LIMIT 20"), (user_id,))
    rows = cur.fetchall()
    conn.close()
    if not rows:
        return []
    if isinstance(rows[0], dict):
        return rows
    return [{"id": r[0], "first_name": r[1], "last_name": r[2], "phone_number": r[3], "email": r[4]} for r in rows]

def _call_stats(user_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""SELECT COUNT(*) as total,
                              SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) as today,
                              SUM(CASE WHEN call_type='ai' THEN 1 ELSE 0 END) as ai_calls
                       FROM crm_calls WHERE user_id={PH}"""), (user_id,))
    row = cur.fetchone()
    conn.close()
    if isinstance(row, dict):
        return row
    return {"total": row[0], "today": row[1], "ai_calls": row[2]}


# ── intent execution ──────────────────────────────────────────────────────────

def execute_intent(intent: dict, user_id: int) -> str:
    action = intent.get("action")

    if action == "get_stats":
        stats = _call_stats(user_id)
        agents = _agents(user_id)
        active = sum(1 for a in agents if a["is_active"])
        return (f"You have {stats.get('today', 0)} calls today, "
                f"{stats.get('total', 0)} total calls, "
                f"and {active} of {len(agents)} agents are currently active.")

    elif action == "list_agents":
        agents = _agents(user_id)
        if not agents:
            return "You don't have any agents set up yet."
        lines = [f"{a['name']} ({'active' if a['is_active'] else 'paused'})" for a in agents]
        return "Your agents: " + ", ".join(lines) + "."

    elif action == "toggle_agent":
        name_hint = intent.get("agent_name", "").lower()
        enable = intent.get("enable", True)
        agents = _agents(user_id)
        match = next((a for a in agents if name_hint in a["name"].lower()), None)
        if not match:
            return f"I couldn't find an agent named '{intent.get('agent_name')}'. Your agents are: {', '.join(a['name'] for a in agents)}."
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(sql("UPDATE agents SET is_active={PH} WHERE id={PH} AND owner_user_id={PH}"),
                    (1 if enable else 0, match["id"], user_id))
        conn.commit()
        conn.close()
        state = "activated" if enable else "paused"
        return f"Agent {match['name']} has been {state}."

    elif action == "call_contact":
        name_hint = intent.get("contact_name", "").lower()
        contacts = _contacts(user_id, name_hint)
        if not contacts:
            return f"I couldn't find a contact named '{intent.get('contact_name')}' in your CRM."
        c = contacts[0]
        full_name = f"{c['first_name']} {c['last_name']}".strip()
        agents = _agents(user_id)
        active_agents = [a for a in agents if a["is_active"]]
        if not active_agents:
            return f"I found {full_name} but you have no active agents to make the call. Please activate an agent first."
        # Return special marker so app can trigger the call
        return json.dumps({
            "type": "initiate_call",
            "contact_id": c["id"],
            "contact_name": full_name,
            "phone_number": c["phone_number"],
            "agent_id": active_agents[0]["id"],
            "message": f"Calling {full_name} now using agent {active_agents[0]['name']}."
        })

    elif action == "list_contacts":
        contacts = _contacts(user_id)
        if not contacts:
            return "You don't have any contacts in your CRM yet."
        names = [f"{c['first_name']} {c['last_name']}".strip() for c in contacts[:5]]
        total = len(_contacts(user_id))
        return f"You have {total} contacts. Recent ones: {', '.join(names)}."

    elif action == "unknown":
        return intent.get("fallback", "I didn't understand that command. Try something like: 'call John Smith', 'pause my agent', or 'how many calls today'.")

    return "Command executed."


# ── main endpoint ─────────────────────────────────────────────────────────────

class CommandIn(BaseModel):
    text: str   # transcribed voice command

@router.post("")
def voice_command(payload: CommandIn, user=Depends(verify_token)):
    user_id = user["id"]
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty command")

    agents = _agents(user_id)
    agent_names = [a["name"] for a in agents]

    # Ask GPT to classify the intent
    system = """You are a command interpreter for an AI voice platform CRM called Isibi.
The user speaks a command and you must return a JSON object identifying the intent.

Possible actions:
- get_stats: user wants call stats or overview
- list_agents: user wants to see their agents
- toggle_agent: user wants to enable/disable an agent — include "agent_name" (string) and "enable" (bool)
- call_contact: user wants to call someone — include "contact_name" (string)
- list_contacts: user wants to list contacts
- unknown: anything else — include "fallback" with a helpful message

Return ONLY valid JSON. No markdown, no explanation."""

    user_msg = f"Command: \"{text}\"\nAgent names available: {agent_names}"

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg}
            ],
            temperature=0,
            max_tokens=200,
        )
        raw = resp.choices[0].message.content.strip()
        intent = json.loads(raw)
    except Exception as e:
        logger.error(f"Intent parse error: {e}")
        intent = {"action": "unknown", "fallback": "Sorry, I had trouble understanding that."}

    result = execute_intent(intent, user_id)
    return {"result": result, "intent": intent}
