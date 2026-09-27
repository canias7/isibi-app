// THE CANARY'S RULES TEST: every decision it makes, driven with no site, no
// token and no database. The driver half (the app, the visitor's booking tab,
// the order of reads and the one cleanup write) is driven through a stand-in
// browser in test/canary-ui.test.mjs; this file is the decisions alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  EVIDENCE_BOUNDARY, NEWEST_ROWS, runIdOf, markerBooking, rowIsMarker, bookingBodyVerdict, classifyBooking,
  pairOfLabel, tablesOf, censusOf, insertionVerdict, leftovers, cleanupPlan, stillMarker, deleteVerdict,
  cleanupVerified, readSecretNames, SEND_CHANNELS, sendsPossible, readAllow, sendsGate, readStamp,
  closingVerdict, maskRenderTimes, readSurface, surfaceStart, surfaceSame, bodyFacts, readRefusal, sourceSame,
  legacyUnpublishedVerdict, readRulesState, rulesStartVerdict, rulesRecordable, describeRules,
  bookingGate, BOOKING_HEADERS_REFUSED,
} from "../scripts/canary-rules.mjs";
import { readFileSync } from "node:fs";
import { UI_SCENARIOS } from "../scripts/canary-ui.mjs";
import { MAIL_PROVIDERS } from "../site-mail.mjs";
import { SMS_PROVIDERS } from "../site-sms.mjs";

const SC = UI_SCENARIOS["4b-rules-close"];
const SPEC = SC.rules;
const REC = SPEC.record;
const MARKER = markerBooking(SPEC.marker, "36300000001");
const DENIED = { code: "42501", details: null, hint: null, message: "permission denied for table bookings" };
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ── THE SCENARIO ────────────────────────────────────────────────────────────

test("the rules scenario is one message on lido-axes-b, walled to the rules layer, publishing nothing", () => {
  assert.equal(SC.site, "lido-axes-b");
  assert.deepEqual(SC.steps.map((s) => s.say), ["We're fully booked, so stop taking bookings on the website for now."]);
  assert.equal(sha(SC.steps[0].say).slice(0, 16), "3ccbae0b202aa2e2", "the message is not the one the proposal names");
  assert.deepEqual([...SC.layers], ["rules"]);
  assert.equal(SC.publishes, 0);
  assert.equal(SC.layout, "legacy");
  assert.ok(Number.isFinite(SC.budget) && SC.budget > 0 && SC.budget <= 10, `budget ${SC.budget}`);
  assert.ok(Object.isFrozen(SC) && Object.isFrozen(SPEC) && Object.isFrozen(SPEC.marker) && Object.isFrozen(REC), "the scenario can be changed at run time");
  assert.equal(SPEC.table, "bookings");
  assert.equal(SPEC.book.api, "/api/db/lido-axes-b/data/bookings");
  // The marker passes the page's own checks and names nobody real.
  assert.deepEqual({ ...SPEC.marker }, { name: "Canary rules", phone: "07700 900999", party_size: 2, booking_date: "2099-12-31", booking_time: "17:00" });
  assert.deepEqual([...SPEC.closing.fields], ["retired", "write"]);
  // What the site is kept for, as recorded.
  assert.deepEqual([...REC.routes], ["/", "/book", "/menu"]);
  assert.deepEqual([...REC.tables], ["bookings", "menu_items"]);
  assert.deepEqual({ ...REC.stylesheet }, { path: "/assets/index-glpAegzo.css", bytes: 209105, sha256: "6f7ca4bc53e559a7228609e30a400567b37aaf6c14b410c49a164274bd3aa360" });
  assert.equal(REC.build, "mt50cg7h-l19hre");
});

test("the marker names this run, and a row is the marker only when it holds every value it sent", () => {
  assert.equal(runIdOf({ GITHUB_RUN_ID: "36300000001" }), "36300000001");
  assert.equal(runIdOf({ GITHUB_RUN_ID: "36300000001", GITHUB_RUN_ATTEMPT: "2" }), "36300000001.2");
  assert.equal(runIdOf({ GITHUB_RUN_ID: "36300000001", GITHUB_RUN_ATTEMPT: "1" }), "36300000001");
  for (const bad of [{}, { GITHUB_RUN_ID: "" }, { GITHUB_RUN_ID: "12a" }, { GITHUB_RUN_ID: "1".repeat(21) }]) {
    assert.match(runIdOf(bad), /^local-\d+$/, `${JSON.stringify(bad)} became a run id`);
  }
  assert.equal(MARKER.name, "Canary rules 36300000001");
  assert.ok(Object.isFrozen(MARKER));
  const row = { id: 9, name: MARKER.name, phone: MARKER.phone, party_size: 2, booking_date: "2099-12-31", booking_time: "17:00:00", created_at: "x" };
  assert.equal(rowIsMarker(row, MARKER), true);
  // As the driver can hand them back: a numeric string, a date at midnight UTC, a time without seconds.
  assert.equal(rowIsMarker({ ...row, party_size: "2", booking_date: "2099-12-31T00:00:00.000Z", booking_time: "17:00" }, MARKER), true);
  for (const [k, v] of [["name", "Canary rules 36300000002"], ["name", "Canary rules"], ["phone", "07700900999"], ["party_size", 3],
    ["booking_date", "2099-12-30"], ["booking_date", "2099-12-31T01:00:00Z"], ["booking_time", "17:30:00"], ["booking_time", null]]) {
    assert.equal(rowIsMarker({ ...row, [k]: v }, MARKER), false, `a row with ${k}=${JSON.stringify(v)} read as the marker`);
  }
  assert.equal(rowIsMarker(null, MARKER), false);
});

test("what the form sent must be exactly the marker's five fields, each its value", () => {
  const body = { name: MARKER.name, phone: MARKER.phone, party_size: 2, booking_date: "2099-12-31", booking_time: "17:00" };
  assert.deepEqual(bookingBodyVerdict(body, MARKER), { ok: true, why: "" });
  assert.equal(bookingBodyVerdict(JSON.stringify(body), MARKER).ok, true);
  assert.match(bookingBodyVerdict({ ...body, email: "x@y.z" }, MARKER).why, /fields sent were/);
  const { phone, ...short } = body;
  assert.match(bookingBodyVerdict(short, MARKER).why, /fields sent were/);
  assert.match(bookingBodyVerdict({ ...body, party_size: "2" }, MARKER).why, /party_size was sent as "2"/);
  assert.match(bookingBodyVerdict({ ...body, name: "Canary rules" }, MARKER).why, /name was sent/);
  assert.match(bookingBodyVerdict("{not json", MARKER).why, /not JSON/);
  assert.match(bookingBodyVerdict([body], MARKER).why, /not an object/);
});

