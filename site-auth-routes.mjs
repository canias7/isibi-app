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
import { lockState, afterFailure, afterSuccess } from "./site-lockout.mjs";
import { checkPwned, PWNED_MESSAGE } from "./site-pwned.mjs";
import { newSessionId, shouldTouch } from "./site-sessions.mjs";

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
 *   findUserById(slug, id, sid)→ {id, email, session_revoked} | null
 *   createUser(slug, email, h) → {id} | {conflict:true}
 *   setPassword(id, hash)      → void
 *   touchLogin(id)             → void
 *   startSession(id, sid)      → void      records a device; best-effort
 *   revokeAllSessions(id, keep)→ void      the list half of `logout-all`
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
  //
  // `sid` names the DEVICE, which is what makes signing out one of them possible
  // at all. Recorded best-effort: a failed write must not fail a correct
  // sign-in, and `sessionUsable` reads a sid with no row as live so that it
  // cannot. A caller that wires no `startSession` mints tokens with a sid that
  // nothing has a row for, which is exactly the pre-existing behaviour.
  const mk = async (user, epoch) => {
    const sid = newSessionId();
    try { await deps.startSession?.(user.id, sid); }
    catch (e) { console.error("session record failed:", slug, (e && e.message) || e); }
    return signToken(
      key,
      { sub: String(user.id), email: user.email, ep: Number(epoch == null ? (user.token_epoch || 0) : epoch), sid },
      { nowMs: now },
    );
  };

  // Everything below needs a live session AND an account that still exists, is
  // not suspended, and whose sessions have not been invalidated. Three separate
  // things, checked once instead of three times in three slightly different ways.
  const signedIn = async () => {
    const claims = await verifySession(key, token, { nowMs: now });
    if (!claims) return null;
    // The sid rides along on the lookup rather than costing a second statement.
    const user = await deps.findUserById(slug, claims.sub, claims.sid);
    if (!user) return null;
    if (Number(claims.ep || 0) !== Number(user.token_epoch || 0)) return null;
    if (user.blocked) return null;
    // This device was signed out from another one.
    if (claims.sid && user.session_revoked) return null;
    return user;
  };

  // The refusal, or null to carry on — three branches set a password and all
  // three have to answer this the same way, including the failure direction.
  //
  // Only `known` refuses. `unknown` is the service being slow, down, blocked or
  // rate-limiting us, and refusing to let somebody set a password because a
  // third party is unavailable would make their outage into ours. Absent on a
  // caller that does not wire `checkPwned`, so nothing changes for one that does
  // not want an outbound request in its signup path at all.
  const pwnedRefusal = async (password) => {
    if (!deps.checkPwned) return null;
    const breached = await checkPwned(password, { fetchImpl: deps.checkPwned });
    return breached.known ? json({ error: PWNED_MESSAGE, code: "pwned", count: breached.count }, 400) : null;
  };

  // Everything that bumps the epoch also has to clear the device list.
  //
  // The epoch is what actually stops those tokens; this is about what the member
  // SEES. Without it every device they just signed out keeps appearing in their
  // settings as somewhere they are signed in, and the one screen that exists to
  // answer that question answers it wrongly.
  //
  // Best-effort, because a failed write leaves a stale row rather than a live
  // session. Must run BEFORE the replacement token is minted — `mk` records a
  // row, and a sweep after it would revoke the session being handed back.
  const sweepSessions = async (userId) => {
    try { await deps.revokeAllSessions?.(userId); }
    catch (e) { console.error("session sweep failed:", slug, (e && e.message) || e); }
  };

  if (action === "me") {
    const claims = await verifySession(key, token, { nowMs: now });
    if (!claims) return json({ error: "not signed in" }, 401);
    // Read through to storage rather than trusting the token's copy: an account
    // deleted after its token was issued must stop working immediately, and the
    // token is valid for thirty days.
    const user = await deps.findUserById(slug, claims.sub, claims.sid);
    if (!user) return json({ error: "not signed in" }, 401);
    // A token minted before the account's current epoch was signed out by a
    // password change. Compared as numbers with 0 for absent, so a token issued
    // before any of this existed still works on an account that never changed.
    if (Number(claims.ep || 0) !== Number(user.token_epoch || 0)) return json({ error: "not signed in" }, 401);
    // Suspension has to take effect on the token somebody is already holding,
    // not just on their next login — otherwise a suspended member keeps full
    // access for up to thirty days.
    if (user.blocked) return json({ error: "not signed in" }, 401);
    // Signed out from another device. Same rule as the epoch above, per-session
    // rather than per-account.
    if (claims.sid && user.session_revoked) return json({ error: "not signed in" }, 401);
    // The app calls this on load, which is the cheapest honest moment to stamp
    // "last seen" — the data path is left alone deliberately, so a device list
    // never costs a write on a read. Fire-and-forget: a failed stamp is a stale
    // timestamp, not a failed request.
    if (claims.sid && deps.touchSession && shouldTouch(user.session_last_seen, now)) {
      try { await deps.touchSession(claims.sid, Math.floor(now / 1000)); }
      catch (e) { console.error("session touch failed:", slug, (e && e.message) || e); }
    }
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

    // Is this password already on a breach list?
    //
    // BEFORE the invite gate, which is the ordering that matters here. The gate
    // SPENDS a code, and refusing the password afterwards would leave somebody
    // holding a code that no longer works because of a retry they were told to
    // make — the one failure mode of this check that a user would actually
    // notice. The cost of putting it first is an outbound request on a signup
    // that was going to be refused anyway, which the throttle above bounds.
    const breached = await pwnedRefusal(body.password);
    if (breached) return breached;

    // Is this site taking new accounts at all, and from whom?
    //
    // AFTER the throttle, so guessing invite codes is rate-limited like anything
    // else, and BEFORE the password is hashed, so a refused signup does not cost
    // a full PBKDF2 run of Worker CPU. Absent on a caller that does not wire it,
    // which keeps every site that never sets a mode behaving exactly as before.
    const gate = deps.signupGate ? await deps.signupGate({ code: body.invite, email }) : { ok: true };
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
    // Ask them to confirm the address. Detached and best-effort by construction:
    // the account exists either way, and a site with no mailer simply never asks.
    if (deps.onSignedUp) { try { deps.onSignedUp(made.id, email); } catch (e) { console.error("signup hook failed:", slug, (e && e.message) || e); } }
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

    // The durable half of the brute-force defence. The throttle above is
    // per-isolate — Cloudflare runs many per colo and evicts idle ones, so an
    // attacker spreading attempts gets a fresh allowance each time. This one is
    // counted on the row, so it is the same number everywhere and survives.
    //
    // Checked AFTER the hash, deliberately: answering early would make a delayed
    // account measurably faster to refuse than a wrong password, which is a
    // timing oracle for whether the address is a member here at all. The cost is
    // one PBKDF2 run per attempt, which the two throttles above already bound.
    if (user && deps.recordLoginAttempt) {
      const state = lockState(user, now);
      if (state.locked) {
        // Byte-identical to a wrong password. "Try again in 10 minutes" would
        // confirm the account exists, and confirming that is the leak this whole
        // endpoint is shaped around avoiding.
        return json({ error: "That email and password don't match." }, 401);
      }
      if (!ok) {
        const next = afterFailure(user, now);
        if (next) { try { await deps.recordLoginAttempt(user.id, next); } catch (e) { console.error("lockout write failed:", slug, (e && e.message) || e); } }
      }
    }

    if (!user || !ok) return json({ error: "That email and password don't match." }, 401);
    // A suspended member gets the SAME answer as a wrong password, byte for
    // byte. Saying "your account is suspended" would tell a stranger guessing
    // addresses that this one is a member here, which is the leak this whole
    // endpoint is shaped around avoiding. The check is after the hash, so the
    // timing does not answer it either. The owner tells them they are suspended;
    // the login form does not.
    if (user.blocked) return json({ error: "That email and password don't match." }, 401);
    await deps.touchLogin(user.id).catch?.(() => {});
    // They proved who they are, so the failures are forgotten — otherwise a
    // person who fumbles four times a month arrives at the top of the curve
    // eventually without ever having been attacked.
    if (deps.recordLoginAttempt && (user.failed || user.locked_until)) {
      try { await deps.recordLoginAttempt(user.id, afterSuccess()); } catch { /* never fail a good login over bookkeeping */ }
    }
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

    // Last, once the caller has proved they are this account's owner. Anywhere
    // earlier and a stolen session token — which is all `signedIn()` proves —
    // is an outbound request per call to a service we do not run.
    const breached = await pwnedRefusal(body.next);
    if (breached) return breached;

    const epoch = await deps.setPassword(user.id, await hashPassword(body.next));
    await sweepSessions(user.id);
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
    await sweepSessions(user.id);
    // AFTER the sweep, because `mk` records a row for the token it mints and a
    // sweep run afterwards would revoke the session the caller is being handed.
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
    // `setEmail` cleared `verified`, so ask them to prove the new one. Same
    // fire-and-forget path as signup: the change already succeeded, and a site
    // with no mailer simply never asks.
    try { deps.onSignedUp?.(user.id, next); }
    catch (e) { console.error("verify send failed after email change:", slug, (e && e.message) || e); }
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
      const breached = await pwnedRefusal(body.password);
      if (breached) return breached;
      // setPassword bumps the epoch, so every session that existed before the
      // reset stops working. Somebody resetting a password is usually saying
      // they lost control of the account; leaving the thief signed in would
      // defeat the entire point of the reset.
      await deps.setPassword(user.id, await hashPassword(body.password));
      // Nothing is minted here — a reset ends at the sign-in page — so every
      // device really is signed out, and the list has to say so.
      await sweepSessions(user.id);
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
