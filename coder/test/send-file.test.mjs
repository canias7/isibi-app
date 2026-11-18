// CLAUDE CODE'S SendUserFile AS CODER'S send_user_file (the owner, 2026-11-18: "Ok you can start"; Claude Code 2.1.327's tool, read
// in its program and tried in a Claude Code cloud session that day): its words and input (coder-sendfile.mjs); its checks of each
// file and its reading, as the AI's user (coder-tools.mjs user_file_check, user_file_read); what Coder is told; the files kept by
// Coder's server with the chat (src/coder-sent.mjs), shown in place from a signed address or downloaded; the machine's sender;
// Coder's loop (offered from the start in its own chats, the owner's Read rules on each file, a rule on the tool or one of its
// inputs, the card, the hooks' result object); and the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SF = await import("../container/coder-sendfile.mjs");
const SENT = await import("../src/coder-sent.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const { modelPass } = await import("../src/coder-model-gate.mjs");
const HERE = (p) => new URL("../" + p, import.meta.url);
const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;

/** A project folder with files to send, and the tools script run there as Coder's machine runs it. */
function project() {
  const dir = mkdtempSync(join(tmpdir(), "sendfile-"));
  writeFileSync(join(dir, "report.md"), "# Report\nhello\n");
  writeFileSync(join(dir, "chart.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  writeFileSync(join(dir, "page.html"), "<!doctype html><p>hi</p>");
  writeFileSync(join(dir, "data.csv"), "a,b\n1,2\n");
  mkdirSync(join(dir, "out"));
  try { symlinkSync("/etc/hostname", join(dir, "link-out")); } catch { /* no links here */ }
  const run = (req) => { const r = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: dir, env: { ...process.env, CODER_CWD: dir }, encoding: "utf8", maxBuffer: 64 << 20 }); return { code: r.status, output: r.stdout }; };
  return { dir, run };
}

test("SF1 (2026-11-18) Claude Code 2.1.327's words: its description (its text for when no notification is sent, without the sentence naming its PushNotification tool, which Coder doesn't have), inputs and hint; its input refused as it refuses it (tried)", () => {
  assert.equal(SF.SEND_TOOL, "send_user_file");
  assert.equal(SF.CC_SEND, "SendUserFile");
  const cc = readFileSync(HERE("test/fixtures/sendfile/claude-code-description.txt"), "utf8");
  assert.equal(SF.SEND_DESCRIPTION, cc.replace(" If this run is meant to notify the user, call PushNotification as well.", "").replace("SendUserFile({", "send_user_file({"));
  assert.deepEqual(SF.SEND_TOOL_DEF.function.parameters.required, ["files", "status"]);
  assert.equal(SF.SEND_TOOL_DEF.function.parameters.additionalProperties, false);
  assert.deepEqual(SF.SEND_PROPERTIES.files, { type: "array", items: { type: "string" }, minItems: 1, description: "File paths (absolute or relative to cwd) to send to the user. Always pass an array, even for a single file." });
  assert.deepEqual(SF.SEND_PROPERTIES.status.enum, ["normal", "proactive"]);
  assert.equal(SF.SEND_PROPERTIES.status.description, "Use 'proactive' when you're surfacing a file the user hasn't asked for and needs to see now — a generated artifact, a completed report. Use 'normal' when replying to something the user just said.");
  assert.match(SF.SEND_PROPERTIES.display.description, /^How the client should present the file\. 'render' opens it inline in the side panel/);
  assert.equal(SF.SEND_HINT, "deliver files (screenshots, reports, artifacts) to the user");
  // (Its input: one path as a string is a list of one; `status` left out, or none of its two, is its enum's own issue, raw; an
  // empty list and a wrong status together, both raw, in its order: tried in a Claude Code session.)
  assert.deepEqual(SF.checkSendInput({ files: "a.md", status: "normal" }), { args: { files: ["a.md"], status: "normal" } });
  assert.equal(SF.checkSendInput({ files: ["x"] }).error, "error: InputValidationError: [\n  {\n    \"code\": \"invalid_value\",\n    \"values\": [\n      \"normal\",\n      \"proactive\"\n    ],\n    \"path\": [\n      \"status\"\n    ],\n    \"message\": \"Invalid option: expected one of \\\"normal\\\"|\\\"proactive\\\"\"\n  }\n]");
  assert.equal(SF.checkSendInput({ files: [], status: "later" }).error, "error: InputValidationError: " + readFileSync(HERE("test/fixtures/sendfile/claude-code-empty-and-bad-status.txt"), "utf8").trim());
  assert.match(SF.checkSendInput({ files: [1], status: "normal", x: 1 }).error, /send_user_file failed due to the following issues:[\s\S]*An unexpected parameter `x` was provided[\s\S]*The parameter `files\[0\]` type is expected as `string` but provided as `number`/);
  assert.match(SF.checkSendInput({ files: ["a"], status: "normal", display: "inline" }).error, /"Invalid option: expected one of \\"render\\"\|\\"attach\\""/);
});

test("SF2 (2026-11-18) its checks of each file before any hook, as the AI's user, in its order and words (tried): a URL, a missing file with its three guesses, a folder, outside the project or a link out of it, a /proc link, a device, a name with a line break; then its reading: path, size, kind and bytes, or only its size past the limit", () => {
  const { dir, run } = project();
  const check = (files) => run({ tool: "user_file_check", args: { files } });
  assert.deepEqual(check(["report.md", "chart.png"]), { code: 0, output: "ok" });
  assert.equal(check(["https://example.com/report.pdf"]).output, "error: Attachment \"https://example.com/report.pdf\" looks like a URL, not a local file path. This tool can only send files that exist on the local filesystem — download or write the content to a local file first, then pass that path.");
  assert.equal(check(["report.txt"]).output, "error: Attachment \"report.txt\" does not exist. Current working directory: " + dir + ". Did you mean \"report.md\"?");
  const base = dir.split("/").pop();
  assert.equal(check([base + "/data.csv"]).output, "error: Attachment \"" + base + "/data.csv\" does not exist. Current working directory: " + dir + ". Did you mean \"data.csv\"?", "given from the folder's own name");
  assert.equal(check(["nothing.bin"]).output, "error: Attachment \"nothing.bin\" does not exist. Current working directory: " + dir + ".");
  assert.equal(check(["out"]).output, "error: Attachment \"out\" is not a regular file.");
  assert.equal(check(["/etc/hostname"]).output, "error: Attachment \"/etc/hostname\" is outside the working directories; reads outside them are blocked (Coder's file tools open files only inside the project and its working folders).");
  assert.match(check(["link-out"]).output, /^error: Attachment "link-out" is outside the working directories/);
  assert.equal(check(["/proc/self/fd/0"]).output, "error: Attachment \"/proc/self/fd/0\" is a path through a /proc or /dev link that this tool does not follow; give the file's own path.");
  assert.equal(check(["/dev/null"]).output, "error: Attachment \"/dev/null\" is a device or process file, which this tool does not send.");
  const badWhy = ": its name contains a line break, another control character or a character that changes text direction. If a file is really named so, copy or rename it to a name without such characters and send that; otherwise correct the path.";
  assert.equal(check(["bad\nname.txt"]).output, "error: Cannot send \"" + dir + "/bad\\nname.txt\"" + badWhy, "its full path in JSON's quotes (tried)");
  assert.equal(SF.badName("/w/x\u202ey \u00e9<.txt"), "Cannot send \"/w/x\\u202ey \\u00e9\\u003c.txt\"" + badWhy, "anything but plain ASCII written as \\uXXXX");
  const long = "/w/" + "d/".repeat(200) + "a\tb.txt", q = SF.quotedPath(long);
  assert.ok(q.length <= 300 && q.startsWith("\"...") && q.endsWith("/a\\tb.txt\""), "past 300 characters, its end");
  assert.equal(check(["ok\u200bname.txt"]).output.split(".")[0], "error: Attachment \"ok\u200bname", "a zero-width space is no bad name (tried)");
  // (A path in its refusals: `<` and `>` and control characters as entities, a zero-width space as it is: tried.)
  assert.equal(SF.shownPath("a<b>\u200bc\u2028\u0007"), "a&lt;b&gt;\u200bc&#8232;&#7;");
  // (The first refusal of several.)
  assert.match(check(["report.md", "gone.md", "out"]).output, /^error: Attachment "gone.md" does not exist/);
  const read = JSON.parse(run({ tool: "user_file_read", args: { path: "chart.png" } }).output);
  assert.deepEqual(read, { path: dir + "/chart.png", size: 8, isImage: true, media_type: "image/png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64") });
  assert.equal(JSON.parse(run({ tool: "user_file_read", args: { path: "report.md" } }).output).media_type, "text/markdown");
  writeFileSync(join(dir, "big.bin"), Buffer.alloc(SF.SEND_FILE_MAX + 1));
  assert.deepEqual(JSON.parse(run({ tool: "user_file_read", args: { path: "big.bin" } }).output), { path: dir + "/big.bin", size: SF.SEND_FILE_MAX + 1, isImage: false, tooBig: true });
  assert.match(run({ tool: "user_file_read", args: { path: "out" } }).output, /^error: Attachment "out" is not a regular file\./, "checked again as it is read");
});