test("the booking gate lets out only the first request, exactly the marker, with no query string and no prefer or authorization header", () => {
  const raw = JSON.stringify({ name: MARKER.name, phone: MARKER.phone, party_size: 2, booking_date: "2099-12-31", booking_time: "17:00" });
  const H = { "content-type": "application/json" };
  const gate = (over = {}) => bookingGate({ n: 1, raw, search: "", headers: H, marker: MARKER, ...over });
  // THE ONE EXACT REQUEST is let out, and nothing about it is rewritten.
  const ok = gate();
  assert.deepEqual({ ok: ok.ok, why: ok.why, check: ok.check }, { ok: true, why: "", check: { ok: true, why: "" } });
  assert.deepEqual(Object.keys(ok).sort(), ["check", "ok", "why"], "the gate hands back something to send in place of what the page sent");
  assert.equal(gate({ headers: { ...H, accept: "*/*" } }).ok, true, "a harmless header refused");
  // EVERYTHING ELSE IS STOPPED, WITH ITS REASON.
  for (const [over, re] of [
    [{ n: 2 }, /a second booking request: only the first is ever let out/],
    [{ n: 0 }, /a second booking request/],
    [{ raw: raw.slice(0, -1) }, /not the marker booking: the request body is not JSON/],
    [{ raw: null }, /not the marker booking: the request body is not an object/],
    [{ raw: JSON.stringify({ ...JSON.parse(raw), phone: "07700 900111" }) }, /phone was sent as "07700 900111", not "07700 900999"/],
    [{ raw: JSON.stringify({ ...JSON.parse(raw), party_size: "2" }) }, /party_size was sent as "2"/],
    [{ raw: JSON.stringify({ ...JSON.parse(raw), note: "x" }) }, /the fields sent were/],
    [{ search: "?on_conflict=id" }, /query string \(\?on_conflict=id\)/],
    [{ search: undefined }, /query string/],
    [{ search: null }, /query string/],
    [{ headers: null }, /headers could not be read/],
    [{ headers: "content-type: application/json" }, /headers could not be read/],
    [{ headers: { ...H, prefer: "return=representation" } }, /must not send: prefer$/],
    [{ headers: { ...H, Prefer: "return=minimal" } }, /must not send: prefer$/],
    [{ headers: { ...H, authorization: "Bearer member" } }, /must not send: authorization$/],
    [{ headers: { ...H, prefer: "x", authorization: "y" } }, /must not send: prefer, authorization$/],
  ]) {
    const g = gate(over);
    assert.equal(g.ok, false, JSON.stringify(over));
    assert.match(g.why, re, JSON.stringify(over));
  }
  // The body's own verdict rides along even when something else stopped it.
  assert.equal(gate({ n: 2 }).check.ok, true);
});

test("the refused headers are exactly the ones the platform's data route passes on that change what the database checks", () => {
  // Read out of worker.js, so a route that starts passing another header on
  // fails here and the gate has to decide about it.
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const m = src.match(/const target = base \+ "\/" \+ path \+ \(url\.search \|\| ""\);\n[\s\S]*?for \(const h of (\[[^\]]*\])\) \{/);
  assert.ok(m, "the data route's forwarding lines were not found");
  const forwarded = JSON.parse(m[1]);
  assert.ok(forwarded.includes("content-type") && forwarded.length >= 3, "the forwarded list was not read");
  // The query string is passed on too (the first line of the match), which is why the gate refuses one.
  const harmless = ["content-type", "accept", "cookie"];
  assert.deepEqual(forwarded.filter((h) => !harmless.includes(h)).sort(), [...BOOKING_HEADERS_REFUSED].sort());
});

// ── THE BOOKING'S ANSWER ────────────────────────────────────────────────────

test("a booking's answer is classified by what Postgres checks first", () => {
  const c = (res) => classifyBooking(res, SPEC);
  assert.equal(c({ status: 403, json: DENIED }).verdict, "pass");
  assert.equal(c({ status: 403, text: JSON.stringify(DENIED) }).verdict, "pass", "the body was not read from its text");
  // The booking went in.
  assert.equal(c({ status: 201, text: "" }).verdict, "fail");
  assert.equal(c({ status: 200, json: [] }).verdict, "fail");
  // Refused by a constraint or a format check: the privilege check was passed to get there.
  for (const code of ["23505", "23502", "23514", "22007", "22P02"]) {
    const v = c({ status: 409, json: { code, message: "x" } });
    assert.equal(v.verdict, "fail", `${code} read as ${v.verdict}`);
  }
  // Refused by row security, with the insert privilege still there.
  assert.equal(c({ status: 403, json: { code: "42501", message: 'new row violates row-level security policy for table "bookings"' } }).verdict, "partial");
  // Everything else is inconclusive, never a pass.
  for (const res of [
    { status: 403, json: { error: "turnstile" } },
    { status: 401, json: DENIED },
    { status: 403, json: { code: "42501", message: "permission denied for table menu_items" } },
    { status: 403, json: { code: "42501", message: "permission denied for table bookings." } },
    { status: 400, json: { code: "PGRST204", message: "Could not find the column" } },
    { status: 500, json: { code: "XX000", message: "internal" } },
    { status: 502, text: "<html>bad gateway</html>" },
    { status: 503, text: "" },
    { status: 0, failed: "net::ERR_CONNECTION_RESET" },
    {},
    null,
  ]) {
    const v = c(res);
    assert.equal(v.verdict, "inconclusive", `${JSON.stringify(res)} read as ${v.verdict}`);
  }
  assert.match(c({ status: 0, failed: "net::ERR_CONNECTION_RESET" }).why, /no answer arrived \(net::ERR_CONNECTION_RESET\)/);
  // The facts ride along.
  assert.deepEqual((({ status, code, message }) => ({ status, code, message }))(c({ status: 403, json: DENIED })), { status: 403, code: "42501", message: DENIED.message });
});

// ── THE OWNER'S VIEW ────────────────────────────────────────────────────────

