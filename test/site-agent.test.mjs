// The site agent (2026-10-28): the loop, its tools, the head start (rule 1),
// clearing the desk (rule 3) and the same opening every round (rule 4).
import test from "node:test";
import assert from "node:assert/strict";
import {
  runSiteAgent, compact, headStart, firstMessage, makeWorkspace, writableKey,
  AGENT_TOOLS, agentSystem, COMPACT_AT,
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
  assert.ok(later.length < big.length * 2, "the big write is no longer re-sent in full every round");
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
  assert.equal(r3.ok, false);
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
import { agentOn, agentCap, stoppedFacts } from "../builder/site-agent.mjs";
import { jobSecrets } from "../builder/edit-job.mjs";

test("SA12 the switch: off unless on or listed; the cap from env or 60", () => {
  assert.equal(agentOn({}, "a"), false);
  assert.equal(agentOn({ SITE_AGENT: "off" }, "off"), false);
  assert.equal(agentOn({ SITE_AGENT: "on" }, "any"), true);
  assert.equal(agentOn({ SITE_AGENT: "kiln-lane, fretwork-1" }, "fretwork-1"), true);
  assert.equal(agentOn({ SITE_AGENT: "kiln-lane" }, "fretwork-1"), false);
  assert.equal(agentCap({}), 60);
  assert.equal(agentCap({ SITE_AGENT_CAP: "25" }), 25);
  assert.equal(agentCap({ SITE_AGENT_CAP: "x" }), 60);
  assert.match(stoppedFacts({ stopped: "credits", lastBuild: "fail" }), /spending limit.*Nothing on the site was changed; its last build had errors\./);
});

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const between = (a, b) => { const i = W.indexOf(a); assert.ok(i >= 0, "landmark: " + a); const j = W.indexOf(b, i); assert.ok(j > i, "landmark: " + b); return W.slice(i, j); };

test("SA13 both routes hand the whole message to the agent when it is on, before any lane", () => {
  const edit = between("// ── THE SITE AGENT (2026-10-28", "// ── THE SEVENTEEN LANES ARE THE FRONT DOOR");
  assert.match(edit, /agentOn\(env, ownerSlug\)/);
  assert.match(edit, /runAgentChange\(env, \{[^]*words: eMessage/);
  const add = between("// ── THE SITE AGENT TAKES AN ADDITION TOO", "// ── AN ENTRY THIS REQUEST HAS ALREADY SAVED");
  assert.match(add, /agentOn\(env, ownerSlug\)/);
  assert.match(add, /runAgentChange\(env, \{[^]*words: aAsked/);
  // and the router never splits such a site's message into parts
  assert.match(W, /const rKey = [^\n]*!agentOn\(env, rKeySlug\)/);
});

test("SA14 the build tool compiles only: answered before the repair, the staging and the publish", () => {
  const fn = between("async function runAgentChange(", "async function recompileAndPublish(env, {");
  assert.match(fn, /build: \(w\) => recompileAndPublish\(env, \{[^}]*compileOnly: true/);
  // charged only when there is something to save, before the save
  const bill = fn.indexOf("await bill(ag.usage)"), save = fn.indexOf('label: "Changed by the site agent"'), stop = fn.indexOf("if (!ag.ok || !ag.changed.length)");
  assert.ok(stop > 0 && bill > stop && save > bill);
  const spine = between("async function recompileAndPublish(env, {", "\n}\n");
  assert.match(spine, /if \(!compileOnly && job && job\.beside/);
  const only = spine.indexOf("if (compileOnly) {"), first = spine.indexOf("let built = await compile();");
  const hook = spine.indexOf("const compileHook ="), gate = spine.indexOf("afterCompile({");
  assert.ok(first > 0 && only > first && hook > only && gate > only, "the compile-only answer comes straight after the compile");
});

test("SA15 the container job is handed the switch; the deploy delivers it off by default", () => {
  assert.deepEqual(jobSecrets({ SITE_AGENT: "on", SITE_AGENT_CAP: "30", OTHER: "x" }), { SITE_AGENT: "on", SITE_AGENT_CAP: "30" });
  const D = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(D, /SITE_AGENT: \$\{\{ secrets\.SITE_AGENT \|\| 'off' \}\}/);
  assert.match(D, /\n {12}SITE_AGENT\n/);
  const K = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(K, /builder\/site-agent\.mjs \.\/worker\/builder\//);
});

test("SA16 a failed build never opens finish", async () => {
  const s = scripted([answer(use("build", {})), answer(use("finish", { summary: "s" }))]);
  const r = await runSiteAgent({ send: s.send, build: async () => ({ ok: false, error: "TS1005" }) }, { request: "r", pages: PAGES, maxRounds: 2 });
  assert.equal(r.ok, false);
  assert.equal(r.lastBuild, "fail");
  const res = s.sent.at(-1).messages.at(-1).content;
  assert.equal(res.length, 1);
  const r2 = await runSiteAgent({ send: scripted([answer(use("build", {})), answer(use("finish", { summary: "s" }))]).send, build: async () => ({ ok: false, error: "x" }) }, { request: "r", pages: PAGES, maxRounds: 3 });
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
