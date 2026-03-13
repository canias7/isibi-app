from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from auth_routes import verify_token  # your JWT verify function
from db import create_agent, list_agents, get_agent, update_agent, delete_agent, get_user_usage, get_call_history, get_user_credits, add_credits, get_credit_transactions, get_user_google_credentials, assign_google_calendar_to_agent, deduct_credits
from google_calendar import get_google_oauth_url, handle_google_callback, disconnect_google_calendar
from fastapi.responses import RedirectResponse, HTMLResponse
import os
import stripe
from twilio.rest import Client
from bs4 import BeautifulSoup
import requests
from anthropic import Anthropic

# Stripe configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Twilio configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL", "https://isibi-backend.onrender.com")

# Initialize Twilio client only if credentials are available
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

router = APIRouter(prefix="/api", tags=["portal"])

# ---------- Models ----------

class ToolsModel(BaseModel):
    google_calendar: Optional[Dict[str, Any]] = None
    slack: Optional[Dict[str, Any]] = None

class CreateAgentRequest(BaseModel):
    # phone number section
    phone_number: Optional[str] = None
    twilio_number_sid: Optional[str] = None  # The Twilio SID of the pre-purchased number

    # assistant section
    business_name: Optional[str] = None
    assistant_name: str  # required
    first_message: Optional[str] = None
    system_prompt: Optional[str] = None
    provider: Optional[str] = None

    # model / brain selection
    model: Optional[str] = None  # e.g. "gpt-4o-realtime-preview-2025-06-03"
    tts_provider: Optional[str] = "openai"  # TTS for GPT-4o pipeline: "openai" or "elevenlabs"
    llm_provider: Optional[str] = "openai"  # LLM provider: "openai" or "anthropic"

    # voice section
    voice: Optional[str] = None
    voice_provider: Optional[str] = "openai"  # NEW: openai or elevenlabs
    elevenlabs_voice_id: Optional[str] = None  # NEW: ElevenLabs voice ID
    language: Optional[str] = "en"  # Agent response language code

    # tools section
    tools: Optional[ToolsModel] = None

    # integrations
    enable_calendar: Optional[bool] = False  # If true, assign user's calendar to this agent

class PurchaseNumberRequest(BaseModel):
    area_code: Optional[str] = None  # e.g., "704", "212"
    country: Optional[str] = "US"
    contains: Optional[str] = None  # Search for numbers containing this pattern
    
class UpdateAgentRequest(BaseModel):
    phone_number: Optional[str] = None
    business_name: Optional[str] = None
    assistant_name: Optional[str] = None
    first_message: Optional[str] = None
    system_prompt: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None  # Realtime model
    tts_provider: Optional[str] = None  # TTS provider: "openai" or "elevenlabs"
    llm_provider: Optional[str] = None  # LLM provider: "openai" or "anthropic"
    voice: Optional[str] = None
    voice_provider: Optional[str] = None  # NEW: openai or elevenlabs
    elevenlabs_voice_id: Optional[str] = None  # NEW: ElevenLabs voice ID
    language: Optional[str] = None  # Agent response language code
    tools: Optional[ToolsModel] = None

class PurchaseCreditsRequest(BaseModel):
    amount: float
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None

class AgentOut(BaseModel):
    id: int
    assistant_name: str
    business_name: Optional[str] = None
    phone_number: Optional[str] = None
    first_message: Optional[str] = None
    system_prompt: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None  # Realtime model
    tts_provider: Optional[str] = None  # TTS provider
    llm_provider: Optional[str] = None  # LLM provider: "openai" or "anthropic"
    voice: Optional[str] = None
    voice_provider: Optional[str] = None  # 'openai' or 'elevenlabs'
    elevenlabs_voice_id: Optional[str] = None
    language: Optional[str] = None  # Agent response language code
    tools: Optional[Dict[str, Any]] = None
    google_calendar_connected: Optional[bool] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ---------- Routes ----------

@router.get("/agents", response_model=List[AgentOut])
def api_list_agents(user=Depends(verify_token)):
    owner_user_id = user["id"]
    agents = list_agents(owner_user_id)

    # map DB keys -> API keys
    return [
        {
            "id": a["id"],
            "assistant_name": a["name"],
            "business_name": a.get("business_name"),
            "phone_number": a.get("phone_number"),
            "first_message": a.get("first_message"),
            "system_prompt": a.get("system_prompt"),
            "provider": a.get("provider"),
            "model": a.get("model"),
            "tts_provider": a.get("tts_provider"),
            "llm_provider": a.get("llm_provider") or "openai",
            "voice": a.get("voice"),
            "voice_provider": a.get("voice_provider"),
            "elevenlabs_voice_id": a.get("elevenlabs_voice_id"),
            "tools": a.get("tools"),
            "google_calendar_connected": bool(a.get("google_calendar_id")),
            "created_at": a.get("created_at"),
            "updated_at": a.get("updated_at"),
        }
        for a in agents
    ]


@router.post("/agents")
def api_create_agent(payload: CreateAgentRequest, user=Depends(verify_token)):
    owner_user_id = user["id"]

    agent_id = create_agent(
        owner_user_id=owner_user_id,
        name=payload.assistant_name,
        business_name=payload.business_name,
        phone_number=payload.phone_number,
        first_message=payload.first_message,
        system_prompt=payload.system_prompt,
        provider=payload.provider,
        model=payload.model,
        tts_provider=payload.tts_provider or "openai",
        llm_provider=payload.llm_provider or "openai",
        voice=payload.voice,
        voice_provider=payload.voice_provider or "openai",  # NEW
        elevenlabs_voice_id=payload.elevenlabs_voice_id,  # NEW
        language=payload.language or "en",
        tools=(payload.tools.model_dump() if payload.tools else {}),
        twilio_number_sid=payload.twilio_number_sid,
    )
    
    # If a Twilio number was provided, update its friendly name
    if payload.twilio_number_sid and twilio_client:
        try:
            twilio_client.incoming_phone_numbers(payload.twilio_number_sid).update(
                friendly_name=f"{payload.assistant_name} - {payload.business_name or 'Agent'}"
            )
        except Exception as e:
            print(f"⚠️ Failed to update Twilio number friendly name: {e}")
    
    # If user wants calendar enabled, assign their credentials to this agent
    if payload.enable_calendar:
        success = assign_google_calendar_to_agent(owner_user_id, agent_id)
        if not success:
            # Calendar credentials not found, but agent was created
            return {
                "ok": True,
                "agent_id": agent_id,
                "warning": "Agent created but calendar not connected. Connect calendar first."
            }

    return {"ok": True, "agent_id": agent_id}


@router.get("/agents/{agent_id}", response_model=AgentOut)
def api_get_agent(agent_id: int, user=Depends(verify_token)):
    owner_user_id = user["id"]
    a = get_agent(owner_user_id, agent_id)
    if not a:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {
        "id": a["id"],
        "assistant_name": a["name"],
        "business_name": a.get("business_name"),
        "phone_number": a.get("phone_number"),
        "first_message": a.get("first_message"),
        "system_prompt": a.get("system_prompt"),
        "provider": a.get("provider"),
        "model": a.get("model"),
        "tts_provider": a.get("tts_provider"),
        "llm_provider": a.get("llm_provider") or "openai",
        "voice": a.get("voice"),
        "voice_provider": a.get("voice_provider"),
        "elevenlabs_voice_id": a.get("elevenlabs_voice_id"),
        "language": a.get("language") or "en",
        "tools": a.get("tools"),
        "google_calendar_connected": bool(a.get("google_calendar_id")),
        "created_at": a.get("created_at"),
        "updated_at": a.get("updated_at"),
    }


@router.patch("/agents/{agent_id}")
def api_update_agent(agent_id: int, payload: UpdateAgentRequest, user=Depends(verify_token)):
    owner_user_id = user["id"]

    changed = update_agent(
        owner_user_id,
        agent_id,
        name=payload.assistant_name,  # map UI -> DB
        business_name=payload.business_name,
        phone_number=payload.phone_number,
        first_message=payload.first_message,
        system_prompt=payload.system_prompt,
        provider=payload.provider,
        model=payload.model,
        tts_provider=payload.tts_provider,
        llm_provider=payload.llm_provider,
        voice=payload.voice,
        voice_provider=payload.voice_provider,  # NEW
        elevenlabs_voice_id=payload.elevenlabs_voice_id,  # NEW
        language=payload.language,
        tools=(payload.tools.model_dump() if payload.tools else None),
    )

    if not changed:
        return {"ok": True, "updated": False}

    return {"ok": True, "updated": True}


@router.delete("/agents/{agent_id}")
def api_delete_agent(agent_id: int, user=Depends(verify_token)):
    owner_user_id = user["id"]
    
    # Get agent before deleting to check if it has a Twilio number
    agent = get_agent(owner_user_id, agent_id)
    
    # Release Twilio number if it exists
    if agent and agent.get("twilio_number_sid") and twilio_client:
        try:
            twilio_client.incoming_phone_numbers(agent["twilio_number_sid"]).delete()
            print(f"✅ Released Twilio number {agent.get('phone_number')} for deleted agent {agent_id}")
        except Exception as e:
            print(f"⚠️ Failed to release Twilio number: {e}")
            # Continue with delete anyway
    
    deleted = delete_agent(owner_user_id, agent_id)
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found or you don't have permission to delete it")
    
    return {"ok": True, "deleted": True}



# ========== Google Calendar Integration ==========

