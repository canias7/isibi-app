// WHOSE EVIDENCE IS IT? (2026-10-14, the owner's review after run 121)
//
// *"buildFlagsVerdict currently passes when runnerEveryone is true but the
// jobDesign/jobGraph/jobBands/jobBandsEveryone fields are absent, falling back
// to the Worker's flags … traceAttribution accepts any trace starting inside
// the chosen job's time window … the source reader also reads the current site
// rather than a proven output of that attempt. Bind verification evidence to
// the actual job and published version where available, and explicitly report
// unverified attribution when historical records cannot establish it."*
//
// What these hold, each with a valid control beside it:
//   AT 1  the runtime: builds in the container need the job's own four
//         settings; missing or partial is unverified and the paid press sends
//         nothing; a route that does not say where builds run is unverified; a
//         Worker-only route keeps the Worker's view.
//   AT 2  overlapping attempts of the same site: a trace tagged by the other
//         job is refused even though it starts inside this job's life.
//   AT 3  a replacement trace inside the window: untagged is unverified (said,
//         never credited); tagged by another job is refused.
//   AT 4  the source changed after completion: the press judges the job's own
//         stored version, never the site as it stands; an answer that is not
//         that version (an old route, a pruned version, another job) is
//         unverified and judges nothing.
//   AT 5  the real Worker's source route answers by job: the version whose
//         manifest names the job, from its stored state, with the live pointer;
//         none or two such versions is a 404 naming it; the explorer's plain
//         read is unchanged and never accepted as a job's output.
//   AT 6  the build's publish mark carries the job tag (worker.js source).
//   AT 7  prompt acceptance and recovered tracking are recorded apart.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { jobTagOf } from "../builder/build-live.mjs";
import { buildFlagsVerdict, traceAttribution, sourceAttribution, runBuildCheck, BUILD_CHECK_NO_IMAGES } from "../scripts/canary-build.mjs";

const JOB = "a1".repeat(16), OTHER = "b2".repeat(16), SLUG = BUILD_CHECK_NO_IMAGES.slug;
const UID = "22175f41-6fbf-49d7-b039-a65078a0141c";
const VER = "01790600000000-abc123", VER2 = "01790600000001-def456";
const tag = (steps, job) => steps.map((x) => (x.s === "pages" ? { ...x, jobTag: jobTagOf(job) } : x));
const STEPS = [{ s: "auth" }, { s: "design", in: 1, out: 1, graph: 16, agents: 16, agentMs: 90_000, waveMs: 40_000 }, { s: "provision" }, { s: "gen" }, { s: "bands", bands: 4, wrote: 4, agentMs: 80_000, waveMs: 30_000 }, { s: "fonts" }, { s: "img" }, { s: "compile" }, { s: "container" }, { s: "og" }, { s: "pages" }];
const ROW = { id: JOB, slug: SLUG, op: "build", state: "done", created_at: "2026-10-14T12:21:23Z", updated_at: "2026-10-14T12:29:12Z" };
const SENT = Date.parse("2026-10-14T12:21:23Z");
const IN_WINDOW = "2026-10-14T12:23:43Z";
const ONE_PAGE = { reads: { pages: true, parts: true, assets: true }, pages: [{ path: "src/routes/index.tsx", source: 'import { Hero } from "@/components/ui/hero";\nexport const Route = createFileRoute("/")({});' }], parts: [] };
const TWO_PAGES = { ...ONE_PAGE, pages: [...ONE_PAGE.pages, { path: "src/routes/menu.tsx", source: "export const Route = 1;" }] };
const RUNTIME_ON = { imagePurchases: false, design: true, graph: true, bands: true, bandsEveryone: false, runner: true, runnerEveryone: true, jobDesign: true, jobGraph: true, jobBands: true, jobBandsEveryone: false };

