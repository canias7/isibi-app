// FOUND BY THE OWNER'S "TEST IT ALL YOURSELF, ONE BY ONE" RUN (2026-11-08), each fixed and kept fixed here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HERE = (p) => new URL("../" + p, import.meta.url);
const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("CD202 a job started from GitHub is not offered the tools that never work there (undo, keys, environment changes, review comments as the owner, auto-fix on or off), and is told to say so at once; a chat job keeps them all; each still refuses in a GitHub job if called anyway", async () => {
  // Live test, issue #14 on the test repository: "@coder Undo the last job" got a question card (which
  // job?), and the answer then got "undo is not available in a job started from GitHub".
  const { runCoder, CODER_TOOLS, GITHUB_TOOLS, NOT_FROM_GITHUB, GITHUB_NOTE } = await import("../container/coder-agent.mjs");
  const names = (tools) => tools.map((t) => t.function.name);
  assert.deepEqual([...NOT_FROM_GITHUB].sort(), ["auto_fix", "pr_comments", "propose_env", "request_secret", "undo_last_job"]);
  assert.deepEqual(names(GITHUB_TOOLS), names(CODER_TOOLS).filter((n) => !NOT_FROM_GITHUB.includes(n)));
  for (const keep of ["ask_user", "reply_review", "pull_request", "review", "bash", "notify"]) assert.ok(names(GITHUB_TOOLS).includes(keep), keep + " stays (an auto-fix job may ask, and answers in a review thread)");
  for (const [github, tools, note] of [[true, GITHUB_TOOLS, true], [false, CODER_TOOLS, false]]) {
    const seen = [];
    await runCoder({ send: async (req) => { seen.push(req); return say("Done."); }, emit: () => {}, exec: async () => ({ code: 0, output: "" }) }, { text: "Undo the last job", github });
    assert.deepEqual(names(seen[0].tools), names(tools));
    assert.equal(seen[0].messages[0].content.includes(GITHUB_NOTE), note);
  }
  assert.match(GITHUB_NOTE, /undoing a job, asking for a key, changing the environment, posting review comments as the owner, and turning auto-fix on or off[\s\S]*say at once[\s\S]*gofarther\.dev[\s\S]*do not ask questions about it first/);
  // Called anyway (a model may still try): refused, as before.
  const events = [];
  let n = 0;
  const steps = [say("", [call("undo_last_job", { confirmed: true }, "u1"), call("request_secret", { host: "api.stripe.com", reason: "x" }, "k1"), call("propose_env", { kind: "allow_host", host: "a.com", reason: "x" }, "p1"), call("pr_comments", { comments: [{ path: "a.js", line: 1, body: "x" }] }, "c1"), call("auto_fix", { pr: "3" }, "f1")]), say("Done.")];
  const out = await runCoder({ send: async () => steps[Math.min(n++, 1)], emit: (e) => events.push(e), exec: async () => ({ code: 0, output: "" }) }, { text: "x", github: true });
  assert.ok(!out.undoRequest && !out.reviewPost && !out.autofixRequest, "nothing asked for");
  const tool = out.messages.filter((m) => m.role === "tool").map((m) => m.content);
  assert.equal(tool.length, 5);
  assert.ok(tool.every((t) => /^error: .*GitHub/.test(t)), JSON.stringify(tool));
});

