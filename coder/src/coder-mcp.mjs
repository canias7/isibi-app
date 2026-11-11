// CONNECTORS (MCP), ONE LIST PER PERSON FOR THE WHOLE PLATFORM (owner, 2026-11-10: "let's make one list for the
// platform ... per person ... so Gloopy and Coder, they can both have the MCPs"; "setting connector page where you add
// MCP server"). Like Claude's connectors: a person adds an MCP server once (its address, then its own sign-in or a key),
// and every agent of theirs can use its tools.
//
// The sign-in never reaches Coder's machine (as with the Grok key, coder-model-gate.mjs): the machine is told only the
// tools' names and descriptions, and sends each tool call here with its job's pass; the Worker adds the sign-in and calls
// the MCP server. What comes back is the server's answer, as text.
//
// MCP's "Streamable HTTP" transport (spec 2025-06-18): JSON-RPC 2.0 POSTed to one address; the answer is JSON or an
// event stream; the server may give an Mcp-Session-Id to send back. Its sign-in is OAuth 2.1 with PKCE, the server found
// from the MCP server's protected-resource metadata (RFC 9728), and Coder registered as a client on the fly (RFC 7591).
import { seal, unseal } from "./coder-github.mjs";
import { modelPass } from "./coder-model-gate.mjs";

export const MCP_VERSION = "2025-06-18";
export const CONNECTORS_MAX = 20;
export const TOOLS_PER_CONNECTOR = 40;
/** The most tools of all connectors told to Grok in one job (a long tool list costs every call and confuses the model). */
export const TOOLS_MAX = 80;
/**
 * LONG ANSWERS, LIKE CLAUDE CODE'S: its MCP output limit is 25,000 tokens (MAX_MCP_OUTPUT_TOKENS) and text over 50,000
 * characters is saved to a file Claude reads. The Worker passes up to RESULT_MAX characters; Coder's machine saves what is
 * over INLINE_MAX to a file (container/coder-agent.mjs).
 */
export const RESULT_MAX = 500_000;
export const REQUEST_TIMEOUT_MS = 60_000;
export const CALL_TIMEOUT_MS = 5 * 60_000;
export const CALLBACK_PATH = "/api/coder/connectors/callback";
export const MCP_PATH = "/api/coder/mcp";
export const STATE_COOKIE = "gf_mcs";
const PENDING_MS = 15 * 60 * 1000;
const CLIENT = { name: "Go Farther", version: "1.0.0" };

const enc = new TextEncoder();
const b64url = (buf) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const rand = (n = 24) => b64url(crypto.getRandomValues(new Uint8Array(n)));

/** The platform's list, not Coder's: Gloopy reads the same one. */
export const listKey = (uid) => "connectors/" + uid + ".json";
const pendingKey = (state) => "connectors/pending/" + state + ".json";

// ── THE LIST ──────────────────────────────────────────────────────────────────────────────────────────────────────

async function getJson(bucket, key, fallback) {
  try { const o = await bucket.get(key); return o ? JSON.parse(await o.text()) : fallback; } catch { return fallback; }
}
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });

export async function readConnectors(bucket, uid) {
  const v = await getJson(bucket, listKey(uid), []);
  return Array.isArray(v) ? v.filter((c) => c && typeof c.id === "string" && typeof c.url === "string") : [];
}
export const writeConnectors = (bucket, uid, list) => putJson(bucket, listKey(uid), list.slice(0, CONNECTORS_MAX));

// ── TOOL PERMISSIONS, LIKE CLAUDE'S (owner, 2026-11-11, a screenshot of Claude's connector page: "Like this look"): each tool
// is Allow, Needs approval or Block; read-only tools start on Allow, the others on Needs approval. Block: never offered.
export const PERMS = ["allow", "ask", "block"];
export const permOf = (c, t) => { const p = c && c.perms && c.perms[t.name]; return PERMS.includes(p) ? p : t.readOnly ? "allow" : "ask"; };

/** Set one tool's permission, or a whole group's ("read" or "write"). Gives the connector, or null. */
export async function setPerms(bucket, uid, id, { tool = "", group = "", perm }) {
  if (!PERMS.includes(perm)) return null;
  const list = await readConnectors(bucket, uid);
  const c = list.find((x) => x.id === id);
  if (!c) return null;
  const perms = { ...(c.perms || {}) };
  for (const t of c.tools || []) if (t.name === tool || (group === "read" && t.readOnly) || (group === "write" && !t.readOnly)) perms[t.name] = perm;
  c.perms = perms;
  await writeConnectors(bucket, uid, list);
  return c;
}

