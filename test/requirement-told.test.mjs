// ─────────────────────────────────────────────────────────────────────────────
// WHAT A CUSTOMER IS TOLD ABOUT EACH REQUIREMENT: EVERY ONE (2026-10-06)
//
// Codex reproduced four requirements a customer asked for, each left undone:
// `requirementNote` named the first three, and `addonReplyFacts` handed the
// reply model only that note, so the fourth reached nothing — though the
// answer's own `requirements` held it. Every sentence of the note cut its list
// at two or three; one hid the rest behind "And N more like it."
//
// The owner: *"every distinct requested outcome must reach the reply model and
// its existing completeness checks, with accurate states and legitimate
// deduplication preserved. Prefer complete structured outcome facts and let the
// model write the customer's response naturally; don't solve this with more
// hardcoded customer messages, site-specific rules, a larger arbitrary cutoff,
// or 'and more' hiding which work remains."*
//
// Now `requirementReport` returns every requirement the customer hears about,
// the route sends it (`requirementsTold`), each is its own fact (its kind the
// state's), and the note the browser prints is written from the same list,
// whole. These cases run above every old cut, with the outcomes mixed, through
// the module, the reply writer's own completeness check, the real add-on route,
// the browser's composer, and a request whose reply is written in the
// background from its stored answer.
// ─────────────────────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import {
  requirementReport, requirementNote, toldNote, propertyNote, requirementOutcomes, cleanRequirements, TOLD, SITE_KINDS,
} from "../builder/site-requirements.mjs";
import { appliedFacts, existingFacts } from "../builder/site-add.mjs";
import { addonReplyFacts, replyOutcomeOf, writeReply, REPLY_TOOL } from "../builder/site-reply.mjs";
import { addon as routeAddon, writtenPage, storedAnswer, SITE_CONN } from "./fixtures/addon-route.mjs";
import { invalidateSiteSchema } from "../site-schema.mjs";
import { connForDatabase } from "../site-db.mjs";
import { browserReply } from "../scripts/addon-sweep.mjs";
import { platform, sendMessage, settle, pump, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";

const REPORTABLE = [...SITE_KINDS, "component", "edit"];
const facts = (body) => (addonReplyFacts(body).facts || []).map((f) => f.kind + ": " + f.text);
const browserText = (body) => { const b = browserReply(body, true); assert.ok(b.ok, "the browser's composer could not run: " + b.why); return b.text; };

// ── THE NEEDS, SEVERAL OF EVERY KIND OF OUTCOME, EACH ABOVE ITS OLD CUT ──────
//
// The old cuts: the site cannot do it yet, 3 then "And N more like it."; still
// to do, 3; waiting on a part that failed, 2; set up and unchecked, 2;
// scheduled, 2; nobody could see, 2.
const UNSUPPORTED = ["People can pay by bank transfer", "People can pay in instalments", "Each booking is copied to a Google calendar", "Members are posted a printed card"];
const MISSING = ["Each signup gets a confirmation email", "The owner gets a text for each signup", "Signups are sent to the mailing list"];
const FAILED = ["The number of signups is counted every hour"];
const BLOCKED = ["The count shows on the dashboard page", "The count is emailed to the owner each morning", "The count starts again each month"];
const SET_UP = ["Each signup is kept so the owner can read them", "Only the owner can read the signups"];
const CONFIGURED = ["Each signup is kept as a collected entry"];
const SCHEDULED = ["The reminder runs every morning", "The reminder is sent to everyone who booked", "The reminder goes out at nine"];
const UNSEEN = ["Each signup gets a welcome message", "Each signup is tagged with where it came from", "Signups older than a year are archived"];
// ADDED 2026-10-06: carried by what the site already had, above the set-up
// sentence's old cut of two — never "set up" by this change.
const ALREADY = ["Each enquiry is emailed to the owner", "Each enquiry is kept for a year", "Enquiries are visible only to the owner"];

// ── ENTRIES THAT REACH EACH STATE THROUGH `requirementOutcomes`, judged ──────
const J = (carried, by = []) => ({ follows: "asked", carried, by, reason: "r" });
let seq = 0;
const E = (o) => ({ basis: "asked", words: "w", id: (o.from || o.step || "table") + "#" + seq++, ...o });
const unsupported = (need) => E({ need, status: "unsupported", why: "this kind of change cannot do that yet", from: "table", judged: J("no") });
const missing = (need) => E({ need, status: "covered", from: "table", item: "signups", kind: "table", judged: J("no") });
const failedStep = (need) => E({ need, status: "covered", from: "function", item: "count_signups", kind: "function", judged: J("no") });
const blocked = (need) => E({ need, status: "elsewhere", step: "function", from: "page", judged: J("no") });
const setUp = (need) => E({ need, status: "covered", from: "table", item: "signups", kind: "table", by: "signups keeps each one", judged: J("yes", ["table:signups"]) });
const configured = (need) => E({ need, status: "covered", from: "table", item: "signups", kind: "table", by: "signups is a collect table", judged: J("yes", ["table:signups"]) });
const scheduled = (need) => E({ need, status: "covered", from: "job", item: "nightly_a", kind: "job", judged: J("yes", ["job:nightly_a"]) });
const unseen = (need) => E({ need, status: "covered", from: "table", item: "signups", kind: "table", judged: J("unsure") });
const already = (need) => E({ need, status: "covered", from: "table", item: "enquiries", kind: "table", judged: J("yes", ["table:enquiries"]) });
// WHAT REALLY RAN: the table and the job applied; the function step failed.
const MADE = appliedFacts({
  spec: {
    tables: [{ name: "signups", access: "collect", columns: [{ name: "name" }, { name: "email" }] }],
    functions: [{ name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" }],
    jobs: [{ name: "nightly_a", fn: "send_reminder", everyMinutes: 1440, at: "09:00" }],
  },
  tables: ["signups"], functions: ["send_reminder"], jobs: [{ name: "nightly_a", fn: "send_reminder", everyMinutes: 1440, at: "09:00" }],
});
// …AND WHAT THE SITE ALREADY HAD: a table nothing in this change touched.
const EXISTING = existingFacts({ spec: { tables: [{ name: "enquiries", access: "collect", columns: [{ name: "name" }, { name: "message" }] }] } });
const OPTS = { made: MADE, reportable: REPORTABLE, failed: ["function"], judged: true, existing: EXISTING };
/** Every kind of outcome at once, each above its old cut, in an order the note does not use. */
const MIXED = () => [
  ...UNSEEN.map(unseen), ...SET_UP.map(setUp), ...MISSING.map(missing), ...BLOCKED.map(blocked),
  ...SCHEDULED.map(scheduled), ...ALREADY.map(already), ...UNSUPPORTED.map(unsupported), ...FAILED.map(failedStep), ...CONFIGURED.map(configured),
];
/** What the note says, in its own order: every requirement, told as what became of it. */
const TOLD_ORDER = [
  ...UNSUPPORTED.map((n) => ["unsupported", n, "failed"]),
  ...MISSING.map((n) => ["still-to-do", n, "missing"]), ...FAILED.map((n) => ["still-to-do", n, "failed"]),
  ...BLOCKED.map((n) => ["blocked", n, "blocked"]),
  ...SET_UP.map((n) => ["set-up", n, "unverified"]), ...CONFIGURED.map((n) => ["set-up", n, "configured"]),
  ...SCHEDULED.map((n) => ["scheduled", n, "unverified"]),
  ...ALREADY.map((n) => ["already-there", n, "unverified"]),
  ...UNSEEN.map((n) => ["unseen", n, "unknown"]),
];
/** An answer as the route sends it, from a report: the note, the list, and the rest beside them. */
const bodyOf = (report, { other = "", ...extra } = {}) => ({
  ok: true, changed: ["src/routes/index.tsx"], cost: 3,
  coverNote: [toldNote(report.told), other].filter(Boolean).join(" "),
  requirementsTold: report.told.length ? report.told : undefined,
  coverOther: other || undefined,
  ...extra,
});
const KIND_OF = { unsupported: "not-done", "still-to-do": "not-done", blocked: "not-done", "set-up": "note", scheduled: "note", "already-there": "note", unseen: "not-done" };
const ALL = [...UNSUPPORTED, ...MISSING, ...FAILED, ...BLOCKED, ...SET_UP, ...CONFIGURED, ...SCHEDULED, ...ALREADY, ...UNSEEN];

test("TOLD 1 — the report: every requirement of every kind of outcome, above every old cut and mixed, in the note's order, with what became of it and why where its sentence says", () => {
  // RE-ANCHORED 2026-10-06: "already-there", for what the site already had.
  // RE-ANCHORED 2026-10-07: and what a step wrote down past what it keeps track of (`not-tracked`).
  assert.deepEqual([...TOLD], ["unsupported", "still-to-do", "blocked", "set-up", "scheduled", "already-there", "unseen", "not-tracked"]);
  const r = requirementReport(MIXED(), OPTS);
  assert.deepEqual(r.told.map((o) => [o.told, o.need, o.state]), TOLD_ORDER);
  // THE REASON RIDES WHERE ITS SENTENCE GIVES ONE, and nowhere else.
  for (const o of r.told) assert.equal(Object.hasOwn(o, "why"), o.told === "unsupported" || o.told === "blocked", JSON.stringify(o));
  assert.ok(r.told.filter((o) => o.told === "blocked").every((o) => o.why === "the function step could not do its part"), JSON.stringify(r.told));
  // "ALREADY THERE" IS WHAT THE RECORD SAYS WAS FOUND WHERE IT ALREADY WAS, and
  // nothing else: every set-up entry was found among what this change applied.
  const rec = requirementOutcomes(MIXED(), OPTS);
  assert.deepEqual([...new Set(rec.filter((o) => ALREADY.includes(o.need)).map((o) => o.foundIn))], ["existing"]);
  assert.deepEqual([...new Set(rec.filter((o) => SET_UP.includes(o.need) || CONFIGURED.includes(o.need)).map((o) => o.foundIn))], ["applied"]);
  // THE PROPERTY COUNTS ARE THEIR OWN, never among the requirements.
  const withProps = requirementReport(MIXED(), { ...OPTS, invalid: ["onConflict", "softDelete"], unexpressed: ["language"] });
  assert.deepEqual([withProps.told.length, withProps.invalid, withProps.unexpressed], [TOLD_ORDER.length, ["onConflict", "softDelete"], ["language"]]);
});

test("TOLD 2 — the note the browser prints names every one in its own sentence, as it always did, with nothing cut and no count standing in for a name", () => {
  const note = requirementNote(MIXED(), OPTS);
  assert.ok(note.startsWith("One thing your site can't do yet: " + UNSUPPORTED.map((n) => n + " — this kind of change cannot do that yet").join("; ") + "."), note);
  assert.ok(note.includes("Still to do: " + [...MISSING, ...FAILED].join("; ") + "."), note);
  assert.ok(note.includes("And this one is waiting on another part of the same change that didn't work: " + BLOCKED.map((n) => n + " — the function step could not do its part").join("; ") + "."), note);
  assert.ok(note.includes("I've set that up, but I can't confirm from here that " + [...SET_UP, ...CONFIGURED].join("; or that ") + " — have a look"), note);
  assert.ok(note.includes("Scheduled as you asked: " + SCHEDULED.join("; ") + ". Automatic running"), note);
  assert.ok(note.includes("Your site already had that in place, but I can't confirm from here that " + ALREADY.join("; or that ") + " — have a look"), note);
  assert.doesNotMatch(note.slice(note.indexOf("I've set that up"), note.indexOf("Scheduled as you asked")), new RegExp(ALREADY.join("|")), "what the site already had was said to be set up");
  assert.ok(note.includes("I can't see from here whether " + UNSEEN.join("; or whether ") + " — nothing I can check"), note);
  assert.doesNotMatch(note, /more like it|\band \d+ more\b/i);
  for (const n of ALL) assert.equal(note.split(n).length - 1, 1, "said other than once: " + n);
  // THE SAME WORDS WHEN NOTHING WAS CUT: one of each, exactly as before.
  const one = requirementNote([missing("Each signup gets a confirmation email"), setUp("Each signup is kept so the owner can read them")], OPTS);
  assert.equal(one, "Still to do: Each signup gets a confirmation email. I've set that up, but I can't confirm from here that Each signup is kept so the owner can read them — have a look and tell me if it isn't right.");
  // AND THE PROPERTY COUNTS AFTER THEM, as before.
  assert.equal(requirementNote([], { ...OPTS, invalid: ["onConflict", "softDelete"] }), propertyNote(["onConflict", "softDelete"], []));
  assert.equal(propertyNote(["onConflict", "softDelete"], ["language"]), "I also asked the database for 2 guarantees it doesn't offer, so those aren't in place. One setting the design asked for isn't something this kind of change can carry through, so it's on the database's own default — say it again on its own and I'll have another go.");
});

test("TOLD 3 — the deduplication is the note's, kept: one need is said once in one sentence; one need told two ways is two; a reconciled hand-off is said once, through the entry that does the work", () => {
  // THE SAME NEED TWICE IN ONE SENTENCE, whatever its case or spacing: once.
  const twice = requirementReport([missing("Each signup gets a confirmation email"), missing("each signup  gets a confirmation email"), missing("The owner gets a text for each signup")], OPTS);
  assert.deepEqual(twice.told.map((o) => [o.told, o.need]), [["still-to-do", "Each signup gets a confirmation email"], ["still-to-do", "The owner gets a text for each signup"]]);
  assert.equal(facts(bodyOf(twice)).filter((f) => /confirmation email/i.test(f)).length, 1);
  // ONE NEED TOLD TWO WAYS is two outcomes, and two facts of two kinds.
  const ways = requirementReport([missing("Each signup is kept"), setUp("Each signup is kept")], OPTS);
  assert.deepEqual(ways.told.map((o) => o.told), ["still-to-do", "set-up"]);
  assert.deepEqual(facts(bodyOf(ways)).filter((f) => /Each signup is kept/.test(f)), ["not-done: Not done: Each signup is kept.", "note: Set up, but nothing here can check that it works: Each signup is kept."]);
  // RUN 50'S RECONCILED HAND-OFF (`requirement-coverage`'s own case): both
  // entries kept for the record, the need told once.
  const NEED = "That count runs every night at 11";
  const MADE50 = [{ kind: "job", name: "nightly_booking_count", holds: ["1440", "23:00"], fails: [], checked: [] }];
  const OPTS50 = { told: ["job"], made: MADE50, reportable: ["job", "function"] };
  const handed = cleanRequirements([{ need: NEED, status: "elsewhere", step: "job" }], "function").list;
  const answered = cleanRequirements([{ need: NEED, status: "covered", by: "nightly_booking_count job at 23:00 every 1440 minutes", kind: "job", item: "nightly_booking_count", answers: "function#0" }], "job").list;
  const both = [...handed, ...answered];
  assert.equal(requirementOutcomes(both, OPTS50).length, 2, "both entries are kept for the record — this case tests nothing");
  const r50 = requirementReport(both, OPTS50);
  assert.deepEqual(r50.told.map((o) => o.need), [NEED]);
  assert.equal(facts(bodyOf(r50)).filter((f) => f.includes(NEED)).length, 1);
  // …AND WHEN THE TWO WORD IT DIFFERENTLY, the same rule and not the exact one:
  // the hand-off the answer speaks for is silent, the answer is told.
  const SAID = "The nightly booking count runs at 23:00";
  const answered2 = cleanRequirements([{ need: SAID, status: "covered", by: "nightly_booking_count job at 23:00 every 1440 minutes", kind: "job", item: "nightly_booking_count", answers: "function#0" }], "job").list;
  const r2 = requirementReport([...handed, ...answered2], OPTS50);
  assert.equal(requirementOutcomes([...handed, ...answered2], OPTS50).find((o) => o.status === "elsewhere").reconciledBy, "job#0", "the hand-off was not reconciled — this case tests nothing");
  assert.deepEqual(r2.told.map((o) => o.need), [SAID]);
});

test("TOLD 4 — each requirement is its own fact, its kind the state's; the note is never also a fact beside them; an answer stored before the list, or a list that does not read, is the whole note as one fact", () => {
  const OTHER = "The page Prices didn't come out of the writer, so it isn't on the site.";
  const r = requirementReport(MIXED(), OPTS);
  const body = bodyOf(r, { other: OTHER });
  const f = addonReplyFacts(body).facts;
  const told = f.filter((x) => ALL.some((n) => x.text.includes(n)));
  // EVERY ONE, ONCE, IN THE NOTE'S ORDER, ITS KIND THE STATE'S.
  assert.equal(told.length, TOLD_ORDER.length, JSON.stringify(f.map((x) => x.text)));
  told.forEach((x, i) => {
    const [as, need] = TOLD_ORDER[i];
    assert.ok(x.text.includes(need), x.text + " is not " + need);
    assert.equal(x.kind, KIND_OF[as], need + " rode as " + x.kind);
  });
  assert.deepEqual(told.filter((x) => x.kind === "note").map((x) => x.text), [
    ...[...SET_UP, ...CONFIGURED].map((n) => "Set up, but nothing here can check that it works: " + n + "."),
    ...SCHEDULED.map((n) => "Scheduled as asked; its automatic running has not been seen yet: " + n + "."),
    ...ALREADY.map((n) => "Their site already had this before this request, and nothing here can check that it works: " + n + "."),
  ]);
  assert.ok(told.some((x) => x.text === "Their site cannot do this yet: People can pay by bank transfer (this kind of change cannot do that yet)."));
  assert.ok(told.some((x) => x.text === "Not done: The number of signups is counted every hour."));
  assert.ok(told.some((x) => x.text === "Not done, because another part of this change it depends on did not work: The count starts again each month (the function step could not do its part)."));
  assert.ok(told.some((x) => x.text === "Nothing here can see whether this is in place: Signups older than a year are archived."));
  // THE REST OF THE NOTE, ONCE; THE REQUIREMENTS' SENTENCES, NEVER.
  assert.deepEqual(f.filter((x) => x.text === OTHER).map((x) => x.kind), ["not-done"]);
  assert.ok(!f.some((x) => /Still to do|I've set that up|One thing your site/.test(x.text)), "the note was given beside the requirements");
  // WHAT THE PAGE HOLDS THE REPLY'S PLACE WITH: some of it is not done.
  assert.equal(replyOutcomeOf({ facts: f }), "partly");
  // SET UP AND SCHEDULED ARE DONE, with something worth knowing…
  const fine = requirementReport([...SET_UP.map(setUp), ...SCHEDULED.map(scheduled)], OPTS);
  assert.equal(replyOutcomeOf(addonReplyFacts(bodyOf(fine))), "done");
  // …AND WHAT NOBODY COULD SEE IS NEVER CALLED DONE.
  const blind = requirementReport(UNSEEN.map(unseen), OPTS);
  assert.equal(replyOutcomeOf(addonReplyFacts(bodyOf(blind))), "partly");
  // AN ANSWER STORED BEFORE THE LIST: the note, whole, as one fact.
  const before = { ok: true, changed: ["src/routes/index.tsx"], coverNote: body.coverNote };
  const fb = addonReplyFacts(before).facts.filter((x) => x.kind === "not-done");
  assert.equal(fb.length, 1);
  for (const n of ALL) assert.ok(fb[0].text.includes(n), "the stored note lost " + n);
  // A LIST THAT DOES NOT READ IS NOT TRUSTED TO BE WHOLE: the note instead.
  for (const bad of [
    [...r.told, { need: "Extra", told: "later" }],
    [...r.told, { need: 5, told: "still-to-do" }],
    [...r.told, ["still-to-do", "Extra"]],
    [...r.told, { need: "Extra", told: "unsupported", why: 7 }],
    [],
    "Still to do: Extra",
  ]) {
    const fx = addonReplyFacts({ ...body, requirementsTold: bad }).facts;
    assert.deepEqual(fx.filter((x) => x.kind === "not-done").map((x) => x.text), [body.coverNote], JSON.stringify(bad).slice(0, 80));
  }
});

test("TOLD 5 — the reply writer's own completeness check holds the model to every requirement: one left out is asked for again by name, and left out twice the reply is never used", async () => {
  const r = requirementReport(MIXED(), OPTS);
  const f = addonReplyFacts(bodyOf(r)).facts;
  const last = f.find((x) => x.text === "Nothing here can see whether this is in place: Signups older than a year are archived.");
  assert.ok(last, "the last requirement has no fact — this case tests nothing");
  const said = (covers) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: REPLY_TOOL.name, input: { reply: "What happened, in the model's own words.", covers } }], usage: { input_tokens: 40, output_tokens: 20 } });
  const all = f.map((x) => x.id);
  const without = all.filter((id) => id !== last.id);
  const run = async (answers) => {
    const sent = [];
    const out = await writeReply({ send: async (req) => { sent.push(req); return answers[sent.length - 1]; } }, { facts: f, model: "m" });
    return { out, sent };
  };
  // EVERY REQUIREMENT IS IN WHAT THE MODEL IS SHOWN, BY ITS OWN ID.
  const once = await run([said(all)]);
  const shown = String(once.sent[0].messages[0].content);
  for (const x of f) assert.ok(shown.includes("[" + x.id + "] " + x.text), "the model was not shown " + x.text);
  assert.deepEqual([once.out.ok, once.out.attempts], [true, 1]);
  // ONE LEFT OUT: ASKED AGAIN, NAMING IT.
  const again = await run([said(without), said(all)]);
  assert.deepEqual([again.out.ok, again.out.attempts], [true, 2]);
  assert.match(String(again.sent[1].messages[0].content), new RegExp("YOUR LAST REPLY LEFT OUT " + last.id + "\\b"));
  // LEFT OUT TWICE: NOT A REPLY ANYBODY GETS.
  const twice = await run([said(without), said(without)]);
  assert.deepEqual([twice.out.ok, twice.out.why, twice.out.attempts], [false, "uncovered", 2]);
});

// ─────────────────────────────────────────────────────────────────────────────
// THROUGH THE REAL ADD-ON ROUTE
// ─────────────────────────────────────────────────────────────────────────────

const addon = (slug, msg, opts) => routeAddon(slug, msg, { ...opts, setup: () => invalidateSiteSchema(connForDatabase(SITE_CONN, "sitedb")) });
const table = (name, columns, extra = {}) => ({ table: { name, access: "collect", columns: columns.map((c) => ({ name: c, type: "text" })), ...extra } });
/** The judgment, answered per requirement by its need: what the model would say of each. */
const judgingBy = (rules) => ({
  judge: ({ entries, step }) => ({
    verdicts: entries.map((e) => {
      const rule = rules.find(([re]) => re.test(e.need));
      assert.ok(rule, "no verdict written for " + e.need);
      const [, carried, by] = rule;
      return step ? { id: e.id, follows: "asked", carried: "unsure", reason: "r" } : { id: e.id, follows: "asked", carried, ...(by ? { by } : {}), reason: "r" };
    }),
  }),
});
// NO `basis` OR `words`: the harness gives each the customer's own message, as
// a designer quoting what they wrote would.
const req = (need, extra = {}) => ({ need, status: "covered", by: "signups", item: "signups", kind: "table", ...extra });
const SIGNUP_MSG = "Add a signup form that keeps each signup";
// A TABLE WITH ITS PAGE, as the judgment's own cases build it: the form the
// table collects for.
const SIGNUP_PAGE = { path: "/sign-up", name: "Sign up", purpose: "what Sign up is for", sections: ["a band"], components: ["section-header"], link: { in: "menu" } };
const signupKinds = { kinds: ["table", "page"], publishes: true, written: [writtenPage("/sign-up")] };

test("TOLD 6 — Codex's case through the route: four requirements they asked for, all left undone — every one in the list the route sends, in the facts the reply model is given, in the note, and on the screen the browser composes", async () => {
  const r = await addon("rt-told-four", SIGNUP_MSG, {
    ...signupKinds,
    answers: { table: { table: [table("signups", ["name", "email"])], requirements: MISSING.concat(UNSEEN.slice(0, 1)).map((n) => req(n)) }, page: { page: [SIGNUP_PAGE] } },
    ...judgingBy([[/./, "no"]]),
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  const four = [...MISSING, UNSEEN[0]];
  // WHAT THE CUSTOMER AND THE REPLY MODEL ARE GIVEN, FIRST: every one.
  assert.equal(r.body.coverNote, "Still to do: " + four.join("; ") + ".");
  const said = browserText(r.body);
  for (const n of four) assert.ok(said.includes(n), "the browser's screen lost " + n + ": " + said);
  assert.deepEqual(facts(r.body).filter((x) => four.some((n) => x.includes(n))), four.map((n) => "not-done: Not done: " + n + "."));
  // …AND THE LIST THE ROUTE SENDS.
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need, o.state]), four.map((n) => ["still-to-do", n, "missing"]));
  // THE RECORD AGREES, every one missing.
  assert.deepEqual(storedAnswer(r, "rt-told-four").coverage.requirements.map((q) => [q.need, q.state]), four.map((n) => [n, "missing"]));
});

