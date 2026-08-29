// An edit changes exactly what was asked for, and nothing else.
//
// THE OWNER'S RULE (2026-08-10), and it resolves two defects that are mirror
// images of each other. Measured on the live route before this existed:
//
//   `brand` and `description` moved when NOBODY asked. Neither had a prior
//   anchor — `(designed && designed.brand) || body.brand || slug` — and the
//   client sends no brand on a revise, so a designer that had seen only the
//   words "fix the typo in the header" decided what the site was called. It
//   became the <title>, the og:title and the og:description, while the PAGES
//   kept the real name (a revise hands them back as byte-identical edits). So
//   the tab and the link preview disagreed with the page.
//
//   `theme`, `family`, `structure` and `fonts` could NOT move even when asked.
//   They were hard-anchored to the stored look on 2026-08-08 to stop "make the
//   background yellow" re-rolling a barber shop into a different site — a real
//   fix that removed the capability rather than bounding it, so "make it look
//   like a newspaper" did nothing at all to a live site.
//
// ABSENT MEANS UNCHANGED, AND NEVER "RESTATE WHAT YOU ARE KEEPING". That is the
// load-bearing decision. A model asked to return the same value unless told
// otherwise will eventually return a slightly different one, and nothing
// notices — which is exactly how the look re-rolled in the first place.
// Omission cannot drift, because there is no value to get subtly wrong. It is
// also cheaper: a one-colour edit returns one field instead of a whole design.
// `tables` and `tokens` already worked this way, and they were the only two
// layers that behaved correctly on an edit.
//
// Plain module with no I/O, like `site-ask.mjs` and `publish-pages.mjs`, so the
// whole decision is tested without a Worker, a model or a database.

import { PLAN_EDIT_FIELDS } from "./site-plan.mjs";
import { normalizeSeeds, SEEDS_FIELD } from "./site-seeds.mjs";
import { resolveTheme } from "./site-theme-registry.mjs";
import { cleanFavicon, readWordmark } from "./site-favicon.mjs";

/**
 * The look/identity fields an edit may move. `tables` and `tokens` merge on their own paths.
 *
 * THE SIX PLAN AXES ARE SPREAD IN RATHER THAN LISTED, so a seventh added to
 * `site-plan.mjs` becomes editable without anybody remembering this file — the
 * failure that left `teamScope` dead at five separate layers. `structure` comes
 * from there now; it used to be written here by hand.
 *
 * EACH AXIS IS ITS OWN FIELD, deliberately, rather than one nested `plan`
 * object. `mergeLook` replaces a field whole, so a single object would mean a
 * revise that changes only the page list has to hand back the purpose, the
 * shape, the verb and the component list unchanged — which is exactly the
 * "restate what you are keeping" habit this module exists to remove, and a model
 * asked to restate a value will eventually restate it slightly differently.
 * Per-axis, omission still means unchanged for the five nobody mentioned.
 *
 * `family` STAYS, AND IT IS NO LONGER IN THE TOOL. Nothing can set it any more —
 * the six authored fields replaced it on 2026-08-20 — but every site built
 * before that has one stored, and `mergeLook` rebuilds its output from this list
 * alone. Drop the name and the next revise of an existing site silently discards
 * the only record of what its layout was, taking the fallback with it.
 */
// `theme` IS A NAME AGAIN (2026-08-27, owner's call — the 500 themes are the
// base of every build, the model's free `css` is the on-request layer). It was
// a registry name until 2026-08-20, an authored `seeds` palette through the
// free-CSS era, and it returns as the name the tool's enum compels. The old
// rule that a site cannot wear a name and a palette at once still decides the
// PRECEDENCE: the container renders the theme and nothing sends seeds any more,
// so the stored seeds on 2026-08-20-era sites are inert history, kept below
// only so the merge does not destroy the record.
//
// ── `seeds` AND `fonts` STAY HERE THOUGH THE TOOL NO LONGER ASKS FOR EITHER ──
//
// Both came off `design_schema` on 2026-08-23 when five look fields became one
// `css` string, and both are DELIBERATELY still on this list, for exactly the
// reason `family` is one line up: `mergeLook` rebuilds its output from this
// array alone, so a name dropped here is a value silently discarded on an
// existing site's next unrelated edit. Every site built between 2026-08-20 and
// then stores three anchor colours and a typeface pairing, and both publish
// spines still send them — so removing either name would strip the palette off
// a live site because its owner fixed a typo.
//
// `css` IS NOT ON THIS LIST, and that is not an oversight. It has its own
// `_meta` key for the reason `site_tokens`, `site_style` and `site_logo` do:
// `mergeLook` keeps only what is named here and drops everything else stored on
// the object, so a stylesheet folded into `site_look` would be lost the first
// time an edit moved a plan axis.
// `favicon` IS THE DESIGNER'S OWN SVG MARK (2026-08-28, owner's call — "in the
// design step, lets add a svg step, for the favicon"). On this list so the
// merge carries it the way it carries the theme: absent means unchanged, and a
// revise about a phone number cannot take a drawn mark off a site. Judged by
// `FIELD_KEEPS.favicon` below, so a junk answer can never replace a good one.
// …and `wordmark` beside it (same day, same call — "for the logo, either do
// the text or an svg logo"): the header logo as the designer's own choice,
// `text` or a drawn SVG, judged by `FIELD_KEEPS.wordmark`.
//
// ── `behavior` AND `three` (2026-08-29) — AND `three` IS A BUG BEING FIXED ────
//
// `behavior` is what each interactive thing on the page DOES (owner: "update
// only the frontend design step to plan behavior"). Nothing generates from it
// yet, by the owner's explicit call — which makes being on THIS list the entire
// point rather than an afterthought: the step decides and RECORDS, and a record
// that `mergeLook` drops is not a record.
//
// `three` was added the day before and NOT put here, which is the same own-goal
// this file has now watched three times. It is the repo's wiring trap in its
// purest form: `design_schema` asked for a 3D scene on every build, the model
// answered one, and `mergeLook` — which rebuilds from this array ALONE — threw
// it away before anything could store or read it. Nothing failed, nothing
// logged, and from outside "the model declined to design a scene" and "we
// dropped the answer" are one indistinguishable `undefined`. Listing it here
// makes the answer survive; it does NOT yet make a canvas appear on a page, and
// that second hop (the page writer is handed the plan, and `three` is not a plan
// key) is still missing and is named in CLAUDE.md's backlog.
export const EDIT_FIELDS = ["brand", "description", "theme", "wordmark", "favicon", "seeds", "family", ...PLAN_EDIT_FIELDS, "fonts", "lang", "langs", "behavior", "three"];

