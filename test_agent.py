import os
import io
import json
import struct
import asyncio
import websockets
from datetime import datetime
from openai import OpenAI as OpenAIClient

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")


# ---------------------------------------------------------------------------
# Helpers for GPT-4o (non-realtime) pipeline
# ---------------------------------------------------------------------------

def pcm16_to_wav(pcm_bytes: bytes, sample_rate: int = 24000,
                 channels: int = 1, bits_per_sample: int = 16) -> io.BytesIO:
    """Wrap raw PCM16 bytes in a RIFF WAV container for Whisper."""
    data_len = len(pcm_bytes)
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + data_len, b'WAVE',
        b'fmt ', 16, 1, channels,
        sample_rate, byte_rate, block_align, bits_per_sample,
        b'data', data_len,
    )
    buf = io.BytesIO()
    buf.write(header)
    buf.write(pcm_bytes)
    buf.seek(0)
    buf.name = "audio.wav"
    return buf


class SimpleVAD:
    """
    Energy-threshold voice activity detector for PCM16 audio.
    Accumulates speech chunks and signals when the user stops speaking.
    """

    def __init__(self, sample_rate: int = 24000,
                 silence_threshold: float = 500,
                 speech_threshold: float = 800,
                 silence_duration_ms: int = 800,
                 min_speech_ms: int = 200):
        self.sample_rate = sample_rate
        self.silence_threshold = silence_threshold
        self.speech_threshold = speech_threshold
        self.silence_samples = int(sample_rate * silence_duration_ms / 1000)
        self.min_speech_samples = int(sample_rate * min_speech_ms / 1000)
        self.reset()

    def reset(self):
        self.audio_buffer = bytearray()
        self.is_speech = False
        self.consecutive_silence = 0
        self.total_speech_samples = 0

    def _rms(self, pcm_bytes: bytes) -> float:
        n = len(pcm_bytes) // 2
        if n == 0:
            return 0.0
        samples = struct.unpack(f"<{n}h", pcm_bytes[:n * 2])
        return (sum(s * s for s in samples) / n) ** 0.5

    def process_chunk(self, pcm_bytes: bytes) -> str:
        """
        Feed one PCM16 chunk.
        Returns: "silence" | "speech" | "end"
        "end" means the user finished speaking — call get_audio() then reset().
        """
        rms = self._rms(pcm_bytes)
        n_samples = len(pcm_bytes) // 2

        if rms >= self.speech_threshold:
            self.is_speech = True
            self.consecutive_silence = 0
            self.total_speech_samples += n_samples
            self.audio_buffer.extend(pcm_bytes)
            return "speech"

        if rms < self.silence_threshold:
            if self.is_speech:
                self.consecutive_silence += n_samples
                self.audio_buffer.extend(pcm_bytes)
                if self.consecutive_silence >= self.silence_samples:
                    if self.total_speech_samples >= self.min_speech_samples:
                        return "end"
                    self.reset()
                return "speech"
            return "silence"

        # between thresholds
        if self.is_speech:
            self.audio_buffer.extend(pcm_bytes)
            return "speech"
        return "silence"

    def get_audio(self) -> bytes:
        return bytes(self.audio_buffer)


# ---------------------------------------------------------------------------
# GPT-4o pipeline coroutines
# ---------------------------------------------------------------------------

