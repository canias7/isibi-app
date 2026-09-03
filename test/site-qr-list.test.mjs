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
} from "../builder/site-qr-list.mjs";
import * as viaDrawing from "../builder/site-qr.mjs";
import { currentStateNote, mergeLook, movedFields } from "../builder/site-edit.mjs";
import { editTool, laneRule } from "../builder/site-lanes.mjs";
import { marksDirective } from "../builder/page-gen.mjs";
import { eitherWay } from "../scripts/addon-sweep.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
/** Length-preserving blanking of whole-line comments — this repo's prose spells what it forbids. */
const bare = (s) => s.split("\n").map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, `${what}: landmark "${needle}" is gone`); return i; };

const WIFI = "WIFI:T:WPA;S:fretwork;P:opentuning;;";
const TWO = [{ name: "ring", points: "tel:0114", label: "Ring" }, { name: "wifi", points: WIFI, label: "Join the wifi" }];

/* ── the module ─────────────────────────────────────────────────────────── */

test("the list module imports nothing — the container carries it without the encoder", () => {
  const src = bare(read("../builder/site-qr-list.mjs"));
  assert.ok(!/^\s*import\s/m.test(src), "site-qr-list.mjs imports something; the container image cannot carry `qrcode-generator`");
  // …and the drawing module forwards the same bindings, by identity, so the
  // Worker's existing import path (`site-qr.mjs`) reaches the one module.
  for (const [k, v] of Object.entries({ MAX_QRS, QR_NAME, QR_FILE, qrName, qrFile, qrList, patchQr, qrRefusal, qrUnplaced, readQrText })) {
    assert.equal(viaDrawing[k], v, "site-qr.mjs does not forward " + k + " from the list module");
  }
});

test("qrName: an identifier the page can write after a dot, from the answer or the caption, never coerced", () => {
  assert.equal(qrName("wifi"), "wifi");
  assert.equal(qrName("Join our wifi!"), "joinourwifi", "a caption-shaped name is not made an identifier");
  assert.equal(qrName("2nd floor"), "ndfloor", "a leading digit is not stripped — `SITE_QRS.2nd` is a syntax error");
  assert.equal(qrName("a".repeat(40)), "a".repeat(24), "a name is not capped at the identifier length");
  assert.equal(qrName("", "Book a lesson"), "bookalesson", "the caption is not the fallback");
  assert.equal(qrName(undefined, "Ring"), "ring");
  assert.equal(qrName("!!!", "???"), null, "nothing usable must be null, not an empty string");
  // `String(["wifi"])` is `"wifi"` — shipped as a real bug three times here.
  assert.equal(qrName(["wifi"]), null, "an array was coerced to a name");
  assert.equal(qrName(["wifi"], "Ring"), "ring", "an array answer must fall to the caption, not be coerced");
  assert.equal(qrName(42, 42), null);
  for (const n of ["wifi", "a", "q1", "a".repeat(24)]) assert.ok(QR_NAME.test(n), n + " should be a name");
  for (const n of ["", "Wifi", "1a", "a-b", "a b", "a".repeat(25), "a.b"]) assert.ok(!QR_NAME.test(n), JSON.stringify(n) + " should not be a name");
});

test("qrFile: `qr` keeps `qr.svg` and every other name gets its own file, all matched by the one pattern the container deletes with", () => {
  assert.equal(qrFile("qr"), "qr.svg", "the first code's file moved — every page written before the list points at qr.svg");
  assert.equal(qrFile("wifi"), "qr-wifi.svg");
  for (const n of ["qr", "wifi", "a", "q1", "a".repeat(24)]) assert.ok(QR_FILE.test(qrFile(n)), qrFile(n) + " is a file the delete would not match — it survives into the next site");
  for (const f of ["qr-.svg", "qrx.svg", "qr-Wifi.svg", "qr-1a.svg", "qr-wifi.png", "animated.svg", "logo.svg", "aqr.svg", "qr-" + "a".repeat(25) + ".svg"]) {
    assert.ok(!QR_FILE.test(f), f + " would be deleted per build and is not a QR file");
  }
});

