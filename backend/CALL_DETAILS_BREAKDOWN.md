# Detailed Call Cost Breakdown - Frontend Implementation

## 🎯 What We Built

When customers click on a call in their transaction history, they can see exactly what they were charged for:

- 📝 Input tokens (system prompt, transcriptions)
- 💬 Output tokens (AI responses)  
- 🎤 Input audio (caller speech)
- 🔊 Output audio (AI voice)
- 📞 Phone service (Twilio)

---

## 📊 API Endpoint

### GET `/api/usage/call-details/{call_id}`

**Example Request:**
```bash
curl https://isibi-backend.onrender.com/api/usage/call-details/123 \
  -H "Authorization: Bearer TOKEN"
```

**Example Response:**
```json
{
  "call_id": 123,
  "agent_name": "Juan",
  "call_sid": "CA1234567890abcdef",
  "duration_seconds": 180,
  "duration_minutes": 3.0,
  "started_at": "2026-02-22 10:30:00",
  "ended_at": "2026-02-22 10:33:00",
  "total_charged": 0.75,
  
  "breakdown": {
    "input_tokens": {
      "quantity": 500,
      "unit": "tokens",
      "cost": 0.0025,
      "description": "Text input to AI (system prompt, transcriptions)"
    },
    "output_tokens": {
      "quantity": 800,
      "unit": "tokens",
      "cost": 0.016,
      "description": "Text output from AI (responses)"
    },
    "input_audio": {
      "quantity": 1.5,
      "unit": "minutes",
      "cost": 0.45,
      "description": "Audio from caller (speech recognition)"
    },
    "output_audio": {
      "quantity": 1.5,
      "unit": "minutes",
      "cost": 1.80,
      "description": "Audio to caller (AI voice synthesis)"
    },
    "phone_call": {
      "quantity": 3.0,
      "unit": "minutes",
      "cost": 0.0255,
      "description": "Twilio phone line time"
    }
  },
  
  "summary": {
    "ai_processing": 2.2925,
    "phone_service": 0.0255,
    "total": 0.75
  }
}
```

---

## 🎨 Frontend Components

### React Component - Call Details Modal

```typescript
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';

interface CallDetailsProps {
  callId: number;
  isOpen: boolean;
  onClose: () => void;
}

function CallDetailsModal({ callId, isOpen, onClose }: CallDetailsProps) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && callId) {
      fetchCallDetails();
    }
  }, [isOpen, callId]);

  const fetchCallDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/usage/call-details/${callId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setDetails(data);
    } catch (error) {
      console.error('Failed to fetch call details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading call details...</div>;
  }

  if (!details) {
    return null;
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="call-details-modal">
        <div className="modal-header">
          <h2>Call Details</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="call-info">
          <div className="info-row">
            <span className="label">Agent:</span>
            <span className="value">{details.agent_name}</span>
          </div>
          <div className="info-row">
            <span className="label">Duration:</span>
            <span className="value">{details.duration_minutes} minutes</span>
          </div>
          <div className="info-row">
            <span className="label">Started:</span>
            <span className="value">{details.started_at}</span>
          </div>
        </div>

        <div className="cost-breakdown">
          <h3>Cost Breakdown</h3>
          
          <div className="breakdown-section">
            <h4>AI Processing</h4>
            
            <div className="breakdown-item">
              <div className="item-header">
                <span className="item-name">Input Tokens</span>
                <span className="item-cost">${details.breakdown.input_tokens.cost.toFixed(4)}</span>
              </div>
              <div className="item-details">
                <span className="quantity">
                  {details.breakdown.input_tokens.quantity.toLocaleString()} tokens
                </span>
                <span className="description">
                  {details.breakdown.input_tokens.description}
                </span>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-header">
                <span className="item-name">Output Tokens</span>
                <span className="item-cost">${details.breakdown.output_tokens.cost.toFixed(4)}</span>
              </div>
              <div className="item-details">
                <span className="quantity">
                  {details.breakdown.output_tokens.quantity.toLocaleString()} tokens
                </span>
                <span className="description">
                  {details.breakdown.output_tokens.description}
                </span>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-header">
                <span className="item-name">Input Audio</span>
                <span className="item-cost">${details.breakdown.input_audio.cost.toFixed(4)}</span>
              </div>
              <div className="item-details">
                <span className="quantity">
                  {details.breakdown.input_audio.quantity} minutes
                </span>
                <span className="description">
                  {details.breakdown.input_audio.description}
                </span>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-header">
                <span className="item-name">Output Audio</span>
                <span className="item-cost">${details.breakdown.output_audio.cost.toFixed(4)}</span>
              </div>
              <div className="item-details">
                <span className="quantity">
                  {details.breakdown.output_audio.quantity} minutes
                </span>
                <span className="description">
                  {details.breakdown.output_audio.description}
                </span>
              </div>
            </div>
          </div>

          <div className="breakdown-section">
            <h4>Phone Service</h4>
            
            <div className="breakdown-item">
              <div className="item-header">
                <span className="item-name">Twilio Phone Line</span>
                <span className="item-cost">${details.breakdown.phone_call.cost.toFixed(4)}</span>
              </div>
              <div className="item-details">
                <span className="quantity">
                  {details.breakdown.phone_call.quantity} minutes
                </span>
                <span className="description">
                  {details.breakdown.phone_call.description}
                </span>
              </div>
            </div>
          </div>

          <div className="breakdown-summary">
            <div className="summary-row">
              <span className="label">AI Processing:</span>
              <span className="amount">${details.summary.ai_processing.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="label">Phone Service:</span>
              <span className="amount">${details.summary.phone_service.toFixed(2)}</span>
            </div>
            <div className="summary-row total">
              <span className="label">Total:</span>
              <span className="amount">${details.summary.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export default CallDetailsModal;
```

