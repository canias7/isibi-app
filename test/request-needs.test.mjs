// A PART WAITS ON WHAT IT NEEDS, NOT ON HOW ANOTHER PART ENDED (2026-10-24,
// request-needs; the owner, after two live runs that day).
//
// Driftwood (request 568e61a8…): the home edits needed the Lessons page the
// first part made; that part ended partial (other pages capped), and every
// home edit was held although /lessons existed. Saltmarsh (request
// 6598838c…): the Events part failed on a provider error, and the footer,
// spam protection and home edits — which the router had said came after it,
// though none used it — were all held.
//
// The gate now asks, for each need, whether the concrete things the part reads
// (`needOn`: `page:/lessons`, `data:events`) exist in what the other part and
// the parts carved from it really created (`created`, from their answers). A
// need the router said with nothing named does not hold a part once the other
// part has ended done, partial or failed: its own step judges what it can do.
// Only a named thing genuinely missing holds it, and the reply names the thing.
// A part still running, retrying or waiting on a question is waited for.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is supplied by the case.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, readWritten, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { planParts, newRequest, nextStep, requestView } from "../builder/request.mjs";
import { inferNeeds } from "../builder/request-plan.mjs";
import { requestReplyFacts } from "../builder/site-reply.mjs";
import { LIVE_ASK_TOOL } from "../builder/site-ask.mjs";

const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const DESCRIBE = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const MENU = [["Home", "/"], ["Visit", "/visit"]];
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV(MENU) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV(MENU) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The shutters and the street.</p></section>") },
];
const ADD_LESSONS = "Add a lessons page and put a link to it in the menu";
const LINK = "put a link to the new lessons page on the Visit page";
const slugOf = (k) => "rn-" + k + "-" + Math.random().toString(16).slice(2, 8);
const statuses = (rec) => rec.parts.map((p) => p.status);
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.words, p.status, p.why, p.missing || null]));
const REQ = (P, key) => "/api/site/request/" + P.slug + "/" + key;
const toldIn = (P, v) => {
  const f = P.factsOf(v && v.body && v.body.reply);
  assert.ok(f, "no reply was handed back");
  return f.map((x) => x.text).join(" | ");
};
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}

// ── THROUGH THE REAL REQUEST FLOW ────────────────────────────────────────────

test("Driftwood replay — the part making /lessons ends partial (something capped), /lessons was created: the edit that reads /lessons runs", async () => {
  await withPlatform({
    slug: slugOf("drift"), pages: NAV_PAGES, replies: true,
    answers: {
      route: [
        // THE MODEL'S PLAN: the addition makes /lessons; the second change reads it.
        { intent: "addon", alsoAsked: [DESC], targets: [{ change: 0, writes: ["new-page:/lessons"] }, { change: 1, reads: ["page:/lessons"] }] },
        { intent: "edit", layer: "look" },
      ],
      // PARTIAL: the picker names a frame with no words, so it is set aside.
      [T.adds]: { kinds: ["page", "frame"] },
      "add:page": { page: [PAGE("/lessons", "Lessons")] }, [T.pages]: { pages: [writtenPage("/lessons")] },
      // RE-ANCHORED 2026-10-24 (combine-d): addon-uncapped hands the set-aside
      // frame on as a carved part (`frame-hop`) instead of ending the addition
      // `partial`; its menu editor is refused here (400, ours, not a provider
      // wait, which provider-retry would park), so the carved part ends failed.
      write_nav: () => new Response("bad request", { status: 400 }),
      ...DESCRIBE,
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: ADD_LESSONS + ", then " + DESC + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts[1].needs, [0], why(rec));
    assert.deepEqual(rec.parts[1].needOn, { 0: ["page:/lessons"] });
    assert.ok(["partial", "done"].includes(rec.parts[0].status), why(rec));
    assert.ok(rec.parts[0].created.includes("page:/lessons"), why(rec));
    assert.ok(P.pages().includes("lessons.tsx"));
    assert.equal(rec.parts[1].status, "done", why(rec));
    assert.equal(P.look().description, NEW_DESC, "the edit that needed /lessons was held");
    const facts = toldIn(P, await readWritten(P, REQ(P, r.key)));
    assert.doesNotMatch(facts, /Not started/, facts);
  });
});

