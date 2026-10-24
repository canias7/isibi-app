// WHAT EACH PART OF A REQUEST TOUCHES, WHAT IT WAITS FOR, AND WHAT MAY RUN
// BESIDE IT (2026-10-08, the parallel-tasks batch).
//
// The owner: *"one user message can contain multiple tasks, independent tasks
// run concurrently, and tasks wait only when they need another task's result
// or would conflict with its changes … The model should identify the requested
// tasks, their targets and dependencies using the full message, files and
// earlier answers; code should validate and enforce that plan. Avoid hardcoded
// phrase matching or site-specific task rules."*
//
// ── WHAT THIS MODULE DECIDES (pure; `request.mjs` keeps the record) ─────────
//
//   * TARGETS. The router names, for every part it found, what that part
//     changes (`writes`) and what it only refers to (`reads`), in one small
//     vocabulary of the site's own resources. Code checks each against the
//     site (a page must look like a page path, a table like a name), keeps
//     what reads, and adds what each step is KNOWN to write from the code's
//     own wiring — a menu step writes the menu, a page removal the page and
//     the menu — so a part whose words sound unrelated to another's still
//     conflicts with it when both reach the same shared thing. A part with
//     nothing readable is taken to touch the whole site: never guessed to be
//     independent.
//   * WAITING. A part waits for the parts the model said it needs
//     (`dependsOn`, kept as `needs`), and for a part that CREATES something it
//     refers to — a menu link to a page another part adds — even when the
//     model did not say so, whichever order the words came in.
//   * WHAT RUNS BESIDE WHAT. Writes are applied one at a time (the site's own
//     lock, in the database, allows one job per site), in an order that
//     honours both of the above. Preparation — a part's model calls and any
//     picture it buys, with nothing written to the site — may run beside
//     another part's job and beside other preparations, but never ahead of an
//     earlier part that writes what it touches: prepared against a site about
//     to change under it, it would be thrown away.
//
// Nothing here reads words for meaning: every decision is the model's
// structured answer, the site's own inventory, or the code's own wiring.

/** The resource kinds a target may name. `site` is the whole site — what a part with no readable target is taken to touch. */
// FUNCTIONS, CONNECTIONS AND SCHEDULES BY NAME (2026-10-11, round 11): an
// addition that makes one was a change with no readable target — the whole
// site — so it waited for every part and every part waited for it.
export const TARGET_KINDS = Object.freeze(["page", "new-page", "menu", "footer", "header", "theme", "identity", "data", "new-data", "component", "new-component", "function", "new-function", "api", "new-api", "job", "new-job", "images", "pagelist", "site"]);
/** Kinds that name one thing, after a colon. */
const NAMED = new Set(["page", "new-page", "data", "new-data", "component", "new-component", "function", "new-function", "api", "new-api", "job", "new-job"]);
/** What a kind that creates something makes, as the kind that later refers to it. */
const MADE_AS = Object.freeze({ "new-page": "page", "new-data": "data", "new-component": "component", "new-function": "function", "new-api": "api", "new-job": "job" });
const SITE = "site";

const PATH_RE = /^\/[a-z0-9][a-z0-9/_-]{0,80}$|^\/$/;
const NAME_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

/** A page path as the site names it: lower case, one leading slash, no trailing one, no `.tsx`, `index` the home page. */
export function pagePath(v) {
  if (typeof v !== "string") return null;
  let s = v.trim().toLowerCase().replace(/\.tsx$/, "");
  if (!s) return null;
  if (s === "index" || s === "/index") return "/";
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return PATH_RE.test(s) ? s : null;
}

/**
 * ONE TARGET READ BACK, or null. `page:/visit`, `new-page:/gallery`, `menu`,
 * `data:loaves` … — a kind from the list, and for a named kind a name that
 * reads as one. Never coerced: a non-string is no target.
 */
export function readTarget(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  const at = s.indexOf(":");
  const kind = (at < 0 ? s : s.slice(0, at)).toLowerCase();
  if (!TARGET_KINDS.includes(kind)) return null;
  if (!NAMED.has(kind)) return at < 0 ? kind : null;
  const name = at < 0 ? "" : s.slice(at + 1).trim();
  if (kind === "page" || kind === "new-page") { const p = pagePath(name); return p ? kind + ":" + p : null; }
  return NAME_RE.test(name) ? kind + ":" + name.toLowerCase() : null;
}

/**
 * THE ROUTER'S `targets`, per change number: `{ [change]: { writes, reads } }`
 * holding only what reads. The router numbers its changes as `dependsOn` does
 * (0 the part it answered, 1… each held part in order). A change named twice
 * keeps the union; a malformed entry is skipped, never guessed.
 */
