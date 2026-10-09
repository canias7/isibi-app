// THE READINESS PRESS (2026-10-09, `lv-parallel`; prepared after the owner
// approved the release and this preparation).
//
// What it must be: one message on fold-lane-bakery whose three parts the
// preparation rules make concurrent — a footer link with no address (it asks),
// a price (a data step) and a heading (a text step) — then the answer, inside
// its budget, its hard cap, its walls and its time; the focaccia put back by
// the run. And what it reads: the request view's own preparation reading
// (`prep`) kept on the canary's trail, judged by `overlapVerdict` — a part
// worked out while another part's job was queued or running, never inferred
// from timing or from a reply.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { UI_SCENARIOS, readUiScenario, pathNeedMs, pressLimitMs, UI_PRESS_MAX_MS, UI_REPLY_FLOOR_MS } from "../scripts/canary-ui.mjs";
import { overlapVerdict, requestBatchVerdict } from "../scripts/canary-requests.mjs";
import { rqApp, drive, view, part, RQ_KEY } from "./fixtures/canary-rq-app.mjs";

const LP = UI_SCENARIOS["lv-parallel"];
const M1 = "Add a link to our YouTube channel in the footer, change the Sea Salt Focaccia's price to £4.60, and change the Order page heading 'Choose your loaf and a collection time' to 'Pick your loaf and a collection time'.";
const M2 = "It's youtube.com/@harbourloaf";

