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
  const asked = [];
  await runCoder({ send: async (q) => { asked.push(q); return steps[Math.min(n++, 1)]; }, emit: () => {}, exec: async () => ({ code: 0, output: big }) }, { text: "read it" });
  // What Grok gets (the saved chat keeps long answers shorter: CD217).
  const result = (id) => asked[1].messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
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

test("CD206 every PDF page reaches Grok as a picture: Coder's machine passes a file tool's answer of up to 8 MB (a command's output still 1 MB), the agent takes up to 20 pictures a read and keeps the newest 24 in a job", async () => {
  // The owner, 2026-11-08: "Yes fix that too" (Claude Code's Read draws every PDF page with pdftoppm; Coder drew only
  // pages with no text, and its machine passed 1 MB of a tool's answer, the agent 6 pictures a read, 8 a job).
  const { execIn, TOOL_OUTPUT_MAX } = await import("../container/server.mjs");
  const { mkdtemp, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  assert.equal(TOOL_OUTPUT_MAX, 8 * 1024 * 1024);
  const dir = await mkdtemp(join(tmpdir(), "coder-out-"));
  const cmd = "head -c 3000000 /dev/zero | tr '\\0' a";
  const plain = await execIn(dir, cmd, 60, { kill: true });
  assert.ok(plain.output.length < 1.2e6 && plain.output.endsWith("\n[output cut at 1 MB]"), "a command: 1 MB, as before");
  const tool = await execIn(dir, cmd, 60, { kill: true, outMax: TOOL_OUTPUT_MAX });
  assert.equal(tool.output.length, 3_000_000, "a file tool's answer: all 3 MB");
  const server = await readFile(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /\.\.\.\(tool \? \{ outMax: TOOL_OUTPUT_MAX \} : \{\}\)/, "the job's file tools get it");
  // The agent: 20 pictures from one read reach Grok, all of them.
  const { runCoder, PICS_PER_READ, PICS_KEEP } = await import("../container/coder-agent.mjs");
  const { PICS_MARK } = await import("../container/coder-tools.mjs");
  assert.deepEqual([PICS_PER_READ, PICS_KEEP], [20, 24]);
  const pics = Array.from({ length: 20 }, (_, i) => ({ type: "image/png", data: Buffer.from("page-" + i).toString("base64") }));
  const seen = [];
  const steps = [say("", [call("read", { path: "doc.pdf", pages: "1-20" }, "r1")]), say("Done.")];
  await runCoder({ send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); return steps[Math.min(seen.length - 1, 1)]; }, emit: () => {}, exec: async () => ({ code: 0, output: PICS_MARK + JSON.stringify({ text: "doc.pdf: PDF, 20 pages", pictures: pics }) }) }, { text: "read the PDF" });
  const note = seen[1].messages.find((m) => Array.isArray(m.images));
  assert.equal(note.images.length, 20, "all 20 pages reach Grok");
});

test("CD207 read refuses a pipe or a device at once, as Claude Code's Read does (\"is a pipe or a device\"), instead of waiting on it until the time limit", async () => {
  const { execFileSync } = await import("node:child_process");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "coder-fifo-"));
  execFileSync("mkfifo", [join(dir, "pipe.txt")]);
  const script = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const t0 = Date.now();
  let out = "";
  try { execFileSync("node", ["--no-warnings", script, Buffer.from(JSON.stringify({ tool: "read", args: { path: "pipe.txt" } })).toString("base64")], { cwd: dir, timeout: 10000 }); } catch (e) { out = String(e.stdout || ""); }
  assert.match(out, /pipe\.txt is a pipe or a device, not a file; it cannot be read/);
  assert.ok(Date.now() - t0 < 5000, "at once, not after a wait");
});

test("CD208 Claude Code's other reading rules (its memory, tools and errors docs, read a second time at the owner's word): a command that views one file counts as reading it, so its folder's instructions load; they load again after a long job is summarized; a folder's instruction file is taken up to 40,000 characters, with a note to read the rest; a password-protected PDF says so", async () => {
  const { execFileSync } = await import("node:child_process");
  const { mkdtemp, writeFile, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { runCoder, viewedFile } = await import("../container/coder-agent.mjs");
  // Which commands count as viewing one file (Claude Code's list: cat, nl, bat, batcat, head, tail, sed -n 'X,Yp', grep,
  // egrep, fgrep, rg, on one file, with no pipes or redirects).
  for (const [c, f] of [["cat src/a.js", "src/a.js"], ["nl a.js", "a.js"], ["head -n 20 src/a.js", "src/a.js"], ["tail -5 'my file.txt'", "my file.txt"], ["sed -n '1,20p' a.js", "a.js"], ["grep -n foo src/a.js", "src/a.js"], ["rg -i foo a.js", "a.js"], ["batcat a.js", "a.js"]]) assert.equal(viewedFile(c), f, c);
  for (const c of ["cat a.js | grep x", "cat a b", "grep foo", "ls src", "cat $X", "echo hi > a", "cat a.js && cat b.js", "sed 's/a/b/' a.js", "python3 a.py"]) assert.equal(viewedFile(c), "", c);
  // In the agent: `cat src/a.js` brings src/'s instructions with its output; a pipe, or a failed command, does not.
  const asked = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "cat src/a.js" }, "b1"), call("bash", { command: "cat src/a.js | wc -l" }, "b2"), call("bash", { command: "cat src/missing.js" }, "b3")]), say("Done.")];
  const out = await runCoder({ send: async () => steps[Math.min(n++, 1)], emit: () => {}, exec: async ({ command }) => (command.includes("missing") ? { code: 1, output: "No such file" } : { code: 0, output: "const a = 1;\n" }), afterFile: async (x) => { asked.push(x); return "THE REPO'S INSTRUCTIONS FOR THIS FILE: src/CODER.md"; } }, { text: "look" });
  const result = (id) => out.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
  assert.deepEqual(asked, [{ tool: "read", args: { path: "src/a.js" } }]);
  assert.match(result("b1"), /exit code 0\nconst a = 1;\n\n\nTHE REPO'S INSTRUCTIONS FOR THIS FILE: src\/CODER\.md$/);
  assert.doesNotMatch(result("b2") + result("b3"), /INSTRUCTIONS/);
  // A long job summarized: the service is told, so the instructions it had shown load again when needed.
  let compacted = 0, k = 0;
  const big = "z".repeat(900);
  await runCoder({ compactAt: 4000, compacted: () => { compacted++; }, send: async (q) => { if (!q.tools || !q.tools.length) return say("SUMMARY of the earlier steps"); k++; return k <= 14 ? say("", [call("bash", { command: "echo " + k }, "c" + k)]) : say("Done."); }, emit: () => {}, exec: async () => ({ code: 0, output: big }) }, { text: "go" });
  assert.ok(compacted >= 1, "the service heard of the summary " + compacted + " times");
  const { repoInstructions, laterNotes, NOTE_ONE_MAX } = await import("../container/server.mjs");
  assert.equal(NOTE_ONE_MAX, 40000);
  const dir = await mkdtemp(join(tmpdir(), "coder-notes-"));
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src", "CODER.md"), Array.from({ length: 1000 }, (_, i) => "Rule " + (i + 1) + ": " + "w".repeat(45)).join("\n"));
  const ins = await repoInstructions(dir);
  const sub = ins.later.find((x) => x.name === "src/CODER.md");
  assert.ok(sub && sub.cut === true && sub.text.length === NOTE_ONE_MAX, "taken up to 40,000 characters, and marked");
  const shown = laterNotes(ins.later, dir, "src/a.js", new Set());
  assert.match(shown, /src\/CODER\.md goes on past 40,000 characters: read the rest of it with the read tool, from line 7\d\d\]/);
  // A password-protected PDF (made with pypdf, when this machine has it).
  let pypdf = true; try { execFileSync("python3", ["-c", "import pypdf"]); } catch { pypdf = false; }
  if (pypdf) {
    execFileSync("python3", ["-c", "import pypdf, sys\nw = pypdf.PdfWriter()\nw.add_blank_page(612, 792)\nw.encrypt('secret')\nw.write(sys.argv[1])", join(dir, "locked.pdf")]);
    const script = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
    let msg = "";
    try { execFileSync("node", ["--no-warnings", script, Buffer.from(JSON.stringify({ tool: "read", args: { path: "locked.pdf" } })).toString("base64")], { cwd: dir }); } catch (e) { msg = String(e.stdout || ""); }
    assert.match(msg, /locked\.pdf is password protected; it cannot be read without its password/);
  }
});

