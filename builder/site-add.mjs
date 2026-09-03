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
// 93,852-character tool, the build's system text — anchored on the stored look,
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
import { TABLE_ITEM, FUNCTION_ITEM, API_ITEM, JOB_ITEM } from "./site-table.mjs";
import { routeOf } from "./site-addon.mjs";
// THE QR LIST (2026-09-03): a site carries several, each named, so the `qr`
// kind ADDS one beside the others and refuses only a duplicate.
import { qrList, qrName, readQrText, MAX_QRS } from "./site-qr-list.mjs";
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
  "second design beside the first — the addition should read as if it had been there since the build.";

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

/** A page is at most this many bands, top to bottom. */
export const MAX_SECTIONS = 12;

/** Seed rows an add may plant in a new table — the engine's own ceiling. */
export const MAX_ADD_SEED_ROWS = 12;

/** The kinds whose answer is a LIST of additions rather than one. */
export const LIST_ADDS = ["table", "function", "api", "job", "page", "component"];

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
    hint: "Something the site has to STORE that it has no table for — bookings, orders, enquiries, listings, members' things, a price list the owner edits. A form that SENDS somewhere needs one; a page that only shows words does not.",
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
        },
        required: ["table"],
      },
    },
    add: {
      is: "The tables this change needs — each with what it is called, its columns, who may read and write it, and the guarantees the database keeps for it. One entry per table.",
      yours:
        "EVERY TABLE IS YOURS TO DESIGN: its columns, its access, a unique slot, a confirmation email, " +
        "payment, a public view — every guarantee the shape offers is available, and you may ALSO name a " +
        "table the site already has to give it a new column, PAYMENT or a public view. On a table that " +
        "already exists only those three are taken; its access, read and write levels are the site's own and " +
        "an answer for them is discarded.",
      wide:
        "AS MANY TABLES AS THE THINGS THEY NAMED TO STORE, AND NOT ONE MORE. \"Add a booking form\" is a " +
        "bookings table; \"bookings and a waiting list\" is two. Not bookings plus services plus customers " +
        "plus staff to round it off. Do not redesign what the site already stores: the tables it has are " +
        "listed, and a second table for a thing one of them already holds is a site that disagrees with itself.",
      keep:
        "NOTHING ELSE ABOUT THE SITE MOVES. This is the tables and their rows; the pages that show them are " +
        "designed beside them and written by the next step. If the change needs no table — it is words, a " +
        "component, a code — answer nothing here.",
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
        "no arguments and returns json: an array of {to, subject, body}, empty when nothing is due. A job's " +
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
        "arguments and returning json — an array of {to, subject, body}, empty when nothing is due; or, for a " +
        "job that does work rather than sending (clearing out old rows), {\"did\": \"what it did\"}.",
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
    hint: "A NEW COMPONENT on a page the site already has — what a customer calls a section, a band or a block: testimonials, a form, a map, an FAQ, opening hours, a price list, a gallery strip, a countdown. From the kit, or written for this site when the kit has not got it. The page existing does not make it an edit; the component is not on it yet.",
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
  },
  /* ---- the one that acts on another rung ---- */
  photo: {
    hint: "A PHOTOGRAPH on a page that has none, or one more where there are some — adding a picture. Swapping or reframing one the site has is an edit, not this.",
    elsewhere: "picture",
  },
};

/** Every kind, in one order, and it is the order they RUN in — see `readAdds`. */
export const ADD_KINDS = Object.keys(ADDS);

/** The kinds this module designs itself. Derived, so a kind cannot be acting-but-unreachable. */
export const OWN_ADDS = ADD_KINDS.filter((k) => !ADDS[k].elsewhere);

/** The kinds whose work lives on an edit rung. */
export const DISPATCHED_ADDS = ADD_KINDS.filter((k) => ADDS[k].elsewhere);

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

