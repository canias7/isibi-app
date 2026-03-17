import os
import json
import asyncio
import websockets
import logging
import base64
import audioop  # Built-in module (Python 3.11)
import io
from pydub import AudioSegment
from db import get_agent_prompt, init_db, get_agent_by_id, start_call_tracking, end_call_tracking, calculate_call_cost, calculate_call_revenue, get_user_credits, deduct_credits
from prompt_api import router as prompt_router
from voice_command import router as voice_command_router
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.websockets import WebSocketDisconnect
from twilio.twiml.voice_response import VoiceResponse, Connect
from dotenv import load_dotenv
from auth_routes import router as auth_router
from portal import router as portal_router
from db import create_agent, list_agents, get_agent_by_phone
from pydantic import BaseModel
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth import verify_token
from twilio.twiml.voice_response import VoiceResponse, Connect, Stream
from google_calendar import check_availability, create_appointment, list_appointments
from datetime import datetime
from slack_integration import notify_new_call, notify_call_ended
from teams_integration import notify_new_call_teams, notify_call_ended_teams
from elevenlabs_integration import stream_text_to_speech

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
PORT = int(os.getenv("PORT", 5050))
TEMPERATURE = float(os.getenv("TEMPERATURE", 0.8))
DOMAIN = os.getenv("DOMAIN", "isibi-backend.onrender.com")  # Your public domain or ngrok URL

SYSTEM_MESSAGE = (
    "You are a helpful and bubbly AI assistant who loves to chat about "
    "anything the user is interested in and is prepared to offer them facts. "
    "You have a penchant for dad jokes, owl jokes, and rickrolling – subtly. "
    "Always stay positive, but work in a joke when appropriate."
)

VOICE = "alloy"
SHOW_TIMING_MATH = False

# ── Silence / inactivity timeout ──────────────────────────────────────────────
SILENCE_TIMEOUT_SECONDS = 15       # Hang up after this many seconds of silence
PAUSE_PHRASE_EXTENSION  = 60       # Extra wait (s) when customer says "hold on" etc.
PAUSE_PHRASES = {
    "give me a second", "one second", "hold on", "just a moment",
    "be right back", "brb", "wait a second", "wait a minute",
    "i'll be back", "gimme a sec", "hold on a second", "one moment",
    "just a moment please", "wait", "hang on",
}

# Some common event types to log (optional)
LOG_EVENT_TYPES = {
    "error",
    "rate_limits.updated",
    "response.done",
    "input_audio_buffer.committed",
    "input_audio_buffer.speech_started",
    "input_audio_buffer.speech_stopped",
    "session.created",
    "session.updated",
}

app = FastAPI()


# ========== OpenAI TTS Voice Handler ==========

class OpenAITTSHandler:
    """
    Handles OpenAI TTS voice generation for Anthropic+OpenAI-voice mode.
    Same interface as ElevenLabsVoiceHandler so the rest of the code works unchanged.
    """

    def __init__(self, voice: str, websocket, stream_sid: str, api_key: str):
        self.voice = voice or "alloy"
        self.websocket = websocket
        self.stream_sid = stream_sid
        self.api_key = api_key
        self.text_buffer = ""
        self.total_characters = 0
        self.pending_audio_bytes = 0
        logger.info(f"🎙️ OpenAITTSHandler initialized with voice: {self.voice}")

    def pop_pending_duration(self) -> float:
        duration = self.pending_audio_bytes / 8000.0
        self.pending_audio_bytes = 0
        return duration

    async def handle_text_delta(self, text_delta: str):
        self.text_buffer += text_delta
        if self._should_generate():
            await self._generate_and_stream()

    def _should_generate(self) -> bool:
        if not self.text_buffer.strip():
            return False
        if any(self.text_buffer.strip().endswith(p) for p in ['.', '!', '?', '。']):
            return True
        if len(self.text_buffer) > 200:
            return True
        return False

    async def flush(self):
        if self.text_buffer.strip():
            await self._generate_and_stream()

    async def _generate_and_stream(self):
        import re
        text = re.sub(r'[^\x00-\x7F\u00C0-\u024F\u1E00-\u1EFF]', '', self.text_buffer.strip())
        self.text_buffer = ""
        if not text:
            return
        self.total_characters += len(text)
        logger.info(f"🎤 OpenAI TTS generating: {text[:80]}...")
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/audio/speech",
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                    json={"model": "tts-1", "input": text, "voice": self.voice, "response_format": "mp3"},
                    timeout=30,
                )
                resp.raise_for_status()
                mp3_audio = resp.content
            logger.info(f"🎵 OpenAI TTS received {len(mp3_audio)} bytes")
            audio_segment = AudioSegment.from_mp3(io.BytesIO(mp3_audio))
            if audio_segment.channels > 1:
                audio_segment = audio_segment.set_channels(1)
            audio_segment = audio_segment.set_frame_rate(8000)
            pcm = audio_segment.raw_data
            audio_ulaw = audioop.lin2ulaw(pcm, 2)
            self.pending_audio_bytes += len(audio_ulaw)
            chunk_size = 160
            chunks_sent = 0
            for i in range(0, len(audio_ulaw), chunk_size):
                chunk = audio_ulaw[i:i + chunk_size]
                await self.websocket.send_text(json.dumps({
                    "event": "media",
                    "streamSid": self.stream_sid,
                    "media": {"payload": base64.b64encode(chunk).decode('utf-8')}
                }))
                chunks_sent += 1
            logger.info(f"✅ OpenAI TTS sent {chunks_sent} chunks to Twilio")
        except Exception as e:
            logger.error(f"❌ OpenAI TTS error: {e}")

    def get_cost(self) -> float:
        # OpenAI TTS-1: $15 per 1M characters
        return (self.total_characters / 1_000_000) * 15.0


# ========== ElevenLabs Voice Handler ==========

class ElevenLabsVoiceHandler:
    """
    Handles ElevenLabs voice generation during live calls
    Buffers text and generates speech in real-time
    """
    
    def __init__(self, voice_id: str, websocket, stream_sid: str):
        self.voice_id = voice_id
        self.websocket = websocket
        self.stream_sid = stream_sid
        self.text_buffer = ""
        self.total_characters = 0  # Track characters for cost calculation
        self.pending_audio_bytes = 0  # Bytes queued to Twilio but not yet played
        logger.info(f"🎙️ ElevenLabsVoiceHandler initialized with voice: {voice_id}")

    def pop_pending_duration(self) -> float:
        """Return seconds of audio queued to Twilio, then reset counter."""
        duration = self.pending_audio_bytes / 8000.0
        self.pending_audio_bytes = 0
        return duration
    
    async def handle_text_delta(self, text_delta: str):
        """Buffer text and generate speech when ready"""
        self.text_buffer += text_delta
        
        # Generate when we have a sentence
        if self._should_generate_speech():
            await self.generate_and_stream_speech()
    
    def _should_generate_speech(self) -> bool:
        """Check if we should generate speech now"""
        if not self.text_buffer.strip():
            return False
        
        # Generate at sentence endings
        if any(self.text_buffer.strip().endswith(p) for p in ['.', '!', '?', '。']):
            return True
        
        # Or if buffer is getting long (>200 chars)
        if len(self.text_buffer) > 200:
            return True
        
        return False
    
    async def generate_and_stream_speech(self):
        """Generate ElevenLabs speech and stream to caller"""
        if not self.text_buffer.strip():
            return

        text_to_speak = self.text_buffer.strip()
        self.text_buffer = ""  # Clear buffer

        # Strip emojis — ElevenLabs will try to speak them as words otherwise
        import re
        text_to_speak = re.sub(r'[^\x00-\x7F\u00C0-\u024F\u1E00-\u1EFF]', '', text_to_speak).strip()
        if not text_to_speak:
            return
        
        # Track characters for cost calculation
        char_count = len(text_to_speak)
        self.total_characters += char_count
        
        logger.info(f"🎤 ElevenLabs generating: {text_to_speak[:80]}...")
        logger.info(f"📊 ElevenLabs: +{char_count} chars, total: {self.total_characters}")
        
        try:
            # Collect all audio chunks from ElevenLabs
            audio_chunks = []
            for chunk in stream_text_to_speech(
                text=text_to_speak,
                voice_id=self.voice_id,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128"  # Use MP3 since PCM isn't working
            ):
                audio_chunks.append(chunk)
            
            if not audio_chunks:
                logger.warning("⚠️ No audio chunks received from ElevenLabs")
                return
            
            # Combine all chunks
            mp3_audio = b''.join(audio_chunks)
            logger.info(f"🎵 Received {len(mp3_audio)} bytes of MP3 audio from ElevenLabs")
            
            # Decode MP3 to PCM using pydub
            audio_segment = AudioSegment.from_mp3(io.BytesIO(mp3_audio))
            
            # Convert to mono if stereo
            if audio_segment.channels > 1:
                audio_segment = audio_segment.set_channels(1)
            
            # Resample to 8kHz
            audio_segment = audio_segment.set_frame_rate(8000)
            
            # Get raw PCM data (16-bit)
            pcm_8khz = audio_segment.raw_data
            logger.info(f"🔄 Decoded and resampled to {len(pcm_8khz)} bytes at 8kHz")
            
            # Convert to μ-law using audioop.lin2ulaw
            audio_ulaw = audioop.lin2ulaw(pcm_8khz, 2)
            logger.info(f"🔊 Converted to {len(audio_ulaw)} bytes of μ-law audio")
            self.pending_audio_bytes += len(audio_ulaw)

            # Send in chunks to Twilio (20ms chunks = 160 bytes at 8kHz μ-law)
            chunk_size = 160
            chunks_sent = 0
            
            # Send all chunks without delay - Twilio will buffer and play properly
            for i in range(0, len(audio_ulaw), chunk_size):
                chunk = audio_ulaw[i:i + chunk_size]
                audio_b64 = base64.b64encode(chunk).decode('utf-8')
                
                await self.websocket.send_text(json.dumps({
                    "event": "media",
                    "streamSid": self.stream_sid,
                    "media": {
                        "payload": audio_b64
                    }
                }))
                chunks_sent += 1
            
            logger.info(f"✅ Sent {chunks_sent} chunks to Twilio")
        
        except Exception as e:
            # Silently ignore disconnection errors — call already ended on Twilio's side
            err_str = str(e)
            if any(x in err_str for x in ("WebSocketDisconnect", "ClientDisconnected", "ConnectionClosed", "1005", "1006", "no close frame")):
                logger.debug(f"🔇 ElevenLabs send skipped (connection already closed): {type(e).__name__}")
            else:
                logger.error(f"❌ ElevenLabs TTS error: {e}")
                import traceback
                logger.error(traceback.format_exc())
    
    async def flush(self):
        """Flush any remaining text in buffer"""
        if self.text_buffer.strip():
            await self.generate_and_stream_speech()
    
    def get_cost(self):
        """Calculate ElevenLabs cost based on characters used"""
        # ElevenLabs pricing: $0.0846 per 1,000 characters
        ELEVENLABS_RATE_PER_1K = 0.0846
        cost = (self.total_characters / 1000) * ELEVENLABS_RATE_PER_1K
        return cost


@app.get("/outbound-twiml")
async def outbound_twiml(
    agent_id: int = None,
    llm_provider: str = None,
    model: str = None,
    voice_provider: str = None,
    elevenlabs_voice_id: str = None,
):
    """Return TwiML for an outbound AI call. Passes all config as Stream Parameters."""
    vr = VoiceResponse()
    connect = Connect()
    stream = connect.stream(url=f"wss://{DOMAIN}/media-stream")
    if agent_id:
        stream.parameter(name="agent_id", value=str(agent_id))
    if llm_provider:
        stream.parameter(name="llm_provider", value=llm_provider)
    if model:
        stream.parameter(name="model", value=model)
    if voice_provider:
        stream.parameter(name="voice_provider", value=voice_provider)
    if elevenlabs_voice_id:
        stream.parameter(name="elevenlabs_voice_id", value=elevenlabs_voice_id)
    vr.append(connect)
    return HTMLResponse(str(vr), media_type="application/xml")


