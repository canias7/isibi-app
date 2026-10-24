// THE PROGRESS VOICE (owner, 2026-10-23): progress talk sounds like a
// professional speaking to a client — first person, but not "I" / "I am" at
// the start of every line, each line new and specific, no repeated tails, a
// problem said once. Every live writer carries the same voice block with the
// owner's approved Saltmarsh lines, and the facts fed per line no longer carry
// the standing "not published yet" tail or re-tell a missing photograph as
// something to say again. Properties, not spellings, wherever a property can
// be asserted.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROGRESS_VOICE, PROGRESS_SYSTEM, TALK_SYSTEM, TASK_SYSTEM, progressRequest, talkRequest, taskRequest,
  buildStepFacts, talkBuildStepFacts, compileStageFacts, sectionDoneFacts, editStepFacts, addonPagesFacts, addonPhotosFacts,
  openRecord, appendMark, progressContext,
} from "../builder/site-progress.mjs";
import { SCAN_LINE_RULE, scanLineRule } from "../builder/security-say.mjs";

const src = readFileSync(new URL("../builder/site-progress.mjs", import.meta.url), "utf8");
const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("PV 1 — the voice block: client-facing, first person without I as the default opener, varied openings, specific names, no repeated tails, a problem once", () => {
  assert.equal(typeof PROGRESS_VOICE, "string");
  assert.ok(PROGRESS_VOICE.length > 200, "the voice block is empty");
  assert.match(PROGRESS_VOICE, /professional speaking to a client/i);
  assert.match(PROGRESS_VOICE, /first person/i);
  assert.match(PROGRESS_VOICE, /never "I" or "I am" as the default opener/);
  assert.match(PROGRESS_VOICE, /vary how lines begin/i);
  assert.match(PROGRESS_VOICE, /real names from the facts/i);
  assert.match(PROGRESS_VOICE, /No repeated tails/i);
  assert.match(PROGRESS_VOICE, /draft[^.\n]*once/i, "the draft/publish status is not said once");
  assert.match(PROGRESS_VOICE, /problem is said once/i);
  assert.match(PROGRESS_VOICE, /no jargon/i);
  // The example is a tone, not a template, and the facts still decide.
  assert.match(PROGRESS_VOICE, /never words to copy/i);
  assert.match(PROGRESS_VOICE, /say only what your own facts say/i);
});

