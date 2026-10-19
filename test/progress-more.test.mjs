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
  assert.match(fn, /open\(\) \{(?:\s*\n\s*\/\/.*)*\s*\n\s*if \(p \|\| take \|\| typeof env\.JOB_PROGRESS !== "function"\) return;/, "the early open is no longer kept to the container's own run, or no longer refused on a carried-on run");
  assert.match(fn, /addressFacts\(slug\)/, "the address the design chose is never said");
  assert.match(W, /repair: quickSend\(env\),\s*\n(?:\s*\/\/.*\n)*\s*note: \(stage, nums\) => \{ try \{ mark\?\.\(stage, nums\); \}/, "the publish's steps no longer reach the build's trace");
});

// ── ROUND 2: THE WRITING AS IT GOES ─────────────────────────────────────────
import { filesDoneSoFar } from "../builder/gen-code.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

const SERVER = readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

test("R2 the answer so far counts only the files it has FINISHED, never one still open", () => {
  const full = JSON.stringify({ pages: [{ path: "index.tsx", source: 'a "quoted" \\ line' }, { path: "menu.tsx", source: "x" }] });
  const counts = [];
  for (let k = 0; k <= full.length; k++) counts.push(filesDoneSoFar(full.slice(0, k)));
  assert.equal(counts[counts.length - 1], 2);
  for (let k = 1; k < counts.length; k++) assert.ok(counts[k] >= counts[k - 1], "the count went backwards at " + k);
  assert.equal(filesDoneSoFar(full.slice(0, full.indexOf("a \\\"quoted"))), 0, "a file still being written was counted");
  for (const bad of ["", null, 3, "{", '{"path":"x"']) assert.equal(filesDoneSoFar(bad), 0);
});

test("R2 the writing count is a fact only when it shows something", () => {
  assert.match(texts(buildStepFacts({ s: "writing", sections: 3, of: 12 })), /3 of 12 sections finished so far/);
  assert.match(texts(buildStepFacts({ s: "writing", sections: 30, of: 12 })), /12 of 12/, "more sections than planned were claimed");
  assert.match(texts(buildStepFacts({ s: "writing", files: 2 })), /2 parts of the site finished so far/);
  for (const z of [{ s: "writing" }, { s: "writing", sections: 0, of: 12 }, { s: "writing", files: 0 }]) assert.deepEqual(buildStepFacts(z), []);
  for (const f of buildStepFacts({ s: "writing", files: 2 })) assert.ok(!/file|code/i.test(f.text), "the fact names files or code: " + f.text);
});

test("R2 THE POLL HANDS EACH NEW COUNT TO THE CALLER, ONCE PER CHANGE — and a count that throws never costs the call", async () => {
  const { pagesHopApi } = await loadWorkerModule();
  const plan = [{ state: "pending", files: 0 }, { state: "pending", files: 1 }, { state: "pending", files: 1 }, { state: "pending", files: 3 }, { state: "done", answer: { content: [] } }];
  let i = 0;
  const box = { fetch: async (req) => {
    const u = new URL(req.url);
    if (u.pathname === "/model/start") return new Response(JSON.stringify({ ok: true, id: "g1" }));
    if (u.pathname === "/model/result") return new Response(JSON.stringify({ ok: true, ...plan[Math.min(i++, plan.length - 1)] }));
    return new Response("{}", { status: 404 });
  } };
  const env = { SITE_BUILD_CONTAINER: { local: true, idFromName: (n) => n, get: () => box } };
  const ticks = [];
  const out = { onTick: (t) => { ticks.push(t); if (ticks.length === 1) throw new Error("boom"); } };
  const ans = await pagesHopApi.containerPagesFanLocal(env, "s", out)({}, { model: "grok-4.6" }, null);
  assert.deepEqual(ans, { content: [] });
  assert.deepEqual(ticks, [{ files: 1 }, { files: 3 }], "the counts were not handed over once per change");
});

