/**
 * CLAUDE CODE'S NotebookEdit, AS CODER'S notebook_edit (the owner, 2026-11-17: "Yes build it", after "Lets finish the tools";
 * on 2026-11-09, while edit was copied, the owner had put it off: "Notebook for later").
 *
 * Its description and inputs are Claude Code's, word for word as a Claude Code cloud session lists the tool (read that day),
 * with Coder's tool names and Coder's paths (a path in the project, or a full one, as read takes it; Claude Code asks for a
 * full path and takes a short one from its own folder all the same). What it does was tried there on real notebooks, case by
 * case (docs/tool-by-tool.md, tool 5), and is done here the same way:
 * - one cell at a time, named by its `id`; when no cell has that id, `cell-N` names the cell at place N, counted from 0 (how
 *   Claude Code's Read names a cell with no id of its own);
 * - replace (the default): the cell's text; a code cell's run number and saved output are cleared (Claude Code's docs:
 *   "When NotebookEdit replaces a code cell, its execution count and saved outputs are cleared"); its type is changed when
 *   one is given (a code cell made markdown keeps the cleared fields; a markdown cell made code gets none);
 * - insert: a new cell after the one named, or first when none is named; its type is needed; it gets an 8-character id in a
 *   notebook of format 4.5 or later (Jupyter's cell ids), none in an older one;
 * - delete: the cell is taken out;
 * - the notebook is saved whole, one space per level and no newline at its end, letters such as é kept as they are;
 * - its answers ("Updated cell … with …", "Inserted cell … with …", "Inserted a new cell with …", "Deleted cell …") and its
 *   refusals, in its words (a schema's refusals as Claude Code's InputValidationError, coder-zodtext.mjs).
 * The file's own checks (read first, changed since, its encoding) and its saving are coder-tools.mjs's (toolNotebookEdit).
 * Checked against Claude Code 2.1.326's own program (on this machine, /opt/claude-code), 2026-11-17: its prompt, schema, checks
 * in their order, words, ids, size limits, hooks' result object and its row ("path@cell") are the ones here.
 */
import { randomUUID } from "node:crypto";
import { typeIssue, valueIssue, unknownKeysIssue, inputErrorText } from "./coder-zodtext.mjs";

/** The tool's name in Coder, and Claude Code's. */
export const NOTEBOOK_TOOL = "notebook_edit", NOTEBOOK_CC = "NotebookEdit";

/** Claude Code's description of NotebookEdit, word for word, with Coder's tool names and paths. */
export const NOTEBOOK_DESCRIPTION = "Replaces, inserts, or deletes a single cell in a Jupyter notebook (.ipynb file).\n\nUsage:\n" +
  "- You must use the read tool on the notebook in this conversation before editing — this tool will fail otherwise.\n" +
  "- `notebook_path` is the notebook's path, as the read tool takes it.\n" +
  "- `cell_id` is the `id` the read tool shows for each cell (`id …` in the cell's `--- Cell N (…) ---` line). It is required for `replace` and `delete`.\n" +
  "- `edit_mode` defaults to `replace`. Use `insert` to add a new cell after the cell with the given `cell_id` (or at the beginning of the notebook if `cell_id` is omitted) — `cell_type` is required when inserting. Use `delete` to remove the cell.";

/** Its kinds of cell and of edit, as its schema lists them. */
export const CELL_TYPES = Object.freeze(["code", "markdown"]), EDIT_MODES = Object.freeze(["replace", "insert", "delete"]);

/** Its inputs, in its order, each with its own description (word for word, but the path's). */
export const NOTEBOOK_PROPERTIES = Object.freeze({
  notebook_path: { type: "string", description: "The path to the Jupyter notebook file to edit" },
  cell_id: { type: "string", description: "The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified." },
  new_source: { type: "string", description: "The new source for the cell" },
  cell_type: { type: "string", enum: [...CELL_TYPES], description: "The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required." },
  edit_mode: { type: "string", enum: [...EDIT_MODES], description: "The type of edit to make (replace, insert, delete). Defaults to replace." },
});
export const NOTEBOOK_REQUIRED = Object.freeze(["notebook_path", "new_source"]);
const FIELDS = Object.keys(NOTEBOOK_PROPERTIES);