/**
 * CONNECTORS TO PICK FROM (the Discover tab): well-known MCP servers that sign in on their own (OAuth with the client
 * registered on the fly) over Streamable HTTP. Adding one is the same as typing its address.
 */
export const CATALOG = Object.freeze([
  // The owner's list (2026-11-11), each address tried live that day: it asks to sign in and lets apps register on the fly.
  { group: "Databases", name: "Neon", url: "https://mcp.neon.tech/mcp", about: "Manage Neon Postgres projects, branches and queries." },
  { group: "Databases", name: "Supabase", url: "https://mcp.supabase.com/mcp", about: "Manage Supabase projects: run SQL, change tables, read logs and deploy edge functions." },
  { group: "Hosting", name: "Vercel", url: "https://mcp.vercel.com", about: "See Vercel projects, deployments and their logs." },
  { group: "Hosting", name: "Cloudflare", url: "https://bindings.mcp.cloudflare.com/mcp", about: "Workers, KV, R2 and D1 in your Cloudflare account." },
  { group: "Hosting", name: "Cloudflare Logs", url: "https://observability.mcp.cloudflare.com/mcp", about: "Your Cloudflare Workers' logs and analytics, for debugging." },
  { group: "Hosting", name: "Railway", url: "https://mcp.railway.com", about: "Railway projects, services, deployments and variables." },
  { group: "Email", name: "Resend", url: "https://mcp.resend.com/mcp", about: "Send email and manage domains, audiences and broadcasts in Resend." },
  { group: "Monitoring and debugging", name: "Sentry", url: "https://mcp.sentry.dev/mcp", about: "Look into errors, issues and releases in Sentry." },
  { group: "Project management", name: "Linear", url: "https://mcp.linear.app/mcp", about: "Find, create and update issues, projects and comments in Linear." },
  { group: "Payments", name: "Stripe", url: "https://mcp.stripe.com", about: "Work with customers, payments, products and invoices in Stripe." },
  { group: "Authentication", name: "Clerk", url: "https://mcp.clerk.com/mcp", about: "Clerk users, organizations and sign-in settings." },
  { group: "Docs", name: "Cloudflare Docs", url: "https://docs.mcp.cloudflare.com/mcp", about: "Search Cloudflare's documentation (no sign-in)." },
]);
/**
 * ON THE OWNER'S LIST BUT NOT CONNECTABLE YET (tried 2026-11-11): Render and MongoDB have official servers whose sign-in
 * does not let apps register on the fly (they need an app registered with them first); Postmark, Aikido and Redis have no
 * official hosted MCP server.
 */
export const CATALOG_LATER = Object.freeze([
  { group: "Hosting", name: "Render", url: "https://mcp.render.com/mcp", why: "needs an app registered with Render first" },
  { group: "Databases", name: "MongoDB", url: "https://mcp.mongodb.com/mcp", why: "needs an app registered with MongoDB first" },
  { group: "Email", name: "Postmark", why: "no official hosted server yet" },
  { group: "Security", name: "Aikido", why: "no official hosted server yet" },
  { group: "Databases", name: "Redis", why: "no official hosted server yet" },
]);
const aboutOf = (url) => { const k = CATALOG.find((x) => x.url === url); return k ? k.about : ""; };

/** What the page is shown of a connector: never its sign-in. */
export function connectorOut(c) {
  return { id: c.id, name: c.name, url: c.url, about: c.about || aboutOf(c.url), custom: !aboutOf(c.url), auth: c.auth || "none", status: c.status || "ok", error: c.error || "", tools: (c.tools || []).map((t) => ({ name: t.name, title: t.title || "", description: String(t.description || "").slice(0, 300), readOnly: !!t.readOnly, perm: permOf(c, t), ...(t.always ? { always: true } : {}) })), at: c.at || 0 };
}

/** A connector's address: https only (http only for localhost tests), no user name or password in it. */
export function cleanUrl(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return ""; }
  if (u.username || u.password) return "";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return "";
  u.hash = "";
  return u.href;
}
export function cleanName(raw, url) {
  const n = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (n) return n;
  try { return new URL(url).hostname.replace(/^(www|mcp|api)\./, "").split(".")[0].slice(0, 40) || "Connector"; } catch { return "Connector"; }
}

