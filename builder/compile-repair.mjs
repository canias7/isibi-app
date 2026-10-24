/**
 * ONE BOUNDED REPAIR ROUND FOR A PAGE THAT DID NOT COMPILE (2026-10-23).
 *
 * Live on `saltmarsh-and-sparrow`: an add-on's page imported
 * `/components/ui/section-header` (no `@`), vite refused the bundle, and the
 * add step's own repair round never ran, because it lives at the spine's seam
 * AFTER a successful compile. The route gave up on an error the writer could
 * have fixed in one pass.
 *
 * This is the missing half: the compiler's own words go to the writer with the
 * page(s) this change wrote, once, and the corrected list is compiled once
 * more. Bounded on every axis: one round, at most `MAX_FILES` pages, only pages
 * this change wrote (`touched`), the error cut to `MAX_ERROR` characters, and
 * the job's clock asked first (`room`). A round that cannot run, or a second
 * compile that fails too, answers `built: null` and the caller reports the
 * failure as before.
 */
import { runTweak } from "./site-tweak.mjs";

export const MAX_FILES = 3;
export const MAX_ERROR = 4000;

export const COMPILE_REPAIR_RULES =
  "The page below did not compile. The compiler's message is in the instruction. " +
  "Fix only what makes it fail to compile (a wrong import path, a missing or misspelt name, a type error), " +
  "and change nothing else: keep every word, section, link and style as it is. " +
  "Kit components import from \"@/components/ui/<module>\" and the site's own components from \"@/routes/-parts/<name>\". " +
  "Return the whole corrected file.";

/**
 * EVERY FILE THE BUILD OWNS, NOT ONLY ITS PAGES (2026-10-24, owner: "the
 * repair has to be everywhere … like literally everywhere").
 *
 * Live on `driftwood-and-daughters-2`: vite refused
 * `src/routes/-parts/band-1-bleed.tsx`, a band, and repair never ran because
 * the list it searched held only pages. A site's own components (bands, the
 * frame, parts a page edit wrote) compile in the same program and are the
 * build's to fix, so they ride the repair as files at `-parts/<name>.tsx`
 * marked with `part`, and `splitParts` hands them back to where they live.
 * Kit files (`src/components/ui/*`) are never in the list: the importer is
 * what gets fixed.
 */
export const PART_DIR = "-parts/";

/** A site's parts as repairable files, `{ path: "-parts/<name>.tsx", source, part }`. */
export function partFiles(parts) {
  return (Array.isArray(parts) ? parts : [])
    .filter((p) => p && typeof p.name === "string" && p.name)
    .map((p) => ({ path: PART_DIR + p.name + ".tsx", source: String(p.source == null ? "" : p.source), part: p.name }));
}

/** Pages then the parts as files: the whole list a compile error may cite. */
export function withParts(pages, parts) {
  return (Array.isArray(pages) ? pages : []).filter((p) => p && typeof p.part !== "string").concat(partFiles(parts));
}

/**
 * The list split back: pages without the part files, and `parts` with each
 * repaired part's new source (a part whose source did not move is returned as
 * the same object). A part absent from `parts` is never invented.
 */
export function splitParts(list, parts) {
  const by = new Map();
  for (const f of Array.isArray(list) ? list : []) if (f && typeof f.part === "string") by.set(f.part, String(f.source == null ? "" : f.source));
  const nextParts = (Array.isArray(parts) ? parts : []).map((p) => (p && by.has(p.name) && by.get(p.name) !== p.source ? { ...p, source: by.get(p.name) } : p));
  return { pages: (Array.isArray(list) ? list : []).filter((f) => f && typeof f.part !== "string"), parts: nextParts };
}

/** A kit file: read-only, never handed to the writer (the importer is fixed instead). */
export function isKitFile(file) {
  return /(?:^|\/)components\/ui\//.test(String(file == null ? "" : file));
}

/**
 * The files a compile error names, among EVERY file the build owns (pages and
 * parts, whether or not this change wrote them); else the files this change
 * wrote (`touched`). A cited band is never crowded out by a page that merely
 * changed.
 */
export function pagesForError(error, pages, touched) {
  const text = String(error == null ? "" : error);
  const mine = new Set((Array.isArray(touched) ? touched : []).map(String));
  const all = (Array.isArray(pages) ? pages : []).filter((p) => p && typeof p.path === "string" && !isKitFile(p.path));
  const named = all.filter((p) => {
    const base = p.path.split("/").pop();
    return text.includes(p.path) || (base && text.includes(base));
  });
  return (named.length ? named : all.filter((p) => mine.has(p.path))).slice(0, MAX_FILES);
}

