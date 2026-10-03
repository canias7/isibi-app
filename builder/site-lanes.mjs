// THE EDIT PATH. ITS OWN PATH, NOT THE BUILD PATH WITH A FLAG ON IT.
//
// Owner, 2026-08-29: "it should be 2 separated path tho, idk why you are mixing
// the build with the edit path" — and, on what the edit path IS: "is pure
// action, meaning, customer says edit this, and booom you go edit it".
//
// ── WHAT WAS MIXED ───────────────────────────────────────────────────────────
//
// The `look` lane called `designSiteSchema` — the BUILD's function — with
// `SITE_SCHEMA_TOOL`, the BUILD's tool, and `SITE_SCHEMA_SYSTEM`, the BUILD's
// system text. So changing one colour on a live site ran the site DESIGNER: 84.8k
// of instructions for inventing a business from nothing, eleven sentences about
// which access level a table should have, and nineteen properties of which
// eighteen were doors the change had no business opening.
//
// And the wording fought itself, which is the part that cost real money. The
// build's `css` description opens "ONLY WHEN ASKED … OMIT this field entirely
// unless" — correct for a first build, and read by a customer's edit as "do not
// touch the stylesheet". `EDIT_RULE` had to NAME that framing and overrule it in
// prose, because both arrived in the same call. Two paths means the edit path
// never sends the sentence it then has to argue with.
//
// ── WHAT SEPARATE MEANS HERE, EXACTLY ────────────────────────────────────────
//
// This module imports NOTHING from the build tool. Every lane's wording is its
// own and is written for somebody CHANGING a value, never for somebody inventing
// one. The value shapes are not borrowed either — they are not borrowable, which
// is the observation the whole design rests on and is set out below.
//
// ── "ACTS" MEANS TWO DIFFERENT THINGS AND THE NAMES NOW SAY WHICH ────────────
//
// Owner, twice: *"i thought all of them were act?"* — and they were right both
// times. `OWN_LANES` (renamed from `ACTING_LANES`, 2026-08-29) is a group name
// for *the ones this module edits itself*. It is NOT a verdict on whether a lane
// works. **21 of the 22 act**; only `slug` does nothing. The old name implied the
// other eleven sat idle, which cost the same explanation twice.
//
// THE GROUPS SAY *WHERE* THE WORK HAPPENS, NEVER WHETHER IT HAPPENS:
//   own       — this module's own tool, one cheap call
//   dispatch  — a rung that already does this, at that rung's own price
//   verb      — `pages`, where the router answers a verb and that picks the rung
//   escalate  — `kind`, which is a rebuild by definition
//   unbuilt   — `slug`, and it is the only one
//
// ── WHY THE OWN LANES CAN OWN THEIR SHAPES ───────────────────────────────────
//
// The design tool has 24 properties; 22 of them are things a customer could ask
// to change (the web pair decides whether writing a site's COPY needs a search,
// which is a fact about a build). All 22 are ADDRESSABLE here — the router can
// name any of them, and a message about any of them is understood.
//
// The split between own and dispatched is not a matter of taste. `kind`,
// `purpose`, `pages`, `components`, `shape`,
// `images` and `action` are `PLAN_KEYS`: inputs to page GENERATION. Nothing
// downstream of a cheap edit reads them — the container is handed the pages, the
// theme and the stylesheet, and never the plan — so storing a new one changes
// nothing a visitor can see while reporting success, and leaves the stored plan
// disagreeing with the pages it claims to describe. `worker.js` has always
// refused them for exactly that reason (`needsPages`, derived from `PLAN_KEYS`);
// what is new is that they are refused BY NAME, at the door, before a model call
// is bought, instead of after one.
//
// `backend` is the same fact wearing different clothes: it describes a database,
// and the `data` and `rules` rungs are the lanes that read and enforce rows.
// `slug` is a site's ADDRESS — changing it is a move, not an edit.
//
// So: eleven lanes are answered here and the rest are routed to the rung that
// really does the work. Every one of the eleven is a plain string, an enum, a
// short list or one drawn document — simple enough that this module can own its
// own shapes outright. THAT is what makes two separate paths possible rather
// than merely stated: the values the edit path touches are simple enough to
// define twice on purpose, and the ones that are not are the ones it routes.
//
// `behavior` IS THE ONE EXCEPTION and it is deliberate: its item shape is shared
// from `site-plan.mjs`, the one module both paths may read, because the same six
// properties are answered on both sides and two copies would drift in silence.
//
// ── THE ONE THING STILL HELD TOGETHER, AND IT IS A TRIPWIRE, NOT A COUPLING ──
//
// The twenty-two NAMES are asserted against the design tool's own properties, in
// both directions, by `test/edit-lanes.test.mjs`. A field added to the build
// tomorrow with no lane here is a part of a site the customer can never change
// again, and a lane here for a field the build no longer produces is a lane that
// edits nothing. Neither announces itself. Names only — never a description and
// never a shape, because those are precisely what the two paths are separate
// about.

// THE SHAPE ONLY, NEVER THE BUILD'S WORDING. `BEHAVIOR_ITEM` is the six
// properties one entry carries; the build tool and this lane ask for the same
// items and describe the JOB completely differently, which is the whole split.
// It lives in site-plan.mjs because that is the one module both paths may read —
// this one is forbidden to import from worker.js, so the alternative was a
// second copy of the shape, and two copies of one shape drift in silence.
import { PLAN_KEYS, BEHAVIOR_ITEM, MAX_BEHAVIOR } from "./site-plan.mjs";
import { THEME_SHORTLIST } from "./site-theme-registry.mjs";
import { modelsFor } from "./build-models.mjs";
import { echoTokens } from "./input-budget.mjs";
// THE STORAGE CAPS THEMSELVES, so the per-field token ceiling below is derived
// from the refusals rather than written down a second time beside them.
import { MAX_WORDMARK, MAX_FAVICON } from "./site-favicon.mjs";
import { MAX_CSS } from "./site-freecss.mjs";
// THE ROUTER'S DOOR AND ITS OWN WORDS FOR A LAYER. On the router's removal door
// the picker is told which change the router already routed, in the router's
// own sentence for that layer (`pickRequest`). `site-ask.mjs` imports nothing
// but the model table, so this adds no cycle.
import { DOOR_LAYERS, layerLine, wordsIn, normalizePagePath } from "./site-ask.mjs";
// THE QUESTION BACK (2026-10-02): the one field every step's tool carries, and
// its reader — `builder/clarify.mjs`, shared with every other step.
import { QUESTION_FIELD, askOf, withQuestion } from "./clarify.mjs";
// THE QR CODES AS A LIST, read the one way every other reader reads them, so
// the `qr` lane names the codes a site has exactly as the route patches them,
// and a name a model answers is read by the one rule every name is read by.
// Dependency-free, and already in the container image beside worker.js.
import { qrList, qrName } from "./site-qr-list.mjs";

/** A small call: naming which part of a site a sentence is about is routing, not work. */
/**
 * THE PICKED MODEL, NOT A HARDCODED ONE (owner, 2026-08-31).
 *
 * Every small call on this platform was pinned to `claude-haiku-4-5`, so a
 * customer who had picked Grok still had Anthropic in their path — and when
 * Anthropic refused on billing, the whole cheap ladder went down with it while
 * builds carried on fine. Run 93 measured that: a `css` edit answered 503 in
 * 5.3s having spent nothing, and the lane it was testing never ran.
 *
 * DERIVED FROM THE TABLE rather than restated, so it cannot drift from the
 * picker, and it resolves to DEFAULT_PICKER — which is what a caller that
 * forgets to thread the picker gets. That is deliberately the platform default
 * and never Haiku: a forgotten hop should land on the model everything else
 * uses, not quietly back on the provider this change exists to leave.
 */
export const LANE_MODEL = modelsFor().quick;

/**
 * Enough for the names AND each change's own words (2026-09-29). It was 200
 * while the answer was a short list of names; `scopes` copies the customer's
 * words for each change out of the message, plus the list and the pages. The
 * BASE: a request adds room for the words it may copy back (`echoTokens`,
 * 2026-10-03), since a message is now whole up to the size policy
 * (input-budget.mjs) rather than cut at 2,000 characters.
 */
export const LANE_PICK_MAX_TOKENS = 800;

/**
 * Enough for one edited value.
 *
 * The largest thing any acting lane returns is a stylesheet, and `readCss` caps
 * what we will store well below this. Sized for that one and shared, rather than
 * eight numbers that drift.
 */
export const LANE_EDIT_MAX_TOKENS = 16000;

// ── AND A CEILING PER FIELD, DERIVED (task #47, 2026-09-06) ─────────────────
//
// THE ONE NUMBER ABOVE IS SIZED FOR THE STYLESHEET AND EVERY LANE GOT IT. The
// `wordmark` lane draws an SVG, and a drawn answer is a long generation: on
// Grok — the default picker, ~3× slower writing code — it ran the whole
// `QUICK_CALL_MS` ceiling and was cut off, TWICE, on runs 11 and 12, charging
// nothing and changing nothing. That ceiling cannot simply be raised: it is
// 240s against an egress that hangs up an idle connection at ~270s, so the
// wire is the real bound and there is nowhere to go.
//
// So bound the ANSWER instead, which is the wall rather than the rule. A
// wordmark over `MAX_WORDMARK` characters is refused by `cleanWordmark`
// whatever it cost to produce, so allowing 16,000 tokens — roughly 64,000
// characters — buys eight times more generation time than any answer we would
// keep. The ceiling for a field is what that field can STORE.
//
// DERIVED FROM THE STORAGE CAPS, never a second list beside them: `MAX_CSS`,
// `MAX_WORDMARK` and `MAX_FAVICON` are the refusals themselves, so a cap that
// moves moves this with it.
//
// IT CAN ONLY EVER REDUCE. `Math.min` with the shared ceiling means a field
// whose cap is large — the stylesheet — is byte-for-byte what it was, and a
// field with no declared cap gets the shared number as before. So this cannot
// make any lane slower or newly truncate one that works today.
//
// THREE CHARACTERS PER TOKEN, not the usual four: these answers are SVG and
// CSS, which are dense in punctuation and tokenise worse than prose. The
// quarter of slack on top is the tool envelope and the model's own framing.
// Both are deliberately generous — the failure to avoid is truncating a real
// answer, and `runLane` already reports `max_tokens` as its own error.
const CHARS_PER_TOKEN = 3;
const TOKEN_SLACK = 1.25;
/** The floor no field goes under, whatever its cap says. */
export const LANE_MIN_TOKENS = 1000;
/** What each field can be STORED at. A field absent here has no cap of its own. */
export const FIELD_STORE_CAP = { css: MAX_CSS, wordmark: MAX_WORDMARK, favicon: MAX_FAVICON };

// ── THERE IS NO SHADOW MAP ANY MORE, AND THAT IS THE FIX (2026-09-07) ──────
//
// For one morning this file carried `UPLOAD_SHADOWS`, `shadowedBy` and
// `shadowedRefusal`: a wall that refused the `wordmark` and `favicon` lanes for
// nothing whenever the site's header or tab already carried an uploaded
// picture, because the container's baker wrote a designed mark ONLY when the
// owner had uploaded none. Run 41 is why it was written — the lane drew 612
// characters of SVG on fretwork-1, stored it, published a whole build and took
// 2 credits for something no visitor could ever be shown.
//
// THE WALL WAS HONEST AND IT WAS A SYMPTOM. Three fields per mark (an upload, a
// drawing, a floor) with the precedence between them a layer away in the
// container. Owner, the same day: *"instead of it being 3 things or 4 or 5, its
// gotta be one, wordmark, but it can be made in svg"*. So a mark is ONE stored
// field carrying a FORM (`builder/site-mark.mjs`), a lane's answer REPLACES
// whichever form is there, and there is nothing left to shadow.
//
// WHERE THE RULE WENT: "a model must not outrank a person" is `mergeLook`'s
// `asked` flag now. A design step VOLUNTEERS every field, so it leaves an
// uploaded mark alone; a lane runs only for what the customer named, so it
// replaces. `test/site-mark.test.mjs` drives both directions.

/**
 * The arithmetic on its own, so the floor and the clamp can be DRIVEN.
 *
 * Split out because a sweep found the floor inert against today's caps — the
 * smallest is the favicon's, which lands well above it — so nothing could tell
 * a floor that works from a floor that is not there. It is kept rather than
 * deleted: it is the belt for a cap small enough that its own tool envelope
 * would not fit, and now it is a belt something can prove.
 */
export function tokensForChars(chars) {
  if (!Number.isFinite(chars) || chars <= 0) return LANE_EDIT_MAX_TOKENS;
  const need = Math.ceil((chars / CHARS_PER_TOKEN) * TOKEN_SLACK);
  return Math.min(LANE_EDIT_MAX_TOKENS, Math.max(LANE_MIN_TOKENS, need));
}

export function laneMaxTokens(field) {
  const cap = FIELD_STORE_CAP[field];
  if (!Number.isFinite(cap) || cap <= 0) return LANE_EDIT_MAX_TOKENS;
  return tokensForChars(cap);
}

// THE MESSAGE IS NOT CUT HERE (2026-10-03). Every request below carried at
// most 2,000 characters of it, so an instruction written at the end of a longer
// message reached no editor. The route keeps a site's message to the size
// policy (`MAX_INPUT_CHARS`, input-budget.mjs) and refuses one past it, so what
// arrives here is whole and is sent whole.

/**
 * HOW MANY LANES ONE MESSAGE MAY RUN.
 *
 * Owner's call, 2026-08-29, asked which way a two-part message should go: "run
 * both lanes in turn". So two is ordinary, and this is not a gate against it —
 * it is a gate against a model that answers "all of them", which is what a
 * seventeen-name enum invites and which would restore the whole-tool cost the
 * split exists to remove, one call at a time.
 *
 * FOUR, and the arithmetic is here rather than in a description: a cap the model
 * is merely told about is not a cap.
 */
export const MAX_LANES = 4;

/* ------------------------------------------------------------------ the lanes */

/**
 * ── EVERY LANE ACTS. EIGHT OF THEM ACT SOMEWHERE ELSE ───────────────────────
 *
 * Owner, 2026-08-29: *"i need all the 17 lanes acting"*.
 *
 * These nine were REFUSED at the door until then — named, priced at zero, and
 * sent up the ladder with a reason. That was honest about the eight fields this
 * module can edit and wrong about the customer, who asked for a change and got a
 * fall-through. The refusal was also unnecessary: for six of the nine the work
 * already exists and is already CHEAP, on a lane that has been shipping for
 * weeks. Nothing was missing but the wire.
 *
 * SO A LANE NAMES AN EDIT LAYER, AND THAT LAYER RUNS. Not an escalation, not a
 * reason — the customer's message is dispatched to the rung that really does
 * this, at that rung's own price. `pick_lanes` is the front door for all
 * seventeen; where it points is an implementation detail of the door.
 *
 *   images      → `picture`  swap, replace or re-crop a photograph   (~0.3, free to reframe)
 *   action      → `nav`      the menu's items and the primary button          (~0.3)
 *   backend     → `rules`    what the site stores and what it enforces        (~0.3)
 *   shape       → `page`     where the sections sit, via a minimal patch      (~1–3)
 *   components  → `page`     which blocks the page is built from             (~1–3)
 *   purpose     → `page`     what the page leads with                        (~1–3)
 *
 * EVERY TARGET IS A LAYER THAT EXISTS, and `EDIT_LAYERS` in `site-ask.mjs` is
 * the list of those — asserted against it, both directions, by the guard. A
 * lane pointing at a layer nobody dispatches is a request that vanishes.
 *
 * `plan` IS DERIVED FROM `PLAN_KEYS` rather than listed. It read `kind`/`purpose`
 * as two literal names once and five more arrived without it — this repo's "two
 * lists of the same thing" trap, failing in the direction of a lane that
 * silently pretends.
 */
