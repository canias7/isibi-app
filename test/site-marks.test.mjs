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
import { OWN_LANES, LANE_FIELDS, editTool, laneRule } from "../builder/site-lanes.mjs";
import { marksDirective, briefWithLayout, sceneDirective, pageRulesFor } from "../builder/page-gen.mjs";
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
  // ANCHORED ON THE PROPERTY, NOT THE PHRASING. This pinned two exact sentences
  // and both moved when the field was reshaped on 2026-08-30 — the rule survived
  // intact, said once on the property it governs, and the test still went red.
  // That is this repo's most repeated own-goal, so it now asks what must be TRUE:
  // the destination rule is stated, and omitting is named as the alternative to
  // inventing.
  const pts = QR_FIELD.properties.points.description;
  assert.match(pts, /NEVER INVENT/i, "the rule against inventing a destination is gone from `points`");
  assert.match(pts, /(left out|leave[^.]*out|omit)/i,
    "nothing tells the model to omit the QR rather than invent one — inventing is the failure this guards");
  assert.deepEqual([...QR_FIELD.required].sort(), ["label", "points"],
    "a QR may now be declared without its caption — a black square nobody scans");
});

/* ── the chain, for both, end to end ────────────────────────────────────── */

test("THE CHAIN — both marks reach the site, and survive every later publish", async () => {
  const { tool } = await readSchemaTool();
  const p = tool.input_schema.properties;
  // hop 1: THE QR ONLY, SINCE 2026-08-31. `gif` left the design tool with the
  // owner's call to retire that step, so no new build can ever answer one —
  // and every hop below this line is still asserted for BOTH, because that is
  // exactly what keeps `washhouse-1` and `washhouse-3` serving the marks they
  // already have. A retired field whose storage and publish path quietly rotted
  // would take two live sites' artwork off on their next unrelated edit.
  assert.ok(p.qr, "hop 1: the design step cannot answer the QR");
  assert.ok(!p.gif, "hop 1: `gif` is back in the design tool — it was retired on 2026-08-31, and its lane is gone");
  assert.ok(!tool.input_schema.required.includes("qr"), "`qr` is compelled, so every build will invent one");
  for (const k of ["gif", "qr"]) {
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

test("the QR acts here — two strings are the cheapest edit there is", () => {
  // IT WAS BOTH MARKS UNTIL 2026-08-31 (owner: "delete the gif step for now").
  // The `gif` field left the design tool and its lane went with it, because a
  // lane for a field the build no longer produces bills and edits nothing —
  // asserted in test/edit-lanes.test.mjs, in both directions.
  assert.ok(LANE_FIELDS.includes("qr"), "there is no `qr` lane, so it can never be changed");
  assert.ok(OWN_LANES.includes("qr"), "the `qr` lane no longer acts here");
  assert.deepEqual(Object.keys(editTool("qr").input_schema.properties), ["qr"], "the `qr` lane can answer another field");
  assert.deepEqual(editTool("qr").input_schema.required, [], "the `qr` lane compels an answer on an edit");
  // The QR lane's own sharpest rule, which is not a syntax rule.
  assert.match(laneRule("qr"), /NEVER INVENT A DESTINATION/, "the QR lane may invent a URL on an edit");

  // AND THE GIF LANE IS REALLY GONE, stated positively rather than left as the
  // absence of an assertion — an absence is also what a deleted test looks like.
  assert.ok(!LANE_FIELDS.includes("gif"), "the `gif` lane is back without its design field, so it edits nothing");
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

/* ── AND THE SCENE, which is the same hop and shipped without it ─────────── */

test("THE 3D SCENE REACHES THE PAGE WRITER — the hop `three` shipped without, twice", async () => {
  // `three` is this repo's purest recorded instance of the wiring trap, and it
  // needed TWO hops, which is why it was fixed twice:
  //
  //   2026-08-29  put on `EDIT_FIELDS`, so `mergeLook` stops discarding it.
  //               That fixed STORAGE and bought nothing on its own.
  //   2026-08-30  forwarded into the page directive. Until this, the page rules
  //               said a canvas is written "ONLY where the design step asked for
  //               it in as many words" — a gate on a signal with no way of
  //               reaching the gate, so the answer was always no.
  //
  // THE SECOND ONE IS THE INSTRUCTIVE HALF. After the storage fix the field
  // stored, survived revises, showed in the current-state note and read as
  // working from every angle except the only one that mattered.
  const { tool } = await readSchemaTool();
  assert.ok(tool.input_schema.properties.three, "hop 1: the design step no longer asks for a scene");
  assert.ok(EDIT_FIELDS.includes("three"), "hop 2: the merge discards the scene again");
  const m = mergeLook(null, { three: "the chair, turnable by dragging" }, null, {});
  assert.equal(m.three, "the chair, turnable by dragging", "hop 2: a designed scene does not survive the merge");

  // hop 3: it reaches the directive, and the directive reaches the brief.
  const d = sceneDirective("a slowly turning wireframe of the shopfront");
  assert.match(d, /wireframe of the shopfront/, "hop 3: the scene's own brief is not passed on");
  assert.match(d, /@react-three\/fiber/, "hop 3: the writer is not told which dependency to reach for");
  assert.equal(sceneDirective(""), "", "a site with no scene is told about one anyway");
  const joined = briefWithLayout({ brief: "a furniture maker", three: "the chair, turnable by dragging" });
  assert.match(joined, /turnable by dragging/, "hop 3: the directive is built and never joined into the brief");
  assert.ok(!/3D scene this site asked for/.test(briefWithLayout({ brief: "a cafe" })),
    "a site with no scene gets the scene section anyway");

  // hop 4: the build passes it. Asserted as the PROPERTY — the call is handed
  // `three` — rather than as an argument list, which is the spelling this repo
  // keeps re-pinning and which broke two guards on 2026-08-29 alone.
  const w = bare(worker);
  const callAt = w.indexOf("briefWithLayout({");
  assert.ok(callAt > 0, "hop 4: nothing builds the page directive");
  assert.match(w.slice(callAt, w.indexOf(")", callAt)), /\bthree\b/,
    "hop 4: the directive exists and the build never passes the scene to it");
  assert.match(w, /three: look\.three/, "hop 4: the build args do not read the scene off the stored look");

  // AND THE GATE IT UNBLOCKS IS STILL THERE. If the page rules ever stop
  // deferring to the design step, this whole chain feeds an instruction nobody
  // reads — so the sentence that makes the wiring worth anything is asserted too.
  const rules = pageRulesFor({}, "shopfront");
  assert.match(rules, /ONLY where the design step asked for it/,
    "the page rules no longer defer to the design step, so the scene brief lands on a prompt that ignores it");
});

// ── THE COMPONENT THE QR DIRECTIVE NAMES MUST TAKE THE QR ───────────────────
//
// RUN 84, `washhouse-1`, 8 credits, died at typecheck:
//
//   src/routes/index.tsx(176,14): error TS2322: Type '{ children: Element | null;
//   alt: string; caption: string; ratio: string; }' is not assignable to
//   'IntrinsicAttributes & { src?: string | null; alt?: string; caption?: ... }'
//   Property 'children' does not exist
//   cited: ["index.tsx:176: <Figure"]
//
// The directive tells the page to render the QR as its own `<img src={SITE_QR}>`
// and to show it WITH its caption. The kit has two captioned figures and their
// names do not distinguish them: `Figure` draws its own picture from a `src`
// prop and takes no children, `MediaCaption` takes the picture as a child. The
// model reached for the one whose NAME matched the job and guessed wrong.
//
// This is the directive's own rule applied one level up. It already says "THE
// BINDINGS ARE NAMED EXACTLY, because they are generated: a page that guesses
// `SITE_GIF` does not compile, and the failure blames the page." A page that
// guesses which figure holds children does not compile either, and the failure
// blames the page in exactly the same way.
//
// DERIVED, NOT PINNED. The assertion reads the component name OUT of the
// directive and then checks that component really accepts children — so renaming
// the component, or naming a different one, keeps this honest instead of going
// red for the change. Pinning the spelling is this repo's most repeated own-goal.
test("the component the QR directive names really accepts children", async () => {
  const { marksDirective } = await import("../builder/page-gen.mjs");
  const text = marksDirective({ qr: { label: "Scan for the wifi" } });
  assert.ok(text, "the QR directive produced nothing — this guard is reading the wrong shape");

  // THE COMPONENT AND ITS FILE, READ OUT OF THE DIRECTIVE'S OWN EXAMPLE rather
  // than out of a sentence about it. The example is the part a model copies, so
  // it is the part that has to be true; a prose name beside a wrong example is
  // the same defect wearing a correct-looking sentence.
  const comp = (text.match(/`<([A-Z][A-Za-z]*)[^`]*<\/\1>`/) || [])[1];
  const file = (text.match(/from `@\/components\/ui\/([a-z-]+)`/) || [])[1];
  assert.ok(comp && file,
    "the QR directive no longer shows a component wrapping the code, or no longer says where it comes from:\n" + text);

  const src = readFileSync(new URL("../builder/lovable/template/src/components/ui/" + file + ".tsx", import.meta.url).pathname, "utf8");
  assert.match(src, new RegExp("export function " + comp + "\\b"),
    "`" + comp + "` is not exported from " + file + ".tsx — the directive names a component that is not there");
  // THE WHOLE POINT: it must take children. A captioned component that draws its
  // own picture cannot hold a QR the page was told to render itself.
  assert.match(src.slice(src.indexOf("export function " + comp)), /^[^}]*\bchildren\b/,
    "`" + comp + "` does not take `children`, so the page cannot put the QR inside it — " +
    "this is run 84's TS2322 exactly");
});

test("…and it is a WALL rather than a rule — the named component cannot be got wrong", () => {
  // WHAT CHANGED AND WHY, because this test asserted the OPPOSITE this morning.
  //
  // The first fix for runs 84/85 was to name the right component in the prompt
  // and warn off `Figure`, which draws its own picture from `src`. That is a
  // rule in prose, and run 85 read past it exactly as this repo says a model
  // eventually will: same TS2322, same component, a different line.
  //
  // So `Figure` takes children now. The capability was never missing —
  // `MediaCaption` had it — what was missing was any way for a model to know
  // which of two captioned figures holds children, because their names do not
  // say. Making the obvious name work removes the choice instead of governing
  // it, and that is the difference between a wall and a rule.
  //
  // ASSERTED ON THE COMPONENT, NOT ON THE PROMPT. A directive naming a component
  // that cannot hold what it is handed is the defect; a component that can hold
  // it makes every phrasing of the directive correct.
  const dir = new URL("../builder/lovable/template/src/components/ui/", import.meta.url).pathname;
  for (const [file, comp] of [["figure", "Figure"], ["media-caption", "MediaCaption"]]) {
    const src = readFileSync(dir + file + ".tsx", "utf8");
    const sig = src.slice(src.indexOf("export function " + comp), src.indexOf("return (", src.indexOf("export function " + comp)));
    assert.match(sig, /\bchildren\b/,
      "`" + comp + "` no longer takes children — a page told to render its own <img> and caption it " +
      "cannot use it, which is runs 84 and 85 exactly (TS2322, 22 credits)");
  }
});

// ── THE QR FIELD MUST NOT OUT-PROHIBIT THE ONE THAT WORKS ───────────────────
//
// THREE PAID DECLINES (runs 84, 85, 86) on sites where a QR was the obvious
// answer. Run 86 removed every other explanation: the brief handed over real
// wifi credentials AND said "put a code on the page they can scan to join it",
// both of the field's own triggers fired, the payload was checked drawable
// beforehand, and the container suite already proved a QR compiles, publishes
// and reaches the page. The model used the credentials and printed them as text.
//
// `gif` IS THE CONTROL AND IT IS A REAL ONE. Same build, same call, same kind of
// optional mark — and it FIRED; the drum is on the published page. So the thing
// that differed was the wording, measurably:
//
//     gif   1,225 chars, a "WHAT IT IS FOR" paragraph, 4 omit-ish phrases
//     qr      668 chars, no positive case at all,       7 omit-ish phrases
//
// DERIVED FROM `gif`, NOT PINNED TO A NUMBER. The claim is comparative — the
// optional field that keeps being skipped may not be phrased more negatively
// than the optional field that gets used — so it stays true if either is
// rewritten, and it cannot rot into a magic constant nobody can re-derive.
// A COUNT OF NEGATIVE PHRASES WAS TRIED HERE AND DELETED, which is worth saying
// so nobody adds it back. The idea was to assert the QR field is not phrased more
// negatively than `gif`, the optional mark models actually use. The regex counted
// "you never draw one and never need a library" — two reassurances that the work
// is done FOR the model — as prohibitions, so it scored a positive sentence as a
// refusal and would have gone red on correct wording. A check that flags correct
// code teaches the next session away from something that works, and this repo
// holds that to be worse than the miss. The two properties below are the half of
// the idea that can be stated honestly.

test("…and it says what a QR is FOR, which is what the working field has and it did not", async () => {
  const { QR_FIELD } = await import("../builder/site-qr.mjs");
  const { GIF_FIELD } = await import("../builder/site-favicon.mjs");
  // THE POSITIVE HALF, asserted as a property rather than a phrase: the field
  // has to describe the situation it belongs in, not only the situations it does
  // not. `gif` does this and is used; the QR did not and was not.
  assert.match(GIF_FIELD.description, /WHAT IT IS FOR/,
    "the gif field lost its positive case — it is the pattern this check is copied from, so fix that first");
  assert.match(QR_FIELD.description, /WHAT IT IS FOR/,
    "the QR field no longer says what a QR is for, only when to omit one — the shape that declined three " +
    "times on briefs that plainly wanted one");
});

test("…and the destination rule survives, stated once, on the property it governs", async () => {
  const { QR_FIELD } = await import("../builder/site-qr.mjs");
  // NOT LOOSENED, and this is the half that must not drift. The owner's call when
  // asked was to hand the brief a real destination rather than let a QR invent
  // one, so the strictness is deliberate. What changed is that it is said ONCE,
  // on `points`, which is the property that actually carries the destination —
  // rather than three times across a field that also has to decide whether to
  // exist at all.
  assert.match(QR_FIELD.properties.points.description, /NEVER INVENT IT/,
    "a QR may invent its destination now — that is a product decision and not a wording tidy-up");
  assert.doesNotMatch(QR_FIELD.description, /NEVER INVENT/,
    "the destination rule is back in the top-level description as well as on `points` — said twice, it is " +
    "two of the four omit instructions that made this field unusable");
});