// ── TOOL NAMES GROK SEES ──────────────────────────────────────────────────────────────────────────────────────────

/** "Linear" + "create_issue" → "mcp__linear__create_issue": letters, digits, _ and -, at most 64 (xAI's limit). */
export function toolName(connectorName, tool) {
  const slug = (s, n) => String(s || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, n) || "x";
  return ("mcp__" + slug(connectorName, 20) + "__" + slug(tool, 64)).slice(0, 64);
}

/**
 * The tools of a person's connectors as Grok's function tools, and which connector and tool each name is: at most
 * TOOLS_MAX in all. `off` is the ids of connectors switched off.
 */
export function toolsFor(list, off = []) {
  const tools = [], map = {};
  const used = new Set();
  for (const c of list) {
    if (off.includes(c.id) || c.status === "auth" || !Array.isArray(c.tools)) continue;
    for (const t of c.tools.filter((x) => permOf(c, x) !== "block").slice(0, TOOLS_PER_CONNECTOR)) {
      if (tools.length >= TOOLS_MAX) break;
      let name = toolName(c.name, t.name);
      for (let k = 2; used.has(name); k++) name = toolName(c.name + k, t.name);
      used.add(name);
      map[name] = { id: c.id, tool: t.name };
      const params = t.inputSchema && typeof t.inputSchema === "object" && t.inputSchema.type === "object" ? t.inputSchema : { type: "object", properties: {} };
      tools.push({ name, label: c.name + ": " + (t.title || t.name), readOnly: !!t.readOnly, perm: permOf(c, t), ...(t.always ? { always: true } : {}),
        description: ("From the " + c.name + " connector (MCP). " + String(t.description || t.title || t.name)).slice(0, 1000), parameters: params });
    }
  }
  return { tools, map };
}

// ── THE MCP CONVERSATION ──────────────────────────────────────────────────────────────────────────────────────────

export class NeedsSignIn extends Error {
  constructor(header) { super("this MCP server asks you to sign in"); this.header = String(header || ""); }
}

/** The JSON-RPC answer with `id` in a response: plain JSON, or the `data:` lines of an event stream. */
export async function readAnswer(res, id) {
  const type = String(res.headers.get("content-type") || "");
  const text = await res.text();
  const msgs = [];
  if (/text\/event-stream/i.test(type)) {
    for (const block of text.split(/\r?\n\r?\n/)) {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
      if (data) { try { msgs.push(JSON.parse(data)); } catch { /* not JSON */ } }
    }
  } else if (text.trim()) {
    try { const j = JSON.parse(text); if (Array.isArray(j)) msgs.push(...j); else msgs.push(j); } catch { throw new Error("the MCP server's answer could not be read"); }
  }
  const m = msgs.find((x) => x && x.id === id);
  if (!m) throw new Error("the MCP server gave no answer");
  if (m.error) throw new Error("the MCP server said: " + String(m.error.message || "error").slice(0, 300));
  return m.result;
}

/**
 * One MCP session: initialize, then the methods asked for, in order. `token`: the sign-in (a Bearer token) or "".
 * Throws NeedsSignIn on 401.
 */
export async function mcpSession(url, token, steps, { fetchFn = fetch } = {}) {
  let session = "", id = 0;
  const post = async (method, params, notify = false) => {
    const msg = { jsonrpc: "2.0", method, ...(params ? { params } : {}), ...(notify ? {} : { id: ++id }) };
    const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": MCP_VERSION };
    if (token) headers.authorization = "Bearer " + token;
    if (session) headers["mcp-session-id"] = session;
    let res;
    // TIMEOUTS, LIKE CLAUDE CODE'S: a request gets at least 60 seconds; a tool call up to the 5-minute idle limit.
    const ms = method === "tools/call" ? CALL_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
    try { res = await fetchFn(url, { method: "POST", headers, body: JSON.stringify(msg), signal: AbortSignal.timeout(ms) }); }
    catch (e) { throw new Error(e && (e.name === "TimeoutError" || e.name === "AbortError") ? "the MCP server did not answer within " + Math.round(ms / 1000) + " seconds" : "the MCP server could not be reached"); }
    // (Claude Code: a server "needs auth" on 401 Unauthorized or 403 Forbidden.)
    if (res.status === 401 || res.status === 403) throw new NeedsSignIn(res.headers.get("www-authenticate"));
    if (!res.ok && !(notify && res.status === 202)) throw new Error("the MCP server answered " + res.status);
    const s = res.headers.get("mcp-session-id");
    if (s) session = s;
    if (notify) return null;
    return readAnswer(res, msg.id);
  };
  await post("initialize", { protocolVersion: MCP_VERSION, capabilities: {}, clientInfo: CLIENT });
  await post("notifications/initialized", null, true);
  const out = [];
  for (const [method, params] of steps) out.push(await post(method, params));
  return out;
}

