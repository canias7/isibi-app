// A MULTI-PART REQUEST WHOSE PROVIDER GOES DOWN (owner, 2026-10-24): the
// Saltmarsh case through the real request flow — the real Worker, its queue
// consumer, the request's driver and the two-minute tick, against
// `test/fixtures/request-flow.mjs`'s stateful stand-ins.
//
//   - the Events add-on part hits the provider's "unavailable" mid-job: it is
//     NOT failed or not-run; it parks "waiting for <Model>", its panel row
//     shows the fixed notice, and the tick resumes it from its saved step;
//   - the part that depends on it stays waiting (never cascades to not-run);
//   - the carved part's routing call hits it twice more: waiting, never
//     `routing-failed`; then the provider answers and everything finishes;
//   - each job is charged once, and only the failed calls are asked again.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer (and every provider failure)
// is supplied by the case. Nothing is spent.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { PROVIDER_RETRY_MS } from "../builder/provider-retry.mjs";

const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const ADD = "add an events page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const DESCRIBE = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
const DOWN_WORDS = "Service temporarily unavailable. The model is overloaded.";
/** The provider's own 503, as it answers it. */
const down = () => new Response(JSON.stringify({ type: "error", error: { type: "api_error", message: DOWN_WORDS } }), { status: 503, headers: { "content-type": "application/json" } });
const BAD = ["failed", "not-run", "cancelled", "expired", "refused"];

test("PRQ1 Saltmarsh: the Events add-on waits for its model mid-job, its dependent stays waiting, a carved part's routing waits twice, then everything finishes — each job charged once", async () => {
  const compiler = installCompiler();
  let addsAsked = 0;
  const P = platform({
    slug: "prq-" + Math.random().toString(16).slice(2, 8),
    answers: {
      route: [{ intent: "addon", alsoAsked: [DESC] }, down(), down(), { intent: "edit", layer: "look" }],
      [T.adds]: () => (addsAsked++ === 0 ? down() : { kinds: ["page"] }),
      "add:page": { page: [PAGE("/events", "Events")] },
      [T.pages]: { pages: [writtenPage("/events")] },
      ...DESCRIBE,
    },
  });
  try {
    const r = await sendMessage(P, { message: "Please " + ADD + ", and " + DESC.charAt(0).toLowerCase() + DESC.slice(1) + "." });
    assert.equal(r.status, 200);
    // THE ADD-ON HITS THE OUTAGE: parked, not failed; nothing moves on.
    let s = await settle(P, r.key, { rounds: 3 });
    let rec = s.rec;
    assert.ok(rec && !rec.ended, "the request ended while its first part waited for its model");
    for (const p of rec.parts) assert.ok(!BAD.includes(p.status), "a part was told " + p.status + " while its model was down: " + JSON.stringify(rec.parts.map((x) => [x.status, x.why])));
    // ITS PANEL ROW: the fixed notice on the part, from its job.
    const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + r.key);
    const waiting = (v.body.request.parts || []).find((p) => p.wait);
    assert.ok(waiting, "no part carried the notice: " + JSON.stringify(v.body.request.parts));
    assert.equal(waiting.wait.title, "⚠ Claude error 503 · Service Unavailable");
    assert.equal(waiting.wait.said, "Claude said: " + DOWN_WORDS);
    assert.equal(waiting.wait.link, "https://status.claude.com");
    // THE TICK RESUMES IT, every 5 minutes, until the model answers.
    for (let i = 0; i < 6 && !(P.record(r.key) || {}).ended; i++) {
      P.advance(PROVIDER_RETRY_MS + 1000);
      s = await settle(P, r.key, { rounds: 4 });
      rec = s.rec;
      for (const p of rec.parts) assert.ok(!BAD.includes(p.status), "a part was told " + p.status + " while its model was down (round " + i + "): " + JSON.stringify(rec.parts.map((x) => [x.status, x.why])));
    }
    rec = P.record(r.key);
    assert.equal(rec.state, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"]);
    assert.equal(P.look().description, NEW_DESC);
    assert.ok(P.pages().includes("events.tsx"));
    // ONLY THE FAILED CALL ASKED AGAIN: the add-on's judge twice (one failure, one answer).
    assert.equal(addsAsked, 2);
    // EACH JOB CHARGED ONCE, NOTHING TWICE.
    for (const j of P.jobsOf(r.key)) {
      const reserves = P.ledger.filter((e) => e.ref.startsWith(j.id + "#") && e.reason === "reserve");
      const seqs = new Set(reserves.map((e) => e.ref));
      assert.equal(seqs.size, reserves.length, j.op + " was charged twice for one step");
    }
  } finally { P.close(); compiler.uninstall(); }
});

