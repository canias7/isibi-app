// THE TWO GENERATED MARKS — an animated one the model draws, and a QR we draw
// (owner, 2026-08-29: "qr code maker as optional, also gif maker as optional
// too, in the design step", and on the second: "just like a svg step, a gif step
// to generate gif").
//
// THEY ARE ONE FILE BECAUSE THEY ARE ONE HOP-CHAIN. Both are written into
// `public/` by the container, both are exposed as bindings on `@/site-brand`,
// and both are removed from a site by the same omission — a publish that does
// not send them. The container DELETES before it writes, so "not sent" is not
// "unchanged", it is "gone".
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { cleanGif, cleanFavicon, GIF_TAGS, GIF_ATTRS, GIF_ANIMATABLE, MAX_GIF, GIF_FIELD, FAVICON_ATTRS } from "../builder/site-favicon.mjs";
import { qrSvg, readQrText, QR_FIELD, MAX_QR_TEXT } from "../builder/site-qr.mjs";
import { EDIT_FIELDS, currentStateNote, mergeLook } from "../builder/site-edit.mjs";
import { ACTING_LANES, LANE_FIELDS, editTool, laneRule } from "../builder/site-lanes.mjs";
import { marksDirective, briefWithLayout } from "../builder/page-gen.mjs";
import { readSchemaTool } from "./integration/schema-tool.mjs";
import qrcode from "qrcode-generator";

const worker = readFileSync("worker.js", "utf8");
const server = readFileSync("builder/build-server.mjs", "utf8");
const brand = readFileSync("builder/lovable/template/src/site-brand.ts", "utf8");
const bare = (s) => s.split("\n").map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

const ANIM = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60">' +
  '<circle cx="30" cy="30" r="12" fill="#b44a2e">' +
  '<animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite"/></circle></svg>';

/* ── the animated mark: the svg step, with time ─────────────────────────── */

test("the animated mark is the favicon's scanner with animation added — not a second scanner", () => {
  // One validator, three callers. A second copy would drift, and the thing it
  // would drift on is a security allow-list.
  assert.ok(cleanGif(ANIM).svg, "a plain animated mark is refused: " + cleanGif(ANIM).why);
  // The still marks must NOT gain animation by this change — that would be the
  // allow-list widening for everyone rather than for one field.
  assert.equal(cleanFavicon(ANIM).svg, null, "the favicon now accepts animation, so the allow-list widened for everyone");
  assert.match(String(cleanFavicon(ANIM).why), /animate/, "the favicon refuses the animated mark for the wrong reason");
  // DERIVED, so the two sets cannot silently diverge: the animated set is the
  // still set plus animation, never a hand-written second list.
  for (const a of FAVICON_ATTRS) assert.ok(GIF_ATTRS.has(a), "`" + a + "` is allowed on a still mark and not on an animated one");
});

test("an animation may only move something the mark could have written", () => {
  // THE ONE NEW RISK ANIMATION CARRIES. A still mark's safety is an attribute
  // allow-list; `<animate attributeName="href">` names its target in a VALUE, so
  // without this check a document that cannot WRITE href can animate one in.
  for (const attr of ["href", "xlink:href", "style", "onload", "attributeName"]) {
    const doc = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="4">' +
      '<animate attributeName="' + attr + '" to="x" dur="1s"/></circle></svg>';
    assert.equal(cleanGif(doc).svg, null, "an animated mark may set `" + attr + "`");
  }
  // …and a legitimate one still works, or the check above proves nothing.
  assert.ok(cleanGif(ANIM).svg, "the animatable set refuses an ordinary radius animation");
  assert.ok(GIF_ANIMATABLE.has("r") && GIF_ANIMATABLE.has("opacity"), "the animatable set has lost ordinary visual attributes");
  assert.ok(!GIF_ANIMATABLE.has("id"), "an animation may move an element's identity");
});

test("`animateMotion` is refused — its child is a href wearing another tag name", () => {
  assert.ok(!GIF_TAGS.has("animateMotion"), "animateMotion is admitted, and `<mpath href>` comes with it");
  assert.ok(!GIF_TAGS.has("mpath"), "mpath is admitted");
  assert.ok(!GIF_TAGS.has("a"), "an anchor is admitted inside a mark");
  // The three that ARE admitted, so this is not a check that passes by scanning
  // an empty set.
  for (const t of ["animate", "animateTransform", "set"]) assert.ok(GIF_TAGS.has(t), "`" + t + "` is gone, so a mark cannot move at all");
});

