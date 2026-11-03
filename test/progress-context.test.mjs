// WHAT THE PROGRESS WRITER IS TOLD, BEYOND ITS OWN FACTS (2026-10-07).
//
// After run 105, whose part-0 line said "I've prepared the FAQ page and the
// classes page" while part 1 — the Classes heading — was still to come, the
// writer is given what it was missing, as facts and context the code knows:
// the kind of work its job is, the request's other parts as they stand when
// the line is written, and an add-on's pages as the merge and the code's own
// menu links left them (new, changed, or given only a link). The model still
// writes every word; nothing here checks its wording.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: the flows run the real Worker with supplied
// model answers; what a real model writes from this context is not shown.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platform, sendMessage, tick, deliver, settle, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import {
  PART_STATE, otherParts, progressContext, openRecord, readProgressRecord, readRequestRef, PROGRESS_SYSTEM, PROGRESS_VOICE,
} from "../builder/site-progress.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const KEY = "ctx" + "0".repeat(20) + "1";
const OTHER_KEY = "ctx" + "0".repeat(20) + "2";
const JOB = "a".repeat(32);
const base = { job: JOB, uid: "u1", slug: "harbour-loaf", op: "addon", run: "run-1", words: "Add an FAQ page with a link in the menu", pages: ["/", "/classes"], at: 1 };

test("THE STATE OF A PART IS THE PAGE'S OWN: the server's map from a part's status to its task state is the page's (`SITE_SAID_FOR`), key for key", () => {
  const src = readFileSync(ROOT + "public/chat.js", "utf8");
  const at = src.indexOf("const SITE_SAID_FOR = {");
  assert.ok(at > 0, "the page's map moved");
  const body = src.slice(at + "const SITE_SAID_FOR = ".length, src.indexOf("};", at) + 1);
  // eslint-disable-next-line no-new-func
  const page = Function("return " + body)();
  assert.deepEqual({ ...PART_STATE }, page);
});

test("A JOB'S PLACE IN ITS REQUEST is kept on its record, read strictly: a reference that does not read is dropped and the record still reads; a request's own record never carries one", () => {
  assert.deepEqual(readRequestRef({ key: KEY, part: 1 }), { key: KEY, part: 1 });
  for (const bad of [null, "x", { key: KEY }, { key: KEY, part: -1 }, { key: KEY, part: 1.5 }, { key: "nope", part: 0 }, [KEY, 0]]) assert.equal(readRequestRef(bad), null, JSON.stringify(bad));
  const rec = openRecord({ ...base, request: { key: KEY, part: 0, extra: "dropped" } });
  assert.deepEqual(rec.request, { key: KEY, part: 0 });
  assert.deepEqual(readProgressRecord(JSON.parse(JSON.stringify(rec))).request, { key: KEY, part: 0 }, "the reference did not survive a store");
  const bad = openRecord({ ...base, request: { key: "nope", part: 0 } });
  assert.ok(bad, "a bad reference made the record unreadable");
  assert.equal(Object.hasOwn(bad, "request"), false);
  assert.equal(Object.hasOwn(openRecord({ ...base, op: "request", request: { key: KEY, part: 0 } }), "request"), false);
  // A RECORD FROM BEFORE THE REFERENCE reads as it did.
  const old = JSON.parse(JSON.stringify(openRecord(base)));
  assert.equal(Object.hasOwn(readProgressRecord(old), "request"), false);
});

test("THE OTHER PARTS: every part but the job's own, in the words its card shows, with its state — none for a job no request's, another owner's request, or a part that does not read", () => {
  const rec = openRecord({ ...base, request: { key: KEY, part: 0 } });
  const request = { uid: "u1", parts: [
    { n: 0, words: "Add an FAQ page with a link in the menu", status: "started" },
    { n: 1, words: "change the Classes heading", shown: "Change the Classes page heading to Bake with us", status: "blocked" },
    { n: 2, words: "a part with no status", status: "nonsense" },
    { n: 3, words: "  ", status: "done" },
    { n: 4, words: "remove the old banner", status: "done" },
  ] };
  assert.deepEqual(otherParts(rec, request), [
    { n: 1, words: "Change the Classes page heading to Bake with us", state: "planned" },
    { n: 4, words: "remove the old banner", state: "done" },
  ]);
  assert.deepEqual(otherParts(rec, { ...request, uid: "someone-else" }), [], "another owner's request was read");
  assert.deepEqual(otherParts(openRecord(base), request), [], "a job no request's was given parts");
  assert.deepEqual(otherParts(rec, null), []);
});

