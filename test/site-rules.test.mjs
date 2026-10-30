// The `rules` layer — what a table DOES, without touching a page.
//
// The property under test everywhere below is the one that costs real money to
// get wrong: a rule REPORTED as applied that the database does not have. Every
// refusal here exists because the schema engine would have skipped the rule
// silently, and a booking table that still takes double bookings looks exactly
// like one where the change worked.
import { PICTOGRAPH } from "./fixtures/pictograph.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  RULES_MODEL, RULES_TOOL,
  rulesDigest, rulesRequest, readRules, mergeRules, rulesReply, rulesUsage, runRulesEdit,
} from "../builder/site-rules.mjs";
import { normalizeSchema } from "../site-schema.mjs";
import { grantsFor } from "../site-rls.mjs";
import { resolveAccess } from "../site-access.mjs";

const bookings = {
  name: "bookings", access: "collect",
  columns: [
    { name: "customer", type: "text" }, { name: "email", type: "text" },
    { name: "slot_date", type: "text" }, { name: "slot_time", type: "text" },
    { name: "start_min", type: "integer" }, { name: "end_min", type: "integer" },
  ],
};
const menu = { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }, { name: "price", type: "text" }] };
const TABLES = [bookings, menu];

const said = (input) => ({ content: [{ type: "tool_use", name: "write_table_rules", input }] });
const one = (t) => said({ tables: [t] });

// ── the digest ──────────────────────────────────────────────────────────────

test("the digest names every column's TYPE, because noOverlap needs integers", () => {
  const d = rulesDigest(TABLES);
  assert.match(d, /start_min \(integer\)/);
  assert.match(d, /customer \(text\)/);
});

test("the digest states the pair each table has now, so absent-means-unchanged is usable", () => {
  const d = rulesDigest(TABLES);
  const pair = resolveAccess(bookings);
  assert.match(d, new RegExp("read: " + pair.read + "\\s+write: " + pair.write));
});

test("the digest states which rules are already ON", () => {
  const d = rulesDigest([{ ...bookings, unique: ["slot_date", "slot_time"], maxRows: 20 }]);
  assert.match(d, /unique on slot_date \+ slot_time/);
  assert.match(d, /maxRows 20/);
});

test("a table with no rules says so rather than saying nothing", () => {
  assert.match(rulesDigest([menu]), /rules now: none/);
});

test("the request forces the tool and carries the instruction", () => {
  const r = rulesRequest({ instruction: "email people when they book", tables: TABLES });
  assert.equal(r.model, RULES_MODEL);
  assert.deepEqual(r.tool_choice, { type: "tool", name: "write_table_rules" });
  assert.match(r.messages[0].content, /email people when they book/);
});

// ── what may be asked for at all ────────────────────────────────────────────

test("the tool offers read and write as SEPARATE fields", () => {
  const p = RULES_TOOL.input_schema.properties.tables.items.properties;
  assert.ok(p.read.enum.includes("public"), "a browsable table must be expressible");
  assert.ok(p.write.enum.includes("anyone"));
  assert.ok(!p.read.enum.includes("anyone"), "anyone is a WRITE level and naming it as a read is the bug that killed the data layer");
});

// 2026-10-29: the prebuilt senders went (the site agent writes a site's own
// sending as server code), so this lane no longer offers them or a way to clear them.
test("the tool offers no prebuilt sender and no clear", () => {
  const p = RULES_TOOL.input_schema.properties.tables.items.properties;
  assert.ok(p.read && p.unique && p.retired, "landmarks: the kept rules are offered");
  for (const gone of ["confirm", "sms", "webhooks", "clear", "payment"]) assert.ok(!Object.hasOwn(p, gone), gone + " is still offered");
});

test("the tool tells the model an empty list is the right answer for a page change", () => {
  assert.match(RULES_TOOL.input_schema.properties.tables.description, /EMPTY ARRAY/);
});

// ── validation ──────────────────────────────────────────────────────────────

test("a table the site does not have is dropped", () => {
  const { changes } = readRules(one({ table: "invoices", retired: true }), TABLES);
  assert.equal(changes.length, 0);
});

test("the pair moves, and one half moving does not move the other", () => {
  const { changes } = readRules(one({ table: "menu", read: "public" }), TABLES);
  assert.deepEqual(changes, [{ table: "menu", read: "public" }]);
});

test("a read level that is not one is dropped rather than passed through", () => {
  const { changes } = readRules(one({ table: "menu", read: "everyone" }), TABLES);
  assert.equal(changes.length, 0);
});

