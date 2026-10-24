// THE FILE PICKER (2026-10-23, the owner's idea #21, after bolt.diy).
//
// On a BIG site, one cheap quick-model call picks which of the site's files the
// expensive writer is shown. The model picks; this code only enforces three
// things: the files the router's scope names (and what they import) are always
// in, the count is bounded, and anything the picker cannot answer usably means
// the writer sees exactly what it sees today (fail open).
//
// WHAT "NOT PICKED" MEANS: the file is WITHHELD, never dropped. The callers pass
// the picked names as `only` to `priorPagesSent` and `partsSent`, which name a
// withheld file and protect it exactly as a file over the window is named and
// protected. A file the writer does not see is therefore one it may not return.
//
// THE THRESHOLD, from measured sizes: the 100 stored corpus sites
// (`test/fixtures/corpus`) are 1–6 pages and 3,384–50,780 characters of page
// source (median 4 pages / 26,192). Above every one of them: more than
// `PICK_MIN_PAGES` pages, or more than `PICK_MIN_CHARS` characters of pages and
// components together. Below both, nothing changes and no call is made.

export const PICK_MIN_PAGES = 8;
export const PICK_MIN_CHARS = 60000;
/** The most files the picker may name (the required ones come on top). */
export const PICK_MAX = 12;
export const PICK_MAX_TOKENS = 800;

const okFile = (f) => f && typeof f === "object" && typeof f.source === "string" && f.source.length > 0;
const pageFiles = (pages) => (Array.isArray(pages) ? pages : []).filter((p) => okFile(p) && typeof p.path === "string" && p.path);
const partFiles = (parts) => (Array.isArray(parts) ? parts : []).filter((p) => okFile(p) && typeof p.name === "string" && p.name.trim());
/** One key per file: a page by its path, a component as `-parts/<name>`. */
export const partKey = (name) => "-parts/" + String(name).trim();

/** The site's size, as the threshold reads it. */
export function siteSize(pages, parts) {
  const pg = pageFiles(pages), pt = partFiles(parts);
  const chars = pg.reduce((n, p) => n + p.source.length, 0) + pt.reduce((n, p) => n + p.source.length, 0);
  return { pages: pg.length, parts: pt.length, files: pg.length + pt.length, chars };
}

export function overThreshold(pages, parts) {
  const s = siteSize(pages, parts);
  return s.pages > PICK_MIN_PAGES || s.chars > PICK_MIN_CHARS;
}

/** The component names a source imports from `-parts/`. */
export function importedParts(source, { inParts = false } = {}) {
  const src = String(source || "");
  const out = [...src.matchAll(/["'](?:@\/routes\/|\.\/|\.\.\/)?-parts\/([^"'/]+?)(?:\.tsx?)?["']/g)].map((m) => m[1].trim());
  // A component importing a sibling writes "./name" from inside `-parts/`.
  if (inParts) out.push(...[...src.matchAll(/from\s+["']\.\/([^"'/]+?)(?:\.tsx?)?["']/g)].map((m) => m[1].trim()));
  return out;
}

/**
 * What the writer must always see: the router-named pages, every component
 * they import (followed through components importing components), and the
 * site's own shell (`site-header`, `site-footer`, the parts every page wears).
 */
