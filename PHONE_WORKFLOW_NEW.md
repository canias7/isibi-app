# Phone Number Purchase - NEW WORKFLOW
## Buy Number FIRST, Then Create Agent

## 🎯 New User Flow

```
Step 1: Purchase Phone Number
   ↓
Step 2: Create Agent with that number
   ↓  
Step 3: Agent ready to receive calls!
```

---

## API Endpoints (Updated)

### 1. Search Available Numbers (BEFORE creating agent)
**POST** `/api/phone/search`

**Request:**
```json
{
  "area_code": "704",  // Optional
  "country": "US",     // Optional
  "contains": "888"    // Optional
}
```

**Response:**
```json
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
```

---

### 2. Purchase Number (BEFORE creating agent)
**POST** `/api/phone/purchase`

**Request:**
```json
{
  "area_code": "704",
  "country": "US"
}
```

**Response:**
```json
{
  "success": true,
  "phone_number": "+17045551234",
  "twilio_sid": "PNxxxx...",
  "friendly_name": "User 1 - Reserved",
  "monthly_cost": 5.00,
  "message": "Phone number +17045551234 is ready! Use it when creating your agent."
}
```

**💡 Important:** Save the `phone_number` and `twilio_sid` to use in Step 3!

---

### 3. Create Agent (WITH the purchased number)
**POST** `/api/agents`

**Request:**
```json
{
  "assistant_name": "Juan",
  "business_name": "Barber 123",
  "phone_number": "+17045551234",        // From Step 2
  "twilio_number_sid": "PNxxxx...",      // From Step 2
  "first_message": "Hello!",
  "system_prompt": "You are...",
  "voice": "alloy"
}
```

**Response:**
```json
{
  "ok": true,
  "agent_id": 42
}
```

---

### 4. Get My Purchased Numbers
**GET** `/api/phone/my-numbers`

See all numbers you've purchased (to select one for agent creation).

**Response:**
```json
{
  "numbers": [
    {
      "phone_number": "+17045551234",
      "twilio_sid": "PNxxxx...",
      "friendly_name": "User 1 - Reserved",
      "monthly_cost": 5.00
    }
  ],
  "count": 1
}
```

---

### 5. Release Unused Number
**POST** `/api/phone/release/{twilio_sid}`

If user changes their mind before creating agent.

**Response:**
```json
{
  "success": true,
  "message": "Phone number released successfully"
}
```

---

## Frontend Implementation

### React Component - Complete Flow

```typescript
import { useState, useEffect } from 'react';

function CreateAgentFlow() {
  const [step, setStep] = useState(1); // 1 = phone, 2 = agent
  const [areaCode, setAreaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [purchasedNumber, setPurchasedNumber] = useState(null);
  const [agentData, setAgentData] = useState({
    assistant_name: '',
    business_name: '',
    voice: 'alloy',
    first_message: '',
    system_prompt: ''
  });

  // Step 1: Purchase Phone Number
  const purchasePhoneNumber = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/phone/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          area_code: areaCode || undefined,
          country: 'US'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setPurchasedNumber({
          phone_number: data.phone_number,
          twilio_sid: data.twilio_sid
        });
        setStep(2); // Move to agent creation
      }
    } catch (error) {
      alert('Failed to purchase number');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create Agent with the number
  const createAgent = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...agentData,
          phone_number: purchasedNumber.phone_number,
          twilio_number_sid: purchasedNumber.twilio_sid
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        alert(`Agent created! ID: ${data.agent_id}`);
        // Redirect to dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      alert('Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="phone-purchase-step">
        <h2>Step 1: Get Your Phone Number</h2>
        <p>Purchase a dedicated number for your agent ($5/month)</p>
        
        <div className="form-group">
          <label>Area Code (Optional)</label>
          <input
            type="text"
            placeholder="e.g., 704"
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value)}
            maxLength={3}
          />
        </div>

        <button 
          onClick={purchasePhoneNumber} 
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Purchasing...' : 'Purchase Number ($5/month)'}
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="agent-creation-step">
        <h2>Step 2: Create Your Agent</h2>
        
        <div className="phone-display">
          ✅ Phone Number: {purchasedNumber.phone_number}
        </div>

        <div className="form-group">
          <label>Agent Name *</label>
          <input
            type="text"
            value={agentData.assistant_name}
            onChange={(e) => setAgentData({
              ...agentData,
              assistant_name: e.target.value
            })}
          />
        </div>

        <div className="form-group">
          <label>Business Name</label>
          <input
            type="text"
            value={agentData.business_name}
            onChange={(e) => setAgentData({
              ...agentData,
              business_name: e.target.value
            })}
          />
        </div>

        <div className="form-group">
          <label>Voice</label>
          <select
            value={agentData.voice}
            onChange={(e) => setAgentData({
              ...agentData,
              voice: e.target.value
            })}
          >
            <option value="alloy">Alloy</option>
            <option value="echo">Echo</option>
            <option value="shimmer">Shimmer</option>
          </select>
        </div>

        <div className="form-group">
          <label>First Message</label>
          <textarea
            value={agentData.first_message}
            onChange={(e) => setAgentData({
              ...agentData,
              first_message: e.target.value
            })}
          />
        </div>

        <div className="form-group">
          <label>System Prompt</label>
          <textarea
            value={agentData.system_prompt}
            onChange={(e) => setAgentData({
              ...agentData,
              system_prompt: e.target.value
            })}
            rows={6}
          />
        </div>

        <button 
          onClick={createAgent} 
          disabled={loading || !agentData.assistant_name}
          className="btn-primary"
        >
          {loading ? 'Creating...' : 'Create Agent'}
        </button>

        <button 
          onClick={() => setStep(1)}
          className="btn-secondary"
        >
          ← Back
        </button>
      </div>
    );
  }
}
```

