// CLAUDE CODE'S GREP AND GLOB IN CODER (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; "if we are
// doing it with docs in reference is not extras, is extras when we make it up out of nowhere"): coder-search.mjs, with its
// input checks (coder-inputs.mjs), its runs on the machine (coder-tools.mjs), its result objects for the hooks, the owner's
// rules on its inputs (coder-perms.mjs) and its settings (server.mjs). Each test names the Claude Code behavior it copies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, readFileSync, chmodSync, symlinkSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const S = await import("../container/coder-search.mjs");
const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-perms.mjs");
const H = await import("../container/coder-hooks.mjs");
const I = await import("../container/coder-inputs.mjs");
const TOOLS = join(import.meta.dirname, "../container/coder-tools.mjs");
const hasRg = spawnSync("rg", ["--version"]).status === 0;

// A project to search: hidden folders, a gitignored file, other tools' version-control folders, known modification times.
function project() {
  const d = mkdtempSync(join(tmpdir(), "sr-"));
  for (const x of ["src/deep", ".github", ".git", ".hg", "node_modules/pkg", "docs"]) mkdirSync(join(d, x), { recursive: true });
  spawnSync("git", ["init", "-q", d]);
  const put = (p, text, month) => { writeFileSync(join(d, p), text); const t = new Date(Date.UTC(2026, month, 1)); utimesSync(join(d, p), t, t); };
  put("a.js", "const a = 1;\nTODO first\n", 0);
  put("src/deep/c.js", "TODO deep\n", 1);
  put("src/b.js", "x\nTODO second\ny\nz\nTODO third\n", 2);
  put(".github/ci.yml", "name: TODO ci\n", 3);
  put(".hg/store", "TODO hg\n", 4);
  put(".gitignore", "ignored.txt\nnode_modules/\n", 5);
  put("ignored.txt", "TODO ignored\n", 6);
  put("node_modules/pkg/i.js", "TODO module\n", 7);
  put("src/f.ts", "TODO typed\n", 8);
  put("docs/secret.md", "TODO secret\n", 9);
  writeFileSync(join(d, ".git", "notes"), "TODO in git\n");
  return d;
}
// The search's own way into the project (coder-tools.mjs's `inside`, kept: inside the project, never .git).
const insideOf = (root) => async (p) => {
  const rel = p === root ? "" : p.startsWith(root + "/") ? p.slice(root.length + 1) : null;
  if (rel === null) throw new Error("that path is outside the project");
  if (rel.split("/")[0] === ".git") throw new Error("the .git folder is off limits");
  return { abs: p, rel };
};
const grep = (root, args, ctx = {}) => S.grepTool(args, { base: root, inside: insideOf(root), ...ctx });
const glob = (root, args, ctx = {}) => S.globTool(args, { base: root, inside: insideOf(root), ...ctx });
const fails = async (p) => { try { await p; } catch (e) { return String(e.message); } return "(no error)"; };

test("SR1 Grok is offered Claude Code's Grep and Glob: its short descriptions, the ones a model that isn't one of Claude's older ones gets, its inputs word for word in its order, and a strict schema; Gloopy and its helpers get the same", async () => {
  const grepDef = A.CODER_TOOLS.find((t) => t.function.name === "grep").function, globDef = A.CODER_TOOLS.find((t) => t.function.name === "glob").function;
  assert.equal(grepDef.description, 'Content search built on ripgrep. Prefer this over `grep`/`rg` via bash — results integrate with the permission UI and file links.\n\n- Full regex syntax (e.g. "log.*Error", "function\\s+\\w+"). Ripgrep, not grep — escape literal braces (`interface\\{\\}`).\n- Filter with `glob` (e.g. "**/*.tsx") or `type` (e.g. "js", "py", "rust").\n- `output_mode`: "content" (matching lines), "files_with_matches" (paths only, default), or "count".\n- `multiline: true` for patterns that span lines.');
  assert.deepEqual(Object.keys(grepDef.parameters.properties), ["pattern", "path", "glob", "output_mode", "-B", "-A", "-C", "context", "-n", "-i", "-o", "type", "head_limit", "offset", "multiline"]);
  assert.deepEqual([grepDef.parameters.required, grepDef.parameters.additionalProperties], [["pattern"], false]);
  assert.equal(grepDef.parameters.properties.head_limit.description, 'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 250 when unspecified. Pass 0 for unlimited (use sparingly — large result sets waste context).');
  assert.deepEqual(grepDef.parameters.properties.output_mode.enum, ["content", "files_with_matches", "count"]);
  assert.equal(grepDef.parameters.properties["-n"].type, "boolean");
  assert.equal(grepDef.parameters.properties["-C"].description, "Alias for context.");
  assert.equal(globDef.description, 'Fast file pattern matching. Supports glob patterns like "**/*.js" or "src/**/*.ts". Returns matching file paths sorted by modification time.');
  assert.deepEqual(Object.keys(globDef.parameters.properties), ["pattern", "path"]);
  assert.match(globDef.parameters.properties.path.description, /^The directory to search in\. If not specified, the current working directory will be used\. IMPORTANT: Omit this field/);
  assert.equal(globDef.parameters.additionalProperties, false);
  const G = await import("../container/gloopy-agent.mjs");
  for (const list of [G.HELPER_TOOLS, G.GLOOPY_TOOLS]) for (const n of ["grep", "glob"]) assert.equal(list.find((t) => t.function.name === n).function.description, n === "grep" ? grepDef.description : globDef.description, n);
  assert.equal(I.inputCheckFor("grep"), S.checkGrepInput);
  assert.equal(I.inputCheckFor("glob"), S.checkGlobInput);
});

test("SR2 Grep's input as Claude Code takes it, before any hook: file_path, -l, -c and -r fixed with its notes, numbers and booleans written as text taken, its schema's refusals and its own checks in its words", () => {
  const g = S.checkGrepInput;
  assert.deepEqual(g({ pattern: "x", file_path: "src" }), { args: { pattern: "x", path: "src" }, note: "Note: Grep's parameter for where to search is named `path`. `file_path` was read as `path`." });
  assert.deepEqual(g({ pattern: "x", path: "src", file_path: "src" }), { args: { pattern: "x", path: "src" }, note: "Note: Grep's parameter for where to search is named `path`. `file_path` repeated `path` and was ignored." });
  assert.deepEqual(g({ pattern: "x", "-l": true }), { args: { pattern: "x", output_mode: "files_with_matches" }, note: 'Note: `-l` is not a Grep parameter and was read as `output_mode: "files_with_matches"`.' });
  assert.deepEqual(g({ pattern: "x", "-c": "true", output_mode: "count" }), { args: { pattern: "x", output_mode: "count" }, note: "Note: `-c` repeated `output_mode` and was ignored." });
  assert.deepEqual(g({ pattern: "x", "-r": true, file_path: "a" }), { args: { pattern: "x", path: "a" }, note: "Note: Grep's parameter for where to search is named `path`. `file_path` was read as `path`. `-r` was ignored: Grep always searches a directory recursively." });
  assert.deepEqual(g({ pattern: "x", head_limit: "10", "-n": "false", "-i": "true", context: " 2 " }), { args: { pattern: "x", head_limit: 10, "-n": false, "-i": true, context: 2 } });
  // (A fix whose input the schema then refuses is not used: the input as sent is refused.)
  assert.equal(g({ pattern: "x", "-l": true, output_mode: "content" }).error, "error: InputValidationError: Grep failed due to the following issue:\nAn unexpected parameter `-l` was provided");
  assert.equal(g({}).error, "error: InputValidationError: Grep failed due to the following issue:\nThe required parameter `pattern` is missing");
  assert.equal(g({ pattern: "x", ignore_case: true }).error, "error: InputValidationError: Grep failed due to the following issue:\nAn unexpected parameter `ignore_case` was provided");
  assert.equal(g({ pattern: 5, output_mode: "lines", head_limit: "ten", path: "src", file_path: "lib" }).error, 'error: InputValidationError: Grep failed due to the following issues:\nAn unexpected parameter `file_path` was provided\nThe parameter `pattern` type is expected as `string` but provided as `number`\nThe parameter `head_limit` type is expected as `number` but provided as `string`\nThe parameter `output_mode` is invalid: Invalid option: expected one of "content"|"files_with_matches"|"count"');
  assert.equal(g({ pattern: "x", path: null }).error, "error: InputValidationError: Grep failed due to the following issue:\nThe parameter `path` type is expected as `string` but provided as `null`");
  assert.equal(g({ pattern: "a\u0000b" }).error, "error: Grep pattern cannot contain null bytes (\\0). Remove the null byte and try again.");
  assert.equal(g({ pattern: "a", glob: "*\u0000" }).error, "error: Grep glob cannot contain null bytes (\\0). Remove the null byte and try again.");
  assert.equal(g({ pattern: "a", head_limit: -1 }).error, "error: head_limit must be a whole number of 0 or more, got -1. Pass 0 for unlimited.");
  assert.equal(g({ pattern: "a", offset: 1.5 }).error, "error: offset must be a whole number of 0 or more, got 1.5.");
  assert.deepEqual(g({ pattern: "a", head_limit: 0, offset: 0 }), { args: { pattern: "a", head_limit: 0, offset: 0 } });
  // Glob: strict, no file_path, null bytes.
  assert.deepEqual(S.checkGlobInput({ pattern: "*.js", path: "src" }), { args: { pattern: "*.js", path: "src" } });
  assert.equal(S.checkGlobInput({ pattern: "*.js", file_path: "src" }).error, "error: InputValidationError: Glob failed due to the following issue:\nAn unexpected parameter `file_path` was provided");
  assert.equal(S.checkGlobInput({ path: "src" }).error, "error: InputValidationError: Glob failed due to the following issue:\nThe required parameter `pattern` is missing");
  assert.equal(S.checkGlobInput({ pattern: "*", path: "a\u0000" }).error, "error: Glob path cannot contain null bytes (\\0). Remove the null byte and try again.");
});

