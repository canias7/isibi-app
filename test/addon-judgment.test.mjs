// WHAT A REQUIREMENT MEANS IS THE MODEL'S TO JUDGE; WHAT RAN IS CODE'S
// (2026-10-05, after the grounding round).
//
// The owner: *"a matching quote proves the words came from the user, not that
// the claimed requirement follows from them. I reproduced cleanRequirements →
// groundRequirements → requirementNote accepting need="Every signup receives a
// confirmation email", basis="needed", words="leave their name and email
// address" against a request to collect those details; with only the signups
// table in made, the note still says "I've set that up." The same happens with
// an invented SMS reminder quoting "book a lesson." Use the model for judging
// meaning and necessary dependencies, and code for checking provenance and
// actual execution evidence … never treat the existence of a referenced table
// as proof that the claimed behavior was implemented."*
//
// NOW, through the real route with supplied model answers:
//   · provenance — CODE: the quote must be in what they wrote (unchanged);
//   · meaning — the MODEL (`judge_requirements`): asked, needed, optional or
//     unrelated, and which listed thing carries it out;
//   · execution — CODE: every id it names must be one it was shown, and must
//     really have been applied or already be there, with the part of a table
//     that does the work (`table:signups:notify`, `…:confirm`, `…:sms`).
// The cases check the facts the reply model is really given
// (`addonReplyFacts`), not only the stored record.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addon as routeAddon, writtenPage, storedAnswer, promptFor, SITE_CONN } from "./fixtures/addon-route.mjs";
import { invalidateSiteSchema } from "../site-schema.mjs";
import { connForDatabase } from "../site-db.mjs";
import {
  cleanRequirements, groundRequirements, requirementNote, requirementOutcomes, readVerdicts, applyVerdicts,
  carrierOf, FOLLOWS, CARRIED, TABLE_PARTS, SITE_KINDS,
} from "../builder/site-requirements.mjs";
import { tableParts, judgeItems, runJudge, judgeRequest, appliedFacts, existingFacts, JUDGE_TOOL, PART_SAYS } from "../builder/site-add.mjs";
import { addonReplyFacts } from "../builder/site-reply.mjs";
import { addonReply } from "../builder/site-addon.mjs";
import { browserReply } from "../scripts/addon-sweep.mjs";

// EVERY CASE STARTS FROM ITS OWN STORED SCHEMA. The harness gives every slug
// the same database connection, and the schema read is cached by it — so a
// case that applied `signups` would otherwise be the next case's stored site.
const addon = (slug, msg, opts) => routeAddon(slug, msg, { ...opts, setup: () => invalidateSiteSchema(connForDatabase(SITE_CONN, "sitedb")) });
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"], link: { in: "menu" } });
const table = (name, columns, extra = {}) => ({ table: { name, access: "collect", columns: columns.map((c) => ({ name: c, type: "text" })), ...extra } });
const facts = (body) => (addonReplyFacts(body).facts || []).map((f) => f.kind + ": " + f.text);
const coverOf = (r) => String(r.body.coverNote || "");
const browserText = (body) => { const b = browserReply(body, true); assert.ok(b.ok, "the browser's composer could not run: " + b.why); return b.text; };
/** What every judgment call was really shown: the user message the route sent. */
const judged = (r) => r.prompts.filter((p) => p.tool === "judge_requirements").map((p) => {
  const m = JSON.parse(p.text).find((x) => x && x.role === "user");
  return typeof m.content === "string" ? m.content : m.content.map((c) => c.text || "").join("\n");
});
/**
 * THE MODEL'S ANSWER, per requirement, by what its need says — the stand-in
 * for the judgment, written the way that model is asked to answer. Before a
 * hand-off it judges meaning only.
 */
const judging = (rules) => ({
  judge: ({ entries, step }) => ({
    verdicts: entries.map((e) => {
      const hit = rules.find(([re]) => re.test(e.need));
      if (!hit) return null;
      const [, follows, carried = "unsure", by = []] = hit;
      return step ? { id: e.id, follows, carried: "unsure", reason: "before the hand-off" } : { id: e.id, follows, carried, by, reason: "the case's verdict" };
    }).filter(Boolean),
  }),
});
const REPORTABLE = [...SITE_KINDS, "component", "edit"];

// ─────────────────────────────────────────────────────────────────────────────
// THE OWNER'S TWO REPRODUCTIONS, AT THE MODULE
// ─────────────────────────────────────────────────────────────────────────────

