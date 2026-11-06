// SIGN-IN THROUGH CODER'S WORKER (2026-11-05, the owner: "remove the stuff that
// are browser stuff and put it server side"). The page used to call Supabase
// itself; now it calls /api/auth/* here, and only the Worker talks to Supabase.
// The page keeps only its own session (the tokens Supabase hands back).
//
//   POST /api/auth/signin   { email, password }               password checked, then a code emailed; a ticket
//   POST /api/auth/verify   { email, code, type, ticket }     the emailed code → a session and its proof
//   POST /api/auth/signup   { email, password }               "check your email", with a ticket
//   POST /api/auth/refresh  { refresh_token, proof }          a fresh session (and the proof, if it was valid)
//   POST /api/auth/logout   (Bearer token)                    the session ended
//
// BOTH STEPS, EVERY TIME (the audit, 2026-11-06): the code is only taken with
// the ticket from the password step, and only a session made by these two
// steps gets the Worker's proof, without which Coder's routes answer "Sign in
// again." (coder-auth.mjs). The password step's own Supabase session is ended
// at once: it was only a way to check the password.
import { makeTicket, readTicket, proofFor, proofOk, proofReady, sessionIdOf } from "./coder-auth.mjs";

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
  const password = typeof body.password === "string" ? body.password : "";
  // A SESSION SUPABASE MADE ON THE WAY IS ENDED AT ONCE (the audit, 2026-11-06):
  // only that one session ("scope=local", with its own token), never the default
  // "global", which would sign the user out on every device. A token without a
  // session id is left alone, in case Supabase took that as every session. Best
  // effort: the code step does not depend on it.
  const endThisSession = async (d) => {
    const t = d && typeof d.access_token === "string" ? d.access_token : "";
    if (t && sessionIdOf(t)) await gotrue("logout?scope=local", {}, t).catch(() => null);
  };
  try {
    if (action === "signin") {
      if (!EMAIL.test(email) || !password) return json({ error: "Enter your email and password." }, 400);
      // No proof key, no sign-in (fail closed), before Supabase is asked anything.
      if (!(await proofReady(env))) return json({ error: "sign-in is not set up" }, 503);
      const p = await gotrue("token?grant_type=password", { email, password });
      if (!p.ok) return json({ error: why(p.d, "That email and password do not match.") }, 401);
      await endThisSession(p.d);
      const c = await gotrue("otp", { email, create_user: false });
      if (!c.ok) return json({ error: why(c.d, "The code could not be sent. Try again in a minute.") }, 502);
      // The ticket says this email gave its password here; the code is only taken with it.
      return json({ ok: true, step: "code", type: "email", ticket: await makeTicket(env, email, "email") });
    }
    if (action === "signup") {
      if (!EMAIL.test(email)) return json({ error: "Enter a valid email." }, 400);
      if (password.length < 6) return json({ error: "Use at least 6 characters for the password." }, 400);
      if (!(await proofReady(env))) return json({ error: "sign-in is not set up" }, 503);
      const r = await gotrue("signup", { email, password });
      if (!r.ok) return json({ error: why(r.d, "The account could not be made.") }, 400);
      // SUPABASE GAVE A SESSION AT ONCE (no email confirmation asked): it is
      // ended, and a new account also needs the emailed code (the audit, 2026-11-06).
      if (sessionOf(r.d)) {
        await endThisSession(r.d);
        const c = await gotrue("otp", { email, create_user: false });
        if (!c.ok) return json({ error: why(c.d, "The code could not be sent. Try again in a minute.") }, 502);
        return json({ ok: true, step: "code", type: "email", ticket: await makeTicket(env, email, "email") });
      }
      const u = r.d && (r.d.user || r.d);
      if (u && Array.isArray(u.identities) && u.identities.length === 0) return json({ error: "That account already exists — sign in instead." }, 409);
      // The password was set by this very request; the confirmation code comes by email.
      return json({ ok: true, step: "code", type: "signup", ticket: await makeTicket(env, email, "signup") });
    }
    if (action === "verify") {
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const type = body.type === "signup" ? "signup" : "email";
      if (!EMAIL.test(email) || !/^\d{4,10}$/.test(code)) return json({ error: "Enter the code from the email." }, 400);
      // ONLY WITH THE PASSWORD STEP'S TICKET (the audit, 2026-11-06): genuine, not
      // run out, for this email and this kind of code. Supabase is not asked otherwise.
      const t = await readTicket(env, body.ticket);
      if (!t || t.email !== email || t.type !== type) return json({ error: "Start again: enter your email and password.", restart: true }, 401);
      const r = await gotrue("verify", { type, email, token: code });
      const s = r.ok ? sessionOf(r.d) : null;
      if (!s) return json({ error: why(r.d, "That code did not work.") }, 401);
      // THE PROOF that this session was made through both steps here.
      const proof = await proofFor(env, sessionIdOf(s.access_token));
      if (!proof) return json({ error: "Sign-in did not finish. Try again." }, 502);
      return json({ ok: true, session: s, proof });
    }
    if (action === "refresh") {
      const rt = typeof body.refresh_token === "string" ? body.refresh_token : "";
      if (!rt || rt.length > 512) return json({ error: "no session" }, 400);
      const r = await gotrue("token?grant_type=refresh_token", { refresh_token: rt });
      const s = r.ok ? sessionOf(r.d) : null;
      if (!s) return json({ error: "the session ended", ended: r.status >= 400 && r.status < 500 }, r.status >= 400 && r.status < 500 ? 401 : 502);
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
