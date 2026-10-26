// EXPLORING THE SITE'S CODE (owner, 2026-10-26, "option b"): the module's
// tools, its bounded loop, the replay key and the billing sum, and the page
// rung's "move the reviews above the lessons" case on a Band-parts page,
// resolved by looking and never by asking. Supplied model answers only.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  siteFiles, exploreNote, exploreDigest, runExploreTool, exploreRequest, exploreSend, exploreCall,
  measureExplore, EXPLORE_MARK, EXPLORE_MAX_LOOKS, EXPLORE_TOOL_NAMES,
} from "../builder/site-explore.mjs";
import { runTweak } from "../builder/site-tweak.mjs";

const page = 'import Band1Hero from "@/routes/-parts/band-1-hero";\nimport Band2Lessons from "@/routes/-parts/band-2-lessons";\nimport Band3Split from "@/routes/-parts/band-3-split";\n\nexport const Route = createFileRoute("/")({ component: Home });\n\nfunction Home() {\n  return (\n    <main>\n      <Band1Hero />\n      <Band2Lessons />\n      <Band3Split />\n    </main>\n  );\n}\n';
const parts = [
  { name: "band-1-hero", source: "export default function Band1Hero() { return <section><h1>Driftwood</h1></section>; }" },
  { name: "band-2-lessons", source: "export default function Band2Lessons() {\n  return <section><h2>Surf lessons</h2></section>;\n}" },
  { name: "band-3-split", source: "export default function Band3Split() {\n  return <section><h2>Reviews</h2><p>What people say after a session</p></section>;\n}" },
];
const ctx = { files: siteFiles({ pages: [{ path: "index.tsx", source: page }, { path: "lessons.tsx", source: "x" }], parts }) };

test("the file list names each path, with the route a page serves; table names only for a data step", () => {
  const n = exploreNote(ctx);
  assert.ok(n.startsWith(EXPLORE_MARK));
  assert.match(n, /- index\.tsx \(\/\)/);
  assert.match(n, /- lessons\.tsx \(\/lessons\)/);
  assert.match(n, /- -parts\/band-3-split\.tsx\n|- -parts\/band-3-split\.tsx$/);
  assert.doesNotMatch(n, /Reviews|Surf lessons/, "no words of the site up front");
  assert.doesNotMatch(n, /Tables:/);
  const d = exploreNote({ ...ctx, tables: [{ name: "signups", columns: [{ name: "email", required: true }], access: "owner only", rows: 3 }] }, { tables: true });
  assert.match(d, /Tables: signups$/m);
  assert.doesNotMatch(d, /email/, "no column summaries up front");
  assert.equal(exploreNote({ files: [] }), "");
});

test("the tools read: list, search, read a range, describe a table", async () => {
  assert.match(await runExploreTool(ctx, "list_files", { prefix: "-parts/" }), /band-2-lessons/);
  assert.doesNotMatch(await runExploreTool(ctx, "list_files", { prefix: "-parts/" }), /index\.tsx/);
  assert.equal(await runExploreTool(ctx, "search", { pattern: "reviews" }), "-parts/band-3-split.tsx:2: return <section><h2>Reviews</h2><p>What people say after a session</p></section>;");
  assert.match(await runExploreTool(ctx, "search", { pattern: "^\\s*<Band\\d", regex: true }), /index\.tsx:10: <Band1Hero \/>/);
  assert.equal(await runExploreTool(ctx, "search", { pattern: "(", regex: true }), "error: not a valid regular expression");
  const r = await runExploreTool(ctx, "read_file", { path: "src/routes/index.tsx", from: 10, to: 12 });
  assert.match(r, /lines 10–12 of 16/);
  assert.match(r, /12\t      <Band3Split \/>/);
  assert.doesNotMatch(r, /<main>/);
  assert.match(await runExploreTool(ctx, "read_file", { path: "nope.tsx" }), /^no such file/);
  assert.match(await runExploreTool(ctx, "describe_table", { name: "x" }), /^unavailable/);
  const t = { tables: [{ name: "signups", columns: [{ name: "email", type: "text", required: true }], access: "visitors write, owner reads", rows: 4 }] };
  const dt = await runExploreTool(t, "describe_table", { name: "signups" });
  assert.match(dt, /email text \(required\)/); assert.match(dt, /access: visitors write, owner reads/); assert.match(dt, /rows: 4/);
  assert.equal(await runExploreTool(ctx, "write_file", {}), "unavailable: no such tool");
});