test("Saltmarsh replay — the addition fails: the part the router said came after it (naming nothing) runs; only the part that uses its page waits, and says which page", async () => {
  await withPlatform({
    slug: slugOf("salt"), pages: NAV_PAGES, replies: true,
    answers: {
      route: [
        { intent: "addon", alsoAsked: [DESC, LINK], dependsOn: [{ change: 1, after: [0] }, { change: 2, after: [0] }], targets: [{ change: 0, writes: ["new-page:/lessons"] }, { change: 2, reads: ["page:/lessons"] }] },
        { intent: "edit", layer: "look" },
      ],
      // THE ADDITION FAILS: nothing it can add.
      [T.adds]: { kinds: [] },
      ...DESCRIBE,
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: ADD_LESSONS + ", " + DESC + ", and " + LINK + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "failed", why(rec));
    assert.deepEqual(rec.parts[1].needs, [0]);
    assert.equal(rec.parts[1].status, "done", "a part whose need names nothing was held by a failed part: " + why(rec));
    assert.equal(P.look().description, NEW_DESC);
    assert.deepEqual([rec.parts[2].status, rec.parts[2].why, rec.parts[2].missing], ["not-run", "needs:0", ["page:/lessons"]], why(rec));
    assert.equal(rec.parts[2].jobs.length, 0);
    assert.equal(rec.state, "partial");
    const v = await readWritten(P, REQ(P, r.key));
    const view = v.body.request.parts[2];
    assert.deepEqual(view.missing, ["page:/lessons"]);
    const facts = toldIn(P, v);
    assert.match(facts, /Not started: “put a link to the new lessons page on the Visit page”, because it uses the page “\/lessons”, which “Add a lessons page and put a link to it in the menu[^”]*” was to make, and it was not made\./, facts);
    assert.doesNotMatch(facts, /rest of the site/);
    assert.doesNotMatch(facts, /Not started: “Change the site description/);
  });
});

// ── THE GATE, DRIVEN WITH LITERALS ───────────────────────────────────────────

const KEY = "rqneeds00000000001";
const MSG = "Add a lessons page, change the heading, and fix the footer.";
const planned = (routed) => {
  const p = planParts(MSG, routed);
  assert.equal(p.ok, true, JSON.stringify(p));
  return newRequest({ key: KEY, uid: "u1", slug: "driftwood", message: MSG, picker: "sonnet", tz: "Europe/London", accepted: routed, parts: p.parts });
};
const ROUTED = { intent: "addon", alsoAsked: ["change the heading", "fix the footer"], dependsOn: [{ change: 1, after: [0] }, { change: 2, after: [0] }], targets: [{ change: 0, writes: ["new-page:/lessons"] }, { change: 1, reads: ["page:/lessons"] }] };
/** Part 0 set to a state, with no job running, then one step. */
const gate = (status, { created, child, retries } = {}) => {
  const rec = planned(ROUTED);
  rec.parts[0].status = status;
  if (retries) rec.parts[0].retries = retries;
  if (created) rec.parts[0].created = created;
  if (child) {
    // A PART CARVED FROM PART 0 (words its step left for later).
    rec.parts.push({ ...rec.parts[2], n: 3, words: "and the menu", parent: 0, needs: [], needOn: undefined, status: child, jobs: [] });
  }
  return nextStep(rec, {}, Date.now()).record;
};

