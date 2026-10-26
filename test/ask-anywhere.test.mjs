// ANY STEP MAY ASK, AT ANY STAGE (owner, 2026-10-26), replacing "no question
// after a charge" (2026-10-24) and router batch 1's "never on a part".
//
// Owner: any step, at any stage, may ask the customer a question when it
// genuinely cannot tell. That one task pauses ("waiting for your answer");
// nothing is charged for the question or while it waits; the other parts keep
// running; the answer resumes that task where it stopped, with the answer
// passed to the same step; questions stay rare.
//
// WHAT IS DRIVEN: the real Worker through `test/fixtures/request-flow.mjs`
// (routing route, queue consumer, edit route, the request's driver, the
// ledger) and the edit route directly, sync and as a job.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is supplied by the case.
// How often a real model asks is a live measurement.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";

blockNetwork();

const slugOf = (k) => "aa-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const shape = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why]));
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);
const netOf = (P, jobId) => P.ledger.filter((e) => e.ref === jobId || e.ref.startsWith(jobId + "#")).reduce((n, e) => n + e.delta, 0);
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

// THE OWNER'S EXAMPLE: the cafe's opening hours are shown on two pages, so
// "make the cafe opening hours 8am to 4pm" cannot tell whether both change.
const HOURS = "Open 9am to 5pm";
const HOURS_TO = "Open 8am to 4pm";
const TT = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const STORY = "Three generations of bakers.";
const STORY_TO = "Four generations of bakers.";
const PAGES = [
  { path: "index.tsx", source: pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>" + HOURS + "</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT + "</p><p>" + HOURS + "</p></section>") },
  { path: "about.tsx", source: pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>" + STORY + "</p></section>") },
];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const HOURS_MSG = "make the cafe opening hours 8am to 4pm";
const ABOUT_MSG = "say four generations on the About page";
const QH = { text: "Your hours are on the Home page and the Visit page — change both?", options: ["Both pages", "Only the Home page"] };
const isHours = (args) => String(args.messages[0].content).includes("WHAT THEY ASKED FOR\n" + HOURS_MSG);
const isAbout = (args) => String(args.messages[0].content).includes("WHAT THEY ASKED FOR\n" + ABOUT_MSG);
const answeredBoth = (args) => /Both pages/.test(JSON.stringify(args.messages));

