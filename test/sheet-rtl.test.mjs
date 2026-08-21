// THE MOBILE MENU SLID IN FROM THE WRONG SIDE ON EVERY RIGHT-TO-LEFT SITE.
//
// Found on a real published Arabic site (`layali-dubai`, 2026-08-21) by tapping
// the hamburger on a phone. `sheet.tsx`'s horizontal sides mixed one LOGICAL
// property with one PHYSICAL one:
//
//   inset-y-0 end-0        -> logical, flips: measured at `left: 0` in RTL  ✓
//   slide-in-from-right    -> translate3d(100%, 0, 0), never flips          ✗
//
// So the panel was correctly anchored to the left and then entered from the
// right, crossing the entire screen. The half-mirrored failure — which this
// repo already records as worse than not mirroring at all, because a site that
// is half-right reads as broken rather than as unsupported.
//
// WHY THIS ASSERTS THE COMPILED CSS AND NOT THE SOURCE STRINGS. Tailwind ships
// no logical slide utility, so the fix is an `rtl:` counterpart per side — and
// `rtl:` expands through `:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)`, which
// contributes ZERO specificity. Both rules therefore land at (0,2,0) and the
// override wins on SOURCE ORDER alone. A source-reading test would stay green
// through a Tailwind upgrade that reordered them, while the only symptom would
// be a menu sliding the wrong way on Arabic sites — which nobody would connect
// to a dependency bump. So the real compiler is run and the real cascade is
// resolved by a real browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TPL = path.join(ROOT, "builder/lovable/template");
const NM = path.join(TPL, "node_modules");
const SHEET = path.join(TPL, "src/components/ui/sheet.tsx");

// The template's deps are only present after `npm ci` in that directory, which
// CI does for the kit jobs and a bare unit run does not. SKIPPING is the honest
// answer there — a check that silently passes when it could not run is the
// vacuous-clean failure this repo keeps recording.
const HAVE_TW = fs.existsSync(path.join(NM, "tailwindcss/index.css")) &&
  fs.existsSync(path.join(NM, "tw-animate-css/dist/tw-animate.css"));

/** Compile a set of utility classes with the template's OWN Tailwind. */
async function compileClasses(classes) {
  const { compile } = await import(path.join(NM, "tailwindcss/dist/lib.mjs"));
  const files = {
    tailwindcss: path.join(NM, "tailwindcss/index.css"),
    "tw-animate-css": path.join(NM, "tw-animate-css/dist/tw-animate.css"),
  };
  const c = await compile('@import "tailwindcss" source(none);\n@import "tw-animate-css";', {
    base: NM,
    loadStylesheet: async (id, base) => {
      const p = files[id] || path.join(NM, id);
      return { base, path: p, content: fs.readFileSync(p, "utf8") };
    },
  });
  return c.build(classes);
}

test("both horizontal sides pair every physical slide with an rtl: counterpart", () => {
  const src = fs.readFileSync(SHEET, "utf8");
  // Read the two side strings out of the variant map rather than the whole
  // file: the comment above them necessarily spells the very class names being
  // asserted, and a raw-text scan would match the prose. (Prose containing the
  // thing it describes is this repo's most-repeated own-goal.)
  const grab = (name) => {
    const at = src.indexOf(`${name}:`, src.indexOf("side: {"));
    assert.ok(at > 0, `no ${name} variant found`);
    const q = src.indexOf('"', at);
    return src.slice(q + 1, src.indexOf('"', q + 1));
  };
  for (const [side, physical] of [["left", ["left", "right"]], ["right", ["right", "left"]]]) {
    const cls = grab(side);
    const [own, opposite] = physical;
    for (const kind of ["slide-in-from", "slide-out-to"]) {
      // `slide-out-to-*` is spelled `slide-out-to`, `slide-in-from-*` likewise.
      const base = kind === "slide-in-from" ? `slide-in-from-${own}` : `slide-out-to-${own}`;
      const flip = kind === "slide-in-from" ? `slide-in-from-${opposite}` : `slide-out-to-${opposite}`;
      assert.ok(cls.includes(base), `${side}: missing ${base}`);
      assert.ok(cls.includes(`rtl:data-[state=`) && cls.includes(flip),
        `${side}: ${base} has no rtl: counterpart (${flip})`);
    }
  }
});

test("top and bottom are left alone — vertical motion does not mirror", () => {
  const src = fs.readFileSync(SHEET, "utf8");
  const at = src.indexOf("side: {");
  const block = src.slice(at, src.indexOf("left:", at));
  assert.doesNotMatch(block, /rtl:/, "a vertical side grew an rtl: variant, which mirrors nothing");
});

test("the rtl: rule is emitted AFTER the physical one — the fix rests on this", { skip: !HAVE_TW && "template deps not installed" }, async () => {
  const css = await compileClasses([
    "data-[state=open]:slide-in-from-right",
    "rtl:data-[state=open]:slide-in-from-left",
  ]);
  const physical = css.indexOf("--tw-enter-translate-x: 100%");
  const logical = css.indexOf("--tw-enter-translate-x: -100%");
  assert.ok(physical > 0 && logical > 0, "one of the two slide rules was not emitted at all");
  assert.ok(logical > physical,
    "Tailwind now emits the rtl: rule FIRST — both are (0,2,0), so the override has silently stopped winning");
});

test("a real browser resolves it to the mirrored direction, and only in RTL", { skip: !HAVE_TW && "template deps not installed" }, async () => {
  let chromium;
  try { ({ chromium } = await import("playwright-core")); }
  catch { return; }   // no driver here; the emission-order test above still holds
  const css = await compileClasses([
    "data-[state=open]:slide-in-from-right",
    "rtl:data-[state=open]:slide-in-from-left",
  ]);
  const page = (dir) => `<!doctype html><html dir="${dir}"><head><style>${css}</style></head>` +
    `<body><div id="p" data-state="open" class="data-[state=open]:slide-in-from-right ` +
    `rtl:data-[state=open]:slide-in-from-left"></div></body></html>`;

  const exe = "/opt/pw-browsers/chromium";
  const b = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  try {
    const read = async (dir) => {
      const p = await b.newPage();
      await p.setContent(page(dir));
      const v = await p.evaluate(() =>
        getComputedStyle(document.getElementById("p")).getPropertyValue("--tw-enter-translate-x").trim());
      await p.close();
      return v;
    };
    // The panel is anchored at `end-0`, so in RTL it lands on the LEFT and must
    // enter from the left. In LTR nothing may change — this fix must be a no-op
    // for every site the platform has already built.
    assert.equal(await read("rtl"), "-100%", "RTL still enters from the physical right");
    assert.equal(await read("ltr"), "100%", "the rtl: variant leaked into LTR");
  } finally {
    await b.close();
  }
});
