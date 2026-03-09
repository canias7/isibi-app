# Critical Fixes for Voice Call Issues

## Problem Summary
Your AI agent isn't speaking during calls. The greeting is triggered but no audio is being generated.

## Root Causes Identified

### 1. **Empty Audio Buffer Error**
The VAD (Voice Activity Detection) is falsely detecting speech immediately when the call starts, trying to commit an empty audio buffer, which causes errors and interrupts the greeting.

### 2. **Missing Response Events** 
No `response.audio.delta` or `response.text.delta` events are being received, meaning OpenAI isn't generating any response content at all.

### 3. **Portal.py Database Error**
The voice update endpoint crashes due to incorrect dict/tuple handling.

---

## Files to Deploy

### ✅ portal.py (FIXED - Ready to deploy)
**Location:** Already uploaded in your initial request
**Issue Fixed:** KeyError when verifying voice updates (line 2370)
**Change:** Added proper dict/tuple handling for PostgreSQL compatibility

### ✅ main.py (FIXED - Ready to deploy)
**Location:** `/mnt/user-data/outputs/main.py`
**Issues Fixed:**
1. Empty buffer commit error
2. Added support for `response.text.delta` events
3. Adjusted VAD settings to reduce false triggers
4. Added output audio transcription

---

## Verification Steps

After deploying both files, test and look for these log changes:

### Before (OLD CODE):
```
🛑 speech_stopped → commit + response.create
```

### After (NEW CODE):
```
🛑 speech_stopped → waiting 200ms before commit
⚠️ Error committing audio buffer (likely empty): [error]
```

---

## Additional Debugging Needed

If the issue persists after deploying these fixes, the problem is that **OpenAI isn't generating any response at all**.

### Check for these logs:
```
📝 ElevenLabs text delta: [text]
🔊 OpenAI audio delta
```

If you DON'T see either of these, it means:
- OpenAI Realtime API isn't responding with content
- The greeting instruction might not be clear enough
- There might be an API connectivity issue

### Try This Alternative Greeting Approach

Instead of instructing the model to greet, send a conversation item directly:

In `main.py`, replace lines 670-684 with:

```python
# Send first message if configured
if not first_message_sent and first_message:
    logger.info(f"📢 Sending direct greeting message: {first_message}")
    
    # Send the greeting as a conversation item
    await openai_ws.send(json.dumps({
        "type": "conversation.item.create",
        "item": {
            "type": "message",
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": f"[SYSTEM: Greet the caller now. Say: {first_message}]"
            }]
        }
    }))
    
    # Then request a response
    await openai_ws.send(json.dumps({
        "type": "response.create"
    }))
    
    first_message_sent = True
    logger.info("📢 Greeting message sent")
```

---

## Quick Test

To verify OpenAI is working at all, try changing the greeting trigger to be simpler:

```python
await openai_ws.send(json.dumps({
    "type": "response.create",
    "response": {
        "modalities": ["text", "audio"],
        "instructions": "Say exactly: 'Hello, how can I help you today?'"
    }
}))
```

If this works, the issue is with how your system prompt is structured.

---

## System Prompt Issue?

Your system prompt is 5650 characters. Make sure Section 2 (mentioned in the greeting instruction) actually exists and contains greeting instructions. The greeting instruction says:

```
"Greet the caller now using the greeting from Section 2 of your system prompt."
```

If there's no "Section 2" in your system prompt, the AI won't know what to say!
