// SIGN-IN THROUGH CODER'S WORKER (2026-11-05, the owner: "remove the stuff that
// are browser stuff and put it server side"). The page used to call Supabase
// itself; now it calls /api/auth/* here, and only the Worker talks to Supabase.
// The page keeps only its own session (the tokens Supabase hands back).
//
//   POST /api/auth/signin   { email }                         a code emailed; a ticket
//   POST /api/auth/verify   { email, code, type, ticket }     the emailed code → a session and its proof
//   POST /api/auth/signup   { email }                         the same as signin (a page from before still calls it)
//   POST /api/auth/refresh  { refresh_token, proof }          a fresh session (and the proof, if it was valid)
//   POST /api/auth/logout   (Bearer token)                    the session ended
//
// A CODE WE EMAIL, NO PASSWORD (the owner, 2026-11-15: "no passwords, just
// email codes pls"; the password step of the audit of 2026-11-06 is gone): the
// email gets a code, and the code signs in. A new email's first code makes its
// account (Supabase's own sign-in by code), so there is no separate sign-up. A
// password sent by a page from before is not read.
//
// STILL THROUGH THIS WORKER ONLY (the audit, 2026-11-06): the code is only
// taken with the ticket of a code sent here, and only a session made by this
// code step gets the Worker's proof, without which Coder's routes answer "Sign
// in again." (coder-auth.mjs). Each email gets 5 codes sent and 5 code checks
// per 15 minutes, counted before Supabase is asked. Both counts are kept in
// CODER_BUCKET, so without the bucket nobody can sign in (fail closed).
import { makeTicket, readTicket, proofFor, proofOk, proofReady, sessionIdOf, takeCodeTry, takeSendTry, clearCodeCount } from "./coder-auth.mjs";

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/** What the page keeps of a Supabase answer: the tokens, when they end, who it is. */
export function sessionOf(d) {
  if (!d || typeof d.access_token !== "string") return null;
  const expires_at = d.expires_at ? Number(d.expires_at) * 1000 : Date.now() + (Number(d.expires_in) || 3600) * 1000;
  const u = d.user || {};
  return { access_token: d.access_token, refresh_token: String(d.refresh_token || ""), expires_at, user: { id: String(u.id || ""), email: String(u.email || "") } };
}

/** Supabase's own words for a failure, without anything else it sent. */
function why(d, fallback) {
  const m = d && (d.error_description || d.msg || d.message || d.error);
  return typeof m === "string" && m.length < 200 ? m : fallback;
}

