// THE REQUEST BATCH'S CANARY (2026-10-03): the six presses' scenarios, the
// driver's new step options — a message that ends on a step's question and
// the answer that resumes it, a message sent with its tab then closed, a
// message's own time bound, the add-on step beside the edit layers, and the
// request-mode wall — and the verdict that judges each press on what landed,
// with the coverage it records and never fails on.
//
// The owner's order: *"implement the planned canary options and scenarios,
// verify them with focused tests, and push with green CI. Keep product
// behavior frozen."* Nothing here touches a product file: the driver is run
// against a stand-in app, and the verdict against the bakery's own stored
// pages (test/fixtures/run47) changed by the product's own writers.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  UI_SCENARIOS, readUiScenario, runUi, describeUi, stepBoundMs, UI_STEP_MS, UI_STEP_MAX_MS, UI_PRESS_MAX_MS, UI_AWAY_EVERY_MS,
  wallRefusal, blocksPost, requestWall, requestVerdict, questionShown, routingEvidence, chainOrdered, chainVerdict, routeCallsOf,
} from "../scripts/canary-ui.mjs";
import {
  headingOnly, timeWords, statesAll, namesAll, routeOfPage, pageForRoute, headerLogos, servedDescription, routeAllowed,
  requestStepChecks, relationsOf, jobOrderVerdict, repliesOf, replyChecks, outcomeChecks, coverageOf, COVERAGE, requestBatchVerdict,
} from "../scripts/canary-requests.mjs";
import { frameOf } from "../scripts/canary-additions.mjs";
import { applyNav, applyChromeList } from "../builder/site-nav.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const SLUG = "fold-lane-bakery";
const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
const ORIGIN = "https://gofarther.dev";
const PLAN = fs.readFileSync(ROOT + "docs/investigations/request-flow-rollout.md", "utf8");
const CANARY = fs.readFileSync(ROOT + "scripts/edit-canary.mjs", "utf8");
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => `${c.name} — ${c.why}`);
const RQ = Object.keys(UI_SCENARIOS).filter((k) => k.startsWith("rq-"));

// ── THE SCENARIOS ────────────────────────────────────────────────────────────

const WORDS = {
  "rq-canary": ["On the Visit page, change the heading 'Come to the bakery' to 'Come and see us'."],
  "rq-1-classes": ["Change the site description to say we now run Saturday bread-making classes, put a link to the new Classes page in the menu, and add a Classes page that explains the classes."],
  "rq-2-wholesale": ["Add a Wholesale page for cafés that want to order loaves in bulk and put a link to it in the menu, then change the Walnut Levain's price to £6.20."],
  "rq-3-facebook": ["On the Visit page, change the heading 'The shutters and the street' to 'Our shop on the street', and add a link to our Facebook page in the footer.", "It's facebook.com/harbourloafbristol"],
  "rq-4-logo": ["Change the home page heading 'Fed every morning since we opened' to 'Fed every morning since 2019', and use the attached picture as our logo."],
  "rq-5-away": ["Add a line to the Order page saying orders close at 8pm the night before, and change the Gallery page heading 'Photographs of the bakery's work' to 'Photographs from the bakery'."],
};

test("the batch is six request-mode scenarios on the bakery, each message the plan's word for word, and the plan names each one", () => {
  assert.deepEqual(RQ, Object.keys(WORDS));
  for (const name of RQ) {
    const s = UI_SCENARIOS[name];
    assert.equal(s.site, SLUG, name);
    assert.equal(s.request, true, `${name} is not a request-mode scenario`);
    assert.deepEqual(s.steps.map((x) => x.say), WORDS[name], `${name}'s words are not the plan's`);
    for (const w of WORDS[name]) assert.ok(PLAN.includes(w), `the plan does not carry ${name}'s message: ${w}`);
    assert.ok(PLAN.includes("`" + name + "`"), `the plan does not name ${name}`);
    assert.equal(readUiScenario(name, SLUG).ok, true);
    assert.equal(readUiScenario(name, "fretwork-1").ok, false, `${name} runs on another site`);
    // NOTHING A SCENARIO CAN ASK FOR IS THE FULL REWRITE OR A BUILD: every one
    // refuses both at the browser, before they leave.
    assert.equal(blocksPost("POST", "/api/site/request/fold-lane-bakery/" + "k".repeat(20) + "/approve", s), true);
    assert.equal(blocksPost("POST", "/api/site/react-revise", s), true);
    for (const c of s.covers) assert.ok(Object.hasOwn(COVERAGE, c), `${name} covers ${c}, which no reader knows`);
  }
});

test("each press's budget is its upper estimate, its walls are the plan's, and only the presses that need it open the add-on step", () => {
  const want = {
    "rq-canary": { budget: 6, layers: ["text", "look"], addon: false },
    "rq-1-classes": { budget: 25, layers: ["look", "text", "nav", "page"], addon: true },
    "rq-2-wholesale": { budget: 26, layers: ["data", "nav", "look", "page"], addon: true },
    "rq-3-facebook": { budget: 13, layers: ["text", "look", "nav"], addon: true },
    "rq-4-logo": { budget: 8, layers: ["text", "look", "logo"], addon: false },
    "rq-5-away": { budget: 18, layers: ["text", "look"], addon: true },
  };
  for (const [name, w] of Object.entries(want)) {
    const s = UI_SCENARIOS[name];
    assert.equal(s.budget, w.budget, name);
    assert.deepEqual([...s.layers], w.layers, name);
    assert.equal(s.addon === true, w.addon, name);
    // NO REQUEST-MODE PRESS TOUCHES RULES, PICTURES OR THE ADDITIONS DOOR.
    assert.ok(!s.layers.includes("rules") && !s.layers.includes("picture") && s.adds !== true, name);
  }
});

test("a message's own bound is capped, a press's bounds fit inside the workflow's time with its reads, the question is followed by its answer, and the tab is closed only on the last message", () => {
  for (const name of RQ) {
    const s = UI_SCENARIOS[name];
    const total = s.steps.reduce((t, x) => t + stepBoundMs(x), 0);
    assert.ok(total <= UI_PRESS_MAX_MS, `${name}'s messages may run ${total / 60000} minutes`);
    for (const [i, x] of s.steps.entries()) {
      if (x.ms !== undefined) assert.ok(Number.isFinite(x.ms) && x.ms > 0 && x.ms <= UI_STEP_MAX_MS, `${name} message ${i + 1}'s bound`);
      if (x.until !== undefined) {
        assert.equal(x.until, "question");
        assert.ok(i + 1 < s.steps.length, `${name} ends on a question with no answer to send`);
      }
      if (x.away !== undefined) {
        assert.equal(x.away, true);
        assert.equal(i, s.steps.length - 1, `${name} closes its tab before its last message`);
      }
    }
  }
  // THE WORKFLOW'S OWN LIMIT, read off the file: a press's messages leave at
  // least a quarter of an hour for the preflight and the before- and after-reads.
  // (The request batch alone has a longer limit of its own, held in
  // test/canary-batch.test.mjs; this is every other run's.)
  const flow = fs.readFileSync(ROOT + ".github/workflows/edit-canary.yml", "utf8");
  const minutes = Number((/timeout-minutes:\s*\$\{\{\s*github\.event\.inputs\.ui_scenario == 'rq-batch' && \d+ \|\| (\d+)\s*\}\}/.exec(flow) || [])[1]);
  assert.ok(minutes * 60_000 - UI_PRESS_MAX_MS >= 15 * 60_000, `the workflow allows ${minutes} minutes`);
  assert.equal(UI_STEP_MAX_MS, 30 * 60_000);
  assert.equal(UI_AWAY_EVERY_MS, 20_000);
  // THE DEFAULT, THE OWN AND THE CAP.
  assert.equal(stepBoundMs({}), UI_STEP_MS);
  assert.equal(stepBoundMs({ ms: 5 * 60_000 }), 5 * 60_000);
  assert.equal(stepBoundMs({ ms: 99 * 60_000 }), UI_STEP_MAX_MS);
  assert.equal(stepBoundMs({ ms: -1 }), UI_STEP_MS);
  assert.equal(stepBoundMs({ ms: "9" }), UI_STEP_MS, "a bound that is not a number was read as one");
  assert.equal(stepBoundMs({ ms: 400 }, { capMs: 50 }), 50);
});

test("R4 attaches the committed second logo, whose bytes the press expects to be served, and R2 keeps the Walnut Levain row's price, reading it from a fresh baseline", () => {
  const r4 = UI_SCENARIOS["rq-4-logo"];
  const bytes = fs.readFileSync(ROOT + r4.steps[0].attach);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), r4.expect.logo.sha256);
  assert.equal(r4.expect.logo.file, r4.steps[0].attach);
  assert.equal(bytes.length, 1224);
  // NOT THE LOGO THE SITE ALREADY HAS (ui-logo.png), or the change shows nothing.
  assert.notEqual(r4.expect.logo.sha256, crypto.createHash("sha256").update(fs.readFileSync(ROOT + "test/fixtures/ui-logo.png")).digest("hex"));
  const row = UI_SCENARIOS["rq-2-wholesale"].row;
  assert.deepEqual({ table: row.table, id: row.id, field: row.field, from: row.from, to: row.to, restore: row.restore }, { table: "loaves", id: 5, field: "price", from: "6", to: "6.2", restore: false });
  assert.deepEqual(row.match, { name: "Walnut Levain" });
  assert.deepEqual({ path: row.shown.path, before: row.shown.before, after: row.shown.after }, { path: "/order", before: "£6.00", after: "£6.20" });
  assert.equal(row.record.length, 7);
  assert.deepEqual(row.record.find((r) => r.id === 5), { id: 5, name: "Walnut Levain", description: "Butter walnuts folded through a long-fermented white dough.", price: 6, photo: null, created_at: "2026-08-21 23:06:23" });
  assert.equal(row.record[6].name, "Rye & Caraway");
});

// ── THE WALL, IN REQUEST MODE ────────────────────────────────────────────────

test("in request mode the page's own edit or add-on is refused before it leaves; the routing call, the request's own Stop and every read are let through", () => {
  const sc = UI_SCENARIOS["rq-1-classes"];
  const key = "k".repeat(24);
  assert.match(wallRefusal({ method: "POST", pathname: "/api/site/fold-lane-bakery/edit", body: JSON.stringify({ layer: "look" }), scenario: sc }), /in request mode/);
  assert.match(wallRefusal({ method: "POST", pathname: "/api/site/fold-lane-bakery/edit", body: JSON.stringify({ layer: "text" }), scenario: UI_SCENARIOS["rq-canary"] }), /in request mode/);
  assert.ok(wallRefusal({ method: "POST", pathname: "/api/site/fold-lane-bakery/addon", body: "{}", scenario: sc }), "the page's own add-on went out");
  assert.equal(wallRefusal({ method: "POST", pathname: "/api/site/route", scenario: sc }), "");
  assert.equal(wallRefusal({ method: "DELETE", pathname: "/api/site/request/fold-lane-bakery/" + key, scenario: sc }), "");
  assert.equal(wallRefusal({ method: "GET", pathname: "/api/site/request/fold-lane-bakery/" + key, scenario: sc }), "");
  assert.equal(wallRefusal({ method: "GET", pathname: "/api/site/requests/fold-lane-bakery", scenario: sc }), "");
  assert.ok(wallRefusal({ method: "POST", pathname: "/api/site/request/fold-lane-bakery/" + key + "/approve", body: "{\"part\":0}", scenario: sc }), "the go-ahead went out");
  assert.ok(wallRefusal({ method: "POST", pathname: "/api/site/fold-lane-bakery/question", body: "{}", scenario: sc }), "a question's cancel went out");
  // AN EDIT SCENARIO THAT IS NOT IN REQUEST MODE STILL POSTS ITS OWN EDIT.
  assert.equal(wallRefusal({ method: "POST", pathname: "/api/site/fold-lane-bakery/edit", body: JSON.stringify({ layer: "data" }), scenario: UI_SCENARIOS["4b-d1-price"] }), "");
});