/**
 * Nothing is required of an EDIT.
 *
 * The build tool requires brand/slug/tables/seed/description/theme/family, which
 * is right for a first build and is the direct opposite of what an edit needs:
 * a required field is one the model must answer, and answering it is what moves
 * a value nobody asked to move. Sent as the tool's `required` on an edit only,
 * so a first build is byte-identical to what it has always sent.
 */
export const EDIT_REQUIRED = [];

const str = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * WHAT THE SITE IS NOW, in the user message.
 *
 * The designer was never told an edit was an edit — `brief = body.instruction`,
 * same system prompt, same required fields — so it believed it was designing a
 * site from scratch out of a fragment. It cannot tell "change this" from "this
 * is already so" without being shown the current values, and a rule to omit what
 * is unchanged is unusable if it does not know what is unchanged.
 *
 * IN THE USER MESSAGE, never the cached system or tool block: this varies per
 * site, and putting it in the cached prefix would miss the ~10,800-token cache
 * on every single build. Same reasoning as the layout directive and attachments.
 *
 * NAMES ONLY for tables — the designer needs to know what exists, and the rows
 * of a `collect` table are customer names and phone numbers.
 */
export function currentStateNote(current) {
  const c = current && typeof current === "object" ? current : {};
  const lines = [];
  const add = (label, v) => { const s = str(v); if (s) lines.push(label + ": " + s.slice(0, 300)); };
  add("name", c.brand);
  add("one-line description", c.description);
  // THE THEME THE SITE IS ALREADY WEARING (2026-08-27). The widest re-roll door
  // there is: `theme` is REQUIRED on a first build, so a revise designer not
  // shown the stored name has every reason to answer the field afresh — and a
  // fresh name changes every colour, both typefaces, the corners and the
  // shadows at once, on a request that was only ever about a phone number.
  add("theme", c.theme);
  // THE MARK THE SITE IS ALREADY WEARING, whole and uncapped like the
  // stylesheet below and for the same reason: `favicon` is REPLACED rather than
  // merged, so the only way a revise can adjust the mark is to hand the current
  // document back with the change made — and a `.slice()` here would have the
  // model return the truncated document, which then REPLACES the stored one.
  // `MAX_FAVICON` bounds what the merge can store, so the ceiling is set once,
  // at the door. Printed raw like `theme` and `brand` — validation is the
  // MERGE's job (`FIELD_KEEPS.favicon`), not the note's.
  const mark = str(c.favicon);
  if (mark) {
    lines.push("its tab icon (an SVG you drew — to change it, return `favicon` as a whole new mark; " +
      "to keep it, omit `favicon`):\n" + mark);
  }
  // AND THE WORDMARK, same contract: `text` prints as the choice it is, a
  // drawn one prints whole so a revise can redraw it deliberately.
  const wm = str(c.wordmark);
  if (wm) {
    lines.push("its header logo (`text` = the name in type; to change it, return `wordmark`; to keep " +
      "it, omit `wordmark`):\n" + wm);
  }
  // THE PALETTE THE SITE IS ALREADY WEARING, spelled out as the three colours
  // rather than as a name — there is no registry to name one from since
  // 2026-08-20, and a designer shown nothing here has every reason to author a
  // fresh palette on a request that was only ever about a phone number. That is
  // the re-roll anchoring the look exists to stop, and this is its widest door:
  // the seeds are the one field where "answer it afresh" changes every colour on
  // every page at once.
  //
  // The NAME goes with them, because it is what the reply says out loud ("Warm
  // Brick") and a designer that cannot see it will rename a palette it did not
  // change.
  const sd = c.seeds && typeof c.seeds === "object" ? c.seeds : null;
  if (sd && str(sd.paper) && str(sd.ink) && str(sd.accent)) {
    lines.push("palette" + (str(sd.name) ? " (" + str(sd.name).slice(0, 40) + ")" : "") +
      ": paper " + str(sd.paper) + ", ink " + str(sd.ink) + ", accent " + str(sd.accent) +
      (sd.dark && typeof sd.dark === "object" && str(sd.dark.paper) ? " · its own dark half" : " · dark derived"));
  }
  add("family", c.family);
  // WHAT KIND OF THING THE SITE IS — shopfront or working tool — stated before
  // the other plan axes because it is the frame they are all read in. The
  // sharpest version of this note's own argument: a revise designer not told a
  // site is a `tool` has every reason to answer `shopfront` afresh on a
  // request that was only ever about a column width, and that one answer
  // un-tools the whole site — a hero, a closing pitch and a photograph budget
  // arriving on a CRM because somebody asked for wider rows.
  add("kind of site", c.kind);
  // THE FIVE OTHER PLAN AXES, for the reason every line here exists and with the
  // same edge as `lang` below. These replaced `family` on 2026-08-20, so they are
  // no longer looked up from a table — they are values THIS site's designer wrote
  // once and a later edit inherits. A designer not shown them has every reason to
  // answer them afresh on a request that was only ever about a colour, which is
  // the re-roll that anchoring the look was introduced to stop, arriving through
  // six new doors. Stated compactly: the shape lines and the page roles are
  // prose, so the whole set is capped rather than each line being spelled out.
  add("what the site is organised around", c.purpose);
  // PER PAGE SINCE 2026-08-21, and the old one-liner did not merely go stale —
  // it printed `layout: ` with nothing after it, because `str` of an object is
  // the empty string and every entry filtered away. A label with no content says
  // less than the omission it replaced.
  //
  // A stored FLAT array (every site built before that day) still yields nothing
  // usable, and that is the same answer `normalizePlan` gives it: the value buys
  // nothing rather than breaking the note. It is skipped rather than printed
  // empty, so such a site reads exactly as it did before this line existed.
  if (Array.isArray(c.shape) && c.shape.length) {
    const arranged = c.shape
      .filter((s) => s && typeof s === "object" && !Array.isArray(s) && Array.isArray(s.sections))
      .map((s) => [str(s.path), s.sections.map(str).filter(Boolean).join(" → ")])
      .filter(([path, bands]) => path && bands)
      .map(([path, bands]) => path + " = " + bands);
    if (arranged.length) lines.push("layout, page by page: " + arranged.join(" | ").slice(0, 700));
  }
  if (Array.isArray(c.action) && c.action.length) lines.push("primary action: " + c.action.map(str).filter(Boolean).join(" / ").slice(0, 120));
  if (Array.isArray(c.pages) && c.pages.length) {
    const p = c.pages.filter((x) => x && typeof x === "object").map((x) => str(x.path)).filter(Boolean);
    if (p.length) lines.push("pages it already has: " + p.join(", ").slice(0, 300));
  }
  if (Array.isArray(c.components) && c.components.length) {
    lines.push("components it already uses: " + c.components.map(str).filter(Boolean).join(", ").slice(0, 500));
  }
  // THE PHOTOGRAPHS IT ALREADY PAID FOR, and this one is the sharpest of the six
  // because every line of it is ~19 credits of real spend. A designer not shown
  // them re-describes the set on a request about a colour, and the pictures do
  // not merely churn: `budgetFor` answers 0 on a revise of a site that already
  // has photographs, so what a re-roll produces is tokens nothing buys and a
  // page full of placeholders where a bought picture used to be.
  //
  // THE DESCRIPTIONS, not a count. "3 photographs" tells a model nothing it can
  // return unchanged; the sentences are what it has to hand back to keep them.
  if (Array.isArray(c.images) && c.images.length) {
    const shots = c.images
      .filter((s) => s && typeof s === "object" && !Array.isArray(s))
      .map((s) => [str(s.page), str(s.describe)])
      .filter(([page, describe]) => page && describe)
      .map(([page, describe]) => page + " = " + describe);
    if (shots.length) lines.push("photographs it already has: " + shots.join(" | ").slice(0, 700));
  }
  // THE LANGUAGE THE PAGES ARE WRITTEN IN. Stated for the same reason as
  // everything else here and with a sharper edge than most: this note is written
  // in English and so is the tool schema, so a designer that is NOT told a site
  // is Spanish has every reason to answer `en` — and would relabel a live site
  // on a request that was only ever about a colour. `publicView` twice, and the
  // schema digest before it, are the same failure: a rule conditioned on a fact
  // the model was never given.
  add("language", c.lang);
  // AND WHICH OTHERS IT IS ALREADY OFFERED IN, for the sharper half of the same
  // reason. `langs` is the WHOLE list rather than an addition, so a designer not
  // told a site is already bilingual has every reason to answer `["cy"]` to
  // "also add Welsh" — dropping the Spanish the site already had, on a request
  // that was only ever additive. Stated as "none" rather than omitted when the
  // site has none, because an absent line reads as an omission rather than as an
  // answer: the `usePublicRows: YES/NO` lesson.
  const f = c.fonts && typeof c.fonts === "object" ? c.fonts : null;
  if (f && str(f.heading) && str(f.body)) lines.push("fonts: " + str(f.heading) + " for headings, " + str(f.body) + " for body");
  // ── THE STYLESHEET, IN FULL, AND DELIBERATELY NOT CAPPED ────────────────────
  //
  // Every other line here is a summary because every other field is a NAME the
  // model can restate. `css` is not: since 2026-08-23 it is the whole design,
  // and it is REPLACED rather than merged — so the only way a revise can change
  // one colour without re-rolling the entire site is to hand the current sheet
  // back with that one change made to it. It cannot do that without seeing it.
  //
  // A `.slice()` HERE WOULD BE WORSE THAN THE COST IT SAVES. The model would
  // return the truncated sheet, that answer would REPLACE the stored one, and
  // the tail of the customer's design would be gone — silently, on a request
  // about a phone number. `MAX_CSS` already bounds what can be stored, so the
  // ceiling is set once, at the door, rather than a second time here where it
  // would destroy rather than refuse.
  //
  // THE COST, STATED: this rides in the USER message, so it is fresh input on
  // every edit that reaches the designer rather than a cache read. A realistic
  // sheet is a few thousand characters and about a credit's worth; the 60,000
  // ceiling is a bound on the pathological case, not a typical value.
  const css = str(c.css);
  if (css) {
    lines.push("── ITS STYLESHEET (this is the whole look — to change any of it, return `css` " +
      "as this exact sheet with only the asked-for change made; to leave the look alone, omit `css`) ──\n" + css);
  }
  // ── WHAT EACH CONTROL ALREADY DOES (2026-08-29) ─────────────────────────────
  //
  // Same argument as the photographs two blocks up and with the same teeth: the
  // entries were decided for THIS site, so a designer not shown them re-answers
  // the whole list on a request about one button — and `behavior` is a REPLACED
  // list, not a merged one, so a re-answer is the old list gone.
  //
  // THE CONTROL AND WHAT IT DOES, not a count. "6 controls" is nothing a model
  // can hand back unchanged; the sentences are the only thing that keeps them.
  // `source` rides along because it is the one field a re-answer gets wrong in a
  // way nobody sees until the site is live: a control silently re-labelled
  // "component" is one that ships doing nothing.
  if (Array.isArray(c.behavior) && c.behavior.length) {
    const acts = c.behavior
      .filter((b) => b && typeof b === "object" && !Array.isArray(b))
      .map((b) => [str(b.control), str(b.on), str(b.does), str(b.result), str(b.source)])
      .filter(([control, , does]) => control && does)
      .map(([control, on, does, result, source]) =>
        control + ": " + [on, does, result].filter(Boolean).join(" → ") + (source ? " [" + source + "]" : ""));
    if (acts.length) lines.push("what its controls already do: " + acts.join(" | ").slice(0, 900));
  }
  // AND THE SCENE, if it has one. A string, so it prints like the rest — and it
  // is here at all because `three` joined `EDIT_FIELDS` the same day, which is
  // what makes it storable and therefore what makes it re-answerable.
  add("3D scene", c.three);
  const tables = Array.isArray(c.tables) ? c.tables.map(str).filter(Boolean).slice(0, 24) : [];
  if (tables.length) lines.push("tables it already has: " + tables.join(", "));
  // A FIRST BUILD ADDS NOTHING AT ALL, which is why this is decided AFTER the
  // emptiness check rather than pushed with the rest: the languages line is the
  // one that would be present for a site with nothing stored, and a "THE SITE AS
  // IT IS NOW" block on a brand new site is a lie about there being a site.
  if (!lines.length) return "";
  // …and once there IS a note, "none" is STATED rather than omitted, because an
  // absent line reads as an omission rather than as an answer — the
  // `usePublicRows: YES/NO` lesson. `langs` is the WHOLE list rather than an
  // addition, so a designer not told a site is already bilingual has every
  // reason to answer `["cy"]` to "also add Welsh" and drop the Spanish it had.
  const extra = Array.isArray(c.langs) ? c.langs.map(str).filter(Boolean) : [];
  lines.push("other languages it is offered in: " + (extra.length ? extra.join(", ") : "none"));
  return "\n\nTHE SITE AS IT IS NOW\n" + lines.join("\n");
}

