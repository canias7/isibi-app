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

test("JUDGE 3 — the judgment's answer is cleaned by code: only ids it was shown, only things it was shown, every verdict from its own constants; a 'yes' that names nothing checkable is 'unsure'; nothing is repaired", () => {
  const ids = ["table#0", "table#1", "page#0", "page#1", "page#2"];
  const items = ["table:signups", "table:signups:notify", "page:/sign-up"];
  const { verdicts, invalid } = readVerdicts({ verdicts: [
    { id: "table#0", follows: "needed", carried: "yes", by: ["table:signups", "TABLE:SIGNUPS", " table:signups:notify "], reason: "  kept\n so the owner can read them " },
    { id: "table#1", follows: "optional", carried: "no", reason: "works without it" },
    { id: "page#0", follows: "asked", carried: "yes", by: ["function:send_confirmation"], reason: "x" },
    { id: "page#1", follows: "implied", carried: "yes", by: ["page:/sign-up"], reason: "x" },
    { id: "page#2", follows: "asked", carried: ["yes"], reason: "x" },
    { id: "table#0", follows: "unrelated", carried: "no", reason: "a second verdict" },
    { id: "made-up#7", follows: "asked", carried: "no", reason: "x" },
    "not an object",
  ] }, { ids, items });
  assert.deepEqual([...verdicts.keys()], ["table#0", "table#1", "page#0"]);
  assert.deepEqual(verdicts.get("table#0"), { follows: "needed", carried: "yes", by: ["table:signups", "table:signups:notify"], reason: "kept so the owner can read them" });
  assert.deepEqual(verdicts.get("page#0"), { follows: "asked", carried: "unsure", by: [], reason: "x" }, "a yes naming only what it was never shown kept its yes");
  assert.deepEqual(invalid.map((x) => x.why), ["unlisted-item", "yes-without-items", "no-follows", "no-carried", "repeated", "unknown-id", "unreadable"]);
  assert.deepEqual(readVerdicts(null, { ids }).invalid, [{ why: "no-verdicts" }]);
  assert.deepEqual(readVerdicts({ verdicts: "all fine" }, { ids }).invalid, [{ why: "no-verdicts" }]);
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

test("JUDGE 6 — the judgment's runner: a throw, a truncated answer and an answer with no verdicts are failures; a question is a question; skipped entries are simply unjudged", async () => {
  const entries = [{ id: "table#0", need: "a", status: "covered" }, { id: "table#1", need: "b", status: "covered" }];
  const reply = (input, extra = {}) => ({ content: [{ type: "tool_use", name: "judge_requirements", input }], usage: { input_tokens: 9, output_tokens: 3 }, ...extra });
  assert.equal((await runJudge({ send: async () => { throw new Error("down"); } }, { entries })).failed, true);
  const cut = await runJudge({ send: async () => reply({ verdicts: [] }, { stop_reason: "max_tokens" }) }, { entries });
  assert.deepEqual([cut.failed, cut.error.truncated, cut.usage.out], [true, true, 3]);
  assert.equal((await runJudge({ send: async () => ({ content: [{ type: "text", text: "fine" }] }) }, { entries })).failed, true);
  const asked = await runJudge({ send: async () => reply({ verdicts: [], question: { text: "Pay online, or at the lesson?" } }) }, { entries });
  assert.deepEqual([asked.failed, asked.ask.text, asked.verdicts.size], [false, "Pay online, or at the lesson?", 0]);
  const part = await runJudge({ send: async () => reply({ verdicts: [{ id: "table#0", follows: "asked", carried: "no", reason: "r" }] }) }, { entries });
  assert.deepEqual([part.failed, [...part.verdicts.keys()]], [false, ["table#0"]]);
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
  assert.ok(f.includes("not-done: I've set that up, but I can't confirm from here that Each signup is kept so the owner can read them — have a look and tell me if it isn't right."), JSON.stringify(f));
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
  const rec = storedAnswer(r, "fw-judge-three").coverage;
  // THE NOTIFICATION'S OWN CLAIM NAMES A SETTING THAT HOLDS ("a collect table"),
  // so it reads `configured` — the same customer sentence as `unverified`.
  assert.deepEqual(rec.requirements.map((q) => [q.need, q.state, q.carriedBy, q.implementation]), [
    [STORE.need, "unverified", ["table:signups"], "found"],
    [NOTIFY.need, "configured", ["table:signups:notify"], "found"],
  ]);
  assert.equal(rec.requirements[1].configuredBy, "signups: collect");
  assert.deepEqual(rec.setAside.map((s) => [s.need, s.follows]), [[EMAIL.need, "unrelated"]]);
  const f = facts(r.body);
  assert.ok(f.includes("not-done: I've set that up, but I can't confirm from here that Each signup is kept so the owner can read them; or that The owner is emailed about each new signup — have a look and tell me if it isn't right."), JSON.stringify(f));
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
  assert.ok(facts(bad.body).some((x) => /^not-done: .*Still to do: Each person who signs up is emailed a confirmation/.test(x)), JSON.stringify(facts(bad.body)));
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

test("JUDGE 12 — what the judgment cannot settle is never told as done: an entry it skipped is unjudged and silent, and a thing it names that it was never shown is recorded as invalid and buys nothing", async () => {
  const skipped = await signupAsk("fw-judge-skip", SIGNUP, [STORE, EMAIL], judging([[/kept so the owner/, "needed", "yes", ["table:signups"]]]));
  assert.equal(skipped.body.ok, true);
  const rec = storedAnswer(skipped, "fw-judge-skip").coverage;
  assert.deepEqual(rec.requirements.map((q) => [q.need, q.state, !!q.unjudged]), [[STORE.need, "unverified", false], [EMAIL.need, "unknown", true]]);
  assert.equal(rec.counts.unjudged, 1);
  assert.doesNotMatch(coverOf(skipped), /confirmation email/, coverOf(skipped));
  const unlisted = await signupAsk("fw-judge-unlisted", SIGNUP, [STORE, EMAIL], judging([
    [/kept so the owner/, "needed", "yes", ["table:signups"]],
    [/confirmation email/, "needed", "yes", ["function:send_confirmation"]],
  ]));
  const u = storedAnswer(unlisted, "fw-judge-unlisted").coverage;
  assert.deepEqual(u.verdictsInvalid.filter((x) => x.why === "unlisted-item").map((x) => x.item), ["function:send_confirmation"]);
  const e = u.requirements.find((q) => q.need === EMAIL.need);
  assert.deepEqual([e.state, e.capped, e.carried], ["unknown", true, "unsure"]);
  assert.doesNotMatch(coverOf(unlisted), /I've set that up[^.]*confirmation email/, coverOf(unlisted));
  // AN ENTRY THE JUDGMENT SKIPPED BEFORE A HAND-OFF IS NOT HANDED ON: that it
  // follows from their words is what nobody established.
  const SKIP = { need: "The booking form also asks for a mobile number", status: "elsewhere", step: "page", basis: "needed", words: "book a lesson" };
  const early = await addon("fw-judge-skip-early", "Add a page where students can book a lesson", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/book")],
    answers: { table: { table: [table("lesson_bookings", ["student"])], requirements: [SKIP] }, page: { page: [PAGE("/book", "Book")] } },
    judge: () => ({ verdicts: [] }),
  });
  assert.equal(early.body.ok, true, JSON.stringify(early.body).slice(0, 400));
  assert.match(judged(early)[0], /about to be handed to the page step/, "no judgment ran before the hand-off — this sub-case tests nothing");
  assert.doesNotMatch(promptFor(early, "page").text, /mobile number|What this addition still has to do/, "an unjudged requirement was handed on to be built");
});

test("JUDGE 13 — a judgment that fails stops the addition before anything is applied, as a designer's failed call does; one that asks is the addition's question, at no cost", async () => {
  const down = await signupAsk("fw-judge-down", SIGNUP, [STORE, EMAIL], { judge: "fail" });
  assert.equal(down.status, 503, JSON.stringify(down.body));
  assert.deepEqual([down.body.ok, down.body.error, down.body.cost], [false, "send", 0]);
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
});

test("JUDGE 17 — the judgment is billed with the designers' calls it rides beside", async () => {
  const verdicts = judging([[/kept so the owner/, "needed", "yes", ["table:signups"]], [/confirmation email/, "optional", "no"]]);
  const small = await signupAsk("fw-judge-bill-small", SIGNUP, [STORE, EMAIL], verdicts);
  const big = await signupAsk("fw-judge-bill-big", SIGNUP, [STORE, EMAIL], { ...verdicts, judgeUsage: { input_tokens: 4000000, output_tokens: 10 } });
  assert.equal(small.body.ok, true);
  assert.equal(big.body.ok, true);
  assert.ok(Number(big.body.cost) > Number(small.body.cost), "the judgment's tokens were not billed: " + small.body.cost + " vs " + big.body.cost);
});

test("JUDGE 14 — every report of requirements on the route is made with judging in force", () => {
  // COMMENT LINES BLANKED FIRST (the repository's own scan rule): prose about a
  // call is not the call, and a parenthesis inside a comment would end it early.
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8").split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const calls = [...src.matchAll(/\b(requirementNote|requirementRecord|requirementOutcomes)\(/g)];
  // THE OBSERVER IS ALIVE: the three readers really are called on the route.
  assert.deepEqual([...new Set(calls.map((m) => m[1]))].sort(), ["requirementNote", "requirementOutcomes", "requirementRecord"]);
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