@router.get("/agents/{agent_id}/google/auth")
def google_calendar_auth(agent_id: int, user=Depends(verify_token)):
    """Start Google Calendar OAuth flow"""
    owner_user_id = user["id"]
    
    # Verify user owns this agent
    agent = get_agent(owner_user_id, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    try:
        auth_url = get_google_oauth_url(agent_id, owner_user_id)
        return {"auth_url": auth_url}
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/google/callback")
def google_calendar_callback(code: str, state: str):
    """Handle Google OAuth callback"""
    try:
        result = handle_google_callback(code, state)
        agent_id = result['agent_id']
        
        # Return success HTML that closes itself
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Calendar Connected</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }}
                .container {{
                    text-align: center;
                    padding: 40px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                }}
                .success-icon {{
                    font-size: 64px;
                    margin-bottom: 20px;
                }}
                h1 {{ margin: 0 0 10px 0; }}
                p {{ opacity: 0.9; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✅</div>
                <h1>Google Calendar Connected!</h1>
                <p>Your AI agent can now book appointments automatically.</p>
                <p><small>You can close this window and return to your dashboard.</small></p>
            </div>
            <script>
                // Auto-close after 3 seconds
                setTimeout(() => {{
                    window.close();
                }}, 3000);
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")


@router.delete("/agents/{agent_id}/google/disconnect")
def google_calendar_disconnect(agent_id: int, user=Depends(verify_token)):
    """Disconnect Google Calendar from agent"""
    owner_user_id = user["id"]
    
    disconnected = disconnect_google_calendar(agent_id, owner_user_id)
    
    if not disconnected:
        raise HTTPException(status_code=404, detail="Agent not found or calendar not connected")
    
    return {"ok": True, "disconnected": True}


# ========== User-Level Google Calendar (for agent creation flow) ==========

@router.get("/google/auth")
def google_auth_user_level(user=Depends(verify_token)):
    """
    Start Google Calendar OAuth for the user (not per-agent).
    Use this during agent creation before agent exists.
    """
    user_id = user["id"]
    
    try:
        # Use agent_id = 0 as placeholder, will be updated later
        auth_url = get_google_oauth_url(agent_id=0, user_id=user_id)
        return {"auth_url": auth_url}
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/google/status")
def google_status_user_level(user=Depends(verify_token)):
    """
    Check if user has connected Google Calendar.
    Returns the credentials that can be assigned to any agent.
    """
    user_id = user["id"]
    
    creds = get_user_google_credentials(user_id)
    
    return {
        "connected": bool(creds),
        "has_credentials": bool(creds)
    }


@router.post("/agents/{agent_id}/google/assign")
def assign_calendar_to_agent(agent_id: int, user=Depends(verify_token)):
    """
    Assign user's Google Calendar credentials to an agent.
    Use this after creating an agent to enable calendar features.
    """
    user_id = user["id"]
    
    # Verify user owns this agent
    agent = get_agent(user_id, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    success = assign_google_calendar_to_agent(user_id, agent_id)
    
    if not success:
        raise HTTPException(status_code=400, detail="No Google credentials found. Connect calendar first.")
    
    return {"ok": True, "assigned": True}


# ========== Usage & Billing Endpoints ==========

@router.get("/usage/current")
def get_current_usage(user=Depends(verify_token)):
    """Get current month's usage for the logged-in user"""
    user_id = user["id"]
    usage = get_user_usage(user_id)
    return usage


@router.get("/usage/history")
def get_usage_history(user=Depends(verify_token), month: Optional[str] = None):
    """Get usage for a specific month (YYYY-MM format)"""
    user_id = user["id"]
    usage = get_user_usage(user_id, month=month)
    return usage


@router.get("/usage/calls")
def get_calls(user=Depends(verify_token), limit: int = 50):
    """Get recent call history"""
    user_id = user["id"]
    calls = get_call_history(user_id, limit=limit)
    return {"calls": calls}


# ========== Credits System Endpoints ==========

@router.get("/credits/balance")
def get_credits_balance(user=Depends(verify_token)):
    """Get user's current credit balance"""
    user_id = user["id"]
    credits = get_user_credits(user_id)
    return credits


@router.post("/credits/purchase")
def purchase_credits(payload: PurchaseCreditsRequest, user=Depends(verify_token)):
    """
    DEPRECATED: Use Stripe payment flow instead.
    This endpoint should NOT be called directly from frontend.
    Credits are added automatically via Stripe webhook after successful payment.
    """
    raise HTTPException(
        status_code=400, 
        detail="Direct credit purchase is not allowed. Please use the Stripe payment flow via /credits/create-payment-intent"
    )


@router.get("/credits/transactions")
def get_transactions(user=Depends(verify_token), limit: int = 50):
    """Get credit transaction history"""
    user_id = user["id"]
    transactions = get_credit_transactions(user_id, limit=limit)
    return {"transactions": transactions}


@router.get("/credits/status")
def get_credits_status(user=Depends(verify_token)):
    """Get credit balance with low balance warning"""
    user_id = user["id"]
    credits = get_user_credits(user_id)
    
    # Determine status
    balance = credits["balance"]
    status = "good"
    warning = None
    
    if balance <= 0:
        status = "out"
        warning = "Your credits have run out. Add credits immediately to keep your agents working."
    elif balance < 5:
        status = "low"
        warning = "Low balance! You have less than $5 remaining. Add credits soon."
    elif balance < 10:
        status = "medium"
        warning = "Your balance is getting low. Consider adding more credits."
    
    return {
        "balance": balance,
        "total_purchased": credits["total_purchased"],
        "total_used": credits["total_used"],
        "status": status,
        "warning": warning
    }


@router.post("/credits/create-payment-intent")
def create_payment_intent(payload: PurchaseCreditsRequest, user=Depends(verify_token)):
    """Create Stripe payment intent for credit purchase"""
    user_id = user["id"]
    amount_cents = int(payload.amount * 100)  # Convert to cents
    
    try:
        # Create Stripe payment intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            metadata={
                "user_id": user_id,
                "credit_amount": payload.amount
            },
            description=f"Purchase ${payload.amount} in credits"
        )
        
        return {
            "client_secret": intent.client_secret,
            "amount": payload.amount
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment failed: {str(e)}")


@router.post("/credits/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")
    
    # Handle successful payment
    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        user_id = int(payment_intent["metadata"]["user_id"])
        credit_amount = float(payment_intent["metadata"]["credit_amount"])
        
        # Add credits to user's account
        add_credits(
            user_id,
            credit_amount,
            f"Credit purchase via Stripe - ${credit_amount} (Transaction: {payment_intent['id']})"
        )
        
        print(f"✅ Added ${credit_amount} credits to user {user_id}")
    
    return {"ok": True}


# ========== Phone Number Management ==========

@router.post("/phone/search")
def search_available_numbers(payload: PurchaseNumberRequest, user=Depends(verify_token)):
    """
    Search for available Twilio numbers (BEFORE creating agent)
    """
    if not twilio_client:
        raise HTTPException(
            status_code=503, 
            detail="Twilio not configured. Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to environment variables."
        )
    
    try:
        # Search for available numbers
        search_params = {
            "limit": 10
        }
        
        if payload.area_code:
            search_params["area_code"] = payload.area_code
        
        if payload.contains:
            search_params["contains"] = payload.contains
        
        available_numbers = twilio_client.available_phone_numbers(payload.country).local.list(**search_params)
        
        results = [
            {
                "phone_number": num.phone_number,
                "friendly_name": num.friendly_name,
                "locality": num.locality,
                "region": num.region,
                "monthly_cost": 1.15  # Twilio's base cost
            }
            for num in available_numbers
        ]
        
        return {
            "available_numbers": results,
            "monthly_cost": 1.15  # What customer pays (Twilio's cost, no markup)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/phone/purchase")
def purchase_phone_number(payload: PurchaseNumberRequest, user=Depends(verify_token)):
    """
    Purchase a Twilio phone number (BEFORE creating agent)
    Returns the number so it can be used when creating the agent
    
    IMPORTANT: Immediately deducts $1.15 from customer's credits
    """
    if not twilio_client:
        raise HTTPException(status_code=503, detail="Twilio not configured")
    
    user_id = user["id"]
    
    # Check if user has enough credits BEFORE purchasing
    credits = get_user_credits(user_id)
    if credits["balance"] < 1.15:
        raise HTTPException(
            status_code=402,  # Payment Required
            detail=f"Insufficient credits. You have ${credits['balance']:.2f}, need $1.15. Please add credits first."
        )
    
    try:
        # Search for available numbers
        search_params = {"limit": 1}
        
        if payload.area_code:
            search_params["area_code"] = payload.area_code
        
        if payload.contains:
            search_params["contains"] = payload.contains
        
        available_numbers = twilio_client.available_phone_numbers(payload.country).local.list(**search_params)
        
        if not available_numbers:
            raise HTTPException(status_code=404, detail="No numbers available with those criteria")
        
        # Purchase the number from Twilio
        purchased_number = twilio_client.incoming_phone_numbers.create(
            phone_number=available_numbers[0].phone_number,
            voice_url=f"{BACKEND_URL}/incoming-call",
            voice_method="POST",
            friendly_name=f"User {user_id} - Reserved"  # Mark as reserved until agent is created
        )
        
        # Deduct $1.15 from customer's credits immediately
        print(f"💰 Attempting to deduct $1.15 from user {user_id}")
        deduct_result = deduct_credits(
            user_id=user_id,
            amount=1.15,
            description=f"Phone number purchase: {purchased_number.phone_number}"
        )
        print(f"💰 Deduct result: {deduct_result}")
        
        if not deduct_result["success"]:
            # If deduction fails, release the number we just purchased
            print(f"❌ Credit deduction failed: {deduct_result}")
            try:
                twilio_client.incoming_phone_numbers(purchased_number.sid).delete()
            except:
                pass  # Best effort cleanup
            
            raise HTTPException(
                status_code=500,
                detail=f"Credit deduction failed: {deduct_result.get('error')}"
            )
        
        print(f"✅ Successfully deducted $1.15, new balance: ${deduct_result['balance']}")
        
        return {
            "success": True,
            "phone_number": purchased_number.phone_number,
            "twilio_sid": purchased_number.sid,
            "friendly_name": purchased_number.friendly_name,
            "monthly_cost": 1.15,
            "charged_now": 1.15,
            "new_balance": deduct_result["balance"],
            "message": f"Phone number {purchased_number.phone_number} purchased! $1.15 deducted from your credits. New balance: ${deduct_result['balance']:.2f}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Purchase failed: {str(e)}")


@router.post("/phone/release/{twilio_sid}")
def release_phone_number_by_sid(twilio_sid: str, user=Depends(verify_token)):
    """
    Release a Twilio number that was purchased but not used
    (In case user changes their mind before creating agent)
    
    NOTE: No refund given - Twilio doesn't refund us either
    
    Use the twilio_sid from the purchase response or my-numbers list
    """
    if not twilio_client:
        raise HTTPException(status_code=503, detail="Twilio not configured")
    
    user_id = user["id"]
    
    try:
        # Verify this number belongs to the user before deleting
        number = twilio_client.incoming_phone_numbers(twilio_sid).fetch()
        
        # Check if it's the user's number (by friendly name)
        if not (number.friendly_name and f"User {user_id}" in number.friendly_name):
            raise HTTPException(status_code=403, detail="You don't own this phone number")
        
        phone_number = number.phone_number
        
        # Release the Twilio number (no refund - Twilio doesn't refund us)
        twilio_client.incoming_phone_numbers(twilio_sid).delete()
        
        return {
            "success": True,
            "message": f"Phone number {phone_number} released successfully.",
            "phone_number": phone_number
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Release failed: {str(e)}")


@router.delete("/phone/release")
def release_phone_number_by_number(phone_number: str, user=Depends(verify_token)):
    """
    Release a phone number by its phone number (e.g., +17045551234)
    Alternative to using twilio_sid
    
    NOTE: No refund given - Twilio doesn't refund us either
    """
    if not twilio_client:
        raise HTTPException(status_code=503, detail="Twilio not configured")
    
    user_id = user["id"]
    
    try:
        # Find all numbers belonging to this user
        all_numbers = twilio_client.incoming_phone_numbers.list()
        
        matching_number = None
        for num in all_numbers:
            if num.phone_number == phone_number and f"User {user_id}" in (num.friendly_name or ""):
                matching_number = num
                break
        
        if not matching_number:
            raise HTTPException(status_code=404, detail="Phone number not found or doesn't belong to you")
        
        # Release it (no refund - Twilio doesn't refund us)
        twilio_client.incoming_phone_numbers(matching_number.sid).delete()
        
        return {
            "success": True,
            "message": f"Phone number {phone_number} released successfully.",
            "phone_number": phone_number
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Release failed: {str(e)}")


@router.get("/phone/my-numbers")
def get_my_purchased_numbers(user=Depends(verify_token)):
    """
    Get all phone numbers purchased by this user (from Twilio)
    Useful to show numbers that are available to assign to agents
    """
    if not twilio_client:
        raise HTTPException(status_code=503, detail="Twilio not configured")
    
    user_id = user["id"]
    
    try:
        # Get all numbers
        all_numbers = twilio_client.incoming_phone_numbers.list()
        
        # Filter to user's numbers (those with their user_id in friendly_name)
        user_numbers = [
            {
                "phone_number": num.phone_number,
                "twilio_sid": num.sid,
                "friendly_name": num.friendly_name,
                "monthly_cost": 1.15  # Twilio's cost, no markup
            }
            for num in all_numbers
            if f"User {user_id}" in (num.friendly_name or "")
        ]
        
        return {
            "numbers": user_numbers,
            "count": len(user_numbers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch numbers: {str(e)}")


@router.delete("/agents/{agent_id}/phone/release")
def release_agent_phone_number(agent_id: int, user=Depends(verify_token)):
    """
    Release the Twilio number from an agent
    (Keeps the number in Twilio, just removes from agent)
    """
    if not twilio_client:
        raise HTTPException(status_code=503, detail="Twilio not configured")
    
    user_id = user["id"]
    agent = get_agent(user_id, agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not agent.get("twilio_number_sid"):
        raise HTTPException(status_code=404, detail="Agent has no phone number")
    
    try:
        # Just clear from agent record, keep number in Twilio
        update_agent(user_id, agent_id, phone_number=None, twilio_number_sid=None)
        
        # Update friendly name to show it's available again
        twilio_client.incoming_phone_numbers(agent["twilio_number_sid"]).update(
            friendly_name=f"User {user_id} - Available"
        )
        
        return {
            "success": True,
            "message": "Phone number removed from agent (still in your account)"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Release failed: {str(e)}")


@router.get("/agents/{agent_id}/phone/status")
def get_phone_number_status(agent_id: int, user=Depends(verify_token)):
    """
    Get phone number status for an agent
    """
    user_id = user["id"]
    agent = get_agent(user_id, agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {
        "has_number": bool(agent.get("phone_number")),
        "phone_number": agent.get("phone_number"),
        "twilio_sid": agent.get("twilio_number_sid"),
        "monthly_cost": 1.15 if agent.get("phone_number") else 0.00
    }


# ========== Call Detail Breakdown ==========

@router.get("/usage/call-details/{call_id}")
def get_call_details(call_id: int, user=Depends(verify_token)):
    """
    Get detailed cost breakdown for a specific call
    Shows what customer was charged for each service provider
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    # Get call details
    cur.execute(sql("""
        SELECT 
            cu.*,
            a.name as agent_name,
            a.provider as ai_provider
        FROM call_usage cu
        LEFT JOIN agents a ON cu.agent_id = a.id
        WHERE cu.id = {PH} AND cu.user_id = {PH}
    """), (call_id, user_id))
    
    row = cur.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    
    # Convert to dict
    call = dict(row)
    
    # Get values
    duration_minutes = round(call.get("duration_seconds", 0) / 60.0, 2)
    total_revenue = call.get("revenue_usd", 0) or 0
    ai_provider = call.get("ai_provider") or "OpenAI"
    
    # Calculate breakdown
    # Twilio phone cost: $0.0085/min (your cost) * 2 (markup) = $0.017/min customer pays
    twilio_cost = duration_minutes * 0.017
    
    # OpenAI cost: remainder
    openai_cost = total_revenue - twilio_cost
    
    # Build simple breakdown
    breakdown = {
        "call_id": call_id,
        "agent_name": call.get("agent_name"),
        "call_sid": call.get("call_sid"),
        "duration_seconds": call.get("duration_seconds", 0),
        "duration_minutes": duration_minutes,
        "started_at": str(call.get("started_at")),
        "ended_at": str(call.get("ended_at")),
        
        "total_charged": round(total_revenue, 2),
        
        "breakdown": [
            {
                "provider": ai_provider,
                "description": "AI voice processing (speech recognition, voice synthesis, conversation)",
                "cost": round(openai_cost, 4),
                "percentage": round((openai_cost / total_revenue * 100) if total_revenue > 0 else 0, 1)
            },
            {
                "provider": "Twilio",
                "description": "Phone line service",
                "cost": round(twilio_cost, 4),
                "percentage": round((twilio_cost / total_revenue * 100) if total_revenue > 0 else 0, 1)
            }
        ],
        
        "summary": {
            "ai_service": round(openai_cost, 2),
            "phone_service": round(twilio_cost, 2),
            "total": round(total_revenue, 2)
        }
    }
    
    return breakdown


# ========== AI Prompt Generator ==========

class GeneratePromptRequest(BaseModel):
    business_name: str
    business_type: Optional[str] = "general"
    services: Optional[str] = None
    hours: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None

class GeneratePromptAIRequest(BaseModel):
    business_name: str
    business_type: Optional[str] = "general"
    business_description: Optional[str] = None
    services: Optional[str] = None
    tone: Optional[str] = "professional"
    special_instructions: Optional[str] = None
    hours: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None

@router.post("/agents/generate-prompt")
def generate_ai_prompt(payload: GeneratePromptRequest, user=Depends(verify_token)):
    """
    Generate a complete structured system prompt with 12 sections
    """
    business_name = payload.business_name
    business_type = payload.business_type or "general"
    
    # Role templates
    role_templates = {
        "salon": "professional receptionist at a barbershop/salon",
        "restaurant": "friendly host at a restaurant",
        "medical": "professional medical receptionist",
        "retail": "helpful customer service representative",
        "professional": "professional office assistant",
        "general": "professional customer service representative"
    }
    
    # Service templates
    service_templates = {
        "salon": "haircuts, styling, coloring, treatments",
        "restaurant": "dining reservations, takeout orders, catering",
        "medical": "appointment scheduling, prescription refills, general inquiries",
        "retail": "product information, orders, returns, support",
        "professional": "consultations, appointments, general inquiries",
        "general": "inquiries, appointments, and general assistance"
    }
    
    # Goal templates - more versatile
    goal_templates = {
        "salon": "Schedule appointments efficiently, answer questions about services, and handle cancellations/rescheduling",
        "restaurant": "Take food orders, make reservations, answer menu questions, provide hours and location info, and handle delivery/pickup requests",
        "medical": "Schedule appointments, handle prescription requests, triage urgent matters, and provide general office information",
        "retail": "Take orders over the phone, answer product questions, check inventory, process returns, and provide shipping information",
        "professional": "Schedule consultations, answer service questions, collect client information, and coordinate meetings",
        "general": "Assist customers with their requests, provide information, take orders or bookings, and ensure excellent service"
    }
    
    # Required info templates - varies by business type
    required_info_templates = {
        "salon": """**When Scheduling Appointments, Always Collect:**

1. **Customer's Full Name**
2. **Phone Number** (for confirmation/callback)
3. **Preferred Date & Time**
4. **Type of Service** requested
5. **Special Requirements** (if any)

**Important:** Confirm all details before finalizing the appointment.""",
        
        "restaurant": """**When Taking Orders, Always Collect:**

1. **Customer's Name**
2. **Phone Number** (for order confirmation)
3. **Order Details** (items, quantities, special requests)
4. **Calculate Total:**
   - Subtotal (sum of all items)
   - Tax (calculate based on local tax rate - typically 7-10%)
   - Delivery fee (if applicable, typically $3-5)
   - **Final Total** (subtotal + tax + delivery fee)
5. **Pickup or Delivery** preference
6. **Delivery Address** (if delivery)
7. **Preferred Time** for pickup/delivery
8. **Payment Method** - Ask: "Will this be cash or card?"
9. **If Paying by Card:**
   - Card Number (16 digits)
   - Expiration Date (MM/YY)
   - CVV (3-digit security code)
   - Billing ZIP Code

**When Making Reservations, Collect:**

1. **Customer's Name**
2. **Phone Number**
3. **Party Size** (number of people)
4. **Date & Time** preference
5. **Special Requests** (outdoor seating, high chair, etc.)

**Important:** 
- Always break down costs: "Your subtotal is $22.00, plus $1.98 tax and $3.00 delivery, for a total of $26.98"
- Repeat the complete order details for confirmation
- Confirm total amount before collecting card info
- Read back card number for verification
- Reassure customer about secure payment processing""",
        
        "medical": """**When Scheduling Appointments, Always Collect:**

1. **Patient's Full Name**
2. **Date of Birth**
3. **Phone Number**
4. **Reason for Visit**
5. **Preferred Date & Time**
6. **Insurance Information** (if new patient)

**Important:** Confirm all details and note any urgent symptoms.""",
        
        "retail": """**When Taking Orders, Always Collect:**

1. **Customer's Name**
2. **Phone Number**
3. **Email Address** (for order confirmation)
4. **Product Details** (item name, size, color, quantity)
5. **Shipping Address** (if applicable)
6. **Calculate Total:**
   - Product price
   - Shipping cost (if applicable)
   - Tax (calculate based on shipping state tax rate - typically 5-10%)
   - **Final Total**
7. **Payment Method** - Ask: "How would you like to pay for this?"
8. **If Paying by Card:**
   - Card Number (16 digits)
   - Expiration Date (MM/YY)
   - CVV (3-digit security code)
   - Billing ZIP Code
   - Cardholder Name

**When Answering Product Questions:**
• Provide accurate inventory status
• Explain product features clearly
• Suggest alternatives if item unavailable

**Important:** 
- Break down costs: "The shoes are $89.99, plus $8.00 shipping and $7.84 tax, for a total of $105.83"
- Confirm order details and total amount
- Verify card information by reading it back
- Provide order number and estimated delivery date
- Reassure customer about secure payment processing""",
        
        "professional": """**When Scheduling Consultations, Always Collect:**

1. **Client's Full Name**
2. **Phone Number** and **Email**
3. **Preferred Date & Time**
4. **Nature of Consultation**
5. **Any Preparation Needed**

**Important:** Confirm meeting details and send calendar invite if possible.""",
        
        "general": """**When Assisting Customers, Collect Relevant Information:**

1. **Customer's Name**
2. **Contact Information** (phone and/or email)
3. **Specific Request** details
4. **Preferred Date/Time** (if scheduling)
5. **Any Special Requirements**

**Important:** Adapt based on the customer's needs - appointments, orders, inquiries, etc."""
    }
    
    # Business-specific examples
    examples_by_type = {
        "salon": """**Common Interactions:**

• Customer calls to book a haircut → Schedule appointment, collect required info
• Customer asks about pricing → Provide service pricing or offer to connect with staff
• Customer wants to reschedule → Get current appointment, offer new times
• Customer asks what services you offer → List available services clearly""",
        
        "restaurant": """**Common Interactions:**

• Customer calls to place a pickup order → Take full order details, calculate total, collect payment card info, confirm order
• Customer wants to make a reservation → Collect party size, date/time, contact info
• Customer asks about menu items → Answer questions about ingredients, preparation, pricing
• Customer wants delivery → Get delivery address, take order, collect payment, confirm delivery time
• Customer asks about hours or location → Provide accurate information

**Example Order Flow (Pickup):**
1. Take order: "I'll have a large pepperoni pizza and garlic bread"
2. Calculate and announce total: "That's a large pepperoni pizza at $18.00 and garlic bread at $4.50. Your subtotal is $22.50, plus $2.03 tax, for a total of $24.53"
3. Ask for payment: "How would you like to pay for this? Cash or card?"
4. If card, collect: "I'll need your card number, expiration date, CVV, and billing ZIP code"
5. Verify: "Let me read that back - card ending in 1234, expires 05/27?"
6. Confirm: "Perfect! Your total of $24.53 has been processed. Your order will be ready for pickup in 20 minutes"

**Example Order Flow (Delivery):**
1. Take order: "I'd like a large cheese pizza delivered"
2. Get address: "What's your delivery address?"
3. Calculate with delivery fee: "That's a large cheese pizza at $16.00. Your subtotal is $16.00, plus $1.44 tax and $4.00 delivery fee, for a total of $21.44"
4. Collect payment and confirm: "I'll need your card information... Perfect! Your order will be delivered to [address] in 35-45 minutes" """,
        
        "medical": """**Common Interactions:**

• Patient calls to schedule appointment → Collect patient info, reason for visit, schedule appropriately
• Patient needs prescription refill → Get patient name, medication details, forward to appropriate staff
• Patient has urgent symptoms → Triage urgency, connect to nurse or doctor immediately if needed
• New patient calling → Collect full patient information, explain new patient process""",
        
        "retail": """**Common Interactions:**

• Customer wants to buy a product → Take order details, calculate total, collect payment card info, confirm order
• Customer asks if item is in stock → Check inventory or offer to connect with staff
• Customer wants to return item → Collect order details, explain return policy, assist with process
• Customer has product questions → Provide detailed information, suggest alternatives if needed

**Example Order Flow:**
1. Identify product: "I'd like to order the blue running shoes in size 10"
2. Confirm availability and price: "Great! We have those in stock. They're $89.99"
3. Collect shipping: "What's your shipping address?"
4. Calculate total with tax: "The shoes are $89.99, standard shipping is $8.00, and tax is $7.84 based on your state. Your total is $105.83"
5. Ask for payment: "How would you like to pay?"
6. Collect card info: "I'll need your card number, expiration, CVV, and billing ZIP"
7. Verify and confirm: "Perfect! Your order #12345 totaling $105.83 has been processed. It will arrive in 5-7 business days" """,
        
        "professional": """**Common Interactions:**

• Client wants to schedule consultation → Collect contact info, understand their needs, schedule meeting
• Client asks about services → Explain what you offer, pricing structure, process
• Client wants to reschedule → Get current appointment, offer alternatives
• New client inquiry → Gather information, explain how you work, schedule initial consultation""",
        
        "general": """**Common Interactions:**

• Customer needs to schedule/book something → Collect necessary details, confirm availability
• Customer wants information → Provide accurate answers, offer to connect with staff if needed
• Customer wants to place order → Take complete order details, confirm everything
• Customer has a question → Answer clearly, escalate if beyond your knowledge"""
    }
    
    examples = examples_by_type.get(business_type, examples_by_type["general"])
    
    # Get values for templates
    role = role_templates.get(business_type, role_templates["general"])
    services = payload.services or service_templates.get(business_type, service_templates["general"])
    goals = goal_templates.get(business_type, goal_templates["general"])
    required_info = required_info_templates.get(business_type, required_info_templates["general"])
    
    # Format business info cleanly
    business_info_lines = [f"**Business Name:** {business_name}"]
    if payload.phone_number:
        business_info_lines.append(f"**Phone:** {payload.phone_number}")
    if payload.address:
        business_info_lines.append(f"**Location:** {payload.address}")
    if payload.hours:
        business_info_lines.append(f"**Hours:** {payload.hours}")
    else:
        business_info_lines.append(f"**Hours:** Monday-Friday 9am-6pm, Saturday 10am-4pm")
    
    business_info = "\n".join(business_info_lines)
    
    # Build after-hours section
    if payload.hours:
        after_hours_header = f"**If Called Outside Business Hours ({payload.hours}):**"
        after_hours_hours = f"Our hours are {payload.hours}."
    else:
        after_hours_header = "**If Called Outside Regular Business Hours:**"
        after_hours_hours = ""
    
    after_hours_message = f'''> "Thank you for calling {business_name}. You've reached us outside of our normal business hours. {after_hours_hours}
>
> I can still help you with:
> • Scheduling an appointment for when we're open
> • Answering general questions about our services  
> • Taking a message for our team
>
> How would you like to proceed?"'''
    
    prompt = f"""# SYSTEM PROMPT FOR {business_name.upper()}


## CRITICAL INSTRUCTION
**When a call connects, IMMEDIATELY greet the caller using the greeting in Section 2. Do not wait for the caller to speak first. Start every call with the greeting.**


## 1. ROLE

You are a **{role}**.

**Your Primary Responsibilities:**
• Handle incoming phone calls professionally and efficiently
• Provide excellent customer service
• Manage appointments and inquiries
• Represent {business_name} with warmth and professionalism


## 2. GREETING

**IMPORTANT: This is the FIRST thing you say when the call connects. Say this immediately without waiting for the caller to speak first.**

**Initial Call Greeting (say this first):**
> "Thank you for calling {business_name}! This is your AI assistant. How may I help you today?"

**Returning Caller Greeting (if they provide their name):**
> "Welcome back to {business_name}, [Name]! How can I assist you today?"


## 3. TONE & COMMUNICATION STYLE

Maintain the following communication standards:

• **Professional** yet friendly and approachable
• **Patient** and understanding with all callers
• **Clear** and concise in your explanations
• **Warm** and welcoming in your demeanor
• **Helpful** and solution-oriented in your approach
• **Adaptive** - adjust formality based on the caller's tone


## 4. SERVICES

**{business_name} offers the following services:**

{services}

**When Discussing Services:**
• Provide clear, accurate information
• Explain options when relevant
• Suggest appropriate services based on customer needs
• **Never** make up information about services not listed


## 5. GOALS & OBJECTIVES

**Your Primary Goals:**

• {goals}
• Provide accurate information about services and pricing
• Collect necessary information for appointments
• Create positive customer experiences
• Handle objections professionally
• Route complex issues to appropriate staff members


## 6. REQUIRED INFORMATION

{required_info}


## 7. BUSINESS INFORMATION

{business_info}


## 8. COMMON INTERACTIONS

{examples}


## 9. FAQ HANDLING RULES

**Common Questions & How to Handle Them:**

### Pricing Inquiries
• If you have specific pricing information, provide it clearly
• If pricing varies by service, explain:
  > "Pricing depends on the specific service. I can connect you with our team for an accurate quote."

### Availability Questions
• Check calendar if tool is available
• If unsure, respond with:
  > "Let me check our availability. What dates work best for you?"

### Location & Directions
• Provide the address if available
• Offer to text or email directions if needed

### Service Details
• Explain available services clearly
• Recommend based on customer needs
• **Never** invent or assume services not explicitly listed

### Cancellation & Rescheduling
• Be understanding and helpful
• Collect current appointment details
• Offer alternative times that work for the customer


## 10. ESCALATION PROTOCOL

**Transfer to a Human Representative When:**

• Customer is upset, frustrated, or angry
• Complex technical issues arise
• Pricing negotiations are needed
• Emergency or urgent medical matters occur (if medical office)
• You lack the information the customer needs
• Customer explicitly requests to speak with a person
• Situation is beyond your capabilities

**Escalation Script:**
> "I understand this requires additional assistance. Let me connect you with the appropriate team member who can better help you with this."


## 11. AFTER-HOURS PROTOCOL

{after_hours_header}

{after_hours_message}


## 12. CONSTRAINTS & LIMITATIONS

**You MUST:**
• Always be honest about your capabilities as an AI
• Confirm all important details (dates, times, names, orders)
• Collect required information before finalizing anything
• Maintain caller privacy and confidentiality
• Be transparent when you don't have information
• **When collecting payment card information:**
  - Speak clearly and slowly
  - Read back the card number for verification
  - Reassure customer about secure payment processing
  - Confirm the total amount before collecting payment details

**You MUST NOT:**
• Make up services, prices, or policies
• Make medical diagnoses (if applicable)
• Guarantee specific outcomes
• Share other customers' information
• Pretend to be a human employee
• Make promises you cannot keep
• Be rude, dismissive, or rush the caller
• Process payments without confirming the total amount first


## 13. CALL ENDING SCRIPTS & SMS CONFIRMATIONS

**IMPORTANT: After collecting payment card details, you MUST use process_payment tool to charge the card!**

**After Taking an Order:**
1. Confirm all order details
2. Calculate total with tax and fees
3. Ask for payment method
4. **If paying by card:**
   - Collect: card number, expiration (MM/YY), CVV, billing ZIP
   - **USE process_payment tool** to charge the card
   - Wait for confirmation
   - If successful, say: "Perfect! Your payment of $[amount] has been processed. Card ending in [last 4 digits]."
   - If failed, say: "I'm sorry, that card was declined. Do you have another card to try?"
5. **USE send_order_confirmation tool** to send SMS with order details
6. Then say: "Your order will be ready for [pickup/delivery] at [time]. You should receive a confirmation text shortly."

**After Scheduling an Appointment:**
1. Confirm appointment details
2. **USE send_appointment_confirmation tool** to send SMS
3. Then say: "Great! You're all set for [service] on [date] at [time]. You'll receive a confirmation text shortly."

**After Providing Information:**
> "I'm glad I could help! Is there anything else you'd like to know about {business_name}?"

**Before Transferring:**
> "I'm connecting you now. Please hold for just a moment."

**General Closing:**
> "Thank you for calling {business_name}! We look forward to serving you. Have a great day!"


## AVAILABLE TOOLS

You have access to the following capabilities:
• **process_payment** - Process credit card payments through Square (USE AFTER COLLECTING CARD INFO)
• **send_order_confirmation** - Send SMS confirmation after taking an order (USE AFTER PAYMENT)
• **send_appointment_confirmation** - Send SMS confirmation after booking appointment
• **log_call_summary** - Log what was accomplished during the call (USE BEFORE ENDING THE CALL)
• Calendar checking and appointment scheduling
• Basic information lookup

**IMPORTANT:** 
- Always use process_payment when customer provides card details
- Always use SMS confirmation tools after completing orders or appointments
- Always use log_call_summary before saying goodbye to record what happened


## FINAL REMINDER

Your mission is to represent **{business_name}** professionally, handle calls efficiently, and create positive experiences that make customers want to return.

**Be helpful. Be honest. Be friendly.**
"""
    
    return {
        "success": True,
        "prompt": prompt,
        "business_name": business_name,
        "business_type": business_type,
        "sections": [
            "1. ROLE",
            "2. GREETING",
            "3. TONE",
            "4. SERVICES",
            "5. GOALS",
            "6. REQUIRED INFO",
            "7. BUSINESS INFO",
            "8. FAQ RULES",
            "9. ESCALATION",
            "10. AFTER HOURS",
            "11. CONSTRAINTS",
            "12. ENDING SCRIPT"
        ]
    }


# ========== AI-Powered Prompt Generator (Using Claude) ==========

@router.post("/agents/generate-prompt-ai")
def generate_ai_prompt_with_claude(payload: GeneratePromptAIRequest, user=Depends(verify_token)):
    """
    Generate a custom system prompt using Claude AI
    
    This creates a high-quality, tailored prompt based on business details
    """
    import anthropic
    import os
    
    # Check if Anthropic API key is configured
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI prompt generation not configured. Please contact support."
        )
    
    try:
        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        
        # Build the generation prompt
        generation_prompt = f"""You are an expert at creating system prompts for voice AI phone assistants.

Create a professional, natural system prompt for a voice AI with these details:

**Business Information:**
- Business Name: {payload.business_name}
- Business Type: {payload.business_type}
- Description: {payload.business_description or 'Not provided'}
- Services/Products: {payload.services or 'General services'}
- Desired Tone: {payload.tone}
- Hours: {payload.hours or 'Not specified'}
- Phone: {payload.phone_number or 'Not specified'}
- Address: {payload.address or 'Not specified'}

**Special Instructions:**
{payload.special_instructions or 'None'}

**CRITICAL REQUIREMENTS:**

1. **Keep it SHORT** - Maximum 300 words total. Be concise.

2. **GREETING Section** - Must say EXACTLY what to say when call connects:
   - Simple and warm: "Hello, thanks for calling [Business Name]! How can I help you?"
   - IMPORTANT: After greeting, the AI must WAIT for the caller to speak first

3. **CONVERSATION FLOW** - The AI should:
   - Listen to what the caller wants BEFORE offering anything
   - Respond naturally to their specific request
   - NOT assume what they need or push specific services
   - Let the CALLER lead the conversation

4. **TONE** - Match the "{payload.tone}" tone naturally without being robotic

5. **KEEP IT FLEXIBLE** - Don't create rigid scripts or mandatory objectives
   - The AI should adapt to what each caller needs
   - Don't force appointment scheduling or information collection unless the caller requests it

**Format:**
Use simple markdown sections (## headers). Include only:
- ## YOUR ROLE (1-2 sentences)
- ## GREETING (exact words to say)
- ## HOW TO RESPOND (3-5 bullet points about being natural, helpful, and caller-focused)
- ## BUSINESS INFO (brief: hours, services, key details)

**What NOT to include:**
- Long example conversations
- Rigid "PRIMARY OBJECTIVES" that force specific actions
- Detailed "INFORMATION COLLECTION" requirements
- Complex escalation protocols
- Anything that makes the AI pushy or scripted

Generate a SHORT, NATURAL, FLEXIBLE system prompt now:"""
        
        # Call Claude API
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4000,
            messages=[
                {"role": "user", "content": generation_prompt}
            ]
        )
        
        # Extract the generated prompt
        generated_prompt = message.content[0].text
        
        return {
            "success": True,
            "prompt": generated_prompt,
            "business_name": payload.business_name,
            "business_type": payload.business_type,
            "tone": payload.tone,
            "model_used": "claude-sonnet-4",
            "tokens_used": message.usage.input_tokens + message.usage.output_tokens
        }
        
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI generation failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating prompt: {str(e)}"
        )


# ========== AI Prompt Refinement Endpoint ==========

class RefinePromptRequest(BaseModel):
    current_prompt: str
    refinement_instructions: str
    
    # Add validators to ensure fields aren't empty
    class Config:
        json_schema_extra = {
            "example": {
                "current_prompt": "Your current system prompt here...",
                "refinement_instructions": "Make it more friendly"
            }
        }

@router.post("/agents/refine-prompt-ai")
async def refine_prompt_with_ai(payload: RefinePromptRequest, user=Depends(verify_token)):
    """
    Refine an existing prompt based on user instructions
    
    Example instructions:
    - "Make it more friendly"
    - "Add a section about handling complaints"  
    - "Make it shorter and more concise"
    - "Add examples for appointment scheduling"
    """
    import anthropic
    import os
    import logging
    
    logger = logging.getLogger("main")
    
    logger.info(f"🎨 Refine request received:")
    logger.info(f"   Current prompt length: {len(payload.current_prompt)}")
    logger.info(f"   Instructions: {payload.refinement_instructions[:100] if len(payload.refinement_instructions) > 100 else payload.refinement_instructions}")
    
    # Validate inputs
    if not payload.current_prompt or not payload.current_prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="current_prompt is required and cannot be empty"
        )
    
    if not payload.refinement_instructions or not payload.refinement_instructions.strip():
        raise HTTPException(
            status_code=400,
            detail="refinement_instructions is required and cannot be empty"
        )

    # Check if Anthropic API key is configured
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI prompt refinement not configured. Please contact support."
        )
    
    try:
        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        
        # Build the refinement prompt
        refinement_prompt = f"""You are an expert at refining system prompts for voice AI agents.

Here is the CURRENT PROMPT:

---
{payload.current_prompt}
---

USER'S REFINEMENT REQUEST:
{payload.refinement_instructions}

Please refine the prompt based on the user's request. Keep the overall structure and format, but apply the requested changes. Maintain the professional quality and voice-optimized nature of the prompt.

Return the complete refined prompt:"""
        
        # Call Claude API
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4000,
            messages=[
                {"role": "user", "content": refinement_prompt}
            ]
        )
        
        # Extract the refined prompt
        refined_prompt = message.content[0].text
        
        return {
            "success": True,
            "prompt": refined_prompt,
            "original_length": len(payload.current_prompt),
            "refined_length": len(refined_prompt),
            "model_used": "claude-sonnet-4",
            "tokens_used": message.usage.input_tokens + message.usage.output_tokens
        }
        
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI refinement failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error refining prompt: {str(e)}"
        )


# ========== Legacy Prompt Generate Endpoint (for compatibility) ==========

@router.post("/prompt/generate")
def generate_prompt_legacy(payload: GeneratePromptRequest, user=Depends(verify_token)):
    """
    Legacy endpoint - redirects to new generate-prompt
    """
    return generate_ai_prompt(payload, user)


# ========== Slack Integration ==========

from slack_integration import (
    notify_new_call,
    notify_call_ended,
    notify_appointment_scheduled,
    notify_order_placed,
    notify_escalation,
    notify_low_credits
)

class SlackConfigRequest(BaseModel):
    slack_bot_token: str
    slack_default_channel: str = "#calls"
    slack_enabled: bool = True

@router.post("/slack/configure")
def configure_slack(payload: SlackConfigRequest, user=Depends(verify_token)):
    """
    Configure Slack integration for user
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    # Add columns if they don't exist (migration)
    from db import add_column_if_missing
    add_column_if_missing(conn, 'users', 'slack_bot_token', 'TEXT')
    add_column_if_missing(conn, 'users', 'slack_default_channel', 'TEXT')
    add_column_if_missing(conn, 'users', 'slack_enabled', 'BOOLEAN DEFAULT FALSE')
    
    cur.execute(sql("""
        UPDATE users
        SET slack_bot_token = {PH},
            slack_default_channel = {PH},
            slack_enabled = {PH}
        WHERE id = {PH}
    """), (payload.slack_bot_token, payload.slack_default_channel, payload.slack_enabled, user_id))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "Slack configured successfully",
        "channel": payload.slack_default_channel
    }


@router.get("/slack/status")
def get_slack_status(user=Depends(verify_token)):
    """
    Check if Slack is configured for this user
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            SELECT slack_enabled, slack_default_channel
            FROM users
            WHERE id = {PH}
        """), (user_id,))
        
        row = cur.fetchone()
    except:
        # Columns don't exist yet
        conn.close()
        return {"configured": False}
    
    conn.close()
    
    if not row:
        return {"configured": False}
    
    if isinstance(row, dict):
        enabled = row.get('slack_enabled')
        channel = row.get('slack_default_channel')
    else:
        enabled = row[0] if row else False
        channel = row[1] if len(row) > 1 else None
    
    return {
        "configured": bool(enabled),
        "channel": channel or "#calls"
    }


@router.post("/slack/test")
def test_slack_notification(user=Depends(verify_token)):
    """
    Send a test notification to Slack
    """
    user_id = user["id"]
    
    # Get user's Slack token
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            SELECT slack_bot_token, slack_default_channel
            FROM users
            WHERE id = {PH}
        """), (user_id,))
        
        row = cur.fetchone()
        conn.close()
        
        if not row:
            return {"success": False, "error": "Slack not configured"}
        
        if isinstance(row, dict):
            token = row.get('slack_bot_token')
            channel = row.get('slack_default_channel') or "#calls"
        else:
            token = row[0]
            channel = row[1] if len(row) > 1 else "#calls"
        
        if not token:
            return {"success": False, "error": "Slack token not found"}
        
        # Send test notification
        result = notify_new_call(
            agent_name="Test Agent",
            caller_number="+1-555-TEST",
            channel=channel,
            token=token
        )
        
        return result
        
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}


