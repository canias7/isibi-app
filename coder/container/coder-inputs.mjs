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
// (Not Claude Code's environment tools: they are its MCP server's, whose input Claude Code takes as any object and its server
// checks when called, after the PreToolUse hooks, as request_secret's. Coder's loop checks theirs then: coder-envtools.mjs.)

export const INPUT_CHECKS = { grep: checkGrepInput, glob: checkGlobInput, lsp: checkLspInput, web_fetch: checkWebFetchInput, web_search: checkWebSearchInput, ask_user: checkAskUserInput };

/** A tool's input check, when it has one (these six tools). */
export const inputCheckFor = (name) => (Object.prototype.hasOwnProperty.call(INPUT_CHECKS, name) && typeof INPUT_CHECKS[name] === "function" ? INPUT_CHECKS[name] : null);
