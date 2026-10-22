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
import vm from "node:vm";
import { platform, sendMessage, settle, call, tick, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { page as pageSrc, withWire, routeCall, envFor, bucket as askBucket, freshSlug } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { buildBucket, GOOD_DESIGN } from "./fixtures/build-route.mjs";
import { ledger, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";
import { buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../site-builds.mjs";
import { DRAFT_KEY, HELD_KEY, PUBLISHING_KEY, publishPlan, rowsOverlay, previewScriptName as previewScriptNameOf } from "../site-draft.mjs";
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
const ROUTE_RENAME = { intent: "edit", layer: "rename", targets: [{ change: 0, writes: ["address"] }] };
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf.";
const TIKTOK_LATER = "Change our TikTok link on the Visit page to @harbourloafbakery.";
const RYE = "Make the Dark Rye £5.60.";
const SPELT = "Add a Spelt loaf at £6.20.";
const SPELT_MORE = "Make the Spelt £6.50.";
const WALNUT = "Make the Walnut Levain £6.40.";

/** What the data step's model was shown, per call: the rows of `loaves`, as JSON lines. */
const shownRows = [];
function bakery(name, { draftFirst = false, aliases = null, unique = [] } = {}) {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12, unique } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  let tt = 0;
  const said = (args) => String(args.messages[0].content);
  const P = platform({
    slug: slugOf(name), pages: PAGES2, db, liveScripts: true, aliases,
    answers: {
      route: (args) => (/TikTok/.test(said(args)) ? ROUTE_TEXT : /address|Rename/i.test(said(args)) ? ROUTE_RENAME : ROUTE_DATA),
      new_address: (args) => { const asked = (said(args).split("What they asked for:\n")[1] || "").split("\n")[0]; const m = /(?:to|at) ([a-z0-9-]+)\.?\s*$/i.exec(asked); return m ? { name: m[1] } : {}; },
      [T.text]: (args) => { const pairs = [[TT_FROM, TT_TO], [TT_TO, TT_LATER], [TT_LATER, TT_TO]]; const [from, to] = pairs[Math.min(tt++, pairs.length - 1)]; return { edits: [{ id: lineId(args, "visit.tsx", from), to }] }; },
      write_row_changes: (args) => {
        const text = said(args);
        shownRows.push(text);
        const asked = (text.split("WHAT THEY ASKED FOR\n")[1] || "").split("\n")[0];
        if (asked.startsWith("Make the Dark Rye four")) return { changes: [{ table: "loaves", id: 2, values: { price: "£4.20" } }] };
        if (asked.startsWith("Make the Dark Rye")) return { changes: [{ table: "loaves", id: 2, values: { price: 5.6 } }] };
        if (asked.startsWith("Add Barley, Spelt and Oat")) return { changes: [{ table: "loaves", values: { name: "Barley", price: 4.9 } }, { table: "loaves", values: { name: "Spelt", price: 6.2 } }, { table: "loaves", values: { name: "Oat", price: 4.4 } }] };
        if (asked.startsWith("Add a Spelt")) return { changes: [{ table: "loaves", values: { name: "Spelt", price: 6.2 } }] };
        if (asked.startsWith("Make the Spelt")) {
          // THE HELD NEW ROW, by the id the draft gave it (negative): found in what it was shown.
          const m = /id (-\d+): name="Spelt"/.exec(text);
          return { changes: [{ table: "loaves", id: m ? Number(m[1]) : 999, values: { price: 6.5 } }] };
        }
        if (asked.startsWith("Call the Dark Rye")) return { changes: [{ table: "loaves", id: 2, values: { name: "Spelt" } }] };
        if (asked.startsWith("Add another Dark Rye")) return { changes: [{ table: "loaves", values: { name: "Dark Rye", price: 5 } }] };
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


// ── THE PUBLICATION, COHERENT (2026-10-15, the owner's correction) ───────────
//
// The owner: *"Fix partial publication … Make the approved revision publish
// coherently, with safe recovery from interruption or failure. Do not blindly
// roll back database contents or overwrite visitor activity."* A publication
// is a journal of phases: preflight → new tables (unused by the live version)
// → the switch (pointer and script) → the rest, rolled forward step by
// recorded step. Every case reads what is actually stored: the draft record,
// the journal, the pointer, the live script, the sidecar, the address store
// and the rows — never a reply alone.
const JOURNAL = (P) => PUBLISHING_KEY(P.slug);
const journalOf = (P) => { const t = P.readObj(JOURNAL(P)); return t ? JSON.parse(bare(t)) : null; };
/** The journal unless it is closed: a finished or retired journal stays as a tombstone (journals are never deleted). */
const openJournal = (P) => { const j = journalOf(P); return j && !["finished", "retired"].includes(j.phase) ? j : null; };
const sidecarOrigin = (P) => JSON.parse(bare(P.readObj("sitemeta/" + P.slug + ".json"))).origin;
const currentAlias = (aliases) => (aliases.find((r) => r.current === true) || {}).alias || null;
const RENAME = (to) => "Rename the site's address to " + to + ".";
/** Make every write to the journal fail while `when()` is true: a runner that died, as the store sees it. */
function dieAtJournal(P, when) {
  const hook = (k) => k === JOURNAL(P);
  const die = async () => { if (!when()) return; P.beforePut(hook, die); throw new Error("the runner died"); };
  P.beforePut(hook, die);
}

test("DFP1 A CHAT RENAME STAYS IN THE DRAFT — the address store, the alias cache and the live sidecar keep the live name; the draft and its state say where it will move; a second rename moves the draft's address on; Publish then moves the live address once, from the live name to the last one (the name in between never becomes a redirect), with the sidecar's origin", async () => {
  const aliases = [];
  const { P, compiler } = bakery("dfp1", { aliases });
  try {
    await runOne(P, TIKTOK);
    const origin0 = sidecarOrigin(P);
    P.env.DRAFT_FIRST = "on";
    const r1 = await runOne(P, RENAME("fold-street-bakery"));
    assert.equal(r1.jobs[0].state, "done", JSON.stringify(r1.jobs[0].result).slice(0, 300));
    assert.equal(r1.body.renamed, undefined, "a held rename answered as if the site had moved");
    assert.deepEqual([r1.body.renamedInDraft, r1.body.draft && r1.body.draft.published], ["fold-street-bakery", false]);
    assert.deepEqual(aliases, [], "the address store was written before Publish: " + JSON.stringify(aliases));
    assert.equal(sidecarOrigin(P), origin0, "the live sidecar's origin moved before Publish");
    let st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.state, st.body.address.live, st.body.address.draft], ["saved", P.slug, "fold-street-bakery"]);
    // A SECOND RENAME: the address the draft has is the one it is about.
    const r2 = await runOne(P, RENAME("harbour-street-loaf"));
    assert.equal(r2.body.renamedInDraft, "harbour-street-loaf");
    st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.equal(st.body.address.draft, "harbour-street-loaf");
    assert.deepEqual(aliases, []);
    // PUBLISH THE REVISION THE PANEL SHOWS.
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: st.body.revision, version: st.body.draft });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(currentAlias(aliases), "harbour-street-loaf", "Publish did not move the live address: " + JSON.stringify(aliases));
    assert.deepEqual(aliases.filter((r) => r.current === false).map((r) => r.alias), [P.slug], "the old address does not redirect, or a draft-only name became a redirect: " + JSON.stringify(aliases));
    assert.match(sidecarOrigin(P), /harbour-street-loaf/, "the live sidecar's origin was not moved with the address");
    assert.deepEqual([pub.body.state.state, pub.body.state.address.live], ["published", "harbour-street-loaf"]);
    assert.equal(openJournal(P), null, "a finished publication left its journal open");
  } finally { await finish(P, compiler); }
});

test("DFP2 A SUCCESSFUL PUBLISH IS THE SELECTED REVISION, IN ORDER — revision 1 a price, revision 2 a page line, revision 3 a new loaf; the click names revision 2: when the pointer moves the journal is in its switch phase and the live price is still the old one (the row change follows the switch, nothing visible precedes it); after it, revisions 1–2 are live, revision 3's loaf is not, the journal is closed and the record says 2; revision 3's own click adds the loaf once and moves no pointer", async () => {
  const { P, db, compiler } = bakery("dfp2");
  try {
    await runOne(P, TIKTOK);
    const v0 = liveVersion(P);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, RYE);
    await runOne(P, TIKTOK_LATER);
    await runOne(P, SPELT);
    const d = draftOf(P);
    assert.equal(d.rev, 3);
    // ONE OBSERVER, kept for both clicks.
    const switches = [];
    const watch = () => P.beforePut((k) => k === POINTER(P), async () => { switches.push({ rye: price(db, 2), spelt: spelt(db).length, journal: journalOf(P) }); });
    watch();
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 2, version: d.revs[1].version });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(switches.length, 1, "the pointer moved " + switches.length + " times");
    assert.equal(switches[0].journal && switches[0].journal.phase, "switching", "the pointer moved before its intent was stored: " + JSON.stringify(switches[0]));
    assert.deepEqual([switches[0].rye, switches[0].spelt], [5.2, 0], "a visible change landed before the switch");
    assert.notEqual(d.revs[1].version, v0);
    assert.deepEqual([liveVersion(P), P.liveScript()], [d.revs[1].version, d.revs[1].version]);
    assert.deepEqual([price(db, 2), spelt(db).length], [5.6, 0], "revision 3's loaf went live with revision 2");
    assert.deepEqual([draftOf(P).applied, openJournal(P)], [2, null]);
    let st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.state, st.body.revision, st.body.applied], ["saved", 3, 2]);
    // REVISION 3: rows only on the same pages.
    watch();
    const p3 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 3 });
    assert.equal(p3.status, 200, JSON.stringify(p3.body));
    assert.deepEqual([price(db, 2), spelt(db).length, draftOf(P).applied], [5.6, 1, 3]);
    // AGAIN: nothing repeated.
    const p4 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: 3 });
    assert.deepEqual([p4.status, p4.body.already, spelt(db).length], [200, true, 1], JSON.stringify(p4.body));
  } finally { await finish(P, compiler); }
});

test("DFP3 A FAILURE BEFORE THE SWITCH CHANGES NOTHING LIVE — the script is refused: the pointer, the live script, the rows, the address store and the record are all as they were, the journal is closed (retired), and the draft still offers the revision; pressed again, it publishes once", async () => {
  const aliases = [];
  const { P, db, compiler } = bakery("dfp3", { aliases });
  try {
    await runOne(P, TIKTOK);
    const v0 = liveVersion(P), live0 = P.liveScript(), origin0 = sidecarOrigin(P);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    await runOne(P, RENAME("fold-street-bakery"));
    await runOne(P, TIKTOK_LATER);
    const d = draftOf(P);
    let refuse = true;
    P.beforeUpload(async (u) => { if (refuse && !String((u && u.name) || "").startsWith("draft-")) throw new Error("upload refused"); });
    const stop = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
    assert.notEqual(stop.status, 200, "a refused script answered success");
    assert.equal(stop.body.live, "unchanged", JSON.stringify(stop.body));
    assert.deepEqual([liveVersion(P), P.liveScript(), sidecarOrigin(P)], [v0, live0, origin0], "the live site moved on a refused script");
    assert.equal(spelt(db).length, 0, "a row became live before the switch");
    assert.deepEqual(aliases, [], "the address moved before the switch");
    assert.deepEqual([draftOf(P).applied, openJournal(P)], [0, null]);
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.state, st.body.revision], ["saved", d.rev]);
    refuse = false;
    const ok = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual([liveVersion(P), spelt(db).length, currentAlias(aliases)], [d.version, 1, "fold-street-bakery"]);
    // THE NEW VERSION CARRIES THE NEW ADDRESS in its sidecar (canonical link, og:url).
    assert.match(sidecarOrigin(P), /fold-street-bakery/, "the published version's sidecar kept the old origin");
  } finally { await finish(P, compiler); }
});