@router.post("/slack/disable")
def disable_slack(user=Depends(verify_token)):
    """
    Disable Slack notifications
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            UPDATE users
            SET slack_enabled = FALSE
            WHERE id = {PH}
        """), (user_id,))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Slack notifications disabled"}
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}


# ========== Microsoft Teams Integration ==========

from teams_integration import (
    notify_new_call_teams,
    notify_call_ended_teams,
    notify_appointment_scheduled_teams,
    notify_order_placed_teams,
    notify_escalation_teams,
    notify_low_credits_teams
)

class TeamsConfigRequest(BaseModel):
    teams_webhook_url: str
    teams_enabled: bool = True

@router.post("/teams/configure")
def configure_teams(payload: TeamsConfigRequest, user=Depends(verify_token)):
    """
    Configure Microsoft Teams integration for user
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    # Add columns if they don't exist (migration)
    from db import add_column_if_missing
    add_column_if_missing(conn, 'users', 'teams_webhook_url', 'TEXT')
    add_column_if_missing(conn, 'users', 'teams_enabled', 'BOOLEAN DEFAULT FALSE')
    
    cur.execute(sql("""
        UPDATE users
        SET teams_webhook_url = {PH},
            teams_enabled = {PH}
        WHERE id = {PH}
    """), (payload.teams_webhook_url, payload.teams_enabled, user_id))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "Microsoft Teams configured successfully"
    }


@router.get("/teams/status")
def get_teams_status(user=Depends(verify_token)):
    """
    Check if Teams is configured for this user
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            SELECT teams_enabled
            FROM users
            WHERE id = {PH}
        """), (user_id,))
        
        row = cur.fetchone()
    except:
        # Columns don't exist yet
        conn.close()
        return {"configured": False}
    
    conn.close()
    
    if not row:
        return {"configured": False}
    
    if isinstance(row, dict):
        enabled = row.get('teams_enabled')
    else:
        enabled = row[0] if row else False
    
    return {"configured": bool(enabled)}


@router.post("/teams/test")
def test_teams_notification(user=Depends(verify_token)):
    """
    Send a test notification to Microsoft Teams
    """
    user_id = user["id"]
    
    # Get user's Teams webhook
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            SELECT teams_webhook_url
            FROM users
            WHERE id = {PH}
        """), (user_id,))
        
        row = cur.fetchone()
        conn.close()
        
        if not row:
            return {"success": False, "error": "Teams not configured"}
        
        if isinstance(row, dict):
            webhook_url = row.get('teams_webhook_url')
        else:
            webhook_url = row[0]
        
        if not webhook_url:
            return {"success": False, "error": "Webhook URL not found"}
        
        # Send test notification
        result = notify_new_call_teams(
            webhook_url=webhook_url,
            agent_name="Test Agent",
            caller_number="+1-555-TEST"
        )
        
        return result
        
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}


