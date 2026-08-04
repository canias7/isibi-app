// Per-site Postgres on Neon.
//
// Shape: one Neon PROJECT per isibi user, one DATABASE inside that project per
// site the user builds. A user's project is created lazily the first time they
// build anything; each new site adds a database to it. Sites belonging to
// different users therefore sit in different projects (independent compute,
// independent PITR, scale-to-zero per customer), and a user's own sites are
// isolated from each other at the database level.
//
// Replaced Cloudflare D1 on 2026-07-27. Needs ONE Worker secret: NEON_API_KEY.
//
// Everything here is network-free until called, and the SQL helpers are pure
// functions of (sql, params) so they can be unit-tested without a database.

import { neon } from "@neondatabase/serverless";

const NEON_API = "https://console.neon.tech/api/v2";

// Region for new projects. Keep every project in one region so latency from the
// Worker is predictable; Neon names these `aws-<aws-region>`.
export const NEON_REGION = "aws-us-east-1";

// ---------------------------------------------------------------- REST layer

export function neonConfigured(env) {
  return !!(env && env.NEON_API_KEY);
}

async function neonApi(env, path, init) {
  const r = await fetch(NEON_API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NEON_API_KEY}`,
      "content-type": "application/json",
      accept: "application/json",
      ...((init && init.headers) || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  // READ THE BODY AS TEXT FIRST. `r.json().catch(() => ({}))` turns any
  // non-JSON error — an HTML gateway page, a bare string, an empty 403 — into
  // `{}`, and `{}` is the most reassuring possible way to say nothing at all.
  // Measured 2026-08-04: build smoke failed with `detail: "{}"` and the reason
  // could not be recovered from the response, from the log, or from anywhere
  // else. Same failure as the `upstream: 400` incident, one layer down.
  const text = await r.text().catch(() => "");
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = null; }
  if (!r.ok) {
    // The STATUS is what separates the causes: 401 is a dead key, 403 a
    // permission or plan limit, 422 a quota, 5xx Neon itself. Without it every
    // one of them reads identically, and they need completely different fixes.
    const e = new Error("neon api " + ((init && init.method) || "GET") + " " + path + " failed: " + r.status);
    e.status = r.status;
    // Falls back to the raw text when it was not JSON, so nothing is lost, and
    // scrubs any connection string — a Neon error can echo the params it was
    // given, and those carry a PASSWORD.
    e.detail = scrubSecrets((body === null ? text : JSON.stringify(body)) || "(empty body)").slice(0, 400);
    throw e;
  }
  return body === null ? {} : body;
}

/** Never let a Postgres URI reach a response or a log — it carries a password. */
export function scrubSecrets(s) {
  return String(s).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[redacted]");
}

// An org-scoped API key infers its org, a personal key must name one. Resolve it
// once per isolate and remember the answer (including "none", so a personal key
// on a personal account doesn't re-ask on every provision).
let _orgId;
export async function neonOrgId(env) {
  if (_orgId !== undefined) return _orgId;
  try {
    const d = await neonApi(env, "/users/me/organizations");
    const orgs = (d && d.organizations) || [];
    _orgId = orgs.length ? orgs[0].id : null;
  } catch {
    _orgId = null; // org-scoped key: /users/me is not addressable, and not needed
  }
  return _orgId;
}

// ------------------------------------------------------------- provisioning

// Neon database + role names are Postgres identifiers. Site slugs are already
// constrained upstream, but this is the last gate before the name reaches DDL,
// so normalise hard rather than trusting the caller.
export function dbNameForSite(slug) {
  const s = String(slug || "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!s) throw Object.assign(new Error("bad site slug: " + slug), { bad: true });
  return ("site_" + s).slice(0, 63);
}

export function projectNameForUser(uid) {
  return "isibi-user-" + String(uid || "").slice(0, 40);
}

/**
 * A project's name, per SITE.
 *
 * This is what an operator reads in the Neon console, and it is the only place
 * they can tell one project from another — so it carries the slug. Named after
 * the owner instead, a user with seven sites would have seven
 * identically-named projects and no way to know which to delete.
 *
 * Normalised the same way `dbNameForSite` normalises, and bounded: Neon
 * project names are not Postgres identifiers, but a name assembled from
 * user input still gets the same treatment as one that is.
 */
export function projectNameForSite(slug) {
  const s = String(slug || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!s) throw Object.assign(new Error("bad site slug: " + slug), { bad: true });
  return ("isibi-" + s).slice(0, 60);
}

// Swap the database name in a Neon connection URI. Every database inside a
// project shares one endpoint host and role, so a site's connection string is
// the project's connection string with a different path segment — no extra API
// call and no password fetch at request time.
export function connForDatabase(projectConn, dbName) {
  const u = new URL(projectConn);
  u.pathname = "/" + dbName;
  return u.toString();
}

// Creating a project (or a database) returns as soon as the work is SCHEDULED —
// the branch, endpoint and default database are still being built. Neon refuses
// further calls against a project while its operations are in flight
// ("project already has running conflicting operations"), so every provisioning
// step waits for quiet before the next one starts.
const OP_PENDING = new Set(["scheduling", "running", "cancelling"]);

export async function waitForProject(env, projectId, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const d = await neonApi(env, `/projects/${projectId}/operations`);
    const ops = (d && d.operations) || [];
    const pending = ops.filter((o) => OP_PENDING.has(String(o && o.status)));
    if (!pending.length) {
      // A failed setup operation would otherwise surface later as a confusing
      // connection error, so surface it here where the cause is obvious.
      const bad = ops.find((o) => ["failed", "error"].includes(String(o && o.status)));
      if (bad) throw Object.assign(new Error("neon operation " + bad.action + " " + bad.status), { detail: JSON.stringify(bad).slice(0, 300) });
      return;
    }
    if (Date.now() > deadline) {
      throw Object.assign(new Error("neon project " + projectId + " still busy after " + timeoutMs + "ms"), {
        detail: pending.map((o) => o.action + ":" + o.status).join(", "),
      });
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

// Create a user's Neon project. Returns everything needed to address it later.
export async function createUserProject(env, uid) {
  const project = { name: projectNameForUser(uid), region_id: NEON_REGION };
  const org = await neonOrgId(env);
  if (org) project.org_id = org;

  const d = await neonApi(env, "/projects", {
    method: "POST",
    body: JSON.stringify({ project }),
  });

  const conn = ((d.connection_uris || [])[0] || {}).connection_uri;
  if (!d.project || !d.project.id || !conn) {
    throw Object.assign(new Error("neon create project: unexpected response"), {
      detail: JSON.stringify(d).slice(0, 300),
    });
  }
  // The project exists but is still being built; nothing may touch it until quiet.
  await waitForProject(env, d.project.id);

  return {
    projectId: d.project.id,
    branchId: (d.branch && d.branch.id) || null,
    roleName: ((d.roles || [])[0] || {}).name || null,
    conn, // points at the project's default database
  };
}

/**
 * One site's own Neon project (2026-07-29 — was one per user).
 *
 * Identical to `createUserProject` in everything but the name, and kept as its
 * own function rather than a flag because the two answer different questions and
 * the caller should have to say which it means. `createUserProject` stays for the
 * legacy rows that predate the change.
 */
export async function createSiteProject(env, slug) {
  const project = { name: projectNameForSite(slug), region_id: NEON_REGION };
  const org = await neonOrgId(env);
  if (org) project.org_id = org;

  const d = await neonApi(env, "/projects", { method: "POST", body: JSON.stringify({ project }) });
  const conn = ((d.connection_uris || [])[0] || {}).connection_uri;
  if (!d.project || !d.project.id || !conn) {
    throw Object.assign(new Error("neon create project: unexpected response"), {
      detail: JSON.stringify(d).slice(0, 300),
    });
  }
  // Scheduled, not built. Nothing may touch it until quiet — see waitForProject.
  await waitForProject(env, d.project.id);
  return {
    projectId: d.project.id,
    branchId: (d.branch && d.branch.id) || null,
    roleName: ((d.roles || [])[0] || {}).name || null,
    conn,
  };
}

/**
 * Turn Neon Auth on for a site's project.
 *
 * The whole backend is Neon as of 2026-07-30, and that includes identity: a
 * site's members live in `neon_auth.users_sync` inside the site's own database
 * rather than in a `_users` table this repo hand-rolled. `users_sync.id` is
 * **TEXT**, which is why every `owner_id` in the schema engine had to stop being
 * an integer.
 *
 * CALLED ON EVERY BUILD, not only at creation, and that is the point. A project
 * can exist without auth enabled — the create succeeded and this call failed, or
 * it predates the change — and a retried build reuses the project, so enabling
 * only at creation would leave that site permanently without identity while
 * every retry reported success. The same reasoning that made `"already exists"`
 * the one recoverable database error.
 *
 * So an already-enabled project must be a NO-OP rather than a failure. Neon
 * answers a conflict for that, and anything with "already" in it is treated as
 * done; everything else throws, because a site whose auth is off is a site whose
 * member pages return nothing.
 */
export async function enableNeonAuth(env, projectId, branchId, dbName) {
  if (!projectId || !branchId) throw Object.assign(new Error("neon auth: need a project and a branch"), { bad: true });
  // `database_name` is REQUIRED in practice even though the API calls it
  // optional: it defaults to the branch's database only when there is exactly
  // one, and a site's project has two — Neon's default `neondb` plus the
  // `site_<slug>` this repo creates. Measured against a real project
  // 2026-07-30: omitting it answers `expecting exactly one database when
  // database name is not set; got:"2"`. Naming it explicitly is also the
  // difference between auth landing in the site's database and landing in an
  // unused one, which nothing would have noticed until a member tried to sign in.
  if (!dbName) throw Object.assign(new Error("neon auth: need the database name"), { bad: true });
  // The response body is KEPT. It is how a client learns where to sign in — the
  // auth endpoint and whatever public identifier goes with it — and discarding it
  // meant the one call that provisions identity told us nothing about how to
  // reach it. The caller decides what is safe to store; nothing here logs it,
  // because a provisioning response is exactly the shape that carries a secret.
  let info = null;
  try {
    info = await neonApi(env, `/projects/${projectId}/branches/${branchId}/auth`, {
      method: "POST",
      body: JSON.stringify({ auth_provider: "better_auth", database_name: dbName }),
    });
  } catch (e) {
    const already = e && (e.status === 409 || /already/i.test(String(e.detail || e.message || "")));
    if (!already) throw e;
    return { enabled: true, already: true, info: null };
  }
  // Enabling auth is an async project operation like every other one — the
  // schema is still being created when the call returns, and a schema apply
  // racing it would not see `neon_auth`.
  await waitForProject(env, projectId);
  return { enabled: true, already: false, info };
}

