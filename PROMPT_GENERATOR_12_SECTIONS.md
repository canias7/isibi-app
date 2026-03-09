# AI Prompt Generator - Structured System Prompt Creation

## 🎯 What You Want

When customer clicks "Generate with AI", the system automatically fills in all 12 sections:

1. ROLE
2. GREETING  
3. TONE
4. SERVICES
5. GOALS
6. REQUIRED INFO
7. BUSINESS INFO
8. FAQ RULES
9. ESCALATION
10. AFTER HOURS
11. CONSTRAINTS
12. ENDING SCRIPT

---

## 🔧 Backend Implementation

Add this endpoint to `portal.py`:

```python
from pydantic import BaseModel
from typing import Optional

class GeneratePromptRequest(BaseModel):
    business_name: str
    business_type: Optional[str] = "general"  # salon, restaurant, medical, retail, etc.
    services: Optional[str] = None  # e.g., "haircuts, shaves, beard trims"
    hours: Optional[str] = None  # e.g., "Mon-Fri 9am-6pm, Sat 10am-4pm"
    phone_number: Optional[str] = None
    address: Optional[str] = None

@router.post("/agents/generate-prompt")
def generate_ai_prompt(payload: GeneratePromptRequest, user=Depends(verify_token)):
    """
    Generate a complete structured system prompt based on business info
    """
    business_name = payload.business_name
    business_type = payload.business_type or "general"
    
    # Determine business-specific details
    role_templates = {
        "salon": "professional receptionist at a barbershop/salon",
        "restaurant": "friendly host at a restaurant",
        "medical": "professional medical receptionist",
        "retail": "helpful customer service representative",
        "professional": "professional office assistant",
        "general": "professional customer service representative"
    }
    
    service_templates = {
        "salon": "haircuts, styling, coloring, treatments",
        "restaurant": "dining reservations, takeout orders, catering",
        "medical": "appointment scheduling, prescription refills, general inquiries",
        "retail": "product information, orders, returns, support",
        "professional": "consultations, appointments, general inquiries",
        "general": "inquiries, appointments, and general assistance"
    }
    
    goal_templates = {
        "salon": "Schedule appointments efficiently and answer questions about services",
        "restaurant": "Take reservations, answer menu questions, and handle takeout orders",
        "medical": "Schedule appointments, handle prescription requests, and triage urgent matters",
        "retail": "Assist with product questions, process orders, and resolve issues",
        "professional": "Schedule consultations and provide information about services",
        "general": "Assist customers efficiently and professionally"
    }
    
    # Build the structured prompt
    role = role_templates.get(business_type, role_templates["general"])
    services = payload.services or service_templates.get(business_type, service_templates["general"])
    goals = goal_templates.get(business_type, goal_templates["general"])
    
    prompt = f"""# SYSTEM PROMPT FOR {business_name.upper()}

## 1. ROLE
You are a {role}. Your primary responsibility is to handle incoming phone calls professionally and efficiently, providing excellent customer service while managing appointments and inquiries.

## 2. GREETING
When answering a call, greet the caller warmly:
"Thank you for calling {business_name}! This is your AI assistant. How may I help you today?"

For returning callers who provide their name:
"Welcome back to {business_name}, [Name]! How can I assist you today?"

## 3. TONE
- Professional yet friendly and approachable
- Patient and understanding
- Clear and concise in communication
- Warm and welcoming
- Helpful and solution-oriented
- Adapt formality based on the caller's tone

## 4. SERVICES
{business_name} offers the following services:
{services}

When discussing services:
- Provide clear, accurate information
- Explain options when relevant
- Suggest appropriate services based on customer needs
- Never make up information about services not listed

## 5. GOALS
Your primary goals are to:
- {goals}
- Provide accurate information about services and pricing
- Collect necessary information for appointments
- Create positive customer experiences
- Handle objections professionally
- Route complex issues to appropriate staff

## 6. REQUIRED INFO
When scheduling appointments, always collect:
- Customer's full name
- Phone number (for confirmation/callback)
- Preferred date and time
- Type of service requested
- Any special requirements or notes

Confirm all details before finalizing the appointment.

## 7. BUSINESS INFO
Business Name: {business_name}
{f"Phone: {payload.phone_number}" if payload.phone_number else ""}
{f"Location: {payload.address}" if payload.address else ""}
{f"Hours: {payload.hours}" if payload.hours else "Hours: Monday-Friday 9am-6pm, Saturday 10am-4pm (adjust as needed)"}

## 8. FAQ RULES
Common Questions to Handle:

**Pricing:**
- If you have specific pricing, provide it
- If pricing varies, explain: "Pricing depends on the specific service. I can connect you with our team for an accurate quote."

**Availability:**
- Check calendar if available
- If unsure: "Let me check our availability. What dates work best for you?"

**Location/Directions:**
- Provide address if available
- Offer to text/email directions if needed

**Services:**
- Explain available services clearly
- Recommend based on customer needs
- Never invent services not offered

**Cancellation/Rescheduling:**
- Be understanding and helpful
- Get current appointment details
- Offer alternative times

## 9. ESCALATION
Transfer to a human when:
- Customer is upset or frustrated
- Complex technical issues arise
- Pricing negotiations are needed
- Emergency or urgent medical matters (if medical office)
- You don't have information the customer needs
- Customer explicitly requests to speak with someone

Escalation script:
"I understand this requires additional assistance. Let me connect you with [appropriate person/department] who can better help you with this."

## 10. AFTER HOURS
{f"If called outside of business hours ({payload.hours}):" if payload.hours else "If called outside of business hours:"}

"Thank you for calling {business_name}. You've reached us outside of our normal business hours. Our hours are [hours]. 

I can still help you:
- Schedule an appointment for when we're open
- Answer general questions about our services
- Take a message for our team

Or, if this is urgent, I can provide our emergency contact information. How would you like to proceed?"

## 11. CONSTRAINTS
You MUST:
- Never make medical diagnoses (if medical office)
- Never guarantee specific outcomes
- Never share other customers' information
- Never make appointments without collecting required info
- Never pretend to be a human employee
- Always be honest about your capabilities as an AI

You MUST NOT:
- Make up services, prices, or policies
- Share confidential business information
- Make promises you can't keep
- Be rude or dismissive
- Rush the caller

## 12. ENDING SCRIPT
When concluding the call:

**After Scheduling:**
"Perfect! I have you scheduled for [service] on [date] at [time]. You'll receive a confirmation [text/email]. Is there anything else I can help you with today?"

**After Providing Information:**
"I'm glad I could help! Is there anything else you'd like to know about {business_name}?"

**Before Transfer:**
"I'm connecting you now. Please hold for just a moment."

**General Ending:**
"Thank you for calling {business_name}! We look forward to [seeing you/serving you]. Have a great day!"

---

## TOOLS AVAILABLE
You have access to:
- Calendar checking and appointment scheduling
- SMS/Email confirmation sending
- Basic customer information lookup

Use these tools naturally during the conversation when needed.

## REMEMBER
Your goal is to represent {business_name} professionally, handle calls efficiently, and create positive experiences that make customers want to return. Be helpful, honest, and friendly in every interaction.
"""
    
    return {
        "success": True,
        "prompt": prompt,
        "business_name": business_name,
        "business_type": business_type
    }
```

