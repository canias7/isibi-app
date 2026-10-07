// ─────────────────────────────────────────────────────────────────────────────
// WHAT A FAILED ADDITION LEFT BEHIND, SAID FROM ITS OWN EVIDENCE (2026-10-06)
//
// The owner, on 08b9a657: *"Codex reproduced two gaps … addonAnswer now prints
// an older stored refusal's unsafe coverNote verbatim, producing "I couldn't
// add that" followed by "I've set that up," although addonReplyFacts correctly
// treats that older requirement as already present; and addonReplyFacts
// prefixes a compile failure with "Nothing was added" even when
// migration.status is applied_without_page and migrationNote confirms database
// changes succeeded. Extend the shared outcome reporting across the later
// Add-on failure exits using existing applied, migration and publish evidence.
// Distinguish no changes, partial application, unpublished work and unknown
// outcomes; ok:false alone must never establish that nothing changed or that
// something already existed. Preserve all supported requirement and warning
// outcomes through stored-answer replay, model facts and browser display,
// including when no model-written reply is available. Handle older saved
// answers consistently without trusting their obsolete success wording. Also
// correct the documented seed fallback wording: a seeding restriction does not
// prove visitors cannot read the table."*
//
// WHAT WAS TRUE BEFORE (reproduced first; the red check is in the record):
//   - a publish that failed after the schema apply answered "Nothing was
//     added", quoting a sentence that said the tables were made — and that
//     sentence credited the change with every table the site has;
//   - every later failure carried no requirement or warning outcome at all,
//     and the compile exit's "untouched" and the schema sentence's "your site
//     is untouched" stood beside database changes;
//   - the browser printed an older refusal's note, "I've set that up";
//   - the seed note said a display-only skip "isn't one visitors can read, so
//     it starts empty" of a table visitors read.
//
// These cases run through the modules, the real add-on route, the browser's
// own refusal composer, the real poll route serving a stored answer, and a
// request whose answer is stored by its job and replied to in the background.
// ─────────────────────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addon as routeAddon, writtenPage, SITE_CONN } from "./fixtures/addon-route.mjs";
import { invalidateSiteSchema } from "../site-schema.mjs";
import { connForDatabase } from "../site-db.mjs";
import { failureOutcome, failureNote, replayedCoverNote, seedSkipNote, notLandedMsg } from "../builder/site-add.mjs";
import { addonReplyFacts, replyOutcomeOf, outcomeOf, outcomeReads, toldAs, FAILURE_STATES } from "../builder/site-reply.mjs";
import { migrationNote, newMigration, withApplied, migrationSummary } from "../builder/site-migrations.mjs";
import { planParts, newRequest, nextStep, noteJobId, editJobOutcome, leftOf, leftOfRecord } from "../builder/request.mjs";
import { requestReplyFacts } from "../builder/site-reply.mjs";
/** A record's summary as the driver hands it in, in a given state. */
const migrationSummaryOf = (entry, status) => migrationSummary({ ...entry, status });
import { browserReply } from "../scripts/addon-sweep.mjs";
import { platform, sendMessage, settle, pump, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";

const addon = (slug, msg, opts) => routeAddon(slug + "-" + Math.random().toString(16).slice(2, 7), msg, { ...opts, setup: () => invalidateSiteSchema(connForDatabase(SITE_CONN, "sitedb")) });
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
const NOTHING = { state: "none", published: false, database: "none" };

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE OUTCOME, AT THE MODULES
// ─────────────────────────────────────────────────────────────────────────────

test("OUTCOME 1 — one producer, four states from the evidence, first match wins; every part kept beside the summary; a contradiction reads as no outcome", () => {
  assert.deepEqual(FAILURE_STATES, ["none", "partial", "unpublished", "unknown"]);
  assert.deepEqual(failureOutcome(), NOTHING);
  // WHAT WENT IN, BY NAME — and only when the apply did.
  const made = { tables: ["signups"], altered: ["bookings"], functions: ["count_signups"], apis: [], jobs: ["nightly", ""], extra: ["x"] };
  assert.deepEqual(failureOutcome({ database: "applied", made }),
    { state: "partial", published: false, database: "applied", tables: ["signups"], altered: ["bookings"], functions: ["count_signups"], jobs: ["nightly"] });
  assert.deepEqual(failureOutcome({ database: "none", made }), NOTHING, "names were read off an apply that never ran");
  assert.deepEqual(failureOutcome({ database: "unknown", made, provisioned: true }), { state: "unknown", published: false, database: "unknown", provisioned: true });
  // A DATABASE MADE ALONG THE WAY IS A CHANGE; A SAVED DESIGN AND KEPT PICTURES ARE UNPUBLISHED WORK.
  assert.deepEqual(failureOutcome({ provisioned: true }), { state: "partial", published: false, database: "none", provisioned: true });
  assert.deepEqual(failureOutcome({ saved: true }), { state: "unpublished", published: false, database: "none", saved: true });
  assert.deepEqual(failureOutcome({ photos: 2 }), { state: "unpublished", published: false, database: "none", photos: 2 });
  // PARTLY LIVE AND PARTLY SAVED LOSES NEITHER.
  assert.deepEqual(failureOutcome({ database: "applied", made: { tables: ["t"] }, saved: true, photos: 1 }),
    { state: "partial", published: false, database: "applied", tables: ["t"], saved: true, photos: 1 });
  // ONLY WHAT IS EXACTLY ONE OF ITS OWN READS AS EVIDENCE.
  for (const junk of ["APPLIED", "yes", 1, null]) assert.deepEqual(failureOutcome({ database: junk }), NOTHING);
  assert.deepEqual(failureOutcome({ photos: 1.5 }), NOTHING);
  assert.deepEqual(failureOutcome({ provisioned: "yes", saved: 1 }), NOTHING);
  // THE READER TRUSTS ONLY AN OUTCOME WHOSE SUMMARY ITS FIELDS GIVE.
  for (const o of [failureOutcome(), failureOutcome({ database: "applied", made: { tables: ["t"] } }), failureOutcome({ saved: true, photos: 3 })]) assert.ok(outcomeReads(o), JSON.stringify(o));
  for (const bad of [
    { ...NOTHING, state: "partial" }, { ...NOTHING, published: true }, { ...NOTHING, database: "yes" },
    { state: "partial", published: false, database: "none", tables: ["t"] }, { state: "partial", published: false, database: "applied", tables: [] },
    { ...NOTHING, saved: false }, { ...NOTHING, photos: 0 }, { ...NOTHING, recorded: false }, null, [], "none",
    // NAMES BESIDE AN APPLY THAT NEVER LANDED, each with a summary its other
    // fields do give — so only the names' own rule refuses them.
    { ...NOTHING, tables: ["t"] }, { state: "unknown", published: false, database: "unknown", functions: ["f"] },
    { state: "partial", published: false, database: "none", provisioned: true, jobs: ["j"] },
  ]) assert.equal(outcomeReads(bad), false, JSON.stringify(bad));
});

test("OUTCOME 2 — an answer stored before the outcome is read off what it carries, never off ok:false alone; a requirement told as set up is said by what the failure left", () => {
  assert.equal(outcomeOf({ ok: true }), null);
  assert.equal(outcomeOf(null), null);
  const own = failureOutcome({ database: "applied", made: { tables: ["t"] } });
  assert.equal(outcomeOf({ ok: false, error: "compile", outcome: own }), own);
  // THE DATABASE'S RECORD ON THE ANSWER.
  assert.deepEqual(outcomeOf({ ok: false, error: "compile", migration: { status: "applied_without_page" } }), { state: "partial", published: false, database: "applied" });
  for (const status of ["pending", "failed"]) assert.deepEqual(outcomeOf({ ok: false, error: "schema", migration: { status } }), { state: "unknown", published: false, database: "unknown" });
  // THE TWO STOPS INSIDE THE DESIGN, in every version that wrote them.
  for (const error of ["add", "declined"]) assert.deepEqual(outcomeOf({ ok: false, error }), NOTHING);
  // ANYTHING ELSE IS NOT RECORDED — and a contradictory outcome is no outcome.
  for (const a of [{ ok: false, error: "rewrote" }, { ok: false, error: "compile" }, { ok: false }, { ok: false, error: "compile", outcome: { ...NOTHING, state: "partial" } }]) {
    assert.deepEqual(outcomeOf(a), { state: "unknown", published: false, database: "unknown", recorded: false }, JSON.stringify(a));
  }
  // HOW A REQUIREMENT IS SAID UNDER EACH.
  const set = { told: "set-up" }, sched = { told: "scheduled" }, gone = { told: "still-to-do" };
  assert.equal(toldAs(set, null), "set-up", "a success changed its words");
  assert.equal(toldAs(set, own), "set-up", "a change that went in became the site's own");
  assert.equal(toldAs(set, NOTHING), "already-there");
  assert.equal(toldAs(sched, NOTHING), "already-there");
  assert.equal(toldAs(set, { database: "unknown" }), "unseen", "an apply nobody can read became set up or already there");
  assert.equal(toldAs(gone, NOTHING), "still-to-do");
});

test("SEED 1 — a display-only skip says the rule the engine applied, never that visitors cannot read the table or that it starts empty; one that visitors read and members write is the case that proved it", () => {
  const feed = seedSkipNote(["posts: only display tables are seeded (feed)"]);
  assert.equal(feed, "I had starter rows ready for posts and didn't put them in — I only add starter rows to a table anyone can read and no visitor can change.");
  assert.doesNotMatch(feed, /can't read|isn't one visitors|starts? empty/);
  const two = seedSkipNote(["posts: only display tables are seeded (feed)", "orders: only display tables are seeded (collect)", "specials: already has rows"]);
  assert.equal(two, "I had starter rows ready for posts, orders and didn't put them in — I only add starter rows to a table anyone can read and no visitor can change. I had starter rows ready for specials and didn't put them in.");
  // THE REPLY MODEL'S FACT SAYS THE SAME RULE.
  const f = facts({ ok: true, changed: ["src/routes/index.tsx"], warningsTold: [{ what: "seed", name: "posts", why: "not-display" }] });
  assert.ok(f.includes("not-done: Starter rows were ready for the table posts and were not put in: starter rows only go into tables that anyone can read and visitors cannot change."), JSON.stringify(f));
});

test("NOTES 1 — what no exit's own sentence says it left is said once by the outcome's note; the migration sentence names only what this change made; an addition that did not land says what did not happen when something else did", () => {
  assert.equal(failureNote(NOTHING), "");
  assert.equal(failureNote(failureOutcome({ provisioned: true })), "I did set up a database for your site along the way — nothing from this is stored in it yet.");
  assert.equal(failureNote(failureOutcome({ database: "applied", made: { tables: ["t"] }, provisioned: true })), "", "the database's changes are the migration sentence's to say");
  assert.equal(failureNote(failureOutcome({ photos: 1 })), "The photograph I made for it is in your uploads, though it isn't on your site.");
  assert.equal(failureNote(failureOutcome({ photos: 2 })), "The 2 photographs I made for it are in your uploads, though they aren't on your site.");
  assert.equal(failureNote(failureOutcome({ saved: true })), "", "a saved design is the kept-change sentence's to say");
  // THE MIGRATION SENTENCE: THIS CHANGE'S TABLES, NOT EVERY TABLE THE APPLY RE-RAN.
  const rec = withApplied(newMigration({ job: "j", slug: "s", added: ["signups"], altered: ["bookings"] }), ["bookings", "menu", "signups"]);
  assert.equal(migrationNote({ ...rec, status: "applied_without_page" }),
    "The database changes for this were made — now storing signups, changes to bookings — but the page didn't publish, so the site is showing what it showed before. Ask again and I'll add the page without making the tables twice.");
  const unapplied = withApplied(newMigration({ job: "j", slug: "s", added: ["signups"] }), ["menu"]);
  assert.doesNotMatch(migrationNote({ ...unapplied, status: "applied_without_page" }), /signups/, "a table the engine never reported was named");
  // NOT LANDED.
  assert.match(notLandedMsg({ words: ["Join us"] }), /so nothing on your site changed\./);
  assert.match(notLandedMsg({ words: ["Join us"] }, { changed: true }), /so it wasn't published\. Try again in a moment\.$/);
  assert.doesNotMatch(notLandedMsg({ words: ["Join us"] }, { changed: true }), /nothing on your site changed/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THROUGH THE ROUTE: BEFORE AND AFTER THE APPLY
// ─────────────────────────────────────────────────────────────────────────────

const SIGNUP = "Add a sign-up page where people leave their name and email address";
const STORE = { need: "Each signup is kept so the owner can read them", status: "covered", by: "signups keeps each one", item: "signups", kind: "table", basis: "needed", words: "leave their name and email address" };
const FORM = { need: "A page lets visitors sign up", status: "elsewhere", step: "page", item: "/sign-up", basis: "asked", words: "a sign-up page" };
const SIGNUP_VERDICTS = [[/kept so the owner/, "needed", "yes", ["table:signups"]], [/lets visitors sign up/, "asked", "yes", ["page:/sign-up"]]];
const signupAsk = (slug, extra = {}) => addon(slug, SIGNUP, {
  kinds: ["table", "page"], publishes: true, written: [writtenPage("/sign-up")],
  answers: {
    table: { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }, { name: "email", type: "text" }] }, seed: [] }], requirements: [STORE] },
    page: { page: [PAGE("/sign-up", "Sign up")], requirements: [FORM] },
  },
  ...judging(SIGNUP_VERDICTS), ...extra,
});

