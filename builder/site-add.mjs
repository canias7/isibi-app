// THE ADD STEP. ITS OWN PATH, NOT THE BUILD PATH ANCHORED ON A STORED LOOK.
//
// Owner, 2026-09-02: "ok now that you have a big idea of what we want, lets
// start building the addon part" — and the drawing in docs/architecture.md:
// one BUILD makes the site; EDIT, ADDON and DELETE act on it, each publishing
// back through the one spine. The edit step was split off the build's designer
// on 2026-08-29 (`site-lanes.mjs`); this is the same split for the step that
// ADDS.
//
// ── WHAT WAS MIXED ───────────────────────────────────────────────────────────
//
// The addon route called `designSiteSchema` — the BUILD's function, the build's
// 97,142-character tool, the build's system text — anchored on the stored look,
// to add one page or one code to a live site. Twenty-four properties of which
// twenty-one the change had no business opening; a `brand` field that says the
// name "stays inside the brief" on a site that already has a name; a `css`
// description written to stop a FIRST build restyling itself; and the whole
// plan — purpose, pages, shape, components — answered and then THROWN AWAY,
// because the route read only `tables`, `qr`, `three` and `tsx` off the answer
// and handed the page call the customer's sentence with no plan at all.
//
// ── WHAT SEPARATE MEANS HERE, EXACTLY ────────────────────────────────────────
//
// This module imports NOTHING from worker.js and nothing from the build's
// tool. Every word here is written for somebody ADDING to a site that exists:
// a page it has no page for, a component on a page it has (owner, 2026-09-02:
// "section is just adding a new component, so its a tsx step that adds
// components"), a table it has no table for, a QR code, a 3D scene, a
// photograph where there is none. What it
// shares with the build are SHAPES, never wording — the table item
// (`TABLE_ITEM`), the hand-written-component item (`TSX_ITEM`), the kit's
// menu — from the modules both paths may read, exactly as `site-lanes.mjs`
// shares `BEHAVIOR_ITEM`. Two copies of a shape drift in silence; two
// framings of a shape are the whole point.
//
// ── THE SHAPE OF THE STEP, WHICH IS THE EDIT STEP'S SHAPE ────────────────────
//
//   customer ──► pick_adds ──► add_to_site ──► the page call ──► ONE PUBLISH
//                (which of six)  one per kind     (addon mode,
//                small, cached   one property     writes the source)
//
// `pick_adds` names WHAT is being added — the front door, small and cached.
// `add_to_site` runs once per kind named, with a tool that has ONE property
// (the kind's own object) and nothing required, so a kind that cannot answer
// returns nothing and the route says so rather than inventing. Each answer is
// a DESIGN of the addition — where it goes, what it is built from, what it
// leads with — and the step that writes pages turns it into source, exactly
// as the build's page step turns the build's plan into source. The route folds
// what was designed into the stored look and the stored schema and publishes
// once.
//
// ── THE WALL, NOT THE RULE ───────────────────────────────────────────────────
//
// A `component` add cannot re-theme the site or rename it, not because it is
// told not to but because its tool has one property and there is nowhere to
// put the answer. This repo's record is that a rule in prose is one a model
// eventually reads past; a property that does not exist is not.
//
// ── PLACEHOLDER WORDING (owner: "i will tell you the prompt later") ─────────
//
// Every string below — the hints, the four rule parts, the two system blocks —
// is this path's own and written to be replaced. Replacing one is editing one
// value here; nothing else in this repo reads them.

import { TSX_ITEM, MAX_TSX, COMPONENT_MENU, MAX_COMPONENTS, TOOL_DIRECTIVE } from "./site-plan.mjs";
// THE KIT, AS A SET, off the same list the tool hands the model — never a
// second copy. `COMPONENT_MENU` is itself derived from the kit's palette and
// its component directory, so a part added to the kit is offered and accepted
// on the same day, and one removed stops being both at once.
const KIT_COMPONENTS = new Set(COMPONENT_MENU.map((n) => String(n).toLowerCase()));

/**
 * WHAT A JOB'S FUNCTION MAY RETURN, IN THE RUNTIME'S OWN TERMS.
 *
 * Owner, 2026-09-14: *"Document the existing SMS contract in both function and
 * job instructions. Explain the channel, recipient, and message fields the
 * runtime accepts, including email defaults."*
 *
 * **THIS DESCRIBES WHAT ALREADY WORKS.** `shapeMessages` has read `channel`
 * since the day texts were wired: it resolves the SMS credential separately,
 * parses the number through the same `toE164` the write path uses, sends
 * through `deps.sendSms`, and counts a message whose channel has no key as
 * `unsent` rather than failed. Every hop is live. What was missing is this
 * paragraph: MEASURED across all six add tools, the word `channel` appeared
 * **0 times** in the `function` tool and **0 times** in the `job` tool, while
 * the job rule told the owner to paste an SMS key in Settings. A model could
 * still write one from its own knowledge of the field name — so the accurate
 * statement is that the capability was UNDOCUMENTED to the designer, not that
 * it was unreachable.
 *
 * ONE STRING, SENT TO BOTH TOOLS. The function step writes the SQL that
 * produces the messages and the job step decides what is being sent and how
 * often; each needs the same contract, and two copies of it would drift.
 * The guard asserts both carry this exact sentence.
 */
export const MESSAGE_CONTRACT =
  "EACH MESSAGE IS {channel, to, subject, body}. `channel` is \"email\" or \"sms\" and it is the FIELD that decides, " +
  "never the shape: leave it out and the message is EMAILED, and anything that is not \"sms\" is emailed too — " +
  "email is the default because it costs the owner nothing per send. " +
  "An EMAIL needs all three of `to` (an address), `subject` and `body`, and is dropped if any is missing or empty. " +
  "An SMS needs `to` (a phone number in any ordinary form — \"07700 900000\" and \"+44 7700 900000\" are both read) " +
  "and `body`; it takes NO `subject`, because a text has none. " +
  "Return \"sms\" only where the message really wants to be a text — a same-day reminder, a ready-to-collect — " +
  "and email for anything with a subject line to it. The owner pastes an email key and an SMS key separately in " +
  "Settings, so a message whose channel has no key yet is held rather than lost, and the owner is told which key " +
  "is missing.";
import { TABLE_ITEM, FUNCTION_ITEM, API_ITEM, JOB_ITEM } from "./site-table.mjs";
// A LEAF MODULE WITH NO IMPORTS OF ITS OWN, so this adds no cycle — the same
// reasoning `builder/page-gen.mjs` records for importing it. `accessLabel`
// resolves the read/write PAIR rather than believing the stored `access`
// string, which `normalizeSchema` stamps `collect` on any table that did not
// declare a recognised preset.
import { accessLabel } from "../site-access.mjs";
// `mergeAddonSchema` is the merge the PUBLISH really runs over the stored
// tables, and `proposedSpec` runs the same one so the next designer's picture of
// an extended table is the database that is coming rather than a second idea of
// it. Two copies of those rules would drift; this repository has a name for it.
import { routeOf, mergeAddonSchema } from "./site-addon.mjs";
// THE ADD STEP'S OWN REPAIR (below) shares the MECHANISM with the build's —
// the tweak rung, whose guards keep the words and the route; the render
// check's own serious kinds; the language-prefix reading — and nothing else.
import { runTweak } from "./site-tweak.mjs";
import { SERIOUS } from "./site-render.mjs";
import { stripLangPrefix } from "./site-langs.mjs";
// THE QR LIST (2026-09-03): a site carries several, each named, so the `qr`
// kind ADDS one beside the others and refuses only a duplicate.
import { qrList, qrName, qrUnplaced, readQrText, MAX_QRS } from "./site-qr-list.mjs";
// WHERE A COMPONENT LIVES, AS ONE DEFINITION (2026-09-17). `deadQrs` has to
// answer "does this page import that component", and `PART_DIR` is the single
// place this repository says what a component's path looks like — the same
// constant `partNameOf` reads, whose own guard records the `my-parts/x.tsx`
// trap a bare substring test falls into.
//
// `importsPart` MOVED THERE ON 2026-09-20, when it gained a second caller.
// `deadQrs` withholds a component whose code is dead; `routedSources` says
// which PAGE a component's photograph is on. Two readers of one convention, so
// one definition — a second copy is a component the cascade withholds and the
// reporting still credits to a page.
import { PART_DIR, importsPart, partUses } from "./site-files.mjs";
// THE PLATFORM'S OWN BOUNDS ON A PHOTOGRAPH, never a second copy of either.
// `IMAGE_CAP` is how many one change may buy and `MAX_PROMPT_CHARS` is how much
// of a description reaches the image model — both are what `planImages` and
// `buySitePhotos` really enforce, so a constant typed here would be a ceiling
// this tool promises and the spend path does not keep. `site-images.mjs`
// imports one budget constant and nothing else, so this costs no dependency.
import { IMAGE_CAP, MAX_PROMPT_CHARS, imageRefs, imageSources } from "./site-images.mjs";
// THE COVERAGE METADATA, ITS OWN MODULE (owner, 2026-09-13). Deliberately NOT
// part of `TABLE_ITEM`: that item is bound by identity into `design_schema` too,
// so anything added there enlarges the build's tool and becomes a promise the
// engine must keep. A coverage note is neither — no DDL, nothing in `_meta`.
import { REQUIREMENT_ITEM, MAX_REQUIREMENTS, SITE_KINDS, cleanRequirements, requirementBrief } from "./site-requirements.mjs";
// THE TWO BODY WALLS, IMPORTED RATHER THAN RETYPED. Both engines SLICE, and a
// slice is silent: the cleaner refuses at the same number so the customer hears
// about it instead of the site quietly POSTing half a request for ever. The
// function wall was `8000` here against the engine's `4000` — two copies of one
// number, drifted by a factor of two, so a body in between passed the cleaner
// whole and was cut on the way into Postgres.
import { MAX_FN_BODY } from "../site-schema.mjs";
// The engine's own language list, so this step can never refuse one the
// emitter would have written, nor accept one it would not.
import { FN_LANGUAGES } from "../site-rls.mjs";
// THE ACCESS VOCABULARY IS THE ENGINE'S OWN, never a second list beside it:
// `appliedFacts` checks a `covered` claim against what Postgres really
// enforces, and `resolveAccess` is the one reader of that pair (five separate
// bugs have been paid for reading the preset name instead).
import { resolveAccess, ACCESS_PRESETS, READ_LEVELS, WRITE_LEVELS } from "../site-access.mjs";
import { MAX_API_BODY } from "../site-apis.mjs";
import { cleanShape, cleanParams, cleanCredential, apiDetailLines } from "../site-api-shape.mjs";
import { modelsFor } from "./build-models.mjs";

/** The picked model, never a hardcoded one — the rule `site-lanes.mjs` states at length. */
export const ADD_MODEL = modelsFor().quick;

/** Enough for a short list of names. There is no prose in the picker's output. */
export const ADD_PICK_MAX_TOKENS = 200;

/**
 * Enough for one designed addition.
 *
 * The largest thing an add returns is a table with its seed rows — a few
 * thousand tokens. Sized for that and shared, rather than six numbers that
 * drift.
 */
export const ADD_MAX_TOKENS = 16000;

/** How much of the message we will even consider. Matches `site-ask.mjs`. */
export const MAX_MESSAGE = 2000;

/**
 * ── THE UNIVERSAL RULE OF THE ADD STEP (owner, 2026-09-02) ──────────────────
 *
 * "a universal rule, for the addon route is that anytime something new is
 * added it needs to keep the design system, meaning the themes, css etc,
 * whatever it had already, shape, all the things that form the page."
 *
 * ONE STRING, SENT TWICE, because two different models have to hold it: the
 * designers (it rides `ADD_SYSTEM`, the cached block every kind's call
 * carries) decide WHAT is added, and the page writer (it heads the fold's
 * directive) writes the source. Either alone is half a rule: a designer that
 * plans a matching band and a writer that styles it afresh, or the reverse.
 * Exported so a guard can assert both hops carry the same sentence.
 */
export const ADD_DESIGN_RULE =
  "WHATEVER IS ADDED KEEPS THE SITE'S DESIGN SYSTEM. It joins the site as the site is: the same theme, the " +
  "same stylesheet, the same typefaces and colours, the same shape of page, the same kit parts and the same " +
  "conventions the existing pages use. A new thing slots in; nothing around it changes to make room, and " +
  "nothing about the look is re-decided because something was added. No new palette, no inline styling, no " +
  "second design beside the first — the addition should read as if it had been there since the build.\n\n" +
  // A SECOND ONE (owner, 2026-09-04: "add a second one"). Run 35 asked for a
  // testimonials section a site already carried and got its three quotes
  // rewritten shorter under the same names, with `ok` in the reply. The rule
  // rides both hops, like the design rule above; the wall behind it is in the
  // route (`keptProse`: a changed page keeps every word it had).
  "AND AN ADDITION IS ALWAYS A NEW THING. If the site already has something like what was asked for — a " +
  "testimonials band, a form, a list, a code — the new one goes in ADDITION to it, after it, as a second one. " +
  "The one that is there is left exactly as it is: not reworded, not restyled, not merged into the new one, " +
  "not replaced. A page you return still says every word it said before, and more.\n\n" +
  // A SECOND ONE COPIES THE FIRST (owner, 2026-09-04: "new components should
  // copy existing design"). Run 36 added the second testimonials band as
  // stacked full-width cards under a first band of three across — two
  // designs of one thing on one page. The rule rides both hops like the
  // rest; the harness reads the served page and says whether the new band
  // is built the way the first is.
  "AND A SECOND ONE IS BUILT THE WAY THE FIRST IS BUILT. When the page already has a section like the one " +
  "asked for, the new one copies its design: the same component — the kit part it calls, or the part written " +
  "for this site — called the same way, in the same wrapper, with the same layout: three across stays three " +
  "across, a grid stays a grid, the same widths, the same card. Only the words are new. Two bands of one kind " +
  "on one page are one design twice, never two designs, and the one that was there first is the one to copy.";

/**
 * ── NO LOW LIMITS WHILE TESTING (owner, 2026-09-02) ─────────────────────────
 *
 * "no limit on things that can be added, like the pages, new components — at
 * least not a low limit for now since we are testing."
 *
 * So a message may name EVERY kind it asks for, and the kinds that can come
 * in numbers — pages, components, tables — answer LISTS. The caps below are
 * ceilings a site can actually hold, not quotas: the page cap is the page
 * writer's own (`MAX_PAGES` in page-gen.mjs keeps the first six), the rest
 * are generous. The rule per kind says "as many as they asked for, and not
 * one they did not", which is the ceiling that matters.
 */
export const MAX_ADDS = 9;

/** Pages one message may add — the page writer keeps six, so a seventh would be dropped there. */
export const MAX_ADD_PAGES = 6;

/** Components one message may add, across its pages. */
export const MAX_ADD_COMPONENTS = 12;

/** Tables one message may add. */
export const MAX_ADD_TABLES = 6;

/**
 * ── THE BACKEND IS THE ADDON'S (owner, 2026-09-03) ──────────────────────────
 *
 * "the build step doesnt have backend so its gonna be on the addon step if
 * needed, so lets add the backend stuff to the addon step and if customer
 * touches it then neon db is created."
 *
 * A first build sends none of the four backend tiers, so every function a page
 * calls, every outside service a page reads and every job that runs on a timer
 * is added HERE, after the build — and the first of any of them on a site with
 * no database is what makes the database (the route provisions before it
 * applies). The three shapes below are the build's own items, lifted into
 * `site-table.mjs` beside the table's for the same reason.
 */
/** Functions one message may add — a lookup, its cancel and its amend are three. */
export const MAX_ADD_FUNCTIONS = 6;

/** Outside connections one message may add. */
export const MAX_ADD_APIS = 4;

/** Scheduled jobs one message may add — the engine keeps eight per site. */
export const MAX_ADD_JOBS = 4;

/**
 * The shortest interval a job may run at. `site-jobs.mjs` (`MIN_EVERY_MINUTES`)
 * is the authority and rounds anything shorter up; this module may not import
 * from the root, so the number is repeated here and a test holds the two
 * together.
 */
export const MIN_JOB_MINUTES = 15;

/**
 * A job's clock time, "HH:MM" on a 24-hour clock — the shape `site-jobs.mjs`
 * keeps under the same name; this module may not import from the root, so
 * the twin is held together by a test.
 */
export const AT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * The longest interval a job may run at, and the value a ONE-TIME job's
 * interval is forced to. `site-jobs.mjs` (`MAX_EVERY_MINUTES`) is the
 * authority; this module may not import from the root, so the number is
 * repeated here and a test holds the two together — and the test matters more
 * than usual for this one, because the forcing is a FAIL-SAFE: if the two ever
 * drift apart, a one-time job whose `on` is lost degrades to whatever number
 * THIS file happens to hold.
 */
export const MAX_JOB_MINUTES = 60 * 24 * 31;

/**
 * The single date a one-time job runs, "YYYY-MM-DD" — the shape
 * `site-jobs.mjs` keeps under the same name; the twin is held by a test.
 */
export const ON_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * That date as a comparable number (`20261003`), or null if it is not a real
 * calendar day — `ON_RE` admits `2026-13-45`, so the shape is not the answer.
 *
 * A NUMBER RATHER THAN A `Date`, because the only thing anything here does
 * with it is compare it against today in the site's own zone, and `YYYYMMDD`
 * orders exactly as the calendar does. Going through `Date` would drag a zone
 * into a comparison between two dates that are both already IN that zone —
 * and `Date.UTC(1, 0, 1)` silently means 1901, which is how a well-formed
 * early year gets reported as invalid.
 */
export function onceDay(s) {
  const m = ON_RE.exec(String(s || ""));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return null;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const len = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= len ? y * 10000 + mo * 100 + d : null;
}

/** A page is at most this many bands, top to bottom. */
export const MAX_SECTIONS = 12;

/** Seed rows an add may plant in a new table — the engine's own ceiling. */
export const MAX_ADD_SEED_ROWS = 12;

/** The kinds whose answer is a LIST of additions rather than one. */
export const LIST_ADDS = ["table", "function", "api", "job", "page", "component", "photo"];

/** The kinds that live in the site's DATABASE — the ones whose first addition makes one. */
export const BACKEND_ADDS = ["table", "function", "api", "job"];

/** The keys those kinds fold to on the designed spec — derived, so the two lists cannot drift. */
export const BACKEND_KEYS = BACKEND_ADDS.map((k) => k + "s");

/**
 * Which backend tiers a fold designed — the keys of `BACKEND_KEYS` that carry
 * at least one entry. Non-empty means the change touches the site's database,
 * which on a site without one is the moment it gets one (the route provisions
 * before it applies).
 */
/**
 * THE SPEC THE PAGE CALL READS, before the schema is applied (stage 8,
 * 2026-09-05). The apply used to run first and the page call then read the
 * database back; now the apply follows the compile, so the page writer is
 * shown the stored spec with this addition's tables, functions, connections
 * and jobs folded over it — the tables from the merge (already the union of
 * stored and designed, `mergeAddonSchema`'s answer), the other three tiers
 * this addition's first and the stored ones it did not name after. What the
 * database will hold once the apply lands, described before it does.
 */
export function unionSpec(stored, merged) {
  const s = stored && typeof stored === "object" ? stored : {};
  const m = merged && typeof merged === "object" ? merged : {};
  const nameOf = (x) => String((x && x.name) || "").toLowerCase();
  const union = (a, b) => {
    const first = (Array.isArray(a) ? a : []).filter((x) => x && nameOf(x));
    const seen = new Set(first.map(nameOf));
    return [...first, ...(Array.isArray(b) ? b : []).filter((x) => x && nameOf(x) && !seen.has(nameOf(x)))];
  };
  return {
    ...s,
    tables: Array.isArray(m.tables) ? m.tables : (Array.isArray(s.tables) ? s.tables : []),
    functions: union(m.functions, s.functions),
    apis: union(m.apis, s.apis),
    jobs: union(m.jobs, s.jobs),
  };
}

export function backendDesigned(designed) {
  const d = designed && typeof designed === "object" ? designed : {};
  return BACKEND_KEYS.filter((k) => Array.isArray(d[k]) && d[k].length > 0);
}

/**
 * Does this set of cleaned answers change NO page?
 *
 * A scheduled job runs on a timer and an `internal` function is called by the
 * platform, never by a page — so a message that adds only those has nothing
 * for the page call to write and nothing to publish: the database changes,
 * the site's pages do not, and the route answers without a compile. Anything
 * else — a table (shown somewhere), a connection (read by a page), a function a
 * page calls, a page, a component, a code, a scene — is a page change.
 * Nothing at all is not pageless: an empty answer is the route's `declined`.
 */
export function pageless(answers) {
  const list = Array.isArray(answers) ? answers.filter((a) => a && typeof a === "object" && a.kind) : [];
  if (!list.length) return false;
  return list.every((a) => {
    if (a.kind === "job") return true;
    if (a.kind !== "function") return false;
    const fns = Array.isArray(a.value) ? a.value : [];
    return fns.length > 0 && fns.every((f) => f && f.internal === true);
  });
}

/* ------------------------------------------------------------------ the adds */

/**
 * WHERE A DISPATCHED ADD'S WORK REALLY HAPPENS.
 *
 * `photo` → `picture`: a photograph on a page that has none is the picture
 * rung's job — it already places one, prices it against the real balance and
 * refuses honestly when the image balance is empty — and this step never buys
 * a photograph (`images: 0` on its page call, the rule the edit path follows
 * too). The route answers an escalate naming that layer, and the browser hops
 * there with the same sentence, the way an edit hops sideways.
 *
 * KEYED BY GROUP NAME, exactly as `LANE_LAYER` is: `elsewhere` → the layer.
 */
export const ADD_LAYER = { picture: "picture" };

/**
 * ── SIX THINGS A SITE CAN LACK, AND THE RULE FOR ADDING EACH ────────────────
 *
 * The list is the intent router's own promise (`site-ask.mjs`: "a page it has
 * no page for, a table it needs to STORE something it has no table for, or a
 * section, a QR code, a 3D scene, a form, a map or a photograph on a page that
 * does not have one"). A section, a form and a map are COMPONENTS — the
 * owner's framing (2026-09-02): "section is just adding a new component, so
 * its a tsx step that adds components". The page is source; what is added to
 * it is a component, picked from the kit by name or written for this site
 * when the kit has not got it, and the step that writes pages puts it in the
 * tsx. The rest are here by name. Order is run order: a table before the page
 * that shows it, so the page call sees the schema; a code and a scene after
 * the page they land on.
 *
 * `hint`  — one line, for the picker: how a customer's sentence points here.
 * `shape` — this kind's own object: what designing the addition means.
 * `add`   — the four rule parts (`is` · `yours` · `wide` · `keep`), the
 *           `site-lanes.mjs` form, because a rule kept as one paragraph is a
 *           rule whose missing half nobody notices. `wide` names how THIS kind
 *           gets over-answered.
 */