// THE TWO GROUPS ARE A TOTAL PARTITION, checked at load: a kind in neither
// answers nothing and dispatches nowhere, which is a request that vanishes.
for (const k of ADD_KINDS) {
  if (ADDS[k].elsewhere && !addLayer(k)) throw new Error("site-add: `" + k + "` dispatches nowhere");
  if (!ADDS[k].elsewhere && (!ADDS[k].shape || !ADDS[k].add)) throw new Error("site-add: `" + k + "` neither acts here nor dispatches");
  if (!ADDS[k].hint) throw new Error("site-add: `" + k + "` has no hint for the picker");
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
  "Name every kind they asked for and none they did not. One is the ordinary answer.";

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
    messages: [{ role: "user", content: (current ? current + "\n\n" : "") + "Their message:\n" + String(message || "").slice(0, MAX_MESSAGE) }],
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
  if (add.elsewhere) throw new Error("addTool: `" + kind + "` does not act here — it runs on the " + addLayer(kind) + " layer");
  return {
    name: "add_to_site",
    description: "Design the one thing they asked to add to their site.",
    input_schema: {
      type: "object",
      properties: { [kind]: { ...add.shape, description: addRule(kind) } },
      required: [],
    },
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
  const tables = (Array.isArray(s.tables) ? s.tables : []).filter((t) => typeof t === "string" && t.trim()).slice(0, 24)
    .map((t) => {
      const c = (Array.isArray(cols[t]) ? cols[t] : []).filter((x) => typeof x === "string" && x.trim()).slice(0, 40);
      return c.length ? t + " (" + c.join(", ") + ")" : t;
    });
  // A SITE WITH NO DATABASE IS SAID IN AS MANY WORDS, and what it means is said
  // too: a table designed for it is refused by name, so the model should not
  // reach for one where a section would do.
  // A SITE WITH NO DATABASE GETS ONE ON FIRST TOUCH (owner, 2026-09-03): the
  // first table, function, connection or job designed for it is what makes
  // it, so the note says so instead of refusing — the old sentence ("a table
  // cannot be added to it in this step") was the wall this step no longer has.
  lines.push(s.hasDatabase
    ? (tables.length ? "It stores: " + tables.join(", ") + "." : "It has a database with no tables yet.")
    : "It has NO database yet: nothing on it is stored. The first table, function, outside connection or scheduled job you design for it creates one.");
  // AND THE REST OF ITS BACKEND BY NAME (2026-09-03), so a designer adding a
  // function, a connection or a job names a new one and a job can name a
  // function the site has.
  const namesOf = (k) => (Array.isArray(s[k]) ? s[k] : []).filter((x) => typeof x === "string" && x.trim()).slice(0, 24);
  const fns = namesOf("functions"), apis = namesOf("apis"), jobs = namesOf("jobs"), jobFns = namesOf("jobFns");
  if (fns.length) lines.push("Its database functions are: " + fns.join(", ") + ".");
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
  const parts = (Array.isArray(s.tsx) ? s.tsx : []).map((t) => (t && typeof t === "object" ? str(t.name, 60) : "")).filter(Boolean);
  if (parts.length) has.push("parts written for it: " + parts.join(", "));
  if (has.length) lines.push("It already carries " + has.join("; ") + ".");
  return lines.join("\n");
}

export function addRequest({ kind, message, site, model }) {
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
      "\n\nWhat they asked to add:\n" + String(message || "").slice(0, MAX_MESSAGE) },
    ],
  };
}

/**
 * What the kind answered — its designed object, or `undefined` for nothing.
 *
 * `undefined` AND `null` ARE BOTH NOTHING. A kind that declines is the ordinary
 * shape here: the picker named it and the model found the message was not
 * really asking for one of these.
 */
export function readAddAnswer(reply, kind) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const v = use && use.input && typeof use.input === "object" ? use.input[kind] : undefined;
  return v === null ? undefined : v;
}

/**
 * Run one add. One call, `send` injected, no folding and no publishing.
 *
 * TRUNCATION IS NAMED, not returned as a half-designed page — the same check
 * the design and pages calls make.
 */
