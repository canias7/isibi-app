// PARKED (2026-11-03, park-old-way): the old-way half of test/parallel-publish-media.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// PARALLEL TASKS, EXPLICIT PUBLISH AND HOSTED MEDIA, TESTED TOGETHER
// (2026-10-16, branch `codex-work-into-claude`).
//
// Each case drives the real Worker with supplied model answers and small local
// media fixtures (`test/fixtures/media/`); nothing reaches a network, a model,
// a container or money.
//
//   PPM1  a recording REPLACED on a published site under DRAFT_FIRST, through
//         the real media routes: the replacement is held (the live address
//         keeps the old bytes, seeking included), the preview plays the new
//         bytes at the old address, the owner's list says what the draft will
//         do, and only the explicit Publish of that revision puts the new
//         bytes live — once. Before this batch the route read fields no
//         handler sends (`sid`, `file.name`): nothing was held and a separate
//         new file appeared while the panel said "Replaced".
//   PPM1c CONTROL — the switch off: the same replacement lands at the address
//         at once, as it always did.
//   PPM2  two independent page changes of one message, run side by side in
//         the site's container with only what each launch carried
//         (`containerEnvOf`), with DRAFT_FIRST and PARALLEL_WRITES on at the
//         Worker: their running intervals overlap, both land in the draft and
//         neither overwrites the other; a held row change saved after them is
//         a later revision; nothing is live before Publish; Publish of the
//         page revision makes exactly that live and leaves the later row
//         revision unpublished; a duplicate click redoes nothing; Publish of
//         the row revision applies the row once; each job is charged once.
//   PPM3  the request driver's own rules (unit): a part paused on the customer
//         holds no later part back when jobs run side by side; a running
//         conflicting part still does (negative control); a part that lost to
//         its own request's overlap runs again alone, bounded, and a refusal
//         that is not an overlap still fails (negative control); a draft save
//         that landed behind a newer draft is not committed or billed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorker, loadWorkerModule, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { withWire, envFor } from "../../../test/fixtures/live-ask.mjs";
import { mediaBucket } from "../../../test/fixtures/r2-media.mjs";
import { platform, sendMessage, pump, tick, call as callP, T } from "../../../test/fixtures/request-flow.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { installCompiler, getContainer } from "../../../test/fixtures/cf-containers.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "../../../test/fixtures/rows-db.mjs";
import { containerEnvOf, firingNamespace } from "../../../test/fixtures/fired-jobs.mjs";
import { MEDIA_PART_BYTES } from "../../../site-media.mjs";
import { DRAFT_KEY, saveAsDraft } from "../../../site-draft.mjs";
import { buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../../../site-builds.mjs";
import { clearToWrite, clearToPrepare } from "../../../builder/request-plan.mjs";
import { OVERLAP_RETRIES } from "../../../builder/request.mjs";

blockNetwork();

const TOKEN = "Bearer some-token";
const fixture = (n) => new Uint8Array(readFileSync(new URL("../../../test/fixtures/media/" + n, import.meta.url)));
const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));

async function hit(worker, env, method, host, path, { body, json, headers = {} } = {}) {
  const init = { method, headers: { Authorization: TOKEN, ...headers } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
  const res = await worker.fetch(new Request("https://" + host + path, init), env, makeCtx());
  const buf = new Uint8Array(await res.arrayBuffer());
  let parsed = null;
  try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
  return { status: res.status, headers: res.headers, bytes: buf, body: parsed };
}
const app = (worker, env, method, path, opts) => hit(worker, env, method, "gofarther.dev", path, opts);

/** The page's upload through the real routes: start, every part, finish. */
async function upload(worker, env, slug, bytes, name, extra = {}) {
  const base = "/api/site/" + slug + "/media";
  const st = await app(worker, env, "POST", base, { json: { name, size: bytes.length, type: "", ...extra } });
  if (st.status >= 300) return { st };
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await app(worker, env, "PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * MEDIA_PART_BYTES, n * MEDIA_PART_BYTES) });
    if (p.status >= 300) return { st, p };
    parts.push({ n, etag: p.body.etag });
  }
  const done = await app(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts } });
  return { st, done };
}

