const API_BASE = "https://isibi-backend.onrender.com";

function getToken(): string | null {
  return localStorage.getItem("token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface CreateAgentRequest {
  assistant_name: string;
  phone_number?: string | null;
  business_name?: string | null;
  first_message?: string | null;
  system_prompt?: string | null;
  provider?: string | null;
  voice?: string | null;
  tools?: Record<string, unknown> | null;
}

export interface AgentOut {
  id: number;
  assistant_name: string;
  business_name?: string | null;
  phone_number?: string | null;
  first_message?: string | null;
  system_prompt?: string | null;
  provider?: string | null;
  voice?: string | null;
  voice_provider?: string | null;
  elevenlabs_voice_id?: string | null;
  openai_voice?: string | null;
  language?: string | null;
  model?: string | null;
  llm_provider?: string | null;
  tts_provider?: string | null;
  tools?: Record<string, unknown> | null;
  google_calendar_connected?: boolean;
  google_calendar_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PromptGenerateRequest {
  phone_number: string;
  business_name: string;
  business_type: string;
  location?: string | null;
  services?: string[];
  hours?: string | null;
  tone?: string;
  languages?: string[];
  booking_instructions?: string | null;
}

export interface GenerateAIPromptRequest {
  business_name: string;
  business_type?: string;
  services?: string;
  hours?: string;
  phone_number?: string;
  address?: string;
}

export async function createAgent(data: CreateAgentRequest): Promise<AgentOut> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create agent: ${res.status}`);
  return res.json();
}

export async function listAgents(): Promise<AgentOut[]> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list agents: ${res.status}`);
  return res.json();
}

export async function getAgent(agentId: number): Promise<AgentOut> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get agent: ${res.status}`);
  return res.json();
}

export async function updateAgent(agentId: number, data: Partial<CreateAgentRequest> & { model?: string; tts_provider?: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update agent: ${res.status}`);
}

export async function deleteAgent(agentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete agent: ${res.status}`);
}

export async function generatePrompt(data: PromptGenerateRequest): Promise<{ prompt: string }> {
  const res = await fetch(`${API_BASE}/api/prompt/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to generate prompt: ${res.status}`);
  return res.json();
}

export async function generateAIPrompt(data: GenerateAIPromptRequest): Promise<string> {
  const res = await fetch(`${API_BASE}/api/agents/generate-prompt`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to generate AI prompt: ${res.status}`);
  const json = await res.json();
  return typeof json === "string" ? json : json.prompt || JSON.stringify(json);
}

export async function getGoogleAuthUrl(agentId: number): Promise<string> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/google/auth`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get Google auth URL: ${res.status}`);
  const data = await res.json();
  return data.auth_url;
}

export async function getGoogleAuthUrlUserLevel(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/google/auth`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get Google auth URL: ${res.status}`);
  const data = await res.json();
  return data.auth_url;
}

export async function disconnectGoogle(agentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/google/disconnect`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to disconnect Google: ${res.status}`);
}

// Credits API

export interface PurchaseCreditsRequest {
  amount: number;
  payment_method?: string | null;
  transaction_id?: string | null;
}

export async function getCreditsBalance(): Promise<{ balance: number }> {
  const res = await fetch(`${API_BASE}/api/credits/balance`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get balance: ${res.status}`);
  return res.json();
}

export async function purchaseCredits(data: PurchaseCreditsRequest): Promise<any> {
  const res = await fetch(`${API_BASE}/api/credits/purchase`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to purchase credits: ${res.status}`);
  return res.json();
}

export async function getTransactions(limit = 50): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/credits/transactions?limit=${limit}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get transactions: ${res.status}`);
  return res.json();
}

export async function getCreditsStatus(): Promise<{ balance: number; low_balance: boolean }> {
  const res = await fetch(`${API_BASE}/api/credits/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get credits status: ${res.status}`);
  return res.json();
}

export async function createPaymentIntent(data: PurchaseCreditsRequest): Promise<{ client_secret: string }> {
  const res = await fetch(`${API_BASE}/api/credits/create-payment-intent`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create payment intent: ${res.status}`);
  return res.json();
}

// Auto-Recharge API

export interface AutoRechargeConfig {
  enabled: boolean;
  amount: number;
  payment_method_id?: string;
}

export async function getAutoRechargeConfig(): Promise<AutoRechargeConfig> {
  const res = await fetch(`${API_BASE}/api/credits/auto-recharge/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get auto-recharge config: ${res.status}`);
  return res.json();
}

