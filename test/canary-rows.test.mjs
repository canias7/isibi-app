// THE CANARY'S ONE ROW: the decisions that say where D1 may start, what its
// message changed, and what the recovery may write back — driven here with
// supplied reads and, for the recovery end to end, the REAL owner route
// (site-owner.mjs) over one table held in memory: no site, no token and no
// database.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OWNER_ROWS_LIMIT, decimalOf, readRowList, rowDiff, findTarget, baselineVerdict, changeVerdict,
  restorePlan, patchVerdict, restoreVerdict, restoreRow, recoverRow, readBoth, shownVerdict,
  describeRows, describeRecovery, lineIsFor, probeBody, probeVerdict, shownLead, untouchedVerdict,
} from "../scripts/canary-rows.mjs";
import { handleOwnerData, handleOwnerWrite } from "../site-owner.mjs";
import { ownerTable } from "./fixtures/owner-table.mjs";

const SPEC = Object.freeze({
  table: "loaves", id: 6, match: Object.freeze({ name: "Sea Salt Focaccia" }), field: "price", from: "4.5", to: "4.6",
  shown: Object.freeze({ path: "/order", sel: 'input[type="radio"]', before: "£4.50", after: "£4.60" }),
});
const RECORD = [
  { id: 1, name: "Country White", description: "Our everyday loaf.", price: 4.8, photo: null, created_at: "2026-08-21 23:06:22" },
  { id: 2, name: "Dark Rye", description: "Dense and malty.", price: 5.2, photo: null, created_at: "2026-08-21 23:06:22" },
  { id: 6, name: "Sea Salt Focaccia", description: "A tray bake.", price: 4.5, photo: null, created_at: "2026-08-21 23:06:23" },
];
const clone = (x) => JSON.parse(JSON.stringify(x));
// The owner route answers a NUMERIC column as a string, as the database driver does.
const ownerRows = (rows) => rows.map((r) => ({ ...r, price: String(r.price) }));
const both = (rows) => ({
  owner: { ok: true, rows: ownerRows(rows) },
  pub: { ok: true, rows: clone(rows), text: JSON.stringify(rows) },
});
const withPrice = (rows, id, price) => rows.map((r) => (r.id === id ? { ...r, price } : r));

// ── VALUES ──────────────────────────────────────────────────────────────────

test("a price is compared as a decimal, and only a plain decimal is one", () => {
  for (const [v, want] of [[4.5, "4.5"], ["4.5", "4.5"], ["4.50", "4.5"], ["4.60", "4.6"], [4.6, "4.6"], [6, "6"],
    ["6.00", "6"], ["0", "0"], ["-0.0", "0"], [0, "0"], ["12.340", "12.34"]]) {
    assert.equal(decimalOf(v), want, `decimalOf(${JSON.stringify(v)})`);
  }
  // Number("") is 0, and a zero is a price: none of these is one.
  for (const v of ["", " 4.5", "4.5 ", "04.5", "4.", ".5", "1e21", "4,5", "£4.50", null, undefined, true, false, NaN,
    Infinity, 1e21, {}, [], ["4.5"]]) {
    assert.equal(decimalOf(v), null, `decimalOf(${JSON.stringify(v)}) read as a price`);
  }
});

test("a reader's answer is a row list only when every row has its own positive integer id", () => {
  const owner = readRowList({ status: 200, json: { rows: [{ id: 6, price: "4.5" }, { id: 1, price: "4.8" }] } }, { owner: true });
  assert.equal(owner.ok, true);
  assert.deepEqual(owner.rows.map((r) => r.id), [1, 6], "the rows are not in id order");
  assert.equal(owner.text, undefined, "the owner route's body was kept as text");
  const text = JSON.stringify([{ id: 2 }, { id: 1 }]);
  const pub = readRowList({ status: 200, text });
  assert.equal(pub.ok, true);
  assert.equal(pub.text, text, "the visitor route's body was not kept byte for byte");
  for (const [res, opts, why] of [
    [{ status: 503, json: { rows: [] } }, { owner: true }, /status 503/],
    [{ status: 0 }, {}, /status 0/],
    [null, {}, /status 0/],
    [{ status: 200, text: "<html>" }, {}, /not JSON/],
    [{ status: 200, json: [{ id: 1 }] }, { owner: true }, /no rows list/],
    [{ status: 200, json: { rows: [{ id: 1 }] } }, {}, /not a list/],
    [{ status: 200, json: { rows: [{ id: "1" }] } }, { owner: true }, /positive integer id/],
    [{ status: 200, json: { rows: [{ id: 0 }] } }, { owner: true }, /positive integer id/],
    [{ status: 200, json: { rows: [{ id: 1.5 }] } }, { owner: true }, /positive integer id/],
    [{ status: 200, json: { rows: [null] } }, { owner: true }, /not an object/],
    [{ status: 200, json: { rows: [[1]] } }, { owner: true }, /not an object/],
    [{ status: 200, json: { rows: [{ id: 3 }, { id: 3 }] } }, { owner: true }, /twice/],
  ]) {
    const got = readRowList(res, opts);
    assert.equal(got.ok, false, `accepted ${JSON.stringify(res)}`);
    assert.match(got.why, why);
  }
  // A FULL PAGE may be the first page of a longer table, so it is not the table.
  const full = Array.from({ length: OWNER_ROWS_LIMIT }, (_, i) => ({ id: i + 1 }));
  assert.equal(OWNER_ROWS_LIMIT, 200, "the owner route's own ceiling (site-owner.mjs MAX_LIMIT) moved");
  assert.match(readRowList({ status: 200, json: { rows: full } }, { owner: true }).why, /full page/);
  assert.equal(readRowList({ status: 200, json: { rows: full.slice(1) } }, { owner: true }).ok, true);
});

