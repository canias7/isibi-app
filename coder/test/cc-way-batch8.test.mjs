// "GO CLAUDE CODE WAY", BATCH 8 (2026-11-22): the items of this batch Coder now does as Claude Code does, each with the case
// that failed before it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, symlink, rm } from "node:fs/promises";
import { readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import path from "node:path";

const S = await import("../container/server.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const T = await import("../container/coder-tools.mjs");
const TS = await import("../container/coder-toolsearch.mjs");
const SEC = await import("../container/coder-secrets.mjs");
const AT = await import("../src/coder-attach.mjs");
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const ROOT = "/data/coder/projects/shop-b8";
const toolReq = (cmd) => { const m = /coder-tools\.mjs (\S+)/.exec(String(cmd || "")); if (!m || m[1].startsWith("@")) return null; try { return JSON.parse(Buffer.from(m[1], "base64").toString("utf8")); } catch { return null; } };

// ── M-b-33: LIMITED NETWORK IS EXACTLY CLAUDE CODE'S LIST ────────────────────────────────────────────────────────────
test("M-b-33 the default (Limited) list is exactly Claude Code's 204 sites: Debian's two package sites, go.dev and sh.rustup.rs are no longer reached without the owner adding them", () => {
  const cc = readFileSync(new URL("./fixtures/claude-code-trusted.txt", import.meta.url), "utf8").split("\n").filter(Boolean);
  assert.deepEqual([...SEC.DEFAULT_HOSTS].sort(), [...cc].sort());
  const trusted = SEC.normNetwork({ mode: "trusted" });
  for (const h of ["deb.debian.org", "security.debian.org", "go.dev", "sh.rustup.rs"]) assert.equal(SEC.hostAllowed(h, trusted), false, h + " is not on Claude Code's list");
  for (const h of ["rustup.rs", "static.rust-lang.org", "pkg.go.dev", "proxy.golang.org", "archive.ubuntu.com"]) assert.equal(SEC.hostAllowed(h, trusted), true, h);
  // The owner can still add one under Allowed sites.
  assert.equal(SEC.hostAllowed("sh.rustup.rs", SEC.normNetwork({ mode: "limited", hosts: ["sh.rustup.rs"] })), true);
});

// ── MISS-79: THE OWNER SETS HOW MUCH ONE READ RETURNS ─────────────────────────────────────────────────────────────────
test("MISS-79 CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS (or CODER_FILE_READ_MAX_OUTPUT_TOKENS) sets how much one read gives, its tokens at 4 characters each; unset, the usual 100,000 characters; Grok can't set it; hooks never see it", async () => {
  assert.equal(A.readTokensChars("1000"), 4000);
  assert.equal(A.readTokensChars(""), 0);
  assert.equal(A.readTokensChars("lots"), 0);
  assert.equal(A.readTokensChars("0"), 0);
  assert.equal(S.REPO_OWN_ENV.CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS, "CODER_FILE_READ_MAX_OUTPUT_TOKENS");
  assert.equal(S.ownerCoderVars({ CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS: "500" }).CODER_FILE_READ_MAX_OUTPUT_TOKENS, "500", "Claude Code's name typed in the environment window works");
  // The read tool itself: 40 lines of 100 characters (about 4 KB) come whole by default, in parts with a small limit.
  // (In the scratch folder, which the file tools may use besides the project.)
  const { mkdir } = await import("node:fs/promises");
  await mkdir(T.SCRATCH, { recursive: true });
  const file = join(T.SCRATCH, "b8-long-" + process.pid + ".txt");
  await writeFile(file, Array.from({ length: 40 }, (_, i) => String(i + 1).padStart(3, "0") + " " + "x".repeat(95)).join("\n") + "\n");
  try {
    const whole = await T.toolRead({ path: file });
    assert.ok(!/PARTIAL view/.test(whole), "the usual size reads it whole");
    const part = await T.toolRead({ path: file, read_chars: 1000 });
    assert.match(part, /\[PARTIAL view: lines 1-9 of 40/);
  } finally { await rm(file, { force: true }); }
  // Coder's loop: the owner's setting goes with each read; a read_chars Grok sends is not taken.
  const reqs = [];
  await A.runCoder({
    send: (() => { let n = 0; const steps = [say("", [call("read", { path: "a.txt", read_chars: 99999999 }, "r1")]), say("done")]; return async () => steps[Math.min(n++, 1)]; })(),
    exec: async (x) => { const q = toolReq(x.command); if (q) reqs.push(q); return { code: 0, output: "     1\thi" }; },
    emit: () => {}, here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-b8", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    readTokens: "250", toolSearch: "false",
  }, { text: "read a.txt", mode: "auto", rules: { allow: [], ask: [], deny: [] } });
  const r = reqs.find((q) => q.tool === "read");
  assert.ok(r, "the read ran");
  assert.equal(r.args.read_chars, 1000);
  assert.deepEqual(Object.keys(H.hookToolInput("read", { path: "a.txt", read_chars: 1000 })).sort(), ["file_path", "path"]);
});

// ── M-c-56: HOOKS GET THE CONVERSATION'S FILE ────────────────────────────────────────────────────────────────────────
test("M-c-56 the conversation as Claude Code's transcript lines: user and assistant entries with Claude's content blocks (tool_use with the Claude Code tool name and input, tool_result), chained by uuid, Coder's notes as isMeta, no system message", () => {
  const convo = [
    { role: "system", content: "You are Coder" },
    { role: "user", content: "fix the cart" },
    { role: "assistant", content: "Looking.", tool_calls: [call("read", { path: "cart.js" }, "t1")] },
    { role: "tool", tool_call_id: "t1", content: "     1\tlet total = 0" },
    { role: "user", appNote: true, content: "(Note from Coder's app: x)" },
    { role: "assistant", content: "Fixed it." },
  ];
  const r = H.transcriptLines(convo, { session: "shop-b8", cwd: ROOT, model: "grok-4.7" });
  const e = r.lines.map((l) => JSON.parse(l));
  assert.equal(e.length, 5, "the system message is left out");
  assert.deepEqual(e.map((x) => x.type), ["user", "assistant", "user", "user", "assistant"]);
  assert.equal(e[0].parentUuid, null);
  for (let i = 1; i < e.length; i++) assert.equal(e[i].parentUuid, e[i - 1].uuid);
  assert.equal(r.last, e[4].uuid);
  assert.deepEqual(e[0].message, { role: "user", content: "fix the cart" });
  assert.equal(e[0].sessionId, "shop-b8");
  assert.equal(e[0].cwd, ROOT);
  assert.equal(e[0].isSidechain, false);
  assert.equal(e[0].userType, "external");
  assert.match(e[0].timestamp, /^\d{4}-\d\d-\d\dT/);
  assert.match(e[0].uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(e[1].message.content, [{ type: "text", text: "Looking." }, { type: "tool_use", id: "t1", name: "Read", input: { path: "cart.js", file_path: "cart.js" } }]);
  assert.equal(e[1].message.model, "grok-4.7");
  assert.deepEqual(e[2].message.content, [{ type: "tool_result", tool_use_id: "t1", content: "     1\tlet total = 0" }]);
  assert.equal(e[3].isMeta, true);
  // The same message keeps its uuid when the file is written again.
  assert.equal(H.transcriptLines(convo, { session: "shop-b8" }).lines.map((l) => JSON.parse(l).uuid)[2], e[2].uuid);
});

test("M-c-56 Coder's machine writes the transcript in root's folder beside the memory: whole at first, then only what is new, whole again after a summary shortened the conversation; never through a link", async () => {
  const mem = await mkdtemp(join(tmpdir(), "coder-b8-mem-"));
  const file = S.transcriptFileFor(mem, "shop-b8");
  assert.equal(file, join(mem, "shop-b8.transcript", "shop-b8.jsonl"));
  const st = { n: 0, last: null };
  const convo = [{ role: "user", content: "one" }, { role: "assistant", content: "two" }];
  assert.equal(S.writeTranscript(file, convo, st, { session: "shop-b8", cwd: ROOT }), file);
  let lines = (await readFile(file, "utf8")).trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(statSync(file).mode & 0o777, 0o644, "hooks (Coder's user) may read it");
  convo.push({ role: "user", content: "three" });
  S.writeTranscript(file, convo, st, { session: "shop-b8", cwd: ROOT });
  lines = (await readFile(file, "utf8")).trim().split("\n").map((l) => JSON.parse(l));
  const said = (l) => (typeof l.message.content === "string" ? l.message.content : l.message.content.map((b) => b.text).join(""));
  assert.deepEqual(lines.map(said), ["one", "two", "three"]);
  assert.equal(lines[2].parentUuid, lines[1].uuid, "an appended line chains on");
  S.writeTranscript(file, [{ role: "user", content: "summary" }], st, { session: "shop-b8" });
  lines = (await readFile(file, "utf8")).trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map(said), ["summary"]);
  // A link put where the file is: never written through.
  const other = join(mem, "elsewhere.txt");
  await writeFile(other, "keep");
  await rm(file);
  await symlink(other, file);
  assert.equal(S.writeTranscript(file, convo, { n: 0, last: null }, { session: "shop-b8" }), "");
  assert.equal(await readFile(other, "utf8"), "keep");
  await rm(mem, { recursive: true, force: true });
});

test("M-c-56 every hook gets transcript_path (Claude Code's common input field), the file holding the conversation so far; without a transcript (Gloopy) none", async () => {
  assert.deepEqual(Object.keys(H.hookInput("Stop", { session: "s", transcript: "/t/s.jsonl", cwd: "/w" })).slice(0, 3), ["session_id", "transcript_path", "cwd"]);
  assert.equal(H.hookInput("Stop", { session: "s", cwd: "/w" }).transcript_path, undefined);
  const mem = await mkdtemp(join(tmpdir(), "coder-b8-hook-"));
  const file = S.transcriptFileFor(mem, "shop-b8");
  const st = { n: 0, last: null };
  const inputs = [];
  let seen = "";
  const hooks = H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "cat > /dev/null" }] }] } }, "settings").list;
  await A.runCoder({
    send: (() => { let n = 0; const steps = [say("Checking.", [call("bash", { command: "ls", description: "List" }, "b1")]), say("done")]; return async () => steps[Math.min(n++, 1)]; })(),
    exec: async (x) => {
      if (x.hook) { const j = JSON.parse(x.payload); inputs.push(j); if (j.transcript_path) seen = readFileSync(j.transcript_path, "utf8"); return { code: 0, output: "" }; }
      return { code: 0, output: "a.txt\n" };
    },
    emit: () => {}, here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-b8", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch: "false",
    transcript: (convo, o) => S.writeTranscript(file, convo, st, { session: "shop-b8", cwd: ROOT, model: o.model }),
  }, { text: "list the files", mode: "auto", rules: { allow: ["Bash"], ask: [], deny: [] }, hooks });
  const pre = inputs.find((j) => j.hook_event_name === "PreToolUse");
  assert.ok(pre, "the PreToolUse hook ran");
  assert.equal(pre.transcript_path, file);
  const last = seen.trim().split("\n").map((l) => JSON.parse(l)).pop();
  assert.equal(last.type, "assistant", "the transcript has the conversation up to the call the hook is about");
  assert.equal(last.message.content.find((b) => b.type === "tool_use").name, "Bash");
  assert.ok(seen.includes("list the files"));
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /\.\.\.\(gloopy \? \{\} : \{ transcript: /, "Coder's chats only");
  await rm(mem, { recursive: true, force: true });
});

