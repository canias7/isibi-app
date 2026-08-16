// The `rules` layer — what a table DOES, without touching a page.
//
// The property under test everywhere below is the one that costs real money to
// get wrong: a rule REPORTED as applied that the database does not have. Every
// refusal here exists because the schema engine would have skipped the rule
// silently, and a booking table that still takes double bookings looks exactly
// like one where the change worked.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  RULES_MODEL, RULES_TOOL, CLEARABLE, NOT_CLEARABLE, MAX_RULE_TABLES,
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

test("clear is bounded by an enum to what really goes away", () => {
  const p = RULES_TOOL.input_schema.properties.tables.items.properties;
  assert.deepEqual(p.clear.items.enum, CLEARABLE);
  for (const n of NOT_CLEARABLE) assert.ok(!CLEARABLE.includes(n), n + " is DDL and cannot be cleared by omission");
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

test("confirm must name a column the table really has", () => {
  const ok = readRules(one({ table: "bookings", confirm: { to: "email", subject: "s", body: "b" } }), TABLES);
  assert.equal(ok.changes[0].confirm.to, "email");
  const bad = readRules(one({ table: "bookings", confirm: { to: "e_mail", subject: "s", body: "b" } }), TABLES);
  assert.equal(bad.changes.length, 0);
  assert.deepEqual(bad.refused, [{ table: "bookings", rule: "confirm", why: "no-column" }]);
});

test("confirm with no subject or no body is refused, not half-applied", () => {
  for (const c of [{ to: "email", subject: "", body: "b" }, { to: "email", subject: "s", body: "  " }]) {
    const r = readRules(one({ table: "bookings", confirm: c }), TABLES);
    assert.equal(r.changes.length, 0, JSON.stringify(c));
    assert.equal(r.refused.length, 1);
  }
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

test("clearing a DDL constraint is REFUSED and said out loud", () => {
  const r = readRules(one({ table: "bookings", clear: ["unique"] }), TABLES);
  assert.equal(r.changes.length, 0);
  assert.deepEqual(r.refused, [{ table: "bookings", rule: "unique", why: "cannot-clear" }]);
});

test("clearing confirm is allowed", () => {
  const r = readRules(one({ table: "bookings", clear: ["confirm"] }), TABLES);
  assert.deepEqual(r.changes[0].clear, ["confirm"]);
});

test("a table entry naming nothing changeable is not a change", () => {
  assert.equal(readRules(one({ table: "menu" }), TABLES).changes.length, 0);
});

test("no tool call at all reads as no changes, never as a throw", () => {
  assert.deepEqual(readRules({ content: [{ type: "text", text: "sure" }] }, TABLES).changes, []);
  assert.deepEqual(readRules(null, TABLES).changes, []);
});

test("more tables than the cap are cut, not the whole batch dropped", () => {
  const many = Array.from({ length: MAX_RULE_TABLES + 3 }, (_, i) => ({ name: "t" + i, access: "display", columns: [{ name: "a", type: "text" }] }));
  const { changes } = readRules(said({ tables: many.map((t) => ({ table: t.name, retired: true })) }), many);
  assert.equal(changes.length, MAX_RULE_TABLES);
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

test("clear sets the rule to null, which is what the normalisers read as absent", () => {
  const prior = { tables: [{ ...bookings, confirm: { to: "email", subject: "s", body: "b" } }] };
  const { spec, applied } = mergeRules(prior, [{ table: "bookings", clear: ["confirm"] }]);
  assert.equal(spec.tables[0].confirm, null);
  assert.ok(applied[0].fields.includes("cleared confirm"));
  assert.equal(normalizeSchema(spec).tables[0].confirm, null);
});

test("clearing something that was never on is not reported as a change", () => {
  const { applied } = mergeRules({ tables: [menu] }, [{ table: "menu", clear: ["confirm"] }]);
  assert.equal(applied.length, 0);
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
    { table: "bookings", confirm: { to: "email", subject: "Booked", body: "See you {slot_date}" }, unique: ["slot_date", "slot_time"] },
  ]);
  const t = normalizeSchema(spec).tables[0];
  assert.equal(t.confirm.to, "email", "this is the exact property the addon merge DROPPED silently");
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
  const msg = rulesReply({ applied: [{ table: "bookings", fields: ["confirm", "unique"] }] });
  assert.match(msg, /bookings/);
  assert.match(msg, /confirmation email/);
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
  assert.ok(!msg.includes("✅"));
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

test("every clearable rule is one that really stops when the declaration goes", () => {
  // confirm and sms are read out of `_meta` on the write path; a constraint is
  // DDL and `applySiteSchema` is additive, so dropping it from the spec leaves
  // the index standing. This asserts the two lists cannot overlap.
  for (const c of CLEARABLE) assert.ok(!NOT_CLEARABLE.includes(c), c);
  assert.ok(CLEARABLE.length > 0 && NOT_CLEARABLE.length > 0);
});

test("the tool's own read/write enums come from site-access.mjs rather than a copy", () => {
  const src = fs.readFileSync(new URL("../builder/site-rules.mjs", import.meta.url), "utf8");
  assert.match(src, /enum:\s*READ_LEVELS/);
  assert.match(src, /enum:\s*WRITE_LEVELS/);
  assert.ok(!/enum:\s*\[\s*"none"/.test(src), "a second list of access levels is two things that can disagree");
});

// ── webhooks, the sixth thing this lane can change ─────────────────────────
//
// It belongs HERE and not in the addon lane: that one may touch an existing
// table only for payments and a public view, because both need a PAGE as well
// as a schema change. A webhook needs no page — it fires on the data path after
// the write — so it lives with the other no-page rules, in the one lane that
// can also turn it off again.

test("the rules lane can switch webhooks on, narrow them, and clear them", () => {
  const spec = { tables: [{ name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] }] };

  const on = mergeRules(spec, [{ table: "bookings", webhooks: ["created"] }]);
  assert.deepEqual(on.spec.tables[0].webhooks, ["created"], "the declaration must reach the table");
  assert.deepEqual(on.applied, [{ table: "bookings", fields: ["webhooks"] }], "and be reported");

  const widened = mergeRules(on.spec, [{ table: "bookings", webhooks: ["created", "updated", "deleted"] }]);
  assert.deepEqual(widened.spec.tables[0].webhooks, ["created", "updated", "deleted"], "a later change replaces it");

  const off = mergeRules(widened.spec, [{ table: "bookings", clear: ["webhooks"] }]);
  assert.equal(off.spec.tables[0].webhooks, null, "clearing must switch it off");
  assert.deepEqual(off.applied, [{ table: "bookings", fields: ["cleared webhooks"] }], "and say so");

  // UNTOUCHED IS UNTOUCHED. A rules change about something else must not switch
  // a customer's integration on or off as a side effect.
  const other = mergeRules(on.spec, [{ table: "bookings", maxRows: 20 }]);
  assert.deepEqual(other.spec.tables[0].webhooks, ["created"], "an unrelated change must leave it alone");
});

test("webhooks is clearable, and the tool says every clearable name", () => {
  // CLEARABLE because it is read out of `_meta` on the write path, so dropping
  // the declaration really stops the sending — unlike the constraints, which are
  // additive DDL that would stand in Postgres while `_meta` said they were gone.
  assert.ok(CLEARABLE.includes("webhooks"), "webhooks must be switchable off");
  for (const k of NOT_CLEARABLE) {
    assert.ok(!CLEARABLE.includes(k), k + " must not have become clearable");
  }
  // The enum is derived from CLEARABLE, so this asserts the DESCRIPTION keeps up
  // — a name the model can send and is never told about is one it will not use.
  const clear = RULES_TOOL.input_schema.properties.tables.items.properties.clear;
  assert.deepEqual([...clear.items.enum].sort(), [...CLEARABLE].sort(), "the enum must be the clearable set");
  for (const k of CLEARABLE) {
    assert.match(clear.description, new RegExp('"' + k + '"'), "the clear description must name " + k);
  }
});

test("the rules tool's webhook events match the deliverer's, and survive the normaliser", () => {
  const w = RULES_TOOL.input_schema.properties.tables.items.properties.webhooks;
  assert.ok(w, "the rules lane cannot declare webhooks");
  assert.deepEqual([...w.items.enum].sort(), ["created", "deleted", "updated"], "the events must be the three real ones");

  // THE WHOLE CHAIN, because this lane's output goes through `normalizeSchema`
  // before `applySiteSchema` — so an invalid event the model sends anyway is
  // filtered there rather than reaching `_meta`.
  const merged = mergeRules(
    { tables: [{ name: "t", access: "collect", columns: [{ name: "a", type: "text" }] }] },
    [{ table: "t", webhooks: ["created", "nonsense"] }],
  );
  const normalised = normalizeSchema(merged.spec).tables.find((t) => t.name === "t");
  assert.deepEqual(normalised.webhooks, ["created"], "the normaliser must drop the invented event");
});
