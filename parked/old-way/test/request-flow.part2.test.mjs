// PARKED (2026-11-03, park-old-way): the old-way half of test/request-flow.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// ONE MESSAGE, SEVERAL PARTS, FINISHED ON THE SERVER — THE GROUPED FREE TESTS
// (2026-10-03, the owner's order: *"Verify the actual flow with grouped free
// tests covering both route orders, multiple operations, prerequisites
// mentioned later, clarification and resume, attachments, closed-tab
// continuation, existing handoffs, partial failure, cancellation, duplicate
// delivery and crashes around publication and charging; check final site
// changes, stored statuses, customer-visible facts and ledger outcomes."*)
//
// EVERY CASE RUNS THE REAL WORKER: the routing route that accepts the message,
// the queue consumer that runs each part's job, the edit and add-on routes the
// job replays, the request's driver, the two-minute sweep, and the owner
// routes the page reads — against `test/fixtures/request-flow.mjs`, whose
// `edit_jobs`, ledger, bucket and queue keep state the way the real ones do.
// What each case checks is what happened: the site's stored pages and look,
// the request record and each job row, what the reply writer was told (the
// customer-visible facts), and every ledger row.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer — the router's, the
// picker's, each lane's, the add-on's, the page writer's and the reply
// writer's — is supplied by the case. Nothing here is evidence of what a real
// model answers for these messages; the real-model batch is separate and not
// run (it would be paid).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { platform, sendMessage, pump, tick, call, settle, readWritten, browserBody, T, USER, newKey } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { writtenPage } from "../../../test/fixtures/addon-route.mjs";
import { PAGES, HOME, VISIT, VISIT_MOVED, OLD_DESC, page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { PART_HEADING } from "../../../builder/route-shared.mjs";
import { jobBody, handOff, HOPS_MAX } from "../../../builder/request.mjs";
import { gatewayHandler, gatewayKey, signJobToken, verifyJobToken, preScopeSlug } from "../../../builder/job-gateway.mjs";
import { makeContainerEnv } from "../../../builder/container-env.mjs";
import { navSlots, chromeListSlots, applyAdditions } from "../../../builder/site-nav.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "../../../test/fixtures/rows-db.mjs";

const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const ADD = "add a gallery page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GALLERY = { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const DESCRIBE = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
const slugOf = (k) => "rq-" + k + "-" + Math.random().toString(16).slice(2, 8);

/** One case: a platform and the compiler, closed whatever happens. */
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const jobLine = (P, key) => P.jobsOf(key).map((j) => j.op + ":" + j.state);
/** The ledger rows of one kind, as numbers. */
const rows = (P, reason) => P.ledger.filter((e) => e.reason === reason).map((e) => e.delta);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
/**
 * WHAT A READ'S REPLY TOLD THE CUSTOMER, before the wording: the facts behind
 * the reply it handed back (replies are written in the background, 2026-10-04,
 * so the writer's last call need not be this one), joined. No reply is a failure.
 */
const toldIn = (P, v) => {
  const f = P.factsOf(v && v.body && v.body.reply);
  assert.ok(f, "no reply was handed back: " + JSON.stringify(v && v.body && { replyState: v.body.replyState, reply: v.body.reply }));
  return f.map((x) => x.text).join(" | ");
};
const REQ = (P, key) => "/api/site/request/" + P.slug + "/" + key;

// ─────────────────────────────────────────────────────────────────────────────
// C. A PART ASKS, IS ANSWERED, AND RESUMES — WHILE THE REST GOES ON
// ─────────────────────────────────────────────────────────────────────────────

const Q = { text: "Which photos should the gallery show?", options: ["Loaves", "The bakery"] };

// ─── CLARIFY AND RESUME, CONSOLIDATED (2026-10-13, after run 150) ──────────
//
// The owner: *"prepare one consolidated, image-free clarification/resume test
// covering independent work continuing while another part genuinely needs an
// answer, dependency-bound work waiting, answering only resuming the waiting
// part, successful work surviving reload/reconnection, and no duplicate
// execution or charges. Keep this universal across task types."* C2, E2, I4
// and CC 3 each show a piece; these put every piece on one request and count
// jobs and money across it. Two shapes, so no task type or stage is special:
//   CR 1  the STEP of an edit asks (the description lane); the independent
//         part is an addition; the dependent part is an edit of a page;
//   CR 2  the ROUTING of an addition asks; the independent part is an edit;
//         the dependent part is an edit that needs the addition.
const LINE_CR = "add a line about the new wording to the Visit page";
const QD_CR = { text: "Which word should lead — overnight or slow?", options: ["Overnight", "Slow"] };
const partOf = (key, j) => Number(String(j.idem_key).slice(key.length + 2).match(/^\d+/)[0]);
const jobsByPart = (P, key) => {
  const m = {};
  for (const j of P.jobsOf(key)) (m[partOf(key, j)] ||= []).push(j.id + ":" + j.op + ":" + j.state);
  return m;
};
async function clarifyResume(P, { asking, independent, dependent, landedBefore, unchangedBefore, landedAfter, answer }) {
  const r = await sendMessage(P, { message: DESC + ", " + ADD + ", and " + LINE_CR + "." });
  const s1 = await settle(P, r.key);
  // 1. THE ASKING PART WAITS, THE INDEPENDENT ONE FINISHED, THE DEPENDENT ONE IS HELD.
  const want = []; want[asking] = "waiting"; want[independent] = "done"; want[dependent] = "blocked";
  assert.deepEqual(statuses(s1.rec), want, JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
  landedBefore(P);
  unchangedBefore(P);
  const q = P.question();
  assert.equal(q.part, asking, "the question is not the asking part's");
  const before = jobsByPart(P, r.key);
  assert.ok(!before[dependent], "the dependent part ran a job before the answer: " + JSON.stringify(before));
  assert.ok((before[independent] || []).every((x) => x.endsWith(":done")), JSON.stringify(before));
  const spentBefore = P.spent();
  // 2. RECONNECTION WHILE IT WAITS: another page or device finds the same request, the same
  //    states and the question on its part — and reading it runs and charges nothing.
  const other = await call(P, "GET", "/api/site/requests/" + P.slug);
  assert.equal(other.status, 200);
  const seen = other.body.requests.find((x) => x.key === r.key);
  assert.ok(seen, "the request was not found from another device");
  assert.deepEqual(seen.parts.map((p) => p.status), want);
  assert.equal(seen.parts[asking].question.text, q.question.text);
  assert.deepEqual((await call(P, "GET", "/api/site/" + P.slug + "/question")).body.question.request, { key: r.key, part: asking });
  await tick(P);
  assert.deepEqual(jobsByPart(P, r.key), before, "reading the request from elsewhere ran something");
  assert.equal(P.spent(), spentBefore, "reading the request from elsewhere charged something");
  // 3. THE ANSWER RESUMES ONLY THE ASKING PART; THE DEPENDENT ONE FOLLOWS ONCE.
  const ans = await sendMessage(P, { message: answer, ask: { id: q.id, chosen: true } });
  const s2 = await settle(P, r.key);
  assert.deepEqual(statuses(s2.rec), ["done", "done", "done"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
  landedAfter(P);
  const after = jobsByPart(P, r.key);
  assert.deepEqual(after[independent], before[independent], "the finished part was run again after the answer");
  assert.ok(after[asking].length > (before[asking] || []).length, "the asking part was never resumed");
  assert.ok(after[dependent] && after[dependent].every((x) => x.endsWith(":done")), JSON.stringify(after));
  const depOps = after[dependent].map((x) => x.split(":")[1]);
  assert.equal(new Set(depOps).size, depOps.length, "the dependent part ran a step twice: " + JSON.stringify(depOps));
  // 4. THE MONEY: one routing row, the message's (2026-10-24, addon-existing: an
  //    answer resuming the paid request is routed but never charged again), one
  //    reserve for every job, no refund, and the balance moved by exactly those.
  const routeRefs = P.ledger.filter((e) => e.reason === "route").map((e) => e.ref).sort();
  assert.deepEqual(routeRefs, ["route:" + P.slug + ":" + r.key]);
  assert.ok(ans.key);
  assert.deepEqual(rows(P, "route"), [-1]);
  // A job whose step only asked may have taken nothing (an edit step asks before it charges);
  // none is ever reserved twice, and every job that did work after the answer, and the
  // independent part's, is reserved exactly once.
  const beforeIds = new Set(Object.values(before).flat().map((x) => x.split(":")[0]));
  for (const j of P.jobsOf(r.key)) {
    const n = reserveOf(P, j.id).length;
    assert.ok(n <= 1, j.op + " (part " + partOf(r.key, j) + ") was reserved " + n + " times");
    if (!beforeIds.has(j.id) || partOf(r.key, j) === independent) assert.equal(n, 1, j.op + " (part " + partOf(r.key, j) + ") did its work without its one reserve");
  }
  assert.deepEqual(rows(P, "refund"), []);
  assert.equal(P.spent(), 1 + P.jobsOf(r.key).reduce((n, j) => n + (reserveOf(P, j.id)[0] || 0), 0));
  // 5. THE SAME ANSWER AGAIN (a lost response, a second tab): refused, nothing run or charged.
  const spent = P.spent();
  const again = await sendMessage(P, { message: answer, ask: { id: q.id, chosen: true } });
  assert.equal(again.body.error, "stale-question");
  await settle(P, r.key);
  assert.deepEqual(jobsByPart(P, r.key), after);
  assert.equal(P.spent(), spent);
  // 6. A RELOAD AFTERWARDS: the ended request is found with every part done; nothing reruns.
  const later = (await call(P, "GET", "/api/site/requests/" + P.slug)).body.requests.find((x) => x.key === r.key);
  assert.equal(later.ended, true);
  assert.deepEqual(later.parts.map((p) => p.status), ["done", "done", "done"]);
  await tick(P);
  assert.deepEqual(jobsByPart(P, r.key), after);
  assert.equal(P.spent(), spent);
}

// A CANCEL WHOSE REQUEST READ FAILS (2026-10-23, audit A35-4): one thrown read
// ended the loop, the part kept waiting, and the reply still said cancelled.
for (const reads of [1, 6]) {
  test("C4b — a part's question cancelled while the request read fails " + reads + " time(s): read again and ended, or not told as cancelled", async () => {
    const QD = { text: "Which word should lead — overnight or slow?", options: ["Overnight", "Slow"] };
    await withPlatform({
      slug: slugOf("c4b" + reads),
      answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, "lane:description": { question: QD }, ...GALLERY },
    }, async (P) => {
      const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
      await settle(P, r.key);
      const q = P.question();
      assert.equal(q.requestKey, r.key);
      P.failGetFrom((k) => k.includes(r.key), { count: reads });
      const c = await call(P, "POST", "/api/site/" + P.slug + "/question", { id: q.id, cancel: true });
      if (reads === 1) {
        assert.equal(c.body.cancelled, true, JSON.stringify(c.body));
        assert.equal(P.record(r.key).parts[0].status, "cancelled", "the cancel did not end the part");
      } else {
        assert.notEqual(c.body && c.body.cancelled, true, "a part left waiting was told as cancelled: " + JSON.stringify(c.body));
        assert.equal(c.status, 503);
        assert.equal(P.record(r.key).parts[0].status, "waiting");
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// D. ATTACHMENTS KEPT ON THE SERVER FOR THE PART THAT READS THEM
// ─────────────────────────────────────────────────────────────────────────────

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const LOGO = "Use the attached picture as the logo";

// ─────────────────────────────────────────────────────────────────────────────
// F. THE HAND-OVERS THE PAGE USED TO MAKE, MADE ON THE SERVER
// ─────────────────────────────────────────────────────────────────────────────

const LINE_FROM = "Bread from the harbour, every morning.";
const textAnswer = (to) => (args) => {
  const lines = String(args.messages[0].content).split("\n");
  const at = lines.find((l) => l.includes("[index.tsx] " + LINE_FROM));
  return { edits: [{ id: Number(String(at || "-1.").split(".")[0]), to }] };
};

// ─────────────────────────────────────────────────────────────────────────────
// N. THE FULL REWRITE'S GO-AHEAD, KEPT ON THE REQUEST (2026-10-03, the owner's
// review: *"Preserve a waiting approval state and attachments, record the
// approval durably, and use the existing rewrite executor without changing
// first Build; settle its result back into the request and resume eligible
// dependents. Verify approval after reload or from another device, duplicate
// approval, failure and cancellation."*). The rewrite each case runs is the
// existing queued build — its row, its consumer, its design call, its page
// writer, its compile, its publish and its charging — not a stand-in.
// ─────────────────────────────────────────────────────────────────────────────

const MANY = Array.from({ length: 610 }, (_, i) => "<p>Line " + (i + 1) + " of our story.</p>").join("");
const BIG = [{ path: "index.tsx", source: pageSrc("/", "<section>" + MANY + "</section>") }, { path: "visit.tsx", source: VISIT }];
const WARM = pageSrc("/", "<section><p>A warmer story, line by line.</p></section>");
const REWORD = "Reword every line to sound warmer";
/** The rewrite's own two model calls (its designer, its page writer), beside a message's routing; `gallery` when the add-on's page writer runs first. */
function rewriteAnswers(slug, { route, gallery = false, extra = {} } = {}) {
  return {
    route, ...(gallery ? GALLERY : {}), ...extra,
    design_schema: { brand: "Harbour Loaf", slug, description: "a bakery", kind: "shopfront", purpose: "visit", pages: [{ path: "/", name: "Home" }, { path: "/visit", name: "Visit" }], components: [], css: "" },
    [T.pages]: (args, n) => (gallery && n === 0 ? { pages: [writtenPage("/gallery")] } : { pages: [{ path: "src/routes/index.tsx", source: WARM }], notes: "Rewrote the home page." }),
  };
}
/** The existing build's own bindings: its database check and its compile container. */
const buildable = (P) => { P.env.NEON_API_KEY = "neon-test"; P.env.SITE_BUILD_CONTAINER = {}; };
const approve = (P, key, part = 0, auth) => call(P, "POST", "/api/site/request/" + P.slug + "/" + key + "/approve", { part }, auth);
const builds = (P) => [...P.jobs.values()].filter((j) => j.op === "build");
const designs = (P) => P.modelLog.filter((m) => m.tool === "design_schema").length;
/** Ledger rows the build path wrote (its own refs), as numbers. */
const buildRows = (P) => P.ledger.filter((e) => e.ref.startsWith("build:")).map((e) => e.delta);
/** The request's record, where a press writes the go-ahead. */
const recordOf = (P, key) => "requests/" + P.slug + "/" + key + ".json";
/** The id part 0's go-ahead is filed under, as the server derives it (`rewriteJobId`). */
async function nextRewriteId(P, key) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update("request-rewrite:" + key + ":0:" + (P.record(key).parts[0].seq + 1)).digest("hex").slice(0, 32);
}
/**
 * ONE REWRITE, CHARGED ONCE: one build row, under the go-ahead's id; one
 * design; every build ledger row under that id, adding up to what the build
 * said it cost; and one rewrite job on the part, settled at that cost.
 */
function oneRewrite(P, rec, id) {
  assert.deepEqual(builds(P).map((b) => b.id), [id], "not one build, under the go-ahead's id");
  assert.equal(designs(P), 1, "the rewrite did not run exactly once");
  const rows = P.ledger.filter((e) => e.ref.startsWith("build:"));
  assert.ok(rows.length > 0, "the rewrite charged nothing");
  assert.ok(rows.every((e) => e.ref.startsWith("build:" + id + ":")), "a build charge under another id: " + rows.map((e) => e.ref).join(", "));
  const cost = JSON.parse(JSON.parse(P.objects.get("jobs/" + id + ".result.json").body).body).cost;
  assert.equal(-rows.reduce((n, e) => n + e.delta, 0), cost);
  const rw = rec.parts[0].jobs.filter((j) => j.kind === "rewrite");
  assert.deepEqual(rw.map((j) => [j.id, j.end && j.end.cost]), [[id, cost]]);
}
// PART 0 IS ROUTED AGAIN ONCE PART 2 HAS RUN, AND ITS ROUTING ANSWERS "build"
// — the full rewrite the router chose, the one way a part reaches the go-ahead
// since 2026-10-24 (a climb no longer does: the owner's decision). PART 1
// NEEDS PART 0; PART 2 IS INDEPENDENT AND RUNS FIRST.
const WAITING_ROUTE = [
  { intent: "edit", layer: "text", alsoAsked: [DESC, ADD], dependsOn: [{ change: 1, after: [0] }, { change: 0, after: [2] }] },
  { intent: "addon" },
  { intent: "build" },
  { intent: "edit", layer: "look" },
];
const WAITING_MSG = REWORD + ", then " + DESC + ", and " + ADD + ".";

// ─────────────────────────────────────────────────────────────────────────────
// J. CRASHES AROUND CHARGING AND PUBLICATION
//
// A crash here is an invocation that stops dead after a call LANDED and before
// its caller heard back — no catch, no finally, its heartbeat gone — and the
// platform's own sweeps meet what it left: the lease runs out (90 s) and, past
// the grace (60 s), `edit_sweep_lost` settles the row; the request's sweep then
// moves the request on. The job runner's recovery is the existing one; what
// these show is that the REQUEST comes out right on top of it.
// ─────────────────────────────────────────────────────────────────────────────

const PAST_LEASE = (90 + 60 + 15) * 1000;
// A PUBLISH HOLDS ITS LEASE LONGER (`PUBLISH_LEASE_S`, 300 s) than a step does.
const PAST_PUBLISH = (300 + 60 + 15) * 1000;
const TWO = [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }];

// ── A WRITE WHOSE ANSWER IS LOST IS AN OUTCOME NOT KNOWN (2026-10-03, the
// owner's review: *"Treat a lost write response as an uncertain outcome;
// preserve files while acceptance or another concurrent acceptance may
// reference them, recover using the same request key, and clean up only when
// non-use is established."*). The step that reads the file is the logo step:
// its job's stored request carries the bytes read back from the request's own
// copy, and the site's logo is what it made of them.

const LOGO_ROUTE = { intent: "edit", layer: "logo", alsoAsked: [ADD] };
const filesOf = (P, key) => [...P.objects.keys()].filter((k) => k.startsWith("requests/" + P.slug + "/" + key + "/files/"));
/** The logo step was sent the very bytes the message carried, and made the logo of them. */
function logoGotTheFile(P, key) {
  const logoJob = P.jobsOf(key).find((j) => j.op === "edit" && P.bodyOf(j.id) && P.bodyOf(j.id).body.layer === "logo");
  assert.ok(logoJob, "no logo step ran");
  assert.deepEqual(P.bodyOf(logoJob.id).body.images, [{ data: PNG, name: "logo.png" }], "the logo step was not sent the message's own bytes");
  assert.notEqual((P.look().wordmark || {}).form, "text", "the logo did not reach the site");
}

// ─────────────────────────────────────────────────────────────────────────────
// M. AN ADDITION SET ASIDE BESIDE OTHERS GOES ON AS A PART OF ITS OWN
// ─────────────────────────────────────────────────────────────────────────────
//
// The owner's review: the add-on step sets a menu link (`frame`) or a list
// entry (`row`) aside when other kinds come with it, and named it only by its
// kind, so a request marked the part done and ran what depended on the
// missing link. The picker now names each kind's own words; a kind set aside
// with its words is left for later (`deferred`) and becomes a part of the
// request; without them it is a part of this one not done.

const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const MENU = [["Home", "/"], ["Visit", "/visit"]];
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV(MENU) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV(MENU) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The shutters and the street.</p></section>") },
];
/** Every menu on every stored page, as `label href` lines. */
const menus = (P) => navSlots(P.pages().map((path) => ({ path, source: P.page(path) }))).map((m) => m.page + ": " + m.items.map((i) => i.label + " " + i.href).join(" | "));
const LINK = "put a link to it in the menu";
const GALLERY_WITH_LINK = "Add a gallery page and " + LINK + ".";
const NAV_WITH = (extra) => ({ links: [...MENU, ...extra].map(([label, href]) => ({ label, href })) });
// A NEW PAGE LINKED FROM ONE PAGE'S BAND, not the menu (2026-10-04): its link in
// the menu is then the set-aside part's to make, by name (`add`).
const GALLERY_ON_HOME = { ...PAGE("/gallery", "Gallery"), link: { in: "page", page: "/", where: "a button in the hero band" } };
const ADD_GALLERY = { add: [{ to: "menu", label: "Gallery", href: "/gallery" }] };

// THE OWNER'S REVIEW (2026-10-04): A FOOTER ADDITION NAMING ITS PAGES IS DONE
// ONLY WHEN EVERY NAMED PAGE HAS IT. Run 47's bakery: four pages with a footer
// and no social links, a starter page with no footer at all; Instagram already
// on the home page. Its own part is followed by one that needs it.
const BAKERY = ["index", "order", "starter", "visit", "gallery"].map((n) => ({ path: n + ".tsx", source: fs.readFileSync(new URL("../../../test/fixtures/run47/" + n + ".before.tsx", import.meta.url), "utf8") }));
const INSTA = { to: "social", network: "instagram", href: "https://instagram.com/harbourloaf" };
const BAKERY_INSTA_HOME = applyAdditions(BAKERY, [{ to: "social", item: { network: INSTA.network, href: INSTA.href }, pages: ["/"], after: null }]).pages;
const socialOf = (P, file) => (chromeListSlots([{ path: file, source: P.page(file) }], "social")[0] || {}).items;
const INSTA_WORDS = "add our Instagram to the footer of the home page and the";

for (const [named, met] of [["/visit", true], ["/starter", false]]) {
  test(`M6 (${named}) — a footer addition naming its pages: ${met ? "the named page whose footer had no social links is given them, the part is done, and the part that needed it runs" : "the named page with no footer is told by name, the part is not done though the home page had it, and the part the router said needed it (naming nothing) still runs"}`, async () => {
    assert.deepEqual((chromeListSlots([{ path: "index.tsx", source: BAKERY_INSTA_HOME[0].source }], "social")[0] || {}).items, [{ network: "instagram", href: INSTA.href }], "the fixture's home page has no Instagram");
    const words = INSTA_WORDS + " " + named.slice(1) + " page";
    await withPlatform({
      slug: slugOf("m6" + named.slice(1)), pages: BAKERY_INSTA_HOME, replies: true,
      answers: {
        route: [{ intent: "edit", layer: "nav", alsoAsked: [DESC], dependsOn: [{ change: 1, after: [0] }] }, { intent: "edit", layer: "look" }],
        write_nav: { add: [{ ...INSTA, pages: ["/", named] }] },
        ...DESCRIBE,
      },
    }, async (P) => {
      const r = await sendMessage(P, { message: words + ", then " + DESC + "." });
      const { rec } = await settle(P, r.key);
      const nav = P.answerOf(P.jobsOf(r.key)[0]);
      assert.notEqual(nav.satisfied, true, "an addition with a named page undone, or newly done, was answered as already true");
      if (met) {
        assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
        assert.deepEqual(socialOf(P, "visit.tsx"), [{ network: "instagram", href: INSTA.href }]);
        assert.equal(P.look().description, NEW_DESC, "the part that needed it did not run");
      } else {
        assert.equal(nav.ok, false, JSON.stringify(nav));
        assert.match(nav.msg, /\/starter has no footer to put “instagram” in/);
        assert.equal(rec.parts[0].status, "failed", JSON.stringify(rec.parts[0]));
        // A NEED THAT NAMES NOTHING (2026-10-24, request-needs): the description runs.
        assert.equal(rec.parts[1].status, "done", JSON.stringify(rec.parts[1]));
        assert.equal(rec.state, "partial");
        assert.equal(P.look().description, NEW_DESC, "the part held on an unnamed need did not run");
        assert.equal(P.page("starter.tsx"), BAKERY.find((x) => x.path === "starter.tsx").source, "the page with no footer was given one");
        const told = toldIn(P, await readWritten(P, REQ(P, r.key)));
        assert.doesNotMatch(told, /Not started/, told);
      }
    });
  });
}
