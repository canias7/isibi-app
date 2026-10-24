// THE FIRST BUILD MAKES THE DATABASE ITS PAGES NEED, AND THE LAST CAPS GO
// (2026-10-24, the owner's word; branch first-build-db-limits).
//
// A. A first build whose design names features that need stored data (a
//    booking form, an editable menu) designs their tables in one backend call,
//    provisions the site's database, creates every table with RLS and
//    column-scoped grants, carries the starter rows, and hands the page writer
//    the schema, so the forms and lists are wired. A site that needs none makes
//    no call and no database.
// B. IMAGE_CAP, MAX_REPAIRS, MAX_STRINGS and compile repair's MAX_FILES are
//    gone: 20 photographs are bought (8 at a time) when purchases are on and
//    none when off; 1,500 strings are translated in batches; 5 pages are
//    repaired in one compile-repair round.
//
// Every model and network answer is supplied; nothing is paid.
import test from "node:test";
import assert from "node:assert/strict";
import {
  wantsFirstBuildBackend, featuresNeedingData, firstBuildBackendTool, firstBuildBackendBrief, mergeFirstBuildBackend,
} from "../builder/first-build-db.mjs";
import { liftBackend, normalizeSchema, applySiteSchema } from "../site-schema.mjs";
import { bandPrompt } from "../builder/page-bands.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";
import { collectStrings, translationBatches, MAX_STRINGS, BATCH_MAX_STRINGS } from "../builder/site-translate.mjs";
import { compileRepairRound, MAX_FILES } from "../builder/compile-repair.mjs";
import { IMAGE_CAP } from "../builder/site-images.mjs";
import { MAX_REPAIRS } from "../builder/site-repair.mjs";
import { driveBuild, GOOD_DESIGN, buildBucket } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { blockedFetch } from "./fixtures/no-network.mjs";

const FEATURES = ["booking a table online", "an editable menu"];
const DESIGN = { ...GOOD_DESIGN, pages: [{ path: "/", name: "Home" }, { path: "/book", name: "Book" }, { path: "/menu", name: "Menu" }], notBuilt: FEATURES };
const BACKEND = {
  tables: [
    { name: "bookings", access: "collect", columns: [{ name: "name", type: "text" }, { name: "email", type: "text" }, { name: "party_size", type: "int" }, { name: "starts_at", type: "timestamptz" }] },
    { name: "menu_items", access: "display", columns: [{ name: "title", type: "text" }, { name: "price", type: "numeric" }] },
  ],
  seed: { menu_items: [{ title: "Sourdough", price: 4.5 }, { title: "Rye", price: 5 }, { title: "Seeded", price: 5.5 }] },
};
const json = (v, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });

// ── A, the pure half ─────────────────────────────────────────────────────────

test("a design naming storage features asks for a backend; a brochure design or one with tables does not", () => {
  assert.equal(wantsFirstBuildBackend(DESIGN), true);
  assert.equal(wantsFirstBuildBackend(GOOD_DESIGN), false, "a site needing nothing stored asked for a database");
  assert.equal(wantsFirstBuildBackend({ ...DESIGN, notBuilt: [] }), false);
  assert.equal(wantsFirstBuildBackend({ ...DESIGN, notBuilt: [7, null, "  "] }), false, "non-strings read as features");
  assert.equal(wantsFirstBuildBackend({ ...DESIGN, tables: [{ name: "x" }] }), false);
  assert.equal(wantsFirstBuildBackend(null), false);
  assert.deepEqual(featuresNeedingData({ notBuilt: [" a ", "a", "b"] }), ["a", "b"]);
});

test("the backend tool is the site tool's own backend property, never a copy", () => {
  const backend = { type: "object", properties: { tables: { type: "array" } } };
  const t = firstBuildBackendTool({ input_schema: { properties: { backend, brand: {} } } });
  assert.equal(t.input_schema.properties.backend, backend);
  assert.deepEqual(Object.keys(t.input_schema.properties).sort(), ["backend", "notBuilt"]);
  assert.throws(() => firstBuildBackendTool({ input_schema: { properties: {} } }), /no backend/);
  const msg = firstBuildBackendBrief("A bakery", DESIGN, FEATURES);
  for (const s of ["A bakery", "/book", "/menu", ...FEATURES]) assert.ok(msg.includes(s), "the backend brief lacks " + s);
});

test("the answer is lifted in; notBuilt becomes only what even a database cannot make; no table changes nothing", () => {
  const m = mergeFirstBuildBackend(DESIGN, { backend: BACKEND, notBuilt: ["card payments"] }, liftBackend);
  assert.equal(m.made, true);
  assert.deepEqual(m.designed.tables.map((t) => t.name), ["bookings", "menu_items"]);
  assert.equal(m.designed.seed.menu_items.length, 3);
  assert.deepEqual(m.designed.notBuilt, ["card payments"]);
  assert.ok(!("backend" in m.designed));
  const all = mergeFirstBuildBackend(DESIGN, { backend: BACKEND, notBuilt: [] }, liftBackend);
  assert.ok(!("notBuilt" in all.designed), "a feature that was built is still told as not built");
  const none = mergeFirstBuildBackend(DESIGN, { backend: { tables: [] }, notBuilt: [] }, liftBackend);
  assert.equal(none.made, false);
  assert.equal(none.designed, DESIGN, "an answer with no table changed the design");
  assert.equal(mergeFirstBuildBackend(DESIGN, null, liftBackend).made, false);
});

