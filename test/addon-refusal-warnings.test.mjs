// ─────────────────────────────────────────────────────────────────────────────
// A REFUSAL'S REQUIREMENTS, AND EVERY MISSING PAGE, CODE, SEED SKIP AND EMPTY
// TABLE, TOLD (2026-10-06)
//
// The owner: *"close the two remaining reporting omissions together in one
// focused batch: requirement details disappearing from refused Add-on
// responses, and individual missing pages, QR codes, seed skips or unfillable
// tables disappearing behind shortened warning lists. Carry every relevant
// outcome through the stored answer, reply-model facts and existing customer
// display paths, preserving accurate states, reasons and legitimate
// deduplication. … On refusal, report only what the available evidence
// establishes; an incomplete judgment must never become a claim that work
// succeeded."*
//
// WHAT WAS TRUE BEFORE (reproduced first; the red check is in the record):
//   - a refused addition's answer carried its requirements and its note, and
//     the reply's facts were the refusal's own sentence and the browser printed
//     only that — and the note it never showed said "I've set that up" of what
//     the site already had, so carrying it naively would have claimed work on
//     a refusal;
//   - the missing-page, seed and empty-table sentences named three and said
//     "and N more"; the codes' sentence named three and never mentioned a
//     fourth; the reply model was given all of them as one fact; the route
//     kept twelve seed skips and sent twelve empty tables; and every seed skip
//     was said to leave a table "empty because visitors can't read it",
//     whatever the engine's reason was.
//
// These cases run through the module, the reply writer's own completeness
// check, the real add-on route, the browser's own refusal and success
// composers, and a request whose answer is stored by its job and replied to in
// the background.
// ─────────────────────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addon as routeAddon, writtenPage, addedTo, storedAnswer, SITE_CONN } from "./fixtures/addon-route.mjs";
import { invalidateSiteSchema } from "../site-schema.mjs";
import { connForDatabase } from "../site-db.mjs";
import { warningReport, missingPagesNote, deadQrNote, seedSkipNote, populationNote, existingFacts, appliedFacts } from "../builder/site-add.mjs";
import { requirementOutcomes, requirementReport } from "../builder/site-requirements.mjs";
import { addonReplyFacts, replyOutcomeOf, writeReply, REPLY_TOOL } from "../builder/site-reply.mjs";
import { browserReply } from "../scripts/addon-sweep.mjs";
import { platform, sendMessage, settle, pump, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";

const addon = (slug, msg, opts) => routeAddon(slug, msg, { ...opts, setup: () => invalidateSiteSchema(connForDatabase(SITE_CONN, "sitedb")) });
const facts = (body) => (addonReplyFacts(body).facts || []).map((f) => f.kind + ": " + f.text);
const screen = (body, httpOk) => { const b = browserReply(body, httpOk); assert.ok(b.ok, "the browser's composer could not run: " + b.why); return b.text; };
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
/** The judgment, per requirement by its need: `[pattern, follows, carried, by]`. */
const judging = (rules) => ({
  judge: ({ entries, step }) => ({
    verdicts: entries.map((e) => {
      const hit = rules.find(([re]) => re.test(e.need));
      assert.ok(hit, "no verdict written for " + e.need);
      const [, follows, carried = "unsure", by] = hit;
      return step ? { id: e.id, follows, carried: "unsure", reason: "r" } : { id: e.id, follows, carried, ...(by ? { by } : {}), reason: "r" };
    }),
  }),
});
/** What a refusal's own fact says. */
const refusalFact = (body) => "not-done: Nothing was added. The builder's own reason: “" + body.msg + "”";

// ─────────────────────────────────────────────────────────────────────────────
// 1. REFUSALS
// ─────────────────────────────────────────────────────────────────────────────

const MSG = "Add a spinning 3D model of our shop to the home page, email me about every enquiry, and let people pay by bank transfer";
const PAY = { need: "People can pay by bank transfer", status: "unsupported", why: "this step cannot take payments", basis: "asked", words: "let people pay by bank transfer" };
const EMAIL = { need: "The owner is emailed about each new enquiry", status: "covered", by: "the enquiries table already emails the owner", item: "enquiries", kind: "table", basis: "asked", words: "email me about every enquiry" };
const SPIN = { need: "The model turns slowly", status: "covered", by: "the scene", item: "three", kind: "three", basis: "asked", words: "a spinning 3D model of our shop" };
const LIGHT = { need: "The model is lit from above", status: "covered", by: "the scene", basis: "asked", words: "a spinning 3D model of our shop" };
const BANNER = { need: "A cookie banner is shown", status: "covered", by: "the scene", basis: "asked", words: "a spinning 3D model of our shop" };
// THE SITE ALREADY KEEPS ENQUIRIES, and a collect table emails its owner.
const STORED = { tables: [{ name: "enquiries", access: "collect", columns: [{ name: "name", type: "text" }, { name: "message", type: "text" }] }], functions: [], apis: [], jobs: [] };
const VERDICTS = [
  [/bank transfer/, "asked", "no"],
  [/emailed/, "asked", "yes", ["table:enquiries:notify"]],
  [/turns slowly|answered within a day/, "asked", "no"],
  [/lit from above/, "asked", "unsure"],
  [/cookie banner/, "unrelated", "no"],
];
/** A 3D scene the cleaner refuses (it says nothing of what it shows), with five requirements beside it. */
const refused = (slug, judge) => addon(slug, MSG, { kinds: ["three"], stored: STORED, answers: { three: { three: { page: "/" }, requirements: [PAY, EMAIL, SPIN, LIGHT, BANNER] } }, ...judge });
const NO_WORK = /I've set that up|Set up, but|Scheduled as/;

test("REFUSE 1 — a designer's refusal beside a judgment that finished: every requirement it kept is a fact of its own under the refusal's, and the screen prints the note under the refusal's sentence; what the site already had is said to be already there, never set up; nothing applied or charged", async () => {
  const r = await refused("rw-refused-judged", judging(VERDICTS));
  // UNCHANGED: a refusal, at no cost, before anything is written.
  assert.deepEqual([r.status, r.body.ok, r.body.error, r.body.cost], [422, false, "add", 0], JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.charges, [], "a refusal was charged");
  assert.ok(!r.sql.some((q) => /CREATE TABLE|INSERT INTO "/i.test(q)), "a refusal wrote to the database");
  // THE LIST THE ROUTE SENDS: every requirement the judgment kept, in the
  // note's order — and the extra it set aside is not one.
  // RE-ANCHORED 2026-10-06: a failure SETTLES the publish's kinds — nothing of
  // the scene was made, and is known not to have been — so the requirement the
  // scene's step declared and nothing carries is not done, where before the
  // scene's results counted as not yet known ("nobody can see").
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need, o.state]), [
    ["unsupported", PAY.need, "failed"], ["still-to-do", SPIN.need, "missing"], ["still-to-do", LIGHT.need, "missing"],
    ["already-there", EMAIL.need, "unverified"],
  ]);
  // AND THE ANSWER SAYS WHAT IT LEFT BEHIND: nothing.
  assert.deepEqual(r.body.outcome, { state: "none", published: false, database: "none" });
  // THE REPLY MODEL'S FACTS: the refusal's own first, then one per requirement,
  // each its state's kind.
  const f = facts(r.body);
  assert.deepEqual(f, [
    refusalFact(r.body),
    "not-done: Their site cannot do this yet: People can pay by bank transfer (this step cannot take payments).",
    "not-done: Not done: The model turns slowly.",
    "not-done: Not done: The model is lit from above.",
    "note: Their site already had this before this request, and nothing here can check that it works: The owner is emailed about each new enquiry.",
  ]);
  assert.equal(replyOutcomeOf(addonReplyFacts(r.body)), "not-done");
  // THE SCREEN: the refusal's sentence, then the note the server composed.
  const said = screen(r.body, false);
  assert.equal(said, "⚠️ " + r.body.msg + " " + r.body.coverNote);
  for (const n of [PAY, SPIN, EMAIL, LIGHT]) assert.ok(said.includes(n.need), "the screen lost " + n.need);
  assert.match(said, /Your site already had that in place, but I can't confirm from here that The owner is emailed about each new enquiry/);
  // NO CLAIM OF WORK, AND NO EXTRA, ANYWHERE THE CUSTOMER OR THE MODEL READS.
  for (const text of [said, ...f]) {
    assert.doesNotMatch(text, NO_WORK, text);
    assert.doesNotMatch(text, /cookie banner/i, text);
  }
});

test("REFUSE 2 — the same refusal beside a judgment that did not finish (empty twice, one verdict of five twice, cut off): nothing is told — no requirement called set up, already there or not done; the refusal's own sentence stands; nothing applied or charged", async () => {
  const one = ({ entries }) => ({ verdicts: entries.filter((e) => /bank transfer/.test(e.need)).map((e) => ({ id: e.id, follows: "asked", carried: "no", reason: "r" })) });
  for (const [slug, judge] of [["rw-refused-empty", () => ({ verdicts: [] })], ["rw-refused-partial", one], ["rw-refused-cut", "cut"]]) {
    const r = await refused(slug, { judge });
    assert.deepEqual([r.status, r.body.error, r.body.cost, r.charges.length], [422, "add", 0, 0], slug + ": " + JSON.stringify(r.body).slice(0, 300));
    assert.ok(!r.sql.some((q) => /CREATE TABLE|INSERT INTO "/i.test(q)), slug + ": a refusal wrote to the database");
    // WHAT NOBODY JUDGED IS NOT TOLD — not even the one verdict that came back,
    // because a judgment is whole or it is not used.
    assert.equal(r.body.requirementsTold, undefined, slug);
    assert.equal(r.body.coverNote, "", slug);
    assert.deepEqual(facts(r.body), [refusalFact(r.body)], slug);
    assert.equal(screen(r.body, false), "⚠️ " + r.body.msg, slug);
  }
});

test("REFUSE 3 — every designer declined, each having said what the change needed: the all-declined refusal tells every requirement the judgment kept, the same way, and its record says where what the site already had was found", async () => {
  const DAY = { need: "Each enquiry is answered within a day", status: "covered", by: "the enquiries table", item: "enquiries", kind: "table", basis: "asked", words: "email me about every enquiry" };
  const r = await addon("rw-declined", MSG, {
    kinds: ["page", "table"], stored: STORED,
    // NO VALUE FOR THE KIND IS A DECLINE; the requirements still ride.
    answers: { page: { requirements: [PAY, LIGHT] }, table: { requirements: [EMAIL, DAY] } },
    ...judging(VERDICTS),
  });
  assert.deepEqual([r.status, r.body.error, r.body.cost, r.charges.length], [422, "declined", 0, 0], JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual([...r.body.kinds].sort(), ["page", "table"]);
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), [
    ["unsupported", PAY.need], ["still-to-do", DAY.need], ["already-there", EMAIL.need], ["unseen", LIGHT.need],
  ]);
  const f = facts(r.body);
  assert.equal(f[0], refusalFact(r.body));
  assert.deepEqual(f.slice(1), [
    "not-done: Their site cannot do this yet: People can pay by bank transfer (this step cannot take payments).",
    "not-done: Not done: Each enquiry is answered within a day.",
    "note: Their site already had this before this request, and nothing here can check that it works: The owner is emailed about each new enquiry.",
    "not-done: Nothing here can see whether this is in place: The model is lit from above.",
  ]);
  const said = screen(r.body, false);
  assert.equal(said, "⚠️ " + r.body.msg + " " + r.body.coverNote);
  assert.doesNotMatch(said, NO_WORK);
  // THE DEVELOPER'S RECORD (this refusal is after it is written): found where
  // it already was.
  const rec = storedAnswer(r, "rw-declined").coverage.requirements.find((q) => q.need === EMAIL.need);
  assert.deepEqual([rec.state, rec.foundIn, rec.carriedBy], ["unverified", "existing", ["table:enquiries:notify"]]);
});

/** The judgment as a request's model is asked it, read off the request the route sent: by need. */
const requestJudge = (rules) => (args) => {
  const text = (args.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
  const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{"));
  return { verdicts: lines.map((l) => JSON.parse(l)).map((e) => {
    const [, follows, carried] = rules.find(([re]) => re.test(e.need));
    return { id: e.id, follows, carried, reason: "r" };
  }) };
};

test("REFUSE 4 — a refused addition inside a request: the answer its job stores carries every requirement, the reply written from it in the background is given each as a fact of its own, and the reply it keeps names each", async () => {
  const ASK = "add a spinning 3D model of our shop to the home page, and let people pay by bank transfer";
  const ROTATE = { need: "Visitors can turn the model themselves", status: "covered", by: "the scene", item: "three", kind: "three", basis: "asked", words: "a spinning 3D model of our shop" };
  const compiler = installCompiler();
  const P = platform({
    slug: "rw-req-refused-" + Math.random().toString(16).slice(2, 8), replies: true,
    answers: {
      route: [{ intent: "addon" }],
      [T.adds]: { kinds: ["three"] },
      "add:three": { three: { page: "/" }, requirements: [PAY, SPIN, ROTATE] },
      judge_requirements: requestJudge([[/bank transfer|turns slowly|turn the model/, "asked", "no"]]),
    },
  });
  try {
    const r = await sendMessage(P, { message: ASK + "." });
    const { rec } = await settle(P, r.key);
    await pump(P);
    assert.deepEqual(rec.parts.map((p) => [p.status, p.why]), [["failed", "add"]]);
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    // THE STORED ANSWER: every requirement, told as a refusal tells it.
    const answer = P.answerOf(job);
    assert.deepEqual([answer.ok, answer.error, answer.cost], [false, "add", 0]);
    assert.deepEqual(answer.requirementsTold.map((o) => [o.told, o.need]), [["unsupported", PAY.need], ["still-to-do", SPIN.need], ["still-to-do", ROTATE.need]]);
    // …THE WRITER WAS GIVEN EACH, FROM THAT STORED ANSWER…
    const given = P.replyLog.find((fs) => fs.some((x) => x.text.startsWith("Nothing was added.")));
    assert.ok(given, "the background writer never wrote the refused addition's reply");
    for (const want of [
      "Their site cannot do this yet: People can pay by bank transfer (this step cannot take payments).",
      "Not done: The model turns slowly.", "Not done: Visitors can turn the model themselves.",
    ]) assert.equal(given.filter((x) => x.text === want).length, 1, want + ": " + JSON.stringify(given));
    assert.ok(!given.some((x) => NO_WORK.test(x.text)), JSON.stringify(given));
    // …AND THE REPLY IT KEPT NAMES EVERY ONE (the stub writes the facts as given).
    const kept = JSON.parse(P.objects.get("edit-replies/" + job.id + ".json").body);
    assert.equal(kept.state, "written", JSON.stringify(kept).slice(0, 300));
    for (const n of [PAY, SPIN, ROTATE]) assert.ok(String(kept.text).includes(n.need), "the kept reply lost " + n.need);
  } finally { P.close(); compiler.uninstall(); }
});

test("REFUSE 5 — answers stored before this fix, replayed: a refusal that told what the site already had as set up or scheduled is said to be already there; a refusal's unreadable list tells nothing rather than its old note; its counted sentences are not told; a success reads as it always did", () => {
  const OLD = {
    ok: false, error: "add", kind: "three", cost: 0, msg: "I couldn't add that.",
    coverNote: "I've set that up, but I can't confirm from here that The owner is emailed about each new enquiry — have a look and tell me if it isn't right.",
    requirementsTold: [
      { need: "The owner is emailed about each new enquiry", told: "set-up", state: "unverified" },
      { need: "The enquiries are counted each night", told: "scheduled", state: "unverified" },
      { need: "People can pay by bank transfer", told: "unsupported", state: "failed", why: "this step cannot take payments" },
    ],
    coverOther: "I also asked the database for a guarantee it doesn't offer, so that one isn't in place.",
  };
  const own = refusalFact(OLD);
  // NOTHING WAS ADDED, SO NOTHING WAS SET UP: an older refusal's "set up" can
  // only have been carried by what the site already had.
  assert.deepEqual(facts(OLD), [
    own,
    "note: Their site already had this before this request, and nothing here can check that it works: The owner is emailed about each new enquiry.",
    "note: Their site already had this before this request, and nothing here can check that it works: The enquiries are counted each night.",
    "not-done: Their site cannot do this yet: People can pay by bank transfer (this step cannot take payments).",
  ]);
  // A LIST THAT DOES NOT READ, ON A REFUSAL: nothing from it, and never the
  // older note, which says "I've set that up".
  for (const bad of [[{ need: 5, told: "set-up" }], [], "Still to do: x", [{ need: "x", told: "later" }], null]) {
    assert.deepEqual(facts({ ...OLD, requirementsTold: bad }), [own], JSON.stringify(bad));
  }
  // …AND A REFUSAL STORED BEFORE THE LIST: its own sentence only, as before.
  const noList = { ...OLD };
  delete noList.requirementsTold;
  assert.deepEqual(facts(noList), [own]);
  // A SUCCESS READS AS IT ALWAYS DID: set up is set up, and the counted
  // sentences ride as one fact.
  const ok = { ok: true, changed: ["src/routes/index.tsx"], requirementsTold: [{ need: "Each signup is kept", told: "set-up", state: "unverified" }], coverOther: OLD.coverOther, coverNote: "x" };
  assert.deepEqual(facts(ok).slice(1), ["note: Set up, but nothing here can check that it works: Each signup is kept.", "not-done: " + OLD.coverOther]);
});

test("REFUSE 6 — a refusal after a design the database could not wholly carry: the refusal's note and facts say nothing that describes a change that was built — the developer's field keeps the finding", async () => {
  // A FUNCTION DESIGNED FIRST, asking for two guarantees the database does not
  // offer, then a 3D scene the cleaner refuses. On a change that was built the
  // note says "so those aren't in place"; on a refusal nothing is in place.
  const r = await addon("rw-refused-props", "count the visits each night, add a spinning 3D model of our shop to the home page, and let people pay by bank transfer", {
    kinds: ["function", "three"],
    answers: {
      function: { function: [{ name: "count_visits", internal: true, returns: "bigint", body: "SELECT 1", encryptAtRest: true, retries: 3 }] },
      three: { three: { page: "/" }, requirements: [PAY] },
    },
    ...judging([[/bank transfer/, "asked", "no"]]),
  });
  assert.deepEqual([r.status, r.body.error, r.body.cost, r.charges.length], [422, "add", 0, 0], JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.body.invalidProps, ["encryptAtRest", "retries"], "the design's finding is not on the wire — this case tests nothing");
  assert.equal(r.body.coverOther, undefined);
  assert.equal(r.body.coverNote, "One thing your site can't do yet: People can pay by bank transfer — this step cannot take payments.");
  assert.deepEqual(facts(r.body), [refusalFact(r.body), "not-done: Their site cannot do this yet: People can pay by bank transfer (this step cannot take payments)."]);
  assert.doesNotMatch(screen(r.body, false), /guarantee|isn't in place|aren't in place|didn't get built/);
  // …AND ON A CHANGE THAT WAS BUILT, THE SAME FINDING IS TOLD: once, as its own
  // fact beside the requirement's (`coverOther`, the counted sentences).
  const built = await addon("rw-built-props", "count the visits each night, and let people pay by bank transfer", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [{ name: "count_visits", internal: true, returns: "bigint", body: "SELECT 1", encryptAtRest: true, retries: 3 }] },
      job: { job: [{ name: "nightly_count", fn: "count_visits", everyMinutes: 1440, at: "23:00" }], requirements: [PAY] },
    },
    ...judging([[/bank transfer/, "asked", "no"]]),
  });
  assert.equal(built.body.ok, true, JSON.stringify(built.body).slice(0, 300));
  const SAID = "I also asked the database for 2 guarantees it doesn't offer, so those aren't in place.";
  assert.equal(built.body.coverOther, SAID);
  const fb = facts(built.body);
  assert.equal(fb.filter((x) => x === "not-done: " + SAID).length, 1, JSON.stringify(fb));
  assert.equal(fb.filter((x) => x === "not-done: Their site cannot do this yet: People can pay by bank transfer (this step cannot take payments).").length, 1, JSON.stringify(fb));
});

test("ALREADY 1 — \"already there\" means every carrier found was already on the site: a requirement this change helped carry out is set up by it, whichever carrier was named first", () => {
  const ex = existingFacts({ spec: { tables: [{ name: "enquiries", access: "collect", columns: [{ name: "name" }] }] } });
  const made = appliedFacts({ spec: { tables: [{ name: "signups", access: "collect", columns: [{ name: "name" }] }] }, tables: ["signups"] });
  const entry = (by) => ({ id: "table#0", need: "Each visitor's details are kept", status: "covered", from: "table", basis: "asked", words: "w", judged: { follows: "asked", carried: "yes", by, reason: "r" } });
  const opts = { made, existing: ex, reportable: ["table"], judged: true };
  // THE SITE'S OWN TABLE NAMED FIRST, THIS CHANGE'S SECOND: set up by this change.
  const both = requirementOutcomes([entry(["table:enquiries", "table:signups"])], opts)[0];
  assert.deepEqual([both.state, both.foundIn, both.implementedBy], ["unverified", "applied", "signups"]);
  assert.deepEqual(requirementReport([entry(["table:enquiries", "table:signups"])], opts).told.map((o) => o.told), ["set-up"]);
  // ONLY THE SITE'S OWN: already there.
  assert.deepEqual(requirementReport([entry(["table:enquiries"])], opts).told.map((o) => o.told), ["already-there"]);
  // ONLY THIS CHANGE'S: set up, as always.
  assert.deepEqual(requirementReport([entry(["table:signups"])], opts).told.map((o) => o.told), ["set-up"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE CHANGE'S OWN LISTS, EVERY ITEM
// ─────────────────────────────────────────────────────────────────────────────

const PAGES = ["/menu", "/hours", "/team", "/press", "/faq"];
const DEAD = {
  dropped: [{ name: "gallery", route: "/gallery" }, { name: "prints", route: "/prints" }, { name: "menu-code", route: "/menu" }, { name: "hours-code", route: "/hours" }, { name: "gallery", route: "/gallery" }],
  withheld: [{ path: "posters.tsx", added: true }, { path: "flyers.tsx", added: true }, { path: "index.tsx", added: false }, { path: "about.tsx", added: false }, { path: "posters.tsx", added: true }],
  withheldParts: [{ name: "qr-banner", added: true }, { name: "qr-card", added: true }, { name: "footer-band", added: false }, { name: "hero", added: false }],
};
// FIFTEEN SKIPS OVER THIRTEEN TABLES, every reason the engine writes.
const SEEDS = [
  "orders: only display tables are seeded (collect)", "returns: only display tables are seeded (collect)",
  "specials: already has rows", "ghosts: not a table in this schema", "blank: no writable columns",
  "breads row 1: invalid input syntax for type integer", "breads row 1: invalid input syntax for type integer",
  "pies: connection terminated unexpectedly",
  "orders: already has rows", // the same table again: its first reason stands
  ...["t1", "t2", "t3", "t4", "t5", "t6"].map((t) => t + " row 1: refused"),
];
const SEED_WHY = [
  ["orders", "not-display"], ["returns", "not-display"], ["specials", "has-rows"], ["ghosts", "no-table"], ["blank", "no-columns"],
  ["breads", "row-failed"], ["pies", ""], ...["t1", "t2", "t3", "t4", "t5", "t6"].map((t) => [t, "row-failed"]),
];
const FILL = Array.from({ length: 13 }, (_, i) => "ledger_" + (i + 1));
const NO_COUNT = /\band \d+ more\b|more like it/i;

test("WARN 1 — every list above its old cut, at the module: one report entry per thing, sentences naming every one, one fact each; deduplicated as each list always was; each seed skip with the engine's own reason", () => {
  const w = warningReport({ missing: [...PAGES, "/menu"], deadQr: DEAD, seedSkips: SEEDS, noFill: [...FILL, "ledger_1"] });
  // ONE ENTRY PER THING, the repeats said once.
  assert.deepEqual(w.filter((x) => x.what === "page").map((x) => x.name), PAGES);
  assert.deepEqual(w.filter((x) => x.what === "qr").map((x) => [x.name, x.route]), [["gallery", "/gallery"], ["prints", "/prints"], ["menu-code", "/menu"], ["hours-code", "/hours"]]);
  assert.deepEqual(w.filter((x) => x.what === "held-page").map((x) => [x.name, x.added]), [["/posters", true], ["/flyers", true], ["/", false], ["/about", false]]);
  assert.deepEqual(w.filter((x) => x.what === "held-section").map((x) => [x.name, x.added]), [["qr-banner", true], ["qr-card", true], ["footer-band", false], ["hero", false]]);
  assert.deepEqual(w.filter((x) => x.what === "seed").map((x) => [x.name, x.why || ""]), SEED_WHY);
  assert.ok(w.filter((x) => x.what === "seed" && !x.why).every((x) => !Object.hasOwn(x, "why")), "a reason nobody gave rode as an empty one");
  assert.deepEqual(w.filter((x) => x.what === "fill").map((x) => x.name), FILL);
  // …IN THE NOTE'S ORDER.
  assert.deepEqual([...new Set(w.map((x) => x.what))], ["page", "qr", "held-page", "held-section", "seed", "fill"]);
  // THE SENTENCES THE BROWSER PRINTS NAME EVERY ONE, with no count for a name.
  const pages = missingPagesNote(PAGES), dead = deadQrNote(DEAD), seed = seedSkipNote(SEEDS), fill = populationNote(FILL);
  for (const s of [pages, dead, seed, fill]) assert.doesNotMatch(s, NO_COUNT, s);
  assert.match(pages, /^5 pages I set out to add aren't there — \/menu, \/hours, \/team, \/press, \/faq didn't make it through\./);
  assert.match(dead, /^I didn't add the QR codes gallery, prints, menu-code, hours-code — /);
  assert.match(dead, /I've left \/, \/about as they were/);
  assert.match(dead, /I haven't added \/posters, \/flyers either/);
  assert.match(dead, /The footer-band, hero sections are unchanged/);
  assert.match(dead, /And I haven't written the qr-banner, qr-card sections/);
  assert.ok(fill.startsWith("Nothing can put rows into " + FILL.join(", ") + " yet,"), fill);
  // THE DISPLAY-ONLY RULE ONLY OF THE TABLES THE ENGINE SKIPPED FOR IT — and
  // as the rule (2026-10-06, the owner: "a seeding restriction does not prove
  // visitors cannot read the table"), never as a claim about the table.
  assert.equal(seed, "I had starter rows ready for orders, returns and didn't put them in — I only add starter rows to a table anyone can read and no visitor can change."
    + " Not all of the starter rows I had ready for breads, t1, t2, t3, t4, t5, t6 went in."
    + " I had starter rows ready for specials, ghosts, blank, pies and didn't put them in.");
  // THE REPLY MODEL'S FACTS: one per entry, every one not done.
  const body = { ok: true, changed: ["src/routes/index.tsx"], warningsTold: w, coverNote: [pages, dead, seed, fill].join(" ") };
  const f = addonReplyFacts(body).facts.filter((x) => x.kind !== "changed");
  assert.equal(f.length, w.length, JSON.stringify(f.map((x) => x.text)));
  assert.ok(f.every((x) => x.kind === "not-done"), JSON.stringify(f));
  const has = (t) => assert.ok(f.some((x) => x.text === t), "no fact: " + t);
  has("A page this change set out to add did not make it through, so it is not on the site: /faq.");
  has("A QR code was not added, because the page it would open did not make it through: hours-code (it would have opened /hours).");
  has("A new page was not added, because it depended on a QR code that was not added: /flyers.");
  has("Left exactly as it was, because its change depended on a QR code that was not added: /about.");
  has("A new section was not written, because it depended on a QR code that was not added: qr-card.");
  has("A section was left exactly as it was, because its change depended on a QR code that was not added: hero.");
  has("Starter rows were ready for the table returns and were not put in: starter rows only go into tables that anyone can read and visitors cannot change.");
  has("Starter rows were ready for the table specials and were not put in: it already had rows.");
  has("Starter rows were ready for a table called ghosts and were not put in: the site has no table by that name.");
  has("Starter rows were ready for the table blank and were not put in: it has no columns they could go in.");
  has("Not every starter row for the table t6 went in: the database refused at least one.");
  has("Starter rows were ready for the table pies and were not put in.");
  has("Nothing can put rows into the table ledger_13 yet, so whatever reads it shows nothing until something does (a form, an import, or the owner adding the first rows).");
  // NOT THE SENTENCES BESIDE THEM: each thing is said once, as its own fact.
  assert.ok(!f.some((x) => /pages I set out|I didn't add the QR|I had starter rows|Nothing can put rows into ledger_1,/.test(x.text)), JSON.stringify(f));
  // …AND "STARTS EMPTY" IS NEVER SAID OF A TABLE THAT ALREADY HAD ROWS.
  assert.ok(!f.some((x) => /specials/.test(x.text) && /empty|cannot change/.test(x.text)));
});

test("WARN 2 — the reply writer's own completeness check holds the model to every item: the last left out is asked for again by its id, and left out twice the reply is never used", async () => {
  const w = warningReport({ missing: PAGES, deadQr: DEAD, seedSkips: SEEDS, noFill: FILL });
  const f = addonReplyFacts({ ok: true, changed: ["src/routes/index.tsx"], warningsTold: w }).facts;
  const last = f.find((x) => x.text.endsWith("ledger_13 yet, so whatever reads it shows nothing until something does (a form, an import, or the owner adding the first rows)."));
  assert.ok(last, "the last item has no fact — this case tests nothing");
  const said = (covers) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: REPLY_TOOL.name, input: { reply: "What happened, in the model's own words.", covers } }], usage: { input_tokens: 40, output_tokens: 20 } });
  const all = f.map((x) => x.id);
  const without = all.filter((id) => id !== last.id);
  const run = async (answers) => {
    const sent = [];
    const out = await writeReply({ send: async (req) => { sent.push(req); return answers[sent.length - 1]; } }, { facts: f, model: "m" });
    return { out, sent };
  };
  const once = await run([said(all)]);
  for (const x of f) assert.ok(String(once.sent[0].messages[0].content).includes("[" + x.id + "] " + x.text), "the model was not shown " + x.text);
  const again = await run([said(without), said(all)]);
  assert.deepEqual([again.out.ok, again.out.attempts], [true, 2]);
  assert.match(String(again.sent[1].messages[0].content), new RegExp("YOUR LAST REPLY LEFT OUT " + last.id + "\\b"));
  const twice = await run([said(without), said(without)]);
  assert.deepEqual([twice.out.ok, twice.out.why, twice.out.attempts], [false, "uncovered", 2]);
});

test("WARN 3 — six pages asked for and one written, through the route: every missing page on the answer, a fact of its own, in the note and on the screen", async () => {
  const r = await addon("rw-pages", "add a gallery page and menu, hours, team, press and faq pages", {
    kinds: ["page"], publishes: true, written: [writtenPage("/gallery")],
    answers: { page: { page: [PAGE("/gallery", "Gallery"), ...PAGES.map((p) => PAGE(p, p.slice(1)))] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual(r.body.missingPages, PAGES);
  assert.deepEqual(r.body.warningsTold, PAGES.map((p) => ({ what: "page", name: p })));
  assert.deepEqual(facts(r.body).filter((x) => /did not make it through/.test(x)),
    PAGES.map((p) => "not-done: A page this change set out to add did not make it through, so it is not on the site: " + p + "."));
  const said = screen(r.body, true);
  assert.match(said, /5 pages I set out to add aren't there — \/menu, \/hours, \/team, \/press, \/faq didn't make it through\./);
  assert.doesNotMatch(said, NO_COUNT);
});

const shows = (p) => ({ ...p, source: p.source.replace("<h1>", "<img src={SITE_QRS.gallery.src} /><h1>") });
const PRINTS = ["/posters", "/flyers", "/cards", "/stickers", "/banners"];
const QR_ANSWERS = {
  page: { page: [PAGE("/gallery", "Gallery"), ...PRINTS.map((p) => PAGE(p, p.slice(1)))] },
  qr: { qr: { name: "gallery", points: "/gallery", label: "Our gallery", page: "/posters" } },
};

test("WARN 4 — a code whose page did not come, shown on five new pages, through the route: the code, every page that went with it and every page that did not come is a fact of its own and on the screen; and the refusal when nothing else was left names the page the code was for", async () => {
  // ONE CODE PER ADDITION (the qr designer answers one), so what can pass the
  // old cut is what goes WITH it: here five new pages that only showed it.
  const r = await addon("rw-qr-held", "add a gallery page and five print pages, each with a QR code that opens the gallery", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: [...PRINTS.map((p) => shows(writtenPage(p))), addedTo("/", "<p>See our prints.</p>")],
    answers: QR_ANSWERS,
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  const GONE = ["/gallery", ...PRINTS];
  assert.deepEqual(r.body.warningsTold, [
    ...GONE.map((p) => ({ what: "page", name: p })),
    { what: "qr", name: "gallery", route: "/gallery" },
    ...PRINTS.map((p) => ({ what: "held-page", name: p, added: true })),
  ]);
  const f = facts(r.body);
  for (const p of GONE) assert.ok(f.includes("not-done: A page this change set out to add did not make it through, so it is not on the site: " + p + "."), p);
  assert.ok(f.includes("not-done: A QR code was not added, because the page it would open did not make it through: gallery (it would have opened /gallery)."));
  for (const p of PRINTS) assert.ok(f.includes("not-done: A new page was not added, because it depended on a QR code that was not added: " + p + "."), p);
  const said = screen(r.body, true);
  assert.match(said, /I haven't added \/posters, \/flyers, \/cards, \/stickers, \/banners either/);
  assert.doesNotMatch(said, NO_COUNT);
  // NOTHING ELSE LEFT: the refusal names the page the code was going to open,
  // where it said only "that page", and every page withheld with it.
  const z = await addon("rw-qr-refused", "add a gallery page and five print pages, each showing a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, sitePages: ["/"],
    written: PRINTS.map((p) => shows(writtenPage(p))),
    answers: QR_ANSWERS,
  });
  assert.deepEqual([z.status, z.body.error, z.body.cost, z.charges.length], [422, "qr-dependency", 0, 0], JSON.stringify(z.body).slice(0, 300));
  assert.deepEqual(z.body.missingPages, ["/gallery"]);
  assert.match(z.body.msg, /^One page I set out to add isn't there — \/gallery didn't make it through/);
  assert.match(z.body.msg, /I haven't added \/posters, \/flyers, \/cards, \/stickers, \/banners either/);
  // RE-ANCHORED 2026-10-06: the refusal carries the shared outcome reporting
  // too (`aFail`), so the code and every page withheld with it are a fact of
  // their own beside the refusal's quoted sentence — and nothing changed.
  assert.deepEqual(facts(z.body), [
    refusalFact(z.body),
    "not-done: A QR code was not added, because the page it would open did not make it through: gallery (it would have opened /gallery).",
    ...PRINTS.map((p) => "not-done: A new page was not added, because it depended on a QR code that was not added: " + p + "."),
  ]);
  assert.deepEqual(z.body.outcome, { state: "none", published: false, database: "none" });
  // THE SCREEN SAYS EACH ONCE: the refusal's own sentence already says the
  // code and its pages, so its note leaves them out.
  assert.equal(z.body.coverNote, "");
  assert.equal(screen(z.body, false), "⚠️ " + z.body.msg);
});

test("WARN 5 — seed skips and empty tables through the route, past every old cut: eighteen refused rows over six tables, a skip for who can read a table beside one for a table that already had rows, and five tables nothing can fill — every one on the answer, a fact of its own, and on the screen", async () => {
  // EIGHTEEN SKIPS: the route kept the first twelve, which lost two tables.
  const LISTS = ["breads", "cakes", "pies", "tarts", "buns", "rolls"];
  const rows = await addon("rw-seed-rows", "add price lists for breads, cakes, pies, tarts, buns and rolls", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/prices")],
    rowFail: new RegExp("^(" + LISTS.join("|") + ")$"),
    answers: {
      table: { table: LISTS.map((n) => ({ table: { name: n, access: "display", columns: [{ name: "price", type: "integer" }] }, seed: [{ price: "one pound" }, { price: "two pounds" }, { price: "three pounds" }] })) },
      page: { page: [PAGE("/prices", "Prices")] },
    },
  });
  assert.equal(rows.body.ok, true, JSON.stringify(rows.body).slice(0, 400));
  // RE-ANCHORED 2026-10-07: EVERY ROW OF EACH TABLE WAS REFUSED, so each table
  // is said as none of its rows going in — "not every row went in" read as
  // some having gone in. The answer carries every refused row (each by its
  // place in the design) and the line for each table.
  assert.equal(rows.body.seedSkips.length, 24, "not every refused row is on the answer: " + JSON.stringify(rows.body.seedSkips));
  for (const n of LISTS) {
    assert.deepEqual(rows.body.seedSkips.filter((x) => x.startsWith(n + " row ")).map((x) => x.split(":")[0]), [1, 2, 3].map((i) => n + " row " + i), n + ": a refused row was not numbered by its place");
    assert.ok(rows.body.seedSkips.includes(n + ": none of its 3 starter rows went in"), n);
  }
  // EACH TABLE FROM THE ENGINE'S ROW-BY-ROW RECORD (2026-10-07): one entry, every row by its place.
  assert.deepEqual(rows.body.warningsTold, LISTS.map((n) => ({ what: "seed", name: n, why: "rows", rows: { designed: 3, cap: 12, inserted: [], refused: [1, 2, 3], unusable: [], unattempted: 0 } })));
  // THE EVIDENCE, NOT A SENTENCE: each table's one account names its three rows and the places refused, and claims none went in.
  for (const n of LISTS) {
    const one = facts(rows.body).filter((t) => t.startsWith("not-done: ") && t.includes(" " + n + ":") && /starter rows/i.test(t));
    assert.equal(one.length, 1, n + ": " + JSON.stringify(facts(rows.body)));
    assert.ok(one[0].includes("3") && one[0].includes("1–3") && /\bnone\b/i.test(one[0]) && !/only the first/i.test(one[0]), one[0]);
    const said = screen(rows.body, true).split(/(?<=\.)\s+/).filter((x) => x.includes(" " + n + " "));
    assert.equal(said.length, 1, n + ": " + screen(rows.body, true));
    assert.ok(said[0].includes("3") && said[0].includes("1–3") && /\bnone\b/i.test(said[0]), said[0]);
  }
  assert.doesNotMatch(screen(rows.body, true), /Not all of the starter rows/);
  // WHO CAN READ IT, BESIDE A TABLE THAT ALREADY HAD ROWS — two reasons, each its own.
  const COLLECT = ["orders", "returns", "reviews", "requests", "waitlist"];
  const two = await addon("rw-seed-reasons", "add order, return, review, request and waitlist forms, and put soup and bread on the specials", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/forms")],
    stored: { tables: [{ name: "specials", access: "display", columns: [{ name: "dish", type: "text" }] }], functions: [], apis: [], jobs: [] },
    db: rowsDb({ tables: { specials: { columns: [{ name: "id", type: "integer" }, { name: "dish" }], rows: [{ id: 1, dish: "Soup" }] } } }),
    answers: {
      table: { table: [...COLLECT.map((n) => ({ table: { name: n, access: "collect", columns: [{ name: "who", type: "text" }] }, seed: [{ who: "Sam" }] })), { table: { name: "specials", access: "display", columns: [{ name: "dish", type: "text" }] }, seed: [{ dish: "Soup" }, { dish: "Bread" }] }] },
      page: { page: [PAGE("/forms", "Forms")] },
    },
  });
  assert.equal(two.body.ok, true, JSON.stringify(two.body).slice(0, 400));
  assert.deepEqual(two.body.warningsTold, [...COLLECT.map((n) => ({ what: "seed", name: n, why: "not-display" })), { what: "seed", name: "specials", why: "has-rows" }]);
  const f2 = facts(two.body);
  assert.ok(f2.includes("not-done: Starter rows were ready for the table specials and were not put in: it already had rows."), JSON.stringify(f2));
  const s2 = screen(two.body, true);
  assert.match(s2, /I had starter rows ready for orders, returns, reviews, requests, waitlist and didn't put them in — I only add starter rows to a table anyone can read and no visitor can change\. I had starter rows ready for specials and didn't put them in\./);
  // FIVE TABLES NOTHING CAN FILL, read by a function this change adds.
  const LEDGERS = ["stock", "suppliers", "invoices", "payouts", "audits"];
  const fill = await addon("rw-fill", "keep a stock, supplier, invoice, payout and audit ledger and count them", {
    kinds: ["table", "function", "page"], publishes: true, written: [writtenPage("/ledgers")],
    answers: {
      table: { table: LEDGERS.map((n) => ({ table: { name: n, access: "admin", columns: [{ name: "note", type: "text" }] } })) },
      function: { function: [{ name: "ledger_count", internal: true, returns: "bigint", body: "SELECT " + LEDGERS.map((n) => "(SELECT COUNT(*) FROM " + n + ")").join(" + ") }] },
      page: { page: [PAGE("/ledgers", "Ledgers")] },
    },
  });
  assert.equal(fill.body.ok, true, JSON.stringify(fill.body).slice(0, 400));
  assert.deepEqual(fill.body.noPopulation, LEDGERS);
  assert.deepEqual(fill.body.warningsTold, LEDGERS.map((n) => ({ what: "fill", name: n })));
  assert.equal(facts(fill.body).filter((x) => /^not-done: Nothing can put rows into the table /.test(x)).length, 5);
  assert.match(screen(fill.body, true), /Nothing can put rows into stock, suppliers, invoices, payouts, audits yet/);
});

test("WARN 6 — mixed: requirements left undone, pages that did not come and a table's skipped starter rows in one answer, through the route — each a fact of its own, once, and all of it on the screen", async () => {
  const NEEDS = ["Each signup gets a confirmation email", "The owner gets a text for each signup", "Signups are sent to the mailing list", "The signups are counted every hour"];
  const r = await addon("rw-mixed", "Add a signup form that keeps each signup, and menu, hours, team and press pages", {
    kinds: ["table", "page"], publishes: true, written: [writtenPage("/sign-up")],
    answers: {
      table: { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }, { name: "email", type: "text" }] }, seed: [{ name: "Sam", email: "sam@example.com" }] }], requirements: NEEDS.map((need) => ({ need, status: "covered", by: "signups", item: "signups", kind: "table" })) },
      page: { page: [PAGE("/sign-up", "Sign up"), ...PAGES.slice(0, 4).map((p) => PAGE(p, p.slice(1)))] },
    },
    ...judging([[/./, "asked", "no"]]),
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), NEEDS.map((n) => ["still-to-do", n]));
  assert.deepEqual(r.body.warningsTold, [...PAGES.slice(0, 4).map((p) => ({ what: "page", name: p })), { what: "seed", name: "signups", why: "not-display" }]);
  const f = facts(r.body);
  for (const n of NEEDS) assert.equal(f.filter((x) => x.includes(n)).length, 1, n);
  for (const p of PAGES.slice(0, 4)) assert.equal(f.filter((x) => x.endsWith(": " + p + ".")).length, 1, p);
  assert.equal(f.filter((x) => /signups and were not put in/.test(x)).length, 1);
  assert.equal(replyOutcomeOf(addonReplyFacts(r.body)), "partly");
  const said = screen(r.body, true);
  for (const t of [...NEEDS, ...PAGES.slice(0, 4), "starter rows ready for signups"]) assert.ok(said.includes(t), "the screen lost " + t);
  assert.doesNotMatch(said, NO_COUNT);
});

test("WARN 7 — the whole path in a request: an addition whose pages did not all come, its answer stored by its job and read back, and its reply written in the background — every missing page given to the writer as its own fact and named in the reply it keeps", async () => {
  const DESC = "Change the site description to say we bake overnight sourdough";
  const ADD = "add gallery, menu, hours, team, press and faq pages";
  const compiler = installCompiler();
  const P = platform({
    slug: "rw-req-pages-" + Math.random().toString(16).slice(2, 8), replies: true,
    answers: {
      route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }],
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": "Overnight sourdough from a Bristol side street.",
      [T.adds]: { kinds: ["page"] },
      "add:page": { page: [PAGE("/gallery", "Gallery"), ...PAGES.map((p) => PAGE(p, p.slice(1)))] },
      [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  });
  try {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const { rec } = await settle(P, r.key);
    await pump(P);
    // THE ADDITION IS PARTLY DONE: one page of six came.
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "partial"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    // THE STORED ANSWER: every missing page, whole.
    const answer = P.answerOf(job);
    assert.deepEqual(answer.warningsTold, PAGES.map((p) => ({ what: "page", name: p })), JSON.stringify(answer).slice(0, 600));
    // THE WRITER WAS GIVEN EACH, FROM THAT ANSWER, AS ITS OWN FACT…
    const given = P.replyLog.find((fs) => fs.some((x) => x.text.includes("/faq")));
    assert.ok(given, "the background writer never wrote the addition's reply");
    for (const p of PAGES) assert.equal(given.filter((x) => x.text === "A page this change set out to add did not make it through, so it is not on the site: " + p + ".").length, 1, p + ": " + JSON.stringify(given));
    // …AND THE REPLY IT KEPT NAMES EVERY ONE.
    const kept = JSON.parse(P.objects.get("edit-replies/" + job.id + ".json").body);
    assert.equal(kept.state, "written", JSON.stringify(kept).slice(0, 300));
    for (const p of PAGES) assert.ok(String(kept.text).includes(p), "the kept reply lost " + p);
  } finally { P.close(); compiler.uninstall(); }
});

test("WARN 8 — an answer stored before the list reads as it always did, and a list that does not read is the whole note as one fact — on a refusal, nothing", () => {
  const OLD_OTHER = "6 pages I set out to add aren't there — /a, /b, /c and 3 more didn't make it through. Ask me for them again and I'll have another go.";
  const before = { ok: true, changed: ["src/routes/index.tsx"], requirementsTold: [{ need: "Each signup is kept", told: "still-to-do", state: "missing" }], coverOther: OLD_OTHER, coverNote: "Still to do: Each signup is kept. " + OLD_OTHER };
  assert.deepEqual(facts(before).slice(1), ["not-done: Not done: Each signup is kept.", "not-done: " + OLD_OTHER]);
  const w = warningReport({ missing: PAGES });
  const note = "Still to do: Each signup is kept. " + missingPagesNote(PAGES);
  const good = { ok: true, changed: ["src/routes/index.tsx"], requirementsTold: before.requirementsTold, warningsTold: w, coverNote: note };
  assert.equal(facts(good).length, 1 + 1 + PAGES.length);
  for (const bad of [
    [...w, { what: "later", name: "x" }], [...w, { what: "page", name: 5 }], [...w, { what: "seed", name: "t", why: "because" }],
    [...w, { what: "held-page", name: "/x", added: "yes" }], [...w, { what: "qr", name: "q", route: 7 }], [], "pages",
  ]) {
    assert.deepEqual(facts({ ...good, warningsTold: bad }).slice(1), ["not-done: " + note], JSON.stringify(bad).slice(0, 80));
    assert.deepEqual(facts({ ok: false, error: "add", msg: "No.", warningsTold: bad, coverNote: note }), ["not-done: Nothing was added. The builder's own reason: “No.”"], JSON.stringify(bad).slice(0, 80));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE WIRING
// ─────────────────────────────────────────────────────────────────────────────

test("WIRE 1 — the route keeps every seed skip and sends every list whole; both refusals compose their note as refusals; the codes' refusal names the missing page first; the browser prints a refusal's note under its sentence", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const C = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  // LANDMARKS FIRST, so an absence below is about the code and not the reader.
  // RE-ANCHORED 2026-10-06: the coverage takes a failure's outcome (`failed`)
  // where it took `refused`, and every failure after the design composes it
  // through one door (`aFail`).
  for (const at of ['const aCoverage = ({ failed = null, said = "" } = {}) =>', "aSeedSkips = (aSeeded && Array.isArray(aSeeded.skipped))", 'error: "qr-dependency"']) assert.ok(W.includes(at), "landmark gone: " + at);
  assert.ok(W.includes("aSeedSkips = (aSeeded && Array.isArray(aSeeded.skipped)) ? aSeeded.skipped.slice() : [];"), "the seed skips are cut where the engine hands them over");
  assert.match(W, /seedSkips: aSeedSkips\.length \? aSeedSkips : undefined,/);
  assert.match(W, /noPopulation: aNoFill\.length \? aNoFill : undefined,/);
  assert.match(W, /warningsTold: aWarned\.length \? aWarned : undefined,/);
  // …AND WHAT THE DATABASE REFUSED OF THE TABLES (2026-10-07).
  assert.match(W, /const aWarned = warningReport\(\{ missing: aMissing, deadQr: aDeadQr, seedSkips: aSeedSkips, seedRows: aSeedRows, noFill: aNoFill, refused: aRefused \}\);/);
  // AND THE ENGINE'S ROW-BY-ROW RECORD REACHES BOTH (2026-10-07).
  assert.match(W, /seedSkipNote\(aSeedSkips, aSeedRows\),/);
  assert.match(W, /aSeedRows = aSeeded && aSeeded\.rows && typeof aSeeded\.rows === "object" \? aSeeded\.rows : null;/);
  assert.match(W, /coverOther: built && aCounted\.length \? aCounted\.join\(" "\) : undefined,/);
  assert.match(W, /return aFail\(\{ ok: false, error: "add", kind: k, reason: clean\.why, cost: 0, msg: addRefusal\(clean\.why, k\) \}, 422\);/, "the designer's refusal does not compose its note through the failure door");
  assert.match(W, /return aFail\(\{ ok: false, error: "declined", kinds: aDeclined, cost: 0, msg: addRefusal\("nothing"\) \}, 422\);/, "every designer declining does not compose its note through the failure door");
  assert.equal(W.split("aCoverage({ refused: true })").length - 1, 0, "a refusal still composes its note by the old flag");
  assert.match(W, /msg: \[missingPagesNote\(aGone\), deadQrNote\(aDeadQr\)\]\.filter\(Boolean\)\.join\(" "\)\.trim\(\),/);
  // THE BROWSER'S REFUSAL: its sentence, then the note, in all three arms.
  const at = C.indexOf("if (said.act === 'refusal') {");
  assert.ok(at > 0, "the browser's refusal branch is gone");
  const branch = C.slice(at, C.indexOf("return applyAddonResult(a, o);", at));
  assert.equal((branch.match(/\+ cover \+ alsoTail\(a, false\)/g) || []).length, 3, branch.slice(0, 200));
  // …AND THE NOTE ONLY BESIDE THE OUTCOME IT WAS COMPOSED FOR (2026-10-06).
  assert.match(branch, /const cover = failureOutcomeOf\(a\) && typeof a\.coverNote === 'string' && a\.coverNote\.trim\(\) \? ' ' \+ a\.coverNote\.trim\(\) : '';/, "the browser prints a failure's note with no outcome beside it");
});
