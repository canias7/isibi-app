// The layout layer, and the two properties it exists to guarantee: the module
// mirrors builder/LAYOUTS.md exactly, and nothing it tells the model to reach
// for is missing from the kit.
//
// NOT WIRED YET — nothing imports site-layouts.mjs, and a test below enforces
// that, the same contract site-theme.mjs shipped under.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  FAMILIES, FAMILY_NAMES, READY_FAMILIES,
  STRUCTURES, STRUCTURE_NAMES,
  familiesForPrompt, structuresForPrompt, layoutDirective,
} from "../builder/site-layouts.mjs";

const MD = fs.readFileSync(new URL("../builder/LAYOUTS.md", import.meta.url), "utf8");
const UI_DIR = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);
const ON_DISK = new Set(fs.readdirSync(UI_DIR).filter((f) => f.endsWith(".tsx")).map((f) => f.slice(0, -4)));
// Was `{ ...FAMILIES, ...MOLD_BREAKERS }`. The two mold-breakers are ordinary
// families now, so every per-family assertion below reaches them by covering
// FAMILIES — and reaches the checks they never had, because they were only
// ever in that second object and never in FAMILY_NAMES.
const ALL = FAMILIES;

test("the module and LAYOUTS.md agree about which families exist — both directions", () => {
  // The md is the owner's document and the module is what runs; a family in one
  // and not the other is a silently unreachable layout or a silently invented
  // one. Matched on the heading TEXT, so a renamed family fails here rather
  // than drifting.
  const headings = [...MD.matchAll(/^## \d+\. (.+)$/gm)].map((m) => m[1].trim());
  assert.equal(headings.length, FAMILY_NAMES.length,
    `LAYOUTS.md has ${headings.length} numbered families and the module has ${FAMILY_NAMES.length} — derived, not a literal, because the hard-coded 26 went red on a correct addition`);
  const mds = FAMILY_NAMES.map((n) => FAMILIES[n].md);
  for (const h of headings) assert.ok(mds.includes(h), `LAYOUTS.md family "${h}" has no module entry`);
  for (const m of mds) assert.ok(headings.includes(m), `module family "${m}" is not in LAYOUTS.md`);
  assert.equal(new Set(mds).size, mds.length, "two module families claim the same md heading");
});

test("structures mirror their md section the same way families do", () => {
  const section = (title) => {
    const i = MD.indexOf(title);
    assert.ok(i >= 0, `LAYOUTS.md lost its "${title}" section`);
    const rest = MD.slice(i);
    const end = rest.indexOf("\n## ", 4);
    return end === -1 ? rest : rest.slice(0, end);
  };
  const variantBullets = [...section("## Cross-cutting: structural variants").matchAll(/^- (.+)$/gm)]
    .map((m) => m[1].trim());
  assert.equal(variantBullets.length, STRUCTURE_NAMES.length,
    `md lists ${variantBullets.length} structural variants, the module ${STRUCTURE_NAMES.length}`);
  for (const n of STRUCTURE_NAMES) {
    assert.ok(variantBullets.includes(STRUCTURES[n].md), `structure "${n}" (md: "${STRUCTURES[n].md}") is not an md bullet`);
  }
  // The mold-breaker half of this test went with the concept. It asserted that
  // the md's two bullets matched a SECOND table of shapes — and that second
  // table was exactly the problem: being outside FAMILIES is what made
  // marketplace and directory unpickable. They are numbered families in the md
  // now, so the families mirror test above covers them, and it is the stronger
  // check — it runs both directions, and every other per-family guard in this
  // file now runs on them too.
  assert.ok(!MD.includes("## Cross-cutting: mold-breakers"),
    "the mold-breakers section is back in LAYOUTS.md — either those shapes are families or this test needs its other half again");
});

test("every family is complete and enum-safe", () => {
  for (const [id, f] of Object.entries(ALL)) {
    assert.match(id, /^[a-z][a-z0-9-]*$/, `${id} is not enum-safe`);
    assert.ok(f.label && f.label.length > 15, `${id} has no real label`);
    assert.ok(Array.isArray(f.cta) && f.cta.length >= 1 && f.cta.length <= 4, `${id} cta`);
    assert.ok(Array.isArray(f.shape) && f.shape.length >= 2 && f.shape.length <= 4,
      `${id} shape must be 2-4 lines, has ${f.shape?.length}`);
    for (const line of f.shape) assert.ok(line.length > 10 && line.length < 220, `${id} shape line length`);
    assert.ok(f.kinds.length >= 1, `${id} names nobody it is for`);
    // The skeleton: every family declares a structure the table offers.
    assert.ok(STRUCTURES[f.structure], `${id} declares structure "${f.structure}", which is not one of the eight`);
    // The page set: index first, flat enum-safe route files, each with a real
    // role sentence. 1–5 because zero pages is no site and past five the
    // family should be questioning itself.
    // 1–5 SHIPPED pages. `pages` also carries the reference app's alternative
    // homes, which are marked `alt` and are not part of what a site ships —
    // counting them here would make a family with two alternatives look like a
    // seven-page site and would cap how many alternatives it may keep.
    const shipped = f.pages.filter((x) => !x.alt);
    assert.ok(Array.isArray(f.pages) && shipped.length >= 1 && shipped.length <= 5, `${id} pages`);
    for (const a of f.pages.filter((x) => x.alt)) {
      assert.notEqual(a.file, "index", `${id}: an alt page cannot be the index`);
    }
    assert.equal(f.pages[0].file, "index", `${id}'s first page must be index`);
    const files = f.pages.map((p) => p.file);
    assert.equal(new Set(files).size, files.length, `${id} declares a page twice`);
    for (const p of f.pages) {
      assert.match(p.file, /^[a-z][a-z0-9-]*$/, `${id} page "${p.file}" is not a flat route file`);
      assert.ok(p.role && p.role.length > 20 && p.role.length < 140, `${id} page "${p.file}" role length`);
    }
  }
});

test("all eight structures are somebody's default — no skeleton is decorative", () => {
  // The reason the axis exists (owner's call, 2026-08-01): every reference app
  // shared one band rhythm, so every generated site did too. Each structure
  // must be at least one family's default, or it is a name in a table with no
  // rendered embodiment — the blocks-and-examples failure shape again.
  for (const st of STRUCTURE_NAMES) {
    assert.ok(FAMILY_NAMES.some((n) => FAMILIES[n].structure === st),
      `structure "${st}" is nobody's default`);
  }
  // And the defaults must actually SPREAD — if one structure covers most of
  // the set, the sameness this exists to break is back under a new name.
  const counts = {};
  for (const n of FAMILY_NAMES) counts[FAMILIES[n].structure] = (counts[FAMILIES[n].structure] || 0) + 1;
  assert.ok(Math.max(...Object.values(counts)) <= FAMILY_NAMES.length / 2,
    `one structure is the default for over half the families: ${JSON.stringify(counts)}`);
});

test("page counts DIFFER by family — the flat budget is gone", () => {
  // The whole point of the field (owner's call, 2026-08-01): a café is one
  // scroll, a docs site is four linked pages. A regression to a uniform count
  // — any uniform count — recreates the every-site-is-the-same-depth failure.
  const counts = FAMILY_NAMES.map((n) => FAMILIES[n].pages.length);
  assert.ok(new Set(counts).size >= 3, `page counts collapsed to ${[...new Set(counts)]}`);
  assert.ok(counts.includes(1), "no single-page family left — campaign's definition IS one page");
  assert.ok(counts.some((c) => c >= 4), "no deep family left — documentation is four linked pages");
});

test("every component a family cites exists in the kit", () => {
  // The whole point of the layer's guard. A directive naming a component that
  // is not on disk is an instruction to import something absent — the exact
  // failure class the page lint exists to catch, moved upstream to where it is
  // free.
  for (const [id, f] of Object.entries(ALL)) {
    assert.ok(f.components.length >= 3, `${id} cites almost nothing`);
    assert.equal(new Set(f.components).size, f.components.length, `${id} cites a component twice`);
    for (const c of f.components) {
      assert.ok(ON_DISK.has(c), `${id} cites "${c}", which is not in the kit`);
    }
  }
});

test("readiness is DERIVED from disk, so the flag cannot go stale either way", () => {
  // A not-ready family names what it awaits in `wants`. The moment the other
  // session lands that component, this test FAILS on that family with the flip
  // instruction — so "the component exists but the family is still off" and
  // "the family is on but the component is missing" are both impossible states.
  for (const [id, f] of Object.entries(ALL)) {
    const wants = f.wants ?? [];
    const satisfied = wants.every((w) => ON_DISK.has(w));
    assert.equal(f.ready, satisfied,
      f.ready
        ? `${id} is marked ready but wants [${wants.filter((w) => !ON_DISK.has(w))}] — un-ready it or land the component`
        : `${id}'s wanted components all exist now — set ready: true, move the wants into components, and delete the wants field`);
    if (f.ready) assert.equal(wants.length, 0, `${id} is ready but still carries a wants field`);
    else assert.ok(wants.length > 0, `${id} is not ready but wants nothing — one of the two is wrong`);
    // And a wanted component must never ALREADY be cited, or the directive
    // would name it while the family is off.
    for (const w of wants) assert.ok(!f.components.includes(w), `${id} cites "${w}" while waiting for it`);
  }
});

test("every wanted component is specced in the gaps doc for the other session", () => {
  const gaps = fs.readFileSync(new URL("../builder/component-gaps.md", import.meta.url), "utf8");
  for (const [id, f] of Object.entries(ALL)) {
    for (const w of f.wants ?? []) {
      assert.ok(gaps.includes("`" + w + "`"), `${id} wants "${w}" but component-gaps.md never specs it`);
    }
  }
});

test("the prompt shortlist offers ready families only, and stays cheap", () => {
  const list = familiesForPrompt();
  for (const n of READY_FAMILIES) assert.ok(list.includes(n + " — "), `${n} missing from the shortlist`);
  for (const n of FAMILY_NAMES.filter((x) => !FAMILIES[x].ready)) {
    assert.ok(!list.includes(n + " — "), `${n} is not ready and must not be offered`);
  }
  // THE ABSOLUTE CEILING IS NOW DERIVED, because a literal one has gone stale
  // on a CORRECT addition three times: 4,200 fired when the 27th family landed,
  // 6,600 when the 49th did. A budget guard that freezes the thing it is
  // budgeting for is the wrong shape, and raising the number each time is not a
  // guard, it is a ritual.
  //
  // What actually needs watching is the cost PER FAMILY — a kinds list growing
  // to twenty, or the LABEL coming back. That is the runaway, and the count is
  // not: this list rides in the design call's `cache_control: ephemeral` block,
  // so after the first build of a deploy it is a cache read rather than fresh
  // input, and one more family is one more line.
  //
  // 115, DOWN FROM 145 ON 2026-08-04, and the drop is the point rather than an
  // incidental. The label left this block that day, taking 56% of it with it,
  // and the reading went 144.1 -> 93.0. A ceiling left at 145 would have been
  // slack enough to let the whole label creep back without a word — a guard
  // that cannot fail is not one, and this file has said so about three other
  // numbers already.
  const perFamily = list.length / READY_FAMILIES.length;
  assert.ok(perFamily < 115, `${Math.round(perFamily)} chars per family — a kinds list has run away, or the label is back`);
  assert.ok(list.length < READY_FAMILIES.length * 115,
    `the shortlist is ${list.length} chars for ${READY_FAMILIES.length} families`);
  // A backstop on the WHOLE block, not on the count. Cached or not, a shortlist
  // this size would be a different conversation about what belongs in a tool
  // description — it is here to force that conversation, not to cap growth.
  assert.ok(list.length < 20000, `the shortlist is ${list.length} chars — time to reconsider the shape, not the number`);
  assert.ok(structuresForPrompt().split("\n").length === STRUCTURE_NAMES.length);
});

// THE LABEL IS THE LAYOUT STRATEGY AND IT DOES NOT BELONG AT CHOOSE TIME.
//
// It was 56% of this block and it was already being sent a second time, in full
// and with far more detail, as `layoutDirective` on the page call. The design
// step is not building anything — it answers "which of these hundred is the
// business in front of me", and how the pages get arranged is not evidence for
// that. Removing it took 3,895 tokens to 2,513 while BUYING two more trades per
// family, which is the half that actually decides the answer.
//
// DERIVED, not a character budget. The ceiling above would catch the label
// coming back wholesale; this catches one creeping in. And it asserts the other
// direction too, because a saving that quietly dropped the trades would pass a
// label check perfectly while destroying the thing the block is for.
test("the choose-time list carries trades, never layout strategy", () => {
  const list = familiesForPrompt();
  for (const n of READY_FAMILIES) {
    const f = FAMILIES[n];
    assert.ok(!list.includes(f.label),
      `${n}'s LABEL is back in the choose-time prompt — that is layout strategy, and layoutDirective already sends it`);
    // The trades are what a brief's own words match against. Six, and the first
    // one at minimum has to survive any future edit to this line.
    assert.ok(list.includes(f.kinds[0]),
      `${n} offers none of its trades — the design step has nothing to match a brief against`);
  }
  // And the shape: one line per family, "key — trades", nothing else.
  for (const line of list.split("\n")) {
    assert.match(line, /^[a-z][a-z0-9-]* — [^—]+$/,
      `a shortlist line grew a second clause: ${JSON.stringify(line.slice(0, 90))}`);
  }
});

test("a directive carries the whole contract, and refuses everything unknown", () => {
  for (const n of READY_FAMILIES) {
    const f = ALL[n];
    const d = layoutDirective(n);
    assert.ok(d, `${n} produced no directive`);
    assert.ok(d.includes(f.label), `${n}: label missing`);
    for (const line of f.shape) assert.ok(d.includes(line), `${n}: shape line missing`);
    for (const c of f.cta) assert.ok(d.includes(`"${c}"`), `${n}: cta ${c} missing`);
    for (const c of f.components) assert.ok(d.includes(c), `${n}: component ${c} missing`);
    // SHIPPED, not declared. The directive deliberately omits alt pages — a
    // customer's salon must not be told to build a /call-now route — so this
    // asserting the raw length would demand the exact bug the flag prevents.
    const shipped = f.pages.filter((p) => !p.alt);
    assert.ok(d.includes(`ships ${shipped.length} page`), `${n}: page count missing`);
    for (const a of f.pages.filter((p) => p.alt)) {
      assert.ok(!d.includes(`/${a.file} —`), `${n}: alt page ${a.file} leaked into the directive`);
    }
    assert.ok(d.includes(`Structure — ${f.structure}:`), `${n}: default structure missing from directive`);
    for (const p of shipped) {
      assert.ok(d.includes(`${p.file === "index" ? "/" : "/" + p.file} — ${p.role}`), `${n}: page ${p.file} missing`);
    }
  }
  // Everything unknown or unready is null, never a best guess: a directive is a
  // promise about the kit, and a wrong one must fail at the call site. DERIVED,
  // not named — the first version hardcoded "institutional", which went stale
  // the day its component landed and everything became ready.
  const notReady = FAMILY_NAMES.filter((n) => !FAMILIES[n].ready);
  for (const n of notReady) {
    assert.equal(layoutDirective(n), null, `${n} is not ready and must not produce a directive`);
  }
  assert.equal(layoutDirective("no-such-family"), null);
  assert.equal(layoutDirective("restaurant", { structure: "no-such-structure" }), null);
  // And the two optional axes really do land in the text.
  const d = layoutDirective("restaurant", { structure: "single-scroll" });
  assert.ok(d.includes(STRUCTURES["single-scroll"].text));
});

test("this IS wired now, and the chain is guarded next door", () => {
  // Was the opposite assertion — "nothing imports this yet, and that is
  // deliberate" — which was correct until wiring landed as its own change, as
  // that test asked for. Replaced rather than deleted, because an unwired layer
  // is the exact shape of the blocks and examples this repo installed twice and
  // deleted twice, and something has to keep saying so.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(src.includes("site-layouts"), "worker.js no longer imports site-layouts.mjs — the families are unreachable again");
  assert.ok(
    fs.existsSync(new URL("./wiring.test.mjs", import.meta.url)),
    "the reachability chain that guards this has been deleted",
  );
});
