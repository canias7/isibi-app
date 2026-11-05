// CODER (2026-11-05): the developer agent in its own files and container. Tested
// with a scripted AI (no model is called) and real bash commands in a temporary
// folder: the safety checks, the loop (bash / ask / done / stop), the container
// service end to end, the Worker routes over a fake bucket and container, the
// zip, and the wiring.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { commandProblem, cleanEnv, scrub, capOutput, readTimeout } from "../coder/coder-checks.mjs";
import { runCoder, readAsk } from "../coder/coder-agent.mjs";
import { execIn, exportFiles, restoreFiles, createApp } from "../coder/server.mjs";
import { handleCoder, projectIdFor } from "../coder/coder-routes.mjs";
import { makeZip, crc32 } from "../coder/coder-zip.mjs";
import { coderModel, coderSend } from "../coder/coder-model.mjs";

const call = (name, args, id = name + Math.random().toString(36).slice(2, 7)) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const scripted = (steps) => { let i = 0; const seen = []; return { seen, send: async (req) => { seen.push(req); return steps[Math.min(i++, steps.length - 1)]; } }; };

// ── THE CHECKS ───────────────────────────────────────────────────────────────
test("CD1 dangerous commands are refused with the reason; ordinary ones run", () => {
  for (const c of ["rm -rf /", "rm -rf ~", "rm -rf ../other", ":(){ :|:& };:", "mkfs.ext4 /dev/sda", "dd if=x of=/dev/sda", "shutdown now", "cat /proc/1/environ", "sudo apt install x", "pkill node"]) assert.match(commandProblem(c), /refused/, c);
  for (const c of ["ls -la", "rm -rf node_modules", "cat src/App.jsx", "npm test", "grep -rn useState src", "rm -rf ./dist"]) assert.equal(commandProblem(c), "", c);
  assert.match(commandProblem(""), /empty/);
  assert.match(commandProblem("x".repeat(9000)), /over 8000/);
});

test("CD2 commands run with no secrets in reach; key-shaped text is hidden; long output is cut and says so", async () => {
  const env = cleanEnv("/work/p");
  assert.deepEqual(Object.keys(env).filter((k) => /KEY|TOKEN|SECRET/.test(k)), []);
  process.env.XAI_API_KEY = "xai-thisisasecretkeyvalue1234567890";
  const dir = await mkdtemp(join(tmpdir(), "coder-"));
  const r = await execIn(dir, "env; echo ok", 10);
  assert.doesNotMatch(r.output, /thisisasecret/, "the container's key reached a command");
  delete process.env.XAI_API_KEY;
  assert.equal(scrub("key sk_live_abcdefghij12 and xai-1234567890abcdefXYZ"), "key [hidden] and [hidden]");
  const long = capOutput("a".repeat(30000), 1000);
  assert.ok(long.length < 1200);
  assert.match(long, /characters not shown/);
  assert.equal(readTimeout(99999), 600);
  assert.equal(readTimeout("x"), 120);
});

test("CD3 a command that runs past its time limit is stopped, with its whole process group", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-"));
  const t0 = Date.now();
  const r = await execIn(dir, "sleep 30", 1);
  assert.equal(r.timedOut, true);
  assert.ok(Date.now() - t0 < 5000);
});

// ── THE LOOP ─────────────────────────────────────────────────────────────────
test("CD4 the loop: Coder writes a file with a heredoc, reads it, runs it, and finishes; every step is an event", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-"));
  const s = scripted([
    say("I'll write a small script.", [call("bash", { command: "cat > hello.js <<'EOF'\nconsole.log('hello from coder')\nEOF" })]),
    say("", [call("bash", { command: "node hello.js" })]),
    say("", [call("done", { summary: "Wrote hello.js; it prints a greeting." })]),
  ]);
  const events = [];
  const r = await runCoder({ send: s.send, exec: ({ command, timeoutS }) => execIn(dir, command, timeoutS), emit: (e) => events.push(e) }, { text: "make a hello script" });
  assert.equal(r.status, "done");
  assert.equal(r.summary, "Wrote hello.js; it prints a greeting.");
  assert.equal(await readFile(join(dir, "hello.js"), "utf8"), "console.log('hello from coder')\n");
  const out = events.filter((e) => e.type === "result").map((e) => e.output).join("\n");
  assert.match(out, /hello from coder/);
  assert.deepEqual(events.map((e) => e.type), ["user", "text", "bash", "result", "bash", "result", "done"]);
  assert.equal(s.seen[0].messages[0].role, "system");
  assert.deepEqual(s.seen[0].tools.map((t) => t.function.name), ["bash", "ask", "done"]);
  // the command's real result reached the AI on the next round
  assert.match(JSON.stringify(s.seen[2].messages), /hello from coder/);
});

