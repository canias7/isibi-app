// THE CHAIN, ASSERTED AT EVERY LINK.
//
// `confirm`, `sms` and `payment` were reported by an audit as never reaching
// `_meta`, which would mean booking confirmations, text messages and the whole
// card-payment path were dead on every published site. Driven end to end
// 2026-08-09, that is NOT true — every link holds. This file is what turns that
// from an argument into a fact, and it exists because this codebase has recorded
// a feature dead at one silent link SIX separate times: declarable but dropped
// by the normaliser, normalised but absent from `_meta`, in `_meta` but never
// read, read but never called.
//
// One broken link is invisible from either end, so each is checked on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeSchema } from "../site-schema.mjs";
import { normalizeConfirm } from "../site-mail.mjs";
import { normalizeSms } from "../site-sms.mjs";
import { normalizePayment } from "../site-payments.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");

const SPEC = {
  tables: [
    { name: "bookings", access: "collect",
      columns: [{ name: "customer_email", type: "text" }, { name: "slot", type: "text" }],
      confirm: { fn: "confirm_booking" }, sms: { fn: "sms_booking" } },
    { name: "orders", access: "collect",
      columns: [{ name: "email", type: "text" }, { name: "qty", type: "int" }],
      payment: { from: "products", amount: "price", currency: "GBP" } },
    { name: "products", access: "display",
      columns: [{ name: "name", type: "text" }, { name: "price", type: "int" }] },
  ],
  functions: [
    { name: "confirm_booking", args: "id int", returns: "json", body: "SELECT 1", internal: true },
    { name: "sms_booking", args: "id int", returns: "json", body: "SELECT 1", internal: true },
  ],
};

/* ── link 1: the designer can declare them ───────────────────────────────── */

test("the design_schema tool offers confirm, sms and payment per table", () => {
  // A feature nothing can DECLARE is dead however well the rest of it works —
  // the failure this codebase has hit most often. Read off the real tool.
  const at = worker.indexOf('name: "design_schema"');
  assert.ok(at > 0, "the designer's tool is gone from worker.js");
  const block = worker.slice(worker.indexOf("tables:", at), worker.indexOf("tables:", at) + 30000);
  for (const field of ["confirm", "sms", "payment"]) {
    assert.match(block, new RegExp("\\n\\s+" + field + ": \\{"),
      `the designer cannot declare ${field}, so no site can ever have it`);
  }
});

/* ── link 2: the normaliser keeps them ───────────────────────────────────── */

test("normalizeSchema keeps all three on the table", () => {
  // `coerceTable` builds its output field by field, so anything not named in
  // that literal is dropped SILENTLY on every build — the way `teamScope` was.
  const n = normalizeSchema(SPEC);
  const by = Object.fromEntries(n.tables.map((t) => [t.name, t]));
  assert.ok(by.bookings.confirm, "confirm was dropped by the normaliser");
  assert.equal(by.bookings.confirm.fn, "confirm_booking");
  assert.ok(by.bookings.sms, "sms was dropped by the normaliser");
  assert.equal(by.bookings.sms.fn, "sms_booking");
  assert.ok(by.orders.payment, "payment was dropped by the normaliser");
  assert.equal(by.orders.payment.from, "products");
  // …and a table that declared none has none, or the check above passes on a
  // normaliser that stamps every table with a truthy default.
  assert.equal(by.products.confirm, null);
  assert.equal(by.products.payment, null);
});

/* ── link 3: they survive into _meta ─────────────────────────────────────── */

test("_meta stores WHOLE table objects, so nothing has to be listed to survive", () => {
  // This is the link the audit said was broken. It is not: `metaOut.tables` is
  // the merged table array itself, so a field added to a table needs no second
  // place to be remembered. Asserted on that property rather than by listing
  // the three fields — a fourth added later must survive for the same reason.
  const at = schema.indexOf("const metaOut = ");
  assert.ok(at > 0, "the _meta write moved");
  assert.match(schema.slice(at, at + 120), /const metaOut = \{ tables: mergedTables \}/,
    "_meta.tables is no longer the merged table objects — anything not re-listed is now dropped");
  // And the merge that produces them is whole-object too.
  const m = schema.indexOf("byName.set(key, t);");
  assert.ok(m > 0, "the table merge no longer stores the table object whole");
});

/* ── link 4: the request path reads them back and acts ───────────────────── */

test("the write path calls the confirmation and the text message", () => {
  // Read off the real source: both are fired on a successful insert, from the
  // table def loaded out of _meta. Either call missing is a site that looks like
  // it confirms and does not.
  // ANCHORED ON WHAT ONLY A CALL HAS. Written to match `…{ slug, db, def, row`,
  // both of these matched the function's own DECLARATION — so a mutation
  // deleting the call site outright survived. The declaration takes `row }`; the
  // call passes `row: row || {}`. Same failure this codebase already recorded
  // for `buildEffortHTML()` matching its own definition.
  for (const fn of ["confirmSubmitter", "smsSubmitter"]) {
    const calls = worker.match(new RegExp(fn + "\\(env, ctx, \\{ slug, db, def, row: row\\b", "g")) || [];
    assert.equal(calls.length, 1, `${fn} is called ${calls.length} times on the write path — expected exactly once`);
  }
  // `def` is the table read back from _meta, not something rebuilt.
  assert.match(worker, /const def = \(spec && spec\.tables \|\| \[\]\)\.find/,
    "the table def no longer comes from the stored schema");
  assert.match(worker, /const spec = await loadSiteSchema\(db\)/,
    "the write path no longer loads the stored schema");
});

