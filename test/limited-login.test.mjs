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
} from "../site-app-login.mjs";
import { scrubSecrets } from "../site-db.mjs";
import { RECOVER_QUERIES } from "../site-schema-recover.mjs";

const OWNER = "postgres://neondb_owner:ownerSECRETpw@ep-x-1.us-east-1.aws.neon.tech/site_fold_lane_bakery?sslmode=require";
const PW = "ab".repeat(32);
const GOOD_ROW = { ...APP_ROLE_EXPECTED };

test("the role is named from the database, at most 63 characters, and refuses a name that is not one", () => {
  assert.equal(appRoleName("site_fold_lane_bakery"), "site_fold_lane_bakery_app");
  const long = "site_" + "x".repeat(58);
  assert.equal(long.length, 63);
  assert.equal(appRoleName(long).length, 63);
  assert.ok(appRoleName(long).endsWith("_app"));
  for (const bad of ["", "Site", "a;drop", 'a"b', "x".repeat(64)]) assert.throws(() => appRoleName(bad));
});

test("the statements give rows and nothing else", () => {
  const st = appLoginStatements("site_fold_lane_bakery", PW);
  assert.ok(st.length >= 12, "the observer sees the statements");
  const all = st.join("\n");
  const role = '"site_fold_lane_bakery_app"';
  // Granted: connect, usage, the four row verbs, sequences, functions, and the same by default.
  assert.match(all, new RegExp(`GRANT CONNECT ON DATABASE "site_fold_lane_bakery" TO ${role}`));
  assert.match(all, new RegExp(`GRANT USAGE ON SCHEMA public TO ${role}`));
  assert.match(all, new RegExp(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`));
  assert.match(all, new RegExp(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`));
  assert.match(all, /ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO/);
  assert.match(all, /ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO/);
  // Never: CREATE, ALL, TRUNCATE, REFERENCES, TRIGGER, ownership, membership, the powerful attributes.
  for (const s of st) {
    const grant = /^\s*(GRANT|ALTER DEFAULT PRIVILEGES[^G]*GRANT)\s+(.*?)\s+ON\s/i.exec(s);
    if (grant) assert.doesNotMatch(grant[2], /CREATE|ALL|TRUNCATE|REFERENCES|TRIGGER/i, s);
    assert.doesNotMatch(s, /OWNER TO/i, s);
    assert.doesNotMatch(s, /^\s*GRANT\s+"[^"]+"\s+TO/i, "no role membership: " + s);
    assert.doesNotMatch(s, /\b(?<!NO)(SUPERUSER|CREATEDB|CREATEROLE|BYPASSRLS|REPLICATION)\b/, s);
  }
  assert.match(st[0], /CREATE ROLE .* LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS/);
  assert.match(all, /REVOKE CREATE ON SCHEMA public FROM PUBLIC/);
  assert.match(all, new RegExp(`REVOKE CREATE ON SCHEMA public FROM ${role}`));
  // The ALTER names only LOGIN and the password (naming the attributes needs a superuser).
  const alter = st.find((s) => /^ALTER ROLE/.test(s));
  assert.equal(alter, `ALTER ROLE ${role} WITH LOGIN PASSWORD '${PW}'`);
  // The row policy, on every RLS table, for this role only.
  assert.match(all, new RegExp(`CREATE POLICY ${APP_ROW_POLICY} ON public.%I TO %I USING \\(true\\) WITH CHECK \\(true\\)`));
  assert.match(all, /c\.relrowsecurity/);
});

test("a password that is not hex is refused before any statement", () => {
  for (const bad of ["", "short", "x'; DROP TABLE t; --" + "a".repeat(40), "AB".repeat(32)]) assert.throws(() => appLoginStatements("site_a", bad));
  assert.match(newAppPassword(), /^[0-9a-f]{64}$/);
  assert.notEqual(newAppPassword(), newAppPassword());
});

test("the read-back refuses every power beyond a row login, and a missing row", () => {
  assert.deepEqual(appRoleProblems(GOOD_ROW), []);
  assert.deepEqual(appRoleProblems(null), Object.keys(APP_ROLE_EXPECTED));
  for (const [k, v] of Object.entries({ super: true, createdb: true, createrole: true, replication: true, bypassrls: true, inherit: true, member_of: 1, owns: 3, can_create: true, login: false })) {
    assert.deepEqual(appRoleProblems({ ...GOOD_ROW, [k]: v }), [k], k);
  }
  // Cannot-tell is not a pass: a string "false" is not false.
  assert.deepEqual(appRoleProblems({ ...GOOD_ROW, bypassrls: "false" }), ["bypassrls"]);
  const sql = appRoleCheckSql("site_a");
  for (const col of ["rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls", "rolinherit", "pg_auth_members", "relowner", "has_schema_privilege"]) assert.ok(sql.includes(col), col);
});

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