test("SF3 (2026-11-18) what Coder is told, as Claude Code words it: the files delivered with their ids; those not, with their size and why, and what to tell the owner; a failure that may pass, that they can ask again", () => {
  const ok = { path: "/w/a.png", size: 10, isImage: true, file_uuid: "s000000000001", media_type: "image/png" };
  assert.equal(SF.sentText({ attachments: [ok] }), "1 file delivered to user.\n  /w/a.png → file_uuid: s000000000001");
  assert.equal(SF.sentText({ attachments: [ok, { ...ok, path: "/w/b.png", file_uuid: "s000000000002" }] }), "2 files delivered to user.\n  /w/a.png → file_uuid: s000000000001\n  /w/b.png → file_uuid: s000000000002");
  const big = { path: "/w/v.mp4", size: 40 * 1048576, isImage: false, upload_error: SF.tooBigToSend(40 * 1048576) };
  assert.equal(SF.tooBigToSend(40 * 1048576), "40.0 MiB exceeds the 30 MiB upload limit — send a smaller or compressed copy");
  assert.equal(SF.sentText({ attachments: [ok, big] }), "1 file delivered to user.\n  /w/a.png → file_uuid: s000000000001\n1 file could NOT be delivered to the user:\n  /w/v.mp4 (40.0 MiB): 40.0 MiB exceeds the 30 MiB upload limit — send a smaller or compressed copy\nTell the user the file was not delivered and why.");
  const down = { path: "/w/c.csv", size: 1048576, isImage: false, upload_error: SF.serverReturned(503) };
  assert.equal(SF.sentText({ attachments: [down] }), "1 file could NOT be delivered to the user:\n  /w/c.csv (1.0 MiB): upload failed: server returned 503\nTell the user the file was not delivered and why. The failure may be temporary, so also tell the user they can ask you to send it again in a few minutes.");
  assert.equal(SF.sentText({ attachments: [down, big] }), "2 files could NOT be delivered to the user:\n  /w/c.csv (1.0 MiB): upload failed: server returned 503\n  /w/v.mp4 (40.0 MiB): 40.0 MiB exceeds the 30 MiB upload limit — send a smaller or compressed copy\nTell the user the files were not delivered and why. For /w/c.csv, whose failure may be temporary, also tell the user they can ask you to send it again in a few minutes.");
  // (Which may pass, as its De has it: a server's 429, 5xx or 52x and the network's, but for a bad address or a certificate;
  // not a 403, nor a file too big.)
  assert.deepEqual([SF.serverReturned(429), SF.serverReturned(503), SF.serverReturned(403), SF.networkError("timeout of 35000ms exceeded"), SF.CONNECTION_CLOSED, SF.networkError("unable to verify the first certificate"), SF.UNEXPECTED_ANSWER, SF.tooBigToSend(SF.SEND_FILE_MAX + 1)].map(SF.mayPass), [true, true, false, true, true, false, false, false]);
  // (A path and an id as they are but for control characters; a failure's words with `<` and `>` as entities: its Yc and Hp.)
  assert.equal(SF.sentText({ attachments: [{ ...ok, path: "/w/<a>\tb.png" }, { ...down, upload_error: "upload failed: network error (<x>)" }] }), "1 file delivered to user.\n  /w/<a>&#9;b.png → file_uuid: s000000000001\n1 file could NOT be delivered to the user:\n  /w/c.csv (1.0 MiB): upload failed: network error (&lt;x&gt;)\nTell the user the file was not delivered and why. The failure may be temporary, so also tell the user they can ask you to send it again in a few minutes.");
  // (Shown in place by its kind, or as `display` says.)
  assert.deepEqual(["a.png", "b.svg", "c.pdf", "d.html", "e.csv", "f.zip", "g.docx"].map((n) => SF.renders(n)), [true, true, true, true, true, false, false]);
  assert.deepEqual([SF.renders("f.zip", "render"), SF.renders("a.png", "attach")], [true, false]);
});

