// NOTEBOOK_EDIT, AS CLAUDE CODE'S NotebookEdit (the owner, 2026-11-17: "Yes build it"; tool 5 of docs/tool-by-tool.md):
// Coder's notebook_edit against Claude Code's real tool, tried in a Claude Code cloud session that day on the notebooks in
// test/fixtures/notebook (its saved files are there too), and against its own program (2.1.326, read the same day).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile, readFile, symlink, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const N = await import("../container/coder-notebook.mjs");
const T = await import("../container/coder-tools.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const TS = await import("../container/coder-toolsearch.mjs");
const FR = await import("../container/coder-filerules.mjs");
const I = await import("../container/coder-inputs.mjs");
const CK = await import("../container/coder-checker.mjs");
const fixture = (f) => readFileSync(new URL("./fixtures/notebook/" + f, import.meta.url), "utf8");
const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;

test("NB1 the tool as Grok sees it: Claude Code's NotebookEdit prompt and inputs word for word (2.1.326's program), with Coder's tool names and paths; held back until tool_search loads it, with Claude Code's own search hint; Claude Code's name for its hooks and rules; offered in jobs from GitHub too", () => {
  const t = A.CODER_TOOLS.find((x) => x.function.name === "notebook_edit");
  assert.ok(t, "one of Coder's tools");
  // Claude Code's prompt, with ${We} its Read tool's name; its two bullets about Read's `<cell id="...">` output and a full
  // path are said as Coder's read and paths work.
  const cc = "Replaces, inserts, or deletes a single cell in a Jupyter notebook (.ipynb file).\n\nUsage:\n- You must use the read tool on the notebook in this conversation before editing — this tool will fail otherwise.\n- `notebook_path` must be an absolute path.\n- `cell_id` is the `id` attribute shown in the read tool's `<cell id=\"...\">` output. It is required for `replace` and `delete`.\n- `edit_mode` defaults to `replace`. Use `insert` to add a new cell after the cell with the given `cell_id` (or at the beginning of the notebook if `cell_id` is omitted) — `cell_type` is required when inserting. Use `delete` to remove the cell.";
  const ours = t.function.description.split("\n"), theirs = cc.split("\n");
  assert.equal(ours.length, theirs.length);
  assert.deepEqual(ours.map((l, i) => (l === theirs[i] ? "same" : i)), ["same", "same", "same", "same", 4, 5, "same"]);
  assert.equal(ours[4], "- `notebook_path` is the notebook's path, as the read tool takes it.");
  assert.equal(ours[5], "- `cell_id` is the `id` the read tool shows for each cell (`id …` in the cell's `--- Cell N (…) ---` line). It is required for `replace` and `delete`.");
  const p = t.function.parameters;
  assert.deepEqual(Object.keys(p.properties), ["notebook_path", "cell_id", "new_source", "cell_type", "edit_mode"], "its order");
  assert.deepEqual(p.required, ["notebook_path", "new_source"]);
  assert.equal(p.additionalProperties, false);
  assert.equal(p.properties.cell_id.description, "The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified.");
  assert.equal(p.properties.new_source.description, "The new source for the cell");
  assert.deepEqual(p.properties.cell_type, { type: "string", enum: ["code", "markdown"], description: "The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required." });
  assert.deepEqual(p.properties.edit_mode, { type: "string", enum: ["replace", "insert", "delete"], description: "The type of edit to make (replace, insert, delete). Defaults to replace." });
  assert.equal(p.properties.notebook_path.description, "The path to the Jupyter notebook file to edit", "Claude Code's, less its \"absolute\"");
  // Held back (Claude Code's shouldDefer: !0), found by its own hint.
  assert.equal(TS.isDeferred("notebook_edit"), true);
  assert.equal(TS.SEARCH_HINTS.notebook_edit, "edit Jupyter notebook cells (.ipynb)");
  // Its names: Claude Code's for hooks and rules, its row as Claude Code's ("path@cell").
  assert.equal(H.ccTool("notebook_edit"), "NotebookEdit");
  assert.equal(FR.TOOL_RULE_NAMES.notebook_edit, "NotebookEdit");
  assert.equal(A.RUN_TOOLS.notebook_edit.verb, "Edited");
  assert.equal(A.RUN_TOOLS.notebook_edit.label({ notebook_path: "nb.ipynb", cell_id: "a1" }), "nb.ipynb@a1");
  assert.equal(A.RUN_TOOLS.notebook_edit.label({ notebook_path: "nb.ipynb" }), "nb.ipynb", "no \"@undefined\" for an insert at the top");
  assert.ok(A.GITHUB_TOOLS.some((x) => x.function.name === "notebook_edit"), "jobs from GitHub have it, as Claude Code's Action has NotebookEdit");
  assert.ok(A.FILE_HOOK_TOOLS.has("notebook_edit"), "security reminders and a folder's instructions after it, as after Edit and Write");
  // The machine's copy holds the new module.
  const copy = readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8").split("\n").find((l) => /^COPY package\.json /.test(l));
  assert.ok(copy.includes(" coder-notebook.mjs "));
});

test("NB2 its input, refused before any hook in Claude Code's words (tried: a missing new_source; a cell_type or edit_mode not in its lists, as zod's issues)", () => {
  assert.equal(I.inputCheckFor("notebook_edit"), N.checkInput);
  assert.deepEqual(N.checkInput({ notebook_path: "a.ipynb", cell_id: "q1" }), { error: "error: InputValidationError: notebook_edit failed due to the following issue:\nThe required parameter `new_source` is missing" });
  assert.equal(N.checkInput({ notebook_path: "a.ipynb", cell_id: "q1", new_source: "x", cell_type: "raw" }).error, "error: InputValidationError: " + JSON.stringify([{ code: "invalid_value", values: ["code", "markdown"], path: ["cell_type"], message: "Invalid option: expected one of \"code\"|\"markdown\"" }], null, 2));
  assert.equal(N.checkInput({ notebook_path: "a.ipynb", new_source: "x", edit_mode: "move" }).error, "error: InputValidationError: " + JSON.stringify([{ code: "invalid_value", values: ["replace", "insert", "delete"], path: ["edit_mode"], message: "Invalid option: expected one of \"replace\"|\"insert\"|\"delete\"" }], null, 2));
  assert.match(N.checkInput({ notebook_path: "a.ipynb", new_source: "x", extra: 1 }).error, /An unexpected parameter `extra` was provided/);
  assert.match(N.checkInput({ notebook_path: 5, new_source: "x" }).error, /The parameter `notebook_path` type is expected as `string` but provided as `number`/);
  assert.match(N.checkInput({ notebook_path: "a.ipynb", new_source: "x", cell_id: null }).error, /The parameter `cell_id` type is expected as `string` but provided as `null`/, "null is no string, as zod takes it");
  assert.deepEqual(N.checkInput({ notebook_path: "a.ipynb", new_source: "x" }), { args: { notebook_path: "a.ipynb", new_source: "x" } });
  // Its checks that need no file, in its order (tried: an empty path is no notebook; an insert with no type).
  assert.equal(N.inputProblem({ notebook_path: "", new_source: "x" }), "File must be a Jupyter notebook (.ipynb file). For editing other file types, use the edit tool.");
  assert.equal(N.inputProblem({ notebook_path: "plain.py", new_source: "x" }), N.NOT_A_NOTEBOOK);
  assert.equal(N.inputProblem({ notebook_path: "a.ipynb", new_source: "x", edit_mode: "insert" }), "Cell type is required when using edit_mode=insert.");
  assert.equal(N.inputProblem({ notebook_path: "a.ipynb", new_source: "x" }), "");
  // Its path's checks name the tool and its input, as Claude Code's do (its errors reference: "Read file_path cannot contain null
  // bytes (\0). Remove the null byte and try again."; NotebookEdit's input is notebook_path).
  assert.equal(T.fileInputProblem("notebook_edit", { notebook_path: "a\0.ipynb", new_source: "x" }), "notebook_edit notebook_path cannot contain null bytes (\\0). Remove the null byte and try again.");
  assert.match(T.fileInputProblem("notebook_edit", { notebook_path: "x".repeat(4100) + ".ipynb", new_source: "x" }), /^notebook_edit notebook_path has 4106 characters, and notebook_edit takes at most 4096\./);
  assert.equal(T.fileInputProblem("notebook_edit", { notebook_path: "a.ipynb", new_source: "x", show_change: true, facts: true }), "", "Coder's own options are no input of Grok's");
});

test("NB3 the edit itself makes the same files as Claude Code's real NotebookEdit, byte for byte (its saved notebooks, tried case by case): a code cell replaced (its output and run number cleared, its tags kept), a type changed, cells inserted after one and at the top (an 8-character id from format 4.5), a cell deleted, cell-N for a place, a real id first; an older notebook without ids; its answers word for word", () => {
  let t = fixture("before.ipynb");
  const ids = ["94a4caeb", "22f59676"];
  const steps = [
    [{ cell_id: "a1b2c3d4", new_source: "x = 5\nprint('bye')" }, "Updated cell a1b2c3d4 with x = 5\nprint('bye')"],
    [{ cell_id: "e5f6", new_source: "Now **markdown** é ✓", cell_type: "markdown" }, "Updated cell e5f6 with Now **markdown** é ✓"],
    [{ cell_id: "intro-md", new_source: "import os", cell_type: "code", edit_mode: "insert" }, "Inserted cell 94a4caeb with import os"],
    [{ new_source: "At the very top", cell_type: "markdown", edit_mode: "insert" }, "Inserted cell 22f59676 with At the very top"],
    [{ cell_id: "rawcell", new_source: "", edit_mode: "delete" }, "Deleted cell rawcell"],
    [{ cell_id: "cell-1", new_source: "index form on a notebook that has ids" }, "Updated cell cell-1 with index form on a notebook that has ids"],
    [{ cell_id: "intro-md", new_source: "print('was markdown')", cell_type: "code" }, "Updated cell intro-md with print('was markdown')"],
  ];
  for (const [args, said] of steps) {
    const r = N.editNotebook(t, args, { newId: () => ids.shift() });
    assert.equal(r.said, said);
    t = r.text;
  }
  assert.equal(t, fixture("after-claude-code.ipynb"), "Claude Code's saved notebook, byte for byte");
  let u = fixture("old-before.ipynb");
  for (const [args, said] of [[{ cell_id: "cell-2", new_source: "x + 100" }, "Updated cell cell-2 with x + 100"], [{ cell_id: "cell-0", new_source: "inserted after cell-0", cell_type: "code", edit_mode: "insert" }, "Inserted a new cell with inserted after cell-0"]]) {
    const r = N.editNotebook(u, args);
    assert.equal(r.said, said);
    u = r.text;
  }
  assert.equal(u, fixture("old-after-claude-code.ipynb"), "an older notebook (4.4): no ids, a 2-space file saved with 1 space");
  // A real id named cell-1 goes first (tried: the cell after it got the insert).
  const tricky = JSON.stringify({ cells: [{ cell_type: "code", id: "cell-1", metadata: {}, outputs: [], execution_count: null, source: "first" }, { cell_type: "code", id: "zz", metadata: {}, outputs: [], execution_count: null, source: "second" }], metadata: {}, nbformat: 4, nbformat_minor: 5 });
  const r = N.editNotebook(tricky, { cell_id: "cell-1", new_source: "after it", cell_type: "code", edit_mode: "insert" }, { newId: () => "a7ecbde7" });
  assert.deepEqual(JSON.parse(r.text).cells.map((c) => c.id), ["cell-1", "a7ecbde7", "zz"]);
  // Its hooks' result: the old text for a replace and a delete; the type asked for, "code" when none was; the language.
  const rr = N.editNotebook(fixture("before.ipynb"), { cell_id: "intro-md", new_source: "# New" });
  assert.deepEqual([rr.oldSource, rr.cellType, rr.language, rr.mode, rr.cellId], ["# Title\nSome text", "code", "python", "replace", "intro-md"]);
  assert.equal(N.editNotebook(fixture("before.ipynb"), { new_source: "x", cell_type: "code", edit_mode: "insert" }).oldSource, undefined);
  // A new id is a random UUID's first 8 characters.
  assert.match(N.newCellId(), /^[0-9a-f]{8}$/);
});

test("NB4 its refusals about the notebook, in Claude Code's words (tried, and its program): a place past the end, an id it doesn't have, no cell for a replace or a delete (an empty id counts as none), not JSON, not a notebook", () => {
  const nb = fixture("old-before.ipynb");
  assert.equal(N.editNotebook(nb, { cell_id: "cell-9", new_source: "x" }).error, "Cell with index 9 does not exist in notebook.");
  assert.equal(N.editNotebook(nb, { cell_id: "4", new_source: "x" }).error, 'Cell with ID "4" not found in notebook.');
  assert.equal(N.editNotebook(nb, { new_source: "x" }).error, "Cell ID must be specified when not inserting a new cell.");
  assert.equal(N.editNotebook(nb, { cell_id: "", new_source: "x" }).error, "Cell ID must be specified when not inserting a new cell.");
  assert.equal(N.editNotebook(nb, { new_source: "x", edit_mode: "delete" }).error, "Cell ID must be specified when not inserting a new cell.");
  assert.equal(N.editNotebook("not json", { cell_id: "a", new_source: "x" }).error, "Notebook is not valid JSON.");
  const shape = 'Notebook file is not a valid Jupyter notebook (top-level "cells" must be an array of cell objects, each with a string or string-array "source").';
  for (const bad of ['{"cells":"oops"}', '{"cells":[null]}', '{"cells":[{"cell_type":"code"}]}', '{"cells":[{"source":[1]}]}', "[]"]) assert.equal(N.editNotebook(bad, { cell_id: "a", new_source: "x" }).error, shape, bad);
  assert.equal(N.editNotebook('{"cells":[]}', { new_source: "x", cell_type: "code", edit_mode: "insert" }).said.startsWith("Inserted a new cell with x"), true, "an empty notebook takes an insert");
});

/** Coder's tools script as Coder's machine runs it, in `dir`, following what it reads in `seen` (CODER_SEEN_DIR). */
const tool = (dir, seen) => (name, args) => {
  const out = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH, ...(seen ? { CODER_SEEN_DIR: seen } : {}) } });
  return out.stdout;
};
const mk = async () => ({ dir: await mkdtemp(join(tmpdir(), "coder-nb-")), seen: await mkdtemp(join(tmpdir(), "coder-nb-seen-")) });