export async function runAdd(deps, { kind, message, site, model }) {
  let reply;
  try {
    reply = await deps.send(addRequest({ kind, message, site, model }));
  } catch (e) {
    return { kind, value: undefined, usage: null, failed: true, error: e };
  }
  if (reply && reply.stop_reason === "max_tokens") {
    const e = new Error("add truncated at max_tokens");
    e.truncated = true;
    return { kind, value: undefined, usage: addUsage(reply, model), failed: true, error: e };
  }
  // THE RAW REPLY RIDES OUT TOO (run 28, 2026-09-03): three live declines in a
  // row and nothing anywhere recorded what the model had said — the answer
  // existed only in a Worker's memory, run 90's shape again. The route keeps
  // it for the owner to read; this function only hands it up.
  return { kind, value: readAddAnswer(reply, kind), usage: addUsage(reply, model), failed: false, raw: reply };
}

/* --------------------------------------------------------- what came back */

/** A route as the tool is told to write it: "/", "/gallery", "/about/team". */
const ROUTE = /^\/(?:[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)?$/;

/** A kit or part name: kebab-case. */
const NAME = /^[a-z][a-z0-9-]*$/;

/** A table name, as the engine wants it. */
const TABLE_NAME = /^[a-z][a-z0-9_]{0,62}$/;

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
/** The hand-written parts an answer declares, in the shared item's shape. */
const parts = (v) => {
  const out = [];
  for (const x of Array.isArray(v) ? v : []) {
    if (!x || typeof x !== "object") continue;
    const name = str(x.name, 60).toLowerCase();
    const does = str(x.does, 600);
    const props = str(x.props, 400);
    if (!NAME.test(name) || !does || !props || out.some((p) => p.name === name)) continue;
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
  if (typeof kind !== "string" || !Object.hasOwn(ADDS, kind) || ADDS[kind].elsewhere) return { ok: false, why: "no-kind" };
  // WHICH PAGE, for the kinds that land on one. Refused on a multi-page site
  // when the route is not one of its own; resolved to the one page otherwise.
  const onPage = (named) => {
    const r = route(named);
    if (r && have.includes(r)) return r;
    if (have.length === 1) return have[0];
    if (!r && have.includes("/")) return "/";
    return "";
  };
  // ONE ITEM, cleaned. `{ ok, value }` or `{ ok: false, why }`.
  const one = (v, ctx) => {
    switch (kind) {
      case "page": {
        const path = route(v.path);
        if (!path || path === "/") return { ok: false, why: "no-path" };
        // A PAGE THE SITE HAS, OR ONE THIS SAME ANSWER ALREADY ADDED.
        if (have.includes(path) || ctx.paths.includes(path)) return { ok: false, why: "page-exists" };
        const name = str(v.name, 60);
        const purpose = str(v.purpose, 300);
        if (!name || !purpose) return { ok: false, why: "no-plan" };
        const sections = lines(v.sections, MAX_SECTIONS, 200);
        const components = names(v.components, MAX_COMPONENTS);
        if (!sections.length && !components.length) return { ok: false, why: "no-plan" };
        ctx.paths.push(path);
        return { ok: true, value: { path, file: fileOfRoute(path), name, purpose, sections, components, tsx: parts(v.tsx), link: str(v.link, 200) } };
      }
      case "component": {
        const page = onPage(v.page);
        if (!page) return { ok: false, why: "no-page" };
        const does = str(v.does, 300);
        if (!does) return { ok: false, why: "no-plan" };
        const components = names(v.components, MAX_COMPONENTS);
        const tsx = parts(v.tsx);
        // THE COMPONENT IS THE ADDITION: an answer that names none — no kit
        // part and nothing written for this site — is a band the page writer
        // would have to invent, which is the old "section" reading the owner
        // corrected. Refused by name.
        if (!components.length && !tsx.length) return { ok: false, why: "no-component" };
        return { ok: true, value: { page, where: str(v.where, 200), does, components, tsx } };
      }
      case "table": {
        const t = v.table && typeof v.table === "object" && !Array.isArray(v.table) ? v.table : null;
        const name = t ? str(t.name, 63).toLowerCase() : "";
        if (!t || !TABLE_NAME.test(name)) return { ok: false, why: "no-table" };
        if (ctx.tables.includes(name)) return { ok: false, why: "no-table" };
        const columns = Array.isArray(t.columns) ? t.columns.filter((c) => c && typeof c === "object" && str(c.name, 63)) : [];
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
        const name = str(v.name, 63).toLowerCase();
        if (!TABLE_NAME.test(name) || ctx.functions.includes(name)) return { ok: false, why: "no-function" };
        const body = str(v.body, 8000);
        const returns = str(v.returns, 80);
        if (!body || !returns) return { ok: false, why: "no-function" };
        const args = (Array.isArray(v.args) ? v.args : [])
          .filter((a) => a && typeof a === "object" && TABLE_NAME.test(str(a.name, 63).toLowerCase()) && str(a.type, 20))
          .map((a) => ({ name: str(a.name, 63).toLowerCase(), type: str(a.type, 20) }));
        const exists = (Array.isArray(s.functions) ? s.functions : []).map((x) => str(x, 63).toLowerCase()).includes(name);
        ctx.functions.push(name);
        return { ok: true, value: { name, args, returns, body, internal: v.internal === true, exists } };
      }
      case "api": {
        const name = str(v.name, 63).toLowerCase();
        if (!TABLE_NAME.test(name) || ctx.apis.includes(name)) return { ok: false, why: "no-api" };
        const url = str(v.url, 2000);
        if (!/^https:\/\/[^\s/]+/i.test(url)) return { ok: false, why: "bad-url" };
        const method = str(v.method, 4).toUpperCase() === "POST" ? "POST" : "GET";
        const headers = v.headers && typeof v.headers === "object" && !Array.isArray(v.headers)
          ? Object.fromEntries(Object.entries(v.headers).filter(([k, x]) => typeof k === "string" && typeof x === "string").slice(0, 12)) : undefined;
        const params = (Array.isArray(v.params) ? v.params : []).filter((p) => typeof p === "string" && TABLE_NAME.test(p)).slice(0, 12);
        const cacheSeconds = Number.isFinite(Number(v.cacheSeconds)) ? Math.max(0, Math.min(3600, Math.round(Number(v.cacheSeconds)))) : undefined;
        const exists = (Array.isArray(s.apis) ? s.apis : []).map((x) => str(x, 63).toLowerCase()).includes(name);
        ctx.apis.push(name);
        return { ok: true, value: { name, url, method, ...(headers ? { headers } : {}), ...(method === "POST" && str(v.body, 4000) ? { body: str(v.body, 4000) } : {}), params, ...(cacheSeconds !== undefined ? { cacheSeconds } : {}), exists } };
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
        const every = Number.isFinite(Number(v.everyMinutes)) ? Math.max(MIN_JOB_MINUTES, Math.round(Number(v.everyMinutes))) : MIN_JOB_MINUTES;
        // A CLOCK TIME (owner, 2026-09-03) belongs to a daily-or-slower job
        // and is refused by name otherwise — the engine would drop the time
        // and keep the interval, which is a job that runs at the wrong hour
        // reported as the one they asked for. The zone is stamped by the
        // route from the owner's browser; this module never knows it.
        const at = str(v.at, 5);
        if (at && (!AT_RE.test(at) || every < 1440)) return { ok: false, why: "bad-time" };
        const exists = (Array.isArray(s.jobs) ? s.jobs : []).map((x) => str(x, 63).toLowerCase()).includes(name);
        ctx.jobs.push(name);
        return { ok: true, value: { name, fn, everyMinutes: every, ...(at ? { at } : {}), exists } };
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
        if (points.startsWith("/")) {
          const own = route(points);
          if (!own || !have.includes(own)) return { ok: false, why: "no-such-page" };
          const base = siteAddress(s.url);
          if (!base) return { ok: false, why: "no-address" };
          points = new URL(own, base).href;
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
        return { ok: true, value: { name, points, label, page: onPage(v.page), where: str(v.where, 200) } };
      }
      case "three": {
        const scene = str(v.scene, 600);
        if (!scene) return { ok: false, why: "no-scene" };
        return { ok: true, value: { scene, page: onPage(v.page) } };
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
      : MAX_ADD_COMPONENTS;
    const raw = Array.isArray(value) ? value : (isObj(value) ? [value] : []);
    const items = raw.filter(isObj).slice(0, cap);
    if (!items.length) return { ok: false, why: "nothing" };
    const ctx = { paths: [], tables: [], functions: [], apis: [], jobs: [] };
    const kept = [], skipped = [];
    for (const v of items) {
      const r = one(v, ctx);
      if (r.ok) kept.push(r.value);
      else skipped.push({ why: r.why, name: str(v.path, 120) || str(v.name, 120) || (isObj(v.table) ? str(v.table.name, 63) : "") || str(v.does, 80) });
    }
    if (!kept.length) return { ok: false, why: skipped[0].why, skipped };
    return { ok: true, value: kept, skipped };
  }
  const v = isObj(value) ? value : null;
  if (!v) return { ok: false, why: "nothing" };
  return one(v, { paths: [], tables: [] });
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
    case "no-job": return "I couldn't tell what should happen on a timer — say what to send, to whom, and how often.";
    case "no-job-fn": return "That scheduled job names a function this site doesn't have — describe what it should send and I'll write both together.";
    case "bad-time": return "A time of day only fits a job that runs once a day or less often — say how often it should run, or drop the time and it runs on the interval. Nothing was changed.";
    case "no-destination": return "A QR code needs a real destination — a link, a phone number, a wifi network — and that wasn't in the message. Nothing was changed.";
    case "bad-destination": return "A QR code can carry a link, a phone number, an email address, a wifi network or plain text — not that. Nothing was changed.";
    case "no-such-page": return "That code would open a page this site doesn't have. Name one of its pages, or a link, a number or an address — nothing was changed.";
    case "no-address": return "I couldn't read this site's own address just now, so a code opening one of its pages can't be made yet — try again in a moment. Nothing was changed.";
    case "no-name": return "I couldn't give that QR code a name — say what it is for in a word or two, like \"wifi\" or \"booking\".";
    case "same-name": return "This site already has a QR code with that name — ask me to change it, or give the new one a different name.";
    case "same-code": return "This site already has a QR code pointing there — ask me to change where it sits or what it says instead.";
    case "too-many": return "This site already carries as many QR codes as it can — ask me to change one of them instead.";
    case "no-scene": return "I couldn't tell what the 3D scene should show — say what it is and where it goes.";
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
  const list = Array.isArray(answers) ? answers.filter((a) => a && typeof a === "object" && a.kind && a.value) : [];
  const designed = {};
  const components = [];
  const blocks = [];
  const files = [];
  const tsx = (Array.isArray(prior.tsx) ? prior.tsx : []).filter((t) => t && typeof t === "object" && typeof t.name === "string").map((t) => ({ ...t }));
  const tables = [];
  const seed = {};
  const functions = [], apis = [], jobs = [];
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
    if (a.kind === "table" && v.table) {
      tables.push(v.table);
      if (Array.isArray(v.seed) && v.seed.length) seed[v.table.name] = v.seed;
    }
    // THE OTHER THREE TIERS (2026-09-03) fold as name-keyed lists, exactly as
    // `mergeAddonSchema` carries them: only what was named, so the engine
    // replaces those by name and keeps every other one the site has.
    if (a.kind === "function" && v.name) functions.push({ name: v.name, args: v.args, returns: v.returns, body: v.body, internal: v.internal === true });
    if (a.kind === "api" && v.name) {
      const { exists, ...api } = v;
      apis.push(api);
    }
    if (a.kind === "job" && v.name) jobs.push({ name: v.name, fn: v.fn, everyMinutes: v.everyMinutes, ...(v.at ? { at: v.at, ...(v.tz ? { tz: v.tz } : {}) } : {}) });
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
  return { designed, components, directive: blocks.filter(Boolean).join("\n\n"), files };
}
