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
} from "../builder/site-edit.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const STORED = {
  brand: "Sharp Fade", description: "A barber shop in Leeds.",
  theme: "broadsheet", family: "salon", structure: "sidebar",
  fonts: { heading: "noto-serif", body: "source-sans-3" },
};

/* ── absent means unchanged ─────────────────────────────────────────────── */

test("an instructed edit that names nothing changes nothing", () => {
  // THE ORDINARY EDIT, and the case that used to re-roll the look. A designer
  // told to omit what it keeps returns only `tokens` for a colour change.
  const out = mergeLook(STORED, { tokens: { background: "#ffff00" } }, null, { instructed: true });
  for (const k of EDIT_FIELDS) assert.deepEqual(out[k], STORED[k], `${k} moved on a colour-only edit`);
  assert.deepEqual(movedFields(STORED, out), []);
});

test("naming one field moves exactly that one", () => {
  const out = mergeLook(STORED, { theme: "zine" }, null, { instructed: true });
  assert.equal(out.theme, "zine", "an edit that asks for a new look cannot get one");
  assert.equal(out.family, "salon");
  assert.equal(out.brand, "Sharp Fade");
  assert.deepEqual(movedFields(STORED, out), ["theme"]);
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
  for (const k of ["theme", "family", "structure", "brand", "description"]) {
    const out = mergeLook(STORED, { [k]: "something-else" }, null);
    assert.equal(out[k], STORED[k], `${k} was overridden by an uninstructed designer`);
  }
  assert.deepEqual(mergeLook(STORED, { fonts: { heading: "lora", body: "lora" } }, null).fonts, STORED.fonts);
});

test("a first build is unaffected, because there is nothing stored", () => {
  const out = mergeLook(null, { brand: "New Co", theme: "glass", family: "salon" }, null, { instructed: false });
  assert.equal(out.brand, "New Co");
  assert.equal(out.theme, "glass");
  // …and the body remains the last resort, which is what keeps an off-list theme
  // reachable by name.
  assert.equal(mergeLook(null, null, { theme: "off-list" }).theme, "off-list");
  // Every field answers, so a caller can read them without guarding each one.
  for (const k of EDIT_FIELDS) assert.ok(k in out, `${k} missing from the merge`);
});

/* ── what counts as an answer ───────────────────────────────────────────── */

test("an empty answer is not an answer", () => {
  // "" and {} are how a model says nothing while appearing to answer, and
  // treating either as a value is how the empty string becomes a site's name.
  const out = mergeLook(STORED, { brand: "   ", description: "", theme: null, fonts: {} }, null, { instructed: true });
  assert.equal(out.brand, "Sharp Fade");
  assert.equal(out.description, "A barber shop in Leeds.");
  assert.equal(out.theme, "broadsheet");
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

/* ── what the model is shown and told ───────────────────────────────────── */

test("the state note names the current values, so `unchanged` is answerable", () => {
  // A rule to omit what is unchanged is unusable if the model does not know what
  // is unchanged — the designer was never told an edit was an edit.
  const note = currentStateNote({ ...STORED, tables: ["bookings", "services"] });
  for (const v of ["Sharp Fade", "A barber shop in Leeds.", "broadsheet", "salon", "sidebar", "noto-serif", "bookings"]) {
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
  assert.match(EDIT_RULE, /A change to a colour is `tokens` and nothing else/);
});

test("an edit requires nothing of the model", () => {
  // A required field is one the model MUST answer, and answering it is exactly
  // what moves a value nobody asked to move.
  assert.deepEqual(EDIT_REQUIRED, []);
});

/* ── the wiring, which is where this dies silently ──────────────────────── */

test("the route reads the current state and hands it to the designer", () => {
  // worker.js cannot be imported, so every layer above can be correct while the
  // state never arrives — the shape this repo has recorded eight times.
  assert.match(worker, /designSiteSchema\(env, briefWithLinks, models\.design, editState\)/,
    "the designer is not given the site's current state, so it is still told nothing");
  assert.match(worker, /SELECT k, v FROM _meta WHERE k IN \('site_look','schema'\)/,
    "nothing reads the stored look and schema before the design call");
  assert.match(worker, /const merged = mergeLook\(priorLook, designed, body, \{ instructed: !!editState \}\)/,
    "the interlock is gone — an untold designer can re-roll a live site again");
  // `editState` must be declared at the OUTER scope: it is read hundreds of
  // lines below the block that fills it, and inside that block it is a
  // ReferenceError on every build. Caught exactly that way on the first run.
  assert.match(worker, /let designed = null;[\s\S]{0,600}let editState = null;/,
    "editState is no longer hoisted beside `designed`");
});

test("the designer's tool drops its required list on an edit ONLY", () => {
  assert.match(worker, /if \(current\) req\.tools = \[\{ \.\.\.req\.tools\[0\], input_schema: \{ \.\.\.SITE_SCHEMA_TOOL\.input_schema, required: EDIT_REQUIRED \} \}\]/,
    "an edit still requires brand/description/theme/family, which is what moves them");
  // A FIRST BUILD IS UNTOUCHED. The whole change is gated on `current`, so a
  // build sends the request it has always sent — including the cached tool block.
  assert.match(worker, /messages: \[\{ role: "user", content: current \? brief \+ currentStateNote\(current\) \+ EDIT_RULE : brief \}\]/,
    "the state and rule no longer ride in the user message, or a build's message changed shape");
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
  assert.match(worker, /INSERT INTO _meta \(k,v\) VALUES \('site_look'[\s\S]{0,120}JSON\.stringify\(look\)/);
  // brand and description have to be IN what gets stored, or the next edit reads
  // a look that never held them and they go back to being re-derived.
  assert.match(worker, /brand: merged\.brand,\s*\n\s*description: merged\.description,/,
    "the stored look does not carry the name and description");
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
  const i = worker.indexOf("const tx = url.pathname.match");
  assert.ok(i > 0, "the text-edit route is gone");
  const block = worker.slice(i, worker.indexOf("if (vr) {", i));
  assert.ok(block.length > 0, "could not read the text-edit route");
  assert.match(block, /title: \(look && look\.brand\) \|\| ownerSlug/,
    "the recompile no longer titles the site with its own name");
  assert.match(block, /description: \(look && look\.description\) \|\| undefined/,
    "a text edit strips the site's description again");
  assert.match(block, /image: await siteOgImage\(env, ownerSlug\)/,
    "a text edit strips the site's link-preview image again");
  // The look it reads has to be the one that CARRIES those, or all three read
  // undefined and the guard above passes on a site with no name.
  assert.match(worker, /brand: merged\.brand,\s*\n\s*description: merged\.description,/,
    "the stored look does not carry the name and description the recompile reads");
});

test("the preview image is derived in ONE place, for both publish paths", () => {
  // The divergence that caused it: a build derived the image inline and the text
  // edit did not. Two implementations of "publish this site" is how the second
  // quietly lacks what the first has.
  assert.match(worker, /async function siteOgImage\(env, slug\)/, "the derivation is inlined again");
  assert.equal((worker.match(/await siteOgImage\(env, /g) || []).length, 2,
    "one of the two publish paths derives its own preview image again");
});
