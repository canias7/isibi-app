// IMAGE-FREE ADD-ON ACCEPTANCE (2026-10-12, prepared, not pressed).
//
// The owner, closing the repair batch on 358dff0a: *"Update the existing
// acceptance plan with image-free Add-on scenarios so that testing independent
// additions does not depend on buying photographs; include independent tasks
// within one Add-on and across separate request parts … Specify the evidence
// needed for actual execution overlap, correct final results, dependency
// ordering, reuse and no duplicate charges."*
//
// What is new here and checked here:
//   - the three scenarios (`acc-addon-inner`, `acc-addon-edit`,
//     `acc-addon-pair`) carry the same guards as A1–A5 and buy nothing;
//   - `sections`, the outcome check for a section added to a page that exists;
//   - `addonDesignOverlap`, the free read of whether one Add-on's designers ran
//     together, claimed only when the trace can only be that job's.
// The offline runs of the same shapes are PI 32 and PI 33
// (test/parallel-addon-independent.test.mjs). Nothing here routes, edits or
// buys anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { UI_SCENARIOS, ACCEPTANCE_CAP } from "../scripts/canary-ui.mjs";
import { outcomeChecks, routeOfPage, requestBatchVerdict, COVERAGE } from "../scripts/canary-requests.mjs";
import { addonDesignOverlap, readJobRecords, describeJob } from "../scripts/canary-read-job.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const SLUG = "fold-lane-bakery";
const NEW = ["acc-addon-inner", "acc-addon-edit", "acc-addon-pair"];

// ── THE SCENARIOS ───────────────────────────────────────────────────────────

test("THE IMAGE-FREE ADD-ON SCENARIOS: each buys no image, is bound by the acceptance cap, sends nothing unless the balance covers its estimate, opens the add-on step, and asks for no photograph, form or table", () => {
  for (const k of NEW) {
    const sc = UI_SCENARIOS[k];
    assert.ok(sc, `no ${k}`);
    assert.equal(sc.images, "none", k);
    assert.equal(sc.cap, ACCEPTANCE_CAP, k);
    assert.equal(sc.fundsFirst, true, k);
    assert.equal(sc.addon, true, k);
    assert.equal(sc.site, SLUG, k);
    assert.equal(sc.request, true, k);
    assert.ok(Number.isInteger(sc.budget) && sc.budget > 0 && sc.budget <= ACCEPTANCE_CAP, k);
    assert.equal(sc.steps.length, 1, k);
    assert.doesNotMatch(sc.steps[0].say, /\b(a|an|some) (photo|photograph|picture|image)s?\b|\bform\b|\btable\b|sign.?up/i, `${k} asks for something that buys or stores`);
    assert.ok(Array.isArray(sc.expect.sections) && sc.expect.sections.length > 0, `${k} names no section to judge`);
  }
});

test("WHAT EACH ONE DEMANDS: inside one Add-on, the overlap is read from its job and never demanded of the request; across an Add-on and an Edit part, overlap and exact reuse are demanded; two Add-on sections record the router's shape and demand no concurrency", () => {
  const inner = UI_SCENARIOS["acc-addon-inner"].expect;
  assert.equal(inner.inner, true);
  assert.equal(inner.overlap, undefined, "the request-level overlap is demanded of what may be one job");
  assert.equal(inner.shape, true);
  assert.deepEqual({ ...inner.menu }, { page: 0 });
  const edit = UI_SCENARIOS["acc-addon-edit"].expect;
  assert.equal(edit.overlap, true);
  assert.deepEqual({ ...edit.reuse }, { exact: 1, overlapped: true });
  assert.ok(UI_SCENARIOS["acc-addon-edit"].covers.includes("edit-and-addon"));
  const pair = UI_SCENARIOS["acc-addon-pair"].expect;
  assert.equal(pair.overlap, undefined);
  assert.equal(pair.shape, true);
  assert.equal(pair.sections.length, 2);
  assert.ok(Object.hasOwn(COVERAGE, "addon-inner"), "the inside-one-Add-on coverage has no reader");
});

test("EACH MESSAGE IS PROBED FIRST: acceptance-split-1 routes every new scenario's own words, recorded and unjudged", () => {
  const b = JSON.parse(fs.readFileSync(ROOT + "scripts/router-probes/acceptance-split-1.json", "utf8"));
  for (const k of NEW) {
    const p = b.probes.find((x) => x.message === UI_SCENARIOS[k].steps[0].say);
    assert.ok(p, `${k}'s message is not probed`);
    assert.equal(p.intended, null);
    assert.equal(p.site, SLUG);
  }
  assert.equal(new Set(b.probes.map((p) => p.id)).size, b.probes.length);
});

// ── `sections`: A SECTION ADDED TO A PAGE THAT EXISTS ───────────────────────