// ── CODER'S SERVER ───────────────────────────────────────────────────────────
const env = { CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64") };
function memBucket() {
  const m = new Map();
  return { m, get: async (k) => (m.has(k) ? { text: async () => String(m.get(k)), arrayBuffer: async () => (typeof m.get(k) === "string" ? new TextEncoder().encode(m.get(k)).buffer : m.get(k).buffer) } : null), put: async (k, v) => { m.set(k, typeof v === "string" ? v : new Uint8Array(v)); }, delete: async (k) => { m.delete(k); } };
}

test("SF4 (2026-11-18) Coder's server keeps a chat's sent files: from its machine only with the chat's current job's pass, at most the limit, the oldest going past the chat's caps; shown in place from a signed address for 10 minutes (a picture loading nothing, a page sealed off, text as text), else downloaded; all gone with the chat", async () => {
  const b = memBucket(), e2 = { ...env, CODER_BUCKET: b };
  await b.put("coder/u1/chat-1/meta.json", JSON.stringify({ turn: 3 }));
  const until = String(Date.now() + 60_000), pass = await modelPass(env, "u1/chat-1", "3", until);
  const put = (name, bytes, p = pass, turn = "3") => SENT.handleSentPut(new Request("https://coder2.gofarther.dev/api/coder/sent-put", { method: "POST", headers: { "x-coder-chat": "u1/chat-1", "x-coder-turn": turn, "x-coder-until": until, "x-coder-model": p, "x-file-name": encodeURIComponent(name), "content-length": String(bytes.length) }, body: bytes }), e2);
  assert.equal((await put("a.png", new Uint8Array([1, 2]), "x".repeat(43))).status, 403);
  const r = await put("chart.png", new Uint8Array([1, 2, 3]));
  assert.equal(r.status, 200);
  const got = await r.json();
  assert.match(got.id, SENT.SENT_ID);
  assert.deepEqual({ ...got, id: "" }, { ok: true, id: "", name: "chart.png", size: 3, type: "image/png" });
  const tooBig = await put("v.mp4", new Uint8Array(1), pass, "3").then(async (x) => x);
  assert.equal(tooBig.status, 200, "(its own size, 1 byte: kept)");
  const over = await SENT.handleSentPut(new Request("https://x/api/coder/sent-put", { method: "POST", headers: { "x-coder-chat": "u1/chat-1", "x-coder-turn": "3", "x-coder-until": until, "x-coder-model": pass, "content-length": String(SF.SEND_FILE_MAX + 1) }, body: new Uint8Array(1) }), e2);
  assert.equal(over.status, 413);
  assert.deepEqual(await over.json(), { error: SF.tooBigToSend(SF.SEND_FILE_MAX + 1) });
  const list = await SENT.readSent(b, "u1", "chat-1");
  assert.deepEqual(list.map((x) => x.name), ["v.mp4", "chart.png"], "newest first");
  // (Another turn's job: refused.)
  await b.put("coder/u1/chat-1/meta.json", JSON.stringify({ turn: 4 }));
  assert.equal((await put("late.png", new Uint8Array([1]))).status, 403);
  // Shown in place: its signed address; tampered, or late, not found.
  const pic = list.find((x) => x.name === "chart.png");
  const address = await SENT.sentViewAddress(env, "u1", "chat-1", pic);
  assert.match(address, /^\/api\/coder\/sent-view\/u1\/chat-1\/s[a-z0-9]{12}\?e=\d+&t=[\w-]+$/);
  const view = (a) => { const u = new URL("https://x" + a); const p = u.pathname.split("/"); return SENT.serveSentView(env, b, p[4], p[5], p[6], u); };
  const shown = await view(address);
  assert.equal(shown.status, 200);
  assert.equal(shown.headers.get("content-type"), "image/png");
  assert.equal(shown.headers.get("content-security-policy"), "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  assert.equal(shown.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await view(address.replace(/t=[\w-]+$/, "t=AAAA"))).status, 404);
  assert.equal((await view(address.replace(/e=\d+/, "e=" + (Date.now() - 1000)))).status, 404);
  assert.equal(await SENT.sentViewAddress(env, "u1", "chat-1", list.find((x) => x.name === "v.mp4")), "", "a video: downloaded, not shown");
  // (A page, sealed off: its own sandbox, nothing sent anywhere.)
  await b.put("coder/u1/chat-1/meta.json", JSON.stringify({ turn: 5 }));
  const pass5 = await modelPass(env, "u1/chat-1", "5", until);
  const pg = await (await put("page.html", new TextEncoder().encode("<p>x</p>"), pass5, "5")).json();
  const pageShown = await view(await SENT.sentViewAddress(env, "u1", "chat-1", pg));
  assert.equal(pageShown.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(pageShown.headers.get("content-security-policy"), /^sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox; default-src 'none';[\s\S]*connect-src 'none'/);
  assert.equal(SENT.viewTypeOf("data.csv"), "text/plain; charset=utf-8");
  // Downloaded: always saved, as its own name.
  const f = await SENT.sentOf(b, "u1", "chat-1", pic.id);
  const dl = SENT.sentDownload(f.item, f.body);
  assert.equal(dl.headers.get("content-disposition"), "attachment; filename=\"chart.png\"; filename*=UTF-8''chart.png");
  assert.equal(dl.headers.get("content-type"), "application/octet-stream");
  // (Past the chat's caps the oldest go; with the chat, all of them.)
  assert.deepEqual([SENT.SENT_MAX, SENT.SENT_TOTAL_MAX], [500, 2 * 1024 ** 3]);
  await SENT.dropSent(b, "u1", "chat-1");
  assert.deepEqual([...b.m.keys()].filter((k) => k.includes("/sent")), []);
  // The routes: the job's own, the signed view, the chat's own (signed in), and the chat's deletion.
  const routes = readFileSync(HERE("src/coder-routes.mjs"), "utf8");
  assert.match(routes, /parts\[0\] === "sent-put" && parts\.length === 1 && request\.method === "POST"\) return handleSentPut\(request, env\)/);
  assert.match(routes, /parts\[0\] === "sent-view" && parts\.length === 4 && request\.method === "GET"\) return serveSentView/);
  assert.match(routes, /if \(action === "sent" && request\.method === "GET"\) \{/);
  assert.match(routes, /\/\/ \(And the files Coder sent in it: coder-sent\.mjs\.\)\n    await dropSent\(bucket, uid, id\)/);
});

test("SF5 (2026-11-18) the machine's sender: each file to /api/coder/sent-put with the job's pass and its name, never a sign-in; tried once more after a 503 or a timeout, as Claude Code's upload is; the server's refusal named", async () => {
  const via = { url: "https://coder2.gofarther.dev/api/coder/model", headers: { "x-coder-chat": "u1/chat-1", "x-coder-model": "pass" } };
  const sent = [];
  let replies = [new Response("busy", { status: 503 }), new Response(JSON.stringify({ ok: true, id: "s000000000009", name: "a b.png", size: 2, type: "image/png" }), { status: 200 })];
  const send = A.sentFileCaller(via, async (u, init) => { sent.push([u, init]); return replies.shift(); });
  assert.deepEqual(await send({ name: "a b.png", bytes: Buffer.from([1, 2]) }), { id: "s000000000009", name: "a b.png", size: 2, type: "image/png" });
  assert.equal(sent.length, 2, "once more after a 503");
  assert.equal(sent[0][0], "https://coder2.gofarther.dev/api/coder/sent-put");
  assert.equal(sent[0][1].headers["x-coder-model"], "pass");
  assert.equal(sent[0][1].headers["x-file-name"], "a%20b.png");
  assert.equal(A.SENT_PUT_MS, 35_000);
  replies = [new Response(JSON.stringify({ error: "too big" }), { status: 413 })];
  assert.deepEqual(await send({ name: "v.mp4", bytes: Buffer.alloc(3 * 1048576) }), { error: "3.0 MiB exceeds the 30 MiB upload limit — send a smaller or compressed copy" });
  replies = [new Response(JSON.stringify({ error: "not this job's pass" }), { status: 403 })];
  assert.deepEqual(await send({ name: "a.png", bytes: Buffer.alloc(1) }), { error: "upload failed: server returned 403" }, "its words: the status only");
  replies = [new Response("<html>", { status: 200 })];
  assert.deepEqual(await send({ name: "a.png", bytes: Buffer.alloc(1) }), { error: "upload failed: unexpected server response" });
  const throwing = (e) => A.sentFileCaller(via, async () => { throw e; });
  assert.deepEqual(await throwing(Object.assign(new Error("t"), { name: "TimeoutError" }))({ name: "a", bytes: Buffer.alloc(1) }), { error: "upload failed: network error (timeout of 35000ms exceeded)" });
  assert.deepEqual(await throwing(Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) }))({ name: "a", bytes: Buffer.alloc(1) }), { error: "upload failed: the connection closed before the server answered" });
  assert.deepEqual(await throwing(Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("getaddrinfo ENOTFOUND coder2.gofarther.dev"), { code: "ENOTFOUND" }) }))({ name: "a", bytes: Buffer.alloc(1) }), { error: "upload failed: network error (getaddrinfo ENOTFOUND coder2.gofarther.dev)" });
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /\.\.\.\(via && !gloopy \? \{ sendFile: sentFileCaller\(via\) \} : \{\}\),/);
});