test("SR3 Grep's three modes as Claude Code gives them: paths newest first by default, hidden files searched and version-control folders and gitignored files left out, lines as path:N:text from where the commands are, counts with their total, pages with head_limit and offset", { skip: !hasRg }, async () => {
  const d = project();
  let r = await grep(d, { pattern: "TODO" });
  assert.equal(r.text, "Found 6 files\ndocs/secret.md\nsrc/f.ts\n.github/ci.yml\nsrc/b.js\nsrc/deep/c.js\na.js");
  assert.deepEqual(r.facts, { mode: "files_with_matches", filenames: ["docs/secret.md", "src/f.ts", ".github/ci.yml", "src/b.js", "src/deep/c.js", "a.js"], numFiles: 6, totalFiles: 6 });
  r = await grep(d, { pattern: "TODO", head_limit: 2, offset: 1 });
  assert.equal(r.text, "Found 2 files limit: 2, offset: 1\nsrc/f.ts\n.github/ci.yml");
  assert.deepEqual([r.facts.appliedLimit, r.facts.appliedOffset, r.facts.totalFiles], [2, 1, 6]);
  assert.equal((await grep(d, { pattern: "TODO", offset: 9 })).text, "No entries at this offset. [Showing results with pagination = offset: 9]");
  assert.equal((await grep(d, { pattern: "nothing here" })).text, "No files found");
  // Content: path:N:text with no "./", a single file without its path, -n false, context lines and the line between groups.
  r = await grep(d, { pattern: "TODO", path: "src", output_mode: "content" });
  assert.deepEqual(r.text.split("\n").sort(), ["src/b.js:2:TODO second", "src/b.js:5:TODO third", "src/deep/c.js:1:TODO deep", "src/f.ts:1:TODO typed"]);
  assert.deepEqual([r.facts.mode, r.facts.numFiles, r.facts.numLines, r.facts.totalLines], ["content", 0, 4, 4]);
  assert.equal((await grep(d, { pattern: "TODO", path: "src/b.js", output_mode: "content" })).text, "2:TODO second\n5:TODO third");
  assert.equal((await grep(d, { pattern: "TODO", path: join(d, "src/b.js"), output_mode: "content", "-n": false })).text, "TODO second\nTODO third");
  assert.equal((await grep(d, { pattern: "TODO s", path: "src", output_mode: "content", "-A": 1 })).text, "src/b.js:2:TODO second\nsrc/b.js-3-y");
  assert.equal((await grep(d, { pattern: "TODO", path: "src/b.js", output_mode: "content", context: 1 })).text, "1-x\n2:TODO second\n3-y\n4-z\n5:TODO third");
  assert.equal((await grep(d, { pattern: "^x|TODO t", path: "src/b.js", output_mode: "content", "-C": 0, "-B": 0 })).text, "1:x\n5:TODO third");
  // (context wins over -A and -B for ripgrep, and a -A over 0 still puts Claude Code's "--" between groups apart.)
  assert.equal((await grep(d, { pattern: "TODO (second|third)", path: "src/b.js", output_mode: "content", context: 0, "-A": 1, "-B": 0 })).text, "2:TODO second\n--\n5:TODO third");
  r = await grep(d, { pattern: "[xz]", path: "src/b.js", output_mode: "content", "-C": 0, "-A": 0, "-B": 0, context: undefined, "-o": true });
  assert.equal(r.text, "1:x\n4:z");
  assert.equal((await grep(d, { pattern: "TODO", path: "src/b.js", output_mode: "content", head_limit: 1 })).text, "2:TODO second\n\n[Showing results with pagination = limit: 1]");
  assert.equal((await grep(d, { pattern: "TODO", path: "src/b.js", output_mode: "content", offset: 5 })).text, "No entries at this offset\n\n[Showing results with pagination = offset: 5]");
  assert.equal((await grep(d, { pattern: "nope", output_mode: "content" })).text, "No matches found");
  // Count: path:N, then the total over every file, pages or not.
  r = await grep(d, { pattern: "TODO", path: "src", output_mode: "count" });
  assert.deepEqual(r.text.split("\n\n")[0].split("\n").sort(), ["src/b.js:2", "src/deep/c.js:1", "src/f.ts:1"]);
  assert.equal(r.text.split("\n\n")[1], "Found 4 total occurrences across 3 files.");
  r = await grep(d, { pattern: "TODO", path: "src", output_mode: "count", head_limit: 1 });
  assert.match(r.text, /^src\/[^\n]+\n\nFound 4 total occurrences across 3 files\. with pagination = limit: 1$/);
  assert.deepEqual([r.facts.numMatches, r.facts.numFiles, r.facts.appliedLimit], [4, 3, 1]);
  assert.equal((await grep(d, { pattern: "nope", output_mode: "count" })).text, "No matches found\n\nFound 0 total occurrences across 0 files.");
  assert.equal((await grep(d, { pattern: "deep", path: "src/deep/c.js", output_mode: "count" })).text, "src/deep/c.js:1\n\nFound 1 total occurrence across 1 file.");
  // -i, type, glob split at spaces and commas but not inside braces, multiline, a pattern that starts with "-".
  assert.equal((await grep(d, { pattern: "todo typed", "-i": true })).text, "Found 1 file\nsrc/f.ts");
  assert.equal((await grep(d, { pattern: "TODO", type: "ts" })).text, "Found 1 file\nsrc/f.ts");
  assert.equal((await grep(d, { pattern: "TODO", glob: "*.ts,*.yml" })).text, "Found 2 files\nsrc/f.ts\n.github/ci.yml");
  assert.equal((await grep(d, { pattern: "TODO", glob: "*.{ts,yml}" })).text, "Found 2 files\nsrc/f.ts\n.github/ci.yml");
  assert.equal((await grep(d, { pattern: "TODO", glob: "*.md *.ts" })).text, "Found 2 files\ndocs/secret.md\nsrc/f.ts");
  assert.equal((await grep(d, { pattern: "TODO second\\ny", multiline: true, output_mode: "content" })).text, "src/b.js:2:TODO second\nsrc/b.js:3:y");
  writeFileSync(join(d, "dash.txt"), "-v here\n");
  assert.equal((await grep(d, { pattern: "-v here" })).text.split("\n")[1], "dash.txt");
  // .git never, even when a glob of the call's own would take it back.
  assert.doesNotMatch((await grep(d, { pattern: "in git", glob: "*" })).text, /\.git/);
});

