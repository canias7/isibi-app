// Helper dependencies (2026-10-30, the owner: "a task that needs a previous
// task waits; a task that doesn't need one starts right away", everywhere,
// inside a build too). A helpers task may name `after`; the runner schedules
// the graph, lands each finished file before its dependents start, refuses
// cycles and unknown names up front, and skips a task whose dependency failed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent, MAX_HELPERS, helperPlan, makeWorkspace } from "../builder/site-agent.mjs";

const use = (name, input) => ({ type: "tool_use", name, input });
const answer = (...uses) => ({ content: uses, usage: { input_tokens: 1000, output_tokens: 200 }, stop_reason: "tool_use" });
const okBuild = async () => ({ ok: true });
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const whoOf = (req) => { const m = /handed you ONE file to write: (\S+)\. /.exec(req.messages[0].content[0].text); return m ? m[1] : "main"; };
const write = (file, src) => [answer(use("write_file", { file, source: src })), answer(use("finish", { summary: file + " done" }))];

// The main agent hands `tasks` then builds and finishes; each helper's script
// answers it. `log` records start/end per helper; `hold` delays a helper's first answer.
function harness(tasks, scripts, { hold = {}, gate = null } = {}) {
  const at = {}, log = [], results = [], firstMsgs = {}, toolResults = {};
  let running = 0, peak = 0;
  const main = [answer(use("helpers", { tasks })), answer(use("build", {})), answer(use("finish", { summary: "ok" }))];
  const send = async (req) => {
    const who = whoOf(req);
    const i = at[who] || 0;
    at[who] = i + 1;
    const last = req.messages[req.messages.length - 1];
    if (who === "main") {
      for (const b of Array.isArray(last.content) ? last.content : []) if (b.type === "tool_result") results.push(b);
      return main[Math.min(i, main.length - 1)];
    }
    if (i === 0) { log.push("start " + who); firstMsgs[who] = req.messages[0].content[0].text; running++; peak = Math.max(peak, running); if (gate) await gate(who); if (hold[who]) await tick(hold[who]); }
    for (const b of Array.isArray(last.content) ? last.content : []) if (b.type === "tool_result") (toolResults[who] ||= []).push(String(b.content));
    const script = scripts[who];
    if (i >= script.length - 1) { running--; log.push("end " + who); }
    return script[Math.min(i, script.length - 1)];
  };
  return { send, log, results, firstMsgs, toolResults, peak: () => peak };
}
const told = (h) => h.results.map((b) => String(b.content)).join("\n");

test("HD1 independent tasks start together: all three are running before any answers", { timeout: 5000 }, async () => {
  const started = new Set();
  let release;
  const all = new Promise((r) => { release = r; });
  const h = harness([{ file: "a.tsx", brief: "A" }, { file: "b.tsx", brief: "B" }, { file: "-parts/c-card", brief: "C" }], {
    "a.tsx": write("a.tsx", "export default function A(){return <p/>}"),
    "b.tsx": write("b.tsx", "export default function B(){return <p/>}"),
    "-parts/c-card": write("-parts/c-card", "export default function C(){return <p/>}"),
  }, { gate: async (who) => { started.add(who); if (started.size === 3) release(); await all; } });
  const r = await runSiteAgent({ send: h.send, build: okBuild }, { request: "r", pages: [], parts: [], helpers: true });
  assert.equal(r.ok, true, r.stopped);
  assert.equal(h.peak(), 3);
  assert.ok(r.parts.some((p) => p.name === "c-card"), "a helper may write a component");
});

test("HD2 a dependent task waits for its dependency and then reads its file", { timeout: 5000 }, async () => {
  const h = harness([
    { file: "menu.tsx", brief: "menu", after: ["-parts/menu-card"] },
    { file: "-parts/menu-card", brief: "card" },
  ], {
    "-parts/menu-card": write("-parts/menu-card", "export default function Card(){return <p>CARD_MARK</p>}"),
    "menu.tsx": [answer(use("read_files", { files: ["-parts/menu-card"] })), answer(use("write_file", { file: "menu.tsx", source: "export default function M(){return <p/>}" })), answer(use("finish", { summary: "m" }))],
  }, { hold: { "-parts/menu-card": 30 } });
  const r = await runSiteAgent({ send: h.send, build: okBuild }, { request: "r", pages: [], parts: [], helpers: true });
  assert.equal(r.ok, true, r.stopped);
  assert.deepEqual(h.log, ["start -parts/menu-card", "end -parts/menu-card", "start menu.tsx", "end menu.tsx"]);
  assert.match(h.toolResults["menu.tsx"][0], /CARD_MARK/, "the dependent did not see its dependency's file");
});