test("CD5 a refused command never runs, and the AI is told why", async () => {
  let ran = 0;
  const s = scripted([say("", [call("bash", { command: "rm -rf /" })]), say("", [call("done", { summary: "ok" })])]);
  await runCoder({ send: s.send, exec: async () => { ran++; return { code: 0, output: "" }; } }, { text: "x" });
  assert.equal(ran, 0);
  assert.match(JSON.stringify(s.seen[1].messages), /refused: it would delete the whole machine/);
});

test("CD6 ask ends the turn with the question; the answer resumes from the same conversation", async () => {
  const s = scripted([say("", [call("ask", { question: "React or plain HTML?", options: ["React", "Plain HTML"] }), call("bash", { command: "ls" })])]);
  let ran = 0;
  const r = await runCoder({ send: s.send, exec: async () => { ran++; return { code: 0, output: "" }; } }, { text: "make a page" });
  assert.equal(r.status, "ask");
  assert.deepEqual(r.ask, { question: "React or plain HTML?", options: ["React", "Plain HTML"] });
  assert.equal(ran, 0, "a call after the question ran");
  const s2 = scripted([say("", [call("done", { summary: "Made it in React." })])]);
  const r2 = await runCoder({ send: s2.send, exec: async () => ({ code: 0, output: "" }) }, { messages: r.messages, text: "React" });
  assert.equal(r2.status, "done");
  const sent = s2.seen[0].messages;
  assert.equal(sent.at(-1).content, "React");
  assert.ok(sent.some((m) => m.role === "tool" && /Asked the owner/.test(m.content)));
  assert.deepEqual(readAsk({ question: "q", options: ["a"] }), { error: "ask needs 2 to 4 answers" });
});

test("CD7 Stop is read before every round and before every command; an answer in words is a finished turn", async () => {
  let stop = false;
  const s = scripted([say("", [call("bash", { command: "echo 1" })]), say("", [call("bash", { command: "echo 2" })])]);
  let ran = 0;
  const r = await runCoder({ send: async (q) => { const a = await s.send(q); stop = true; return a; }, exec: async () => { ran++; return { code: 0, output: "" }; }, stopped: () => stop }, { text: "x" });
  assert.equal(r.status, "stopped");
  assert.equal(ran, 0);
  const talk = await runCoder({ send: async () => say("It's a React app with two pages."), exec: async () => ({}) }, { text: "what is this project?" });
  assert.equal(talk.status, "done");
  assert.equal(talk.summary, "It's a React app with two pages.");
});

// ── THE CONTAINER SERVICE, END TO END (a real server, a scripted AI) ──────────
async function serve(handle) {
  const srv = http.createServer(handle);
  await new Promise((r) => srv.listen(0, r));
  const base = "http://127.0.0.1:" + srv.address().port;
  return { base, close: () => new Promise((r) => srv.close(r)) };
}