test("the request keeps the step's own tool and rules; looking relaxes a forced tool, the last round restores it", () => {
  const req = { model: "m", system: "RULES", tools: [{ name: "write_tweak" }], tool_choice: { type: "tool", name: "write_tweak" }, messages: [{ role: "user", content: "do it" }] };
  const a = exploreRequest(req, "NOTE", { looking: true });
  assert.equal(a.system, "RULES\n\nNOTE");
  assert.deepEqual(a.tools.map((t) => t.name), ["write_tweak", "list_files", "search", "read_file"]);
  assert.deepEqual(a.tool_choice, { type: "any" });
  assert.equal(a.messages[0].content, "do it");
  const b = exploreRequest(req, "NOTE", { looking: false });
  assert.deepEqual(b.tool_choice, req.tool_choice);
  assert.ok(exploreRequest(req, "NOTE", { tables: true }).tools.some((t) => t.name === "describe_table"));
  for (const n of ["read_rows", "automatic_rules", "site_settings", "read_upload"]) assert.ok(exploreRequest(req, "NOTE", { tables: true }).tools.some((t) => t.name === n), n);
});

const use = (name, input, id = name) => ({ type: "tool_use", id, name, input });

test("the loop answers looks, bills every round, ends with the step's answer, and is bounded", async () => {
  const sent = [];
  const answers = [
    { content: [use("search", { pattern: "x" }, "a")], usage: { input_tokens: 100, output_tokens: 10 } },
    { content: [use("read_file", { path: "index.tsx" }, "b")], usage: { input_tokens: 200, output_tokens: 20 } },
    { content: [use("own", { ok: 1 })], usage: { input_tokens: 300, output_tokens: 30 } },
  ];
  const send = async (r) => { sent.push(r); return answers[sent.length - 1]; };
  const req = { system: "S", tools: [{ name: "own" }], tool_choice: { type: "tool", name: "own" }, messages: [{ role: "user", content: "go" }] };
  const out = await exploreSend(send, ctx)(req);
  assert.equal(sent.length, 3);
  assert.deepEqual(out.usage, { input_tokens: 600, output_tokens: 60 }, "every round billed on the step's reply");
  assert.deepEqual(out.content.map((b) => b.name), ["own"]);
  assert.deepEqual(out.explore, { looks: 2, rounds: 3 });
  assert.equal(sent[2].messages.length, 5, "each round carries the looks and their results");
  assert.equal(sent[2].messages[2].content[0].type, "tool_result");
  // Bounded: a model that only looks is made to answer after the limit.
  const looker = [];
  const greedy = async (r) => { looker.push(r); return r.tool_choice && r.tool_choice.type === "tool" ? { content: [use("own", {})] } : { content: [use("search", { pattern: "a" }, "s" + looker.length)] }; };
  const g = await exploreSend(greedy, ctx, { maxLooks: 2 })(req);
  assert.equal(looker.length, 3);
  assert.deepEqual(looker[2].tool_choice, req.tool_choice);
  assert.deepEqual(g.explore, { looks: 2, rounds: 3 });
  assert.equal(EXPLORE_MAX_LOOKS, 6);
  // A look beside the step's own answer in one turn: the answer is the step's, the look dropped.
  const mixed = await exploreSend(async () => ({ content: [use("search", { pattern: "a" }), use("own", { v: 1 })] }), ctx)(req);
  assert.deepEqual(mixed.content.map((b) => b.name), ["own"]);
});

test("fails open: no files, the call goes as it was", async () => {
  let got = null;
  const req = { system: "S", messages: [] };
  await exploreSend(async (r) => { got = r; return {}; }, async () => { throw new Error("no read"); })(req);
  assert.equal(got, req);
  await exploreCall(async (k, r, b) => { got = [k, r, b]; return {}; }, null)("K", req, 7);
  assert.deepEqual(got, ["K", req, 7]);
});

test("the replay key moves with the site: a changed file changes the request", () => {
  const changed = { files: ctx.files.map((f) => (f.path === "-parts/band-3-split.tsx" ? { ...f, source: f.source + " " } : f)) };
  assert.notEqual(exploreDigest(ctx.files), exploreDigest(changed.files));
  assert.notEqual(exploreNote(ctx), exploreNote(changed));
  assert.equal(exploreNote(ctx), exploreNote({ files: ctx.files.slice() }), "the same site is the same request");
});

