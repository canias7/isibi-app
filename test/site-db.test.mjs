// Unit tests for the Neon site-database layer.
// Pure functions only — no network, no database. Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  toPgPlaceholders,
  pgParams,
  dbNameForSite,
  projectNameForUser,
  connForDatabase,
  scrubSecrets,
} from "../site-db.mjs";

// ------------------------------------------------------------ placeholders

test("numbers placeholders in order", () => {
  assert.equal(
    toPgPlaceholders("SELECT * FROM t WHERE a=? AND b=? LIMIT ?"),
    "SELECT * FROM t WHERE a=$1 AND b=$2 LIMIT $3",
  );
});

test("leaves a ? inside a string literal alone", () => {
  assert.equal(
    toPgPlaceholders("SELECT * FROM t WHERE label='what?' AND id=?"),
    "SELECT * FROM t WHERE label='what?' AND id=$1",
  );
});

test("handles '' escapes inside a literal", () => {
  // the '' is an escaped quote, so the ? after it is still inside the literal
  assert.equal(
    toPgPlaceholders("SELECT 'it''s a ? here', ? FROM t"),
    "SELECT 'it''s a ? here', $1 FROM t",
  );
});

test("leaves a ? inside a quoted identifier alone", () => {
  assert.equal(
    toPgPlaceholders('SELECT "we?rd" FROM t WHERE id=?'),
    'SELECT "we?rd" FROM t WHERE id=$1',
  );
});

test("handles \"\" escapes inside an identifier", () => {
  assert.equal(
    toPgPlaceholders('SELECT "a""?b" FROM t WHERE id=?'),
    'SELECT "a""?b" FROM t WHERE id=$1',
  );
});

test("leaves a ? inside a line comment alone", () => {
  assert.equal(
    toPgPlaceholders("SELECT 1 -- why? because\nWHERE id=?"),
    "SELECT 1 -- why? because\nWHERE id=$1",
  );
});

test("leaves a ? inside a block comment alone", () => {
  assert.equal(
    toPgPlaceholders("SELECT /* huh? */ 1 WHERE id=?"),
    "SELECT /* huh? */ 1 WHERE id=$1",
  );
});

test("an unterminated literal swallows the rest (no spurious placeholders)", () => {
  // malformed SQL should fail in Postgres, not silently gain a parameter
  assert.equal(toPgPlaceholders("SELECT 'oops ? "), "SELECT 'oops ? ");
});

test("no placeholders is a no-op", () => {
  const sql = "CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)";
  assert.equal(toPgPlaceholders(sql), sql);
});

test("real statements from the site runtime", () => {
  assert.equal(
    toPgPlaceholders(
      'INSERT OR IGNORE INTO _bookmarks (user_id,target,created_at) VALUES (?,?,?)',
    ),
    'INSERT OR IGNORE INTO _bookmarks (user_id,target,created_at) VALUES ($1,$2,$3)',
  );
  assert.equal(
    toPgPlaceholders('SELECT 1 FROM _bookmarks WHERE user_id=? AND target=?'),
    'SELECT 1 FROM _bookmarks WHERE user_id=$1 AND target=$2',
  );
  assert.equal(
    toPgPlaceholders('SELECT id FROM "posts" WHERE id=? AND owner_id=?'),
    'SELECT id FROM "posts" WHERE id=$1 AND owner_id=$2',
  );
});

// ----------------------------------------------------------------- params

test("coerces booleans to 1/0 and undefined to null", () => {
  assert.deepEqual(pgParams([true, false, undefined, null, 0, "x"]), [1, 0, null, null, 0, "x"]);
});

test("empty and missing params are an empty array", () => {
  assert.deepEqual(pgParams([]), []);
  assert.deepEqual(pgParams(null), []);
  assert.deepEqual(pgParams(undefined), []);
});

// ------------------------------------------------------------------ names

test("site slug becomes a safe database identifier", () => {
  assert.equal(dbNameForSite("my-restaurant"), "site_my_restaurant");
  assert.equal(dbNameForSite("Already_Fine"), "site_already_fine");
  assert.equal(dbNameForSite("--weird--slug--"), "site_weird_slug");
});

