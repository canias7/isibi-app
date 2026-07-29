// One person, several ways to prove it.
//
// A site's members could sign in exactly one way: email and password. Adding
// Google, a passkey, a magic link and an authenticator app does not add four
// features — it adds ONE question, asked four times: *is the person holding this
// new credential the same person who already has an account here?*
//
// Getting that wrong is the classic OAuth account takeover, and it is silent:
//
//   1. victim@example.com signs up here with a password.
//   2. Attacker creates a GitHub account, sets its email to victim@example.com,
//      and does not verify it.
//   3. Attacker clicks "Continue with GitHub" on this site.
//   4. A naive implementation matches on the email string, links the identity to
//      the victim's account, and signs the attacker in as the victim.
//
// Every rule below exists to close some version of that. The load-bearing one:
// **an identity is only ever linked to an existing account when the PROVIDER
// asserts the address is verified.** GitHub will hand you unverified addresses;
// Google gives `email_verified`, which is sometimes false. Trusting the string
// alone is the whole bug.
//
// Policy only. Storage is injected, so all of it runs against fakes.

/** How an identity is stored: one row per (provider, subject). */
export const IDENTITY_PROVIDERS = [
  "password", "google", "apple", "microsoft", "github", "discord", "slack", "oidc", "passkey", "email",
];

export function normalizeProvider(p) {
  const v = String(p == null ? "" : p).trim().toLowerCase();
  return IDENTITY_PROVIDERS.includes(v) ? v : null;
}

/**
 * The provider's own stable id for this person.
 *
 * NEVER the email — an address can be given up and reissued, and on some
 * providers changed at will, so keying on it means an account can be inherited
 * by whoever gets the address next. Google calls this `sub`, GitHub `id`,
 * Slack `user.id`. Bounded because it reaches a UNIQUE index.
 */
export function normalizeSubject(sub) {
  const s = String(sub == null ? "" : sub).trim();
  if (!s || s.length > 255) return null;
  return s;
}

/**
 * What a provider told us about the person, reduced to what we will act on.
 *
 * `emailVerified` defaults to FALSE for anything that did not explicitly say
 * true. A provider that omits the claim has not asserted it, and the safe
 * reading of silence is "no".
 */
export function normalizeProfile(raw = {}) {
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  return {
    subject: normalizeSubject(raw.subject ?? raw.sub ?? raw.id),
    email: /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) ? email : null,
    emailVerified: raw.emailVerified === true || raw.email_verified === true,
    name: typeof raw.name === "string" ? raw.name.slice(0, 120) : null,
  };
}

/**
 * Decide what a sign-in with an external identity means.
 *
 * deps:
 *   findIdentity(provider, subject) → {user_id} | null
 *   findUserByEmail(email)          → {id, email, blocked} | null
 *   createUser(email, name)         → {id, email}
 *   linkIdentity(provider, subject, userId, email) → void
 *
 * Returns {action, user} where action is "signed-in" | "linked" | "created",
 * or {error, status, reason}.
 */
export async function resolveIdentity(deps, { provider, profile, allowSignup = true } = {}) {
  const p = normalizeProvider(provider);
  if (!p || p === "password") return { error: "Unsupported sign-in method.", status: 400, reason: "provider" };

  const prof = normalizeProfile(profile || {});
  if (!prof.subject) return { error: "That sign-in didn't complete.", status: 400, reason: "subject" };

  // 1. Seen this exact identity before → it is simply theirs. No email involved,
  //    which is what makes a returning user immune to anything the provider
  //    later says about addresses.
  const existing = await deps.findIdentity(p, prof.subject);
  if (existing) {
    const user = await deps.findUserById(existing.user_id);
    if (!user) return { error: "That account no longer exists.", status: 401, reason: "gone" };
    if (user.blocked) return { error: "That sign-in didn't complete.", status: 401, reason: "blocked" };
    return { action: "signed-in", user };
  }

  // 2. A new identity. Linking it to an existing account is the dangerous step,
  //    and it is allowed on exactly one condition.
  if (prof.email) {
    const owner = await deps.findUserByEmail(prof.email);
    if (owner) {
      if (!prof.emailVerified) {
        // THE takeover. Refuse rather than link, and say what to do instead:
        // signing in with the password they already have, then linking from
        // inside the account, is safe because that proves both sides.
        return {
          error: "An account already uses that email. Sign in with your password first, then connect this.",
          status: 409,
          reason: "unverified_link",
        };
      }
      if (owner.blocked) return { error: "That sign-in didn't complete.", status: 401, reason: "blocked" };
      await deps.linkIdentity(p, prof.subject, owner.id, prof.email);
      return { action: "linked", user: owner };
    }
  }

  // 3. Nobody here yet. Whether that becomes an account is the site's call —
  //    an invite-only or closed site must not gain an open back door just
  //    because the person arrived via Google.
  if (!allowSignup) return { error: "This site isn't accepting new accounts.", status: 403, reason: "closed" };

  // An account with no address is legitimate: Slack and Discord may not release
  // one, and Apple's private relay can be withheld. They just cannot use the
  // password-reset flow until they add one.
  const user = await deps.createUser(prof.email, prof.name);
  if (!user || !user.id) return { error: "Could not create that account.", status: 500, reason: "create" };
  await deps.linkIdentity(p, prof.subject, user.id, prof.email);
  return { action: "created", user };
}

/**
 * May this identity be unlinked?
 *
 * Refused when it is the last way in. Somebody who signed up with Google, never
 * set a password and then disconnects Google has locked themselves out of an
 * account that still exists and still owns rows — and there is no recovery path,
 * because the reset flow needs an address they may never have given us.
 */
export function canUnlink({ identities = [], hasPassword = false } = {}) {
  const remaining = identities.length - 1 + (hasPassword ? 1 : 0);
  return remaining >= 1;
}
