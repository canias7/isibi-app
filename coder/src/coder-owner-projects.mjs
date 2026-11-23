/**
 * THE OWNER'S PROJECTS, THE WORKER'S SIDE (2026-11-23; Claude Code's Projects tool, agent-sdk/typescript "Projects": "Reads
 * and writes the claude.ai Project attached to the session"; container/coder-projects.mjs has the tool).
 *
 * A PROJECT holds documents (files of text) and instructions, kept per owner:
 *   - coder/<uid>/owner-projects.json: { active, projects: [{ id, name, description, instructions, created_at, docs: [{ path,
 *     doc_uuid, file_kind, content, created_at }] }] }
 * The project ATTACHED to the owner's chats is `active` (chosen on the page, "Use in chats"): Coder's projects tool reads and
 * writes that one, as Claude Code's reads and writes the project attached to its session.
 *
 * THE MACHINE'S QUESTIONS come through Coder's environment API (coder-envapi.mjs: projectsApi, body.action "projects", with
 * body.method one of Claude Code's five); THE PAGE'S through /api/coder/owner-projects (handleOwnerProjectRoutes).
 * (/api/coder/projects is the chats' list, an older name, so the owner's projects live under owner-projects.)
 */
export const PROJECT_METHODS = Object.freeze(["project_info", "project_read", "project_search", "project_write", "project_delete"]);
export const OWNER_PROJECTS_MAX = 20;
export const PROJECT_DOCS_MAX = 200;
/** Claude Code's knowledge.max_knowledge_size: the most text one project holds, in characters. */
export const MAX_KNOWLEDGE = 2_000_000;
export const DOC_MAX = 500_000;
export const INSTRUCTIONS_MAX = 20_000;
export const SEARCH_N = 5, SEARCH_N_MAX = 50;

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function getJson(bucket, key, fallback) {
  try { const o = await bucket.get(key); if (!o) return fallback; return JSON.parse(await o.text()); } catch { return fallback; }
}
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const keyOf = (uid) => "coder/" + uid + "/owner-projects.json";
const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const uuid = () => { const h = hex(16); return h.slice(0, 8) + "-" + h.slice(8, 12) + "-4" + h.slice(13, 16) + "-a" + h.slice(17, 20) + "-" + h.slice(20, 32); };

/**
 * A document's path, as Claude Code's tool names one: relative, "/" between folders, no "." or ".." part, 1 to 300
 * characters. → the clean path, or "" when it is not one.
 */
export function docPath(raw) {
  const p = String(raw == null ? "" : raw).trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!p || p.length > 300 || /[\u0000-\u001f]/.test(p)) return "";
  if (p.split("/").some((x) => !x || x === "." || x === "..")) return "";
  return p;
}
/** A document's kind from its name ("text" when it has no known extension). */
export const kindOf = (path) => { const m = /\.([a-z0-9]{1,8})$/i.exec(String(path)); return m ? m[1].toLowerCase() : "text"; };
const sizeOf = (p) => (p.docs || []).reduce((n, d) => n + String(d.content || "").length, 0);

export async function readOwnerProjects(bucket, uid) {
  const v = await getJson(bucket, keyOf(uid), null);
  const projects = v && Array.isArray(v.projects) ? v.projects.filter((p) => p && typeof p.id === "string") : [];
  return { active: v && typeof v.active === "string" && projects.some((p) => p.id === v.active) ? v.active : "", projects };
}
const save = (bucket, uid, v) => putJson(bucket, keyOf(uid), { active: v.active || "", projects: v.projects });

/** A project as the page lists it: no document's text. */
export const projectOut = (p, active) => ({ id: p.id, name: p.name, description: p.description, instructions: p.instructions, created_at: p.created_at, active: p.id === active, docs: (p.docs || []).map((d) => ({ path: d.path, doc_uuid: d.doc_uuid, file_kind: d.file_kind, size: String(d.content || "").length, created_at: d.created_at || null })), knowledge: { knowledge_size: sizeOf(p), max_knowledge_size: MAX_KNOWLEDGE } });

/** A new project → { ok, project } or { error }. */
export async function createProject(bucket, uid, body, now = Date.now()) {
  const v = await readOwnerProjects(bucket, uid);
  const name = clip(body && body.name, 120).trim();
  if (!name) return { error: "give the project a name" };
  if (v.projects.length >= OWNER_PROJECTS_MAX) return { error: "you have " + OWNER_PROJECTS_MAX + " projects, the most there can be: delete one first" };
  const p = { id: "pj_" + hex(8), name, description: clip(body && body.description, 1000).trim(), instructions: clip(body && body.instructions, INSTRUCTIONS_MAX), created_at: new Date(now).toISOString(), docs: [] };
  v.projects.push(p);
  if (!v.active) v.active = p.id;
  await save(bucket, uid, v);
  return { ok: true, project: projectOut(p, v.active) };
}