const PAGES = ["index", "visit", "order", "gallery", "starter"].map((n) => ({ path: n + ".tsx", source: fs.readFileSync(ROOT + "test/fixtures/run47/" + n + ".before.tsx", "utf8") }));
const TABLES = { ok: true, names: [], tables: {} };
const SPEC = { expect: { sections: [{ route: "/visit", says: ["dogs", "welcome"] }] } };
const SECTION = '<section className="faq"><h2>Questions</h2><p>Can I bring my dog? Dogs are welcome inside.</p></section>';
const PART = { path: "visit-faq.tsx", source: 'export function VisitFaq(){ return <section><h2>Questions</h2><p>Can I bring my dog? Dogs are welcome inside.</p></section> }\n' };
function read(pages, parts = [], mainOf = {}) {
  const served = {}, render = {};
  for (const p of pages) {
    const r = routeOfPage(p.source);
    served[r] = `<!doctype html><html><body><header><a href="/"><img src="/u/${SLUG}/logo.png" alt="logo"/></a></header><main><h1>page</h1>${mainOf[r] || ""}</main></body></html>`;
    render[r] = { status: 200, headings: ["page"] };
  }
  return { inv: { complete: true, source: { pages, parts }, render, stored: { ok: true, description: "" } }, served };
}
const withSection = (pages, html) => pages.map((p) => (p.path === "visit.tsx" ? { ...p, source: p.source.replace("</SiteChrome>", html + "\n    </SiteChrome>") } : p));
const judge = (b, a, spec = SPEC) => outcomeChecks({ spec, before: b.inv, after: a.inv, served: a.served, beforeServed: b.served, tables: { before: TABLES, after: TABLES }, slug: SLUG }).checks;
const bad = (checks) => checks.filter((c) => !c.ok).map((c) => c.name);

test("SECTIONS: a section written into the page, everything else kept, the served page saying it — every check passes; the same section in a component file the press added passes too", () => {
  const b = read(PAGES);
  assert.ok(PAGES.find((p) => p.path === "visit.tsx").source.includes("</SiteChrome>"), "the fixture's landmark is gone");
  const a = read(withSection(PAGES, SECTION), [], { "/visit": SECTION });
  const c = judge(b, a);
  assert.ok(c.some((x) => /\/visit gained a section saying "dogs" and "welcome"/.test(x.name)), "the observer is alive: the section check ran");
  assert.deepEqual(bad(c), []);
  const a2 = read(withSection(PAGES, "<VisitFaq />"), [PART], { "/visit": SECTION });
  assert.deepEqual(bad(judge(b, a2)), []);
});

test("SECTIONS, NEGATIVE: words lost from the page, words it already said, a served page not saying them, another page changed, or an unasked component — each fails by name", () => {
  const b = read(PAGES);
  // lost words
  const lost = withSection(PAGES, SECTION).map((p) => (p.path === "visit.tsx" ? { ...p, source: p.source.replace("The shutters and the street", "The street") } : p));
  assert.ok(bad(judge(b, read(lost, [], { "/visit": SECTION }))).includes("/visit still says everything it said"));
  // already said before: the page gains nothing new for these words
  const said = withSection(PAGES, SECTION);
  assert.ok(bad(judge(read(said, [], { "/visit": SECTION }), read(withSection(said, "<p>More.</p>"), [], { "/visit": SECTION }))).some((n) => /gained a section saying/.test(n)));
  // not served
  assert.ok(bad(judge(b, read(withSection(PAGES, SECTION)))).includes("the served /visit says it"));
  // another page changed
  const other = withSection(PAGES, SECTION).map((p) => (p.path === "order.tsx" ? { ...p, source: p.source + "\n// changed\n" } : p));
  assert.ok(bad(judge(b, read(other, [], { "/visit": SECTION }))).includes("every stored page is byte for byte as it was, apart from the named changes"));
  // with no section asked, a new component is still refused
  assert.ok(bad(judge(b, read(PAGES, [PART]), { expect: {} })).some((n) => /^no component was added/.test(n)));
});

// ── `addonDesignOverlap`: WHETHER ONE ADD-ON'S DESIGNERS RAN TOGETHER ───────

const JOB = "11111111-2222-3333-4444-555555555555";
const ROW = { id: JOB, slug: SLUG, op: "addon", state: "done", created_at: "2026-10-12T10:00:00Z", updated_at: "2026-10-12T10:05:00Z" };
const trace = (events, cid = "c1") => ({ cid, events });
const ev = (p, s, ms) => ({ p, s, ms });
const rec = (traces, ids = [JOB]) => ({ job: JOB, row: ROW, traces, siblings: { ok: true, ids }, notes: [] });

