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
  FAMILIES, FAMILY_NAMES, READY_FAMILIES, MOLD_BREAKERS,
  STRUCTURES, STRUCTURE_NAMES,
  familiesForPrompt, structuresForPrompt, layoutDirective,
} from "../builder/site-layouts.mjs";

const MD = fs.readFileSync(new URL("../builder/LAYOUTS.md", import.meta.url), "utf8");
const UI_DIR = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);
const ON_DISK = new Set(fs.readdirSync(UI_DIR).filter((f) => f.endsWith(".tsx")).map((f) => f.slice(0, -4)));
const ALL = { ...FAMILIES, ...MOLD_BREAKERS };

test("the module and LAYOUTS.md agree about which families exist — both directions", () => {
  // The md is the owner's document and the module is what runs; a family in one
  // and not the other is a silently unreachable layout or a silently invented
  // one. Matched on the heading TEXT, so a renamed family fails here rather
  // than drifting.
  const headings = [...MD.matchAll(/^## \d+\. (.+)$/gm)].map((m) => m[1].trim());
  assert.equal(headings.length, 24, "LAYOUTS.md no longer has 24 numbered families — re-derive this test");
  const mds = FAMILY_NAMES.map((n) => FAMILIES[n].md);
  for (const h of headings) assert.ok(mds.includes(h), `LAYOUTS.md family "${h}" has no module entry`);
  for (const m of mds) assert.ok(headings.includes(m), `module family "${m}" is not in LAYOUTS.md`);
  assert.equal(new Set(mds).size, mds.length, "two module families claim the same md heading");
});

test("structures and mold-breakers mirror their md sections the same way", () => {
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
  const moldBullets = [...section("## Cross-cutting: mold-breakers").matchAll(/^- \*\*(.+?)\*\*/gm)]
    .map((m) => m[1].trim());
  assert.equal(moldBullets.length, Object.keys(MOLD_BREAKERS).length);
  for (const [id, m] of Object.entries(MOLD_BREAKERS)) {
    assert.ok(moldBullets.includes(m.md), `mold-breaker "${id}" (md: "${m.md}") is not an md bullet`);
  }
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
    for (const [v, text] of Object.entries(f.variants)) {
      assert.match(v, /^[a-z][a-z0-9-]*$/, `${id} variant ${v}`);
      assert.ok(text.length > 15, `${id} variant ${v} says nothing`);
    }
  }
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
  assert.ok(list.length < 4200, `the shortlist is ${list.length} chars`);
  assert.ok(structuresForPrompt().split("\n").length === STRUCTURE_NAMES.length);
});

test("a directive carries the whole contract, and refuses everything unknown", () => {
  const READY_MOLDS = Object.keys(MOLD_BREAKERS).filter((n) => MOLD_BREAKERS[n].ready);
  for (const n of [...READY_FAMILIES, ...READY_MOLDS]) {
    const f = ALL[n];
    const d = layoutDirective(n);
    assert.ok(d, `${n} produced no directive`);
    assert.ok(d.includes(f.label), `${n}: label missing`);
    for (const line of f.shape) assert.ok(d.includes(line), `${n}: shape line missing`);
    for (const c of f.cta) assert.ok(d.includes(`"${c}"`), `${n}: cta ${c} missing`);
    for (const c of f.components) assert.ok(d.includes(c), `${n}: component ${c} missing`);
  }
  // Everything unknown or unready is null, never a best guess: a directive is a
  // promise about the kit, and a wrong one must fail at the call site. DERIVED,
  // not named — the first version hardcoded "institutional", which went stale
  // the day its component landed and everything became ready.
  const notReady = [...FAMILY_NAMES, ...Object.keys(MOLD_BREAKERS)]
    .filter((n) => !(FAMILIES[n] ?? MOLD_BREAKERS[n]).ready);
  for (const n of notReady) {
    assert.equal(layoutDirective(n), null, `${n} is not ready and must not produce a directive`);
  }
  assert.equal(layoutDirective("no-such-family"), null);
  assert.equal(layoutDirective("menu-first", { structure: "no-such-structure" }), null);
  assert.equal(layoutDirective("menu-first", { variant: "no-such-variant" }), null);
  // And the two optional axes really do land in the text.
  const d = layoutDirective("menu-first", { structure: "single-scroll", variant: "tap-list" });
  assert.ok(d.includes(STRUCTURES["single-scroll"].text));
  assert.ok(d.includes(FAMILIES["menu-first"].variants["tap-list"]));
});

test("nothing imports this yet, and that is deliberate", () => {
  // Same contract site-theme.mjs shipped under: the layer lands tested and
  // unwired, so no build behaviour changes until wiring is its own change.
  for (const file of ["worker.js", "builder/page-gen.mjs", "builder/publish-pages.mjs"]) {
    const src = fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
    assert.ok(!src.includes("site-layouts"), `${file} already imports site-layouts.mjs — wiring should be its own change`);
  }
});