test("SR4 Grep's long and binary lines and its errors in Claude Code's words: a rejected pattern, a missing path (with where the commands are), Coder's own refusals kept, and a result object for the hooks", { skip: !hasRg }, async () => {
  const d = project();
  writeFileSync(join(d, "long.txt"), "x".repeat(501) + " needle\n" + "y".repeat(500) + "\nneedle again\n");
  assert.equal((await grep(d, { pattern: "needle", path: "long.txt", output_mode: "content", "-B": 1 })).text, "1:[Omitted long matching line]\n2-" + "y".repeat(500) + "\n3:needle again");
  writeFileSync(join(d, "bin.dat"), Buffer.from("abc\u0000def needle\n"));
  assert.equal((await grep(d, { pattern: "needle", path: "bin.dat", output_mode: "content" })).text, 'binary file matches (found "\\0" byte around offset 3)');
  assert.equal(await fails(grep(d, { pattern: "foo(", output_mode: "content" })), "Search failed — ripgrep rejected the pattern, glob, or file type without searching:\nrg: regex parse error:\n    (?:foo()\n    ^\nerror: unclosed group");
  assert.match(await fails(grep(d, { pattern: "x", type: "nosuchtype" })), /^Search failed — ripgrep rejected the pattern, glob, or file type without searching:\nrg: unrecognized file type: nosuchtype/);
  assert.equal(await fails(grep(d, { pattern: "x", path: "nope" })), "Path does not exist: nope. Note: your current working directory is " + d + ".");
  assert.equal(await fails(grep(d, { pattern: "x", path: "/etc" })), "that path is outside the project");
  assert.equal(await fails(grep(d, { pattern: "x", path: ".git" })), "the .git folder is off limits");
  assert.equal(await fails(grep(d, { pattern: "a\u0000" })), "Grep pattern cannot contain null bytes (\\0). Remove the null byte and try again.", "held to its check when it comes another way");
  // "Did you mean": beside the folder the commands are in, the same path inside it.
  const outer = mkdtempSync(join(tmpdir(), "sr-dym-")), proj = join(outer, "proj");
  mkdirSync(join(proj, "lib"), { recursive: true });
  const loose = async (p) => ({ abs: p, rel: p });
  assert.equal(await fails(S.grepTool({ pattern: "x", path: join(outer, "lib") }, { base: proj, inside: loose })), "Path does not exist: " + join(outer, "lib") + ". Note: your current working directory is " + proj + ". Did you mean " + join(proj, "lib") + "?");
  // Through the machine's own run: the result object first, behind its mark, and a failure told whole.
  const run = (req) => { const r = spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: d, encoding: "utf8" }); return { code: r.status, out: r.stdout }; };
  let o = run({ tool: "grep", args: { pattern: "TODO first" } });
  assert.deepEqual(A.factsAnswer(o.out), { text: "Found 1 file\na.js", facts: { mode: "files_with_matches", filenames: ["a.js"], numFiles: 1, totalFiles: 1 } });
  o = run({ tool: "grep", args: { pattern: "(" + "x".repeat(800) } });
  assert.equal(o.code, 1);
  assert.match(o.out, /^error: Search failed — ripgrep rejected/);
  assert.ok(o.out.length > 800, "not cut at 600 characters");
  o = run({ tool: "grep", args: { pattern: "x", path: "../.." } });
  assert.deepEqual(o, { code: 1, out: "error: that path is outside the project" });
});

test("SR5 Claude Code's runner on a search that stops or fails: its partial results marked at the time limit, nothing found in time, exit 2 with results kept, a path it could not read, an unknown failure", { skip: process.platform === "win32" }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "sr-fake-")), d = project();
  const fake = (body) => { writeFileSync(join(dir, "rg"), "#!/bin/sh\n" + body + "\n"); chmodSync(join(dir, "rg"), 0o755); };
  const keep = process.env.PATH;
  process.env.PATH = dir + ":" + keep;
  try {
    fake("printf '%s\\0' \"" + join(d, "a.js") + "\"; exec sleep 30");
    let r = await grep(d, { pattern: "x" }, { timeoutMs: 300 });
    assert.equal(r.text, S.SEARCH_STOPPED + "\n\nFound 1 file\na.js");
    assert.equal(r.facts.timedOut, true);
    r = await glob(d, { pattern: "*.js" }, { timeoutMs: 300 });
    assert.equal(r.text, "The search stopped before it finished, most likely at its time limit, so these results are incomplete: more matches may exist. Search a more specific path or pattern.\n\na.js");
    assert.deepEqual([r.facts.timedOut, r.facts.countIsComplete], [true, false]);
    fake("exec sleep 30");
    assert.equal(await fails(grep(d, { pattern: "x" }, { timeoutMs: 1000 })), "Ripgrep search timed out after 1 second. The search may have matched files but did not complete in time. Try searching a more specific path or pattern.");
    assert.equal(await fails(glob(d, { pattern: "*" }, { timeoutMs: 2500 })), "Ripgrep search timed out after 2.5 seconds. The search may have matched files but did not complete in time. Try searching a more specific path or pattern.");
    fake("printf '%s\\0' \"" + join(d, "a.js") + "\"; echo 'rg: ./x: Permission denied (os error 13)' >&2; exit 2");
    assert.equal((await grep(d, { pattern: "x" })).text, "Found 1 file\na.js", "exit 2 with results keeps them");
    fake("for a; do last=$a; done; echo \"rg: $last: Permission denied (os error 13)\" >&2; exit 2");
    assert.equal(await fails(grep(d, { pattern: "x" })), 'Search failed: ripgrep could not read the path it was given (permission denied, os error 13), so nothing was searched. This is not a "no matches" result. Tell the user that the path could not be read. Do not run a recursive search in the shell instead (for example grep -r, find or rg).');
    fake("exit 3");
    assert.equal(await fails(glob(d, { pattern: "*" })), 'The search failed, so this is not a "no matches" result: matches may exist. What happened to the search program (ripgrep) is not known, and no results were read. Run the search once more. If it fails again, tell the user that searches are failing. Do not run a recursive search in the shell instead (for example grep -r, find or rg): it can reach what this tool is set to leave out.');
    // ripgrep's own config file never read: --no-config first.
    fake("echo \"$1\" > " + join(dir, "args") + "; exit 1");
    await grep(d, { pattern: "x" });
    assert.equal(readFileSync(join(dir, "args"), "utf8").trim(), "--no-config");
  } finally { process.env.PATH = keep; }
  assert.equal(S.timedOutText(20_000), "Ripgrep search timed out after 20 seconds. The search may have matched files but did not complete in time. Try searching a more specific path or pattern.");
});