test("DFP4 A FAILURE AFTER THE SWITCH ROLLS FORWARD, NEVER BACK — the address store refuses: the new version is live, the stop says so, the journal keeps the revision (finishing, with the error) and the record is not marked; the sweep tries again while the store still refuses and finishes nothing; once the store answers, the sweep finishes the same revision — the address moved, the rows once — and a click meanwhile is not a new publication", async () => {
  const aliases = [];
  const { P, db, compiler } = bakery("dfp4", { aliases });
  const { draftFirstApi } = await loadWorkerModule();
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    await runOne(P, RENAME("fold-street-bakery"));
    await runOne(P, TIKTOK_LATER);
    const d = draftOf(P);
    aliases.failWrites = true;
    const stop = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
    assert.equal(stop.status, 502, JSON.stringify(stop.body));
    assert.deepEqual([stop.body.live, stop.body.stage], ["switched", "address"]);
    assert.equal(liveVersion(P), d.version, "the switch did not happen");
    const j = journalOf(P);
    assert.deepEqual([j.n, j.phase, j.running, j.done], [d.rev, "switched", false, []], JSON.stringify(j));
    assert.match(String(j.error), /^address:/);
    assert.equal(draftOf(P).applied, 0, "a publication that did not finish was marked published");
    assert.equal(spelt(db).length, 0, "a step after the stopped one ran");
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.state, st.body.publication.finishing, st.body.publication.revision], ["publishing", true, d.rev]);
    // A NEWER DRAFT MEANWHILE is not what any recovery publishes.
    await runOne(P, WALNUT);
    // THE SWEEP, WHILE THE STORE STILL REFUSES: nothing more, nothing undone.
    P.advance(PAUSE);
    await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.deepEqual([journalOf(P).phase, journalOf(P).attempts, draftOf(P).applied, liveVersion(P)], ["switched", 2, 0, d.version]);
    aliases.failWrites = false;
    // A TEMPORARY STOP WAITS ITS PAUSE (2026-10-18, audit A06-4) before the next try.
    P.advance(PAUSE);
    await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.equal(openJournal(P), null, "the sweep did not finish the publication");
    assert.deepEqual([draftOf(P).applied, currentAlias(aliases), spelt(db).length], [d.rev, "fold-street-bakery", 1]);
    assert.equal(price(db, 5), 6, "the recovery published the newer, unapproved change");
    const after = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([after.body.state, after.body.revision, after.body.applied], ["saved", d.rev + 1, d.rev]);
  } finally { await finish(P, compiler); }
});

test("DFP4b THE SWEEP FINISHES AN APPROVED PUBLICATION AFTER THE SWITCH WAS TURNED OFF (2026-10-16) — a publication stopped after its switch, then DRAFT_FIRST off: the two-minute cron (the real `scheduled`) still finishes the approved revision; before this the sweep ran only with the switch on, and the journal was stranded", async () => {
  const aliases = [];
  const { P, db, compiler } = bakery("dfp4b", { aliases });
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    await runOne(P, RENAME("fold-street-bakery"));
    const d = draftOf(P);
    aliases.failWrites = true;
    const stop = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
    assert.equal(stop.status, 502, JSON.stringify(stop.body));
    assert.equal(journalOf(P).phase, "switched", JSON.stringify(journalOf(P)));
    aliases.failWrites = false;
    // THE SWITCH TURNED OFF while the owner's approved publication stands open.
    P.env.DRAFT_FIRST = "off";
    // NOT INSIDE THE RUNNER'S WINDOW: the stopped runner's stamp has gone stale.
    const real = Date.now; const at = real() + 10 * 60_000; Date.now = () => at;
    try { await tick(P); } finally { Date.now = real; }
    assert.equal(openJournal(P), null, "the cron left the approved publication open once the switch was off");
    assert.deepEqual([draftOf(P).applied, currentAlias(aliases), spelt(db).length], [d.rev, "fold-street-bakery", 1]);
  } finally { await finish(P, compiler); }
});

test("DFP5 AN INTERRUPTED PUBLICATION, AND DUPLICATE CLICKS — the runner dies right after its switch: a second click on the same revision is told it is under way and publishes nothing; a click on another revision is refused; once the runner is stale, the owner's click resumes the SAME revision and finishes it — the rows once, the address once — and then a click on the newer revision publishes it", async () => {
  const aliases = [];
  const { P, db, compiler } = bakery("dfp5", { aliases });
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    await runOne(P, RENAME("fold-street-bakery"));
    await runOne(P, TIKTOK_LATER);
    const d = draftOf(P);
    let dying = false;
    // DIES AT THE FIRST JOURNAL WRITE AFTER THE SWITCH.
    P.beforePut((k) => k === POINTER(P), async () => { P.beforePut((k) => k === JOURNAL(P), async () => { dying = true; dieAtJournal(P, () => dying); }); });
    const died = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
    dying = false;
    assert.notEqual(died.status, 200, "a publication whose runner died answered success");
    const j = journalOf(P);
    assert.deepEqual([j.phase, j.running, j.n], ["switched", true, d.rev], "the death did not leave a running journal after the switch: " + JSON.stringify(j));
    assert.equal(liveVersion(P), d.version);
    // A DUPLICATE CLICK WHILE THE (DEAD) RUNNER IS STILL FRESH.
    const dup = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
    assert.deepEqual([dup.status, dup.body.publishing], [202, true], JSON.stringify(dup.body));
    await runOne(P, WALNUT);
    const other = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev + 1 });
    assert.equal(other.status, 409, "another revision was published over a publication in progress: " + JSON.stringify(other.body));
    assert.equal(price(db, 5), 6);
    // STALE: the owner's click resumes the same revision.
    P.advance(4 * 60 * 1000);
    const resumed = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
    assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
    assert.deepEqual([draftOf(P).applied, openJournal(P), currentAlias(aliases), spelt(db).length, price(db, 5)], [d.rev, null, "fold-street-bakery", 1, 6]);
    assert.equal(aliases.filter((r) => r.alias === "fold-street-bakery").length, 1, "the address was written twice");
    // THE NEWER REVISION, its own click.
    const newer = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev + 1 });
    assert.equal(newer.status, 200, JSON.stringify(newer.body));
    assert.deepEqual([price(db, 5), spelt(db).length, draftOf(P).applied], [6.4, 1, d.rev + 1]);
  } finally { await finish(P, compiler); }
});

test("DFP6 ANOTHER REVISION'S STOPPED SWITCH IS FINISHED FIRST, NEVER SKIPPED — revision A switched and stopped; the owner clicks a newer revision B: A's remaining changes are finished (it was approved and its pages are live), then B is published; nothing of A is repeated", async () => {
  const aliases = [];
  const { P, db, compiler } = bakery("dfp6", { aliases });
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    await runOne(P, TIKTOK_LATER);
    const a = draftOf(P);
    aliases.failWrites = true;
    await runOne(P, RENAME("fold-street-bakery"));
    const aRev = draftOf(P).rev;
    const stop = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: aRev });
    assert.equal(stop.body.live, "switched", JSON.stringify(stop.body));
    aliases.failWrites = false;
    await runOne(P, WALNUT);
    const b = draftOf(P).rev;
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: b });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.deepEqual([draftOf(P).applied, currentAlias(aliases), spelt(db).length, price(db, 5), openJournal(P)], [b, "fold-street-bakery", 1, 6.4, null]);
    void a;
  } finally { await finish(P, compiler); }
});

test("DFP7 TWO CLICKS AT ONCE PUBLISH ONCE — the same revision pressed twice in the same moment: one publication runs, the other is told it is under way or already done; the new loaf is added once, the address moves once, the pointer moves once; the preview still serves the draft afterwards and a later edit is a new revision, unpublished", async () => {
  const aliases = [];
  const { P, db, compiler } = bakery("dfp7", { aliases });
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    await runOne(P, RENAME("fold-street-bakery"));
    await runOne(P, TIKTOK_LATER);
    const d = draftOf(P);
    let moves = 0;
    const count = () => P.beforePut((k) => k === POINTER(P), async () => { moves++; count(); });
    count();
    const both = await Promise.all([0, 1].map(() => call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version })));
    const codes = both.map((r) => r.status).sort();
    assert.ok(codes.includes(200), JSON.stringify(both.map((r) => r.body)));
    assert.ok(codes.every((c) => c === 200 || c === 202), "a duplicate click failed: " + JSON.stringify(codes));
    assert.equal(both.filter((r) => r.status === 200 && r.body.already === false).length, 1, "both clicks published: " + JSON.stringify(both.map((r) => r.body)));
    assert.deepEqual([moves, spelt(db).length, aliases.filter((r) => r.alias === "fold-street-bakery").length, draftOf(P).applied, openJournal(P)], [1, 1, 1, d.rev, null]);
    // AN EDIT AFTER PUBLICATION: saved, not live.
    await runOne(P, WALNUT);
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.state, st.body.revision, st.body.applied, st.body.address.live, st.body.address.draft], ["saved", d.rev + 1, d.rev, "fold-street-bakery", "fold-street-bakery"]);
    assert.equal(price(db, 5), 6, "an edit after publication went live");
  } finally { await finish(P, compiler); }
});

// ── RECOVERY, AT EVERY BOUNDARY (2026-10-15, Codex's two reproductions) ──────
//
// A runner can stop between any side effect and the checkpoint that records
// it, and a checkpoint can land with its answer lost. Each case stops the
// real Worker functions at one such boundary and reads what is stored after:
// the pointer, the live script, the rows, the draft record and the journal.
/** The runner stops for good just before the write to `key` whose body `when(body)` accepts: the store never gets it and the runner never goes on. Resolves once it is reached. */
function stopBefore(P, key, when = () => true) {
  const match = typeof key === "function" ? key : (x) => x === key;
  let reached; const at = new Promise((r) => { reached = r; });
  const hook = async (k, v) => { if (!when(String(v || ""))) { P.beforePut(match, hook); return; } reached(); await new Promise(() => {}); };
  P.beforePut(match, hook);
  return at;
}
/** What the RUNNING script serves, asked as the platform asks it: the dispatch stub answers with the serving upload's own version. */
const serving = async (P) => (await P.env.SITE_WORKERS.get("site-" + P.slug).fetch(new Request("https://" + P.slug + ".gofarther.app/"))).headers.get("x-site-version");
const phaseIs = (ph) => (v) => v.includes('"phase":"' + ph + '"');
/** A publication of `body` started and left running: its promise is never awaited. */
function clickAway(P, body) { const c = call(P, "POST", "/api/site/" + P.slug + "/publish", body); c.catch(() => {}); return c; }
const STALE = 5 * 60 * 1000;
/** Past the longest pause a temporary stop waits before the sweep tries again (30 minutes). */
const PAUSE = 31 * 60 * 1000;
/** The approved revision: the Dark Rye's new price (a held row update) and new Visit-page words (new pages). */
async function approved(P) {
  await runOne(P, TIKTOK);
  const v0 = liveVersion(P);
  P.env.DRAFT_FIRST = "on";
  await runOne(P, RYE);
  await runOne(P, TIKTOK_LATER);
  return { v0, d: draftOf(P) };
}

test("DFR1 CODEX'S FIRST REPRODUCTION: THE SWITCH LANDED, ITS CHECKPOINT DID NOT — the runner stops after the activation and before `switched` is stored: the journal holds the durable intent (`switching`), never a `prepared` that recovery would read as nothing live; five minutes on, the sweep reconciles with the pointer and finishes the approved revision: the row's new price, the record marked, the journal retired", async () => {
  const { P, db, compiler } = bakery("dfr1");
  const { draftFirstApi } = await loadWorkerModule();
  try {
    const { v0, d } = await approved(P);
    const stopped = stopBefore(P, JOURNAL(P), phaseIs("switched"));
    clickAway(P, { revision: d.rev, version: d.version });
    await stopped;
    // THE NEW PAGES ARE LIVE; THE BACKEND IS NOT YET.
    assert.notEqual(d.version, v0);
    assert.deepEqual([liveVersion(P), P.liveScript(), price(db, 2), draftOf(P).applied], [d.version, d.version, 5.2, 0]);
    const j = journalOf(P);
    assert.deepEqual([j.phase, j.running, j.n, j.from], ["switching", true, d.rev, v0], "the intent to switch was not stored before the switch: " + JSON.stringify(j));
    // FRESH: nothing takes it over.
    const early = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.deepEqual([early.finished, early.cleared, journalOf(P).phase], [0, 0, "switching"]);
    P.advance(STALE);
    const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.deepEqual([r.finished, r.cleared], [1, 0], JSON.stringify(r));
    assert.deepEqual([liveVersion(P), await serving(P), price(db, 2), draftOf(P).applied], [d.version, d.version, 5.6, d.rev]);
    assert.deepEqual([journalOf(P).phase, journalOf(P).running], ["finished", false], "the finished publication's record is not retired as finished");
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.state, st.body.publication], ["published", null]);
  } finally { await finish(P, compiler); }
});

