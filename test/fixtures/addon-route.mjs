// DRIVE THE REAL ADDON ROUTE, END TO END, IN A PLAIN NODE TEST.
//
// WHY THIS EXISTS, in the owner's own words (2026-09-14): *"Demonstrate these
// cases through the relevant route, including what the customer is told. Helper
// tests and source-text assertions alone missed these connections."* Four
// defects shipped on 2026-09-14 with the modules perfectly correct and the
// route wrong about which value it handed them — the cleaner's items where the
// model's declaration was wanted, the proposed names where the applied result
// was wanted, a table replaced where the apply merges, and a hand-off composed
// for one of six kinds. Every one of them is invisible to a module test and to
// a source scan, and every one is one line of output away through here.
//
// WHAT IT REACHES. `POST /api/site/<slug>/addon` on the PAGELESS path — a
// scheduled job, or an internal function only the platform calls, changes no
// page — so the whole route runs: the picker, one designer per kind, the
// cleaner, the per-tier audit, the schema apply against a real
// `applySiteSchema` over a fake Neon, the coverage, and the reply the customer
// reads. No container, no compile, no publish, no credit, no network.
//
// EVERY SEAM IS THE REAL PRODUCER'S. GoTrue, the two Supabase tables, the
// ledger, Neon's SQL-over-HTTP endpoint and both model providers are answered
// in THEIR OWN shapes off one `fetch` stub, and the add call's kind is read off
// the REQUEST — `add_to_site`'s one property is named by the kind — rather than
// guessed from call order, which is what changed underneath an earlier fixture
// of this shape once already.
import { loadWorker, makeCtx } from "./worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./cf-containers.mjs";
import { CONFIG_KEY } from "../../site-config.mjs";
import { validatePages } from "../../builder/page-gen.mjs";