test("the add-on step beside the edit layers: an add-on part and an edit part at a listed layer pass, by whoever routed it; any other layer, or the go-ahead, is stopped", () => {
  const sc = UI_SCENARIOS["rq-2-wholesale"];
  const view = (parts) => ({ parts });
  assert.equal(requestWall(view([{ n: 0, status: "started", route: "addon" }, { n: 1, status: "queued", route: "data" }]), sc, sc.steps[0]), null);
  assert.equal(requestWall(view([{ n: 2, status: "queued", route: "nav", addition: true }]), sc, sc.steps[0]), null);
  assert.equal(requestWall(view([{ n: 2, status: "queued", route: "nav" }]), sc, sc.steps[0]), null, "an edit the router chose was refused for not being a hand-over");
  assert.match(requestWall(view([{ n: 1, status: "queued", route: "rules" }]), sc, sc.steps[0]).why, /rules layer/);
  assert.match(requestWall(view([{ n: 1, status: "queued", route: "picture" }]), sc, sc.steps[0]).why, /picture layer/);
  assert.match(requestWall(view([{ n: 0, status: "approval" }]), sc, sc.steps[0]).why, /go-ahead/);
  // A PRESS THAT KEEPS THE ADD-ON SHUT stops an add-on part.
  assert.match(requestWall(view([{ n: 1, status: "queued", route: "addon" }]), UI_SCENARIOS["rq-4-logo"], null).why, /add-on step/);
  assert.equal(routeAllowed("addon", sc), true);
  assert.equal(routeAllowed("addon", UI_SCENARIOS["rq-canary"]), false);
  assert.equal(routeAllowed("page", sc), true);
  assert.equal(routeAllowed("", sc), false);
  // AND THE ONE-MESSAGE VERDICT AGREES ABOUT THE ADD-ON STEP.
  const step = { say: "x", network: [{ method: "POST", path: "/api/site/route", req: { message: "x" }, res: { ok: true, intent: "addon", cost: 2, request: { key: "k".repeat(24) } } }],
    request: { key: "k".repeat(24), wall: null, final: { ended: true, state: "done", parts: [{ n: 0, status: "done", route: "addon" }, { n: 1, status: "done", route: "data" }] } } };
  assert.equal(requestVerdict(step, sc).ok, true, JSON.stringify(requestVerdict(step, sc)));
  assert.equal(requestVerdict(step, UI_SCENARIOS["rq-canary"]).ok, false);
});

// ── A STEP'S QUESTION, SHOWN ─────────────────────────────────────────────────

const KEY = "rqfacebook0000000000001";
const waitingView = (over = {}) => ({
  key: KEY, ended: false, state: "waiting",
  parts: [
    { n: 0, status: "done", route: "text", ids: ["j1"], jobs: ["j1"] },
    { n: 1, status: "waiting", route: "addon", ids: ["j2"], jobs: ["j2"], question: { id: "q1", text: "What is your Facebook page's address?", options: [] } },
  ],
  ...over,
});
const pageState = (over = {}) => ({ ask: { id: "q1", text: "What is your Facebook page's address?", key: KEY, part: 1 }, askCard: true, requests: { [KEY]: { closed: false, ended: false, shown: ["j1", "j2"] } }, ...over });

test("a step's question is shown when its part waits, nothing else runs, the page keeps that very question for that part with its card, and every reply so far is on screen", () => {
  assert.deepEqual(questionShown(waitingView(), pageState(), KEY), { by: "step", key: KEY, part: 1, id: "q1", text: "What is your Facebook page's address?" });
  const v = waitingView();
  v.parts.push({ n: 2, status: "queued", route: "nav", ids: ["j3"], jobs: [] });
  assert.equal(questionShown(v, pageState(), KEY), null, "a question was taken while another part was about to run");
  const queued = waitingView();
  queued.parts[1].question.queued = true;
  assert.equal(questionShown(queued, pageState(), KEY), null, "a question waiting its turn was taken as shown");
  assert.equal(questionShown(waitingView(), pageState({ askCard: false }), KEY), null, "a question with no card drawn was taken as shown");
  assert.equal(questionShown(waitingView(), pageState({ ask: { id: "q1", text: "x", key: "another0000000000000000", part: 1 } }), KEY), null, "another request's question was taken");
  assert.equal(questionShown(waitingView(), pageState({ ask: { id: "q1", text: "x", key: KEY, part: 0 } }), KEY), null, "a question noted for another part was taken");
  // A QUESTION DRAWN FROM ITS STEP'S OWN REPLY is kept by the page without its
  // request and part (`clarifyOf` keeps the id, the words and the answers): it
  // is matched by its id.
  assert.deepEqual(questionShown(waitingView(), pageState({ ask: { id: "q1", text: "What is your Facebook page's address?", key: "", part: null } }), KEY),
    { by: "step", key: KEY, part: 1, id: "q1", text: "What is your Facebook page's address?" });
  assert.equal(questionShown(waitingView(), pageState({ ask: { id: "q9", text: "x", key: KEY, part: 1 } }), KEY), null, "an older question was taken");
  assert.equal(questionShown(waitingView(), pageState({ ask: null }), KEY), null);
  assert.equal(questionShown(waitingView(), pageState({ requests: { [KEY]: { closed: false, ended: false, shown: ["j2"] } } }), KEY), null, "the question was taken before part 0's reply was on screen");
  assert.equal(questionShown({ ...waitingView(), parts: waitingView().parts.map((p) => ({ ...p, status: "done" })) }, pageState(), KEY), null);
  assert.equal(questionShown(null, pageState(), KEY), null);
});

// ── THE ROUTING EVIDENCE AND THE PUBLISHES' ORDER ────────────────────────────

test("the routing evidence is this very message's answer — part 0's route, the parts held back and their order, the model's own say — and the request as it began and ended", () => {
  const step = {
    network: [{ method: "POST", path: "/api/site/route", req: { message: "m" }, res: {
      ok: true, intent: "edit", layer: "look", cost: 2, alsoAsked: ["add a Classes page that explains the classes"],
      dependsOn: [{ change: 0, after: [1] }], decision: { source: "model", reasons: ["also-several"], raw: { intent: "edit", layer: "look" } },
      request: { key: "rqclasses0000000000001", parts: [{ n: 0, words: "Change … menu", status: "blocked" }, { n: 1, words: "add a Classes page that explains the classes", status: "ready" }] },
    } }],
    request: { final: { parts: [{ n: 0, words: "Change … menu", status: "done", route: "look", ids: ["a", "b"] }, { n: 1, words: "add a Classes page that explains the classes", status: "done", route: "addon", ids: ["c"] }] } },
  };
  const g = routingEvidence(step);
  assert.equal(g.intent, "edit");
  assert.equal(g.layer, "look");
  assert.equal(g.cost, 2);
  assert.deepEqual(g.alsoAsked, ["add a Classes page that explains the classes"]);
  assert.deepEqual(g.dependsOn, [{ change: 0, after: [1] }]);
  assert.equal(g.decision.source, "model");
  assert.deepEqual(g.decision.raw, { intent: "edit", layer: "look" });
  assert.equal(g.request, "rqclasses0000000000001");
  assert.deepEqual(g.accepted.map((p) => p.status), ["blocked", "ready"]);
  assert.deepEqual(g.final.map((p) => `${p.n}:${p.status}@${p.route}:${p.jobs}`), ["0:done@look:2", "1:done@addon:1"]);
  assert.equal(routingEvidence({ network: [] }), null);
  // ONE STRING HELD BACK IS A LIST OF ONE.
  assert.deepEqual(routingEvidence({ network: [{ method: "POST", path: "/api/site/route", res: { alsoAsked: "x" } }] }).alsoAsked, ["x"]);
});

test("a request's publishes are put in the order they were made, by their own links, and whatever does not join the chain is left for the chain's verdict to name", () => {
  const before = "01790923788063-bp9rcv";
  const a = { job: "pageJob", id: "01790923790000-aaaaaa", parent: before };
  const b = { job: "linkJob", id: "01790923800000-bbbbbb", parent: a.id };
  const c = { job: "descJob", id: "01790923810000-cccccc", parent: b.id };
  // NUMBERED ORDER: the link's part (0) before the page's (1), though the page published first.
  assert.deepEqual(chainOrdered(before, [b, c, a]).map((p) => p.job), ["pageJob", "linkJob", "descJob"]);
  const stray = { job: "stray", id: "01790923820000-dddddd", parent: "01790000000000-zzzzzz" };
  assert.deepEqual(chainOrdered(before, [stray, b, a]).map((p) => p.job), ["pageJob", "linkJob", "stray"]);
  assert.deepEqual(chainOrdered(before, []), []);
  // AND THE CHAIN'S OWN VERDICT IS MET ONLY BY THE ORDER THAT WAS MADE.
  const at = (v) => ({ "/": { version: v } });
  assert.equal(chainVerdict({ before, published: chainOrdered(before, [b, a]), wait: { kind: "match" }, after: at(b.id) }).verified, true);
  assert.equal(chainVerdict({ before, published: [b, a], wait: { kind: "match" }, after: at(b.id) }).verified, false);
});

// ── A HEADING CHANGED, THAT TEXT ONLY ────────────────────────────────────────

const VISIT = fs.readFileSync(ROOT + "test/fixtures/run47/visit.before.tsx", "utf8");
const GALLERY = fs.readFileSync(ROOT + "test/fixtures/run47/gallery.before.tsx", "utf8");

test("a heading changed in one place only passes; a change beside it, spacing included, a heading not in the page or in it twice, and other words do not", () => {
  assert.deepEqual(headingOnly(VISIT, VISIT.replace(">Come to the bakery<", ">Come and see us<"), "Come to the bakery", "Come and see us"), { ok: true, why: "" });
  // A JSX STRING, OR AN APOSTROPHE WRITTEN ANOTHER WAY, READS AS THE SAME WORDS.
  assert.equal(headingOnly(VISIT, VISIT.replace(">Come to the bakery<", '>{"Come and see us"}<'), "Come to the bakery", "Come and see us").ok, true);
  assert.equal(headingOnly(GALLERY, GALLERY.replace("Photographs of the bakery's work", "Photographs from the bakery"), "Photographs of the bakery's work", "Photographs from the bakery").ok, true);
  const curled = GALLERY.replace("Photographs of the bakery's work", "Photographs of the bakery’s work");
  assert.equal(headingOnly(curled, curled.replace("Photographs of the bakery’s work", "Photographs from the bakery"), "Photographs of the bakery's work", "Photographs from the bakery").ok, true);
  const beside = VISIT.replace(">Come to the bakery<", ">Come and see us<").replace("Walk in for whatever", "Drop in for whatever");
  assert.match(headingOnly(VISIT, beside, "Come to the bakery", "Come and see us").why, /beyond that heading/);
  const spaced = VISIT.replace(">Come to the bakery<", ">Come and see us<").replace("export const Route", "export  const Route");
  assert.match(headingOnly(VISIT, spaced, "Come to the bakery", "Come and see us").why, /spacing only/);
  assert.match(headingOnly(VISIT, VISIT.replace(">Come to the bakery<", ">Come and visit<"), "Come to the bakery", "Come and see us").why, /reads "Come and visit"/);
  assert.match(headingOnly(VISIT, VISIT, "Not on the page", "x").why, /was not in the page before/);
  const twice = VISIT + "\n// Come to the bakery\n";
  assert.match(headingOnly(twice, twice, "Come to the bakery", "x").why, /more than once/);
  assert.equal(headingOnly(VISIT, VISIT, "Come to the bakery", "Come and see us").ok, false, "an unchanged page passed as changed");
});