/**
 * The rule, stated to the model in the terms the merge actually implements.
 *
 * The three sentences do different jobs and none is decoration. The first says
 * omission is the mechanism. The second kills the restatement habit explicitly,
 * because a model's instinct on a structured tool is to fill the fields in. The
 * third names the case that caused the original bug — a colour change — and
 * says what a correct answer to it looks like, because that is the one this has
 * to get right or it reopens what anchoring was introduced to fix.
 */
export const EDIT_RULE =
  "\n\nTHIS IS AN EDIT, NOT A NEW SITE\n" +
  "Return ONLY the fields this change actually asks you to alter. Omit every other field — an omitted field keeps " +
  "exactly what the site has now, and that is how you say \"leave it alone\".\n" +
  "DO NOT RESTATE A VALUE TO KEEP IT. Naming the theme it already has achieves nothing, and naming a DIFFERENT one " +
  "re-themes the entire site — so if the change is not about the look, return no theme, no family and " +
  "no fonts at all. The same for the name, the description and the LANGUAGE: leave them out unless this change is " +
  "about them. This conversation is in English and the site may not be — return a language only if the change is " +
  "asking you to alter what language its pages are written in.\n" +
  // ── `css` IS THE ONE FIELD WHERE OMISSION IS NOT ENOUGH TO SAY ────────────
  //
  // Every other field here keeps its stored value by being left out, and so
  // does this one — but `css` is REPLACED rather than merged, so the failure it
  // can produce is the whole design rather than one axis. A model that answers
  // it from scratch on "make the background yellow" hands back a different site,
  // which is exactly the re-roll anchoring the look was introduced to stop.
  //
  // SO THE RULE IS STATED IN BOTH DIRECTIONS: the sheet is above, return it with
  // the change made, and omit it entirely for anything that is not the look.
  // "PRINTED ABOVE WHEN THERE IS ONE", not "printed above". This constant is
  // shared by all three lanes that call the designer, and only two of them hand
  // over the stylesheet: the addon and page lanes read `site_look` for the brand
  // and the plan and pass no `css`, because neither reads a stylesheet back —
  // they publish through the spine, which carries the stored one. A rule that
  // says "printed above" on a turn where nothing was printed is an instruction
  // pointing at nothing, which is the stale-clause failure this repo has paid
  // for three times (`#/` hrefs, the `fonts` field, `publicView`).
  // ── ON AN EDIT THE SHEET IS THE LOOK, NOT THE THEME (2026-08-28, owner) ────
  //
  // "instead of it being a specific theme, it's free css — the model can edit
  // anything on the page." The tool's own `css` description is CACHED and
  // SHARED by both lanes, and it is written for a FIRST build: "CSS ON TOP OF
  // THE THEME, ONLY WHEN ASKED… OMIT this field entirely unless…". That is
  // right where it stands — it is what stops a build writing a second whole
  // design beside the theme it just picked — and it is the wrong instinct on an
  // edit, where the customer has asked for something by definition and the site
  // already has a sheet of its own.
  //
  // So the edit lane says so out loud rather than leaving the model to reconcile
  // two framings by itself. Overriding a cached instruction from the user
  // message is the ONLY way to differ per lane without splitting the tool in
  // two and losing the ~10,800-token cache on every build.
  //
  // THE TWO HALVES ARE DELIBERATELY OPPOSITE, and both are the owner's words:
  // unlimited in WHAT may be changed, strict in HOW MUCH. Saying only the first
  // invites a redesign; saying only the second reads as a warning not to touch
  // anything. They have to arrive together.
  "THE STYLESHEET IS THE WHOLE LOOK AND IT IS YOURS TO EDIT. What the tool says about leaving the look to the " +
  "theme is for a FIRST build; this site already has a sheet and it is printed above. There is nothing on the " +
  "page you cannot reach with a rule — any element, any component, any state, any one page — so whatever they " +
  "ask to look different, write the rule that does it. You are never limited to what a theme offers.\n" +
  "A change to the LOOK — a colour, a corner, a typeface, spacing, anything visual — is `css` and nothing else: " +
  "return the site's current stylesheet, printed above when the site has one, with ONLY that change made to it. " +
  "Whatever you return REPLACES the whole stylesheet, so a sheet written from scratch is a different design and " +
  "anything you leave out is gone. If the change is not about the look at all, omit `css`.\n" +
  // ── THE EDITOR'S THREE RULES (2026-08-28, owner's call) ────────────────────
  //
  // "if the user wants one thing, you change one thing. if the user wants
  // three, you change three… do not change something that the user hasn't told
  // you to change." The paragraph above already says "ONLY that change made",
  // and it was not enough on its own, because it leaves two things unsaid that
  // a model fills in from training: HOW MANY edits an ask is worth, and HOW WIDE
  // each one should reach.
  //
  // THE WIDTH HALF IS THE ONE WITH TEETH. "Make this button darker" has two
  // readings that look equally reasonable from inside the sheet — a rule on the
  // button, or a new value for the token the button paints with — and the second
  // repaints every component that reads that token. From the customer's side
  // those are not two ways to do one job: one is the edit they asked for and the
  // other is a re-skin of the site. The mechanism is named rather than banned,
  // because a ban-list covers tonight's case and the customer's next request is
  // always a control nobody listed.
  //
  // NO WORKED EXAMPLE, deliberately — the owner's standing rule, and the one
  // thing a model reliably copies. Stated as the purpose and left there.
  "YOU ARE EDITING A STYLESHEET, NOT WRITING ONE. Change exactly as many things as they asked for and NEVER " +
  "MORE: one ask is one edit to the sheet, three asks are three. Everything else comes back exactly as it is " +
  "printed above.\n" +
  "AND EACH ONE ONLY AS WIDE AS THEY ASKED. A change to one control is a rule for that control. A new value for " +
  "a token is not — every component that reads that token repaints, so a request about one button becomes a " +
  "different-looking site. Reach for a token only when what they named really is the whole site.\n" +
  "NOTHING THEY DID NOT ASK FOR MOVES — not a spacing you would have set differently, not a colour you think " +
  "sits better beside the new one. Taste nobody asked for reads as the site changing on its own.\n" +
  "A change to the wording is neither — the pages are edited " +
  "elsewhere, so return no tables and no seed for it. Only declare a table when this change genuinely needs one " +
  "stored, and then declare only that table; the ones it already has are kept for you.\n" +
  // THE TWO FEATURES THAT NEED A PAGE AS WELL AS A SCHEMA, and the reason this
  // sentence exists at all: the designer could already emit them on an existing
  // table and they were dropped silently, so a site built without a price could
  // never start taking money.
  //
  // THE LAST CLAUSE IS A PROMISE AND IT WAS NOT KEPT ON THIS ROUTE UNTIL
  // 2026-08-21. Its justification was also wrong — it said the tool COMPELS
  // `access`, and the required list is `["name", "columns"]`, so an omission was
  // possible too and was the WORSE half: the normaliser stamped `collect` over
  // it, which no later merge could tell from a real answer. `keepStoredAccess`
  // below is the implementation; obeying this sentence literally is what used to
  // publish a menu table to anonymous writers.
  "YOU MAY NAME A TABLE THE SITE ALREADY HAS, for exactly two things: to add a column to it, and to make it take " +
  "PAYMENTS or publish a read-only `publicView` of it. Those two need a page as well, which is why they come here. " +
  "Anything else about an existing table — who may read it, who may write it, whether it emails, what it refuses — " +
  "is changed elsewhere and is IGNORED here, so the `access` you have to fill in for an existing table is discarded " +
  "and the site keeps its own.";

