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
  // of every site and nothing anywhere said so.
  const prov = fs.readFileSync(new URL("../site-provision.mjs", import.meta.url), "utf8");
  for (const dep of ["saveAuthInfo", "saveDataInfo"]) {
    const i = prov.indexOf("deps." + dep + "(");
    assert.ok(i > 0, `${dep} is no longer called`);
    const after = prov.slice(i, i + 240);
    assert.match(after, /catch \(e\)[^}]*warn/, `${dep}'s failure is swallowed with no log`);
  }
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /warn:\s*\(m\)\s*=>\s*console\.error\(m\)/, "the worker supplies no warn, so the log goes nowhere");
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
  const i = src.indexOf("getContainer(env.SITE_BUILD_CONTAINER)");
  assert.ok(i > 0, "the container call is gone");
  // Windowed to the END OF THE DEP, not a guessed character count. A 1400-char
  // window stopped 134 characters short of the thing it asserts — the third time
  // in this session an assertion sized by luck went red for the wrong reason.
  const end = src.indexOf("publish:", i);
  assert.ok(end > i && end - i < 4000, `the compile dep did not close cleanly (${end - i})`);
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
