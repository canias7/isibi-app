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

/** The pages a compile error names, among those this change wrote; else those pages. */
export function pagesForError(error, pages, touched) {
  const text = String(error == null ? "" : error);
  const mine = new Set((Array.isArray(touched) ? touched : []).map(String));
  const list = (Array.isArray(pages) ? pages : []).filter((p) => p && typeof p.path === "string" && mine.has(p.path));
  const named = list.filter((p) => {
    const base = p.path.split("/").pop();
    return text.includes(p.path) || (base && text.includes(base));
  });
  return (named.length ? named : list).slice(0, MAX_FILES);
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
        instruction: "This page did not compile. The compiler said:\n" + said,
        path: p.path, source: String(p.source || ""), send,
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
  return { ...base, built: null, pages: null, failed: "compile" };
}