export function readTargets(raw) {
  const out = {};
  if (!Array.isArray(raw)) return out;
  for (const e of raw) {
    if (!e || typeof e !== "object" || Array.isArray(e) || !Number.isInteger(e.change) || e.change < 0) continue;
    const slot = out[e.change] || (out[e.change] = { writes: [], reads: [] });
    for (const k of ["writes", "reads"]) {
      for (const t of Array.isArray(e[k]) ? e[k] : []) {
        const r = readTarget(t);
        if (r && !slot[k].includes(r)) slot[k].push(r);
      }
    }
  }
  return out;
}

/**
 * WHAT A STEP IS KNOWN TO WRITE, from its route — the code's own wiring of
 * what each executor touches, never the words: the menu step writes the menu;
 * a page taken away or renamed is the page and every menu that links it; the
 * logo step the site's identity; the data and rules steps a table. Steps whose
 * reach depends on what the model picks inside them (a look, a text change
 * with no page, an addition) are known only by what the router named, and
 * with nothing named they are the whole site.
 */
export function impliedWrites(route) {
  if (!route || typeof route !== "object") return [];
  if (route.op === "addon" || route.intent === "addon") return [];
  const layer = typeof route.layer === "string" ? route.layer : "";
  const page = pagePath(route.page);
  const out = [];
  if (layer === "nav") out.push("menu");
  else if (layer === "logo") out.push("identity");
  else if (layer === "page" && page && (route.remove === true || (typeof route.rename === "string" && route.rename))) out.push("page:" + page, "menu", "pagelist");
  else if (layer === "picture") out.push("images", ...(page ? ["page:" + page] : []));
  else if ((layer === "text" || layer === "page") && page) out.push("page:" + page);
  else if (layer === "data" || layer === "rules") out.push("data");
  return out;
}

/**
 * WHAT A STEP BUILDS ITS MODEL REQUEST FROM — the code's own wiring of each
 * step's inputs: the text step lists every page's words, the menu step every
 * menu and the page list, the picture step every picture's description, the
 * routing the page list. A preparation made while an earlier part that writes
 * any of that is still to be applied would be asked again by its job (its
 * request would no longer be the one prepared), so it waits — what it may
 * NOT do is be wrong: the job's exact-request check decides that, not this.
 */
/**
 * A STEP'S DECLARED SCOPE (2026-10-11, the parallel-work goal): for a text
 * step whose every write names a page, those pages; for a data step whose
 * every write names a table, those tables. `null` when the step's reach is not
 * declared that narrowly — then it reads, and is planned as reading, the whole
 * of what its model is shown.
 *
 * A PREPARED PART'S STEP IS SHOWN ONLY THIS SCOPE (2026-10-11, after Codex's
 * review; `jobBody` carries it, `site-apply.mjs` `scopedText`/`scopedData`
 * honour it): its model sees the scope's pages or tables and only the names of
 * the rest, and says `needs` when what it was asked depends on anything not
 * shown — then it is asked again with the whole site as it is when its job
 * runs. So what a prepared answer rests on is exactly its request, and only an
 * exact replay reuses one. Planning may therefore treat the step as depending
 * on its scope alone: a dependency the router left out cannot make a reused
 * answer stale, only a fresh one asked. Never for rules, a look, a menu or an
 * addition, whose reach the model decides inside the step.
 */
export function prepScope(part) {
  if (!part || part.phase === "route" || !part.route || part.route.op === "addon" || part.route.intent === "addon") return null;
  const layer = typeof part.route.layer === "string" ? part.route.layer : "";
  // RULES TOO (2026-10-11, the generality round): a rule change named for
  // tables is shown those tables (`runRulesEdit`, `scopedData`), so it rests
  // on them alone — the data step's contract, `needs` included.
  if (layer !== "text" && layer !== "data" && layer !== "rules") return null;
  const t = part.targets && typeof part.targets === "object" ? part.targets : {};
  const named = Array.isArray(t.writes) ? t.writes.map(readTarget).filter(Boolean) : [];
  if (!named.length) return null;
  // A STEP THAT DECLARES IT READS SOMETHING ("make the About line match the
  // Visit heading") depends on what it reads: never narrowed.
  if (Array.isArray(t.reads) && t.reads.map(readTarget).some(Boolean)) return null;
  if (layer === "text") {
    if (!named.every((w) => w.startsWith("page:"))) return null;
    // A TEXT STEP THE ROUTER NAMED ONE PAGE FOR, and the route's own page, are
    // its scope; a route naming another page than its targets is not narrowed.
    const pages = [...new Set(named.map((w) => w.slice("page:".length)))];
    const own = pagePath(part.route.page);
    if (own && !pages.includes(own)) return null;
    return { pages };
  }
  if (!named.every((w) => w.startsWith("data:"))) return null;
  return { tables: [...new Set(named.map((w) => w.slice("data:".length)))] };
}