export async function configureAutoRecharge(data: AutoRechargeConfig): Promise<any> {
  const res = await fetch(`${API_BASE}/api/credits/auto-recharge/configure`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to configure auto-recharge: ${res.status}`);
  return res.json();
}

export async function testAutoRecharge(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/credits/auto-recharge/test`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to test auto-recharge: ${res.status}`);
  return res.json();
}

// Usage API

export async function getCurrentUsage(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/usage/current`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get current usage: ${res.status}`);
  return res.json();
}

export async function getUsageHistory(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/usage/history`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get usage history: ${res.status}`);
  return res.json();
}

export async function getUsageCalls(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/usage/calls`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get calls: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data?.calls ?? data?.items ?? [];
}

export async function getCallDetails(callId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/api/usage/call-details/${callId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get call details: ${res.status}`);
  return res.json();
}

// Slack API

export interface SlackConfigRequest {
  slack_bot_token: string;
  slack_default_channel: string;
  slack_enabled: boolean;
}

export async function configureSlack(data: SlackConfigRequest): Promise<string> {
  const res = await fetch(`${API_BASE}/api/slack/configure`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to configure Slack: ${res.status}`);
  return res.json();
}

export async function getSlackStatus(): Promise<{ enabled: boolean; channel: string | null }> {
  const res = await fetch(`${API_BASE}/api/slack/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get Slack status: ${res.status}`);
  return res.json();
}

export async function testSlackNotification(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/slack/test`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to test Slack: ${res.status}`);
  return res.json();
}

export async function disableSlack(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/slack/disable`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to disable Slack: ${res.status}`);
  return res.json();
}

// Teams API

export interface TeamsConfigRequest {
  teams_webhook_url: string;
  teams_enabled: boolean;
}

export async function configureTeams(data: TeamsConfigRequest): Promise<string> {
  const res = await fetch(`${API_BASE}/api/teams/configure`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to configure Teams: ${res.status}`);
  return res.json();
}

export async function getTeamsStatus(): Promise<{ enabled: boolean; webhook_url: string | null }> {
  const res = await fetch(`${API_BASE}/api/teams/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get Teams status: ${res.status}`);
  return res.json();
}

export async function testTeamsNotification(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/teams/test`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to test Teams: ${res.status}`);
  return res.json();
}

export async function disableTeams(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/teams/disable`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to disable Teams: ${res.status}`);
  return res.json();
}

// Square API

export interface SquareConfigRequest {
  square_access_token: string;
  square_environment: string;
}

export async function configureSquare(data: SquareConfigRequest): Promise<any> {
  const res = await fetch(`${API_BASE}/api/square/configure`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to configure Square: ${res.status}`);
  return res.json();
}

export async function getSquareStatus(): Promise<{ enabled: boolean; environment: string | null }> {
  const res = await fetch(`${API_BASE}/api/square/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get Square status: ${res.status}`);
  return res.json();
}

export async function testSquarePayment(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/square/test-payment`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to test Square payment: ${res.status}`);
  return res.json();
}

export async function disableSquare(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/square/disable`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to disable Square: ${res.status}`);
  return res.json();
}

export async function listSquarePayments(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/square/payments`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list Square payments: ${res.status}`);
  return res.json();
}

export async function refundSquarePayment(paymentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/square/refund/${paymentId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to refund Square payment: ${res.status}`);
  return res.json();
}

// ElevenLabs API

export interface ElevenLabsConfigRequest {
  elevenlabs_api_key: string;
}

export async function configureElevenLabs(data: ElevenLabsConfigRequest): Promise<string> {
  const res = await fetch(`${API_BASE}/api/elevenlabs/configure`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to configure ElevenLabs: ${res.status}`);
  return res.json();
}

export async function getElevenLabsStatus(): Promise<{ enabled: boolean }> {
  const res = await fetch(`${API_BASE}/api/elevenlabs/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get ElevenLabs status: ${res.status}`);
  return res.json();
}

export async function listElevenLabsVoices(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/elevenlabs/voices`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list ElevenLabs voices: ${res.status}`);
  return res.json();
}

export async function listPopularVoices(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/elevenlabs/popular-voices`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list popular voices: ${res.status}`);
  return res.json();
}

export async function getElevenLabsSubscription(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/elevenlabs/subscription`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get ElevenLabs subscription: ${res.status}`);
  return res.json();
}

export async function disableElevenLabs(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/elevenlabs/disable`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to disable ElevenLabs: ${res.status}`);
  return res.json();
}

// Shopify API

export interface ShopifyConfigRequest {
  shop_name: string;
  access_token: string;
}