export const LANE_LAYER = {
  plan: "page",
  backend: "rules",
  images: "picture",
  // A SCENE IS PAGE SOURCE. The `<Canvas>` and everything in it is written into
  // the .tsx by the step that writes pages — there is no stored value a recompile
  // could re-read, the way the theme and the stylesheet are re-read. So changing
  // it is a page rewrite, exactly as `shape` and `components` are, and for the
  // same reason: nothing downstream of a cheap edit reads a scene.
  three: "page",
  // A COMPONENT WRITTEN FOR THIS SITE IS SOURCE, exactly as a scene is, so
  // changing one is a page rewrite. Its OWN entry rather than `elsewhere:
  // "plan"` — the module refuses that at load time for anything outside
  // `PLAN_KEYS`, and `tsx` is deliberately outside it: every plan axis is
  // compelled, and this field's whole worth is that the ordinary answer is none.
  tsx: "page",
  action: "nav",
  // ── A RENAME IS ITS OWN RUNG (2026-08-29) ────────────────────────────────
  //
  // NOT AN OWN LANE, and the reason is the invariant the own lanes rest on:
  // every one of them but `css` is a KEY ON THE STORED LOOK, read with
  // `priorLook[field]` and written through `mergeLook`. A site's ADDRESS is
  // none of those things — it is a platform record — so an own lane would have
  // its answer silently dropped at the merge, which is precisely the shape
  // `three` shipped in and the guard above now watches for.
  //
  // It dispatches like `backend` does: the value is not ours, the work is one
  // rung away, and the layer that does it owns the whole operation.
  //
  // KEYED BY THE GROUP NAME, NOT THE FIELD NAME — this map is `elsewhere` → the
  // layer, so `images` maps to `picture` and `plan` maps to `page`. A `slug:`
  // key here would be looked up by nothing and `laneLayer` would answer null,
  // which the load-time check catches as "dispatches nowhere". It did.
  rename: "rename",
};

/**
 * The three that are still their own work, and what each honestly needs.
 *
 * NOT A CATEGORY OF FAILURE — a category of NOT BUILT YET, which is a different
 * sentence and has to read as one. Each is escalated with its own name so the
 * next session knows which is which rather than finding one word for three jobs.
 *
 *   kind   shopfront ⇄ tool. Every planning answer follows from it, so changing
 *          it is a rebuild by definition and there is no cheap version.
 *   pages  adding one is the addon route, removing one is `page` + `remove`,
 *          moving one is `renameRoute`. Three real capabilities behind one
 *          field, and the router has to say WHICH before a lane can pick.
 *   slug   the site's address. A move: republish under a new name, redirect the
 *          old one, and every custom domain has to keep pointing at it.
 */
// EMPTY SINCE 2026-08-29, AND THE EXPORT STAYS. `slug` was the last one, and it
// is built now (owner: "yeah do the alias one"). The name, the group, the
// `laneUnbuilt` reader and the partition slot all remain because the NEXT
// capability somebody defers needs exactly this shape — and because a group
// that is empty is a fact the partition test can assert, where a group that was
// deleted is one nobody can.
export const LANE_UNBUILT = {};

/**
 * ── THE THREE THINGS `pages` MEANS, AND WHY THEY NEED A SECOND WORD ─────────
 *
 * "Which pages the site has" is one field and three capabilities, each already
 * built and each on a different rung: adding one is the ADDON route, taking one
 * away is the `page` rung with `remove`, moving one is the `page` rung with a new
 * address. A lane cannot pick between them from the field name alone, and
 * guessing is the worst option available — `add` guessed as `remove` deletes a
 * page somebody wanted.
 *
 * So the router answers a VERB alongside the lane. It is optional and it is only
 * read for `pages`; a lane with no verbs ignores it entirely, which is the same
 * scoping `remove` and `tab` already have one router up.
 *
 * NO DEFAULT. A `pages` ask with no verb escalates rather than picking one —
 * this is the one place in the edit path where the bias inverts, for the reason
 * `readEdit` already states about deletion: everywhere else a wrong guess costs
 * a change the customer can see and undo, and here it can cost them a page.
 */
export const PAGE_VERBS = ["add", "remove", "move"];

/** Which rung each verb's work really happens on. */
export const PAGE_VERB_LAYER = { add: "addon", remove: "page", move: "page" };

/**
 * ── TAKING SOMETHING OFF IS THE SAME VERB EVERYWHERE ────────────────────────
 *
 * Owner, 2026-09-06: *"delete should be in the edit path , they can delete
 * literally anything"*, and then the scope: *"i mean things in the site , like a
 * component etc etc etc , not database or or whatver , code in the site yes"*.
 *
 * So this is NOT a fourth path beside build / edit / addon. It is a second word
 * on the lane the picker already chose, which is exactly the shape `pages` has
 * carried since it shipped — and the reason is the same one written above it: a
 * lane cannot tell "make the QR code point somewhere else" from "take the QR
 * code off" from the field name alone, and the two are opposite acts.
 *
 * WHY A SUBSET OF THE PICKED LANES RATHER THAN A VERB PER LANE. The picker
 * answers `fields` and then `removes`, a subset of it. That is the wall rather
 * than the rule: the property can hold lane names and nothing else, so there is
 * nowhere to put "and also restyle the header" — the same argument that gives
 * every lane's own tool one property. A name in `removes` that is not in
 * `fields` is not a removal of anything, and a name that is not removable at all
 * is refused BY NAME rather than dropped, because a silent drop is how "delete
 * the bookings table" comes back as "✅ Done" having done nothing.
 *
 * `pages` KEEPS ITS OWN VERB and is deliberately not removable here. It is the
 * one lane with THREE capabilities rather than two, so `pageVerb` has to exist
 * whatever this does, and a lane answerable through both would be two lists of
 * the same thing — the recorded trap. The guard asserts they never overlap.
 *
 * WHAT IS NOT REMOVABLE, AND WHY EACH ONE IS NOT:
 *   `backend` — the owner's line above. Tables, functions, connections and jobs
 *               are not the edit path's to drop, and it is the ONE thing here a
 *               version restore could not undo anyway: the page comes back, the
 *               rows do not.
 *   `lang`    — a site is written in something. Removing the primary language
 *               is not a removal, it is a site with no words.
 *   `slug`    — an address is renamed or FORGOTTEN, and forgetting already has
 *               its own answer on that lane with its own irreversibility.
 *   `kind`    — a rebuild, not a removal.
 *   `purpose`  — not a thing on the page. What the page is organised around is
 *               replaced rather than emptied.
 *
 * `shape` IS removable even though it reads like a sibling of `purpose`, and the
 * reason is worth stating: its own hint already ends "taking one out". Leaving
 * it off would mean "take the testimonials band off" is refused whenever the
 * picker reaches for `shape` instead of `components` — a legitimate removal
 * losing a coin toss between two lanes that dispatch to the SAME rung. Both are
 * removable so the act lands whichever name the picker chooses.
 *
 * EVERYTHING THIS DOES REMOVE IS RECOVERABLE, which is what makes the bias
 * inversion below affordable rather than frightening: since stage 7 every
 * publish is staged whole under its own version and `restoreVersion` brings one
 * back, so a section deleted by mistake is a restore away for as long as the
 * cap keeps it. That is true of every lane on this list and of none of the ones
 * above it — which is most of why the list is drawn where it is.
 */
export const NOT_REMOVABLE = Object.freeze({
  backend: "the site's database — its tables, saved functions, outside connections and scheduled jobs — isn't something I take away from here",
  lang: "the language the site is written in isn't something it can be without — ask me to write it in a different language instead",
  slug: "a web address is changed by renaming the site, or dropped by asking me to forget an old one",
  kind: "what kind of site this is gets changed by rebuilding it, not by taking it off",
  purpose: "what the page is for is changed rather than emptied — tell me what it should do instead",
});

/**
 * What removal MEANS on this lane, in the lane's own words, or `null`.
 *
 * One string, read by the picker's description AND by the lane's own tool, so a
 * lane cannot be removable in the list and silent in the prompt — the wiring
 * trap, which on this module has already cost `three` a whole day.
 */
export function laneRemoval(field) {
  if (typeof field !== "string" || !Object.hasOwn(LANES, field)) return null;
  return LANES[field].remove || null;
}

/** Why this lane refuses to be taken off, or `null` when it does not refuse. */
export function removalRefusal(field) {
  if (typeof field !== "string" || !Object.hasOwn(NOT_REMOVABLE, field)) return null;
  return NOT_REMOVABLE[field];
}

/**
 * ── A RULE PER LANE, AND THE RULE HAS FOUR NAMED PARTS ──────────────────────
 *
 * Owner, 2026-08-29: *"i want a rule per everysingle one of them, just like we
 * did for css"*.
 *
 * The `css` rule was the only complete one and it is the model. Read it apart
 * and it is four statements, of which exactly ONE is genuinely about `css`:
 *
 *   is     what the field is                        descriptive
 *   yours  the whole of it is yours to edit         permission
 *   wide   ── HOW *THIS* FIELD GETS OVER-ANSWERED ── the rule
 *   keep   what "everything else" means here        ceiling
 *
 * `yours` and `keep` restate `EDIT_SYSTEM` in the field's own nouns; `wide` is
 * the part no other lane can borrow, because every field is over-answered in a
 * different way. `css` gets a token where a rule was asked for. `brand` gets a
 * name improved instead of copied. `lang` gets the site TRANSLATED. `langs` gets
 * the list replaced when one was being added. Naming that trap per field is the
 * whole value of a per-lane rule; without it a lane is a description with a
 * ceiling bolted on, which is what six of the eight were.
 *
 * STRUCTURAL, NOT PROSE, and that is the point. Each part is its own key, so a
 * lane added tomorrow WITHOUT a width rule fails at module load rather than
 * shipping as a field with no ceiling — and a guard can assert the rule exists
 * rather than grepping for a sentence. This repo's record is that a rule kept in
 * prose is one the next edit quietly drops.
 *
 * ── PLACEHOLDER WORDING (owner: "i will tell you the prompt later"). Every
 * string below is the edit path's own and is written to be replaced. Replacing
 * one is editing one value here; nothing else in this repo reads them. ──
 *
 * `hint`  — one line, for the router: how a customer's sentence points here.
 * `edit`  — the four parts above. Written for CHANGING, never for inventing.
 * `shape` — this path's own. Not borrowed and not derived; see the header.
 */