/** Change a project's name, description or instructions, or make it the one attached to chats (`active`). */
export async function updateProject(bucket, uid, id, body) {
  const v = await readOwnerProjects(bucket, uid);
  const p = v.projects.find((x) => x.id === id);
  if (!p) return { error: "no such project" };
  if (typeof body.name === "string") { const n = clip(body.name, 120).trim(); if (!n) return { error: "give the project a name" }; p.name = n; }
  if (typeof body.description === "string") p.description = clip(body.description, 1000).trim();
  if (typeof body.instructions === "string") p.instructions = clip(body.instructions, INSTRUCTIONS_MAX);
  if (body.active === true) v.active = p.id;
  if (body.active === false && v.active === p.id) v.active = "";
  await save(bucket, uid, v);
  return { ok: true, project: projectOut(p, v.active) };
}

export async function deleteProject(bucket, uid, id) {
  const v = await readOwnerProjects(bucket, uid);
  const n = v.projects.length;
  v.projects = v.projects.filter((x) => x.id !== id);
  if (v.projects.length === n) return { error: "no such project" };
  if (v.active === id) v.active = "";
  await save(bucket, uid, v);
  return { ok: true };
}

/**
 * A DOCUMENT WRITTEN (Claude Code's project_write, and the page's Add file): created, or replaced at the same path.
 * → { ok, path, doc_uuid, replaced } or { error }.
 */
export function writeDoc(p, rawPath, content, now = Date.now()) {
  const path = docPath(rawPath);
  if (!path) return { error: "error: path must be a relative document path (no . or .. parts), 1 to 300 characters" };
  if (typeof content !== "string") return { error: "error: give the document's text" };
  if (content.length > DOC_MAX) return { error: "error: a document is at most " + DOC_MAX + " characters (this one has " + content.length + ")" };
  p.docs = Array.isArray(p.docs) ? p.docs : [];
  const old = p.docs.find((d) => d.path === path);
  const after = sizeOf(p) - (old ? String(old.content || "").length : 0) + content.length;
  if (after > MAX_KNOWLEDGE) return { error: "error: the project's knowledge would be " + after + " characters, over its limit of " + MAX_KNOWLEDGE };
  if (!old && p.docs.length >= PROJECT_DOCS_MAX) return { error: "error: the project has " + PROJECT_DOCS_MAX + " documents, the most it can hold" };
  if (old) { old.content = content; old.file_kind = kindOf(path); return { ok: true, path, doc_uuid: old.doc_uuid, replaced: true }; }
  const d = { path, doc_uuid: uuid(), file_kind: kindOf(path), content, created_at: new Date(now).toISOString() };
  p.docs.push(d);
  return { ok: true, path, doc_uuid: d.doc_uuid, replaced: false };
}