test("database identifiers stay within Postgres's 63-char limit", () => {
  assert.ok(dbNameForSite("x".repeat(200)).length <= 63);
});

test("a slug with nothing usable in it is rejected, not silently coerced", () => {
  assert.throws(() => dbNameForSite("---"), /bad site slug/);
  assert.throws(() => dbNameForSite(""), /bad site slug/);
  assert.throws(() => dbNameForSite(null), /bad site slug/);
});

test("a slug cannot inject SQL through the database name", () => {
  assert.equal(dbNameForSite('a"; DROP DATABASE x; --'), "site_a_drop_database_x");
});

test("project name is derived from the user id", () => {
  assert.equal(projectNameForUser("abc123"), "isibi-user-abc123");
});

// ------------------------------------------------------------ connections

test("swaps the database in a connection URI, keeping host/role/password", () => {
  const base = "postgresql://neondb_owner:secret@ep-cool-1.us-east-1.aws.neon.tech/neondb?sslmode=require";
  const out = connForDatabase(base, "site_my_restaurant");
  assert.ok(out.startsWith("postgresql://neondb_owner:secret@ep-cool-1.us-east-1.aws.neon.tech/site_my_restaurant"));
  assert.ok(out.includes("sslmode=require"));
});

// ------------------------------------------------------- provisioning errors
//
// A build that cannot provision used to answer `detail: "{}"` and nothing else.
// Measured live 2026-08-04: build smoke failed that way and the cause could not
// be recovered from the response, the log, or anywhere else — a dead key, a plan
// limit, a project quota and a Neon outage all produce that same empty object,
// and each needs a completely different fix. Same shape as the `upstream: 400`
// incident one layer up.

test("a connection string never survives into an error", () => {
  // A Neon error can echo the parameters it was handed, and those carry a
  // PASSWORD. The scrub is what stands between that and a 502 body.
  const leaked = 'failed for postgres://neondb_owner:npg_S3cr3tPw@ep-x.aws.neon.tech/db?sslmode=require';
  const clean = scrubSecrets(leaked);
  assert.ok(!/npg_S3cr3tPw/.test(clean), "the password must not survive");
  assert.ok(!/neondb_owner/.test(clean), "nor the role it belongs to");
  assert.match(clean, /\[redacted\]/);
  assert.match(clean, /^failed for /, "and the rest of the message is kept");
});

test("it scrubs postgresql:// too, and every occurrence", () => {
  const two = scrubSecrets("a postgresql://u:p@h/d and postgres://u2:p2@h2/d2 b");
  assert.ok(!/:p@|:p2@/.test(two), two);
  assert.equal((two.match(/\[redacted\]/g) || []).length, 2);
});

test("text that is not a URI is left alone", () => {
  // Over-scrubbing would destroy the message this exists to preserve.
  const msg = "project quota exceeded: 100 of 100 projects on this plan";
  assert.equal(scrubSecrets(msg), msg);
});

test("the neon fetch keeps a non-JSON body instead of reporting {}", () => {
  // Asserted on the SOURCE: neonApi is network-bound and the invariant is about
  // which parser runs first. `r.json().catch(() => ({}))` is the exact line that
  // turned an HTML gateway page into an empty object, so it must not come back.
  const src = fs.readFileSync(new URL("../site-db.mjs", import.meta.url), "utf8");
  // COMMENTS BLANKED, NOT REMOVED — the comment above the fix QUOTES the bad
  // pattern in order to explain it, so a raw scan reports the explanation as the
  // defect. (Blanking rather than deleting keeps every offset valid, which is
  // the rule this repo arrived at after three separate off-by-region bugs.)
  const blanked = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const fn = blanked.slice(blanked.indexOf("async function neonApi"), blanked.indexOf("export function scrubSecrets"));
  assert.ok(fn.length > 200, "the guard must actually be looking at the function");
  assert.ok(!/\.json\(\)\s*\.catch/.test(fn),
    "reading the body as JSON-or-{} discards every non-JSON error Neon can send");
  assert.match(fn, /await r\.text\(\)/, "the body has to be read as text first");
  assert.match(fn, /e\.status = r\.status/, "and the status carried, since it is the whole diagnosis");
});