// THE OWNER'S "Yea add all of that and go look at the docs again pls" (2026-11-08), after the second pass over Claude
// Code's docs for read: @-mentions, the re-read after a summary, and the instruction files at the start.
const toolsScript = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
/** Coder's machine as tests run it: the file tools for real, in `dir`; any other command answered by `other`. */
const machine = (dir, other = () => ({ code: 0, output: "ok" }), env = process.env) => async ({ command }) => {
  const { execSync } = await import("node:child_process");
  if (!command.startsWith("node --no-warnings " + toolsScript + " ")) return other(command);
  try { return { code: 0, output: execSync(command, { cwd: dir, encoding: "utf8", maxBuffer: 16 << 20, env }) }; } catch (e) { return { code: Number.isInteger(e.status) ? e.status : 1, output: String(e.stdout || "") }; }
};

test("CD209 @-mentioned files go into the message, like Claude Code's @ (\"includes the content of the file in the conversation when it fits the Read tool's token limit\"): a file whole with its folder's instructions, a picture shown, a folder as its listing; a file too big for one read is named, not included; a path that is not a file (a package name) is left alone; never in a job from GitHub; the note is the app's, not the owner's, when a long chat is summarized", async () => {
  const { runCoder, mentionedPaths, MENTIONS_MAX } = await import("../container/coder-agent.mjs");
  const { turnCut, transcriptText, isAppNote } = await import("../container/coder-compact.mjs");
  const { fileMentions } = await import("../src/coder-routes.mjs");
  const { execFileSync } = await import("node:child_process");
  const { mkdtemp, writeFile, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  // Coder's machine and the Worker find the same paths; "@src/" is a folder; a trailing full stop is not part of one.
  const ask = "look at @src/app.js, @shot.png and @src/ then @big.log and @mid.txt. Also npm i @types/node, mail me@x.y, and @../etc/passwd";
  assert.deepEqual(mentionedPaths(ask), ["src/app.js", "shot.png", "src/", "big.log", "mid.txt", "types/node"]);
  assert.equal(fileMentions(ask), "\n\n(The owner pointed at these files: src/app.js, shot.png, src/, big.log, mid.txt, types/node.)");
  assert.equal(mentionedPaths(Array.from({ length: 15 }, (_, i) => "@f" + i + ".js").join(" ")).length, MENTIONS_MAX);
  // Real paths with ( ) [ ] (Next.js routes); a plain word (a person on GitHub, @coder) is not a path.
  const next = "see @app/(auth)/login/page.tsx, @pages/[id].tsx and @node_modules/@types/node/index.d.ts (and @lib/), hi @coder";
  assert.deepEqual(mentionedPaths(next), ["app/(auth)/login/page.tsx", "pages/[id].tsx", "node_modules/@types/node/index.d.ts", "lib/"]);
  assert.equal(fileMentions(next), "\n\n(The owner pointed at these files: app/(auth)/login/page.tsx, pages/[id].tsx, node_modules/@types/node/index.d.ts, lib/.)");
  const dir = await mkdtemp(join(tmpdir(), "coder-at-"));
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src", "app.js"), "const a = 1;\nexport default a;\n");
  await writeFile(join(dir, "src", "util.js"), "x\n");
  await writeFile(join(dir, "big.log"), "z".repeat(300 * 1024));
  await writeFile(join(dir, "mid.txt"), Array.from({ length: 2000 }, (_, i) => "row " + i + " " + "y".repeat(92)).join("\n"));
  execFileSync("convert", ["-size", "64x64", "xc:red", join(dir, "shot.png")]);
  const events = [], seen = [], asked = [];
  const deps = { send: async (q) => { seen.push(q); return say("Done."); }, emit: (e) => events.push(e), exec: machine(dir), afterFile: async (x) => { asked.push(x); return "THE REPO'S INSTRUCTIONS FOR THIS FILE: src/CODER.md: use semicolons"; } };
  const out = await runCoder(deps, { text: ask + fileMentions(ask), shown: ask });
  const msgs = seen[0].messages;
  assert.equal(msgs.length, 3, "Coder's rules, the owner's message, the note with their files");
  assert.equal(msgs[1].content, (ask + fileMentions(ask)).trim(), "the owner's message is as they wrote it");
  const note = msgs[2];
  assert.equal(note.role, "user");
  assert.equal(note.appNote, true);
  assert.match(note.content, /^\(Note from Coder's app, not the owner: the files the owner @-mentioned, read into their message for you, as Claude Code does; the pictures of shot\.png are attached here, in order\./);
  assert.ok(note.content.includes("--- src/app.js ---\n     1\tconst a = 1;\n     2\texport default a;\n\nTHE REPO'S INSTRUCTIONS FOR THIS FILE: src/CODER.md: use semicolons"), "the file whole, with its folder's instructions");
  assert.match(note.content, /--- shot\.png ---\n/);
  assert.equal(note.images.length, 1, "the picture is shown");
  assert.match(note.images[0], /^data:image\/png;base64,/);
  assert.equal(note.readPics, true, "and let go like a read's pictures when newer ones need the room");
  assert.ok(note.content.includes("--- src/ (a folder: what is in it) ---\napp.js\nutil.js"), "a folder as its listing, not its contents");
  assert.match(note.content, /--- big\.log: not included \(big\.log is 300 KB[^\n]*256 KB[^\n]*\)\. Read it yourself with the read tool if you need it ---/);
  assert.match(note.content, /--- mid\.txt: not included \(longer than one read gives \(about 100,000 characters\)\)\. Read it yourself with the read tool \(offset and limit\) ---/);
  assert.ok(!note.content.includes("types/node") && !note.content.includes("passwd"), "not files of the project: left alone");
  assert.deepEqual(asked, [{ tool: "read", args: { path: "src/app.js" } }, { tool: "read", args: { path: "shot.png" } }]);
  // Each shows in the chat as a step, after the owner's message.
  const steps = events.filter((e) => e.type === "bash").map((e) => e.command);
  assert.deepEqual(steps, ["src/app.js (@-mentioned)", "shot.png (@-mentioned)", "src/ (@-mentioned)", "big.log (@-mentioned)", "mid.txt (@-mentioned)"]);
  assert.equal(events[0].type, "user");
  assert.equal(events[0].text, ask);
  // The saved history keeps the mark, and a note in place of the picture.
  assert.equal(out.messages[1].appNote, true);
  assert.match(out.messages[1].content, /\n\[1 picture attached\]$/);
  // A long chat summarized between jobs: the note is not counted as one of the owner's messages, and is called the app's.
  const hist = [{ role: "user", content: "ask 1" }, { role: "assistant", content: "a" }, out.messages[1], { role: "assistant", content: "b" }, { role: "user", content: "ask 2" }, { role: "assistant", content: "c" }, { role: "user", content: "ask 3" }, { role: "assistant", content: "d" }];
  assert.equal(isAppNote(hist[2]), true);
  assert.equal(turnCut(hist, 3), -1, "three messages of the owner's, not four");
  assert.match(transcriptText(hist), /NOTE FROM CODER'S APP: \(Note from Coder's app/);
  assert.doesNotMatch(transcriptText(hist), /OWNER: \(Note from Coder's app/);
  // From GitHub (strangers write there): nothing is read for a mention.
  const ran = [];
  const seen2 = [];
  await runCoder({ send: async (q) => { seen2.push(q); return say("Done."); }, emit: () => {}, exec: async (x) => { ran.push(x.command); return { code: 0, output: "" }; } }, { text: "@coder look at @src/app.js", github: true });
  assert.equal(ran.length, 0);
  assert.equal(seen2[0].messages.length, 2);
});

test("CD210 after a long job is summarized, the files it was working on are read again, like Claude Code (up to five, the most recently changed first; one over 5,000 tokens comes back as its name only, a \"Referenced file\"): not the ones its kept steps read already, nor pictures, nor files gone; they go with the summary, and show as steps", async () => {
  const { runCoder, rereadFiles, REREAD_FILES, REREAD_ONE } = await import("../container/coder-agent.mjs");
  const { isSummary } = await import("../container/coder-compact.mjs");
  const { mkdtemp, writeFile, utimes } = await import("node:fs/promises");
  const { execFileSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  assert.equal(REREAD_FILES, 5);
  assert.equal(REREAD_ONE, 20000);
  const dir = await mkdtemp(join(tmpdir(), "coder-reread-"));
  const t0 = Date.now() / 1000 - 3600;
  for (const [f, text, age] of [["a.js", "const a = 1;\n", 3], ["b.js", "const b = 2;\n", 1], ["big.js", Array.from({ length: 400 }, (_, i) => "// line " + i + " " + "x".repeat(70)).join("\n") + "\n", 2], ["c.js", "c\n", 0], ["e.js", "e\n", 0], ["f.js", "f\n", 0]]) { await writeFile(join(dir, f), text); await utimes(join(dir, f), t0 + age, t0 + age); }
  const plan = [
    call("read", { path: "a.js" }, "r1"), call("read", { path: "./big.js" }, "r2"), call("read", { path: "b.js" }, "r3"), call("write", { path: "d.js", content: "export const d = 4;\n" }, "w4"),
    call("read", { path: "c.js" }, "r5"), call("bash", { command: "cat e.js" }, "b6"), call("read", { path: "f.js" }, "r7"),
    ...[8, 9, 10, 11, 12].map((k) => call("bash", { command: "echo " + k }, "b" + k)),
  ];
  let k = 0, summarized = false;
  const events = [], seen = [];
  const deps = {
    // Summarize exactly once, before the 13th round (12 rounds done: the first 4 are summarized, the newest 8 kept: they
    // come to under 40% of this room, as they would in a real job's 450,000).
    get compactAt() { return k === 12 && !summarized ? 20_000 : 10_000_000; },
    send: async (q) => {
      if (!q.tools || !q.tools.length) { summarized = true; return say("SUMMARY of the earlier steps"); }
      seen.push(q); k++;
      return k <= plan.length ? say("", [plan[k - 1]]) : say("Done.");
    },
    emit: (e) => events.push(e),
    exec: machine(dir, (command) => ({ code: 0, output: command === "cat e.js" ? "e\n" : "ok" })),
  };
  await runCoder(deps, { text: "work on the files" });
  assert.equal(summarized, true);
  const last = seen.at(-1).messages;
  const sum = last[2];
  assert.ok(isSummary(sum), "the summary stands after the owner's message");
  const again = sum.content.slice(sum.content.indexOf("\n\n(Like Claude Code after a summary"));
  assert.match(again, /^\n\n\(Like Claude Code after a summary: the files you were working on, read again just now as they are now, the most recently changed first\.\)\n\n/);
  // d.js (written in the job: the newest), then a.js, big.js, b.js by their times; c, e and f were read by the kept steps.
  const order = ["--- d.js ---\n     1\texport const d = 4;", "--- a.js ---\n     1\tconst a = 1;", "Referenced file big.js (over 20,000 characters, so not shown again here: read it again if you need it)", "--- b.js ---\n     1\tconst b = 2;"];
  let at = -1;
  for (const o of order) { const i = again.indexOf(o); assert.ok(i > at, "in order: " + o); at = i; }
  for (const f of ["c.js", "e.js", "f.js"]) assert.ok(!again.includes(f), f + " is in the kept steps already");
  assert.ok(!again.includes("x".repeat(70)), "the big one is only named");
  const shown = events.filter((e) => e.type === "bash" && / \(again, after the summary\)$/.test(e.command)).map((e) => e.command);
  assert.deepEqual(shown, ["d.js (again, after the summary)", "a.js (again, after the summary)", "big.js (again, after the summary)", "b.js (again, after the summary)"]);
  // At most five; pictures and files that are gone are not read again.
  const dir2 = await mkdtemp(join(tmpdir(), "coder-reread-"));
  const touched = new Map();
  for (let i = 1; i <= 7; i++) { await writeFile(join(dir2, "f" + i + ".js"), "file " + i + "\n"); await utimes(join(dir2, "f" + i + ".js"), t0 + i, t0 + i); touched.set("f" + i + ".js", i); }
  execFileSync("convert", ["-size", "8x8", "xc:blue", join(dir2, "pic.png")]);
  touched.set("pic.png", 8); touched.set("gone.js", 9);
  const text = await rereadFiles({ exec: machine(dir2) }, [], touched);
  const named = [...text.matchAll(/^--- (\S+) ---$/gm)].map((m) => m[1]);
  assert.deepEqual(named, ["f7.js", "f6.js", "f5.js", "f4.js", "f3.js"]);
  assert.equal(await rereadFiles({ exec: machine(dir2) }, [], new Map()), "", "nothing touched, nothing read");
});

test("CD211 the repository's instructions at the start: up to 100,000 characters in all (Claude Code loads each CLAUDE.md whole; 20,000 before), and past that a file is named with a note to read the rest, never cut without a word", async () => {
  const { repoInstructions, NOTES_MAX, NOTE_ONE_MAX } = await import("../container/server.mjs");
  const { mkdtemp, writeFile, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  assert.equal(NOTES_MAX, 100000);
  const dir = await mkdtemp(join(tmpdir(), "coder-start-"));
  await mkdir(join(dir, ".coder", "rules"), { recursive: true });
  const lines = (n, w) => Array.from({ length: n }, (_, i) => "Rule " + (i + 1) + ": " + "w".repeat(w)).join("\n");
  await writeFile(join(dir, "CODER.md"), lines(500, 52)); // about 30,000 characters
  await writeFile(join(dir, ".coder", "CODER.md"), lines(1300, 52)); // about 78,000
  await writeFile(join(dir, ".coder", "rules", "style.md"), "Use tabs.");
  const ins = await repoInstructions(dir);
  const by = Object.fromEntries(ins.notes.map((n) => [n.name, n.text]));
  assert.equal(by["CODER.md"], lines(500, 52), "the first whole");
  const second = by[".coder/CODER.md"];
  const kept = NOTES_MAX - lines(500, 52).length;
  assert.equal(second.slice(0, kept), lines(1300, 52).slice(0, kept), "the second up to the limit");
  assert.match(second.slice(kept), /^\n\[\.coder\/CODER\.md goes on: read the rest of it with the read tool, from line \d+\]$/);
  const from = Number(/from line (\d+)/.exec(second)[1]);
  assert.ok(lines(1300, 52).split("\n").slice(0, from - 1).join("\n").length <= kept && lines(1300, 52).split("\n").slice(0, from).join("\n").length > kept, "the line it stopped in");
  assert.equal(by[".coder/rules/style.md"], "[Not loaded here: the repository's instructions already come to 100,000 characters. Read .coder/rules/style.md with the read tool.]");
  // A rule file over 40,000 characters says so too (it was cut without a word).
  const dir2 = await mkdtemp(join(tmpdir(), "coder-start-"));
  await mkdir(join(dir2, ".coder", "rules"), { recursive: true });
  await writeFile(join(dir2, ".coder", "rules", "long.md"), lines(900, 52));
  const ins2 = await repoInstructions(dir2);
  const long = ins2.notes.find((n) => n.name === ".coder/rules/long.md").text;
  assert.ok(long.startsWith(lines(900, 52).slice(0, NOTE_ONE_MAX - 100)));
  assert.match(long, /\n\[\.coder\/rules\/long\.md goes on past 40,000 characters: read the rest of it with the read tool\]$/);
});

test("CD212 the file tools refuse a null byte in a path or a pattern as Claude Code's do (\"cannot contain null bytes (\\0). Remove the null byte and try again.\"); a file that is not a PDF says it is not a valid PDF", async () => {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "coder-nul-"));
  await writeFile(join(dir, "a.txt"), "hi\n");
  await writeFile(join(dir, "fake.pdf"), "not a pdf at all");
  const run = machine(dir);
  const tool = async (name, args) => (await run({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: name, args })).toString("base64") })).output;
  for (const [name, args, what] of [["read", { path: "a.txt\0.png" }, "the path"], ["write", { path: "b\0.txt", content: "x" }, "the path"], ["edit", { path: "a.txt\0", old_string: "hi", new_string: "yo" }, "the path"], ["grep", { pattern: "h\0i" }, "the pattern"], ["glob", { pattern: "*\0.txt" }, "the pattern"]]) {
    assert.equal(await tool(name, args), "error: " + what + " cannot contain null bytes (\\0). Remove the null byte and try again.", name);
  }
  assert.match(await tool("read", { path: "fake.pdf" }), /^error: fake\.pdf is not a valid PDF; it could not be opened.*\. If it should be one, try its text with bash \(pdftotext\)$/s);
});

test("CD213 a command that changes a file Coder read says so in its result, as Claude Code's do (\"This command modified 1 file you've previously read … Call Read before editing\"); a file changed any other way (a command in the background, or between messages) gets no note, as the owner's two tests in Claude Code showed, and is never put down to Coder's next command; Coder's own edits are no news; only on a machine that follows the files", async () => {
  const { runCoder, commandChangedNote } = await import("../container/coder-agent.mjs");
  const { SEEN_FILES } = await import("../container/coder-tools.mjs");
  const { mkdtemp, writeFile, readFile, unlink, utimes } = await import("node:fs/promises");
  const { execSync, execFileSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  assert.equal(SEEN_FILES, 100);
  const dir = await mkdtemp(join(tmpdir(), "coder-seen-"));
  const followDir = await mkdtemp(join(tmpdir(), "coder-seen-follow-"));
  const env = { ...process.env, CODER_SEEN_DIR: followDir };
  const sh = (command) => { try { return { code: 0, output: execSync(command, { cwd: dir, encoding: "utf8", env }) }; } catch (e) { return { code: Number.isInteger(e.status) ? e.status : 1, output: String(e.stdout || "") }; } };
  const run = machine(dir, sh, env);
  const tool = async (name, args = {}) => (await run({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: name, args })).toString("base64") })).output;
  const changed = async () => JSON.parse(await tool("changed"));
  await writeFile(join(dir, "a.js"), "const a = 1;\n");
  await writeFile(join(dir, "b.js"), "const b = 1;\n");
  await writeFile(join(dir, "c.js"), "c\n");
  // The tools: a read follows the file (its time, size and fingerprint: no copy of it is kept); a change is told once.
  await tool("read", { path: "a.js" });
  assert.deepEqual(await changed(), { followed: 1, changed: [] });
  const index = JSON.parse(await readFile(join(followDir, "index.json"), "utf8"));
  assert.deepEqual(Object.keys(index[0]).sort(), ["abs", "hash", "mtime", "size"]);
  assert.ok(!JSON.stringify(index).includes("const a"), "no copy of the file is kept");
  await writeFile(join(dir, "a.js"), "const a = 2;\n");
  assert.deepEqual(await changed(), { followed: 1, changed: [{ path: "a.js" }] });
  assert.deepEqual((await changed()).changed, [], "told once");
  await utimes(join(dir, "a.js"), new Date(), new Date(Date.now() + 5000));
  assert.deepEqual((await changed()).changed, [], "only touched: the same bytes");
  // Coder's own write and edit are no news to it.
  await tool("write", { path: "a.js", content: "const a = 3;\n" });
  await tool("edit", { path: "a.js", old_string: "3", new_string: "4" });
  assert.deepEqual((await changed()).changed, []);
  // Deleted; grown past 256 KB (then no longer followed); and nothing followed where the machine follows nothing.
  await tool("read", { path: "c.js" });
  await tool("read", { path: "b.js" });
  await unlink(join(dir, "c.js"));
  await writeFile(join(dir, "b.js"), "x".repeat(300 * 1024));
  const two = await changed();
  assert.deepEqual(two.changed.sort((p, q) => p.path.localeCompare(q.path)), [{ path: "b.js" }, { path: "c.js", gone: true }]);
  assert.equal(two.followed, 1, "only a.js is followed now");
  const bare = machine(dir, sh);
  assert.match((await bare({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: "read", args: { path: "a.js" } })).toString("base64") })).output, /const a = 4;/);
  assert.equal((await bare({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: "changed", args: {} })).toString("base64") })).output, '{"followed":0,"changed":[]}');
  // At most SEEN_FILES followed, the oldest let go first.
  const many = await mkdtemp(join(tmpdir(), "coder-seen-many-"));
  const manyDir = await mkdtemp(join(tmpdir(), "coder-seen-follow-"));
  for (let i = 0; i < 105; i++) await writeFile(join(many, "f" + i + ".txt"), "file " + i + "\n");
  execFileSync("node", ["--input-type=module", "-e", "const { toolRead } = await import(" + JSON.stringify(toolsScript) + "); for (let i = 0; i < 105; i++) await toolRead({ path: 'f' + i + '.txt' });"], { cwd: many, env: { ...process.env, CODER_SEEN_DIR: manyDir } });
  const list = JSON.parse(await readFile(join(manyDir, "index.json"), "utf8"));
  assert.equal(list.length, 100);
  assert.ok(list[0].abs.endsWith("/f5.txt") && list[99].abs.endsWith("/f104.txt"), "f0 to f4 let go");

  // In a job. A command that changes a file Coder read says so; one that changes nothing it read says nothing.
  // A change made in the background (while Coder thinks, or while it checks on the background command) gets no note,
  // and is not put down to the next command.
  await writeFile(join(dir, "a.js"), "const a = 1;\n");
  await writeFile(join(dir, "b.js"), "const b = 1;\n");
  await writeFile(join(dir, "c.js"), "c = 1\n");
  const job = (command) => command === "sleep 30" ? { code: -1, background: true, pid: 999999, log: join(dir, "bg.log"), output: "" } : command.includes("tail -n") ? (execSync("printf 'c = 5\\n' > c.js", { cwd: dir }), { code: 0, output: "[not running]" }) : sh(command);
  const tools = [];
  const run2 = machine(dir, job, env);
  const exec = async (x) => { const b = x.command.split(" ").pop(); try { tools.push(JSON.parse(Buffer.from(b, "base64").toString("utf8")).tool); } catch { tools.push("bash"); } return run2(x); };
  const plan = [
    [call("read", { path: "a.js" }, "r1"), call("read", { path: "b.js" }, "r2"), call("read", { path: "c.js" }, "r3")],
    [call("bash", { command: "sed -i s/1/2/ a.js" }, "b4")],
    [call("bash", { command: "echo nothing" }, "b5")],
    [call("bash", { command: "sleep 30", run_in_background: true }, "b6")],
    [call("bash", { command: "echo hi" }, "b7")],
    [call("monitor", { job: "job1" }, "m8")],
    [call("bash", { command: "echo bye" }, "b9")],
  ];
  let k = 0;
  const seen = [];
  const deps = { seen: true, exec, emit: () => {}, send: async (q) => { seen.push(q); k++; if (k === 5) await writeFile(join(dir, "b.js"), "const b = 9;\n"); return k <= plan.length ? say("", plan[k - 1]) : say("Done."); } };
  const out = await runCoder(deps, { text: "work" });
  const reply = (m, id) => m.find((x) => x.role === "tool" && x.tool_call_id === id).content;
  assert.equal(reply(out.messages, "b4"), "exit code 0\n(no output)\n[This command changed 1 file you read before: a.js. Read it again before editing.]");
  assert.equal(reply(out.messages, "b5"), "exit code 0\nnothing\n");
  assert.equal(reply(out.messages, "b7"), "exit code 0\nhi\n", "b.js changed while Coder was thinking: no note, and not put down to echo");
  assert.equal(reply(out.messages, "b9"), "exit code 0\nbye\n", "c.js changed while Coder checked on the background command: the same");
  assert.ok(!seen.some((q) => q.messages.some((m) => m.appNote)), "and no note before any step");
  // Between messages (an undo, say): no note, and not put down to Coder's first command.
  await writeFile(join(dir, "a.js"), "const a = 7;\n");
  let k2 = 0;
  const seen2 = [];
  const out2 = await runCoder({ ...deps, send: async (q) => { seen2.push(q); k2++; return k2 === 1 ? say("", [call("bash", { command: "echo first" }, "f1")]) : k2 === 2 ? say("", [call("edit", { path: "c.js", old_string: "5", new_string: "6" }, "e2"), call("bash", { command: "echo after" }, "f3")]) : say("Done."); } }, { messages: out.messages, text: "next" });
  assert.equal(seen2[0].messages.at(-1).content, "next", "no note before the first step");
  assert.equal(reply(out2.messages, "f1"), "exit code 0\nfirst\n");
  assert.equal(reply(out2.messages, "f3"), "exit code 0\nafter\n", "Coder's own edit is no news");
  // Only on a machine that follows the files: otherwise the job is as before (no extra steps at all).
  tools.length = 0;
  await runCoder({ ...deps, seen: undefined, send: async () => say("Done.") }, { messages: out.messages, text: "again" });
  assert.deepEqual(tools, []);
  // The note's words.
  assert.equal(commandChangedNote([{ path: "a.js" }, { path: "b.js", gone: true }]), "[This command changed 2 files you read before: a.js, b.js (deleted or moved). Read it again before editing.]");
  assert.equal(commandChangedNote([{ path: "b.js", gone: true }]), "[This command changed 1 file you read before: b.js (deleted or moved).]");
});