// ── MISS-55: CODER SENDS THE OWNER A FILE (CLAUDE CODE'S SENDUSERFILE) ──────────────────────────────────────────────────
test("MISS-55 send_user_file is Claude Code's SendUserFile: held back until tool_search loads it, its inputs (files, caption, status, display) and description; each file is read from the chat's folders and kept with the chat; the owner gets a card with the caption; proactive also notifies them; hooks see SendUserFile", async () => {
  assert.ok(TS.DEFERRED_TOOLS.includes("send_user_file"));
  assert.equal(H.ccTool("send_user_file"), "SendUserFile");
  const def = A.CODER_TOOLS.find((t) => t.function.name === "send_user_file").function;
  assert.deepEqual(def.parameters.required, ["files", "status"]);
  assert.deepEqual(def.parameters.properties.status.enum, ["normal", "proactive"]);
  assert.deepEqual(def.parameters.properties.display.enum, ["render", "attach"]);
  assert.match(def.description, /^Send files to the owner\. Use this for any file the owner would want to see — a generated diagram, a report, a screenshot, a built artifact — and you want it surfaced, not just mentioned\./);
  assert.match(def.description, /Files must already exist on the local filesystem — the tool sends files, it doesn't fetch URLs or render content\./);
  const events = [], put = [], told = [];
  const r = await A.runCoder({
    send: (() => { let n = 0; const steps = [say("", [call("send_user_file", { files: ["out/report.pdf", "missing.png"], caption: "the failing case is row 42", status: "proactive", display: "render" }, "f1")]), say("Sent.")]; return async () => steps[Math.min(n++, 1)]; })(),
    exec: async (x) => {
      const q = toolReq(x.command);
      if (q && q.tool === "send_file") return q.args.path === "out/report.pdf" ? { code: 0, output: JSON.stringify({ path: "out/report.pdf", name: "report.pdf", size: 2048, data: Buffer.from("%PDF-1.4 x").toString("base64") }) } : { code: 1, output: "error: no such file: missing.png" };
      return { code: 0, output: "" };
    },
    files: { get: async () => null, put: async (f) => { put.push(f); return { id: "a0123456789ab", name: f.name, size: 2048 }; } },
    emit: (e) => events.push(e), here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-b8", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch: "false",
  }, { text: "send me the report", mode: "auto", rules: { allow: [], ask: [], deny: [] } });
  assert.equal(put.length, 1);
  assert.equal(put[0].name, "report.pdf");
  assert.equal(Buffer.from(put[0].data, "base64").toString(), "%PDF-1.4 x");
  const { at: _at, ...card } = events.find((e) => e.type === "file");
  assert.deepEqual(card, { type: "file", id: "a0123456789ab", name: "report.pdf", size: 2048, caption: "the failing case is row 42", display: "render" });
  assert.ok(events.some((e) => e.type === "notify" && /^Coder sent you “report\.pdf”: the failing case is row 42$/.test(e.text)), "proactive reaches their phone or computer");
  const m = r.messages.find((x) => x.role === "tool" && x.tool_call_id === "f1");
  told.push(String(m.content));
  assert.match(told[0], /^sent: “report\.pdf” \(2 KB\) — the owner has it as a file card in the chat, kept with the chat\.\nerror: not sent: missing\.png: no such file: missing\.png$/);
});

test("MISS-55 a file Coder sends is kept with the chat as its attached files are, marked as Coder's, never dropping another; the Worker takes it only from that chat's running job", async () => {
  const m = new Map();
  const bucket = { async get(k) { return m.has(k) ? { text: async () => (typeof m.get(k) === "string" ? m.get(k) : ""), body: m.get(k) } : null; }, async put(k, v) { m.set(k, v); } };
  const kept = await AT.keepAttach(bucket, "u1", "c1", { name: "report.pdf", bytes: new Uint8Array([1, 2, 3]), out: true });
  assert.match(kept.id, AT.ATTACH_ID);
  assert.equal(kept.out, true);
  const list = await AT.readAttach(bucket, "u1", "c1");
  assert.deepEqual(list.map((x) => [x.name, x.out === true]), [["report.pdf", true]]);
  const src = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(src, /parts\[0\] === "coder-file-put" && parts\.length === 1 && request\.method === "POST"\) return coderJobFile\(request, env, bucket, true\)/);
  const refused = await (await import("../src/coder-routes.mjs")).coderJobFile(new Request("https://x/api/coder/coder-file-put", { method: "POST", headers: { "x-coder-chat": "u1/c1", "x-coder-turn": "3", "x-coder-egress": "wrong" }, body: "x" }), {}, bucket, true);
  assert.equal(refused.status, 403, "no pass, no file");
  const srv = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(srv, /filesAt\(gloopy \? "gloopy-file-put" : "coder-file-put"\)/);
  assert.doesNotMatch(srv, /only Gloopy hands files over/);
});