test("the build route returns the upstream status, not just a sentence", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = src.indexOf('"could not provision the database"');
  assert.ok(i > 0, "the provisioning failure branch must still exist");
  // Windowed to the whole Response.json rather than a guessed character count:
  // adding one field pushed `scrubSecrets` outside a 400-char window and failed
  // a correct change. An assertion sized by luck is one that goes red for the
  // wrong reason — the third time that has happened in this repo.
  const branch = src.slice(i, src.indexOf("}, { status: 502 })", i));
  assert.ok(branch.length > 0 && branch.length < 2000, `the branch did not close cleanly (${branch.length} chars)`);
  assert.match(branch, /upstream:\s*\(e && e\.status\)/, "a 401, a 403 and a 500 are indistinguishable without it");
  assert.match(branch, /scrubSecrets\(/, "and the detail is scrubbed before it leaves the Worker");
});

// ── the two enable endpoints ────────────────────────────────────────────────
//
// Every build on the platform failed with Neon answering "this route does not
// exist", for the whole of 2026-08-04. `enableDataApi` posted to `/data_api`
// with an underscore and no database name; Neon's endpoint is
// `/data-api/{database}`. `neon e2e` provisions a REAL project and never called
// either enable function, so it was green throughout — that gap is closed there,
// and these hold the shape at $0 between runs.