test("CD215 right after a summary made between messages (/compact, a long chat summarized, Rewind's summaries), the next job reads again, once, the files that summary names, like Claude Code: up to five, the most recently changed first, a big one only named, none the kept messages show already; @-mentions name their files for it", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const { summaryMessage, isSummary } = await import("../container/coder-compact.mjs");
  const { mkdtemp, writeFile, utimes } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "coder-after-sum-"));
  const t0 = Date.now() / 1000 - 3600;
  for (const [f, text, age] of [["a.js", "const a = 1;\n", 1], ["b.js", "const b = 2;\n", 5], ["kept.js", "k\n", 9], ["big.js", Array.from({ length: 400 }, (_, i) => "// " + i + " " + "x".repeat(70)).join("\n") + "\n", 3]]) { await writeFile(join(dir, f), text); await utimes(join(dir, f), t0 + age, t0 + age); }
  const history = [
    summaryMessage("THE SUMMARY", "the conversation before the owner's /compact", ["a.js", "gone.js", "big.js", "kept.js", "b.js"]),
    { role: "user", content: "ask 2" },
    { role: "assistant", content: "", tool_calls: [call("read", { path: "kept.js" }, "k1")] },
    { role: "tool", tool_call_id: "k1", content: "     1\tk" },
    { role: "assistant", content: "ok" },
  ];
  const events = [], seen = [];
  const out = await runCoder({ send: async (q) => { seen.push(q); return say("Done."); }, emit: (e) => events.push(e), exec: machine(dir) }, { messages: history, text: "next" });
  const note = seen[0].messages.at(-1);
  assert.equal(note.appNote, true);
  assert.equal(seen[0].messages.at(-2).content, "next", "right after the owner's message");
  assert.ok(note.content.startsWith("(Note from Coder's app, not the owner: this chat was summarized before this message. Like Claude Code after a summary, the files you were working on, read again just now as they are now, the most recently changed first.)\n\n"));
  const order = ["--- b.js ---\n     1\tconst b = 2;", "Referenced file big.js (over 20,000 characters", "--- a.js ---\n     1\tconst a = 1;"];
  let at = -1;
  for (const o of order) { const i = note.content.indexOf(o); assert.ok(i > at, "in order: " + o); at = i; }
  assert.ok(!note.content.includes("kept.js") && !note.content.includes("gone.js"), "not what the kept messages show, nor a file that is gone");
  assert.deepEqual(events.filter((e) => e.type === "bash").map((e) => e.command), ["b.js (again, after the summary)", "big.js (again, after the summary)", "a.js (again, after the summary)"]);
  // Once: the summary no longer names them in what is saved, and the next job reads nothing again.
  const sum = out.messages.find(isSummary);
  assert.equal(sum.reread, undefined);
  assert.equal(sum.content, history[0].content);
  const seen2 = [];
  await runCoder({ send: async (q) => { seen2.push(q); return say("Done."); }, emit: () => {}, exec: machine(dir) }, { messages: out.messages, text: "again" });
  assert.equal(seen2[0].messages.at(-1).content, "again");
  // The @-mention note names its files, so a later summary knows them.
  const seen3 = [];
  const out3 = await runCoder({ send: async (q) => { seen3.push(q); return say("Done."); }, emit: () => {}, exec: machine(dir) }, { text: "look at @a.js and @nothere.js", shown: "look at @a.js and @nothere.js" });
  assert.deepEqual(out3.messages[1].files, ["a.js"]);
});

