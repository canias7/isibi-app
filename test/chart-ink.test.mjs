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



test("no chart fades a labelled block with element opacity", () => {
  // ELEMENT OPACITY FADES THE INK WITH THE FILL. `strategy.NowNextLater` set
  // `background: TONE, color: var(--background), opacity: c.weight` — at
  // weight 0.25 the whole header, white text included, composited toward the
  // page and measured 1.84:1. No ink choice can survive it, because the ink is
  // faded by the same amount; weight has to be carried by the FILL percentage,
  // where `inkOn` can then see it.
  //
  // Scoped to blocks that set a contrast ink: opacity on an unlabelled mark —
  // a dot, a bar — is ordinary and correct, and 25 modules do it.
  const bad = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      if (/opacity:/.test(line) && /color:\s*"var\(--background\)"/.test(line)) {
        bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
      }
    });
  }
  assert.deepEqual(bad, [], "a block fades its own ink along with its fill:\n" + bad.join("\n"));
});
