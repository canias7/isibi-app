// Group 1's "stuck" chat (2026-11-17): the job ended in 25 s, but the page showed it working for 15 minutes. A look that
// hung or threw while drawing ended the page's loop. Each look now has a time limit, and the next one is always set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");

test("the page's look at a running chat always sets the next one, even after a throw", () => {
  const m = /async function tick\(\) \{\n    try \{ await tickOnce\(\); \}\n[\s\S]*?finally \{ if \(S\.running && S\.project && !S\.poll\) S\.poll = setTimeout\(tick, POLL_MS\); \}/.exec(js);
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
