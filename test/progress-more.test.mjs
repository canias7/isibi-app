// THE BUILDER TALKS THROUGH EVERY STEP (2026-10-19, owner: "it needs to talk
// more … like literally everything … look at claude code"). Each step that used
// to run in silence gives the model facts from its own numbers; the model words
// them. These hold what each fact may say: only what the numbers show, in a
// state the record accepts, and never that anything is published.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildStepFacts, talkBuildStepFacts, addressFacts, PROGRESS_STATES, TALK_STATES } from "../builder/site-progress.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const texts = (fs) => fs.map((f) => f.text).join(" | ");

test("each silent build step now has facts, from its own numbers, in a plain state", () => {
  const cases = [
    [{ s: "links", n: 3, ok: 2 }, /Read 2 pages they linked to[\s\S]*Could not read one page/],
    [{ s: "research", searches: 4 }, /Looked up 4 things about their business/],
    [{ s: "attachments", sent: 2 }, /Read 2 files they attached/],
    [{ s: "ownphotos", placed: 3, missing: 1 }, /Put 3 of their own photographs[\s\S]*Could not use one of their own photographs/],
    [{ s: "media", placed: 1 }, /Put one file from their library/],
    [{ s: "bands", bands: 12, wrote: 10 }, /10 sections side by side, 10 of the 12 planned/],
    [{ s: "fonts", beside: 1 }, /fonts/],
    [{ s: "lang-beside", calls: 2 }, /Translating/],
    [{ s: "compile-retry" }, /trying again/],
    [{ s: "repairing", pages: 2 }, /Fixing 2 pages/],
    [{ s: "repaired", pages: 1 }, /Fixed the page/],
    [{ s: "repaired", failed: 1 }, /did not build/],
    [{ s: "salvaged", stubbed: 2 }, /2 pages would not build[\s\S]*holding page/],
  ];
  for (const [step, re] of cases) {
    const fs = buildStepFacts(step);
    assert.ok(fs.length > 0, step.s + " says nothing");
    assert.match(texts(fs), re, step.s);
    for (const f of fs) {
      assert.ok(PROGRESS_STATES.includes(f.state), step.s + " uses a state a plain record refuses: " + f.state);
      assert.ok(!/publish(ed)? |is live|now live/i.test(f.text.replace(/Not published yet\.|before it is published/g, "")), step.s + " claims a publish: " + f.text);
    }
  }
});

test("a step with nothing to show says nothing — never a fact from a zero", () => {
  for (const step of [{ s: "links", n: 0, ok: 0 }, { s: "research" }, { s: "attachments", sent: 0 }, { s: "ownphotos" }, { s: "media", placed: 0, missing: 0 }, { s: "bands", wrote: 0 }, { s: "repairing" }, { s: "repaired" }, { s: "salvaged" }]) {
    assert.deepEqual(buildStepFacts(step), [], step.s + " spoke from nothing");
  }
});

test("the browser check is said only on a talking record, as a check, as narrow as it reaches", () => {
  assert.deepEqual(buildStepFacts({ s: "render-checked", pages: 5, problems: 0 }), [], "a plain record cannot hold a checked fact");
  const ok = talkBuildStepFacts({ s: "render-checked", pages: 5, problems: 0 });
  assert.equal(ok.length, 1);
  assert.ok(TALK_STATES.includes(ok[0].state) && ok[0].state === "checked");
  assert.match(ok[0].text, /opened all 5 pages in a browser: none showed a problem/);
  assert.match(talkBuildStepFacts({ s: "render-checked", pages: 5, problems: 2 })[0].text, /2 pages have a problem to fix/);
  assert.deepEqual(talkBuildStepFacts({ s: "render-checked", pages: 0 }), []);
});

test("the address is said only when it is one", () => {
  assert.match(addressFacts("harbour-loaf-3")[0].text, /harbour-loaf-3/);
  for (const bad of ["", "Bad Slug", null, 3, "x".repeat(200)]) assert.deepEqual(addressFacts(bad), []);
});

test("THE WIRING: the build opens its record at the start, and the publish's steps reach the trace", () => {
  assert.match(W, /if \(bProgress\) \{ bProgress\.open\(\);/, "the build no longer opens its record when it starts");
  const fn = W.slice(W.indexOf("function buildProgressFor("), W.indexOf("\n}\n", W.indexOf("function buildProgressFor(")));
  assert.match(fn, /open\(\) \{\s*\n\s*if \(p \|\| take\) return;/, "the early open is no longer refused on a carried-on run");
  assert.match(fn, /addressFacts\(slug\)/, "the address the design chose is never said");
  assert.match(W, /repair: quickSend\(env\),\s*\n(?:\s*\/\/.*\n)*\s*note: \(stage, nums\) => \{ try \{ mark\?\.\(stage, nums\); \}/, "the publish's steps no longer reach the build's trace");
});
