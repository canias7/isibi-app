// EVERY WAY THE EDIT ROUTE CAN DECLINE, AND WHAT HAPPENS NEXT (2026-09-23).
//
// Owner: *"Classify the existing escalation cases explicitly. Preserve
// genuinely intended rewrite behavior, but don't assume "no-lane" or another
// existing reason proves a rewrite can safely solve the request."*
//
// Until this, "escalate" was one shape for four different outcomes, and the
// browser read every escalate that named no layer as `up` — the full rewrite of
// every page, ~17–45 credits, started with nothing on screen and no price. So a
// removal aimed at a page the site does not have, a lane picker that could not
// place the message, a database read that blinked and a model that answered
// nothing all bought the same rewrite. None of those is something a rewrite of
// every page is known to fix, and each of them risks the pages nobody asked
// about.
//
// FOUR CLASSES, and the class decides what the customer's browser does:
//
//   up      — the browser starts the full rewrite. ONLY where the rung has
//             positively established that the change is beyond it and a
//             writer that regenerates pages is the designed next step.
//   addon   — the escalate names `layer: "addon"`: the change ADDS something
//             the site does not have (owner, 2026-09-02: "add will always go in
//             addon").
//   hop     — the escalate names a cheaper edit layer that can do it, one hop
//             sideways, bounded in the browser (`EditPoll.escalateAction`).
//   explain — NO escalate. A sentence, at no cost for the edit, with nothing
//             written. Everything a rewrite cannot be shown to solve: a thing
//             that is not there, an ask nobody could place, and every failure
//             that is ours.
//
// THE TABLE IS THE CLASSIFICATION AND THE ROUTE IS HELD TO IT.
// `test/edit-failure.test.mjs` reads every `escalate(` and `explain(` call in
// the edit route and requires each to name an entry here with the matching
// class, both ways — so a new refusal cannot be added as an unclassified
// escalate, which is exactly how the missing-page removal came to buy a
// rewrite: its comment said "an addon" and its escalate named no layer.
//
// DEPENDENCY-FREE, because the Worker and the job child both import it, and the
// job image copies `builder/` modules by name (the Dockerfile's worker line).

/**
 * `key` is `<rung>/<name>`: the same reason means different things on
 * different rungs (`no-meta` is a hop on the data rung, an add-on on the rules
 * rung and a failed read on the look rung), so a reason alone cannot carry a
 * class. `reason` is what goes on the wire; `why` is the justification, written
 * for the next person who wants to change the class.
 */