const listing = (access = "collect", rows = 0, extra = []) => ({
  status: 200,
  json: { tables: [{ name: "bookings", access, rows, columns: ["name", "phone"], memberRows: false, paid: false }, { name: "menu_items", access: "display", rows: 6, columns: [] }, ...extra] },
});
const newest = (rows) => ({ status: 200, json: { rows: [...rows].sort((a, b) => b.id - a.id), limit: NEWEST_ROWS } });

test("an access label reads back to its pair, and anything else to nothing", () => {
  assert.deepEqual(pairOfLabel("collect"), { read: "none", write: "anyone" });
  assert.deepEqual(pairOfLabel("admin"), { read: "members", write: "none" });
  assert.deepEqual(pairOfLabel("read none / write none"), { read: "none", write: "none" });
  assert.deepEqual(pairOfLabel(" Read None / Write Anyone "), { read: "none", write: "anyone" });
  for (const bad of ["", "closed", "read none / write everyone", "read nobody / write none", null, 7, "constructor"]) {
    assert.equal(pairOfLabel(bad), null, `${JSON.stringify(bad)} read as a pair`);
  }
});

test("the table listing is a map by name, and a listing that cannot be read is never an empty site", () => {
  const t = tablesOf(listing());
  assert.equal(t.ok, true);
  assert.deepEqual(t.names, ["bookings", "menu_items"]);
  assert.deepEqual(t.tables.bookings.pair, { read: "none", write: "anyone" });
  assert.equal(t.tables.bookings.rows, 0);
  assert.match(tablesOf({ status: 500, json: {} }).why, /status 500/);
  assert.match(tablesOf({ status: 200, json: {} }).why, /no tables list/);
  assert.match(tablesOf(listing("collect", 0, [{ name: "BOOKINGS", access: "collect", rows: 1 }])).why, /appears twice/);
  assert.match(tablesOf({ status: 200, json: { tables: [{ access: "collect" }] } }).why, /without a name/);
  assert.equal(tablesOf({ status: 200, json: { tables: [{ name: "bookings", access: "collect", rows: null }] } }).tables.bookings.rows, null);
});

test("the census is the listing's exact count and the newest rows, and either unreadable refuses", () => {
  const rows = [{ id: 3, name: "a" }, { id: 7, name: "b" }];
  const c = censusOf(tablesOf(listing("collect", 2)), newest(rows), SPEC);
  assert.deepEqual({ ok: c.ok, count: c.count, ids: c.ids }, { ok: true, count: 2, ids: [3, 7] });
  assert.match(censusOf(tablesOf({ status: 500 }), newest(rows), SPEC).why, /the table listing/);
  assert.match(censusOf(tablesOf(listing("collect", null)), newest(rows), SPEC).why, /row count could not be read/);
  assert.match(censusOf({ ok: true, tables: {}, names: [] }, newest(rows), SPEC).why, /no bookings table/);
  assert.match(censusOf(tablesOf(listing("collect", 2)), { status: 503 }, SPEC).why, /the newest rows: status 503/);
  assert.match(censusOf(tablesOf(listing("collect", 2)), { status: 200, json: { rows: [{ id: 3 }, { id: 3 }] } }, SPEC).why, /appears twice/);
});

const census = (rows, count = rows.length) => censusOf(tablesOf(listing("collect", count)), newest(rows), SPEC);
const markerRow = (id, over = {}) => ({ id, name: MARKER.name, phone: MARKER.phone, party_size: 2, booking_date: "2099-12-31", booking_time: "17:00:00", ...over });

test("an insertion is named row by row: ours, somebody else's, or one that went — never offset against each other", () => {
  const before = census([{ id: 1, name: "Real One" }, { id: 2, name: "Real Two" }]);
  assert.deepEqual(insertionVerdict(before, census([{ id: 1, name: "Real One" }, { id: 2, name: "Real Two" }]), MARKER),
    { ok: true, readable: true, delta: 0, added: [], gone: [], markers: [], others: [], why: "no row was added" });
  // Ours went in.
  const ours = insertionVerdict(before, census([{ id: 1 }, { id: 2 }, markerRow(3)]), MARKER);
  assert.deepEqual({ ok: ours.ok, delta: ours.delta, added: ours.added, markers: ours.markers, others: ours.others }, { ok: false, delta: 1, added: [3], markers: [3], others: [] });
  // UNEXPECTED: a row appeared that is not ours — reported, never taken for ours.
  const theirs = insertionVerdict(before, census([{ id: 1 }, { id: 2 }, { id: 3, name: "Walk-in" }]), MARKER);
  assert.deepEqual({ ok: theirs.ok, markers: theirs.markers, others: theirs.others }, { ok: false, markers: [], others: [3] });
  assert.match(theirs.why, /row\(s\) 3 appeared without the marker/);
  // Both at once: each named.
  const both = insertionVerdict(before, census([{ id: 1 }, { id: 2 }, markerRow(3), { id: 4, name: "Walk-in" }]), MARKER);
  assert.deepEqual({ markers: both.markers, others: both.others }, { markers: [3], others: [4] });
  // A row that went is named too, and a net zero (one in, one out) is not "nothing happened".
  const swap = insertionVerdict(before, census([{ id: 1 }, { id: 3, name: "Walk-in" }]), MARKER);
  assert.deepEqual({ ok: swap.ok, delta: swap.delta, added: swap.added, gone: swap.gone }, { ok: false, delta: 0, added: [3], gone: [2] });
  // The count alone moving (a row outside the newest window) is still a finding.
  assert.equal(insertionVerdict(before, census([{ id: 1 }, { id: 2 }], 3), MARKER).ok, false);
  // And a row that went is a finding on its own, with nothing added and the
  // count unmoved: the listing and the rows are two reads, so a count taken a
  // moment before the owner's delete landed still says 2 while the rows say one went.
  const went = insertionVerdict(before, census([{ id: 1 }], 2), MARKER);
  assert.deepEqual({ ok: went.ok, delta: went.delta, added: went.added, gone: went.gone, markers: went.markers },
    { ok: false, delta: 0, added: [], gone: [2], markers: [] });
  assert.match(went.why, /row\(s\) 2 went/);
  // Unreadable is its own answer, never "no row".
  const blind = insertionVerdict(before, censusOf(tablesOf({ status: 500 }), newest([]), SPEC), MARKER);
  assert.deepEqual({ ok: blind.ok, readable: blind.readable }, { ok: false, readable: false });
  assert.match(blind.why, /after/);
});

