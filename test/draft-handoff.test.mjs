// DRAFT-FIRST ACROSS THE CONTAINER HAND-OFF (2026-10-16).
//
// The integration plan found that `DRAFT_FIRST` reached the Worker but never
// a job run in the site's container: `JOB_ENV_NAMES` did not list it, and
// production runs every queued job there (`JOB_RUNNER_EVERYONE`). With the
// switch on, a container job would have read it off and published live.
//
//   DH1  the setting survives serialization into a job: `jobSecrets` → the
//        launch's JSON → `readLaunch` → `makeContainerEnv` → the Worker's own
//        readers (`jobSwitches`), on and off, for both publishing switches
//   DH2  the runtime route reports both switches at the Worker and as a job
//        is handed them (calculated), and the container's `env` probe reports
//        what a real job child read (observed), through the route's own launch
//   DH3  an Edit (a page line and a row) fired into the container with the
//        switch on saves drafts and changes nothing live; with it off it
//        publishes, as before
//   DH4  an Add-on (a new page) fired into the container: a draft with the
//        switch on, live with it off
//   DH5  a first Build's resume run with the container's env: a draft with
//        the switch on, live with it off
//
// Every case runs the real Worker with supplied model answers; nothing
// reaches a network, a container, a model or money. Each one fails on the
// earlier wiring, where `jobSecrets` dropped `DRAFT_FIRST`.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, tick, pump, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler, getContainer } from "./fixtures/cf-containers.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { buildBucket, GOOD_DESIGN } from "./fixtures/build-route.mjs";
import { ledger, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";
import { containerEnvOf, launchFor, firingNamespace } from "./fixtures/fired-jobs.mjs";
import { readLaunch, runJob } from "../builder/container-job.mjs";
import { makeContainerEnv } from "../builder/container-env.mjs";
import { jobSecrets, JOB_ENV_NAMES } from "../builder/edit-job.mjs";
import { DRAFT_KEY } from "../site-draft.mjs";

blockNetwork();

const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
const slugOf = (k) => "dh-" + k + "-" + Math.random().toString(16).slice(2, 8);

// ── DH1 ─────────────────────────────────────────────────────────────────────

test("DH1 THE SETTING SURVIVES SERIALIZATION INTO A JOB — jobSecrets, the launch's JSON, readLaunch and makeContainerEnv, then the Worker's own readers: DRAFT_FIRST and PARALLEL_WRITES read on in the job exactly when the Worker reads them on; unset, `off` and anything else read off", async () => {
  const worker = await loadWorkerModule();
  assert.equal(typeof worker.jobSwitches, "function", "the Worker module has no jobSwitches export — this case is watching nothing");
  const cases = [
    [{ DRAFT_FIRST: "on", PARALLEL_WRITES: "on" }, { draftFirst: true, parallelWrites: true }],
    [{ DRAFT_FIRST: "ON" }, { draftFirst: true, parallelWrites: false }],
    [{}, { draftFirst: false, parallelWrites: false }],
    [{ DRAFT_FIRST: "off", PARALLEL_WRITES: "off" }, { draftFirst: false, parallelWrites: false }],
    [{ DRAFT_FIRST: "yes" }, { draftFirst: false, parallelWrites: false }],
  ];
  for (const kind of ["edit", "build", "resume"]) {
    for (const [workerEnv, want] of cases) {
      // THE WORKER'S ANSWER AND THE JOB'S, from the same readers.
      assert.deepEqual(worker.jobSwitches(workerEnv), want, "the Worker reads " + JSON.stringify(workerEnv) + " wrongly");
      const launch = readLaunch(launchFor(workerEnv, { kind }));
      const jobEnv = makeContainerEnv({ secrets: launch.secrets, gateway: launch.gateway, sb: launch.sb });
      assert.deepEqual(worker.jobSwitches(jobEnv), want, kind + ": a container job reads " + JSON.stringify(workerEnv) + " as " + JSON.stringify(worker.jobSwitches(jobEnv)));
    }
  }
  assert.ok(JOB_ENV_NAMES.includes("DRAFT_FIRST"), "a container job is not handed DRAFT_FIRST");
  assert.ok(JOB_ENV_NAMES.includes("PARALLEL_WRITES"), "a container job is not handed PARALLEL_WRITES");
  // DEFAULT OFF IN THE DEPLOY: a missing secret falls back to `off`, never `on`.
  const deploy = (await import("node:fs")).readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(deploy, /DRAFT_FIRST: \$\{\{ secrets\.DRAFT_FIRST \|\| 'off' \}\}/, "the deploy does not deliver DRAFT_FIRST with an off fallback");
  assert.match(deploy, /\n\s+DRAFT_FIRST\n/, "DRAFT_FIRST is not in the deploy's secret list");
});

// ── DH2 ─────────────────────────────────────────────────────────────────────

test("DH2 THE FREE CHECK SEES BOTH SWITCHES — the runtime route answers them at the Worker and as a job is handed them (calculated); the route's own `env` probe launch, run by the container's runner, answers what the job child read (observed), carrying only the two switch names", async () => {
  const user = { id: "u-dh2", email: "dh2@example.com" };
  const slug = slugOf("rt");
  const real = globalThis.fetch;
  const fired = [];
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return Response.json(user);
    if (u.includes("/rest/v1/site_backends")) return Response.json([{ slug, uid: user.id }]);
    return Response.json([]);
  };
  try {
    const worker = await loadWorker();
    const mod = await loadWorkerModule();
    const container = { idFromName: (n) => n, get: () => ({ fetch: async (req) => { fired.push(await req.text()); return Response.json({ ok: true }); } }) };
    for (const [secrets, want] of [[{ DRAFT_FIRST: "on", PARALLEL_WRITES: "on" }, true], [{}, false]]) {
      const env = { DEPLOY_ID: "dh2", SITES_BUCKET: {}, SITE_BUILD_CONTAINER: container, SITE_SECRETS_KEY: "x".repeat(48), ...secrets };
      const ctx = makeCtx();
      const rt = await worker.fetch(new Request("https://gofarther.dev/api/site/runtime?slug=" + slug, { headers: { authorization: "Bearer t" } }), env, ctx);
      const j = await rt.json();
      assert.equal(rt.status, 200, JSON.stringify(j));
      assert.deepEqual([j.draftFirst, j.parallelWrites, j.jobDraftFirst, j.jobParallelWrites], [want, want, want, want], "the runtime route: " + JSON.stringify(j));
      // THE OBSERVED VALUE: the route fires the probe; the runner runs that very launch.
      fired.length = 0;
      const pr = await worker.fetch(new Request("https://gofarther.dev/api/site/job-probe", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ probe: "env" }) }), env, ctx);
      assert.equal(pr.status, 200, await pr.clone().text());
      assert.equal(fired.length, 1, "the probe was not fired at the container");
      const launch = readLaunch(fired[0]);
      assert.equal(launch.probe, "env", "the launch lost its probe shape on the way into the runner");
      assert.deepEqual(Object.keys(launch.secrets).sort(), Object.keys(secrets).sort(), "the env probe carried more than the publishing switches: " + JSON.stringify(Object.keys(launch.secrets)));
      const lines = [];
      const out = await runJob(launch, { importWorker: async () => mod, log: (l) => lines.push(l) });
      assert.equal(out.ok, true, JSON.stringify(out));
      assert.deepEqual([out.probe.draftFirst, out.probe.parallelWrites], [want, want]);
      const line = lines.find((l) => l.probe === "env");
      assert.ok(line && JSON.stringify(line).length < 120, "the observed answer is not one short tail line: " + JSON.stringify(line));
      assert.deepEqual([line.draftFirst, line.parallelWrites], [want, want]);
    }
  } finally { globalThis.fetch = real; }
});