test("a time is one spelling, and a line states its words only when nothing in its clause denies them", () => {
  assert.equal(timeWords("Orders close at 8 PM"), "Orders close at 8pm");
  assert.equal(timeWords("close at 8:00pm, or 8.00 p.m."), "close at 8pm, or 8pm");
  assert.equal(timeWords("orders close at 20:00"), "orders close at 8pm");
  assert.equal(statesAll("Orders close at 8pm the night before.", ["8pm", "night before"]), true);
  assert.equal(statesAll("Orders close at 20:00 the night before collection.", ["8pm", "night before"]), true);
  assert.equal(statesAll("Orders don't close at 8pm the night before.", ["8pm", "night before"]), false);
  assert.equal(statesAll("Orders close at 9pm the night before.", ["8pm", "night before"]), false);
  assert.equal(statesAll("Orders close at 8pm.", ["8pm", "night before"]), false);
  assert.equal(statesAll("", ["8pm"]), false);
});

test("a description names its stems at the start of a word: \"class\" names \"classes\", \"bread\" names \"bread-making\", and \"subclass\" names no class", () => {
  assert.equal(namesAll("Now running Saturday bread-making classes.", ["saturday", "bread", "class"]), true);
  assert.equal(namesAll("A subclass of loaf.", ["class"]), false);
  assert.equal(namesAll("Neighbourhood sourdough in Bristol.", ["class"]), false);
  assert.equal(namesAll("x", []), false, "nothing to look for named everything");
  assert.equal(namesAll("x", [""]), false, "an empty stem named everything");
  assert.equal(statesAll("x", []), false, "nothing to look for was stated");
});

test("a page file serves the route its own createFileRoute names; a served page's header logo and description are read as a visitor is served them", () => {
  assert.equal(routeOfPage(VISIT), "/visit");
  assert.equal(routeOfPage("no route here"), "");
  assert.equal(pageForRoute([{ path: "visit.tsx", source: VISIT }, { path: "gallery.tsx", source: GALLERY }], "/gallery").path, "gallery.tsx");
  assert.equal(pageForRoute([{ path: "visit.tsx", source: VISIT }], "/order"), null);
  const html = `<header><a href="/"><img src="https://fold-lane-bakery.gofarther.app/u/fold-lane-bakery/abc.png" alt=""/></a><img src="/other.png"/></header><main><img src="/u/fold-lane-bakery/photo.webp"/></main>`;
  assert.deepEqual(headerLogos(html, SLUG), ["/u/fold-lane-bakery/abc.png"], "a photo in the page, or an image off the upload path, was read as the logo");
  assert.equal(servedDescription('<meta name="description" content="Browse today&#x27;s bake &amp; more"/>'), "Browse today's bake & more");
  assert.equal(servedDescription("<p>no meta</p>"), "");
});

// ── ONE MESSAGE, AS A REQUEST ────────────────────────────────────────────────

const routeCall = (say, res) => ({ method: "POST", path: "/api/site/route", req: { message: say }, res: { ok: true, cost: 2, ...res } });
const doneStep = (over = {}) => {
  const say = WORDS["rq-1-classes"][0];
  return {
    n: 1, sent: true, say, mode: "",
    network: [routeCall(say, { intent: "edit", layer: "look", request: { key: "rqclasses0000000000001", parts: [] } })],
    request: { key: "rqclasses0000000000001", wall: null, final: { ended: true, state: "done", parts: [{ n: 0, status: "done", route: "look" }, { n: 1, status: "done", route: "addon" }] } },
    ...over,
  };
};

test("a message taken on as a request passes when one routing call carried its words, the page posted nothing, and the request ended with every part done where the press allows", () => {
  const sc = UI_SCENARIOS["rq-1-classes"];
  assert.deepEqual(failed(requestStepChecks(doneStep(), sc)), []);
  const posted = doneStep();
  posted.network.push({ method: "POST", path: "/api/site/fold-lane-bakery/edit", req: { layer: "look" } });
  assert.ok(failed(requestStepChecks(posted, sc)).some((f) => /posted no edit/.test(f)));
  const running = doneStep();
  running.request.final = { ...running.request.final, ended: false, state: "running" };
  assert.ok(failed(requestStepChecks(running, sc)).some((f) => /request ended/.test(f)));
  const offWall = doneStep();
  offWall.request.final.parts[1] = { n: 1, status: "done", route: "rules" };
  assert.ok(failed(requestStepChecks(offWall, sc)).some((f) => /every part done/.test(f)));
  const walled = doneStep();
  walled.request.wall = { n: 1, why: "a part routed to the rules layer" };
  assert.ok(failed(requestStepChecks(walled, sc)).some((f) => /stopped by the wall/.test(f)));
  const twice = doneStep();
  twice.network.push(routeCall(twice.say, { intent: "edit" }));
  assert.ok(failed(requestStepChecks(twice, sc)).some((f) => /one routing call/.test(f)));
  const notReq = doneStep({ network: [routeCall(WORDS["rq-1-classes"][0], { intent: "edit", layer: "look" })], request: null });
  assert.ok(failed(requestStepChecks(notReq, sc)).some((f) => /taken on as a request/.test(f)));
  assert.deepEqual(requestStepChecks({ n: 2, sent: false }, sc).map((c) => c.ok), [false]);
  // A FILE RIDES THE ROUTING CALL, BYTE FOR BYTE.
  const withFile = doneStep({ file: { sha256: "a".repeat(64) } });
  withFile.network[0].req.images = [{ sha256: "a".repeat(64) }];
  assert.deepEqual(failed(requestStepChecks(withFile, sc)), []);
  withFile.network[0].req.images = [{ sha256: "b".repeat(64) }];
  assert.ok(failed(requestStepChecks(withFile, sc)).some((f) => /rode the routing call/.test(f)));
});

test("a message that ends on a question passes on a step's question with nothing else running, or records the router's own question as another valid path", () => {
  const sc = UI_SCENARIOS["rq-3-facebook"];
  const say = WORDS["rq-3-facebook"][0];
  const step = (question, final, res = { intent: "edit", layer: "text", request: { key: KEY, parts: [] } }) => ({ n: 1, sent: true, say, mode: "question", question, network: [routeCall(say, res)], request: res.request ? { key: KEY, wall: null, final } : null });
  assert.deepEqual(failed(requestStepChecks(step({ by: "step", key: KEY, part: 1 }, waitingView()), sc)), []);
  assert.ok(failed(requestStepChecks(step(null, waitingView()), sc)).length, "no question passed");
  const busy = waitingView();
  busy.parts.push({ n: 2, status: "started", route: "nav" });
  assert.ok(failed(requestStepChecks(step({ by: "step", key: KEY, part: 1 }, busy), sc)).length, "a question with another part running passed");
  const router = step({ by: "router", key: "", part: null }, null, { intent: "clarify", question: { id: "r1", text: "Which Facebook page?" } });
  const r = requestStepChecks(router, sc);
  assert.deepEqual(failed(r), []);
  assert.ok(r.some((c) => /another valid path/.test(c.name)), "the router's question was not named as another path");
});

test("a message sent with its tab closed passes only when the request ended while no page was open, nothing read its route meanwhile, and the tab opened afterwards showed it ended", () => {
  const sc = UI_SCENARIOS["rq-5-away"];
  const ok = () => doneStep({ say: WORDS["rq-5-away"][0], network: [routeCall(WORDS["rq-5-away"][0], { intent: "addon", request: { key: "rqaway000000000000001", parts: [] } })],
    request: { key: "rqaway000000000000001", wall: null, final: { ended: true, state: "done", parts: [{ n: 0, status: "done", route: "addon" }, { n: 1, status: "done", route: "text" }] } },
    mode: "away", away: { closed: true, ended: true, reads: 4, calls: [], endedMs: 61_000, reopened: { ok: true, closed: true, why: "" } } });
  assert.deepEqual(failed(requestStepChecks(ok(), sc)), []);
  const read = ok(); read.away.calls = [{ method: "GET", path: "/api/site/request/fold-lane-bakery/rqaway000000000000001" }];
  assert.ok(failed(requestStepChecks(read, sc)).some((f) => /nothing read/.test(f)));
  const late = ok(); late.away.ended = false;
  assert.ok(failed(requestStepChecks(late, sc)).some((f) => /while no page was open/.test(f)));
  const shut = ok(); shut.away.reopened = { ok: true, closed: false, why: "the reopened page never showed the request closed" };
  assert.ok(failed(requestStepChecks(shut, sc)).some((f) => /opened afterwards/.test(f)));
  const open = ok(); open.away.closed = false;
  assert.ok(failed(requestStepChecks(open, sc)).length >= 2);
});

// ── NO PART BEFORE THE PART IT NEEDS ─────────────────────────────────────────

const orderedStep = (trail, res = {}) => ({
  network: [routeCall("m", {
    intent: "edit", layer: "look", alsoAsked: ["add a Classes page that explains the classes"], dependsOn: [{ change: 0, after: [1] }],
    request: { key: "rqclasses0000000000001", parts: [{ n: 0, words: "Change … menu …", status: "blocked" }, { n: 1, words: "add a Classes page that explains the classes", status: "ready" }] },
    ...res,
  })],
  request: { trail },
});

test("the order the router gave is mapped onto the request's parts, and every view the canary read must show no part started before the part it needs was done", () => {
  const good = orderedStep([
    { ms: 2_000, parts: [[0, "blocked"], [1, "started"]] },
    { ms: 90_000, parts: [[0, "queued"], [1, "done"]] },
    { ms: 140_000, parts: [[0, "done"], [1, "done"]] },
  ]);
  assert.deepEqual(relationsOf(good).relations, [{ part: 0, needs: 1 }]);
  assert.deepEqual(relationsOf(good).blocked, [0]);
  const v = jobOrderVerdict(good);
  assert.equal(v.ok, true, v.why);
  assert.equal(v.vacuous, undefined);
  const bad = orderedStep([{ ms: 2_000, parts: [[0, "started"], [1, "started"]] }, { ms: 9_000, parts: [[0, "done"], [1, "done"]] }]);
  const w = jobOrderVerdict(bad);
  assert.equal(w.ok, false);
  assert.match(w.why, /part 0 was started while part 1, which it needs, was started/);
  // NO ORDER NAMED: nothing to order, said so.
  const none = jobOrderVerdict(orderedStep([], { dependsOn: undefined }));
  assert.equal(none.ok, true);
  assert.equal(none.vacuous, true);
  // AN ORDER NEVER WATCHED cannot be said to hold.
  assert.equal(jobOrderVerdict(orderedStep([])).ok, false);
  // A CHANGE THE REQUEST FOLDED INTO ANOTHER is counted, never guessed.
  const folded = orderedStep([{ ms: 1, parts: [[0, "done"], [1, "done"]] }], { alsoAsked: ["words no part carries"] });
  assert.deepEqual(relationsOf(folded).relations, []);
  assert.equal(relationsOf(folded).unread.length, 1);
});

// ── THE REPLIES ──────────────────────────────────────────────────────────────

const final = (job, res) => ({ method: "GET", path: `/api/site/edit/${job}`, final: true, status: 200, res });