const LANES = {
  /* ---- the eleven this module answers itself ---- */
  css: {
    remove: "take the site's own stylesheet off, leaving it looking the way its theme alone makes it look",
    hint: "THE STYLESHEET — any change to how something LOOKS that is not a change of theme: a colour, a size, spacing, corners, a typeface, one control, one section, dark or light. The ordinary answer for a look change.",
    shape: { type: "string" },
    edit: {
      is: "The site's stylesheet, as it should be after their change.",
      yours:
        "THE WHOLE LOOK IS HERE AND ALL OF IT IS YOURS TO EDIT. Any element, any component, any state, any one " +
        "page — whatever they asked to look different, write the rule that does it. You are not limited to what " +
        "the theme offers and nothing on the page is out of reach. READ THEIR WORDING AS A ROLE, NEVER AS A TAG: " +
        "what somebody calls a button is usually not a `<button>` — this kit draws one as an `<a>` — so a rule " +
        "for `button` on such a page is valid CSS that selects nothing at all.",
      wide:
        "EACH EDIT ONLY AS WIDE AS IT WAS ASKED. A change to one control is a rule for that control. A new value " +
        "for a token is not — every component reading that token repaints, so a request about one button becomes " +
        "a different-looking site. Reach for a token only when what they named really is the whole site.",
      keep:
        "EVERYTHING ELSE COMES BACK BYTE FOR BYTE — every rule you were given, in the order you were given it. " +
        "Not a spacing you would have set differently, not a colour you think sits better beside the new one. " +
        "Taste nobody asked for reads as the site changing on its own.",
    },
  },
  theme: {
    remove: "put the site back on the platform's default look, dropping the theme it was given",
    hint: "The site's whole visual world, picked by name — broadsheet, bakery, apothecary, noir. Asking for a DIFFERENT LOOK ENTIRELY is this; asking for one colour or one control to change is `css`.",
    shape: { type: "string", enum: THEME_SHORTLIST },
    edit: {
      is: "The theme the site should wear instead, by name.",
      yours:
        "EVERY THEME ON THE LIST IS AVAILABLE TO YOU and they are genuinely different worlds — pick the one whose " +
        "mood matches what they described, for the trade this site is in. You are not limited to something near " +
        "the one it has.",
      wide:
        "THIS FIELD HAS NO NARROW VERSION, WHICH IS THE WHOLE RULE FOR IT. A theme replaces the palette, the " +
        "typefaces, the corners, the shadows and the spacing on every page at once — there is no way to answer " +
        "it a little. So answer it ONLY when what they asked for really is the whole site feeling different: " +
        "\"make it feel like a newspaper\", \"something warmer\", \"put the whole thing on black\". A request " +
        "about one colour, one control or one section is not this, however strongly you would pick a theme for " +
        "it — answering here would repaint an entire site to change one button.",
      keep:
        "IF THE THEME SHOULD STAY, ANSWER NOTHING. The site keeps the one it has and the stylesheet lane makes " +
        "the change they actually asked for. A near-miss theme is a redesign nobody ordered.",
    },
  },
  brand: {
    remove: "drop the name the site was given, leaving it called after its own web address",
    hint: "The site's NAME — what the business is called, as it appears in the header, the browser tab and a shared link.",
    shape: { type: "string" },
    edit: {
      is: "The name the business should be called instead.",
      yours:
        "ANY NAME THEY GIVE YOU IS THE ANSWER — one word or six, a person's name, an ampersand, an apostrophe, " +
        "a language other than the site's. None of that is a problem and none of it needs your approval.",
      wide:
        "COPY IT, DO NOT CHOOSE IT — this field's whole trap is that it looks like a naming job and is a " +
        "transcription job. Take their name exactly as they wrote it: their capitals, their punctuation, their " +
        "spacing, their spelling. Do not shorten it, expand it, title-case it, drop the \"Ltd\", add \"& Co\", " +
        "or make it sound more like a brand. If they did not say what to call it, answer nothing rather than " +
        "inventing one — this site already has a name and yours would replace it.",
      keep:
        "THE NAME ONLY. The description, the wordmark and the tab icon are their own fields and other lanes own " +
        "them; a new name is not permission to restyle everything that mentions it.",
    },
  },
  description: {
    remove: "take the one-line summary off, so a search result and a shared link show the name alone",
    hint: "The one-line summary under the name in a Google result or a shared-link preview.",
    shape: { type: "string" },
    edit: {
      is: "The site's one-sentence description, as it should read after their change. One sentence, written for a customer rather than a developer: what the business is, who it serves, and where. It is what shows under the name in a search result and beside a shared link.",
      yours:
        "THE WHOLE SENTENCE IS YOURS TO WORD when that is what they asked for — a different emphasis, a different " +
        "audience, a fact that has changed, a tone that fits them better.",
      wide:
        "A NEW FACT IS NOT A NEW SENTENCE, and that is how this field gets over-answered: they tell you they have " +
        "moved to Leeds, and the temptation is to rewrite the line around it. Change the part they named and " +
        "leave the rest of the sentence standing, in its own words. Only rewrite the whole thing when the whole " +
        "thing is what they asked about.",
      keep:
        "EVERY FACT YOU WERE NOT ASKED ABOUT SURVIVES — the trade, the place, who it serves. A description that " +
        "quietly drops one is a search result that stops describing the business.",
    },
  },
  wordmark: {
    remove: "take the drawn logo off the header, leaving the name set in type where it was",
    hint: "The logo in the header — the business name set in type, or a drawn mark.",
    shape: { type: "string" },
    edit: {
      is: "The header logo: answer the single word `text`, or draw one as a complete SVG document with a viewBox — flat shapes and letterforms, no photographs, no gradients, sized to be read at the height of a header.",
      yours:
        "YOU MAY DRAW, AND YOU MAY ALSO STOP DRAWING. `text` means the business name set in the header's own " +
        "type, and it is a FULL ANSWER rather than a shrug — it is right for most small businesses and it is " +
        "exactly what \"just use our name\" means.",
      wide:
        "A CHANGE TO A MARK IS NOT A NEW MARK. If the site already has a drawn wordmark and they asked for one " +
        "thing about it — a colour, thinner strokes, drop the circle — return THAT mark with that one change, " +
        "not a fresh design you like better. Redrawing from scratch is the failure this field invites, because " +
        "a new mark always looks like an answer.",
      keep:
        "A LOGO THEY ATTACHED AS A FILE IS NOT THIS. That is their own artwork, another lane places it, and " +
        "drawing over it replaces the thing they gave you.",
    },
  },
  favicon: {
    remove: "take the drawn tab icon off, putting the default one back",
    hint: "The TAB ICON — the small mark in the browser tab and on a bookmark.",
    shape: { type: "string" },
    edit: {
      is: "The site's tab icon, as one complete SVG document with a viewBox, drawn to fill it. It is the mark in the browser tab, on a bookmark and on a phone's home screen — nothing on the page itself changes.",
      yours:
        "THE WHOLE MARK IS YOURS TO DRAW — any shape, any letterform, any colours from the site's world. It does " +
        "not have to resemble the logo and it does not have to be initials.",
      wide:
        "SIXTEEN PIXELS IS THE RULE THIS FIELD LIVES UNDER. One simple shape or letterform, two or three colours " +
        "at most, heavy strokes, no thin lines, no small text, no fine detail — anything more disappears at the " +
        "size it is actually seen. And if they asked for one thing about the mark they have, change that one " +
        "thing: a colour is a colour, not a redesign.",
      keep:
        "NOTHING ON THE PAGE MOVES. This is the tab, the bookmark and the home screen only — not the header logo, " +
        "which is its own field and its own lane.",
    },
  },
  lang: {
    hint: "The language the site's pages are declared to be written in.",
    shape: { type: "string" },
    edit: {
      is: "The language the site's pages are written in, as a BCP-47 tag — `es`, `fr`, `pt-BR`, `de`.",
      yours:
        "ANY LANGUAGE, and a regional tag when they named a region — `pt-BR` rather than `pt` for Brazil, " +
        "`en-GB` rather than `en` when it matters to them.",
      wide:
        "THIS IS A DECLARATION, NOT A TRANSLATION, and confusing the two is the only way this field goes wrong. " +
        "It tells a browser and a search engine what language the words on the page ALREADY ARE; it does not " +
        "rewrite a single one of them. \"This site is in Spanish, stop telling people it's English\" is this. " +
        "\"Translate the site into Spanish\" is NOT — answering there would leave the site claiming a language " +
        "its own pages are not written in, which is worse than the original mistake.",
      keep:
        "ONE TAG, AND NOTHING ELSE. The other languages the site is offered in are their own field.",
    },
  },
  langs: {
    remove: "stop offering the site in one or more of its extra languages — the ones they name, or every one",
    // TAKEN OFF BY NAME (2026-10-02, the whole-router audit's W2, and the
    // owner's review of batch 1). The lane names the tags to take off and the
    // route checks each against the stored list (`takeOffTargets`); a tag the
    // site is not offered in takes nothing off, however short the list is.
    takeOff: {
      one: "extra language",
      many: "extra languages",
      entries: (v) => (Array.isArray(v) ? v : [])
        .filter((t) => typeof t === "string" && t.trim())
        .map((t) => ({ id: t.trim(), show: t.trim(), say: "`" + t.trim() + "`" })),
      // A TAG IS A TAG WHATEVER ITS CASE (BCP-47 says so); nothing else is
      // forgiven — `es-ES` is not `es`.
      same: (said, id) => said.toLowerCase() === id.toLowerCase(),
      keep: (v, gone) => (Array.isArray(v) ? v : []).filter((t) => !(typeof t === "string" && gone.has(t.trim()))),
    },
    hint: "The other languages the site is also offered in.",
    shape: { type: "array", items: { type: "string" }, maxItems: 12 },
    edit: {
      is: "Every language the site is ALSO offered in, beyond the one its pages are written in, as BCP-47 tags — `[\"es\"]`, `[\"cy\", \"ga\"]`.",
      yours:
        "ADD OR REMOVE AS MANY AS THEY ASKED FOR, in any language. An empty list is a real answer: it says the " +
        "site is offered in one language only.",
      wide:
        "SEND THE WHOLE LIST, NOT THE CHANGE — this field REPLACES what is stored, so a list that names only the " +
        "new language silently deletes the others. Adding Welsh to a site already offered in Spanish is " +
        "`[\"es\", \"cy\"]`, never `[\"cy\"]`. Start from the list you were given, apply their change to it, " +
        "and send back the result.",
      keep:
        "THE LANGUAGE THE PAGES ARE WRITTEN IN IS NOT ON THIS LIST — it is its own field, and repeating it here " +
        "offers the site in its own language twice.",
    },
  },

  // ── WHAT THINGS DO, AND IT ACTS HERE (owner, 2026-08-29: "for edit, try and
  // make it more universal, whatever the user asks, like we been doing it") ──
  //
  // THE `css` CONTRACT, ON BEHAVIOUR INSTEAD OF LOOK. Unlimited in WHAT — there
  // is no list of behaviours to choose from, and a control may do anything a
  // control can do. Strict in HOW MUCH — one control asked about is one control
  // changed. Either half alone misleads, which is why both are stated: freedom
  // with no ceiling buys a page where every button was "improved", and a ceiling
  // with no freedom reads as "do not touch anything".
  //
  // IT ACTS HERE RATHER THAN DISPATCHING TO `page`, and that is the owner's call
  // above. The dispatch would have been defensible — behaviour becomes page
  // source eventually — but it prices a wording change at a page rewrite, and
  // right now there is no source to rewrite: nothing generates from this field.
  // What a customer changes today is the RECORD, which is what this step is for.
  //
  // AND THE HONEST LIMIT, SO NOBODY REDISCOVERS IT AS A BUG: because nothing
  // consumes `behavior` yet, an edit here republishes a page that looks and
  // behaves identically. That is correct while this is a recording step and
  // becomes wrong the day behaviour is generated — on that day this lane needs
  // to reach the `page` rung as well. Named in CLAUDE.md's backlog.
  behavior: {
    remove: "stop a control on the page doing what it does, leaving the control itself where it is",
    // TAKEN OFF BY NUMBER (2026-10-02, W2): `langs`'s rule, for a list of
    // controls. An entry has no name of its own — two can be about one
    // button — so each is shown with its place in the list, and that number is
    // what the lane answers and the route checks.
    takeOff: {
      one: "control",
      many: "controls",
      entries: (v) => (Array.isArray(v) ? v : []).map((b, i) => {
        const what = b && typeof b === "object" ? [b.control, b.on, b.does].filter((x) => typeof x === "string" && x.trim()).join(" — ") : "";
        return { id: String(i + 1), show: what || "(no description)", say: "`" + (i + 1) + "`" + (b && typeof b.control === "string" && b.control.trim() ? " (" + b.control.trim().slice(0, 40) + ")" : "") };
      }),
      same: (said, id) => said === id,
      keep: (v, gone) => (Array.isArray(v) ? v : []).filter((_, i) => !gone.has(String(i + 1))),
    },
    hint: "What something on the page DOES when someone uses it — a button, a link, a form, a tab, a filter, a menu, a carousel. What it opens, what it changes, what you see happen. This is the lane for any 'when someone presses / clicks / submits X, then Y' — even about the header button or the menu; their WORDS, LINKS and items are `action`.",
    shape: { type: "array", items: BEHAVIOR_ITEM },
    edit: {
      is: "Everything on this page that DOES something, as it should be after their change.",
      yours:
        "ANY BEHAVIOUR AT ALL, AND ALL OF IT IS YOURS TO EDIT. There is no list of behaviours to pick from — " +
        "whatever they asked a control to do, write it: opening, closing, filtering, sorting, switching, " +
        "stepping, submitting, copying, playing, revealing, or something no other site does. Any element on " +
        "the page, any trigger, any result. Say for each one whether the component already does it or whether " +
        "it needs behaviour written.",
      wide:
        "ONE CONTROL ASKED ABOUT IS ONE CONTROL CHANGED. A request about the filter chips is an answer about " +
        "the filter chips, not a page where every button now does something richer. Do not improve a control " +
        "that already works, and do not answer for an element the page has not got: the entries you were " +
        "given ARE the page.",
      keep:
        "EVERY OTHER ENTRY COMES BACK EXACTLY AS IT WAS GIVEN, in the order it was given. Not a trigger you " +
        "would have worded differently, not a result you think reads better. A control that changes on its " +
        `own is the site breaking, to the person using it. At most ${MAX_BEHAVIOR} entries in all.`,
    },
  },

  // ── THE ANIMATED MARK LANE IS GONE WITH ITS FIELD (2026-08-31) ─────────
  //
  // It acted here, beside `favicon` and `wordmark`, and it went when the owner
  // retired the `gif` design step — see the note where that field used to sit
  // in worker.js for why. THE LANE HAD TO GO WITH IT, and that is a rule rather
  // than tidiness: `test/edit-lanes.test.mjs` asserts the two name sets in BOTH
  // directions, because a lane for a field the build no longer produces is a
  // lane that bills and edits nothing.
  //
  // `gif` STAYS ON `EDIT_FIELDS` regardless, and that is not an inconsistency —
  // `seeds` and `family` are there on the same footing. `mergeLook` rebuilds its
  // answer from that array alone, so the name has to stay or `washhouse-1` and
  // `washhouse-3` lose the marks they are serving today on their next unrelated
  // edit. What those two sites cannot do any more is CHANGE the mark; what they
  // keep is the mark.

  // ── THE QR CODE ────────────────────────────────────────────────────────
  //
  // ACTS HERE, and the shape is why: what is stored is a DESTINATION and a
  // CAPTION, not a picture. The code itself is generated from those at build
  // time, so changing where it points is changing two short strings — which is
  // the cheapest kind of edit there is, and would be absurd as a page rewrite.
  //
  // A SITE CARRIES SEVERAL (owner, 2026-09-03: "it should carry more"), so the
  // stored value is a LIST of named codes and this lane answers a PATCH to one
  // of them: which code, and what changes about it. Never the list — a model
  // handing back a whole list is a model that can drop an entry, and a dropped
  // code is a printed card that stops working. `patchQr` folds the patch over
  // the stored list where the lane's answer is read.
  qr: {
    remove: "take QR codes off the site — the ones they name: one, several or every one",
    // TAKEN OFF BY NAME (2026-10-02, W2, and the owner's review of batch 1:
    // "support explicitly selected QR removals, including several or all
    // codes"). A removal is not a patch: the lane names every code that goes
    // (`takeOff`), the route checks each name against the stored list, takes
    // exactly those off and their figures off the pages — and a name the site
    // does not have takes nothing off, even on a site with one code.
    takeOff: {
      one: "QR code",
      many: "QR codes",
      entries: (v) => qrList(v).map((c) => ({ id: c.name, show: "“" + c.label + "”, scanning it opens " + c.points, say: "`" + c.name + "`" })),
      // A NAME IS READ BY THE ONE RULE EVERY CODE NAME IS READ BY (`qrName`),
      // never matched loosely.
      same: (said, id) => qrName(said) === id,
      keep: (v, gone) => qrList(v).filter((c) => !gone.has(c.name)),
    },
    hint: "A QR CODE the site has — where scanning it takes you, or what the words beside it say. Which one, when the site has several.",
    shape: {
      type: "object",
      properties: {
        name: { type: "string", description: "WHICH code, by the name it has in the list you were shown. A site with one code needs no name." },
        points: { type: "string", description: "What scanning it does — a full URL, or `tel:`, `mailto:`, `WIFI:`, or plain text. Only when that is what they asked to change." },
        label: { type: "string", description: "The few words printed beside it. Only when that is what they asked to change." },
      },
      required: [],
    },
    edit: {
      is: "ONE of the site's QR codes — which one, and where it points or what it is called, as they should be " +
        "after the change. The site's codes are in front of you as a list; answer the one they mean.",
      yours:
        "BOTH HALVES OF THAT ONE CODE ARE YOURS TO CHANGE. Point it somewhere else, reword the caption, or both — " +
        "whatever they asked for. The code itself is drawn for you from these values; you never draw one.",
      wide:
        "NEVER INVENT A DESTINATION. This is the one field where a plausible guess is worse than a refusal: " +
        "a QR is the one thing on a page a visitor cannot read before acting on it, so a made-up URL is a " +
        "customer sending people somewhere that does not exist. If they asked to reword the caption, answer " +
        "`label` and leave `points` out.",
      keep:
        "THE HALF THEY DID NOT MENTION IS LEFT OUT, and every other code on the site stays exactly as it is — " +
        "you answer one code, never the list. A reworded caption must not quietly re-point the code, and a " +
        "re-pointed code must not quietly reword the caption.",
    },
  },

  /* ---- the six that act on another layer ---- */
  purpose: { hint: "What the page is organised around — what it leads with and what everything else supports.", elsewhere: "plan" },
  components: {
    hint: "Which building blocks the page is made of — the manifest it is written from.",
    elsewhere: "plan",
    remove: "take one of the page's sections off it — the band and everything in it, with the rest of the page left as it is",
  },
  shape: {
    hint: "Where the sections go on the page and in what order — moving a band up or down, taking one out.",
    elsewhere: "plan",
    remove: "take one of the page's bands off it, closing the gap where it was",
  },
  images: {
    hint: "A PHOTOGRAPH on the site: swapping one for another, adding one, taking one off, or changing which part of it you see.",
    elsewhere: "images",
    remove: "take a photograph off the page — the slot that held it goes with it, rather than being left empty",
  },
  // THE WORDS ON THE BUTTON AND ITS TARGET — AND THE MENU'S ITEMS. The lane
  // sweep (2026-09-01) sent "when someone presses the button, open the phone
  // dialler" here — the picker read "open the dialler" as where the button
  // points — and the nav rung, which changes a label and an href, answered
  // no-menu. What a control DOES when used is `behavior`; this lane is labels
  // and destinations as links.
  //
  // ⚠ THE MENU'S ITEMS ARE THIS LANE'S TOO (2026-09-29). Its rung is the menu
  // editor, which writes the menu on every page as well as the button, and no
  // other lane can reach that rung — the removal door needs exactly one
  // (`doorLane`), and every lane is a field of the design tool. It said "only
  // that button", so on the look door a menu change beside other work had
  // nowhere to go: run 47's real picker read "Take Gallery out of the menu." as
  // `behavior`, whose look step answered nothing. Scoped, the menu editor is
  // handed only the menu's words (`ask`), never the rest of the message.
  action: {
    hint: "The site's MENU and its header button, the same on every page: which pages the menu lists, in what order, under what names — adding, taking out or reordering an item — and the button's words and the page, number or address it links to. What any control DOES when used is `behavior`.",
    elsewhere: "action",
    remove: "take an item out of the menu (its page stays on the site), or the header's button off altogether",
  },
  backend: { hint: "What the site STORES — its tables, the rows in them, who may read or add one, and what it refuses.", elsewhere: "backend" },

  three: {
    remove: "take the 3D scene off the page altogether",
    hint: "The 3D or WebGL element on the page — what the scene shows, how it moves, whether there is one at all.",
    elsewhere: "three",
  },

  // A COMPONENT WRITTEN FOR THIS SITE, so changing it is changing CODE — the
  // `page` rung, exactly as `components` and `shape` are, and for the same
  // reason: what a customer wants changed is the thing on the page, and the
  // thing on the page is source. There is no stored value a recompile could
  // re-read into a different component.
  //
  // THE DECLARATION IS STILL STORED (`EDIT_FIELDS`), which is not a
  // contradiction: the rung that acts is `page`, and what the stored list buys
  // is that a revise about a phone number cannot make the site forget it had a
  // hand-written seat map.
  tsx: {
    remove: "take one of the site's own built parts off the page, and its file with it",
    hint: "A part of the page that was BUILT for this site rather than picked from the kit — changing what it does, what it shows, or taking it out.",
    elsewhere: "tsx",
  },

  /* ---- the three whose work is not a stored value ---- */
  kind: { hint: "Whether this is a shopfront that persuades a visitor, or a tool the business works in — changing it makes a different site.", escalate: "build" },
  pages: { hint: "Which pages the site HAS — adding one, taking one away, or moving one to a new address. Not what is ON a page.", verbs: true },
  slug: {
    hint: "THE SITE'S WEB ADDRESS — the word in <name>.gofarther.app. Renaming the site, giving it a different address, or FORGETTING an old address after a rename so it stops working.",
    elsewhere: "rename",
  },
};