test("the Data API endpoint names the database, with a hyphen", () => {
  const src = fs.readFileSync(new URL("../site-db.mjs", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const fn = src.slice(src.indexOf("export async function enableDataApi"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /branches\/\$\{branchId\}\/data-api\//, "the path must be /data-api/<database>");
  assert.ok(!/data_api/.test(body), "an underscore here is the 404 that broke every build");
  assert.match(body, /encodeURIComponent\(dbName\)/, "the database name reaches a URL and must be encoded");
});

test("enableDataApi refuses to call Neon without a database name", async () => {
  // Fails BEFORE the network, or the failure is a confusing 404 from Neon
  // rather than a clear one from us. A fetch that runs here is the bug.
  const db = await import("../site-db.mjs");
  let called = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; throw new Error("should not be reached"); };
  try {
    await assert.rejects(() => db.enableDataApi({ NEON_API_KEY: "k" }, "p", "b"), /database name/);
    assert.equal(called, false, "it called Neon with no database in the path");
  } finally { globalThis.fetch = realFetch; }
});

test("both enable calls carry the database name from the caller", () => {
  // Derived at the seam: site-db can only build the right URL if provisioning
  // hands the name over, and worker.js is what wires the dep.
  const prov = fs.readFileSync(new URL("../site-provision.mjs", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  assert.match(prov, /deps\.enableAuth\(proj, dbName\)/, "auth must be told which database");
  assert.match(prov, /deps\.enableData\(proj, dbName\)/, "so must the Data API");

  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  assert.match(worker, /enableData:\s*\(proj, dbName\)\s*=>\s*enableDataApi\([^)]*dbName\)/,
    "the worker drops the database name before it reaches site-db");
});

test("a provisioning failure carries its status and its stage out", () => {
  // `upstream: null` on a real failure is what made this take a day: the wrappers
  // kept `detail` and dropped `status`, so a 404 (wrong path), a 401 (dead key)
  // and a 5xx read identically — and the route dropped `stage`, so the two
  // different Neon endpoints were indistinguishable.
  const prov = fs.readFileSync(new URL("../site-provision.mjs", import.meta.url), "utf8");
  for (const stage of ["enable_auth", "enable_data_api"]) {
    const i = prov.indexOf(`stage: "${stage}"`);
    assert.ok(i > 0, `${stage} no longer stamps a stage`);
    assert.match(prov.slice(i - 260, i), /status: e && e\.status/, `${stage} drops the HTTP status`);
  }
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const j = worker.indexOf('"could not provision the database"');
  assert.ok(j > 0);
  const branch = worker.slice(j, j + 500);
  assert.match(branch, /upstream:/, "the route must report the upstream status");
  assert.match(branch, /stage:/, "and which provisioning step failed");
});

// ── the endpoint a published site is reached through ────────────────────────
//
// `saveAuthInfo` and `saveDataInfo` read `.conn` off the row `siteNeonProject`
// returns. That row has no `conn` column — it has `neon_conn` — so the read was
// `undefined`, `connForDatabase` threw on `new URL(undefined)`, and the catch
// around the call swallowed it. Silently, on every build, since the day it was
// written: NEITHER `auth_info` NOR `data_api` has ever been written to any
// site's `_meta`, which is every generated site answering 501 no_backend on
// every read, every form and every sign-in. Measured live 2026-08-04.

test("the save deps read the column the project row actually has", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

  // Derived at BOTH ends: what the lookup SELECTs, against what the savers read.
  //
  // The url is built from ADJACENT string literals — a template literal for the
  // filter, then a plain string for the select — so a single-literal regex sees
  // nothing. Same trap the `_users` column sweep hit: match the anchor, then
  // read forward past the concatenation.
  const at = src.indexOf("site_project?slug=eq");
  assert.ok(at > 0, "the project lookup is gone");
  const sel = src.slice(at, at + 400).match(/select=([a-z_,]+)/);
  assert.ok(sel, "the project lookup no longer selects named columns");
  const columns = sel[1].split(",");
  assert.ok(columns.includes("neon_conn"), `the lookup selects ${sel[1]} — no connection column`);

  for (const dep of ["saveAuthInfo", "saveDataInfo"]) {
    const i = src.indexOf(dep + ":");
    assert.ok(i > 0, `${dep} is gone`);
    const body = src.slice(i, src.indexOf("},", i));
    assert.match(body, /connForDatabase\(\s*proj\.neon_conn/, `${dep} builds its connection from a column that is not on the row`);
    assert.ok(!/lookupProject\([^)]*\)\)\.conn\b/.test(body), `${dep} reads .conn, which is undefined`);
  }
});

test("a failed endpoint save is logged, not swallowed", () => {
  // A bare `catch {}` is what let a one-word bug live: it threw on every build
  // of every site and nothing anywhere said so. EVERY call site now, not the
  // first — the reuse-path heal added a second pair (2026-08-14) and the
  // first-match window stopped covering the pair it was written for. Each
  // call's NEXT catch must warn; the heal's two saves share one catch, and
  // the non-reuse pair each have their own.
  const prov = fs.readFileSync(new URL("../site-provision.mjs", import.meta.url), "utf8");
  for (const dep of ["saveAuthInfo", "saveDataInfo"]) {
    const sites = [...prov.matchAll(new RegExp("deps\\." + dep + "\\(", "g"))];
    assert.ok(sites.length >= 2, dep + " lost a call site — the heal or the first-build save is gone");
    for (const m of sites) {
      const at = prov.indexOf("catch", m.index);
      assert.ok(at > m.index, dep + " has a call site with no catch after it (offset " + m.index + ")");
      assert.match(prov.slice(at, at + 200), /warn/,
        dep + "'s failure is swallowed with no log (call at offset " + m.index + ")");
    }
  }
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /warn:\s*\(m\)\s*=>\s*console\.error\(m\)/, "the worker supplies no warn, so the log goes nowhere");
});

test("an already-enabled Neon Auth still returns its config", async () => {
  // The recovery path, mirrored from the Data API's (2026-08-14 audit) — the
  // asymmetry was the bug: `info: null` on the already-branch meant a site
  // whose first auth_info save failed could NEVER recover, because every later
  // build lands here and null is the one answer the caller refuses to store.
  const db = await import("../site-db.mjs");
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, init) => {
    calls.push(((init && init.method) || "GET") + " " + String(u));
    if ((init && init.method) === "POST") {
      return { ok: false, status: 409, text: async () => JSON.stringify({ message: "already enabled" }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ url: "https://ep-x.neon.tech/auth" }) };
  };
  try {
    const r = await db.enableNeonAuth({ NEON_API_KEY: "k" }, "p", "b", "site_x");
    assert.equal(r.already, true);
    assert.ok(r.info && /^https:\/\//.test(r.info.url), "the config must be re-fetched, not left null");
    assert.ok(calls.some((c) => c.startsWith("GET ") && c.includes("/auth")), "it never went back for the config");
  } finally { globalThis.fetch = realFetch; }
});

test("an auth re-fetch that fails leaves info null and does not throw", async () => {
  // Best-effort on top of best-effort — the GET's path is the one thing not
  // measured against a real project, so a 404 there must behave exactly as the
  // pre-fix code did: already-enabled IS success.
  const db = await import("../site-db.mjs");
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, init) => {
    if ((init && init.method) === "POST") {
      return { ok: false, status: 409, text: async () => JSON.stringify({ message: "already enabled" }) };
    }
    return { ok: false, status: 404, text: async () => "not found" };
  };
  try {
    const r = await db.enableNeonAuth({ NEON_API_KEY: "k" }, "p", "b", "site_x");
    assert.equal(r.already, true);
    assert.equal(r.info, null);
  } finally { globalThis.fetch = realFetch; }
});

