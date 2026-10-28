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
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { platform, sendMessage, pump, tick, call as callP, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler, getContainer } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { containerEnvOf, firingNamespace } from "./fixtures/fired-jobs.mjs";
import { MEDIA_PART_BYTES } from "../site-media.mjs";
import { DRAFT_KEY, saveAsDraft } from "../site-draft.mjs";
import { buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../site-builds.mjs";
import { clearToWrite, clearToPrepare } from "../builder/request-plan.mjs";
import { OVERLAP_RETRIES } from "../builder/request.mjs";

blockNetwork();

const TOKEN = "Bearer some-token";
const fixture = (n) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + n, import.meta.url)));
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

// ── PPM1 ────────────────────────────────────────────────────────────────────

test("PPM1 A RECORDING REPLACED UNDER DRAFT-FIRST, THROUGH THE REAL MEDIA ROUTES — held: the live address keeps the old bytes (seeking included), the preview plays the new bytes at the old address, the list says what the draft will do; only Publish of that revision puts the new bytes live, once", async () => {
  const worker = await loadWorker();
  const slug = "ppm-replace";
  const store = mediaBucket();
  // THE DISPATCH NAMESPACE the preview host needs to exist (it serves pages
  // from the draft's script; `/u/` goes through the platform's own route).
  const env = { ...envFor(store), SITE_WORKERS: { get: () => ({ fetch: async () => new Response("page") }) } };
  await withWire({}, async () => {
    const old = fixture("tone.mp3");
    const neu = otherTake(old);
    // THE ORIGINAL, uploaded before the site was live.
    const first = await upload(worker, env, slug, old, "Welcome.mp3", { meta: { duration: 2 } });
    assert.equal(first.done && first.done.status, 201, JSON.stringify(first.done && first.done.body));
    const name = first.done.body.name;
    const url = first.done.body.url;
    await publishLive(store, slug, "01790500000000-aaaaaa");

    // DRAFT-FIRST ON, THE SITE LIVE: the replacement.
    env.DRAFT_FIRST = "on";
    const rep = await upload(worker, env, slug, neu, "Welcome take 2.mp3", { replace: name, meta: { duration: 2 } });
    assert.equal(rep.st.status, 201, JSON.stringify(rep.st.body));
    assert.equal(rep.st.body.replacesInDraft, name, "the start was not paired with the file it replaces: " + JSON.stringify(rep.st.body));
    assert.notEqual(rep.st.body.name, name, "a held replacement was uploaded over the live address");
    assert.ok(rep.done.status < 300, JSON.stringify(rep.done.body));
    const d = rep.done.body;
    assert.deepEqual([d.held, d.replaces, d.url, d.draft && d.draft.published], [true, name, url, false], "the finish does not say the replacement is held in the draft: " + JSON.stringify(d));
    assert.ok(Number.isSafeInteger(d.draft.revision) && d.draft.revision > 0, "no draft revision was named");

    // THE LIVE SITE, UNCHANGED: whole, and a seek.
    for (const host of ["gofarther.dev", "gofarther.dev"]) {
      const whole = await hit(worker, env, "GET", host, url);
      assert.equal(whole.status, 200, host);
      assert.deepEqual(whole.bytes, old, host + ": the live address played the replacement before Publish");
      const seek = await hit(worker, env, "GET", host, url, { headers: { range: "bytes=" + (old.length - 64) + "-" } });
      assert.equal(seek.status, 206, host);
      assert.deepEqual(seek.bytes, old.subarray(old.length - 64), host + ": a seek on the live address reached the replacement's bytes");
    }

    // THE OWNER'S LIST: the stand-in marked.
    const list = await app(worker, env, "GET", "/api/site/" + slug + "/uploads");
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const stand = list.body.files.find((f) => f.name === d.name);
    assert.deepEqual([stand && stand.draft, stand && stand.replaces], ["replaces", name], "the list does not say what the draft will do: " + JSON.stringify(list.body.files));

    // THE PREVIEW: the new bytes at the OLD address, and a seek into them.
    const rec = JSON.parse(bare(await (await store.get(DRAFT_KEY(slug))).text()));
    assert.ok(rec.preview, "the draft has no preview token");
    const pv = slug + "--draft-" + rec.preview + ".gofarther.app";
    const pw = await hit(worker, env, "GET", pv, url);
    assert.equal(pw.status, 200, "the preview did not serve the recording: " + pw.status);
    assert.deepEqual(pw.bytes, neu, "the preview did not play the draft's replacement at the old address");
    const pseek = await hit(worker, env, "GET", pv, url, { headers: { range: "bytes=" + (neu.length - 64) + "-" } });
    assert.deepEqual([pseek.status, [...pseek.bytes]], [206, [...neu.subarray(neu.length - 64)]], "seeking in the preview did not reach the replacement's bytes");

    // THE EXPLICIT PUBLISH, of the revision the panel shows.
    const shown = await app(worker, env, "GET", "/api/site/" + slug + "/draft");
    assert.equal(shown.status, 200, JSON.stringify(shown.body));
    assert.equal(shown.body.revision, d.draft.revision);
    const pub = await app(worker, env, "POST", "/api/site/" + slug + "/publish", { json: { revision: shown.body.revision, version: shown.body.draft } });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const live = await hit(worker, env, "GET", "gofarther.dev", url);
    assert.deepEqual(live.bytes, neu, "Publish did not put the replacement at the address");
    const lseek = await hit(worker, env, "GET", "gofarther.dev", url, { headers: { range: "bytes=0-99" } });
    assert.deepEqual([lseek.status, [...lseek.bytes]], [206, [...neu.subarray(0, 100)]]);
    assert.equal(await store.head("uploads/" + slug + "/" + d.name), null, "the stand-in name was left in the library after Publish");
    // A DUPLICATE CLICK REDOES NOTHING.
    const again = await app(worker, env, "POST", "/api/site/" + slug + "/publish", { json: { revision: shown.body.revision } });
    assert.deepEqual([again.status, again.body && again.body.already], [200, true], JSON.stringify(again.body));
  });
});