/**
 * Who may read and who may write, as three names.
 *
 * `access` is the preset, `read`/`write` are the axes it is shorthand for. Any
 * of the three decides the table's grants and its RLS policies, so all three are
 * one question and a guard that holds two of them holds none.
 */
export const ACCESS_AXES = ["access", "read", "write"];

/**
 * MAKE `EDIT_RULE`'S LAST SENTENCE TRUE.
 *
 * That sentence promises, in as many words, that "the `access` you have to fill
 * in for an existing table is discarded and the site keeps its own". Nothing
 * implemented it on the build/revise route, and the comment justifying the
 * promise was stale twice over — it said the tool COMPELS `access`, when the
 * required list is `["name", "columns"]`, so BOTH an omission and an answer had
 * to be handled and neither was.
 *
 * MEASURED 2026-08-21, on a site whose `menu_items` was `display`, revised to add
 * a `photo` column exactly as the rule above instructs:
 *
 *   grantsFor   → GRANT INSERT ON "menu_items" TO anonymous
 *   policiesFor → DROP POLICY "isibi_menu_items_read"   (no SELECT policy recreated)
 *
 * So one ordinary edit made a stranger able to write rows into the business's
 * menu through the Data API and made the site's own menu page 403 for every
 * visitor — permanently, since `_meta` is the only copy the request path reads.
 * Reported as `ok: true`. A model OBEYING OUR OWN INSTRUCTION is what triggered it.
 *
 * NOTE THE INVERSION of the usual pair bug: a table declared as a `read`/`write`
 * PAIR was SAFE, because both halves are stored and restored. It is the ordinary
 * preset-declared table — the common case — that was exposed.
 *
 * TWO HALVES, AND ONLY BOTH TOGETHER ARE A FIX. `site-schema.mjs` stopped
 * stamping `"collect"` over an absent level, so silence survives the normaliser
 * and `fillFromStored` can restore it; this drops a level that WAS declared,
 * because the model may answer one as compliance with a schema rather than as a
 * decision about who may read a real business's booking list. The addon lane has
 * made exactly this argument since it shipped (`ADDON_TABLE_FIELDS`), and the
 * build/revise route is the one that never learned it.
 *
 * DROPPED, NOT OVERWRITTEN WITH THE STORED VALUE, and that is what keeps it
 * honest: this module has never seen the stored schema and would be guessing.
 * `applySiteSchema` holds the stored table already — `fillFromStored` fills any
 * silence from it before a single grant or policy is emitted — so removing the
 * field is precisely "say nothing and let the site keep its own".
 *
 * WHY NOT IN `applySiteSchema`, where the stored table is in hand: the `rules`
 * lane exists to CHANGE access on an existing table, and it applies through the
 * same function. A stored-always-wins rule there would silently break the one
 * lane whose job this is. Two intents, so two call sites, rather than a flag on
 * the shared function — the same reasoning `mergeRules` gives for not being
 * `normalizeSchema`'s merge.
 *
 * `known` is the names the site already has. An EMPTY set changes nothing, which
 * is the right direction and not merely the convenient one: on a first build
 * there is no stored level to keep, and a revise declaring a genuinely NEW table
 * must keep the level it just declared or every table added after a site exists
 * would come out `collect`.
 *
 * Returns the guarded spec plus what it overruled, so the route can say it. A
 * designer repeatedly trying to re-level an existing table is the same class of
 * evidence `droppedFields` was added to collect.
 */