/** Word search of a project's documents: each hit { name, doc_uuid, text } (the best passage), best first, at most n. */
export function searchDocs(p, query, n = SEARCH_N) {
  const words = String(query || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  if (!words.length) return [];
  const hits = [];
  for (const d of p.docs || []) {
    const text = String(d.content || ""), low = text.toLowerCase(), name = d.path.toLowerCase();
    let score = 0, first = -1;
    for (const w of words) {
      if (name.includes(w)) score += 3;
      let at = low.indexOf(w), k = 0;
      while (at >= 0 && k < 50) { if (first < 0 || at < first) first = at; score++; k++; at = low.indexOf(w, at + w.length); }
    }
    if (score > 0) {
      const from = Math.max(0, (first < 0 ? 0 : first) - 200);
      hits.push([score, { name: d.path, doc_uuid: d.doc_uuid, text: (from > 0 ? "…" : "") + text.slice(from, from + 800) + (from + 800 < text.length ? "…" : "") }]);
    }
  }
  return hits.sort((a, b) => b[0] - a[0]).slice(0, n).map(([, h]) => h);
}

/**
 * CLAUDE CODE'S PROJECTS METHODS on the owner's attached project → its result object (ProjectsOutput, `method` first), or
 * { error } when no project is attached or the input is wrong. body: { method, path, content, query, n, present_to_user,
 * local_path } (content already read from local_path by the machine).
 */
export async function projectsCall(bucket, uid, body, now = Date.now()) {
  const method = String((body && body.method) || "");
  if (!PROJECT_METHODS.includes(method)) return { error: "error: method is one of " + PROJECT_METHODS.join(", ") };
  const v = await readOwnerProjects(bucket, uid);
  const p = v.projects.find((x) => x.id === v.active);
  if (!p) return { error: "error: no project is attached to the owner's chats. The owner makes one under Projects on gofarther.dev (sidebar: Plugins, then Projects) and turns on Use in chats." };
  if (method === "project_info") {
    return { method, name: p.name, description: p.description || "", instructions: p.instructions || "", docs: (p.docs || []).map((d) => ({ path: d.path, created_at: d.created_at || null })), files: (p.docs || []).map((d) => ({ path: d.path, file_kind: d.file_kind || kindOf(d.path), created_at: d.created_at || null })), sync_sources: [], knowledge: { knowledge_size: sizeOf(p), max_knowledge_size: MAX_KNOWLEDGE } };
  }
  const path = docPath(body.path);
  if (method === "project_search") {
    const q = clip(body.query, 1000).trim();
    if (!q) return { error: "error: give query: what to search for in the project's knowledge" };
    const n = Number.isInteger(body.n) ? Math.max(1, Math.min(SEARCH_N_MAX, body.n)) : SEARCH_N;
    // (Coder's index is a word index of the project's documents; with no document there is none: the docs list instead.)
    if (!(p.docs || []).length) return { method, rag: false, docs: [], notice: "The project has no documents yet." };
    return { method, rag: true, hits: searchDocs(p, q, n) };
  }
  if (!path) return { error: body.path ? "error: path must be a relative document path (no . or .. parts), 1 to 300 characters" : "error: give path: the project document's path" };
  if (method === "project_read") {
    const d = (p.docs || []).find((x) => x.path === path);
    if (!d) return { error: "error: no document at " + path + " in the project (project_info lists them)" };
    return { method, path, file_kind: d.file_kind || kindOf(path), content: String(d.content || ""), created_at: d.created_at || null };
  }
  if (method === "project_delete") {
    const n0 = (p.docs || []).length;
    p.docs = (p.docs || []).filter((x) => x.path !== path);
    const deleted = p.docs.length !== n0;
    if (deleted) await save(bucket, uid, v);
    return { method, path, deleted, ...(deleted ? {} : { notice: "There was no document at " + path + "." }) };
  }
  const w = writeDoc(p, path, body.content, now);
  if (w.error) return { error: w.error };
  await save(bucket, uid, v);
  return { method, path: w.path, doc_uuid: w.doc_uuid, replaced: w.replaced, ...(body.present_to_user === true ? { present_to_user: true } : {}), ...(typeof body.local_path === "string" && body.local_path ? { local_path: clip(body.local_path, 500) } : {}) };
}

/** THE MACHINE'S QUESTION (coder-envapi.mjs): body.action "projects" → the answer; null for any other action. */
export async function projectsApi(bucket, uid, body) {
  if (!body || body.action !== "projects") return null;
  return projectsCall(bucket, uid, body);
}

/**
 * THE PAGE'S ROUTES (signed in), under /api/coder/owner-projects:
 *   GET                     → { projects, active }
 *   POST { name, description, instructions } → a new project
 *   PATCH /<id> { name?, description?, instructions?, active? }
 *   DELETE /<id>
 *   GET /<id>/doc?path=     → { path, content }
 *   POST /<id>/doc { path, content }  adds or replaces a document
 *   DELETE /<id>/doc?path=
 * null when the path is not one of these.
 */
export async function handleOwnerProjectRoutes(request, bucket, uid, parts) {
  if (parts[0] !== "owner-projects") return null;
  if (!bucket) return json({ error: "storage is not available" }, 503);
  const m = request.method;
  const body = async () => { try { const b = await request.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; } };
  const st = (r) => json(r, r.error ? (/no such/.test(r.error) ? 404 : 400) : 200);
  if (parts.length === 1) {
    if (m === "GET") { const v = await readOwnerProjects(bucket, uid); return json({ ok: true, active: v.active, projects: v.projects.map((p) => projectOut(p, v.active)) }); }
    if (m === "POST") return st(await createProject(bucket, uid, await body()));
    return json({ error: "method" }, 405);
  }
  const id = decodeURIComponent(parts[1] || "");
  if (parts.length === 2) {
    if (m === "PATCH") return st(await updateProject(bucket, uid, id, await body()));
    if (m === "DELETE") return st(await deleteProject(bucket, uid, id));
    return json({ error: "method" }, 405);
  }
  if (parts.length === 3 && parts[2] === "doc") {
    const v = await readOwnerProjects(bucket, uid);
    const p = v.projects.find((x) => x.id === id);
    if (!p) return json({ error: "no such project" }, 404);
    const path = docPath(new URL(request.url).searchParams.get("path"));
    if (m === "GET") { const d = (p.docs || []).find((x) => x.path === path); return d ? json({ ok: true, path, content: d.content }) : json({ error: "no such document" }, 404); }
    if (m === "DELETE") { const n0 = p.docs.length; p.docs = p.docs.filter((x) => x.path !== path); if (p.docs.length === n0) return json({ error: "no such document" }, 404); await save(bucket, uid, v); return json({ ok: true }); }
    if (m === "POST") { const b = await body(); const w = writeDoc(p, b.path, b.content); if (w.error) return json({ error: w.error.replace(/^error: /, "") }, 400); await save(bucket, uid, v); return json({ ok: true, ...w, project: projectOut(p, v.active) }); }
    return json({ error: "method" }, 405);
  }
  return json({ error: "not found" }, 404);
}
