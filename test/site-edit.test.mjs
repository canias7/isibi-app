// "An edit changes exactly what was asked for, and nothing else." (owner, 2026-08-10)
//
// The two defects this resolves are mirror images, and both were measured on the
// live route: `brand` and `description` moved when NOBODY asked (neither had an
// anchor), while `theme`/`family`/`structure`/`fonts` could not move even when
// asked (all four were hard-anchored). So "fix the typo" could rename the site
// and "make it look like a newspaper" did nothing at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  mergeLook, movedFields, hasValue, currentStateNote, EDIT_RULE, EDIT_REQUIRED, EDIT_FIELDS,
  SEED_KEYS, CLEARABLE_LISTS, clearsField, keepsValue, namesValue,
} from "../builder/site-edit.mjs";
import { normalizeSeeds, SEEDS_FIELD } from "../builder/site-seeds.mjs";
import { ASKABLE } from "../builder/site-tokens.mjs";
import { readConfig, emptyConfig } from "../site-config.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const STORED = {
  brand: "Sharp Fade", description: "A barber shop in Leeds.",
  // A REAL REGISTRY NAME, not an invented one — `FIELD_KEEPS.theme` validates
  // through `resolveTheme`, so a made-up name here would be nulled by the very
  // merge under test and every "nothing moved" loop would report a phantom.
  theme: "broadsheet",
  // A VALID MARK, for the reason the theme is a real registry name one line up:
  // `FIELD_KEEPS.favicon` validates through `cleanFavicon`, so junk here would
  // be nulled by the very merge under test and every "nothing moved" loop would
  // report a phantom.
  // …and the wordmark: `text` is the commoner of its two valid answers and is
  // what most stored sites will hold.
  wordmark: "text",
  favicon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#332a26"/><path d="M20 44 L32 20 L44 44 Z" fill="#f7f2ea"/></svg>',
  seeds: { name: "Warm Brick", paper: "#f7f2ea", ink: "#332a26", accent: "#b44a2e" }, family: "salon",
  fonts: { heading: "noto-serif", body: "source-sans-3" },
  lang: "en-GB", mode: "light", langs: ["es"], kind: "shopfront",
  // The five other plan axes, stored per site since 2026-08-20. `family` is
  // still here beside them ON PURPOSE: nothing sets one any more, and every site
  // built before that date has one, so the merge has to keep carrying it.
  purpose: "the slot picker is the hero; everything else supports the appointment",
  shape: ["the chair list leads", "prices, then the booking form"],
  action: ["Book now"],
  pages: [{ path: "/", role: "book a chair" }, { path: "/prices", role: "what each cut costs" }],
  components: ["availability-grid", "week-strip", "price-list"],
  images: [{ page: "/", describe: "the shop front at dusk, warm light through the window" }],
};

/* ── absent means unchanged ─────────────────────────────────────────────── */

test("an instructed edit that names nothing changes nothing", () => {
  // THE ORDINARY EDIT, and the case that used to re-roll the look. A designer
  // told to omit what it keeps returns only `tokens` for a colour change.
  const out = mergeLook(STORED, { tokens: { background: "#ffff00" } }, null, { instructed: true });
  for (const k of EDIT_FIELDS) assert.deepEqual(out[k], STORED[k], `${k} moved on a colour-only edit`);
  assert.deepEqual(movedFields(STORED, out), []);
});

test("A LOOK STORED BEFORE A FIELD EXISTED IS NOT A CHANGE TO IT", () => {
  // WHAT MAKES ADDING A FIELD SAFE TO DEPLOY, and it is a property rather than
  // a fixture: every site published before a field existed has no value for it,
  // so if `null` counted as a move, the first unrelated edit on every existing
  // site would report a change to something nobody touched — and, for `mode`,
  // would look exactly like the platform deciding on its own whether their site
  // is dark.
  //
  // Driven over EVERY field rather than the newest one, because the next field
  // added has the same day-one exposure and nobody will remember this test.
  for (const k of EDIT_FIELDS) {
    const old = { ...STORED };
    delete old[k];
    const out = mergeLook(old, {}, null, { instructed: true });
    assert.equal(out[k], null, `${k} invented a value for a site that has none`);
    assert.deepEqual(movedFields(old, out), [], `an absent ${k} read as a change`);
  }
});

test("EVERY FIELD THE PUBLISH PATH READS OFF THE LOOK IS ONE THE MERGE PRODUCES", () => {
  // ANCHORED ON THE CONSUMER, NOT ON `EDIT_FIELDS`, and a mutation is the whole
  // reason. Deleting a name from that list SHRINKS every guard that loops over
  // it, so removing `lang` passed the entire suite with the feature dead — the
  // exact failure recorded for `EDIT_LAYERS` a day earlier. **A derived check
  // cannot be derived from the thing being mutated.**
  //
  // The chain this asserts is the real one: `worker.js` reads `look.lang` and
  // hands it to the container, and `mergeLook` only ever emits `EDIT_FIELDS`
  // keys — so a field the Worker reads and the merge does not produce is
  // permanently `undefined`, silently, on every site.
  const read = new Set([...worker.matchAll(/\blook\.([a-zA-Z_]+)/g)].map((m) => m[1]));
  // A FLOOR OF FOUR, AND IT WAS FIVE. `look.seeds` and `look.fonts` were read on
  // the build path until 2026-08-24, when the look became the stylesheet alone.
  // The floor stays because a scan that silently stops matching reports a route
  // reading nothing off the look and passes vacuously — which is the failure
  // this whole guard exists for, one layer up.
  assert.ok(read.size >= 4, "the scan found only " + read.size + " look reads, so it has stopped scanning");
  const produced = new Set(Object.keys(mergeLook({}, {}, {})));
  for (const field of read) {
    assert.ok(produced.has(field),
      "worker.js reads `look." + field + "` and mergeLook never produces it — it is undefined on every site");
  }
  // …and the one this change added is really among them, or the loop above is
  // satisfied by a Worker that stopped reading it at all.
  assert.ok(read.has("lang"), "nothing in the publish path reads the site's language any more");
});

test("an UNUSABLE palette is not an answer, so a good stored one survives", () => {
  // THE ONE HAZARD THE AUTHORED PALETTE INTRODUCED. A theme used to be a name
  // from an enum, so an invalid one was impossible; three hex colours can be
  // perfectly well-formed and illegible. Counting that as an answer means it
  // REPLACES the stored palette, the container then refuses it on every publish,
  // and the site is stuck on the default look until somebody happens to ask for
  // a different colour — the damage is silent and it persists.
  //
  // Measured: `{paper:"#8a8a8a", ink:"#6f6f6f"}` is a complete object and 1.5:1
  // body text.
  const BAD = { name: "Fog", paper: "#8a8a8a", ink: "#6f6f6f", accent: "#7a7a90" };
  assert.equal(hasValue(BAD), false, "an illegible palette counts as an answer");
  assert.deepEqual(mergeLook(STORED, { seeds: BAD }, null, { instructed: true }).seeds, STORED.seeds,
    "an illegible palette displaced the stored one");
  assert.deepEqual(movedFields(STORED, mergeLook(STORED, { seeds: BAD }, null, { instructed: true })), [],
    "and it reports having changed the look");

  // …AND A USABLE ONE STILL LANDS, or the guard above is satisfied by a merge
  // that refuses every palette — which would make the whole field unreachable.
  const OK = { name: "Sea Glass", paper: "#f2f7f6", ink: "#1c2a28", accent: "#2b7a6b" };
  assert.equal(hasValue(OK), true);
  assert.deepEqual(mergeLook(STORED, { seeds: OK }, null, { instructed: true }).seeds, OK,
    "a good palette can no longer be asked for");

  // A FIRST BUILD WITH A BAD PALETTE STORES NOTHING rather than storing a fault.
  // The site publishes on the template's own look either way; what this avoids is
  // a stored value that can never render.
  assert.equal(mergeLook(null, { seeds: BAD }, null).seeds, null);
});

