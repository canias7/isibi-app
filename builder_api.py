import os
import io
import json
import uuid
import sqlite3
import zipfile
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from auth_routes import verify_token
from datetime import datetime, timezone

load_dotenv()

router = APIRouter(prefix="/api/builder", tags=["Builder"])

DB_PATH = os.getenv("DATABASE_PATH", "app.db")


# ── DB init ────────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_builder_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS builder_sessions (
            id          TEXT PRIMARY KEY,
            user_id     INTEGER NOT NULL,
            name        TEXT NOT NULL DEFAULT 'Untitled Project',
            prompt      TEXT,
            html        TEXT DEFAULT '',
            messages    TEXT DEFAULT '[]',
            status      TEXT DEFAULT 'draft',
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


init_builder_db()


# ── Request models ─────────────────────────────────────────────────────────────

class BuildRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None   # if set → refine existing session


class RenameRequest(BaseModel):
    name: str


# ── Stub HTML templates ────────────────────────────────────────────────────────
#  TODO: Replace `generate_html_for_prompt()` with your AI model call.
#        The function signature and return shape stay the same — just swap
#        the stub templates for the real AI-generated output.
# ──────────────────────────────────────────────────────────────────────────────

LANDING_PAGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Landing Page</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',sans-serif;background:#0a0a0f;color:#fff;min-height:100vh}
  nav{display:flex;align-items:center;justify-content:space-between;padding:1.25rem 2rem;border-bottom:1px solid rgba(255,255,255,.07);position:sticky;top:0;background:rgba(10,10,15,.85);backdrop-filter:blur(12px)}
  nav .logo{font-weight:800;font-size:1.2rem;background:linear-gradient(135deg,#818cf8,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  nav .cta-nav{background:linear-gradient(135deg,#818cf8,#ec4899);border:none;color:#fff;padding:.5rem 1.25rem;border-radius:8px;cursor:pointer;font-weight:600;font-size:.875rem}
  .hero{text-align:center;padding:6rem 2rem 4rem;max-width:780px;margin:0 auto}
  .hero h1{font-size:3.25rem;font-weight:900;line-height:1.1;margin-bottom:1.25rem;background:linear-gradient(135deg,#fff,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .hero p{font-size:1.125rem;color:rgba(255,255,255,.55);margin-bottom:2.5rem;line-height:1.7}
  .btn-group{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
  .btn-primary{background:linear-gradient(135deg,#818cf8,#ec4899);border:none;color:#fff;padding:.875rem 2rem;border-radius:12px;cursor:pointer;font-weight:700;font-size:1rem}
  .btn-secondary{background:transparent;border:1px solid rgba(255,255,255,.2);color:#fff;padding:.875rem 2rem;border-radius:12px;cursor:pointer;font-weight:600;font-size:1rem}
  .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;padding:4rem 2rem;max-width:1100px;margin:0 auto}
  .feature-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:1.75rem}
  .feature-card .icon{font-size:1.75rem;margin-bottom:1rem}
  .feature-card h3{font-size:1.05rem;font-weight:700;margin-bottom:.5rem}
  .feature-card p{font-size:.875rem;color:rgba(255,255,255,.5);line-height:1.6}
  .cta-section{text-align:center;padding:5rem 2rem;background:linear-gradient(135deg,rgba(129,140,248,.08),rgba(236,72,153,.08));border-top:1px solid rgba(255,255,255,.06)}
  .cta-section h2{font-size:2rem;font-weight:800;margin-bottom:1rem}
  .cta-section p{color:rgba(255,255,255,.5);margin-bottom:2rem}
</style>
</head>
<body>
<nav>
  <span class="logo">YourBrand</span>
  <div style="display:flex;gap:1.5rem;align-items:center">
    <a href="#" style="color:rgba(255,255,255,.6);text-decoration:none;font-size:.875rem">Features</a>
    <a href="#" style="color:rgba(255,255,255,.6);text-decoration:none;font-size:.875rem">Pricing</a>
    <button class="cta-nav">Get Started</button>
  </div>
</nav>
<div class="hero">
  <h1>Build Something Amazing</h1>
  <p>The fastest way to go from idea to product. Powered by AI, built for everyone.</p>
  <div class="btn-group">
    <button class="btn-primary">Start for Free</button>
    <button class="btn-secondary">Watch Demo</button>
  </div>
</div>
<div class="features">
  <div class="feature-card"><div class="icon">⚡</div><h3>Lightning Fast</h3><p>Deploy in seconds. Zero config. Just your idea and a command.</p></div>
  <div class="feature-card"><div class="icon">🎨</div><h3>Beautiful Design</h3><p>Professionally designed templates that adapt to your brand instantly.</p></div>
  <div class="feature-card"><div class="icon">🔒</div><h3>Secure by Default</h3><p>Enterprise-grade security baked in from day one. No extra setup required.</p></div>
  <div class="feature-card"><div class="icon">📊</div><h3>Analytics Built In</h3><p>Know exactly how your product performs with real-time insights.</p></div>
  <div class="feature-card"><div class="icon">🌐</div><h3>Global CDN</h3><p>Your app served from 200+ edge locations worldwide.</p></div>
  <div class="feature-card"><div class="icon">🤝</div><h3>Team Collaboration</h3><p>Invite your team, assign roles, ship together faster.</p></div>
</div>
<div class="cta-section">
  <h2>Ready to get started?</h2>
  <p>Join 10,000+ builders already using our platform.</p>
  <button class="btn-primary">Create Free Account</button>
</div>
</body>
</html>"""

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Dashboard</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',sans-serif;background:#0d0d14;color:#fff;display:flex;min-height:100vh}
  .sidebar{width:220px;background:rgba(255,255,255,.03);border-right:1px solid rgba(255,255,255,.07);padding:1.5rem 1rem;display:flex;flex-direction:column;gap:.5rem;position:fixed;height:100vh}
  .sidebar .logo{font-weight:800;font-size:1.1rem;padding:.75rem;margin-bottom:1rem;background:linear-gradient(135deg,#818cf8,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .nav-item{display:flex;align-items:center;gap:.75rem;padding:.65rem .75rem;border-radius:10px;font-size:.875rem;color:rgba(255,255,255,.5);cursor:pointer;transition:all .15s}
  .nav-item:hover,.nav-item.active{background:rgba(129,140,248,.12);color:#818cf8}
  .main{flex:1;margin-left:220px;padding:2rem}
  .top-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:2rem}
  .top-bar h1{font-size:1.5rem;font-weight:700}
  .top-bar .avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#818cf8,#ec4899);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1.25rem;margin-bottom:2rem}
  .stat-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:1.25rem}
  .stat-card .label{font-size:.75rem;color:rgba(255,255,255,.4);margin-bottom:.5rem}
  .stat-card .value{font-size:1.75rem;font-weight:800}
  .stat-card .delta{font-size:.75rem;color:#4ade80;margin-top:.25rem}
  .grid-2{display:grid;grid-template-columns:2fr 1fr;gap:1.25rem}
  .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:1.25rem}
  .card h3{font-size:.875rem;font-weight:600;margin-bottom:1rem;color:rgba(255,255,255,.7)}
  .bar-row{display:flex;align-items:center;gap.75rem;margin-bottom:.75rem}
  .bar-label{font-size:.75rem;color:rgba(255,255,255,.5);width:70px}
  .bar-track{flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
  .bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#818cf8,#ec4899)}
  .activity-item{display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid rgba(255,255,255,.05)}
  .dot{width:8px;height:8px;border-radius:50%;background:#818cf8;flex-shrink:0}
  .activity-text{font-size:.8rem;color:rgba(255,255,255,.6)}
  .activity-time{font-size:.7rem;color:rgba(255,255,255,.3);margin-left:auto}
</style>
</head>
<body>
<div class="sidebar">
  <div class="logo">Dashboard</div>
  <div class="nav-item active">📊 Overview</div>
  <div class="nav-item">👥 Users</div>
  <div class="nav-item">📦 Products</div>
  <div class="nav-item">💰 Revenue</div>
  <div class="nav-item">📋 Reports</div>
  <div class="nav-item">⚙️ Settings</div>
</div>
<div class="main">
  <div class="top-bar">
    <h1>Good morning, Admin 👋</h1>
    <div class="avatar">A</div>
  </div>
  <div class="stats">
    <div class="stat-card"><div class="label">Total Revenue</div><div class="value">$48.2K</div><div class="delta">↑ 12.4% this month</div></div>
    <div class="stat-card"><div class="label">Active Users</div><div class="value">3,841</div><div class="delta">↑ 8.1% this week</div></div>
    <div class="stat-card"><div class="label">Orders</div><div class="value">1,204</div><div class="delta">↑ 3.2% today</div></div>
    <div class="stat-card"><div class="label">Conversion</div><div class="value">6.8%</div><div class="delta">↑ 0.5% vs last week</div></div>
  </div>
  <div class="grid-2">
    <div class="card">
      <h3>Revenue by Channel</h3>
      <div class="bar-row"><span class="bar-label">Direct</span><div class="bar-track"><div class="bar-fill" style="width:78%"></div></div><span style="font-size:.75rem;color:rgba(255,255,255,.4);margin-left:.5rem">78%</span></div>
      <div class="bar-row"><span class="bar-label">Organic</span><div class="bar-track"><div class="bar-fill" style="width:54%"></div></div><span style="font-size:.75rem;color:rgba(255,255,255,.4);margin-left:.5rem">54%</span></div>
      <div class="bar-row"><span class="bar-label">Referral</span><div class="bar-track"><div class="bar-fill" style="width:41%"></div></div><span style="font-size:.75rem;color:rgba(255,255,255,.4);margin-left:.5rem">41%</span></div>
      <div class="bar-row"><span class="bar-label">Social</span><div class="bar-track"><div class="bar-fill" style="width:29%"></div></div><span style="font-size:.75rem;color:rgba(255,255,255,.4);margin-left:.5rem">29%</span></div>
    </div>
    <div class="card">
      <h3>Recent Activity</h3>
      <div class="activity-item"><div class="dot"></div><span class="activity-text">New user signed up</span><span class="activity-time">2m</span></div>
      <div class="activity-item"><div class="dot" style="background:#4ade80"></div><span class="activity-text">Order #1204 completed</span><span class="activity-time">5m</span></div>
      <div class="activity-item"><div class="dot" style="background:#ec4899"></div><span class="activity-text">Refund requested</span><span class="activity-time">12m</span></div>
      <div class="activity-item"><div class="dot"></div><span class="activity-text">New user signed up</span><span class="activity-time">18m</span></div>
      <div class="activity-item"><div class="dot" style="background:#4ade80"></div><span class="activity-text">Payment received $240</span><span class="activity-time">24m</span></div>
    </div>
  </div>
</div>
</body>
</html>"""

FORM_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Form</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',sans-serif;background:#0a0a0f;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
  .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:2.5rem;width:100%;max-width:460px}
  .card h2{font-size:1.5rem;font-weight:800;margin-bottom:.5rem}
  .card p{font-size:.875rem;color:rgba(255,255,255,.4);margin-bottom:2rem}
  .field{margin-bottom:1.25rem}
  label{display:block;font-size:.8rem;font-weight:600;color:rgba(255,255,255,.6);margin-bottom:.5rem}
  input,textarea,select{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.75rem 1rem;color:#fff;font-size:.875rem;outline:none;transition:border-color .2s}
  input:focus,textarea:focus,select:focus{border-color:#818cf8}
  input::placeholder,textarea::placeholder{color:rgba(255,255,255,.25)}
  textarea{resize:vertical;min-height:100px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  .submit{width:100%;background:linear-gradient(135deg,#818cf8,#ec4899);border:none;color:#fff;padding:.875rem;border-radius:12px;font-weight:700;font-size:1rem;cursor:pointer;margin-top:.5rem}
  .submit:hover{opacity:.9}
  .footer-text{text-align:center;font-size:.75rem;color:rgba(255,255,255,.25);margin-top:1.25rem}
</style>
</head>
<body>
<div class="card">
  <h2>Get in Touch</h2>
  <p>Fill out the form below and we'll get back to you within 24 hours.</p>
  <div class="row">
    <div class="field"><label>First Name</label><input placeholder="John" /></div>
    <div class="field"><label>Last Name</label><input placeholder="Doe" /></div>
  </div>
  <div class="field"><label>Email</label><input type="email" placeholder="john@example.com" /></div>
  <div class="field"><label>Phone (optional)</label><input type="tel" placeholder="+1 (555) 000-0000" /></div>
  <div class="field">
    <label>Subject</label>
    <select><option>General Inquiry</option><option>Support</option><option>Partnership</option><option>Other</option></select>
  </div>
  <div class="field"><label>Message</label><textarea placeholder="Tell us how we can help..."></textarea></div>
  <button class="submit">Send Message</button>
  <p class="footer-text">We'll never share your info with anyone.</p>
</div>
</body>
</html>"""

PORTFOLIO_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Portfolio</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',sans-serif;background:#08080f;color:#fff;min-height:100vh}
  nav{display:flex;align-items:center;justify-content:space-between;padding:1.25rem 2.5rem;position:sticky;top:0;background:rgba(8,8,15,.85);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.06)}
  nav .name{font-weight:800;font-size:1.05rem}
  nav ul{list-style:none;display:flex;gap:2rem}
  nav ul a{color:rgba(255,255,255,.5);text-decoration:none;font-size:.875rem;transition:color .2s}
  nav ul a:hover{color:#818cf8}
  .hero{padding:6rem 2.5rem;max-width:900px}
  .hero .tag{display:inline-block;background:rgba(129,140,248,.15);color:#818cf8;padding:.35rem .9rem;border-radius:100px;font-size:.8rem;font-weight:600;margin-bottom:1.25rem;border:1px solid rgba(129,140,248,.25)}
  .hero h1{font-size:3.5rem;font-weight:900;line-height:1.1;margin-bottom:1.25rem}
  .hero h1 span{background:linear-gradient(135deg,#818cf8,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .hero p{font-size:1.1rem;color:rgba(255,255,255,.5);max-width:560px;line-height:1.7;margin-bottom:2rem}
  .projects{padding:4rem 2.5rem;max-width:1100px;margin:0 auto}
  .projects h2{font-size:1.5rem;font-weight:800;margin-bottom:2rem}
  .project-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}
  .project-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .2s,border-color .2s}
  .project-card:hover{transform:translateY(-4px);border-color:rgba(129,140,248,.3)}
  .project-thumb{height:160px;background:linear-gradient(135deg,rgba(129,140,248,.15),rgba(236,72,153,.15));display:flex;align-items:center;justify-content:center;font-size:2.5rem}
  .project-body{padding:1.25rem}
  .project-body h3{font-size:.95rem;font-weight:700;margin-bottom:.4rem}
  .project-body p{font-size:.8rem;color:rgba(255,255,255,.45);line-height:1.5}
  .tags{display:flex;gap:.5rem;margin-top:.75rem;flex-wrap:wrap}
  .tag-chip{font-size:.7rem;background:rgba(129,140,248,.1);color:#818cf8;padding:.2rem .6rem;border-radius:6px;border:1px solid rgba(129,140,248,.2)}
  .contact{padding:4rem 2.5rem;text-align:center;border-top:1px solid rgba(255,255,255,.06)}
  .contact h2{font-size:1.75rem;font-weight:800;margin-bottom:.75rem}
  .contact p{color:rgba(255,255,255,.45);margin-bottom:1.75rem}
  .btn{background:linear-gradient(135deg,#818cf8,#ec4899);border:none;color:#fff;padding:.875rem 2rem;border-radius:12px;font-weight:700;font-size:.95rem;cursor:pointer}
</style>
</head>
<body>
<nav>
  <span class="name">Alex Johnson</span>
  <ul>
    <li><a href="#">Work</a></li>
    <li><a href="#">About</a></li>
    <li><a href="#">Contact</a></li>
  </ul>
</nav>
<div class="hero">
  <span class="tag">Available for hire</span>
  <h1>I design &amp; build <span>digital products</span> people love.</h1>
  <p>Full-stack developer and UI designer with 6 years of experience crafting high-performance web apps.</p>
  <button class="btn">View My Work</button>
</div>
<div class="projects">
  <h2>Selected Projects</h2>
  <div class="project-grid">
    <div class="project-card"><div class="project-thumb">🚀</div><div class="project-body"><h3>SaaS Dashboard</h3><p>Analytics platform for 50K+ users. Built with React &amp; Node.js.</p><div class="tags"><span class="tag-chip">React</span><span class="tag-chip">Node</span><span class="tag-chip">Postgres</span></div></div></div>
    <div class="project-card"><div class="project-thumb">🛒</div><div class="project-body"><h3>E-Commerce App</h3><p>Full-featured store with payments, inventory &amp; admin panel.</p><div class="tags"><span class="tag-chip">Next.js</span><span class="tag-chip">Stripe</span><span class="tag-chip">Prisma</span></div></div></div>
    <div class="project-card"><div class="project-thumb">📱</div><div class="project-body"><h3>Mobile Fitness App</h3><p>React Native app with AI-powered workout recommendations.</p><div class="tags"><span class="tag-chip">React Native</span><span class="tag-chip">AI</span><span class="tag-chip">Firebase</span></div></div></div>
  </div>
</div>
<div class="contact">
  <h2>Let's work together</h2>
  <p>Open to freelance projects and full-time opportunities.</p>
  <button class="btn">Get In Touch</button>
</div>
</body>
</html>"""

DEFAULT_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AI Built Page</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',sans-serif;background:#0a0a0f;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center}
  .badge{background:rgba(129,140,248,.15);color:#818cf8;padding:.35rem .9rem;border-radius:100px;font-size:.8rem;font-weight:600;margin-bottom:1.5rem;border:1px solid rgba(129,140,248,.2);display:inline-block}
  h1{font-size:2.75rem;font-weight:900;background:linear-gradient(135deg,#fff,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1rem}
  p{font-size:1rem;color:rgba(255,255,255,.45);max-width:480px;line-height:1.7;margin-bottom:2rem}
  .btn{background:linear-gradient(135deg,#818cf8,#ec4899);border:none;color:#fff;padding:.875rem 2rem;border-radius:12px;font-weight:700;font-size:.95rem;cursor:pointer}
</style>
</head>
<body>
  <span class="badge">AI Generated</span>
  <h1>Your Page is Ready</h1>
  <p>This is a starting point. Describe what you want to change and the AI will rebuild it for you.</p>
  <button class="btn">Get Started</button>
</body>
</html>"""


def generate_html_for_prompt(prompt: str) -> tuple[str, str]:
    """
    Returns (html_string, suggested_name).

    ⚠️  STUB — Replace the body of this function with your AI model call.
    Keep the return signature: tuple[str, str]
    """
    p = prompt.lower()

    if any(k in p for k in ["landing", "homepage", "home page", "marketing", "startup"]):
        return LANDING_PAGE_HTML, "Landing Page"
    if any(k in p for k in ["dashboard", "analytics", "admin", "panel", "metrics"]):
        return DASHBOARD_HTML, "Dashboard"
    if any(k in p for k in ["form", "contact", "signup", "sign up", "register", "login", "survey"]):
        return FORM_HTML, "Contact Form"
    if any(k in p for k in ["portfolio", "personal", "resume", "cv", "about me"]):
        return PORTFOLIO_HTML, "Portfolio"

    return DEFAULT_HTML, "Custom Page"


# ── Helpers ────────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_dict(row) -> dict:
    d = dict(row)
    try:
        d["messages"] = json.loads(d.get("messages") or "[]")
    except Exception:
        d["messages"] = []
    return d


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/generate")
def build_or_refine(payload: BuildRequest, user=Depends(verify_token)):
    """
    Create a new build session OR refine an existing one.
    When session_id is provided the prompt is treated as a refinement instruction
    and the session messages are updated.
    """
    user_id = user["user_id"]
    conn = get_db()

    html, suggested_name = generate_html_for_prompt(payload.prompt)

    if payload.session_id:
        # ── Refine existing session ────────────────────────────────────────────
        row = conn.execute(
            "SELECT * FROM builder_sessions WHERE id=? AND user_id=?",
            (payload.session_id, user_id)
        ).fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Session not found")

        messages = json.loads(row["messages"] or "[]")
        messages.append({"role": "user",      "content": payload.prompt, "ts": now_iso()})
        messages.append({"role": "assistant", "content": "Updated the page.",  "ts": now_iso()})

        conn.execute(
            "UPDATE builder_sessions SET html=?, messages=?, updated_at=? WHERE id=?",
            (html, json.dumps(messages), now_iso(), payload.session_id)
        )
        conn.commit()

        row = conn.execute("SELECT * FROM builder_sessions WHERE id=?", (payload.session_id,)).fetchone()
        conn.close()
        return row_to_dict(row)

    # ── New session ────────────────────────────────────────────────────────────
    session_id = str(uuid.uuid4())
    messages = [
        {"role": "user",      "content": payload.prompt,         "ts": now_iso()},
        {"role": "assistant", "content": "Here's your page!",    "ts": now_iso()},
    ]

    conn.execute(
        """INSERT INTO builder_sessions (id, user_id, name, prompt, html, messages, status, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (session_id, user_id, suggested_name, payload.prompt, html,
         json.dumps(messages), "active", now_iso(), now_iso())
    )
    conn.commit()

    row = conn.execute("SELECT * FROM builder_sessions WHERE id=?", (session_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.get("/sessions")
def list_sessions(user=Depends(verify_token)):
    user_id = user["user_id"]
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM builder_sessions WHERE user_id=? ORDER BY updated_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


@router.get("/sessions/{session_id}")
def get_session(session_id: str, user=Depends(verify_token)):
    user_id = user["user_id"]
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM builder_sessions WHERE id=? AND user_id=?",
        (session_id, user_id)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return row_to_dict(row)


@router.patch("/sessions/{session_id}/rename")
def rename_session(session_id: str, payload: RenameRequest, user=Depends(verify_token)):
    user_id = user["user_id"]
    conn = get_db()
    conn.execute(
        "UPDATE builder_sessions SET name=?, updated_at=? WHERE id=? AND user_id=?",
        (payload.name.strip(), now_iso(), session_id, user_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, user=Depends(verify_token)):
    user_id = user["user_id"]
    conn = get_db()
    conn.execute(
        "DELETE FROM builder_sessions WHERE id=? AND user_id=?",
        (session_id, user_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.get("/sessions/{session_id}/download")
def download_session(session_id: str, user=Depends(verify_token)):
    """Returns the generated HTML as a downloadable file."""
    user_id = user["user_id"]
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM builder_sessions WHERE id=? AND user_id=?",
        (session_id, user_id)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    filename = (row["name"] or "page").replace(" ", "-").lower() + ".html"
    return Response(
        content=row["html"] or "",
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/sessions/{session_id}/download-app")
def download_as_app(session_id: str, user=Depends(verify_token)):
    """
    Packages the generated page as a self-installing Electron desktop app.
    Returns a .zip containing install.bat (Windows) / install.sh (Mac/Linux).

    Windows — double-click install.bat to:
      1. Auto-install Node.js via winget if missing
      2. Copy app to %LOCALAPPDATA%\\ISIBI\\<slug>
      3. Run npm install (one-time)
      4. Create Desktop shortcut + Start Menu entry
      5. Launch the app silently (no cmd window)

    Mac/Linux — run install.sh for equivalent behaviour.
    """
    user_id = user["user_id"]
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM builder_sessions WHERE id=? AND user_id=?",
        (session_id, user_id)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    app_name = (row["name"] or "My App").strip()
    slug     = app_name.lower().replace(" ", "-")
    html     = row["html"] or ""

    # ── Electron main.js ──────────────────────────────────────────────────────
    main_js = f"""\
const {{ app, BrowserWindow }} = require('electron');
const path = require('path');

function createWindow() {{
  const win = new BrowserWindow({{
    width: 1280,
    height: 820,
    title: "{app_name}",
    webPreferences: {{
      nodeIntegration: false,
      contextIsolation: true,
    }},
    autoHideMenuBar: true,
  }});
  win.loadFile('index.html');
}}

app.whenReady().then(() => {{
  createWindow();
  app.on('activate', () => {{
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  }});
}});

app.on('window-all-closed', () => {{
  if (process.platform !== 'darwin') app.quit();
}});
"""

    # ── package.json ──────────────────────────────────────────────────────────
    package_json = json.dumps({
        "name": slug,
        "version": "1.0.0",
        "description": f"{app_name} — built with ISIBI AI Builder",
        "main": "main.js",
        "scripts": {
            "start": "electron ."
        },
        "devDependencies": {
            "electron": "^28.0.0"
        }
    }, indent=2)

    # ── install.bat (Windows) ─────────────────────────────────────────────────
    # Uses placeholder replacement instead of f-string to avoid backslash conflicts.
    install_bat = """\
@echo off
setlocal EnableDelayedExpansion
title Installing __APP_NAME__
color 0A

echo.
echo  ============================================================
echo   ISIBI AI Builder  ^|^|  __APP_NAME__
echo  ============================================================
echo.

:: ─── Step 1: Check / auto-install Node.js ────────────────────────────────────
echo  [1/4]  Checking for Node.js...
where node >nul 2>&1
if %errorlevel% equ 0 goto :COPY

echo         Node.js not found.  Installing automatically...
echo         ^(This is a one-time setup — takes ~1 min^)
echo.
where winget >nul 2>&1
if %errorlevel% neq 0 (
    echo         winget not available.
    echo         Please install Node.js v18+ from https://nodejs.org then re-run this file.
    start "" "https://nodejs.org/en/download/"
    pause & exit /b 1
)

winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
set "PATH=%PATH%;%ProgramFiles%\nodejs;%APPDATA%\npm"
timeout /t 4 >nul
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%PATH%;%ProgramFiles%\nodejs"
    )
)
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo         Node.js was installed but PATH needs a refresh.
    echo         Please close this window, restart your PC, then run install.bat again.
    echo.
    pause & exit /b 1
)
echo         Node.js installed successfully!

:COPY
:: ─── Step 2: Copy app files to local install directory ───────────────────────
set "INSTALL_DIR=%LOCALAPPDATA%\ISIBI\__SLUG__"
echo  [2/4]  Copying to: !INSTALL_DIR!
if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"
xcopy /E /I /Y /Q "%~dp0" "!INSTALL_DIR!" >nul 2>&1

:: ─── Step 3: Install npm dependencies ────────────────────────────────────────
echo  [3/4]  Installing app modules ^(first run only^)...
cd /d "!INSTALL_DIR!"
call npm install --silent 2>nul
if %errorlevel% neq 0 call npm install

:: Create silent VBS launcher so app opens with no cmd window
(
echo Set ws = CreateObject^("WScript.Shell"^)
echo ws.CurrentDirectory = "!INSTALL_DIR!"
echo ws.Run "cmd /c npm start", 0, False
) > "!INSTALL_DIR!\launch.vbs"

:: Create uninstaller
(
echo @echo off
echo echo Uninstalling __APP_NAME__...
echo rmdir /S /Q "!INSTALL_DIR!" 2^>nul
echo del /F /Q "%USERPROFILE%\Desktop\__APP_NAME__.lnk" 2^>nul
echo rmdir /S /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\__APP_NAME__" 2^>nul
echo echo Done. __APP_NAME__ has been uninstalled.
echo pause
) > "!INSTALL_DIR!\uninstall.bat"

:: ─── Step 4: Shortcuts ───────────────────────────────────────────────────────
echo  [4/4]  Creating shortcuts...
set "LNC=!INSTALL_DIR!\launch.vbs"

:: Desktop shortcut
set "_V=%TEMP%\isibi_%RANDOM%.vbs"
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo Set oLink = oWS.CreateShortcut^("%USERPROFILE%\Desktop\__APP_NAME__.lnk"^)
echo oLink.TargetPath = "wscript.exe"
echo oLink.Arguments = Chr^(34^) ^& "!LNC!" ^& Chr^(34^)
echo oLink.WorkingDirectory = "!INSTALL_DIR!"
echo oLink.Description = "__APP_NAME__ — built with ISIBI AI Builder"
echo oLink.IconLocation = "shell32.dll,14"
echo oLink.Save
) > "!_V!"
cscript //nologo "!_V!" & del "!_V!" >nul 2>&1

:: Start Menu shortcut
set "SMDIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\__APP_NAME__"
if not exist "!SMDIR!" mkdir "!SMDIR!"
set "_V2=%TEMP%\isibi_%RANDOM%.vbs"
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo Set oLink = oWS.CreateShortcut^("!SMDIR!\__APP_NAME__.lnk"^)
echo oLink.TargetPath = "wscript.exe"
echo oLink.Arguments = Chr^(34^) ^& "!LNC!" ^& Chr^(34^)
echo oLink.WorkingDirectory = "!INSTALL_DIR!"
echo oLink.Description = "__APP_NAME__ — built with ISIBI AI Builder"
echo oLink.IconLocation = "shell32.dll,14"
echo oLink.Save
) > "!_V2!"
cscript //nologo "!_V2!" & del "!_V2!" >nul 2>&1

echo.
echo  ============================================================
echo   __APP_NAME__ installed!
echo.
echo   ^> Desktop shortcut created
echo   ^> Start Menu entry added
echo   ^> To uninstall: !INSTALL_DIR!\uninstall.bat
echo.
echo   Launching __APP_NAME__ now...
echo  ============================================================
echo.
start "" wscript.exe "!LNC!"
timeout /t 2 >nul
""".replace("__APP_NAME__", app_name).replace("__SLUG__", slug)

    # ── install.sh (Mac / Linux) ──────────────────────────────────────────────
    install_sh = f"""\
#!/bin/bash
set -e

APP_NAME="{app_name}"
INSTALL_DIR="$HOME/Applications/ISIBI/{slug}"

echo ""
echo "=================================================="
echo "  ISIBI AI Builder | Installing: $APP_NAME"
echo "=================================================="
echo ""

# 1. Check Node.js
echo "[1/4] Checking for Node.js..."
if ! command -v node &>/dev/null; then
    echo "      Node.js not found. Attempting install..."
    if command -v brew &>/dev/null; then
        brew install node
    else
        echo "      Please install Node.js v18+ from https://nodejs.org"
        command -v open &>/dev/null && open "https://nodejs.org/en/download/"
        exit 1
    fi
fi
echo "      Found $(node --version)"

# 2. Copy files
echo "[2/4] Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
SCRIPT_DIR="$(cd "$(dirname "$0")"; pwd)"
cp -r "$SCRIPT_DIR/." "$INSTALL_DIR/"

# 3. npm install
echo "[3/4] Installing app modules (first run only)..."
cd "$INSTALL_DIR"
npm install --silent

# 4. Create launcher on Desktop
echo "[4/4] Creating launcher..."
LAUNCHER="$HOME/Desktop/$APP_NAME.command"
printf '#!/bin/bash\\ncd "%s" && npm start\\n' "$INSTALL_DIR" > "$LAUNCHER"
chmod +x "$LAUNCHER"

echo ""
echo "=================================================="
echo "  $APP_NAME installed!"
echo "  Desktop launcher: $APP_NAME.command"
echo "=================================================="
echo ""
echo "Launching $APP_NAME..."
command -v open &>/dev/null && open "$LAUNCHER" || "$LAUNCHER"
"""

    # ── README.md ─────────────────────────────────────────────────────────────
    readme = f"""\
# {app_name}

Built with **ISIBI AI Builder**.

## Install as a desktop app

### Windows
1. Extract this ZIP anywhere
2. **Double-click `install.bat`**
   - Automatically installs Node.js if it's not on your PC
   - Copies the app to your local Programs folder
   - Creates a **Desktop shortcut** and **Start Menu entry**
   - Launches the app — done!

### Mac / Linux
1. Extract this ZIP
2. Open Terminal in this folder
3. Run: `chmod +x install.sh && ./install.sh`
   - Installs Node.js via Homebrew if needed
   - Creates a `.command` launcher on your Desktop

---
*Powered by ISIBI · isibi.com*
"""

    # ── Build the ZIP in memory ───────────────────────────────────────────────
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{slug}/index.html",    html)
        zf.writestr(f"{slug}/main.js",       main_js)
        zf.writestr(f"{slug}/package.json",  package_json)
        zf.writestr(f"{slug}/install.bat",   install_bat)
        zf.writestr(f"{slug}/install.sh",    install_sh)
        zf.writestr(f"{slug}/README.md",     readme)

    zip_bytes = buf.getvalue()
    zip_filename = f"{slug}-installer.zip"

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'}
    )
