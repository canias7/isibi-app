/**
 * THE FIRST BUILD MAKES THE DATABASE ITS PAGES NEED (2026-10-24, owner's word,
 * branch first-build-db-limits).
 *
 * Since 2026-08-24 a first build was frontend-only: the design tool had no
 * `backend`, `needsDb` answered no, and every form or list that needed storage
 * went to `notBuilt` for the customer to ask for again as an addition. With the
 * page caps gone (first-build-uncapped), a ten-page site with bookings, a shop
 * and an editable menu came out as pages with nothing behind them.
 *
 * HOW, IN ONE SENTENCE: the frontend design is unchanged and still names, in
 * `notBuilt`, every feature that needs stored data; when that list is not
 * empty, ONE more design call is made with the site tool's own `backend`
 * property (tables, seed, functions, jobs, apis: the same five fields a revise
 * and the add step design), told the plan's pages and that list; its answer is
 * lifted into the design exactly as a revise's is, and the route's existing
 * chain does the rest: `needsDb` (a fact, never the flag) provisions the Neon
 * project, `applySiteSchema` creates every table with RLS, the access each
 * table's own level resolves to (`resolveAccess`), the pinned `search_path` and
 * the column-scoped write grants, `topUpSeed` / `seedSiteRows` fill the display
 * tables, and the page writer is handed the spec, so the forms and lists are
 * wired to real tables.
 *
 * WHAT IS KEPT FROM 2026-08-24, AND WHY:
 *   - A BROCHURE SITE STILL GETS NO DATABASE. A Neon project is a capped,
 *     billed resource (a platform cap of 100 projects), and the reason a
 *     brochure site stopped getting one still holds. The call is made only
 *     when the design itself named a feature that needs stored data, and a
 *     project is made only when that call declares a table.
 *   - THE FRONTEND TOOL STAYS SMALL. `backend` is ~41% of the tool on the wire;
 *     it is sent only on the builds that need it, in a call of its own.
 *   - A FAILED BACKEND CALL NEVER FAILS THE BUILD. It falls back to today's
 *     frontend-only site with the design's own `notBuilt` named, so nothing
 *     a customer had before is lost.
 *
 * Plain functions; the model call is the caller's (`send`), so every rule here
 * is driven with supplied answers.
 */

/** The longest feature phrase carried to the backend call (a size bound, not a count). */
export const MAX_FEATURE_CHARS = 300;

/** The backend call's own field for what even a database cannot make. */
export const STILL_NOT_BUILT_FIELD = {
  type: "array",
  items: { type: "string" },
  description:
    "Of the features listed in the brief as needing stored data, the ones that even with these tables this site cannot make, " +
    "one short phrase each in the customer's own terms (a payment taken by card without the owner's own payment key, a feature " +
    "of another product). An empty list when every one is made by the tables, rows and functions you declared. Never list a " +
    "feature you declared a table for.",
};

/** What the backend call is told, on top of the site tool's own system text. */
export const FIRST_BUILD_BACKEND_RULES =
  "\n\nTHIS IS A FIRST BUILD. The pages are already planned (below). Declare ONLY the tables, starter rows and functions that the " +
  "listed features need, so each form saves what a visitor sends and each list the owner edits is a real table. A feature that " +
  "needs nothing stored needs no table. Visitor-submitted tables ('collect') are write-only to the public; lists the owner edits " +
  "and visitors read are 'display' and get 3-6 realistic starter rows. Declare no spam or captcha table: the platform's own " +
  "visitor check guards public writes. Answer `notBuilt` with whatever of the list still cannot be made.";

/** The features the design said need stored data: strings, trimmed, deduplicated, each bounded in size (never in count). */
export function featuresNeedingData(designed) {
  const list = designed && typeof designed === "object" && Array.isArray(designed.notBuilt) ? designed.notBuilt : [];
  const out = [];
  for (const x of list) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, MAX_FEATURE_CHARS);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** True when the first build should design a backend: the design named a feature needing stored data and declared no tables itself. */
export function wantsFirstBuildBackend(designed) {
  if (!designed || typeof designed !== "object") return false;
  if (Array.isArray(designed.tables) && designed.tables.length) return false;
  return featuresNeedingData(designed).length > 0;
}

/**
 * The tool for the backend call: the site tool's own `backend` property, never
 * a copy (so it cannot drift from what a revise designs), plus `notBuilt`.
 */
export function firstBuildBackendTool(siteTool) {
  const props = (siteTool && siteTool.input_schema && siteTool.input_schema.properties) || {};
  if (!Object.hasOwn(props, "backend")) throw new Error("the site tool carries no backend property");
  return {
    name: "design_backend",
    description: "Design the database this first build's pages need: tables, starter rows and functions.",
    input_schema: {
      type: "object",
      properties: { backend: props.backend, notBuilt: STILL_NOT_BUILT_FIELD },
      required: ["backend", "notBuilt"],
    },
  };
}

/** The user message: the brief, the planned pages and the features that need storage. */
export function firstBuildBackendBrief(brief, designed, features) {
  const pages = designed && Array.isArray(designed.pages) ? designed.pages : [];
  const lines = pages
    .filter((p) => p && typeof p === "object" && typeof p.path === "string")
    .map((p) => "- " + p.path + (p.role ? ": " + String(p.role).slice(0, 300) : ""));
  return String(brief == null ? "" : brief) +
    "\n\nTHE PAGES ALREADY PLANNED:\n" + (lines.length ? lines.join("\n") : "- /") +
    "\n\nTHE FEATURES THAT NEED STORED DATA (declare what each needs):\n" + features.map((f) => "- " + f).join("\n");
}

/**
 * The design with the backend answer lifted in, and `notBuilt` replaced by
 * what even the database cannot make. An answer with no usable table changes
 * nothing (`made: false`), so the site stays frontend-only and the design's own
 * list is told, exactly as before.
 */
export function mergeFirstBuildBackend(designed, input, liftBackend) {
  const b = input && typeof input === "object" && input.backend && typeof input.backend === "object" && !Array.isArray(input.backend) ? input.backend : null;
  const tables = b && b.tables;
  const has = Array.isArray(tables) ? tables.length > 0
    : tables && typeof tables === "object" ? Object.keys(tables).length > 0
    : typeof tables === "string" ? tables.trim().length > 2 : false;
  if (!has) return { designed, made: false };
  const lifted = liftBackend({ ...designed, backend: b });
  const still = Array.isArray(input.notBuilt) ? input.notBuilt.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];
  const next = { ...lifted };
  if (still.length) next.notBuilt = still; else delete next.notBuilt;
  return { designed: next, made: true };
}
