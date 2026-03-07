# Delete Phone Numbers - Frontend Guide

## 🗑️ Delete/Release Phone Numbers

Customers can delete phone numbers they purchased but haven't assigned to an agent yet.

---

## API Endpoints

### Option 1: Delete by Twilio SID (Recommended)
**POST** `/api/phone/release/{twilio_sid}`

**Example:**
```bash
curl -X POST https://isibi-backend.onrender.com/api/phone/release/PN1234567890abcdef \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number +17045551234 released successfully",
  "phone_number": "+17045551234"
}
```

### Option 2: Delete by Phone Number
**DELETE** `/api/phone/release`

**Request:**
```bash
curl -X DELETE "https://isibi-backend.onrender.com/api/phone/release?phone_number=%2B17045551234" \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number +17045551234 released successfully",
  "phone_number": "+17045551234"
}
```

---

## Frontend Implementation

### React Component - Show Numbers with Delete Button

```typescript
import { useState, useEffect } from 'react';

function MyPhoneNumbers() {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNumbers();
  }, []);

  const fetchNumbers = async () => {
    const response = await fetch('/api/phone/my-numbers', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    setNumbers(data.numbers);
  };

  const deleteNumber = async (twilioSid: string, phoneNumber: string) => {
    if (!confirm(`Delete ${phoneNumber}? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/phone/release/${twilioSid}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        alert(`${phoneNumber} has been released`);
        // Refresh the list
        fetchNumbers();
      }
    } catch (error) {
      alert('Failed to release number');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-numbers">
      <h2>My Phone Numbers</h2>
      
      {numbers.length === 0 ? (
        <p>No phone numbers yet. Purchase one to get started!</p>
      ) : (
        <div className="numbers-list">
          {numbers.map((num) => (
            <div key={num.twilio_sid} className="number-card">
              <div className="number-info">
                <span className="phone">{num.phone_number}</span>
                <span className="status">{num.friendly_name}</span>
                <span className="cost">${num.monthly_cost}/month</span>
              </div>
              
              <div className="actions">
                {num.friendly_name.includes('Available') ? (
                  <>
                    <button 
                      onClick={() => selectForAgent(num)}
                      className="btn-primary"
                    >
                      Use for Agent
                    </button>
                    <button 
                      onClick={() => deleteNumber(num.twilio_sid, num.phone_number)}
                      className="btn-danger"
                      disabled={loading}
                    >
                      {loading ? 'Deleting...' : 'Delete'}
                    </button>
                  </>
                ) : (
                  <span className="in-use">In Use</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## UI/UX Design

### Phone Numbers Page

```
┌─────────────────────────────────────────────┐
│  My Phone Numbers                           │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 📞 +1-704-555-1234                   │  │
│  │ User 1 - Available                   │  │
│  │ $1.15/month                          │  │
│  │                                       │  │
│  │ [Use for Agent] [Delete]             │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 📞 +1-212-555-5678                   │  │
│  │ Juan - Barber 123                    │  │
│  │ $1.15/month • In Use                 │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 📞 +1-310-555-9999                   │  │
│  │ User 1 - Reserved                    │  │
│  │ $1.15/month                          │  │
│  │                                       │  │
│  │ [Use for Agent] [Delete]             │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  [+ Purchase New Number]                    │
└─────────────────────────────────────────────┘
```

### Confirmation Dialog

```
┌──────────────────────────────────┐
│  Delete Phone Number?            │
├──────────────────────────────────┤
│                                  │
│  Are you sure you want to delete │
│  +1-704-555-1234?                │
│                                  │
│  This will:                      │
│  • Release the number to Twilio  │
│  • Stop monthly charges          │
│  • Cannot be undone              │
│                                  │
│  [Cancel]  [Delete Number]       │
└──────────────────────────────────┘
```

---

## When Can Numbers Be Deleted?

### ✅ Can Delete When:
1. **Available** - Purchased but not assigned to agent
2. **Reserved** - Held but not in use

### ❌ Cannot Delete When:
1. **In Use by Agent** - Must remove from agent first
2. **Assigned but agent deleted** - Should auto-release

---

## Smart Delete Flow

```typescript
const deleteNumber = async (twilioSid: string, phoneNumber: string) => {
  // Step 1: Check if number is in use
  const agents = await fetchAgents();
  const inUse = agents.some(a => a.phone_number === phoneNumber);

  if (inUse) {
    alert('This number is assigned to an agent. Remove it from the agent first.');
    return;
  }

  // Step 2: Confirm deletion
  const confirmed = confirm(
    `Delete ${phoneNumber}?\n\n` +
    `• Monthly charge: $1.15 will stop\n` +
    `• Number released back to Twilio\n` +
    `• This cannot be undone`
  );

  if (!confirmed) return;

  // Step 3: Delete
  try {
    const response = await fetch(`/api/phone/release/${twilioSid}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      toast.success(`${phoneNumber} released successfully`);
      refreshNumbers();
    }
  } catch (error) {
    toast.error('Failed to release number');
  }
};
```

---

## Bulk Delete

For users with multiple unused numbers:

```typescript
const bulkDeleteNumbers = async (sids: string[]) => {
  const results = await Promise.all(
    sids.map(sid => 
      fetch(`/api/phone/release/${sid}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
    )
  );

  const succeeded = results.filter(r => r.ok).length;
  
  alert(`Released ${succeeded} of ${sids.length} numbers`);
  refreshNumbers();
};

// Usage
<button onClick={() => bulkDeleteNumbers(selectedSids)}>
  Delete Selected ({selectedSids.length})
</button>
```

---

## Error Handling

```typescript
const deleteNumber = async (twilioSid: string) => {
  try {
    const response = await fetch(`/api/phone/release/${twilioSid}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 403) {
      alert("You don't own this number");
    } else if (response.status === 404) {
      alert("Number not found");
    } else if (response.status === 503) {
      alert("Twilio not configured");
    } else if (response.ok) {
      const data = await response.json();
      alert(data.message);
      refreshNumbers();
    } else {
      alert("Failed to delete number");
    }
  } catch (error) {
    alert("Network error");
  }
};
```

---

## Security

The backend ensures:
1. ✅ User can only delete their own numbers
2. ✅ Verified by `friendly_name` containing `User {user_id}`
3. ✅ Returns 403 if trying to delete someone else's number

---

## Cost Savings

### Example:
```
User purchased 5 numbers for testing
Only using 2 for agents
Deletes 3 unused numbers

Monthly savings: 3 × $1.15 = $3.45/month
Annual savings: $41.40/year
```

---

## Testing

### Test delete by SID:
```bash
curl -X POST https://isibi-backend.onrender.com/api/phone/release/PN123abc \
  -H "Authorization: Bearer TOKEN"
```

### Test delete by phone number:
```bash
curl -X DELETE "https://isibi-backend.onrender.com/api/phone/release?phone_number=%2B17045551234" \
  -H "Authorization: Bearer TOKEN"
```

---

## Summary

✅ **Two ways to delete**: By SID or by phone number
✅ **Security built-in**: Can only delete your own numbers
✅ **Prevents waste**: Delete unused numbers to save $1.15/month
✅ **Easy integration**: Simple REST endpoints
✅ **Clear feedback**: Returns deleted phone number in response

**Give users control over their phone numbers!** 🗑️📞