test("every difference between two reads is named: fields, rows added, rows gone", () => {
  const a = [{ id: 1, x: 1, y: "a" }, { id: 2, x: 2 }, { id: 3, x: 3 }];
  const b = [{ id: 1, x: 1, y: "b" }, { id: 2, x: 2, z: null }, { id: 4, x: 4 }];
  const d = rowDiff(a, b);
  assert.deepEqual(d.changed, [{ id: 1, field: "y", before: "a", after: "b" }], "a null field absent on one side reads as a change");
  assert.deepEqual(d.gone, [3]);
  assert.deepEqual(d.added, [4]);
  const e = rowDiff([{ id: 1, x: 1 }], [{ id: 1, x: 1, w: 7 }]);
  assert.deepEqual(e.changed, [{ id: 1, field: "w", before: null, after: 7 }], "a field on one side only is not a change");
  assert.deepEqual(rowDiff(a, a), { changed: [], added: [], gone: [] });
});

test("the target is found by its id and must still be the row it names", () => {
  assert.equal(findTarget(RECORD, SPEC).row.id, 6);
  assert.equal(findTarget(RECORD.filter((r) => r.id !== 6), SPEC).why, "row-missing");
  const renamed = findTarget(RECORD.map((r) => (r.id === 6 ? { ...r, name: "Baguette" } : r)), SPEC);
  assert.equal(renamed.why, "not-the-row");
  assert.match(renamed.detail, /Baguette/);
});

// ── WHERE THE TEST MAY START ────────────────────────────────────────────────

test("the test starts only where the target reads exactly `from`, on both readers, as the row named", () => {
  const ok = baselineVerdict(both(RECORD), SPEC);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.raw, "4.5", "the baseline value is not the owner route's own representation");
  const cases = [
    [{ ...both(RECORD), owner: { ok: false, why: "status 503" } }, "owner-unreadable"],
    [{ ...both(RECORD), pub: { ok: false, why: "not JSON" } }, "visitor-unreadable"],
    [both(RECORD.filter((r) => r.id !== 6)), "row-missing"],
    [both(RECORD.map((r) => (r.id === 6 ? { ...r, name: "Baguette" } : r))), "not-the-row"],
    [both(withPrice(RECORD, 6, 4.7)), "unexpected-value"],
    [both(withPrice(RECORD, 6, 4.6)), "unexpected-value"],
    // The two readers disagreeing is not a starting point either.
    [{ owner: both(RECORD).owner, pub: both(withPrice(RECORD, 6, 4.6)).pub }, "unexpected-value"],
    [{ owner: both(withPrice(RECORD, 6, 4.6)).owner, pub: both(RECORD).pub }, "unexpected-value"],
    [{ ...both(RECORD), owner: { ok: true, rows: ownerRows(RECORD).map((r) => (r.id === 6 ? { ...r, price: "" } : r)) } }, "unexpected-value"],
    [null, "owner-unreadable"],
  ];
  for (const [base, why] of cases) assert.equal(baselineVerdict(base, SPEC).why, why, JSON.stringify(base && base.owner && base.owner.rows));
});

// ── WHAT THE MESSAGE CHANGED ────────────────────────────────────────────────

test("the expected change is the target field from `from` to `to`, and anything beside it is named", () => {
  const base = ownerRows(RECORD);
  const exact = changeVerdict(base, ownerRows(withPrice(RECORD, 6, 4.6)), SPEC);
  assert.deepEqual({ expected: exact.expected, exact: exact.exact, others: exact.others }, { expected: true, exact: true, others: [] });
  assert.deepEqual(exact.target, { before: "4.5", after: "4.6", changed: true, row: "found" });
  // "4.60" is 4.6.
  assert.equal(changeVerdict(base, base.map((r) => (r.id === 6 ? { ...r, price: "4.60" } : r)), SPEC).exact, true);
  // The expected change with another beside it: expected, not exact, the other named.
  const beside = changeVerdict(base, ownerRows(withPrice(RECORD, 6, 4.6)).map((r) => (r.id === 2 ? { ...r, description: "changed" } : r)), SPEC);
  assert.deepEqual({ expected: beside.expected, exact: beside.exact }, { expected: true, exact: false });
  assert.deepEqual(beside.others, [{ id: 2, field: "description", before: "Dense and malty.", after: "changed" }]);
  // The wrong value, no change at all, the price moved on another row, a row gone, a row added.
  assert.equal(changeVerdict(base, ownerRows(withPrice(RECORD, 6, 4.7)), SPEC).expected, false);
  const none = changeVerdict(base, base, SPEC);
  assert.deepEqual({ expected: none.expected, changed: none.target.changed }, { expected: false, changed: false });
  const elsewhere = changeVerdict(base, ownerRows(withPrice(RECORD, 1, 4.6)), SPEC);
  assert.equal(elsewhere.expected, false);
  assert.deepEqual(elsewhere.others.map((o) => [o.id, o.field]), [[1, "price"]]);
  const gone = changeVerdict(base, ownerRows(withPrice(RECORD, 6, 4.6)).filter((r) => r.id !== 2), SPEC);
  assert.deepEqual({ exact: gone.exact, gone: gone.gone }, { exact: false, gone: [2] });
  const added = changeVerdict(base, [...ownerRows(withPrice(RECORD, 6, 4.6)), { id: 9, name: "New", price: "1" }], SPEC);
  assert.deepEqual({ exact: added.exact, added: added.added }, { exact: false, added: [9] });
  assert.equal(changeVerdict(base, base.filter((r) => r.id !== 6), SPEC).target.row, "row-missing");
  // A change TO the value the message asks for, from a value the test did not
  // start at, is not the change it expects: a baseline that read something else
  // is not where this test began.
  const elsewhen = changeVerdict(ownerRows(withPrice(RECORD, 6, 4.7)), ownerRows(withPrice(RECORD, 6, 4.6)), SPEC);
  assert.deepEqual({ expected: elsewhen.expected, changed: elsewhen.target.changed, before: elsewhen.target.before }, { expected: false, changed: true, before: "4.7" });
});