test("NB5 on the machine: read first (a notebook never read, or gone, refused in Claude Code's words); read shows every cell's id as notebook_edit takes it (cell-N for one with none); edit refuses a notebook in Claude Code's words; a replace saves the cell, its change shown without diff's no-newline line, its hooks' result object; changed since read refused; another read lets it through", async () => {
  const { dir, seen } = await mk();
  const run = tool(dir, seen);
  await writeFile(join(dir, "a.ipynb"), fixture("before.ipynb"));
  await writeFile(join(dir, "old.ipynb"), fixture("old-before.ipynb"));
  assert.equal(run("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x + 2" }), "error: File has not been read yet. Read it first before writing to it.");
  assert.equal(run("notebook_edit", { notebook_path: "missing.ipynb", new_source: "x", cell_type: "code", edit_mode: "insert" }), "error: File has not been read yet. Read it first before writing to it.", "a missing notebook was never read");
  assert.equal(run("notebook_edit", { notebook_path: "plain.py", cell_id: "x", new_source: "y" }), "error: " + N.NOT_A_NOTEBOOK);
  const shown = run("read", { path: "a.ipynb" });
  assert.match(shown, /--- Cell 1 \(markdown, id intro-md\) ---/);
  assert.match(shown, /--- Cell 2 \(code, run 3, id a1b2c3d4\) ---/);
  assert.match(run("read", { path: "old.ipynb" }), /--- Cell 1 \(markdown, id cell-0\) ---[\s\S]*--- Cell 3 \(code, run 4, id cell-2\) ---/, "Claude Code's cell-N, from 0");
  assert.equal(run("edit", { path: "a.ipynb", old_string: "x + 1", new_string: "x + 3" }), "error: File is a Jupyter Notebook. Use the notebook_edit to edit this file.");
  assert.equal(run("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x + 2" }), "Updated cell e5f6 with x + 2");
  const cell = JSON.parse(await readFile(join(dir, "a.ipynb"), "utf8")).cells[2];
  assert.deepEqual(cell, { cell_type: "code", execution_count: null, id: "e5f6", metadata: {}, outputs: [], source: "x + 2" });
  // Coder's loop asks for the change and the result object: the cell's lines, as an edit's change shows.
  const out = run("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x + 3\ny = 1", show_change: true, facts: true });
  assert.ok(out.startsWith(T.FACTS_MARK), out.slice(0, 80));
  const facts = JSON.parse(out.slice(T.FACTS_MARK.length, out.indexOf("\n")));
  assert.deepEqual(Object.keys(facts), ["new_source", "old_source", "cell_id", "cell_type", "language", "edit_mode", "error", "notebook_path", "original_file", "updated_file"]);
  assert.deepEqual([facts.new_source, facts.old_source, facts.cell_id, facts.cell_type, facts.language, facts.edit_mode, facts.error, facts.notebook_path], ["x + 3\ny = 1", "x + 2", "e5f6", "code", "python", "replace", "", join(dir, "a.ipynb")]);
  const answer = A.writeAnswer(A.factsAnswer(out).text);
  assert.equal(answer.text, "Updated cell e5f6 with x + 3\ny = 1");
  assert.deepEqual(answer.change, { kind: "update", add: 2, del: 1, lines: ["@@ -1 +1,2 @@", "-x + 2", "+x + 3", "+y = 1"] });
  // Changed by a command since: refused (Claude Code's words); read again, it goes.
  const nb = JSON.parse(await readFile(join(dir, "a.ipynb"), "utf8"));
  nb.cells[0].source = "changed outside";
  await writeFile(join(dir, "a.ipynb"), JSON.stringify(nb, null, 1));
  assert.equal(run("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x + 4" }), "error: File has been modified since read, either by the user or by a linter. Read it again before attempting to write it.");
  run("read", { path: "a.ipynb" });
  assert.equal(run("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x + 4" }), "Updated cell e5f6 with x + 4");
  assert.equal(JSON.parse(await readFile(join(dir, "a.ipynb"), "utf8")).cells[0].source, "changed outside", "the outside change kept");
  // Read, then gone: Claude Code's words for that.
  run("read", { path: "old.ipynb" });
  await unlink(join(dir, "old.ipynb"));
  assert.equal(run("notebook_edit", { notebook_path: "old.ipynb", cell_id: "cell-0", new_source: "x" }), "error: Notebook file does not exist.");
  // Its cell checks run before any hook (the machine's file check, file_check).
  assert.equal(run("file_check", { tool: "notebook_edit", args: { notebook_path: "a.ipynb", cell_id: "nope" } }), "error: Cell with ID \"nope\" not found in notebook.");
  assert.equal(run("file_check", { tool: "notebook_edit", args: { notebook_path: "a.ipynb", cell_id: "e5f6" } }), "ok");
});