test("DFR2 INTENT STORED, SWITCH NOT MADE — the runner stops right before its pointer write: nothing new is live; once stale, the sweep makes the approved switch itself (the live version is still the one it replaces) and finishes; had the live site moved to some other version meanwhile, the sweep sets the publication aside and changes nothing", async () => {
  const { P, db, compiler } = bakery("dfr2");
  const { draftFirstApi } = await loadWorkerModule();
  try {
    const { v0, d } = await approved(P);
    const stopped = stopBefore(P, POINTER(P));
    clickAway(P, { revision: d.rev, version: d.version });
    await stopped;
    assert.deepEqual([liveVersion(P), P.liveScript(), price(db, 2), journalOf(P).phase], [v0, v0, 5.2, "switching"]);
    P.advance(STALE);
    const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.deepEqual([r.finished, r.cleared], [1, 0], JSON.stringify(r));
    assert.deepEqual([liveVersion(P), P.liveScript(), price(db, 2), draftOf(P).applied, journalOf(P).phase], [d.version, d.version, 5.6, d.rev, "finished"]);
  } finally { await finish(P, compiler); }
  // THE LIVE SITE MOVED ELSEWHERE while the runner was stopped (the owner restored another version).
  const two = bakery("dfr2b");
  try {
    const P2 = two.P;
    const { v0, d } = await approved(P2);
    const stopped = stopBefore(P2, POINTER(P2));
    clickAway(P2, { revision: d.rev, version: d.version });
    await stopped;
    const ptr = JSON.parse(bare(P2.readObj(POINTER(P2))));
    const other = "01790000000000-zzzzzz";
    await P2.env.SITES_BUCKET.put(POINTER(P2), JSON.stringify({ ...ptr, version: other }));
    P2.advance(STALE);
    const r = await P2.run(() => draftFirstApi.runPublishRecovery(P2.env));
    assert.deepEqual([r.finished, r.cleared], [0, 1], JSON.stringify(r));
    assert.deepEqual([liveVersion(P2), price(two.db, 2), draftOf(P2).applied, journalOf(P2).phase], [other, 5.2, 0, "retired"], "a publication was forced over a live site that had moved on");
    void v0;
  } finally { await finish(two.P, two.compiler); }
});

test("DFR3 LOST CHECKPOINT ANSWERS — (a) the `switching` intent lands but its answer is lost: the click is told it is uncertain (never \"nothing changed\"), and the sweep completes it; (b) the `switched` checkpoint lands, answer lost: the stop says the new version is live and a click after the runner's window finishes it; (c) the runner dies after adding the new loaf but before recording it: the finish runs again and the loaf is there once", async () => {
  const { draftFirstApi } = await loadWorkerModule();
  for (const [name, lose] of [["dfr3a", phaseIs("switching")], ["dfr3b", phaseIs("switched")]]) {
    const { P, db, compiler } = bakery(name);
    try {
      const { d } = await approved(P);
      P.losePut((k, b) => k === JOURNAL(P) && lose(String(b)));
      const r1 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
      assert.equal(r1.status, 502, JSON.stringify(r1.body));
      assert.notEqual(r1.body.live, "unchanged", "an uncertain or switched publication said nothing changed: " + JSON.stringify(r1.body));
      assert.equal(journalOf(P).running, true, "the journal of a stop it cannot account for was taken away");
      // A CLICK WHILE THE RUNNER'S WINDOW IS OPEN: under way, nothing more.
      const dup = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
      assert.equal(dup.status, 202, JSON.stringify(dup.body));
      P.advance(STALE);
      if (name === "dfr3a") {
        const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
        assert.equal(r.finished, 1, JSON.stringify(r));
      } else {
        const again = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
        assert.equal(again.status, 200, JSON.stringify(again.body));
      }
      assert.deepEqual([liveVersion(P), price(db, 2), draftOf(P).applied, journalOf(P).phase], [d.version, 5.6, d.rev, "finished"], name);
    } finally { await finish(P, compiler); }
  }
  const { P, db, compiler } = bakery("dfr3c");
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    await runOne(P, TIKTOK_LATER);
    const d = draftOf(P);
    const stopped = stopBefore(P, JOURNAL(P), (v) => v.includes('"inserts"'));
    clickAway(P, { revision: d.rev, version: d.version });
    await stopped;
    assert.equal(spelt(db).length, 1, "the loaf was not added before the stop");
    assert.equal(journalOf(P).done.includes("inserts"), false);
    P.advance(STALE);
    const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.equal(r.finished, 1, JSON.stringify(r));
    assert.deepEqual([spelt(db).length, draftOf(P).applied, journalOf(P).phase], [1, d.rev, "finished"], "the finish added the loaf twice or did not finish");
  } finally { await finish(P, compiler); }
});

test("DFR4 CODEX'S SECOND REPRODUCTION: CLEANUP NEVER REMOVES ANOTHER RUNNER'S JOURNAL — a publication stopped before its switch goes stale; between the sweep's read and its retirement a fresh publication's journal lands: the fresh journal is still there afterwards, whole; the same for a runner retiring its own journal after a refused switch", async () => {
  const { draftFirstApi } = await loadWorkerModule();
  /** The fresh journal lands at the first of: after the next read of the key, or before the next write to it. */
  const freshBetween = (P, j) => {
    let done = false;
    const land = async () => { if (done) return; done = true; await P.env.SITES_BUCKET.put(JOURNAL(P), JSON.stringify({ ...j, at: Date.now() })); };
    P.afterGet((k) => k === JOURNAL(P), land);
    P.beforePut((k) => k === JOURNAL(P), land);
    return () => done;
  };
  {
    const { P, db, compiler } = bakery("dfr4a");
    try {
      const { v0, d } = await approved(P);
      const stopped = stopBefore(P, JOURNAL(P), phaseIs("prepared"));
      clickAway(P, { revision: d.rev, version: d.version });
      await stopped;
      assert.equal(journalOf(P).phase, "start");
      P.advance(STALE);
      const fresh = { ...journalOf(P), id: "fresh-" + d.rev, phase: "start", running: true, done: [] };
      const landed = freshBetween(P, fresh);
      const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.equal(landed(), true, "the fresh journal never landed: the observer is dead");
      assert.deepEqual([journalOf(P) && journalOf(P).id, journalOf(P) && journalOf(P).phase, journalOf(P) && journalOf(P).running], [fresh.id, "start", true], "the sweep removed or changed a fresh publication's journal: " + JSON.stringify(journalOf(P)) + " " + JSON.stringify(r));
      assert.deepEqual([liveVersion(P), price(db, 2), draftOf(P).applied], [v0, 5.2, 0]);
    } finally { await finish(P, compiler); }
  }
  {
    const { P, db, compiler } = bakery("dfr4b");
    try {
      const { v0, d } = await approved(P);
      let fresh = null, landed = () => false;
      P.beforeUpload(async (u) => {
        if (String((u && u.name) || "").startsWith("draft-")) return;
        fresh = { ...journalOf(P), id: "fresh-b", phase: "start", running: true, done: [] };
        landed = freshBetween(P, fresh);
        throw new Error("upload refused");
      });
      const stop = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
      assert.notEqual(stop.status, 200, JSON.stringify(stop.body));
      assert.equal(landed(), true, "the fresh journal never landed: the observer is dead");
      assert.deepEqual([journalOf(P) && journalOf(P).id, journalOf(P) && journalOf(P).running], [fresh.id, true], "a runner retiring its own journal removed another's: " + JSON.stringify(journalOf(P)));
      assert.deepEqual([liveVersion(P), price(db, 2), draftOf(P).applied], [v0, 5.2, 0]);
    } finally { await finish(P, compiler); }
  }
});

test("DFR5 THE SWEEP AND A CLICK AT ONCE ON A STOPPED PUBLICATION — one of them takes it over, the approved revision is finished once (the row, the loaf, the record), the other is told it is under way or done; and a later revision publishes over the retired journal", async () => {
  const { P, db, compiler } = bakery("dfr5");
  const { draftFirstApi } = await loadWorkerModule();
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, RYE);
    await runOne(P, SPELT);
    await runOne(P, TIKTOK_LATER);
    const d = draftOf(P);
    const stopped = stopBefore(P, JOURNAL(P), phaseIs("switched"));
    clickAway(P, { revision: d.rev, version: d.version });
    await stopped;
    P.advance(STALE);
    const [sweep, click] = await Promise.all([
      P.run(() => draftFirstApi.runPublishRecovery(P.env)),
      call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version }),
    ]);
    assert.ok([200, 202, 409].includes(click.status), JSON.stringify(click.body));
    if (click.status !== 200) assert.equal(sweep.finished, 1, JSON.stringify(sweep));
    assert.deepEqual([liveVersion(P), price(db, 2), spelt(db).length, draftOf(P).applied, journalOf(P).phase], [d.version, 5.6, 1, d.rev, "finished"]);
    await runOne(P, WALNUT);
    const next = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev + 1 });
    assert.equal(next.status, 200, JSON.stringify(next.body));
    assert.deepEqual([price(db, 5), draftOf(P).applied, journalOf(P).phase, journalOf(P).n], [6.4, d.rev + 1, "finished", d.rev + 1]);
    // AND A SWEEP OVER FINISHED JOURNALS TOUCHES NOTHING.
    const quiet = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.deepEqual([quiet.finished, quiet.cleared, journalOf(P).n], [0, 0, d.rev + 1]);
  } finally { await finish(P, compiler); }
});

test("DFR6 LOST ANSWERS AT THE ENDS — (a) the new journal lands but its answer is lost: the click says nothing changed (true: it is at `start`), the live site is untouched, and once stale the sweep sets it aside and a fresh click publishes; (b) the closing tombstone lands, answer lost: the publication is complete and says so, and nothing is done again", async () => {
  const { draftFirstApi } = await loadWorkerModule();
  {
    const { P, db, compiler } = bakery("dfr6a");
    try {
      const { v0, d } = await approved(P);
      P.losePut((k, b) => k === JOURNAL(P) && phaseIs("start")(String(b)));
      const r1 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
      assert.deepEqual([r1.status, r1.body.live], [503, "unchanged"], JSON.stringify(r1.body));
      assert.deepEqual([journalOf(P).phase, journalOf(P).running, liveVersion(P), price(db, 2)], ["start", true, v0, 5.2]);
      P.advance(STALE);
      const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.deepEqual([r.finished, r.cleared, journalOf(P).phase, liveVersion(P), draftOf(P).applied], [0, 1, "retired", v0, 0]);
      const ok = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.deepEqual([liveVersion(P), price(db, 2), draftOf(P).applied, journalOf(P).phase], [d.version, 5.6, d.rev, "finished"]);
    } finally { await finish(P, compiler); }
  }
  {
    const { P, db, compiler } = bakery("dfr6b");
    try {
      await runOne(P, TIKTOK);
      P.env.DRAFT_FIRST = "on";
      await runOne(P, SPELT);
      await runOne(P, TIKTOK_LATER);
      const d = draftOf(P);
      P.losePut((k, b) => k === JOURNAL(P) && phaseIs("finished")(String(b)));
      const r1 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
      assert.equal(r1.status, 200, JSON.stringify(r1.body));
      assert.deepEqual([journalOf(P).phase, spelt(db).length, draftOf(P).applied], ["finished", 1, d.rev]);
      P.advance(STALE);
      const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.deepEqual([r.finished, r.cleared, spelt(db).length], [0, 0, 1]);
      const again = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
      assert.deepEqual([again.status, again.body.already, spelt(db).length], [200, true, 1], JSON.stringify(again.body));
    } finally { await finish(P, compiler); }
  }
});

