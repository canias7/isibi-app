// Audit A31-3: a revise that names one QR code changes that code and keeps the
// others. The state note tells the designer "to change one, name it in `qr`",
// and the build route used to store its one-entry answer as the whole list.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as qrMod from "../builder/site-qr-list.mjs";
import { mergeLook, currentStateNote } from "../builder/site-edit.mjs";

const { foldQr, qrList } = qrMod;
const RING = { name: "ring", points: "tel:0114", label: "Ring" };
const WIFI = { name: "wifi", points: "WIFI:T:WPA;S:fretwork;P:opentuning;;", label: "Join the wifi" };
const stored = { brand: "Fretwork", qr: [RING, WIFI] };

// The route's merge, as worker.js does it on an instructed revise.
const revise = (prior, designed) => mergeLook(prior, { ...designed, qr: foldQr(prior.qr, designed.qr) }, {}, { instructed: true });

test("A31-3: the note still tells the designer to name only the code it changes", () => {
  assert.match(currentStateNote(stored), /to change one, name it in `qr`/);
});

test("A31-3: without the fold, a one-entry answer replaces the list (the defect)", () => {
  const raw = mergeLook(stored, { qr: [{ ...WIFI, points: "WIFI:T:WPA;S:fretwork;P:X;;" }] }, {}, { instructed: true });
  assert.deepEqual(raw.qr.map((c) => c.name), ["wifi"]);
});

test("A31-3: a revise naming one code changes it and keeps the others, in place", () => {
  const out = revise(stored, { qr: [{ name: "wifi", points: "WIFI:T:WPA;S:fretwork;P:X;;", label: "Join the wifi" }] });
  assert.deepEqual(out.qr, [RING, { ...WIFI, points: "WIFI:T:WPA;S:fretwork;P:X;;" }]);
});

test("A31-3: a revise naming the first code keeps the second", () => {
  const out = revise(stored, { qr: [{ name: "ring", points: "tel:0115", label: "Ring us" }] });
  assert.deepEqual(out.qr, [{ name: "ring", points: "tel:0115", label: "Ring us" }, WIFI]);
});

test("A31-3: a new name is appended, never at the cost of a stored code", () => {
  const out = revise(stored, { qr: [{ name: "menu", points: "https://fretwork-1.gofarther.app/menu", label: "Menu" }] });
  assert.deepEqual(out.qr.map((c) => c.name), ["ring", "wifi", "menu"]);
});

test("A31-3: an omitted, empty or unusable qr keeps the stored list", () => {
  for (const qr of [undefined, [], [{ name: "x" }], "nonsense"]) {
    const out = revise(stored, { qr });
    assert.deepEqual(out.qr, [RING, WIFI], JSON.stringify(qr));
  }
});

test("A31-3: the old single-object code folds by its name `qr`", () => {
  const old = { qr: { points: "tel:0114", label: "Ring" } };
  const out = revise(old, { qr: [{ name: "wifi", points: WIFI.points, label: WIFI.label }] });
  assert.deepEqual(out.qr.map((c) => c.name), ["qr", "wifi"]);
});

test("A31-3: the list never grows past the cap", () => {
  const six = Array.from({ length: qrMod.MAX_QRS }, (_, i) => ({ name: "c" + i, points: "tel:" + i, label: "L" + i }));
  const out = foldQr(six, [{ name: "extra", points: "tel:9", label: "X" }]);
  assert.equal(out.length, qrMod.MAX_QRS);
  assert.deepEqual(out, qrList(six));
});

test("A31-3: the build route merges the folded codes, not the designer's list", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const call = "mergeLook(priorLook, qrFolded, body, { instructed: !!editState })";
  const at = w.indexOf(call);
  assert.ok(at > 0, "the revise merge is not given the folded look");
  const before = w.slice(Math.max(0, at - 800), at);
  assert.match(before, /const qrFolded = editState && designed[^;]*foldQr\(priorLook\.qr, designed\.qr\)/s);
  assert.ok(!w.includes("mergeLook(priorLook, designed, body, { instructed: !!editState })"), "the unfolded merge is still there");
  assert.match(w, /import \{[^}]*\bfoldQr\b[^}]*\} from "\.\/builder\/site-qr-list\.mjs"/);
});
