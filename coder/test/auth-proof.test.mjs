// SIGN-IN BY A CODE WE EMAIL, NO PASSWORD (the owner, 2026-11-15: "no passwords, just email codes pls"), STILL ONLY
// THROUGH CODER'S WORKER (the audit, 2026-11-06). Coder's routes take only a session made by the code step on Coder's
// own Worker, shown by the Worker's proof. Tested with a fake Supabase (no real sign-in, no email is sent), the real
// routes over a fake bucket, and the page's own sign-in code run with stand-ins for the browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import vm from "node:vm";
import { authUser, proofFor, proofOk, makeTicket, readTicket, sessionIdOf, sameText, TICKET_MS, takeCodeTry, codeCountKeyOf, CODE_TRIES, CODE_WINDOW_MS, takeSendTry, sendCountKeyOf, SEND_TRIES, SEND_WINDOW_MS } from "../src/coder-auth.mjs";
import { handleSignin } from "../src/coder-signin.mjs";
import { handleCoder } from "../src/coder-routes.mjs";
import { corsHeaders } from "../src/coder-cors.mjs";

const HERE = (p) => new URL("../" + p, import.meta.url);
const SB = "https://sb.example";
const KEY = Buffer.alloc(32, 7).toString("base64");
const jwt = (claims) => "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".c2ln";

/**
 * A bucket like R2 where it matters here: every write gets a new etag, and a
 * write with `onlyIf` (If-Match: "<etag>", or If-None-Match: * for "none yet")
 * happens only if that still holds at that moment; otherwise put() gives null.
 * `hold(n)`: the next n reads wait until all n have come, then all go at once
 * and see the same thing, as requests arriving together do on the real bucket.
 */