export const EDIT_FAILURES = Object.freeze([
  // ── BEFORE ANY RUNG ─────────────────────────────────────────────────────
  { key: "route/empty", reason: "empty", cls: "up",
    why: "Never sent by a browser (the composer posts no empty message). Kept as the escalate the canary's free round trip reads; a browser with no ask answers `lost` from it, so it can never start a rewrite." },
  { key: "route/unconfigured", reason: "unconfigured", cls: "explain", ours: true,
    why: "The picked model's key is missing — ours. The rewrite runs on the same picker and would meet the same missing key." },
  { key: "route/no-source-unreadable", reason: "no-source", cls: "explain", ours: true,
    why: "The stored pages could not be READ. A transient store failure is ours, and a rewrite reads the same store to anchor on." },
  { key: "route/no-source", reason: "no-source", cls: "up",
    why: "The store answered and holds no pages: a site built before its source was kept. No edit rung can act without source; the rewrite, which regenerates pages, is the only rung that can." },
  { key: "route/layer", reason: "layer", cls: "explain", ours: true,
    why: "Every router layer is implemented, so reaching the fall-through is a mismatch of ours between the router and this route — a defect to fix, not a reason to buy a rewrite." },

  // ── THE LANE PICKER AND THE PAGE VERBS ──────────────────────────────────
  { key: "picker/no-lane", reason: "no-lane", cls: "explain",
    why: "The picker could not place the message on any part of the site. A rewrite of every page is not evidence of understanding it, and it risks every page nobody asked about." },
  { key: "picker/nothing-to-remove", reason: "nothing-to-remove", cls: "explain",
    why: "A removal of a 3D scene or QR code the site does not have. What was asked for is already true; nothing to do and nothing to buy." },
  { key: "picker/addon", reason: "addon", cls: "addon",
    why: "A code or a scene the site does not have yet is designed from nothing — the add-on step's job." },
  { key: "picker/build", reason: "build", cls: "up",
    why: "`kind` (shopfront or tool) is a different site, not an edit of this one — the owner's own rule. The rewrite is the rung that rebuilds." },
  { key: "picker/unbuilt", reason: "unbuilt", cls: "explain",
    why: "A lane with no implementation (none today). No rung is known to do it, so a rewrite is not either." },
  { key: "pages/page-verb", reason: "page-verb", cls: "explain",
    why: "A pages ask whose verb (add, remove, move) could not be read. The one place a guess can cost a page, and the rewrite is a bigger guess." },
  { key: "pages/addon", reason: "addon", cls: "addon",
    why: "Adding a page is the add-on route's: it designs a page the site does not have, where this route can only edit the ones it has." },
  { key: "pages/no-page", reason: "no-page", cls: "explain",
    why: "Removing or moving a page the site does not have. Removal: what was asked is already true. Move: there is nothing to move. Either way a rewrite cannot help." },

  // ── THE DATA RUNG ───────────────────────────────────────────────────────
  { key: "data/backend-unreadable", reason: "backend", cls: "explain", ours: true,
    why: "The database could not be reached or proven — ours, and nothing a rewrite of the pages touches." },
  { key: "data/spec-unreadable", reason: "backend", cls: "explain", ours: true,
    why: "The database answered but its schema could not be read or recovered — ours." },
  { key: "data/no-backend", reason: "no-backend", cls: "hop", layer: "text",
    why: "The site has no database, so the words the customer means are in the page source, where the text rung changes words for ~1 credit." },
  { key: "data/no-meta", reason: "no-meta", cls: "hop", layer: "text",
    why: "The catalog confirms the database holds no tables, so nothing is stored content — the words are in the page source." },
  { key: "data/no-data", reason: "no-data", cls: "hop", layer: "text",
    why: "No table holds display content, so nothing the site stores is what was asked about — the words are in the page source." },

  // ── THE RULES RUNG ──────────────────────────────────────────────────────
  { key: "rules/no-backend", reason: "no-backend", cls: "addon",
    why: "No database at all: a rule needs a table to apply to, and making one is the add-on step's first backend kind." },
  { key: "rules/no-meta", reason: "no-meta", cls: "addon",
    why: "The catalog confirms no tables — the same: a table first." },
  { key: "rules/no-tables", reason: "no-tables", cls: "addon",
    why: "No named table to apply a rule to (unreachable behind the check above it) — the same: a table first." },

  // ── RENAME, NAV, PICTURE, TEXT ─────────────────────────────────────────
  { key: "rename/rename-store", reason: "rename-store", cls: "explain", ours: true,
    why: "Our alias store refused the write. A rewrite does not move an address at all." },
  { key: "nav/no-nav", reason: "no-nav", cls: "explain",
    why: "No menu, header button or link on any page for the nav rung to change. A rewrite of every page is not the answer to a menu the site does not have." },
  { key: "picture/no-slots", reason: "no-slots", cls: "explain",
    why: "No photograph anywhere on the site — pages and their components — is addressable. The sentence says how to ask for one to be added." },
  { key: "picture/parts-unreadable", reason: "parts-unreadable", cls: "explain", ours: true,
    why: "No photograph in the pages, and the site's components could not be read to look there — ours; the picture may well be in one." },
  { key: "picture/needs-place", reason: "needs-place", cls: "hop", layer: "page",
    why: "A picture asked for where the named page has no frame: the page rung inserts one, on that page alone." },
  { key: "text/no-text", reason: "no-text", cls: "explain",
    why: "No wording anywhere the text rung can address." },
  { key: "text/no-match", reason: "no-match", cls: "explain",
    why: "The model read every piece of wording and matched none. A rewrite would reword the site to hunt for it; asking for the exact words costs nothing." },
  { key: "text/too-much-text", reason: "too-much-text", cls: "up",
    why: "The rung itself established the site carries more wording than it can safely address one item at a time; a writer that rewrites pages is the designed next step." },

  // ── THE LOOK RUNG ───────────────────────────────────────────────────────
  { key: "look/config-unreadable", reason: "config", cls: "explain", ours: true,
    why: "The stored design could not be read — ours, and the rewrite anchors on the same record." },
  { key: "look/no-look", reason: "no-look", cls: "up",
    why: "No stored look and no stylesheet: nothing for this rung to edit. Only the rewrite regenerates a design (a site from before designs were stored)." },
  { key: "look/needs-pages", reason: "needs-pages", cls: "up",
    why: "The look answer moved a page-GENERATION input, which only a rewrite draws (unreachable from today's acting lanes)." },
  { key: "look/no-change", reason: "no-change", cls: "explain",
    why: "The lane named nothing: it could not express the change. The rewrite recompiles from the same stored look — this route's own comment — so it cannot express it either." },

  // ── THE PAGE RUNG ───────────────────────────────────────────────────────
  { key: "page/no-page", reason: "no-page", cls: "explain",
    why: "The page named is not on the site. Removal: already true. Move: nothing to move. An edit: which page was meant is unknown, and the sentence lists the real ones. Asked by the page rung and, since 2026-09-23, by the look door before any lane runs, for a page the router named on a look answer." },
  { key: "page/removal-no-change", reason: "no-change", cls: "explain",
    why: "The removal changed nothing without saying why (unreachable: a page that exists is either kept, with a sentence, or removed)." },
  { key: "page/no-look", reason: "no-look", cls: "up",
    why: "The config answered with no look at all — a site from before designs were stored. The same as the look rung's: only the rewrite regenerates a design." },
  { key: "page/config-unreadable", reason: "config", cls: "explain", ours: true,
    why: "The stored design could not be read — ours." },
  { key: "page/spec-unreadable", reason: "backend", cls: "explain", ours: true,
    why: "The database's schema could not be read or recovered — ours." },
  { key: "page/no-change", reason: "no-change", cls: "explain",
    why: "The page's own writer saw the page and the request and changed nothing. A rewrite of every page is not evidence it would do better, and it risks the pages nobody asked about. (Reverses the 2026-09-20 control, which kept this one escalating.)" },
  { key: "page/no-page-back", reason: "no-page-back", cls: "explain", ours: true,
    why: "The writer's answer did not carry the page — a model failure, ours." },
]);

