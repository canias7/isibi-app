// PARKED (2026-11-03, park-old-way): the old-way half of test/limited-login.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE SITE'S LIMITED LOGIN (2026-10-26, `site-app-login.mjs`).
//
// What is proven here, with a fake database and a stubbed Supabase (no Neon,
// no network): the role's statements (rows only: no CREATE, no ownership, no
// membership, no BYPASSRLS), the read-back that refuses anything more, the
// login's connection never in an error or a log line, the backfill (bounded,
// retryable, idempotent, inert until the column exists), the resolvers (the
// limited login for row work, the owner's only when the site has none yet,
// cannot-tell never read as none), and which call sites take which login.
// What Postgres does with the statements is `test/integration/local-pg-app-login.mjs`
// (a real PostgreSQL 16: DDL refused with 42501, rows as the owner saw them).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  appRoleName, appLoginStatements, appRoleCheckSql, appRoleProblems, APP_ROLE_EXPECTED, appConnFor,
  ensureAppLogin, backfillAppLogins, safeLoginError, appRowPolicySql, newAppPassword, APP_ROW_POLICY,
} from "../../../site-app-login.mjs";
import { scrubSecrets } from "../../../site-db.mjs";
import { RECOVER_QUERIES } from "../../../site-schema-recover.mjs";

const OWNER = "postgres://neondb_owner:ownerSECRETpw@ep-x-1.us-east-1.aws.neon.tech/site_fold_lane_bakery?sslmode=require";
const PW = "ab".repeat(32);
const GOOD_ROW = { ...APP_ROLE_EXPECTED };

/** A fake database: records each statement and the connection it ran on, answers the read-back. */
function fakeDb({ check = GOOD_ROW, failOn = null } = {}) {
  const ran = [];
  const exec = async (conn, sql) => {
    ran.push({ conn, sql });
    if (failOn && failOn.test(sql)) throw new Error(`permission denied running ${sql} on ${conn}`);
    if (/FROM pg_roles r WHERE/.test(sql)) return check ? [check] : [];
    return [];
  };
  return { ran, exec };
}

// ------------------------------------------------------------- the backfill

function store(slugs, { ownerFor = (s) => "postgres://o:p@h/site_" + s } = {}) {
  const st = { app: new Map(), cursor: "", ensured: [], saved: [] };
  const deps = {
    listMissing: async (after, limit) => slugs.filter((s) => !st.app.has(s) && s > after).sort().slice(0, limit),
    ownerConnFor: async (s) => ownerFor(s),
    ensure: async (owner) => { st.ensured.push(owner); return { conn: owner.replace("o:p", "app:q") }; },
    save: async (s, c) => { st.app.set(s, c); st.saved.push(s); return true; },
    readCursor: async () => st.cursor,
    writeCursor: async (c) => { st.cursor = c; },
    warn: () => {},
  };
  return { st, deps };
}

// ------------------------------------------------------- the Worker's resolvers

const W = await (await import("../../../test/fixtures/worker-harness.mjs")).loadWorkerModule();
const api = W.appLoginApi;
const APPC = "postgres://site_s1_app:" + PW + "@ep-x-1.neon.tech/site_s1?sslmode=require";
const OWNC = "postgres://neondb_owner:ownerSECRETpw@ep-x-1.neon.tech/site_s1?sslmode=require";