/**
 * A ROUTING'S DECLARED SCOPE (2026-10-15, after run 38649153034: a held price
 * change waited 370 s for an addition beside it, because a routing reads the
 * page list and the addition made a page). For a part still to be routed whose
 * every write the router named, seeing the whole site, is a stored table —
 * and which names no reads — those tables. `null` otherwise: an unnamed part
 * is taken to reach the whole site, and is routed against it as it is.
 *
 * A PREPARED ROUTING IS SHOWN THE PAGE LIST AS IT WAS WHEN THE REQUEST WAS
 * ACCEPTED (`jobBody` carries the scope; the Worker's route handler honours
 * it), not as another part has since changed it, so its exact request is the
 * one prepared and its answer can be replayed. An answer that reaches outside
 * the scope — any route but a data or rules change of those tables — is asked
 * again with the whole site as it is then (`routeInScope`): the scope only
 * ever saves a call, it never decides a route.
 */
export function routeScope(part) {
  if (!part || part.phase !== "route" || part.route) return null;
  const t = part.targets && typeof part.targets === "object" ? part.targets : {};
  if (Array.isArray(t.reads) && t.reads.map(readTarget).some(Boolean)) return null;
  const named = Array.isArray(t.writes) ? t.writes.map(readTarget).filter(Boolean) : [];
  if (!named.length || !named.every((w) => w.startsWith("data:"))) return null;
  return { tables: [...new Set(named.map((w) => w.slice("data:".length)))] };
}

/**
 * IS A SCOPED ROUTING'S ANSWER INSIDE ITS SCOPE? With nothing held back and
 * no question: an edit of the data or rules layer whose own named writes, when
 * it names any, are among the scope's tables; or an addition whose own named
 * writes are all rows of those tables. Anything else is asked again of the
 * whole site.
 */
export function routeInScope(scope, answer) {
  if (!scope || !Array.isArray(scope.tables) || !scope.tables.length || !answer || typeof answer !== "object") return false;
  const tableEdit = answer.intent === "edit" && (answer.layer === "data" || answer.layer === "rules");
  // AN ADDITION THAT ONLY WRITES ROWS OF THE SCOPED TABLES ("add an entry to
  // the list") stays inside it — but only when it names those writes itself.
  const addition = answer.intent === "addon";
  if (!tableEdit && !addition) return false;
  const held = answer.alsoAsked;
  if (held !== undefined && held !== null && !(Array.isArray(held) && !held.length)) return false;
  if (answer.question) return false;
  const named = readTargets(answer.targets);
  const own = named && named[0] ? named[0] : null;
  if (!own) return tableEdit;
  const writes = (own.writes || []).map(readTarget).filter(Boolean);
  const reads = (own.reads || []).map(readTarget).filter(Boolean);
  return !reads.length && writes.length > 0 && writes.every((w) => w.startsWith("data:") && scope.tables.includes(w.slice("data:".length)));
}

/**
 * AN ADDITION'S DECLARED SCOPE (2026-10-11, the parallel-work goal: "a
 * component that does not need the image's contents can be generated
 * alongside it"): the existing pages it names, when every write the router
 * named for it lands on a named page — that page itself, a component made for
 * it, or a picture placed on it — and it declares no reads. `null` for a new
 * page (its writer copies the design of the pages beside it), for a menu, a
 * table or the whole site, and for a routing.
 *
 * A PREPARED ADDITION IS SHOWN ONLY THIS SCOPE (`jobBody` carries it; the
 * Worker's add-on route honours it): its picker and designers are told the
 * full page list but what is built from, and pictured on, its own pages only;
 * its page writer is shown its own pages' source and the components those
 * pages import, and every other stored component is protected by name without
 * being listed. A designer that names a page outside the scope widens the
 * page writer back to the whole site, and its prepared answer then rests on a
 * request no plan promised — the job's exact-request check asks it again.
 */
export function addonScope(part) {
  if (!part || part.phase === "route" || !part.route || !(part.route.op === "addon" || part.route.intent === "addon")) return null;
  const t = part.targets && typeof part.targets === "object" ? part.targets : {};
  if (Array.isArray(t.reads) && t.reads.map(readTarget).some(Boolean)) return null;
  const named = Array.isArray(t.writes) ? t.writes.map(readTarget).filter(Boolean) : [];
  if (!named.every((w) => w.startsWith("page:") || w.startsWith("component:") || w.startsWith("new-component:") || w === "images")) return null;
  const pages = [...new Set(named.filter((w) => w.startsWith("page:")).map((w) => w.slice("page:".length)))];
  return pages.length ? { pages } : null;
}

/** The pages a part names as written: where what it places (a picture, a new component) lands. Empty when it names none. */
function pagesWritten(part) {
  return effectiveTargets(part).writes.filter((w) => w.startsWith("page:") || w.startsWith("new-page:")).map((w) => "page:" + w.slice(w.indexOf(":") + 1));
}

