// THE STAND-IN ON EVERY PATH (owner, 2026-10-24: "use it everywhere … I
// don't think it should fail, but use it everywhere").
//
// An edit or an add-on whose compile still fails after compile repair used to
// be refused whole. Now it is salvaged FILE BY FILE, and a live site never
// loses a working section:
//
//   - a file the site ALREADY HAD that the change broke goes back to its last
//     good version (the stored source of that one file): that file's change is
//     not applied, and the reply says it was kept as it was (`kept`);
//   - a file the change ADDED (a new page, part or component) stands in: a
//     part keeps every export and draws nothing (`partStandIn`), a page is a
//     valid route with the site's own header and footer around an empty main,
//     so every route and link still works (`standIn`);
//   - everything else in the change is published as it compiled.
//
// Only a file the compiler CITES and the change MOVED is touched: a cited file
// the change did not move is not this change's fault, and salvage stops. The
// caller recompiles after each round and refuses as before when it still
// fails — broken code is never published.
//
// Plain module, no I/O, never throws.

import { errorCitations, partStandIn, routeIdFor, pageCredits, totalCost } from "./publish-pages.mjs";
import { PART_DIR } from "./compile-repair.mjs";

export const MAX_SALVAGE_ROUNDS = 3;

const bare = (file) => String(file || "").replace(/^(?:src\/)?routes\//, "");

/**
 * A NEW PAGE THAT WOULD NOT COMPILE, STANDING IN: the route it declares, the
 * site's own header and footer (default exports at `-parts/site-header` and
 * `-parts/site-footer`) when the site has them, and an empty `<main>`. No
 * words of ours: the reply writer says what happened.
 */
export function pageStandIn(path, parts) {
  const id = routeIdFor(path);
  const names = new Set((Array.isArray(parts) ? parts : []).map((p) => p && p.name));
  const header = names.has("site-header");
  const footer = names.has("site-footer");
  return `import { createFileRoute } from "@tanstack/react-router";
${header ? 'import SiteHeader from "@/routes/-parts/site-header";\n' : ""}${footer ? 'import SiteFooter from "@/routes/-parts/site-footer";\n' : ""}
export const Route = createFileRoute("${id}")({
  component: StandIn,
  validateSearch: (search: Record<string, unknown>) => search,
});

function StandIn() {
  return (
    <>
      ${header ? "<SiteHeader />" : ""}
      <main id="main" className="min-h-[50vh]" />
      ${footer ? "<SiteFooter />" : ""}
    </>
  );
}
`;
}

/**
 * One salvage round. `pages` and `parts` are the change as it stands;
 * `storedPages` and `storedParts` the site's last good source (arrays; null
 * means it could not be read, and nothing is salvaged). Answers the new lists
 * and what this round did; `moved: false` when nothing cited could be put
 * back or stood in.
 */
export function salvageRound({ error, pages, parts, storedPages, storedParts, done = null } = {}) {
  const out = { pages: Array.isArray(pages) ? pages : [], parts: Array.isArray(parts) ? parts : [], kept: [], standIn: [], moved: false };
  if (!Array.isArray(storedPages) || !Array.isArray(storedParts)) return out;
  const oldPage = new Map(storedPages.filter((p) => p && typeof p.path === "string").map((p) => [p.path, String(p.source == null ? "" : p.source)]));
  const oldPart = new Map(storedParts.filter((p) => p && typeof p.name === "string").map((p) => [p.name, String(p.source == null ? "" : p.source)]));
  const seen = done instanceof Set ? done : new Set();
  for (const c of errorCitations(error)) {
    const file = bare(c.file);
    if (seen.has(file)) continue;
    const part = file.startsWith(PART_DIR) ? file.slice(PART_DIR.length).replace(/\.tsx?$/, "") : null;
    if (part) {
      const i = out.parts.findIndex((p) => p && p.name === part);
      if (i < 0) continue;
      const now = String(out.parts[i].source == null ? "" : out.parts[i].source);
      if (oldPart.has(part)) {
        if (oldPart.get(part) === now) continue;
        out.parts = out.parts.map((p, k) => (k === i ? { ...p, source: oldPart.get(part) } : p));
        out.kept.push(file);
      } else {
        out.parts = out.parts.map((p, k) => (k === i ? { ...p, source: partStandIn(now), stub: true } : p));
        out.standIn.push(file);
      }
    } else {
      const i = out.pages.findIndex((p) => p && p.path === file);
      if (i < 0) continue;
      const now = String(out.pages[i].source == null ? "" : out.pages[i].source);
      if (oldPage.has(file)) {
        if (oldPage.get(file) === now) continue;
        out.pages = out.pages.map((p, k) => (k === i ? { ...p, source: oldPage.get(file) } : p));
        out.kept.push(file);
      } else {
        out.pages = out.pages.map((p, k) => (k === i ? { ...p, source: pageStandIn(file, out.parts) } : p));
        out.standIn.push(file);
      }
    }
    seen.add(file);
    out.moved = true;
  }
  return out;
}

/**
 * Whether anything of the change is left once salvage has run: some page or
 * part differs from the stored source and is neither kept nor standing in.
 * Nothing left means nothing landed, and the caller refuses as before.
 */
export function anythingLanded({ pages, parts, storedPages, storedParts, kept = [], standIn = [] } = {}) {
  const skip = new Set([...kept, ...standIn]);
  const oldPage = new Map((storedPages || []).map((p) => [p.path, String(p.source == null ? "" : p.source)]));
  const oldPart = new Map((storedParts || []).map((p) => [p.name, String(p.source == null ? "" : p.source)]));
  for (const p of pages || []) {
    if (!p || skip.has(p.path)) continue;
    if (oldPage.get(p.path) !== String(p.source == null ? "" : p.source)) return true;
  }
  for (const p of parts || []) {
    if (!p || skip.has(PART_DIR + p.name + ".tsx")) continue;
    if (oldPart.get(p.name) !== String(p.source == null ? "" : p.source)) return true;
  }
  return false;
}

// ── PAY ONLY FOR WHAT LANDED (owner, 2026-10-24: "if 20 things are asked and
// 1 ends up a stand-in or kept as it was, charge only for what worked") ──────
//
// A writer's charge covers every file it produced. When salvage keeps one of
// them as it was or stands one in, that file's share of the WRITER's spend is
// not charged: by the file's own usage when it is known (a band writer, one
// file each), otherwise in proportion to the files the writer produced. Only
// the writer's share moves; the routing call, the design, the repairs, the
// translations and the photographs on the same bill stay as they were. The
// bill keeps its one rounding (`pageCredits`), so the reduced bill is the same
// arithmetic run on the writer's landed share, and the refund is the
// difference: never more than the bill, never negative.

/** The one spelling every caller compares files in: `index.tsx`, `menu/index.tsx`, `-parts/band-a.tsx`. */
export function salvageKey(file) {
  return String(file || "").replace(/^\/+/, "").replace(/^(?:src\/)?routes\//, "");
}

/** A part's key, from its bare name. */
export const partKey = (name) => PART_DIR + String(name || "") + ".tsx";

/** The keys of the parts in `parts` whose source differs from `before` (all of them when `before` is unread). */
export function writtenPartKeys(parts, before) {
  const was = new Map((Array.isArray(before) ? before : []).filter((x) => x && typeof x.name === "string").map((x) => [x.name, x.source]));
  return (Array.isArray(parts) ? parts : []).filter((x) => x && typeof x.name === "string" && was.get(x.name) !== x.source).map((x) => partKey(x.name));
}

/** A usage object with its counts scaled by `f` (0..1); text fields kept. */
export function scaleUsage(u, f) {
  if (!u || typeof u !== "object") return u;
  const out = { ...u };
  for (const k of ["in", "out", "cacheRead", "cacheWrite", "searches"]) {
    if (Number.isFinite(out[k])) out[k] = out[k] * f;
  }
  return out;
}

/**
 * THE BILL A WRITER'S FILES EARN ONCE SALVAGE HAS RUN.
 *
 * `writer`: the writer's usage objects; `others`: everything else on the same
 * bill; `written`: the files the writer produced (any spelling `salvageKey`
 * reads); `salvaged`: `{ kept, standIn }`; `perFile`: optional `{ file: usage }`
 * for files whose own spend is known. Answers `{ full, landed, refund, hit, of }`:
 * `hit` the written files that ended salvaged, `of` how many it produced.
 * Pure; never throws; `refund` is 0 when nothing the writer wrote was salvaged.
 */
export function landedBill({ writer = [], others = [], written = [], salvaged = null, perFile = null } = {}) {
  const w = (Array.isArray(writer) ? writer : [writer]).filter((u) => u && typeof u === "object");
  const o = (Array.isArray(others) ? others : [others]).filter((u) => u && typeof u === "object");
  const files = [...new Set((Array.isArray(written) ? written : []).filter((f) => typeof f === "string" && f).map(salvageKey))];
  const gone = new Set([...(salvaged && Array.isArray(salvaged.kept) ? salvaged.kept : []), ...(salvaged && Array.isArray(salvaged.standIn) ? salvaged.standIn : [])]
    .filter((f) => typeof f === "string" && f).map(salvageKey));
  const hit = files.filter((f) => gone.has(f));
  const full = pageCredits(...o, ...w);
  const none = { full, landed: full, refund: 0, hit, of: files.length };
  if (!hit.length || !w.length) return none;
  const writerUsd = totalCost(...w);
  if (!(writerUsd > 0)) return none;
  // BY THE FILE'S OWN SPEND when every salvaged file has one; otherwise by count.
  const own = perFile && typeof perFile === "object" ? perFile : null;
  const known = !!own && hit.every((f) => Object.hasOwn(own, f) && own[f] && typeof own[f] === "object");
  const share = known ? Math.min(1, hit.reduce((s, f) => s + totalCost(own[f]), 0) / writerUsd) : hit.length / files.length;
  const landed = pageCredits(...o, ...w.map((u) => scaleUsage(u, Math.max(0, 1 - share))));
  return { full, landed, refund: Math.max(0, full - landed), hit, of: files.length };
}