---

### Integration in Call History

```typescript
function CallHistory() {
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const openCallDetails = (call) => {
    setSelectedCall(call.id);
    setShowDetails(true);
  };

  return (
    <div className="call-history">
      <h2>Call History</h2>
      
      <table className="calls-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Agent</th>
            <th>Duration</th>
            <th>Cost</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {calls.map(call => (
            <tr key={call.id}>
              <td>{call.started_at}</td>
              <td>{call.agent_name}</td>
              <td>{call.duration_seconds}s</td>
              <td>${call.revenue_usd.toFixed(2)}</td>
              <td>
                <button 
                  onClick={() => openCallDetails(call)}
                  className="btn-link"
                >
                  View Breakdown
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <CallDetailsModal
        callId={selectedCall}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
      />
    </div>
  );
}
```

---

## 💅 CSS Styling

```css
.call-details-modal {
  max-width: 600px;
  padding: 24px;
  background: white;
  border-radius: 8px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.call-info {
  background: #f9fafb;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.info-row .label {
  font-weight: 500;
  color: #6b7280;
}

.cost-breakdown h3 {
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 600;
}

.breakdown-section {
  margin-bottom: 24px;
}

.breakdown-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.breakdown-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 8px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.item-name {
  font-weight: 500;
}

.item-cost {
  font-weight: 600;
  color: #059669;
}

.item-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}

.quantity {
  font-weight: 500;
}

.breakdown-summary {
  border-top: 2px solid #e5e7eb;
  padding-top: 16px;
  margin-top: 16px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.summary-row.total {
  font-size: 18px;
  font-weight: 600;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.summary-row.total .amount {
  color: #059669;
}
```

---

## 📱 UI Example

```
┌────────────────────────────────────────────┐
│  Call Details                          ×   │
├────────────────────────────────────────────┤
│                                            │
│  Agent: Juan                               │
│  Duration: 3.0 minutes                     │
│  Started: 2026-02-22 10:30:00              │
│                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                            │
│  Cost Breakdown                            │
│                                            │
│  AI PROCESSING                             │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ Input Tokens            $0.0025      │ │
│  │ 500 tokens                           │ │
│  │ Text input to AI (system prompt)     │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ Output Tokens           $0.0160      │ │
│  │ 800 tokens                           │ │
│  │ Text output from AI (responses)      │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ Input Audio             $0.4500      │ │
│  │ 1.5 minutes                          │ │
│  │ Audio from caller (speech recog)     │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ Output Audio            $1.8000      │ │
│  │ 1.5 minutes                          │ │
│  │ Audio to caller (AI voice)           │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  PHONE SERVICE                             │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ Twilio Phone Line       $0.0255      │ │
│  │ 3.0 minutes                          │ │
│  │ Twilio phone line time               │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                            │
│  AI Processing:             $2.29          │
│  Phone Service:             $0.03          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Total:                     $0.75          │
│                                            │
└────────────────────────────────────────────┘
```

---

## 🔄 How to Update Existing Calls

For calls that already exist (before this update), they won't have breakdown data. You can:

**Option 1: Show "N/A" for old calls**
```typescript
if (!details.breakdown.input_tokens.cost) {
  return <div>Detailed breakdown not available for this call</div>;
}
```

**Option 2: Estimate from total**
```typescript
// Rough estimate: 90% AI processing, 10% phone
const aiProcessing = details.total_charged * 0.9;
const phoneService = details.total_charged * 0.1;
```

---

## 📊 What Customers See

**Before:**
```
Call to Juan (120s) - $0.50
```

**After (when they click):**
```
Call to Juan - $0.50

Input Tokens:    500 tokens    $0.0025
Output Tokens:   800 tokens    $0.016
Input Audio:     1.5 min       $0.45
Output Audio:    1.5 min       $1.80
Phone Line:      3.0 min       $0.0255

AI Processing: $2.29
Phone Service: $0.03
Total: $0.75
```

**Full transparency = Happy customers!** ✨

---

## Summary

✅ **New database columns** for detailed tracking
✅ **API endpoint** to get call breakdown  
✅ **Frontend modal** to display details
✅ **Clear categories**: AI processing vs Phone service
✅ **Per-component pricing** shown to customer

**Deploy and your customers will love the transparency!** 🎯