test("THE CONTEXT: the kind of work, then the other parts as separate work with their states — and neither for what has none", () => {
  const rec = openRecord({ ...base, request: { key: KEY, part: 0 } });
  const others = [{ n: 1, words: "Change the Classes page heading", state: "planned" }, { n: 2, words: "Remove the banner", state: "done" }];
  const ctx = progressContext(rec, { others });
  assert.match(ctx, /THIS WORK: an addition to the site/);
  assert.match(ctx, /THE OTHER PARTS OF THE SAME REQUEST \(separate work, not this update's\):\n- “Change the Classes page heading” \(not started yet\)\n- “Remove the banner” \(finished\)/);
  assert.ok(ctx.indexOf("WHAT THEY ASKED FOR") < ctx.indexOf("THE OTHER PARTS"), "the other parts came before this job's own words");
  assert.match(progressContext({ ...rec, op: "edit" }), /THIS WORK: a change to what the site already has/);
  const alone = progressContext(rec);
  assert.doesNotMatch(alone, /OTHER PARTS/);
  assert.doesNotMatch(progressContext(openRecord({ ...base, op: "request" })), /THIS WORK/, "a request's own record was given a kind of work");
  // A STATE THE WRITER HAS NO WORDS FOR IS LEFT OUT, never shown as some other state.
  assert.doesNotMatch(progressContext(rec, { others: [{ n: 1, words: "x", state: "mystery" }] }), /OTHER PARTS/);
  // THE RULE THE WRITER IS GIVEN FOR THEM, inside the concise instructions.
  assert.match(PROGRESS_SYSTEM, /other parts are separate work/);
  assert.ok(PROGRESS_SYSTEM.replace(PROGRESS_VOICE, "").length < 2000);
});

// ── THROUGH THE REAL WORKER ─────────────────────────────────────────────────

const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const ADD = "add a gallery page";
const slugOf = (k) => "pc-" + k + "-" + Math.random().toString(16).slice(2, 8);
const GATE_MS = 20_000;
const gate = () => {
  let open, reach, timer;
  const g = { opened: new Promise((r) => { open = r; }) };
  g.reached = new Promise((r, no) => { reach = r; timer = setTimeout(() => no(new Error("the case's gate was never reached")), GATE_MS); timer.unref(); });
  g.reached.catch(() => {});
  g.open = open;
  g.reach = () => { clearTimeout(timer); reach(); };
  return g;
};
const settleMs = (ms = 5) => new Promise((r) => setTimeout(r, ms));
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  // THE PROCESS KEPT ALIVE WHILE A CASE WAITS ON ITS OWN GATES: a gate's timer
  // is unreferenced, so a wait with nothing else pending would end the loop.
  const alive = setInterval(() => {}, 1000);
  try { return await fn(P); } finally { clearInterval(alive); P.close(); compiler.uninstall(); }
}
const isJobTask = (P, id) => (m) => !!(m && m.body && m.body.kind === "edit-progress" && m.body.id === id);
/** The job's own progress task, once its first milestone asked for one. */
async function jobTask(P, id) {
  for (let n = 0; n < 200 && !P.queue.some(isJobTask(P, id)); n++) await settleMs();
  const i = P.queue.findIndex(isJobTask(P, id));
  assert.ok(i >= 0, "the job's milestone asked for no writer");
  return P.queue.splice(i, 1)[0];
}
const lastWriterText = (P) => { const w = P.modelLog.filter((m) => m.tool === "write_progress"); return w.length ? w[w.length - 1].text : ""; };

// A MENU ON EACH STORED PAGE, so the code's own menu links have somewhere to go.
const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The street.</p></section>") },
];
