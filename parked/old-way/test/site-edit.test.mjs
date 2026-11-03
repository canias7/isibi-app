// PARKED (2026-11-03, park-old-way): the old-way half of test/site-edit.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
} from "../../../builder/site-edit.mjs";
import { normalizeSeeds, SEEDS_FIELD } from "../../../builder/site-seeds.mjs";
import { ASKABLE } from "../../../builder/site-tokens.mjs";
import { readConfig, emptyConfig } from "../../../site-config.mjs";

const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const STORED = {
  brand: "Sharp Fade", description: "A barber shop in Leeds.",
  // A REAL REGISTRY NAME, not an invented one — `FIELD_KEEPS.theme` validates
  // through `resolveTheme`, so a made-up name here would be nulled by the very
  // merge under test and every "nothing moved" loop would report a phantom.
  theme: "broadsheet",
  // A VALID MARK, for the reason the theme is a real registry name one line up:
  // `FIELD_KEEPS.favicon` validates through `readMark`, so junk here would be
  // nulled by the very merge under test and every "nothing moved" loop would
  // report a phantom.
  //
  // RE-ANCHORED 2026-09-07 (one mark, several forms). These were the legacy
  // strings `"text"` and a bare SVG document, and the merge NORMALISES a mark to
  // its form on the way out — so a legacy fixture makes every "nothing moved"
  // assertion fail on the canonicalisation rather than on a real change. The
  // form IS what a stored site holds once anything has touched its mark, so the
  // fixture is what the store really contains. THE LEGACY STRINGS ARE NOT
  // UNTESTED: `test/site-mark.test.mjs` drives both shapes through the fold and
  // through this merge, which is where that property belongs.
  wordmark: { form: "text" },
  favicon: { form: "svg", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#332a26"/><path d="M20 44 L32 20 L44 44 Z" fill="#f7f2ea"/></svg>' },
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
  // WHAT THE CONTROLS DO, and the entry is a REAL one rather than a marker
  // string for the reason the theme and the favicon above are real: the merge
  // under test is what these loops measure, so a shape it would refuse produces
  // a phantom "nothing moved" that proves nothing.
  behavior: [{
    control: "Book now", on: "pressing it", does: "opens the booking form",
    affects: "the slot picker below", result: "the form slides in with today selected",
    source: "component",
  }],
  // The scene: absent on nearly every real site, so the fixture carries the
  // ordinary answer for a site that HAS one — a string, which is the only shape
  // the field has.
  three: "a slowly turning wireframe of the chair behind the opening headline",
  // The components the kit had not got. A real entry rather than markers, for
  // the reason the theme and the favicon are real registry/valid values: these
  // loops measure the merge under test, and a shape it would refuse produces a
  // phantom "nothing moved".
  tsx: [{ name: "chair-turner", does: "the chair, turnable by dragging", props: "model: string, compact?: boolean" }],
  // A REAL animated mark and a REAL QR, for the reason the theme and the favicon
  // above are real: `FIELD_KEEPS`/`hasValue` judge these, and a shape the merge
  // would refuse turns every "nothing moved" loop into a phantom.
  gif: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><circle cx="30" cy="30" r="12" fill="#b44a2e"><animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite"/></circle></svg>',
  qr: { points: "https://sharp-fade.gofarther.app/prices", label: "Prices" },
};

/* ── the wiring, which is where this dies silently ──────────────────────── */

test("the route reads the current state and hands it to the designer", () => {
  // worker.js cannot be imported, so every layer above can be correct while the
  // state never arrives — the shape this repo has recorded eight times.
  // ANCHORED ON THE ARGUMENT, NOT THE ARITY. This pinned the exact four-argument
  // call, so adding a FIFTH — the attached files, which the designer never saw —
  // failed a test about current state on a change that did not touch it. What
  // has to hold is that `editState` is what the call is given, whatever else
  // rides beside it.
  assert.match(worker, /designSiteSchema\(env, designBrief, models\.design, editState\b/,
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