export async function configureShopify(data: ShopifyConfigRequest): Promise<{ success: boolean; product_count?: number; error?: string }> {
  const res = await fetch(`${API_BASE}/api/shopify/configure`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to configure Shopify: ${res.status}`);
  return res.json();
}

export async function getShopifyStatus(): Promise<{ enabled: boolean; shop_name?: string | null }> {
  const res = await fetch(`${API_BASE}/api/shopify/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get Shopify status: ${res.status}`);
  return res.json();
}

export async function disconnectShopify(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/shopify/disable`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to disconnect Shopify: ${res.status}`);
}

export async function listShopifyProducts(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/shopify/products`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list Shopify products: ${res.status}`);
  return res.json();
}

// Google Calendar (User-Level)

export async function getGoogleStatusUserLevel(): Promise<{ connected: boolean; email?: string }> {
  const res = await fetch(`${API_BASE}/api/google/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get Google status: ${res.status}`);
  return res.json();
}

export async function assignCalendarToAgent(agentId: number, calendarId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/google/assign`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ calendar_id: calendarId }),
  });
  if (!res.ok) throw new Error(`Failed to assign calendar: ${res.status}`);
  return res.json();
}

// VAD Settings

export interface VADSettings {
  silence_duration_ms?: number;
  speech_threshold?: number;
  prefix_padding_ms?: number;
}

export async function getAgentVADSettings(agentId: number): Promise<VADSettings> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/vad-settings`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get VAD settings: ${res.status}`);
  return res.json();
}

export async function updateAgentVADSettings(agentId: number, data: VADSettings): Promise<any> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/vad-settings`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update VAD settings: ${res.status}`);
  return res.json();
}

// Prompt Save/Load

export async function savePrompt(data: { prompt: string; name?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/api/prompt/save`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save prompt: ${res.status}`);
  return res.json();
}

export async function getSavedPrompt(): Promise<{ prompt: string; name?: string }> {
  const res = await fetch(`${API_BASE}/api/prompt/get`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get saved prompt: ${res.status}`);
  return res.json();
}

// Voice Library API

export async function getVoiceProviders(): Promise<any> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/voices/providers${token ? `?token=${token}` : ''}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get voice providers: ${res.status}`);
  return res.json();
}

export async function getElevenLabsVoicesLibrary(): Promise<any[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/voices/elevenlabs${token ? `?token=${token}` : ''}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get ElevenLabs voices: ${res.status}`);
  return res.json();
}

export async function getElevenLabsSubscriptionInfo(): Promise<any> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/voices/elevenlabs/subscription${token ? `?token=${token}` : ''}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get subscription info: ${res.status}`);
  return res.json();
}

export async function testVoice(provider: string, voiceId: string): Promise<any> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/voices/test/${provider}/${voiceId}${token ? `?token=${token}` : ''}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to test voice: ${res.status}`);
  return res.json();
}

// Advanced AI Prompt Generation

export async function generateAIPromptAdvanced(data: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${API_BASE}/api/agents/generate-prompt-ai`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to generate prompt: ${res.status}`);
  }
  const json = await res.json();
  return json.system_prompt || json.prompt || (typeof json === "string" ? json : JSON.stringify(json));
}

export async function refineAIPrompt(currentPrompt: string, feedback: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/agents/refine-prompt-ai`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ current_prompt: currentPrompt, refinement_instructions: feedback }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to refine prompt: ${res.status}`);
  }
  const json = await res.json();
  return json.system_prompt || json.prompt || (typeof json === "string" ? json : JSON.stringify(json));
}

// Agent Voice API

export async function setAgentVoice(agentId: number, data: { provider: string; voice_id: string }): Promise<any> {
  const payload: Record<string, string | null> = {
    voice_provider: data.provider,
    elevenlabs_voice_id: data.provider === 'elevenlabs' ? data.voice_id : null,
    openai_voice: data.provider === 'openai' ? data.voice_id : null,
  };
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/voice`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to set agent voice: ${res.status}`);
  return res.json();
}

// Developer API Keys

export interface DeveloperAPIKey {
  id: string;
  name: string;
  description?: string;
  key_prefix: string;
  created_at: string;
}

export async function listDeveloperKeys(): Promise<DeveloperAPIKey[]> {
  const res = await fetch(`${API_BASE}/api/developer/keys`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list API keys: ${res.status}`);
  return res.json();
}

