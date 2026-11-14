/**
 * CLAUDE CODE'S SCHEMAS, CHECKED AS ITS ZOD 4 CHECKS THEM (the owner, 2026-11-14: "Fix base on Claude Code docs, please"):
 * the issues zod gives for a value, in its words and its order, and what Claude Code makes of them. Pure (no Node module):
 * coder-hooks.mjs, which Coder's Worker also loads, uses it. Read in Claude Code 2.1.325's program (its zod is 4.6) and
 * checked against zod 4.6's own output:
 *   - zodIssues(schema, value): zod's issue list (`expected`/`code`/`path`/`message`, …), each issue's keys in zod's order;
 *   - zodMessage(issues): zod's error message, the issues as JSON (what Claude Code shows when nothing better applies);
 *   - failedText(tool, issues): Claude Code's own wording of them (its w0): "<Tool> failed due to the following issue(s):"
 *     with the missing, unexpected and wrongly typed parameters first; with none of those, zod's message as it is;
 *   - OUTPUT_SHAPES: each of Claude Code's tools' output schema, which a PostToolUse hook's updatedToolOutput must match
 *     (its hooks reference: "The value must match the tool's output shape"), and checkRewrite, its check of one;
 *   - fromJsonSchema(parameters): a tool's JSON schema (what Grok is given) as such a schema, for a hook's updatedInput.
 */

// ── A SCHEMA ─────────────────────────────────────────────────────────────────
const node = (t, o = {}) => Object.freeze({ t, ...o });
/** zod's types, as Claude Code's schemas use them (o(), E(), I(), T(), B(), C(), u(), He(), me(), We(), Ir(), ie()). */
export const z = Object.freeze({
  string: (o = {}) => node("string", o), // { min, minMessage }
  number: (o = {}) => node("number", o), // { int, gte, gt }
  boolean: () => node("boolean"),
  literal: (v) => node("literal", { v }),
  enum: (vals) => node("enum", { vals: Object.freeze([...vals]) }),
  array: (of, o = {}) => node("array", { of, ...o }), // { min, max }
  object: (shape, mode = "strip") => node("object", { shape: Object.freeze({ ...shape }), mode }), // "strip" (u), "strict" (He)
  record: (of) => node("record", { of }),
  union: (opts) => node("union", { opts: Object.freeze([...opts]) }),
  disc: (key, opts) => node("disc", { key, opts: Object.freeze([...opts]) }),
  unknown: () => node("unknown"),
});
/** .optional() */
export const opt = (s) => Object.freeze({ ...s, opt: true });
/** .nullable() */
export const nullable = (s) => Object.freeze({ ...s, nullable: true });
/** .default(v) */
export const withDefault = (s, v) => Object.freeze({ ...s, dflt: v });
/** .optional().catch(undefined): never an issue. */
export const caught = (s) => Object.freeze({ ...s, caught: true });

