/**
 * CLAUDE CODE'S AskUserQuestion, AS CODER'S ask_user (the owner, 2026-11-14: "Do all the talk to you tools execpt for the
 * notify one"; Claude Code's tools reference, "AskUserQuestion tool behavior"; its hooks reference; the Agent SDK's "Handle
 * approvals and user input"; and its own 2.1.325 program where the docs say nothing):
 *   - what Grok is told: Claude Code's description and inputs, word for word ("the user" is "the owner", as in Coder's other
 *     texts);
 *   - its input check, before any hook (coder-inputs.mjs): its schema's refusals in its words, with its steer for a question
 *     of fewer than 2 options;
 *   - the owner's answer on Coder's card as Claude Code's `answers` (keyed by each question's text; a multi-select's labels
 *     joined with ", "), and what Grok gets back (coder-hooks.mjs's answeredText);
 *   - a question as the auto mode checker sees it (Claude Code's toAutoClassifierInput).
 * Gloopy keeps its own ask_user (gloopy-agent.mjs), as before.
 */
import { joinLabels } from "./coder-hooks.mjs";
import { issuesText, typeIssue, tooSmallIssue, tooBigIssue, unknownKeysIssue, customIssue, receivedKind } from "./coder-zodtext.mjs";

// ── WHAT GROK IS TOLD ────────────────────────────────────────────────────────
/**
 * The description: Claude Code's for a model it has no older prompt for (its lean prompt, which Grok gets: its usage notes,
 * its plan-mode note, "Reserve this for decisions …" and "The user may see only the question dialog …"). The plan-mode note
 * names enter_plan_mode since Coder has it (2026-11-14, Claude Code's EnterPlanMode); Claude Code leaves the note out only in
 * a session without a disk that lacks EnterPlanMode or ExitPlanMode, never in one with a disk, as Coder's chats are.
 */
export const PLAN_MODE_NOTE = "Plan mode note: To switch into plan mode, use enter_plan_mode (not this tool). Once in plan mode, use this tool to clarify requirements or choose between approaches BEFORE finalizing your plan. Do NOT use this tool to ask \"Is my plan ready?\", \"Should I proceed?\", or otherwise reference \"the plan\" in questions \u2014 the owner cannot see the plan until you call exit_plan_mode for approval.";
export const ASK_USER_DESCRIPTION = "Use this tool only when you are blocked on a decision that is genuinely the owner's to make: one you cannot resolve from the request, the code, or sensible defaults.\n\n" +
  "Usage notes:\n" +
  "- The owner will always be able to select \"Other\" to provide custom text input\n" +
  "- Use multiSelect: true to allow multiple answers to be selected for a question\n" +
  "- If you recommend a specific option, make that the first option in the list and add \"(Recommended)\" at the end of the label\n" +
  "\n" + PLAN_MODE_NOTE + "\n" +
  "\nReserve this for decisions where the owner's answer changes what you do next — not for choices with a conventional default or facts you can verify in the codebase yourself. In those cases pick the obvious option, mention it in your response, and proceed.\n" +
  "\nThe owner may see only the question dialog: tool results and text you wrote earlier in this turn may not be on their screen while it is open. Make each question stand on its own: if it depends on something you found, say so briefly, and name the items you are asking about in the question itself.\n";
/** Claude Code's chip limit, said in the header's description (not checked: its schema does not either). */
export const HEADER_MAX = 12;
/** The inputs, in Claude Code's order, each with its own description (its schema with the option descriptions required). */
export const ASK_USER_PROPERTIES = Object.freeze({
  questions: {
    type: "array", minItems: 1, maxItems: 4,
    description: "Questions to ask the owner (1-4 questions)",
    items: {
      type: "object",
      properties: {
        question: { type: "string", description: "The complete question to ask the owner. Should be clear, specific, and end with a question mark. Example: \"Which library should we use for date formatting?\" If multiSelect is true, phrase it accordingly, e.g. \"Which features do you want to enable?\"" },
        header: { type: "string", description: "Very short label displayed as a chip/tag (max " + HEADER_MAX + " chars). Examples: \"Auth method\", \"Library\", \"Approach\"." },
        options: {
          type: "array", minItems: 2, maxItems: 4,
          description: "The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "The display text for this option that the owner will see and select. Should be concise (1-5 words) and clearly describe the choice." },
              description: { type: "string", description: "Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications." },
              preview: { type: "string", description: "Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help the owner compare options. See the tool description for the expected content format." },
            },
            required: ["label", "description"],
          },
        },
        multiSelect: { type: "boolean", default: false, description: "Set to true to allow the owner to select multiple options instead of just one. Use when choices are not mutually exclusive." },
      },
      required: ["question", "header", "options"],
    },
  },
  answers: { type: "object", additionalProperties: { type: "string" }, description: "Owner answers collected by the permission component" },
  annotations: {
    type: "object",
    additionalProperties: { type: "object", properties: { preview: { type: "string", description: "The preview content of the selected option, if the question used previews." }, notes: { type: "string", description: "Free-text notes the owner added to their selection." } } },
    description: "Optional per-question annotations from the owner (e.g., notes on preview selections). Keyed by question text.",
  },
  metadata: { type: "object", properties: { source: { type: "string", description: "Optional identifier for the source of this question (e.g., \"remember\" for /remember command). Used for analytics tracking." } }, description: "Optional metadata for tracking and analytics purposes. Not displayed to the owner." },
});