/**
 * A PALETTE ANSWER THAT NAMES NO ANCHOR AT THE TOP LEVEL IS STILL NOT AN ANSWER.
 *
 * The guard above only routed an object through `normalizeSeeds` when one of
 * `paper`/`ink`/`accent` was a TOP-LEVEL key. Measured 2026-08-21, three shapes
 * walked past it and were counted values by the generic object test:
 *
 *   {dark:{paper,ink,accent}}      — "make the dark mode moodier"
 *   {name:"Coastal Fog"}           — a rename with no colours
 *   {light:{paper,ink,accent}}     — the light half nested the way `dark` is
 *
 * All three are shapes a model reaches for: the tool offers `dark` as its own
 * nested object with its own `required`, and nested `required` is advisory
 * because structured outputs are unavailable on this tool.
 *
 * The cost is not one bad publish. `_meta.site_look` is written whole and every
 * later cheap edit re-sends `look.seeds`, so a typo fix, a colour change, a
 * picture swap and a logo all re-offer the poisoned object, the container
 * refuses it again, and the site ships the template's default look for good.
 */
test("a palette answer with no anchors at the top level cannot displace a good stored one", () => {
  const PARTIAL = [
    ["dark only", { dark: { paper: "#101418", ink: "#f2f2f2", accent: "#e08a4a" } }],
    ["name only", { name: "Coastal Fog" }],
    // The heuristic in `hasValue` cannot see this one — it carries no seed key at
    // all — which is exactly why the MERGE asks the field rather than the shape.
    ["light nested like dark", { light: { paper: "#fffaf5", ink: "#141414", accent: "#b44a2e" } }],
  ];
  for (const [why, seeds] of PARTIAL) {
    assert.equal(normalizeSeeds(seeds).theme, null, `${why}: the engine accepts it after all`);
    const out = mergeLook(STORED, { seeds }, null, { instructed: true });
    assert.deepEqual(out.seeds, STORED.seeds, `${why} displaced the stored palette`);
    assert.deepEqual(movedFields(STORED, out), [], `${why} reported having changed the look`);
    assert.equal(mergeLook(null, { seeds }, null, { instructed: true }).seeds, null,
      `${why} was stored on a first build`);
  }
  // AND ON `hasValue` DIRECTLY, for the two shapes its heuristic can see —
  // because that is the function `worker.js`'s look-lane `named` guard calls,
  // and its answer decides whether an ask that named only a broken palette
  // escalates to a full revise. The nested-`light` shape is deliberately NOT
  // asserted here: it carries no seed key at all, so no shape heuristic can
  // reach it, which is the whole reason `keepsValue` asks the field instead.
  assert.equal(hasValue({ dark: { paper: "#101418", ink: "#f2f2f2", accent: "#e08a4a" } }), false,
    "a dark-only palette still counts as a value");
  assert.equal(hasValue({ name: "Coastal Fog" }), false, "a name-only palette still counts as a value");
});

test("THE MERGE CAN NEVER RETURN A PALETTE THE ENGINE REFUSES", () => {
  // THE INVARIANT, not a list of the shapes that were wrong today — because
  // NOTHING DOWNSTREAM RE-VALIDATES IT. `_meta.site_look` is written whole and
  // `recompileAndPublish` reads `look.seeds` straight back out, so whatever this
  // function returns is what the container is handed for the life of the site.
  //
  // Driven over every wrong shape a model can produce AND over a good one, so a
  // merge that simply refused every palette — which would satisfy the negative
  // half perfectly — fails here.
  const JUNK = [
    {}, { name: "" }, { name: "Coastal Fog" }, { dark: {} },
    { dark: { paper: "#101418", ink: "#f2f2f2", accent: "#e08a4a" } },
    { light: { paper: "#fffaf5", ink: "#141414", accent: "#b44a2e" } },
    { paper: "#fffaf5" }, { paper: "#fffaf5", ink: "#141414" },
    { name: "Fog", paper: "#8a8a8a", ink: "#6f6f6f", accent: "#7a7a90" },   // legible object, 1.5:1 text
    { name: "Inverted", paper: "#141414", ink: "#fffaf5", accent: "#b44a2e" }, // modes swapped
    { paper: 1, ink: 2, accent: 3 }, "#b44a2e", [], 7, true,
  ];
  const GOOD = { name: "Sea Glass", paper: "#f2f7f6", ink: "#1c2a28", accent: "#2b7a6b" };
  let landed = 0;
  for (const prior of [null, STORED, { seeds: { dark: { paper: "#101418", ink: "#f2f2f2", accent: "#e08a4a" } } }]) {
    for (const seeds of [...JUNK, GOOD]) {
      for (const instructed of [true, false]) {
        const got = mergeLook(prior, { seeds }, null, { instructed }).seeds;
        if (got === null) continue;
        assert.ok(normalizeSeeds(got).theme,
          `the merge stored a palette the engine refuses: ${JSON.stringify(got)}`);
        landed++;
      }
    }
  }
  assert.ok(landed > 0, "no palette survived any merge, so the invariant is vacuous");
});

test("A SITE ALREADY POISONED HEALS, AND ITS UNRELATED EDITS DO NOT LIE", () => {
  // Every site hit by the bug above has an unusable `seeds` stored right now, so
  // both halves here are about real rows rather than hypotheses.
  //
  // BOTH POISONED SHAPES, and the second is the one that discriminates. A stored
  // `{dark:{…}}` is refused by `hasValue`'s heuristic too, so a `movedFields`
  // that judged by shape would agree with one that judges by field and the
  // difference would be invisible. `{light:{…}}` carries no seed key at all —
  // only asking the FIELD gets it right.
  const POISONED = [
    { seeds: { dark: { paper: "#101418", ink: "#f2f2f2", accent: "#e08a4a" } }, brand: "Sharp Fade" },
    { seeds: { light: { paper: "#fffaf5", ink: "#141414", accent: "#b44a2e" } }, brand: "Sharp Fade" },
  ];
  const OK = { name: "Sea Glass", paper: "#f2f7f6", ink: "#1c2a28", accent: "#2b7a6b" };
  for (const site of POISONED) {
    // A good answer is no longer blocked by it — the stored value stopped
    // counting as a value, so it cannot win the precedence chain any more.
    assert.deepEqual(mergeLook(site, { seeds: OK }, null, { instructed: true }).seeds, OK);
    // …and an edit about something else merges it away to null WITHOUT reporting
    // a look change. The site was on the template's default before and still is;
    // saying "the look changed" to somebody who asked about a phone number is the
    // false claim `movedFields` exists to prevent.
    const quiet = mergeLook(site, { brand: "Sharp Fade Barbers" }, null, { instructed: true });
    assert.equal(quiet.seeds, null);
    assert.deepEqual(movedFields(site, quiet), ["brand"],
      `an unrelated edit reported a look change on ${JSON.stringify(site.seeds)}`);
  }
});

