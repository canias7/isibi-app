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
  seeds: { name: "Warm Brick", paper: "#f7f2ea", ink: "#332a26", accent: "#b44a2e" }, family: "salon", structure: "sidebar",
  fonts: { heading: "noto-serif", body: "source-sans-3" },
  lang: "en-GB", mode: "light", langs: ["es"],
  // The five other plan axes, stored per site since 2026-08-20. `family` is
  // still here beside them ON PURPOSE: nothing sets one any more, and every site
  // built before that date has one, so the merge has to keep carrying it.
  purpose: "the slot picker is the hero; everything else supports the appointment",
  shape: ["the chair list leads", "prices, then the booking form"],
  action: ["Book now"],
  pages: [{ path: "/", role: "book a chair" }, { path: "/prices", role: "what each cut costs" }],
  components: ["availability-grid", "week-strip", "price-list"],
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
  assert.ok(read.size >= 5, "the scan found only " + read.size + " look reads, so it has stopped scanning");
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
    family: "value-of-family", structure: "value-of-structure", lang: "value-of-lang",
    mode: "value-of-mode", fonts: { heading: "inter", body: "inter" }, langs: ["value-of-langs"],
    // THE FIVE OTHER PLAN AXES CARRY THE SHARPEST VERSION OF THIS GUARD'S OWN
    // ARGUMENT. They are not looked up from a table any more — the designer
    // wrote them once, for this site — so one that is not shown back is one a
    // later edit has every reason to answer afresh, re-rolling the layout on a
    // request that was only ever about a colour. That is precisely the failure
    // anchoring the look was introduced to stop, arriving through five new doors.
    purpose: "value-of-purpose",
    shape: ["value-of-shape"],
    action: ["value-of-action"],
    pages: [{ path: "value-of-pages", role: "a role" }],
    components: ["value-of-components"],
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
  for (const k of ["seeds", "family", "structure", "brand", "description"]) {
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

/* ── what the model is shown and told ───────────────────────────────────── */

test("the state note names the current values, so `unchanged` is answerable", () => {
  // A rule to omit what is unchanged is unusable if the model does not know what
  // is unchanged — the designer was never told an edit was an edit.
  const note = currentStateNote({ ...STORED, tables: ["bookings", "services"] });
  for (const v of ["Sharp Fade", "A barber shop in Leeds.", "Warm Brick", "#b44a2e", "salon", "sidebar", "noto-serif", "bookings"]) {
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
  // ANCHORED ON THE ARGUMENT, NOT THE ARITY. This pinned the exact four-argument
  // call, so adding a FIFTH — the attached files, which the designer never saw —
  // failed a test about current state on a change that did not touch it. What
  // has to hold is that `editState` is what the call is given, whatever else
  // rides beside it.
  assert.match(worker, /designSiteSchema\(env, briefWithLinks, models\.design, editState\b/,
    "the designer is not given the site's current state, so it is still told nothing");
  assert.match(worker, /SELECT k, v FROM _meta WHERE k IN \('site_look','schema'\)/,
    "nothing reads the stored look and schema before the design call");
  assert.match(worker, /const merged = mergeLook\(priorLook, designed, body, \{ instructed: !!editState \}\)/,
    "the interlock is gone — an untold designer can re-roll a live site again");
  // `editState` must be declared at the OUTER scope: it is read hundreds of
  // lines below the block that fills it, and inside that block it is a
  // ReferenceError on every build. Caught exactly that way on the first run.
  // ANCHORED ON THE PROPERTY, NOT THE SPELLING. This matched `let designed =
  // null;` exactly, so declaring a sibling on the same line — which the seed
  // top-up did — failed a test about hoisting on a change that hoisted nothing.
  // What matters is that both are at the OUTER scope and `editState` comes
  // after, whatever else shares their lines.
  const outer = worker.match(/\n {6}let designed = null[^\n]*\n[\s\S]{0,600}?\n {6}let editState = null;/);
  assert.ok(outer, "editState is no longer hoisted at the same outer scope as `designed`");
});

test("the designer's tool drops its required list on an edit ONLY", () => {
  assert.match(worker, /if \(current\) req\.tools = \[\{ \.\.\.req\.tools\[0\], input_schema: \{ \.\.\.SITE_SCHEMA_TOOL\.input_schema, required: EDIT_REQUIRED \} \}\]/,
    "an edit still requires brand/description/seeds/fonts, which is what moves them");
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
  assert.match(block, /image: await siteOgImage\(env, slug\)/,
    "a text edit strips the site's link-preview image again");
  // …and the text route has to reach it, or the spine is correct and unused.
  assert.match(worker, /recompileAndPublish\(env, \{\s*\n?\s*slug: ownerSlug, pages: ed\.pages/,
    "the text route no longer publishes through the shared spine");
  // The look it reads has to be the one that CARRIES those, or all three read
  // undefined and the guard above passes on a site with no name.
  assert.match(worker, /brand: merged\.brand,\s*\n\s*description: merged\.description,/,
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
  const readCatch = block.indexOf("} catch (e) {", block.indexOf("sqlQuery(db,"));
  const catchEnd = block.indexOf("const pair = resolvePair(", readCatch);
  assert.ok(readCatch > 0 && catchEnd > readCatch, "the look-read catch moved — rescope this");
  assert.match(block.slice(readCatch, catchEnd), /return \{ ok: false, error: "read", ours: true/,
    "the look-read catch falls through to a stripped publish again");
  // `ours: true` is load-bearing: it routes every lane's compileMsg to the
  // honest sentence — our side, try again, nothing was charged — instead of
  // blaming the customer's change for our database blip.
  // And the legit pre-look-era state still proceeds: a read that SUCCEEDS
  // with no rows keeps its cheap edits, so only cannot-tell refuses.
  assert.match(block, /for \(const r of rows \|\| \[\]\)/, "the legit no-rows path is gone");
});

test("the preview image is derived in ONE place, for both publish paths", () => {
  // The divergence that caused it: a build derived the image inline and the text
  // edit did not. Two implementations of "publish this site" is how the second
  // quietly lacks what the first has.
  assert.match(worker, /async function siteOgImage\(env, slug\)/, "the derivation is inlined again");
  assert.equal((worker.match(/await siteOgImage\(env, /g) || []).length, 2,
    "one of the two publish paths derives its own preview image again");
});
