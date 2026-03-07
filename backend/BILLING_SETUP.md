# Monthly Phone Number Billing - $1.15/month (No Markup)

## 💰 Pricing Structure

### Phone Numbers:
- **Customer pays**: $1.15/month (auto-deducted from credits)
- **You pay Twilio**: $1.15/month
- **Your profit**: $0.00 (pass-through pricing)

### Calls:
- **Customer pays**: $0.25/minute (auto-deducted from credits)
- **You pay Twilio**: $0.0085/minute
- **Your profit**: $0.2415/minute 🎉

### Why This Makes Sense:
- You make ALL your profit on call usage (huge margin!)
- Phone number is just overhead (no profit needed)
- Keeps pricing simple and competitive
- Customers happy with low monthly fee

---

## 📅 How Monthly Billing Works

### Automatic Billing (1st of Every Month):

1. **Script runs**: `billing_cron.py`
2. **Finds all agents** with phone numbers
3. **Deducts $1.15** from each customer's credits
4. **Creates transaction** in `credit_transactions` table
5. **Logs results** (success/failures)

### What Customers See:

**In their transactions:**
```
Date: Feb 1, 2026
Description: Monthly phone number fee: +17045551234 (Juan)
Amount: -$1.15
Balance After: $18.85
```

---

## 🚀 Setup Options

### Option 1: Render Cron Job (Easiest)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Cron Job**
3. Configure:
   ```
   Name: isibi-monthly-billing
   Repository: (same as your backend)
   Schedule: 0 0 1 * *
   Command: python billing_cron.py
   ```
4. Add environment variables (copy from main service):
   - `DATABASE_URL`
   - All other env vars

5. Save & Deploy

**Cost**: Free on Render!

---

### Option 2: GitHub Actions (Free Alternative)

Create `.github/workflows/monthly-billing.yml`:

```yaml
name: Monthly Phone Billing

on:
  schedule:
    - cron: '0 0 1 * *'  # 1st of month at midnight UTC
  workflow_dispatch:      # Manual trigger

jobs:
  billing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install psycopg2-binary
      
      - name: Run billing
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: python billing_cron.py
```

Add `DATABASE_URL` to your GitHub repo secrets.

---

### Option 3: Manual Endpoint (For Testing)

Call this API to manually trigger billing:

**POST** `/api/admin/billing/run-monthly`

**Response:**
```json
{
  "success": true,
  "total_charged": 23.00,
  "total_agents": 20,
  "failed_charges": []
}
```

---

## 🧪 Testing

### Test the billing script:

```bash
# Locally or in Render shell
python billing_cron.py
```

### Expected Output:

```
============================================================
Starting Monthly Phone Number Billing
Date: 2026-02-21 00:00:00
Agents with phone numbers: 3
============================================================

✅ Charged user_id=1 (john@example.com) $1.15 for +17045551234
✅ Charged user_id=2 (jane@example.com) $1.15 for +12125555678
❌ Failed to charge user_id=3 (bob@example.com): Insufficient credits

============================================================
Monthly Phone Number Billing Complete
============================================================
Total agents charged: 2
Total charged: $2.30
Failed charges: 1
Success rate: 66.7%

⚠️  Failed Charges:
  - bob@example.com (+13105559999)
    Agent: Support Bot
    Error: Insufficient credits

============================================================
```

---

## 📊 Example Scenarios

### Customer with 1 Agent (200 min/month):

**Monthly charges:**
```
Feb 1:  Phone fee    -$1.15  (auto-deducted)
Feb 5:  Call (30m)   -$7.50  (auto-deducted after call)
Feb 12: Call (50m)   -$12.50
Feb 18: Call (70m)   -$17.50
Feb 25: Call (50m)   -$12.50
────────────────────────────
Total deducted:      -$51.15

Starting balance:     $100.00
Ending balance:       $48.85
```

**Your costs to Twilio (end of month):**
```
Phone number: $1.15
Calls (200m):  $1.70  (200 × $0.0085)
────────────
Total:        $2.85
```

**Your profit:**
```
Revenue:  $51.15
Cost:     $2.85
────────────
Profit:   $48.30  🎉
```

---

## ⚠️ Handling Insufficient Credits

### When billing fails:

**Current behavior:**
- Charge fails
- Number stays active
- Customer can still make calls

**Recommended actions:**

1. **Send email warning**
2. **Grace period**: 7 days to add credits
3. **After grace period**: Suspend agent (optional)

**Add to `billing_cron.py`:**
```python
# After failed charge
if not result["success"]:
    # TODO: Send email to customer
    # send_warning_email(email, phone_number)
    
    # TODO: Mark for suspension after 7 days
    # schedule_suspension(agent_id, days=7)
```

---

## 📈 Revenue Breakdown

### With 50 Customers (avg 200 min/month each):

**Monthly charges:**
```
Phone fees: $57.50      (50 × $1.15)
Calls:      $2,500      (10,000 min × $0.25)
────────────────────
Total:      $2,557.50
```

**Your costs:**
```
Phone fees: $57.50      (50 × $1.15)
Calls:      $85.00      (10,000 min × $0.0085)
────────────────────
Total:      $142.50
```

**Your profit:**
```
Revenue:  $2,557.50
Cost:     $142.50
──────────────────
Profit:   $2,415/month 🚀
Margin:   94.4%
```

---

## 🎯 Next Steps

1. ✅ Deploy `billing_cron.py` to Render
2. ✅ Set up monthly cron job
3. ✅ Test with your own account first
4. ✅ Monitor first month's billing
5. ✅ Add email notifications (optional)

---

## Files to Deploy

1. **billing_cron.py** - The billing script
2. **portal.py** - Updated with $1.15 pricing
3. **db.py** - Already has `deduct_credits()` function

**Deploy command:**
```bash
git add billing_cron.py portal.py
git commit -m "Add monthly phone billing at $1.15/month (no markup)"
git push origin main
```

---

## Summary

✅ **Customers charged $1.15/month** per phone number
✅ **Auto-deducted from credits** on 1st of month
✅ **Zero markup** on phone fees
✅ **All profit from calls** (94%+ margin)
✅ **Automated billing** with cron job
✅ **Transaction history** tracked in database

**You break even on phone numbers, make bank on calls!** 💰
