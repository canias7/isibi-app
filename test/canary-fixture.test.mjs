// The rows a paid data press is written for (after run 77, 2026-09-30).
//
// Run 77 paid for a deletion of a temporary row nobody had added yet, beside a
// price not yet put back: the routing call was bought and the job matched
// nothing. The check this file drives is opt-in and generic, and it runs before
// the first paid call.
//
// THREE LAYERS, each on what really produces it:
//   - THE PARSER, driven directly: a malformed box refuses before anything is
//     signed in or read;
//   - THE READ, which must be the whole table: `readWhole` over the Data API's
//     count contract (`Content-Range`, as measured through the Worker), so an
//     answer that leaves a row out stops (the owner's review, 2026-09-30);
//   - THE VERDICT, on reads taken by the canary's own reader (`readWhole`)
//     over bodies laid out as the site's own read serves them, and on its REAL
//     served body (the recorded four-row baseline, 736 bytes, a4f1dc30…);
//   - THE SCRIPT ITSELF, run end to end under a stub that answers every
//     network call in-process (`fixtures/canary-stub.mjs`): a setup that is
//     not as named stops with no routing call made, and a setup that is lets
//     the press go on.
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readExpectRows, readWhole, rowsDigest, canonical, fixtureVerdict, fixtureSaid, fixtureRecord } from "../scripts/canary-fixture.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── THE REAL SERVED BODY, AS RECORDED ─────────────────────────────────────
//
// `fretwork-1`'s `lessons` as the site's own read served it at Batch 1's
// baseline: 736 bytes, sha256 a4f1dc30…, in the Data API's own layout. The
// digests handed to the owner for the prepared press are computed from it.
const ROW = {
  1: { id: 1, name: "First lesson", description: "A free 45-minute taster in Crookes. Bring a guitar if you have one; there is a spare if not.", price: 0, duration: "45 minutes", created_at: "2026-09-02 16:57:02" },
  2: { id: 2, name: "Group of three", description: "Share a 45-minute lesson with two other beginners. Eighteen pounds each.", price: 18, duration: "45 minutes", created_at: "2026-09-02 16:57:02" },
  3: { id: 3, name: "One-to-one", description: "A private 45-minute lesson. Beginners welcome.", price: 30, duration: "45 minutes", created_at: "2026-09-02 16:57:02" },
  4: { id: 4, name: "Hour one-to-one", description: "A full hour when 45 minutes is not enough.", price: 40, duration: "60 minutes", created_at: "2026-09-02 16:57:02" },
};
const served = (rows) => "[" + rows.map((r) => JSON.stringify(r)).join(", \n ") + "]";
const BASELINE = [ROW[1], ROW[2], ROW[3], ROW[4]];
const BASELINE_BODY = served(BASELINE);
/** The temporary row the prepared deletion is written for, as the owner will enter it. */
const TUNE_UP = { name: "Ten-minute tune-up", description: "A quick ten-minute check on how your practice is going.", price: 10, duration: "10 minutes" };
const tuneUpRow = (id = 5) => ({ id, ...TUNE_UP, created_at: "2026-09-30 18:00:00" });
const at42 = { ...ROW[4], price: 42 };

/** The digests the prepared press names, pinned to what this module computes. */
const DELETE_BASELINE = "f93f11a2c1c90b77";
const PUTBACK_BASELINE = "9abd34f2b2c362eb";
const DELETE_BOX = JSON.stringify({ table: "lessons", baseline: DELETE_BASELINE, target: TUNE_UP });
const PUTBACK_BOX = JSON.stringify({ table: "lessons", baseline: PUTBACK_BASELINE, target: { id: 4, name: "Hour one-to-one", price: 40 } });