/** Every lane, in one order, and it is the order they RUN in — see `readLanes`. */
export const LANE_FIELDS = Object.keys(LANES);

/** The eight this module edits itself. Derived, so a lane cannot be acting-but-unreachable. */
export const OWN_LANES = LANE_FIELDS.filter(
  (f) => !LANES[f].elsewhere && !LANES[f].unbuilt && !LANES[f].verbs && !LANES[f].escalate);

/**
 * The lanes whose rung depends on a VERB the router also answers.
 *
 * Its own group rather than a flag on a dispatched one, because "which rung"
 * genuinely is not knowable from the field: `pages` add is the addon route,
 * remove and move are the `page` rung. A `LANE_LAYER` entry would have to name
 * one of them and be wrong for the other two.
 */
export const VERB_LANES = LANE_FIELDS.filter((f) => LANES[f].verbs);

/**
 * The lanes a message may ask to take OFF the site.
 *
 * DERIVED FROM THE LANE'S OWN `remove` RULE, never listed beside it, so a lane
 * that gains the rule gains the capability and a lane that loses it loses both —
 * the same reason `OWN_LANES` three lines up is a filter and not a list.
 *
 * It sits HERE, below the table, and not beside `NOT_REMOVABLE` where it reads
 * more naturally, because up there `LANES` has not been evaluated yet: a `const`
 * that reads a later `const` throws at module load and no text guard sees it.
 * That is this repository's own recorded trap, met while writing this line.
 */
export const REMOVABLE_LANES = LANE_FIELDS.filter((f) => !!LANES[f].remove);

/**
 * A REMOVAL FROM A LIST: THE MODEL NAMES WHAT GOES, CODE CHECKS EACH NAME
 * (2026-10-02, the whole-router audit's W2; reworked after the owner's review
 * of batch 1).
 *
 * A removal used to make no lane call — the field was emptied by name
 * (`mergeLook`'s `clear`) — which is right for a value that is one thing (a
 * stylesheet, a summary, a mark) and wrong for a list: "stop offering Spanish"
 * took French too. Batch 1 asked the lane only when the list held more than
 * one entry, and the owner's review found what that left: *"list length does
 * not establish which item the customer meant, so a request for an absent
 * language or code must preserve the existing item"*, and a single-name patch
 * could not take off several codes or every one. *"Let the model identify the
 * targets and have code validate them."*
 *
 * So a lane that keeps a list carries `takeOff`, and every removal on it is
 * one small call: the model is shown each entry with the name it goes by and
 * answers the names of the entries the customer asked to take off — one,
 * several or every one, or none when what they named is not there. The route
 * then checks each name against the stored list (`takeOffTargets`): a name on
 * the list comes off, a name not on it takes nothing off and is said, and
 * every entry not named stays exactly as it is. Nothing here reads the
 * customer's words: the model reads them, and code compares two lists.
 */
export function takeOffLane(field) {
  return typeof field === "string" && Object.hasOwn(LANES, field) && !!LANES[field].takeOff;
}

const TAKE_OFF_SYSTEM =
  "You are taking things off a website that already exists, for the person who owns it.\n\n" +
  "One list from their site is in front of you, each entry with the name it goes by, and one message says what " +
  "they want taken off it. Answer with the names of the entries they asked to take off, each copied exactly as it " +
  "is written in the list. There is nothing else to answer with and nothing else to decide.\n\n" +
  "NAME ONLY WHAT THEY ASKED TO TAKE OFF. An entry they did not mention stays, so it is not named. When they asked " +
  "for several, name each one; when they asked for every one to go, name every entry.\n\n" +
  "WHAT IS NOT IN THE LIST IS NOT ON THE SITE. Never answer with the nearest entry in place of something they " +
  "named that is not in the list: answer that one as they wrote it, so they can be told it is not there, and the " +
  "site keeps everything it has. If they named nothing that could be taken off, answer an empty list.";

/**
 * The removal tool for one list lane: the names of the entries that go — or,
 * when what they named could be more than one entry and nothing settles which,
 * the one question that settles it (2026-10-02, `QUESTION_FIELD`: the owner's
 * review found this call could not ask, so it could only guess or refuse).
 */
export function takeOffTool(field) {
  if (!takeOffLane(field)) throw new Error("takeOffTool: no list lane for: " + field);
  const t = LANES[field].takeOff;
  return withQuestion({
    name: "take_off",
    description: "Name the " + t.many + " they asked to take off this site.",
    input_schema: {
      type: "object",
      properties: {
        targets: {
          type: "array",
          items: { type: "string" },
          description: "Each " + t.one + " they asked to take off, by the name it has in the list you were shown, " +
            "copied exactly — every one of them when they asked for all to go. Empty when nothing they named is in " +
            "the list, and empty when you ask them instead.",
        },
      },
      required: ["targets"],
    },
  });
}

/** The removal request: the list as it stands, each entry by its name, and their words. */
export function takeOffRequest({ field, message, value, model }) {
  const tool = takeOffTool(field);
  const t = LANES[field].takeOff;
  const list = t.entries(value);
  return {
    model,
    max_tokens: 400,
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: tool.name },
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: TAKE_OFF_SYSTEM }],
    messages: [{ role: "user", content:
      "The " + t.many + " on their site (`" + field + "`), each by the name to answer with:\n" +
      (list.length ? list.map((e) => "- " + e.id + (e.show && e.show !== e.id ? " — " + e.show : "")).join("\n") : "(none)") +
      "\n\nWhat they asked for:\n" + String(message || "") },
    ],
  };
}

/**
 * The names the removal named, or `ok: false` when there is no list to read.
 * A name that is not a string is not a name — dropped, never coerced
 * (`String(["es"])` is `"es"`).
 */
export function readTakeOff(reply) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use" && b.name === "take_off");
  const raw = use && use.input && typeof use.input === "object" ? use.input.targets : undefined;
  if (!Array.isArray(raw)) return { ok: false, targets: [] };
  return { ok: true, targets: raw.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim().slice(0, 80)) };
}

/**
 * CODE CHECKS WHAT THE MODEL NAMED. Each name is compared with the stored
 * entries by the lane's own rule (`same`); a name on the list comes off, a name
 * not on it is `unknown`, and the value that stays (`kept`) is the stored one
 * without exactly the matched entries. `all` when every entry the list held was
 * named — the field is then emptied, which the merge does by name.
 */
export function takeOffTargets(field, value, targets) {
  if (!takeOffLane(field)) throw new Error("takeOffTargets: no list lane for: " + field);
  const t = LANES[field].takeOff;
  const list = t.entries(value);
  const gone = new Set();
  const unknown = [];
  for (const said of Array.isArray(targets) ? targets : []) {
    if (typeof said !== "string" || !said.trim()) continue;
    const hit = list.find((e) => t.same(said.trim(), e.id));
    if (hit) gone.add(hit.id);
    else if (!unknown.includes(said.trim())) unknown.push(said.trim());
  }
  return {
    matched: [...new Set(list.filter((e) => gone.has(e.id)).map((e) => e.id))],
    unknown,
    kept: t.keep(value, gone),
    // EVERY ENTRY, not as many names as entries: a list that repeats a tag
    // (`["fr", "fr"]`) is all gone when that one tag is named.
    all: list.length > 0 && list.every((e) => gone.has(e.id)),
  };
}

/**
 * One removal: one call, `send` injected. A list with nothing on it asks no
 * one — nothing can be taken off it — and answers as a removal that named
 * nothing. A call that fails or is cut off is `failed`; an answer with no list
 * of names is `ok: false`.
 */
export async function runTakeOff(deps, { field, message, value, model }) {
  if (!takeOffLane(field)) throw new Error("runTakeOff: no list lane for: " + field);
  if (!LANES[field].takeOff.entries(value).length) {
    return { field, ok: true, failed: false, usage: null, targets: [], ...takeOffTargets(field, value, []) };
  }
  let reply;
  try {
    reply = await deps.send(takeOffRequest({ field, message, value, model }));
  } catch (e) {
    return { field, ok: false, failed: true, error: e, usage: null, targets: [] };
  }
  const usage = laneUsage(reply, model);
  if (reply && reply.stop_reason === "max_tokens") {
    const e = new Error("take-off truncated at max_tokens");
    e.truncated = true;
    return { field, ok: false, failed: true, error: e, usage, targets: [] };
  }
  // A QUESTION BACK (2026-10-02): asked instead of naming, so nothing is named.
  const ask = askOf(reply);
  if (ask) return { field, ok: false, failed: false, usage, targets: [], ask };
  const read = readTakeOff(reply);
  if (!read.ok) return { field, ok: false, failed: false, usage, targets: [] };
  return { field, ok: true, failed: false, usage, targets: read.targets, ...takeOffTargets(field, value, read.targets) };
}

/**
 * What the customer is told when a removal took nothing off: what they named
 * that is not there, and what is.
 *
 * ONLY WHAT THIS STEP FOUND. The reply carries `unchanged: true` and the
 * browser adds "Nothing on your site changed" with what the edit and the
 * routing call cost (`wholeRequestNote`, 2026-09-23) — a sentence here saying
 * so as well printed it twice.
 */
export function takeOffRefusal(field, run, value) {
  if (!takeOffLane(field)) return "I couldn't take that off.";
  const t = LANES[field].takeOff;
  const have = t.entries(value).map((e) => e.say);
  if (!have.length) return "This site has no " + t.many + " to take off.";
  const has = have.length === 1 ? "its only " + t.one + " is " + have[0] : "its " + t.many + " are " + have.join(", ");
  const named = run && Array.isArray(run.unknown) ? run.unknown.slice(0, 3).map((n) => "`" + String(n).slice(0, 40) + "`") : [];
  // THREE DIFFERENT FACTS, three sentences: what they named is not on the
  // site; they named nothing the site has; or the answer could not be read —
  // only the last is ours not to know.
  if (run && run.ok && named.length) return "This site has no " + t.one + " " + named.join(" or ") + " — " + has + ".";
  if (run && run.ok) return "Nothing you asked to take off is on this site — " + has + ".";
  return "I couldn't tell which " + t.one + " to take off — " + has + ". Say which one.";
}

/** Said beside a removal that took something off: the names it named that were not there. */
export function takeOffNote(field, unknown) {
  if (!takeOffLane(field) || !Array.isArray(unknown) || !unknown.length) return "";
  const t = LANES[field].takeOff;
  const named = unknown.slice(0, 3).map((n) => "`" + String(n).slice(0, 40) + "`");
  return "There was no " + t.one + " " + named.join(" or ") + " to take off, so that part changed nothing.";
}

/**
 * The lanes whose work is real, exists, and lives ABOVE this route.
 *
 * A THIRD ANSWER, and it had to be: `kind` is a rebuild — shopfront and tool are
 * different sites and every planning answer follows from the choice — so there
 * is no cheap version, and calling it "not built" was wrong twice over. The
 * capability exists; it is simply not one an EDIT can run, because this route
 * publishes an existing site rather than making a new one.
 *
 * `build` IS NOT AN EDIT LAYER, which is exactly why this is not a dispatch. The
 * guard that every dispatch target appears in `EDIT_LAYERS` is what caught the
 * first attempt to put it there — a lane pointing at a rung no dispatch matches
 * is a request that vanishes.
 */
export const ESCALATE_LANES = LANE_FIELDS.filter((f) => LANES[f].escalate);

/** The rung above that does this lane's work, or `null` when this route can. */
export function laneEscalate(field) {
  if (typeof field !== "string" || !Object.hasOwn(LANES, field)) return null;
  return LANES[field].escalate || null;
}

/** The six that act on another edit layer. */
export const DISPATCHED_LANES = LANE_FIELDS.filter((f) => LANES[f].elsewhere);

/** The three not built yet — named, so three jobs never share one word. */
export const UNBUILT_LANES = LANE_FIELDS.filter((f) => LANES[f].unbuilt);

/**
 * The edit layer this lane's work really happens on, or `null` when this module
 * does the work itself.
 *
 * `Object.hasOwn`, never truthiness: `LANES["constructor"]` is a function and
 * would sail through a `!LANES[f]` check. Shipped once already in the Stripe
 * plan lookup and nearly again three times since.
 */