/**
 * Turn on Neon's Data API for a site's branch.
 *
 * This is what serves the site's tables to its own pages once the Worker's
 * `/api/db/<slug>/rows` routes are gone, so a site without it has no backend at
 * all — every list is empty and every form fails.
 *
 * **FATAL, like `enableNeonAuth` and for the same reason.** A caller can retry a
 * failure and cannot retry a success, so reporting a successful build for a site
 * whose data layer was never enabled is the worse outcome. The full error is
 * attached rather than summarised, because the ONE thing not verified against a
 * real project here is this endpoint's path — and a wrong path has to be
 * correctable from the first failed build rather than the third.
 *
 * Idempotent on "already": it runs on EVERY build, not only at creation, because a
 * retried build reuses the project and enabling only once would leave a site
 * permanently without a data layer while every retry reported success.
 */
export async function enableDataApi(env, projectId, branchId, dbName) {
  if (!projectId || !branchId) throw Object.assign(new Error("data api: need a project and a branch"), { bad: true });
  // THE DATABASE NAME IS PART OF THE PATH. Measured live 2026-08-04: every build
  // died with Neon answering "this route does not exist", because this was
  // `/data_api` with an underscore and no database. A site's project holds more
  // than one database and Neon will not guess between them — which is what the
  // ordering comment in site-provision.mjs already said the call needed, and
  // this signature never took.
  if (!dbName) throw Object.assign(new Error("data api: need the database name"), { bad: true });
  let info = null;
  try {
    info = await neonApi(env, `/projects/${projectId}/branches/${branchId}/data-api/${encodeURIComponent(dbName)}`, { method: "POST", body: "{}" });
  } catch (e) {
    const already = e && (e.status === 409 || /already/i.test(String(e.detail || e.message || "")));
    if (!already) {
      throw Object.assign(new Error("could not enable the Neon Data API"), {
        detail: String((e && (e.detail || e.message)) || "").slice(0, 400),
        status: e && e.status,
      });
    }
    return { enabled: true, already: true, info: null };
  }
  await waitForProject(env, projectId);
  return { enabled: true, already: false, info };
}