test("THE HEAL AND THE PROXY ASK ONE READER — worker's missingServices goes through siteServiceBase", () => {
  // Two readers of one _meta are two things that can disagree about what
  // "recorded" means — the vault lesson, one store over. The heal must ask
  // for BOTH keys through the same function the 501 decision reads.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = worker.indexOf("missingServices: async");
  assert.ok(at > 0, "the worker no longer supplies missingServices — the heal is dead again");
  const block = worker.slice(at, worker.indexOf("},", at));
  assert.match(block, /siteServiceBase\(conn2, "auth_info"\)/, "auth is not asked through the shared reader");
  assert.match(block, /siteServiceBase\(conn2, "data_api"\)/, "data is not asked through the shared reader");
  assert.equal(/siteAuthBase|siteDataBase/.test(block), false,
    "the heal reads the memoized caches — a stale null decides whether to heal");
});

test("an already-enabled Data API still returns its url", async () => {
  // The recovery path. Returning `info: null` meant a site whose first save
  // failed could never heal, because every rebuild takes this branch — and every
  // site built before the fix is in exactly that state.
  const db = await import("../site-db.mjs");
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, init) => {
    calls.push(((init && init.method) || "GET") + " " + String(u));
    if ((init && init.method) === "POST") {
      return { ok: false, status: 409, text: async () => JSON.stringify({ message: "already enabled" }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ url: "https://ep-x.apirest.aws.neon.tech/site_x/rest/v1" }) };
  };
  try {
    const r = await db.enableDataApi({ NEON_API_KEY: "k" }, "p", "b", "site_x");
    assert.equal(r.already, true);
    assert.ok(r.info && /^https:\/\//.test(r.info.url), "the url must be re-fetched, not left null");
    assert.ok(calls.some((c) => c.startsWith("GET")), "it never went back for the config");
  } finally { globalThis.fetch = realFetch; }
});