export function laneLayer(field) {
  if (typeof field !== "string" || !Object.hasOwn(LANES, field)) return null;
  const key = LANES[field].elsewhere;
  return key ? LANE_LAYER[key] || null : null;
}

/** Why a lane cannot run yet, by its own name — or `null` when it can. */
export function laneUnbuilt(field) {
  if (typeof field !== "string" || !Object.hasOwn(LANES, field)) return null;
  return LANES[field].unbuilt ? LANE_UNBUILT[field] || "unbuilt" : null;
}

/** Whether this lane's rung is decided by a verb rather than by its name. */
export function laneVerbs(field) {
  if (typeof field !== "string" || !Object.hasOwn(LANES, field)) return null;
  return LANES[field].verbs ? PAGE_VERBS : null;
}

/** The rung a verb's work happens on, or `null` for a verb nobody offered. */
export function verbLayer(verb) {
  if (typeof verb !== "string" || !Object.hasOwn(PAGE_VERB_LAYER, verb)) return null;
  return PAGE_VERB_LAYER[verb];
}

/**
 * ONE PAGE OPERATION WHERE TWO PAGE STEPS SIT SIDE BY SIDE (2026-09-23).
 *
 * `purpose`, `components`, `shape`, `three` and `tsx` all dispatch to the page
 * rung, and the look door pushed one step per lane — so a message picking
 * `components` and `shape` ran the page rung TWICE, on the same page, with the
 * same sentence, the second run shown the first one's output and asked for the
 * same change again. REPRODUCED through the route with supplied answers:
 * *"swap the opening hours and the market times"* was swapped by the first run
 * and swapped BACK by the second, the one publication carried the original
 * page, both runs were billed (3 + 2), and the screen said "✅ Updated the
 * look." The page rung reads the customer's sentence and never the lane names
 * (`runLayer` hands it `fields` and the page branch reads none of them), so two
 * such steps are one operation run twice, not two operations.
 *
 * WHAT MERGES: consecutive steps on the page rung, aimed at the SAME page, each
 * carrying no ask of its own, every field a lane that dispatches to the page
 * rung by its own name. The merged step carries every field, in order, so the
 * reply's `lanes` names each one exactly as before.
 *
 * WHAT NEVER MERGES, each because it is a different operation rather than the
 * same one twice:
 *   - a step with its OWN ask — the QR placement's fixed text is not the
 *     customer's sentence, and folding it in would put two asks on one call;
 *   - a `pages` verb step — a removal or a move is a different branch of the
 *     rung, and `laneLayer("pages")` is null because the verb decides the rung;
 *   - a step aimed at a DIFFERENT page;
 *   - two page steps with ANOTHER rung between them. Joining those would move a
 *     page change across that rung, and the order is load-bearing: the picture
 *     rung's work reaches a later page step through `eSrc`, which is what the
 *     photograph protection reads. They stay two steps, and that is said —
 *     and the later one runs only where the earlier one did not succeed
 *     (`pageStepDone`, below).
 *
 * ORDER-PRESERVING BY CONSTRUCTION: no step moves, neighbours are joined. A
 * list with nothing to join comes back with the same steps in the same order.
 */
export function mergePageSteps(steps) {
  const out = [];
  for (const s of Array.isArray(steps) ? steps : []) {
    const prev = out[out.length - 1];
    // SAME PAGE, SIDE BY SIDE: ONE PAGE OPERATION. Two changes the picker
    // scoped to one page are made by one writer handed both sets of words
    // (`joinAsks`), never by two writers each shown the other's half-finished
    // page. A scoped step and an unscoped one are NOT joined (2026-09-29):
    // joining them hands the scoped change the whole message, the widening a
    // scope exists to prevent. A scoped answer never makes an unscoped step,
    // so the two cannot meet in one message; this is the wall, not the rule.
    if (sentencePageStep(prev) && sentencePageStep(s) && prev.page === s.page && !!prev.ask === !!s.ask) {
      const merged = { ...prev, fields: [...prev.fields, ...s.fields.filter((f) => !prev.fields.includes(f))] };
      if (prev.ask) merged.ask = joinAsks(prev.ask, s.ask);
      // AND THE SAME WORDS AS A LIST (2026-10-02, the review of batch 2): the
      // route takes a part put off out of each by position before the step
      // runs, so a joined step carries both lists, each once, in order.
      if (Array.isArray(prev.words) || Array.isArray(s.words)) {
        const a = Array.isArray(prev.words) ? prev.words : [];
        merged.words = [...a, ...(Array.isArray(s.words) ? s.words : []).filter((w) => !a.includes(w))];
      }
      // AND THE ANSWERS EACH WAS SHOWN (`told`, 2026-10-02): the joined writer
      // makes both changes, so it is shown what either needed — and every
      // answer when either was to be shown every one.
      if (Object.hasOwn(prev, "told") || Object.hasOwn(s, "told")) {
        merged.told = Array.isArray(prev.told) && Array.isArray(s.told)
          ? [...new Set([...prev.told, ...s.told])].sort((x, y) => x - y)
          : null;
      }
      out[out.length - 1] = merged;
    } else {
      out.push(s);
    }
  }
  return out;
}

/** THE WORDS OF TWO SCOPED OPERATIONS JOINED ON ONE PAGE: both, once each. */
function joinAsks(a, b) {
  return a === b ? a : a + "\n" + b;
}

/**
 * A STEP THAT RUNS THE PAGE RUNG ON THE CUSTOMER'S OWN SENTENCE — the one kind
 * of step two lanes can share as a single operation. The page rung, a page to
 * aim at, no ask of its own, and every field a lane that dispatches to the
 * page rung by its own name. ONE definition, asked through `samePageOperation`
 * by every reader of it, so "the same operation" cannot mean two things. A
 * WITHHELD step (2026-09-29) runs nothing, so it is never one: nothing joins
 * it, and no success elsewhere retires its sentence.
 */
function sentencePageStep(s) {
  return !!s && s.layer === "page" && typeof s.page === "string" && !s.instruction && !s.withheld
    && Array.isArray(s.fields) && s.fields.length > 0 && s.fields.every((f) => laneLayer(f) === "page");
}

/**
 * TWO STEPS THAT ARE ONE PAGE OPERATION: both run the page rung on the
 * customer's words, on the same page, with the SAME words (2026-09-29). What
 * skipping a repeat and retiring a refused attempt a later one completed both
 * ask, so they cannot disagree. Two page steps with different words of their
 * own are two operations — the picker scoped them apart — so a success of one
 * never absorbs the other. Steps with no words of their own compare equal, as
 * they always did: both run on the whole message.
 */
export function samePageOperation(a, b) {
  return sentencePageStep(a) && sentencePageStep(b) && a.page === b.page && (a.ask || "") === (b.ask || "");
}

/**
 * WHICH EARLIER STEP ALREADY DID THIS ONE'S WORK — its index in `done`, or -1.
 *
 * `mergePageSteps` joins page steps that sit side by side. Two that another
 * rung separates stay two steps, because that order is load-bearing — but they
 * are still ONE operation: the page rung reads the customer's sentence and
 * none of the lane names. REPRODUCED through the route with supplied answers
 * (2026-09-23): `components` + `images` + `tsx` ran the page writer twice, the
 * second run applied the whole request again to what the first had published
 * and swapped *"the opening hours and the market times"* straight back, both
 * runs were billed (3 + 2), and the screen said "✅ Updated the look." — with
 * the picture step failing and with it succeeding alike.
 *
 * SO A LATER STEP RUNS ONLY WHERE THE EARLIER ONE DID NOT SUCCEED. That is the
 * dependency the order exists for: a page step withheld for a photograph the
 * picture rung then takes off is answered by the later step, on the state the
 * picture rung left. After a success there is nothing left for it to do — the
 * request is already applied, and applying it again is what undid it.
 *
 * ONLY A RECORDED SUCCESS ABSORBS A LATER STEP (`failed === false`). An entry
 * that cannot say lets the later step run, which is the behaviour before this
 * existed — cannot-tell degrades to the old path, never to dropped work.
 *
 * AND THE MIRROR, asked by the same loop: when that later step DOES succeed,
 * the earlier attempt's refusal is superseded — the operation happened, so a
 * sentence saying *"I didn't make it"* would be false on the screen beside it.
 *
 * `done` is the step loop's own record: `{ step, failed }` for each step run.
 */
export function pageStepDone(step, done) {
  return (Array.isArray(done) ? done : []).findIndex((d) => !!d && d.failed === false
    && samePageOperation(d.step, step));
}

/**
 * THE PLAN LANES ARE `PLAN_KEYS`, ASSERTED HERE RATHER THAN HOPED FOR.
 *
 * Both directions, at module load, because the failure is silent in both: a plan
 * axis that neither dispatches nor declares itself unbuilt becomes a lane that
 * stores a value nothing reads and reports success, and a plan mapping on a
 * field that stopped being a plan axis is work sent somewhere for a reason that
 * expired. This repo's record is that a rule true because of a layer below it
 * expires when that layer moves and nothing announces it — so this announces it,
 * loudly, at the earliest moment.
 *
 * A PLAN AXIS MAY BE EITHER, and that is the change of 2026-08-29: `shape`,
 * `components` and `purpose` dispatch to the page rung; `images` and `action`
 * have cheaper rungs of their own; `kind` and `pages` are named unbuilt. What
 * must never happen is a plan axis quietly ACTING here, because nothing
 * downstream of this module reads a plan.
 */
for (const k of PLAN_KEYS) {
  if (OWN_LANES.includes(k)) throw new Error("site-lanes: `" + k + "` is a plan axis and must not be edited here — nothing reads a stored plan");
  if (!Object.hasOwn(LANES, k)) throw new Error("site-lanes: `" + k + "` is a plan axis with no lane at all");
}
for (const k of LANE_FIELDS) {
  if (LANES[k].elsewhere === "plan" && !PLAN_KEYS.includes(k)) {
    throw new Error("site-lanes: `" + k + "` is sent to the page rung but is not a plan axis");
  }
  if (LANES[k].elsewhere && !laneLayer(k)) throw new Error("site-lanes: `" + k + "` dispatches nowhere");
  if (LANES[k].unbuilt && !laneUnbuilt(k)) throw new Error("site-lanes: `" + k + "` is unbuilt with no reason of its own");
}

/* --------------------------------------------------------------- the router */

/**
 * The router's tool: a list of names, and nothing else.
 *
 * BUILT FROM THE CALLER'S LIST IN ONE LOOP, so the enum and the described names
 * cannot disagree. A field with no lane throws HERE, where the name is still in
 * hand — offering a model an enum value with nothing beside it is a lane that is
 * reachable and unexplained, which is worse than one that does not exist.
 */
export function pickTool(fields = LANE_FIELDS, { routed = false } = {}) {
  const list = (Array.isArray(fields) ? fields : []).filter((f) => typeof f === "string" && f);
  if (!list.length) throw new Error("pickTool: no fields");
  const lines = list.map((f) => {
    if (!Object.hasOwn(LANES, f)) throw new Error("pickTool: no lane for design field: " + f);
    return "\"" + f + "\" — " + LANES[f].hint;
  });
  // ON THE ROUTER'S REMOVAL DOOR THE QUESTION IS DIFFERENT, and so is the tool
  // (`doorPickTool`, below). Only a literal `true` asks for it.
  if (routed === true) return doorPickTool(list, lines);
  return {
    name: "pick_lanes",
    description: "Name which parts of the site this message is asking to change.",
    input_schema: {
      type: "object",
      properties: {
        // NO `minItems` AND NO "CLOSEST ONE" (2026-10-02, the owner's review:
        // *"Reconcile contradictory prompts"*). A picker that could not tell
        // was told to guess, beside a question field that says to ask and leave
        // the rest empty — and the schema obliged a part. Empty now only beside
        // a question; an empty answer with none is refused at no cost, as
        // before (`picker/no-lane`).
        fields: {
          type: "array",
          maxItems: MAX_LANES,
          items: { type: "string", enum: list },
          description:
            "The part or parts of the site this message asks to change. ONE IS THE ORDINARY ANSWER — several " +
            "things said about one part is still one part: \"make the background yellow and the corners " +
            "rounder\" is `css` alone, and so is \"darker footer, bigger heading\".\n" +
            "NAME A SECOND ONLY WHEN THEY REALLY ASKED FOR A SECOND, SEPARATE THING — \"rename us to Northwind " +
            "and make the tab icon a leaf\" is `brand` and `favicon`. Each name you add is a separate change to " +
            "a separate part of their site, so one added on a guess changes something nobody asked about.\n" +
            "NEVER NAME EVERYTHING. If you cannot tell which part they mean and nothing above settles it, name " +
            "none and ask them (`question`) instead of guessing. When one part plainly fits best, name it.\n\n" +
            "The parts:\n" + lines.join("\n"),
        },
        removes: removesProp("fields"),
        scopes: scopesProp("fields"),
        ...pageProps("fields"),
        question: QUESTION_FIELD,
      },
      required: ["fields", "scopes"],
    },
  };
}

/**
 * ── AND WHICH OF THOSE ARE BEING TAKEN OFF RATHER THAN CHANGED ─────────────
 *
 * `list` is the property that names the lanes: `fields` on the ordinary tool,
 * `additional` on the router's removal door. ONE WRITER for both, because the
 * two descriptions are one rule and a copy is the half that drifts.
 *
 * A SUBSET OF THAT LIST, and it can hold nothing else — the wall rather than
 * the rule, the same argument that gives every lane's own tool one property.
 * There is nowhere here to put "and restyle the header while you are there".
 *
 * NAMED IN BOTH PLACES, DELIBERATELY. A removal answers the list AND `removes`,
 * rather than `removes` alone, so the lane that runs is always one the picker
 * chose on the merits — and a model that fills in only one of the two has said
 * something we can still act on.
 *
 * `extra` is a sentence for the door alone; the ordinary tool passes none, so
 * its text is what it always was.
 */
function removesProp(list, extra = "") {
  return {
    type: "array",
    // THE ENUM IS EVERY LANE, NOT THE REMOVABLE ONES, AND THAT IS THE POINT.
    // Narrowing it to `REMOVABLE_LANES` reads like tightening a wall and would
    // quietly take the honest refusal away: a customer who says "delete the
    // bookings table" could no longer be UNDERSTOOD, so the ask would come back
    // as an ordinary change to `backend` and the reply would describe a removal
    // that never happened. Wide here, refused by name in `readRemoves`, said in
    // the reply.
    items: { type: "string", enum: LANE_FIELDS },
    description:
      "The parts named in `" + list + "` that they are asking to TAKE OFF the site rather than change. Leave it " +
      "out entirely for an ordinary change, which is nearly every message.\n" + extra +
      "ONLY WHEN THEY REALLY MEAN GONE — \"take the QR code off\", \"delete the testimonials section\", " +
      "\"we don't want the 3D thing any more\", \"drop the Spanish version\". A request to make something " +
      "different, smaller, plainer or hidden is a CHANGE, not this: \"make the hero less busy\" edits it.\n" +
      "IF YOU CANNOT TELL WHETHER THEY WANT IT GONE, never take it off on a guess: ask them (`question`). A " +
      "removal they meant as a change has taken part of their site away.\n\n" +
      "What taking each one off means:\n" +
      REMOVABLE_LANES.map((f) => "  " + f + " — " + LANES[f].remove).join("\n"),
  };
}