test("qrList: the old single code is one entry named `qr`; a list is cleaned, named, deduped and capped", () => {
  assert.deepEqual(qrList({ points: "tel:0114", label: "Ring" }), [{ name: "qr", points: "tel:0114", label: "Ring" }],
    "a site published before the list is not read as one code named `qr`");
  assert.deepEqual(qrList({ name: "wifi", points: WIFI, label: "Wifi" }), [{ name: "wifi", points: WIFI, label: "Wifi" }], "a named single object loses its name");
  assert.deepEqual(qrList(TWO), TWO);
  assert.deepEqual(qrList([{ points: "tel:0114", label: "Ring us" }]).map((c) => c.name), ["ringus"], "an unnamed entry is not named from its caption");
  assert.deepEqual(qrList([{ name: "a", points: "x", label: "A" }, { name: "a", points: "y", label: "B" }]), [{ name: "a", points: "x", label: "A" }], "a repeated name is not dropped, or the wrong one wins");
  assert.deepEqual(qrList([{ name: "a", label: "no points" }, { name: "b", points: "no label" }, null, "x", [], { name: "c", points: "  p  ", label: "  L  " }]),
    [{ name: "c", points: "p", label: "L" }], "half entries or non-entries are kept, or values are not trimmed");
  assert.equal(qrList([{ name: "c", points: "p", label: "L".repeat(200) }])[0].label.length, 80, "the caption is not capped");
  const many = Array.from({ length: MAX_QRS + 3 }, (_, i) => ({ name: "c" + i, points: "p" + i, label: "L" + i }));
  assert.equal(qrList(many).length, MAX_QRS, "the list is not capped at MAX_QRS");
  for (const v of [null, undefined, "", "qr", 3, true]) assert.deepEqual(qrList(v), [], JSON.stringify(v) + " read as a list");
});

test("patchQr: one code changed, the list kept, the half not mentioned character for character", () => {
  // No codes: the sentence, never a guess.
  assert.deepEqual(patchQr(null, { label: "x" }), { ok: false, why: "no-codes", names: [] });
  // One code needs no name.
  const one = patchQr({ points: "tel:0114", label: "Ring" }, { label: "Ring the shop" });
  assert.deepEqual(one, { ok: true, list: [{ name: "qr", points: "tel:0114", label: "Ring the shop" }], moved: true, name: "qr" },
    "a caption change re-pointed the code, or lost the list, or the old single code was not read as `qr`");
  // Several: which one?
  assert.deepEqual(patchQr(TWO, { label: "x" }), { ok: false, why: "which-code", names: ["ring", "wifi"] });
  assert.deepEqual(patchQr(TWO, {}), { ok: false, why: "which-code", names: ["ring", "wifi"] }, "an empty answer on a site with several codes guessed one");
  const missing = patchQr(TWO, { name: "menu", label: "x" });
  assert.deepEqual(missing, { ok: false, why: "no-such-code", names: ["ring", "wifi"], said: "menu" });
  // The name is read the way names are made, so "Wifi" finds `wifi`.
  const re = patchQr(TWO, { name: "Wifi", points: "WIFI:T:WPA;S:fretwork;P:newpass;;" });
  assert.equal(re.ok, true);
  assert.deepEqual(re.list[1], { name: "wifi", points: "WIFI:T:WPA;S:fretwork;P:newpass;;", label: "Join the wifi" }, "a re-pointed code lost or reworded its caption");
  assert.deepEqual(re.list[0], TWO[0], "the other code moved");
  assert.equal(re.moved, true); assert.equal(re.name, "wifi");
  // A bad destination is refused BEFORE anything changes.
  assert.deepEqual(patchQr(TWO, { name: "ring", points: "javascript:alert(1)" }), { ok: false, why: "bad-destination", names: ["ring", "wifi"], said: "ring" });
  // Nothing changed is said so, with the list as it was.
  const same = patchQr(TWO, { name: "ring", points: "tel:0114", label: "Ring" });
  assert.deepEqual(same, { ok: true, list: TWO, moved: false, name: "ring" });
  // Empty halves mean "not this half", never "clear it".
  assert.deepEqual(patchQr(TWO, { name: "ring", points: "", label: "  " }).list, TWO, "an empty half cleared the code");
  // A non-object patch is an empty one.
  assert.equal(patchQr(TWO, "x").why, "which-code");
  assert.equal(patchQr({ points: "tel:0114", label: "Ring" }, ["x"]).moved, false);
});