// The range a whole answer carries when the count was asked for: `0-3/4`, or
// `*/0` for no rows.
const wholeRange = (rows) => (rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0");
/**
 * The site's own read as the canary takes it: the served text and its
 * `Content-Range`, through `readWhole`. Whole by default, as the Data API
 * answers a read that asked for its count; `range: null` is no header.
 */
const read = (rows, { status = 200, text, range } = {}) => readWhole({ status, text: text !== undefined ? text : served(rows), range: range !== undefined ? range : wholeRange(rows) });
const expectOf = (box) => {
  const r = readExpectRows(box);
  assert.ok(r.ok, "the box did not parse: " + r.msg);
  return r.expect;
};

// ── THE BOX ─────────────────────────────────────────────────────────────────

test("a blank box is no check, and a filled one is read whole", () => {
  for (const blank of [undefined, null, "", "   "]) assert.deepEqual(readExpectRows(blank), { ok: true, expect: null });
  const e = expectOf(DELETE_BOX);
  assert.deepEqual(e, { table: "lessons", baseline: DELETE_BASELINE, target: TUNE_UP });
  assert.ok(readExpectRows(" " + PUTBACK_BOX + "\n").ok, "surrounding whitespace refused");
});

test("a malformed box refuses, each with its own reason", () => {
  const box = (o) => JSON.stringify(o);
  const good = { table: "lessons", baseline: DELETE_BASELINE, target: { name: "x" } };
  const cases = [
    [42, /not text/],
    ["table=lessons", /not JSON/],
    ["[1,2]", /one JSON object/],
    ['"lessons"', /one JSON object/],
    [box({ ...good, extra: 1 }), /extra/],
    [box({ baseline: good.baseline, target: good.target }), /no table/],
    [box({ table: "lessons", target: good.target }), /no baseline/],
    [box({ table: "lessons", baseline: good.baseline }), /no target/],
    [box({ ...good, table: "Lessons" }), /table/],
    [box({ ...good, table: "lessons; drop" }), /table/],
    [box({ ...good, table: 7 }), /table/],
    [box({ ...good, baseline: "f93f11a2c1c90b7" }), /baseline/],
    [box({ ...good, baseline: "F93F11A2C1C90B77" }), /baseline/],
    [box({ ...good, baseline: "f93f11a2c1c90b7z" }), /baseline/],
    [box({ ...good, baseline: "f".repeat(65) }), /baseline/],
    [box({ ...good, target: [] }), /target must be an object/],
    [box({ ...good, target: {} }), /names no field/],
    [box({ ...good, target: Object.fromEntries(Array.from({ length: 21 }, (_, i) => ["c" + i, 1])) }), /at most 20/],
    [box({ ...good, target: { "Name": "x" } }), /not a column's name/],
    [box({ ...good, target: { name: { a: 1 } } }), /not a string, a number, a boolean or null/],
    [box({ ...good, target: { name: ["x"] } }), /not a string, a number, a boolean or null/],
  ];
  for (const [raw, why] of cases) {
    const r = readExpectRows(raw);
    assert.equal(r.ok, false, `accepted: ${String(raw).slice(0, 80)}`);
    assert.match(r.msg, why, `wrong reason for ${String(raw).slice(0, 80)}: ${r.msg}`);
  }
  // THE EDGES THAT ARE ALLOWED: 16 and 64 hex characters, null and booleans.
  assert.ok(readExpectRows(box({ ...good, baseline: "0".repeat(16) })).ok);
  assert.ok(readExpectRows(box({ ...good, baseline: "0".repeat(64) })).ok);
  assert.ok(readExpectRows(box({ ...good, target: { photo: null, open: true, price: 4.5 } })).ok);
});

// ── THE DIGEST ──────────────────────────────────────────────────────────────

test("the digest is the rows' values, whatever the key order or row order, and a value's type counts", () => {
  const flipped = BASELINE.map((r) => Object.fromEntries(Object.entries(r).reverse()));
  assert.equal(rowsDigest(flipped), rowsDigest(BASELINE), "key order changed the digest");
  assert.equal(rowsDigest([...BASELINE].reverse()), rowsDigest(BASELINE), "row order changed the digest");
  assert.notEqual(rowsDigest([ROW[1], ROW[2], ROW[3], { ...ROW[4], price: "40" }]), rowsDigest(BASELINE), "a price read as text digests like a number");
  assert.notEqual(rowsDigest([ROW[1], ROW[2], ROW[3], at42]), rowsDigest(BASELINE), "a changed price keeps the digest");
  assert.equal(canonical({ b: 1, a: [2, { d: null, c: "x" }] }), '{"a":[2,{"c":"x","d":null}],"b":1}');
});

test("the digests the prepared press names come from the site's real recorded body", () => {
  assert.equal(Buffer.byteLength(BASELINE_BODY), 736, "the recorded body is not the one this was computed from");
  assert.ok(createHash("sha256").update(BASELINE_BODY).digest("hex").startsWith("a4f1dc305d7d6326"), "the recorded body's sha changed");
  const rows = JSON.parse(BASELINE_BODY);
  assert.ok(rowsDigest(rows).startsWith(DELETE_BASELINE), "the four rows no longer digest to the delete test's baseline");
  assert.ok(rowsDigest(rows.filter((r) => r.id !== 4)).startsWith(PUTBACK_BASELINE), "rows 1–3 no longer digest to the put-back check's baseline");
});

// ── THE READ: THE WHOLE TABLE, OR NOTHING ───────────────────────────────────
//
// The owner's review (2026-09-30): a 200 list is not the whole table. Served
// the named rows and not a third, with `Content-Range: 0-1/3`, the check
// passed. The Data API's count contract, measured through the Worker on
// fretwork-1: 200 `0-3/4` whole, 206 `0-1/4` part of it, 200 `*/0` no row,
// 200 `0-3/*` when the count was not asked for.

test("a read is whole only when its count says every row was served", () => {
  const five = [...BASELINE, tuneUpRow()];
  const whole = read(five);
  assert.equal(whole.ok, true, whole.why);
  assert.equal(whole.count, 5);
  assert.equal(whole.range, "0-4/5");
  assert.equal(read([]).ok, true, "an empty table answered */0 is not whole");
  assert.equal(read(five, { range: " 0-4/5 " }).ok, true, "the header's surrounding spaces refused");
  const cases = [
    // INCOMPLETE: the table holds rows the answer did not serve.
    [{ status: 206, range: "0-4/6" }, "incomplete", /206 Partial Content/],
    [{ range: "0-4/6" }, "incomplete", /5 rows served and Content-Range "0-4\/6": the table holds 6/],
    [{ rows: [], range: "*/3" }, "incomplete", /the table holds 3/],
    // UNKNOWN: nothing to hold the rows to.
    [{ range: "0-4/*" }, "completeness-unknown", /count was not given/],
    [{ range: null }, "completeness-unknown", /no Content-Range/],
    [{ range: "" }, "completeness-unknown", /no Content-Range/],
    [{ range: "items 0-4/5" }, "completeness-unknown", /does not read/],
    [{ range: "0-4/5.0" }, "completeness-unknown", /does not read/],
    [{ range: "0-4/1234567890123456" }, "completeness-unknown", /does not read/],
    [{ range: "1-4/5" }, "completeness-unknown", /does not describe them/],
    [{ range: "0-5/5" }, "completeness-unknown", /does not describe them/],
    [{ range: "0-4/4" }, "completeness-unknown", /does not describe them/],
    [{ rows: [], range: "0-0/0" }, "completeness-unknown", /does not describe them/],
    // UNREADABLE: not a whole row list, whatever the header says.
    [{ text: "<html>", range: "0-4/5" }, "unreadable", /not JSON/],
    [{ status: 404, range: null }, "unreadable", /status 404/],
  ];
  for (const [shape, stop, why] of cases) {
    const got = read(shape.rows || five, shape);
    assert.equal(got.ok, false, `taken as whole: ${JSON.stringify(shape)}`);
    assert.equal(got.stop, stop, `${JSON.stringify(shape)}: ${got.why}`);
    assert.match(got.why, why, `${JSON.stringify(shape)}: ${got.why}`);
    assert.equal(got.rows, undefined, "rows handed on from a read that is not whole");
  }
});

test("the owner's reproduction: the named rows served and one left out stop, and the whole table fails its digest", () => {
  // The table holds the four rows, the temporary row, and one row more. Served
  // the first five, every name in the box matches.
  const extra = { id: 6, name: "Hidden row", description: "Left out of the answer.", price: 1, duration: "1 minute", created_at: "2026-09-30 18:00:00" };
  const e = expectOf(DELETE_BOX);
  const partial = fixtureVerdict(e, read([...BASELINE, tuneUpRow()], { range: "0-4/6" }));
  assert.equal(partial.ok, false, "a read that left a row out passed");
  assert.equal(partial.why, "incomplete");
  assert.match(partial.detail, /the table holds 6/);
  assert.equal(fixtureVerdict(e, read([...BASELINE, tuneUpRow()], { status: 206, range: "0-4/6" })).why, "incomplete");
  // Served whole, the extra row is among the others, and the digest says so.
  assert.equal(fixtureVerdict(e, read([...BASELINE, tuneUpRow(), extra])).why, "baseline-mismatch");
  // AND THE CONTROL: the same five rows, whole, pass.
  assert.equal(fixtureVerdict(e, read([...BASELINE, tuneUpRow()])).ok, true);
});

// ── THE VERDICT: REJECTIONS ─────────────────────────────────────────────────

test("run 77's own setup stops: the temporary row is missing", () => {
  const v = fixtureVerdict(expectOf(DELETE_BOX), read([ROW[1], ROW[2], ROW[3], at42]));
  assert.equal(v.ok, false);
  assert.equal(v.why, "target-missing");
  assert.match(fixtureSaid(v), /NOT AS NAMED \(target-missing\)/);
});

test("the temporary row present but the price not put back stops: the baseline does not match", () => {
  const v = fixtureVerdict(expectOf(DELETE_BOX), read([ROW[1], ROW[2], ROW[3], at42, tuneUpRow()]));
  assert.equal(v.why, "baseline-mismatch");
  assert.ok(v.digest && !v.digest.startsWith(DELETE_BASELINE));
});

test("a put-back that did not land stops the check written for it", () => {
  assert.equal(fixtureVerdict(expectOf(PUTBACK_BOX), read([ROW[1], ROW[2], ROW[3], at42])).why, "target-missing");
});

test("two rows matching the target stop: the message could mean either", () => {
  const v = fixtureVerdict(expectOf(DELETE_BOX), read([...BASELINE, tuneUpRow(5), tuneUpRow(6)]));
  assert.equal(v.why, "target-ambiguous");
  assert.match(v.detail, /id 5, 6/);
});

test("a site read that is not a whole row list stops, whatever it held", () => {
  const e = expectOf(DELETE_BOX);
  const rows = [...BASELINE, tuneUpRow()];
  const notServed = fixtureVerdict(e, read(rows, { status: 404 }));
  assert.equal(notServed.why, "unreadable");
  assert.match(notServed.detail, /site's own read: status 404/);
  assert.match(fixtureVerdict(e, read(rows, { status: 0 })).detail, /site's own read: status 0/, "a read that never answered");
  assert.equal(fixtureVerdict(e, read(rows, { text: "<html>" })).why, "unreadable", "a page read as rows");
  assert.equal(fixtureVerdict(e, read(rows, { text: JSON.stringify({ rows }) })).why, "unreadable", "an object read as the list");
  assert.equal(fixtureVerdict(e, read(rows, { text: served([...rows, ROW[2]]) })).why, "unreadable", "a list holding an id twice read as a table");
  assert.equal(fixtureVerdict(e, read(rows, { text: served([...rows, { ...tuneUpRow(), id: "6" }]) })).why, "unreadable", "a row without an integer id read");
  assert.equal(fixtureVerdict(e, null).why, "unreadable");
});

test("a target is never met by coercion or by a missing column", () => {
  const rows = [...BASELINE, tuneUpRow()];
  const asText = JSON.stringify({ table: "lessons", baseline: DELETE_BASELINE, target: { ...TUNE_UP, price: "10" } });
  assert.equal(fixtureVerdict(expectOf(asText), read(rows)).why, "target-missing", "a price of 10 met a target of \"10\"");
  const absent = JSON.stringify({ table: "lessons", baseline: DELETE_BASELINE, target: { ...TUNE_UP, photo: null } });
  assert.equal(fixtureVerdict(expectOf(absent), read(rows)).why, "target-missing", "a column the table lacks read as null");
});

// ── THE VERDICT: THE SETUPS AS THEY SHOULD BE ───────────────────────────────

test("the delete test's setup as prepared passes, and names the target's id", () => {
  const v = fixtureVerdict(expectOf(DELETE_BOX), read([...BASELINE, tuneUpRow(7)]));
  assert.equal(v.ok, true, v.detail);
  assert.equal(v.target.id, 7);
  assert.ok(v.digest.startsWith(DELETE_BASELINE));
  assert.match(fixtureSaid(v), /^as named: 5 rows; the target is id 7/);
});

test("the put-back check passes once row 4 reads 40", () => {
  const v = fixtureVerdict(expectOf(PUTBACK_BOX), read(BASELINE));
  assert.equal(v.ok, true, v.detail);
  assert.equal(v.target.id, 4);
});

test("a served key order does not matter; the values do", () => {
  const reordered = [...BASELINE, tuneUpRow()].map((r) => Object.fromEntries(Object.entries(r).reverse()));
  assert.equal(fixtureVerdict(expectOf(DELETE_BOX), read(reordered)).ok, true);
});

test("the evidence keeps the rows of a whole read, its range, and none from a read that failed", () => {
  const e = expectOf(DELETE_BOX);
  const ok = read([...BASELINE, tuneUpRow()]);
  const rec = fixtureRecord(e, ok, fixtureVerdict(e, ok));
  assert.equal(rec.rows.length, 5);
  assert.deepEqual(rec.site, { ok: true, stop: null, why: null, count: 5, range: "0-4/5" });
  const refused = read([...BASELINE, tuneUpRow()], { status: 404, range: null });
  const rec2 = fixtureRecord(e, refused, fixtureVerdict(e, refused));
  assert.equal(rec2.rows, null);
  assert.deepEqual(rec2.site, { ok: false, stop: "unreadable", why: "status 404", count: null, range: null });
  const partial = read([...BASELINE, tuneUpRow()], { range: "0-4/6" });
  const rec3 = fixtureRecord(e, partial, fixtureVerdict(e, partial));
  assert.equal(rec3.rows, null, "rows kept from a read that was not the whole table");
  assert.equal(rec3.site.stop, "incomplete");
  assert.equal(rec3.site.range, "0-4/6");
});

// ── THE SCRIPT ITSELF, END TO END, UNDER THE STUB ───────────────────────────
//
// Every network call is answered in-process and logged; the Supabase and
// Worker addresses are `.test` names that could not resolve if anything leaked.
// The site's read answers the count contract as the Data API does through the
// Worker (`fixtures/canary-stub.mjs`), so what the script asks for decides
// what it is told.
const RUN77_ROWS = [ROW[1], ROW[2], ROW[3], at42];
const READY_ROWS = [...BASELINE, tuneUpRow()];
const EXTRA_ROW = { id: 6, name: "Hidden row", description: "Left out of a partial answer.", price: 1, duration: "1 minute", created_at: "2026-09-30 18:00:00" };
const DATA_ROUTE = { ok: true, intent: "edit", layer: "data", cost: 2 };

function runCanary(name, { box = "", spend = "1", site = READY_ROWS, siteStatus = 200, siteText, total, range, restore = "" } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "canary-fixture-" + name + "-"));
  const logFile = path.join(dir, "wire.jsonl");
  writeFileSync(logFile, "");
  const siteAnswer = { status: siteStatus, text: siteText !== undefined ? siteText : served(site) };
  if (total !== undefined) siteAnswer.total = total;
  if (range !== undefined) siteAnswer.range = range;
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME,
    OWNER_EMAIL: "owner@example.com", SUPABASE_SERVICE_KEY: "stub-key", SUPABASE_URL: "https://stub.supabase.test",
    OWNER_BASE_URL: "https://stub.worker.test", CANARY_SLUG: "stub-site", CONTROL_SLUG: "",
    CANARY_SPEND: spend, CANARY_INSTRUCTION: "We don't do the Ten-minute tune-up any more, please take it off the price list.",
    CANARY_EVIDENCE_DIR: path.join(dir, "evidence"), CANARY_EXPECT_ROWS: box, CANARY_RESTORE: restore,
    STUB_LOG: logFile, STUB_ROUTE: JSON.stringify(DATA_ROUTE), STUB_SITE: JSON.stringify(siteAnswer),
  };
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--import", path.join(REPO, "test/fixtures/canary-stub.mjs"), "scripts/edit-canary.mjs"], { cwd: REPO, env });
    let out = "", err = "";
    const kill = setTimeout(() => p.kill("SIGKILL"), 90_000);
    p.stdout.on("data", (c) => { out += c; });
    p.stderr.on("data", (c) => { err += c; });
    p.on("close", (code) => {
      clearTimeout(kill);
      const wire = readFileSync(logFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const fx = path.join(dir, "evidence", "fixture.json");
      const isSiteRead = (w) => !!(w.url && w.url.includes("/api/db/stub-site/data/lessons"));
      resolve({
        code, out, err, wire,
        unknown: wire.filter((w) => w.status === 599),
        routing: wire.filter((w) => w.path === "/api/site/route").length,
        siteReads: wire.filter(isSiteRead),
        ownerReads: wire.filter((w) => w.path && w.path.includes("/rows/")).length,
        paidPosts: wire.filter((w) => w.path === "/api/site/stub-site/edit" && w.body && JSON.parse(w.body).instruction).length,
        lastIsSiteRead: wire.length > 0 && isSiteRead(wire[wire.length - 1]),
        fixture: existsSync(fx) ? JSON.parse(readFileSync(fx, "utf8")) : null,
      });
    });
  });
}

