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
  // THE LIVE ADDRESS (2026-10-28: the site's own Worker). A visitor's read on
  // the live address is the live site's own script's to answer, never the
  // platform's and never the draft's: it is passed to the live script with no
  // preview mark, and the live rows it would read are the live price, with no
  // held row among them.
  const sentBefore = site.dispatched.length;
  const upBefore = site.upstream.length;
  await hitWith(site, slug + ".gofarther.app", "/api/db/" + slug + "/data/loaves?select=*");
  assert.deepEqual(site.dispatched.slice(sentBefore), [{ name: "site-" + slug, path: "/api/db/" + slug + "/data/loaves", preview: null }], "the live read did not go to the live site's own script, unmarked");
  assert.equal(site.upstream.length, upBefore, "the platform read the data service for the live address itself");
  assert.equal(Number(site.db.rows("loaves").find((r) => r.id === 2).price), 5.2, "the live database carries the draft's price");
  assert.equal(site.db.rows("loaves").some((r) => r.name === "Spelt"), false, "the live database carries a held row");
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
  // THE LIVE LIBRARY, AS IT WAS. (2026-10-28: the site's own Worker serves
  // `/u/` on the site's own address from its own bucket; the platform still
  // serves the shared library on the app's address, so that is where it is read.)
  assert.equal((await hitWith(site, "gofarther.dev", "/u/" + slug + "/" + PICTURE)).text, "a picture", "the live picture went before Publish");
  assert.equal((await hitWith(site, "gofarther.dev", "/u/" + slug + "/" + SONG)).text, "the old recording", "the live recording changed before Publish");
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

test("DFB7b (audit A28-6) HELD STARTER ROWS ARE JUDGED BY THE ENGINE'S OWN RULES: past the cap, a table that takes submissions and a list that already has rows are said as skipped, never counted as seeded, and nothing is written", async () => {
  const { draftFirstApi } = await loadWorkerModule();
  const notes = { name: "notes", columns: [{ name: "body", type: "text" }], read: "none", write: "public" };
  const hours = { name: "hours", columns: [{ name: "day", type: "text" }], read: "public", write: "none" };
  const spec = { tables: [LOAVES, hours, notes] };
  const slug = slugOf("dfb7b");
  const site = previewSite(slug, []);
  const real = globalThis.fetch; globalThis.fetch = site.fetchStub;
  try {
    const w = await draftFirstApi.backendWriter(site.env, slug);
    assert.equal(w.holding, true);
    const writes0 = site.db.writes().length;
    const fifteen = Array.from({ length: 15 }, (_, i) => ({ day: "Day " + (i + 1) }));
    const out = await w.seed("postgres://u:p@ep-draft.neon.tech/neondb", spec, { hours: fifteen, notes: [{ body: "made up" }], loaves: [{ name: "Spelt" }] });
    assert.equal(out.held, true);
    assert.deepEqual(out.seeded, { hours: 12 }, "held starter rows were counted past the engine's rules: " + JSON.stringify(out.seeded));
    assert.ok(out.skipped.some((s) => /^hours: 3 starter rows past the first 12/.test(s)), out.skipped.join(" | "));
    assert.ok(out.skipped.some((s) => /^notes: only display tables are seeded/.test(s)), out.skipped.join(" | "));
    assert.ok(out.skipped.some((s) => /^loaves: already has rows/.test(s)), out.skipped.join(" | "));
    assert.equal(out.rows.hours.unattempted, 3);
    assert.equal(site.db.writes().length, writes0, "a held starter row reached the database");
    assert.deepEqual(w.hold.ops.map((o) => o.kind), ["seed"]);
  } finally { globalThis.fetch = real; }
});