@router.post("/teams/disable")
def disable_teams(user=Depends(verify_token)):
    """
    Disable Teams notifications
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            UPDATE users
            SET teams_enabled = FALSE
            WHERE id = {PH}
        """), (user_id,))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Teams notifications disabled"}
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}


# ========== Square Payment Integration ==========

from square_integration import create_payment, create_customer, get_payment, refund_payment, list_payments

class SquareConfigRequest(BaseModel):
    square_access_token: str
    square_environment: str = "sandbox"  # 'sandbox' or 'production'

class SquarePaymentRequest(BaseModel):
    amount: float  # Dollar amount (e.g., 29.99)
    card_number: str
    exp_month: str
    exp_year: str
    cvv: str
    postal_code: str
    customer_name: Optional[str] = None
    description: Optional[str] = None
    reference_id: Optional[str] = None

@router.post("/square/configure")
def configure_square(payload: SquareConfigRequest, user=Depends(verify_token)):
    """
    Configure Square integration for user
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    # Add columns if they don't exist
    from db import add_column_if_missing
    add_column_if_missing(conn, 'users', 'square_access_token', 'TEXT')
    add_column_if_missing(conn, 'users', 'square_environment', 'TEXT')
    add_column_if_missing(conn, 'users', 'square_enabled', 'BOOLEAN DEFAULT FALSE')
    
    cur.execute(sql("""
        UPDATE users
        SET square_access_token = {PH},
            square_environment = {PH},
            square_enabled = TRUE
        WHERE id = {PH}
    """), (payload.square_access_token, payload.square_environment, user_id))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "Square configured successfully",
        "environment": payload.square_environment
    }


@router.get("/square/status")
def get_square_status(user=Depends(verify_token)):
    """
    Check if Square is configured
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            SELECT square_enabled, square_environment
            FROM users
            WHERE id = {PH}
        """), (user_id,))
        
        row = cur.fetchone()
    except:
        conn.close()
        return {"configured": False}
    
    conn.close()
    
    if not row:
        return {"configured": False}
    
    if isinstance(row, dict):
        enabled = row.get('square_enabled')
        environment = row.get('square_environment')
    else:
        enabled = row[0] if row else False
        environment = row[1] if len(row) > 1 else None
    
    return {
        "configured": bool(enabled),
        "environment": environment or "sandbox"
    }


@router.post("/square/test-payment")
def test_square_payment(user=Depends(verify_token)):
    """
    Test Square payment with test card
    """
    # Square test card: 4111 1111 1111 1111
    result = create_payment(
        amount_cents=100,  # $1.00
        card_number="4111111111111111",
        exp_month="12",
        exp_year="2025",
        cvv="123",
        postal_code="94103",
        customer_name="Test User",
        description="Test payment"
    )
    
    return result


@router.get("/square/payments")
def list_square_payments(user=Depends(verify_token), limit: int = 10):
    """
    List recent Square payments
    """
    result = list_payments(limit=limit)
    return result


@router.post("/square/refund/{payment_id}")
def refund_square_payment(payment_id: str, user=Depends(verify_token), amount: Optional[float] = None):
    """
    Refund a Square payment (full or partial)
    """
    amount_cents = int(amount * 100) if amount else None
    result = refund_payment(
        payment_id=payment_id,
        amount_cents=amount_cents,
        reason="Customer refund request"
    )
    return result


@router.post("/square/disable")
def disable_square(user=Depends(verify_token)):
    """
    Disable Square payments
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            UPDATE users
            SET square_enabled = FALSE
            WHERE id = {PH}
        """), (user_id,))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Square payments disabled"}
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}


# ========== ElevenLabs Voice Integration ==========

from elevenlabs_integration import get_available_voices

class ElevenLabsConfigRequest(BaseModel):
    elevenlabs_api_key: str

@router.post("/elevenlabs/configure")
def configure_elevenlabs(payload: ElevenLabsConfigRequest, user=Depends(verify_token)):
    """
    Configure ElevenLabs integration for user
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    # Add columns if they don't exist
    from db import add_column_if_missing
    add_column_if_missing(conn, 'users', 'elevenlabs_api_key', 'TEXT')
    add_column_if_missing(conn, 'users', 'elevenlabs_enabled', 'BOOLEAN DEFAULT FALSE')
    
    cur.execute(sql("""
        UPDATE users
        SET elevenlabs_api_key = {PH},
            elevenlabs_enabled = TRUE
        WHERE id = {PH}
    """), (payload.elevenlabs_api_key, user_id))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "ElevenLabs configured successfully"
    }


