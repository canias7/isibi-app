// WHAT A PUBLISH CHECKED, HANDED TO EVERY FINAL REPLY (2026-10-14).
//
// Codex's review of branch `new` at f1c6f9b0: the final reply learned which
// checks ran only from the job's progress record (`jobChecksFor`) — there only
// with the conversational switch on and the record written, and holding the
// checks that passed and the publish but not the ones that could not run —
// while a Build's reply and a combined request's were handed none; and every
// reply was handed `renderNote`'s "I had a look at the finished pages", which
// claims somebody looked.
//
// Now the publish makes the evidence (`check-evidence.mjs`: compiled, the
// automated browser check — ran clean, flagged, cut short or could not run —
// the style rules checked, published, the version), the answer keeps it, and
// every final reply reads it from the answer: an edit's, an add-on's, a
// Build's, and each part of a combined request under its own words.
//
// THE CASES: the module (evidence read strictly, facts said as far as they
// reach, the reply's instructions); each final-reply path through its fact
// builder; and through the real Worker — an edit with the switch off, an
// add-on whose browser check could not run, one cut short with findings,
// narration failing and arriving late, a combined request with parallel
// parts, a question and its resumed job, and a Build queued and inline.
// STATE, NOT PROSE: what the reply model is HANDED, never what it writes.
// ⚠ SUPPLIED-MODEL PROOF ONLY — nothing here shows what a real model writes.
import test from "node:test";
import assert from "node:assert/strict";
import { checksOf, readChecks, checkFacts, browserOnlyFacts, FINDING_SAID, MAX_CHECK_FINDINGS } from "../builder/check-evidence.mjs";
import { editReplyFacts, addonReplyFacts, buildReplyFacts, requestReplyFacts, REPLY_SYSTEM, REPLY_TALK_RULES } from "../builder/site-reply.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { platform, sendMessage, deliver, settle, tick, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";

const REPORT = (over = {}) => ({ ok: true, checked: 6, pages: 3, findings: [], ...over });
const LOOK_SAID = /An automated check opened (the page|\d+ pages) in a browser/;
const kOf = (facts) => facts.filter((f) => f.id.startsWith("k")).map((f) => f.text);

// ── THE MODULE ──────────────────────────────────────────────────────────────

test("EVIDENCE — made from what the publish had, and read strictly: anything not exactly its shape is no evidence at all", () => {
  const clean = checksOf({ render: REPORT(), version: "01791-abcdef", published: true });
  assert.deepEqual(clean, { compiled: true, browser: { ran: true, pages: 3, findings: [] }, published: true, version: "01791-abcdef" });
  const flagged = checksOf({ render: REPORT({ findings: [{ route: "/menu", kind: "contrast", detail: "x" }, { route: "/", kind: "made-up" }], partial: true, more: 2 }), cssChecked: 2, published: true });
  // THE UNKNOWN KIND IS COUNTED, NEVER DROPPED (2026-10-14, Codex at 8a000d1f), and its detail never rides along.
  assert.deepEqual(flagged.browser, { ran: true, pages: 3, findings: [{ route: "/menu", kind: "contrast" }], more: 2, unread: 1, cut: true }, "an unknown kind was dropped or the detail rode along");
  assert.equal(flagged.css, 2);
  // NO REPORT, OR ONE THAT SAYS IT DID NOT RUN OR OPENED NO PAGE: a check that did not run.
  for (const r of [null, undefined, { ok: false, pages: 3, findings: [] }, { ok: true, pages: 0, findings: [] }]) {
    assert.deepEqual(checksOf({ render: r, published: true }).browser, { ran: false }, JSON.stringify(r));
  }
  // A REPORT WHOSE RUNNING CANNOT BE READ: neither passed nor "did not run".
  for (const r of ["ok", [], { ok: true, findings: [] }, { pages: 3, findings: [] }, { ok: "yes", pages: 3, findings: [] }, { ok: true, pages: 1.5, findings: [] }]) {
    assert.deepEqual(checksOf({ render: r, published: true }).browser, { ran: null }, JSON.stringify(r));
  }
  const many = checksOf({ render: REPORT({ findings: Array.from({ length: MAX_CHECK_FINDINGS + 3 }, (_, i) => ({ route: "/p" + i, kind: "image" })) }) });
  assert.equal(many.browser.findings.length, MAX_CHECK_FINDINGS);
  assert.equal(many.browser.more, 3, "findings past the cap were dropped without being counted");
  assert.equal(checksOf({ render: REPORT(), version: "not a version!" }).version, undefined);
  assert.equal(checksOf({}).published, false, "published was assumed");
  // READ STRICTLY
  assert.ok(readChecks(clean) && readChecks(flagged));
  for (const bad of [null, "yes", [], { ...clean, compiled: "true" }, { ...clean, published: "yes" }, { ...clean, browser: { ran: "yes" } },
    { ...clean, browser: { ran: true, pages: 0, findings: [] } }, { ...clean, browser: { ran: true, pages: 2, findings: [{ route: "/", kind: "odd" }] } },
    { ...clean, browser: { ran: true, pages: 2, findings: [{ route: "menu", kind: "image" }] } }, { ...clean, css: 0 }, { ...clean, version: "a b" },
    { ...clean, browser: { ran: true, pages: 2, findings: [], cut: false } }, { ...clean, browser: { ran: false, pages: 2 } }, { ...clean, browser: { ran: null, findings: [] } },
    { ...clean, browser: { ran: true, pages: 2, findings: [], unread: 0 } }, { ...clean, browser: { ran: true, pages: 2, findings: [], unknown: false } },
    { ...clean, browser: { ran: true, pages: 2, findings: [], cut: "yes" } }]) {
    assert.equal(readChecks(bad), null, "read as evidence: " + JSON.stringify(bad));
  }
});

