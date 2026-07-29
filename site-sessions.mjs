// "Sign out my old phone."
//
// `logout-all` exists and is all-or-nothing: it bumps `_users.token_epoch`, so
// every session anywhere dies at once and the person has to sign in again on all
// their devices. That is the right primitive for "my laptop was stolen" and the
// wrong one for everything else — somebody who wants to drop one old tablet has
// to log back in on their phone, their desktop and their work machine to do it.
// And nothing could show them what those devices ARE, so the choice was made
// blind.
//
// The cost is real and worth stating plainly: sessions were STATELESS. A token
// carried everything needed to check it, and the only storage on the auth path
// was the `_users` row that the epoch check already required. Naming a session
// means keeping a row per session, which is a second thing to read.
//
// It is not a second ROUND TRIP, which is the part that would actually have hurt
// — see `SESSION_JOIN`. The check rides along on the `_users` read that every
// authenticated request already does.
//
// Everything here is pure. The SQL lives in worker.js; every decision that is
// wrong-in-a-way-nobody-notices lives here and is driven in
// test/site-sessions.test.mjs.

/**
 * The session id that goes in the token.
 *
 * 128 bits, and it does NOT have to be unguessable to be safe — a session is
 * authenticated by the HMAC over the whole token, so knowing a sid buys nothing
 * on its own. It is random anyway because the id is handed to the client to
 * revoke by, and a sequential integer there would be one more place a caller
 * could be tempted to skip the ownership check.
 */
export const SESSION_ID_BYTES = 16;

export function newSessionId(random) {
  const bytes = random ? random(SESSION_ID_BYTES) : crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTES));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Shape only — a sid off a request body is a string from a stranger. */
export function normalizeSid(value) {
  const s = String(value == null ? "" : value).trim();
  return /^[A-Za-z0-9_-]{16,64}$/.test(s) ? s : null;
}

// ------------------------------------------------------------- the decision

/**
 * May a token with these claims still be used?
 *
 * `row` is the `_sessions` row the read joined in, or null/undefined when there
 * is none. Both absences are LIVE, and both for reasons that are not the same:
 *
 *   - no `sid` in the token at all. That is every session that existed before
 *     this shipped, and signing every member of every site out to add a device
 *     list is not an acceptable price. Same rule `ep` absent → 0 follows.
 *
 *   - a `sid` with no row. Either the row was pruned — in which case the token
 *     it belongs to has already expired and `verifyToken` refused it before this
 *     was ever called — or the INSERT at sign-in failed. Refusing there would
 *     mean a transient write error hands somebody a token that authenticates
 *     nowhere: a login that appears to succeed and then silently does nothing,
 *     on every subsequent request, until they think to sign in again. That is a
 *     far worse failure than a session that outlives a lost row.
 *
 * The consequence, and it is the reason revocation is a FLAG: deleting a session
 * row would UN-revoke it. `revoke` sets `revoked`; nothing deletes.
 *
 * A lookup that *fails* is a different thing entirely and is already closed —
 * the join is part of the `_users` read, so a database error takes the whole
 * query down and the caller resolves to nobody.
 */
export function sessionUsable(claims, row) {
  if (!claims || !claims.sid) return true;
  if (!row) return true;
  return !row.revoked;
}

/**
 * The join that makes this free.
 *
 * A visitor read costs one query against `_users`; adding a session check as a
 * second statement would double the round trips on the exact path the routing
 * and cache work spent itself getting down to one. LEFT so that a token with no
 * sid, or a sid with no row, still returns the user — `sessionUsable` decides
 * what that means, not the SQL.
 */
export const SESSION_JOIN =
  "LEFT JOIN _sessions s ON s.sid = ? AND s.user_id = u.id";

// ------------------------------------------------------------- device names

/** A UA header is arbitrary attacker-controlled text, and it is stored. */
export const UA_MAX = 300;

export function trimUa(ua) {
  if (typeof ua !== "string") return "";
  // Control characters stripped before the length cut, so a header padded with
  // them cannot push the readable part out of the stored window.
  return ua.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").trim().slice(0, UA_MAX);
}