// ── CODER'S LOOP ─────────────────────────────────────────────────────────────
const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
/** One job with a scripted Grok; its file tools run for real in a project folder; Coder's server a stub (`sendFile`). */
async function job(steps, { sendFile = null, extra = {}, deps = {}, hooks = null, hookRun = () => ({}) } = {}) {
  const { dir, run } = project();
  const events = [], seen = [], sent = [], hookCalls = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push(input); const a = (await hookRun(input)) || {}; return { code: 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" }; }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (!tm) return { code: 0, output: "ok\n" };
      return run(tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8")));
    },
    emit: (e) => events.push(e),
    here: () => dir, root: dir, chatId: "shop-sf", where: (p) => (p.startsWith("/") ? p : dir + "/" + p),
    sendFile: sendFile || (async ({ name, bytes }) => { sent.push({ name, bytes }); return { id: "s" + String(++k).padStart(12, "0"), name, size: bytes.length }; }),
    ...deps,
  }, { text: "send me the report", mode: "acceptEdits", messages: [], ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...extra });
  const msg = (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id);
  return { dir, r, events, seen, sent, hookCalls, told: (id) => (msg(id) || {}).content };
}
const names = (req) => (req.tools || []).map((t) => t.function.name);

test("SF6 (2026-11-18) Coder's loop: offered from the start in Coder's own chats (not held back, as in Claude Code's cloud sessions), not in a job from GitHub, nor without Coder's server; a call: each file read as the AI's user and kept by the server; Claude Code's words; the card (shown in place by kind, or as display says, with the caption); no step of its own; the hooks' name and result object", async () => {
  let t = await job([say("Nothing to do.")]);
  assert.ok(names(t.seen[0]).includes("send_user_file"), "upfront");
  assert.equal(t.seen[0].tools.find((x) => x.function.name === "send_user_file").function.description, SF.SEND_DESCRIPTION);
  t = await job([say("Nothing to do.")], { extra: { github: true } });
  assert.ok(!names(t.seen[0]).includes("send_user_file"), "a job from GitHub");
  t = await job([say("Nothing to do.")], { sendFile: undefined, deps: { sendFile: undefined } });
  assert.ok(!names(t.seen[0]).includes("send_user_file"), "no server to keep them");
  const hooks = { PostToolUse: [{ matcher: "SendUserFile", hooks: [{ type: "command", command: "after.sh" }] }] };
  t = await job([say("", [call("send_user_file", { files: ["chart.png", "report.md", "data.csv"], caption: "This week's numbers", status: "proactive" })]), say("Done.")], { hooks });
  assert.deepEqual(t.sent.map((x) => [x.name, x.bytes.length]), [["chart.png", 8], ["report.md", 15], ["data.csv", 8]]);
  assert.equal(t.told("c1"), "3 files delivered to user.\n  " + t.dir + "/chart.png → file_uuid: s000000000001\n  " + t.dir + "/report.md → file_uuid: s000000000002\n  " + t.dir + "/data.csv → file_uuid: s000000000003");
  const { at, ...card } = t.events.find((e) => e.type === "sent");
  assert.ok(at > 0, "when it was sent");
  assert.deepEqual(card, { type: "sent", id: "c1", caption: "This week's numbers", files: [{ id: "s000000000001", name: "chart.png", size: 8, type: "image/png", render: true }, { id: "s000000000002", name: "report.md", size: 15, type: "text/markdown", render: true }, { id: "s000000000003", name: "data.csv", size: 8, type: "text/csv", render: true }] });
  assert.ok(!t.events.some((e) => e.type === "bash" && e.id === "c1"), "no step row: the card is what the owner sees");
  const post = t.hookCalls.find((x) => x.hook_event_name === "PostToolUse");
  assert.equal(post.tool_name, "SendUserFile");
  assert.deepEqual(post.tool_input, { files: ["chart.png", "report.md", "data.csv"], caption: "This week's numbers", status: "proactive" });
  assert.deepEqual(post.tool_response.attachments[0], { path: t.dir + "/chart.png", size: 8, isImage: true, media_type: "image/png", file_uuid: "s000000000001" });
  assert.equal(post.tool_response.caption, "This week's numbers");
  // display "attach": a card to download, nothing shown in place.
  t = await job([say("", [call("send_user_file", { files: ["chart.png"], status: "normal", display: "attach" })]), say("Done.")]);
  assert.equal(t.events.find((e) => e.type === "sent").files[0].render, undefined);
  // A refused input: before any hook, Claude Code's words, a step naming the files.
  t = await job([say("", [call("send_user_file", { files: ["report.md", "gone.txt"], status: "normal" })]), say("Done.")]);
  assert.equal(t.sent.length, 0);
  assert.equal(t.told("c1"), "error: Attachment \"gone.txt\" does not exist. Current working directory: " + t.dir + ".");
  const step = t.events.find((e) => e.type === "bash" && e.id === "c1");
  assert.deepEqual([step.verb, step.command], ["Send", "report.md, gone.txt"]);
  // A file Coder's server refused, or one over the limit: named with why, not a failed call.
  t = await job([say("", [call("send_user_file", { files: ["chart.png"], status: "normal" })]), say("Done.")], { sendFile: async () => ({ error: SF.serverReturned(503) }) });
  assert.equal(t.told("c1"), "1 file could NOT be delivered to the user:\n  " + t.dir + "/chart.png (0.0 MiB): upload failed: server returned 503\nTell the user the file was not delivered and why. The failure may be temporary, so also tell the user they can ask you to send it again in a few minutes.");
  assert.ok(!t.events.some((e) => e.type === "sent"));
});

