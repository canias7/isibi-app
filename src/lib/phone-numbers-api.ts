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

export interface AvailableNumber {
  phone_number: string;
  friendly_name?: string;
  region?: string;
  country?: string;
  monthly_cost?: number;
  capabilities?: Record<string, boolean>;
}

export interface PurchasedNumber {
  id?: number;
  phone_number: string;
  twilio_sid?: string;
  agent_id?: number | null;
  agent_name?: string | null;
  status?: string;
  purchased_at?: string;
}

// POST /api/phone/search — search available numbers
export async function searchAvailableNumbers(country = "US", area_code?: string): Promise<AvailableNumber[]> {
  const body: Record<string, unknown> = { country };
  if (area_code) body.area_code = area_code;

  const res = await fetch(`${API_BASE}/api/phone/search`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to search numbers: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data?.numbers ?? data?.available_numbers ?? [];
}

// POST /api/phone/purchase — purchase a phone number
export async function purchasePhoneNumber(phoneNumber: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/phone/purchase`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to purchase number: ${res.status}`);
  }
  return res.json();
}

// GET /api/phone/my-numbers — get user's purchased numbers
export async function getMyPhoneNumbers(): Promise<PurchasedNumber[]> {
  const res = await fetch(`${API_BASE}/api/phone/my-numbers`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch phone numbers: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data?.numbers ?? [];
}

// POST /api/phone/release/{twilio_sid} — release a purchased number by Twilio SID
export async function releasePhoneNumberBySid(twilioSid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/phone/release/${twilioSid}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to release number: ${res.status}`);
}

// DELETE /api/phone/release?phone_number=... — release a purchased number by phone number
export async function releasePhoneNumber(phoneNumber: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/phone/release?phone_number=${encodeURIComponent(phoneNumber)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to release number: ${res.status}`);
}

// DELETE /api/agents/{agent_id}/phone/release — release agent's phone number
export async function releaseAgentPhoneNumber(agentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/phone/release`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to release agent phone: ${res.status}`);
}

// GET /api/agents/{agent_id}/phone/status — get agent phone number status
export async function getAgentPhoneStatus(agentId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/phone/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get phone status: ${res.status}`);
  return res.json();
}