test("FACTS — compiling, the automated browser check, the style rules and the publish, each said exactly as far as it reaches; a check that could not run or was cut short says so; never anybody looking, never the live page read", () => {
  const said = (c) => checkFacts(c).map((f) => f.text);
  const clean = said(checksOf({ render: REPORT(), version: "01791-abcdef", published: true }));
  assert.equal(clean.length, 3);
  assert.match(clean[0], /compiled without errors\. Compiling checks that the code fits together; it is not a look at any page\./);
  assert.match(clean[1], /^An automated check opened 3 pages in a browser\. It flagged none of what it looks for \(.*text that is nearly invisible.*\)\. It is automated: nobody looked at the design\.$/);
  assert.match(clean[2], /^Published: .* Nobody opened the live address afterwards to confirm it\.$/);
  for (const t of clean) assert.doesNotMatch(t, /01791-abcdef/, "the version's id was said to the customer: " + t);
  const flagged = said(checksOf({ render: REPORT({ findings: [{ route: "/menu", kind: "contrast" }, { route: "/", kind: "contrast" }, { route: "/visit", kind: "image" }], partial: true, more: 1 }), cssChecked: 1, published: true }));
  assert.match(flagged[1], /cut short before it finished, so not every page was checked\. It flagged text that is nearly invisible \(\/menu and \/\) and an image that did not load \(\/visit\), and 1 more finding not listed here\. It is automated: nobody looked at the design\./);
  assert.match(flagged[2], /^The one style rule this change wrote was checked to match something on the page\.$/);
  const notRun = said(checksOf({ render: { ok: false, error: "browser" }, published: true }));
  assert.match(notRun[1], /^The automated check that opens the pages in a browser could not run, so nothing checked how the pages load\.$/);
  assert.ok(!notRun.some((t) => /flagged none/.test(t)), "a check that did not run was said as clean");
  assert.match(said(checksOf({ render: REPORT() }))[2], /^Not published:/);
  for (const t of [...clean, ...flagged, ...notRun]) {
    assert.doesNotMatch(t, /\bI\b|had a look|reviewed|looks (right|good)|verified|is live\b/i, "a fact claims more than its check: " + t);
  }
  // SCOPED to a request part, and to which of its publishes.
  const scoped = checkFacts(checksOf({ render: REPORT(), published: true }), { scope: "“change the heading”", nth: 2 });
  assert.ok(scoped.every((f) => f.kind === "check" && f.text.startsWith("For “change the heading” (its 2nd publish): ")), JSON.stringify(scoped));
  assert.deepEqual(checkFacts({ compiled: "yes" }), [], "unreadable evidence became facts");
  assert.ok(Object.keys(FINDING_SAID).length >= 9);
});