export const USER = { id: "u-addon-route", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const PAGES = [{ path: "index.tsx", source: "export default function Home(){return <h1>Fretwork</h1>}" }];
// WHAT THE PAGE CALL ANSWERS on a case that is not pageless. A generated page
// must export a Route — `validatePages` refuses one that does not, by
// `createFileRoute(`, which is why this is a real page rather than the stored
// one above: a fixture in a shape the pipeline refuses reads as the model
// declining and escalates.
const WRITTEN_PAGES = [{
  path: "src/routes/index.tsx",
  source: "import { createFileRoute } from '@tanstack/react-router'\n"
    + "export const Route = createFileRoute('/')({ component: Home })\n"
    + "function Home(){ return <main><h1>Fretwork</h1><p>Guitar repairs in Sheffield.</p></main> }\n",
}];

/**
 * A generated page at a route, in the shape `validatePages` accepts — so a case
 * can say "the writer returned /gallery and not /prices" without retyping the
 * route export every time.
 *
 * ⚠ THE `src/routes/` PREFIX IS DELIBERATE AND IS ONLY RIGHT ON THIS SIDE. It
 * is what a MODEL really writes, and `cleanPath` strips it on the way in. What
 * a site STORES is the stripped form, so this producer must never stand in for
 * a stored page — `storedPage` below is that one, and it is validator-produced
 * rather than hand-spelled.
 */
export function writtenPage(routePath) {
  const file = routePath === "/" ? "index" : routePath.replace(/^\//, "").replace(/\//g, "-");
  return {
    path: "src/routes/" + file + ".tsx",
    source: "import { createFileRoute } from '@tanstack/react-router'\n"
      + "export const Route = createFileRoute('" + routePath + "')({ component: Page })\n"
      + "function Page(){ return <main><h1>" + file + "</h1><p>Words for " + file + ".</p></main> }\n",
  };
}

/**
 * THE SAME PAGE AS A SITE REALLY HOLDS IT — run through the real validator.
 *
 * ⚠ THIS EXISTS BECAUSE ITS ABSENCE WAS LOAD-BEARING (owner, 2026-09-17).
 * Every stored-page fixture here was `writtenPage`, whose path carries the
 * `src/routes/` prefix — and `cleanPath` strips it, so the site's stored
 * `src/routes/index.tsx` and the writer's returned `index.tsx` are two
 * different pages to every reader on the path. MEASURED through the real
 * `mergeAddonPages`: a prefixed stored page beside a bare returned one answers
 * `added: ["index.tsx"]` and leaves BOTH files in the site, where the real
 * shapes answer `changed` and one. So every "the site already has this page"
 * case in this suite was exercising a duplicate ADD, `keptProse` never fired
 * on any of them, and the page window's `keep` list could never match.
 *
 * DERIVED FROM ITS REAL PRODUCER rather than spelled bare by hand: the
 * identity is whatever `validatePages` answers, so the day that changes these
 * fixtures change with it instead of drifting from it.
 */
export function storedPage(routePath) {
  const w = writtenPage(routePath);
  const v = validatePages({ pages: [w] }, { partial: true });
  if (!v.pages.length) throw new Error("storedPage: the validator refused " + routePath + " — " + v.problems.join("; "));
  return v.pages[0];
}

/**
 * WHAT AN ADDON REALLY RETURNS FOR A PAGE THE SITE ALREADY HAS: everything the
 * page said, plus the new thing.
 *
 * ⚠ AND IT IS ONLY NEEDED NOW THAT THE STORED PAGES ARE REAL. `keptProse` — the
 * route's "an addition may only ADD" wall — reads `aMerge.changed`, which no
 * case in this suite could ever reach while the stored path carried a prefix
 * the returned path did not: every one of them was an ADD, so the wall was
 * never armed. With the identities lined up it arms on every such case, which
 * is the wall working rather than a fixture to appease.
 */
export function addedTo(routePath, extra) {
  const p = storedPage(routePath);
  return { ...p, source: p.source.replace("</main>", extra + "</main>") };
}

/**
 * THE PAGES THAT REALLY WENT TO THE COMPILER, as `[{path, source}]`.
 *
 * READ OFF THE CONTAINER PAYLOAD, never off a reply field, because the two are
 * different claims: `changed` is what the route SAYS it published, and this is
 * what it HANDED to the thing that builds the site. A case about a page being
 * withheld has to read the second — a route that kept the file on its list and
 * sent it anyway satisfies every assertion about the first.
 */
export function compiledPages(r) {
  const files = r && r.compiles && r.compiles[0] && r.compiles[0].body && r.compiles[0].body.files;
  if (!files || typeof files !== "object") return [];
  return Object.entries(files).map(([path, source]) => ({ path, source: String(source) }));
}

/**
 * THE SITE'S STORED SCHEMA, in the shape `_meta` really holds: a `bookings`
 * table with three columns and `access: "user"` — which is what makes the
 * extension case observable at all, since a replaced table loses exactly those.
 */
export const STORED_SCHEMA = {
  tables: [{ name: "bookings", access: "user", columns: [{ name: "who", type: "text" }, { name: "slot", type: "text" }, { name: "phone", type: "text" }] }],
  functions: [], apis: [], jobs: [],
};

/**
 * Catalog rows in NEON'S OWN WIRE SHAPE: arrays plus a `fields` list naming the
 * columns. Its driver does `c.map` over `fields`, so an object row makes it
 * throw — the recorded "a fixture in a different shape from reality", already
 * paid for once in this file.
 */
function neonRows(rows, cols) {
  return new Response(JSON.stringify({
    command: "SELECT",
    rowCount: rows.length,
    rows: rows.map((r) => cols.map((c) => (r[c] === undefined ? "" : r[c]))),
    fields: cols.map((c) => ({ name: c, dataTypeID: 25 })),
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function bucket(slug, stored, look, parts, css, partsFail, configFail, uploads, uploadsFail, noHead) {
  const store = new Map([
    // THE SITE'S OWN PAGES. One by default; a case that is about a MULTI-PAGE
    // site says so, because "which page does this go on" is only a guess when
    // there is more than one answer.
    ["source/" + slug + "/pages.json", JSON.stringify(Array.isArray(stored) && stored.length ? stored : PAGES)],
    // …AND ITS STORED LOOK, which a case may extend (2026-09-15). Two kinds a
    // site carries live here rather than in its schema — its QR codes and its
    // one scene — so a case about existing-site evidence for either has to be
    // able to say the site already has one. MERGED over the default rather
    // than replacing it: `brand` and `pages` are what every other case relies
    // on, and a case adding a QR code is not saying the site has no name.
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fretwork", pages: [], ...(look || {}) }, css: typeof css === "string" ? css : "" })],
  ]);
  // ── THE SITE'S OWN COMPONENTS (2026-09-17) ───────────────────────────────
  //
  // `source/<slug>/parts.json` — what the site really HAS a file for, as
  // against `look.tsx`, which is the cumulative declaration list. The two are
  // different facts and a case about either has to be able to set them apart,
  // so this is its own seam.
  //
  // WRITTEN ONLY WHEN A CASE ASKS FOR ONE. `loadSiteParts` answers `null` for
  // a missing key, which is what every site in every earlier case here is, so
  // those read exactly as they did.
  if (Array.isArray(parts) && parts.length) store.set("source/" + slug + "/parts.json", JSON.stringify(parts));
  // WHAT THE OWNER HAS REALLY UPLOADED — file names under `uploads/<slug>/`,
  // which is where the serve route reads `/u/<slug>/<file>` from. A case says
  // `uploads: ["9f9f….jpg"]` to mean "the owner uploaded this and has not put
  // it on a page yet", which is precisely the state no page source can express
  // and the one the correction is about. DEFAULTS TO NONE, so every case
  // written before this reads exactly as it did: an invented url is absent.
  for (const f of Array.isArray(uploads) ? uploads : []) store.set("uploads/" + slug + "/" + f, "bytes");
  // ── A READ THAT FAILS AND THEN RECOVERS (2026-09-17) ─────────────────────
  //
  // `partsFail: N` throws on the FIRST N reads of `source/<slug>/parts.json`
  // and answers normally after that — which is the shape the owner's first
  // reproduction needs and which no other seam here can produce. The route
  // used to read that key TWICE, minutes apart, so "the first read failed and
  // the second succeeded" is a real state of the world and the one in which an
  // unseen component was replaced.
  //
  // A THROW, NOT A `null`. R2 answers `null` for a key that is not there and
  // THROWS for a read it could not perform, and the whole finding is that
  // those two were being collapsed — a fixture that answered `null` would be
  // testing the honestly-empty case under the unreadable case's name.
  const partsKey = "source/" + slug + "/parts.json";
  let partsReads = 0;
  return {
    store,
    async get(k) {
      if (k === partsKey) {
        partsReads += 1;
        if (partsFail && partsReads <= Number(partsFail)) throw new Error("R2 GetObject: connection reset");
      }
      const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) };
    },
    // `configFail` REFUSES THE CONFIG WRITE AND NOTHING ELSE. The route's
    // store block answers a 503 on a refused write and arms the look revert on
    // a successful one, and neither branch had a seam to drive: a fixture whose
    // every `put` succeeds cannot tell "the write failed and we said so" from
    // "the write failed and we carried on". A THROW, because that is what R2
    // does when it cannot write — `saveConfig` reads a throw, not a falsy.
    async put(k, v) {
      if (configFail && k === "config/" + slug + ".json") throw new Error("R2 PutObject: connection reset");
      store.set(k, String(v));
    },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    // ── THE SITE'S UPLOAD STORE (2026-09-19) ────────────────────────────────
    //
    // `head` is how `siteUploadExists` asks whether `/u/<slug>/<file>` really
    // serves bytes, and until this existed the fake answered by not having the
    // method at all — which the product reads as CANNOT TELL, so every case
    // would have passed by the wall standing down rather than by it working.
    // The recorded "a fake LESS capable than the thing it stands in for hides a
    // defect exactly as well as one that is more", in the one method the
    // correction turns on.
    //
    // `uploadsFail` THROWS, because that is what R2 does when it cannot read —
    // and `null` would be a key that is honestly absent, which is the opposite
    // answer. The two are what this round is about.
    ...(noHead ? {} : {
      async head(k) {
        if (uploadsFail && k.startsWith("uploads/")) throw new Error("R2 HeadObject: connection reset");
        return store.has(k) ? { key: k } : null;
      },
    }),
  };
}

/**
 * ONE `fetch`, every seam the route really uses.
 *
 * `fnFail` makes Postgres REFUSE `CREATE OR REPLACE FUNCTION` — a real failure
 * shape, answered as a 400 the way Neon answers one — because "the function
 * does not exist but the job that runs it does" is the case the evidence rule
 * exists for and cannot be reached any other way. `true` refuses every one; a
 * NAME refuses that one alone, which is what makes "the block is per job, by
 * the function IT runs" observable rather than a claim: with everything failing,
 * a wholesale "some function failed, so no jobs" passes every assertion.
 *
 * `registered` collects the rows `persistSiteJobs` really upserts, so a job
 * taken off the reply and a job taken off the DATABASE are two different
 * assertions instead of one.
 */
/**
 * `backend` SHAPES THE TWO SUPABASE ROWS `siteBackendDetail` READS, and it is
 * the seam the run-47 defect needs to be drivable at all (2026-09-15):
 *
 *   "ready"       the default — a recorded `neon_db`, which is every case
 *                 written before this and must stay byte-identical.
 *   "incomplete"  a blank `neon_db` with a `site_project` row: the state five
 *                 live sites are in, and the one that used to read as an empty
 *                 database.
 *   "none"        blank, and NO project row — a genuinely frontend-only site,
 *                 the one state in which `{tables: []}` is the truth.
 *   "unreadable"  the `site_backends` read 500s: cannot-tell.
 *
 * `metaFail` makes the `_meta` schema read THROW, which is the other half of
 * the owner's instruction — a failed schema read must stop the step rather than
 * become an empty site — and `metaMissing` makes it answer Postgres's own
 * "relation does not exist", which is a database provisioned and never applied
 * to and IS honestly empty. Those two look identical from the old code and need
 * opposite answers.
 */
function stub({ kinds, answers, fnFail = false, jobsFail = false, sql, prompts, meta, registered, patched, traces, written = null, writtenParts = null, backend = "ready", metaFail = false, metaMissing = false, probeFail = false, healNoop = false, metaJunk = false, provisions = false, neonCalls = null, catalog = null, credits = null, shots = null, shotFail = false }) {
  let provisioned = false;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } });
    }
    // THE PUBLISH'S OWN UPLOAD, for a case that changes a page. Chained here
    // rather than defaulted, so a pageless case that somehow reached it still
    // meets the catch-all below.
    if (isDispatchUpload(url)) return dispatchOk();
    // NEON'S OWN CONTROL-PLANE API, so the PROVISION path can be driven.
    //
    // `provisions: true` is the only case that needs it, and it needs it
    // because the one line that fixes the run-47 defect at its root —
    // `ensureSiteBackend` recording the database name on the ownership row —
    // sits at the END of a provision and is reachable no other way. A sweep
    // mutant deleting that line survived every guard until this existed: a wall
    // nobody can drive is a wall nobody is guarding.
    //
    // Answered in Neon's own response shapes (`projectFromCreate` refuses
    // anything else), and every call is recorded so a case can say WHICH of
    // them ran rather than only that the provision returned.
    if (provisions && url.includes("console.neon.tech/api/v2")) {
      if (neonCalls) neonCalls.push(url.split("/api/v2")[1] || url);
      if (/\/projects$/.test(url) && init && String(init.method).toUpperCase() === "POST") {
        provisioned = true;
        return new Response(JSON.stringify({
          project: { id: "pr-new" }, branch: { id: "br-new" }, roles: [{ name: "owner" }],
          connection_uris: [{ connection_uri: "postgres://u:p@ep-new.neon.tech/neondb" }],
        }), { status: 201, headers: { "content-type": "application/json" } });
      }
      // `waitForProject` polls operations until none is pending.
      if (/\/operations$/.test(url)) {
        return new Response(JSON.stringify({ operations: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (/organizations$/.test(url)) return new Response(JSON.stringify({ organizations: [] }), { status: 200, headers: { "content-type": "application/json" } });
      // Databases, auth and the Data API: enabled, with the endpoint each one
      // records. `{}` would make the two `saveAuthInfo`/`saveDataInfo` writes
      // no-ops and hide whether they ran.
      return new Response(JSON.stringify({ auth: { jwks_url: "https://x/jwks" }, data_api: { url: "https://x/data" } }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    // ── THE ROUTE'S OWN BLACK BOX (2026-09-19) ──────────────────────────────
    // `flushEditTrace` POSTs the marks here. Captured because a mark is the
    // ONLY signal that a wall stood down rather than finding nothing to do —
    // a run that swept nothing because the store was unreadable and a run with
    // nothing to sweep are the same reply otherwise.
    if (url.includes("/rest/v1/edit_traces")) {
      // ONE ROW CARRYING `events`, which is `traceRow`'s own shape — not a list
      // of marks. Normalised to the words `aMark` is called with, so a case
      // reads `{phase, status, detail}` rather than `{p, s, d}`.
      // ⚠ NO try/catch AROUND THE PUSH. The first cut wrapped the whole block,
      // and `traces` was not one of `stub`'s parameters — so every push threw a
      // ReferenceError the catch swallowed and the list was silently empty,
      // which reads exactly like a route that never marked anything. A catch
      // here can only hide a wiring mistake in this fixture; the PARSE is the
      // only part that can legitimately fail, so only the parse is guarded.
      let row = null;
      try { row = JSON.parse(String(init.body || "{}")); } catch { row = null; }
      for (const e of (row && row.events) || []) traces.push({ phase: e.p, status: e.s, ms: e.ms, detail: e.d });
      return new Response("[]", { status: 201, headers: { "content-type": "application/json" } });
    }
    // `site_project` FIRST of the two below: both URLs carry `/rest/v1/` and
    // this is the more specific match — the ordering an earlier fixture of this
    // shape got wrong.
    if (url.includes("/rest/v1/site_project")) {
      // A `none` site has no project row — that ABSENCE is what separates it
      // from `incomplete`, so the fixture has to be able to withhold it.
      // THE CLAIM. `saveProject` POSTs with `resolution=ignore-duplicates`, and
      // a full representation means the row is ours.
      if (init && String(init.method || "GET").toUpperCase() === "POST") {
        return new Response(JSON.stringify([{ slug: "x" }]), { status: 201, headers: { "content-type": "application/json" } });
      }
      // A `none` site has no project row UNTIL one is made — `provisioned`
      // flips the fixture to "it exists now", which is what the second lookup
      // inside `ensureSiteBackend` has to find.
      if (backend === "none" && !provisioned) return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify([{ uid: USER.id, neon_project: "proj-1", neon_branch: "br-1", neon_role: "owner", neon_conn: "postgres://u:p@ep-addon.neon.tech/neondb" }]),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/site_backends")) {
      // `unreadable` FAILS `siteBackendDetail`'S OWN READ AND NOTHING ELSE.
      //
      // Failing every `site_backends` read instead would be a different case:
      // the route's earlier site check reads this table too and answers its own
      // 503 ("couldn't check that site just now"), so the step stops before the
      // backend reader is ever reached and the branch under test stays undriven
      // — a green case about code that did not run. The two walls are
      // complementary rather than redundant: a whole Supabase outage stops at
      // the site check, and THIS is the narrower failure where the site is
      // readable and its backend is not.
      if (backend === "unreadable" && /select=neon_db,uid&limit=1/.test(url)) return new Response("upstream", { status: 500 });
      // `saveBackend`'s claim: the row already exists, so `claimed` is false —
      // which is exactly the live shape that leaves `neon_db` blank for ever.
      if (init && String(init.method || "GET").toUpperCase() === "POST") {
        return new Response("[]", { status: 201, headers: { "content-type": "application/json" } });
      }
      // THE HEAL'S OWN PATCH, recorded rather than swallowed: `healSiteBackendDb`
      // writes here, and whether it ran is the whole of "the reference was
      // repaired on the way past". Answered as PostgREST answers a matching
      // `return=representation` PATCH.
      if (init && String(init.method || "GET").toUpperCase() === "PATCH") {
        try { patched.push({ url, body: JSON.parse(String(init.body || "{}")) }); } catch { patched.push({ url, body: null }); }
        // AN EMPTY REPRESENTATION IS WHAT A SECOND RUN LOOKS LIKE: the filter
        // matched nothing because the name is already set. It must not be
        // reported as a repair this run performed.
        return new Response(JSON.stringify(healNoop ? [] : [{ slug: "x", neon_db: "sitedb" }]), { status: 200, headers: { "content-type": "application/json" } });
      }
      const db = (backend === "incomplete" || backend === "none") ? "" : "sitedb";
      return new Response(JSON.stringify([{ uid: USER.id, brief: "", neon_db: db }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    // THE JOB REGISTRY. `persistSiteJobs` reads the paused set and then upserts
    // one row per job; both go to `site_functions`, and the POST is the one
    // that says which schedules the platform will really run. Without this the
    // function returns at its first line (no service key) and a job blocked on
    // the reply and a job blocked in the DATABASE are indistinguishable.
    // `jobsFail` REFUSES THE UPSERT (2026-09-19) — the one job failure the
    // audit structurally cannot see, because it happens after every validation
    // has passed. Without a seam here, "the route reports a registration that
    // did not land" is a claim in a comment; with it, a fix that cleared job
    // failures wholesale is a red run.
    if (url.includes("/rest/v1/site_functions")) {
      if (init && String(init.method || "GET").toUpperCase() === "POST") {
        if (jobsFail) return new Response('{"message":"the schedule could not be saved"}', { status: 500, headers: { "content-type": "application/json" } });
        try { for (const row of JSON.parse(String(init.body || "[]"))) registered.push(row); } catch { /* the assertion below reads the list */ }
        return new Response("", { status: 201 });
      }
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    // ── THE BALANCE, AND THE IMAGE PROVIDER, BOTH STUBBED (2026-09-17) ──────
    //
    // A combined page + photograph request asks `get_credits` before the page
    // call and spends at `fal.run` after the merge, so BOTH have to answer or
    // the case proves the refusal rather than the feature: with no balance
    // `imagesAffordable` cuts every shot and the writer is never even shown a
    // token. `credits: null` leaves the route's own `.catch(() => 0)` to
    // answer 0, which is every case written before today — so an addon that
    // buys nothing is byte-identical.
    if (credits !== null && url.includes("/rpc/get_credits")) {
      return new Response(String(credits), { status: 200, headers: { "content-type": "application/json" } });
    }
    // THE PROVIDER, IN ITS OWN TWO HOPS: `genSitePhoto` POSTs to fal and then
    // FETCHES the url fal answers with, so a stub that only answers the first
    // proves half a chain. Every prompt is RECORDED — `shots` is the list of
    // what was really paid for, which is the one thing a case about buying
    // photographs has to be able to assert. `shotFail: true` makes the
    // provider refuse, which is the arm where the money is not spent and the
    // token has to sweep back to a placeholder.
    //
    // ⚠ AND IT REFUSES PER PROMPT AS WELL AS WHOLESALE (2026-09-19), because
    // PARTIAL SUCCESS is a case this fixture could not produce: `shotFail` was
    // a boolean, so a run where one picture arrives and another does not — the
    // shape that separates a per-REQUEST association from a per-ROUTE one —
    // had no way of existing. A fixture less capable than reality hides the
    // defect exactly as well as one that is more. An ARRAY refuses only the
    // prompts containing one of its strings; `true` still refuses everything,
    // so every case written before today is byte-identical.
    if (url.includes("fal.run/")) {
      let prompt = ""; try { prompt = String(JSON.parse(String((init && init.body) || "{}")).prompt || ""); } catch { prompt = ""; }
      if (shots) shots.push(prompt);
      const refuse = Array.isArray(shotFail) ? shotFail.some((s) => prompt.includes(s)) : !!shotFail;
      if (refuse) return new Response(JSON.stringify({ detail: "no credit" }), { status: 402, headers: { "content-type": "application/json" } });
      // ONE URL PER PROMPT, so two different pictures cannot collapse into one
      // stored file — `makeSitePhoto` hashes the BYTES, so identical bytes for
      // two prompts would store one name and the case could not tell a second
      // purchase from a reused one.
      const n = shots ? shots.length : 1;
      return new Response(JSON.stringify({ images: [{ url: "https://cdn.test/shot-" + n + ".jpg" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    // REAL JPEG MAGIC, because `sniffImage` reads the bytes and refuses
    // anything it does not recognise — the same sniff the upload route runs, on
    // bytes nobody here chose. The tail is the shot number, so each picture
    // hashes to its own name.
    if (url.startsWith("https://cdn.test/shot-")) {
      const tag = url.slice("https://cdn.test/shot-".length).replace(/\.jpg$/, "");
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array.from(tag, (c) => c.charCodeAt(0) & 0xff), 0xff, 0xd9]);
      return new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } });
    }
    // A HEALTHY LEDGER, answering what it was asked for: a dead one stops the
    // route a gate short of everything under test.
    if (url.includes("/rpc/use_credits")) {
      let want = 0; try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return new Response(String(want), { status: 200, headers: { "content-type": "application/json" } });
    }
    // NEON, SQL OVER HTTP — the seam `applySiteSchema` really uses (`neon()` is
    // a closure over fetch). Rows come back as ARRAYS with `fields`, which is
    // the driver's own wire shape; an object row makes it throw `c.map`.
    if (url.includes("neon.tech/sql")) {
      let q = "", params = [];
      try { const b = JSON.parse(String((init && init.body) || "{}")); q = b.query || ""; params = Array.isArray(b.params) ? b.params : []; } catch { q = ""; }
      sql.push(String(q));
      // ── `_meta` REMEMBERS WHAT WAS WRITTEN TO IT (2026-09-14) ─────────────
      //
      // It used to answer `STORED_SCHEMA` to every read, whatever had been
      // applied — a fixture LESS capable than the thing it stands for, and the
      // one that hides the most here: the route re-reads the spec through
      // `loadSiteSchema` straight after the apply and `appliedFacts` decides
      // every function's and connection's guarantees off THAT read. With a
      // frozen `_meta` no function this change created could ever be found, so
      // every claim about one scored `unverified` for the fixture's reason
      // rather than the product's — an all-clear from a blind instrument.
      //
      // `applySiteSchema` writes it with one statement and the merged spec as
      // its first parameter, so that is what is captured: the real producer's
      // own bytes, never a second idea of what the apply stores.
      if (/INSERT INTO _meta/i.test(q)) {
        if (typeof params[0] === "string") meta.value = params[0];
        return new Response(JSON.stringify({ command: "INSERT", rowCount: 1, rows: [], fields: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      // BOTH SPELLINGS, and the second one is why this fixture was blind.
      // The route reads `WHERE k = 'schema'` and `loadSiteSchema` reads
      // `WHERE k='schema'` — the same statement written two ways, and a
      // pattern pinned to the spaced one sent every `loadSiteSchema` call to
      // the catch-all, which answers no rows. That reads as `{tables: []}`:
      // the post-apply spec the whole evidence rule is decided from was EMPTY
      // in every case here, so nothing a change created could ever be found.
      // A fixture pinned to one spelling of a query is the recorded "assert
      // the property, not the spelling" trap, on the answering side.
      // THE REACHABILITY PROBE. `siteBackendDetail` asks a derived connection
      // one trivial question before handing it back, because a name that
      // DERIVES is not a database that ANSWERS. Failing it here is the only way
      // to drive that branch.
      if (probeFail && /^SELECT 1\s*$/i.test(q.trim())) {
        return new Response(JSON.stringify({ message: "database \"site_fw_probefail\" does not exist" }), { status: 400, headers: { "content-type": "application/json" } });
      }
      // ── THE CATALOG (2026-09-15) ────────────────────────────────────────
      //
      // `specForAddon` asks Postgres what tables really exist BEFORE it reads
      // `_meta`, because "no stored spec" said nothing whatever about whether
      // the database holds tables — run 47's defect, one inference over. With
      // no `catalog` seam every case here answers no rows, which is the
      // honestly-empty database the older cases are about; a case that hands
      // one in is driving the recovery.
      //
      // ROWS ARE ARRAYS WITH `fields`, which is Neon's own wire shape — an
      // object row makes the driver throw `c.map`.
      if (catalog && /information_schema\.columns/i.test(q)) return neonRows(catalog.columns || [], ["t", "c", "ty"]);
      if (catalog && /role_table_grants/i.test(q)) return neonRows(catalog.grants || [], ["t", "g", "p", "lvl", "col"]);
      if (catalog && /pg_policies/i.test(q)) return neonRows(catalog.policies || [], ["t", "c", "q", "w"]);
      if (catalog && /pg_trigger/i.test(q)) return neonRows(catalog.triggers || [], ["t", "g"]);
      if (/^SELECT v FROM _meta WHERE k\s*=\s*'?schema/i.test(q.trim())) {
        // THE TWO WAYS A SCHEMA READ CAN COME BACK WITHOUT A SPEC, and they
        // need opposite answers from the route. `metaFail` is Neon refusing the
        // query — the schema is UNKNOWN and the step must stop. `metaMissing`
        // is Postgres's own words for a database that has no `_meta` yet, which
        // is one provisioned and never applied to and IS honestly empty.
        if (metaFail) return new Response(JSON.stringify({ message: "connection terminated unexpectedly" }), { status: 500, headers: { "content-type": "application/json" } });
        if (metaMissing) return new Response(JSON.stringify({ message: 'relation "_meta" does not exist' }), { status: 400, headers: { "content-type": "application/json" } });
        // STORED AND UNREADABLE is the worst case to guess at: the site HAS a
        // schema and we cannot see it, so an empty answer here would be the
        // run-47 defect with a different cause.
        if (metaJunk) return new Response(JSON.stringify({ command: "SELECT", rowCount: 1, rows: [["{not json"]], fields: [{ name: "v", dataTypeID: 25 }] }), { status: 200, headers: { "content-type": "application/json" } });
        return new Response(JSON.stringify({ command: "SELECT", rowCount: 1, rows: [[meta.value]], fields: [{ name: "v", dataTypeID: 25 }] }),
          { status: 200, headers: { "content-type": "application/json" } });
      }
      if (fnFail && /CREATE OR REPLACE FUNCTION/i.test(q)
        && (fnFail === true || new RegExp("FUNCTION\\s+\"?" + String(fnFail) + "\"?\\s*\\(", "i").test(q))) {
        return new Response(JSON.stringify({ message: 'syntax error at or near "selct"' }), { status: 400, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    const anthropic = url.includes("/v1/messages");
    const xai = url.includes("/v1/chat/completions");
    if (anthropic || xai) {
      // WHICH TOOL, AND FOR WHICH KIND — read off the REQUEST, never guessed
      // from call order. Every add call asks for `add_to_site`, whose ONE
      // property besides `requirements` is named by the kind.
      const b = (() => { try { return JSON.parse(String(init && init.body) || "{}"); } catch { return {}; } })();
      const asked = (b.tool_choice && (b.tool_choice.name || (b.tool_choice.function && b.tool_choice.function.name))) || "";
      const schemaOf = (() => {
        const t = (b.tools || []).find((x) => (x.name || (x.function && x.function.name)) === asked);
        return t && (t.input_schema || (t.function && t.function.parameters));
      })();
      const props = Object.keys((schemaOf && schemaOf.properties) || {});
      const kind = props.find((x) => x !== "requirements") || "";
      // ⚠ AND THE ITEM'S OWN PROPERTIES, one level in (2026-09-19). `props` is
      // the tool's top level — `["api","requirements"]` — which says nothing
      // about what a designer may declare ABOUT one connection. A case
      // asserting that a `returns` sketch or a typed parameter reached the
      // store would otherwise pass against a tool that never offered either,
      // because the fixture hands the answer in: the same bypass the comment
      // above records, one level deeper.
      // ⚠ AND THE ITEM'S SCHEMA, not only its key set (2026-09-19). Which
      // properties a designer may answer and what each may CONTAIN are two
      // facts, and only the first was readable — so a case driving a top-level
      // list sketch all the way to the store passed against a tool whose
      // `returns` was declared object-only, which is the very drift that round
      // was correcting. One walk answers both, so they cannot come apart.
      const itemSchema = (() => {
        const p = schemaOf && schemaOf.properties && schemaOf.properties[kind];
        return (p && (p.items || p)) || null;
      })();
      const itemProps = Object.keys((itemSchema && itemSchema.properties) || {});
      // ⚠ AND THE PROPERTY SET ITSELF IS KEPT (2026-09-19). Whether a designer
      // MAY answer coverage is a fact about the tool the route hands it, and a
      // fixture that supplies the answer directly bypasses the tool entirely —
      // so without this, a case driving a `requirements` echo passes whether or
      // not the model could ever have written one. Measured: the QR echo case
      // was green against a product whose qr tool had no such property.
      prompts.push({ tool: asked, kind, props, itemProps, itemSchema, text: JSON.stringify(b.messages || b.system || b) });
      // THE PAGE CALL, for a case that is not pageless. A connection or a
      // PUBLIC function exists to be read by a page, so `pageless` is false and
      // the route writes one — which is right, and is why those two kinds
      // cannot be demonstrated on the short path. The answer is the smallest
      // real one: the home page rewritten, no parts, no removals.
      // WHAT THE PAGE WRITER RETURNS, per case. The default is the home page
      // rewritten; `written` lets a case answer with the pages it wants —
      // which is the only way to drive "asked for two, got one", the shape the
      // missing-page report exists for.
      // `writtenParts` IS HOW A CASE DRIVES THE PARTS WALL (2026-09-17): the
      // page writer returning a file in `parts` is what `mergeParts` acts on,
      // and "may this replace a component the writer never saw?" cannot be
      // asked of a writer that returns none. Omitted by default, so every
      // earlier case sends a `write_pages` answer with no `parts` key at all.
      const inputObj = asked === "pick_adds" ? { kinds }
        : asked === "write_pages" ? { pages: written || WRITTEN_PAGES, notes: "", ...(writtenParts ? { parts: writtenParts } : {}) }
        : (answers[kind] || {});
      const body = anthropic
        ? { stop_reason: "tool_use", content: [{ type: "tool_use", name: asked, input: inputObj }], usage: { input_tokens: 10, output_tokens: 5 } }
        : { choices: [{ message: { content: "", tool_calls: [{ id: "c1", function: { name: asked, arguments: JSON.stringify(inputObj) } }] }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
    // EVERYTHING ELSE REFUSED. A stub that answered every call would let the
    // route wander past the thing under test.
    return new Response("unavailable", { status: 503 });
  };
  return () => { globalThis.fetch = real; };
}

/**
 * One addition, through the real route.
 *
 * `{ status, body, sql, prompts, store }` — `prompts` is every model request
 * the route really sent, which is how a hand-off is proved to have REACHED its
 * designer rather than merely to have been composed.
 *
 * A SLUG PER CASE, and that is not tidiness: `siteBackendBySlug` memoizes on
 * the slug for five minutes, so a shared name lets the first case's answer
 * serve every later one.
 */
export async function addon(slug, instruction, opts) {
  const sql = [], prompts = [], registered = [], patched = [], neonCalls = [], traces = [];
  // EVERY PROMPT THE IMAGE PROVIDER WAS REALLY PAID FOR. Collected here rather
  // than inside the stub so it comes back on the result — a case about buying
  // photographs is about WHICH pictures were bought, and the reply's count
  // alone cannot say that. Empty on every case that buys none.
  const shots = [];
  // THE STORED SCHEMA IS PER CALL, not a shared module object: `meta.value`
  // moves when the apply writes, and a case that read another case's leftovers
  // would be the shared-slug trap one field over.
  // …AND A CASE MAY START THE SITE FROM A DIFFERENT ONE (2026-09-15), for the
  // demonstrations about EXISTING-site evidence: "this change did not add it"
  // and "the site does not have it" are different sentences, and telling them
  // apart needs a site that already has something. `stored` replaces the whole
  // schema rather than merging, so a case says exactly what the site is.
  const meta = { value: JSON.stringify((opts && opts.stored) || STORED_SCHEMA) };
  const restore = stub({ ...opts, sql, prompts, meta, registered, patched, neonCalls, shots, traces });
  // ── A COMPILER ONLY WHEN THE CASE NEEDS ONE ──────────────────────────────
  //
  // `getContainer` throws by default and that default is what keeps a pageless
  // case honest: reaching a container means the route took the page path, and a
  // test that silently compiled there would be asserting about a shape it never
  // meant to produce. `publishes: true` opts in — for the two kinds that CANNOT
  // be pageless, a connection and a public function.
  // `compileFail: true` MAKES THE PUBLISH FAIL, which is the only way to reach
  // the look revert: the route stores the design, publishes, and puts the old
  // look back when the publish did not land. Without a seam here that branch
  // is a claim in a comment — which is exactly the shape of the defect the
  // ordering fix corrects, so leaving it undrivable would repeat it.
  const c = (opts && opts.publishes)
    ? installCompiler(opts.compileFail ? { ok: false, error: "compile failed" } : {})
    : null;
  try {
    const worker = await loadWorker();
    // `sitePages` NAMES ROUTES AND `storedPages` CARRIES WHOLE FILES, and the
    // second is not a convenience: what a page IMPORTS is a fact about the site
    // that only its real source can state, and `writtenPage` writes a page that
    // imports nothing. A case about the kit signatures the writer is shown has
    // to be able to say "this page calls <Accordion>".
    const store = bucket(slug,
      (opts && opts.storedPages) || (opts && opts.sitePages ? opts.sitePages.map(storedPage) : null),
      opts && opts.look, opts && opts.parts, opts && opts.css, opts && opts.partsFail,
      opts && opts.configFail, opts && opts.uploads, opts && opts.uploadsFail, opts && opts.noHead);
    const req = new Request("https://gofarther.dev/api/site/" + slug + "/addon", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: TOKEN },
      // ⚠ THE ZONE IS PART OF WHAT A REAL BROWSER SENDS, and leaving it out
      // made a whole wall undrivable: `aTz` decides `aToday`, and without a
      // date the one-time job's past-date refusal stands down. A fixture less
      // capable than the real request hides a defect exactly as well as one
      // that is more.
      body: JSON.stringify({ instruction, ...(opts && opts.tz ? { tz: opts.tz } : {}) }),
    });
    // THE SERVICE KEY IS PART OF THE ENVIRONMENT UNDER TEST: `persistSiteJobs`
    // returns at its first line without one, so a fixture that leaves it out
    // never registers a job at all and every assertion about which jobs the
    // platform will run is vacuous.
    const env = { SITES_BUCKET: store, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", SUPABASE_SERVICE_KEY: "svc-test", ...(c ? dispatchEnv() : {}) };
    // THE TRACE IS FLUSHED ON `waitUntil`, so it has not been written when the
    // response returns. Awaiting the ctx's own pending list is what makes the
    // route's black box readable at all — without it `traces` is always empty,
    // which reads exactly like a route that never marked anything.
    const ctx = makeCtx();
    const res = await worker.fetch(req, env, ctx);
    await Promise.allSettled(ctx.pending);
    const body = await res.json().catch(() => null);
    return { status: res.status, body, sql, prompts, store, registered, patched, neonCalls, traces, shots, compiles: c ? c.calls : [], meta: () => { try { return JSON.parse(meta.value); } catch { return null; } } };
  } finally { restore(); if (c) c.uninstall(); }
}

/** The request the named kind's designer really received, or `undefined`. */
export const promptFor = (r, kind) => r.prompts.find((p) => p.kind === kind);

/**
 * The request the PAGE WRITER received, or `undefined`.
 *
 * BY TOOL NAME, never by the property key `promptFor` matches on. The writer's
 * tool answers `pages` and the add step's page DESIGNER answers `page`, which
 * differ by one character in a file where every other lookup is by kind — so
 * the discriminator is the tool, which cannot be confused with anything.
 */
export const pagePrompt = (r) => r.prompts.find((p) => p.tool === "write_pages");

/** The stored developer record, as `saveAddonAnswer` left it. */
export function storedAnswer(r, slug) {
  for (const [k, v] of r.store.store) {
    if (k.includes(slug) && k.includes("addon-answer")) { try { return JSON.parse(v); } catch { return null; } }
  }
  return null;
}