test("DFR7 THE ACTIVATION'S OWN ANSWER IS LOST — the pointer write lands and the activation hears a failure: the pointer is read again before anything is retired, the publication carries on, and before it records the switch it makes the activation's effects true — the RUNNING script serves the new version (asked through the dispatch stub), not merely the pointer naming it — then finishes: the row's new price, the record marked", async () => {
  const { P, db, compiler } = bakery("dfr7");
  const { draftFirstApi } = await loadWorkerModule();
  try {
    const { d } = await approved(P);
    const v0 = liveVersion(P);
    P.losePut((k, b) => k === POINTER(P) && String(b).includes(d.version));
    const r1 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.version });
    assert.equal(liveVersion(P), d.version, "the lost pointer write did not land: the case is not the one described");
    // THE POINTER IS NOT THE SITE: the running script is still the old one.
    assert.equal(await serving(P), v0, "the script moved with the lost pointer write: the case is not the one described");
    assert.notEqual(r1.body && r1.body.live, "unchanged", "new pages are live and the stop said nothing changed: " + JSON.stringify(r1.body));
    if (r1.status !== 200) {
      assert.ok(journalOf(P) && ["switching", "switched"].includes(journalOf(P).phase), "the journal of a live version was set aside: " + JSON.stringify(journalOf(P)));
      P.advance(STALE);
      await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    }
    assert.deepEqual([liveVersion(P), await serving(P), P.liveScript(), price(db, 2), draftOf(P).applied, journalOf(P).phase], [d.version, d.version, d.version, 5.6, d.rev, "finished"], "finished with the old script running");
  } finally { await finish(P, compiler); }
  // THE ACTIVATION ANSWERS A FAILURE WHILE ITS POINTER STANDS: the script is
  // refused and the activation's own undo of the pointer fails too. The
  // pointer — what the platform serves from, and what the script is made to
  // follow — names the new version, so the publication is carried on, never
  // set aside.
  const two = bakery("dfr7b");
  try {
    const P2 = two.P;
    const { d } = await approved(P2);
    let refused = 0;
    P2.beforeUpload(async (u) => { if (!String((u && u.name) || "").startsWith("draft-") && refused++ === 0) throw new Error("upload refused"); });
    P2.failPut((k, b) => k === POINTER(P2) && !String(b).includes(d.version));
    const r1 = await call(P2, "POST", "/api/site/" + P2.slug + "/publish", { revision: d.rev, version: d.version });
    assert.equal(refused, 1, "the script upload was never refused: the observer is dead");
    assert.equal(liveVersion(P2), d.version, "the pointer's undo was not the one that failed: the case is not the one described");
    assert.notEqual(r1.body && r1.body.live, "unchanged", "the pointer names the new version and the stop said nothing changed: " + JSON.stringify(r1.body));
    assert.ok(journalOf(P2) && journalOf(P2).phase !== "retired", "the publication of a version the pointer names was set aside: " + JSON.stringify(journalOf(P2)));
    if (r1.status !== 200) { P2.advance(STALE); await P2.run(() => draftFirstApi.runPublishRecovery(P2.env)); }
    assert.deepEqual([liveVersion(P2), await serving(P2), price(two.db, 2), draftOf(P2).applied, journalOf(P2).phase], [d.version, d.version, 5.6, d.rev, "finished"], "finished with the old script running");
  } finally { await finish(two.P, two.compiler); }
});

test("DFR8 THE POINTER CANNOT BE READ WHERE A SWITCH MAY HAVE HAPPENED — the sweep finds a stopped switch and its read of the pointer fails: the journal is kept (one more attempt recorded), never set aside on an unknown; the next sweep reads it and finishes the approved revision", async () => {
  const { P, db, compiler } = bakery("dfr8");
  const { draftFirstApi } = await loadWorkerModule();
  try {
    const { d } = await approved(P);
    const stopped = stopBefore(P, JOURNAL(P), phaseIs("switched"));
    clickAway(P, { revision: d.rev, version: d.version });
    await stopped;
    P.advance(STALE);
    P.failGet((k) => k === POINTER(P));
    const r1 = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.deepEqual([r1.finished, r1.cleared], [0, 0], JSON.stringify(r1));
    const j = journalOf(P);
    assert.deepEqual([j.phase, j.running, j.attempts, draftOf(P).applied, price(db, 2)], ["switching", false, 1, 0, 5.2], "an unknown was read as nothing live: " + JSON.stringify(j));
    P.advance(PAUSE);
    const r2 = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.equal(r2.finished, 1, JSON.stringify(r2));
    assert.deepEqual([liveVersion(P), price(db, 2), draftOf(P).applied, journalOf(P).phase], [d.version, 5.6, d.rev, "finished"]);
  } finally { await finish(P, compiler); }
});

/** The approved revision with a held address too: the Dark Rye's price, a rename, and new Visit-page words. */
async function approvedRenamed(P) {
  await runOne(P, TIKTOK);
  const v0 = liveVersion(P);
  P.env.DRAFT_FIRST = "on";
  await runOne(P, RYE);
  await runOne(P, RENAME("fold-street-bakery"));
  await runOne(P, TIKTOK_LATER);
  return { v0, d: draftOf(P), origin0: sidecarOrigin(P) };
}
const SIDECAR = (P) => "sitemeta/" + P.slug + ".json";
const NOTE = (P) => (k) => String(k).startsWith("scriptpending/" + P.slug + "/");

test("DFR9 CODEX'S THIRD REPRODUCTION: THE POINTER WRITE LANDED, THE ACTIVATION STOPPED BEFORE ITS SCRIPT — (a) stopped before the sidecar, (b) stopped after the sidecar and before the script's upload note: the pointer names the new version while the RUNNING script is the old one; the sweep does not take the pointer for the activation — it puts the sidecar (with the held address) and the script up to the pointer's version, sees the script serving it, and only then finishes the backend: the address, the row, the record; a second sweep does nothing (no upload, no write)", async () => {
  const { draftFirstApi } = await loadWorkerModule();
  for (const [name, stopAt] of [["dfr9a", (P) => SIDECAR(P)], ["dfr9b", (P) => NOTE(P)]]) {
    const aliases = [];
    const { P, db, compiler } = bakery(name, { aliases });
    try {
      const { v0, d, origin0 } = await approvedRenamed(P);
      const stopped = stopBefore(P, stopAt(P));
      clickAway(P, { revision: d.rev, version: d.version });
      await stopped;
      // THE INTERRUPTION, AS IT STANDS IN THE STORE AND ON THE PLATFORM.
      assert.deepEqual([liveVersion(P), await serving(P), P.liveScript(), journalOf(P).phase, price(db, 2), aliases.length, draftOf(P).applied],
        [d.version, v0, v0, "switching", 5.2, 0, 0], name + ": not the interruption described");
      if (name === "dfr9a") assert.equal(sidecarOrigin(P), origin0, "the sidecar was written before the stop");
      else assert.match(sidecarOrigin(P), /fold-street-bakery/, "the sidecar was not written before the stop");
      P.advance(STALE);
      const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.deepEqual([r.finished, r.cleared], [1, 0], name + " " + JSON.stringify(r));
      assert.deepEqual([liveVersion(P), await serving(P), P.liveScript()], [d.version, d.version, d.version], name + ": finished with the old script running");
      assert.match(sidecarOrigin(P), /fold-street-bakery/, name + ": the sidecar does not carry the published address");
      assert.deepEqual([currentAlias(aliases), price(db, 2), draftOf(P).applied, journalOf(P).phase], ["fold-street-bakery", 5.6, d.rev, "finished"], name);
      // REPEATED RECOVERY IS SAFE: nothing uploaded, nothing changed.
      const ups = P.uploads().length, side = P.readObj(SIDECAR(P));
      const again = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.deepEqual([again.finished, again.cleared, P.uploads().length, P.readObj(SIDECAR(P)) === side, await serving(P), price(db, 2), aliases.filter((x) => x.alias === "fold-street-bakery").length],
        [0, 0, ups, true, d.version, 5.6, 1], name + ": a second sweep acted again");
    } finally { await finish(P, compiler); }
  }
});

test("DFR10 THE OUTCOME UNKNOWN STAYS RECOVERABLE — the activation stopped before its script; the sweep uploads the script but the platform has not started serving it: nothing is recorded as switched, no backend change is made, the journal is kept with the attempt; once the script serves, the next sweep finishes; and if newer work moved the pointer meanwhile, the publication is set aside, never forced over it", async () => {
  const { draftFirstApi } = await loadWorkerModule();
  {
    const { P, db, compiler } = bakery("dfr10a");
    try {
      const { v0, d } = await approved(P);
      const stopped = stopBefore(P, NOTE(P));
      clickAway(P, { revision: d.rev, version: d.version });
      await stopped;
      P.advance(STALE);
      const landing = P.deferLanding();
      const r1 = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.deepEqual([r1.finished, r1.cleared], [0, 0], JSON.stringify(r1));
      const j = journalOf(P);
      assert.deepEqual([liveVersion(P), await serving(P), j.phase, j.running, j.attempts, price(db, 2), draftOf(P).applied],
        [d.version, v0, "switching", false, 1, 5.2, 0], "recorded or applied before the script served: " + JSON.stringify(j));
      landing.release();
      P.advance(PAUSE);
      const r2 = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.equal(r2.finished, 1, JSON.stringify(r2));
      assert.deepEqual([await serving(P), price(db, 2), draftOf(P).applied, journalOf(P).phase], [d.version, 5.6, d.rev, "finished"]);
    } finally { await finish(P, compiler); }
  }
  {
    const { P, db, compiler } = bakery("dfr10b");
    try {
      const { v0, d } = await approved(P);
      const stopped = stopBefore(P, NOTE(P));
      clickAway(P, { revision: d.rev, version: d.version });
      await stopped;
      // NEWER WORK MOVED THE POINTER after this activation's pointer write.
      const other = "01790000000000-zzzzzz";
      const ptr = JSON.parse(bare(P.readObj(POINTER(P))));
      await P.env.SITES_BUCKET.put(POINTER(P), JSON.stringify({ ...ptr, version: other }));
      P.advance(STALE);
      const ups = P.uploads().length;
      const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.deepEqual([r.finished, r.cleared], [0, 1], JSON.stringify(r));
      assert.deepEqual([liveVersion(P), P.uploads().filter((u) => u.version === d.version).length, price(db, 2), draftOf(P).applied, journalOf(P).phase],
        [other, P.uploads().slice(0, ups).filter((u) => u.version === d.version).length, 5.2, 0, "retired"], "the approved version was forced over newer work");
      void v0;
    } finally { await finish(P, compiler); }
  }
  {
    // NEWER WORK MOVES THE POINTER WHILE THE SWEEP RECONCILES: after the sweep
    // read the pointer on the approved version, and before it writes the
    // version's sidecar. The newer activation's sidecar is never overwritten.
    const { P, db, compiler } = bakery("dfr10c");
    try {
      const { d } = await approved(P);
      const stopped = stopBefore(P, SIDECAR(P));
      clickAway(P, { revision: d.rev, version: d.version });
      await stopped;
      P.advance(STALE);
      const other = "01790000000000-zzzzzz", newer = JSON.stringify({ origin: "https://newer.gofarther.app", newer: true });
      let moved = false;
      P.afterGet((k) => k === POINTER(P), async () => {
        moved = true;
        const ptr = JSON.parse(bare(P.readObj(POINTER(P))));
        await P.env.SITES_BUCKET.put(POINTER(P), JSON.stringify({ ...ptr, version: other }));
        await P.env.SITES_BUCKET.put(SIDECAR(P), newer);
      });
      const r1 = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.equal(moved, true, "the newer work never moved the pointer: the observer is dead");
      assert.equal(bare(P.readObj(SIDECAR(P))), newer, "the newer activation's sidecar was overwritten by an older version's");
      assert.deepEqual([liveVersion(P), price(db, 2), draftOf(P).applied], [other, 5.2, 0], JSON.stringify(r1));
      P.advance(PAUSE);
      const r2 = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
      assert.deepEqual([journalOf(P).phase, bare(P.readObj(SIDECAR(P))), price(db, 2)], ["retired", newer, 5.2], JSON.stringify(r2));
    } finally { await finish(P, compiler); }
  }
});

test("DFR11 A FIRST PUBLICATION STOPPED BEFORE ITS SCRIPT — nothing was live before (no pointer, no live marker); the activation's pointer lands and it stops before the script: the sweep puts the script up, sees it serving, creates the live marker every site script asks for, and only then finishes; a second sweep changes nothing", async () => {
  const { P, db, compiler } = bakery("dfr11");
  const { draftFirstApi } = await loadWorkerModule();
  const MARK = (P) => "sites/" + P.slug + "/site.live";
  try {
    const { d } = await approved(P);
    // NOTHING LIVE YET: the pointer and the marker taken away, as on a site never published.
    await P.env.SITES_BUCKET.delete([POINTER(P), MARK(P)]);
    const stopped = stopBefore(P, NOTE(P));
    clickAway(P, { revision: d.rev, version: d.version });
    await stopped;
    assert.deepEqual([liveVersion(P), journalOf(P).phase, journalOf(P).from, P.readObj(MARK(P))], [d.version, "switching", "", null], "not the interruption described");
    P.advance(STALE);
    const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.equal(r.finished, 1, JSON.stringify(r));
    assert.ok(P.readObj(MARK(P)), "finished with no live marker: the site answers 404");
    assert.deepEqual([await serving(P), price(db, 2), draftOf(P).applied, journalOf(P).phase], [d.version, 5.6, d.rev, "finished"]);
    const ups = P.uploads().length;
    const again = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.deepEqual([again.finished, P.uploads().length, price(db, 2)], [0, ups, 5.6]);
  } finally { await finish(P, compiler); }
});