test("the palette's key names are DERIVED from the tool field, and one overlaps a token name", () => {
  // The list that went stale was hand-written `["paper","ink","accent"]`, so a
  // sixth property on `SEEDS_FIELD` would go stale the same way. Derived at both
  // ends, and asserted non-empty first — a scan that stopped matching would leave
  // `SEED_KEYS` empty and report a clean sweep over nothing.
  assert.ok(SEED_KEYS.length >= 5, "the seeds field stopped declaring properties");
  assert.deepEqual([...SEED_KEYS].sort(), Object.keys(SEEDS_FIELD.properties).sort());

  // THE OVERLAP IS A TRIPWIRE, not decoration. `hasValue` never learns which key
  // it is answering for, so any askable TOKEN name that is also a seed key makes
  // a single-token patch read as a palette answer. Today that is exactly
  // `accent`, and it is harmless — `tokens` is not an `EDIT_FIELDS` key, so
  // nothing about applying a token patch goes through `hasValue`. A token called
  // `name` or `dark` would not be harmless, and this fails the day one arrives.
  assert.deepEqual(ASKABLE.filter((t) => SEED_KEYS.includes(t)), ["accent"],
    "a token name now collides with a palette key — see hasValue's comment");
});

test("EVERY FIELD AN EDIT CAN MOVE IS ONE THE DESIGNER IS TOLD THE CURRENT VALUE OF", () => {
  // DERIVED, because `currentStateNote` is a hand-written list and `EDIT_FIELDS`
  // is not — so adding a seventh field silently produced a value the model could
  // change while never being told what it already was. That is the shape this
  // repo has recorded three times (`publicView`'s description twice, and the
  // schema digest before it): a rule conditioned on a fact the model was never
  // given.
  //
  // It bites hardest on `lang`. The note and the tool schema are both written in
  // English, so a designer NOT told a site is Spanish has every reason to answer
  // `en` — relabelling a live site on a request that was only ever about a
  // colour.
  // A SAMPLE PER SHAPE, and the map is ASSERTED TO COVER `EDIT_FIELDS` EXACTLY.
  // Two of the fields are not strings, so a bare "value-of-x" for every one of
  // them silently stops exercising those — which is how this guard would quietly
  // stop being derived. Requiring the map to match the list means a field with a
  // NEW shape fails here, loudly, at the fixture.
  const SAMPLE = {
    brand: "value-of-brand", description: "value-of-description", seeds: { name: "Cool Slate", paper: "#f4f6f8", ink: "#20262b", accent: "#2f6f85" },
    // The note prints whatever string is stored — validation is the MERGE's job
    // (`FIELD_KEEPS.theme`), not the note's — so the marker convention works
    // here exactly as it does for `brand`.
    theme: "value-of-theme",
    // The note prints the stored mark raw, whole and uncapped — the css rule one
    // block down, for the same reason: `favicon` is REPLACED rather than merged,
    // so a designer that cannot see the current document cannot hand it back
    // with one change made.
    favicon: "value-of-favicon",
    wordmark: "value-of-wordmark",
    family: "value-of-family", lang: "value-of-lang",
    fonts: { heading: "inter", body: "inter" }, langs: ["value-of-langs"],
    // THE FIVE OTHER PLAN AXES CARRY THE SHARPEST VERSION OF THIS GUARD'S OWN
    // ARGUMENT. They are not looked up from a table any more — the designer
    // wrote them once, for this site — so one that is not shown back is one a
    // later edit has every reason to answer afresh, re-rolling the layout on a
    // request that was only ever about a colour. That is precisely the failure
    // anchoring the look was introduced to stop, arriving through five new doors.
    // THE KIND CARRIES THIS GUARD'S OWN ARGUMENT AT ITS SHARPEST: a revise
    // designer not told a site is a `tool` re-answers `shopfront` on a request
    // about a column width, and that one answer un-tools the whole site — a
    // hero, a closing pitch and a photograph budget arriving on a CRM.
    kind: "value-of-kind",
    purpose: "value-of-purpose",
    // PER PAGE SINCE 2026-08-21. The old fixture was `["value-of-shape"]`, and
    // the field's own comment above is why that mattered: a flat array now
    // yields nothing the note can print, so keeping it here would have let the
    // note go silent about the layout while this guard stayed green on a string
    // it found somewhere else. It caught exactly that on the way in.
    shape: [{ path: "value-of-pages", sections: ["value-of-shape"] }],
    action: ["value-of-action"],
    pages: [{ path: "value-of-pages", role: "a role" }],
    components: ["value-of-components"],
    // AND THE PHOTOGRAPHS, WHICH ARE THE MOST EXPENSIVE THING ON THIS LIST TO
    // LOSE (2026-08-23). Every entry is ~19 credits already spent, and the
    // re-roll is worse than churn: `budgetFor` answers 0 on a revise of a site
    // that has pictures, so a designer that re-describes them produces tokens
    // nothing buys — placeholders where bought photographs used to be.
    //
    // THE SAMPLE PUTS THE MARKER IN `describe` RATHER THAN `page`, because the
    // note prints `page = describe` and a marker in the path alone would pass
    // while the sentences — the only part a model can hand back unchanged —
    // were never shown at all.
    images: [{ page: "value-of-pages", describe: "value-of-images" }],
  };
  assert.deepEqual(Object.keys(SAMPLE).sort(), [...EDIT_FIELDS].sort(),
    "a field was added to EDIT_FIELDS without a sample of its shape — this guard would stop exercising it");
  const note = currentStateNote(SAMPLE);
  for (const k of EDIT_FIELDS) {
    // Two fields carry no "value-of-x" string because their shape has no room
    // for one — checked by what they DO put in the note instead.
    if (k === "fonts") { assert.match(note, /fonts:/, "the note does not state the fonts"); continue; }
    if (k === "seeds") {
      // All three anchors, or a designer shown only some of them fills the rest
      // in — which is a new palette on a request that was about something else.
      for (const hex of [SAMPLE.seeds.paper, SAMPLE.seeds.ink, SAMPLE.seeds.accent]) {
        assert.ok(note.includes(hex), "the note does not state the site's current " + hex);
      }
      continue;
    }
    assert.ok(note.includes("value-of-" + k),
      "`" + k + "` can be moved by an edit and the designer is never shown the site's current one");
  }
});

test("…and the rule tells it not to restate the language, in the terms the merge implements", () => {
  // `instructed: true` makes the designer's answer BEAT the stored value, so the
  // instruction to omit is the only thing holding it. Named explicitly rather
  // than left under "every other field", because the conversation being in
  // English is itself the reason a model would answer this one.
  assert.match(EDIT_RULE, /LANGUAGE/);
  assert.match(EDIT_RULE, /conversation is in English and the site may not be/i);
});

test("the css editor is told how MANY things to change and how WIDE each one reaches", () => {
  // The owner's call, 2026-08-28: "if the user wants one thing, you change one
  // thing… do not change something that the user hasn't told you to change."
  //
  // Windowed from the css paragraph to the wording one — landmark to landmark,
  // never a byte count, and both landmarks asserted before the slice, because
  // `indexOf` answering -1 gives an empty window that passes every check inside
  // it. Derived from the NEXT section's opening so anything inserted between
  // them lands inside the window rather than escaping it.
  const from = EDIT_RULE.indexOf("A change to the LOOK");
  const to = EDIT_RULE.indexOf("A change to the wording");
  assert.ok(from >= 0, "the css paragraph is gone from the edit rule");
  assert.ok(to > from, "the wording paragraph no longer follows the css one");
  const css = EDIT_RULE.slice(from, to);

  // PROPORTIONALITY: the count of edits follows the count of asks. Without it
  // "ONLY that change" leaves the model to decide what one change is worth.
  assert.match(css, /as many things as they asked|one ask is one edit/i,
    "the css editor is not told to change as many things as it was asked for");

  // WIDTH: a token is the site-wide lever and a control is the narrow one. This
  // is the half with teeth — both readings of \"make this button darker\" look
  // reasonable from inside the sheet, and only one of them is the edit asked
  // for. Asserted as the DISTINCTION, not as a banned selector: a ban-list
  // covers tonight's control and the next request is always a different one.
  assert.match(css, /\btoken\b/i, "the css editor is never told what makes a change site-wide");
  const tokenAt = css.search(/\btoken\b/i);
  assert.match(css.slice(tokenAt), /repaint|every component|whole site/i,
    "a token is named without saying that changing one reaches the whole site");

  // AND THE PLAIN RULE, which is the one the owner actually said out loud.
  assert.match(css, /NOTHING THEY DID NOT ASK FOR|did not ask for/i,
    "the css editor is not told to leave unasked-for things alone");
  // "never edit more than what the user asked for", said twice by the owner and
  // therefore stated as a hard line rather than implied by the count.
  assert.match(css, /NEVER\s+MORE/i, "the ceiling on an edit is implied but never stated");
});