// Add one site's database to an existing project.
export async function createSiteDatabase(env, projectId, branchId, roleName, slug) {
  const name = dbNameForSite(slug);
  await neonApi(env, `/projects/${projectId}/branches/${branchId}/databases`, {
    method: "POST",
    body: JSON.stringify({ database: { name, owner_name: roleName } }),
  });
  // Creating a database is itself an async operation: wait, or the first query
  // races the database into existence.
  await waitForProject(env, projectId);
  return name;
}

export async function dropSiteDatabase(env, projectId, branchId, slug) {
  const name = dbNameForSite(slug);
  await neonApi(env, `/projects/${projectId}/branches/${branchId}/databases/${name}`, {
    method: "DELETE",
  });
}

export async function dropUserProject(env, projectId) {
  await neonApi(env, `/projects/${projectId}`, { method: "DELETE" });
}

// ------------------------------------------------------------- query layer

// The site runtime was written against D1, which uses `?` placeholders; Postgres
// uses `$1..$n`. Rewriting here rather than at the ~2300 call sites keeps the
// whole runtime untouched.
//
// A naive replace would corrupt any `?` inside a string literal, a quoted
// identifier or a comment, so this walks the statement instead.
export function toPgPlaceholders(sql) {
  const s = String(sql);
  let out = "";
  let n = 0;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    // '...' literal, '' escapes a quote
    if (c === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "'") {
          if (s[j + 1] === "'") { j += 2; continue; }
          break;
        }
        j++;
      }
      out += s.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    // "..." quoted identifier, "" escapes a quote
    if (c === '"') {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') { j += 2; continue; }
          break;
        }
        j++;
      }
      out += s.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "-" && s[i + 1] === "-") {           // -- line comment
      const j = s.indexOf("\n", i);
      const e = j === -1 ? s.length : j;
      out += s.slice(i, e);
      i = e;
      continue;
    }
    if (c === "/" && s[i + 1] === "*") {           // /* block comment */
      const j = s.indexOf("*/", i + 2);
      const e = j === -1 ? s.length : j + 2;
      out += s.slice(i, e);
      i = e;
      continue;
    }
    if (c === "?") { out += "$" + ++n; i++; continue; }
    out += c;
    i++;
  }
  return out;
}