test("a sender or clear in the answer is not a change, and nothing is refused for it", () => {
  for (const c of [{ confirm: { to: "email", subject: "s", body: "b" } }, { sms: { to: "email", body: "b" } }, { webhooks: ["created"] }, { clear: ["confirm"] }]) {
    const r = readRules(one({ table: "bookings", ...c }), TABLES);
    assert.deepEqual(r, { changes: [], refused: [] }, JSON.stringify(c));
  }
  // The control: a kept rule beside it still lands.
  assert.equal(readRules(one({ table: "bookings", maxRows: 5, webhooks: ["created"] }), TABLES).changes[0].maxRows, 5);
});

test("noOverlap is REFUSED unless both columns are integers — the engine skips it silently otherwise", () => {
  const good = readRules(one({ table: "bookings", noOverlap: { start: "start_min", end: "end_min" } }), TABLES);
  assert.deepEqual(good.changes[0].noOverlap, { start: "start_min", end: "end_min" });
  assert.equal(good.refused.length, 0);

  const text = readRules(one({ table: "bookings", noOverlap: { start: "slot_date", end: "slot_time" } }), TABLES);
  assert.equal(text.changes.length, 0);
  assert.deepEqual(text.refused, [{ table: "bookings", rule: "noOverlap", why: "not-integers" }]);
});

test("noOverlap on one column twice is refused", () => {
  const r = readRules(one({ table: "bookings", noOverlap: { start: "start_min", end: "start_min" } }), TABLES);
  assert.equal(r.changes.length, 0);
});

test("unique keeps only columns the table declares, and dedupes", () => {
  const { changes } = readRules(one({ table: "bookings", unique: ["slot_date", "nope", "slot_date", "slot_time"] }), TABLES);
  assert.deepEqual(changes[0].unique, ["slot_date", "slot_time"]);
});

test("unique naming no real column at all leaves the table untouched", () => {
  const { changes } = readRules(one({ table: "bookings", unique: ["nope"] }), TABLES);
  assert.equal(changes.length, 0);
});

test("retired takes both booleans and nothing else", () => {
  assert.equal(readRules(one({ table: "menu", retired: true }), TABLES).changes[0].retired, true);
  assert.equal(readRules(one({ table: "menu", retired: false }), TABLES).changes[0].retired, false);
  assert.equal(readRules(one({ table: "menu", retired: "yes" }), TABLES).changes.length, 0);
});

test("maxRows must be a positive whole number", () => {
  assert.equal(readRules(one({ table: "menu", maxRows: 20 }), TABLES).changes[0].maxRows, 20);
  for (const bad of [0, -3, "lots", null]) {
    assert.equal(readRules(one({ table: "menu", maxRows: bad }), TABLES).changes.length, 0, String(bad));
  }
});

test("a table entry naming nothing changeable is not a change", () => {
  assert.equal(readRules(one({ table: "menu" }), TABLES).changes.length, 0);
});

test("no tool call at all reads as no changes, never as a throw", () => {
  assert.deepEqual(readRules({ content: [{ type: "text", text: "sure" }] }, TABLES).changes, []);
  assert.deepEqual(readRules(null, TABLES).changes, []);
});

// ⚠ THIS PINNED THE CAP until 2026-10-03 (the mixed-work fixes): it required
// the reader to stop at `MAX_RULE_TABLES`, which changed the rules of the first
// tables a message named and dropped the rest without a word. Every table the
// site has that the answer names is read now.
test("every table is read, however many — past the old cap", () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ name: "t" + i, access: "display", columns: [{ name: "a", type: "text" }] }));
  const { changes } = readRules(said({ tables: many.map((t) => ({ table: t.name, retired: true })) }), many);
  assert.equal(changes.length, 11, "a table past the old cap was dropped");
  assert.deepEqual(changes.map((c) => c.table), many.map((t) => t.name), "a change lost its own table");
});

// ── the merge ───────────────────────────────────────────────────────────────

test("a named field overrides and an unnamed one is left exactly as it was", () => {
  const prior = { tables: [{ ...bookings, unique: ["slot_date"], maxRows: 5 }] };
  const { spec } = mergeRules(prior, [{ table: "bookings", maxRows: 20 }]);
  assert.equal(spec.tables[0].maxRows, 20);
  assert.deepEqual(spec.tables[0].unique, ["slot_date"], "a rule nobody mentioned must survive");
  assert.equal(spec.tables[0].access, "collect");
});