test("PPM1c CONTROL — the switch off: the same replacement lands at the live address at once, with no draft", async () => {
  const worker = await loadWorker();
  const slug = "ppm-replace-off";
  const store = mediaBucket();
  const env = envFor(store);
  await withWire({}, async () => {
    const old = fixture("tone.mp3");
    const neu = otherTake(old);
    const first = await upload(worker, env, slug, old, "Welcome.mp3");
    const name = first.done.body.name;
    await publishLive(store, slug, "01790500000000-aaaaaa");
    const rep = await upload(worker, env, slug, neu, "Welcome take 2.mp3", { replace: name });
    assert.equal(rep.st.body.name, name, "with the switch off a replacement keeps its address");
    assert.ok(rep.done.status < 300, JSON.stringify(rep.done.body));
    assert.notEqual(rep.done.body.held, true);
    const live = await hit(worker, env, "GET", "gofarther.dev", first.done.body.url);
    assert.deepEqual(live.bytes, neu, "with the switch off the replacement did not land at once");
    assert.equal(await store.get(DRAFT_KEY(slug)), null, "a draft was saved with the switch off");
  });
});

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

test("PPM3a A PART PAUSED ON THE CUSTOMER HOLDS NO LATER PART BACK — side by side, an earlier part waiting on a question (or an approval, or a purchase nobody can tell) on the same page does not keep a later ready part from being filed or prepared; a RUNNING part on that page still does (negative control)", () => {
  for (const pausedAs of ["waiting", "approval", "uncertain"]) {
    const parts = [part(0, pausedAs, ["page:/visit"]), part(1, "ready", ["page:/visit"])];
    assert.equal(clearToWrite(parts, 1, ended, () => false), true, pausedAs + ": a paused earlier part held a later one back");
    assert.equal(clearToPrepare(parts, 1, ended), true, pausedAs + ": a paused earlier part held a later preparation back");
  }
  const running = [part(0, "started", ["page:/visit"]), part(1, "ready", ["page:/visit"])];
  assert.equal(clearToWrite(running, 1, ended, (q) => q.status === "started"), false, "a running part on the same page did not hold a later one back");
  const ready = [part(0, "ready", ["page:/visit"]), part(1, "ready", ["page:/visit"])];
  assert.equal(clearToWrite(ready, 1, ended, () => false), false, "an earlier ready part on the same page did not keep its place in the order");
  // A PART THAT LOST AN OVERLAP RUNS ALONE.
  const serial = [part(0, "started", ["page:/"]), part(1, "ready", ["page:/visit"], { serial: true })];
  assert.equal(clearToWrite(serial, 1, ended, (q) => q.status === "started"), false, "a part running again after an overlap was filed beside another writer");
  const besideSerial = [part(0, "started", ["page:/"], { serial: true }), part(1, "ready", ["page:/visit"])];
  assert.equal(clearToWrite(besideSerial, 1, ended, (q) => q.status === "started"), false, "a writer was filed beside a part running again alone");
  const free = [part(0, "started", ["page:/"]), part(1, "ready", ["page:/visit"])];
  assert.equal(clearToWrite(free, 1, ended, (q) => q.status === "started"), true, "independent parts no longer run side by side");
});