test("TOLD 7 — mixed outcomes through the route, each kind above its old cut: impossible for now, not done, set up and unchecked, and nobody could see — every one sent, every one a fact of its own kind, every one on the screen", async () => {
  const UNS = UNSUPPORTED.map((n) => req(n, { status: "unsupported", why: "this kind of change cannot do that yet", by: undefined, item: undefined, kind: undefined }));
  const r = await addon("rt-told-mixed", SIGNUP_MSG, {
    ...signupKinds,
    // TWO DESIGNERS' REQUIREMENTS, each under the twelve one designer may
    // declare (`MAX_REQUIREMENTS`; past it an entry is set aside at intake as
    // `over-cap` — a ceiling on what is accepted, outside this case).
    answers: { table: { table: [table("signups", ["name", "email"])], requirements: [...UNSEEN.map((n) => req(n)), ...MISSING.concat(FAILED).map((n) => req(n)), ...SET_UP.map((n) => req(n))] }, page: { page: [SIGNUP_PAGE], requirements: UNS } },
    ...judgingBy([
      [new RegExp(UNSEEN.join("|")), "unsure"],
      [new RegExp([...MISSING, ...FAILED, ...UNSUPPORTED].join("|")), "no"],
      [new RegExp(SET_UP.join("|")), "yes", ["table:signups"]],
    ]),
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  const WANT = [
    ...UNSUPPORTED.map((n) => ["unsupported", n]), ...[...MISSING, ...FAILED].map((n) => ["still-to-do", n]),
    ...SET_UP.map((n) => ["set-up", n]), ...UNSEEN.map((n) => ["unseen", n]),
  ];
  // THE NOTE AND THE SCREEN, FIRST: every one, and no count in place of a name.
  assert.doesNotMatch(r.body.coverNote, /more like it|\band \d+ more\b/i);
  const said = browserText(r.body);
  for (const [, n] of WANT) {
    assert.ok(r.body.coverNote.includes(n), "the note lost " + n);
    assert.ok(said.includes(n), "the browser's screen lost " + n);
  }
  // THE REPLY MODEL'S FACTS: one each, its kind the state's.
  const f = addonReplyFacts(r.body).facts;
  for (const [as, n] of WANT) {
    const x = f.filter((y) => y.text.includes(n));
    assert.equal(x.length, 1, n + " is not exactly one fact: " + JSON.stringify(x));
    assert.equal(x[0].kind, KIND_OF[as], n + " rode as " + x[0].kind);
  }
  // …AND THE LIST THE ROUTE SENDS, in the note's order.
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), WANT);
});

