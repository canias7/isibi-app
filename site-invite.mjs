// Who is allowed to become a member.
//
// Until now: anybody. Every site with a `user`, `feed` or `admin` table accepted
// open self-serve signup, so a stranger who found the URL could create an
// account on it. For a public members area that is correct and intended. For the
// thing a business owner actually asks the builder for — a members area for my
// customers, a tool for my team — it is not a missing feature, it is a hole,
// and it is the same hole on every site that has ever declared a member table.
//
// Three modes, and the default is the behaviour that already exists:
//
//   open    anyone may sign up. The default, and it stays the default — every
//           site built before today has no setting, and silently closing them
//           would break signups that work right now.
//   invite  a valid, unexhausted, unexpired code is required.
//   closed  nobody may sign up at all. The honest answer for "my team is
//           complete", and not the same as invite-with-no-codes: it says so.
//
// Policy only. The SQL that burns a code atomically lives in worker.js, because
// its correctness is a property of Postgres rather than of this file; everything
// that decides *whether* to burn is here, injected, and driven against fakes in
// test/site-invite.test.mjs.

/** No I and no O — those are the characters people mistype when reading aloud. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exactly 32, so 5 clean bits each
const CODE_LEN = 12; // 60 bits. Guessing is hopeless against the signup throttle.

export const SIGNUP_MODES = ["open", "invite", "closed"];

/**
 * Anything unrecognised becomes `open`.
 *
 * Deliberately NOT fail-closed, and this is the one place that direction is
 * right: this reads a stored setting, and a site whose row says something
 * unexpected should behave like the overwhelming majority that have no row at
 * all. Failing closed on a typo would lock a site's own customers out with no
 * way for the owner to tell why. The place that fails closed is the *read* — see
 * the caller: if the setting cannot be fetched at all, signup is refused.
 */
export function normalizeMode(value) {
  const v = String(value == null ? "" : value).trim().toLowerCase();
  return SIGNUP_MODES.includes(v) ? v : "open";
}

/**
 * A fresh code. `random` is injectable so tests are deterministic; production
 * passes nothing and gets crypto randomness.
 *
 * Formatted in groups because a human reads it off a screen and types it into a
 * phone. The groups are cosmetic — `normalizeCode` strips them — so nobody has
 * to be told whether the dashes matter.
 */
export function newInviteCode(random) {
  const bytes = random ? random(CODE_LEN) : crypto.getRandomValues(new Uint8Array(CODE_LEN));
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    // & 31 rather than % 32 for the same result with no modulo bias question:
    // the alphabet is exactly 32 long, so every 5-bit value maps to one letter.
    out += ALPHABET[bytes[i] & 31];
    if (i % 4 === 3 && i !== CODE_LEN - 1) out += "-";
  }
  return out;
}

/**
 * What a typed code means.
 *
 * Case and separators are thrown away, so `abcd efgh-jklm`, `ABCD-EFGH-JKLM` and
 * `abcdefghjklm` are one code. Returns null for anything that could not be one,
 * which keeps a malformed string from ever reaching the database as a lookup.
 */
export function normalizeCode(value) {
  const raw = String(value == null ? "" : value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== CODE_LEN) return null;
  for (const ch of raw) if (!ALPHABET.includes(ch)) return null;
  return raw;
}

/**
 * "Anyone at acme.com".
 *
 * The shape a team tool actually wants, and orthogonal to the three modes: an
 * owner may want an open site restricted to their company, or an invite-only one
 * ALSO restricted, so a leaked code cannot be used from a personal address.
 * Applied to every mode except `closed`, which already refuses everyone.
 *
 * Stored lowercase and without a leading @ or dot, so `@Acme.com`, `acme.com`
 * and `ACME.COM ` are one entry rather than three that behave differently.
 */
export const MAX_DOMAINS = 20;

export function normalizeDomain(value) {
  if (typeof value !== "string") return null;
  const d = value.trim().toLowerCase().replace(/^@+/, "").replace(/^\.+|\.+$/g, "");
  // A domain, not a pattern and not an address: no wildcards, because `*.com`
  // reads as a restriction and is not one.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
  if (d.length > 253) return null;
  return d;
}