test("the edit lane is told the sheet is free CSS, and told it BESIDE the ceiling", () => {
  // Owner, 2026-08-28: "instead of it being a specific theme, it's free css —
  // the model can edit anything on the page… but when they ask one thing, you
  // only edit one thing."
  //
  // The tool's cached `css` description is written for a FIRST build ("ONLY
  // WHEN ASKED", "OMIT this field entirely unless…") and is shared by both
  // lanes, so the edit lane has to override it in the user message or the model
  // reconciles two framings on its own.
  const from = EDIT_RULE.indexOf("A change to the LOOK");
  const to = EDIT_RULE.indexOf("A change to the wording");
  assert.ok(from >= 0 && to > from, "the css section's landmarks have moved");
  // Windowed from the SECTION's start, which is now the free-CSS line rather
  // than "A change to the LOOK" — derived by walking back to the blank-line
  // boundary so the window cannot miss text inserted above the old anchor.
  const head = EDIT_RULE.slice(0, from);
  const sectionStart = head.lastIndexOf("\n", head.length - 2) + 1;
  const css = EDIT_RULE.slice(sectionStart, to);

  // THE PERMISSION HALF: unlimited in what may be changed.
  assert.match(css, /yours to edit|free css|nothing on the page you cannot reach/i,
    "the edit lane never says the stylesheet is the model's to edit");
  assert.match(css, /never limited to what a theme offers|not limited to.*theme/i,
    "the edit lane does not lift the first-build framing that the theme is the look");
  // THE REACH IS NAMED AS SCOPE, NEVER AS A LIST OF PROPERTIES — the difference
  // between free CSS and a theme picker, and the owner's whole ask.
  //
  // A sweep found this gap: narrowing "any element, any component, any state,
  // any one page" to "colours, corners and typefaces" left every other
  // assertion here passing, because the surrounding sentence still promised
  // reach while the clause that DELIVERED it had become a menu. A menu is what
  // the theme era was, and the customer's next request is always the thing that
  // was not on it.
  //
  // Asserted as the three structural axes rather than the exact words, so an
  // honest rewording survives and a narrowing cannot.
  assert.match(css, /any element|every element|any component|every component/i,
    "the grant no longer reaches arbitrary elements — it has become a list of properties");
  assert.match(css, /any state|every state/i, "the grant no longer reaches component states");
  assert.match(css, /any (one )?page|every page|one page/i, "the grant no longer reaches a single page");
  // …and it must name the first-build framing it is overriding, or a model
  // holding both has no way to know which one governs here.
  assert.match(css, /FIRST build/i,
    "the override never says WHICH instruction it is overriding — two framings, no precedence");

  // THE CEILING HALF, in the same window. Either half alone misleads: permission
  // without a ceiling invites a redesign, a ceiling without permission reads as
  // a warning not to touch anything. The guard is that they travel TOGETHER.
  assert.match(css, /NEVER\s+MORE/i,
    "the edit lane grants free CSS without the ceiling beside it — that is an invitation to redesign");
  assert.ok(css.search(/yours to edit/i) < css.search(/NEVER\s+MORE/i),
    "the ceiling arrives before the permission — the model reads the licence last");
});

test("…and that rule really reaches the model, on the edit lane only", () => {
  // THE WIRING HALF. A rule perfectly worded and never sent is this repo's
  // most repeated bug, and the two are indistinguishable from outside: the
  // model not obeying and the model never being told read as the same output.
  // Asserted against the composition in worker.js rather than a list of hops.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /currentStateNote\(current\) \+ EDIT_RULE/,
    "EDIT_RULE no longer rides with the current-state note into the design call");
  // Gated on there BEING a current state — a first build must not be told it is
  // an edit, which is what the `current ?` ternary buys.
  assert.match(worker, /current \? brief \+ currentStateNote\(current\) \+ EDIT_RULE : brief/,
    "the edit rule is sent unconditionally — a first build is now told it is an edit");
});

test("naming one field moves exactly that one", () => {
  const out = mergeLook(STORED, { seeds: { name: "Cool Slate", paper: "#f4f6f8", ink: "#20262b", accent: "#2f6f85" } }, null, { instructed: true });
  assert.deepEqual(out.seeds, { name: "Cool Slate", paper: "#f4f6f8", ink: "#20262b", accent: "#2f6f85" }, "an edit that asks for a new look cannot get one");
  assert.equal(out.family, "salon");
  assert.equal(out.brand, "Sharp Fade");
  assert.deepEqual(movedFields(STORED, out), ["seeds"]);
});

test("the two that used to move on their own are held now", () => {
  // `brand` was `(designed && designed.brand) || body.brand || slug` with no
  // stored value consulted, so a designer that had seen only "fix the typo in
  // the header" decided what the site was called — and it became the <title>,
  // the og:title and the og:description while the pages kept the real name.
  const out = mergeLook(STORED, { brand: "Typo Fix", description: "Fixing a typo." }, null, { instructed: false });
  assert.equal(out.brand, "Sharp Fade", "an uninstructed designer renamed the site");
  assert.equal(out.description, "A barber shop in Leeds.");
  // …and asking DOES rename it.
  const renamed = mergeLook(STORED, { brand: "Sharp Fade Barbers" }, null, { instructed: true });
  assert.equal(renamed.brand, "Sharp Fade Barbers", "an edit that asks for a new name cannot get one");
  assert.deepEqual(movedFields(STORED, renamed), ["brand"]);
});

/* ── the interlock ──────────────────────────────────────────────────────── */

test("without `instructed` the OLD precedence holds, exactly", () => {
  // NOT TIDINESS — the new precedence is only sound because the designer was
  // TOLD to omit what it keeps. If that instruction did not reach it (the state
  // could not be read, a first build, an older caller), preferring its answer
  // would re-roll the look on every edit. The failure direction is "the edit did
  // not take", which the customer can see and say again — never "the site
  // re-themed itself".
  for (const k of ["seeds", "family", "brand", "description"]) {
    const out = mergeLook(STORED, { [k]: "something-else" }, null);
    assert.equal(out[k], STORED[k], `${k} was overridden by an uninstructed designer`);
  }
  assert.deepEqual(mergeLook(STORED, { fonts: { heading: "lora", body: "lora" } }, null).fonts, STORED.fonts);
});

test("a first build is unaffected, because there is nothing stored", () => {
  const out = mergeLook(null, { brand: "New Co", seeds: { name: "Cool Slate", paper: "#f4f6f8", ink: "#20262b", accent: "#2f6f85" }, family: "salon" }, null, { instructed: false });
  assert.equal(out.brand, "New Co");
  assert.deepEqual(out.seeds, { name: "Cool Slate", paper: "#f4f6f8", ink: "#20262b", accent: "#2f6f85" });
  // …and the body remains the last resort, which is what keeps an off-list theme
  // reachable by name.
  assert.deepEqual(mergeLook(null, null, { seeds: { name: "Off List", paper: "#ffffff", ink: "#111111", accent: "#7a3ba0" } }).seeds, { name: "Off List", paper: "#ffffff", ink: "#111111", accent: "#7a3ba0" });
  // Every field answers, so a caller can read them without guarding each one.
  for (const k of EDIT_FIELDS) assert.ok(k in out, `${k} missing from the merge`);
});