@router.get("/elevenlabs/status")
def get_elevenlabs_status(user=Depends(verify_token)):
    """
    Check if ElevenLabs is configured
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            SELECT elevenlabs_enabled
            FROM users
            WHERE id = {PH}
        """), (user_id,))
        
        row = cur.fetchone()
    except:
        conn.close()
        return {"configured": False}
    
    conn.close()
    
    if not row:
        return {"configured": False}
    
    if isinstance(row, dict):
        enabled = row.get('elevenlabs_enabled')
    else:
        enabled = row[0] if row else False
    
    return {"configured": bool(enabled)}


@router.get("/elevenlabs/voices")
def list_elevenlabs_voices(user=Depends(verify_token)):
    """
    List available ElevenLabs voices
    """
    result = get_available_voices()
    return result


@router.get("/elevenlabs/popular-voices")
def list_popular_voices():
    """
    Get list of popular pre-made voices
    """
    from elevenlabs_integration import POPULAR_VOICES
    return {
        "success": True,
        "voices": POPULAR_VOICES
    }


@router.get("/elevenlabs/subscription")
def get_elevenlabs_subscription(user=Depends(verify_token)):
    """
    Get ElevenLabs subscription info
    """
    from elevenlabs_integration import get_user_subscription
    result = get_user_subscription()
    return result


@router.post("/elevenlabs/disable")
def disable_elevenlabs(user=Depends(verify_token)):
    """
    Disable ElevenLabs
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            UPDATE users
            SET elevenlabs_enabled = FALSE
            WHERE id = {PH}
        """), (user_id,))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "ElevenLabs disabled"}
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}


@router.put("/agents/{agent_id}/voice")
def set_agent_voice(agent_id: int, payload: dict, user=Depends(verify_token)):
    """
    Set voice for an agent (OpenAI or ElevenLabs)
    
    Body:
    {
        "voice_provider": "openai" or "elevenlabs",
        "elevenlabs_voice_id": "voice_id" (if using ElevenLabs),
        "voice_id": "voice_id" (alternative field name),
        "openai_voice": "alloy" (if using OpenAI)
    }
    """
    from db import get_conn, sql
    import logging
    
    logger = logging.getLogger("main")
    
    conn = get_conn()
    cur = conn.cursor()
    
    # Verify agent belongs to user
    user_id = user["id"]
    cur.execute(sql("""
        SELECT id FROM agents 
        WHERE id = {PH} AND owner_user_id = {PH}
    """), (agent_id, user_id))
    
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get voice provider
    voice_provider = payload.get("voice_provider", "openai")
    
    # Handle different field names for voice ID
    elevenlabs_voice_id = (
        payload.get("elevenlabs_voice_id") or 
        payload.get("voice_id") or 
        None
    )
    
    openai_voice = payload.get("openai_voice") or "alloy"
    
    logger.info(f"🎙️ Voice update request:")
    logger.info(f"   Payload: {payload}")
    logger.info(f"   Provider: {voice_provider}")
    logger.info(f"   ElevenLabs ID: {elevenlabs_voice_id}")
    logger.info(f"   OpenAI voice: {openai_voice}")
    
    # If using ElevenLabs, make sure we have a voice ID
    if voice_provider == "elevenlabs" and not elevenlabs_voice_id:
        conn.close()
        raise HTTPException(
            status_code=400, 
            detail="elevenlabs_voice_id is required when using ElevenLabs"
        )
    
    # Update voice settings
    # When using ElevenLabs, set voice to None (it uses elevenlabs_voice_id)
    # When using OpenAI, set elevenlabs_voice_id to None (it uses voice)
    if voice_provider == "elevenlabs":
        logger.info(f"🔄 Updating to ElevenLabs: {elevenlabs_voice_id}")
        cur.execute(sql("""
            UPDATE agents
            SET voice_provider = {PH},
                elevenlabs_voice_id = {PH},
                voice = NULL
            WHERE id = {PH}
        """), (voice_provider, elevenlabs_voice_id, agent_id))
    else:  # OpenAI
        logger.info(f"🔄 Updating to OpenAI: {openai_voice}")
        cur.execute(sql("""
            UPDATE agents
            SET voice_provider = {PH},
                elevenlabs_voice_id = NULL,
                voice = {PH}
            WHERE id = {PH}
        """), (voice_provider, openai_voice, agent_id))
    
    conn.commit()
    
    # Verify the update by reading back
    cur.execute(sql("""
        SELECT voice_provider, elevenlabs_voice_id, voice 
        FROM agents 
        WHERE id = {PH}
    """), (agent_id,))
    
    updated = cur.fetchone()
    logger.info(f"✅ Voice updated - Verification:")
    
    # Handle both dict (PostgreSQL) and tuple (SQLite)
    if isinstance(updated, dict):
        logger.info(f"   voice_provider: {updated.get('voice_provider')}")
        logger.info(f"   elevenlabs_voice_id: {updated.get('elevenlabs_voice_id')}")
        logger.info(f"   voice: {updated.get('voice')}")
    else:
        logger.info(f"   voice_provider: {updated[0]}")
        logger.info(f"   elevenlabs_voice_id: {updated[1]}")
        logger.info(f"   voice: {updated[2]}")
    
    conn.close()
    
    return {
        "success": True,
        "message": "Voice updated",
        "voice_provider": voice_provider,
        "elevenlabs_voice_id": elevenlabs_voice_id if voice_provider == "elevenlabs" else None,
        "openai_voice": openai_voice if voice_provider == "openai" else None
    }


class VADSettingsRequest(BaseModel):
    threshold: Optional[float] = 0.7  # 0.0-1.0
    silence_duration_ms: Optional[int] = 800  # milliseconds

