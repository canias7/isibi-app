// The auth audit log.
//
// Most of these are about what is NOT written. An audit log is a security
// feature until it starts hoarding, and then it is the most concentrated
// liability on the platform: every address anybody ever mistyped, every IP, and
// — if somebody is careless once — a password.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_KINDS, FAILURE_KINDS, OWNER_KINDS, AUDIT_DDL, AUDIT_RETENTION_DAYS,
  normalizeKind, isFailure, isOwnerAction, pruneBefore,
  addressFingerprint, truncateIp, shapeMeta, auditRow, describeEvents, summarize, agoLabel,
} from "../site-audit.mjs";

const NOW = 1785000000000;
const keyFor = async (secret) => crypto.subtle.importKey(
  "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

// ------------------------------------------------------------- the vocabulary

test("a kind outside the set is refused, not invented", () => {
  for (const k of AUDIT_KINDS) assert.equal(normalizeKind(k), k, k);
  assert.equal(normalizeKind("LOGIN"), "login", "case is normalised, not rejected");
  // The failure this guards: a typo at a call site becomes a row the owner's
  // filters never show and nobody notices is missing.
  assert.equal(normalizeKind("login_faild"), null);
  assert.equal(normalizeKind("arbitrary"), null);
  assert.equal(normalizeKind(""), null);
  assert.equal(normalizeKind(null), null);
  assert.equal(normalizeKind({}), null);
});

test("every failure kind and owner kind is a real kind", () => {
  // Two lists derived from the same set; a name in one and not the other is a
  // category that silently never counts.
  for (const k of FAILURE_KINDS) assert.ok(AUDIT_KINDS.includes(k), k);
  for (const k of OWNER_KINDS) assert.ok(AUDIT_KINDS.includes(k), k);
  assert.ok(isFailure("login_failed") && isFailure("2fa_failed") && isFailure("locked"));
  assert.ok(!isFailure("login") && !isFailure("signup"));
  assert.ok(isOwnerAction("suspend") && isOwnerAction("role_change"));
  assert.ok(!isOwnerAction("login"), "a member signing in is not something the owner did");
});

// ------------------------------------------------- what is deliberately absent

test("a password can never reach the log, whatever the caller passes", async () => {
  const key = await keyFor("s");
  const row = await auditRow({
    kind: "login_failed",
    email: "ada@example.com",
    // Everything a careless call site might hand over "for context".
    meta: { password: "hunter2", token: "eyJhbGciOi", pass_hash: "pbkdf2$...", code: "483920", body: { password: "hunter2" } },
  }, { nowMs: NOW, key });
  const blob = JSON.stringify(row);
  for (const secret of ["hunter2", "eyJhbGciOi", "pbkdf2", "483920"]) {
    assert.ok(!blob.includes(secret), "the log must never carry " + secret + ": " + blob);
  }
  assert.equal(row.meta, null, "none of those fields are on the allow-list, so nothing survives");
});

test("meta is an allow-list of scalars, not a filter", () => {
  assert.deepEqual(shapeMeta({ method: "password", reason: "invite", count: 3 }), { method: "password", reason: "invite", count: 3 });
  // Named field, wrong type: dropped rather than stringified. `String({})` is
  // "[object Object]", and `String(bodyObject)` is how a body gets in.
  assert.equal(shapeMeta({ method: { password: "hunter2" } }), null);
  assert.equal(shapeMeta({ reason: ["a", "b"] }), null);
  assert.equal(shapeMeta({ count: NaN }), null, "a non-finite number is not a count");
  // Unnamed fields never survive, however innocent they look.
  assert.equal(shapeMeta({ note: "hello", email: "ada@example.com" }), null);
  assert.equal(shapeMeta("a string"), null);
  assert.equal(shapeMeta(["a"]), null);
  assert.equal(shapeMeta(null), null);
  // Long strings are cut, so one field cannot become a place to stash a blob.
  assert.equal(shapeMeta({ reason: "x".repeat(500) }).reason.length, 60);
});

test("a stranger's address is fingerprinted; a member's is kept", async () => {
  const key = await keyFor("site-secret");
  const stranger = await auditRow({ kind: "login_failed", email: "nobody@example.com" }, { nowMs: NOW, key });
  assert.equal(stranger.email, null, "somebody with no account here must not end up in the owner's log by address");
  assert.match(stranger.who, /^[0-9a-f]{12}$/);

  // A member — the owner already has this address on their member list, so
  // withholding it costs legibility and buys nothing.
  const member = await auditRow({ kind: "login_failed", userId: 7, email: "Ada@Example.com" }, { nowMs: NOW, key });
  assert.equal(member.email, "ada@example.com");
  assert.equal(member.who, null, "storing both would make the fingerprint a lookup table to every member's address");
});

test("the same stranger fingerprints the same way, a different one does not", async () => {
  const key = await keyFor("site-secret");
  const a = await addressFingerprint(key, "nobody@example.com");
  const b = await addressFingerprint(key, "NOBODY@Example.com  ");
  const c = await addressFingerprint(key, "someone-else@example.com");
  assert.equal(a, b, "the whole point is recognising a repeat attempt");
  assert.notEqual(a, c);
});

test("the fingerprint is PER SITE, so two owners cannot compare notes", async () => {
  // Without the site's own key in the derivation, the same address produces the
  // same tag everywhere — and two owners could confirm the same person tried
  // both sites, which is exactly the linkage not storing the address prevents.
  const a = await addressFingerprint(await keyFor("site-a"), "nobody@example.com");
  const b = await addressFingerprint(await keyFor("site-b"), "nobody@example.com");
  assert.notEqual(a, b);
});

test("an IP is reduced to its block, and an unparseable one is dropped", () => {
  assert.equal(truncateIp("203.0.113.45"), "203.0.113.0/24");
  assert.equal(truncateIp("2001:db8:85a3:1234::1"), "2001:db8:85a3::/48");
  // Not understood → not stored. A value this function cannot parse is the one
  // most likely to be something it should not be keeping.
  assert.equal(truncateIp("not-an-ip"), null);
  assert.equal(truncateIp("999.1.1.1"), null, "an out-of-range octet is not an address");
  assert.equal(truncateIp(""), null);
  assert.equal(truncateIp(null), null);
  assert.equal(truncateIp("<script>"), null);
});

test("a failure cannot be recorded as a success", async () => {
  const key = await keyFor("s");
  // The count on the owner's page is what somebody checks when they are worried.
  // A caller passing ok:true on a failure kind must not be able to hide the row.
  const row = await auditRow({ kind: "login_failed", ok: true, email: "a@b.co" }, { nowMs: NOW, key });
  assert.equal(row.ok, 0);
  const good = await auditRow({ kind: "login", userId: 1 }, { nowMs: NOW, key });
  assert.equal(good.ok, 1);
});

test("an unknown kind writes NOTHING rather than a row nobody can find", async () => {
  const key = await keyFor("s");
  assert.equal(await auditRow({ kind: "nonsense", userId: 1 }, { nowMs: NOW, key }), null);
});

// ------------------------------------------------------------- retention

test("a nonsense retention prunes nothing", () => {
  // The same direction site-sessions.mjs chose. Deleting too little costs
  // storage; deleting too much destroys the only record that a thing happened,
  // and it does it silently, and usually right when somebody needs it.
  for (const bad of [0, -1, NaN, "soon", null]) assert.equal(pruneBefore(bad, NOW), 0, String(bad));
  // `undefined` is NOT a nonsense value — it is a caller who did not specify,
  // and it gets the default. Worth pinning apart from the above, because
  // collapsing the two would either prune nothing by default (a table that
  // grows forever) or treat a misconfiguration as a request to use the default
  // (which prunes, and is the direction that loses evidence).
  assert.equal(pruneBefore(undefined, NOW), pruneBefore(AUDIT_RETENTION_DAYS, NOW));
  const cut = pruneBefore(AUDIT_RETENTION_DAYS, NOW);
  assert.equal(cut, Math.floor(NOW / 1000) - AUDIT_RETENTION_DAYS * 86400);
  assert.ok(cut < Math.floor(NOW / 1000), "the cut has to be in the past");
});

// ------------------------------------------------------------- the owner's view

const rows = (over) => [
  { id: 1, at: Math.floor(NOW / 1000) - 60, kind: "login", ok: 1, user_id: 3, email: "ada@example.com", ip: "203.0.113.0/24" },
  { id: 2, at: Math.floor(NOW / 1000) - 120, kind: "login_failed", ok: 0, user_id: 3, email: "ada@example.com", ip: "203.0.113.0/24" },
  { id: 3, at: Math.floor(NOW / 1000) - 130, kind: "login_failed", ok: 0, user_id: null, who: "aaaaaaaaaaaa", ip: "198.51.100.0/24" },
  { id: 4, at: Math.floor(NOW / 1000) - 140, kind: "suspend", ok: 1, user_id: 3, email: "ada@example.com" },
  ...(over || []),
];

test("rows are rendered in the words an owner would use", () => {
  const out = describeEvents(rows(), NOW);
  assert.equal(out[0].what, "signed in");
  assert.equal(out[0].ago, "1 minute ago");
  assert.equal(out[1].failure, true);
  assert.equal(out[3].owner, true, "a suspension is something the owner did, not something the member did");
  // The stranger reads as a stranger at a glance, not as a hash.
  assert.match(out[2].who, /^unknown·/);
  assert.equal(out[2].email, null);
});

test("a row with an unknown kind is dropped from the view, not rendered raw", () => {
  const out = describeEvents([{ id: 9, at: 1, kind: "smuggled", ok: 1 }], NOW);
  assert.deepEqual(out, []);
});

test("meta is re-shaped on the way OUT as well as in", () => {
  // The row could have been written before a field was removed from the
  // allow-list, or by an older deploy. The read path is not allowed to trust
  // the database any more than it trusts a caller.
  const out = describeEvents([{ id: 1, at: 1, kind: "login", ok: 1, meta: '{"method":"password","password":"hunter2"}' }], NOW);
  assert.deepEqual(out[0].meta, { method: "password" });
  assert.ok(!JSON.stringify(out).includes("hunter2"));
});

test("malformed stored meta does not take the page down", () => {
  const out = describeEvents([{ id: 1, at: 1, kind: "login", ok: 1, meta: "{not json" }], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].meta, null);
});

