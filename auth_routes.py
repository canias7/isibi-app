from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from db import create_user, verify_user
import os
from datetime import datetime, timedelta
import jwt

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
JWT_EXP_MINUTES = 60

def make_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.utcnow() + timedelta(days=7)
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALG)

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    tenant_phone: Optional[str] = None
    account_type: Optional[str] = "developer"
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    website: Optional[str] = None
    use_case: Optional[str] = None
    call_volume: Optional[str] = None

class LoginRequest(BaseModel):
    email: str          # str (not EmailStr) — strict format check not needed for login
    password: str
    account_type: Optional[str] = None

@router.post("/register")
def register(data: RegisterIn):
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
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
def login_user(payload: LoginRequest):
    user = verify_user(payload.email.strip().lower(), payload.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Block banned accounts
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="This account has been suspended.")

    account_type = user.get("account_type", "developer")
    status = user.get("status", "approved")

    # Enforce login portal separation
    requested_type = payload.account_type  # what the login page claims
    if requested_type == "customer" and account_type != "customer":
        raise HTTPException(status_code=403, detail="This account is not a customer account. Please use the developer login.")
    if requested_type != "customer" and account_type == "customer":
        raise HTTPException(status_code=403, detail="Please use the customer login portal.")

    # Block developers who haven't been approved yet
    if account_type == "developer" and status == "pending":
        raise HTTPException(status_code=403, detail="Your developer access is pending review.")

    if account_type == "developer" and status == "rejected":
        raise HTTPException(status_code=403, detail="Your developer access request was not approved.")

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
    email: EmailStr
    password: str

@router.post("/customer-register")
def customer_register(data: CustomerRegisterIn):
    """Register a new customer account (auto-approved, no review needed)."""
    try:
        from db import create_user
        create_user(email=data.email, password=data.password, account_type="customer")
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/customer-login")
def customer_login(payload: LoginRequest):
    """Dedicated login for customer accounts."""
    user = verify_user(payload.email.strip().lower(), payload.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="This account has been suspended.")

    account_type = user.get("account_type", "developer")
    if account_type != "customer":
        raise HTTPException(status_code=403, detail="This account is not a customer account. Please use the developer login.")

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
