/**
 * CLAUDE CODE'S Projects TOOL, IN CODER'S CHATS (2026-11-23; agent-sdk/typescript "Projects": "Reads and writes the claude.ai
 * Project attached to the session. Dispatches on method"). Coder's projects are the owner's, kept by Coder's Worker
 * (src/coder-owner-projects.mjs) and made on the page (public/coder-projects.js); the one attached to the owner's chats is the
 * one marked "Use in chats". Asked through the environment API (deps.envApi), as the plugin tools are.
 *   project_info    the project's name, description, instructions, documents and knowledge size
 *   project_read    one document by path: inline up to READ_INLINE_MAX characters, else written to a local file
 *   project_search  the documents' best passages for a query (n hits, 5 by default)
 *   project_write   a document created or replaced from exactly one of content or local_path (a file in the working folder)
 *   project_delete  a document removed
 * Held back until tool_search loads it, as Claude Code defers it (coder-toolsearch.mjs).
 */
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { CC_TOOL } from "./coder-hooks.mjs";
import { PROJECTS_TOOL_NAME, EXTRA_CC_NAMES } from "./coder-extra-names.mjs";

Object.assign(CC_TOOL, { projects: EXTRA_CC_NAMES.projects });
export { PROJECTS_TOOL_NAME };
export const PROJECT_METHODS = Object.freeze(["project_info", "project_read", "project_search", "project_write", "project_delete"]);
/** project_read: a document longer than this goes to a local file (Claude Code: "returns small text docs inline in content and
 * writes larger docs to a local_file path instead"). */
export const READ_INLINE_MAX = 25_000;
/** project_write from local_path: the most it reads. */
export const LOCAL_MAX = 500_000;

export const PROJECTS_TOOL = Object.freeze({
  type: "function",
  function: {
    name: PROJECTS_TOOL_NAME,
    description: "Reads and writes the owner's Coder project attached to their chats (made under Projects on gofarther.dev): its instructions and documents. Dispatches on method:\n- project_info: returns project metadata (name, description, instructions) and the doc list.\n- project_read: reads one doc by path.\n- project_search: queries the project's knowledge base with query. n caps the hits and defaults to 5.\n- project_write: creates or replaces a doc at path from exactly one of content, which carries inline text, or local_path, which names a file inside the working directory. present_to_user: true marks the written doc as the deliverable the owner needs to see.\n- project_delete: deletes a doc by path.\nFollow the project's instructions (project_info) when they apply to the task.",
    parameters: {
      type: "object",
      properties: {
        method: { type: "string", enum: PROJECT_METHODS, description: "What to do" },
        path: { type: "string", description: "The project document to read, write or delete" },
        content: { type: "string", description: "project_write: the document's text (or local_path instead)" },
        local_path: { type: "string", description: "project_write: a file in the working directory to write as the document (or content instead)" },
        present_to_user: { type: "boolean", description: "project_write: marks the written document as the result the owner should see" },
        query: { type: "string", description: "project_search: what to search for in the project's knowledge" },
        n: { type: "integer", minimum: 1, description: "project_search: how many hits; 5 by default" },
      },
      required: ["method"],
    },
  },
});