test("ROUTE 1 — Codex's second gap: the publish fails AFTER the database changes went in — the outcome is partial, by name; the reply leads with what is live and never 'Nothing was added'; the table's requirement stays set up; the page's is not done; the screen says each once; nothing charged", async () => {
  const r = await signupAsk("fo-after", { notServed: true });
  assert.deepEqual([r.status, r.body.ok, r.body.error, r.body.cost], [422, false, "compile", 0], JSON.stringify(r.body).slice(0, 400));
  assert.equal(r.body.migration.status, "applied_without_page");
  assert.ok(r.sql.some((q) => /CREATE TABLE IF NOT EXISTS "signups"/i.test(q)), "the apply never ran — this case tests nothing");
  assert.deepEqual(r.charges, [], "a failed publish was charged");
  // WHAT IT LEFT, FROM ITS OWN EVIDENCE: this change's table, not the site's own.
  assert.deepEqual(r.body.outcome, { state: "partial", published: false, database: "applied", tables: ["signups"] });
  // THE SENTENCE: what went in, by this change's name, and what did not happen.
  assert.match(r.body.msg, /^The database changes for this were made — now storing signups — but the page didn't publish/);
  assert.doesNotMatch(r.body.msg, /bookings/, "the migration sentence credited this change with a table the site already had");
  assert.match(r.body.msg, /couldn't be put live, so your site is still serving what it was/);
  assert.doesNotMatch(r.body.msg, /nothing was changed|untouched/);
  // EVERY REQUIREMENT, BY WHAT REALLY HAPPENED.
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), [["still-to-do", FORM.need], ["set-up", STORE.need]]);
  // THE REPLY MODEL'S FACTS.
  const f = facts(r.body);
  assert.equal(f[0], "changed: Part of this addition went in and is live: the site now stores signups.");
  assert.equal(f[1], "not-done: The rest of it did not go through: nothing was published, so the site's pages are as they were. The builder's own reason: “" + r.body.msg + "”");
  assert.ok(f.includes("not-done: Not done: " + FORM.need + "."), JSON.stringify(f));
  assert.ok(f.includes("note: Set up, but nothing here can check that it works: " + STORE.need + "."), JSON.stringify(f));
  assert.ok(!f.some((x) => /Nothing was added|already had this/.test(x)), JSON.stringify(f));
  assert.equal(replyOutcomeOf(addonReplyFacts(r.body)), "partly");
  // THE SCREEN WITH NO MODEL REPLY: the sentence, then the note composed for it.
  const said = screen(r.body, false);
  assert.equal(said, "⚠️ " + r.body.msg + " " + r.body.coverNote);
  assert.match(said, /I've set that up, but I can't confirm from here that Each signup is kept/);
  assert.match(said, /Still to do: A page lets visitors sign up\./);
});