// ORDER MATTERS, and this is the classic way to get it wrong: Edge's user agent
// contains "Chrome" AND "Safari", Chrome's contains "Safari", and Opera's
// contains both plus "Chrome". Every browser here has to be tested before the
// one it impersonates, or Edge on Windows reads as "Windows · Chrome" and the
// list quietly names the wrong device.
const BROWSERS = [
  [/\bEdgi?A?\w*\//i, "Edge"],
  [/\bOPR\/|\bOpera\//i, "Opera"],
  [/\bSamsungBrowser\//i, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//i, "Firefox"],
  [/\bCriOS\/|\bChrome\//i, "Chrome"],
  [/\bSafari\//i, "Safari"],
];

const SYSTEMS = [
  [/\biPhone\b/i, "iPhone"],
  [/\biPad\b/i, "iPad"],
  [/\bAndroid\b/i, "Android"],
  [/\bCrOS\b/i, "Chromebook"],
  [/\bWindows\b/i, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/i, "Mac"],
  [/\bLinux\b/i, "Linux"],
];

/**
 * "iPhone · Safari" — enough to recognise a device, and nothing more.
 *
 * Deliberately coarse. The point is that somebody scanning a list can tell which
 * row is the tablet they gave away; a version number helps with that not at all
 * and makes the list read like a diagnostic dump.
 */
export function deviceLabel(ua) {
  const s = trimUa(ua);
  if (!s) return "Unknown device";
  const os = SYSTEMS.find(([re]) => re.test(s));
  const br = BROWSERS.find(([re]) => re.test(s));
  if (!os && !br) return "Unknown device";
  return [os && os[1], br && br[1]].filter(Boolean).join(" · ");
}

// ------------------------------------------------------------- the list

const secs = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * What the member sees.
 *
 * Revoked sessions are dropped rather than shown greyed out: the list answers
 * "where am I signed in", and a row that is not a way in is noise in exactly the
 * moment somebody is trying to spot one that is.
 *
 * `current` is marked because the alternative is somebody signing themselves out
 * of the tab they are reading, then filing a bug. It is still revocable — that
 * is just logging out — but they get to know first.
 *
 * Newest first, and the CURRENT one is not pinned to the top: it is usually the
 * newest anyway, and a device that jumps position depending on which one you are
 * reading from is harder to scan, not easier.
 */
export function describeSessions(rows, currentSid, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.sid && !r.revoked)
    .map((r) => ({
      sid: String(r.sid),
      device: deviceLabel(r.ua),
      country: r.country ? String(r.country).slice(0, 2).toUpperCase() : null,
      createdAt: secs(r.created_at) || null,
      lastSeen: secs(r.last_seen) || secs(r.created_at) || null,
      current: !!currentSid && String(r.sid) === String(currentSid),
    }))
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0) || String(a.sid).localeCompare(String(b.sid)))
    .map((s) => ({ ...s, ageSec: s.lastSeen ? Math.max(0, Math.floor(now / 1000) - s.lastSeen) : null }));
}

// ------------------------------------------------------------- writes

/**
 * How stale `last_seen` has to be before it is worth a write.
 *
 * Untimed, this is a WRITE on every authenticated read — the thing the whole
 * connection-health effort was about not doing. Fifteen minutes makes it about
 * four writes an hour for somebody actively using the site, and the number it
 * produces is still right to the granularity anyone reads it at ("2 days ago").
 */
export const TOUCH_AFTER_SEC = 15 * 60;

export function shouldTouch(lastSeen, nowMs) {
  const now = Math.floor((nowMs == null ? Date.now() : nowMs) / 1000);
  const seen = secs(lastSeen);
  // Never seen → write, so a session created by a path that did not stamp it
  // does not sit at "never" forever.
  if (!seen) return true;
  // A clock that ran backwards leaves `seen` in the future, which makes this
  // negative and answers "no" — the safe direction, and the reason there is no
  // separate guard for it. An explicit one here would be unreachable.
  return now - seen >= TOUCH_AFTER_SEC;
}

/**
 * When a row is old enough to delete.
 *
 * TWICE the token lifetime, not once. A row pruned while its token is still
 * valid comes back as "no row", which `sessionUsable` reads as LIVE — so
 * pruning too early would silently resurrect a revoked session. The horizon has
 * to exceed the longest life any token in the table can have, and doubling it
 * costs a few hundred bytes per stale session rather than a correctness
 * argument about clock skew between two machines.
 */
export function pruneBefore(ttlSec, nowMs) {
  const ttl = Number.isFinite(ttlSec) && ttlSec > 0 ? Math.floor(ttlSec) : 0;
  // A nonsense TTL returns the epoch, which prunes NOTHING — every row is newer
  // than 1970. The alternative, arithmetic on NaN, produces a comparison that is
  // false for every row in one direction and true for every row in the other,
  // and only one of those is survivable.
  if (!ttl) return 0;
  const now = Math.floor((nowMs == null ? Date.now() : nowMs) / 1000);
  return now - ttl * 2;
}

/** A member may hold a lot of devices, but not an unbounded number of rows. */
export const MAX_SESSIONS_LISTED = 50;
