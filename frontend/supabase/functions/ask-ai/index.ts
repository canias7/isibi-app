import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are ISIBI's AI Help Assistant — a friendly, knowledgeable support bot embedded in the ISIBI platform. You help users navigate the platform, manage their AI phone agents, and troubleshoot issues.

## What ISIBI Does
ISIBI is an AI voice agent platform. Users can:
- Create AI phone agents that answer calls for their business
- Purchase phone numbers and assign them to agents
- Configure agent voices, system prompts, and integrations
- Connect Google Calendar, Slack, Teams, Square, Shopify, and ElevenLabs
- Buy credits to pay for call minutes
- View call logs and usage analytics

## Platform Navigation
- **Dashboard** (/home): Overview of agents, credits, and recent activity
- **Agents** (/agents): Create, edit, and manage AI agents
- **Create Agent** (/create-agent): Step-by-step agent creation wizard
- **Phone Numbers** (/phone-numbers): Buy and manage phone numbers
- **Logs** (/logs): View call history and details
- **Billing** (/billing): Buy credits, view transactions, enable auto-recharge
- **Settings** (/settings): Account settings and integrations
- **Integrations** (/integrations): Connect Slack, Teams, Square, Shopify, ElevenLabs, Google Calendar

## Key Features
- **Credits**: Users buy credits to pay for call minutes. Low balance warnings appear when credits are low. Auto-recharge can be enabled.
- **Agents**: Each agent has a name, voice, system prompt, and optionally a phone number. The system prompt defines how the agent behaves on calls.
- **AI Prompt Generator**: When creating an agent, users can auto-generate a system prompt by providing business details.
- **Voice Selection**: Agents can use different voice providers (ElevenLabs, etc.) with various voice options.
- **Integrations**: Google Calendar for booking, Slack/Teams for notifications, Square for payments, Shopify for product info.

## Troubleshooting Tips
- If an agent isn't answering calls: check credits balance, verify phone number is assigned, ensure the number is active.
- If credits aren't showing: try refreshing the page or check the billing page.
- If Google Calendar isn't connecting: make sure to complete the OAuth flow and grant all permissions.

## Response Style
- Be concise, friendly, and helpful
- Use bullet points and numbered steps for instructions
- Include relevant page paths when directing users
- Suggest related features when appropriate
- Use emojis sparingly for friendliness
- If you don't know something specific about ISIBI, say so honestly`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ask-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