// ── ITS ISSUES ───────────────────────────────────────────────────────────────
const plain = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** What a value is, as zod's message names it ("received …"). */
export function kindOf(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number" && !Number.isFinite(v)) return String(v);
  return typeof v;
}
/** A value as zod's messages write one ("text" in quotes, true as it is). */
const shown = (v) => (typeof v === "string" ? JSON.stringify(v) : typeof v === "bigint" ? v + "n" : String(v));
const typeIssue = (expected, v, path) => ({ expected, code: "invalid_type", path, message: "Invalid input: expected " + expected + ", received " + kindOf(v) });
const valueIssue = (values, path) => ({ code: "invalid_value", values: [...values], path, message: values.length === 1 ? "Invalid input: expected " + shown(values[0]) : "Invalid option: expected one of " + values.map(shown).join("|") });
// (A size's words by what was measured: characters, items, or, for anything else with a length, a bare number.)
const UNITS = { string: "characters", array: "items" };
const sized = (origin, n, rel) => "expected " + origin + (UNITS[origin] ? " to have " + rel + n + " " + UNITS[origin] : " to be " + rel + n);
// (`custom`: the schema's own message, as TodoWrite's min(1, "Content cannot be empty").)
const small = (origin, minimum, inclusive, path, custom = "") => ({ origin, code: "too_small", minimum, inclusive, path, message: custom || "Too small: " + sized(origin, minimum, inclusive ? ">=" : ">") });
const big = (origin, maximum, path) => ({ origin, code: "too_big", maximum, inclusive: true, path, message: "Too big: " + sized(origin, maximum, "<=") });
/** A string's or an array's size checks, run on whatever has a length, as zod 4's are (a wrong type does not stop them). */
function sizes(s, v, path, out) {
  if (v === null || v === undefined || typeof v.length !== "number") return;
  const origin = Array.isArray(v) ? "array" : typeof v === "string" ? "string" : "unknown";
  if (s.min !== undefined && v.length < s.min) out.push(small(origin, s.min, true, path, s.minMessage));
  if (s.max !== undefined && v.length > s.max) out.push(big(origin, s.max, path));
}
/** zod's issues that let a union's other checks go on ("continue"): a size, a key it does not know, a refinement. */
const GOES_ON = new Set(["too_small", "too_big", "unrecognized_keys", "custom", "invalid_format"]);
// (An issue's path made longer in place, so its keys keep zod's order.)
const repath = (issues, path) => issues.map((x) => ({ ...x, path: [...path, ...x.path] }));

function run(s, v, path, out) {
  if (s.caught) { run({ ...s, caught: false }, v, path, []); return; }
  if (v === undefined && (s.opt || s.dflt !== undefined)) return;
  if (v === null && s.nullable) return;
  switch (s.t) {
    case "unknown": return;
    case "string":
      if (typeof v !== "string") out.push(typeIssue("string", v, path));
      sizes(s, v, path, out);
      return;
    case "number":
      if (typeof v !== "number") { out.push(typeIssue("number", v, path)); return; }
      if (!Number.isFinite(v)) { out.push({ expected: "number", code: "invalid_type", received: kindOf(v), path, message: "Invalid input: expected number, received " + kindOf(v) }); return; }
      if (s.int && !Number.isInteger(v)) { out.push({ expected: "int", format: "safeint", code: "invalid_type", path, message: "Invalid input: expected int, received number" }); return; }
      if (s.gte !== undefined && v < s.gte) out.push(small("number", s.gte, true, path));
      if (s.gt !== undefined && !(v > s.gt)) out.push(small("number", s.gt, false, path));
      return;
    case "boolean":
      if (typeof v !== "boolean") out.push(typeIssue("boolean", v, path));
      return;
    case "literal":
      if (v !== s.v) out.push(valueIssue([s.v], path));
      return;
    case "enum":
      if (!s.vals.includes(v)) out.push(valueIssue(s.vals, path));
      return;
    case "array":
      if (!Array.isArray(v)) out.push(typeIssue("array", v, path));
      else v.forEach((x, i) => run(s.of, x, [...path, i], out));
      sizes(s, v, path, out);
      return;
    case "object": {
      if (!plain(v)) { out.push(typeIssue("object", v, path)); return; }
      for (const [k, sub] of Object.entries(s.shape)) run(sub, own(v, k) ? v[k] : undefined, [...path, k], out);
      if (s.mode === "strict") {
        const keys = Object.keys(v).filter((k) => !own(s.shape, k));
        if (keys.length) out.push({ code: "unrecognized_keys", keys, path, message: "Unrecognized key" + (keys.length > 1 ? "s" : "") + ": " + keys.map((k) => JSON.stringify(k)).join(", ") });
      }
      return;
    }
    case "record":
      if (!plain(v)) { out.push(typeIssue("record", v, path)); return; }
      for (const k of Object.keys(v)) run(s.of, v[k], [...path, k], out);
      return;
    case "union": {
      const each = [];
      for (const o of s.opts) { const sub = []; run(o, v, [], sub); if (!sub.length) return; each.push(sub); }
      const goOn = each.filter((sub) => sub.every((x) => GOES_ON.has(x.code)));
      if (goOn.length === 1) { out.push(...repath(goOn[0], path)); return; }
      out.push({ code: "invalid_union", errors: each, path, message: "Invalid input" });
      return;
    }
    case "disc": {
      if (!plain(v)) { out.push({ code: "invalid_type", expected: "object", path, message: "Invalid input: expected object, received " + kindOf(v) }); return; }
      const hit = s.opts.find((o) => o.shape[s.key] && o.shape[s.key].v === v[s.key]);
      if (hit) { run(hit, v, path, out); return; }
      const options = s.opts.map((o) => o.shape[s.key].v);
      out.push({ code: "invalid_union", errors: [], note: "No matching discriminator", discriminator: s.key, options, path: [...path, s.key], message: "Invalid discriminator value. Expected " + options.map((x) => "'" + x + "'").join(" | ") });
      return;
    }
    default: return;
  }
}
/** zod's issues for a value (none when it matches), each with its path from the value's top. */
export function zodIssues(schema, value) {
  const out = [];
  run(schema, value, [], out);
  return out;
}
/** zod's error message: the issues as JSON, two spaces deep. */
export const zodMessage = (issues) => JSON.stringify(issues, null, 2);