test("rows an earlier run of this test left behind are found by the marker's own prefix", () => {
  assert.deepEqual(leftovers(census([{ id: 1, name: "Real" }, { id: 2, name: "Canary rules 123" }, { id: 3, name: "Canary rulesX" }]), SPEC.marker), [2]);
  assert.deepEqual(leftovers(census([]), SPEC.marker), []);
  assert.deepEqual(leftovers({ ok: false }, SPEC.marker), []);
});

// ── THE EXACT CLEANUP ───────────────────────────────────────────────────────

test("the cleanup deletes exactly one new row holding every marker value, and nothing in any other case", () => {
  const before = census([{ id: 1 }, { id: 2 }]);
  assert.deepEqual(cleanupPlan(before, census([{ id: 1 }, { id: 2 }, markerRow(3)]), MARKER), { act: "delete", why: "one new row holds every marker value", id: 3, ids: [3] });
  // Somebody else's new row is never chosen, even beside ours.
  assert.equal(cleanupPlan(before, census([{ id: 1 }, { id: 2 }, markerRow(3), { id: 4, name: "Walk-in" }]), MARKER).id, 3);
  // Two of ours: none is deleted.
  const two = cleanupPlan(before, census([{ id: 1 }, { id: 2 }, markerRow(3), markerRow(4)]), MARKER);
  assert.deepEqual({ act: two.act, ids: two.ids }, { act: "refuse", ids: [3, 4] });
  // A new row that differs in one value is not ours.
  for (const over of [{ phone: "07700 900998" }, { party_size: 3 }, { booking_date: "2099-12-30" }, { booking_time: "16:30:00" }, { name: "Canary rules 1" }]) {
    assert.equal(cleanupPlan(before, census([{ id: 1 }, { id: 2 }, markerRow(3, over)]), MARKER).act, "refuse", `${JSON.stringify(over)} was chosen`);
  }
  // A marker-shaped row that was THERE BEFORE can never be chosen.
  const old = census([{ id: 1 }, markerRow(2)]);
  assert.equal(cleanupPlan(old, census([{ id: 1 }, markerRow(2)]), MARKER).act, "refuse");
  // Nothing readable, nothing deleted.
  assert.equal(cleanupPlan(before, { ok: false }, MARKER).act, "refuse");
});

test("just before the delete the chosen row is read again, and a row that changed or went is left alone", () => {
  assert.deepEqual(stillMarker(newest([markerRow(3)]), 3, MARKER), { ok: true, why: "" });
  assert.match(stillMarker(newest([markerRow(3, { phone: "07700 900111" })]), 3, MARKER).why, /no longer holds/);
  assert.match(stillMarker(newest([{ id: 4 }]), 3, MARKER).why, /no longer there/);
  assert.match(stillMarker({ status: 500 }, 3, MARKER).why, /could not be read again/);
});

test("the delete's answer must name that row, and a table that keeps deleted rows is said as hidden", () => {
  assert.deepEqual(deleteVerdict({ status: 200, json: { ok: true, id: 3, soft: false } }, 3), { ok: true, soft: false, why: "deleted" });
  assert.equal(deleteVerdict({ status: 200, json: { ok: true, id: 3, soft: true } }, 3).soft, true);
  assert.equal(deleteVerdict({ status: 200, json: { ok: true, id: 4, soft: false } }, 3).ok, false);
  assert.equal(deleteVerdict({ status: 200, json: { ok: true, id: "3" } }, 3).ok, false);
  assert.match(deleteVerdict({ status: 404, json: { error: "no such row" } }, 3).why, /404 "no such row"/);
  assert.equal(deleteVerdict(null, 3).ok, false);
});

test("the cleanup is checked: the count back and no marker, or for a soft delete the row marked deleted", () => {
  const before = census([{ id: 1 }, { id: 2 }]);
  assert.equal(cleanupVerified(before, census([{ id: 1 }, { id: 2 }]), MARKER).ok, true);
  assert.match(cleanupVerified(before, census([{ id: 1 }, { id: 2 }, markerRow(3)]), MARKER).why, /still holds the marker/);
  assert.match(cleanupVerified(before, census([{ id: 1 }]), MARKER).why, /count is 1, not 2/);
  assert.match(cleanupVerified(before, { ok: false, why: "status 500" }, MARKER).why, /could not be read/);
  assert.equal(cleanupVerified(before, census([{ id: 1 }, { id: 2 }, markerRow(3, { deleted_at: "2026-09-27" })]), MARKER, true).ok, true);
  assert.equal(cleanupVerified(before, census([{ id: 1 }, { id: 2 }, markerRow(3, { deleted_at: null })]), MARKER, true).ok, false);
});

// ── WHAT A BOOKING THAT WENT IN COULD SET OFF ───────────────────────────────

test("the secrets list is reduced to names: no prefix, no last digits, nothing else leaves", () => {
  const res = { status: 200, json: { ok: true, secrets: [
    { name: "RESEND_KEY", prefix: "re_9Zx", last4: "Q7w2", mode: "live", created_at: "t" },
    { name: "email_from", prefix: "noreply@", last4: ".com", created_at: "t" },
    { name: "RESEND_KEY", prefix: "re_9Zx", last4: "Q7w2" },
  ], webhook: { at: "t", status: 200 } } };
  const n = readSecretNames(res);
  assert.deepEqual(n, { ok: true, names: ["EMAIL_FROM", "RESEND_KEY"] });
  const s = JSON.stringify(n);
  for (const leak of ["re_9Zx", "Q7w2", "noreply@", ".com", "live"]) assert.ok(!s.includes(leak), `${leak} left the reader`);
  assert.match(readSecretNames({ status: 503, json: { ok: false } }).why, /status 503/);
  assert.match(readSecretNames({ status: 200, json: { ok: true } }).why, /no secrets list/);
  assert.match(readSecretNames({ status: 200, json: { ok: true, secrets: [{ name: "1BAD" }] } }).why, /without a readable name/);
  assert.deepEqual(readSecretNames({ status: 200, json: { ok: true, secrets: [] } }), { ok: true, names: [] });
});

