"""
Real ElevenLabs Voice Integration for Live Calls

This creates a hybrid system:
1. OpenAI Realtime API for speech recognition and conversation
2. ElevenLabs for text-to-speech (actual voice output)
3. Custom audio pipeline to connect them

Architecture:
    Caller Audio → OpenAI (STT + Logic) → Text → ElevenLabs (TTS) → Audio → Caller
"""

import asyncio
import websockets
import json
import base64
from elevenlabs_integration import stream_text_to_speech

# ========== Configuration ==========

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


class ElevenLabsVoiceHandler:
    """
    Handles ElevenLabs voice generation during live calls
    
    This intercepts OpenAI's text responses and converts them to
    ElevenLabs audio before sending to the caller.
    """
    
    def __init__(self, voice_id: str):
        self.voice_id = voice_id
        self.text_buffer = ""
        self.is_speaking = False
        
    async def handle_text_delta(self, text_delta: str, output_websocket):
        """
        Handle incoming text deltas from OpenAI
        Buffer text and generate speech when we have enough
        """
        self.text_buffer += text_delta
        
        # Generate speech when we have a complete sentence or enough text
        if self._should_generate_speech():
            await self.generate_and_stream_speech(output_websocket)
    
    def _should_generate_speech(self) -> bool:
        """Determine if we should generate speech now"""
        # Generate when we hit punctuation or have enough text
        if len(self.text_buffer) == 0:
            return False
        
        # Check for sentence endings
        if any(self.text_buffer.strip().endswith(p) for p in ['.', '!', '?', '。']):
            return True
        
        # Or if buffer is getting long
        if len(self.text_buffer) > 200:
            return True
        
        return False
    
    async def generate_and_stream_speech(self, output_websocket):
        """Generate speech from buffered text using ElevenLabs"""
        if not self.text_buffer.strip():
            return
        
        text_to_speak = self.text_buffer.strip()
        self.text_buffer = ""  # Clear buffer
        
        print(f"🎤 Generating ElevenLabs speech: {text_to_speak[:50]}...")
        
        try:
            # Stream audio from ElevenLabs
            for audio_chunk in stream_text_to_speech(
                text=text_to_speak,
                voice_id=self.voice_id,
                model_id="eleven_turbo_v2_5",  # Fastest model for low latency
                output_format="pcm_16000"  # Match Twilio's format
            ):
                # Convert to base64 and send to Twilio
                audio_b64 = base64.b64encode(audio_chunk).decode('utf-8')
                
                await output_websocket.send_json({
                    "event": "media",
                    "streamSid": output_websocket.stream_sid,
                    "media": {
                        "payload": audio_b64
                    }
                })
        
        except Exception as e:
            print(f"❌ Error generating ElevenLabs speech: {e}")
    
    async def flush(self, output_websocket):
        """Flush any remaining text in buffer"""
        if self.text_buffer.strip():
            await self.generate_and_stream_speech(output_websocket)


# ========== Main WebSocket Handler with ElevenLabs ==========