test("CD216 read refuses a binary file by its kind, as Claude Code's Read does (\"Read refuses a file whose extension it treats as binary, such as .xlsx, .parquet, .heic, or .zip … the error suggests … a shell command or script that reads the format\"), with a way to read each kind; any other binary file says how to find out what it is; a folder says to list it with glob or a command such as ls", async () => {
  const { mkdtemp, writeFile, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "coder-binary-"));
  const run = machine(dir);
  const read = async (path) => (await run({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: "read", args: { path } })).toString("base64") })).output;
  // By kind, even when what is inside looks like text.
  await writeFile(join(dir, "data.zip"), "PK looks like text");
  await writeFile(join(dir, "Sheet 1.xlsx"), "x");
  await writeFile(join(dir, "t.parquet"), "x");
  await writeFile(join(dir, "photo.heic"), "x");
  assert.equal(await read("data.zip"), "error: data.zip is a binary file (ZIP), not text, so read does not open it: list it with `unzip -l 'data.zip'`, or print one file in it with `unzip -p 'data.zip' path/inside`");
  assert.match(await read("Sheet 1.xlsx"), /^error: Sheet 1\.xlsx is a binary file \(XLSX\), not text, so read does not open it: read it with a script, e\.g\. python3 with openpyxl or pandas/);
  assert.match(await read("t.parquet"), /\(PARQUET\).*python3 with pandas and pyarrow, or duckdb$/);
  assert.match(await read("photo.heic"), /\(HEIC\).*make a PNG of it with a command \(ImageMagick: `convert 'photo\.heic' \/tmp\/out\.png`/);
  // Any other binary file: by the NUL byte in its start, with how to see what it is.
  await writeFile(join(dir, "blob.dat"), Buffer.from([1, 2, 0, 3]));
  assert.equal(await read("blob.dat"), "error: blob.dat is a binary file (not text): see what it is with `file 'blob.dat'`, then use a command or a script that reads that kind of file");
  // A folder.
  await mkdir(join(dir, "src"));
  assert.equal(await read("src"), "error: src is a folder, not a file: list what is in it with glob, or a command such as ls");
  // An @-mentioned folder still comes as its listing; an @-mentioned binary file is named, not included.
  const { runCoder } = await import("../container/coder-agent.mjs");
  await writeFile(join(dir, "src", "app.js"), "x\n");
  const seen = [];
  await runCoder({ send: async (q) => { seen.push(q); return say("Done."); }, emit: () => {}, exec: run }, { text: "see @src/ and @data.zip", shown: "see @src/ and @data.zip" });
  const note = seen[0].messages.at(-1).content;
  assert.ok(note.includes("--- src/ (a folder: what is in it) ---\napp.js"));
  assert.ok(note.includes("--- data.zip: not included (data.zip is a binary file (ZIP), not text"));
});