---

## 🎨 Frontend Implementation

Update your agent creation form:

```typescript
import { useState } from 'react';

function CreateAgentForm() {
  const [step, setStep] = useState(1); // 1 = info, 2 = prompt
  const [formData, setFormData] = useState({
    business_name: '',
    business_type: 'general',
    services: '',
    hours: '',
    phone_number: '',
    address: ''
  });
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const generatePrompt = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/agents/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        setGeneratedPrompt(data.prompt);
        setStep(2); // Move to prompt review step
      }
    } catch (error) {
      alert('Failed to generate prompt');
    } finally {
      setLoading(false);
    }
  };

  const createAgent = async () => {
    const agent = {
      business_name: formData.business_name,
      assistant_name: formData.business_name + " AI",
      first_message: `Thank you for calling ${formData.business_name}! This is your AI assistant. How may I help you today?`,
      system_prompt: generatedPrompt,
      voice: "alloy"
    };

    await fetch('/api/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(agent)
    });

    // Redirect to dashboard
    navigate('/dashboard');
  };

  if (step === 1) {
    return (
      <div className="create-agent-step1">
        <h2>Tell Us About Your Business</h2>
        
        <div className="form-group">
          <label>Business Name *</label>
          <input
            type="text"
            placeholder="e.g., Tony's Barbershop"
            value={formData.business_name}
            onChange={(e) => setFormData({...formData, business_name: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Business Type *</label>
          <select
            value={formData.business_type}
            onChange={(e) => setFormData({...formData, business_type: e.target.value})}
          >
            <option value="general">General Business</option>
            <option value="salon">Salon/Barbershop</option>
            <option value="restaurant">Restaurant/Café</option>
            <option value="medical">Medical Office</option>
            <option value="retail">Retail Store</option>
            <option value="professional">Professional Services</option>
          </select>
        </div>

        <div className="form-group">
          <label>Services Offered (Optional)</label>
          <textarea
            placeholder="e.g., haircuts, shaves, beard trims"
            value={formData.services}
            onChange={(e) => setFormData({...formData, services: e.target.value})}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Business Hours (Optional)</label>
          <input
            type="text"
            placeholder="e.g., Mon-Fri 9am-6pm, Sat 10am-4pm"
            value={formData.hours}
            onChange={(e) => setFormData({...formData, hours: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Phone Number (Optional)</label>
          <input
            type="tel"
            placeholder="e.g., (555) 123-4567"
            value={formData.phone_number}
            onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Address (Optional)</label>
          <input
            type="text"
            placeholder="e.g., 123 Main St, City, State"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
          />
        </div>

        <button
          onClick={generatePrompt}
          disabled={!formData.business_name || loading}
          className="btn-primary"
        >
          {loading ? 'Generating...' : '✨ Generate AI Prompt'}
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="create-agent-step2">
        <h2>Review Your AI Prompt</h2>
        
        <div className="prompt-preview">
          <pre>{generatedPrompt}</pre>
        </div>

        <div className="prompt-sections">
          <p>✅ 1. ROLE - Defined</p>
          <p>✅ 2. GREETING - Customized</p>
          <p>✅ 3. TONE - Professional & Friendly</p>
          <p>✅ 4. SERVICES - Listed</p>
          <p>✅ 5. GOALS - Clear objectives</p>
          <p>✅ 6. REQUIRED INFO - Appointment details</p>
          <p>✅ 7. BUSINESS INFO - Contact & hours</p>
          <p>✅ 8. FAQ RULES - Common questions</p>
          <p>✅ 9. ESCALATION - When to transfer</p>
          <p>✅ 10. AFTER HOURS - Messaging</p>
          <p>✅ 11. CONSTRAINTS - What not to do</p>
          <p>✅ 12. ENDING SCRIPT - Professional close</p>
        </div>

        <div className="actions">
          <button onClick={() => setStep(1)} className="btn-secondary">
            ← Back to Edit
          </button>
          
          <button
            onClick={() => {
              const textarea = document.createElement('textarea');
              textarea.value = generatedPrompt;
              setGeneratedPrompt(textarea.value);
            }}
            className="btn-secondary"
          >
            ✏️ Customize Prompt
          </button>
          
          <button onClick={createAgent} className="btn-primary">
            Create Agent
          </button>
        </div>
      </div>
    );
  }
}
```

