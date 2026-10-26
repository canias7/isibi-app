// OUT OF CREDITS DURING A RUNNING TASK (owner, 2026-10-26): a later part of a
// running request refused for insufficient credits is paused (`credits`), not
// lost; the tick resumes it once credits are added — only while "Continue when
// topped up" is ticked (stored on the request, server-side); unticked, nothing
// resumes until the owner presses Continue; Stop cancels a paused part.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is supplied. Nothing is spent.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, call, tick, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { settleState, creditsDecision, resumeCredits, creditsPaused, setCreditsAuto, nextStep, requestView, PART_TERMINAL } from "../builder/request.mjs";

const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const ADD = "add an events page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const ANSWERS = (hold) => ({
  route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }],
  [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC,
  // THE BALANCE RUNS OUT while the second part runs: emptied as its judge answers, before its reserve.
  [T.adds]: () => { if (!hold.done) { hold.done = true; hold.P.credits.balance = 0; } return { kinds: ["page"] }; }, "add:page": { page: [PAGE("/events", "Events")] }, [T.pages]: { pages: [writtenPage("/events")] },
});

/** Run the message; the balance is emptied part-way through its second part. */
async function pausedRequest(slug) {
  const hold = {};
  const P = platform({ slug: slug + "-" + Math.random().toString(16).slice(2, 8), answers: ANSWERS(hold) });
  hold.P = P;
  const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await settle(P, r.key, { rounds: 10 });
  return { P, key: r.key };
}

const statuses = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why]));
const credits = (P, key, body) => call(P, "POST", "/api/site/request/" + P.slug + "/" + key + "/credits", body);

test("CP1 a later part refused for insufficient credits is paused, not lost: the request stays open, the view counts it", async () => {
  const compiler = installCompiler();
  const { P, key } = await pausedRequest("cp1");
  try {
    const rec = P.record(key);
    assert.ok(rec.parts.some((p) => p.status === "credits"), statuses(rec));
    assert.equal(rec.ended, false); assert.equal(rec.state, "credits");
    const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key);
    assert.deepEqual(v.body.request.credits, { paused: 1, auto: true, ready: false });
  } finally { P.close(); compiler.uninstall(); }
});

test("CP2 TICKED (the default) + credits added by any route: the tick resumes and the request finishes", async () => {
  const compiler = installCompiler();
  const { P, key } = await pausedRequest("cp2");
  try {
    await tick(P); await settle(P, key, { rounds: 2 });
    assert.equal(P.record(key).state, "credits", "it resumed with no credits added");
    P.credits.balance = 40; // a top-up, an upgrade or the monthly grant: only the balance is read
    await tick(P); await settle(P, key, { rounds: 10 });
    const rec = P.record(key);
    assert.equal(rec.state, "done", statuses(rec));
    assert.ok(P.pages().includes("events.tsx"));
  } finally { P.close(); compiler.uninstall(); }
});

test("CP3 UNTICKED + credits added: never resumes; the view says ready; pressing Continue resumes", async () => {
  const compiler = installCompiler();
  const { P, key } = await pausedRequest("cp3");
  try {
    const off = await credits(P, key, { auto: false });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.equal(P.record(key).creditsAuto, false, "the tick was not stored on the request");
    const early = await credits(P, key, { resume: true });
    assert.equal(early.status, 409); assert.equal(early.body.error, "no-credits");
    P.credits.balance = 40;
    for (let i = 0; i < 4; i++) { await tick(P); await settle(P, key, { rounds: 3 }); }
    let rec = P.record(key);
    assert.equal(rec.state, "credits", "an unticked request resumed by itself: " + statuses(rec));
    assert.ok(!P.pages().includes("events.tsx"));
    const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key);
    assert.deepEqual(v.body.request.credits, { paused: 1, auto: false, ready: true });
    const go = await credits(P, key, { resume: true });
    assert.equal(go.status, 200, JSON.stringify(go.body));
    await settle(P, key, { rounds: 10 });
    rec = P.record(key);
    assert.equal(rec.state, "done", statuses(rec));
    assert.ok(P.pages().includes("events.tsx"));
  } finally { P.close(); compiler.uninstall(); }
});

test("CP4 Stop cancels a paused part; nothing is charged for it", async () => {
  const compiler = installCompiler();
  const { P, key } = await pausedRequest("cp4");
  try {
    const before = P.ledger.length;
    const s = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + key);
    assert.equal(s.status, 200);
    await settle(P, key, { rounds: 2 });
    const rec = P.record(key);
    assert.equal(rec.ended, true, statuses(rec));
    assert.ok(rec.parts.some((p) => p.status === "cancelled"), statuses(rec));
    assert.equal(P.ledger.slice(before).filter((e) => e.delta < 0).length, 0);
  } finally { P.close(); compiler.uninstall(); }
});

test("CP5 the decision, pure: base kept, a rise resumes when ticked, marks ready when not; Stop cancels a paused part", () => {
  const rec = settleState({ key: "k", parts: [{ n: 0, status: "done", jobs: [] }, { n: 1, status: "credits", jobs: [] }] });
  assert.equal(rec.state, "credits"); assert.equal(rec.ended, false);
  assert.deepEqual(creditsPaused(rec), [1]);
  const b = creditsDecision(rec, 3, 1); assert.equal(b.act, "base");
  assert.equal(creditsDecision(b.rec, 3).act, "wait");
  assert.equal(creditsDecision(b.rec, 10).act, "resume");
  const off = setCreditsAuto(b.rec, false);
  const r = creditsDecision(off, 10); assert.equal(r.act, "ready");
  assert.equal(creditsDecision(r.rec, 10).act, "wait");
  const up = resumeCredits(off); assert.equal(up.parts[1].status, "ready"); assert.equal(up.state, "running");
  assert.ok(!PART_TERMINAL.includes("credits"));
  assert.equal(requestView(rec).credits.paused, 1);
  const st = nextStep({ ...rec, stop: true }, {}).record;
  assert.equal(st.parts[1].status, "cancelled");
});