test("the summary counts SOURCES, not just failures", () => {
  // The number that decides whether forty failures is somebody who forgot their
  // password or somebody working through a list.
  const one = summarize([
    ...Array.from({ length: 40 }, (_, i) => ({ at: Math.floor(NOW / 1000) - i, kind: "login_failed", user_id: 3, email: "ada@example.com" })),
  ], { nowMs: NOW });
  assert.equal(one.failures, 40);
  assert.equal(one.sources, 1, "one member failing forty times is one source");
  assert.equal(one.membersTargeted, 1);

  const many = summarize(
    Array.from({ length: 40 }, (_, i) => ({ at: Math.floor(NOW / 1000) - i, kind: "login_failed", who: "src" + i })),
    { nowMs: NOW });
  assert.equal(many.sources, 40, "forty strangers failing once each is forty sources");
  assert.equal(many.membersTargeted, 0, "nobody real was hit — they are guessing addresses");
});

test("the summary only looks at its window", () => {
  const old = [{ at: Math.floor(NOW / 1000) - 100000, kind: "login_failed", who: "x" }];
  const fresh = [{ at: Math.floor(NOW / 1000) - 10, kind: "login_failed", who: "y" }];
  const s = summarize([...old, ...fresh], { nowMs: NOW, windowSec: 86400 });
  assert.equal(s.failures, 1, "yesterday's attack is not today's");
  assert.equal(s.events, 1);
});