// ── WHAT THE RECOVERY MAY WRITE ─────────────────────────────────────────────

test("the recovery writes the baseline's own value into that one field, only while it reads `to`", () => {
  const now = ownerRows(withPrice(RECORD, 6, 4.6));
  const p = restorePlan(now, SPEC, "4.5");
  // THE WRITE CARRIES ITS OWN CONDITION: made only while the row, when the
  // write runs, is still the one named and still reads what was just read.
  assert.deepEqual(p, { act: "patch", why: "reads-what-this-test-set", id: 6, body: { $set: { price: "4.5" }, $if: { name: "Sea Salt Focaccia", price: "4.6" } }, from: "4.6" });
  assert.deepEqual(Object.keys(p.body.$set), ["price"], "the write names more than the one field");
  // The baseline's representation travels: a number stays a number, and the
  // condition is the value as read.
  assert.deepEqual(restorePlan(withPrice(RECORD, 6, 4.6), SPEC, 4.5).body, { $set: { price: 4.5 }, $if: { name: "Sea Salt Focaccia", price: 4.6 } });
  assert.deepEqual(restorePlan(now.map((r) => (r.id === 6 ? { ...r, price: "4.60" } : r)), SPEC, "4.5").body.$if, { name: "Sea Salt Focaccia", price: "4.60" });
  assert.deepEqual(restorePlan(now.map((r) => (r.id === 6 ? { ...r, price: "4.60" } : r)), SPEC, "4.5").act, "patch");
  // Already back, or never changed: nothing to write.
  assert.deepEqual(restorePlan(ownerRows(RECORD), SPEC, "4.5").act, "none");
  // Everything else is refused, and said.
  for (const [rows, base, why] of [
    [ownerRows(withPrice(RECORD, 6, 4.7)), "4.5", "unexpected-value"],
    [ownerRows(withPrice(RECORD, 6, 0)), "4.5", "unexpected-value"],
    [now.map((r) => (r.id === 6 ? { ...r, price: null } : r)), "4.5", "unexpected-value"],
    // The same decimal in another form was written by somebody else: not ours.
    [ownerRows(RECORD).map((r) => (r.id === 6 ? { ...r, price: "4.50" } : r)), "4.5", "unexpected-value"],
    [now.filter((r) => r.id !== 6), "4.5", "row-missing"],
    [now.map((r) => (r.id === 6 ? { ...r, name: "Baguette" } : r)), "4.5", "not-the-row"],
    [now, "4.7", "no-baseline"],
    [now, undefined, "no-baseline"],
  ]) {
    const got = restorePlan(rows, SPEC, base);
    assert.equal(got.act, "refuse", `${why}: ${JSON.stringify(got)}`);
    assert.equal(got.why, why);
    assert.ok(!got.body, "a refusal carries something to write");
  }
});

test("the write's own answer must be that field alone, at the baseline value", () => {
  const pre = { ...ownerRows(RECORD)[2], price: "4.6" };
  const good = { status: 200, json: { row: { ...pre, price: "4.5" }, conditional: true } };
  assert.equal(patchVerdict(good, pre, SPEC, "4.5").ok, true);
  assert.match(patchVerdict({ status: 404, json: { error: "no such row" } }, pre, SPEC, "4.5").why, /404/);
  assert.match(patchVerdict({ status: 0 }, pre, SPEC, "4.5").why, /answered 0/);
  assert.equal(patchVerdict({ status: 200, json: { row: { ...pre }, conditional: true } }, pre, SPEC, "4.5").why, "not-written");
  const moved = patchVerdict({ status: 200, json: { row: { ...pre, price: "4.5", description: "x" }, conditional: true } }, pre, SPEC, "4.5");
  assert.equal(moved.why, "row-moved");
  assert.match(moved.detail, /description/);
  // ANOTHER WRITE GOT THERE FIRST: said, and never read as written.
  const conflict = patchVerdict({ status: 409, json: { code: "conflict", error: "…", row: { ...pre, price: "5.2" } } }, pre, SPEC, "4.5");
  assert.deepEqual({ ok: conflict.ok, why: conflict.why, conflict: conflict.conflict }, { ok: false, why: "conflict", conflict: true });
  assert.match(conflict.detail, /read price as "4\.6" \(it now reads "5\.2"\), so the write matched nothing and nothing was written/);
  const renamed = patchVerdict({ status: 409, json: { code: "conflict", row: { ...pre, name: "Baguette" } } }, pre, SPEC, "4.5");
  assert.match(renamed.detail, /no longer Sea Salt Focaccia/);
  // A WORKER FROM BEFORE THE FORM refuses it, and nothing was written.
  assert.equal(patchVerdict({ status: 400, json: { error: "nothing to update" } }, pre, SPEC, "4.5").why, "no-conditional-write");
  // A 200 that does not say its condition held is not trusted as a write.
  assert.equal(patchVerdict({ status: 200, json: { row: { ...pre, price: "4.5" } } }, pre, SPEC, "4.5").why, "not-conditional");
});

