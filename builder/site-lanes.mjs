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
// ── PURE ACTION: WHY THERE ARE EIGHT TOOLS AND NOT SEVENTEEN ─────────────────
//
// The design tool has 19 properties; 17 of them are things a customer could ask
// to change (the web pair decides whether writing a site's COPY needs a search,
// which is a fact about a build). All 17 are ADDRESSABLE here — the router can
// name any of them, and a message about any of them is understood.
//
// But only EIGHT of them are values the edit path can act on, and the split is
// not a matter of taste. `kind`, `purpose`, `pages`, `components`, `shape`,
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
// So: nine lanes answer "not me, and here is who" for free, and eight lanes act.
// Every one of the eight is a plain string, an enum, or a list of short strings,
// which is why this module can own its own shapes outright and share nothing.
// THAT is what makes two separate paths possible rather than merely stated: the
// values the edit path touches are simple enough to define twice on purpose,
// and the ones that are not are the ones it was never allowed to touch.
//
// ── THE ONE THING STILL HELD TOGETHER, AND IT IS A TRIPWIRE, NOT A COUPLING ──
//
// The seventeen NAMES are asserted against the design tool's own properties, in
// both directions, by `test/edit-lanes.test.mjs`. A field added to the build
// tomorrow with no lane here is a part of a site the customer can never change
// again, and a lane here for a field the build no longer produces is a lane that
// edits nothing. Neither announces itself. Names only — never a description and
// never a shape, because those are precisely what the two paths are separate
// about.

import { PLAN_KEYS } from "./site-plan.mjs";
import { THEME_SHORTLIST } from "./site-theme-registry.mjs";

/** Haiku. Naming which part of a site a sentence is about is routing, not work. */
export const LANE_MODEL = "claude-haiku-4-5";

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
 * WHERE A LANE THAT CANNOT ACT SENDS THE CUSTOMER.
 *
 * A reason, not a refusal. Every one of these is a real request that a real rung
 * can do — the point is that it is not THIS rung, and saying so at the door
 * costs nothing where discovering it after a model call costs a call.
 *
 * `plan` is derived from `PLAN_KEYS` rather than listed, so a seventh plan axis
 * lands here by existing. It read `kind`/`purpose` as two literal names once and
 * five more arrived without it; that is this repo's "two lists of the same
 * thing" trap, and the direction it fails in is a lane silently pretending.
 */
export const LANE_ELSEWHERE = {
  plan: "page",
  backend: "rules",
  slug: "move",
};

/**
 * ── PLACEHOLDER WORDING (owner, 2026-08-29: "i will tell you the prompt
 * later"). Every `hint` and every `edit` string below is the edit path's own and
 * is written to be replaced. They are honest today: each says what the field is
 * and what changing it means, in the words an owner of a live site would use.
 * Nothing else in this repo reads them, so replacing a value here is the whole
 * change when the owner's wording lands. ──
 *
 * `hint` — one line, for the router: how a customer's sentence points here.
 * `edit` — the acting tool's own description: what this value is and what
 *          answering it does. Written for CHANGING, never for inventing.
 * `shape` — this path's own. Not borrowed and not derived; see the header.
 */