test("CD217 the review (2026-11-08): a job that reads a lot never wipes the saved chat. While Coder works, a read reaches Grok whole; the chat saved between messages keeps each tool's answer and each app note to 12,000 characters (a summary to 40,000), and the chat's record keeps each step's output to 12,000; the size cap cuts only at the owner's messages, and one job over it is shortened, never dropped", async () => {
  const { runCoder, forSaving, SAVE_ONE_MAX, SAVE_SUMMARY_MAX } = await import("../container/coder-agent.mjs");
  const { summaryMessage } = await import("../container/coder-compact.mjs");
  const { capHistory, HISTORY_MAX } = await import("../src/coder-routes.mjs");
  assert.equal(SAVE_ONE_MAX, 12000);
  assert.equal(SAVE_SUMMARY_MAX, 40000);
  // What is kept short, and what is not.
  const long = (n) => "x".repeat(n);
  assert.equal(forSaving({ role: "tool", tool_call_id: "a", content: long(60000) }).content.length, 12000 + "\n[… 48,000 more characters are left out of the saved chat, to keep it small: read the file again if you need them]".length);
  assert.match(forSaving({ role: "user", appNote: true, content: long(30000) }).content, /\n\[… 18,000 more characters are left out of the saved chat/);
  assert.equal(forSaving(summaryMessage(long(45000), "x")).content.length > 40000, true);
  assert.equal(forSaving({ role: "user", content: long(50000) }).content.length, 50000, "the owner's own words are never cut");
  assert.equal(forSaving({ role: "tool", tool_call_id: "a", content: "short" }).content, "short");
  // The review's case: one earlier job, then sixteen reads of about 35,000 characters each.
  const file = Array.from({ length: 300 }, (_, i) => String(i + 1).padStart(6) + "\tline " + (i + 1) + " " + "z".repeat(100)).join("\n");
  const plan = Array.from({ length: 8 }, (_, r) => [call("read", { path: "m" + (2 * r) + ".js" }, "r" + (2 * r)), call("read", { path: "m" + (2 * r + 1) + ".js" }, "r" + (2 * r + 1))]);
  let k = 0;
  const asked = [], events = [];
  const earlier = [{ role: "user", content: "ask 1" }, { role: "assistant", content: "answer 1" }];
  const out = await runCoder({ send: async (q) => { asked.push(q); k++; return k <= plan.length ? say("", plan[k - 1]) : say("Done."); }, emit: (e) => events.push(e), exec: async () => ({ code: 0, output: file }) }, { messages: earlier, text: "review m0..m15" });
  assert.ok(asked.at(-1).messages.filter((m) => m.role === "tool").every((m) => m.content === file), "Grok got every read whole");
  assert.ok(JSON.stringify(out.messages).length < 300000, "the saved part is small: " + JSON.stringify(out.messages).length);
  const kept = capHistory(out.messages);
  assert.equal(kept.length, out.messages.length, "and the cap keeps all of it, the earlier job too");
  assert.deepEqual(kept.slice(0, 3).map((m) => m.content), ["ask 1", "answer 1", "review m0..m15"]);
  assert.ok(events.filter((e) => e.type === "result").every((e) => e.output.length <= 12100), "the chat's record keeps each output short");
  // One job alone over the cap: shortened, never dropped; an app note is never where the cut starts.
  const huge = [{ role: "user", content: "old ask" }, { role: "assistant", content: "old answer" }, { role: "user", content: "big job" }, { role: "user", appNote: true, content: "(Note from Coder's app, not the owner: …) " + long(5000) }];
  for (let i = 0; i < 60; i++) huge.push({ role: "assistant", content: "", tool_calls: [call("read", { path: "f" + i }, "t" + i)] }, { role: "tool", tool_call_id: "t" + i, content: long(12000) });
  const capped = capHistory(huge);
  assert.ok(capped.length > 0 && JSON.stringify(capped).length <= HISTORY_MAX);
  assert.equal(capped[0].content, "big job", "the older job went; this one starts at the owner's message, not at the app's note");
  assert.equal(capped.filter((m) => m.role === "tool").length, 60, "every step kept, its answer shortened");
  assert.match(capped.find((m) => m.role === "tool").content, /\n\[… cut short in the saved chat: read the file again if you need it\]$/);
});

test("CD218 the review (2026-11-08): a long job that reads a lot keeps its requests to Grok bounded. Its summaries keep the newest rounds whole only up to 40% of the room (at least the newest one), and a job may summarize itself up to 10 times", async () => {
  const { runCoder, COMPACT_AT, COMPACT_JOB_MAX, KEEP_SHARE } = await import("../container/coder-agent.mjs");
  const { cutPoint } = await import("../container/coder-compact.mjs");
  assert.equal(COMPACT_JOB_MAX, 10);
  assert.equal(KEEP_SHARE, 0.4);
  // cutPoint: as before when the rounds are small; by size when they are big.
  const rounds = (n, size) => { const c = [{ role: "user", content: "go" }]; for (let i = 0; i < n; i++) c.push({ role: "assistant", content: "", tool_calls: [call("read", { path: "f" }, "c" + i)] }, { role: "tool", tool_call_id: "c" + i, content: "y".repeat(size) }); return c; };
  const small = rounds(12, 100);
  assert.equal(cutPoint(small, 1, 8), 1 + 2 * 4, "small rounds: the newest 8 kept, as before");
  assert.equal(cutPoint(small, 1, 8, 180000), 1 + 2 * 4);
  assert.equal(cutPoint(rounds(9, 100), 1, 8, 180000), -1, "no more than keep + 1 small rounds: nothing yet");
  const big = rounds(5, 100000);
  assert.equal(cutPoint(big, 1, 8, 180000), 1 + 2 * 4, "big rounds: only the newest that fit (here one) kept");
  assert.equal(cutPoint(rounds(1, 900000), 1, 8, 180000), -1, "one huge round: nothing older to summarize");
  // A 40-round job reading a 100,000-character file each round: every request stays bounded.
  const page = "p".repeat(100000);
  let k = 0, notes = 0, most = 0;
  await runCoder({
    send: async (q) => {
      if (!q.tools || !q.tools.length) return say("SUMMARY");
      most = Math.max(most, JSON.stringify(q.messages).length);
      k++;
      return k <= 40 ? say("", [call("read", { path: "big" + k + ".txt" }, "r" + k)]) : say("Done.");
    },
    emit: (e) => { if (e.type === "note" && /^Compacted/.test(e.text)) notes++; },
    exec: async () => ({ code: 0, output: page }),
  }, { text: "read them all", maxRounds: 60 });
  assert.equal(k, 41);
  assert.ok(notes > 3 && notes <= 10, notes + " summaries");
  assert.ok(most < COMPACT_AT + 2 * 110000, "the biggest request was " + most + " characters");
});

test("CD219 the review (2026-11-08): a chat with no history (new, or rewound to its very start) follows none of the files read before, so a rewind's changes are never put down to a command; Next.js's catch-all routes ([...slug]) are @-mentionable, a .. part never; a PARTIAL view's \"about X KB of Y KB\" counts bytes on both sides", async () => {
  const { runCoder, mentionedPaths } = await import("../container/coder-agent.mjs");
  const { fileMentions } = await import("../src/coder-routes.mjs");
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { execSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "coder-rewound-"));
  const followDir = await mkdtemp(join(tmpdir(), "coder-rewound-follow-"));
  const env = { ...process.env, CODER_SEEN_DIR: followDir };
  const sh = (command) => { try { return { code: 0, output: execSync(command, { cwd: dir, encoding: "utf8", env }) }; } catch (e) { return { code: 1, output: String(e.stdout || "") }; } };
  const exec = machine(dir, sh, env);
  await writeFile(join(dir, "a.js"), "const a = 1;\n");
  await writeFile(join(dir, "b.js"), "const b = 1;\n");
  let k = 0;
  const first = await runCoder({ seen: true, exec, emit: () => {}, send: async () => (++k === 1 ? say("", [call("read", { path: "a.js" }, "r1")]) : say("Done.")) }, { text: "read a" });
  assert.equal(first.status, "done");
  // Rewind to the very start: the chat's history is empty, and the code goes back (a.js changes).
  await writeFile(join(dir, "a.js"), "const a = 0;\n");
  let k2 = 0;
  const second = await runCoder({ seen: true, exec, emit: () => {}, send: async () => (++k2 === 1 ? say("", [call("read", { path: "b.js" }, "r1")]) : k2 === 2 ? say("", [call("bash", { command: "echo hi" }, "b2")]) : say("Done.")) }, { messages: [], text: "again" });
  assert.equal(second.messages.find((m) => m.tool_call_id === "b2").content, "exit code 0\nhi\n", "a.js is not put down to echo");
  // @-mentions: [...slug] is a name; a .. part is refused in both copies.
  const ask = "see @pages/[...slug].tsx and @app/[[...all]]/page.tsx, not @a/../b.js";
  assert.deepEqual(mentionedPaths(ask), ["pages/[...slug].tsx", "app/[[...all]]/page.tsx"]);
  assert.equal(fileMentions(ask), "\n\n(The owner pointed at these files: pages/[...slug].tsx, app/[[...all]]/page.tsx.)");
  // "about X KB of Y KB": bytes on both sides (é is 2 bytes).
  await writeFile(join(dir, "wide.txt"), Array.from({ length: 2000 }, (_, i) => "row " + i + " " + "é".repeat(60)).join("\n"));
  const r = (await exec({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: "read", args: { path: "wide.txt" } })).toString("base64") })).output;
  const m = /\[PARTIAL view: lines 1-(\d+) of 2000 \(about (\d+) KB of (\d+) KB\)/.exec(r);
  assert.ok(m, r.slice(-200));
  const lines = Number(m[1]), got = Number(m[2]), all = Number(m[3]);
  assert.equal(got, Math.round(Buffer.byteLength(Array.from({ length: lines }, (_, i) => "row " + i + " " + "é".repeat(60)).join("\n") + "\n") / 1024));
  assert.equal(all, Math.round(Buffer.byteLength(Array.from({ length: 2000 }, (_, i) => "row " + i + " " + "é".repeat(60)).join("\n")) / 1024));
});

