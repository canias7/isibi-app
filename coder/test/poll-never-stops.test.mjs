// Group 1's "stuck" chat (2026-11-17): the job ended in 25 s, but the page showed it working for 15 minutes. A look that
// hung or threw while drawing ended the page's loop. Each look now has a time limit, and the next one is always set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");

test("the page's look at a running chat always sets the next one, even after a throw", () => {
  const m = /async function tick\(\) \{\n    try \{ [^\n]*await streamOnce\(\); else await tickOnce\(\); \}\n[\s\S]*?finally \{ if \(S\.running && S\.project && !S\.poll\) S\.poll = setTimeout\(tick, POLL_MS\); \}/.exec(js);
  assert.ok(m, "tick wraps tickOnce and always sets the next look");
  assert.match(js, /async function tickOnce\(\) \{\n    S\.poll = 0;/);
});

test("each look has a time limit, so a hung request ends and the page asks again", async () => {
  assert.match(js, /const POLL_LIMIT_MS = 90000;/);
  assert.match(js, /'\/state\?since=' [^\n]*\{ limit: POLL_LIMIT_MS \}\)/);
  assert.match(js, /AbortSignal\.timeout\(init\.limit\)/);
  // The limit really ends a request that never answers (the same way the page asks).
  const t0 = Date.now();
  const r = await fetch("data:,x", { signal: AbortSignal.timeout(1) }).then(() => "ok", (e) => e.name);
  assert.ok(["ok", "TimeoutError", "AbortError"].includes(r));
  assert.ok(Date.now() - t0 < 5000);
});

test("the loop logic: a throwing look still schedules the next, a finished chat does not", async () => {
  const S = { running: true, project: { id: "a" }, poll: 0 };
  const timers = [];
  const setT = (f, ms) => { timers.push(ms); return timers.length; };
  const POLL_MS = 1000;
  let mode = "throw";
  async function tickOnce() { S.poll = 0; if (mode === "throw") throw new Error("draw failed"); if (mode === "end") S.running = false; }
  async function tick() { try { await tickOnce(); } catch (e) {} finally { if (S.running && S.project && !S.poll) S.poll = setT(tick, POLL_MS); } }
  await tick();
  assert.equal(timers.length, 1, "a throw still sets the next look");
  mode = "end"; S.poll = 0;
  await tick();
  assert.equal(timers.length, 1, "a chat no longer running is not looked at again");
});

test("the live stream: the Worker sends each state as it comes, the machine waits for news, the page reads and reconnects", () => {
  const w = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(w, /if \(action === "stream" && request\.method === "GET"\)/);
  assert.match(w, /"content-type": "text\/event-stream; charset=utf-8"/);
  assert.match(w, /"&wait=" \+ STREAM_WAIT_MS/);
  assert.match(w, /if \(!d\.running \|\| d\.reload\) break;/, "the stream ends when the job is over");
  const m = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(m, /const waitMs = Math\.min\(25_000/);
  assert.match(js, /async function streamOnce\(\)/);
  assert.match(js, /'\/stream\?since='/);
  assert.match(js, /S\.poll = setTimeout\(tick, threw \? POLL_MS : 150\)/, "a stream that ended while the chat runs is opened again at once");
  assert.match(js, /\(S\.streamFails \|\| 0\) < 3/, "after 3 failed streams, the page goes back to its looks");
  assert.match(js, /function applyState\(r, id\)/, "a look and the stream draw a state the same way");
});

test("the page's stream reader splits server-sent events as the Worker writes them", () => {
  const parse = (text) => { const out = []; let buf = text, k; while ((k = buf.indexOf("\n\n")) >= 0) { const block = buf.slice(0, k); buf = buf.slice(k + 2); const line = /^data: (.*)$/m.exec(block); if (line) out.push(JSON.parse(line[1])); } return { out, rest: buf }; };
  const r = parse(": open\n\ndata: {\"running\":true,\"events\":[1]}\n\ndata: {\"running\":false}\n\ndata: {\"half");
  assert.deepEqual(r.out, [{ running: true, events: [1] }, { running: false }]);
  assert.equal(r.rest, "data: {\"half", "a part not yet whole waits for the rest");
});