test("R2 THE CONTAINER COUNTS WHILE IT WORKS AND SAYS SO WHILE PENDING", () => {
  assert.match(SERVER, /MODEL_JOBS\.set\(id, \{ state: "pending", startedAt: Date\.now\(\), touchedAt: Date\.now\(\), \.\.\.\(mReqs \? \{ of: mReqs\.length, done: 0, doneIdx: \[\], live: \{\} \} : \{ files: 0, words: \[\] \}\) \}\);/, "a pending job no longer carries its count");
  assert.match(SERVER, /\.finally\(\(\) => tick\(i\)\)\);/, "a fan-out's calls no longer count, by index, as they end");
  assert.match(SERVER, /const k = filesDoneSoFar\(partial\); if \(k > \(j\.files \|\| 0\)\) j\.files = k;/, "a single call no longer counts its finished files");
  assert.match(SERVER, /state: "pending", waitingMs: Date\.now\(\) - job\.startedAt, \.\.\.\(Number\.isInteger\(job\.of\) \? \{ of: job\.of, done: job\.done \|\| 0, doneIdx: Array\.isArray\(job\.doneIdx\) \? job\.doneIdx\.slice\(0, 64\) : \[\] \} : \{\}\), \.\.\.\(Number\.isInteger\(job\.files\) \? \{ files: job\.files \} : \{\}\), \.\.\.\(job\.live/, "the pending answer no longer hands the count back");
  assert.match(W, /if \(\(t\.sections \|\| t\.files\) && count !== lastCount\) \{ lastCount = count; try \{ mark\?\.\("writing", \{ sections: t\.sections, of: t\.of, files: t\.files \}\); \}/, "the build no longer puts the count on its trace, once per change");
});

// ── ROUND 3: EDITS AND ADD-ONS STEP BY STEP ─────────────────────────────────
import { editStepStartFacts, editStepFacts, editBuildingFacts, draftSavedFacts, editPublishFacts, addonPublishFacts } from "../builder/site-progress.mjs";

test("R3 each part of an edit is said as it starts and as it ends, in its own state", () => {
  const step = { layer: "look", page: "/visit", fields: ["the band order"] };
  assert.match(texts(editStepStartFacts(step, 0, 3)), /Working on: the band order on \/visit \(part 1 of 3\)\. Nothing is changed yet\./);
  assert.ok(!/part/.test(texts(editStepStartFacts(step, 0, 1))), "a one-part edit is numbered");
  assert.deepEqual(editStepFacts({ step, failed: false }, 1, 3).map((f) => f.state), ["prepared"]);
  assert.deepEqual(editStepFacts({ step: { layer: "data", fields: ["price"] }, failed: false }, 0, 2).map((f) => f.state), ["applied"]);
  assert.deepEqual(editStepFacts({ step, failed: true }, 2, 3).map((f) => f.state), ["notdone"]);
  assert.deepEqual(editStepFacts(null, 0, 2), []);
  assert.deepEqual(editStepStartFacts(null, 0, 2), []);
});

test("R3 A DRAFT IS NEVER SAID AS A PUBLISH — edits, add-ons and builds alike", () => {
  const done = [{ step: { layer: "look", fields: ["x"] }, failed: false }];
  assert.match(texts(editPublishFacts(done)), /Publishing the site with the changes now/);
  const d = texts(editPublishFacts(done, { draft: true }));
  assert.match(d, /Saving the changes to their draft now/);
  assert.ok(!/Publishing/.test(d), "a draft edit is said as publishing");
  assert.match(texts(addonPublishFacts([], { draft: true })), /Saving the additions to their draft now/);
  assert.ok(!/Publishing/.test(texts(addonPublishFacts([], { draft: true }))));
  assert.match(texts(talkBuildStepFacts({ s: "container", draft: 1 })), /Saving the site as their draft now/);
  assert.ok(!/Publishing/.test(texts(talkBuildStepFacts({ s: "container", draft: 1 }))));
  assert.match(texts(talkBuildStepFacts({ s: "container" })), /Publishing the site now/);
  assert.deepEqual(draftSavedFacts().map((f) => f.state), ["prepared"]);
  assert.deepEqual(editBuildingFacts().map((f) => f.state), ["doing"]);
});

test("R3 THE WIRING: each part, the build wait and the draft save are marked, and the publish facts know a draft", () => {
  assert.match(W, /eJob\.progress\.mark\("part", editStepStartFacts\(step, steps\.indexOf\(step\), steps\.length\)\)/, "a part is no longer said as it starts");
  assert.match(W, /done\.push\(\{ step, res, body, failed \}\);\s*\n(?:\s*\/\/.*\n)*\s*if \(steps\.length > 1 && eJob && eJob\.progress && eJob\.progress\.talk\) \{ try \{ eJob\.progress\.mark\("part-done", editStepFacts\(done\[done\.length - 1\]/, "a part's outcome is no longer said when it has one");
  assert.match(W, /job\.progress\.mark\("building", editBuildingFacts\(\)\)/, "the build wait is silent again");
  assert.match(W, /if \(act\.draft && job && job\.progress && job\.progress\.talk\) job\.progress\.mark\("saved", draftSavedFacts\(\)\)/, "a draft save is no longer said");
  assert.match(W, /editPublishFacts\(done, \{ draft: draftFirst\(env\) \}\)/, "an edit's publish facts no longer know a draft");
  assert.match(W, /addonPublishFacts\(aPendingPhotos, \{ draft: draftFirst\(env\) \}\)/, "an add-on's publish facts no longer know a draft");
  assert.match(W, /mark\?\.\("container", draftFirst\(env\) \? \{ draft: 1 \} : undefined\)/, "a build's container step no longer knows a draft");
});

// ── ROUND 4: THE BUTTONS TALK (owner chose "B") ─────────────────────────────
import { actionFacts, actionContext, ACTION_KINDS } from "../builder/site-progress.mjs";
const CHATJS = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("R4 every step of every press has a fact in a talking state, and nothing is said as live before the switch", () => {
  const steps = { publish: ["start", "prepare", "prepared", "switched", "schema", "seeds", "already", "failed"], restore: ["start", "switched", "draft", "failed"], discard: ["start", "done", "failed"], delete: ["start", "done", "failed"] };
  for (const kind of ACTION_KINDS) for (const st of steps[kind]) {
    const fs = actionFacts(kind, st, { revision: 3, error: "x" });
    assert.ok(fs.length > 0, kind + ":" + st + " says nothing");
    for (const f of fs) assert.ok(TALK_STATES.includes(f.state), kind + ":" + st + " " + f.state);
  }
  for (const st of ["start", "prepare", "prepared"]) for (const f of actionFacts("publish", st)) assert.notEqual(f.state, "published", "publish:" + st + " says it is live before the switch");
  assert.equal(actionFacts("publish", "switched")[0].state, "published");
  assert.match(texts(actionFacts("publish", "changes", { n: 3 })), /3 changes/);
  assert.deepEqual(actionFacts("publish", "changes", { n: 0 }), []);
  assert.deepEqual(actionFacts("publish", "done", { skipped: 0 }), []);
  assert.match(texts(actionFacts("publish", "done", { skipped: 2 })), /2 changes could not be saved/);
  assert.match(texts(actionFacts("discard", "done", { dropped: 1 })), /Dropped one unpublished change[\s\S]*live site did not change/);
  assert.deepEqual(actionFacts("nope", "start"), []);
  assert.match(actionContext({ kind: "publish", slug: "harbour-loaf-3", lines: [{ text: "said before" }] }), /THIS WORK: publishing their draft[\s\S]*said before/);
});

test("R4 THE WIRING: each route says its steps through the press's own talk, and the page reads them", () => {
  assert.match(W, /function actionTalk\(env, ctx, \{ id, uid, slug, kind \}\) \{\s*\n\s*const none = \{ say\(\) \{\}, end\(\) \{\}, on: false \};\s*\n\s*if \(!talkOn\(env\)/, "the press talks with talk off, or the helper is gone");
  assert.match(W, /const talk = actionTalk\(env, ctx, \{ id: pbody && pbody\.talk, uid: ou\.id, slug: ownerSlug, kind: "publish" \}\);/);
  assert.match(W, /publishDraft\(env, ownerSlug, \{ revision, version \}, \{ uid: ou\.id, say: \(st, info\) => talk\.say\(actionFacts\("publish", st, info\)\) \}\)/);
  assert.match(W, /const talk = actionTalk\(env, ctx, \{ id: dbody && dbody\.talk, uid: ou\.id, slug: ownerSlug, kind: "discard" \}\);/);
  assert.match(W, /const talk = actionTalk\(env, ctx, \{ id: vb && vb\.talk, uid: ou\.id, slug: ownerSlug, kind: "restore" \}\);/);
  assert.match(W, /await save\(\{ phase: "switched", done: \[\] \}\);\s*\n\s*tell\("switched"\);/, "the switch is no longer said when it happens");
  assert.equal((W.match(/runPublication\(env, slug, j, etag, say\)/g) || []).length, 2, "a click's publication does not carry its talk");
  assert.match(W, /const o = await env\.SITES_BUCKET\.get\(actionTalkKey\(tu\.id, tk\[1\]\)\)/, "the lines are not read under the caller's own account");
  for (const route of ["/publish'", "/draft/discard'", "/versions/restore'"]) {
    const at = CHATJS.indexOf(route);
    assert.ok(at > 0 && /const talk = typeof siteActionTalk === 'function' \? siteActionTalk\(slug\) : '';/.test(CHATJS.slice(Math.max(0, at - 400), at)), "the page does not name its press before " + route);
  }
  assert.match(CHATJS, /m\.talkLive === true \? \(Array\.isArray\(m\.prog\) && m\.prog\.length \? progressListHTML\(m\.prog, true\)/, "a press's lines are not drawn live");
});

// ── ROUND 5: THE DESIGN SAYS WHAT IT IS DOING ───────────────────────────────
import { designStartFacts, designPartFacts } from "../builder/site-progress.mjs";
import { designInGraph } from "../builder/design-graph.mjs";
import { designInWaves } from "../builder/design-waves.mjs";

const TOOL = { name: "design_schema", input_schema: { type: "object", properties: { pages: { type: "array" }, theme: { type: "string" }, brand: { type: "string" } } } };
const answer = (input) => ({ content: [{ type: "tool_use", name: "design_schema", input }], usage: { input_tokens: 1, output_tokens: 1 } });

test("R5 a design part is said as it starts, by what it works on, and as it ends, by what it decided", () => {
  assert.match(texts(designStartFacts("shape")), /Now designing the layout of each page[\s\S]*Nothing is decided yet/);
  assert.match(texts(designStartFacts("theme")), /choosing the site's look/);
  for (const quiet of ["kind", "web", "lang", "extras", "", null]) assert.deepEqual(designStartFacts(quiet), [], String(quiet));
  const got = texts(designPartFacts({ brand: "Harbour Loaf", pages: [{ name: "Home", path: "/" }, { name: "Menu", path: "/menu" }], shape: [{ path: "/", sections: ["a", "b"] }], theme: "bakery", wordmark: { x: 1 } }));
  for (const re of [/Named the site "Harbour Loaf"/, /Planned 2 pages: Home, Menu/, /2 sections in all/, /"bakery" style/, /name as a logo/]) assert.match(got, re);
  assert.ok(!/photo/i.test(got), "the design is said to choose photographs");
  assert.deepEqual(designPartFacts({ images: [{ describe: "a loaf" }], kind: "shop" }), [], "a part with nothing a customer would recognise spoke");
});

test("R5 THE DESIGNERS HAND EACH PART ON AS IT STARTS AND AS IT ENDS — and a throwing listener never costs the design", async () => {
  const graph = [{ name: "pages", fields: ["pages"], needs: [] }, { name: "theme", fields: ["theme"], needs: ["pages"] }];
  const seen = [];
  const onPart = (p) => { seen.push(p.start ? "start:" + p.agent : "done:" + p.agent + ":" + Object.keys(p.got).join(",")); if (seen.length === 1) throw new Error("boom"); };
  const call = async (req) => answer(JSON.stringify(req).includes('"theme"') && !JSON.stringify(req).includes('"pages":{') ? { theme: "bakery" } : { pages: [{ name: "Home", path: "/" }] });
  await designInGraph({ tool: TOOL, system: "s", brief: "b", model: "m", maxTokens: 10, graph, onPart }, call);
  assert.equal(seen[0], "start:pages");
  assert.ok(seen.indexOf("done:pages:pages") > 0 && seen.indexOf("start:theme") > seen.indexOf("done:pages:pages"), "the parts were not said in their own order: " + seen.join(" "));
  const wseen = [];
  await designInWaves({ tool: TOOL, system: "s", brief: "b", model: "m", maxTokens: 10, waves: [[{ name: "identity", fields: ["brand"] }]], onPart: (p) => wseen.push(p.start ? "start:" + p.agent : "done:" + p.agent + ":" + Object.keys(p.got).join(",")) }, async () => answer({ brand: "Harbour Loaf" }));
  assert.deepEqual(wseen, ["start:identity", "done:identity:brand"]);
});

test("R5 THE WIRING: the build hands the design's talk to the trace's own talk channel, and the job hooks that channel to the record", () => {
  assert.match(W, /const designTalk = \(\{ agent, got, start \} = \{\}\) => \{ try \{ if \(typeof tr\.say === "function"\) \{ const f = start \? designStartFacts\(agent\) : designPartFacts\(got\);/);
  assert.match(W, /designSiteGraph\(env, designBrief, models\.design, attached\.blocks, budget, designGraph, firstBuild, designTalk\)/);
  assert.match(W, /designSiteWaves\(env, designBrief, models\.design, attached\.blocks, budget, designWaves, firstBuild, designTalk\)/);
  assert.match(W, /if \(bProgress\) tr\.say = \(stage, facts\) => bProgress\.say\(stage, facts\);/);
  assert.match(W, /say\(stage, facts\) \{[\s\S]{0,200}if \(p\) p\.mark\(stage, facts\); else if \(early\.length < 20\) early\.push\(\[stage, facts\]\);/);
});

// ── ROUND 6: EACH SECTION, BY NAME, AS IT STARTS AND AS IT ENDS ──────────────
import { sectionStartFacts, sectionDoneFacts } from "../builder/site-progress.mjs";

test("R6 the sections are said by the plan's own lines: all of them as they start, each as it finishes", () => {
  const lines = ["Welcome banner with the bakery name", "The menu with prices", "Opening hours"];
  const start = texts(sectionStartFacts(lines));
  assert.match(start, /Now writing the page's 3 sections, all at the same time: 1\) Welcome banner with the bakery name; 2\) The menu with prices; 3\) Opening hours\. None is finished yet\./);
  assert.match(texts(sectionDoneFacts(["The menu with prices"], 2, 3)), /Finished writing the section: The menu with prices \(2 of 3 done\)\. Not published yet\./);
  assert.deepEqual(sectionDoneFacts(["The menu with prices"], 2, 3).map((f) => f.state), ["prepared"]);
  assert.deepEqual(sectionStartFacts([]), []);
  assert.deepEqual(sectionDoneFacts([], 1, 3), []);
  assert.ok(sectionStartFacts(["x".repeat(500)])[0].text.length < 300, "a section's line is not bounded");
});

test("R6 THE POLL HANDS WHICH SECTIONS ENDED, and the build names each once", async () => {
  const { pagesHopApi } = await loadWorkerModule();
  const plan = [{ state: "pending", of: 3, done: 1, doneIdx: [1] }, { state: "pending", of: 3, done: 3, doneIdx: [1, 0, 2, 9] }, { state: "done", answers: [] }];
  let i = 0;
  const box = { fetch: async (req) => {
    const u = new URL(req.url);
    if (u.pathname === "/model/start") return new Response(JSON.stringify({ ok: true, id: "g1" }));
    if (u.pathname === "/model/result") return new Response(JSON.stringify({ ok: true, ...plan[Math.min(i++, plan.length - 1)] }));
    return new Response("{}", { status: 404 });
  } };
  const ticks = [];
  await pagesHopApi.containerPagesFanLocal({ SITE_BUILD_CONTAINER: { local: true, idFromName: (n) => n, get: () => box } }, "s", { onTick: (t) => ticks.push(t) })({}, [{ model: "m" }, { model: "m" }, { model: "m" }], null);
  assert.deepEqual(ticks, [{ sections: 1, of: 3, idx: [1] }, { sections: 3, of: 3, idx: [1, 0, 2] }], "an out-of-range index was handed on, or the order was lost");
  const fn = W.slice(W.indexOf("genPath.onTick = (t) => {"), W.indexOf("genPath.onTick = (t) => {") + 2200);
  assert.match(fn, /const fresh = t\.idx\.filter\(\(i\) => !saidIdx\.has\(i\) && typeof genPath\.bandLines\[i\] === "string"\);/, "a section can be named twice, or by a line that is not the plan's");
  assert.match(fn, /say\("writing-part", sectionDoneFacts\(fresh\.map\(\(i\) => genPath\.bandLines\[i\]\), saidIdx\.size, t\.of\)\)/);
  assert.match(W, /genPath\.bandLines = bandLines\.slice\(\);\s*\n\s*try \{ if \(typeof say === "function"\) say\("writing-start", sectionStartFacts\(bandLines\)\); \}/, "the sections are not said as they start");
  assert.equal((W.match(/say: \(stage, facts\) => \{ try \{ if \(typeof tr\.say === "function"\) tr\.say\(stage, facts\); \}/g) || []).length, 2, "a build path does not hand its talk to buildAndPublishPages");
});

// ── ROUND 7: WHAT IS GOING ON THE PAGE, WHILE IT IS WRITTEN ─────────────────
import { wordsSoFar } from "../builder/gen-code.mjs";
import { writingNowFacts } from "../builder/site-progress.mjs";

test("R7 the words a visitor will read are read off the code as it is written — and never the code itself", () => {
  const src = 'export default function H(){ return <section className="hero"><h1>Bread worth getting up for</h1><p>Overnight sourdough on Call Lane, Leeds.</p><Price label="Country Sourdough £5" /><Link to="/order">Order for collection</Link></section> }';
  const full = JSON.stringify({ pages: [{ path: "index.tsx", source: src }] });
  assert.deepEqual(wordsSoFar(full.slice(0, full.length - 10)), ["Overnight sourdough on Call Lane, Leeds.", "Country Sourdough £5", "Order for collection"]);
  assert.deepEqual(wordsSoFar(full.slice(0, 40)), [], "words were found before any were written");
  for (const w of wordsSoFar(full)) assert.ok(!/[{}<>=;]|className|\.tsx/.test(w), "code was read as words: " + w);
  for (const bad of ["", null, "{"]) assert.deepEqual(wordsSoFar(bad), []);
});

test("R7 a live line quotes the section's newest words, as written, and says it is not finished", () => {
  const f = writingNowFacts([{ section: "The menu with prices", words: ["Country Sourdough £5", "Rye £4.50"] }, { section: "", words: [] }]);
  assert.equal(f.length, 1, "a section with no words yet was said");
  assert.equal(f[0].state, "doing");
  assert.match(f[0].text, /Writing the section "The menu with prices" now; the words going on it so far include "Country Sourdough £5", "Rye £4\.50"\. Not finished\./);
  assert.deepEqual(writingNowFacts([]), []);
});

test("R7 THE POLL HANDS THE LIVE WORDS ON, and the build says them at most every fifteen seconds", async () => {
  const { pagesHopApi } = await loadWorkerModule();
  const plan = [{ state: "pending", of: 2, done: 0, doneIdx: [], live: [{ i: 0, words: ["Bread worth getting up for"] }, { i: 7, words: ["out of range"] }] }, { state: "done", answers: [] }];
  let i = 0;
  const box = { fetch: async (req) => {
    const u = new URL(req.url);
    if (u.pathname === "/model/start") return new Response(JSON.stringify({ ok: true, id: "g1" }));
    if (u.pathname === "/model/result") return new Response(JSON.stringify({ ok: true, ...plan[Math.min(i++, plan.length - 1)] }));
    return new Response("{}", { status: 404 });
  } };
  const ticks = [];
  await pagesHopApi.containerPagesFanLocal({ SITE_BUILD_CONTAINER: { local: true, idFromName: (n) => n, get: () => box } }, "s", { onTick: (t) => ticks.push(t) })({}, [{ model: "m" }, { model: "m" }], null);
  assert.deepEqual(ticks, [{ live: [{ i: 0, words: ["Bread worth getting up for"] }] }], "the live words were not handed on, or an out-of-range one was");
  assert.match(W, /const LIVE_SAY_MS = 15_000;/);
  assert.match(W, /Date\.now\(\) - liveAt >= LIVE_SAY_MS\) \{[\s\S]{0,400}say\("writing-now", writingNowFacts\(now\)\)/, "the live words are not said, or not held to the interval");
  assert.match(SERVER, /onPartial: \(partial\) => liveWords\(i, partial\)/, "a section's writer no longer reads its own words");
  assert.match(SERVER, /const w = wordsSoFar\(partial\); if \(w\.length\) j\.words = w;/, "the single call no longer reads its words");
});

// ── ROUND 8: THE CONTAINER'S BUILD STEPS, WHILE THEY RUN ────────────────────
import { compileStageFacts } from "../builder/site-progress.mjs";

test("R8 each container build step has its own line, and an unknown step says nothing", () => {
  for (const [st, re] of [["routesMs", /pages and their addresses/], ["tscMs", /code for mistakes/], ["viteMs", /Building the site's files/], ["renderMs", /real browser/], ["queued", /Waiting for the builder/]]) {
    const f = compileStageFacts(st);
    assert.equal(f.length, 1, st);
    assert.equal(f[0].state, "doing");
    assert.match(f[0].text, re);
    assert.match(f[0].text, /Not published yet\./);
  }
  for (const quiet of ["unknown", "", null, "preMs"]) assert.deepEqual(compileStageFacts(quiet), [], String(quiet));
});

test("R8 THE WIRING: the container names its step while it builds, and both build paths watch it while they wait", () => {
  assert.match(SERVER, /if \(req\.method === "GET" && req\.url\.startsWith\("\/build\/stage"\)\) \{/, "the container no longer answers which step it is on");
  assert.match(SERVER, /if \(stageId\) BUILD_STAGES\.set\(stageId, \{ stage: key, at: t \}\);/, "a step is no longer named as it starts");
  assert.match(SERVER, /while \(BUILD_STAGES\.size >= 64\) BUILD_STAGES\.delete/, "the steps map is no longer bounded");
  assert.match(W, /function watchBuildStage\(c, stageId, onStage\) \{/);
  assert.match(W, /const bPayload = JSON\.stringify\(\{ stageId: bStageId,/, "the build's compile is not named");
  assert.match(W, /watchBuildStage\(c, bStageId, \(st\) => \{ const f = compileStageFacts\(st\); if \(f\.length\) say\("compile-stage", f\); \}\)/);
  assert.match(W, /onWait: \(w\) => console\.log\("build: waiting for room", slug, JSON\.stringify\(w\)\) \}\)\.finally\(bStop\);/, "the build's watcher is not stopped when the compile ends");
  assert.match(W, /watchBuildStage\(c, cStageId, \(st\) => \{ const f = compileStageFacts\(st\); if \(f\.length\) job\.progress\.mark\("compile-stage", f\); \}\)/);
  assert.match(W, /onWait: \(w\) => tm\("container", "wait", w\) \}\)\.finally\(cStop\);/, "the edit's watcher is not stopped when the compile ends");
});