/* ── what counts as an answer ───────────────────────────────────────────── */

test("an empty answer is not an answer", () => {
  // "" and {} are how a model says nothing while appearing to answer, and
  // treating either as a value is how the empty string becomes a site's name.
  const out = mergeLook(STORED, { brand: "   ", description: "", seeds: null, fonts: {} }, null, { instructed: true });
  assert.equal(out.brand, "Sharp Fade");
  assert.equal(out.description, "A barber shop in Leeds.");
  assert.deepEqual(out.seeds, STORED.seeds);
  assert.deepEqual(out.fonts, STORED.fonts);
});

test("a half font pair is absent, not a pair", () => {
  // `{heading:"x"}` reaching the build silently defaults the other face — the
  // same rule `themeFontPair` follows for the same reason.
  assert.equal(hasValue({ heading: "lora" }), false);
  assert.equal(hasValue({ body: "geist" }), false);
  assert.equal(hasValue({ heading: "lora", body: "geist" }), true);
  assert.equal(hasValue({ heading: "lora", body: "   " }), false);
  assert.deepEqual(mergeLook(STORED, { fonts: { heading: "lora" } }, null, { instructed: true }).fonts, STORED.fonts);
});

test("hasValue on the shapes a model actually returns", () => {
  for (const v of [null, undefined, "", "  ", [], {}]) assert.equal(hasValue(v), false, JSON.stringify(v));
  for (const v of ["x", [1], { a: 1 }, 0, false]) assert.equal(hasValue(v), true, JSON.stringify(v));
});

/* ── the removal verb ───────────────────────────────────────────────────── */

/**
 * `[]` ON `langs` REALLY REMOVES, because that is what the model is told it does.
 *
 * The tool field says, in as many words: "to keep what the site has, leave it
 * out; to remove every extra language, answer `[]`". `hasValue([])` is false, so
 * the merge read the removal verb as SILENCE. Measured 2026-08-21 with prior
 * `{lang:"en", langs:["es"]}` and designed `{langs: []}`: `merged.langs` came
 * back `["es"]` and `movedFields` was `[]`.
 *
 * So the one documented way to take a language off a site could not do it at any
 * price — and the extra language's routes, prefix and switcher kept being
 * generated on every publish.
 */
test("an empty langs list is the removal verb, and it takes the language off", () => {
  const out = mergeLook(STORED, { langs: [] }, null, { instructed: true });
  assert.deepEqual(out.langs, [], "the removal verb was read as silence");
  assert.deepEqual(movedFields(STORED, out), ["langs"], "removing a language reported nothing moved");
  // …and it is exactly the one field. A removal must not be a re-theme.
  for (const k of EDIT_FIELDS) {
    if (k === "langs") continue;
    assert.deepEqual(out[k], STORED[k], `removing a language moved ${k}`);
  }
});

test("ONLY THE FIELD WHOSE TOOL DESCRIPTION PROMISES THE VERB HAS ONE", () => {
  // `pages`, `components`, `action` and `shape` are arrays on `EDIT_FIELDS` too
  // and none of them has a removal verb — a site with no pages is not something
  // anybody can ask for, and reading `[]` there as an answer would let a model
  // that filled the field in with nothing wipe the authored plan.
  for (const k of EDIT_FIELDS) {
    if (CLEARABLE_LISTS.includes(k)) continue;
    // `images` carries its verb through `keepsValue` rather than
    // `CLEARABLE_LISTS` (2026-08-27): IMAGES_FIELD promises "send an empty
    // list to say it should have none", and the build that needs it most is
    // the FIRST one — uninstructed, where `clearsField` cannot fire. Its own
    // test below drives all four paths.
    if (k === "images") continue;
    const out = mergeLook(STORED, { [k]: [] }, null, { instructed: true });
    assert.deepEqual(out[k], STORED[k], `an empty ${k} wiped the stored value`);
  }
  // The list is a subset of what an edit can move at all, or it names a field
  // the merge never looks at and the verb is unreachable.
  for (const k of CLEARABLE_LISTS) assert.ok(EDIT_FIELDS.includes(k), `${k} is not an editable field`);
});

test("a STORED empty list is the site having none, never a request to have none", () => {
  // The asymmetry, and it is the reason the verb is applied to the designer's
  // slot rather than made a value in the precedence chain. On the un-instructed
  // path the STORED value comes first — so if `[]` counted there, a site
  // recorded as `langs: []` could never be given a second language again.
  assert.deepEqual(mergeLook({ langs: [] }, { langs: ["cy"] }, null, { instructed: false }).langs, ["cy"],
    "a stored empty list beat a real answer");
  assert.deepEqual(mergeLook({ langs: [] }, { langs: ["cy"] }, null, { instructed: true }).langs, ["cy"]);
  // And the verb is gated on `instructed` for the reason the precedence is: an
  // untold designer's empty field is far more likely to be silence than a
  // decision, and being wrong toward "stored" costs an edit that can be repeated.
  assert.deepEqual(mergeLook(STORED, { langs: [] }, null, { instructed: false }).langs, STORED.langs);
  assert.equal(clearsField("langs", []), true);
  assert.equal(clearsField("langs", ["es"]), false);
  assert.equal(clearsField("pages", []), false);
});

test("removing a language a site has not got is not a change", () => {
  // It must not read as a move — there is nothing to move — but it MUST read as
  // the designer having named something, or the look lane's `named` guard sends
  // it to `escalate("no-change")`, which by contract runs the full revise: a
  // ~21-27-credit page rewrite that cannot remove a language either.
  const none = { brand: "Sharp Fade", lang: "en" };
  const out = mergeLook(none, { langs: [] }, null, { instructed: true });
  assert.deepEqual(movedFields(none, out), []);
  assert.equal(namesValue("langs", []), true, "the removal verb reads as naming nothing");
  assert.equal(namesValue("pages", []), false, "an empty plan field reads as an answer");
  // `namesValue` answers the palette question through the engine too, so the
  // guard cannot be fooled by a shape `hasValue`'s heuristic never sees.
  assert.equal(namesValue("seeds", { light: { paper: "#fffaf5", ink: "#141414", accent: "#b44a2e" } }), false);
  assert.equal(namesValue("seeds", { name: "Sea Glass", paper: "#f2f7f6", ink: "#1c2a28", accent: "#2b7a6b" }), true);
  assert.equal(keepsValue("brand", "Sharp Fade"), true);

  // A FIELD NAME OFF `Object.prototype` IS NOT A FIELD WITH A RULE. Both are
  // exported and take a field name from their caller, so the contract has to
  // hold for any string — and a truthiness lookup does not: `FIELD_KEEPS
  // ["constructor"]` is `Object`, so an empty value comes back as a String
  // object, which is truthy, and the merge would keep "" as somebody's brand.
  // The exact bug this codebase shipped once in the Stripe plan lookup.
  //
  // No LIVE call site can reach it — every one passes an `EDIT_FIELDS` name, or
  // `tokens`/`style`/`tokensPage` — so this holds a contract rather than a
  // reachable path, and the source says so.
  for (const proto of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.equal(keepsValue(proto, ""), false, `${proto} is treated as a field with a rule`);
    assert.equal(namesValue(proto, null), false, `${proto} is treated as a field with a rule`);
    assert.equal(keepsValue(proto, "Sharp Fade"), true, `${proto} refused an ordinary value`);
  }
});

