# 🔍 Troubleshooting: ElevenLabs Voice Not Working

## Problem: Agent keeps using default OpenAI voice instead of ElevenLabs

---

## ✅ Checklist - Check These in Order:

### 1. **Did you run the database migration?**

The `agents` table needs new columns for voice provider.

```bash
python migrate_voice_providers.py
```

**Check if columns exist:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'agents' 
AND column_name IN ('voice_provider', 'elevenlabs_voice_id', 'voice_settings');
```

**Should return 3 rows.** If not, run the migration!

---

### 2. **Is the agent configured with ElevenLabs voice?**

**Check in database:**
```sql
SELECT id, name, voice_provider, elevenlabs_voice_id, voice 
FROM agents 
WHERE id = YOUR_AGENT_ID;
```

**Expected result:**
```
voice_provider: elevenlabs
elevenlabs_voice_id: 21m00Tcm4TlvDq8ikWAM  (or another voice ID)
```

**If NULL or "openai":**
The agent isn't configured for ElevenLabs!

---

### 3. **Update the agent via API:**

```bash
curl -X PATCH https://your-backend.onrender.com/api/agents/YOUR_AGENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "voice_provider": "elevenlabs",
    "elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM"
  }'
```

**Or via SQL:**
```sql
UPDATE agents 
SET voice_provider = 'elevenlabs',
    elevenlabs_voice_id = '21m00Tcm4TlvDq8ikWAM'
WHERE id = YOUR_AGENT_ID;
```

---

### 4. **Check Render Logs During Call**

Make a test call and watch the logs. You should see:

```
🔍 DEBUG - Agent voice config:
   voice_provider: elevenlabs
   elevenlabs_voice_id: 21m00Tcm4TlvDq8ikWAM
   use_elevenlabs: True
   stream_sid: MZ1234...
🎙️ Using ElevenLabs voice provider (voice_id: 21m00Tcm4TlvDq8ikWAM)
✅ ElevenLabsVoiceHandler initialized
```

**If you see:**
```
🔍 DEBUG - Agent voice config:
   voice_provider: openai  ❌ WRONG!
   elevenlabs_voice_id: None  ❌ NOT SET!
```

**Then the agent config wasn't saved properly.**

---

### 5. **Is ELEVENLABS_API_KEY set?**

Check Render environment variables:

```
ELEVENLABS_API_KEY=sk_...
```

**If missing:** Add it and redeploy.

---

### 6. **Check if main.py is deployed**

Make sure you deployed the updated main.py with ElevenLabs support.

**Check git:**
```bash
git log --oneline -1
# Should show commit with "ElevenLabs" in message
```

**Check file size:**
The updated main.py should be ~1570 lines (was ~1454 before).

```bash
wc -l main.py
# Should show: 1569 main.py
```

---

## 🔧 Quick Fix Steps:

### Step 1: Verify Migration Ran
```bash
python migrate_voice_providers.py
```

### Step 2: Update Agent Config
```sql
UPDATE agents 
SET voice_provider = 'elevenlabs',
    elevenlabs_voice_id = '21m00Tcm4TlvDq8ikWAM'  -- Rachel voice
WHERE id = 1;  -- Your agent ID
```

### Step 3: Verify Update
```sql
SELECT name, voice_provider, elevenlabs_voice_id FROM agents WHERE id = 1;
```

Should show:
```
name: My Agent
voice_provider: elevenlabs
elevenlabs_voice_id: 21m00Tcm4TlvDq8ikWAM
```

### Step 4: Test Call
Call your agent and check logs for:
```
🎙️ Using ElevenLabs voice provider
🎤 ElevenLabs generating: ...
```

---

## 📊 Common Issues:

### Issue 1: voice_provider is NULL
**Cause:** Migration didn't run or failed
**Fix:** Run migration again

### Issue 2: elevenlabs_voice_id is NULL
**Cause:** Agent not updated after migration
**Fix:** Update agent config via API or SQL

### Issue 3: voice_provider is "openai"
**Cause:** Frontend sends "openai" as default
**Fix:** Update agent to use "elevenlabs"

### Issue 4: Still using OpenAI voice
**Cause:** Code changes not deployed
**Fix:** Deploy updated main.py

### Issue 5: No audio at all
**Cause:** ELEVENLABS_API_KEY not set
**Fix:** Set environment variable in Render

---

## 🎯 Test Agent Configuration:

Create a fresh test agent via API:

```bash
curl -X POST https://your-backend.onrender.com/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ElevenLabs Test Agent",
    "system_prompt": "You are a helpful assistant. Keep responses short.",
    "voice_provider": "elevenlabs",
    "voice": "alloy",
    "elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM",
    "phone_number": "+17045551234"
  }'
```

Then call that agent's number.

---

## 📝 Verification SQL Queries:

### Check if columns exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agents' 
AND column_name LIKE '%voice%'
OR column_name LIKE '%eleven%';
```

Should return:
```
voice                 | character varying
voice_provider        | character varying
elevenlabs_voice_id   | character varying
voice_settings        | jsonb
```

### Check all agents' voice config:
```sql
SELECT id, name, voice_provider, elevenlabs_voice_id 
FROM agents 
ORDER BY id;
```

### Check agent loading in logs:
```sql
SELECT id, name, voice_provider, elevenlabs_voice_id, voice
FROM agents
WHERE id = (SELECT MAX(id) FROM agents);  -- Last created agent
```

---

## 🎤 Expected ElevenLabs Voice IDs:

Popular voices:
```
21m00Tcm4TlvDq8ikWAM - Rachel (calm, young female)
TxGEqnHWrfWFTfGW9XjX - Josh (deep, young male)
ErXwobaYiN019PkySvjV - Antoni (well-rounded, young male)
AZnzlk1XvdvUeBnXmlld - Domi (strong female)
EXAVITQu4vr4xnSDxMaL - Bella (soft, young female)
```

Get full list via API:
```bash
curl https://api.elevenlabs.io/v1/voices \
  -H "xi-api-key: YOUR_ELEVENLABS_KEY"
```

---

## ✅ Success Indicators:

When it's working, you'll see in logs:

1. **On call start:**
```
🔍 DEBUG - Agent voice config:
   voice_provider: elevenlabs
   elevenlabs_voice_id: 21m00Tcm4TlvDq8ikWAM
   use_elevenlabs: True
🎙️ Using ElevenLabs voice provider
🎙️ ElevenLabsVoiceHandler initialized with voice: 21m00...
✅ ElevenLabsVoiceHandler initialized
```

2. **During conversation:**
```
📝 ElevenLabs text delta: Hello! How can I...
🎤 ElevenLabs generating: Hello! How can I help you today?
✅ ElevenLabs text complete, flushing buffer
```

3. **You'll hear:**
The actual ElevenLabs voice (Rachel, Josh, etc.) - NOT the OpenAI default voice!

---

## 🚨 If Still Not Working:

Send me these logs from Render:

1. The "DEBUG - Agent voice config" section
2. Any errors about ElevenLabs
3. The agent row from database: `SELECT * FROM agents WHERE id = YOUR_ID;`

Most likely issue: **Agent not updated with voice_provider and elevenlabs_voice_id after migration!**

---

**Fix:** Update your agent config and it should work! 🎤
