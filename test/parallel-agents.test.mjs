// PARALLEL AGENTS (2026-10-30, the owner: "we switched it to one big agent,
// but i still want parallel agents tho, so make it work how it used to work").
//
// A site's message sent with its key is ONE part run by the site agent, which
// splits it itself (`split_work`, 2026-11-02, agent-only: the router is gone);
// the parts run side by side where they can (`PARALLEL_WRITES`), and EACH
// PART'S JOB IS RUN BY THE SITE AGENT with that part's words only — never the
// old lanes, never a routing call. These cases run the REAL Worker
// (the routing route, the queue consumer, the edit route, the request driver)
// against `test/fixtures/request-flow.mjs`.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: each agent's answers (the splitting one's too)
// are the case's. Nothing here says what a real model would answer.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { HOME, VISIT } from "./fixtures/live-ask.mjs";

// The agent's own file: it runs as production does (the unit suite stands it aside).
delete process.env.GF_OLD_LANES;

const A = "Change the visit heading to Find us";
const B = "change the home tagline to Baked at dawn";
const VISIT_NEW = VISIT.replace("Come to the bakery", "Find us");
const HOME_NEW = HOME.replace("Bread from the harbour, every morning.", "Baked at dawn");
const HOME_CLASH = HOME.replace("Order a loaf for collection", "Collect a loaf");

const use = (name, input) => ({ type: "tool_use", id: "t" + Math.random().toString(16).slice(2, 8), name, input });
const firstText = (args) => {
  const c = args.messages && args.messages[0] && args.messages[0].content;
  return typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => (b && b.text) || "").join("") : "";
};
/** One agent per part, chosen by the words it was handed; its round is the number of its own answers so far. */
function agents(scripts, seen) {
  return (args) => {
    if (!(args.tools || []).some((t) => t.name === "finish")) return new Response("not the agent", { status: 400 });
    const text = firstText(args);
    const round = (args.messages || []).filter((m) => m.role === "assistant").length;
    // THE MESSAGE'S OWN AGENT (it holds every part's words) SPLITS IT.
    if (Object.keys(scripts).filter((k) => text.includes(k)).length > 1) return { __raw: { stop_reason: "tool_use", content: [SPLIT_USE()] } };
    const who = Object.keys(scripts).find((k) => text.includes(k));
    if (round === 0) seen.push({ who, text });
    const s = who ? scripts[who] : [[use("finish", { summary: "Nothing." })]];
    return { __raw: { stop_reason: "tool_use", content: s[Math.min(round, s.length - 1)] } };
  };
}
// THE AGENT'S OWN SPLIT (no router): part 1 = A on /visit, part 2 = B on /.
const SPLIT_USE = () => use("split_work", { parts: [{ instruction: A, pages: ["/visit"] }, { instruction: B, pages: ["/"] }] });
const DONE = (rec) => rec.parts.map((p) => p.status);

/** Deliver every queued message as the real queue does, side by side, until the request ends. */
async function runAll(P, key) {
  const running = [];
  for (let i = 0; i < 80; i++) {
    const m = P.queue.shift();
    if (!m) {
      await new Promise((ok) => setTimeout(ok, 15));
      const rec = P.record(key);
      if (!P.queue.length && rec && rec.ended) break;
      continue;
    }
    running.push(deliver(P, m));
    await new Promise((ok) => setTimeout(ok, 5));
  }
  await Promise.allSettled(running);
  return settle(P, key, { rounds: 20 });
}

async function until(ok, ms = 5000) {
  const end = Date.now() + ms;
  while (!ok()) { if (Date.now() > end) throw new Error("waited too long"); await new Promise((r) => setTimeout(r, 5)); }
}

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform({ slug: "pa-" + Math.random().toString(16).slice(2, 8), beside: true, balance: 400, ...opts });
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}

