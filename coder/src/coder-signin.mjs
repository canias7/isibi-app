// SIGN-IN THROUGH CODER'S WORKER (2026-11-05, the owner: "remove the stuff that
// are browser stuff and put it server side"). The page used to call Supabase
// itself; now it calls /api/auth/* here, and only the Worker talks to Supabase.
// The page keeps only its own session (the tokens Supabase hands back).
//
//   POST /api/auth/signin   { email, password }      password checked, then a code emailed
//   POST /api/auth/verify   { email, code, type }    the emailed code → a session
//   POST /api/auth/signup   { email, password }      a session, or "check your email"
//   POST /api/auth/refresh  { refresh_token }        a fresh session
//   POST /api/auth/logout   (Bearer token)           the session ended

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
  try {
    if (action === "signin") {
      if (!EMAIL.test(email) || !password) return json({ error: "Enter your email and password." }, 400);
      const p = await gotrue("token?grant_type=password", { email, password });
      if (!p.ok) return json({ error: why(p.d, "That email and password do not match.") }, 401);
      const c = await gotrue("otp", { email, create_user: false });
      if (!c.ok) return json({ error: why(c.d, "The code could not be sent. Try again in a minute.") }, 502);
      return json({ ok: true, step: "code", type: "email" });
    }
    if (action === "signup") {
      if (!EMAIL.test(email)) return json({ error: "Enter a valid email." }, 400);
      if (password.length < 6) return json({ error: "Use at least 6 characters for the password." }, 400);
      const r = await gotrue("signup", { email, password });
      if (!r.ok) return json({ error: why(r.d, "The account could not be made.") }, 400);
      const s = sessionOf(r.d);
      if (s) return json({ ok: true, session: s });
      const u = r.d && (r.d.user || r.d);
      if (u && Array.isArray(u.identities) && u.identities.length === 0) return json({ error: "That account already exists — sign in instead." }, 409);
      return json({ ok: true, step: "code", type: "signup" });
    }
    if (action === "verify") {
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const type = body.type === "signup" ? "signup" : "email";
      if (!EMAIL.test(email) || !/^\d{4,10}$/.test(code)) return json({ error: "Enter the code from the email." }, 400);
      const r = await gotrue("verify", { type, email, token: code });
      const s = r.ok ? sessionOf(r.d) : null;
      if (!s) return json({ error: why(r.d, "That code did not work.") }, 401);
      return json({ ok: true, session: s });
    }
    if (action === "refresh") {
      const rt = typeof body.refresh_token === "string" ? body.refresh_token : "";
      if (!rt || rt.length > 512) return json({ error: "no session" }, 400);
      const r = await gotrue("token?grant_type=refresh_token", { refresh_token: rt });
      const s = r.ok ? sessionOf(r.d) : null;
      if (!s) return json({ error: "the session ended", ended: r.status >= 400 && r.status < 500 }, r.status >= 400 && r.status < 500 ? 401 : 502);
      return json({ ok: true, session: s });
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