test("SR6 Glob as Claude Code gives it: oldest first, gitignored and hidden files listed (never .git, Coder's), 100 at most with its note, a slash-less pattern at any depth, a full pattern searched from its own folder, ~ in path, the repeated-folder rule, its path errors", { skip: !hasRg }, async () => {
  const d = project();
  let r = await glob(d, { pattern: "*.js" });
  assert.equal(r.text, "a.js\nsrc/deep/c.js\nsrc/b.js\nnode_modules/pkg/i.js");
  assert.deepEqual(Object.keys(r.facts), ["filenames", "durationMs", "numFiles", "truncated", "totalMatches", "countIsComplete"]);
  assert.deepEqual([r.facts.numFiles, r.facts.truncated, r.facts.totalMatches, r.facts.countIsComplete], [4, false, 4, true]);
  assert.equal((await glob(d, { pattern: "**/HEAD" })).text, "No files found", ".git is never listed");
  assert.equal((await glob(d, { pattern: "*" })).text.split("\n").filter((p) => p.startsWith(".git/")).length, 0);
  assert.match((await glob(d, { pattern: "*" })).text, /^a\.js\n/);
  assert.equal((await glob(d, { pattern: "*.JS" })).text, "No files found", "case-sensitive");
  assert.equal((await glob(d, { pattern: "src/*.js" })).text, "src/b.js");
  assert.equal((await glob(d, { pattern: "./src/*.js" })).text, "No files found");
  assert.equal((await glob(d, { pattern: "store" })).text, ".hg/store");
  assert.equal((await glob(d, { pattern: "*.js" }, { hidden: false, noIgnore: false })).text, "a.js\nsrc/deep/c.js\nsrc/b.js", "CODER_GLOB_HIDDEN and CODER_GLOB_NO_IGNORE off");
  // (A gitignored file the pattern names itself is still listed: ripgrep's --glob "always overrides any other ignore logic",
  // as in Claude Code, which passes the pattern the same way; only what is inside an ignored folder is left out.)
  assert.equal((await glob(d, { pattern: "*.txt" }, { noIgnore: false })).text, "ignored.txt");
  assert.equal((await glob(d, { pattern: "**/i.js" }, { noIgnore: false })).text, "No files found");
  assert.equal((await glob(d, { pattern: "*.yml" }, { hidden: false })).text, "No files found");
  assert.equal((await glob(d, { pattern: join(d, "src") + "/*.js" })).text, "src/deep/c.js\nsrc/b.js", "a full pattern: its folder searched, the rest at any depth");
  assert.equal((await glob(d, { pattern: join(d, "src/b.js"), path: "nope" })).text, "src/b.js");
  // The repeated-folder rule: a pattern that starts with the folder the search is in.
  const src = join(d, "src");
  assert.equal((await S.globTool({ pattern: "src/b.js" }, { base: src, inside: insideOf(d) })).text, "b.js");
  mkdirSync(join(src, "src"));
  writeFileSync(join(src, "src", "b.js"), "inner\n");
  assert.equal((await S.globTool({ pattern: "src/b.js" }, { base: src, inside: insideOf(d) })).text, "src/b.js", "not when that folder is there");
  // ~ in path, not in the pattern.
  const keep = process.env.HOME;
  process.env.HOME = d;
  try {
    assert.equal((await glob(d, { pattern: "*.ts", path: "~/src" })).text, "src/f.ts");
    assert.equal((await glob(d, { pattern: "~/src/*.ts" })).text, "No files found");
  } finally { process.env.HOME = keep; }
  // Its path errors.
  assert.equal(await fails(glob(d, { pattern: "*", path: "nope" })), "Directory does not exist: nope. Note: your current working directory is " + d + ".");
  assert.equal(await fails(glob(d, { pattern: "*", path: "a.js" })), "Path is not a directory: a.js");
  assert.equal(await fails(glob(d, { pattern: "a{b" })), "Search failed — ripgrep rejected the pattern, glob, or file type without searching:\nrg: error parsing glob 'a{b': unclosed alternate group; missing '}' (maybe escape '{' with '[{]'?)");
  // 100 at most, the oldest, with Claude Code's note.
  const many = join(d, "many");
  mkdirSync(many);
  for (let k = 0; k < 151; k++) { const f = join(many, "f" + String(k).padStart(3, "0") + ".txt"); writeFileSync(f, ""); const t = new Date(Date.UTC(2025, 0, 1, 0, k)); utimesSync(f, t, t); }
  r = await glob(d, { pattern: "*.txt", path: "many" });
  const lines = r.text.split("\n");
  assert.equal(lines.length, 101);
  assert.deepEqual([lines[0], lines[99]], ["many/f000.txt", "many/f099.txt"]);
  assert.equal(lines[100], "(Showing 100 of 151 matching files; 51 more are not listed. Narrow the pattern or path to see the rest.)");
  assert.deepEqual([r.facts.truncated, r.facts.totalMatches, r.facts.countIsComplete, r.facts.numFiles], [true, 151, true, 100]);
  assert.equal(S.globCapNote({ filenames: ["a"], totalMatches: 100, countIsComplete: false }), "(Showing the first 1 files; there are more than 100 matches. Narrow the pattern or path to see the rest.)");
  assert.equal(S.globCapNote({ filenames: ["a"] }), "(Results are truncated. Consider using a more specific path or pattern.)");
});

test("SR7 the owner's Read deny rules inside the search and before its limits, as Claude Code's (--iglob, then each result checked): Grep's lines, paths and counts and Glob's list leave out what they cover, and Glob's count past them is a floor", { skip: !hasRg }, async () => {
  const d = project();
  const deny = { rules: ["Read(docs/**)", "Read(*.ts)", "Edit(src/**)"], sources: null, root: d, home: "" };
  assert.deepEqual(S.denyGlobs(deny, d), ["!**/docs/**", "!**/docs", "!**/*.ts"]);
  assert.deepEqual(S.denyGlobs({ rules: ["Read(/src/deep/**)", "Read(//etc/**)", "Read(a[bc].js)", "Read(!x)", "Read({a}.js)"], root: d }, d), ["!/src/deep/**", "!/src/deep", "!**/[{]a[}].js"]);
  assert.equal((await grep(d, { pattern: "TODO" }, { deny })).text, "Found 4 files\n.github/ci.yml\nsrc/b.js\nsrc/deep/c.js\na.js");
  assert.equal((await grep(d, { pattern: "TODO", output_mode: "count", head_limit: 1 }, { deny })).facts.numFiles, 4);
  assert.doesNotMatch((await grep(d, { pattern: "TODO", output_mode: "content" }, { deny })).text, /secret|typed/);
  assert.doesNotMatch((await glob(d, { pattern: "**/*" }, { deny })).text, /secret|f\.ts/);
  // (A rule with a class is left to the check after: still left out.)
  assert.equal((await grep(d, { pattern: "TODO" }, { deny: { rules: ["Read(src/[bc].js)"], root: d } })).text.split("\n").includes("src/b.js"), false);
  // Glob's 100 past deny rules: the files after them judged in order, so the count is a floor.
  const many = join(d, "many");
  mkdirSync(many);
  for (let k = 0; k < 105; k++) { const f = join(many, "f" + String(k).padStart(3, "0") + (k < 3 ? ".secret" : ".txt")); writeFileSync(f, ""); const t = new Date(Date.UTC(2025, 0, 1, 0, k)); utimesSync(f, t, t); }
  const r = await glob(d, { pattern: "f*", path: "many" }, { deny: { rules: ["Read(*.secret)"], root: d } });
  assert.equal(r.text.split("\n")[0], "many/f003.txt");
  assert.equal(r.text.split("\n").at(-1), "(Showing the first 100 files; there are more than 100 matches. Narrow the pattern or path to see the rest.)");
  assert.deepEqual([r.facts.totalMatches, r.facts.countIsComplete, r.facts.truncated], [100, false, true]);
});

