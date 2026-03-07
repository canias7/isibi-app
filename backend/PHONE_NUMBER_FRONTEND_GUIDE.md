# Phone Number Purchase - Frontend Integration Guide

## 🎉 Backend is Ready!

Your backend now supports auto-purchasing Twilio phone numbers for agents. Here's how to integrate it in your frontend.

---

## API Endpoints

### 1. Search Available Numbers
**POST** `/api/agents/{agent_id}/phone/search`

Search for available phone numbers before purchasing.

**Request:**
```json
{
  "area_code": "704",  // Optional - e.g., "212", "415"
  "country": "US",     // Optional - default "US"
  "contains": "888"    // Optional - find numbers containing this
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

### 2. Purchase Number
**POST** `/api/agents/{agent_id}/phone/purchase`

Purchase a phone number for the agent.

**Request:**
```json
{
  "area_code": "704",  // Optional
  "country": "US"      // Optional
}
```

**Response:**
```json
{
  "success": true,
  "phone_number": "+17045551234",
  "twilio_sid": "PN...",
  "monthly_cost": 5.00,
  "message": "Phone number +17045551234 has been assigned to your agent!"
}
```

### 3. Get Phone Status
**GET** `/api/agents/{agent_id}/phone/status`

Check if agent has a phone number.

**Response:**
```json
{
  "has_number": true,
  "phone_number": "+17045551234",
  "twilio_sid": "PN...",
  "monthly_cost": 5.00
}
```

### 4. Release Number
**DELETE** `/api/agents/{agent_id}/phone/release`

Release/delete the phone number (happens automatically on agent delete).

**Response:**
```json
{
  "success": true,
  "message": "Phone number released successfully"
}
```

---

## Frontend Implementation

### React/TypeScript Example

```typescript
// Component for purchasing phone number
import { useState } from 'react';

function PhoneNumberPurchase({ agentId }: { agentId: number }) {
  const [areaCode, setAreaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState([]);

  // Search for available numbers
  const searchNumbers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/phone/search`, {
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
      setAvailableNumbers(data.available_numbers);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Purchase a number
  const purchaseNumber = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/phone/purchase`, {
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
        setPhoneNumber(data.phone_number);
        alert(`Success! Your number is ${data.phone_number}`);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Failed to purchase number');
    } finally {
      setLoading(false);
    }
  };

  // Release the number
  const releaseNumber = async () => {
    if (!confirm('Are you sure? This will release your phone number.')) {
      return;
    }
    
    try {
      await fetch(`/api/agents/${agentId}/phone/release`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setPhoneNumber('');
      alert('Number released successfully');
    } catch (error) {
      console.error('Release failed:', error);
    }
  };

  if (phoneNumber) {
    return (
      <div className="phone-number-display">
        <h3>📞 Your Agent's Number</h3>
        <div className="number">{phoneNumber}</div>
        <p>Monthly cost: $5.00</p>
        <button onClick={releaseNumber} className="btn-danger">
          Release Number
        </button>
      </div>
    );
  }

  return (
    <div className="phone-number-purchase">
      <h3>Get a Phone Number</h3>
      <p>Purchase a dedicated phone number for your agent ($5/month)</p>
      
      <div className="search-form">
        <input
          type="text"
          placeholder="Area code (optional)"
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value)}
          maxLength={3}
        />
        <button onClick={searchNumbers} disabled={loading}>
          Search Numbers
        </button>
      </div>

      {availableNumbers.length > 0 && (
        <div className="available-numbers">
          <h4>Available Numbers:</h4>
          {availableNumbers.map((num) => (
            <div key={num.phone_number}>
              {num.phone_number} - {num.locality}, {num.region}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={purchaseNumber}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? 'Purchasing...' : 'Purchase Number ($5/month)'}
      </button>
    </div>
  );
}

export default PhoneNumberPurchase;
```

---

## UI/UX Flow

### Agent Creation Page

```
┌─────────────────────────────────────┐
│  Create Your Voice Agent            │
├─────────────────────────────────────┤
│                                     │
│  Name: [Juan]                       │
│  Business: [Barber 123]             │
│  Voice: [Alloy ▼]                   │
│                                     │
│  ┌────────────────────────────┐    │
│  │ 📞 Phone Number            │    │
│  │                            │    │
│  │ ○ I'll add one later       │    │
│  │ ● Get a number now ($5/mo) │    │
│  │                            │    │
│  │ [Area Code: 704] Optional  │    │
│  │                            │    │
│  │ Available in your area:    │    │
│  │ • +1-704-555-1234          │    │
│  │ • +1-704-555-5678          │    │
│  │                            │    │
│  └────────────────────────────┘    │
│                                     │
│  [Create Agent & Purchase Number]  │
└─────────────────────────────────────┘
```

### Agent Dashboard (After Creation)

```
┌─────────────────────────────────────┐
│  Juan - Barber 123                  │
├─────────────────────────────────────┤
│                                     │
│  Status: ● Active                   │
│  Phone: +1-704-555-1234             │
│  Monthly Cost: $5.00                │
│                                     │
│  [Edit Agent]  [Delete Agent]       │
│                                     │
│  ⚠️ Note: Deleting will release     │
│     the phone number                │
└─────────────────────────────────────┘
```

---

## Testing

### 1. Test Phone Purchase
```bash
curl -X POST https://isibi-backend.onrender.com/api/agents/1/phone/purchase \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"area_code": "704", "country": "US"}'
```

### 2. Test Phone Status
```bash
curl https://isibi-backend.onrender.com/api/agents/1/phone/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Test Release
```bash
curl -X DELETE https://isibi-backend.onrender.com/api/agents/1/phone/release \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Environment Variables Needed

Make sure these are set in Render:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
BACKEND_URL=https://isibi-backend.onrender.com
```

---

## Pricing Strategy

### Your Costs:
- Twilio number: **$1.15/month**
- Twilio calls: **$0.0085/min**

### You Charge Customer:
- Phone number: **$5.00/month** (335% markup)
- Call usage: **$0.25/min** (5x markup)

### Example Customer Bill:
```
Agent with 200 minutes of calls/month:

Phone Number:   $5.00
Call Usage:     $50.00  (200 min × $0.25)
Total:          $55.00/month

Your Cost:
Phone Number:   $1.15
Call Usage:     $1.70   (200 min × $0.0085)
Total Cost:     $2.85

Your Profit:    $52.15/month per agent! 🎉
```

---

## Error Handling

```typescript
try {
  const response = await purchaseNumber();
  if (!response.ok) {
    const error = await response.json();
    
    // Handle specific errors
    if (response.status === 400) {
      alert(error.detail);  // "Agent already has a phone number"
    } else if (response.status === 404) {
      alert("No numbers available in that area code");
    } else if (response.status === 503) {
      alert("Phone service temporarily unavailable");
    }
  }
} catch (error) {
  alert("Network error - please try again");
}
```

---

## Auto-Release on Delete

When a user deletes an agent, the phone number is **automatically released** from Twilio. You don't need to do anything special - it's handled by the backend!

---

## Next Steps

1. ✅ Deploy the backend (I'll give you the files)
2. Add phone number UI to agent creation flow
3. Test purchasing a number
4. Make a test call to verify it works
5. Add billing for monthly phone number fees (optional cron job)

**Ready to deploy?** 🚀