test("AN ANSWERED-EMPTY `images` IS KEPT BY THE MERGE — the langs `[]` bug, one field over (2026-08-27)", () => {
  // IMAGES_FIELD promises "send an empty list to say it should have none" and
  // `images` is REQUIRED on a first build — and `hasValue([])` is false, so
  // this merge nulled the one documented way of saying "no photographs" before
  // it reached the store, and the derived rule then bought the home page one
  // anyway. Four consecutive builds against a brief saying "no photographs
  // anywhere" (runs 43–46) each bought a photograph.
  //
  // THE FIRST BUILD IS THE CASE THAT MATTERS and it is UNINSTRUCTED by
  // definition — there is no stored value to clear, only a designed answer to
  // keep — which is why this is `keepsValue` rather than `CLEARABLE_LISTS`.
  const first = mergeLook({}, { images: [] }, {}, { instructed: false });
  assert.deepEqual(first.images, [], "a first build's 'no photographs' was read as silence");
  // An UNINSTRUCTED designer's `[]` must NOT strip a site's stored pictures:
  // stored-first precedence still wins there, exactly as it does for langs.
  assert.deepEqual(
    mergeLook(STORED, { images: [] }, null, { instructed: false }).images, STORED.images,
    "an uninstructed [] stripped a site's declared photographs");
  // Instructed, the designed answer leads the chain — "remove the
  // photographs" can actually say so.
  assert.deepEqual(
    mergeLook(STORED, { images: [] }, null, { instructed: true }).images, [],
    "the instructed removal was read as silence");
  // A non-array is still not a value, so the ordinary chain runs…
  assert.deepEqual(
    mergeLook(STORED, { images: "none" }, null, { instructed: true }).images, STORED.images,
    "a bare string displaced the stored photographs");
  // …and the look lane's `named` guard reads an answered [] as the designer
  // having said something, so it cannot fall through to a rebuild that could
  // not remove them either.
  assert.equal(namesValue("images", []), true);
});

test("`kind` survives a merge like any other axis — a revise that says nothing cannot un-tool a site", () => {
  // The stored kind is what keeps a CRM a CRM across every later edit: a
  // designer answering afresh on a request about a column width would hand the
  // site back a hero, a closing pitch and a photograph budget.
  const site = { ...STORED, kind: "tool" };
  assert.equal(mergeLook(site, {}, {}, { instructed: true }).kind, "tool",
    "an edit that named nothing un-tooled the site");
  assert.equal(mergeLook(site, { brand: "Northbrew" }, {}, { instructed: true }).kind, "tool");
  // And an explicit re-answer moves it, reported as moved — changing the kind
  // IS a page-level change, which is what the escalation filter reads.
  const moved = mergeLook(site, { kind: "shopfront" }, {}, { instructed: true });
  assert.equal(moved.kind, "shopfront");
  assert.ok(movedFields(site, moved).includes("kind"), "changing the kind reported nothing moved");
});

test("THE TOOL STILL PROMISES THE VERB THIS MODULE IMPLEMENTS", () => {
  // The coupling, in both directions: the module special-cases `langs` BECAUSE
  // the tool field tells the model `[]` removes. Drop the promise and the
  // special case is a surprise; make the promise for a second field and
  // `CLEARABLE_LISTS` has to grow with it.
  //
  // COMMENTS BLANKED FIRST, length-preservingly. The comment ABOVE this field
  // also says "To REMOVE one, answer with an empty array" — prose describing a
  // thing spells that thing — so a raw scan is satisfied by the explanation even
  // when the description the model actually reads has lost it.
  const bare = worker.replace(/^([^\n]*?)\/\/[^\n]*$/gm, (line, keep) => keep + " ".repeat(line.length - keep.length));
  // CLOSED BY BRACE DEPTH, not by the next field's name. This used to end the
  // window at `mode: {` — the field that happened to follow — and went red the
  // day `mode` was deleted (2026-08-23), reporting that the LANGS field had
  // moved when nothing about it had changed. A landmark that is another field's
  // spelling is one the next deletion moves; the field's own closing brace is a
  // fact about the field.
  const at = bare.indexOf("langs: {");
  let end = -1;
  if (at > 0) {
    let d = 0;
    for (let i = bare.indexOf("{", at); i < bare.length; i++) {
      if (bare[i] === "{") d++;
      else if (bare[i] === "}" && --d === 0) { end = i; break; }
    }
  }
  assert.ok(at > 0 && end > at, "the langs tool field is no longer where this test looks");
  const field = bare.slice(at, end);
  assert.match(field, /remove/i, "the langs field no longer documents how to remove a language");
  assert.match(field, /\[\]/, "the langs field no longer promises `[]` as the removal verb");
  for (const k of CLEARABLE_LISTS) {
    assert.ok(bare.includes(k + ": {"), `${k} has a removal verb but is not a field the designer can answer`);
  }
});

/* ── what the model is shown and told ───────────────────────────────────── */

test("the state note names the current values, so `unchanged` is answerable", () => {
  // A rule to omit what is unchanged is unusable if the model does not know what
  // is unchanged — the designer was never told an edit was an edit.
  const note = currentStateNote({ ...STORED, tables: ["bookings", "services"] });
  for (const v of ["Sharp Fade", "A barber shop in Leeds.", "Warm Brick", "#b44a2e", "salon", "noto-serif", "bookings"]) {
    assert.ok(note.includes(v), `the note does not name ${v}`);
  }
  // Empty in, empty out — a first build must add nothing to the message at all.
  assert.equal(currentStateNote(null), "");
  assert.equal(currentStateNote({}), "");
});

test("the state note carries table NAMES and nothing from inside them", () => {
  // A `collect` table holds customer names and phone numbers, and this rides on
  // every edit.
  const note = currentStateNote({ brand: "X", tables: ["bookings"] });
  for (const leak of ["rows", "columns", "email", "phone"]) {
    assert.ok(!note.includes(leak), `${leak} reached the designer's message`);
  }
});

test("the rule tells the model to omit, and NOT to restate", () => {
  // Restatement drifts — that is how the look re-rolled in the first place — so
  // "do not restate" has to be said outright rather than implied by "omit".
  assert.match(EDIT_RULE, /omit/i);
  assert.match(EDIT_RULE, /DO NOT RESTATE A VALUE TO KEEP IT/);
  // And the case that caused the original bug is named with its correct answer,
  // because that is the one this has to get right or it reopens the old failure.
  //
  // THE ANSWER MOVED FROM `tokens` TO `css` (2026-08-23), when the five look
  // fields became one string. The RULE is unchanged and so is the failure it
  // prevents — a look change must not arrive as a different design — but the
  // stakes went up: `tokens` was a patch of named colours, so a bad answer moved
  // a few of them; `css` REPLACES the whole stylesheet, so a model that writes
  // one from scratch hands back a site nobody asked for. Both halves are pinned:
  // the field to use, and that whatever comes back replaces everything.
  assert.match(EDIT_RULE, /A change to the LOOK[^.]*is `css` and nothing else/);
  assert.match(EDIT_RULE, /REPLACES the whole stylesheet/i,
    "the rule no longer says a fresh sheet loses everything, which is the one thing it has to say");
  assert.match(EDIT_RULE, /omit `css`/,
    "the rule no longer says how to leave the look alone");
});

test("an edit requires nothing of the model", () => {
  // A required field is one the model MUST answer, and answering it is exactly
  // what moves a value nobody asked to move.
  assert.deepEqual(EDIT_REQUIRED, []);
  // THIS IS THE OTHER HALF OF `style` BECOMING REQUIRED (2026-08-21). One tool
  // serves the build and the revise, and the build's list now compels it — so
  // the ONLY thing keeping a phone-number correction from carrying a style patch
  // is that a revise REPLACES this array wholesale. Emptiness is not a tidy
  // default here; it is load-bearing, and it is named so a later "surely the
  // look should be required everywhere" cannot be made without reading this.
  assert.ok(!EDIT_REQUIRED.includes("style"),
    "a revise now compels a style answer, so every content edit re-rolls the look");
});