@router.put("/agents/{agent_id}/vad-settings")
def update_agent_vad_settings(agent_id: int, payload: VADSettingsRequest, user=Depends(verify_token)):
    """
    Update Voice Activity Detection settings for noise suppression
    
    threshold: 0.5 (sensitive) to 0.9 (very strict)
    silence_duration_ms: 500-1500ms (how long to wait before ending turn)
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    # Verify agent belongs to user
    cur.execute(sql("""
        SELECT id FROM agents 
        WHERE id = {PH} AND owner_user_id = {PH}
    """), (agent_id, user_id))
    
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Add columns if they don't exist
    from db import add_column_if_missing
    add_column_if_missing(conn, 'agents', 'vad_threshold', 'REAL')
    add_column_if_missing(conn, 'agents', 'vad_silence_duration_ms', 'INTEGER')
    
    # Validate ranges
    threshold = max(0.0, min(1.0, payload.threshold))
    silence_ms = max(200, min(2000, payload.silence_duration_ms))
    
    # Update settings
    cur.execute(sql("""
        UPDATE agents
        SET vad_threshold = {PH},
            vad_silence_duration_ms = {PH}
        WHERE id = {PH}
    """), (threshold, silence_ms, agent_id))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "VAD settings updated",
        "threshold": threshold,
        "silence_duration_ms": silence_ms,
        "note": "Higher threshold = less sensitive to noise. Longer silence = fewer interruptions."
    }


@router.get("/agents/{agent_id}/vad-settings")
def get_agent_vad_settings(agent_id: int, user=Depends(verify_token)):
    """
    Get current VAD settings for agent
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        SELECT vad_threshold, vad_silence_duration_ms
        FROM agents 
        WHERE id = {PH} AND owner_user_id = {PH}
    """), (agent_id, user_id))
    
    row = cur.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if isinstance(row, dict):
        threshold = row.get('vad_threshold') or 0.7
        silence_ms = row.get('vad_silence_duration_ms') or 800
    else:
        threshold = row[0] if row[0] else 0.7
        silence_ms = row[1] if row[1] else 800
    
    # Provide recommendations based on current settings
    if threshold < 0.6:
        noise_level = "Quiet environment (very sensitive)"
    elif threshold < 0.75:
        noise_level = "Normal environment (balanced)"
    else:
        noise_level = "Noisy environment (strict filtering)"
    
    return {
        "threshold": threshold,
        "silence_duration_ms": silence_ms,
        "noise_level": noise_level,
        "recommendations": {
            "quiet_office": {"threshold": 0.5, "silence_duration_ms": 600},
            "normal": {"threshold": 0.7, "silence_duration_ms": 800},
            "noisy_background": {"threshold": 0.8, "silence_duration_ms": 1000},
            "very_noisy": {"threshold": 0.85, "silence_duration_ms": 1200}
        }
    }


# ========== Auto-Recharge ==========

from auto_recharge import check_and_auto_recharge, save_payment_method_for_auto_recharge

class AutoRechargeConfigRequest(BaseModel):
    enabled: bool
    amount: Optional[float] = 10.00  # Default $10
    payment_method_id: Optional[str] = None  # Stripe payment method ID

@router.post("/credits/auto-recharge/configure")
def configure_auto_recharge(payload: AutoRechargeConfigRequest, user=Depends(verify_token)):
    """
    Enable/disable auto-recharge and set amount
    """
    user_id = user["id"]
    
    from db import get_conn, sql, add_column_if_missing
    conn = get_conn()
    cur = conn.cursor()
    
    # Add columns if they don't exist
    add_column_if_missing(conn, 'users', 'auto_recharge_enabled', 'BOOLEAN DEFAULT FALSE')
    add_column_if_missing(conn, 'users', 'auto_recharge_amount', 'REAL DEFAULT 10.0')
    add_column_if_missing(conn, 'users', 'stripe_customer_id', 'TEXT')
    add_column_if_missing(conn, 'users', 'stripe_payment_method_id', 'TEXT')
    
    # If enabling and payment method provided, save it
    if payload.enabled and payload.payment_method_id:
        result = save_payment_method_for_auto_recharge(user_id, payload.payment_method_id)
        if not result["success"]:
            conn.close()
            return {"success": False, "error": result["error"]}
    
    # Update settings
    cur.execute(sql("""
        UPDATE users
        SET auto_recharge_enabled = {PH},
            auto_recharge_amount = {PH}
        WHERE id = {PH}
    """), (payload.enabled, payload.amount, user_id))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "Auto-recharge configured",
        "enabled": payload.enabled,
        "amount": payload.amount,
        "threshold": 2.00
    }


@router.get("/credits/auto-recharge/status")
def get_auto_recharge_status(user=Depends(verify_token)):
    """
    Get auto-recharge settings
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            SELECT auto_recharge_enabled, auto_recharge_amount, stripe_payment_method_id
            FROM users
            WHERE id = {PH}
        """), (user_id,))
        
        row = cur.fetchone()
    except:
        conn.close()
        return {
            "enabled": False,
            "amount": 10.00,
            "threshold": 2.00,
            "has_payment_method": False
        }
    
    conn.close()
    
    if not row:
        return {
            "enabled": False,
            "amount": 10.00,
            "threshold": 2.00,
            "has_payment_method": False
        }
    
    if isinstance(row, dict):
        enabled = row.get('auto_recharge_enabled') or False
        amount = row.get('auto_recharge_amount') or 10.00
        has_pm = bool(row.get('stripe_payment_method_id'))
    else:
        enabled = row[0] if len(row) > 0 else False
        amount = row[1] if len(row) > 1 else 10.00
        has_pm = bool(row[2]) if len(row) > 2 else False
    
    return {
        "enabled": enabled,
        "amount": amount,
        "threshold": 2.00,
        "has_payment_method": has_pm
    }


@router.post("/credits/auto-recharge/test")
def test_auto_recharge(user=Depends(verify_token)):
    """
    Test auto-recharge (for testing only - manually triggers)
    """
    user_id = user["id"]
    
    # Get current balance
    from db import get_user_credits
    credits = get_user_credits(user_id)
    
    # Trigger auto-recharge check
    result = check_and_auto_recharge(user_id, credits["balance"])
    
    return result


# ========== Shopify Integration ==========

from shopify_integration import (
    get_products, search_products, create_order, 
    get_product_variants, check_inventory, get_order_status
)

class ShopifyConfigRequest(BaseModel):
    shop_name: str  # e.g., "my-store" (without .myshopify.com)
    access_token: str

@router.post("/shopify/configure")
def configure_shopify(payload: ShopifyConfigRequest, user=Depends(verify_token)):
    """
    Configure Shopify integration
    """
    user_id = user["id"]
    
    from db import get_conn, sql, add_column_if_missing
    conn = get_conn()
    cur = conn.cursor()
    
    # Add columns
    add_column_if_missing(conn, 'users', 'shopify_shop_name', 'TEXT')
    add_column_if_missing(conn, 'users', 'shopify_access_token', 'TEXT')
    add_column_if_missing(conn, 'users', 'shopify_enabled', 'BOOLEAN DEFAULT FALSE')
    
    # Test connection by fetching products
    test_result = get_products(payload.shop_name, payload.access_token, limit=1)
    
    if not test_result.get("success"):
        conn.close()
        return {
            "success": False,
            "error": f"Failed to connect to Shopify: {test_result.get('error')}"
        }
    
    # Save credentials
    cur.execute(sql("""
        UPDATE users
        SET shopify_shop_name = {PH},
            shopify_access_token = {PH},
            shopify_enabled = TRUE
        WHERE id = {PH}
    """), (payload.shop_name, payload.access_token, user_id))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "Shopify connected successfully",
        "shop_name": payload.shop_name,
        "product_count": test_result.get("count", 0)
    }


@router.get("/shopify/status")
def get_shopify_status(user=Depends(verify_token)):
    """
    Check if Shopify is configured
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            SELECT shopify_enabled, shopify_shop_name
            FROM users
            WHERE id = {PH}
        """), (user_id,))
        
        row = cur.fetchone()
    except:
        conn.close()
        return {"configured": False}
    
    conn.close()
    
    if not row:
        return {"configured": False}
    
    if isinstance(row, dict):
        enabled = row.get('shopify_enabled')
        shop_name = row.get('shopify_shop_name')
    else:
        enabled = row[0] if row else False
        shop_name = row[1] if len(row) > 1 else None
    
    return {
        "configured": bool(enabled),
        "shop_name": shop_name
    }


@router.get("/shopify/products")
def list_shopify_products(user=Depends(verify_token), limit: int = 50):
    """
    Get products from Shopify store
    """
    user_id = user["id"]
    
    # Get Shopify credentials
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(sql("""
        SELECT shopify_shop_name, shopify_access_token
        FROM users WHERE id = {PH}
    """), (user_id,))
    
    row = cur.fetchone()
    conn.close()
    
    if not row:
        return {"success": False, "error": "Shopify not configured"}
    
    if isinstance(row, dict):
        shop_name = row.get('shopify_shop_name')
        access_token = row.get('shopify_access_token')
    else:
        shop_name = row[0]
        access_token = row[1]
    
    if not shop_name or not access_token:
        return {"success": False, "error": "Shopify credentials missing"}
    
    result = get_products(shop_name, access_token, limit)
    return result


@router.post("/shopify/disable")
def disable_shopify(user=Depends(verify_token)):
    """
    Disable Shopify integration
    """
    user_id = user["id"]
    
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            UPDATE users
            SET shopify_enabled = FALSE
            WHERE id = {PH}
        """), (user_id,))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Shopify disabled"}
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}


# ========== Password Reset ==========

from password_reset import create_password_reset_request, verify_reset_token, reset_password_with_token

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    """
    Request password reset (no authentication required)
    """
    result = create_password_reset_request(payload.email)
    
    # Always return success to not reveal if email exists
    return {
        "success": True,
        "message": "If that email exists, a reset link has been sent to your inbox."
    }


@router.post("/auth/verify-reset-token")
def verify_reset_token_endpoint(token: str):
    """
    Verify if reset token is valid (no authentication required)
    """
    result = verify_reset_token(token)
    
    if result.get("valid"):
        return {
            "valid": True,
            "email": result.get("email")
        }
    else:
        return {
            "valid": False,
            "error": result.get("error")
        }


@router.post("/auth/reset-password")
def reset_password(payload: ResetPasswordRequest):
    """
    Reset password with token (no authentication required)
    """
    # Validate password length
    if len(payload.new_password) < 8:
        return {
            "success": False,
            "error": "Password must be at least 8 characters"
        }
    
    result = reset_password_with_token(payload.token, payload.new_password)
    return result


# ========== ADMIN ENDPOINTS ==========

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
    try:
        stats = get_admin_dashboard_stats()
        return stats
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ ADMIN DASHBOARD ERROR: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Admin dashboard error: {str(e)}")


@router.get("/admin/users")
def get_admin_users(user=Depends(verify_admin), limit: int = 100, offset: int = 0):
    """Get all users with statistics"""
    try:
        users = get_all_users(limit=limit, offset=offset)
        return {"users": users, "total": len(users)}
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ ADMIN USERS ERROR: {str(e)}")
        print(f"Full traceback:\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Admin users error: {str(e)}")


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
    from db import get_conn, sql
    
    try:
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute(sql("""
            SELECT
                c.id,
                c.call_sid,
                u.email as user_email,
                c.call_from,
                c.call_to,
                c.duration_seconds,
                c.status,
                c.started_at
            FROM call_usage c
            LEFT JOIN users u ON c.user_id = u.id
            ORDER BY c.started_at DESC
            LIMIT {PH}
        """), (limit,))

        logs = []
        for row in cur.fetchall():
            if isinstance(row, dict):
                logs.append({
                    "id": row['id'],
                    "call_sid": row['call_sid'],
                    "user_email": row['user_email'],
                    "call_from": row['call_from'],
                    "call_to": row['call_to'],
                    "duration_seconds": row['duration_seconds'],
                    "status": row['status'],
                    "created_at": row['started_at'].isoformat() if row['started_at'] else None
                })
            else:
                logs.append({
                    "id": row[0],
                    "call_sid": row[1],
                    "user_email": row[2],
                    "call_from": row[3],
                    "call_to": row[4],
                    "duration_seconds": row[5],
                    "status": row[6],
                    "created_at": row[7].isoformat() if row[7] else None
                })
        
        conn.close()
        return {"logs": logs, "total": len(logs)}
    
    except Exception as e:
        print(f"❌ Failed to get voice chat logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")


@router.post("/admin/users/{user_id}/credits")
def admin_add_credits(user_id: int, amount: float, user=Depends(verify_admin)):
    """Manually add credits to a user (admin only)"""
    from datetime import datetime
    
    try:
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
    requests_list = []
    for row in cur.fetchall():
        if isinstance(row, dict):
            requests_list.append({
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
            requests_list.append({
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
    return {"requests": requests_list}


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


# ========== Website Agent Endpoints ==========

class WebsiteOrderIn(BaseModel):
    # Section 1 – Business info
    full_name: str
    email: str
    phone: Optional[str] = None
    business_name: Optional[str] = None
    business_address: Optional[str] = None
    business_hours: Optional[str] = None
    current_website: Optional[str] = None
    # Section 2 – About
    business_description: Optional[str] = None
    services_offered: Optional[str] = None
    competitive_advantage: Optional[str] = None
    # Section 3 – Goals
    website_goals: Optional[str] = None       # comma-separated
    customer_actions: Optional[str] = None    # comma-separated
    # Section 4 – Services / products
    services_list: Optional[str] = None
    pricing_info: Optional[str] = None
    special_offers: Optional[str] = None
    # Section 5 – Design
    preferred_colors: Optional[str] = None
    website_examples: Optional[str] = None
    has_logo: Optional[str] = "no"
    # Section 6 – Content
    has_photos: Optional[str] = "no"
    # Section 7 – Features
    features_needed: Optional[str] = None     # comma-separated
    # Section 8 – Social media
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_tiktok: Optional[str] = None
    social_google: Optional[str] = None
    # Section 9 – Additional
    additional_notes: Optional[str] = None
    # Uploaded files (base64 data-URLs from browser FileReader)
    logo_data: Optional[str] = None
    logo_filename: Optional[str] = None
    photos_data: Optional[str] = None        # JSON-encoded list of base64 strings
    photos_filenames: Optional[str] = None   # JSON-encoded list of filenames


@router.post("/website-agent/submit")
def submit_website_order(data: WebsiteOrderIn):
    """Save a website order and return a Stripe checkout URL."""
    from db import create_website_order, update_website_order_payment

    order_id = create_website_order(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        business_name=data.business_name,
        business_address=data.business_address,
        business_hours=data.business_hours,
        current_website=data.current_website,
        business_description=data.business_description,
        services_offered=data.services_offered,
        competitive_advantage=data.competitive_advantage,
        website_goals=data.website_goals,
        customer_actions=data.customer_actions,
        services_list=data.services_list,
        pricing_info=data.pricing_info,
        special_offers=data.special_offers,
        preferred_colors=data.preferred_colors,
        website_examples=data.website_examples,
        has_logo=data.has_logo or "no",
        has_photos=data.has_photos or "no",
        features_needed=data.features_needed,
        social_facebook=data.social_facebook,
        social_instagram=data.social_instagram,
        social_tiktok=data.social_tiktok,
        social_google=data.social_google,
        additional_notes=data.additional_notes,
        logo_data=data.logo_data,
        logo_filename=data.logo_filename,
        photos_data=data.photos_data,
        photos_filenames=data.photos_filenames,
    )

    # Create Stripe Embedded Checkout Session (stays on our platform)
    try:
        session = stripe.checkout.Session.create(
            ui_mode="embedded",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": "ISIBI Website Build Service",
                        "description": f"Custom website for {data.business_name or data.full_name}",
                    },
                    "unit_amount": 19999,   # $199.99 in cents
                },
                "quantity": 1,
            }],
            mode="payment",
            return_url=f"https://isibi.ai/website-agent?payment=success&order_id={order_id}&session_id={{CHECKOUT_SESSION_ID}}",
            metadata={"order_id": str(order_id)},
        )
        from db import update_website_order_payment
        update_website_order_payment(order_id, session.id, "pending")
        return {"order_id": order_id, "client_secret": session.client_secret}
    except Exception as e:
        # Fallback: return static Stripe link if embedded checkout fails
        return {"order_id": order_id, "client_secret": None, "checkout_url": "https://buy.stripe.com/aFaaER3zN0ckdGS8taeIw06"}


@router.get("/admin/website-orders")
def admin_get_website_orders(user=Depends(verify_admin), limit: int = 100):
    """Get all website agent order submissions (admin only)."""
    from db import get_all_website_orders
    orders = get_all_website_orders(limit=limit)
    return {"orders": orders, "total": len(orders)}


@router.post("/admin/website-orders/{order_id}/mark-paid")
def admin_mark_order_paid(order_id: int, user=Depends(verify_admin)):
    """Manually mark a website order as paid."""
    from db import update_website_order_payment
    update_website_order_payment(order_id, "ADMIN-MANUAL", "paid")
    return {"ok": True}


@router.post("/admin/website-orders/{order_id}/mark-complete")
def admin_mark_order_complete(order_id: int, user=Depends(verify_admin)):
    """Mark a website order as completed (website delivered)."""
    from db import update_website_order_payment
    update_website_order_payment(order_id, "ADMIN-COMPLETE", "completed")
    return {"ok": True}


# ========== Voice Provider Endpoints ==========

from elevenlabs_integration import get_all_voice_options, get_available_voices, get_user_subscription