---

## Alternative: Select from Existing Numbers

If user already has purchased numbers:

```typescript
function SelectPhoneNumber({ onSelect }) {
  const [myNumbers, setMyNumbers] = useState([]);

  useEffect(() => {
    fetchMyNumbers();
  }, []);

  const fetchMyNumbers = async () => {
    const response = await fetch('/api/phone/my-numbers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setMyNumbers(data.numbers);
  };

  return (
    <div>
      <h3>Select a Number</h3>
      {myNumbers.map(num => (
        <div key={num.twilio_sid} className="number-option">
          <span>{num.phone_number}</span>
          <button onClick={() => onSelect(num)}>
            Use This Number
          </button>
        </div>
      ))}
      
      <button onClick={purchaseNew}>
        Purchase New Number
      </button>
    </div>
  );
}
```

---

## UI/UX Design

### Multi-Step Form

```
┌────────────────────────────────────────┐
│  Create Your Voice Agent               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│  Step 1 of 2: Phone Number             │
├────────────────────────────────────────┤
│                                        │
│  Get a dedicated phone number          │
│  for your agent                        │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ Area Code (Optional)             │ │
│  │ [704]                            │ │
│  └──────────────────────────────────┘ │
│                                        │
│  Monthly Cost: $5.00                   │
│                                        │
│  [Purchase Phone Number]               │
└────────────────────────────────────────┘

        ↓ After purchase ↓

┌────────────────────────────────────────┐
│  Create Your Voice Agent               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  Step 2 of 2: Agent Details            │
├────────────────────────────────────────┤
│                                        │
│  ✅ Phone: +1-704-555-1234             │
│                                        │
│  Agent Name *                          │
│  [Juan]                                │
│                                        │
│  Business Name                         │
│  [Barber 123]                          │
│                                        │
│  Voice                                 │
│  [Alloy ▼]                             │
│                                        │
│  First Message                         │
│  [Hello! How can I help you?]          │
│                                        │
│  System Prompt                         │
│  [You are a helpful assistant...]      │
│                                        │
│  [← Back]  [Create Agent]              │
└────────────────────────────────────────┘
```

---

## Benefits of This Flow

1. ✅ **Clear separation** - Buy number, then create agent
2. ✅ **Can preview numbers** before purchasing
3. ✅ **Can reuse numbers** - Select from previously purchased
4. ✅ **No wasted numbers** - Only buy when ready to create agent
5. ✅ **Better UX** - Two focused steps instead of one complex form

---

## Testing

```bash
# Step 1: Purchase number
curl -X POST https://isibi-backend.onrender.com/api/phone/purchase \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"area_code": "704"}'

# Response: {"phone_number": "+17045551234", "twilio_sid": "PNxxx..."}

# Step 2: Create agent with that number
curl -X POST https://isibi-backend.onrender.com/api/agents \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_name": "Juan",
    "phone_number": "+17045551234",
    "twilio_number_sid": "PNxxx..."
  }'
```

---

## Deploy Now! 🚀

```bash
git add portal.py db.py
git commit -m "Refactor: Buy phone number BEFORE creating agent"
git push origin main
```

Then update your frontend to follow the 2-step flow!