---

## 📱 UI Flow

### Step 1: Business Info
```
┌───────────────────────────────────────┐
│ Tell Us About Your Business          │
├───────────────────────────────────────┤
│                                       │
│ Business Name *                       │
│ [Tony's Barbershop]                   │
│                                       │
│ Business Type *                       │
│ [Salon/Barbershop ▼]                  │
│                                       │
│ Services Offered (Optional)           │
│ [haircuts, shaves, beard trims]       │
│                                       │
│ Business Hours (Optional)             │
│ [Mon-Fri 9am-6pm, Sat 10am-4pm]       │
│                                       │
│ Phone Number (Optional)               │
│ [(555) 123-4567]                      │
│                                       │
│ Address (Optional)                    │
│ [123 Main St, Charlotte, NC]          │
│                                       │
│ [✨ Generate AI Prompt]                │
└───────────────────────────────────────┘
```

### Step 2: Review Generated Prompt
```
┌───────────────────────────────────────┐
│ Review Your AI Prompt                 │
├───────────────────────────────────────┤
│                                       │
│ # SYSTEM PROMPT FOR TONY'S BARBERSHOP│
│                                       │
│ ## 1. ROLE                            │
│ You are a professional receptionist...│
│                                       │
│ ## 2. GREETING                        │
│ "Thank you for calling Tony's..."     │
│                                       │
│ ## 3. TONE                            │
│ - Professional yet friendly...        │
│                                       │
│ ... (scrollable)                      │
│                                       │
│ ✅ All 12 sections generated!         │
│                                       │
│ [← Back] [✏️ Customize] [Create Agent]│
└───────────────────────────────────────┘
```

---

## 🎯 What Gets Generated

For "Tony's Barbershop":

```
# SYSTEM PROMPT FOR TONY'S BARBERSHOP

## 1. ROLE
You are a professional receptionist at a barbershop/salon...

## 2. GREETING
"Thank you for calling Tony's Barbershop! This is your AI assistant..."

## 3. TONE
- Professional yet friendly and approachable
- Patient and understanding...

## 4. SERVICES
Tony's Barbershop offers the following services:
haircuts, shaves, beard trims...

## 5. GOALS
Your primary goals are to:
- Schedule appointments efficiently...

## 6. REQUIRED INFO
When scheduling appointments, always collect:
- Customer's full name
- Phone number...

## 7. BUSINESS INFO
Business Name: Tony's Barbershop
Phone: (555) 123-4567
Location: 123 Main St, Charlotte, NC
Hours: Mon-Fri 9am-6pm, Sat 10am-4pm...

## 8. FAQ RULES
Common Questions to Handle:
**Pricing:**...

## 9. ESCALATION
Transfer to a human when:...

## 10. AFTER HOURS
"Thank you for calling Tony's Barbershop..."

## 11. CONSTRAINTS
You MUST:
- Never make appointments without collecting required info...

## 12. ENDING SCRIPT
"Perfect! I have you scheduled for..."
```

**All 12 sections auto-filled!** ✨

Would you like me to add this endpoint to your backend now?