const COUNT_FN = { name: "count_signups", returns: "bigint", body: "SELECT COUNT(*) FROM signups" };
const DASH = { path: "/dashboard", name: "Dashboard", purpose: "See the signup count.", sections: ["a single figure"], components: ["section-header"] };

test("TOLD 8 — three requirements waiting on a part of the change that failed, above the old cut of two, through the route: every one sent, every one a fact, with its reason", async () => {
  const LATE = BLOCKED.map((need) => ({ need, status: "elsewhere", step: "function" }));
  const r = await addon("rt-told-blocked", "add a dashboard page that shows the signup count", {
    kinds: ["function", "page"], publishes: true, fnFail: true,
    answers: { function: { function: [COUNT_FN] }, page: { page: [DASH], requirements: LATE } },
    written: [writtenPage("/dashboard")],
    ...judgingBy([[/./, "no"]]),
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.ok((r.body.functionErrors || []).length, "the database did not refuse the function — this case tests nothing");
  for (const n of BLOCKED) assert.ok(browserText(r.body).includes(n), "the browser's screen lost " + n);
  const f = facts(r.body);
  for (const n of BLOCKED) assert.ok(f.some((x) => x.startsWith("not-done: Not done, because another part of this change it depends on did not work: " + n + " (")), n + ": " + JSON.stringify(f));
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need, o.state]), BLOCKED.map((n) => ["blocked", n, "blocked"]));
});