test("PA1 a two-change message is split by its own agent (split_work) and each part is run by the site agent with its own words only; both land; no routing call", async () => {
  const seen = [];
  await withPlatform({
    answers: {
      "": agents({
        [A]: [[use("write_file", { file: "visit.tsx", source: VISIT_NEW })], [use("build", {})], [use("finish", { summary: "Visit heading is Find us." })]],
        [B.slice(1)]: [[use("write_file", { file: "index.tsx", source: HOME_NEW })], [use("build", {})], [use("finish", { summary: "Home tagline is Baked at dawn." })]],
      }, seen),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: A + ", and " + B + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    // A REQUEST OF ONE PART, which its agent splits.
    assert.ok(r.body.request && r.body.request.parts.length === 1, "not a request of one part: " + JSON.stringify(r.body));
    const { rec } = await runAll(P, r.key);
    assert.deepEqual(DONE(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].outcome.kind, "split-work");
    assert.equal(P.page("visit.tsx"), VISIT_NEW);
    assert.equal(P.page("index.tsx"), HOME_NEW);
    // EACH AGENT WAS HANDED ITS OWN PART, and not the other's.
    assert.equal(seen.length, 2, "two agents: " + JSON.stringify(seen.map((s) => s.who)));
    const forA = seen.find((s) => s.who === A), forB = seen.find((s) => s.who === B.slice(1));
    assert.ok(forA && forB, "an agent was not run for each part");
    // ONLY THE REQUEST'S OWN WORDS: the site map below them may already show the
    // other part's saved change when that part finished first (CI, 2026-10-30).
    const req = (s) => { const at = s.text.indexOf("THE OWNER'S REQUEST"); assert.ok(at >= 0, "no request section"); const rest = s.text.slice(at); const end = rest.indexOf("\n\n"); return end > 0 ? rest.slice(0, end) : rest; };
    assert.ok(!req(forA).includes("Baked at dawn"), "part 0's agent was handed part 1's words: " + req(forA));
    assert.ok(!req(forB).includes("Find us"), "part 1's agent was handed part 0's words: " + req(forB));
    // NO ROUTING CALL; NO OLD LANE WAS ASKED.
    const tools = new Set(P.modelLog.map((m) => m.tool));
    assert.ok(P.modelLog.length >= 7, "the observer saw no call");
    assert.equal(P.modelLog.filter((m) => m.tool === T.route).length, 0);
    // the text rung (`T.text`) may be tried first on a `text` part (guardrail 5, 2026-10-30); the agent still does the work here
    for (const t of [T.pick, T.tweak, T.lane, T.pages, T.adds]) assert.ok(!tools.has(t), "an old lane was asked: " + t);
  });
});

test("PA2 two agents that write the same file differently: the later save is refused as an overlap and its part re-runs alone, so both changes land", async () => {
  const seen = [];
  let clashRuns = 0, readDone = false;
  const ref = { P: null, key: null };
  await withPlatform({
    answers: {
      "": async (args) => {
        // SIDE BY SIDE ON PURPOSE: part 0's agent holds until part 1's agent
        // has read the home page; part 1's agent writes only once part 0 saved.
        const round0 = (args.messages || []).filter((m) => m.role === "assistant").length;
        const isB = firstText(args).includes(B.slice(1)) && !firstText(args).includes(A);
        const isA = firstText(args).includes(A) && !firstText(args).includes(B.slice(1));
        if (isA && round0 === 0) await until(() => clashRuns >= 1 && readDone);
        // (the splitting part's own job is done first: part 1's is the second done.)
        if (isB && round0 === 1 && clashRuns === 1) { readDone = true; await until(() => ref.P && ref.key && ref.P.jobsOf(ref.key).filter((j) => j.op === "edit" && j.state === "done").length >= 2); }
        const fn = agents({
          [A]: [[use("write_file", { file: "visit.tsx", source: VISIT_NEW }), use("write_file", { file: "index.tsx", source: HOME_CLASH })], [use("build", {})], [use("finish", { summary: "Done." })]],
          [B.slice(1)]: [[use("read_files", { files: ["index.tsx"] })], [use("write_file", { file: "index.tsx", source: "__HOME__" })], [use("build", {})], [use("finish", { summary: "Done." })]],
        }, seen);
        const out = fn(args);
        // PART 1 WRITES THE HOME PAGE AS IT READ IT, with its tagline changed.
        if (out && out.__raw && isB) {
          const round = (args.messages || []).filter((m) => m.role === "assistant").length;
          if (round === 0) clashRuns++;
          const read = JSON.stringify(args.messages || []);
          const base = read.includes("Collect a loaf") ? HOME_CLASH : HOME;
          out.__raw.content = out.__raw.content.map((c) => (c.input && c.input.source === "__HOME__" ? { ...c, input: { ...c.input, source: base.replace("Bread from the harbour, every morning.", "Baked at dawn") } } : c));
        }
        return out;
      },
    },
  }, async (P) => {
    ref.P = P;
    const r = await sendMessage(P, { message: A + ", and " + B + "." });
    ref.key = r.key;
    assert.ok(r.body.request, JSON.stringify(r.body));
    const { rec } = await runAll(P, r.key);
    assert.deepEqual(DONE(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const home = P.page("index.tsx");
    assert.ok(home.includes("Collect a loaf") && home.includes("Baked at dawn"), "a change was lost on overlap: " + home);
    assert.equal(P.page("visit.tsx"), VISIT_NEW);
    // NOTE: whether the two jobs overlapped is the queue's timing; when they
    // did, part 1 ran again alone (serial) after a refused save.
    // THE OVERLAP: part 1's save was refused (`conflict`), its reserve given
    // back, and it ran again alone, reading the site as part 0 left it.
    const edits = P.jobsOf(r.key).filter((j) => j.op === "edit");
    const refused = edits.filter((j) => { try { return JSON.parse(j.result.body).error === "conflict"; } catch { return false; } });
    assert.equal(refused.length, 1, "no save was refused as an overlap: " + JSON.stringify(edits.map((j) => String(j.result && j.result.body).slice(0, 80))));
    assert.equal(P.ledger.filter((e) => e.ref.startsWith(refused[0].id)).reduce((a, e) => a + e.delta, 0), 0, "the refused try kept a charge");
    assert.equal(rec.parts[2].serial, true, "the re-run was not alone");
    assert.equal(clashRuns, 2, "part 1's agent did not run again");
  });
});

test("PA3 two changes to the same page stay with one agent: a split that gives one page to two parts is refused, so the agent does both itself, in order; no routing call, no old lane", async () => {
  const seen = [];
  const C = "change the home heading to Harbour Loaf Bakery";
  const refusals = [];
  await withPlatform({
    answers: {
      "": async (args) => {
        const round = (args.messages || []).filter((m) => m.role === "assistant").length;
        if (round === 0) seen.push(firstText(args));
        const last = (args.messages || []).at(-1);
        for (const b of Array.isArray(last && last.content) ? last.content : []) if (b && b.type === "tool_result" && b.is_error) refusals.push(String(b.content));
        const both = HOME_NEW.replace("<h1>Harbour Loaf</h1>", "<h1>Harbour Loaf Bakery</h1>");
        const script = [
          [use("split_work", { parts: [{ instruction: B, pages: ["/"] }, { instruction: C, pages: ["/"] }] })],
          [use("write_file", { file: "index.tsx", source: both })], [use("build", {})], [use("finish", { summary: "Done." })],
        ];
        return { __raw: { stop_reason: "tool_use", content: script[Math.min(round, script.length - 1)] } };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: B.charAt(0).toUpperCase() + B.slice(1) + ", and " + C + "." });
    assert.ok(r.body.request, JSON.stringify(r.body));
    const { rec } = await runAll(P, r.key);
    assert.deepEqual(DONE(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.match(refusals.join(" "), /both change \//, "the same-page split was not refused");
    const home = P.page("index.tsx");
    assert.ok(home.includes("Baked at dawn") && home.includes("Harbour Loaf Bakery"), home);
    assert.equal(seen.length, 1, "one agent");
    const tools = new Set(P.modelLog.map((m) => m.tool));
    assert.ok(P.modelLog.length > 2, "the observer saw no call");
    assert.equal(P.modelLog.filter((m) => m.tool === T.route).length, 0);
    for (const t of [T.pick, T.tweak, T.lane, T.pages, T.adds]) assert.ok(!tools.has(t), "an old lane was asked: " + t);
  });
});

test("PA4 one at a time (PARALLEL_WRITES off): the split's parts run in turn, each by its own agent, never an old lane, and both land", async () => {
  const seen = [];
  await withPlatform({
    beside: false,
    answers: {
      "": agents({
        [A]: [[use("write_file", { file: "visit.tsx", source: VISIT_NEW })], [use("build", {})], [use("finish", { summary: "Visit heading is Find us." })]],
        [B.slice(1)]: [[use("write_file", { file: "index.tsx", source: HOME_NEW })], [use("build", {})], [use("finish", { summary: "Home tagline is Baked at dawn." })]],
      }, seen),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: A + ", and " + B + "." });
    assert.ok(r.body.request, JSON.stringify(r.body));
    const { rec } = await runAll(P, r.key);
    assert.deepEqual(DONE(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.page("visit.tsx"), VISIT_NEW);
    assert.equal(P.page("index.tsx"), HOME_NEW);
    // NO PREPARATION: a split's parts are routed already (the router's
    // preparation of a waiting part had nothing left to prepare).
    assert.equal(P.modelLog.filter((m) => m.tool === T.route).length, 0);
    const tools = new Set(P.modelLog.map((m) => m.tool));
    // the text rung (`T.text`) may be tried first on a `text` part (guardrail 5, 2026-10-30); the agent still does the work here
    for (const t of [T.pick, T.tweak, T.lane, T.pages, T.adds]) assert.ok(!tools.has(t), "an old lane was asked: " + t);
    assert.equal(seen.length, 2, "one agent per part, and none in a preparation");
  });
});