test("INSTRUCTIONS — every reply is told what a k fact is and how far each check reaches; the talk rules no longer define it", () => {
  assert.match(REPLY_SYSTEM, /k: a check, made or not made, exactly as far as its text says\./);
  assert.match(REPLY_SYSTEM, /- Name only the checks a k fact states, each no further than its words:/, "the reply may name checks no fact states");
  assert.match(REPLY_SYSTEM, /code that compiled was not looked at; an automated browser check is not anybody looking at the design; published is not anybody opening the live site/);
  assert.match(REPLY_SYSTEM, /Never say or suggest you looked at, reviewed, tested or confirmed anything else\./);
  assert.doesNotMatch(REPLY_TALK_RULES, /^k:/m, "the talk rules define k a second time");
  assert.match(REPLY_TALK_RULES, /which checks ran and which could not \(only k facts/);
});

// ── EACH FINAL-REPLY PATH, THROUGH ITS FACT BUILDER ─────────────────────────

const EV = checksOf({ render: REPORT({ findings: [{ route: "/menu", kind: "overflow" }] }), version: "01791-abcdef", published: true });
const OLD_NOTE = "I had a look at the finished pages: /menu scrolls sideways.";

test("EDIT AND ADD-ON — the answer's own checks are k facts; `renderNote` is never a fact; an answer from before the evidence gives only what its browser check flagged; none of either gives none", () => {
  const want = checkFacts(EV).map((f) => f.text);
  for (const [name, facts] of [["edit", (b) => editReplyFacts({ ok: true, layer: "text", applied: 1, changed: ["Fresh bread"], ...b })], ["addon", (b) => addonReplyFacts({ ok: true, added: ["gallery.tsx"], ...b })]]) {
    const now = facts({ checks: EV, renderNote: OLD_NOTE, render: { ok: true, pages: 3, findings: [{ route: "/menu", kind: "overflow" }] } }).facts;
    assert.deepEqual(kOf(now), want, name);
    assert.ok(!now.some((f) => /had a look/.test(f.text)), name + ": the old sentence reached the reply model");
    const older = facts({ renderNote: OLD_NOTE, render: { ok: true, pages: 3, findings: [{ route: "/menu", kind: "overflow" }] } }).facts;
    assert.deepEqual(kOf(older).length, 1, name + ": " + JSON.stringify(kOf(older)));
    assert.match(kOf(older)[0], /flagged a page that scrolls sideways \(\/menu\)/);
    assert.ok(!older.some((f) => /had a look|compiled|Published/.test(f.text)), name + ": an old answer was said to have compiled or published by the evidence");
    assert.deepEqual(kOf(facts({}).facts), [], name + ": checks were invented");
    assert.deepEqual(kOf(facts({ checks: { compiled: "maybe" }, render: { ok: true, pages: 1, findings: [{ route: "/", kind: "blank" }] } }).facts), [], name + ": a malformed evidence fell back to the report");
  }
});

test("BUILD — its facts keep only readable evidence, and its reply is handed it as k facts", () => {
  assert.equal(buildFacts({ checks: { compiled: "yes" } }), null, "unreadable evidence was kept");
  const bf = buildFacts({ checks: EV });
  assert.deepEqual(bf, { checks: EV });
  assert.deepEqual(kOf(buildReplyFacts(bf).facts), checkFacts(EV).map((f) => f.text));
});

test("COMBINED REQUEST — each part's publishes are said under that part's own words, in order; a part with none, or with evidence that does not read, gets none", () => {
  const v = { parts: [
    { n: 0, words: "change the heading", status: "done", jobs: ["j0"], checks: [EV, checksOf({ render: { ok: false }, published: true })] },
    { n: 1, words: "add a gallery page", status: "failed", jobs: ["j1"], why: "x", checks: [{ compiled: "no" }] },
    { n: 2, words: "link it from the menu", status: "not-run", why: "needs:1" },
  ], routedUnsaid: 1 };
  const k = kOf(requestReplyFacts(v).facts);
  assert.ok(k.length > 0);
  assert.ok(k.every((t) => t.startsWith("For “change the heading” (its 1st publish): ") || t.startsWith("For “change the heading” (its 2nd publish): ")), JSON.stringify(k, null, 1));
  assert.ok(k.some((t) => /2nd publish\): The automated check that opens the pages in a browser could not run/.test(t)), "the second publish's unrun check was lost");
  assert.ok(!k.some((t) => /gallery|menu link/.test(t)), "another part was given a check");
});

// ── THROUGH THE REAL WORKER ─────────────────────────────────────────────────

const ADD = "add a gallery page";
const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const slugOf = (k) => "ce-" + k + "-" + Math.random().toString(16).slice(2, 8);
const ADDON = { route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const EDIT = { route: [{ intent: "edit", layer: "look" }], [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
async function withPlatform(opts, fn, render = REPORT()) {
  const compiler = installCompiler({ render });
  const P = platform(opts);
  const alive = setInterval(() => {}, 1000);
  try { return await fn(P); } finally { clearInterval(alive); P.close(); compiler.uninstall(); }
}
async function drain(P) {
  for (let round = 0; round < 12 && P.queue.length; round++) {
    while (P.queue.length) await deliver(P, P.queue.shift());
    await tick(P);
  }
}
/** Run a message to its end; the job of `op`, its answer as served, and the k facts its reply was handed. */
async function runOne(P, message, op) {
  const r = await sendMessage(P, { message });
  await drain(P);
  await settle(P, r.key);
  const job = [...P.jobs.values()].find((j) => j.op === op);
  assert.ok(job, "no " + op + " job");
  const fin = await call(P, "GET", "/api/site/edit/" + job.id);
  return { r, job, fin, ks: P.replyLog.map(kOf).find((k) => k.length) || [] };
}