test("PPM3b A DRAFT SAVE THAT LANDED BEHIND A NEWER DRAFT IS NOT COMMITTED OR BILLED — code only: refused `older`, its commit never runs, the newer draft stands; WITH HELD CHANGES (Codex's reproduction, 2026-10-16): refused too, nothing written — no revision of its held changes on the newer code — and its commit never runs", async () => {
  const store = new Map();
  const deps = {
    get: async (k) => (store.has(k) ? { body: store.get(k).body, etag: store.get(k).etag, text: async () => store.get(k).body } : null),
    put: async (k, body, _ct, cond = {}) => {
      const cur = store.get(k);
      if (cond.etagMatches && (!cur || cur.etag !== cond.etagMatches)) return null;
      if (cond.etagDoesNotMatch === "*" && cur) return null;
      const etag = String(Math.random());
      store.set(k, { body: String(body), etag });
      return { etag };
    },
  };
  const slug = "ppm3b";
  const NEW = "01790600000000-bbbbbb", OLD = "01790500000000-aaaaaa";
  let commits = 0;
  const first = await saveAsDraft(deps, { slug, version: NEW, commit: async () => { commits++; } });
  assert.equal(first.ok, true, JSON.stringify(first));
  const late = await saveAsDraft(deps, { slug, version: OLD, commit: async () => { commits++; } });
  assert.deepEqual([late.ok, late.error], [false, "older"], "an older code-only save was answered as saved: " + JSON.stringify(late));
  assert.equal(commits, 1, "the older save's job was committed (and so billed) though the draft does not hold its change");
  const rec = JSON.parse(store.get(DRAFT_KEY(slug)).body);
  assert.equal(rec.version, NEW, "the older save replaced the newer draft");
  const recBefore = store.get(DRAFT_KEY(slug)).body;
  const withHeld = await saveAsDraft(deps, { slug, version: OLD, held: { id: "a".repeat(24), ops: [{ kind: "row", table: "loaves", id: 2, values: { price: 6 } }] }, commit: async () => { commits++; } });
  assert.deepEqual([withHeld.ok, withHeld.error], [false, "older"], "an older save carrying held changes was answered as saved: " + JSON.stringify(withHeld));
  assert.equal(commits, 1, "the older mixed save was committed (and so billed) though the draft holds neither its code nor, rightly, its held changes");
  assert.equal(store.get(DRAFT_KEY(slug)).body, recBefore, "the older mixed save wrote the draft record (a revision of its held changes on the newer code)");
  // CONTROL: the same held save on the NEWEST code is a revision, committed once.
  const NEWER = "01790700000000-cccccc";
  const fresh = await saveAsDraft(deps, { slug, version: NEWER, held: { id: "b".repeat(24), ops: [{ kind: "row", table: "loaves", id: 2, values: { price: 6 } }] }, commit: async () => { commits++; } });
  assert.equal(fresh.ok, true, JSON.stringify(fresh));
  assert.equal(commits, 2);
  const after = JSON.parse(store.get(DRAFT_KEY(slug)).body);
  assert.deepEqual(after.revs.map((r) => [r.version, !!r.held]), [[NEW, false], [NEWER, true]], "the revisions are not the newer code and then the held save on the newest code: " + JSON.stringify(after.revs));
});