async def _tts_openai(websocket, openai_client: OpenAIClient,
                      text: str, voice: str,
                      latency_state: dict) -> None:
    """Generate speech with OpenAI TTS-1 (MP3) and stream to client."""
    try:
        response = await asyncio.to_thread(
            openai_client.audio.speech.create,
            model="tts-1",
            voice=voice or "alloy",
            input=text,
            response_format="mp3",
        )
        audio_bytes = response.content
    except Exception as e:
        print(f"❌ OpenAI TTS error: {e}")
        return

    # Record latency on first byte
    if latency_state.get("user_speech_end_time") is not None:
        now = datetime.now()
        ms = int((now - latency_state["user_speech_end_time"]).total_seconds() * 1000)
        latency_state["latencies_ms"].append(ms)
        avg = int(sum(latency_state["latencies_ms"]) / len(latency_state["latencies_ms"]))
        latency_state["user_speech_end_time"] = None
        print(f"⚡ Latency (OpenAI TTS): {ms}ms (avg {avg}ms)")
        await websocket.send(json.dumps({
            "type": "latency.update",
            "latency_ms": ms,
            "avg_latency_ms": avg,
            "samples": len(latency_state["latencies_ms"]),
        }))

    await websocket.send(audio_bytes)


async def _tts_elevenlabs(websocket, text: str, voice_id: str,
                          latency_state: dict) -> None:
    """Generate speech with ElevenLabs (streaming MP3) and stream to client."""
    try:
        from elevenlabs_integration import stream_text_to_speech
        # Run sync generator in thread — collect all MP3 chunks
        chunks = await asyncio.to_thread(
            lambda: list(stream_text_to_speech(
                text=text,
                voice_id=voice_id,
                output_format="mp3_44100_128",  # MP3 so browser decodeAudioData works
            ))
        )
    except Exception as e:
        print(f"❌ ElevenLabs TTS error: {e}")
        return

    first = True
    for chunk in chunks:
        if not chunk:
            continue
        if first:
            first = False
            if latency_state.get("user_speech_end_time") is not None:
                now = datetime.now()
                ms = int((now - latency_state["user_speech_end_time"]).total_seconds() * 1000)
                latency_state["latencies_ms"].append(ms)
                avg = int(sum(latency_state["latencies_ms"]) / len(latency_state["latencies_ms"]))
                latency_state["user_speech_end_time"] = None
                print(f"⚡ Latency (ElevenLabs): {ms}ms (avg {avg}ms)")
                await websocket.send(json.dumps({
                    "type": "latency.update",
                    "latency_ms": ms,
                    "avg_latency_ms": avg,
                    "samples": len(latency_state["latencies_ms"]),
                }))
        await websocket.send(chunk)


