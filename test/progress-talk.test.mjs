// THE BUILDER TALKS WHILE IT WORKS — THE MODULE (2026-10-13).
//
// The owner: *"explain its initial approach, tell me what it is doing, share
// useful findings and decisions … Distinguish intended, running, prepared,
// applied, published and verified states … Give reasons only when the recorded
// decision supports them … Add an optional expandable explanation section …
// Do not promise to expose everything the model thinks, request hidden internal
// reasoning, or present invented reasoning as a live thought stream."*
//
// WHAT THESE CASES PROVE, AND WHAT THEY DO NOT. They prove the DETERMINISTIC
// half: which facts the code records and in which state, what each check fact
// claims and does not, that a record keeps its kind for life, what the call
// asks for (and that it asks for no provider reasoning), and that an answer
// listing a fact in the wrong state, or putting an id in its words or its
// explanation, is refused. They do NOT prove what a real model writes: the
// `says` check reads the model's own account of what it described, never its
// prose, and the case "LIMIT" pins that a contradictory sentence with a true
// account is accepted. Every model answer here is supplied.
import test from "node:test";
import assert from "node:assert/strict";
import {
  talkOn, progressOn, openRecord, readProgressRecord, packRecord, appendMark, batchFor, commitLine, claimWriter, linesOf, confirmLines,
  startFacts, spineCheckFacts, publishedFacts, talkBuildStepFacts, buildStepFacts,
  TALK_STATES, PROGRESS_STATES, TALK_TOOL, TALK_SYSTEM, PROGRESS_SYSTEM, talkRequest, progressRequest, readProgress, writeProgress,
  progressContext, otherParts, waitedFor, PROGRESS_SETTLE_S,
} from "../builder/site-progress.mjs";

const JOB = "a".repeat(32);
const base = (over = {}) => openRecord({ job: JOB, uid: "u-1", slug: "fold-lane-bakery", op: "addon", run: "c_run0001", words: "add a gallery page", at: 1000, ...over });
const tool = (input, name = TALK_TOOL.name) => ({ content: [{ type: "tool_use", name, input }], usage: { input_tokens: 10, output_tokens: 5 } });

test("SWITCH — talk needs both switches; a record opened with it keeps the flag through the store, and one opened without it never has it", () => {
  assert.equal(talkOn({ PROGRESS_TALK: "on" }), false, "talk without the progress switch");
  assert.equal(talkOn({ PROGRESS_REPLIES: "on" }), false);
  assert.equal(talkOn({ PROGRESS_REPLIES: "on", PROGRESS_TALK: " ON " }), true);
  assert.equal(talkOn({ PROGRESS_REPLIES: "on", PROGRESS_TALK: true }), false, "a non-string switch was read as on");
  assert.equal(progressOn({ PROGRESS_REPLIES: "on", PROGRESS_TALK: "off" }), true);
  const t = base({ talk: true });
  assert.equal(t.talk, true);
  assert.equal(readProgressRecord(JSON.parse(JSON.stringify(packRecord(t)))).talk, true);
  assert.equal(Object.hasOwn(base(), "talk"), false);
  assert.equal(Object.hasOwn(readProgressRecord(JSON.parse(JSON.stringify(packRecord(base())))), "talk"), false);
});

test("STATES — checked and published only on a conversational record: an ordinary one refuses them on the way in and reads as nothing if one is stored", () => {
  assert.deepEqual(TALK_STATES, [...PROGRESS_STATES, "checked", "published"]);
  const plain = appendMark(base(), { stage: "checked", facts: [{ state: "checked", text: "The site built without errors." }], at: 2 });
  assert.deepEqual(plain, { refused: "fact" });
  const talk = appendMark(base({ talk: true }), { stage: "checked", facts: [{ state: "checked", text: "The site built without errors." }], at: 2 });
  assert.ok(talk.rec, JSON.stringify(talk));
  const raw = JSON.parse(JSON.stringify(packRecord(talk.rec)));
  delete raw.talk;
  assert.equal(readProgressRecord(raw), null, "an ordinary record holding a checked fact was read");
});

