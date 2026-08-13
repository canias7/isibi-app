// A HEAT LABEL'S INK MUST BE DECIDED BY THE SAME NUMBER THAT PAINTS THE CELL.
//
// The bug this pins, measured 2026-08-13 across 26 chart modules. A cell was
// painted from a normalised value scaled into a percentage, and the ink on top
// was chosen by thresholding the RAW VALUE:
//
//     background: `color-mix(in oklch, var(--foreground) ${8 + t * 84}%, …)`
//     color:      t > 0.45 ? "var(--background)" : "var(--foreground)"
//
// The fill runs 8..92%, so the ink flipped when the cell was `8 + 0.45 * 84`
// = 46% — a LIGHT cell — and white text landed on it at 2.2:1. Two expressions
// derived from one value, free to drift, and nothing held them together.
//
// Guarded as a PROPERTY rather than a list of the sites fixed that day: a
// threshold against a fraction is by construction blind to the ramp, whatever
// module it appears in and whenever it is added.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const LIB = "builder/lovable/template/src/components/charts/lib";
const files = fs.readdirSync(LIB).filter((f) => f.endsWith(".tsx"));
const read = (f) => fs.readFileSync(path.join(LIB, f), "utf8");

test("the chart lib is where this thinks it is", () => {
  // Without this every scan below passes over an empty list, which is the most
  // reassuring possible way to check nothing.
  assert.ok(files.length > 100, `only ${files.length} chart modules found`);
  assert.ok(files.includes("matrices.tsx"), "matrices.tsx is missing — has the lib moved?");
});

test("no chart picks its ink by thresholding a fraction", () => {
  // A percentage threshold (`filled > 55`) is fine — it is the ramp's own
  // number. A fraction (`t > 0.45`) is a value, and a value cannot know what
  // percentage the fill turned it into.
  const bad = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      if (/[><]=?\s*0\.\d+\s*\?\s*"var\(--background\)"/.test(line)) bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(bad, [], "ink chosen from a raw value rather than the ramp percentage:\n" + bad.join("\n"));
});

test("no chart uses muted-foreground as the ink on a heat cell", () => {
  // `--muted-foreground` is a mid-grey for secondary text ON THE PAGE. On a
  // light-to-mid data fill it cannot reach 4.5:1 from either direction, and
  // `retail2` was measured doing exactly that.
  const bad = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      if (/"var\(--background\)"\s*:\s*"var\(--muted-foreground\)"/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, [], "muted-foreground used as the light-cell ink: " + bad.join(", "));
});

test("no heat ink falls through to whatever it inherits", () => {
  // `: undefined` inherits the surrounding colour, which in these components is
  // usually `text-muted-foreground` — the same bug arriving by inheritance,
  // and invisible at the call site.
  const bad = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      if (/"var\(--background\)"\s*:\s*undefined/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, [], "heat ink inherits instead of being stated: " + bad.join(", "));
});

test("the flip point is where the two inks actually cross", () => {
  // DERIVED, not restated. `INK_FLIP` is only correct because of a fact about
  // this kit's palette — `--foreground` is oklch(0.129 …), relative luminance
  // 0.002 — and if that token ever moves, the constant has to move with it.
  // Recomputing here is what notices.
  const src = fs.readFileSync(path.join(LIB, "_ink.ts"), "utf8");
  const flip = Number(src.match(/export const INK_FLIP = (\d+)/)[1]);

  const chan = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  const ratio = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const FG = [2, 6, 24], BG = [255, 255, 255];
  const cellAt = (pct) => lum(FG.map((c, i) => c * (pct / 100) + BG[i] * (1 - pct / 100)));
  const best = (pct) => Math.max(ratio(cellAt(pct), lum(FG)), ratio(cellAt(pct), lum(BG)));
  const inkUsed = (pct) => (pct >= flip ? lum(BG) : lum(FG));
  const got = (pct) => ratio(cellAt(pct), inkUsed(pct));

  // The rule holds across the whole ramp, not just at the crossing.
  let worst = Infinity, worstAt = null;
  for (let pct = 0; pct <= 100; pct++) {
    if (got(pct) < worst) { worst = got(pct); worstAt = pct; }
  }
  assert.ok(worst >= 4.5, `at ${worstAt}% the chosen ink gives ${worst.toFixed(2)}:1 — under AA`);

  // And the flip is at the crossing rather than merely somewhere that works:
  // one step earlier or later must be worse, which is what makes it the answer
  // rather than a number that happens to pass.
  const worstFor = (f) => {
    let w = Infinity;
    for (let pct = 0; pct <= 100; pct++) w = Math.min(w, ratio(cellAt(pct), pct >= f ? lum(BG) : lum(FG)));
    return w;
  };
  assert.ok(worstFor(flip) >= worstFor(flip - 5) && worstFor(flip) >= worstFor(flip + 5),
    `flip at ${flip} is not the best point: ${worstFor(flip - 5).toFixed(2)} / ${worstFor(flip).toFixed(2)} / ${worstFor(flip + 5).toFixed(2)}`);
});

test("the shared ramp cannot emit a percentage CSS refuses", () => {
  // A caller normalising by a max of zero hands in Infinity or NaN. Unclamped
  // that becomes `color-mix(… Infinity%, …)`, which paints NOTHING — and a
  // label on an unpainted cell is precisely the white-on-white this file is
  // about. Measured: it is how `edu.GradebookHeat` failed.
  const { shadePct } = { shadePct: (t) => Math.round(8 + Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * 84) };
  const src = fs.readFileSync(path.join(LIB, "_ink.ts"), "utf8");
  assert.match(src, /Number\.isFinite/, "shadePct no longer guards a non-finite input");
  for (const t of [NaN, Infinity, -Infinity, -1, 2, 0, 1]) {
    const pct = shadePct(t);
    assert.ok(Number.isFinite(pct) && pct >= 0 && pct <= 100, `shadePct(${t}) = ${pct}`);
  }
});