test("the field says what it is, including that a stopped mark must still read", () => {
  assert.match(GIF_FIELD.description, /OMIT THIS FIELD ENTIRELY/, "the animated mark is no longer optional in its own words");
  assert.ok(GIF_FIELD.description.includes(String(MAX_GIF)), "the cap is not stated to the model");
  // REDUCED MOTION IS NOT A NICETY HERE: a mark whose meaning is only in the
  // movement is a blank space to a visitor who asked their system for less of it.
  assert.match(GIF_FIELD.description, /MOTION STOPPED/, "nothing tells the model the mark must read without its animation");
});

/* ── the QR: ours to draw, and it has to actually scan ──────────────────── */

test("THE MATRIX IS THE LIBRARY'S, MODULE FOR MODULE — the one thing no other check can see", () => {
  // THE POINT OF THIS TEST. A QR that is subtly wrong looks exactly like a QR
  // and does not scan; a build, a render check and a screenshot all pass it, and
  // only a phone disagrees. Our SVG merges runs of modules into one `<path>`, so
  // the risk is not the encoder — it is that the drawing loses or shifts a
  // module. This re-derives the module set FROM the emitted path and compares it
  // against the library's own `isDark`, which is the only ground truth available
  // without a camera.
  const text = "https://fold-lane-bakery.gofarther.app/menu";
  const quiet = 4;
  const out = qrSvg(text, { quiet });
  assert.ok(out.svg, "the QR was refused: " + out.why);

  const ref = qrcode(0, "M");
  ref.addData(text);
  ref.make();
  const n = ref.getModuleCount();

  // Every stroke the path emits, back to the modules it covers.
  const drawn = new Set();
  const strokes = [...out.svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)];
  assert.ok(strokes.length > 0, "the path emitted no strokes at all — this comparison would be vacuous");
  for (const m of strokes) {
    const x = Number(m[1]), y = Number(m[2]), run = Number(m[3]);
    for (let i = 0; i < run; i++) drawn.add((y - quiet) + "," + (x - quiet + i));
  }
  const expected = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (ref.isDark(r, c)) expected.add(r + "," + c);

  assert.ok(expected.size > 0, "the reference matrix is empty — nothing is being compared");
  assert.equal(drawn.size, expected.size, "the drawing has a different number of dark modules than the code does");
  for (const k of expected) assert.ok(drawn.has(k), "module " + k + " is dark in the code and not in the drawing");
  for (const k of drawn) assert.ok(expected.has(k), "module " + k + " is drawn and is not dark in the code");
});

test("the quiet zone is there, and it is not decoration", () => {
  // The spec requires four modules of clear margin. Without it a scanner cannot
  // find the code's edge against whatever the page puts beside it — and the
  // failure is intermittent, which is the kind nobody reproduces.
  // THE DEFAULT, NOT AN EXPLICIT 4 — and that distinction is this test's whole
  // point (found by a sweep, 2026-08-29: dropping the default to 0 SURVIVED).
  // Production calls `qrSvg(points)` with no options at all, so a test that
  // passes `{ quiet: 4 }` proves the parameter works and says nothing about the
  // code any customer actually gets.
  const out = qrSvg("https://x.test");
  const vb = /viewBox="0 0 (\d+) \1"/.exec(out.svg);
  assert.ok(vb, "the QR has no square viewBox");
  const ref = qrcode(0, "M"); ref.addData("https://x.test"); ref.make();
  assert.equal(Number(vb[1]), ref.getModuleCount() + 8, "the quiet zone is not four modules on every side");
  // And it is painted, not merely empty: a transparent QR on a dark band is a
  // code with inverted contrast, which does not scan.
  assert.match(out.svg, /<rect width="\d+" height="\d+" fill="#fff"\/>/, "the QR has no white ground behind it");
  assert.match(out.svg, /shape-rendering="crispEdges"/, "the QR is anti-aliased, which is what makes a small one fail");
});