// ── DH3, DH4: Edit and Add-on fired into the container ──────────────────────

const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TT_LATER = "Follow us on TikTok at @harbourloafbakery";
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf.";
const TIKTOK_LATER = "Change our TikTok link on the Visit page to @harbourloafbakery.";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const PAGES2 = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const ROUTE_DATA = { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] };
const ROUTE_ADD = { intent: "addon" };
const GIFT = "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/gift-vouchers')({ component: Page });\nfunction Page() { return (<main><h1>Gift vouchers</h1><p>Give a loaf.</p></main>); }\n";
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

function firedBakery(name) {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const said = (args) => String(args.messages[0].content);
  const P = platform({
    slug: slugOf(name), pages: PAGES2, db, liveScripts: true, balance: 400,
    answers: {
      route: (args) => (/TikTok/.test(said(args)) ? ROUTE_TEXT : /Gift/.test(said(args)) ? ROUTE_ADD : ROUTE_DATA),
      [T.text]: (args) => (/@harbourloafbakery/.test(said(args)) ? { edits: [{ id: lineId(args, "visit.tsx", TT_TO), to: TT_LATER }] } : { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }),
      write_row_changes: (args) => {
        const asked = (said(args).split("WHAT THEY ASKED FOR\n")[1] || "").split("\n")[0];
        const m = /£(\d+\.\d+)/.exec(asked);
        return { changes: [{ table: "loaves", id: 2, values: { price: m ? Number(m[1]) : 0 } }] };
      },
      [T.adds]: { kinds: ["page"] },
      "add:page": { page: [{ path: "/gift-vouchers", name: "Gift vouchers", purpose: "sell gift vouchers", sections: ["what a voucher buys"], components: ["card"] }] },
      [T.pages]: { pages: [{ path: "src/routes/gift-vouchers.tsx", source: GIFT }] },
    },
  });
  const ns = firingNamespace((lane) => getContainer(null, lane));
  Object.assign(P.env, { JOB_RUNNER_EVERYONE: "on", SITE_SECRETS_KEY: "x".repeat(48), SITE_BUILD_CONTAINER: ns });
  return { P, db, compiler, ns };
}