/** The real `applySiteSchema`, every statement it sends collected at the fetch seam. */
async function applied(spec) {
  const statements = [];
  globalThis.fetch = async (_u, init) => {
    let q = "";
    try { q = JSON.parse(String((init && init.body) || "{}")).query || ""; } catch { /* not ours */ }
    if (q) statements.push(String(q));
    return json({ command: "SELECT", rowCount: 0, rows: [], fields: [] });
  };
  try { await applySiteSchema("postgresql://u:p@ep-probe.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = blockedFetch; }
  assert.ok(statements.length > 20, "the engine sent almost nothing — the fetch seam moved: " + statements.length);
  return statements;
}

test("the merged first-build spec creates every table with RLS, a pinned search_path and column-scoped writes", async () => {
  const spec = normalizeSchema(mergeFirstBuildBackend(DESIGN, { backend: BACKEND, notBuilt: [] }, liftBackend).designed);
  assert.deepEqual(spec.tables.map((t) => t.name), ["bookings", "menu_items"]);
  const sql = (await applied(spec)).join("\n");
  for (const t of ["bookings", "menu_items"]) {
    assert.match(sql, new RegExp('CREATE TABLE IF NOT EXISTS "?' + t), t + " was not created");
    assert.match(sql, new RegExp('ALTER TABLE "?' + t + '"? ENABLE ROW LEVEL SECURITY'), t + " has no RLS");
  }
  assert.match(sql, /search_path/i, "no search_path pin");
  // THE BOOKING FORM'S WRITE IS COLUMN-SCOPED: anonymous may insert the form's columns, never the table.
  const ins = sql.split("\n").filter((s) => /^GRANT /.test(s) && /"?bookings"?/.test(s) && /\bINSERT\b/.test(s) && /TO anonymous/.test(s));
  assert.ok(ins.length, "the booking form cannot be submitted by a visitor");
  for (const s of ins) assert.match(s.split(/\bON\b/)[0], /INSERT\s*\([^)]*\)/, "a table-wide insert: " + s);
});

test("the page writer is handed the schema, so the forms and lists are wired; with none it writes content in", () => {
  const spec = normalizeSchema(mergeFirstBuildBackend(DESIGN, { backend: BACKEND, notBuilt: [] }, liftBackend).designed);
  const wired = bandPrompt({ brief: "b", spec, brand: "B", lines: ["a booking form"], index: 0, name: "Band1Book" });
  assert.match(wired, /THE SCHEMA THAT EXISTS/);
  assert.ok(wired.includes("bookings") && wired.includes("menu_items"), "the band writer was not told the tables");
  const plain = bandPrompt({ brief: "b", spec: { tables: [] }, brand: "B", lines: ["hero"], index: 0, name: "Band1Hero" });
  assert.match(plain, /There is none, and that is the design/);
});

test("the reply says the database was made and names its tables; with none it still says none", () => {
  const made = buildReplyFacts(buildFacts({ noDatabase: false, madeTables: ["bookings", "menu_items"] })).facts.map((f) => f.text).join("\n");
  assert.match(made, /made the site's database[^\n]*bookings, menu_items/);
  assert.doesNotMatch(made, /made no database/);
  const none = buildReplyFacts(buildFacts({ noDatabase: true })).facts.map((f) => f.text).join("\n");
  assert.match(none, /made no database/);
});

// ── A, through the real build route ─────────────────────────────────────────

function routeRun({ design, backend = { backend: BACKEND, notBuilt: [] } }) {
  const backendCalls = [];
  return driveBuild({
    design: { input: design },
    body: { brief: "Harbour Loaf, a bakery in Leeds. Book a table and see the menu." },
    onFetch: async (url, init) => {
      if (!url.includes("/v1/messages")) return null;
      const b = JSON.parse(String((init && init.body) || "{}"));
      if (!(b.tool_choice && b.tool_choice.name === "design_backend")) return null;
      backendCalls.push(b);
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "b1", name: "design_backend", input: backend }], usage: { input_tokens: 200, output_tokens: 300 } });
    },
  }).then((r) => ({ ...r, backendCalls }));
}

test("THROUGH THE ROUTE: a first build with a booking form and an editable menu designs their tables and provisions the database", async () => {
  const r = await routeRun({ design: DESIGN });
  assert.equal(r.backendCalls.length, 1, "no backend design call was made");
  const req = r.backendCalls[0];
  assert.ok(req.tools[0].input_schema.properties.backend.properties.tables, "the backend call did not carry the site tool's tables field");
  const user = JSON.stringify(req.messages);
  for (const f of FEATURES) assert.ok(user.includes(f), "the backend call was not told " + f);
  assert.ok(r.seen.neon > 0, "the declared tables did not reach provisioning (needsDb stayed false)");
});