test("TOLD 9 — three scheduled requirements, above the old cut of two, through the route: every one told as scheduled and not yet seen running, never as not done", async () => {
  const FN = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
  const JOBS = ["morning_reminder", "booked_reminder", "nine_reminder"].map((name) => ({ name, fn: "send_reminder", everyMinutes: 1440, at: "09:00" }));
  const NEEDS = SCHEDULED.map((need, i) => ({ need, status: "covered", by: JOBS[i].name + " runs daily", kind: "job", item: JOBS[i].name }));
  const r = await addon("rt-told-scheduled", "remind people every morning", {
    kinds: ["function", "job"], tz: "Europe/London",
    answers: { function: { function: [FN] }, job: { job: JOBS, requirements: NEEDS } },
    ...judgingBy(SCHEDULED.map((n, i) => [new RegExp(n), "yes", ["job:" + JOBS[i].name]])),
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.ok(r.body.coverNote.includes("Scheduled as you asked: " + SCHEDULED.join("; ") + "."), r.body.coverNote);
  assert.deepEqual(facts(r.body).filter((x) => SCHEDULED.some((n) => x.includes(n))), SCHEDULED.map((n) => "note: Scheduled as asked; its automatic running has not been seen yet: " + n + "."));
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), SCHEDULED.map((n) => ["scheduled", n]));
});

