# 🎙️ ElevenLabs Voice Provider Integration - Complete Guide

## 📦 Files Created:

1. **elevenlabs_integration.py** - Core ElevenLabs API integration
2. **voice_provider_endpoints.py** - API endpoints for voice selection
3. **migrate_voice_providers.py** - Database migration
4. **VoiceProviderSelector.tsx** - React component for voice selection
5. **elevenlabs_call_integration.py** - Call integration code

---

## 🚀 Deployment Steps:

### Step 1: Add Files to Your Repository

```bash
# Add the core integration
git add elevenlabs_integration.py

# Add migration script
git add migrate_voice_providers.py

# Commit
git commit -m "Add ElevenLabs voice provider integration"
git push origin main
```

### Step 2: Add Voice Provider Endpoints to portal.py

Open `portal.py` and add the contents of `voice_provider_endpoints.py` at the end (before admin endpoints or at the end):

```python
# Add these imports at the top of portal.py
from elevenlabs_integration import get_all_voice_options, get_available_voices, get_user_subscription

# Then add the voice provider endpoints (copy from voice_provider_endpoints.py)
```

### Step 3: Run Database Migration

```bash
# In your Render shell or locally
python migrate_voice_providers.py
```

This adds:
- `voice_provider` column (openai/elevenlabs)
- `elevenlabs_voice_id` column
- `voice_settings` JSON column

### Step 4: Set Environment Variable

In Render → Environment:

```
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

Get your API key from: https://elevenlabs.io/app/settings/api-keys

### Step 5: Update Requirements

Add to `requirements.txt`:

```
requests==2.31.0
```

### Step 6: Deploy

```bash
git add portal.py requirements.txt
git commit -m "Add voice provider endpoints"
git push origin main
```

---

## 🎨 Frontend Integration (Lovable):

### 1. Add the Component

Create file: `src/components/VoiceProviderSelector.tsx`

Copy contents from `VoiceProviderSelector.tsx`

### 2. Use in Agent Creation/Edit Form

```tsx
import VoiceProviderSelector from './components/VoiceProviderSelector';

function CreateAgentForm() {
  const [voiceConfig, setVoiceConfig] = useState({
    provider: 'openai',
    voice_id: 'alloy'
  });

  return (
    <div>
      {/* Other form fields */}
      
      <VoiceProviderSelector
        value={voiceConfig}
        onChange={setVoiceConfig}
        token={authToken}
      />
      
      {/* Submit button */}
    </div>
  );
}
```

### 3. Save Voice Configuration

When creating/updating agent:

```typescript
const agentData = {
  name: agentName,
  system_prompt: prompt,
  voice_provider: voiceConfig.provider,  // 'openai' or 'elevenlabs'
  voice: voiceConfig.provider === 'openai' ? voiceConfig.voice_id : 'alloy',  // OpenAI voice
  elevenlabs_voice_id: voiceConfig.provider === 'elevenlabs' ? voiceConfig.voice_id : null
};