// Coder's loop with the tools run for real on a project.
async function loop(d, steps, { rules = {}, hooks = null, hookRun = () => ({}), saved = [], settings = null } = {}) {
  const events = [], hookCalls = [], requests = [];
  let n = 0;
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push(input); const a = (await hookRun(input)) || {}; return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") }; }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (!tm) return { code: 0, output: "ok\n" };
      const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
      requests.push({ req, x });
      const out = spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: d, encoding: "utf8" });
      return { code: out.status, output: out.stdout };
    },
    emit: (e) => events.push(e),
    here: () => d, root: d, chatId: "sr-chat", where: (p) => (p.startsWith("/") ? p : d + "/" + p),
    ask: async () => ({ choice: "yes" }),
    saveText: (text) => { const f = join(d, ".out-" + saved.length + ".txt"); writeFileSync(f, text); saved.push(f); return f; },
    ...(settings ? { searchSettings: settings } : {}),
  }, { text: "go", mode: "auto", messages: [], rules, hooks: hooks ? H.hooksFrom({ hooks }, "settings").list : [] });
  return { r, events, hookCalls, requests, answer: (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content };
}
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("SR8 in Coder's loop: the search gets the owner's Read deny rules and the settings, its hooks see Claude Code's input names and its GrepOutput and GlobOutput, a fix's note comes after the answer, a refusal fires no hook, and a long result is saved in Claude Code's words", { skip: !hasRg }, async () => {
  const d = project();
  for (let k = 0; k < 2000; k++) writeFileSync(join(d, "src", "gen" + k + ".js"), "TODO generated " + k + "\n");
  const hooks = { PreToolUse: [{ matcher: "Grep|Glob", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUse: [{ matcher: "Grep|Glob", hooks: [{ type: "command", command: "post.sh" }] }] };
  const saved = [];
  const t = await loop(d, [say("", [call("grep", { pattern: "TODO first", file_path: "." }, "g1"), call("glob", { pattern: "**/*.md" }, "f1"), call("grep", { pattern: "x", path: "a\u0000" }, "g2"), call("grep", { pattern: "TODO generated", output_mode: "content", head_limit: 0 }, "g3")]), say("done")], { rules: { deny: ["Read(docs/**)"] }, hooks, saved, settings: { timeoutMs: 15_000, hidden: true, noIgnore: true } });
  // The request: Grok's input as checked, and Coder's own context.
  const g1 = t.requests.find((x) => x.req.args.pattern === "TODO first");
  assert.deepEqual(g1.req.args, { pattern: "TODO first", path: "." });
  // (And what the loop's permission check saw of the path, its spellings, which the search checks again before it runs:
  // Claude Code's stash and its gPo, round 3.)
  assert.deepEqual(g1.req.ctx, { timeoutMs: 15_000, hidden: true, noIgnore: true, deny: { rules: ["Read(docs/**)"], sources: null, root: d, home: "" }, spellings: { path: d, list: S.pathSpellings(d).spellings } });
  assert.equal(g1.x.timeoutS, 45);
  assert.equal(t.answer("g1"), "Found 1 file\na.js\n\nNote: Grep's parameter for where to search is named `path`. `file_path` was read as `path`.");
  assert.equal(t.answer("f1"), "No files found", "the Read deny rule leaves docs/secret.md out");
  assert.equal(t.answer("g2"), "error: Grep path cannot contain null bytes (\\0). Remove the null byte and try again.");
  const pre = t.hookCalls.filter((x) => x.hook_event_name === "PreToolUse");
  assert.deepEqual(pre.map((x) => x.tool_name), ["Grep", "Glob", "Grep"], "the refused call fired no hook");
  assert.deepEqual(pre[0].tool_input, { pattern: "TODO first", path: "." });
  const post = t.hookCalls.filter((x) => x.hook_event_name === "PostToolUse");
  assert.deepEqual(post[0].tool_response, { mode: "files_with_matches", filenames: ["a.js"], numFiles: 1, totalFiles: 1 });
  assert.deepEqual([post[1].tool_response.numFiles, post[1].tool_response.truncated, typeof post[1].tool_response.durationMs], [0, false, "number"]);
  // A long result: past 20,000 characters, saved, its path and its first 2 KB given.
  const g3 = t.answer("g3");
  assert.equal(saved.length, 1);
  assert.match(g3, new RegExp("^<persisted-output>\\nOutput too large \\(\\d+(\\.\\d)?KB\\)\\. Full output saved to: " + saved[0].replace(/[.]/g, "\\.") + "\\n\\nPreview \\(first 2KB\\):\\nsrc/gen"));
  assert.match(g3, /\n\.\.\.\n<\/persisted-output>$/);
  assert.ok(g3.length < 2600);
  assert.equal(readFileSync(saved[0], "utf8").split("\n").length, 2000);
  assert.equal(post[2].tool_response.numLines, 2000);
});

test("SR9 the owner's rules on Grep's and Glob's inputs as Claude Code reads them: Grep(param:value) and Glob(param:value) deny and ask (never on path), its words for them and for a Read rule's question, and a hook's if on the pattern", () => {
  assert.deepEqual(P.parseRule("Grep(output_mode:content)"), { tool: "Grep", spec: "output_mode:content", param: { name: "output_mode", value: "content" } });
  assert.deepEqual(P.parseRule("Glob(pattern : *.env)"), { tool: "Glob", spec: "pattern : *.env", param: { name: "pattern", value: "*.env" } });
  assert.equal(P.parseRule("Grep(path:src)"), null);
  assert.equal(P.parseRule("Glob(type:js)"), null, "Glob has no type");
  assert.equal(P.ruleSaved("Grep(-i:true)"), true);
  assert.deepEqual(P.ruleWarning("deny", "Grep(path:src)"), { warning: 'Permission deny rule "Grep(path:src)" targets path as a raw string and will not match.', notice: "Deny rule Grep(path:src) never matches" });
  assert.deepEqual(P.ruleWarning("ask", "Glob(path:src)"), { warning: 'Permission ask rule "Glob(path:src)" targets path as a raw string and will not match — use Read(…) to match file-read paths.', notice: "Ask rule Glob(path:src) never matches · use Read(…)" });
  assert.equal(P.ruleWarning("deny", "Grep(output_mode:content)"), null);
  const ROOT = "/work/shop";
  const fd = (tool, path, rules, input) => P.fileToolDecision(tool, path, { rules, root: ROOT, home: "/home/dev", input });
  assert.deepEqual(fd("grep", ROOT, { deny: ["Grep(output_mode:content)"] }, { pattern: "x", output_mode: "content" }), { verdict: "deny", rule: "Grep(output_mode:content)", why: "Permission to use Grep with output_mode:content has been denied." });
  assert.equal(fd("grep", ROOT, { deny: ["Grep(output_mode:content)"] }, { pattern: "x" }).verdict, "", "a parameter the model omits is never matched");
  assert.equal(fd("grep", ROOT, { deny: ["Grep(pattern:pass*)"] }, { pattern: "password=" }).verdict, "deny");
  assert.equal(fd("grep", ROOT, { deny: ["Grep(-i:true)"] }, { pattern: "x", "-i": true }).verdict, "deny");
  assert.equal(fd("glob", ROOT, { deny: ["Glob(pattern:**/*.env)"] }, { pattern: "**/*.env" }).verdict, "deny");
  assert.equal(fd("grep", ROOT, { allow: ["Grep(output_mode:content)"] }, { pattern: "x", output_mode: "content" }).verdict, "", "allow rules don't take it");
  assert.deepEqual(fd("grep", ROOT, { ask: ["Grep(head_limit:0)"] }, { pattern: "x", head_limit: 0 }), { verdict: "ask", rule: "Grep(head_limit:0)", why: "Coder requested permissions to use Grep, but you haven't granted it yet." });
  assert.deepEqual(fd("glob", ROOT, { ask: ["Glob"] }, { pattern: "*" }), { verdict: "ask", rule: "Glob", why: "Coder requested permissions to use Glob, but you haven't granted it yet." });
  assert.deepEqual(fd("grep", ROOT + "/docs", { ask: ["Read(docs/**)", "Grep"] }, { pattern: "x" }), { verdict: "ask", rule: "Read(docs/**)", why: "Coder requested permissions to read from /work/shop/docs, but you haven't granted it yet." });
  assert.equal(fd("grep", ROOT + "/docs", { deny: ["Read(docs/**)"] }, { pattern: "x" }).why, "Permission to read /work/shop/docs has been denied.");
  assert.equal(fd("read", ROOT + "/a.md", { ask: ["Read(*.md)"] }).why, "Your rule Read(*.md) asks first for reading /work/shop/a.md.", "read's own wording is not this change's");
  // A hook's if: the rule's content against the call's pattern (Claude Code's wildcard).
  const m = (rule, pattern, tool = "Grep") => P.ifRuleMatches(rule, tool, { pattern, path: "src" }, { cwd: ROOT, root: ROOT });
  assert.equal(m("Grep(TODO*)", "TODO.*fix"), true);
  assert.equal(m("Grep(TODO*)", "FIXME"), false);
  assert.equal(m("Grep(src/**)", "TODO"), false, "not the path");
  assert.equal(m("Glob(**/*.ts)", "**/*.ts", "Glob"), true);
  assert.equal(m("Glob(src/**/*.ts)", "src/a/b/x.ts", "Glob"), true);
  assert.equal(m("Grep(a\\*b)", "a*b"), true);
  assert.equal(m("Grep(a\\*b)", "axxb"), false);
  assert.equal(m("Grep(git *)", "git"), true, "a trailing ' *' after the only star also matches nothing");
  assert.equal(P.ruleWildcardMatches("x*", "x\ny"), true, "across lines");
  const hk = H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "Grep", hooks: [{ type: "command", command: "a.sh", if: "Grep(TODO*)" }] }] } }, "settings").list;
  assert.equal(H.hooksFor(hk, "PreToolUse", "Grep", { tool: "Grep", input: { pattern: "TODO now" }, ctx: { cwd: ROOT, root: ROOT } }).length, 1);
  assert.equal(H.hooksFor(hk, "PreToolUse", "Grep", { tool: "Grep", input: { pattern: "other" }, ctx: { cwd: ROOT, root: ROOT } }).length, 0);
});

test("SR13 a Grep(…) or Glob(…) rule with any other text (a pattern, a path, a glob) matches no call, in a deny, ask or allow list, as in Claude Code 2.1.325: it matches such text only for a hook's if (its preparePermissionMatcher), and its permission check takes no Grep or Glob path rule (\"A Grep(docs/**) deny rule doesn't stop Grep from searching docs\")", () => {
  const ROOT = "/work/shop";
  const fd = (tool, path, rules, input) => P.fileToolDecision(tool, path, { rules, root: ROOT, home: "/home/dev", input });
  const cases = [["grep", "Grep(TODO)", { pattern: "TODO" }], ["grep", "Grep(TODO*)", { pattern: "TODO now" }], ["grep", "Grep(src/**)", { pattern: "x", path: "src" }], ["glob", "Glob(*.js)", { pattern: "*.js" }], ["glob", "Glob(src/**)", { pattern: "**", path: "src" }]];
  for (const kind of ["deny", "ask", "allow"]) for (const [tool, rule, input] of cases) assert.deepEqual(fd(tool, ROOT + "/src", { [kind]: [rule] }, input), { verdict: "", rule: "", why: "" }, kind + " " + rule);
  // (Kept, never matched: the parser gives no rule to match, and the whole tool's rule is still Grep or Glob alone.)
  for (const [, rule] of cases) { assert.equal(P.parseRule(rule), null, rule); assert.equal(P.ruleSaved(rule), true, rule); }
  assert.equal(P.wholeRule({ deny: ["Grep(TODO)"] }, "deny", "Grep"), "");
});