test("a channel can send only when its sender would find everything it needs — asked of the senders' own tables", () => {
  assert.deepEqual([...SEND_CHANNELS], ["email", "text", "webhook"]);
  const none = sendsPossible([]);
  assert.deepEqual({ possible: none.possible, partial: none.partial, turnstile: none.turnstile }, { possible: [], partial: [], turnstile: [] });
  // EVERY mail provider the sender knows, each with and without the from-address.
  for (const p of MAIL_PROVIDERS) {
    assert.deepEqual(sendsPossible([p.secret, "EMAIL_FROM"]).possible, ["email"], `${p.secret} with EMAIL_FROM cannot send`);
    const half = sendsPossible([p.secret]);
    assert.deepEqual({ possible: half.possible, partial: half.partial }, { possible: [], partial: ["email"] }, `${p.secret} alone`);
  }
  assert.deepEqual(sendsPossible(["EMAIL_FROM"]).partial, ["email"]);
  // EVERY text provider, whole and half.
  for (const p of SMS_PROVIDERS) {
    const whole = [p.secret, p.also, "SMS_FROM"].filter(Boolean);
    assert.deepEqual(sendsPossible(whole).possible, ["text"], `${whole.join("+")} cannot send`);
    assert.deepEqual(sendsPossible([p.secret, p.also].filter(Boolean)).possible, [], `${p.secret} without SMS_FROM can send`);
    if (p.also) assert.deepEqual(sendsPossible([p.secret, "SMS_FROM"]).possible, [], `${p.secret} without ${p.also} can send`);
  }
  // A webhook needs a destination.
  assert.deepEqual(sendsPossible(["WEBHOOK_URL"]).possible, ["webhook"]);
  assert.deepEqual(sendsPossible(["WEBHOOK_URL_BOOKINGS"]).possible, ["webhook"]);
  assert.deepEqual(sendsPossible(["WEBHOOK_SIGNING"]).partial, ["webhook"]);
  // Secrets that send nothing on a booking.
  assert.deepEqual(sendsPossible(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "OPENAI_KEY"]).possible, []);
  assert.deepEqual(sendsPossible(["TURNSTILE_SECRET"]).turnstile, ["TURNSTILE_SECRET"]);
});

test("the approvals box is read whole: known words only, and anything else refuses", () => {
  assert.deepEqual(readAllow(""), { ok: true, cleanup: false, sends: [], words: [] });
  assert.deepEqual(readAllow(undefined), { ok: true, cleanup: false, sends: [], words: [] });
  assert.deepEqual(readAllow(" Cleanup, EMAIL  webhook,email "), { ok: true, cleanup: true, sends: ["email", "webhook"], words: ["cleanup", "email", "webhook"] });
  assert.deepEqual(readAllow("cleanup").sends, []);
  for (const bad of ["cleanup yes", "all", "sms", "delete", "cleanup;email"]) {
    const a = readAllow(bad);
    assert.equal(a.ok, false, `${bad} was read`);
    assert.match(a.msg, /not one of: cleanup, email, text, webhook/);
  }
  assert.equal(readAllow(7).ok, false);
  assert.equal(readAllow(["cleanup"]).ok, false);
});

test("the paid press may send only when every possible send is approved, no bot check stands in the way, and the names were read", () => {
  const names = (n) => ({ ok: true, names: n });
  assert.match(sendsGate(names([]), readAllow("")).why, /no secret here can send anything/);
  assert.equal(sendsGate(names([]), readAllow("")).ok, true);
  const mail = sendsGate(names(["RESEND_KEY", "EMAIL_FROM"]), readAllow("cleanup"));
  assert.deepEqual({ ok: mail.ok, needs: mail.needs }, { ok: false, needs: ["email"] });
  assert.match(mail.why, /could send by email, which is not approved/);
  assert.equal(sendsGate(names(["RESEND_KEY", "EMAIL_FROM"]), readAllow("email")).ok, true);
  const two = sendsGate(names(["RESEND_KEY", "EMAIL_FROM", "WEBHOOK_URL"]), readAllow("email"));
  assert.deepEqual(two.needs, ["webhook"]);
  // A partial set cannot send, so it needs no approval.
  assert.equal(sendsGate(names(["RESEND_KEY"]), readAllow("")).ok, true);
  assert.match(sendsGate(names(["TURNSTILE_SECRET"]), readAllow("email text webhook cleanup")).why, /bot check is configured/);
  assert.match(sendsGate({ ok: false, why: "status 503" }, readAllow("email text webhook")).why, /could not be read \(status 503\)/);
  assert.equal(sendsGate(null, readAllow("")).ok, false);
});

test("the notification record is one row with a real setting and a stamp that is a time or nothing", () => {
  assert.deepEqual(readStamp({ status: 200, rows: [{ notify: true, notified_at: null }] }), { ok: true, notify: true, notifiedAt: null });
  assert.equal(readStamp({ status: 200, rows: [{ notify: false, notified_at: "2026-09-27T00:00:00Z" }] }).notifiedAt, "2026-09-27T00:00:00Z");
  for (const bad of [{ status: 500, rows: [] }, { status: 200, rows: [] }, { status: 200, rows: [{}, {}] }, { status: 200, rows: [{ notify: "true", notified_at: null }] },
    { status: 200, rows: [{ notify: true, notified_at: 7 }] }, { status: 200, rows: { notify: true } }, null]) {
    assert.equal(readStamp(bad).ok, false, `${JSON.stringify(bad)} was read`);
  }
});

// ── THE EDIT: EITHER SUPPORTED WAY OF CLOSING ───────────────────────────────

const stored = (fields, over = {}) => ({ ok: true, layer: "rules", applied: [{ table: "bookings", fields }], refused: [], msg: "✅ **bookings** — changed it.", cost: 1, ...over });
const T = (access = "collect", menu = "display") => tablesOf({ status: 200, json: { tables: [{ name: "bookings", access, rows: 0 }, { name: "menu_items", access: menu, rows: 6 }] } });

