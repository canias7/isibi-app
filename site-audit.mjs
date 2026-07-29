// The auth audit log: what happened to an account, and when.
//
// Everything the auth layer does is now correct and none of it is ACCOUNTABLE.
// A site owner cannot answer the question a person actually asks them — "did
// someone else get into my account?" — because nothing is written down. A
// suspension, a role grant, forty failed sign-ins overnight and a password
// change from a device in another country all leave the same trace: none.
//
// Pure. The clock, the storage and the hashing key are all arguments, so the
// decisions that matter — what is recorded, what is deliberately NOT recorded,
// and how long it is kept — are driven directly in test/site-audit.test.mjs.
//
// ---------------------------------------------------------------------------
// WHAT THIS DELIBERATELY DOES NOT STORE
//
// An audit log is a security feature that becomes a liability the moment it
// records more than it needs. Three rules, all enforced here rather than left
// to the caller:
//
//   1. Never a password, a token, a hash, a code or a secret. `meta` is SHAPED
//      by this module — a small allow-list of scalar fields — rather than
//      passed through, so a caller cannot widen it by accident. The single
//      worst version of this feature is one that logs the password somebody
//      typed into the wrong box.
//
//   2. A NON-MEMBER's address is fingerprinted, never stored. The owner's real
//      need on a failed sign-in is "the same unknown address tried forty
//      times", which a stable fingerprint answers completely. Storing the
//      address itself would quietly turn every mistyped login into a contact
//      list: somebody who meant to sign in to another site hands this owner
//      their email, and they never had an account here to consent with.
//      A MEMBER's address is stored plainly — the owner already has it on the
//      member list, so withholding it costs legibility and buys nothing.
//
//   3. An IP is truncated before it is written — /24 for v4, /48 for v6. That
//      is enough to say "these forty attempts came from one place" and not
//      enough to point at a person's house.
//
// The point of putting these here, in the shaping function, is that they hold
// for every call site including ones written later. A rule that lives in the
// caller is a rule the next caller does not know about.

/**
 * Every kind of event, and nothing else.
 *
 * A closed set on purpose. A typo'd kind is not a new category quietly invented
 * at a call site — it is a row the owner's filters would never show and nobody
 * would notice was missing, which is the failure mode of every log that grew
 * its vocabulary by accident.
 */
export const AUDIT_KINDS = [
  // getting in
  "signup", "signup_refused", "login", "login_failed", "locked",
  "2fa_ok", "2fa_failed", "recovery_used",
  // the account itself
  "password_change", "reset_request", "reset_done", "email_change", "verified",
  // the ways in
  "totp_on", "totp_off", "passkey_add", "passkey_remove", "oauth_link", "oauth_unlink",
  // devices
  "session_revoke", "signout_all",
  // what the OWNER did — the half a member cannot see and most needs recorded
  "role_change", "suspend", "unsuspend", "team_change", "member_delete", "invite_mint",
];

const KINDS = new Set(AUDIT_KINDS);

/** Kinds that mean somebody failed to get in. The owner's headline number. */
export const FAILURE_KINDS = ["login_failed", "2fa_failed", "signup_refused", "locked"];
const FAILURES = new Set(FAILURE_KINDS);

/** Kinds only the site owner can cause. Shown apart: they answer a different question. */
export const OWNER_KINDS = ["role_change", "suspend", "unsuspend", "team_change", "member_delete", "invite_mint"];
const OWNER = new Set(OWNER_KINDS);

export function normalizeKind(kind) {
  const k = String(kind == null ? "" : kind).trim().toLowerCase();
  return KINDS.has(k) ? k : null;
}

export const isFailure = (kind) => FAILURES.has(normalizeKind(kind));
export const isOwnerAction = (kind) => OWNER.has(normalizeKind(kind));

// ------------------------------------------------------------- what is kept

/** How long a row lives. Long enough to investigate, short enough not to hoard. */
export const AUDIT_RETENTION_DAYS = 90;
/** A hard ceiling per site, so one hammered login cannot grow the table forever. */
export const AUDIT_MAX_ROWS = 5000;
/** How many the owner's view returns at once. */
export const AUDIT_PAGE = 100;

/**
 * The epoch second before which rows may be deleted.
 *
 * Returns 0 for a nonsense retention, and 0 means PRUNE NOTHING — the same
 * direction `pruneBefore` in site-sessions.mjs chose, and for the same reason:
 * a misconfigured number must not silently empty the log somebody is relying on
 * to investigate an incident. Deleting too little is a storage cost; deleting
 * too much destroys the only record that the thing happened.
 */
export function pruneBefore(retentionDays = AUDIT_RETENTION_DAYS, nowMs) {
  const d = Number(retentionDays);
  if (!Number.isFinite(d) || d <= 0) return 0;
  const now = Math.floor((nowMs == null ? Date.now() : nowMs) / 1000);
  return now - Math.floor(d) * 86400;
}

// ------------------------------------------------------------- the shaping

const enc = new TextEncoder();