test("CD203 each chat keeps its own message box: what was typed, its pictures and its line comments stay with that chat when another is opened, and come back with it; a chat opened for the first time starts empty; the landing page's ask goes to the first chat opened", () => {
  // Live test (recorded, 4b): a message that could not be sent in one chat was still in the box after
  // opening another chat, with its pictures and comments, and would have gone there.
  const ui = readFileSync(HERE("public/coder.js"), "utf8");
  const start = ui.indexOf("  function keepDraft(");
  const end = ui.indexOf("\n  }\n", start) + 4;
  const { keepDraft } = new Function(ui.slice(start, end) + "\nreturn { keepDraft };")();
  const S = { drafts: {}, draft: "The landing page's ask", pics: [], comments: [], mention: null };
  keepDraft(S, null, "a");
  assert.equal(S.draft, "The landing page's ask", "the first chat opened gets the landing page's ask");
  S.draft = "Fix the cart total"; S.pics = [{ name: "shot.png" }]; S.comments = [{ path: "cart.js", line: 3, text: "here" }]; S.mention = { at: 2 };
  keepDraft(S, "a", "b");
  assert.deepEqual([S.draft, S.pics, S.comments, S.mention], ["", [], [], null], "another chat starts empty");
  S.draft = "Something for b";
  keepDraft(S, "b", "a");
  assert.deepEqual([S.draft, S.pics, S.comments], ["Fix the cart total", [{ name: "shot.png" }], [{ path: "cart.js", line: 3, text: "here" }]], "chat a's box is back");
  keepDraft(S, "a", "a");
  assert.equal(S.draft, "Fix the cart total", "opening the same chat again changes nothing");
  keepDraft(S, "a", "b");
  assert.equal(S.draft, "Something for b");
  assert.deepEqual(Object.keys(S.drafts), ["a"], "only the chats not open are kept aside");
  // Wired in: opening a chat goes through it, and a removed chat's box is dropped.
  assert.match(ui, /async function openProject\(id\) \{\n    stopPoll\(\);\n    keepDraft\(S, S\.project && S\.project\.id, id\);/);
  assert.match(ui, /delete S\.drafts\[id\];/);
});

test("CD204 read gives about 100,000 characters of whole lines a call, like Claude Code's Read (\"at most 25,000 tokens\"): a whole file that fits comes whole; a longer one (under 256 KB) gives its first part as a PARTIAL view saying how to read more, and the parts join up exactly; the agent never cuts a read, while other tools' output is still cut", async () => {
  // Tool-by-tool comparison with Claude Code (2026-11-08): Coder's read gave 400 lines, then its answer was cut to
  // 12,000 characters with the middle dropped, so line 250 of a 500-line file was not shown.
  const { execFileSync } = await import("node:child_process");
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { READ_CHARS } = await import("../container/coder-tools.mjs");
  const dir = await mkdtemp(join(tmpdir(), "coder-read-"));
  const script = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const read = (args) => execFileSync("node", ["--no-warnings", script, Buffer.from(JSON.stringify({ tool: "read", args })).toString("base64")], { cwd: dir, maxBuffer: 8 << 20 }).toString();
  const num = (n) => 100000 + ((n * 7919) % 900000);
  await writeFile(join(dir, "long.txt"), Array.from({ length: 500 }, (_, i) => "line " + (i + 1) + ": " + num(i + 1) + " " + "x".repeat(60)).join("\n") + "\n");
  const whole = read({ path: "long.txt" });
  assert.ok(whole.includes("   250\tline 250: " + num(250) + " "), "line 250 is there");
  assert.ok(whole.endsWith("   500\tline 500: " + num(500) + " " + "x".repeat(60)), "and the last line, with no blank line after the file's last newline");
  assert.doesNotMatch(whole, /PARTIAL|read more|characters not shown/);
  // About 200 KB: a PARTIAL view, then parts asked for with offset and limit, which join up exactly.
  await writeFile(join(dir, "mid.txt"), Array.from({ length: 2000 }, (_, i) => "row " + (i + 1) + " " + "y".repeat(92)).join("\n"));
  const first = read({ path: "mid.txt" });
  const pm = /\n\[PARTIAL view: lines 1-(\d+) of 2000 \(about \d+ KB of \d+ KB\)\. Read more with offset (\d+) and limit (\d+)\]$/.exec(first);
  assert.ok(pm, first.slice(-200));
  assert.equal(Number(pm[2]), Number(pm[1]) + 1);
  let body = first.slice(0, pm.index), offset = 1, seen = 0, parts = 0, limit = Number(pm[3]);
  for (;;) {
    assert.ok(body.length <= READ_CHARS, "part " + parts + " is " + body.length + " characters");
    const rows = body.split("\n");
    assert.equal(Number(rows[0].split("\t")[0]), offset, "a part starts where the last one stopped");
    rows.forEach((r, i) => assert.equal(r, String(offset + i).padStart(6) + "\trow " + (offset + i) + " " + "y".repeat(92), "whole lines only"));
    seen += rows.length; parts++;
    if (seen >= 2000) break;
    offset = seen + 1;
    const out = read({ path: "mid.txt", offset, limit }); // what the last notice said: it fits, exactly
    const m = /\n\[lines \d+-\d+ of 2000; read more with offset (\d+) and limit (\d+)\]$/.exec(out);
    body = m ? out.slice(0, m.index) : out;
    if (m) { assert.equal(Number(m[1]), offset + body.split("\n").length); limit = Number(m[2]); }
  }
  assert.equal(seen, 2000); assert.ok(parts >= 2 && parts <= 3, parts + " parts");
  assert.match(read({ path: "mid.txt", offset: 5, limit: 10 }), /^\s+5\trow 5 [\s\S]*\n\s+14\trow 14 y+\n\[lines 5-14 of 2000; read more with offset 15 and limit \d+\]$/, "limit asks for fewer lines");
  // In the agent: a read of about 60,000 characters reaches Grok whole; a command's output is still cut.
  const { runCoder, CODER_TOOLS } = await import("../container/coder-agent.mjs");
  const big = Array.from({ length: 600 }, (_, i) => String(i + 1).padStart(6) + "\tline " + (i + 1) + " " + "z".repeat(90)).join("\n");
  let n = 0;
  const steps = [say("", [call("read", { path: "big.txt" }, "r1"), call("bash", { command: "cat big.txt" }, "b1")]), say("Done.")];
  const out = await runCoder({ send: async () => steps[Math.min(n++, 1)], emit: () => {}, exec: async () => ({ code: 0, output: big }) }, { text: "read it" });
  const result = (id) => out.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
  assert.ok(result("r1").includes("   300\tline 300 ") && !/characters not shown/.test(result("r1")), "the read is whole");
  assert.match(result("b1"), /characters not shown/, "a command's long output is still cut, as before");
  assert.match(JSON.stringify(CODER_TOOLS.find((t) => t.function.name === "read")), /up to about 100,000 characters a call: a longer file gives its first part \(PARTIAL view\) and how to read more with offset and limit; a whole file over 256 KB is refused \(read a part, or grep\); allow_large reads all of it/);
});

test("CD205 the rest of Claude Code's Read rules: an empty file and an offset past the end say so; a whole file over 256 KB, or a part asked for that does not fit, is refused with what to do instead; allow_large reads it all in one call, sized by Coder (never by Grok) to the room left in the job; pictures up to 128 MB; a notebook over 256 KB is an error with how to read some of its cells", async () => {
  // The owner, 2026-11-08: "Double check it against claude code docs before going to the next one".
  const { execFileSync } = await import("node:child_process");
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const T = await import("../container/coder-tools.mjs");
  assert.deepEqual([T.READ_WHOLE_MAX, T.READ_LARGE_CHARS, T.PIC_MAX_BYTES, T.NOTEBOOK_MAX_BYTES, T.NOTEBOOK_CELLS_MAX], [256 * 1024, 400000, 128 * 1048576, 100 * 1048576, 256 * 1024]);
  const dir = await mkdtemp(join(tmpdir(), "coder-read2-"));
  const script = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const read = (args) => { try { return execFileSync("node", ["--no-warnings", script, Buffer.from(JSON.stringify({ tool: "read", args })).toString("base64")], { cwd: dir, maxBuffer: 8 << 20 }).toString(); } catch (e) { return "FAILED " + String(e.stdout || e.stderr || e.message); } };
  await writeFile(join(dir, "empty.txt"), "");
  assert.equal(read({ path: "empty.txt" }), "empty.txt exists, but it is empty.");
  await writeFile(join(dir, "two.txt"), "a\nb\n");
  assert.equal(read({ path: "two.txt" }), "     1\ta\n     2\tb", "the last newline makes no extra line");
  assert.equal(read({ path: "two.txt", offset: 9 }), "two.txt has 2 lines: offset 9 is past its end.");
  // Over 256 KB: a whole read is refused, with what to do instead.
  await writeFile(join(dir, "big.txt"), Array.from({ length: 3000 }, (_, i) => "row " + (i + 1) + " " + "y".repeat(92)).join("\n"));
  assert.match(read({ path: "big.txt" }), /^FAILED [\s\S]*big\.txt is 29\d KB, over the 256 KB a whole read takes: read a part with offset and limit, search it with grep, or set allow_large/);
  assert.match(read({ path: "big.txt", offset: 1, limit: 3000 }), /^FAILED [\s\S]*lines 1-3000 of big\.txt come to more than about 100,000 characters: ask for fewer lines \(limit\), search with grep, or set allow_large/, "a part asked for that does not fit");
  assert.match(read({ path: "big.txt", offset: 2990, limit: 5 }), /^\s+2990\trow 2990 [\s\S]*\n\[lines 2990-2994 of 3000; read more with offset 2995 and limit 6\]$/, "a part that fits");
  // allow_large: the whole file in one call when Coder gives the room; without room, the usual size, as a PARTIAL view.
  const all = read({ path: "big.txt", allow_large: true, max_chars: 400000 });
  assert.ok(all.endsWith("  3000\trow 3000 " + "y".repeat(92)) && !/PARTIAL/.test(all), "all 3000 lines in one call");
  assert.match(read({ path: "big.txt", allow_large: true }), /\n\[PARTIAL view: lines 1-\d+ of 3000/);
  await writeFile(join(dir, "huge.txt"), Array.from({ length: 5000 }, (_, i) => "row " + (i + 1) + " " + "y".repeat(92)).join("\n"));
  const most = read({ path: "huge.txt", allow_large: true, max_chars: 99999999 });
  const hm = /\n\[PARTIAL view: lines 1-(\d+) of 5000 [^\n]*\]$/.exec(most);
  assert.ok(hm && most.slice(0, hm.index).length <= T.READ_LARGE_CHARS && Number(hm[1]) > 3500, "never more than READ_LARGE_CHARS in one call, however much room is claimed");
  // Coder's agent sets max_chars for an allow_large read (the room left), and drops one Grok tries to set itself.
  const { runCoder, COMPACT_AT } = await import("../container/coder-agent.mjs");
  const sentArgs = [];
  let n = 0;
  const steps = [say("", [call("read", { path: "big.txt", max_chars: 999999 }, "r1"), call("read", { path: "big.txt", allow_large: true }, "r2")]), say("Done.")];
  await runCoder({ send: async () => steps[Math.min(n++, 1)], emit: () => {}, exec: async ({ command }) => { const b = command.split(" ").pop(); if (!b.startsWith("@")) sentArgs.push(JSON.parse(Buffer.from(b, "base64").toString()).args); return { code: 0, output: "ok" }; } }, { text: "read big.txt" });
  assert.equal(sentArgs[0].max_chars, undefined, "Grok cannot size its own read");
  assert.ok(sentArgs[1].max_chars > 0 && sentArgs[1].max_chars < COMPACT_AT, "Coder sizes an allow_large read to the room left: " + sentArgs[1].max_chars);
  // A notebook whose cells come to over 256 KB: an error, with how to read some of its cells.
  await writeFile(join(dir, "nb.ipynb"), JSON.stringify({ cells: [{ cell_type: "code", source: "print(1)", outputs: [{ output_type: "stream", name: "stdout", text: "z".repeat(300 * 1024) }] }], metadata: {}, nbformat: 4, nbformat_minor: 5 }));
  assert.match(read({ path: "nb.ipynb" }), /^FAILED [\s\S]*nb\.ipynb's cells come to 30\d KB, more than one read takes: read some of its cells with bash, e.g\. jq '\.cells\[0:10\]' nb\.ipynb/);
  // A picture over 20 MB (the old limit) is read now: made smaller, as Claude Code does (when ImageMagick is here).
  let hasConvert = true; try { execFileSync("convert", ["-version"]); } catch { hasConvert = false; }
  if (hasConvert) {
    execFileSync("convert", ["-size", "2700x2700", "xc:red", join(dir, "big.bmp")]);
    assert.match(read({ path: "big.bmp" }), /^\u0000coder-pictures\u0000[\s\S]*Picture: big\.bmp \(\d+×\d+, BMP, 2\d\.\d MB\)/);
  }
});