/** The queue, then every fired job run as its container runs it, until nothing is left. */
async function drive(P, ns, key, worker) {
  const ran = [];
  for (let i = 0; i < 14; i++) {
    await pump(P);
    for (let j = 0; j < 20 && ns.launches.length; j++) {
      const l = ns.launches.shift();
      const launch = JSON.parse(l.body);
      ran.push(launch.id);
      await P.run(async () => {
        const ctx = makeCtx();
        await worker.runContainerJob(containerEnvOf(P.env, l.body), ctx, { kind: launch.kind, id: launch.id, holder: launch.holder || "" });
        await Promise.allSettled(ctx.pending);
      });
    }
    const rec = P.record(key);
    if (!P.queue.length && !ns.launches.length && (!rec || rec.ended || rec.state !== "running")) break;
    if (!P.queue.length && !ns.launches.length) await tick(P);
  }
  return ran;
}

const liveVersion = (P) => { const t = P.readObj("current/" + P.slug + ".json"); return t ? JSON.parse(bare(t)).version : null; };
const draftOf = (P) => { const t = P.readObj(DRAFT_KEY(P.slug)); return t ? JSON.parse(bare(t)) : null; };
const price = (db, id) => Number(db.rows("loaves").find((l) => l.id === id).price);

async function sendFired(P, ns, worker, message) {
  const r = await sendMessage(P, { message });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const ran = await drive(P, ns, r.key, worker);
  const jobs = P.jobsOf(r.key);
  assert.ok(jobs.length > 0 && jobs.every((j) => ran.includes(j.id)), "a job ran in the Worker though the runner names everyone: " + JSON.stringify({ ran, jobs: jobs.map((j) => j.id) }));
  return { r, jobs };
}

async function finished(P, compiler) {
  await P.settle();
  assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  P.close(); compiler.uninstall();
}

test("DH3 AN EDIT FIRED INTO THE CONTAINER KEEPS THE DRAFT — published once with the switch off (live), then, with DRAFT_FIRST on at the Worker, a page line and a row change each run in the container with the env its launch carried: two draft revisions, the live pointer, script, sidecar and database untouched", async () => {
  const { P, db, compiler, ns } = firedBakery("edit-on");
  try {
    const worker = await loadWorkerModule();
    const first = await sendFired(P, ns, worker, TIKTOK);
    assert.equal(first.jobs[0].state, "done", JSON.stringify(first.jobs[0].result).slice(0, 300));
    const v0 = liveVersion(P);
    assert.ok(v0, "the first edit published nothing — the site is not live, so nothing here tests draft-first on a live site");
    const live0 = P.liveScript();
    const side0 = bare(P.readObj("sitemeta/" + P.slug + ".json"));
    const writes0 = db.writes().length;
    const price0 = price(db, 2);

    P.env.DRAFT_FIRST = "on";
    const a = await sendFired(P, ns, worker, TIKTOK_LATER);
    assert.equal(a.jobs[0].state, "done", JSON.stringify(a.jobs[0].result).slice(0, 400));
    const b = await sendFired(P, ns, worker, "Make the Dark Rye £5.60.");
    assert.equal(b.jobs[0].state, "done", JSON.stringify(b.jobs[0].result).slice(0, 400));

    const d = draftOf(P);
    assert.ok(d, "a container job with DRAFT_FIRST on at the Worker saved no draft — it published instead");
    assert.equal(d.rev, 2, "two tasks, two revisions: " + JSON.stringify(d.revs));
    assert.equal(liveVersion(P), v0, "the live pointer moved before Publish");
    assert.equal(P.liveScript(), live0, "the live script changed before Publish");
    assert.equal(bare(P.readObj("sitemeta/" + P.slug + ".json")), side0, "the live sidecar changed before Publish");
    assert.equal(db.writes().length, writes0, "the live database was written before Publish");
    assert.equal(price(db, 2), price0);
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.equal(st.status, 200, JSON.stringify(st.body));
    assert.deepEqual([st.body.state, st.body.unpublished, st.body.revision, st.body.applied], ["saved", true, 2, 0]);
  } finally { await finished(P, compiler); }
});

