/**
 * ONE MORE ROUND FOR A REQUIREMENT THE CHECK FOUND MISSING (2026-10-25,
 * feature-verify; owner: "never fail without a retry", approved for this).
 *
 * After an add-on compiles, each judged requirement is checked against the
 * built pages (`verifyNeed`). A need whose only gaps are a page and a table
 * that never meet ("/lessons does not read or save lesson_bookings") is handed
 * back ONCE to the page writer — the tweak rung, the same model and effort the
 * repair round uses — with the gap as the reason, for that page only. The
 * corrected pages are compiled again and the need is checked again; what is
 * still missing is told as not done. Never a second retry.
 *
 * What one page pass cannot mend is not retried: a page or a table that is not
 * there, a missing column, a missing rule. Those need a new design and are told
 * as not done straight away.
 *
 * Billing is the caller's, on the repair round's pattern: the round's model
 * usage is charged once, under the job's own reserve rules. A round that
 * mends nothing costs only the usage it spent.
 */
import { runTweak } from "./site-tweak.mjs";
import { routeOf } from "./site-addon.mjs";
import { verifyNeed } from "./requirement-verify.mjs";

export const RETRY_RULES =
  "You are finishing ONE page of an ADDITION that was just made to a small business's LIVE website. A check of the " +
  "built page found that something the customer asked for is not wired up: the page never reads or saves the " +
  "table it needs. What is missing is below.\n\n" +
  "ADD WHAT IS MISSING AND NOTHING ELSE. Use the site's own data hooks from \"@/lib/rows\": `useRows(\"table\")` to " +
  "list a table's rows, `useCreateRow(\"table\")` to save a form to it (its fields named exactly as the table's " +
  "columns). Use the kit components the page already uses, in the same style. Everything else on the page comes " +
  "back exactly as it went in — the same words, the same order, the same imports you did not need to add.\n\n" +
  "DO NOT CHANGE THE PAGE'S ADDRESS. The `createFileRoute(\"…\")` line stays exactly as it is.\n\n" +
  "If you genuinely cannot add it to this page, answer `cannot` and the page ships as it is.";

/** The instruction for one page: each need and the table it must reach. */
export function retryInstruction(items) {
  const lines = [];
  for (const it of items) {
    lines.push("- The customer asked for: " + it.need + "\n  The check found: " + it.gap
      + "\n  So this page must read or save the `" + it.table + "` table" + (it.columns.length ? " (its columns: " + it.columns.join(", ") + ")" : "") + ".");
  }
  return lines.join("\n");
}

/**
 * The work: one entry per page with something to mend, and the needs that a
 * page pass cannot mend. `needs` are `[{ need, carriers }]`; `pages` the
 * compiled page files (`{ path, source }`).
 */
export function retryBrief(needs, site, pages) {
  const byRoute = new Map();
  const files = new Map();
  for (const p of Array.isArray(pages) ? pages : []) {
    const r = p && typeof p.path === "string" ? routeOf(p.path) : "";
    if (r && !files.has(r)) files.set(r, p);
  }
  const missing = [], unmendable = [];
  for (const n of Array.isArray(needs) ? needs : []) {
    if (!n || typeof n.need !== "string" || !Array.isArray(n.carriers)) continue;
    const v = verifyNeed(n.carriers, site);
    if (v.state !== "missing") continue;
    missing.push(n.need);
    if (!Array.isArray(v.fixes) || !v.fixes.length || v.fixes.some((f) => !files.has(f.route))) { unmendable.push(n.need); continue; }
    for (const f of v.fixes) {
      if (!byRoute.has(f.route)) byRoute.set(f.route, []);
      byRoute.get(f.route).push({ need: n.need, gap: f.route + " does not read or save " + f.table, table: f.table, columns: f.columns || [] });
    }
  }
  const work = [...byRoute.entries()].map(([route, items]) => {
    const p = files.get(route);
    return { route, path: p.path, source: p.source, needs: [...new Set(items.map((i) => i.need))], instruction: retryInstruction(items) };
  });
  return { work, missing, unmendable };
}

/**
 * THE ROUND. `siteOf(pages, built)` rebuilds the site the check reads from a
 * page list and its compile. Answers `{ ran, why?, retried, still, mended,
 * usage, built, pages }`: `built`/`pages` only when the corrected pages
 * compiled, and then they are what ships.
 */
export async function requirementRetryRound({ needs, site, pages, siteOf, send, model, compile, room = true } = {}) {
  const empty = { retried: [], still: [], mended: [], usage: [], built: null, pages: null };
  const brief = retryBrief(needs, site, pages);
  if (!brief.missing.length) return { ran: false, why: "nothing-missing", ...empty };
  if (!brief.work.length) return { ran: false, why: "unmendable", ...empty, still: brief.missing };
  if (!room) return { ran: false, why: "time", ...empty, still: brief.missing };
  if (typeof send !== "function" || typeof compile !== "function" || typeof siteOf !== "function") return { ran: false, why: "no-deps", ...empty, still: brief.missing };
  const results = await Promise.all(brief.work.map(async (w) => {
    try {
      return { w, res: await runTweak({ instruction: w.instruction, path: w.route, source: w.source, send, rules: RETRY_RULES, heading: "WHAT THE CHECK FOUND MISSING", ...(model ? { model } : {}), ...(site && site.spec ? { spec: site.spec } : {}) }) };
    } catch (e) { return { w, res: { ok: false, reason: "send", usage: null } }; }
  }));
  const usage = [], fixed = new Map();
  for (const { w, res } of results) {
    if (res && res.usage) usage.push(res.usage);
    if (res && res.ok && typeof res.source === "string") fixed.set(w.path, res.source);
  }
  const retried = [...new Set(brief.work.flatMap((w) => w.needs))];
  const base = { ran: true, retried, usage };
  if (!fixed.size) return { ...base, why: "refused", mended: [], still: brief.missing, built: null, pages: null };
  const corrected = (Array.isArray(pages) ? pages : []).map((p) => (p && fixed.has(p.path) ? { ...p, source: fixed.get(p.path) } : p));
  let second = null;
  try { second = await compile(corrected); } catch (e) { second = { ok: false }; }
  if (!(second && second.ok === true && second.files)) return { ...base, why: "compile", mended: [], still: brief.missing, built: null, pages: null };
  const after = siteOf(corrected, second);
  const mended = [], still = [];
  for (const n of needs) {
    if (!brief.missing.includes(n.need)) continue;
    (verifyNeed(n.carriers, after).state === "missing" ? still : mended).push(n.need);
  }
  return { ...base, mended, still, built: second, pages: corrected };
}

/** The judged needs a check can read: `[{ need, carriers }]` from the requirements list. */
export function judgedNeeds(list) {
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    const j = r && r.judged;
    if (!j || j.carried !== "yes" || !Array.isArray(j.by) || !j.by.length || typeof r.need !== "string") continue;
    out.push({ need: r.need.trim(), carriers: j.by.filter((x) => typeof x === "string") });
  }
  return out;
}
