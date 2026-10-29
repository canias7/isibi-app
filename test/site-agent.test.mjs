// The site agent (2026-10-28): the loop, its tools, the head start (rule 1),
// clearing the desk (rule 3) and the same opening every round (rule 4).
import test from "node:test";
import assert from "node:assert/strict";
import {
  runSiteAgent, compact, headStart, firstMessage, makeWorkspace, writableKey,
  AGENT_TOOLS, agentSystem, COMPACT_AT, COMPACT_MIN_SAVE, toolCounts, toolsFor, checkNotes, buildFailKind, commandKinds, projectOverview,
} from "../builder/site-agent.mjs";

const PAGES = [
  { path: "index.tsx", source: "export default function Home(){return <h1>Home</h1>}" },
  { path: "visit.tsx", source: "export default function Visit(){return <p>Open 9-5</p>}" },
];
const PARTS = [{ name: "site-footer", source: "export default function F(){return <footer>Hi</footer>}" }];
const use = (name, input, id) => ({ type: "tool_use", name, input, ...(id ? { id } : {}) });
const answer = (...uses) => ({ content: uses, usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 5000 }, stop_reason: "tool_use" });

function scripted(rounds) {
  const sent = [];
  let i = 0;
  return { sent, send: async (req) => { sent.push(JSON.parse(JSON.stringify(req))); return rounds[Math.min(i++, rounds.length - 1)]; } };
}
const okBuild = async () => ({ ok: true });

test("SA1 read, write, build, finish: the workspace carries the write and the agent ends ok", async () => {
  const s = scripted([
    answer(use("read_files", { files: ["visit.tsx"] })),
    answer(use("write_file", { file: "visit.tsx", source: "export default function Visit(){return <p>Open 8-6</p>}" })),
    answer(use("build", {})),
    answer(use("finish", { summary: "Opening hours on /visit now 8-6." })),
  ]);
  const r = await runSiteAgent({ send: s.send, build: okBuild }, { request: "hours 8-6", pages: PAGES, parts: PARTS, model: "grok-4.7" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.changed, ["visit.tsx"]);
  assert.match(r.pages.find((p) => p.path === "visit.tsx").source, /8-6/);
  assert.equal(r.summary, "Opening hours on /visit now 8-6.");
  assert.equal(r.rounds, 4);
  assert.ok(r.credits >= 1);
});

test("SA2 finish is refused until a build passed with nothing written since", async () => {
  const s = scripted([
    answer(use("write_file", { file: "visit.tsx", source: "x" })),
    answer(use("finish", { summary: "done" })),
    answer(use("build", {})),
    answer(use("write_file", { file: "index.tsx", source: "y" })),
    answer(use("finish", { summary: "done" })),
    answer(use("build", {})),
    answer(use("finish", { summary: "done" })),
  ]);
  const r = await runSiteAgent({ send: s.send, build: okBuild }, { request: "r", pages: PAGES, parts: PARTS });
  assert.equal(r.ok, true);
  assert.equal(r.rounds, 7);
  const refusals = s.sent.at(-1).messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === "tool_result" && b.is_error);
  assert.equal(refusals.length, 2);
  assert.match(refusals[0].content, /build first/);
});

test("SA3 a failing build is answered with its errors and the agent is not ok if it stops there", async () => {
  const s = scripted([answer(use("build", {}))]);
  const r = await runSiteAgent({ send: s.send, build: async () => ({ ok: false, error: "TS2322 at index.tsx(3,1)" }) }, { request: "r", pages: PAGES, parts: PARTS, maxRounds: 2 });
  assert.equal(r.ok, false);
  assert.equal(r.stopped, "rounds");
  const last = s.sent[1].messages.at(-1).content[0];
  assert.match(last.content, /The build failed:\nTS2322/);
});

test("SA4 hard limits: rounds, credits and time each stop the loop", async () => {
  const loop = () => scripted([answer(use("read_files", { files: ["index.tsx"] }))]);
  assert.equal((await runSiteAgent({ send: loop().send, build: okBuild }, { request: "r", pages: PAGES, maxRounds: 3 })).stopped, "rounds");
  const dear = { content: [use("read_files", { files: ["index.tsx"] })], usage: { input_tokens: 400000, output_tokens: 0 } };
  const r = await runSiteAgent({ send: async () => dear, build: okBuild }, { request: "r", pages: PAGES, model: "grok-4.7", creditCap: 250 });
  assert.equal(r.stopped, "credits");
  assert.equal(r.rounds, 2); // 100 credits a round: the third would pass 250
  let t = 0;
  const r2 = await runSiteAgent({ send: loop().send, build: okBuild, now: () => (t += 1000) }, { request: "r", pages: PAGES, maxMs: 3500 });
  assert.equal(r2.stopped, "time");
});

test("SA5 rule 4: the system and tools are byte-identical every round and the first message never changes", async () => {
  const s = scripted([
    answer(use("read_files", { files: ["index.tsx"] })),
    answer(use("write_file", { file: "index.tsx", source: "z" })),
    answer(use("build", {})),
    answer(use("finish", { summary: "s" })),
  ]);
  await runSiteAgent({ send: s.send, build: okBuild }, { request: "r", pages: PAGES, parts: PARTS });
  const first = JSON.stringify(s.sent[0].system) + JSON.stringify(s.sent[0].tools) + JSON.stringify(s.sent[0].messages[0]);
  for (const q of s.sent) {
    assert.equal(JSON.stringify(q.system) + JSON.stringify(q.tools) + JSON.stringify(q.messages[0]), first);
    assert.equal(q.cacheKey, "site-agent");
  }
  // the same opening for two different sites
  assert.equal(agentSystem(null, ""), agentSystem(null, ""));
  assert.ok(Object.isFrozen(AGENT_TOOLS));
});