@router.get("/voices/providers")
def get_voice_providers(user=Depends(verify_token)):
    """
    Get all available voice providers and their voices
    
    Returns:
        {
            "providers": [
                {
                    "id": "openai",
                    "name": "OpenAI",
                    "voices": [...]
                },
                {
                    "id": "elevenlabs",
                    "name": "ElevenLabs",
                    "voices": [...],
                    "enabled": true/false
                }
            ]
        }
    """
    import os
    
    # Check if ElevenLabs is configured
    elevenlabs_enabled = bool(os.getenv("ELEVENLABS_API_KEY"))
    
    # Get all voices
    all_voices = get_all_voice_options()
    
    providers = [
        {
            "id": "openai",
            "name": "OpenAI",
            "description": "High-quality AI voices with natural speech",
            "enabled": True,
            "voices": all_voices["openai"]
        },
        {
            "id": "elevenlabs",
            "name": "ElevenLabs",
            "description": "Ultra-realistic AI voices with emotion",
            "enabled": elevenlabs_enabled,
            "voices": all_voices["elevenlabs"] if elevenlabs_enabled else []
        }
    ]
    
    return {"providers": providers}


@router.get("/voices/elevenlabs")
def get_elevenlabs_voices(user=Depends(verify_token)):
    """
    Get available ElevenLabs voices
    
    Returns list of ElevenLabs voices with IDs, names, and previews
    """
    import os
    
    if not os.getenv("ELEVENLABS_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs not configured. Please add ELEVENLABS_API_KEY to environment variables."
        )
    
    voices = get_available_voices()
    
    return {
        "voices": voices,
        "count": len(voices)
    }


@router.get("/voices/elevenlabs/subscription")
def get_elevenlabs_subscription_info(user=Depends(verify_token)):
    """
    Get ElevenLabs subscription information
    
    Returns character quota and usage
    """
    import os
    
    if not os.getenv("ELEVENLABS_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs not configured"
        )
    
    subscription = get_user_subscription()
    
    if not subscription:
        raise HTTPException(
            status_code=500,
            detail="Failed to get subscription info"
        )
    
    return subscription


@router.get("/voices/test/{provider}/{voice_id}")
def test_voice(
    provider: str,
    voice_id: str,
    user=Depends(verify_token),
    text: str = "Hello! This is a test of this voice. How do you like it?"
):
    """
    Test a voice by generating sample audio
    
    Args:
        provider: 'openai' or 'elevenlabs'
        voice_id: Voice ID to test
        text: Optional custom text to speak
    
    Returns:
        Audio file download
    """
    from fastapi.responses import Response
    
    if provider == "elevenlabs":
        import os
        if not os.getenv("ELEVENLABS_API_KEY"):
            raise HTTPException(status_code=503, detail="ElevenLabs not configured")
        
        from elevenlabs_integration import text_to_speech
        
        audio = text_to_speech(text, voice_id)
        
        if not audio:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
        
        return Response(
            content=audio,
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename=voice_test_{voice_id}.mp3"}
        )
    
    elif provider == "openai":
        # For OpenAI, we can't easily generate a test without setting up the full Realtime API
        # So we'll just return a success message
        return {
            "success": True,
            "message": f"Voice '{voice_id}' is available. Test it in a real call to hear it.",
            "voice_id": voice_id
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid provider. Use 'openai' or 'elevenlabs'")


# ========== DEVELOPER API ENDPOINTS ==========

import secrets
import hashlib

class CreateAPIKeyRequest(BaseModel):
    name: str
    description: Optional[str] = None

class WebhookRequest(BaseModel):
    url: str
    events: List[str]
    is_active: bool = True

class GeneratePromptFromURLRequest(BaseModel):
    url: str

@router.post("/developer/keys")
def create_api_key(payload: CreateAPIKeyRequest, user=Depends(verify_token)):
    """Generate a new API key for the user"""
    user_id = user["id"]
    
    # Generate a secure random API key
    api_key = f"sk_live_{secrets.token_urlsafe(32)}"
    
    # Hash the key for storage (never store plain text!)
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
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
        api_key[:12],
        datetime.now().isoformat(),
        True
    ))
    
    key_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": "API key created successfully",
        "api_key": api_key,
        "key_id": key_id,
        "warning": "Save this key now - you won't be able to see it again!"
    }

@router.get("/developer/keys")
def list_api_keys(user=Depends(verify_token)):
    """List all API keys for the user"""
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
    
    result_keys = []
    for k in keys:
        if isinstance(k, dict):
            result_keys.append({
                "id": k["id"],
                "name": k["name"],
                "description": k["description"],
                "key_prefix": k["key_prefix"],
                "created_at": k["created_at"],
                "last_used": k["last_used"],
                "is_active": k["is_active"]
            })
        else:
            result_keys.append({
                "id": k[0],
                "name": k[1],
                "description": k[2],
                "key_prefix": k[3],
                "created_at": k[4],
                "last_used": k[5],
                "is_active": k[6]
            })
    
    return {"success": True, "keys": result_keys}

@router.delete("/developer/keys/{key_id}")
def delete_api_key(key_id: int, user=Depends(verify_token)):
    """Delete an API key"""
    user_id = user["id"]
    
    conn = get_conn()
    cur = conn.cursor()
    
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

@router.post("/developer/webhooks")
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

@router.get("/developer/webhooks")
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
    
    result_webhooks = []
    for w in webhooks:
        if isinstance(w, dict):
            result_webhooks.append({
                "id": w["id"],
                "url": w["url"],
                "events": w["events"].split(","),
                "is_active": w["is_active"],
                "created_at": w["created_at"],
                "last_triggered": w["last_triggered"]
            })
        else:
            result_webhooks.append({
                "id": w[0],
                "url": w[1],
                "events": w[2].split(","),
                "is_active": w[3],
                "created_at": w[4],
                "last_triggered": w[5]
            })
    
    return {"success": True, "webhooks": result_webhooks}

@router.delete("/developer/webhooks/{webhook_id}")
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


# ========== WEBSITE TO PROMPT GENERATOR ==========

@router.post("/generate-prompt-from-url")  # alias for older frontend builds (no auth required)
def generate_prompt_from_url_alias(payload: GeneratePromptFromURLRequest):
    return generate_prompt_from_url(payload, user=None)

@router.post("/agents/generate-prompt-from-url")
def generate_prompt_from_url(payload: GeneratePromptFromURLRequest, user=Depends(verify_token)):  # noqa: F811
    """
    Scrape a website and generate a system prompt using Claude
    """
    url = payload.url
    
    if not url:
        raise HTTPException(status_code=400, detail="URL required")
    
    # Add https:// if missing
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    try:
        # 1. Fetch the website with a user agent to avoid blocking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, timeout=15, headers=headers)
        response.raise_for_status()
        
        # 2. Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script, style, and nav elements
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.decompose()
        
        # Get text content
        text = soup.get_text()
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        # Get meta description if available
        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"})
        if meta_tag and meta_tag.get("content"):
            meta_desc = meta_tag.get("content")
        
        # Get title
        title = soup.find("title")
        page_title = title.string if title else ""
        
        # Limit to first 8000 characters to avoid token limits
        website_content = text[:8000]
        
        # 3. Use Claude to generate system prompt
        anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        
        if not anthropic_api_key:
            raise HTTPException(status_code=500, detail="Anthropic API key not configured")
        
        client = Anthropic(api_key=anthropic_api_key)
        
        prompt = f"""Based on this website, create a concise AI phone agent system prompt (max 300 words).

Website URL: {url}
Page Title: {page_title}
Meta Description: {meta_desc}

Website Content:
{website_content}

Create a system prompt for an AI phone receptionist that:
1. Introduces the business by name
2. Describes what the business does (1-2 sentences)
3. Lists key services/products (bullet points if many)
4. Includes business hours if mentioned
5. Includes location/address if mentioned
6. Explains how the AI can help callers (take orders, schedule appointments, answer questions, etc.)
7. Sets the right tone (professional for law firm, friendly for restaurant, etc.)
8. Is under 300 words
9. Uses "You are..." format

DO NOT include:
- Generic AI disclaimers
- Long introductions
- Repetitive information
- Marketing fluff

Make it practical and ready to use."""

        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1500,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        generated_prompt = message.content[0].text.strip()
        
        return {
            "success": True,
            "prompt": generated_prompt,
            "url": url,
            "page_title": page_title,
            "meta_description": meta_desc,
            "preview": website_content[:300]
        }
        
    except requests.Timeout:
        raise HTTPException(status_code=408, detail="Website took too long to respond")
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch website: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating prompt: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# CRM AGENT — CONTACTS API
# ═══════════════════════════════════════════════════════════════════════════════

class ContactIn(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    phone_number: str
    email: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    tags: Optional[list] = None
    notes: Optional[str] = None
    status: Optional[str] = "new_lead"
    disposition: Optional[str] = None
    source: Optional[str] = None
    next_followup: Optional[str] = None

class ContactStatusIn(BaseModel):
    status: str
    disposition: Optional[str] = None

class ContactNoteIn(BaseModel):
    note: str

def _row_to_contact(row) -> dict:
    """Convert a DB row (dict or tuple) to a contact dict."""
    if isinstance(row, dict):
        d = dict(row)
        if d.get("tags") and isinstance(d["tags"], str):
            try:
                import json as _json
                d["tags"] = _json.loads(d["tags"])
            except Exception:
                d["tags"] = [t.strip() for t in d["tags"].split(",") if t.strip()]
        return d
    # Tuple fallback (SQLite)
    cols = ["id","user_id","first_name","last_name","phone_number","email","company",
            "address","tags","notes","status","disposition","source","next_followup",
            "last_contacted","call_count","created_at","updated_at"]
    d = dict(zip(cols, row))
    if d.get("tags") and isinstance(d["tags"], str):
        try:
            import json as _json
            d["tags"] = _json.loads(d["tags"])
        except Exception:
            d["tags"] = [t.strip() for t in d["tags"].split(",") if t.strip()]
    return d

@router.get("/contacts")
def list_contacts(user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        SELECT id, user_id, first_name, last_name, phone_number, email, company,
               address, tags, notes, status, disposition, source, next_followup,
               last_contacted, call_count, created_at, updated_at
        FROM contacts WHERE user_id={PH} ORDER BY created_at DESC
    """), (user["id"],))
    rows = cur.fetchall()
    conn.close()
    return [_row_to_contact(r) for r in rows]

@router.post("/contacts")
def create_contact_endpoint(body: ContactIn, user=Depends(verify_token)):
    from db import get_conn, sql
    import json as _json
    conn = get_conn()
    cur = conn.cursor()
    tags_val = _json.dumps(body.tags) if body.tags else None
    cur.execute(sql("""
        INSERT INTO contacts (user_id, first_name, last_name, phone_number, email, company,
            address, tags, notes, status, disposition, source, next_followup)
        VALUES ({PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH}) RETURNING id
    """), (
        user["id"], body.first_name, body.last_name, body.phone_number,
        body.email, body.company, body.address, tags_val, body.notes,
        body.status or "new_lead", body.disposition, body.source, body.next_followup
    ))
    row = cur.fetchone()
    new_id = row["id"] if isinstance(row, dict) else row[0]
    conn.commit()
    conn.close()
    return {**body.dict(), "id": new_id, "user_id": user["id"]}

@router.patch("/contacts/{contact_id}")
def update_contact_endpoint(contact_id: int, body: ContactIn, user=Depends(verify_token)):
    from db import get_conn, sql
    import json as _json
    conn = get_conn()
    cur = conn.cursor()
    tags_val = _json.dumps(body.tags) if body.tags else None
    cur.execute(sql("""
        UPDATE contacts SET first_name={PH}, last_name={PH}, phone_number={PH}, email={PH},
            company={PH}, address={PH}, tags={PH}, notes={PH}, status={PH}, disposition={PH},
            source={PH}, next_followup={PH}, updated_at=CURRENT_TIMESTAMP
        WHERE id={PH} AND user_id={PH}
    """), (
        body.first_name, body.last_name, body.phone_number, body.email,
        body.company, body.address, tags_val, body.notes, body.status,
        body.disposition, body.source, body.next_followup, contact_id, user["id"]
    ))
    conn.commit()
    conn.close()
    return {**body.dict(), "id": contact_id}

@router.patch("/contacts/{contact_id}/status")
def update_contact_status(contact_id: int, body: ContactStatusIn, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        UPDATE contacts SET status={PH}, disposition={PH},
            last_contacted=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE id={PH} AND user_id={PH}
    """), (body.status, body.disposition, contact_id, user["id"]))
    conn.commit()
    conn.close()
    return {"id": contact_id, "status": body.status, "disposition": body.disposition}

@router.delete("/contacts/{contact_id}")
def delete_contact_endpoint(contact_id: int, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("DELETE FROM contacts WHERE id={PH} AND user_id={PH}"), (contact_id, user["id"]))
    conn.commit()
    conn.close()
    return {"deleted": True}

@router.post("/contacts/import")
def import_contacts_endpoint(body: dict, user=Depends(verify_token)):
    from db import get_conn, sql
    import json as _json
    contacts = body.get("contacts", [])
    created = 0
    errors = 0
    conn = get_conn()
    cur = conn.cursor()
    for c in contacts:
        try:
            cur.execute(sql("""
                INSERT INTO contacts (user_id, first_name, last_name, phone_number,
                    email, company, notes, status)
                VALUES ({PH},{PH},{PH},{PH},{PH},{PH},{PH},'new_lead')
            """), (
                user["id"], c.get("first_name",""), c.get("last_name"),
                c.get("phone_number",""), c.get("email"), c.get("company"), c.get("notes")
            ))
            created += 1
        except Exception:
            errors += 1
    conn.commit()
    conn.close()
    return {"created": created, "errors": errors}

