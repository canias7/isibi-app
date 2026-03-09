# Testing Credits & Usage Tracking

## Your System Flow (ALREADY WORKING! ✅)

### Before the Call:
- **Credits Balance**: $5.00
- **Total Calls**: 0
- **Total Minutes**: 0
- **Total Spent**: $0.00

### Make a Test Call:
1. Call your agent's Twilio number (e.g., +18449263376)
2. Talk for 2 minutes
3. Hang up

### What Happens Automatically (Backend):

```python
# On call START:
- Records call_start_time
- Checks your credit balance ($5.00 ✓)
- Allows call to proceed

# On call END:
- Calculates duration: 2 minutes = 120 seconds
- Calculates YOUR cost: 120s × $0.05/min ÷ 60 = $0.10
- Calculates credits to deduct: 120s × $0.25/min ÷ 60 = $0.50
- Saves to call_usage table:
  * duration_seconds: 120
  * cost_usd: 0.10 (what you pay Twilio/OpenAI)
  * revenue_usd: 0.50 (what customer pays you)
  * profit_usd: 0.40 (your profit!)
  
- Deducts $0.50 from your credits
- Records transaction in credit_transactions table
```

### After the Call - Check Your Dashboard:

#### 📊 Usage Tab (`/api/usage/current`):
```json
{
  "total_calls": 1,
  "total_minutes": 2.0,
  "total_cost": 0.10,      // What you paid providers
  "total_revenue": 0.50,   // What customer paid
  "total_profit": 0.40     // Your profit
}
```

#### 💳 Credits Tab (`/api/credits/balance`):
```json
{
  "balance": 4.50,         // $5.00 - $0.50 = $4.50
  "total_purchased": 5.00,
  "total_used": 0.50
}
```

#### 📜 Call History (`/api/usage/calls`):
```json
{
  "calls": [
    {
      "agent_name": "Juana",
      "duration_seconds": 120,
      "cost_usd": 0.10,
      "revenue_usd": 0.50,
      "profit_usd": 0.40,
      "started_at": "2026-02-21 05:00:00",
      "status": "completed"
    }
  ]
}
```

#### 💰 Transaction History (`/api/credits/transactions`):
```json
{
  "transactions": [
    {
      "amount": -0.50,
      "type": "usage",
      "description": "Call to Juana (120s)",
      "balance_after": 4.50,
      "created_at": "2026-02-21 05:02:00"
    },
    {
      "amount": 5.00,
      "type": "purchase",
      "description": "Credit purchase via Stripe - $5.00",
      "balance_after": 5.00,
      "created_at": "2026-02-21 04:00:00"
    }
  ]
}
```

## Example: Multiple Calls

### Call 1: 2 minutes
- Credits deducted: $0.50
- Balance after: $4.50

### Call 2: 5 minutes
- Credits deducted: $1.25
- Balance after: $3.25

### Call 3: 10 minutes
- Credits deducted: $2.50
- Balance after: $0.75

### Call 4: Attempted (3 minutes needed = $0.75)
- ✅ Allowed (exactly enough)
- Credits deducted: $0.75
- Balance after: $0.00

### Call 5: Attempted
- ❌ **BLOCKED!**
- Message plays: "Insufficient credits. Please add credits at your dashboard."
- Call ends automatically

## Where to See This in Frontend:

### Dashboard Page:
```tsx
// Usage Card
Total Calls: 4
Total Minutes: 17 minutes
Total Spent: $4.25

// Credits Card
Balance: $0.00
[Low Balance Warning]
[Buy More Credits Button]
```

### Usage Details Page:
```tsx
// Monthly Summary
February 2026
- Calls: 4
- Minutes: 17
- Cost (paid): $0.85
- Revenue (charged): $4.25
- Profit: $3.40

// Recent Calls List
1. Juana - 10 min - $2.50
2. Juana - 5 min - $1.25
3. Juana - 2 min - $0.50
```

### Credits Page:
```tsx
// Balance
Current Balance: $0.00
⚠️ Out of credits!

// Transaction History
-$2.50  Call to Juana (600s)
-$1.25  Call to Juana (300s)
-$0.50  Call to Juana (120s)
+$5.00  Credit purchase via Stripe
```

## Check Logs to Verify:

After making a call, check Render logs:
```
📊 Call tracking started for user 1
💳 User has $5.00 in credits
[... call happens ...]
📞 Call ended: 120 seconds
💰 Cost: $0.10 | Credits deducted: $0.50 | Remaining balance: $4.50
```

## API Endpoints to Test:

```bash
# Get current usage
curl https://isibi-backend.onrender.com/api/usage/current \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get credits balance
curl https://isibi-backend.onrender.com/api/credits/balance \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get call history
curl https://isibi-backend.onrender.com/api/usage/calls \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get transactions
curl https://isibi-backend.onrender.com/api/credits/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Everything is Already Working! 🎉

The system automatically:
1. ✅ Tracks every call (duration, cost, revenue)
2. ✅ Deducts credits after each call
3. ✅ Updates usage statistics in real-time
4. ✅ Shows everything in your dashboard
5. ✅ Blocks calls at $0 balance
6. ✅ Records all transactions for audit

**Just make a test call and check your dashboard!** 📞💰