test("PLAN — the opening plan is a plan: decided and next only, never a result; each path names the steps it really runs", () => {
  for (const [op, extra] of [["edit", { layer: "text", page: "/gallery" }], ["addon", {}], ["build", { slug: "harbour-loaf" }]]) {
    const facts = startFacts({ op, ...extra });
    assert.deepEqual(facts.map((f) => f.state), ["decided", "next"], op);
    for (const f of facts) assert.ok(!["checked", "published", "prepared", "applied"].includes(f.state), op + ": a plan claimed a result");
  }
  assert.match(startFacts({ op: "edit", layer: "text", page: "/gallery" })[0].text, /the wording on \/gallery/);
  assert.doesNotMatch(startFacts({ op: "edit", layer: "nonsense", page: "gallery" })[0].text, /nonsense|on gallery/, "an unknown layer or a page that is no path was said");
  assert.match(startFacts({ op: "build", slug: "harbour-loaf" })[0].text, /harbour-loaf/);
  assert.doesNotMatch(startFacts({ op: "build", slug: "Bad Slug!" })[0].text, /Bad Slug/);
  assert.deepEqual(startFacts({ op: "request" }), []);
});

test("CHECKS — each check says only what it reached: a build is not a look at the page, a browser pass is automated, a check that could not run is not done, and nothing is published yet", () => {
  const clean = spineCheckFacts({ render: { ok: true, pages: 3, findings: [] }, cssChecked: 0 });
  assert.deepEqual(clean.map((f) => f.state), ["checked", "checked", "doing"]);
  assert.match(clean[0].text, /built without errors/);
  assert.match(clean[1].text, /opened 3 pages in a browser and flagged none/);
  assert.match(clean[1].text, /automated check, not a look at the design/);
  const flagged = spineCheckFacts({ render: { ok: true, pages: 1, partial: true, findings: [{ route: "/", kind: "contrast" }, { route: "/a", kind: "contrast" }, { route: "/", kind: "made-up" }] } });
  assert.match(flagged[1].text, /opened the page in a browser, but was cut short/);
  assert.match(flagged[1].text, /flagged text that is nearly invisible\./, "a finding was said twice or an unknown kind was named");
  for (const render of [null, { ok: false, pages: 2 }, { ok: true, pages: 0 }]) {
    const f = spineCheckFacts({ render });
    assert.equal(f[1].state, "notdone", "a browser check that did not run was said as " + f[1].state);
    assert.ok(!f.some((x) => x.state === "checked" && /browser/.test(x.text)), "a browser check that did not run was said as checked");
  }
  assert.equal(spineCheckFacts({ render: { ok: true, pages: 1 }, cssChecked: 2 })[2].text, "Each of the 2 style rules this change wrote matches something on the page.");
  assert.ok(!spineCheckFacts({ render: { ok: true, pages: 1 }, cssChecked: 0 }).some((f) => /style rule/.test(f.text)), "a style check that was not asked for was said");
  for (const f of [...clean, ...flagged]) assert.notEqual(f.state, "published", "a check said the site is published");
  assert.deepEqual(publishedFacts().map((f) => f.state), ["published"]);
  assert.doesNotMatch(publishedFacts()[0].text, /checked|looks/i);
});

test("BUILD — a conversational record hears the container's turn as the site built and the publish starting; every other step as before", () => {
  assert.deepEqual(talkBuildStepFacts({ s: "container" }).map((f) => f.state), ["checked", "doing"]);
  assert.deepEqual(buildStepFacts({ s: "container" }), []);
  for (const s of ["design", "schema", "gen", "compile", "photos-missing", "nothing"]) {
    assert.deepEqual(talkBuildStepFacts({ s, tables: 2, missing: 1 }), buildStepFacts({ s, tables: 2, missing: 1 }), s);
  }
});