test("either supported way of closing is accepted on what the job changed and what the listing shows, never on its wording", () => {
  const byRetired = closingVerdict({ stored: stored(["retired"]), before: T(), after: T(), spec: SPEC });
  assert.deepEqual({ ok: byRetired.ok, method: byRetired.method, access: byRetired.access }, { ok: true, method: "retired", access: { before: "collect", after: "collect" } });
  const byWrite = closingVerdict({ stored: stored(["write"]), before: T(), after: T("read none / write none"), spec: SPEC });
  assert.deepEqual({ ok: byWrite.ok, method: byWrite.method }, { ok: true, method: "write none" });
  const both = closingVerdict({ stored: stored(["write", "retired"]), before: T(), after: T("read none / write none"), spec: SPEC });
  assert.deepEqual({ ok: both.ok, method: both.method }, { ok: true, method: "retired and write none" });
  // `read` may ride along as long as it does not move.
  assert.equal(closingVerdict({ stored: stored(["read", "write"]), before: T(), after: T("read none / write none"), spec: SPEC }).ok, true);
  // THE WORDING IS NOT READ: any sentence, either implementation's or none, gives the same verdict.
  for (const msg of ["✅ **bookings** — changed whether it's open.", "✅ **bookings** — changed who can add to it.", "anything at all", ""]) {
    assert.equal(closingVerdict({ stored: stored(["retired"], { msg }), before: T(), after: T(), spec: SPEC }).ok, true, `the verdict read "${msg}"`);
  }
  // A refusal beside the closing is carried, not failed on.
  assert.deepEqual(closingVerdict({ stored: stored(["retired"], { refused: [{ table: "bookings", rule: "noOverlap", why: "not-integers" }] }), before: T(), after: T(), spec: SPEC }).refused,
    [{ table: "bookings", rule: "noOverlap", why: "not-integers" }]);
});