async def _gpt4o_respond(
    websocket,
    openai_client: OpenAIClient,
    conversation_history: list,
    test_transcript: list,
    latency_state: dict,
    system_prompt: str,
    user_text: str,
    voice: str,
    tts_provider: str,
    elevenlabs_voice_id: str,
    is_greeting: bool = False,
) -> None:
    """Call GPT-4o, stream transcript to client, then TTS the response."""
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_text})

    if not is_greeting:
        conversation_history.append({"role": "user", "content": user_text})

    # Stream GPT-4o completion
    full_response = ""
    try:
        stream = await asyncio.to_thread(
            openai_client.chat.completions.create,
            model="gpt-4o",
            messages=messages,
            stream=True,
            temperature=0.8,
            max_tokens=500,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                full_response += delta
                await websocket.send(json.dumps({
                    "type": "response.audio_transcript.delta",
                    "delta": delta,
                }))
    except Exception as e:
        print(f"❌ GPT-4o error: {e}")
        return

    await websocket.send(json.dumps({"type": "response.audio_transcript.done"}))

    if not full_response:
        return

    # TTS
    if tts_provider == "elevenlabs" and elevenlabs_voice_id:
        await _tts_elevenlabs(websocket, full_response, elevenlabs_voice_id, latency_state)
    else:
        await _tts_openai(websocket, openai_client, full_response, voice, latency_state)

    # Save to history and transcript
    conversation_history.append({"role": "assistant", "content": full_response})
    test_transcript.append({
        "role": "assistant",
        "content": full_response,
        "timestamp": datetime.now().isoformat(),
    })

    await websocket.send(json.dumps({
        "type": "response.done",
        "response": {
            "output": [{"type": "message",
                        "content": [{"type": "text", "text": full_response}]}]
        },
    }))


async def _transcribe_and_respond(
    websocket,
    openai_client: OpenAIClient,
    pcm_audio: bytes,
    conversation_history: list,
    test_transcript: list,
    latency_state: dict,
    system_prompt: str,
    voice: str,
    tts_provider: str,
    elevenlabs_voice_id: str,
    lock: asyncio.Lock,
) -> None:
    """Transcribe user audio with Whisper then call GPT-4o + TTS."""
    async with lock:
        wav_buf = pcm16_to_wav(pcm_audio, sample_rate=24000)
        try:
            result = await asyncio.to_thread(
                openai_client.audio.transcriptions.create,
                model="whisper-1",
                file=wav_buf,
                response_format="text",
            )
            user_text = str(result).strip()
        except Exception as e:
            print(f"❌ Whisper error: {e}")
            return

        if not user_text:
            return

        print(f"👤 User (Whisper): {user_text}")
        await websocket.send(json.dumps({
            "type": "conversation.item.input_audio_transcription.completed",
            "transcript": user_text,
        }))
        test_transcript.append({
            "role": "user",
            "content": user_text,
            "timestamp": datetime.now().isoformat(),
        })

        await _gpt4o_respond(
            websocket, openai_client, conversation_history, test_transcript,
            latency_state, system_prompt, user_text,
            voice, tts_provider, elevenlabs_voice_id,
        )


async def handle_test_agent_call_gpt4o(
    websocket,
    agent_name: str,
    system_prompt: str,
    voice: str,
    tts_provider: str,
    elevenlabs_voice_id: str,
    vad_silence_duration_ms: int,
    agent_id: int,
    user_id: int,
) -> None:
    """
    GPT-4o non-realtime voice pipeline:
    client audio → SimpleVAD → Whisper STT → GPT-4o → TTS → client audio
    """
    openai_client = OpenAIClient(api_key=OPENAI_API_KEY)
    vad = SimpleVAD(
        sample_rate=24000,
        silence_duration_ms=vad_silence_duration_ms or 800,
    )
    conversation_history: list = []
    test_transcript: list = []
    test_started = datetime.now()
    latency_state = {
        "user_speech_end_time": None,
        "latencies_ms": [],
    }
    lock = asyncio.Lock()

    # Notify client which model is active
    await websocket.send(json.dumps({"type": "session.model", "model": "gpt-4o"}))

    # Send opening greeting
    await _gpt4o_respond(
        websocket, openai_client, conversation_history, test_transcript,
        latency_state, system_prompt,
        user_text="(greet the caller warmly as specified in your system prompt)",
        voice=voice, tts_provider=tts_provider,
        elevenlabs_voice_id=elevenlabs_voice_id,
        is_greeting=True,
    )

    # Main receive loop
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                state = vad.process_chunk(message)
                if state == "end":
                    pcm_audio = vad.get_audio()
                    vad.reset()
                    latency_state["user_speech_end_time"] = datetime.now()
                    await websocket.send(json.dumps(
                        {"type": "input_audio_buffer.speech_stopped"}
                    ))
                    asyncio.create_task(_transcribe_and_respond(
                        websocket, openai_client, pcm_audio,
                        conversation_history, test_transcript, latency_state,
                        system_prompt, voice, tts_provider, elevenlabs_voice_id,
                        lock,
                    ))
            else:
                data = json.loads(message)
                if data.get("type") == "end":
                    print("🔚 GPT-4o test call ended by user")
                    break
    except websockets.exceptions.ConnectionClosed:
        print("❌ Client disconnected (GPT-4o pipeline)")

    # Save test call log
    test_ended = datetime.now()
    duration_seconds = (test_ended - test_started).total_seconds()
    avg_latency_ms = (
        int(sum(latency_state["latencies_ms"]) / len(latency_state["latencies_ms"]))
        if latency_state["latencies_ms"] else None
    )
    print(f"💾 GPT-4o test call: {duration_seconds:.0f}s, "
          f"{len(test_transcript)} turns, avg latency {avg_latency_ms}ms")

    try:
        from db import get_conn, sql
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS test_calls (
                id SERIAL PRIMARY KEY,
                agent_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                transcript JSONB,
                duration_seconds INTEGER,
                avg_latency_ms INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute(sql("""
            INSERT INTO test_calls (agent_id, user_id, transcript, duration_seconds, avg_latency_ms)
            VALUES ({PH}, {PH}, {PH}, {PH}, {PH})
        """), (agent_id, user_id, json.dumps(test_transcript),
               int(duration_seconds), avg_latency_ms))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"⚠️ Failed to save GPT-4o test call log: {e}")


async def handle_test_agent_call(websocket, agent_id: int, user_id: int):
    """
    WebSocket handler for testing an agent via voice
    Uses OpenAI Realtime API with agent's configuration
    
    Args:
        websocket: WebSocket connection
        agent_id: Agent to test
        user_id: User testing the agent
    """
    print(f"🎤 Test call started for agent {agent_id} by user {user_id}")
    
    # Get agent configuration
    from db import get_conn, sql
    
    conn = get_conn()
    cur = conn.cursor()
    
    try:
        cur.execute(sql("""
            SELECT id, name, system_prompt, voice, owner_user_id,
                   model, voice_provider, elevenlabs_voice_id,
                   tts_provider, vad_silence_duration_ms
            FROM agents
            WHERE id = {PH} AND owner_user_id = {PH}
        """), (agent_id, user_id))

        agent_row = cur.fetchone()
        conn.close()

        if not agent_row:
            await websocket.send(json.dumps({
                "type": "error",
                "error": "Agent not found or access denied"
            }))
            return

        # Supported models
        REALTIME_MODELS = {
            "gpt-4o-realtime-preview-2025-06-03",
            "gpt-4o-mini-realtime-preview",
        }
        DEFAULT_MODEL = "gpt-4o-realtime-preview-2025-06-03"

        # Parse agent data
        if isinstance(agent_row, dict):
            agent_name = agent_row['name']
            system_prompt = agent_row['system_prompt']
            voice = agent_row['voice'] or 'alloy'
            agent_model = agent_row.get('model') or DEFAULT_MODEL
            elevenlabs_voice_id = agent_row.get('elevenlabs_voice_id')
            tts_provider = agent_row.get('tts_provider') or 'openai'
            vad_silence_ms = agent_row.get('vad_silence_duration_ms') or 800
        else:
            agent_name = agent_row[1]
            system_prompt = agent_row[2]
            voice = agent_row[3] or 'alloy'
            agent_model = (agent_row[5] if len(agent_row) > 5 else None) or DEFAULT_MODEL
            elevenlabs_voice_id = agent_row[7] if len(agent_row) > 7 else None
            tts_provider = (agent_row[8] if len(agent_row) > 8 else None) or 'openai'
            vad_silence_ms = (agent_row[9] if len(agent_row) > 9 else None) or 800

        print(f"✅ Testing agent: {agent_name} (voice: {voice}, model: {agent_model}, "
              f"tts: {tts_provider})")

        # Dispatch to GPT-4o non-realtime pipeline
        if agent_model == "gpt-4o":
            await handle_test_agent_call_gpt4o(
                websocket=websocket,
                agent_name=agent_name,
                system_prompt=system_prompt,
                voice=voice,
                tts_provider=tts_provider,
                elevenlabs_voice_id=elevenlabs_voice_id,
                vad_silence_duration_ms=vad_silence_ms,
                agent_id=agent_id,
                user_id=user_id,
            )
            return

        # Validate realtime model — fall back to default if unknown
        if agent_model not in REALTIME_MODELS:
            print(f"⚠️ Unknown model '{agent_model}', falling back to {DEFAULT_MODEL}")
            agent_model = DEFAULT_MODEL
        
    except Exception as e:
        print(f"❌ Failed to load agent: {e}")
        await websocket.send(json.dumps({
            "type": "error",
            "error": f"Failed to load agent: {str(e)}"
        }))
        return
    
    # Connect to OpenAI Realtime API using the agent's configured model
    openai_ws_url = f"wss://api.openai.com/v1/realtime?model={agent_model}"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "OpenAI-Beta": "realtime=v1"
    }
    
    try:
        async with websockets.connect(openai_ws_url, extra_headers=headers) as openai_ws:
            print(f"✅ Connected to OpenAI for test call (model: {agent_model})")

            # Notify the client which model is active
            await websocket.send(json.dumps({
                "type": "session.model",
                "model": agent_model
            }))
            
            # Configure session with agent's settings
            session_config = {
                "type": "session.update",
                "session": {
                    "modalities": ["audio", "text"],
                    "instructions": system_prompt,
                    "voice": voice,
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.7,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 800
                    },
                    "temperature": 0.8
                }
            }
            
            await openai_ws.send(json.dumps(session_config))
            print(f"📝 Session configured for test call")
            
            # Send initial greeting
            greeting = {
                "type": "response.create",
                "response": {
                    "modalities": ["audio", "text"],
                    "instructions": "Greet the caller as specified in your system prompt."
                }
            }
            await openai_ws.send(json.dumps(greeting))
            
            # Store test call transcript
            test_transcript = []
            test_started = datetime.now()

            # Latency tracking state
            latency_state = {
                "user_speech_end_time": None,   # When VAD detected end of user speech
                "first_audio_delta_time": None, # When first AI audio chunk arrived
                "latencies_ms": [],             # All recorded latency values
            }

            # Bidirectional relay
            async def relay_client_to_openai():
                """Forward audio from client to OpenAI"""
                try:
                    async for message in websocket:
                        if isinstance(message, bytes):
                            # Audio data - forward to OpenAI
                            await openai_ws.send(json.dumps({
                                "type": "input_audio_buffer.append",
                                "audio": message.hex()
                            }))
                        else:
                            # JSON command
                            data = json.loads(message)
                            if data.get("type") == "end":
                                print(f"🔚 Test call ended by user")
                                break
                except websockets.exceptions.ConnectionClosed:
                    print(f"❌ Client disconnected")

            async def relay_openai_to_client():
                """Forward responses from OpenAI to client"""
                try:
                    async for message in openai_ws:
                        data = json.loads(message)
                        event_type = data.get("type")

                        # VAD detected end of user speech — start the latency clock
                        if event_type == "input_audio_buffer.speech_stopped":
                            latency_state["user_speech_end_time"] = datetime.now()
                            latency_state["first_audio_delta_time"] = None

                        # Forward audio responses
                        if event_type == "response.audio.delta":
                            audio_delta = data.get("delta")
                            if audio_delta:
                                # Record time-to-first-audio-chunk (response latency)
                                if (
                                    latency_state["user_speech_end_time"] is not None
                                    and latency_state["first_audio_delta_time"] is None
                                ):
                                    latency_state["first_audio_delta_time"] = datetime.now()
                                    latency_ms = int((
                                        latency_state["first_audio_delta_time"]
                                        - latency_state["user_speech_end_time"]
                                    ).total_seconds() * 1000)
                                    latency_state["latencies_ms"].append(latency_ms)
                                    avg_ms = int(
                                        sum(latency_state["latencies_ms"])
                                        / len(latency_state["latencies_ms"])
                                    )
                                    print(f"⚡ Latency: {latency_ms}ms (avg {avg_ms}ms)")

                                    # Send latency event to client
                                    await websocket.send(json.dumps({
                                        "type": "latency.update",
                                        "latency_ms": latency_ms,
                                        "avg_latency_ms": avg_ms,
                                        "samples": len(latency_state["latencies_ms"])
                                    }))

                                    # Reset speech end time so we don't double-count
                                    latency_state["user_speech_end_time"] = None

                                # Send audio chunk to client
                                audio_bytes = bytes.fromhex(audio_delta)
                                await websocket.send(audio_bytes)

                        # Log transcript
                        elif event_type == "response.audio_transcript.delta":
                            transcript = data.get("delta")
                            if transcript:
                                print(f"🤖 Agent: {transcript}")

                        elif event_type == "conversation.item.input_audio_transcription.completed":
                            transcript = data.get("transcript")
                            if transcript:
                                print(f"👤 User: {transcript}")

                                # Save to test transcript
                                test_transcript.append({
                                    "role": "user",
                                    "content": transcript,
                                    "timestamp": datetime.now().isoformat()
                                })

                        elif event_type == "response.done":
                            # Get AI response text
                            response_data = data.get("response", {})
                            output_items = response_data.get("output", [])

                            for item in output_items:
                                if item.get("type") == "message":
                                    content = item.get("content", [])
                                    for content_item in content:
                                        if content_item.get("type") == "text":
                                            test_transcript.append({
                                                "role": "assistant",
                                                "content": content_item.get("text", ""),
                                                "timestamp": datetime.now().isoformat()
                                            })

                        # Forward event to client
                        await websocket.send(json.dumps(data))

                except websockets.exceptions.ConnectionClosed:
                    print(f"❌ OpenAI disconnected")
            
            # Run both relays concurrently
            await asyncio.gather(
                relay_client_to_openai(),
                relay_openai_to_client()
            )
            
            # Save test call log
            test_ended = datetime.now()
            duration_seconds = (test_ended - test_started).total_seconds()
            
            try:
                conn = get_conn()
                cur = conn.cursor()
                
                # Create test_calls table if doesn't exist
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS test_calls (
                        id SERIAL PRIMARY KEY,
                        agent_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        transcript JSONB,
                        duration_seconds INTEGER,
                        avg_latency_ms INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                avg_latency_ms = (
                    int(sum(latency_state["latencies_ms"]) / len(latency_state["latencies_ms"]))
                    if latency_state["latencies_ms"] else None
                )

                # Insert test call log
                cur.execute(sql("""
                    INSERT INTO test_calls (agent_id, user_id, transcript, duration_seconds, avg_latency_ms)
                    VALUES ({PH}, {PH}, {PH}, {PH}, {PH})
                """), (agent_id, user_id, json.dumps(test_transcript), int(duration_seconds), avg_latency_ms))
                
                conn.commit()
                conn.close()
                
                print(f"💾 Test call logged: {duration_seconds}s, {len(test_transcript)} turns")
                
            except Exception as e:
                print(f"⚠️ Failed to save test call log: {e}")
    
    except Exception as e:
        print(f"❌ Test call error: {e}")
        await websocket.send(json.dumps({
            "type": "error",
            "error": str(e)
        }))


def get_agent_test_calls(agent_id: int, user_id: int, limit: int = 10):
    """
    Get test call history for an agent
    
    Args:
        agent_id: Agent ID
        user_id: User ID (for auth)
        limit: Max number of calls to return
    
    Returns:
        List of test calls
    """
    from db import get_conn, sql
    
    try:
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute(sql("""
            SELECT id, agent_id, transcript, duration_seconds, created_at
            FROM test_calls
            WHERE agent_id = {PH} AND user_id = {PH}
            ORDER BY created_at DESC
            LIMIT {PH}
        """), (agent_id, user_id, limit))
        
        calls = []
        for row in cur.fetchall():
            if isinstance(row, dict):
                calls.append(row)
            else:
                calls.append({
                    "id": row[0],
                    "agent_id": row[1],
                    "transcript": json.loads(row[2]) if row[2] else [],
                    "duration_seconds": row[3],
                    "created_at": row[4].isoformat() if row[4] else None
                })
        
        conn.close()
        return calls
    
    except Exception as e:
        print(f"❌ Failed to get test calls: {e}")
        return []