/**
 * A stable, per-site fingerprint of an address that has no account here.
 *
 * HMAC with the site's own key, truncated. Per-site because a fingerprint
 * shared across sites would let two owners compare notes and confirm the same
 * person tried both — which is exactly the linkage not storing the address was
 * meant to prevent.
 *
 * Truncated to 12 hex characters: enough that two different addresses
 * colliding is a curiosity rather than a problem, short enough to read in a
 * table. It is not a secret and does not need to resist a determined offline
 * attack — the address space is enumerable either way. What it defends against
 * is the log BEING a contact list, and it does that completely.
 */
export async function addressFingerprint(key, email) {
  const e = String(email == null ? "" : email).trim().toLowerCase();
  if (!e || !key) return null;
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("audit-who|" + e));
  return [...new Uint8Array(sig)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * An IP reduced to the block it came from.
 *
 * /24 for v4 and /48 for v6 — the granularity that answers "one source or
 * forty" without answering "which building". Anything unparseable returns null
 * rather than being stored as-is: a value this function does not understand is
 * exactly the value most likely to be something it should not be keeping.
 */
export function truncateIp(ip) {
  const s = String(ip == null ? "" : ip).trim();
  if (!s) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    const p = s.split(".");
    if (p.some((n) => Number(n) > 255)) return null;
    return p[0] + "." + p[1] + "." + p[2] + ".0/24";
  }
  if (s.includes(":") && /^[0-9a-fA-F:]+$/.test(s)) {
    const groups = s.toLowerCase().split(":").filter(Boolean);
    if (groups.length < 3) return null;
    return groups.slice(0, 3).join(":") + "::/48";
  }
  return null;
}

/**
 * The only fields `meta` may carry, and the only types they may be.
 *
 * An allow-list rather than a filter, because the interesting failure is the
 * one nobody thought of: a caller passing the whole request body "for context"
 * and putting a password in the audit log forever. Nothing gets in unless it is
 * named here, and every value is coerced to a short scalar.
 */
const META_FIELDS = ["method", "reason", "provider", "role", "team", "label", "count", "left", "target"];

export function shapeMeta(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const out = {};
  for (const f of META_FIELDS) {
    const v = meta[f];
    if (v === undefined || v === null) continue;
    if (typeof v === "number") { if (Number.isFinite(v)) out[f] = v; continue; }
    if (typeof v === "boolean") { out[f] = v; continue; }
    if (typeof v === "string") { const s = v.trim().slice(0, 60); if (s) out[f] = s; continue; }
    // Anything else — an object, an array, a function — is dropped. Stringifying
    // it is how a body ends up in here.
  }
  return Object.keys(out).length ? out : null;
}

/**
 * One event, shaped for storage. Returns null when there is nothing to write.
 *
 * `member` is what decides whether the address is kept or fingerprinted, and it
 * means "this address belongs to an account on this site", NOT "this attempt
 * succeeded". A failed password against a real member is still a member event —
 * withholding the address there would hide the most useful row in the log, the
 * one that says which of the owner's own customers is being targeted.
 */
export async function auditRow(event = {}, { nowMs, key } = {}) {
  const kind = normalizeKind(event.kind);
  if (!kind) return null;
  const member = !!event.userId || !!event.member;
  const email = member ? (String(event.email || "").trim().toLowerCase().slice(0, 254) || null) : null;
  return {
    at: Math.floor((nowMs == null ? Date.now() : nowMs) / 1000),
    kind,
    // Defaults to a success. Only the kinds that ARE failures say otherwise, so
    // a caller cannot mark a login_failed as ok and hide it from the count.
    ok: isFailure(kind) ? 0 : (event.ok === false ? 0 : 1),
    user_id: Number.isInteger(Number(event.userId)) && Number(event.userId) > 0 ? Number(event.userId) : null,
    email,
    // Only for somebody who is NOT a member. A member has their address on the
    // row already, and writing both would make the fingerprint a lookup table
    // from fingerprint to address for every member on the site.
    who: member ? null : await addressFingerprint(key, event.email),
    ip: truncateIp(event.ip),
    country: event.country ? String(event.country).slice(0, 2).toLowerCase() : null,
    ua: event.ua ? String(event.ua).slice(0, 200) : null,
    sid: event.sid ? String(event.sid).slice(0, 64) : null,
    meta: shapeMeta(event.meta),
  };
}

// ------------------------------------------------------------- the DDL

/**
 * Created by `ensureSiteUsers`, not by the method registry's DDL.
 *
 * That distinction cost a production outage once already: `_sessions` is read on
 * every authenticated request, and creating it only on the routes the registry
 * owns meant it existed on sites where somebody happened to use a passkey and
 * nowhere else. This table is WRITTEN by plain password login, so it has to be
 * created by the function the password path calls.
 */