test("agoLabel always says something", () => {
  assert.equal(agoLabel(0), "just now");
  assert.equal(agoLabel(59), "just now");
  assert.equal(agoLabel(60), "1 minute ago");
  assert.equal(agoLabel(7200), "2 hours ago");
  assert.equal(agoLabel(172800), "2 days ago");
  // A row with a missing or nonsense stamp still has to render.
  assert.equal(agoLabel(-5), "just now");
  assert.equal(agoLabel(NaN), "just now");
  assert.equal(agoLabel(undefined), "just now");
});

test("the DDL creates the table and the indexes the owner's view needs", () => {
  const all = AUDIT_DDL.join("\n");
  assert.match(all, /CREATE TABLE IF NOT EXISTS _auth_events/);
  assert.match(all, /at BIGINT NOT NULL/);
  // Every column auditRow produces has to exist, or the first write 500s. Derived
  // from the row rather than listed, so a new field cannot be added without one.
  for (const col of ["at", "kind", "ok", "user_id", "email", "who", "ip", "country", "ua", "sid", "meta"]) {
    assert.match(all, new RegExp("\\b" + col + "\\b"), col + " is written but never created");
  }
  assert.match(all, /CREATE INDEX IF NOT EXISTS _auth_events_at/);
  assert.match(all, /_auth_events_user ON _auth_events \(user_id, at DESC\)/);
  assert.ok(AUDIT_DDL.every((s) => /IF NOT EXISTS/.test(s)), "every statement runs on every request; all must be idempotent");
});

