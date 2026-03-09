# Twilio Setup Guide - Fix 503 Error

## ❌ Current Issue

Your endpoints are returning **503 Service Unavailable** because Twilio credentials are not configured.

```
Error: "Twilio not configured. Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to environment variables."
```

---

## ✅ Solution: Add Twilio Credentials to Render

### Step 1: Get Your Twilio Credentials

1. Go to [Twilio Console](https://console.twilio.com/)
2. Log in to your account
3. On the dashboard, you'll see:
   - **Account SID** (starts with "AC...")
   - **Auth Token** (click "Show" to reveal)

### Step 2: Add to Render Environment Variables

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click on your **isibi-backend** service
3. Click **Environment** tab in the left sidebar
4. Click **Add Environment Variable**

Add these three variables:

```
TWILIO_ACCOUNT_SID = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN = your_auth_token_here
BACKEND_URL = https://isibi-backend.onrender.com
```

### Step 3: Redeploy

After adding the environment variables, Render will automatically redeploy your service.

Or manually trigger: Click **Manual Deploy** → **Deploy latest commit**

### Step 4: Test

After deployment completes (~2 minutes), test:

```bash
curl -X POST https://isibi-backend.onrender.com/api/phone/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"country": "US"}'
```

Should return available numbers instead of 503!

---

## Environment Variables Summary

Your Render service should have these environment variables:

```bash
# Database
DATABASE_URL=postgresql://...  (auto-added by Render)

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Twilio (NEW - ADD THESE)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
BACKEND_URL=https://isibi-backend.onrender.com
```

---

## How to Find Your Twilio Credentials

### Visual Guide:

```
Twilio Console (console.twilio.com)
├── Dashboard (Home)
│   ├── Account SID: ACxxxxxxxx  ← Copy this
│   └── Auth Token: [Show] → Copy this
│
└── Phone Numbers
    └── Your numbers (if you have any)
```

### Screenshot Locations:

1. **Account SID**: Visible on dashboard (starts with "AC")
2. **Auth Token**: Click "Show" button, then copy

---

## After Setup

Once Twilio is configured, these endpoints will work:

✅ `POST /api/phone/search` - Search available numbers
✅ `POST /api/phone/purchase` - Buy a number
✅ `GET /api/phone/my-numbers` - View your numbers
✅ `DELETE /api/phone/release/{sid}` - Release a number

---

## Troubleshooting

### Error: "Invalid credentials"
- Double-check Account SID starts with "AC"
- Make sure Auth Token is copied correctly (no spaces)
- Verify you're using the **Live** credentials, not Test

### Error: Still getting 503
- Wait 2-3 minutes for Render to redeploy
- Check **Events** tab in Render to see if deploy succeeded
- Look at **Logs** tab for any startup errors

### Error: "No numbers available"
- Try different area codes
- Some area codes have limited availability
- Try without area code to see all available

---

## Quick Test After Setup

```bash
# Test 1: Search numbers
curl -X POST https://isibi-backend.onrender.com/api/phone/search \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"area_code": "704", "country": "US"}'

# Should return:
{
  "available_numbers": [
    {
      "phone_number": "+17045551234",
      "friendly_name": "704-555-1234",
      "locality": "Charlotte",
      "region": "NC",
      "monthly_cost": 1.15
    }
  ],
  "your_price": 5.00
}

# Test 2: Get your numbers
curl https://isibi-backend.onrender.com/api/phone/my-numbers \
  -H "Authorization: Bearer TOKEN"

# Should return:
{
  "numbers": [],
  "count": 0
}
```

---

## Next Steps

1. ✅ Add Twilio credentials to Render
2. ✅ Wait for redeploy
3. ✅ Test `/api/phone/search` endpoint
4. ✅ Purchase your first number
5. ✅ Create an agent with that number
6. ✅ Make a test call!

**Once configured, the 503 errors will go away!** 🎉