export function stepInputs(part) {
  if (!part) return [SITE];
  // A SCOPED ROUTING (`routeScope`) is shown the page list as recorded at
  // acceptance; what can still change its request is the site's table list,
  // which a table some part creates changes.
  if (routeScope(part)) return ["tablelist"];
  if (part.phase === "route" || !part.route) return ["pagelist"];
  const layer = typeof part.route.layer === "string" ? part.route.layer : "";
  // A DECLARED SCOPE NARROWS WHAT THE STEP DEPENDS ON (`prepScope`).
  const scope = prepScope(part);
  if (scope && scope.pages) return scope.pages.map((p) => "page:" + p);
  if (scope && scope.tables) return scope.tables.map((t) => "data:" + t);
  // AN ADDITION (2026-10-09): its picker reads the page list and the look; its
  // designers the menu it may add to and the pictures it may use; its page
  // writer the pages it writes beside. A stored row it does not read; a table
  // it adds is waited for by creation, and one changed beside it is caught by
  // the job's exact-request check.
  // A SCOPED ADDITION (`addonScope`) reads the page list, the look and its own
  // pages — and what renders on them, which `feeds` answers per page.
  const aScope = addonScope(part);
  if (aScope) return ["pagelist", "theme", ...aScope.pages.map((p) => "page:" + p)];
  // A SCHEMA-ONLY ADDITION (2026-10-11, the validation round): every write
  // the router named is a table — one it makes or one it changes — and it
  // declares no reads. Its picker reads the page list and the look, its
  // designers the stored tables; no page, menu or picture is its input. A
  // designer that decides a page should show the table makes its page writer
  // read pages no plan promised, and the job's exact-request check asks that
  // writer again — never this.
  const aw = schemaOnly(part);
  if (aw) return ["pagelist", "theme", ...aw];
  const np = newPageDesign(part);
  if (np) return ["pagelist", "theme", "menu", "kits", ...np];
  if (part.route.op === "addon") return ["pagelist", "theme", "menu", "pages", "images"];
  if (layer === "text") return ["pages"];
  if (layer === "nav") return ["menu", "pagelist"];
  if (layer === "picture") return ["images"];
  // THE LOOK's picker reads the site's name and its page list, each value
  // lane its own stored field, and a layout lane the page it moves. NAMED
  // (2026-10-11, the generality round): when every write the router named is
  // the look itself (`theme`, `identity`) or a named page, and it reads nothing
  // else, that is all it reads — its preparation never waits for a part writing
  // some other page. A lane outside what was named still only costs a fresh
  // call: its job's exact-request check decides, never this.
  if (layer === "look") return lookInputs(part) || ["theme", "pages"];
  // A PAGE step: a change the router named for one page is first asked of the
  // tweak, which is shown that page's file and nothing else; a rewrite (the
  // tweak said it cannot) is shown that page's source too, and the other
  // pages by NAME only (`priorPagesBlock`, mode "page") — a sibling's words
  // changing never changes its request (2026-10-11, the validation round,
  // pinned by "REVALIDATED control"). NAMED (the generality round): planned as reading that
  // page and the page list, so its preparation does not wait for a part
  // writing another page — a rewrite whose siblings changed meanwhile is asked
  // again by its job's exact-request check, never applied stale.
  if (layer === "page") return pageInputs(part) || ["pages", "pagelist"];
  // DATA and RULES read the tables.
  if (layer === "data" || layer === "rules") return ["data"];
  return [SITE];
}

/**
 * A BACKEND-ONLY ADDITION'S OWN INPUTS (round 9 for tables; round 11 for
 * functions, connections and schedules): every write the router named is a
 * table, a stored function, an outside connection or a schedule — made or
 * changed — and every read it declared is one of those too. Its designers read
 * the stored schema; what it is planned on is the things it names, by name.
 * Null otherwise.
 */
const BACKEND = ["data", "new-data", "function", "new-function", "api", "new-api", "job", "new-job"];
const kindOf = (w) => (w.includes(":") ? w.slice(0, w.indexOf(":")) : w);
function schemaOnly(part) {
  if (!(part.route.op === "addon" || part.route.intent === "addon")) return null;
  const t = part.targets && typeof part.targets === "object" ? part.targets : {};
  const named = Array.isArray(t.writes) ? t.writes.map(readTarget).filter(Boolean) : [];
  const reads = Array.isArray(t.reads) ? t.reads.map(readTarget).filter(Boolean) : [];
  if (!named.length || !named.every((w) => BACKEND.includes(kindOf(w)) && w.includes(":"))) return null;
  if (!reads.every((w) => BACKEND.includes(kindOf(w)) && w.includes(":"))) return null;
  // ITS OWN THINGS, by name: a row written to another table, or another
  // function, is not its input. Another table's SCHEMA changed beside it (a
  // rule) is in its request, and the job's exact-request check asks it again.
  return [...new Set([...named, ...reads].map((w) => (MADE_AS[kindOf(w)] || kindOf(w)) + ":" + w.slice(w.indexOf(":") + 1)))];
}