/** The same recording, other bytes: the sniffed head kept, the tail changed. */
function otherTake(bytes) {
  const b = new Uint8Array(bytes);
  for (let i = b.length - 64; i < b.length; i++) b[i] = b[i] ^ 0x5a;
  return b;
}

/** A published site: the pointer names a version with a manifest, as an activation leaves it. */
async function publishLive(store, slug, version) {
  const pre = buildPrefix(slug, version);
  await store.put(pre + MANIFEST_FILE, JSON.stringify({ files: ["index.html"], worker: true, build: "b0" }), { httpMetadata: { contentType: "application/json" } });
  await store.put(pre + SERVER_FILE, "export default {}", { httpMetadata: { contentType: "text/javascript" } });
  return store.put("current/" + slug + ".json", JSON.stringify({ version, build: "b0", parent: "", job: null, activatedAt: "2026-10-16T00:00:00.000Z" }), { httpMetadata: { contentType: "application/json" } });
}

// ── PPM2 ────────────────────────────────────────────────────────────────────

const HOME_FROM = "Bread from the harbour, every morning.";
const HOME_TO = "Open from 8 every morning.";
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const HEAD_FROM = "Come to the bakery";
const HEAD_TO = "Come and see us";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>" + HOME_FROM + "</p></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>" + HEAD_FROM + "</h1><p>" + TT_FROM + "</p></section>");
const PAGES2 = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const OPEN = "change the opening line on the home page to say we open at 8";
const HEADING = "Change the Visit page heading to Come and see us.";
const ROUTE_TWO = { intent: "edit", layer: "text", page: "/visit", alsoAsked: [OPEN], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["page:/"] }] };
const ROUTE_HOME = { intent: "edit", layer: "text", page: "/" };
const ROUTE_HEAD = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const ROUTE_DATA = { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] };
const said = (args) => String(args.messages[0].content);
const asked = (args, words) => said(args).includes("WHAT THEY ASKED FOR\n" + words);
const lineId = (args, file, line) => {
  const at = said(args).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const until = async (cond, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; await new Promise((ok) => setTimeout(ok, 10)); } return cond(); };