test("JUDGE 1 — the owner's reproductions at the module: the genuine quote still passes provenance; with judging in force an entry nobody judged is never told, and a table that exists is not the email or the text it names", () => {
  const SIGNUP = "Add a sign-up page where people leave their name and email address";
  const LESSON = "Add a page where students can book a lesson";
  const email = groundRequirements(cleanRequirements([{ need: "Every signup receives a confirmation email", basis: "needed", words: "leave their name and email address", status: "covered", by: "signups keeps the address", kind: "table", item: "signups" }], "table").list, { asked: [SIGNUP] });
  const sms = groundRequirements(cleanRequirements([{ need: "Each student gets a text reminder the day before", basis: "needed", words: "book a lesson", status: "covered", by: "lesson_bookings keeps the number", kind: "table", item: "lesson_bookings" }], "table").list, { asked: [LESSON] });
  // PROVENANCE IS UNCHANGED, AND IT IS NOT THE QUESTION: the quotes are theirs.
  assert.deepEqual([email.list.length, email.ungrounded.length, sms.list.length, sms.ungrounded.length], [1, 0, 1, 0]);
  const spec = { tables: [{ name: "signups", access: "collect", columns: [{ name: "name" }, { name: "email" }] }, { name: "lesson_bookings", access: "collect", columns: [{ name: "student" }, { name: "mobile" }] }] };
  const made = appliedFacts({ spec, tables: ["signups", "lesson_bookings"] });
  const ctx = { made, reportable: REPORTABLE };
  // THE OWNER'S OBSERVATION, KEPT AS THE CONTROL: a caller that does not judge
  // reads exactly what it always read — the table exists, so "I've set that up".
  assert.match(requirementNote(email.list, ctx), /I've set that up[^.]*confirmation email/);
  assert.match(requirementNote(sms.list, ctx), /I've set that up[^.]*text reminder/);
  // JUDGING IN FORCE, NOTHING JUDGED: never told — not "set up", not "can't see".
  for (const list of [email.list, sms.list]) {
    assert.equal(requirementNote(list, { ...ctx, judged: true }), "", "a requirement nobody judged was told");
    const o = requirementOutcomes(list, { ...ctx, judged: true });
    assert.deepEqual(o.map((x) => [x.state, x.unjudged]), [["unknown", true]]);
  }
  // A VERDICT NAMING THE TABLE'S EMAIL PART, which the table does not have: the
  // part is checked, the table's existence is not enough — "Still to do".
  const yesConfirm = { ...email.list[0], judged: { follows: "needed", carried: "yes", by: ["table:signups:confirm"], reason: "" } };
  const oc = requirementOutcomes([yesConfirm], { ...ctx, judged: true })[0];
  assert.deepEqual([oc.state, oc.implementation, oc.why], ["missing", "found", "the signups table does not do this"]);
  assert.doesNotMatch(requirementNote([yesConfirm], { ...ctx, judged: true }), /I've set that up/);
  const yesSms = { ...sms.list[0], judged: { follows: "needed", carried: "yes", by: ["table:lesson_bookings:sms"], reason: "" } };
  assert.equal(requirementOutcomes([yesSms], { ...ctx, judged: true })[0].state, "missing");
  // "NO" IS STILL TO DO; "UNSURE" FALLS TO THE DESIGNER'S OWN REFERENCE AND MAY
  // NOT BUY "I've set that up" — the referenced table being there is not the email.
  const no = { ...email.list[0], judged: { follows: "needed", carried: "no", by: [], reason: "nothing sends one" } };
  assert.match(requirementNote([no], { ...ctx, judged: true }), /^Still to do: Every signup receives a confirmation email\.$/);
  const unsure = { ...email.list[0], judged: { follows: "needed", carried: "unsure", by: [], reason: "" } };
  const ou = requirementOutcomes([unsure], { ...ctx, judged: true })[0];
  assert.deepEqual([ou.state, ou.capped, ou.implementation], ["unknown", true, "found"]);
  assert.doesNotMatch(requirementNote([unsure], { ...ctx, judged: true }), /I've set that up/);
  // A STORED VERDICT THAT SAYS "YES" AND NAMES NOTHING CHECKABLE IS NO VERDICT:
  // the route never writes one, and a caller that hands one in is unjudged —
  // with nothing to look for, a "yes" would otherwise be "I've set that up".
  for (const by of [[], ["junk"], ["table:signups:fax"]]) {
    const bare = { ...email.list[0], judged: { follows: "needed", carried: "yes", by, reason: "" } };
    assert.deepEqual(requirementOutcomes([bare], { ...ctx, judged: true }).map((x) => [x.state, x.unjudged]), [["unknown", true]], JSON.stringify(by));
    assert.equal(requirementNote([bare], { ...ctx, judged: true }), "", "a yes naming nothing was told: " + JSON.stringify(by));
  }
  // AND THE PART THAT REALLY IS THERE: a collect table emails its owner.
  const owner = { id: "table#9", need: "The owner hears about each signup", status: "covered", from: "table", kind: "table", item: "signups", judged: { follows: "asked", carried: "yes", by: ["table:signups:notify"], reason: "" } };
  const on = requirementOutcomes([owner], { ...ctx, judged: true })[0];
  assert.deepEqual([on.state, on.carriedBy, on.implementedBy, on.foundIn], ["unverified", ["table:signups:notify"], "signups", "applied"]);
});

test("JUDGE 2 — what a table does is read off the table as stored, one reader for applied, existing and shown: the owner's email needs a collect table a visitor may write to; an email or text to the visitor needs its declaration; nothing else counts", () => {
  assert.deepEqual(tableParts({ name: "a", access: "collect" }), ["notify"]);
  assert.deepEqual(tableParts({ name: "a", access: "collect", write: "none" }), [], "a collect table nobody may write to still emails the owner");
  assert.deepEqual(tableParts({ name: "a", access: "display" }), []);
  assert.deepEqual(tableParts({ name: "a", access: "user" }), []);
  assert.deepEqual(tableParts({ name: "a", access: "user", confirm: { to: "email", subject: "s", body: "b" }, sms: { fn: "text_me" }, webhooks: ["created"], payment: { from: "menu" } }), ["confirm", "sms", "webhooks", "payment"]);
  assert.deepEqual(tableParts({ name: "a", access: "user", confirm: null, sms: [], webhooks: [], payment: "yes" }), [], "a part nothing declared was read as there");
  assert.deepEqual(tableParts({ name: "a", webhooks: true }), ["webhooks"]);
  assert.deepEqual([tableParts(null), tableParts("collect")], [[], []]);
  // EVERY PART HAS ITS ONE LINE, AND EVERY LINE IS A PART.
  assert.deepEqual(Object.keys(PART_SAYS).sort(), [...TABLE_PARTS].sort());
  // THE PARTS RIDE ON BOTH INVENTORIES, never in `holds` (a claim's words cannot name its way into one).
  const spec = { tables: [{ name: "signups", access: "collect", columns: [{ name: "email" }] }] };
  const a = appliedFacts({ spec, tables: ["signups"] })[0];
  assert.deepEqual(a.parts, ["notify"]);
  assert.ok(!a.holds.includes("notify"), "a part reached the claim vocabulary");
  assert.deepEqual(existingFacts({ spec }).items, [{ kind: "table", name: "signups", parts: ["notify"] }]);
});

test("JUDGE 3 — the judgment's answer is cleaned by code: only ids it was shown, only things it was shown, every verdict from its own constants, nothing repaired — and every requirement it was shown is accounted for, with a verdict anybody can use or named as missing, and why", () => {
  const ids = ["table#0", "table#1", "page#0", "page#1", "page#2", "page#3"];
  const items = ["table:signups", "table:signups:notify", "page:/sign-up"];
  const { verdicts, invalid, missing } = readVerdicts({ verdicts: [
    { id: "table#0", follows: "needed", carried: "yes", by: ["table:signups", "TABLE:SIGNUPS", " table:signups:notify ", "function:send_confirmation"], reason: "  kept\n so the owner can read them " },
    { id: "table#1", follows: "optional", carried: "no", by: ["function:anything"], reason: "works without it" },
    { id: "page#0", follows: "asked", carried: "yes", by: ["function:send_confirmation"], reason: "x" },
    { id: "page#1", follows: "implied", carried: "yes", by: ["page:/sign-up"], reason: "x" },
    { id: "page#2", follows: "asked", carried: ["yes"], reason: "x" },
    { id: "table#0", follows: "unrelated", carried: "no", reason: "a second verdict" },
    { id: "made-up#7", follows: "asked", carried: "no", reason: "x" },
    "not an object",
  ] }, { ids, items });
  assert.deepEqual([...verdicts.keys()], ["table#0", "table#1"]);
  // A THING IT NAMES THAT IT WAS NEVER SHOWN IS DROPPED BESIDE ONE IT WAS; FOR
  // "NO" THE LIST IS NOT READ AT ALL.
  assert.deepEqual(verdicts.get("table#0"), { follows: "needed", carried: "yes", by: ["table:signups", "table:signups:notify"], reason: "kept so the owner can read them" });
  assert.deepEqual(verdicts.get("table#1"), { follows: "optional", carried: "no", by: [], reason: "works without it" });
  // RE-ANCHORED 2026-10-06 (the owner: "Keep legitimate 'unsure' judgments
  // distinct from missing judgments"): a "yes" naming only what it was never
  // shown was read as "unsure". It is not a verdict — it is named as missing.
  assert.deepEqual(missing, [
    { id: "page#0", why: "yes-without-items" }, { id: "page#1", why: "no-follows" },
    { id: "page#2", why: "no-carried" }, { id: "page#3", why: "no-verdict" },
  ]);
  assert.deepEqual(invalid.map((x) => x.why), ["unlisted-item", "unlisted-item", "yes-without-items", "no-follows", "no-carried", "repeated", "unknown-id", "unreadable"]);
  // "UNSURE" IS A VERDICT, AND A WHOLE ONE.
  const unsure = readVerdicts({ verdicts: [{ id: "page#0", follows: "asked", carried: "unsure", reason: "x" }] }, { ids: ["page#0"], items });
  assert.deepEqual([unsure.verdicts.get("page#0").carried, unsure.missing], ["unsure", []]);
  // AN EMPTY LIST, A LIST THAT IS NOT ONE, NO ANSWER AT ALL: every requirement missing.
  for (const input of [{ verdicts: [] }, { verdicts: "all fine" }, null]) {
    assert.deepEqual(readVerdicts(input, { ids: ["a#0", "b#1"] }).missing, [{ id: "a#0", why: "no-verdict" }, { id: "b#1", why: "no-verdict" }], JSON.stringify(input));
  }
  assert.deepEqual(readVerdicts(null, { ids }).invalid, [{ why: "no-verdicts" }]);
  assert.deepEqual(readVerdicts({ verdicts: "all fine" }, { ids }).invalid, [{ why: "no-verdicts" }]);
  assert.deepEqual(readVerdicts({ verdicts: [] }, { ids }).invalid, []);
  // BEFORE A HAND-OFF, MEANING ONLY: a `follows` is a whole verdict there, and
  // `carried` and `by` are not read.
  const before = readVerdicts({ verdicts: [{ id: "a#0", follows: "asked", carried: "yes", by: ["page:/nowhere"], reason: "r" }, { id: "b#1", follows: "optional" }] }, { ids: ["a#0", "b#1"], meaningOnly: true });
  assert.deepEqual([...before.verdicts.entries()], [["a#0", { follows: "asked", carried: "unsure", by: [], reason: "r" }], ["b#1", { follows: "optional", carried: "unsure", by: [], reason: "" }]]);
  assert.deepEqual([before.missing, before.invalid], [[], []]);
  assert.deepEqual(readVerdicts({ verdicts: [{ id: "a#0", carried: "no" }] }, { ids: ["a#0"], meaningOnly: true }).missing, [{ id: "a#0", why: "no-follows" }]);
  // THE ID SHAPES: a kind this layer knows, a name, and for a table a part from the vocabulary.
  assert.deepEqual(carrierOf("table:signups:confirm"), { kind: "table", name: "signups", part: "confirm" });
  assert.deepEqual(carrierOf("page:/sign-up"), { kind: "page", name: "/sign-up" });
  for (const bad of ["table:signups:fax", "spell:x", "table:", ":x", "", 7, "edit:/"]) assert.equal(carrierOf(bad), null, String(bad));
  assert.deepEqual([FOLLOWS, CARRIED], [["asked", "needed", "optional", "unrelated"], ["yes", "no", "unsure"]]);
});

test("JUDGE 4 — meaning is judged once, before anything is handed on; what carries it out is judged at the end; an optional idea and an unrelated one leave the list, and one nobody judged stays unjudged", () => {
  const list = [
    { id: "table#0", need: "kept", status: "covered" },
    { id: "table#1", need: "a text the day before", status: "elsewhere", step: "page" },
    { id: "table#2", need: "a thank-you email", status: "covered" },
    { id: "table#3", need: "silence", status: "covered" },
  ];
  const v = (follows, carried = "unsure", by = []) => ({ follows, carried, by, reason: follows });
  const first = applyVerdicts(list, new Map([["table#0", v("needed", "yes", ["table:x"])], ["table#1", v("unrelated")], ["table#2", v("optional")]]));
  assert.deepEqual(first.kept.map((e) => [e.id, e.judged.carried, e.judged.by]), [["table#0", "unsure", []]], "a verdict before the hand-off decided what carries it out");
  assert.deepEqual([first.optional.map((e) => e.id), first.unrelated.map((e) => e.id), first.unjudged.map((e) => e.id)], [["table#2"], ["table#1"], ["table#3"]]);
  // THE LAST JUDGMENT KEEPS THE FIRST MEANING, and decides what carries it out.
  const last = applyVerdicts([first.kept[0], list[3]], new Map([["table#0", v("unrelated", "yes", ["table:x"])], ["table#3", v("asked", "no")]]), { final: true });
  assert.deepEqual(last.kept.map((e) => [e.id, e.judged.follows, e.judged.carried, e.judged.by]), [["table#0", "needed", "yes", ["table:x"]], ["table#3", "asked", "no", []]]);
  // AN ENTRY KEPT EARLIER THAT THE LAST ANSWER SKIPPED keeps its meaning, unsure of the rest.
  const skipped = applyVerdicts([first.kept[0]], new Map(), { final: true });
  assert.deepEqual(skipped.kept.map((e) => [e.judged.follows, e.judged.carried]), [["needed", "unsure"]]);
  assert.deepEqual(applyVerdicts([list[3]], new Map(), { final: true }).unjudged.map((e) => e.id), ["table#3"]);
});

test("JUDGE 5 — the judgment's call: one tool, a question beside it, the rules cached; it is shown their words, every requirement on its own line and every listed thing by id; before a hand-off it is shown no things and asked for meaning only", () => {
  assert.equal(JUDGE_TOOL.name, "judge_requirements");
  assert.deepEqual(Object.keys(JUDGE_TOOL.input_schema.properties).sort(), ["question", "verdicts"]);
  const item = JUDGE_TOOL.input_schema.properties.verdicts.items;
  assert.deepEqual(item.required, ["id", "follows", "carried", "reason"]);
  assert.equal(item.properties.follows.enum, FOLLOWS);
  assert.equal(item.properties.carried.enum, CARRIED);
  const entry = { id: "table#0", need: "Every signup is kept", basis: "needed", words: "leave their name", status: "covered", from: "table", kind: "table", item: "signups", junk: { x: 1 } };
  const items = judgeItems({ answers: [{ kind: "table", value: [table("signups", ["name", "email"], { confirm: { to: "email", subject: "s", body: "b" } })] }] });
  assert.deepEqual(items.map((i) => i.id), ["table:signups", "table:signups:notify", "table:signups:confirm"]);
  // EVERY KIND UNDER THE IDENTITY ITS APPLIED FACTS USE: a page by its route and
  // the photographs on it by placement; a photograph by its own name and its
  // page; what the site already has; and what a requirement names that is in
  // neither list, once.
  const all = judgeItems({
    answers: [
      { kind: "page", value: [{ path: "/gallery", name: "Gallery" }] },
      { kind: "photo", value: [{ page: "/visit", describe: "the oven", name: "oven" }] },
      { kind: "function", value: { name: "count_signups", internal: true, returns: "bigint", body: "SELECT count(*) FROM signups" } },
    ],
    existing: { items: [{ kind: "table", name: "bookings", parts: [] }, { kind: "page", name: "/" }] },
    spec: { tables: [{ name: "bookings", access: "user", columns: [{ name: "who" }] }] },
    refs: [{ status: "elsewhere", step: "page", item: "/rates" }, { status: "covered", kind: "page", item: "/gallery" }, { status: "covered", item: "/x" }],
  });
  assert.deepEqual(all.map((i) => i.id), ["page:/gallery", "photo:/gallery", "photo:oven", "photo:/visit", "function:count_signups", "table:bookings", "page:/", "page:/rates"]);
  assert.match(all.find((i) => i.id === "page:/rates").text, /neither designed by this request nor already on the site/);
  assert.match(all.find((i) => i.id === "function:count_signups").text, /run only by the platform.*its SQL: SELECT count/);
  const req = judgeRequest({ message: "Add a sign-up page", entries: [entry], items, model: "m" });
  assert.equal(req.tool_choice.name, "judge_requirements");
  assert.ok(req.system[0].cache_control && req.tools[0].cache_control, "the fixed half is not cached");
  const text = req.messages[0].content;
  assert.ok(text.includes(JSON.stringify({ id: "table#0", need: "Every signup is kept", basis: "needed", words: "leave their name", status: "covered", from: "table", kind: "table", item: "signups" })), text);
  assert.match(text, /- table:signups:confirm — part of the table signups: the person who adds a row is emailed/);
  assert.match(text, /- table:signups:notify — part of the table signups: the owner is emailed about each new row/);
  const before = judgeRequest({ message: "x", entries: [entry], items, step: "page", model: "m" }).messages[0].content;
  assert.match(before, /about to be handed to the page step/);
  assert.doesNotMatch(before, /What this request designed/);
  // THE RULES SAY WHAT A QUOTE IS NOT, AND WHAT A TABLE THAT ONLY KEEPS THINGS DOES NOT DO — in words, for the model to weigh.
  assert.match(req.system[0].text, /A real quote does not make the requirement theirs/);
  assert.match(req.system[0].text, /a table that stores email addresses sends nobody an email/);
  assert.match(req.system[0].text, /Never ask about an optional extra/);
});

test("JUDGE 6 — the judgment's runner: a throw fails at once and a cut-off answer is unfinished, neither asked again; an entry it cannot name is unfinished before any call; an answer that leaves any requirement without a usable verdict is asked once more, naming each and why, and fails as incomplete if still short — never a third call; a question is a question on either call; one call is billed", async () => {
  const entries = [{ id: "table#0", need: "a", status: "covered" }, { id: "table#1", need: "b", status: "covered" }];
  const reply = (input, extra = {}, usage = { input_tokens: 9, output_tokens: 3 }) => ({ content: [{ type: "tool_use", name: "judge_requirements", input }], usage, ...extra });
  const A = { id: "table#0", follows: "asked", carried: "no", reason: "r" };
  const B = { id: "table#1", follows: "needed", carried: "unsure", reason: "r" };
  const run = async (answers, more = {}) => {
    const sent = [];
    const j = await runJudge({ send: async (req) => { sent.push(req); const a = answers[sent.length - 1]; if (a instanceof Error) throw a; return a; } }, { entries, ...more });
    return { j, sent, last: sent.length ? sent[sent.length - 1].messages[0].content : "" };
  };
  // A WHOLE ANSWER: one call, nothing asked again.
  const done = await run([reply({ verdicts: [A, B] })]);
  assert.deepEqual([done.sent.length, done.j.failed, done.j.attempts, [...done.j.verdicts.keys()], done.j.missing], [1, false, 1, ["table#0", "table#1"], []]);
  assert.doesNotMatch(done.last, /YOUR LAST ANSWER/);
  // A THROW FAILS AT ONCE, as a designer's call does…
  const down = await run([new Error("down")]);
  assert.deepEqual([down.sent.length, down.j.failed, !!down.j.incomplete], [1, true, false]);
  // …AND A CUT-OFF ANSWER IS AN UNFINISHED ONE, on either call, never asked
  // again: the same budget would cut it the same way.
  const cut = await run([reply({ verdicts: [] }, { stop_reason: "max_tokens" })]);
  assert.deepEqual([cut.sent.length, cut.j.failed, cut.j.incomplete, cut.j.error.truncated, cut.j.error.incomplete, cut.j.usage.out], [1, true, true, true, true, 3]);
  const cutLate = await run([reply({ verdicts: [A] }), reply({ verdicts: [A, B] }, { stop_reason: "max_tokens" }), reply({ verdicts: [A, B] })]);
  assert.deepEqual([cutLate.sent.length, cutLate.j.failed, cutLate.j.incomplete], [2, true, true]);
  // AN ENTRY IT CANNOT NAME CANNOT GET A VERDICT: unfinished, and no call.
  let unnamed = 0;
  const noId = await runJudge({ send: async () => { unnamed++; return reply({ verdicts: [A, B] }); } }, { entries: [...entries, { need: "c", status: "covered" }] });
  assert.deepEqual([unnamed, noId.failed, noId.incomplete, noId.missing], [0, true, true, [{ id: "", why: "no-id", need: "c" }]]);
  // EMPTY, PARTIAL, MALFORMED, NOT A LIST, NO TOOL CALL AT ALL: asked once
  // more, each requirement named with why; the verdicts of both kept.
  const firsts = [
    [reply({ verdicts: [] }), /table#0 \(no verdict\), table#1 \(no verdict\)/],
    [reply({ verdicts: [A] }), /: table#1 \(no verdict\)\./],
    [reply({ verdicts: [A, { ...B, follows: "maybe" }] }), /: table#1 \(no `follows` from the four allowed\)\./],
    [reply({ verdicts: [A, { ...B, carried: "probably" }] }), /: table#1 \(no `carried` from the three allowed\)\./],
    [reply({ verdicts: [A, { ...B, carried: "yes", by: ["function:never_shown"] }] }), /: table#1 \("yes" naming nothing that is listed\)\./],
    [reply({ verdicts: "fine" }), /table#0 \(no verdict\), table#1 \(no verdict\)/],
    [{ content: [{ type: "text", text: "fine" }] }, /table#0 \(no verdict\), table#1 \(no verdict\)/],
  ];
  for (const [first, named] of firsts) {
    const r = await run([first, reply({ verdicts: [A, B] }, {}, { input_tokens: 70, output_tokens: 7 })]);
    assert.equal(r.sent.length, 2, JSON.stringify(first));
    assert.match(r.last, /YOUR LAST ANSWER LEFT THESE WITHOUT A VERDICT ANYBODY CAN USE/);
    assert.match(r.last, named);
    assert.deepEqual([r.j.failed, r.j.attempts, [...r.j.verdicts.keys()].sort(), r.j.missing], [false, 2, ["table#0", "table#1"], []]);
    // ONE CALL BILLED: the first; the second is ours, kept apart.
    assert.equal(r.j.extraUsage.in, 70);
    assert.notEqual(r.j.usage && r.j.usage.in, 70);
  }
  // BOTH ANSWERS KEPT: a second answer giving only what the first left out
  // finishes the judgment with the first's verdicts…
  const rest = await run([reply({ verdicts: [A] }), reply({ verdicts: [B] })]);
  assert.deepEqual([rest.j.failed, rest.j.verdicts.get("table#0").carried, rest.j.verdicts.get("table#1").follows, rest.j.askedAgain], [false, "no", "needed", [{ id: "table#1", why: "no-verdict" }]]);
  // …AND THE SECOND'S WHERE IT GAVE ONE: it answered with what it missed in front of it.
  const later = await run([reply({ verdicts: [A, { ...B, follows: "maybe" }] }), reply({ verdicts: [{ ...A, carried: "unsure" }, B] })]);
  assert.deepEqual([later.j.failed, later.j.verdicts.get("table#0").carried], [false, "unsure"]);
  // STILL SHORT AFTER THE SECOND: incomplete and failed, and never a third call.
  const short = await run([reply({ verdicts: [] }), reply({ verdicts: [A] }), reply({ verdicts: [A, B] })]);
  assert.deepEqual([short.sent.length, short.j.failed, short.j.incomplete, short.j.missing], [2, true, true, [{ id: "table#1", why: "no-verdict" }]]);
  assert.deepEqual([...short.j.verdicts.keys()], ["table#0"]);
  // A THROW ON THE SECOND CALL IS A FAILED CALL, not an unfinished answer.
  const late = await run([reply({ verdicts: [] }), new Error("down")]);
  assert.deepEqual([late.sent.length, late.j.failed, !!late.j.incomplete], [2, true, false]);
  // A QUESTION, ON EITHER CALL, IS A QUESTION.
  const q1 = await run([reply({ verdicts: [], question: { text: "Pay online, or at the lesson?" } })]);
  assert.deepEqual([q1.sent.length, q1.j.failed, q1.j.ask.text], [1, false, "Pay online, or at the lesson?"]);
  const q2 = await run([reply({ verdicts: [] }), reply({ verdicts: [], question: { text: "Pay online, or at the lesson?" } })]);
  assert.deepEqual([q2.sent.length, q2.j.failed, q2.j.ask.text], [2, false, "Pay online, or at the lesson?"]);
  // BEFORE A HAND-OFF, MEANING ONLY: a `follows` for each is whole at once.
  const before = await run([reply({ verdicts: [{ id: "table#0", follows: "asked", carried: "yes", by: ["x:y"] }, { id: "table#1", follows: "optional" }] })], { step: "page" });
  assert.deepEqual([before.sent.length, before.j.failed, before.j.missing], [1, false, []]);
  // NOTHING TO JUDGE IS NO CALL.
  let calls = 0;
  await runJudge({ send: async () => { calls++; return reply({ verdicts: [] }); } }, { entries: [] });
  assert.equal(calls, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// THROUGH THE ROUTE
// ─────────────────────────────────────────────────────────────────────────────

const SIGNUP = "Add a sign-up page where people leave their name and email address";
const STORE = { need: "Each signup is kept so the owner can read them", status: "covered", by: "signups keeps each one", item: "signups", kind: "table", basis: "needed", words: "leave their name and email address" };
const EMAIL = { need: "Every signup receives a confirmation email", status: "covered", by: "signups keeps the email address", item: "signups", kind: "table", basis: "needed", words: "leave their name and email address" };
const signupAsk = (slug, msg, requirements, extra = {}, tableExtra = {}) => addon(slug, msg, {
  kinds: ["table", "page"], publishes: true, written: [writtenPage("/sign-up")],
  answers: { table: { table: [table("signups", ["name", "email"], tableExtra)], requirements }, page: { page: [PAGE("/sign-up", "Sign up")] } },
  ...extra,
});

test("JUDGE 7 — the owner's first reproduction through the route: the confirmation email quoting their real words is judged an optional extra — offered, never set up; the storage it rests on is a real dependency and is said as set up and unchecked; the reply model is given exactly that", async () => {
  const r = await signupAsk("fw-judge-signup", SIGNUP, [STORE, EMAIL], judging([
    [/kept so the owner/, "needed", "yes", ["table:signups"]],
    [/confirmation email/, "optional", "no"],
  ]));
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  const rec = storedAnswer(r, "fw-judge-signup").coverage;
  // PROVENANCE PASSED BOTH — the quotes are theirs — so this is the judgment's doing.
  assert.equal(rec.ungrounded, undefined, "a genuine quote was set aside by the grounding, so this case tests nothing");
  // WHAT THE JUDGMENT WAS REALLY SHOWN: both requirements with their quotes, the
  // table this request designed and the one part it really has — no email to the visitor.
  const shown = judged(r);
  assert.equal(shown.length, 1, "expected exactly one judgment: " + shown.length);
  assert.ok(shown[0].includes('"need":"Every signup receives a confirmation email","basis":"needed","words":"leave their name and email address"'), shown[0]);
  assert.match(shown[0], /- table:signups — a table, added by this request; it keeps name, email/);
  assert.match(shown[0], /- table:signups:notify — part of the table signups: the owner is emailed about each new row/);
  assert.doesNotMatch(shown[0], /table:signups:confirm/, "the judgment was shown an email part nothing designed");
  assert.match(shown[0], /^What they asked for:\nAdd a sign-up page where people leave their name and email address\n/);
  // THE RECORD: the storage kept and carried by the table; the email set aside as optional.
  assert.deepEqual(rec.requirements.map((q) => [q.need, q.state, q.carriedBy]), [[STORE.need, "unverified", ["table:signups"]]]);
  assert.deepEqual(rec.setAside.map((s) => [s.need, s.follows]), [[EMAIL.need, "optional"]]);
  assert.equal(rec.judged, true);
  // NOTHING THAT SENDS MAIL WAS MADE FOR IT.
  const stored = r.meta().tables.find((t) => t.name === "signups");
  assert.ok(stored && !stored.confirm, "a confirmation email was configured for an idea nobody asked for: " + JSON.stringify(stored));
  // THE FACTS THE REPLY MODEL IS GIVEN: the storage as set up-and-unchecked, the
  // email once — as an idea they could ask for — and nowhere as done or not done.
  const f = facts(r.body);
  // ONE FACT PER REQUIREMENT, ITS KIND THE STATE'S (2026-10-06): set up and
  // unchecked is done with something worth knowing, never "not done".
  assert.ok(f.includes("note: Set up, but nothing here can check that it works: Each signup is kept so the owner can read them."), JSON.stringify(f));
  assert.ok(!f.some((x) => /I've set that up/.test(x)), "the cover note was given to the reply model beside the requirements: " + JSON.stringify(f));
  assert.deepEqual(f.filter((x) => /confirmation email/.test(x)), ["note: Something they did not ask for, so nothing was made for it, which they could ask for if they want: “Every signup receives a confirmation email”."], JSON.stringify(f));
  assert.doesNotMatch(coverOf(r), /confirmation email/, coverOf(r));
  // AND THE TWO COMPOSED REPLIES AGREE.
  for (const text of [addonReply(r.body), browserText(r.body)]) {
    assert.doesNotMatch(text, /set that up[^.]*confirmation email/, text);
    assert.match(text, /Every signup receives a confirmation email/, "the idea was not offered: " + text);
  }
  // THE COVERAGE MARK COUNTS WHAT LEFT THE LIST.
  const mark = r.traces.find((t) => t && t.phase === "coverage");
  assert.ok(mark, "no coverage mark");
  // …AND THE STATES REACH THE STORED TRACE (2026-10-07): one mark of seventeen
  // keys kept its first eight, so `setAside`, `unsent` and the states never
  // arrived. Each mark now fits, and the keys after `lost` are on their own.
  const states = r.traces.find((t) => t && t.phase === "coverage:states");
  assert.ok(states && states.detail, "no states mark: " + JSON.stringify(r.traces.map((t) => t && t.phase)));
  for (const k of ["done", "broke", "unsure", "gone", "unseen", "unjudged", "setAside", "unsent"]) assert.ok(Object.hasOwn(states.detail, k), "the states mark lost `" + k + "`: " + JSON.stringify(states.detail));
  assert.ok(states.detail.setAside >= 1, "what left the list is not counted: " + JSON.stringify(states.detail));
  const unbuilt = r.traces.find((t) => t && t.phase === "coverage:unbuilt");
  assert.ok(unbuilt && unbuilt.detail && Object.hasOwn(unbuilt.detail, "unbuilt"), "the unbuilt count left no mark");
  for (const k of ["total", "covered", "elsewhere", "unsupported", "unreadable", "bad", "moved", "lost"]) assert.ok(Object.hasOwn(mark.detail || {}, k), "the counts mark lost `" + k + "`");
  const jm = r.traces.find((t) => t && t.phase === "judge:final");
  assert.ok(jm && jm.status === "ok", "the judgment left no mark: " + JSON.stringify(r.traces.map((t) => t && t.phase)));
});

test("JUDGE 8 — the owner's second reproduction, as a hand-off: an SMS reminder quoting \"book a lesson\" is judged before it is handed on, so the page designer is never asked to build for it, and nobody is told about a text message", async () => {
  const MSG = "Add a page where students can book a lesson by choosing a day and a time";
  const KEEP = { need: "Each booking is kept so the teacher can see it", status: "covered", by: "lesson_bookings keeps each booking", item: "lesson_bookings", kind: "table", basis: "needed", words: "book a lesson" };
  const SMS = { need: "The booking form asks for a mobile number so each student gets a text reminder the day before", status: "elsewhere", step: "page", basis: "needed", words: "book a lesson" };
  const r = await addon("fw-judge-lesson", MSG, {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/book")],
    answers: {
      table: { table: [table("lesson_bookings", ["student", "day", "time"])], requirements: [KEEP, SMS] },
      page: { page: [PAGE("/book", "Book")] },
    },
    ...judging([[/kept so the teacher/, "needed", "yes", ["table:lesson_bookings"]], [/text reminder/, "unrelated", "no"]]),
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  const shown = judged(r);
  assert.equal(shown.length, 2, "expected a judgment before the hand-off and one at the end");
  assert.match(shown[0], /about to be handed to the page step/);
  assert.match(shown[0], /text reminder/);
  // THE PAGE DESIGNER WAS NEVER ASKED TO BUILD FOR IT.
  const page = promptFor(r, "page");
  assert.ok(page, "the page designer never ran");
  assert.doesNotMatch(page.text, /text reminder|mobile number/, "an unrelated requirement was handed on to be built");
  assert.doesNotMatch(page.text, /What this addition still has to do/);
  // NOR TOLD, NOR COUNTED; THE DEPENDENCY IS.
  const rec = storedAnswer(r, "fw-judge-lesson").coverage;
  assert.deepEqual(rec.setAside.map((s) => [s.need, s.follows]), [[SMS.need, "unrelated"]]);
  assert.ok(!rec.requirements.some((q) => /text reminder/.test(q.need)));
  assert.ok(!(rec.toldSteps || []).includes("page"), "the page step was recorded as handed something");
  const all = coverOf(r) + JSON.stringify(facts(r.body)) + addonReply(r.body);
  assert.doesNotMatch(all, /text|SMS|mobile/i, all);
  assert.match(coverOf(r), /I've set that up, but I can't confirm from here that Each booking is kept so the teacher can see it/);
});

test("JUDGE 9 — one message, three requirements: the storage they need and the notification they asked for are carried by the table and its own part and said as set up-and-unchecked; the confirmation email quoting their real words is unrelated and goes nowhere", async () => {
  const MSG = SIGNUP + ", and email me each time someone signs up";
  const NOTIFY = { need: "The owner is emailed about each new signup", status: "covered", by: "signups is a collect table, so each new row emails the owner", item: "signups", kind: "table", basis: "asked", words: "email me each time someone signs up" };
  const r = await signupAsk("fw-judge-three", MSG, [STORE, NOTIFY, EMAIL], judging([
    [/kept so the owner/, "needed", "yes", ["table:signups"]],
    [/owner is emailed/, "asked", "yes", ["table:signups:notify"]],
    [/confirmation email/, "unrelated", "no"],
  ]));
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  // A WHOLE ANSWER IS ONE CALL: nothing asked again, nothing recorded missing.
  assert.equal(judged(r).length, 1, "a whole answer was asked again");
  const rec = storedAnswer(r, "fw-judge-three").coverage;
  assert.equal(rec.verdictsMissing, undefined);
  // THE NOTIFICATION'S OWN CLAIM NAMES A SETTING THAT HOLDS ("a collect table"),
  // so it reads `configured` — the same customer sentence as `unverified`.
  assert.deepEqual(rec.requirements.map((q) => [q.need, q.state, q.carriedBy, q.implementation]), [
    [STORE.need, "unverified", ["table:signups"], "found"],
    [NOTIFY.need, "configured", ["table:signups:notify"], "found"],
  ]);
  assert.equal(rec.requirements[1].configuredBy, "signups: collect");
  assert.deepEqual(rec.setAside.map((s) => [s.need, s.follows]), [[EMAIL.need, "unrelated"]]);
  const f = facts(r.body);
  assert.ok(f.includes("note: Set up, but nothing here can check that it works: Each signup is kept so the owner can read them."), JSON.stringify(f));
  assert.ok(f.includes("note: Set up, but nothing here can check that it works: The owner is emailed about each new signup."), JSON.stringify(f));
  assert.ok(!f.some((x) => /confirmation email/.test(x)), "an unrelated requirement reached the reply model: " + JSON.stringify(f));
  assert.equal(r.body.suggestions, undefined, "an unrelated requirement was offered as an idea");
});

test("JUDGE 10 — a confirmation email they really asked for: carried by the table's own email part when the platform kept it; when the platform could not keep it the table's existence settles nothing and it is still to do", async () => {
  const MSG = SIGNUP + ", and send each person a confirmation email";
  const CONFIRM = { need: "Each person who signs up is emailed a confirmation", status: "covered", by: "signups.confirm emails the address they gave", item: "signups", kind: "table", basis: "asked", words: "send each person a confirmation email" };
  const verdicts = judging([[/kept so the owner/, "needed", "yes", ["table:signups"]], [/emailed a confirmation/, "asked", "yes", ["table:signups:confirm"]]]);
  const good = await signupAsk("fw-judge-confirm", MSG, [STORE, CONFIRM], verdicts, { confirm: { to: "email", subject: "You're on the list", body: "<p>Thanks, {name}</p>" } });
  assert.equal(good.body.ok, true, JSON.stringify(good.body).slice(0, 600));
  const g = storedAnswer(good, "fw-judge-confirm").coverage.requirements.find((q) => q.need === CONFIRM.need);
  assert.deepEqual([g.state, g.carriedBy], ["unverified", ["table:signups:confirm"]]);
  assert.match(coverOf(good), /I've set that up, but I can't confirm from here that Each signup is kept so the owner can read them; or that Each person who signs up is emailed a confirmation/);
  // THE SAME DESIGN WITH AN ADDRESS COLUMN THE TABLE DOES NOT HAVE: the platform
  // drops the email (`normalizeConfirm`), the table still applies, and the
  // verdict's part is checked against what was applied — not the table's name.
  const bad = await signupAsk("fw-judge-confirm-lost", MSG, [STORE, CONFIRM], verdicts, { confirm: { to: "mail_address", subject: "You're on the list", body: "<p>Thanks</p>" } });
  assert.equal(bad.body.ok, true, JSON.stringify(bad.body).slice(0, 600));
  assert.deepEqual(bad.body.tables, ["signups"], "the table did not apply — this case tests nothing");
  assert.ok(!bad.meta().tables.find((t) => t.name === "signups").confirm, "the platform kept an email it cannot send — this case tests nothing: " + JSON.stringify(bad.meta().tables.find((t) => t.name === "signups").confirm));
  const b = storedAnswer(bad, "fw-judge-confirm-lost").coverage.requirements.find((q) => q.need === CONFIRM.need);
  assert.deepEqual([b.state, b.implementation, b.why], ["missing", "found", "the signups table does not do this"]);
  assert.match(coverOf(bad), /Still to do: Each person who signs up is emailed a confirmation/);
  assert.doesNotMatch(coverOf(bad), /I've set that up[^.]*emailed a confirmation/);
  assert.ok(facts(bad.body).includes("not-done: Not done: Each person who signs up is emailed a confirmation."), JSON.stringify(facts(bad.body)));
});

test("JUDGE 11 — a notification the site already sends: carried by the existing table's own part, found where it already was; on a table that sends nothing, the judgment says so and it is still to do", async () => {
  const MSG = "Add a contact page, and make sure I get an email whenever someone sends an enquiry";
  const NEED = { need: "The owner is emailed about each new enquiry", status: "covered", by: "the enquiries table already emails the owner", item: "enquiries", kind: "table", basis: "asked", words: "I get an email whenever someone sends an enquiry" };
  const ask = (slug, access, verdict) => addon(slug, MSG, {
    kinds: ["page"], publishes: true, written: [writtenPage("/contact")],
    stored: { tables: [{ name: "enquiries", access, columns: [{ name: "name", type: "text" }, { name: "message", type: "text" }] }], functions: [], apis: [], jobs: [] },
    answers: { page: { page: [PAGE("/contact", "Contact")], requirements: [NEED] } },
    ...judging([[/owner is emailed/, ...verdict]]),
  });
  const r = await ask("fw-judge-existing", "collect", ["asked", "yes", ["table:enquiries:notify"]]);
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  assert.match(judged(r)[0], /- table:enquiries:notify — part of the table enquiries: the owner is emailed about each new row/);
  const q = storedAnswer(r, "fw-judge-existing").coverage.requirements[0];
  assert.deepEqual([q.state, q.implementedBy, q.foundIn, q.carriedBy], ["unverified", "enquiries", "existing", ["table:enquiries:notify"]]);
  // THE TABLE IS THERE AND SENDS NOTHING: no part to name, and the existence of
  // the table the designer referenced buys nothing.
  const none = await ask("fw-judge-existing-none", "user", ["asked", "no"]);
  assert.doesNotMatch(judged(none)[0], /table:enquiries:notify/, "a part the table does not have was offered");
  const n = storedAnswer(none, "fw-judge-existing-none").coverage.requirements[0];
  assert.equal(n.state, "missing", JSON.stringify(n));
  assert.match(coverOf(none), /Still to do: The owner is emailed about each new enquiry/);
});

test("JUDGE 12 — what the judgment leaves without a usable verdict is never dropped: it is asked once more, and still short the addition stops before anything is applied or charged — an entry skipped twice, a \"yes\" naming only what it was never shown, and nothing at all before a hand-off", async () => {
  // RE-ANCHORED 2026-10-06. This case asserted the defect the owner then
  // reproduced: an entry the judgment skipped was "unjudged and silent" and
  // the addition went on. Now it is named back to the model once, and a
  // second answer that still skips it stops the addition (`aDown`).
  const stopped = (r) => {
    assert.deepEqual([r.status, r.body.ok, r.body.error, r.body.cost, r.body.incomplete], [503, false, "send", 0, true], JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.body.clarify, undefined, "an unfinished internal answer was turned into a question for the customer");
    assert.equal(r.body.msg, "I couldn't finish checking that addition against what you asked, so I stopped before changing anything — this is on us, and nothing was charged.");
    assert.ok(!r.sql.some((q) => /CREATE TABLE/i.test(q)), "a table was applied on a judgment that did not finish");
    assert.equal(r.compiles.length, 0, "a page was compiled on a judgment that did not finish");
    assert.deepEqual(r.charges, [], "something was charged on a judgment that did not finish");
  };
  const skipped = await signupAsk("fw-judge-skip", SIGNUP, [STORE, EMAIL], judging([[/kept so the owner/, "needed", "yes", ["table:signups"]]]));
  stopped(skipped);
  assert.equal(judged(skipped).length, 2, "the judgment was not asked exactly once more");
  assert.match(judged(skipped)[1], /YOUR LAST ANSWER LEFT THESE WITHOUT A VERDICT ANYBODY CAN USE: table#1 \(no verdict\)\./);
  // THE RECORD IS WRITTEN, with nothing applied from the half that came back.
  const rec = storedAnswer(skipped, "fw-judge-skip").coverage;
  assert.deepEqual(rec.requirements.map((q) => [q.need, !!q.unjudged]), [[STORE.need, true], [EMAIL.need, true]]);
  assert.deepEqual(rec.verdictsMissing.map((x) => [x.at, x.id, x.why, x.finished]), [["final", "table#1", "no-verdict", false]]);
  const unlisted = await signupAsk("fw-judge-unlisted", SIGNUP, [STORE, EMAIL], judging([
    [/kept so the owner/, "needed", "yes", ["table:signups"]],
    [/confirmation email/, "needed", "yes", ["function:send_confirmation"]],
  ]));
  stopped(unlisted);
  assert.match(judged(unlisted)[1], /: table#1 \("yes" naming nothing that is listed\)\./);
  const u = storedAnswer(unlisted, "fw-judge-unlisted").coverage;
  assert.deepEqual(u.verdictsInvalid.filter((x) => x.why === "unlisted-item").map((x) => [x.item, x.attempt || 1]), [["function:send_confirmation", 1], ["function:send_confirmation", 2]]);
  assert.deepEqual(u.verdictsMissing.map((x) => [x.at, x.id, x.why, x.finished]), [["final", "table#1", "yes-without-items", false]]);
  // BEFORE A HAND-OFF: nothing at all, twice — the next designer never runs.
  const SKIP = { need: "The booking form also asks for a mobile number", status: "elsewhere", step: "page", basis: "needed", words: "book a lesson" };
  const early = await addon("fw-judge-skip-early", "Add a page where students can book a lesson", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/book")],
    answers: { table: { table: [table("lesson_bookings", ["student"])], requirements: [SKIP] }, page: { page: [PAGE("/book", "Book")] } },
    judge: () => ({ verdicts: [] }),
  });
  stopped(early);
  assert.equal(judged(early).length, 2);
  for (const t of judged(early)) assert.match(t, /about to be handed to the page step/);
  assert.equal(promptFor(early, "page"), undefined, "the page designer ran on a judgment that did not finish");
});

test("JUDGE 13 — a judgment that fails stops the addition before anything is applied, as a designer's failed call does; one that asks is the addition's question, at no cost", async () => {
  const down = await signupAsk("fw-judge-down", SIGNUP, [STORE, EMAIL], { judge: "fail" });
  assert.equal(down.status, 503, JSON.stringify(down.body));
  assert.deepEqual([down.body.ok, down.body.error, down.body.cost], [false, "send", 0]);
  // A CALL THAT DID NOT GO THROUGH keeps the existing sentence; an answer that
  // came back cut off is unfinished, and asks them for nothing (2026-10-06).
  assert.deepEqual([down.body.msg, down.body.incomplete], ["The builder is busy — try again in a moment.", undefined]);
  const cut = await signupAsk("fw-judge-cut", SIGNUP, [STORE, EMAIL], { judge: "cut" });
  assert.deepEqual([cut.status, cut.body.error, cut.body.cost, cut.body.incomplete, cut.charges.length], [503, "send", 0, true, 0]);
  assert.equal(cut.body.msg, "I couldn't finish checking that addition against what you asked, so I stopped before changing anything — this is on us, and nothing was charged.");
  assert.equal(judged(cut).length, 1, "a cut-off answer was asked again");
  assert.ok(!cut.sql.some((q) => /CREATE TABLE/i.test(JSON.stringify(q))), "a table was applied after the judgment was cut off");
  assert.ok(!down.sql.some((q) => /CREATE TABLE/i.test(JSON.stringify(q))), "a table was applied after the judgment failed");
  assert.equal(down.compiles.length, 0, "a page was compiled after the judgment failed");
  // THE RECORD IS STILL WRITTEN, with nothing judged and nothing told.
  const rec = storedAnswer(down, "fw-judge-down").coverage;
  assert.ok(rec.requirements.every((q) => q.unjudged === true), JSON.stringify(rec.requirements));
  // BEFORE A HAND-OFF TOO.
  const early = await addon("fw-judge-down-early", "Add a page where students can book a lesson", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/book")], judge: "fail",
    answers: { table: { table: [table("lesson_bookings", ["student"])], requirements: [{ need: "A booking form", status: "elsewhere", step: "page", basis: "asked", words: "book a lesson" }] }, page: { page: [PAGE("/book", "Book")] } },
  });
  assert.deepEqual([early.status, early.body.error, early.body.cost], [503, "send", 0]);
  assert.equal(promptFor(early, "page"), undefined, "the page designer ran after the judgment failed");
  // A QUESTION: nothing applied or charged, the question kept for them to answer.
  const QUESTION = { text: "Should students pay for a lesson when they book it, or pay you at the lesson?", options: ["Pay when they book", "Pay at the lesson"] };
  const ask = await signupAsk("fw-judge-ask", SIGNUP, [STORE, EMAIL], { judge: () => ({ verdicts: [], question: QUESTION }) });
  assert.equal(ask.body.error, "clarify", JSON.stringify(ask.body).slice(0, 400));
  assert.deepEqual([ask.body.cost, ask.body.unchanged], [0, true]);
  assert.equal(ask.body.clarify.text, QUESTION.text);
  assert.deepEqual(ask.body.clarify.options, QUESTION.options);
  assert.ok(!ask.sql.some((q) => /CREATE TABLE/i.test(JSON.stringify(q))), "a table was applied before the question was answered");
});

test("JUDGE 15 — an optional idea that something already made does is not offered as one: \"nothing was made for it\" would be the false half", async () => {
  const OWNER = { need: "The owner hears about each new signup", status: "covered", by: "signups is a collect table", item: "signups", kind: "table", basis: "needed", words: "leave their name and email address" };
  const r = await signupAsk("fw-judge-optional-done", SIGNUP, [STORE, OWNER], judging([
    [/kept so the owner/, "needed", "yes", ["table:signups"]],
    [/owner hears/, "optional", "yes", ["table:signups:notify"]],
  ]));
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.equal(r.body.suggestions, undefined, "an idea something already does was offered as not made");
  assert.ok(!facts(r.body).some((x) => /owner hears/.test(x)), JSON.stringify(facts(r.body)));
  const rec = storedAnswer(r, "fw-judge-optional-done").coverage;
  assert.deepEqual(rec.setAside.map((s) => [s.need, s.follows, s.carriedBy]), [[OWNER.need, "optional", ["table:signups:notify"]]]);
  // THE CONTROL: the same idea, judged with nothing doing it, IS offered.
  const off = await signupAsk("fw-judge-optional-offer", SIGNUP, [STORE, OWNER], judging([
    [/kept so the owner/, "needed", "yes", ["table:signups"]],
    [/owner hears/, "optional", "no"],
  ]));
  assert.deepEqual(off.body.suggestions, [OWNER.need]);
});

test("JUDGE 16 — a designer's refusal still reports only what follows from their words: the requirements are judged before the refusal's sentence is written", async () => {
  const MSG = "Add a spinning 3D model of our shop to the home page, and let people pay by bank transfer";
  const PAY = { need: "People can pay by bank transfer", status: "unsupported", why: "this step cannot take payments", basis: "asked", words: "let people pay by bank transfer" };
  const SPIN = { need: "The model spins slowly so people notice it", status: "covered", by: "the scene", item: "three", kind: "three", basis: "needed", words: "a spinning 3D model of our shop" };
  const r = await addon("fw-judge-refused", MSG, {
    kinds: ["three"],
    answers: { three: { three: { page: "/" }, requirements: [PAY, SPIN] } },
    ...judging([[/bank transfer/, "asked", "unsure"], [/spins slowly/, "unrelated", "no"]]),
  });
  assert.equal(r.body.error, "add", "the designer's answer was not refused — this case tests nothing: " + JSON.stringify(r.body).slice(0, 300));
  assert.equal(judged(r).length, 1, "the refusal did not judge the requirements first");
  assert.match(coverOf(r), /One thing your site can't do yet: People can pay by bank transfer/, coverOf(r));
  assert.doesNotMatch(coverOf(r), /spins slowly/, coverOf(r));
  // A JUDGMENT BESIDE A REFUSAL THAT DOES NOT FINISH (2026-10-06): asked once
  // more like any other; still short, the refusal stays the answer — nothing
  // was applied or charged, and it says the addition did not happen — and
  // what nobody judged is not told. On the owner's word that evening this is
  // the rule, not a limit: *"an incomplete judgment must never become a claim
  // that work succeeded."* A judgment that finishes beside a refusal is told
  // to the reply model and on the screen (`test/addon-refusal-warnings.test.mjs`).
  const short = await addon("fw-judge-refused-short", MSG, {
    kinds: ["three"],
    answers: { three: { three: { page: "/" }, requirements: [PAY, SPIN] } },
    judge: () => ({ verdicts: [] }),
  });
  assert.deepEqual([short.status, short.body.error, short.body.cost, short.charges.length], [422, "add", 0, 0]);
  assert.equal(short.body.msg, r.body.msg);
  assert.equal(judged(short).length, 2, "the judgment beside a refusal was not asked again");
  assert.equal(coverOf(short), "");
});

test("JUDGE 17 — the judgment is billed with the designers' calls it rides beside", async () => {
  const verdicts = judging([[/kept so the owner/, "needed", "yes", ["table:signups"]], [/confirmation email/, "optional", "no"]]);
  const small = await signupAsk("fw-judge-bill-small", SIGNUP, [STORE, EMAIL], verdicts);
  const big = await signupAsk("fw-judge-bill-big", SIGNUP, [STORE, EMAIL], { ...verdicts, judgeUsage: { input_tokens: 4000000, output_tokens: 10 } });
  assert.equal(small.body.ok, true);
  assert.equal(big.body.ok, true);
  assert.ok(Number(big.body.cost) > Number(small.body.cost), "the judgment's tokens were not billed: " + small.body.cost + " vs " + big.body.cost);
});

// ─────────────────────────────────────────────────────────────────────────────
// A JUDGMENT THAT DOES NOT FINISH (owner, 2026-10-06)
//
// *"I reproduced an explicit request, "Add a signup form and send a
// confirmation email to each person who signs up," with a grounded email
// requirement: runJudge accepts {verdicts:[]} as failed:false … The worker
// continues because it checks failed/ask, so a genuinely requested part can
// disappear from handoffs and customer reporting."* Through the route, on that
// message: the email asked for, and the email field handed to the page step.
// ─────────────────────────────────────────────────────────────────────────────

const OWNER_MSG = "Add a signup form and send a confirmation email to each person who signs up";
const SEND = { need: "Each person who signs up is emailed a confirmation", status: "covered", by: "signups.confirm emails the address they gave", item: "signups", kind: "table", basis: "asked", words: "send a confirmation email to each person who signs up" };
const FIELD = { need: "The signup form asks for their email address so the confirmation can be sent", status: "elsewhere", step: "page", item: "/signup", basis: "asked", words: "send a confirmation email to each person who signs up" };
const ownerAsk = (slug, opts) => addon(slug, OWNER_MSG, {
  kinds: ["table", "page"], publishes: true, written: [writtenPage("/signup")],
  answers: {
    table: { table: [table("signups", ["name", "email"], { confirm: { to: "email", subject: "You're signed up", body: "<p>Thanks, {name}</p>" } })], requirements: [SEND, FIELD] },
    page: { page: [PAGE("/signup", "Sign up")] },
  },
  ...opts,
});
/** What a model that finished would answer, per requirement; meaning only before a hand-off. */
const WHOLE = [[/emailed a confirmation/, "asked", "yes", ["table:signups:confirm"]], [/asks for their email address/, "asked", "yes", ["page:/signup"]]];
const verdictOf = (e, step) => {
  const [, follows, carried, by] = WHOLE.find(([re]) => re.test(e.need));
  return step ? { id: e.id, follows, carried: "unsure", reason: "r" } : { id: e.id, follows, carried, by, reason: "r" };
};
const all = (entries, step) => entries.map((e) => verdictOf(e, step));
const nothing = () => [];
const but = (re, wrong = null) => (entries, step) => entries.flatMap((e) => (re.test(e.need) ? (wrong ? [wrong(verdictOf(e, step))] : []) : [verdictOf(e, step)]));
/** The model's answer to each call: the first, and the second naming what the first left out. */
const answering = (first, second = first) => ({ judge: ({ entries, step, again }) => ({ verdicts: (again ? second : first)(entries, step) }) });
const SET_UP = "I've set that up, but I can't confirm from here that Each person who signs up is emailed a confirmation; or that The signup form asks for their email address so the confirmation can be sent — have a look and tell me if it isn't right.";
const BIG = { input_tokens: 4000000, output_tokens: 10 };
const madeAll = (r) => {
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.ok(r.sql.some((q) => /CREATE TABLE/i.test(q)), "the table was not applied — this case tests nothing");
  // NO SILENT OMISSION: the email they asked for, and the field it needs, in
  // the cover note and in the facts the reply model is given.
  assert.equal(coverOf(r), SET_UP);
  const told = facts(r.body);
  for (const need of [SEND.need, FIELD.need]) assert.ok(told.includes("note: Set up, but nothing here can check that it works: " + need + "."), JSON.stringify(told));
  assert.ok(!told.includes("not-done: " + SET_UP), "the cover note was given to the reply model beside the requirements");
  // …AND IN THE HAND-OFF: the page designer was told about the field.
  assert.match(promptFor(r, "page").text, /asks for their email address so the confirmation can be sent/, "the field was not handed to the page step");
  // ONE CHARGE.
  assert.equal(r.charges.length, 1, "charged " + r.charges.length + " times");
};

test("JUDGE 18 — the owner's message with a whole answer: one judgment before the hand-off and one at the end, nothing asked again; the email they asked for and the field it needs reported and handed on; one charge (the control)", async () => {
  const r = await ownerAsk("fw-whole", { ...answering(all), judgeUsage: BIG });
  madeAll(r);
  assert.equal(judged(r).length, 2);
  for (const t of judged(r)) assert.doesNotMatch(t, /YOUR LAST ANSWER/);
});

test("JUDGE 19 — an empty answer, before the hand-off and at the end, asked once more each time and finished: nothing lost from the hand-off or the report, and charged exactly what a whole first answer costs", async () => {
  const control = await ownerAsk("fw-empty-control", { ...answering(all), judgeUsage: BIG });
  const r = await ownerAsk("fw-empty-recovered", { ...answering(nothing, all), judgeUsage: BIG });
  madeAll(r);
  const shown = judged(r);
  assert.equal(shown.length, 4, "each judgment was not asked exactly once more");
  assert.match(shown[1], /about to be handed to the page step[\s\S]*YOUR LAST ANSWER LEFT THESE WITHOUT A VERDICT ANYBODY CAN USE: table#1 \(no verdict\)/);
  assert.match(shown[3], /YOUR LAST ANSWER LEFT THESE WITHOUT A VERDICT ANYBODY CAN USE: table#0 \(no verdict\), table#1 \(no verdict\)/);
  // NO DUPLICATE CHARGE: the second call of each judgment is ours.
  assert.deepEqual(r.charges, control.charges, "the asked-again judgments were billed");
  // THE SECOND CALLS ARE COUNTED, as ours: on the timeline, apart from the bill.
  for (const at of ["page", "final"]) {
    const mark = r.traces.find((t) => t && t.phase === "judge:" + at);
    assert.deepEqual(mark && [mark.status, mark.detail.attempts, mark.detail.missing], ["ok", 2, 0], "the mark does not say the judgment was asked again: " + JSON.stringify(mark));
    const again = r.traces.find((t) => t && t.phase === "judge:" + at + ":again");
    assert.deepEqual(again && again.detail, { in: BIG.input_tokens, out: BIG.output_tokens }, "the second call's tokens are not on the timeline: " + JSON.stringify(again));
  }
  assert.ok(!control.traces.some((t) => t && /:again$/.test(t.phase)), "a whole first answer was marked as asked again");
  assert.deepEqual(storedAnswer(r, "fw-empty-recovered").coverage.verdictsMissing.map((x) => [x.at, x.id, x.why, x.finished]),
    [["page", "table#1", "no-verdict", true], ["final", "table#0", "no-verdict", true], ["final", "table#1", "no-verdict", true]]);
  assert.equal(storedAnswer(control, "fw-empty-control").coverage.verdictsMissing, undefined);
});

test("JUDGE 20 — an empty answer at the end, twice: the addition stops before anything is applied or charged, the customer is not asked to say again what they asked, and the record keeps what was asked", async () => {
  const r = await ownerAsk("fw-empty-stops", { judge: ({ entries, step }) => ({ verdicts: step ? all(entries, step) : [] }) });
  assert.deepEqual([r.status, r.body.ok, r.body.error, r.body.cost, r.body.incomplete], [503, false, "send", 0, true], JSON.stringify(r.body).slice(0, 300));
  assert.equal(judged(r).length, 3, "one before the hand-off, two at the end, and no more");
  assert.ok(!r.sql.some((q) => /CREATE TABLE/i.test(q)), "the table was applied");
  assert.equal(r.compiles.length, 0, "a page was compiled");
  assert.deepEqual(r.charges, [], "something was charged");
  // THE FAILURE PATH, WORDED AS WHAT HAPPENED AND WHOSE IT IS — not a question,
  // and nothing for them to repeat.
  assert.equal(r.body.clarify, undefined);
  assert.equal(r.body.msg, "I couldn't finish checking that addition against what you asked, so I stopped before changing anything — this is on us, and nothing was charged.");
  assert.doesNotMatch(r.body.msg, /\b(again|repeat|rephrase|clarify|resend)\b|send it/i);
  // THE RECORD SAYS WHAT HAPPENED: the email has no verdict at all; the
  // field's meaning was judged before the hand-off and what carries it out
  // never was; and the judgment at the end left both, asked twice.
  const rec = storedAnswer(r, "fw-empty-stops").coverage;
  assert.deepEqual(rec.requirements.map((q) => [q.need, !!q.unjudged, q.state]), [[SEND.need, true, "unknown"], [FIELD.need, false, "unknown"]]);
  assert.deepEqual(rec.requirements[1].judged, { follows: "asked", carried: "unsure", by: [], reason: "r" });
  assert.deepEqual(rec.verdictsMissing.map((x) => [x.at, x.id, x.need, x.why, x.finished]), [["final", "table#0", SEND.need, "no-verdict", false], ["final", "table#1", FIELD.need, "no-verdict", false]]);
});

test("JUDGE 21 — a partial answer that leaves out the email they asked for: asked again for exactly that one, finished, and reported; left out twice, the addition stops", async () => {
  const r = await ownerAsk("fw-partial-recovered", answering(but(/emailed a confirmation/), all));
  madeAll(r);
  const shown = judged(r);
  assert.equal(shown.length, 3);
  assert.match(shown[2], /YOUR LAST ANSWER LEFT THESE WITHOUT A VERDICT ANYBODY CAN USE: table#0 \(no verdict\)\./, "the second call did not name exactly the one left out");
  const rec = storedAnswer(r, "fw-partial-recovered").coverage;
  assert.deepEqual(rec.requirements.find((q) => q.need === SEND.need).carriedBy, ["table:signups:confirm"]);
  assert.deepEqual(rec.verdictsMissing.map((x) => [x.at, x.id, x.why, x.finished]), [["final", "table#0", "no-verdict", true]]);
  const twice = await ownerAsk("fw-partial-stops", answering(but(/emailed a confirmation/)));
  assert.deepEqual([twice.status, twice.body.incomplete, twice.body.cost, twice.charges.length], [503, true, 0, 0]);
  assert.ok(!twice.sql.some((q) => /CREATE TABLE/i.test(q)));
});

test("JUDGE 22 — an invalid verdict for the email they asked for — a `follows` or `carried` from no list, a \"yes\" naming only what it was never shown, a verdict under an id it was never given — is asked again, naming why, and finished; never read as \"unsure\"", async () => {
  const wrongs = [
    [(v) => ({ ...v, follows: "implied" }), "no `follows` from the four allowed", "no-follows"],
    [(v) => ({ ...v, carried: "maybe" }), "no `carried` from the three allowed", "no-carried"],
    [(v) => ({ ...v, by: ["function:send_confirmation"] }), "\"yes\" naming nothing that is listed", "yes-without-items"],
    [(v) => ({ ...v, id: "table#9" }), "no verdict", "no-verdict"],
  ];
  for (const [wrong, why, code] of wrongs) {
    const r = await ownerAsk("fw-invalid-" + code, answering(but(/emailed a confirmation/, wrong), all));
    madeAll(r);
    const shown = judged(r);
    assert.equal(shown.length, 3, why);
    assert.ok(shown[2].includes("WITHOUT A VERDICT ANYBODY CAN USE: table#0 (" + why + ")."), "the second call did not say why: " + shown[2].slice(-240));
    assert.deepEqual(storedAnswer(r, "fw-invalid-" + code).coverage.verdictsMissing.map((x) => [x.id, x.why, x.finished]), [["table#0", code, true]]);
  }
  // INVALID TWICE: stops, as missing does.
  const twice = await ownerAsk("fw-invalid-stops", answering(but(/emailed a confirmation/, (v) => ({ ...v, carried: "maybe" }))));
  assert.deepEqual([twice.status, twice.body.incomplete, twice.body.cost, twice.charges.length], [503, true, 0, 0]);
});

test("JUDGE 23 — \"unsure\" is a whole verdict, not a missing one: nothing is asked again, and the email they asked for is still reported, as something nobody here can see", async () => {
  const r = await ownerAsk("fw-unsure", answering(but(/emailed a confirmation/, (v) => ({ ...v, carried: "unsure", by: [] }))));
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.equal(judged(r).length, 2, "an unsure verdict was asked again");
  assert.match(coverOf(r), /I can't see from here whether Each person who signs up is emailed a confirmation/);
  assert.doesNotMatch(coverOf(r), /I've set that up[^.]*emailed a confirmation/);
  assert.equal(r.charges.length, 1);
});

test("JUDGE 14 — every report of requirements on the route is made with judging in force", () => {
  // COMMENT LINES BLANKED FIRST (the repository's own scan rule): prose about a
  // call is not the call, and a parenthesis inside a comment would end it early.
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8").split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  // `requirementReport` SINCE 2026-10-06: the note and the reply's facts are
  // both written from it. `requirementNote` stays in the pattern, so a call
  // that comes back is held to the same rule.
  const calls = [...src.matchAll(/\b(requirementNote|requirementReport|requirementRecord|requirementOutcomes)\(/g)];
  // THE OBSERVER IS ALIVE: the three readers really are called on the route.
  assert.deepEqual([...new Set(calls.map((m) => m[1]))].sort(), ["requirementOutcomes", "requirementRecord", "requirementReport"]);
  for (const m of calls) {
    // THE CALL'S OWN ARGUMENTS: from its opening parenthesis to the one that closes it.
    let depth = 0, end = -1;
    for (let i = m.index + m[1].length; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) { end = i; break; }
    }
    assert.ok(end > 0, "no end to the call at " + m.index);
    assert.match(src.slice(m.index, end), /\bjudged: true\b/, m[1] + " is called on the route without judging in force");
  }
});