test("CD8 the container: a turn runs in the background, its events are read by `since`, its files come back and go in again", async () => {
  const root = await mkdtemp(join(tmpdir(), "coder-root-"));
  const s = scripted([say("", [call("bash", { command: "mkdir -p src && echo 'export const x = 1' > src/a.js && mkdir -p node_modules && echo junk > node_modules/j.js" })]), say("", [call("done", { summary: "made src/a.js" })])]);
  const { base, close } = await serve(createApp({ root, send: s.send }));
  try {
    const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    assert.equal((await post("/turn", { project: "demo-1234", text: "go", messages: [] })).status, 200);
    let st;
    for (let i = 0; i < 50; i++) { st = await (await fetch(base + "/state?project=demo-1234&since=0")).json(); if (st.result) break; await new Promise((r) => setTimeout(r, 50)); }
    assert.equal(st.result.status, "done");
    assert.ok(st.events.some((e) => e.type === "bash"));
    const later = await (await fetch(base + "/state?project=demo-1234&since=" + st.next)).json();
    assert.deepEqual(later.events, []);
    const ex = await (await post("/export", { project: "demo-1234" })).json();
    assert.deepEqual(Object.keys(ex.files), ["src/a.js"], "dependencies are never exported");
    assert.equal(Buffer.from(ex.files["src/a.js"], "base64").toString(), "export const x = 1\n");
    const fresh = await mkdtemp(join(tmpdir(), "coder-restore-"));
    assert.equal(await restoreFiles(fresh, { ...ex.files, "../escape.txt": Buffer.from("x").toString("base64") }), 1, "a path out of the project is never written");
    assert.equal(await readFile(join(fresh, "src/a.js"), "utf8"), "export const x = 1\n");
    assert.equal((await post("/turn", { project: "../etc" })).status, 400);
  } finally { await close(); }
});

// ── THE WORKER ROUTES (a fake bucket, the real container service behind a fake binding) ──
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); } };
}

test("CD9 the routes: off unless switched on; signed in only; create, message, follow, save once, download a real zip", async () => {
  const root = await mkdtemp(join(tmpdir(), "coder-root-"));
  const s = scripted([say("Making it.", [call("bash", { command: "echo '<h1>Hi</h1>' > index.html" })]), say("", [call("done", { summary: "Made index.html." })])]);
  const app = createApp({ root, send: s.send });
  const { base, close } = await serve(app);
  try {
    const bucket = fakeBucket();
    const env = { CODER_ON: "on", SITES_BUCKET: bucket };
    const deps = { authUser: async (r) => (r.headers.get("Authorization") === "Bearer ok" ? { id: "user-1234567890abcdef" } : null), container: () => ({ fetch: (req) => fetch(base + new URL(req.url).pathname + new URL(req.url).search, { method: req.method, headers: req.headers, body: req.method === "POST" ? req.body : undefined, duplex: "half" }) }) };
    const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { Authorization: "Bearer ok", "content-type": "application/json", ...(init.headers || {}) } }), env, {}, deps);
    assert.equal((await handleCoder(new Request("https://gofarther.dev/api/coder/projects"), { SITES_BUCKET: bucket }, {}, deps)).status, 404, "off unless CODER_ON is on");
    assert.equal((await handleCoder(new Request("https://gofarther.dev/api/coder/projects"), env, {}, deps)).status, 401);
    const created = await (await go("projects", { method: "POST", body: JSON.stringify({ name: "My Page" }) })).json();
    const id = created.project.id;
    assert.match(id, /^my-page-[a-z0-9]{4}$/);
    assert.equal((await (await go("projects")).json()).projects[0].id, id);
    assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "make a page" }) })).status, 200);
    assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "again" }) })).status, 409, "one turn at a time");
    let st;
    for (let i = 0; i < 60; i++) { st = await (await go("projects/" + id + "/state?since=0")).json(); if (!st.running && st.project.status !== "running") break; await new Promise((r) => setTimeout(r, 50)); }
    assert.equal(st.project.status, "idle");
    assert.equal(st.project.saved, 1);
    const files = JSON.parse(bucket.m.get("coder/user-1234567890abcdef/" + id + "/files.json"));
    assert.equal(Buffer.from(files["index.html"], "base64").toString(), "<h1>Hi</h1>\n");
    const events = JSON.parse(bucket.m.get("coder/user-1234567890abcdef/" + id + "/events.json"));
    assert.ok(events.some((e) => e.type === "done" && e.text === "Made index.html."));
    const zipRes = await go("projects/" + id + "/download");
    assert.equal(zipRes.headers.get("content-type"), "application/zip");
    const zipPath = join(root, "out.zip");
    await writeFile(zipPath, Buffer.from(await zipRes.arrayBuffer()));
    const listing = execFileSync("unzip", ["-l", zipPath]).toString();
    assert.match(listing, new RegExp(id + "/index\\.html"));
    assert.equal((await go("projects/../x")).status, 404);
  } finally { await close(); }
});