test("qrRefusal: a sentence per token, naming the codes the site has", () => {
  const seen = new Set();
  for (const why of ["no-codes", "which-code", "no-such-code", "bad-destination", "nope"]) {
    const s = qrRefusal(why, ["ring", "wifi"], "menu");
    assert.ok(s.length > 20 && !seen.has(s), why + ": no sentence of its own");
    seen.add(s);
  }
  assert.match(qrRefusal("which-code", ["ring", "wifi"]), /2 QR codes \(`ring`, `wifi`\)/);
  assert.match(qrRefusal("no-such-code", ["ring"], "menu"), /called `menu`.*its codes are: `ring`/);
  assert.match(qrRefusal("no-such-code", [], ""), /called that.*none/);
  assert.match(qrRefusal("bad-destination"), /Nothing was changed/);
  assert.ok(!/undefined|null|\[object/.test(qrRefusal("which-code", null, null)), "a missing name list leaks into the sentence");
});

test("qrUnplaced: a code no page shows, by its own binding, or by the old one for the first code only", () => {
  const p = (...srcs) => srcs.map((source) => ({ path: "x.tsx", source }));
  assert.deepEqual(qrUnplaced(TWO, p("<h1/>")), ["ring", "wifi"], "on a page showing nothing, both codes are unplaced");
  assert.deepEqual(qrUnplaced(TWO, p("<img src={SITE_QRS.wifi.src} />")), ["ring"], "a code shown by name is still reported unplaced");
  assert.deepEqual(qrUnplaced(TWO, p('<img src={SITE_QRS["ring"].src} />')), ["wifi"], "the bracket form of the binding is not read");
  assert.deepEqual(qrUnplaced(TWO, p("<img src={SITE_QR} />")), ["wifi"], "`SITE_QR` is the FIRST code's old binding and must count for it alone");
  assert.deepEqual(qrUnplaced(TWO, p("<a/>", "<img src={SITE_QRS.ring.src} />"), p), ["wifi"], "a code shown on a later page is reported unplaced");
  assert.deepEqual(qrUnplaced(TWO, p("SITE_QRS.wifix")), ["ring", "wifi"], "a longer name matched as a prefix");
  assert.deepEqual(qrUnplaced(TWO, null), ["ring", "wifi"]);
  assert.deepEqual(qrUnplaced(null, p("x")), []);
  assert.deepEqual(qrUnplaced([{ points: "x", label: "y" }], p("x")), [], "an unnamed code is placed nowhere and asked for by no name");
});

/* ── THE CHAIN ──────────────────────────────────────────────────────────── */

test("the Worker draws every stored code by name and hands the container the list", () => {
  const w = bare(read("../worker.js"));
  const fn = at(w, "function qrPayload(qr) {", "payload");
  const body = w.slice(fn, w.indexOf("\n}\n", fn));
  assert.match(body, /for \(const c of qrList\(qr\)\)/, "the payload does not read the stored field through `qrList` — the old single code would draw nothing");
  assert.match(body, /out\.push\(\{ name: c\.name, svg: drawn\.svg, label: c\.label \}\)/, "an entry is not `{ name, svg, label }`, which is the shape the container reads");
  assert.match(body, /continue;/, "one refused code must skip, not end the list");
  assert.match(body, /return out\.length \? out : undefined;/, "an empty list must be `undefined`, the no-QR payload every publish already sends");
  // The Worker imports the list module by name, beside the drawing module.
  assert.match(w, /import \{ qrList, patchQr, qrRefusal, qrUnplaced \} from "\.\/builder\/site-qr-list\.mjs";/);
});

test("the container writes each code to the file its name gives it, and emits the record beside the old bindings", () => {
  const s = bare(read("../builder/build-server.mjs"));
  const from = at(s, "const qrEntries = [];", "loop");
  const loop = s.slice(from, at(s, "const titleValue =", "after loop"));
  assert.match(loop, /Array\.isArray\(qr\) \? qr : \(qr && typeof qr === "object" \? \[\{ name: "qr", \.\.\.qr \}\] : \[\]\)/,
    "the old single `{ svg, label }` is not read as one code named `qr` — a Worker from before the roll would write nothing");
  assert.match(loop, /typeof e\.svg !== "string" \|\| !\/\^<svg\[\\s>\]\/\.test\(e\.svg\.trim\(\)\)\) continue;/, "a non-SVG payload is written to the site's own origin");
  assert.match(loop, /QR_NAME\.test\(e\.name\) \? e\.name : null/, "a name the rule refuses is written under a guessed file");
  assert.match(loop, /qrEntries\.some\(\(x\) => x\.name === name\)\) continue;/, "a repeated name overwrites the first code's file");
  assert.match(loop, /qrFile\(name\)/, "the file is not named by the list module's rule");
  assert.match(loop, /if \(qrEntries\.length >= MAX_QRS\) break;/, "the write loop has no ceiling");
  assert.match(loop, /qrValue = qrEntries\[0\]\.src; qrLabel = qrEntries\[0\]\.label;/, "the FIRST code is not `SITE_QR`/`SITE_QR_LABEL` — every page written before the list reads those");
  assert.match(s, /"export const SITE_QRS: Readonly<Record<string, \{ src: string; label: string \}>> = " \+\s*JSON\.stringify\(Object\.fromEntries\(qrEntries\.map\(\(e\) => \[e\.name, \{ src: e\.src, label: e\.label \}\]\)\)\)/,
    "the container does not emit `SITE_QRS` keyed by name with `{ src, label }`");
  // The template's stub declares the same type, so a page reading
  // `SITE_QRS.care.src` compiles standalone as well as against the build.
  const brand = read("../builder/lovable/template/src/site-brand.ts");
  assert.match(brand, /export const SITE_QRS: Readonly<Record<string, \{ src: string; label: string \}>> = \{\};/,
    "the template stub does not declare `SITE_QRS` as a record — a page reading a name off it is a type error standalone");
  // And the image carries the module the container imports — the hop the
  // unit suite's import walk caught missing the hour the module was written.
  assert.match(read("../builder/Dockerfile"), /^COPY [^\n]*\bsite-qr-list\.mjs\b/m, "the container image does not copy site-qr-list.mjs — the service cannot start");
});