export function normalizeDomains(list) {
  const out = [];
  for (const v of (Array.isArray(list) ? list : [])) {
    const d = normalizeDomain(v);
    if (d && !out.includes(d)) out.push(d);
    if (out.length >= MAX_DOMAINS) break;
  }
  return out;
}

/**
 * Is this address allowed in?
 *
 * An EMPTY list allows everything — the setting is opt-in, and a site that never
 * configured one must not suddenly refuse its own customers. Subdomains do NOT
 * match: `acme.com` does not admit `evil.acme.com.attacker.net`, and it does not
 * admit `mail.acme.com` either, which is the conservative reading and the one an
 * owner can correct by adding the entry they meant.
 */
export function domainAllowed(email, domains) {
  const list = Array.isArray(domains) ? domains : [];
  if (!list.length) return true;
  const at = String(email == null ? "" : email).toLowerCase().lastIndexOf("@");
  if (at < 0) return false;
  const domain = String(email).toLowerCase().slice(at + 1);
  return list.includes(domain);
}

/**
 * May this signup proceed?
 *
 * deps:
 *   mode()       → "open" | "invite" | "closed"   throws if it cannot be read
 *   burn(code)   → true | false                   ATOMIC: decrement-if-available
 *
 * Returns {ok:true, code} — `code` is what to hand back on failure — or
 * {error, status, reason}.
 */
export async function checkSignup(deps, { code, email } = {}) {
  let mode;
  try { mode = normalizeMode(await deps.mode()); }
  catch {
    // Fails CLOSED. An unreadable setting means we cannot tell whether this site
    // is open, and guessing "open" would let a transient database blip re-open a
    // site the owner deliberately shut. The same choice `assertOwner` makes.
    return { error: "Sign-ups are unavailable right now — try again in a moment.", status: 503, reason: "unavailable" };
  }

  if (mode === "closed") {
    return { error: "This site isn't accepting new accounts.", status: 403, reason: "closed" };
  }

  // Checked BEFORE a code is spent: an address that can never be admitted must
  // not consume somebody's invite on the way to being refused.
  let domains = [];
  try { domains = normalizeDomains(await (deps.domains ? deps.domains() : [])); } catch { domains = []; }
  if (!domainAllowed(email, domains)) {
    return { error: "That email address isn't allowed on this site.", status: 403, reason: "domain" };
  }

  if (mode !== "invite") return { ok: true, mode };

  const normalized = normalizeCode(code);
  // A malformed code and a wrong one get the same answer, and neither touches
  // the database.
  if (!normalized) return { error: "That invite code isn't valid.", status: 403, reason: "invite" };

  const burned = await deps.burn(normalized);
  // ONE message for "no such code", "already used up" and "expired". Telling
  // them apart would let somebody with a list of guesses learn which ones exist,
  // which is the whole value of a code.
  if (!burned) return { error: "That invite code isn't valid.", status: 403, reason: "invite" };

  // Handed back so the caller can give the use BACK if the signup then fails —
  // a duplicate email must not silently consume somebody's invite, which would
  // otherwise be a way to burn every use on a code you hold.
  return { ok: true, mode, burned: normalized };
}

/** How an owner's request to mint one is read. Clamped, never trusted. */
export const MAX_USES = 500;
export const MAX_DAYS = 365;
export function inviteOptions(body = {}) {
  const uses = parseInt(body.uses, 10);
  const days = parseInt(body.days, 10);
  return {
    uses: Number.isFinite(uses) && uses > 0 ? Math.min(uses, MAX_USES) : 1,
    // No expiry is allowed, and it is the default only because most invites are
    // handed out and used the same day. An owner who wants one that lasts says so.
    days: Number.isFinite(days) && days > 0 ? Math.min(days, MAX_DAYS) : 0,
    note: String(body.note == null ? "" : body.note).slice(0, 120),
  };
}