/**
 * STOPPED AT THE READ, AT NO COST: the refusal said so, no routing call and no
 * paid edit were made, and the table's read, asked for its count, was the last
 * call of the run — so nothing that could charge came after it.
 */
function stoppedAtTheRead(r, why) {
  assert.equal(r.unknown.length, 0, "the stub was asked something it has no answer for: " + JSON.stringify(r.unknown));
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.err, new RegExp(`REFUSING TO SPEND: the rows are not the ones this press names \\(${why}\\)\\. Nothing was routed or charged\\.`));
  assert.equal(r.fixture.verdict.why, why);
  assert.equal(r.routing, 0, "a routing call was made");
  assert.equal(r.paidPosts, 0, "a paid edit was posted");
  assert.equal(r.siteReads.length, 1, "the site's own read was not made, once");
  assert.equal(r.siteReads[0].prefer, "count=exact", "the read did not ask for the table's count");
  assert.equal(r.lastIsSiteRead, true, "a call was made after the read: " + JSON.stringify(r.wire[r.wire.length - 1]));
  assert.equal(r.ownerReads, 0, "the owner route was read");
}

const RUNS = {};
before(async () => {
  const plan = {
    run77: { box: DELETE_BOX, site: RUN77_ROWS },
    siteRefused: { box: DELETE_BOX, siteStatus: 404, siteText: '{"message":"not found"}', range: null },
    // THE OWNER'S REPRODUCTION: every named row served, one more left out, a
    // 200 whose range says the table holds more. And the Data API's own answer
    // to a partial read, a 206.
    partial200: { box: DELETE_BOX, total: 6 },
    partial206: { box: DELETE_BOX, siteStatus: 206, total: 6 },
    countNotGiven: { box: DELETE_BOX, range: "0-4/*" },
    noRange: { box: DELETE_BOX, range: null },
    wholeWithExtra: { box: DELETE_BOX, site: [...READY_ROWS, EXTRA_ROW] },
    malformed: { box: '{"table":"lessons"}' },
    besideRestore: { box: DELETE_BOX, restore: "01790404806543-kk6qsh" },
    ready: { box: DELETE_BOX },
    readyFree: { box: DELETE_BOX, spend: "0" },
    noBox: { box: "", site: RUN77_ROWS },
  };
  const done = await Promise.all(Object.entries(plan).map(([k, o]) => runCanary(k, o).then((r) => [k, r])));
  for (const [k, r] of done) RUNS[k] = r;
});