const LANES = {
  /* ---- the eight that act ---- */
  css: {
    hint: "THE STYLESHEET — any change to how something LOOKS that is not a change of theme: a colour, a size, spacing, corners, a typeface, one control, one section, dark or light. The ordinary answer for a look change.",
    shape: { type: "string" },
    edit:
      "The site's stylesheet, as it should be after their change.\n" +
      "THE WHOLE LOOK IS HERE AND ALL OF IT IS YOURS TO EDIT. Any element, any component, any state, any one " +
      "page — whatever they asked to look different, write the rule that does it. You are not limited to what " +
      "the theme offers and nothing on the page is out of reach.\n" +
      "AS MANY EDITS AS THERE WERE ASKS, AND NEVER MORE. One ask is one edit; three asks are three. Everything " +
      "else comes back exactly as it was given to you, byte for byte.\n" +
      "AND EACH ONE ONLY AS WIDE AS IT WAS ASKED. A change to one control is a rule for that control. A new " +
      "value for a token is not — every component reading that token repaints, so a request about one button " +
      "becomes a different-looking site. Reach for a token only when what they named really is the whole site.\n" +
      "NOTHING THEY DID NOT ASK FOR MOVES — not a spacing you would have set differently, not a colour you " +
      "think sits better beside the new one. Taste nobody asked for reads as the site changing on its own.",
  },
  theme: {
    hint: "The site's whole visual world, picked by name — broadsheet, bakery, apothecary, noir. Asking for a DIFFERENT LOOK ENTIRELY is this; asking for one colour or one control to change is `css`.",
    shape: { type: "string", enum: THEME_SHORTLIST },
    edit:
      "The theme the site should wear instead, by name.\n" +
      "THIS REPLACES THE SITE'S ENTIRE VISUAL WORLD — palette, typefaces, corners, shadows, spacing — so answer " +
      "it only when they have asked for the whole site to feel different. \"Make it feel like a newspaper\", " +
      "\"something warmer\", \"put it on black\" said of the site as a whole.\n" +
      "A REQUEST ABOUT ONE COLOUR OR ONE CONTROL IS NOT THIS. Leave it out and something else handles it; " +
      "answering here would repaint every page to change one button.",
  },
  brand: {
    hint: "The site's NAME — what the business is called, as it appears in the header, the browser tab and a shared link.",
    shape: { type: "string" },
    edit:
      "The name the business should be called instead, exactly as they wrote it.\n" +
      "THE NAME IS THEIRS AND YOU ARE COPYING IT, NOT CHOOSING IT. If they said what to call it, that, verbatim " +
      "— capitals, punctuation and all. Do not tidy it, shorten it, or improve on it.\n" +
      "This changes the header, the browser tab, the link preview and every heading that says the old name.",
  },
  description: {
    hint: "The one-line summary under the name in a Google result or a shared-link preview.",
    shape: { type: "string" },
    edit:
      "The site's one-sentence description, as it should read after their change.\n" +
      "One sentence, written for a customer rather than a developer: what the business is, who it serves, and " +
      "where. It is what shows under the name in a search result and beside a shared link.\n" +
      "KEEP WHAT THEY DID NOT ASK YOU TO CHANGE. If they gave you a new address, the rest of the sentence " +
      "stays as it is.",
  },
  wordmark: {
    hint: "The logo in the header — the business name set in type, or a drawn mark.",
    shape: { type: "string" },
    edit:
      "The header logo: answer the single word `text`, or draw one as a complete SVG document.\n" +
      "`text` MEANS THE BUSINESS NAME SET IN THE HEADER'S OWN TYPE, and it is a full answer rather than a " +
      "shrug — it is the right one for most small businesses and it is what \"just use our name\" means.\n" +
      "To draw one, answer one complete `<svg>` document with a viewBox: flat shapes and letterforms, no " +
      "photographs, no gradients, sized to be read at the height of a header.\n" +
      "A LOGO THEY ATTACHED AS A FILE IS NOT THIS. That is their own artwork and something else places it.",
  },
  favicon: {
    hint: "The TAB ICON — the small mark in the browser tab and on a bookmark.",
    shape: { type: "string" },
    edit:
      "The site's tab icon, drawn by you as one complete SVG document.\n" +
      "A FLAT MARK, NOT A PICTURE: one simple shape or letterform, two or three colours at most, bold enough " +
      "to read at 16 pixels. Give it a viewBox and draw to fill it.\n" +
      "It is the mark in the browser tab, on a bookmark and on a phone's home screen — nothing on the page " +
      "itself changes.",
  },
  lang: {
    hint: "The language the site's pages are declared to be written in.",
    shape: { type: "string" },
    edit:
      "The language the site's pages are written in, as a BCP-47 tag — `es`, `fr`, `pt-BR`, `de`.\n" +
      "THIS IS A DECLARATION, NOT A TRANSLATION. It tells a browser and a search engine what language the " +
      "words on the page already are; it does not rewrite them. \"This site is in Spanish, stop telling people " +
      "it's English\" is this. \"Translate the site into Spanish\" is not, and answering here would leave the " +
      "site claiming a language its own pages are not in.",
  },
  langs: {
    hint: "The other languages the site is also offered in.",
    shape: { type: "array", items: { type: "string" }, maxItems: 12 },
    edit:
      "Every language the site is ALSO offered in, beyond the one its pages are written in, as BCP-47 tags — " +
      "`[\"es\"]`, `[\"cy\", \"ga\"]`.\n" +
      "THE WHOLE LIST, NOT THE ADDITION. This replaces what is stored, so send the languages they should have " +
      "after the change: adding Welsh to a site already offered in Spanish is `[\"es\", \"cy\"]`, and answering " +
      "`[\"cy\"]` would take Spanish away.\n" +
      "Send an empty list to say it is offered in one language only.",
  },

  /* ---- the nine that answer for free ---- */
  kind: { hint: "Whether this is a shopfront that persuades a visitor, or a tool the business works in.", elsewhere: "plan" },
  purpose: { hint: "What the page is organised around — what it leads with and what everything else supports.", elsewhere: "plan" },
  pages: { hint: "Which pages the site has and what each one is for.", elsewhere: "plan" },
  components: { hint: "Which building blocks the page is made of — the manifest it is written from.", elsewhere: "plan" },
  shape: { hint: "Where the sections go on the page and in what order.", elsewhere: "plan" },
  images: { hint: "Which photographs the site has, and what they are of.", elsewhere: "plan" },
  action: { hint: "The site's primary button — the one thing it most wants done, in the words the button says.", elsewhere: "plan" },
  backend: { hint: "What the site STORES — its tables, the rows in them, and anything that acts on them.", elsewhere: "backend" },
  slug: { hint: "The site's web address — the word in <name>.gofarther.app.", elsewhere: "slug" },
};