test("the gate: a named need is met by what was created, whatever the part ended as; missing, it holds with the thing named", () => {
  const rec = planned(ROUTED);
  assert.deepEqual(rec.parts[1].needOn, { 0: ["page:/lessons"] }, "the router's dependsOn with targets did not record what it reads");
  assert.equal(rec.parts[2].needOn, undefined);
  for (const st of ["partial", "failed"]) {
    const ok = gate(st, { created: ["page:/lessons"] });
    assert.notEqual(ok.parts[1].status, "not-run", st + ": " + why(ok));
    const gone = gate(st, {});
    assert.deepEqual([gone.parts[1].status, gone.parts[1].why, gone.parts[1].missing], ["not-run", "needs:0", ["page:/lessons"]], st);
    // THE UNNAMED NEED RUNS: its own step judges.
    assert.notEqual(gone.parts[2].status, "not-run", st + ": " + why(gone));
  }
  // A PART NEVER RUN OR STOPPED MADE NOTHING: an unnamed need on it still holds.
  const stopped = gate("cancelled", {});
  assert.equal(stopped.parts[2].status, "not-run");
});

test("the gate: a prerequisite still running, retrying a provider error or waiting on a question is waited for — never read as broken", () => {
  for (const st of ["ready", "queued", "started", "recovering", "waiting", "uncertain"]) {
    const rec = gate(st, { retries: st === "ready" ? 1 : 0 });
    assert.ok(["blocked"].includes(rec.parts[1].status), st + ": " + why(rec));
    assert.ok(["blocked"].includes(rec.parts[2].status), st + ": " + why(rec));
  }
});

test("the gate: a carved child's failure does not break its parent — what the parent made stands for the parts that need it", () => {
  const rec = gate("done", { created: ["page:/lessons"], child: "failed" });
  assert.notEqual(rec.parts[1].status, "not-run", why(rec));
  assert.notEqual(rec.parts[2].status, "not-run", why(rec));
  // A CHILD STILL RUNNING IS WAITED FOR.
  const running = gate("done", { created: ["page:/lessons"], child: "queued" });
  assert.equal(running.parts[1].status, "blocked", why(running));
  // AND A CHILD'S CREATION COUNTS AS THE PARENT'S.
  const r2 = planned(ROUTED);
  r2.parts[0].status = "partial";
  r2.parts.push({ ...r2.parts[2], n: 3, words: "and the menu", parent: 0, needs: [], status: "done", jobs: [], created: ["page:/lessons"] });
  const out = nextStep(r2, {}, Date.now()).record;
  assert.notEqual(out.parts[1].status, "not-run", why(out));
});

test("inferNeeds names what each need reads, for a need it adds and for one the model already said", () => {
  const parts = [
    { n: 0, needs: [], status: "ready", targets: { writes: ["new-page:/lessons"], reads: [] } },
    { n: 1, needs: [], status: "ready", targets: { writes: [], reads: ["page:/lessons"] } },
    { n: 2, needs: [0], status: "ready", targets: { writes: [], reads: ["page:/lessons"] } },
    { n: 3, needs: [0], status: "ready", targets: { writes: ["menu"], reads: [] } },
  ];
  assert.deepEqual(inferNeeds(parts), [[1, 0]]);
  assert.deepEqual(parts[1].needOn, { 0: ["page:/lessons"] });
  assert.deepEqual(parts[2].needOn, { 0: ["page:/lessons"] });
  assert.equal(parts[3].needOn, undefined);
  assert.deepEqual(parts[2].needs, [0]);
});

test("the reply names the missing thing, and the view carries it; an unnamed hold keeps its old sentence, never 'the rest of the site'", () => {
  const rec = gate("failed", {});
  const view = requestView(rec);
  assert.deepEqual(view.parts[1].missing, ["page:/lessons"]);
  const facts = requestReplyFacts(view).facts.map((f) => f.text).join(" | ");
  assert.match(facts, /Not started: “change the heading”, because it uses the page “\/lessons”, which “Add a lessons page[^”]*” was to make, and it was not made\./, facts);
  assert.doesNotMatch(facts, /rest of the site/);
});

test("the router is told to mark a dependency only when a change truly uses what another creates", () => {
  const desc = JSON.stringify(LIVE_ASK_TOOL);
  assert.match(desc, /A change needs another ONLY when it truly uses something that other change creates/);
  assert.match(desc, /changes that would each work on their own need nothing/);
  assert.doesNotMatch(desc, /uses something that other change makes or changes and the site does not have yet/);
});