test("CD220 a big picture is shown smaller, and Coder is told so, with its real size and how to crop for fine detail (Claude Code's docs: \"Claude may see a downscaled version of a large screenshot … crop the region you care about, such as with ImageMagick via Bash, and then read the crop\"); a small one is shown as it is", async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { execFileSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { PICS_MARK } = await import("../container/coder-tools.mjs");
  const dir = await mkdtemp(join(tmpdir(), "coder-bigpic-"));
  execFileSync("convert", ["-size", "4000x2000", "xc:white", join(dir, "shot.png")]);
  execFileSync("convert", ["-size", "300x200", "xc:white", join(dir, "small.jpg")]);
  const run = machine(dir);
  const read = async (path) => { const out = (await run({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: "read", args: { path } })).toString("base64") })).output; return out.startsWith(PICS_MARK) ? JSON.parse(out.slice(PICS_MARK.length)) : { text: out }; };
  const big = await read("shot.png");
  assert.match(big.text, /^Picture: shot\.png \(4000×2000, PNG, \d+ KB\), shown to you as a picture after these results, made smaller \(1600×800\): for fine detail, crop the part you need with ImageMagick \(e\.g\. convert 'shot\.png' -crop 800x600\+0\+0 \/tmp\/part\.png\) and read the crop\.$/);
  assert.equal(big.pictures.length, 1);
  const small = await read("small.jpg");
  assert.match(small.text, /^Picture: small\.jpg \(300×200, JPEG, \d+ KB\), shown to you as a picture after these results\.$/);
});

