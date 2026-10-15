// DRAFT-FIRST, THE COMBINED BATCH (owner, 2026-10-15): "every builder-made
// change to a site must save to a persistent draft and appear in the
// builder's preview. Visitors keep seeing the last published version until
// the owner explicitly clicks Publish."
//
// Each case drives the real Worker (`worker.js`) over stand-ins that
// remember: the R2 double with conditional writes, the site database
// (`rows-db.mjs`), the dispatch namespace. The model's answers are SUPPLIED —
// what is shown is what the code does with an answer, never how a real model
// answers. Nothing here reaches a network, a container, a model or money.
//
//   DFB1  a first build stays unpublished: a draft, no pointer, no live script
//   DFB2  repeated edits before publishing — code, rows changed and added —
//         each a revision; the next task reads the draft; nothing live moves
//   DFB3  Publish releases the revision named (a later one stays a draft),
//         the held rows applied once; edits after publication are held again
//   DFB4  a duplicate click, a publication that stops part-way and is pressed
//         again, a dead publication's lock taken over, another's refused
//   DFB5  the preview: the draft's rows, the draft's library, and every write
//         or side effect refused; a live address shows the live data
//   DFB6  the library: a picture taken off and a recording replaced are held;
//         the live address keeps serving them until Publish
//   DFB7  backend writes are held only where a live site would see them;
//         scheduled jobs are held even before the first publication
//   DFB8  reload: the draft, its revisions and a publication in progress read
//         back the same; no automatic path calls Publish
//   DFB9  an ordinary conversation changes nothing and needs no Publish
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { page as pageSrc, withWire, routeCall, envFor, bucket as askBucket, freshSlug } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { buildBucket, GOOD_DESIGN } from "./fixtures/build-route.mjs";
import { ledger, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";
import { buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../site-builds.mjs";
import { DRAFT_KEY, HELD_KEY, PUBLISHING_KEY, publishPlan, rowsOverlay } from "../site-draft.mjs";
import { resultKey } from "../builder/build-job.mjs";

blockNetwork();

const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
const slugOf = (k) => "dfb-" + k + "-" + Math.random().toString(16).slice(2, 8);
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const POINTER = (P) => "current/" + P.slug + ".json";
const draftOf = (P) => { const t = P.readObj(DRAFT_KEY(P.slug)); return t ? JSON.parse(bare(t)) : null; };
const liveVersion = (P) => JSON.parse(bare(P.readObj(POINTER(P)))).version;

// ── THE SITE: a bakery with a Visit page and a `loaves` list ────────────────
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TT_LATER = "Follow us on TikTok at @harbourloafbakery";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const PAGES2 = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const ROUTE_DATA = { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] };
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf.";
const TIKTOK_LATER = "Change our TikTok link on the Visit page to @harbourloafbakery.";
const RYE = "Make the Dark Rye £5.60.";
const SPELT = "Add a Spelt loaf at £6.20.";
const SPELT_MORE = "Make the Spelt £6.50.";
const WALNUT = "Make the Walnut Levain £6.40.";

/** What the data step's model was shown, per call: the rows of `loaves`, as JSON lines. */
const shownRows = [];
function bakery(name, { draftFirst = false } = {}) {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  let tt = 0;
  const said = (args) => String(args.messages[0].content);
  const P = platform({
    slug: slugOf(name), pages: PAGES2, db, liveScripts: true,
    answers: {
      route: (args) => (/TikTok/.test(said(args)) ? ROUTE_TEXT : ROUTE_DATA),
      [T.text]: (args) => { const pairs = [[TT_FROM, TT_TO], [TT_TO, TT_LATER], [TT_LATER, TT_TO]]; const [from, to] = pairs[Math.min(tt++, pairs.length - 1)]; return { edits: [{ id: lineId(args, "visit.tsx", from), to }] }; },
      write_row_changes: (args) => {
        const text = said(args);
        shownRows.push(text);
        const asked = (text.split("WHAT THEY ASKED FOR\n")[1] || "").split("\n")[0];
        if (asked.startsWith("Make the Dark Rye")) return { changes: [{ table: "loaves", id: 2, values: { price: 5.6 } }] };
        if (asked.startsWith("Add a Spelt")) return { changes: [{ table: "loaves", values: { name: "Spelt", price: 6.2 } }] };
        if (asked.startsWith("Make the Spelt")) {
          // THE HELD NEW ROW, by the id the draft gave it (negative): found in what it was shown.
          const m = /id (-\d+): name="Spelt"/.exec(text);
          return { changes: [{ table: "loaves", id: m ? Number(m[1]) : 999, values: { price: 6.5 } }] };
        }
        if (asked.startsWith("Make the Walnut")) return { changes: [{ table: "loaves", id: 5, values: { price: 6.4 } }] };
        return { changes: [] };
      },
    },
  });
  if (draftFirst) P.env.DRAFT_FIRST = "on";
  return { P, db, compiler };
}
async function runOne(P, message) {
  const r = await sendMessage(P, { message });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await settle(P, r.key, { rounds: 20 });
  const jobs = P.jobsOf(r.key).filter((j) => j.op === "edit");
  return { r, jobs, body: jobs[0] && jobs[0].result ? JSON.parse(jobs[0].result.body) : null };
}
async function finish(P, compiler) {
  await P.settle();
  assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  P.close(); compiler.uninstall();
}
const price = (db, id) => Number(db.rows("loaves").find((l) => l.id === id).price);
const spelt = (db) => db.rows("loaves").filter((l) => l.name === "Spelt");

test("DFB2 REPEATED EDITS BEFORE PUBLISHING — a price changed, a loaf added, the added loaf changed again, a page line changed: each a revision of the draft; the next task reads the draft (the new price, the held new loaf); the live database, pointer, script and sidecar never move", async () => {
  const { P, db, compiler } = bakery("dfb2");
  try {
    // PUBLISHED ONCE, before the switch: the live site visitors use.
    const first = await runOne(P, TIKTOK);
    assert.equal(first.jobs[0].state, "done", JSON.stringify(first.jobs[0].result).slice(0, 300));
    const v0 = liveVersion(P);
    const live0 = P.liveScript();
    const side0 = bare(P.readObj("sitemeta/" + P.slug + ".json"));
    P.env.DRAFT_FIRST = "on";
    const writes0 = db.writes().length;

    const a = await runOne(P, RYE);
    assert.equal(a.jobs[0].state, "done", JSON.stringify(a.jobs[0].result).slice(0, 400));
    assert.equal(price(db, 2), 5.2, "a held price change was written to the live database");
    assert.deepEqual([a.body.draft && a.body.draft.published, a.body.draft && a.body.draft.held], [false, true], "the answer does not say the change is saved to the draft and not published: " + JSON.stringify(a.body.draft));
    let d = draftOf(P);
    assert.equal(d.rev, 1);
    assert.equal(d.revs[0].version, v0, "a rows-only revision is not on the live code");
    assert.ok(d.revs[0].held && P.readObj(HELD_KEY(P.slug, d.revs[0].held)), "the held rows were not written as the revision's journal");

    const b = await runOne(P, SPELT);
    assert.equal(b.jobs[0].state, "done", JSON.stringify(b.jobs[0].result).slice(0, 400));
    // THE NEXT TASK READ THE DRAFT: the Dark Rye at 5.6 in what it was shown.
    assert.match(shownRows[shownRows.length - 1], /id 2: name="Dark Rye"[^\n]*price=5\.6/, "the second task was shown the live price, not the draft's");
    assert.equal(spelt(db).length, 0, "a held new row was written to the live database");

    const c = await runOne(P, SPELT_MORE);
    assert.equal(c.jobs[0].state, "done", JSON.stringify(c.jobs[0].result).slice(0, 400));
    assert.match(shownRows[shownRows.length - 1], /id -1: name="Spelt"/, "the held new loaf was not shown to the next task, by its draft id");

    const t = await runOne(P, TIKTOK_LATER);
    assert.equal(t.jobs[0].state, "done", JSON.stringify(t.jobs[0].result).slice(0, 400));
    assert.deepEqual([t.body.checks.published, t.body.checks.draft], [false, true]);
    d = draftOf(P);
    assert.equal(d.rev, 4, "four tasks, four revisions: " + JSON.stringify(d.revs));
    assert.notEqual(d.revs[3].version, v0, "the page change did not save a new code version");

    // NOTHING LIVE MOVED.
    assert.equal(db.writes().length, writes0, "the live database was written: " + JSON.stringify(db.writes().slice(writes0).map((w) => w.query.slice(0, 60))));
    assert.equal(liveVersion(P), v0);
    assert.equal(P.liveScript(), live0);
    assert.equal(bare(P.readObj("sitemeta/" + P.slug + ".json")), side0);
    // THE OWNER SEES IT SAVED, NOT PUBLISHED, WITH EVERY REVISION.
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.equal(st.status, 200, JSON.stringify(st.body));
    assert.deepEqual([st.body.state, st.body.unpublished, st.body.revision, st.body.applied, st.body.revisions.length], ["saved", true, 4, 0, 4]);
  } finally { await finish(P, compiler); }
});

test("DFB3 PUBLISH RELEASES THE REVISION NAMED — revision 2 (two row changes) goes live alone: its rows applied, revision 3's change and revision 4's page are not; then revision 4 goes live with the held change to the new loaf found by its id; an edit after publication is held again", async () => {
  const { P, db, compiler } = bakery("dfb3");
  try {
    await runOne(P, TIKTOK);
    const v0 = liveVersion(P);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, RYE);
    await runOne(P, SPELT);
    await runOne(P, SPELT_MORE);
    await runOne(P, TIKTOK_LATER);
    const d4 = draftOf(P);

    const p2 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 2, version: d4.revs[1].version });
    assert.equal(p2.status, 200, JSON.stringify(p2.body));
    assert.equal(price(db, 2), 5.6, "revision 1's price is not live");
    assert.deepEqual(spelt(db).map((r) => Number(r.price)), [6.2], "revision 2's new loaf is not live, or went in twice, or carried revision 3's price");
    assert.equal(liveVersion(P), v0, "a rows-only publication moved the pages");
    assert.equal(P.page("visit.tsx").includes(TT_LATER), true, "Publish rewrote the editable copy");
    assert.deepEqual([p2.body.state.state, p2.body.state.applied, p2.body.state.revisions.length], ["saved", 2, 2]);
    const id = spelt(db)[0].id;
    assert.equal(draftOf(P).refs[Object.keys(draftOf(P).refs)[0]], id, "the new loaf's id was not recorded for later revisions");

    // A REVISION ALREADY PUBLISHED IS NOT PUBLISHED AGAIN.
    const again = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 1 });
    assert.deepEqual([again.status, again.body.already], [200, true]);
    assert.equal(spelt(db).length, 1);

    const p4 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 4, version: d4.revs[3].version });
    assert.equal(p4.status, 200, JSON.stringify(p4.body));
    assert.equal(liveVersion(P), d4.revs[3].version, "revision 4's pages are not live");
    assert.equal(P.liveScript(), d4.revs[3].version);
    assert.deepEqual(spelt(db).map((r) => [r.id, Number(r.price)]), [[id, 6.5]], "the held change to the new loaf did not reach it by its id");
    assert.equal(p4.body.state.state, "published");

    // AN EDIT AFTER PUBLICATION IS HELD AGAIN.
    const w = await runOne(P, WALNUT);
    assert.equal(w.jobs[0].state, "done");
    assert.equal(price(db, 5), 6, "an edit after publication went live");
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.state, st.body.revision, st.body.applied], ["saved", 5, 4]);

    // AN UNKNOWN REVISION, OR A VERSION THAT DOES NOT MATCH IT, IS REFUSED.
    assert.equal((await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 99 })).status, 409);
    assert.equal((await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 5, version: v0 + "x" })).status, 409);
    assert.equal((await call(P, "POST", "/api/site/" + P.slug + "/publish", {})).status, 400);
    assert.equal(price(db, 5), 6);
  } finally { await finish(P, compiler); }
});