test("PPM2 PARALLEL WORK, ONE DRAFT, ONE APPROVED PUBLISH — two independent page changes of one message run side by side in the container (only what each launch carried) with DRAFT_FIRST and PARALLEL_WRITES on: their runs overlap, both stand in the draft, nothing is live; a row change saved after them is a later revision; Publish of the page revision makes exactly it live and leaves the row unpublished; a duplicate click redoes nothing; Publish of the row revision applies it once; each job charged once", async () => {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const seen = { visitHeld: false, homeSavedWhileVisitHeld: false, intervals: {}, routes: 0 };
  const ref = { P: null };
  const P = platform({
    slug: "ppm2-" + Math.random().toString(16).slice(2, 8), pages: PAGES2, db, liveScripts: true, beside: true, balance: 400,
    answers: {
      // THE ROUTER'S ANSWERS IN ORDER: the heading (published, switch off),
      // the two-page message, its held-back home part, the row change.
      route: () => [ROUTE_HEAD, ROUTE_TWO, ROUTE_HOME, ROUTE_DATA][Math.min(seen.routes++, 3)],
      [T.text]: async (args) => {
        if (asked(args, HEADING)) return { edits: [{ id: lineId(args, "visit.tsx", HEAD_FROM), to: HEAD_TO }] };
        if (asked(args, TIKTOK)) {
          // THE VISIT JOB'S CALL answers only once the home job's change is in
          // the DRAFT (the editable copy follows it) — the other job ran from
          // its claim to its draft save while this one waited inside its call.
          seen.visitHeld = true;
          seen.intervals.visit = [Date.now()];
          seen.homeSavedWhileVisitHeld = await until(() => (ref.P.page("index.tsx") || "").includes(HOME_TO));
          seen.intervals.visit.push(Date.now());
          return { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] };
        }
        seen.intervals.home = [Date.now()];
        const out = { edits: [{ id: lineId(args, "index.tsx", HOME_FROM), to: HOME_TO }] };
        seen.intervals.home.push(Date.now());
        return out;
      },
      write_row_changes: () => ({ changes: [{ table: "loaves", id: 2, values: { price: 5.6 } }] }),
    },
  });
  ref.P = P;
  const ns = firingNamespace((lane) => getContainer(null, lane));
  Object.assign(P.env, { JOB_RUNNER_EVERYONE: "on", SITE_SECRETS_KEY: "x".repeat(48), SITE_BUILD_CONTAINER: ns });
  const worker = await loadWorkerModule();
  const running = [];
  const ran = [];
  /** Every fired job run as its container runs it — NOT awaited one by one, so two can overlap. */
  const fireAll = () => {
    while (ns.launches.length) {
      const l = ns.launches.shift();
      const launch = JSON.parse(l.body);
      ran.push(launch.id);
      running.push(P.run(async () => {
        const ctx = makeCtx();
        await worker.runContainerJob(containerEnvOf(P.env, l.body), ctx, { kind: launch.kind, id: launch.id, holder: launch.holder || "" });
        await Promise.allSettled(ctx.pending);
      }));
    }
  };
  async function drive(key) {
    for (let i = 0; i < 40; i++) {
      await pump(P);
      fireAll();
      await new Promise((ok) => setTimeout(ok, 15));
      const rec = P.record(key);
      const busy = P.queue.length || ns.launches.length;
      if (!busy && rec && (rec.ended || rec.state !== "running")) break;
      if (!busy) { await Promise.race([Promise.allSettled(running), new Promise((ok) => setTimeout(ok, 40))]); if (!P.queue.length && !ns.launches.length) await tick(P); }
    }
    await Promise.allSettled(running);
    return P.record(key);
  }
  const live = () => { const t = P.readObj("current/" + P.slug + ".json"); return t ? JSON.parse(bare(t)).version : null; };
  const draft = () => { const t = P.readObj(DRAFT_KEY(P.slug)); return t ? JSON.parse(bare(t)) : null; };
  const price = (id) => Number(db.rows("loaves").find((l) => l.id === id).price);
  const reserves = (jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve");
  try {
    // PUBLISHED ONCE, the switch off: a live site to protect.
    const r0 = await sendMessage(P, { message: HEADING });
    assert.equal(r0.status, 200, JSON.stringify(r0.body));
    await drive(r0.key);
    const v0 = live();
    assert.ok(v0, "the first change published nothing — no live site to protect");
    const live0 = P.liveScript();
    const side0 = bare(P.readObj("sitemeta/" + P.slug + ".json"));
    const writes0 = db.writes().length;

    // THE SWITCHES ON AT THE WORKER; the jobs get only what a launch carries.
    P.env.DRAFT_FIRST = "on";
    const r1 = await sendMessage(P, { message: TIKTOK + ", and " + OPEN + "." });
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    const rec1 = await drive(r1.key);
    assert.deepEqual(rec1.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec1.parts.map((p) => [p.status, p.why])));
    const jobs1 = P.jobsOf(r1.key).filter((j) => j.op === "edit");
    assert.ok(jobs1.length === 2 && jobs1.every((j) => ran.includes(j.id)), "a job ran outside the container: " + JSON.stringify({ ran, jobs: jobs1.map((j) => j.id) }));
    // OVERLAP: the home job's whole run, to its draft save, fell inside the Visit job's call.
    assert.equal(seen.visitHeld, true, "the Visit job never reached its call");
    assert.equal(seen.homeSavedWhileVisitHeld, true, "the home change was not saved while the Visit job was running — nothing overlapped");
    assert.ok(seen.intervals.home[0] >= seen.intervals.visit[0] && seen.intervals.home[1] <= seen.intervals.visit[1], "the two jobs' running intervals do not intersect: " + JSON.stringify(seen.intervals));
    // ACCUMULATED, NOT OVERWRITTEN: both changes in the draft's editable copy.
    assert.ok(P.page("index.tsx").includes(HOME_TO) && P.page("visit.tsx").includes(TT_TO) && P.page("visit.tsx").includes(HEAD_TO), "a parallel result was lost from the draft: " + P.page("visit.tsx") + " / " + P.page("index.tsx"));
    const d1 = draft();
    assert.ok(d1 && d1.rev === 2, "two saving tasks, two revisions: " + JSON.stringify(d1 && d1.revs));
    // NOTHING LIVE.
    assert.equal(live(), v0, "the live pointer moved before Publish");
    assert.equal(P.liveScript(), live0, "the live script changed before Publish");
    assert.equal(bare(P.readObj("sitemeta/" + P.slug + ".json")), side0, "the live sidecar changed before Publish");
    // THE PREVIEW: the draft's newest code.
    assert.equal(P.previewScript(), d1.version, "the preview does not run the draft's newest version");

    // A ROW CHANGE SAVED AFTER: a later, held revision.
    const r2 = await sendMessage(P, { message: "Make the Dark Rye £5.60." });
    await drive(r2.key);
    const d2 = draft();
    assert.equal(d2.rev, 3, "the row change is not its own later revision: " + JSON.stringify(d2.revs));
    assert.equal(db.writes().length, writes0, "the held row change reached the live database before Publish");

    // PUBLISH REVISION 2 — the page changes the owner looked at.
    const pageRev = d2.revs.find((r) => r.n === 2);
    const pub = await callP(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 2, version: pageRev.version });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(live(), pageRev.version, "Publish did not make the approved revision live");
    assert.equal(P.liveScript(), pageRev.version, "the running script is not the approved revision's");
    assert.equal(price(2), 5.2, "the later row revision was taken into the earlier approval");
    const st = await callP(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.applied, st.body.unpublished, st.body.state], [2, true, "saved"], "the later revision does not stay saved and unpublished: " + JSON.stringify(st.body));
    // A DUPLICATE CLICK.
    const dup = await callP(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 2, version: pageRev.version });
    assert.deepEqual([dup.status, dup.body.already], [200, true], JSON.stringify(dup.body));
    const uploadsAfter = P.uploads().length;
    // PUBLISH REVISION 3: the row, once.
    const pub3 = await callP(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 3 });
    assert.equal(pub3.status, 200, JSON.stringify(pub3.body));
    assert.equal(price(2), 5.6, "Publish did not apply the held row change");
    const rowWrites = db.writes().length;
    const again = await callP(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 3 });
    assert.deepEqual([again.status, again.body.already], [200, true]);
    assert.equal(db.writes().length, rowWrites, "a repeated Publish wrote the row again");
    assert.ok(P.uploads().length >= uploadsAfter);

    // MONEY: each saving job charged once; Publish charges nothing.
    for (const j of [...jobs1, ...P.jobsOf(r2.key).filter((j) => j.op === "edit")]) {
      assert.equal(j.state, "done");
      assert.equal(reserves(j.id).length, 1, "job " + j.id + " was not charged exactly once");
    }
    assert.equal(P.ledger.filter((e) => /publish/i.test(String(e.ref))).length, 0, "Publish was charged");
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
});

// ── PPM3 ────────────────────────────────────────────────────────────────────

const part = (n, status, writes, extra = {}) => ({ n, at: n, needs: [], status, phase: "run", route: { op: "edit", layer: "text" }, targets: { writes, reads: [] }, jobs: [], ...extra });
const ENDED = ["done", "failed", "partial", "cancelled", "expired", "refused"];
const ended = (q) => ENDED.includes(q.status);