test("a QR points somewhere honest or nowhere at all", () => {
  for (const [bad, why] of [["javascript:alert(1)", "a script scheme"], ["data:text/html,x", "a data url"],
                            ["ftp://h/x", "an odd scheme"], ["", "empty"], ["x".repeat(MAX_QR_TEXT + 1), "too long"]]) {
    assert.equal(readQrText(bad).text, null, why + " was accepted as a QR payload");
  }
  // THE ALLOW-LIST IS THE GUARD, AND THE DENY-LIST IS BELT-AND-BRACES. A sweep
  // proved it (2026-08-29): deleting the `BAD_SCHEME` check entirely SURVIVED,
  // because a scheme that is not on `OK_SCHEME` is refused whatever it is. That
  // is the right shape — an allow-list cannot be outrun by a scheme nobody
  // thought of — so the property is asserted HERE, at the layer that holds,
  // rather than by pinning the redundant check.
  for (const invented of ["totallynew:x", "chrome-extension://x", "jAvAsCrIpT:alert(1)"]) {
    assert.equal(readQrText(invented).text, null, "`" + invented + "` was accepted — the allow-list is not the guard");
  }
  // …and the real ones a business actually uses, or the refusals above are just
  // a broken parser.
  for (const ok of ["https://x.test/menu", "tel:+441234567890", "mailto:a@b.test", "WIFI:S:Cafe;T:WPA;P:pw;;", "Table 4"]) {
    assert.ok(readQrText(ok).text, "`" + ok + "` is a real business QR and was refused: " + readQrText(ok).why);
  }
});

test("the field refuses to invent a destination", () => {
  // The sharpest rule on this field, and it is about trust rather than syntax: a
  // QR is the one thing on a page a visitor CANNOT read before acting on it.
  assert.match(QR_FIELD.properties.points.description, /leave this whole field out/,
    "nothing tells the model to omit the QR rather than invent a URL");
  assert.match(QR_FIELD.description, /NEVER INVENT THE DESTINATION/, "the field's own rule against inventing is gone");
  assert.deepEqual([...QR_FIELD.required].sort(), ["label", "points"],
    "a QR may now be declared without its caption — a black square nobody scans");
});

/* ── the chain, for both, end to end ────────────────────────────────────── */