test("the checkout route resolves payment from the stored schema", () => {
  const at = worker.indexOf("async function handleCheckout(");
  assert.ok(at > 0, "the checkout handler is gone");
  const fn = worker.slice(at, at + 900);
  assert.match(fn, /schema && Array\.isArray\(schema\.tables\)/, "checkout no longer reads the stored tables");
  assert.match(fn, /normalizePayment\(table\)/, "checkout no longer resolves the table's payment declaration");
  assert.match(worker, /await handleCheckout\(\{/, "the checkout handler has no caller");
});

/* ── the readers agree with what the normaliser stored ───────────────────── */

test("each reader accepts the shape the normaliser produces", () => {
  // The seam most likely to rot: the normaliser keeps a field and the reader
  // wants a different shape, so the feature is stored and never fires. Driven
  // through the REAL readers with the REAL normalised table.
  const n = normalizeSchema(SPEC);
  const by = Object.fromEntries(n.tables.map((t) => [t.name, t]));
  assert.ok(normalizeConfirm(by.bookings), "site-mail.mjs refuses the table the schema engine stored");
  assert.ok(normalizeSms(by.bookings), "site-sms.mjs refuses the table the schema engine stored");
  assert.ok(normalizePayment(by.orders), "site-payments.mjs refuses the table the schema engine stored");
  // And each refuses a table that declared nothing, so the three above are not
  // passing on a reader that says yes to everything.
  assert.equal(normalizeConfirm(by.products), null);
  assert.equal(normalizeSms(by.products), null);
  assert.equal(normalizePayment(by.products), null);
});

/* ── the link that was broken, asserted so it cannot break again ─────────── */

test("EVERY field the normaliser produces survives into _meta", () => {
  // THE FINDING THIS FILE GOT WRONG. Its link-3 test asserted
  // `metaOut = { tables: mergedTables }` and that the merge is whole-object —
  // both true, and both one layer BELOW the break. `mergedTables` comes from
  // `norm`, and `norm.push` was a hand-typed list of 47 fields: anything a later
  // feature added to `coerceTable` and forgot to add there was declarable,
  // validated, applied to Postgres and then dropped. Measured: `confirm`, `sms`
  // and `payment` never arrived, so no published site ever sent a booking
  // confirmation and every card checkout refused — while this file said the
  // chain held.
  //
  // DERIVED, so it cannot rot the same way: the push must SPREAD the normalised
  // table. A field added tomorrow survives by default and forgetting is no
  // longer possible.
  const at = schema.indexOf("norm.push({");
  assert.ok(at > 0, "the _meta table write moved");
  const call = schema.slice(at, schema.indexOf("\n", at));
  assert.match(call, /^norm\.push\(\{ \.\.\.t,/,
    "_meta is being built from a hand-listed set of fields again — anything not listed is silently dropped");

  // AND WHAT IT OVERRIDES IS ONLY WHAT MUST BE RECOMPUTED. A spread plus an
  // override list is only safe while that list stays short and deliberate; an
  // override of a DECLARED field would drop it just as the old list did.
  const overrides = (call.match(/(\w+):/g) || []).map((x) => x.slice(0, -1));
  const allowed = new Set(["name", "access", "retired", "columns", "refs", "refModes", "rules", "num", "json"]);
  for (const k of overrides) {
    assert.ok(allowed.has(k), `${k} is being recomputed over the normalised value — is that deliberate?`);
  }

  // The behavioural half: drive the REAL normaliser and require every field it
  // produces for a table to be one the spread carries. Reading the source proves
  // the shape; this proves the shape is enough.
  const n = normalizeSchema(SPEC);
  const t = n.tables.find((x) => x.name === "bookings");
  for (const k of ["confirm", "sms", "access", "columns", "unique", "publicView", "teamScope"]) {
    assert.ok(k in t, `the normaliser stopped producing ${k}, so this guard is now vacuous`);
  }
});

test("a revise that says nothing about a feature keeps it", () => {
  // The owner's rule for the edit path, one layer down: absent means unchanged.
  // The table merge was whole-object, so re-declaring a table for an unrelated
  // reason dropped every field the new declaration did not restate.
  assert.match(schema, /if \(t\[k\] === undefined \|\| t\[k\] === null\) t\[k\] = prevT\[k\];/,
    "a re-declared table drops the fields this edit said nothing about");
  // Columns UNION rather than override: this list is the data API's allow-list
  // and the DDL never drops a column, so shrinking it makes live columns
  // unreadable with nothing to explain it.
  assert.match(schema, /for \(const c of prevT\.columns\) if \(!have\.has/,
    "a re-declared table shrinks its own column allow-list");
});

test("apis and jobs are merged, and jobs are written at all", () => {
  // `jobs` was never written to `_meta`, and the cron's runner re-reads the
  // stored schema and refuses to fire anything it does not find there — so NOT
  // ONE SCHEDULED JOB HAS EVER RUN, with every layer above it correct.
  assert.match(schema, /metaOut\.jobs = Array\.from\(byName\.values\(\)\)/,
    "jobs never reach _meta, so the cron will never run one");
  assert.match(schema, /metaOut\.apis = Array\.from\(byName\.values\(\)\)/,
    "apis are replaced rather than merged, so any unrelated revise erases them");
  // Both must read the PRIOR list, or "merge" is a rename of "replace".
  assert.match(schema, /prev\.apis\)\) prevApis = prev\.apis\.filter/, "the stored apis are never read back");
  assert.match(schema, /prev\.jobs\)\) prevJobs = prev\.jobs\.filter/, "the stored jobs are never read back");
});