test("DFB11 EVERY BACKEND WRITE A TASK MAKES GOES THROUGH ITS WRITER — in worker.js the schema apply, the starter rows and the job registration are called only by the writer (Publish applies through it, switched off), or under a binding of those very names from a task's writer (`= aWriter.calls` and its build and rules twins); the data step, the add-on's entries and the address hold before they write; the build carries its hold to its resume", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const body = (name) => { const i = src.indexOf("async function " + name + "("); assert.ok(i >= 0, name + " is missing"); return [i, src.indexOf("\n}\n", i)]; };
  const [w0, w1] = body("backendWriter");
  // PUBLISH APPLIES THROUGH THE SAME WRITER, SWITCHED OFF.
  const [p0, p1] = body("runPublication");
  assert.match(src.slice(p0, p1), /const live = \(await backendWriter\(\{ \.\.\.env, DRAFT_FIRST: "" \}, slug\)\)\.calls;/);
  const binds = [...src.matchAll(/const \{ applySiteSchema(?:, seedSiteRows, persistSiteJobs)? \} = ([abr])Writer\.calls;/g)].map((m) => ({ at: m.index, who: m[1] }));
  assert.deepEqual(binds.map((b) => b.who).sort(), ["a", "b", "r"], "a task's binding from its writer is gone: " + JSON.stringify(binds));
  for (const fn of ["applySiteSchema", "seedSiteRows", "persistSiteJobs"]) {
    const sites = [...src.matchAll(new RegExp("(?<![.\\w])" + fn + "\\(", "g"))].map((m) => m.index)
      .filter((i) => !/async function $/.test(src.slice(Math.max(0, i - 15), i)) && !/^\s*(\/\/|\*)/.test(src.slice(src.lastIndexOf("\n", i) + 1, i)));
    assert.ok(sites.length >= 2, fn + ": the observer found no call sites");
    for (const i of sites) {
      if (i > w0 && i < w1) continue;
      const bound = binds.filter((b) => b.at < i).pop();
      const between = bound ? src.slice(bound.at, i) : "";
      assert.ok(bound && !/\n(async )?function /.test(between), fn + " is called outside the writer or a task's binding: " + src.slice(src.lastIndexOf("\n", i) + 1, i + 60));
    }
  }
  const apply0 = src.indexOf("apply: async (c) => {");
  assert.ok(apply0 > 0 && src.indexOf("if (dWriter.holding) {", apply0) < src.indexOf("DELETE FROM", apply0), "the data step writes before it asks whether to hold");
  assert.ok(src.indexOf("if (aWriter.holding) {") < src.indexOf("const rowWrite = rowsInsert("), "the add-on's entries are written before the hold is asked");
  // THE ADDRESS: the rename layer holds before its first alias write.
  const rn = src.indexOf('if (eLayer === "rename") {');
  assert.ok(rn > 0 && src.indexOf("if (nWriter.holding) {", rn) < src.indexOf("const badOld = await putAlias(rows.demote);", rn), "the address is written before the hold is asked");
  assert.match(src, /held: bWriter\.hold && !bWriter\.hold\.empty \? bWriter\.hold : null,/);
  assert.match(src, /attachmentIds = null, media = null, held = null \}\) \{/);
});

// ── AUDIT A11-1 / A38-1 (2026-10-18): Back online never activates the draft ──

test("DFO1 BACK ONLINE PUTS BACK THE PUBLISHED VERSION, NEVER THE DRAFT — published once, then (draft-first) a page line saved as an unpublished draft revision; taken offline and put back online through the route: the live pointer is the published version again, the draft's version never goes live, and the draft stays unpublished", async () => {
  const { P, compiler } = bakery("dfo1");
  try {
    await runOne(P, TIKTOK);
    const v0 = liveVersion(P);
    assert.ok(v0, "nothing was published — nothing here tests a live site");
    P.env.DRAFT_FIRST = "on";
    await runOne(P, TIKTOK_LATER);
    const d = draftOf(P);
    assert.ok(d && d.version && d.version !== v0, "no draft version was saved beside the live one");
    const off = await call(P, "POST", "/api/site/" + P.slug + "/offline", { on: true });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.equal(off.body.ok, true, JSON.stringify(off.body));
    const on = await call(P, "POST", "/api/site/" + P.slug + "/offline", { on: false });
    assert.equal(on.body.ok, true, "the site did not come back: " + JSON.stringify(on.body));
    assert.notEqual(liveVersion(P), d.version, "Back online put the unpublished draft live");
    assert.equal(liveVersion(P), v0, "Back online did not put back the published version");
    assert.equal(draftOf(P).version, d.version, "the draft itself was lost");
  } finally { await finish(P, compiler); }
});

// ── AUDIT BATCH 1's survivors R1 / R4 (2026-10-18) ───────────────────────────

test("DFR-L A NAME LOOKUP THAT FAILS IS NEVER A FREE NAME — the rename refuses with nothing written (R1); a held rename whose name cannot be checked at Publish does not move the live address (R4)", async () => {
  const aliases = [];
  const { P, compiler } = bakery("dfrl", { aliases });
  let failing = true;
  P.failRest((url) => failing && url.includes("site_backends") && url.includes("slug=eq.fold-street-bakery&select=slug"));
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    const r1 = await runOne(P, RENAME("fold-street-bakery"));
    assert.notEqual(r1.body && r1.body.renamedInDraft, "fold-street-bakery", "a rename went through on a lookup that failed: " + JSON.stringify(r1.body).slice(0, 300));
    assert.deepEqual(aliases, []);
    // R4: held while the lookup works, then Publish while it fails.
    failing = false;
    const r2 = await runOne(P, RENAME("fold-street-bakery"));
    assert.equal(r2.body.renamedInDraft, "fold-street-bakery", JSON.stringify(r2.body).slice(0, 300));
    failing = true;
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: st.body.revision, version: st.body.draft });
    assert.notEqual(currentAlias(aliases), "fold-street-bakery", "Publish moved the live address onto a name it could not check: " + JSON.stringify(aliases));
  } finally { await finish(P, compiler); }
});

// ── A09-7: AN UNREADABLE LIVE SCHEMA AT PUBLISH IS NOT "EVERY TABLE IS NEW" ──
// (2026-10-18.) `newTablesOf` read the live schema through the tolerant door
// with `.catch(() => null)`, so a failed `_meta` read made every held table
// count as fresh, and the start phase applied the whole held spec — held access
// and rules changes included — to the live database before the switch. Now the
// read that can say "unreadable" stops the start phase: nothing applied, a
// temporary answer, the journal left open for the next click or the sweep.
test("DFA7 A PUBLISH WHOSE LIVE SCHEMA CANNOT BE READ CHANGES NOTHING — no DDL, no switch, a retryable 'your database didn't answer' stop; a later Publish with the database answering goes through", async () => {
  const { invalidateSiteSchema } = await import("../site-schema.mjs");
  const slug = slugOf("dfa7");
  const GALLERY_T = { name: "gallery", columns: [{ name: "title", type: "text" }], read: "public", write: "none" };
  const site = previewSite(slug, [{ kind: "schema", spec: { tables: [{ ...LOAVES, write: "public" }, GALLERY_T] } }]);
  const sent = [];
  let down = true;
  const inner = site.fetchStub;
  site.fetchStub = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (/neon\.tech\/sql|\/sql$/.test(url) && !url.startsWith(DATA_API)) {
      let q = "";
      try { q = String(JSON.parse(String((init && init.body) || "{}")).query || ""); } catch { q = ""; }
      if (down && /SELECT v FROM _meta WHERE k='schema'/i.test(q)) return new Response("upstream timed out", { status: 500 });
      sent.push(q);
    }
    return inner(input, init);
  };
  invalidateSiteSchema("postgres://u:p@ep-draft.neon.tech/neondb");
  const shown = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/draft", { auth: true });
  assert.equal(shown.json.state, "saved", shown.text.slice(0, 200));
  const pub = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/publish", { method: "POST", auth: true, body: { revision: shown.json.revision, version: shown.json.draft } });
  assert.equal(pub.status, 503, pub.text.slice(0, 300));
  assert.match(String(pub.json && pub.json.error), /database didn't answer/i, pub.text.slice(0, 300));
  assert.deepEqual(sent.filter((q) => /\b(CREATE|ALTER|GRANT|POLICY)\b|INSERT INTO _meta/i.test(q)), [], "the held schema reached the live database");
  assert.equal(JSON.parse(bare(site.store.store.get("current/" + slug + ".json"))).version, V0, "the pointer moved");
  assert.equal(JSON.parse(bare(site.store.store.get(DRAFT_KEY(slug)))).applied, 0, "the revision was counted as published");
  // THE DATABASE ANSWERS AGAIN: the same Publish goes through.
  down = false;
  invalidateSiteSchema("postgres://u:p@ep-draft.neon.tech/neondb");
  const again = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/publish", { method: "POST", auth: true, body: { revision: shown.json.revision, version: shown.json.draft } });
  assert.equal(again.status, 200, again.text.slice(0, 300));
  assert.ok(sent.some((q) => /CREATE TABLE IF NOT EXISTS gallery|CREATE TABLE IF NOT EXISTS "gallery"/i.test(q)), "the new table was not made once the database answered");
});

test("DFA7b ONLY THE PUBLISH'S OWN READ FAILS (twice) — the held `loaves` rules change is not taken for a new table and applied: the start phase stops before the apply runs at all", async () => {
  const { invalidateSiteSchema } = await import("../site-schema.mjs");
  const slug = slugOf("dfa7");
  const GALLERY_T = { name: "gallery", columns: [{ name: "title", type: "text" }], read: "public", write: "none" };
  const site = previewSite(slug, [{ kind: "schema", spec: { tables: [{ ...LOAVES, write: "public" }, GALLERY_T] } }]);
  const sent = [];
  let down = 2; // exactly newTablesOf's read and its one retry
  const inner = site.fetchStub;
  site.fetchStub = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (/neon\.tech\/sql|\/sql$/.test(url) && !url.startsWith(DATA_API)) {
      let q = "";
      try { q = String(JSON.parse(String((init && init.body) || "{}")).query || ""); } catch { q = ""; }
      if (down > 0 && /SELECT v FROM _meta WHERE k='schema'/i.test(q) && down--) return new Response("upstream timed out", { status: 500 });
      sent.push(q);
    }
    return inner(input, init);
  };
  invalidateSiteSchema("postgres://u:p@ep-draft.neon.tech/neondb");
  const shown = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/draft", { auth: true });
  assert.equal(shown.json.state, "saved", shown.text.slice(0, 200));
  const pub = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/publish", { method: "POST", auth: true, body: { revision: shown.json.revision, version: shown.json.draft } });
  assert.equal(pub.status, 503, pub.text.slice(0, 300));
  assert.match(String(pub.json && pub.json.error), /database didn't answer/i, pub.text.slice(0, 300));
  assert.deepEqual(sent.filter((q) => /\b(CREATE|ALTER|GRANT|POLICY)\b|INSERT INTO _meta/i.test(q)), [], "the held schema reached the live database");
  assert.equal(JSON.parse(bare(site.store.store.get("current/" + slug + ".json"))).version, V0, "the pointer moved");
  assert.equal(JSON.parse(bare(site.store.store.get(DRAFT_KEY(slug)))).applied, 0, "the revision was counted as published");
  assert.equal(down, 0, "the publish did not read the live schema twice");
});