test("THE CHAIN — both marks reach the site, and survive every later publish", async () => {
  const { tool } = await readSchemaTool();
  const p = tool.input_schema.properties;
  assert.ok(p.gif && p.qr, "hop 1: the design step cannot answer one of them");
  for (const k of ["gif", "qr"]) {
    assert.ok(!tool.input_schema.required.includes(k), "`" + k + "` is compelled, so every build will invent one");
    assert.ok(EDIT_FIELDS.includes(k), "hop 2: `" + k + "` is not stored, so the merge discards it");
  }
  // The merge really carries them.
  const m = mergeLook(null, { gif: ANIM, qr: { points: "https://x.test", label: "Menu" } }, null, {});
  assert.equal(m.gif, ANIM, "hop 2: the animated mark does not survive the merge");
  assert.deepEqual(m.qr, { points: "https://x.test", label: "Menu" }, "hop 2: the QR does not survive the merge");

  const w = bare(worker);
  // BOTH PAYLOADS — the build's and the spine's. The spine is the half that is
  // easy to miss and the one that MATTERS: the container deletes both files at
  // the start of every build, so a publish that does not send them takes them
  // off the site. That is the tab-icon bug, which happened exactly this way.
  const hops = [...w.matchAll(/favicon: /g)];
  assert.ok(hops.length >= 3, "fewer favicon hops than there were — this scan is looking at the wrong shape");
  const payloadHops = [...w.matchAll(/icon: icon \|\| "",/g)];
  assert.ok(payloadHops.length >= 2, "the two container payloads are no longer findable");
  for (let i = 0; i < payloadHops.length; i++) {
    const from = payloadHops[i].index;
    const to = i + 1 < payloadHops.length ? payloadHops[i + 1].index : w.length;
    const win = w.slice(from, to);
    assert.match(win, /\bgif: /, "hop 3: a container payload does not carry the animated mark — a publish would remove it");
    assert.match(win, /\bqr: qrPayload\(/, "hop 3: a container payload does not carry the QR — a publish would remove it");
  }
  // ONE function draws the QR for both payloads, so the two cannot disagree.
  assert.equal([...w.matchAll(/function qrPayload\(/g)].length, 1, "there is not exactly one QR payload builder");

  // hop 4: the container writes them, and DELETES first.
  const s = bare(server);
  assert.match(s, /const gifPath = path\.join\(APP, "public", "animated\.svg"\)/, "hop 4: the animated mark has no file");
  assert.match(s, /const qrPath = path\.join\(APP, "public", "qr\.svg"\)/, "hop 4: the QR has no file");
  // ASSERTED AS THE PROPERTY — both paths are rmSync'd — rather than as the exact
  // punctuation of one line, which is how a guard goes red for a reformat.
  assert.match(s, /\[gifPath, qrPath\][\s\S]{0,120}rmSync/,
    "hop 4: the files are not deleted per build, so one site's mark appears on another's");
  // …and re-validates the drawn one, because this route also takes hand-written
  // payloads and what it writes is served from the site's own origin.
  assert.match(s, /cleanGif\(gif\)/, "hop 4: the container writes a model-drawn document without validating it");

  // hop 5: the page can reach them, and the binding exists in the template too.
  for (const b of ["SITE_ANIMATED", "SITE_QR", "SITE_QR_LABEL"]) {
    assert.ok(s.includes(b), "hop 5: the container never emits `" + b + "`");
    assert.ok(brand.includes("export const " + b), "hop 5: `" + b + "` is missing from the template, so a page using it will not build standalone");
  }

  // hop 6: the page WRITER is told they exist — without this the files are
  // served to nobody, which from outside looks exactly like the design step
  // never having answered.
  const d = marksDirective({ gif: ANIM, qr: { points: "https://x.test", label: "Menu" } });
  assert.match(d, /SITE_ANIMATED/, "hop 6: the writer is never told the animated mark exists");
  assert.match(d, /SITE_QR_LABEL/, "hop 6: the writer is never told the QR's caption exists");
  assert.match(d, /120px/, "hop 6: nothing tells the writer a QR printed too small does not scan");
  assert.equal(marksDirective({}), "", "a site with neither mark still sends the directive");
  // …AND IT ACTUALLY REACHES THE BRIEF. Found by a sweep: deleting the push in
  // `briefWithLayout` SURVIVED, because everything above tests the directive
  // BUILDER and the call ARGUMENTS and nothing tested the join between them.
  // That is the wiring trap in miniature — every piece right, one hop cut — and
  // it is exactly what this file exists to catch.
  const joined = briefWithLayout({ brief: "a cafe", gif: ANIM, qr: { points: "https://x.test", label: "Menu" } });
  assert.match(joined, /SITE_ANIMATED/, "hop 6: the directive is built and never joined into the brief the model reads");
  assert.match(joined, /SITE_QR_LABEL/, "hop 6: the QR half of the directive never reaches the brief");
  const without = briefWithLayout({ brief: "a cafe" });
  assert.ok(!/SITE_QR|SITE_ANIMATED/.test(without), "a site with neither mark is told about them anyway");
  const callAt = w.indexOf("briefWithLayout({");
  const call = w.slice(callAt, w.indexOf(")", callAt));
  assert.match(call, /\bgif\b/, "hop 6: the directive exists and the build never passes the mark to it");
  assert.match(call, /\bqr\b/, "hop 6: the directive exists and the build never passes the QR to it");
});

/* ── the edit half ──────────────────────────────────────────────────────── */

test("both act here — a redraw and two strings are the cheapest edits there are", () => {
  for (const f of ["gif", "qr"]) {
    assert.ok(LANE_FIELDS.includes(f), "there is no `" + f + "` lane, so it can never be changed");
    assert.ok(ACTING_LANES.includes(f), "the `" + f + "` lane no longer acts here");
    assert.deepEqual(Object.keys(editTool(f).input_schema.properties), [f], "the `" + f + "` lane can answer another field");
    assert.deepEqual(editTool(f).input_schema.required, [], "the `" + f + "` lane compels an answer on an edit");
  }
  // The QR lane's own sharpest rule, which is not a syntax rule.
  assert.match(laneRule("qr"), /NEVER INVENT A DESTINATION/, "the QR lane may invent a URL on an edit");
  assert.match(laneRule("gif"), /replaced WHOLE/, "the gif lane does not say that an unreturned shape is gone");
});

test("the designer is shown both, whole", () => {
  const note = currentStateNote({ gif: ANIM, qr: { points: "https://x.test/menu", label: "Menu" } });
  assert.ok(note, "a site with both marks gets no current-state note");
  // WHOLE AND UNCAPPED for the animated mark, like the favicon: it is REPLACED,
  // so the only way to change the timing without redrawing everything is to hand
  // the current document back with that one change made.
  assert.ok(note.includes(ANIM), "the animated mark is not shown to the designer in full — a revise cannot edit it");
  // BOTH HALVES of the QR, because a model shown only the caption re-answers the
  // destination from nothing.
  assert.match(note, /https:\/\/x\.test\/menu/, "the designer is not shown where the QR points");
  assert.match(note, /Menu/, "the designer is not shown the QR's caption");
});
