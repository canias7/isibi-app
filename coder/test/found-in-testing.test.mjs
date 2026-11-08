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
    // Summarize exactly once, before the 13th round (12 rounds done: the first 4 are summarized, the newest 8 kept).
    get compactAt() { return k === 12 && !summarized ? 1000 : 10_000_000; },
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

test("CD213 a note when a file Coder read earlier changes on disk, like Claude Code (\"A note when a file Claude read earlier changes on disk\"): the machine keeps a copy of each file Coder reads, writes or edits; a command that changed one says so in its result, in Claude Code's way (\"This command modified 1 file you've previously read … Call Read before editing\"); a change made any other way (a command in the background; between messages, an undo) comes before Coder's next step, with what changed; Coder's own edits are no news; only on a machine that keeps the copies", async () => {
  const { runCoder, changedNote, commandChangedNote } = await import("../container/coder-agent.mjs");
  const { SEEN_FILES } = await import("../container/coder-tools.mjs");
  const { mkdtemp, writeFile, readFile, unlink, utimes } = await import("node:fs/promises");
  const { execSync, execFileSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  assert.equal(SEEN_FILES, 100);
  const dir = await mkdtemp(join(tmpdir(), "coder-seen-"));
  const copies = await mkdtemp(join(tmpdir(), "coder-seen-copies-"));
  const env = { ...process.env, CODER_SEEN_DIR: copies };
  const sh = (command) => { try { return { code: 0, output: execSync(command, { cwd: dir, encoding: "utf8", env }) }; } catch (e) { return { code: Number.isInteger(e.status) ? e.status : 1, output: String(e.stdout || "") }; } };
  const tools = [];
  const run = machine(dir, sh, env);
  const exec = async (x) => { const b = x.command.split(" ").pop(); try { tools.push(JSON.parse(Buffer.from(b, "base64").toString("utf8")).tool); } catch { tools.push("bash"); } return run(x); };
  const tool = async (name, args = {}) => (await run({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: name, args })).toString("base64") })).output;
  const changed = async () => JSON.parse(await tool("changed"));
  await writeFile(join(dir, "a.js"), "const a = 1;\n");
  await writeFile(join(dir, "b.js"), "const b = 1;\nconst c = 3;\n");
  await writeFile(join(dir, "c.js"), "c\n");
  // The tools: a read keeps a copy; a change on disk is told once, with what changed; the same bytes are no change.
  await tool("read", { path: "a.js" });
  assert.deepEqual(await changed(), { followed: 1, changed: [] });
  await writeFile(join(dir, "a.js"), "const a = 2;\n");
  const one = await changed();
  assert.equal(one.followed, 1);
  assert.equal(one.changed.length, 1);
  assert.equal(one.changed[0].path, "a.js");
  assert.match(one.changed[0].diff, /^--- a\/a\.js\n\+\+\+ b\/a\.js\n@@ -1 \+1 @@\n-const a = 1;\n\+const a = 2;\n$/);
  assert.deepEqual((await changed()).changed, [], "told once");
  await utimes(join(dir, "a.js"), new Date(), new Date(Date.now() + 5000));
  assert.deepEqual((await changed()).changed, [], "only touched: the same bytes");
  // Coder's own write and edit are no news to it.
  await tool("write", { path: "a.js", content: "const a = 3;\n" });
  await tool("edit", { path: "a.js", old_string: "3", new_string: "4" });
  assert.deepEqual((await changed()).changed, []);
  // Deleted; grown too big to show; and no copies kept where the machine keeps none.
  await tool("read", { path: "c.js" });
  await tool("read", { path: "b.js" });
  await unlink(join(dir, "c.js"));
  await writeFile(join(dir, "b.js"), "x".repeat(300 * 1024));
  const two = await changed();
  assert.deepEqual(two.changed.sort((p, q) => p.path.localeCompare(q.path)), [{ path: "b.js", big: 300 * 1024 }, { path: "c.js", gone: true }]);
  assert.equal(two.followed, 1, "only a.js is followed now");
  const bare = machine(dir, sh);
  assert.match((await bare({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: "read", args: { path: "a.js" } })).toString("base64") })).output, /const a = 4;/);
  assert.equal((await bare({ command: "node --no-warnings " + toolsScript + " " + Buffer.from(JSON.stringify({ tool: "changed", args: {} })).toString("base64") })).output, '{"followed":0,"changed":[]}');
  // At most SEEN_FILES copies, the oldest let go first.
  const many = await mkdtemp(join(tmpdir(), "coder-seen-many-"));
  const manyCopies = await mkdtemp(join(tmpdir(), "coder-seen-copies-"));
  for (let i = 0; i < 105; i++) await writeFile(join(many, "f" + i + ".txt"), "file " + i + "\n");
  execFileSync("node", ["--input-type=module", "-e", "const { toolRead } = await import(" + JSON.stringify(toolsScript) + "); for (let i = 0; i < 105; i++) await toolRead({ path: 'f' + i + '.txt' });"], { cwd: many, env: { ...process.env, CODER_SEEN_DIR: manyCopies } });
  const index = JSON.parse(await readFile(join(manyCopies, "index.json"), "utf8"));
  assert.equal(index.length, 100);
  assert.ok(index[0].abs.endsWith("/f5.txt") && index[99].abs.endsWith("/f104.txt"), "f0 to f4 let go");

  // In a job: a command that changes a file Coder read says so in its result; a change made otherwise (by a command
  // in the background) is told apart, with what changed: before the next command, or before the next step.
  await writeFile(join(dir, "a.js"), "const a = 1;\n");
  await writeFile(join(dir, "b.js"), "const b = 1;\nconst c = 3;\n");
  await writeFile(join(dir, "c.js"), "c = 1\n");
  const job = (command) => command === "sleep 30" ? { code: -1, background: true, pid: 999999, log: join(dir, "bg.log"), output: "" } : command.includes("tail -n") ? (execSync("printf 'c = 5\\n' > c.js", { cwd: dir }), { code: 0, output: "[not running]" }) : sh(command);
  const run2 = machine(dir, job, env);
  const plan = [
    [call("read", { path: "a.js" }, "r1"), call("read", { path: "b.js" }, "r2"), call("read", { path: "c.js" }, "r3")],
    [call("bash", { command: "sed -i s/1/2/ a.js" }, "b4")],
    [call("bash", { command: "sleep 30", run_in_background: true }, "b5")],
    [call("bash", { command: "echo hi" }, "b6")],
    [call("monitor", { job: "job1" }, "m7")],
  ];
  let k = 0;
  const seen = [];
  const deps = { seen: true, exec: async (x) => { const b = x.command.split(" ").pop(); try { tools.push(JSON.parse(Buffer.from(b, "base64").toString("utf8")).tool); } catch { tools.push("bash"); } return run2(x); }, emit: () => {}, send: async (q) => { seen.push(q); k++; if (k === 4) await writeFile(join(dir, "b.js"), "const b = 9;\nconst c = 3;\n"); return k <= plan.length ? say("", plan[k - 1]) : say("Done."); } };
  const out = await runCoder(deps, { text: "work" });
  const reply = (id) => out.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
  assert.match(reply("b4"), /^exit code 0\n\(no output\)\n\[This command changed 1 file you read before: a\.js\. Read it again before editing\.\]$/);
  // b.js changed while Coder was thinking, with a command in the background: not put down to "echo hi".
  assert.doesNotMatch(reply("b6"), /This command changed/);
  assert.match(reply("b6"), /^exit code 0\nhi\n\n\n\(Note from Coder's app, not the owner: like Claude Code, a note when a file you read earlier changes on disk\. This file changed since you last read or changed it, by something other than your own steps .*don't undo it unless the owner asks\.\)\n\n--- b\.js: changed ---\n--- a\/b\.js\n\+\+\+ b\/b\.js\n@@ -1,2 \+1,2 @@\n-const b = 1;\n\+const b = 9;\n const c = 3;\n$/s);
  // c.js changed during the check on the background command: told before the next step.
  const note = seen[5].messages.at(-1);
  assert.equal(note.role, "user");
  assert.equal(note.appNote, true);
  assert.match(note.content, /\n\n--- c\.js: changed ---\n--- a\/c\.js\n\+\+\+ b\/c\.js\n@@ -1 \+1 @@\n-c = 1\n\+c = 5\n$/);
  assert.ok(!seen.slice(0, 5).some((q) => q.messages.some((m) => m.appNote)), "nothing to tell before");
  // Between messages (an undo, say): the next message's first step is told; Coder's own edit then is no news.
  await writeFile(join(dir, "a.js"), "const a = 7;\n");
  let k2 = 0;
  const seen2 = [];
  const out2 = await runCoder({ ...deps, send: async (q) => { seen2.push(q); k2++; return k2 === 1 ? say("", [call("edit", { path: "a.js", old_string: "7", new_string: "8" }, "e1")]) : say("Done."); } }, { messages: out.messages, text: "next" });
  assert.match(seen2[0].messages.at(-1).content, /--- a\.js: changed ---\n--- a\/a\.js\n\+\+\+ b\/a\.js\n@@ -1 \+1 @@\n-const a = 2;\n\+const a = 7;/);
  assert.equal(seen2[0].messages.at(-2).content, "next", "after the owner's message");
  assert.ok(!seen2[1].messages.slice(-2).some((m) => m.appNote), "its own edit is no news");
  assert.equal(out2.status, "done");
  // Only where the machine keeps the copies: otherwise the job is as before (no extra steps at all).
  tools.length = 0;
  await runCoder({ ...deps, seen: undefined, send: async () => say("Done.") }, { messages: out.messages, text: "again" });
  assert.deepEqual(tools, []);
  // The notes' words.
  assert.equal(commandChangedNote([{ path: "a.js" }, { path: "b.js", gone: true }]), "[This command changed 2 files you read before: a.js, b.js (deleted or moved). Read it again before editing.]");
  assert.equal(commandChangedNote([{ path: "b.js", gone: true }]), "[This command changed 1 file you read before: b.js (deleted or moved).]");
  assert.match(changedNote([{ path: "x.bin", big: 2048 * 1024 }, { path: "y.js", gone: true }]), /These files changed since you last read or changed them[\s\S]*--- x\.bin: changed \(it is now 2048 KB, too big to show what changed: read the part you need again\) ---\n\n--- y\.js: deleted \(or moved\) ---$/);
});