/** All the server's tools (up to 5 pages), as kept on the list. */
export async function listTools(url, token, opts) {
  const tools = [];
  let cursor;
  for (let page = 0; page < 5; page++) {
    const [r] = await mcpSession(url, token, [["tools/list", cursor ? { cursor } : {}]], opts);
    for (const t of (r && Array.isArray(r.tools) ? r.tools : [])) {
      if (!t || typeof t.name !== "string") continue;
      tools.push({ name: t.name.slice(0, 100), title: String(t.title || (t.annotations && t.annotations.title) || "").slice(0, 100), description: String(t.description || "").slice(0, 2000), inputSchema: t.inputSchema && typeof t.inputSchema === "object" ? t.inputSchema : { type: "object", properties: {} }, readOnly: !!(t.annotations && t.annotations.readOnlyHint === true), ...(t._meta && t._meta["anthropic/requiresUserInteraction"] === true ? { always: true } : {}) });
    }
    cursor = r && r.nextCursor;
    if (!cursor) break;
  }
  return tools.slice(0, 200);
}

/** A tool's answer as text for Grok: its text parts, what else it gave named, at most RESULT_MAX. */
export function resultText(r) {
  const parts = [];
  for (const p of (r && Array.isArray(r.content) ? r.content : [])) {
    if (!p) continue;
    if (p.type === "text") parts.push(String(p.text || ""));
    else if (p.type === "resource" && p.resource) parts.push(typeof p.resource.text === "string" ? p.resource.text : "[a file: " + String(p.resource.uri || "") + "]");
    else if (p.type === "resource_link") parts.push("[a link: " + String(p.uri || "") + "]");
    else parts.push("[" + String(p.type || "something") + " not shown]");
  }
  if (!parts.length && r && r.structuredContent) parts.push(JSON.stringify(r.structuredContent));
  let text = parts.join("\n") || "(no output)";
  if (text.length > RESULT_MAX) text = text.slice(0, RESULT_MAX) + "\n…(cut: the answer was " + text.length + " characters)";
  return { text, isError: !!(r && r.isError) };
}

// ── SIGN-IN (OAuth 2.1, PKCE, the client registered on the fly) ──────────────────────────────────────────────────

const getMeta = async (u, fetchFn) => {
  try { const r = await fetchFn(u, { headers: { accept: "application/json", "mcp-protocol-version": MCP_VERSION } }); return r.ok ? await r.json() : null; } catch { return null; }
};
/** RFC 8414 / 9728's well-known address for an issuer or resource with a path: the path goes after the well-known part. */
const wellKnown = (base, name) => { const u = new URL(base); const path = u.pathname.replace(/\/+$/, ""); return u.origin + "/.well-known/" + name + (path && path !== "/" ? path : ""); };

/** Where to sign in for this MCP server: its authorization server's metadata. */
export async function discover(url, wwwAuth, { fetchFn = fetch } = {}) {
  const m = /resource_metadata="([^"]+)"/i.exec(String(wwwAuth || ""));
  let prm = m ? await getMeta(m[1], fetchFn) : null;
  if (!prm) prm = await getMeta(wellKnown(url, "oauth-protected-resource"), fetchFn);
  if (!prm) prm = await getMeta(new URL(url).origin + "/.well-known/oauth-protected-resource", fetchFn);
  const issuer = prm && Array.isArray(prm.authorization_servers) && prm.authorization_servers[0] ? String(prm.authorization_servers[0]) : new URL(url).origin;
  let as = await getMeta(wellKnown(issuer, "oauth-authorization-server"), fetchFn);
  if (!as) as = await getMeta(wellKnown(issuer, "openid-configuration"), fetchFn);
  if (!as) as = await getMeta(new URL(issuer).origin + "/.well-known/oauth-authorization-server", fetchFn);
  if (!as || !as.authorization_endpoint || !as.token_endpoint) throw new Error("this MCP server's sign-in could not be found; it may need a key instead");
  return { resource: prm && prm.resource ? String(prm.resource) : url, authorize: String(as.authorization_endpoint), token: String(as.token_endpoint), register: as.registration_endpoint ? String(as.registration_endpoint) : "", scopes: prm && Array.isArray(prm.scopes_supported) ? prm.scopes_supported.join(" ") : "" };
}

