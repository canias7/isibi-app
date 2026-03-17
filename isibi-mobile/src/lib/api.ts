import * as SecureStore from "expo-secure-store";

export const API_BASE = "https://isibi-backend.onrender.com";

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync("auth_token");
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync("auth_token", token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync("auth_token");
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail ?? "Login failed");
  }
  const data = await res.json();
  if (data.access_token) await saveToken(data.access_token);
  return data;
}

export async function logout() {
  await clearToken();
}

// ── Agents ────────────────────────────────────────────────────────────────────

export async function listAgents() {
  return apiFetch("/api/agents");
}

export async function getAgent(id: number) {
  return apiFetch(`/api/agents/${id}`);
}

export async function updateAgent(id: number, payload: Record<string, unknown>) {
  return apiFetch(`/api/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function listContacts(params?: { limit?: number; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.limit)  qs.set("limit",  String(params.limit));
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/api/contacts${query}`);
}

// ── CRM Calls ─────────────────────────────────────────────────────────────────

export async function listCRMCalls() {
  return apiFetch("/api/crm/calls");
}

export async function initiateOutboundCall(payload: {
  to_number: string;
  contact_name?: string;
  system_prompt?: string;
  from_number?: string;
}) {
  return apiFetch("/api/calls/outbound", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function getDashboardStats() {
  return apiFetch("/api/crm/dashboard-stats");
}

// ── Credits ───────────────────────────────────────────────────────────────────

export async function getCreditsBalance() {
  return apiFetch("/api/credits/balance");
}

// ── SMS Inbox (AI sessions) ───────────────────────────────────────────────────

export async function listSMSSessions() {
  return apiFetch("/api/sms/ai/sessions");
}

export async function getSessionMessages(sessionId: number) {
  return apiFetch(`/api/sms/ai/sessions/${sessionId}/messages`);
}

// ── Phone numbers ─────────────────────────────────────────────────────────────

export async function getMyNumbers() {
  return apiFetch("/api/phone/my-numbers");
}

// ── Push notifications ─────────────────────────────────────────────────────────

export async function registerPushToken(token: string, platform: string) {
  return apiFetch("/api/push/register", {
    method: "POST",
    body: JSON.stringify({ token, platform }),
  });
}

export async function unregisterPushToken(token: string) {
  return apiFetch("/api/push/unregister", {
    method: "POST",
    body: JSON.stringify({ token }),
  }).catch(() => null); // best-effort
}