/** The tool's input checked as Claude Code's is → { body } for the Worker, or { error }. `root`: the working folder. */
export function checkProjectsInput(args, root = "/") {
  const a = args && typeof args === "object" ? args : {};
  const method = String(a.method || "");
  if (!PROJECT_METHODS.includes(method)) return { error: "error: method is one of " + PROJECT_METHODS.join(", ") };
  for (const k of ["path", "content", "local_path", "query"]) if (a[k] !== undefined && typeof a[k] !== "string") return { error: "error: " + k + " must be a string" };
  if (a.present_to_user !== undefined && typeof a.present_to_user !== "boolean") return { error: "error: present_to_user must be true or false" };
  if (a.n !== undefined && (!Number.isInteger(a.n) || a.n < 1)) return { error: "error: n must be a whole number, 1 or more" };
  const body = { action: "projects", method };
  if (["project_read", "project_write", "project_delete"].includes(method)) {
    if (!a.path || !a.path.trim()) return { error: "error: " + method + " needs path" };
    body.path = a.path;
  }
  if (method === "project_search") {
    if (!a.query || !a.query.trim()) return { error: "error: project_search needs query" };
    body.query = a.query;
    if (a.n !== undefined) body.n = a.n;
  }
  if (method === "project_write") {
    const hasC = typeof a.content === "string", hasL = typeof a.local_path === "string" && a.local_path !== "";
    if (hasC === hasL) return { error: "error: project_write takes exactly one of content or local_path" };
    if (hasL) {
      const base = resolve(String(root || "/"));
      const full = isAbsolute(a.local_path) ? resolve(a.local_path) : resolve(base, a.local_path);
      const rel = relative(base, full);
      if (rel.startsWith("..") || isAbsolute(rel)) return { error: "error: local_path must be a file inside the working directory (" + base + ")" };
      let st;
      try { st = statSync(full); } catch { return { error: "error: there is no file at " + a.local_path }; }
      if (!st.isFile()) return { error: "error: " + a.local_path + " is not a file" };
      if (st.size > LOCAL_MAX * 4) return { error: "error: " + a.local_path + " is too big for a project document" };
      body.content = readFileSync(full, "utf8");
      body.local_path = a.local_path;
      body.full = full;
    } else body.content = a.content;
    if (a.present_to_user === true) body.present_to_user = true;
  }
  return { body };
}

/** A safe file name for a document read to a local file. */
const fileFor = (path) => String(path).replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "document";

/**
 * ONE CALL. ctx: { args, id, deps, emit, reply, scrub, root, dir (where a large read is written: a temporary folder by default) }.
 * Replies with the result object as JSON (Claude Code's ProjectsOutput), or an error.
 */
export async function projectsTool(ctx) {
  const { args = {}, id, deps, emit, reply } = ctx;
  const scrub = ctx.scrub || ((s) => s);
  const done = (text, ok = true) => { emit({ type: "result", id, code: ok ? 0 : 1, output: String(text).slice(0, 2000) }); reply(text); };
  const c = checkProjectsInput(args, ctx.root || (deps && deps.root) || "/");
  const verb = { project_info: "Read", project_read: "Read", project_search: "Search", project_write: "Write", project_delete: "Delete" }[String(args.method)] || "Use";
  emit({ type: "bash", id, tool: "projects", verb, command: scrub(String(args.method || "") + (args.path ? " " + args.path : args.query ? " " + JSON.stringify(args.query) : "")).slice(0, 120) });
  if (c.error) return done(c.error, false);
  if (!deps || typeof deps.envApi !== "function") return done("error: Coder's server could not be reached", false);
  const { full: _full, ...body } = c.body;
  let r;
  try { r = (await deps.envApi(body)) || { error: "error: Coder's server did not answer" }; } catch { r = { error: "error: Coder's server could not be reached" }; }
  if (r.error || r.method !== c.body.method) return done(String(r.error || "error: Coder's server did not answer"), false);
  const { ok: _ok, ...out } = r;
  if (out.method === "project_read" && typeof out.content === "string" && out.content.length > READ_INLINE_MAX) {
    const dir = ctx.dir || join(tmpdir(), "coder-projects");
    try {
      mkdirSync(dir, { recursive: true });
      const f = join(dir, Date.now().toString(36) + "-" + fileFor(out.path));
      writeFileSync(f, out.content);
      delete out.content;
      out.local_file = f;
      out.notice = "The document is long, so it was written to local_file: read it from there.";
    } catch { out.content = out.content.slice(0, READ_INLINE_MAX); out.notice = "Only the first " + READ_INLINE_MAX + " characters are shown: the rest could not be written to a file."; }
  }
  if (out.method === "project_write" && out.present_to_user) emit({ type: "note", text: "Coder wrote " + out.path + " to your project. Open it under Projects." });
  // (Its PostToolUse hooks get the result object itself, as Claude Code's tool_response: ctx.facts. 2026-11-24.)
  if (typeof ctx.facts === "function") ctx.facts(out);
  return done(JSON.stringify(out));
}