export function redirectUri(env) { return String((env && env.CODER_PUBLIC_URL) || "https://coder.gofarther.dev").replace(/\/+$/, "") + CALLBACK_PATH; }

/** Coder as a client of that sign-in server (RFC 7591). */
export async function register(where, redirect, { fetchFn = fetch } = {}) {
  if (!where.register) throw new Error("this MCP server's sign-in does not let new apps register; it may need a key instead");
  let r;
  try { r = await fetchFn(where.register, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ client_name: CLIENT.name, redirect_uris: [redirect], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }) }); }
  catch { throw new Error("the sign-in server could not be reached"); }
  const j = r.ok ? await r.json().catch(() => null) : null;
  if (!j || !j.client_id) throw new Error("the sign-in server did not register Go Farther (" + r.status + ")");
  return { id: String(j.client_id), secret: j.client_secret ? String(j.client_secret) : "" };
}

export async function pkce() {
  const verifier = rand(48);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", enc.encode(verifier)));
  return { verifier, challenge };
}

/** Starts a sign-in: keeps what the callback needs (sealed), and gives the address to send the person to. */
export async function startSignIn(env, bucket, { uid, connector, wwwAuth, nonce, fetchFn = fetch, now = Date.now() }) {
  const where = await discover(connector.url, wwwAuth, { fetchFn });
  const redirect = redirectUri(env);
  const client = await register(where, redirect, { fetchFn });
  const { verifier, challenge } = await pkce();
  const state = rand(24);
  await putJson(bucket, pendingKey(state), { box: await seal(env, { uid, id: connector.id, verifier, client, where, redirect, nonce, until: now + PENDING_MS }) });
  const u = new URL(where.authorize);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", client.id);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("resource", where.resource);
  if (where.scopes) u.searchParams.set("scope", where.scopes);
  return u.href;
}

async function tokenCall(endpoint, form, client, fetchFn) {
  const headers = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (client.secret) headers.authorization = "Basic " + btoa(client.id + ":" + client.secret);
  else form.client_id = client.id;
  let r;
  try { r = await fetchFn(endpoint, { method: "POST", headers, body: new URLSearchParams(form).toString() }); } catch { throw new Error("the sign-in server could not be reached"); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.access_token) throw new Error("the sign-in server refused (" + r.status + (j && j.error ? ": " + String(j.error).slice(0, 60) : "") + ")");
  return j;
}
const tokenRecord = (j, now, old = {}) => ({ access: String(j.access_token), refresh: j.refresh_token ? String(j.refresh_token) : old.refresh || "", expires: Number(j.expires_in) > 0 ? now + Number(j.expires_in) * 1000 : 0 });

/** The sign-in's return: the code for a token. Gives { uid, id } of the connector now signed in, or throws. */
export async function finishSignIn(env, bucket, { state, code, nonce, fetchFn = fetch, now = Date.now() }) {
  if (!/^[\w-]{20,64}$/.test(String(state || "")) || !code) throw new Error("not a sign-in");
  const raw = await getJson(bucket, pendingKey(state), null);
  if (typeof bucket.delete === "function") await bucket.delete(pendingKey(state)).catch(() => {});
  if (!raw || !raw.box) throw new Error("that sign-in has ended; try again");
  const p = await unseal(env, raw.box);
  if (!p || p.until < now) throw new Error("that sign-in has ended; try again");
  // The browser that started it (its cookie), so a sign-in link made by someone else cannot attach your account to theirs.
  if (!p.nonce || p.nonce !== nonce) throw new Error("finish the sign-in in the browser that started it");
  const j = await tokenCall(p.where.token, { grant_type: "authorization_code", code: String(code), redirect_uri: p.redirect, code_verifier: p.verifier, resource: p.where.resource }, p.client, fetchFn);
  const list = await readConnectors(bucket, p.uid);
  const c = list.find((x) => x.id === p.id);
  if (!c) throw new Error("that connector was removed");
  c.auth = "oauth";
  c.box = await seal(env, { oauth: { ...tokenRecord(j, now), client: p.client, endpoint: p.where.token, resource: p.where.resource } });
  c.status = "ok"; c.error = "";
  try { c.tools = await listTools(c.url, String(j.access_token), { fetchFn }); } catch (e) { c.status = "error"; c.error = String(e.message || e).slice(0, 200); }
  await writeConnectors(bucket, p.uid, list);
  return { uid: p.uid, id: c.id };
}