const BY_KEY = new Map(EDIT_FAILURES.map((f) => [f.key, f]));

/** The table entry for a key, or null. */
export function editFailure(key) {
  return BY_KEY.get(key) || null;
}

/**
 * THE REASONS THE BROWSER MAY ACT ON, by class — derived, never listed twice.
 * A reason can appear under more than one class (`no-meta`: hop on data, add-on
 * on rules), which is why the census reads the call site's own `layer` too.
 */
export function reasonsOf(cls) {
  return [...new Set(EDIT_FAILURES.filter((f) => f.cls === cls).map((f) => f.reason))];
}

/** A site's pages as a customer reads them: "/, /prices and /gear". */
export function pageList(routes) {
  const list = [...new Set((Array.isArray(routes) ? routes : []).filter((r) => typeof r === "string" && r))];
  if (!list.length) return "";
  const shown = list.slice(0, 8);
  const more = list.length - shown.length;
  if (more > 0) return shown.join(", ") + " and " + more + " more";
  if (shown.length === 1) return shown[0];
  return shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1];
}

function pagesClause(routes) {
  const l = pageList(routes);
  if (!l) return "";
  const n = new Set((routes || []).filter(Boolean)).size;
  return n === 1 ? " Its one page is " + l + "." : " Its pages are " + l + ".";
}

/**
 * THE SENTENCE FOR AN `explain` ENTRY.
 *
 * ⚠ RUNG-SCOPED, NEVER A CLAIM ABOUT THE WHOLE REQUEST. None of these says
 * "nothing on your site changed" or "you haven't been charged": a rung is one
 * step of a message that may run several, and a sentence printed beside a step
 * that DID ship would be false (owner, 2026-09-21: "Partial-success wording
 * makes whole-site claims"). The browser adds that clause itself, on the
 * refusal branch, when the reply says nothing on the site changed — and it
 * says what the edit cost and what the routing call cost as two amounts.
 *
 * `facts`: `page` (a route), `verb` (`remove` | `move` | ""), `routes` (the
 * site's pages), `what` (for nothing-to-remove: "a 3D scene" | "a QR code").
 */