test("DFH1 A HELD ROW CHANGE IS CHECKED WHEN IT IS HELD (2026-10-18, audit A09-3, A09-2) — a price the column cannot take and a new loaf whose name is already on the list are refused at once with the reason, nothing held and nothing written; a good change after them is held as before", async () => {
  const { P, db, compiler } = bakery("dfh1", { unique: ["name"] });
  try {
    const first = await runOne(P, TIKTOK);
    assert.equal(first.jobs[0].state, "done", JSON.stringify(first.jobs[0].result).slice(0, 300));
    P.env.DRAFT_FIRST = "on";
    const rows0 = JSON.stringify(db.rows("loaves"));
    const bad = await runOne(P, "Make the Dark Rye four pounds twenty.");
    assert.notEqual(bad.body && bad.body.ok, true, "a price the column cannot take was held: " + JSON.stringify(bad.body).slice(0, 300));
    assert.match(String(bad.body && bad.body.msg), /couldn't be saved: .*(numeric|right kind)/i, "the reply does not say why: " + (bad.body && bad.body.msg));
    assert.equal(draftOf(P), null, "a refused change was held in the draft: " + JSON.stringify(draftOf(P)));
    const dup = await runOne(P, "Add another Dark Rye at £5.");
    assert.notEqual(dup.body && dup.body.ok, true, "a duplicate name was held");
    assert.match(String(dup.body && dup.body.msg), /already/i, "the reply does not say the name is taken: " + (dup.body && dup.body.msg));
    assert.equal(draftOf(P), null, "a refused new row was held");
    assert.equal(JSON.stringify(db.rows("loaves")), rows0, "a check changed the live rows");
    // THE OBSERVER IS ALIVE: a good change is still held.
    const good = await runOne(P, RYE);
    assert.equal(good.jobs[0].state, "done", JSON.stringify(good.jobs[0].result).slice(0, 300));
    assert.equal(draftOf(P).rev, 1);
    assert.equal(JSON.stringify(db.rows("loaves")), rows0, "the held change was written live");
  } finally { await finish(P, compiler); }
});


/** A loaf added on the live site by the owner's own panel, after a draft held one. */
async function addLive(db, name, price) {
  const r = db.answer('INSERT INTO "loaves" ("name", "price") VALUES ($1, $2)', [name, String(price)]);
  assert.equal(r.status, 200, "the live insert was refused: " + (await r.clone().text()));
}
test("DFH3 A HELD NEW ROW THAT NOW CLASHES STOPS PUBLISH BEFORE ANYTHING GOES LIVE (2026-10-18, audit A09-2) — Spelt held, then a Spelt added on the live site: Publish refuses with the reason before its switch; the live version, the rows and the record are unchanged; renamed live, the same revision then publishes", async () => {
  const { P, db, compiler } = bakery("dfh3", { unique: ["name"] });
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    await runOne(P, TIKTOK_LATER);
    const d = draftOf(P);
    const v0 = liveVersion(P);
    await addLive(db, "Spelt", 6);
    const rows0 = JSON.stringify(db.rows("loaves"));
    const p = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.revs[d.rev - 1].version });
    assert.notEqual(p.status, 200, "a clashing publication answered ok: " + JSON.stringify(p.body).slice(0, 300));
    assert.match(String(p.body && p.body.error), /already there/i, "the stop does not say why: " + JSON.stringify(p.body).slice(0, 300));
    assert.match(String(p.body && p.body.error), /nothing changed on your live site/i);
    assert.equal(liveVersion(P), v0, "the new version went live with a clashing row held");
    assert.equal(JSON.stringify(db.rows("loaves")), rows0, "a row moved");
    assert.equal(draftOf(P).applied, 0, "the record says published");
    // THE OBSERVER IS ALIVE: with the clash gone, the same revision publishes.
    db.answer('UPDATE "loaves" SET "name" = $1 WHERE id = $2', ["Spelt (live)", db.rows("loaves").find((r) => r.name === "Spelt").id]);
    const again = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.revs[d.rev - 1].version });
    assert.equal(again.status, 200, JSON.stringify(again.body).slice(0, 300));
    assert.deepEqual(spelt(db).map((r) => Number(r.price)), [6.2]);
  } finally { await finish(P, compiler); }
});

test("DFH4 A UNIQUE CLASH AFTER THE SWITCH IS NEVER TAKEN FOR A REPEAT (2026-10-18, audit A09-2) — the pre-switch check goes unanswered, so the clash meets the insert itself: the publication is not finished, 'inserts' is not marked done, the record is not marked, and nothing reports success", async () => {
  const { P, db, compiler } = bakery("dfh4", { unique: ["name"] });
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    const d = draftOf(P);
    await addLive(db, "Spelt", 6);
    db.rehearsalsDown(10);
    const p = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.revs[d.rev - 1].version });
    assert.notEqual(p.status, 200, "a clash after the switch answered ok: " + JSON.stringify(p.body).slice(0, 300));
    const jr = journalOf(P);
    assert.ok(jr && !(jr.done || []).includes("inserts"), "the inserts were marked done: " + JSON.stringify(jr));
    assert.notEqual(jr.phase, "finished");
    assert.equal(draftOf(P).applied, 0, "the record says published");
    assert.equal(spelt(db).length, 1, "the held Spelt went in beside the live one");
  } finally { await finish(P, compiler); }
});

test("DFH5 A CHANGE THAT CAN NEVER BE FINISHED IS BLOCKED, NOT RETRIED FOREVER (2026-10-18, audit A06-4) — a clash met after the switch: the stop is a 409 that names it and says it won't be retried; the sweep, even an hour on, runs nothing; a click on a newer revision is told about the blocked one instead of re-running it; the owner's own click on the blocked revision tries once more and, with the clash gone, finishes", async () => {
  const { P, db, compiler } = bakery("dfh5", { unique: ["name"] });
  const { draftFirstApi } = await loadWorkerModule();
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, SPELT);
    const d = draftOf(P);
    await addLive(db, "Spelt", 6);
    db.rehearsalsDown(10);
    const p = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.revs[d.rev - 1].version });
    assert.deepEqual([p.status, p.body.blocked], [409, true], JSON.stringify(p.body).slice(0, 300));
    assert.match(String(p.body.error), /already on the list.*won't be retried/);
    const j1 = journalOf(P);
    assert.ok(j1.blocked && j1.blocked.stage === "inserts", "the journal is not marked blocked: " + JSON.stringify(j1));
    // THE SWEEP LEAVES IT ALONE, whatever the time.
    P.advance(60 * 60 * 1000);
    const writes0 = db.writes().length;
    const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    assert.deepEqual([r.finished, r.cleared], [0, 0], JSON.stringify(r));
    assert.equal(journalOf(P).attempts, j1.attempts, "the sweep ran a blocked publication again");
    assert.equal(db.writes().length, writes0, "the sweep wrote to the database for a blocked publication");
    // A NEWER REVISION IS TOLD, NOT WEDGED BEHIND IT.
    await runOne(P, WALNUT);
    const d2 = draftOf(P);
    const p2 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d2.rev, version: d2.revs[d2.rev - 1].version });
    assert.deepEqual([p2.status, p2.body.blocked, p2.body.revision], [409, true, d.rev], JSON.stringify(p2.body).slice(0, 300));
    assert.equal(journalOf(P).attempts, j1.attempts, "another revision's click re-ran the blocked one");
    // A TEMPORARY FAULT THAT KEEPS COMING BACK IS BLOCKED AT THE CAP: the
    // journal as if it had failed seven times, due now; the draft unreadable.
    await P.env.SITES_BUCKET.put(JOURNAL(P), JSON.stringify({ ...journalOf(P), blocked: null, attempts: 7, nextTry: Date.now() - 1 }));
    P.failGet((k) => k === DRAFT_KEY(P.slug));
    await P.run(() => draftFirstApi.runPublishRecovery(P.env));
    const j8 = journalOf(P);
    assert.ok(j8.blocked && j8.attempts === 8, "the eighth temporary stop was not blocked: " + JSON.stringify(j8));
    // THE OWNER'S OWN CLICK, once the clash is gone, finishes it — and the
    // finished journal carries no block.
    db.answer('UPDATE "loaves" SET "name" = $1 WHERE id = $2', ["Spelt (live)", db.rows("loaves").find((x) => x.name === "Spelt").id]);
    const p3 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.revs[d.rev - 1].version });
    assert.equal(p3.status, 200, JSON.stringify(p3.body).slice(0, 300));
    assert.equal(draftOf(P).applied, d.rev);
    assert.ok(!journalOf(P).blocked, "the finished publication still carries its old block: " + JSON.stringify(journalOf(P)));
    assert.deepEqual(spelt(db).map((x) => Number(x.price)), [6.2]);
  } finally { await finish(P, compiler); }
});

test("DFH6 A TEMPORARY STOP WAITS A DOUBLING PAUSE, AND BLOCKED OR WAITING SITES DO NOT TAKE THE SWEEP'S TURNS (2026-10-18, audit A06-4) — a journal not yet due is not run; with one turn per tick, a blocked site listed first does not keep a stale one behind it from being set aside", async () => {
  const { P, compiler } = bakery("dfh6");
  const { draftFirstApi } = await loadWorkerModule();
  try {
    const now = Date.now();
    const blocked = { v: 1, slug: "aaaa-blocked", n: 1, version: "01790000000000-bbbbbb", uid: "", id: "x", running: false, at: now - 3600e3, phase: "switched", from: "", done: [], refs: {}, error: "inserts: x", attempts: 1, blocked: { stage: "inserts", why: "x", at: now } };
    const waiting = { ...blocked, slug: "aaab-waiting", blocked: undefined, nextTry: now + 10 * 60 * 1000 };
    const stale = { v: 1, slug: P.slug, n: 1, version: "01790000000000-cccccc", uid: "", id: "y", running: false, at: now - 3600e3, phase: "start", from: null, done: [], refs: {}, error: null, attempts: 0 };
    await P.env.SITES_BUCKET.put(PUBLISHING_KEY("aaaa-blocked"), JSON.stringify(blocked));
    await P.env.SITES_BUCKET.put(PUBLISHING_KEY("aaab-waiting"), JSON.stringify(waiting));
    await P.env.SITES_BUCKET.put(PUBLISHING_KEY(P.slug), JSON.stringify(stale));
    const r = await P.run(() => draftFirstApi.runPublishRecovery(P.env, { now, max: 1 }));
    assert.deepEqual([r.finished, r.cleared], [0, 1], JSON.stringify(r));
    assert.equal(JSON.parse(bare(P.readObj(PUBLISHING_KEY(P.slug)))).phase, "retired", "the stale journal behind the blocked one was not set aside");
    assert.equal(JSON.parse(bare(P.readObj(PUBLISHING_KEY("aaab-waiting")))).attempts, 1, "a journal not yet due was run");
  } finally { await finish(P, compiler); }
});

test("DFH7 SET ASIDE FINISHES A BLOCKED PUBLICATION WITHOUT ONLY WHAT THE DATABASE REFUSES (2026-10-18, audit A06-4) — Spelt and Barley held, a live Spelt added, Publish blocked on the clash: set-aside answers ok, names the Spelt it skipped, adds Barley once, marks the revision published and closes the journal; a newer revision then publishes; set-aside with nothing blocked is refused", async () => {
  const { P, db, compiler } = bakery("dfh7", { unique: ["name"] });
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, "Add Barley, Spelt and Oat at £4.90, £6.20 and £4.40.");
    const d = draftOf(P);
    await addLive(db, "Spelt", 6);
    db.rehearsalsDown(10);
    const p = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.revs[d.rev - 1].version });
    assert.deepEqual([p.status, p.body.blocked], [409, true], JSON.stringify(p.body).slice(0, 300));
    // THE OWNER SEES WHAT IS BLOCKED, AND WHY.
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.equal(st.body.publication && st.body.publication.blocked && st.body.publication.blocked.stage, "inserts", JSON.stringify(st.body.publication));
    // A TEMPORARY FAULT DURING THE SET-ASIDE IS NOT SET ASIDE: it stops, skips nothing.
    db.failNextWrite("57P01");
    const t = await call(P, "POST", "/api/site/" + P.slug + "/publish/set-aside", { revision: d.rev });
    assert.notEqual(t.status, 200, JSON.stringify(t.body).slice(0, 300));
    assert.deepEqual(t.body.skipped || [], [], "a temporary fault was set aside");
    assert.equal(db.rows("loaves").filter((r) => r.name === "Barley").length, 0);
    // PRESSED AGAIN (the owner's own click carries the set-aside on).
    const sa = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.revs[d.rev - 1].version });
    assert.equal(sa.status, 200, JSON.stringify(sa.body).slice(0, 400));
    assert.deepEqual(sa.body.skipped.map((x) => [x.stage, x.table]), [["inserts", "loaves"]], JSON.stringify(sa.body.skipped));
    assert.match(sa.body.skipped[0].why, /already there/);
    assert.deepEqual(db.rows("loaves").filter((r) => r.name === "Barley").map((r) => Number(r.price)), [4.9], "the good row was not added once");
    assert.deepEqual(db.rows("loaves").filter((r) => r.name === "Oat").map((r) => Number(r.price)), [4.4], "the row after the skipped one was not added once");
    assert.deepEqual(spelt(db).map((r) => Number(r.price)), [6], "the live Spelt was changed or a second added");
    assert.equal(draftOf(P).applied, d.rev);
    assert.equal(journalOf(P).phase, "finished");
    // NOTHING LEFT BLOCKED: a newer revision publishes.
    await runOne(P, WALNUT);
    const d2 = draftOf(P);
    const p2 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d2.rev, version: d2.revs[d2.rev - 1].version });
    assert.equal(p2.status, 200, JSON.stringify(p2.body).slice(0, 300));
    assert.equal(price(db, 5), 6.4);
    // SET-ASIDE WITH NOTHING BLOCKED IS REFUSED, AND CHANGES NOTHING.
    const none = await call(P, "POST", "/api/site/" + P.slug + "/publish/set-aside", { revision: d2.rev });
    assert.equal(none.status, 409, JSON.stringify(none.body));
  } finally { await finish(P, compiler); }
});