/**
 * ── AND EACH CHANGE'S OWN WORDS AND PAGE (2026-09-29) ───────────────────────
 *
 * Owner, after run 52: *"Make supported multi-change edits execute each
 * requested operation with its own scope. A site-wide description and a change
 * to one named page must retain their separate scopes."*
 *
 * The lanes were a list of names, so every page lane went to ONE page — the
 * router's, or the home page — and every rung was handed the WHOLE message. Run
 * 52's `shape` step was sent to `/` with the description's words and the Visit
 * move's together. Two changes on two pages could not be said at all: a lane is
 * named once.
 *
 * SO THE PICKER SAYS, FOR EACH CHANGE, WHICH PART, WHICH PAGE AND WHICH WORDS.
 * The route makes each change on its own page with its own words: the editor for
 * that change is handed those words and nothing else of the message
 * (`readScopes` checks them against the message). A change whose words are not
 * in it, or whose page is not a path, is withheld with a sentence — never run
 * on the whole message or sent to the home page (owner, 2026-09-29). A change
 * with no page stays site-wide, or goes where the router's page or the home page
 * sends it, exactly as before. `name` is the property that names the lanes, as
 * for `removesProp`; `extra` is a sentence for the door alone.
 */
function scopesProp(name, extra = "") {
  // `part` CARRIES NO ENUM: `readScopes` keeps only an entry naming a lane
  // this answer picked, which is the stricter wall, and a second copy of the
  // lane list would cost the two calls a customer pays for on every edit
  // (`test/edit-lanes.test.mjs` holds them under a tenth of the build tool).
  return {
    type: "array",
    maxItems: MAX_LANES,
    items: {
      type: "object",
      properties: {
        part: { type: "string", description: "A part named in `" + name + "`." },
        words: {
          type: "string",
          description: "Their words for this change and no other, copied EXACTLY from the message — its editor sees only these.",
        },
        page: {
          type: "string",
          description: "Only for a change on ONE page: its path from the list of pages (\"/\" is home). Leave it out for a " +
            "change to the whole site, or when no page was said.",
        },
        // WHICH ANSWERS THIS CHANGE NEEDS (2026-10-02, the owner's second
        // review: *"with the model identifying its relevant scope rather than
        // customer-keyword rules"*). The numbers of the section the route adds
        // after the message (`contextBlock`), read in `readScopes`; the editor
        // for this change is shown those answers, and the ones no change named.
        answers: {
          type: "array",
          items: { type: "integer" },
          description: "Numbers from WHAT THEY ALREADY TOLD YOU that this change needs ([] for none); `words` " +
            "still comes from the request.",
        },
      },
      required: ["part", "words"],
    },
    description:
      "ONE ENTRY PER SEPARATE CHANGE in `" + name + "`, so each is made in its own place with its own words. " + extra +
      "The same part on two pages is two entries; several things said about one change are one.",
  };
}

/**
 * ── AND, FOR `pages` ALONE, WHICH OF THE THREE ─────────────────────────────
 *
 * "Which pages the site has" is one field and three capabilities, each on a
 * different rung. A lane cannot pick between them from the field name, and
 * guessing is the worst option available: `add` guessed as `remove` deletes a
 * page somebody wanted.
 *
 * OPTIONAL, AND READ FOR ONE LANE. A lane with no verbs ignores it entirely —
 * the same scoping `remove` and `tab` already have one router up, and for the
 * same reason: a flag carried by a lane that cannot act on it is one nothing
 * reads. `list` is the property that names the lanes, as for `removesProp`.
 */
function pageProps(list) {
  return {
    pageVerb: {
      type: "string",
      enum: PAGE_VERBS,
      description:
        "ONLY when `" + list + "` includes \"pages\". Which of the three they are asking for.\n" +
        "\"add\" — a page the site does NOT have yet. \"Can we have a gallery page\", \"add an about page\".\n" +
        "\"remove\" — a page it has, taken off the site. \"Delete the gallery page\", \"we don't need /about any more\".\n" +
        "\"move\" — the same page at a DIFFERENT ADDRESS. \"Move the gallery to /work\", \"/about-us should be /about\".\n" +
        "AN ADDRESS IS NOT A HEADING. \"Call that page Services instead\" is about the WORDS on it and is not this " +
        "field at all — leave `pages` out and let the wording lane have it.\n" +
        "IF YOU CANNOT TELL WHICH, leave this out and ask them (`question`) — never guess: a page deleted on a " +
        "guess is a page they wanted kept.",
    },
    pageName: {
      type: "string",
      description:
        "ONLY with `pageVerb`. Which page they mean, as its route path — \"/\" for the home page, \"/menu\", " +
        "\"/gallery\". Copy it from the list of pages above when the site already has it. For \"move\", this is " +
        "the page being moved and `pageTo` is where it goes.",
    },
    pageTo: {
      type: "string",
      description: "ONLY with `pageVerb: \"move\"`. The NEW address, starting with a slash — \"/work\".",
    },
  };
}

/**
 * ── ON THE ROUTER'S REMOVAL DOOR THE PICKER IS TOLD WHAT WAS ROUTED, AND SAYS
 *    WHAT ELSE WAS ASKED (2026-09-28) ──────────────────────────────────────────
 *
 * The edit route opens this picker for a `nav` or `picture` message the router
 * marked `remove` (`DOOR_LAYERS`), so a removal can reach the lane machinery.
 * The router has ALREADY chosen that operation, and its rung runs whatever the
 * picker says. The picker's question there is the rest of the message.
 *
 * ⚠ THE LANE COUNT WAS STANDING IN FOR THAT QUESTION, AND THE OWNER HELD IT
 * TWICE. The ordinary tool asks "which parts does this message change", so on
 * the door its answer mixed two things: the picker's reading of the routed
 * operation and any work asked beside it. Run 47's lone `behavior` was the
 * first; the route then guessed from the count — one lane was the routed
 * operation, two or more were extra work — and the owner reproduced the guess
 * failing both ways: *"One additional selected lane can therefore represent a
 * second requested change. Conversely, two selected lanes do not prove two
 * independent requests. Replace the lane-count assumption with an explicit
 * distinction between the already-routed operation and additional requested
 * work."*
 *
 * SO THE DOOR ASKS FOR THE DISTINCTION BY NAME. The request names the routed
 * change in the router's own words (`routedNote`), and the tool has two lists:
 *   `additional` — work asked for BESIDE the routed change. The only list that
 *                  makes work: each lane in it becomes its own step.
 *   `routed`     — which part the routed change is about, if one fits. Recorded
 *                  and never acted on; it is where the picker's reading of that
 *                  change goes, so it is not mistaken for a second request.
 * Nothing is inferred from how many lanes either list holds.
 *
 * `fields` IS NOT ON THIS TOOL, so an answer in the ordinary tool's shape names
 * no additional work — run 47's recorded answer included.
 */
function doorPickTool(list, lines) {
  return {
    name: "pick_lanes",
    description: "Say whether this message asks for anything besides the change it has already been routed to, and which part of the site each other thing is.",
    input_schema: {
      type: "object",
      properties: {
        routed: {
          type: "array",
          maxItems: MAX_LANES,
          items: { type: "string", enum: list },
          description:
            "WHICH PART OF THE SITE THE ALREADY-ROUTED CHANGE IS ABOUT, if one of the parts listed under " +
            "`additional` fits it — the name you would have given that change. This changes nothing: that change " +
            "is made whatever you put here. It is here so that change is never mistaken for a second request. " +
            "Leave it out if no part fits.",
        },
        additional: {
          type: "array",
          maxItems: MAX_LANES,
          items: { type: "string", enum: list },
          description:
            "ANYTHING ELSE THIS MESSAGE ASKS TO CHANGE — a separate thing they asked for BESIDE the already-routed " +
            "change named above their message. That change is being made whatever you answer, so it never goes " +
            "here, and nor does any part of it.\n" +
            "EMPTY IS THE ORDINARY ANSWER. Most messages ask for that one change and nothing more, and several " +
            "things said about it are still that one change.\n" +
            "NAME A PART HERE ONLY FOR A SECOND, SEPARATE THING THEY REALLY ASKED FOR, one entry for each such " +
            "thing. Each name here is a separate change to a separate part of their site, so one added on a guess " +
            "changes something nobody asked about. If you cannot tell which part a second thing is and nothing " +
            "above settles it, ask them (`question`) instead of guessing.\n\n" +
            "The parts:\n" + lines.join("\n"),
        },
        removes: removesProp("additional", "The already-routed change is taken off already; it never goes here.\n"),
        scopes: scopesProp("additional", "The already-routed change is being made already; it never goes here. "),
        ...pageProps("additional"),
        question: QUESTION_FIELD,
      },
      required: ["additional"],
    },
  };
}

const PICK_SYSTEM =
  "You are routing one message inside a website builder. The person you are reading owns the site and has asked " +
  "for a change to it. Your only job is to say WHICH PART of their site the message is about, so the right " +
  "editor can be handed it. You are not making the change and you are not replying to them.\n\n" +
  "Name the fewest parts that cover what they asked for. One is nearly always right.";

/** The door's system text: the routed change is decided, and the question is what else. */
const PICK_DOOR_SYSTEM =
  "You are routing one message inside a website builder. The person you are reading owns the site and has asked " +
  "for a change to it. The message has ALREADY been routed to one change, named above it, and that change is being " +
  "made. Your only job is to say whether they ALSO asked for anything else, and which part of the site each other " +
  "thing is about, so the right editor can be handed it. You are not making any change and you are not replying " +
  "to them.\n\n" +
  "Nearly every message asks for that one change and nothing else. Say so by naming nothing in `additional`.";

/**
 * THE ROUTER'S REMOVAL DOOR, READ OFF WHAT THE CALLER SAYS WAS ROUTED — or
 * `null`, which is the ordinary tool.
 *
 * Only a removal the router routed to one of `DOOR_LAYERS` counts, because that
 * is the one condition the edit route opens this door on (`eRemovalDoor`); any
 * other shape asks the ordinary question. `lane` is the one lane leading to
 * that layer (`doorLane`), which is the routed operation's own lane.
 */
function routedDoor(routed) {
  if (!routed || typeof routed !== "object" || routed.remove !== true) return null;
  const layer = routed.layer;
  if (typeof layer !== "string" || !DOOR_LAYERS.includes(layer)) return null;
  const lane = doorLane(layer);
  if (!lane) return null;
  // `String(["/menu"])` IS `"/menu"` — refused rather than coerced.
  const page = typeof routed.page === "string" ? routed.page.trim().slice(0, 120) : "";
  return { layer, lane, page };
}

/**
 * THE ROUTED CHANGE, SAID TO THE PICKER IN THE ROUTER'S OWN WORDS — the line
 * the router's tool opens that layer with (`layerLine`), never a second
 * description of it. A layer whose line cannot be found is named bare.
 */
function routedNote(door) {
  const what = layerLine(door.layer);
  return "THE CHANGE THIS MESSAGE HAS ALREADY BEEN ROUTED TO, which is made whatever you answer:\n" +
    "taking something OFF the site, in its \"" + door.layer + "\" part" + (what ? " — " + what : ".") +
    (door.page ? "\nOn the page " + door.page + "." : "");
}

/**
 * The routing request. Shaped like `askRequest` in site-ask.mjs, for the same reasons.
 *
 * `routed` is what the edit route already routed, on its removal door only
 * (`routedDoor`): the door's tool, the door's system text, and the routed
 * change named above the message. Absent, the request is the ordinary one,
 * byte for byte.
 */
export function pickRequest({ message, fields = LANE_FIELDS, current = "", model = LANE_MODEL, routed = null }) {
  const door = routedDoor(routed);
  const tool = pickTool(fields, { routed: !!door });
  return {
    model,
    // ROOM FOR EACH CHANGE'S OWN WORDS, COPIED (2026-10-03): `scopes` quotes the
    // message, so the ceiling grows by what may be copied. A ceiling, not a charge.
    max_tokens: LANE_PICK_MAX_TOKENS + echoTokens(String(message || "")),
    // A REAL CACHED PREFIX: the tool and the system text are byte-identical on
    // every edit any customer makes, and the message is the only per-call byte.
    // The door has its own pair, byte-identical on every door message; what
    // was routed rides in the message, never in the prefix.
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: "pick_lanes" },
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: door ? PICK_DOOR_SYSTEM : PICK_SYSTEM }],
    // WHAT THE SITE IS, IN ONE LINE, AND ONLY WHEN THE CALLER HAS IT.
    // Deliberately thin — a name and the pages, never the stylesheet. The whole
    // point of this call is that it is small.
    messages: [{ role: "user", content: (current ? current + "\n\n" : "") + (door ? routedNote(door) + "\n\n" : "") + "Their message:\n" + String(message || "") }],
  };
}

/**
 * What the router named, refused down to lanes the caller actually offered.
 *
 * EVERY REFUSAL IS SILENT AND RETURNS FEWER LANES, never a throw: an
 * unrecognised name is a routing miss, and the caller's answer to "no lanes" is
 * the ladder, which is the contract every other rung already has.
 *
 * `String(["css"])` IS `"css"` — the coercion this repo has shipped as a real
 * bug three times, once as a role, once as an access level, once as a language.
 * A non-string is REFUSED rather than coerced.
 */
export function readLanes(reply, fields = LANE_FIELDS) {
  return laneList(reply, "fields", fields);
}

/**
 * ONE READER FOR EVERY LANE LIST THE PICKER ANSWERS — `fields` on the ordinary
 * tool, `additional` and `routed` on the router's removal door — so all three
 * refuse, de-duplicate, cap and order the same way. `key` is always one of our
 * own three names, never anything a caller or a model supplied.
 */
function laneList(reply, key, fields) {
  const offered = (Array.isArray(fields) ? fields : []).filter((f) => typeof f === "string" && f);
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = use && use.input && Array.isArray(use.input[key]) ? use.input[key] : [];
  const seen = new Set();
  for (const f of raw) {
    if (typeof f !== "string" || !offered.includes(f)) continue;
    // DE-DUPED: running one lane twice is two calls producing one answer and
    // billing for both, and the second would be shown the state the first has
    // already changed — so it would undo it.
    seen.add(f);
    if (seen.size >= MAX_LANES) break;
  }
  // IN THE CALLER'S ORDER, NEVER THE MODEL'S. Not because the lanes depend on
  // each other — they do not, and that is the point of the split: each is shown
  // its OWN stored value and answers only its own field, so two lanes in one
  // message cannot race — but because the order decides which four survive the
  // cap above, and a cap that keeps a different four depending on how the model
  // happened to list them is one nobody can reproduce.
  return offered.filter((f) => seen.has(f));
}