test("ensureAppLogin runs on the owner's connection and answers the limited one", async () => {
  const db = fakeDb();
  const got = await ensureAppLogin(OWNER, { exec: db.exec, password: PW });
  assert.ok(db.ran.length >= 13);
  assert.ok(db.ran.every((r) => r.conn === OWNER), "every statement on the owner's login");
  const u = new URL(got.conn);
  assert.equal(got.role, "site_fold_lane_bakery_app");
  assert.equal(u.username, "site_fold_lane_bakery_app");
  assert.equal(u.password, PW);
  assert.equal(u.hostname, "ep-x-1.us-east-1.aws.neon.tech");
  assert.equal(u.pathname, "/site_fold_lane_bakery");
  assert.equal(u.searchParams.get("sslmode"), "require");
  assert.ok(!got.conn.includes("ownerSECRETpw"), "the owner's password is not carried over");
});

test("a role that comes back with more than a row login is refused and no connection is answered", async () => {
  const db = fakeDb({ check: { ...GOOD_ROW, bypassrls: true } });
  await assert.rejects(ensureAppLogin(OWNER, { exec: db.exec, password: PW }), (e) => e.code === "app-login-refused" && /bypassrls/.test(e.message));
  const none = fakeDb({ check: null });
  await assert.rejects(ensureAppLogin(OWNER, { exec: none.exec, password: PW }), (e) => e.code === "app-login-refused");
});

test("a failed statement's error carries neither password nor connection", async () => {
  const db = fakeDb({ failOn: /ALTER ROLE/ });
  let err = null;
  try { await ensureAppLogin(OWNER, { exec: db.exec, password: PW }); } catch (e) { err = e; }
  assert.ok(err, "it threw");
  assert.equal(err.code, "app-login-failed");
  assert.ok(!err.message.includes(PW), err.message);
  assert.ok(!err.message.includes("ownerSECRETpw"), err.message);
  assert.ok(err.message.includes("[redacted]"), "the observer saw the text it scrubbed");
});

test("scrubSecrets and safeLoginError cover the limited login's connection", () => {
  const app = appConnFor(OWNER, "site_fold_lane_bakery", PW);
  assert.ok(app.includes(PW), "the observer: the connection carries the password");
  assert.ok(!scrubSecrets("boom " + app).includes(PW));
  assert.ok(!safeLoginError(new Error("x " + app + " y"), PW).includes(PW));
  assert.ok(!safeLoginError(new Error("ALTER ROLE r WITH LOGIN PASSWORD 'zz'")).includes("'zz'"));
  // A bare password, in no URI and no statement, is taken out too.
  assert.ok(!safeLoginError(new Error("auth failed for " + PW), PW).includes(PW));
});

test("the row policy statement is a no-op without the role and names the role by appRoleName's rule", () => {
  const s = appRowPolicySql("bookings");
  assert.match(s, /left\(current_database\(\), 59\) \|\| '_app'/);
  assert.match(s, /IF EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = r\)/);
  assert.match(s, /CREATE POLICY gf_app_rows ON public\.%I TO %I USING \(true\) WITH CHECK \(true\)', 'bookings', r\)/);
  assert.match(appRowPolicySql("o'x"), /'o''x'/, "a quote in a name stays inside its literal");
});

test("recovery reads every policy but the limited login's (so `USING (true)` is never read as a public read)", () => {
  assert.match(RECOVER_QUERIES.policies, /pg_policies/);
  assert.match(RECOVER_QUERIES.policies, /policyname <> 'gf_app_rows'/);
});

test("applySiteSchema emits the row policy for every table it applies", () => {
  const src = readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const at = src.indexOf("export async function applySiteSchema");
  const loopAt = src.indexOf("for (const stmt of policiesFor(", at);
  assert.ok(at > 0 && loopAt > at, "both landmarks exist");
  const next = src.slice(loopAt, loopAt + 1200);
  assert.match(next, /await sqlQuery\(uuid, appRowPolicySql\(t\.name\)\)/);
});

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

test("the backfill is bounded per tick and reaches every site", async () => {
  const { st, deps } = store(["a", "b", "c", "d", "e"]);
  const r1 = await backfillAppLogins(deps, { limit: 2 });
  assert.deepEqual([r1.tried, r1.made], [2, 2]);
  assert.deepEqual(st.saved, ["a", "b"]);
  await backfillAppLogins(deps, { limit: 2 });
  await backfillAppLogins(deps, { limit: 2 });
  assert.deepEqual([...st.app.keys()].sort(), ["a", "b", "c", "d", "e"]);
});

