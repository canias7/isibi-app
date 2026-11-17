// ROUND 4, BASH (2026-11-14, night; the owner said yes to copying Claude Code 2.1.325): a long output saved with a preview
// of its start and end instead of cut; write and edit refuse UTF-16BE files and files with NUL bytes, read shows them with a
// note; the shell setup lines word for word. Each from Claude Code 2.1.325's raw program (/opt/claude-code/bin/claude).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const scripted = (steps) => { let i = 0; const seen = []; return { seen, send: async (req) => { seen.push(req); return steps[Math.min(i++, steps.length - 1)]; } }; };
const serverSrc = () => readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
const has = (cmd) => spawnSync("sh", ["-c", "command -v " + cmd], { stdio: "ignore" }).status === 0;

/** What Coder's machine gives for an output: its file's last bytes, as outputEnd reads them. */
const endOf = (whole, n) => { const b = Buffer.from(whole); let i = b.length - n; while ((b[i] & 0xc0) === 0x80) i++; return { end: b.subarray(i).toString("utf8"), endAt: i }; };
const lines = (n, w = "line") => Array.from({ length: n }, (_, i) => w + " " + i).join("\n") + "\n";

test("BR1 a command that worked and printed more than BASH_MAX_OUTPUT_LENGTH is saved, never cut, as Claude Code 2.1.325 gives it: \"Preview (start and end):\" (its first 500 characters to a line break, \"[… N omitted …]\", its last 1,500 from a line start) once it passes the read-back window by more than 1,500 bytes; \"Preview (first 2KB):\" otherwise, for PowerShell and for the owner's own command", async () => {
  const C = await import("../container/coder-checks.mjs");
  assert.equal(C.BASH_CUT_MARK, "\n[… output cut here; the full output was saved to a file …]\n");
  assert.deepEqual([C.bashEndBytes(30000), C.bashEndBytes(2000), C.bashEndBytes(1000), C.bashEndBytes(560), C.bashEndBytes(100)], [1501, 1441, 441, 0, 0], "Claude Code's min(1,500, window - 500 - its mark), one byte more");
  const out = lines(4000);
  const size = Buffer.byteLength(out);
  const got = C.bashResultText({ output: out.slice(0, 40000), size, file: "/data/memory/p.out/bu578qprf.txt", ...endOf(out, 1501) });
  // Built by Claude Code's own rule: the start to its last line break in the first 500 characters; the end from the first line
  // start in the last 1,501 bytes, trimmed; what is between, in its size words.
  const start = out.slice(0, out.slice(0, 500).lastIndexOf("\n"));
  const tail = out.slice(-1501);
  const last = tail.slice(tail.indexOf("\n") + 1).trimEnd();
  const omitted = C.kbSize(size - Buffer.byteLength(start) - Buffer.byteLength(last));
  assert.equal(got, "<persisted-output>\nOutput too large (" + C.kbSize(size) + "). Full output saved to: /data/memory/p.out/bu578qprf.txt\n\nPreview (start and end):\n" + start + "\n[… " + omitted + " omitted …]\n" + last + "\n</persisted-output>");
  assert.match(got, /\nline 62\n\[… 36KB omitted …\]\nline 3850\n[\s\S]*\nline 3999\n<\/persisted-output>$/);
  // Past the window by no more than 1,500 bytes: its first 2KB, to a line break.
  const near = lines(3200).slice(0, 30400);
  const nearText = C.bashResultText({ output: near, size: 30400, file: "/o/n.txt", ...endOf(near, 1501) });
  assert.equal(nearText, "<persisted-output>\nOutput too large (29.7KB). Full output saved to: /o/n.txt\n\nPreview (first 2KB):\n" + near.slice(0, near.slice(0, 2000).lastIndexOf("\n")) + "\n...\n</persisted-output>");
  // PowerShell, and a command the owner typed (`ends` false): its first 2KB, whatever its end.
  for (const extra of [{ tool: "PowerShell" }, { ends: false }]) assert.match(C.bashResultText({ output: out.slice(0, 40000), size, file: "/o/a.txt", ...endOf(out, 1501), ...extra }), /^<persisted-output>\nOutput too large \(38KB\)\. Full output saved to: \/o\/a\.txt\n\nPreview \(first 2KB\):\nline 0\n[\s\S]*\n\.\.\.\n<\/persisted-output>$/);
  // 64 MB or more: no end (Claude Code reads none past its persist limit), and its persist-limit words.
  assert.match(C.bashResultText({ output: out.slice(0, 40000), size: 90 * 1024 * 1024, file: "/o/a.txt", truncatedAt: 64 * 1024 * 1024, ...endOf(out, 1501) }), /^<persisted-output>\nOutput exceeded the 64MB persist limit; only the first 64MB were saved to: \/o\/a\.txt\n\nPreview \(first 2KB\):\n/);
  // A smaller window (BASH_MAX_OUTPUT_LENGTH=5000): saved past it, never "... [N lines truncated] ..." when there is a file.
  const mid = lines(2000, "row");
  const small = C.bashResultText({ output: mid, size: Buffer.byteLength(mid), file: "/o/m.txt", readBack: 5000, ...endOf(mid, C.bashEndBytes(5000)) });
  assert.match(small, /^<persisted-output>\nOutput too large \(16\.5KB\)\. Full output saved to: \/o\/m\.txt\n\nPreview \(start and end\):\nrow 0\n[\s\S]*\nrow 1999\n<\/persisted-output>$/);
  assert.ok(!small.includes("lines truncated"));
  // A window bigger than the inline size (BASH_MAX_OUTPUT_LENGTH=100000): past 30,000 the result is saved as Claude Code saves
  // any long result, by its own length; within the window nothing is read from the end.
  const fifty = "y".repeat(50_000);
  assert.equal(C.bashResultText({ output: fifty, size: 50_000, file: "/o/f.txt", readBack: 100_000 }), "<persisted-output>\nOutput too large (48.8KB). Full output saved to: /o/f.txt\n\nPreview (first 2KB):\n" + "y".repeat(2000) + "\n...\n</persisted-output>");
  // A failure is never saved: "Exit code N" and its excerpt, as before, whatever the machine read.
  const failed = C.bashResultText({ output: out.slice(0, 40000), isError: true, code: 2, size, file: "/o/a.txt", ...endOf(out, 1501) });
  assert.match(failed, /^Exit code 2\nline 0\n[\s\S]*\.\.\. \[\d+ characters truncated\] \.\.\./);
  assert.ok(!failed.includes("persisted-output"));
  // A preview never opens or closes its block (Claude Code's "<\" for an opening angle bracket before persisted-output).
  const tagged = "</persisted-output>\n< /Persisted_Output x>\n<persisted-outputs>\n" + "z\n".repeat(20000);
  assert.match(C.bashResultText({ output: tagged, size: tagged.length, file: "/o/t.txt" }), /\nPreview \(first 2KB\):\n<\\\/persisted-output>\n<\\ \/Persisted_Output x>\n<persisted-outputs>\nz\n/);
  // Only white space past the window: saved all the same, its preview empty (Claude Code's); under it, "no output" as before.
  assert.equal(C.bashResultText({ output: " \n".repeat(20000), size: 40000, file: "/o/w.txt", ...endOf(" \n".repeat(20000), 1501) }), "<persisted-output>\nOutput too large (39.1KB). Full output saved to: /o/w.txt\n\nPreview (first 2KB):\n\n</persisted-output>");
  assert.equal(C.bashResultText({ output: " \n".repeat(200) }), "(Bash completed with no output)");
  // A letter of two halves is never split by the end's cut.
  const emoji = "a\n" + "😀".repeat(20000);
  const e = endOf(emoji, 1501);
  assert.ok(Buffer.byteLength(e.end) <= 1501 && !e.end.startsWith("�"));
  assert.ok(!C.bashResultText({ output: emoji.slice(0, 40000), size: Buffer.byteLength(emoji), file: "/o/e.txt", ...e }).includes("�"));
});