test("a reply that does not close bookings, or a listing that disagrees, is refused before any booking", () => {
  const no = (args, re) => {
    const v = closingVerdict({ before: T(), after: T(), spec: SPEC, ...args });
    assert.equal(v.ok, false, JSON.stringify(args));
    assert.match(v.why, re);
  };
  no({ stored: null }, /no stored reply/);
  no({ stored: stored(["retired"], { ok: false }) }, /not ok/);
  no({ stored: stored(["retired"], { layer: "data" }) }, /data layer's/);
  no({ stored: stored(["retired"], { applied: [] }) }, /names 0 changed tables/);
  no({ stored: stored(["retired"], { applied: [{ table: "bookings", fields: ["retired"] }, { table: "menu_items", fields: ["read"] }] }) }, /names 2 changed tables/);
  no({ stored: stored(["retired"], { applied: [{ table: "menu_items", fields: ["retired"] }] }) }, /changed menu_items, not bookings/);
  no({ stored: stored(["maxRows"]) }, /changed maxRows on bookings, which is not closing it/);
  no({ stored: stored(["retired", "unique"]) }, /changed unique/);
  no({ stored: stored(["read"]) }, /which does not close it/);
  no({ stored: stored([]) }, /changed nothing/);
  // The listing must agree.
  no({ stored: stored(["write"]), after: T("collect") }, /write rule became anyone/);
  no({ stored: stored(["write"]), after: T("read members / write none") }, /who can read bookings moved from none to members/);
  no({ stored: stored(["retired"]), after: T("read none / write none") }, /moved from anyone to none without the reply saying so/);
  no({ stored: stored(["retired"]), after: T("collect", "read none / write none") }, /menu_items changed access too/);
  no({ stored: stored(["retired"]), after: tablesOf({ status: 200, json: { tables: [{ name: "bookings", access: "collect", rows: 0 }] } }) }, /the tables were/);
  no({ stored: stored(["retired"]), after: tablesOf({ status: 500 }) }, /could not be read after/);
  no({ stored: stored(["retired"]), after: T("mystery") }, /access could not be read after/);
});

// ── THE SITE'S SURFACE ──────────────────────────────────────────────────────

const PAGE = (t, extra = "") => `<html><head><link rel="stylesheet" href="${REC.stylesheet.path}"></head><body>${extra}<script>$R=[{u:${t},p:1},{i:2,u:${t + 5}}]</script></body></html>`;
const CSS = Buffer.from("x".repeat(REC.stylesheet.bytes));
function site({ build = REC.build, version = "", css = CSS, pages = {}, status = 200, t = 1790000000000 } = {}) {
  const got = [];
  const get = async (url) => {
    got.push(url);
    const u = new URL(url);
    const headers = { get: (k) => (k === "x-site-build" ? build : k === "x-site-version" ? version : null) };
    if (u.pathname === REC.stylesheet.path) return { status: 200, headers, bytes: css };
    return { status, headers, bytes: Buffer.from(pages[u.pathname] !== undefined ? pages[u.pathname] : PAGE(t)) };
  };
  return { get, got };
}

test("the render time is the one thing masked on a page", () => {
  assert.equal(maskRenderTimes("$R=[{u:1790000000000,p:1},{i:2,u:1790000000005}]"), "$R=[{u:0,p:1},{i:2,u:0}]");
  assert.equal(maskRenderTimes("{u:12}"), "{u:12}", "a short number is not a render time");
  assert.equal(maskRenderTimes("{uu:1790000000000}"), "{uu:1790000000000}");
});

test("the surface is read per route, with its build, its stylesheet byte for byte, and render times masked", async () => {
  const s = site();
  const a = await readSurface({ origin: "https://lido-axes-b.gofarther.app", routes: REC.routes, get: s.get });
  assert.deepEqual(Object.keys(a.routes), ["/", "/book", "/menu"]);
  assert.deepEqual({ ...a.routes["/book"], sha256: undefined }, { status: 200, build: REC.build, version: "", bytes: PAGE(1790000000000).length, masked: 2, sha256: undefined, styles: [REC.stylesheet.path] });
  assert.equal(a.styles[REC.stylesheet.path].bytes, REC.stylesheet.bytes);
  assert.ok(s.got.includes("https://lido-axes-b.gofarther.app" + REC.stylesheet.path), "the stylesheet was not fetched");
  // Two reads at different render times read the same.
  const b = await readSurface({ origin: "https://lido-axes-b.gofarther.app", routes: REC.routes, get: site({ t: 1790000999999 }).get });
  assert.equal(surfaceSame(a, b).ok, true);
  // A route that throws is status 0, not a page.
  const dead = await readSurface({ origin: "https://x", routes: ["/"], get: async () => { throw new Error("reset"); } });
  assert.deepEqual(dead.routes["/"], { status: 0 });
});

test("the site starts where it was recorded: every page on the build, no version header, the one stylesheet byte for byte", async () => {
  const origin = "https://lido-axes-b.gofarther.app";
  const good = await readSurface({ origin, routes: REC.routes, get: site().get });
  const withSha = { ...good, styles: { [REC.stylesheet.path]: { status: 200, bytes: REC.stylesheet.bytes, sha256: REC.stylesheet.sha256 } } };
  assert.deepEqual(surfaceStart(withSha, REC), { ok: true, why: "" });
  // The real bytes are not the recorded bytes.
  assert.match(surfaceStart(good, REC).why, /not the recorded 209105, 6f7ca4bc53e559a7/);
  const bad = async (over) => surfaceStart({ ...(await readSurface({ origin, routes: REC.routes, get: site(over).get })), styles: withSha.styles }, REC);
  assert.match((await bad({ build: "mt60aaaa-zzzzzz" })).why, /on build mt60aaaa-zzzzzz, not mt50cg7h-l19hre/);
  assert.match((await bad({ version: "01790500000000-abcdef" })).why, /carries a version header/);
  assert.match((await bad({ status: 404 })).why, /answered 404/);
  assert.match((await bad({ pages: { "/book": "<html><link rel=\"stylesheet\" href=\"/assets/other.css\"></html>" } })).why, /links \/assets\/other\.css/);
  assert.match(surfaceStart(null, REC).why, /not read/);
});

test("nothing published on the older layout: the same build, no version appearing, every page and stylesheet the same", async () => {
  const origin = "https://lido-axes-b.gofarther.app";
  const read = async (over) => readSurface({ origin, routes: REC.routes, get: site(over).get });
  const before = await read();
  assert.deepEqual(surfaceSame(before, await read({ t: 1791111111111 })), { ok: true, why: "" });
  assert.match(surfaceSame(before, await read({ build: "mt60aaaa-zzzzzz" })).why, /moved from build mt50cg7h-l19hre to mt60aaaa-zzzzzz/);
  assert.match(surfaceSame(before, await read({ version: "01790500000000-abcdef" })).why, /gained a version header/);
  assert.match(surfaceSame(before, await read({ pages: { "/menu": PAGE(1790000000000, "<p>Closed</p>") } })).why, /\/menu changed/);
  assert.match(surfaceSame(before, await read({ css: Buffer.from("y".repeat(REC.stylesheet.bytes)) })).why, /is not byte for byte the same/);
  assert.match(surfaceSame(before, await read({ status: 500 })).why, /answered 200 then 500/);
  assert.match(surfaceSame(before, await readSurface({ origin, routes: ["/"], get: site().get })).why, /routes read before and after differ/);
  assert.match(surfaceSame(before, null).why, /not read at both ends/);
  const noCss = await readSurface({ origin, routes: ["/"], get: site({ pages: { "/": "<html></html>" } }).get });
  assert.match(surfaceSame(noCss, noCss).why, /no stylesheet was read/);
});

test("a visitor's reads are kept as facts: status, bytes, hash — and a refusal as its code and message", () => {
  const f = bodyFacts({ status: 200, text: "[{\"id\":1}]" });
  assert.deepEqual({ status: f.status, bytes: f.bytes, sha256: f.sha256 }, { status: 200, bytes: 10, sha256: sha("[{\"id\":1}]") });
  assert.deepEqual(bodyFacts({ status: 0, why: "reset" }), { status: 0, bytes: 0, sha256: "", text: null });
  assert.deepEqual(readRefusal({ status: 403, text: JSON.stringify(DENIED) }), { status: 403, code: "42501", message: DENIED.message });
  assert.deepEqual(readRefusal({ status: 502, text: "<html>" }), { status: 502, code: "", message: "" });
});

test("the stored source is compared file by file, and a missing body or path set is a refusal", () => {
  const src = { pages: [{ path: "index.tsx", source: "a" }, { path: "book.tsx", source: "b" }], parts: [{ name: "hero", source: "c" }] };
  assert.deepEqual(sourceSame(src, JSON.parse(JSON.stringify(src))), { ok: true, why: "", files: 3 });
  assert.match(sourceSame(src, { ...src, pages: [{ path: "index.tsx", source: "a" }, { path: "book.tsx", source: "B" }] }).why, /pages:book\.tsx changed/);
  assert.match(sourceSame(src, { ...src, parts: [] }).why, /before and after differ/);
  assert.match(sourceSame(src, { ...src, pages: [...src.pages, { path: "new.tsx", source: "d" }] }).why, /differ/);
  assert.match(sourceSame({ pages: [], parts: [] }, src).why, /no stored source was read before/);
  assert.match(sourceSame(src, { ...src, pages: [{ path: "index.tsx" }, { path: "book.tsx", source: "b" }] }).why, /has no body/);
});

test("nothing published, by readers that do not borrow from each other", () => {
  const row = { publish_started_at: null, published_at: null };
  const ok = { ok: true, why: "" };
  assert.deepEqual(legacyUnpublishedVerdict({ published: [], jobs: [{ job: "j", row }], surface: ok, source: ok }), { ok: true, why: "" });
  assert.match(legacyUnpublishedVerdict({ published: [{ id: "v" }], jobs: [{ job: "j", row }], surface: ok, source: ok }).why, /names 1 build/);
  assert.match(legacyUnpublishedVerdict({ published: [], jobs: [{ job: "j", row: { ...row, publish_started_at: "t" } }], surface: ok, source: ok }).why, /publish began/);
  assert.match(legacyUnpublishedVerdict({ published: [], jobs: [{ job: "j" }], surface: ok, source: ok }).why, /no readable row/);
  assert.match(legacyUnpublishedVerdict({ published: [], jobs: [{ job: "j", row }], surface: { ok: false, why: "/ changed" }, source: ok }).why, /pages or stylesheet: \/ changed/);
  assert.match(legacyUnpublishedVerdict({ published: [], jobs: [{ job: "j", row }], surface: ok, source: null }).why, /stored source: not compared/);
});

// ── WHERE THE TEST STARTS ───────────────────────────────────────────────────

const GOOD_SURFACE = () => ({
  at: "t",
  routes: Object.fromEntries(REC.routes.map((r) => [r, { status: 200, build: REC.build, version: "", bytes: 100, masked: 1, sha256: "p" + r, styles: [REC.stylesheet.path] }])),
  styles: { [REC.stylesheet.path]: { status: 200, bytes: REC.stylesheet.bytes, sha256: REC.stylesheet.sha256 } },
});
function io(over = {}) {
  const calls = [];
  const base = {
    tables: async () => { calls.push("tables"); return listing("collect", 1); },
    newest: async () => { calls.push("newest"); return newest([{ id: 5, name: "Real Person", phone: "07123 456789" }]); },
    secrets: async () => { calls.push("secrets"); return { status: 200, json: { ok: true, secrets: [] } }; },
    stamp: async () => { calls.push("stamp"); return { status: 200, rows: [{ notify: true, notified_at: null }] }; },
    menu: async () => { calls.push("menu"); return { status: 200, text: "x".repeat(REC.menu.bytes) }; },
    bookingsRead: async () => { calls.push("bookingsRead"); return { status: 403, text: JSON.stringify(DENIED) }; },
    surface: async () => { calls.push("surface"); return GOOD_SURFACE(); },
  };
  return { calls, io: { ...base, ...over } };
}

test("the state is read in one pass, the secret names only when asked, and a reader that throws is unreadable, not empty", async () => {
  const { calls, io: x } = io();
  const st = await readRulesState(x, SPEC);
  assert.deepEqual([...calls].sort(), ["bookingsRead", "menu", "newest", "secrets", "stamp", "surface", "tables"]);
  assert.deepEqual({ tables: st.tables.ok, census: st.census.ok, secrets: st.secrets, stamp: st.stamp.ok, menu: st.menu.status, read: st.bookingsRead.code }, { tables: true, census: true, secrets: { ok: true, names: [] }, stamp: true, menu: 200, read: "42501" });
  const again = io();
  assert.equal((await readRulesState(again.io, SPEC, { secrets: false })).secrets, null);
  assert.ok(!again.calls.includes("secrets"), "the secret names were read again after the edit");
  const broken = await readRulesState(io({ newest: async () => { throw new Error("reset"); }, secrets: async () => { throw new Error("reset"); } }).io, SPEC);
  assert.equal(broken.census.ok, false);
  assert.equal(broken.secrets.ok, false);
});

test("the paid press starts only where the test was written to start, and says which reading stopped it", async () => {
  const start = async (over, allow = readAllow("")) => rulesStartVerdict(await readRulesState(io(over).io, SPEC), SPEC, allow);
  const ok = await start({});
  assert.equal(ok.ok, true, ok.why);
  assert.deepEqual(ok.checks.map((c) => c.name), ["sends", "stamp", "tables", "open", "census", "read-refused", "menu", "surface"]);
  // The menu's bytes are reported, never a stop.
  assert.match(ok.checks.find((c) => c.name === "menu").why, /NOT the recorded 1208 bytes \(reported\)/);
  const stops = [
    [{ secrets: async () => ({ status: 200, json: { ok: true, secrets: [{ name: "RESEND_KEY" }, { name: "EMAIL_FROM" }] } }) }, "sends", /could send by email/],
    [{ secrets: async () => ({ status: 503, json: { ok: false } }) }, "sends", /could not be read/],
    [{ secrets: async () => ({ status: 200, json: { ok: true, secrets: [{ name: "TURNSTILE_SECRET" }] } }) }, "sends", /bot check/],
    [{ stamp: async () => ({ status: 500, rows: null }) }, "stamp", /status 500/],
    [{ tables: async () => listing("collect", 1, [{ name: "orders", access: "collect", rows: 0 }]) }, "tables", /bookings, menu_items, orders, not bookings, menu_items/],
    [{ tables: async () => listing("read none / write none", 1) }, "open", /visitors cannot add to it now/],
    [{ newest: async () => newest([{ id: 5, name: "Canary rules 36299999999" }]) }, "census", /rows 5 are from an earlier run/],
    [{ newest: async () => ({ status: 500 }) }, "census", /status 500/],
    [{ bookingsRead: async () => ({ status: 200, text: "[]" }) }, "read-refused", /answered 200/],
    [{ menu: async () => ({ status: 503, text: "" }) }, "menu", /503/],
    [{ surface: async () => ({ ...GOOD_SURFACE(), routes: { ...GOOD_SURFACE().routes, "/book": { status: 404 } } }) }, "surface", /\/book answered 404/],
  ];
  for (const [over, name, re] of stops) {
    const v = await start(over);
    assert.equal(v.ok, false, `${name} did not stop it`);
    const c = v.checks.find((x) => x.name === name);
    assert.equal(c.ok, false, `${name} passed`);
    assert.match(c.why, re);
    assert.match(v.why, new RegExp(`^${name}: |; ${name}: `));
  }
  // Approving the send is what clears it.
  const approved = await start({ secrets: async () => ({ status: 200, json: { ok: true, secrets: [{ name: "RESEND_KEY" }, { name: "EMAIL_FROM" }] } }) }, readAllow("email"));
  assert.equal(approved.ok, true, approved.why);
});

// ── THE RECORD AND THE ACCOUNT ──────────────────────────────────────────────

test("the record keeps row ids and never a visitor's name or number", async () => {
  const state = await readRulesState(io({ newest: async () => newest([{ id: 5, name: "Real Person", phone: "07123 456789" }, markerRow(6)]) }).io, SPEC);
  const r = { spec: SPEC, site: "lido-axes-b", marker: MARKER, allow: readAllow(""), before: state, after: state, dryAfter: state.census,
    cleanup: { plan: { act: "delete", id: 6, why: "x", ids: [6] }, final: state.census } };
  const out = rulesRecordable(r);
  const s = JSON.stringify(out);
  for (const leak of ["Real Person", "07123 456789", "x".repeat(40)]) assert.ok(!s.includes(leak), `${leak.slice(0, 20)} reached the record`);
  assert.deepEqual(out.before.census, { ok: true, count: 1, ids: [5, 6], markers: [6] });
  assert.deepEqual(out.cleanup.final, { ok: true, count: 1, ids: [5, 6], markers: [6] });
  assert.deepEqual(out.before.menu, { status: 200, bytes: REC.menu.bytes, sha256: sha("x".repeat(REC.menu.bytes)) });
  // Not a copy of a copy: the input is untouched.
  assert.equal(r.before.census.rows.length, 2);
  // And the account a person reads names ids, says the boundary, and leaks no row either.
  const told = describeRules({ ...r, start: rulesStartVerdict(state, SPEC, readAllow("")) });
  assert.ok(told.includes(EVIDENCE_BOUNDARY), "the account does not state what a pass cannot show");
  for (const leak of ["Real Person", "07123 456789"]) assert.ok(!told.includes(leak), `${leak} reached the account`);
  assert.match(told, /census     1 rows; newest ids 5, 6/);
});

test("the evidence boundary says what a pass shows and what it does not", () => {
  assert.match(EVIDENCE_BOUNDARY, /No booking was submitted before the edit/);
  assert.match(EVIDENCE_BOUNDARY, /configuration changing and a booking refused afterwards/);
  assert.match(EVIDENCE_BOUNDARY, /not a measured change from a booking that went through to one that was refused/);
});