test("DFB7 BACKEND WRITES ARE HELD WHERE A LIVE SITE WOULD SEE THEM — on a published site the schema and starter rows are held and the database is not written; before the first publication nothing is held (nobody uses the database yet); with the switch off every write goes live as before; the publication applies the schema and the starter rows", async () => {
  const { draftFirstApi } = await loadWorkerModule();
  const spec = { tables: [LOAVES, { name: "hours", columns: [{ name: "day", type: "text" }], read: "public", write: "none" }] };
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
    const seeded = await w.seed("postgres://x", spec, { hours: [{ day: "Monday" }] });
    assert.deepEqual(seeded.seeded, { hours: 1 });
    assert.equal(site.db.writes().length, writes0, "a held backend write reached the database");
    assert.deepEqual(w.hold.ops.map((o) => o.kind), ["schema", "seed"]);
    // THE PUBLICATION'S PLAN: the latest schema, the seed.
    const pl = publishPlan(w.hold.ops);
    assert.equal(pl.ok, true);
    assert.deepEqual([!!pl.plan.spec, pl.plan.seeds.length], [true, 1]);
    // A SITE NOT YET PUBLISHED: no pointer.
    site.store.store.delete("current/" + slug + ".json");
    const w2 = await draftFirstApi.backendWriter(site.env, slug);
    assert.deepEqual([w2.on, w2.holding], [true, false], "a never-published site's database writes were held");
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


/** A loaf added on the live site by the owner's own panel, after a draft held one. */
async function addLive(db, name, price) {
  const r = db.answer('INSERT INTO "loaves" ("name", "price") VALUES ($1, $2)', [name, String(price)]);
  assert.equal(r.status, 200, "the live insert was refused: " + (await r.clone().text()));
}

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

// THE SITE'S DATABASE AS A FULL-TEXT JUDGE (decide-1a): the data service
// answers the live filter with `liveIds`; the SQL endpoint answers the
// catalog read and the judging query, which "matches" a row when `judge`
// says so over the row it was sent. Every SQL request is recorded with its
// read-only header.
function ftsSite(slug, ops, { liveIds = [], judge = () => false, sqlDown = false, dataDown = false } = {}) {
  const site = previewSite(slug, ops);
  const base = site.fetchStub;
  site.sql = []; site.slug = slug;
  site.ftsAsks = [];
  const DOC = "to_tsvector('english'::regconfig, ((COALESCE(name, ''::text) || ' '::text) || COALESCE(description, ''::text)))";
  const batch = (fields, rows) => new Response(JSON.stringify({ results: [{ command: "SELECT", rowCount: rows.length, rows: rows.map((r) => fields.map((f) => r[f.name])), fields: fields.map((f) => ({ name: f.name, dataTypeID: f.type || 25 })) }] }), { status: 200, headers: { "content-type": "application/json" } });
  site.fetchStub = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.startsWith(DATA_API) && /[?&]_fts=/.test(url)) {
      site.ftsAsks.push(url);
      if (dataDown) return new Response("down", { status: 503 });
      return new Response(JSON.stringify(liveIds.map((id) => ({ id }))), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (/neon\.tech\/sql/.test(url) && !url.startsWith(DATA_API)) {
      let body = {};
      try { body = JSON.parse(String((init && init.body) || "{}")); } catch { body = {}; }
      if (Array.isArray(body.queries)) {
        const h = new Headers((init && init.headers) || {});
        const [q] = body.queries;
        site.sql.push({ query: q.query, params: q.params, readOnly: h.get("neon-batch-read-only") });
        if (sqlDown) return new Response("unavailable", { status: 503 });
        if (/pg_attrdef/.test(q.query)) return batch([{ name: "doc" }, { name: "rel" }], [{ doc: DOC, rel: "loaves" }]);
        if (/jsonb_populate_recordset/.test(q.query)) {
          const rows = JSON.parse(q.params[0]);
          return batch([{ name: "i", type: 20 }], rows.map((r, n) => ({ r, i: String(n + 1) })).filter(({ r }) => judge(r, q.params.slice(1))).map(({ i }) => ({ i })));
        }
      }
    }
    return base(input, init);
  };
  return site;
}

test("DFB16 FULL-TEXT SEARCH IN THE PREVIEW, JUDGED BY THE SITE'S DATABASE (decide-1a, 2026-10-22) — on a touched table the live rows come from the data service's own `_fts` answer and the held rows from one read-only query through the column's generated expression: a held new row that matches appears, one that does not is absent, a live row the draft deletes stays hidden, a changed row is judged by its new value; fts/plfts/phfts/wfts map to PostgREST's functions with an optional config; the query text is a parameter, never SQL; a database that cannot be reached is 422", async () => {
  const slug = slugOf("dfb16");
  const ops = [
    { kind: "row", table: "loaves", op: "insert", values: { name: "Rye Sourdough", price: 6.4 }, ref: HID + ":0" },
    { kind: "row", table: "loaves", op: "insert", values: { name: "Spelt", price: 6.2 }, ref: HID + ":1" },
    { kind: "row", table: "loaves", op: "update", id: 3, values: { name: "Rye and Seed" } },
    { kind: "row", table: "loaves", op: "update", id: 2, values: { name: "Malted Brown", description: "Dense." } },
    { kind: "row", table: "loaves", op: "remove", id: 1 },
  ];
  // THE LIVE DATABASE'S OPINION: rows 1 and 2 match the live filter (row 1 is
  // deleted in the draft, row 2 changed away from it).
  const judge = (r) => /\brye\b/i.test(String(r.name || "") + " " + String(r.description || ""));
  const site = ftsSite(slug, ops, { liveIds: [1, 2], judge });
  const host = slug + "--draft-" + TOKEN12 + ".gofarther.app";
  const r = await hitWith(site, host, "/api/db/" + slug + "/data/loaves?select=*&order=id.asc&_fts=fts.rye");
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.deepEqual(r.json.map((x) => (x.id < 0 ? x.name : x.id)).map(String).sort(), ["3", "Rye Sourdough"], "the draft's matching rows were not exactly the held match and the changed row");
  assert.equal(r.json.find((x) => x.id === 3).name, "Rye and Seed");
  assert.equal(site.ftsAsks.length, 1, "the live filter was not asked of the data service");
  assert.match(site.ftsAsks[0], /_fts=fts\.rye/);
  assert.equal(site.sql.length, 2, "not one catalog read and one judging query");
  for (const s of site.sql) assert.equal(s.readOnly, "true", "a database read was not sent read-only: " + s.query.slice(0, 80));
  assert.deepEqual(site.sql[0].params, ["loaves", "_fts"]);
  const sent = JSON.parse(site.sql[1].params[0]);
  assert.deepEqual(sent.map((x) => x.name).sort(), ["Malted Brown", "Rye Sourdough", "Rye and Seed", "Spelt"], "the held rows sent were not the new and changed rows by their new values");
  assert.match(site.sql[1].query, /@@ to_tsquery\(\$2\)$/);
  assert.equal(site.sql[1].params[1], "rye");

  // THE FOUR OPERATORS, AND A CONFIG.
  for (const [v, fn, cfg] of [["fts.rye", "to_tsquery", null], ["plfts.dark rye", "plainto_tsquery", null], ["phfts.dark rye", "phraseto_tsquery", null], ["wfts.rye -dark", "websearch_to_tsquery", null], ["fts(french).seigle", "to_tsquery", "french"], ["wfts(simple).rye", "websearch_to_tsquery", "simple"]]) {
    const s2 = ftsSite(slugOf("dfb16v"), ops, { liveIds: [], judge: () => true });
    const res = await hitWith(s2, s2Host(s2), "/api/db/" + s2.slug + "/data/loaves?select=*&_fts=" + encodeURIComponent(v));
    assert.equal(res.status, 200, v + " " + res.text.slice(0, 200));
    const j = s2.sql.find((s) => /jsonb_populate_recordset/.test(s.query));
    assert.ok(j, v + ": no judging query");
    const q = v.slice(v.indexOf(".") + 1);
    if (cfg) { assert.ok(j.query.endsWith("@@ " + fn + "($2::regconfig, $3)"), v + ": " + j.query); assert.deepEqual(j.params.slice(1), [cfg, q]); }
    else { assert.ok(j.query.endsWith("@@ " + fn + "($2)"), v + ": " + j.query); assert.deepEqual(j.params.slice(1), [q]); }
  }

  // A MALICIOUS QUERY is a parameter: the SQL text is the benign one's.
  const evil = "x') @@ to_tsquery('a'); DROP TABLE loaves; --";
  const s3 = ftsSite(slugOf("dfb16e"), ops, { liveIds: [], judge: () => false });
  const e = await hitWith(s3, s2Host(s3), "/api/db/" + s3.slug + "/data/loaves?select=*&_fts=fts." + encodeURIComponent(evil));
  assert.equal(e.status, 200, e.text.slice(0, 200));
  const ej = s3.sql.find((s) => /jsonb_populate_recordset/.test(s.query));
  assert.equal(ej.query, site.sql[1].query, "the query text changed the SQL");
  assert.ok(s3.sql.every((s) => !s.query.includes("DROP")), "the query text reached the SQL");
  assert.equal(ej.params[1], evil);
  // A CONFIG THAT IS NOT A NAME is refused before anything is asked.
  const s4 = ftsSite(slugOf("dfb16c"), ops, {});
  const c = await hitWith(s4, s2Host(s4), "/api/db/" + s4.slug + "/data/loaves?select=*&_fts=" + encodeURIComponent("fts(english'::regconfig)).rye"));
  assert.equal(c.status, 422);
  assert.equal(s4.sql.length, 0);

  // CANNOT JUDGE: the database or the data service unreachable — 422, never a guess.
  for (const opt of [{ sqlDown: true }, { dataDown: true }]) {
    const s5 = ftsSite(slugOf("dfb16d"), ops, { liveIds: [2], judge: () => true, ...opt });
    const d = await hitWith(s5, s2Host(s5), "/api/db/" + s5.slug + "/data/loaves?select=*&_fts=fts.rye");
    assert.equal(d.status, 422, JSON.stringify(opt) + " was answered: " + d.text.slice(0, 200));
  }
});
function s2Host(s) { return s.slug + "--draft-" + TOKEN12 + ".gofarther.app"; }

// ── THE OWNER'S PUBLISH DECISIONS (2026-10-23, docs/history/2026-10-23-decide-publish.md) ──

const LIVE_MARK = (P) => "sites/" + P.slug + "/site.live";
const OFFLINE_MARK = (P) => "site-offline/" + P.slug + ".json";