export async function createDeveloperKey(data: { name: string; description?: string }): Promise<{ api_key: string; key: DeveloperAPIKey }> {
  const res = await fetch(`${API_BASE}/api/developer/keys`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create API key: ${res.status}`);
  return res.json();
}

export async function deleteDeveloperKey(keyId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/developer/keys/${keyId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete API key: ${res.status}`);
}

// Developer Webhooks

export interface DeveloperWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  created_at: string;
}

export async function listDeveloperWebhooks(): Promise<DeveloperWebhook[]> {
  const res = await fetch(`${API_BASE}/api/developer/webhooks`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list webhooks: ${res.status}`);
  return res.json();
}

export async function createDeveloperWebhook(data: { url: string; events: string[] }): Promise<DeveloperWebhook> {
  const res = await fetch(`${API_BASE}/api/developer/webhooks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create webhook: ${res.status}`);
  return res.json();
}

export async function deleteDeveloperWebhook(webhookId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/developer/webhooks/${webhookId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete webhook: ${res.status}`);
}

// ── Outbound Calls API ───────────────────────────────────────────────────────

export interface OutboundCallRequest {
  agent_id?: number;
  to_number: string;
  from_number?: string;
  contact_name?: string;
  notes?: string;
  system_prompt?: string;
  elevenlabs_voice_id?: string;
}

export interface OutboundCall {
  id: string;
  agent_id: number;
  agent_name?: string;
  to_number: string;
  contact_name?: string;
  notes?: string;
  status: "queued" | "initiated" | "ringing" | "in-progress" | "completed" | "failed" | "busy" | "no-answer" | "canceled";
  duration_seconds?: number | null;
  cost?: number | null;
  created_at: string;
  updated_at?: string | null;
  error_message?: string | null;
}

export async function initiateOutboundCall(data: OutboundCallRequest): Promise<OutboundCall> {
  const res = await fetch(`${API_BASE}/api/calls/outbound`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || `Failed to initiate call: ${res.status}`);
  }
  return res.json();
}

export async function getOutboundCalls(): Promise<OutboundCall[]> {
  const res = await fetch(`${API_BASE}/api/calls/outbound`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get outbound calls: ${res.status}`);
  return res.json();
}

export async function getOutboundCallStatus(callId: string): Promise<OutboundCall> {
  const res = await fetch(`${API_BASE}/api/calls/outbound/${callId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get call status: ${res.status}`);
  return res.json();
}

export async function cancelOutboundCall(callId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/calls/outbound/${callId}/cancel`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to cancel call: ${res.status}`);
}

// ── Contacts API ─────────────────────────────────────────────────────────────

export interface Contact {
  id: number;
  first_name: string;
  last_name?: string | null;
  phone_number: string;
  email?: string | null;
  company?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  // CRM fields
  status?: string | null;
  disposition?: string | null;
  source?: string | null;
  address?: string | null;
  next_followup?: string | null;
  last_contacted?: string | null;
  call_count?: number | null;
}

export interface ContactCreateRequest {
  first_name: string;
  last_name?: string;
  phone_number: string;
  email?: string;
  company?: string;
  tags?: string[];
  notes?: string;
  // CRM fields
  status?: string;
  disposition?: string;
  source?: string;
  address?: string;
  next_followup?: string;
}

export async function updateContactStatus(id: number, status: string, disposition?: string): Promise<Contact> {
  const res = await fetch(`${API_BASE}/api/contacts/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status, disposition }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || `Failed to update status: ${res.status}`);
  }
  return res.json();
}

export async function addContactNote(id: number, note: string): Promise<{ id: number; note: string; created_at: string }> {
  const res = await fetch(`${API_BASE}/api/contacts/${id}/notes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error("Failed to add note");
  return res.json();
}

export async function listContactNotes(id: number): Promise<{ id: number; note: string; created_at: string }[]> {
  const res = await fetch(`${API_BASE}/api/contacts/${id}/notes`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load notes");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.notes ?? data?.items ?? [];
}

// ── CRM Calls (separate from AI voice-agent calls) ───────────────────────────

export interface CRMCall {
  id: number;
  contact_id?: number | null;
  contact_name?: string | null;
  phone_number?: string | null;
  direction: "inbound" | "outbound";
  duration_seconds: number;
  status: string;
  notes?: string | null;
  called_at: string;
}

export async function listCRMCalls(): Promise<CRMCall[]> {
  const res = await fetch(`${API_BASE}/api/crm/calls`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load CRM calls");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.calls ?? data?.items ?? [];
}

export async function logCRMCall(data: Omit<CRMCall, "id" | "called_at">): Promise<CRMCall> {
  const res = await fetch(`${API_BASE}/api/crm/calls`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to log CRM call");
  return res.json();
}

export async function deleteCRMCall(callId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/crm/calls/${callId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete CRM call");
}

export async function listContacts(): Promise<Contact[]> {
  const res = await fetch(`${API_BASE}/api/contacts`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to list contacts: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data?.contacts ?? data?.items ?? [];
}

export async function createContact(data: ContactCreateRequest): Promise<Contact> {
  const res = await fetch(`${API_BASE}/api/contacts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || `Failed to create contact: ${res.status}`);
  }
  return res.json();
}

