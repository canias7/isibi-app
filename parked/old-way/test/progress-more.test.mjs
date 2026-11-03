// PARKED (2026-11-03, park-old-way): the old-way half of test/progress-more.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE BUILDER TALKS THROUGH EVERY STEP (2026-10-19, owner: "it needs to talk
// more … like literally everything … look at claude code"). Each step that used
// to run in silence gives the model facts from its own numbers; the model words
// them. These hold what each fact may say: only what the numbers show, in a
// state the record accepts, and never that anything is published.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildStepFacts, talkBuildStepFacts, addressFacts, PROGRESS_STATES, TALK_STATES } from "../../../builder/site-progress.mjs";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const texts = (fs) => fs.map((f) => f.text).join(" | ");

// ── ROUND 2: THE WRITING AS IT GOES ─────────────────────────────────────────
import { filesDoneSoFar } from "../../../builder/gen-code.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";

const SERVER = readFileSync(new URL("../../../builder/build-server.mjs", import.meta.url), "utf8");

// ── ROUND 3: EDITS AND ADD-ONS STEP BY STEP ─────────────────────────────────
import { editStepStartFacts, editStepFacts, editBuildingFacts, draftSavedFacts, editPublishFacts, addonPublishFacts } from "../../../builder/site-progress.mjs";

test("R3 THE WIRING: each part, the build wait and the draft save are marked, and the publish facts know a draft", () => {
  assert.match(W, /eJob\.progress\.mark\("part", editStepStartFacts\(step, steps\.indexOf\(step\), steps\.length\)\)/, "a part is no longer said as it starts");
  assert.match(W, /done\.push\(\{ step, res, body, failed \}\);\s*\n(?:\s*\/\/.*\n)*\s*if \(steps\.length > 1 && eJob && eJob\.progress && eJob\.progress\.talk\) \{ try \{ eJob\.progress\.mark\("part-done", editStepFacts\(done\[done\.length - 1\]/, "a part's outcome is no longer said when it has one");
  assert.match(W, /job\.progress\.mark\("building", editBuildingFacts\(\)\)/, "the build wait is silent again");
  assert.match(W, /if \(act\.draft && job && job\.progress && job\.progress\.talk\) job\.progress\.mark\("saved", draftSavedFacts\(\)\)/, "a draft save is no longer said");
  assert.match(W, /editPublishFacts\(done, \{ draft: draftFirst\(env\) \}\)/, "an edit's publish facts no longer know a draft");
  assert.match(W, /addonPublishFacts\(aPendingPhotos, \{ draft: draftFirst\(env\) \}\)/, "an add-on's publish facts no longer know a draft");
  assert.match(W, /mark\?\.\("container", draftFirst\(env\) \? \{ draft: 1 \} : undefined\)/, "a build's container step no longer knows a draft");
});

// ── ROUND 4: THE BUTTONS TALK (owner chose "B") ─────────────────────────────
import { actionFacts, actionContext, ACTION_KINDS } from "../../../builder/site-progress.mjs";
const CHATJS = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");

// ── ROUND 5: THE DESIGN SAYS WHAT IT IS DOING ───────────────────────────────
import { designStartFacts, designPartFacts } from "../../../builder/site-progress.mjs";
import { designInGraph } from "../../../builder/design-graph.mjs";
import { designInWaves } from "../../../builder/design-waves.mjs";

const TOOL = { name: "design_schema", input_schema: { type: "object", properties: { pages: { type: "array" }, theme: { type: "string" }, brand: { type: "string" } } } };
const answer = (input) => ({ content: [{ type: "tool_use", name: "design_schema", input }], usage: { input_tokens: 1, output_tokens: 1 } });

// ── ROUND 6: EACH SECTION, BY NAME, AS IT STARTS AND AS IT ENDS ──────────────
import { sectionStartFacts, sectionDoneFacts } from "../../../builder/site-progress.mjs";

// ── ROUND 7: WHAT IS GOING ON THE PAGE, WHILE IT IS WRITTEN ─────────────────
import { wordsSoFar } from "../../../builder/gen-code.mjs";
import { writingNowFacts } from "../../../builder/site-progress.mjs";

// ── ROUND 8: THE CONTAINER'S BUILD STEPS, WHILE THEY RUN ────────────────────
import { compileStageFacts } from "../../../builder/site-progress.mjs";

// ── ROUND 10: AT MOST THREE LIVE CONNECTIONS PER ACCOUNT ─────────────────────
/** A bucket that keeps etags and honours onlyIf, as R2 does. */
function leaseBucket() {
  const m = new Map(); let n = 0; let fail = false;
  return {
    m, setFail: (v) => { fail = v; },
    async get(k) { if (fail) throw new Error("down"); const v = m.get(k); return v ? { etag: v.etag, text: async () => v.body } : null; },
    async put(k, body, o = {}) {
      if (fail) throw new Error("down");
      const cur = m.get(k);
      if (o.onlyIf && o.onlyIf.etagMatches && (!cur || cur.etag !== o.onlyIf.etagMatches)) return null;
      if (o.onlyIf && o.onlyIf.etagDoesNotMatch === "*" && cur) return null;
      const etag = "e" + (++n); m.set(k, { body, etag }); return { etag };
    },
  };
}

// ── ROUND 11: ONE ROOM PER JOB PUSHES THE TALK (DURABLE OBJECTS) ─────────────
function fakeRoomCtx() {
  const store = new Map(); const sockets = []; let alarm = null;
  return {
    store, sockets, alarmAt: () => alarm,
    storage: {
      get: async (k) => (store.has(k) ? structuredClone(store.get(k)) : undefined),
      put: async (k, v) => { store.set(k, structuredClone(v)); },
      setAlarm: async (t) => { alarm = t; },
      delete: async (k) => store.delete(k),
      deleteAll: async () => { store.clear(); },
    },
    getWebSockets: () => sockets,
    acceptWebSocket: (ws) => sockets.push(ws),
  };
}
const fakeSocket = () => { const sent = []; return { sent, closed: false, send: (m) => sent.push(JSON.parse(m)), close() { this.closed = true; } }; };
const say = (room, body) => room.fetch(new Request("https://room/say", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