// ── CLAUDE CODE'S WORDS FOR THEM (its w0) ────────────────────────────────────
/** A parameter's path as Claude Code writes it: questions[0].options. */
export const pathText = (p) => p.reduce((s, x, i) => (typeof x === "number" ? s + "[" + x + "]" : i === 0 ? String(x) : s + "." + String(x)), "");
/** Its cut of a long message: the first 500 characters, then "… [+N chars]". */
const cut500 = (t) => { if (t.length <= 500) return t; let n = t.slice(0, 500); if (/[\ud800-\udbff]$/.test(n)) n = n.slice(0, -1); return n + "… [+" + (t.length - n.length) + " chars]"; };
/**
 * WHAT CLAUDE CODE SAYS OF A SCHEMA'S ISSUES (2.1.325's w0): the missing parameters, the unexpected ones, those of the wrong
 * type, then the rest ("is invalid: …", at most 20, then "(N more issues not listed)"), headed "<tool> failed due to the
 * following issue(s):"; with none of the first three, zod's own message, the issues as JSON.
 */
export function failedText(tool, issues) {
  const missing = issues.filter((x) => x.code === "invalid_type" && String(x.message || "").includes("received undefined")).map((x) => "The required parameter `" + pathText(x.path) + "` is missing");
  const unexpected = issues.filter((x) => x.code === "unrecognized_keys").flatMap((x) => x.keys.map((k) => "An unexpected parameter `" + pathText([...x.path, k]) + "` was provided"));
  const wrong = issues.filter((x) => x.code === "invalid_type" && !String(x.message || "").includes("received undefined")).map((x) => "The parameter `" + pathText(x.path) + "` type is expected as `" + x.expected + "` but provided as `" + ((/received (\w+)/.exec(String(x.message || "")) || [])[1] || "unknown") + "`");
  const lines = [...missing, ...unexpected, ...wrong];
  if (!lines.length) return zodMessage(issues);
  const other = issues.filter((x) => x.code !== "invalid_type" && x.code !== "unrecognized_keys").map((x) => {
    const p = pathText(x.path), who = p === "" ? "The input" : "The parameter `" + p + "`";
    const why = cut500(String(x.message || "").replace(/^Invalid input(?:: |$)/, ""));
    return why !== "" ? who + " is invalid: " + why : x.code === "invalid_union" ? who + " matches none of the accepted forms" : who + " is invalid";
  });
  lines.push(...other.slice(0, 20));
  if (other.length > 20) lines.push("(" + (other.length - 20) + " more " + (other.length - 20 === 1 ? "issue" : "issues") + " not listed)");
  return tool + " failed due to the following " + (lines.length > 1 ? "issues" : "issue") + ":\n" + lines.join("\n");
}