function fakeBucket() {
  const m = new Map();
  let n = 0;
  let holding = 0;
  let waiting = [];
  const gate = () => new Promise((go) => {
    waiting.push(go);
    const release = () => { const all = waiting; waiting = []; holding = 0; all.forEach((f) => f()); };
    if (waiting.length >= holding) release(); else if (waiting.length === 1) setTimeout(release, 2000);
  });
  const holds = (k, onlyIf) => {
    if (onlyIf === undefined) return true;
    if (!(onlyIf instanceof Headers)) throw new Error("onlyIf: the Headers form is the one the Worker uses");
    const cur = m.get(k);
    const match = onlyIf.get("if-match");
    if (match !== null && (!cur || match !== '"' + cur.etag + '"')) return false;
    if (onlyIf.get("if-none-match") === "*" && cur) return false;
    return true;
  };
  return { m, read: (k) => (m.has(k) ? JSON.parse(m.get(k).v) : null), hold: (count) => { holding = count; },
    async get(k) { if (holding) await gate(); const o = m.get(k); return o ? { etag: o.etag, httpEtag: '"' + o.etag + '"', text: async () => o.v } : null; },
    async put(k, v, opts = {}) { if (!holds(k, opts.onlyIf)) return null; const etag = "e" + ++n; m.set(k, { v: String(v), etag }); return { key: k, etag }; },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

const subOf = (token) => { try { return JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString()).sub || ""; } catch { return ""; } };

/**
 * A Supabase stand-in, like the real one where it matters here: tokens carry
 * their session id, a refresh keeps it, "scope=local" ends one session and the
 * default ends them all, and /user refuses a session that was ended. Like
 * GoTrue, a logout with a genuine token WITHOUT a session id ends every session
 * of its user, whatever the scope; and any live session may set a new password
 * (PUT /user), without the old one.
 * `signup`: "confirm" (a code is emailed), "session" (a session at once), "exists".
 * `mode` (changed by a test): `pwNoSid` (password sign-in tokens without a
 * session id, as older Supabase tokens were), `logoutThrows` (logout cannot be reached).
 */
function fakeSupabase({ signup = "confirm", user = 200 } = {}) {
  const calls = [];
  const users = new Map([["me@example.com", { id: "u1", email: "me@example.com" }]]);
  const passwords = new Map([["me@example.com", "right"]]);
  const sessions = new Map();
  const issued = new Set();
  const mode = { pwNoSid: false, logoutThrows: false };
  let n = 0;
  const start = (u, via, { noSid = false } = {}) => {
    const sid = "5e55" + String(++n).padStart(4, "0") + "-0000-4000-8000-000000000000";
    const s = { user: u, via, ended: false, refresh: "rt-" + n + "-1", turn: 1, access: jwt({ sub: u.id, email: u.email, ...(noSid ? {} : { session_id: sid }), role: "authenticated" }) };
    sessions.set(sid, s);
    issued.add(s.access);
    return { access_token: s.access, refresh_token: s.refresh, expires_in: 3600, token_type: "bearer", user: { ...u, role: "authenticated" } };
  };
  const fetchFn = async (url, init = {}) => {
    const u = new URL(String(url));
    const h = init.headers || {};
    const bearer = String(h.authorization || h.Authorization || "").replace(/^Bearer /, "");
    const body = init.body ? JSON.parse(init.body) : {};
    const what = u.pathname.replace(/^\/auth\/v1\//, "");
    const method = init.method || "GET";
    calls.push({ what, method, scope: u.searchParams.get("scope"), grant: u.searchParams.get("grant_type"), bearer, body });
    const J = (o, status = 200) => new Response(JSON.stringify(o), { status });
    const live = () => { const s = sessions.get(sessionIdOf(bearer)); return s && !s.ended && s.access === bearer ? s : null; };
    if (what === "token" && u.searchParams.get("grant_type") === "password") { const x = users.get(body.email); return x && passwords.get(body.email) === body.password ? J(start(x, "password", { noSid: mode.pwNoSid })) : J({ error_description: "Invalid login credentials" }, 400); }
    if (what === "token" && u.searchParams.get("grant_type") === "refresh_token") {
      const hit = [...sessions].find(([, s]) => s.refresh === body.refresh_token && !s.ended);
      if (!hit) return J({ error_description: "Invalid Refresh Token: Refresh Token Not Found" }, 400);
      const [sid, s] = hit;
      s.turn++; s.refresh = "rt-" + sid + "-" + s.turn; s.access = jwt({ sub: s.user.id, email: s.user.email, session_id: sid, role: "authenticated", turn: s.turn });
      issued.add(s.access);
      return J({ access_token: s.access, refresh_token: s.refresh, expires_in: 3600, user: s.user });
    }
    if (what === "otp") {
      if (!users.has(body.email)) { if (body.create_user === false) return J({ msg: "Signups not allowed for otp" }, 422); users.set(body.email, { id: "u-" + body.email.split("@")[0], email: body.email }); }
      return J({});
    }
    if (what === "verify") { const x = users.get(body.email); return x && body.token === "123456" ? J(start(x, "code")) : J({ msg: "Token has expired or is invalid" }, 403); }
    if (what === "logout") {
      if (mode.logoutThrows) throw new TypeError("fetch failed");
      if (!sessionIdOf(bearer)) {
        const sub = subOf(bearer);
        if (issued.has(bearer) && sub) for (const x of sessions.values()) if (x.user.id === sub) x.ended = true;
        return new Response(null, { status: 204 });
      }
      const s = live();
      if (s) for (const x of u.searchParams.get("scope") === "local" ? [s] : [...sessions.values()].filter((y) => y.user.id === s.user.id)) x.ended = true;
      return new Response(null, { status: 204 });
    }
    if (what === "user" && method === "PUT") {
      const s = live();
      if (!s) return J({ msg: "invalid JWT" }, 401);
      if (typeof body.password === "string") passwords.set(s.user.email, body.password);
      return J(s.user);
    }
    if (what === "user") {
      if (user !== 200) return J({ msg: "upstream" }, user);
      const s = live();
      return s ? J(s.user) : J({ msg: "Session from session_id claim in JWT does not exist" }, 403);
    }
    if (what === "signup") {
      if (signup === "exists") return J({ id: "obfuscated", email: body.email, identities: [] });
      const x = { id: "u-" + body.email.split("@")[0], email: body.email };
      users.set(body.email, x);
      passwords.set(body.email, body.password);
      if (signup === "session") return J(start(x, "signup"));
      return J({ id: x.id, email: x.email, identities: [{ provider: "email" }], confirmation_sent_at: "2026-11-06T00:00:00Z" });
    }
    return J({ msg: "not found" }, 404);
  };
  // What anyone can do with Supabase's public key, without Coder's Worker.
  const direct = (what, body, { method = "POST", token } = {}) => fetchFn(SB + "/auth/v1/" + what, { method, headers: { apikey: "anon", ...(token ? { authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) }).then((r) => r.json());
  const via = (kind) => [...sessions].filter(([, s]) => s.via === kind);
  return { calls, sessions, users, passwords, mode, fetchFn, direct, via };
}

const envFor = (extra = {}) => ({ SUPABASE_URL: SB, SUPABASE_ANON_KEY: "anon", CODER_TOKEN_KEY: KEY, CODER_ON: "on", CODER_USERS: "me@example.com,new@example.com", CODER_BUCKET: fakeBucket(), ...extra });
const auth = (env, sb, action, body) => handleSignin(new Request("https://gofarther.dev/api/auth/" + action, { method: "POST", body: JSON.stringify(body) }), env, { fetchFn: sb.fetchFn });
// The routes, wired as worker.js wires them: the real authUser asks (fake) Supabase.
const coder = async (env, sb, path, token, proof) => {
  const headers = { ...(token ? { Authorization: "Bearer " + token } : {}), ...(proof !== undefined ? { "x-coder-proof": proof } : {}) };
  const r = await handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { headers }), env, {}, { authUser: (q) => authUser(q, env, { fetchFn: sb.fetchFn }), container: () => null });
  return { status: r.status, data: await r.json() };
};
const AGAIN = { error: "Sign in again.", signin: true };
const START_AGAIN = { error: "Start again: enter your email.", restart: true };

/** The code sent, then the code, through the Worker: `{ session, proof }`. */
async function signInFully(env, sb, email = "me@example.com") {
  const t = await (await auth(env, sb, "signin", { email })).json();
  return (await auth(env, sb, "verify", { email, code: "123456", type: "email", ticket: t.ticket })).json();
}

test("CD86 (the audit, 2026-11-06; codes only since 2026-11-15) Coder's routes refuse a Supabase session not made by the Worker's code step: an old password straight at Supabase, a code verified straight at Supabase, another session's proof, or no proof key", async () => {
  const sb = fakeSupabase();
  const env = envFor();
  // AN OLD PASSWORD: a session straight from Supabase's password sign-in (the public key allows it, and accounts from
  // before 2026-11-15 still have a password there). Not through the Worker's code step, so no proof.
  const pw = await sb.direct("token?grant_type=password", { email: "me@example.com", password: "right" });
  assert.match(pw.access_token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.deepEqual(await coder(env, sb, "projects", pw.access_token), { status: 401, data: AGAIN }, "a password-only session gets in");
  assert.deepEqual(await coder(env, sb, "settings", pw.access_token, ""), { status: 401, data: AGAIN });
  assert.deepEqual(await coder(env, sb, "projects", pw.access_token, "made-up-proof-made-up-proof-made-up-proof12"), { status: 401, data: AGAIN }, "a made-up proof");
  // A CODE STRAIGHT AT SUPABASE: asked from Supabase directly and verified there, not through the Worker: no proof.
  await sb.direct("otp", { email: "me@example.com", create_user: false });
  const inbox = await sb.direct("verify", { type: "email", email: "me@example.com", token: "123456" });
  assert.ok(sessionIdOf(inbox.access_token), "Supabase's tokens carry their session id");
  assert.deepEqual(await coder(env, sb, "projects", inbox.access_token), { status: 401, data: AGAIN }, "an inbox-only session gets in");
  // A REAL PROOF, BUT FOR ANOTHER SESSION: refused.
  const real = await signInFully(env, sb);
  assert.equal((await coder(env, sb, "projects", real.session.access_token, real.proof)).status, 200, "the real thing works");
  assert.deepEqual(await coder(env, sb, "projects", pw.access_token, real.proof), { status: 401, data: AGAIN }, "a proof made for another session");
  assert.deepEqual(await coder(env, sb, "projects", inbox.access_token, real.proof), { status: 401, data: AGAIN });
  assert.deepEqual(await coder(env, sb, "projects", real.session.access_token), { status: 401, data: AGAIN }, "the right session without its proof");
  assert.equal(await proofOk(env, sessionIdOf(pw.access_token), real.proof), false);
  // NO PROOF KEY (CODER_TOKEN_KEY missing or not a real key): nothing is accepted (fail closed).
  for (const k of [undefined, "", "short-key"]) {
    assert.deepEqual(await coder(envFor({ CODER_TOKEN_KEY: k }), sb, "projects", real.session.access_token, real.proof), { status: 401, data: AGAIN }, String(k));
    assert.equal(await proofFor({ CODER_TOKEN_KEY: k }, sessionIdOf(real.session.access_token)), "", "a proof without a real key: " + k);
    assert.equal(await makeTicket({ CODER_TOKEN_KEY: k }, "me@example.com", "email"), "", "a ticket without a real key: " + k);
  }
  assert.notEqual(await proofFor({ CODER_TOKEN_KEY: Buffer.alloc(32, 8).toString("base64") }, sessionIdOf(real.session.access_token)), real.proof, "another key, another proof");
  assert.ok(!real.proof.includes(KEY) && !KEY.includes(real.proof), "the proof is not the key");
  // NOT A SESSION AT ALL (no token, an ended session, junk): "sign in first", as before.
  assert.deepEqual(await coder(env, sb, "projects"), { status: 401, data: { error: "sign in first" } });
  assert.deepEqual(await coder(env, sb, "projects", "junk", real.proof), { status: 401, data: { error: "sign in first" } });
  await sb.fetchFn(SB + "/auth/v1/logout?scope=local", { method: "POST", headers: { authorization: "Bearer " + real.session.access_token }, body: "{}" });
  assert.deepEqual(await coder(env, sb, "projects", real.session.access_token, real.proof), { status: 401, data: { error: "sign in first" } }, "a session ended elsewhere");
  // SUPABASE CANNOT BE ASKED: nobody is signed out for that (503, not 401).
  const again = await signInFully(env, sb);
  for (const status of [500, 503, 429]) assert.deepEqual(await coder(env, fakeSupabase({ user: status }), "projects", again.session.access_token, again.proof), { status: 503, data: { error: "Sign-in could not be checked. Try again in a minute." } }, String(status));
  const down = { fetchFn: async () => { throw new Error("network down"); } };
  assert.equal((await coder(env, down, "projects", again.session.access_token, again.proof)).status, 503);
  // THE CHECKS THEMSELVES: constant-time comparison; the session id from the token's middle part.
  assert.equal(sameText("abc", "abc"), true);
  for (const [a, b] of [["abc", "abd"], ["abc", "abcd"], ["", ""], [null, null], ["abc", undefined]]) assert.equal(sameText(a, b), false, a + " " + b);
  assert.equal(sessionIdOf(jwt({ session_id: "s-1" })), "s-1");
  for (const t of ["", "a.b", "a.b.c.d", jwt({ sub: "u1" }), jwt({ session_id: 7 }), "x.%%%.y"]) assert.equal(sessionIdOf(t), "", t);
  // THE KEY AND THE SIGNED TEXTS ARE FIXED (worked out here with Node's own HMAC): the key is HMAC(CODER_TOKEN_KEY,
  // "coder-auth-proof-v1"); a proof signs "session:<id>", a ticket "ticket:<its middle>". Changing any of them would sign everyone out.
  const pk = createHmac("sha256", KEY).update("coder-auth-proof-v1").digest();
  assert.equal(await proofFor(env, "s-1"), createHmac("sha256", pk).update("session:s-1").digest("base64url"));
  const known = await makeTicket(env, "me@example.com", "email", 1_000_000);
  const [kp, ks] = known.split(".");
  assert.equal(ks, createHmac("sha256", pk).update("ticket:" + kp).digest("base64url"));
  assert.deepEqual(JSON.parse(Buffer.from(kp, "base64url").toString()), { e: "me@example.com", t: "email", x: 1_000_000 + TICKET_MS });
  // Every proof and ticket signature is compared in constant time.
  assert.match(proofOk.toString(), /sameText\(want, proof\)/);
  assert.match(readTicket.toString(), /sameText\(await mac\(key, "ticket:" \+ m\[1\]\), m\[2\]\)/);
  // NO PASSWORD IS KEPT ANYWHERE (2026-11-15): nothing of the old remembered password is written.
  assert.ok(![...env.CODER_BUCKET.m.keys()].some((k) => /signin-pin/.test(k)));
  // THE BROWSER MAY SEND THE PROOF where it sends the token; the Worker still wires the real check.
  assert.match(corsHeaders(new Request("https://gofarther.dev/", { headers: { Origin: "https://gofarther.dev" } }), { APP_ORIGIN: "https://gofarther.dev" })["access-control-allow-headers"], /^authorization, content-type, x-coder-proof$/);
  assert.match(readFileSync(HERE("worker.js"), "utf8"), /authUser: \(r\) => authUser\(r, env\),/);
});

test("CD87 (2026-11-15: a code we email, no password; the audit of 2026-11-06) the code is sent from the email alone (Supabase's sign-in by code, a new email's account made with it), with a 15-minute ticket and no session; the code is only taken with that ticket; codes sent and code checks are counted", async () => {
  const sb = fakeSupabase();
  const env = envFor();
  // NOT AN EMAIL: nothing is sent.
  const bad = await auth(env, sb, "signin", { email: "not-an-email" });
  assert.deepEqual([bad.status, await bad.json()], [400, { error: "Enter a valid email." }]);
  assert.deepEqual(sb.calls, []);
  // THE CODE IS SENT from the email alone: a password sent by a page from before is not read, and no session is made.
  const before = Date.now();
  const r1 = await auth(env, sb, "signin", { email: " Me@Example.com ", password: "anything" });
  const text = await r1.text();
  const step1 = JSON.parse(text);
  assert.equal(r1.status, 200);
  assert.deepEqual(Object.keys(step1).sort(), ["ok", "step", "ticket", "type"]);
  assert.deepEqual([step1.ok, step1.step, step1.type], [true, "code", "email"]);
  assert.deepEqual(sb.calls.map((c) => c.what), ["otp"], "only the code is asked for: no password check, no session");
  assert.deepEqual(sb.calls[0].body, { email: "me@example.com", create_user: true });
  assert.ok(!/access_token|refresh_token/.test(text));
  assert.equal(sb.sessions.size, 0, "a session was made before the code");
  // THE TICKET: signed, says only who, which code, until when (15 minutes).
  const t = await readTicket(env, step1.ticket);
  assert.deepEqual([t.email, t.type], ["me@example.com", "email"]);
  assert.equal(TICKET_MS, 15 * 60 * 1000);
  assert.ok(t.expires >= before + TICKET_MS && t.expires <= Date.now() + TICKET_MS);
  assert.deepEqual(Object.keys(JSON.parse(Buffer.from(step1.ticket.split(".")[0], "base64url").toString())).sort(), ["e", "t", "x"]);
  // BAD TICKETS ARE REFUSED BEFORE SUPABASE IS ASKED.
  sb.calls.length = 0;
  const [payload, sig] = step1.ticket.split(".");
  const swapped = Buffer.from(JSON.stringify({ e: "other@example.com", t: "email", x: Date.now() + TICKET_MS })).toString("base64url");
  const flip = (s, i) => s.slice(0, i) + (s[i] === "A" ? "B" : "A") + s.slice(i + 1);
  const otherKey = { CODER_TOKEN_KEY: Buffer.alloc(32, 9).toString("base64") };
  const proofAsSig = payload + "." + (await proofFor(env, "ticket:" + payload));
  const bads = {
    missing: undefined, junk: "abc", empty: "", number: 12345, "changed email in the ticket": swapped + "." + sig, "changed signature": payload + "." + flip(sig, 5), "changed last character": payload + "." + flip(sig, sig.length - 1),
    "changed payload": flip(payload, 3) + "." + sig, expired: await makeTicket(env, "me@example.com", "email", Date.now() - TICKET_MS - 1000), "another key": await makeTicket(otherKey, "me@example.com", "email"),
    "a proof as the signature": proofAsSig, "a signup ticket": await makeTicket(env, "me@example.com", "signup"),
  };
  for (const [why, ticket] of Object.entries(bads)) {
    const r = await auth(env, sb, "verify", { email: "me@example.com", code: "123456", type: "email", ticket });
    assert.deepEqual([r.status, await r.json()], [401, START_AGAIN], why);
  }
  for (const [why, body] of Object.entries({ "another email": { email: "other@example.com", type: "email" }, "another kind of code": { email: "me@example.com", type: "signup" } })) {
    const r = await auth(env, sb, "verify", { ...body, code: "123456", ticket: step1.ticket });
    assert.deepEqual([r.status, await r.json()], [401, START_AGAIN], why);
  }
  assert.deepEqual(sb.calls, [], "Supabase was asked to check a code without a good ticket");
  assert.equal(env.CODER_BUCKET.read(await codeCountKeyOf(env, "me@example.com")), null, "a bad ticket used up a code check");
  // A good ticket with a wrong code: Supabase says no.
  const wrong = await auth(env, sb, "verify", { email: "me@example.com", code: "654321", type: "email", ticket: step1.ticket });
  assert.deepEqual([wrong.status, (await wrong.json()).error], [401, "Token has expired or is invalid"]);
  // A ticket just short of 15 minutes old still works.
  const late = await auth(env, sb, "verify", { email: "me@example.com", code: "123456", type: "email", ticket: await makeTicket(env, "me@example.com", "email", Date.now() - TICKET_MS + 60_000) });
  assert.equal(late.status, 200);
  // THE CODE STEP: the session as before, plus the proof for this very session.
  const r2 = await auth(env, sb, "verify", { email: "ME@example.com", code: "123456", type: "email", ticket: step1.ticket });
  const v = await r2.json();
  assert.equal(r2.status, 200);
  assert.deepEqual(Object.keys(v).sort(), ["ok", "proof", "session"]);
  assert.deepEqual(Object.keys(v.session).sort(), ["access_token", "expires_at", "refresh_token", "user"]);
  assert.deepEqual(v.session.user, { id: "u1", email: "me@example.com" });
  assert.match(v.proof, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(v.proof, await proofFor(env, sessionIdOf(v.session.access_token)));
  // THE PROOF OPENS CODER'S ROUTES, for that session.
  assert.deepEqual(await coder(env, sb, "projects", v.session.access_token, v.proof), { status: 200, data: { ok: true, projects: [] } });
  assert.equal((await coder(env, sb, "settings", v.session.access_token, v.proof)).status, 200);
  assert.deepEqual((await authUser(new Request("https://x/", { headers: { Authorization: "Bearer " + v.session.access_token, "x-coder-proof": v.proof } }), env, { fetchFn: sb.fetchFn })), { id: "u1", email: "me@example.com" });
  // NO PROOF KEY: no sign-in at all, and Supabase is not even asked (fail closed).
  const sb2 = fakeSupabase();
  for (const action of ["signin", "signup"]) assert.deepEqual([(await auth(envFor({ CODER_TOKEN_KEY: "" }), sb2, action, { email: "me@example.com" })).status], [503], action);
  const noKey = await auth(envFor({ CODER_TOKEN_KEY: "" }), sb2, "verify", { email: "me@example.com", code: "123456", type: "email", ticket: step1.ticket });
  assert.deepEqual([noKey.status, await noKey.json()], [401, START_AGAIN]);
  assert.deepEqual(sb2.calls, []);
  // A SESSION WITHOUT A SESSION ID cannot be proven: refused, nothing handed out.
  const odd = { fetchFn: async (url, init) => (String(url).endsWith("/verify") ? new Response(JSON.stringify({ access_token: jwt({ sub: "u1" }), refresh_token: "r", expires_in: 3600, user: { id: "u1", email: "me@example.com" } })) : sb.fetchFn(url, init)) };
  const oddR = await auth(env, odd, "verify", { email: "me@example.com", code: "123456", type: "email", ticket: step1.ticket });
  assert.equal(oddR.status, 502);
  assert.equal((await oddR.json()).session, undefined);

  // NO BUCKET: no sign-in at all, and Supabase is not even asked (fail closed).
  const nb = fakeSupabase();
  for (const action of ["signin", "signup"]) assert.equal((await auth(envFor({ CODER_BUCKET: undefined }), nb, action, { email: "me@example.com" })).status, 503, action);
  const nbv = await auth(envFor({ CODER_BUCKET: undefined }), nb, "verify", { email: "me@example.com", code: "123456", type: "email", ticket: await makeTicket(env, "me@example.com", "email") });
  assert.deepEqual([nbv.status, await nbv.json()], [503, { error: "sign-in is not set up" }]);
  assert.deepEqual(nb.calls, []);

  // WRONG CODES ARE COUNTED: 5 code checks per email per 15 minutes, before Supabase is asked. A fresh ticket does not
  // reset them, a right code does, and guesses sent all at once cannot slip through.
  const lb = fakeSupabase();
  const lenv = envFor();
  const ticketOf = async (sb, e) => (await (await auth(e, sb, "signin", { email: "me@example.com" })).json()).ticket;
  const verifies = (sb) => sb.calls.filter((c) => c.what === "verify").length;
  const tk1 = await ticketOf(lb, lenv);
  for (let i = 0; i < CODE_TRIES; i++) {
    const r = await auth(lenv, lb, "verify", { email: "me@example.com", code: "00000" + i, type: "email", ticket: tk1 });
    assert.deepEqual([r.status, (await r.json()).error], [401, "Token has expired or is invalid"], String(i));
  }
  assert.deepEqual([CODE_TRIES, CODE_WINDOW_MS, verifies(lb)], [5, 15 * 60 * 1000, 5]);
  const sixth = await auth(lenv, lb, "verify", { email: "me@example.com", code: "123456", type: "email", ticket: tk1 });
  assert.deepEqual([sixth.status, await sixth.json()], [429, { error: "Too many tries with the code. Wait 15 minutes, then start again.", restart: true }], "even the right code, after five wrong ones");
  assert.equal(verifies(lb), 5, "Supabase was asked a sixth time");
  // A NEW CODE SENT (a fresh ticket) does not reset the count.
  const tk2 = await ticketOf(lb, lenv);
  assert.equal((await auth(lenv, lb, "verify", { email: "me@example.com", code: "123456", type: "email", ticket: tk2 })).status, 429);
  assert.equal(verifies(lb), 5);
  // The count is kept per email, under a name that does not show the email.
  const ck = await codeCountKeyOf(lenv, "me@example.com");
  assert.match(ck, /^coder\/signin-codes\/[\w-]{43}\.json$/);
  assert.notEqual(ck, await codeCountKeyOf(lenv, "other@example.com"));
  const held = lenv.CODER_BUCKET.read(ck);
  assert.equal(held.n, 5);
  // THE 15 MINUTES PASS: codes are checked again, and a right code starts the count again.
  await lenv.CODER_BUCKET.put(ck, JSON.stringify({ ...held, since: held.since - CODE_WINDOW_MS }));
  const later = await auth(lenv, lb, "verify", { email: "me@example.com", code: "123456", type: "email", ticket: tk2 });
  assert.equal(later.status, 200);
  assert.deepEqual([lenv.CODER_BUCKET.read(ck), verifies(lb)], [{ n: 0, since: 0 }, 6]);
  // A right code after a few wrong ones: the next mistakes start from nothing.
  const tk3 = await ticketOf(lb, lenv);
  for (const code of ["111111", "222222", "123456"]) await auth(lenv, lb, "verify", { email: "me@example.com", code, type: "email", ticket: tk3 });
  for (let i = 0; i < CODE_TRIES; i++) assert.equal((await auth(lenv, lb, "verify", { email: "me@example.com", code: "99999" + i, type: "email", ticket: tk3 })).status, 401);
  assert.equal((await auth(lenv, lb, "verify", { email: "me@example.com", code: "123456", type: "email", ticket: tk3 })).status, 429);
  // TWO CHECKS AT THE SAME MOMENT (a double click): both are counted and checked, one after the other; neither is refused.
  const db = fakeSupabase();
  const denv = envFor();
  const dtk = await ticketOf(db, denv);
  denv.CODER_BUCKET.hold(2);
  const pair = await Promise.all(["111111", "123456"].map((code) => auth(denv, db, "verify", { email: "me@example.com", code, type: "email", ticket: dtk })));
  assert.deepEqual([pair.map((r) => r.status), verifies(db)], [[401, 200], 2]);
  // MANY GUESSES SENT ALL AT ONCE: no more than five reach Supabase; every other one is refused before it.
  const pb = fakeSupabase();
  const penv = envFor();
  const ptk = await ticketOf(pb, penv);
  penv.CODER_BUCKET.hold(25);
  const all = await Promise.all(Array.from({ length: 25 }, (_, i) => auth(penv, pb, "verify", { email: "me@example.com", code: String(200000 + i), type: "email", ticket: ptk })));
  const reached = verifies(pb);
  assert.ok(reached >= 1 && reached <= CODE_TRIES, "guesses that reached Supabase: " + reached);
  assert.deepEqual([all.filter((r) => r.status === 401).length, all.filter((r) => r.status === 429).length], [reached, 25 - reached]);
  assert.equal(penv.CODER_BUCKET.read(await codeCountKeyOf(penv, "me@example.com")).n, reached);
  // No bucket or no key: nothing can be counted, so nothing is checked (fail closed).
  assert.deepEqual(await takeCodeTry(envFor({ CODER_BUCKET: undefined }), "me@example.com"), { off: true });
  assert.deepEqual(await takeCodeTry(envFor({ CODER_TOKEN_KEY: "" }), "me@example.com"), { off: true });

  // CODES SENT ARE COUNTED (2026-11-15): 5 per email per 15 minutes, before Supabase is asked, the old sign-up route too;
  // each email its own count, under a name that does not show it.
  const sl = fakeSupabase();
  const senv = envFor();
  for (let i = 0; i < SEND_TRIES; i++) assert.equal((await auth(senv, sl, "signin", { email: "me@example.com" })).status, 200, String(i));
  const sixthSend = await auth(senv, sl, "signin", { email: "me@example.com" });
  assert.deepEqual([sixthSend.status, await sixthSend.json()], [429, { error: "Too many codes for this email. Wait 15 minutes, then try again." }]);
  assert.deepEqual([SEND_TRIES, SEND_WINDOW_MS, sl.calls.filter((c) => c.what === "otp").length], [5, 15 * 60 * 1000, 5]);
  assert.equal((await auth(senv, sl, "signup", { email: "me@example.com" })).status, 429, "the old sign-up route counts too");
  assert.equal((await auth(senv, sl, "signin", { email: "other@example.com" })).status, 200, "another email has its own count");
  const sk = await sendCountKeyOf(senv, "me@example.com");
  assert.match(sk, /^coder\/signin-sends\/[\w-]{43}\.json$/);
  assert.notEqual(sk, await codeCountKeyOf(senv, "me@example.com"));
  const sheld = senv.CODER_BUCKET.read(sk);
  await senv.CODER_BUCKET.put(sk, JSON.stringify({ ...sheld, since: sheld.since - SEND_WINDOW_MS }));
  assert.equal((await auth(senv, sl, "signin", { email: "me@example.com" })).status, 200, "the 15 minutes passed");
  // SUPABASE'S OWN LIMIT (a minute between two codes for the same email): its words, as a 429.
  const slow = { fetchFn: async () => new Response(JSON.stringify({ msg: "For security purposes, you can only request this after 42 seconds." }), { status: 429 }) };
  const s429 = await auth(envFor(), slow, "signin", { email: "me@example.com" });
  assert.deepEqual([s429.status, await s429.json()], [429, { error: "For security purposes, you can only request this after 42 seconds." }]);
  assert.deepEqual(await takeSendTry(envFor({ CODER_BUCKET: undefined }), "me@example.com"), { off: true });
  assert.deepEqual(await takeSendTry(envFor({ CODER_TOKEN_KEY: "" }), "me@example.com"), { off: true });
});

test("CD88 (the audit, 2026-11-06) refresh hands the proof back only while it is valid for the session, and Supabase busy or down does not end the session; a new email's first code makes its account (2026-11-15), and the old sign-up route only sends a code", async () => {
  const sb = fakeSupabase();
  const env = envFor();
  const me = await signInFully(env, sb);
  const sid = sessionIdOf(me.session.access_token);
  // REFRESH WITH THE VALID PROOF: the same session id, the proof handed back, and it still opens Coder.
  const r1 = await (await auth(env, sb, "refresh", { refresh_token: me.session.refresh_token, proof: me.proof })).json();
  assert.equal(r1.ok, true);
  assert.notEqual(r1.session.access_token, me.session.access_token);
  assert.equal(sessionIdOf(r1.session.access_token), sid, "Supabase keeps the session id");
  assert.equal(r1.proof, me.proof);
  assert.equal((await coder(env, sb, "projects", r1.session.access_token, r1.proof)).status, 200);
  // ANY OTHER PROOF IS LEFT OUT (the session itself is still renewed, as Supabase would anyway).
  const pw = await sb.direct("token?grant_type=password", { email: "me@example.com", password: "right" });
  let rt = r1.session.refresh_token;
  for (const [why, proof] of Object.entries({ missing: undefined, empty: "", junk: "x", "a number": 7, "another session's": await proofFor(env, sessionIdOf(pw.access_token)), "another key's": await proofFor({ CODER_TOKEN_KEY: Buffer.alloc(32, 9).toString("base64") }, sid) })) {
    const r = await (await auth(env, sb, "refresh", { refresh_token: rt, proof })).json();
    assert.equal(r.ok, true, why);
    assert.equal("proof" in r, false, why);
    rt = r.session.refresh_token;
  }
  // A PASSWORD-ONLY SESSION refreshed through the Worker with someone's real proof gets none.
  const stolen = await (await auth(env, sb, "refresh", { refresh_token: pw.refresh_token, proof: me.proof })).json();
  assert.equal(stolen.ok, true);
  assert.equal("proof" in stolen, false);
  assert.equal((await coder(env, sb, "projects", stolen.session.access_token, me.proof)).status, 401);
  // No proof key: no proof handed back (fail closed).
  const nk = await (await auth(envFor({ CODER_TOKEN_KEY: "" }), sb, "refresh", { refresh_token: rt, proof: me.proof })).json();
  assert.equal("proof" in nk, false);
  // An ended session cannot be refreshed: "the session ended", as before.
  const ended = await auth(env, sb, "refresh", { refresh_token: "rt-gone", proof: me.proof });
  assert.deepEqual([ended.status, await ended.json()], [401, { error: "the session ended", ended: true }]);
  // SUPABASE BUSY (429, a rate limit) OR DOWN (5xx) IS NOT AN ENDED SESSION: the page keeps it and tries again later.
  // Only Supabase's refusal ends it.
  for (const [status, want] of [[429, [502, false]], [500, [502, false]], [503, [502, false]], [400, [401, true]], [401, [401, true]], [403, [401, true]]]) {
    const answer = { fetchFn: async () => new Response(JSON.stringify({ msg: "x" }), { status }) };
    const r = await auth(env, answer, "refresh", { refresh_token: "rt-x", proof: me.proof });
    assert.deepEqual([r.status, (await r.json()).ended], want, String(status));
  }
  const down = await auth(env, { fetchFn: async () => new Response("", { status: 504 }) }, "refresh", { refresh_token: "rt-x" });
  assert.deepEqual([down.status, await down.json()], [502, { error: "The session could not be renewed. Try again in a minute.", ended: false }]);

  // A NEW EMAIL (2026-11-15): its first code makes its account (Supabase's sign-in by code), with the same ticket and proof.
  const nu = fakeSupabase();
  assert.equal(nu.users.has("new@example.com"), false);
  const first = await (await auth(env, nu, "signin", { email: "new@example.com" })).json();
  assert.deepEqual([first.ok, first.step, first.type], [true, "code", "email"]);
  assert.deepEqual(nu.calls.at(-1).body, { email: "new@example.com", create_user: true });
  const made = await (await auth(env, nu, "verify", { email: "new@example.com", code: "123456", type: "email", ticket: first.ticket })).json();
  assert.equal(made.session.user.email, "new@example.com");
  assert.equal(made.proof, await proofFor(env, sessionIdOf(made.session.access_token)));
  assert.equal((await coder(env, nu, "projects", made.session.access_token, made.proof)).status, 200);
  // THE OLD SIGN-UP ROUTE (a page from before): the same as sign-in, a code and a ticket; its password is not read and
  // Supabase's password sign-up and sign-in are never asked.
  const old = await auth(env, nu, "signup", { email: "other@example.com", password: "secret1" });
  const oldJ = await old.json();
  assert.deepEqual([old.status, oldJ.type, typeof oldJ.ticket], [200, "email", "string"]);
  assert.ok(!nu.calls.some((c) => c.what === "signup" || c.what === "token"), "Supabase's password sign-up or sign-in was asked");
});

// ── THE PAGE ─────────────────────────────────────────────────────────────────
const memStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
/** public/auth.js, run as the browser runs it, with stand-ins for the browser and the Worker. */
function runAuth({ stored, answers = {}, localStorage } = {}) {
  const sent = [];
  let reloads = 0;
  const local = localStorage || memStorage(stored ? { gf_session_v1: JSON.stringify(stored) } : {});
  const session = memStorage();
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body || "{}");
    sent.push({ url, headers: { ...init.headers }, body });
    const a = answers[url.replace("/api/auth/", "")] || [404, { error: "not found" }];
    const [status, json] = typeof a === "function" ? a(body) : a;
    return new Response(JSON.stringify(json), { status });
  };
  // The page's listeners are kept, so a test can play another tab ("storage").
  const listeners = {};
  const window = { addEventListener: (type, f) => { listeners[type] = f; } };
  vm.runInContext(readFileSync(HERE("public/auth.js"), "utf8"), vm.createContext({ window, localStorage: local, sessionStorage: session, navigator: {}, location: { reload: () => { reloads++; } }, fetch }));
  return { Auth: window.Auth, sent, local, session, listeners, reloads: () => reloads };
}
/**
 * coder.js's call(), the one door every request of Coder's screen goes through, with a stand-in Auth (or the real one
 * from runAuth), the screen's state (`draft`: the chat box, `unsent`: a message on its way) and sessionStorage.
 * The stand-in's renewal gives `renewTo`, or fails: the session then ends (`ended`) or is kept (a failure for now).
 */
function runCall(answers, { token = "A1", renewTo = "A2", ended = true, Auth, draft = "", unsent = "", session = memStorage() } = {}) {
  const src = readFileSync(HERE("public/coder.js"), "utf8");
  const start = src.indexOf("  async function call(");
  const fn = src.slice(start, src.indexOf("\n  }\n", start) + 4);
  const s = { token, ends: 0, refreshes: [], sent: [], signedIn: true, session };
  s.Auth = Auth || {
    accessToken: async () => s.token, proof: () => (s.token ? "P-" + s.token : ""), end: () => { s.ends++; s.signedIn = false; },
    isSignedIn: () => s.signedIn,
    refresh: async (refused) => { s.refreshes.push(refused); if (!renewTo) { if (ended) s.signedIn = false; return null; } s.token = renewTo; return { access_token: renewTo }; },
  };
  const fetch = async (url, init) => { s.sent.push({ url, headers: { ...init.headers } }); const [status, json] = answers.shift(); return new Response(JSON.stringify(json), { status }); };
  s.call = new Function("API", "window", "fetch", "S", "sessionStorage", fn + "\nreturn call;")("/api/coder", { Auth: s.Auth }, fetch, { draft, unsent }, session);
  return s;
}
/** public/app.js (the sign-in card) with a tiny stand-in page. */
function runApp(Auth) {
  const el = () => { const classes = new Set(); const on = {}; return { hidden: false, textContent: "", value: "", innerHTML: "", disabled: false, autocomplete: "", dataset: {}, on, classes, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, v) => ((v === undefined ? !classes.has(c) : v) ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) }, addEventListener(t, f) { (on[t] = on[t] || []).push(f); }, focus() {} }; };
  // Every element the page asks for exists, as on the real page.
  const els = new Proxy({}, { get: (o, id) => (o[id] = o[id] || el()) });
  const docOn = {};
  const document = { getElementById: (id) => els[id], querySelectorAll: () => [], addEventListener: (t, f) => { (docOn[t] = docOn[t] || []).push(f); }, documentElement: el(), body: el() };
  vm.runInContext(readFileSync(HERE("public/app.js"), "utf8"), vm.createContext({ window: { Auth }, document, navigator: { userAgent: "test" }, location: { pathname: "/", href: "https://gofarther.dev/" }, history: {}, sessionStorage: memStorage(), setTimeout: (f) => f(), addEventListener() {} }));
  for (const f of docOn.DOMContentLoaded || []) f();
  const submit = () => els.gfForm.on.submit[0]({ preventDefault() {} });
  return { els, submit };
}