/**
 * WHICH OF THE PICKED LANES ARE REMOVALS, split into what we can do and what we
 * have to say we cannot.
 *
 * A SUBSET OF WHAT WAS PICKED, ALWAYS. A removal names a lane, and a lane the
 * picker did not choose is not part of this message — reading `removes` on its
 * own would let a name nobody asked for take something off the site. Anything
 * outside `picked` is dropped before either bucket.
 *
 * THE THREE ANSWERS, and the middle one is why this returns an object:
 *   `remove`  — lanes to take off, in the CALLER's order, for the same reason
 *               `readLanes` re-orders: reproducibility, not dependency.
 *   `refused` — `[{field, why}]` for a lane that names a real part of the site
 *               this route will not remove. SAID, NEVER DROPPED: a silent drop
 *               is how "delete the bookings table" comes back "✅ Done" having
 *               done nothing, which is the failure this whole path exists to
 *               avoid. The sentence is the lane's own, from `NOT_REMOVABLE`.
 *   `pages`   — `true` when the picker put "pages" here instead of answering
 *               `pageVerb: "remove"`. DERIVED rather than refused, because both
 *               spellings mean one act and refusing the second-most-natural one
 *               is a wall in front of a customer who was perfectly clear. The
 *               caller folds it into the verb it already reads; `pages` stays
 *               out of `REMOVABLE_LANES` so the two can never both fire.
 *
 * `String(["css"])` IS `"css"` — the coercion shipped here as a real bug three
 * times. A non-string is refused rather than coerced, exactly as `readLanes`
 * refuses it one function up, and it matters more here: the coerced value would
 * name a lane and take it off.
 */
export function readRemoves(reply, picked = []) {
  const chosen = (Array.isArray(picked) ? picked : []).filter((f) => typeof f === "string" && f);
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = use && use.input && Array.isArray(use.input.removes) ? use.input.removes : [];
  const seen = new Set();
  let pages = false;
  const refused = [];
  for (const f of raw) {
    if (typeof f !== "string" || !chosen.includes(f)) continue;
    if (f === "pages") { pages = true; continue; }
    if (REMOVABLE_LANES.includes(f)) { seen.add(f); continue; }
    const why = removalRefusal(f);
    if (why && !refused.some((r) => r.field === f)) refused.push({ field: f, why });
  }
  return { remove: chosen.filter((f) => seen.has(f)), refused, pages };
}

/**
 * EACH CHANGE THE PICKER SCOPED, checked against what was picked and against
 * the message itself (2026-09-29) — `{ scoped, ops }`.
 *
 * `scoped` SAYS WHETHER THE ANSWER CARRIED SCOPE METADATA AT ALL. An answer
 * with no `scopes` — absent, `null` or `[]` — is the legacy shape, and every
 * lane runs exactly as it did before scopes existed. Anything else is scoped,
 * including a `scopes` that is not a list: metadata was supplied and none of
 * it can be read.
 *
 * `ops` IS ONE ENTRY PER SCOPE NAMING A PICKED LANE, in the order given —
 * `{ part, page, words }`, and `invalid` when a field fails its check:
 *
 *   `part`   — one of `picked`. An entry naming no picked lane places nothing
 *              and is not returned; on a scoped answer the route withholds
 *              every lane left without a valid entry, so a stray entry can
 *              never widen another lane.
 *   `page`   — `""` when absent (`undefined`, `null`, a blank string): a
 *              site-wide change, or one with no page said. Otherwise in the
 *              one spelling pages are compared in (`normalizePagePath`).
 *              `invalid: "page"` when it is present and not a path: a
 *              non-string (`String(["/visit"])` is "/visit", and this reader
 *              does not coerce), or a string that names no path at all.
 *              Whether the SITE has the page is the route's question.
 *   `words`  — the customer's own text for this change as it stands in
 *              `message` (`wordsIn`). `invalid: "words"` when the copy is not
 *              a string or is not in the message; the op's `words` is then
 *              `""`.
 *
 * ⚠ AN INVALID OP IS NEVER A LEGACY OP (owner, 2026-09-29): *"Once an
 * operation supplies scope metadata, failed validation must not widen its
 * instruction to the whole request or redirect it to the homepage."* This
 * reader used to turn a failed page into `""` and failed words into `""`, and
 * the route read both as "no scope": run 52's Visit move went to the home
 * page's writer, and a paraphrased copy handed the Visit writer the whole
 * request, the description change included. The route now withholds an
 * invalid op and says so.
 */
// `count` IS HOW MANY ANSWERS THE PICKER WAS SHOWN, NUMBERED (2026-10-02). A
// change's `answers` is kept only as a list of those numbers, each once and in
// order; anything else is no reading at all, and the change is shown every
// answer — never fewer than it may need. Absent, likewise.
function answerNumbers(v, count) {
  if (!Array.isArray(v) || !Number.isInteger(count) || count < 0) return null;
  if (!v.every((n) => Number.isInteger(n) && n >= 1 && n <= count)) return null;
  return [...new Set(v)].sort((a, b) => a - b);
}

export function readScopes(reply, picked = [], message = "", count = 0) {
  const chosen = (Array.isArray(picked) ? picked : []).filter((f) => typeof f === "string" && f);
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = use && use.input && typeof use.input === "object" ? use.input : {};
  const raw = Object.hasOwn(input, "scopes") ? input.scopes : undefined;
  if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) return { scoped: false, ops: [] };
  if (!Array.isArray(raw)) return { scoped: true, ops: [] };
  const ops = [];
  for (const sc of raw) {
    if (!sc || typeof sc !== "object" || Array.isArray(sc)) continue;
    if (typeof sc.part !== "string" || !chosen.includes(sc.part)) continue;
    const pageGiven = sc.page !== undefined && sc.page !== null && !(typeof sc.page === "string" && !sc.page.trim());
    const page = pageGiven && typeof sc.page === "string" ? normalizePagePath(sc.page) : "";
    const words = typeof sc.words === "string" ? wordsIn(message, sc.words) : "";
    const invalid = pageGiven && !page ? "page" : !words ? "words" : "";
    const answers = answerNumbers(sc.answers, count);
    ops.push({ part: sc.part, page, words: invalid ? "" : words, ...(invalid ? { invalid } : {}), ...(answers ? { answers } : {}) });
  }
  return { scoped: true, ops };
}

/**
 * THE ONE LANE THAT LEADS TO A LAYER — `action` for `nav`, `images` for
 * `picture` — or `null` when no single lane does.
 *
 * Asked for the two layers the router can open the lane picker's door from
 * (`DOOR_LAYERS` in `site-ask.mjs`), and pinned for both by a guard: each has
 * exactly one lane, so "the router's own operation" and "that lane, as if the
 * picker had named it" are the same step.
 *
 * `null` FOR ANYTHING UNREADABLE, NEVER A MATCH. `laneLayer` answers `null` for
 * every lane with no rung of its own, so comparing a `null` layer against it
 * would match all of those at once.
 */
export function doorLane(layer) {
  if (typeof layer !== "string" || !layer) return null;
  const lanes = LANE_FIELDS.filter((f) => laneLayer(f) === layer);
  return lanes.length === 1 ? lanes[0] : null;
}

/**
 * WHAT THE PICKER ANSWERED ON THE ROUTER'S REMOVAL DOOR — the work asked for
 * beside the routed change, and its reading of that change, as two lists it
 * named itself (2026-09-28, run 47; the second correction the same day).
 *
 * The router's rung runs on that door whatever the picker says. Run 47's
 * picker answered `behavior` alone for "Take Gallery out of the menu." and a
 * look step ran it INSTEAD of the menu rung; the first correction kept only
 * lanes leading back to the router's rung and dropped work asked beside it;
 * the second read the answer by its COUNT — one lane was the routed change,
 * two or more were extra work — and the owner reproduced that failing both
 * ways (a lone `shape` asked beside a photo removal was lost, and two lanes
 * need not be two requests). So the picker is asked for the distinction
 * itself (`doorPickTool`), and this reads it:
 *
 *   `fields`  — the `additional` list, less the routed change's own lane. The
 *               only lanes that become steps; each runs as its own step with
 *               its own verb, never the router's.
 *   `routed`  — the `routed` list, plus the routed change's own lane when the
 *               picker put it under `additional`. Recorded, never run: that
 *               change is the router's step, which runs once.
 *   `removes` — `removes` read against `fields` alone, so a removal can name
 *               only work asked for beside the routed change. The routed
 *               change's own removal is the router's verb, on the router's step.
 *   `page`    — the `pages` verb, read as it always is; the route reads it only
 *               when `pages` is among `fields`.
 *
 * THE ROUTED CHANGE'S OWN LANE UNDER `additional` IS THAT CHANGE, NOT A SECOND
 * ONE. Its rung is the router's rung and reads the whole sentence, so a second
 * step there would run one operation twice. That is structural — the one lane
 * leading to the router's layer — and never a guess from how many lanes came
 * back.
 *
 * WHAT THIS CANNOT TELL, SAID RATHER THAN HIDDEN: a lane the picker lists
 * under `additional` is taken as work asked for, so a misreading put there runs
 * beside the routed change; and one it lists under `routed` is taken as that
 * change, so a second request put there does not run. Every model answer that
 * proves this is supplied; which lists a real picker fills is not measured.
 */
function doorPicked(reply, door, fields, model, message, answers = 0) {
  const offered = (Array.isArray(fields) ? fields : []).filter((f) => typeof f === "string" && f);
  const additional = laneList(reply, "additional", offered);
  const named = laneList(reply, "routed", offered);
  const work = additional.filter((f) => f !== door.lane);
  return {
    fields: work,
    routed: offered.filter((f) => named.includes(f) || (f === door.lane && additional.includes(f))),
    page: readPageVerb(reply),
    removes: readRemoves(reply, work),
    // THE WORK'S OWN PAGES AND WORDS, read against the work alone: the routed
    // change is the router's step and keeps the router's page. `scoped` says
    // whether the answer carried scope metadata at all (`readScopes`).
    ...scopesOf(readScopes(reply, work, message, answers)),
    // A QUESTION BACK (2026-10-02): the picker could not tell what else is
    // asked without a detail they left out. The caller asks it before
    // anything runs, the router's own step included.
    ask: askOf(reply) || undefined,
    usage: laneUsage(reply, model),
    failed: false,
  };
}

/** `readScopes`'s answer as the two fields a pick carries: `scopes` (the ops) and `scoped`. */
function scopesOf(read) {
  return { scopes: read.ops, scoped: read.scoped };
}

/**
 * THE LANES TO DISPATCH, WITH THE ROUTER'S OWN LANE AMONG THEM.
 *
 * On the router's removal door its rung always runs, exactly once. The picker's
 * work never carries that lane (`doorPicked` takes it out), so the lane is put
 * back in the picker's own order (`LANE_FIELDS`) and the router's step runs
 * exactly where that lane would have run — before a later page lane, after an
 * earlier one — and no step moves. A list that already carries it is returned
 * as it is, so the lane is never there twice. `own` is `doorLane`'s answer;
 * without one the list is the picker's, untouched.
 */
export function doorDispatch(fields, own) {
  const picked = Array.isArray(fields) ? fields : [];
  if (!own || picked.includes(own)) return picked;
  return LANE_FIELDS.filter((f) => f === own || picked.includes(f));
}

/**
 * The verb, the page and the destination — refused down to shapes we can use.
 *
 * REFUSED, NEVER DEFAULTED. A `pages` ask whose verb we cannot read escalates,
 * which is the one place in the edit path where the bias inverts: everywhere
 * else an unclear answer resolves to work, because a wrong action costs a change
 * the customer can see and undo. Here a wrong action can cost them a page.
 */
export function readPageVerb(reply) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = (use && use.input) || {};
  const verb = typeof input.pageVerb === "string" && PAGE_VERBS.includes(input.pageVerb) ? input.pageVerb : null;
  if (!verb) return null;
  // `String(["/menu"])` IS `"/menu"` — refused rather than coerced, the same
  // rule the lane names live under.
  const path = (v) => (typeof v === "string" ? v.trim().toLowerCase().slice(0, 120) : "");
  const name = path(input.pageName);
  const to = path(input.pageTo);
  // A MOVE WITH NOWHERE TO GO IS NOT A MOVE. Refused here rather than passed on
  // as a rename to the empty string, which `renameRoute` would have to invent a
  // refusal for.
  if (verb === "move" && !(to.startsWith("/") && to.length > 1)) return null;
  return { verb, layer: verbLayer(verb), name, to };
}