test("a re-fetch that fails does not fail the build", () => {
  // Best-effort on top of best-effort: already-enabled IS success, and a failed
  // re-read must not turn a working retry into a failed build.
  const src = fs.readFileSync(new URL("../site-db.mjs", import.meta.url), "utf8");
  const i = src.indexOf("ALREADY ON: FETCH THE CONFIG");
  assert.ok(i > 0, "the recovery branch is gone");
  const branch = src.slice(i, src.indexOf("return { enabled: true, already: true, info };", i));
  assert.match(branch, /catch\s*\{/, "the re-fetch must not be able to fail the build");
});

test("a container that answers with no JSON says what it DID answer", () => {
  // Seven words for every distinct failure: a 500 with a stack trace, a 502 from
  // the runtime, an OOM kill and an empty 200 all read identically. Reached live
  // 2026-08-04 on a build whose GENERATION had succeeded, and the response could
  // not say why the container went quiet.
  // RAW, not comment-stripped: a naive stripper blanks from the `//` inside
  // `http://build/build` to the end of that line and loses the anchor entirely.
  // worker.js is searched raw in this repo for exactly that reason, with
  // patterns that cannot appear in prose — so the comment beside the fix is
  // worded to avoid quoting the pattern this asserts against.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // ANCHORED INSIDE THE BUILD PATH, not on the first occurrence in the file.
  // `recompileAndPublish` — the shared spine the free text edit and the cheap
  // edit path use — also calls the container, and it is defined ABOVE this one,
  // so a bare `indexOf` silently started asserting against the wrong function.
  // First-occurrence anchors break by ADDITION, which is the hardest kind to
  // predict when writing one.
  const bp = src.indexOf("async function buildAndPublishPages");
  assert.ok(bp > 0, "the build function is gone");
  const i = src.indexOf("getContainer(env.SITE_BUILD_CONTAINER)", bp);
  assert.ok(i > bp, "the container call is gone from the build path");
  // Windowed to the END OF THE DEP, not a guessed character count. A 1400-char
  // window stopped 134 characters short of the thing it asserts — the third time
  // in this session an assertion sized by luck went red for the wrong reason.
  //
  // AND THEN THE REPLACEMENT BOUND WAS A GUESSED CHARACTER COUNT TOO (`< 4000`),
  // so it went red the moment the payload grew one honest field. What the bound
  // was ever FOR is proving the `publish:` we found belongs to THIS dep rather
  // than a later object — which is a property, not a size: another
  // `getContainer` in between is the only thing that could mean we overshot.
  const end = src.indexOf("publish:", i);
  assert.ok(end > i, "the compile dep has no publish: after it");
  assert.equal(src.slice(i + 1, end).indexOf("getContainer(env.SITE_BUILD_CONTAINER)"), -1,
    "the window ran past this dep into another container call");
  const after = src.slice(i, end);
  assert.ok(!/r\.json\(\)\s*\.catch/.test(after), "the container's answer is being discarded again");
  assert.match(after, /await r\.text\(\)/, "the body must be read as text so a non-JSON answer survives");
  assert.match(after, /r\.status/, "the status is what separates a 500 from an empty 200");
});

test("every function ensureSiteBackend calls is actually declared", () => {
  // THE BUG THIS EXISTS FOR. `saveAuthInfo` and `saveDataInfo` called
  // `lookupProject(slug)` in their bodies while it existed ONLY as a key in the
  // deps literal — a bare identifier that is a ReferenceError at runtime, thrown
  // on the first line of both, on every build of every site, and swallowed by
  // the best-effort catch around them. `_meta` held nothing but `schema`, so
  // every generated site 501'd on every read, form and sign-in.
  //
  // `node --check` cannot see this: it is valid syntax. There is no linter here
  // and adding one for a repo with no devDependencies is a bigger change than
  // the bug, so this is the narrow version — scoped to the function that had it,
  // and derived rather than a list of names somebody remembered.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const start = src.indexOf("async function ensureSiteBackend(");
  assert.ok(start > 0, "ensureSiteBackend is gone");
  const end = src.indexOf("\n}", src.indexOf("return conn;", start));
  // COMMENTS **AND STRING LITERALS** blanked. Without the strings, the SQL
  // `CREATE TABLE IF NOT EXISTS _meta (…)` reads as a call to an undeclared
  // `_meta` — scanning code without removing its strings is the same mistake
  // that ate an anchor containing `//` earlier today. Blanked, never deleted, so
  // offsets stay valid.
  const blank = (t) => t
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, (m) => m.replace(/[^\n]/g, " "));
  const body = blank(src.slice(start, end));

  // What worker.js declares anywhere: imports, and top-level or local bindings.
  const declared = new Set();
  for (const m of src.matchAll(/^import\s*\{([^}]+)\}/gm)) {
    for (const n of m[1].split(",")) declared.add(n.trim().split(/\s+as\s+/i).pop().trim());
  }
  for (const m of src.matchAll(/(?:^|[\s;{(])(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of src.matchAll(/(?:^|\s)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  // Destructured bindings, which several helpers here use.
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=/g)) {
    for (const n of m[1].split(",")) declared.add(n.trim().split(":").pop().trim().split("=")[0].trim());
  }

  const GLOBALS = new Set(["fetch", "JSON", "String", "Number", "Boolean", "Object", "Array", "Math",
    "Date", "Promise", "Error", "console", "encodeURIComponent", "decodeURIComponent", "Set", "Map",
    "URL", "Request", "Response", "Headers", "AbortSignal", "TextEncoder", "TextDecoder", "atob", "btoa",
    "parseInt", "parseFloat", "isNaN", "Symbol", "RegExp", "crypto", "structuredClone", "if", "for",
    "while", "switch", "catch", "return", "typeof", "await", "function", "class", "new", "throw",
    "async", "do", "else", "try", "yield", "void", "delete", "in", "of"]);

  const missing = new Set();
  for (const m of body.matchAll(/(?:^|[^\w$.])([a-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (GLOBALS.has(name) || declared.has(name)) continue;
    missing.add(name);
  }
  assert.deepEqual([...missing], [],
    `called but never declared — a ReferenceError at runtime: ${[...missing].join(", ")}`);
});

// ── the Data API needs a token even for a visitor ──────────────────────────
//
// Measured 2026-08-04: every public read answered `400 missing authentication
// credentials: required authorization bearer token in JWT format`. Neon always
// runs a request as a Postgres role chosen from the JWT, and the unauthenticated
// role — `anonymous` — still needs one. There is no no-header path.

test("grants name Neon's roles, not Supabase's", async () => {
  // `anon` does not exist on Neon; the role is `anonymous`. Postgres refuses a
  // GRANT naming a role that does not exist, and the apply loop logs and carries
  // on, so every grant on every table failed silently since the Data API landed.
  const rls = await import("../site-rls.mjs");
  assert.equal(rls.DATA_API_ROLES.anon, "anonymous");
  assert.equal(rls.DATA_API_ROLES.user, "authenticated");
  for (const access of ["display", "collect", "admin", "user"]) {
    // Filtered to GRANTs: `grantsFor` also emits the REVOKEs that make a
    // withdrawal real, and those name the same two roles in a `FROM` clause.
    for (const stmt of rls.grantsFor({ name: "services", access }).filter((x) => /^GRANT /.test(x))) {
      assert.ok(!/\bTO anon\b/.test(stmt), `grants to a role that does not exist: ${stmt}`);
      assert.match(stmt, /TO (anonymous|authenticated);$/, stmt);
    }
  }
});

test("each grant names ONE role, so a bad name cannot take the other down", () => {
  // The half that made it total rather than partial. `TO anon, authenticated` is
  // a single statement, so the bad name took `authenticated` with it and even a
  // signed-in member got nothing.
  return import("../site-rls.mjs").then((rls) => {
    for (const access of ["display", "collect", "admin", "user"]) {
      for (const stmt of rls.grantsFor({ name: "services", access })) {
        assert.ok(!/TO [a-z]+, /.test(stmt), `two roles in one statement: ${stmt}`);
      }
    }
    // display and collect must still reach BOTH roles, across two statements.
    for (const access of ["display", "collect"]) {
      const all = rls.grantsFor({ name: "services", access }).join(" ");
      assert.match(all, /TO anonymous;/, `${access} is unreachable by a visitor`);
      assert.match(all, /TO authenticated;/, `${access} is unreachable by a member`);
    }
  });
});

test("the data proxy attaches an anonymous token when the caller has none", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("async function proxySiteService");
  assert.ok(at > 0, "the proxy is gone");
  const body = src.slice(at, src.indexOf("\n}", src.indexOf("couldn't reach that just now", at)));

  assert.match(body, /which === "data" && !headers\.has\("authorization"\)/,
    "the token must be added only for DATA, and only when the caller sent none — a member's own token must never be replaced");
  assert.match(body, /Bearer " \+ anon/, "the token has to actually go out as a bearer");
  // Keyed on the connection. memoize uses its FIRST argument as the cache key,
  // so passing env first would key every site to one entry and hand `env` to the
  // fetcher in place of the database.
  assert.match(body, /siteAnonToken\(db\)/, "the token cache must be keyed on the site, not on env");
});

test("an anonymous token is never cached as a failure, and says why", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const siteAnonToken = memoize(");
  assert.ok(at > 0, "the token fetcher is gone");
  const body = src.slice(at, src.indexOf("\n});", at));
  // makeCache refuses null, so returning null on failure is what keeps a brief
  // outage from breaking the site for the whole TTL.
  assert.match(body, /return null/, "a failure must return null so it is not cached");
  assert.match(body, /console\.error/, "a missing token is invisible from outside — the request just goes out bare");
  // Short: these tokens are short-lived and a stale one is a 401 on a first read.
  const ttl = /makeCache\(\{ ttlMs: (\d+)/.exec(src.slice(src.indexOf("_siteAnonToken")));
  assert.ok(ttl && Number(ttl[1]) <= 300_000, `anon token TTL is ${ttl && ttl[1]}ms — too long for a short-lived token`);
});

// ------------------------------------------------------- the org id, cached

test("a Neon blip is not cached as 'this key has no org'", async () => {
  // `neonOrgId` swallowed EVERY error and wrote `_orgId = null` — a value that
  // means one specific thing: "this key cannot address /users/me, so it is
  // org-scoped and needs no org id". So one 5xx or dropped connection during a
  // first provision made every LATER build in that isolate create its Neon
  // project in the personal account instead of the org. It succeeds, it is
  // recorded, the site works — it just bills the wrong home and counts against
  // the wrong project cap, with nothing logged. Per-isolate, so it heals on
  // recycle, which is also why nobody would ever catch it.
  const { neonOrgId, _resetNeonOrgCache } = await import("../site-db.mjs");
  const real = globalThis.fetch;
  const env = { NEON_API_KEY: "k" };
  const quiet = console.error;
  try {
    console.error = () => {};

    // A 5xx must NOT stick: the next call asks again and gets the real answer.
    _resetNeonOrgCache();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? new Response("upstream", { status: 502 })
        : new Response(JSON.stringify({ organizations: [{ id: "org-real" }] }), { status: 200 });
    };
    assert.equal(await neonOrgId(env), null, "a blip should answer null for THIS call");
    assert.equal(await neonOrgId(env), "org-real", "the blip was cached — every later build bills the wrong account");
    assert.equal(calls, 2, "the second call did not re-ask");

    // A network throw is the same class as a 5xx and must behave identically.
    _resetNeonOrgCache();
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) throw new TypeError("fetch failed");
      return new Response(JSON.stringify({ organizations: [{ id: "org-real" }] }), { status: 200 });
    };
    assert.equal(await neonOrgId(env), null);
    assert.equal(await neonOrgId(env), "org-real", "a throw was cached");

    // A 4xx DOES stick — that is the case the null was written for, and caching
    // it is what stops every provision re-asking a question with a fixed answer.
    _resetNeonOrgCache();
    calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("nope", { status: 403 }); };
    assert.equal(await neonOrgId(env), null);
    assert.equal(await neonOrgId(env), null);
    assert.equal(calls, 1, "an org-scoped key re-asks on every provision");

    // And a real org is cached too, or the same round trip runs on every build.
    _resetNeonOrgCache();
    calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ organizations: [{ id: "org-x" }] }), { status: 200 }); };
    assert.equal(await neonOrgId(env), "org-x");
    assert.equal(await neonOrgId(env), "org-x");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = real;
    console.error = quiet;
    (await import("../site-db.mjs"))._resetNeonOrgCache();
  }
});