test("the edit route folds the lane's patch over the stored list and refuses with the module's sentence", () => {
  const w = bare(read("../worker.js"));
  const from = at(w, "const answers = {};", "lane loop");
  const loop = w.slice(from, at(w, "designed = Object.keys(answers).length ? answers : null;", "loop end"));
  const fold = loop.indexOf('if (field === "qr") {');
  const generic = loop.indexOf("answers[field] = ran.value;");
  assert.ok(fold > 0 && generic > fold, "the qr fold is not inside the lane loop ahead of the generic store — the patch would be stored AS the list");
  const body = loop.slice(fold, generic);
  assert.match(body, /const patched = patchQr\(\(priorLook \|\| \{\}\)\.qr, ran\.value\);/, "the patch is not folded over the stored list");
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

test("the merge keeps a list and reports a patched one as moved; the note lists every code by name", () => {
  const stored = { brand: "Fretwork", qr: { points: "tel:0114", label: "Ring" } };
  const patched = patchQr(stored.qr, { label: "Ring the shop" });
  const merged = mergeLook(stored, { qr: patched.list }, {}, { instructed: true });
  assert.deepEqual(merged.qr, patched.list, "the list does not survive the merge");
  assert.deepEqual(movedFields(stored, merged), ["qr"], "a patched code does not read as a move");
  const same = mergeLook(stored, { qr: stored.qr }, {}, { instructed: true });
  assert.deepEqual(movedFields(stored, same), [], "an unmoved patch reads as a move");
  const note = currentStateNote({ qr: TWO });
  assert.match(note, /its 2 QR codes/);
  assert.match(note, /`ring`: "Ring" pointing at tel:0114/);
  assert.match(note, /`wifi`: "Join the wifi" pointing at WIFI:T:WPA;S:fretwork;P:opentuning;;/);
  assert.match(note, /name it in `qr`/, "the designer is not told how to address one code");
  assert.match(currentStateNote({ qr: { points: "tel:0114", label: "Ring" } }), /its QR code[^\n]*\n\s+- `qr`: "Ring"/, "the old single code is not shown under its name");
});

test("the qr lane answers a patch to one code — name, points, label, nothing required — and its rule says never the list", () => {
  const shape = editTool("qr").input_schema.properties.qr;
  assert.deepEqual(Object.keys(shape.properties), ["name", "points", "label"]);
  assert.deepEqual(shape.required, []);
  assert.match(shape.properties.name.description, /WHICH code/);
  assert.match(laneRule("qr"), /never the list/);
  assert.match(laneRule("qr"), /every other code on the site stays exactly as it is/);
});

test("the page writer is told every code, by its own binding, with the component that takes children", () => {
  const d = marksDirective({ qr: TWO });
  assert.match(d, /2 QR CODES are on this site/);
  assert.match(d, /`SITE_QRS\.ring` — caption "Ring", scanning it: tel:0114/);
  assert.match(d, /`SITE_QRS\.wifi` — caption "Join the wifi"/);
  assert.match(d, /<Figure caption=\{SITE_QRS\.ring\.label\}><img src=\{SITE_QRS\.ring\.src\}/);
  assert.match(d, /write the other codes' names in place of `ring`/);
  assert.equal(marksDirective({ qr: [] }), "", "an empty list still sends the directive");
});

test("the addon harness counts distinct code files, so adding a second is a publish and a first is still one", () => {
  const mark = /\/qr(?:-[a-z0-9]+)?\.svg/g;
  const one = { build: "a", html: '<img src="/qr.svg"><img src="/qr.svg">' };
  const two = { build: "b", html: '<img src="/qr.svg"><img src="/qr-wifi.svg">' };
  assert.equal(eitherWay(one, two, { ok: true }, mark, "code").ok, true, "a second code on the page is not a publish");
  assert.equal(eitherWay(one, { build: "b", html: one.html }, { ok: true }, mark, "code").ok, false, "a publish that added no code passes");
  assert.equal(eitherWay(one, { build: "a", html: two.html }, { ok: true }, mark, "code").ok, false, "a publish with an unmoved build passes");
  assert.equal(eitherWay({ build: "a", html: "" }, two, { ok: true }, mark, "code").ok, true, "the first code on a page is not a publish");
  assert.equal(eitherWay(one, { build: "a", html: one.html }, { ok: false, error: "already" }, mark, "code").ok, true, "an honest refusal on a site with a code fails");
  assert.equal(eitherWay({ build: "a", html: "" }, { build: "a", html: "" }, { ok: false }, mark, "code").ok, false, "a refusal on a site with no code passes");
});