test("SF7 (2026-11-18) its permission, as Claude Code's: each file a read of its path (a Read deny rule on one refuses the call in its words; on the whole of Read, its own words); a rule on SendUserFile itself, or one of its inputs", async () => {
  let t = await job([say("", [call("send_user_file", { files: ["report.md", "chart.png"], status: "normal" })]), say("Done.")], { extra: { rules: { allow: [], ask: [], deny: ["Read(chart.png)"] } } });
  assert.equal(t.sent.length, 0);
  assert.equal(t.told("c1"), "File is in a directory that is denied by your permission settings.", "its Read deny's own words");
  t = await job([say("", [call("send_user_file", { files: ["report.md"], status: "normal" })]), say("Done.")], { extra: { rules: { allow: [], ask: [], deny: ["Read"] } } });
  assert.equal(t.told("c1"), "SendUserFile reads file contents; that action is disabled.");
  t = await job([say("", [call("send_user_file", { files: ["report.md"], status: "proactive" })]), say("Done.")], { extra: { rules: { allow: [], ask: [], deny: ["SendUserFile(status:proactive)"] } } });
  assert.equal(t.told("c1"), "Permission to use SendUserFile with status:proactive has been denied.");
  t = await job([say("", [call("send_user_file", { files: ["report.md"], status: "normal" })]), say("Done.")], { extra: { rules: { allow: [], ask: [], deny: ["SendUserFile(status:proactive)"] } } });
  assert.equal(t.sent.length, 1, "another value: it runs");
  t = await job([say("Nothing to do.")], { extra: { rules: { allow: [], ask: [], deny: ["SendUserFile"] } } });
  assert.ok(!names(t.seen[0]).includes("send_user_file"), "denied whole: not offered");
  // (An ask rule on a file's Read: the owner is asked; here no one can answer, so its ask is what Coder is told.)
  t = await job([say("", [call("send_user_file", { files: ["report.md"], status: "normal" })]), say("Done.")], { extra: { rules: { allow: [], ask: ["Read(report.md)"], deny: [] } } });
  assert.equal(t.sent.length, 0);
  assert.ok(String(t.told("c1")).length > 0);
  // (Its names in hooks and rules are Claude Code's; it runs beside other read-only calls.)
  assert.equal(H.ccTool("send_user_file"), "SendUserFile");
  const P = await import("../container/coder-parallel.mjs");
  assert.ok(P.SAFE_TOOLS.has("send_user_file"));
});

