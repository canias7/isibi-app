// Naming and revoking one device.
//
// The whole module is one trade: sessions stop being purely stateless so that a
// member can see where they are signed in and drop one. Two things have to hold
// for that trade to be worth making — a revoked session must actually stop
// working, and a session whose ROW is missing must not stop working, because
// that is what a failed write at sign-in looks like and refusing there would
// hand somebody a token that authenticates nowhere.
//
// Pure functions throughout; no database, no clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newSessionId, normalizeSid, sessionUsable, SESSION_JOIN,
  trimUa, deviceLabel, UA_MAX,
  describeSessions, shouldTouch, TOUCH_AFTER_SEC, pruneBefore, agoLabel,
} from "../site-sessions.mjs";

const NOW = 1_800_000_000_000; // ms
const S = Math.floor(NOW / 1000);

// ------------------------------------------------------------- ids

test("a session id is random, url-safe and long enough to be one", () => {
  const a = newSessionId(), b = newSessionId();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/, "no padding and nothing needing an escape");
  assert.ok(a.length >= 16, a);
  // Deterministic under an injected source, which is what the tests below use.
  const fixed = () => new Uint8Array(16).fill(7);
  assert.equal(newSessionId(fixed), newSessionId(fixed));
});

test("a sid off a request body is shape-checked", () => {
  assert.equal(normalizeSid("abcdefghijklmnop"), "abcdefghijklmnop");
  assert.equal(normalizeSid("  abcdefghijklmnop  "), "abcdefghijklmnop");
  assert.equal(normalizeSid(newSessionId()).length, newSessionId().length);
  for (const v of ["", "short", "a".repeat(65), "has spaces here!", "semi;colon;;;;;;;;", null, 7, {}]) {
    assert.equal(normalizeSid(v), null, JSON.stringify(v));
  }
});

// ------------------------------------------------------------- the decision

test("a revoked session is refused", () => {
  assert.equal(sessionUsable({ sid: "x" }, { sid: "x", revoked: 1 }), false);
  assert.equal(sessionUsable({ sid: "x" }, { sid: "x", revoked: true }), false);
});

test("a live session is allowed", () => {
  assert.equal(sessionUsable({ sid: "x" }, { sid: "x", revoked: 0 }), true);
  assert.equal(sessionUsable({ sid: "x" }, { sid: "x", revoked: null }), true);
  assert.equal(sessionUsable({ sid: "x" }, { sid: "x" }), true);
});

test("a token minted before any of this still works", () => {
  // Every live member of every site holds one of these. Refusing them would be
  // signing the whole platform's visitors out to add a settings screen.
  assert.equal(sessionUsable({ sub: "1" }, null), true);
  assert.equal(sessionUsable({ sub: "1", sid: undefined }, null), true);
  // And it is not accidentally sensitive to a row that happens to be joined in.
  assert.equal(sessionUsable({ sub: "1" }, { sid: "other", revoked: 1 }), true);
});

test("a sid with NO row is live, not revoked", () => {
  // The one that decides whether a failed INSERT at sign-in is recoverable. If
  // this were false, a transient write error would produce a login that appears
  // to succeed and then silently fails every request after it.
  assert.equal(sessionUsable({ sid: "x" }, null), true);
  assert.equal(sessionUsable({ sid: "x" }, undefined), true);
});

test("nothing may be revoked by DELETING its row", () => {
  // The direct consequence of the rule above, and the reason `revoke` sets a
  // flag: a deleted row reads as "no row", which reads as live. Stated as a test
  // because the SQL that deletes lives in another file and looks harmless there.
  const revokedByFlag = sessionUsable({ sid: "x" }, { sid: "x", revoked: 1 });
  const revokedByDelete = sessionUsable({ sid: "x" }, null);
  assert.equal(revokedByFlag, false);
  assert.equal(revokedByDelete, true, "deleting is NOT revoking — the flag is the mechanism");
});

test("the join is scoped to the user as well as the sid", () => {
  // Ownership is not left to the sid being hard to guess.
  assert.match(SESSION_JOIN, /^LEFT JOIN/, "a token with no sid must still return the user");
  assert.match(SESSION_JOIN, /s\.sid\s*=\s*\?/);
  assert.match(SESSION_JOIN, /s\.user_id\s*=\s*u\.id/);
});

// ------------------------------------------------------------- device names

const UAS = {
  "iPhone · Safari": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  "iPhone · Chrome": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0 Mobile/15E148 Safari/604.1",
  "iPad · Safari": "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/604.1",
  "Mac · Safari": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Mac · Chrome": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Windows · Chrome": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Windows · Firefox": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Android · Chrome": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Chromebook · Chrome": "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Linux · Firefox": "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
};