export function failureMsg(key, facts = {}) {
  const f = facts || {};
  const page = typeof f.page === "string" ? f.page.trim() : "";
  const routes = Array.isArray(f.routes) ? f.routes : [];
  switch (key) {
    case "route/unconfigured":
      return "The model you picked isn't set up on our side yet, so I couldn't make that change — this is on us. Pick a different model and send it again.";
    case "route/no-source-unreadable":
      return "I couldn't read your site's pages just now, so I stopped before changing anything — this is on us. Try again in a moment.";
    case "route/layer":
      return "I couldn't work out how to make that kind of change from here — this is on us. Try asking for it another way.";
    case "picker/no-lane":
      return "I couldn't tell which part of your site that's about. Say which page or section you mean and what should change, and I'll do it.";
    case "picker/nothing-to-remove":
      return "Your site doesn't have " + (f.what || "that") + " on it, so there was nothing to take off.";
    case "picker/unbuilt":
      return "That part of your site can't be changed from here yet.";
    case "pages/page-verb":
      return "I couldn't tell whether you want a page added, taken off or moved. Say which, and name the page.";
    case "pages/no-page":
    case "page/no-page": {
      const named = page ? "a " + page + " page" : "that page";
      if (f.verb === "remove") return "Your site doesn't have " + named + ", so there was nothing to take off." + pagesClause(routes);
      if (f.verb === "move") return "Your site doesn't have " + named + " to move." + pagesClause(routes);
      if (!page) return "I couldn't tell which page you mean." + pagesClause(routes);
      return "Your site doesn't have " + named + "." + pagesClause(routes)
        + " Say which one you meant, or ask me to add a " + page + " page.";
    }
    case "data/backend-unreadable":
      return "I couldn't reach your site's database just now, so I stopped before changing anything in it — this is on us. Try again in a few minutes.";
    case "data/spec-unreadable":
      return "I couldn't read how your site's stored content is set up just now, so I stopped before changing any of it — this is on us. Try again in a few minutes.";
    case "rename/rename-store":
      return "I couldn't save the new web address just now — this is on us. Try again in a few minutes.";
    case "nav/no-nav":
      return "I couldn't find a menu, header button or link on your pages to change for that.";
    case "picture/parts-unreadable":
      return "I couldn't read your site's sections just now, so I couldn't find that photograph — this is on us. Try again in a moment.";
    case "picture/no-slots":
      return "I couldn't find a photograph on your site that I can change. If you'd like one added, say which page it should go on and where.";
    case "text/no-text":
      return "I couldn't find any wording on your pages that I can change that way.";
    case "text/no-match":
      return "I couldn't find that wording on your site. Tell me the exact words as they appear on the page, and what they should say instead.";
    case "look/config-unreadable":
      return "I couldn't read your site's design just now, so I stopped before changing it — this is on us. Try again in a moment.";
    case "look/no-change":
      return "I couldn't work out how to change the site's look that way. Say which part — a colour, the fonts, a section — and what it should look like.";
    case "page/removal-no-change":
      return "I couldn't take " + (page ? "the " + page + " page" : "that page") + " off.";
    case "page/config-unreadable":
      return "I couldn't read your site's design just now, so I stopped before rewriting " + (page ? "the " + page + " page" : "the page") + " — this is on us. Try again in a moment.";
    case "page/spec-unreadable":
      return "I couldn't read what your site's database is set up to do just now, so I stopped rather than guess — this is on us. Try again in a few minutes.";
    case "page/no-change":
      return "I read " + (page ? "the " + page + " page" : "the page") + " and couldn't find a change to make for that. Say what should look different, or which section you mean.";
    case "page/no-page-back":
      return "The page writer didn't send " + (page ? "the " + page + " page" : "the page") + " back, so I stopped before changing it — this is on us. Try again in a moment.";
    default:
      return "";
  }
}

/**
 * THE SENTENCE FOR AN ESCALATION THAT CANNOT BE ACTED ON — one step of a
 * message that ran several.
 *
 * With one step the browser acts on an escalate: it hops, goes to the add-on
 * step, or starts the rewrite. With several, the other steps have already run
 * or been refused, and acting on one step's escalate would do part of a
 * message at a price nobody saw. So the step is SAID, with what it needs, and
 * nothing is bought — which is also what stops a message whose every step was
 * refused from falling to the rewrite with no sentence at all (reproduced
 * through the route and the browser handler, 2026-09-23).
 */
export function stepMsg(body) {
  const b = body && typeof body === "object" ? body : {};
  const reason = typeof b.reason === "string" ? b.reason : "";
  const layer = typeof b.layer === "string" ? b.layer : "";
  const page = typeof b.page === "string" ? b.page : "";
  if (reason === "needs-place") return "Adding a photograph to " + (page || "that page") + " means rewriting that page — ask for it on its own.";
  if (reason === "build") return "Changing what kind of site this is means rebuilding it — ask for that on its own.";
  if (reason === "no-look") return "Your site has no stored design for me to change, so that part needs the site rewritten — ask for it on its own.";
  if (reason === "needs-pages") return "That part changes how your pages are laid out, so it needs them rewritten — ask for it on its own.";
  if (reason === "too-much-text") return "That wording change touches more of the site than a quick edit can — ask for it on its own.";
  if (layer === "addon") {
    return (reason === "no-backend" || reason === "no-meta" || reason === "no-tables")
      ? "That rule needs a table on your site to apply to — ask me to add one first."
      : "That part adds something new to your site — ask for it on its own.";
  }
  if (layer === "text") return "That's in your pages' wording rather than stored content — ask for it on its own and I'll change the words.";
  if (layer) return "That part needs a different kind of change — ask for it on its own.";
  return "That part needs more than a quick edit — ask for it on its own.";
}