/** A connector's token now (refreshed when it ends within a minute), or "" for none. Saves a refreshed one. */
export async function tokenOf(env, bucket, uid, c, { fetchFn = fetch, now = Date.now(), force = false } = {}) {
  if (!c.box) return "";
  let s;
  try { s = await unseal(env, c.box); } catch { return ""; }
  if (s.key) return String(s.key);
  const o = s.oauth;
  if (!o) return "";
  if (!force && (!o.expires || o.expires - now > 60_000)) return o.access;
  if (!o.refresh) return force ? "" : o.access;
  const j = await tokenCall(o.endpoint, { grant_type: "refresh_token", refresh_token: o.refresh, resource: o.resource }, o.client, fetchFn);
  const next = { ...o, ...tokenRecord(j, now, o) };
  const list = await readConnectors(bucket, uid);
  const mine = list.find((x) => x.id === c.id);
  if (mine) { mine.box = await seal(env, { oauth: next }); await writeConnectors(bucket, uid, list); }
  return next.access;
}

// ── ADD, CHECK, CALL ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Adds (or re-checks) a connector: with a key, or none, its tools are read now; a server that asks to sign in gives
 * { signIn: address } for the page to open.
 */
export async function addConnector(env, bucket, uid, { name, url, key = "", id = "", nonce = "", fetchFn = fetch, now = Date.now() }) {
  const list = await readConnectors(bucket, uid);
  let c = id ? list.find((x) => x.id === id) : null;
  if (id && !c) throw new Error("no such connector");
  if (!c) {
    const clean = cleanUrl(url);
    if (!clean) throw new Error("give the MCP server's address, starting with https://");
    if (list.length >= CONNECTORS_MAX) throw new Error("at most " + CONNECTORS_MAX + " connectors");
    if (list.some((x) => x.url === clean)) throw new Error("that MCP server is already on your list");
    c = { id: "c" + rand(9).replace(/[^A-Za-z0-9]/g, "x").toLowerCase(), name: cleanName(name, clean), url: clean, auth: "none", tools: [], status: "auth", at: now };
    list.push(c);
  }
  const k = String(key || "").trim();
  if (k) { c.auth = "key"; c.box = await seal(env, { key: k.slice(0, 4000) }); }
  let token = "";
  try { token = await tokenOf(env, bucket, uid, c, { fetchFn, now }); } catch { token = ""; }
  try {
    try { c.tools = await listTools(c.url, token, { fetchFn }); }
    catch (e) {
      // (Claude Code: on a 401 with a refresh token it refreshes and tries once more.)
      if (!(e instanceof NeedsSignIn) || c.auth !== "oauth") throw e;
      let fresh = "";
      try { fresh = await tokenOf(env, bucket, uid, c, { fetchFn, now, force: true }); } catch { fresh = ""; }
      if (!fresh) throw e;
      const again = await readConnectors(bucket, uid);
      const mine = again.find((x) => x.id === c.id);
      if (mine) c.box = mine.box;
      c.tools = await listTools(c.url, fresh, { fetchFn });
    }
    c.status = "ok"; c.error = "";
    await writeConnectors(bucket, uid, list);
    return { connector: c };
  } catch (e) {
    if (e instanceof NeedsSignIn && !k) {
      c.status = "auth"; c.error = "";
      await writeConnectors(bucket, uid, list);
      return { connector: c, signIn: await startSignIn(env, bucket, { uid, connector: c, wwwAuth: e.header, nonce, fetchFn, now }) };
    }
    // A new one that does not work is not kept.
    if (!id) throw e instanceof NeedsSignIn ? new Error("the MCP server refused that key") : e;
    c.status = e instanceof NeedsSignIn ? "auth" : "error";
    c.error = e instanceof NeedsSignIn ? "the key was refused" : String(e.message || e).slice(0, 200);
    await writeConnectors(bucket, uid, list);
    return { connector: c };
  }
}