// ─────────────────────────────────────────────────────────────────────────────
// THE WHOLE PATH: A REQUEST, ITS JOB, THE STORED ANSWER, THE BACKGROUND REPLY
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const DESC = "Change the site description to say we bake overnight sourdough";
const ADD = "add a gallery page";
/** The judgment, answered from what the route really showed it: every requirement left undone. */
const undoneJudge = (args) => {
  const text = (args.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
  const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{"));
  return { verdicts: lines.map((l) => ({ id: JSON.parse(l).id, follows: "asked", carried: "no", reason: "r" })) };
};

test("TOLD 10 — the whole path in a request: the addition's answer stored by its job, read back, and its reply written in the background — the writer is given every one of four undone requirements, and the reply it keeps covers every one", async () => {
  const GALLERY_NEEDS = ["The gallery shows every photo uploaded this year", "The gallery lets people download each photo", "The gallery sorts photos by date", "The gallery has a slideshow"];
  const compiler = installCompiler();
  const P = platform({
    slug: "rt-told-req-" + Math.random().toString(16).slice(2, 8), replies: true,
    answers: {
      route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }],
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": "Overnight sourdough from a Bristol side street.",
      [T.adds]: { kinds: ["page"] },
      "add:page": { page: [PAGE("/gallery", "Gallery")], requirements: GALLERY_NEEDS.map((need) => ({ need, status: "covered", by: "the gallery page", item: "/gallery", kind: "page", basis: "asked", words: ADD })) },
      [T.pages]: { pages: [writtenPage("/gallery")] },
      judge_requirements: undoneJudge,
    },
  });
  try {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const { rec } = await settle(P, r.key);
    await pump(P);
    // RE-ANCHORED 2026-10-07: AN ADDITION THAT TOLD FOUR REQUESTED THINGS
    // "STILL TO DO" IS DONE IN PART — its part was recorded as finished, with
    // every one of the four undone. Each is on the part as not done.
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "partial"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(rec.parts[1].notDone.map((x) => [x.what, x.why]), GALLERY_NEEDS.map((n) => [n, "still-to-do"]), JSON.stringify(rec.parts[1].notDone));
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    // THE WRITER WAS GIVEN EVERY ONE, FROM THE ANSWER ITS JOB STORED…
    const given = P.replyLog.find((fs) => fs.some((x) => x.text.includes(GALLERY_NEEDS[0])));
    assert.ok(given, "the background writer never wrote the addition's reply");
    for (const n of GALLERY_NEEDS) assert.ok(given.some((x) => x.text.includes(n)), "the writer was never given " + n + ": " + JSON.stringify(given));
    // …EACH AS ITS OWN FACT, SO ITS COMPLETENESS CHECK HOLDS IT TO EACH…
    for (const n of GALLERY_NEEDS) assert.equal(given.filter((x) => x.text === "Not done: " + n + ".").length, 1, n + " is not a fact of its own: " + JSON.stringify(given));
    // …AND THE REPLY IT KEPT EXPLAINS EVERY ONE (the stub writes the facts as given).
    const kept = JSON.parse(P.objects.get("edit-replies/" + job.id + ".json").body);
    assert.equal(kept.state, "written", JSON.stringify(kept).slice(0, 300));
    for (const n of GALLERY_NEEDS) assert.ok(String(kept.text).includes(n), "the kept reply lost " + n);
    // THE STORED ANSWER, AS ITS JOB KEPT IT: the list whole.
    const answer = P.answerOf(job);
    assert.deepEqual((answer.requirementsTold || []).map((o) => [o.told, o.need]), GALLERY_NEEDS.map((n) => ["still-to-do", n]), JSON.stringify(answer).slice(0, 600));
  } finally { P.close(); compiler.uninstall(); }
});