test("DFH8 A VERSIONS RESTORE MOVES THE DRAFT WITH IT (2026-10-18, audit A06-2) — a page line published as revision 1, then the older version restored: the draft reads published on the restored version; the next edit starts from the restored pages (the repair never copies the newer ones back); its Publish keeps the restored pages live; a restore with unpublished changes held is refused and changes nothing", async () => {
  const { P, db, compiler } = bakery("dfh8");
  try {
    await runOne(P, TIKTOK);
    const v0 = liveVersion(P);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, TIKTOK_LATER);
    const d1 = draftOf(P);
    const p1 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d1.rev, version: d1.version });
    assert.equal(p1.status, 200, JSON.stringify(p1.body).slice(0, 300));
    assert.equal(liveVersion(P), d1.version);
    // THE RESTORE.
    const rs = await call(P, "POST", "/api/site/" + P.slug + "/versions/restore", { id: v0 });
    assert.equal(rs.status, 200, JSON.stringify(rs.body).slice(0, 300));
    assert.equal(liveVersion(P), v0);
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.body.state, st.body.unpublished, st.body.draft], ["published", false, v0], "the draft did not follow the restore: " + JSON.stringify([st.body.state, st.body.draft]));
    // THE NEXT EDIT STARTS FROM THE RESTORED PAGES.
    const e = await runOne(P, RYE);
    assert.equal(e.jobs[0].state, "done", JSON.stringify(e.jobs[0].result).slice(0, 300));
    assert.equal(P.page("visit.tsx").includes(TT_LATER), false, "the repair copied the newer pages back over the restored ones");
    assert.equal(P.page("visit.tsx").includes(TT_TO), true);
    const d2 = draftOf(P);
    const p2 = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d2.rev, version: d2.revs[d2.rev - 1].version });
    assert.equal(p2.status, 200, JSON.stringify(p2.body).slice(0, 300));
    assert.equal(liveVersion(P), v0, "the next Publish put the rolled-back version live again");
    assert.equal(price(db, 2), 5.6);
    // WITH A CHANGE HELD, A RESTORE IS REFUSED AND CHANGES NOTHING.
    await runOne(P, WALNUT);
    const held = draftOf(P);
    const no = await call(P, "POST", "/api/site/" + P.slug + "/versions/restore", { id: d1.version });
    assert.equal(no.status, 409, JSON.stringify(no.body).slice(0, 300));
    assert.match(String(no.body.error), /aren't published yet/);
    assert.equal(liveVersion(P), v0);
    assert.deepEqual([draftOf(P).rev, draftOf(P).version], [held.rev, held.version]);
  } finally { await finish(P, compiler); }
});

test("DFH8b A RESTORE THAT STOPS BEFORE IT MOVES THE DRAFT IS NOT UNDONE BY THE NEXT EDIT (2026-10-18, audit A06-2) — the draft's read fails right after the pages are restored: the draft still names the newer, published version; the next edit's repair keeps the live, restored pages", async () => {
  const { P, compiler } = bakery("dfh8b");
  try {
    await runOne(P, TIKTOK);
    const v0 = liveVersion(P);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, TIKTOK_LATER);
    const d1 = draftOf(P);
    assert.equal((await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d1.rev, version: d1.version })).status, 200);
    // THE ROUTE'S OWN CHECK READS THE DRAFT; THE MOVE AFTER THE RESTORE CANNOT.
    P.failGetFrom((k) => k === DRAFT_KEY(P.slug), { skip: 1, count: 1 });
    const rs = await call(P, "POST", "/api/site/" + P.slug + "/versions/restore", { id: v0 });
    assert.equal(rs.status, 200, JSON.stringify(rs.body).slice(0, 300));
    assert.equal(draftOf(P).version, d1.version, "the draft moved: this case tests nothing");
    assert.equal(liveVersion(P), v0);
    const e = await runOne(P, RYE);
    assert.equal(e.jobs[0].state, "done", JSON.stringify(e.jobs[0].result).slice(0, 300));
    assert.equal(P.page("visit.tsx").includes(TT_LATER), false, "the repair copied the published draft's pages back over the restore");
  } finally { await finish(P, compiler); }
});

test("DFH9 A DELETED SITE'S DRAFT GOES WITH IT (2026-10-18, audit A07-1) — the draft record, its held journals and summary, the publication journal, the preview's state, readiness and claims, and the preview's own script are removed; a neighbour whose name starts the same is untouched; the site delete calls it", async () => {
  const { draftFirstApi, siteTurn } = await loadWorkerModule();
  void siteTurn;
  const store = new Map();
  const S = "fold-lane", N = "fold-lane-2";
  const mine = [DRAFT_KEY(S), HELD_KEY(S, "a".repeat(24)), "site-drafts/" + S + "/held-sum.json", PUBLISHING_KEY(S), "preview-state/" + S + ".json", "preview-up/" + S + ".json", "preview-claims/" + S + "/c1.json"];
  const theirs = [DRAFT_KEY(N), HELD_KEY(N, "b".repeat(24)), PUBLISHING_KEY(N), "preview-claims/" + N + "/c1.json", "sites/" + S + "/index.html"];
  for (const k of [...mine, ...theirs]) store.set(k, "{}");
  const bucket = {
    delete: async (k) => { store.delete(k); },
    list: async ({ prefix }) => ({ objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
  };
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { asked.push([init && init.method, String(url)]); return new Response(JSON.stringify({ success: true }), { status: 200 }); };
  try {
    const out = await draftFirstApi.clearSiteDraft({ SITES_BUCKET: bucket, CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "t" }, S);
    assert.equal(out.failed, 0, JSON.stringify(out));
  } finally { globalThis.fetch = real; }
  for (const k of mine) assert.equal(store.has(k), false, k + " was left behind");
  for (const k of theirs) assert.equal(store.has(k), true, k + " was removed with the wrong site");
  assert.ok(asked.some(([m, u]) => m === "DELETE" && u.endsWith("/scripts/" + encodeURIComponent(previewScriptNameOf(S)))), "the preview script was not removed: " + JSON.stringify(asked));
  // THE SITE DELETE CALLS IT, before the ownership row goes.
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("async function deleteSiteFor(env, uid, dslug) {");
  const b = src.indexOf("\nasync function ", a + 10);
  assert.ok(a > 0 && b > a, "deleteSiteFor's landmarks moved");
  assert.match(src.slice(a, b), /await clearSiteDraft\(env, dslug\);/, "the site delete does not clear the draft");
});

test("DFH10 DISCARD THE DRAFT (2026-10-18, the owner's word) — a held price and a page line discarded: the draft reads published on the live version; the next edit starts from the live pages; its Publish carries none of the discarded changes; an older version can then be restored; with a publication standing, discard is refused and changes nothing", async () => {
  const { P, db, compiler } = bakery("dfh10", { unique: ["name"] });
  try {
    await runOne(P, TIKTOK);
    const v0 = liveVersion(P);
    P.env.DRAFT_FIRST = "on";
    await runOne(P, RYE);
    await runOne(P, TIKTOK_LATER);
    assert.equal(draftOf(P).rev, 2);
    const dc = await call(P, "POST", "/api/site/" + P.slug + "/draft/discard", {});
    assert.equal(dc.status, 200, JSON.stringify(dc.body).slice(0, 300));
    assert.equal(dc.body.dropped, 2);
    assert.deepEqual([dc.body.state.state, dc.body.state.unpublished, dc.body.state.draft], ["published", false, v0]);
    // THE NEXT EDIT STARTS FROM THE LIVE PAGES, AND ITS PUBLISH CARRIES NOTHING DISCARDED.
    await runOne(P, WALNUT);
    assert.equal(P.page("visit.tsx").includes(TT_LATER), false, "the discarded page line came back");
    const d = draftOf(P);
    const p = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.revs[d.revs.length - 1].version });
    assert.equal(p.status, 200, JSON.stringify(p.body).slice(0, 300));
    assert.deepEqual([price(db, 2), price(db, 5), liveVersion(P)], [5.2, 6.4, v0], "a discarded change was published");
    // WITH A PUBLICATION STANDING (blocked here), DISCARD IS REFUSED.
    await runOne(P, SPELT);
    const d2 = draftOf(P);
    await addLive(db, "Spelt", 6);
    db.rehearsalsDown(10);
    assert.equal((await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d2.rev, version: d2.revs[d2.revs.length - 1].version })).status, 409);
    const no = await call(P, "POST", "/api/site/" + P.slug + "/draft/discard", {});
    assert.equal(no.status, 409, JSON.stringify(no.body).slice(0, 300));
    assert.equal(draftOf(P).rev, d2.rev, "a refused discard changed the draft");
  } finally { await finish(P, compiler); }
});

test("DFH11 A CHANGE THAT NEEDS ANOTHER HELD CHANGE IS NOT REFUSED BY A REHEARSAL ALONE (2026-10-18, review of audit batch 2) — Dark Rye renamed to Spelt (held), then a new Dark Rye added (held): the new row clashes with the live name only until the rename lands; it is held, and Publish applies both in order", async () => {
  const { P, db, compiler } = bakery("dfh11", { unique: ["name"] });
  try {
    await runOne(P, TIKTOK);
    P.env.DRAFT_FIRST = "on";
    const a = await runOne(P, "Call the Dark Rye Spelt instead.");
    assert.equal(a.body && a.body.ok, true, JSON.stringify(a.body).slice(0, 300));
    const b = await runOne(P, "Add another Dark Rye at £5.");
    assert.equal(b.body && b.body.ok, true, "a change that only needs the held rename was refused: " + JSON.stringify(b.body).slice(0, 300));
    const d = draftOf(P);
    const p = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: d.rev, version: d.revs[d.revs.length - 1].version });
    assert.equal(p.status, 200, JSON.stringify(p.body).slice(0, 300));
    assert.deepEqual(db.rows("loaves").filter((r) => r.name === "Dark Rye" || r.name === "Spelt").map((r) => r.name).sort(), ["Dark Rye", "Spelt"]);
  } finally { await finish(P, compiler); }
});

test("DFH12 PUBLISH CHECKS THE STARTER-ROW RULE BEFORE IT BEGINS (2026-10-18, review of audit batch 2) — an earlier revision is refused, with the revision to publish instead, when a later one edits the starter rows it adds; before any journal is written", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // RE-ANCHORED 2026-10-19: the press's talk (`say`) rides in the options now.
  const a = src.indexOf("async function publishDraft(env, slug, pick, { uid = \"\", say = null } = {}) {");
  const b = src.indexOf("for (let i = 0; i < 4; i++) {", a);
  assert.ok(a > 0 && b > a, "publishDraft's landmarks moved");
  const head = src.slice(a, b);
  assert.match(head, /const need = splitsStarterRows\(ranges, rev\.n\);\s*if \(need\) return \{ ok: false, status: 409,/, "Publish can split starter rows from a later change to them");
  assert.match(head, /if \(rev\.n > draft\.applied && rev\.n < draft\.rev\)/);
});