// ── THE PAGE: THE FILE CARD AND /export ──────────────────────────────────────────────────────────────────────────────
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CODER_SHOTS || "";
async function openChat(browser, project, events) {
  const ORIGIN = "https://gofarther.test";
  const st = { posts: [] };
  const api = (m, p) => ({
    "GET /api/coder/github": { connected: true, login: "ana" },
    "GET /api/coder/projects": { projects: [project] },
    ["GET /api/coder/projects/" + project.id]: { project, events, queue: [] },
    "GET /api/coder/settings": { prefs: {} },
  }[m + " " + p] || {});
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(ORIGIN + "/**", async (route) => {
    const u = new URL(route.request().url()), m = route.request().method();
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname === "/api/coder/projects/" + project.id + "/files/a0123456789ab") return route.fulfill({ contentType: "application/octet-stream", headers: { "x-file-name": "chart.png" }, body: readFileSync(new URL("../public/icons/" + (await import("node:fs")).readdirSync(new URL("../public/icons/", import.meta.url)).find((f) => f.endsWith(".png")), import.meta.url)) });
    if (u.pathname.startsWith("/api/")) { if (m !== "GET") st.posts.push(m + " " + u.pathname); return route.fulfill({ contentType: "application/json", body: JSON.stringify(api(m, u.pathname)) }); }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, st, errors };
}
test("MISS-55 and MISS-63 the page: a file Coder sent shows as a card with its caption (Preview opens a picture here; display attach, or a PDF, is a download card only); /export saves the chat as Claude Code's plain text and sends nothing", { skip: !chromium && "playwright not installed" }, async () => {
  const at = Date.now();
  const project = { id: "c8", title: "Fix the cart total", repo: "ana/shop", base: "main", branch: "coder/c8", status: "idle", mode: "acceptEdits", turn: 1, at };
  const events = [
    { type: "user", text: "Fix the cart\nand send a chart", at },
    { type: "text", text: "Looking at the cart.", at },
    { type: "bash", id: "b1", tool: "bash", verb: "Ran", command: "npm test", at },
    { type: "result", id: "b1", code: 0, output: "1 passing\n0 failing", at },
    { type: "file", id: "a0123456789ab", name: "chart.png", size: 2048, caption: "before vs after", display: "render", at },
    { type: "file", id: "a0123456789ac", name: "data.png", size: 4096, display: "attach", at },
    { type: "file", id: "a0123456789ad", name: "report.pdf", size: 4096, at },
    { type: "text", text: "Fixed the cart total.", at },
    { type: "done", at },
  ];
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openChat(browser, project, events);
    await page.waitForSelector(".cd-filecard", { timeout: 15000 });
    const cards = await page.$$eval(".cd-filecard", (l) => l.map((c) => ({ t: c.textContent, preview: !!c.querySelector("[data-file-view]"), get: !!c.querySelector("[data-file-get]") })));
    assert.equal(cards.length, 3);
    assert.match(cards[0].t, /chart\.png/);
    assert.match(cards[0].t, /2 KB · before vs after/);
    assert.deepEqual([cards[0].preview, cards[0].get], [true, true]);
    assert.deepEqual([cards[1].preview, cards[1].get], [false, true], "display attach: a download card only");
    assert.deepEqual([cards[2].preview, cards[2].get], [false, true], "a PDF in a Coder chat: Download (the page's rules don't show PDFs from data: addresses)");
    if (SHOTS) await page.screenshot({ path: join(SHOTS, "send-user-file.png"), fullPage: false });
    await page.click(".cd-filecard [data-file-view]");
    await page.waitForSelector("#cdView img", { timeout: 5000 });
    assert.match(await page.getAttribute("#cdView img", "src"), /^data:image\/png;base64,/, "shown from the chat's own file, as a data: address (the page's rules block blob: ones)");
    await page.click("#cdViewClose");
    await page.fill("#cdIn", "/export");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.press("#cdIn", "Enter")]);
    assert.match(dl.suggestedFilename(), /^\d{4}-\d\d-\d\d-\d{6}-fix-the-cart-total\.txt$/);
    const text = readFileSync(await dl.path(), "utf8");
    assert.equal(text, "# Fix the cart total\n\n> Fix the cart\n  and send a chart\n\n⏺ Looking at the cart.\n\n⏺ Bash(npm test)\n  ⎿  1 passing\n     0 failing\n\n⏺ Fixed the cart total.\n");
    await page.waitForFunction(() => document.body.textContent.includes("Conversation exported to: "), null, { timeout: 5000 });
    await page.fill("#cdIn", "/export notes");
    const [dl2] = await Promise.all([page.waitForEvent("download"), page.press("#cdIn", "Enter")]);
    assert.equal(dl2.suggestedFilename(), "notes.txt");
    assert.deepEqual(st.posts, [], "nothing is sent: no AI call");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  const src = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(src, /\['\/export', 'Export the current conversation as plain text'\]/);
});
