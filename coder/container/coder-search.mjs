/**
 * CLAUDE CODE'S GREP AND GLOB (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"). Both run on
 * ripgrep in Claude Code, with one search runner, so they live here together. (A start: the work fills it in.)
 */

/** Grep's input, as Claude Code takes it (coder-inputs.mjs). */
export function checkGrepInput(args) { return { args }; }

/** Glob's input, as Claude Code takes it (coder-inputs.mjs). */
export function checkGlobInput(args) { return { args }; }