test("SR10 the environment's search settings as Claude Code reads its variables, under Coder's names, a repository's CLAUDE_CODE_GLOB_* mapped onto them, and handed to the search", async () => {
  assert.deepEqual(S.searchSettingsFrom({}), { timeoutMs: 20_000, hidden: true, noIgnore: true });
  assert.deepEqual(S.searchSettingsFrom({ CODER_GLOB_TIMEOUT_SECONDS: "45", CODER_GLOB_HIDDEN: "false", CODER_GLOB_NO_IGNORE: "0" }), { timeoutMs: 45_000, hidden: false, noIgnore: false });
  assert.deepEqual(S.searchSettingsFrom({ CODER_GLOB_TIMEOUT_SECONDS: "0", CODER_GLOB_HIDDEN: "1", CODER_GLOB_NO_IGNORE: "" }), { timeoutMs: 20_000, hidden: true, noIgnore: true });
  assert.equal(S.searchSettingsFrom({ CODER_GLOB_TIMEOUT_SECONDS: "abc" }).timeoutMs, 20_000);
  assert.equal(S.searchSettingsFrom({ CODER_GLOB_TIMEOUT_SECONDS: "0.5" }).timeoutMs, 500);
  const Srv = await import("../container/server.mjs");
  assert.deepEqual([Srv.REPO_OWN_ENV.CLAUDE_CODE_GLOB_TIMEOUT_SECONDS, Srv.REPO_OWN_ENV.CLAUDE_CODE_GLOB_HIDDEN, Srv.REPO_OWN_ENV.CLAUDE_CODE_GLOB_NO_IGNORE], ["CODER_GLOB_TIMEOUT_SECONDS", "CODER_GLOB_HIDDEN", "CODER_GLOB_NO_IGNORE"]);
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /searchSettings: searchSettingsFrom\(rawVars\),/);
});

test("SR11 an agent hook's own grep and glob (read, grep and glob only, under the owner's Read rules): the search gets the owner's Read deny rules, and the hook's model gets the text alone, never the result object", { skip: !hasRg }, async () => {
  const d = project();
  const judged = [], requests = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "npm test" }, "b1")]), say("ok")];
  const r = await A.runCoder({
    send: async (req) => {
      const sys = String((req.messages[0] && req.messages[0].content) || "");
      if (sys.startsWith(H.HOOK_JUDGE)) { judged.push(req); return judged.length === 1 ? say("", [call("grep", { pattern: "TODO" }, "h1"), call("glob", { pattern: "**/*.md" }, "h2")]) : say('{"ok": true}'); }
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => {
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (!tm) return { code: 0, output: "ok\n" };
      const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
      requests.push({ req, x });
      const out = spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: d, encoding: "utf8" });
      return { code: out.status, output: out.stdout };
    },
    emit: () => {}, here: () => d, root: d, chatId: "sr-hook", where: (p) => (p.startsWith("/") ? p : d + "/" + p), ask: async () => ({ choice: "yes" }),
  }, { text: "go", mode: "auto", messages: [], rules: { deny: ["Read(docs/**)"] }, hooks: H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "agent", prompt: "Is there a TODO left?" }] }] } }, "settings").list });
  assert.ok(r);
  const back = judged[1].messages.filter((m) => m.role === "tool").map((m) => m.content);
  assert.equal(back[0], "Found 5 files\nsrc/f.ts\n.github/ci.yml\nsrc/b.js\nsrc/deep/c.js\na.js", "docs/secret.md left out by the Read deny rule, inside the search");
  assert.equal(back[1], "No files found");
  assert.ok(!back.some((b) => b.includes("coder-facts")), "the result object is never the hook's");
  const g = requests.find((x) => x.req.tool === "grep");
  assert.deepEqual(g.req.ctx.deny.rules, ["Read(docs/**)"]);
  assert.equal(g.x.timeoutS, 50);
});

test("SR12 (Claude Code 2.1.325; the owner, 2026-11-14: \"Fix base on Claude Code docs, please\") zod's own list when only a value is wrong; a glob's full pattern names its folder for the rules (the folder before the last / ahead of its first wildcard, or the file's own), one starting with ~ is searched as it is; results cut short by any SIGTERM or SIGKILL marked incomplete; a fix's note only on a call that worked; a rule on the whole Read tool is Read's own, Read(**) a path; no warning for a Grep path rule", { skip: !hasRg }, async () => {
  // Only a value wrong: zod's list, as Claude Code returns it.
  assert.equal(S.checkGrepInput({ pattern: "x", output_mode: "lines" }).error, "error: InputValidationError: " + JSON.stringify([{ code: "invalid_value", values: ["content", "files_with_matches", "count"], path: ["output_mode"], message: 'Invalid option: expected one of "content"|"files_with_matches"|"count"' }], null, 2));
  const d = project();
  // A full pattern's folder: before the last "/" ahead of its first wildcard (here the project's own, which no rule covers:
  // the search runs, its results under src left out); with none, the file's own folder.
  let t = await loop(d, [say("", [call("glob", { pattern: d + "/src*/b.js" }, "f1"), call("glob", { pattern: d + "/src/b.js" }, "f2")]), say("done")], { rules: { deny: ["Read(src/**)"] } });
  assert.equal(t.answer("f1"), "No files found");
  assert.equal(t.answer("f2"), "Permission to read " + d + "/src has been denied.");
  // A pattern starting with "~": no full pattern (Claude Code: not absolute), searched as it is from the search's folder.
  const events = [];
  let n = 0;
  const steps = [say("", [call("glob", { pattern: "~/notes/*.md" }, "f3")]), say("done")];
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, 1)],
    exec: async (x) => { const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command)); if (!tm) return { code: 0, output: "" }; const out = spawnSync("node", ["--no-warnings", TOOLS, tm[1]], { cwd: d, encoding: "utf8" }); return { code: out.status, output: out.stdout }; },
    emit: (e) => events.push(e), here: () => d, root: d, home: "/home/someone", where: (p) => (p.startsWith("/") ? p : d + "/" + p), ask: async () => ({ choice: "yes" }),
  }, { text: "go", mode: "auto", messages: [], rules: { deny: ["Read(~/**)"] } });
  assert.equal(r.messages.find((m) => m.tool_call_id === "f3").content, "No files found", "not refused as the home folder's");
  // Results cut short by a kill from outside the search (the system, out of memory): marked, as at the time limit.
  const dir = mkdtempSync(join(tmpdir(), "sr-kill-"));
  writeFileSync(join(dir, "rg"), "#!/bin/sh\nprintf '%s\\0' \"" + join(d, "a.js") + "\"; kill -KILL $$\n");
  chmodSync(join(dir, "rg"), 0o755);
  const keep = process.env.PATH;
  process.env.PATH = dir + ":" + keep;
  try {
    const g = await grep(d, { pattern: "x" }, { timeoutMs: 60_000 });
    assert.deepEqual([g.text, g.facts.timedOut], [S.SEARCH_STOPPED + "\n\nFound 1 file\na.js", true]);
    const f = await glob(d, { pattern: "*.js" }, { timeoutMs: 60_000 });
    assert.deepEqual([f.text, f.facts.timedOut, f.facts.countIsComplete], [S.SEARCH_STOPPED + "\n\na.js", true, false]);
  } finally { process.env.PATH = keep; }
  // A fix's note only after an answer that is not an error (Claude Code adds its "Note: …" to a result that worked).
  t = await loop(d, [say("", [call("grep", { pattern: "x", file_path: "nope" }, "g1"), call("grep", { pattern: "TODO first", file_path: "." }, "g2")]), say("done")]);
  assert.doesNotMatch(t.answer("g1"), /Note: Grep's parameter/);
  assert.match(t.answer("g2"), /\n\nNote: Grep's parameter for where to search is named `path`\. `file_path` was read as `path`\.$/);
  // A rule on the whole Read tool (Read, Read(*), a wildcard naming Read) is Read's alone: Grep, Glob and LSP go by Read rules
  // on a path (Claude Code's path matcher skips a rule with no path); Read(**) is a path; a whole Read deny still blocks write.
  const dec = (tool, p, rules) => P.fileToolDecision(tool, p, { rules, root: d });
  for (const deny of [["Read"], ["Read(*)"], ["Rea*"]]) {
    for (const tool of ["grep", "glob", "lsp"]) assert.equal(dec(tool, tool === "lsp" ? d + "/a.js" : d, { deny }).verdict, "", tool + " " + deny[0]);
    assert.deepEqual(dec("read", d + "/a.js", { deny }).verdict, "deny", "read " + deny[0]);
  }
  assert.equal(dec("read", d + "/a.js", { deny: ["Read"] }).why, "Permission to use Read has been denied.");
  assert.equal(dec("write", d + "/a.js", { deny: ["Read"] }).why, "File is covered by a Read deny rule in your permission settings and cannot be written.");
  for (const tool of ["grep", "glob"]) assert.equal(dec(tool, d, { ask: ["Read"] }).verdict, "", tool + " ask");
  assert.equal(dec("grep", d, { deny: ["Read(**)"] }).why, "Permission to read " + d + " has been denied.");
  // (And a search's results: a whole Read deny rule beside a path one leaves out only what the path one covers.)
  assert.equal((await grep(d, { pattern: "TODO" }, { deny: { rules: ["Read", "Read(*.ts)"], root: d } })).text.split("\n").includes("a.js"), true);
  // No warning for a Grep rule with a path (Claude Code warns of Write's, NotebookEdit's, MultiEdit's and Glob's only).
  assert.equal(P.ruleWarning("deny", "Grep(src/**)"), null);
  assert.equal(P.ruleWarning("allow", "Grep(src/**)"), null);
  assert.match(P.ruleWarning("deny", "Glob(src/**)").warning, /^Glob\(src\/\*\*\) is not matched by file permission checks/);
  assert.equal(P.ruleSaved("Grep(src/**)"), true, "still kept");
});