test("the backfill is idempotent: a site with a login is never made again", async () => {
  const { st, deps } = store(["a", "b"]);
  await backfillAppLogins(deps, { limit: 5 });
  const n = st.ensured.length;
  assert.equal(n, 2);
  const again = await backfillAppLogins(deps, { limit: 5 });
  assert.equal(st.ensured.length, n, "nothing re-made");
  assert.equal(again.tried, 0);
});

test("a failing site is retried on a later lap and does not hold the others back", async () => {
  let failB = true;
  const { st, deps } = store(["a", "b", "c"]);
  const ensure = deps.ensure;
  deps.ensure = async (owner) => { if (failB && owner.endsWith("site_b")) throw new Error("db asleep postgres://o:p@h/site_b"); return ensure(owner); };
  const warns = [];
  deps.warn = (m) => warns.push(m);
  const one = await backfillAppLogins(deps, { limit: 3 });
  assert.deepEqual([one.tried, one.made, one.failed], [3, 2, 1], "the same tick carries on past b");
  assert.ok(st.app.has("a") && st.app.has("c") && !st.app.has("b"), "c was reached past b");
  assert.ok(warns.length && warns.every((w) => !w.includes("o:p@")), "the warning carries no connection");
  failB = false;
  await backfillAppLogins(deps, { limit: 2 });
  await backfillAppLogins(deps, { limit: 2 });
  assert.ok(st.app.has("b"), "retried");
});

test("an unrecorded login is not counted made, and a site with no database is skipped", async () => {
  const { st, deps } = store(["a", "b"], { ownerFor: (s) => (s === "b" ? null : "postgres://o:p@h/site_" + s) });
  deps.save = async () => false;
  const r = await backfillAppLogins(deps, { limit: 5 });
  assert.deepEqual([r.made, r.failed, r.skipped], [0, 1, 1]);
  assert.equal(st.app.size, 0);
});

test("the backfill does nothing until the column exists", async () => {
  const { deps } = store(["a"]);
  deps.listMissing = async () => null;
  let ensured = 0;
  deps.ensure = async () => { ensured++; return { conn: "x" }; };
  const r = await backfillAppLogins(deps, { limit: 3 });
  assert.equal(r.notReady, true);
  assert.equal(ensured, 0);
});

// ------------------------------------------------------- the Worker's resolvers

const W = await (await import("./fixtures/worker-harness.mjs")).loadWorkerModule();
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

test("row work takes the limited login when the site has one", async () => {
  api.forget("s1");
  await withFetch((url) => {
    if (url.includes("/site_project?") && url.includes("select=app_conn")) return json([{ app_conn: APPC }]);
    return json([]);
  }, async () => {
    assert.equal(await api.siteRowConn(env(), "s1"), APPC);
    api.forget("s1");
    assert.equal(await api.ownerRowConn(env(), "s1"), APPC);
  });
});

test("a site with no limited login yet falls back to the owner's (empty column, or the column not there)", async () => {
  for (const answer of [() => json([{ app_conn: null }]), () => json([{ app_conn: "" }]), () => json([]),
    () => json({ code: "42703", message: "column site_project.app_conn does not exist" }, 400)]) {
    api.forget("s1");
    let ownerAsked = 0;
    await withFetch((url) => {
      if (url.includes("select=app_conn")) return answer();
      if (url.includes("/site_backends?")) { ownerAsked++; return json([{ neon_db: "site_s1", uid: "u1", brief: "" }]); }
      if (url.includes("/site_project?")) return json([{ uid: "u1", neon_project: "p", neon_branch: "b", neon_role: "r", neon_conn: OWNC }]);
      return json([]);
    }, async () => {
      const got = await api.siteRowConn({ SUPABASE_SERVICE_KEY: "svc" }, "s1");
      assert.equal(new URL(got).username, "neondb_owner");
      assert.ok(ownerAsked > 0);
    });
  }
});

test("cannot-tell is not 'no limited login': a failed lookup throws, never falls back to the owner", async () => {
  for (const answer of [() => json({ message: "boom" }, 500), () => new Response("not json", { status: 200 }), () => json({ message: "other column" }, 400)]) {
    api.forget("s1");
    await withFetch((url) => (url.includes("select=app_conn") ? answer() : json([{ neon_db: "site_s1", uid: "u1" }])), async () => {
      await assert.rejects(api.siteRowConn(env(), "s1"));
    });
  }
});

test("provisioning records the login, and the save names only the slug back", async () => {
  api.forget("s9");
  const sent = [];
  await withFetch((url, init) => {
    sent.push({ url, method: init.method || "GET", body: init.body || "" });
    if (init.method === "PATCH") return json([{ slug: "s9" }]);
    return json([]);
  }, async () => {
    const ok = await api.saveAppConn(env(), "s9", APPC);
    assert.equal(ok, true);
  });
  const patch = sent.find((s) => s.method === "PATCH");
  assert.ok(patch && /site_project\?slug=eq\.s9&select=slug/.test(patch.url), patch && patch.url);
  assert.deepEqual(JSON.parse(patch.body), { app_conn: APPC });
});

