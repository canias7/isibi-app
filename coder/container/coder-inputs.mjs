/**
 * THE INPUT CHECKS CLAUDE CODE RUNS BEFORE A CALL'S HOOKS (the owner, 2026-11-14: "start fixing and filling in gaps on
 * those tools", Grep, Glob, LSP, WebFetch and WebSearch; Claude Code's hooks reference: "Validation rejections are returned
 * as tool_use_error results and happen before hooks run, so they fire neither PreToolUse nor PostToolUseFailure").
 *
 * Each tool's own module checks its input: `checkInput(args, ctx)` gives back
 *   { args }          the input, as Claude Code takes it (fixed where Claude Code fixes it);
 *   { args, note }    a fix Coder is told about after the call's answer, as Claude Code's "Note: …";
 *   { error }         refused before any hook, card or run: the text Coder is told;
 *   { error, quiet }  the same, with no step for it in the chat (ask_user: Claude Code shows no line for its call).
 * `ctx`: { github } (a job started from GitHub), { who } (Coder, or Gloopy with its own ask_user).
 * (And ask_user, Claude Code's AskUserQuestion: the owner, 2026-11-14, "Do all the talk to you tools execpt for the notify
 * one"; coder-askuser.mjs.)
 */
import { checkGrepInput, checkGlobInput } from "./coder-search.mjs";
import { checkInput as checkLspInput } from "./coder-lsp.mjs";
import { checkInput as checkWebFetchInput } from "./coder-webfetch.mjs";
import { checkInput as checkWebSearchInput } from "./coder-websearch.mjs";
import { checkAskUserInput } from "./coder-askuser.mjs";
// (And tool_search, Claude Code's ToolSearch: its query and max_results, refused quietly. 2026-11-14; coder-toolsearch.mjs.)
import { checkToolSearchInput } from "./coder-toolsearch.mjs";
// (Not Claude Code's environment tools: they are its MCP server's, whose input Claude Code takes as any object and its server
// checks when called, after the PreToolUse hooks, as request_secret's. Coder's loop checks theirs then: coder-envtools.mjs.)

/**
 * LSP'S CHECKS (coder-lsp.mjs; "Fix base on Claude Code docs, please", 2026-11-14): its input, then its file ("File does not
 * exist: …", "Path is not a file: …", "Cannot access file: …"), both before any hook, as Claude Code's validateInput makes
 * them. The file's check needs the chat's files, so Coder's loop gives `ctx.lspFile` (its tool script, run as the AI's user
 * where those files are): the refusal ("error: File does not exist: …"), or "" when it is a file. A Promise then.
 */
export function checkLsp(args, ctx = {}) {
  const v = checkLspInput(args);
  if (v.error || !ctx || typeof ctx.lspFile !== "function") return v;
  return Promise.resolve().then(() => ctx.lspFile(v.args)).then((e) => (typeof e === "string" && e ? { error: e } : v), () => v);
}

export const INPUT_CHECKS = { grep: checkGrepInput, glob: checkGlobInput, lsp: checkLsp, web_fetch: checkWebFetchInput, web_search: checkWebSearchInput, ask_user: checkAskUserInput, tool_search: checkToolSearchInput };

/** A tool's input check, when it has one (these seven tools). */
export const inputCheckFor = (name) => (Object.prototype.hasOwnProperty.call(INPUT_CHECKS, name) && typeof INPUT_CHECKS[name] === "function" ? INPUT_CHECKS[name] : null);