export function keepStoredAccess(spec, known) {
  const names = new Set([...(known || [])].map((n) => String(n == null ? "" : n).toLowerCase()).filter(Boolean));
  const tables = (spec && Array.isArray(spec.tables)) ? spec.tables : [];
  if (!names.size || !tables.length) return { spec, held: [] };
  const held = [];
  const out = tables.map((t) => {
    if (!t || !t.name || !names.has(String(t.name).toLowerCase())) return t;
    const fields = [];
    const copy = { ...t };
    for (const k of ACCESS_AXES) {
      // Absent and null are both SILENCE — the normaliser turns an unmentioned
      // half into undefined and `fillFromStored` reads either as unchanged — so
      // neither is something we overruled, and reporting it as such would make
      // every ordinary column edit look like a refused access change.
      if (copy[k] === undefined || copy[k] === null) continue;
      delete copy[k];
      fields.push(k);
    }
    if (!fields.length) return t;
    held.push({ table: t.name, fields });
    return copy;
  });
  return { spec: { ...spec, tables: out }, held };
}

/**
 * Stored-unless-named, for the six fields an edit may move.
 *
 * `instructed` IS A SAFETY INTERLOCK, NOT A FLAG FOR TIDINESS. The new
 * precedence — the designer's answer beating the stored value — is only sound
 * because the designer was TOLD to omit what it is keeping. If that instruction
 * did not reach it (no current state could be read, a first build, an older
 * caller), the model is answering the way it always did, and preferring that
 * answer would re-roll the look on every edit. So without `instructed` this
 * keeps the previous precedence exactly: stored first.
 *
 * The direction of the failure is the point. Being wrong toward "stored" costs
 * an edit that does not take effect, which the customer can see and say again.
 * Being wrong toward "designed" silently re-themes a live site.
 */