test("CD89 (the audit, 2026-11-06) the page keeps the ticket of the code sent (and of a new code) for the code step, stores the proof with the session and sends it on every call and refresh; a session without a proof is not used, is removed, and is not taken from another tab; a refused session goes back to sign-in once, never in a loop, keeping what was typed; a renewal that fails only for now keeps the session", async () => {
  const user = { id: "u1", email: "me@example.com" };
  // SIGN IN: the ticket of the code sent goes to the code step (again after a wrong code); the proof is kept with the session.
  const t = runAuth({ answers: {
    signin: [200, { ok: true, step: "code", type: "email", ticket: "T1" }],
    verify: (b) => (b.code === "000000" ? [401, { error: "That code did not work." }] : [200, { ok: true, session: { access_token: "A1", refresh_token: "R1", expires_at: Date.now() + 30_000, user }, proof: "P1" }]),
    refresh: [200, { ok: true, session: { access_token: "A2", refresh_token: "R2", expires_at: Date.now() + 3600e3, user }, proof: "P1" }],
    logout: [200, { ok: true }],
  } });
  assert.equal(t.Auth.isSignedIn(), false);
  await t.Auth.sendCode("me@example.com");
  assert.deepEqual(t.sent[0].body, { email: "me@example.com" }, "the email alone: no password");
  await assert.rejects(t.Auth.verifyCode("me@example.com", "000000", "email"), /That code did not work/);
  assert.equal(t.Auth.isSignedIn(), false);
  await t.Auth.verifyCode("me@example.com", "123456", "email");
  assert.deepEqual(t.sent.filter((x) => x.url === "/api/auth/verify").map((x) => [x.body.ticket, x.body.type]), [["T1", "email"], ["T1", "email"]]);
  assert.equal(JSON.parse(t.local.getItem("gf_session_v1")).proof, "P1", "the proof is stored with the session");
  assert.deepEqual([t.Auth.isSignedIn(), t.Auth.proof()], [true, "P1"]);
  // REFRESH: the proof goes along, and what the Worker hands back is kept.
  assert.equal(await t.Auth.accessToken(), "A2");
  assert.deepEqual(t.sent.find((x) => x.url === "/api/auth/refresh").body, { refresh_token: "R1", proof: "P1" });
  assert.deepEqual([JSON.parse(t.local.getItem("gf_session_v1")).access_token, t.Auth.proof()], ["A2", "P1"]);
  // SIGN OUT sends the proof next to the token.
  await t.Auth.signOut();
  assert.deepEqual([t.sent.at(-1).url, t.sent.at(-1).headers.authorization, t.sent.at(-1).headers["x-coder-proof"]], ["/api/auth/logout", "Bearer A2", "P1"]);
  assert.equal(t.local.getItem("gf_session_v1"), null);
  // A NEW CODE (Send a new code): the newest ticket goes to the code step.
  let n = 0;
  const re = runAuth({ answers: {
    signin: () => [200, { ok: true, step: "code", type: "email", ticket: "T" + ++n }],
    verify: (b) => (b.ticket === "T2" ? [200, { ok: true, session: { access_token: "A1", refresh_token: "R1", expires_at: Date.now() + 3600e3, user }, proof: "P1" }] : [401, { error: "Start again: enter your email.", restart: true }]),
  } });
  await re.Auth.sendCode("me@example.com");
  await re.Auth.sendCode("me@example.com");
  await re.Auth.verifyCode("me@example.com", "123456", "email");
  assert.deepEqual(re.sent.find((x) => x.url === "/api/auth/verify").body, { email: "me@example.com", code: "123456", type: "email", ticket: "T2" });
  assert.deepEqual([re.Auth.isSignedIn(), re.Auth.proof()], [true, "P1"]);
  assert.deepEqual([typeof re.Auth.signIn, typeof re.Auth.signUp], ["undefined", "undefined"], "no password sign-in left on the page");
  // A TICKET THAT RAN OUT: the error says to start again.
  const old = runAuth({ answers: { verify: [401, { error: "Start again: enter your email.", restart: true }] } });
  const err = await old.Auth.verifyCode("me@example.com", "123456", "email").catch((e) => e);
  assert.deepEqual([err.message, err.restart], ["Start again: enter your email.", true]);
  // NO PROOF IN THE REFRESH ANSWER: the session is not kept (sign in again).
  const dropped = runAuth({ stored: { access_token: "A1", refresh_token: "R1", expires_at: Date.now() + 30_000, user, proof: "P1" }, answers: { refresh: [200, { ok: true, session: { access_token: "A2", refresh_token: "R2", expires_at: Date.now() + 3600e3, user } }] } });
  assert.equal(dropped.Auth.isSignedIn(), true);
  assert.equal(await dropped.Auth.accessToken(), null);
  assert.deepEqual([dropped.Auth.isSignedIn(), dropped.local.getItem("gf_session_v1")], [false, null]);
  // A SESSION FROM BEFORE THIS CHANGE (no proof) is not used: the page asks to sign in, and calls nothing.
  const before = runAuth({ stored: { access_token: "OLD", refresh_token: "R0", expires_at: Date.now() + 3600e3, user } });
  assert.deepEqual([before.Auth.isSignedIn(), await before.Auth.accessToken(), before.sent.length], [false, null, 0]);
  // ...and it is removed from the browser, so a tab still open on the old page (which reloads when its session goes)
  // comes into this page at once, instead of renewing that session without a proof and signing this tab out.
  assert.equal(before.local.getItem("gf_session_v1"), null);
  assert.equal(runAuth({ localStorage: memStorage({ gf_session_v1: "{not json" }) }).local.getItem("gf_session_v1"), null);
  // A browser that keeps nothing (storage blocked) still loads the page.
  const blocked = runAuth({ localStorage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } } });
  assert.equal(blocked.Auth.isSignedIn(), false);
  // ANOTHER TAB: what it stores is followed only with a proof (a tab still on the old page stores sessions without one);
  // signing out there signs out here. Each change reloads this tab once.
  const tabs = runAuth({});
  const other = (v) => tabs.listeners.storage({ key: "gf_session_v1", newValue: v === null ? null : JSON.stringify(v) });
  other({ access_token: "X1", refresh_token: "R1", expires_at: Date.now() + 3600e3, user });
  assert.deepEqual([tabs.Auth.isSignedIn(), tabs.reloads()], [false, 0], "a session without a proof from another tab was taken");
  other({ access_token: "X1", refresh_token: "R1", expires_at: Date.now() + 3600e3, user, proof: "P9" });
  assert.deepEqual([tabs.Auth.isSignedIn(), tabs.Auth.proof(), tabs.reloads()], [true, "P9", 1]);
  tabs.listeners.storage({ key: "gf_signin_again", newValue: null });
  assert.deepEqual([tabs.Auth.isSignedIn(), tabs.reloads()], [true, 1], "another key changed nothing");
  other({ access_token: "X2", refresh_token: "R2", expires_at: Date.now() + 3600e3, user });
  assert.deepEqual([tabs.Auth.isSignedIn(), tabs.reloads()], [false, 2], "a session without a proof replaced this one: signed out here");
  other(null);
  assert.deepEqual([tabs.Auth.isSignedIn(), tabs.reloads()], [false, 2]);
  // A TOKEN CODER REFUSED is renewed even though it looks fresh, once; a second ask finds it renewed and calls nothing.
  const forced = runAuth({ stored: { access_token: "A1", refresh_token: "R1", expires_at: Date.now() + 3600e3, user, proof: "P1" }, answers: { refresh: [200, { ok: true, session: { access_token: "A2", refresh_token: "R2", expires_at: Date.now() + 3600e3, user }, proof: "P1" }] } });
  assert.equal(JSON.parse(forced.local.getItem("gf_session_v1")).access_token, "A1", "a usable session is left where it is");
  assert.equal((await forced.Auth.refresh("A1")).access_token, "A2");
  assert.equal((await forced.Auth.refresh("A1")).access_token, "A2");
  assert.equal((await forced.Auth.refresh()).access_token, "A2");
  assert.equal(forced.sent.filter((x) => x.url === "/api/auth/refresh").length, 1);
  // THE SESSION ENDED ON THE SERVER: ended here, one reload to the sign-in card, however many calls were refused.
  forced.Auth.end(); forced.Auth.end(); forced.Auth.end();
  assert.deepEqual([forced.reloads(), forced.local.getItem("gf_session_v1"), forced.Auth.isSignedIn()], [1, null, false]);
  assert.deepEqual([forced.Auth.justEnded(), forced.Auth.justEnded()], [true, false], "\"Sign in again.\" is said once");
  // A browser that cannot forget the session is never reloaded (it would only come back, again and again).
  const stuckSession = JSON.stringify({ access_token: "A1", refresh_token: "R1", expires_at: Date.now() + 3600e3, user, proof: "P1" });
  const stuck = runAuth({ localStorage: { getItem: () => stuckSession, setItem() {}, removeItem() {} } });
  stuck.Auth.end();
  assert.deepEqual([stuck.reloads(), stuck.Auth.isSignedIn()], [0, false]);

  // EVERY CALL OF CODER'S SCREEN SENDS THE PROOF NEXT TO THE TOKEN (call() is its only fetch).
  const ui = readFileSync(HERE("public/coder.js"), "utf8");
  assert.equal((ui.match(/\bfetch\(/g) || []).length, 1);
  const ok = runCall([[200, { ok: true }]]);
  assert.deepEqual(await ok.call("/projects"), { status: 200, data: { ok: true } });
  assert.deepEqual([ok.sent[0].url, ok.sent[0].headers.Authorization, ok.sent[0].headers["x-coder-proof"], ok.ends], ["/api/coder/projects", "Bearer A1", "P-A1", 0]);
  // "Sign in again." (no proof for this session): back to sign-in at once; no refresh can help.
  const again = runCall([[401, { error: "Sign in again.", signin: true }]]);
  assert.equal((await again.call("/github")).status, 401);
  assert.deepEqual([again.ends, again.refreshes.length, again.sent.length], [1, 0, 1]);
  // "sign in first" (Supabase refused the token): one fresh token and one more try...
  const renewed = runCall([[401, { error: "sign in first" }], [200, { ok: true, projects: [] }]]);
  assert.deepEqual(await renewed.call("/projects"), { status: 200, data: { ok: true, projects: [] } });
  assert.deepEqual([renewed.refreshes, renewed.sent.map((x) => x.headers.Authorization), renewed.sent[1].headers["x-coder-proof"], renewed.ends], [["A1"], ["Bearer A1", "Bearer A2"], "P-A2", 0]);
  // ...never more: refused again, the session ends; the session could not be renewed, it ends.
  const twice = runCall([[401, { error: "sign in first" }], [401, { error: "sign in first" }]]);
  assert.equal((await twice.call("/projects")).status, 401);
  assert.deepEqual([twice.sent.length, twice.refreshes.length, twice.ends], [2, 1, 1]);
  const gone = runCall([[401, { error: "sign in first" }]], { renewTo: null });
  assert.equal((await gone.call("/projects")).status, 401);
  assert.deepEqual([gone.sent.length, gone.ends], [1, 1]);
  // ...but a renewal that failed only for now (no network, Supabase busy or down) keeps the session: the call says to try
  // again in a minute, and nothing is ended.
  const hiccup = runCall([[401, { error: "sign in first" }]], { renewTo: null, ended: false });
  assert.deepEqual(await hiccup.call("/projects"), { status: 0, data: { error: "Sign-in could not be checked. Try again in a minute." } });
  assert.deepEqual([hiccup.sent.length, hiccup.refreshes, hiccup.ends], [1, ["A1"], 0]);
  // The same on the real auth.js: the Worker answers the renewal with 502 (ended: false); the session stays stored, nothing
  // reloads, and the next call renews it and goes through.
  const kept = { access_token: "A1", refresh_token: "R1", expires_at: Date.now() + 3600e3, user, proof: "P1" };
  let renewal = [502, { error: "The session could not be renewed. Try again in a minute.", ended: false }];
  const real = runAuth({ stored: kept, answers: { refresh: () => renewal } });
  const flaky = runCall([[401, { error: "sign in first" }]], { Auth: real.Auth, session: real.session });
  assert.deepEqual(await flaky.call("/projects"), { status: 0, data: { error: "Sign-in could not be checked. Try again in a minute." } });
  assert.deepEqual([real.reloads(), real.Auth.isSignedIn(), JSON.parse(real.local.getItem("gf_session_v1")).refresh_token], [0, true, "R1"]);
  renewal = [200, { ok: true, session: { access_token: "A2", refresh_token: "R2", expires_at: Date.now() + 3600e3, user }, proof: "P1" }];
  const next = runCall([[401, { error: "sign in first" }], [200, { ok: true, projects: [] }]], { Auth: real.Auth, session: real.session });
  assert.deepEqual(await next.call("/projects"), { status: 200, data: { ok: true, projects: [] } });
  assert.deepEqual(next.sent.map((x) => [x.headers.Authorization, x.headers["x-coder-proof"]]), [["Bearer A1", "P1"], ["Bearer A2", "P1"]]);
  assert.equal(real.reloads(), 0);
  // A renewal the Worker says has ended (401, ended: true): back to sign-in, once.
  const over = runAuth({ stored: kept, answers: { refresh: [401, { error: "the session ended", ended: true }] } });
  assert.equal((await runCall([[401, { error: "sign in first" }]], { Auth: over.Auth, session: over.session }).call("/projects")).status, 401);
  assert.deepEqual([over.reloads(), over.Auth.isSignedIn(), over.local.getItem("gf_session_v1"), over.Auth.justEnded()], [1, false, null, true]);
  // WHAT WAS TYPED IS KEPT (going back to sign-in reloads the page): the chat box, or a message on its way, waits in
  // sessionStorage's gf_ask, which the chat box reads when the page loads.
  const typed = runCall([[401, { error: "Sign in again.", signin: true }]], { draft: "a long prompt" });
  await typed.call("/projects");
  assert.deepEqual([typed.ends, typed.session.getItem("gf_ask")], [1, "a long prompt"]);
  const onItsWay = runCall([[401, { error: "sign in first" }], [401, { error: "sign in first" }]], { unsent: "the message being sent" });
  await onItsWay.call("/projects/x/message", { method: "POST", body: "{}" });
  assert.deepEqual([onItsWay.ends, onItsWay.session.getItem("gf_ask")], [1, "the message being sent"]);
  const long =runCall([], { token: null, draft: "x".repeat(5000) });
  await long.call("/projects");
  assert.equal(long.session.getItem("gf_ask").length, 4000);
  const nothing = runCall([[401, { error: "Sign in again.", signin: true }]]);
  await nothing.call("/projects");
  assert.deepEqual([nothing.ends, nothing.session.getItem("gf_ask")], [1, null], "nothing typed, nothing kept");
  assert.equal(hiccup.session.getItem("gf_ask"), null, "kept only when the session ends");
  // send() marks its message as on its way before the call and clears the mark after it; the chat box reads gf_ask at page load.
  // (Up to 1000 characters between them since Gloopy's chat merged in, 2026-11-13: the message's own id, and the files
  // attached to it, are made in between.)
  assert.match(ui, /S\.sending = true; S\.error = ''; S\.draft = ''; S\.unsent = text;\n[\s\S]{0,1700}?\n    const r = await call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/message', [^\n]*\n(?:[^\n]*\n){0,4}?    S\.sending = false; S\.unsent = '';\n/);
  assert.match(ui, /draft: \(\(\) => \{ try \{ const a = sessionStorage\.getItem\('gf_ask'\) \|\| ''; sessionStorage\.removeItem\('gf_ask'\); return a\.slice\(0, 4000\); \}/);
  // Other refusals are not about the session: it stays.
  for (const [status, data] of [[401, { error: "Connect GitHub again first." }], [403, { error: "Coder is not open to this account yet." }], [503, { error: "Sign-in could not be checked. Try again in a minute." }]]) {
    const other = runCall([[status, data]]);
    assert.deepEqual(await other.call("/projects/x/pr", { method: "POST", body: "{}" }), { status, data });
    assert.deepEqual([other.ends, other.refreshes.length], [0, 0], data.error);
  }
  // Signed out already (here or in another tab): back to sign-in, nothing sent.
  const none = runCall([], { token: null });
  assert.equal((await none.call("/projects")).status, 401);
  assert.deepEqual([none.sent.length, none.ends], [0, 1]);

  // THE SIGN-IN CARD: after the session ended, the page opens on it with "Sign in again."
  const gate = runApp({ isSignedIn: () => false, justEnded: () => true });
  assert.deepEqual([gate.els.gfShell.hidden, gate.els.gfGate.hidden, gate.els.gfGate.classes.has("signing"), gate.els.gfMsg.textContent, gate.els.gfTitle.textContent, gate.els.gfStep1.hidden], [true, false, true, "Sign in again.", "Sign in", false]);
  const landing = runApp({ isSignedIn: () => false, justEnded: () => false });
  assert.deepEqual([landing.els.gfGate.classes.has("signing"), landing.els.gfMsg.textContent], [false, ""], "an ordinary visit shows the landing page");
  // THE CARD (2026-11-15): the email alone, then the code; a wrong code stays on the code step; a ticket that ran out goes
  // back to the email; a new code can be sent; another email can be used.
  const seen = [];
  let verifyErr = Object.assign(new Error("That code did not work."), { restart: false });
  let sendErr = null;
  const card = runApp({ isSignedIn: () => false, justEnded: () => false, sendCode: async (e) => { seen.push(["sendCode", e]); if (sendErr) throw sendErr; return { ok: true, step: "code", type: "email", ticket: "T" }; }, verifyCode: async (e, c, type) => { seen.push(["verify", e, c, type]); throw verifyErr; } });
  assert.deepEqual([card.els.gfTitle.textContent, card.els.gfGo.textContent, card.els.gfStep1.hidden, card.els.gfStep2.hidden, card.els.gfCodeActs.hidden], ["Sign in", "Email me a code", false, true, true]);
  assert.match(card.els.gfSub.textContent, /New here\? The same code makes your account\./);
  await card.submit();
  assert.deepEqual([card.els.gfMsg.textContent, seen.length], ["Enter your email.", 0], "no email, nothing sent");
  card.els.gfMail.value = "me@example.com";
  await card.submit();
  assert.deepEqual([card.els.gfStep1.hidden, card.els.gfStep2.hidden, card.els.gfCodeActs.hidden, card.els.gfTitle.textContent, card.els.gfSub.textContent, card.els.gfGo.textContent], [true, false, false, "Check your email", "We sent a code to me@example.com.", "Sign in"]);
  card.els.gfCode.value = "000000";
  await card.submit();
  assert.deepEqual([card.els.gfStep2.hidden, card.els.gfMsg.textContent], [false, "That code did not work."]);
  // Send a new code: the same email; a line that says so (not an error); the code box emptied.
  card.els.gfCode.value = "000000";
  await card.els.gfResend.on.click[0]();
  assert.deepEqual([card.els.gfMsg.textContent, card.els.gfMsg.classes.has("gf-ok"), card.els.gfCode.value, card.els.gfStep2.hidden], ["We sent a new code.", true, "", false]);
  sendErr = new Error("Too many codes for this email. Wait 15 minutes, then try again.");
  await card.els.gfResend.on.click[0]();
  assert.deepEqual([card.els.gfMsg.textContent, card.els.gfMsg.classes.has("gf-ok")], ["Too many codes for this email. Wait 15 minutes, then try again.", false]);
  sendErr = null;
  // A ticket that ran out: back to the email.
  verifyErr = Object.assign(new Error("Start again: enter your email."), { restart: true });
  card.els.gfCode.value = "123456";
  await card.submit();
  assert.deepEqual([card.els.gfStep1.hidden, card.els.gfStep2.hidden, card.els.gfCode.value, card.els.gfMsg.textContent], [false, true, "", "Start again: enter your email."]);
  // Use another email: from the code step back to the email.
  await card.submit();
  card.els.gfBack.on.click[0]();
  assert.deepEqual([card.els.gfStep1.hidden, card.els.gfStep2.hidden, card.els.gfCodeActs.hidden, card.els.gfMsg.textContent], [false, true, true, ""]);
  assert.deepEqual(seen.map((x) => x[0]), ["sendCode", "verify", "sendCode", "sendCode", "verify", "sendCode"]);
  assert.deepEqual(seen[1], ["verify", "me@example.com", "000000", "email"]);
  // No password anywhere on the page.
  assert.doesNotMatch(readFileSync(HERE("public/index.html"), "utf8"), /type="password"|gfPw|Create an account/);
});