const ADDS = {
  table: {
    // A FEATURE THAT NEEDS STORAGE NEEDS A TABLE WHETHER OR NOT ANYBODY SAID
    // "DATABASE" (owner, 2026-09-13). The old hint listed the nouns — bookings,
    // orders, enquiries — and a customer asking for "a members area" or "let
    // people save their favourites" names none of them. The picker is the one
    // call that decides whether this step runs at all, so a feature whose
    // storage is implied rather than stated was never routed here.
    hint: "Something the site has to STORE that it has no table for. Say `table` whenever the feature CANNOT WORK " +
      "WITHOUT REMEMBERING SOMETHING BETWEEN VISITS, whether or not they mention a database, storing or a table: " +
      "bookings, orders, enquiries, listings, a price list the owner edits — and also sign-in, accounts, members, " +
      "profiles, saved items, favourites, a wishlist, reviews, comments, messages, applications, registrations, " +
      "anything \"my\" or \"their\" (my bookings, their orders), and anything the owner edits later without asking " +
      "us. A form that SENDS somewhere needs one. A page that only shows words does not.",
    // THE COVERAGE METADATA RIDES THIS KIND'S TOOL. One flag rather than a
    // second tool builder: a kind that should also answer it sets this, and
    // `addTool` does the rest. Only `table` today — it is the step where a
    // requirement is most often bigger than what the tool can express.
    requirements: true,
    shape: {
      type: "array",
      maxItems: MAX_ADD_TABLES,
      items: {
        type: "object",
        properties: {
          // THE ONE SHAPE OF A TABLE, shared with the build — what a table IS is
          // the same whether a site is being invented or added to.
          table: TABLE_ITEM,
          seed: {
            type: "array",
            items: { type: "object" },
            description:
              "Starter rows for the new table when it is one the business PUBLISHES and visitors read (a price " +
              "list, a menu, a roster) — three to six realistic rows using only the columns declared above, " +
              "written for this business. Nothing can write to such a table after this step, so an unseeded " +
              "one is an empty list forever. Leave it out for a table visitors SUBMIT to.",
          },
          shows: {
            type: "string",
            description:
              "The page that lists it or collects it, as its route — \"/\" for the home page, \"/book\". One of " +
              "the pages the site has, or a page being added in this same change.",
          },
          // WHY A SUPPORTING TABLE EXISTS (owner, 2026-09-13). The old ceiling
          // was a COUNT — "as many tables as the things they named, and not one
          // more" — which is a rule against the smallest complete model, not
          // for it: a bookings table that needs a services table to point at
          // was one table over the line. Replacing the count with a
          // justification keeps the same wall (a table nobody can justify is
          // still refused) without forbidding the one the model is right about.
          because: {
            type: "string",
            description:
              "For a SUPPORTING table only — one they did not name, that another table here needs to work. One " +
              "short clause saying which table needs it and what breaks without it: \"bookings point at a slot, " +
              "and without slots there is nothing to stop two people taking the same one\". Leave it out for a " +
              "table they asked for by name. A supporting table you cannot finish this sentence for is one to " +
              "leave out.",
          },
        },
        required: ["table"],
      },
    },
    add: {
      // WORK OUT THE REQUIREMENT FIRST, THEN THE TABLES (owner, 2026-09-13).
      // The old sentence asked for "the tables this change needs", which is the
      // ANSWER — so a model that read the ask narrowly designed a narrow table
      // and nothing recorded what it had not covered.
      // ONE LINE PER PART. `composeRule` joins the four with a newline and the
      // guard splits on one to count them, so a part carrying its own newline
      // reads as several parts and a missing one stops being detectable. The
      // four aspects are separated inline instead.
      is: "The data this change needs, designed as tables. Before you name a single table, work out four things " +
        "about what they asked for — including what it IMPLIES rather than only what it says. " +
        "DATA: what has to be remembered between visits for this to work at all. " +
        "RELATIONSHIPS: what points at what, and which of those the database should REFUSE to break. " +
        "PERMISSIONS: who may read each thing and who may write it — the public, a signed-in member about " +
        "their own rows, members about each other's, the owner alone. " +
        "RULES: what must never be allowed to happen — the same slot taken twice, a negative quantity, an " +
        "order with no customer, a row nobody may edit after it is made. " +
        "Then answer the tables that carry all four: what each is called, its columns, who may read and write it, " +
        "and the guarantees the database keeps for it. One entry per table.",
      yours:
        "EVERY TABLE IS YOURS TO DESIGN: its columns, its access, a unique slot, a confirmation email, " +
        "payment, a public view — every guarantee the shape offers is available, and you may ALSO name a " +
        "table the site already has to give it a new column, PAYMENT or a public view. On a table that " +
        "already exists only those three are taken; its access, read and write levels are the site's own and " +
        "an answer for them is discarded.",
      // THE SMALLEST COMPLETE DATA MODEL, NOT A COUNT OF WHAT THEY SAID
      // (owner, 2026-09-13). The old ceiling was "as many tables as the things
      // they NAMED to store, and not one more", which refuses the supporting
      // table the feature cannot work without — a bookings table pointing at a
      // slot nothing defines. The wall is not weaker: every table still has to
      // be one the feature genuinely needs, and a supporting one has to say in
      // `because` what breaks without it.
      wide:
        "THE SMALLEST SET OF TABLES THAT MAKES WHAT THEY ASKED FOR ACTUALLY WORK — no smaller, and not one " +
        "table larger. Smallest: leave out anything the feature runs perfectly well without. Complete: a table " +
        "another one has to point at is part of the feature, not an extra, and leaving it out ships something " +
        "that cannot do what they asked. \"Add a booking form\" is usually a bookings table alone; \"let people " +
        "book a slot and stop two people taking the same one\" needs the slot to be a real thing there is one " +
        "of. Every table you add that they did not name must fill in `because` with what breaks without it — " +
        "and a supporting table you cannot finish that sentence for is one to leave out. Do not round the " +
        "model off: no customers, staff or categories table because a real system would have one. Do not " +
        "redesign what the site already stores: the tables it has are listed with their columns, their access " +
        "and their guarantees, and a second table for a thing one of them already holds is a site that " +
        "disagrees with itself.",
      keep:
        "NOTHING ELSE ABOUT THE SITE MOVES. This is the tables and their rows; the pages that show them are " +
        "designed beside them and written by the next step. If the change needs no table — it is words, a " +
        "component, a code — answer nothing here. " +
        // THE COVERAGE LIST IS ANSWERED EVEN WHEN NO TABLE IS (owner,
        // 2026-09-13). The shape it matters most in is the one where this step
        // designs nothing: a requirement the tool cannot express is exactly the
        // case where `tables` is empty and, until now, nothing said why.
        // ONE LINE, like every other part — see the note on `is` above.
        "AND ANSWER `requirements` WHATEVER ELSE YOU ANSWER, including when you answer no tables at all: it " +
        "is the list of what this change has to be able to do and what became of each one, and a requirement " +
        "you could not express is `unsupported` with a reason, never a requirement left out.",
    },
  },
  // ── THE OTHER THREE TIERS OF THE BACKEND (owner, 2026-09-03) ────────────
  //
  // Each is the build's own item shape (`site-table.mjs`), wrapped in this
  // step's framing: what THIS change needs, on a site that already exists. They
  // run after `table` and before `page` because a page calls a function or
  // reads a connection that has to exist first, exactly as it shows a table.
  function: {
    hint: "Something the DATABASE has to do for a page that a table's access alone cannot: look a booking up by its claim link, cancel or move one, take a booking into a slot that holds N people, receive data another system POSTs in (a `hook_` function — the platform checks the sender's signature before it runs), or housekeeping a job runs on a timer (clear out rows older than thirty days). SQL the site's own database runs.",
    // THE COVERAGE LIST RIDES THIS KIND TOO (2026-09-14). It was on `table`
    // alone, so five of the six steps that design something had no way to say
    // what they could not deliver — and the one thing the customer most needs
    // to hear is the thing the step could not express.
    requirements: true,
    shape: {
      type: "array",
      maxItems: MAX_ADD_FUNCTIONS,
      items: FUNCTION_ITEM,
    },
    add: {
      is: "The Postgres functions this change needs — each with its name, its arguments matched to the columns they are compared against, what it returns, and its SQL body over the site's own tables.",
      yours:
        "EVERY FUNCTION IS YOURS TO WRITE: a claim lookup, a cancel, an amend, a capacity-locked booking, a " +
        "`hook_` receiver for another system, an `internal` builder a job calls. Its arguments are typed as the " +
        "COLUMNS they meet — text for a date, a time, a token; integer for a count — and its body is plain SQL " +
        "over the columns the site's tables are listed with. A scheduled job's builder is `internal: true`, takes " +
        "no arguments and returns json: an array of messages, empty when nothing is due. " +
        MESSAGE_CONTRACT +
        " A job's " +
        "HOUSEKEEPING function — clear out rows older than thirty days, drop expired holds, close stale carts — is " +
        "`internal: true` too, does its DELETE or UPDATE, and returns json {\"did\": \"what it did\"} " +
        "(\"cleared 12 expired holds\"), so the owner's panel can say so.",
      wide:
        "AS MANY FUNCTIONS AS THEY ASKED FOR — what the change needs — AND NOT ONE MORE. A lookup by claim link is one function; " +
        "\"and let them cancel or move it\" is three. Never a function for something a table's read level " +
        "already gives a page for free, and never a duplicate of one the site lists — that one exists and a " +
        "page can call it already.",
      keep:
        "NOTHING ELSE ABOUT THE SITE MOVES. This is the functions; the table they read is the site's own or " +
        "designed beside them, and the page that calls them is written by the next step. If the change needs " +
        "no function — a page can do it with the hooks it already has — answer nothing here.",
    },
  },
  api: {
    hint: "An OUTSIDE service a page reads live — today's exchange rate, a courier's slots, a supplier's stock, the weather — with the owner's own key kept server-side. Not for anything a table can hold.",
    // THE COVERAGE LIST RIDES THIS KIND TOO (2026-09-14). It was on `table`
    // alone, so five of the six steps that design something had no way to say
    // what they could not deliver — and the one thing the customer most needs
    // to hear is the thing the step could not express.
    requirements: true,
    shape: {
      type: "array",
      maxItems: MAX_ADD_APIS,
      items: API_ITEM,
    },
    add: {
      is: "The outside connections this change needs — each with the name a page calls it by, the whole request with `{{SECRET}}` where the owner's key goes and `{{param.x}}` where a page varies it, and how long one answer stays good.",
      yours:
        "EVERY CONNECTION IS YOURS TO WRITE, against the service's real request shape: the URL, the method a " +
        "READ needs, the headers, the parameters a page may pass, the cache window. The owner pastes the key " +
        "into Secrets; the platform makes the call and hands the page the answer as JSON.",
      wide:
        "AS MANY CONNECTIONS AS THE THINGS THEY NAMED, AND NOT ONE MORE. One outside service is one " +
        "connection. NEVER one for data the site holds or could hold in a table, and never one that DOES " +
        "something on the other side — an order, a message, a reservation — every answer here is cached and " +
        "would run sometimes and not others.",
      keep:
        "NOTHING ELSE ABOUT THE SITE MOVES. This is the connections; the page that reads them is written by " +
        "the next step. If the change needs no outside data — it is words, a table, a component — answer " +
        "nothing here.",
    },
  },
  job: {
    hint: "Something the site does ON A TIMER with nobody there — a reminder text the day before, a weekly digest to the owner, chasing an unpaid invoice, clearing out records older than thirty days. A job runs an internal database function that returns the messages to send (or, for housekeeping, {\"did\": …} saying what it did), so a job is a `job` AND a `function` unless the site already lists one that does it.",
    // THE COVERAGE LIST RIDES THIS KIND TOO (2026-09-14). It was on `table`
    // alone, so five of the six steps that design something had no way to say
    // what they could not deliver — and the one thing the customer most needs
    // to hear is the thing the step could not express.
    requirements: true,
    shape: {
      type: "array",
      maxItems: MAX_ADD_JOBS,
      items: JOB_ITEM,
    },
    add: {
      is: "The scheduled jobs this change needs — each with its name, the internal function that returns its messages, how often it runs in minutes, and for a daily or slower job the time of day it runs.",
      yours:
        "EVERY JOB IS YOURS TO SET: what it is for, which function decides who is due and what it says, and " +
        "how often — 1440 for a daily reminder, 10080 for a weekly digest — with `at` for the time of day a daily " +
        "or slower job runs (\"09:00\" for a morning reminder). The function it names must exist: " +
        "one the site lists, or one you are declaring in this same change with `internal: true`, taking no " +
        "arguments and returning json — an array of messages, empty when nothing is due; or, for a " +
        "job that does work rather than sending (clearing out old rows), {\"did\": \"what it did\"}. " +
        MESSAGE_CONTRACT,
      wide:
        "AS MANY JOBS AS THEY ASKED FOR — the things that happen on a timer — AND NOT ONE MORE. A day-before reminder " +
        "is one job. Never one for a site that only takes enquiries, and never more often than the message " +
        "needs — the platform will not run one under 15 minutes.",
      keep:
        "NOTHING ELSE ABOUT THE SITE MOVES. A job changes no page; the owner adds their email or SMS key in " +
        "Settings and it starts sending. If the change is not something that happens on a timer, answer " +
        "nothing here.",
    },
  },
  page: {
    hint: "A PAGE the site does not have — a new address of its own: a gallery page, an about page, a pricing page. Not a band on a page it has.",
    // THE COVERAGE LIST RIDES THIS KIND TOO (2026-09-14). It was on `table`
    // alone, so five of the six steps that design something had no way to say
    // what they could not deliver — and the one thing the customer most needs
    // to hear is the thing the step could not express.
    requirements: true,
    shape: {
      type: "array",
      maxItems: MAX_ADD_PAGES,
      items: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "The page's route, starting with a slash: \"/gallery\", \"/about\", \"/prices\". Lowercase, hyphens, " +
            "one or two words. Not one the site already has — those are listed.",
        },
        name: { type: "string", description: "What the page is called in the menu and its title — two or three words." },
        purpose: {
          type: "string",
          description:
            "One line: what THIS page is organised around — the one thing a visitor comes to it to do or see, " +
            "and that everything on it supports.",
        },
        sections: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_SECTIONS,
          description:
            "The page top to bottom, one line per band: what each band shows, in order. Numbered by position " +
            "when it is written, so the order here IS the layout. A page is a few bands, not a dozen.",
        },
        components: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_COMPONENTS,
          description:
            `At most ${MAX_COMPONENTS} components from the kit — what this page needs, and no more. THIS IS THE ` +
            "WHOLE SET: the step that writes the page is shown the props of what you name here and nothing " +
            "else, so a part you leave out is one it cannot use. Name `site-chrome` — the header and footer " +
            "every page renders itself. Naming a component that does not exist is refused and costs nothing.\n" +
            "Pick from these — the whole kit, most-commonly-needed first:\n" + COMPONENT_MENU.join(", ") + ".",
        },
        // THE ESCAPE HATCH FOR THE KIT, answered right after `components` for
        // the build's reason: by a model that has just searched the kit and
        // come up short. The shared ITEM shape; this path's own framing.
        tsx: {
          type: "array",
          items: TSX_ITEM,
          maxItems: MAX_TSX,
          description:
            "ONLY when this page needs a part the kit has not got — something you searched the list above for " +
            "and could not find. Each entry is real code that will be written for this site; leave the field " +
            "out for nearly every page.",
        },
        link: {
          type: "string",
          description:
            "Where a visitor finds it — \"the header menu\", \"a button on the home page's closing band\". A page " +
            "nobody links to is a page nobody can reach; the page that carries the link is edited to add it.",
        },
      },
      required: ["path", "name", "purpose", "sections", "components"],
      },
    },
    add: {
      is: "The new pages — one entry per page: its address, its name, what it is organised around, its bands top to bottom, the kit parts it is built from, and where a visitor finds it.",
      yours:
        "EVERY PAGE IS YOURS TO PLAN, from the kit's 2,112 parts or a part written for this site when the " +
        "kit falls short. Any number of bands, any arrangement, any part — whatever the pages they asked for " +
        "really need.",
      wide:
        "AS MANY PAGES AS THEY ASKED FOR, AND NOT ONE MORE. \"Add a gallery page\" is a gallery page; \"an " +
        "about page and a pricing page\" is two. Not a contact page thrown in to go with them — every page " +
        "they did not ask for is one they will pay to have written. And a page is a few bands doing one job, " +
        "not the whole site again with a different heading: what the home page already says stays on the " +
        "home page.",
      keep:
        "THE REST OF THE SITE STAYS AS IT IS. The one existing page that changes beside these is the page that " +
        "links to them, and only its links. If what they asked for belongs on a page the site already has, " +
        "answer nothing here — that is a component, not a page.",
    },
  },
  // ── A SECTION IS A COMPONENT, AND ADDING ONE IS A TSX STEP ─────────────
  //
  // Owner, 2026-09-02: "section is just adding a new component, so its a
  // tsx step that adds components". The page is a tsx file made of
  // components; what a customer calls a section, a form, a map or an FAQ is
  // a COMPONENT that page does not have yet. So this kind names THE
  // component — one of the kit's 2,112 parts by name, or one written for
  // this site when the kit has not got it (the `tsx` escape hatch, the
  // build's own) — and where on which page it goes. The step that writes
  // pages puts it in the tsx; a part written for this site lands in `parts`.
  component: {
    hint: "A NEW COMPONENT on a page the site already has — what a customer calls a section, a band or a block: testimonials, a form, a map, an FAQ, opening hours, a price list, a gallery strip, a countdown. From the kit, or written for this site when the kit has not got it. The page existing does not make it an edit; the component is not on it yet. And a section LIKE it already being on the page does not either: that is a SECOND one, added after the first, which stays exactly as it is — and built from the SAME component the first is built from, laid out the same way.",
    // THE COVERAGE LIST RIDES THIS KIND TOO (2026-09-14). It was on `table`
    // alone, so five of the six steps that design something had no way to say
    // what they could not deliver — and the one thing the customer most needs
    // to hear is the thing the step could not express.
    requirements: true,
    shape: {
      type: "array",
      maxItems: MAX_ADD_COMPONENTS,
      items: {
      type: "object",
      properties: {
        page: {
          type: "string",
          description: "The page it goes on, as its route — \"/\" for the home page. One of the pages the site has.",
        },
        where: {
          type: "string",
          description:
            "Where on that page, in the page's own terms — \"after the opening band\", \"above the contact " +
            "details\", \"at the bottom, before the footer\". Say it by what is around it.",
        },
        does: {
          type: "string",
          description: "One line: what this component shows and what it is for — the thing a visitor gets from it.",
        },
        components: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_COMPONENTS,
          description:
            "THE KIT COMPONENT THIS IS, by name — usually exactly one, plus a part it needs around it at most. " +
            "The step that writes the page is shown the props of what you name here and nothing else, so the " +
            "name IS the addition. Naming a component that does not exist is refused and costs nothing; if the " +
            "kit has not got it, leave this empty and write it in `tsx` instead.\n" +
            "Pick from these — the whole kit, most-commonly-needed first:\n" + COMPONENT_MENU.join(", ") + ".",
        },
        tsx: {
          type: "array",
          items: TSX_ITEM,
          maxItems: MAX_TSX,
          description:
            "A COMPONENT WRITTEN FOR THIS SITE, only when the kit has not got it — something you searched the " +
            "list above for and could not find. It is real code that will be written, so name it, say what it " +
            "does and what the kit could not, and give its props; the page is written to call it.",
        },
      },
      required: ["page", "does"],
      },
    },
    add: {
      is: "The components the pages are getting — one entry per component: which page, where on it, what it shows, and which component it is: a kit part by name, or one written for this site.",
      yours:
        "ANY COMPONENT AT ALL: a form, a map, a strip of photographs, a table of prices, a set of quotes, a " +
        "timeline, a calendar, a countdown, something no other site has — one of the kit's 2,112 parts, or " +
        "written for this site when none of them is it. Put each wherever on its page it belongs.",
      wide:
        "AS MANY COMPONENTS AS THEY ASKED FOR, ON THE PAGES THEY NAMED, AND NOT ONE MORE. \"Add testimonials\" " +
        "is one testimonials component; \"testimonials and an FAQ\" is two. Not a trust strip and a call to " +
        "action thrown in to round them off, and not the same thing on every page when one page was meant. " +
        "Do not re-plan a page around what is added: what it already has stays where it is, and the new " +
        "component goes between. A form that SENDS somewhere needs a table the site has; on a site with no " +
        "database, a component that submits is a control that silently does nothing — choose one that does " +
        "not, or answer nothing.",
      keep:
        "EVERYTHING ELSE ON THOSE PAGES — every other component, every sentence — comes back exactly as it is. " +
        "A component like the one asked for already being on the page is not a reason to answer nothing and " +
        "not a reason to change it: answer the new one, placed after the one that is there, as a second one, " +
        "BUILT FROM THE SAME COMPONENT the first is built from — the note below says what each page is built " +
        "from; name that one, never another that shows the same kind of thing. " +
        "If what they asked for is a whole page of its own, answer nothing here; that is a page, not a component.",
    },
  },
  qr: {
    hint: "A QR CODE on the site — a square a visitor scans to join the wifi, ring the number, open the menu, find the place. Another beside the codes it has is fine: each has its own name and points somewhere none of the others do.",
    shape: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "A short handle for this code, unique on the site: \"wifi\", \"booking\", \"menu\". Lowercase letters " +
            "and digits only, and not one the site already uses.",
        },
        points: {
          type: "string",
          description:
            "The exact string the code carries: a full URL, `tel:` a number, `mailto:` an address, " +
            "`WIFI:T:WPA;S:<network>;P:<password>;;`, `geo:lat,lng`, or plain text. One of the site's OWN pages " +
            "is a real destination: answer its route (\"/\", \"/prices\") and it is resolved against the site's address.",
        },
        label: { type: "string", description: "The few words printed beside it, telling a visitor why they would scan it." },
        page: { type: "string", description: "The page it goes on, as its route — \"/\" for the home page." },
        where: { type: "string", description: "Where on that page — \"in the contact band\", \"beside the opening hours\"." },
      },
      required: ["name", "points", "label"],
    },
    add: {
      is: "The code the site is getting — its name, what scanning it does, the caption beside it, and where on which page it sits.",
      yours:
        "BOTH HALVES AND THE PLACE ARE YOURS: point it at whatever they named, caption it in the site's own " +
        "voice, put it where a visitor standing in front of the business would look for it. The code itself is " +
        "drawn for you from these; you never draw one.",
      wide:
        "NEVER INVENT THE DESTINATION. A QR is the one thing on a page a visitor cannot read before acting on " +
        "it, so a made-up URL or a guessed wifi password sends real people somewhere that does not exist. The " +
        "site's own pages are NOT invented: its address and its routes are in front of you, so a code that opens " +
        "one of them points at that page by its route. If their message gives you no real destination — not one " +
        "of the site's pages, not a number, address, network or link they gave — answer nothing and the site is " +
        "left as it is; that is the right answer, not a failure.",
      keep:
        "ONE NEW CODE, AND NOTHING ELSE ON THE PAGE MOVES. Placing it is the only change to the page it lands " +
        "on, and the codes the site already has stay exactly where and what they are.",
    },
    // ── AND IT MAY SAY WHICH REQUEST ITS CODE ANSWERS (2026-09-19) ───────────
    //
    // Owner: *"Let the QR step associate the requirement ID it received with
    // the actual kind and item it produced, using the existing reconciliation
    // mechanism. Start with QR only."*
    //
    // THE STEP WAS ALREADY TOLD AND HAD NO WAY TO ANSWER. `requirementBrief` is
    // composed for EVERY kind in the route's loop and handed over as `brief`,
    // so the `qr` designer has been reading *"[page#0] A QR code opens the
    // gallery page."* since that brief went general — and with no
    // `requirements` property on its tool it could not echo the id back. So run
    // 51's hand-off had no association available to it at all, and the count
    // that stood in for one is what the round before this removed.
    //
    // NOTHING NEW IS BUILT FOR IT. `cleanRequirements` stamps `from: "qr"`,
    // `referenceOf` reads `{kind, item}` and `reconcileHandoffs` joins on the
    // echoed id under its four existing conditions — including that the
    // answering entry's OWN implementation must be found, which is what keeps a
    // wrong item from settling anything. The cap stands too: an echo earns the
    // hand-off `configured` and never `delivered`, because a code's destination
    // is configuration read back and nothing has scanned the drawing.
    //
    // QR ONLY, DELIBERATELY. `three` and `photo` are the other two kinds off
    // `REQUIREMENT_ADDS` and neither is widened here: the owner asked to start
    // with one, and `photo` would gain nothing anyway — it is in `OPAQUE_KINDS`,
    // so its implementation is never found and an echo could never reconcile.
    requirements: true,
  },
  three: {
    hint: "A 3D or WebGL scene on the site — a product you can turn, a model of the building, a piece the business makes, drawn live. Only when the site has none.",
    shape: {
      type: "object",
      properties: {
        scene: {
          type: "string",
          description:
            "What it shows and how it moves, in one or two sentences, and where on the page it sits: \"the " +
            "chair, turnable by dragging, on the product band\". What, not how — the step that writes the page " +
            "builds it.",
        },
        page: { type: "string", description: "The page it goes on, as its route — \"/\" for the home page." },
      },
      required: ["scene"],
    },
    add: {
      is: "The scene the site is getting — what it shows, how it moves, and where on which page it sits.",
      yours:
        "ANY SCENE THE BUSINESS IS ABOUT: the thing they make, turnable; the room, walkable; the piece, lit. " +
        "Describe it as a customer would see it and leave the building of it to the next step.",
      wide:
        "ONE SCENE, EARNING ITS PLACE. A canvas is the heaviest thing on a page and costs a visitor real " +
        "battery, so it shows THE thing the business sells — never a logo, a heading, a background effect or " +
        "decoration a photograph would do as well. One, where they asked for it; not one per band.",
      keep:
        "NOTHING ELSE ON THE PAGE MOVES. The scene sits where you said; the words, the bands and the look " +
        "around it are the site's own and come back untouched.",
    },
    // ── AND THIS STEP CAN ANSWER A REQUIREMENT NOW (2026-09-19) ────────────
    //
    // Owner: *"QR gained requirements support; three and photo were recorded as
    // still unable to raise or answer a requirement. Verify that this remains
    // true before changing anything."* VERIFIED by driving the tools —
    // `addTool("three").input_schema.properties` was `["three"]` with no
    // `requirements` beside it — so the gap was real and this is the flag that
    // closes it.
    //
    // NOTHING NEW IS BUILT FOR IT, exactly as the `qr` round found. `three` was
    // ALREADY in `APPLIED_KINDS` and in `SITE_KINDS`, and `appliedFacts` and
    // `existingFacts` have both emitted `{kind:"three", name:"three"}` since
    // they were written — so a reference resolves in both haystacks and the
    // only thing missing was somewhere for the step to echo the id it is
    // already handed. `cleanRequirements` stamps `from: "three"`, `referenceOf`
    // reads `{kind, item}` and `reconcileHandoffs` joins under its four
    // existing conditions.
    //
    // THE ITEM IS ALWAYS `three`, and that is the kind's own identity rather
    // than a placeholder: a site carries at most one scene (`SINGLE_FIELDS`),
    // so there is no second scene an item name could distinguish, and both
    // haystacks already use the kind as the name for that reason.
    //
    // THE CAP STANDS: an echo earns the hand-off `configured` and never
    // `delivered`. A scene's `holds` carries `declared` and, when a page
    // really draws the canvas, `onpage` and the routes — both ARTIFACT facts —
    // while `checked` stays empty, because nothing here starts a WebGL context
    // and a `<Canvas>` in the source is not a scene a visitor can see.
    requirements: true,
  },
  /* ---- the one whose home depends on who is making the place for it ---- */
  //
  // ── THE PICTURE RUNG FILLS A SLOT; THIS STEP MAKES ONE (2026-09-17) ───────
  //
  // Owner: *"Placeholders and asking the customer to repeat the photo request
  // do not complete that capability."*
  //
  // `photo` dispatched ALWAYS, and beside another kind that was the one answer
  // it could not honour. MEASURED through the real route before this changed:
  // *"add a gallery page with a photograph of the workshop on it"* routed
  // `kinds: ["page"] / skipped: ["photo"]`, published a gallery page whose
  // every picture is `<SafeImage src="">`, bought nothing, and told the
  // customer to ask for the photograph again.
  //
  // THE LINE IS WHO MAKES THE SLOT, and it is the same line `runPictureEdit`
  // already draws with `needs-place`: that rung fills a `<SafeImage>` that
  // EXISTS, and escalates when there is none. A photograph asked for beside a
  // page or a component is a slot THIS change is writing, so this is the only
  // step that can create it and fill it in one request — and `photo` ALONE is
  // still the picture rung's, which prices one against the real balance and
  // refuses honestly. `PLACING_ADDS` and `addLayerIn` below are that rule.
  //
  // IT ANSWERS WHAT `imageDirective` ALREADY TAKES — `{page, describe}` — so
  // the shot list crosses to the page writer through the build path's own
  // reader rather than a second shape beside it.
  photo: {
    hint: "A PHOTOGRAPH on a page that has none, or one more where there are some — adding a picture. Swapping or reframing one the site has is an edit, not this.",
    elsewhere: "picture",
    shape: {
      type: "array",
      maxItems: IMAGE_CAP,
      items: {
        type: "object",
        properties: {
          page: {
            type: "string",
            description: "The page it goes on, as its route — \"/\" for the home page. One of the pages this site will " +
              "have once this change lands, including a page this same change is adding.",
          },
          describe: {
            type: "string",
            description:
              "WHAT THE PICTURE SHOWS, in a sentence — the subject, the light, the framing, as if briefing a " +
              "photographer. These exact words are the prompt an image model is PAID to draw, so write the " +
              "picture rather than the intention: \"a luthier's bench under a window, half-finished guitar " +
              "bodies clamped along it, warm afternoon light\", not \"a nice workshop photo\". " +
              "No words on the image, no logos, no text of any kind — it is a photograph.",
          },
          // ── THE ONE THING THAT TELLS TWO PICTURES APART (2026-09-19) ──────
          //
          // ⚠ REPRODUCED: two pictures on one page, one generated and one
          // refused. The route was a photograph's whole identity, so BOTH
          // requirements resolved against `/gallery` and both read as blocked —
          // the customer was told the picture that really landed was not there.
          // A route cannot separate two pictures on it, and the `describe` is
          // the prompt rather than a label (240 characters against the 80 an
          // `item` keeps, so echoing one back is silently truncated).
          //
          // A LABEL THE DESIGNER COINS, exactly as a QR code's `name` is. It is
          // not a binding — no page ever writes `SITE_PHOTOS.bench` — so it
          // exists for one purpose: to be the name a requirement points at.
          name: {
            type: "string",
            description:
              "A SHORT NAME FOR THIS PICTURE — lowercase letters, digits and single hyphens, like \"bench\", " +
              "\"oven\" or \"shop-front\". Nobody sees it; it is how you point at this one picture when a " +
              "requirement is about it, so two pictures in one answer must not share a name. Describe the " +
              "SUBJECT, not the position: \"bench\", never \"first\" or \"hero\".",
          },
        },
        required: ["page", "describe", "name"],
      },
    },
    add: {
      is: "The photographs this change buys and puts on the pages — one entry per picture: which page it goes on, and what it shows.",
      yours:
        "THE PICTURES THEMSELVES. Each one is really generated and really placed in this same change, on the " +
        "page you name — including a page this change is adding, which does not exist yet and will by the " +
        "time the picture lands.",
      wide:
        "AS MANY PHOTOGRAPHS AS THEY ASKED FOR, AND NOT ONE MORE. \"A photo of the workshop\" is ONE picture " +
        "on ONE page — not a set, not one per section, and not a hero for every page while you are there. " +
        "Each one costs the owner real money. If they said how many, that is the number; if they said \"a " +
        "photo\", it is one. Nothing decorative, and no picture on a page they did not mention.",
      keep:
        "EVERY PICTURE THE SITE ALREADY HAS stays exactly as it is — this adds, it never swaps, reframes or " +
        "removes one, and it never re-describes one that is already there. Changing a picture the site has " +
        "is an edit and belongs on another rung; answer nothing for it here.",
    },
    // ── AND THIS STEP CAN ANSWER A REQUIREMENT NOW (2026-09-19) ────────────
    //
    // VERIFIED FIRST, as the owner asked: `addTool("photo")` offered
    // `["photo"]` and nothing else, so the gap was real.
    //
    // WHAT IT TOOK, and it is more than the flag `three` needed. A photograph
    // had no identity at all — `photo` was in `OPAQUE_KINDS` precisely because
    // "a photo is a URL inside a file", which is true and is the wrong thing
    // to identify one BY: this designer answers `{page, describe}` and cannot
    // know the url, which the provider mints after it has spoken.
    //
    // ⚠ AND THE PLACEMENT ALONE WAS TOO COARSE (corrected 2026-09-19). A route
    // is the identity of WHERE, and two pictures can share one — so a page with
    // one picture generated and one refused had both requirements resolve
    // against the same name, and the one that really landed read as failed. A
    // requirement points at a picture by its own `name` now, and at a route
    // when it is about all of them: a combined need stays incomplete while one
    // is missing, and the individual need that succeeded keeps its own answer.
    //
    // BOTH IDENTITIES ARE THE DESIGNER'S OWN VALUES, which is what keeps the
    // reference explicit rather than a count or a word match — and they cannot
    // collide, because a route starts with `/` and `PHOTO_NAME` forbids one.
    requirements: true,
  },
};

/** Every kind, in one order, and it is the order they RUN in — see `readAdds`. */
export const ADD_KINDS = Object.keys(ADDS);

/** The kinds this module designs itself, always. Derived, so a kind cannot be acting-but-unreachable. */
export const OWN_ADDS = ADD_KINDS.filter((k) => !ADDS[k].elsewhere);

/**
 * The kinds this module designs ONLY when this same change is making the place
 * for them — and dispatches otherwise (2026-09-17).
 *
 * DERIVED FROM THE TABLE, never typed: a kind is here when it names a layer AND
 * carries a tool of its own, which is exactly "it can be answered here and it
 * has somewhere else to go". `photo` alone today.
 *
 * ⚠ `&& ADDS[k].shape` IS MEASURED INERT AND IS KEPT — DECLARED, because a
 * sweep cannot say so and the next session deletes what nothing appears to
 * need. `photo` is the only kind with an `elsewhere` today, so
 * `DISPATCHED_ADDS` is `[]` and both filters answer `["photo"]` with the clause
 * and without it. What makes it inert is a NEIGHBOUR'S state — which kinds the
 * table happens to hold — and not this expression, so it comes back the day a
 * kind dispatches with no tool of its own: that kind would otherwise join the
 * placing group, be asked for an answer it has no tool to give, and be dropped
 * in exactly the messages this group exists for. Its PAIR is the load-time
 * partition below (`DISPATCHED_ADDS` must carry no `requirements`, and a
 * placing kind must have a rule), which is what states the same division twice.
 */
export const PLACING_ADDS = ADD_KINDS.filter((k) => ADDS[k].elsewhere && ADDS[k].shape);

/** The kinds whose work lives on an edit rung and NOWHERE here — no tool, nothing to clean. */
export const DISPATCHED_ADDS = ADD_KINDS.filter((k) => ADDS[k].elsewhere && !ADDS[k].shape);

/**
 * THE KINDS WHOSE ANSWERS WRITE PAGE SOURCE — which is the same thing as "the
 * kinds that make a place a photograph can go".
 *
 * A `page` writes a new file and a `component` rewrites one; a table, a
 * function, a connection, a job, a QR code and a 3D scene all reach the page
 * call too, but none of them is a reason to put a PHOTOGRAPH on a page. Listed
 * rather than derived because there is no flag on the table that says it: what
 * these two share is the customer's own framing — they are the two asks that
 * change what a visitor LOOKS at.
 */
export const MAKES_PAGES = ["page", "component"];

/**
 * The kinds whose tool carries the coverage list (owner, 2026-09-13).
 *
 * DERIVED FROM THE TABLE, never typed again — the flag lives on the kind and
 * this reads it, so adding a second kind is one word and no list anywhere
 * disagrees with it. `table` alone today: it is the step where a requirement is
 * most often bigger than the tool can express, and the owner asked to keep this
 * change to the Tables flow. Exported so a guard asserts the tool's property
 * set against what the kind really declares rather than against a fixture.
 */
export const REQUIREMENT_ADDS = ADD_KINDS.filter((k) => !!ADDS[k].requirements);

/**
 * The edit layer this kind's work really happens on, or `null` when this
 * module does the work itself.
 *
 * `Object.hasOwn`, never truthiness: `ADDS["constructor"]` is a function and
 * would sail through a `!ADDS[k]` check — the Stripe plan lookup's bug.
 */
export function addLayer(kind) {
  if (typeof kind !== "string" || !Object.hasOwn(ADDS, kind)) return null;
  const key = ADDS[kind].elsewhere;
  return key ? ADD_LAYER[key] || null : null;
}

/**
 * WHERE THIS KIND'S WORK REALLY HAPPENS FOR *THIS* MESSAGE — the one reader
 * (2026-09-17).
 *
 * `addLayer` answers what a kind IS; this answers what it is HERE, which for a
 * `PLACING_ADDS` kind depends on the company it keeps. Beside a kind that
 * writes page source the answer is `""` — this step designs it — and alone it
 * is the layer, unchanged.
 *
 * ONE FUNCTION AND NOT THREE CONDITIONS AT THREE CALL SITES, because the route
 * asks this question in three places (the escalate, the set-aside list, and the
 * loop's own gate) and two of them disagreeing is a kind that is designed and
 * then reported as skipped, or set aside and then never designed. `addLayer`
 * stays for every caller that is asking about the KIND rather than the message.
 *
 * FAIL-CLOSED ON A MALFORMED LIST: anything that is not an array of strings
 * carries no page-writing kind, so the answer is the dispatch — which is what
 * the platform did before this existed.
 *
 * ⚠ `placing` IS A PARAMETER, AND THAT IS THE RECORDED FIX FOR AN UNDRIVABLE
 * WALL — `cleanTools(v, catalog)`'s own reason, met again. `photo` is the only
 * kind on the platform that names a layer, so `DISPATCHED_ADDS` is `[]` and the
 * membership test cannot change an answer: MEASURED over every kind against
 * nine company shapes, 81 probes and ZERO differences with it and without it.
 * A wall nobody can drive is a wall nobody is guarding, and the rule it states
 * is real — a kind that dispatches with NO tool of its own has nothing to
 * answer here, whatever company it keeps, so it must keep its layer. The
 * default is the module's own group; the argument exists so that rule can be
 * driven in a two-kind world today rather than discovered in a live one later.
 */
export function addLayerIn(kind, kinds, placing = PLACING_ADDS) {
  const layer = addLayer(kind);
  if (!layer || !placing.includes(kind)) return layer;
  const all = Array.isArray(kinds) ? kinds : [];
  return all.some((k) => MAKES_PAGES.includes(k)) ? null : layer;
}

// THE THREE GROUPS ARE A TOTAL PARTITION, checked at load: a kind in none
// answers nothing and dispatches nowhere, which is a request that vanishes.
for (const k of ADD_KINDS) {
  if (ADDS[k].elsewhere && !addLayer(k)) throw new Error("site-add: `" + k + "` dispatches nowhere");
  if (!ADDS[k].elsewhere && (!ADDS[k].shape || !ADDS[k].add)) throw new Error("site-add: `" + k + "` neither acts here nor dispatches");
  // A PLACING KIND NEEDS BOTH HALVES: a layer to go to when it is alone, and a
  // whole tool — shape AND rule — for the messages it is designed in. One
  // without the other is a kind that is silently dropped in exactly one of its
  // two cases, which is the shape this group was created to fix.
  if (PLACING_ADDS.includes(k) && !ADDS[k].add) throw new Error("site-add: `" + k + "` has a tool and no rule");
  if (!ADDS[k].hint) throw new Error("site-add: `" + k + "` has no hint for the picker");
  // A DISPATCHED KIND HAS NO TOOL OF ITS OWN, so it has nowhere to answer a
  // coverage list and `addTool` would throw before it could. Caught at LOAD,
  // where the name is still in hand, rather than on the first customer who
  // asks for that kind.
  if (DISPATCHED_ADDS.includes(k) && ADDS[k].requirements) throw new Error("site-add: `" + k + "` dispatches and cannot answer requirements");
}

/* --------------------------------------------------------------- the picker */

/**
 * The picker's tool: a list of kinds, and nothing else.
 *
 * BUILT FROM THE KINDS IN ONE LOOP, so the enum and the described names cannot
 * disagree. A kind with no entry throws HERE, where the name is still in hand.
 */