test("CD10 the zip is a real zip; the checksum is the standard one", async () => {
  assert.equal(crc32(new TextEncoder().encode("hello")), 0x3610a686);
  const z = makeZip({ "a.txt": new TextEncoder().encode("A"), "src/b.js": new TextEncoder().encode("B") });
  const dir = await mkdtemp(join(tmpdir(), "coder-zip-"));
  await writeFile(join(dir, "t.zip"), z);
  execFileSync("unzip", ["-q", join(dir, "t.zip"), "-d", join(dir, "x")]);
  assert.equal(await readFile(join(dir, "x", "src", "b.js"), "utf8"), "B");
  assert.match(projectIdFor("Booking Tracker!", () => 0.5), /^booking-tracker-[a-z0-9]{4}$/);
});

test("CD11 the model call: Grok's endpoint, the key only in the header, one retry on a busy answer", async () => {
  assert.equal(coderModel({}), "grok-4.7");
  assert.equal(coderModel({ CODER_MODEL: "grok-5" }), "grok-5");
  assert.equal(coderModel({ CODER_MODEL: "default" }), "grok-4.7", "the deploy's word for not set");
  const seen = [];
  const fetchFn = async (url, init) => { seen.push({ url, init }); return seen.length === 1 ? new Response("", { status: 429 }) : new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "hi" } }], usage: { prompt_tokens: 3, completion_tokens: 2 } })); };
  const send = coderSend({ XAI_API_KEY: "xai-k" }, { fetchFn, wait: async () => {} });
  const r = await send({ messages: [{ role: "user", content: "x" }], tools: [] });
  assert.equal(r.message.content, "hi");
  assert.equal(seen.length, 2);
  assert.equal(seen[0].url, "https://api.x.ai/v1/chat/completions");
  assert.equal(seen[0].init.headers.authorization, "Bearer xai-k");
  assert.doesNotMatch(seen[0].init.body, /xai-k/);
  await assert.rejects(coderSend({})({ messages: [] }), /no AI key/);
});

// ── KEPT APART FROM THE SITES AGENT, AND WIRED ───────────────────────────────
test("CD12 Coder's own files; the only hooks are one import, one route and one class; its own container", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(W, /import \{ handleCoder \} from "\.\/coder\/coder-routes\.mjs";/);
  assert.match(W, /if \(url\.pathname\.startsWith\("\/api\/coder\/"\)\) \{\s*const cu = await authUser\(request\);\s*if \(!cu\) return UNAUTHED\(\);\s*return handleCoder\(request, env, ctx, \{ authUser: async \(\) => cu, container: \(name\) => getContainer\(env\.CODER_CONTAINER, laneName\("coder-" \+ name\)\) \}\);/);
  assert.match(W, /export class CoderContainer extends Container \{/);
  for (const f of ["coder-agent.mjs", "coder-checks.mjs", "coder-model.mjs", "coder-routes.mjs", "coder-zip.mjs", "server.mjs", "Dockerfile"]) assert.ok(existsSync(new URL("../coder/" + f, import.meta.url)), f);
  for (const f of ["coder-agent.mjs", "coder-checks.mjs", "coder-model.mjs", "coder-routes.mjs", "server.mjs"]) {
    const src = readFileSync(new URL("../coder/" + f, import.meta.url), "utf8");
    assert.doesNotMatch(src, /from "\.\.\/builder\//, f + " reaches into the Sites agent's code");
  }
  const D = readFileSync(new URL("../coder/Dockerfile", import.meta.url), "utf8");
  for (const f of ["server.mjs", "coder-agent.mjs", "coder-model.mjs", "coder-checks.mjs"]) assert.match(D, new RegExp(f.replace(".", "\\.")), "the image lacks " + f);
  const J = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(J, /"class_name": "CoderContainer",\s*"image": "\.\/coder\/Dockerfile"/);
  assert.match(J, /\{ "class_name": "CoderContainer", "name": "CODER_CONTAINER" \}/);
  assert.match(J, /\{ "tag": "v9", "new_sqlite_classes": \["CoderContainer"\] \}/);
  const Y = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(Y, /CODER_ON: \$\{\{ secrets\.CODER_ON \|\| 'off' \}\}/);
});
