// Helper agents (2026-10-30, the owner: "run agents in parallel"): on a new
// site the agent hands pages to helpers that write them at the same time; each
// writes only its own page, and their cost joins the run's.
import test from "node:test";
import assert from "node:assert/strict";
import { runSiteAgent, toolsFor, MAX_HELPERS } from "../builder/site-agent.mjs";

const use = (name, input) => ({ type: "tool_use", name, input });
const answer = (...uses) => ({ content: uses, usage: { input_tokens: 1000, output_tokens: 200 }, stop_reason: "tool_use" });
const okBuild = async () => ({ ok: true });

// One send for the main agent and every helper: a helper is known by its
// request, and its own script answers it.
function router(main, helperScripts, { gate = null } = {}) {
  const at = { main: 0 };
  const seen = [];
  return {
    seen,
    send: async (req) => {
      const first = req.messages[0].content[0].text;
      const m = /handed you ONE page to write: (\S+)\. /.exec(first);
      const who = m ? m[1] : "main";
      seen.push({ who, tools: req.tools.map((t) => t.name) });
      if (who !== "main" && gate) await gate(who);
      const script = who === "main" ? main : helperScripts[who];
      const i = at[who] || 0;
      at[who] = i + 1;
      return script[Math.min(i, script.length - 1)];
    },
  };
}

test("HLP1 helpers write their pages at the same time; the agent builds and finishes with them", { timeout: 5000 }, async () => {
  const started = [];
  let release;
  const both = new Promise((r) => { release = r; });
  const s = router([
    answer(use("write_file", { file: "-parts/site-header", source: "export default function H(){return <header/>}" }), use("write_file", { file: "index.tsx", source: "export default function Home(){return <h1>Home</h1>}" })),
    answer(use("helpers", { tasks: [{ file: "about.tsx", brief: "Our story" }, { file: "menu.tsx", brief: "The menu" }] })),
    answer(use("build", {})),
    answer(use("finish", { summary: "Built three pages." })),
  ], {
    "about.tsx": [answer(use("write_file", { file: "about.tsx", source: "export default function A(){return <p>About</p>}" })), answer(use("finish", { summary: "About page." }))],
    "menu.tsx": [answer(use("write_file", { file: "menu.tsx", source: "export default function M(){return <p>Menu</p>}" })), answer(use("finish", { summary: "Menu page." }))],
  }, {
    // BOTH HELPERS MUST BE RUNNING before either answers: one after the other would wait here forever.
    gate: async (who) => { if (!started.includes(who)) started.push(who); if (started.length === 2) release(); await both; },
  });
  const r = await runSiteAgent({ send: s.send, build: okBuild }, { request: "a bakery", pages: [], parts: [], helpers: true, model: "grok-4.7" });
  assert.equal(r.ok, true, r.stopped);
  assert.deepEqual(r.pages.map((p) => p.path).sort(), ["about.tsx", "index.tsx", "menu.tsx"]);
  assert.match(r.pages.find((p) => p.path === "menu.tsx").source, /Menu/);
  // their cost joins the run's: 4 main rounds + 2 rounds per helper
  assert.equal(r.usage.length, 8);
  // a helper is never offered helpers, build, look or run
  for (const x of s.seen.filter((x) => x.who !== "main")) for (const t of ["helpers", "build", "look", "run"]) assert.ok(!x.tools.includes(t), x.who + " was offered " + t);
  assert.ok(s.seen.find((x) => x.who === "main").tools.includes("helpers"));
});

test("HLP2 a helper writes only its own page; what it could not write comes back to the agent", async () => {
  let told = "";
  const s = router([
    answer(use("helpers", { tasks: [{ file: "about.tsx", brief: "x" }] })),
    answer(use("finish", { summary: "s" })),
  ], {
    "about.tsx": [answer(use("write_file", { file: "-parts/site-header", source: "export default function H(){return <b/>}" }), use("delete_file", { file: "index.tsx" })), answer(use("finish", { summary: "nothing" }))],
  });
  const refused = [];
  const send = async (req) => {
    const last = req.messages[req.messages.length - 1];
    if (/handed you ONE page/.test(req.messages[0].content[0].text) && last.role === "user" && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result" && b.is_error) refused.push(String(b.content));
    if (last.role === "user" && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result" && /helpers are back/.test(String(b.content))) told = b.content;
    return s.send(req);
  };
  const r = await runSiteAgent({ send, build: okBuild }, { request: "r", pages: [{ path: "index.tsx", source: "export default function H(){return <h1/>}" }], parts: [], helpers: true });
  assert.match(told, /about\.tsx: NOT written/);
  // the helper itself is told no, for the write and the removal
  assert.equal(refused.filter((t) => /only its own page, about\.tsx/.test(t)).length, 2, refused.join(" | "));
  assert.equal(r.pages.length, 1, "the helper removed or added a file it does not own");
  assert.ok(!r.parts.length, "the helper wrote a shared component");
});

test("HLP3 the tasks are checked: pages only, no duplicates, a brief each, at most MAX_HELPERS", async () => {
  const bad = [
    { tasks: [{ file: "-parts/x", brief: "b" }] },
    { tasks: [{ file: "styles.css", brief: "b" }] },
    { tasks: [{ file: "a.tsx", brief: "b" }, { file: "a.tsx", brief: "c" }] },
    { tasks: [{ file: "a.tsx", brief: "" }] },
    { tasks: Array.from({ length: MAX_HELPERS + 1 }, (_, i) => ({ file: "p" + i + ".tsx", brief: "b" })) },
  ];
  for (const input of bad) {
    let err = null;
    let helperRan = false;
    const send = async (req) => {
      if (/handed you ONE page/.test(req.messages[0].content[0].text)) { helperRan = true; return answer(use("finish", { summary: "" })); }
      const last = req.messages[req.messages.length - 1];
      for (const b of Array.isArray(last.content) ? last.content : []) if (b.type === "tool_result") err = b;
      return err ? answer(use("finish", { summary: "" })) : answer(use("helpers", input));
    };
    await runSiteAgent({ send, build: okBuild }, { request: "r", pages: [], parts: [], helpers: true, maxRounds: 2 });
    assert.ok(err && err.is_error, JSON.stringify(input).slice(0, 80) + " was accepted");
    assert.equal(helperRan, false);
  }
});

test("HLP4 helpers are offered only when asked for: an edit never gets them", async () => {
  let tools = null;
  await runSiteAgent({ send: async (req) => { tools = req.tools.map((t) => t.name); return answer(use("finish", { summary: "s" })); }, build: okBuild }, { request: "r", pages: [], parts: [] });
  assert.ok(!tools.includes("helpers"));
  assert.ok(!toolsFor({}).some((t) => t.name === "helpers"));
});