test("CD221 a PDF's own page count is not trusted (Claude Code 2.1.317: \"Fixed a PDF's own metadata being able to make Read and @-mentions under-count its pages\"): one that says 3 pages but has 12 is read as 12, one whose count is too high is read from a mended copy; .epub is refused as binary, as Claude Code's Read now does", async () => {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { execFileSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { PICS_MARK } = await import("../container/coder-tools.mjs");
  const dir = await mkdtemp(join(tmpdir(), "coder-pdfcount-"));
  const run = machine(dir);
  const read = async (args) => { const out = (await run({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: "read", args })).toString("base64") })).output; return out.startsWith(PICS_MARK) ? JSON.parse(out.slice(PICS_MARK.length)) : { text: out, pictures: [] }; };
  await writeFile(join(dir, "book.epub"), "PK");
  assert.match((await read({ path: "book.epub" })).text, /^error: book\.epub is a binary file \(EPUB\), not text, so read does not open it: list it with `unzip -l 'book\.epub'`/);
  let tools = true;
  try { execFileSync("python3", ["-c", "import pypdf"]); execFileSync("pdfinfo", ["-v"], { stdio: "ignore" }); } catch { tools = false; }
  if (!tools) return; // pypdf and poppler are on Coder's machine (the machine check, test/read-check.mjs, reads one there)
  const pdf = (pages, count) => {
    const objs = [];
    objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objs[2] = "<< /Type /Pages /Kids [" + pages.map((_, i) => 4 + i * 2 + " 0 R").join(" ") + "] /Count " + count + " >>";
    objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    pages.forEach((t, i) => { const c = "BT /F1 18 Tf 72 720 Td (" + t + ") Tj ET"; objs[4 + i * 2] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents " + (5 + i * 2) + " 0 R >>"; objs[5 + i * 2] = "<< /Length " + c.length + " >>\nstream\n" + c + "\nendstream"; });
    let out = "%PDF-1.4\n"; const offs = [];
    for (let id = 1; id < objs.length; id++) { offs[id] = out.length; out += id + " 0 obj\n" + objs[id] + "\nendobj\n"; }
    const xref = out.length;
    out += "xref\n0 " + objs.length + "\n0000000000 65535 f \n" + offs.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
    return Buffer.from(out + "trailer\n<< /Size " + objs.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n", "latin1");
  };
  await writeFile(join(dir, "liar.pdf"), pdf(Array.from({ length: 12 }, (_, i) => "Page " + (i + 1)), 3));
  await writeFile(join(dir, "over.pdf"), pdf(["Page one", "Page two"], 9));
  await writeFile(join(dir, "fine.pdf"), pdf(["Only page"], 1));
  assert.equal((await read({ path: "liar.pdf" })).text, "error: liar.pdf has 12 pages (the file says 3, but it has 12): give pages, e.g. \"1-5\" (at most 20 at a time)");
  const tail = await read({ path: "liar.pdf", pages: "10-12" });
  assert.match(tail.text, /^liar\.pdf: PDF, 12 pages \(the file says 3, but it has 12\), pages 10-12; each page is also shown/);
  assert.match(tail.text, /--- Page 10 \(picture 1\) ---\nPage 10[\s\S]*--- Page 12 \(picture 3\) ---\nPage 12$/);
  assert.equal(tail.pictures.length, 3, "the hidden pages are seen too");
  const over = await read({ path: "over.pdf" });
  assert.match(over.text, /^over\.pdf: PDF, 2 pages \(its page count was broken: read from a mended copy\); each page/);
  assert.match(over.text, /--- Page 2 \(picture 2\) ---\nPage two$/);
  const fine = await read({ path: "fine.pdf" });
  assert.match(fine.text, /^fine\.pdf: PDF, 1 page; each page is also shown to you as a picture after these results, in order\n\n--- Page 1 \(picture 1\) ---\nOnly page$/, "a sound PDF reads as before");
});

test("CD222 after a job's summary, Coder's instructions and memory come fresh from disk (Claude Code's docs, \"What survives compaction\": \"Project-root CLAUDE.md and unscoped rules | Re-injected from disk\", \"Auto memory | Re-injected from disk\"; its 2.1.311: \"Fixed Claude seeing stale MEMORY.md and CLAUDE.md content right after automatic compaction when those files were edited earlier in the session\")", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  let k = 0, summarized = false, fresh = 0;
  const systems = [];
  await runCoder({
    get compactAt() { return k === 12 && !summarized ? 20_000 : 10_000_000; },
    freshContext: async () => { fresh++; return "CONTEXT FROM DISK: CODER.md now says use tabs"; },
    send: async (q) => {
      if (!q.tools || !q.tools.length) { summarized = true; return say("SUMMARY"); }
      systems.push(q.messages[0].content); k++;
      return k <= 12 ? say("", [call("bash", { command: "echo " + k }, "c" + k)]) : say("Done.");
    },
    emit: () => {},
    exec: async () => ({ code: 0, output: "z".repeat(3000) }),
  }, { text: "go", context: "CONTEXT AT THE START: CODER.md says use spaces" });
  assert.equal(fresh, 1, "once, after the summary");
  assert.ok(systems.slice(0, 12).every((c) => c.endsWith("CONTEXT AT THE START: CODER.md says use spaces")));
  assert.ok(systems.at(-1).endsWith("CONTEXT FROM DISK: CODER.md now says use tabs"), "the next step has it fresh");
  // On Coder's machine it is made again from the repository's files and the memory file (server.mjs).
  const src = (await import("node:fs")).readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(src, /freshContext: async \(\) => \{ const now = await repoInstructions\(dir\); later = now\.later; return contextFor\(now\.notes, await readMemory\(memFile\), now\.later\); \}/);
});