test("HD3 a chain A -> B -> C runs in order, by id or file", { timeout: 5000 }, async () => {
  const h = harness([
    { id: "c", file: "c.tsx", brief: "c", after: ["b"] },
    { id: "b", file: "b.tsx", brief: "b", after: ["a.tsx"] },
    { id: "a", file: "a.tsx", brief: "a" },
  ], {
    "a.tsx": write("a.tsx", "export default function A(){return <p/>}"),
    "b.tsx": write("b.tsx", "export default function B(){return <p/>}"),
    "c.tsx": write("c.tsx", "export default function C(){return <p/>}"),
  });
  const r = await runSiteAgent({ send: h.send, build: okBuild }, { request: "r", pages: [], parts: [], helpers: true });
  assert.equal(r.ok, true, r.stopped);
  assert.deepEqual(h.log, ["start a.tsx", "end a.tsx", "start b.tsx", "end b.tsx", "start c.tsx", "end c.tsx"]);
});

test("HD4 a cycle, a self-wait and an unknown dependency are refused up front; an existing file is fine", async () => {
  const ws = makeWorkspace([{ path: "index.tsx", source: "x" }], [{ name: "site-header", source: "x" }]);
  assert.match(helperPlan([{ file: "a.tsx", brief: "a", after: ["b.tsx"] }, { file: "b.tsx", brief: "b", after: ["a.tsx"] }], ws).error, /circle: .*a\.tsx.*b\.tsx/);
  assert.match(helperPlan([{ id: "x", file: "a.tsx", brief: "a", after: ["z"] }, { id: "y", file: "b.tsx", brief: "b", after: ["x"] }, { id: "z", file: "c.tsx", brief: "c", after: ["y"] }], ws).error, /circle/);
  assert.match(helperPlan([{ file: "a.tsx", brief: "a", after: ["a.tsx"] }], ws).error, /itself/);
  assert.match(helperPlan([{ file: "a.tsx", brief: "a", after: ["-parts/nope"] }], ws).error, /neither a task in this call nor a file that exists/);
  const ok = helperPlan([{ file: "a.tsx", brief: "a", after: ["-parts/site-header", "index.tsx"] }], ws);
  assert.deepEqual(ok.tasks[0].after, []);
  // through the tool: a tool error, and no helper runs
  let ran = false, err = null;
  const send = async (req) => {
    if (whoOf(req) !== "main") { ran = true; return answer(use("finish", { summary: "" })); }
    const last = req.messages[req.messages.length - 1];
    for (const b of Array.isArray(last.content) ? last.content : []) if (b.type === "tool_result") err = b;
    return err ? answer(use("finish", { summary: "" })) : answer(use("helpers", { tasks: [{ file: "a.tsx", brief: "a", after: ["b.tsx"] }, { file: "b.tsx", brief: "b", after: ["a.tsx"] }] }));
  };
  await runSiteAgent({ send, build: okBuild }, { request: "r", pages: [], parts: [], helpers: true, maxRounds: 2 });
  assert.ok(err && err.is_error && /circle/.test(err.content));
  assert.equal(ran, false);
});