test("the table is back when the target equals its baseline on both readers, and byte for byte only if nothing else moved", () => {
  const base = both(RECORD);
  const back = restoreVerdict(base, both(RECORD), SPEC);
  assert.deepEqual({ restored: back.restored, bytes: back.bytes, others: back.others }, { restored: true, bytes: true, others: [] });
  const beside = restoreVerdict(base, both(RECORD.map((r) => (r.id === 2 ? { ...r, description: "changed" } : r))), SPEC);
  assert.deepEqual({ restored: beside.restored, bytes: beside.bytes }, { restored: true, bytes: false });
  assert.deepEqual(beside.others.map((o) => [o.id, o.field]), [[2, "description"]]);
  assert.equal(restoreVerdict(base, both(withPrice(RECORD, 6, 4.6)), SPEC).restored, false);
  // BOTH readers must be back. The owner route back while the visitor route
  // still serves the edited value is a site a visitor still sees changed.
  const ownerOnly = restoreVerdict(base, { owner: both(RECORD).owner, pub: both(withPrice(RECORD, 6, 4.6)).pub }, SPEC);
  assert.deepEqual({ restored: ownerOnly.restored, why: ownerOnly.why }, { restored: false, why: "target-differs" });
  const visitorOnly = restoreVerdict(base, { owner: both(withPrice(RECORD, 6, 4.6)).owner, pub: both(RECORD).pub }, SPEC);
  assert.deepEqual({ restored: visitorOnly.restored, why: visitorOnly.why }, { restored: false, why: "target-differs" });
  assert.equal(restoreVerdict(base, { owner: { ok: false, why: "status 503" }, pub: base.pub }, SPEC).why, "unreadable");
  // No baseline text to compare is not a difference.
  assert.equal(restoreVerdict({ ...base, pub: { ok: true, rows: base.pub.rows } }, both(RECORD), SPEC).bytes, null);
});

// ── THE RECOVERY, END TO END, OVER A SUPPLIED TABLE ─────────────────────────

// The owner route itself, reading and writing one table held in memory. The
// price is a NUMERIC by default, which the driver hands back as a string; a
// REAL (what the site engine gives a `number` column, and what run 40 read
// live) comes back as a number. `db.rows` IS the table, so a test can change a
// row by hand as another writer would.
const COLS = (price) => ({ name: "text", description: "text", price, photo: "text", created_at: "text" });
function table(rows, { price = "numeric" } = {}) {
  const db = { rows: clone(rows), patches: [], readsOwner: 0, failPatch: 0, ownerDown: false };
  db.t = ownerTable({ types: COLS(price), rows: db.rows, inPlace: true });
  const who = { slug: "fold-lane-bakery", table: "loaves", uid: "owner-1" };
  db.owner = async () => {
    db.readsOwner++;
    if (db.ownerDown) return { status: 503, json: { error: "down" } };
    const r = await handleOwnerData(db.t.deps, { ...who, params: { order: "id", dir: "asc", limit: "200" } });
    return { status: r.status, json: r.body };
  };
  db.pub = async () => ({ status: 200, text: JSON.stringify(db.rows) });
  db.patch = async (id, body) => {
    db.patches.push({ id, body });
    if (db.failPatch) return { status: db.failPatch, json: { error: "that didn't work" } };
    const r = await handleOwnerWrite(db.t.deps, { ...who, method: "PATCH", rowId: String(id), body });
    return { status: r.status, json: r.body };
  };
  db.focaccia = () => db.rows.find((r) => r.id === 6);
  return db;
}
const CAS = (price, was) => ({ $set: { price }, $if: { name: "Sea Salt Focaccia", price: was } });

test("the recovery reads, writes the one field once, and reads the table back to its baseline", async () => {
  const db = table(RECORD);
  const base = await readBoth(db);
  db.rows.find((r) => r.id === 6).price = 4.6;
  const after = await readBoth(db);
  const out = await restoreRow({ spec: SPEC, base, after, readers: db, patch: db.patch });
  assert.deepEqual(db.patches, [{ id: 6, body: CAS("4.5", "4.6") }], "not exactly one write, of that field, on that condition");
  assert.equal(out.plan.act, "patch");
  assert.equal(out.wrote, true);
  assert.equal(out.patched.verdict.ok, true, JSON.stringify(out.patched));
  assert.deepEqual({ restored: out.verdict.restored, bytes: out.verdict.bytes }, { restored: true, bytes: true });
  assert.deepEqual(out.moved, { changed: [], added: [], gone: [] });
  assert.match(describeRows({ spec: SPEC, restore: out }, SPEC), /RESTORED: the row is its baseline again/);
  assert.match(describeRows({ spec: SPEC, restore: out }, SPEC), /byte-identical to the baseline/);
});