test("PHASE 1: the page rung moves the reviews above the lessons by looking, never asking", async () => {
  const sent = [];
  const answers = [
    { content: [use("search", { pattern: "reviews" }, "s1")], usage: { input_tokens: 900, output_tokens: 20 } },
    { content: [use("write_tweak", { edits: [{ old: "      <Band2Lessons />\n      <Band3Split />", new: "      <Band3Split />\n      <Band2Lessons />" }] })], usage: { input_tokens: 1000, output_tokens: 60 } },
  ];
  const send = async (r) => { sent.push(r); return answers[sent.length - 1]; };
  const out = await runTweak({ instruction: "Move the reviews section above the lessons section.", path: "index.tsx", source: page, send: exploreSend(send, ctx), inPart: false });
  assert.equal(sent.length, 2);
  assert.match(sent[1].messages.at(-1).content[0].content, /band-3-split\.tsx:2: .*Reviews/, "the look found the words in the part");
  assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
  assert.ok(out.source.indexOf("<Band3Split />") < out.source.indexOf("<Band2Lessons />"));
  assert.ok(!out.ask && !out.question);
  assert.equal(out.usage.in, 1900, "both rounds billed"); assert.equal(out.usage.out, 80);
});

test("the free measure: rounds and characters a step would send", async () => {
  const req = { system: "S", tools: [{ name: "own" }], tool_choice: { type: "tool", name: "own" }, messages: [{ role: "user", content: "go" }] };
  const m = await measureExplore({ req, ctx, answers: [{ content: [use("search", { pattern: "Reviews" })] }, { content: [use("own", {})] }] });
  assert.equal(m.rounds, 2);
  assert.equal(m.looks, 1);
  assert.ok(m.charsPerRound[1] > m.charsPerRound[0]);
  assert.ok(EXPLORE_TOOL_NAMES.includes("describe_table"));
});

test("PHASE 2: 'only I can see newsletter sign-ups' — the rules step looks up the table's read level and answers already so", async () => {
  const { runRulesEdit } = await import("../builder/site-rules.mjs");
  const tables = [{ name: "newsletter_signups", columns: [{ name: "id", pk: true }, { name: "email", notnull: true }], access: "collect" }];
  const ex = { files: ctx.files, tables: [{ name: "newsletter_signups", columns: [{ name: "email", required: true }], read: "none", access: "visitors can add; only you can read", rows: 12 }] };
  const sent = [];
  const answers = [
    { content: [use("describe_table", { name: "newsletter_signups" }, "d1")], usage: { input_tokens: 500, output_tokens: 10 } },
    { content: [use("write_table_rules", { tables: [{ table: "newsletter_signups", read: "none", readWords: "only I can see" }] })], usage: { input_tokens: 600, output_tokens: 20 } },
  ];
  const send = async (r) => { sent.push(r); return answers[sent.length - 1]; };
  const out = await runRulesEdit({ send: exploreSend(send, ex) }, { instruction: "Only I can see newsletter sign-ups.", tables });
  assert.equal(sent.length, 2);
  assert.ok(sent[0].tools.some((t) => t.name === "describe_table") && sent[0].tools[0].name === "write_table_rules", "its own tool first, the looks beside it");
  assert.match(sent[1].messages.at(-1).content[0].content, /access: visitors can add; only you can read/);
  assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
  assert.equal(out.satisfied, true);
  assert.deepEqual(out.already.map((a) => [a.table, a.read]), [["newsletter_signups", "none"]]);
  assert.equal(out.usage.in, 1100, "both rounds billed");
});

test("PHASE 2: the data and rules steps explore, by name", async () => {
  const { readFileSync } = await import("node:fs");
  const SRC = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(SRC, /runDataEdit\(\{\s*send: eQuick\("data"\),/);
  assert.match(SRC, /runRulesEdit\(\{\s*send: eQuick\("rules"\),/);
  const set = /const EDIT_EXPLORE_STEPS = new Set\(\[([^\]]*)\]\)/.exec(SRC)[1];
  for (const n of ["data", "rules"]) assert.ok(set.includes('"' + n + '"'), n);
});
