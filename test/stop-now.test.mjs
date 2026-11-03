// STOP AT ONCE (owner, 2026-11-03: "when you press stop it should stop at the
// moment"). A job learns its cancel on its heartbeat; before this, the agent
// beat only between rounds, so a Stop waited out a whole model turn or build.
// Now a model call or a build in flight beats every STOP_BEAT_MS and ends the
// run within seconds of the cancel, keeping nothing (`ok: false`).
import test from "node:test";
import assert from "node:assert/strict";
import { runSiteAgent, STOP_BEAT_MS, STOP_POLL_MS } from "../builder/site-agent.mjs";

delete process.env.GF_OLD_LANES;

const use = (name, input, id) => ({ type: "tool_use", id, name, input });

// A job whose cancel is only seen on its heartbeat, as the real job's is.
function job(cancelAt) {
  let cancelled = false, beats = 0;
  const t0 = Date.now();
  return {
    beat: async () => { beats++; if (Date.now() - t0 >= cancelAt) cancelled = true; },
    stopped: () => cancelled,
    beats: () => beats,
  };
}

test("SN1 a Stop during a long model call ends the run within seconds, not when the call returns", { timeout: 30000 }, async () => {
  const j = job(500);
  const t0 = Date.now();
  let calls = 0;
  const send = (req, opt) => new Promise((resolve, reject) => {
    calls++;
    const t = setTimeout(() => resolve({ stop_reason: "tool_use", content: [use("finish", { summary: "late" }, "f")], usage: { input_tokens: 1, output_tokens: 1 } }), 60000);
    if (opt && opt.signal) opt.signal.addEventListener("abort", () => { clearTimeout(t); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
  });
  const r = await runSiteAgent({ send, beat: j.beat, stopped: j.stopped, build: async () => ({ ok: true }) },
    { request: "change the title", pages: [{ path: "index.tsx", source: "export default function H(){return <h1>Hi</h1>}" }], parts: [], model: "claude-sonnet-4-5" });
  const took = Date.now() - t0;
  assert.equal(r.ok, false, "a stopped run ended ok");
  assert.equal(r.stopped, "cancelled");
  assert.equal(calls, 1);
  assert.ok(took < STOP_BEAT_MS + STOP_POLL_MS * 3 + 1000, "the Stop took " + took + " ms");
});

test("SN2 a Stop during a long build ends the run within seconds and keeps nothing", { timeout: 30000 }, async () => {
  const j = job(500);
  let round = 0;
  const send = async () => {
    round++;
    const c = round === 1 ? [use("write_file", { file: "index.tsx", source: "export default function H(){return <h1>Bye</h1>}" }, "w"), use("build", {}, "b")]
      : [use("finish", { summary: "done" }, "f")];
    return { stop_reason: "tool_use", content: c, usage: { input_tokens: 1, output_tokens: 1 } };
  };
  const t0 = Date.now();
  const r = await runSiteAgent({ send, beat: j.beat, stopped: j.stopped, build: () => new Promise((ok) => setTimeout(() => ok({ ok: true }), 60000)) },
    { request: "change the title", pages: [{ path: "index.tsx", source: "export default function H(){return <h1>Hi</h1>}" }], parts: [], model: "claude-sonnet-4-5" });
  const took = Date.now() - t0;
  assert.equal(r.ok, false, "a stopped build ended ok");
  assert.ok(took < STOP_BEAT_MS + STOP_POLL_MS * 3 + 1000, "the Stop took " + took + " ms");
  assert.equal(round, 1, "the agent went on to another round after the Stop");
});