test("a real user agent becomes something a person recognises", () => {
  for (const [want, ua] of Object.entries(UAS)) assert.equal(deviceLabel(ua), want, ua);
});

test("a browser that impersonates another is named as itself", () => {
  // THE bug in every hand-rolled UA parser. Edge's string contains "Chrome" and
  // "Safari"; Opera's contains both; Chrome's contains "Safari"; Firefox on iOS
  // contains "Safari" too. Order in the table is the only thing making these
  // right, and reordering it is a silent change.
  assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"), "Windows · Edge");
  assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 EdgiOS/120.0 Mobile/15E148 Safari/604.1"), "iPhone · Edge");
  assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0"), "Windows · Opera");
  assert.equal(deviceLabel("Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36"), "Android · Samsung Internet");
  assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15"), "iPhone · Firefox");
});

test("an iPhone is not a Mac even though its UA says Mac OS X", () => {
  // Every mobile Apple UA contains "like Mac OS X". Naming it "Mac" would make
  // the phone and the laptop indistinguishable in the list, which is the one
  // distinction the feature exists to draw.
  assert.equal(deviceLabel(UAS["iPhone · Safari"]), "iPhone · Safari");
  assert.equal(deviceLabel(UAS["iPad · Safari"]), "iPad · Safari");
});

test("an Android phone is not Linux, even though its UA says Linux", () => {
  assert.equal(deviceLabel(UAS["Android · Chrome"]), "Android · Chrome");
});

test("nothing recognisable is said so, rather than guessed at", () => {
  for (const v of ["", "   ", "curl/8.4.0", "totally made up", null, undefined, 7, {}, []]) {
    assert.equal(deviceLabel(v), "Unknown device", JSON.stringify(v));
  }
});

test("half a match still names what it can", () => {
  assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0)"), "Windows");
  assert.equal(deviceLabel("Chrome/120.0"), "Chrome");
});

test("a user agent is bounded and stripped before it is stored", () => {
  // It is an arbitrary attacker-controlled header that ends up in the site
  // owner's database and then in a page.
  assert.equal(trimUa("x".repeat(1000)).length, UA_MAX);
  assert.equal(trimUa("a b"), "a b");
  assert.equal(trimUa("  padded  "), "padded");
  assert.equal(trimUa(null), "");
  assert.equal(trimUa(12345), "", "not anything stringifiable");
  // Control characters go BEFORE the cut, or a header padded with them pushes
  // the readable part out of the stored window.
  assert.ok(trimUa(" ".repeat(400) + "Windows NT").includes("Windows NT"));
});

// ------------------------------------------------------------- the list

const row = (o) => ({ sid: "s1", user_id: 1, ua: UAS["Mac · Chrome"], created_at: S - 100, last_seen: S - 100, revoked: 0, country: "gb", ...o });

test("the list names each device and marks the one you are reading from", () => {
  const out = describeSessions([row({ sid: "s1" }), row({ sid: "s2", ua: UAS["iPhone · Safari"] })], "s2", NOW);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((s) => s.device).sort(), ["Mac · Chrome", "iPhone · Safari"]);
  assert.deepEqual(out.filter((s) => s.current).map((s) => s.sid), ["s2"]);
});

test("a revoked session is not listed", () => {
  // It is not a way in, and a greyed-out row is noise in the moment somebody is
  // scanning for one that is.
  const out = describeSessions([row({ sid: "s1" }), row({ sid: "s2", revoked: 1 })], "s1", NOW);
  assert.deepEqual(out.map((s) => s.sid), ["s1"]);
});

test("the list is newest-first and stable", () => {
  const out = describeSessions([
    row({ sid: "old", last_seen: S - 9000 }),
    row({ sid: "new", last_seen: S - 10 }),
    row({ sid: "mid", last_seen: S - 500 }),
  ], null, NOW);
  assert.deepEqual(out.map((s) => s.sid), ["new", "mid", "old"]);
  // Ties do not reorder between calls.
  const tied = [row({ sid: "bbb", last_seen: S }), row({ sid: "aaa", last_seen: S })];
  assert.deepEqual(describeSessions(tied, null, NOW).map((s) => s.sid), ["aaa", "bbb"]);
});

test("age is reported in seconds from last seen", () => {
  const [s] = describeSessions([row({ last_seen: S - 3600 })], null, NOW);
  assert.equal(s.ageSec, 3600);
  assert.equal(s.lastSeen, S - 3600);
});

test("a session never seen falls back to when it was created", () => {
  const [s] = describeSessions([row({ created_at: S - 77, last_seen: null })], null, NOW);
  assert.equal(s.lastSeen, S - 77);
  assert.equal(s.ageSec, 77);
});