test("a failed provision logs no secret", async () => {
  const lines = [];
  const realErr = console.error;
  console.error = (...a) => lines.push(a.join(" "));
  try {
    // An owner connection to nowhere: the driver's own error is what is logged, scrubbed.
    await withFetch(() => { throw new Error("connect failed for " + OWNC); }, async () => {
      const ok = await api.provisionAppLogin(env(), "s1", OWNC);
      assert.equal(ok, false);
    });
  } finally { console.error = realErr; }
  assert.ok(lines.length > 0, "the observer saw a line");
  for (const l of lines) { assert.ok(!l.includes("ownerSECRETpw"), l); assert.ok(!/postgres:\/\/[^[]/.test(l), l); }
});

test("the backfill tick is a no-op until the column exists", async () => {
  let patched = 0;
  await withFetch((url, init) => {
    if (init.method === "PATCH") patched++;
    if (url.includes("app_conn.is.null")) return json({ code: "42703", message: "column site_project.app_conn does not exist" }, 400);
    return json([]);
  }, async () => {
    const r = await api.runAppLoginBackfill({ SUPABASE_SERVICE_KEY: "svc" });
    assert.equal(r.notReady, true);
  });
  assert.equal(patched, 0);
});

// ------------------------------------------------ which call sites take which login

const SRC = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
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

test("visitor row paths run in the site's own Worker, on the limited login only (2026-10-28: the site's own Worker)", () => {
  // The platform's visitor handlers (api, hook, error, turnstile, checkout,
  // uploads, the site's Stripe message) were deleted: each now goes to the
  // site's Worker, which holds exactly one database login — the limited one.
  const vm = SRC.match(/const vm = url\.pathname\.match\(\/\^\\\/api\\\/db\\\/[^\n]*\)\$\/i\);/);
  assert.ok(vm, "the visitor-route pattern");
  for (const p of ["data\\/", "auth\\/", "|error|", "|uploads)"]) assert.ok(vm[0].includes(p), "visitor route " + p);
  // The prebuilt features' routes (outside connections, inbound hooks, checkout,
  // the spam check, the site's Stripe message) left with them on 2026-10-29.
  for (const p of ["|api\\/", "(?:api\\/", "hook\\/", "checkout", "turnstile"]) assert.ok(!vm[0].includes(p), "visitor route " + p + " is still routed");
  assert.ok(!SRC.includes('url.pathname.startsWith("/api/stripe/site/")'), "the site's Stripe message is still routed");
  // What the site's Worker is given: the limited login as APP_CONN, never the owner's.
  const given = block("const app = await siteAppConn(env, slug)", "legacy,\n");
  assert.match(given, /secrets: \{ \.\.\.owned, \.\.\.\(app \? \{ APP_CONN: app \} : \{\}\) \}/);
  // The owner's login appears here only to CREATE the tables the site writes
  // into (the limited one cannot create); it is never put in what is handed over.
  const handed = given.slice(given.indexOf("return {"));
  assert.ok(handed.length > 0 && !/ownerConn|siteBackendBySlug\(|ownerSiteConn\(/.test(handed), "the owner's login is handed to the site");
  assert.match(given, /for \(const q of \[ERRORS_TABLE_SQL, HITS_TABLE_SQL\]\) await sqlExec\(ownerConn, q\)/);
  // And the site's own writers open that one login.
  const T = (f) => readFileSync(new URL("../builder/lovable/template/src/lib/" + f, import.meta.url), "utf8");
  assert.match(T("site-functions.ts"), /return siteSql\(String\(env\.APP_CONN\), String\(text\), params\);/);
  assert.match(T("site-telemetry.ts"), /const conn = env\.APP_CONN as string;/);
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
  const schema = readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  assert.match(schema, /await sqlQuery\(uuid, "CREATE TABLE IF NOT EXISTS _errors /);
  assert.ok(!/CREATE TABLE/.test(readFileSync(new URL("../builder/lovable/template/src/lib/site-telemetry.ts", import.meta.url), "utf8")), "the visitor's path creates tables");
  // Provisioning makes the login on the owner's connection, after the database is recorded.
  const prov = block("async function ensureSiteBackend(env, slug, uid, brief, mark", "\n}\n");
  assert.match(prov, /await healSiteBackendDb\([\s\S]*provisionAppLogin\(env, slug, conn\)/);
  // The tick runs the backfill.
  assert.match(block("async scheduled(event, env, ctx)", "\n  },\n"), /runAppLoginBackfill\(env\)/);
});