/**
 * A NEW PAGE'S DESIGN INPUTS beyond the page list, look and menu (round 11):
 * its own tables, when every write the router named is a new page, a section
 * or picture on a page, the menu or a table, and it declares no reads. Its
 * picker and designers identify the site's pages by what each calls itself as
 * the request was understood (`labels`, kept on the request) and see what each
 * page is BUILT from (`kits`) — never the pages' live words or photographs.
 * Its page writer reads the pages beside it; that is `designOnly`'s to hold.
 */
function newPageDesign(part) {
  if (!(part.route.op === "addon" || part.route.intent === "addon")) return null;
  const t = part.targets && typeof part.targets === "object" ? part.targets : {};
  if (Array.isArray(t.reads) && t.reads.map(readTarget).some(Boolean)) return null;
  const named = Array.isArray(t.writes) ? t.writes.map(readTarget).filter(Boolean) : [];
  if (!named.some((w) => w.startsWith("new-page:"))) return null;
  const ok = (w) => w.startsWith("new-page:") || w.startsWith("page:") || w.startsWith("component:") || w.startsWith("new-component:")
    || w === "images" || w === "menu" || w.startsWith("data:") || w.startsWith("new-data:");
  if (!named.every(ok)) return null;
  return [...new Set(named.filter((w) => w.startsWith("data:") || w.startsWith("new-data:")).map((w) => "data:" + w.slice(w.indexOf(":") + 1)))];
}

/**
 * IS THIS ADDITION'S PREPARATION DESIGN ONLY? (round 11) A new page planned on
 * its design inputs (`newPageDesign`): while an earlier part in the apply order
 * that has not ended still changes a page's content, its page writer — which
 * copies the design of the pages beside it — would be asked against pages
 * about to change, so the preparation runs the picker and designers and stops
 * before the writer. The job asks the writer against the pages as they then are.
 * (A schema-only addition needs no such rule: a preparation that has a table,
 * function, connection or job to apply stops before its first reserve and
 * write, which is before the page writer, so its writer is always the job's.
 * Measured by a sweep mutant, round 11.)
 */
export function designOnly(parts, n, ended) {
  const me = parts[n];
  if (!me || me.phase === "route" || !me.route || !newPageDesign(me)) return false;
  for (const m of applyOrder(parts)) {
    if (m === n) return false;
    const q = parts[m];
    if (!q || ended(q)) continue;
    if (effectiveTargets(q).writes.some((w) => partFeeds(q, w, "pages"))) return true;
  }
  return false;
}

/** A named page change's inputs, or null when it is not one page named that narrowly. */
function pageInputs(part) {
  const t = part.targets && typeof part.targets === "object" ? part.targets : {};
  if (Array.isArray(t.reads) && t.reads.map(readTarget).some(Boolean)) return null;
  const own = pagePath(part.route.page);
  const named = Array.isArray(t.writes) ? t.writes.map(readTarget).filter(Boolean) : [];
  if (!own || part.route.remove === true || (typeof part.route.rename === "string" && part.route.rename)) return null;
  if (named.some((w) => w !== "page:" + own)) return null;
  return ["pagelist", "page:" + own];
}

/** A named look's inputs, or null when its reach is not named that narrowly. */
function lookInputs(part) {
  const t = part.targets && typeof part.targets === "object" ? part.targets : {};
  if (Array.isArray(t.reads) && t.reads.map(readTarget).some(Boolean)) return null;
  const named = Array.isArray(t.writes) ? t.writes.map(readTarget).filter(Boolean) : [];
  if (!named.length || !named.every((w) => w === "theme" || w === "identity" || w.startsWith("page:"))) return null;
  return ["pagelist", "theme", ...new Set(named.filter((w) => w.startsWith("page:")))];
}

/**
 * Does an earlier part's write change what a step reads? `feeds`, except that
 * what a part PLACES — a picture, a component it makes — lands on the pages it
 * names, and on any page only when it names none (2026-10-11): a photograph
 * placed on Visit is not an input of a step that reads About.
 *
 * ⚠ WHERE IT DOES LAND, THE ANSWER IS ALSO `conflicts`' TODAY: every step
 * whose input is one page also writes that page, so a part placing something
 * there is held back by the overlap of their writes anyway. `true` is kept so
 * the rule stays right for a step that reads a page it does not write; a
 * sweep mutant answering `false` here survives for exactly that reason
 * (measured, 2026-10-11).
 */
function partFeeds(q, write, input) {
  // WHAT A PAGE IS BUILT FROM (`kits`, round 11) changes with its structure —
  // a section, a component, a layout — never with its words or the photograph
  // in an existing frame: a text step and a picture step leave it as it was.
  if (input === "kits") {
    const layer = q && q.route && typeof q.route.layer === "string" ? q.route.layer : "";
    if (write.startsWith("page:")) return !(layer === "text" || layer === "picture");
    return write === SITE || ["new-page", "component", "new-component", "header", "footer"].includes(kindOf(write));
  }
  if (input.startsWith("page:") && (write === "images" || write.startsWith("new-component:"))) {
    const on = pagesWritten(q);
    if (on.length) return on.includes(input);
  }
  return feeds(write, input);
}