export function pickTool(kinds = ADD_KINDS) {
  const list = (Array.isArray(kinds) ? kinds : []).filter((k) => typeof k === "string" && k);
  if (!list.length) throw new Error("pickTool: no kinds");
  const lines = list.map((k) => {
    if (!Object.hasOwn(ADDS, k)) throw new Error("pickTool: no add for kind: " + k);
    return "\"" + k + "\" — " + ADDS[k].hint;
  });
  return {
    name: "pick_adds",
    description: "Name what this message is asking to ADD to the site.",
    input_schema: {
      type: "object",
      properties: {
        kinds: {
          type: "array",
          minItems: 1,
          maxItems: MAX_ADDS,
          items: { type: "string", enum: list },
          description:
            "The kind or kinds of thing this message asks to add — EVERY kind it asks for, and no kind it does " +
            "not. One is the ordinary answer; two or more when the thing they asked for really is more than " +
            "one kind of thing: \"a booking page\" is a `page` AND a `table` (the form has to send its bookings " +
            "somewhere); \"a testimonials section\" is a `component` alone; \"an about page, a pricing page and " +
            "a QR code\" is `page` and `qr` (the number of pages is the page designer's business, not yours); " +
            "\"remind students the day before\" is a `job` AND a `function` (the job runs a function that " +
            "returns the messages). " +
            "Each name you add is a separate addition the customer pays for, so one added on a guess is " +
            "something they did not ask for.\n" +
            "If you cannot tell which kind they mean, name the single closest one.\n\n" +
            "The kinds:\n" + lines.join("\n"),
        },
      },
      required: ["kinds"],
    },
  };
}

const PICK_SYSTEM =
  "You are routing one message inside a website builder. The person you are reading owns the site and has asked " +
  "for something ADDED to it — something it does not have yet. Your only job is to say WHAT KIND of thing that " +
  "is, so the right designer can be handed it. You are not designing it and you are not replying to them.\n\n" +
  "Name every kind they asked for and none they did not. One is the ordinary answer.\n\n" +
  // ── WHAT THE ASK IMPLIES, NOT ONLY WHAT IT SAYS (owner, 2026-09-13) ───────
  //
  // This call decides whether the table designer RUNS AT ALL, and it saw only
  // the customer's sentence: 402 characters of system text, no site, no
  // vocabulary connecting a feature to its storage. "Add a login page" names
  // no table, no database and nothing to store, so `table` was never picked —
  // and the step that knows accounts exist is the page call, four steps later,
  // by which time there is no database to hold them.
  "READ WHAT THE ASK NEEDS, NOT ONLY WHAT IT NAMES. Almost nobody says \"database\", \"table\" or \"store\": " +
  "they say what the site should let somebody DO. If what they describe cannot work unless the site remembers " +
  "something between one visit and the next, it needs a `table` — say so even though they never used any of " +
  "those words. Signing in, accounts, members, profiles, saved or favourite things, bookings, orders, " +
  "enquiries, applications, reviews, messages, anything the owner edits later, and anything phrased as \"my\" " +
  "or \"their\" all need one. A page that only shows words does not.\n\n" +
  "The site as it stands is below, with what it already stores. A thing it ALREADY has a table for needs no " +
  "second one — but a feature with nothing behind it needs its own, whatever the page is called.";

/** The routing request. Shaped like `pickRequest` in site-lanes.mjs, for the same reasons. */
export function pickRequest({ message, kinds = ADD_KINDS, current = "", model = ADD_MODEL }) {
  const tool = pickTool(kinds);
  return {
    model,
    max_tokens: ADD_PICK_MAX_TOKENS,
    // A REAL CACHED PREFIX: the tool and the system text are byte-identical on
    // every addition any customer asks for; the message is the only per-call byte.
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: "pick_adds" },
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: PICK_SYSTEM }],
    // THE SITE IS THE PER-CALL BYTE, NEVER THE CACHED PREFIX. It rides the user
    // message exactly as `addRequest`'s does, so the tool and the system text
    // stay byte-identical for every customer and the prefix still caches.
    // LABELLED HERE rather than by the caller, so both requests say the same
    // words for the same thing — a caller that composed its own heading would
    // be the second copy of a sentence this module owns.
    messages: [{ role: "user", content:
      (current ? "Their site as it stands:\n" + current + "\n\n" : "") +
      "Their message:\n" + String(message || "").slice(0, MAX_MESSAGE) }],
  };
}

/**
 * What the picker named, refused down to kinds the caller offered.
 *
 * EVERY REFUSAL IS SILENT AND RETURNS FEWER KINDS, never a throw; the caller's
 * answer to "no kinds" is a named refusal. `String(["page"])` IS `"page"` — a
 * non-string is refused rather than coerced. De-duped, capped, and IN THE
 * CALLER'S ORDER, which is the run order: a table before the page that shows it.
 */
export function readAdds(reply, kinds = ADD_KINDS) {
  const offered = (Array.isArray(kinds) ? kinds : []).filter((k) => typeof k === "string" && k);
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = use && use.input && Array.isArray(use.input.kinds) ? use.input.kinds : [];
  const seen = new Set();
  for (const k of raw) {
    if (typeof k !== "string" || !offered.includes(k)) continue;
    seen.add(k);
    if (seen.size >= MAX_ADDS) break;
  }
  return offered.filter((k) => seen.has(k));
}

/** Usage in the four kinds `pageCredits` prices, tagged with the model we sent. */
export function addUsage(reply, model) {
  const u = (reply && reply.usage) || null;
  if (!u) return null;
  return {
    in: u.input_tokens || 0,
    out: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
    model,
  };
}

/**
 * Pick the kinds. One call, `send` injected.
 *
 * A THROW IS NOT A FALLBACK TO EVERYTHING: if this call cannot be made the
 * honest answer is no kinds, and the caller reports the outage at no charge.
 */
export async function pickAdds(deps, { message, kinds = ADD_KINDS, current = "", model = ADD_MODEL } = {}) {
  const text = String(message || "").trim();
  if (!text) return { kinds: [], usage: null, failed: false };
  let reply;
  try {
    reply = await deps.send(pickRequest({ message: text, kinds, current, model }));
  } catch (e) {
    return { kinds: [], usage: null, failed: true, error: e };
  }
  return { kinds: readAdds(reply, kinds), usage: addUsage(reply, model), failed: false };
}

/* --------------------------------------------------------------- the design */

/**
 * ONE KIND'S TOOL: one property, nothing required, this path's own words.
 *
 * `required: []` for the reason the edit path empties it — a required field is
 * one the model MUST answer, and a kind that cannot express the addition
 * returns nothing so the route can say so. Inside the property, the kind's own
 * `required` stands: a page with no path is not a page.
 */
export function addTool(kind) {
  if (typeof kind !== "string" || !Object.hasOwn(ADDS, kind)) throw new Error("addTool: no add for kind: " + kind);
  const add = ADDS[kind];
  // WHAT MAKES A TOOL IMPOSSIBLE IS HAVING NO SHAPE, not naming a layer
  // (2026-09-17). A `PLACING_ADDS` kind does both: it runs on the picture rung
  // when it is alone and is designed here when this change writes the page it
  // lands on, so `elsewhere` refused the tool the route had just decided to
  // ask for. The route decides WHICH question it is asking (`addLayerIn`); this
  // only refuses a kind with nothing to be asked.
  if (!add.shape) throw new Error("addTool: `" + kind + "` does not act here — it runs on the " + addLayer(kind) + " layer");
  const properties = { [kind]: { ...add.shape, description: addRule(kind) } };
  // THE COVERAGE LIST IS A SIBLING OF THE KIND, NOT A FIELD INSIDE IT, and both
  // halves of that are load-bearing. Inside the kind's own shape it would be
  // inside `TABLE_ITEM` — shared by identity with `design_schema`, so it would
  // grow the build's tool and become a guarantee the schema engine has to keep.
  // A sibling is metadata about the answer, which is what it is.
  //
  // IT IS ALSO WHY `readAddAnswer` HAD TO CHANGE. That reader returned
  // `use.input[kind]` and nothing else, so any sibling was dropped one hop
  // after the model wrote it — the recorded wiring trap, and the reason this
  // could not have been added without touching the reader.
  if (add.requirements) {
    properties.requirements = {
      type: "array",
      maxItems: MAX_REQUIREMENTS,
      items: REQUIREMENT_ITEM,
      description:
        "What this change has to be able to do, and what became of each one. One entry per requirement you " +
        "worked out above — what they asked for AND what it implies. Answer this even when you answer no " +
        "design at all: a requirement you could not express is the single most useful thing you can tell us, " +
        "and leaving it out is the one outcome that reaches the customer as silence.",
    };
  }
  return {
    name: "add_to_site",
    description: "Design the one thing they asked to add to their site.",
    input_schema: { type: "object", properties, required: [] },
  };
}

/** The four parts of a kind's rule, in the order they are read. */
export const RULE_PARTS = ["is", "yours", "wide", "keep"];

/**
 * The composer, taking the rule as an ARGUMENT so the refusal can be tested —
 * `site-lanes.mjs`'s own reason: folded into `addRule`, the throw could only
 * fire on a kind whose rule was incomplete, and every kind is complete, so a
 * sweep would prove the line inert.
 */
export function composeRule(kind, rule) {
  if (!rule || typeof rule !== "object") throw new Error("addRule: `" + kind + "` has no rule");
  return RULE_PARTS.map((part) => {
    const text = rule[part];
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("addRule: `" + kind + "` has no `" + part + "` — every kind states all four parts of its rule");
    }
    return text.trim();
  }).join("\n");
}

export function addRule(kind) {
  if (typeof kind !== "string" || !Object.hasOwn(ADDS, kind)) throw new Error("addRule: no add for kind: " + kind);
  return composeRule(kind, ADDS[kind].add);
}

/**
 * ── PLACEHOLDER WORDING (owner: "i will tell you the prompt later"). ──
 *
 * ADDING TO A SITE THAT EXISTS, and that is the whole framing. No business to
 * invent, no name to choose, no theme to pick: the site is in front of the
 * model as it stands, and one message says what it is missing.
 */
const ADD_SYSTEM =
  "You are adding to a website that already exists, for the person who owns it.\n\n" +
  "The site is described in front of you — what it is called, what kind of thing it is, the pages it has, " +
  "what it stores, what it already carries — and one message says what they want added. Answer with the " +
  "design of the additions of this one kind and nothing else: the site's name, look, theme and everything " +
  "already on it are decided and are not yours to revisit.\n\n" +
  ADD_DESIGN_RULE + "\n\n" +
  "DESIGN EACH ADDITION COMPLETELY. The next step writes it from your answer and sees nothing you left out, " +
  "so say where it goes, what it is built from and what it leads with.\n\n" +
  "AS MANY AS THEY ASKED FOR AND NOT ONE MORE. Every page, component or table they named, each only as " +
  "large as it was asked, nothing beside them to round them off. A site that grows in ways nobody asked for " +
  "reads as broken however good the additions are.\n\n" +
  "IF THEIR MESSAGE IS NOT ABOUT THIS KIND OF THING, ANSWER NOTHING. Something else is handling it, and an " +
  "addition invented to fill the silence is one they did not ask for.";

/**
 * The site's public address as a base a route can be resolved against, or ""
 * when the caller had none — an `https:` origin only, ending in a slash so
 * `new URL("/prices", url)` lands on the site rather than on a scheme.
 */
export function siteAddress(v) {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (!/^https?:\/\/[^/\s]+/i.test(s)) return "";
  try { return new URL(s).origin + "/"; } catch { return ""; }
}

/**
 * WHAT EACH PAGE IS CALLED, in the site's own words — the page's `<h1>` out of
 * its stored source, or its name in the stored plan when the source has none.
 *
 * RUN 28 (2026-09-03) IS WHY. Told the site's pages as routes alone (`/`,
 * `/prices`) and its address, the QR designer still answered nothing for "a
 * code that opens the booking page": no route is called booking, and the
 * never-invent rule then reads as "there is no such page". The home page's own
 * headline is "Book a guitar lesson" and the nav calls it "Book" — the site
 * knew all along; the designer was never told. Every kind that lands on a
 * page has the same gap (a section "on the booking page" is the same lookup).
 *
 * The headline wins over the plan name because it is what a visitor reads;
 * JSX expressions and nested tags are dropped, and a heading with no letters
 * (an icon, a `{brand}` alone) counts as none. `{ route: label }`, routes only
 * for pages with a label.
 */
export function pageLabels(sources, planPages) {
  const out = {};
  const clean = (s) => String(s || "")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim().slice(0, 80);
  for (const p of Array.isArray(planPages) ? planPages : []) {
    if (!p || typeof p !== "object") continue;
    const r = route(p.path);
    const label = clean(p.name);
    if (r && /[a-z]/i.test(label)) out[r] = label;
  }
  for (const p of Array.isArray(sources) ? sources : []) {
    if (!p || typeof p !== "object" || typeof p.source !== "string") continue;
    const r = routeOf(p.path);
    if (!r) continue;
    const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(p.source);
    const label = m ? clean(m[1]) : "";
    if (/[a-z]/i.test(label)) out[r] = label;
  }
  return out;
}

/**
 * WHAT EACH PAGE IS BUILT FROM — the kit components it imports, and the parts
 * written for this site — read off the stored source, keyed by route.
 *
 * FOR THE COMPONENT DESIGNER (owner, 2026-09-04: "new components should copy
 * existing design"). It names a kit component and never sees the page source,
 * so "the same component the first one is built from" was a rule with no
 * fact behind it: run 36's designer was asked for a second testimonials band
 * and could not know the first was a `TestimonialGrid`. Import lines only —
 * `@/components/ui/<file>` is the kit, `@/routes/-parts/<name>` is the site's
 * own — which is deterministic and cheap; a page with no imports lists as
 * nothing rather than as a guess. Names only, never the source: the note
 * rides on a cached-prefix request as the per-call byte.
 */
export function pageComponents(sources) {
  const out = {};
  const IMPORT = /^\s*import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*["']@\/(components\/ui\/[^"']+|routes\/-parts\/[^"']+)["']/gm;
  for (const p of Array.isArray(sources) ? sources : []) {
    if (!p || typeof p !== "object" || typeof p.source !== "string") continue;
    const r = routeOf(p.path);
    if (!r) continue;
    const kit = [], parts = [], modules = [];
    let m;
    IMPORT.lastIndex = 0;
    while ((m = IMPORT.exec(p.source))) {
      const names = m[1].split(",").map((n) => n.replace(/^\s*type\s+/, "").split(/\s+as\s+/)[0].trim()).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
      for (const n of names) {
        const list = m[2].startsWith("routes/-parts/") ? parts : kit;
        if (!list.includes(n)) list.push(n);
      }
      // ── AND THE KIT MODULE NAMES, WHICH ARE A DIFFERENT VOCABULARY ────────
      //
      // `kit` is the EXPORT names — `SeatMap` — because that is what a
      // designer reading the note has to write in a page. `siteComponentApi`
      // is keyed on the MODULE name — `seat-map` — because that is what the
      // signature catalog is keyed on, and the two differ by more than case
      // (`faq` exports `Faq`, `footnote` exports `FootnoteRef` AND
      // `FootnoteList`).
      //
      // MEASURED, and it is why this exists: handing `siteComponentApi` the
      // export names answers `""` for every one of them — a value computed
      // and never forwarded, which from outside is indistinguishable from the
      // site importing nothing. ONE walk answers both, so a second parser of
      // import lines cannot drift from this one.
      if (!m[2].startsWith("routes/-parts/")) {
        const mod = m[2].split("/").pop();
        if (mod && !modules.includes(mod)) modules.push(mod);
      }
    }
    if (kit.length || parts.length) out[r] = { kit: kit.slice(0, 40), parts: parts.slice(0, 20), modules: modules.slice(0, 40) };
  }
  return out;
}

/**
 * WHAT THE SITE IS, for the model that designs an addition to it.
 *
 * NAMES, NOT CONTENTS. The routes, the table names, what the site already
 * carries — never the page source (the step that writes pages sees that) and
 * never a table's rows (a `collect` table's rows are customer data). Thin on
 * purpose: this rides on a cached-prefix request as the per-call byte.
 */
export function siteNote(site) {
  const s = site && typeof site === "object" ? site : {};
  const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const lines = [];
  const name = str(s.name, 120);
  lines.push("The site is called " + (name || "(unnamed)") + ".");
  lines.push(s.kind === "tool"
    ? "It is a WORKING TOOL the business uses, not a shopfront: every page is a working screen, and there are no marketing bands and no photographs."
    : "It is a shopfront: a site that persuades a visitor.");
  // ── WHAT IS THERE AND WHAT IS BEING BUILT ARE DIFFERENT FACTS ───────────
  //
  // DECLARED HERE, ABOVE ITS FIRST USE, and that placement is load-bearing
  // rather than tidy: this block used to sit below the table list and the
  // pages line now needs it too. A `const` called above its own line parses,
  // passes every text guard and throws at runtime — this repository's own
  // recorded trap, met once already inside this very function.
  const proposed = s.proposed && typeof s.proposed === "object" && !Array.isArray(s.proposed) ? s.proposed : {};
  const isNew = (k, n) => (Array.isArray(proposed[k]) ? proposed[k] : []).some((x) => typeof x === "string" && x.toLowerCase() === String(n).toLowerCase());
  const mark = (k) => (n) => (isNew(k, n) ? n + " (being added by this same change)" : n);
  const pages = (Array.isArray(s.pages) ? s.pages : []).filter((p) => typeof p === "string" && p.trim()).slice(0, 24);
  // EACH PAGE WITH WHAT IT CALLS ITSELF (run 28, 2026-09-03), so "the booking
  // page" can be found among routes that never say the word: the page whose
  // headline is "Book a guitar lesson" is the one they mean.
  const labels = s.labels && typeof s.labels === "object" && !Array.isArray(s.labels) ? s.labels : {};
  const named = pages.map((p) => {
    const l = typeof labels[p] === "string" ? labels[p].trim().slice(0, 80) : "";
    return l ? p + " (\"" + l.replace(/"/g, "'") + "\")" : p;
  });
  lines.push(pages.length ? "Its pages are: " + named.join(", ") + "." : "It has no pages yet.");
  // ── AND THE PAGES THIS SAME CHANGE IS ADDING (2026-09-17) ───────────────
  //
  // A SEPARATE LINE, NEVER FOLDED INTO THE ONE ABOVE. Owner: *"Clearly
  // separate current implementation from the original design plan"*, and
  // these are the two halves of exactly that — `pages` is read from the
  // site's real page source and this is read from what the `page` designer
  // decided a call ago. The `qr` and `component` designers need it (a code
  // may open it, a section may sit on it) and must not be told it is there
  // today, or a designer asked to copy a like section's design goes looking
  // for source that does not exist yet.
  const coming = (Array.isArray(s.planned) ? s.planned : [])
    .map((p) => (p && typeof p === "object" ? { path: str(p.path, 120), name: str(p.name, 80) } : { path: str(p, 120), name: "" }))
    .filter((p) => p.path && !pages.includes(p.path)).slice(0, 24);
  if (coming.length) {
    lines.push("This same change is ALSO adding " + (coming.length === 1 ? "a page" : coming.length + " pages") + ", which do not exist yet: " +
      coming.map((p) => p.path + (p.name ? " (\"" + p.name.replace(/"/g, "'") + "\")" : "")).join(", ") +
      ". A code may open one and a section may sit on one — they go live with this change. There is no source to read for them.");
  }
  // WHAT EACH PAGE IS BUILT FROM (owner, 2026-09-04: a second one copies the
  // first's design), so a component designer can name the component a like
  // section already uses instead of another that shows the same kind of thing.
  const built = s.builtFrom && typeof s.builtFrom === "object" && !Array.isArray(s.builtFrom) ? s.builtFrom : {};
  for (const p of pages) {
    const b = built[p] && typeof built[p] === "object" ? built[p] : null;
    if (!b) continue;
    const kit = (Array.isArray(b.kit) ? b.kit : []).filter((x) => typeof x === "string" && x.trim()).slice(0, 40);
    const parts = (Array.isArray(b.parts) ? b.parts : []).filter((x) => typeof x === "string" && x.trim()).slice(0, 20);
    if (!kit.length && !parts.length) continue;
    lines.push(p + " is built from: " + (kit.length ? kit.join(", ") : "no kit components") +
      (parts.length ? "; and its own parts " + parts.join(", ") : "") +
      ". A second one of something it already has is built from the same component as the first.");
  }
  // ITS ADDRESS, so its own pages are real destinations (run 26, 2026-09-03).
  // The QR kind's rule forbids inventing a destination, and without this line
  // "a code that opens the booking page" had none: the model answered nothing,
  // which the rule told it to. A route of the site's own is that address plus
  // the route, said in as many words with one of its real pages as the example.
  const url = siteAddress(s.url);
  if (url) {
    const example = pages.find((p) => p !== "/") || "/";
    lines.push("Its address is " + url + " — a code that opens one of its own pages carries that address with the " +
      "page's route (" + new URL(example, url).href + "), which is a real destination, never an invented one.");
  }
  // EACH TABLE WITH ITS COLUMNS when the caller gives them (`columns`, keyed
  // by table, each a list of "name type" strings): a function's body is SQL
  // over these columns, and a `sql` function is parsed at CREATE — a guessed
  // column is a function that fails to exist. Names alone when none are given,
  // so a site described without them reads exactly as before.
  const cols = s.columns && typeof s.columns === "object" && !Array.isArray(s.columns) ? s.columns : {};
  // WHAT IS ALREADY THERE AND WHAT IS BEING BUILT RIGHT NOW ARE DIFFERENT
  // FACTS, and telling a designer only the second is how it designs around a
  // table that does not exist yet — or, worse, designs a second one. `proposed`
  // is the names this same message has already decided on, per list; every one
  // is marked so the designer can rely on it AND know it is new. Declared at
  // the head of this function now, because the pages line needs it too.
  // ── AND ITS RELATIONSHIPS, PERMISSIONS AND CONSTRAINTS (owner, 2026-09-13) ─
  //
  // "Give the picker and Tables designer relevant existing-site context,
  // including table structures, relationships, permissions, and constraints."
  //
  // The columns alone were never enough to design ALONGSIDE a site. A designer
  // that cannot see `bookings` is member-private writes a second table to hold
  // the same rows publicly; one that cannot see `bookings.slot_id` already
  // points at `slots` invents a second slots table; one that cannot see the
  // unique slot re-declares it, or worse, designs around its absence. All
  // three are the "a site that disagrees with itself" failure the `wide` rule
  // has always forbidden without ever supplying the facts to obey it.
  //
  // WORDED HERE, FROM ONE READER. `accessLabel` resolves the read/write PAIR
  // rather than trusting the stored `access` string — `normalizeSchema` stamps
  // `collect` on any table that did not declare a recognised preset, so a
  // pair-declared display table reads as `collect` to anything that believes
  // the field. A leaf module with no imports of its own, so this adds no cycle.
  const info = s.tableInfo && typeof s.tableInfo === "object" && !Array.isArray(s.tableInfo) ? s.tableInfo : {};
  const detail = (t) => {
    const d = info[t] && typeof info[t] === "object" ? info[t] : null;
    if (!d) return "";
    const bits = [];
    const perm = str(d.access, 60);
    if (perm) bits.push("access " + perm);
    const refs = d.refs && typeof d.refs === "object" && !Array.isArray(d.refs) ? d.refs : {};
    const pairs = Object.entries(refs).filter(([c, p]) => typeof c === "string" && typeof p === "string").slice(0, 8);
    if (pairs.length) bits.push(pairs.map(([c, p]) => c + " points at " + p).join(", "));
    const keeps = (Array.isArray(d.guarantees) ? d.guarantees : []).filter((x) => typeof x === "string" && x.trim()).slice(0, 10);
    if (keeps.length) bits.push("keeps " + keeps.join(", "));
    return bits.length ? " — " + bits.join("; ") : "";
  };
  let anyDetail = false;
  const tables = (Array.isArray(s.tables) ? s.tables : []).filter((t) => typeof t === "string" && t.trim()).slice(0, 24)
    .map((t) => {
      const c = (Array.isArray(cols[t]) ? cols[t] : []).filter((x) => typeof x === "string" && x.trim()).slice(0, 40);
      const tail = detail(t) + (isNew("tables", t) ? " — being added by this same change" : "");
      if (tail) anyDetail = true;
      return (c.length ? t + " (" + c.join(", ") + ")" : t) + tail;
    });
  // A SITE WITH NO DATABASE IS SAID IN AS MANY WORDS, and what it means is said
  // too: a table designed for it is refused by name, so the model should not
  // reach for one where a section would do.
  // A SITE WITH NO DATABASE GETS ONE ON FIRST TOUCH (owner, 2026-09-03): the
  // first table, function, connection or job designed for it is what makes
  // it, so the note says so instead of refusing — the old sentence ("a table
  // cannot be added to it in this step") was the wall this step no longer has.
  // ONE LINE PER TABLE ONCE THERE IS DETAIL TO CARRY, and the reason is the
  // OUTPUT rather than taste. Joined with ", " the real note read
  //
  //   It stores: bookings (slot text, phone text) — access user; keeps
  //   oncePerUser, enforceRefs, unique, sessions (title text) — access display.
  //
  // in which `sessions` is indistinguishable from a fourth guarantee of
  // `bookings`: the guarantee list and the table list used the same separator.
  // A designer that cannot tell where one table ends and the next begins is
  // exactly the "a site that disagrees with itself" failure this context was
  // added to prevent — it would read `sessions` as something bookings keeps and
  // then design a table to hold sessions.
  //
  // FOUND BY READING THE REAL NOTE BACK, not by a guard: every assertion was
  // about what the sentence CONTAINS, and it contained all of it. Run 26's
  // method — print the prompt before buying a call.
  //
  // A CALLER THAT PASSES NO `tableInfo` gets no detail and therefore the
  // one-line list it always got, byte for byte, which is the same rule the
  // columns three lines up already follow.
  lines.push(s.hasDatabase
    ? (tables.length
      ? (anyDetail ? "It stores:\n- " + tables.join("\n- ") : "It stores: " + tables.join(", ") + ".")
      : "It has a database with no tables yet.")
    : "It has NO database yet: nothing on it is stored. The first table, function, outside connection or scheduled job you design for it creates one.");
  // AND THE REST OF ITS BACKEND BY NAME (2026-09-03), so a designer adding a
  // function, a connection or a job names a new one and a job can name a
  // function the site has.
  const namesOf = (k) => (Array.isArray(s[k]) ? s[k] : []).filter((x) => typeof x === "string" && x.trim()).slice(0, 24).map(mark(k));
  const fns = namesOf("functions"), apis = namesOf("apis"), jobs = namesOf("jobs"), jobFns = namesOf("jobFns");
  // A FUNCTION IS RE-DECLARED BY NAME, so one that is not ordinary SQL says so
  // (2026-09-19). `fnLangs` is non-default only and the marker rides the name
  // it belongs to, so a site with no such function prints the line it always
  // printed, character for character. Without it, a designer re-declaring a
  // plpgsql function writes a plpgsql body, says nothing about the language,
  // and the engine creates it `LANGUAGE sql` — a syntax error at CREATE.
  const fnLangs = (s && s.fnLangs && typeof s.fnLangs === "object") ? s.fnLangs : {};
  const fnLang = (n) => {
    const raw = String(n).replace(/\s*\(being added by this same change\)$/, "");
    const l = fnLangs[raw];
    return typeof l === "string" && l.trim() ? n + " (written in " + l.trim() + ", so re-declaring it needs that language again)" : n;
  };
  if (fns.length) lines.push("Its database functions are: " + fns.map(fnLang).join(", ") + ".");
  // THE ONES A JOB MAY RUN, said apart: a job names an internal function
  // (no arguments, returns the messages), and `cleanAdd` refuses any other.
  if (jobFns.length) lines.push("The functions a scheduled job may run are: " + jobFns.join(", ") + ".");
  if (apis.length) lines.push("Its outside connections are: " + apis.join(", ") + ".");
  if (jobs.length) lines.push("Its scheduled jobs are: " + jobs.join(", ") + ".");
  const has = [];
  // EVERY CODE BY NAME (2026-09-03), so a designer adding one can pick a name
  // the site does not use and a destination none of them already carries.
  const codes = qrList(s.qr);
  if (codes.length) {
    has.push((codes.length === 1 ? "a QR code" : codes.length + " QR codes") + ": " +
      codes.map((c) => "`" + c.name + "` (\"" + str(c.label, 80) + "\", scanning it: " + str(c.points, 80) + ")").join(", "));
  }
  if (s.three) has.push("a 3D scene");
  // ── A COMPONENT THAT EXISTS AND ONE THAT WAS ONLY EVER DECLARED ─────────
  //
  // This read `s.tsx` — the stored `look.tsx` DECLARATIONS — and printed them
  // as "parts written for it". That list is cumulative and is a plan: a name,
  // a sentence and a props line, which a build may have declared and never
  // written, and which survives on the look for ever either way. `s.parts` is
  // the names the site really has a FILE for, off `source/<slug>/parts.json`,
  // and the two are said apart (owner, 2026-09-17: *"Distinguish existing
  // custom components from new components to build"*). A designer told to
  // copy a like section's component has to be able to tell a component it can
  // point at from a description of one nobody wrote.
  //
  // A CALLER THAT PASSES NO `parts` GETS THE OLD SENTENCE, byte for byte —
  // the declarations, under the old words — so every existing caller and
  // every guard written against one reads exactly as it did.
  const declared = (Array.isArray(s.tsx) ? s.tsx : []).map((t) => (t && typeof t === "object" ? str(t.name, 60) : "")).filter(Boolean);
  const written = Array.isArray(s.parts)
    ? s.parts.map((p) => str(p && typeof p === "object" ? p.name : p, 60)).filter(Boolean)
    : null;
  if (written === null) {
    if (declared.length) has.push("parts written for it: " + declared.join(", "));
  } else {
    if (written.length) has.push("components of its own, already written: " + written.join(", "));
    const lower = written.map((n) => n.toLowerCase());
    const onlyPlanned = declared.filter((n) => !lower.includes(n.toLowerCase()));
    if (onlyPlanned.length) has.push("components its design declares and nothing has written yet: " + onlyPlanned.join(", "));
  }
  if (has.length) lines.push("It already carries " + has.join("; ") + ".");
  // ── THE LOOK IT IS WEARING (owner, 2026-09-17) ──────────────────────────
  //
  // The add rules tell every designer to keep the site's design system and
  // nothing in its inputs said what that system IS. NAMES, NOT BYTES, which
  // is this note's own standing rule: the theme is what a designer can name
  // and honour, and the stylesheet itself is the PAGE WRITER's to read —
  // `styleDirective` carries that, because the writer is the one emitting
  // markup that has to match it.
  const theme = str(s.theme, 80);
  const look = [];
  if (theme) look.push("Its theme is " + theme + " — every colour, radius and font comes from that theme's tokens, never a colour of your own");
  if (s.css) look.push("it also carries a stylesheet written for it, which is applied on top of the theme");
  if (look.length) lines.push(look.join("; ") + ".");
  return lines.join("\n");
}

/**
 * A stored spec's tables, as the facts `siteNote` prints: permissions,
 * relationships, constraints. `{ <table>: { access, refs, guarantees } }`.
 *
 * HERE RATHER THAN IN THE ROUTE, so the wording has one home and a test can
 * drive it against a real stored spec instead of against a hand-typed fixture
 * of what one looks like — the recorded "a fixture in a different shape from
 * reality" trap, which this repository has met with a trailing slash and with
 * a `TWO_CONTAINERS` list of one.
 *
 * THE GUARANTEE NAMES ARE DERIVED FROM `TABLE_ITEM`, never listed again. Two
 * things follow: a guarantee the tool does not offer is not named to a
 * designer that could not ask for it anyway, and a property added to the item
 * next month appears here by existing. The structural five are excluded
 * because they are printed already or are not guarantees.
 */
const NOT_A_GUARANTEE_HERE = new Set(["name", "columns", "access", "read", "write", "retired"]);

/** Which spec list each backend kind's cleaned answer belongs in. */
export const SPEC_OF_KIND = Object.freeze({ table: "tables", function: "functions", api: "apis", job: "jobs" });

/**
 * THE BASELINE AND THE PROPOSAL ARE TWO SPECS, AND THIS MAKES THE SECOND.
 *
 * Each kind is its OWN model call, and until now only two facts crossed between
 * them: `aSite.functions` and `aSite.jobFns` were pushed to in the loop so a
 * job could name a function designed a call earlier. Everything else the
 * designers told each other was nothing — the `api` designer could not see the
 * table just designed, the `job` designer could not see the connection, and the
 * `page` designer was handed a site description built from the STORED spec
 * alone, describing a site that no longer matched what this same message had
 * already decided to build.
 *
 * So the accumulated proposal is a real spec: the stored one plus every cleaned
 * item, in ADD_KINDS order, which is run order — a table before the function
 * that reads it, both before the job that runs it. It is what the per-tier
 * validation normalises each item INSIDE (a job alone normalises to nothing;
 * with its function present it survives) and what the next designer's note is
 * built from.
 *
 * REPLACE BY NAME, NEVER APPEND BLINDLY. The engine's `CREATE OR REPLACE`
 * means a function the site already lists is replaced when named, and the
 * cleaner already says so with `exists` — so two entries of one name in the
 * proposal would make `keptItem` find whichever came first and validate the
 * wrong one.
 *
 * THE BASELINE IS NEVER MUTATED. It is what `added` versus `altered` is decided
 * against, what the reply reports, and what a refused addition leaves the site
 * as; a proposal written over it is a change nothing can roll back.
 *
 * ── A TABLE EXTENSION MERGES, IT DOES NOT REPLACE (2026-09-14) ──────────────
 *
 * The three spec-level tiers really are replace-by-name: `CREATE OR REPLACE`
 * means a function named again IS the new body, whole. A TABLE is not. The
 * commonest table addition there is — "add a notes field to the booking form"
 * — arrives as one column and no access, and replacing the stored table with
 * that is not a description of anything that will ever exist.
 *
 * MEASURED through the real route, on a site whose stored `bookings` is
 * `who text, slot text, phone text` with `access: "user"`. The function
 * designer, one call later, was handed:
 *
 *     bookings (notes text) — access collect — being added by this same change
 *
 * Three columns gone, the access reading `collect` (which `normalizeSchema`
 * stamps on a table that declares none — anyone may write, nobody may read:
 * the OPPOSITE of what the site enforces), and a table the site has had since
 * it was built marked as new. Every later designer in that message planned
 * against a site that does not exist.
 *
 * SO THE MERGE IS THE APPLY'S OWN. `mergeAddonSchema` is what the publish
 * really runs over the stored tables — new columns only, `ADDON_TABLE_FIELDS`
 * for the rest, a table the site lacks appended whole — and using it here is
 * what makes the proposal a description of the database that is coming rather
 * than a second, hand-written idea of what an extension does. A second copy of
 * those rules would drift from the one the apply keeps, which is this
 * repository's most expensive shape of bug.
 */
export function proposedSpec(spec, kind, value) {
  const list = SPEC_OF_KIND[kind];
  const base = spec && typeof spec === "object" ? spec : {};
  if (!list) return base;
  const items = (Array.isArray(value) ? value : (value ? [value] : []))
    .map((v) => (kind === "table" ? (v && v.table) : v))
    .filter((v) => v && typeof v === "object" && typeof v.name === "string" && v.name);
  if (!items.length) return base;
  // TABLES GO THROUGH THE APPLY'S MERGE; the other three tiers replace by name.
  if (kind === "table") {
    return { ...base, tables: mergeAddonSchema(Array.isArray(base.tables) ? base.tables : [], { tables: items }).tables };
  }
  const out = Array.isArray(base[list]) ? [...base[list]] : [];
  for (const item of items) {
    const at = out.findIndex((x) => x && String(x.name || "").toLowerCase() === item.name.toLowerCase());
    if (at >= 0) out[at] = item; else out.push(item);
  }
  return { ...base, [list]: out };
}

export function tableFacts(spec) {
  const tables = (spec && Array.isArray(spec.tables)) ? spec.tables : [];
  const names = Object.keys(TABLE_ITEM.properties || {}).filter((k) => !NOT_A_GUARANTEE_HERE.has(k));
  const out = {};
  for (const t of tables) {
    if (!t || typeof t !== "object" || !t.name) continue;
    const refs = {};
    const r = t.refs && typeof t.refs === "object" && !Array.isArray(t.refs) ? t.refs : {};
    for (const [c, p] of Object.entries(r)) if (typeof c === "string" && typeof p === "string" && p) refs[c] = p;
    const guarantees = [];
    for (const k of names) {
      const v = t[k];
      // A FALSY OR EMPTY DECLARATION IS THE SAME AS ABSENCE — `refusedFields`
      // and `droppedFields` both make exactly this test, for the same reason:
      // naming `fts: false` on every table that has none buries the signal.
      if (!v) continue;
      if (Array.isArray(v) ? !v.length : (typeof v === "object" && !Object.keys(v).length)) continue;
      guarantees.push(k);
    }
    out[t.name] = { access: accessLabel(t), refs, guarantees };
  }
  return out;
}

export function addRequest({ kind, message, site, model, brief = "" }) {
  const tool = addTool(kind);
  return {
    model,
    max_tokens: ADD_MAX_TOKENS,
    // CACHED: the tool and the system text are byte-identical for every
    // addition of this kind by any customer; the site and the message are the
    // per-call bytes and ride in the user message.
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: "add_to_site" },
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: ADD_SYSTEM }],
    messages: [{ role: "user", content:
      "Their site as it stands:\n" + siteNote(site) +
      "\n\nWhat they asked to add:\n" + String(message || "").slice(0, MAX_MESSAGE) +
      // WHAT AN EARLIER STEP IN THIS SAME MESSAGE HANDED TO THIS ONE. Below the
      // ask, because it is a second thing to cover and never a replacement for
      // it; absent entirely when nobody handed this kind anything, so a call
      // that owns none is byte for byte what it was.
      (brief ? "\n\n" + brief : "") },
    ],
  };
}

/**
 * What the kind answered, as an EXPLICIT SHAPE rather than a bare value:
 *
 *   { value, requirements, skipped }
 *
 * `value` is the designed object, or `undefined` for nothing — unchanged, and
 * `undefined` AND `null` ARE BOTH NOTHING: a kind that declines is the ordinary
 * shape here, the picker named it and the model found the message was not
 * really asking for one of these.
 *
 * `requirements` is the coverage list, CLEANED, and `skipped` the entries that
 * could not be read. Both are always arrays, so every consumer can iterate
 * without asking whether the kind offers them.
 *
 * THE RETURN SHAPE CHANGED ON 2026-09-13 AND THAT IS THE POINT. It used to be
 * the bare value, which meant a sibling property the model wrote was dropped
 * here — one hop after it was written, invisibly, with the tool, the model and
 * every later step all correct. That is this repository's most-repeated defect
 * and the reason the coverage list could not simply be added to the tool.
 *
 * A REQUIREMENT LIST SURVIVES AN ANSWER THAT DESIGNED NOTHING. `value` being
 * `undefined` says nothing about `requirements`: the case this exists for is
 * precisely the one where the model could not express the ask.
 */
export function readAddAnswer(reply, kind) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = use && use.input && typeof use.input === "object" ? use.input : null;
  const v = input ? input[kind] : undefined;
  // THE KIND IS STAMPED ON EVERY ENTRY. A `covered` requirement names no step
  // — the one that answered it owns it — so without `from` a claim made by a
  // step that then refused everything could never be tied back to that refusal,
  // and six kinds answering makes that the ordinary case rather than a corner.
  const req = cleanRequirements(input ? input.requirements : null, kind);
  return { value: v === null ? undefined : v, requirements: req.list, skipped: req.skipped };
}