test("a value that moved after the edit is refused and left, and nothing is written", async () => {
  const db = table(RECORD);
  const base = await readBoth(db);
  db.rows.find((r) => r.id === 6).price = 4.6;
  const after = await readBoth(db);
  db.rows.find((r) => r.id === 6).price = 4.7; // somebody else, between the after-read and the write
  const out = await restoreRow({ spec: SPEC, base, after, readers: db, patch: db.patch });
  assert.deepEqual(db.patches, [], "a value nobody here set was overwritten");
  assert.deepEqual({ act: out.plan.act, why: out.plan.why }, { act: "refuse", why: "unexpected-value" });
  assert.deepEqual(out.moved.changed.map((c) => [c.id, c.field, c.after]), [[6, "price", "4.7"]]);
  assert.equal(out.verdict.restored, false);
  assert.equal(db.rows.find((r) => r.id === 6).price, 4.7, "the table was touched");
  assert.match(describeRows({ spec: SPEC, restore: out }, SPEC), /refuse \(unexpected-value\)/);
});

test("another row's change is reported and kept, and only the target field is put back", async () => {
  const db = table(RECORD);
  const base = await readBoth(db);
  db.rows.find((r) => r.id === 6).price = 4.6;
  db.rows.find((r) => r.id === 2).description = "changed by somebody";
  const after = await readBoth(db);
  const out = await restoreRow({ spec: SPEC, base, after, readers: db, patch: db.patch });
  assert.deepEqual(db.patches, [{ id: 6, body: CAS("4.5", "4.6") }]);
  assert.equal(db.rows.find((r) => r.id === 2).description, "changed by somebody", "another row's change was overwritten");
  assert.deepEqual({ restored: out.verdict.restored, bytes: out.verdict.bytes }, { restored: true, bytes: false });
  assert.deepEqual(out.verdict.others.map((o) => [o.id, o.field]), [[2, "description"]]);
  assert.match(describeRows({ spec: SPEC, restore: out }, SPEC), /still different: id 2 description/);
});

test("an unreadable table or a failed write is said, never read as done", async () => {
  const db = table(RECORD);
  const base = await readBoth(db);
  db.rows.find((r) => r.id === 6).price = 4.6;
  db.ownerDown = true;
  const blind = await restoreRow({ spec: SPEC, base, readers: db, patch: db.patch });
  assert.deepEqual({ act: blind.plan.act, why: blind.plan.why }, { act: "refuse", why: "owner-unreadable" });
  assert.deepEqual(db.patches, []);
  db.ownerDown = false;
  db.failPatch = 500;
  const failed = await restoreRow({ spec: SPEC, base, readers: db, patch: db.patch });
  assert.equal(db.patches.length, 1);
  assert.equal(failed.patched.verdict.ok, false);
  assert.equal(failed.verdict.restored, false);
  // A reader that throws is an unreadable answer, not an empty table.
  const threw = await readBoth({ owner: async () => { throw new Error("socket hang up"); }, pub: db.pub });
  assert.deepEqual({ ok: threw.owner.ok, pub: threw.pub.ok }, { ok: false, pub: true });
});

// ── A WRITE THAT LANDS BETWEEN THE RECOVERY'S READ AND ITS WRITE ────────────
//
// Reproduced before the write carried its condition: the recovery read 4.6,
// another writer set 5.2 before the PATCH ran, and the recovery put 4.5 over
// it and reported the row restored. `beforeUpdate` lands that other write
// immediately before the route's UPDATE executes — after every read the
// recovery makes, so another pre-read could not have seen it.

const UPDATES = (db) => db.t.statements.filter((x) => x.sql.startsWith("UPDATE"));

for (const price of ["numeric", "real"]) {
  test(`the automatic recovery does not overwrite a write that lands after its read, and says so (${price})`, async () => {
    const db = table(RECORD, { price });
    const base = await readBoth(db);
    db.focaccia().price = 4.6; // the edit
    const after = await readBoth(db);
    db.t.beforeUpdate(() => { db.focaccia().price = 5.2; });
    const out = await restoreRow({ spec: SPEC, base, after, readers: db, patch: db.patch });
    assert.equal(db.focaccia().price, 5.2, "the other writer's value was overwritten");
    assert.equal(db.patches.length, 1, "the write was retried");
    assert.deepEqual({ status: out.patched.status, why: out.patched.verdict.why, wrote: out.wrote }, { status: 409, why: "conflict", wrote: false });
    assert.match(out.conflict, /read price as "?4\.6"? \(it now reads "?5\.2"?\), so the write matched nothing and nothing was written/);
    assert.deepEqual({ restored: out.verdict.restored, why: out.verdict.why }, { restored: false, why: "target-differs" });
    // ONE statement, conditional, and it matched nothing.
    const u = UPDATES(db);
    assert.equal(u.length, 1);
    assert.match(u[0].sql, /WHERE id=\? AND "name" IS NOT DISTINCT FROM \? AND "price" IS NOT DISTINCT FROM \? RETURNING \*$/);
    const told = describeRows({ spec: SPEC, restore: out }, SPEC);
    assert.match(told, /CONFLICT   the row changed after the recovery read price/);
    assert.match(told, /final      NOT RESTORED \(target-differs\)/);
    assert.doesNotMatch(told, /RESTORED: the row is its baseline again/);
  });

  test(`the standalone recovery does not overwrite a write that lands after its read, and says so (${price})`, async () => {
    const db = table(withPrice(RECORD, 6, 4.6), { price });
    db.t.beforeUpdate(() => { db.focaccia().price = 5.2; });
    const out = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: true });
    assert.equal(db.focaccia().price, 5.2, "the other writer's value was overwritten");
    assert.deepEqual({ sent: out.sent, wrote: out.wrote, status: out.patched.status, why: out.patched.verdict.why }, { sent: true, wrote: false, status: 409, why: "conflict" });
    assert.match(out.conflict, /nothing was written/);
    assert.equal(out.verdict.restored, false);
    // The table is read again after the write, so what it says is the table now.
    assert.equal(decimalOf(findTarget(out.final.owner.rows, SPEC).row.price), "5.2", "the account was drawn from the read before the write");
    assert.equal(UPDATES(db).length, 1);
    const told = describeRecovery(out, SPEC, { write: true });
    assert.match(told, /CONFLICT   the row changed after the recovery read price/);
    assert.match(told, /final      NOT RESTORED/);
    assert.doesNotMatch(told, /RESTORED: the row is its recorded value again/);
  });
}