test("THE MERGE NEVER REMOVES A COLUMN — _meta is what the data API derives from", () => {
  const { spec } = mergeRules({ tables: [bookings] }, [{ table: "bookings", retired: true }]);
  assert.deepEqual(spec.tables[0].columns.map((c) => c.name), bookings.columns.map((c) => c.name));
});

test("the merge never drops a table", () => {
  const { spec } = mergeRules({ tables: TABLES }, [{ table: "menu", retired: true }]);
  assert.equal(spec.tables.length, 2);
});

test("the merge does not mutate the stored spec it was handed", () => {
  const prior = { tables: [{ ...menu }] };
  mergeRules(prior, [{ table: "menu", read: "none" }]);
  assert.equal(prior.tables[0].read, undefined, "a merge that edits its input corrupts _meta on a failed apply");
});

test("ONE HALF OF THE PAIR MOVES AND THE OTHER KEEPS WHAT IT HAD", () => {
  // `display` is read public / write none. Opening the write must not close the
  // read, and `resolveAccess` takes the absent half from the preset.
  const { spec } = mergeRules({ tables: [menu] }, [{ table: "menu", write: "anyone" }]);
  const pair = resolveAccess(normalizeSchema(spec).tables[0]);
  assert.equal(pair.write, "anyone");
  assert.equal(pair.read, resolveAccess(menu).read);
});

test("the marketplace change: a private table becomes browsable, and the write does not open with it", () => {
  const listings = { name: "listings", access: "user", columns: [{ name: "title", type: "text" }] };
  const before = resolveAccess(listings);
  const { spec } = mergeRules({ tables: [listings] }, [{ table: "listings", read: "public" }]);
  const after = resolveAccess(normalizeSchema(spec).tables[0]);
  assert.equal(after.read, "public");
  assert.equal(after.write, before.write, "opening the reads must never open the writes");
});

test("a merged change survives normalizeSchema — the engine really receives it", () => {
  const { spec } = mergeRules({ tables: [bookings] }, [
    { table: "bookings", maxRows: 20, unique: ["slot_date", "slot_time"] },
  ]);
  const t = normalizeSchema(spec).tables[0];
  assert.equal(t.maxRows, 20);
  assert.deepEqual(t.unique, ["slot_date", "slot_time"]);
});

test("RETIRING A TABLE REALLY WITHDRAWS ITS PRIVILEGES", () => {
  // The property is "no GRANT survives", not a statement count: `grantsFor`
  // emits the REVOKEs for a retired table precisely so the withdrawal happens,
  // and asserting an empty list would have been asserting the older bug where
  // it returned nothing and a removed booking form kept its INSERT.
  const { spec } = mergeRules({ tables: [menu] }, [{ table: "menu", retired: true }]);
  const closed = grantsFor(normalizeSchema(spec).tables[0]);
  assert.ok(closed.some((s) => s.startsWith("REVOKE")), "a closed table must have its privileges taken off");
  assert.ok(!closed.some((s) => s.includes("GRANT ")), "…and must be handed none back");

  const open = grantsFor(normalizeSchema({ tables: [menu] }).tables[0]);
  assert.ok(open.some((s) => s.includes("GRANT ")), "…and an open one must, or the assertion above is vacuous");
});

test("reopening a closed table hands its privileges back", () => {
  const { spec } = mergeRules({ tables: [{ ...menu, retired: true }] }, [{ table: "menu", retired: false }]);
  const t = normalizeSchema(spec).tables[0];
  assert.equal(t.retired, false);
  assert.ok(grantsFor(t).some((s) => s.includes("GRANT ")), "closing must be reversible, or it is a deletion wearing another name");
});

// ── the reply ───────────────────────────────────────────────────────────────