/** Usage in the four kinds `pageCredits` prices, tagged with the model we sent. */
export function laneUsage(reply, model) {
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
 * Pick the lanes. One call, `send` injected.
 *
 * A THROW IS NOT A FALLBACK TO EVERYTHING. If this call cannot be made the
 * honest answer is no lanes, and the caller reports the outage at no charge —
 * falling back to the whole list would answer "we could not tell" by buying
 * seventeen edits, which is the most expensive possible reading of it.
 */
export async function pickLanes(deps, { message, fields = LANE_FIELDS, current = "", model = LANE_MODEL, routed = null, answers = 0 } = {}) {
  // THE ROUTER'S REMOVAL DOOR, when the caller says what was routed there.
  // Everything else is the ordinary question, byte for byte.
  const door = routedDoor(routed);
  const text = String(message || "").trim();
  // A PAID CALL BEHIND A PUBLIC ROUTE. The composer will not send an empty
  // message; "the client wouldn't do that" is not a gate.
  if (!text) return door ? { fields: [], routed: [], scopes: [], scoped: false, usage: null, failed: false } : { fields: [], scopes: [], scoped: false, usage: null, failed: false };
  let reply;
  try {
    reply = await deps.send(pickRequest({ message: text, fields, current, model, routed }));
  } catch (e) {
    // CARRIED, NOT SWALLOWED. The caller tells a billing outage from a busy
    // model by reading `e.status` and `e.detail`.
    return { fields: [], scopes: [], scoped: false, usage: null, failed: true, error: e };
  }
  // AN ANSWER CUT OFF AT ITS CEILING IS NO ANSWER (2026-10-03): a list of
  // changes stopped part way would run some of them and drop the rest without a
  // word. Failed, as a call that did not answer, with the cut named.
  if (reply && reply.stop_reason === "max_tokens") {
    const e = new Error("pick truncated at max_tokens");
    e.truncated = true;
    return { fields: [], scopes: [], scoped: false, usage: null, failed: true, error: e };
  }
  // ON THE DOOR THE ANSWER IS TWO LISTS, read by their names (`doorPicked`).
  if (door) return doorPicked(reply, door, fields, model, text, answers);
  // THE MODEL THAT WAS ACTUALLY SENT, not the module default. This stamped
  // `LANE_MODEL` while the request carried the caller's `model`, so a customer
  // on Sonnet had their routing call PRICED as the default picker's — the rate
  // column disagreeing with the call it prices. Caught by the per-message
  // billing test, which noticed the bill spanning two models.
  // READ ONCE, IN ORDER: the lanes first, then which of THOSE are removals.
  // `readRemoves` is given the picked set rather than the offered one, so a
  // removal can only ever name a lane this message really chose.
  const picked = readLanes(reply, fields);
  const removes = readRemoves(reply, picked);
  return {
    fields: picked,
    // EACH CHANGE'S OWN PAGE AND WORDS, checked against the picked lanes and
    // the message the picker was shown (`readScopes`), and whether the answer
    // carried any scope metadata at all (`scoped`).
    ...scopesOf(readScopes(reply, picked, text, answers)),
    page: readPageVerb(reply),
    // THE REMOVAL RIDES THE SAME ANSWER AS THE LANES, rather than being read
    // again by the caller off a reply it would have to keep. One read, one
    // shape: a caller that forgets to look at `removes` runs the lanes as
    // ordinary changes, which is the old behaviour and not a new failure.
    removes,
    // A QUESTION BACK (2026-10-02): the picker could not tell which part of
    // the site is meant without a detail they left out, so it asked instead
    // of guessing. When it asks, nothing it named runs: the caller asks the
    // question before any lane does (`builder/clarify.mjs`).
    ask: askOf(reply) || undefined,
    usage: laneUsage(reply, model),
    failed: false,
  };
}

/* ---------------------------------------------------------------- the action */

/**
 * ONE LANE'S TOOL: one property, nothing required, and the edit path's own words.
 *
 * `required: []` for the reason the whole edit path empties it — a required
 * field is one the model MUST answer, and answering it is what moves a value
 * nobody asked to move. A lane that cannot express the change returns nothing
 * and the ladder climbs, which is the contract every rung already has.
 *
 * ONE PROPERTY IS A WALL, NOT A RULE. A `css` lane cannot re-theme or rename a
 * site — not because it is told not to, but because there is nowhere to put the
 * answer. This repo's own record is that a rule in prose is one a model
 * eventually reads past; a property that does not exist is not.
 */
// ── AND IT MAY ASK (2026-10-02, the owner's review: *"Extend clarification
//    into the edit models … that currently cannot ask when missing details
//    become apparent after picking the path"*) ─────────────────────────────────
//
// The lane was picked for its part of the site, and only it sees that part's
// current value: whether "the button" is one of two it is shown is something
// only this call can find out. It asks through the one field every step
// carries (`QUESTION_FIELD`), and the look step that ran it changes nothing.
// `ask: false` is for a call that is not the customer's request at all — the
// correction round, re-aiming selectors that matched nothing — which has
// nobody to ask.
export function editTool(field, { ask = true } = {}) {
  if (typeof field !== "string" || !Object.hasOwn(LANES, field)) throw new Error("editTool: no lane for: " + field);
  const lane = LANES[field];
  // A LANE THAT DOES NOT ACT HAS NO TOOL, and asking for one is a caller that
  // skipped `laneLayer` — refused here rather than answered with an empty
  // schema the model would fill with something.
  if (lane.elsewhere) throw new Error("editTool: `" + field + "` does not act here — it runs on the " + laneLayer(field) + " layer");
  if (lane.unbuilt) throw new Error("editTool: `" + field + "` does not act here — it needs " + laneUnbuilt(field));
  if (lane.verbs) throw new Error("editTool: `" + field + "` does not act here — its rung depends on the verb");
  if (lane.escalate) throw new Error("editTool: `" + field + "` does not act here — the " + lane.escalate + " rung does this");
  const tool = {
    name: "edit_site",
    description: "Make the one change they asked for to this part of their site.",
    input_schema: {
      type: "object",
      properties: { [field]: { ...lane.shape, description: laneRule(field) } },
      required: [],
    },
  };
  return ask ? withQuestion(tool) : tool;
}

/**
 * The four parts of a lane's rule, in order, as the one string the tool carries.
 *
 * COMPOSED RATHER THAN STORED WHOLE (owner, 2026-08-29: "i want a rule per
 * everysingle one of them, just like we did for css"), because a rule kept as
 * one paragraph is a rule whose missing half nobody notices. Each part is its
 * own key, `RULE_PARTS` names them in the order they are read, and `laneRule`
 * refuses a lane that is missing one — so a lane cannot ship as a description
 * with no ceiling, which is what six of the eight were before today.
 *
 * ORDER IS DELIBERATE AND IS THE ORDER A PERSON WOULD SAY IT IN: what this is,
 * what you may do, how far, and what must survive. `wide` sits third because it
 * is the part with teeth — the last thing before `keep` and the only part no
 * other lane could borrow.
 */
export const RULE_PARTS = ["is", "yours", "wide", "keep"];

/**
 * The composer, taking the rule as an ARGUMENT so the refusal can be tested.
 *
 * SPLIT OUT BECAUSE THE REFUSAL WAS UNREACHABLE (2026-08-29). Folded into
 * `laneRule`, it could only ever fire on a lane whose rule was incomplete — and
 * every lane is complete, so a mutation sweep proved the line inert: deleting
 * the throw changed nothing and SURVIVED the whole suite. An inert mutant reads
 * exactly like a test gap, and here it was a real one wearing that disguise: the
 * ceiling existed and nothing proved it would ever fire, so a later edit could
 * remove it silently.
 *
 * `LANES` is module-private, so no test could build a bad lane to try it with.
 * Taking the rule as a parameter is what makes the guard reachable, and the
 * whole point of a guard is that something has watched it work.
 */
export function composeRule(field, rule) {
  if (!rule || typeof rule !== "object") throw new Error("laneRule: `" + field + "` has no rule");
  return RULE_PARTS.map((part) => {
    const text = rule[part];
    // A MISSING PART IS A LANE WITH NO CEILING, and from outside that is a lane
    // that quietly over-answers — indistinguishable from a model being
    // careless. Refused where the name is still in hand.
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("laneRule: `" + field + "` has no `" + part + "` — every lane states all four parts of its rule");
    }
    return text.trim();
  }).join("\n");
}

export function laneRule(field) {
  if (typeof field !== "string" || !Object.hasOwn(LANES, field)) throw new Error("laneRule: no lane for: " + field);
  return composeRule(field, LANES[field].edit);
}

/**
 * ── PLACEHOLDER WORDING (owner: "i will tell you the prompt later"). ──
 *
 * PURE ACTION, AND THAT IS THE WHOLE FRAMING (owner, 2026-08-29: "customer says
 * edit this, and booom you go edit it"). No design brief, no plan, no questions
 * about the business — the site exists, one part of it is in front of the model,
 * and one sentence says what to change about it.
 *
 * THE TWO HALVES ARRIVE TOGETHER AND EITHER ALONE MISLEADS (owner, 2026-08-28:
 * "it's free css — the model can edit anything on the page… but when they ask
 * one thing, you only edit one thing"). Permission without a ceiling invites a
 * redesign; a ceiling without permission reads as "don't touch anything".
 */
const EDIT_SYSTEM =
  "You are making one change to a website that already exists, for the person who owns it.\n\n" +
  "One part of their site is in front of you, exactly as it is now, and one message says what they want " +
  "different about it. Answer with that same part as it should be afterwards. There is nothing else you can " +
  "answer with and nothing else to decide: they have not asked you to design anything, review anything or " +
  "improve anything.\n\n" +
  "THE PART IS YOURS AND NOTHING IN IT IS OUT OF REACH. Whatever they asked for, if this part can express it, " +
  "write it.\n\n" +
  "AND ONLY WHAT THEY ASKED FOR MOVES. As many changes as there were asks and never more, each one only as wide " +
  "as it was asked, everything else back exactly as it was given to you. A site that changes in ways nobody " +
  "asked for reads as broken however good the change is.\n\n" +
  "IF THEIR MESSAGE IS NOT ABOUT THIS PART, ANSWER NOTHING. Something else is handling it, and a value invented " +
  "to fill the silence is a change they did not ask for.";

/**
 * The acting request.
 *
 * THE CURRENT VALUE IS THE MESSAGE. It is not a "brief" and it is not framed as
 * one: the model is shown what this part of the site IS and then what they said
 * about it. That is the whole prompt, which is what "pure action" means.
 */
// ── THE SITE'S OWN STYLING, SHOWN TO THE LANE THAT STYLES IT ────────────────
//
// Owner, 2026-08-31: "you need to show the whole css of the site… the css step
// in the edit css path need to be able to edit everything possible that contains
// css, and im pretty sure that the theme code has css inside, otherwise it
// wouldnt be a theme."
//
// The `yours` half of this lane's own rule has always said "THE WHOLE LOOK IS
// HERE AND ALL OF IT IS YOURS TO EDIT… You are not limited to what the theme
// offers" — which was a promise about a theme the model had never been shown.
// This is what makes it true.
//
// THREE THINGS THE WORDING HAS TO DO, and the third is the one that can do harm:
//
//   1. Say these rules are ALREADY on the page, so the model reads them as the
//      site's current state rather than as a draft to improve.
//   2. Say the answer is written LAST, because that is the fact that makes an
//      override work and is not guessable from the note alone.
//   3. Say DO NOT COPY IT BACK — and this is the load-bearing one. The lane's
//      answer REPLACES the stored free-CSS layer. A model that returns the theme
//      with one line changed would freeze a copy of the theme into a layer that
//      outranks it and no longer follows it, so a later theme change would apply
//      to nothing. That is a worse site than the one that ignored the edit.
//
// A CEILING, because this is a per-call byte in a cached-prefix request and a
// theme is 4-11KB. Cut at a rule boundary like `readCss` does, so the tail of
// the note is never half a declaration the model then tries to complete.
export const MAX_THEME_NOTE = 14000;

export function themeNote(css) {
  const s = typeof css === "string" ? css.trim() : "";
  if (!s) return "";
  let use = s;
  if (use.length > MAX_THEME_NOTE) {
    const at = use.lastIndexOf("}", MAX_THEME_NOTE);
    use = (at > 0 ? use.slice(0, at + 1) : use.slice(0, MAX_THEME_NOTE)) + "\n/* … */";
  }
  return "THE SITE'S CURRENT STYLING — its theme, and these rules are ON THE PAGE right now:\n" +
    use +
    "\n\nThat block is context, NOT your answer. Do not copy it back: what you return REPLACES the " +
    "stylesheet above it and is written LAST, after everything here, so one rule of yours overrides " +
    "anything in it. If what they asked for is decided by one of these custom properties, the smallest " +
    "change is to redefine that property — but only when what they named really is the whole site, " +
    "because every component reading it repaints.";
}

// ── THE LANDMARK MAP, AS THE MODEL READS IT (2026-08-31, owner's call) ──────
//
// "Require the model to target stable `data-slot` selectors instead of guessing
// HTML tags from the user's wording. If the user says 'button', interpret that
// as the element's visual or functional role — not necessarily a literal
// `<button>`."
//
// WHAT IT REPLACES. Nothing. Until this, the lane was shown the stylesheet and
// the customer's sentence, and had to invent a selector for a page it had never
// seen. Run 96 wrote `header button` and matched zero elements; run 98, shown
// the theme, wrote the same dead selector in a different green. The information
// it needed was never missing from the SITE — only from the request.
//
// A TABLE, NOT PROSE, and the columns are the owner's list: the stable name,
// the selector that addresses it, the tag, the section, what it does, what it
// says, its classes and its route. Pipe-separated because it is scanned rather
// than read, and every byte here is a per-call byte on a cached-prefix request.
//
// `selector` IS THE LOAD-BEARING COLUMN and the reason this is trustworthy at
// all: every one was tested against the real DOM at capture time and matches
// EXACTLY ONE element. The model is not being asked to construct a selector
// from the other columns — it is being handed one that already works, and the
// other columns exist so it can tell which row the customer meant.
export const MAX_LANDMARK_ROWS = 40;

export function landmarkNote(marks) {
  const list = Array.isArray(marks) ? marks.filter((m) => m && typeof m === "object" && m.selector) : [];
  if (!list.length) return "";
  const cell = (v) => String(v == null ? "" : v).replace(/[|\n]/g, " ").trim();
  const rows = list.slice(0, MAX_LANDMARK_ROWS).map((m) =>
    [cell(m.name), cell(m.selector), "<" + cell(m.tag) + ">", cell(m.section), cell(m.role),
     cell(m.text), cell(m.href), cell(m.route)].join(" | "));
  return "WHAT IS ACTUALLY ON THEIR PAGE — every row is a real element, and each `selector` was tested " +
    "against the rendered page and matches EXACTLY ONE of them:\n" +
    "name | selector | tag | section | role | text | link | route\n" +
    rows.join("\n") +
    "\n\nAIM BY THIS TABLE, AND SELECT BY THE `selector` COLUMN. Do not invent a selector out of the tag or out of the words they " +
    "used: what a customer calls a button is usually not a `<button>` — this kit renders one as an `<a>`, and " +
    "a rule for `header button` on a page with no `<button>` in it is valid CSS that changes nothing and is " +
    "indistinguishable from a rule that worked. Read their wording as the element's ROLE and its PLACE, then " +
    "find the row: \"the button up in the header\" is the row whose section is `header` and whose role is " +
    "`button`, whatever tag it turns out to be.\n" +
    "If they named something that is genuinely not in this table, say so by changing nothing rather than " +
    "aiming at where it ought to be. A general rule meant for the whole site — a token, `body`, a heading " +
    "level everywhere — does not need a row and is still yours to write.";
}

export function editRequest({ field, message, value, model, note = "", ask = true }) {
  const tool = editTool(field, { ask });
  return {
    model,
    max_tokens: laneMaxTokens(field),
    // CACHED: the tool and the system text are byte-identical for every edit of
    // this field by any customer. The value and the message are the per-call
    // bytes and ride in the user message, never in a cached block — a per-site
    // byte in a cached prefix misses the cache on every edit.
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: "edit_site" },
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: EDIT_SYSTEM }],
    messages: [{ role: "user", content:
      "Their site's `" + field + "` as it stands:\n" +
      (value === undefined || value === null || value === ""
        // NOT-SET IS SAID, NEVER LEFT BLANK. An empty line reads as an empty
        // VALUE — "the stylesheet is empty" rather than "this site has never had
        // one" — and the two want different answers.
        ? "(not set — this site has never had one)"
        : (typeof value === "string" ? value : JSON.stringify(value))) +
      (note ? "\n\n" + note : "") +
      "\n\nWhat they asked for:\n" + String(message || "") },
    ],
  };
}

/**
 * What the lane answered — the field's new value, or `undefined` for nothing.
 *
 * `undefined` AND `null` ARE BOTH NOTHING, and neither is an instruction to
 * strip the value bare. The caller keeps what is stored. A lane that declines is
 * the ordinary shape here: the router named it and the model found the message
 * was not really about this part.
 */
export function readLaneAnswer(reply, field) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const v = use && use.input && typeof use.input === "object" ? use.input[field] : undefined;
  return v === null ? undefined : v;
}

/**
 * Run one lane. One call, `send` injected, no merging and no publishing.
 *
 * TRUNCATION IS NAMED, not returned as a short value. A tool_use block cut off
 * at max_tokens carries half-written JSON, so the "answer" is a stylesheet
 * missing its last rules — which stores and publishes and looks like the model
 * doing a bad job. Same check the design and pages calls make.
 */
export async function runLane(deps, { field, message, value, model, note = "", ask = true }) {
  let reply;
  try {
    reply = await deps.send(editRequest({ field, message, value, model, note, ask }));
  } catch (e) {
    return { field, value: undefined, usage: null, failed: true, error: e };
  }
  if (reply && reply.stop_reason === "max_tokens") {
    const e = new Error("edit truncated at max_tokens");
    e.truncated = true;
    return { field, value: undefined, usage: laneUsage(reply, model), failed: true, error: e };
  }
  // A QUESTION BACK (2026-10-02): asked instead of answering, so no value is
  // read beside it — only where a question was offered.
  const q = ask ? askOf(reply) : null;
  if (q) return { field, value: undefined, usage: laneUsage(reply, model), failed: false, ask: q };
  return { field, value: readLaneAnswer(reply, field), usage: laneUsage(reply, model), failed: false };
}
