// EVERY COMMITTED PROBE LIST READS (2026-10-13): a press names a list by its
// file, and the canary refuses one that does not read — so a list that cannot
// be read is found here, offline, not at a press.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { readProbeBatch, readProbeBox } from "../scripts/canary-probes.mjs";

const DIR = new URL("../scripts/router-probes/", import.meta.url);

test("PROBES 1 — every committed probe list reads under its own name, and the box accepts that name", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 8 && files.includes("addon-kinds-3.json"), "the observer is alive: " + files.join(", "));
  for (const f of files) {
    const name = f.slice(0, -5);
    assert.equal(readProbeBox(name).ok, true, f);
    const r = readProbeBatch(readFileSync(new URL(f, DIR), "utf8"), name);
    assert.equal(r.ok, true, f + ": " + r.msg);
  }
});

test("PROBES 2 — addon-kinds-3: three image-free messages, each a section and a line on ONE page of the bakery, none judged in advance", () => {
  const r = readProbeBatch(readFileSync(new URL("addon-kinds-3.json", DIR), "utf8"), "addon-kinds-3");
  assert.equal(r.batch.acceptance, true);
  assert.deepEqual(r.batch.probes.map((p) => p.id), ["K3A", "K3B", "K3C"]);
  for (const p of r.batch.probes) {
    assert.equal(p.site, "fold-lane-bakery");
    assert.equal(p.intended, null);
    assert.equal((p.message.match(/\b(Visit|Order|Classes) page\b/g) || []).length, 1, p.id + " names more than one page");
    assert.match(p.message, /questions section/);
    assert.match(p.message, /\bline\b/);
    assert.doesNotMatch(p.message, /photo|picture|image/i, p.id + " would ask for a picture");
  }
});