test("lv-parallel: on the bakery, in request mode, two messages word for word — the footer link first (it asks), the price and the heading beside it — then the answer; inside its budget, cap, walls and time; the focaccia put back", () => {
  assert.ok(LP, "no lv-parallel scenario");
  assert.equal(readUiScenario("lv-parallel", "fold-lane-bakery").ok, true);
  assert.equal(readUiScenario("lv-parallel", "fretwork-1").ok, false);
  assert.equal(LP.request, true);
  assert.deepEqual(LP.steps.map((s) => s.say), [M1, M2]);
  assert.equal(LP.steps[0].until, "question", "the first message must end on the footer link's question");
  assert.equal(LP.steps[1].until, undefined);
  // MONEY: about 11-17; nothing is sent unless the balance covers the budget
  // and is no more than the cap.
  assert.equal(LP.budget, 20);
  assert.equal(LP.fundsFirst, true);
  assert.ok(LP.cap >= LP.budget && LP.cap <= 30, "cap " + LP.cap);
  // WALLS: the footer link's add-on hand-over to the menu step, the price's
  // data step and the heading's text step — nothing that rewrites a page.
  assert.equal(LP.addon, true);
  assert.deepEqual([...LP.layers].sort(), ["data", "nav", "text"]);
  // WHAT IT CHECKS.
  assert.equal(LP.expect.overlap, true);
  // NO PROGRESS CHECK (run 113): it reads a closed-tab message, which this press does not have.
  assert.equal(LP.expect.progress, undefined);
  assert.ok(LP.steps.every((st) => st.away === undefined));
  assert.deepEqual(LP.expect.social, { network: "youtube", host: "youtube.com", path: "/@harbourloaf" });
  assert.deepEqual(LP.expect.headings, [{ route: "/order", from: "Choose your loaf and a collection time", to: "Pick your loaf and a collection time" }]);
  assert.deepEqual([...LP.covers], ["several-parts", "step-question", "answer-resumes"]);
  // THE ROW: the focaccia, 4.5 -> 4.6, PUT BACK (no `restore: false`), against
  // the table as read whole on 2026-10-09: seven rows, the Walnut Levain at 6.2.
  assert.equal(LP.row.table, "loaves");
  assert.equal(LP.row.id, 6);
  assert.deepEqual(LP.row.match, { name: "Sea Salt Focaccia" });
  assert.equal(LP.row.from, "4.5");
  assert.equal(LP.row.to, "4.6");
  assert.notEqual(LP.row.restore, false, "the run must put the focaccia back");
  assert.equal(LP.row.record.length, 7);
  assert.equal(LP.row.record.find((r) => r.id === 5).price, 6.2);
  assert.equal(LP.row.record.find((r) => r.id === 6).price, 4.5);
  // TIME: each message's bound covers its measured path, every container wait
  // at the longest measured; the two with their reply floors fit the press.
  for (const s of LP.steps) assert.ok(s.ms >= pathNeedMs(s.path), `${s.say.slice(0, 30)}: ${s.ms} < ${pathNeedMs(s.path)}`);
  const need = LP.steps.reduce((t, s) => t + s.ms + UI_REPLY_FLOOR_MS, 0);
  assert.ok(need <= pressLimitMs(LP) && pressLimitMs(LP) === UI_PRESS_MAX_MS, `${need} > ${pressLimitMs(LP)}`);
  // NO OTHER SCENARIO SENDS ITS WORDS.
  for (const [k, sc] of Object.entries(UI_SCENARIOS)) if (k !== "lv-parallel") for (const s of sc.steps || []) assert.ok(s.say !== M1 && s.say !== M2, k);
  // THE FORM NAMES IT.
  const flow = fs.readFileSync(new URL("../.github/workflows/edit-canary.yml", import.meta.url), "utf8");
  assert.match(flow, /lv-parallel \(the readiness press on fold-lane-bakery/);
});

// ── THE VERDICT ──────────────────────────────────────────────────────────────

const stepOf = (trail) => ({ sent: true, request: { trail } });

test("overlapVerdict: a part preparing or prepared while another part's job is queued or running passes; preparation with nothing running, no preparation at all, and an unread request do not", () => {
  const yes = overlapVerdict(stepOf([
    { ms: 1000, parts: [[0, "started"], [1, "ready"], [2, "ready"]] },
    { ms: 4000, parts: [[0, "started"], [1, "ready"], [2, "ready"]], prep: [[1, "preparing"]] },
  ]));
  assert.equal(yes.ok, true, yes.why);
  assert.match(yes.seen[0], /part 1 was preparing while part 0 started/);
  const prepared = overlapVerdict(stepOf([{ ms: 9000, parts: [[0, "queued"], [1, "ready"]], prep: [[1, "prepared"]] }]));
  assert.equal(prepared.ok, true, prepared.why);
  // A PREPARATION SEEN ONLY WHEN NOTHING ELSE RAN: the part waiting on its
  // question is not a job running, and a finished part is not either.
  const alone = overlapVerdict(stepOf([{ ms: 1000, parts: [[0, "waiting"], [1, "ready"], [2, "done"]], prep: [[1, "prepared"]] }]));
  assert.equal(alone.ok, false);
  assert.match(alone.why, /never while another part's job/);
  // A PART'S OWN JOB DOES NOT COUNT AS ANOTHER'S.
  const own = overlapVerdict(stepOf([{ ms: 1000, parts: [[1, "queued"]], prep: [[1, "prepared"]] }]));
  assert.equal(own.ok, false);
  const none = overlapVerdict(stepOf([{ ms: 1000, parts: [[0, "started"], [1, "ready"]] }]));
  assert.equal(none.ok, false);
  assert.match(none.why, /no view showed any part being prepared/);
  const unread = overlapVerdict(stepOf([]));
  assert.equal(unread.ok, false);
  assert.match(unread.why, /never read/);
  // ANY OTHER READING IS NOT A PREPARATION.
  assert.equal(overlapVerdict(stepOf([{ ms: 1, parts: [[0, "started"], [1, "ready"]], prep: [[1, "done"]] }])).ok, false);
});

test("the press's verdict carries the overlap check only when the scenario asks for it, read from the first message", () => {
  const spec = { steps: [{ say: "x" }], expect: { overlap: true } };
  const trail = [{ ms: 1000, parts: [[0, "started"], [1, "ready"]], prep: [[1, "prepared"]] }];
  const named = "message 1: a part was being worked out while another part's job was queued or running";
  const pass = requestBatchVerdict({ spec, steps: [{ sent: true, request: { trail, final: { parts: [] } } }] });
  const c = pass.checks.find((x) => x.name === named);
  assert.ok(c, "no overlap check");
  assert.equal(c.ok, true, c.why);
  const fail = requestBatchVerdict({ spec, steps: [{ sent: true, request: { trail: [{ ms: 1, parts: [[0, "started"]] }], final: { parts: [] } } }] });
  assert.equal(fail.checks.find((x) => x.name === named).ok, false);
  const unsent = requestBatchVerdict({ spec, steps: [] });
  assert.equal(unsent.checks.find((x) => x.name === named).ok, false);
  const off = requestBatchVerdict({ spec: { steps: [{ say: "x" }], expect: {} }, steps: [{ sent: true, request: { trail, final: { parts: [] } } }] });
  assert.equal(off.checks.some((x) => x.name === named), false, "a press that does not ask is judged on it");
});

// ── THE TRAIL, THROUGH THE REAL CANARY DRIVER ───────────────────────────────

test("the canary's own trail keeps each part's preparation reading from the request view, through the real driver, and the verdict reads it", async () => {
  const sc = UI_SCENARIOS["rq-3-facebook"];
  // (The page's own first look takes a view before the canary's, so the
  // preparing reading is shown twice.)
  const preparing = () => view(RQ_KEY(3), [part(0, "change the heading …", "started", { route: "text", ids: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "ready", { prep: "preparing" })]);
  const VIEWS = [
    preparing(), preparing(),
    view(RQ_KEY(3), [part(0, "change the heading …", "started", { route: "text", ids: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "ready", { prep: "prepared" })]),
    view(RQ_KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "started", { route: "addon", ids: ["j2"] })]),
    view(RQ_KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }),
      part(1, "add a link to our Facebook page in the footer", "waiting", { route: "addon", ids: ["j2"], jobs: ["j2"], question: { id: "q1", text: "What is the address of your Facebook page?", options: [] } })], { state: "waiting" }),
  ];
  const ANSWERED = [
    view(RQ_KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "done", { route: "nav", addition: true, ids: ["j2", "j3"], jobs: ["j2", "j3"] })], { ended: true }),
  ];
  const REPLIES = {
    j1: { ok: true, msg: "✅ Changed.", reply: "The heading now reads “Our shop”.", replySource: "model" },
    j2: { ok: false, clarify: { id: "q1", text: "What is the address of your Facebook page?" } },
    j3: { ok: true, msg: "✅ Added.", reply: "Your footer now links to your Facebook page.", replySource: "model" },
  };
  const h = rqApp({ send: () => ({ request: { key: RQ_KEY(3), views: VIEWS } }), answerViews: ANSWERED, replies: REPLIES });
  const rec = await drive(h, sc);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  const trail = rec.steps[0].request.trail;
  assert.ok(trail.some((v) => Array.isArray(v.prep) && v.prep.some(([n, s]) => n === 1 && s === "preparing")), JSON.stringify(trail));
  assert.ok(trail.some((v) => Array.isArray(v.prep) && v.prep.some(([n, s]) => n === 1 && s === "prepared")), "a change of preparation alone was not kept: " + JSON.stringify(trail));
  const v = overlapVerdict(rec.steps[0]);
  assert.equal(v.ok, true, v.why);
  // A VIEW WITH NO PREPARATION CARRIES NO `prep` (the older trail's shape).
  assert.ok(trail.some((x) => !("prep" in x)));
});