test("DESIGNERS TOGETHER: one job and one trace in the window, two designers whose intervals cross — overlapped, named; one after the other — not overlapped", () => {
  const together = addonDesignOverlap(rec([trace([ev("add:page", "start", 100), ev("add:component", "start", 150), ev("add:page", "ok", 900), ev("add:component", "ok", 950)])]));
  assert.equal(together.verdict, "overlapped", JSON.stringify(together));
  assert.deepEqual(together.meets, ["page and component"]);
  const apart = addonDesignOverlap(rec([trace([ev("add:page", "start", 100), ev("add:page", "ok", 500), ev("add:component", "start", 600), ev("add:component", "ok", 900)])]));
  assert.equal(apart.verdict, "not-overlapped");
  // A DESIGNER STILL OPEN when the trace ended runs beside one that started after it.
  assert.equal(addonDesignOverlap(rec([trace([ev("add:page", "start", 100), ev("add:component", "start", 600), ev("add:component", "ok", 900)])])).verdict, "overlapped");
  // THE ROW STEP IS NOT A DESIGNER.
  assert.equal(addonDesignOverlap(rec([trace([ev("add:row", "start", 100), ev("add:page", "start", 150), ev("add:row", "ok", 900), ev("add:page", "ok", 950)])])).verdict, "unknown");
});

test("DESIGNERS, NEVER CLAIMED FROM A CANDIDATE: another job on the site in the window, or two traces — candidate-only with the intervals reported; an unread window, a dropped event or a missing trace — unknown", () => {
  const crossing = [ev("add:page", "start", 100), ev("add:component", "start", 150), ev("add:page", "ok", 900), ev("add:component", "ok", 950)];
  const two = addonDesignOverlap(rec([trace(crossing)], [JOB, "another-job"]));
  assert.equal(two.verdict, "candidate-only");
  assert.match(two.said, /page 100-900/);
  assert.equal(addonDesignOverlap(rec([trace(crossing), trace(crossing, "c2")])).verdict, "candidate-only");
  assert.equal(addonDesignOverlap(rec([trace(crossing)], ["another-job"])).verdict, "candidate-only", "a window that lacks this job is not this job's");
  assert.equal(addonDesignOverlap({ ...rec([trace(crossing)]), siblings: { ok: false, why: "edit_jobs read for the window failed (500)" } }).verdict, "unknown");
  assert.equal(addonDesignOverlap(rec([trace([...crossing, { p: "…", s: "?", ms: 999, d: { dropped: 3 } }])])).verdict, "unknown");
  assert.equal(addonDesignOverlap(rec([])).verdict, "unknown");
  assert.equal(addonDesignOverlap({ job: JOB, row: null }).verdict, "unknown");
});

test("THE READ-JOB BOX READS THE WINDOW'S JOBS AND PRINTS THE VERDICT: through the real lookup with a stubbed store — only GETs, the jobs on the site in the window asked by slug, and a DESIGNERS line in the account", async () => {
  const asked = [];
  const sb = async (p) => {
    asked.push(p);
    if (p.startsWith(`edit_jobs?id=eq.`)) return { status: 200, rows: [ROW] };
    if (p.startsWith("edit_jobs?slug=eq.")) return { status: 200, rows: [{ id: JOB }] };
    if (p.startsWith("credit_events")) return { status: 200, rows: [] };
    if (p.startsWith("edit_traces")) return { status: 200, rows: [trace([ev("add:page", "start", 100), ev("add:component", "start", 150), ev("add:page", "ok", 900), ev("add:component", "ok", 950)])] };
    return { status: 404, rows: null };
  };
  const r = await readJobRecords({ job: JOB, sb });
  assert.deepEqual(r.siblings, { ok: true, ids: [JOB] });
  assert.ok(asked.some((p) => p.startsWith("edit_jobs?slug=eq." + SLUG) && p.includes("created_at=gte.") && p.includes("created_at=lte.")), JSON.stringify(asked));
  assert.match(describeJob(r), /DESIGNERS {3}overlapped \(page and component\)/);
  const unread = await readJobRecords({ job: JOB, sb: async (p) => (p.startsWith("edit_jobs?slug=eq.") ? { status: 500, rows: null } : sb(p)) });
  assert.equal(unread.siblings.ok, false);
  assert.match(describeJob(unread), /DESIGNERS {3}unknown — edit_jobs read for the window failed \(500\)/);
});

test("THE PRESS RECORDS WHAT IT CANNOT SEE: a scenario that asks for the inside-one-Add-on reading names it as unverified, pointing at the read-job box; one that does not, does not", () => {
  const v = requestBatchVerdict({ spec: UI_SCENARIOS["acc-addon-inner"], steps: [], before: read(PAGES).inv, after: read(PAGES).inv, served: {}, tables: { before: TABLES, after: TABLES }, slug: SLUG });
  assert.ok(v.unverified.some((u) => /designers ran at the same time .*read-job box .*addonDesignOverlap/.test(u)), JSON.stringify(v.unverified));
  const w = requestBatchVerdict({ spec: UI_SCENARIOS["acc-addon-edit"], steps: [], before: read(PAGES).inv, after: read(PAGES).inv, served: {}, tables: { before: TABLES, after: TABLES }, slug: SLUG });
  assert.ok(!w.unverified.some((u) => /designers ran at the same time/.test(u)));
});
