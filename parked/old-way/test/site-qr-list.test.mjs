// PARKED (2026-11-03, park-old-way): the old-way half of test/site-qr-list.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE QR LIST — a site carries several named codes (owner, 2026-09-03: "it
// should carry more").
//
// One code was `{ points, label }`, drawn to `qr.svg`, bound as `SITE_QR`, and
// the addon refused a second because there was nowhere to keep it — a wall that
// was a consequence of the shape, not a rule anybody chose. Now the stored field
// is a LIST of `{ name, points, label }`, each code written to its own file and
// reached by name (`SITE_QRS.wifi`); the edit lane patches ONE code by name;
// the addon appends one and refuses only a duplicate. The old single code reads
// as one entry named `qr`, whose file and binding are unchanged, so every site
// published before the list serves the bytes it served the day before.
//
// The module is driven here; the hops that carry it are read where they can
// only be read (the Worker's payload and fold, the container's write loop, the
// template's binding) and driven where they can be (the merge, the note, the
// lane's tool, the writer's directive, the harness's count).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MAX_QRS, QR_NAME, QR_FILE, qrName, qrFile, qrList, patchQr, qrRefusal, qrUnplaced, readQrText,
} from "../../../builder/site-qr-list.mjs";
import * as viaDrawing from "../../../builder/site-qr.mjs";
import { currentStateNote, mergeLook, movedFields } from "../../../builder/site-edit.mjs";
import { editTool, laneRule } from "../../../builder/site-lanes.mjs";
import { marksDirective } from "../../../builder/page-gen.mjs";
import { eitherWay } from "../../../scripts/addon-sweep.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
/** Length-preserving blanking of whole-line comments — this repo's prose spells what it forbids. */
const bare = (s) => s.split("\n").map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, `${what}: landmark "${needle}" is gone`); return i; };

const WIFI = "WIFI:T:WPA;S:fretwork;P:opentuning;;";
const TWO = [{ name: "ring", points: "tel:0114", label: "Ring" }, { name: "wifi", points: WIFI, label: "Join the wifi" }];

/* ── THE CHAIN ──────────────────────────────────────────────────────────── */

test("the Worker draws every stored code by name and hands the container the list", () => {
  const w = bare(read("../../../worker.js"));
  const fn = at(w, "function qrPayload(qr) {", "payload");
  const body = w.slice(fn, w.indexOf("\n}\n", fn));
  assert.match(body, /for \(const c of qrList\(qr\)\)/, "the payload does not read the stored field through `qrList` — the old single code would draw nothing");
  assert.match(body, /out\.push\(\{ name: c\.name, svg: drawn\.svg, label: c\.label \}\)/, "an entry is not `{ name, svg, label }`, which is the shape the container reads");
  assert.match(body, /continue;/, "one refused code must skip, not end the list");
  assert.match(body, /return out\.length \? out : undefined;/, "an empty list must be `undefined`, the no-QR payload every publish already sends");
  // The Worker imports the list module by name, beside the drawing module.
  //
  // RE-ANCHORED 2026-09-11: this pinned the import as an exact four-name list,
  // so it went red because an honest fifth arrived (`qrFile`, for the code
  // explorer) — reporting the QR payload as unwired by a change that did not
  // touch it. Being exactly those four was never the property; each of them
  // being imported from that module is. The recorded "assert the property, not
  // the spelling", in its list form.
  const line = /import \{([^}]*)\} from "\.\/builder\/site-qr-list\.mjs";/.exec(w);
  assert.ok(line, "the Worker no longer imports the list module at all");
  const named = line[1].split(",").map((s) => s.trim()).filter(Boolean);
  for (const need of ["qrList", "patchQr", "qrRefusal", "qrUnplaced"]) {
    assert.ok(named.includes(need), "the Worker stopped importing " + need + " from the list module");
  }
});

test("the edit route folds the lane's patch over the stored list and refuses with the module's sentence", () => {
  const w = bare(read("../../../worker.js"));
  const from = at(w, "const answers = {};", "lane loop");
  const loop = w.slice(from, at(w, "designed = Object.keys(answers).length ? answers : null;", "loop end"));
  const fold = loop.indexOf('if (field === "qr") {');
  const generic = loop.indexOf("answers[field] = ran.value;");
  assert.ok(fold > 0 && generic > fold, "the qr fold is not inside the lane loop ahead of the generic store — the patch would be stored AS the list");
  const body = loop.slice(fold, generic);
  // A PATCH ONLY (2026-10-02, the owner's review of W2): a code asked OFF
  // never reaches this fold — the removal names its codes through `take_off`
  // above it (driven in `partial-removal.test.mjs`) — so the fold is handed
  // the lane's patch and nothing else.
  assert.match(body, /const patched = patchQr\(\(priorLook \|\| \{\}\)\.qr, ran\.value, \{ check: qrDestinationCheck\(\{ base: qrBase, routes: eRoutes\(\) \}\) \}\);/, "the patch is not folded over the stored list, or not under the site's destination rule");
  const takeOff = loop.indexOf("if (eRemoves.remove.includes(field) && takeOffLane(field)) {");
  assert.ok(takeOff > 0 && takeOff < fold, "a removal is not answered ahead of the qr fold — a code asked off would be read as a patch");
  assert.match(body, /if \(!patched\.ok\) \{/, "a refused patch is not refused");
  assert.match(body, /msg: qrRefusal\(patched\.why, patched\.names, patched\.said\)/, "the refusal does not use the module's sentence");
  assert.match(body, /\{ status: 422 \}/, "the refusal is not a 422 the browser shows as a sentence");
  assert.match(body, /answers\.qr = patched\.moved \? patched\.list : \(priorLook \|\| \{\}\)\.qr;/, "a moved patch does not store the list, or an unmoved one does not keep the stored value");
  assert.match(body, /continue;/, "the fold falls through to the generic store");
  // The wall's evidence reads both bindings: the record, and the first
  // code's old name.
  const ev = w.slice(at(w, "const ADD_EVIDENCE = {", "evidence"), w.indexOf("};", at(w, "const ADD_EVIDENCE = {", "evidence")));
  const src = /qr: \/(.*)\/,/.exec(ev);
  assert.ok(src, "no qr mark in ADD_EVIDENCE");
  const mark = new RegExp(src[1]);
  assert.ok(mark.test("<img src={SITE_QR} />"), "the old binding is not read as a placed code");
  assert.ok(mark.test("SITE_QRS.wifi.src"), "the record binding is not read as a placed code");
  assert.ok(!mark.test("SITE_QRX"), "the mark matches a name that is not a binding");
});