test("each part's reply passes when it is the model's own and on screen; a composed reply, one off screen or one never read fails; a question passes on screen; each job is judged once", () => {
  const view = { ended: true, parts: [{ n: 0, jobs: ["j1"] }, { n: 1, jobs: ["j2", "j4"] }] };
  const steps = [
    { n: 1, sent: true, replies: ["I changed the Visit page's heading to “Our shop on the street”.", "What is your Facebook page's address?"],
      network: [final("j1", { ok: true, msg: "✅ Changed.", reply: "I changed the Visit page's heading to “Our shop on the street”.", replySource: "model" }),
        final("j2", { ok: false, clarify: { id: "q1", text: "What is your Facebook page's address?" } })],
      request: { final: { parts: [{ n: 0, jobs: ["j1"] }, { n: 1, jobs: ["j2"] }] } } },
    { n: 2, sent: true, replies: ["Your footer now links to facebook.com/harbourloafbristol, beside Instagram."],
      network: [final("j4", { ok: true, msg: "✅ Added.", reply: "Your footer now links to facebook.com/harbourloafbristol, beside Instagram.", replySource: "model" })],
      request: { final: view } },
  ];
  const c = replyChecks(steps);
  assert.deepEqual(failed(c), []);
  assert.equal(c.length, 3, "a job was judged twice, or one was missed");
  assert.deepEqual(repliesOf(steps[0]).map((r) => r.source), ["model", "question"]);
  const composed = JSON.parse(JSON.stringify(steps));
  composed[1].network[0].res = { ok: true, msg: "✅ Added a link." };
  composed[1].replies = ["✅ Added a link."];
  assert.ok(failed(replyChecks(composed)).some((f) => /composed/.test(f)));
  const off = JSON.parse(JSON.stringify(steps));
  off[1].replies = ["something else"];
  assert.ok(failed(replyChecks(off)).some((f) => /not on screen/.test(f)));
  const unread = JSON.parse(JSON.stringify(steps));
  unread[1].network = [];
  assert.ok(failed(replyChecks(unread)).some((f) => /unread/.test(f)));
  // THE REQUEST'S OWN REPLY is judged the same way.
  const own = JSON.parse(JSON.stringify(steps));
  own[1].request.reply = { text: "One part could not be finished.", source: "model", for: "end" };
  assert.ok(failed(replyChecks(own)).some((f) => /request's own reply/.test(f)));
  own[1].replies.push("One part could not be finished.");
  assert.deepEqual(failed(replyChecks(own)), []);
  assert.deepEqual(failed(replyChecks([{ n: 1, sent: true, network: [], replies: [], request: { final: { parts: [] } } }])).length, 1);
});

// ── WHAT LANDED: THE BAKERY'S OWN PAGES, CHANGED BY THE PRODUCT'S WRITERS ─────

const RUN47 = ["index", "visit", "order", "gallery", "starter"].map((n) => ({ path: n + ".tsx", source: fs.readFileSync(ROOT + "test/fixtures/run47/" + n + ".before.tsx", "utf8") }));
const OLD_LOGO = "/u/fold-lane-bakery/2cc633d73b2d5ab38d29d94cf15c9ce6.png";
const NEW_SHA = "38d29a0457eedf0f9778d4a9f4104d279fffe622c2f61a22e0989d92ee9d1c0e";
const NEW_LOGO = "/u/fold-lane-bakery/38d29a0457eedf0f9778d4a9f4104d27.png";
const DESC0 = "Neighbourhood sourdough in Bristol. Browse today's bake and order a loaf for collection.";
const DESC1 = "Neighbourhood sourdough in Bristol, and now Saturday bread-making classes. Browse today's bake and order a loaf.";
const HEADINGS = {
  "/": ["Harbour Loaf", "Fed every morning since we opened", "Order a loaf for collection"],
  "/visit": ["Come to the bakery", "The shutters and the street", "Order a collection so we hold a loaf"],
  "/order": ["Order a loaf", "Pick a loaf and a collection slot"],
  "/gallery": ["Our Gallery", "Photographs of the bakery's work"],
  "/starter": ["This page isn't finished yet"],
};
const TABLES = { ok: true, names: ["loaves", "orders"], tables: {
  loaves: { access: "anyone reads, you write", pair: null, rows: 7, columns: ["id", "name", "description", "price", "photo", "created_at"] },
  orders: { access: "visitors add, you read", pair: null, rows: 12, columns: ["id", "loaf", "slot", "name", "created_at"] },
} };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
/** The site as the canary reads it: the stored pages, each route's served page drawn from them, and the stored description. */
function site(pages, { headings = HEADINGS, logo = OLD_LOGO, description = DESC0, main = {}, status = {} } = {}) {
  const frames = frameOf(pages);
  const served = {}, render = {};
  for (const p of pages) {
    const route = routeOfPage(p.source);
    const f = frames.get(p.path) || { menus: [], social: [] };
    const hs = headings[route] || [];
    // A HEADER AND A FOOTER ONLY WHERE THE STORED PAGE CARRIES A FRAME, as the
    // bakery's unfinished page carries none.
    const framed = frames.has(p.path);
    served[route] = "<!doctype html><html><head>" + (route === "/" ? `<meta name="description" content="${esc(description)}"/>` : "") + "</head><body>" +
      (framed ? `<header><a href="/"><img src="${logo}" alt="Harbour Loaf"/></a><nav>${(f.menus[0] || []).map((m) => `<a href="${m.href}">${esc(m.label)}</a>`).join("")}</nav></header>` : "") +
      `<main>${hs.map((h, i) => `<h${i ? 2 : 1}>${esc(h)}</h${i ? 2 : 1}>`).join("")}${main[route] || ""}</main>` +
      (framed ? `<footer>${f.social.map((s) => `<a href="${s.href}">${s.network}</a>`).join("")}</footer>` : "") + "</body></html>";
    render[route] = { status: status[route] || 200, headings: hs };
  }
  return { inv: { complete: true, source: { pages, parts: [] }, render, stored: { ok: true, description } }, served };
}
const edit = (pages, path, from, to) => pages.map((p) => (p.path === path ? { ...p, source: p.source.replace(from, to) } : p));
const judge = (spec, b, a, extra = {}) => outcomeChecks({ spec, before: b.inv, after: a.inv, served: a.served, beforeServed: b.served, tables: { before: TABLES, after: TABLES }, slug: SLUG, ...extra });

// A NEW PAGE CARRIES THE SITE'S FRAME, as the add-on writes one: its own menu,
// so the served page has a header and a logo of its own (a page the press
// added had no logo before to keep).
const CLASSES = [
  'import { createFileRoute } from "@tanstack/react-router";',
  'import { SiteChrome } from "@/components/ui/site-chrome";',
  'export const Route = createFileRoute("/classes")({ component: Classes });',
  "const CHROME = {",
  '  name: "Harbour Loaf",',
  "  links: [",
  '    { label: "Today\'s bake", href: "/" },',
  '    { label: "Classes", href: "/classes" },',
  "  ],",
  "};",
  "function Classes() {",
  "  return <SiteChrome {...CHROME}><main><h1>Saturday bread-making classes</h1><p>Learn to shape and bake a sourdough loaf with us, every Saturday morning.</p></main></SiteChrome>;",
  "}",
  "",
].join("\n");
const r1After = (over = {}) => {
  const pages = applyNav(RUN47, (items) => [...items, { label: "Classes", href: "/classes" }]).pages.concat([{ path: "classes.tsx", source: CLASSES }]);
  return site(over.pages || pages, {
    headings: { ...HEADINGS, "/classes": ["Saturday bread-making classes"] }, description: over.description || DESC1,
    main: { "/classes": "<p>Learn to shape and bake a sourdough loaf with us, every Saturday morning.</p>" }, status: over.status || {},
  });
};

test("R1 lands when the description says the classes, a new page about them is stored and served 200, and every menu gains its link — with everything else as it was", () => {
  const spec = UI_SCENARIOS["rq-1-classes"];
  const o = judge(spec, site(RUN47), r1After());
  assert.deepEqual(failed(o.checks), []);
  assert.equal(o.newPages.found[0].route, "/classes");
  assert.equal(o.newPages.found[0].path, "classes.tsx");
  // THE ADDRESS IS THE ADD-ON'S TO CHOOSE: another one, linked, lands the same.
  const elsewhere = applyNav(RUN47, (items) => [...items, { label: "Classes", href: "/bread-classes" }]).pages.concat([{ path: "bread-classes.tsx", source: CLASSES.replace('"/classes"', '"/bread-classes"') }]);
  const e = site(elsewhere, { headings: { ...HEADINGS, "/bread-classes": ["Saturday bread-making classes"] }, description: DESC1, main: { "/bread-classes": "<p>Bake with us.</p>" } });
  assert.deepEqual(failed(judge(spec, site(RUN47), e).checks), []);
});

test("R1 does not land when a menu lacks the link, the link points elsewhere, the page answers 404, the description misses a word, a second page appears, or another page or a table moved", () => {
  const spec = UI_SCENARIOS["rq-1-classes"];
  const b = site(RUN47);
  const one = (a, re, extra) => { const f = failed(judge(spec, b, a, extra).checks); assert.ok(f.some((x) => re.test(x)), `expected ${re}, got ${JSON.stringify(f)}`); };
  const partial = r1After().inv.source.pages.map((p) => (p.path === "gallery.tsx" ? RUN47.find((q) => q.path === "gallery.tsx") : p));
  one(r1After({ pages: partial }), /every page's menu gained "Classes"/);
  const wrong = applyNav(RUN47, (items) => [...items, { label: "Classes", href: "/visit" }]).pages.concat([{ path: "classes.tsx", source: CLASSES }]);
  one(r1After({ pages: wrong }), /every page's menu gained "Classes"/);
  one(r1After({ status: { "/classes": 404 } }), /new page about class/);
  one(r1After({ description: "Neighbourhood sourdough in Bristol, and now bread-making classes." }), /stored description now names/);
  const extra = r1After();
  extra.inv.render["/events"] = { status: 200, headings: ["Events"] };
  extra.served["/events"] = "<main>Events</main>";
  one(extra, /no other page was added/);
  const moved = r1After();
  moved.inv.source.pages = edit(moved.inv.source.pages, "visit.tsx", "Walk in for whatever", "Drop in for whatever");
  one(moved, /byte for byte as it was/);
  one(r1After(), /tables are as they were/, { tables: { before: TABLES, after: { ...TABLES, names: [...TABLES.names, "class_bookings"], tables: { ...TABLES.tables, class_bookings: { access: "visitors add", rows: 0, columns: ["id"] } } } } });
  one(r1After(), /tables are as they were/, { tables: { before: TABLES, after: { ...TABLES, tables: { ...TABLES.tables, orders: { ...TABLES.tables.orders, access: "closed" } } } } });
  one(r1After(), /orders 12 -> 13 rows/, { tables: { before: TABLES, after: { ...TABLES, tables: { ...TABLES.tables, orders: { ...TABLES.tables.orders, rows: 13 } } } } });
  one(r1After(), /loaves's columns changed/, { tables: { before: TABLES, after: { ...TABLES, tables: { ...TABLES.tables, loaves: { ...TABLES.tables.loaves, columns: [...TABLES.tables.loaves.columns, "allergens"] } } } } });
  one(r1After(), /tables were read/, { tables: { before: TABLES, after: { ok: false, why: "status 503" } } });
  const shown = r1After();
  shown.served["/"] = shown.served["/"].replace(esc(DESC1), esc(DESC0));
  one(shown, /served home page carries that description/);
  const gone = r1After();
  gone.inv.source.pages = gone.inv.source.pages.filter((p) => p.path !== "starter.tsx");
  one(gone, /no stored page was removed/);
  const incomplete = r1After();
  incomplete.inv.complete = false;
  one(incomplete, /source reads are complete/);
});

const IG = { network: "instagram", href: "https://instagram.com/harbourloaf" };
const FB = { network: "facebook", href: "https://www.facebook.com/harbourloafbristol/" };
const R3_BEFORE = applyChromeList(RUN47, "social", [IG]).pages;
const r3After = (social = (items) => [...items, FB], heading = 'title="Our shop on the street"') => {
  const pages = applyChromeList(edit(R3_BEFORE, "visit.tsx", 'title="The shutters and the street"', heading), "social", social).pages;
  return site(pages, { headings: { ...HEADINGS, "/visit": ["Come to the bakery", "Our shop on the street", "Order a collection so we hold a loaf"] } });
};

test("R3 lands when the Visit heading reads the new words and every footer gains the one Facebook link beside Instagram — any spelling of the address that is the profile", () => {
  const spec = UI_SCENARIOS["rq-3-facebook"];
  assert.deepEqual(failed(judge(spec, site(R3_BEFORE), r3After()).checks), []);
  const lost = failed(judge(spec, site(R3_BEFORE), r3After(() => [FB])).checks);
  assert.ok(lost.some((f) => /kept every link it had/.test(f)), JSON.stringify(lost));
  const other = failed(judge(spec, site(R3_BEFORE), r3After((items) => [...items, { network: "facebook", href: "https://facebook.com/harbourloaf" }])).checks);
  assert.ok(other.some((f) => /facebook link to facebook\.com\/harbourloafbristol/.test(f)), "a guessed address passed");
  const heading = failed(judge(spec, site(R3_BEFORE), r3After(undefined, 'title="Our shop"')).checks);
  assert.ok(heading.some((f) => /byte for byte/.test(f)), "a heading made of other words passed as the named change");
});

const ORDER_H1 = '<h1 className="text-3xl font-semibold tracking-tight">Order a loaf</h1>';
const r5After = (line = "Orders close at 8pm the night before.") => {
  let pages = edit(RUN47, "order.tsx", ORDER_H1, `${ORDER_H1}\n        <p className="mt-2 text-sm">${line}</p>`);
  pages = edit(pages, "gallery.tsx", "Photographs of the bakery's work", "Photographs from the bakery");
  return site(pages, { headings: { ...HEADINGS, "/gallery": ["Our Gallery", "Photographs from the bakery"] }, main: { "/order": `<p>${esc(line)}</p>` } });
};

test("R5 lands when the Order page gains a line stating when orders close, undenied and in any spelling of the time, and the Gallery heading reads the new words", () => {
  const spec = UI_SCENARIOS["rq-5-away"];
  assert.deepEqual(failed(judge(spec, site(RUN47), r5After()).checks), []);
  assert.deepEqual(failed(judge(spec, site(RUN47), r5After("Orders close at 20:00 the night before collection.")).checks), []);
  const denied = failed(judge(spec, site(RUN47), r5After("Orders don't close at 8pm the night before.")).checks);
  assert.ok(denied.some((f) => /gained a line/.test(f)), JSON.stringify(denied));
  const lost = r5After();
  lost.inv.source.pages = edit(lost.inv.source.pages, "order.tsx", "Pick a loaf and a collection slot", "Pick a loaf");
  assert.ok(failed(judge(spec, site(RUN47), lost).checks).some((f) => /still says everything it said/.test(f)));
});

const r4Spec = { ...UI_SCENARIOS["rq-4-logo"], expect: { ...UI_SCENARIOS["rq-4-logo"].expect, headings: [{ route: "/visit", from: "Come to the bakery", to: "Come and see us" }] } };
const r4After = (logo = NEW_LOGO) => site(edit(RUN47, "visit.tsx", ">Come to the bakery<", ">Come and see us<"), { logo, headings: { ...HEADINGS, "/visit": ["Come and see us", "The shutters and the street", "Order a collection so we hold a loaf"] } });
const LOGO_READ = { url: NEW_LOGO, status: 200, bytes: 1224, sha256: NEW_SHA };

test("R4 lands when every served header draws the attached picture at the address its own bytes name, and the bytes served there are the file's", () => {
  assert.equal(NEW_LOGO, `/u/${SLUG}/${NEW_SHA.slice(0, 32)}.png`);
  assert.deepEqual(failed(judge(r4Spec, site(RUN47), r4After(), { logo: LOGO_READ }).checks), []);
  assert.ok(failed(judge(r4Spec, site(RUN47), r4After(OLD_LOGO), { logo: LOGO_READ }).checks).some((f) => /draws the attached picture/.test(f)));
  assert.ok(failed(judge(r4Spec, site(RUN47), r4After(), { logo: { ...LOGO_READ, sha256: "f".repeat(64) } }).checks).some((f) => /served bytes/.test(f)));
  assert.ok(failed(judge(r4Spec, site(RUN47), r4After(), { logo: null }).checks).some((f) => /served bytes/.test(f)));
  // A PRESS THAT DOES NOT NAME THE LOGO must leave it as it was.
  const kept = failed(judge(UI_SCENARIOS["rq-canary"], site(RUN47), r4After()).checks);
  assert.ok(kept.some((f) => /draws the logo it drew before/.test(f)), JSON.stringify(kept));
});

test("R2's row lands when its baseline was right, the one field changed on both readers and on the order page, and the canary wrote nothing", () => {
  const spec = UI_SCENARIOS["rq-2-wholesale"];
  const pages = applyNav(RUN47, (items) => [...items, { label: "Wholesale", href: "/wholesale" }]).pages
    .concat([{ path: "wholesale.tsx", source: CLASSES.replace('"/classes"', '"/wholesale"') }]);
  const a = site(pages, { headings: { ...HEADINGS, "/wholesale": ["Wholesale for cafés"] }, main: { "/wholesale": "<p>Wholesale loaves for cafés, ordered in bulk.</p>" } });
  const row = { baselineVerdict: { ok: true, why: "" }, change: { exact: true, target: { from: "6", to: "6.2" }, others: [] }, visitorChange: { exact: true, target: {} },
    shown: { afterEdit: { target: "Walnut Levain Butter walnuts … £6.20", verdict: { ok: true } } } };
  assert.deepEqual(failed(judge(spec, site(RUN47), a, { row }).checks), []);
  assert.ok(failed(judge(spec, site(RUN47), a, { row: { ...row, change: { exact: false, target: {}, others: [{ id: 6 }] } } }).checks).some((f) => /database change is exactly/.test(f)));
  assert.ok(failed(judge(spec, site(RUN47), a, { row: { ...row, writes: 1 } }).checks).some((f) => /wrote no row/.test(f)));
  assert.ok(failed(judge(spec, site(RUN47), a, { row: null }).checks).some((f) => /baseline/.test(f)));
});

test("a press that names one heading lands on that heading alone; a description, a menu or a footer it did not name must be as it was", () => {
  const spec = UI_SCENARIOS["rq-canary"];
  const a = site(edit(RUN47, "visit.tsx", ">Come to the bakery<", ">Come and see us<"), { headings: { ...HEADINGS, "/visit": ["Come and see us", "The shutters and the street", "Order a collection so we hold a loaf"] } });
  assert.deepEqual(failed(judge(spec, site(RUN47), a).checks), []);
  const desc = site(a.inv.source.pages, { headings: a.inv.render ? Object.fromEntries(Object.entries(a.inv.render).map(([r, v]) => [r, v.headings])) : HEADINGS, description: DESC1 });
  assert.ok(failed(judge(spec, site(RUN47), desc).checks).some((f) => /description is what it was/.test(f)));
  const menu = site(applyNav(a.inv.source.pages, (items) => [...items, { label: "Order", href: "/order" }]).pages, { headings: { ...HEADINGS, "/visit": ["Come and see us", "The shutters and the street", "Order a collection so we hold a loaf"] } });
  assert.ok(failed(judge(spec, site(RUN47), menu).checks).some((f) => /byte for byte/.test(f)), "a menu nobody named moved and passed");
  const unchanged = failed(judge(spec, site(RUN47), site(RUN47)).checks);
  assert.ok(unchanged.some((f) => /now reads "Come and see us"/.test(f)), "a press that changed nothing passed");
});

// ── WHICH PATH THE RUN TOOK: RECORDED, NEVER A CHECK ─────────────────────────

test("coverage reads which hand-over the run went through, and a valid other path is recorded as not covered — never as a failure", () => {
  const set = (parts, accepted = 2) => [{ n: 1, sent: true, network: [routeCall("m", { request: { key: "k".repeat(24), parts: new Array(accepted).fill(0).map((_, n) => ({ n, words: "w" + n, status: "ready" })) } })], request: { final: { ended: true, parts } } }];
  const aside = coverageOf({ spec: { covers: ["addon-sets-aside", "edit-and-addon", "several-parts"] }, steps: set([{ n: 0, status: "done", route: "addon" }, { n: 1, status: "done", route: "data" }, { n: 2, words: "put a link to it in the menu", status: "done", route: "nav", addition: true }]) });
  assert.deepEqual(aside.map((c) => c.covered), [true, true, true]);
  // THE ROUTER LISTED THE LINK ITSELF: the site comes out the same, the set-aside is not covered.
  const listed = coverageOf({ spec: { covers: ["addon-sets-aside"] }, steps: set([{ n: 0, status: "done", route: "addon" }, { n: 1, status: "done", route: "nav" }, { n: 2, status: "done", route: "data" }], 3) });
  assert.equal(listed[0].covered, false);
  assert.match(listed[0].why, /no part was set aside/);
  const one = coverageOf({ spec: { covers: ["several-parts", "edit-and-addon"] }, steps: set([{ n: 0, status: "done", route: "look" }], 1) });
  assert.deepEqual(one.map((c) => c.covered), [false, false]);
  // A PREREQUISITE NAMED LATER, WAITED FOR.
  const waited = coverageOf({ spec: { covers: ["waits-for-prerequisite"] }, steps: [orderedStep([{ ms: 1, parts: [[0, "blocked"], [1, "started"]] }, { ms: 2, parts: [[0, "done"], [1, "done"]] }])] });
  assert.equal(waited[0].covered, true, waited[0].why);
  const unordered = coverageOf({ spec: { covers: ["waits-for-prerequisite"] }, steps: [orderedStep([{ ms: 1, parts: [[0, "done"], [1, "done"]] }], { dependsOn: undefined })] });
  assert.equal(unordered[0].covered, false);
  // A STEP'S QUESTION AND THE ANSWER THAT RESUMED IT.
  const q = [
    { n: 1, sent: true, mode: "question", question: { by: "step", key: KEY, part: 1 }, network: [], request: { final: waitingView() } },
    { n: 2, sent: true, network: [routeCall("It's facebook.com/harbourloafbristol", { resumed: { key: KEY, part: 1 }, request: { key: KEY } })], request: { final: waitingView() } },
  ];
  assert.deepEqual(coverageOf({ spec: { covers: ["step-question", "answer-resumes"] }, steps: q }).map((c) => c.covered), [true, true]);
  const router = [{ ...q[0], question: { by: "router", key: "", part: null } }, q[1]];
  const r = coverageOf({ spec: { covers: ["step-question", "answer-resumes"] }, steps: router });
  assert.deepEqual(r.map((c) => c.covered), [false, false]);
  assert.match(r[0].why, /router asked/);
  // THE FILE READ BY A LATER PART; THE CLOSED TAB.
  const file = [{ n: 1, sent: true, file: { sha256: "a" }, network: [], request: { final: { parts: [{ n: 0, status: "done", route: "text" }, { n: 1, status: "done", route: "logo" }] } } }];
  assert.equal(coverageOf({ spec: { covers: ["file-to-later-part"] }, steps: file })[0].covered, true);
  const first = [{ n: 1, sent: true, file: { sha256: "a" }, network: [], request: { final: { parts: [{ n: 0, status: "done", route: "logo" }] } } }];
  assert.equal(coverageOf({ spec: { covers: ["file-to-later-part"] }, steps: first })[0].covered, false);
  const away = [{ n: 1, sent: true, mode: "away", away: { closed: true, ended: true, reads: 3, calls: [], endedMs: 61_000 }, network: [], request: { final: { parts: [] } } }];
  assert.equal(coverageOf({ spec: { covers: ["closed-tab"] }, steps: away })[0].covered, true);
  assert.equal(coverageOf({ spec: { covers: ["no-such-thing"] }, steps: away })[0].covered, false);
  // NEVER IN THE CHECKS: a press whose checks pass passes with nothing covered.
  const v = requestBatchVerdict({ spec: { ...UI_SCENARIOS["rq-canary"], covers: ["several-parts"] }, steps: [], before: site(RUN47).inv, after: site(RUN47).inv, served: {}, tables: {} });
  assert.ok(v.coverage.length === 1 && !v.checks.some((c) => /several/.test(c.name)), "coverage leaked into the checks");
});

// ── THE DRIVER, THROUGH A STAND-IN APP IN REQUEST MODE ───────────────────────
//
// One browser: tabs share what the page keeps (its thread, its record of each
// request, the live question), as localStorage does. The server's request is a
// list of views, and moves one view on each time the CANARY reads it — its own
// view read through the page, or the requests list — never when a page draws
// it. An open tab shows each part's reply as the views name its jobs, keeps a
// step's question as the site's live one with its card, and closes the request
// once it has ended and every reply is on screen. Every API call a page makes
// goes through the context's routes (the canary's wall) and its request
// listeners, as in a real browser.

const RQ_KEY = (n) => "rqbatch" + "0".repeat(16) + n;
const part = (n, words, status, over = {}) => ({ n, words, status, ids: [], jobs: [], charged: 0, ...over });
const view = (key, parts, over = {}) => ({ key, state: over.ended ? "done" : "running", ended: false, stop: false, at: 1, updatedAt: 2, parts, ...over });

function rqApp(opt = {}) {
  const calls = [];
  const routes = [];
  const requestListeners = [];
  const keep = { msgs: [], requests: {}, ask: null };
  const server = { key: "", views: [], at: 0, stopped: false };
  let sends = 0;
  const now = () => (server.views.length ? JSON.parse(JSON.stringify(server.views[Math.min(server.at, server.views.length - 1)])) : null);
  const read = () => { if (server.at < server.views.length - 1) server.at++; return now(); };
  const stopIt = () => {
    const v = now();
    if (!v) return;
    v.ended = true; v.stop = true; v.state = "stopped";
    for (const p of v.parts) if (p.status !== "done") p.status = "cancelled";
    server.views = [v]; server.at = 0;
  };
  const tabs = [];
  const newTab = () => {
    const t = { id: tabs.length + 1, closed: false, workspace: false, busy: false, value: "", attached: 0, strip: 0, mark: "", origin: 1000 + tabs.length, listeners: {}, looks: 0 };
    tabs.push(t);
    const emit = async (method, path, status, req, res, headers = {}) => {
      for (const l of requestListeners) l({ url: () => ORIGIN + path, method: () => method });
      const r = { request: () => ({ url: () => ORIGIN + path, method: () => method, postData: () => (req ? JSON.stringify(req) : null) }), status: () => status, headers: () => headers, text: async () => JSON.stringify(res) };
      await Promise.all((t.listeners.response || []).map((h) => h(r)));
    };
    const throughWall = async (method, path, body) => {
      const u = new URL(ORIGIN + path);
      for (const r of routes) {
        if (typeof r.pattern === "function" && !r.pattern(u)) continue;
        let out = "fallback";
        await r.handler({ request: () => ({ url: () => u.href, method: () => method, postData: () => JSON.stringify(body) }), fallback: async () => { out = "fallback"; }, abort: async () => { out = "abort"; } });
        calls.push(`wall ${method} ${path} ${out}`);
        if (out === "abort") return false;
      }
      return true;
    };
    // THE PAGE FOLLOWS ITS REQUEST: each part's reply once — one job per look,
    // as the page polls each job in turn — a step's question kept, and the
    // request closed once it has ended and every reply is on screen.
    const follow = async () => {
      // ONLY ONCE THE SITE'S WORKSPACE IS OPEN, and — where a case says so
      // (`followAfter`) — a few looks after that, as a page reopened on a
      // finished request takes its time to fetch each part's reply.
      if (!t.workspace || ++t.looks <= (opt.followAfter || 0)) return;
      const key = server.key;
      const rec = key ? keep.requests[key] : null;
      if (!rec || rec.closed) return;
      const v = now();
      if (!v) return;
      for (const p of v.parts) {
        for (const job of p.jobs || []) {
          if (rec.shown.includes(job)) continue;
          const reply = (opt.replies || {})[job] || { ok: true, msg: "✅ Done.", reply: `Done: ${job}.`, replySource: "model" };
          await emit("GET", `/api/site/edit/${job}`, 200, null, reply, { "x-gf-edit": "final" });
          rec.shown.push(job);
          if (reply.clarify) {
            // AS THE PAGE KEEPS IT: a question read off a job's reply by
            // `clarifyOf` carries its id, words and answers, not its request.
            keep.ask = { id: reply.clarify.id, text: reply.clarify.text, key: opt.askKeepsRequest ? key : "", part: opt.askKeepsRequest ? p.n : null };
            keep.msgs.push({ who: "a", text: reply.clarify.text, ask: true });
          } else keep.msgs.push({ who: "a", text: reply.replySource === "model" ? reply.reply : reply.msg });
          return;
        }
      }
      if (v.ended) { rec.ended = true; rec.closed = true; }
    };
    const state = () => ({
      signedIn: true, uid: UID, gate: false, workspace: t.workspace, busy: t.busy,
      send: t.workspace && !t.busy, sendDisabled: t.workspace && !t.busy ? false : null, stop: t.workspace && t.busy,
      textarea: t.workspace, disabled: t.workspace ? false : null, value: t.value, working: t.busy ? 1 : 0, attached: t.attached, strip: t.strip,
      messages: keep.msgs.map((m) => ({ who: m.who, busy: false, card: !!m.card, text: m.text })),
      requests: JSON.parse(JSON.stringify(keep.requests)),
      ask: keep.ask ? { ...keep.ask } : null, askCard: !!keep.ask,
    });
    const page = {
      on: (ev, h) => { (t.listeners[ev] = t.listeners[ev] || []).push(h); },
      goto: async (url) => { calls.push(`tab ${t.id} goto ${new URL(url).pathname}`); return { headers: () => ({}) }; },
      close: async () => { calls.push(`tab ${t.id} closed`); t.closed = true; },
      evaluate: async (fn, arg) => {
        if (t.closed) throw new Error("Target page, context or browser has been closed");
        if (fn.name === "cardIdInPage") return `srv_${SLUG}`;
        if (fn.name === "markTabInPage") { t.mark = arg; return { mark: t.mark, origin: t.origin, path: "/projects" }; }
        if (fn.name === "tabMarkInPage") return { mark: t.mark, origin: t.origin, path: "/projects" };
        if (fn.name === "requestViewInPage") {
          calls.push(`tab ${t.id} view`);
          for (const l of requestListeners) l({ url: () => `${ORIGIN}/api/site/request/${SLUG}/${arg.key}`, method: () => "GET" });
          if (arg.key !== server.key) return { status: 404, ok: false, request: null, reply: null };
          return { status: 200, ok: true, request: read(), reply: opt.requestReply || null };
        }
        if (fn.name === "stopRequestInPage") { calls.push(`tab ${t.id} stop`); stopIt(); return { status: 200, ok: true, state: "stopped" }; }
        if (fn.name !== "readComposerInPage") throw new Error("unexpected page function " + fn.name);
        await follow();
        return state();
      },
      click: async (sel) => {
        calls.push(`tab ${t.id} click ${sel}`);
        if (sel.includes(".st-card-name")) t.workspace = true;
        if (sel !== "#stSend") return;
        const said = t.value;
        t.value = "";
        keep.msgs.push({ who: "u", text: said });
        // THE ANSWER TO A STEP'S QUESTION resumes that part of its request: the
        // server knows the question by its id, whatever the page noted.
        const waits = keep.ask && server.key ? (now() || { parts: [] }).parts.find((p) => p.status === "waiting" && p.question && p.question.id === keep.ask.id) : null;
        if (waits) {
          keep.ask = null;
          server.views = opt.answerViews || []; server.at = 0;
          await emit("POST", "/api/site/route", 200, { message: said, attached: false }, { ok: true, intent: "addon", cost: 1, request: now(), resumed: { key: server.key, part: waits.n } });
          return;
        }
        keep.ask = null;
        const plan = opt.send(sends++, said);
        if (plan.request) {
          server.key = plan.request.key; server.views = plan.request.views; server.at = 0;
          await emit("POST", "/api/site/route", 200, { message: said, attached: false }, { ok: true, intent: "edit", layer: "text", cost: 2, ...(plan.route || {}), request: now() });
          keep.msgs.push({ who: "a", card: true, text: said + " Queued" });
          keep.requests[plan.request.key] = { closed: false, ended: false, shown: [] };
          return;
        }
        if (plan.clarify) {
          await emit("POST", "/api/site/route", 200, { message: said, attached: false }, { ok: true, intent: "clarify", question: plan.clarify, cost: 1 });
          keep.ask = { id: plan.clarify.id, text: plan.clarify.text, key: "", part: null };
          keep.msgs.push({ who: "a", text: plan.clarify.text, ask: true });
          return;
        }
        // THE OLD PATH: no request, so the page posts its own edit — through the wall.
        await emit("POST", "/api/site/route", 200, { message: said, attached: false }, { ok: true, intent: "edit", layer: plan.layer, cost: 2 });
        const out = await throughWall("POST", `/api/site/${SLUG}/edit`, { layer: plan.layer, instruction: said });
        keep.msgs.push({ who: "a", text: out ? "✅ Done the old way." : "⚠️ I couldn't reach the site just now — nothing changed." });
      },
      fill: async (sel, v) => { t.value = v; },
      waitForEvent: async () => ({ setFiles: async () => { t.attached = 1; t.strip = 1; } }),
      screenshot: async () => {},
    };
    return page;
  };
  const context = {
    route: async (pattern, handler) => { routes.push({ pattern, handler }); },
    addInitScript: async () => {},
    newPage: async () => newTab(),
    on: (ev, fn) => { if (ev === "request") requestListeners.push(fn); },
    close: async () => {},
  };
  const browser = { newContext: async () => context, close: async () => { calls.push("browser closed"); } };
  return {
    calls, keep, server, tabs,
    launch: async () => browser,
    requestsNow: async () => {
      calls.push("list");
      // ANOTHER PAGE OF THE RUN'S BROWSER READING THE REQUEST'S OWN ROUTE while
      // the tab is closed (`readWhileAway`): what the closed-tab check exists to catch.
      if (opt.readWhileAway && calls.filter((c) => c === "list").length === 2) {
        for (const l of requestListeners) l({ url: () => `${ORIGIN}/api/site/request/${SLUG}/${server.key}`, method: () => "GET" });
      }
      const v = read();
      return { status: 200, json: { ok: true, requests: v ? [v] : [] } };
    },
    stopNow: async (key) => { calls.push(`stopNow ${key}`); stopIt(); return { status: 200, json: { ok: true, request: now() } }; },
  };
}

const SESSION = { access_token: "a", refresh_token: "r", expires_at: 2_000_000_000, user: { id: UID } };
const drive = (h, scenario, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: SLUG, scenario, spend: true, balanceNow: async () => 100, evid: "", launch: h.launch, log: () => {},
  openMs: 200, attachMs: 50, startMs: 50, stepMs: 2_000, stepCapMs: 2_000, pollMs: 1, settleMs: 0, viewEveryMs: 0, awayEveryMs: 1,
  requestsNow: h.requestsNow, stopNow: h.stopNow, ...over,
});

test("with the switch not live the message is answered the old way: the page's own edit is refused before it leaves, the press stops, and nothing more is sent", async () => {
  const h = rqApp({ send: () => ({ layer: "text" }) });
  const rec = await drive(h, UI_SCENARIOS["rq-canary"]);
  assert.equal(rec.sent, 1);
  assert.match(rec.stopped.msg, /not taken on as a request/);
  assert.ok(h.calls.includes(`wall POST /api/site/${SLUG}/edit abort`), "the page's own edit went out");
  assert.equal(rec.blocked.length, 1);
  assert.match(rec.blocked[0].why, /in request mode/);
  assert.equal(rec.steps[0].request, undefined);
  assert.equal(failed(requestStepChecks(rec.steps[0], UI_SCENARIOS["rq-canary"])).some((f) => /taken on as a request/.test(f)), true);
});

const R3_VIEWS = [
  view(RQ_KEY(3), [part(0, "change the heading …", "started", { route: "text", ids: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "ready")]),
  view(RQ_KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "started", { route: "addon", ids: ["j2"] })]),
  view(RQ_KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }),
    part(1, "add a link to our Facebook page in the footer", "waiting", { route: "addon", ids: ["j2"], jobs: ["j2"], question: { id: "q1", text: "What is the address of your Facebook page?", options: [] } })], { state: "waiting" }),
];
const R3_ANSWERED = [
  view(RQ_KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "started", { route: "nav", addition: true, ids: ["j2", "j3"], jobs: ["j2"] })]),
  view(RQ_KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "done", { route: "nav", addition: true, ids: ["j2", "j3", "j4"], jobs: ["j2", "j4"] })], { ended: true }),
];
const R3_REPLIES = {
  j1: { ok: true, msg: "✅ Changed.", reply: "The Visit page's heading now reads “Our shop on the street”.", replySource: "model" },
  j2: { ok: false, clarify: { id: "q1", text: "What is the address of your Facebook page?" } },
  j4: { ok: true, msg: "✅ Added.", reply: "Your footer now links to your Facebook page, beside Instagram.", replySource: "model" },
};

