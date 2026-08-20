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
export const EDIT_FIELDS = ["brand", "description", "theme", "family", ...PLAN_EDIT_FIELDS, "fonts", "lang", "mode", "langs"];

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
  add("theme", c.theme);
  add("family", c.family);
  add("mode", c.mode);
  add("structure", c.structure);
  // THE FIVE OTHER PLAN AXES, for the reason every line here exists and with the
  // same edge as `lang` below. These replaced `family` on 2026-08-20, so they are
  // no longer looked up from a table — they are values THIS site's designer wrote
  // once and a later edit inherits. A designer not shown them has every reason to
  // answer them afresh on a request that was only ever about a colour, which is
  // the re-roll that anchoring the look was introduced to stop, arriving through
  // six new doors. Stated compactly: the shape lines and the page roles are
  // prose, so the whole set is capped rather than each line being spelled out.
  add("what the site is organised around", c.purpose);
  if (Array.isArray(c.shape) && c.shape.length) lines.push("layout: " + c.shape.map(str).filter(Boolean).join(" · ").slice(0, 400));
  if (Array.isArray(c.action) && c.action.length) lines.push("primary action: " + c.action.map(str).filter(Boolean).join(" / ").slice(0, 120));
  if (Array.isArray(c.pages) && c.pages.length) {
    const p = c.pages.filter((x) => x && typeof x === "object").map((x) => str(x.path)).filter(Boolean);
    if (p.length) lines.push("pages it already has: " + p.join(", ").slice(0, 300));
  }
  if (Array.isArray(c.components) && c.components.length) {
    lines.push("components it already uses: " + c.components.map(str).filter(Boolean).join(", ").slice(0, 500));
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
  "re-themes the entire site — so if the change is not about the look, return no theme, no family, no structure and " +
  "no fonts at all. The same for the name, the description and the LANGUAGE: leave them out unless this change is " +
  "about them. This conversation is in English and the site may not be — return a language only if the change is " +
  "asking you to alter what language its pages are written in.\n" +
  "A change to a colour is `tokens` and nothing else. A change to the wording is neither — the pages are edited " +
  "elsewhere, so return no tables and no seed for it. Only declare a table when this change genuinely needs one " +
  "stored, and then declare only that table; the ones it already has are kept for you.\n" +
  // THE TWO FEATURES THAT NEED A PAGE AS WELL AS A SCHEMA, and the reason this
  // sentence exists at all: the designer could already emit them on an existing
  // table and they were dropped silently, so a site built without a price could
  // never start taking money. The access warning is the important half — the
  // tool COMPELS `access` on every table, so a designer naming an existing one
  // has to answer it, and an answer that is compliance rather than intent would
  // have opened a booking list to the public if the merge trusted it.
  "YOU MAY NAME A TABLE THE SITE ALREADY HAS, for exactly two things: to add a column to it, and to make it take " +
  "PAYMENTS or publish a read-only `publicView` of it. Those two need a page as well, which is why they come here. " +
  "Anything else about an existing table — who may read it, who may write it, whether it emails, what it refuses — " +
  "is changed elsewhere and is IGNORED here, so the `access` you have to fill in for an existing table is discarded " +
  "and the site keeps its own.";

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
    const order = instructed ? [d[k], p[k], b[k]] : [p[k], d[k], b[k]];
    out[k] = order.find((v) => hasValue(v)) ?? null;
  }
  return out;
}

/**
 * What counts as NAMED.
 *
 * An empty string and an empty object are how a model says nothing while
 * appearing to answer, and treating either as a value is how "" becomes the
 * site's name. `fonts` is the object case: `{}` and `{heading:"x"}` are both
 * absent, because a half pair reaching the build silently defaults the other
 * face — the same reason `themeFontPair` refuses one.
 */
export function hasValue(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.length > 0;
    const h = typeof v.heading === "string" ? v.heading.trim() : "";
    const b = typeof v.body === "string" ? v.body.trim() : "";
    if ("heading" in v || "body" in v) return !!(h && b);
    return Object.keys(v).length > 0;
  }
  return true;
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
    if (!hasValue(a) && !hasValue(b)) return false;
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  });
}