test("a row renamed or deleted after the recovery's read is not written either", async () => {
  // Renamed: no longer the row this test names.
  let db = table(withPrice(RECORD, 6, 4.6));
  db.t.beforeUpdate(() => { db.focaccia().name = "Baguette"; });
  let out = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: true });
  assert.deepEqual({ why: out.patched.verdict.why, wrote: out.wrote }, { why: "conflict", wrote: false });
  assert.match(out.conflict, /no longer Sea Salt Focaccia/);
  assert.deepEqual([db.rows.find((r) => r.id === 6).name, db.rows.find((r) => r.id === 6).price], ["Baguette", 4.6]);
  // Deleted: there is nothing to write, and the route says so.
  db = table(withPrice(RECORD, 6, 4.6));
  const base = await readBoth(table(RECORD));
  db.t.beforeUpdate(() => { db.t.remove(6); });
  out = await restoreRow({ spec: SPEC, base, readers: db, patch: db.patch });
  assert.deepEqual({ status: out.patched.status, wrote: out.wrote, restored: out.verdict.restored }, { status: 404, wrote: false, restored: false });
  assert.equal(db.rows.some((r) => r.id === 6), false, "a deleted row came back");
});

test("another writer who puts the value back first leaves nothing to write, and it is not called the recovery's work", async () => {
  const db = table(RECORD);
  const base = await readBoth(db);
  db.focaccia().price = 4.6;
  db.t.beforeUpdate(() => { db.focaccia().price = 4.5; });
  const out = await restoreRow({ spec: SPEC, base, readers: db, patch: db.patch });
  assert.deepEqual({ why: out.patched.verdict.why, wrote: out.wrote, restored: out.verdict.restored }, { why: "conflict", wrote: false, restored: true });
  const told = describeRows({ spec: SPEC, restore: out }, SPEC);
  assert.match(told, /CONFLICT/);
  assert.match(told, /AT BASELINE, but NOT by this recovery: its write changed nothing/);
});

test("a change to another field of the row does not block the one field, and is kept and reported", async () => {
  const db = table(RECORD);
  const base = await readBoth(db);
  db.focaccia().price = 4.6;
  db.t.beforeUpdate(() => { db.focaccia().description = "changed by somebody"; });
  const out = await restoreRow({ spec: SPEC, base, readers: db, patch: db.patch });
  // The condition is the row's identity and the one field, so the price goes back…
  assert.deepEqual({ wrote: out.wrote, conflict: out.conflict, price: db.focaccia().price }, { wrote: true, conflict: null, price: 4.5 });
  // …and the other field is left as somebody else set it, and named.
  assert.equal(db.focaccia().description, "changed by somebody");
  assert.deepEqual({ why: out.patched.verdict.why }, { why: "row-moved" });
  assert.match(out.patched.verdict.detail, /description/);
  assert.equal(out.verdict.restored, false, "a row with another field changed was called its baseline");
});

test("a Worker from before the conditional form refuses the recovery's write, and nothing is written", async () => {
  const db = table(withPrice(RECORD, 6, 4.6));
  // What the route answered before this form: `$set`/`$if` are not columns, so
  // a plain PATCH found nothing to update (measured on the unfixed route).
  const old = async (id, body) => { db.patches.push({ id, body }); return { status: 400, json: { error: "nothing to update" } }; };
  const out = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: old, write: true });
  assert.deepEqual({ why: out.patched.verdict.why, wrote: out.wrote, restored: out.verdict.restored }, { why: "no-conditional-write", wrote: false, restored: false });
  assert.equal(db.focaccia().price, 4.6);
  assert.match(describeRecovery(out, SPEC, { write: true }), /does not take a conditional write, so it refused it and nothing was written/);
});

test("a 200 that does not say its condition held is never read as the recovery's write", async () => {
  const db = table(RECORD);
  const base = await readBoth(db);
  db.focaccia().price = 4.6;
  // A Worker that wrote and did not say it was conditional: nobody can tell.
  const unknown = async (id, body) => {
    db.patches.push({ id, body });
    db.focaccia().price = 4.5;
    return { status: 200, json: { row: { ...db.focaccia(), price: "4.5" } } };
  };
  const out = await restoreRow({ spec: SPEC, base, readers: db, patch: unknown });
  assert.deepEqual({ why: out.patched.verdict.why, wrote: out.wrote }, { why: "not-conditional", wrote: false });
  const told = describeRows({ spec: SPEC, restore: out }, SPEC);
  assert.doesNotMatch(told, /RESTORED: the row is its baseline again/);
  assert.match(told, /FAIL not-conditional/);
});