// Send to API
await fetch('/api/agents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(agentData)
});
```

---

## 📊 API Endpoints:

### GET /api/voices/providers
Get all voice providers and their voices

**Response:**
```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "description": "High-quality AI voices with natural speech",
      "enabled": true,
      "voices": [
        {
          "id": "alloy",
          "name": "Alloy",
          "description": "Neutral, balanced voice"
        }
      ]
    },
    {
      "id": "elevenlabs",
      "name": "ElevenLabs",
      "description": "Ultra-realistic AI voices with emotion",
      "enabled": true,
      "voices": [
        {
          "voice_id": "21m00Tcm4TlvDq8ikWAM",
          "name": "Rachel",
          "description": "Calm, young, female American voice",
          "category": "premade"
        }
      ]
    }
  ]
}
```

### GET /api/voices/elevenlabs
Get ElevenLabs voices only

### GET /api/voices/elevenlabs/subscription
Get ElevenLabs usage and quota

### GET /api/voices/test/{provider}/{voice_id}
Test a voice by generating sample audio

**Query params:**
- `text` (optional): Custom text to speak (default: "Hello! This is a test...")

**For ElevenLabs:** Returns MP3 audio file
**For OpenAI:** Returns success message (can't generate samples without full setup)

---

## 🎯 Available Voices:

### OpenAI Voices (11 total):
- **alloy** - Neutral, balanced voice
- **echo** - Warm, friendly voice
- **fable** - Expressive, storytelling voice
- **onyx** - Deep, authoritative voice
- **nova** - Energetic, bright voice
- **shimmer** - Soft, gentle voice
- **ash** - Clear, professional voice
- **ballad** - Smooth, calm voice
- **coral** - Warm, engaging voice
- **sage** - Wise, thoughtful voice
- **verse** - Dynamic, expressive voice

### ElevenLabs Voices (Popular):
- **Rachel** - Calm, young, female American
- **Domi** - Strong, female American
- **Bella** - Soft, young, female American
- **Antoni** - Well-rounded, young, male American
- **Elli** - Emotional, young, female American
- **Josh** - Deep, young, male American
- **Arnold** - Crisp, middle-aged, male American
- **Adam** - Deep, middle-aged, male American
- **Sam** - Raspy, young, male American

Plus all custom voices in your ElevenLabs account!

---

## 🔧 Agent Configuration:

When creating an agent, you now specify:

```python
{
  "name": "My Agent",
  "system_prompt": "You are a helpful assistant...",
  
  # Voice configuration - Option 1: OpenAI
  "voice_provider": "openai",
  "voice": "sage",
  "elevenlabs_voice_id": null,
  
  # Voice configuration - Option 2: ElevenLabs
  "voice_provider": "elevenlabs",
  "voice": "alloy",  # Fallback OpenAI voice
  "elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM",  # Rachel
  
  # Other settings...
}
```

---

## ⚠️ Important Notes:

### ElevenLabs in Real-Time Calls:

The OpenAI Realtime API currently **doesn't support external TTS providers directly**. 

**Current Implementation:**
- OpenAI voices work fully in real-time calls
- ElevenLabs voices can be used for:
  - Greeting messages
  - Voicemails
  - Pre-recorded responses
  - Test audio generation

**Future Enhancement:**
To use ElevenLabs voices in live calls, you'll need:
1. OpenAI for speech recognition (hearing the user)
2. OpenAI for conversation logic
3. ElevenLabs for text-to-speech (AI speaking)
4. Custom audio pipeline to connect them

This adds complexity and latency, so OpenAI voices are recommended for live calls.

### Pricing:

**OpenAI Realtime API:**
- ~$0.06 per minute of audio input
- ~$0.24 per minute of audio output

**ElevenLabs:**
- Free tier: 10,000 characters/month
- Creator: $5/month for 30,000 characters
- Pro: $11/month for 100,000 characters

---

## 📱 UI Preview:

The VoiceProviderSelector component shows:

```
┌─────────────────────────────────────────┐
│ Voice Selection                         │
├─────────────────────────────────────────┤
│ Voice Provider                          │
│                                         │
│ ○ OpenAI                    11 voices  │
│   High-quality AI voices                │
│                                         │
│ ● ElevenLabs                9 voices   │
│   Ultra-realistic AI voices             │
│                                         │
│ Select Voice                            │
│ ┌───────┐ ┌───────┐ ┌───────┐         │
│ │Rachel │ │ Domi  │ │ Bella │         │
│ │Calm   │ │Strong │ │Soft   │         │
│ │[Test] │ │[Test] │ │[Test] │         │
│ └───────┘ └───────┘ └───────┘         │
│                                         │
│ Current Selection:                      │
│ Provider: ElevenLabs                    │
│ Voice: Rachel                           │
└─────────────────────────────────────────┘
```

---

## ✅ Deployment Checklist:

- [ ] Add `elevenlabs_integration.py` to repo
- [ ] Add voice endpoints to `portal.py`
- [ ] Run database migration
- [ ] Set `ELEVENLABS_API_KEY` in Render
- [ ] Add `requests` to `requirements.txt`
- [ ] Deploy backend
- [ ] Add `VoiceProviderSelector.tsx` to frontend
- [ ] Update agent create/edit forms
- [ ] Test voice selection
- [ ] Test voice samples

---

## 🎉 Benefits:

✅ **More voice options** - 20+ voices to choose from
✅ **Better quality** - ElevenLabs voices are ultra-realistic
✅ **Flexibility** - Switch providers per agent
✅ **Easy testing** - Preview voices before using
✅ **Future-proof** - Easy to add more providers later

**Deploy and give your users amazing voice options!** 🎤✨
