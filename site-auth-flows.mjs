// The sign-in flows themselves.
//
// One handler per route in the registry, all of them injected, none of them
// touching a database or the network directly. Adding a method means adding a
// case here and an entry in site-auth-methods.mjs — nothing else changes.
//
// The rule every flow obeys: **a primary method that succeeds does not
// automatically mint a session.** If the account has a second factor enabled it
// gets a PENDING token instead, good for presenting that factor and for nothing
// else. Handing back a real session and "checking 2FA on the next request" is
// how a second factor quietly becomes optional.

import { signToken, verifyToken, hashPassword, verifyPassword, normalizeEmail, signVerify, verifyVerification, signPending } from "./site-auth.mjs";
import { resolveIdentity, canUnlink } from "./site-identity.mjs";
import { startOAuth, completeOAuth, providerConfig } from "./site-oauth.mjs";
import {
  verifyRegistration, verifyAssertion, newChallenge, b64u,
} from "./site-webauthn.mjs";
import {
  newTotpSecret, verifyTotp, totpUri, newEmailCode, codeMatches,
  newRecoveryCodes, normalizeRecovery, EMAIL_CODE_TTL_SEC, EMAIL_CODE_ATTEMPTS,
} from "./site-otp.mjs";
import { availableMethods, secondFactorRequired } from "./site-auth-methods.mjs";
import { newSessionId, normalizeSid, describeSessions, MAX_SESSIONS_LISTED } from "./site-sessions.mjs";

const json = (body, status = 200) => ({ status, body });

/** Ten minutes to complete a passkey ceremony or type an emailed code. */
export const CHALLENGE_TTL_SEC = 10 * 60;
// Re-exported, not redefined. The password route in site-auth-routes.mjs is the
// OTHER sign-in path and it mints the same token; two copies of this constant is
// how the two paths would fall out of step again.
export { PENDING_TTL_SEC } from "./site-auth.mjs";

/**
 * A primary method has succeeded. Turn that into what the caller gets back.
 *
 * The single place a session is minted from a successful sign-in **among the
 * registry methods**. It was never true of the password route, which predates
 * this and mints its own — the audit measured that on production 2026-07-29 and
 * found the second factor completely unenforced there. Both now call
 * `signPending`, so the shape of the half-finished sign-in has one definition
 * even though the two paths still have their own storage deps.
 */
export async function finishSignIn(deps, user, { key, nowMs, method, record = true } = {}) {
  if (secondFactorRequired(user)) {
    return json({ pending: await signPending(key, user.id, { nowMs }), need: "totp", user: { id: user.id, email: user.email } });
  }
  await deps.touchLogin?.(user.id).catch?.(() => {});
  // Name the device, so the member can find this session in their list and drop
  // it without signing every other one out. Recorded BEFORE the token is handed
  // back but best-effort: a failed write must not fail a correct sign-in, and
  // `sessionUsable` treats a sid with no row as live precisely so it cannot.
  const sid = newSessionId();
  try { await deps.startSession?.(user.id, sid); }
  catch (e) { console.error("session record failed:", (e && e.message) || e); }
  // The audit row is written HERE, next to the token, for the same reason the
  // second-factor check is: this is the one place a registry method turns into a
  // session, so a method cannot be added later that signs somebody in without
  // leaving a trace. `record:false` is for the OAuth callback alone, which knows
  // something this function cannot — whether the account was just CREATED — and
  // writes the better row itself.
  if (record) {
    try {
      const p = deps.audit?.({ kind: "login", userId: user.id, email: user.email, sid, meta: { method: method || undefined } });
      if (p && p.catch) p.catch(() => {});
    } catch (e) { console.error("audit failed:", (e && e.message) || e); }
  }
  return json({
    token: await signToken(key, { sub: String(user.id), email: user.email, ep: Number(user.token_epoch || 0), sid }, { nowMs }),
    user: { id: user.id, email: user.email },
  });
}

/**
 * deps (all injected; see worker.js for the real ones):
 *   siteConfig()            → {oauth:{…}, mailer:bool, passkeys:bool}
 *   putCode(kind, subject, code, expiresAt)  store a single-use secret
 *   takeCode(kind, subject) → row | null     READS the newest live one; does not consume
 *   spendCode(id) · bumpAttempt(id)          consume it, or count a failed try
 *   addCredential(userId, cred) · credentialById(credId) · credentialsFor(userId)
 *   deleteCredential(userId, id) · touchCredential(id, signCount)
 *   findIdentity · findUserById · findUserByEmail · createUser · linkIdentity
 *   setTotp(userId, {secret, enabled, lastStep, recovery}) · setPassword · touchLogin
 *   signupAllowed()         → bool
 *   sendCode(email, code)   → void
 *   throttle(key)           → {ok}
 *   exchange · fetchProfile → the OAuth network calls
 */