test("PRQ3 the request's own routing call hits the outage: nothing is routed, run or charged; the page gets the fixed notice to count down, and the same message routes once the model answers", async () => {
  const compiler = installCompiler();
  const P = platform({
    slug: "prq3-" + Math.random().toString(16).slice(2, 8),
    answers: { route: [down(), { intent: "addon" }], [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/events", "Events")] }, [T.pages]: { pages: [writtenPage("/events")] } },
  });
  try {
    const r = await sendMessage(P, { message: "Please " + ADD + "." });
    assert.equal(r.body.waiting, true, JSON.stringify(r.body));
    assert.equal(r.body.wait.title, "⚠ Claude error 503 · Service Unavailable");
    assert.equal(r.body.cost, 0);
    assert.deepEqual(P.ledger.filter((e) => e.reason === "route"), [], "a routing call that never answered was charged");
    assert.equal(P.jobsOf(r.key).length, 0, "something ran on the fallback");
    // THE PAGE ASKS AGAIN WHEN ITS COUNTDOWN ENDS: the same message, the same key.
    P.advance(PROVIDER_RETRY_MS);
    const again = await sendMessage(P, { message: "Please " + ADD + ".", key: r.key });
    assert.ok(!again.body.waiting, JSON.stringify(again.body));
    const { rec } = await settle(P, r.key);
    assert.equal(rec.state, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  } finally { P.close(); compiler.uninstall(); }
});

test("PRQ4 (2026-10-24, the re-land) A PARKED JOB RESUMES FROM ITS SAVED STEPS: the judge answered before the designer's outage is replayed from the job's journal, never asked again; only the designer is", async () => {
  const compiler = installCompiler();
  let addsAsked = 0, designAsked = 0;
  const P = platform({
    slug: "prq4-" + Math.random().toString(16).slice(2, 8),
    answers: {
      route: [{ intent: "addon" }],
      [T.adds]: () => { addsAsked++; return { kinds: ["page"] }; },
      "add:page": () => (designAsked++ === 0 ? down() : { page: [PAGE("/events", "Events")] }),
      [T.pages]: { pages: [writtenPage("/events")] },
    },
  });
  try {
    const r = await sendMessage(P, { message: "Please " + ADD + "." });
    await settle(P, r.key, { rounds: 3 });
    assert.ok(!(P.record(r.key) || {}).ended, "the request ended while its designer was down");
    for (let i = 0; i < 4 && !(P.record(r.key) || {}).ended; i++) { P.advance(PROVIDER_RETRY_MS + 1000); await settle(P, r.key, { rounds: 4 }); }
    const rec = P.record(r.key);
    assert.equal(rec.state, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(designAsked, 2, "the designer was not asked exactly twice (one outage, one answer)");
    assert.equal(addsAsked, 1, "the judge, finished before the outage, was asked again on resume");
  } finally { P.close(); compiler.uninstall(); }
});

test("PRQ2 Stop pressed while a part waits for its model: nothing more is asked, the part is stopped, and its reserve comes back", async () => {
  const compiler = installCompiler();
  let addsAsked = 0;
  const P = platform({
    slug: "prq2-" + Math.random().toString(16).slice(2, 8),
    answers: { route: [{ intent: "addon" }], [T.adds]: () => { addsAsked++; return down(); }, "add:page": { page: [PAGE("/events", "Events")] }, [T.pages]: { pages: [writtenPage("/events")] } },
  });
  try {
    const r = await sendMessage(P, { message: "Please " + ADD + "." });
    await settle(P, r.key, { rounds: 3 });
    const job = P.jobsOf(r.key)[0];
    assert.ok(job, "no job was filed");
    assert.ok(!["failed", "lost", "done"].includes(job.state), "the waiting job was closed: " + job.state);
    // THE PART'S OWN STOP, as the panel row's Stop sends it.
    const c = await call(P, "POST", "/api/site/request/" + P.slug + "/" + r.key + "/stop", { part: 0 });
    assert.equal(c.body && c.body.ok, true, JSON.stringify(c.body));
    for (let i = 0; i < 3 && !(P.record(r.key) || {}).ended; i++) { P.advance(PROVIDER_RETRY_MS + 1000); await settle(P, r.key, { rounds: 4 }); }
    const rec = P.record(r.key);
    assert.ok(rec.ended, "the request never ended after its Stop: " + JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(["cancelled", "failed"].includes(P.jobsOf(r.key)[0].state), P.jobsOf(r.key)[0].state);
    assert.ok(addsAsked <= 2, "the stopped part kept asking its model: " + addsAsked);
    const net = P.ledger.filter((e) => e.ref.startsWith(job.id + "#")).reduce((a, e) => a + e.delta, 0);
    assert.equal(net, 0, "the stopped part was charged");
  } finally { P.close(); compiler.uninstall(); }
});
