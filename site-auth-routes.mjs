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
  // `ep` is the account's session epoch. A token is only good while it matches
  // what `_users.token_epoch` says, which is what lets a password change hang up
  // every OTHER session — a stolen session token is otherwise valid for thirty
  // days and changing the password does nothing to it.
  const mk = async (user, epoch) => signToken(
    key,
    { sub: String(user.id), email: user.email, ep: Number(epoch == null ? (user.token_epoch || 0) : epoch) },
    { nowMs: now },
  );

  // Everything below needs a live session AND an account that still exists, is
  // not suspended, and whose sessions have not been invalidated. Three separate
  // things, checked once instead of three times in three slightly different ways.
  const signedIn = async () => {
    const claims = await verifySession(key, token, { nowMs: now });
    if (!claims) return null;
    const user = await deps.findUserById(slug, claims.sub);
    if (!user) return null;
    if (Number(claims.ep || 0) !== Number(user.token_epoch || 0)) return null;
    if (user.blocked) return null;
    return user;
  };

  if (action === "me") {
    const claims = await verifySession(key, token, { nowMs: now });
    if (!claims) return json({ error: "not signed in" }, 401);
    // Read through to storage rather than trusting the token's copy: an account
    // deleted after its token was issued must stop working immediately, and the
    // token is valid for thirty days.
    const user = await deps.findUserById(slug, claims.sub);
    if (!user) return json({ error: "not signed in" }, 401);
    // A token minted before the account's current epoch was signed out by a
    // password change. Compared as numbers with 0 for absent, so a token issued
    // before any of this existed still works on an account that never changed.
    if (Number(claims.ep || 0) !== Number(user.token_epoch || 0)) return json({ error: "not signed in" }, 401);
    // Suspension has to take effect on the token somebody is already holding,
    // not just on their next login — otherwise a suspended member keeps full
    // access for up to thirty days.
    if (user.blocked) return json({ error: "not signed in" }, 401);
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

    // Is this site taking new accounts at all, and from whom?
    //
    // AFTER the throttle, so guessing invite codes is rate-limited like anything
    // else, and BEFORE the password is hashed, so a refused signup does not cost
    // a full PBKDF2 run of Worker CPU. Absent on a caller that does not wire it,
    // which keeps every site that never sets a mode behaving exactly as before.
    const gate = deps.signupGate ? await deps.signupGate({ code: body.invite }) : { ok: true };
    if (!gate.ok) return json({ error: gate.error, code: gate.reason }, gate.status);

    const made = await deps.createUser(slug, email, await hashPassword(body.password));
    // Give the use back when the account was not created. Otherwise anyone
    // holding a code could burn every use on it by signing up repeatedly with an
    // address that already exists — the invite is spent and no account appears.
    if (gate.burned && (made.conflict || !made.id) && deps.refundInvite) {
      try { await deps.refundInvite(gate.burned); }
      catch (e) { console.error("invite refund failed:", slug, (e && e.message) || e); }
    }
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
    // A suspended member gets the SAME answer as a wrong password, byte for
    // byte. Saying "your account is suspended" would tell a stranger guessing
    // addresses that this one is a member here, which is the leak this whole
    // endpoint is shaped around avoiding. The check is after the hash, so the
    // timing does not answer it either. The owner tells them they are suspended;
    // the login form does not.
    if (user.blocked) return json({ error: "That email and password don't match." }, 401);
    await deps.touchLogin(user.id).catch?.(() => {});
    return json({ token: await mk(user), user: { id: user.id, email: user.email } });
  }

  if (action === "password") {
    // Changing it while signed in — which no route offered, so the only way a
    // member could change their password was the reset flow, which needs an
    // email nobody can currently send.
    const claims = await verifySession(key, token, { nowMs: now });
    if (!claims) return json({ error: "not signed in" }, 401);

    // Per account, and before anything is hashed: this endpoint verifies one
    // password and computes another, so it is two full PBKDF2 runs of Worker
    // CPU per call. Keyed off the token's subject, which the full check below
    // then has to agree with.
    const t = await deps.throttle(`password:${slug}:${claims.sub}`);
    if (!t.ok) return json({ error: "Too many attempts — try again shortly.", retryAfter: t.retryAfter }, 429);

    const pw = checkPassword(body.next);
    if (!pw.ok) return json({ error: pw.error }, 400);

    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);

    // The CURRENT password, even though they are already signed in. Without it a
    // stolen session token is a permanent account takeover: the thief sets a new
    // password and the owner is locked out of their own account.
    const full = await deps.findUser(slug, user.email);
    const ok = await verifyPassword(typeof body.current === "string" ? body.current : "", (full && full.password_hash) || DUMMY);
    if (!ok) return json({ error: "That password doesn't match.", code: "current" }, 401);

    const epoch = await deps.setPassword(user.id, await hashPassword(body.next));
    // A fresh token, or the caller is signed out by the change they just made.
    return json({ ok: true, token: await mk(user, epoch) });
  }

  if (action === "logout-all") {
    // Signs out every OTHER device and keeps this one. The primitive somebody
    // wants after "I was signed in on a machine I no longer have" — and it only
    // became possible today, when tokens started carrying an epoch.
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    const epoch = await deps.bumpEpoch(user.id);
    return json({ ok: true, token: await mk(user, epoch) });
  }

  if (action === "email") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);

    const next = normalizeEmail(body.next);
    if (!next) return json({ error: "Enter a valid email address." }, 400);

    const t = await deps.throttle(`email:${slug}:${user.id}`);
    if (!t.ok) return json({ error: "Too many attempts — try again shortly.", retryAfter: t.retryAfter }, 429);

    // The current password, because the address IS the account: whoever holds it
    // can reset their way back in. A stolen session that could change it would
    // be handing the account over permanently.
    const full = await deps.findUser(slug, user.email);
    const ok = await verifyPassword(typeof body.current === "string" ? body.current : "", (full && full.password_hash) || DUMMY);
    if (!ok) return json({ error: "That password doesn't match.", code: "current" }, 401);

    if (next === user.email) return json({ ok: true, user: { id: user.id, email: user.email } });
    const changed = await deps.setEmail(user.id, next);
    if (changed && changed.conflict) return json({ error: "That email already has an account.", code: "exists" }, 409);
    // A fresh token so the client's copy of the address is not stale.
    return json({ ok: true, token: await mk({ ...user, email: next }), user: { id: user.id, email: next } });
  }

  if (action === "close") {
    // A member deleting their own account. The owner could always delete them;
    // they could never leave.
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);

    const t = await deps.throttle(`close:${slug}:${user.id}`);
    if (!t.ok) return json({ error: "Too many attempts — try again shortly.", retryAfter: t.retryAfter }, 429);

    const full = await deps.findUser(slug, user.email);
    const ok = await verifyPassword(typeof body.current === "string" ? body.current : "", (full && full.password_hash) || DUMMY);
    if (!ok) return json({ error: "That password doesn't match.", code: "current" }, 401);

    await deps.deleteUser(user.id);
    // Their rows are left behind, exactly as when an owner deletes a member:
    // `owner_id` stops matching anyone, so nothing is readable as them, but a
    // departed customer's bookings should not vanish from the owner's list
    // without the owner being asked.
    return json({ ok: true });
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
      // setPassword bumps the epoch, so every session that existed before the
      // reset stops working. Somebody resetting a password is usually saying
      // they lost control of the account; leaving the thief signed in would
      // defeat the entire point of the reset.
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