/** Does a write change what a step reads? */
function feeds(write, input) {
  if (write === SITE || input === SITE) return true;
  const kind = write.includes(":") ? write.slice(0, write.indexOf(":")) : write;
  // A PICTURE PLACED is written into a page's source.
  if (input === "pages") return ["page", "new-page", "component", "new-component", "header", "footer", "menu", "identity", "images"].includes(kind);
  if (input === "pagelist") return kind === "new-page" || kind === "pagelist";
  if (input === "tablelist") return kind === "new-data";
  if (input === "images") return kind === "images" || kind === "new-page";
  if (input === "menu") return kind === "menu" || kind === "header" || kind === "new-page";
  if (input === "theme") return kind === "theme" || kind === "identity";
  if (input === "data") return kind === "data" || kind === "new-data";
  // ONE PAGE: what is written to that page, or what every page renders.
  // …AND A PICTURE PLACED (`images`), which is written into a page's source —
  // with no page named, any page (2026-10-11, now that a text step's input can
  // be one page).
  if (input.startsWith("page:")) return overlaps(write, input) || ["component", "new-component", "header", "footer", "menu", "identity", "images"].includes(kind);
  return overlaps(write, input);
}

/** A part's effective targets: what the router named, what its route is known to write, and the whole site when nothing reads. */
export function effectiveTargets(part) {
  const t = part && part.targets && typeof part.targets === "object" ? part.targets : {};
  const writes = new Set(Array.isArray(t.writes) ? t.writes.map(readTarget).filter(Boolean) : []);
  const reads = new Set(Array.isArray(t.reads) ? t.reads.map(readTarget).filter(Boolean) : []);
  // A TABLE THE ROUTER NAMED stands for the step's "some table" (2026-10-09):
  // the data and rules steps write the tables they were asked about.
  const namedTable = [...writes].some((w) => w.startsWith("data:") || w.startsWith("new-data:"));
  for (const w of impliedWrites(part && part.route)) if (!(w === "data" && namedTable)) writes.add(w);
  if (!writes.size) writes.add(SITE);
  return { writes: [...writes], reads: [...reads] };
}

/** The thing a target is about, for overlap: `new-page:/x` and `page:/x` are the same page. */
const thingOf = (t) => {
  const at = t.indexOf(":");
  if (at < 0) return t;
  const kind = t.slice(0, at);
  return (MADE_AS[kind] || kind) + t.slice(at);
};
/** Do two targets reach the same thing? `site` reaches everything; `data` every table. */
function overlaps(a, b) {
  if (a === SITE || b === SITE) return true;
  const ta = thingOf(a), tb = thingOf(b);
  if (ta === tb) return true;
  if ((ta === "data" && tb.startsWith("data:")) || (tb === "data" && ta.startsWith("data:"))) return true;
  return false;
}

/**
 * DO TWO PARTS CONFLICT? When either writes what the other writes or refers
 * to. Two conflicting parts are applied one after the other and the later is
 * prepared only once the earlier has been applied, so it plans against what
 * the earlier one left.
 */
export function conflicts(a, b) {
  const A = effectiveTargets(a), B = effectiveTargets(b);
  for (const w of A.writes) for (const x of [...B.writes, ...B.reads]) if (overlaps(w, x)) return true;
  for (const w of B.writes) for (const x of A.reads) if (overlaps(w, x)) return true;
  return false;
}

/**
 * WAITING THE MODEL DID NOT SAY, AND ONLY ONE KIND: a part that refers to
 * something another part CREATES waits for it — a menu link to the page an
 * addition makes, a row for the table it makes — whichever order the words
 * came in. Only creation: referring to something that already exists needs
 * nothing first. Never added where it would make a cycle with what the model
 * said. Returns the pairs added, `[me, it]`, and adds them to `needs`.
 */
export function inferNeeds(parts) {
  const added = [];
  const reaches = (from, to, seen = new Set()) => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    const p = parts[from];
    return !!p && p.needs.some((m) => reaches(m, to, seen));
  };
  for (const me of parts) {
    if (!me || me.status === "refused") continue;
    const { reads } = effectiveTargets(me);
    if (!reads.length) continue;
    for (const it of parts) {
      if (!it || it.n === me.n || it.status === "refused") continue;
      const made = effectiveTargets(it).writes.filter((w) => Object.hasOwn(MADE_AS, w.slice(0, w.indexOf(":"))));
      const used = made.filter((w) => reads.some((r) => r !== SITE && thingOf(r) === thingOf(w)));
      if (!used.length) continue;
      // A NEED THE MODEL ALREADY SAID gets its things named too, never a second entry.
      if (me.needs.includes(it.n)) { needOn(me, it.n, used.map(thingOf)); continue; }
      if (reaches(it.n, me.n)) continue;
      me.needs.push(it.n);
      // WHAT IT NEEDS FROM IT, by name (2026-10-24, request-needs): the things
      // it reads that the other part creates, so the gate asks whether those
      // exist, never how the other part ended overall.
      needOn(me, it.n, used.map(thingOf));
      added.push([me.n, it.n]);
    }
  }
  return added;
}

