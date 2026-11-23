/**
 * The names of Claude Code's Projects tool and Claude in Chrome's browser tools in Coder (coder-projects.mjs and
 * coder-chrome.mjs have the tools). No Node module here: coder-toolsearch.mjs, which Coder's Worker loads too, takes the
 * held-back ones and their hints from this file.
 */
export const PROJECTS_TOOL_NAME = "projects";
/** Claude in Chrome's tools as Coder offers them (Claude Code's names, as its /mcp "View tools" lists them). */
export const CHROME_TOOL_NAMES = Object.freeze(["tabs_context_mcp", "tabs_create_mcp", "navigate", "read_page", "computer", "form_input", "javascript_tool", "file_upload", "browser_batch"]);
/** All held back until tool_search loads them (coder-toolsearch.mjs DEFERRED_TOOLS takes these). */
export const EXTRA_DEFERRED = Object.freeze([PROJECTS_TOOL_NAME, ...CHROME_TOOL_NAMES]);
/** Claude Code's names, for rules and hooks (Projects; Claude in Chrome's are its MCP server's tools). */
export const EXTRA_CC_NAMES = Object.freeze({ projects: "Projects", ...Object.fromEntries(CHROME_TOOL_NAMES.map((n) => [n, "mcp__claude-in-chrome__" + n])) });
/** Their search hints (tool_search), Coder's words. */
export const EXTRA_HINTS = Object.freeze({
  projects: "read, search, write and delete the documents and instructions of the owner's project attached to their chats",
  tabs_context_mcp: "browser: list the tabs of Coder's own browser (Chrome)",
  tabs_create_mcp: "browser: open a new tab in Coder's own browser",
  navigate: "browser: go to a web address, or back or forward, in a tab",
  read_page: "browser: read a page as an outline of numbered elements",
  computer: "browser: click, type, press keys, scroll, hover or take a screenshot in a tab",
  form_input: "browser: set a form field's value by its ref",
  javascript_tool: "browser: run JavaScript in the page and get its result",
  file_upload: "browser: upload files from the working directory to a page's file field",
  browser_batch: "browser: run several browser steps in one call",
});