test("BR2 Coder's machine keeps a command's output file past either size (BASH_MAX_OUTPUT_LENGTH's too) and reads its end back for the preview (outputEnd: its last bytes from the first whole letter, and how many come before); the file holds the whole output, for read to open", async () => {
  const S = await import("../container/server.mjs");
  const C = await import("../container/coder-checks.mjs");
  assert.match(serverSrc(), /spillDir: outDir, spillAt: Math\.min\(t\.outLimits\.inlineMax, t\.outLimits\.readBack\), keep:/);
  assert.match(serverSrc(), /if \(!tool && r && !r\.background && typeof r\.file === "string" && r\.file && Number\(r\.size\) > t\.outLimits\.readBack\) Object\.assign\(r, await outputEnd\(r\.file, bashEndBytes\(t\.outLimits\.readBack\)\)\);/);
  const dir = mkdtempSync(join(tmpdir(), "fix4-out-"));
  try {
    // outputEnd: a letter cut at the start is left out; none for a file no longer than asked; none for a missing file.
    writeFileSync(join(dir, "a.txt"), "x".repeat(10) + "é" + "abc");
    assert.deepEqual(await S.outputEnd(join(dir, "a.txt"), 4), { end: "abc", endAt: 12 });
    assert.deepEqual(await S.outputEnd(join(dir, "a.txt"), 5), { end: "éabc", endAt: 10 });
    assert.deepEqual(await S.outputEnd(join(dir, "a.txt"), 100), {});
    assert.deepEqual(await S.outputEnd(join(dir, "none.txt"), 4), {});
    // A real command: 20,000 bytes with a window of 5,000 (inline 30,000): its file is kept, whole.
    const r = await S.execIn(dir, "for i in $(seq 0 2999); do echo \"row $i\"; done", 30, { uid: null, kill: true, spillDir: join(dir, "out"), spillAt: Math.min(30000, 5000), keep: 40000 });
    assert.equal(r.code, 0);
    assert.ok(r.file && existsSync(r.file), "kept");
    assert.equal(readFileSync(r.file, "utf8"), lines(3000, "row"), "the whole output");
    Object.assign(r, await S.outputEnd(r.file, C.bashEndBytes(5000)));
    const text = C.bashResultText({ output: r.output, size: r.size, file: r.file, readBack: 5000, end: r.end, endAt: r.endAt });
    assert.match(text, new RegExp("^<persisted-output>\\nOutput too large \\(" + C.kbSize(r.size).replace(".", "\\.") + "\\)\\. Full output saved to: " + r.file + "\\n\\nPreview \\(start and end\\):\\nrow 0\\n[\\s\\S]*\\nrow 2999\\n</persisted-output>$"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("BR3 Coder's loop gives the saved preview with the end the machine read; the chat page shows the same text as before (the result's output); the owner's own ! command is saved past the window too, with its first 2KB only; the bash description and Coder's note say the size it is saved past, PowerShell's the window (Claude Code's wB())", async () => {
  const A = await import("../container/coder-agent.mjs");
  const C = await import("../container/coder-checks.mjs");
  const out = lines(4000);
  const size = Buffer.byteLength(out);
  const events = [];
  const s = scripted([say("", [call("bash", { command: "cat big.log", description: "Show the log" }, "b1")]), say("Done.")]);
  await A.runCoder({ send: s.send, emit: (e) => events.push(e), exec: async () => ({ code: 0, output: out.slice(0, 40000), file: "/data/memory/p.out/abc.txt", size, ...endOf(out, 1501) }) }, { text: "go" });
  const told = s.seen[1].messages.find((m) => m.role === "tool").content;
  assert.match(told, /^<persisted-output>\nOutput too large \(38KB\)\. Full output saved to: \/data\/memory\/p\.out\/abc\.txt\n\nPreview \(start and end\):\nline 0\n[\s\S]*\nline 3999\n<\/persisted-output>$/);
  assert.equal(events.find((e) => e.type === "result" && e.id === "b1").output, told, "the page draws the result's output, as before");
  // The owner's command (! cat big.log) with a window of 5,000: saved, its first 2KB, no end.
  const mid = lines(2000, "row");
  const seen = [];
  await A.runCoder({ send: async (q) => { seen.push(q); return say("ok"); }, emit: () => {}, here: () => "/work/p", root: "/work/p", exec: async () => ({ code: 0, output: mid, file: "/data/out/m.txt", size: Buffer.byteLength(mid), ...endOf(mid, C.bashEndBytes(5000)) }) }, { shell: "cat big.log", outLimits: { inlineMax: 30000, readBack: 5000 } });
  const msg = seen[0].messages.map((m) => (typeof m.content === "string" ? m.content : "")).find((x) => x.startsWith("<bash-stdout>"));
  assert.match(msg, /^<bash-stdout><persisted-output>\nOutput too large \(16\.5KB\)\. Full output saved to: \/data\/out\/m\.txt\n\nPreview \(first 2KB\):\nrow 0\n[\s\S]*\n\.\.\.\n<\/persisted-output><\/bash-stdout>/);
  // The descriptions.
  const t = scripted([say("Done.")]);
  await A.runCoder({ send: t.send, emit: () => {}, exec: async () => ({ code: 0, output: "" }) }, { text: "go", outLimits: { inlineMax: 30000, readBack: 5000 }, powershell: { bypass: true } });
  const fn = (n) => t.seen[0].tools.find((x) => x.function.name === n).function.description;
  assert.match(fn("bash"), /Output past 5,000 characters is saved to a file: you get its path and a preview of about 2,000 characters \(its start, and its end when it is much longer\), and read or grep that file for the rest\./);
  assert.match(fn("powershell"), /\n {2}- If the output exceeds 5000 characters, output will be truncated before being returned to you\.\n/);
  assert.match(A.CODER_TOOLS.find((x) => x.function.name === "bash").function.description, /Output past 30,000 characters is saved to a file: you get its path and a preview of about 2,000 characters \(its start, and its end when it is much longer\)/);
  assert.match(serverSrc(), /"\): output of a command that worked comes back inline up to " \+ Math\.min\(t\.outLimits\.inlineMax, t\.outLimits\.readBack\)\.toLocaleString\("en-US"\) \+ " characters, past that as a file and a preview;/);
});

test("BR4 write and edit refuse a UTF-16BE file and one with NUL bytes in its first 8,000 bytes, in Claude Code 2.1.325's words (nothing written; edit with no old text says \"Cannot create new file - file already exists.\" first); read shows such a file's lines with its note, a big-endian one read as UTF-8 as Claude Code reads it; UTF-16LE stays text", async () => {
  const T = await import("../container/coder-tools.mjs");
  assert.deepEqual([T.notTextOf(Buffer.from([0xfe, 0xff, 0, 0x61])), T.notTextOf(Buffer.from([0xff, 0xfe, 0x61, 0])), T.notTextOf(Buffer.from("a\0b")), T.notTextOf(Buffer.from([0x63, 0xe9])), T.notTextOf(Buffer.from("café")), T.notTextOf(Buffer.alloc(0))], ["utf16be", "", "nul", "not_utf8", "", ""]);
  assert.equal(T.notTextOf(Buffer.concat([Buffer.alloc(8000, 0x61), Buffer.from([0])])), "", "a NUL past the first 8,000 bytes: valid UTF-8, text (Claude Code looks at the first 8,000)");
  assert.equal(T.notTextOf(Buffer.concat([Buffer.alloc(7999, 0x61), Buffer.from([0])])), "nul");
  // Claude Code's words, with Coder's tool names and "the owner".
  assert.equal(T.notTextNote("nul"), "[This file has NUL bytes in its first 8 KB: binary data, UTF-16/UTF-32 without a byte-order mark, or text with embedded NULs. edit and write will refuse it: change it with a shell command that keeps its encoding, or ask the owner whether to convert it to UTF-8.]");
  assert.equal(T.notTextNote("utf16be"), "[This file is UTF-16 big-endian (it starts FE FF), which these tools cannot write. edit and write will refuse it: change it with a shell command that keeps its encoding, or ask the owner whether to convert it to UTF-8.]");
  assert.equal(T.notTextNote("not_utf8"), T.NOT_UTF8_NOTE);
  const tail = ". These tools write UTF-8 (or UTF-16LE behind its byte-order mark) and never convert a file's encoding on their own, so nothing was written. If the file is text, make the change with a shell command that reads and writes it in its own encoding (iconv, or PowerShell Get-Content/Set-Content -Encoding), or ask the owner whether to convert it to UTF-8 first. To replace the whole file with new UTF-8 text anyway, delete it first, then write it.";
  assert.equal(T.notTextRefused("nul"), "has NUL bytes in its first 8 KB: binary data, UTF-16/UTF-32 without a byte-order mark, or text with embedded NULs" + tail);
  assert.equal(T.notTextRefused("utf16be"), "is UTF-16 big-endian (it starts FE FF), which these tools cannot write" + tail);
  assert.equal(T.notTextRefused("not_utf8"), T.NOT_UTF8_REFUSED);
  // For real, as Coder's machine runs the file tools.
  const dir = mkdtempSync(join(tmpdir(), "fix4-enc-"));
  const tool = (name, args) => String(spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: dir, encoding: "utf8" }).stdout || "");
  try {
    const be = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from("hi\n", "utf16le").swap16()]);
    const nul = Buffer.from("a\0b\nok\n");
    writeFileSync(join(dir, "be.txt"), be);
    writeFileSync(join(dir, "nul.txt"), nul);
    for (const [f, kind, bytes] of [["be.txt", "utf16be", be], ["nul.txt", "nul", nul]]) {
      assert.equal(tool("write", { path: f, content: "new\n" }), "error: " + f + " " + T.notTextRefused(kind));
      assert.equal(tool("edit", { path: f, old_string: "o", new_string: "0" }), "error: " + f + " " + T.notTextRefused(kind));
      assert.equal(tool("edit", { path: f, old_string: "", new_string: "x" }), "error: " + T.EDIT_EXISTS);
      assert.deepEqual(readFileSync(join(dir, f)), bytes, f + ": nothing written");
    }
    // (Claude Code's lines since 2026-11-17: what follows the last newline is a line too, numbered without padding.)
    assert.equal(tool("read", { path: "nul.txt" }), "1\ta\u0000b\n2\tok\n3\t\n" + T.notTextNote("nul"));
    assert.equal(tool("read", { path: "be.txt" }), "1\t��\u0000h\u0000i\u0000\n2\t\n" + T.notTextNote("utf16be"), "read as UTF-8, as Claude Code's Read reads it");
    // UTF-16LE behind its mark: text, read, edited and written as UTF-16LE.
    writeFileSync(join(dir, "le.txt"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("hi\n", "utf16le")]));
    assert.equal(tool("read", { path: "le.txt" }), "1\thi\n2\t");
    assert.match(tool("edit", { path: "le.txt", old_string: "hi", new_string: "hé" }), /^The file le\.txt has been updated successfully\./);
    assert.deepEqual(readFileSync(join(dir, "le.txt")), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("hé\n", "utf16le")]));
    // Deleted first, it may be written anew (Claude Code's own advice).
    rmSync(join(dir, "be.txt"));
    assert.match(tool("write", { path: "be.txt", content: "new\n" }), /^File created successfully at: be\.txt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("BR5 the shell setup lines are Claude Code 2.1.325's, word for word: `\\builtin shopt -u extglob` for bash, `\\builtin setopt NO_EXTENDED_GLOB NO_BARE_GLOB_QUAL NO_BRACE_CCL NO_MAGIC_EQUAL_SUBST` for zsh, and its one line for either shell when the owner's CODER_SHELL_PREFIX wraps the command", { timeout: 60_000 }, async () => {
  const S = await import("../container/server.mjs");
  assert.equal(S.EXTGLOB_OFF, "\\builtin shopt -u extglob 2>/dev/null || true\n");
  assert.equal(S.EXTGLOB_OFF_ZSH, "\\builtin setopt NO_EXTENDED_GLOB NO_BARE_GLOB_QUAL NO_BRACE_CCL NO_MAGIC_EQUAL_SUBST 2>/dev/null || true\n");
  assert.equal(S.EXTGLOB_OFF_PREFIXED, "{ \\builtin shopt -u extglob || \\builtin setopt NO_EXTENDED_GLOB NO_BARE_GLOB_QUAL NO_BRACE_CCL NO_MAGIC_EQUAL_SUBST; } >/dev/null 2>&1 || true\n");
  assert.ok(S.commandPrefix("", "", "bash").startsWith(S.EXTGLOB_OFF));
  assert.ok(S.commandPrefix("", "", "/usr/bin/zsh").startsWith(S.EXTGLOB_OFF_ZSH));
  assert.ok(S.commandPrefix("/h", "", "/usr/bin/zsh", true).startsWith(S.SNAPSHOT_READ_ZSH + S.EXTGLOB_OFF_PREFIXED), "with the owner's prefix: the line for either shell");
  assert.ok(S.commandPrefix("/h", "", "bash", true).startsWith(S.SNAPSHOT_READ + S.EXTGLOB_OFF_PREFIXED));
  assert.match(serverSrc(), /t\.prefix = commandPrefix\(home, envFileLine\(rawVars\.CODER_ENV_FILE, home0\) \+ \(home \? hookEnvLine\(project\) : ""\), t\.shell, !!shellPrefixOf\(rawVars\.CODER_SHELL_PREFIX\)\);/);
  assert.match(serverSrc(), /t\.psPrefix = commandPrefix\(home, psEnvLine\(envFilePaths\(rawVars\.CODER_ENV_FILE, home0, home \? project : ""\)\), t\.shell\);/, "a PowerShell command is never wrapped by the prefix");
  // For real: bash's patterns off even when the startup file turned them on; the prefixed line quiet in either shell.
  const run = (sh, script) => execFileSync(sh, ["-c", script], { encoding: "utf8" });
  assert.equal(run("bash", "shopt -s extglob\n" + S.EXTGLOB_OFF + "shopt extglob | tr -d ' \\t'"), "extgloboff\n");
  assert.equal(run("bash", S.EXTGLOB_OFF_PREFIXED + "echo ok"), "ok\n");
  if (!has("zsh")) return;
  // zsh: {ab} stays as written (NO_BRACE_CCL) and x=~/y is not expanded (NO_MAGIC_EQUAL_SUBST), as Claude Code runs it.
  assert.equal(run("zsh", "setopt BRACE_CCL MAGIC_EQUAL_SUBST\necho {ab} x=~/y"), "a b x=" + process.env.HOME + "/y\n", "zsh with those on");
  assert.equal(run("zsh", "setopt BRACE_CCL MAGIC_EQUAL_SUBST EXTENDED_GLOB\n" + S.EXTGLOB_OFF_ZSH + "echo {ab} x=~/y; [[ -o extendedglob ]] && echo on || echo off"), "{ab} x=~/y\noff\n");
  assert.equal(execFileSync("zsh", ["-c", S.EXTGLOB_OFF_PREFIXED + "echo ok"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), "ok\n");
});

test("BR6 read refuses Claude Code 2.1.325's own list of binary kinds (121 extensions, read by its own rule: what follows the path's last dot, in lower case) in its words, pictures read shows and PDFs aside; a file not on the list with NUL bytes is shown with the note, as before; the list also keeps such files from the re-read after a summary", async () => {
  const T = await import("../container/coder-tools.mjs");
  // The list, word for word and in its order, from Claude Code's raw program.
  assert.deepEqual([...T.BINARY_EXTS], [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff", ".tif", ".heic", ".heif", ".avif", ".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv", ".m4v", ".mpeg", ".mpg", ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma", ".aiff", ".opus", ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz", ".z", ".tgz", ".iso", ".zst", ".lz4", ".whl", ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a", ".obj", ".lib", ".app", ".msi", ".deb", ".rpm", ".dmg", ".apk", ".pdf", ".doc", ".docx", ".docm", ".dotx", ".dotm", ".xls", ".xlsx", ".xlsm", ".xlsb", ".xltx", ".xltm", ".ppt", ".pptx", ".pptm", ".ppsx", ".ppsm", ".potx", ".potm", ".odt", ".ods", ".odp", ".numbers", ".epub", ".ttf", ".otf", ".woff", ".woff2", ".eot", ".pyc", ".pyo", ".class", ".jar", ".war", ".ear", ".node", ".wasm", ".rlib", ".sqlite", ".sqlite3", ".db", ".mdb", ".idx", ".parquet", ".feather", ".npy", ".npz", ".pickle", ".psd", ".ai", ".eps", ".sketch", ".fig", ".xd", ".blend", ".3ds", ".max", ".swf", ".fla", ".lockb", ".dat", ".data"]);
  assert.deepEqual(["a.BIN", "/w/x.tar.gz", "/w/.db", "/w/archive.Z", "/w/noext", "/w/dir.d/file", "/w/a.ipa", "/w/a.avro", "/w/a.txt"].map(T.binaryExt), [true, true, true, true, false, false, false, false, false], "its rule, dotfiles too; Coder's own extras (.ipa, .avro) are no longer on it");
  assert.equal(T.BINARY_REFUSED(".zip"), "This tool cannot read binary files. The file appears to be a binary .zip file. Use a shell command or script that can read the format.");
  // For real, as Coder's machine runs read.
  const dir = mkdtempSync(join(tmpdir(), "fix4-bin-"));
  const read = (path) => String(spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: "read", args: { path } })).toString("base64") ], { cwd: dir, encoding: "utf8" }).stdout || "");
  try {
    for (const f of ["model.bin", "cache.dat", "app.db", "arr.npy", "obj.pickle", "bun.lockb", "setup.msi", "pkg.deb", "Report.DOCX", "logo.ico"]) {
      writeFileSync(join(dir, f), "looks like text\n");
      assert.equal(read(f), "error: " + T.BINARY_REFUSED(f.slice(f.lastIndexOf(".")).toLowerCase()), f);
    }
    // Not on the list: read, with Claude Code's note when it holds NUL bytes.
    writeFileSync(join(dir, "blob.raw"), Buffer.from("a\0b\n"));
    assert.equal(read("blob.raw"), "1\ta\u0000b\n2\t\n" + T.notTextNote("nul"));
    writeFileSync(join(dir, "data.avro"), "Obj\n");
    assert.equal(read("data.avro"), "1\tObj\n2\t");
    // .bmp, .tif and .tiff refused as binary too, as Claude Code 2.1.325's Read refuses them (its pictures are png, jpg, jpeg,
    // gif and webp: round 6, the owner, "do what claude code does"); a picture read shows is still taken as a picture.
    for (const f of ["x.bmp", "y.tif", "z.TIFF"]) { writeFileSync(join(dir, f), "not really a picture"); assert.equal(read(f), "error: " + T.BINARY_REFUSED(f.slice(f.lastIndexOf(".")).toLowerCase()), f); }
    writeFileSync(join(dir, "x.png"), "not really a picture");
    const png = read("x.png");
    assert.ok(png.startsWith("error: x.png cannot be shown") && !png.includes("cannot read binary files"), png);
    assert.equal(T.notTextKind("/w/model.bin"), true, "not read again after a summary");
    assert.equal(T.notTextKind("/w/notes.txt"), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("BR7 web_fetch's words for a tunnel Coder's gate refused for any reason but a block, a 502 for an allowed site it could not reach too, are Claude Code 2.1.325's as its WebFetch passes them on: \"proxy refused the connection\"; a 403 block keeps EGRESS_BLOCKED", { timeout: 30_000 }, async () => {
  const http = (await import("node:http")).default;
  const W = await import("../container/coder-webfetch.mjs");
  assert.equal(W.PROXY_REFUSED, "proxy refused the connection");
  const gate = http.createServer();
  gate.on("connect", (req, sock) => { const ok502 = req.url.startsWith("down."); sock.end(ok502 ? "HTTP/1.1 502 Bad Gateway\r\ncontent-length: 0\r\n\r\n" : "HTTP/1.1 403 Forbidden\r\nx-deny-reason: host_not_allowed\r\ncontent-length: 0\r\n\r\n"); });
  await new Promise((ok) => gate.listen(0, "127.0.0.1", ok));
  const proxy = "http://127.0.0.1:" + gate.address().port;
  try {
    // (Coder's tools script, as the agent runs it, with the chat's network list on; run without blocking this test's gate.)
    const child = async (url) => {
      const { execFile } = await import("node:child_process");
      return new Promise((ok) => execFile(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: "web_fetch", args: { url, deadline_ms: 20000 } })).toString("base64")], { env: { ...process.env, CODER_NET_LIMITED: "1", HTTPS_PROXY: proxy }, encoding: "utf8" }, (err, stdout) => ok({ code: err ? err.code : 0, stdout })));
    };
    assert.deepEqual(await child("https://down.example/x"), { code: 1, stdout: "error: proxy refused the connection" });
    assert.deepEqual(await child("https://blocked.example/x"), { code: 1, stdout: 'error: {"error_type":"EGRESS_BLOCKED","domain":"blocked.example","message":"Access to blocked.example is blocked by the network egress proxy."}' });
  } finally { gate.closeAllConnections(); await new Promise((ok) => gate.close(ok)); }
});