export async function compileRepairRound({ error, pages, touched, send, model, compile, room = true } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const empty = { repaired: [], refused: [], usage: [] };
  const said = String(error == null ? "" : error).trim().slice(0, MAX_ERROR);
  if (!said) return { ran: false, why: "no-error", ...empty, built: null, pages: null };
  const work = pagesForError(said, list, touched);
  if (!work.length) return { ran: false, why: "nothing-written", ...empty, built: null, pages: null };
  if (!room) return { ran: false, why: "time", ...empty, built: null, pages: null };
  if (typeof send !== "function" || typeof compile !== "function") return { ran: false, why: "no-deps", ...empty, built: null, pages: null };

  const results = await Promise.all(work.map(async (p) => {
    try {
      const res = await runTweak({
        instruction: (p.part ? "This component did not compile. The compiler said:\n" : "This page did not compile. The compiler said:\n") + said,
        path: p.part ? "src/routes/" + p.path : p.path, source: String(p.source || ""), send,
        ...(p.part ? { inPart: true } : {}),
        rules: COMPILE_REPAIR_RULES, heading: "WHY THE PAGE DID NOT COMPILE",
        ...(model ? { model } : {}),
      });
      return { p, res };
    } catch (e) {
      return { p, res: { ok: false, reason: "send", usage: null, error: e } };
    }
  }));
  const fixed = new Map();
  const repaired = [], refused = [], usage = [];
  for (const { p, res } of results) {
    if (res && res.usage) usage.push(res.usage);
    if (res && res.ok && typeof res.source === "string") { fixed.set(p.path, res.source); repaired.push(p.path); }
    else refused.push({ path: p.path, reason: (res && res.reason) || "unknown" });
  }
  const base = { ran: true, repaired, refused, usage };
  if (!fixed.size) return { ...base, built: null, pages: null, failed: "refused" };
  const corrected = list.map((p) => (p && fixed.has(p.path) ? { ...p, source: fixed.get(p.path) } : p));
  let second = null;
  try { second = await compile(corrected); } catch (e) { second = { ok: false, error: String((e && e.message) || e) }; }
  if (second && second.ok === true && second.files) return { ...base, built: second, pages: corrected };
  return { ...base, built: null, pages: null, failed: "compile", error: String((second && second.error) || ""), corrected };
}

/** How many rounds a code failure gets before the caller's old behaviour (owner, 2026-10-23). */
export const MAX_ROUNDS = 2;

/** The paths in `after` that are new or whose source differs from `before` — what a change wrote. */
export function writtenPaths(before, after) {
  const was = new Map((Array.isArray(before) ? before : []).filter((p) => p && typeof p.path === "string").map((p) => [p.path, String(p.source == null ? "" : p.source)]));
  return (Array.isArray(after) ? after : []).filter((p) => p && typeof p.path === "string" && was.get(p.path) !== String(p.source == null ? "" : p.source)).map((p) => p.path);
}

/**
 * UP TO `rounds` REPAIR ROUNDS (owner, 2026-10-23: "allow up to 2 repair
 * rounds, each fed the latest compiler error, each bounded by the job clock").
 * Round two works on round one's corrected pages and the second compile's own
 * error. `room` is asked before EVERY round (a function, or a fixed answer).
 * `touched` absent means every page in the list may be repaired (the error
 * still picks which). The usage of every round rides back; the caller charges
 * it only when `built` is set.
 */
export async function compileRepairRounds({ error, pages, touched = null, send, model, compile, room = true, rounds = MAX_ROUNDS } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const mine = Array.isArray(touched) ? touched : list.filter((p) => p && typeof p.path === "string").map((p) => p.path);
  const ask = () => { try { return typeof room === "function" ? !!room() : !!room; } catch { return false; } };
  const n = Math.max(1, Math.min(MAX_ROUNDS, Number(rounds) || MAX_ROUNDS));
  const all = { ran: false, rounds: 0, repaired: [], refused: [], usage: [], built: null, pages: null };
  let err = error;
  let cur = list;
  for (let i = 0; i < n; i++) {
    const r = await compileRepairRound({ error: err, pages: cur, touched: mine, send, model, compile, room: ask() });
    if (!r.ran) { if (!all.ran) all.why = r.why; else all.stopped = r.why; break; }
    all.ran = true;
    all.rounds = i + 1;
    for (const x of r.repaired) if (!all.repaired.includes(x)) all.repaired.push(x);
    all.refused.push(...r.refused);
    all.usage.push(...r.usage);
    if (r.built) { delete all.failed; return { ...all, built: r.built, pages: r.pages }; }
    all.failed = r.failed;
    if (r.failed !== "compile" || !r.error) break;
    err = r.error;
    cur = r.corrected;
  }
  return all;
}