test("HD5 a failed dependency skips its dependents with why; an independent task still runs", { timeout: 5000 }, async () => {
  const h = harness([
    { file: "a.tsx", brief: "a" },
    { file: "b.tsx", brief: "b", after: ["a.tsx"] },
    { file: "c.tsx", brief: "c", after: ["b.tsx"] },
    { file: "d.tsx", brief: "d" },
  ], {
    "a.tsx": [answer(use("finish", { summary: "gave up" }))],
    "b.tsx": write("b.tsx", "export default function B(){return <p/>}"),
    "c.tsx": write("c.tsx", "export default function C(){return <p/>}"),
    "d.tsx": write("d.tsx", "export default function D(){return <p/>}"),
  });
  const r = await runSiteAgent({ send: h.send, build: okBuild }, { request: "r", pages: [], parts: [], helpers: true });
  const t = told(h);
  assert.match(t, /a\.tsx: NOT written/);
  assert.match(t, /b\.tsx: SKIPPED \(skipped: it waits for a\.tsx, which was not written/);
  assert.match(t, /c\.tsx: SKIPPED \(skipped: it waits for b\.tsx/);
  assert.match(t, /d\.tsx: written/);
  assert.ok(!h.log.includes("start b.tsx") && !h.log.includes("start c.tsx"));
  assert.deepEqual(r.pages.map((p) => p.path), ["d.tsx"]);
});

test("HD6 progress shows each helper waiting, started and done (file names and numbers only)", { timeout: 5000 }, async () => {
  const facts = [];
  const h = harness([{ file: "menu.tsx", brief: "m", after: ["-parts/site-header"] }, { file: "-parts/site-header", brief: "h" }], {
    "-parts/site-header": write("-parts/site-header", "export default function H(){return <header/>}"),
    "menu.tsx": write("menu.tsx", "export default function M(){return <p/>}"),
  });
  await runSiteAgent({ send: h.send, build: okBuild, progress: (k, f) => { if (k === "agent") facts.push(...f.map((x) => x.text)); } }, { request: "r", pages: [], parts: [], helpers: true });
  const want = [
    'The "site-header" component: started.',
    "The /menu page: waiting for the \"site-header\" component.",
    'The "site-header" component: done (45 characters).',
    "The /menu page: started.",
    "The /menu page: done (40 characters).",
  ];
  for (const w of want) assert.ok(facts.includes(w), "missing: " + w + "\n" + facts.join("\n"));
  assert.ok(facts.indexOf(want[1]) < facts.indexOf(want[3]));
});

test("HD7 MAX_HELPERS is how many run at once, not how many one call may hold", { timeout: 5000 }, async () => {
  const n = MAX_HELPERS + 3;
  const tasks = Array.from({ length: n }, (_, i) => ({ file: "p" + i + ".tsx", brief: "b" }));
  const scripts = Object.fromEntries(tasks.map((t) => [t.file, write(t.file, "export default function P(){return <p/>}")]));
  const hold = Object.fromEntries(tasks.map((t) => [t.file, 10]));
  const h = harness(tasks, scripts, { hold });
  const r = await runSiteAgent({ send: h.send, build: okBuild }, { request: "r", pages: [], parts: [], helpers: true });
  assert.equal(r.pages.length, n);
  assert.equal(h.peak(), MAX_HELPERS);
});

test("HD8 edits get helpers; a helper inherits the scope guard (mayWrite)", { timeout: 5000 }, async () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const fn = W.slice(W.indexOf("async function runAgentChange("), W.indexOf("async function recompileAndPublish(env, {"));
  assert.ok(fn.length > 100);
  assert.match(fn, /runSiteAgent\(\{[^]*\}, \{[^]*\n\s*helpers: true,\n\s*\}\);/);
  // out of scope at plan time: refused up front
  const outside = (k) => (k === "secret.tsx" ? "outside the part asked for" : "");
  const ws = makeWorkspace();
  assert.match(helperPlan([{ file: "secret.tsx", brief: "x" }], ws, { mayWrite: outside }).error, /secret\.tsx: outside the part asked for/);
  // in scope at plan time, out of scope when the helper writes: the helper's own write is refused
  let calls = 0;
  const flips = (k) => (k === "about.tsx" && ++calls > 1 ? "outside the part asked for" : "");
  const h = harness([{ file: "about.tsx", brief: "a" }], { "about.tsx": write("about.tsx", "export default function A(){return <p/>}") });
  const r = await runSiteAgent({ send: h.send, build: okBuild, mayWrite: flips }, { request: "r", pages: [], parts: [], helpers: true });
  assert.ok(calls >= 2, "the helper never asked the scope guard");
  assert.match(h.toolResults["about.tsx"].join(" "), /outside the part asked for/);
  assert.match(told(h), /about\.tsx: NOT written/);
  assert.equal(r.pages.length, 0);
});