test("CALL — the conversational request carries every fact whole with its recorded reason, its own tool and instructions, and asks for no provider reasoning", () => {
  const facts = [{ id: "f1", state: "decided", text: "Worked out what to add.", why: "they asked for a waiting list" }, { id: "f2", state: "next", text: "Design it next." }];
  const req = talkRequest({ facts, context: "THEIR SITE: x", model: "m" });
  assert.deepEqual(Object.keys(req).sort(), ["max_tokens", "messages", "model", "system", "tool_choice", "tools"], "the request carries a field beyond the call's own");
  assert.doesNotMatch(JSON.stringify(req), /"(thinking|reasoning|reasoning_effort|include_reasoning|budget_tokens)"/, "the request asks for provider reasoning");
  assert.equal(req.system[0].text, TALK_SYSTEM);
  assert.equal(req.tools[0], TALK_TOOL);
  assert.deepEqual(TALK_TOOL.input_schema.properties.says.items.properties.as.enum, [...TALK_STATES]);
  assert.deepEqual(TALK_TOOL.input_schema.required, ["text", "says"], "the explanation became required");
  const body = req.messages[0].content;
  assert.match(body, /\[f1\] \(decided\) Worked out what to add\. — recorded reason: they asked for a waiting list/);
  assert.match(body, /\[f2\] \(next\) Design it next\.$/m);
  assert.equal(progressRequest({ facts, model: "m" }).system[0].text, PROGRESS_SYSTEM, "the ordinary writer changed");
  assert.doesNotMatch(progressRequest({ facts, model: "m" }).messages[0].content, /recorded reason/, "the ordinary writer was handed reasons");
});