test("THROUGH THE ROUTE (control): a brochure first build makes no backend call and no database", async () => {
  const r = await routeRun({ design: GOOD_DESIGN });
  assert.equal(r.backendCalls.length, 0, "a site needing nothing stored made a backend call");
  assert.equal(r.seen.neon, 0, "a site needing nothing stored provisioned a database");
});

test("THROUGH THE ROUTE: a backend answer with no table keeps the frontend-only build (no database)", async () => {
  const r = await routeRun({ design: DESIGN, backend: { backend: { tables: [] }, notBuilt: FEATURES } });
  assert.equal(r.backendCalls.length, 1);
  assert.equal(r.seen.neon, 0, "an empty backend answer provisioned a database");
});

// ── B: the caps ──────────────────────────────────────────────────────────────

const tokens = (n) => Array.from({ length: n }, (_, i) => '<SafeImage src="@@IMG:photograph number ' + i + ' of the bakery@@" alt="p" />').join("\n");
const imgPage = (n) => [{ path: "index.tsx", source: 'export default function P() { return (<div>\n' + tokens(n) + "\n</div>); }" }];

test("20 photographs asked for are all bought when purchases are on, at most 8 at a time", async () => {
  assert.equal(IMAGE_CAP, Infinity);
  const { buySitePhotos } = await loadWorkerModule();
  let live = 0, peak = 0, bought = 0;
  const buy = async (prompt) => {
    live++; peak = Math.max(peak, live);
    await new Promise((r) => setTimeout(r, 5));
    live--; bought++;
    return { url: "/u/harbour-loaf/" + bought + ".jpg" };
  };
  const env = { SITES_BUCKET: buildBucket() };
  const out = await buySitePhotos(env, { slug: "harbour-loaf", pages: imgPage(20), parts: [], budget: 20, balance: 1e6, reserve: 0, clock: null, buy });
  assert.equal(bought, 20, "not every photograph was bought");
  assert.equal(out.made, 20);
  assert.ok(peak <= 8 && peak > 1, "purchases were not bounded at 8 at a time: peak " + peak);
});

test("with IMAGE_PURCHASES off, 20 photographs asked for buy nothing (unchanged)", async () => {
  const { buySitePhotos } = await loadWorkerModule();
  const env = { SITES_BUCKET: buildBucket(), IMAGE_PURCHASES: "off" };
  const out = await buySitePhotos(env, { slug: "harbour-loaf", pages: imgPage(20), parts: [], budget: 20, balance: 1e6, reserve: 0, clock: null });
  assert.equal(out.made, 0);
});

test("1,500 strings are all collected and translated in batches, none dropped", () => {
  assert.equal(MAX_STRINGS, Infinity);
  const words = Array.from({ length: 1500 }, (_, i) => "<p>Fresh loaf number " + i + " baked today</p>").join("\n");
  const { strings, dropped } = collectStrings([{ path: "index.tsx", source: "export default function P() { return (<div>\n" + words + "\n</div>); }" }]);
  assert.equal(strings.length, 1500);
  assert.equal(dropped, 0);
  const batches = translationBatches(strings);
  assert.ok(batches.length >= Math.ceil(1500 / BATCH_MAX_STRINGS), "not batched");
  assert.ok(batches.every((b) => b.length <= BATCH_MAX_STRINGS));
  assert.deepEqual(batches.flat(), strings, "a string was lost between the batches");
});

test("a compile error naming 5 pages repairs all 5 in one round", async () => {
  assert.equal(MAX_FILES, Infinity);
  assert.equal(MAX_REPAIRS, Infinity);
  const pages = Array.from({ length: 5 }, (_, i) => ({ path: "p" + i + ".tsx", source: "import { Button } from \"@/components/ui/broken" + i + "\";\nexport default function P" + i + "() { return <div><Button>Hello</Button></div> }" }));
  const error = pages.map((p) => "src/routes/" + p.path + ":1:1: ERROR: bad").join("\n");
  let sent = 0;
  const send = async (req) => {
    sent++;
    const src = JSON.stringify(req).match(/ui\/broken(\d)/);
    const n = src ? src[1] : "x";
    return { content: [{ type: "tool_use", id: "t" + sent, name: "write_tweak", input: { edits: [{ old: "ui/broken" + n, new: "ui/button" }] } }], usage: { input_tokens: 1, output_tokens: 1 } };
  };
  const r = await compileRepairRound({ error, pages, touched: pages.map((p) => p.path), send, compile: async () => ({ ok: true, files: { "index.html": "x" } }) });
  assert.equal(sent, 5);
  assert.deepEqual(r.repaired.sort(), pages.map((p) => p.path), JSON.stringify(r.refused));
  assert.ok(r.built, "the repaired pages did not compile");
});