// ── A TOOL'S JSON SCHEMA AS ONE OF THESE ─────────────────────────────────────
/**
 * A tool's parameters (the JSON schema Grok is given) as such a schema: types, required inputs, enums, sizes and minimums;
 * the top object strict (Claude Code's tool schemas are, so a key it does not know is an issue of its own, which a hook's
 * rewrite has dropped); `format` is left to the tool's own check.
 */
export function fromJsonSchema(js, top = true) {
  const j = js && typeof js === "object" ? js : {};
  let s;
  if (Array.isArray(j.enum)) s = z.enum(j.enum);
  else if (j.type === "string") s = z.string({ ...(Number.isInteger(j.minLength) ? { min: j.minLength } : {}), ...(Number.isInteger(j.maxLength) ? { max: j.maxLength } : {}) });
  else if (j.type === "integer" || j.type === "number") s = z.number({ ...(j.type === "integer" ? { int: true } : {}), ...(typeof j.minimum === "number" ? { gte: j.minimum } : {}), ...(typeof j.exclusiveMinimum === "number" ? { gt: j.exclusiveMinimum } : {}) });
  else if (j.type === "boolean") s = z.boolean();
  else if (j.type === "array") s = z.array(j.items ? fromJsonSchema(j.items, false) : z.unknown(), { ...(Number.isInteger(j.minItems) ? { min: j.minItems } : {}), ...(Number.isInteger(j.maxItems) ? { max: j.maxItems } : {}) });
  else if (j.type === "object" && !j.properties && j.additionalProperties && typeof j.additionalProperties === "object") s = z.record(fromJsonSchema(j.additionalProperties, false));
  else if (j.type === "object") {
    const req = new Set(Array.isArray(j.required) ? j.required : []);
    const shape = {};
    for (const [k, v] of Object.entries(j.properties || {})) { const p = fromJsonSchema(v, false); shape[k] = req.has(k) ? p : opt(p); }
    s = z.object(shape, top || j.additionalProperties === false ? "strict" : "strip");
  } else s = z.unknown();
  return j.default !== undefined ? withDefault(s, j.default) : s;
}
/**
 * A hook's input read as Claude Code's schemas read theirs: a number written as text taken as a number, and "true" or
 * "false" as a boolean, where the parameter is one (Claude Code's preprocessing of such inputs, its AB and _T).
 */
export function coerceInput(js, input) {
  if (!plain(input) || !js || !js.properties) return input;
  const out = { ...input };
  for (const [k, p] of Object.entries(js.properties)) {
    if (!own(out, k) || typeof out[k] !== "string" || !p) continue;
    const v = out[k];
    if ((p.type === "number" || p.type === "integer") && /^\s*[-+]?\d+(\.\d+)?\s*$/.test(v)) { const n = Number(v.trim()); if (Number.isFinite(n)) out[k] = n; }
    else if (p.type === "boolean" && (v === "true" || v === "false")) out[k] = v === "true";
  }
  return out;
}
/** The input without the keys a schema does not know (Claude Code: "unknown keys are dropped"). */
export function withoutUnknown(js, input) {
  if (!plain(input) || !js || !js.properties) return input;
  const out = {};
  for (const k of Object.keys(input)) if (own(js.properties, k)) out[k] = input[k];
  return out;
}