test("the probe asks the Worker with a conditional write no row can meet, and changes nothing", async () => {
  const db = table(RECORD);
  const before = JSON.stringify(db.rows);
  assert.deepEqual(probeBody(SPEC), { $set: { price: "4.5" }, $if: { id: 0 } });
  const v = probeVerdict(await db.patch(6, probeBody(SPEC)));
  assert.deepEqual({ ok: v.ok, why: v.why, status: v.status }, { ok: true, why: "enforced", status: 409 });
  assert.equal(JSON.stringify(db.rows), before, "the probe changed the table");
  assert.equal(UPDATES(db).length, 1, "the probe did not reach the database's own condition");
  assert.match(UPDATES(db)[0].sql, /WHERE id=\? AND "id" IS NOT DISTINCT FROM \?/);
  // A row that is gone still shows the condition was applied.
  db.t.remove(6);
  assert.deepEqual(probeVerdict(await db.patch(6, probeBody(SPEC))).why, "enforced");
  // A Worker from before the form, or any other answer, is a refusal.
  assert.deepEqual(probeVerdict({ status: 400, json: { error: "nothing to update" } }).why, "no-conditional-write");
  for (const res of [{ status: 200, json: { row: {} } }, { status: 409, json: {} }, { status: 500, json: { error: "that didn't work" } }, { status: 404, json: { error: "no such site" } }, { status: 0 }, null]) {
    assert.deepEqual(probeVerdict(res).ok, false, JSON.stringify(res));
  }
});

// ── THE RECOVERY RUN ON ITS OWN ─────────────────────────────────────────────

test("the recovery run writes only with `write`, only from `to`, and in the type the owner route reads", async () => {
  const db = table(withPrice(RECORD, 6, 4.6));
  const dry = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: false });
  assert.deepEqual(db.patches, [], "a dry run wrote");
  assert.deepEqual({ act: dry.plan.act, body: dry.plan.body, sent: dry.sent, wrote: dry.wrote }, { act: "patch", body: CAS("4.5", "4.6"), sent: false, wrote: false });
  assert.match(describeRecovery(dry, SPEC, { write: false }), /NOT SENT \(dry run\)/);
  const wet = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: true });
  assert.deepEqual(db.patches, [{ id: 6, body: CAS("4.5", "4.6") }]);
  assert.deepEqual({ sent: wet.sent, wrote: wet.wrote, conflict: wet.conflict }, { sent: true, wrote: true, conflict: null });
  assert.equal(wet.patched.verdict.ok, true, JSON.stringify(wet.patched));
  assert.equal(wet.verdict.restored, true, JSON.stringify(wet.verdict));
  assert.deepEqual(wet.record, { changed: [], added: [], gone: [] });
  assert.match(describeRecovery(wet, SPEC, { write: true }), /RESTORED: the row is its recorded value again/);
  // Again: nothing left to write.
  const again = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: true });
  assert.equal(again.plan.act, "none");
  assert.equal(db.patches.length, 1);
  // A number read as a number goes back as a number: a REAL, as run 40 read.
  const num = table(withPrice(RECORD, 6, 4.6), { price: "real" });
  const n = await recoverRow({ spec: SPEC, record: RECORD, readers: num, patch: num.patch, write: true });
  assert.deepEqual(num.patches, [{ id: 6, body: { $set: { price: 4.5 }, $if: { name: "Sea Salt Focaccia", price: 4.6 } } }]);
  assert.equal(n.verdict.restored, true, JSON.stringify(n.verdict));
  assert.equal(num.focaccia().price, 4.5);
});

test("the recovery run refuses a value nobody here set, and reports what differs from the record", async () => {
  const db = table(withPrice(RECORD, 6, 4.7).map((r) => (r.id === 1 ? { ...r, description: "new words" } : r)));
  const out = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: true });
  assert.deepEqual(db.patches, []);
  assert.deepEqual({ act: out.plan.act, why: out.plan.why, sent: out.sent, wrote: out.wrote }, { act: "refuse", why: "unexpected-value", sent: false, wrote: false });
  assert.deepEqual(out.record.changed.map((c) => [c.id, c.field]), [[1, "description"], [6, "price"]]);
  assert.match(describeRecovery(out, SPEC, { write: true }), /differs from the proposal's record/);
});

// ── WHAT A VISITOR SEES ─────────────────────────────────────────────────────

test("a card is the named row's only when the whole name is followed by what is not part of a name", () => {
  const n = "Sea Salt Focaccia";
  for (const l of ["Sea Salt Focaccia £4.50 · A tray bake.", "Sea Salt Focaccia · a tray bake", "Sea Salt Focaccia  $4.50"]) {
    assert.equal(lineIsFor(l, n), true, l);
  }
  for (const l of ["Sea Salt Focaccia Deluxe £5.00 · x", "Sea Salt Focaccia2 £1", "Sea Salt Focaccia 2 £1", "Sea Salt Focaccia",
    "Sea Salt Focaccia ", "Olive & Rosemary £5.80", "sea salt focaccia £4.50", null, 7]) {
    assert.equal(lineIsFor(l, n), false, String(l));
  }
  assert.equal(lineIsFor("anything £1", ""), false, "an empty name matches every card");
});

test("the page's line for the target must show the price, and every other line must be what it was", () => {
  const before = ["Country White £4.80 · Our everyday loaf.", "Sea Salt Focaccia £4.50 · A tray bake."];
  const after = ["Country White £4.80 · Our everyday loaf.", "Sea Salt Focaccia £4.60 · A tray bake."];
  assert.deepEqual(shownVerdict(before, after, SPEC, "£4.60"), { ok: true, line: after[1] });
  assert.equal(shownVerdict(before, before, SPEC, "£4.60").why, "wrong-price");
  assert.equal(shownVerdict(before, [after[0]], SPEC, "£4.60").why, "target-not-shown");
  assert.equal(shownVerdict(before, [...after, after[1]], SPEC, "£4.60").why, "target-twice");
  assert.equal(shownVerdict(before, ["Country White £4.90 · Our everyday loaf.", after[1]], SPEC, "£4.60").why, "other-lines-changed");
  // A name that merely starts the same is not the target's line.
  assert.equal(shownVerdict(before, ["Sea Salt Focaccia Deluxe £4.60 · x"], SPEC, "£4.60").why, "target-not-shown");
});

