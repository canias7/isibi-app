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
  // RE-ANCHORED 2026-10-22 (combine): the visual review (#10) sits between them.
  assert.match(W, /repair: quickSend\(env\),[\s\S]{0,1200}?\n\s*note: \(stage, nums\) => \{ try \{ mark\?\.\(stage, nums\); \}/, "the publish's steps no longer reach the build's trace");
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
  assert.match(W, /say\(stage, facts\) \{[\s\S]{0,200}if \(p\) mark\(stage, facts\); else if \(early\.length < 20\) early\.push\(\[stage, facts\]\);/);
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

// ── ROUND 9: THE TALK, PUSHED AND STREAMED ───────────────────────────────────
test("R9 THE WIRING: the writer streams its sentence to a live key, the Worker pushes lines and that sentence on one connection, and the page draws both", () => {
  assert.match(W, /const live = rec\.talk === true \? liveLineWriter\(env, job, rec\.lines\.length \+ 1\) : null;/, "the writer no longer streams its sentence");
  assert.match(W, /send: live \? quickSendLive\(env, "progress", progressBudget, live\) : quickSend\(env, "progress", progressBudget\)/);
  assert.match(W, /if \(rec\.talk === true\) await clearLiveLine\(env, job\);/, "the sentence so far is not cleared after the line");
  assert.match(W, /const \{ code \} = readCodeSoFar\(partial, \{ codeField: "text" \}\);/, "the sentence is not read off the answer so far");
  assert.match(W, /const talkLive = url\.pathname\.match\(\/\^\\\/api\\\/site\\\/build\\\/\(\[0-9a-f\]\{32\}\)\\\/stream\$\/\);/, "the live stream route is gone");
  const route = W.slice(W.indexOf("const talkLive = url.pathname.match"), W.indexOf("const talkLive = url.pathname.match") + 9000);
  assert.match(route, /const su = await authUser\(request, env\);\s*\n\s*if \(!su\) return Response\.json\(\{ error: "sign in first" \}, \{ status: 401 \}\);/, "the stream is not behind sign-in");
  assert.match(route, /if \(at0\.rec && at0\.rec\.uid !== su\.id\) return Response\.json\(\{ error: "not found" \}, \{ status: 404 \}\);/, "another account's build can be streamed");
  assert.match(route, /live\.n === lines\.length \+ 1 \? live\.text : ""/, "a stale sentence can be shown after its line was committed");
  assert.match(route, /"content-type": "text\/event-stream"/);
  assert.match(CHATJS, /if \(typeof ReadableStream !== 'undefined'\) followBuildTalk\(job, signal, origin\)\.catch\(\(\) => \{\}\);/, "the page does not open the live stream beside its poll");
  assert.match(CHATJS, /if \(typeof siteBuild\.talkLive === 'string' && siteBuild\.talkLive\) list = list\.concat\(\[\{ text: siteBuild\.talkLive, writing: true \}\]\);/, "the sentence being written is not drawn, or the poll wipes it");
});

// ── ROUND 10: AT MOST THREE LIVE CONNECTIONS PER ACCOUNT ─────────────────────
/** A bucket that keeps etags and honours onlyIf, as R2 does. */
function leaseBucket() {
  const m = new Map(); let n = 0; let fail = false;
  return {
    m, setFail: (v) => { fail = v; },
    async get(k) { if (fail) throw new Error("down"); const v = m.get(k); return v ? { etag: v.etag, text: async () => v.body } : null; },
    async put(k, body, o = {}) {
      if (fail) throw new Error("down");
      const cur = m.get(k);
      if (o.onlyIf && o.onlyIf.etagMatches && (!cur || cur.etag !== o.onlyIf.etagMatches)) return null;
      if (o.onlyIf && o.onlyIf.etagDoesNotMatch === "*" && cur) return null;
      const etag = "e" + (++n); m.set(k, { body, etag }); return { etag };
    },
  };
}

test("R10 an account holds at most three live connections; closing one frees a slot; a lease left behind runs out; another account is unaffected; a store that fails never blocks", async () => {
  const { streamLeaseApi } = await loadWorkerModule();
  const { takeStreamLease, TALK_STREAMS_PER_ACCOUNT } = streamLeaseApi;
  assert.equal(TALK_STREAMS_PER_ACCOUNT, 3);
  const b = leaseBucket();
  const env = { SITES_BUCKET: b };
  const held = [];
  for (let i = 0; i < 3; i++) { const l = await takeStreamLease(env, "u1"); assert.equal(l.ok, true, "slot " + (i + 1) + " refused"); held.push(l); }
  assert.equal((await takeStreamLease(env, "u1")).ok, false, "a fourth connection was let in");
  assert.equal((await takeStreamLease(env, "u2")).ok, true, "another account was limited by this one");
  await held[0].release();
  assert.equal((await takeStreamLease(env, "u1")).ok, true, "a closed connection did not free its slot");
  // A LEASE NOBODY GAVE BACK RUNS OUT: an hour later every slot is free.
  const later = Date.now() + 3600_000;
  for (let i = 0; i < 3; i++) assert.equal((await takeStreamLease(env, "u1", later)).ok, true, "an expired lease still held a slot");
  // TWO OPENING AT ONCE FOR THE LAST SLOT: only one gets it.
  const b2 = leaseBucket(); const env2 = { SITES_BUCKET: b2 };
  await takeStreamLease(env2, "u3"); await takeStreamLease(env2, "u3");
  const race = await Promise.all([takeStreamLease(env2, "u3"), takeStreamLease(env2, "u3")]);
  assert.equal(race.filter((r) => r.ok).length, 1, "two connections both took the last slot");
  // THE STORE DOWN: the stream opens (the poll carries the talk either way).
  b.setFail(true);
  assert.equal((await takeStreamLease(env, "u9")).ok, true, "a failing store blocked a connection");
});

test("R10 THE WIRING: the stream takes a lease before it opens, answers 429 over the limit, gives the lease back when it ends, and the page stops asking on 429", () => {
  const route = W.slice(W.indexOf("const talkLive = url.pathname.match"), W.indexOf("const talkLive = url.pathname.match") + 3600);
  assert.match(route, /const lease = await takeStreamLease\(env, su\.id\);\s*\n\s*if \(!lease\.ok\) return Response\.json\(\{ error: "too many live connections[^"]*" \}, \{ status: 429 \}\);/);
  assert.ok(route.indexOf("takeStreamLease") < route.indexOf("new TransformStream()"), "the stream opens before its lease is taken");
  assert.match(route, /try \{ await w\.close\(\); \} catch \{ \/\* already gone \*\/ \}\s*\n\s*await lease\.release\(\);/, "the lease is not given back when the stream ends");
  assert.match(CHATJS, /if \(r && \(r\.status === 401 \|\| r\.status === 404 \|\| r\.status === 429\)\) return;/, "the page keeps hammering a full account");
});

// ── ROUND 11: ONE ROOM PER JOB PUSHES THE TALK (DURABLE OBJECTS) ─────────────
function fakeRoomCtx() {
  const store = new Map(); const sockets = []; let alarm = null;
  return {
    store, sockets, alarmAt: () => alarm,
    storage: {
      get: async (k) => (store.has(k) ? structuredClone(store.get(k)) : undefined),
      put: async (k, v) => { store.set(k, structuredClone(v)); },
      setAlarm: async (t) => { alarm = t; },
      delete: async (k) => store.delete(k),
      deleteAll: async () => { store.clear(); },
    },
    getWebSockets: () => sockets,
    acceptWebSocket: (ws) => sockets.push(ws),
  };
}
const fakeSocket = () => { const sent = []; return { sent, closed: false, send: (m) => sent.push(JSON.parse(m)), close() { this.closed = true; } }; };
const say = (room, body) => room.fetch(new Request("https://room/say", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

test("R11 the room pushes every telling to every watcher at once, keeps lines from going backwards, drops a stale line-in-progress, and empties itself after the job closes", async () => {
  const { talkRoomApi } = await loadWorkerModule();
  const { TalkRoom, ROOM_KEEP_MS } = talkRoomApi;
  const ctx = fakeRoomCtx(); const room = new TalkRoom(ctx, {});
  const a = fakeSocket(), b = fakeSocket(); ctx.sockets.push(a, b);
  const L1 = { n: 1, ms: 0, text: "Choosing warm colours." };
  const L2 = { n: 2, ms: 900, text: "Writing the menu page." };
  assert.equal((await say(room, { lines: [L1] })).status, 200);
  assert.deepEqual(a.sent.at(-1), { lines: [L1], live: "", closed: false });
  assert.deepEqual(b.sent.at(-1), a.sent.at(-1), "a second watcher was not told");
  await say(room, { live: { n: 2, text: "Writing the me" } });
  assert.equal(a.sent.at(-1).live, "Writing the me", "the line being written was not pushed");
  await say(room, { lines: [L1, L2] });
  assert.equal(a.sent.at(-1).live, "", "a line-in-progress outlived its own line");
  await say(room, { lines: [L1] });
  assert.equal(a.sent.at(-1).lines.length, 2, "a late, older telling took a line back");
  assert.equal(ctx.alarmAt(), null);
  await say(room, { closed: true });
  assert.equal(a.sent.at(-1).closed, true);
  assert.ok(ctx.alarmAt() >= Date.now() + ROOM_KEEP_MS - 5000, "a closed room is never emptied");
  await say(room, { closed: false });
  assert.equal(a.sent.at(-1).closed, true, "a closed job reopened");
  await room.alarm();
  assert.ok(ctx.store.size > 0 && !a.closed, "the room was emptied before its keeping time");
  ctx.store.set("cleanAt", Date.now() - 1);
  await room.alarm();
  assert.equal(ctx.store.size, 0); assert.ok(a.closed && b.closed, "the alarm left watchers connected to an empty room");
});

test("R11 the room takes only what the Worker sends: lines as linesOf gives them, a numbered line-in-progress, a boolean closed", async () => {
  const { talkRoomApi } = await loadWorkerModule();
  const { readRoomSay, TalkRoom } = talkRoomApi;
  for (const bad of [null, "x", {}, { lines: "a" }, { lines: ["text"] }, { lines: [{ text: 1, n: 1 }] }, { live: { text: "a" } }, { live: { n: 0, text: "a" } }, { closed: "yes" }, { lines: Array.from({ length: 401 }, (_, i) => ({ n: i + 1, text: "a" })) }]) {
    assert.equal(readRoomSay(bad), null, "accepted " + JSON.stringify(bad).slice(0, 60));
  }
  assert.deepEqual(readRoomSay({ lines: [{ n: 1, ms: 5, text: "a", explain: "b", late: true, extra: 1 }] }), { lines: [{ n: 1, ms: 5, text: "a", explain: "b", late: true }] });
  assert.deepEqual(readRoomSay({ live: null }), { live: null });
  const ctx = fakeRoomCtx(); const room = new TalkRoom(ctx, {});
  assert.equal((await say(room, { lines: ["text"] })).status, 400);
  assert.equal(ctx.store.size, 0, "a refused telling was stored");
});

test("R11 tellRoom never throws and never waits: no binding is nothing, a failing room is swallowed", async () => {
  const { talkRoomApi } = await loadWorkerModule();
  const { tellRoom, openRoomWatch } = talkRoomApi;
  assert.equal(tellRoom({}, "j", { closed: true }), undefined);
  assert.equal(tellRoom(null, "j", { closed: true }), undefined);
  const told = [];
  const env = { TALK_ROOM: { idFromName: (n) => "id:" + n, get: (id) => ({ fetch: async (u, o) => { told.push([id, u, JSON.parse(o.body)]); return new Response("ok"); } }) } };
  await tellRoom(env, "job1", { closed: true });
  assert.deepEqual(told, [["id:job1", "https://room/say", { closed: true }]]);
  const broken = { TALK_ROOM: { idFromName: () => { throw new Error("x"); } } };
  assert.equal(tellRoom(broken, "j", {}), undefined);
  const rejecting = { TALK_ROOM: { idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error("down"); } }) } };
  await tellRoom(rejecting, "j", {});
  assert.equal(await openRoomWatch({}, "j"), null);
  assert.equal(await openRoomWatch(rejecting, "j"), null, "an unreachable room did not fall back");
});

test("R11 THE WIRING: every record write and every line-in-progress tells the room; the stream reads the room first, sends the record's lines at once, and falls back to storage; the room is declared with its own migration", () => {
  assert.match(W, /const etag = await putProgressRecord\(env, job, out\.rec, at\.etag\);\s*\n\s*if \(etag\) \{\s*\n\s*try \{ tellRoom\(env, job, \{ lines: linesOf\(out\.rec\), closed: !!out\.rec\.closed \}\);/);
  assert.match(W, /tellRoom\(env, job, \{ live: \{ n, text: text\.slice\(0, 600\) \} \}\);/);
  assert.match(W, /const clearLiveLine = \(env, job\) => \{ tellRoom\(env, job, \{ live: null \}\);/);
  const route = W.slice(W.indexOf("const talkLive = url.pathname.match"), W.indexOf("const talkLive = url.pathname.match") + 6000);
  const iRoom = route.indexOf("const fromRoom = await streamFromRoom(env, ctx, talkLive[1], at0.rec && !forReply ? { lines: linesOf(at0.rec)");
  const iLoop = route.indexOf("const at = await progressRecordAt(env, talkLive[1]);");
  assert.ok(iRoom > 0 && iLoop > iRoom, "the stream no longer tries the room before reading storage");
  assert.ok(route.indexOf("takeStreamLease") < iRoom, "the room is opened before the account's limit is checked");
  const fn = W.slice(W.indexOf("async function streamFromRoom("), W.indexOf("const actionRoom = "));
  assert.match(fn, /const room = await openRoomWatch\(env, name\);\s*\n\s*if \(!room\) return null;/, "a room that cannot be reached does not fall back");
  assert.match(fn, /if \(first\) await w\.write\(enc\.encode\("data: " \+ JSON\.stringify\(first\)/, "what is already written is not sent first");
  assert.match(fn, /await lease\.release\(\);/, "the room's stream never gives its lease back");
  const WR = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(WR, /\{ "class_name": "TalkRoom", "name": "TALK_ROOM" \}/);
  assert.match(WR, /\{ "tag": "v7", "new_sqlite_classes": \["TalkRoom"\] \}/);
  assert.match(W, /^export class TalkRoom \{/m);
});

test("R12 THE ROOM RUNS THE LINE WRITER: a write asked of it sets its alarm for the soonest one, the alarm runs it once, and every queue ask also asks the room", async () => {
  const { talkRoomApi } = await loadWorkerModule();
  const { TalkRoom, roomWriter } = talkRoomApi;
  const ctx = fakeRoomCtx(); const room = new TalkRoom(ctx, {});
  const job = "a".repeat(32);
  const ask = (delayMs) => room.fetch(new Request("https://room/write", { method: "POST", body: JSON.stringify({ id: job, uid: "u1", delayMs }) }));
  assert.equal((await room.fetch(new Request("https://room/write", { method: "POST", body: JSON.stringify({ id: "x", uid: "u1" }) }))).status, 400, "a bad job id was taken");
  const t0 = Date.now();
  await ask(3000);
  assert.ok(ctx.alarmAt() >= t0 + 2900 && ctx.alarmAt() <= Date.now() + 3100, "the writer's alarm is not set for its settle");
  await ask(20000);
  assert.ok(ctx.alarmAt() <= Date.now() + 3100, "a later ask pushed back a writer already due sooner");
  ctx.store.set("write", { id: job, uid: "u1", at: Date.now() - 1 });
  await room.alarm();
  assert.equal(ctx.store.has("write"), false, "the alarm did not take the writer it ran");
  const told = [];
  const env = { TALK_ROOM: { idFromName: (n) => n, get: (id) => ({ fetch: async (u, o) => { told.push([id, u, JSON.parse(o.body)]); return new Response("ok"); } }) } };
  await roomWriter(env, { id: job, uid: "u1" }, 3);
  assert.deepEqual(told, [[job, "https://room/write", { id: job, uid: "u1", delayMs: 3000 }]]);
  assert.equal(roomWriter({}, { id: job, uid: "u1" }), undefined);
  assert.match(W, /async function sendProgressTask\(env, task, delayS = 0\) \{[\s\S]{0,400}?\n\s*await roomWriter\(env, task, delayS\);/, "a queue ask no longer asks the room too");
  assert.match(W, /try \{ await runProgressTask\(this\.env, \{ id: w\.id, uid: w\.uid \}, "room"\); \}/, "the room's alarm does not run the writer");
});

// ── ROUND 13: EVERYTHING THAT TALKS USES THE ROOM ────────────────────────────
test("R13 the room carries the final reply as it is written: text so far, then done, and a done reply is never reopened by a late partial", async () => {
  const { talkRoomApi } = await loadWorkerModule();
  const { readRoomSay, mergeRoomSay, roomMessage } = talkRoomApi;
  assert.deepEqual(readRoomSay({ reply: { text: "Your menu" } }), { reply: { text: "Your menu", done: false } });
  assert.deepEqual(readRoomSay({ reply: { text: "Done.", done: true } }), { reply: { text: "Done.", done: true } });
  for (const bad of [{ reply: "x" }, { reply: { text: 1 } }, { reply: { text: "a", done: "yes" } }, { reply: null }]) assert.equal(readRoomSay(bad), null, JSON.stringify(bad));
  let st = { lines: [], live: null, closed: true };
  st = mergeRoomSay(st, { reply: { text: "Your menu", done: false } });
  assert.deepEqual(roomMessage(st), { lines: [], live: "", closed: true, reply: "Your menu", replyDone: false });
  st = mergeRoomSay(st, { reply: { text: "Your menu now has Gallery out.", done: true } });
  st = mergeRoomSay(st, { reply: { text: "Your menu now", done: false } });
  assert.equal(roomMessage(st).reply, "Your menu now has Gallery out.", "a late partial reopened a finished reply");
  assert.equal(roomMessage(st).replyDone, true);
  assert.equal(Object.hasOwn(roomMessage({ lines: [], live: null, closed: false }), "reply"), false, "a job with no reply grew one");
});

test("R13 THE WIRING: the reply streams into its job's room and is marked done; a press's talk tells its own room and streams its sentence; the press's stream is its presser's only", () => {
  assert.match(W, /onPartial: replyLiveWriter\(env, task\.id\) \}\);\s*\n\s*tellRoom\(env, task\.id, \{ reply: \{ text: typed && typed\.ok/, "the final reply is not typed into the job's room");
  assert.match(W, /send: typeof onPartial === "function" \? quickSendLive\(env, "reply", budget, onPartial\) : quickSend\(env, "reply", budget\)/);
  assert.match(W, /const \{ code \} = readCodeSoFar\(partial, \{ codeField: "reply" \}\);/, "the reply is not read off the tool's own field");
  const act = W.slice(W.indexOf("function actionTalk(env, ctx"), W.indexOf("const PROGRESS_CLOSE_MS"));
  assert.match(act, /tellRoom\(env, actionRoom\(id\), \{ lines: rec\.lines\.map/, "a press's store does not tell its room");
  assert.match(act, /quickSendLive\(env, "progress", progressBudget, live\)/, "a press's sentence is not streamed");
  assert.match(W, /const actionRoom = \(id\) => "act:" \+ id;/, "a press's room shares the jobs' name space");
  const route = W.slice(W.indexOf("const ts = url.pathname.match"), W.indexOf("const ts = url.pathname.match") + 2000);
  assert.match(route, /^const ts = url\.pathname\.match\(\/\^\\\/api\\\/site\\\/talk\\\/\(\[0-9a-f\]\{32\}\)\\\/stream\$\/\);/);
  assert.match(route, /actionTalkKey\(su\.id, ts\[1\]\)/, "the press's stream is not its own presser's");
  assert.match(route, /if \(!rec\) return Response\.json\(\{ error: "not found" \}, \{ status: 404 \}\);/);
  assert.ok(route.indexOf("takeStreamLease") > 0 && route.indexOf("takeStreamLease") < route.indexOf("streamFromRoom"), "the press's stream skips the account's limit");
  assert.match(W, /if \(forReply \? m\.replyDone === true : m\.closed === true && !m\.live\)/, "a reply's follower closes when the job closes, before the reply");
});

test("R13 THE PAGE: a press's id is 32 hex (the dashes were refused), edits and add-ons follow the live connection, and a held reply is typed as it streams", () => {
  assert.match(CHATJS, /const id = crypto\.randomUUID\(\)\.replace\(\/-\/g, ''\);/, "a press's id carries dashes again, which the server refuses");
  assert.match(CHATJS, /readTalkStream\('\/api\/site\/talk\/' \+ encodeURIComponent\(id\) \+ '\/stream'/, "a press does not follow its live connection");
  assert.match(CHATJS, /try \{ followEditTalk\(w\.job, origin, \(\) => !editWatched\.has\(w\.job\)\); \}/, "an edit's watch does not follow its live connection");
  assert.match(CHATJS, /readTalkStream\('\/api\/site\/build\/' \+ encodeURIComponent\(job\) \+ '\/stream\?reply=1'/, "a held reply is not followed live");
  assert.match(CHATJS, /if \(r && \(r\.status === 401 \|\| r\.status === 404 \|\| r\.status === 429\)\) return;/);
  assert.match(CHATJS, /return readTalkStream\('\/api\/site\/build\/' \+ encodeURIComponent\(job\) \+ '\/stream', signal/, "the build no longer reads through the shared reader");
});

// ── ROUND 14: THE TALK'S DIAGNOSTIC LOG ──────────────────────────────────────
test("R14 every step where a line can be lost writes a diagnostic event, and only the job's owner can read them", () => {
  const fn = W.slice(W.indexOf("async function writeProgressLine("), W.indexOf("\n}\n", W.indexOf("async function writeProgressLine(")));
  for (const ev of ["claim-none", "claimed", "verdict-before", "no-facts", "call", "verdict-after", "committed", "verdict-post", "unconfirmed"]) {
    assert.ok(fn.includes('diag(env, job, ' + (ev === "committed" ? 'done ? "committed"' : '"' + ev + '"')), "the writer does not log " + ev);
  }
  const door = W.slice(W.indexOf("async function progressFromJob("), W.indexOf("\n}\n", W.indexOf("async function progressFromJob(")));
  for (const ev of ['r ? "begun" : "begin-refused"', '"mark-refused"', 'r ? "marked" : "mark-not-written"', '"close"']) assert.ok(door.includes(ev), "the record's door does not log " + ev);
  assert.match(W, /diag\(env, task\.id, "writer-start", \{ from \}\);/);
  assert.match(W, /runProgressTask\(this\.env, \{ id: w\.id, uid: w\.uid \}, "room"\)/, "a room's writer is not told apart from the queue's");
  const route = W.slice(W.indexOf("const dg = url.pathname.match"), W.indexOf("const dg = url.pathname.match") + 1500);
  assert.match(route, /if \(!du\) return Response\.json\(\{ error: "sign in first" \}, \{ status: 401 \}\);/);
  assert.match(route, /if \(!at\.rec \|\| at\.rec\.uid !== du\.id\) return Response\.json\(\{ error: "not found" \}, \{ status: 404 \}\);/, "another account's diagnostics can be read");
});

test("R14 a diagnostic event is one object under the job's own prefix, and a bad job or a failing store writes nothing and throws nothing", async () => {
  const src = W.slice(W.indexOf("const progressDiagKey ="), W.indexOf("async function writeProgressLine("));
  const put = [];
  // eslint-disable-next-line no-new-func
  const make = new Function("isJobId", src + "\nreturn { diag, progressDiagKey };");
  const { diag, progressDiagKey } = make((x) => typeof x === "string" && /^[0-9a-f]{32}$/.test(x));
  const env = { SITES_BUCKET: { put: async (k, v) => { put.push([k, JSON.parse(v)]); } } };
  const job = "b".repeat(32);
  await diag(env, job, "call", { ok: false, why: "timeout", ms: 45000 });
  assert.equal(put.length, 1);
  assert.ok(put[0][0].startsWith(progressDiagKey(job)), "the event is not under the job's prefix");
  assert.equal(put[0][1].ev, "call"); assert.equal(put[0][1].why, "timeout"); assert.ok(put[0][1].at > 0);
  assert.equal(diag(env, "nope", "x"), undefined); assert.equal(put.length, 1);
  await diag({ SITES_BUCKET: { put: async () => { throw new Error("down"); } } }, job, "x");
  assert.equal(diag(null, job, "x"), undefined);
});

// ── ROUND 15: THE ASK FROM THE CONTAINER'S GATEWAY REACHES THE ROOM ──────────
test("R15 a writer asked from the gateway's request is asked of the room before the request ends (awaited), and the door's diagnostics are awaited too", () => {
  assert.match(W, /async function sendProgressTask\(env, task, delayS = 0\) \{[\s\S]{0,400}?\n\s*await roomWriter\(env, task, delayS\);/, "the room is asked without waiting, and dies with the gateway's request");
  const door = W.slice(W.indexOf("async function progressFromJob("), W.indexOf("\n}\n", W.indexOf("async function progressFromJob(")));
  for (const ev of ['await diag(env, id, r ? "begun"', 'await diag(env, id, r ? "marked"', 'await diag(env, id, "close"']) assert.ok(door.includes(ev), ev + " is not awaited");
});

// ── ROUND 16: A FIRST BUILD'S CONTAINER REPORTS THROUGH THE WORKER ──────────
test("R16 a pre-scoped (first) build's container env carries JOB_PROGRESS, so its milestones go through the Worker's door (which asks for a writer), not straight into the record", async () => {
  const { makeContainerEnv } = await import("../builder/container-env.mjs");
  const calls = [];
  const f = async (u, o) => { calls.push([String(u), JSON.parse(o.body)]); return new Response("{}", { status: 200 }); };
  for (const pre of [true, false]) {
    calls.length = 0;
    const env = makeContainerEnv({ gateway: { url: "https://gofarther.dev/api/job/" + "c".repeat(32), token: "t" }, fetch: f, pre });
    assert.equal(typeof env.JOB_PROGRESS, "function", (pre ? "a first build" : "an edit") + " has no progress door");
    const out = await env.JOB_PROGRESS({ op: "mark", stage: "x" });
    assert.deepEqual(out, { ok: true, retry: false });
    assert.equal(calls[0][0], "https://gofarther.dev/api/job/" + "c".repeat(32) + "/progress");
  }
});

// ── ROUND 17: THE TALK THINKS LESS (LOW REASONING EFFORT ON GROK) ────────────
test("R17 a progress line and a reply ask Grok for low effort; a Claude call and every other call are sent unchanged; xAI's request carries it as reasoning_effort", async () => {
  const { talkEffortApi } = await loadWorkerModule();
  const { withTalkEffort, TALK_EFFORT } = talkEffortApi;
  const { toXaiRequest, XAI_EFFORTS } = await import("../builder/model-xai.mjs");
  assert.equal(TALK_EFFORT, "low");
  assert.deepEqual([...XAI_EFFORTS], ["low", "medium", "high", "xhigh"]);
  const grok = { model: "grok-4.6", max_tokens: 100, messages: [{ role: "user", content: "x" }] };
  // WITH NO CUSTOMER EFFORT KNOWN (R20 covers the customer's own winning).
  for (const what of ["progress", "reply"]) assert.equal(withTalkEffort(what, grok).effort, "low", what + " is not low");
  for (const what of ["", "route", "design", "lane"]) assert.equal(withTalkEffort(what, grok), grok, what + " was changed");
  const claude = { model: "claude-sonnet-5", max_tokens: 100, messages: [] };
  assert.equal(withTalkEffort("progress", claude), claude, "a Claude call gained a field Anthropic refuses");
  assert.equal(toXaiRequest(withTalkEffort("progress", grok)).body.reasoning_effort, "low");
  assert.equal(Object.hasOwn(toXaiRequest(grok).body, "reasoning_effort"), false, "a call that named no effort sent one");
  assert.equal(Object.hasOwn(toXaiRequest({ ...grok, effort: "turbo" }).body, "reasoning_effort"), false, "an unknown effort was sent");
  assert.match(W, /const quickSendLive = \(env, what, budget, onPartial\) => \(req\) => callBuilderModel\(env, withTalkEffort\(what, req, env\),/);
  assert.match(W, /const quickSend = \(env, what = "", budget = null\) => \(req\) => callBuilderModel\(env, withTalkEffort\(what, req, env\),/);
});

// ── ROUND 18: THE QUIET STRETCHES ARE SAID AS STILL GOING ────────────────────
test("R18 stillFacts restates the build's own last 'doing' step with how long it has taken, and claims nothing new", async () => {
  const { stillFacts } = await import("../builder/site-progress.mjs");
  assert.deepEqual(stillFacts("", 50_000), []);
  assert.deepEqual(stillFacts("Designing the layout.", 0), []);
  assert.deepEqual(stillFacts(null, 50_000), []);
  const [f] = stillFacts("Designing the layout of each page from top to bottom.", 50_000);
  assert.equal(f.state, "doing");
  assert.match(f.text, /^Still on the same step, 50 seconds so far: Designing the layout of each page from top to bottom\. Nothing new is finished yet\.$/);
  assert.match(stillFacts("Checking the pages", 150_000)[0].text, /about 3 minutes so far/);
});

test("R18 THE WIRING: every build mark goes through one door that remembers the last 'doing' step; a timer says it again after 40 s of quiet, and stops at close", () => {
  const fn = W.slice(W.indexOf("function buildProgressFor("), W.indexOf("\n}\n", W.indexOf("function buildProgressFor(")));
  assert.equal((fn.match(/\bp\.mark\(/g) || []).length, 1, "a mark bypasses the door that keeps the quiet-stretch clock");
  assert.match(fn, /if \(!p \|\| Date\.now\(\) - lastAt < STILL_AFTER_MS\) return;/);
  assert.match(fn, /const said = stillFacts\(lastDoing, Date\.now\(\) - stepAt\);\s*\n\s*if \(said\.length\) mark\("still", said\);/);
  assert.match(fn, /close\(why\) \{ if \(stillTimer\) \{ clearInterval\(stillTimer\); stillTimer = null; \}/, "the timer outlives the build");
  assert.equal((fn.match(/watchStill\(\);/g) || []).length, 2, "the timer is not started where the record opens");
  assert.match(W, /const STILL_AFTER_MS = 40_000;/);
});

// ── ROUND 19: THE CUSTOMER'S EFFORT ──────────────────────────────────────────
test("R19 a site request's effort rides its env; a Grok call takes it unless it names its own (the talk keeps low); a Claude call and an unknown level change nothing", async () => {
  const { customerEffortApi, talkEffortApi } = await loadWorkerModule();
  const { withCustomerEffort, withBuildEffort } = customerEffortApi;
  const env = { X: 1 };
  const post = (path, body, type = "application/json") => new Request("https://gofarther.dev" + path, { method: "POST", headers: { "content-type": type }, body: JSON.stringify(body) });
  const e1 = await withBuildEffort(post("/api/site/react-build", { brief: "x", effort: "low" }), env);
  assert.equal(e1.BUILD_EFFORT, "low"); assert.equal(e1.X, 1); assert.equal(env.BUILD_EFFORT, undefined, "the shared env was written");
  assert.equal(await withBuildEffort(post("/api/site/react-build", { effort: "turbo" }), env), env, "an unknown level was taken");
  assert.equal(await withBuildEffort(post("/api/site/react-build", { effort: ["low"] }), env), env, "a non-string was coerced");
  assert.equal(await withBuildEffort(post("/api/credits", { effort: "low" }), env), env, "a request outside the site API was read");
  const req = post("/api/site/edit", { effort: "xhigh" });
  const e2 = await withBuildEffort(req, env);
  assert.equal(e2.BUILD_EFFORT, "xhigh");
  assert.equal((await req.json()).effort, "xhigh", "the route could not read its own body after the peek");
  const grok = { model: "grok-4.6", messages: [] };
  assert.equal(withCustomerEffort(e1, grok).effort, "low");
  assert.equal(withCustomerEffort(e2, talkEffortApi.withTalkEffort("progress", grok)).effort, "low", "the customer's effort overrode the talk's low");
  assert.equal(withCustomerEffort(e1, { model: "claude-sonnet-5" }).effort, undefined, "a Claude call gained a field Anthropic refuses");
  assert.equal(withCustomerEffort(env, grok), grok, "a request with no effort changed the call");
});

test("R19 A REPLAYED BUILD CARRIES ITS EFFORT TOO: runSiteBuild reads it off the stored request, since a queued or container build never passes handleRequest", () => {
  assert.match(W, /async function runSiteBuild\(request, env, \{[^}]*\}\) \{\n(?:\s*\/\/[^\n]*\n)*\s*env = await withBuildEffort\(request, env\);/, "a replayed build ignores its effort");
  assert.match(W, /const res = await runSiteBuild\(replayRequest\(job\), env,/, "the container build no longer replays through runSiteBuild");
});

test("R19 EFFORT TO EVERYTHING: page writing's calls to the container's model service carry the customer's effort, one request or a list", async () => {
  const { customerEffortApi } = await loadWorkerModule();
  const { withEffortAll } = customerEffortApi;
  const env = { BUILD_EFFORT: "low" };
  const g = { model: "grok-4.6" };
  assert.equal(withEffortAll(env, g).effort, "low");
  assert.deepEqual(withEffortAll(env, [g, g, { model: "claude-sonnet-5" }]).map((r) => r.effort), ["low", "low", undefined], "a band in the list lost the effort, or a Claude call gained one");
  assert.equal(withEffortAll({}, g), g, "a build with no effort changed its calls");
  for (const body of ["body: JSON.stringify({ req: withEffortAll(env, req), callMs }),", "{ reqs: withEffortAll(env, req) } : { req: withEffortAll(env, req) }", "one ? { req: withEffortAll(env, req), callMs } : { reqs: withEffortAll(env, req), callMs }"]) {
    assert.ok(W.includes(body), "a door to the container's model service sends its requests without the effort: " + body);
  }
  assert.ok(!/JSON\.stringify\(\{ req, callMs \}\)|reqs: req, callMs|\{ reqs: req \} : \{ req \}/.test(W), "a door to the container's model service still sends the bare request");
});

// ── ROUND 20: EVERYTHING FOLLOWS THE EFFORT, THE TALK INCLUDED ───────────────
test("R20 the talk and the reply follow the customer's effort when there is one, and are low only when none is known", async () => {
  const { talkEffortApi } = await loadWorkerModule();
  const { withTalkEffort, withJobEffort, withKeptEffort } = talkEffortApi;
  const grok = { model: "grok-4.6" };
  assert.equal(withTalkEffort("progress", grok, { BUILD_EFFORT: "high" }), grok, "the talk overrode the customer's High");
  assert.equal(withTalkEffort("reply", grok, { BUILD_EFFORT: "xhigh" }), grok, "the reply overrode the customer's effort");
  assert.equal(withTalkEffort("progress", grok, {}).effort, "low", "with no effort known the talk is not low");
  assert.equal(withJobEffort({ X: 1 }, JSON.stringify({ effort: "high", brief: "x" })).BUILD_EFFORT, "high");
  assert.equal(withJobEffort({ X: 1 }, "{not json").BUILD_EFFORT, undefined);
  assert.equal(withJobEffort({ X: 1 }, JSON.stringify({ effort: "turbo" })).BUILD_EFFORT, undefined, "an unknown level was taken");
  const job = "d".repeat(32);
  const store = new Map([["progress-effort/" + job, "medium"]]);
  const env = { SITES_BUCKET: { get: async (k) => (store.has(k) ? { text: async () => store.get(k) } : null) } };
  assert.equal((await withKeptEffort(env, job)).BUILD_EFFORT, "medium", "the writer does not use the kept effort");
  assert.equal((await withKeptEffort(env, "e".repeat(32))).BUILD_EFFORT, undefined);
  assert.equal((await withKeptEffort({ SITES_BUCKET: { get: async () => { throw new Error("down"); } } }, job)).BUILD_EFFORT, undefined, "a store that fails broke the writer");
});

test("R20 THE WIRING: the job's effort rides its record's opening, is kept beside it, and the writer, the reply and the presses use it", () => {
  assert.match(W, /\.\.\.\(env && XAI_EFFORTS\.includes\(env\.BUILD_EFFORT\) \? \{ effort: env\.BUILD_EFFORT \} : \{\}\),\n\s*\/\/ THE JOB'S PLACE IN ITS REQUEST/, "the record's opening does not carry the effort");
  assert.match(W, /if \(r && XAI_EFFORTS\.includes\(b\.effort\)\) \{ try \{ await env\.SITES_BUCKET\.put\(progressEffortKey\(id\), b\.effort\); \}/, "the door does not keep the effort");
  assert.match(W, /async function writeProgressLine\(env0, task, owner\) \{\n\s*const job = task\.id;\n\s*const env = await withKeptEffort\(env0, job\);/, "the writer does not read the kept effort");
  assert.match(W, /env = withJobEffort\(env, job\.body\);\n\s*\/\/ THE BUILD'S LIVE LINES/, "a queued build's record does not know its effort");
  assert.match(W, /progress = makeProgress\(withJobEffort\(env, job\.body\), ctx,/, "a queued edit's record does not know its effort");
  assert.match(W, /const env = env0 && !env0\.BUILD_EFFORT && ask && XAI_EFFORTS\.includes\(ask\.effort\) \? \{ \.\.\.env0, BUILD_EFFORT: ask\.effort \} : env0;/, "a reply written later ignores the effort");
  assert.equal((CHATJS.match(/\.\.\.\(talk \? \{ talk \} : \{\}\), \.\.\.\(typeof sendEffort === 'function' \? sendEffort\(\) : null\)/g) || []).length, 4, "a press does not send the effort (Publish, Restore, Discard, and History's Restore)");
});

// ── ROUND 21: THE AUDIT OF EVERY MODEL CALL ──────────────────────────────────
test("R21 THE AUDIT: every door to a model applies the customer's effort — callBuilderModel, the page writer's own call, the container fallback, the container's model service — and a request's parts are filed with it", async () => {
  // Every call to the shared model module in worker.js passes a request that took the effort.
  const lines = W.split("\n").filter((l) => /\bcallModel\(/.test(l) && !/^\s*\/\//.test(l) && !/^import /.test(l));
  assert.ok(lines.length >= 3, "the model calls could not be found");
  for (const l of lines) assert.ok(l.includes("withCustomerEffort(env, req") , "a model call sends a request that skipped the effort: " + l.trim().slice(0, 140));
  assert.ok(!/callModel\(keys, req, budget/.test(W), "a model call sends the bare request");
  assert.match(W, /const callBuilderModel = \(env, req0, budget = null, opts = null\) => \{ const req = withCustomerEffort\(env, req0\);/);
  // The request's parts.
  const { newRequest } = await import("../builder/request.mjs");
  const rec = newRequest({ key: "a".repeat(16), uid: "u1", slug: "site-1", message: "Do two things", picker: "grok", effort: "low" });
  if (rec) assert.equal(rec.effort, "low", "a request does not keep its effort");
  const R = readFileSync(new URL("../builder/request.mjs", import.meta.url), "utf8");
  assert.equal((R.match(/picker: rec\.picker, \.\.\.\(REQUEST_EFFORTS\.includes\(rec\.effort\) \? \{ effort: rec\.effort \} : \{\}\),/g) || []).length, 3, "a part's job is filed without the effort");
  assert.match(W, /effort: env && XAI_EFFORTS\.includes\(env\.BUILD_EFFORT\) \? env\.BUILD_EFFORT : "",/, "the request is made without the customer's effort");
  assert.match(W, /picker: rec\.picker \|\| undefined,\n\s*effort: XAI_EFFORTS\.includes\(rec\.effort\) \? rec\.effort : undefined,/, "a resumed part is filed without the effort");
  assert.match(W, /picker: rec\.picker, effort: XAI_EFFORTS\.includes\(rec\.effort\) \? rec\.effort : undefined, routedCost/, "the request's own reply ignores the effort");
});