export async function removeConnector(bucket, uid, id) {
  const list = await readConnectors(bucket, uid);
  const next = list.filter((x) => x.id !== id);
  if (next.length === list.length) return false;
  await writeConnectors(bucket, uid, next);
  return true;
}

/** One tool call for a job: the sign-in added here (refreshed and tried once more on a 401). */
export async function callTool(env, bucket, uid, connectorId, tool, args, { fetchFn = fetch, now = Date.now() } = {}) {
  const list = await readConnectors(bucket, uid);
  const c = list.find((x) => x.id === connectorId);
  if (!c) return { text: "error: that connector was removed", isError: true };
  const once = async (force) => {
    const token = await tokenOf(env, bucket, uid, c, { fetchFn, now, force });
    const [r] = await mcpSession(c.url, token, [["tools/call", { name: tool, arguments: args && typeof args === "object" && !Array.isArray(args) ? args : {} }]], { fetchFn });
    return resultText(r);
  };
  try { return await once(false); }
  catch (e) {
    if (e instanceof NeedsSignIn && c.auth === "oauth") {
      try { return await once(true); } catch { /* below */ }
    }
    if (e instanceof NeedsSignIn) {
      c.status = "auth"; await writeConnectors(bucket, uid, list);
      return { text: "error: the " + c.name + " connector needs the owner to sign in again (Settings, Connectors)", isError: true };
    }
    return { text: "error: " + String(e.message || e).slice(0, 300), isError: true };
  }
}

/** What a job may call, kept for its turn (`coder/<uid>/<chat>/mcp.json`): the tool names and what each one is. */
export const jobToolsKey = (uid, id) => "coder/" + uid + "/" + id + "/mcp.json";
export async function keepJobTools(bucket, uid, id, turn, map) { await putJson(bucket, jobToolsKey(uid, id), { turn, map }); }
export async function jobTool(bucket, uid, id, turn, name) {
  const o = await getJson(bucket, jobToolsKey(uid, id), null);
  return o && String(o.turn) === String(turn) && o.map && Object.prototype.hasOwnProperty.call(o.map, name) ? o.map[name] : null;
}

// ── THE GATE: a job's tool call, from Coder's machine ───────────────────────────────────────────────────────────────

const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

/**
 * `POST /api/coder/mcp` from Coder's machine: { tool, args } with the job's AI pass (the same headers as its AI calls).
 * Only the chat's current job, and only a tool it was given at its start.
 */
export async function handleMcp(request, env, { fetchFn = fetch, now = Date.now() } = {}) {
  if (request.method !== "POST") return answer({ error: "method" }, 405);
  const bucket = env && env.CODER_BUCKET;
  if (!bucket) return answer({ error: "storage is not available" }, 503);
  const h = (k) => String(request.headers.get(k) || "");
  const chat = h("x-coder-chat"), turn = h("x-coder-turn"), until = h("x-coder-until");
  const m = /^([\w-]{1,100})\/([a-z0-9][a-z0-9-]{2,40})$/.exec(chat);
  if (!m || !/^\d{1,9}$/.test(turn) || !/^\d{13}$/.test(until)) return answer({ error: "not a job's tool call" }, 403);
  const want = await modelPass(env, chat, turn, until);
  if (!want || !same(want, h("x-coder-model"))) return answer({ error: "not this job's pass" }, 403);
  if (Number(until) <= now) return answer({ error: "this pass has ended" }, 403);
  const [, uid, id] = m;
  const meta = await getJson(bucket, "coder/" + uid + "/" + id + "/meta.json", null);
  if (!meta || String(meta.turn) !== turn) return answer({ error: "that chat has moved on" }, 403);
  let body = null;
  try { body = JSON.parse((await request.text()).slice(0, 2_000_000)); } catch { body = null; }
  if (!body || typeof body.tool !== "string") return answer({ error: "that tool call could not be read" }, 400);
  const which = await jobTool(bucket, uid, id, turn, body.tool);
  if (!which) return answer({ error: "not one of this job's connector tools" }, 403);
  return answer(await callTool(env, bucket, uid, which.id, which.tool, body.args, { fetchFn, now }));
}