@app.post("/incoming-call")
async def incoming_call(request: Request):
    # Twilio sends form data, not JSON
    form_data = await request.form()
    
    called_number = form_data.get("To")
    from_number = form_data.get("From")

    print("=" * 50)
    print("INCOMING CALL")
    print("TWILIO To (raw):", called_number)
    print("TWILIO From:", from_number)

    # Try multiple phone number formats to match database
    agent = None
    if called_number:
        # Try original format first
        agent = get_agent_by_phone(called_number)
        print(f"Lookup with '{called_number}':", bool(agent))
        
        # If not found, try without the + prefix
        if not agent and called_number.startswith("+"):
            no_plus = called_number[1:]
            agent = get_agent_by_phone(no_plus)
            print(f"Lookup with '{no_plus}':", bool(agent))
        
        # If not found, try with + prefix added
        if not agent and not called_number.startswith("+"):
            with_plus = f"+{called_number}"
            agent = get_agent_by_phone(with_plus)
            print(f"Lookup with '{with_plus}':", bool(agent))
    
    print("Agent found:", bool(agent))
    if agent:
        print("Agent ID:", agent.get('id'))
    print("=" * 50)
    
    if not agent:
        vr = VoiceResponse()
        vr.say("No agent is configured on this number.")
        return HTMLResponse(str(vr), media_type="application/xml")

    # Use DOMAIN environment variable for WebSocket URL
    ws_url = f"wss://{DOMAIN}/media-stream"
    print(f"WebSocket URL: {ws_url}")
    print(f"DOMAIN env var: {DOMAIN}")
    print(f"Agent ID: {agent['id']}")
    
    vr = VoiceResponse()
    connect = Connect()
    stream = connect.stream(url=ws_url)
    # Pass agent_id as a custom parameter (accessible in customParameters)
    stream.parameter(name="agent_id", value=str(agent['id']))
    vr.append(connect)
    
    twiml_response = str(vr)
    print(f"TwiML Response: {twiml_response}")
    
    return HTMLResponse(twiml_response, media_type="application/xml")


@app.post("/sms/webhook")
async def sms_webhook(request: Request):
    """Public Twilio SMS webhook — handles inbound replies for AI SMS conversations."""
    from twilio.rest import Client as TwilioClient
    from anthropic import Anthropic as _Anthropic
    from db import get_conn, sql as _sql

    form_data = await request.form()
    from_number = form_data.get("From", "")   # contact's phone (reply sender)
    to_number   = form_data.get("To", "")     # our Twilio number
    body_text   = form_data.get("Body", "").strip()

    logger.info(f"📱 SMS webhook: from={from_number} to={to_number} body={body_text[:60]}")

    # Empty TwiML — we respond via API, not via TwiML <Message>
    empty_twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

    if not from_number or not body_text:
        return HTMLResponse(empty_twiml, media_type="application/xml")

    try:
        conn = get_conn()
        cur  = conn.cursor()

        # Find the active AI SMS session for this phone pair
        cur.execute(_sql("""
            SELECT id, user_id, system_prompt
            FROM ai_sms_sessions
            WHERE phone_number={PH} AND from_number={PH} AND status='active'
            ORDER BY created_at DESC LIMIT 1
        """), (from_number, to_number))
        session_row = cur.fetchone()

        if not session_row:
            logger.info(f"📱 No active AI SMS session for {from_number} → {to_number}")
            conn.close()
            return HTMLResponse(empty_twiml, media_type="application/xml")

        session_id   = session_row["id"]           if isinstance(session_row, dict) else session_row[0]
        user_id      = session_row["user_id"]      if isinstance(session_row, dict) else session_row[1]
        system_prompt = session_row["system_prompt"] if isinstance(session_row, dict) else session_row[2]

        # Store the inbound message
        cur.execute(_sql("""
            INSERT INTO ai_sms_messages (session_id, role, content)
            VALUES ({PH},'user',{PH})
        """), (session_id, body_text))
        conn.commit()

        # Load conversation history (last 20 messages)
        cur.execute(_sql("""
            SELECT role, content FROM ai_sms_messages
            WHERE session_id={PH} ORDER BY created_at ASC
        """), (session_id,))
        history_rows = cur.fetchall()
        messages = [
            {"role": r["role"] if isinstance(r, dict) else r[0],
             "content": r["content"] if isinstance(r, dict) else r[1]}
            for r in history_rows
        ][-20:]  # keep last 20

        # Generate AI reply with Claude
        anthropic_client = _Anthropic()
        ai_resp = anthropic_client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=200,
            system=(
                (system_prompt or "You are a helpful sales assistant.")
                + "\n\nIMPORTANT: You are in an SMS conversation. Keep replies under 160 characters, "
                "conversational and natural. Never add quotes or labels — just the reply text."
            ),
            messages=messages,
        )
        reply_text = ai_resp.content[0].text.strip()[:160]
        logger.info(f"📱 AI SMS reply ({len(reply_text)} chars): {reply_text[:60]}")

        # Send reply via Twilio
        twilio_sid = None
        _sid = os.getenv("TWILIO_ACCOUNT_SID")
        _tok = os.getenv("TWILIO_AUTH_TOKEN")
        if _sid and _tok:
            tc = TwilioClient(_sid, _tok)
            msg = tc.messages.create(body=reply_text, from_=to_number, to=from_number)
            twilio_sid = msg.sid

        # Store assistant reply
        cur.execute(_sql("""
            INSERT INTO ai_sms_messages (session_id, role, content, twilio_sid)
            VALUES ({PH},'assistant',{PH},{PH})
        """), (session_id, reply_text, twilio_sid))
        conn.commit()
        conn.close()

    except Exception as e:
        logger.error(f"❌ SMS webhook error: {e}")

    return HTMLResponse(empty_twiml, media_type="application/xml")


@app.on_event("startup")
async def startup_event():
    init_db()
    print("=" * 60)
    print("🚀 APP STARTUP - VERSION: FIRST_MESSAGE_FIX_v2")
    print("=" * 60)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # later restrict to lovable domain
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prompt_router)
app.include_router(auth_router)
app.include_router(portal_router)
app.include_router(voice_command_router)

print("📋 Registered routes:")
for route in app.routes:
    print(f"  - {route.path} ({route.methods if hasattr(route, 'methods') else 'WebSocket'})")

if not OPENAI_API_KEY:
    raise ValueError("Missing OPENAI_API_KEY in .env")


from fastapi.responses import HTMLResponse

# ── Manual (non-AI) call TwiML ────────────────────────────────────────────────
@app.get("/manual-call-twiml")
async def manual_call_twiml(lead: str, crm_id: str, from_num: str = "", name: str = ""):
    """TwiML served to agent's phone when a manual CRM call is placed.
    When the agent picks up, Twilio bridges them to the lead and records."""
    from fastapi.responses import Response as _Resp
    BACKEND = os.getenv("BACKEND_URL", "https://isibi-backend.onrender.com")
    lead_e164 = lead if lead.startswith("+") else (f"+1{lead}" if len(lead) == 10 else f"+{lead}")
    say_text  = f"Connecting you to {name}." if name else "Connecting your call now."
    rec_cb    = f"{BACKEND}/api/calls/recording-webhook?crm_id={crm_id}"
    done_cb   = f"{BACKEND}/api/calls/manual-complete?crm_id={crm_id}"
    caller_id = from_num if from_num else ""
    caller_attr = f' callerId="{caller_id}"' if caller_id else ""
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>{say_text}</Say>
  <Dial{caller_attr} record="record-from-ringing-dual"
       recordingStatusCallback="{rec_cb}"
       recordingStatusCallbackMethod="POST"
       action="{done_cb}" method="POST">
    <Number>{lead_e164}</Number>
  </Dial>