test("INSTRUCTIONS — every new state defined, the evidence rules said, no worked example to copy and no word count, and the explanation never a thought stream", () => {
  for (const s of TALK_STATES) assert.match(TALK_SYSTEM, new RegExp("\\n" + s + ": "), s + " is not defined");
  assert.match(TALK_SYSTEM, /checked something only for a checked fact/);
  assert.match(TALK_SYSTEM, /a site that builds has not been looked at, an automated check is not a visual review/);
  assert.match(TALK_SYSTEM, /something existing does not mean what they asked for is met/);
  assert.match(TALK_SYSTEM, /live only for a published fact/);
  assert.match(TALK_SYSTEM, /reason only where a fact's recorded reason gives it/);
  assert.match(TALK_SYSTEM, /never a stream of thoughts/);
  assert.match(TALK_SYSTEM, /If you have not written an update yet, begin with how you will go about it/);
  assert.doesNotMatch(TALK_SYSTEM, /for example|e\.g\.|such as "|like this:/i, "a worked example to copy");
  assert.doesNotMatch(TALK_SYSTEM, /\b\d+\s*(characters|chars|words|sentences)\b/i, "a word count");
  assert.doesNotMatch(TALK_SYSTEM, /\p{Extended_Pictographic}/u);
});

test("READ — adversarial answers: a check said as published, a plan said as done, an id in the explanation, a fact left out — each refused; an explanation that is no string is none; an ordinary call never takes one", () => {
  const facts = [{ id: "f1", state: "checked", text: "The site built without errors." }, { id: "f2", state: "next", text: "Publish next." }];
  const good = { text: "The site builds; publishing it next.", explain: "I kept the existing layout.", says: [{ id: "f1", as: "checked" }, { id: "f2", as: "next" }] };
  assert.deepEqual(readProgress(tool(good), facts, { talk: true }), { ok: true, text: good.text, explain: good.explain, missing: [], wrong: [], ids: false, why: "" });
  assert.equal(readProgress(tool({ ...good, says: [{ id: "f1", as: "published" }, { id: "f2", as: "next" }] }), facts, { talk: true }).why, "misstated");
  assert.equal(readProgress(tool({ ...good, says: [{ id: "f1", as: "checked" }, { id: "f2", as: "done" }] }), facts, { talk: true }).why, "misstated");
  assert.equal(readProgress(tool({ ...good, explain: "Because of [f1]." }), facts, { talk: true }).why, "ids");
  assert.equal(readProgress(tool({ ...good, says: [{ id: "f1", as: "checked" }] }), facts, { talk: true }).why, "uncovered");
  assert.equal(readProgress(tool({ ...good, explain: ["x"] }), facts, { talk: true }).explain, "", "an explanation that is no string was coerced");
  assert.equal(readProgress(tool(good, "write_progress"), facts, { talk: true }).why, "unreadable", "the ordinary tool was read as a conversational answer");
  assert.equal(readProgress(tool(good, "write_progress"), [{ id: "f2", state: "next", text: "x" }]).explain, "", "the ordinary reader took an explanation");
});

test("LIMIT — PINNED, NOT FIXED: words that call the site live, with a true account of every fact, are accepted — nothing reads the prose (no keyword filter), so the instructions and the final reply are what stand against it", () => {
  const facts = [{ id: "f1", state: "checked", text: "The site built without errors." }];
  const r = readProgress(tool({ text: "It's live and it looks perfect!", says: [{ id: "f1", as: "checked" }] }), facts, { talk: true });
  assert.equal(r.ok, true, "the check now reads the words: say so in the proposal's limits, or this is a keyword filter the owner ruled out");
});

test("WRITE — one misstated answer is asked again, told which; the second carries its explanation; the request each time is the conversational one", async () => {
  const facts = [{ id: "f1", state: "checked", text: "The site built without errors." }];
  const sent = [];
  const answers = [
    tool({ text: "It's published.", says: [{ id: "f1", as: "published" }] }),
    tool({ text: "The site builds.", explain: "I checked the build before publishing.", says: [{ id: "f1", as: "checked" }] }),
  ];
  const out = await writeProgress({ send: async (req) => { sent.push(req); return answers.shift(); } }, { facts, model: "m", talk: true });
  assert.equal(out.ok, true);
  assert.equal(out.attempts, 2);
  assert.equal(out.explain, "I checked the build before publishing.");
  assert.ok(sent.every((r) => r.tools[0] === TALK_TOOL));
  assert.match(sent[1].messages[0].content, /YOUR LAST UPDATE DESCRIBED f1 as published, but its state is checked/);
  const plain = await writeProgress({ send: async () => tool({ text: "x", explain: "y", says: [{ id: "f1", as: "decided" }] }, "write_progress") }, { facts: [{ id: "f1", state: "decided", text: "x" }], model: "m" });
  assert.equal(plain.ok, true);
  assert.equal(Object.hasOwn(plain, "explain"), false, "an ordinary write returned an explanation");
});

test("LINE — the explanation is kept only on a conversational record, and reaches a reader only with its line's confirmation", () => {
  const go = (rec) => {
    let r = appendMark(rec, { stage: "start", facts: startFacts({ op: "addon" }), at: 2 }).rec;
    r = claimWriter(r, "w1", 3).rec;
    r = commitLine(r, { owner: "w1", marks: [0], text: "I'll work out what to add first.", explain: "An addition goes through design before building.", now: 1004 });
    return r;
  };
  const t = go(base({ talk: true }));
  assert.equal(t.lines[0].explain, "An addition goes through design before building.");
  assert.deepEqual(linesOf(t), [], "an unconfirmed line was handed out");
  assert.deepEqual(linesOf(confirmLines(t, 1)), [{ n: 0, ms: 4, text: "I'll work out what to add first.", explain: "An addition goes through design before building." }]);
  const plain = go(base());
  assert.equal(Object.hasOwn(plain.lines[0], "explain"), false, "an ordinary record kept an explanation");
  assert.deepEqual(readProgressRecord(JSON.parse(JSON.stringify(packRecord(confirmLines(t, 1))))).lines[0].explain, "An addition goes through design before building.");
});

test("COALESCE — milestones that land together are one update: every settled fact of every one of them (a check, a failure, a plan's decision), and only the newest 'now' and 'next'", () => {
  let r = base({ talk: true });
  r = appendMark(r, { stage: "start", facts: startFacts({ op: "addon" }), at: 2 }).rec;
  r = appendMark(r, { stage: "picked", facts: [{ state: "decided", text: "Worked out what to add: a new page." }, { state: "next", text: "Design it next." }], at: 3 }).rec;
  r = appendMark(r, { stage: "photos", facts: [{ state: "notdone", text: "The photograph could not be made." }], at: 4 }).rec;
  r = appendMark(r, { stage: "checked", facts: spineCheckFacts({ render: { ok: true, pages: 1 } }), at: 5 }).rec;
  const b = batchFor(r);
  assert.deepEqual(b.marks, [0, 1, 2, 3]);
  const states = b.facts.map((f) => f.state);
  assert.deepEqual(states, ["decided", "decided", "notdone", "checked", "checked", "doing"]);
  assert.ok(b.facts.some((f) => /could not be made/.test(f.text)), "a failure was lost in the coalesced update");
  assert.ok(!b.facts.some((f) => f.state === "next"), "an overtaken 'next' was kept");
  assert.equal(PROGRESS_SETTLE_S > 0 && PROGRESS_SETTLE_S <= 5, true, "the wait is a few seconds");
});

test("CONTEXT — a conversational record is told it has not spoken yet, what each other part waits for and what this one waited for; an ordinary record's context is exactly as before", () => {
  const request = { uid: "u-1", parts: [
    { n: 0, words: "add a Tasting Evenings page", status: "done", needs: [], jobs: [] },
    { n: 1, words: "put it in the menu", status: "started", needs: [0], jobs: [] },
    { n: 2, words: "add a photo to it", status: "blocked", needs: [0, 1], jobs: [] },
  ] };
  const own = base({ talk: true, request: { key: "k".repeat(16), part: 1 } });
  const others = otherParts(own, request);
  assert.deepEqual(others.map((o) => [o.n, o.waits || []]), [[0, []], [2, ["put it in the menu"]]], "a finished need was said as waited for, or a waiting one dropped");
  assert.deepEqual(waitedFor(own, request), ["add a Tasting Evenings page"]);
  assert.deepEqual(waitedFor(own, { ...request, uid: "u-2" }), [], "another owner's request was read");
  const ctx = progressContext(own, { others, waited: waitedFor(own, request) });
  assert.match(ctx, /YOU HAVE NOT WRITTEN AN UPDATE YET\./);
  assert.match(ctx, /“add a photo to it” \(not started yet; it waits for “put it in the menu” to finish first\)/);
  assert.match(ctx, /THIS PART'S REQUEST PLAN: it needed “add a Tasting Evenings page” done first/);
  const plainRec = base({ request: { key: "k".repeat(16), part: 1 } });
  const plainCtx = progressContext(plainRec, { others: otherParts(plainRec, request), waited: ["add a Tasting Evenings page"] });
  assert.doesNotMatch(plainCtx, /NOT WRITTEN AN UPDATE|waits for|REQUEST PLAN/, "an ordinary record's context changed");
  const spoken = { ...own, lines: [{ n: 0, at: 5, text: "I'm on it.", marks: [] }] };
  assert.doesNotMatch(progressContext(spoken, {}), /NOT WRITTEN AN UPDATE/);
  assert.match(progressContext(base({ talk: true, op: "build" })), /THIS WORK: a new site, built from their description/);
  assert.doesNotMatch(progressContext(base({ op: "build" })), /THIS WORK/, "an ordinary build's context changed");
});

test("REACH — the switch reaches a job the container runs (it is handed only the names it is listed for), and the deploy sets it off unless the secret says otherwise", async () => {
  const { JOB_ENV_NAMES, jobSecrets } = await import("../builder/edit-job.mjs");
  assert.ok(JOB_ENV_NAMES.includes("PROGRESS_TALK"), "a job in the container would never see the switch");
  assert.equal(jobSecrets({ PROGRESS_REPLIES: "on", PROGRESS_TALK: "on" }).PROGRESS_TALK, "on");
  const { readFileSync } = await import("node:fs");
  const deploy = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(deploy, /^\s+PROGRESS_TALK: \$\{\{ secrets\.PROGRESS_TALK \|\| 'off' \}\}$/m, "the deploy does not default the switch to off");
  assert.match(deploy, /^\s+PROGRESS_TALK$/m, "the deploy does not upload the switch");
});