@router.get("/contacts/{contact_id}/notes")
def list_contact_notes(contact_id: int, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        SELECT id, note, created_at FROM contact_notes
        WHERE contact_id={PH} AND user_id={PH} ORDER BY created_at DESC
    """), (contact_id, user["id"]))
    rows = cur.fetchall()
    conn.close()
    if rows and isinstance(rows[0], dict):
        return [dict(r) for r in rows]
    return [{"id": r[0], "note": r[1], "created_at": str(r[2])} for r in rows]

@router.post("/contacts/{contact_id}/notes")
def add_contact_note(contact_id: int, body: ContactNoteIn, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        INSERT INTO contact_notes (contact_id, user_id, note) VALUES ({PH},{PH},{PH}) RETURNING id, created_at
    """), (contact_id, user["id"], body.note))
    row = cur.fetchone()
    note_id = row["id"] if isinstance(row, dict) else row[0]
    created_at = row["created_at"] if isinstance(row, dict) else row[1]
    cur.execute(sql("UPDATE contacts SET last_contacted=CURRENT_TIMESTAMP WHERE id={PH} AND user_id={PH}"), (contact_id, user["id"]))
    conn.commit()
    conn.close()
    return {"id": note_id, "note": body.note, "created_at": str(created_at)}


# ── Contact Calls ─────────────────────────────────────────────────────────────

@router.get("/contacts/{contact_id}/calls")
def list_contact_calls(contact_id: int, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    # Get contact phone number
    cur.execute(sql("SELECT phone_number FROM contacts WHERE id={PH} AND user_id={PH}"), (contact_id, user["id"]))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Contact not found")
    phone = row["phone_number"] if isinstance(row, dict) else row[0]
    # Normalize phone for matching (strip spaces/dashes)
    cur.execute(sql("""
        SELECT c.id, c.call_sid, c.call_from, c.call_to, c.duration_seconds,
               c.cost_usd, c.revenue_usd, c.status, c.started_at, c.ended_at,
               a.name as agent_name
        FROM call_usage c
        LEFT JOIN agents a ON c.agent_id = a.id
        WHERE c.user_id={PH} AND (
            REPLACE(REPLACE(c.call_from,' ',''),'-','') LIKE {PH}
            OR REPLACE(REPLACE(c.call_to,' ',''),'-','') LIKE {PH}
        )
        ORDER BY c.started_at DESC
        LIMIT 100
    """), (user["id"], f"%{phone.replace(' ','').replace('-','')}%", f"%{phone.replace(' ','').replace('-','')}%"))
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r) if isinstance(r, dict) else {
            "id": r[0], "call_sid": r[1], "call_from": r[2], "call_to": r[3],
            "duration_seconds": r[4], "cost_usd": r[5], "revenue_usd": r[6],
            "status": r[7], "started_at": r[8], "ended_at": r[9], "agent_name": r[10]
        }
        if d.get("started_at") and not isinstance(d["started_at"], str):
            d["started_at"] = str(d["started_at"])
        if d.get("ended_at") and not isinstance(d["ended_at"], str):
            d["ended_at"] = str(d["ended_at"])
        result.append(d)
    return result


# ── Contact SMS ───────────────────────────────────────────────────────────────

class SMSIn(BaseModel):
    message: str

@router.get("/contacts/{contact_id}/sms")
def list_contact_sms(contact_id: int, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT phone_number FROM contacts WHERE id={PH} AND user_id={PH}"), (contact_id, user["id"]))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Contact not found")
    phone = row["phone_number"] if isinstance(row, dict) else row[0]

    messages = []

    # Fetch from Twilio if available
    if twilio_client:
        try:
            twilio_msgs = twilio_client.messages.list(to=phone, limit=50)
            for m in twilio_msgs:
                messages.append({
                    "id": m.sid,
                    "direction": "inbound" if m.direction == "inbound" else "outbound",
                    "message": m.body,
                    "status": m.status,
                    "twilio_sid": m.sid,
                    "created_at": str(m.date_created),
                    "source": "twilio"
                })
            twilio_msgs2 = twilio_client.messages.list(from_=phone, limit=50)
            for m in twilio_msgs2:
                if not any(x["twilio_sid"] == m.sid for x in messages):
                    messages.append({
                        "id": m.sid,
                        "direction": "outbound" if m.direction == "outbound" else "inbound",
                        "message": m.body,
                        "status": m.status,
                        "twilio_sid": m.sid,
                        "created_at": str(m.date_created),
                        "source": "twilio"
                    })
        except Exception as e:
            print(f"Twilio SMS fetch error: {e}")

    # Also fetch from our DB
    cur.execute(sql("""
        SELECT id, direction, message, twilio_sid, status, created_at
        FROM contact_sms WHERE contact_id={PH} AND user_id={PH}
        ORDER BY created_at DESC LIMIT 100
    """), (contact_id, user["id"]))
    for r in cur.fetchall():
        d = dict(r) if isinstance(r, dict) else {
            "id": r[0], "direction": r[1], "message": r[2],
            "twilio_sid": r[3], "status": r[4], "created_at": r[5]
        }
        if not any(x.get("twilio_sid") == d.get("twilio_sid") and d.get("twilio_sid") for x in messages):
            d["source"] = "db"
            messages.append(d)

    conn.close()
    messages.sort(key=lambda x: str(x.get("created_at", "")))
    return messages

@router.post("/contacts/{contact_id}/sms")
def send_contact_sms(contact_id: int, body: SMSIn, user=Depends(verify_token)):
    from db import get_conn, sql, PH
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT phone_number FROM contacts WHERE id={PH} AND user_id={PH}"), (contact_id, user["id"]))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Contact not found")
    phone = row["phone_number"] if isinstance(row, dict) else row[0]

    twilio_sid = None
    status = "sent"

    if twilio_client:
        try:
            # Get first available Twilio number for this user
            numbers = twilio_client.incoming_phone_numbers.list(limit=1)
            from_number = numbers[0].phone_number if numbers else None
            if from_number:
                msg = twilio_client.messages.create(body=body.message, from_=from_number, to=phone)
                twilio_sid = msg.sid
                status = msg.status
        except Exception as e:
            print(f"Twilio SMS send error: {e}")
            status = "failed"

    cur.execute(sql("""
        INSERT INTO contact_sms (contact_id, user_id, direction, message, twilio_sid, status)
        VALUES ({PH},{PH},'outbound',{PH},{PH},{PH})
    """), (contact_id, user["id"], body.message, twilio_sid, status))
    sms_id = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": sms_id, "direction": "outbound", "message": body.message, "twilio_sid": twilio_sid, "status": status}


# ── Contact Emails ────────────────────────────────────────────────────────────

class EmailIn(BaseModel):
    subject: str
    body: str
    direction: Optional[str] = "outbound"
    from_address: Optional[str] = None
    to_address: Optional[str] = None

@router.get("/contacts/{contact_id}/emails")
def list_contact_emails(contact_id: int, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT id FROM contacts WHERE id={PH} AND user_id={PH}"), (contact_id, user["id"]))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Contact not found")
    cur.execute(sql("""
        SELECT id, direction, subject, body, from_address, to_address, status, created_at
        FROM contact_emails WHERE contact_id={PH} AND user_id={PH}
        ORDER BY created_at ASC
    """), (contact_id, user["id"]))
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r) if isinstance(r, dict) else {
            "id": r[0], "direction": r[1], "subject": r[2], "body": r[3],
            "from_address": r[4], "to_address": r[5], "status": r[6], "created_at": r[7]
        }
        if d.get("created_at") and not isinstance(d["created_at"], str):
            d["created_at"] = str(d["created_at"])
        result.append(d)
    return result

@router.post("/contacts/{contact_id}/emails")
def add_contact_email(contact_id: int, body: EmailIn, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    # Verify contact ownership
    cur.execute(sql("SELECT email FROM contacts WHERE id={PH} AND user_id={PH}"), (contact_id, user["id"]))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Contact not found")
    contact_email = row["email"] if isinstance(row, dict) else row[0]

    to_addr = body.to_address or contact_email
    cur.execute(sql("""
        INSERT INTO contact_emails (contact_id, user_id, direction, subject, body, from_address, to_address, status)
        VALUES ({PH},{PH},{PH},{PH},{PH},{PH},{PH},'sent')
    """), (contact_id, user["id"], body.direction, body.subject, body.body, body.from_address, to_addr))
    email_id = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": email_id, "direction": body.direction, "subject": body.subject,
            "body": body.body, "to_address": to_addr, "status": "sent"}


# ── Contact Appointments ──────────────────────────────────────────────────────

class AppointmentIn(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: str
    end_time: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = "scheduled"

@router.get("/contacts/{contact_id}/appointments")
def list_contact_appointments(contact_id: int, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        SELECT id, title, description, start_time, end_time, location, status, created_at
        FROM contact_appointments WHERE contact_id={PH} AND user_id={PH}
        ORDER BY start_time ASC
    """), (contact_id, user["id"]))
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r) if isinstance(r, dict) else {
            "id": r[0], "title": r[1], "description": r[2], "start_time": r[3],
            "end_time": r[4], "location": r[5], "status": r[6], "created_at": r[7]
        }
        for k in ("start_time", "end_time", "created_at"):
            if d.get(k) and not isinstance(d[k], str):
                d[k] = str(d[k])
        result.append(d)
    return result

@router.post("/contacts/{contact_id}/appointments")
def create_contact_appointment(contact_id: int, body: AppointmentIn, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("SELECT id FROM contacts WHERE id={PH} AND user_id={PH}"), (contact_id, user["id"]))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Contact not found")
    cur.execute(sql("""
        INSERT INTO contact_appointments (contact_id, user_id, title, description, start_time, end_time, location, status)
        VALUES ({PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH})
    """), (contact_id, user["id"], body.title, body.description, body.start_time, body.end_time, body.location, body.status or "scheduled"))
    apt_id = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": apt_id, "title": body.title, "start_time": body.start_time, "status": body.status or "scheduled"}

@router.patch("/contacts/{contact_id}/appointments/{apt_id}")
def update_contact_appointment(contact_id: int, apt_id: int, body: AppointmentIn, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        UPDATE contact_appointments SET title={PH}, description={PH}, start_time={PH},
        end_time={PH}, location={PH}, status={PH}
        WHERE id={PH} AND contact_id={PH} AND user_id={PH}
    """), (body.title, body.description, body.start_time, body.end_time, body.location,
           body.status or "scheduled", apt_id, contact_id, user["id"]))
    conn.commit()
    conn.close()
    return {"ok": True}

@router.delete("/contacts/{contact_id}/appointments/{apt_id}")
def delete_contact_appointment(contact_id: int, apt_id: int, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("DELETE FROM contact_appointments WHERE id={PH} AND contact_id={PH} AND user_id={PH}"),
                (apt_id, contact_id, user["id"]))
    conn.commit()
    conn.close()
    return {"ok": True}

# All appointments for this user (calendar view)
@router.get("/appointments")
def list_all_appointments(user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        SELECT a.id, a.contact_id, a.title, a.description, a.start_time, a.end_time,
               a.location, a.status, a.created_at,
               c.first_name, c.last_name, c.phone_number
        FROM contact_appointments a
        LEFT JOIN contacts c ON a.contact_id = c.id
        WHERE a.user_id={PH}
        ORDER BY a.start_time ASC
    """), (user["id"],))
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r) if isinstance(r, dict) else {
            "id": r[0], "contact_id": r[1], "title": r[2], "description": r[3],
            "start_time": r[4], "end_time": r[5], "location": r[6], "status": r[7],
            "created_at": r[8], "first_name": r[9], "last_name": r[10], "phone_number": r[11]
        }
        for k in ("start_time", "end_time", "created_at"):
            if d.get(k) and not isinstance(d[k], str):
                d[k] = str(d[k])
        result.append(d)
    return result


# ── Contact Tasks ─────────────────────────────────────────────────────────────

class TaskIn(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = "medium"
    completed: Optional[bool] = False

@router.get("/contacts/{contact_id}/tasks")
def list_contact_tasks(contact_id: int, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        SELECT id, title, description, due_date, priority, completed, created_at
        FROM contact_tasks WHERE contact_id={PH} AND user_id={PH}
        ORDER BY due_date ASC, created_at ASC
    """), (contact_id, user["id"]))
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r) if isinstance(r, dict) else {
            "id": r[0], "title": r[1], "description": r[2], "due_date": r[3],
            "priority": r[4], "completed": bool(r[5]), "created_at": r[6]
        }
        d["completed"] = bool(d.get("completed"))
        result.append(d)
    return result

@router.post("/contacts/{contact_id}/tasks")
def create_contact_task(contact_id: int, body: TaskIn, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        INSERT INTO contact_tasks (contact_id, user_id, title, description, due_date, priority, completed)
        VALUES ({PH},{PH},{PH},{PH},{PH},{PH},{PH})
    """), (contact_id, user["id"], body.title, body.description, body.due_date, body.priority or "medium", 0))
    task_id = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": task_id, "title": body.title, "due_date": body.due_date, "priority": body.priority or "medium", "completed": False}

@router.get("/tasks")
def list_all_tasks(user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        SELECT t.id, t.contact_id, t.title, t.description, t.due_date, t.priority, t.completed, t.created_at,
               c.first_name, c.last_name
        FROM contact_tasks t
        LEFT JOIN contacts c ON t.contact_id = c.id
        WHERE t.user_id={PH}
        ORDER BY t.completed ASC, t.due_date ASC, t.created_at ASC
    """), (user["id"],))
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r) if isinstance(r, dict) else {
            "id": r[0], "contact_id": r[1], "title": r[2], "description": r[3],
            "due_date": r[4], "priority": r[5], "completed": bool(r[6]), "created_at": r[7],
            "first_name": r[8], "last_name": r[9]
        }
        d["completed"] = bool(d.get("completed"))
        result.append(d)
    return result

@router.patch("/tasks/{task_id}")
def update_task(task_id: int, body: TaskIn, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("""
        UPDATE contact_tasks SET title={PH}, description={PH}, due_date={PH},
        priority={PH}, completed={PH}
        WHERE id={PH} AND user_id={PH}
    """), (body.title, body.description, body.due_date, body.priority or "medium",
           1 if body.completed else 0, task_id, user["id"]))
    conn.commit()
    conn.close()
    return {"ok": True}

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, user=Depends(verify_token)):
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(sql("DELETE FROM contact_tasks WHERE id={PH} AND user_id={PH}"), (task_id, user["id"]))
    conn.commit()
    conn.close()
    return {"ok": True}
