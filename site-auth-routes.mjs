// The visitor-account endpoints for a published site.
//
// Split from worker.js so the decisions can be driven against fakes: what a
// wrong password is allowed to reveal, what a reset request is allowed to
// confirm, and whether a login can be used to burn CPU. The storage, the mailer
// and the clock are all injected.
//
// Routes (all under /api/db/<slug>/auth/):
//   POST signup   {email, password}          → {token, user}
//   POST login    {email, password}          → {token, user}
//   GET  me                                  → {user}      (Bearer token)
//   POST reset    {email}                    → {ok:true}   request a link
//   POST reset    {token, password}          → {ok:true}   use the link
import {
  hashPassword, verifyPassword, sessionKey, signToken, signReset,
  verifySession, verifyReset, normalizeEmail, checkPassword,
} from "./site-auth.mjs";

const json = (body, status = 200) => ({ status, body });

// A hash to compare against when the account does not exist. Without it, "no
// such email" returns in a millisecond and "wrong password" takes the full
// PBKDF2 cost — which is a timing oracle for whether an address has an account
// on this site. Cheap iterations: it only has to burn comparable time, and the
// real answer is already no.
const DUMMY = "pbkdf2$210000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/**
 * deps:
 *   findUser(slug, email)      → {id, password_hash} | null
 *   findUserById(slug, id)     → {id, email} | null
 *   createUser(slug, email, h) → {id} | {conflict:true}
 *   setPassword(id, hash)      → void
 *   touchLogin(id)             → void
 *   secret()                   → the server-only string the signing key derives from
 *   sendReset(email, token)    → void      may be a no-op when no mailer is configured
 *   throttle(key)              → {ok} | {ok:false, retryAfter}
 */
export async function handleSiteAuth(deps, { slug, action, body = {}, token, nowMs } = {}) {
  const key = await sessionKey(await deps.secret(), slug);
  const now = nowMs == null ? Date.now() : nowMs;
  const mk = async (user) => signToken(key, { sub: String(user.id), email: user.email }, { nowMs: now });

  if (action === "me") {
    const claims = await verifySession(key, token, { nowMs: now });
    if (!claims) return json({ error: "not signed in" }, 401);
    // Read through to storage rather than trusting the token's copy: an account
    // deleted after its token was issued must stop working immediately, and the
    // token is valid for thirty days.
    const user = await deps.findUserById(slug, claims.sub);
    if (!user) return json({ error: "not signed in" }, 401);
    return json({ user: { id: user.id, email: user.email } });
  }

  if (action === "signup") {
    const email = normalizeEmail(body.email);
    if (!email) return json({ error: "Enter a valid email address." }, 400);
    const pw = checkPassword(body.password);
    if (!pw.ok) return json({ error: pw.error }, 400);

    // PBKDF2 is paid by the Worker, so an unthrottled signup is a way to burn
    // CPU for free.
    const t = await deps.throttle(`signup:${slug}`);
    if (!t.ok) return json({ error: "Too many attempts — try again shortly." }, 429);

    const made = await deps.createUser(slug, email, await hashPassword(body.password));
    // KNOWN TRADEOFF, deliberate: this confirms the address has an account on
    // this site. The privacy-preserving alternative — always answer 200 and mail
    // "you already have an account" — needs a working mailer, and a site with no
    // mail configured would silently never sign anyone up. Told plainly instead.
    if (made.conflict) return json({ error: "That email already has an account.", code: "exists" }, 409);
    if (!made.id) return json({ error: "Could not create that account." }, 500);
    return json({ token: await mk({ id: made.id, email }), user: { id: made.id, email } });
  }

  if (action === "login") {
    const email = normalizeEmail(body.email);
    const pw = typeof body.password === "string" ? body.password : "";
    // Throttled per site+email: the target of a brute force is one account, and
    // each attempt costs a full PBKDF2 run.
    const t = await deps.throttle(`login:${slug}:${email || "?"}`);
    if (!t.ok) return json({ error: "Too many attempts — try again shortly.", retryAfter: t.retryAfter }, 429);

    const user = email ? await deps.findUser(slug, email) : null;
    // Always run a verification, even with no account, so the response time does
    // not answer "does this address have an account here?".
    const ok = await verifyPassword(pw, (user && user.password_hash) || DUMMY);
    if (!user || !ok) return json({ error: "That email and password don't match." }, 401);
    await deps.touchLogin(user.id).catch?.(() => {});
    return json({ token: await mk(user), user: { id: user.id, email: user.email } });
  }

  if (action === "reset") {
    // Using a link: {token, password}
    if (body.token) {
      const claims = await verifyReset(key, body.token, { nowMs: now });
      if (!claims) return json({ error: "This reset link is invalid or has expired." }, 400);
      const pw = checkPassword(body.password);
      if (!pw.ok) return json({ error: pw.error }, 400);
      const user = await deps.findUserById(slug, claims.sub);
      if (!user) return json({ error: "This reset link is invalid or has expired." }, 400);
      await deps.setPassword(user.id, await hashPassword(body.password));
      return json({ ok: true });
    }

    // Requesting a link: {email}. ALWAYS 200, whether or not the account exists.
    // This one has no UX cost and is the classic enumeration leak: a different
    // answer here tells a stranger who is a customer of this business.
    const email = normalizeEmail(body.email);
    const t = await deps.throttle(`reset:${slug}:${email || "?"}`);
    if (!t.ok) return json({ ok: true }); // even the throttle must not be a signal
    if (email) {
      const user = await deps.findUser(slug, email);
      if (user) {
        try { await deps.sendReset(email, await signReset(key, String(user.id), { nowMs: now })); }
        catch { /* a mail failure must not become an existence oracle either */ }
      }
    }
    return json({ ok: true });
  }

  return json({ error: "no such auth action" }, 404);
}