// ── ITS WORDS ────────────────────────────────────────────────────────────────
/** A file that is not a notebook (Claude Code's "use the FileEdit tool", its own name for Edit: Coder's edit). */
export const NOT_A_NOTEBOOK = "File must be a Jupyter notebook (.ipynb file). For editing other file types, use the edit tool.";
export const TYPE_NEEDED = "Cell type is required when using edit_mode=insert.";
/** Changed since it was read, in the same round (between rounds, Coder's note shows the change first, as Claude Code's does). */
export const NOTEBOOK_CHANGED = "File has been modified since read, either by the user or by a linter. Read it again before attempting to write it.";
export const NOT_JSON = "Notebook is not valid JSON.";
/** Valid JSON, but no notebook: cells that are not a list of cells each with its text (Claude Code's own words and check). */
export const NOT_NOTEBOOK_SHAPE = 'Notebook file is not a valid Jupyter notebook (top-level "cells" must be an array of cell objects, each with a string or string-array "source").';
export const ID_NEEDED = "Cell ID must be specified when not inserting a new cell.";
export const noIndex = (n) => "Cell with index " + n + " does not exist in notebook.";
export const noId = (id) => 'Cell with ID "' + id + '" not found in notebook.';
/** A notebook that was read and is gone since. */
export const NOTEBOOK_GONE = "Notebook file does not exist.";
/** The largest notebook it reads or saves (Claude Code's: 100 MB), and its words past it, with Coder's bash for its Bash. */
export const NOTEBOOK_MAX_BYTES = 104_857_600;
export const NOTEBOOK_TOO_BIG = "Notebook file exceeds the maximum size this tool can read (100MB). Use bash with jq to read specific portions:\n" +
  "  cat <notebook_path> | jq '.cells[:20]' # First 20 cells\n" +
  "  cat <notebook_path> | jq '.cells[100:120]' # Cells 100-120\n" +
  "  cat <notebook_path> | jq '.cells | length' # Count total cells\n" +
  "  cat <notebook_path> | jq '.cells[] | select(.cell_type==\"code\") | .source' # All code sources";
export const NOTEBOOK_WOULD_BE_TOO_BIG = "Edit rejected: the updated notebook would exceed the maximum size this tool can read (100MB). The file was left unchanged.";

// ── ITS INPUT ────────────────────────────────────────────────────────────────
/**
 * THE INPUT, AS CLAUDE CODE'S SCHEMA TAKES IT (coder-inputs.mjs; before any hook or card): notebook_path and new_source
 * strings, cell_id a string when given, cell_type and edit_mode one of theirs when given, and nothing else. Its refusal in
 * Claude Code's words (tried: `The required parameter \`new_source\` is missing`; a value not in a list, the issues as JSON).
 */
export function checkInput(args) {
  const a = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const issues = [];
  if (typeof a.notebook_path !== "string") issues.push(typeIssue("string", a.notebook_path, ["notebook_path"]));
  if (a.cell_id !== undefined && typeof a.cell_id !== "string") issues.push(typeIssue("string", a.cell_id, ["cell_id"]));
  if (typeof a.new_source !== "string") issues.push(typeIssue("string", a.new_source, ["new_source"]));
  if (a.cell_type !== undefined && !CELL_TYPES.includes(a.cell_type)) issues.push(valueIssue(CELL_TYPES, ["cell_type"]));
  if (a.edit_mode !== undefined && !EDIT_MODES.includes(a.edit_mode)) issues.push(valueIssue(EDIT_MODES, ["edit_mode"]));
  const unknown = Object.keys(a).filter((k) => !FIELDS.includes(k));
  if (unknown.length) issues.push(unknownKeysIssue(unknown));
  if (issues.length) return { error: inputErrorText(NOTEBOOK_TOOL, issues) };
  return { args: a };
}
/**
 * ITS CHECKS THAT NEED NO FILE (Claude Code's validateInput, in its order, after its path's checks and the owner's deny rules:
 * a notebook's path, then a type for an insert; its schema refuses any other kind of edit). The read and change checks, the
 * file's size, encoding and cells come after, on the machine. → the refusal, or "".
 */