test("DFB4 DUPLICATE CLICKS AND A FAILED PUBLICATION — two clicks at once publish once (the other is told it is under way, or already done); a publication whose script is refused stops after the rows, says so, and Publish pressed again finishes without adding the rows twice; a dead publication's lock is taken over; another revision's live lock is refused", async () => {
  const { P, db, compiler } = bakery("dfb4");
  try {
    await runOne(P, TIKTOK);
    const v0 = liveVersion(P);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    await runOne(P, TIKTOK_LATER);
    const d = draftOf(P);

    // A PUBLICATION THAT STOPS PART-WAY: the script upload refused.
    let refuse = true;
    P.beforeUpload(async (u) => { if (refuse && !String((u && u.name) || "").startsWith("draft-")) throw new Error("upload refused"); });
    const stop = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 2 });
    assert.notEqual(stop.status, 200, "a publication whose script was refused answered success");
    assert.match(String(stop.body.error), /Publish again|press Publish/i, "the stop does not say what to do: " + JSON.stringify(stop.body));
    assert.equal(liveVersion(P), v0, "the pointer moved on a refused script");
    assert.equal(spelt(db).length, 1, "the rows step did not run before the stop (the case needs it to)");
    assert.equal(draftOf(P).applied, 0, "a stopped publication was marked published");
    assert.equal(P.readObj(PUBLISHING_KEY(P.slug)), null, "the stopped publication kept its lock");
    refuse = false;
    const done = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 2 });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(spelt(db).length, 1, "Publish pressed again added the rows twice");
    assert.equal(liveVersion(P), d.revs[1].version);

    // TWO CLICKS AT ONCE on the next revision.
    await runOne(P, WALNUT);
    const [x, y] = await Promise.all([
      call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 3 }),
      call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 3 }),
    ]);
    const statuses = [x.status, y.status].sort();
    assert.ok(statuses[0] === 200 && (statuses[1] === 202 || (statuses[1] === 200 && (x.body.already || y.body.already))), "two clicks did not publish once: " + JSON.stringify([x.status, x.body, y.status, y.body]));
    assert.equal(price(db, 5), 6.4);

    // A DEAD PUBLICATION'S LOCK IS TAKEN OVER; ANOTHER REVISION'S LIVE LOCK IS NOT.
    await runOne(P, RYE);
    P.writeObj(PUBLISHING_KEY(P.slug), JSON.stringify({ n: 9, id: "dead", at: Date.now() - 60 * 60 * 1000 }));
    const over = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 4 });
    assert.equal(over.status, 200, "a dead publication's lock stopped the owner for good: " + JSON.stringify(over.body));
    await runOne(P, SPELT_MORE);
    P.writeObj(PUBLISHING_KEY(P.slug), JSON.stringify({ n: 9, id: "other", at: Date.now() }));
    const busy = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 5 });
    assert.equal(busy.status, 409, "a revision was published over another's publication in progress: " + JSON.stringify(busy.body));
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.equal(st.body.state, "publishing", "a publication in progress is not shown as such");
  } finally { await finish(P, compiler); }
});