/** The press's network, offline: answered promptly (202) with the job; the build ends; the site's current copy may differ from the job's own version. */
function net(over = {}) {
  const calls = [];
  let clock = 0, signIns = 0;
  return {
    calls,
    attempt: () => "bc-" + "e".repeat(32),
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    log: () => {},
    signIn: async () => { signIns++; return { token: `tok-${signIns}`, uid: UID }; },
    balance: async () => (calls.includes("post") ? 773 : 783),
    ledgerLast: async () => ({ ok: true, id: calls.includes("post") ? 469 : 466 }),
    existing: async () => ({ backends: { status: 200, rows: [] }, builds: { status: 200, rows: [] }, host: { status: 404 } }),
    runtime: async () => ({ status: 200, json: RUNTIME_ON }),
    post: async () => { calls.push("post"); return { status: 202, json: { ok: false, stage: "resuming", job: JOB } }; },
    poll: async () => ({ status: 200, json: { ok: true, slug: SLUG, progress: [{ n: 0, ms: 1000, text: "I'm laying out your page." }] } }),
    trace: async () => ({ steps: tag(STEPS, JOB), done: true, ok: true, started_at: IN_WINDOW }),
    jobRow: async (job) => ({ ...ROW, id: job }),
    // THE SITE AS IT STANDS NOW — edited after the build into two pages.
    source: async () => { calls.push("source-now"); return { status: 200, json: TWO_PAGES }; },
    // THE JOB'S OWN STORED VERSION — the one page the build published.
    sourceJob: async (t, slug, job) => { calls.push(`source-job:${job}`); return { status: 200, json: { ...ONE_PAGE, ok: true, slug, job, version: VER, live: { version: VER2, job: OTHER } } }; },
    served: async () => ({ status: 200, html: "<main><h1>Saltmarsh</h1></main>" }),
    uploads: async () => ({ ok: true, files: [] }),
    ledgerWindow: async () => ({ ok: true, complete: true, rows: [{ id: 467, ref: `build:${JOB}:deposit`, delta: -2 }, { id: 468, ref: `build:${JOB}:settle`, delta: -4 }, { id: 469, ref: `build:${JOB}:pages`, delta: -4 }] }),
    ...over,
  };
}
const by = (rec, re) => rec.checks.find((c) => re.test(c.name));
const NI = { ...BUILD_CHECK_NO_IMAGES, laterReadMs: 0 };