test("NB6 on the machine: Windows line endings kept, as Claude Code keeps them (tried: the same file, byte for byte); a notebook behind a byte-order mark (UTF-8's or UTF-16LE's) refused as \"Notebook is not valid JSON.\", nothing written, as Claude Code's (tried); a UTF-16 notebook not read, so not edited; an old encoding refused with nothing written, in Claude Code's words; a link refused; a notebook past Claude Code's 100 MB refused", async () => {
  const { dir, seen } = await mk();
  const run = tool(dir, seen);
  const base = fixture("before.ipynb");
  await writeFile(join(dir, "crlf.ipynb"), base.replace(/\n/g, "\r\n"));
  run("read", { path: "crlf.ipynb" });
  assert.equal(run("notebook_edit", { notebook_path: "crlf.ipynb", cell_id: "e5f6", new_source: "crlf edit" }), "Updated cell e5f6 with crlf edit");
  assert.equal(await readFile(join(dir, "crlf.ipynb"), "utf8"), N.editNotebook(base, { cell_id: "e5f6", new_source: "crlf edit" }).text.replace(/\n/g, "\r\n"), "Claude Code's file: every line ending CRLF");
  // A byte-order mark: past the check before its hooks (it reads one), refused by the run, nothing written.
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(base)]);
  await writeFile(join(dir, "bom.ipynb"), bom);
  run("read", { path: "bom.ipynb" });
  assert.equal(run("file_check", { tool: "notebook_edit", args: { notebook_path: "bom.ipynb", cell_id: "e5f6" } }), "ok");
  assert.equal(run("notebook_edit", { notebook_path: "bom.ipynb", cell_id: "e5f6", new_source: "x" }), "error: Notebook is not valid JSON.");
  assert.deepEqual(await readFile(join(dir, "bom.ipynb")), bom);
  const u16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(base, "utf16le")]);
  await writeFile(join(dir, "u16seen.ipynb"), u16);
  run("seen", { path: "u16seen.ipynb" }); // shown by a command, as Claude Code counts `cat` (tried: its NotebookEdit took it as read)
  assert.equal(run("notebook_edit", { notebook_path: "u16seen.ipynb", cell_id: "e5f6", new_source: "x" }), "error: Notebook is not valid JSON.");
  assert.deepEqual(await readFile(join(dir, "u16seen.ipynb")), u16);
  // A UTF-16 notebook is not read as one (Claude Code's Read, tried: "Notebook file is not valid JSON …"; Coder's read refuses it
  // as binary), so it is not edited either: "File has not been read yet", as there.
  await writeFile(join(dir, "utf16.ipynb"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(base, "utf16le")]));
  run("read", { path: "utf16.ipynb" });
  assert.equal(run("notebook_edit", { notebook_path: "utf16.ipynb", cell_id: "e5f6", new_source: "x" }), "error: " + T.EDIT_NOT_READ);
  const latin = JSON.stringify(JSON.parse(base)).replace("Some text", "Café");
  await writeFile(join(dir, "latin.ipynb"), Buffer.from(latin, "latin1"));
  run("read", { path: "latin.ipynb" });
  assert.equal(run("notebook_edit", { notebook_path: "latin.ipynb", cell_id: "e5f6", new_source: "x" }), "error: latin.ipynb " + T.NOT_UTF8_REFUSED);
  assert.deepEqual(await readFile(join(dir, "latin.ipynb")), Buffer.from(latin, "latin1"), "nothing written");
  await writeFile(join(dir, "real.ipynb"), base);
  await symlink(join(dir, "real.ipynb"), join(dir, "link.ipynb"));
  run("read", { path: "link.ipynb" });
  assert.match(run("notebook_edit", { notebook_path: "link.ipynb", cell_id: "e5f6", new_source: "x" }), /^error: Refusing to write link\.ipynb: it is a symbolic link\. Write to the link's target path instead: /);
  // Past 100 MB: Claude Code's words, with Coder's bash for its Bash.
  const { truncate } = await import("node:fs/promises");
  await writeFile(join(dir, "big.ipynb"), base);
  run("read", { path: "big.ipynb" });
  await truncate(join(dir, "big.ipynb"), N.NOTEBOOK_MAX_BYTES + 1);
  run("read", { path: "big.ipynb" }); // refused by read too, so the change since is not what refuses it below
  const said = run("notebook_edit", { notebook_path: "big.ipynb", cell_id: "e5f6", new_source: "x" });
  assert.ok(said === "error: " + N.NOTEBOOK_CHANGED || said === "error: " + N.NOTEBOOK_TOO_BIG, said.slice(0, 120));
  assert.match(N.NOTEBOOK_TOO_BIG, /^Notebook file exceeds the maximum size this tool can read \(100MB\)\. Use bash with jq to read specific portions:\n  cat <notebook_path> \| jq '\.cells\[:20\]' # First 20 cells/);
  assert.equal(N.NOTEBOOK_WOULD_BE_TOO_BIG, "Edit rejected: the updated notebook would exceed the maximum size this tool can read (100MB). The file was left unchanged.");
});

