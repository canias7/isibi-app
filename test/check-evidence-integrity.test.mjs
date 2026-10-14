// A BROWSER CHECK'S REPORT IS CLEAN ONLY WHEN IT READS CLEAN (2026-10-14).
//
// Codex's review of branch `new` at 8a000d1f: `checksOf` filtered every
// finding it could not read out of the list, so a report whose findings were
// an unknown kind, a known kind on an unreadable page, or not a list at all
// came out `ran: true, findings: []` — and `checkFacts` said the check
// "flagged none of what it looks for". An all-clear made of evidence nobody
// could read.
//
// Now the report is read into four outcomes (`browserOf`): did not run;
// ran, with what it found understood finding by finding — unknown kinds
// counted (`unread`), a known kind on an unreadable page kept without one, a
// list that cannot be read marked (`unknown`); and a report whose running
// cannot be read (`ran: null`). Clean is only a report that reads clean. The
// progress milestone, the final reply's facts, an older answer's report and
// the page's own line all read it the same way, so they cannot disagree.
//
// NEGATIVE CONTROLS: Codex's three reproductions, and valid and invalid
// findings mixed. POSITIVE CONTROLS: clean, flagged, cut short, did not run.
// THROUGH THE REAL REPLY HANDOFF with narration on and off. State, not prose:
// what the reply model is HANDED. ⚠ SUPPLIED-MODEL PROOF ONLY.
import test from "node:test";
import assert from "node:assert/strict";
import { checksOf, readChecks, checkFacts, browserOnlyFacts, browserSaid, browserClean } from "../builder/check-evidence.mjs";
import { spineCheckFacts } from "../builder/site-progress.mjs";
import { renderNote } from "../builder/site-render.mjs";
import { editReplyFacts, addonReplyFacts } from "../builder/site-reply.mjs";
import { platform, sendMessage, deliver, settle, tick, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";

const CLEAN_SAID = /flagged none of what it looks for/;
const NOT_KNOWN = /It is not known to be clean\./;

// CODEX'S THREE REPRODUCTIONS, exactly as reported.
const UNEXPECTED_KIND = { ok: true, pages: 1, findings: [{ route: "/", kind: "unexpected-kind" }] };
const UNREADABLE_ROUTE = { ok: true, pages: 1, findings: [{ route: "the menu page", kind: "image" }] };
const NOT_A_LIST = { ok: true, pages: 1, findings: "unreadable" };
const MIXED = { ok: true, pages: 3, findings: [
  { route: "/menu", kind: "contrast", detail: "caption on cream" },
  { route: "/", kind: "unexpected-kind", detail: "<script>raw</script>" },
  "a bare string",
  null,
  { route: 42, kind: "overflow" },
  { route: "/visit", kind: "image" },
] };

/** What each reader says of one report's browser check: the progress milestone, the final reply, an older answer, the page's own line. */
function readers(render) {
  const ev = checksOf({ render, published: true });
  const prog = spineCheckFacts({ render })[1];
  const reply = checkFacts(ev)[1];
  const legacy = browserOnlyFacts(render)[0];
  return { ev, prog, reply, legacy, note: renderNote(render) };
}

test("NEGATIVE — CODEX'S THREE: an unknown kind, a known kind on an unreadable page, and a list that is not a list are never an all-clear, in any reader", () => {
  for (const [name, render] of [["unexpected kind", UNEXPECTED_KIND], ["unreadable route", UNREADABLE_ROUTE], ["not a list", NOT_A_LIST]]) {
    const r = readers(render);
    assert.equal(browserClean(r.ev.browser), false, name + ": read as clean: " + JSON.stringify(r.ev.browser));
    assert.equal(r.ev.browser.ran, true, name + ": its running is known, so it is neither unread nor 'did not run'");
    for (const t of [r.prog.text, r.reply.text, r.legacy.text]) {
      assert.doesNotMatch(t, CLEAN_SAID, name + ": said as clean: " + t);
      assert.doesNotMatch(t, /could not run|did not run/, name + ": said as not run: " + t);
    }
    assert.ok(r.note, name + ": the page's own line says nothing, the way it does for a clean report");
    assert.doesNotMatch(r.note, CLEAN_SAID);
  }
  // EACH SAID FOR WHAT IT IS.
  assert.deepEqual(checksOf({ render: UNEXPECTED_KIND }).browser, { ran: true, pages: 1, findings: [], unread: 1 });
  assert.match(readers(UNEXPECTED_KIND).reply.text, /One finding it reported could not be read, so what it was is not known\. It is not known to be clean\./);
  assert.deepEqual(checksOf({ render: UNREADABLE_ROUTE }).browser, { ran: true, pages: 1, findings: [{ kind: "image" }] }, "the known finding was dropped with its page");
  assert.match(readers(UNREADABLE_ROUTE).reply.text, /It flagged an image that did not load \(a page whose address could not be read\)\./);
  assert.deepEqual(checksOf({ render: NOT_A_LIST }).browser, { ran: true, pages: 1, findings: [], unknown: true });
  assert.match(readers(NOT_A_LIST).reply.text, /What it found could not be read, so whether it flagged anything is not known\. It is not known to be clean\./);
});

test("NEGATIVE — MIXED: every valid finding kept with its page, a known kind on an unreadable page kept without one, every unreadable one counted, and no raw text of any finding in any sentence", () => {
  const r = readers(MIXED);
  assert.deepEqual(r.ev.browser, { ran: true, pages: 3, findings: [{ route: "/menu", kind: "contrast" }, { kind: "overflow" }, { route: "/visit", kind: "image" }], unread: 3 });
  assert.ok(readChecks(r.ev), "the evidence does not read back");
  assert.match(r.reply.text, /It flagged text that is nearly invisible \(\/menu\), a page that scrolls sideways \(a page whose address could not be read\) and an image that did not load \(\/visit\)\. 3 findings it reported could not be read, so what they were is not known\. It is not known to be clean\./);
  for (const t of [r.prog.text, r.reply.text, r.legacy.text, r.note]) {
    assert.doesNotMatch(t, /unexpected-kind|<script>|caption on cream|a bare string|42/, "raw finding text reached a sentence: " + t);
  }
  assert.match(r.note, /\/menu has text that is nearly invisible.*and 3 findings that could not be read\.$/);
});

test("POSITIVE CONTROLS — clean, flagged, cut short, did not run, and a report whose running cannot be read: each said as exactly that", () => {
  const clean = readers({ ok: true, pages: 3, findings: [] });
  assert.equal(browserClean(clean.ev.browser), true);
  assert.match(clean.reply.text, /^An automated check opened 3 pages in a browser\. It flagged none of what it looks for/);
  assert.doesNotMatch(clean.reply.text, NOT_KNOWN);
  assert.equal(clean.note, "", "a clean report's page line is not silent");
  const flagged = readers({ ok: true, pages: 2, findings: [{ route: "/visit", kind: "image" }] });
  assert.match(flagged.reply.text, /It flagged an image that did not load \(\/visit\)\. It is automated/);
  assert.doesNotMatch(flagged.reply.text, NOT_KNOWN, "a fully read report was called not known");
  const cut = readers({ ok: true, pages: 2, findings: [], partial: true });
  assert.match(cut.reply.text, /was cut short before it finished, so not every page was checked\. On the pages it reached it flagged none/);
  for (const render of [null, { ok: false, pages: 0, findings: [], error: "chromium did not start" }]) {
    const r = readers(render);
    assert.deepEqual(r.ev.browser, { ran: false });
    assert.match(r.reply.text, /could not run, so nothing checked how the pages load\./);
    assert.equal(r.prog.state, "notdone");
    assert.doesNotMatch(r.reply.text, /chromium/, "the raw error reached a sentence");
  }
  const unread = readers({ pages: 3, findings: [] });
  assert.deepEqual(unread.ev.browser, { ran: null });
  assert.match(unread.reply.text, /its result could not be read, so whether it ran and what it found are not known/);
  assert.doesNotMatch(unread.reply.text, /could not run|did not run|flagged none/, "an unreadable result was said as not run or as clean: " + unread.reply.text);
  assert.equal(unread.prog.state, "notdone", "an unreadable result was said as checked");
});

test("ONE READING — for every report, the progress milestone, the final reply and an older answer's report say the same sentence; checked only when it ran", () => {
  const table = [{ ok: true, pages: 3, findings: [] }, { ok: true, pages: 1, findings: [{ route: "/", kind: "blank" }], partial: true, more: 4 },
    UNEXPECTED_KIND, UNREADABLE_ROUTE, NOT_A_LIST, MIXED, { ok: true, pages: 2, findings: [], more: "lots" }, { ok: true, pages: 2, findings: [], partial: "maybe" },
    { ok: false, pages: 0 }, { pages: 3 }];
  for (const render of table) {
    const r = readers(render);
    assert.equal(r.prog.text, r.reply.text, "progress and reply disagree on " + JSON.stringify(render));
    assert.equal(r.legacy.text, r.reply.text, "an older answer and a new one disagree on " + JSON.stringify(render));
    assert.equal(r.prog.text, browserSaid(r.ev.browser));
    assert.equal(r.prog.state, r.ev.browser.ran === true ? "checked" : "notdone", JSON.stringify(render));
    assert.equal(CLEAN_SAID.test(r.reply.text), browserClean(r.ev.browser), "said clean without reading clean: " + JSON.stringify(render));
  }
  assert.match(readers({ ok: true, pages: 2, findings: [], more: "lots" }).reply.text, /What it found could not be read/);
  assert.match(readers({ ok: true, pages: 2, findings: [], partial: "maybe" }).reply.text, /whether it reached every page could not be read/);
});

test("LEGACY ANSWERS — an answer stored before the evidence, carrying only its report, gives the same reading through the reply's fact builders", () => {
  for (const render of [UNEXPECTED_KIND, NOT_A_LIST, MIXED]) {
    const want = browserSaid(checksOf({ render }).browser);
    for (const facts of [editReplyFacts({ ok: true, layer: "text", applied: 1, changed: ["Fresh"], render }).facts, addonReplyFacts({ ok: true, added: ["gallery.tsx"], render }).facts]) {
      const k = facts.filter((f) => f.kind === "check").map((f) => f.text);
      assert.deepEqual(k, [want], JSON.stringify(render));
    }
  }
});

// ── THROUGH THE REAL REPLY HANDOFF ──────────────────────────────────────────

const ADD = "add a gallery page";
const PAGE = { path: "/gallery", name: "Gallery", purpose: "the bakes", sections: ["a band"], components: ["section-header"] };
const ADDON = { route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const kOf = (facts) => facts.filter((f) => f.id.startsWith("k")).map((f) => f.text);
async function through(render, { talk }) {
  const compiler = installCompiler({ render });
  const P = platform({ slug: "ci-" + (talk ? "on" : "off") + "-" + Math.random().toString(16).slice(2, 8), replies: true, progress: talk, talk, answers: ADDON });
  const alive = setInterval(() => {}, 1000);
  try {
    const r = await sendMessage(P, { message: ADD });
    for (let round = 0; round < 12 && P.queue.length; round++) { while (P.queue.length) await deliver(P, P.queue.shift()); await tick(P); }
    await settle(P, r.key);
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    const fin = await call(P, "GET", "/api/site/edit/" + job.id);
    const rec = talk ? P.progressOf(job.id) : null;
    return { fin, ks: P.replyLog.map(kOf).find((k) => k.length) || [], rec, state: P.jobs.get(job.id).state };
  } finally { clearInterval(alive); P.close(); compiler.uninstall(); }
}

for (const [name, render] of [["an unknown kind", UNEXPECTED_KIND], ["a known kind on an unreadable page", UNREADABLE_ROUTE], ["a list that is not a list", NOT_A_LIST]]) {
  test("REAL HANDOFF, NARRATION OFF AND ON — " + name + ": the stored evidence, the reply's facts and the progress milestone all say it was not read clean", async () => {
    const want = browserSaid(checksOf({ render }).browser);
    for (const talk of [false, true]) {
      const o = await through(render, { talk });
      assert.equal(o.state, "done", "the job did not finish");
      const ev = readChecks(o.fin.body.checks);
      assert.ok(ev, "no evidence on the answer");
      assert.equal(browserClean(ev.browser), false, "the stored evidence reads clean (talk " + talk + ")");
      assert.ok(o.ks.includes(want), "the reply was not handed the reading (talk " + talk + "): " + JSON.stringify(o.ks));
      assert.ok(!o.ks.some((t) => CLEAN_SAID.test(t)), "the reply was handed an all-clear (talk " + talk + ")");
      if (talk) {
        const said = o.rec.marks.filter((m) => m.stage === "checked").flatMap((m) => m.facts).map((f) => f.text);
        assert.ok(said.includes(want), "the progress milestone disagrees with the reply: " + JSON.stringify(said));
      }
    }
  });
}

test("REAL HANDOFF, CONTROL — a genuinely clean report is still handed as clean, narration off and on", async () => {
  for (const talk of [false, true]) {
    const o = await through({ ok: true, pages: 2, findings: [] }, { talk });
    assert.ok(o.ks.some((t) => CLEAN_SAID.test(t)), "a clean report lost its all-clear (talk " + talk + "): " + JSON.stringify(o.ks));
    assert.ok(!o.ks.some((t) => NOT_KNOWN.test(t)));
  }
});