export function requiredFiles(pages, parts, targets = []) {
  const pg = pageFiles(pages), pt = partFiles(parts);
  const byName = new Map(pt.map((p) => [p.name.trim(), p]));
  const want = new Set((Array.isArray(targets) ? targets : []).filter((t) => typeof t === "string" && t));
  const out = new Set();
  const queue = [];
  for (const p of pg) if (want.has(p.path)) { out.add(p.path); queue.push([p.source, false]); }
  for (const n of ["site-header", "site-footer"]) if (byName.has(n)) { out.add(partKey(n)); queue.push([byName.get(n).source, true]); }
  while (queue.length) {
    const [src, inParts] = queue.shift();
    for (const n of importedParts(src, { inParts })) {
      const k = partKey(n);
      if (byName.has(n) && !out.has(k)) { out.add(k); queue.push([byName.get(n).source, true]); }
    }
  }
  return out;
}

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** One line per file: key, size, exported names, headings. No code. */
export function fileIndex(pages, parts) {
  const row = (key, src) => {
    const exp = [...src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
    const heads = [...src.matchAll(/<h[1-3][^>]*>\s*([^<{]{2,80}?)\s*</g)].map((m) => m[1].trim()).filter(Boolean);
    return key + " (" + src.length + " chars)" +
      (exp.length ? " exports: " + cut([...new Set(exp)].slice(0, 6).join(", "), 120) : "") +
      (heads.length ? " headings: " + cut([...new Set(heads)].slice(0, 6).join(" | "), 200) : "");
  };
  return [...pageFiles(pages).map((p) => row(p.path, p.source)), ...partFiles(parts).map((p) => row(partKey(p.name), p.source))].join("\n");
}

export const PICK_FILES_TOOL = {
  name: "pick_files",
  description: "Name the files of this site the change needs to read or edit.",
  input_schema: {
    type: "object",
    properties: {
      files: { type: "array", maxItems: PICK_MAX, items: { type: "string" }, description: "File keys exactly as listed in the index." },
    },
    required: ["files"],
  },
};

export function filePickRequest({ request, pages, parts, required = [], model }) {
  const req = [...required];
  return {
    model,
    max_tokens: PICK_MAX_TOKENS,
    tools: [PICK_FILES_TOOL],
    tool_choice: { type: "tool", name: "pick_files" },
    system: "You choose which files of a website another writer is shown before it makes a customer's change. " +
      "Name every file the change could need to read or edit, and nothing else — at most " + PICK_MAX + ". " +
      "Use the keys exactly as the index lists them.",
    messages: [{
      role: "user",
      content: "THE CUSTOMER'S REQUEST\n" + String(request || "") +
        "\n\nALREADY INCLUDED (do not repeat): " + (req.length ? req.join(", ") : "none") +
        "\n\nTHE SITE'S FILES\n" + fileIndex(pages, parts),
    }],
  };
}

const usageOf = (j, model) => {
  const u = (j && j.usage) || {};
  return { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, model };
};

/**
 * Pick the files. Answers `null` below the threshold (no call), and otherwise
 * `{ only: { pages, parts } | null, usage, mark }` — `only` is null when the
 * picker failed or named nothing usable, and the caller then sends everything.
 * `usage` is set whenever a call answered, so the caller bills it either way.
 */
export async function pickFiles({ send }, { request, pages, parts, targets = [], model } = {}) {
  if (!overThreshold(pages, parts)) return null;
  const pg = pageFiles(pages), pt = partFiles(parts);
  const total = pg.length + pt.length;
  const required = requiredFiles(pg, pt, targets);
  const known = new Set([...pg.map((p) => p.path), ...pt.map((p) => partKey(p.name))]);
  const req = filePickRequest({ request, pages: pg, parts: pt, required: [...required], model });
  let j;
  try { j = await send(req); } catch (e) {
    return { only: null, usage: null, mark: { status: "fail", why: "send", total } };
  }
  const usage = usageOf(j, req.model);
  const use = (j && Array.isArray(j.content) ? j.content : []).find((b) => b && b.type === "tool_use" && b.name === "pick_files");
  const named = use && use.input && Array.isArray(use.input.files) ? use.input.files : null;
  const picked = (named || []).filter((f) => typeof f === "string" && known.has(f) && !required.has(f));
  const bounded = [...new Set(picked)].slice(0, PICK_MAX);
  if (!bounded.length) return { only: null, usage, mark: { status: "fail", why: named ? "none-usable" : "no-answer", total } };
  const chosen = new Set([...required, ...bounded]);
  return {
    only: {
      pages: pg.map((p) => p.path).filter((k) => chosen.has(k)),
      parts: pt.map((p) => p.name.trim()).filter((n) => chosen.has(partKey(n))),
    },
    usage,
    mark: { status: "ok", chosen: chosen.size, total, required: required.size },
  };
}