test("ROUTE 2 — the same request where the compile fails BEFORE the apply: nothing changed, and the evidence says so; the table's requirement is not done (the table was never made), never set up or already there", async () => {
  const r = await signupAsk("fo-before", { compileFail: true });
  assert.deepEqual([r.status, r.body.error, r.body.cost], [422, "compile", 0], JSON.stringify(r.body).slice(0, 400));
  assert.equal(r.body.migration, undefined, "a record was filed for an apply that never ran");
  assert.ok(!r.sql.some((q) => /CREATE TABLE IF NOT EXISTS "signups"/i.test(q)), "a table was made before a compile that failed");
  assert.deepEqual(r.charges, []);
  assert.deepEqual(r.body.outcome, NOTHING);
  assert.equal(r.body.msg, "That addition didn't compile, so your site is untouched — try describing it differently.");
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), [["still-to-do", STORE.need], ["still-to-do", FORM.need]]);
  const f = facts(r.body);
  assert.deepEqual(f, [
    "not-done: Nothing was added. The builder's own reason: “" + r.body.msg + "”",
    "not-done: Not done: " + STORE.need + ".",
    "not-done: Not done: " + FORM.need + ".",
  ]);
  assert.equal(replyOutcomeOf(addonReplyFacts(r.body)), "not-done");
  assert.equal(screen(r.body, false), "⚠️ " + r.body.msg + " " + r.body.coverNote);
  assert.doesNotMatch(r.body.coverNote, /I've set that up|already had/);
});

test("ROUTE 2b — a design that would alter a table the site already has, and a compile that fails before the apply: nothing of the alteration counts as applied — the requirement it carries is never called set up; and an addition already true says nothing changed by its evidence", async () => {
  const PARTY = { need: "Each booking keeps the party size", status: "covered", by: "bookings keeps it", item: "bookings", kind: "table", basis: "asked", words: "how many people are coming" };
  const r = await addon("fo-altered", "ask how many people are coming on the booking page", {
    kinds: ["table", "page"], publishes: true, compileFail: true, written: [writtenPage("/book")],
    answers: {
      table: { table: [{ table: { name: "bookings", access: "user", columns: [{ name: "who", type: "text" }, { name: "slot", type: "text" }, { name: "phone", type: "text" }, { name: "party_size", type: "integer" }] } }], requirements: [PARTY] },
      page: { page: [PAGE("/book", "Book")] },
    },
    ...judging([[/party size/, "asked", "yes", ["table:bookings"]]]),
  });
  assert.deepEqual([r.body.error, r.body.cost], ["compile", 0], JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.body.outcome, NOTHING);
  assert.ok(!r.sql.some((q) => /ALTER TABLE/i.test(q)), "the alteration ran before a compile that failed");
  const told = r.body.requirementsTold.find((o) => o.need === PARTY.need);
  assert.ok(told, JSON.stringify(r.body.requirementsTold));
  assert.notEqual(told.told, "set-up", "an alteration that never ran was counted as this change's work");
  assert.ok(!facts(r.body).some((x) => /Set up, but/.test(x)), JSON.stringify(facts(r.body)));
  // AN ADDITION ALREADY TRUE — refused before anything, and said so by its outcome.
  const a = await addon("fo-already", "add a 3D scene to the front page", {
    kinds: ["three"], publishes: true, sitePages: ["/"], look: { three: "a globe that was always there" },
    answers: { three: { three: { scene: "a second scene", page: "/" } } },
  });
  assert.deepEqual([a.body.error, a.body.outcome], ["already", NOTHING], JSON.stringify(a.body).slice(0, 300));
  assert.equal(facts(a.body)[0], "not-done: Nothing was added. The builder's own reason: “" + a.body.msg + "”");
});

test("ROUTE 3 — the apply stops part-way: what went in is not known, and nothing says the site is untouched; the table's requirement is unseen, the page's not done; ours, so no model reply, and the screen says it", async () => {
  const r = await signupAsk("fo-partway", { tableFail: "signups" });
  assert.deepEqual([r.status, r.body.error, r.body.ours, r.body.cost], [502, "schema", true, 0], JSON.stringify(r.body).slice(0, 400));
  assert.equal(r.body.migration.status, "failed");
  assert.deepEqual(r.charges, []);
  assert.deepEqual(r.body.outcome, { state: "unknown", published: false, database: "unknown" });
  assert.equal(r.body.msg, "That change needed the site's database and it couldn't be applied — this is on us. Your live pages weren't changed, but some of the database change may already have gone in before it stopped; asking again won't make anything twice. Try again in a few minutes.");
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), [["still-to-do", FORM.need], ["unseen", STORE.need]]);
  assert.equal(addonReplyFacts(r.body).skip, "technical");
  const said = screen(r.body, false);
  assert.equal(said, "⚠️ " + r.body.msg + " " + r.body.coverNote);
  assert.doesNotMatch(said, /untouched|I've set that up/);
  assert.ok(said.includes(STORE.need) && said.includes(FORM.need), said);
});