test("TOLD 11 — RE-ANCHORED 2026-10-06, the limitation it pinned now closed: a refusal's answer carries the whole list, and every requirement in it reaches the reply model and the screen, under the refusal's own sentence", async () => {
  // THIS CASE PINNED THE OMISSION "so a change to it is deliberate": the
  // facts and the screen were the refusal's own, and the bank transfer the
  // customer asked for reached neither. The owner (2026-10-06): *"close …
  // requirement details disappearing from refused Add-on responses."* It now
  // pins the fix; the fuller cases — an incomplete judgment beside a refusal,
  // what the site already had, a refusal's stored answer replayed — are in
  // `test/addon-refusal-warnings.test.mjs`.
  const MSG = "Add a spinning 3D model of our shop to the home page, and let people pay by bank transfer";
  const PAY = { need: "People can pay by bank transfer", status: "unsupported", why: "this step cannot take payments", basis: "asked", words: "let people pay by bank transfer" };
  const r = await addon("rt-told-refused", MSG, {
    kinds: ["three"],
    answers: { three: { three: { page: "/" }, requirements: [PAY] } },
    ...judgingBy([[/bank transfer/, "no"]]),
  });
  assert.equal(r.body.error, "add", "the designer's answer was not refused — this case tests nothing: " + JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), [["unsupported", PAY.need]]);
  assert.match(r.body.coverNote, /One thing your site can't do yet: People can pay by bank transfer/);
  // …AND NOW BOTH THE REPLY MODEL AND THE SCREEN HEAR OF IT.
  assert.deepEqual(facts(r.body).filter((x) => /bank transfer/.test(x)), ["not-done: Their site cannot do this yet: People can pay by bank transfer (this step cannot take payments)."]);
  assert.match(facts(r.body)[0], /^not-done: Nothing was added\. The builder's own reason: /, "the refusal's own fact is no longer first");
  const b = browserReply(r.body, false);
  assert.ok(b.ok, b.why);
  assert.equal(b.text, "⚠️ " + r.body.msg + " " + r.body.coverNote, b.text);
});

test("TOLD 12 — what the note says beside the requirements reaches the reply model once, as its own fact: four undone requirements and a page the writer did not produce, through the route", async () => {
  const PRICES = { ...SIGNUP_PAGE, path: "/prices", name: "Prices", purpose: "what Prices is for" };
  const four = [...MISSING, ...FAILED];
  const r = await addon("rt-told-beside", SIGNUP_MSG, {
    ...signupKinds,
    answers: { table: { table: [table("signups", ["name", "email"])], requirements: four.map((n) => req(n)) }, page: { page: [SIGNUP_PAGE, PRICES] } },
    ...judgingBy([[/./, "no"]]),
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual(r.body.missingPages, ["/prices"], "every page survived — this case tests nothing");
  const f = addonReplyFacts(r.body).facts;
  // THE REQUIREMENTS, ONE FACT EACH…
  assert.deepEqual(f.filter((x) => four.some((n) => x.text.includes(n))).map((x) => x.kind + ": " + x.text), four.map((n) => "not-done: Not done: " + n + "."));
  // …THE MISSING PAGE, ONCE, BESIDE THEM — RE-ANCHORED 2026-10-06: as a fact
  // of its own (`warningsTold`), no longer the note's sentence.
  const beside = f.filter((x) => /\/prices/.test(x.text));
  assert.equal(beside.length, 1, JSON.stringify(f));
  assert.equal(beside[0].text, "A page this change set out to add did not make it through, so it is not on the site: /prices.");
  assert.equal(beside[0].kind, "not-done");
  assert.deepEqual(r.body.warningsTold, [{ what: "page", name: "/prices" }]);
  // …AND THE REQUIREMENTS' OWN SENTENCES NOWHERE AMONG THE FACTS, NOR THE
  // PAGE'S.
  assert.ok(!f.some((x) => /Still to do|One page I set out/.test(x.text)), JSON.stringify(f));
  // THE NOTE THE BROWSER PRINTS HAS BOTH, the requirements first.
  assert.ok(r.body.coverNote.startsWith("Still to do: " + four.join("; ") + ". One page I set out to add isn't there — /prices"), r.body.coverNote);
});