test("end to end: run 77's setup is refused at the read, at no cost", () => {
  stoppedAtTheRead(RUNS.run77, "target-missing");
});

test("end to end: a site read that refuses is refused at the read, at no cost", () => {
  stoppedAtTheRead(RUNS.siteRefused, "unreadable");
  assert.equal(RUNS.siteRefused.fixture.rows, null);
});

test("end to end: an answer that leaves a row out is refused at the read — the owner's 200, and the API's own 206", () => {
  for (const k of ["partial200", "partial206"]) {
    const r = RUNS[k];
    stoppedAtTheRead(r, "incomplete");
    assert.equal(r.siteReads[0].range, "0-4/6", k + ": the stub did not answer as the case says");
    assert.equal(r.fixture.site.range, "0-4/6", k + ": the evidence lost the range");
    assert.equal(r.fixture.rows, null, k + ": rows kept from a read that was not the whole table");
  }
  assert.equal(RUNS.partial206.siteReads[0].status, 206);
});

test("end to end: an answer that cannot show it is whole is refused at the read — no count, no header", () => {
  stoppedAtTheRead(RUNS.countNotGiven, "completeness-unknown");
  assert.equal(RUNS.countNotGiven.siteReads[0].range, "0-4/*");
  stoppedAtTheRead(RUNS.noRange, "completeness-unknown");
  assert.equal(RUNS.noRange.siteReads[0].range, null);
});

