// THE MAP IS PART OF WHAT A JOB RECORDS AND REPLAYS (2026-10-26).
//
// Live case (driftwood-and-daughters-5, 19:28 UTC): a part prepared at 17:28,
// before the site map reached the page step, was re-prepared after the deploy
// and could be answered from the 17:28 record, because the replayer keyed on
// the request before its map was added. Now a mapped send has its map added
// first, so the fingerprint is the request the model sees: same request and
// same map replays (the saving kept); another map, or none, makes the call.
//
// The code under test is worker.js's own `jobSend` / `jobSendRaw` / `jobCall`,
// read landmark to landmark and run with the real recorder, replayer and map
// transport.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recorder, replayer } from "../builder/prepared.mjs";
import { mapSend, mapCall, mapRequest } from "../builder/site-map.mjs";

const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const a = src.indexOf("const jobSendRaw = (job, send, opts) =>");
const b = src.indexOf("const jobCall = (job, call) =>");
const c = src.indexOf("/**", b);
assert.ok(a > 0 && b > a && c > b, "landmarks missing in worker.js");
const { jobSend, jobCall } = new Function("mapRequest", src.slice(a, c) + "\nreturn { jobSend, jobCall };")(mapRequest);

const REQ = { system: "You edit a page.", messages: [{ role: "user", content: "Put reviews above lessons" }] };
const answer = (t) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }], usage: { input_tokens: 1, output_tokens: 1 } });

async function recordWith(note) {
  const rec = recorder();
  const job = { prepare: true, rec };
  const out = await jobSend(job, mapSend(async () => answer("prepared"), note))(REQ);
  assert.equal(out.content[0].text, "prepared");
  assert.equal(rec.calls.length, 1, "observer dead: nothing was recorded");
  return rec.calls;
}
async function replayWith(calls, note) {
  const rp = replayer({ calls });
  let made = 0;
  const out = await jobSend({ replay: rp }, mapSend(async () => { made++; return answer("fresh"); }, note))(REQ);
  return { text: out.content[0].text, made, used: rp.used().calls };
}

const MAP_A = async () => "SITE MAP\nBand3Split — \"What people say after a session\"";
const MAP_B = async () => "SITE MAP\nBand3Split — \"Today's surf\"";

test("same request, same map: replayed, no model call", async () => {
  const r = await replayWith(await recordWith(MAP_A), MAP_A);
  assert.deepEqual(r, { text: "prepared", made: 0, used: 1 });
});

test("same request, another map: a fresh call", async () => {
  const r = await replayWith(await recordWith(MAP_A), MAP_B);
  assert.deepEqual(r, { text: "fresh", made: 1, used: 0 });
});

test("recorded with no map, replayed with one: a fresh call", async () => {
  const r = await replayWith(await recordWith(async () => ""), MAP_A);
  assert.deepEqual(r, { text: "fresh", made: 1, used: 0 });
});

test("the page writer's transport (`jobCall`) keys on its map the same way", async () => {
  const rec = recorder();
  await jobCall({ prepare: true, rec }, mapCall(async () => answer("prepared"), MAP_A))({}, REQ, null);
  assert.equal(rec.calls.length, 1, "observer dead");
  let made = 0;
  const run = (note) => jobCall({ replay: replayer({ calls: rec.calls }) }, mapCall(async () => { made++; return answer("fresh"); }, note))({}, REQ, null);
  assert.equal((await run(MAP_A)).content[0].text, "prepared");
  assert.equal(made, 0);
  assert.equal((await run(MAP_B)).content[0].text, "fresh");
  assert.equal(made, 1);
});

test("a send with no job is unchanged: the map still reaches the model", async () => {
  let seen = null;
  await jobSend(null, mapSend(async (r) => { seen = r; return answer("x"); }, MAP_A))(REQ);
  assert.ok(JSON.stringify(seen).includes("What people say after a session"));
});

test("the map is read once per call, not once per layer", async () => {
  let reads = 0;
  const note = async () => { reads++; return "SITE MAP\nx"; };
  await jobSend({ replay: replayer(null) }, mapSend(async () => answer("x"), note))(REQ);
  assert.equal(reads, 1);
});