// ── CLAUDE CODE'S TOOLS' OUTPUT SHAPES (2.1.325) ─────────────────────────────
const S = z.string(), N = z.number(), B = z.boolean();
const o = (shape) => z.object(shape);
const hunk = o({ oldStart: N, oldLines: N, newStart: N, newLines: N, lines: z.array(S) });
const gitDiff = o({ filename: S, status: z.enum(["modified", "added"]), additions: N, deletions: N, changes: N, patch: S, repository: opt(nullable(S)) });
const staged = { staged: opt(B), stagedWording: caught(S) };
const BASH_OUT = o({
  stdout: S, stderr: S, rawOutputPath: opt(S), interrupted: B, isImage: opt(B), backgroundTaskId: opt(S), backgroundOutputPath: opt(S),
  backgroundedByUser: opt(B), backgroundedByTurnAbort: opt(B), backgroundedToDeliverMessage: opt(B), timedOutAfterMs: opt(N),
  subagentCapApplied: opt(z.literal(true)), backgroundCwdHint: opt(S), backgroundEndsWithFinalResponse: opt(z.literal(true)),
  backgroundWakesOwner: opt(z.literal(true)), dangerouslyDisableSandbox: opt(B), returnCodeInterpretation: opt(S), noOutputExpected: opt(B),
  structuredContent: opt(z.array(z.unknown())), persistedOutputPath: opt(S), persistedOutputSize: opt(N), stdoutHoldsOutputEnd: opt(B),
  tailInputPath: opt(S), tailInputNote: opt(S), memoryLimitNote: opt(S), triggeredNote: opt(S), staleReadFileStateHint: opt(S), ghRateLimitHint: opt(S),
  gitOperation: opt(z.unknown()),
  bashEditDiff: opt(o({ files: z.array(o({ filePath: S, hunks: z.array(hunk), created: opt(z.literal(true)), deleted: opt(z.literal(true)) })), moreFiles: N, changedFiles: opt(z.array(S)), unavailable: opt(z.literal(true)), skipped: opt(z.literal(true)), shared: opt(z.literal(true)) })),
});
const POWERSHELL_OUT = o({
  stdout: S, stderr: S, interrupted: B, returnCodeInterpretation: opt(S), isImage: opt(B), persistedOutputPath: opt(S), persistedOutputSize: opt(N),
  backgroundTaskId: opt(S), backgroundedByUser: opt(B), backgroundedByTurnAbort: opt(B), backgroundedToDeliverMessage: opt(B), timedOutAfterMs: opt(N),
  subagentCapApplied: opt(z.literal(true)), backgroundEndsWithFinalResponse: opt(z.literal(true)),
});
const IMAGE_TYPE = z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const READ_OUT = z.disc("type", [
  o({ type: z.literal("text"), file: o({ filePath: S, content: S, numLines: N, startLine: N, totalLines: N, truncatedByTokenCap: opt(B) }), artifactRead: opt(o({ slug: S, ver: S })) }),
  o({ type: z.literal("image"), file: o({ base64: S, type: IMAGE_TYPE, originalSize: N, dimensions: opt(o({ originalWidth: opt(N), originalHeight: opt(N), displayWidth: opt(N), displayHeight: opt(N) })) }) }),
  o({ type: z.literal("notebook"), file: o({ filePath: S, cells: z.array(z.unknown()) }) }),
  o({ type: z.literal("pdf"), file: o({ filePath: S, base64: S, originalSize: N }) }),
  o({ type: z.literal("parts"), file: o({ filePath: S, originalSize: N, count: N, outputDir: S }), firstPage: opt(N), totalPages: opt(N), pages: opt(z.array(o({ base64: S, mediaType: IMAGE_TYPE, error: opt(S), text: opt(S) }))) }),
]);
const TASK_STATUS = z.enum(["pending", "in_progress", "completed"]);
// (TodoWrite's todo, as its schema has it: each text at least one character, in its own words.)
const TODO = o({ content: z.string({ min: 1, minMessage: "Content cannot be empty" }), status: TASK_STATUS, activeForm: z.string({ min: 1, minMessage: "Active form cannot be empty" }) });
const QUESTION = o({
  question: S, header: S, kind: opt(z.enum(["choice", "text", "number"])), description: opt(S),
  options: withDefault(z.array(o({ label: S, description: opt(S), preview: opt(S) }), { max: 4 }), []), multiSelect: withDefault(B, false),
  placeholder: opt(S), min: opt(N), max: opt(N), step: opt(z.number({ gt: 0 })), defaultValue: opt(N), unit: opt(S),
});
/**
 * EACH OF CLAUDE CODE'S TOOLS' OUTPUT SCHEMA (by its name), as 2.1.325 has them: what a PostToolUse hook's updatedToolOutput
 * is checked against. A tool with none here (a connector's, MCP, and Coder's own tools) takes any value: Claude Code's "MCP
 * tool output is passed through without schema validation".
 */