// ── THE PREVIEW AND THE LIBRARY, OVER A STAND-IN THAT ANSWERS THE DATA API ───
const OWNER = { id: "u-draft-first-1", email: "owner@example.com" };
const V0 = "01790000000001-aaaaaa";
const TOKEN12 = "0123456789ab";
const HID = "a".repeat(24);
const PICTURE = "b".repeat(32) + ".png";
const SONG = "c".repeat(32) + ".mp3";
const SONG_NEW = "d".repeat(32) + ".mp3";
const DATA_API = "https://ep-draft.apirest.example.neon.tech/neondb/rest/v1";
function previewSite(slug, ops) {
  const pre = buildPrefix(slug, V0);
  const store = buildBucket({
    ["current/" + slug + ".json"]: JSON.stringify({ version: V0, build: "b0", parent: "", job: null, activatedAt: "2026-10-15T00:00:00.000Z" }),
    [pre + MANIFEST_FILE]: JSON.stringify({ files: ["index.html"], worker: true, build: "b0" }),
    [pre + SERVER_FILE]: "export default {}",
    [DRAFT_KEY(slug)]: JSON.stringify({ v: 2, version: V0, build: "", base: V0, job: null, at: "", history: [], preview: TOKEN12, rev: ops.length ? 1 : 0, revs: ops.length ? [{ n: 1, version: V0, at: "", job: null, held: HID, ops: ops.length }] : [], applied: 0, refs: {} }),
    ...(ops.length ? { [HELD_KEY(slug, HID)]: JSON.stringify({ v: 1, id: HID, ops }) } : {}),
    ["uploads/" + slug + "/" + PICTURE]: "a picture",
    ["uploads/" + slug + "/" + SONG]: "the old recording",
    ["uploads/" + slug + "/" + SONG_NEW]: "the new recording",
  });
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }), data_api: JSON.stringify({ url: DATA_API }) } });
  const dispatched = [];
  const env = {
    SITES_BUCKET: store, DRAFT_FIRST: "on", SUPABASE_SERVICE_KEY: "svc", ANTHROPIC_API_KEY: "k",
    // THE ROUTE CACHE the data proxy reads first: this site's database.
    SITE_ROUTES: { get: async () => "postgres://u:p@ep-draft.neon.tech/neondb", put: async () => {} },
    SITE_WORKERS: { get: (name) => ({ fetch: async (req) => { dispatched.push({ name, path: new URL(req.url).pathname, preview: req.headers.get("x-site-preview") }); return new Response("page", { status: 200 }); } }) },
  };
  const upstream = [];
  const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  const fetchStub = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (url.startsWith(DATA_API)) {
      upstream.push({ method, url });
      if (site.failData) return json(site.failData.body, site.failData.status);
      if (method !== "GET") return json({ wrote: true }, 201);
      return json(db.rows("loaves"));
    }
    if (url.includes("/auth/v1/user")) return json(OWNER);
    if (url.includes("/rest/v1/site_backends")) return json([{ uid: OWNER.id, slug, brief: "", neon_db: "site_" + slug.replace(/-/g, "_") }]);
    if (url.includes("/rest/v1/site_project")) return json([{ uid: OWNER.id, neon_conn: "postgres://u:p@ep-draft.neon.tech/neondb" }]);
    if (url.includes("/rest/v1/")) return json([]);
    if (/neon\.tech\/sql|\/sql$/.test(url) && !url.startsWith(DATA_API)) {
      let body = {};
      try { body = JSON.parse(String((init && init.body) || "{}")); } catch { body = {}; }
      return db.answer(String(body.query || ""), Array.isArray(body.params) ? body.params : []) || json({ command: "SELECT", rowCount: 0, rows: [], fields: [] });
    }
    return new Response("unavailable", { status: 503 });
  };
  const site = { store, db, env, upstream, dispatched, fetchStub, failData: null };
  return site;
}
async function hitWith(site, host, path, { method = "GET", body, auth = false } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  globalThis.fetch = site.fetchStub;
  try {
    const res = await worker.fetch(new Request("https://" + host + path, {
      method, headers: { "content-type": "application/json", ...(auth ? { Authorization: "Bearer t" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), site.env, makeCtx());
    const text = await res.text();
    let j = null;
    try { j = JSON.parse(text); } catch { j = null; }
    return { status: res.status, text, json: j, headers: res.headers };
  } finally { globalThis.fetch = real; }
}

test("DFB5 THE PREVIEW SHOWS THE DRAFT AND CHANGES NOTHING — its row read carries the held price and the held new loaf while the live address shows the live price; a write, a function call, a checkout, a sign-in, an upload and a form are refused before anything leaves; a wrong token is 404; the page itself comes from the draft's script with the preview header", async () => {
  const slug = slugOf("dfb5");
  const ops = [
    { kind: "row", table: "loaves", op: "update", id: 2, values: { price: 5.6 } },
    { kind: "row", table: "loaves", op: "insert", values: { name: "Spelt", price: 6.2 }, ref: HID + ":0" },
  ];
  const site = previewSite(slug, ops);
  const host = slug + "--draft-" + TOKEN12 + ".gofarther.app";
  const pv = await hitWith(site, host, "/api/db/" + slug + "/data/loaves?select=*");
  assert.equal(pv.status, 200, pv.text.slice(0, 300)); 
  assert.equal(pv.json.find((r) => r.id === 2).price, 5.6, "the preview showed the live price");
  assert.deepEqual(pv.json.filter((r) => r.name === "Spelt").map((r) => [r.price, r.id < 0]), [[6.2, true]], "the preview did not show the held new loaf");
  assert.equal(pv.headers.get("cache-control"), "no-store");
  const live = await hitWith(site, slug + ".gofarther.app", "/api/db/" + slug + "/data/loaves?select=*");
  assert.equal(live.status, 200, live.text.slice(0, 300));
  assert.equal(Number(live.json.find((r) => r.id === 2).price), 5.2, "the live address showed the draft's price");
  assert.equal(live.json.some((r) => r.name === "Spelt"), false, "the live address showed a held row");
  const before = site.upstream.length;
  const writesBefore = site.db.writes().length;
  for (const [method, path] of [
    ["POST", "/api/db/" + slug + "/data/orders"],
    ["PATCH", "/api/db/" + slug + "/data/loaves?id=eq.2"],
    ["DELETE", "/api/db/" + slug + "/data/loaves?id=eq.2"],
    ["GET", "/api/db/" + slug + "/data/rpc/claim_slot"],
    ["POST", "/api/db/" + slug + "/data/rpc/claim_slot"],
    ["POST", "/api/db/" + slug + "/checkout"],
    ["POST", "/api/db/" + slug + "/auth/sign-in/email"],
    ["POST", "/api/db/" + slug + "/uploads?table=orders"],
    ["POST", "/api/db/" + slug + "/hook/contact"],
    ["POST", "/api/db/" + slug + "/error"],
    ["GET", "/api/db/other-site/data/loaves"],
  ]) {
    const r = await hitWith(site, host, path, { method, body: method === "GET" ? undefined : { x: 1 } });
    assert.ok(r.status === 403 || r.status === 404, method + " " + path + " was not refused in the preview: " + r.status + " " + r.text.slice(0, 120));
  }
  assert.equal(site.upstream.length, before, "a preview request reached the site's data service: " + JSON.stringify(site.upstream.slice(before)));
  assert.equal(site.db.writes().length, writesBefore, "a preview request wrote the database: " + JSON.stringify(site.db.writes().slice(writesBefore).map((w) => w.query.slice(0, 120))));
  // A READ THE DATA SERVICE REFUSED IS PASSED ON AS IT CAME — never shown as
  // the held rows alone, as if the live list were empty. Only its own "no
  // such table" reads as a table the draft adds.
  site.failData = { status: 404, body: { message: "not found" } };
  const failed = await hitWith(site, host, "/api/db/" + slug + "/data/loaves");
  assert.equal(failed.status, 404, "a refused read was shown as the held rows alone: " + failed.text.slice(0, 200));
  site.failData = { status: 404, body: { code: "42P01", message: "relation \"loaves\" does not exist" } };
  const fresh = await hitWith(site, host, "/api/db/" + slug + "/data/loaves");
  assert.deepEqual([fresh.status, fresh.json.map((r) => r.name)], [200, ["Spelt"]], "a table the draft adds did not read as its held rows");
  site.failData = null;
  const wrong = await hitWith(site, slug + "--draft-ffffffffffff.gofarther.app", "/api/db/" + slug + "/data/loaves");
  assert.equal(wrong.status, 404);
  const doc = await hitWith(site, host, "/");
  assert.equal(doc.status, 200);
  assert.deepEqual(site.dispatched.at(-1), { name: "draft-" + slug, path: "/", preview: "1" }, "the preview's page did not come from the draft's script with its header");
  assert.equal(doc.headers.get("x-robots-tag"), "noindex");
});

test("DFB6 THE LIBRARY UNDER A DRAFT — a picture taken off and a recording replaced are held: the live address keeps serving both as they were, the preview serves the draft's library (the picture gone, the new recording at the old address), the owner's list marks both; Publish makes them live, and a repeat finds them done", async () => {
  const slug = slugOf("dfb6");
  const site = previewSite(slug, []);
  // THE PICTURE, TAKEN OFF THROUGH THE OWNER'S OWN ROUTE.
  const off = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/uploads/" + PICTURE, { method: "DELETE", auth: true });
  assert.equal(off.status, 200, off.text.slice(0, 300));
  assert.deepEqual([off.json.held, off.json.draft && off.json.draft.published], [true, false], "the removal was not held: " + off.text);
  // THE RECORDING'S REPLACEMENT, held as the pair the media route records.
  const { draftFirstApi } = await loadWorkerModule();
  const real = globalThis.fetch; globalThis.fetch = site.fetchStub;
  try {
    const w = await draftFirstApi.backendWriter(site.env, slug);
    assert.equal(w.holding, true, "a live site's library change was not held");
    w.hold.add({ kind: "media-replace", name: SONG, with: SONG_NEW });
    const sealed = await draftFirstApi.sealHeld(site.env, slug, w, {});
    assert.equal(sealed.ok, true);
  } finally { globalThis.fetch = real; }
  // THE LIVE ADDRESS, AS IT WAS.
  assert.equal((await hitWith(site, slug + ".gofarther.app", "/u/" + slug + "/" + PICTURE)).text, "a picture", "the live picture went before Publish");
  assert.equal((await hitWith(site, slug + ".gofarther.app", "/u/" + slug + "/" + SONG)).text, "the old recording", "the live recording changed before Publish");
  // THE PREVIEW, AS THE DRAFT HAS IT.
  const host = slug + "--draft-" + TOKEN12 + ".gofarther.app";
  assert.equal((await hitWith(site, host, "/u/" + slug + "/" + PICTURE)).status, 404, "the preview still served a picture the draft takes off");
  assert.equal((await hitWith(site, host, "/u/" + slug + "/" + SONG)).text, "the new recording", "the preview did not play the replacement at the old address");
  // THE OWNER'S LIST.
  const list = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/uploads", { auth: true });
  assert.equal(list.status, 200, list.text.slice(0, 200));
  const by = (n) => list.json.files.find((f) => f.name === n) || {};
  assert.equal(by(PICTURE).draft, "remove");
  assert.deepEqual([by(SONG_NEW).draft, by(SONG_NEW).replaces], ["replaces", SONG]);
  // PUBLISH: both made live.
  // THE REVISION THE PANEL SHOWS, read as the panel reads it.
  const shown = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/draft", { auth: true });
  assert.equal(shown.json.state, "saved");
  const pub = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/publish", { method: "POST", auth: true, body: { revision: shown.json.revision, version: shown.json.draft } });
  assert.equal(pub.status, 200, pub.text.slice(0, 300));
  assert.equal(site.store.store.has("uploads/" + slug + "/" + PICTURE), false, "Publish did not take the picture off");
  assert.equal(site.store.store.get("uploads/" + slug + "/" + SONG), "the new recording", "Publish did not put the new recording at the old address");
  assert.equal(site.store.store.has("uploads/" + slug + "/" + SONG_NEW), false, "the stand-in name was left in the library");
  const again = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/publish", { method: "POST", auth: true, body: { revision: shown.json.revision } });
  assert.deepEqual([again.status, again.json.already], [200, true]);
});

test("DFB7 BACKEND WRITES ARE HELD WHERE A LIVE SITE WOULD SEE THEM — on a published site the schema, starter rows and jobs are held and the database is not written; before the first publication the schema and rows are written (nobody uses the database yet) and the jobs are still held; with the switch off every write goes live as before; the publication applies the schema, the jobs and the starter rows", async () => {
  const { draftFirstApi } = await loadWorkerModule();
  const spec = { tables: [LOAVES, { name: "hours", columns: [{ name: "day", type: "text" }], read: "public", write: "none" }], jobs: [{ name: "nightly", every: "1d", sql: "select 1" }] };
  const slug = slugOf("dfb7");
  const site = previewSite(slug, []);
  const real = globalThis.fetch; globalThis.fetch = site.fetchStub;
  try {
    const w = await draftFirstApi.backendWriter(site.env, slug);
    assert.deepEqual([w.on, w.holding], [true, true]);
    const writes0 = site.db.writes().length;
    const made = await w.schema("postgres://x", spec);
    assert.deepEqual([...made], ["loaves", "hours"]);
    assert.equal(made.held, true);
    await w.jobs(OWNER.id, spec.jobs);
    const seeded = await w.seed("postgres://x", spec, { hours: [{ day: "Monday" }] });
    assert.deepEqual(seeded.seeded, { hours: 1 });
    assert.equal(site.db.writes().length, writes0, "a held backend write reached the database");
    assert.deepEqual(w.hold.ops.map((o) => o.kind), ["schema", "jobs", "seed"]);
    // THE PUBLICATION'S PLAN: the latest schema, the jobs, the seed.
    const pl = publishPlan(w.hold.ops);
    assert.equal(pl.ok, true);
    assert.deepEqual([!!pl.plan.spec, pl.plan.jobs.length, pl.plan.seeds.length], [true, 1, 1]);
    // A SITE NOT YET PUBLISHED: no pointer.
    site.store.store.delete("current/" + slug + ".json");
    const w2 = await draftFirstApi.backendWriter(site.env, slug);
    assert.deepEqual([w2.on, w2.holding], [true, false], "a never-published site's database writes were held");
    await w2.jobs(OWNER.id, spec.jobs);
    assert.deepEqual(w2.hold.ops.map((o) => o.kind), ["jobs"], "scheduled jobs ran before the first publication");
    // THE SWITCH OFF: nothing held.
    const w3 = await draftFirstApi.backendWriter({ ...site.env, DRAFT_FIRST: "" }, slug);
    assert.deepEqual([w3.on, w3.holding, w3.hold], [false, false, null]);
  } finally { globalThis.fetch = real; }
  // THE HELD-ROW PLAN, FOLDED: a change to a held new row rides its insert; a
  // removal of one drops it; a change to one published earlier goes by its id;
  // a change to one never published is refused.
  const R = HID + ":0", R2 = HID + ":1";
  const p = publishPlan([
    { kind: "row", table: "loaves", op: "insert", values: { name: "Spelt", price: 6.2 }, ref: R },
    { kind: "row", table: "loaves", op: "update", ref: R, values: { price: 6.5 } },
    { kind: "row", table: "loaves", op: "insert", values: { name: "Gone" }, ref: R2 },
    { kind: "row", table: "loaves", op: "remove", ref: R2 },
    { kind: "row", table: "loaves", op: "update", id: 2, values: { price: 5.6 } },
  ]);
  assert.deepEqual(p.plan.inserts.map((i) => i.values), [{ name: "Spelt", price: 6.5 }]);
  assert.deepEqual(p.plan.changes, [{ table: "loaves", op: "update", id: 2, values: { price: 5.6 } }]);
  assert.deepEqual(publishPlan([{ kind: "row", table: "loaves", op: "update", ref: R, values: { price: 7 } }], { refs: { [R]: 12 } }).plan.changes, [{ table: "loaves", op: "update", id: 12, values: { price: 7 } }]);
  assert.equal(publishPlan([{ kind: "row", table: "loaves", op: "update", ref: R, values: { price: 7 } }]).ok, false);
  // THE OVERLAY THE NEXT TASK AND THE PREVIEW READ.
  const ov = rowsOverlay("loaves", BAKERY_LOAVES.slice(0, 2), [{ kind: "row", table: "loaves", op: "insert", values: { name: "Spelt" }, ref: R }, { kind: "row", table: "loaves", op: "remove", id: 1 }]);
  assert.deepEqual(ov.rows.map((r) => r.id), [2, -1]);
  assert.equal(ov.tempRefs.get(-1), R);
});

test("DFB1 A FIRST BUILD STAYS UNPUBLISHED — with the switch on, a fired build's resume saves its version as the site's draft (revision 1) with a preview token and a staged build, and makes nothing live: no pointer, no live marker; its answer says it is saved to the draft, as revision 1", async () => {
  const b = buildBucket();
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const led = ledger();
  await fireInterim(b, id, led, { design: GOOD_DESIGN, env: { DRAFT_FIRST: "on" } }).catch((e) => { throw new Error("the fire did not run: " + e.message); });
  const FIRST_PAGE = "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main><h1>Fold Lane</h1><p>Opening hours: 7–2.</p></main>); }\n";
  await finishResume(b, id, led, { credits: 400, source: FIRST_PAGE, env: { DRAFT_FIRST: "on" } });
  const slug = GOOD_DESIGN.slug;
  assert.equal(b.store.has("current/" + slug + ".json"), false, "a first build moved the pointer under draft-first");
  assert.equal(b.store.has("sites/" + slug + "/site.live"), false, "a first build wrote the live marker under draft-first");
  const rec = b.store.get(DRAFT_KEY(slug));
  assert.ok(rec, "the first build saved no draft");
  const d = JSON.parse(rec);
  assert.deepEqual([d.rev, d.applied, d.revs[0].version === d.version], [1, 0, true]);
  assert.match(d.preview, /^[0-9a-f]{12}$/, "the draft has no preview address");
  // ITS ANSWER SAYS SAVED TO THE DRAFT, NOT PUBLISHED, and names its revision.
  const res = JSON.parse(b.store.get(resultKey(id)));
  const ans = typeof res.body === "string" ? JSON.parse(res.body) : res;
  assert.deepEqual([ans.draft && ans.draft.published, ans.draft && ans.draft.revision, ans.draft && ans.draft.version], [false, 1, d.version], "the build's answer does not say it was saved to the draft: " + JSON.stringify(ans.draft || ans).slice(0, 300));
  // A STAGED BUILD EXISTS FOR THE DRAFT'S VERSION — what Publish would release.
  assert.ok(b.store.has(buildPrefix(slug, d.version) + MANIFEST_FILE), "the draft names a version with no staged build");
});

test("DFB8 RELOAD AND RECOVERY NEVER PUBLISH — the draft state reads back the same on every read; only the owner's Publish route calls publishDraft (no task, retry, recovery, reconnect, sweep or queue does); the reconcile refuses to upload a job's version", async () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const calls = [...src.matchAll(/\bpublishDraft\(/g)].map((m) => m.index);
  const defs = [...src.matchAll(/async function publishDraft\(/g)].map((m) => m.index + "async function ".length);
  const uses = calls.filter((i) => !defs.includes(i));
  assert.equal(uses.length, 1, "publishDraft is called from more than the owner's route");
  const at = src.slice(Math.max(0, uses[0] - 5000), uses[0]);
  assert.match(at, /if \(pb && request\.method === "POST"\)/, "the one call is not the owner's Publish route");
  assert.match(at, /assertOwner\(ownerDeps, ownerSlug, ou\.id\)/, "the Publish route does not check the owner first");
  assert.match(src, /if \(draftFirst\(env\)\) return \{ \.\.\.out, verdict: "unknown", kind: "draft-first"/, "the reconcile may upload a job's version under draft-first");
  // THE SAME STATE ON EVERY READ (a reload is a read).
  const slug = slugOf("dfb8");
  const site = previewSite(slug, [{ kind: "row", table: "loaves", op: "update", id: 2, values: { price: 5.6 } }]);
  const one = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/draft", { auth: true });
  const two = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/draft", { auth: true });
  assert.equal(one.status, 200, one.text.slice(0, 200));
  for (const k of ["state", "revision", "applied", "draft", "live", "preview", "revisions"]) assert.deepEqual(one.json[k], two.json[k], k + " read differently on a reload");
  assert.deepEqual([one.json.state, one.json.revision, one.json.unpublished], ["saved", 1, true]);
});

test("DFB9 AN ORDINARY CONVERSATION CHANGES NOTHING — with the switch on, a question answered as talk writes no draft, no held change, no pointer and no page, and needs no Publish", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("dfb9");
  const store = askBucket(slug);
  const before = new Map([...store.store.entries()].map(([k, v]) => [k, v.body]));
  await withWire({ route: { intent: "ask", answer: "Your hero says the name only." }, converse: "Your home page leads with the name; a line about what you bake would help." }, async (seen) => {
    const r = await routeCall(worker, { ...envFor(store), DRAFT_FIRST: "on" }, { slug, message: "What would you improve on my home page?" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.intent, "ask");
    assert.equal(seen.converse.length, 1, "the reply was not the conversation's own call");
  });
  const keys = [...store.store.keys()];
  assert.equal(keys.some((k) => k.startsWith("site-drafts/")), false, "a conversation wrote a draft");
  assert.equal(keys.some((k) => k.startsWith("current/") || k.startsWith("builds/")), false, "a conversation published or staged a version");
  for (const [k, v] of before) assert.equal(store.store.get(k) && store.store.get(k).body, v, k + " changed in a conversation");
});

test("DFB10 A TASK FINISHING WHILE THE OWNER PUBLISHES IS NOT IN THE PUBLICATION — a row change is held; while its revision is being saved the owner publishes the draft as it stood; the held change becomes the next revision, the live database does not have it, and the panel shows it saved and unpublished", async () => {
  const { P, db, compiler } = bakery("dfb10");
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, TIKTOK_LATER);
    const d1 = draftOf(P);
    let pub = null;
    P.beforePut((k) => k === DRAFT_KEY(P.slug) && new Error().stack.includes("sealHeldRevision") && !pub, async () => {
      pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d1.rev, version: d1.version });
    });
    const w = await runOne(P, WALNUT);
    assert.ok(pub, "the row change's save was never held");
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(w.jobs[0].state, "done", JSON.stringify(w.jobs[0].result).slice(0, 300));
    assert.equal(liveVersion(P), d1.version, "the publication is not the revision the owner named");
    assert.equal(price(db, 5), 6, "a change still being saved slipped into the publication");
    const d2 = draftOf(P);
    assert.deepEqual([d2.applied, d2.rev], [d1.rev, d1.rev + 1], "the running change is not the next revision: " + JSON.stringify(d2.revs));
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.state, st.body.revisions.map((r) => r.revision)], ["saved", [d1.rev + 1]]);
  } finally { await finish(P, compiler); }
});