export async function handleAuthFlow(deps, { slug, route, body = {}, query = {}, token, key, nowMs, origin } = {}) {
  const now = nowMs == null ? Date.now() : nowMs;
  const site = await deps.siteConfig();
  // Write it down. Same contract as the one in site-auth-routes.mjs — never
  // awaited into the response, never able to fail it — and deliberately the
  // same shape, because these two files are the two halves of one auth surface
  // and a log that covers only one of them answers half the question.
  const rec = (kind, event) => {
    if (!deps.audit) return;
    try { const p = deps.audit({ kind, ...event }); if (p && p.catch) p.catch(() => {}); }
    catch (e) { console.error("audit failed:", slug, (e && e.message) || e); }
  };
  const expiresAt = (sec) => new Date(now + sec * 1000).toISOString();

  // Who is asking, when the route needs a live session. Same four checks the
  // rest of the auth surface uses.
  const signedIn = async () => {
    const claims = await verifyToken(key, token, { nowMs: now });
    if (!claims || (claims.use !== undefined && claims.use !== "session")) return null;
    // The sid rides along on the lookup rather than costing a second statement;
    // the dep joins `_sessions` and sets `session_revoked`. See SESSION_JOIN.
    const user = await deps.findUserById(claims.sub, claims.sid);
    if (!user || user.blocked) return null;
    if (Number(claims.ep || 0) !== Number(user.token_epoch || 0)) return null;
    // A revoked device is refused everywhere a session is, not just on the data
    // path — otherwise the tablet somebody just signed out could still add a
    // passkey to the account.
    if (claims.sid && user.session_revoked) return null;
    return user;
  };

  // ------------------------------------------------------------- what's offered
  if (route === "methods") return json({ methods: availableMethods(site) });

  // ------------------------------------------------------------- passkeys
  if (route === "passkey/register/start") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    const challenge = newChallenge();
    await deps.putCode("passkey-reg", String(user.id), challenge, expiresAt(CHALLENGE_TTL_SEC));
    const existing = await deps.credentialsFor(user.id);
    return json({
      challenge,
      rp: { id: deps.rpId, name: site.name || slug },
      user: { id: b64u(new TextEncoder().encode(String(user.id))), name: user.email || String(user.id), displayName: user.email || "Member" },
      // So the browser refuses to enrol a key this account already has, rather
      // than silently creating a duplicate that shadows the first.
      excludeCredentials: existing.map((c) => ({ id: c.cred_id, type: "public-key" })),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    });
  }

  if (route === "passkey/register/finish") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    const stored = await deps.takeCode("passkey-reg", String(user.id));
    if (!stored || stored.expires_at <= new Date(now).toISOString()) {
      return json({ error: "That took too long — try again.", code: "challenge" }, 400);
    }
    // Spent before it is used, not after: a challenge that survives a failed
    // ceremony is a challenge that can be retried against forever.
    await deps.spendCode(stored.id);
    const r = await verifyRegistration({
      response: body.response, expectedChallenge: stored.code,
      expectedOrigin: origin, expectedRpId: deps.rpId,
    });
    if (!r.ok) return json({ error: r.error, code: r.reason }, 400);
    rec("passkey_add", { userId: user.id, email: user.email, meta: { label: String(body.label || "").slice(0, 60) || undefined } });
    await deps.addCredential(user.id, {
      cred_id: r.credentialId,
      public_key: JSON.stringify(r.publicKeyJwk),
      alg: r.alg,
      sign_count: r.signCount,
      label: String(body.label || "").slice(0, 60) || null,
    });
    return json({ ok: true, credentialId: r.credentialId });
  }

  if (route === "passkey/login/start") {
    // No account is named: a discoverable credential tells us who they are. The
    // challenge is stored under itself, so it can be spent exactly once.
    const challenge = newChallenge();
    await deps.putCode("passkey-login", challenge, challenge, expiresAt(CHALLENGE_TTL_SEC));
    return json({ challenge, rpId: deps.rpId });
  }

  if (route === "passkey/login/finish") {
    const given = String(body.challenge || "");
    const stored = await deps.takeCode("passkey-login", given);
    // Single use. Without spending it, one captured assertion signs in forever.
    if (!stored || stored.code !== given || stored.expires_at <= new Date(now).toISOString()) {
      return json({ error: "That took too long — try again.", code: "challenge" }, 400);
    }
    await deps.spendCode(stored.id);
    const cred = await deps.credentialById(String(body.credentialId || ""));
    if (!cred) { rec("login_failed", { meta: { method: "passkey", reason: "unknown" } }); return json({ error: "That passkey isn't registered here.", code: "unknown" }, 401); }
    const user = await deps.findUserById(cred.user_id);
    if (!user || user.blocked) return json({ error: "That passkey didn't work.", code: "unknown" }, 401);

    const r = await verifyAssertion({
      response: body.response, expectedChallenge: given,
      expectedOrigin: origin, expectedRpId: deps.rpId,
      credential: { publicKeyJwk: JSON.parse(cred.public_key), alg: cred.alg, signCount: cred.sign_count || 0 },
    });
    if (!r.ok) return json({ error: r.error, code: r.reason }, 401);
    // A counter going backwards means the private key was copied off the
    // authenticator. Refuse and say so — this is the one case where a vague
    // message would leave somebody signed in on a cloned key.
    if (r.cloned) {
      // The one passkey failure that is never a mistake: a counter going
      // backwards means the private key was copied off the authenticator.
      rec("login_failed", { userId: user.id, email: user.email, meta: { method: "passkey", reason: "cloned" } });
      return json({ error: "That passkey looks cloned — remove it and register a new one.", code: "cloned" }, 401);
    }
    await deps.touchCredential(cred.id, r.signCount);
    return finishSignIn(deps, user, { key, nowMs: now, method: "passkey" });
  }

  // ------------------------------------------------------------- emailed codes
  if (route === "code/request") {
    const email = normalizeEmail(body.email);
    const t = await deps.throttle(`code:${slug}:${email || "?"}`);
    // Always 200, throttled or not, account or not — the same rule the password
    // reset follows, and for the same reason.
    if (!t.ok || !email) return json({ ok: true });
    const user = await deps.findUserByEmail(email);
    if (user && !user.blocked) {
      const code = newEmailCode();
      await deps.putCode("email-code", email, code, expiresAt(EMAIL_CODE_TTL_SEC));
      try { await deps.sendCode(email, code); } catch { /* a dark mailer must not be an oracle */ }
    }
    return json({ ok: true });
  }

  if (route === "code/verify") {
    const email = normalizeEmail(body.email);
    const t = await deps.throttle(`codev:${slug}:${email || "?"}`);
    if (!t.ok) return json({ error: "Too many attempts — try again shortly." }, 429);
    if (!email) return json({ error: "That code didn't work." }, 401);
    const stored = await deps.takeCode("email-code", email);
    // Six digits is a million possibilities, which is nothing without a cap on
    // attempts — the cap, not the length, is what makes this safe.
    if (!stored || stored.attempts >= EMAIL_CODE_ATTEMPTS || stored.expires_at <= new Date(now).toISOString()) {
      return json({ error: "That code didn't work." }, 401);
    }
    if (!codeMatches(body.code, stored.code)) {
      await deps.bumpAttempt(stored.id);
      return json({ error: "That code didn't work." }, 401);
    }
    const user = await deps.findUserByEmail(email);
    if (!user || user.blocked) return json({ error: "That code didn't work." }, 401);
    await deps.spendCode(stored.id);
    return finishSignIn(deps, user, { key, nowMs: now, method: "email-code" });
  }

  // ------------------------------------------------------------- OAuth
  if (/^oauth\/[a-z]+\/start$/.test(route)) {
    const provider = route.split("/")[1];
    const r = await startOAuth(
      {
        // `sub` is required by verifyToken — it is what stops an empty payload
        // being a valid token — and a state has no person, so the provider is
        // its subject. `p` still carries the pin that completeOAuth checks.
        signState: (p) => signToken(key, { ...p, sub: "oauth:" + provider, use: "oauth" }, { nowMs: now, ttlSec: CHALLENGE_TTL_SEC }),
      },
      { provider, siteConfig: site.oauth || {}, origin, slug, next: query.next },
    );
    if (r.error) return json({ error: r.error, code: r.reason }, r.status);
    return json({ redirect: r.url }, 302);
  }

  if (/^oauth\/[a-z]+\/callback$/.test(route)) {
    const provider = route.split("/")[1];
    const r = await completeOAuth({
      verifyState: async (t) => {
        const c = await verifyToken(key, t, { nowMs: now });
        // The state is its own kind. Without checking `use`, a session token
        // would be accepted as state and vice versa.
        return c && c.use === "oauth" ? c : null;
      },
      exchange: deps.exchange,
      fetchProfile: deps.fetchProfile,
    }, { provider, code: query.code || body.code, state: query.state || body.state, siteConfig: site.oauth || {}, origin, slug });
    if (r.error) return json({ error: r.error, code: r.reason }, r.status);

    const outcome = await resolveIdentity({
      findIdentity: deps.findIdentity,
      findUserById: deps.findUserById,
      findUserByEmail: deps.findUserByEmail,
      createUser: deps.createUser,
      linkIdentity: deps.linkIdentity,
    }, { provider, profile: r.profile, allowSignup: await deps.signupAllowed() });
    if (outcome.error) return json({ error: outcome.error, code: outcome.reason }, outcome.status);

    // `record:false` — the callback below writes signup-or-login itself.
    const done = await finishSignIn(deps, outcome.user, { key, nowMs: now, record: false });
    done.body.next = r.next;
    done.body.action = outcome.action;
    // `action` is "created" or "linked" from resolveIdentity — a first sign-in
    // through a provider IS a signup, and recording it as a login would leave
    // the account with no origin in the log.
    // Three outcomes, three different things to have happened: a new account,
    // a provider attached to an account that already existed, or an ordinary
    // sign-in. Collapsing them would hide the middle one, which is the only
    // one that changes how an account can be entered.
    const linked = outcome.action === "linked";
    rec(outcome.action === "created" ? "signup" : (linked ? "oauth_link" : "login"),
      { userId: outcome.user && outcome.user.id, email: outcome.user && outcome.user.email, meta: { method: provider, provider } });
    // A link is also a sign-in — the session was minted either way, and an
    // owner asking "when did they last get in" must not miss it.
    if (linked) rec("login", { userId: outcome.user && outcome.user.id, email: outcome.user && outcome.user.email, meta: { method: provider, provider } });
    return done;
  }

  // ------------------------------------------------------------- TOTP
  if (route === "totp/start") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    const secret = newTotpSecret();
    // Stored but NOT enabled: an account is not protected by a factor its owner
    // has not proved they can produce, or the next sign-in locks them out.
    await deps.setTotp(user.id, { secret, enabled: 0 });
    return json({ secret, uri: totpUri({ secret, account: user.email || String(user.id), issuer: site.name || slug }) });
  }

  if (route === "totp/enable") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    if (!user.totp_secret) return json({ error: "Start again — nothing to confirm.", code: "no_secret" }, 400);
    const step = await verifyTotp(user.totp_secret, body.code, { nowMs: now });
    if (step == null) return json({ error: "That code didn't match.", code: "totp" }, 401);
    const recovery = newRecoveryCodes();
    const hashes = await Promise.all(recovery.map((c) => hashPassword(normalizeRecovery(c))));
    rec("totp_on", { userId: user.id, email: user.email });
    await deps.setTotp(user.id, { secret: user.totp_secret, enabled: 1, lastStep: step, recovery: JSON.stringify(hashes) });
    // Shown exactly once. They are passwords, so they are stored hashed and
    // cannot be shown again.
    return json({ ok: true, recovery });
  }

  if (route === "totp/verify") {
    // Presenting the second factor, holding the pending token from a primary.
    const claims = await verifyToken(key, token, { nowMs: now });
    if (!claims || claims.use !== "2fa") return json({ error: "Start again." }, 401);
    const t = await deps.throttle(`totp:${slug}:${claims.sub}`);
    if (!t.ok) return json({ error: "Too many attempts — try again shortly." }, 429);
    const user = await deps.findUserById(claims.sub);
    if (!user || user.blocked) return json({ error: "Start again." }, 401);

    const step = await verifyTotp(user.totp_secret, body.code, { nowMs: now, lastStep: user.totp_last_step });
    if (step != null) {
      await deps.setTotp(user.id, { secret: user.totp_secret, enabled: 1, lastStep: step });
      rec("2fa_ok", { userId: user.id, email: user.email, meta: { method: "totp" } });
      await deps.touchLogin?.(user.id).catch?.(() => {});
      return json({
        token: await signToken(key, { sub: String(user.id), email: user.email, ep: Number(user.token_epoch || 0) }, { nowMs: now }),
        user: { id: user.id, email: user.email },
      });
    }

    // A recovery code, for when the phone is gone. Single use: spent whether or
    // not anything else goes right afterwards.
    const given = normalizeRecovery(body.code);
    if (given && user.recovery_hashes) {
      let hashes = [];
      try { hashes = JSON.parse(user.recovery_hashes) || []; } catch { hashes = []; }
      for (let i = 0; i < hashes.length; i++) {
        if (await verifyPassword(given, hashes[i])) {
          hashes.splice(i, 1);
          await deps.setTotp(user.id, { secret: user.totp_secret, enabled: 1, lastStep: user.totp_last_step, recovery: JSON.stringify(hashes) });
          // How many are LEFT is the useful half: an owner seeing this drop
          // toward zero is watching somebody lose access to their phone.
          rec("recovery_used", { userId: user.id, email: user.email, meta: { left: hashes.length } });
          await deps.touchLogin?.(user.id).catch?.(() => {});
          return json({
            token: await signToken(key, { sub: String(user.id), email: user.email, ep: Number(user.token_epoch || 0) }, { nowMs: now }),
            user: { id: user.id, email: user.email },
            recoveryUsed: true, recoveryLeft: hashes.length,
          });
        }
      }
    }
    // Reached only when neither the app nor a recovery code matched — which,
    // on an account whose password was already accepted, is the alarming one.
    rec("2fa_failed", { userId: user.id, email: user.email, meta: { method: "totp" } });
    return json({ error: "That code didn't match.", code: "totp" }, 401);
  }

  if (route === "totp/disable") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    // The password, because turning a factor OFF is exactly what somebody with a
    // stolen session would want to do first.
    const full = await deps.findUserByEmail(user.email);
    const ok = await verifyPassword(typeof body.current === "string" ? body.current : "", (full && full.password_hash) || "pbkdf2$1000$AA$AA");
    if (!ok) return json({ error: "That password doesn't match.", code: "current" }, 401);
    rec("totp_off", { userId: user.id, email: user.email });
    await deps.setTotp(user.id, { secret: null, enabled: 0, lastStep: null, recovery: null });
    return json({ ok: true });
  }

  if (route === "recovery/new") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    if (!user.totp_enabled) return json({ error: "Turn on an authenticator app first.", code: "no_totp" }, 400);
    const recovery = newRecoveryCodes();
    const hashes = await Promise.all(recovery.map((c) => hashPassword(normalizeRecovery(c))));
    // Replaces the old set entirely: regenerating must invalidate codes that may
    // be on a piece of paper somebody else now has.
    await deps.setTotp(user.id, { secret: user.totp_secret, enabled: 1, lastStep: user.totp_last_step, recovery: JSON.stringify(hashes) });
    return json({ ok: true, recovery });
  }

  // ------------------------------------------------------------- verification
  if (route === "verify/request") {
    // A session is required, so there is no address to enumerate and nothing to
    // answer vaguely — you can only ask for your own link.
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    if (!user.email) return json({ error: "This account has no email address.", code: "no_email" }, 400);
    if (user.verified) return json({ ok: true, already: true });
    const t = await deps.throttle(`verify:${slug}:${user.id}`);
    if (!t.ok) return json({ error: "Too many attempts — try again shortly." }, 429);
    // Never let a dark or failing mailer turn into an error the person can do
    // nothing about; they are already signed in and can ask again.
    try { await deps.sendVerify(user.email, await signVerify(key, String(user.id), { nowMs: now })); }
    catch (e) { console.error("verify send failed:", slug, (e && e.message) || e); }
    return json({ ok: true, sent: true });
  }

  if (route === "verify/confirm") {
    const claims = await verifyVerification(key, body.token || query.token, { nowMs: now });
    // One message for expired, forged and wrong-kind. Distinguishing them tells
    // somebody holding a stale link which half of it failed.
    if (!claims) return json({ error: "This link is invalid or has expired.", code: "token" }, 400);
    const user = await deps.findUserById(claims.sub);
    if (!user || user.blocked) return json({ error: "This link is invalid or has expired.", code: "token" }, 400);
    // Idempotent: a link opened twice, prefetched by a mail client, or clicked
    // again to check it worked must not read as a failure.
    // Only on the transition. A link opened twice is idempotent by design, and
    // logging both opens would put two "confirmed their address" rows on the
    // owner's page for one confirmation.
    if (!user.verified) { await deps.setVerified(user.id); rec("verified", { userId: user.id, email: user.email }); }
    return json({ ok: true, email: user.email });
  }

  // ------------------------------------------------------------- linked accounts
  if (route === "identities") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    const [identities, credentials] = await Promise.all([
      deps.identitiesFor(user.id),
      deps.credentialsFor(user.id),
    ]);
    return json({
      identities: identities.map((i) => ({ id: i.id, provider: i.provider, email: i.email, created_at: i.created_at })),
      passkeys: credentials.map((c) => ({ id: c.id, label: c.label, created_at: c.created_at, last_used_at: c.last_used_at })),
      hasPassword: !!user.has_password,
      totp: !!user.totp_enabled,
    });
  }

  // ------------------------------------------------------- disconnecting things
  //
  // `canUnlink` was written with the last-way-in rule and then called by nothing,
  // and `deleteCredential` was wired as a dep with no route: a member could add a
  // passkey and never remove one. A stolen laptop's passkey worked forever.
  if (route === "identities/unlink" || route === "passkey/remove") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);

    const [identities, credentials] = await Promise.all([
      deps.identitiesFor(user.id),
      deps.credentialsFor(user.id),
    ]);
    // Every way in counts as one, whichever kind is being removed — otherwise
    // dropping your only passkey while having no password locks you out of an
    // account that still exists and still owns rows, with no recovery path,
    // because the reset flow needs an address you may never have given us.
    const ways = identities.length + credentials.length;
    if (!canUnlink({ identities: new Array(ways), hasPassword: !!user.has_password })) {
      return json({ error: "That's your only way to sign in — add another first.", code: "last_method" }, 409);
    }

    if (route === "passkey/remove") {
      rec("passkey_remove", { userId: user.id, email: user.email });
      const r = await deps.deleteCredential(user.id, body.id);
      // Scoped to the caller AND answering 404 for somebody else's, so a member
      // cannot probe which credential ids exist by watching the status.
      if (!r || !r.changes) return json({ error: "no such passkey" }, 404);
      return json({ ok: true });
    }

    rec("oauth_unlink", { userId: user.id, email: user.email });
    const r = await deps.unlinkIdentity(user.id, body.id);
    if (!r || !r.changes) return json({ error: "no such connection" }, 404);
    return json({ ok: true });
  }

  // ------------------------------------------------------------- devices
  //
  // `logout-all` is all-or-nothing — it bumps the account's epoch, so signing
  // out one old tablet meant signing back in everywhere. And nothing could show
  // a member what their devices ARE, so the choice was made blind.
  if (route === "sessions") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    const claims = await verifyToken(key, token, { nowMs: now });
    const rows = await deps.sessionsFor(user.id, MAX_SESSIONS_LISTED);
    return json({ sessions: describeSessions(rows, claims && claims.sid, now) });
  }

  if (route === "sessions/revoke") {
    const user = await signedIn();
    if (!user) return json({ error: "not signed in" }, 401);
    const sid = normalizeSid(body.sid);
    if (!sid) return json({ error: "no such session" }, 404);

    // Scoped to the caller in the STATEMENT, not by having already read the
    // row — the sid is unguessable, but "hard to guess" is not an authorization
    // model, and the same shape here as `passkey/remove` means one reviewer's
    // rule covers both.
    const r = await deps.revokeSession(user.id, sid);
    if (r && r.changes) rec("session_revoke", { userId: user.id, email: user.email, sid });
    // Somebody else's session answers 404, identically to one that never
    // existed. A 403 would confirm the sid is real, which is the only thing a
    // stranger holding one could learn.
    if (!r || !r.changes) return json({ error: "no such session" }, 404);

    // Revoking the session you are reading from IS just logging out, and it
    // works — but the caller is told, because the alternative is a settings page
    // that appears to succeed and then 401s on its next request with no
    // explanation.
    const claims = await verifyToken(key, token, { nowMs: now });
    return json({ ok: true, self: !!(claims && claims.sid === sid) });
  }

  return json({ error: "not found" }, 404);
}