export const OUTPUT_SHAPES = Object.freeze({
  Bash: BASH_OUT,
  PowerShell: POWERSHELL_OUT,
  Monitor: o({ taskId: S, timeoutMs: N, persistent: opt(B) }),
  Read: READ_OUT,
  Write: o({ type: z.enum(["create", "update"]), filePath: S, content: S, structuredPatch: z.array(hunk), originalFile: nullable(S), gitDiff: opt(gitDiff), userModified: opt(B), ...staged }),
  Edit: o({ filePath: S, oldString: S, newString: S, originalFile: nullable(S), structuredPatch: z.array(hunk), userModified: B, replaceAll: B, gitDiff: opt(gitDiff), ...staged }),
  Grep: o({ mode: opt(z.enum(["content", "files_with_matches", "count"])), numFiles: N, filenames: z.array(S), content: opt(S), numLines: opt(N), numMatches: opt(N), totalFiles: opt(N), totalLines: opt(N), appliedLimit: opt(N), appliedOffset: opt(N), timedOut: opt(B) }),
  Glob: o({ durationMs: N, numFiles: N, filenames: z.array(S), truncated: B, totalMatches: opt(N), countIsComplete: opt(B), timedOut: opt(B) }),
  LSP: o({ operation: z.enum(["goToDefinition", "findReferences", "hover", "documentSymbol", "workspaceSymbol", "goToImplementation", "prepareCallHierarchy", "incomingCalls", "outgoingCalls"]), result: S, filePath: S, resultCount: opt(z.number({ int: true, gte: 0 })), fileCount: opt(z.number({ int: true, gte: 0 })) }),
  WebFetch: o({ bytes: N, code: N, codeText: S, result: S, durationMs: N, url: S, citable: opt(z.literal(true)), artifactRead: opt(o({ slug: S, ver: opt(S), seeded: opt(z.literal(false)) })) }),
  WebSearch: o({ query: S, results: z.array(z.union([o({ tool_use_id: S, content: z.array(o({ title: S, url: S, snippet: opt(S) })) }), S])), durationSeconds: N, searchCount: opt(N) }),
  TaskStop: o({ message: S, task_id: S, task_type: S, command: opt(S) }),
  AskUserQuestion: o({ questions: z.array(QUESTION), answers: z.record(S), response: opt(S), annotations: opt(z.record(o({ preview: opt(S), notes: opt(S), unanswered: caught(S) }))), afkTimeoutMs: opt(z.number({ int: true, gt: 0 })), followUp: opt(B) }),
  ExitPlanMode: o({ plan: nullable(S), isAgent: B, filePath: opt(S), hasTaskTool: opt(B), planWasEdited: opt(B), awaitingLeaderApproval: opt(B), requestId: opt(S) }),
  EnterPlanMode: o({ message: S }),
  TodoWrite: o({ oldTodos: z.array(TODO), newTodos: z.array(TODO) }),
  TaskCreate: o({ task: o({ id: S, subject: S, description: caught(S) }) }),
  TaskGet: o({ task: nullable(o({ id: S, subject: S, description: S, status: TASK_STATUS, blocks: z.array(S), blockedBy: z.array(S) })) }),
  TaskList: o({ tasks: z.array(o({ id: S, subject: S, status: TASK_STATUS, owner: opt(S), blockedBy: z.array(S) })) }),
  TaskUpdate: o({ success: B, taskId: S, updatedFields: z.array(S), error: opt(S), statusChange: opt(o({ from: S, to: S })) }),
});