export async function updateContact(id: number, data: Partial<ContactCreateRequest>): Promise<Contact> {
  const res = await fetch(`${API_BASE}/api/contacts/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || `Failed to update contact: ${res.status}`);
  }
  return res.json();
}

export async function deleteContact(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/contacts/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete contact: ${res.status}`);
}

export async function importContacts(contacts: ContactCreateRequest[]): Promise<{ created: number; errors: number }> {
  const res = await fetch(`${API_BASE}/api/contacts/import`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ contacts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || `Failed to import contacts: ${res.status}`);
  }
  return res.json();
}

// ── Contact Calls ─────────────────────────────────────────────────────────────

export interface ContactCall {
  id: number;
  call_sid?: string | null;
  call_from?: string | null;
  call_to?: string | null;
  duration_seconds?: number | null;
  cost_usd?: number | null;
  status?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  agent_name?: string | null;
}

export async function listContactCalls(contactId: number): Promise<ContactCall[]> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/calls`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load calls");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.calls ?? data?.items ?? [];
}

// ── Contact SMS ───────────────────────────────────────────────────────────────

export interface ContactSMS {
  id: string | number;
  direction: "inbound" | "outbound";
  message: string;
  status?: string | null;
  twilio_sid?: string | null;
  created_at: string;
  source?: string;
}

export async function listContactSMS(contactId: number): Promise<ContactSMS[]> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/sms`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load SMS");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.sms ?? data?.messages ?? data?.items ?? [];
}

export async function sendContactSMS(contactId: number, message: string): Promise<ContactSMS> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/sms`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Failed to send SMS");
  return res.json();
}

// ── Contact Emails ────────────────────────────────────────────────────────────

export interface ContactEmail {
  id: number;
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  from_address?: string | null;
  to_address?: string | null;
  status?: string | null;
  created_at: string;
}

export async function listContactEmails(contactId: number): Promise<ContactEmail[]> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/emails`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load emails");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.emails ?? data?.items ?? [];
}

export async function addContactEmail(contactId: number, data: {
  subject: string; body: string; direction?: string; from_address?: string; to_address?: string;
}): Promise<ContactEmail> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/emails`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to add email");
  return res.json();
}

// ── Contact Appointments ──────────────────────────────────────────────────────

export interface Appointment {
  id: number;
  contact_id?: number;
  title: string;
  description?: string | null;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  status?: string | null;
  created_at?: string;
  // Contact info (from global list)
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
}

export async function listContactAppointments(contactId: number): Promise<Appointment[]> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/appointments`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load appointments");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.appointments ?? data?.items ?? [];
}

export async function createContactAppointment(contactId: number, data: Omit<Appointment, "id">): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/appointments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create appointment");
  return res.json();
}

export async function updateContactAppointment(contactId: number, aptId: number, data: Omit<Appointment, "id">): Promise<void> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/appointments/${aptId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update appointment");
}

export async function deleteContactAppointment(contactId: number, aptId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/appointments/${aptId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete appointment");
}

export async function listAllAppointments(): Promise<Appointment[]> {
  const res = await fetch(`${API_BASE}/api/appointments`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load appointments");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.appointments ?? data?.items ?? [];
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: number;
  contact_id?: number | null;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: "low" | "medium" | "high" | string;
  completed: boolean;
  created_at?: string;
  // Contact info (from global list)
  first_name?: string | null;
  last_name?: string | null;
}

export async function listContactTasks(contactId: number): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/tasks`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load tasks");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.tasks ?? data?.items ?? [];
}

export async function createContactTask(contactId: number, data: Omit<Task, "id" | "completed">): Promise<Task> {
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}/tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create task");
  return res.json();
}

export async function listAllTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/api/tasks`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load tasks");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.tasks ?? data?.items ?? [];
}

export async function updateTask(taskId: number, data: Partial<Task> & { title: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update task");
}

export async function deleteTask(taskId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete task");
}
