// PARKED (2026-11-03, park-old-way): the old-way half of test/site-render.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The render check's judgement, driven with literal observations.
//
// The point of the module/harness split is that this file needs no browser, no
// container and no dist — every threshold and every "does this cry wolf" case is
// a plain object in and a list of findings out. What the browser MEASURES is
// covered by the integration build, which is the only thing that can prove a
// real page produces these shapes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  VIEWPORTS, BLANK_TEXT_CHARS, MIN_CONTRAST, OVERFLOW_SLACK, MAX_FINDINGS,
  OVERLAY_TRIGGERS, MAX_OPENS, MIN_PANEL_ALPHA,
  probe, probeOverlay, readPage, readOverlay, renderReport, renderNote, isSerious, SERIOUS,
  isNavTimeout, resolveSlow,
  HYDRATION_ERROR, hydrationProbe, hydrationDetail, checkOrder,
} from "../../../builder/site-render.mjs";

const clean = { route: "/", viewport: "phone", text: 900, images: 2, broken: [], overflow: 0, wide: [], contrast: [], pageErrors: [], consoleErrors: [] };
const kinds = (f) => f.map((x) => x.kind);

// ── a hydration mismatch names itself (task #80, 2026-09-04) ─────────────────

const REACT_418 = "Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";

test("EVERY EDIT LANE FORWARDS THE RENDER REPORT it paid for", () => {
  // The check runs inside the container on every compile — ~6s a build — and
  // every edit lane used to throw the result away (2026-08-14 audit): a cheap
  // edit that turned the site blank or unreadable reported success with the
  // one instrument that saw it discarded.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // The spine returns it, under the build response's own noteworthy contract —
  // the report rides only when it FAILED or found something, so a clean
  // render stays silence on the wire and no clean edit's response changes.
  const at = w.indexOf("async function recompileAndPublish(env, {");
  assert.ok(at > 0, "the spine is gone — rescope this");
  const spine = w.slice(at, w.indexOf("\nasync function siteOgImage(", at));
  assert.match(spine, /built\.render && \(built\.render\.ok === false \|\| \(built\.render\.findings \|\| \[\]\)\.length\)/,
    "the spine drops the container's render report again, or lost the noteworthy gate");
  // (2026-10-22, audit A32-1: the language note rides beside it.)
  assert.match(spine, /renderNote: \[renderNote\(built\.render\), langNote\(langOutcomes, langsRefused\), staleNote\(langStale\)\]\.filter\(Boolean\)\.join\(" "\) \|\| undefined/,
    "the human sentence beside the report is gone");
  // …and every call site forwards it. DERIVED from the call sites themselves,
  // so an eighth lane added later is covered without anybody remembering this
  // file. (The live on/off lane returns the spine's whole result and needs no
  // per-field forward — it has no `const X = await` capture, so the loop
  // correctly skips it.)
  // `publishStep` since 2026-08-29 — the edit route's branches hand their pages
  // to a deferring wrapper so the spine runs ONCE per message (owner: "if the
  // act was 2 things then 1 publish"). The property is unchanged: this branch
  // still hands its pages to the publish path.
  const sites = [...w.matchAll(/const (\w+) = await publishStep\(env/g)].map((m) => m[1]);
  assert.ok(sites.length >= 6, "the spine's call sites moved — rescope this");
  for (const v of new Set(sites)) {
    assert.ok(new RegExp("render: " + v + "\\.render").test(w),
      v + " pays for the render check and discards the result again");
    assert.ok(new RegExp("renderNote: " + v + "\\.renderNote").test(w),
      v + " forwards the report but drops its sentence");
  }
  // …and the CLIENT says it. A note carried to a response nothing displays is
  // the works-but-cannot-say-so disease stopped one layer short.
  const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  // THE PROPERTY, NOT THE SPELLING. This pinned the exact expression
  // `finish(editReply(e) + renderTail(e))` and went red the day a SECOND honest
  // tail was appended beside it — a test about word order, reporting "the edit
  // reply drops the render sentence" about a reply that carries it perfectly.
  // The repeated own-goal in this repo; what must hold is that the sentence is
  // in the call, not what else is.
  // RE-ANCHORED 2026-10-02: the reply is composed once (`doneText`) and shown
  // as it is, or with a step's question after it — the sentence is in both.
  // RE-ANCHORED 2026-10-03: a reply the server had a model write comes first,
  // and it carries the render sentence as one of the facts it must cover
  // (`renderNote`, test/model-replies.test.mjs); the composed reply below it
  // still carries `renderTail`.
  assert.match(chat, /const doneText = EditPoll\.modelReply\(e\) \|\| \(editReply\(e\)[^;]*renderTail\(e\)[^;]*;\s*finish\(asked \? askReplyMsg\(doneText, [^;]*\) : doneText\);/, "the edit reply drops the render sentence");
  assert.match(chat, /const doneText = EditPoll\.modelReply\(a\) \|\| \(addonReplyText\(a\)[^;]*renderTail\(a\)[^;]*;\s*finish\(asked \? askReplyMsg\(doneText, [^;]*\) : doneText\);/, "the addon reply drops the render sentence");
  assert.match(chat, /function renderTail\(d\)[\s\S]{0,900}?renderNote/, "renderTail no longer reads renderNote");
});
