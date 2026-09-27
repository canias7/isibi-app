// THE CANARY'S ONE ROW: the decisions that say where D1 may start, what its
// message changed, and what the recovery may write back — driven here with
// supplied reads, no site, no token and no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OWNER_ROWS_LIMIT, decimalOf, readRowList, rowDiff, findTarget, baselineVerdict, changeVerdict,
  restorePlan, patchVerdict, restoreVerdict, restoreRow, recoverRow, readBoth, shownVerdict,
  describeRows, describeRecovery, lineIsFor,
} from "../scripts/canary-rows.mjs";

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
  assert.deepEqual(p, { act: "patch", why: "reads-what-this-test-set", id: 6, body: { price: "4.5" }, from: "4.6" });
  assert.deepEqual(Object.keys(p.body), ["price"], "the write names more than the one field");
  // The baseline's representation travels: a number stays a number.
  assert.deepEqual(restorePlan(withPrice(RECORD, 6, 4.6), SPEC, 4.5).body, { price: 4.5 });
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
  const good = { status: 200, json: { row: { ...pre, price: "4.5" } } };
  assert.equal(patchVerdict(good, pre, SPEC, "4.5").ok, true);
  assert.match(patchVerdict({ status: 404, json: { error: "no such row" } }, pre, SPEC, "4.5").why, /404/);
  assert.match(patchVerdict({ status: 0 }, pre, SPEC, "4.5").why, /answered 0/);
  assert.equal(patchVerdict({ status: 200, json: { row: { ...pre } } }, pre, SPEC, "4.5").why, "not-written");
  const moved = patchVerdict({ status: 200, json: { row: { ...pre, price: "4.5", description: "x" } } }, pre, SPEC, "4.5");
  assert.equal(moved.why, "row-moved");
  assert.match(moved.detail, /description/);
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

function table(rows) {
  const db = { rows: clone(rows), patches: [], readsOwner: 0, failPatch: 0, ownerDown: false };
  db.owner = async () => { db.readsOwner++; return db.ownerDown ? { status: 503, json: { error: "down" } } : { status: 200, json: { rows: ownerRows(db.rows) } }; };
  db.pub = async () => ({ status: 200, text: JSON.stringify(db.rows) });
  db.patch = async (id, body) => {
    db.patches.push({ id, body });
    if (db.failPatch) return { status: db.failPatch, json: { error: "that didn't work" } };
    const r = db.rows.find((x) => x.id === id);
    if (!r) return { status: 404, json: { error: "no such row" } };
    for (const [k, v] of Object.entries(body)) r[k] = k === "price" ? Number(v) : v;
    return { status: 200, json: { row: { ...r, price: String(r.price) } } };
  };
  return db;
}

test("the recovery reads, writes the one field once, and reads the table back to its baseline", async () => {
  const db = table(RECORD);
  const base = await readBoth(db);
  db.rows.find((r) => r.id === 6).price = 4.6;
  const after = await readBoth(db);
  const out = await restoreRow({ spec: SPEC, base, after, readers: db, patch: db.patch });
  assert.deepEqual(db.patches, [{ id: 6, body: { price: "4.5" } }], "not exactly one write, of that field");
  assert.equal(out.plan.act, "patch");
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
  assert.deepEqual(db.patches, [{ id: 6, body: { price: "4.5" } }]);
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

// ── THE RECOVERY RUN ON ITS OWN ─────────────────────────────────────────────

test("the recovery run writes only with `write`, only from `to`, and in the type the owner route reads", async () => {
  const db = table(withPrice(RECORD, 6, 4.6));
  const dry = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: false });
  assert.deepEqual(db.patches, [], "a dry run wrote");
  assert.deepEqual({ act: dry.plan.act, body: dry.plan.body, wrote: dry.wrote }, { act: "patch", body: { price: "4.5" }, wrote: false });
  assert.match(describeRecovery(dry, SPEC, { write: false }), /NOT SENT \(dry run\)/);
  const wet = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: true });
  assert.deepEqual(db.patches, [{ id: 6, body: { price: "4.5" } }]);
  assert.equal(wet.patched.verdict.ok, true, JSON.stringify(wet.patched));
  assert.equal(wet.verdict.restored, true, JSON.stringify(wet.verdict));
  assert.deepEqual(wet.record, { changed: [], added: [], gone: [] });
  assert.match(describeRecovery(wet, SPEC, { write: true }), /RESTORED: the row is its recorded value again/);
  // Again: nothing left to write.
  const again = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: true });
  assert.equal(again.plan.act, "none");
  assert.equal(db.patches.length, 1);
  // A number read as a number goes back as a number.
  const num = table(withPrice(RECORD, 6, 4.6));
  num.owner = async () => ({ status: 200, json: { rows: clone(num.rows) } });
  const n = await recoverRow({ spec: SPEC, record: RECORD, readers: num, patch: num.patch, write: true });
  assert.deepEqual(num.patches, [{ id: 6, body: { price: 4.5 } }]);
  assert.equal(n.verdict.restored, true);
});

test("the recovery run refuses a value nobody here set, and reports what differs from the record", async () => {
  const db = table(withPrice(RECORD, 6, 4.7).map((r) => (r.id === 1 ? { ...r, description: "new words" } : r)));
  const out = await recoverRow({ spec: SPEC, record: RECORD, readers: db, patch: db.patch, write: true });
  assert.deepEqual(db.patches, []);
  assert.deepEqual({ act: out.plan.act, why: out.plan.why, wrote: out.wrote }, { act: "refuse", why: "unexpected-value", wrote: false });
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
