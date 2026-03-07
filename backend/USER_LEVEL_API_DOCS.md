# User-Level Dashboard API Endpoints

## ✅ ALL DATA IS USER-LEVEL (NOT AGENT-SPECIFIC)

Your backend is already configured to track everything at the **user level**, not per agent. This means:
- You can delete agents freely
- All usage, credits, and call history stays with the user
- Dashboard shows data across ALL agents owned by the user

---

## 📊 Usage Endpoints

### GET `/api/usage/current`
**Returns current month's aggregated usage for the user**

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "total_calls": 15,
  "total_minutes": 47.5,
  "total_cost": 2.375,      // What you paid providers ($0.05/min)
  "total_revenue": 11.875,  // What customers paid ($0.25/min)
  "total_profit": 9.50      // Your profit
}
```

**Frontend Usage:**
```typescript
const response = await fetch('/api/usage/current', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const usage = await response.json();

// Display in dashboard:
// Total Calls: {usage.total_calls}
// Minutes Used: {usage.total_minutes}
// Total Spent: ${usage.total_revenue} (what customers paid)
```

---

### GET `/api/usage/calls?limit=50`
**Returns call history for the user (all agents)**

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Params:**
- `limit` (optional): Number of calls to return (default: 50)

**Response:**
```json
{
  "calls": [
    {
      "id": 123,
      "agent_name": "Juan",
      "duration_seconds": 120,
      "cost_usd": 0.10,
      "revenue_usd": 0.50,
      "profit_usd": 0.40,
      "started_at": "2026-02-21 06:08:06",
      "ended_at": "2026-02-21 06:10:06",
      "status": "completed"
    },
    {
      "id": 122,
      "agent_name": "Maria",
      "duration_seconds": 300,
      "cost_usd": 0.25,
      "revenue_usd": 1.25,
      "profit_usd": 1.00,
      "started_at": "2026-02-21 05:00:00",
      "ended_at": "2026-02-21 05:05:00",
      "status": "completed"
    }
  ]
}
```

**Frontend Usage:**
```typescript
const response = await fetch('/api/usage/calls?limit=20', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { calls } = await response.json();

// Display as table:
calls.map(call => (
  <tr key={call.id}>
    <td>{call.agent_name}</td>
    <td>{(call.duration_seconds / 60).toFixed(1)} min</td>
    <td>${call.revenue_usd}</td>
    <td>{new Date(call.started_at).toLocaleString()}</td>
  </tr>
))
```

---

## 💳 Credits Endpoints

### GET `/api/credits/balance`
**Returns user's current credit balance**

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "balance": 17.50,
  "total_purchased": 20.00,
  "total_used": 2.50
}
```

**Frontend Usage:**
```typescript
const response = await fetch('/api/credits/balance', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const credits = await response.json();

// Display:
// Balance: ${credits.balance}
// Total Purchased: ${credits.total_purchased}
// Total Used: ${credits.total_used}
```

---

### GET `/api/credits/status`
**Check if user has credits (for warnings)**

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "has_credits": true,
  "balance": 17.50
}
```

**Frontend Usage:**
```typescript
const response = await fetch('/api/credits/status', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { has_credits, balance } = await response.json();

if (!has_credits) {
  // Show warning banner
  alert('Out of credits! Please purchase more.');
}
```

---

### GET `/api/credits/transactions?limit=10`
**Returns credit transaction history**

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Params:**
- `limit` (optional): Number of transactions (default: 50)

**Response:**
```json
{
  "transactions": [
    {
      "id": 45,
      "amount": -0.50,
      "type": "usage",
      "description": "Call to Juan (120s)",
      "balance_after": 17.50,
      "created_at": "2026-02-21 06:10:00"
    },
    {
      "id": 44,
      "amount": -1.25,
      "type": "usage",
      "description": "Call to Maria (300s)",
      "balance_after": 18.00,
      "created_at": "2026-02-21 05:05:00"
    },
    {
      "id": 43,
      "amount": 20.00,
      "type": "purchase",
      "description": "Credit purchase via Stripe - $20.00",
      "balance_after": 19.25,
      "created_at": "2026-02-21 04:00:00"
    }
  ]
}
```

**Frontend Usage:**
```typescript
const response = await fetch('/api/credits/transactions?limit=10', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { transactions } = await response.json();

// Display as list:
transactions.map(tx => (
  <div key={tx.id} className={tx.amount > 0 ? 'credit' : 'debit'}>
    <span>{tx.amount > 0 ? '+' : ''}{tx.amount}</span>
    <span>{tx.description}</span>
    <span>{new Date(tx.created_at).toLocaleDateString()}</span>
  </div>
))
```

---

## 🔄 How It All Works Together

### User Journey:
1. **User purchases credits** → `/api/credits/create-payment-intent`
2. **Stripe webhook adds credits** → Balance updated automatically
3. **User creates agents** → Multiple agents can exist
4. **Calls come in to ANY agent** → All tracked under user's account
5. **Credits deducted after each call** → From user's balance
6. **User views dashboard** → Sees aggregated data across all agents
7. **User deletes an agent** → Call history remains, no data loss

### Database Structure:
```
users
  └── user_credits (balance, total_purchased, total_used)
  └── credit_transactions (purchase/usage history)
  └── agents (can be deleted)
  └── call_usage (linked to user_id, agent_name preserved)
  └── monthly_usage (aggregated by user_id)
```

---

## 📱 Example Dashboard Layout

```tsx
function Dashboard() {
  const [usage, setUsage] = useState(null);
  const [credits, setCredits] = useState(null);
  const [calls, setCalls] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    // Fetch all user-level data
    fetchUsage();
    fetchCredits();
    fetchCalls();
    fetchTransactions();
  }, []);

  return (
    <div className="dashboard">
      {/* Credits Card */}
      <Card>
        <h2>Credit Balance</h2>
        <div className="balance">${credits?.balance}</div>
        <p>Total Purchased: ${credits?.total_purchased}</p>
        <p>Total Used: ${credits?.total_used}</p>
        <button onClick={() => navigate('/billing')}>
          Add Credits
        </button>
      </Card>

      {/* Usage Card */}
      <Card>
        <h2>This Month</h2>
        <div>Total Calls: {usage?.total_calls}</div>
        <div>Minutes: {usage?.total_minutes}</div>
        <div>Spent: ${usage?.total_revenue}</div>
      </Card>

      {/* Recent Calls */}
      <Card>
        <h2>Recent Calls</h2>
        <table>
          {calls.map(call => (
            <tr key={call.id}>
              <td>{call.agent_name}</td>
              <td>{(call.duration_seconds / 60).toFixed(1)}m</td>
              <td>${call.revenue_usd}</td>
            </tr>
          ))}
        </table>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <h2>Transactions</h2>
        {transactions.map(tx => (
          <div key={tx.id}>
            <span className={tx.amount > 0 ? 'positive' : 'negative'}>
              {tx.amount > 0 ? '+' : ''}{tx.amount}
            </span>
            <span>{tx.description}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
```

---

## ✅ Summary

**All endpoints are ALREADY user-level!**
- No changes needed to backend
- Just connect your frontend to these endpoints
- Data persists even when agents are deleted
- Each user sees only their own data

**Deploy the current backend files and you're good to go!** 🚀