test("ROUTE 4 — unpublished work: a design that could not be put back is saved and not live; photographs bought before a compile that failed are kept in the uploads — each said, nothing charged", async () => {
  // A CODE ON A NEW PAGE, the publish failing and the put-back refused.
  const CODE = { need: "A QR code opens the menu card", status: "covered", by: "the menu code", item: "menu", kind: "qr", basis: "asked", words: "a QR code that opens it" };
  const card = writtenPage("/menu-card");
  const shows = { ...card, source: card.source.replace("<h1>", "<img src={SITE_QRS.menu.src} /><h1>") };
  const r = await addon("fo-kept", "add a menu card page with a QR code that opens it", {
    kinds: ["page", "qr"], publishes: true, compileFail: true, configFail: 1, written: [shows],
    answers: { page: { page: [PAGE("/menu-card", "Menu card")] }, qr: { qr: { name: "menu", points: "/menu-card", label: "Our menu", page: "/menu-card" }, requirements: [CODE] } },
    ...judging([[/opens the menu card/, "asked", "yes", ["qr:menu"]]]),
  });
  assert.deepEqual([r.status, r.body.error, r.body.cost, r.charges.length], [422, "compile", 0, 0], JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual(r.body.outcome, { state: "unpublished", published: false, database: "none", saved: true });
  assert.match(r.body.msg, /^That addition didn't compile, so your live site wasn't changed — try describing it differently\. The change itself is still saved, though, so it could go out with your next edit\.$/);
  const f = facts(r.body);
  assert.equal(f[0], "not-done: The addition did not go through: nothing was published, so the site's pages are as they were. The builder's own reason: “" + r.body.msg + "”");
  assert.ok(f.includes("note: The change itself is still saved, so it could go out with their next edit."), JSON.stringify(f));
  assert.ok(!f.some((x) => /Nothing was added/.test(x)), JSON.stringify(f));
  // THE CODE IS SAVED AND NOT LIVE: the requirement it carries is not done.
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), [["still-to-do", CODE.need]]);
  // A PHOTOGRAPH BOUGHT, THEN A COMPILE THAT FAILED.
  const DESK = "the workshop bench under the window, warm afternoon light";
  const g = await addon("fo-photo", "add a gallery page showing photos of our work", {
    kinds: ["page", "photo"], publishes: true, compileFail: true, credits: 400,
    written: [{ path: "src/routes/gallery.tsx", source: "import { createFileRoute } from '@tanstack/react-router'\nimport { SafeImage } from '@/components/ui/safe-image'\nexport const Route = createFileRoute('/gallery')({ component: P })\nfunction P(){ return <main><h1>Gallery</h1><SafeImage src=\"@@IMG:" + DESK + "@@\" alt=\"the workshop bench\" /></main> }\n" }],
    answers: { page: { page: [PAGE("/gallery", "Gallery")] }, photo: { photo: [{ page: "/gallery", describe: DESK, name: "bench" }] } },
  });
  assert.deepEqual([g.body.error, g.body.cost, g.charges.length], ["compile", 0, 0], JSON.stringify(g.body).slice(0, 400));
  assert.equal(g.shots.length, 1, "no photograph was bought — this case tests nothing");
  assert.deepEqual(g.body.outcome, { state: "unpublished", published: false, database: "none", photos: 1 });
  assert.match(g.body.coverNote, /The photograph I made for it is in your uploads, though it isn't on your site\./);
  assert.ok(facts(g.body).includes("note: The photograph made for it is saved in their uploads; it is not on the site."), JSON.stringify(facts(g.body)));
  assert.match(screen(g.body, false), /in your uploads, though it isn't on your site/);
});

test("ROUTE 5 — a database made along the way and then a stop before anything went into it: a change, said as one — never 'Nothing was added'", async () => {
  const r = await addon("fo-provisioned", "keep a list of repairs", {
    backend: "none", provisions: true, kinds: ["table"], publishes: true, written: [],
    answers: { table: { table: [{ table: { name: "repairs", columns: [{ name: "who", type: "text" }] } }] } },
  });
  assert.equal(r.body.ok, false, JSON.stringify(r.body).slice(0, 300));
  assert.ok(r.neonCalls.length > 0, "nothing was provisioned — this case tests nothing");
  assert.deepEqual(r.body.outcome, { state: "partial", published: false, database: "none", provisioned: true });
  const f = facts(r.body);
  assert.equal(f[0], "changed: The site has its own database now, made for this addition; nothing from it is stored in it yet.");
  assert.match(f[1], /^not-done: The rest of it did not go through: nothing was published, so the site's pages are as they were\. The builder's own reason: /);
  assert.ok(!f.some((x) => /Nothing was added/.test(x)), JSON.stringify(f));
  assert.equal(replyOutcomeOf(addonReplyFacts(r.body)), "partly");
  // …AND A COMPILE THAT FAILS AFTER THE DATABASE WAS MADE: never "untouched".
  const c = await addon("fo-prov-compile", "keep a list of repairs and show it", {
    backend: "none", provisions: true, kinds: ["table", "page"], publishes: true, compileFail: true, written: [writtenPage("/repairs")],
    answers: { table: { table: [{ table: { name: "repairs", columns: [{ name: "who", type: "text" }] } }] }, page: { page: [PAGE("/repairs", "Repairs")] } },
  });
  assert.deepEqual([c.body.error, c.body.outcome], ["compile", { state: "partial", published: false, database: "none", provisioned: true }], JSON.stringify(c.body).slice(0, 300));
  assert.equal(c.body.msg, "That addition didn't compile, so it wasn't published — try describing it differently.");
  assert.equal(c.body.coverNote, "I did set up a database for your site along the way — nothing from this is stored in it yet.");
});

test("ROUTE 6 — a judgment that did not finish stops before anything is applied or charged: no outcome is claimed for a requirement nobody established, and the screen says only its own sentence", async () => {
  const r = await signupAsk("fo-unfinished", { judge: () => ({ verdicts: [] }) });
  assert.deepEqual([r.body.ok, r.body.error, r.body.cost], [false, "send", 0], JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.charges, []);
  assert.ok(!r.sql.some((q) => /CREATE TABLE/i.test(q)), "a judgment that did not finish let the apply run");
  assert.equal(r.body.requirementsTold, undefined);
  // NOTHING CHANGED, BY WHERE IT STOPPED — never read off \`ok: false\`.
  assert.deepEqual(r.body.outcome, NOTHING);
  assert.equal(addonReplyFacts(r.body).skip, "technical");
  const said = screen(r.body, false);
  assert.equal(said, "⚠️ " + r.body.msg);
  assert.doesNotMatch(said, /set that up|already|Still to do/);
});

test("ROUTE 7 — the site's database cannot be made: nothing changed, by where it stopped; the requirements the judgment settled are told beside it, none set up; ours, so no model reply", async () => {
  // A SITE WITH NO DATABASE has one made for it — and the harness has no Neon
  // to make it in, so the provision itself fails (\`create_project\`).
  const r = await signupAsk("fo-noprov", { backend: "none" });
  assert.deepEqual([r.status, r.body.error, r.body.ours, r.body.cost, r.body.stage], [502, "provision", true, 0, "create_project"], JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual(r.charges, []);
  assert.ok(!r.sql.some((q) => /CREATE TABLE/i.test(q)), "a table was made with no database to hold it");
  assert.deepEqual(r.body.outcome, NOTHING);
  assert.equal(r.body.msg, "That needed a database for your site and one couldn't be made right now — this is on us, and nothing was changed. Try again in a few minutes.");
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), [["still-to-do", STORE.need], ["still-to-do", FORM.need]]);
  assert.equal(addonReplyFacts(r.body).skip, "technical");
  const said = screen(r.body, false);
  assert.equal(said, "⚠️ " + r.body.msg + " " + r.body.coverNote);
  assert.ok(said.includes(STORE.need) && said.includes(FORM.need), said);
  assert.doesNotMatch(said, /I've set that up|already had/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ANSWERS STORED BEFORE THIS, REPLAYED
// ─────────────────────────────────────────────────────────────────────────────

/** A refusal stored before 2026-10-06's outcome: its note said "I've set that up" of what the site already had. */
const OLD_REFUSAL = {
  ok: false, error: "add", kind: "three", cost: 0, msg: "I couldn't add that.",
  coverNote: "I've set that up, but I can't confirm from here that The owner is emailed about each new enquiry — have a look and tell me if it isn't right.",
  requirementsTold: [
    { need: "The owner is emailed about each new enquiry", told: "set-up", state: "unverified" },
    { need: "People can pay by bank transfer", told: "unsupported", state: "failed", why: "this step cannot take payments" },
  ],
  warningsTold: [{ what: "seed", name: "posts", why: "not-display" }],
};

test("REPLAY 1 — Codex's first gap, at the browser: an older refusal's note is never printed; what is shown beside a served outcome is composed by the reply's own rule, so the screen and the facts tell one story", () => {
  // THE RAW STORED BODY: the refusal's sentence, and nothing it cannot vouch for.
  assert.equal(screen(OLD_REFUSAL, false), "⚠️ I couldn't add that.");
  // THE FACTS, AS ACCEPTED: already there, never set up.
  const f = facts(OLD_REFUSAL);
  assert.deepEqual(f, [
    "not-done: Nothing was added. The builder's own reason: “I couldn't add that.”",
    "note: Their site already had this before this request, and nothing here can check that it works: The owner is emailed about each new enquiry.",
    "not-done: Their site cannot do this yet: People can pay by bank transfer (this step cannot take payments).",
    "not-done: Starter rows were ready for the table posts and were not put in: starter rows only go into tables that anyone can read and visitors cannot change.",
  ]);
  // THE NOTE THE POLL HANDS BACK BESIDE ITS OUTCOME (`replayedCoverNote`): the same three.
  const note = replayedCoverNote(OLD_REFUSAL);
  assert.equal(note, "One thing your site can't do yet: People can pay by bank transfer — this step cannot take payments."
    + " Your site already had that in place, but I can't confirm from here that The owner is emailed about each new enquiry — have a look and tell me if it isn't right."
    + " I had starter rows ready for posts and didn't put them in — I only add starter rows to a table anyone can read and no visitor can change.");
  const served = { ...OLD_REFUSAL, outcome: outcomeOf(OLD_REFUSAL), coverNote: note };
  const said = screen(served, false);
  assert.equal(said, "⚠️ I couldn't add that. " + note);
  assert.doesNotMatch(said, /I've set that up/);
  // AN OUTCOME THE BROWSER CANNOT TRUST LEAVES THE NOTE UNSAID.
  for (const bad of [{ ...NOTHING, published: true }, { ...NOTHING, state: "maybe" }, { ...NOTHING, database: "yes" }, "none", []]) {
    assert.equal(screen({ ...served, outcome: bad }, false), "⚠️ I couldn't add that.", JSON.stringify(bad));
  }
  // A LIST THAT DOES NOT READ COMPOSES NOTHING — never the old note.
  assert.equal(replayedCoverNote({ ...OLD_REFUSAL, requirementsTold: [{ need: 5, told: "set-up" }] }), "");
  assert.equal(replayedCoverNote({ ok: false, error: "add", coverNote: "I've set that up." }), "");
});

test("REPLAY 2 — older answers of the later exits: the compile exit's database record is changes that went in (never 'Nothing was added'); a stop with no evidence is said as not recorded; a requirement an older failure told as set up is unseen there, never set up or already there", () => {
  const OLD_COMPILE = {
    ok: false, error: "compile", cost: 0,
    msg: "The database changes for this were made — now storing bookings, signups — but the page didn't publish, so the site is showing what it showed before. Ask again and I'll add the page without making the tables twice. That addition didn't compile, so your site is untouched — try describing it differently.",
    migration: { job: "j", status: "applied_without_page", version: null, tables: ["bookings", "signups"], refused: [], functions: [], functionErrors: [], apis: [], jobs: [] },
  };
  const f = facts(OLD_COMPILE);
  assert.equal(f[0], "changed: Changes to their database for this addition went in and are live.");
  assert.match(f[1], /^not-done: The rest of it did not go through: nothing was published, so the site's pages are as they were\./);
  assert.ok(!f.some((x) => /Nothing was added/.test(x)), JSON.stringify(f));
  assert.equal(replyOutcomeOf(addonReplyFacts(OLD_COMPILE)), "partly");
  assert.equal(screen(OLD_COMPILE, false), "⚠️ " + OLD_COMPILE.msg);
  // A LATER STOP STORED WITH NOTHING TO SAY WHAT IT LEFT.
  const OLD_STOP = {
    ok: false, error: "rewrote", cost: 0, msg: "I couldn't add that without changing what's already on the home page. Nothing was published.",
    coverNote: "I've set that up, but I can't confirm from here that Each signup is kept.",
    requirementsTold: [{ need: "Each signup is kept", told: "set-up", state: "unverified" }],
  };
  const g = facts(OLD_STOP);
  assert.deepEqual(g, [
    "not-done: The addition did not go through: nothing was published, so the site's pages are as they were. The builder's own reason: “" + OLD_STOP.msg + "”",
    "note: This answer does not record whether any part of the addition went in before it stopped, so that cannot be said either way.",
    "not-done: Nothing here can see whether this is in place: Each signup is kept.",
  ]);
  assert.equal(screen(OLD_STOP, false), "⚠️ " + OLD_STOP.msg, "an older stop's note was printed");
  const note = replayedCoverNote(OLD_STOP);
  assert.match(note, /Each signup is kept/);
  assert.doesNotMatch(note, /I've set that up|already had/);
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

test("REPLAY 3 — through the real poll route: a refused addition's job is stored; the same job holding an answer stored before this is served with its outcome read off what it carries and a note composed by the reply's rule — never its old note — and the browser shows that", async () => {
  const PAY = { need: "People can pay by bank transfer", status: "unsupported", why: "this step cannot take payments", basis: "asked", words: "let people pay by bank transfer" };
  const compiler = installCompiler();
  const P = platform({
    slug: "fo-replay-" + Math.random().toString(16).slice(2, 8), replies: true,
    answers: {
      route: [{ intent: "addon" }],
      [T.adds]: { kinds: ["three"] },
      "add:three": { three: { page: "/" }, requirements: [PAY] },
      judge_requirements: requestJudge([[/bank transfer/, "asked", "no"]]),
    },
  });
  try {
    const r = await sendMessage(P, { message: "add a spinning 3D model of our shop to the home page, and let people pay by bank transfer." });
    await settle(P, r.key);
    await pump(P);
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    // THE ANSWER THIS ROUTE STORES CARRIES ITS OUTCOME, and the poll hands it back as stored.
    const now = P.answerOf(job);
    assert.deepEqual([now.ok, now.error, now.outcome], [false, "add", NOTHING]);
    const live = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.deepEqual(live.body.outcome, NOTHING);
    assert.equal(live.body.coverNote, now.coverNote);
    // THE SAME JOB HOLDING AN ANSWER STORED BEFORE THIS.
    job.result = { ...job.result, body: JSON.stringify(OLD_REFUSAL) };
    const old = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.deepEqual(old.body.outcome, NOTHING, "an older answer was served with no outcome");
    assert.equal(old.body.coverNote, replayedCoverNote(OLD_REFUSAL));
    assert.doesNotMatch(old.body.coverNote, /I've set that up/);
    assert.equal(JSON.parse(job.result.body).coverNote, OLD_REFUSAL.coverNote, "the stored answer itself was rewritten");
    const said = screen(old.body, false);
    assert.match(said, /^⚠️ I couldn't add that\. One thing your site can't do yet: People can pay by bank transfer/);
    assert.match(said, /Your site already had that in place/);
    assert.doesNotMatch(said, /I've set that up/);
    // AN OLDER ANSWER WITH NO LIST: its old note is not served at all.
    job.result = { ...job.result, body: JSON.stringify({ ok: false, error: "add", cost: 0, msg: "I couldn't add that.", coverNote: "I've set that up, but I can't confirm that X." }) };
    const bare = await call(P, "GET", "/api/site/edit/" + job.id);
    assert.equal(bare.body.coverNote, undefined, "an older note with nothing to stand in for it was served");
    assert.equal(screen(bare.body, false), "⚠️ I couldn't add that.");
  } finally { P.close(); compiler.uninstall(); }
});

test("QUEUE 1 — a request whose add-on publish fails after its database changes went in: the job's stored answer carries the partial outcome by name, the reply written from it in the background leads with what is live, and the reply it keeps says so", async () => {
  // THE PUBLISH GATE REFUSES (`not-granted`) — after the seam, so the schema is
  // applied, and before the publish begins, so the job is refunded and replied
  // to rather than held for review (a publish that BEGAN and failed is held for
  // review, its reply with it: unchanged, and not this case).
  const compiler = installCompiler();
  const P = platform({
    slug: "fo-queue-" + Math.random().toString(16).slice(2, 8), replies: true,
    db: rowsDb({ tables: {} }),
    answers: {
      route: [{ intent: "addon" }],
      [T.adds]: { kinds: ["table", "page"] },
      "add:table": { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] },
      "add:page": { page: [PAGE("/sign-up", "Sign up")] },
      [T.pages]: { pages: [writtenPage("/sign-up")] },
    },
  });
  try {
    P.failRpc("edit_may_publish");
    const r = await sendMessage(P, { message: SIGNUP + "." });
    await settle(P, r.key);
    await pump(P);
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    assert.ok(job, "no add-on job was filed");
    assert.match(P.answerOf(job).msg, /couldn't be published \(rpc\), so the rest of it wasn't published\./, "the gate did not refuse — this case tests nothing");
    const answer = P.answerOf(job);
    assert.deepEqual([answer.ok, answer.error], [false, "compile"], JSON.stringify(answer).slice(0, 400));
    assert.deepEqual(answer.outcome, { state: "partial", published: false, database: "applied", tables: ["signups"] });
    const given = P.replyLog.find((fs) => fs.some((x) => x.text.startsWith("Part of this addition went in and is live")));
    assert.ok(given, "the background writer was never given what is live: " + JSON.stringify(P.replyLog.slice(-1)));
    assert.ok(!given.some((x) => /Nothing was added/.test(x.text)), JSON.stringify(given));
    const kept = JSON.parse(P.objects.get("edit-replies/" + job.id + ".json").body);
    assert.equal(kept.state, "written", JSON.stringify(kept).slice(0, 300));
    assert.match(String(kept.text), /the site now stores signups/);
  } finally { P.close(); compiler.uninstall(); }
});

test("WIRE 1 — the route's later exits pass what they know: an addition that did not land and a design that could not be saved say what did not happen when a database was made first; every failure after the design answers through the one door", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // THE DOOR IS ASYNC SINCE 2026-10-07: it re-writes the developer record over the failure before it answers.
  for (const at of ["const aFail = async (body, status, { database = \"none\", saved = false, photos = 0 } = {}) => {", 'error: "not-landed"', 'error: "config"']) assert.ok(W.includes(at), "landmark gone: " + at);
  assert.match(W, /msg: notLandedMsg\(\{ words: aWordsAt\.missing, photos: aPhotosAt\.missing \}, \{ changed: aProvisioned \}\),/, "an addition that did not land is not told a database was made first");
  assert.match(W, /return aFail\(\{ ok: false, error: "config", cost: 0, msg: aProvisioned\s*\? "That addition couldn't be saved, so it wasn't published — try again in a moment\."\s*: "That addition couldn't be saved, so your site is untouched — try again in a moment\." \}, 503\);/, "a design that could not be saved still calls the site untouched after a database was made");
  for (const e of ["no-photo", "generate", "unseen-rewrite", "rewrote", "qr-dependency", "not-landed", "lost-photos", "provision"]) {
    assert.ok(new RegExp('aFail\\(\\{\\s*ok: false, error: "' + e + '"').test(W), e + " does not answer through the failure door");
  }
  assert.match(W, /return aFail\(\{\s*ok: false, error: "provision", cost: 0, ours: true,[^}]*?detail: scrubSecrets\([^\n]*\n\s*\}, 502\);/, "the provision's refusal lost its status or its detail on the way through the door");
});

test("WIRE 2 — the model-down stop says nothing changed only where that is true: every caller stands above the backend block, and its answer carries the no-change outcome", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const def = W.indexOf("const aDown = (e, what) => {");
  const backend = W.indexOf("// ── THE BACKEND, ANY TIER OF IT, AND A DATABASE ON FIRST TOUCH ──");
  assert.ok(def > 0 && backend > def, "landmark gone");
  assert.equal(W.indexOf("const aDown = (e, what) => {", def + 1), -1, "a second model-down stop");
  const body = W.slice(def, W.indexOf("}, { status: 503 });", def));
  assert.match(body, /\n\s*outcome: failureOutcome\(\),\n/, "the model-down stop carries no outcome");
  const calls = [];
  for (let i = W.indexOf("aDown("); i >= 0; i = W.indexOf("aDown(", i + 1)) calls.push(i);
  assert.ok(calls.length >= 5, "the callers could not be found: " + calls.length);
  for (const at of calls) assert.ok(at > def && at < backend, "a model-down stop below the backend block, where this run may already have changed something: " + W.slice(at, at + 80));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. A DATABASE MADE, THEN AN APPLY THAT STOPPED PART-WAY (2026-10-06)
//
// The owner, after Codex's review of 13bfcd17: *"failureOutcome({provisioned:
// true,database:"unknown"}) produces a valid unknown outcome, but failureNote
// still says "nothing from this is stored in it yet," and failureFacts uses
// the same unsupported assertion. Codex reproduced the contradiction through
// the actual browser composer alongside ADDON_SCHEMA_FAIL_MSG. State that the
// database was created while preserving uncertainty about what applied; only
// claim that nothing from the addition was applied when the evidence
// establishes database:"none"."*
//
// Both schema exits produce it — the pageless apply and the publish's seam —
// whenever this run made the site's database first.
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA_MSG = "That change needed the site's database and it couldn't be applied — this is on us. Your live pages weren't changed, but some of the database change may already have gone in before it stopped; asking again won't make anything twice. Try again in a few minutes.";
const MADE_UNKNOWN = "I did set up a database for your site along the way, and some of this change may already have gone into it.";
const MADE_NOTHING = "I did set up a database for your site along the way — nothing from this is stored in it yet.";
const UNKNOWN_FACT = "note: Some of its database change may have gone in before it stopped; which parts did could not be established.";
const REPAIRS = { table: [{ table: { name: "repairs", columns: [{ name: "who", type: "text" }] } }] };
/** An internal function and a job over it: a design the pageless path takes. */
const FN = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
const JOB = { name: "daily_reminder", fn: "send_reminder", everyMinutes: 1440, at: "09:00" };

test("PROV 1 — at the modules: a database made beside an apply that stopped part-way is said made, with what went into it not known; 'nothing stored' only where the apply never ran; nothing about it beside an apply that landed", () => {
  const unknown = failureOutcome({ provisioned: true, database: "unknown" });
  assert.deepEqual(unknown, { state: "unknown", published: false, database: "unknown", provisioned: true });
  assert.ok(outcomeReads(unknown));
  // THE NOTE: the screen's own words when no model reply is written.
  assert.equal(failureNote(unknown), MADE_UNKNOWN);
  assert.equal(failureNote({ ...unknown, photos: 2 }), MADE_UNKNOWN + " The 2 photographs I made for it are in your uploads, though they aren't on your site.");
  // ONLY THE EVIDENCE THAT THE APPLY NEVER RAN EARNS "nothing stored".
  assert.equal(failureNote(failureOutcome({ provisioned: true })), MADE_NOTHING);
  for (const database of ["unknown", "maybe", undefined]) {
    assert.doesNotMatch(failureNote({ provisioned: true, database }), /nothing from this/, String(database));
  }
  // AN APPLY THAT LANDED: what is live is the migration sentence's to say.
  assert.equal(failureNote(failureOutcome({ provisioned: true, database: "applied", made: { tables: ["repairs"] } })), "");
  // THE REPLY MODEL'S FACTS, for a stored answer they read.
  const stored = { ok: false, error: "compile", cost: 0, msg: "That addition didn't compile, so it wasn't published — try describing it differently.", outcome: unknown };
  assert.deepEqual(facts(stored), [
    "changed: The site has its own database now, made for this addition.",
    "not-done: The rest of it did not go through: nothing was published, so the site's pages are as they were. The builder's own reason: “" + stored.msg + "”",
    UNKNOWN_FACT,
  ]);
  assert.equal(replyOutcomeOf(addonReplyFacts(stored)), "partly");
  // CONTROLS: the apply never ran; the apply landed.
  assert.equal(facts({ ...stored, outcome: failureOutcome({ provisioned: true }) })[0], "changed: The site has its own database now, made for this addition; nothing from it is stored in it yet.");
  const landed = facts({ ...stored, outcome: failureOutcome({ provisioned: true, database: "applied", made: { tables: ["repairs"] } }) });
  assert.deepEqual(landed.slice(0, 2), ["changed: Part of this addition went in and is live: the site now stores repairs.", "changed: The site has its own database now."]);
  assert.ok(!landed.some((x) => /may have gone in|nothing from it/.test(x)), JSON.stringify(landed));
});

test("PROV 2 — the pageless path: the site's database made, then its apply stops part-way — the outcome is unknown with the database made, and the screen says the database was made and that some of the change may be in it, never that nothing is; ours, so no model reply; nothing charged", async () => {
  const r = await addon("fo-prov-pageless", "remind people the day before", {
    backend: "none", provisions: true, kinds: ["function", "job"],
    // THE ENGINE'S OWN TABLES GO IN, THEN ONE IS REFUSED — on a database this run made.
    sqlFail: /^CREATE TABLE IF NOT EXISTS _errors /,
    answers: { function: { function: [FN] }, job: { job: [JOB] } },
  });
  assert.deepEqual([r.status, r.body.ok, r.body.error, r.body.ours, r.body.cost], [502, false, "schema", true, 0], JSON.stringify(r.body).slice(0, 400));
  assert.ok(r.neonCalls.length > 0, "no database was made — this case tests nothing");
  const secrets = r.sql.findIndex((q) => /^CREATE TABLE IF NOT EXISTS _secrets /.test(q));
  const refused = r.sql.findIndex((q) => /^CREATE TABLE IF NOT EXISTS _errors /.test(q));
  assert.ok(secrets >= 0 && refused > secrets, "nothing went in before the refusal — this is not part-way");
  assert.equal(r.body.migration.status, "failed");
  assert.deepEqual(r.charges, []);
  assert.deepEqual(r.body.outcome, { state: "unknown", published: false, database: "unknown", provisioned: true });
  assert.equal(r.body.msg, SCHEMA_MSG);
  assert.equal(r.body.coverNote, MADE_UNKNOWN);
  const said = screen(r.body, false);
  assert.equal(said, "⚠️ " + SCHEMA_MSG + " " + MADE_UNKNOWN);
  assert.doesNotMatch(said, /nothing from this|untouched/);
  assert.equal(addonReplyFacts(r.body).skip, "technical");
});

test("PROV 3 — the publish path: the site's database made, then the apply at the publish's seam stops part-way — the same outcome and the same sentence beside the schema's; each requirement by what is known (the table's unseen, the page's not done)", async () => {
  const r = await signupAsk("fo-prov-publish", { backend: "none", provisions: true, tableFail: "signups" });
  assert.deepEqual([r.status, r.body.error, r.body.ours, r.body.cost], [502, "schema", true, 0], JSON.stringify(r.body).slice(0, 400));
  assert.ok(r.neonCalls.length > 0, "no database was made — this case tests nothing");
  assert.ok(r.sql.some((q) => /CREATE TABLE IF NOT EXISTS "signups"/i.test(q)), "the apply never reached the table — this case tests nothing");
  assert.equal(r.body.migration.status, "failed");
  assert.deepEqual(r.charges, []);
  assert.deepEqual(r.body.outcome, { state: "unknown", published: false, database: "unknown", provisioned: true });
  assert.equal(r.body.msg, SCHEMA_MSG);
  assert.deepEqual(r.body.requirementsTold.map((o) => [o.told, o.need]), [["still-to-do", FORM.need], ["unseen", STORE.need]]);
  assert.ok(r.body.coverNote.endsWith(" " + MADE_UNKNOWN), r.body.coverNote);
  const said = screen(r.body, false);
  assert.equal(said, "⚠️ " + SCHEMA_MSG + " " + r.body.coverNote);
  assert.ok(said.includes(STORE.need) && said.includes(FORM.need), said);
  assert.doesNotMatch(said, /nothing from this|untouched|I've set that up/);
  assert.equal(addonReplyFacts(r.body).skip, "technical");
});

test("PROV 4 — controls through the route: a database made and an apply that landed before the publish failed says what is live by name and the database plainly, with no doubt and no 'nothing stored'; a database made and a stop before any apply keeps 'nothing from this is stored in it yet'", async () => {
  const shows = { table: REPAIRS, page: { page: [PAGE("/repairs", "Repairs")] } };
  const r = await addon("fo-prov-landed", "keep a list of repairs and show it", {
    backend: "none", provisions: true, kinds: ["table", "page"], publishes: true, notServed: true, written: [writtenPage("/repairs")], answers: shows,
  });
  assert.deepEqual([r.status, r.body.error, r.body.cost], [422, "compile", 0], JSON.stringify(r.body).slice(0, 400));
  assert.ok(r.neonCalls.length > 0, "no database was made — this case tests nothing");
  assert.equal(r.body.migration.status, "applied_without_page");
  assert.deepEqual(r.body.outcome, { state: "partial", published: false, database: "applied", tables: ["repairs"], provisioned: true });
  assert.match(r.body.msg, /^The database changes for this were made — now storing repairs — but the page didn't publish/);
  assert.doesNotMatch(String(r.body.coverNote || ""), /nothing from this|may already have gone into it/);
  const f = facts(r.body);
  assert.deepEqual(f.slice(0, 2), ["changed: Part of this addition went in and is live: the site now stores repairs.", "changed: The site has its own database now."]);
  assert.ok(!f.some((x) => /may have gone in|nothing from it/.test(x)), JSON.stringify(f));
  // …AND A STOP BEFORE ANY APPLY: nothing from this is stored, as the evidence says.
  const c = await addon("fo-prov-before", "keep a list of repairs and show it", {
    backend: "none", provisions: true, kinds: ["table", "page"], publishes: true, compileFail: true, written: [writtenPage("/repairs")], answers: shows,
  });
  assert.ok(!c.sql.some((q) => /CREATE TABLE IF NOT EXISTS "repairs"/i.test(q)), "the apply ran before a compile that failed");
  assert.deepEqual(c.body.outcome, { state: "partial", published: false, database: "none", provisioned: true });
  assert.equal(c.body.coverNote, MADE_NOTHING);
  assert.equal(screen(c.body, false), "⚠️ " + c.body.msg + " " + MADE_NOTHING);
  assert.equal(facts(c.body)[0], "changed: The site has its own database now, made for this addition; nothing from it is stored in it yet.");
});

test("PROV 5 — stored and replayed: the route's answer for a database made and an apply that stopped part-way is served by the real poll route as stored, and the browser with no model reply shows the database made with what went in not known; a stored answer the facts do read says the same", async () => {
  const pub = await signupAsk("fo-prov-stored", { backend: "none", provisions: true, tableFail: "signups" });
  assert.deepEqual([pub.body.error, pub.body.outcome && pub.body.outcome.provisioned], ["schema", true], JSON.stringify(pub.body).slice(0, 300));
  const PAY = { need: "People can pay by bank transfer", status: "unsupported", why: "this step cannot take payments", basis: "asked", words: "let people pay by bank transfer" };
  const compiler = installCompiler();
  const P = platform({
    slug: "fo-prov-replay-" + Math.random().toString(16).slice(2, 8), replies: true,
    answers: {
      route: [{ intent: "addon" }],
      [T.adds]: { kinds: ["three"] },
      "add:three": { three: { page: "/" }, requirements: [PAY] },
      judge_requirements: requestJudge([[/bank transfer/, "asked", "no"]]),
    },
  });
  try {
    const r = await sendMessage(P, { message: "add a spinning 3D model of our shop to the home page, and let people pay by bank transfer." });
    await settle(P, r.key);
    await pump(P);
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    assert.ok(job, "no add-on job was filed");
    // THE ROUTE'S OWN ANSWER, STORED ON THE JOB AND SERVED BACK.
    job.result = { ...job.result, body: JSON.stringify(pub.body) };
    const served = (await call(P, "GET", "/api/site/edit/" + job.id)).body;
    assert.deepEqual(served.outcome, pub.body.outcome);
    assert.equal(served.coverNote, pub.body.coverNote);
    const said = screen(served, false);
    assert.equal(said, "⚠️ " + SCHEMA_MSG + " " + pub.body.coverNote);
    assert.ok(said.endsWith(" " + MADE_UNKNOWN), said);
    assert.doesNotMatch(said, /nothing from this/);
    assert.equal(addonReplyFacts(served).skip, "technical");
    // A STORED ANSWER THE FACTS DO READ: an unknown outcome beside a database made, on a stop that is not ours.
    const readable = { ok: false, error: "compile", cost: 0, msg: "That addition didn't compile, so it wasn't published — try describing it differently.", coverNote: MADE_UNKNOWN, outcome: pub.body.outcome };
    job.result = { ...job.result, body: JSON.stringify(readable) };
    const again = (await call(P, "GET", "/api/site/edit/" + job.id)).body;
    assert.equal(again.coverNote, MADE_UNKNOWN);
    assert.equal(screen(again, false), "⚠️ " + readable.msg + " " + MADE_UNKNOWN);
    const g = facts(again);
    assert.equal(g[0], "changed: The site has its own database now, made for this addition.");
    assert.ok(g.includes(UNKNOWN_FACT), JSON.stringify(g));
    assert.ok(!g.some((x) => /nothing from it/.test(x)), JSON.stringify(g));
  } finally { P.close(); compiler.uninstall(); }
});

// ── WHAT THE REQUEST RECORDS FROM WHAT A JOB LEFT STANDING (2026-10-07) ────
//
// A request turned every ok:false answer into a failed part, and a stop into
// "Stopped at their request before it changed anything" — beside an
// addition whose tables had gone in. The part now reads what the answer
// RECORDS (`leftOf`): its outcome, its database record, an edit's landed
// steps; an answer that records nothing is read as before.

const RQ_KEY = "rqfail000000000001";
const rqOf = (message) => {
  const planned = planParts(message, { intent: "addon" });
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const rec = newRequest({ key: RQ_KEY, uid: "u1", slug: "fold-lane", message, picker: "sonnet", tz: "Europe/London", accepted: { intent: "addon" }, parts: planned.parts });
  const first = nextStep(rec, {}, Date.now());
  assert.ok(first.file, "the request filed no job");
  return noteJobId(first.record, first.file.key, "a".repeat(32));
};
const ended = (body, state = "failed", more = {}) => ({ ok: true, state, billing: "refunded", needs_review: false, result: body === null ? null : { status: 422, body: JSON.stringify(body) }, ...more });
const settleWith = (rec, row) => nextStep(rec, { ["a".repeat(32)]: row }, Date.now()).record;

test("STATUS 1 — A FAILURE AFTER THE TABLES WENT IN IS DONE IN PART: ROUTE 1's own answer makes the part partial with what it did not do, never wholly failed; its card says partial; the request's facts say done in part — and the same request failing before the apply stays failed", async () => {
  const after = await signupAsk("fo-status-after", { notServed: true });
  assert.equal(after.body.outcome.database, "applied", "the producer did not leave tables standing — this case tests nothing");
  assert.equal(leftOf(after.body), "partial");
  const rec = settleWith(rqOf(SIGNUP), ended(after.body));
  assert.deepEqual([rec.parts[0].status, rec.parts[0].why, rec.parts[0].left], ["partial", "partly-done", "partial"]);
  assert.deepEqual(rec.parts[0].notDone.map((n) => n.why), ["compile"]);
  assert.equal(editJobOutcome(ended(after.body), "addon"), "partial");
  const f = requestReplyFacts(rec).facts.map((x) => x.text);
  assert.ok(f.some((t) => /^Done only in part:/.test(t)), JSON.stringify(f));
  assert.ok(!f.some((t) => /^Not done:/.test(t)), "a part whose tables stand was told as not done: " + JSON.stringify(f));
  // BEFORE THE APPLY: nothing stands, and the part fails as it always did.
  const before = await signupAsk("fo-status-before", { compileFail: true });
  assert.equal(before.body.outcome.database, "none", JSON.stringify(before.body.outcome));
  assert.equal(leftOf(before.body), "");
  const rec2 = settleWith(rqOf(SIGNUP), ended(before.body));
  assert.deepEqual([rec2.parts[0].status, Object.hasOwn(rec2.parts[0], "left")], ["failed", false]);
});

test("STATUS 2 — A STOP AFTER THE TABLES WENT IN (the publish gate's cancel carries `detail: \"cancelled\"` on the same answer) is still a stop, but never told as one before anything changed; a stop with nothing standing is told as before", async () => {
  const after = await signupAsk("fo-status-stop", { notServed: true });
  const stopped = { ...after.body, detail: "cancelled" };
  const rec = settleWith(rqOf(SIGNUP), ended(stopped));
  assert.deepEqual([rec.parts[0].status, rec.parts[0].left], ["cancelled", "partial"]);
  const f = requestReplyFacts(rec).facts.map((x) => x.text);
  assert.ok(f.some((t) => /^Stopped at their request, after part of it had gone in and is live:/.test(t)), JSON.stringify(f));
  assert.ok(!f.some((t) => /before it changed anything/.test(t)), JSON.stringify(f));
  // NOTHING STANDING: the old sentence, which is true there.
  const clean = settleWith(rqOf(SIGNUP), ended({ ok: false, error: "cancelled", outcome: failureOutcome(), msg: "I stopped that edit before anything was published." }, "cancelled"));
  assert.deepEqual([clean.parts[0].status, Object.hasOwn(clean.parts[0], "left")], ["cancelled", false]);
  assert.ok(requestReplyFacts(clean).facts.some((x) => /before it changed anything/.test(x.text)));
  // A STOP AFTER A DATABASE WAS MADE FOR THE SITE (the gates' own evidence, `aStopEvidence`): partial too.
  const prov = settleWith(rqOf(SIGNUP), ended({ ok: false, error: "cancelled", outcome: failureOutcome({ provisioned: true }), msg: "I stopped that edit before anything was published." }, "cancelled"));
  assert.equal(prov.parts[0].left, "partial");
});

test("STATUS 3 — ONLY WHAT AN ANSWER RECORDS IS READ: an ordinary refusal with no outcome stays failed and is never told as one that may have changed the site; an edit's landed steps make it done in part; an apply that stopped part-way fails and says it is not known", () => {
  const plain = { ok: false, error: "no-page", msg: "The site has no such page." };
  assert.equal(leftOf(plain), "", "an answer recording nothing was read as unknown");
  const rec = settleWith(rqOf(SIGNUP), ended(plain));
  assert.deepEqual([rec.parts[0].status, Object.hasOwn(rec.parts[0], "left")], ["failed", false]);
  assert.equal(leftOf({ ok: false, error: "compile", landed: ["your site is now at new.gofarther.app"], msg: "x" }), "partial");
  assert.equal(leftOf({ ok: false, error: "compile", landed: [""], msg: "x" }), "", "an empty landed note counted");
  const unknown = { ok: false, error: "schema", outcome: failureOutcome({ database: "unknown" }), msg: "x" };
  const rec3 = settleWith(rqOf(SIGNUP), ended(unknown));
  assert.deepEqual([rec3.parts[0].status, rec3.parts[0].left], ["failed", "unknown"]);
  assert.ok(requestReplyFacts(rec3).facts.some((x) => /^Not done, part-way through, so whether any of it went in is not known:/.test(x.text)));
  assert.equal(leftOf({ ok: true }), "");
  // A SUCCESS IS NEVER READ AS LEAVING SOMETHING, whatever it carries.
  assert.equal(leftOf({ ok: true, landed: ["your site is now at new.gofarther.app"] }), "", "a success read as done in part");
  // A RECORD IN A STATE THAT SAYS NOTHING OF WHAT STANDS reads as nothing recorded, never as unknown.
  assert.equal(leftOf({ ok: false, error: "x", migration: { status: "applied" } }), "", "a record that says nothing of what stands was read as unknown");
  assert.equal(leftOf({ ok: false, error: "x", migration: { status: "junk" } }), "");
});

test("STATUS 4 — A JOB THAT DIED WITH NO ANSWER AFTER ITS TABLES WENT IN: the driver hands its database record in, the part is tried again keeping what stands, and if the last try dies too it fails told as after part of it had gone in", () => {
  const applied = migrationSummaryOf(withApplied(newMigration({ job: "a".repeat(32), slug: "fold-lane", added: ["signups"] }), ["signups"]), "applied_without_page");
  assert.equal(leftOfRecord(applied), "partial");
  assert.equal(leftOfRecord({ status: "failed" }), "unknown");
  assert.equal(leftOfRecord({ status: "applied" }), "");
  assert.equal(leftOfRecord(null), "");
  const dead = ended(null, "lost", { migration: applied });
  const once = nextStep(rqOf(SIGNUP), { ["a".repeat(32)]: dead }, Date.now());
  assert.ok(once.file, "the part was not tried again");
  assert.deepEqual([once.record.parts[0].left, once.record.parts[0].retries], ["partial", 1], "the retry lost what stands");
  // THE RETRY'S OWN JOB DIES BEFORE ANY DATABASE WORK: what the first left still stands.
  const rec2 = noteJobId(once.record, once.file.key, "b".repeat(32));
  const last = nextStep(rec2, { ["b".repeat(32)]: ended(null, "lost") }, Date.now()).record;
  assert.deepEqual([last.parts[0].status, last.parts[0].why, last.parts[0].left], ["failed", "no-answer", "partial"]);
  assert.ok(requestReplyFacts(last).facts.some((x) => /^Not done, after part of it had gone in and is live:/.test(x.text)), JSON.stringify(requestReplyFacts(last).facts));
  // THE RETRY DIES TOO, ITS OWN APPLY NEVER HEARD FROM: what is known to be
  // live is the stronger reading, and it stands over "not known".
  const unheard = nextStep(rec2, { ["b".repeat(32)]: ended(null, "lost", { migration: { status: "failed" } }) }, Date.now()).record;
  assert.deepEqual([unheard.parts[0].status, unheard.parts[0].left], ["failed", "partial"], "a weaker reading replaced what is known to be live");
  // …AND THE OTHER WAY ROUND: a first try not known, a retry whose tables went in.
  const first = nextStep(rqOf(SIGNUP), { ["a".repeat(32)]: ended(null, "lost", { migration: { status: "failed" } }) }, Date.now());
  assert.equal(first.record.parts[0].left, "unknown");
  const then = nextStep(noteJobId(first.record, first.file.key, "c".repeat(32)), { ["c".repeat(32)]: ended(null, "lost", { migration: applied }) }, Date.now()).record;
  assert.equal(then.parts[0].left, "partial", "what is known to be live did not replace \"not known\"");
});