test("SF8 (2026-11-18) the page: each sent file a card with Download, what renders shown in place from its signed address and kept through redraws, the caption under them; the docs", () => {
  const js = readFileSync(HERE("public/coder.js"), "utf8");
  assert.match(js, /else if \(e\.type === 'sent'\) out\.push\(sentHTML\(e\)\);/);
  assert.match(js, /const SENT_PIC = \/\\\.\(png\|jpe\?g\|gif\|webp\|svg\)\$\/i, SENT_FRAME = \/\\\.\(pdf\|html\?\|txt\|log\|md\|csv\|json\|xml\)\$\/i;/);
  assert.match(js, /data-sent-get="' \+ esc\(f\.id\) \+ '"/);
  assert.match(js, /call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/sent\/' \+ encodeURIComponent\(id\) \+ '\/view'\)/);
  assert.match(js, /fr\.setAttribute\('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox'\)/);
  assert.match(js, /const sentKept = \[\.\.\.root\.querySelectorAll\('\.cd-sent-live\[data-sent-live\]'\)\]\.filter\(\(x\) => x\.firstChild\);/);
  assert.match(js, /send_user_file: 'Send file'/);
  const css = readFileSync(HERE("public/coder.css"), "utf8");
  assert.match(css, /\.cd-sent-live iframe \{ display: block; width: 100%; height: 420px;/);
  const docs = readFileSync(HERE("public/docs.html"), "utf8");
  assert.match(docs, /<h2>Sending you files<\/h2>/);
  assert.match(docs, /<code>send_user_file<\/code>/);
  // (Its numbers, the code's own.)
  assert.ok(docs.includes("up to <b>" + SF.limitWords(SF.SEND_FILE_MAX) + "</b> each"));
  assert.ok(docs.includes("up to <b>" + SENT.SENT_MAX + " files</b> and <b>" + SENT.SENT_TOTAL_MAX / 1024 ** 3 + " GB</b>"));
});