test("the reply names the table and what moved, in the owner's words", () => {
  const msg = rulesReply({ applied: [{ table: "bookings", fields: ["retired", "unique"] }] });
  assert.match(msg, /bookings/);
  assert.match(msg, /whether it's open/);
  assert.match(msg, /no-duplicates/);
  assert.ok(!/\bunique\b/.test(msg), "the reply is for a shop owner, not a schema");
});

test("A REFUSAL IS ALWAYS SAID, including one with no wording written for it", () => {
  const known = rulesReply({ applied: [{ table: "b", fields: ["maxRows"] }], refused: [{ table: "b", rule: "noOverlap", why: "not-integers" }] });
  assert.match(known, /left alone/);
  const unknown = rulesReply({ applied: [{ table: "b", fields: ["maxRows"] }], refused: [{ table: "b", rule: "mystery", why: "brand-new-reason" }] });
  assert.match(unknown, /left alone/, "a reason nobody wrote a sentence for must not vanish");
  assert.match(unknown, /mystery/);
});

test("the same refusal twice is said once", () => {
  const msg = rulesReply({ applied: [{ table: "b", fields: ["maxRows"] }], refused: [
    { table: "b", rule: "noOverlap", why: "not-integers" }, { table: "c", rule: "noOverlap", why: "not-integers" },
  ] });
  assert.equal(msg.split("left alone").length - 1, 1);
});

test("nothing applied and nothing refused says so without a tick", () => {
  const msg = rulesReply({});
  assert.ok(!PICTOGRAPH.test(msg));
  assert.match(msg, /Nothing there was a rule/);
});

// ── the whole layer ─────────────────────────────────────────────────────────

const fake = (input, applyOk = true) => {
  const seen = { requests: [], applied: [] };
  const deps = {
    send: async (req) => { seen.requests.push(req); return { ...one(input), usage: { input_tokens: 900, output_tokens: 60 } }; },
    apply: async (spec) => { seen.applied.push(spec); return applyOk; },
  };
  return { deps, seen };
};

test("a rules edit applies the merged spec and never publishes", async () => {
  const { deps, seen } = fake({ table: "bookings", unique: ["slot_date", "slot_time"] });
  const r = await runRulesEdit(deps, { instruction: "stop double bookings", tables: TABLES });
  assert.equal(r.ok, true);
  assert.equal(seen.applied.length, 1);
  assert.deepEqual(seen.applied[0].tables[0].unique, ["slot_date", "slot_time"]);
  assert.equal(r.usage.model, RULES_MODEL);
  assert.equal(deps.publish, undefined, "the layer has no publish dependency at all — the protection is the absence");
});


// ── AN ANSWER CUT OFF AT ITS CEILING IS NO ANSWER (2026-10-03) ──────────────
// With no count of changes per step (the mixed-work fixes), the one bound left
// on the list is the answer itself — and a list stopped part way would make
// some changes and drop the rest without a word. It is refused whole, as a
// call that did not answer: nothing is applied.
test("a rules answer cut off at its ceiling applies nothing and is refused as a call that did not answer", async () => {
  const { deps, seen } = fake({ table: "bookings", unique: ["slot_date", "slot_time"] });
  const sent = deps.send;
  deps.send = async (req) => ({ ...(await sent(req)), stop_reason: "max_tokens" });
  const r = await runRulesEdit(deps, { instruction: "stop double bookings", tables: TABLES });
  assert.equal(r.ok, false);
  assert.equal(r.escalate, false);
  assert.equal(r.reason, "send");
  assert.equal(r.error && r.error.truncated, true);
  assert.deepEqual(seen.applied, [], "rules were applied from a cut answer");
});

test("THE WHOLE SPEC IS APPLIED, not only the table that changed", async () => {
  const { deps, seen } = fake({ table: "bookings", retired: true });
  await runRulesEdit(deps, { instruction: "close bookings", tables: TABLES });
  assert.equal(seen.applied[0].tables.length, 2, "applySiteSchema re-emits grants per table; a subset silently leaves the rest alone");
});

test("a site with no tables escalates — a page change really might be what they meant", async () => {
  const { deps, seen } = fake({ table: "bookings", retired: true });
  const r = await runRulesEdit(deps, { instruction: "close bookings", tables: [] });
  assert.equal(r.escalate, true);
  assert.equal(seen.requests.length, 0, "nothing is paid for when there was nothing to work with");
});

// ── THE CALLER RESERVES BEFORE THE SCHEMA IS TOUCHED (2026-09-05) ──────────
test("`before` is asked with the usage before the apply, and a refusal emits no DDL", async () => {
  const { deps, seen } = fake({ table: "bookings", unique: ["slot_date", "slot_time"] });
  const before = [];
  deps.before = async (usage) => { before.push(usage); return false; };
  const r = await runRulesEdit(deps, { instruction: "stop double bookings", tables: TABLES });
  assert.equal(r.ok, false);
  assert.equal(r.escalate, false);
  assert.equal(r.reason, "unbilled");
  assert.equal(before.length, 1);
  assert.ok(before[0] && Number.isFinite(before[0].in), "before was not handed the call's usage");
  assert.equal(seen.applied.length, 0, "the schema was applied after the ledger refused");
  assert.ok(r.usage, "the usage is dropped from an unbilled answer");
});

test("a `before` that throws is a refusal; one that answers yes applies as before; absent, nothing changes", async () => {
  for (const [before, applied] of [[async () => { throw new Error("down"); }, 0], [async () => true, 1], [undefined, 1]]) {
    const { deps, seen } = fake({ table: "bookings", unique: ["slot_date", "slot_time"] });
    if (before) deps.before = before;
    const r = await runRulesEdit(deps, { instruction: "stop double bookings", tables: TABLES });
    assert.equal(seen.applied.length, applied, "applied " + seen.applied.length + " times for " + String(before));
    assert.equal(r.ok, applied === 1, JSON.stringify(r));
  }
});

test("a model that matched no rule does NOT escalate — the rungs above cannot do it either", async () => {
  const { deps } = fake({ table: "bookings" });
  const r = await runRulesEdit(deps, { instruction: "make it blue", tables: TABLES });
  assert.equal(r.ok, false);
  assert.equal(r.escalate, false);
  assert.equal(r.reason, "no-match");
});

test("a refusal survives all the way out even when nothing applied", async () => {
  const { deps } = fake({ table: "bookings", noOverlap: { start: "slot_date", end: "slot_time" } });
  const r = await runRulesEdit(deps, { instruction: "no double bookings", tables: TABLES });
  assert.equal(r.ok, false);
  assert.deepEqual(r.refused, [{ table: "bookings", rule: "noOverlap", why: "not-integers" }]);
});

test("A NO-MATCH CARRIES ITS OWN SENTENCE — the route has nothing else to say", async () => {
  // The Worker renders `rOut.msg` on this path and writes no wording of its own,
  // deliberately: the refusal reason lives here. Without the message the
  // customer is told nothing at all on the one path where they most need the
  // reason, and a mutation removing it survived the whole suite.
  const { deps } = fake({ table: "bookings", noOverlap: { start: "slot_date", end: "slot_time" } });
  const r = await runRulesEdit(deps, { instruction: "no double bookings", tables: TABLES });
  assert.equal(typeof r.msg, "string");
  assert.ok(r.msg.trim().length > 0);
  assert.match(r.msg, /left alone/, "the refusal has to reach the sentence, not just the field");
});

test("a no-match with nothing refused still says something", async () => {
  const { deps } = fake({ table: "bookings" });
  const r = await runRulesEdit(deps, { instruction: "make it blue", tables: TABLES });
  assert.ok(String(r.msg || "").trim().length > 0);
});

test("a failed apply is reported, never as a success", async () => {
  const { deps } = fake({ table: "menu", retired: true }, false);
  const r = await runRulesEdit(deps, { instruction: "close it", tables: TABLES });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "apply");
});