test("every column auditRow writes is one the DDL creates", async () => {
  // The derived version of the check above, and the one that catches the real
  // mistake: adding a field to the row and forgetting the migration. This is the
  // exact shape of the bug that had login answering 500 on every published site.
  const key = await keyFor("s");
  const row = await auditRow({ kind: "login", userId: 1, ip: "203.0.113.9", ua: "x", sid: "s", country: "gb", meta: { method: "password" } }, { nowMs: NOW, key });
  const ddl = AUDIT_DDL[0];
  for (const col of Object.keys(row)) {
    assert.match(ddl, new RegExp("\\b" + col + "\\b"), "auditRow writes `" + col + "` and the DDL does not create it");
  }
});

// ------------------------------------------------- nothing may happen silently
//
// The whole point of this layer is that it is COMPLETE. A log covering nine of
// ten sign-in paths is worse than none, because it reads as an answer: an owner
// checks it, sees nothing, and concludes nothing happened.
//
// So the invariant is derived from the source on both sides — every action the
// auth routes handle, and every route the registry declares, must record
// something. A method added later without a `rec` call fails here rather than
// being discovered the day somebody needs the log.
import fs from "node:fs";
const ROUTES = fs.readFileSync(new URL("../site-auth-routes.mjs", import.meta.url), "utf8");
const FLOWS = fs.readFileSync(new URL("../site-auth-flows.mjs", import.meta.url), "utf8");
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** The body of one `if (action === "x") { … }` block. */
function actionBlock(src, action) {
  const start = src.indexOf('if (action === "' + action + '")');
  if (start < 0) return null;
  const rest = src.slice(start + 10);
  const next = rest.search(/\n  if \(action === "/);
  return rest.slice(0, next > 0 ? next : rest.length);
}

test("every auth action records something", () => {
  const src = strip(ROUTES);
  const actions = [...new Set([...src.matchAll(/if \(action === "([a-z-]+)"\)/g)].map((m) => m[1]))];
  assert.ok(actions.length >= 6, "found only " + actions.join(", "));
  // `me` is the exception and the only one: it is a read that a signed-in
  // visitor's page makes on EVERY load, so logging it would bury the events
  // that matter under thousands of rows saying somebody refreshed.
  const silent = [];
  for (const a of actions) {
    if (a === "me") continue;
    const block = actionBlock(src, a);
    if (!/\brec\(/.test(block || "")) silent.push(a);
  }
  assert.deepEqual(silent, [], "these auth actions leave no trace: " + silent.join(", "));
});

test("anything that mints a session records that it did", () => {
  // The guard the previous two do not give. "Every action records something"
  // passes with only the FAILURES recorded, and "every kind is emitted" passes
  // because `finishSignIn` emits `login` for the registry methods — so deleting
  // the password path's success record survives both, and the log would show
  // every wrong password and no successful sign-in. That is the single most
  // misleading state this table could be in: an owner reads it, sees no entry,
  // and concludes nobody got in.
  //
  // `mk(` is the one place these routes mint a token, so it is derived rather
  // than a list of action names that would go stale.
  const src = strip(ROUTES);
  const actions = [...new Set([...src.matchAll(/if \(action === "([a-z-]+)"\)/g)].map((m) => m[1]))];
  const silent = [];
  for (const a of actions) {
    const block = actionBlock(src, a) || "";
    if (!/\bmk\(/.test(block)) continue;                 // no session minted, nothing to claim
    const kinds = [...block.matchAll(/\brec\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);
    if (!kinds.some((k) => !isFailure(k))) silent.push(a);
  }
  assert.deepEqual(silent, [],
    "these mint a session and record no success, so the log shows the failures and not the entry: " + silent.join(", "));
});

test("the `me` read is deliberately NOT logged", () => {
  // Asserted rather than assumed, because the cost of getting this wrong is a
  // log that is useless in the other direction — a wall of noise nobody reads.
  const block = actionBlock(strip(ROUTES), "me");
  assert.ok(block, "the `me` handler was not found");
  assert.ok(!/\brec\(/.test(block), "logging every page load would bury every event that matters");
});

test("both halves of the auth surface record, and through the same shape", () => {
  // Two files, one surface. A log that covers the password routes and not the
  // registry methods answers half the question, which is the half the owner
  // does not know is missing.
  for (const [name, src] of [["site-auth-routes.mjs", ROUTES], ["site-auth-flows.mjs", FLOWS]]) {
    assert.match(strip(src), /const rec = \(kind, event\) => \{/, name + " must have the recorder");
    assert.match(strip(src), /if \(!deps\.audit\) return;/, name + "'s recorder must no-op without the dep");
  }
});

test("an audit write can never fail the thing it is describing", () => {
  // The priority that matters: the log exists to explain what happened to an
  // account, so taking the account down to protect the record of it is exactly
  // backwards. Nothing may await a `rec` into the response path.
  for (const [name, src] of [["site-auth-routes.mjs", ROUTES], ["site-auth-flows.mjs", FLOWS]]) {
    assert.ok(!/await rec\(/.test(strip(src)), name + " awaits an audit write into the response path");
  }
  // …and the Worker's implementation swallows its own errors.
  const dep = strip(WORKER).match(/function auditDeps\([\s\S]*?\n\}/);
  assert.ok(dep, "auditDeps was not found in worker.js");
  assert.match(dep[0], /catch \(e\) \{ console\.error\("audit write failed:/, "the write must swallow its errors");
});

test("every kind the code emits is one the vocabulary declares", () => {
  // The other direction of normalizeKind: it refuses an unknown kind at
  // runtime, which means a typo at a call site writes NOTHING and does it
  // silently. This catches it at build time instead.
  const emitted = new Set();
  for (const src of [ROUTES, FLOWS]) {
    for (const m of strip(src).matchAll(/\brec\(\s*"([a-z0-9_]+)"/g)) emitted.add(m[1]);
  }
  for (const m of strip(WORKER).matchAll(/audit\(\{\s*kind:\s*"([a-z0-9_]+)"/g)) emitted.add(m[1]);
  for (const m of strip(fs.readFileSync(new URL("../site-owner.mjs", import.meta.url), "utf8")).matchAll(/ev\(\s*"([a-z0-9_]+)"/g)) emitted.add(m[1]);
  assert.ok(emitted.size >= 12, "found only " + [...emitted].join(", "));
  const unknown = [...emitted].filter((k) => !AUDIT_KINDS.includes(k));
  assert.deepEqual(unknown, [], "these kinds are written and would be silently dropped: " + unknown.join(", "));
});

test("the audit write is handed to waitUntil, not fired and forgotten", () => {
  // The first production run of this log recorded 26 events where the run had
  // caused well over a hundred, and non-deterministically which. A Worker tears
  // the request context down once the response is returned, so a promise nobody
  // is holding is cancelled mid-flight — and a log that keeps a random subset is
  // worse than none, because the gaps read as "nothing happened".
  //
  // Nothing in the unit suite can catch that by running: there is no request
  // lifecycle in it. So it is asserted on the source, which is the only place
  // the fact is visible.
  const dep = WORKER.slice(WORKER.indexOf("function auditDeps("));
  const body = dep.slice(0, dep.indexOf("\nfunction "));
  assert.ok(body.length > 200, "auditDeps was not found in worker.js");
  assert.match(body, /ctx\.waitUntil\(p\)/, "the write must extend the request context or it is cancelled");
  assert.match(body, /else p\.catch\(\(\) => \{\}\)/, "…and must not become an unhandled rejection without a ctx");
  // Still never blocking the response: waitUntil extends the context, it does
  // not delay the reply, and an `await` here would put a database round trip in
  // front of every sign-in.
  assert.ok(!/await this\.audit|await deps\.audit/.test(WORKER), "an audit write is awaited into a response path");
});

test("the owner routes carry an audit dep at all", () => {
  // site-owner.mjs records role_change, suspend, unsuspend, team_change and
  // member_delete — and the owner dep object is a THIRD one, separate from the
  // two auth surfaces, which never carried the `audit` those calls need. The
  // first production run reported all five as never written.
  const i = WORKER.indexOf("const ownerDeps = {");
  assert.ok(i > 0, "ownerDeps was not found");
  const block = WORKER.slice(i, i + 700);
  assert.match(block, /\.\.\.auditDeps\(/, "the owner routes record nothing without this");
  // Lazily, because this object is built BEFORE assertOwner runs and resolving
  // the connection eagerly does a lookup for somebody about to be refused.
  assert.match(block, /auditDeps\(\(\) =>/, "the connection must be resolved at write time, after authorization");
});

test("every kind the vocabulary declares is actually emitted somewhere", () => {
  // The converse of the test above, and the one that catches the failure that
  // matters most: deleting the `login` record. "Every action records something"
  // passes anyway, because the login handler still records its FAILURES — so
  // the log would show every wrong password and no successful sign-in, which is
  // the single most misleading state this table could be in.
  //
  // Derived at both ends. A kind declared and never written is a category the
  // owner's filter offers and that can never return a row; a kind written and
  // never declared is dropped at runtime by normalizeKind. Both are silent.
  const emitted = new Set();
  const OWNER_SRC = fs.readFileSync(new URL("../site-owner.mjs", import.meta.url), "utf8");
  for (const src of [strip(ROUTES), strip(FLOWS), strip(OWNER_SRC),
    // worker.js RAW, for the second time: `strip` eats from any `/*` to the next
    // `*/`, and in a file this size one inside a string or a regex swallows
    // whole regions. The pattern below cannot appear in prose, so the raw source
    // costs nothing here.
    WORKER]) {
    for (const m of src.matchAll(/\brec\(\s*"([a-z0-9_]+)"/g)) emitted.add(m[1]);
    for (const m of src.matchAll(/\bev\(\s*"([a-z0-9_]+)"/g)) emitted.add(m[1]);
    for (const m of src.matchAll(/audit\(\{\s*kind:\s*"([a-z0-9_]+)"/g)) emitted.add(m[1]);
    for (const m of src.matchAll(/\bkind:\s*"([a-z0-9_]+)"/g)) emitted.add(m[1]);
    // The OAuth callback picks its kind with a conditional rather than a literal
    // first argument, so the names appear as bare strings in the expression.
    for (const m of src.matchAll(/\?\s*"([a-z0-9_]+)"\s*:\s*\(?"([a-z0-9_]+)"/g)) { emitted.add(m[1]); emitted.add(m[2]); }
  }
  const never = AUDIT_KINDS.filter((k) => !emitted.has(k));
  assert.deepEqual(never, [],
    "declared but never written, so the owner can filter for them forever: " + never.join(", "));
});

test("the audit table is created where the password path will find it", () => {
  // The `_sessions` lesson, restated as a test: this table is WRITTEN by plain
  // email-and-password login, so creating it only in the registry's DDL would
  // mean it existed on sites where somebody happened to use a passkey and
  // nowhere else — and every ordinary sign-in would throw on its own audit
  // write.
  const fn = strip(WORKER).match(/async function ensureSiteUsers\(db\)[\s\S]*?\n\}/);
  assert.ok(fn, "ensureSiteUsers was not found");
  assert.match(fn[0], /AUDIT_DDL/, "the audit table must be created by the function the login path calls");
});

test("the owner's events route is owner-gated and read-only", () => {
  // The RAW source, not the stripped copy. `strip` removes /* */ pairs, and in a
  // six-thousand-line file a `/*` inside a string or a regex swallows everything
  // up to the next `*/` — which quietly ate this whole block and reported the
  // route as missing.
  const src = WORKER;
  const i = src.indexOf("} else if (ev) {");
  assert.ok(i > 0, "the events route was not found");
  const block = src.slice(i, i + 3000);
  assert.match(block, /assertOwner\(/, "the log names members and their addresses — it is owner-only");
  assert.match(block, /method !== "GET"/, "nothing may write to the audit log through the API");
  // Filters are parameters, never interpolation. This route takes a `kind` and a
  // `member` straight off the query string.
  assert.match(block, /normalizeKind\(url\.searchParams\.get\("kind"\)\)/, "kind must go through the closed set");
  assert.ok(!/\+ *url\.searchParams\.get/.test(block), "a query-string value is concatenated into SQL");
});

test("a correct password on a 2FA account leaves a trace of its own", () => {
  // The gap this closed: no session is minted, so it is not a sign-in, and
  // nothing failed, so it is not a failure — and for want of a name it was
  // recorded as neither. A thief who had the password and stopped at the second
  // factor left the log completely empty.
  //
  // Asserted at both ends of the surface, because there are two: the password
  // route and `finishSignIn` for the registry methods, and a row written by one
  // and not the other is a log that answers this for passkeys and not for
  // passwords.
  assert.ok(AUDIT_KINDS.includes("2fa_required"));
  assert.equal(isFailure("2fa_required"), false, "nothing failed — the password was right");
  const shown = describeEvents([{ id: 1, at: 1, kind: "2fa_required", ok: 1, user_id: 3 }], NOW)[0];
  assert.match(shown.what, /right password/, "the owner has to be able to read what it means: " + shown.what);
  assert.equal(shown.failure, false);

  const login = actionBlock(strip(ROUTES), "login") || "";
  assert.match(login, /rec\("2fa_required"/, "the password route must record it");
  const fin = strip(FLOWS).slice(strip(FLOWS).indexOf("export async function finishSignIn"));
  assert.match(fin.slice(0, 1400), /kind: "2fa_required"/, "the registry methods must record it too");
});

test("a pending second factor is not counted as a sign-in", () => {
  // The number on the owner's page has to mean what it says. Counting these as
  // sign-ins would report somebody who never got in as having got in, which is
  // the error in the direction that matters.
  const s = summarize([
    { at: Math.floor(NOW / 1000) - 5, kind: "2fa_required", user_id: 3 },
    { at: Math.floor(NOW / 1000) - 4, kind: "login", user_id: 3 },
  ], { nowMs: NOW });
  assert.equal(s.signIns, 1);
  assert.equal(s.failures, 0, "and it is not a failure either");
  assert.equal(s.events, 2);
});