test("DFB11 EVERY BACKEND WRITE A TASK MAKES GOES THROUGH ITS WRITER — in worker.js the schema apply, the starter rows and the job registration are called only by the writer (Publish applies through it, switched off), or under a binding of those very names from a task's writer (`= aWriter.calls` and its build and rules twins); the data step and the add-on's entries hold before they write; the build carries its hold to its resume", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const body = (name) => { const i = src.indexOf("async function " + name + "("); assert.ok(i >= 0, name + " is missing"); return [i, src.indexOf("\n}\n", i)]; };
  const [w0, w1] = body("backendWriter");
  // PUBLISH APPLIES THROUGH THE SAME WRITER, SWITCHED OFF.
  const [p0, p1] = body("applyHeldPlan");
  assert.match(src.slice(p0, p1), /const live = \(await backendWriter\(\{ \.\.\.env, DRAFT_FIRST: "" \}, slug\)\)\.calls;/);
  const binds = [...src.matchAll(/const \{ applySiteSchema(?:, seedSiteRows, persistSiteJobs)? \} = ([abr])Writer\.calls;/g)].map((m) => ({ at: m.index, who: m[1] }));
  assert.deepEqual(binds.map((b) => b.who).sort(), ["a", "b", "r"], "a task's binding from its writer is gone: " + JSON.stringify(binds));
  for (const fn of ["applySiteSchema", "seedSiteRows", "persistSiteJobs"]) {
    // A BARE CALL (a member call like `live.applySiteSchema(` is the writer's own).
    const sites = [...src.matchAll(new RegExp("(?<![.\\w])" + fn + "\\(", "g"))].map((m) => m.index)
      .filter((i) => !/async function $/.test(src.slice(Math.max(0, i - 15), i)) && !/^\s*(\/\/|\*)/.test(src.slice(src.lastIndexOf("\n", i) + 1, i)));
    assert.ok(sites.length >= 2, fn + ": the observer found no call sites");
    for (const i of sites) {
      if (i > w0 && i < w1) continue;
      const bound = binds.filter((b) => b.at < i).pop();
      const between = bound ? src.slice(bound.at, i) : "";
      assert.ok(bound && !/\n(async )?function /.test(between), fn + " is called outside the writer, Publish, or a task's binding: " + src.slice(src.lastIndexOf("\n", i) + 1, i + 60));
    }
  }
  // THE DATA STEP HOLDS BEFORE ITS FIRST WRITE.
  const apply0 = src.indexOf("apply: async (c) => {");
  assert.ok(apply0 > 0 && src.indexOf("if (dWriter.holding) {", apply0) < src.indexOf("DELETE FROM", apply0), "the data step writes before it asks whether to hold");
  // THE ADD-ON'S ENTRIES HOLD BEFORE THE STATEMENT IS BUILT.
  assert.ok(src.indexOf("if (aWriter.holding) {") < src.indexOf("const rowWrite = rowsInsert("), "the add-on's entries are written before the hold is asked");
  // THE BUILD'S HOLD RIDES ITS ARGUMENTS, WHICH ITS RESUME RECORD KEEPS.
  assert.match(src, /held: bWriter\.hold && !bWriter\.hold\.empty \? bWriter\.hold : null,/);
  assert.match(src, /attachmentIds = null, media = null, held = null \}\) \{/);
});