test("AA 1 — a text step in the middle of a paid request asks: that part waits uncharged, the others finish; the answer resumes the same part at the same step, which completes, and routing is not charged again", async () => {
  await withPlatform({
    slug: slugOf("text"), pages: PAGES,
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/visit", alsoAsked: [HOURS_MSG, ABOUT_MSG], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["page:/", "page:/visit"] }, { change: 2, writes: ["page:/about"] }] },
        { intent: "edit", layer: "text" },
        { intent: "edit", layer: "text", page: "/about" },
        { intent: "edit", layer: "text", answered: true },
      ],
      [T.text]: (args) => {
        if (isHours(args)) {
          return answeredBoth(args)
            ? { edits: [{ id: lineId(args, "index.tsx", HOURS), to: HOURS_TO }, { id: lineId(args, "visit.tsx", HOURS), to: HOURS_TO }] }
            : { edits: [], question: QH };
        }
        if (isAbout(args)) return { edits: [{ id: lineId(args, "about.tsx", STORY), to: STORY_TO }] };
        return { edits: [{ id: lineId(args, "visit.tsx", TT), to: TT_TO }] };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", " + HOURS_MSG + ", and " + ABOUT_MSG + "." });
    const s1 = await settle(P, r.key, { rounds: 20 });
    // THE HOURS WAIT ON THEIR QUESTION; THE OTHER TWO ARE APPLIED.
    assert.deepEqual(statuses(s1.rec), ["done", "waiting", "done"], shape(s1.rec));
    assert.ok(P.page("visit.tsx").includes(TT_TO), "the TikTok change did not finish");
    assert.ok(P.page("about.tsx").includes(STORY_TO), "the About change did not finish while the hours waited");
    assert.ok(P.page("index.tsx").includes(HOURS) && P.page("visit.tsx").includes(HOURS), "the hours were changed before the answer");
    // ASKED AFTER THE REQUEST WAS CHARGED (part 0's job), AND OFFERED ITS QUESTION.
    const runs = s1.rec.parts.map((p) => p.jobs.filter((j) => j.kind === "run").map((j) => j.id));
    assert.ok(netOf(P, runs[0][0]) < 0, "part 0 was not charged: the question was not after a charge");
    const hoursCalls = calls(P, T.text).filter((m) => m.props && m.props.includes("question"));
    assert.ok(hoursCalls.length >= 3, "a text step was not offered its question: " + JSON.stringify(calls(P, T.text).map((m) => m.props)));
    // NOTHING CHARGED FOR THE QUESTION: the job that asked nets to zero.
    for (const id of runs[1]) assert.equal(netOf(P, id), 0, "the part that asked kept a charge: " + JSON.stringify(P.ledger.filter((e) => e.ref.startsWith(id))));
    const q = P.question();
    assert.equal(q && q.part, 1, "the question in the slot is not the hours part's");
    assert.equal(q.question.text, QH.text);
    assert.equal(q.status, "pending");
    const ledger0 = P.ledger.length;
    const routeRows0 = P.ledger.filter((e) => e.reason === "route" || e.ref.startsWith("route:")).length;
    // THE ANSWER RESUMES THAT PART, AT THE TEXT STEP, WITH THE ANSWER.
    await sendMessage(P, { message: "Both pages", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key, { rounds: 20 });
    assert.deepEqual(statuses(s2.rec), ["done", "done", "done"], shape(s2.rec));
    assert.ok(P.page("index.tsx").includes(HOURS_TO) && P.page("visit.tsx").includes(HOURS_TO), "the resumed part did not change both hours");
    assert.ok(P.page("visit.tsx").includes(TT_TO) && P.page("about.tsx").includes(STORY_TO), "finished work was undone");
    const last = calls(P, T.text).at(-1);
    assert.ok(last && /Both pages/.test(last.text) && last.text.includes(HOURS_MSG), "the text step was not shown the answer");
    // THE ANSWER'S ROUTING IS NOT CHARGED AGAIN; ONLY THE COMPLETED HOURS ARE.
    assert.equal(P.ledger.filter((e) => e.reason === "route" || e.ref.startsWith("route:")).length, routeRows0, "the answer was charged routing again");
    const after = P.ledger.slice(ledger0);
    const resumed = s2.rec.parts[1].jobs.filter((j) => j.kind === "run").map((j) => j.id).filter((id) => !runs[1].includes(id));
    assert.ok(resumed.length >= 1, "the answer did not run the part again");
    for (const e of after) assert.ok(resumed.some((id) => e.ref.startsWith(id)), "a charge after the answer that is not the resumed part's: " + JSON.stringify(e));
    assert.ok(resumed.some((id) => netOf(P, id) < 0), "the completed hours were not charged");
  });
});

// ── THE SOURCE: nothing stops a step asking because work was charged ──────────
test("AA 2 — no route passes a `charged` gate to a step's transport, no part is told questions are closed, and no part's question is turned into a choice", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const quick = W.indexOf("const eQuick = (what = \"\", ctx) => clarifyTransport(");
  const aquick = W.indexOf("const aQuick = (what = \"\", opts) => clarifyTransport(");
  assert.ok(quick > 0 && aquick > 0, "the step transports moved");
  assert.ok(W.includes("part: ePartShown, replayHas: eReplayHas") && W.includes("part: aPartShown, replayHas: aReplayHas"), "the transports' option lists moved");
  assert.doesNotMatch(W, /charged: [ea]ChargedYet/);
  assert.doesNotMatch(W, /offerAsk: !rPart/);
  assert.ok(!W.includes("partClarifyChoice"));
});