/**
 * Run one add. One call, `send` injected, no folding and no publishing.
 *
 * TRUNCATION IS NAMED, not returned as a half-designed page — the same check
 * the design and pages calls make.
 */
export async function runAdd(deps, { kind, message, site, model, brief = "" }) {
  // EVERY RETURN CARRIES BOTH ARRAYS, including the failures. A consumer that
  // has to ask whether this kind answers requirements before it can iterate is
  // a consumer that will one day forget to — and the failure shapes are where
  // that costs most, since a truncated answer is exactly when a half-read list
  // would be silently dropped.
  const none = { requirements: [], reqSkipped: [] };
  let reply;
  try {
    reply = await deps.send(addRequest({ kind, message, site, model, brief }));
  } catch (e) {
    return { kind, value: undefined, ...none, usage: null, failed: true, error: e };
  }
  if (reply && reply.stop_reason === "max_tokens") {
    const e = new Error("add truncated at max_tokens");
    e.truncated = true;
    return { kind, value: undefined, ...none, usage: addUsage(reply, model), failed: true, error: e };
  }
  // THE RAW REPLY RIDES OUT TOO (run 28, 2026-09-03): three live declines in a
  // row and nothing anywhere recorded what the model had said — the answer
  // existed only in a Worker's memory, run 90's shape again. The route keeps
  // it for the owner to read; this function only hands it up.
  const answer = readAddAnswer(reply, kind);
  return {
    kind,
    value: answer.value,
    // HOP 3 OF EIGHT. The coverage list rides BESIDE `value`, never inside it,
    // so a cleaner that refuses every table cannot take the reason with it.
    requirements: answer.requirements,
    reqSkipped: answer.skipped,
    usage: addUsage(reply, model),
    failed: false,
    raw: reply,
  };
}

/* --------------------------------------------------------- what came back */