// ── ITS INPUT CHECK (Claude Code's schema, its zod messages) ─────────────────
/** Claude Code's steer for a question with fewer than 2 options, said before its schema's words. */
export const FEW_OPTIONS_STEER = "This call included a question with fewer than 2 options, so it was rejected and the person never saw it. A question with a single option has no decision in it. Do not retry this call and do not invent a filler second option. Instead, state the one path you were going to offer as the approach you are taking, then continue with the task. If this call also contained questions with 2 to 4 options (each with distinct labels), you may re-ask those questions alone in a new call. Ask a question only when the person has at least two genuinely distinct choices.";
/** Its refine's words: no two questions with one text, no two options of a question with one label. */
export const UNIQUE_MESSAGE = "Question texts must be unique, option labels must be unique within each question";
/** What Claude Code adds after a hook's rewrite that fails the schema. */
export const HOOK_REWRITE_TAIL = "The tool input from the model was valid; the hook's rewrite of it was not.";
const TOP_KEYS = ["questions", "answers", "annotations", "metadata"];
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** A value's kind as zod names it ("received …"). */
const kindOf = receivedKind;
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isPlain = (v) => isObj(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const sizeIssue = (min, n, path) => (min ? tooSmallIssue("array", n, path) : tooBigIssue("array", n, path));
/** A string the schema requires (`optional`: may be left out). */
function str(v, path, issues, optional = false) {
  if (v === undefined && optional) return undefined;
  if (typeof v !== "string") { issues.push(typeIssue("string", v, path)); return undefined; }
  return v;
}
/**
 * THE INPUT AS CLAUDE CODE'S SCHEMA READS IT (zod 4, in its order): `{ value, issues, read }`, the value with its default
 * (multiSelect false) and without the keys its inner objects do not know (it drops them; the outer object refuses them);
 * `value` is null when there are issues, `read` is what was read all the same.
 */
export function readAskUser(input) {
  const issues = [];
  if (!isObj(input)) { issues.push(typeIssue("object", input, [])); return { value: null, issues, read: null }; }
  const out = {};
  // questions: 1 to 4, each with question, header, options (2 to 4: label, description, preview) and multiSelect.
  const qs = input.questions;
  if (!Array.isArray(qs)) issues.push(typeIssue("array", qs, ["questions"]));
  else {
    out.questions = qs.map((q, i) => {
      const at = ["questions", i];
      if (!isObj(q)) { issues.push(typeIssue("object", q, at)); return q; }
      const o = {};
      const question = str(q.question, [...at, "question"], issues), header = str(q.header, [...at, "header"], issues);
      if (question !== undefined) o.question = question;
      if (header !== undefined) o.header = header;
      const opts = q.options;
      if (!Array.isArray(opts)) issues.push(typeIssue("array", opts, [...at, "options"]));
      else {
        o.options = opts.map((x, j) => {
          const ax = [...at, "options", j];
          if (!isObj(x)) { issues.push(typeIssue("object", x, ax)); return x; }
          const label = str(x.label, [...ax, "label"], issues), description = str(x.description, [...ax, "description"], issues), preview = str(x.preview, [...ax, "preview"], issues, true);
          return { ...(label !== undefined ? { label } : {}), ...(description !== undefined ? { description } : {}), ...(preview !== undefined ? { preview } : {}) };
        });
        if (opts.length < 2) issues.push(sizeIssue(true, 2, [...at, "options"]));
        if (opts.length > 4) issues.push(sizeIssue(false, 4, [...at, "options"]));
      }
      if (q.multiSelect === undefined) o.multiSelect = false;
      else if (typeof q.multiSelect !== "boolean") issues.push(typeIssue("boolean", q.multiSelect, [...at, "multiSelect"]));
      else o.multiSelect = q.multiSelect;
      return o;
    });
    if (qs.length < 1) issues.push(sizeIssue(true, 1, ["questions"]));
    if (qs.length > 4) issues.push(sizeIssue(false, 4, ["questions"]));
  }
  // answers: question text → answer (a list of labels is joined with ", ").
  if (input.answers !== undefined) {
    if (!isPlain(input.answers)) issues.push(typeIssue("record", input.answers, ["answers"]));
    else {
      out.answers = {};
      for (const k of Object.keys(input.answers)) {
        let v = input.answers[k];
        if (Array.isArray(v) && v.every((x) => typeof x === "string")) v = v.join(", ");
        if (typeof v !== "string") issues.push(typeIssue("string", v, ["answers", k]));
        else out.answers[k] = v;
      }
    }
  }
  // annotations: question text → { preview, notes }.
  if (input.annotations !== undefined) {
    if (!isPlain(input.annotations)) issues.push(typeIssue("record", input.annotations, ["annotations"]));
    else {
      out.annotations = {};
      for (const k of Object.keys(input.annotations)) {
        const v = input.annotations[k];
        if (!isObj(v)) { issues.push(typeIssue("object", v, ["annotations", k])); continue; }
        const preview = str(v.preview, ["annotations", k, "preview"], issues, true), notes = str(v.notes, ["annotations", k, "notes"], issues, true);
        out.annotations[k] = { ...(preview !== undefined ? { preview } : {}), ...(notes !== undefined ? { notes } : {}) };
      }
    }
  }
  // metadata: { source }.
  if (input.metadata !== undefined) {
    if (!isObj(input.metadata)) issues.push(typeIssue("object", input.metadata, ["metadata"]));
    else { const source = str(input.metadata.source, ["metadata", "source"], issues, true); out.metadata = source !== undefined ? { source } : {}; }
  }
  const unknown = Object.keys(input).filter((k) => !TOP_KEYS.includes(k));
  if (unknown.length) issues.push(unknownKeysIssue(unknown, []));
  // (Its refine runs only when nothing before it stopped the parse, as zod 4.6.2 runs it: a size issue and keys the object
  // does not know do not stop it, a missing or wrong field does.)
  if (!issues.some((x) => x.code !== "too_small" && x.code !== "too_big" && x.code !== "unrecognized_keys") && Array.isArray(out.questions)) {
    const texts = out.questions.map((q) => q.question);
    const ok = texts.length === new Set(texts).size && out.questions.every((q) => { const l = (q.options || []).map((x) => x.label); return l.length === new Set(l).size; });
    if (!ok) issues.push(customIssue(UNIQUE_MESSAGE, []));
  }
  return { value: issues.length ? null : out, issues, read: out };
}
/**
 * WHAT CLAUDE CODE SAYS OF THEM (its w0, coder-zodtext.mjs): the missing parameters, the unexpected ones and those of the
 * wrong type, then the rest ("is invalid: …", at most 20), headed "<tool> failed due to the following issue(s):"; with none of
 * the first three, zod's own message (the issues as JSON).
 */
export const schemaText = issuesText;
/** Claude Code's steer applies: a question whose options are a list of fewer than 2. */
const fewOptions = (input) => isObj(input) && Array.isArray(input.questions) && input.questions.slice(0, 256).some((q) => isObj(q) && Array.isArray(q.options) && q.options.length < 2);
/**
 * ask_user's INPUT, AS CLAUDE CODE TAKES IT (coder-inputs.mjs): refused before any hook, in its words ("InputValidationError:
 * AskUserQuestion failed due to …", its steer first for a question of fewer than 2 options), or read as its schema reads it.
 * A refusal starts with "error: ", Coder's mark of a failed call; `quiet`: the chat shows no step for it (Claude Code shows
 * no line for the tool's call). Gloopy's own ask_user is not Claude Code's: it is taken as it is.
 */
export function checkAskUserInput(args, ctx = {}) {
  if (ctx && ctx.who === "Gloopy") return { args };
  const r = readAskUser(args);
  if (r.issues.length) {
    const text = schemaText("AskUserQuestion", r.issues);
    return { error: "error: InputValidationError: " + (fewOptions(args) ? FEW_OPTIONS_STEER + "\n\n" + text : text), quiet: true };
  }
  return { args: r.value };
}
/**
 * A HOOK'S REWRITE OF THE INPUT, CHECKED AS CLAUDE CODE CHECKS IT (its schema, keys it does not know left aside): the input
 * as read, or `{ problem }`, its words: "<event> hook for AskUserQuestion returned updatedInput that failed schema
 * validation: …".
 */
export function checkHookRewrite(input, event) {
  const r = readAskUser(input);
  const issues = r.issues.filter((x) => x.code !== "unrecognized_keys");
  if (issues.length) return { problem: event + " hook for AskUserQuestion returned updatedInput that failed schema validation: " + schemaText("AskUserQuestion", issues) + "\n" + HOOK_REWRITE_TAIL };
  if (r.value) return { value: r.value };
  // (Only keys it does not know: what it read of the rest, as Claude Code goes on with the rest.)
  const kept = {};
  for (const k of TOP_KEYS) if (has(input, k)) kept[k] = input[k];
  return { value: readAskUser(kept).read || {} };
}

// ── THE CARD AND ITS ANSWER ──────────────────────────────────────────────────
/** What the card shows (Claude Code's shownCardInput): the questions, and the metadata; the model's own answers are left out. */
export const shownInput = (args) => ({ questions: args.questions, ...(args.metadata ? { metadata: args.metadata } : {}) });
/**
 * AN OPTION'S PREVIEW AS THE CARD SHOWS IT (Claude Code's dialog: "Preview content is rendered as markdown in a monospace box";
 * one with nothing visible in it is no preview): its text, or null. Only a single-select question shows them, as Claude Code's
 * ("previews are only supported for single-select questions (not multiSelect)"; its dialog gives the notes field and the
 * chosen preview only for one).
 */
export const previewOf = (o) => (isObj(o) && typeof o.preview === "string" && /\S/.test(o.preview.replace(/[\u200B-\u200F\u2060-\u2064\uFEFF\uFE0E\uFE0F]/g, "")) ? o.preview : null);
/** A question whose options show previews: single-select with at least one (Claude Code's dialog: then it has the notes field). */
export const hasPreviews = (q) => isObj(q) && q.multiSelect !== true && Array.isArray(q.options) && q.options.some((o) => previewOf(o) !== null);
/**
 * The questions as the answer texts read them (answeredText): each one's text (the answers' key), its labels, multi-select,
 * and its options' previews (single-select only; null where an option has none).
 */
export const answerKeys = (args) => args.questions.map((q) => ({ key: q.question, text: q.question, labels: q.options.map((o) => o.label), multi: q.multiSelect === true, previews: hasPreviews(q) ? q.options.map(previewOf) : null }));
/** Claude Code's marker for an answer that is only notes (its "(notes only)"): read as no option selected. */
export const NOTES_ONLY = "(notes only)";
/**
 * THE OWNER'S PICKS ON THE CARD AS CLAUDE CODE'S ANSWER: for each question, its options (by their place), what they typed
 * under Other, and their notes. `answers` maps each question's text to the label chosen (or what they typed), a
 * multi-select's joined with ", " (a label holding ", " or a quote in quotes, as Claude Code joins them); a question with
 * previews (Claude Code's dialog) gets, in `annotations`, the preview of the option chosen ("selected preview:") and the
 * notes typed in its notes field, and notes alone are its answer "(notes only)"; a question left unanswered is marked in
 * `annotations` as Claude Code's other apps mark one ("skipped"), which only hooks see.
 */
export function cardAnswers(keys, picks) {
  const answers = {}, annotations = {};
  let room = CARD_FRAME_MAX;
  keys.forEach((q, k) => {
    const p = Array.isArray(picks) && isObj(picks[k]) ? picks[k] : {};
    const at = [...new Set((Array.isArray(p.options) ? p.options : []).filter((x) => Number.isInteger(x) && x >= 0 && x < q.labels.length))].sort((a, b) => a - b);
    const chosen = at.map((x) => q.labels[x]);
    const own = typeof p.other === "string" ? p.other.trim() : "";
    const said = q.multi ? (chosen.length || own ? joinLabels(own ? [...chosen, own] : chosen) : "") : own || chosen[0] || "";
    // (Claude Code's dialog: its notes field and the chosen option's preview, only for a single-select question with previews.)
    const notes = Array.isArray(q.previews) && typeof p.notes === "string" ? p.notes.trim() : "";
    const preview = Array.isArray(q.previews) && !own && at.length ? q.previews[at[0]] : null;
    room -= said.length + notes.length;
    const note = { ...(preview && preview.length + q.key.length <= room ? { preview } : {}), ...(notes ? { notes } : {}) };
    if (note.preview) room -= preview.length + q.key.length;
    if (said) answers[q.key] = said;
    else if (notes) answers[q.key] = NOTES_ONLY;
    if (Object.keys(note).length) annotations[q.key] = note;
    else if (!said) annotations[q.key] = { unanswered: "skipped" };
  });
  return { answers, annotations };
}
/** Claude Code's limit on an answer a host gives (its admitCardAnswer): one answer, and all of them together. */
export const ANSWER_MAX = 32768;
/** Its limit on one question's notes. */
export const NOTES_MAX = 8192;
/** And on the whole answer with the previews and questions it names (its frame: 50,000 less 2,000). */
export const CARD_FRAME_MAX = 48000;
/**
 * THE OWNER'S PICKS ON A QUESTION CARD AS CODER'S MACHINE TAKES THEM (/answer): for each of its 1 to 4 questions, the
 * options chosen by their place (0 to 3, each once), what they typed under Other and their notes, within Claude Code's
 * limits on a host's answer (32,768 for an answer, 8,192 for notes, 32,768 for all of them together). null when it is
 * not that.
 */
export function questionPicks(list) {
  if (!Array.isArray(list) || list.length > 4) return null;
  let total = 0;
  const out = [];
  for (const p of list) {
    if (!isObj(p)) return null;
    const options = p.options === undefined ? [] : p.options, other = p.other === undefined ? "" : p.other, notes = p.notes === undefined ? "" : p.notes;
    if (!Array.isArray(options) || options.length > 4 || options.some((x) => !Number.isInteger(x) || x < 0 || x > 3) || new Set(options).size !== options.length) return null;
    if (typeof other !== "string" || other.length > ANSWER_MAX) return null;
    if (typeof notes !== "string" || notes.length > NOTES_MAX) return null;
    total += other.length + notes.length;
    out.push({ options: [...options], other, ...(notes ? { notes } : {}) });
  }
  return total > ANSWER_MAX ? null : out;
}
/** Every question marked as Claude Code's apps mark one the owner left another way: "skipped" or "replied_in_chat". */
export const allUnanswered = (keys, how) => Object.fromEntries(keys.map((q) => [q.key, { unanswered: how }]));

// ── FOR THE AUTO MODE CHECKER ────────────────────────────────────────────────
/** Claude Code's way of writing a value for its classifier: one line, backslashes and quotes escaped. */
const flat = (v) => (typeof v !== "string" ? "" : v.replace(/[\s\u0085]+/g, " ").trim().replace(/\\/g, "\\\\").replace(/"/g, "\\\""));
/**
 * A QUESTION AS THE CHECKER SEES IT (Claude Code's toAutoClassifierInput for AskUserQuestion): each question, its header,
 * whether several may be chosen, and its numbered options with their descriptions; questions joined with " | ".
 */
export function askUserForChecker(input) {
  try {
    const list = isObj(input) ? input.questions : undefined;
    if (!Array.isArray(list)) return "[malformed AskUserQuestion input]";
    const out = [];
    for (let c = 0; c < list.length; c++) {
      if (out.length >= 256) { out.push("[… further question entries elided: reported length " + list.length + "]"); break; }
      const m = list[c];
      if (typeof m !== "object" || m === null) { const t = flat(m); out.push(t ? "[malformed question entry] " + t : "[malformed question entry]"); continue; }
      const opts = [];
      if (Array.isArray(m.options)) for (let y = 0; y < m.options.length; y++) {
        if (opts.length >= 256) { opts.push("[… further option entries elided]"); break; }
        const o = m.options[y];
        if (typeof o !== "object" || o === null) { opts.push("(" + (y + 1) + ") \"" + flat(o) + "\""); continue; }
        const x = ["(" + (y + 1) + ") \"" + flat(o.label) + "\""], d = flat(o.description), p = flat(o.preview);
        if (d) x.push("— " + d);
        if (p) x.push("[preview: " + p + "]");
        opts.push(x.join(" "));
      }
      const h = flat(m.header);
      out.push("\"" + flat(m.question) + "\"" + (h ? " [header: " + h + "]" : "") + (m.multiSelect === true ? " [multiSelect]" : "") + " options: " + opts.join(" "));
    }
    return out.length ? out.join(" | ") : "[malformed AskUserQuestion input]";
  } catch { return "[malformed AskUserQuestion input]"; }
}