/** Coder's loop with a scripted Grok and the real tools script in `dir` (following what it reads), as the file-rule tests run it. */
async function loop(dir, seenDir, steps, { mode = "acceptEdits", rules = {}, hooks = null, ask = null } = {}) {
  const events = [], hookCalls = [], toolReqs = [];
  let n = 0;
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { hookCalls.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (!tm) return { code: 0, output: "ok\n" };
      const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
      toolReqs.push(req);
      const out = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH, CODER_SEEN_DIR: seenDir } });
      return { code: out.status, output: out.stdout };
    },
    emit: (e) => events.push(e), here: () => dir, root: dir, chatId: "nb", where: (p) => (p.startsWith("/") ? p : dir + "/" + p), seen: true,
    ask: ask || (async () => ({ choice: "yes" })), toolSearch: "false",
  }, { text: "change the notebook", mode, messages: [], rules: { allow: [], ask: [], deny: [], ...rules }, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}) });
  const told = (id) => ((r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "");
  return { r, events, hookCalls, toolReqs, told };
}
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("NB7 in a chat: Coder reads the notebook and changes a cell; its step reads \"Edited a.ipynb@e5f6\" with the cell's change; Grok is told Claude Code's answer; the notebook is among the files the job changed (Rewind); its hooks see NotebookEdit with the notebook's full path and Claude Code's result object", async () => {
  const { dir, seen } = await mk();
  await writeFile(join(dir, "a.ipynb"), fixture("before.ipynb"));
  const hooks = { PreToolUse: [{ matcher: "NotebookEdit", hooks: [{ type: "command", command: "true" }] }], PostToolUse: [{ matcher: "NotebookEdit", hooks: [{ type: "command", command: "true" }] }] };
  const t = await loop(dir, seen, [say("", [call("read", { path: "a.ipynb" }, "r1")]), say("", [call("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x + 2" }, "n1")]), say("Done.")], { hooks });
  assert.equal(t.told("n1"), "Updated cell e5f6 with x + 2");
  const step = t.events.find((e) => e.type === "bash" && e.id === "n1");
  assert.deepEqual([step.tool, step.verb, step.command], ["notebook_edit", "Edited", "a.ipynb@e5f6"]);
  const res = t.events.find((e) => e.type === "result" && e.id === "n1");
  assert.deepEqual(res.change, { kind: "update", add: 1, del: 1, lines: ["@@ -1 +1 @@", "-x + 1", "+x + 2"] });
  assert.equal(JSON.parse(await readFile(join(dir, "a.ipynb"), "utf8")).cells[2].source, "x + 2");
  assert.deepEqual(t.r.edited, ["a.ipynb"], "Rewind's \"Restore code\" puts it back");
  const pre = t.hookCalls.find((h) => h.hook_event_name === "PreToolUse" && h.tool_name === "NotebookEdit");
  assert.deepEqual(pre.tool_input, { notebook_path: join(dir, "a.ipynb"), cell_id: "e5f6", new_source: "x + 2" });
  const post = t.hookCalls.find((h) => h.hook_event_name === "PostToolUse" && h.tool_name === "NotebookEdit");
  assert.equal(post.tool_response.updated_file.includes('"source": "x + 2"'), true);
  assert.equal(post.tool_response.old_source, "x + 1");
});