export const AUDIT_DDL = [
  `CREATE TABLE IF NOT EXISTS _auth_events (
     id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
     at BIGINT NOT NULL,
     kind TEXT NOT NULL,
     ok INTEGER DEFAULT 1,
     user_id INTEGER,
     email TEXT,
     who TEXT,
     ip TEXT,
     country TEXT,
     ua TEXT,
     sid TEXT,
     meta TEXT)`,
  // The owner's view is "newest first", and the investigation view is "newest
  // first for this member". Both are the index below.
  `CREATE INDEX IF NOT EXISTS _auth_events_at ON _auth_events (at DESC)`,
  `CREATE INDEX IF NOT EXISTS _auth_events_user ON _auth_events (user_id, at DESC)`,
];

// ------------------------------------------------------------- reading it

const AGO = [[86400, "day"], [3600, "hour"], [60, "minute"]];

/** "3 hours ago". Never null — a row with no stamp still has to render. */
export function agoLabel(ageSec) {
  const a = Number(ageSec);
  if (!Number.isFinite(a) || a < 0) return "just now";
  for (const [unit, name] of AGO) {
    if (a >= unit) { const n = Math.floor(a / unit); return n + " " + name + (n === 1 ? "" : "s") + " ago"; }
  }
  return "just now";
}

/** What each kind means, in the words an owner would use. */
const WORDS = {
  signup: "created an account", signup_refused: "was refused an account",
  login: "signed in", login_failed: "failed to sign in", locked: "was slowed down after repeated failures",
  "2fa_ok": "passed the second factor", "2fa_failed": "failed the second factor",
  recovery_used: "used a recovery code",
  password_change: "changed their password", reset_request: "asked for a password reset",
  reset_done: "reset their password", email_change: "changed their address", verified: "confirmed their address",
  totp_on: "turned on an authenticator app", totp_off: "turned off their authenticator app",
  passkey_add: "added a passkey", passkey_remove: "removed a passkey",
  oauth_link: "connected a provider", oauth_unlink: "disconnected a provider",
  session_revoke: "signed out a device", signout_all: "signed out every device",
  role_change: "had their role changed", suspend: "was suspended", unsuspend: "was reinstated",
  team_change: "was moved between teams", member_delete: "was deleted", invite_mint: "an invite code was created",
};

/**
 * Rows as the owner reads them.
 *
 * `who` is rendered as a short tag rather than raw hex, because an owner
 * skimming a list needs "the same unknown person, again" to be obvious at a
 * glance and a 12-character hash is not.
 */
export function describeEvents(rows, nowMs) {
  const now = Math.floor((nowMs == null ? Date.now() : nowMs) / 1000);
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && normalizeKind(r.kind))
    .map((r) => {
      const kind = normalizeKind(r.kind);
      const at = Number(r.at) || 0;
      let meta = null;
      if (r.meta) { try { meta = typeof r.meta === "string" ? JSON.parse(r.meta) : r.meta; } catch { meta = null; } }
      return {
        id: r.id == null ? null : Number(r.id),
        at,
        ago: agoLabel(now - at),
        kind,
        what: WORDS[kind] || kind,
        ok: !(Number(r.ok) === 0),
        failure: isFailure(kind),
        owner: isOwnerAction(kind),
        userId: r.user_id == null ? null : Number(r.user_id),
        // One or the other, never both — see auditRow.
        email: r.email || null,
        who: r.who ? "unknown·" + String(r.who).slice(0, 6) : null,
        ip: r.ip || null,
        country: r.country || null,
        device: r.ua || null,
        meta: shapeMeta(meta),
      };
    });
}

/**
 * The headline, because a wall of rows answers nothing.
 *
 * What an owner opening this page wants to know in one line is whether they are
 * being attacked right now, and by how many distinct sources — a single address
 * failing forty times is somebody who forgot their password, and forty sources
 * failing once each is not.
 */
export function summarize(rows, { nowMs, windowSec = 86400 } = {}) {
  const now = Math.floor((nowMs == null ? Date.now() : nowMs) / 1000);
  const since = now - windowSec;
  const recent = (Array.isArray(rows) ? rows : []).filter((r) => r && Number(r.at) >= since && normalizeKind(r.kind));
  const failures = recent.filter((r) => isFailure(r.kind));
  const sources = new Set();
  for (const r of failures) {
    // Fingerprint first, then the member address, then the network block: the
    // most specific thing available, so two attempts are only "the same source"
    // when something actually ties them together.
    sources.add(r.who || r.email || r.ip || "?");
  }
  const targets = new Set(failures.filter((r) => r.user_id != null).map((r) => String(r.user_id)));
  return {
    windowSec,
    events: recent.length,
    failures: failures.length,
    // How many distinct places those failures came from. The number that turns
    // "40 failures" from alarming into ordinary, or the reverse.
    sources: sources.size,
    // How many of the owner's OWN members were the target. Zero means somebody
    // is guessing addresses; more than zero means they have a real one.
    membersTargeted: targets.size,
    signIns: recent.filter((r) => normalizeKind(r.kind) === "login").length,
    ownerActions: recent.filter((r) => isOwnerAction(r.kind)).length,
  };
}
