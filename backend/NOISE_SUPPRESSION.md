# Audio Noise Suppression for OpenAI Realtime API

## Problem
Background noise causes OpenAI to:
- Trigger speech detection incorrectly
- Misinterpret what customer says
- Interrupt itself when there's ambient sound
- Reduce call quality

## Solutions

### 1. **Enable VAD (Voice Activity Detection) - Server Side**
OpenAI Realtime API has built-in VAD that can filter out background noise.

**Update session configuration:**

```python
# In main.py - initialize_session function
await openai_ws.send(json.dumps({
    "type": "session.update",
    "session": {
        "turn_detection": {
            "type": "server_vad",  # Use server-side voice detection
            "threshold": 0.7,       # Higher = more strict (0.0 - 1.0)
            "prefix_padding_ms": 300,  # Audio before speech
            "silence_duration_ms": 700  # How long silence = end of speech
        },
        "input_audio_format": "g711_ulaw",
        "output_audio_format": "g711_ulaw",
        "voice": voice,
        "instructions": instructions,
        "modalities": ["text", "audio"],
        "temperature": 0.8,
        "tools": tools
    }
}))
```

**Key Parameters:**
- `threshold` (0.5 default, 0.7 recommended): Higher = less sensitive to noise
- `prefix_padding_ms` (300ms): Include audio before speech starts
- `silence_duration_ms` (500ms default, 700ms recommended): Wait longer before considering speech done

---

### 2. **Twilio Noise Reduction - Call Level**

Enable Twilio's built-in noise cancellation when starting the call:

```xml
<!-- In /incoming-call endpoint -->
<Response>
    <Connect>
        <Stream url="wss://your-backend.onrender.com/media-stream">
            <Parameter name="noiseReduction" value="true"/>
            <Parameter name="echoCancellation" value="true"/>
        </Stream>
    </Connect>
</Response>
```

**Or programmatically:**

```python
# When creating the TwiML response
response = VoiceResponse()
connect = Connect()
stream = Stream(url='wss://your-backend.onrender.com/media-stream')
stream.parameter(name='noiseReduction', value='true')
stream.parameter(name='echoCancellation', value='true')
connect.append(stream)
response.append(connect)
```

---

### 3. **Audio Preprocessing - Client Side (Advanced)**

If using Twilio Client SDK, enable noise suppression:

```javascript
// Browser/Mobile client
const device = new Twilio.Device(token, {
  codecPreferences: ['opus', 'pcmu'],
  enableRingingState: true,
  sounds: {
    incoming: '/sounds/incoming.mp3'
  },
  // Enable noise cancellation
  audioConstraints: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
});
```

---

### 4. **Backend Audio Filtering (Python)**

Add audio preprocessing before sending to OpenAI:

```python
# Install: pip install noisereduce numpy

import noisereduce as nr
import numpy as np
import base64

def reduce_noise(audio_base64: str, sample_rate: int = 8000):
    """
    Apply noise reduction to audio before sending to OpenAI
    """
    # Decode base64 audio
    audio_bytes = base64.b64decode(audio_base64)
    
    # Convert to numpy array (assuming mulaw)
    audio_data = np.frombuffer(audio_bytes, dtype=np.uint8)
    
    # Apply noise reduction
    reduced_noise = nr.reduce_noise(y=audio_data, sr=sample_rate)
    
    # Convert back to base64
    cleaned_bytes = reduced_noise.tobytes()
    cleaned_base64 = base64.b64encode(cleaned_bytes).decode('utf-8')
    
    return cleaned_base64
```

**Use in media stream:**
```python
# In handle_twilio_ws function
elif evt == "media":
    payload = data.get("media", {}).get("payload")
    
    # Apply noise reduction
    cleaned_payload = reduce_noise(payload)
    
    # Send cleaned audio to OpenAI
    await openai_ws.send(json.dumps({
        "type": "input_audio_buffer.append",
        "audio": cleaned_payload
    }))
```

---

### 5. **Smart Interruption Handling**

Reduce false interruptions from background noise:

```python
# In main.py - add debouncing to speech detection

speech_started_time = None
SPEECH_CONFIRMATION_DELAY = 0.3  # seconds

async def handle_speech_started_event():
    nonlocal speech_started_time
    
    # Only interrupt if speech continues for 300ms
    speech_started_time = time.time()
    await asyncio.sleep(SPEECH_CONFIRMATION_DELAY)
    
    # Check if still speaking
    if speech_started_time and time.time() - speech_started_time >= SPEECH_CONFIRMATION_DELAY:
        # Confirmed speech - interrupt AI
        logger.info("🎤 Confirmed speech - interrupting AI")
        await openai_ws.send(json.dumps({
            "type": "response.cancel"
        }))
```

---

### 6. **Recommended Configuration**

Here's the optimal setup for noisy environments:

```python
# Session configuration
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.75,           # Strict (ignore quiet background)
    "prefix_padding_ms": 300,
    "silence_duration_ms": 800   # Wait longer before ending turn
}
```

**For very noisy environments:**
```python
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.85,           # Very strict
    "prefix_padding_ms": 200,
    "silence_duration_ms": 1000  # Even longer silence needed
}
```

**For quiet environments:**
```python
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,            # More sensitive
    "prefix_padding_ms": 300,
    "silence_duration_ms": 500   # Faster responses
}
```

---

## Implementation Priority

**Quick wins (do these first):**
1. ✅ Increase VAD threshold to 0.7-0.75
2. ✅ Increase silence_duration_ms to 700-800ms
3. ✅ Enable Twilio noise reduction

**Advanced (if still having issues):**
4. Add audio preprocessing with noisereduce
5. Implement speech confirmation delay
6. Add per-environment VAD profiles

---

## Testing

**Test in different environments:**
- ☎️ Quiet room (office)
- 🚗 Car with road noise
- 🏪 Busy restaurant/store
- 🏗️ Construction site

**Adjust threshold based on results:**
- Too many interruptions? → Increase threshold
- Missing user speech? → Decrease threshold
- AI cuts off too early? → Increase silence_duration_ms

---

## Monitoring

Add logging to track noise issues:

```python
# Log speech detection events
logger.info(f"🎤 Speech detected - threshold: {threshold}, duration: {duration}ms")

# Track false positives
if speech_duration < 100:  # Very short speech = likely noise
    logger.warning(f"⚠️ Possible false positive - {speech_duration}ms speech")
```

---

## Summary

**Best immediate fix:**
```python
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.75,
    "silence_duration_ms": 800
}
```

This will:
- Ignore most background noise
- Wait longer before considering speech finished
- Reduce false interruptions
- Improve call quality significantly

**Want me to implement these changes in your main.py?**