test("SA6 rule 1: a small site's first message carries every file; a big one the required and picked files", () => {
  assert.deepEqual(headStart({ pages: PAGES, parts: PARTS }).sort(), ["-parts/site-footer", "index.tsx", "visit.tsx"]);
  const big = Array.from({ length: 12 }, (_, i) => ({ path: "p" + i + ".tsx", source: "x".repeat(100) }));
  const parts = [{ name: "site-header", source: "h" }, { name: "menu", source: "m" }];
  const shown = headStart({ pages: big, parts, targets: ["p3.tsx"], picked: ["p7.tsx", "nope.tsx"] });
  assert.deepEqual(shown.sort(), ["-parts/site-header", "p3.tsx", "p7.tsx"]);
  const ws = makeWorkspace(big, parts);
  const msg = firstMessage({ request: "hello", ws, shown });
  assert.match(msg, /THE OWNER'S REQUEST\nhello/);
  assert.match(msg, /- p0\.tsx \(100 chars\)\n/);
  assert.match(msg, /- p3\.tsx \(100 chars\) \[below\]/);
  assert.match(msg, /=== p7\.tsx ===/);
  assert.doesNotMatch(msg, /=== p0\.tsx ===/);
});

test("SA7 rule 3: compact clears older file bodies, keeps the first message and the latest rounds, loses no write", async () => {
  const big = "A".repeat(COMPACT_AT);
  const s = scripted([
    answer(use("read_files", { files: ["index.tsx"] })),
    answer(use("write_file", { file: "visit.tsx", source: big })),
    answer(use("read_files", { files: ["visit.tsx"] })),
    answer(use("build", {})),
    answer(use("finish", { summary: "s" })),
  ]);
  const events = [];
  const r = await runSiteAgent({ send: s.send, build: okBuild, log: (e) => events.push(e) }, { request: "r", pages: PAGES, parts: PARTS });
  assert.equal(r.ok, true);
  assert.equal(r.pages.find((p) => p.path === "visit.tsx").source, big); // the work is kept
  assert.ok(events.some((e) => e.event === "compact" && e.cleared >= 1));
  const later = JSON.stringify(s.sent.at(-1).messages);
  assert.ok(later.split(big).length - 1 <= 1, "the big write is no longer re-sent in full every round (only the later read of it remains, until the next sweep)");
  assert.match(later, /\[written: 60000 chars\]/);
  // read_files after clearing still hands back the current version
  assert.ok(JSON.stringify(s.sent[3].messages).includes(big.slice(0, 100)));
});

test("SA8 compact is pure and leaves the latest rounds whole", () => {
  const msgs = [
    { role: "user", content: [{ type: "text", text: "first" }] },
    { role: "assistant", content: [use("write_file", { file: "a.tsx", source: "OLD" }, "1")] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "1", content: "Saved" }] },
    { role: "assistant", content: [use("write_file", { file: "b.tsx", source: "NEW1" }, "2")] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "2", content: "Saved" }] },
    { role: "assistant", content: [use("write_file", { file: "c.tsx", source: "NEW2" }, "3")] },
  ];
  const before = JSON.stringify(msgs);
  const c = compact(msgs, { keep: 2 });
  assert.equal(JSON.stringify(msgs), before);
  assert.equal(c.cleared, 1);
  assert.match(c.messages[1].content[0].input.source, /^\[written: 3 chars\]/);
  assert.equal(c.messages[3].content[0].input.source, "NEW1");
  assert.equal(c.messages[0].content[0].text, "first");
});

test("SA9 write_file: keys checked, server code checked at once, empty refused", async () => {
  assert.equal(writableKey("about.tsx").ok, true);
  assert.equal(writableKey("-parts/server-chat").ok, true);
  assert.equal(writableKey("../worker.js").ok, false);
  assert.equal(writableKey("src/lib/x.ts").ok, false);
  const s = scripted([
    answer(use("write_file", { file: "-parts/server-chat", source: "export default async function(){ return fetch('https://x.com') }" }), use("write_file", { file: "index.tsx", source: "  " })),
  ]);
  await runSiteAgent({ send: s.send, build: okBuild }, { request: "r", pages: PAGES, maxRounds: 1 });
  const s2 = scripted([answer(use("build", {}))]);
  await runSiteAgent({ send: s2.send, build: okBuild }, { request: "r", pages: PAGES, maxRounds: 1 });
  const s3 = scripted([answer(use("finish", { summary: "" }))]);
  const r3 = await runSiteAgent({ send: s3.send, build: okBuild }, { request: "r", pages: PAGES, maxRounds: 2 });
  assert.equal(r3.ok, true); // nothing written: finishing needs no build, and nothing is saved
  assert.deepEqual(r3.changed, []);
  const s4 = scripted([
    answer(use("write_file", { file: "-parts/server-chat", source: "export default async function(){ return fetch('https://x.com') }" }), use("write_file", { file: "index.tsx", source: "  " })),
    answer(use("finish", { summary: "" })),
  ]);
  await runSiteAgent({ send: s4.send, build: okBuild }, { request: "r", pages: PAGES, maxRounds: 2 });
  const res = s4.sent[1].messages.at(-1).content;
  assert.match(res[0].content, /will be refused at publish: .*hosts/);
  assert.equal(res[1].is_error, true);
  assert.match(res[1].content, /empty/);
});

test("SA10 no tool call, or a send that throws, stops the loop without throwing", async () => {
  const r = await runSiteAgent({ send: async () => ({ content: [{ type: "text", text: "hi" }], usage: {} }), build: okBuild }, { request: "r", pages: PAGES });
  assert.equal(r.stopped, "no-tool");
  const r2 = await runSiteAgent({ send: async () => { throw new Error("down"); }, build: okBuild }, { request: "r", pages: PAGES });
  assert.equal(r2.stopped, "send");
  assert.equal(r2.credits, 0);
});