test("DH3c CONTROL — the same Edit fired into the container with DRAFT_FIRST unset publishes live, as before: no draft record, the pointer moves, the row is written", async () => {
  const { P, db, compiler, ns } = firedBakery("edit-off");
  try {
    const worker = await loadWorkerModule();
    const first = await sendFired(P, ns, worker, TIKTOK);
    assert.equal(first.jobs[0].state, "done", JSON.stringify(first.jobs[0].result).slice(0, 300));
    const v0 = liveVersion(P);
    assert.ok(v0, "the first edit published nothing");
    const a = await sendFired(P, ns, worker, TIKTOK_LATER);
    assert.equal(a.jobs[0].state, "done", JSON.stringify(a.jobs[0].result).slice(0, 400));
    const b = await sendFired(P, ns, worker, "Make the Dark Rye £5.60.");
    assert.equal(b.jobs[0].state, "done", JSON.stringify(b.jobs[0].result).slice(0, 400));
    assert.equal(draftOf(P), null, "a draft was saved with the switch off");
    assert.notEqual(liveVersion(P), v0, "the page change did not go live with the switch off");
    assert.equal(price(db, 2), 5.6, "the row change did not go live with the switch off");
    assert.match(P.page("visit.tsx"), /@harbourloafbakery/, "the page change was not stored with the switch off");
  } finally { await finished(P, compiler); }
});

test("DH4 AN ADD-ON FIRED INTO THE CONTAINER KEEPS THE DRAFT — with DRAFT_FIRST on at the Worker, a new page is saved as a draft revision; the live pointer and script do not move and the new page is not served live; with the switch off the same addition goes live", async () => {
  for (const on of [true, false]) {
    const { P, compiler, ns } = firedBakery(on ? "add-on" : "add-off");
    try {
      const worker = await loadWorkerModule();
      const first = await sendFired(P, ns, worker, TIKTOK);
      assert.equal(first.jobs[0].state, "done", JSON.stringify(first.jobs[0].result).slice(0, 300));
      const v0 = liveVersion(P);
      assert.ok(v0, "the first edit published nothing");
      const live0 = P.liveScript();
      if (on) P.env.DRAFT_FIRST = "on";
      const a = await sendFired(P, ns, worker, "Add a Gift vouchers page.");
      const job = a.jobs.find((j) => j.op === "addon") || a.jobs[0];
      assert.equal(job.state, "done", JSON.stringify(job.result).slice(0, 400));
      const d = draftOf(P);
      if (on) {
        assert.ok(d && d.rev >= 1, "a container add-on with DRAFT_FIRST on saved no draft — it published instead");
        assert.equal(liveVersion(P), v0, "the live pointer moved before Publish");
        assert.equal(P.liveScript(), live0, "the live script changed before Publish");
      } else {
        assert.equal(d, null, "a draft was saved with the switch off");
        assert.notEqual(liveVersion(P), v0, "the addition did not go live with the switch off");
      }
      assert.ok(P.page("gift-vouchers.tsx"), "the new page was not stored at all");
    } finally { await finished(P, compiler); }
  }
});

// ── DH5: a first Build's resume with the container's env ────────────────────

test("DH5 A FIRST BUILD'S RESUME WITH THE CONTAINER'S ENV — the resume is handed only what a launch carries (`jobSecrets` through `readLaunch`): with DRAFT_FIRST on at the Worker it saves revision 1 as a draft and makes nothing live; with it off it goes live", async () => {
  const FIRST_PAGE = "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main><h1>Fold Lane</h1><p>Opening hours: 7–2.</p></main>); }\n";
  for (const on of [true, false]) {
    const b = buildBucket();
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const led = ledger();
    const workerEnv = on ? { DRAFT_FIRST: "on" } : {};
    // THE HAND-OFF: only what the launch carries reaches the job.
    const handed = readLaunch(launchFor(workerEnv, { kind: "resume", id })).secrets;
    await fireInterim(b, id, led, { design: GOOD_DESIGN, env: handed });
    await finishResume(b, id, led, { credits: 400, source: FIRST_PAGE, env: handed });
    const slug = GOOD_DESIGN.slug;
    if (on) {
      assert.equal(b.store.has("current/" + slug + ".json"), false, "a first build in the container moved the pointer with DRAFT_FIRST on at the Worker");
      assert.ok(b.store.get(DRAFT_KEY(slug)), "a first build in the container saved no draft with DRAFT_FIRST on at the Worker");
      assert.equal(JSON.parse(b.store.get(DRAFT_KEY(slug))).rev, 1);
    } else {
      assert.ok(b.store.has("current/" + slug + ".json"), "the build did not go live with the switch off");
      assert.equal(b.store.has(DRAFT_KEY(slug)), false, "a draft was saved with the switch off");
    }
  }
});