test("R3 END TO END: the first message ends on the step's question with the heading done; the answer, typed into the composer, resumes that part, and its jobs are only the new ones", async () => {
  const sc = UI_SCENARIOS["rq-3-facebook"];
  const h = rqApp({ send: () => ({ request: { key: RQ_KEY(3), views: R3_VIEWS }, route: { intent: "edit", layer: "text", alsoAsked: "add a link to our Facebook page in the footer" } }), answerViews: R3_ANSWERED, replies: R3_REPLIES });
  const rec = await drive(h, sc);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 2);
  const [s1, s2] = rec.steps;
  assert.deepEqual(s1.question, { by: "step", key: RQ_KEY(3), part: 1, id: "q1", text: "What is the address of your Facebook page?" });
  assert.equal(s1.request.final.state, "waiting");
  assert.deepEqual(s1.jobs, ["j1", "j2"]);
  assert.equal(s2.request.key, RQ_KEY(3), "the answer did not resume the same request");
  assert.deepEqual(s2.jobs, ["j3", "j4"], "the answer's jobs repeat the first message's, so the money would count them twice");
  assert.equal(s2.request.final.ended, true);
  assert.deepEqual(s2.routing.resumed, { key: RQ_KEY(3), part: 1 });
  assert.deepEqual(failed(requestStepChecks(s1, sc)), []);
  assert.deepEqual(failed(requestStepChecks(s2, sc)), []);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  assert.deepEqual(coverageOf({ spec: sc, steps: rec.steps }).map((c) => `${c.name}:${c.covered}`), ["several-parts:true", "step-question:true", "answer-resumes:true"]);
  // THE TRAIL: the views the canary read, each time the statuses changed.
  assert.ok(s1.request.trail.length >= 2 && s1.request.trail.every((v) => Array.isArray(v.parts)));
  const told = describeUi(rec);
  assert.match(told, /question \(part 1's, from its step\): "What is the address of your Facebook page\?"/);
  assert.ok(told.includes(`resumes {"key":"${RQ_KEY(3)}","part":1}`), told);
  // BOTH MESSAGES' ROUTING CALLS ARE READ FOR THE MONEY (the stand-in sends no
  // key, so neither has a ledger ref here; the real page's key is held on run
  // 94's own recorded call, in test/canary-money.test.mjs).
  assert.deepEqual(routeCallsOf(rec.steps).map((c) => c.ref), ["", ""]);
  // AND THE RUN KEEPS WHEN EACH END OF THE BALANCE WAS READ.
  assert.match(String(rec.balance.startAt), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/);
  assert.match(String(rec.balance.endAt), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/);
  assert.ok(Date.parse(rec.balance.startAt) <= Date.parse(rec.balance.endAt), "the press ended before it began");
});

test("the question stop holds whichever way the page keeps the question: with its request and part (drawn from the request's card) or without them (drawn from its step's reply)", async () => {
  for (const askKeepsRequest of [true, false]) {
    const h = rqApp({ send: () => ({ request: { key: RQ_KEY(3), views: R3_VIEWS } }), answerViews: R3_ANSWERED, replies: R3_REPLIES, askKeepsRequest });
    const rec = await drive(h, UI_SCENARIOS["rq-3-facebook"]);
    assert.equal(rec.stopped, null, `${askKeepsRequest}: ${JSON.stringify(rec.stopped)}`);
    assert.equal(rec.steps[0].question.part, 1);
    assert.equal(rec.sent, 2);
  }
});

test("a first message whose request ends without the question: its answer is never typed or sent, and the run says why", async () => {
  const done = [view(RQ_KEY(4), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link …", "done", { route: "addon", ids: ["j2"], jobs: ["j2"] })], { ended: true })];
  const h = rqApp({ send: () => ({ request: { key: RQ_KEY(4), views: done } }) });
  const rec = await drive(h, UI_SCENARIOS["rq-3-facebook"]);
  assert.equal(rec.sent, 1);
  assert.match(rec.stopped.msg, /ended without the question message 2 answers — message 2 is NOT sent/);
  assert.equal(rec.steps[0].question, undefined);
  assert.equal(rec.steps.length, 1, "the answer was typed");
  assert.match(describeUi(rec), /NO QUESTION was asked/);
});

test("the router's own question ends the first message with no request opened — recorded as the other path — and the answer is routed whole and may open the request", async () => {
  const sc = UI_SCENARIOS["rq-3-facebook"];
  const ended = [view(RQ_KEY(5), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link …", "done", { route: "addon", ids: ["j2"], jobs: ["j2"] })], { ended: true })];
  const h = rqApp({ send: (n) => (n === 0 ? { clarify: { id: "r1", text: "What is your Facebook address?", options: [] } } : { request: { key: RQ_KEY(5), views: ended } }) });
  const rec = await drive(h, sc);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 2);
  assert.deepEqual(rec.steps[0].question, { by: "router", key: "", part: null, id: "r1", text: "What is your Facebook address?" });
  assert.equal(rec.steps[1].request.key, RQ_KEY(5));
  assert.deepEqual(failed(requestStepChecks(rec.steps[0], sc)), []);
  const cov = coverageOf({ spec: sc, steps: rec.steps });
  assert.equal(cov.find((c) => c.name === "step-question").covered, false);
});

const R5_VIEWS = [
  view(RQ_KEY(6), [part(0, "Add a line to the Order page …", "queued", { route: "addon", ids: ["k1"] }), part(1, "change the Gallery page heading …", "ready")]),
  view(RQ_KEY(6), [part(0, "Add a line to the Order page …", "started", { route: "addon", ids: ["k1"] }), part(1, "change the Gallery page heading …", "ready")]),
  view(RQ_KEY(6), [part(0, "Add a line to the Order page …", "done", { route: "addon", ids: ["k1"], jobs: ["k1"] }), part(1, "change the Gallery page heading …", "started", { route: "text", ids: ["k2"] })]),
  view(RQ_KEY(6), [part(0, "Add a line to the Order page …", "done", { route: "addon", ids: ["k1"], jobs: ["k1"] }), part(1, "change the Gallery page heading …", "done", { route: "text", ids: ["k2"], jobs: ["k2"] })], { ended: true }),
];

test("R5 END TO END: the tab closes once the card is drawn; only the requests list is read until the request ends; a new tab opens the site and shows it ended, every reply on screen", async () => {
  const sc = UI_SCENARIOS["rq-5-away"];
  const h = rqApp({ send: () => ({ request: { key: RQ_KEY(6), views: R5_VIEWS }, route: { intent: "addon", layer: "" } }), followAfter: 3 });
  const rec = await drive(h, sc);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  const s = rec.steps[0];
  assert.equal(s.mode, "away");
  assert.equal(s.away.closed, true);
  assert.equal(s.away.ended, true);
  assert.ok(s.away.reads >= 3, `${s.away.reads} reads`);
  assert.deepEqual(s.away.calls, [], "something read the request's own route while the tab was closed");
  assert.equal(s.away.reopened.closed, true);
  assert.deepEqual(s.jobs, ["k1", "k2"]);
  assert.equal(s.request.final.ended, true);
  // WHILE AWAY: the first tab closed, then the list alone, then the second tab.
  const closed = h.calls.indexOf("tab 1 closed");
  const reopened = h.calls.indexOf("tab 2 goto /projects");
  assert.ok(closed > 0 && reopened > closed, JSON.stringify(h.calls));
  assert.deepEqual([...new Set(h.calls.slice(closed + 1, reopened))], ["list"], "something but the requests list was read while the tab was closed");
  assert.ok(!h.calls.some((c) => c === "tab 1 view"), "the first tab read the request before it closed — the server would not be moving it alone");
  assert.equal(h.tabs.length, 2);
  // THE REPLIES WERE READ IN THE SECOND TAB.
  assert.deepEqual(s.replies, ["Done: k1.", "Done: k2."]);
  assert.deepEqual(failed(requestStepChecks(s, sc)), []);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  assert.equal(coverageOf({ spec: sc, steps: rec.steps }).find((c) => c.name === "closed-tab").covered, true);
  assert.match(describeUi(rec), /away: tab closed; the requests list read \d+ time\(s\); ended \d+ s after the tab closed; reads of the request's own route while away: 0; the tab opened afterwards showed it ended/);
});

test("a read of the request's own route while the tab is closed — by any page of the run's browser — is recorded, and the press does not pass", async () => {
  const sc = UI_SCENARIOS["rq-5-away"];
  const h = rqApp({ send: () => ({ request: { key: RQ_KEY(6), views: R5_VIEWS } }), readWhileAway: true });
  const rec = await drive(h, sc);
  const s = rec.steps[0];
  assert.equal(s.away.calls.length, 1, "the read was not recorded");
  assert.equal(s.away.calls[0].path, `/api/site/request/${SLUG}/${RQ_KEY(6)}`);
  assert.ok(failed(requestStepChecks(s, sc)).some((f) => /nothing read/.test(f)));
  assert.equal(coverageOf({ spec: sc, steps: rec.steps }).find((c) => c.name === "closed-tab").covered, false);
});

test("with the tab closed, a part routed where the message may not go is stopped through the request's own Stop — once — and recorded; the press does not pass", async () => {
  const sc = UI_SCENARIOS["rq-5-away"];
  const views = [R5_VIEWS[0], view(RQ_KEY(7), [part(0, "Add a line …", "done", { route: "addon", ids: ["k1"], jobs: ["k1"] }), part(1, "change the Gallery …", "started", { route: "page", ids: ["k2"] })])];
  views.forEach((v) => { v.key = RQ_KEY(7); });
  const h = rqApp({ send: () => ({ request: { key: RQ_KEY(7), views } }) });
  const rec = await drive(h, sc);
  const s = rec.steps[0];
  assert.equal(h.calls.filter((c) => c.startsWith("stopNow")).length, 1, "the part was not stopped exactly once");
  assert.deepEqual(s.request.wall, { n: 1, why: "a part routed to the page layer, which this scenario does not allow" });
  assert.equal(rec.blocked.length, 1);
  assert.equal(s.request.stop.status, 200);
  assert.equal(s.request.final.state, "stopped");
  assert.ok(failed(requestStepChecks(s, sc)).some((f) => /stopped by the wall/.test(f)));
});

test("a run not handed the requests list and the Stop never closes its tab, and says why", async () => {
  const h = rqApp({ send: () => ({ request: { key: RQ_KEY(8), views: R5_VIEWS.map((v) => ({ ...v, key: RQ_KEY(8) })) } }) });
  const rec = await drive(h, UI_SCENARIOS["rq-5-away"], { requestsNow: null, stopNow: null });
  assert.match(rec.stopped.msg, /not handed the requests list and the Stop, so the tab is not closed/);
  assert.ok(!h.calls.includes("tab 1 closed"));
});

test("a message's own bound ends its wait, not the default, and never past the cap", async () => {
  const never = [view(RQ_KEY(9), [part(0, "x", "started", { route: "text", ids: ["z"] })])];
  const sc = { site: SLUG, request: true, budget: 9, layers: ["text"], steps: [{ say: "Change the heading.", ms: 60 }] };
  const h = rqApp({ send: () => ({ request: { key: RQ_KEY(9), views: never } }) });
  const t0 = Date.now();
  const rec = await drive(h, sc, { stepMs: 60_000, stepCapMs: 60_000 });
  assert.ok(Date.now() - t0 < 5_000, "the default bound was used");
  assert.equal(rec.steps[0].boundMs, 60);
  assert.match(rec.stopped.msg, /the outcome is unknown/);
  const capped = await drive(rqApp({ send: () => ({ request: { key: RQ_KEY(9), views: never } }) }), { ...sc, steps: [{ say: "Change the heading.", ms: 60_000 }] }, { stepCapMs: 40 });
  assert.equal(capped.steps[0].boundMs, 40);
});

// ── THE CANARY WIRES IT ──────────────────────────────────────────────────────

test("the canary hands the closed-tab readers to the driver, reads the table listing on both sides, orders a request's publishes, and judges the press inside the paid branch — checks failing the run, coverage never", () => {
  const branch = CANARY.indexOf("if (UI_ASK) {");
  const gate = CANARY.indexOf("if (!SPEND)");
  assert.ok(branch > 0 && gate > branch);
  const win = CANARY.slice(branch, gate);
  const run = win.slice(win.indexOf("await runUi("), win.indexOf("\n", win.indexOf("await runUi(")));
  assert.match(run, /requestsNow: requestsIo\.list, stopNow: requestsIo\.stop/, "the closed-tab readers are not handed to the driver");
  assert.match(win, /list: \(\) => call\("GET", `\/api\/site\/requests\/\$\{encodeURIComponent\(CANARY\)\}`\)/, "the closed tab is read through something other than the requests list");
  const tb = win.indexOf("const tablesBefore");
  assert.ok(tb > 0 && tb < win.indexOf("await runUi("), "the table listing is not read before the browser opens");
  assert.match(win, /if \(REQ\) published = chainOrdered\(beforeV, published\);/, "a request's publishes are not put in the order they were made");
  const at = win.indexOf("if (REQ) {", win.indexOf("chain = chainVerdict("));
  assert.ok(at > 0, "the press is judged before the chain, or not at all");
  const block = win.slice(at, win.indexOf("UI_ASK.scenario.publishes === 0", at));
  assert.match(block, /requestBatchVerdict\(\{/);
  assert.match(block, /for \(const c of requests\.checks\) check\(c\.name, c\.ok, c\.why\)/, "a failed check does not fail the run");
  assert.match(block, /for \(const c of requests\.replies\) check\(c\.name, c\.ok, c\.why\)/, "a reply that is not the model's does not fail the run");
  // THE MONEY IS THE PRESS'S OWN CHARGES (2026-10-04): its routing rows by their
  // own refs, the ledger between the two balance reads beside them.
  assert.match(block, /const money = ownMoneyVerdict\(\{ start: bal\.start, end: bal\.end, calls, routeRows, jobs: jobRecords, window \}\);/, "the money is not judged by the press's own charges");
  assert.match(block, /const calls = routeCallsOf\(ui\.steps\);/);
  assert.match(block, /ledgerRows\(`ref=eq\.\$\{encodeURIComponent\(ref\)\}`\)/, "a routing call's row is not read by its own ref");
  assert.match(block, /ledgerRows\(`uid=eq\.\$\{encodeURIComponent\(UID\)\}&at=gte\.\$\{encodeURIComponent\(bal\.startAt\)\}&at=lte\.\$\{encodeURIComponent\(bal\.endAt\)\}`\)/, "the ledger between the balance reads is not this account's");
  assert.match(block, /requests\.money = money;/, "the press's own spend is not kept for the batch");
  assert.match(block, /check\(`this press's own charges add up: [^`]*`, money\.ok, money\.why \|\| ownMoneySaid\(money\)\);/, "the money does not fail the run");
  assert.doesNotMatch(block, /moneyVerdict\(\{ start: ui\.balance/, "the balance-move check is still the request press's");
  const cov = block.slice(block.indexOf("for (const c of requests.coverage)"));
  assert.ok(cov.length > 0 && !/check\(/.test(cov.slice(0, cov.indexOf("\n"))), "coverage fails the run");
  assert.match(block, /readFileSync\(`\$\{EVID\}\/\$\{label\}\/route\$\{file\}\.html`/, "the served pages are not the inventories' own");
  assert.match(block, /createHash\("sha256"\)\.update\(bytes\)/, "the logo's bytes are not hashed");
  // THE AWAY MESSAGE'S TAB IS JUDGED BY THE BATCH, NOT BY THE SAME-TAB CHECK.
  assert.match(win, /if \(s\.mode !== "away"\) check\(`message \$\{s\.n\}'s reply was read in the tab the run opened/);
  assert.match(win.slice(win.indexOf("writeFileSync(`${EVID}/ui.json`")), /chain, removal, additions, requests \}/, "ui.json does not carry the press's verdict");
  // AND THE INVENTORY KEEPS THE STATUS EACH PAGE ANSWERED, which a new page is judged by.
  assert.match(CANARY, /render\[r\] = \{ status: got\.status \|\| 0,/);
});

// ── THE READERS THAT RUN INSIDE THE APP, RUN ─────────────────────────────────
//
// They run in the real app in Chromium, which no other test drives: cut out of
// the module whole (from the function's line to its closing brace at column
// 0) and run in a VM against the page's own data shapes — `site.requests[key]`
// as `siteReqState` keeps it, and `site.ask` as `siteAskKeep` keeps it, with
// and without the request it is for.
import vm from "node:vm";
const MOD = fs.readFileSync(ROOT + "scripts/canary-ui.mjs", "utf8");
const cutFn = (head) => {
  const open = MOD.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone");
  const shut = MOD.indexOf("\n}\n", open);
  assert.ok(shut > open, head + " has no end");
  return MOD.slice(open, shut + 3);
};
function inApp({ site, cancel = true, fetched = null } = {}) {
  const el = (cls, text, extra = {}) => ({ classList: { contains: (c) => cls.includes(c) }, querySelector: (sel) => (sel === ".st-req" && extra.card ? {} : null), innerText: text, textContent: text });
  const msgs = [el(["st-msg", "u"], "On the Visit page …"), el(["st-msg"], "On the Visit page … Queued", { card: true }), el(["st-msg"], "What is your Facebook page's address?")];
  const document = {
    getElementById: (id) => ({ stRevise: { value: "", disabled: false }, stSend: { disabled: false }, stPlus: {} })[id] || null,
    querySelectorAll: (sel) => (sel === "#stThread .st-msg" ? msgs : []),
    querySelector: (sel) => (sel === "#stThread [data-ask-cancel]" && cancel ? {} : null),
  };
  const ctx = vm.createContext({
    document, window: {}, getComputedStyle: () => ({ display: "none" }),
    Auth: { isSignedIn: () => true, userId: () => UID }, siteDraft: () => ({ imgs: [] }), siteAttachFor: "s1", siteBusy: false,
    siteById: (id) => (id === "s1" ? site : null), siteOpenId: "s1",
    apiFetch: async () => new Response(JSON.stringify(fetched), { status: 200, headers: { "content-type": "application/json" } }),
  });
  vm.runInContext(cutFn("function readComposerInPage() {") + cutFn("async function requestViewInPage({ slug, key }) {"), ctx);
  return ctx;
}

test("the readers that run inside the app read the request's shown replies and the live question as the page keeps them — with or without the request beside it — and the request's own reply with its source", async () => {
  const kept = { at: 1, view: { ended: false, parts: [] }, shown: ["j1", "j2"], replied: false, replies: [], closed: false, approving: [] };
  const fromReply = inApp({ site: { requests: { [KEY]: kept }, ask: { id: "q1", text: "What is your Facebook page's address?", options: [], attached: false } } });
  const s = vm.runInContext("readComposerInPage()", fromReply);
  assert.deepEqual(JSON.parse(JSON.stringify(s.requests)), { [KEY]: { closed: false, ended: false, shown: ["j1", "j2"] } });
  assert.deepEqual(JSON.parse(JSON.stringify(s.ask)), { id: "q1", text: "What is your Facebook page's address?", key: "", part: null });
  assert.equal(s.askCard, true);
  assert.deepEqual(JSON.parse(JSON.stringify(s.messages.map((m) => m.card))), [false, true, false], "the request's card was not told from a reply");
  // AND THE QUESTION STOP ACCEPTS IT, matched by its id.
  assert.equal(questionShown(waitingView(), JSON.parse(JSON.stringify(s)), KEY).part, 1);
  const fromCard = inApp({ site: { requests: { [KEY]: kept }, ask: { id: "q1", text: "x", options: [], attached: false, request: { key: KEY, part: 1 } } } });
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext("readComposerInPage()", fromCard).ask)), { id: "q1", text: "x", key: KEY, part: 1 });
  const none = inApp({ site: { requests: {} }, cancel: false });
  const n = vm.runInContext("readComposerInPage()", none);
  assert.equal(n.ask, null);
  assert.equal(n.askCard, false);
  // THE REQUEST'S OWN REPLY, AND WHERE IT CAME FROM.
  const ended = inApp({ site: { requests: {} }, fetched: { ok: true, request: { key: KEY, ended: true, parts: [] }, reply: "Both changes are live.", replySource: "model", replyFor: "end" } });
  const v = await vm.runInContext(`requestViewInPage({ slug: "fold-lane-bakery", key: "${KEY}" })`, ended);
  assert.deepEqual(JSON.parse(JSON.stringify(v.reply)), { text: "Both changes are live.", source: "model", for: "end" });
  assert.equal(v.ok, true);
  const plainView = inApp({ site: { requests: {} }, fetched: { ok: true, request: { key: KEY, ended: false, parts: [] } } });
  assert.equal((await vm.runInContext(`requestViewInPage({ slug: "fold-lane-bakery", key: "${KEY}" })`, plainView)).reply, null);
});