</Response>"""
    return _Resp(content=xml, media_type="application/xml")

@app.get("/", response_class=HTMLResponse)
async def home():
    return """
    <html>
      <head>
        <title>ISIBI.AI Control Hub</title>
      </head>
      <body style="font-family: Arial; padding: 40px;">
        <h1>ISIBI.AI Control Hub</h1>

        <p>Main system dashboard:</p>

        <ul>
          <li><a href="/admin">Admin Prompt Builder</a></li>
          <li><a href="/docs">API Docs</a></li>
          <li><a href="/portal">Customer Portal (coming)</a></li>
        </ul>

      </body>
    </html>
    """

@app.websocket("/media-stream")
async def handle_media_stream(websocket: WebSocket):
    """
    Twilio <-> OpenAI Realtime bridge.
    """
    logger.info("=" * 50)
    logger.info("🔌 WebSocket connection attempt")
    
    try:
        await websocket.accept()
        logger.info("✅ WebSocket accepted")
    except Exception as e:
        logger.error(f"❌ WebSocket accept failed: {e}")
        raise

    # Twilio doesn't pass URL query params to WebSocket
    # We'll get agent_id from the 'start' event's customParameters instead
    agent_id = None
    agent = None
    first_message = None

    # Default values (will be updated when we receive the start event)
    instructions = SYSTEM_MESSAGE
    voice = VOICE
    tools = None

    # --- Peek at the first Twilio message to get agent_id before opening OpenAI WS ---
    DEFAULT_REALTIME_MODEL = "gpt-4o-realtime-preview-2025-06-03"

    # Map LLM model names → best equivalent OpenAI Realtime model
    # Anthropic/other models map to the closest quality tier in OpenAI Realtime
    # (Haiku = mini tier, Sonnet/Opus = full tier)
    LLM_TO_REALTIME_MAP = {
        # Anthropic Claude models
        "claude-haiku-4-5":          "gpt-4o-mini-realtime-preview-2024-12-17",
        "claude-haiku-3-5":          "gpt-4o-mini-realtime-preview-2024-12-17",
        "claude-sonnet-4-5":         "gpt-4o-realtime-preview-2025-06-03",
        "claude-opus-4-5":           "gpt-4o-realtime-preview-2025-06-03",
        "claude-opus-4-6":           "gpt-4o-realtime-preview-2025-06-03",
        "claude-3-5-sonnet-20241022": "gpt-4o-realtime-preview-2025-06-03",
        # OpenAI models (legacy, kept for backwards compat)
        "gpt-4o":                    "gpt-4o-realtime-preview-2025-06-03",
        "gpt-4o-2024-11-20":         "gpt-4o-realtime-preview-2025-06-03",
        "gpt-4o-2024-08-06":         "gpt-4o-realtime-preview-2025-06-03",
        "gpt-4-turbo":               "gpt-4o-realtime-preview-2025-06-03",
        "gpt-4o-mini":               "gpt-4o-mini-realtime-preview-2024-12-17",
        "gpt-4o-mini-2024-07-18":    "gpt-4o-mini-realtime-preview-2024-12-17",
        "gpt-3.5-turbo":             "gpt-4o-mini-realtime-preview-2024-12-17",
    }

    VALID_REALTIME_MODELS = {
        "gpt-4o-realtime-preview",
        "gpt-4o-realtime-preview-2025-06-03",
        "gpt-4o-realtime-preview-2024-12-17",
        "gpt-4o-realtime-preview-2024-10-01",
        "gpt-4o-mini-realtime-preview",
        "gpt-4o-mini-realtime-preview-2024-12-17",
    }

    buffered_messages = []
    selected_model = DEFAULT_REALTIME_MODEL
    peek_use_anthropic = False  # Set to True if agent uses Anthropic as LLM

    try:
        # Twilio sends a 'connected' event before 'start', so loop until we find 'start'
        for _ in range(5):  # read up to 5 messages looking for 'start'
            msg_text = await websocket.receive_text()
            buffered_messages.append(msg_text)
            msg_data = json.loads(msg_text)
            logger.info(f"🔍 Peek event: {msg_data.get('event')}")
            if msg_data.get("event") == "start":
                custom = msg_data["start"].get("customParameters") or {}
                peek_agent_id = custom.get("agent_id")
                logger.info(f"🔍 Peek agent_id: {peek_agent_id}")
                if peek_agent_id:
                    try:
                        peek_agent = get_agent_by_id(int(peek_agent_id))
                        if peek_agent:
                            agent_model_pref = peek_agent.get("model")
                            peek_llm_provider = peek_agent.get("llm_provider", "openai")
                            logger.info(f"🔍 Peek agent model from DB: '{agent_model_pref}', llm_provider: '{peek_llm_provider}'")
                            if peek_llm_provider == "anthropic":
                                # Anthropic mode: use default OpenAI Realtime model for STT only
                                # Do NOT map claude model names to OpenAI equivalents
                                peek_use_anthropic = True
                                logger.info(f"🤖 Peek: Anthropic LLM detected — using default realtime model for STT only: {selected_model}")
                            else:
                                # Legacy non-realtime OpenAI model names → map to default realtime model
                                LEGACY_MODEL_MAP = {
                                    "gpt-4-turbo": DEFAULT_REALTIME_MODEL,
                                    "gpt-4": DEFAULT_REALTIME_MODEL,
                                    "gpt-4o": DEFAULT_REALTIME_MODEL,
                                    "gpt-3.5-turbo": DEFAULT_REALTIME_MODEL,
                                }
                                if agent_model_pref and agent_model_pref in VALID_REALTIME_MODELS:
                                    selected_model = agent_model_pref
                                    logger.info(f"🧠 Using agent model from DB: {selected_model}")
                                elif agent_model_pref and agent_model_pref in LEGACY_MODEL_MAP:
                                    selected_model = LEGACY_MODEL_MAP[agent_model_pref]
                                    logger.info(f"🧠 Legacy model '{agent_model_pref}' mapped to realtime: {selected_model}")
                                else:
                                    logger.info(f"🧠 Agent model '{agent_model_pref}' not in valid set, using default: {selected_model}")
                    except Exception as e:
                        logger.warning(f"⚠️ Could not peek agent model: {e}")
                break  # found 'start', stop peeking
    except Exception as e:
        logger.warning(f"⚠️ Could not peek Twilio messages: {e}")

    realtime_url = (
        f"wss://api.openai.com/v1/realtime?model={selected_model}&temperature={TEMPERATURE}"
    )
    logger.info(f"🔗 Connecting to OpenAI with model: {selected_model}")

    async with websockets.connect(
        realtime_url,
        additional_headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "OpenAI-Beta": "realtime=v1",
        },
    ) as openai_ws:
        await initialize_session(
            openai_ws,
            instructions=instructions,
            voice=voice,
            tools=tools,
            stt_only=peek_use_anthropic,
        )

        stream_sid = None
        latest_media_timestamp = 0
        last_assistant_item = None
        mark_queue = []
        response_start_timestamp_twilio = None
        first_message_sent = False  # Track if we've sent the greeting
        call_summary = None  # Store what happened during the call
        elevenlabs_handler = None  # ElevenLabs voice handler (initialized when agent loads)
        use_elevenlabs = False  # Flag to indicate if using ElevenLabs (set when agent loads)
        use_anthropic = False   # Flag to indicate if using Anthropic as LLM (set when agent loads)
        anthropic_model = "claude-opus-4-5"  # Default Anthropic model
        anthropic_conversation_history = []  # Maintain conversation context across turns
        current_system_prompt = SYSTEM_MESSAGE  # Shared system prompt for Anthropic calls
        
        # Cost tracking variables
        openai_input_tokens = 0
        openai_output_tokens = 0
        openai_cost = 0.0
        anthropic_cost = 0.0  # Anthropic Claude LLM cost
        twilio_cost = 0.0  # Twilio streaming cost

        # Silence / inactivity watchdog
        activity_event  = asyncio.Event()  # Set whenever customer or AI is active
        silence_hangup  = False            # True when watchdog triggers hangup
        last_transcript = ""               # Latest customer transcript (for pause-phrase check)

        # Barge-in / turn-taking state
        caller_speaking        = False          # True while caller's mic is active
        elevenlabs_interrupted = asyncio.Event()  # Set when caller interrupts AI audio
        current_reply_task     = None           # asyncio.Task for ongoing AI reply generation

        async def send_mark():
            if not stream_sid:
                return
            await websocket.send_text(
                json.dumps(
                    {
                        "event": "mark",
                        "streamSid": stream_sid,
                        "mark": {"name": "responsePart"},
                    }
                )
            )
            mark_queue.append("responsePart")

        async def handle_speech_started_event():
            nonlocal response_start_timestamp_twilio, last_assistant_item, mark_queue, caller_speaking, current_reply_task

            caller_speaking = True
            elevenlabs_interrupted.set()  # Cancel any pending AI audio sleep

            # Cancel ongoing reply generation task so the AI stops mid-sentence
            if current_reply_task and not current_reply_task.done():
                current_reply_task.cancel()
                current_reply_task = None
                logger.info("🛑 AI reply task cancelled — caller is speaking")

            # Always clear Twilio's audio buffer so queued AI audio stops immediately
            if stream_sid:
                await websocket.send_text(
                    json.dumps({"event": "clear", "streamSid": stream_sid})
                )
            mark_queue.clear()

            # If OpenAI was mid-response, truncate it too
            if last_assistant_item and response_start_timestamp_twilio is not None:
                elapsed_time = latest_media_timestamp - response_start_timestamp_twilio
                if SHOW_TIMING_MATH:
                    print(
                        f"Truncate math: {latest_media_timestamp} - {response_start_timestamp_twilio} = {elapsed_time}ms"
                    )
                truncate_event = {
                    "type": "conversation.item.truncate",
                    "item_id": last_assistant_item,
                    "content_index": 0,
                    "audio_end_ms": max(0, elapsed_time),
                }
                await openai_ws.send(json.dumps(truncate_event))

            last_assistant_item = None
            response_start_timestamp_twilio = None

        async def silence_watchdog():
            """End the call after SILENCE_TIMEOUT_SECONDS of inactivity.

            The activity_event is set by:
              • greeting sent (receive_from_twilio)
              • speech_started / transcription.completed (send_to_twilio)
              • response.done / ElevenLabs flush (send_to_twilio)

            If the last customer transcript contains a pause phrase ("hold on",
            "give me a second", …) we extend the wait once by PAUSE_PHRASE_EXTENSION
            seconds before hanging up.
            """
            nonlocal silence_hangup, last_transcript, activity_event

            # Wait until the greeting is sent so we don't immediately time out
            while not first_message_sent:
                await asyncio.sleep(0.2)

            timeout = SILENCE_TIMEOUT_SECONDS
            while True:
                activity_event.clear()
                try:
                    await asyncio.wait_for(activity_event.wait(), timeout=timeout)
                    # Activity detected — reset to normal timeout
                    timeout = SILENCE_TIMEOUT_SECONDS
                except asyncio.TimeoutError:
                    # Check for pause phrase in last customer transcript
                    lower_t = last_transcript.lower()
                    if any(phrase in lower_t for phrase in PAUSE_PHRASES):
                        logger.info(
                            f"⏸️ Pause phrase detected ('{last_transcript}') — "
                            f"extending timeout by {PAUSE_PHRASE_EXTENSION}s"
                        )
                        timeout = PAUSE_PHRASE_EXTENSION
                        continue  # Give the customer more time

                    # Genuine silence — trigger hangup
                    logger.warning(
                        f"⏰ Silence timeout ({SILENCE_TIMEOUT_SECONDS}s) — ending call"
                    )
                    silence_hangup = True

                    # Say goodbye before hanging up
                    goodbye_msg = (
                        "It seems like you've stepped away. "
                        "Thanks for calling, goodbye!"
                    )
                    try:
                        if use_elevenlabs and elevenlabs_handler:
                            await elevenlabs_handler.handle_text_delta(goodbye_msg)
                            await elevenlabs_handler.flush()
                            await asyncio.sleep(3)
                        elif not use_anthropic:
                            await openai_ws.send(json.dumps({
                                "type": "response.create",
                                "response": {
                                    "modalities": ["audio", "text"],
                                    "instructions": goodbye_msg,
                                }
                            }))
                            await asyncio.sleep(4)
                    except Exception as e:
                        logger.warning(f"⚠️ Silence-timeout goodbye failed: {e}")

                    # Close Twilio WebSocket — Twilio ends the call
                    try:
                        await websocket.close()
                    except Exception:
                        pass
                    return

        async def receive_from_twilio():
            nonlocal stream_sid, latest_media_timestamp, response_start_timestamp_twilio, last_assistant_item, first_message_sent, agent_id, agent, first_message, use_elevenlabs, use_anthropic, elevenlabs_handler, anthropic_model, anthropic_conversation_history, current_system_prompt, openai_input_tokens, openai_output_tokens, openai_cost, anthropic_cost, twilio_cost, activity_event, silence_hangup, last_transcript

            async def iter_all_messages():
                # Replay buffered messages first (peeked before OpenAI WS was opened)
                for buffered in buffered_messages:
                    yield buffered
                # Then continue with live messages
                async for msg in websocket.iter_text():
                    yield msg

            try:
                async for message in iter_all_messages():
                    data = json.loads(message)

                    evt = data.get("event")

                    if evt == "start":
                        stream_sid = data["start"]["streamSid"]
                        custom = data["start"].get("customParameters") or {}
                        agent_id = custom.get("agent_id")
                        
                        logger.info(f"▶️ start streamSid={stream_sid}")
                        logger.info(f"📦 customParameters: {custom}")
                        logger.info(f"🆔 agent_id from customParameters: {agent_id}")
                        
                        # Start tracking this call
                        call_start_time = datetime.now()
                        
                        # Reset cost tracking for this call
                        openai_input_tokens = 0
                        openai_output_tokens = 0
                        openai_cost = 0.0
                        twilio_cost = 0.0
                        
                        # Load agent configuration
                        if agent_id:
                            try:
                                agent = get_agent_by_id(int(agent_id))
                                logger.info(f"✅ Agent loaded: type={type(agent).__name__} name={agent.get('name') if agent else None} llm={agent.get('llm_provider') if agent else None} voice_prov={agent.get('voice_provider') if agent else None} bool={bool(agent)}")
                                
                                # Track call usage
                                if agent:
                                    owner_user_id = agent.get('owner_user_id')
                                    
                                    # Check if user has credits
                                    credits = get_user_credits(owner_user_id)
                                    
                                    if credits["balance"] <= 0:
                                        logger.warning(f"❌ User {owner_user_id} has no credits! Balance: ${credits['balance']} - BLOCKING CALL")
                                        
                                        # Send low balance message
                                        await openai_ws.send(json.dumps({
                                            "type": "response.create",
                                            "response": {
                                                "modalities": ["text"],  # TEXT ONLY - save money
                                                "instructions": "Say exactly: 'I'm sorry, but your account has insufficient credits. Please add credits at your dashboard to continue using this service. Thank you, goodbye.'"
                                            }
                                        }))
                                        
                                        # Wait for message to finish playing (about 8 seconds)
                                        await asyncio.sleep(8)
                                        
                                        logger.info("🚫 Call blocked due to insufficient credits - hanging up")
                                        
                                        # Close OpenAI connection
                                        await openai_ws.close()
                                        
                                        # Close Twilio connection to end call
                                        await twilio_ws.close()
                                        
                                        # Exit the handler
                                        return
                                    else:
                                        logger.info(f"💳 User has ${credits['balance']:.2f} in credits - call proceeding")
                                    
                                    # Get call info from Twilio data
                                    call_from = data["start"].get("callSid", "unknown")
                                    call_to = agent.get("phone_number", "unknown")
                                    
                                    try:
                                        start_call_tracking(
                                            user_id=owner_user_id,
                                            agent_id=int(agent_id),
                                            call_sid=stream_sid,
                                            call_from=call_from,
                                            call_to=call_to
                                        )
                                        logger.info(f"📊 Call tracking started for user {owner_user_id}")
                                        
                                        # Send Slack notification for new call
                                        try:
                                            from db import get_conn, sql
                                            conn = get_conn()
                                            cur = conn.cursor()
                                            cur.execute(sql("""
                                                SELECT slack_bot_token, slack_default_channel, slack_enabled
                                                FROM users WHERE id = {PH}
                                            """), (owner_user_id,))
                                            slack_row = cur.fetchone()
                                            conn.close()
                                            
                                            if slack_row:
                                                if isinstance(slack_row, dict):
                                                    slack_token = slack_row.get('slack_bot_token')
                                                    slack_channel = slack_row.get('slack_default_channel') or '#calls'
                                                    slack_enabled = slack_row.get('slack_enabled')
                                                else:
                                                    slack_token = slack_row[0] if len(slack_row) > 0 else None
                                                    slack_channel = slack_row[1] if len(slack_row) > 1 else '#calls'
                                                    slack_enabled = slack_row[2] if len(slack_row) > 2 else False
                                                
                                                if slack_enabled and slack_token:
                                                    notify_new_call(
                                                        agent_name=agent.get('name', 'Unknown Agent'),
                                                        caller_number=call_from,
                                                        channel=slack_channel,
                                                        token=slack_token
                                                    )
                                                    logger.info("📢 Slack notification sent: New call")
                                        except Exception as e:
                                            logger.warning(f"⚠️ Failed to send Slack notification: {e}")
                                        
                                        # Send Teams notification for new call
                                        try:
                                            conn = get_conn()
                                            cur = conn.cursor()
                                            cur.execute(sql("""
                                                SELECT teams_webhook_url, teams_enabled
                                                FROM users WHERE id = {PH}
                                            """), (owner_user_id,))
                                            teams_row = cur.fetchone()
                                            conn.close()
                                            
                                            if teams_row:
                                                if isinstance(teams_row, dict):
                                                    teams_webhook = teams_row.get('teams_webhook_url')
                                                    teams_enabled = teams_row.get('teams_enabled')
                                                else:
                                                    teams_webhook = teams_row[0] if len(teams_row) > 0 else None
                                                    teams_enabled = teams_row[1] if len(teams_row) > 1 else False
                                                
                                                if teams_enabled and teams_webhook:
                                                    notify_new_call_teams(
                                                        webhook_url=teams_webhook,
                                                        agent_name=agent.get('name', 'Unknown Agent'),
                                                        caller_number=call_from
                                                    )
                                                    logger.info("📢 Teams notification sent: New call")
                                        except Exception as e:
                                            logger.warning(f"⚠️ Failed to send Teams notification: {e}")
                                        
                                    except Exception as e:
                                        logger.error(f"❌ Failed to start call tracking: {e}")
                                
                                if agent:
                                    first_message = agent.get("first_message")
                                    logger.info(f"🎤 first_message loaded: '{first_message}'")

                                    # Update session with agent's configuration
                                    agent_instructions = agent.get("system_prompt") or SYSTEM_MESSAGE
                                    agent_voice = agent.get("voice") or VOICE

                                    # Inject language instruction
                                    _lang_code = agent.get("language") or "en"
                                    _lang_names = {
                                        "en": "English", "es": "Spanish", "fr": "French",
                                        "de": "German", "it": "Italian", "pt": "Portuguese",
                                        "ja": "Japanese", "ko": "Korean", "zh": "Chinese (Mandarin)",
                                        "ar": "Arabic", "hi": "Hindi", "nl": "Dutch",
                                        "ru": "Russian", "tr": "Turkish", "pl": "Polish",
                                        "sv": "Swedish", "da": "Danish", "no": "Norwegian",
                                        "fi": "Finnish", "he": "Hebrew", "id": "Indonesian",
                                        "th": "Thai", "vi": "Vietnamese",
                                    }
                                    _lang_name = _lang_names.get(_lang_code, _lang_code)
                                    if _lang_code != "en":
                                        agent_instructions = f"IMPORTANT: Always respond in {_lang_name}. Start the conversation in {_lang_name}.\n\n" + agent_instructions
                                        logger.info(f"🌍 Language set to: {_lang_name} ({_lang_code})")

                                    # Check if using Anthropic as LLM
                                    # customParameters from TwiML override DB values (CRM outbound calls)
                                    _cp_llm  = custom.get("llm_provider")
                                    _cp_vp   = custom.get("voice_provider")
                                    _cp_evid = custom.get("elevenlabs_voice_id")
                                    _cp_model = custom.get("model")
                                    llm_provider = _cp_llm or agent.get("llm_provider", "openai")
                                    use_anthropic = llm_provider == "anthropic"
                                    agent_model = _cp_model or agent.get("model") or DEFAULT_REALTIME_MODEL
                                    # Determine voice provider
                                    voice_provider = _cp_vp or agent.get("voice_provider", "openai")
                                    elevenlabs_voice_id = _cp_evid or agent.get("elevenlabs_voice_id")

                                    # use_elevenlabs = True means: intercept OpenAI audio and use our own TTS
                                    # This applies when: ElevenLabs is selected, OR Anthropic LLM is used
                                    # (in Anthropic mode we always handle TTS ourselves)
                                    use_elevenlabs = voice_provider == "elevenlabs" or use_anthropic
                                    logger.info(f"🎛️ CRM params: llm={llm_provider} voice={voice_provider} evid={elevenlabs_voice_id}")

                                    if use_anthropic:
                                        anthropic_model = _cp_model or agent.get("model") or "claude-haiku-4-5"
                                        tts_label = "ElevenLabs" if voice_provider == "elevenlabs" else f"OpenAI TTS ({agent_voice})"
                                        logger.info(f"🧠 LLM: {anthropic_model} | STT: {selected_model} (transcription only) | TTS: {tts_label}")
                                    else:
                                        logger.info(f"🧠 LLM: {agent_model} | STT+TTS: OpenAI Realtime ({selected_model})")

                                    logger.info(f"🔍 DEBUG - Agent voice config:")
                                    logger.info(f"   voice_provider: {voice_provider}")
                                    logger.info(f"   elevenlabs_voice_id: {elevenlabs_voice_id}")
                                    logger.info(f"   use_elevenlabs: {use_elevenlabs}")
                                    logger.info(f"   stream_sid: {stream_sid}")

                                    if use_anthropic and voice_provider == "elevenlabs" and elevenlabs_voice_id:
                                        # Anthropic LLM + ElevenLabs TTS
                                        logger.info(f"🎙️ Using ElevenLabs voice provider (voice_id: {elevenlabs_voice_id})")
                                        elevenlabs_handler = ElevenLabsVoiceHandler(
                                            voice_id=elevenlabs_voice_id,
                                            websocket=websocket,
                                            stream_sid=stream_sid or "unknown"
                                        )
                                        logger.info(f"✅ ElevenLabsVoiceHandler initialized")
                                    elif use_anthropic and voice_provider == "openai":
                                        # Anthropic LLM + OpenAI TTS
                                        logger.info(f"🎙️ Using OpenAI TTS voice provider (voice: {agent_voice})")
                                        elevenlabs_handler = OpenAITTSHandler(
                                            voice=agent_voice or "alloy",
                                            websocket=websocket,
                                            stream_sid=stream_sid or "unknown",
                                            api_key=OPENAI_API_KEY,
                                        )
                                        logger.info(f"✅ OpenAITTSHandler initialized")
                                    elif not use_anthropic and voice_provider == "elevenlabs" and elevenlabs_voice_id:
                                        # OpenAI LLM + ElevenLabs TTS
                                        logger.info(f"🎙️ Using ElevenLabs voice provider (voice_id: {elevenlabs_voice_id})")
                                        elevenlabs_handler = ElevenLabsVoiceHandler(
                                            voice_id=elevenlabs_voice_id,
                                            websocket=websocket,
                                            stream_sid=stream_sid or "unknown"
                                        )
                                        logger.info(f"✅ ElevenLabsVoiceHandler initialized")
                                    else:
                                        # OpenAI LLM + OpenAI Realtime TTS (native)
                                        elevenlabs_handler = None
                                        logger.info(f"🎤 Using OpenAI Realtime voice: {agent_voice}")
                                    
                                    
                                    # Parse tools - must be array for OpenAI, not object
                                    tools_raw = agent.get("tools_json") or "null"
                                    try:
                                        parsed_tools = json.loads(tools_raw)
                                        # If tools is a dict/object, convert to None (OpenAI expects array or null)
                                        if isinstance(parsed_tools, dict):
                                            agent_tools = []
                                        elif isinstance(parsed_tools, list):
                                            agent_tools = parsed_tools
                                        else:
                                            agent_tools = []
                                    except:
                                        agent_tools = []
                                    
                                    # Add Google Calendar tools if connected
                                    calendar_tools = get_calendar_tools(int(agent_id))
                                    if calendar_tools:
                                        agent_tools.extend(calendar_tools)
                                        logger.info(f"📅 Google Calendar tools enabled ({len(calendar_tools)} functions)")
                                    
                                    # Add SMS confirmation tools (always available)
                                    sms_tools = get_sms_tools()
                                    if sms_tools:
                                        agent_tools.extend(sms_tools)
                                        logger.info(f"📱 SMS confirmation tools enabled ({len(sms_tools)} functions)")
                                    
                                    # Add call summary tool (always available)
                                    summary_tools = get_call_summary_tool()
                                    if summary_tools:
                                        agent_tools.extend(summary_tools)
                                        logger.info(f"📋 Call summary tool enabled")
                                    
                                    # Add Square payment tool (always available)
                                    square_tools = get_square_payment_tool()
                                    if square_tools:
                                        agent_tools.extend(square_tools)
                                        logger.info(f"💳 Square payment tool enabled")
                                    
                                    # Add Shopify tools (if user has Shopify configured)
                                    shopify_tools = get_shopify_tools()
                                    if shopify_tools:
                                        agent_tools.extend(shopify_tools)
                                        logger.info(f"🛍️ Shopify tools enabled ({len(shopify_tools)} functions)")
                                    
                                    # Convert to None if still empty
                                    if not agent_tools:
                                        agent_tools = None
                                    
                                    # Validate voice - always validate since we're using audio mode
                                    valid_voices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar']
                                    if agent_voice not in valid_voices:
                                        logger.warning(f"⚠️ Invalid voice '{agent_voice}', using default 'alloy'")
                                        agent_voice = 'alloy'
                                    
                                    current_system_prompt = agent_instructions  # Store for Anthropic use
                                    logger.info(f"📝 System prompt loaded (length: {len(agent_instructions)} chars)")
                                    logger.info(f"📝 System prompt preview: {agent_instructions[:200]}...")
                                    logger.info(f"🎙️ Using voice: {agent_voice}")
                                    
                                    # Send session.update to apply agent config
                                    await initialize_session(
                                        openai_ws,
                                        instructions=agent_instructions,
                                        voice=agent_voice,  # Always pass voice (needed for audio mode)
                                        tools=agent_tools if not use_anthropic else None,
                                        use_elevenlabs=use_elevenlabs,
                                        stt_only=use_anthropic,
                                    )
                                    logger.info("🔄 OpenAI session updated with agent config")
                                    
                                    # Wait a bit for session to be fully configured
                                    await asyncio.sleep(0.5)
                                    
                            except Exception as e:
                                logger.error(f"❌ Error loading agent: {e}")

                        # ── CRM outbound override ────────────────────────────────────────
                        # customParameters carry llm/voice config from the TwiML URL.
                        # Apply them even when agent was None / not found in DB,
                        # so outbound CRM calls always get the right AI stack.
                        _cp_llm_ov = custom.get("llm_provider") if custom else None
                        if _cp_llm_ov == "anthropic" and not use_anthropic:
                            _cp_vp_ov   = custom.get("voice_provider", "elevenlabs")
                            _cp_evid_ov = custom.get("elevenlabs_voice_id") or "21m00Tcm4TlvDq8ikWAM"
                            _cp_mod_ov  = custom.get("model") or "claude-haiku-4-5"
                            use_anthropic   = True
                            anthropic_model = _cp_mod_ov
                            use_elevenlabs  = True

                            # Load system_prompt from agent DB record (ignore deleted_at so
                            # soft-deleted agents still supply their prompt)
                            _crm_sys = None
                            if agent:
                                _crm_sys = agent.get("system_prompt")
                            if not _crm_sys and agent_id:
                                try:
                                    from db import get_conn, sql as _sql
                                    _c = get_conn(); _cur = _c.cursor()
                                    _cur.execute(_sql("SELECT system_prompt FROM agents WHERE id={PH}"), (int(agent_id),))
                                    _r = _cur.fetchone()
                                    _c.close()
                                    if _r:
                                        _crm_sys = _r["system_prompt"] if isinstance(_r, dict) else _r[0]
                                except Exception as _e:
                                    logger.warning(f"⚠️ CRM: could not load system_prompt for agent {agent_id}: {_e}")
                            current_system_prompt = _crm_sys or SYSTEM_MESSAGE
                            logger.info(f"📋 CRM system_prompt loaded: {len(current_system_prompt)} chars")
                            if not elevenlabs_handler:
                                elevenlabs_handler = ElevenLabsVoiceHandler(
                                    voice_id=_cp_evid_ov,
                                    websocket=websocket,
                                    stream_sid=stream_sid or "unknown",
                                )
                            logger.info(f"🎛️ CRM override: anthropic/{_cp_mod_ov} + elevenlabs/{_cp_evid_ov}")
                            # Switch OpenAI to STT-only so it won't generate audio
                            await initialize_session(
                                openai_ws,
                                instructions="You are a transcription service only. Do not generate any responses.",
                                stt_only=True,
                            )
                            await asyncio.sleep(0.2)
                        # ─────────────────────────────────────────────────────────────────

                        # Reset per-call state
                        response_start_timestamp_twilio = None
                        latest_media_timestamp = 0
                        last_assistant_item = None

                        # Send first message if configured
                        if not first_message_sent:
                            logger.info(f"📢 Triggering greeting: use_anthropic={use_anthropic} elevenlabs_handler={elevenlabs_handler is not None} use_elevenlabs={use_elevenlabs}")

                            if use_anthropic and elevenlabs_handler:
                                # Anthropic mode: generate greeting via Claude → ElevenLabs
                                greeting_prompt = first_message if first_message else "[SYSTEM: The caller just connected. Say a brief greeting only — one short sentence, then stop and wait for them to speak.]"
                                anthropic_conversation_history.append({"role": "user", "content": greeting_prompt})
                                try:
                                    import anthropic as anthropic_sdk
                                    ac = anthropic_sdk.Anthropic(api_key=ANTHROPIC_API_KEY)
                                    greeting_response = ""
                                    with ac.messages.stream(
                                        model=anthropic_model,
                                        max_tokens=60,
                                        system=current_system_prompt,
                                        messages=anthropic_conversation_history,
                                    ) as stream:
                                        for text_chunk in stream.text_stream:
                                            greeting_response += text_chunk
                                            await elevenlabs_handler.handle_text_delta(text_chunk)
                                    await elevenlabs_handler.flush()
                                    anthropic_conversation_history.append({"role": "assistant", "content": greeting_response})
                                    logger.info(f"📢 Anthropic greeting sent via ElevenLabs")
                                except Exception as e:
                                    logger.error(f"❌ Anthropic greeting error: {e}")
                                    # Fallback: send a static greeting via ElevenLabs — never fall through to OpenAI
                                    fallback_greeting = "Hello! Thanks for calling. How can I help you today?"
                                    try:
                                        for text_chunk in fallback_greeting.split():
                                            await elevenlabs_handler.handle_text_delta(text_chunk + " ")
                                        await elevenlabs_handler.flush()
                                        anthropic_conversation_history.append({"role": "assistant", "content": fallback_greeting})
                                        logger.info(f"📢 Fallback greeting sent via ElevenLabs")
                                    except Exception as fe:
                                        logger.error(f"❌ Fallback greeting error: {fe}")
                            elif not use_anthropic:
                                # OpenAI mode: trigger greeting via conversation item
                                await openai_ws.send(json.dumps({
                                    "type": "conversation.item.create",
                                    "item": {
                                        "type": "message",
                                        "role": "user",
                                        "content": [{
                                            "type": "input_text",
                                            "text": "[SYSTEM: The caller has just connected. Greet them now.]"
                                        }]
                                    }
                                }))
                                await openai_ws.send(json.dumps({
                                    "type": "response.create",
                                    "response": {
                                        "modalities": ["text"] if elevenlabs_handler else ["text", "audio"]
                                    }
                                }))

                            first_message_sent = True
                            # Delay silence timer until after the greeting audio has finished playing
                            if elevenlabs_handler:
                                greeting_duration = elevenlabs_handler.pop_pending_duration()
                                logger.info(f"⏳ Waiting {greeting_duration:.1f}s for greeting audio to finish playing")
                                elevenlabs_interrupted.clear()
                                try:
                                    await asyncio.wait_for(elevenlabs_interrupted.wait(), timeout=greeting_duration)
                                    logger.info("🗣️ Caller interrupted greeting")
                                except asyncio.TimeoutError:
                                    activity_event.set()  # Silence timer: greeting audio done, start watching
                            logger.info(f"📢 Greeting triggered via conversation item")

                    elif evt == "media":
                        # Track timestamp so truncation math works
                        try:
                            latest_media_timestamp = int(data["media"].get("timestamp", 0))
                        except Exception:
                            latest_media_timestamp = 0

                        # Forward audio to OpenAI (Twilio sends base64 G.711 u-law)
                        await openai_ws.send(
                            json.dumps(
                                {
                                    "type": "input_audio_buffer.append",
                                    "audio": data["media"]["payload"],
                                }
                            )
                        )

                    elif evt == "mark":
                        if mark_queue:
                            mark_queue.pop(0)

                    elif evt == "stop":
                        print("⏹️ stop received")
                        
                        # End call tracking
                        if stream_sid and agent:
                            try:
                                call_end_time = datetime.now()
                                duration_seconds = int((call_end_time - call_start_time).total_seconds())
                                
                                # Skip tracking if call was too short (< 1 second)
                                if duration_seconds < 1:
                                    logger.warning(f"⚠️ Call too short to track: {duration_seconds}s")
                                    break
                                
                                # Calculate ACTUAL costs from API usage
                                
                                # Calculate Twilio streaming cost
                                # Twilio: $0.0085 per minute
                                twilio_cost = (duration_seconds / 60) * 0.0085
                                
                                # Get ElevenLabs cost if using it
                                elevenlabs_cost = 0.0
                                if elevenlabs_handler:
                                    elevenlabs_cost = elevenlabs_handler.get_cost()
                                
                                # Total API cost (all services)
                                actual_api_cost = openai_cost + anthropic_cost + elevenlabs_cost + twilio_cost

                                # Your markup (flat $0.05 per minute)
                                markup_per_minute = 0.05
                                markup_total = (duration_seconds / 60) * markup_per_minute

                                # Customer pays: actual cost + your markup
                                credits_to_deduct = actual_api_cost + markup_total

                                # Your profit is just the markup
                                profit = markup_total

                                logger.info(f"📊 Call ended: {duration_seconds}s")
                                logger.info(f"💰 Whisper (STT): ${openai_cost:.4f}")
                                if use_anthropic:
                                    logger.info(f"💰 Anthropic (Claude LLM): ${anthropic_cost:.4f}")
                                tts_label = "ElevenLabs" if isinstance(elevenlabs_handler, ElevenLabsVoiceHandler) else "OpenAI TTS" if isinstance(elevenlabs_handler, OpenAITTSHandler) else "OpenAI Realtime"
                                logger.info(f"💰 {tts_label} (TTS): ${elevenlabs_cost:.4f}")
                                logger.info(f"💰 Twilio (Streaming): ${twilio_cost:.4f}")
                                logger.info(f"💰 Total API cost: ${actual_api_cost:.4f}")
                                logger.info(f"💰 Your markup (+$0.05/min): ${markup_total:.4f}")
                                logger.info(f"💳 Customer charged: ${credits_to_deduct:.4f}")
                                logger.info(f"💵 Your profit: ${profit:.4f}")
                                
                                # Save call record with actual API cost
                                end_call_tracking(stream_sid, duration_seconds, actual_api_cost, credits_to_deduct)
                                logger.info(f"✅ Call tracking saved")
                                
                                # Deduct credits from user's balance
                                owner_user_id = agent.get('owner_user_id')
                                result = deduct_credits(
                                    user_id=owner_user_id,
                                    amount=credits_to_deduct,
                                    description=f"Call to {agent.get('name')} ({duration_seconds}s)"
                                )
                                
                                if result["success"]:
                                    logger.info(f"💳 Remaining balance: ${result['balance']:.2f}")
                                else:
                                    logger.warning(f"⚠️ Credit deduction failed: {result.get('error')}")
                                
                                # Send Slack notification for call ended
                                try:
                                    from db import get_conn, sql
                                    conn = get_conn()
                                    cur = conn.cursor()
                                    cur.execute(sql("""
                                        SELECT slack_bot_token, slack_default_channel, slack_enabled
                                        FROM users WHERE id = {PH}
                                    """), (owner_user_id,))
                                    slack_row = cur.fetchone()
                                    conn.close()
                                    
                                    if slack_row:
                                        if isinstance(slack_row, dict):
                                            slack_token = slack_row.get('slack_bot_token')
                                            slack_channel = slack_row.get('slack_default_channel') or '#calls'
                                            slack_enabled = slack_row.get('slack_enabled')
                                        else:
                                            slack_token = slack_row[0] if len(slack_row) > 0 else None
                                            slack_channel = slack_row[1] if len(slack_row) > 1 else '#calls'
                                            slack_enabled = slack_row[2] if len(slack_row) > 2 else False
                                        
                                        if slack_enabled and slack_token:
                                            # Get call_from from the call tracking
                                            call_from_number = "Unknown"  # Default
                                            try:
                                                conn2 = get_conn()
                                                cur2 = conn2.cursor()
                                                cur2.execute(sql("""
                                                    SELECT call_from FROM call_usage 
                                                    WHERE call_sid = {PH}
                                                """), (stream_sid,))
                                                call_row = cur2.fetchone()
                                                if call_row:
                                                    call_from_number = call_row[0] if isinstance(call_row, tuple) else call_row.get('call_from')
                                                conn2.close()
                                            except:
                                                pass
                                            
                                            notify_call_ended(
                                                agent_name=agent.get('name', 'Unknown Agent'),
                                                caller_number=call_from_number,
                                                duration=duration_seconds,
                                                cost=credits_to_deduct,
                                                channel=slack_channel,
                                                token=slack_token,
                                                summary=call_summary
                                            )
                                            logger.info("📢 Slack notification sent: Call completed")
                                except Exception as e:
                                    logger.warning(f"⚠️ Failed to send Slack notification: {e}")
                                
                                # Send Teams notification for call end
                                try:
                                    from db import get_conn, sql
                                    conn = get_conn()
                                    cur = conn.cursor()
                                    cur.execute(sql("""
                                        SELECT teams_webhook_url, teams_enabled
                                        FROM users WHERE id = {PH}
                                    """), (owner_user_id,))
                                    teams_row = cur.fetchone()
                                    conn.close()
                                    
                                    if teams_row:
                                        if isinstance(teams_row, dict):
                                            teams_webhook = teams_row.get('teams_webhook_url')
                                            teams_enabled = teams_row.get('teams_enabled')
                                        else:
                                            teams_webhook = teams_row[0] if len(teams_row) > 0 else None
                                            teams_enabled = teams_row[1] if len(teams_row) > 1 else False
                                        
                                        if teams_enabled and teams_webhook:
                                            # Get call_from number
                                            call_from_number = "Unknown"
                                            try:
                                                conn2 = get_conn()
                                                cur2 = conn2.cursor()
                                                cur2.execute(sql("""
                                                    SELECT call_from FROM call_usage 
                                                    WHERE call_sid = {PH}
                                                """), (stream_sid,))
                                                call_row = cur2.fetchone()
                                                if call_row:
                                                    call_from_number = call_row[0] if isinstance(call_row, tuple) else call_row.get('call_from')
                                                conn2.close()
                                            except:
                                                pass
                                            
                                            notify_call_ended_teams(
                                                webhook_url=teams_webhook,
                                                agent_name=agent.get('name', 'Unknown Agent'),
                                                caller_number=call_from_number,
                                                duration=duration_seconds,
                                                cost=credits_to_deduct,
                                                summary=call_summary
                                            )
                                            logger.info("📢 Teams notification sent: Call completed")
                                except Exception as e:
                                    logger.warning(f"⚠️ Failed to send Teams notification: {e}")
                                    
                            except Exception as e:
                                logger.error(f"❌ Failed to end call tracking: {e}")
                                import traceback
                                logger.error(traceback.format_exc())
                        
                        break

            except WebSocketDisconnect:
                print("❌ Twilio WS disconnected")
                try:
                    await openai_ws.close()
                except Exception:
                    pass

        async def _generate_reply(transcript: str):
            """Run Anthropic LLM + ElevenLabs TTS as a cancellable task."""
            nonlocal anthropic_conversation_history, anthropic_cost, current_reply_task
            import anthropic as anthropic_sdk
            ac = anthropic_sdk.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            assistant_reply = ""
            final_msg = None
            try:
                elevenlabs_interrupted.clear()
                async with ac.messages.stream(
                    model=anthropic_model,
                    max_tokens=1024,
                    system=current_system_prompt,
                    messages=anthropic_conversation_history,
                ) as stream:
                    async for text_chunk in stream.text_stream:
                        assistant_reply += text_chunk
                        await elevenlabs_handler.handle_text_delta(text_chunk)
                    final_msg = await stream.get_final_message()
                await elevenlabs_handler.flush()

                # Wait for AI audio to finish playing, keeping the silence watchdog alive
                # by pulsing activity_event every (SILENCE_TIMEOUT_SECONDS - 2) seconds.
                reply_duration = elevenlabs_handler.pop_pending_duration()
                elevenlabs_interrupted.clear()
                elapsed = 0.0
                pulse_interval = max(1.0, SILENCE_TIMEOUT_SECONDS - 2)
                interrupted = False
                while elapsed < reply_duration:
                    wait_for = min(pulse_interval, reply_duration - elapsed)
                    try:
                        await asyncio.wait_for(elevenlabs_interrupted.wait(), timeout=wait_for)
                        interrupted = True
                        logger.info("🗣️ Caller interrupted AI reply")
                        break
                    except asyncio.TimeoutError:
                        elapsed += wait_for
                        if elapsed < reply_duration:
                            activity_event.set()  # AI still speaking — reset watchdog
                if not interrupted:
                    activity_event.set()  # AI finished — start caller silence countdown

            except asyncio.CancelledError:
                logger.info("🛑 AI reply cancelled — caller barged in")
                elevenlabs_handler.pending_audio_bytes = 0
                if assistant_reply:
                    anthropic_conversation_history.append({"role": "assistant", "content": assistant_reply})
                return
            except Exception as e:
                logger.error(f"❌ Anthropic LLM error: {e}")
                return

            anthropic_conversation_history.append({"role": "assistant", "content": assistant_reply})
            if final_msg:
                _in  = final_msg.usage.input_tokens
                _out = final_msg.usage.output_tokens
                if "haiku" in anthropic_model:
                    _cost = (_in * 0.000001) + (_out * 0.000005)
                elif "sonnet" in anthropic_model:
                    _cost = (_in * 0.000003) + (_out * 0.000015)
                else:
                    _cost = (_in * 0.000005) + (_out * 0.000025)
                anthropic_cost += _cost
                logger.info(f"🤖 Anthropic replied ({len(assistant_reply)} chars) | tokens in={_in} out={_out} cost=${_cost:.6f} total=${anthropic_cost:.6f}")
            current_reply_task = None

        async def send_to_twilio():
            nonlocal response_start_timestamp_twilio, last_assistant_item, elevenlabs_handler, use_elevenlabs, use_anthropic, anthropic_model, anthropic_conversation_history, current_system_prompt, openai_input_tokens, openai_output_tokens, openai_cost, anthropic_cost, twilio_cost, activity_event, silence_hangup, last_transcript, caller_speaking, current_reply_task

            try:
                async for openai_message in openai_ws:
                    resp = json.loads(openai_message)
                    rtype = resp.get("type")

                    if rtype in LOG_EVENT_TYPES:
                        print("OpenAI event:", rtype)

                    # In STT-only (Anthropic LLM) mode: cancel OpenAI response AFTER transcription
                    # We must NOT cancel on response.created — doing so prevents
                    # conversation.item.input_audio_transcription.completed from ever firing.
                    # Instead cancel on response.output_item.added, which fires after transcription
                    # is complete but before GPT generates any actual output tokens.
                    if use_anthropic and rtype == "response.output_item.added":
                        response_id = resp.get("response_id")
                        if response_id:
                            try:
                                await openai_ws.send(json.dumps({"type": "response.cancel", "response_id": response_id}))
                                logger.debug(f"🚫 Cancelled OpenAI output (Anthropic mode, post-transcription): {response_id}")
                            except Exception:
                                pass
                        continue

                    # Log ALL response types when using ElevenLabs (for debugging)
                    if elevenlabs_handler and rtype and rtype.startswith("response"):
                        logger.info(f"🔍 OpenAI response type: {rtype}")
                    
                    # Log errors with full details
                    if rtype == "error":
                        error_details = resp.get("error", {})
                        error_code = error_details.get("code", "")
                        # Suppress benign server_vad race condition: fires when VAD detects
                        # speech-stop on an already-empty input buffer (harmless, no action needed)
                        if error_code == "input_audio_buffer_commit_empty":
                            logger.debug(f"⚠️ VAD empty-buffer commit (benign, ignoring): {error_code}")
                        elif error_code == "response_cancel_not_active":
                            logger.debug(f"⚠️ Cancel arrived after response already finished (benign, ignoring): {error_code}")
                        else:
                            logger.error(f"❌ OpenAI Error: {error_details}")
                            logger.error(f"Full error response: {resp}")
                    
                    # ── Anthropic LLM mode: caller transcript → Claude → ElevenLabs ──
                    # OpenAI Realtime fires this when it has finished transcribing a caller turn
                    if use_anthropic and rtype == "conversation.item.input_audio_transcription.completed":
                        transcript = resp.get("transcript", "").strip()
                        if transcript:
                            last_transcript = transcript      # Save for pause-phrase detection
                            activity_event.set()              # Silence timer: customer just spoke
                        if transcript and elevenlabs_handler and not caller_speaking:
                            logger.info(f"🎙️ Caller said (Anthropic mode): {transcript}")
                            anthropic_conversation_history.append({"role": "user", "content": transcript})
                            # Cancel any ongoing reply before starting a new one
                            if current_reply_task and not current_reply_task.done():
                                current_reply_task.cancel()
                            current_reply_task = asyncio.create_task(_generate_reply(transcript))

                    # Track OpenAI usage for cost calculation
                    if rtype == "response.done":
                        usage = resp.get("response", {}).get("usage", {})
                        if usage:
                            input_tokens = usage.get("input_tokens", 0)
                            output_tokens = usage.get("output_tokens", 0)

                            openai_input_tokens += input_tokens
                            openai_output_tokens += output_tokens

                            # OpenAI Realtime API pricing per model:
                            # gpt-realtime:
                            #   text in $5/1M, cached $1.25/1M, text out $15/1M
                            # gpt-realtime-mini:
                            #   text in $0.60/1M, cached $0.15/1M, text out $2/1M
                            # gpt-4o-realtime-preview (any version):
                            #   text in $5/1M, cached $1.25/1M, audio in $100/1M, text out $20/1M
                            # gpt-4o-mini-realtime-preview (any version):
                            #   text in $0.60/1M, cached $0.15/1M, text out $2.40/1M

                            input_details = usage.get("input_token_details", {})
                            output_details = usage.get("output_token_details", {})

                            cached_text_tokens  = input_details.get("cached_tokens", 0)
                            audio_input_tokens  = input_details.get("audio_tokens", 0)
                            text_input_tokens   = max(0, input_tokens - audio_input_tokens - cached_text_tokens)
                            text_output_tokens  = output_details.get("text_tokens", output_tokens)
                            audio_output_tokens = output_details.get("audio_tokens", 0)

                            _m = selected_model or ""
                            if "4o-mini" in _m or "gpt-4o-mini" in _m:
                                _text_in   = 0.0000006
                                _cached_in = 0.00000015
                                _audio_in  = 0.0
                                _text_out  = 0.0000024
                                _audio_out = 0.0
                            elif "4o" in _m:
                                _text_in   = 0.000005
                                _cached_in = 0.00000125
                                _audio_in  = 0.0001
                                _text_out  = 0.00002
                                _audio_out = 0.0
                            elif "mini" in _m:
                                # gpt-realtime-mini
                                _text_in   = 0.0000006
                                _cached_in = 0.00000015
                                _audio_in  = 0.0
                                _text_out  = 0.000002
                                _audio_out = 0.0
                            else:
                                # gpt-realtime (GA)
                                _text_in   = 0.000005
                                _cached_in = 0.00000125
                                _audio_in  = 0.0
                                _text_out  = 0.000015
                                _audio_out = 0.0

                            input_cost  = (text_input_tokens  * _text_in
                                         + cached_text_tokens * _cached_in
                                         + audio_input_tokens * _audio_in)
                            output_cost = (text_output_tokens  * _text_out
                                         + audio_output_tokens * _audio_out)

                            openai_cost += (input_cost + output_cost)

                            logger.info(
                                f"📊 OpenAI usage - "
                                f"text_in: {text_input_tokens}, cached: {cached_text_tokens}, "
                                f"audio_in: {audio_input_tokens}, "
                                f"text_out: {text_output_tokens}, audio_out: {audio_output_tokens}"
                            )
                            logger.info(f"💰 OpenAI cost this response: ${(input_cost + output_cost):.4f}, total: ${openai_cost:.4f}")

                    # Silence timer: OpenAI response complete (fires in both OpenAI and Anthropic STT mode)
                    if rtype == "response.done" and not use_anthropic:
                        activity_event.set()

                    # Handle function calls (Google Calendar)
                    if rtype == "response.function_call_arguments.done":
                        call_id = resp.get("call_id")
                        func_name = resp.get("name")
                        arguments = resp.get("arguments")
                        
                        logger.info(f"📞 Function call: {func_name} with args: {arguments}")
                        
                        try:
                            args = json.loads(arguments)
                            result = None
                            
                            # Execute the calendar function
                            if func_name == "check_availability":
                                result = check_availability(
                                    agent_id=int(agent_id),
                                    date=args.get("date"),
                                    time=args.get("time"),
                                    duration_minutes=args.get("duration_minutes", 30)
                                )
                            elif func_name == "create_appointment":
                                result = create_appointment(
                                    agent_id=int(agent_id),
                                    date=args.get("date"),
                                    time=args.get("time"),
                                    duration_minutes=args.get("duration_minutes"),
                                    customer_name=args.get("customer_name"),
                                    customer_phone=args.get("customer_phone"),
                                    notes=args.get("notes", "")
                                )
                            elif func_name == "list_appointments":
                                result = list_appointments(
                                    agent_id=int(agent_id),
                                    date=args.get("date")
                                )
                            
                            # Execute SMS functions
                            elif func_name == "send_order_confirmation":
                                logger.info(f"🔔 AI is calling send_order_confirmation tool!")
                                logger.info(f"📋 Args: {args}")
                                
                                from customer_notifications import send_order_confirmation_sms
                                
                                # Get business name and phone number
                                business_name = agent.get('business_name') or agent.get('name', 'Our Business')
                                agent_phone = agent.get('phone_number')
                                
                                logger.info(f"📞 Agent phone: {agent_phone}")
                                logger.info(f"🏢 Business name: {business_name}")
                                
                                result = send_order_confirmation_sms(
                                    customer_phone=args.get("customer_phone"),
                                    business_name=business_name,
                                    order_items=args.get("order_items"),
                                    total=args.get("total"),
                                    pickup_time=args.get("pickup_time"),
                                    delivery_address=args.get("delivery_address"),
                                    order_number=args.get("order_number"),
                                    from_number=agent_phone
                                )
                                logger.info(f"📱 Order confirmation SMS result: {result}")
                            
                            elif func_name == "send_appointment_confirmation":
                                logger.info(f"🔔 AI is calling send_appointment_confirmation tool!")
                                logger.info(f"📋 Args: {args}")
                                
                                from customer_notifications import send_appointment_confirmation_sms
                                
                                business_name = agent.get('business_name') or agent.get('name', 'Our Business')
                                agent_phone = agent.get('phone_number')
                                
                                logger.info(f"📞 Agent phone: {agent_phone}")
                                logger.info(f"🏢 Business name: {business_name}")
                                
                                result = send_appointment_confirmation_sms(
                                    customer_phone=args.get("customer_phone"),
                                    business_name=business_name,
                                    customer_name=args.get("customer_name"),
                                    service=args.get("service"),
                                    date=args.get("date"),
                                    time=args.get("time"),
                                    confirmation_number=args.get("confirmation_number"),
                                    from_number=agent_phone
                                )
                                logger.info(f"📱 Appointment confirmation SMS: {result}")
                            
                            # Log call summary
                            elif func_name == "log_call_summary":
                                nonlocal call_summary
                                call_summary = args.get("summary")
                                outcome = args.get("outcome")
                                
                                logger.info(f"📋 Call summary logged: {call_summary}")
                                logger.info(f"🎯 Outcome: {outcome}")
                                
                                result = {
                                    "success": True,
                                    "message": "Call summary recorded"
                                }
                            
                            # Process Square payment
                            elif func_name == "process_payment":
                                logger.info(f"💳 AI is processing payment via Square!")
                                logger.info(f"💰 Amount: ${args.get('amount')}")
                                
                                from square_integration import create_payment
                                
                                # Convert amount to cents
                                amount_dollars = args.get("amount")
                                amount_cents = int(amount_dollars * 100)
                                
                                result = create_payment(
                                    amount_cents=amount_cents,
                                    card_number=args.get("card_number"),
                                    exp_month=args.get("exp_month"),
                                    exp_year=args.get("exp_year"),
                                    cvv=args.get("cvv"),
                                    postal_code=args.get("postal_code"),
                                    customer_name=args.get("customer_name"),
                                    description=args.get("description"),
                                    reference_id=stream_sid  # Use call SID as reference
                                )
                                
                                if result.get("success"):
                                    logger.info(f"✅ Payment successful! ID: {result.get('payment_id')}")
                                    logger.info(f"💳 Card: ****{result.get('card_last_4')}")
                                else:
                                    logger.error(f"❌ Payment failed: {result.get('error')}")
                            
                            # Shopify product search
                            elif func_name == "search_shopify_products":
                                logger.info(f"🛍️ Searching Shopify products: {args.get('query')}")
                                
                                from shopify_integration import search_products
                                
                                # Get user's Shopify credentials
                                owner_user_id = agent.get('owner_user_id')
                                conn_temp = get_conn()
                                cur_temp = conn_temp.cursor()
                                cur_temp.execute(sql("""
                                    SELECT shopify_shop_name, shopify_access_token
                                    FROM users WHERE id = {PH}
                                """), (owner_user_id,))
                                shop_row = cur_temp.fetchone()
                                conn_temp.close()
                                
                                if shop_row:
                                    if isinstance(shop_row, dict):
                                        shop_name = shop_row.get('shopify_shop_name')
                                        access_token = shop_row.get('shopify_access_token')
                                    else:
                                        shop_name = shop_row[0]
                                        access_token = shop_row[1]
                                    
                                    result = search_products(shop_name, access_token, args.get('query'))
                                    logger.info(f"📦 Found {len(result.get('products', []))} products")
                                else:
                                    result = {"success": False, "error": "Shopify not configured"}
                            
                            # Shopify inventory check
                            elif func_name == "check_shopify_inventory":
                                logger.info(f"📊 Checking inventory for variant {args.get('variant_id')}")
                                
                                from shopify_integration import check_inventory
                                
                                owner_user_id = agent.get('owner_user_id')
                                conn_temp = get_conn()
                                cur_temp = conn_temp.cursor()
                                cur_temp.execute(sql("""
                                    SELECT shopify_shop_name, shopify_access_token
                                    FROM users WHERE id = {PH}
                                """), (owner_user_id,))
                                shop_row = cur_temp.fetchone()
                                conn_temp.close()
                                
                                if shop_row:
                                    if isinstance(shop_row, dict):
                                        shop_name = shop_row.get('shopify_shop_name')
                                        access_token = shop_row.get('shopify_access_token')
                                    else:
                                        shop_name = shop_row[0]
                                        access_token = shop_row[1]
                                    
                                    result = check_inventory(shop_name, access_token, args.get('variant_id'))
                                else:
                                    result = {"success": False, "error": "Shopify not configured"}
                            
                            # Shopify order creation
                            elif func_name == "create_shopify_order":
                                logger.info(f"🛒 Creating Shopify order for {args.get('customer_name')}")
                                
                                from shopify_integration import create_order
                                
                                owner_user_id = agent.get('owner_user_id')
                                conn_temp = get_conn()
                                cur_temp = conn_temp.cursor()
                                cur_temp.execute(sql("""
                                    SELECT shopify_shop_name, shopify_access_token
                                    FROM users WHERE id = {PH}
                                """), (owner_user_id,))
                                shop_row = cur_temp.fetchone()
                                conn_temp.close()
                                
                                if shop_row:
                                    if isinstance(shop_row, dict):
                                        shop_name = shop_row.get('shopify_shop_name')
                                        access_token = shop_row.get('shopify_access_token')
                                    else:
                                        shop_name = shop_row[0]
                                        access_token = shop_row[1]
                                    
                                    result = create_order(
                                        shop_name=shop_name,
                                        access_token=access_token,
                                        customer_email=args.get('customer_email'),
                                        customer_name=args.get('customer_name'),
                                        customer_phone=args.get('customer_phone'),
                                        line_items=args.get('line_items'),
                                        shipping_address=args.get('shipping_address'),
                                        financial_status="paid"  # Assuming payment already processed
                                    )
                                    
                                    if result.get("success"):
                                        logger.info(f"✅ Order created! Order #{result.get('order_number')}")
                                    else:
                                        logger.error(f"❌ Order creation failed: {result.get('error')}")
                                else:
                                    result = {"success": False, "error": "Shopify not configured"}
                            
                            if result:
                                # Send function result back to OpenAI
                                await openai_ws.send(json.dumps({
                                    "type": "conversation.item.create",
                                    "item": {
                                        "type": "function_call_output",
                                        "call_id": call_id,
                                        "output": json.dumps(result)
                                    }
                                }))
                                
                                # Request AI response with function result
                                await openai_ws.send(json.dumps({"type": "response.create"}))
                                
                                logger.info(f"✅ Function result sent: {result}")
                                
                        except Exception as e:
                            logger.error(f"❌ Function call error: {e}")

                    # Handle text deltas for ElevenLabs (when modalities include text)
                    # Skip in Anthropic mode — Claude handles responses separately via transcription.completed
                    if use_elevenlabs and not use_anthropic and rtype == "response.text.delta":
                        text_delta = resp.get("delta", "")
                        if text_delta and elevenlabs_handler:
                            logger.info(f"📝 ElevenLabs text delta: {text_delta[:50]}")
                            await elevenlabs_handler.handle_text_delta(text_delta)

                    # Handle audio transcripts for ElevenLabs (NEW APPROACH)
                    # Skip in Anthropic mode — Claude handles responses separately via transcription.completed
                    if use_elevenlabs and not use_anthropic and rtype == "response.audio_transcript.delta":
                        transcript_delta = resp.get("delta", "")
                        if transcript_delta and elevenlabs_handler:
                            logger.info(f"📝 ElevenLabs transcript delta: {transcript_delta[:50]}")
                            await elevenlabs_handler.handle_text_delta(transcript_delta)

                    # Handle text completion for ElevenLabs
                    # Skip in Anthropic mode — flush is called after Claude responds
                    if use_elevenlabs and not use_anthropic and rtype in ("response.text.done", "response.audio_transcript.done"):
                        if elevenlabs_handler:
                            logger.info(f"✅ ElevenLabs text/transcript complete, flushing buffer")
                            await elevenlabs_handler.flush()

                    # Stream audio back to Twilio (only for OpenAI voices, block for ElevenLabs)
                    if rtype in ("response.output_audio.delta", "response.audio.delta"):
                        if use_elevenlabs:
                            # Block OpenAI audio when using ElevenLabs (we'll use the transcript instead)
                            logger.info(f"🚫 Blocking OpenAI audio (using ElevenLabs)")
                            continue
                        else:
                            # For OpenAI voices: send audio to caller
                            logger.info(f"🔊 OpenAI audio delta (use_elevenlabs={use_elevenlabs})")
                        audio_b64 = resp.get("delta")
                        if not audio_b64 or not stream_sid:
                            continue

                        # Detect new assistant item to start truncation timer
                        item_id = resp.get("item_id")
                        if item_id and item_id != last_assistant_item:
                            response_start_timestamp_twilio = latest_media_timestamp
                            last_assistant_item = item_id

                        await websocket.send_text(
                            json.dumps(
                                {
                                    "event": "media",
                                    "streamSid": stream_sid,
                                    "media": {"payload": audio_b64},
                                }
                            )
                        )
                        await send_mark()

                    # 2) If caller starts speaking, interrupt assistant
                    if rtype == "input_audio_buffer.speech_started":
                        print("🗣️ speech_started → interrupt")
                        activity_event.set()  # Silence timer: customer is speaking
                        await handle_speech_started_event()

                    # 3) Caller stopped speaking — clear the barge-in flag
                    if rtype == "input_audio_buffer.speech_stopped":
                        caller_speaking = False
                        elevenlabs_interrupted.clear()  # Reset for next AI turn
                        logger.info("🔇 Caller stopped speaking")

                    # server_vad auto-commits and auto-creates a response when speech stops,
                    # so we do NOT manually commit here — doing so causes
                    # "input_audio_buffer_commit_empty" errors.

            except Exception as e:
                print(f"Error in send_to_twilio: {e}")

        try:
            await asyncio.gather(receive_from_twilio(), send_to_twilio(), silence_watchdog())
        finally:
            if current_reply_task and not current_reply_task.done():
                current_reply_task.cancel()
                try:
                    await current_reply_task
                except (asyncio.CancelledError, Exception):
                    pass


def get_calendar_tools(agent_id: int) -> list:
    """
    Return OpenAI function definitions for Google Calendar if connected.
    Returns empty list if calendar not connected.
    """
    # Check if agent has calendar connected
    from db import get_conn, sql
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        sql("SELECT google_calendar_credentials FROM agents WHERE id = {PH}"),
        (agent_id,)
    )
    row = cur.fetchone()
    conn.close()
    
    if not row:
        return []
    
    # Handle both dict (PostgreSQL) and tuple (SQLite)
    creds = row.get('google_calendar_credentials') if isinstance(row, dict) else row[0]
    
    if not creds:
        return []
    
    # Calendar is connected - return tool definitions
    return [
        {
            "type": "function",
            "name": "check_availability",
            "description": "Check if a time slot is available in the calendar. Use this before booking appointments.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format (e.g., 2024-03-15)"
                    },
                    "time": {
                        "type": "string",
                        "description": "Time in HH:MM 24-hour format (e.g., 14:30 for 2:30 PM)"
                    },
                    "duration_minutes": {
                        "type": "integer",
                        "description": "Duration of appointment in minutes (default 30)"
                    }
                },
                "required": ["date", "time"]
            }
        },
        {
            "type": "function",
            "name": "create_appointment",
            "description": "Create a new appointment in the calendar after confirming availability.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format"
                    },
                    "time": {
                        "type": "string",
                        "description": "Time in HH:MM 24-hour format"
                    },
                    "duration_minutes": {
                        "type": "integer",
                        "description": "Duration in minutes"
                    },
                    "customer_name": {
                        "type": "string",
                        "description": "Customer's full name"
                    },
                    "customer_phone": {
                        "type": "string",
                        "description": "Customer's phone number"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Additional notes or reason for appointment"
                    }
                },
                "required": ["date", "time", "duration_minutes", "customer_name", "customer_phone"]
            }
        },
        {
            "type": "function",
            "name": "list_appointments",
            "description": "List all appointments for a specific date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format"
                    }
                },
                "required": ["date"]
            }
        }
    ]


async def initialize_session(openai_ws, instructions: str, voice: str | None = None, tools: dict | None = None, first_message: str | None = None, use_elevenlabs: bool = False, stt_only: bool = False):
    """
    Configure OpenAI Realtime session for Twilio Media Streams (G.711 u-law).

    Args:
        use_elevenlabs: If True, only request TEXT output from OpenAI (ElevenLabs handles TTS)
        stt_only: If True, OpenAI is used purely for STT/transcription — Anthropic handles LLM.
                  In this mode OpenAI won't generate any responses at all.
    """

    if stt_only:
        # STT-only mode for Anthropic LLM: OpenAI transcribes audio, fires
        # conversation.item.input_audio_transcription.completed, but generates NO responses.
        session_update = {
            "type": "session.update",
            "session": {
                "modalities": ["text"],          # Minimal — no audio output needed
                "input_audio_format": "g711_ulaw",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {"model": "whisper-1"},
                # Instruct OpenAI NOT to auto-respond — Anthropic will handle it
                "instructions": "You are a transcription service only. Do not generate any responses. Just transcribe what the user says.",
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 800,
                },
            },
        }
    else:
        # IMPORTANT: When using ElevenLabs, only request TEXT from OpenAI
        # This prevents OpenAI from generating (and charging for) audio we don't use
        modalities = ["text"] if use_elevenlabs else ["text", "audio"]
        session_update = {
            "type": "session.update",
            "session": {
                "modalities": modalities,
                "input_audio_format": "g711_ulaw",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {"model": "whisper-1"},
                "instructions": instructions,
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.6,
                    "prefix_padding_ms": 500,
                    "silence_duration_ms": 1000,
                },
            },
        }
        if tools:
            session_update["session"]["tools"] = tools

    # Voice is always required by OpenAI Realtime
    session_update["session"]["voice"] = voice or VOICE

    await openai_ws.send(json.dumps(session_update))
    
    


def get_sms_tools() -> list:
    """
    Return OpenAI function definitions for sending customer SMS confirmations.
    Always available (uses Twilio).
    """
    return [
        {
            "type": "function",
            "name": "send_order_confirmation",
            "description": "Send SMS order confirmation to customer after they place an order and provide payment. ALWAYS use this after successfully taking an order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_phone": {
                        "type": "string",
                        "description": "Customer's phone number in E.164 format (e.g., +17045551234)"
                    },
                    "order_items": {
                        "type": "string",
                        "description": "Description of items ordered (e.g., '2 Large Pepperoni Pizzas, Garlic Bread')"
                    },
                    "total": {
                        "type": "number",
                        "description": "Total amount charged including tax and fees"
                    },
                    "pickup_time": {
                        "type": "string",
                        "description": "When order will be ready for pickup (e.g., '6:30 PM')"
                    },
                    "delivery_address": {
                        "type": "string",
                        "description": "Delivery address if applicable"
                    },
                    "order_number": {
                        "type": "string",
                        "description": "Order confirmation number if available"
                    }
                },
                "required": ["customer_phone", "order_items", "total"]
            }
        },
        {
            "type": "function",
            "name": "send_appointment_confirmation",
            "description": "Send SMS appointment confirmation to customer after successfully booking an appointment. ALWAYS use this after booking an appointment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_phone": {
                        "type": "string",
                        "description": "Customer's phone number in E.164 format"
                    },
                    "customer_name": {
                        "type": "string",
                        "description": "Customer's full name"
                    },
                    "service": {
                        "type": "string",
                        "description": "Type of service/appointment (e.g., 'Haircut', 'Dental Cleaning')"
                    },
                    "date": {
                        "type": "string",
                        "description": "Appointment date (e.g., 'February 25, 2026')"
                    },
                    "time": {
                        "type": "string",
                        "description": "Appointment time (e.g., '2:00 PM')"
                    },
                    "confirmation_number": {
                        "type": "string",
                        "description": "Confirmation number if available"
                    }
                },
                "required": ["customer_phone", "customer_name", "service", "date", "time"]
            }
        }
    ]


def get_call_summary_tool() -> list:
    """
    Return OpenAI function definition for logging call summary.
    AI calls this to record what was accomplished during the call.
    """
    return [
        {
            "type": "function",
            "name": "log_call_summary",
            "description": "Log what was accomplished during this call. Call this near the end of the conversation to record the outcome.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Brief summary of what was accomplished (e.g., 'Scheduled haircut appointment for Feb 25 at 2pm' or 'Took order for 2 large pizzas, total $28.99, pickup at 6:30pm')"
                    },
                    "outcome": {
                        "type": "string",
                        "enum": ["appointment_scheduled", "order_placed", "question_answered", "escalated", "no_action"],
                        "description": "Primary outcome of the call"
                    }
                },
                "required": ["summary", "outcome"]
            }
        }
    ]


def get_square_payment_tool() -> list:
    """
    Return OpenAI function definition for processing Square payments.
    AI calls this to charge customer's credit card during call.
    """
    return [
        {
            "type": "function",
            "name": "process_payment",
            "description": "Process a credit card payment through Square. Use this after customer provides card details.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {
                        "type": "number",
                        "description": "Total amount to charge in dollars (e.g., 29.99)"
                    },
                    "card_number": {
                        "type": "string",
                        "description": "16-digit credit card number"
                    },
                    "exp_month": {
                        "type": "string",
                        "description": "Expiration month (2 digits, e.g., '12')"
                    },
                    "exp_year": {
                        "type": "string",
                        "description": "Expiration year (4 digits, e.g., '2025')"
                    },
                    "cvv": {
                        "type": "string",
                        "description": "3-digit CVV security code"
                    },
                    "postal_code": {
                        "type": "string",
                        "description": "Billing ZIP code"
                    },
                    "customer_name": {
                        "type": "string",
                        "description": "Cardholder name"
                    },
                    "description": {
                        "type": "string",
                        "description": "Payment description (e.g., 'Order #12345 - 2 Large Pizzas')"
                    }
                },
                "required": ["amount", "card_number", "exp_month", "exp_year", "cvv", "postal_code"]
            }
        }
    ]


def get_shopify_tools() -> list:
    """
    Return OpenAI function definitions for Shopify product operations.
    AI can search products, check inventory, and create orders.
    """
    return [
        {
            "type": "function",
            "name": "search_shopify_products",
            "description": "Search for products in the Shopify store by name. Use this when customer asks about a product.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Product name or search term (e.g., 't-shirt', 'blue shoes')"
                    }
                },
                "required": ["query"]
            }
        },
        {
            "type": "function",
            "name": "check_shopify_inventory",
            "description": "Check if a product variant is in stock and get the price.",
            "parameters": {
                "type": "object",
                "properties": {
                    "variant_id": {
                        "type": "integer",
                        "description": "Shopify variant ID from search results"
                    }
                },
                "required": ["variant_id"]
            }
        },
        {
            "type": "function",
            "name": "create_shopify_order",
            "description": "Create an order in Shopify after customer confirms purchase and provides payment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {
                        "type": "string",
                        "description": "Customer's full name"
                    },
                    "customer_email": {
                        "type": "string",
                        "description": "Customer's email address"
                    },
                    "customer_phone": {
                        "type": "string",
                        "description": "Customer's phone number"
                    },
                    "line_items": {
                        "type": "array",
                        "description": "Products being ordered",
                        "items": {
                            "type": "object",
                            "properties": {
                                "variant_id": {"type": "integer"},
                                "quantity": {"type": "integer"},
                                "price": {"type": "string"}
                            }
                        }
                    },
                    "shipping_address": {
                        "type": "object",
                        "description": "Shipping address (if applicable)",
                        "properties": {
                            "address1": {"type": "string"},
                            "city": {"type": "string"},
                            "province": {"type": "string"},
                            "zip": {"type": "string"},
                            "country": {"type": "string"}
                        }
                    }
                },
                "required": ["customer_name", "customer_email", "customer_phone", "line_items"]
            }
        }
    ]


# ========== Voice Chat WebSocket Endpoint ==========

@app.websocket("/voice-chat")
async def voice_chat_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for voice chat with ISIBI
    Public endpoint - no authentication required
    """
    await websocket.accept()
    
    print(f"🎤 Voice chat connection from {websocket.client.host}")
    
    # Import voice chat handler
    from voice_chat import handle_voice_chat
    
    # Handle the voice chat session
    await handle_voice_chat(websocket, None)


# ========== Test Agent WebSocket Endpoint ==========

@app.websocket("/test-agent/{agent_id}")
async def test_agent_endpoint(websocket: WebSocket, agent_id: int):
    """
    WebSocket endpoint for testing an agent with voice
    Requires authentication via query parameter
    """
    await websocket.accept()
    
    # Get user_id from query parameter (token)
    token = websocket.query_params.get("token")
    
    if not token:
        await websocket.send(json.dumps({
            "type": "error",
            "error": "Authentication required"
        }))
        await websocket.close()
        return
    
    # Verify token
    try:
        from auth import verify_token
        user = verify_token(token)
        user_id = user["id"]
    except:
        await websocket.send(json.dumps({
            "type": "error",
            "error": "Invalid authentication"
        }))
        await websocket.close()
        return
    
    print(f"🎤 Test agent connection: agent_id={agent_id}, user_id={user_id}")
    
    # Import test agent handler
    from test_agent import handle_test_agent_call
    
    # Handle the test call
    await handle_test_agent_call(websocket, agent_id, user_id)
