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

/** Enough for a short list of names. There is no prose in this output at all. */
export const LANE_PICK_MAX_TOKENS = 200;

/**
 * Enough for one edited value.
 *
 * The largest thing any acting lane returns is a stylesheet, and `readCss` caps
 * what we will store well below this. Sized for that one and shared, rather than
 * eight numbers that drift.
 */
export const LANE_EDIT_MAX_TOKENS = 16000;

/** How much of the message we will even consider. Matches `site-ask.mjs`. */
export const MAX_MESSAGE = 2000;

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
 *   action      → `nav`      the primary button: its words and where it goes  (~0.3)
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
    hint: "What something on the page DOES when someone uses it — a button, a link, a form, a tab, a filter, a menu, a carousel. What it opens, what it changes, what you see happen.",
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
  qr: {
    hint: "THE QR CODE — where scanning it takes you, or what the words beside it say. Also taking it off the site.",
    shape: {
      type: "object",
      properties: {
        points: { type: "string", description: "What scanning it does — a full URL, or `tel:`, `mailto:`, `WIFI:`, or plain text." },
        label: { type: "string", description: "The few words printed beside it." },
      },
      required: ["points", "label"],
    },
    edit: {
      is: "Where the site's QR code points and what it is called, as they should be after their change.",
      yours:
        "BOTH HALVES ARE YOURS TO CHANGE. Point it somewhere else, reword the caption, or both — whatever " +
        "they asked for. The code itself is drawn for you from these two values; you never draw one.",
      wide:
        "NEVER INVENT A DESTINATION. This is the one field where a plausible guess is worse than a refusal: " +
        "a QR is the one thing on a page a visitor cannot read before acting on it, so a made-up URL is a " +
        "customer sending people somewhere that does not exist. If they asked to reword the caption, change " +
        "the caption and hand `points` back exactly as it was.",
      keep:
        "THE HALF THEY DID NOT MENTION COMES BACK UNCHANGED, character for character. A reworded caption " +
        "must not quietly re-point the code, and a re-pointed code must not quietly reword the caption.",
    },
  },

  /* ---- the six that act on another layer ---- */
  purpose: { hint: "What the page is organised around — what it leads with and what everything else supports.", elsewhere: "plan" },
  components: { hint: "Which building blocks the page is made of — the manifest it is written from.", elsewhere: "plan" },
  shape: { hint: "Where the sections go on the page and in what order — moving a band up or down, taking one out.", elsewhere: "plan" },
  images: { hint: "A PHOTOGRAPH on the site: swapping one for another, adding one, taking one off, or changing which part of it you see.", elsewhere: "images" },
  action: { hint: "The site's primary button — what it says and where it points.", elsewhere: "action" },
  backend: { hint: "What the site STORES — its tables, the rows in them, who may read or add one, and what it refuses.", elsewhere: "backend" },

  three: {
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
    hint: "A part of the page that was BUILT for this site rather than picked from the kit — changing what it does, what it shows, or taking it out.",
    elsewhere: "tsx",
  },

  /* ---- the three whose work is not a stored value ---- */
  kind: { hint: "Whether this is a shopfront that persuades a visitor, or a tool the business works in — changing it makes a different site.", escalate: "build" },
  pages: { hint: "Which pages the site HAS — adding one, taking one away, or moving one to a new address. Not what is ON a page.", verbs: true },
  slug: {
    hint: "THE SITE'S WEB ADDRESS — the word in <name>.gofarther.app. Renaming the site, or giving it a different address.",
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
export function pickTool(fields = LANE_FIELDS) {
  const list = (Array.isArray(fields) ? fields : []).filter((f) => typeof f === "string" && f);
  if (!list.length) throw new Error("pickTool: no fields");
  const lines = list.map((f) => {
    if (!Object.hasOwn(LANES, f)) throw new Error("pickTool: no lane for design field: " + f);
    return "\"" + f + "\" — " + LANES[f].hint;
  });
  return {
    name: "pick_lanes",
    description: "Name which parts of the site this message is asking to change.",
    input_schema: {
      type: "object",
      properties: {
        fields: {
          type: "array",
          minItems: 1,
          maxItems: MAX_LANES,
          items: { type: "string", enum: list },
          description:
            "The part or parts of the site this message asks to change. ONE IS THE ORDINARY ANSWER — several " +
            "things said about one part is still one part: \"make the background yellow and the corners " +
            "rounder\" is `css` alone, and so is \"darker footer, bigger heading\".\n" +
            "NAME A SECOND ONLY WHEN THEY REALLY ASKED FOR A SECOND, SEPARATE THING — \"rename us to Northwind " +
            "and make the tab icon a leaf\" is `brand` and `favicon`. Each name you add is a separate change to " +
            "a separate part of their site, so one added on a guess changes something nobody asked about.\n" +
            "NEVER NAME EVERYTHING. If you cannot tell which part they mean, name the single closest one.\n\n" +
            "The parts:\n" + lines.join("\n"),
        },
        // ── AND, FOR `pages` ALONE, WHICH OF THE THREE ────────────────────
        //
        // "Which pages the site has" is one field and three capabilities, each
        // on a different rung. A lane cannot pick between them from the field
        // name, and guessing is the worst option available: `add` guessed as
        // `remove` deletes a page somebody wanted.
        //
        // OPTIONAL, AND READ FOR ONE LANE. A lane with no verbs ignores it
        // entirely — the same scoping `remove` and `tab` already have one
        // router up, and for the same reason: a flag carried by a lane that
        // cannot act on it is one nothing reads.
        pageVerb: {
          type: "string",
          enum: PAGE_VERBS,
          description:
            "ONLY when `fields` includes \"pages\". Which of the three they are asking for.\n" +
            "\"add\" — a page the site does NOT have yet. \"Can we have a gallery page\", \"add an about page\".\n" +
            "\"remove\" — a page it has, taken off the site. \"Delete the gallery page\", \"we don't need /about any more\".\n" +
            "\"move\" — the same page at a DIFFERENT ADDRESS. \"Move the gallery to /work\", \"/about-us should be /about\".\n" +
            "AN ADDRESS IS NOT A HEADING. \"Call that page Services instead\" is about the WORDS on it and is not this " +
            "field at all — leave `pages` out and let the wording lane have it.\n" +
            "LEAVE THIS OUT IF YOU CANNOT TELL. It is better to be asked again than to delete a page they wanted kept.",
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
      },
      required: ["fields"],
    },
  };
}

const PICK_SYSTEM =
  "You are routing one message inside a website builder. The person you are reading owns the site and has asked " +
  "for a change to it. Your only job is to say WHICH PART of their site the message is about, so the right " +
  "editor can be handed it. You are not making the change and you are not replying to them.\n\n" +
  "Name the fewest parts that cover what they asked for. One is nearly always right.";

/** The routing request. Shaped like `askRequest` in site-ask.mjs, for the same reasons. */
export function pickRequest({ message, fields = LANE_FIELDS, current = "", model = LANE_MODEL }) {
  const tool = pickTool(fields);
  return {
    model,
    max_tokens: LANE_PICK_MAX_TOKENS,
    // A REAL CACHED PREFIX: the tool and the system text are byte-identical on
    // every edit any customer makes, and the message is the only per-call byte.
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: "pick_lanes" },
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: PICK_SYSTEM }],
    // WHAT THE SITE IS, IN ONE LINE, AND ONLY WHEN THE CALLER HAS IT.
    // Deliberately thin — a name and the pages, never the stylesheet. The whole
    // point of this call is that it is small.
    messages: [{ role: "user", content: (current ? current + "\n\n" : "") + "Their message:\n" + String(message || "").slice(0, MAX_MESSAGE) }],
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
  const offered = (Array.isArray(fields) ? fields : []).filter((f) => typeof f === "string" && f);
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = use && use.input && Array.isArray(use.input.fields) ? use.input.fields : [];
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
export async function pickLanes(deps, { message, fields = LANE_FIELDS, current = "", model = LANE_MODEL } = {}) {
  const text = String(message || "").trim();
  // A PAID CALL BEHIND A PUBLIC ROUTE. The composer will not send an empty
  // message; "the client wouldn't do that" is not a gate.
  if (!text) return { fields: [], usage: null, failed: false };
  let reply;
  try {
    reply = await deps.send(pickRequest({ message: text, fields, current, model }));
  } catch (e) {
    // CARRIED, NOT SWALLOWED. The caller tells a billing outage from a busy
    // model by reading `e.status` and `e.detail`.
    return { fields: [], usage: null, failed: true, error: e };
  }
  // THE MODEL THAT WAS ACTUALLY SENT, not the module default. This stamped
  // `LANE_MODEL` while the request carried the caller's `model`, so a customer
  // on Sonnet had their routing call PRICED as the default picker's — the rate
  // column disagreeing with the call it prices. Caught by the per-message
  // billing test, which noticed the bill spanning two models.
  return { fields: readLanes(reply, fields), page: readPageVerb(reply), usage: laneUsage(reply, model), failed: false };
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
export function editTool(field) {
  if (typeof field !== "string" || !Object.hasOwn(LANES, field)) throw new Error("editTool: no lane for: " + field);
  const lane = LANES[field];
  // A LANE THAT DOES NOT ACT HAS NO TOOL, and asking for one is a caller that
  // skipped `laneLayer` — refused here rather than answered with an empty
  // schema the model would fill with something.
  if (lane.elsewhere) throw new Error("editTool: `" + field + "` does not act here — it runs on the " + laneLayer(field) + " layer");
  if (lane.unbuilt) throw new Error("editTool: `" + field + "` does not act here — it needs " + laneUnbuilt(field));
  if (lane.verbs) throw new Error("editTool: `" + field + "` does not act here — its rung depends on the verb");
  if (lane.escalate) throw new Error("editTool: `" + field + "` does not act here — the " + lane.escalate + " rung does this");
  return {
    name: "edit_site",
    description: "Make the one change they asked for to this part of their site.",
    input_schema: {
      type: "object",
      properties: { [field]: { ...lane.shape, description: laneRule(field) } },
      required: [],
    },
  };
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

export function editRequest({ field, message, value, model, note = "" }) {
  const tool = editTool(field);
  return {
    model,
    max_tokens: LANE_EDIT_MAX_TOKENS,
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
      "\n\nWhat they asked for:\n" + String(message || "").slice(0, MAX_MESSAGE) },
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
export async function runLane(deps, { field, message, value, model, note = "" }) {
  let reply;
  try {
    reply = await deps.send(editRequest({ field, message, value, model, note }));
  } catch (e) {
    return { field, value: undefined, usage: null, failed: true, error: e };
  }
  if (reply && reply.stop_reason === "max_tokens") {
    const e = new Error("edit truncated at max_tokens");
    e.truncated = true;
    return { field, value: undefined, usage: laneUsage(reply, model), failed: true, error: e };
  }
  return { field, value: readLaneAnswer(reply, field), usage: laneUsage(reply, model), failed: false };
}