function withFetch(handler, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => handler(String(url), init);
  return fn().finally(() => { globalThis.fetch = real; });
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const kv = (map) => ({ get: async (k) => map[k] || null, put: async () => {}, delete: async () => {} });
const env = (extra = {}) => ({ SUPABASE_SERVICE_KEY: "svc", SITE_ROUTES: kv({ "site:s1": OWNC, "route:s1": OWNC, s1: OWNC }), ...extra });

// ------------------------------------------------ which call sites take which login

const SRC = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
/** The text of a block from one landmark to the next; both must exist. */
function block(from, to, start = 0) {
  const a = SRC.indexOf(from, start);
  assert.ok(a >= 0, "landmark: " + from);
  const b = SRC.indexOf(to, a + from.length);
  assert.ok(b > a, "landmark: " + to);
  return SRC.slice(a, b);
}

test("row paths open the limited login", () => {
  const rows = [
    ["async function proxySiteService(", "\n}\n", "siteRowConn(env, slug)"],
    ["async function routeTableNames(", "\n}\n", "ownerRowConn(env, slug)"],
    ["async function routeDigest(", "\n}\n", "ownerRowConn(env, slug)"],
    ["async function readConverseContext(", "\n}\n", "ownerRowConn(env, slug)"],
    ["async function refreshSiteMap(", "\n}\n", "ownerRowConn(env, slug)"],
    ["async function previewFtsRows(", "\n}\n", "siteRowConn(env, slug)"],
    ["async function rowReviewFacts(", "\n}\n", "siteAppConn(env,"],
    ["function backupDeps(env)", "\n}\n", "ownerRowConn(env, slug)"],
  ];
  for (const [from, to, want] of rows) {
    const b = block(from, to);
    assert.ok(b.includes(want), from + " → " + want);
    assert.ok(!/siteBackendBySlug\(env, (slug|cslug|vslug|wslug|row\.slug)\)/.test(b.replace("const ownerConn = await siteBackendBySlug(env, slug);", "")), "no owner login left in " + from);
  }
  // The owner's data panel (reads, saves, import, export) on the limited login; members on the owner's.
  assert.ok(SRC.includes("dbFor: (s2) => ownerRowConn(env, s2),"));
  assert.ok(SRC.includes("handleOwnerMembers({ ...ownerDeps, dbFor: (s2) => ownerSiteConn(env, s2) }, {"));
  // The data rung's row edits.
  assert.ok(SRC.includes("let ddb = await siteRowConn(env, ownerSlug);"));
});

test("schema and admin paths stay on the owner's login", () => {
  // The schema apply, the publication that adds tables, metrics' CREATE, the error table's CREATE.
  assert.ok(block("async function flushSiteMetrics(", "\n}\n").includes("siteBackendBySlug(env, slug)"));
  assert.ok(block("async function siteDbFor(", "\n}\n").includes("siteBackendBySlug(env, slug)"));
  assert.ok(block("async function frameTablesOf(", "\n}\n").includes("siteBackendBySlug(env, slug)"), "recovery's catalog reads need the owner's view of grants");
  // The error table's CREATE (2026-10-28: the site's own Worker stores reports
  // on the limited login, so the table is made by the schema apply, on the
  // owner's login, never on the visitor's path).
  // On a site built before the site's Worker wrote it, the platform makes it on the owner's login before handing the limited one over.
  assert.match(block("async function siteReadVars(env, slug)", "\n}\n"), /const ownerConn = await siteBackendBySlug\(env, slug\)[\s\S]*ERRORS_TABLE_SQL[\s\S]*sqlExec\(ownerConn, q\)/);
  const schema = readFileSync(new URL("../../../site-schema.mjs", import.meta.url), "utf8");
  assert.match(schema, /await sqlQuery\(uuid, "CREATE TABLE IF NOT EXISTS _errors /);
  assert.ok(!/CREATE TABLE/.test(readFileSync(new URL("../../../builder/lovable/template/src/lib/site-telemetry.ts", import.meta.url), "utf8")), "the visitor's path creates tables");
  // Provisioning makes the login on the owner's connection, after the database is recorded.
  const prov = block("async function ensureSiteBackend(env, slug, uid, brief, mark", "\n}\n");
  assert.match(prov, /await healSiteBackendDb\([\s\S]*provisionAppLogin\(env, slug, conn\)/);
  // The tick runs the backfill.
  assert.match(block("async scheduled(event, env, ctx)", "\n  },\n"), /runAppLoginBackfill\(env\)/);
});