/** Every lane, in one order, and it is the order they RUN in — see `readLanes`. */
export const LANE_FIELDS = Object.keys(LANES);

/** The eight that act. Derived, so a lane cannot be acting-but-unreachable. */
export const ACTING_LANES = LANE_FIELDS.filter((f) => !LANES[f].elsewhere);

/**
 * Where a non-acting lane sends the customer, or `null` for one that acts.
 *
 * `Object.hasOwn`, never truthiness: `LANES["constructor"]` is a function and
 * would sail through a `!LANES[f]` check. Shipped once already in the Stripe
 * plan lookup and nearly again three times since.
 */
export function laneElsewhere(field) {
  if (typeof field !== "string" || !Object.hasOwn(LANES, field)) return null;
  const key = LANES[field].elsewhere;
  return key ? LANE_ELSEWHERE[key] || null : null;
}

/**
 * THE PLAN LANES ARE `PLAN_KEYS`, ASSERTED HERE RATHER THAN HOPED FOR.
 *
 * Both directions, at module load, because the failure is silent in both: a plan
 * axis with no `elsewhere` becomes a lane that stores a value nothing reads and
 * reports success, and an `elsewhere: "plan"` on a field that stopped being a
 * plan axis is a change refused for a reason that expired. This repo's record is
 * that a rule true because of a layer below it expires when that layer moves and
 * nothing announces it — so this announces it, loudly, at the earliest moment.
 */
const planLanes = LANE_FIELDS.filter((f) => LANES[f].elsewhere === "plan");
for (const k of PLAN_KEYS) {
  if (!planLanes.includes(k)) throw new Error("site-lanes: `" + k + "` is a plan axis with no plan lane");
}
for (const k of planLanes) {
  if (!PLAN_KEYS.includes(k)) throw new Error("site-lanes: `" + k + "` is sent to the page rung but is not a plan axis");
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
export function pickRequest({ message, fields = LANE_FIELDS, current = "" }) {
  const tool = pickTool(fields);
  return {
    model: LANE_MODEL,
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
export async function pickLanes(deps, { message, fields = LANE_FIELDS, current = "" } = {}) {
  const text = String(message || "").trim();
  // A PAID CALL BEHIND A PUBLIC ROUTE. The composer will not send an empty
  // message; "the client wouldn't do that" is not a gate.
  if (!text) return { fields: [], usage: null, failed: false };
  let reply;
  try {
    reply = await deps.send(pickRequest({ message: text, fields, current }));
  } catch (e) {
    // CARRIED, NOT SWALLOWED. The caller tells a billing outage from a busy
    // model by reading `e.status` and `e.detail`.
    return { fields: [], usage: null, failed: true, error: e };
  }
  return { fields: readLanes(reply, fields), usage: laneUsage(reply, LANE_MODEL), failed: false };
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
  // skipped `laneElsewhere` — refused here rather than answered with an empty
  // schema the model would fill with something.
  if (lane.elsewhere) throw new Error("editTool: `" + field + "` does not act — it belongs to the " + laneElsewhere(field) + " rung");
  return {
    name: "edit_site",
    description: "Make the one change they asked for to this part of their site.",
    input_schema: {
      type: "object",
      properties: { [field]: { ...lane.shape, description: lane.edit } },
      required: [],
    },
  };
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