test("SA11 read_table goes through the caller's reader; tool results pair with their calls", async () => {
  const asked = [];
  const s = scripted([answer(use("read_table", { table: "bookings" }, "a"), use("read_table", { table: "x; drop" }, "b"))]);
  await runSiteAgent({ send: s.send, build: okBuild, readTable: async (t, n) => { asked.push([t, n]); return [{ id: 1 }]; } }, { request: "r", pages: PAGES, maxRounds: 2 });
  assert.deepEqual(asked[0], ["bookings", 20]);
  assert.equal(asked.length, 2); // the script repeats its round; the bad name never reaches the reader
  const res = s.sent[1].messages.at(-1).content;
  assert.deepEqual(res.map((b) => b.tool_use_id), ["a", "b"]);
  assert.equal(res[0].content, '[{"id":1}]');
  assert.equal(res[1].is_error, true);
});

// ── THE SWITCH AND THE WIRING (2026-10-28) ──────────────────────────────────
import { readFileSync } from "node:fs";
import { stoppedFacts, AGENT_TAKES_ALL, AGENT_CREDIT_CAP, historyText, sumUsage, asWriterAnswer, agentTakes, roundFacts, fileName, CSS_KEY } from "../builder/site-agent.mjs";
import { jobSecrets } from "../builder/edit-job.mjs";

test("SA12 no switch and no spending limit", () => {
  assert.equal(AGENT_TAKES_ALL, true);
  const was = process.env.GF_OLD_LANES;
  try {
    delete process.env.GF_OLD_LANES; assert.equal(agentTakes(), true);
    process.env.GF_OLD_LANES = "1"; assert.equal(agentTakes(), false);
  } finally { if (was === undefined) delete process.env.GF_OLD_LANES; else process.env.GF_OLD_LANES = was; }
  assert.equal(AGENT_CREDIT_CAP, Infinity, "no spending limit");
  assert.match(stoppedFacts({ stopped: "credits", lastBuild: "fail" }), /spending limit.*Nothing on the site was changed; its last build had errors\./);
});

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const between = (a, b) => { const i = W.indexOf(a); assert.ok(i >= 0, "landmark: " + a); const j = W.indexOf(b, i); assert.ok(j > i, "landmark: " + b); return W.slice(i, j); };