test("end to end: the whole table with a row more fails its digest at the read", () => {
  stoppedAtTheRead(RUNS.wholeWithExtra, "baseline-mismatch");
  assert.equal(RUNS.wholeWithExtra.siteReads[0].range, "0-5/6");
});

test("end to end: a malformed or misplaced box refuses before anything is signed in or read", () => {
  for (const k of ["malformed", "besideRestore"]) {
    const r = RUNS[k];
    assert.equal(r.code, 2, k + ": " + r.out + r.err);
    assert.equal(r.wire.length, 0, k + ": the network was used before the refusal");
  }
  assert.match(RUNS.malformed.err, /REFUSING THE FIXTURE: it has no baseline/);
  assert.match(RUNS.besideRestore.err, /the fixture box is for the one paid edit/);
});

test("end to end, control: the whole table as named lets the paid press route, once", () => {
  const r = RUNS.ready;
  assert.equal(r.unknown.length, 0, JSON.stringify(r.unknown));
  assert.equal(r.siteReads.length, 1);
  assert.equal(r.siteReads[0].prefer, "count=exact", "the read did not ask for the table's count");
  assert.equal(r.siteReads[0].range, "0-4/5");
  assert.equal(r.fixture.verdict.ok, true, JSON.stringify(r.fixture.verdict));
  assert.equal(r.fixture.site.range, "0-4/5");
  assert.match(r.out, /as named: 5 rows; the target is id 5/);
  assert.equal(r.ownerReads, 0, "the owner route was read");
  assert.equal(r.routing, 1, "the routing call was not made for a setup that was as named");
  // The stub records the paid POST and refuses it, so the run ends there.
  assert.equal(r.paidPosts, 1);
});

test("end to end, control: with spend=no the check is the whole run, and it routes nothing", () => {
  const r = RUNS.readyFree;
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.fixture.verdict.ok, true);
  assert.equal(r.routing, 0);
  assert.match(r.out, /CANARY_SPEND is not 1 — stopping before the paid edit/);
});

test("end to end, control: a blank box changes nothing — the press routes as before", () => {
  const r = RUNS.noBox;
  assert.equal(r.fixture, null, "a check ran that nobody asked for");
  assert.equal(r.siteReads.length, 0, "the table was read with no box filled");
  assert.equal(r.routing, 1);
  assert.doesNotMatch(r.out + r.err, /FIXTURE/);
});
