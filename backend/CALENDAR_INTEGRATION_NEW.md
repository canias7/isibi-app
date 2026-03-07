# Connect Calendar BEFORE Creating Agent

## New Flow - Connect Integrations First!

Now you can connect Google Calendar once at the user level, then enable it for any agent during creation.

## How It Works

### Old Way (Required Agent First):
1. Create agent
2. Get agent ID
3. Connect calendar to that specific agent
4. ❌ Annoying!

### New Way (Connect Once, Use Everywhere):
1. Connect Google Calendar once (no agent needed)
2. Create agents with calendar enabled instantly
3. ✅ Much better!

## API Flow

### Step 1: Connect Calendar (One Time)

```javascript
// During onboarding or in settings
const connectCalendar = async () => {
  const token = localStorage.getItem('token');
  
  // Get OAuth URL (no agent_id needed!)
  const response = await fetch('https://isibi-backend.onrender.com/api/google/auth', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { auth_url } = await response.json();
  
  // Open OAuth popup
  window.open(auth_url, 'GoogleAuth', 'width=600,height=700');
};
```

### Step 2: Check If Calendar Connected

```javascript
const checkCalendarStatus = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('https://isibi-backend.onrender.com/api/google/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { connected } = await response.json();
  
  return connected; // true or false
};
```

### Step 3: Create Agent with Calendar Enabled

```javascript
const createAgent = async (agentData, enableCalendar) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('https://isibi-backend.onrender.com/api/agents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      assistant_name: agentData.name,
      phone_number: agentData.phone,
      first_message: agentData.firstMessage,
      system_prompt: agentData.prompt,
      voice: agentData.voice,
      enable_calendar: enableCalendar  // ← This is the key!
    })
  });
  
  const data = await response.json();
  
  if (data.warning) {
    alert(data.warning); // "Calendar not connected"
  }
  
  return data.agent_id;
};
```

## Frontend Implementation

### Agent Creation Form

```tsx
import { useState, useEffect } from 'react';
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreateAgentForm() {
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [enableCalendar, setEnableCalendar] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    firstMessage: '',
    // ...
  });

  useEffect(() => {
    checkCalendarStatus();
  }, []);

  const checkCalendarStatus = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/google/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { connected } = await response.json();
    setCalendarConnected(connected);
  };

  const connectCalendar = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/google/auth', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { auth_url } = await response.json();
    
    // Open popup
    const popup = window.open(auth_url, 'GoogleAuth', 'width=600,height=700');
    
    // Poll for completion
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        checkCalendarStatus(); // Refresh status
      }
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...formData,
        enable_calendar: enableCalendar
      })
    });
    
    // Agent created!
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Agent fields */}
      <input value={formData.name} onChange={...} placeholder="Agent Name" />
      
      {/* Integrations Section */}
      <div className="integrations-section">
        <h3>Integrations</h3>
        
        <div className="integration-item">
          <div className="flex items-center justify-between">
            <div>
              <h4>📅 Google Calendar</h4>
              <p className="text-sm text-muted-foreground">
                Let AI book appointments automatically
              </p>
            </div>
            
            {calendarConnected ? (
              <div className="flex items-center space-x-2">
                <span className="text-green-600">✓ Connected</span>
                <Switch 
                  checked={enableCalendar}
                  onCheckedChange={setEnableCalendar}
                />
              </div>
            ) : (
              <button 
                type="button"
                onClick={connectCalendar}
                className="btn-secondary"
              >
                Connect Calendar
              </button>
            )}
          </div>
          
          {!calendarConnected && enableCalendar && (
            <Alert variant="warning">
              <AlertDescription>
                Please connect your calendar first to enable this feature.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
      
      <button type="submit">Create Agent</button>
    </form>
  );
}
```

## API Endpoints

### User-Level Endpoints (New!)

```
GET  /api/google/auth     - Get OAuth URL (no agent needed)
GET  /api/google/status   - Check if user has connected calendar
GET  /api/google/callback - OAuth callback (automatic)
```

### Agent-Level Endpoints (Still Available)

```
GET    /api/agents/{id}/google/auth       - Connect to specific agent
POST   /api/agents/{id}/google/assign     - Assign user calendar to agent
DELETE /api/agents/{id}/google/disconnect - Disconnect from agent
```

## Benefits

✅ **Better UX** - Connect once, use everywhere
✅ **Faster** - No need to save agent first
✅ **Flexible** - Enable/disable per agent
✅ **Reusable** - Same calendar for all agents

## Migration

Existing agents with calendar still work! This just adds a new, better way.

Users can:
- Connect calendar once at account level
- Create multiple agents with calendar enabled
- Toggle calendar on/off per agent

## Summary

**Old way**: Agent → Save → Connect Calendar → Done
**New way**: Connect Calendar → Create Agent with Calendar → Done

Much simpler! 🎉