export function mergeLook(prior, designed, body, { instructed = false } = {}) {
  const p = prior && typeof prior === "object" ? prior : {};
  const d = designed && typeof designed === "object" ? designed : {};
  const b = body && typeof body === "object" ? body : {};
  const out = {};
  for (const k of EDIT_FIELDS) {
    // THE REMOVAL VERB, AND IT CAN ONLY EVER COME FROM THE DESIGNER.
    //
    // It is applied here rather than by making `[]` count as a value in the
    // chain below, because the two slots mean different things: an empty list on
    // the DESIGNER's answer is "take them all off", and an empty list on the
    // STORED look is the site simply having none. Let the stored one into the
    // chain and, on the un-instructed path where stored comes first, a site
    // recorded as `langs: []` could never be given a second language again.
    //
    // Gated on `instructed` for the same reason the precedence is: without the
    // current-state note the model is answering the way it always did, and an
    // empty field is far more likely to be silence than a decision.
    if (instructed && clearsField(k, d[k])) { out[k] = d[k]; continue; }
    const order = instructed ? [d[k], p[k], b[k]] : [p[k], d[k], b[k]];
    // FIELD-AWARE, so a palette is judged by `normalizeSeeds` whatever shape it
    // arrived in rather than by a heuristic that has an outside. See `keepsValue`.
    out[k] = order.find((v) => keepsValue(k, v)) ?? null;
  }
  return out;
}

