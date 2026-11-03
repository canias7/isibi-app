// PARKED (2026-11-03, park-old-way): the old-way half of test/progress-context.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { platform, sendMessage, tick, deliver, settle, T } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { writtenPage } from "../../../test/fixtures/addon-route.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import {
  PART_STATE, otherParts, progressContext, openRecord, readProgressRecord, readRequestRef, PROGRESS_SYSTEM, PROGRESS_VOICE,
} from "../../../builder/site-progress.mjs";

const ROOT = new URL("../../../", import.meta.url).pathname;
const KEY = "ctx" + "0".repeat(20) + "1";
const OTHER_KEY = "ctx" + "0".repeat(20) + "2";
const JOB = "a".repeat(32);
const base = { job: JOB, uid: "u1", slug: "harbour-loaf", op: "addon", run: "run-1", words: "Add an FAQ page with a link in the menu", pages: ["/", "/classes"], at: 1 };

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

test("CONTEXT 1 — AN EDIT, THEN AN ADD-ON, IN ONE REQUEST: each job's writer is told its own kind of work and the other part as it stands — the add-on still to come while the edit runs, the edit finished while the add-on runs — and never its own part as another's", async () => {
  const g1 = gate(), g2 = gate();
  await withPlatform({
    slug: slugOf("ctx1"), replies: true, progress: true,
    answers: {
      route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }],
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] },
      "lane:description": async () => { g1.reach(); await g1.opened; return NEW_DESC; },
      [T.adds]: { kinds: ["page"] },
      "add:page": async () => { g2.reach(); await g2.opened; return { page: [PAGE("/gallery", "Gallery")] }; },
      [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const parts = () => P.record(r.key).parts;
    assert.equal(parts().length, 2, "the message was not two parts");
    const [w0, w1] = parts().map((p) => p.shown || p.words);
    // PART 0 — the edit — held at its lane, its plan recorded.
    const i0 = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit");
    assert.ok(i0 >= 0, "part 0 filed no job");
    const run0 = deliver(P, P.queue.splice(i0, 1)[0]);
    await g1.reached;
    const job0 = [...P.jobs.values()].find((j) => j.op === "edit");
    assert.deepEqual(P.progressOf(job0.id).request, { key: r.key, part: 0 }, "the edit's record does not know its place in the request");
    await deliver(P, await jobTask(P, job0.id));
    const ctx0 = lastWriterText(P);
    assert.match(ctx0, /THIS WORK: a change to what the site already has/);
    assert.ok(ctx0.includes("THE OTHER PARTS OF THE SAME REQUEST"), "the edit's writer was not told the request's other part:\n" + ctx0);
    assert.ok(ctx0.includes("“" + w1.trim() + "” (not started yet)"), "the add-on was not told as still to come:\n" + ctx0);
    assert.ok(!ctx0.includes("“" + w0.trim() + "” ("), "the edit's own part was told as another's");
    g1.open();
    await run0;
    // PART 1 — the add-on — filed by the driver once part 0 ended (after its
    // own routing job), held at its designer; every other message delivered.
    const isAddonJob = (m) => !!(m && m.body && m.body.kind === "site-edit" && P.jobs.has(m.body.id) && P.jobs.get(m.body.id).op === "addon");
    let run1 = null;
    for (let round = 0; round < 8 && !run1; round++) {
      while (P.queue.length && !run1) {
        const i = P.queue.findIndex(isAddonJob);
        if (i >= 0) { run1 = deliver(P, P.queue.splice(i, 1)[0]); break; }
        await deliver(P, P.queue.shift());
      }
      if (!run1) await tick(P);
    }
    assert.ok(run1, "part 1 was never filed");
    await g2.reached;
    const job1 = [...P.jobs.values()].find((j) => j.op === "addon");
    await deliver(P, await jobTask(P, job1.id));
    const ctx1 = lastWriterText(P);
    assert.match(ctx1, /THIS WORK: an addition to the site/);
    assert.ok(ctx1.includes("“" + w0.trim() + "” (finished)"), "the finished edit was not told as finished:\n" + ctx1);
    g2.open();
    await run1;
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"]);
  });
});

// A MENU ON EACH STORED PAGE, so the code's own menu links have somewhere to go.
const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The street.</p></section>") },
];

test("PAGES 1 — RUN 105'S SHAPE THROUGH THE ROUTE: the writer sends back an existing page changed that nobody asked for, the merge puts it back, and the code links the new page from every menu — the pages milestone names the new page as new and both existing pages as given only a link; the page put back is never told as changed", async () => {
  const visitChanged = { path: "src/routes/visit.tsx", source: pageSrc("/visit", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"come\"><h1>Come and see us</h1><p>A different street.</p></section>") };
  await withPlatform({
    slug: slugOf("pages1"), pages: NAV_PAGES, replies: true, progress: true,
    answers: {
      route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] },
      "add:page": { page: [PAGE("/gallery", "Gallery")] },
      [T.pages]: { pages: [writtenPage("/gallery"), visitChanged] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Add a gallery page" });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(rec.parts.map((p) => p.status), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const job = [...P.jobs.values()].find((j) => j.op === "addon");
    const marks = P.progressOf(job.id).marks;
    const stages = marks.map((m) => m.stage);
    assert.ok(stages.indexOf("pages") > 0 && stages.indexOf("pages") < stages.indexOf("publish"), "the pages milestone is not between the design and the publish: " + stages.join(", "));
    const facts = marks.find((m) => m.stage === "pages").facts.map((f) => [f.state, f.text]);
    assert.deepEqual(facts.map(([s]) => s), ["prepared", "prepared", "next"], JSON.stringify(facts));
    assert.equal(facts[0][1], "New page written: /gallery.");
    assert.equal(facts[1][1], "A menu link to /gallery added, and nothing else changed, on the existing pages / and /visit.");
    assert.ok(!facts.some(([, t]) => /changed for this addition/.test(t)), "the page the merge put back was told as changed");
    // AND WHAT WAS STORED AGREES: /visit keeps its own words, with the link.
    const visit = P.page("visit.tsx");
    assert.ok(visit.includes("Come to the bakery") && !visit.includes("Come and see us"), "the merge did not put /visit back");
    assert.ok(visit.includes("/gallery"), "the code's menu link is not on /visit");
  });
});

test("THE SCHEMA MILESTONE'S WIRING, from the source (the flow harness cannot apply a schema): the mark inside the apply passes `publishing` from the version it was handed — the publish's own at the seam, none where no page is published — so nothing says pages come next", () => {
  const src = readFileSync(ROOT + "worker.js", "utf8");
  const a = src.indexOf("aApplyBackend = async (version) => {");
  const b = src.indexOf("aMigration = await recordSiteMigration(env, ownerSlug, withApplied(aMigration, aMade", a);
  assert.ok(a > 0 && b > a, "the apply's landmarks moved");
  assert.match(src.slice(a, b), /progress\.mark\("schema", addonSchemaFacts\(\{ tables: aTables, altered: aAltered, functions: aFunctions \}, \{ publishing: version != null, held: aWriter\.holding, heldJobs: aWriter\.on, draft: aWriter\.on \}\)\)/);
  assert.equal(src.split("await aApplyBackend(version)").length - 1, 1, "the seam does not hand the apply its version");
  assert.equal(src.split("await aApplyBackend(null)").length - 1, 1, "the pageless path does not hand the apply null");
});