test("PV 2 — the owner's approved example is carried whole, and its own lines do not open with I", () => {
  const ex = PROGRESS_VOICE.split("\n").filter((l) => /^ {2}\S/.test(l)).map((l) => l.trim());
  assert.equal(ex.length, 7, "the seven approved lines are not all there");
  assert.match(ex[0], /saltmarsh-and-sparrow\.gofarther\.app/);
  assert.match(ex[1], /sea-glass green, sand and white/);
  assert.match(ex[4], /One photo didn't come through/);
  assert.match(ex[6], /saved as a draft[^]*Publish/);
  for (const l of ex) assert.doesNotMatch(l, /^I\b|^I'm\b|^I am\b/, l);
  // Each line opens differently.
  assert.equal(new Set(ex.map((l) => l.split(/\s+/)[0])).size, ex.length);
  // The draft is said once, in the last line only.
  assert.equal(ex.filter((l) => /draft|Publish/.test(l)).length, 1);
  assert.equal(ex.filter((l) => /photo/i.test(l)).length, 1);
});

test("PV 3 — every live writer carries the voice: the update, the conversational update (builds, edits, add-ons, the buttons), the task lines and parallel opening, the scan's lines", () => {
  for (const [name, sys] of [["PROGRESS_SYSTEM", PROGRESS_SYSTEM], ["TALK_SYSTEM", TALK_SYSTEM], ["TASK_SYSTEM", TASK_SYSTEM], ["SCAN_LINE_RULE", SCAN_LINE_RULE], ["scanLineRule", scanLineRule(["Looking at the booking form."])]]) {
    assert.ok(sys.includes(PROGRESS_VOICE), name + " does not carry the voice");
  }
  // The requests really send it.
  const f = [{ id: "f1", state: "doing", text: "x" }];
  assert.ok(progressRequest({ facts: f, model: "m" }).system[0].text.includes(PROGRESS_VOICE));
  assert.ok(talkRequest({ facts: f, model: "m" }).system[0].text.includes(PROGRESS_VOICE));
  assert.ok(taskRequest({ tasks: [{ n: 1, words: "a" }], model: "m", split: 2 }).system[0].text.includes(PROGRESS_VOICE));
  // The old default opener is gone from each writer's first-person rule.
  for (const sys of [PROGRESS_SYSTEM, TALK_SYSTEM, TASK_SYSTEM]) {
    assert.match(sys, /Speak in the first person, as THE VOICE below says/);
    assert.doesNotMatch(sys, /naturally and conversationally, the way you would tell them yourself/);
  }
  // The task writer's titles and opening vary too.
  assert.match(TASK_SYSTEM, /titles and the opening never all begin the same way/);
});

test("PV 4 — a problem once: the writers say a not-done thing once, and the standing list tells later lines not to say it again", () => {
  for (const sys of [PROGRESS_SYSTEM, TALK_SYSTEM]) {
    assert.match(sys, /once, where it is news/);
    assert.doesNotMatch(sys, /in every update/, "a writer is still told to repeat a not-done thing on every update");
  }
  let rec = openRecord({ job: "a".repeat(32), uid: "u1", slug: "saltmarsh-and-sparrow", op: "build", run: "run-1", at: 1, talk: true });
  rec = appendMark(rec, { stage: "photos", at: 2, facts: buildStepFacts({ s: "photos-missing", missing: 1 }) }).rec;
  assert.ok(rec, "the record was not opened");
  rec = { ...rec, marks: rec.marks.map((m) => ({ ...m, state: "said" })), lines: [{ text: "One photo didn't come through, so that space stays clean." }] };
  const ctx = progressContext(rec);
  // The observer is alive: the missing photograph is in the standing list.
  assert.match(ctx, /NOT DONE IN THIS WORK[^]*A photograph could not be made/);
  assert.match(ctx, /already told to them once: do not say any of them again/);
  assert.doesNotMatch(ctx, /every update/);
});

test("PV 5 — no repeated tail in the per-line facts: no fact of a step that does not publish carries the standing not-published sentence", () => {
  const cases = [...new Set([...src.matchAll(/case "([a-z-]+)"/g)].map((m) => m[1]))];
  assert.ok(cases.length > 20, "the step names were not found");
  const step = { started: 3, open: 2, n: 1, used: 3, missing: 1, unsure: 1, stored: 1, placed: 2, wrote: 3, bands: 4, pages: 2, tables: 2, failed: 0, db: 1 };
  const seen = [];
  for (const s of cases) {
    for (const f of [...buildStepFacts({ s, ...step }), ...talkBuildStepFacts({ s, ...step })]) seen.push(f);
  }
  for (const st of ["routesMs", "tscMs", "viteMs", "renderMs", "queued"]) seen.push(...compileStageFacts(st));
  seen.push(...sectionDoneFacts(["The harbour welcome"], 1, 3));
  seen.push(...addonPagesFacts({ added: ["/events"], changed: ["/"], linked: [{ to: "/events", at: ["/visit"] }] }));
  seen.push(...addonPhotosFacts({ planned: ["a loaf"], bought: ["a loaf"] }));
  const ed = editStepFacts({ step: { layer: "look", page: "/" }, ok: true }, 0, 1);
  if (ed) seen.push(...(Array.isArray(ed) ? ed : [ed]));
  // The observer is alive: prepared facts were produced.
  const prepared = seen.filter((f) => f && f.state === "prepared");
  assert.ok(prepared.length >= 6, "too few prepared facts to judge: " + prepared.length);
  for (const f of seen) {
    if (!f || f.state === "published") continue;
    assert.doesNotMatch(f.text, /not published yet|site is not published/i, "a per-line fact carries the standing tail: " + f.text);
  }
});

test("PV 6 — the scan's lines: every line written under the shared rule, and each new line is handed the ones already shown", () => {
  assert.doesNotMatch(worker, /scanSay\([^\n]*"WRITE ONE SHORT LINE, UNDER 120 CHARACTERS/, "a scan line is still written under the bare rule");
  assert.match(worker, /scanSay\(facts, "", url\.searchParams\.get\("picker"\), scanLineRule\(evs\.map\(\(e\) => e\.line\)\), 160\)/);
  assert.match(worker, /scanSay\(securityWorkingFacts\(\{ plan: std \}\), words, url\.searchParams\.get\("picker"\), SCAN_LINE_RULE, 160\)/);
  const r = scanLineRule(["Looking at the booking form.", undefined, ""]);
  assert.match(r, /ALREADY SHOWN[^]*- Looking at the booking form\./);
  assert.equal((r.match(/^- /gm) || []).length - (SCAN_LINE_RULE.match(/^- /gm) || []).length, 1);
  assert.equal(scanLineRule([]), SCAN_LINE_RULE);
});