/**
 * THE KEYS A PALETTE ANSWER CAN CARRY, DERIVED FROM THE TOOL FIELD ITSELF.
 *
 * This used to be a hand-written `["paper", "ink", "accent"]` and the gap that
 * left was a HIGH, measured 2026-08-21: an answer carrying only `dark`, or only
 * `name`, has NONE of the three at the top level, so it walked past the
 * validator in `hasValue` and was counted a value by the generic object test —
 * the exact outcome that function's own doc block says it prevents ("Absent
 * unless all three are there").
 *
 *   hasValue({ dark: { paper: "#101418", ink: "#f2f2f2", accent: "#e08a4a" } })
 *     → true   (and `normalizeSeeds` of it → "light paper is not a #rrggbb colour")
 *   hasValue({ name: "Coastal Fog" }) → true
 *
 * `dark` is the natural answer to "make the dark mode moodier": the tool offers
 * it as its own nested object with its own `required`, and nested `required` is
 * advisory here because structured outputs are unavailable on this tool. So it
 * is a shape a model reaches for, not a contrived one.
 *
 * DERIVED rather than re-listed, because the hand-written list is what went
 * stale: a sixth property added to `SEEDS_FIELD` is covered here without anybody
 * remembering this file.
 *
 * THE ONE OVERLAP WITH ANOTHER FIELD'S VOCABULARY IS `accent`, which is also an
 * askable TOKEN name — so a token patch of exactly `{accent:"#f00"}` is read as a
 * palette answer and refused. That is unchanged by this widening (`accent` was
 * already an anchor) and it is low-stakes, because `tokens` is not an
 * `EDIT_FIELDS` key: nothing about the token patch's APPLICATION goes through
 * here. `keepsValue` below is what makes the high-stakes path exact. A test
 * pins the overlap, so a token named `name` or `dark` cannot arrive quietly.
 */
export const SEED_KEYS = Object.freeze(Object.keys(SEEDS_FIELD.properties));

/**
 * What counts as NAMED.
 *
 * An empty string and an empty object are how a model says nothing while
 * appearing to answer, and treating either as a value is how "" becomes the
 * site's name. `fonts` is the object case: `{}` and `{heading:"x"}` are both
 * absent, because a half pair reaching the build silently defaults the other
 * face.
 *
 * `seeds` IS THE SAME SHAPE ONE FIELD OVER, and it has to be, because the cost
 * of getting it wrong is higher. A palette naming one or two of its three
 * anchors is not a palette — `normalizeSeeds` refuses it and the site falls back
 * to the default look. Counting it as a value means a partial answer REPLACES a
 * good stored palette on a revise, so an edit about a phone number could strip
 * the colours off a live site. Absent unless all three are there.
 */
export function hasValue(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.length > 0;
    const h = typeof v.heading === "string" ? v.heading.trim() : "";
    const b = typeof v.body === "string" ? v.body.trim() : "";
    if ("heading" in v || "body" in v) return !!(h && b);
    // Recognised by the palette's own key names rather than by the field name,
    // because this function never learns which key it is answering for.
    //
    // AND "USABLE", NOT MERELY "COMPLETE" — which is the stricter half and the
    // one that matters. A palette the engine refuses is not an answer, exactly
    // as a half `fonts` pair is not: counting it means a complete-but-illegible
    // one REPLACES a good stored palette, the container then refuses it on every
    // publish, and the site is stuck on the default look until somebody asks for
    // a different colour. Measured: `{paper:"#8a8a8a", ink:"#6f6f6f"}` is a
    // well-formed object and 1.5:1 body text.
    //
    // This was impossible before 2026-08-20, when a theme was a NAME from an
    // enum — an authored palette is the first look value that can be well-formed
    // and unusable, so the guard arrives with it.
    //
    // THE SAME VALIDATOR, NEVER A SECOND OPINION. `normalizeSeeds` is the one
    // place a palette is judged; this asks it whether an answer counts, which is
    // a different question at a different moment, not a rival ruling.
    if (SEED_KEYS.some((k) => k in v)) return !!normalizeSeeds(v).theme;
    return Object.keys(v).length > 0;
  }
  return true;
}

/**
 * Fields where an explicit EMPTY list is a real answer meaning "none".
 *
 * `langs` is documented to the model, in the tool field itself, as "to keep what
 * the site has, leave it out; to remove every extra language, answer `[]`" — and
 * `hasValue([])` is false, so the merge read the removal verb as silence, the
 * prior list survived, and `movedFields` reported nothing moved. Measured
 * 2026-08-21 with prior `{lang:"en", langs:["es"]}` and designed `{langs: []}`:
 * `merged.langs` came back `["es"]`. So the ONE documented way to take a
 * language off a site could not do it at any price — and, because the look
 * lane's `named` guard is built from `hasValue` too, an ask that named nothing
 * else fell through to `escalate("no-change")`, buying a ~21-27-credit page
 * rewrite that could not remove it either.
 *
 * A LIST, NOT A RULE ABOUT ARRAYS. `pages`, `components`, `action` and `shape`
 * are also arrays on `EDIT_FIELDS`, and none of them has a removal verb: a site
 * with no pages is not a thing anybody can ask for, and reading `[]` there as an
 * answer would let a model that filled the field in with nothing wipe the plan.
 * Only the field whose tool description promises the verb gets it.
 */
export const CLEARABLE_LISTS = Object.freeze(["langs"]);

/** The removal verb: an explicitly empty list on a field that has one. */
export function clearsField(field, v) {
  return CLEARABLE_LISTS.includes(field) && Array.isArray(v) && v.length === 0;
}