// ── ROUND 3 (2026-11-14, the owner: "yes pls all of that") ──────────────────────────────────────────────────────────────
test("SR14 a search in a folder runs inside it, as Claude Code 2.1.325's does (its gPo: ripgrep's folder the searched one, held open, the search \".\"): a glob with a \"/\" counts from the searched folder (Coder's counted from where the commands are and found nothing), in Grep and Glob and a full Glob pattern; files are named from where the commands are; a file is given to ripgrep open and named as asked; deny rules inside the folder are still left out", { skip: !hasRg || process.platform !== "linux" }, async () => {
  const d = mkdtempSync(join(tmpdir(), "sr-in-"));
  for (const x of ["packages/app/src/deep", "src", "coder/container"]) mkdirSync(join(d, x), { recursive: true });
  writeFileSync(join(d, "packages/app/src/a.ts"), "TODO a\n");
  writeFileSync(join(d, "packages/app/src/deep/b.ts"), "TODO b\n");
  writeFileSync(join(d, "src/c.ts"), "TODO c\n");
  for (const n of ["coder-scrub", "coder-search", "coder-shell", "other"]) writeFileSync(join(d, "coder/container", n + ".mjs"), n === "coder-search" ? "export const SEARCH_TIMEOUT_MS = 20_000;\n" : "x\n");
  // The recheck's own two, from a repository's folder: Glob("container/coder-s*.mjs", path "coder") and Grep(glob
  // "container/*.mjs", path "coder"), which Claude Code answered with the files and Coder with "No files found".
  assert.deepEqual((await glob(d, { pattern: "container/coder-s*.mjs", path: "coder" })).text.split("\n").sort(), ["coder/container/coder-scrub.mjs", "coder/container/coder-search.mjs", "coder/container/coder-shell.mjs"]);
  assert.equal((await grep(d, { pattern: "SEARCH_TIMEOUT_MS =", path: "coder", glob: "container/*.mjs" })).text, "Found 1 file\ncoder/container/coder-search.mjs");
  assert.deepEqual((await glob(d, { pattern: "src/**/*.ts", path: "packages/app" })).text.split("\n").sort(), ["packages/app/src/a.ts", "packages/app/src/deep/b.ts"]);
  assert.equal((await grep(d, { pattern: "TODO", path: "packages/app", glob: "src/*.ts" })).text, "Found 1 file\npackages/app/src/a.ts");
  assert.equal((await grep(d, { pattern: "TODO", path: "packages/app", glob: "src/*.ts", output_mode: "content" })).text, "packages/app/src/a.ts:1:TODO a");
  const counted = (await grep(d, { pattern: "TODO", path: "packages/app", glob: "src/**", output_mode: "count" })).text.split("\n\n");
  assert.deepEqual([counted[0].split("\n").sort(), counted[1]], [["packages/app/src/a.ts:1", "packages/app/src/deep/b.ts:1"], "Found 2 total occurrences across 2 files."]);
  // (A pattern with no "/" is as before, at any depth.)
  assert.deepEqual((await glob(d, { pattern: "*.ts", path: "packages" })).text.split("\n").sort(), ["packages/app/src/a.ts", "packages/app/src/deep/b.ts"]);
  // A full Glob pattern: its folder searched from inside, so the rest of it, "a*/src/*.ts", counts from there.
  assert.equal((await glob(d, { pattern: join(d, "packages") + "/a*/src/*.ts" })).text, "packages/app/src/a.ts");
  // The commands in another folder: a file outside it by its full path (Claude Code's Kit).
  assert.equal((await glob(d, { pattern: "src/*.ts", path: join(d, "packages/app") }, { base: join(d, "src") })).text, join(d, "packages/app/src/a.ts"));
  assert.equal((await glob(d, { pattern: "deep/*.ts", path: join(d, "packages/app/src") }, { base: join(d, "packages/app") })).text, "src/deep/b.ts");
  // A file: given open (ripgrep reads /proc/self/fd/3), named as asked, in every mode.
  assert.equal((await grep(d, { pattern: "TODO", path: "packages/app/src/a.ts" })).text, "Found 1 file\npackages/app/src/a.ts");
  assert.equal((await grep(d, { pattern: "TODO", path: "packages/app/src/a.ts", output_mode: "count" })).text, "packages/app/src/a.ts:1\n\nFound 1 total occurrence across 1 file.");
  assert.equal((await grep(d, { pattern: "TODO", path: "packages/app/src/a.ts", output_mode: "content" })).text, "1:TODO a");
  // A Read deny rule anchored at the project, on a folder inside the one searched: ripgrep is told it from inside the folder
  // ("!/src/deep/**"), and the result is left out.
  const deny = { rules: ["Read(/packages/app/src/deep/**)"], root: d, home: "" };
  assert.deepEqual(S.denyGlobs(deny, join(d, "packages/app")), ["!/src/deep/**", "!/src/deep"]);
  assert.equal((await glob(d, { pattern: "**/*.ts", path: "packages/app" }, { deny })).text, "packages/app/src/a.ts");
  assert.equal((await grep(d, { pattern: "TODO", path: "packages/app" }, { deny })).text, "Found 1 file\npackages/app/src/a.ts");
  // Through the tools script, as Coder's machine runs it.
  const run = (tool, args) => spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool, args })).toString("base64")], { cwd: d, encoding: "utf8" }).stdout.replace(/^\u0000coder-facts\u0000[^\n]*\n/, "");
  assert.equal(run("grep", { pattern: "SEARCH_TIMEOUT_MS =", path: "coder", glob: "container/*.mjs" }), "Found 1 file\ncoder/container/coder-search.mjs");
  assert.deepEqual(run("glob", { pattern: "container/coder-s*.mjs", path: "coder" }).split("\n").sort(), ["coder/container/coder-scrub.mjs", "coder/container/coder-search.mjs", "coder/container/coder-shell.mjs"]);
});