test("an apply that throws is caught and reported, with the usage kept", async () => {
  const deps = {
    send: async () => ({ ...one({ table: "menu", retired: true }), usage: { input_tokens: 10, output_tokens: 2 } }),
    apply: async () => { throw new Error("neon down"); },
  };
  const r = await runRulesEdit(deps, { instruction: "close it", tables: TABLES });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "apply");
  assert.equal(r.usage.in, 10, "what we spent is reported even when the change failed");
});

test("a send that throws does not escalate — the rungs above would fail the same way", async () => {
  const deps = { send: async () => { throw new Error("503"); }, apply: async () => true };
  const r = await runRulesEdit(deps, { instruction: "x", tables: TABLES });
  assert.equal(r.escalate, false);
  assert.equal(r.reason, "send");
});

test("usage is the four token kinds, priced from the one table", () => {
  const u = rulesUsage({ usage: { input_tokens: 5, output_tokens: 6, cache_read_input_tokens: 7, cache_creation_input_tokens: 8 } });
  assert.deepEqual(u, { in: 5, out: 6, cacheRead: 7, cacheWrite: 8, model: RULES_MODEL });
});

// ── the guards that hold the layer's own definition ─────────────────────────

test("THE LAYER CANNOT REACH A PAGE, AND THAT IS THE PROTECTION", () => {
  const src = fs.readFileSync(new URL("../builder/site-rules.mjs", import.meta.url), "utf8");
  for (const forbidden of ["generateSitePages", "pagesRequest", "recompileAndPublish", "writeSiteDistToR2", "buySitePhotos"]) {
    assert.ok(!src.includes(forbidden), "the rules layer must not be able to call " + forbidden);
  }
});

