// Batch 61 — OAuth social login (Google / GitHub).
// The provider token/userinfo calls + the owner's stored client secrets are mocked so
// the full redirect dance runs offline; the real Google/GitHub round-trip is verified
// live by the owner (it needs a registered OAuth app + a browser).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 61");

// --- Encrypt a secret exactly like the worker's encryptSecret (siteSecretKey material
// = SUPABASE_SERVICE_KEY|site-secrets-v1; the harness sets it to "test-service-key"). ---
async function encSecret(plaintext) {
  const material = new TextEncoder().encode("test-service-key|site-secrets-v1");
  const digest = await crypto.subtle.digest("SHA-256", material);
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const packed = new Uint8Array(iv.length + ct.length); packed.set(iv, 0); packed.set(ct, iv.length);
  let bin = ""; for (const b of packed) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- Wrap the harness fetch: inject the owner's OAuth secrets + mock the providers. ---
const hfetch = globalThis.fetch;
const SECRETS = {}; // slug → [{name, value_encrypted}]
let ghHasEmailOnProfile = false;
globalThis.fetch = async (input, init = {}) => {
  const u = typeof input === "string" ? input : (input && input.url) || "";
  if (u.includes("/rest/v1/site_secrets")) {
    const slug = decodeURIComponent((u.match(/slug=eq\.([^&]+)/) || [])[1] || "");
    return new Response(JSON.stringify(SECRETS[slug] || []), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "g-access-tok" }), { status: 200, headers: { "content-type": "application/json" } });
  if (u.startsWith("https://openidconnect.googleapis.com/v1/userinfo")) return new Response(JSON.stringify({ email: "alice@gmail.com", email_verified: true, name: "Alice G", picture: "https://x/y.png" }), { status: 200, headers: { "content-type": "application/json" } });
  if (u.startsWith("https://github.com/login/oauth/access_token")) return new Response(JSON.stringify({ access_token: "gh-access-tok" }), { status: 200, headers: { "content-type": "application/json" } });
  if (u.startsWith("https://api.github.com/user/emails")) return new Response(JSON.stringify([{ email: "bob@dev.to", primary: true, verified: true }]), { status: 200, headers: { "content-type": "application/json" } });
  if (u.startsWith("https://api.github.com/user")) return new Response(JSON.stringify({ login: "bobby", name: "Bob H", avatar_url: "https://x/a.png", email: ghHasEmailOnProfile ? "bob@dev.to" : null }), { status: 200, headers: { "content-type": "application/json" } });
  return hfetch(input, init);
};

// ---------- Unconfigured site → clear "not set up" error ----------
const bare = "b61x";
await c.ensure(bare);
let un = await c.get(`/api/db/${bare}/auth/oauth/google`);
t.ok(un.status === 501, "no secrets → 501 not-configured");
t.ok(/CLIENT_ID/.test(un.text), "unconfigured message names the required secret");

// ---------- Configured site ----------
const slug = "b61";
await c.ensure(slug);
SECRETS[slug] = [
  { name: "GOOGLE_CLIENT_ID", value_encrypted: await encSecret("g-id-123.apps") },
  { name: "GOOGLE_CLIENT_SECRET", value_encrypted: await encSecret("g-secret-xyz") },
  { name: "GITHUB_CLIENT_ID", value_encrypted: await encSecret("gh-id-abc") },
  { name: "GITHUB_CLIENT_SECRET", value_encrypted: await encSecret("gh-secret-def") },
];

// Step 1 — authorize redirect (Google).
let a = await c.get(`/api/db/${slug}/auth/oauth/google?return=dashboard`);
t.ok(a.status === 302, "google authorize → 302");
const gloc = a.location || "";
t.ok(gloc.startsWith("https://accounts.google.com/o/oauth2/v2/auth?"), "redirects to Google authorize");
const gu = new URL(gloc);
t.ok(gu.searchParams.get("client_id") === "g-id-123.apps", "authorize carries the client_id");
t.ok(gu.searchParams.get("redirect_uri") === `https://isibi.ai/api/db/${slug}/auth/oauth/google/callback`, "authorize sets our callback as redirect_uri");
const gstate = gu.searchParams.get("state");
t.ok(!!gstate && gstate.includes("."), "authorize includes a signed state");

// Step 1 — authorize redirect (GitHub) goes to GitHub.
let ag = await c.get(`/api/db/${slug}/auth/oauth/github`);
t.ok(ag.status === 302 && (ag.location || "").startsWith("https://github.com/login/oauth/authorize?"), "github authorize → GitHub");

// Step 2 — callback with a tampered/blank state is rejected.
let badcb = await c.get(`/api/db/${slug}/auth/oauth/google/callback?code=abc&state=not-a-real-state`);
t.ok(badcb.status === 400, "callback with bad state → 400");

// Step 2 — Google happy path: reuse the real signed state from step 1.
let cb = await c.get(`/api/db/${slug}/auth/oauth/google/callback?code=authcode1&state=${encodeURIComponent(gstate)}`);
t.ok(cb.status === 302, "google callback → 302 back to app");
const dest = cb.location || "";
t.ok(dest.startsWith(`https://isibi.ai/s/${slug}/dashboard#token=`), "callback returns to the app with a #token and the return path");
const gtoken = decodeURIComponent(dest.split("#token=")[1] || "");
// The minted token is a real session — /auth/me accepts it and shows the provider email.
let me = await c.get(`/api/db/${slug}/auth/me`, { token: gtoken });
t.ok(me.json.ok && me.json.user.email === "alice@gmail.com", "the OAuth session token works at /auth/me");
t.ok(me.json.user.role === "admin" && me.json.user.verified === 1, "first OAuth member is admin + auto-verified");
const aliceId = me.json.user.id;

// Idempotency — signing in again with the same Google account reuses the row (no dup).
let a2 = await c.get(`/api/db/${slug}/auth/oauth/google`);
const g2state = new URL(a2.location).searchParams.get("state");
let cb2 = await c.get(`/api/db/${slug}/auth/oauth/google/callback?code=authcode2&state=${encodeURIComponent(g2state)}`);
const tok2 = decodeURIComponent((cb2.location || "").split("#token=")[1] || "");
let me2 = await c.get(`/api/db/${slug}/auth/me`, { token: tok2 });
t.ok(me2.json.ok && me2.json.user.id === aliceId, "re-login reuses the same member (no duplicate)");

// GitHub happy path — email comes from /user/emails (profile email is null).
let agh = await c.get(`/api/db/${slug}/auth/oauth/github`);
const ghstate = new URL(agh.location).searchParams.get("state");
let ghcb = await c.get(`/api/db/${slug}/auth/oauth/github/callback?code=ghcode&state=${encodeURIComponent(ghstate)}`);
t.ok(ghcb.status === 302, "github callback → 302");
const ghtok = decodeURIComponent((ghcb.location || "").split("#token=")[1] || "");
let ghme = await c.get(`/api/db/${slug}/auth/me`, { token: ghtok });
t.ok(ghme.json.ok && ghme.json.user.email === "bob@dev.to", "github login pulls the verified primary email");
t.ok(ghme.json.user.role === "user", "second member (github) is a normal user");

globalThis.fetch = hfetch;
t.done();
h.restore();