/**
 * IS THIS A VALUE WORTH KEEPING FOR **THIS** FIELD — the field-aware half.
 *
 * `hasValue` never learns which key it is answering for, so its palette test is
 * a heuristic on the object's own shape, and a heuristic has an outside: a
 * designer that nests the light half the way the tool nests the dark one
 * (`{light:{paper,ink,accent}}`) carries no seed key at all, falls through to the
 * generic object test, and poisons the stored look exactly as `{dark:{…}}` did.
 * Here the field IS known, so the palette goes through `normalizeSeeds` whatever
 * shape it arrived in, and the hole has no outside.
 *
 * The invariant this buys, and it is what the test asserts: `mergeLook` can
 * never return a `seeds` value that `normalizeSeeds` refuses. That matters
 * because nothing downstream re-validates it — `_meta.site_look` is written
 * whole, and every later cheap edit re-sends it, so one poisoned store leaves a
 * site on the template's default look for good.
 *
 * `Object.hasOwn`, not a truthiness test: `FIELD_KEEPS["constructor"]` is
 * `Object`, so an empty value comes back as a String OBJECT — truthy — and the
 * merge would keep `""` as somebody's brand. The exact bug this codebase shipped
 * once in the Stripe plan lookup.
 *
 * NO LIVE CALL SITE CAN REACH THAT TODAY, and it is said here rather than left
 * looking load-bearing: every caller passes a name out of `EDIT_FIELDS`, or
 * `tokens`/`style`/`tokensPage`. What it holds is the CONTRACT of an exported
 * function that takes a field name from whoever calls it, which is one new
 * caller away from mattering; the test drives it directly for that reason.
 */
const FIELD_KEEPS = {
  seeds: (v) => !!normalizeSeeds(v).theme,
  // A THEME NAME THE REGISTRY REFUSES IS NOT AN ANSWER (2026-08-27). The tool's
  // enum makes an unknown name unlikely rather than impossible — enum is
  // advisory without strict validation, which this tool cannot turn on — and a
  // hallucinated name counted as a value would REPLACE a good stored theme,
  // after which the container falls soft to the default look on every publish
  // for good. Same invariant as `seeds` one line up, same single validator
  // rule: `resolveTheme` is the one place a name is judged, and this asks it
  // whether an answer counts.
  theme: (v) => !!resolveTheme(v),
  // A FAVICON THE VALIDATOR REFUSES IS NOT AN ANSWER (2026-08-28). Same
  // invariant as `theme` one line up, same single-validator rule: `cleanFavicon`
  // is the one place an SVG is judged, and this asks it whether an answer
  // counts. Counted as a value, a junk document would REPLACE a good stored
  // mark, after which the container refuses it on every publish and the site
  // falls back to the initials for good — while the response says the look
  // changed.
  favicon: (v) => !!cleanFavicon(v).svg,
  // Same rule for the wordmark: `text` and a valid SVG are the two answers,
  // and everything else must not replace either of them in the store.
  wordmark: (v) => !!readWordmark(v).kind,
  // AN ANSWERED-EMPTY `images` IS A VALUE, NOT SILENCE (2026-08-27). The tool
  // field promises "send an empty list to say it should have none", `images`
  // is REQUIRED on a first build — and `hasValue([])` is false, so this merge
  // nulled the one documented way of saying "no photographs" before it could
  // be stored, and the derived rule then bought the home page one anyway. The
  // `langs: []` bug of 2026-08-21, one field over: a removal verb the tool
  // documents and the merge reads as saying nothing.
  //
  // ANY ARRAY COUNTS, including one full of junk entries — filtering entries
  // is `pageImages`'s job at plan composition, where the page list is in
  // hand, and an answered list whose every entry was refused buys NOTHING
  // rather than a fallback photograph nobody described. What must NOT count
  // is a non-array, so a stored `null` still reads as absent and the ordinary
  // absent-means-unchanged chain still runs.
  //
  // NOT `CLEARABLE_LISTS`, and the difference matters: that mechanism fires
  // only on the instructed path, and the build that needs this most is the
  // FIRST one — uninstructed by definition — where there is no stored value
  // to clear, only a designed answer to keep. On the instructed path the
  // designed value already leads the chain, so `[]` winning there is this
  // same rule, not a second one.
  images: (v) => Array.isArray(v),
};

export function keepsValue(field, v) {
  return Object.hasOwn(FIELD_KEEPS, field) ? FIELD_KEEPS[field](v) : hasValue(v);
}

/**
 * DID THE MODEL SAY ANYTHING ABOUT THIS FIELD — including "none".
 *
 * For the look lane's `named` guard, which asks whether the designer named
 * anything at all and escalates to a full revise when it did not. A removal verb
 * IS naming something: without this, "stop offering the Spanish version" on a
 * site that has no extra languages reads as "I could not express this" and buys
 * a rebuild that cannot express it either.
 */
export function namesValue(field, v) {
  return clearsField(field, v) || keepsValue(field, v);
}

/**
 * Which of the six an edit actually moved — for the reply and for the trace.
 *
 * A customer who asks for one thing and gets four changed has no way to see
 * that from the site alone, and neither has anybody reading a log. Compares the
 * merged result against what was stored, so it reports what CHANGED rather than
 * what the model happened to mention.
 */
export function movedFields(prior, merged) {
  const p = prior && typeof prior === "object" ? prior : {};
  const m = merged && typeof merged === "object" ? merged : {};
  return EDIT_FIELDS.filter((k) => {
    const a = p[k], b = m[k];
    // FIELD-AWARE, like the merge, and for a case that is live rather than
    // hypothetical: a site poisoned by the `{dark:{…}}` bug has a stored `seeds`
    // the engine refuses. With the generic test that reads as a value, so the
    // first unrelated edit — which correctly merges it away to `null` — would
    // report "the look changed" to a customer who asked about a phone number.
    // Both sides unusable is both sides absent, which is the truth: the site was
    // on the default look before and still is.
    if (!keepsValue(k, a) && !keepsValue(k, b)) return false;
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  });
}