export async function handleSignin(request, env, { fetchFn = fetch } = {}) {
  if (request.method !== "POST") return json({ error: "method" }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json({ error: "sign-in is not set up" }, 503);
  const action = new URL(request.url).pathname.replace(/^\/api\/auth\/?/, "");
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const gotrue = async (path, payload, token) => {
    const r = await fetchFn(env.SUPABASE_URL + "/auth/v1/" + path, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: env.SUPABASE_ANON_KEY, ...(token ? { authorization: "Bearer " + token } : {}), ...(request.headers.get("cf-connecting-ip") ? { "x-forwarded-for": request.headers.get("cf-connecting-ip") } : {}) },
      body: JSON.stringify(payload || {}),
      signal: AbortSignal.timeout(15000),
    });
    let d = {};
    try { d = await r.json(); } catch { d = {}; }
    return { ok: r.ok, status: r.status, d };
  };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  try {
    // THE CODE IS SENT (sign-in, and sign-up for an email that has no account yet).
    if (action === "signin" || action === "signup") {
      if (!EMAIL.test(email)) return json({ error: "Enter a valid email." }, 400);
      // No proof key or bucket, no sign-in (fail closed), before Supabase is asked anything.
      if (!(await proofReady(env)) || !env.CODER_BUCKET) return json({ error: "sign-in is not set up" }, 503);
      // FIVE CODES PER EMAIL PER 15 MINUTES, counted before Supabase is asked to send one.
      const go = await takeSendTry(env, email);
      if (go.off) return json({ error: "sign-in is not set up" }, 503);
      if (go.wait) { const m = Math.ceil(go.wait / 60000); return json({ error: "Too many codes for this email. Wait " + m + (m === 1 ? " minute" : " minutes") + ", then try again." }, 429); }
      if (!go.ok) return json({ error: "Too many tries at once. Try again in a minute." }, 429);
      // Supabase's sign-in by code: a new email's account is made with its first code.
      const c = await gotrue("otp", { email, create_user: true });
      if (!c.ok) return json({ error: why(c.d, "The code could not be sent. Try again in a minute.") }, c.status === 429 ? 429 : 502);
      // The ticket says a code was sent to this email here; the code is only taken with it.
      return json({ ok: true, step: "code", type: "email", ticket: await makeTicket(env, email, "email") });
    }
    if (action === "verify") {
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const type = body.type === "signup" ? "signup" : "email";
      if (!EMAIL.test(email) || !/^\d{4,10}$/.test(code)) return json({ error: "Enter the code from the email." }, 400);
      // ONLY WITH THE TICKET OF A CODE SENT HERE (the audit, 2026-11-06): genuine,
      // not run out, for this email and this kind of code. Supabase is not asked otherwise.
      const t = await readTicket(env, body.ticket);
      if (!t || t.email !== email || t.type !== type) return json({ error: "Start again: enter your email.", restart: true }, 401);
      // FIVE CODE CHECKS PER EMAIL PER 15 MINUTES (the audit, 2026-11-06, after
      // review), taken before Supabase is asked; a new code sent does not reset them.
      const go = await takeCodeTry(env, email);
      if (go.off) return json({ error: "sign-in is not set up" }, 503);
      if (go.wait) { const m = Math.ceil(go.wait / 60000); return json({ error: "Too many tries with the code. Wait " + m + (m === 1 ? " minute" : " minutes") + ", then start again.", restart: true }, 429); }
      if (!go.ok) return json({ error: "Too many tries at once. Try again in a minute." }, 429);
      const r = await gotrue("verify", { type, email, token: code });
      const s = r.ok ? sessionOf(r.d) : null;
      if (!s) return json({ error: why(r.d, "That code did not work.") }, 401);
      // THE PROOF that this session was made through the code step here.
      const proof = await proofFor(env, sessionIdOf(s.access_token));
      if (!proof) return json({ error: "Sign-in did not finish. Try again." }, 502);
      // A right code: the count starts again.
      await clearCodeCount(env, email);
      return json({ ok: true, session: s, proof });
    }
    if (action === "refresh") {
      const rt = typeof body.refresh_token === "string" ? body.refresh_token : "";
      if (!rt || rt.length > 512) return json({ error: "no session" }, 400);
      const r = await gotrue("token?grant_type=refresh_token", { refresh_token: rt });
      const s = r.ok ? sessionOf(r.d) : null;
      // ONLY SUPABASE'S REFUSAL ENDS THE SESSION. Busy (429, a rate limit) or down
      // (5xx) only means "not now": the page keeps the session and tries again
      // later (the audit, 2026-11-06, after review).
      const ended = r.status >= 400 && r.status < 500 && r.status !== 429;
      if (!s) return json(ended ? { error: "the session ended", ended: true } : { error: "The session could not be renewed. Try again in a minute.", ended: false }, ended ? 401 : 502);
      // THE PROOF CARRIES OVER (the audit, 2026-11-06): Supabase keeps a session's
      // id when it refreshes it, so a proof valid for the new token is handed back;
      // any other is left out (and the page signs in again).
      const keep = await proofOk(env, sessionIdOf(s.access_token), body.proof);
      return json({ ok: true, session: s, ...(keep ? { proof: body.proof } : {}) });
    }
    if (action === "logout") {
      const h = request.headers.get("authorization") || "";
      const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
      if (token) await gotrue("logout", {}, token).catch(() => null);
      return json({ ok: true });
    }
  } catch {
    return json({ error: "Sign-in could not be reached. Try again." }, 502);
  }
  return json({ error: "not found" }, 404);
}