test("junk rows do not become junk entries", () => {
  assert.deepEqual(describeSessions(null, null, NOW), []);
  assert.deepEqual(describeSessions([null, {}, { sid: "" }], null, NOW), []);
  const [s] = describeSessions([row({ created_at: "nonsense", last_seen: "nonsense" })], null, NOW);
  assert.equal(s.lastSeen, null);
  assert.equal(s.ageSec, null, "an unknown time is unknown, not 55 years ago");
});

test("the country is two letters and upper case, or absent", () => {
  assert.equal(describeSessions([row({ country: "gb" })], null, NOW)[0].country, "GB");
  assert.equal(describeSessions([row({ country: null })], null, NOW)[0].country, null);
  assert.equal(describeSessions([row({ country: "XXlonger" })], null, NOW)[0].country, "XX");
});

test("nothing is `current` when the caller has no sid", () => {
  // A token minted before this existed. Marking a row would name the wrong one.
  assert.deepEqual(describeSessions([row({ sid: "s1" })], undefined, NOW).map((s) => s.current), [false]);
  assert.deepEqual(describeSessions([row({ sid: "s1" })], "", NOW).map((s) => s.current), [false]);
  // And it is an absence check, not a string comparison that happens to differ:
  // `startSession` stores `String(sid)`, so a caller passing nothing writes a
  // row whose sid is literally "undefined" — and every sidless token on the site
  // would then point at it.
  assert.deepEqual(describeSessions([row({ sid: "undefined" })], undefined, NOW).map((s) => s.current), [false]);
  assert.deepEqual(describeSessions([row({ sid: "null" })], null, NOW).map((s) => s.current), [false]);
});

// ------------------------------------------------------------- writes

test("last_seen is written at most every fifteen minutes", () => {
  // Untimed this is a WRITE on every authenticated read, on the path the whole
  // connection-health effort was about.
  assert.equal(shouldTouch(S, NOW), false, "just seen");
  assert.equal(shouldTouch(S - TOUCH_AFTER_SEC + 1, NOW), false);
  assert.equal(shouldTouch(S - TOUCH_AFTER_SEC, NOW), true, "exactly at the window");
  assert.equal(shouldTouch(S - 86400, NOW), true);
});

test("a session never stamped is written once", () => {
  assert.equal(shouldTouch(null, NOW), true);
  assert.equal(shouldTouch(0, NOW), true);
  assert.equal(shouldTouch("nonsense", NOW), true);
});

test("a clock that went backwards does not start writing every request", () => {
  assert.equal(shouldTouch(S + 5000, NOW), false);
});

test("pruning cannot resurrect a revoked session", () => {
  // A row deleted while its token is still valid reads as "no row", which reads
  // as LIVE. So the horizon has to be past the longest life any token in the
  // table can have — not equal to it.
  const TTL = 60 * 60 * 24 * 30;
  const horizon = pruneBefore(TTL, NOW);
  const oldestLiveToken = S - TTL; // issued exactly one full lifetime ago
  assert.ok(horizon < oldestLiveToken, "a session issued a full TTL ago must not be pruned");
  assert.equal(horizon, S - TTL * 2);
  // A garbage TTL prunes NOTHING rather than producing NaN — which compares
  // false against every row in one direction and true in the other, and only
  // one of those survives.
  for (const bad of [0, -1, NaN, null, undefined, "thirty days"]) {
    assert.equal(pruneBefore(bad, NOW), 0, String(bad));
  }
});

test("every session carries a label that is never null", () => {
  // `ageSec` is nullable on purpose, and that put a null-guard between the
  // generator and the one thing it renders — it skipped the guard in every eval
  // sample, three times out of three.
  const out = describeSessions([row({ last_seen: S - 3600 }), row({ sid: "s2", created_at: null, last_seen: null })], null, NOW);
  for (const s of out) assert.equal(typeof s.lastSeenLabel, "string", JSON.stringify(s));
  assert.equal(out.find((s) => s.ageSec === 3600).lastSeenLabel, "1 hour ago");
  assert.equal(out.find((s) => s.ageSec === null).lastSeenLabel, "unknown");
});

test("the label is coarse, and reads like a person wrote it", () => {
  // It answers "is that still me?" — 90 minutes and 100 minutes are one answer.
  assert.equal(agoLabel(0), "just now");
  assert.equal(agoLabel(89), "just now");
  assert.equal(agoLabel(90), "2 minutes ago");
  assert.equal(agoLabel(60 * 60), "1 hour ago");
  assert.equal(agoLabel(60 * 60 * 24 * 2), "2 days ago");
  assert.equal(agoLabel(60 * 60 * 24 * 60), "2 months ago");
  assert.equal(agoLabel(60 * 60 * 24 * 500), "over a year ago");
  for (const bad of [null, undefined, NaN, Infinity, "x"]) assert.equal(agoLabel(bad), "unknown", String(bad));
});