// ── TEST 9: A LINE WITH MORE THAN THE NAME BEFORE ITS PRICE, AND A TABLE THAT MUST NOT MOVE ──

// fretwork-1's price list, as a visitor's page drew it on 2026-09-30.
const LESSON_LINES = [
  "First lesson 45 minutes A free 45-minute taster in Crookes. Bring a guitar if you have one; there is a spare if not. £0",
  "One-to-one 45 minutes A private 45-minute lesson. Beginners welcome. £30",
  "Hour one-to-one 60 minutes A full hour when 45 minutes is not enough. £42",
];
const LESSON = Object.freeze({
  table: "lessons", id: 4, match: Object.freeze({ name: "Hour one-to-one" }), field: "price", from: "42", to: "45",
  shown: Object.freeze({ path: "/prices", sel: "li > span", lead: "Hour one-to-one 60 minutes A full hour when 45 minutes is not enough.", before: "£42", after: "£45" }),
});

test("a line with a duration after the name is found by its whole start, and only a start that begins with the name counts", () => {
  // THE NAME ALONE FINDS NOTHING on this page: a digit follows it.
  assert.equal(LESSON_LINES.filter((l) => lineIsFor(l, "Hour one-to-one")).length, 0);
  assert.equal(shownLead(LESSON), LESSON.shown.lead);
  assert.deepEqual(LESSON_LINES.filter((l) => lineIsFor(l, shownLead(LESSON))), [LESSON_LINES[2]]);
  const after = LESSON_LINES.map((l, i) => (i === 2 ? l.replace("£42", "£45") : l));
  assert.deepEqual(shownVerdict(LESSON_LINES, after, LESSON, "£45"), { ok: true, line: after[2] });
  // The description's own "45 minutes" is not the price.
  assert.equal(shownVerdict(LESSON_LINES, LESSON_LINES, LESSON, "£45").why, "wrong-price");
  assert.equal(shownVerdict(LESSON_LINES, after.map((l, i) => (i === 1 ? l.replace("£30", "£31") : l)), LESSON, "£45").why, "other-lines-changed");
  // The home page draws the same line with its button after the price.
  const home = LESSON_LINES.map((l) => l + " Select");
  assert.deepEqual(shownVerdict(home, home.map((l, i) => (i === 2 ? l.replace("£42", "£45") : l)), LESSON, "£45").ok, true);
  // A lead that does not begin with the name is not trusted: the name stands.
  const odd = { ...LESSON, shown: { ...LESSON.shown, lead: "One-to-one 45 minutes" } };
  assert.equal(shownLead(odd), "Hour one-to-one");
  assert.equal(shownLead(SPEC), "Sea Salt Focaccia", "a spec with no lead is read by its name, as before");
  assert.equal(shownLead({ ...LESSON, shown: { ...LESSON.shown, lead: 7 } }), "Hour one-to-one");
});

test("a table that must not move is the baseline on both readers, field for field and byte for byte, or it is not known", () => {
  const rows = [{ id: 1, name: "First lesson", price: 0 }, { id: 4, name: "Hour one-to-one", price: 42 }];
  const base = both(rows);
  assert.deepEqual(untouchedVerdict(base, both(rows)), { ok: true, why: "unchanged" });
  const moved = untouchedVerdict(base, both([rows[0], { ...rows[1], price: 45 }]));
  assert.deepEqual({ ok: moved.ok, why: moved.why }, { ok: false, why: "moved" });
  assert.match(moved.detail, /id 4 price "42" -> "45"/);
  assert.equal(untouchedVerdict(base, both([rows[1]])).why, "moved", "a row gone is a move");
  assert.equal(untouchedVerdict(base, both([...rows, { id: 5, name: "Weekend workshop", price: 25 }])).why, "moved", "a row added is a move");
  // THE SAME ROWS SERVED DIFFERENTLY ARE NOT THE SAME TO A VISITOR.
  const spaced = both(rows);
  spaced.pub.text = JSON.stringify(rows, null, 1);
  assert.equal(untouchedVerdict(base, spaced).why, "visitor-bytes");
  // CANNOT-TELL IS NEVER "UNCHANGED": each is a refusal, and says which.
  const judged = (b, n) => { const v = untouchedVerdict(b, n); return { ok: v.ok, why: v.why }; };
  assert.deepEqual(judged(base, { owner: { ok: false, why: "status 500" }, pub: base.pub }), { ok: false, why: "unreadable" });
  assert.deepEqual(judged(base, { owner: base.owner, pub: { ok: false, why: "status 0" } }), { ok: false, why: "unreadable" });
  assert.deepEqual(judged(base, null), { ok: false, why: "unreadable" });
  assert.deepEqual(judged(null, both(rows)), { ok: false, why: "no-baseline" });
  assert.deepEqual(judged(base, { owner: base.owner, pub: { ok: true, rows: clone(rows) } }), { ok: false, why: "no-visitor-text" });
  assert.equal(untouchedVerdict(base, spaced).ok, false);
  assert.equal(untouchedVerdict(base, both([rows[1]])).ok, false);
});