/** The tools script run as a user that is not root (root enters any folder): its files copied where that user can read them. */
function asOtherUser(cwd, tool, args) {
  const req = Buffer.from(JSON.stringify({ tool, args })).toString("base64");
  const strip = (s) => String(s || "").replace(/^\u0000coder-facts\u0000[^\n]*\n/, "");
  if (!(typeof process.getuid === "function" && process.getuid() === 0)) { const r = spawnSync("node", ["--no-warnings", TOOLS, req], { cwd, encoding: "utf8" }); return strip(r.stdout); }
  const mods = mkdtempSync(join(tmpdir(), "sr-mods-"));
  chmodSync(mods, 0o755);
  // (The tools script and every module it loads, found from its own imports.)
  const todo = ["coder-tools.mjs"], seen = new Set();
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const text = readFileSync(join(import.meta.dirname, "../container", f), "utf8");
    writeFileSync(join(mods, f), text);
    chmodSync(join(mods, f), 0o644);
    for (const m of text.matchAll(/^import [^;]*?from "\.\/([^"]+)";/gm)) todo.push(m[1]);
  }
  const r = spawnSync(process.execPath, ["--no-warnings", join(mods, "coder-tools.mjs"), req], { cwd, encoding: "utf8", uid: 65534, gid: 65534, env: { PATH: process.env.PATH, HOME: "/tmp", TMPDIR: "/tmp" } });
  return strip(r.stdout);
}
test("SR15 a folder Coder can't enter or can't read, and a file it can't read, are refused in Claude Code's own words before ripgrep runs (2.1.325's gPo: \"Cannot search …: the directory is not traversable (no execute permission).\", \"Refusing to search …: it could not be opened (EACCES) — it is unreadable, or is being replaced concurrently.\"); Coder had said \"No files found\" for a folder it could read but not enter, though its file held the word", { skip: !hasRg || process.platform !== "linux" }, () => {
  const d = mkdtempSync(join(tmpdir(), "sr-perm-"));
  chmodSync(d, 0o755);
  for (const x of ["rnox", "nor", "ok"]) mkdirSync(join(d, x));
  writeFileSync(join(d, "rnox/f.txt"), "word here\n"); writeFileSync(join(d, "nor/g.txt"), "word\n"); writeFileSync(join(d, "ok/h.txt"), "word\n"); writeFileSync(join(d, "secret.txt"), "word\n");
  chmodSync(join(d, "rnox/f.txt"), 0o644); chmodSync(join(d, "ok/h.txt"), 0o644); chmodSync(join(d, "ok"), 0o755);
  chmodSync(join(d, "rnox"), 0o644); chmodSync(join(d, "nor"), 0o000); chmodSync(join(d, "secret.txt"), 0o600);
  try {
    const traverse = "error: " + S.notTraversableText(join(d, "rnox"));
    assert.equal(traverse, "error: Cannot search " + join(d, "rnox") + ": the directory is not traversable (no execute permission).");
    assert.equal(asOtherUser(d, "grep", { pattern: "word", path: "rnox" }), traverse);
    assert.equal(asOtherUser(d, "glob", { pattern: "*.txt", path: "rnox" }), traverse);
    const unreadable = (p) => "error: Refusing to search " + p + ": it could not be opened (EACCES) — it is unreadable, or is being replaced concurrently.";
    assert.equal("error: " + S.unopenableText(join(d, "nor"), "EACCES"), unreadable(join(d, "nor")));
    assert.equal(asOtherUser(d, "grep", { pattern: "word", path: "nor" }), unreadable(join(d, "nor")));
    assert.equal(asOtherUser(d, "glob", { pattern: "*", path: "nor" }), unreadable(join(d, "nor")));
    assert.equal(asOtherUser(d, "grep", { pattern: "word", path: "secret.txt" }), unreadable(join(d, "secret.txt")));
    // What it can open and enter is searched as before.
    assert.equal(asOtherUser(d, "grep", { pattern: "word", path: "ok", output_mode: "content" }), "ok/h.txt:1:word");
    assert.equal(asOtherUser(d, "grep", { pattern: "word", path: "ok/h.txt", output_mode: "count" }), "ok/h.txt:1\n\nFound 1 total occurrence across 1 file.");
  } finally { chmodSync(join(d, "rnox"), 0o755); chmodSync(join(d, "nor"), 0o755); }
});

test("SR16 the search's links are as Coder's permission check saw them, as Claude Code 2.1.325 checks them again right before ripgrep runs (\"Refusing to search …: its symlink resolution changed after permission was checked. If a link in the working directory is being rewritten concurrently, stop that and retry.\"): Coder's loop sends what its check saw of the path (its spellings: the path, where each link at its end leads, where it lands); a link moved since is refused; another path's are not used; with none, the tools' own check stands in", { skip: !hasRg || process.platform !== "linux" }, async () => {
  const d = mkdtempSync(join(tmpdir(), "sr-link-"));
  for (const x of ["a", "b"]) mkdirSync(join(d, x));
  writeFileSync(join(d, "a/x.txt"), "TODO in a\n"); writeFileSync(join(d, "b/y.txt"), "TODO in b\n");
  symlinkSync(join(d, "a"), join(d, "link"));
  // Spellings: the path, each link at its end followed, and where it lands.
  assert.deepEqual(S.pathSpellings(join(d, "link")), { spellings: [join(d, "link"), join(d, "a")], unresolved: false, found: true });
  assert.deepEqual(S.pathSpellings(join(d, "a")), { spellings: [join(d, "a")], unresolved: false, found: true });
  assert.deepEqual(S.pathSpellings(join(d, "link/nope/z")), { spellings: [join(d, "link/nope/z"), join(d, "a/nope/z")], unresolved: false, found: false }, "not there: from the deepest folder that is");
  symlinkSync(join(d, "loop2"), join(d, "loop1")); symlinkSync(join(d, "loop1"), join(d, "loop2"));
  assert.equal(S.pathSpellings(join(d, "loop1")).unresolved, true);
  assert.deepEqual(S.checkedAt(join(d, "link")), { path: join(d, "link"), list: [join(d, "link"), join(d, "a")] });
  assert.equal(S.checkedAt(join(d, "nope")), null, "one its view can't follow there: none sent");
  const seen = S.checkedAt(join(d, "link"));
  // As checked: searched, named as asked.
  assert.equal((await grep(d, { pattern: "TODO", path: "link" }, { spellings: seen })).text, "Found 1 file\nlink/x.txt");
  assert.equal((await glob(d, { pattern: "*.txt", path: "link" }, { spellings: seen })).text, "link/x.txt");
  // The link moved to b since the check: refused, in Claude Code's words, by both.
  rmSync(join(d, "link")); symlinkSync(join(d, "b"), join(d, "link"));
  const moved = S.symlinkChangedText(join(d, "link"));
  assert.equal(moved, "Refusing to search " + join(d, "link") + ": its symlink resolution changed after permission was checked. If a link in the working directory is being rewritten concurrently, stop that and retry.");
  assert.equal(await fails(grep(d, { pattern: "TODO", path: "link" }, { spellings: seen })), moved);
  assert.equal(await fails(glob(d, { pattern: "*.txt", path: "link" }, { spellings: seen })), moved);
  // (Its own check of the folder it opened, too: where the open folder really is must be among those checked.)
  await assert.rejects(S.searchRoot(join(d, "link"), { base: d, checked: [join(d, "link"), join(d, "a"), join(d, "b") + "-not"] }), { message: moved });
  // Another path's spellings are not used; none at all: the tools' own, just made.
  assert.equal((await grep(d, { pattern: "TODO", path: "link" }, { spellings: { path: join(d, "other"), list: [join(d, "other")] } })).text, "Found 1 file\nlink/y.txt");
  assert.equal((await grep(d, { pattern: "TODO", path: "link" })).text, "Found 1 file\nlink/y.txt");
  // A path not there, with its links as checked: Claude Code's "Path does not exist"; gone between the check and the open: none.
  assert.match(await fails(grep(d, { pattern: "TODO", path: "gone" })), /^Path does not exist: gone\. Note: your current working directory is /);
  assert.equal(await S.searchRoot(join(d, "gone"), { base: d, checked: [join(d, "gone")] }), null);
  // Coder's loop sends what its check saw (SR8 has the whole context): through the tools script, the search runs.
  const t = await loop(d, [say("", [call("grep", { pattern: "TODO", path: "link" }, "g1")]), say("done")]);
  assert.deepEqual(t.requests[0].req.ctx.spellings, { path: join(d, "link"), list: [join(d, "link"), join(d, "b")] });
  assert.equal(t.answer("g1"), "Found 1 file\nlink/y.txt");
});