test("DFB12 THE PREVIEW ANSWERS THE PAGE'S OWN QUERY (audit A07-3) — a touched table is read whole and the held rows filtered, ordered and limited with the live ones: a held new row shows only where it matches, a detail read of a live id never answers the held row, a removed row's detail is empty, and a query the preview cannot evaluate is refused, never answered with a row that may not match", async () => {
  const slug = slugOf("dfb12");
  const ops = [
    { kind: "row", table: "loaves", op: "insert", values: { name: "Spelt", price: 6.2 }, ref: HID + ":0" },
    { kind: "row", table: "loaves", op: "remove", id: 2 },
    { kind: "row", table: "loaves", op: "update", id: 3, values: { name: "Spelt" } },
  ];
  const site = previewSite(slug, ops);
  const host = slug + "--draft-" + TOKEN12 + ".gofarther.app";
  const read = async (q) => { const r = await hitWith(site, host, "/api/db/" + slug + "/data/loaves" + q); assert.equal(r.status, 200, q + " " + r.text.slice(0, 300)); return r.json; };
  // THE LIVE SERVICE IS ASKED FOR THE WHOLE TABLE, the query answered here.
  const n0 = site.upstream.length;
  const byName = await read("?select=*&order=id.desc&name=eq.Spelt");
  assert.deepEqual(site.upstream.slice(n0).map((u) => new URL(u.url).search), ["?select=*"], "the live service was asked the page's query before the overlay");
  assert.deepEqual(byName.map((r) => r.id < 0 ? "held" : r.id), ["held", 3], "a filtered list did not answer exactly the matching rows, newest first");
  const top2 = await read("?select=*&order=id.desc&limit=2");
  assert.deepEqual(top2.map((r) => r.id < 0 ? "held" : r.id), ["held", 6], "a limited list ignored the limit or the order");
  const page2 = await read("?select=*&order=id.asc&limit=2&offset=1");
  assert.deepEqual(page2.map((r) => r.id), [3, 4], "the offset was ignored");
  assert.deepEqual((await read("?id=eq.1&select=*")).map((r) => [r.id, r.name]), [[1, "Country White"]], "a live row's detail read answered something else");
  assert.deepEqual(await read("?id=eq.2&select=*"), [], "a removed row's detail read answered a row");
  assert.deepEqual((await read("?name=in.(\"Country White\",Spelt)&order=id.asc")).map((r) => r.id < 0 ? "held" : r.id), [1, 3, "held"]);
  const fts = await hitWith(site, host, "/api/db/" + slug + "/data/loaves?select=*&_fts=fts.rye");
  assert.equal(fts.status, 422, "a query the preview cannot evaluate was answered: " + fts.text.slice(0, 200));
  assert.equal(Array.isArray(fts.json), false);
  for (const q of ["?select=*&or=(name.eq.Spelt,id.eq.1)", "?select=*&na-me=eq.Spelt", "?select=name", "?select=*&name=like.Sp\\", "?select=*&price=like.5*"]) {
    const r = await hitWith(site, host, "/api/db/" + slug + "/data/loaves" + q);
    assert.equal(r.status, 422, q + " was answered: " + r.text.slice(0, 200));
  }
});

test("DFB13 A FIRST CHANGE'S FRAME BEFORE ITS PREVIEW EXISTS (audit A07-5) — a held-only revision names a draft host no script was ever uploaded to: with a dispatch stand-in that throws for a script never uploaded (as production's namespace does), that host answers Not found; the server reads the preview not ready, and the page keeps the frame on the live site with a note until it is read ready, then moves to the draft host and stays there while a later change updates it", async () => {
  const slug = slugOf("dfb13");
  const site = previewSite(slug, [{ kind: "row", table: "loaves", op: "update", id: 2, values: { price: 5.6 } }]);
  const uploaded = new Set();
  const asked = [];
  site.env.SITE_WORKERS = { get: (name) => ({ fetch: async () => { asked.push(name); if (!uploaded.has(name)) throw new Error("Worker not found"); return new Response("page", { status: 200 }); } }) };
  const host = slug + "--draft-" + TOKEN12 + ".gofarther.app";
  const blank = await hitWith(site, host, "/");
  assert.ok(asked.length > 0, "the draft host never asked the dispatch namespace — this case tests nothing");
  assert.equal(blank.status, 404, "the draft host with no script did not answer Not found: " + blank.status);
  const read = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/draft", { auth: true });
  assert.equal(read.status, 200, read.text.slice(0, 300));
  const d = read.json;
  assert.deepEqual([d.enabled, d.unpublished, d.preview], [true, true, "https://" + host + "/"], JSON.stringify(d));
  assert.notEqual(d.previewState, "ready", "a preview never uploaded was read ready");
  // THE PAGE'S OWN FUNCTIONS, given that reading.
  const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const cut = (head) => { const at = CHAT.indexOf("\n" + head); assert.ok(at > 0, head + " is gone"); const end = CHAT.indexOf("\n}", at + 1); return CHAT.slice(at + 1, end + 2); };
  const line = (head) => { const at = CHAT.indexOf("\n" + head); assert.ok(at > 0, head + " is gone"); return CHAT.slice(at + 1, CHAT.indexOf("\n", at + 1) + 1); };
  const ctx = { siteDraftState: {} };
  vm.createContext(ctx);
  vm.runInContext([line("const SITE_DRAFT_HOST ="), cut("function siteDraftFrame(site) {"), cut("function sitePreviewSrc(site, path) {"), "this.api = { sitePreviewSrc, waiting: typeof siteDraftWaiting === 'function' ? siteDraftWaiting : null };", CHAT.includes("\nfunction siteDraftWaiting(site) {") ? cut("function siteDraftWaiting(site) {") : ""].join("\n"), ctx);
  const s = { id: "s1", slug, url: "/s/" + slug + "/", previewV: 0 };
  ctx.siteDraftState[slug] = d;
  assert.equal(ctx.api.sitePreviewSrc(s, "/"), "/s/" + slug + "/?v=0", "the frame moved to a draft host whose preview is not ready (it answers Not found)");
  assert.equal(typeof ctx.api.waiting, "function", "the page has no reading of a draft still being prepared");
  assert.equal(ctx.api.waiting(s), d, "the page does not know the preview is being prepared");
  // The bar says so (the render's own words).
  assert.ok(/draftWaiting \? 'Live site \\u00b7 ' \+ \(waitState === 'failed' \? 'couldn\\u2019t prepare your preview yet' : 'preparing your preview\\u2026'\)/.test(CHAT), "the bar does not say the preview is being prepared");
  // READ READY: the frame moves to the draft host; a later change keeps it there while it updates.
  ctx.siteDraftState[slug] = { ...d, previewState: "ready", previewReady: true };
  assert.equal(ctx.api.sitePreviewSrc(s, "/"), "https://" + host + "/?v=0");
  assert.equal(ctx.api.waiting(s), null);
  ctx.siteDraftState[slug] = { ...d, revision: (d.revision || 1) + 1, previewState: "pending", previewReady: false };
  assert.equal(ctx.api.sitePreviewSrc(s, "/"), "https://" + host + "/?v=0", "a later change sent the frame back to the live site");
  // A NEW DRAFT HOST (a new token, after a discard) waits again.
  const other = "https://" + slug + "--draft-" + "f".repeat(12) + ".gofarther.app/";
  ctx.siteDraftState[slug] = { ...d, preview: other };
  assert.equal(ctx.api.sitePreviewSrc(s, "/"), "/s/" + slug + "/?v=0", "a new draft host was shown before its preview was ready");
});

test("DFB14 TEXT SEARCH IN THE PREVIEW (2026-10-22) — `like` and `ilike` on a touched table answer exactly as PostgREST and Postgres would over the draft's rows: `*` and `%` are any run, `_` one character, a backslash escapes, `ilike` ignores case, the whole value must match; a pattern ending on a lone backslash and a like on a number column are refused; full-text search, `or` and `not` are still refused", async () => {
  const slug = slugOf("dfb14");
  const ops = [
    { kind: "row", table: "loaves", op: "insert", values: { name: "rye_50%", price: 6.2 }, ref: HID + ":0" },
    { kind: "row", table: "loaves", op: "update", id: 3, values: { name: "Light RYE" } },
  ];
  const site = previewSite(slug, ops);
  const host = slug + "--draft-" + TOKEN12 + ".gofarther.app";
  const ids = async (q) => { const r = await hitWith(site, host, "/api/db/" + slug + "/data/loaves" + q); assert.equal(r.status, 200, q + " " + r.text.slice(0, 300)); return r.json.map((x) => (x.id < 0 ? "held" : x.id)); };
  assert.deepEqual(await ids("?select=*&order=id.asc&name=like.*Rye*"), [2], "like is case-sensitive and * is any run");
  assert.deepEqual(await ids("?select=*&order=id.asc&name=ilike.*rye*"), [2, 3, "held"], "ilike ignores case");
  assert.deepEqual(await ids("?select=*&order=id.asc&name=ilike.%25rye"), [2, 3], "% is any run and the end must match");
  assert.deepEqual(await ids("?select=*&order=id.asc&name=like.Dark_Rye"), [2], "_ is one character");
  assert.deepEqual(await ids("?select=*&order=id.asc&name=like.Dark_ye"), [], "_ is exactly one character");
  assert.deepEqual(await ids("?select=*&order=id.asc&name=like.rye\\_50\\%25"), ["held"], "an escaped _ and % are literal");
  assert.deepEqual(await ids("?select=*&order=id.asc&name=like.rye\\_5"), [], "the whole value must match");
  assert.deepEqual(await ids("?select=*&order=id.asc&name=like.ryex50*"), [], "an escaped _ is not a wildcard");
  for (const q of ["?select=*&name=like.Rye\\", "?select=*&price=ilike.5*", "?select=*&_fts=fts.rye", "?select=*&or=(name.ilike.*rye*,description.ilike.*rye*)", "?select=*&name=not.ilike.*rye*"]) {
    const r = await hitWith(site, host, "/api/db/" + slug + "/data/loaves" + q);
    assert.equal(r.status, 422, q + " was answered: " + r.text.slice(0, 200));
  }
});

test("DFB15 A RELOADED PAGE KEEPS A SERVING PREVIEW (2026-10-22) — the draft reading says whether this draft's preview has been up (`previewServed`, from the confirmed-up record against the draft's own unpublished versions); with a later change still landing the reloaded page keeps the frame on the draft host; with nothing of this draft ever up, or another version up, it shows the live site and waits", async () => {
  const slug = slugOf("dfb15");
  const site = previewSite(slug, [{ kind: "row", table: "loaves", op: "update", id: 2, values: { price: 5.6 } }]);
  const host = "https://" + slug + "--draft-" + TOKEN12 + ".gofarther.app/";
  const readDraftNow = async () => { const r = await hitWith(site, "gofarther.dev", "/api/site/" + slug + "/draft", { auth: true }); assert.equal(r.status, 200, r.text.slice(0, 300)); return r.json; };
  const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const cut = (head) => { const at = CHAT.indexOf("\n" + head); assert.ok(at > 0, head + " is gone"); const end = CHAT.indexOf("\n}", at + 1); return CHAT.slice(at + 1, end + 2); };
  const line = (head) => { const at = CHAT.indexOf("\n" + head); assert.ok(at > 0, head + " is gone"); return CHAT.slice(at + 1, CHAT.indexOf("\n", at + 1) + 1); };
  // A FRESH PAGE each time (a reload): nothing remembered from an earlier reading.
  const fresh = (d) => {
    const ctx = { siteDraftState: {} };
    vm.createContext(ctx);
    vm.runInContext([line("const SITE_DRAFT_HOST ="), cut("function siteDraftFrame(site) {"), cut("function sitePreviewSrc(site, path) {"), "this.api = { sitePreviewSrc };"].join("\n"), ctx);
    ctx.siteDraftState[slug] = d;
    return ctx.api.sitePreviewSrc({ id: "s1", slug, url: "/s/" + slug + "/", previewV: 0 }, "/");
  };
  const live = "/s/" + slug + "/?v=0";
  // NOTHING EVER UP: not served, live site.
  const d0 = await readDraftNow();
  assert.notEqual(d0.previewState, "ready");
  assert.equal(d0.previewServed, false, "a preview never up was read as served");
  assert.equal(fresh(d0), live);
  // THE DRAFT'S VERSION CONFIRMED UP, A LATER UPLOAD STILL LANDING (a claim): pending, but served.
  await site.env.SITES_BUCKET.put("preview-up/" + slug + ".json", JSON.stringify({ v: 1, version: V0, at: Date.now() }));
  await site.env.SITES_BUCKET.put("preview-claims/" + slug + "/" + String(Date.now()).padStart(13, "0") + "-abcdef.json", JSON.stringify({ v: 1, at: Date.now() }));
  const d1 = await readDraftNow();
  assert.equal(d1.previewState, "pending", JSON.stringify(d1).slice(0, 300));
  assert.equal(d1.previewServed, true, "the server did not say this draft's preview has been up");
  assert.equal(fresh(d1), host + "?v=0", "a reloaded page sent the frame back to the live site while the draft host serves this draft");
  // A VERSION THAT IS NOT THIS DRAFT'S (discarded, or published over): not served.
  await site.env.SITES_BUCKET.put("preview-up/" + slug + ".json", JSON.stringify({ v: 1, version: "01790000000000-zzzzzz", at: Date.now() }));
  const d2 = await readDraftNow();
  assert.equal(d2.previewServed, false, "a version not of this draft was read as served");
  assert.equal(fresh(d2), live);
  // CANNOT TELL is never served, whatever the field says.
  assert.equal(fresh({ ...d1, previewState: "unknown" }), live);
});