/**
 * WHAT A PART NEEDS FROM ANOTHER, BY NAME (2026-10-24, request-needs):
 * `part.needOn[m]` lists the things (`page:/lessons`, `data:lessons`) it reads
 * that part `m` creates. A need with no entry was said by the router only
 * (`dependsOn`) and names nothing concrete.
 */
export function needOn(part, m, things) {
  if (!part || !Number.isInteger(m)) return;
  const cur = part.needOn && typeof part.needOn === "object" && !Array.isArray(part.needOn) ? part.needOn : {};
  const list = Array.isArray(cur[m]) ? cur[m].slice() : [];
  for (const t of things || []) if (typeof t === "string" && t && !list.includes(t)) list.push(t);
  cur[m] = list;
  part.needOn = cur;
}

/** The concrete things part `me` needs from part `m`: `[]` when the need names none. */
export function neededFrom(me, m) {
  const v = me && me.needOn && typeof me.needOn === "object" && !Array.isArray(me.needOn) ? me.needOn[m] : null;
  return Array.isArray(v) ? v.filter((t) => typeof t === "string" && t) : [];
}

/**
 * THE ORDER WRITES ARE APPLIED IN: every part after the parts it needs, and
 * otherwise in the order the message gave them (`at`, then `n`). Parts in a
 * cycle (refused) keep their place and are never run.
 */
export function applyOrder(parts) {
  const placed = [];
  const done = new Set();
  const byPos = [...parts].sort((a, b) => a.at - b.at || a.n - b.n);
  let moved = true;
  while (placed.length < parts.length && moved) {
    moved = false;
    for (const p of byPos) {
      if (done.has(p.n)) continue;
      if (p.needs.every((m) => done.has(m) || !parts[m])) { placed.push(p.n); done.add(p.n); moved = true; break; }
    }
  }
  for (const p of byPos) if (!done.has(p.n)) placed.push(p.n);
  return placed;
}

/**
 * May a part be prepared ahead of its turn? Never ahead of an earlier part in
 * the apply order that has not ended and that writes what its step reads
 * (`stepInputs`), nor — for a step that writes — one it conflicts with:
 * prepared then, its job would only ask again, a call made for nothing.
 */
export function clearToPrepare(parts, n, ended) {
  const order = applyOrder(parts);
  const me = parts[n];
  const inputs = stepInputs(me);
  for (const m of order) {
    if (m === n) return true;
    const q = parts[m];
    if (!q || ended(q) || paused(q)) continue;
    // A ROUTING writes nothing, so only what it reads (the page list) can make
    // it wait; a step that writes waits for any earlier part it conflicts with.
    if (me.phase !== "route" && me.route && conflicts(q, me)) return false;
    if (effectiveTargets(q).writes.some((w) => inputs.some((i) => partFeeds(q, w, i)))) return false;
  }
  return true;
}

/**
 * WHAT TWO WRITING STEPS SHARE THAT THEIR TARGETS DO NOT NAME (2026-10-15, the
 * concurrent-execution round). Two stores are rewritten whole, with no version
 * check, whatever page a step names:
 *   - the site's config (the look, the stylesheet, the marks): the look and
 *     logo steps and an addition patch it before they publish
 *     (`patchSiteConfig`), and put their snapshot back when they fail;
 *   - the database schema: the rules step and an addition apply the whole
 *     merged spec (`applySiteSchema`).
 * Two steps that both write one of them run one after the other, whatever
 * their targets say; one that writes neither shares nothing with them.
 */