/* ── the wiring, which is where this dies silently ──────────────────────── */

test("the route reads the current state and hands it to the designer", () => {
  // worker.js cannot be imported, so every layer above can be correct while the
  // state never arrives — the shape this repo has recorded eight times.
  // ANCHORED ON THE ARGUMENT, NOT THE ARITY. This pinned the exact four-argument
  // call, so adding a FIFTH — the attached files, which the designer never saw —
  // failed a test about current state on a change that did not touch it. What
  // has to hold is that `editState` is what the call is given, whatever else
  // rides beside it.
  assert.match(worker, /designSiteSchema\(env, briefWithLinks, models\.design, editState\b/,
    "the designer is not given the site's current state, so it is still told nothing");
  // TWO READS SINCE 2026-08-24, and they are two facts: the look is config for
  // the compiled output and lives in R2 beside it, the schema describes a
  // database and stays where the database is. Both still have to reach the
  // designer, so both are asserted — a lane that reads one and not the other
  // hands the model half a site.
  assert.match(worker, /readSiteConfig\(env, editSlug, conn\)/,
    "nothing reads the stored look before the design call");
  assert.match(worker, /SELECT v FROM _meta WHERE k = 'schema'/,
    "nothing reads the stored schema before the design call");
  // EVERY `mergeLook` CALL, not one pinned expression. This matched the exact
  // `const merged = mergeLook(priorLook, designed, body, …)` and went red when
  // the route grew a SECOND call — the probe that answers which page a colour is
  // for, which has to run before the merge it feeds. A test about word order, on
  // a change that strengthened the thing it guards.
  //
  // TWO CLAIMS, because the lanes encode the interlock differently and both are
  // right: the look edit lane passes a literal `true` (it runs only when the
  // customer asked for a look change, so the designer was told by construction),
  // while the build route has to ASK, which is `!!editState`. So: no call
  // anywhere may drop it, and the calls taking `body` — the build route's shape —
  // must derive it rather than assert it.
  const calls = [...worker.matchAll(/mergeLook\(priorLook,[^;]*?\)/g)].map((x) => x[0]);
  assert.ok(calls.length >= 2, "only " + calls.length + " mergeLook calls found — the scan is broken");
  for (const c of calls) assert.match(c, /instructed:/,
    "a mergeLook call drops the interlock entirely: " + c);
  const onBuild = calls.filter((c) => /,\s*body\s*,/.test(c));
  assert.ok(onBuild.length >= 1, "no build-route mergeLook found — the scan is broken");
  for (const c of onBuild) assert.match(c, /instructed: !!editState/,
    "the interlock is gone — an untold designer can re-roll a live site again: " + c);
  // `editState` must be declared at the OUTER scope: it is read hundreds of
  // lines below the block that fills it, and inside that block it is a
  // ReferenceError on every build. Caught exactly that way on the first run.
  // ANCHORED ON THE PROPERTY, NOT THE SPELLING. This matched `let designed =
  // null;` exactly, so declaring a sibling on the same line — which the seed
  // top-up did — failed a test about hoisting on a change that hoisted nothing.
  // What matters is that both are at the OUTER scope and `editState` comes
  // after, whatever else shares their lines.
  //
  // AND IT WAS STILL A BYTE WINDOW — `[\s\S]{0,600}?` — directly under a
  // comment claiming it was anchored on the property. It went red the moment
  // the free-CSS switch was declared between the two with the paragraph that
  // explains it, which is a test about hoisting failing on a change that hoisted
  // nothing, for the SECOND time in this one assertion. This repo's most
  // repeated own-goal: never size a source-read window in bytes.
  //
  // The property has two halves and both are needed. Same indent = same scope
  // (six spaces is this route's outer level; a deeper one is a block). And
  // NOTHING BETWEEN THEM MAY OPEN A FUNCTION, or they are hoisted in two
  // different places and the ReferenceError is back with the check still green.
  const dAt = worker.indexOf("\n      let designed = null");
  const eAt = worker.indexOf("\n      let editState = null;");
  assert.ok(dAt > 0, "`let designed = null` is no longer declared at the route's outer scope");
  assert.ok(eAt > dAt, "editState is no longer hoisted at the same outer scope as `designed`, after it");
  const between = worker.slice(dAt, eAt);
  assert.ok(!/\bfunction\b|=>\s*\{/.test(between),
    "a function now opens between the two declarations — they are in different scopes: " + between.slice(0, 200));
});

test("the designer's tool drops its required list on an edit ONLY", () => {
  const swap = (worker.match(/if \(current\) req\.tools = \[[^\n]+/) || [""])[0];
  assert.match(swap, /required: EDIT_REQUIRED/,
    "an edit still requires brand/description/seeds/fonts, which is what moves them");
  // AND IT COMPOSES OFF THE TOOL ALREADY CHOSEN. This pinned the whole
  // expression, including `...SITE_SCHEMA_TOOL.input_schema` — which was
  // harmless while there was one tool and became the bug the moment there were
  // two: rebuilding from the constant discards the frontend split that the line
  // above it just applied, so an edit would silently get the backend back. The
  // property is that this line reads the request rather than the constant.
  assert.match(swap, /\.\.\.req\.tools\[0\]\.input_schema/,
    "the required swap rebuilds from the constant, which undoes whichever tool was chosen");
  assert.ok(!/SITE_SCHEMA_TOOL/.test(swap),
    "the required swap names SITE_SCHEMA_TOOL again — see the free-CSS comment below it");
  // A FIRST BUILD IS UNTOUCHED. The whole change is gated on `current`, so a
  // build sends the request it has always sent — including the cached tool block.
  // THE PROPERTY IS WHAT THE MESSAGE SAYS, not how it is assembled. This pinned
  // the literal one-line `content:` expression, so wrapping it to append the
  // attached files failed a test about the EDIT RULE on a change that left the
  // rule exactly where it was. Two things still have to hold: the state and the
  // rule ride in the USER message (never the cached blocks above it), and a
  // build with neither state nor files sends a plain STRING — the shape every
  // existing caller and test already sees.
  const msg = worker.slice(worker.indexOf('messages: [{ role: "user", content: (() => {'));
  const body = msg.slice(0, msg.indexOf("})() }],"));
  assert.ok(body.length > 60 && body.length < 900, "the designer's user message was not found whole: " + body.length);
  assert.match(body, /current \? brief \+ currentStateNote\(current\) \+ EDIT_RULE : brief/,
    "the state and rule no longer ride in the user message");
  assert.match(body, /blocks\.length \? \[\.\.\.blocks, \{ type: "text", text \}\] : text/,
    "a request with no attachments must stay a plain string, or every existing caller changes shape");
});

test("brand and description come off the merged look, not re-derived", () => {
  assert.match(worker, /const brand = String\(look\.brand \|\| body\.brand \|\| slug\)/,
    "brand is derived from the designer again, so an edit can rename the site");
  assert.match(worker, /const siteDescription = String\(look\.description \|\| body\.description/,
    "the description is derived from the designer again");
  // ONE answer to "what is this site called". Two chains is how they disagree.
  assert.equal((worker.match(/const brand = String\(/g) || []).length, 1);
});

test("the stored look is written on EVERY build, not just the first", () => {
  // `if (!priorLook)` was right while the look could never change; now an edit
  // can move it, and writing only on a first build would apply the change once
  // and let the NEXT edit resurrect the old value.
  assert.ok(!/if \(!priorLook\) \{/.test(worker),
    "the look is written only on a first build again");
  assert.match(worker, /patchSiteConfig\(env, slug, db, \{ look \}\)/,
    "the build path never stores the merged look");
  // THE STORE IS THE WHOLE MERGE, NEVER A HAND-PICKED SUBSET. This assertion
  // used to pin `brand: merged.brand, description: merged.description` — the
  // literal's own spelling — and the literal was the bug: five of mergeLook's
  // thirteen fields, silently dropping lang, mode, langs and the whole plan on
  // every build (found 2026-08-21; `lang: look.lang` had been undefined since
  // the day it was written). brand and description are carried because the
  // merge carries them, which the mergeLook tests above hold behaviourally.
  assert.match(worker, /const look = merged;/,
    "the stored look does not carry the name and description");
  assert.doesNotMatch(worker, /const look = \{\s*\n\s*seeds:/,
    "the hand-picked look literal is back — it drops every field it does not restate");
  const m = mergeLook(null, { brand: "Sharp Fade", description: "A barber shop." }, null);
  assert.equal(m.brand, "Sharp Fade");
  assert.equal(m.description, "A barber shop.");
});

/* ── the free text edit publishes the SAME meta a build does ─────────────── */

test("a text edit keeps the site's name, description and preview image", () => {
  // THREE THINGS A TYPO FIX USED TO DESTROY, and all three came from the same
  // cause: `/text` recompiles and republishes the site through its own inline
  // copy of the publish step, and that copy passed less than the build's does.
  // `injectMeta` REPLACES its fenced block, so a field not passed is a field
  // removed.
  //
  //   the <title> became the SLUG — `title: (look && look.brand) || ownerSlug`
  //   was read here from the day the route shipped, and the stored look did not
  //   carry a brand until 2026-08-10, so it always fell through. The reader was
  //   correct and nothing ever wrote the value.
  //   og:description was DROPPED — no description was passed at all.
  //   og:image was DROPPED — the build derives it from the owner's first upload
  //   and this never did.
  // ASSERTED ON THE SPINE, where the publish now lives. All three were inline in
  // the text route when they were broken, which is exactly why one spine exists:
  // the build path had them and this path did not.
  const i = worker.indexOf("async function recompileAndPublish(env, {");
  assert.ok(i > 0, "the shared spine is gone");
  const block = worker.slice(i, worker.indexOf("\nasync function siteOgImage(", i));
  assert.ok(block.length > 0, "could not read the spine");
  assert.match(block, /title: \(look && look\.brand\) \|\| slug/,
    "the recompile no longer titles the site with its own name");
  assert.match(block, /description: \(look && look\.description\) \|\| undefined/,
    "a text edit strips the site's description again");
  // …WITH THE DIST IT IS PUBLISHING (2026-08-28): `card.png` in that map is
  // what the composed-card fallback keys on, so a call without it silently
  // loses the card on this path while the build path keeps it.
  assert.match(block, /image: await siteOgImage\(env, slug, built\.files\)/,
    "a text edit strips the site's link-preview image again");
  // …and the text route has to reach it, or the spine is correct and unused.
  assert.match(worker, /recompileAndPublish\(env, \{\s*\n?\s*slug: ownerSlug, pages: ed\.pages/,
    "the text route no longer publishes through the shared spine");
  // The look it reads has to be the one that CARRIES those, or all three read
  // undefined and the guard above passes on a site with no name. The store is
  // the whole merge now — see "the stored look is written on EVERY build".
  assert.match(worker, /const look = merged;/,
    "the stored look does not carry the name and description the recompile reads");
});

test("A FAILED LOOK READ FAILS THE EDIT — never a stripped publish reported as success", () => {
  // 2026-08-14 audit: this read was wrapped in a catch that only
  // console.error'd, and a null db was equally silent — so a transient
  // Supabase/Neon blip during ANY cheap edit published the live site with no
  // theme, no colour overrides, default fonts and its SLUG as its title, told
  // the customer the edit succeeded, and archived the stripped version to
  // history. Self-healing only on the next successful publish.
  const i = worker.indexOf("async function recompileAndPublish(env, {");
  assert.ok(i > 0, "the shared spine is gone");
  const block = worker.slice(i, worker.indexOf("\nasync function siteOgImage(", i));
  // A null backend refuses — a deleted site's edit must not publish stripped.
  assert.match(block, /if \(!db\) return \{ ok: false, error: "read", ours: true/,
    "a null backend proceeds to a stripped publish");
  // The look-read catch refuses rather than falling through. Landmark-bounded
  // to the catch's own end (`resolvePair` is the first statement after it),
  // never a byte count.
  const readCatch = block.indexOf("} catch (e) {", block.indexOf("readSiteConfig(env, slug, db)"));
  // ANCHORED ON THE STYLESHEET READ, not on the font pair. It closed on
  // `const pair = resolvePair(` until 2026-08-24, when the site pair left the
  // spine with the rest of the look tier — so the window had nothing to end on
  // and the guard went red about a catch that had not moved.
  const catchEnd = block.indexOf("const cssRead = readCss(", readCatch);
  assert.ok(readCatch > 0 && catchEnd > readCatch, "the look-read catch moved — rescope this");
  assert.match(block.slice(readCatch, catchEnd), /return \{ ok: false, error: "read", ours: true/,
    "the look-read catch falls through to a stripped publish again");
  // `ours: true` is load-bearing: it routes every lane's compileMsg to the
  // honest sentence — our side, try again, nothing was charged — instead of
  // blaming the customer's change for our database blip.
  //
  // AND THE THROW IS EXPLICIT NOW, because the store answers rather than
  // throwing. `loadConfig` returns `{ok:false}` for all three cannot-tell paths
  // — the bucket, a corrupt object, the legacy database — and the spine has to
  // turn that into the refusal itself, or it falls through with an empty config
  // and publishes stripped, which is the exact bug this test was written for.
  assert.match(block, /if \(!cfg\.ok\) throw new Error\(cfg\.why/,
    "an unreadable config falls through to a stripped publish again");
  // And the legit pre-look-era state still proceeds: a read that SUCCEEDS with
  // nothing stored keeps its cheap edits, so only cannot-tell refuses. Driven
  // through the real module rather than read off the spine, because that is
  // where the distinction now lives.
  assert.equal(readConfig(""), null, "an unreadable config reads as an empty one");
  assert.deepEqual(emptyConfig(), { look: null, css: "", logo: "", icon: "", verify: null, langStrings: null, share: "" });
});

test("the preview image is derived in ONE place, for both publish paths and the picker", () => {
  // The divergence that caused it: a build derived the image inline and the text
  // edit did not. Two implementations of "publish this site" is how the second
  // quietly lacks what the first has. The function's ARITY is deliberately not
  // pinned — it grew a third parameter (the dist, for the composed card) and
  // the old `\(env, slug\)` pin failed that correct change, which is this
  // repo's most repeated own-goal.
  assert.match(worker, /async function siteOgImage\(/, "the derivation is inlined again");
  // The slug identifier is not pinned either: the share route's recompute calls
  // with its own local (`shslug`), and a `slug`-only pattern was blind to it —
  // a guard that cannot see a third call site is one that reports two readers
  // while a fourth drifts.
  const calls = [...worker.matchAll(/await siteOgImage\(env, \w+, ([^)]+)\)/g)];
  assert.equal(calls.length, 3,
    "a publish path or the share picker derives its own preview image again — or stopped passing its dist, which silently loses the composed-card fallback on that path");
  // Each publish path hands over the dist it is about to publish, and they are
  // two DIFFERENT maps — both naming one variable would mean one path publishes
  // a card resolved against the other's files. The picker's recompute has NO
  // build in hand and says so with `null`, which is the reading's own "as the
  // site stands" case — a dist faked there would claim a card the last publish
  // may never have made.
  assert.deepEqual(calls.map((m) => m[1]).sort(), ["built.files", "dist", "null"],
    "a publish path resolves the card against a dist it is not publishing");
});