test("the tool's own read/write enums come from site-access.mjs rather than a copy", () => {
  const src = fs.readFileSync(new URL("../builder/site-rules.mjs", import.meta.url), "utf8");
  assert.match(src, /enum:\s*READ_LEVELS/);
  assert.match(src, /enum:\s*WRITE_LEVELS/);
  assert.ok(!/enum:\s*\[\s*"none"/.test(src), "a second list of access levels is two things that can disagree");
});

// ── the stored shape (2026-10-23, audit A29-5, A29-6, A29-7) ─────────────────
//
// `_meta` holds BARE column names, the numeric ones in `num`: the fixtures
// above use typed objects, which the stored schema never has.
const storedBookings = {
  name: "sessions", access: "collect",
  columns: ["customer", "slot_date", "status", "start_min", "end_min", "extras"],
  // `int` added 2026-10-23 (review of r1-combine): the schema engine now lists
  // its integer columns beside `num`, and noOverlap accepts only those.
  num: ["start_min", "end_min"], int: ["start_min", "end_min"], json: ["extras"],
  unique: [{ columns: ["slot_date", "start_min"], where: "status:ne:cancelled" }],
  noOverlap: { start: "start_min", end: "end_min", on: ["slot_date"], where: { col: "status", op: "ne", val: "cancelled" } },
};

test("A29-5: a stored numeric column reads as a number, and noOverlap on it is accepted, its scope kept", () => {
  const d = rulesDigest([storedBookings]);
  assert.match(d, /start_min \(integer\), end_min \(integer\)/);
  assert.match(d, /extras \(json\)/);
  assert.match(d, /customer \(text\)/);
  const r = readRules(one({ table: "sessions", noOverlap: { start: "start_min", end: "end_min" } }), [storedBookings]);
  assert.deepEqual(r.refused, [], "a stored integer pair was refused as not-integers");
  assert.deepEqual(r.changes[0].noOverlap.on, ["slot_date"], "restating the rule dropped its stored scope");
  const scoped = readRules(one({ table: "sessions", noOverlap: { start: "start_min", end: "end_min", on: ["customer", "nope"] } }), [storedBookings]);
  assert.deepEqual(scoped.changes[0].noOverlap, { start: "start_min", end: "end_min", on: ["customer"] });
  // A text pair is still refused.
  const text = readRules(one({ table: "sessions", noOverlap: { start: "slot_date", end: "customer" } }), [storedBookings]);
  assert.deepEqual(text.refused, [{ table: "sessions", rule: "noOverlap", why: "not-integers" }]);
  assert.ok(RULES_TOOL.input_schema.properties.tables.items.properties.noOverlap.properties.on, "the tool offers no scope");
});

test("A29-7: the designer's unique groups and noOverlap's scope are said, never [object Object]", () => {
  const d = rulesDigest([storedBookings]);
  assert.ok(!d.includes("[object Object]"), d);
  assert.match(d, /unique on slot_date \+ start_min \(where status:ne:cancelled\)/);
  assert.match(d, /noOverlap on start_min…end_min within slot_date \(where status ne cancelled\)/);
  assert.match(rulesDigest([{ ...storedBookings, unique: ["a", "b"] }]), /unique on a \+ b/);
});

// Review of r1-combine (2026-10-23): noOverlap is built over int4range, so a
// REAL or NUMERIC pair is refused, declared or stored; only integers pass.
test("noOverlap accepts only integer columns, never REAL or NUMERIC ones", () => {
  const base = { name: "sessions", columns: ["slot_date", "start_min", "end_min"], num: ["start_min", "end_min"] };
  const ask = one({ table: "sessions", noOverlap: { start: "start_min", end: "end_min" } });
  const notInt = [{ table: "sessions", rule: "noOverlap", why: "not-integers" }];
  assert.deepEqual(readRules(ask, [base]).refused, notInt, "a stored REAL pair was accepted");
  assert.deepEqual(readRules(ask, [{ ...base, int: ["start_min", "end_min"] }]).refused, []);
  assert.deepEqual(readRules(ask, [{ ...base, int: ["start_min"] }]).refused, notInt);
  for (const type of ["real", "numeric", "number", "float"]) {
    const t = { name: "sessions", columns: [{ name: "start_min", type }, { name: "end_min", type }] };
    assert.deepEqual(readRules(ask, [t]).refused, notInt, type);
  }
  for (const type of ["integer", "int", "bigint", "int4"]) {
    const t = { name: "sessions", columns: [{ name: "start_min", type }, { name: "end_min", type }] };
    assert.deepEqual(readRules(ask, [t]).refused, [], type);
  }
});
