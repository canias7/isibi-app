from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
import re as _re
import time
import collections

def _valid_email(e: str) -> bool:
    return bool(_re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", e.strip()))
from db import create_user, verify_user
import os
from datetime import datetime, timedelta
import jwt

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
JWT_EXP_MINUTES = 60

# ── Startup security checks ───────────────────────────────────────────────────
if JWT_SECRET == "dev-secret-change-me":
    print("🚨 SECURITY WARNING: JWT_SECRET is using the default insecure value!")
    print("🚨 Set a strong random JWT_SECRET in Render environment variables.")
    print("🚨 Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\"")

# ── Login rate limiter ────────────────────────────────────────────────────────
# Tracks failed login attempts per IP. After MAX_ATTEMPTS failures within
# WINDOW_SECONDS, the IP is locked out for LOCKOUT_SECONDS.
_MAX_ATTEMPTS    = 5
_WINDOW_SECONDS  = 300   # 5-minute sliding window
_LOCKOUT_SECONDS = 900   # 15-minute lockout

# { ip: deque([timestamp, ...]) }
_login_attempts: dict[str, collections.deque] = {}
# { ip: lockout_until_timestamp }
_lockout_until: dict[str, float] = {}

def _check_rate_limit(ip: str) -> None:
    """Raise 429 if IP is locked out or has too many recent failures."""
    now = time.time()
    # Still locked out?
    if ip in _lockout_until:
        remaining = int(_lockout_until[ip] - now)
        if remaining > 0:
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Try again in {remaining // 60 + 1} minute(s)."
            )
        else:
            del _lockout_until[ip]
            _login_attempts.pop(ip, None)

def _record_failure(ip: str) -> None:
    """Record a failed login attempt and trigger lockout if threshold hit."""
    now = time.time()
    if ip not in _login_attempts:
        _login_attempts[ip] = collections.deque()
    dq = _login_attempts[ip]
    dq.append(now)
    # Purge attempts outside the window
    while dq and dq[0] < now - _WINDOW_SECONDS:
        dq.popleft()
    if len(dq) >= _MAX_ATTEMPTS:
        _lockout_until[ip] = now + _LOCKOUT_SECONDS
        _login_attempts.pop(ip, None)

def _clear_failures(ip: str) -> None:
    """Clear failure record on successful login."""
    _login_attempts.pop(ip, None)
    _lockout_until.pop(ip, None)

def make_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.utcnow() + timedelta(days=7)
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALG)

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterIn(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=6, max_length=128)
    tenant_phone: Optional[str] = Field(None, max_length=20)
    account_type: Optional[str] = Field("developer", max_length=32)
    full_name: Optional[str] = Field(None, max_length=120)
    company_name: Optional[str] = Field(None, max_length=120)
    website: Optional[str] = Field(None, max_length=256)
    use_case: Optional[str] = Field(None, max_length=500)
    call_volume: Optional[str] = Field(None, max_length=64)

@router.post("/register")
def register(data: RegisterIn):
    if not data.email or not data.email.strip():
        raise HTTPException(status_code=400, detail="Email is required.")
    if not _valid_email(data.email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not data.password or len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    try:
        create_user(
            email=data.email,
            password=data.password,
            tenant_phone=data.tenant_phone,
            account_type=data.account_type or "developer",
            full_name=data.full_name,
            company_name=data.company_name,
            website=data.website,
            use_case=data.use_case,
            call_volume=data.call_volume,
        )
        return {"status": "ok"}
    except Exception as e:
        err = str(e)
        if "UNIQUE" in err or "unique" in err or "duplicate" in err.lower():
            raise HTTPException(status_code=400, detail="An account with that email already exists.")
        raise HTTPException(status_code=400, detail=err)

@router.post("/login")
async def login_user(request: Request):
    # Rate-limit by client IP
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    # Parse body manually — never returns 422 regardless of what browser sends
    try:
        body = await request.json()
    except Exception:
        body = {}

    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    requested_type = body.get("account_type")  # optional hint from frontend

    if not email or not password:
        _record_failure(client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = verify_user(email, password)
    if not user:
        _record_failure(client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="This account has been suspended.")

    account_type = user.get("account_type", "developer")
    status = user.get("status", "approved")

    # Block suspended or explicitly rejected accounts only
    if status == "rejected":
        raise HTTPException(status_code=403, detail="Your account application was not approved. Contact support.")

    _clear_failures(client_ip)
    token = make_token({
        "id": user["id"],
        "email": user["email"],
        "tenant_phone": user.get("tenant_phone"),
        "account_type": account_type,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "account_type": account_type,
    }


# ── Dedicated customer endpoints ──────────────────────────────────────────────

class CustomerRegisterIn(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=6, max_length=128)

@router.post("/customer-register")
def customer_register(data: CustomerRegisterIn):
    """Register a new customer account (auto-approved, no review needed)."""
    if not data.email or not _valid_email(data.email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not data.password or len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    try:
        from db import create_user
        create_user(email=data.email, password=data.password, account_type="customer")
        return {"status": "ok"}
    except Exception as e:
        err = str(e)
        if "UNIQUE" in err or "unique" in err or "duplicate" in err.lower():
            raise HTTPException(status_code=400, detail="An account with that email already exists.")
        raise HTTPException(status_code=400, detail=err)


@router.post("/customer-login")
async def customer_login(request: Request):
    """Dedicated login for customer accounts — never returns 422."""
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    try:
        body = await request.json()
    except Exception:
        body = {}

    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        _record_failure(client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = verify_user(email, password)
    if not user:
        _record_failure(client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="This account has been suspended.")

    if user.get("account_type", "developer") != "customer":
        _record_failure(client_ip)
        raise HTTPException(status_code=403, detail="This account is not a customer account. Please use the developer login.")

    _clear_failures(client_ip)
    token = make_token({
        "id": user["id"],
        "email": user["email"],
        "tenant_phone": user.get("tenant_phone"),
        "account_type": "customer",
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "account_type": "customer",
    }


# -------------------------
# JWT dependency for portal routes
# -------------------------

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def verify_token(
    creds: HTTPAuthorizationCredentials = Depends(security)
):
    token = creds.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