// D1 bound a JS boolean as the text "true"/"false", so the runtime standardised
// on 1/0 for flags and the app reads them back as truthy/falsy. Keep that
// convention — the declared columns are integers, and binding a real boolean to
// an integer column is an error in Postgres (it was merely sloppy in SQLite).
export function pgParams(params) {
  return (params || []).map((v) => (v === true ? 1 : v === false ? 0 : v === undefined ? null : v));
}

// One driver instance per connection string. `neon()` is a thin closure over
// fetch (no socket, nothing to pool or close), so caching costs nothing and
// avoids re-parsing the URI on every query.
const _clients = new Map();
function client(conn) {
  let c = _clients.get(conn);
  if (!c) {
    c = neon(conn, { fullResults: true });
    _clients.set(conn, c);
  }
  return c;
}

// Run SQL against ONE site's database. Returns the result rows.
// Always parameterize — never string-concat caller input into `sql`.
export async function sqlQuery(conn, sql, params) {
  const r = await client(conn).query(toPgPlaceholders(sql), pgParams(params));
  return (r && r.rows) || [];
}

// As sqlQuery, but also reports how many rows the statement changed, so scoped
// UPDATE/DELETE can tell "done" from "matched nothing" (a visitor trying to edit
// a row that isn't theirs changes 0). SELECT reports 0 changes, matching what
// the runtime saw from D1's meta.changes.
export async function sqlExec(conn, sql, params) {
  const r = await client(conn).query(toPgPlaceholders(sql), pgParams(params));
  const command = (r && r.command) || "";
  return {
    results: (r && r.rows) || [],
    changes: command === "SELECT" ? 0 : (typeof r.rowCount === "number" ? r.rowCount : null),
  };
}