@app.websocket("/media-stream")
async def handle_media_stream_with_elevenlabs(websocket: WebSocket):
    """
    Handle Twilio media stream with ElevenLabs voice support
    """
    await websocket.accept()
    
    print("🔌 WebSocket connection opened")
    
    # Store connection info
    stream_sid = None
    call_sid = None
    agent = None
    openai_ws = None
    elevenlabs_handler = None
    
    try:
        # Get initial connection message from Twilio
        async for message in websocket.iter_text():
            data = json.loads(message)
            
            if data["event"] == "start":
                stream_sid = data["start"]["streamSid"]
                call_sid = data["start"]["callSid"]
                
                # Get call info
                custom_params = data["start"]["customParameters"]
                phone_number = custom_params.get("To", "")
                
                print(f"📞 Call started: {call_sid}")
                print(f"📱 Phone number: {phone_number}")
                
                # Get agent configuration
                agent = get_agent_by_phone(phone_number)
                if not agent:
                    print("❌ No agent found for this number")
                    await websocket.close()
                    return
                
                # Check if using ElevenLabs
                voice_provider = agent.get('voice_provider', 'openai')
                use_elevenlabs = voice_provider == 'elevenlabs'
                
                print(f"🎤 Voice provider: {voice_provider}")
                
                # Connect to OpenAI Realtime API
                openai_url = f"{OPENAI_REALTIME_URL}?model=gpt-4o-realtime-preview-2024-12-17"
                headers = {
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "OpenAI-Beta": "realtime=v1"
                }
                
                openai_ws = await websockets.connect(openai_url, extra_headers=headers)
                print("✅ Connected to OpenAI Realtime API")
                
                # Initialize ElevenLabs handler if needed
                if use_elevenlabs:
                    elevenlabs_voice_id = agent.get('elevenlabs_voice_id')
                    if elevenlabs_voice_id:
                        elevenlabs_handler = ElevenLabsVoiceHandler(elevenlabs_voice_id)
                        print(f"🎙️ Using ElevenLabs voice: {elevenlabs_voice_id}")
                
                # Configure OpenAI session
                session_config = {
                    "type": "session.update",
                    "session": {
                        "modalities": ["text", "audio"],  # We want TEXT output for ElevenLabs
                        "instructions": agent.get('system_prompt', 'You are a helpful assistant'),
                        "input_audio_format": "pcm16",
                        "input_audio_transcription": {
                            "model": "whisper-1"
                        },
                        "turn_detection": {
                            "type": "server_vad",
                            "threshold": agent.get('vad_threshold', 0.5),
                            "prefix_padding_ms": 300,
                            "silence_duration_ms": agent.get('vad_silence_duration', 500)
                        },
                        "temperature": 0.8,
                    }
                }
                
                # If using OpenAI voices, include output audio format
                if not use_elevenlabs:
                    session_config["session"]["output_audio_format"] = "pcm16"
                    session_config["session"]["voice"] = agent.get('voice', 'alloy')
                
                await openai_ws.send(json.dumps(session_config))
                print("✅ OpenAI session configured")
                
                # Start bidirectional communication
                await handle_bidirectional_stream(
                    twilio_ws=websocket,
                    openai_ws=openai_ws,
                    stream_sid=stream_sid,
                    elevenlabs_handler=elevenlabs_handler
                )
    
    except Exception as e:
        print(f"❌ Error in media stream: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        if openai_ws:
            await openai_ws.close()
        print("🔌 WebSocket connection closed")


async def handle_bidirectional_stream(
    twilio_ws,
    openai_ws,
    stream_sid,
    elevenlabs_handler=None
):
    """
    Handle bidirectional communication between Twilio and OpenAI
    with optional ElevenLabs voice generation
    """
    
    async def twilio_to_openai():
        """Forward audio from Twilio to OpenAI"""
        try:
            async for message in twilio_ws.iter_text():
                data = json.loads(message)
                
                if data["event"] == "media":
                    # Forward audio to OpenAI
                    audio_payload = data["media"]["payload"]
                    
                    await openai_ws.send(json.dumps({
                        "type": "input_audio_buffer.append",
                        "audio": audio_payload
                    }))
                
                elif data["event"] == "stop":
                    print("📞 Call ended by Twilio")
                    break
        
        except Exception as e:
            print(f"❌ Error in Twilio→OpenAI: {e}")
    
    async def openai_to_twilio():
        """Forward responses from OpenAI to Twilio (with ElevenLabs if enabled)"""
        try:
            async for message in openai_ws:
                data = json.loads(message)
                event_type = data.get("type")
                
                # Handle text deltas (for ElevenLabs)
                if elevenlabs_handler and event_type == "response.text.delta":
                    text_delta = data.get("delta", "")
                    await elevenlabs_handler.handle_text_delta(text_delta, twilio_ws)
                
                # Handle text completion (for ElevenLabs)
                elif elevenlabs_handler and event_type == "response.text.done":
                    # Flush any remaining text
                    await elevenlabs_handler.flush(twilio_ws)
                
                # Handle audio deltas (for OpenAI voices)
                elif not elevenlabs_handler and event_type == "response.audio.delta":
                    audio_delta = data.get("delta", "")
                    if audio_delta:
                        # Forward OpenAI audio directly to Twilio
                        await twilio_ws.send_json({
                            "event": "media",
                            "streamSid": stream_sid,
                            "media": {
                                "payload": audio_delta
                            }
                        })
                
                # Log other important events
                elif event_type in ["response.done", "error", "rate_limits.updated"]:
                    print(f"📨 OpenAI event: {event_type}")
                    if event_type == "error":
                        print(f"❌ Error details: {data}")
        
        except Exception as e:
            print(f"❌ Error in OpenAI→Twilio: {e}")
    
    # Run both directions concurrently
    await asyncio.gather(
        twilio_to_openai(),
        openai_to_twilio()
    )


# ========== Helper: Extended WebSocket Class ==========

class ExtendedWebSocket:
    """Extended WebSocket with stream_sid storage"""
    def __init__(self, ws, stream_sid):
        self.ws = ws
        self.stream_sid = stream_sid
    
    async def send_json(self, data):
        await self.ws.send(json.dumps(data))
    
    def __getattr__(self, name):
        return getattr(self.ws, name)