test("NB8 in a chat: Plan mode asks on a card first (Claude Code's \"Cannot write to … while in plan mode.\"), showing the cell as it is now and its new lines; an Edit deny rule refuses it before any hook, in Claude Code's words; its input refused before any hook or card; a call before the notebook is read refused, nothing written", async () => {
  const { dir, seen } = await mk();
  await writeFile(join(dir, "a.ipynb"), fixture("before.ipynb"));
  const cards = [];
  const plan = await loop(dir, seen, [say("", [call("read", { path: "a.ipynb" }, "r1")]), say("", [call("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x + 2\ny" }, "n1")]), say("Done.")], { mode: "plan", ask: async (pid) => { cards.push(pid); return { choice: "no" }; } });
  const card = plan.events.find((e) => e.type === "permission");
  assert.ok(card && cards.length === 1, "one card");
  assert.equal(card.tool, "notebook_edit");
  assert.equal(card.why, "Cannot write to " + join(dir, "a.ipynb") + " while in plan mode.");
  assert.deepEqual(card.change, { kind: "update", add: 2, del: 1, lines: ["-x + 1", "+x + 2", "+y"] }, "the cell as it is now, then its new lines, as Claude Code's dialog");
  assert.equal(JSON.parse(await readFile(join(dir, "a.ipynb"), "utf8")).cells[2].source, "x + 1", "not written");
  const hooks = { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "true" }] }] };
  const denied = await loop(dir, seen, [say("", [call("read", { path: "a.ipynb" }, "r1")]), say("", [call("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x + 2" }, "n1")]), say("Done.")], { rules: { deny: ["Edit(a.ipynb)"] }, hooks });
  assert.equal(denied.told("n1"), "File is in a directory that is denied by your permission settings.");
  assert.ok(!denied.hookCalls.some((h) => h.tool_name === "NotebookEdit"), "no hook ran for it");
  const bad = await loop(dir, seen, [say("", [call("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x", cell_type: "raw" }, "n1")]), say("Done.")], { hooks });
  assert.match(bad.told("n1"), /^error: InputValidationError: \[/);
  assert.ok(!bad.hookCalls.some((h) => h.tool_name === "NotebookEdit"));
  const { dir: d2, seen: s2 } = await mk();
  await writeFile(join(d2, "a.ipynb"), fixture("before.ipynb"));
  const unread = await loop(d2, s2, [say("", [call("notebook_edit", { notebook_path: "a.ipynb", cell_id: "e5f6", new_source: "x" }, "n1")]), say("Done.")], { hooks });
  assert.equal(unread.told("n1"), "error: File has not been read yet. Read it first before writing to it.");
  assert.ok(!unread.hookCalls.some((h) => h.tool_name === "NotebookEdit"), "refused before its hooks, as Claude Code's validateInput refuses it");
  assert.equal(await readFile(join(d2, "a.ipynb"), "utf8"), fixture("before.ipynb"));
});

