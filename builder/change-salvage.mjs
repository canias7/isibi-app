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

import { errorCitations, partStandIn, routeIdFor } from "./publish-pages.mjs";
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