const CONFIG_LAYERS = ["look", "logo"];
const SCHEMA_KINDS = ["new-data", "function", "new-function", "api", "new-api", "job", "new-job"];
// AN ADDITION BY ITS TARGETS (2026-10-16): it used to count as a config AND a
// schema writer whatever its router targets said, so two additions never
// overlapped, nor an addition beside a rules or look step. Now an addition
// writes what its targets name — the whole site when they name nothing — and
// one that turns out to need more than it was cleared for (a look it was not
// cleared to write, tables it was not cleared to make) is refused at that
// write, at no cost, and runs again alone (`serial`): worker.js, the add-on's
// `turnStillMine` before its look and its schema check before its backend.
export function writesConfig(part) {
  const r = part && part.route;
  if (r && CONFIG_LAYERS.includes(r.layer)) return true;
  return effectiveTargets(part).writes.some((w) => w === SITE || kindOf(w) === "theme" || kindOf(w) === "identity");
}
export function writesSchema(part) {
  const r = part && part.route;
  if (r && r.layer === "rules") return true;
  return effectiveTargets(part).writes.some((w) => w === SITE || SCHEMA_KINDS.includes(kindOf(w)));
}
/** May two writing steps run at the same time? Never when their targets conflict, nor when both rewrite the config or both the schema. */
export function besideConflict(a, b) {
  if (conflicts(a, b)) return true;
  if (writesConfig(a) && writesConfig(b)) return true;
  if (writesSchema(a) && writesSchema(b)) return true;
  // THE MENU LIVES IN EVERY PAGE FILE (2026-10-23, audit A27-8). The menu step
  // and an addition's menu link rewrite each page's `links`, and the publish
  // rebases whole files, so a menu write running beside any page write always
  // lost at publish and re-ran alone after a wasted model call. Only running
  // side by side is refused here; preparation order (`conflicts`) is unchanged.
  if ((writesMenu(a) && writesPage(b)) || (writesMenu(b) && writesPage(a))) return true;
  return false;
}
const writesMenu = (p) => effectiveTargets(p).writes.some((w) => w === "menu");
const writesPage = (p) => effectiveTargets(p).writes.some((w) => /^(?:new-)?page:/.test(w));
// THE REMOVAL DOOR (2026-10-22, audit A03-4): a `nav` or `picture` route with
// `remove` opens the lane picker, and the lanes it names beside the removal
// are look's own (the stylesheet, the theme, the description, the marks),
// which write the config. Its route and targets name only the menu or the
// pictures, so it is counted here: it takes the turn at its start, as a look
// step does, rather than being refused at its own config write. Kept equal to
// site-ask.mjs `DOOR_LAYERS` (test/door-turn.test.mjs); not imported, since
// site-ask.mjs imports this module.
const DOOR_LAYER_NAMES = ["picture", "nav"];
const removalDoor = (r) => !!(r && r.remove === true && DOOR_LAYER_NAMES.includes(r.layer));
/** Does this step rewrite the site's whole config before it publishes (so it holds the site's publish turn for its whole run)? */
export function holdsConfig(part) { return !!(part && part.phase !== "route" && part.route) && (writesConfig(part) || removalDoor(part.route) || part.serial === true); }

/**
 * MAY A PART'S JOB BE FILED WHILE OTHER JOBS OF ITS REQUEST RUN? (2026-10-15)
 *
 * A WRITING STEP: never ahead of an earlier part in the apply order that has
 * not ended and that it conflicts with (`besideConflict`) — conflicting parts
 * are applied one after the other, in order — and never beside a job already
 * running that it conflicts with, wherever that part stands in the order (a
 * part routed since it was cleared can reach more than its plan named).
 * What one step merely READS changing beside it is not a conflict: each job
 * plans against the site as it began, its publish applies only its own
 * changes onto the site as it is then (`rebaseFiles`), and where one change
 * really rests on another the model said so (`needs`) or code inferred it
 * (`inferNeeds`) — only a `ready` part, whose needs are met, is asked.
 * A ROUTING writes nothing, so a running routing never holds a write back; it
 * waits, as its preparation does, for an earlier or running part whose writes
 * feed what it reads (the page or table list).
 */
export function clearToWrite(parts, n, ended, running) {
  const order = applyOrder(parts);
  const me = parts[n];
  if (!me) return false;
  const inputs = stepInputs(me);
  const writes = me.phase !== "route" && !!me.route;
  const feedsMe = (q) => effectiveTargets(q).writes.some((w) => inputs.some((i) => partFeeds(q, w, i)));
  const runs = (q) => q.phase !== "route" && !!q.route;
  const holds = (q) => (writes ? besideConflict(q, me) : feedsMe(q));
  for (const q of parts) {
    if (!q || q.n === n || ended(q) || !running(q) || !runs(q)) continue;
    // A PART THAT LOST TO AN OVERLAP RUNS ALONE (2026-10-16, `serial`): it
    // waits for every running writer, and none is filed beside it, so its
    // second try cannot lose the same way.
    if ((writes && me.serial) || q.serial) return false;
    if (holds(q)) return false;
  }
  for (const m of order) {
    if (m === n) return true;
    const q = parts[m];
    if (!q || ended(q) || paused(q)) continue;
    if (holds(q)) return false;
  }
  return true;
}

/**
 * PAUSED ON THE CUSTOMER OR ON A PURCHASE (2026-10-16): a part waiting on a
 * question, an approval, or a purchase nobody can tell. Nothing it writes is
 * on its way, so it holds no later part back in the apply order, as with one
 * job at a time, where such a part was never in the way. A real dependency on
 * it is a `need`, and a part with an unmet need is never ready; a writer that
 * is actually running still holds back any part it conflicts with.
 */
const PAUSED = ["waiting", "approval", "uncertain"];
function paused(q) { return PAUSED.includes(q && q.status); }