test("AT 1 — MISSING RUNTIME FIELDS ARE UNVERIFIED, AND THE PAID PRESS SENDS NOTHING: builds in the container with the job's settings absent or partial, or a route that does not say where builds run; controls: the job's view on passes, a Worker-only route keeps the Worker's view", async () => {
  const cases = [
    [{ ...RUNTIME_ON, jobDesign: undefined, jobGraph: undefined, jobBands: undefined, jobBandsEveryone: undefined }, /does not report the job's own settings \(jobDesign, jobGraph, jobBands, jobBandsEveryone not reported\)/],
    [{ ...RUNTIME_ON, jobBandsEveryone: undefined }, /\(jobBandsEveryone not reported\)/],
    [{ ...RUNTIME_ON, runner: false, runnerEveryone: true, jobGraph: "yes" }, /\(jobGraph not reported\)/],
    [{ ...RUNTIME_ON, runner: undefined, runnerEveryone: undefined }, /does not report whether builds run in the container/],
    [{ ...RUNTIME_ON, runner: undefined }, /does not report whether builds run in the container/],
  ];
  for (const [json, re] of cases) {
    const v = buildFlagsVerdict({ status: 200, json });
    assert.deepEqual([v.ok, v.unverified], [false, true], JSON.stringify(json));
    assert.match(v.why, re);
    assert.doesNotMatch(v.why, /^$/);
    const io = net({ runtime: async () => ({ status: 200, json }) });
    const rec = await runBuildCheck(io, { spec: NI, spend: true, named: 783 });
    assert.equal(rec.sent, false, `sent with ${JSON.stringify(json)}`);
    assert.ok(!io.calls.includes("post"), "the paid build was posted on unverified settings");
    assert.match(rec.stopped, re);
  }
  // CONTROLS. The job's own view on: a mode, by the job's view.
  const on = buildFlagsVerdict({ status: 200, json: RUNTIME_ON });
  assert.deepEqual([on.ok, on.view, on.modes], [true, "as the container job sees it", ["design agents at once", "the design as a graph"]]);
  // The job's own view all off, the Worker's on (run 117): no mode, never borrowed.
  const r117 = buildFlagsVerdict({ status: 200, json: { ...RUNTIME_ON, jobDesign: false, jobGraph: false, jobBands: false, jobBandsEveryone: false } });
  assert.deepEqual([r117.ok, r117.unverified], [false, undefined]);
  // A Worker-only route (builds not in the container): the Worker's view is the build's.
  const worker = buildFlagsVerdict({ status: 200, json: { design: true, graph: false, bands: false, bandsEveryone: false, runner: false, runnerEveryone: false } });
  assert.deepEqual([worker.ok, worker.view, worker.modes], [true, "as the Worker sees it", ["design agents at once"]]);
  // And the press sends on the verified view.
  const io = net();
  const rec = await runBuildCheck(io, { spec: NI, spend: true, named: 783 });
  assert.equal(rec.sent, true);
  assert.equal(io.calls.filter((c) => c === "post").length, 1);
});

test("AT 2 — OVERLAPPING ATTEMPTS OF THE SAME SITE: the other job's trace starts inside this job's life and is still refused by its tag; the overlap it records is not credited; control: this job's own tagged trace passes", async () => {
  const otherTrace = { steps: tag(STEPS, OTHER), started_at: IN_WINDOW };
  const a = traceAttribution({ trace: otherTrace, jobRow: ROW, job: JOB, slug: SLUG, sentAt: SENT });
  assert.equal(a.ok, false);
  assert.equal(a.unverified, undefined, "another job's tag is a refusal, not a cannot-tell");
  assert.match(a.why, /job tag \d+ is another attempt's/);
  // The other job, judged against its own row, owns it.
  assert.equal(traceAttribution({ trace: otherTrace, jobRow: { ...ROW, id: OTHER }, job: OTHER, slug: SLUG, sentAt: SENT }).ok, true);
  // Through the press: the other attempt's graph and bands never pass this build.
  const rec = await runBuildCheck(net({ trace: async () => ({ ...otherTrace, done: true, ok: true }) }), { spec: NI, spend: true, named: 783 });
  assert.equal(by(rec, /trace judged is this build's own/).ok, false);
  assert.equal(by(rec, /independent build work ran at once/).ok, false, "another attempt's overlap was credited");
  // CONTROL.
  const own = await runBuildCheck(net(), { spec: NI, spend: true, named: 783 });
  assert.equal(by(own, /trace judged is this build's own/).ok, true, by(own, /trace judged/).why);
  assert.equal(by(own, /independent build work ran at once/).ok, true);
  assert.equal(own.traceAttribution.by, "job tag");
});

test("AT 3 — A REPLACEMENT TRACE INSIDE THE WINDOW: untagged is unverified (said, never credited — its reading is kept beside the reason); tagged by another job is refused; a tag naming this job outside the window is refused; controls", async () => {
  const untagged = { steps: STEPS, started_at: IN_WINDOW };
  const u = traceAttribution({ trace: untagged, jobRow: ROW, job: JOB, slug: SLUG, sentAt: SENT });
  assert.deepEqual([u.ok, u.unverified], [false, true]);
  assert.match(u.why, /attribution unverified: the trace carries no job tag/);
  const rec = await runBuildCheck(net({ trace: async () => ({ ...untagged, done: true, ok: true }) }), { spec: NI, spend: true, named: 783 });
  assert.equal(by(rec, /trace judged is this build's own/).ok, false);
  assert.match(by(rec, /independent build work ran at once/).why, /^not judged: trace attribution unverified \(the unbound trace reads: /);
  assert.ok(rec.unverified.some((x) => /no job tag/.test(x)), "the unverified attribution is not reported");
  assert.equal(rec.ok, false);
  // A tag present but malformed (not this job's number) is another attempt's.
  assert.equal(traceAttribution({ trace: { steps: [{ s: "pages", jobTag: "x" }], started_at: IN_WINDOW }, jobRow: ROW, job: JOB, slug: SLUG, sentAt: SENT }).ok, false);
  // This job's tag but a start outside its life: contradictory, refused.
  assert.match(traceAttribution({ trace: { steps: tag(STEPS, JOB), started_at: "2026-10-14T14:00:00Z" }, jobRow: ROW, job: JOB, slug: SLUG, sentAt: SENT }).why, /outside this job's life/);
  // CONTROLS: tagged by this job, in its life.
  assert.equal(traceAttribution({ trace: { steps: tag(STEPS, JOB), started_at: IN_WINDOW }, jobRow: ROW, job: JOB, slug: SLUG, sentAt: SENT }).ok, true);
  assert.equal(jobTagOf(JOB), parseInt(JOB.slice(0, 12), 16));
  assert.notEqual(jobTagOf(JOB), jobTagOf(OTHER));
  assert.equal(jobTagOf("nope"), null);
});

test("AT 4 — THE SOURCE CHANGED AFTER COMPLETION: the press judges the job's own stored version (one page), never the site as it stands (two pages); an answer that is not that version is unverified and judges nothing; control", async () => {
  const io = net();
  const rec = await runBuildCheck(io, { spec: NI, spend: true, named: 783 });
  assert.ok(io.calls.includes(`source-job:${JOB}`), "the job's own version was not asked for");
  assert.ok(!io.calls.includes("source-now"), "the site as it stands was read for the verdict");
  assert.equal(by(rec, /source judged is this build's own stored version/).ok, true);
  assert.equal(by(rec, /front page among them/).ok, true, "the job version was not judged");
  assert.deepEqual([rec.sourceAttribution.version, rec.sourceAttribution.live], [VER, false]);
  // NOT THAT VERSION: an old route that ignores ?job= (no job, no version), a
  // pruned version (404), another job's version, an unreadable answer.
  for (const [answer, re] of [
    [{ status: 200, json: { ...TWO_PAGES, ok: true, slug: SLUG } }, /does not name this job's own version/],
    [{ status: 404, json: { ok: false, error: "no stored version of this site was staged by that job", versions: [] } }, /no stored version of this site was staged by that job/],
    [{ status: 404, json: { ok: false, error: "more than one stored version names that job", versions: [VER, VER2] } }, /more than one stored version names that job \(01790600000000-abc123, 01790600000001-def456\)/],
    [{ status: 200, json: { ...ONE_PAGE, ok: true, slug: SLUG, job: OTHER, version: VER } }, /does not name this job's own version/],
    [{ status: 503, json: { ok: false, error: "the site's versions could not be read" } }, /answered 503/],
    [null, /was not read/],
  ]) {
    const sa = sourceAttribution(answer, JOB);
    assert.deepEqual([sa.ok, sa.unverified], [false, true], JSON.stringify(answer));
    assert.match(sa.why, re);
    const r = await runBuildCheck(net({ sourceJob: async () => answer }), { spec: NI, spend: true, named: 783 });
    assert.equal(by(r, /source judged is this build's own stored version/).ok, false);
    assert.equal(by(r, /front page among them/).ok, false, "a source that is not this job's version was judged");
    assert.ok(r.unverified.some((x) => /attribution unverified/.test(x)));
  }
  // CONTROL: the version is the live one too.
  const live = sourceAttribution({ status: 200, json: { ...ONE_PAGE, ok: true, job: JOB, version: VER, live: { version: VER, job: JOB } } }, JOB);
  assert.deepEqual([live.ok, live.live], [true, true]);
});

// ── THE REAL WORKER'S ROUTE ──────────────────────────────────────────────────

let caseNo = 0;
async function callSource({ query = "", objects = {}, owner = "u-owner" } = {}) {
  const worker = await loadWorker();
  const slug = "gf-attr-" + (++caseNo);
  const store = new Map(Object.entries(objects(slug)));
  const reads = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json({ id: "u-owner" });
    if (u.includes("/rest/v1/site_backends")) return json(owner ? [{ uid: owner }] : []);
    return new Response("unavailable", { status: 503 });
  };
  const SITES_BUCKET = {
    async get(key) { reads.push(key); return store.has(key) ? { text: async () => store.get(key), etag: "e1" } : null; },
    async list({ prefix }) { return { objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1 })), truncated: false }; },
  };
  try {
    const req = new Request(`https://gofarther.dev/api/site/source?slug=${slug}${query}`, { headers: { Authorization: "Bearer t" } });
    const res = await worker.fetch(req, { SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET }, makeCtx());
    return { slug, status: res.status, body: await res.json().catch(() => null), reads };
  } finally { globalThis.fetch = real; }
}
/** A staged version as `stageBuild` writes it: a manifest naming its job, and its state's pages and parts. */
const version = (slug, ver, job, pages) => ({
  [`builds/${slug}/${ver}/manifest.json`]: JSON.stringify({ files: ["index.html"], at: 1, label: "Build", job, worker: true }),
  [`builds/${slug}/${ver}/state/pages.json`]: JSON.stringify(pages),
  [`builds/${slug}/${ver}/state/parts.json`]: JSON.stringify([]),
});
const ONE = [{ path: "src/routes/index.tsx", source: "ONE" }];
const EDITED = [{ path: "src/routes/index.tsx", source: "EDITED" }, { path: "src/routes/menu.tsx", source: "NEW" }];

test("AT 5 — THE REAL WORKER ANSWERS BY JOB: the version whose manifest names the job, from its own stored state (not the edited copy), with the live pointer; none, two, or a bad id each refused by name; the plain read carries the pointer", async () => {
  const objects = (slug) => ({
    ...version(slug, VER, JOB, ONE),
    ...version(slug, VER2, OTHER, EDITED),
    [`current/${slug}.json`]: JSON.stringify({ version: VER2, job: OTHER, build: "", parent: VER }),
    [`source/${slug}/pages.json`]: JSON.stringify(EDITED),
    [`source/${slug}/parts.json`]: JSON.stringify([]),
  });
  const mine = await callSource({ query: `&job=${JOB}`, objects });
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  assert.deepEqual([mine.body.ok, mine.body.job, mine.body.version], [true, JOB, VER]);
  assert.deepEqual(mine.body.pages, ONE, "the edited copy was answered instead of the job's own version");
  assert.deepEqual(mine.body.reads, { pages: true, parts: true });
  assert.deepEqual([mine.body.live, mine.body.liveRead], [{ version: VER2, job: OTHER }, true]);
  assert.ok(!mine.reads.includes(`source/${mine.slug}/pages.json`), "the editable copy was read for a by-job answer");
  assert.equal(sourceAttribution({ status: mine.status, json: mine.body }, JOB).ok, true, "the press does not accept the route's own answer");
  // NONE: a job that staged no version here.
  const none = await callSource({ query: `&job=${"c3".repeat(16)}`, objects });
  assert.equal(none.status, 404);
  assert.match(none.body.error, /no stored version of this site was staged by that job/);
  assert.equal(sourceAttribution({ status: none.status, json: none.body }, "c3".repeat(16)).unverified, true);
  // TWO: two versions name the same job.
  const two = await callSource({ query: `&job=${JOB}`, objects: (slug) => ({ ...version(slug, VER, JOB, ONE), ...version(slug, VER2, JOB, EDITED) }) });
  assert.equal(two.status, 404);
  assert.deepEqual(two.body.versions.sort(), [VER, VER2]);
  assert.equal((await callSource({ query: "&job=NOT-A-JOB", objects })).status, 400);
  // THE PLAIN READ: the site as it stands (the explorer's, unchanged — no
  // pointer read added to every Code-tab open), never a by-job answer the press accepts.
  const plain = await callSource({ objects });
  assert.equal(plain.status, 200);
  assert.deepEqual(plain.body.pages, EDITED);
  assert.ok(!plain.reads.includes(`current/${plain.slug}.json`), "the explorer's read gained a pointer read");
  assert.equal(sourceAttribution({ status: plain.status, json: plain.body }, JOB).ok, false);
  // No pointer: none live, said as read.
  const fresh = await callSource({ query: `&job=${JOB}`, objects: (slug) => version(slug, VER, JOB, ONE) });
  assert.deepEqual([fresh.status, fresh.body.live, fresh.body.liveRead], [200, null, true]);
});

test("AT 6 — THE BUILD'S PUBLISH MARK CARRIES ITS JOB TAG, as a number the trace keeps (worker.js `pages` mark, `jobTagOf(jobId)`)", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf('tr.at("pages", Object.fromEntries([');
  assert.ok(at > 0, "the publish mark is gone");
  const end = src.indexOf("]));", at);
  assert.ok(end > at);
  assert.match(src.slice(at, end), /\.\.\.\(jobTagOf\(jobId\) !== null \? \[\["jobTag", jobTagOf\(jobId\)\]\] : \[\]\)/);
  assert.ok(Number.isSafeInteger(jobTagOf("f".repeat(32))), "the tag is not a safe integer a trace keeps exactly");
});

test("AT 7 — PROMPT ACCEPTANCE AND RECOVERED TRACKING ARE TWO FACTS: a 202 with its job is prompt; a lost answer found by attempt is recovered; neither is none", async () => {
  assert.equal((await runBuildCheck(net(), { spec: NI, spend: true, named: 783 })).acceptance, "prompt");
  let listed = 0;
  const lost = await runBuildCheck(net({
    post: async function () { this.calls.push("post"); return { status: 0, json: null, why: "ECONNRESET" }; },
    builds: async () => { listed++; return { builds: [{ job: JOB, attempt: "bc-" + "e".repeat(32), state: "running" }] }; },
  }), { spec: { ...NI, reconcileMs: 60_000 }, spend: true, named: 783 });
  assert.equal(lost.acceptance, "recovered");
  assert.deepEqual(lost.accepted, { status: 0, job: "", stage: undefined, ms: 0, why: "ECONNRESET" });
  assert.ok(listed >= 1);
  const gone = await runBuildCheck(net({
    post: async function () { this.calls.push("post"); return { status: 0, json: null, why: "ECONNRESET" }; },
    builds: async () => ({ builds: [] }),
  }), { spec: { ...NI, reconcileMs: 12_000 }, spend: true, named: 783 });
  assert.equal(gone.acceptance, "none");
});