/** A route as the tool is told to write it: "/", "/gallery", "/about/team". */
const ROUTE = /^\/(?:[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)?$/;

/** A kit or part name: kebab-case. */
const NAME = /^[a-z][a-z0-9-]*$/;

/** A table name, as the engine wants it. */
const TABLE_NAME = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * A photograph's own name — the label a requirement points at (2026-09-19).
 *
 * The same SHAPE as a QR code's `QR_NAME` and deliberately not that constant:
 * that one names a JavaScript binding the page writes (`SITE_QRS.wifi`), so
 * widening it is a decision about generated source, and this one names nothing
 * but itself. Tying them would make a change to either silently change the
 * other.
 *
 * **IT CANNOT COLLIDE WITH A ROUTE**, which is the other thing a photo
 * requirement may name: a route starts with `/` and this refuses one.
 */
const PHOTO_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** How long a photograph's name may be — the length half of `PHOTO_NAME`, which a regex bound would hide. */
const MAX_PHOTO_NAME = 24;

/**
 * The per-answer scratch every cleaner shares — the names taken so far.
 *
 * ONE SHAPE, BOTH CALL SITES: a `function` declaration so it cannot be called
 * above its own line, and one definition so the list path and the single path
 * cannot drift into a `TypeError` the day a kind moves between them.
 */
function freshCtx() {
  // `dropped` IS WHAT AN ANSWER DECLARED AND THIS STEP COULD NOT USE, NAMED —
  // `{what, name}`, developer-facing, added 2026-09-20.
  //
  // WHY IT EXISTS: three filters inside an item binned a declared thing and
  // wrote nothing anywhere. A column, a hand-written component, a kit name.
  // `skipped` is per-ITEM on a list kind and these are per-FIELD inside one, so
  // there was no channel at all — the answer came back `ok`, the table was
  // created short a column, and the proposed spec handed to every later
  // designer IN THE SAME MESSAGE said the site stores less than was asked for.
  // `unknownKit` was the one field of this shape that already existed; this is
  // its generalisation rather than a fourth key beside it.
  return { paths: [], tables: [], functions: [], apis: [], jobs: [], photos: [], unknownKit: [], dropped: [] };
}

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
// THE HOME ROUTE IS ONE SLASH AND STAYS ONE: stripping trailing slashes from
// "/" leaves "", which the first draft read as no route at all — so a section
// on a one-page site had no page to land on. A lone slash is kept as itself.
const route = (v) => {
  let s = str(v, 120).toLowerCase();
  if (s !== "/") s = s.replace(/\/+$/, "");
  if (!s) return "";
  const r = s.startsWith("/") ? s : "/" + s;
  return ROUTE.test(r) ? r : "";
};
const names = (v, max) => {
  const out = [];
  for (const x of Array.isArray(v) ? v : []) {
    const n = str(x, 60).toLowerCase();
    if (!NAME.test(n) || out.includes(n)) continue;
    out.push(n);
    if (out.length >= max) break;
  }
  return out;
};
const lines = (v, max, cap) => {
  const out = [];
  for (const x of Array.isArray(v) ? v : []) {
    const s = str(x, cap);
    if (!s) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
};
/**
 * The hand-written parts an answer declares, in the shared item's shape.
 *
 * ⚠ AND A BINNED ONE IS NAMED NOW (2026-09-20). An entry missing `does` or
 * `props` was dropped with nothing written anywhere — silently closing the
 * escape hatch the 2,112-component kit exists to have, on the one kind whose
 * whole purpose is a component the kit cannot supply. `no-component` still
 * fires when nothing usable is left, so the SILENT case is exactly the one
 * where some other part or kit name carried the item through.
 *
 * NOT REPAIRED, and that is the owner's rule rather than a shortcut: `does`
 * and `props` are what the page writer builds the component FROM, so inventing
 * either is inventing the component. A named drop is the honest answer.
 */
const parts = (v, ctx) => {
  const out = [];
  const drop = (name) => {
    if (ctx && Array.isArray(ctx.dropped)) ctx.dropped.push({ what: "component", name });
  };
  for (const x of Array.isArray(v) ? v : []) {
    if (!x || typeof x !== "object") { drop(""); continue; }
    const name = str(x.name, 60).toLowerCase();
    const does = str(x.does, 600);
    const props = str(x.props, 400);
    if (out.some((p) => p.name === name)) continue;
    if (!NAME.test(name) || !does || !props) { drop(name); continue; }
    out.push({ name, does, props });
    if (out.length >= MAX_TSX) break;
  }
  return out;
};

/**
 * The file a route is written to — `routeOf` run backwards, for NEW pages.
 *
 * TanStack's flat convention, the one `routeOf` reads: `/gallery` is
 * `gallery.tsx`, `/about/team` is `about.team.tsx`, `/` is `index.tsx`. Bare,
 * without `src/routes/`, because that is what is stored and what the container
 * puts the prefix back on. A test asserts `routeOf(fileOfRoute(r)) === r`.
 */
export function fileOfRoute(r) {
  const s = route(r);
  if (!s) return "";
  if (s === "/") return "index.tsx";
  return s.slice(1).split("/").join(".") + ".tsx";
}

/**
 * Refuse an answer down to a usable design, or say why not.
 *
 * `{ ok: true, value }` or `{ ok: false, why }`, with `why` a fixed token the
 * route turns into a sentence. THE BIAS: an answer with a fixable slip is
 * fixed (a route without its slash, a name in the wrong case); an answer that
 * names a page the site does not have, or a table with nothing in it, is
 * refused by name — this step publishes, and a guessed page is a page on
 * somebody's live site.
 *
 * `site.pages` is the site's routes; a section or a code on a site with ONE
 * page lands on that page whatever route was named, because on most of the
 * platform there is only one page and the ordinary miss is naming it wrong.
 */
export function cleanAdd(kind, value, site) {
  const s = site && typeof site === "object" ? site : {};
  const have = (Array.isArray(s.pages) ? s.pages : []).map(route).filter(Boolean);
  // ── A PAGE THIS SAME CHANGE IS ADDING IS A REAL DESTINATION (2026-09-17) ──
  //
  // Owner: *"Pass newly planned frontend items to subsequent designers, as we
  // already do for backend declarations."* The kinds run in `ADD_KINDS` order
  // — `page` before `component`, `qr` and `three` — and until today nothing
  // crossed between them, so a message asking for a gallery page AND a code
  // that opens it met two different failures with one cause. MEASURED at this
  // cleaner before it was fixed:
  //
  //   component placed on a new `/gallery`, one-page site   -> page "/"
  //   component placed on a new `/gallery`, 3-page site     -> refused no-page
  //   QR pointing at a new `/gallery`, either               -> refused no-such-page
  //
  // The first is the worse one: the section was built on the FRONT page and
  // the customer was told it had been added, which is the silent substitution
  // the owner named. The backend tiers have had this since 2026-09-14 (a job
  // may name a function designed one call earlier); this is the same fact for
  // the frontend, carried on `site.planned` and marked as not-there-yet
  // everywhere it is shown.
  //
  // KEPT APART FROM `have` RATHER THAN FOLDED INTO IT. What the site HAS and
  // what this change is ADDING are different facts and the caller is entitled
  // to both — a page that exists may not be added again, and a page that is
  // planned may not be added twice either, but only one of them is somewhere
  // a visitor can go today.
  const planned = (Array.isArray(s.planned) ? s.planned : [])
    .map((p) => route(p && typeof p === "object" ? p.path : p))
    .filter((p) => p && !have.includes(p));
  // EVERY ROUTE THE SITE WILL HAVE ONCE THIS CHANGE LANDS. The one list both
  // "where may this go" and "where may a code point" are answered from, so
  // they cannot come apart.
  const going = have.concat(planned);
  // A KIND WITH NO TOOL HAS NOTHING TO CLEAN, and that is the honest test —
  // not `elsewhere` (2026-09-17). A `PLACING_ADDS` kind names a layer AND
  // carries a tool, so asking `elsewhere` here refused the very answer this
  // step had just designed; what makes an answer uncleanable is having no
  // shape to have been answered in.
  if (typeof kind !== "string" || !Object.hasOwn(ADDS, kind) || !ADDS[kind].shape) return { ok: false, why: "no-kind" };
  // WHICH PAGE, for the kinds that land on one. Refused on a multi-page site
  // when the route is not one of its own; resolved to the one page otherwise.
  // ── A MISSING DESTINATION IS NOT THE HOME PAGE (owner, 2026-09-14) ──────
  //
  // *"On a multi-page site, a missing destination must not silently become the
  // home page."*
  //
  // This fell through to `/` whenever the answer named no route and the site
  // had one — so on a three-page site a component the designer forgot to place
  // landed on the front page, was built there, and the customer was told the
  // section had been added. Cannot-tell read as a value, on the one field that
  // decides WHERE a visitor meets the thing.
  //
  // The one-page shortcut STAYS and is not a guess: a site with exactly one
  // page has exactly one place a component can go, so resolving to it is
  // reading the site rather than picking for the model. Everything else
  // answers "" and the caller refuses by name.
  //
  // ── AND THE SHORTCUT READS THE POST-CHANGE SITE (2026-09-17) ────────────
  //
  // It read `have`, the routes the site has TODAY, and its whole
  // justification is "there is exactly one place this can go". The moment
  // this same change adds a page there are two, so on a one-page site adding
  // `/gallery` an unplaced component still landed on `/` — a rule true
  // because of a layer below it, expiring the instant that layer moved. Both
  // halves read `going` now, so the shortcut fires only when the site really
  // will have one page and nowhere else to put it.
  //
  // A NAMED ROUTE RESOLVES TO THAT ROUTE OR TO NOTHING. It used to fall
  // through to the shortcut, so a component the designer deliberately placed
  // on a page the site does not have was moved to the home page rather than
  // refused — the same substitution one branch over.
  //
  // ── AND ONE ANSWER COULD NOT CARRY THREE FACTS (2026-09-20) ──────────────
  //
  // It answered a string, so "resolved to nowhere" and "nothing was named"
  // were both `""` — and `component`/`photo` read that as a refusal while
  // `qr`/`three`, whose placement is OPTIONAL, read it as "unplaced" and
  // `at()` rendered it as *"the home page (index.tsx)"*. MEASURED on a
  // three-page site, `page: "/nowhere"`: component and photo refused
  // `no-page`; qr and three stored `page: ""` and the directive put both on
  // the front page. The owner's correction of exactly this for `component`
  // sits four lines above, and the two optional kinds were never brought with
  // it.
  //
  // THE TWO CASES ARE SEPARATE NOW BECAUSE THEY NEED OPPOSITE ANSWERS: an
  // omitted optional placement is a real answer that means "wherever it fits",
  // and a NAMED destination that cannot resolve is the model asking for
  // something this site has not got. Substituting the home page for the second
  // is the invention the whole never-invent rule exists for — a printed code
  // or a 3D scene appearing on a page nobody chose.
  //
  // A STRING THAT PARSES AS NO ROUTE AT ALL IS ALSO "NAMED AND UNRESOLVABLE".
  // `route()` answers "" for `"the gallery page"` exactly as it does for a
  // shape it refuses, and both are the designer having named a destination.
  // Only a genuinely ABSENT field reaches the shortcut.
  const onPage = (named) => {
    const r = route(named);
    if (r) return going.includes(r) ? { page: r } : { bad: true };
    if (typeof named === "string" && named.trim()) return { bad: true };
    if (going.length === 1) return { page: going[0] };
    return { page: "" };
  };
  // ── A KIT NAME IS CHECKED AGAINST THE KIT (owner, 2026-09-14) ───────────
  //
  // *"Check kit names against the real available catalog while preserving
  // valid custom TSX components."*
  //
  // The `component` and `page` tools both say, in as many words, *"Naming a
  // component that does not exist is refused and costs nothing."* MEASURED: it
  // was not. `components: ["not-a-kit-part"]` passed the cleaner unchanged and
  // was written into the directive — *"the kit component: not-a-kit-part —
  // its exact props are listed above; call it, do not rewrite it"* — about a
  // component whose props are not listed above because there are none.
  //
  // `COMPONENT_MENU` is the catalog the tool itself offers the model, derived
  // from the kit rather than typed, so this cannot drift from what was asked
  // for. An unknown name is DROPPED AND NAMED rather than refusing the whole
  // item: an answer naming one real part and one typo is mostly right, and the
  // `no-component` refusal below still fires when nothing usable is left.
  // **`tsx` is untouched** — a part written for this site is not in the kit by
  // definition, and refusing it would close the escape hatch the kit exists to
  // have.
  const kitNames = (v, max, ctx) => {
    const out = [];
    const note = (n) => {
      if (n && ctx && Array.isArray(ctx.unknownKit) && !ctx.unknownKit.includes(n)) ctx.unknownKit.push(n);
    };
    // ⚠ A NAME THAT IS NOT EVEN A NAME NEVER REACHED THIS LOOP (2026-09-20).
    // `names()` bins anything failing `NAME` — `"Hero Section"`, `"not_in_kit"`
    // — BEFORE the kit check below could record it, so those two reached none
    // of the three lists and the customer was told the section was added. The
    // consequence is identical to an unknown kit name (the component is not
    // built), so it is reported through the same field rather than a fourth
    // one; the pre-pass is over the RAW list, which is the only place they
    // still exist.
    for (const x of Array.isArray(v) ? v : []) {
      const n = str(x, 60).toLowerCase();
      if (n && !NAME.test(n)) note(n);
    }
    for (const n of names(v, max)) {
      if (KIT_COMPONENTS.has(n)) { out.push(n); continue; }
      note(n);
    }
    return out;
  };
  // ONE ITEM, cleaned. `{ ok, value }` or `{ ok: false, why }`.
  const one = (v, ctx) => {
    switch (kind) {
      case "page": {
        const path = route(v.path);
        if (!path || path === "/") return { ok: false, why: "no-path" };
        // A PAGE THE SITE HAS, OR ONE THIS SAME CHANGE IS ALREADY ADDING —
        // `ctx.paths` is this answer's own siblings and `planned` is a page
        // decided by an earlier call of the same message. Both are the same
        // refusal, because a route can only be made once.
        if (going.includes(path) || ctx.paths.includes(path)) return { ok: false, why: "page-exists" };
        const name = str(v.name, 60);
        const purpose = str(v.purpose, 300);
        if (!name || !purpose) return { ok: false, why: "no-plan" };
        const sections = lines(v.sections, MAX_SECTIONS, 200);
        const components = kitNames(v.components, MAX_COMPONENTS, ctx);
        if (!sections.length && !components.length) return { ok: false, why: "no-plan" };
        ctx.paths.push(path);
        return { ok: true, value: { path, file: fileOfRoute(path), name, purpose, sections, components, tsx: parts(v.tsx, ctx), link: str(v.link, 200) } };
      }
      case "component": {
        // `page` IS REQUIRED ON THIS TOOL, so both of `onPage`'s refusing
        // answers are one refusal here: a named route that does not resolve,
        // and nothing named on a site with more than one page. Unchanged in
        // outcome from before the three-state — stated rather than implied,
        // because the OPTIONAL kinds below now part company on exactly this.
        const at = onPage(v.page);
        if (at.bad || !at.page) return { ok: false, why: "no-page" };
        const page = at.page;
        const does = str(v.does, 300);
        if (!does) return { ok: false, why: "no-plan" };
        const components = kitNames(v.components, MAX_COMPONENTS, ctx);
        const tsx = parts(v.tsx, ctx);
        // THE COMPONENT IS THE ADDITION: an answer that names none — no kit
        // part and nothing written for this site — is a band the page writer
        // would have to invent, which is the old "section" reading the owner
        // corrected. Refused by name.
        if (!components.length && !tsx.length) return { ok: false, why: "no-component" };
        return { ok: true, value: { page, where: str(v.where, 200), does, components, tsx } };
      }
      // ── A PHOTOGRAPH, WHEN THIS CHANGE IS MAKING THE PLACE FOR IT ─────────
      //
      // `onPage` is the SAME destination reader every other placing kind uses,
      // so a picture on a page this change is adding resolves through `going`
      // and a picture on a page nobody has is refused by name — never moved to
      // the home page, which is the substitution the owner corrected on the
      // component tier and is worse here, because a photograph is bought.
      //
      // `describe` IS SLICED AT `MAX_PROMPT_CHARS` AND NOT REFUSED FOR LENGTH,
      // because that is exactly what `imagePrompt` does to it one hop later:
      // refusing here would turn a long, usable brief into no picture at all,
      // where the spend path's own rule is to send the first 240 characters.
      // An EMPTY one is refused — `planImages` deliberately never sends a token
      // with nothing inside it, so an undescribed picture is a slot nothing
      // fills and a customer told a photograph was added.
      case "photo": {
        // REQUIRED HERE TOO — a photograph's identity is its placement, so a
        // picture with nowhere to go is a picture nothing can report on.
        const at = onPage(v.page);
        if (at.bad || !at.page) return { ok: false, why: "no-page" };
        const page = at.page;
        const describe = str(v.describe, MAX_PROMPT_CHARS);
        if (!describe) return { ok: false, why: "no-photo" };
        // ── THE NAME, AND WHY IT IS REFUSED RATHER THAN INVENTED ────────────
        //
        // A name derived here would be OURS, and the whole point is that the
        // designer can point a requirement at this picture — a label it never
        // wrote is one it can never name. Refusing costs one round trip and no
        // money: this runs in the kinds loop, long before `buySitePhotos`, and
        // a list kind refuses the ENTRY rather than the answer, so the other
        // pictures are unaffected and this one is named in `skipped`.
        //
        // AND IT IS REFUSED RATHER THAN SLICED, which is the opposite of what
        // the `describe` above it gets — because they are different kinds of
        // value. A sliced brief is still the picture somebody asked for; a
        // sliced NAME is a label the designer never wrote, so the requirement
        // echoing the name it DID write resolves against nothing and reads as
        // work that was never done.
        const name = str(v.name, MAX_PHOTO_NAME + 16).toLowerCase();
        if (name.length > MAX_PHOTO_NAME || !PHOTO_NAME.test(name)) return { ok: false, why: "no-photo-name" };
        // TWO PICTURES IN ONE ANSWER MAY NOT SHARE A NAME, or the reference
        // resolves to whichever the reader met first — which is the route
        // collapse this name exists to end, one field over.
        if (ctx.photos.includes(name)) return { ok: false, why: "no-photo-name" };
        ctx.photos.push(name);
        return { ok: true, value: { page, describe, name } };
      }
      case "table": {
        const t = v.table && typeof v.table === "object" && !Array.isArray(v.table) ? v.table : null;
        const name = t ? str(t.name, 63).toLowerCase() : "";
        if (!t || !TABLE_NAME.test(name)) return { ok: false, why: "no-table" };
        if (ctx.tables.includes(name)) return { ok: false, why: "no-table" };
        // ⚠ A BARE-STRING COLUMN IS A COLUMN (2026-09-20). This filter kept
        // only objects, so `["who","email","note"]` became `[]` — the table
        // created with nothing in it, or, mixed with objects, created SHORT.
        // MEASURED before the fix: `["who", {name:"email"}, "note"]` kept one
        // column, `skipped` was `[]`, and `auditTier` answered all four buckets
        // empty — `columns` is truthy so it is not `unexpressed`, and it is an
        // array so `scalar()` can never call it `changed`. Structurally
        // invisible, in the step that exists to say what it could not do.
        //
        // PRESERVED THROUGH THE ENGINE'S OWN NORMALISATION, NOT REPORTED AWAY.
        // `normalizeSchema` defaults a column with a name and no type to
        // `text` — driven, not read — so `"email"` → `{name:"email"}` is the
        // requested work arriving intact rather than a replacement invented
        // here. Reporting it instead would be honest and would still cost the
        // customer the column they asked for.
        //
        // AND WHAT IS GENUINELY UNREADABLE IS NAMED. A number, a null, an
        // object with no usable name: there is nothing to normalise and a
        // silent drop is what this whole correction is about.
        const columns = [];
        for (const c of Array.isArray(t.columns) ? t.columns : []) {
          const bare = typeof c === "string" ? str(c, 63) : "";
          if (bare) { columns.push({ name: bare }); continue; }
          if (c && typeof c === "object" && !Array.isArray(c) && str(c.name, 63)) { columns.push(c); continue; }
          const shown = typeof c === "string" || typeof c === "number" ? String(c).slice(0, 63) : "";
          ctx.dropped.push({ what: "column", name: shown });
        }
        // A TABLE WITH NOTHING IN IT IS NOTHING — unless it names one the site
        // has, to give it payment or a public view; `mergeAddonSchema` keeps
        // exactly those on an existing table and the engine refuses the rest.
        const exists = (Array.isArray(s.tables) ? s.tables : []).map((x) => str(x, 63).toLowerCase()).includes(name);
        if (!columns.length && !(exists && (t.payment || t.publicView))) return { ok: false, why: "no-columns" };
        const seed = (Array.isArray(v.seed) ? v.seed : []).filter((r) => r && typeof r === "object" && !Array.isArray(r)).slice(0, MAX_ADD_SEED_ROWS);
        ctx.tables.push(name);
        return { ok: true, value: { table: { ...t, name, columns }, seed, shows: route(v.shows), exists } };
      }
      // ── THE OTHER THREE TIERS (2026-09-03) ───────────────────────────────
      //
      // Cleaned to what the engine will take — `normalizeSchema` refuses the
      // rest by name — and refused by name here for the three slips a model
      // makes: no body, a job naming a function nobody has, a connection to a
      // service that is not https. The engine's `CREATE OR REPLACE` means a
      // function the site already lists is REPLACED when named; that is what
      // "add a cancel beside the lookup" needs, and the reply says `altered`.
      case "function": {
        // ── PRIVACY IS NEVER COERCED, AND IT IS ASKED FIRST (2026-09-14) ────
        //
        // Owner: *"Reject malformed internal values before creating the
        // function. Also treat explicit false as a meaningful value."*
        //
        // `internal: v.internal === true` read ANY non-`true` value as public.
        // MEASURED: `internal: "yes"` — truthy, and a plausible thing for a
        // model to write — cleaned to `internal: false`, so the function was
        // created with `GRANT EXECUTE … TO anonymous` and any visitor could
        // call it. `cleanAdd` answered `ok` and `skipped: []`: a permission
        // inverted in silence, on the one field whose whole job is privacy.
        // A value we cannot read is refused; cannot-tell must never read as
        // "public", which is the most permissive answer available.
        //
        // AND `definer: false` IS A REQUEST, NOT NOISE. It asks for INVOKER
        // rights — less privilege, not more — and the engine supports it
        // (`site-functions.test.mjs` drives it). This step cannot express it:
        // the cleaner does not carry the key and `normalizeSchema` applies
        // `f.definer !== false`, so passing it through silently would create
        // the opposite of what was asked. Refused by name, because quietly
        // building a SECURITY DEFINER function for somebody who asked for the
        // safer one is the worst of the three outcomes.
        //
        // BOTH ARE ASKED BEFORE ANYTHING ELSE about the item, so a privacy
        // problem is always the reason the customer hears — never a complaint
        // about the body from an item that should not be built at all.
        if (v.internal !== undefined && typeof v.internal !== "boolean") return { ok: false, why: "bad-internal" };
        if (v.definer === false) return { ok: false, why: "no-invoker" };
        // ── THE LANGUAGE IS CARRIED, AND AN UNKNOWN ONE IS REFUSED ──────────
        //
        // This branch REBUILDS the item out of the keys it knows, so until
        // today a declared `language` was binned one hop after it was written
        // and the function was created `LANGUAGE sql` whatever it asked for —
        // the engine supporting `plpgsql` perfectly the whole time. It was
        // reported honestly (`unexpressed`, its own customer clause) and still
        // lost; carrying it is what closes that.
        //
        // REFUSED RATHER THAN DEFAULTED, which is the opposite of what the
        // ENGINE does two modules over and is deliberate. `normalizeSchema` is
        // tolerant because a STORED spec passes through it on every later
        // apply and one unreadable word must not fail the whole thing. Here a
        // PERSON asked for this in this message and can be told; and the
        // failure mode of defaulting is the worst available — a body written
        // for plpgsql, silently created as SQL, failing at CREATE with a
        // syntax error nobody can trace back to a word that was dropped.
        // Case-insensitive because Postgres's own language names are, and
        // `PLpgSQL` is a plausible thing for a model to write.
        const language = v.language === undefined || v.language === null || v.language === ""
          ? undefined
          : String(v.language).trim().toLowerCase();
        if (language !== undefined && !FN_LANGUAGES.includes(language)) return { ok: false, why: "bad-language" };
        const name = str(v.name, 63).toLowerCase();
        if (!TABLE_NAME.test(name) || ctx.functions.includes(name)) return { ok: false, why: "no-function" };
        // REFUSED, NEVER CUT. `str(v.body, 8000)` sliced here and the engine
        // sliced again at `MAX_FN_BODY`, so a 6,000-character body arrived
        // whole, was reported as added, and reached Postgres as 4,000
        // characters of a statement — a `CREATE FUNCTION` that either fails
        // with a syntax error nobody can trace to a truncation or succeeds
        // doing less than it says. Measured: 5,000 in, 4,000 out, silently.
        const body = typeof v.body === "string" ? v.body.trim() : "";
        const returns = str(v.returns, 80);
        if (!body || !returns) return { ok: false, why: "no-function" };
        if (body.length > MAX_FN_BODY) return { ok: false, why: "body-too-long" };
        const args = (Array.isArray(v.args) ? v.args : [])
          .filter((a) => a && typeof a === "object" && TABLE_NAME.test(str(a.name, 63).toLowerCase()) && str(a.type, 20))
          .map((a) => ({ name: str(a.name, 63).toLowerCase(), type: str(a.type, 20) }));
        const exists = (Array.isArray(s.functions) ? s.functions : []).map((x) => str(x, 63).toLowerCase()).includes(name);
        ctx.functions.push(name);
        // ABSENT STAYS ABSENT — THE KEY ITSELF, not merely its value. A
        // `language: undefined` would be byte-identical on the WIRE
        // (`JSON.stringify` omits it) and a different OBJECT, and the objects
        // are what `auditTier`, `keptItem` and `appliedFacts` read keys off.
        // So a declaration that said nothing about its language cleans to
        // exactly the shape it cleaned to before this field existed, and the
        // default lives in ONE place — `fnLanguage` — rather than a second
        // copy here that could drift from it.
        return { ok: true, value: { name, args, returns, body, internal: v.internal === true, ...(language === undefined ? {} : { language }), exists } };
      }
      case "api": {
        const name = str(v.name, 63).toLowerCase();
        if (!TABLE_NAME.test(name) || ctx.apis.includes(name)) return { ok: false, why: "no-api" };
        const url = str(v.url, 2000);
        if (!/^https:\/\/[^\s/]+/i.test(url)) return { ok: false, why: "bad-url" };
        const method = str(v.method, 4).toUpperCase() === "POST" ? "POST" : "GET";
        const headers = v.headers && typeof v.headers === "object" && !Array.isArray(v.headers)
          ? Object.fromEntries(Object.entries(v.headers).filter(([k, x]) => typeof k === "string" && typeof x === "string").slice(0, 12)) : undefined;
        // THE SAME WALK THE ENGINE DOES, so the names this refusal reasons
        // about and the names `normalizeApi` will store cannot differ. It took
        // strings only, which quietly dropped every parameter a designer
        // described rather than named — the metadata arriving and being binned
        // one hop after it was written, which is this repository's own
        // `readAddAnswer` finding in the tier below it.
        const pinfo = cleanParams(v.params, v.paramInfo);
        const params = pinfo.names;
        // A SKETCH THAT CANNOT BE READ REFUSES THE CONNECTION, where the engine
        // merely drops it. The difference is who is listening: here a person
        // asked for this in this message and can be told to say it again, and
        // the alternative is a page written blind against a service nobody
        // described — which is the exact defect this field exists to close. A
        // connection that declares NO sketch is not refused: that is every
        // connection made before today and an honest answer for a service the
        // designer does not know.
        const shape = cleanShape(v.returns);
        if (shape && !shape.ok) return { ok: false, why: shape.why };
        const cred = cleanCredential(v.credential);
        if (cred && !cred.ok) return { ok: false, why: cred.why };
        const cacheSeconds = Number.isFinite(Number(v.cacheSeconds)) ? Math.max(0, Math.min(3600, Math.round(Number(v.cacheSeconds)))) : undefined;
        // THE SAME SILENT SLICE, ONE TIER OVER, AND A GET CANNOT SEE IT.
        // `normalizeApi` cuts a POST body at `MAX_API_BODY` and a GET's body
        // normalises to `""` WHATEVER it declared — so an oversized body is
        // invisible to every fixture that does not send a real POST. Measured
        // through a POST: 5,000 in, 4,000 out. Refused here rather than cut,
        // because a connection that POSTs half a request to somebody else's
        // server is a failure the customer can neither see nor act on.
        const rawBody = method === "POST" && typeof v.body === "string" ? v.body.trim() : "";
        if (rawBody.length > MAX_API_BODY) return { ok: false, why: "body-too-long" };
        const exists = (Array.isArray(s.apis) ? s.apis : []).map((x) => str(x, 63).toLowerCase()).includes(name);
        ctx.apis.push(name);
        return { ok: true, value: { name, url, method, ...(headers ? { headers } : {}), ...(rawBody ? { body: rawBody } : {}), params,
          ...(pinfo.info ? { paramInfo: pinfo.info } : {}),
          ...(shape && shape.ok ? { returns: shape.shape } : {}),
          ...(cred && cred.ok ? { credential: cred.credential } : {}),
          ...(cacheSeconds !== undefined ? { cacheSeconds } : {}), exists } };
      }
      case "job": {
        const name = str(v.name, 63).toLowerCase();
        if (!TABLE_NAME.test(name) || ctx.jobs.includes(name)) return { ok: false, why: "no-job" };
        const fn = str(v.fn, 63).toLowerCase();
        // THE FUNCTION MUST EXIST AND BE INTERNAL — `site.jobFns` is that
        // list: the site's stored internal functions plus the ones the
        // `function` designer declared a call earlier in this same message
        // (the route appends them as they are cleaned, because each kind is
        // its own call and `ctx` never crosses one). The engine drops a job
        // naming any other function, silently; this is the sentence for it.
        const known = (Array.isArray(s.jobFns) ? s.jobFns : []).map((x) => str(x, 63).toLowerCase());
        if (!TABLE_NAME.test(fn) || !known.includes(fn)) return { ok: false, why: "no-job-fn" };
        const everyAsked = Number.isFinite(Number(v.everyMinutes)) ? Math.max(MIN_JOB_MINUTES, Math.round(Number(v.everyMinutes))) : MIN_JOB_MINUTES;
        // A CLOCK TIME (owner, 2026-09-03) belongs to a daily-or-slower job
        // and is refused by name otherwise — the engine would drop the time
        // and keep the interval, which is a job that runs at the wrong hour
        // reported as the one they asked for. The zone is stamped by the
        // route from the owner's browser; this module never knows it.
        const at = str(v.at, 5);
        // ── A JOB THAT RUNS ONCE (2026-09-19) ────────────────────────────
        //
        // The interval is forced BEFORE the clock-time test, for the reason
        // `normalizeJob` forces it: `at` belongs to a daily-or-slower job, and
        // a model writing `{on, at, everyMinutes: 60}` — thinking about a date
        // rather than an interval, which is exactly what a one-time job is —
        // would otherwise be refused `bad-time` for a combination that is
        // perfectly sensible.
        const on = str(v.on, 10);
        const once = on ? onceDay(on) : null;
        if (on && !once) return { ok: false, why: "bad-date" };
        const every = once ? MAX_JOB_MINUTES : everyAsked;
        if (at && (!AT_RE.test(at) || every < 1440)) return { ok: false, why: "bad-time" };
        // A DATE WITH NO TIME IS REFUSED HERE, where there is somebody to tell
        // — `normalizeJob` refuses it too, one layer down, but silently.
        if (once && !at) return { ok: false, why: "no-time" };
        // …AND A DATE ALREADY GONE, which is the one refusal only THIS layer
        // can make well. The designer knows today's date; the scheduler only
        // ever sees a job that will never be selected, and says nothing to
        // anybody. Telling the customer now beats a reminder about a thing
        // that has already happened — which is to say, beats silence.
        // `s.today` is the site's OWN local date, stamped by the route from the
        // browser's zone — the same zone `at` is read in. Absent, the check
        // stands down rather than guessing: comparing a local date against UTC
        // would refuse a perfectly good "today" for anybody west of Greenwich
        // for most of their working day, which is a worse failure than the one
        // it prevents.
        if (once && s.today && once < onceDay(s.today)) return { ok: false, why: "past-date" };
        const exists = (Array.isArray(s.jobs) ? s.jobs : []).map((x) => str(x, 63).toLowerCase()).includes(name);
        ctx.jobs.push(name);
        return { ok: true, value: { name, fn, everyMinutes: every, ...(at ? { at } : {}), ...(once ? { on } : {}), exists } };
      }
      case "qr": {
        let points = str(v.points, 1000);
        const label = str(v.label, 120);
        if (!points || !label) return { ok: false, why: "no-destination" };
        // THE SITE'S OWN PAGES ARE REAL DESTINATIONS (run 26, 2026-09-03). A
        // route answered bare ("/prices") is resolved against the site's
        // address — the designer is shown both — so a code that opens one of
        // its pages is never "invented". A route the site does not have is
        // refused by name, because a QR on a live site pointing at a 404 is
        // exactly the failure the never-invent rule exists for; and a site
        // whose address could not be read refuses rather than guessing one.
        // A PAGE THIS SAME CHANGE IS ADDING COUNTS (2026-09-17). This asked
        // `have`, so "add a gallery page and a QR code that opens it" — one
        // message, one addition, the obvious thing to ask for — refused the
        // code with `no-such-page` about a page the same reply was building.
        // The route is real by the time either is published, and the ONE
        // publish is what makes that true rather than a hope: the page and the
        // code go out together or neither does.
        // ⚠ AND THE SAME CLAIM SPELLED WHOLE IS THE SAME CLAIM (2026-09-20).
        // Only a destination starting with `/` was ever checked, so the two
        // spellings of one address got opposite answers: `/nope` refused
        // `no-such-page`, and `https://<site>/nope` drawn, baked and published
        // pointing at a 404. The unchecked spelling is the one the tool offers
        // FIRST (*"a full URL, `tel:` …"*) and `siteNote` hands the designer
        // this site's own address, so it is the encouraged path rather than an
        // unusual one — and a QR is the one thing here somebody PRINTS.
        //
        // `qrSiteRoute` IS THE ONE READER, shared with `deadQrs`, and `ours` is
        // what makes this safe to tighten: an external URL, a `tel:`, a `WIFI:`
        // and a `mailto:` are destinations we have no business validating and
        // are PRESERVED untouched. Only our own origin naming a route the site
        // has not got — and is not adding — is refused, against the same
        // `going` the relative branch uses, so a planned page counts in both
        // spellings.
        const base = siteAddress(s.url);
        if (points.startsWith("/")) {
          const own = route(points);
          if (!own || !going.includes(own)) return { ok: false, why: "no-such-page" };
          if (!base) return { ok: false, why: "no-address" };
          points = new URL(own, base).href;
        } else {
          const mine = qrSiteRoute(points, base);
          if (mine.ours && !going.includes(mine.route)) return { ok: false, why: "no-such-page" };
        }
        // THE SAME READER THE DRAWING USES, asked here so a code that cannot be
        // drawn is refused by name rather than silently missing from the site.
        if (!readQrText(points).text) return { ok: false, why: "bad-destination" };
        // NAMED, AND NOT ONE THE SITE HAS (2026-09-03, a site carries several):
        // the name is the file and the binding, derived from the caption when
        // the answer gave none; a second code pointing where an existing one
        // does is the one addition refused — the edit lane changes that one.
        const name = qrName(v.name, label);
        if (!name) return { ok: false, why: "no-name" };
        const codes = qrList(s.qr);
        if (codes.length >= MAX_QRS) return { ok: false, why: "too-many" };
        if (codes.some((c) => c.name === name)) return { ok: false, why: "same-name" };
        if (codes.some((c) => c.points.toLowerCase() === points.toLowerCase())) return { ok: false, why: "same-code" };
        // ⚠ WHERE THE CODE IS SHOWN IS OPTIONAL, AND A NAMED PAGE IS NOT.
        // `page` here is placement, not destination, so an ABSENT one is a real
        // answer — "wherever it fits" — and `""` travels on as it always has.
        // A route the designer NAMED and the site has not got is refused
        // instead of being rendered as the home page by `at()`. Two different
        // facts that shared one empty string until 2026-09-20.
        const at = onPage(v.page);
        if (at.bad) return { ok: false, why: "no-page" };
        return { ok: true, value: { name, points, label, page: at.page, where: str(v.where, 200) } };
      }
      case "three": {
        const scene = str(v.scene, 600);
        if (!scene) return { ok: false, why: "no-scene" };
        // OPTIONAL PLACEMENT, NAMED PAGE REFUSED — the `qr` rule above, for the
        // same reason: `sceneDirective` renders `""` as the home page, so a
        // scene the designer placed on a route this site has not got was built
        // on the front page and reported as done.
        const at = onPage(v.page);
        if (at.bad) return { ok: false, why: "no-page" };
        return { ok: true, value: { scene, page: at.page } };
      }
      default:
        return { ok: false, why: "no-kind" };
    }
  };
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  // ── A LIST KIND: every usable item is kept, the rest are named ──────────
  //
  // No low limits (owner): a message may add several pages, components or
  // tables at once, so the answer is a list and one bad entry must not throw
  // the good ones away. Each entry is cleaned on its own; the ones refused
  // are returned as `skipped` with their token, so the customer can be told
  // which was left out and why. An answer with NO usable entry is refused
  // with the first entry's reason — the same sentence a single bad answer
  // gets. A bare object is tolerated as a list of one.
  if (LIST_ADDS.includes(kind)) {
    const cap = kind === "page" ? MAX_ADD_PAGES : kind === "table" ? MAX_ADD_TABLES
      : kind === "function" ? MAX_ADD_FUNCTIONS : kind === "api" ? MAX_ADD_APIS : kind === "job" ? MAX_ADD_JOBS
      // THE PLATFORM'S OWN PHOTOGRAPH CEILING, not a constant of this file's:
      // `planImages` and the design step both slice at `IMAGE_CAP`, so a wider
      // cap here would clean an entry nothing downstream will ever buy.
      : kind === "photo" ? IMAGE_CAP
      : MAX_ADD_COMPONENTS;
    const raw = Array.isArray(value) ? value : (isObj(value) ? [value] : []);
    const usable = raw.filter(isObj);
    const items = usable.slice(0, cap);
    if (!items.length) return { ok: false, why: "nothing" };
    const ctx = freshCtx();
    const kept = [], skipped = [];
    const named = (v) => str(v.path, 120) || str(v.name, 120) || (isObj(v.table) ? str(v.table.name, 63) : "") || str(v.does, 80);
    for (const v of items) {
      const r = one(v, ctx);
      if (r.ok) kept.push(r.value);
      else skipped.push({ why: r.why, name: named(v) });
    }
    // THE CAP WAS A SILENT DROP AND IT SAT ONE LINE ABOVE THE LIST THAT EXISTS
    // TO NAME DROPS. `.slice(0, cap)` ran BEFORE the loop, so an answer with
    // seven connections against `MAX_ADD_APIS` of four lost three of them with
    // nothing on `skipped`, nothing in the reply, and a customer told their
    // addition was made. Every other refusal in this file is a sentence; this
    // one is now one too.
    for (const v of usable.slice(cap)) skipped.push({ why: "over-cap", name: named(v) });
    // THE NAMES THAT ARE NOT IN THE KIT ride the result rather than `skipped`:
    // `skipped` is one entry per ITEM refused, and these are names dropped out
    // of items that were otherwise built. Reported either way — a silent drop
    // is the defect this whole round is about.
    const unknownKit = ctx.unknownKit.slice(0, 12);
    // AND THE SAME RULE FOR A FIELD BINNED INSIDE AN ITEM (2026-09-20) — a
    // column, a hand-written component. Same argument as the line above: one
    // `skipped` entry per ITEM cannot carry a loss inside one that was built.
    const dropped = ctx.dropped.slice(0, 12);
    const extra = { ...(unknownKit.length ? { unknownKit } : {}), ...(dropped.length ? { dropped } : {}) };
    if (!kept.length) return { ok: false, why: skipped[0].why, skipped, ...extra };
    return { ok: true, value: kept, skipped, ...extra };
  }
  const v = isObj(value) ? value : null;
  if (!v) return { ok: false, why: "nothing" };
  // ONE SHAPE, BOTH CALLERS. The two literals had drifted — this one carried
  // three keys against the list path's six — which is free while every reader
  // is `ctx.x.includes(...)` on a key its own kind sets, and a `TypeError` the
  // day a list kind stops being one. `freshCtx` is the one definition.
  //
  // ⚠ THE DROP REPORT RIDES HERE TOO, AND IT IS DEAD BY A NEIGHBOUR'S RULE
  // RATHER THAN BY ITS OWN — MEASURED 2026-09-20, after a sweep mutant cutting
  // it survived. The single kinds are exactly `qr` and `three` (`ADD_KINDS`
  // less `LIST_ADDS`), and neither has a sub-field to bin: every writer of
  // `ctx.dropped` is inside a LIST kind — the column loop in `table`, and
  // `parts()` in `page` and `component` — so `dropped.length` is 0 on every
  // input this path can take.
  //
  // IT STAYS, because the deadness is a fact about WHICH KINDS ARE LISTS and
  // not about this expression: the day `qr` or `three` gains a droppable field,
  // or a list kind moves across, this is the difference between the drop
  // keeping its channel and going quiet. `test/site-add.test.mjs` asserts the
  // partition that makes it dead, so that day is a red run rather than a drift.
  const ctx = freshCtx();
  const out = one(v, ctx);
  const dropped = ctx.dropped.slice(0, 12);
  return dropped.length ? { ...out, dropped } : out;
}

/**
 * What the customer is told when an answer was refused, by its token.
 *
 * A CONSIDERED REFUSAL DOES NOT CLIMB THE LADDER — the route's own rule: the
 * rung above rewrites the whole site for ~25 credits, and every one of these
 * has a one-sentence answer the customer can act on. Composed here so a test
 * can drive every token to a sentence and the route cannot fall through to a
 * blank one.
 */
/**
 * How often a job runs, in words — "every day at 09:00", "every week",
 * "every 30 minutes". Shared by the directive and the note; the browser's
 * `jobWords` says the same thing to the customer and cannot import this.
 */
export function jobEvery(j) {
  const m = Number(j && j.everyMinutes);
  const every = !Number.isFinite(m) || m <= 0 ? ""
    : m % 10080 === 0 ? (m === 10080 ? "every week" : "every " + (m / 10080) + " weeks")
    : m % 1440 === 0 ? (m === 1440 ? "every day" : "every " + (m / 1440) + " days")
    : m % 60 === 0 ? (m === 60 ? "every hour" : "every " + (m / 60) + " hours")
    : "every " + m + " minutes";
  const at = j && typeof j.at === "string" && AT_RE.test(j.at) ? " at " + j.at + (typeof j.tz === "string" && j.tz ? " (" + j.tz + ")" : "") : "";
  return every + at;
}

export function addRefusal(why, kind) {
  switch (why) {
    case "page-exists": return "This site already has that page — ask me to change it instead.";
    case "no-path": return "I couldn't tell what address the new page should have — say it, like /gallery.";
    case "no-page": return "I couldn't tell which page that goes on — name the page.";
    case "no-plan": return "I couldn't work out what to put on it from that — say what it should show.";
    case "no-component": return "I couldn't tell which component to add — say what you want on the page: a form, a map, an FAQ, testimonials, a price list…";
    case "no-table": return "I couldn't tell what the site should store from that — say what a visitor sends in, or what the business keeps.";
    case "no-columns": return "That table would have nothing in it — say what it should hold.";
    case "no-function": return "I couldn't turn that into a database function — say what it should look up, change or receive, and I'll write it.";
    case "no-api": return "I couldn't tell which outside service to connect to — name the service and what the page should read from it.";
    case "bad-url": return "An outside connection has to be an https address — that one isn't. Nothing was changed.";
    // A SKETCH THAT CANNOT BE READ IS REFUSED RATHER THAN DROPPED, and the
    // sentence says what to do about it. The alternative — keep the connection
    // and lose the description — is a page written blind against a service
    // nobody described, which is the defect this field exists to close.
    //
    // ONE SENTENCE FOR THE MALFORMED-SKETCH CASES, deliberately. They are
    // one mistake from where the customer stands ("the answer wasn't described
    // in a way I could use") and a sentence each about nesting depth, array
    // arity and what may sit at the root would be this platform explaining its
    // own parser. The
    // developer record keeps the reason; the customer gets the action.
    case "shape-leaf": case "shape-array": case "shape-empty": case "shape-key":
    case "shape-too-big": case "shape-too-deep": case "shape-top":
      return "I couldn't read the description of what that service sends back, so I've left the site as it was — ask again and say roughly what the answer looks like, or just name the service and I'll connect it without it.";
    case "credential-url": return "The sign-up page for that service has to be an https address — that one wasn't. Nothing was changed.";
    case "credential-shape": return "I couldn't read where the key for that service comes from — ask again and name the service, or leave it out and I'll connect it anyway.";
    case "no-job": return "I couldn't tell what should happen on a timer — say what to send, to whom, and how often.";
    case "no-job-fn": return "That scheduled job names a function this site doesn't have — describe what it should send and I'll write both together.";
    case "bad-time": return "A time of day only fits a job that runs once a day or less often — say how often it should run, or drop the time and it runs on the interval. Nothing was changed.";
    // THREE SENTENCES FOR THREE REFUSALS, because they need three different
    // things done about them and a shared one would send the customer looking
    // in the wrong place. Each says what to do rather than what went wrong.
    case "bad-date": return "I couldn't read the date that job should run on — give it as a day, a month and a year, like 3 October 2026. Nothing was changed.";
    case "no-time": return "A job that runs once needs a time of day as well as a date — say what time it should go out, because there's no second chance for it to be right. Nothing was changed.";
    case "past-date": return "That date has already gone, so the job would never run. Give a date in the future and I'll set it up. Nothing was changed.";
    case "no-destination": return "A QR code needs a real destination — a link, a phone number, a wifi network — and that wasn't in the message. Nothing was changed.";
    case "bad-destination": return "A QR code can carry a link, a phone number, an email address, a wifi network or plain text — not that. Nothing was changed.";
    case "no-such-page": return "That code would open a page this site doesn't have. Name one of its pages, or a link, a number or an address — nothing was changed.";
    case "no-address": return "I couldn't read this site's own address just now, so a code opening one of its pages can't be made yet — try again in a moment. Nothing was changed.";
    case "no-name": return "I couldn't give that QR code a name — say what it is for in a word or two, like \"wifi\" or \"booking\".";
    case "same-name": return "This site already has a QR code with that name — ask me to change it, or give the new one a different name.";
    case "same-code": return "This site already has a QR code pointing there — ask me to change where it sits or what it says instead.";
    case "too-many": return "This site already carries as many QR codes as it can — ask me to change one of them instead.";
    case "no-scene": return "I couldn't tell what the 3D scene should show — say what it is and where it goes.";
    // A PICTURE NOBODY DESCRIBED IS A SLOT NOTHING FILLS. The words are the
    // prompt an image model is paid to draw, so an empty one is refused rather
    // than sent — and the sentence asks for the one thing that unblocks it.
    case "no-photo": return "I couldn't tell what the photograph should show — say what's in it, like \"the workshop bench under the window\", and I'll make it.";
    // THE CUSTOMER'S WORDS FOR A LABEL THEY NEVER SEE. It is bookkeeping and
    // saying so would be no use to them, so this asks for the ONE thing that
    // fixes it from their side: say which pictures you want, separately.
    case "no-photo-name": return "I got two pictures muddled up — say which photographs you want one at a time and I'll place each of them.";
    // THE TWO THE ENGINES USED TO DO SILENTLY. A cut body and a dropped entry
    // both used to ship as a success; they are sentences the customer can act
    // on, which is the whole point of refusing rather than slicing.
    case "body-too-long": return "That one needs more code than I can put in a single step — ask for it in smaller pieces and I'll add them one at a time. Nothing was changed.";
    case "over-cap": return "That's more of those than I can add in one go — ask for the rest in another message and I'll add them too.";
    // ── THE TWO PERMISSION REFUSALS (2026-09-14) ────────────────────────────
    //
    // Both say what was NOT built rather than describing the setting, because
    // the customer asked for a feature and not for a privilege model. The
    // first is a value nobody could read; the second is a real request this
    // step cannot carry, so it says which step can.
    case "bad-internal": return "I couldn't tell whether that should be private to the site or callable from a page, so I didn't create it — nothing is worse than getting that one wrong. Say who should be able to use it and I'll add it.";
    case "no-invoker": return "That one asked to run with reduced database permissions, which I can't set up from here — so I didn't create it rather than quietly giving it more access than was asked for. Nothing was changed.";
    // NAMED, because the alternative is the failure this refusal exists to
    // stop: a body written for one language, created as another, failing at
    // CREATE with a syntax error nothing connects back to a dropped word.
    case "bad-language": return "That one asked to be written in a database language this platform doesn't run, so I left it alone rather than quietly building it in a different one. Say it again and I'll write it in plain SQL, or in PL/pgSQL if it needs steps and conditions. Nothing was changed.";
    default: return "I couldn't work out what to add from that" + (kind ? " (" + kind + ")" : "") + " — say what you want on the site and where.";
  }
}

/**
 * The site already has the thing they asked to add — said by name, with the
 * door that does change it. The edit path refuses to CREATE these two and
 * sends the message here; this is the mirror, so the two doors never bounce a
 * customer between them.
 */
export function alreadyReply(kind) {
  // `qr` LEFT THIS ON 2026-09-03: a site carries several codes, so a second is
  // an addition; only a duplicate is refused, and `cleanAdd` names that.
  if (kind === "three") return "This site already has a 3D scene — ask me to change what it shows instead.";
  return "This site already has one of those — ask me to change it instead.";
}

/* --------------------------------------------------------- the page call */

/**
 * WHAT THE STEP THAT WRITES PAGES IS TOLD, from one designed addition.
 *
 * The build's `directiveFromPlan` for an addition: the same job (turn a design
 * into an instruction the page writer reads) and its own shape, because an
 * addition is one page or one band rather than a site. Numbered sections for
 * the build's reason — a numbered list IS the layout, a bulleted one reads as a
 * set. The prior-source block the page call already carries says how to return
 * only what is new or changed; this says WHAT is new.
 */
export function addDirective(kind, value, site) {
  const v = value && typeof value === "object" ? value : {};
  const s = site && typeof site === "object" ? site : {};
  const out = [];
  const at = (page) => (page && page !== "/" ? page + " (" + fileOfRoute(page) + ")" : "the home page (index.tsx)");
  switch (kind) {
    case "page": {
      out.push("## The page you are adding");
      out.push("- A NEW file, " + v.file + ", answering at " + v.path + " — called \"" + v.name + "\".");
      out.push("LAYOUT — " + v.purpose + ".");
      if (s.kind === "tool") out.push(TOOL_DIRECTIVE);
      if (Array.isArray(v.components) && v.components.length) out.push("Reach first for: " + v.components.join(", ") + ".");
      if (Array.isArray(v.sections) && v.sections.length) {
        out.push("The page, top to bottom:");
        v.sections.forEach((line, n) => out.push("    " + (n + 1) + ". " + line));
      }
      out.push("- Link it from " + (v.link || "the header menu") + ": return that page too, with the link added and nothing else changed.");
      break;
    }
    case "component": {
      const kit = Array.isArray(v.components) ? v.components : [];
      const own = Array.isArray(v.tsx) ? v.tsx : [];
      out.push("## The component you are adding");
      out.push("- On " + at(v.page) + ", " + (v.where || "where it belongs in the page's order") + ".");
      out.push("- " + v.does + ".");
      if (s.kind === "tool") out.push(TOOL_DIRECTIVE);
      if (kit.length) out.push("- The kit component" + (kit.length === 1 ? "" : "s") + ": " + kit.join(", ") + " — its exact props are listed above; call it, do not rewrite it.");
      if (own.length) out.push("- Written for this site: " + own.map((p) => p.name + " (" + p.props + ")").join("; ") + " — write it as a part and call it from the page.");
      // A SECOND ONE (owner, 2026-09-04): a like component already on the
      // page is not the one being asked for — this one goes after it. AND IT
      // COPIES THE FIRST'S DESIGN (owner, the same day): run 36 wrote the
      // second band as stacked cards under a grid of three.
      out.push("- If the page already has a component like this one, this is a SECOND one: put it after the existing one, and the existing one comes back byte-identical — its words, its props, its place. " +
        "AND BUILD THE NEW ONE THE WAY THE FIRST ONE IS BUILT: the same component (the kit part it calls, or the site's own part), called the same way, inside the same wrapper with the same layout classes — " +
        "a grid three across stays a grid three across; only the words are new. Not a different component that shows the same kind of thing.");
      out.push("- Return that ONE page with the component added between what it has; every other component and every sentence byte-identical. No new page file.");
      break;
    }
    case "table": {
      const t = v.table || {};
      out.push("## The table this change " + (v.exists ? "changes" : "adds"));
      out.push("- `" + t.name + "` is " + (v.exists ? "a table the site already had, now with what this change gave it" : "new") +
        " and is in the schema below, live in the database" + (Array.isArray(v.seed) && v.seed.length ? " with " + v.seed.length + " starter rows" : "") + ".");
      out.push("- " + (v.shows ? "It is shown or collected on " + at(v.shows) + ": " : "Put it on the page it belongs on: ") +
        "list it or submit to it through the hooks the rules describe, and nothing else on that page moves.");
      break;
    }
    // THE OTHER THREE TIERS (2026-09-03). A function and a connection are
    // things a PAGE calls, so the writer is told the name and the hook; a job
    // runs on a timer and the page does not change for it.
    case "function": {
      const args = (Array.isArray(v.args) ? v.args : []).map((a) => a.name + ": " + a.type).join(", ");
      out.push("## The function this change " + (v.exists ? "replaces" : "adds"));
      out.push("- `" + v.name + "(" + args + ") -> " + v.returns + "` is live in the site's database" +
        (v.internal
          ? ", INTERNAL — the platform calls it (a job's message builder, a `hook_` receiver); no page calls it, and nothing on any page changes for it."
          : ". Call it by NAME from the page that needs it — useRpc / useRpcAction / useClaimedRow / useCancelClaim / useAmendClaim, as the rules describe — and nothing else on that page moves."));
      break;
    }
    case "api": {
      const params = (Array.isArray(v.params) ? v.params : []).join(", ");
      out.push("## The outside connection this change " + (v.exists ? "replaces" : "adds"));
      out.push("- `" + v.name + "(" + params + ")` is served by the platform, which holds the key and makes the call. " +
        "Read it from the page that needs it with `useApi(\"" + v.name + "\", { " + params + " })` and write the page against " +
        "the service's real answer shape; nothing else on that page moves.");
      // THE SAME FACTS THE PAGE CATALOGUE PRINTS, from the same function. The
      // sentence above told the page writer to write against "the service's
      // real answer shape" and then described that shape nowhere — an
      // instruction it had no way to follow. Empty for a connection that
      // declared none of it, so a directive for a connection made the old way
      // is byte for byte what it was.
      for (const line of apiDetailLines(v)) out.push("  - " + line);
      out.push("  - It crosses the internet, so draw all three states: waiting, unreachable-or-not-configured-yet, and the answer.");
      break;
    }
    case "job": {
      out.push("## The scheduled job this change " + (v.exists ? "replaces" : "adds"));
      out.push("- `" + v.name + "` runs `" + v.fn + "()` " + jobEvery(v) + " and sends whatever it returns. " +
        "It changes NO page: return nothing for it unless another addition in this change needs a page.");
      break;
    }
    case "qr": {
      const n = qrName(v.name, v.label) || "qr";
      out.push("## The code you are placing");
      out.push("- `SITE_QRS." + n + "` (its caption is `SITE_QRS." + n + ".label`) on " + at(v.page) + ", " +
        (v.where || "in the contact or closing band, where a visitor would look for it") +
        " — the marks block above says how a code is rendered. The site's other codes stay where they are. " +
        "Return that one page; nothing else on it moves.");
      break;
    }
    case "three": {
      out.push("## The scene you are adding");
      out.push("- On " + at(v.page) + " — the 3D block above says what it shows and how it is built. Return that one page; nothing else on it moves.");
      break;
    }
    // A PHOTOGRAPH HAS NO BLOCK HERE, DELIBERATELY (2026-09-17). `imageDirective`
    // already names the page and hands over the exact token to write, VERBATIM,
    // and it is the build path's own reader rather than a second copy of it — a
    // block here saying the same thing in other words is how one picture becomes
    // two, and the words inside a token are the prompt an image model is paid to
    // draw. Explicit rather than a fall-through to `default`, so it reads as a
    // decision somebody made.
    case "photo":
      break;
    default:
      return "";
  }
  return out.join("\n");
}

/**
 * Fold every add's answer into the two things the route stores and the one
 * thing the page call reads.
 *
 *   designed    — what `mergeLook` and `mergeAddonSchema` fold: `tables`, `seed`,
 *                 `qr`, `three`, and `tsx` APPENDED to the stored list by name —
 *                 the route's old `mergeLook(aLook, designed)` REPLACED the
 *                 stored `tsx` with the designed one, so a new part on a site
 *                 that already had one forgot the first on its next revise.
 *   components  — the union, for the page call's component signatures.
 *   directive   — the blocks, in run order, for the page call's brief.
 *   files       — the new files, so the route can tell a new page from a
 *                 changed one when it reads what came back.
 */
export function foldAdds(answers, priorLook, site) {
  const prior = priorLook && typeof priorLook === "object" ? priorLook : {};
  const all = Array.isArray(answers) ? answers.filter((a) => a && typeof a === "object" && a.kind) : [];
  const list = all.filter((a) => a.value);
  // HOP 4 OF EIGHT, AND THE FILTER ABOVE IS WHY IT IS ITS OWN LINE. The fold
  // has always dropped an answer with no `value` — correctly, since there is
  // nothing to fold — and a coverage list read off `list` would therefore
  // vanish for exactly the answer that matters most: the one that designed
  // nothing because it could not. Read off `all`.
  const requirements = [];
  for (const a of all) for (const r of Array.isArray(a.requirements) ? a.requirements : []) requirements.push(r);
  const designed = {};
  const components = [];
  const blocks = [];
  const files = [];
  const tsx = (Array.isArray(prior.tsx) ? prior.tsx : []).filter((t) => t && typeof t === "object" && typeof t.name === "string").map((t) => ({ ...t }));
  const tables = [];
  const seed = {};
  const functions = [], apis = [], jobs = [];
  // ── THE SHOT LIST, OUT ON ITS OWN AND NOT ON `designed` (2026-09-17) ──────
  //
  // `designed` is what `mergeLook` folds into the site's STORED look, and a
  // photograph is not a stored design decision: it is bought once, lands in the
  // page's `src` as a real URL, and the site carries the picture rather than
  // the instruction. Putting it there would re-buy the same photographs on the
  // next unrelated edit, which is precisely the rule `budgetFor` exists for.
  //
  // `{page, describe}` IS `imageDirective`'s OWN LIST SHAPE, so the route hands
  // this straight to the page call through the build path's reader rather than
  // a second shape beside it.
  const photos = [];
  // THE UNIVERSAL RULE HEADS THE DIRECTIVE, once, before any addition — the
  // second of its two hops (the first is `ADD_SYSTEM`, to the designers).
  // Only when something is being added: an empty fold is an empty directive.
  if (list.length) blocks.push("## Adding to this site\n" + ADD_DESIGN_RULE);
  // A LIST KIND FOLDS EVERY ITEM; a single kind folds its one value.
  const items = [];
  for (const a of list) {
    if (LIST_ADDS.includes(a.kind)) { for (const v of Array.isArray(a.value) ? a.value : [a.value]) if (v && typeof v === "object") items.push({ kind: a.kind, value: v }); }
    else items.push(a);
  }
  for (const a of items) {
    const v = a.value;
    blocks.push(addDirective(a.kind, v, site));
    for (const c of Array.isArray(v.components) ? v.components : []) if (!components.includes(c)) components.push(c);
    for (const p of Array.isArray(v.tsx) ? v.tsx : []) {
      const i = tsx.findIndex((t) => t.name === p.name);
      if (i < 0) tsx.push({ ...p }); else tsx[i] = { ...tsx[i], ...p };
    }
    if (a.kind === "page" && v.file) files.push(v.file);
    // THE CLEANER HAS ALREADY RESOLVED THE PAGE AND BOUNDED THE WORDS, so this
    // only collects. Deduped on the PAIR: the same picture asked for twice is
    // one purchase, and `planImages` reuses one token's url wherever it appears
    // — but two different pictures on one page are two, so the page alone is
    // not the key.
    //
    // …AND THE NAME RIDES WITH THEM (2026-09-19), because it is what a
    // requirement points at. The dedupe stays on the pair rather than moving
    // to the name: the cleaner already refuses two pictures sharing a name
    // within one answer, so the two rules cover different things — that one
    // stops an ambiguous REFERENCE, this one stops a second PURCHASE.
    if (a.kind === "photo" && v.page && v.describe &&
        !photos.some((p) => p.page === v.page && p.describe === v.describe)) {
      photos.push({ page: v.page, describe: v.describe, name: String(v.name || "") });
    }
    if (a.kind === "table" && v.table) {
      tables.push(v.table);
      if (Array.isArray(v.seed) && v.seed.length) seed[v.table.name] = v.seed;
    }
    // THE OTHER THREE TIERS (2026-09-03) fold as name-keyed lists, exactly as
    // `mergeAddonSchema` carries them: only what was named, so the engine
    // replaces those by name and keeps every other one the site has.
    // ⚠ SUBTRACTIVE, NOT ADDITIVE — and the difference is a whole capability
    // (2026-09-19). This line named its five fields, so it was a SECOND
    // rebuild of an item `cleanAdd` had already rebuilt, and anything the
    // cleaner started carrying was dropped here in silence. MEASURED through
    // `POST /api/site/<slug>/addon` the hour the language was wired: the tool
    // offered it, the cleaner kept it, `proposedSpec` kept it, and the DDL
    // still read `LANGUAGE sql` — every hop correct but this one, which is
    // this repository's own wiring trap and the reason that case drives the
    // route rather than the module.
    //
    // The `api` tier beside it has been subtractive since it was written
    // (`const { exists, ...api } = v`), which is why the response sketch, the
    // parameter metadata and the credential guidance reached the engine with
    // no change here at all. `job` is still additive and is the remaining
    // instance of the class: a field added to `JOB_ITEM` and to the cleaner
    // will be dropped on this line until it is changed with cases beside it.
    if (a.kind === "function" && v.name) {
      // NO `internal: v.internal === true` HERE. The additive line this
      // replaces had one, and with a subtractive fold it is a second
      // application of a rule `cleanAdd` has already applied — MEASURED over
      // every shape the cleaner can produce (absent, true, false, and beside a
      // language): byte-identical with it and without. The cleaner is the
      // wall; a second coercion here is an inert line a sweep reports as a
      // guard gap for ever.
      const { exists, ...fn } = v;
      functions.push(fn);
    }
    if (a.kind === "api" && v.name) {
      const { exists, ...api } = v;
      apis.push(api);
    }
    // ⚠ THE FOLD REBUILDS A JOB KEY BY KEY, so a field added to `cleanAdd` and
    // not to this line is CLEANED, VALIDATED, and then dropped one hop later —
    // this repository's most-recorded defect, and the one-time date walked
    // straight into it: the cleaner kept `on`, the reply lost it, and from the
    // outside that is indistinguishable from a model that never said it.
    // MEASURED: `{on: "2026-10-03"}` in, `undefined` out of `foldAdds`.
    if (a.kind === "job" && v.name) jobs.push({ name: v.name, fn: v.fn, everyMinutes: v.everyMinutes, ...(v.at ? { at: v.at, ...(v.tz ? { tz: v.tz } : {}) } : {}), ...(v.on ? { on: v.on } : {}) });
    // APPENDED TO THE STORED LIST BY NAME (2026-09-03), never replacing it —
    // the `tsx` rule one loop up, for the same reason: a site with a code that
    // gets another must keep the first.
    if (a.kind === "qr") {
      const name = qrName(v.name, v.label);
      const cur = Array.isArray(designed.qr) ? designed.qr : qrList(prior.qr);
      if (name && !cur.some((c) => c.name === name)) designed.qr = [...cur, { name, points: v.points, label: v.label }];
    }
    if (a.kind === "three") designed.three = v.scene;
  }
  if (tables.length) { designed.tables = tables; designed.seed = seed; }
  if (functions.length) designed.functions = functions;
  if (apis.length) designed.apis = apis;
  if (jobs.length) designed.jobs = jobs;
  // ONLY WHEN SOMETHING WAS DECLARED: an absent `tsx` means unchanged to the
  // merge, and re-sending the stored list unchanged is a no-op either way —
  // but a site with none and an answer with none must not store `[]`.
  if (tsx.length) designed.tsx = tsx;
  // ── A REQUIREMENT HANDED TO THE PAGE STEP REACHES THE PAGE STEP ──────────
  //
  // Owner, 2026-09-13: "Pass them to the appropriate downstream step where
  // supported; otherwise explain the remaining limitation to the customer."
  // The page call is the one downstream step this fold speaks to, so an
  // `elsewhere: "page"` requirement joins its directive here. Everything else
  // (`function`, `job`, `edit`, …) has no directive of ours to ride and is the
  // route's to explain — `requirementNote` is that half.
  //
  // APPENDED LAST, AFTER EVERY ADDITION'S OWN BLOCK, so the page writer reads
  // what it is building before it reads what the change still owes.
  const pageBrief = requirementBrief(requirements, "page");
  if (pageBrief) blocks.push(pageBrief);
  return { designed, components, directive: blocks.filter(Boolean).join("\n\n"), files, requirements, photos };
}

/**
 * The sentence for an addition that would have changed what a page already
 * said (owner, 2026-09-04: a second one, and the first stays as it is). The
 * route refuses such a page before the gate and the bill, so nothing was
 * published and nothing charged; this names the page and up to two of the
 * words it would have lost, so the customer can see they were their own.
 */
export function rewroteMsg(lost) {
  const list = Array.isArray(lost) ? lost.filter((l) => l && typeof l.path === "string") : [];
  const first = list[0];
  const tail = " Nothing was published. Ask again and I'll add it as a new section and leave the rest exactly as it is.";
  if (!first) return "I couldn't add that without changing what's already on the page." + tail;
  const route = routeOf(first.path);
  const where = route === "/" ? "the home page" : (route || first.path);
  const words = (Array.isArray(first.lost) ? first.lost : [])
    .filter((w) => typeof w === "string" && w.trim())
    .slice(0, 2)
    .map((w) => "“" + (w.length > 60 ? w.slice(0, 57).trimEnd() + "…" : w) + "”");
  return "I couldn't add that without changing what's already on " + where +
    (words.length ? " — it would have lost " + words.join(" and ") : "") + "." + tail;
}

/**
 * The sentence for an addition that would have taken photographs OFF the site
 * (owner, 2026-09-17: *"Preserve existing photographs when buying new ones."*).
 *
 * THE COUNT, NEVER THE URLS. `/u/fw/a1b2c3d4.jpg` is a storage key and tells the
 * customer nothing they can act on; how many of their own pictures would have
 * gone is the whole of what they need to decide what to ask for next. The urls
 * ride the reply separately as `lostPhotos`, which is developer-facing — the
 * same division `unknownComponents` and `changedProps` already make.
 *
 * MONEY, SAID AS MONEY. These are photographs this platform charged them for,
 * and that is why the wall refuses rather than reports: a rewrite that drops one
 * cannot be undone by asking again, because the picture is gone from the source
 * the next edit reads.
 *
 * THE INVITATION IS THE OTHER HALF. A refusal with no way forward reads as the
 * feature being broken, and the way forward here is real: the same ask, with the
 * pictures left alone, is a change this step can make.
 */
export function lostPhotosMsg(lost) {
  const n = Array.isArray(lost) ? lost.filter((u) => typeof u === "string" && u.trim()).length : 0;
  const what = n === 1 ? "one of the photographs" : (n ? n + " of the photographs" : "photographs");
  const it = n === 1 ? "it" : "them";
  return "I couldn't add that without taking " + what + " already on your site off it. " +
    "Nothing was published and nothing was charged — ask again and I'll add the new part and leave " +
    it + " exactly where " + (n === 1 ? "it is" : "they are") + ".";
}

// ── THE ADD STEP'S OWN REPAIR (owner, 2026-09-04) ────────────────────────────
//
// "Try to fix it, if not fix, send as it is" — and, when the first cut reused
// the BUILD's repair pass inside the shared publish spine, "each path has a
// repair path". So this is the ADD step's: its own wording, scoped to the
// pages THIS addition wrote, driven here with fakes, and handed to the spine's
// seam by the addon route. What it shares with the build's `site-repair.mjs`
// is the MECHANISM — the tweak rung (`runTweak`, whose guards keep the words
// and the route, calibrated at 0 false alarms over 1,640 real tweaks) and the
// render check's own `SERIOUS` kinds — never a line of wording, never a call
// into the build path.
//
// Run 34 (2026-09-04) is why: the gear addon published a page the render
// check had just watched crash, and the reply said so while every visitor to
// it saw the error card.
//
// FOUR ANSWERS, EACH NAMED, so the route can say which happened:
//   - `ran: false, why: "no-report"`  the check could not run — nothing to act on
//   - `ran: false, why: "clean"`      nothing serious on a page this addition wrote
//   - `ran: false, why: "time"`       there is work, and the job's clock cannot fit
//                                     a model call, a compile and the publish; the
//                                     routes are named and NOTHING is spent
//   - `ran: true`                     the calls were made; `built` is the second
//                                     compile when it succeeded (ship that, store
//                                     those pages), null when it did not (ship the
//                                     original — never worse than not trying),
//                                     `failed` naming the stage
//
// ONE ATTEMPT AND NEVER THROWS: this sits in front of a compile that already
// succeeded, and the only correct outcome of anything going wrong here is to
// publish what we have. THE USAGE IS KEPT ON EVERY PATH THAT SPENT, refusals
// and a failed recompile included: the calls really happened and the ledger
// prices what was used.

/** How many pages one addition will pay to repair — a sanity bound, as the build's. */
export const MAX_ADD_REPAIRS = 3;

/**
 * What the model is told. The ADD step's own sentence: an addition to a LIVE
 * site, which has to keep the design system it was written into and may not
 * touch the rest of the site — the universal rule of this step, in the repair.
 */
export const ADD_REPAIR_RULES =
  "You are fixing ONE file of an ADDITION that was just made to a small business's LIVE website. The addition " +
  "compiled, a real browser opened the page, and the page FAILED. What went wrong is below.\n\n" +
  "FIX THAT FAULT AND NOTHING ELSE. Everything the fault does not touch comes back exactly as it went in — the " +
  "same words, the same order, the same imports, the same formatting. You are not reviewing this file, you are " +
  "not improving it, and the rest of the site is not yours to touch: the addition has to keep the design system " +
  "it was written into — the same kit components, the same classes, the same look.\n\n" +
  "DO NOT CHANGE ANY OF THE WORDS A VISITOR READS. Not a heading, not a sentence, not a button label, not a " +
  "price. This is checked, and a file that comes back with different wording is thrown away.\n\n" +
  "DO NOT CHANGE THE PAGE'S ADDRESS. The `createFileRoute(\"…\")` line stays exactly as it is.\n\n" +
  "THE FAULT IS REAL — it was watched happening in a browser, not guessed at. So \"the page looks fine\" is not " +
  "an answer. If you genuinely cannot see what would cause it, answer `cannot` and the addition ships as it is.\n\n" +
  "THINGS THAT CAUSE THIS ON AN ADDITION: a kit component used outside the one it needs around it (a form " +
  "field's label, control, description or message outside its item and field); a hook called inside a condition " +
  "or a loop; a value read off a row before any rows have arrived; a whole section behind a condition that is " +
  "false while the list is still empty; a component the addition imports that the kit does not have.";

/**
 * The findings worth paying to fix, one entry per PAGE — and ONLY the pages
 * this addition wrote (`touched`: the paths it added or changed), because the
 * rest of the site is not this step's to rewrite. Only `SERIOUS` findings, as
 * the render check itself grades them. A LANGUAGE VARIANT IS ITS PRIMARY PAGE:
 * `/es/gear` is `translatePages` over `gear.tsx`, and its fault is that file's
 * — run 34's report named only the variants. Nothing when the check could not
 * run: no report, no repair, no spend.
 */
export function addRepairBrief(report, pages, { langs = [], touched = null } = {}) {
  const r = report && typeof report === "object" ? report : null;
  if (!r || r.ok === false) return { work: [], dropped: 0 };
  const findings = Array.isArray(r.findings) ? r.findings : [];
  const list = Array.isArray(pages) ? pages : [];
  const bare = (p) => String(p || "").replace(/^src\/routes\//, "");
  const mine = Array.isArray(touched) ? new Set(touched.map(bare).filter(Boolean)) : null;
  const byRoute = new Map();
  for (const p of list) {
    if (!p || typeof p.path !== "string") continue;
    if (mine && !mine.has(bare(p.path))) continue;
    const route = routeOf(p.path);
    if (route && !byRoute.has(route)) byRoute.set(route, p);
  }
  const perPage = new Map();
  for (const f of findings) {
    if (!f || !SERIOUS.has(f.kind)) continue;
    const page = byRoute.get(stripLangPrefix(String(f.route || "/"), langs));
    if (!page) continue;
    if (!perPage.has(page.path)) perPage.set(page.path, { page, kinds: new Set(), details: [] });
    const e = perPage.get(page.path);
    e.kinds.add(f.kind);
    const d = String(f.detail == null ? "" : f.detail).trim();
    if (d && !e.details.includes(d)) e.details.push(d);
  }
  const all = [...perPage.values()].map((e) => ({
    path: e.page.path, route: routeOf(e.page.path), source: e.page.source,
    instruction: addRepairInstruction(e.kinds, e.details),
  }));
  return { work: all.slice(0, MAX_ADD_REPAIRS), dropped: Math.max(0, all.length - MAX_ADD_REPAIRS) };
}

/** The finding, turned into something a model can act on — the detail passed through whole. */
export function addRepairInstruction(kinds, details) {
  const k = kinds instanceof Set ? kinds : new Set(Array.isArray(kinds) ? kinds : []);
  const d = (Array.isArray(details) ? details : []).filter(Boolean).slice(0, 3);
  const lead = k.has("threw")
    ? "A real browser opened the page this addition wrote and it crashed."
    : "A real browser opened the page this addition wrote and nothing rendered.";
  return d.length ? lead + "\n\n" + d.map((x) => "- " + String(x).slice(0, 400)).join("\n") : lead;
}

/** The round: the brief, one tweak per broken page in parallel, a second compile of the corrected list. */
export async function addRepairRound({ report, pages, touched, langs, send, model, compile, room = true } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const empty = { repaired: [], refused: [], usage: [], dropped: 0 };
  const r = report && typeof report === "object" ? report : null;
  if (!r || r.ok === false) return { ran: false, why: "no-report", ...empty };
  const brief = addRepairBrief(r, list, { langs, touched });
  const routes = brief.work.map((w) => w.route || w.path);
  if (!brief.work.length) return { ran: false, why: "clean", ...empty, dropped: brief.dropped };
  if (!room) return { ran: false, why: "time", routes, ...empty, dropped: brief.dropped };
  if (typeof send !== "function" || typeof compile !== "function") return { ran: false, why: "no-deps", routes, ...empty, dropped: brief.dropped };

  const results = await Promise.all(brief.work.map(async (w) => {
    // NO SIZE CHECK HERE. The rung refuses an oversized page itself, before it
    // sends (`tweakable`, the first thing `runTweak` asks) and answers the same
    // `too-big` with nothing spent. The first draft repeated the check, and the
    // sweep proved the copy inert — deleting it changed nothing — so it went:
    // two lists of one thing, and the rung's is the one its own guards drive.
    try {
      const res = await runTweak({
        instruction: w.instruction, path: w.route || w.path, source: w.source, send,
        rules: ADD_REPAIR_RULES, heading: "WHAT WENT WRONG ON THE ADDITION",
        ...(model ? { model } : {}),
      });
      return { w, res };
    } catch (e) {
      // `runTweak` documents that it never throws; held anyway — one rejection
      // inside a `Promise.all` would take a build that succeeded down with it.
      return { w, res: { ok: false, reason: "send", usage: null, error: e } };
    }
  }));
  const fixed = new Map();
  const repaired = [], refused = [], usage = [];
  for (const { w, res } of results) {
    if (res && res.usage) usage.push(res.usage);
    if (res && res.ok && typeof res.source === "string") { fixed.set(w.path, res.source); repaired.push(w.route || w.path); }
    else refused.push({ route: w.route || w.path, reason: (res && res.reason) || "unknown" });
  }
  const base = { ran: true, repaired, refused, usage, dropped: brief.dropped };
  if (!fixed.size) return { ...base, built: null, pages: null, failed: "refused" };
  const corrected = list.map((p) => (p && fixed.has(p.path) ? { ...p, source: fixed.get(p.path) } : p));
  let second = null;
  try { second = await compile(corrected); } catch (e) { second = { ok: false, stage: "compile", error: String((e && e.message) || e) }; }
  if (second && second.ok === true && second.files) return { ...base, built: second, pages: corrected };
  return { ...base, built: null, pages: null, failed: String((second && second.stage) || "compile") };
}

/**
 * What the customer is told about the round, in the reply's render sentence.
 * QUIET ON SUCCESS: a page that needed a second pass and got one is our
 * business. Said: a fix there was no time for, a fix that did not hold, and a
 * page the round could not fix beside one it did — each naming the page, each
 * ending "published as it is", because the customer should know the page is
 * up and wrong rather than down.
 */
/**
 * WHAT A `page` OR `component` DECLARATION ASKED FOR AND DID NOT GET.
 *
 * Owner, 2026-09-14: *"Validate page and component declarations before
 * cleaning discards information. Trace unsupported, changed, and omitted
 * fields through their actual frontend pipeline. Use validators appropriate to
 * those steps."*
 *
 * ── WHY `auditTier` CANNOT DO THIS ──────────────────────────────────────────
 *
 * The four schema tiers are audited by putting the declaration through
 * `normalizeSchema` and reading what the ENGINE kept. `page` and `component`
 * never meet that engine: `SPEC_OF_KIND` names four tiers and neither of these
 * is one, so the whole audit block is skipped for them and MEASURED, a page
 * declaring `seoTitle` and `cacheForever` cleans to its eight known keys with
 * `skipped: []` and nothing anywhere reports either.
 *
 * Their pipeline is the FRONTEND one — the cleaner, then the directive, then
 * the page call — so the validator is the cleaner itself, which is the step
 * that decides what survives. Three answers, each a different sentence:
 *
 *   `reached`      the model declared a property the TOOL never offered. It is
 *                  gone and nothing downstream will ever see it.
 *   `changed`      a declared SCALAR the cleaner kept under another value — a
 *                  route rewritten, a string cut to its cap.
 *   `unexpressed`  a property the tool DOES offer and the cleaner dropped or
 *                  emptied anyway: declared, legal, and lost between the model
 *                  and the page writer. This is the one worth building.
 *
 * **THE SAME THREE WORDS AS THE SCHEMA AUDIT, AND DELIBERATELY** — the route
 * pools them into the same two customer clauses, so a lost guarantee reads the
 * same whether the database refused it or the frontend cleaner did.
 *
 * `offered` is the kind's own item properties, read off the real tool rather
 * than typed here: two lists of one thing drift, and this repository has a name
 * for it. Scalars only for `changed`, for `auditTier`'s own measured reason —
 * a list of objects stringifies to `[object Object]` whichever objects it holds.
 */
export function auditFrontend(kind, declared, cleaned) {
  const empty = { scanned: 0, reached: [], changed: [], unexpressed: [] };
  const item = frontendItem(kind);
  if (!item) return empty;
  const offered = new Set(Object.keys(item.properties || {}));
  const decl = Array.isArray(declared) ? declared : (declared ? [declared] : []);
  const kept = Array.isArray(cleaned) ? cleaned : (cleaned ? [cleaned] : []);
  const reached = new Set(), changed = new Set(), unexpressed = new Set();
  let scanned = 0;
  // PAIRED BY POSITION, AND ONLY WHEN THE COUNTS AGREE. A cleaner that refuses
  // one item shifts every index behind it, so a mismatched pair would report
  // one declaration's properties against another's answer — the recorded
  // "pair by name, never by position" trap, met where there is no name to pair
  // on: a page has a `path` and a component has nothing unique at all. So the
  // audit is skipped rather than guessed when the two lists differ in length,
  // and `scanned` says so by staying 0.
  if (decl.length !== kept.length) return empty;
  for (let i = 0; i < decl.length; i++) {
    const d = decl[i], k = kept[i];
    if (!d || typeof d !== "object" || !k || typeof k !== "object") continue;
    scanned++;
    for (const key of Object.keys(d)) {
      if (!declaredTruthyHere(d[key])) continue;
      if (!offered.has(key)) { if (reached.size < MAX_FRONTEND_DROPPED) reached.add(key); continue; }
      if (!declaredTruthyHere(k[key])) { if (unexpressed.size < MAX_FRONTEND_DROPPED) unexpressed.add(key); continue; }
      if (scalarHere(d[key]) && scalarHere(k[key]) && String(d[key]) !== String(k[key])) {
        if (changed.size < MAX_FRONTEND_DROPPED) changed.add(key);
      }
    }
  }
  return { scanned, reached: [...reached].sort(), changed: [...changed].sort(), unexpressed: [...unexpressed].sort() };
}

/** How many names any one of the frontend audit's lists will carry. */
const MAX_FRONTEND_DROPPED = 12;

/** A declaration worth testing: absent, falsy and empty all read as "not asked". */
function declaredTruthyHere(v) {
  if (!v) return false;
  if (Array.isArray(v)) return !!v.length;
  if (typeof v === "object") return !!Object.keys(v).length;
  return true;
}

/** A value two readings can be compared as text: never an object or an array. */
function scalarHere(v) {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

/**
 * The item shape a frontend kind's tool really offers, off the tool itself.
 *
 * Read through `addTool` rather than from a list here, so a property added to
 * the `page` or `component` item is audited the day it is added and a property
 * removed stops being expected the same day.
 */
export function frontendItem(kind) {
  if (kind !== "page" && kind !== "component") return null;
  try {
    const props = (addTool(kind).input_schema || {}).properties || {};
    const shape = props[kind];
    const item = shape && shape.items ? shape.items : shape;
    return item && item.properties ? item : null;
  } catch { return null; }
}

/**
 * WHICH REQUESTED PAGES ARE NOT ON THE SITE.
 *
 * Owner, 2026-09-14: *"Compare the requested pages with what actually survives
 * generation, compilation, and publication. Name any missing page in the
 * result. A planned file is the expectation, not proof of delivery."*
 *
 * `foldAdds` has computed the requested file names since the day it was
 * written — its own comment says they are there "so the route can tell a new
 * page from a changed one" — and MEASURED: the route reads `designed`,
 * `directive` and `components` off that fold and has never once read `files`.
 * So a message asking for two pages whose writer returned one published the
 * one, reported it as added, and said nothing whatever about the other.
 *
 * `requested` is the cleaned `page` answers (each `{path, file}`) and
 * `survived` is what the site really has at the end — the merge's `added` and
 * `changed`, which is what was compiled and published, never what was planned.
 * **The answer is in ROUTES**, because that is the customer's word for a page;
 * the comparison is by FILE NAME, because that is what both sides really carry
 * and a route can be written two ways.
 *
 * ORDER IS THE REQUEST'S OWN, so a customer reading the sentence meets their
 * pages in the order they asked for them.
 */
export function missingPages(requested, survived) {
  const base = (p) => String(p || "").split("/").pop().toLowerCase();
  const have = new Set((Array.isArray(survived) ? survived : []).map(base).filter(Boolean));
  const out = [];
  for (const p of Array.isArray(requested) ? requested : []) {
    if (!p || typeof p !== "object") continue;
    const file = base(p.file || (p.path ? fileOfRoute(p.path) : ""));
    const route = typeof p.path === "string" ? p.path : "";
    if (!file || !route || have.has(file)) continue;
    if (!out.includes(route)) out.push(route);
  }
  return out;
}

/**
 * The sentence for pages that were asked for and are not there.
 *
 * NAMED, never counted: a route is the one thing about a missing page the
 * customer can act on — they can ask for that page again — where "one page is
 * missing" leaves them to work out which. Bounded at three with the rest
 * counted, the same shape every other list-bearing sentence here uses.
 */
export function missingPagesNote(routes) {
  const list = (Array.isArray(routes) ? routes : []).filter((r) => typeof r === "string" && r);
  if (!list.length) return "";
  const named = list.slice(0, 3).join(", ");
  const rest = list.length > 3 ? " and " + (list.length - 3) + " more" : "";
  return list.length === 1
    ? "One page I set out to add isn't there — " + named + " didn't make it through, so nothing on your site links to it yet. Ask me for it again on its own and I'll have another go."
    : list.length + " pages I set out to add aren't there — " + named + rest + " didn't make it through. Ask me for them again and I'll have another go.";
}

/**
 * WHAT THE DESIGN ASKED FOR AND THIS STEP COULD NOT BUILD, AS ONE PLAIN
 * SENTENCE (2026-09-20).
 *
 * Owner: *"a component answer containing a valid welcome-card and a tide-chart
 * with empty `does` returns droppedFields naming tide-chart, but the actual
 * browser reply is only 'Done — updated /.' Carry this partial outcome into a
 * plain customer sentence."* MEASURED on exactly that answer: `droppedFields:
 * [{what: "component", name: "tide-chart"}]`, `coverNote: ""`, and the
 * browser's own composer drawing **"✅ Done — updated /."** — a change that
 * built one of the two things asked for, reported as a change that worked.
 *
 * A PARTIAL OUTCOME IS NOT A FAILURE AND IT IS NOT A SUCCESS. `skipped` covers
 * a whole ITEM this step refused and has its own sentence; these are losses
 * INSIDE an item that really was built, so the reply's `ok`, its `changed` and
 * its cost are all honest and the only thing missing was that anybody said so.
 *
 * COUNTS AND KINDS, NEVER THE IDENTIFIERS — the same division `unknownKit` and
 * `invalidProps` already make, and for the same reason: `tide-chart` is a file
 * name the DESIGNER coined, not the customer's own words, so it tells them
 * nothing they can act on. The names are kept whole on the reply and in the
 * stored record, which is where a developer looks.
 *
 * THE KIND IS SAID IN THE CUSTOMER'S VOCABULARY. A `component` is a *section*
 * — what they would call the thing on the page — and a `column` is a *field*.
 * A `what` this does not recognise is a *thing*, which fails open rather than
 * dropping the whole sentence the day a fourth kind is added.
 */
const DROPPED_WORDS = Object.freeze({
  component: ["section", "sections"],
  column: ["field", "fields"],
});
export function droppedNote(dropped) {
  const list = (Array.isArray(dropped) ? dropped : []).filter((d) => d && typeof d === "object");
  if (!list.length) return "";
  const counts = new Map();
  for (const d of list) counts.set(String(d.what || ""), (counts.get(String(d.what || "")) || 0) + 1);
  const said = [...counts.entries()].map(([what, n]) => {
    const w = DROPPED_WORDS[what] || ["thing", "things"];
    return n + " " + (n === 1 ? w[0] : w[1]);
  });
  const one = list.length === 1;
  return "Part of that didn't get built — " + said.join(" and ") + " the design asked for, so "
    + (one ? "it isn't" : "they aren't") + " there. Ask me for "
    + (one ? "it" : "them") + " again on "
    + (one ? "its" : "their") + " own and I'll have another go.";
}

/**
 * WHICH ROUTES A VISITOR REALLY SEES EACH FILE ON (2026-09-20).
 *
 * ⚠ WHY A FILE PATH IS NOT AN ANSWER. `imageSources` is the one definition of
 * the files the image steps operate on, and it gives a component its real path
 * (`src/routes/-parts/photo-wall.tsx`) because `lintPages` names files in its
 * findings. Run that through `routeOf` — which every post-publish reader did —
 * and you get **`/-parts/photo-wall`**, a route no visitor can open and no
 * requirement can name. MEASURED before this existed: a photograph bought into
 * a component was published, billed, and reported `missing`, because the
 * reporting was looking for it on `/gallery` and the inventory had filed it
 * under a pseudo-route.
 *
 * SO THE TWO HALVES OF THAT DEFECT ARE TWO. Handing the readers the parts list
 * they were missing is necessary and NOT sufficient: a component has no address
 * of its own, and the honest answer is the address of every page that USES it.
 *
 * A COMPONENT'S ROUTES ARE ITS IMPORTERS', TRANSITIVELY. A page imports
 * `photo-wall`, which imports `photo-frame`: a picture in `photo-frame` is on
 * that page, and a reader that walked one level would report the nested one
 * lost. The walk is a DFS from each page over `importsPart`, which is
 * `site-files.mjs`' one definition of the convention — the same test `deadQrs`
 * withholds on, so a component the cascade calls used and a component this
 * calls placed can never disagree.
 *
 * A COMPONENT NOBODY IMPORTS GETS NO ROUTES, and that is the point rather than
 * an edge case: its file ships, and a picture in it is on no page a visitor can
 * reach. Answering `[]` is what stops a requirement about `/gallery` being
 * satisfied by an image sitting in a component the site never renders.
 *
 * A PAGE WITH NO ROUTE GETS NONE EITHER — `routeOf` answers "" for a pathless
 * layout (`_layout.tsx`, `__root.tsx`), which genuinely has no address.
 *
 * CYCLES TERMINATE on the visited set. Two components importing each other is
 * not valid TypeScript, but this function is exported and takes what it is
 * handed, and a hang here is a publish that never returns.
 *
 * BUILT FROM `imageSources`, IN TWO CALLS, so the path convention has exactly
 * one definition and no index arithmetic ties the answer back to its input —
 * the trap `imageSources`' own header records about slicing the union apart by
 * length. Pages first then parts, which is the order it already guarantees.
 */
/**
 * HOW MUCH AN IMPORT EDGE ESTABLISHES — and `unused` is deliberately absent,
 * because it establishes nothing and `EDGE[u] || 0` is what says so.
 *
 * TWO STRENGTHS RATHER THAN A BOOLEAN, so `min` along a path and `max` across
 * paths mean what they say: a chain is only as certain as its weakest link, and
 * one certain route does not become uncertain because another path could not be
 * read.
 */
const EDGE = Object.freeze({ rendered: 2, unsure: 1 });

export function routedSources(pages, parts) {
  const ps = Array.isArray(pages) ? pages : [];
  const bs = (Array.isArray(parts) ? parts : []).filter(
    (p) => p && typeof p === "object" && typeof p.name === "string" && p.name,
  );
  const src = (p) => String((p && p.source) || "");
  const all = bs.map((b) => b.name);
  // USES, COMPUTED ONCE PER FILE rather than per page-part pair: the walk below
  // is then pure graph, so a site with many pages and many components costs one
  // lexical pass each instead of their product.
  const usesOf = (text, inPart) => partUses(text, all, inPart);
  const partUse = new Map(bs.map((b) => [b.name, usesOf(src(b), true)]));
  const routesOf = new Map();
  const maybeOf = new Map();
  for (const p of ps) {
    const r = routeOf(p && p.path);
    if (!r) continue;
    // THE STRENGTH OF AN EDGE, AND A PATH IS ONLY AS STRONG AS ITS WEAKEST ONE.
    // A page that renders `photo-wall`, which merely holds a reference to
    // `photo-frame`, places the outer band certainly and the inner one only
    // maybe — so the walk carries `min` along each path and keeps the `max`
    // across them, which is the honest reading of "some route reaches it".
    const best = new Map();
    const stack = [];
    const push = (n, w) => {
      if (w > 0 && (best.get(n) || 0) < w) { best.set(n, w); stack.push(n); }
    };
    for (const [n, u] of usesOf(src(p), false)) push(n, EDGE[u] || 0);
    // TERMINATES ON A CYCLE BECAUSE A NODE IS ONLY RE-VISITED WHEN ITS STRENGTH
    // IMPROVES, and there are two strengths — so at most two visits each. Two
    // components importing each other is not valid TypeScript, but this
    // function is exported and takes what it is handed, and a hang here is a
    // publish that never returns.
    while (stack.length) {
      const n = stack.pop();
      const w = best.get(n) || 0;
      for (const [m, u] of partUse.get(n) || []) push(m, Math.min(w, EDGE[u] || 0));
    }
    for (const [n, w] of best) {
      const into = w >= EDGE.rendered ? routesOf : maybeOf;
      const set = into.get(n) || new Set();
      set.add(r);
      into.set(n, set);
    }
  }
  const out = [];
  for (const p of imageSources(ps, [])) {
    const r = routeOf(p && p.path);
    // A PAGE IS ON ITS OWN ROUTE, CERTAINLY. There is no placement question to
    // ask about a file a visitor opens by its own address.
    out.push({ ...p, routes: r ? [r] : [], maybeRoutes: [] });
  }
  for (const p of imageSources([], bs)) {
    const sure = routesOf.get(p.name) || new Set();
    out.push({
      ...p,
      routes: [...sure],
      // NEVER IN BOTH: a route that certainly renders it is settled, whatever
      // some other path through the graph could not establish.
      //
      // ⚠ AND THE FILTER IS ABSORBED TODAY, MEASURED AND DECLARED. `best`
      // keeps ONE strength per (page, part) — the max across paths — so a part
      // is filed under a route in exactly one of the two maps and no route can
      // appear in both: driven over every probe shape, including a part reached
      // certainly one way and unfollowably another, the overlap is 0. It stays
      // because the deadness is a property of `best` and not of this line, and
      // a later change that let a route be recorded twice would put an already
      // settled placement back into `maybeRoutes` and blind the inventory. The
      // sweep mutates the OBSERVABLE half of the same line — the certain
      // routes copied into `maybeRoutes`, which does exactly that.
      maybeRoutes: [...(maybeOf.get(p.name) || [])].filter((r) => !sure.has(r)),
    });
  }
  return out;
}

/**
 * WHICH ROUTE OF OURS A QR PAYLOAD OPENS — `{ ours, route }`.
 *
 * ONE DEFINITION FOR TWO READERS, and it was two until 2026-09-20. `cleanAdd`
 * resolved a bare `/prices` against the site's address and checked it was a
 * page the site has or is adding; `deadQrs` did the exact inverse to find a
 * code whose page did not survive. A full URL at our OWN origin — the spelling
 * the tool offers FIRST — went through neither, so `https://<site>/nope` was
 * drawn, baked and published pointing at a 404. MEASURED: `/nope` refused,
 * the same destination spelled whole accepted.
 *
 * `ours` IS THE FIELD THAT MATTERS, because "not ours" and "ours but not a
 * page" need opposite answers. A `tel:`, a `WIFI:`, a `mailto:` and another
 * company's URL are all destinations we have no business validating — they are
 * preserved. Our own origin naming a route the site has not got is the defect.
 * Collapsing the two to one empty string is what let the second hide behind the
 * first.
 *
 * THREE THINGS MAKE IT "not ours", each with its own job: `new URL` throws on
 * anything unparseable; the ORIGIN comparison refuses another site's address;
 * and with no address of our own we compare nothing — a code removed or refused
 * on a guess is worse than one we left alone.
 *
 * `route` IS EMPTY FOR A PATHNAME THAT IS NOT A ROUTE SHAPE, which is how a
 * `tel:` reaching here (it parses, and its pathname is a phone number) is told
 * from a real page.
 */
export function qrSiteRoute(points, base) {
  const miss = { ours: false, route: "" };
  if (!base || typeof points !== "string" || !points) return miss;
  try {
    const u = new URL(points);
    if (u.origin !== new URL(base).origin) return miss;
    return { ours: true, route: route(u.pathname) };
  } catch { return miss; }
}

/**
 * A NEW QR CODE THAT WOULD OPEN A PAGE THIS CHANGE FAILED TO MAKE.
 *
 * Owner, 2026-09-17: *"Check the QR's planned destination against the actual
 * pages surviving generation and merging before publishing that dependency.
 * Prevent a new QR from pointing at the missing page."*
 *
 * `cleanAdd` resolves a bare route against the site's own address, and since
 * 2026-09-17 it counts a page THIS SAME CHANGE is adding — which is right, and
 * right only because the page and the code go out in one publish. **One
 * publish is not proof that both halves of it exist.** Reproduced through the
 * route: plan `/gallery`, have the writer return only the home page, and the
 * code was stored pointing at `https://<site>/gallery`, published, and the
 * missing page reported afterwards. A QR is the one thing here a customer
 * PRINTS, so a dead one outlives every other kind of partial.
 *
 * ONLY A CODE THIS CHANGE ADDED, and only one whose destination is a route
 * this change PLANNED and lost. A code the site already had is never touched —
 * whatever it points at, it is not this change's to remove — and a code
 * pointing somewhere else entirely (a phone number, a wifi network, another
 * site) is not a candidate at all, which is why the origin is compared and not
 * just the path.
 *
 * ⚠ AND A PAGE THAT RENDERS IT IS WITHHELD WITH IT — it is not a reason to
 * publish it (owner, 2026-09-17: *"Remove the exception that publishes a newly
 * added QR pointing to a missing planned page merely because a generated page
 * renders it… A warning does not complete the dependency."*).
 *
 * The first cut KEPT such a code, on the reasoning that dropping it takes
 * `SITE_QRS.<name>` out from under a page that renders it. That reasoning is
 * sound and the conclusion was wrong: it saved the page by shipping a code
 * that opens nothing, and told the customer to please not print the thing we
 * had just made for them. The dependency was never completed — a sentence
 * stood in for it.
 *
 * SO THE DEPENDENT CHANGES ARE WITHHELD TOGETHER. The code is dropped, and
 * every page THIS CHANGE WROTE that renders it is withheld: an existing page
 * goes out as its previous version, a page this change invented does not go
 * out at all. Nothing breaks, because the version that ships is one that
 * shipped before — the binding is never deleted from a live page, it is simply
 * never introduced. The customer hears both halves and can ask again.
 *
 * ⚠ AND A CUSTOM COMPONENT IS A GENERATED FILE TOO (2026-09-17, measured
 * through the route). The first cut of this looked only at `aMerge.pages`, so
 * a change whose COMPONENT rendered the code published `ok: true` with
 * `SITE_QRS.gallery` stored in `parts.json` and the code gone from the look —
 * a binding to something that does not exist, in a file the next compile
 * includes. Reproduced: `droppedQrs` named the code, `heldPages` was absent,
 * and `storedParts` carried the reference. The same defect one file kind over,
 * and the same answer: a component this change rewrote goes back to the source
 * the site is already serving, one it INVENTED is not written at all.
 *
 * IT IS A FIXED POINT, NOT A PASS, and that is not decoration: withholding an
 * ADDED page takes its route away, which can kill a second code pointing at
 * it, which can withhold a third page. `MAX_QRS` is 6, so a chain that long is
 * constructible rather than hypothetical. The loop settles when a round drops
 * nothing new, and it terminates because every round that continues adds to a
 * set bounded by the codes, the pages and the components.
 *
 * AND THE COMPONENTS EXTEND THAT CHAIN RATHER THAN SITTING BESIDE IT. A
 * component this change INVENTED and then withheld is a file that will not
 * exist, so every page this change wrote that IMPORTS it is withheld too —
 * publishing the importer without the module is `vite` refusing the build,
 * which is this repository's own most expensive measured class. A component it
 * merely CHANGED breaks no importer: the version that ships is the one the
 * site is already serving.
 *
 * `qrUnplaced` IS THE ONE READER OF "does a page show this code" — its own
 * binding regex, already written, already guarded — so this asks it and
 * inverts the answer rather than owning a second copy of that correspondence.
 * It is asked ONE PAGE AT A TIME against the WHOLE code list, because its
 * legacy `SITE_QR` arm keys on a code's INDEX: handing it a one-element list
 * would make every code look like the first. It reads `source` and nothing
 * else, which is why a component can be asked the same question as a page.
 */
export function deadQrs({ qr, prior, missing, wrote, wroteParts, url } = {}) {
  const codes = qrList(qr);
  const gone = new Set((Array.isArray(missing) ? missing : []).map(route).filter(Boolean));
  if (!gone.size || !codes.length) return { qr: codes, dropped: [], withheld: [], withheldParts: [] };
  const base = siteAddress(url);
  const had = new Set(qrList(prior).map((c) => c.name));
  // WHICH ROUTE OF OURS THIS CODE OPENS, or "" for anything else — and since
  // 2026-09-20 it is `qrSiteRoute` above, which `cleanAdd` now asks too. This
  // was the inverse of a check `cleanAdd` only ever ran on a bare route, which
  // is how a full URL at our own origin passed both. The three refusals, and
  // the `!base` belt measured inert, are documented there.
  //
  // IT DROPS `ours` DELIBERATELY. Here the two readings really are one answer:
  // a code this change did not break is left alone whether it points somewhere
  // else or at nothing, because withholding rests on the route being one this
  // change PLANNED AND LOST, and "" is in no such set.
  const opens = (points) => qrSiteRoute(points, base).route;
  // THE PAGES THIS CHANGE WROTE, and only those. A page the change did not
  // touch cannot render a code the change just invented — it would not have
  // compiled — and it is not ours to withhold in any case.
  const written = (Array.isArray(wrote) ? wrote : []).filter((p) => p && typeof p.path === "string" && typeof p.source === "string");
  // THE COMPONENTS THIS CHANGE WROTE, same rule and same reason. A component
  // the change did not touch cannot render a code the change just invented.
  const parts = (Array.isArray(wroteParts) ? wroteParts : []).filter((p) => p && typeof p.name === "string" && p.name && typeof p.source === "string");
  // WHICH CODES A GIVEN PAGE RENDERS: `qrUnplaced` inverted, per page, against
  // the whole list so its index-keyed legacy arm still means what it means.
  const renders = (p) => {
    const off = new Set(qrUnplaced(codes, [p]));
    return codes.map((c) => c.name).filter((n) => n && !off.has(n));
  };
  // DOES THIS SOURCE IMPORT THAT COMPONENT — `importsPart`, in `site-files.mjs`
  // beside the `PART_DIR` it is a fact about. It was a closure here until it
  // gained a second caller in `routedSources`; the spellings it admits, the
  // `inPart` discriminator and the escaping are all documented there.
  const dead = new Set(), held = new Map(), heldParts = new Map(), goneParts = new Set();
  const dropped = [], withheld = [], withheldParts = [];
  // THE BOUND IS ONE ROUND PER CODE AND PER COMPONENT, plus the round that
  // finds nothing and breaks — and `!moved` is what really ends it. A chain of
  // K components listed in REVERSE order is what makes the rounds real: the
  // loop walks the list forwards, so a forward chain settles in one pass and a
  // reversed one needs a round per link. A bound that is SHORT does not hang —
  // it exits with the fixed point UNSETTLED, which is the same dangling import
  // one round later.
  //
  // ⚠ THE PAGES ARE DELIBERATELY NOT IN IT, and that is a proof rather than a
  // guess. Widening it to `+ written.length` was tried first, on the reasoning
  // that withholding an ADDED page returns its route to `gone` and can kill a
  // second code; A/B over 6,000 random chain shapes (2,621 with something
  // really withheld) found ZERO differences, and the reason is structural: a
  // round that changes neither `dead` nor `goneParts` cannot withhold a page it
  // did not already withhold last round, because the page loop walks the WHOLE
  // list every round against exactly those two sets. So no round is ever
  // productive on pages alone, and `codes + parts` bounds the productive rounds
  // however the three chains interleave.
  for (let round = 0; round <= codes.length + parts.length + 1; round++) {
    let moved = false;
    for (const c of codes) {
      if (dead.has(c.name)) continue;
      const r = had.has(c.name) ? "" : opens(c.points);
      if (!r || !gone.has(r)) continue;
      dead.add(c.name); dropped.push({ name: c.name, route: r }); moved = true;
    }
    // THE COMPONENTS FIRST, so a page withheld for importing one is decided in
    // the same round rather than the next — a nicety for the bound, and the
    // fixed point is the same either way.
    //
    // ⚠ AND A COMPONENT IS WITHHELD FOR IMPORTING ONE TOO, not only for showing
    // a code (owner, 2026-09-17: *"Propagate withholding through
    // component-to-component imports as well as page-to-component imports."*).
    // MEASURED through the route before this line existed, on the owner's own
    // chain — homepage → panel → qr-card → a code opening a missing `/gallery`:
    // `heldParts` was `["qr-card"]` alone, and the CONTAINER PAYLOAD carried
    // `panel` importing `@/routes/-parts/qr-card`, a module nothing would
    // write. The page loop had this test from the day the cascade shipped; the
    // component loop asked only `renders`, so the chain broke at its first hop
    // and `deadQrs` published a build that cannot compile.
    for (const p of parts) {
      if (heldParts.has(p.name)) continue;
      const shows = renders(p).some((n) => dead.has(n));
      const needs = [...goneParts].some((n) => importsPart(p.source, n, true));
      if (!(shows || needs)) continue;
      const entry = { name: p.name, added: p.added === true };
      heldParts.set(p.name, entry); withheldParts.push(entry); moved = true;
      // AND ONE THIS CHANGE INVENTED TAKES ITS MODULE WITH IT: nothing may
      // import a file that will not be written. One it merely CHANGED reverts
      // to the source the site is already serving, which its importers can go
      // on importing — so it never joins this set, and that is what makes
      // "restore the existing, withhold the new together" one rule rather than
      // two branches.
      if (entry.added) goneParts.add(p.name);
    }
    for (const p of written) {
      const shows = renders(p).some((n) => dead.has(n));
      const needs = [...goneParts].some((n) => importsPart(p.source, n));
      if (held.has(p.path) || !(shows || needs)) continue;
      const entry = { path: p.path, added: p.added === true };
      held.set(p.path, entry); withheld.push(entry); moved = true;
      // AND A PAGE THIS CHANGE INVENTED TAKES ITS ROUTE WITH IT — that is what
      // makes the cascade real. One it merely CHANGED keeps its route, because
      // the version that ships is the one the site is already serving.
      const back = entry.added ? routeOf(p.path) : "";
      if (back) gone.add(back);
    }
    if (!moved) break;
  }
  return { qr: codes.filter((c) => !dead.has(c.name)), dropped, withheld, withheldParts };
}

/**
 * The sentence for a code that was going to open a page that is not there.
 *
 * SAID BESIDE `missingPagesNote`, never instead of it: that one says the page
 * did not make it, this one says what else went with it. A customer who asked
 * for both and hears only about the page is left to discover the code's state
 * by scanning it.
 *
 * TWO OUTCOMES, TWO SENTENCES, because they are about different things and a
 * customer can act on each separately: the code is not there, and a page they
 * expected to change did not change. Saying only the first would leave them
 * looking for a section on a page that is exactly as it was.
 *
 * AND THE SECOND SENTENCE NAMES ROUTES, not file names: `/` is what they see
 * in the address bar, `index.tsx` is ours.
 *
 * A COMPONENT GETS ITS OWN SENTENCE, because it has no route to name and
 * "I left / as it was" is not true of it. The customer asked for a section, so
 * the section is what they hear about.
 */
export function deadQrNote({ dropped = [], withheld = [], withheldParts = [] } = {}) {
  const out = [];
  const names = (l) => l.slice(0, 3).map((d) => d && d.name).filter(Boolean).join(", ");
  const drop = (Array.isArray(dropped) ? dropped : []).filter((d) => d && d.name);
  const held = (Array.isArray(withheld) ? withheld : []).filter((d) => d && d.path);
  const parts = (Array.isArray(withheldParts) ? withheldParts : []).filter((d) => d && d.name);
  if (drop.length) {
    out.push("I didn't add the QR code" + (drop.length === 1 ? " " : "s ") + names(drop) +
      " — " + (drop.length === 1 ? "it was" : "they were") + " going to open that page, and a code that opens nothing " +
      "is worse than no code at all. Ask me for the page again and I'll add " + (drop.length === 1 ? "it" : "them") + " with it.");
  }
  // TWO SENTENCES FOR TWO KINDS OF WITHHOLDING, because "I left it as it was"
  // is FALSE of a page this change invented — there was no "as it was" — and a
  // customer reading it would go looking for a page that has never existed.
  const where = (l) => l.slice(0, 3).map((d) => routeOf(d.path) || d.path).join(", ");
  const kept = held.filter((d) => d.added !== true);
  const never = held.filter((d) => d.added === true);
  if (kept.length) {
    out.push("I've left " + where(kept) + " as " + (kept.length === 1 ? "it was" : "they were") +
      ", because the only change " + (kept.length === 1 ? "it" : "they") + " had was showing that code — putting " +
      (kept.length === 1 ? "it" : "them") + " live would have printed a code that opens nothing.");
  }
  if (never.length) {
    out.push("I haven't added " + where(never) + " either — " + (never.length === 1 ? "it was" : "they were") +
      " there to show that code, so on " + (never.length === 1 ? "its" : "their") + " own " +
      (never.length === 1 ? "it" : "they") + " would have been a page pointing at nothing.");
  }
  // AND THE SAME TWO OUTCOMES FOR A COMPONENT, in its own words. It has no
  // route, so it is named as the customer named it, and the two are kept apart
  // for the same reason: "left as it was" is false of one that never existed.
  const kp = parts.filter((d) => d.added !== true), np = parts.filter((d) => d.added === true);
  if (kp.length) {
    out.push("The " + names(kp) + " section" + (kp.length === 1 ? " is" : "s are") +
      " unchanged for the same reason — showing that code was the change.");
  }
  if (np.length) {
    out.push("And I haven't written the " + names(np) + " section" + (np.length === 1 ? "" : "s") +
      " — " + (np.length === 1 ? "it was" : "they were") + " there to show that code.");
  }
  return out.join(" ");
}

/**
 * WHICH TABLES THIS CHANGE GAVE A READER AND NO WAY OF GAINING A ROW.
 *
 * REPLACES A BLANKET REFUSAL, and the owner's correction is the whole design:
 * *"No client write grant does not mean no writer: a function, job, import, or
 * server operation may populate the table."* The first draft of this was going
 * to refuse any table with `write: "none"` — which is every `display` table on
 * the platform, every price list and every opening-hours table, all of them
 * perfectly legitimate and filled by the owner or by a seed.
 *
 * So it REPORTS, and only where the report is about something the customer
 * asked for. A table earns a mention only when BOTH are true:
 *
 *   1. something in THIS change reads it — a function whose body selects from
 *      it, or a page/component the change added that names it. A read-only
 *      lookup table nobody queried yet is not a problem to raise.
 *   2. nothing anywhere can put a row in it — no client write grant, no seed in
 *      this change, and no declared function or job whose body writes to it.
 *
 * THE WRITER SCAN IS THE PART THAT MATTERS and it is deliberately generous: any
 * `INSERT INTO t`, `UPDATE t` or `COPY t` in any declared function body counts,
 * whether or not that function is internal, because an internal function run by
 * a job is exactly the population path the owner named. Being generous is the
 * safe direction here — a missed writer produces a sentence nobody needed, and
 * a false "nothing can fill this" sends somebody hunting a defect that is not
 * there. The reverse, staying silent about run 47's `repairs`, is the failure.
 *
 * The owner's own door is NOT counted as a population path, and that is a
 * decision rather than an oversight: they can always type rows into the Data
 * panel, so counting it would make every table populated and the check vacuous.
 * The sentence says "or add the first rows yourself", which is that door named
 * where it is useful instead of used to silence the finding.
 */
export function missingPopulation({ spec = null, seed = null, readers = [] } = {}) {
  const s = spec && typeof spec === "object" ? spec : {};
  const tables = Array.isArray(s.tables) ? s.tables : [];
  if (!tables.length) return [];
  const seeded = new Set(Object.keys(seed && typeof seed === "object" ? seed : {}).map((k) => k.toLowerCase()));

  // Every table any declared function or job body writes to.
  const written = new Set();
  const bodies = [];
  for (const f of Array.isArray(s.functions) ? s.functions : []) if (f && typeof f.body === "string") bodies.push(f.body);
  for (const j of Array.isArray(s.jobs) ? s.jobs : []) if (j && typeof j.body === "string") bodies.push(j.body);
  for (const b of bodies) {
    for (const m of b.matchAll(/\b(?:insert\s+into|update|copy)\s+"?([a-z_][a-z0-9_]*)"?/gi)) {
      written.add(String(m[1]).toLowerCase());
    }
  }

  const wanted = new Set((Array.isArray(readers) ? readers : []).map((r) => String(r || "").toLowerCase()).filter(Boolean));
  const out = [];
  for (const t of tables) {
    if (!t || !t.name) continue;
    const name = String(t.name).toLowerCase();
    if (!wanted.has(name)) continue;
    if (seeded.has(name) || written.has(name)) continue;
    const { write } = resolveAccess(t);
    if (write !== "none") continue;
    if (!out.includes(t.name)) out.push(t.name);
  }
  return out;
}

/**
 * WHICH TABLES THIS CHANGE READS — the other half of `missingPopulation`, and
 * separate from it because the two answer different questions and a caller may
 * have a better list than this can derive.
 *
 * A function body that selects from a table reads it; so does a page or a
 * component whose source names it. Both are bodies of text this change wrote,
 * which is what makes "in THIS change" real rather than a claim about the site.
 */
export function readTables({ spec = null, sources = [] } = {}) {
  const s = spec && typeof spec === "object" ? spec : {};
  const names = (Array.isArray(s.tables) ? s.tables : []).map((t) => t && t.name).filter(Boolean);
  if (!names.length) return [];
  const text = [];
  for (const f of Array.isArray(s.functions) ? s.functions : []) if (f && typeof f.body === "string") text.push(f.body);
  for (const f of Array.isArray(s.functions) ? s.functions : []) if (f && typeof f.returns === "string") text.push(f.returns);
  for (const src of Array.isArray(sources) ? sources : []) if (typeof src === "string") text.push(src);
  const blob = text.join("\n");
  const out = [];
  for (const n of names) {
    // WORD-BOUNDED, never `includes` — the recorded `bookings` / `bookings_old`
    // rule. A table called `repairs` must not be read into `repairs_archive`.
    if (new RegExp("\\b" + String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(blob) && !out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * The sentence for a table this change reads and nothing can fill.
 *
 * NAMES THE TABLE, because that is what a customer can act on, and says what it
 * means for the thing they asked for rather than reporting a permission.
 */
export function populationNote(names) {
  const list = (Array.isArray(names) ? names : []).filter((n) => typeof n === "string" && n);
  if (!list.length) return "";
  const named = list.slice(0, 3).join(", ");
  const rest = list.length > 3 ? " and " + (list.length - 3) + " more" : "";
  return list.length === 1
    ? "Nothing can put rows into " + named + " yet, so whatever reads it will show nothing until something does — a form, an import, or add the first rows yourself."
    : "Nothing can put rows into " + named + rest + " yet, so whatever reads them will show nothing until something does — a form, an import, or add the first rows yourself.";
}

/**
 * THE SEED SKIPS, SAID ACCURATELY.
 *
 * `seedSiteRows` answers `{seeded, skipped}` and `skipped` is written ONLY for a
 * table the design really asked to seed — the loop is over the seed object's
 * own keys — so this can never imply seeding was required where it was not.
 * That is a property of the producer, not a filter here, which is why this
 * function does no guessing of its own: it renders what it is handed.
 *
 * Until now that report went into the migration record and reached NOBODY.
 * `"repairs: only display tables are seeded"` is the single sentence that can
 * say why a brand-new table arrived empty, and run 47's customer never saw it.
 *
 * THE EFFECT IS SAID, NOT THE RULE. "Only display tables are seeded" is our
 * vocabulary; what the customer needs is that the table starts empty and what
 * that means for the page they asked for.
 */
export function seedSkipNote(skipped) {
  const list = (Array.isArray(skipped) ? skipped : []).map((s) => String(s || "")).filter(Boolean);
  // TWO EMPTY CHECKS, AND THE REDUNDANCY IS DELIBERATE — said here because a
  // sweep cannot say it and the next session deletes what nothing appears to
  // need. The first refuses an empty LIST; the second refuses a list whose
  // entries carry no table name (`"  "`, `": nothing"`). Each catches the
  // other's input today, so a mutant removing either alone survives; a mutant
  // removing BOTH composes a sentence about nothing, which is exactly the
  // "imply seeding was required when it wasn't" the owner ruled out, and that
  // pair is what the sweep mutates.
  if (!list.length) return "";
  const named = list.map((s) => s.split(":")[0].trim()).filter(Boolean);
  const uniq = [...new Set(named)];
  if (!uniq.length) return "";
  const head = uniq.slice(0, 3).join(", ");
  const rest = uniq.length > 3 ? " and " + (uniq.length - 3) + " more" : "";
  return uniq.length === 1
    ? "I had starter rows ready for " + head + " and didn't put them in — that table isn't one visitors can read, so it starts empty."
    : "I had starter rows ready for " + head + rest + " and didn't put them in — those tables aren't ones visitors can read, so they start empty.";
}

export function addRepairNote(round) {
  const x = round && typeof round === "object" ? round : null;
  if (!x) return "";
  const names = (v) => (Array.isArray(v) ? v : []).map((e) => (e && typeof e === "object" ? e.route || e.path : e)).filter(Boolean);
  if (x.ran === false && x.why === "time") {
    const at = names(x.routes);
    return at.length ? `I ran out of time to try a fix for ${at.slice(0, 3).join(", ")}, so it's published as it is.` : "";
  }
  if (x.ran === true && !x.built) {
    const at = names(x.refused).concat(names(x.repaired));
    return at.length ? `I tried a fix for ${at.slice(0, 3).join(", ")} and it didn't hold, so it's published as it was.` : "";
  }
  if (x.ran === true && x.built) {
    const stuck = names(x.refused);
    if (!stuck.length) return "";
    return stuck.length === 1
      ? `One page — ${stuck[0]} — still isn't rendering properly; it's published as it is. Ask me to rebuild it and I'll have another go.`
      : `Some pages still aren't rendering properly (${stuck.slice(0, 3).join(", ")}); they're published as they are. Ask me to rebuild them and I'll have another go.`;
  }
  return "";
}

/**
 * WHAT THE SITE ALREADY HAS, beside what this change applied (2026-09-15).
 *
 * Owner: *"Distinguish 'not added by this change' from 'absent from the site.'
 * Reconcile against trustworthy existing-site evidence as well as applied
 * additions."* A change that reuses a function it did not need to create leaves
 * nothing in `appliedFacts`, and reading that silence as absence tells a
 * customer a live function is still to do — run 48's defect one door over.
 *
 * `{ items: [{kind, name}], kinds: [...] }`, the same two-part shape
 * `implementationOf` reads for applied results: `items` is what is there, and
 * `kinds` is where an ABSENCE is visible. They are separate because presence
 * and absence are separate claims, and `kinds` is DERIVED FROM WHAT THE CALLER
 * REALLY HANDED OVER rather than being a constant:
 *
 *   * a `spec` — the site's own `_meta.schema`, which the addon route reads
 *     through `specForAddon` and which STOPS rather than guessing — makes
 *     `table`, `function`, `api` and `job` enumerable. It is the record the
 *     whole platform already treats as what a site has: `siteNote` describes
 *     the site from it, `cleanAdd("job")` admits a job only against its
 *     function list, and `applySiteSchema` writes it. **The limit, stated: it
 *     is a DECLARATION.** A function that exists in Postgres and is not
 *     declared is invisible here — and invisible everywhere else on the
 *     platform too, so this claims nothing the rest of the system does not.
 *   * `pages` — the stored page source — makes `page` enumerable. Those ARE
 *     the site's routes.
 *   * `look` — the stored config — makes `qr` and `three` enumerable, the two
 *     `SINGLE_FIELDS`/`ADD_ONLY_FIELDS` kinds a site really carries by name.
 *     `qrList` is the one reader of the code list, here as everywhere.
 *
 * **`kinds` IS INTERSECTED WITH `SITE_KINDS` RATHER THAN LISTED AGAIN**, so
 * this cannot claim to enumerate a kind the reconciliation does not believe a
 * site can hold, and a kind added to one list has to be added to the other on
 * purpose. `component` and `photo` are `OPAQUE_KINDS` and appear in neither.
 *
 * A caller that hands over nothing gets `{items: [], kinds: []}`, which makes
 * every holdable kind's absence `unknown` — the conservative answer, and the
 * one an unchanged caller keeps.
 */
export function existingFacts({ spec = null, pages = null, look = null, sources = null, slug = "" } = {}) {
  const items = [];
  const kinds = [];
  const names = (list) => (Array.isArray(list) ? list : [])
    .map((x) => String((x && x.name) || "").trim()).filter(Boolean);
  const speaks = (k) => { if (SITE_KINDS.includes(k) && !kinds.includes(k)) kinds.push(k); };
  if (spec && typeof spec === "object") {
    for (const [kind, key] of [["table", "tables"], ["function", "functions"], ["api", "apis"], ["job", "jobs"]]) {
      speaks(kind);
      for (const n of names(spec[key])) items.push({ kind, name: n });
    }
  }
  if (Array.isArray(pages)) {
    speaks("page");
    for (const p of pages) {
      const r = typeof p === "string" ? p : String((p && p.path) || "");
      if (r.trim()) items.push({ kind: "page", name: r.trim() });
    }
    // ── AND WHICH PAGES ALREADY SHOW A PHOTOGRAPH (2026-09-19) ─────────────
    //
    // A PHOTOGRAPH'S IDENTITY IS ITS PLACEMENT, not its file. The `photo`
    // designer answers `{page, describe}` — it cannot know the url, which is
    // minted by the provider after it has spoken — so the only thing a
    // requirement about a picture can name is the PAGE it is on, and that is
    // also the owner's own word for it: *"a requirement must resolve against
    // the actual item or placement it concerns."*
    //
    // SITE-WIDE ENUMERATION IS WHAT PUTS `photo` IN `SITE_KINDS`: `imageRefs`
    // reads every page's own picture references, so "this site already shows a
    // photograph on /gallery" is a fact this layer can state — which is the
    // test that separates `SITE_KINDS` from `OPAQUE_KINDS`, and the reason a
    // component still cannot be enumerated and a photograph now can.
    //
  }
  // ── AND WHICH PAGES ALREADY SHOW A PHOTOGRAPH (2026-09-19) ──────────────
  //
  // A SEPARATE INPUT, because `pages` above is a list of ROUTES and this needs
  // each page's SOURCE — a route cannot be asked what it draws. `sources` is
  // the site's stored source as the route already holds it, and the route is
  // derived here with `routeOf`, the same reader every other page identity on
  // this path goes through, so the two lists cannot spell one page two ways.
  //
  // NEEDS THE SLUG, because `imageRefs` is scoped to this site's own prefix: a
  // kit illustration and another site's upload are both `src` attributes and
  // neither is a photograph this owner paid for. With no slug the site's
  // photographs are not enumerable and `photo` MUST NOT SPEAK — `speaks` is
  // inside the guard for that reason, so "nobody looked" stays `unknown`
  // rather than becoming a silent "there are none".
  if (Array.isArray(sources) && slug) {
    speaks("photo");
    for (const p of sources) {
      if (!p || typeof p.source !== "string") continue;
      const r = routeOf(p.path);
      // ⚠ `.size`, NOT `.length` — `imageRefs` answers a SET, and `Set.length`
      // is `undefined`. MEASURED: with `.length` this branch was false for
      // every page on every site, so `existingFacts` has never once emitted a
      // photograph — `speaks("photo")` fired, so the kind read as ENUMERATED
      // and the inventory was always empty, which is the worst way round: an
      // absence that reads as "we looked and there are none". Found by the
      // guard below rather than by a sweep, because the mutant that renamed
      // the entry could not fail over a list nothing ever put anything in.
      if (r && imageRefs(p.source, slug).size) items.push({ kind: "photo", name: r });
    }
  }
  if (look && typeof look === "object") {
    speaks("qr");
    for (const q of qrList(look.qr)) { const n = String((q && q.name) || "").trim(); if (n) items.push({ kind: "qr", name: n }); }
    speaks("three");
    // A SITE CARRIES AT MOST ONE SCENE (`SINGLE_FIELDS`), so it has no name of
    // its own and the kind IS the name — which is the whole of what a
    // requirement handed to `three` can be asking about.
    if (look.three) items.push({ kind: "three", name: "three" });
  }
  return { items, kinds };
}

/** How many tables' columns a stored input digest keeps, and how many each. */
export const MAX_SHOWN_TABLES = 12;
export const MAX_SHOWN_COLUMNS = 24;

/**
 * WHAT A DESIGNER WAS REALLY SHOWN ABOUT THE SITE'S DATABASE (2026-09-15).
 *
 * Owner, after run 48: *"Recover the actual designer input if it was recorded.
 * Otherwise mark schema receipt unverified and prepare minimal instrumentation
 * for the next test."* **It was not recorded, and this is the instrumentation.**
 *
 * What the addon stored was `site: aSite` — ONE value, written after the whole
 * loop, so it is the facts as they stood at the END and not what any particular
 * designer was handed. Run 48's `function` designer ran first; by the time the
 * record was written `aSite` had been rebuilt over its own answer. So "did the
 * function step see `bookings`?" had no direct answer in the record at all, and
 * the run's whole first demonstration rested on inference.
 *
 * THE DIGEST IS TAKEN FROM THE OBJECT REALLY HANDED TO THE CALL, never
 * re-derived beside it. A second derivation is a second copy that can disagree
 * with the first, which is this repository's most-repeated defect and is
 * precisely the class of thing this exists to settle.
 *
 * **SCHEMA ONLY, AND DELIBERATELY NOT THE PROMPT.** The composed note carries
 * the customer's own words, the page labels and the kit menu; storing it would
 * put a customer's sentence into a per-kind record for a second time and make
 * the record grow with the catalog. The question this answers is narrow — which
 * tables, with which columns, were in front of this step — so the digest is
 * narrow, and `hasDatabase` rides with it because a site the step was told has
 * NO database is the exact shape run 47 met.
 */
export function shownSchema(site) {
  const s = site && typeof site === "object" ? site : {};
  const names = (v) => (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x);
  const cols = s.columns && typeof s.columns === "object" ? s.columns : {};
  return {
    tables: names(s.tables).slice(0, MAX_SHOWN_TABLES),
    columns: Object.fromEntries(names(s.tables).slice(0, MAX_SHOWN_TABLES)
      .map((t) => [t, names(cols[t]).slice(0, MAX_SHOWN_COLUMNS)])),
    functions: names(s.functions).slice(0, MAX_SHOWN_TABLES),
    apis: names(s.apis).slice(0, MAX_SHOWN_TABLES),
    jobs: names(s.jobs).slice(0, MAX_SHOWN_TABLES),
    // A BOOLEAN, because `hasDatabase: false` beside a non-empty `tables` is a
    // contradiction worth being able to read back — and it is the one field
    // whose false value is the whole of run 47's defect.
    hasDatabase: !!s.hasDatabase,
  };
}

/**
 * THE KINDS `appliedFacts` CAN SPEAK FOR — and the reason this list exists is
 * the answer it makes possible for every kind that is NOT on it.
 *
 * `implementationOf` asks whether a step really made the thing a requirement
 * was handed to it for. With no entries of that kind there are two different
 * facts underneath: *the step made nothing*, and *nothing here can see what
 * that step makes*. `component` is the second — an addition folded into an
 * existing page leaves no item in any applied list — and reading it as the
 * first would report a working section as missing, which is the exact defect
 * run 48 found one kind over.
 *
 * So a kind on this list can answer `absent`; a kind off it answers `unknown`,
 * which falls to `unverified`. **Cannot-tell must never read as a value**, this
 * repository's most-repeated rule, met where the wrong direction is a sentence
 * telling a customer a shipped feature is still to do.
 *
 * ── `qr` AND `three` JOINED IT 2026-09-19, AND RUN 51 IS THE INSTANCE ───────
 *
 * Owner: *"Check why the reply says it cannot establish the QR implementation
 * when this run created and published it."*
 *
 * The page step handed *"A QR code opens the gallery page."* to the `qr` step,
 * the `qr` step made one code pointing at `/gallery`, the container baked
 * `qr-gallery.svg`, the site published it and it re-encodes to that address.
 * The customer was told **"I can't see from here whether A QR code opens the
 * gallery page — nothing I can check says either way."**
 *
 * NOTHING WAS WRONG WITH THE READER; IT HAD NOTHING TO READ. A code and a
 * scene are applied results of the change exactly as a page is, and neither
 * appeared in any applied list — so `implementationOf` asked its question of an
 * empty haystack and correctly answered "nobody looked". The kinds were on
 * `SITE_KINDS` (the site can hold one and `existingFacts` enumerates them) and
 * off this list, which is the combination that says *we can see what the site
 * already had and never what this change added* — true of no other kind here.
 *
 * WHAT THEY ARE READY IS NOT WHEN THE BACKEND APPLIES. The four schema tiers
 * are answerable once `applySiteSchema` has run and `page` once the merge has
 * decided what compiled; a code and a scene are decided by the look merge and
 * the dead-QR drop, which happen before either. `aReportable` in the addon
 * route carries that per-kind readiness, so a coverage composed on a refusal
 * path still answers `unknown` for them rather than `absent`.
 */
export const APPLIED_KINDS = Object.freeze(["table", "function", "api", "job", "page", "qr", "three", "photo"]);

/**
 * WHAT A CHANGE REALLY APPLIED, AND WHAT EACH ITEM REALLY GUARANTEES.
 *
 * `[{ kind, name, holds, fails, checked }]`, which is what `claimEvidence` checks
 * a `covered` claim against: `holds` are words from a CLOSED VOCABULARY that are
 * true of the item as it was applied, `fails` are words from that SAME
 * vocabulary that are false of it.
 *
 * ── `kind` IS THE EXPLICIT REFERENCE, AND IT IS WHY IT EXISTS (2026-09-15) ───
 *
 * Owner, after run 48: *"Reconcile requirements with actual applied results
 * using explicit references, such as kind and item name — not another keyword
 * heuristic."*
 *
 * Every entry used to carry a NAME and nothing else, so the only way to ask
 * "did the function step really make something" was to scan text for the name —
 * which is the heuristic `claimEvidence` already is, and which cannot answer a
 * question about a HANDOFF at all, because a handoff carries no `by` clause to
 * scan. `kind` is stamped by the loop that produced the entry — it is which
 * list the name came out of, not a reading of anything — so
 * `implementationOf` can ask a structural question (`r.step === m.kind`,
 * `r.item === m.name`) and get a structural answer.
 *
 * `page` IS HERE FOR THE SAME REASON AND CARRIES NO GUARANTEES. A published
 * route is an applied result — the page step really made it — and that is the
 * whole of what its presence establishes, so `holds` is EMPTY rather than
 * carrying the route or its name. A page existing has never been evidence that
 * the page does anything, which is this module's oldest rule; what changed is
 * only that its EXISTENCE is now readable, so an implementation can be
 * distinguished from a missing one without claiming the behaviour.
 *
 * ── EVERYTHING HERE IS CONFIGURATION, AND `checked` IS EMPTY ON PURPOSE ─────
 *
 * Owner, 2026-09-14: *"Matching configuration words must not mark an entire
 * business requirement delivered. 'The function is public' does not prove it
 * checks ownership."*
 *
 * Every token this function produces is a SETTING READ BACK off what was
 * applied — a table's access level, a function's visibility, a connection's
 * host. Not one of them is a behaviour anybody exercised: **nothing on this
 * path calls a function, requests a connection or fires a job to see what it
 * does.** So `checked` — the only list `claimEvidence` will promote to
 * `delivered` — is EMPTY on every item, and it is empty because that is true
 * rather than because nobody filled it in.
 *
 * What would fill it is a step that really ran the thing and read the answer:
 * a probe call against a created function, a request through a stored
 * connection, a job fired once with its output inspected. Each costs a real
 * call against the customer's own database or somebody else's service, which
 * is why none of them happens here today. **Do not fill `checked` from
 * anything short of that** — a fact about a setting goes in `holds`, where it
 * is recorded and does not claim the behaviour.
 *
 * **THE THREE WAYS IT WOULD BE FILLED WRONGLY, NAMED** (owner, 2026-09-14:
 * *"Don't populate it from configuration, keyword matches, or this one
 * successful test as though every future generated feature were verified."*).
 * (1) From CONFIGURATION — copying `holds`, which is the whole distinction
 * collapsed. (2) From a KEYWORD MATCH — a word appearing in the claim is what
 * `claimEvidence` already asks; putting the same test on this side would make
 * the claim its own evidence. (3) From ONE PASSING RUN — a live check on one
 * site proves that site's one feature worked once, and `checked` is read for
 * EVERY generated feature after it. An empty list is the correct answer for
 * this change, and it stays empty until a step here really exercises the
 * thing: `test/addon-steps.test.mjs` drives all five applied kinds and asserts
 * every `checked` is `[]`, so filling one is a red run rather than a drift.
 *
 * ── WHY IT LIVES HERE AND NOT IN THE ROUTE (2026-09-14) ─────────────────────
 *
 * It was written inline in the addon route, and a sweep mutant that emptied
 * `fails` — turning every contradicting claim back into evidence — SURVIVED,
 * because the only route path that applies a table is the one that then wants a
 * container and a compile. A wall nobody can drive is a wall nobody is
 * guarding. Here it is one call and the test drives it.
 *
 * ── THE VOCABULARY IS THE ENGINE'S OWN ──────────────────────────────────────
 *
 * The access levels come from `ACCESS_PRESETS` / `READ_LEVELS` / `WRITE_LEVELS`
 * and the level itself from `resolveAccess` — the reader five separate bugs
 * have been paid for — so a claim saying `bookings access user` about a table
 * applied as `collect` is checked against what Postgres really enforces rather
 * than against a second list of level names kept beside it.
 *
 * ── WHAT EACH TIER OFFERS, AND WHY THE LISTS ARE SHORT ──────────────────────
 *
 *   table     the access level it really got, its real columns, `unique` where
 *             the applied table really keeps one. `fails` is every OTHER level.
 *   function  that it exists as an applied function at all.
 *   api       that the connection exists.
 *   job       its real schedule — the clock time and the interval — which is
 *             the one thing about a job a claim can name and we can check.
 *
 * A JOB WHOSE FUNCTION THE DATABASE REFUSED IS NOT A RESULT and is left OUT
 * entirely rather than given a `fails` token: the job exists and its schedule
 * is real, so there is nothing about it to contradict — what is missing is the
 * work it does. MEASURED through the real route: `CREATE OR REPLACE FUNCTION`
 * answered with a syntax error, the job registered against it all the same, and
 * a claim naming the job's real 09:00 schedule read `delivered`.
 */
export function appliedFacts({ spec = null, tables = [], altered = [], functions = [], apis = [], jobs = [], pages = [], fnErrors = [], qrs = [], three = false, threeOn = [], threeUnsure = false, photos = [], shots = [] } = {}) {
  const levels = [...new Set([...Object.keys(ACCESS_PRESETS), ...READ_LEVELS, ...WRITE_LEVELS])];
  const list = (spec && Array.isArray(spec.tables)) ? spec.tables : [];
  const factsFor = (name) => {
    const t = list.find((x) => x && String(x.name || "").toLowerCase() === name);
    if (!t) return { holds: [], fails: [], checked: [] };
    const acc = resolveAccess(t);
    const mine = new Set([String(t.access || ""), acc.read, acc.write].filter(Boolean));
    const cols = (Array.isArray(t.columns) ? t.columns : [])
      .map((c) => String((typeof c === "string" ? c : (c && c.name)) || "").toLowerCase()).filter(Boolean);
    const holds = [...mine, ...cols];
    if (Array.isArray(t.unique) && t.unique.length) holds.push("unique");
    return { holds, fails: levels.filter((l) => !mine.has(l)), checked: [] };
  };
  const out = [];
  const named = [...(Array.isArray(tables) ? tables : []),
    ...(Array.isArray(altered) ? altered : []).map((a) => a && a.table).filter(Boolean)];
  for (const name of named) {
    const n = String(name || "").toLowerCase();
    if (n) out.push({ kind: "table", name: n, ...factsFor(n) });
  }
  // ── A FUNCTION'S GUARANTEES ARE ITS APPLIED SETTINGS (2026-09-14) ─────────
  //
  // These were the literals `["internal", "function"]` on EVERY applied
  // function, which is the defect this whole reader exists to close, written
  // into the closure itself: a claim saying *"send_reminder is internal, so no
  // visitor can call it"* scored `delivered` against a function created PUBLIC,
  // because the word was in the list whatever the function was.
  //
  // WHAT IS REALLY CHECKABLE about an applied function: who may call it, what
  // it returns, and what it takes. The visibility axis is the one that matters
  // and it is two-sided — a claim that names the wrong side of it is a
  // contradiction, not a silence.
  const fnList = (spec && Array.isArray(spec.functions)) ? spec.functions : [];
  for (const n of (Array.isArray(functions) ? functions : [])) {
    const f = fnList.find((x) => x && String(x.name || "").toLowerCase() === String(n).toLowerCase());
    if (!f) { out.push({ kind: "function", name: n, holds: [], fails: [], checked: [] }); continue; }
    const holds = [], fails = [];
    if (f.internal) { holds.push("internal"); fails.push("public"); }
    else { holds.push("public"); fails.push("internal"); }
    if (typeof f.returns === "string" && f.returns) holds.push(...String(f.returns).toLowerCase().split(/[^a-z0-9_]+/).filter((w) => w.length >= 3));
    for (const a of (Array.isArray(f.args) ? f.args : [])) if (a && a.name) holds.push(String(a.name).toLowerCase());
    out.push({ kind: "function", name: n, holds, fails, checked: [] });
  }
  // ── A CONNECTION PROVES CONFIGURATION, NEVER BEHAVIOUR ───────────────────
  //
  // Owner, 2026-09-14: *"A stored connection proves configuration exists; it
  // does not prove credentials work or the external service answers."* An api
  // is not DDL — it lives in `_meta.schema`, so "applied" here means STORED,
  // and storing a declaration is the entire extent of what this layer did.
  // Nothing has called the service, nothing has checked the key.
  //
  // So the tokens are CONFIGURATION ONLY — the host it points at, the verb, the
  // parameters it accepts, the cache window — and deliberately carry no word
  // about what the page will see. A claim about behaviour ("customers see the
  // live forecast") names none of them and stays `unverified`, which is the
  // honest answer until somebody checks the credential against the service.
  const apiList = (spec && Array.isArray(spec.apis)) ? spec.apis : [];
  for (const n of (Array.isArray(apis) ? apis : [])) {
    const a = apiList.find((x) => x && String(x.name || "").toLowerCase() === String(n).toLowerCase());
    if (!a) { out.push({ kind: "api", name: n, holds: [], fails: [], checked: [] }); continue; }
    const holds = [], fails = [];
    let host = "";
    try { host = new URL(String(a.url || "")).hostname.toLowerCase(); } catch { host = ""; }
    if (host) holds.push(host);
    const method = String(a.method || "GET").toUpperCase() === "POST" ? "post" : "get";
    holds.push(method);
    fails.push(method === "post" ? "get" : "post");
    for (const p of (Array.isArray(a.params) ? a.params : [])) if (p) holds.push(String(p).toLowerCase());
    if (Number(a.ttl) > 0) holds.push(String(a.ttl));
    out.push({ kind: "api", name: n, holds, fails, checked: [] });
  }
  // ── THE SECOND WALL, AND THE REDUNDANCY IS DELIBERATE ────────────────────
  //
  // Since 2026-09-14 the addon route BLOCKS a job whose new function failed —
  // it is never registered and never reaches `jobs` here, so this skip fires on
  // nothing on that path. It stays because the two walls answer different
  // questions and a sweep cannot say so: the route's is about what the site
  // really runs, this one is about what may be quoted back as evidence, and
  // `appliedFacts` has other callers' shapes to survive (a job list assembled
  // anywhere that does not know about `fnErrors`). Deleting it would make the
  // evidence reader depend on a caller keeping a rule it does not state.
  const dead = new Set((Array.isArray(fnErrors) ? fnErrors : [])
    .map((e) => String((e && e.name) || "").toLowerCase()).filter(Boolean));
  for (const j of (Array.isArray(jobs) ? jobs : [])) {
    if (!j || !j.name) continue;
    if (dead.has(String(j.fn || "").toLowerCase())) continue;
    out.push({ kind: "job", name: j.name, holds: [String(j.everyMinutes || ""), String(j.at || "")].filter(Boolean), fails: [], checked: [] });
  }
  // A PUBLISHED ROUTE, AND DELIBERATELY WITH AN EMPTY VOCABULARY. See the head
  // of this function: existence is the entire claim, so there is nothing here
  // for `claimEvidence` to promote and nothing for a claim to contradict. What
  // reads it is `implementationOf`, which asks whether the page step produced
  // anything at all — never what the page does.
  for (const p of (Array.isArray(pages) ? pages : [])) {
    const n = String(p || "").trim();
    if (n) out.push({ kind: "page", name: n, holds: [], fails: [], checked: [] });
  }
  // ── A CODE THIS CHANGE MADE, AND ITS DESTINATION IS THE CHECKABLE PART ───
  //
  // A QR code is the one addition here whose whole point is a DESTINATION, and
  // that destination is a string we stored — so it is configuration in exactly
  // the sense the head of this function means: read back off what was applied,
  // never exercised. Nothing has scanned the drawing with a camera and nothing
  // here ever will, so `checked` stays empty and the furthest a claim naming a
  // code can get is `configured`.
  //
  // THE TOKENS ARE THE DESTINATION'S OWN PATH WORDS and nothing else. The label
  // is prose somebody wrote for a customer to read, and matching a claim
  // against it would be the keyword heuristic this reader exists to replace;
  // the path is what the code really opens. `fails` is EMPTY because there is
  // no closed vocabulary with an opposite side here — a function is internal or
  // public and a connection is GET or POST, but a code pointing at `/gallery`
  // contradicts nothing, it simply does not mention `/prices`.
  //
  // The NAME is the identifier the file and the binding are made from
  // (`qr-<name>.svg`, `SITE_QRS.<name>`), which is what a `{kind, name}`
  // reference can be resolved against.
  for (const q of qrList(qrs)) {
    const n = String((q && q.name) || "").trim();
    if (!n) continue;
    const holds = [];
    // THE PATH OF A WEB ADDRESS, AND NOTHING ELSE. A stored destination is
    // absolute (`https://<slug>.gofarther.app/gallery`), so the HOST's words are
    // the site's slug repeated on every code and would match any claim naming
    // the business; the path is the one part that differs per code.
    //
    // ⚠ AND THE SCHEME IS CHECKED RATHER THAN LEFT TO `URL` THROWING — a sweep
    // survivor's case measured it. `new URL("WIFI:S=Fretwork;;")` parses
    // perfectly well and its pathname is `S=Fretwork;;`, so a Wi-Fi code was
    // contributing the network's name — which on a real site is the business's
    // name, and is the collision this split exists to avoid. `tel:` and
    // `mailto:` are the same shape. Only `http`/`https` has a path that means a
    // page; everything else contributes nothing, which is the honest answer
    // about a payload that opens no page at all.
    let path = "";
    try {
      const u = new URL(String((q && q.points) || ""));
      if (u.protocol === "http:" || u.protocol === "https:") path = u.pathname;
    } catch { path = ""; }
    for (const w of path.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 3) holds.push(w);
    out.push({ kind: "qr", name: n, holds, fails: [], checked: [] });
  }
  // A SCENE, AND A SITE CARRIES AT MOST ONE (`SINGLE_FIELDS`), so it has no
  // name of its own and the kind IS the name — the same identity
  // `existingFacts` gives it, so one reference resolves in both haystacks.
  //
  // ── DECLARED AND ON-THE-PAGE ARE TWO FACTS (2026-09-19) ──────────────────
  //
  // Owner: *"For 3D, distinguish: A scene declared. • The scene actually
  // included in the relevant page/artifact."* They really can come apart, and
  // the way they do is this repository's own most expensive shape: `three` is
  // a STORED LOOK FIELD and the canvas is written by the PAGE step, which is a
  // different model call reading `sceneDirective`. A page that ignores that
  // directive leaves the site configured for a scene and showing none — and
  // `three` was DEAD ON ARRIVAL for exactly that reason once already, with the
  // field stored and no way for it to reach the page rules.
  //
  // BOTH ARE ARTIFACT FACTS AND NEITHER IS BEHAVIOUR, so both belong in
  // `holds` and `checked` stays empty: nothing here starts a WebGL context,
  // and a `<Canvas>` in the source is not a scene a visitor can see.
  //
  // `fails: ["onpage"]` WHEN IT IS DECLARED AND ON NO PAGE, because `fails` is
  // asked FIRST: a claim saying the scene shows on the page is then
  // contradicted rather than quietly reading as configuration that holds. The
  // routes ride in `holds` so a claim naming one resolves against the page it
  // really landed on.
  //
  // ⚠ AND `threeUnsure` IS THE THIRD ANSWER (2026-09-20). A canvas written into
  // a component that a page IMPORTS and may or may not render is neither on the
  // page nor provably off it — and with only two words available, the reader
  // recorded it as `fails: ["onpage"]`, which is a CONTRADICTION: the strongest
  // negative this vocabulary has, over evidence that establishes nothing. It
  // says neither now, so a claim about the scene showing on the page reads
  // `unknown` — *"nothing I can check says either way"* — instead.
  if (three) {
    const on = Array.isArray(threeOn) ? threeOn.filter((r) => typeof r === "string" && r) : [];
    out.push({
      kind: "three",
      name: "three",
      holds: ["declared", ...(on.length ? ["onpage", ...on] : [])],
      fails: on.length || threeUnsure === true ? [] : ["onpage"],
      checked: [],
    });
  }
  // ── AND THE PHOTOGRAPHS, BY THE PAGE THEY LANDED ON (2026-09-19) ─────────
  //
  // Owner: *"For photographs, distinguish: An existing image reused. • A newly
  // generated image. • A provider refusal or failure. • An image acquired but
  // not placed. • An unavailable destination page."*
  //
  // THE IDENTITY IS THE PLACEMENT AND IT HAS TO BE. The `photo` designer
  // answers `{page, describe}`; the url is minted by the provider AFTER it has
  // spoken, so a requirement about a picture can name nothing but the page it
  // is on. That is also the only identity both haystacks can share — a
  // photograph the site already had is enumerable by page and not by intent.
  //
  // FIVE OUTCOMES, AND ONLY TWO OF THEM ARE ENTRIES HERE. An entry means a
  // picture really landed on that route, and its `holds` says which kind:
  //
  //   bought   — this change generated it (its url is one the provider minted
  //              in this run, so no earlier page can have carried it)
  //   reused   — a photograph the site already owned, now shown here too
  //
  // The other three are ABSENCES and are answered by the readers that own
  // them, which is what keeps this list a statement about what exists:
  //
  //   provider refused        — nothing was bought, the step is in `failed`,
  //                             and the claim reads `blocked`/`failed`
  //   acquired but not placed — a picture was bought and no route carries it,
  //                             so no entry names that route and the claim
  //                             reads `missing` (this layer LOOKED)
  //   destination unavailable — the page did not survive, so it is in the
  //                             missing-pages list and the claim reads
  //                             `missing` for the page's own reason
  //
  // `checked` IS EMPTY, as everywhere else here: a url in a `src` is
  // configuration read back off what was published, and nothing on this path
  // has loaded the image or looked at what it shows.
  // ⚠ AND EACH REQUESTED PICTURE BY ITS OWN NAME (corrected 2026-09-19).
  //
  // REPRODUCED: a bench photograph generated and placed on `/gallery`, an oven
  // photograph refused on the same page. Both requirements named `/gallery` —
  // the only identity a photograph had — so the route's failure answered both
  // and the customer was told the bench picture was not there.
  //
  // A ROUTE IS THE IDENTITY OF *WHERE* AND IT CANNOT SEPARATE TWO PICTURES ON
  // IT. `shots` is the requests that really LANDED, each under the name its
  // own designer gave it, so an individual requirement resolves against its
  // own picture; the route entries below stay, and are what keeps a COMBINED
  // requirement ("both photographs are on the gallery page") incomplete while
  // one of them is missing.
  //
  // `bought` WITHOUT A CONDITION, because a shot IS a request this change
  // made: a landed one is a picture the provider minted in this run. The
  // route's words ride along for the same reason they do below — a `by` clause
  // says *"the bench photograph on the gallery page"*, which names neither
  // `bought` nor a name we invented.
  for (const s of Array.isArray(shots) ? shots : []) {
    const name = String((s && s.name) || "").trim().toLowerCase();
    const route = String((s && s.route) || "").trim();
    if (!name) continue;
    const holds = ["bought"];
    for (const w of route.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 3) holds.push(w);
    out.push({ kind: "photo", name, holds, fails: [], checked: [] });
  }
  for (const p of Array.isArray(photos) ? photos : []) {
    const name = String((p && p.route) || "").trim();
    if (!name) continue;
    const holds = [];
    if (p.bought) holds.push("bought");
    if (p.reused) holds.push("reused");
    // …AND THE ROUTE'S OWN WORDS, exactly as a code carries its destination's.
    // A designer's `by` clause for a picture says *"a photograph of the bench
    // on the gallery page"* — it names neither `bought` nor `reused`, which are
    // OUR words for how it got there — so without this the clause could only
    // ever reach the bare-name reading and a real claim about a picture that
    // really landed would never read as configuration that holds. The route is
    // already the item's NAME, so a claim has to have matched it before any of
    // these is looked at: this widens what counts as evidence about THAT
    // picture and never which picture a claim can reach.
    for (const w of name.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 3) holds.push(w);
    out.push({ kind: "photo", name, holds, fails: [], checked: [] });
  }
  return out;
}