test("SA13 both routes hand the whole message to the agent when it is on, before any lane", () => {
  const edit = between("// ── THE SITE AGENT (2026-10-28", "// ── THE SEVENTEEN LANES ARE THE FRONT DOOR");
  assert.match(edit, /if \(agentTakes\(\) && !\(eJob && eJob\.prepare === true\)\) \{\n\s+const agParts/);
  assert.match(edit, /runAgentChange\(env, \{[^]*words: eMessage/);
  const add = between("// ── THE SITE AGENT TAKES AN ADDITION TOO", "// ── AN ENTRY THIS REQUEST HAS ALREADY SAVED");
  assert.match(add, /if \(agentTakes\(\) && !\(aJob && aJob\.prepare === true\)\) \{/);
  assert.match(add, /runAgentChange\(env, \{[^]*words: aAsked/);
  // and the router never splits such a site's message into parts
  assert.match(W, /const rKey = agentTakes\(\) \? "" : /);
});

test("SA14 the build tool compiles only: answered before the repair, the staging and the publish", () => {
  const fn = between("async function runAgentChange(", "async function recompileAndPublish(env, {");
  assert.match(fn, /build: \(w\) => recompileAndPublish\(env, \{[^}]*compileOnly: true/);
  // charged only when there is something to save, before the save
  const bill = fn.indexOf("await bill(ag.usage)"), save = fn.indexOf('label: "Changed by the site agent"'), stop = fn.indexOf("if (!ag.ok) {");
  assert.ok(stop > 0 && bill > stop && save > bill);
  const spine = between("async function recompileAndPublish(env, {", "\n}\n");
  assert.match(spine, /if \(!compileOnly && job && job\.beside/);
  const only = spine.indexOf("if (compileOnly) {"), first = spine.indexOf("let built = await compile();");
  const hook = spine.indexOf("const compileHook ="), gate = spine.indexOf("afterCompile({");
  assert.ok(first > 0 && only > first && hook > only && gate > only, "the compile-only answer comes straight after the compile");
});

test("SA15 no switch and no cap reach the deploy or the job", () => {
  assert.deepEqual(jobSecrets({ SITE_AGENT: "on", SITE_AGENT_CAP: "30" }), {});
  const D = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.doesNotMatch(D, /SITE_AGENT/);
  const K = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(K, /builder\/site-agent\.mjs \.\/worker\/builder\//);
});

test("SA16 a failed build never opens finish", async () => {
  const s = scripted([answer(use("write_file", { file: "index.tsx", source: "x" })), answer(use("build", {})), answer(use("finish", { summary: "s" }))]);
  const r = await runSiteAgent({ send: s.send, build: async () => ({ ok: false, error: "TS1005" }) }, { request: "r", pages: PAGES, maxRounds: 3 });
  assert.equal(r.ok, false);
  assert.equal(r.lastBuild, "fail");
  const res = s.sent.at(-1).messages.at(-1).content;
  assert.equal(res.length, 1);
  const r2 = await runSiteAgent({ send: scripted([answer(use("write_file", { file: "index.tsx", source: "x" }), use("build", {})), answer(use("finish", { summary: "s" }))]).send, build: async () => ({ ok: false, error: "x" }) }, { request: "r", pages: PAGES, maxRounds: 3 });
  assert.equal(r2.ok, false);
  assert.equal(r2.summary, "");
});

test("SA17 compact keeps exactly the latest `keep` rounds whole, however many there are", () => {
  const msgs = [{ role: "user", content: [{ type: "text", text: "first" }] }];
  for (let i = 0; i < 5; i++) {
    msgs.push({ role: "assistant", content: [use("write_file", { file: "f" + i + ".tsx", source: "SRC" + i }, "w" + i)] });
    msgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: "w" + i, content: "Saved" }] });
  }
  const c = compact(msgs, { keep: 2 });
  const src = c.messages.filter((m) => m.role === "assistant").map((m) => m.content[0].input.source);
  assert.deepEqual(src.slice(3), ["SRC3", "SRC4"]);
  assert.ok(src.slice(0, 3).every((x) => x.startsWith("[written: 4 chars]")));
  assert.equal(c.cleared, 3);
});

test("SA18 the stylesheet is a file the agent may write; the build is handed it; untouched it is not changed", async () => {
  const builds = [];
  const s = scripted([
    answer(use("read_files", { files: [CSS_KEY] })),
    answer(use("write_file", { file: CSS_KEY, source: ":root{--brand:red}" })),
    answer(use("build", {})),
    answer(use("finish", { summary: "red" })),
  ]);
  const r = await runSiteAgent({ send: s.send, build: async (w) => { builds.push(w.css); return { ok: true }; } }, { request: "r", pages: PAGES, css: ":root{--brand:blue}" });
  assert.equal(r.ok, true);
  assert.deepEqual(builds, [":root{--brand:red}"]);
  assert.equal(r.cssChanged, true);
  assert.equal(r.css, ":root{--brand:red}");
  assert.ok(!r.pages.some((p) => p.path === CSS_KEY), "the sheet is never sent as a page");
  assert.match(s.sent[1].messages.at(-1).content[0].content, /blue/);
  const r2 = await runSiteAgent({ send: scripted([answer(use("write_file", { file: CSS_KEY, source: "x" }))]).send, build: okBuild }, { request: "r", pages: PAGES, css: null, maxRounds: 1 });
  assert.equal(r2.cssChanged, false);
  assert.equal(r2.css, null);
});

test("SA19 delete_file removes a page or component, never the home page or the sheet, and needs a build", async () => {
  const s = scripted([
    answer(use("delete_file", { file: "index.tsx" }), use("delete_file", { file: CSS_KEY }), use("delete_file", { file: "visit.tsx" })),
    answer(use("finish", { summary: "s" })),
    answer(use("build", {})),
    answer(use("finish", { summary: "Removed /visit." })),
  ]);
  const r = await runSiteAgent({ send: s.send, build: okBuild }, { request: "r", pages: PAGES, parts: PARTS, css: "" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.removed, ["visit.tsx"]);
  assert.ok(r.changed.includes("visit.tsx"));
  assert.ok(!r.pages.some((p) => p.path === "visit.tsx"));
  const first = s.sent[1].messages.at(-1).content;
  assert.equal(first[0].is_error, true); assert.equal(first[1].is_error, true); assert.ok(!first[2].is_error);
  assert.equal(s.sent[2].messages.at(-1).content[0].is_error, true, "finish refused before a build");
});

test("SA20 change_rows queues only real columns of real tables, by id; finishing with only rows needs no build", async () => {
  const spec = { tables: [{ name: "menu", columns: [{ name: "id" }, { name: "name" }, { name: "price" }] }] };
  const s = scripted([
    answer(use("change_rows", { table: "menu", update: [{ id: 4, set: { price: 42 } }], add: [{ name: "Rye", price: 5 }], remove: [7] }),
      use("change_rows", { table: "menu", add: [{ colour: "x" }] }),
      use("change_rows", { table: "secrets", add: [{ a: 1 }] }),
      use("change_rows", { table: "menu", update: [{ id: "1; drop", set: { price: 1 } }] })),
    answer(use("finish", { summary: "Price 42." })),
  ]);
  let built = 0;
  const r = await runSiteAgent({ send: s.send, build: async () => { built++; return { ok: true }; } }, { request: "r", pages: PAGES, spec });
  assert.equal(r.ok, true);
  assert.equal(built, 0);
  assert.deepEqual(r.rows, [{ table: "menu", add: [{ name: "Rye", price: 5 }], update: [{ id: 4, set: { price: 42 } }], remove: [7] }]);
  const res = s.sent[1].messages.at(-1).content;
  assert.ok(!res[0].is_error);
  assert.match(res[1].content, /not columns of menu.*add: colour/);
  assert.match(res[2].content, /no such table; the site's tables are menu/);
  assert.match(res[3].content, /update: a row id/);
});

test("SA21 each round's facts come from the tools' outcomes, for the live progress lines", async () => {
  assert.equal(fileName("index.tsx"), "the home page");
  assert.equal(fileName("about.tsx"), "the /about page");
  assert.equal(fileName("-parts/server-chat"), 'the server function "chat"');
  assert.equal(fileName("-parts/site-footer"), 'the "site-footer" component');
  assert.equal(fileName(CSS_KEY), "the stylesheet");
  const f = roundFacts([
    { use: use("read_files", { files: ["index.tsx"] }), r: { text: "…", reads: ["index.tsx", "about.tsx"] } },
    { use: use("write_file", { file: "about.tsx" }), r: { text: "Saved" } },
    { use: use("write_file", { file: "bad" }), r: { error: "no" } },
    { use: use("build", {}), r: { text: "The build failed:\nx" } },
  ]);
  assert.deepEqual(f, [
    { state: "prepared", text: "Read the home page and the /about page." },
    { state: "doing", text: "Built the site; the compiler found errors, fixing them." },
    { state: "applied", text: "Wrote the /about page." },
  ]);
  const marks = [];
  const s = scripted([answer(use("write_file", { file: "about.tsx", source: "x" })), answer(use("build", {})), answer(use("finish", { summary: "s" }))]);
  await runSiteAgent({ send: s.send, build: okBuild, progress: (st, facts) => marks.push([st, facts.map((x) => x.text)]) }, { request: "r", pages: PAGES });
  assert.deepEqual(marks, [["agent", ["Wrote the /about page."]], ["agent", ["Built the site; it compiled cleanly."]]]);
});

test("SA22 the save: stylesheet stored before the publish and put back if it fails; rows written after; only real compile-only css", () => {
  const fn = between("async function runAgentChange(", "async function recompileAndPublish(env, {");
  const store = fn.indexOf("patchSiteConfig(env, slug, cfgDb, { css: ag.css }"), pub = fn.indexOf('label: "Changed by the site agent"'), back = fn.indexOf("{ css: cssBefore }"), rows = fn.indexOf("THE TABLE ENTRIES");
  assert.ok(store > 0 && pub > store && back > pub && rows > back);
  assert.match(fn, /cssOverride: typeof w\.css === "string" \? w\.css : null/);
  assert.match(fn, /progress: \(stage, facts\) => \{ if \(talk\) job\.progress\.mark\(stage, facts\); \}/);
  assert.match(W, /if \(compileOnly && typeof cssOverride === "string"\) css = cssOverride;/);
});

test("SA23 look: builds the workspace, hands back only the asked page's screenshots as images after the tool results; old ones are cleared", async () => {
  const PNG = "iVBORw0KGgo" + "A".repeat(70000);
  const looks = [];
  const s = scripted([
    answer(use("write_file", { file: "visit.tsx", source: "v2" }), use("look", { page: "/visit" })),
    answer(use("look", { page: "nope" })),
    answer(use("build", {})),
    answer(use("read_files", { files: ["index.tsx"] })),
    answer(use("finish", { summary: "s" })),
  ]);
  const r = await runSiteAgent({ send: s.send, build: okBuild, look: async (w, route) => {
    looks.push([route, w.pages.find((p) => p.path === "visit.tsx").source]);
    return { ok: true, shots: [{ route: "/", viewport: "phone", png: PNG }, { route, viewport: "phone", png: PNG }, { route, viewport: "desktop", png: PNG }] };
  } }, { request: "r", pages: PAGES });
  assert.equal(r.ok, true);
  assert.deepEqual(looks, [["/visit", "v2"]], "the look saw the workspace's own write; a bad address never reached it");
  const after = s.sent[1].messages.at(-1).content;
  assert.equal(after[0].type, "tool_result"); assert.equal(after[1].type, "tool_result");
  assert.match(after[1].content, /Screenshots of \/visit follow: phone width, desktop width/);
  assert.deepEqual(after.slice(2).map((b) => b.type), ["text", "image", "text", "image"], "two images, the home page's left out");
  assert.equal(s.sent[2].messages.at(-1).content[0].is_error, true);
  // by the last round the screenshots are cleared from the pile (rule 3)
  assert.ok(!JSON.stringify(s.sent.at(-1).messages).includes(PNG), "old screenshots cleared");
});

test("SA24 look's facts for the progress lines", () => {
  assert.deepEqual(roundFacts([{ use: use("look", { page: "/about" }), r: { text: "…" } }]), [{ state: "prepared", text: "Looked at the /about page in a browser." }]);
});

test("SA25 the router is skipped for a site's message; the look tool is wired to compile-only screenshots", () => {
  const route = between('if (url.pathname === "/api/site/route" && request.method === "POST") {', "const rKey = ");
  assert.match(route, /if \(agentTakes\(\) && !rJob && ru\) \{\n\s+if \(rb\.firstBuild === true\) return Response\.json\(\{ ok: true, intent: "build", cost: 0, agent: true \}\);/);
  const fn = between("async function runAgentChange(", "async function recompileAndPublish(env, {");
  assert.match(fn, /look: \(w, route\) => recompileAndPublish\(env, \{[^}]*compileOnly: true[^}]*shotRoutes: \[route\]/);
  assert.match(W, /shots: \(compileOnly && Array\.isArray\(shotRoutes\) && shotRoutes\.length \? shotRoutes : vrShots\) \|\| undefined,/);
  assert.match(W, /shots: built && Array\.isArray\(built\.shots\) \? built\.shots : \[\],/);
});

test("SA26 the conversation, one bill for many rounds, and the workspace as the page writer's answer", async () => {
  assert.equal(historyText([{ r: "u", t: "Make the hero blue" }, { r: "a", t: "Which hero — home or menu?" }, { r: "x", t: "card" }, { r: "u", t: "home" }]),
    "Owner: Make the hero blue\nYou: Which hero — home or menu?\nOwner: home");
  assert.equal(historyText([]), "");
  assert.deepEqual(sumUsage([{ in: 1, out: 2, cacheRead: 3 }, { in: 10, out: 20, cacheWrite: 5 }], "m"), { in: 11, out: 22, cacheRead: 3, cacheWrite: 5, model: "m" });
  const s = scripted([
    answer(use("write_file", { file: "index.tsx", source: "home" }), use("write_file", { file: "-parts/site-header", source: "h" }), use("write_file", { file: "-parts/server-chat", source: "export const hosts = [];\nexport default async function (request, site) { return Response.json({}); }" })),
    answer(use("build", {})),
    answer(use("finish", { summary: "Built Home." })),
  ]);
  const r = await runSiteAgent({ send: s.send, build: okBuild }, { request: "A bakery", pages: [], parts: [], model: "grok-4.7" });
  assert.match(s.sent[0].messages[0].content[0].text, /\(none yet — this is a new site/);
  const a = asWriterAnswer(r, "grok-4.7");
  assert.deepEqual(a.input.pages, [{ path: "src/routes/index.tsx", source: "home" }]);
  assert.deepEqual(a.input.parts, [{ name: "site-header", source: "h" }]);
  assert.equal(a.input.server[0].name, "chat");
  assert.equal(a.input.notes, "Built Home.");
  assert.equal(a.usage.model, "grok-4.7");
  assert.equal(a.usage.in, 3000);
  const stopped = asWriterAnswer({ ok: false, pages: [], parts: [], usage: [], stopped: "rounds", rounds: 40 }, "m");
  assert.equal(stopped.input, null, "a stop is no answer: the build's own no-pages path");
  const halfDone = asWriterAnswer({ ok: false, pages: [{ path: "index.tsx", source: "half" }], parts: [], usage: [], stopped: "time", rounds: 9 }, "m");
  assert.equal(halfDone.input, null, "pages written by an agent that never finished are never published");
});

test("SA27 the build hands the page writer's place to the agent, building with the build's own compile", () => {
  const gen = between("    agentWrite: agentTakes()", "    generate: async () => {");
  assert.match(gen, /agentWrite: agentTakes\(\) && !resumeCall && !\(spec && spec\.surface === "app"\) \? async \(\{ compile \}\) => \{/);
  assert.match(gen, /build: async \(w\) => agentBuildAnswer\(await compile\(w\.pages, w\.parts\)\),/);
  assert.match(gen, /look: async \(w, route\) => agentBuildAnswer\(await compile\(w\.pages, w\.parts, \{ shots: \[route\] \}\)\),/);
  assert.match(gen, /request: briefWithLayout\(\{ brief, plan, tsx, gif, qr, three, images: imgBrief, media, devices: deviceWishes \}\)/);
  assert.match(gen, /return asWriterAnswer\(ag, agModel\);/);
  const P = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.match(P, /let gen = typeof deps\.agentWrite === "function" \? await deps\.agentWrite\(\{ compile: deps\.compile \}\) : await deps\.generate\(\);/);
});

test("SA28 run: the command and the workspace go to the container; what it changed comes back, unbuilt", async () => {
  const seen = [];
  const s = scripted([
    answer(use("run", { command: "grep -rn Open src/routes" })),
    answer(use("run", { command: "sed -i s/9-5/8-6/ src/routes/visit.tsx" })),
    answer(use("finish", { summary: "s" })),
    answer(use("build", {})),
    answer(use("finish", { summary: "Hours 8-6." })),
  ]);
  let n = 0;
  const r = await runSiteAgent({ send: s.send, build: okBuild, run: async (w, cmd) => {
    seen.push([cmd, w.pages.map((p) => p.path).sort()]);
    n++;
    if (n === 1) return { ok: true, code: 0, output: "src/routes/visit.tsx:1:Open 9-5", files: { pages: w.pages, parts: w.parts, css: w.css } };
    return { ok: true, code: 0, output: "", files: { pages: [w.pages[0], { path: "visit.tsx", source: "Open 8-6" }], parts: [], css: null } };
  } }, { request: "r", pages: PAGES });
  assert.equal(r.ok, true);
  assert.deepEqual(seen, [["grep -rn Open src/routes", ["index.tsx", "visit.tsx"]], ["sed -i s/9-5/8-6/ src/routes/visit.tsx", ["index.tsx", "visit.tsx"]]]);
  assert.equal(r.pages.find((p) => p.path === "visit.tsx").source, "Open 8-6");
  const res = s.sent[1].messages.at(-1).content[0].content;
  assert.match(res, /^exit code 0\nsrc\/routes\/visit\.tsx:1:Open 9-5$/);
  assert.match(s.sent[2].messages.at(-1).content[0].content, /^exit code 0; files changed: visit\.tsx/);
  assert.equal(s.sent[3].messages.at(-1).content[0].is_error, true, "a command's change needs a build before finishing");
});

test("SA29 the container is wired: a work folder per agent run, in the site's lane; both agents get it", () => {
  const fn = between("function agentShell(env, slug) {", "async function runAgentChange(");
  assert.match(fn, /getContainer\(env\.SITE_BUILD_CONTAINER, laneName\(slug\)\)/);
  assert.match(fn, /new Request\("http:\/\/build\/agent-run"/);
  assert.match(fn, /body: JSON\.stringify\(\{ session, command, files \}\)/);
  assert.match(between("async function runAgentChange(", "async function recompileAndPublish(env, {"), /run: agentShell\(env, slug\),/);
  assert.match(between("    agentWrite: agentTakes()", "    generate: async () => {"), /run: agentShell\(env, slug\),/);
  const B = readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const route = B.slice(B.indexOf('req.url === "/agent-run"'), B.indexOf('req.url === "/model"'));
  assert.ok(route.length > 200, "the container's route is there");
  assert.match(route, /const as = renderAs\(\);/);
  assert.match(route, /runCommand\(dir, p\.command, \{ as \}\)/);
  assert.match(route, /readSiteFiles\(dir/);
});

test("SA30 a page a command removed is removed from the workspace too; the stylesheet stays unless changed", async () => {
  const s = scripted([answer(use("run", { command: "rm src/routes/visit.tsx" })), answer(use("build", {})), answer(use("finish", { summary: "Removed /visit." }))]);
  const r = await runSiteAgent({ send: s.send, build: okBuild, run: async (w) => ({ ok: true, code: 0, output: "", files: { pages: w.pages.filter((p) => p.path !== "visit.tsx"), parts: w.parts, css: w.css } }) }, { request: "r", pages: PAGES, parts: PARTS, css: "a{}" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.removed, ["visit.tsx"]);
  assert.equal(r.cssChanged, false);
  assert.match(s.sent[1].messages.at(-1).content[0].content, /files changed: visit\.tsx/);
});

// ── 2026-10-29, after the first live build (101 credits, 26+ rounds) ─────────
test("SA31 rule 3 sweeps once, then leaves earlier rounds byte-for-byte alone", async () => {
  const big = "B".repeat(COMPACT_AT);
  const rounds = [answer(use("write_file", { file: "visit.tsx", source: big }))];
  for (let i = 0; i < 6; i++) rounds.push(answer(use("read_files", { files: ["index.tsx"] })));
  rounds.push(answer(use("build", {})), answer(use("finish", { summary: "s" })));
  const s = scripted(rounds);
  const events = [];
  const r = await runSiteAgent({ send: s.send, build: okBuild, log: (e) => events.push(e) }, { request: "r", pages: PAGES, parts: PARTS });
  assert.equal(r.ok, true);
  const sweeps = events.filter((e) => e.event === "compact");
  assert.equal(sweeps.length, 1, "one sweep, not one per round: " + sweeps.length);
  // after the sweep, each request's earlier messages are the same bytes as the one before (the cache's prefix holds)
  const at = s.sent.findIndex((q) => JSON.stringify(q.messages).includes("[written: "));
  assert.ok(at > 0 && at < s.sent.length - 2);
  for (let i = at + 1; i < s.sent.length; i++) {
    const prev = s.sent[i - 1].messages, cur = s.sent[i].messages;
    assert.equal(JSON.stringify(cur.slice(0, prev.length)), JSON.stringify(prev), "round " + (i + 1) + " rewrote an earlier message");
  }
});

test("SA32 each round is logged with what it did, as numbers the build trace keeps", async () => {
  const s = scripted([
    answer(use("write_file", { file: "a.tsx", source: "export default function A(){return <p>a</p>}" }), use("write_file", { file: "b.tsx", source: "export default function B(){return <p>b</p>}" }), use("read_files", { files: ["index.tsx"] })),
    answer(use("build", {})),
    answer(use("finish", { summary: "s" })),
  ]);
  const events = [];
  await runSiteAgent({ send: s.send, build: okBuild, log: (e) => events.push(e) }, { request: "r", pages: PAGES, parts: PARTS });
  const r1 = events.find((e) => e.event === "round" && e.round === 1);
  assert.equal(r1.writes, 2); assert.equal(r1.reads, 1);
  assert.equal(r1.inTok, 1000); assert.equal(r1.cached, 5000); assert.equal(r1.outTok, 200);
  assert.deepEqual(toolCounts([use("run", {}), use("run", {}), use("nope", {})]), { commands: 2, other: 1 });
  assert.deepEqual(toolCounts(null), {});
});

test("SA33 the rules tell the agent to do several things in one round", () => {
  const sys = agentSystem(null, "");
  assert.match(sys, /several tools in the same answer/);
  assert.match(sys, /Write every file you already know in ONE answer/);
});

test("SA34 a clearing that would save little is not made: over the pile limit, small old reads stay as they were", async () => {
  // a big page shown in the first message (never cleared) puts the pile over the limit; the old rounds hold only small reads
  const bigPage = { path: "index.tsx", source: "export default function H(){return <p>" + "C".repeat(COMPACT_AT) + "</p>}" };
  const rounds = [];
  for (let i = 0; i < 5; i++) rounds.push(answer(use("read_files", { files: ["visit.tsx"] })));
  rounds.push(answer(use("build", {})), answer(use("finish", { summary: "s" })));
  const s = scripted(rounds);
  const events = [];
  const r = await runSiteAgent({ send: s.send, build: okBuild, log: (e) => events.push(e) }, { request: "r", pages: [bigPage, PAGES[1]], parts: PARTS, targets: ["index.tsx"] });
  assert.equal(r.ok, true);
  assert.ok(JSON.stringify(s.sent[0].messages).length > COMPACT_AT, "the pile really is over the limit");
  assert.equal(events.filter((e) => e.event === "compact").length, 0, "small clearings (< COMPACT_MIN_SAVE) were skipped");
  for (let i = 1; i < s.sent.length; i++) {
    const prev = s.sent[i - 1].messages;
    assert.equal(JSON.stringify(s.sent[i].messages.slice(0, prev.length)), JSON.stringify(prev));
  }
  assert.ok(COMPACT_MIN_SAVE >= 10000);
});

// ── 2026-10-29: the tools offered are the tools wired; the checks reach the agent ──
test("SA35 a tool with nothing behind it is never offered; the request carries exactly the wired ones", async () => {
  assert.deepEqual(toolsFor({}).map((t) => t.name).filter((n) => ["look", "run", "read_table"].includes(n)), []);
  const all = { look: async () => ({}), run: async () => ({}), readTable: async () => ({}) };
  assert.deepEqual(toolsFor(all).map((t) => t.name), AGENT_TOOLS.map((t) => t.name));
  const s = scripted([answer(use("finish", { summary: "s" }))]);
  await runSiteAgent({ send: s.send, build: okBuild, look: all.look }, { request: "r", pages: PAGES });
  const names = s.sent[0].tools.map((t) => t.name);
  assert.ok(names.includes("look") && !names.includes("run") && !names.includes("read_table"), names.join(","));
});

test("SA36 build names the browser check's findings and the type errors that did not stop it", async () => {
  const s = scripted([answer(use("build", {})), answer(use("finish", { summary: "s" })), answer(use("finish", { summary: "s" }))]);
  const build = async () => ({ ok: true, render: { findings: [{ route: "/", viewport: "phone", kind: "contrast", detail: "Book a class" }, { route: "/a", viewport: "desktop", kind: "image", detail: "x.png" }] }, typeErrors: "src/routes/-parts/site-header.tsx(4,7): error TS2322: wrong\nnoise" });
  await runSiteAgent({ send: s.send, build }, { request: "r", pages: PAGES });
  const t = JSON.stringify(s.sent[1].messages.at(-1).content);
  assert.match(t, /The build passed\./);
  assert.match(t, /\/ at phone width: text that is nearly invisible.*Book a class.*FIX THIS/);
  assert.match(t, /\/a at desktop width: an image did not load/);
  assert.doesNotMatch(t, /did not load \(x\.png\) — FIX THIS/, "an image is shown, not made a must-fix");
  assert.match(t, /site-header\.tsx\(4,7\): error TS2322/);
  assert.equal(checkNotes({ ok: true }), "", "nothing found, nothing added");
});

test("SA37 a must-fix finding holds the finish once; a clean build is never held; a second finish is let go", async () => {
  const bad = async () => ({ ok: true, render: { findings: [{ route: "/", viewport: "phone", kind: "blank" }] } });
  const s1 = scripted([answer(use("build", {})), answer(use("finish", { summary: "a" })), answer(use("finish", { summary: "b" }))]);
  const r1 = await runSiteAgent({ send: s1.send, build: bad }, { request: "r", pages: PAGES });
  assert.equal(s1.sent.length, 3); assert.equal(r1.summary, "b");
  assert.match(JSON.stringify(s1.sent[2].messages.at(-1).content), /finish again/);
  const s2 = scripted([answer(use("build", {})), answer(use("finish", { summary: "a" }))]);
  const r2 = await runSiteAgent({ send: s2.send, build: okBuild }, { request: "r", pages: PAGES });
  assert.equal(s2.sent.length, 2); assert.equal(r2.summary, "a");
});

test("SA38 an edit's build and look carry the check's findings to the agent; the browser check has no whole-check limit", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = W.indexOf("  if (compileOnly) {"), b = W.indexOf("  }", W.indexOf("langCharged,", a));
  assert.ok(a > 0 && b > a, "landmarks");
  const ret = W.slice(a, b);
  assert.match(ret, /render: built && built\.render && typeof built\.render === "object" \? built\.render : null,/);
  assert.match(ret, /typeErrors: built && typeof built\.typeErrors === "string" \? built\.typeErrors : "",/);
  const R = readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
  assert.match(R, /const NAV_MS = 6000;/, "the per-page limit stays");
  assert.doesNotMatch(R, /TOTAL_MS/);
  assert.doesNotMatch(R, /cut = true/);
});

// ── 2026-10-29: why a build failed (as a kind) and which pages the agent looked at ──
test("SA39 a failed build is logged as its kind, never its text; the kinds are a fixed set", async () => {
  assert.equal(buildFailKind({ error: "src/routes/index.tsx(3,1): error TS2322: x" }), "types");
  assert.equal(buildFailKind({ error: "Could not resolve './-parts/hero'" }), "missing");
  assert.equal(buildFailKind({ error: "anything", timedOut: true }), "timeout");
  assert.equal(buildFailKind({ error: "server code failed its test run" }), "serverTest");
  assert.equal(buildFailKind({ error: "SyntaxError: Unexpected token <" }), "crash");
  assert.equal(buildFailKind({ error: "who knows" }), "other");
  assert.equal(buildFailKind(null), "other");
  const events = [];
  const s = scripted([answer(use("build", {})), answer(use("finish", { summary: "s" }))]);
  await runSiteAgent({ send: s.send, build: async () => ({ ok: false, error: "secret-ish text error TS2322" }), log: (e) => events.push(e) }, { request: "r", pages: PAGES });
  const f = events.find((e) => e.event === "build-fail");
  assert.deepEqual(f, { event: "build-fail", types: 1 });
  assert.doesNotMatch(JSON.stringify(events), /secret-ish/, "the error's text is never logged");
});

test("SA40 the pages the agent looked at come back, once each, and travel on the writer's answer", async () => {
  const PNG = "iVBORw0KGgo";
  const look = async (w, route) => ({ ok: true, shots: [{ route, viewport: "desktop", png: PNG }] });
  const s = scripted([answer(use("look", { page: "/" }), use("look", { page: "/visit" })), answer(use("look", { page: "/" })), answer(use("finish", { summary: "s" }))]);
  const r = await runSiteAgent({ send: s.send, build: okBuild, look }, { request: "r", pages: PAGES });
  assert.deepEqual(r.looked, ["/", "/visit"]);
  const r2 = { ...r, ok: true, pages: PAGES, parts: [] };
  assert.deepEqual(asWriterAnswer(r2, "m").agent.looked, ["/", "/visit"]);
});

// ── 2026-10-29: the map at the door; looks batched; what each command did, as kinds ──
test("SA41 a new site's first message carries the project map with its tables; a site with files does not", async () => {
  const spec = { tables: [{ name: "classes", columns: [{ name: "title" }, { name: "day" }] }, { name: "enquiries", columns: ["name", "email"] }] };
  const s1 = scripted([answer(use("finish", { summary: "s" }))]);
  await runSiteAgent({ send: s1.send, build: okBuild }, { request: "r", pages: [], parts: [], spec, ownParts: true });
  const first = s1.sent[0].messages[0].content[0].text;
  assert.match(first, /THE PROJECT \(you do not need to look around to learn this\)/);
  assert.match(first, /classes \(title, day\); enquiries \(name, email\)/);
  assert.match(first, /writes its own parts: there is no kit/);
  assert.doesNotMatch(first, /do not list or read its files/);
  const s2 = scripted([answer(use("finish", { summary: "s" }))]);
  await runSiteAgent({ send: s2.send, build: okBuild }, { request: "r", pages: PAGES, parts: PARTS, spec });
  assert.doesNotMatch(s2.sent[0].messages[0].content[0].text, /THE PROJECT/);
  assert.match(projectOverview([]), /The site has no tables\./);
  assert.match(projectOverview([], { ownParts: false }), /ready-made kit lives under @\/components/);
});

test("SA42 the rules ask for one command per look; each command is logged by what it did, never its text", async () => {
  assert.match(agentSystem(null, ""), /put everything you want to look at in ONE command/);
  assert.deepEqual(commandKinds("ls src; cat a.tsx && grep -rn x src | wc -l; npx tsc --noEmit; sed -i s/a/b/ f; whoami"), ["cmdList", "cmdRead", "cmdSearch", "cmdRead", "cmdCheck", "cmdEdit", "cmdOther"]);
  assert.deepEqual(commandKinds(null), []);
  const events = [];
  const s = scripted([answer(use("run", { command: "ls secret-dir; grep -rn hunter2 src" })), answer(use("finish", { summary: "s" }))]);
  await runSiteAgent({ send: s.send, build: okBuild, run: async () => ({ ok: true, code: 0, output: "" }), log: (e) => events.push(e) }, { request: "r", pages: PAGES });
  const r1 = events.find((e) => e.event === "round" && e.round === 1);
  assert.equal(r1.commands, 1); assert.equal(r1.cmdList, 1); assert.equal(r1.cmdSearch, 1);
  const numbers = Object.entries(r1).filter(([k]) => k !== "event" && k !== "tools");
  assert.ok(numbers.every(([, v]) => typeof v === "number"), "the trace keeps these: numbers only");
  assert.doesNotMatch(JSON.stringify(numbers), /hunter2|secret-dir/);
});