// ── A POSTTOOLUSE HOOK'S updatedToolOutput ───────────────────────────────────
/** Claude Code's notice for a rewrite it does not use (shown to the owner, never to the model). */
export const outputShapeNotice = (tool, detail, withNote = false) => "PostToolUse hook returned updatedToolOutput that does not match " + tool + "'s output shape; using original output." + (withNote ? " A host-asserted classifier context attached by the same hook was discarded with the rejected rewrite." : "") + " " + detail;
/** Whether two values are the same, deep (Claude Code's E_, for a hook's input or output given back as it was). */
export const deepEqual = (a, b) => { if (a === b) return true; if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false; if (Array.isArray(a) !== Array.isArray(b)) return false; const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => own(b, k) && deepEqual(a[k], b[k])); };
/** A value with no fixed shape as text (a connector's, as Claude Code passes an MCP tool's on): its text, its text blocks, or its JSON. */
export function passedText(v) {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.every((b) => plain(b) && typeof b.type === "string")) return v.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
}
/**
 * A HOOK'S REWRITE OF A TOOL'S OUTPUT, AS CLAUDE CODE TAKES IT (2.1.325, after the call's PostToolUse hooks, on the last one's
 * value): a tool with an output schema has it checked ("For built-in tools, a value that doesn't match the tool's output
 * schema is ignored and the original output is used"), then shown through the tool's own text (`textOf`, Claude Code's
 * mapToolResultToToolResultBlockParam: here what Coder prints for that result object); any other tool's is passed on as it
 * is ("MCP tool output is passed through without schema validation"). → { text, pics? } or { notice } (Claude Code's
 * words; the original output stays). `given`: the result object Coder gave the hooks; a top-level part of it given back
 * unchanged is not checked again (Coder made it, and Claude Code's own would always pass).
 */
export function checkRewrite(tool, value, { textOf = null, given = null, withNote = false } = {}) {
  // (An answer with no text in it, Claude Code's: "(<Tool> completed with no output)".)
  const said = (text, pics = null) => (String(text).trim() === "" && !(pics && pics.length) ? { text: "(" + tool + " completed with no output)" } : { text: String(text), ...(pics && pics.length ? { pics } : {}) });
  const shape = OUTPUT_SHAPES[tool];
  if (!shape) return said(passedText(value));
  let schema = shape;
  if (plain(value) && plain(given) && shape.t === "object") {
    const same = Object.keys(shape.shape).filter((k) => own(value, k) && own(given, k) && deepEqual(value[k], given[k]));
    if (same.length) schema = z.object(Object.fromEntries(Object.entries(shape.shape).map(([k, s]) => [k, same.includes(k) ? opt(z.unknown()) : s])), shape.mode);
  }
  const issues = zodIssues(schema, value);
  if (issues.length) return { notice: outputShapeNotice(tool, zodMessage(issues), withNote) };
  let r;
  try { r = typeof textOf === "function" ? textOf(tool, value) : undefined; } catch (e) { return { notice: outputShapeNotice(tool, String((e && e.message) || e), withNote) }; }
  if (r === undefined || r === null) return { notice: outputShapeNotice(tool, "mapper returned undefined", withNote) };
  return typeof r === "string" ? said(r) : said(r.text ?? "", Array.isArray(r.pics) ? r.pics : null);
}
/** A command's text from Bash's or PowerShell's result object (Claude Code's mapToolResultToToolResultBlockParam). */
export function bashOutputText(v) {
  const out = v.stdout ? v.stdout.replace(/^(\s*\n)+/, "").trimEnd() : "";
  let err = v.stderr.trim();
  if (v.interrupted) { if (v.stderr) err += "\n"; err += "<error>Command was aborted before completion</error>"; }
  return [out, err].filter(Boolean).join("\n");
}