test("PPM3c THE OVERLAP RETRY IS BOUNDED", () => {
  assert.ok(Number.isInteger(OVERLAP_RETRIES) && OVERLAP_RETRIES >= 1 && OVERLAP_RETRIES <= 3, "the overlap retry is not a small bound: " + OVERLAP_RETRIES);
});

// ── PPM4: the probe's observed answer, Back online under a draft ────────────

test("PPM4a THE CONTAINER'S OWN ANSWER IS READ STRICTLY — the env probe's line read from a record's tail (a JSON string, a prefixed log line or an object); a line missing a switch, a non-boolean, garbage or an empty tail is NOT observed (null), never read as off", async () => {
  const { envObserved } = await import("../builder/job-probe.mjs");
  assert.deepEqual(envObserved(['{"probe":"env","draftFirst":true,"parallelWrites":false}']), { probe: "env", draftFirst: true, parallelWrites: false });
  assert.deepEqual(envObserved(["job 1: " + JSON.stringify({ probe: "env", draftFirst: false, parallelWrites: true })]), { probe: "env", draftFirst: false, parallelWrites: true });
  assert.deepEqual(envObserved([{ probe: "env", draftFirst: true, parallelWrites: true }]), { probe: "env", draftFirst: true, parallelWrites: true });
  assert.deepEqual(envObserved(['{"probe":"env","draftFirst":false,"parallelWrites":false}', "{not json", '{"probe":"env","draftFirst":true,"parallelWrites":true}']), { probe: "env", draftFirst: true, parallelWrites: true }, "the last answer is not the one read");
  for (const bad of [[], null, ["nothing"], ['{"probe":"env","draftFirst":true}'], ['{"probe":"env","draftFirst":"on","parallelWrites":false}'], ['{"probe":"hold","draftFirst":true,"parallelWrites":true}']]) {
    assert.equal(envObserved(bad), null, "read as observed: " + JSON.stringify(bad));
  }
});

test("PPM4b BACK ONLINE NEVER PUBLISHES THE DRAFT — under draft-first the recompile refuses (`draftOnly`) and the owner is told nothing changed and why; the Worker's recompile asks the switch before it reads the editable copy (the draft)", async () => {
  const { putBackOnline } = await import("../site-live.mjs");
  let rebuilt = 0;
  const out = await putBackOnline({
    versions: async () => [],
    hasSource: async () => true,
    recompile: async () => { rebuilt++; return { ok: false, draftOnly: true }; },
  }, { slug: "ppm4b" });
  assert.equal(rebuilt, 1);
  assert.deepEqual([out.ok, out.reason], [false, "draft"], JSON.stringify(out));
  assert.match(out.msg, /draft you haven't approved/);
  assert.doesNotMatch(out.msg, /Back online/);
  // CONTROL: a recompile that published is still back online.
  const ok = await putBackOnline({ versions: async () => [], hasSource: async () => true, recompile: async () => ({ ok: true, files: 1 }) }, { slug: "ppm4b" });
  assert.equal(ok.ok, true);
  // THE WORKER'S RECOMPILE, landmark to landmark.
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("              recompile: async ({ slug }) => {");
  const b = src.indexOf("loadSiteSourceForEdit(env, slug, { checked: true })", a);
  assert.ok(a > 0 && b > a, "the Back online recompile was not found — this case watches nothing");
  assert.match(src.slice(a, b), /if \(draftFirst\(env\)\) return \{ ok: false, draftOnly: true \};/, "the Back online recompile reads the editable copy (the draft) under draft-first");
});