test("NB9 around it: the auto mode checker sees an earlier notebook edit as Claude Code's classifier does; security reminders read a cell's new text; a summary keeps the notebook among its files; a No on its card shows under its step; the push line and the page name it as an edit", () => {
  assert.equal(CK.notebookForChecker({ notebook_path: "a.ipynb", cell_id: "x", new_source: "print(1)", cell_type: "code" }), '{"notebook_path":"a.ipynb","mode":"replace","cell_id":"x","cell_type":"code","adds":"print(1)"}');
  assert.equal(CK.notebookForChecker({ notebook_path: "a.ipynb", cell_id: "x", new_source: "", edit_mode: "delete", cell_type: "code" }), '{"notebook_path":"a.ipynb","mode":"delete","cell_id":"x","ignored_source":""}');
  const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
  assert.match(read("container/coder-security.mjs"), /if \(tool === "notebook_edit"\) return typeof a\.new_source === "string" && a\.edit_mode !== "delete" \? a\.new_source : "";/);
  assert.match(read("container/coder-compact.mjs"), /else if \(f\.name === "notebook_edit"\) add\(a\.notebook_path\);/);
  assert.match(read("container/coder-park.mjs"), /const FILE_TOOLS = new Set\(\["write", "edit", "notebook_edit",/);
  assert.match(read("src/coder-push.mjs"), /e\.tool === "notebook_edit"\) return \(e\.tool === "write" \? "Write " : "Edit "\)/);
  const page = read("public/coder.js");
  assert.match(page, /notebook_edit: \['edited', 'file', 'files', 'edit'\]/, "counted with the files edited");
  assert.match(page, /notebook_edit: 'Edit notebook'/, "its card's title");
  assert.match(page, /if \(e\.tool === 'notebook_edit'\) return String\(e\.command \|\| ''\)\.replace\(\/@\[\^\/@\]\*\$\/, ''\);/, "the notebook is the file, without its @cell");
});

test("NB10 the double check against Claude Code's docs (2026-11-17): a Read deny rule doesn't cover it (\"NotebookEdit isn't covered by Read deny rules\"), an Edit deny rule does; the card for a cell it can't show says why in Claude Code's words; a notebook changed while its card was open is refused when it runs, and its hooks are told it failed", async () => {
  const P = await import("../container/coder-perms.mjs");
  const fd = (tool, rules) => P.fileToolDecision(tool, "/work/a.ipynb", { rules: { allow: [], ask: [], deny: [], ...rules }, root: "/work" });
  assert.equal(fd("notebook_edit", { deny: ["Read(a.ipynb)"] }).verdict, "", "not covered by a Read deny rule");
  assert.equal(fd("edit", { deny: ["Read(a.ipynb)"] }).why, "File is covered by a Read deny rule in your permission settings and cannot be edited.", "edit is");
  assert.deepEqual([fd("notebook_edit", { deny: ["Edit(a.ipynb)"] }).verdict, fd("notebook_edit", { deny: ["Edit(a.ipynb)"] }).why], ["deny", "File is in a directory that is denied by your permission settings."]);
  assert.equal(fd("notebook_edit", { deny: ["NotebookEdit"] }).why, "Permission to use NotebookEdit has been denied.", "the bare tool name");
  assert.equal(fd("notebook_edit", { deny: ["NotebookEdit(a.ipynb)"] }).verdict, "", "a NotebookEdit(path) rule never matches (Claude Code warns of it)");
  assert.equal(fd("notebook_edit", { deny: ["NotebookEdit(*)"] }).verdict, "deny", "NotebookEdit(*) is the whole tool, as Write(*)");
  assert.equal(fd("notebook_edit", { ask: ["NotebookEdit"] }).why, "Coder requested permissions to use NotebookEdit, but you haven't granted it yet.");
  assert.equal(fd("notebook_edit", { ask: ["Edit(a.ipynb)"] }).why, "Coder requested permissions to write to /work/a.ipynb, but you haven't granted it yet.");
  for (const r of ["NotebookEdit", "NotebookEdit(*)", "NotebookEdit(docs/**)"]) assert.equal(P.ruleSaved(r), true, r + " is kept, as Claude Code keeps it");
  assert.equal(P.ruleWarning("deny", "NotebookEdit(docs/**)").notice, "Deny rule NotebookEdit(docs/**) never matches · use Edit(docs/**)", "Claude Code's row for it");
  // The card's words when the cell can't be shown (Claude Code's own: "the notebook could not be parsed for preview" …).
  assert.deepEqual(N.cellBefore(fixture("before.ipynb"), "e5f6"), { source: "x + 1" });
  assert.deepEqual(N.cellBefore("\ufeff" + fixture("before.ipynb"), "e5f6"), { why: "the notebook could not be parsed for preview" });
  assert.deepEqual(N.cellBefore(fixture("before.ipynb"), "nope"), { why: "the target cell was not found in the notebook" });
  assert.equal(N.cardUnshown(N.CARD_UNPARSABLE, "replace"), "Current cell contents cannot be shown (the notebook could not be parsed for preview) \u2014 the edit cannot be reviewed, so approval is one-time only (deny unless expected).");
  assert.match(N.cardUnshown(N.CARD_NO_CELL, "delete"), /— the deletion cannot be reviewed/);
  // In a chat: a notebook behind a byte-order mark passes the check before the card, so the card says why it can't show the cell.
  const { dir, seen } = await mk();
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(fixture("before.ipynb"))]);
  await writeFile(join(dir, "b.ipynb"), bom);
  const t = await loop(dir, seen, [say("", [call("read", { path: "b.ipynb" }, "r1")]), say("", [call("notebook_edit", { notebook_path: "b.ipynb", cell_id: "e5f6", new_source: "x" }, "n1")]), say("Done.")], { mode: "plan", ask: async () => ({ choice: "yes" }) });
  const card = t.events.find((e) => e.type === "permission");
  assert.deepEqual(card.change, { kind: "update", add: 0, del: 0, lines: [], note: N.cardUnshown(N.CARD_UNPARSABLE, "replace") });
  assert.equal(t.told("n1"), "error: Notebook is not valid JSON.", "approved, then refused by its run, as Claude Code's");
  // Changed while its card was open: its run reads it again and refuses it; its hooks get PostToolUseFailure.
  await writeFile(join(dir, "c.ipynb"), fixture("before.ipynb"));
  const hooks = { PostToolUse: [{ matcher: "NotebookEdit", hooks: [{ type: "command", command: "true" }] }], PostToolUseFailure: [{ matcher: "NotebookEdit", hooks: [{ type: "command", command: "true" }] }] };
  const race = await loop(dir, seen, [say("", [call("read", { path: "c.ipynb" }, "r1")]), say("", [call("notebook_edit", { notebook_path: "c.ipynb", cell_id: "e5f6", new_source: "x + 2" }, "n1")]), say("Done.")], { mode: "plan", hooks, ask: async () => {
    const nb = JSON.parse(fixture("before.ipynb")); nb.cells[0].source = "changed while the card was open"; await writeFile(join(dir, "c.ipynb"), JSON.stringify(nb, null, 1));
    return { choice: "yes" };
  } });
  assert.equal(race.told("n1"), "error: " + N.NOTEBOOK_CHANGED);
  assert.ok(race.hookCalls.some((h) => h.hook_event_name === "PostToolUseFailure" && h.tool_name === "NotebookEdit"), "told it failed");
  assert.ok(!race.hookCalls.some((h) => h.hook_event_name === "PostToolUse" && h.tool_name === "NotebookEdit"), "never told it worked");
  assert.equal(JSON.parse(await readFile(join(dir, "c.ipynb"), "utf8")).cells[2].source, "x + 1", "the cell not changed");
});