export function inputProblem(a) {
  const path = typeof a.notebook_path === "string" ? a.notebook_path : "";
  if (!/\.ipynb$/.test(path.trim())) return NOT_A_NOTEBOOK;
  if (a.edit_mode === "insert" && !a.cell_type) return TYPE_NEEDED;
  return "";
}

// ── ITS EDIT ─────────────────────────────────────────────────────────────────
/** `cell-N` as a place (Claude Code's own way of naming a cell with no id): N, or undefined. */
export function cellPlace(id) {
  const m = /^cell-(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : undefined;
}
/** A cell's name as read shows it and this tool takes it: its id, or `cell-N` (its place from 0) when it has none. */
export const cellName = (c, i) => (c && typeof c === "object" && typeof c.id === "string" && c.id ? c.id : "cell-" + i);
/** A cell's text as one string (Jupyter keeps it as a string or a list of lines). */
export const sourceText = (s) => (Array.isArray(s) ? s.map((x) => (typeof x === "string" ? x : "")).join("") : typeof s === "string" ? s : "");

/**
 * THE NOTEBOOK, CHECKED FOR THE CALL (Claude Code's validateInput, its last part): its JSON, then the cell it names.
 * → { nb } (parsed), or { error }.
 */
export function notebookProblem(text, { cell_id, edit_mode = "replace" } = {}) {
  let nb;
  try { nb = JSON.parse(text); } catch { return { error: NOT_JSON }; }
  if (!isNotebook(nb)) return { error: NOT_NOTEBOOK_SHAPE };
  if (!cell_id) {
    if (edit_mode !== "insert") return { error: ID_NEEDED };
  } else if (nb.cells.findIndex((c) => c.id === cell_id) === -1) {
    const n = cellPlace(cell_id);
    if (n === undefined) return { error: noId(cell_id) };
    if (!nb.cells[n]) return { error: noIndex(n) };
  }
  return { nb };
}

/** Claude Code's notebook check: a list of cells, each an object whose text is a string or a list of strings. */
export function isNotebook(nb) {
  const cells = nb && typeof nb === "object" ? nb.cells : undefined;
  return Array.isArray(cells) && !cells.some((c) => c === null || typeof c !== "object" || (typeof c.source !== "string" && !(Array.isArray(c.source) && c.source.every((x) => typeof x === "string"))));
}
/** A new cell's id: the first 8 characters of a random UUID, as Claude Code's (tried: "94a4caeb", "22f59676"). */
export const newCellId = () => randomUUID().slice(0, 8);

/**
 * THE EDIT ITSELF, on the notebook's text (JSON, without a byte-order mark), as Claude Code's call makes it. → { error } or
 * { text, said, mode, cellId, oldSource, newSource, cellType, language }: the notebook as it is saved (Claude Code's: JSON
 * with one space per level, nothing after it), what Coder is told, and what its PostToolUse hooks get (its NotebookEdit output).
 */
export function editNotebook(text, args, { newId = newCellId } = {}) {
  const a = args || {};
  const asked = a.edit_mode === undefined ? "replace" : a.edit_mode;
  const cell_id = typeof a.cell_id === "string" ? a.cell_id : "";
  const new_source = typeof a.new_source === "string" ? a.new_source : "";
  const v = notebookProblem(text, { cell_id, edit_mode: asked });
  if (v.error) return v;
  const nb = v.nb;
  // Where: the cell with that id, or the place `cell-N` names; after it, for an insert; the start, with no cell named.
  let at = 0;
  if (cell_id) {
    at = nb.cells.findIndex((c) => c.id === cell_id);
    if (at === -1) at = cellPlace(cell_id);
    if (asked === "insert") at += 1;
  }
  const mode = asked, type = a.cell_type;
  const info = nb.metadata && typeof nb.metadata === "object" ? nb.metadata.language_info : null;
  const language = info && typeof info === "object" && typeof info.name === "string" && info.name ? info.name : "python";
  // Cell ids are Jupyter's from format 4.5: a new cell gets one there, and none in an older notebook.
  const withIds = nb.nbformat > 4 || (nb.nbformat === 4 && nb.nbformat_minor >= 5);
  // (A replace or a delete names the cell as it was asked; only an insert's new cell gets a new id.)
  const id = mode === "insert" ? (withIds ? newId() : undefined) : cell_id;
  let oldSource;
  if (mode === "delete") {
    const [gone] = nb.cells.splice(at, 1);
    oldSource = sourceText(gone.source);
  } else if (mode === "insert") {
    // (Its keys in Claude Code's order; an id left out where there is none.)
    const cell = type === "markdown" ? { cell_type: "markdown", id, source: new_source, metadata: {} } : { cell_type: "code", id, source: new_source, metadata: {}, execution_count: null, outputs: [] };
    nb.cells.splice(at, 0, cell);
  } else {
    const cell = nb.cells[at];
    oldSource = sourceText(cell.source);
    cell.source = new_source;
    if (cell.cell_type === "code") { cell.execution_count = null; cell.outputs = []; }
    if (type && type !== cell.cell_type) cell.cell_type = type;
  }
  const said = mode === "replace" ? "Updated cell " + id + " with " + new_source
    : mode === "insert" ? "Inserted " + (id ? "cell " + id : "a new cell") + " with " + new_source
    : "Deleted cell " + id;
  // (Its hooks' cell_type is the type asked for, "code" when none was, as Claude Code's output gives it.)
  return { text: JSON.stringify(nb, null, 1), said, mode, cellId: id || undefined, oldSource, newSource: new_source, cellType: type || "code", language };
}

// ── ITS CARD ─────────────────────────────────────────────────────────────────
/**
 * THE CELL AS IT IS NOW, FOR THE CARD THAT ASKS ABOUT A REPLACE OR A DELETE (Claude Code 2.1.326's own: its dialog shows the
 * cell's current text beside the new one, and says why when it can't: its changelog, "Fixed notebook cell delete/replace
 * approval dialogs silently omitting the existing cell content when the notebook or cell could not be read; the dialog now says
 * why"; the owner, 2026-11-17: "Double check that same tool against the claude code docs again pls"). Its own check of the
 * notebook's text, which a byte-order mark fails. → { source }, or { why } in its words.
 */
export function cellBefore(text, cell_id) {
  let nb;
  try { nb = JSON.parse(text); } catch { return { why: CARD_UNPARSABLE }; }
  if (nb === null || !isNotebook(nb)) return { why: CARD_UNPARSABLE };
  let at = -1;
  if (cell_id) {
    at = nb.cells.findIndex((c) => c.id === cell_id);
    if (at === -1) { const n = cellPlace(cell_id); if (n !== undefined && nb.cells[n]) at = n; }
  }
  return at < 0 ? { why: CARD_NO_CELL } : { source: sourceText(nb.cells[at].source) };
}
/** Its words for a cell it can't show, and its line on the card then (an edit or a deletion approved this once). */
export const CARD_UNPARSABLE = "the notebook could not be parsed for preview", CARD_NO_CELL = "the target cell was not found in the notebook";
export const CARD_UNREADABLE = "the notebook could not be read", CARD_TOO_BIG = "the notebook is too large to preview";
export const cardUnshown = (why, mode) => "Current cell contents cannot be shown (" + why + ") \u2014 the " + (mode === "delete" ? "deletion" : "edit") + " cannot be reviewed, so approval is one-time only (deny unless expected).";

/** Its answer kept inline up to Claude Code's maxResultSizeChars for it (1e5 in its program); past that saved, with a preview. */
export const NOTEBOOK_INLINE_MAX = 100_000;

/** Its label in the chat (Claude Code's tool row, its own code: the notebook, then "@" and the cell when one is named). */
export const notebookLabel = (a) => String((a && a.notebook_path) || "") + (a && typeof a.cell_id === "string" && a.cell_id ? "@" + a.cell_id : "");
