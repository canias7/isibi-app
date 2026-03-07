# AI System Prompt Generator - Backend Implementation
# Add this to portal.py

import os
from anthropic import Anthropic

# Initialize Anthropic client
anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

class AIGeneratePromptRequest(BaseModel):
    business_name: str
    business_type: str  # salon, restaurant, medical, retail, professional, general
    business_description: Optional[str] = None
    services: Optional[str] = None  # What services do you offer?
    tone: Optional[str] = "professional"  # professional, friendly, casual, formal
    key_goals: Optional[str] = None  # What should the agent focus on?
    special_instructions: Optional[str] = None  # Any special requirements?
    hours: Optional[str] = None  # Business hours
    location: Optional[str] = None  # Business location/address
    pricing_info: Optional[str] = None  # Pricing structure
    tools_enabled: Optional[List[str]] = []  # ["sms", "calendar", "shopify", etc.]

@router.post("/agents/generate-prompt-ai")
def generate_prompt_with_ai(payload: AIGeneratePromptRequest, user=Depends(verify_token)):
    """
    Generate a custom system prompt using Claude AI
    
    This creates a highly customized, professional system prompt
    based on the business details provided by the user.
    """
    import logging
    logger = logging.getLogger("main")
    
    # Check if Anthropic API key is configured
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="AI prompt generation not configured. Please add ANTHROPIC_API_KEY to environment variables."
        )
    
    # Build context for Claude
    business_context = f"""
Business Name: {payload.business_name}
Business Type: {payload.business_type}
"""
    
    if payload.business_description:
        business_context += f"\nBusiness Description: {payload.business_description}"
    
    if payload.services:
        business_context += f"\nServices Offered: {payload.services}"
    
    if payload.hours:
        business_context += f"\nBusiness Hours: {payload.hours}"
    
    if payload.location:
        business_context += f"\nLocation: {payload.location}"
    
    if payload.pricing_info:
        business_context += f"\nPricing: {payload.pricing_info}"
    
    if payload.key_goals:
        business_context += f"\nKey Goals: {payload.key_goals}"
    
    if payload.special_instructions:
        business_context += f"\nSpecial Instructions: {payload.special_instructions}"
    
    # Tool capabilities context
    tools_context = ""
    if payload.tools_enabled:
        tools_available = {
            "sms": "send SMS confirmations to customers",
            "calendar": "schedule appointments in Google Calendar",
            "shopify": "check product availability and take orders",
            "square": "process credit card payments",
            "slack": "notify staff about important events",
            "teams": "notify staff via Microsoft Teams"
        }
        
        enabled_tools = [tools_available.get(tool, tool) for tool in payload.tools_enabled if tool in tools_available]
        if enabled_tools:
            tools_context = f"\n\nAvailable Tools: The agent can {', '.join(enabled_tools)}."
    
    # Build the prompt for Claude
    claude_prompt = f"""You are an expert at creating system prompts for AI voice agents that handle phone calls for businesses.

Create a comprehensive, professional system prompt for a voice AI agent with the following business details:

{business_context}

Desired Tone: {payload.tone}{tools_context}

REQUIREMENTS FOR THE SYSTEM PROMPT:

1. **Role & Identity**: Define who the AI agent is (e.g., "You are the professional receptionist for...")

2. **Core Responsibilities**: Clearly list what the agent should do (take orders, schedule appointments, answer questions, etc.)

3. **Required Information Collection**: Specify exactly what information to collect for common tasks (appointments, orders, etc.) - be very detailed and organized

4. **Tone & Communication Style**: Set the conversation style matching the requested tone ({payload.tone})

5. **Handling Specific Scenarios**: Provide guidance for common situations this business will encounter

6. **Guardrails**: Important rules (what NOT to do, privacy considerations, escalation triggers)

7. **Business Information**: Hours, location, pricing - anything customers commonly ask about

8. **Call Flow Guidelines**: How to structure conversations naturally

FORMAT REQUIREMENTS:
- Write in second person ("You are...", "Your role is...", "When a customer calls...")
- Use clear section headers with markdown (##)
- Be specific and actionable
- Include example dialogues or scenarios where helpful
- Keep it concise but complete (aim for 500-800 words)
- Make it sound natural for a phone conversation

Create a system prompt that will make this AI agent highly effective at serving {payload.business_name}'s customers over the phone."""

    try:
        # Call Claude API
        logger.info(f"🤖 Generating AI prompt for {payload.business_name}")
        
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            temperature=0.7,
            messages=[
                {
                    "role": "user",
                    "content": claude_prompt
                }
            ]
        )
        
        # Extract the generated prompt
        generated_prompt = message.content[0].text
        
        logger.info(f"✅ AI prompt generated successfully ({len(generated_prompt)} chars)")
        
        return {
            "success": True,
            "system_prompt": generated_prompt,
            "business_name": payload.business_name,
            "business_type": payload.business_type,
            "model": "claude-sonnet-4-20250514"
        }
        
    except Exception as e:
        logger.error(f"❌ AI prompt generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate prompt: {str(e)}"
        )


@router.post("/agents/refine-prompt-ai")
def refine_prompt_with_ai(payload: dict, user=Depends(verify_token)):
    """
    Refine an existing system prompt based on user feedback
    
    Body:
    {
        "current_prompt": "...",
        "feedback": "Make it more friendly and add information about our loyalty program"
    }
    """
    import logging
    logger = logging.getLogger("main")
    
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="AI prompt refinement not configured."
        )
    
    current_prompt = payload.get("current_prompt", "")
    feedback = payload.get("feedback", "")
    
    if not current_prompt or not feedback:
        raise HTTPException(
            status_code=400,
            detail="Both current_prompt and feedback are required"
        )
    
    claude_prompt = f"""You are helping refine a system prompt for an AI voice agent.

Current System Prompt:
{current_prompt}

User Feedback:
{feedback}

Please refine the system prompt based on the feedback. Maintain the overall structure and quality, but incorporate the requested changes. Keep the same markdown formatting and professional tone.

Return only the refined system prompt, nothing else."""

    try:
        logger.info(f"🔄 Refining prompt based on feedback")
        
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            temperature=0.7,
            messages=[
                {
                    "role": "user",
                    "content": claude_prompt
                }
            ]
        )
        
        refined_prompt = message.content[0].text
        
        logger.info(f"✅ Prompt refined successfully")
        
        return {
            "success": True,
            "system_prompt": refined_prompt
        }
        
    except Exception as e:
        logger.error(f"❌ Prompt refinement failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refine prompt: {str(e)}"
        )
