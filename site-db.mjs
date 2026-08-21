// Per-site Postgres on Neon.
//
// Shape: one Neon PROJECT per Go Farther user, one DATABASE inside that project per
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

/**
 * How long a locked project is waited out, and in how many steps.
 *
 * Exported so the test drives the real numbers rather than restating them — a
 * retry budget asserted against a copy of itself proves nothing.
 */
export const NEON_LOCK_TRIES = 6;
export const NEON_LOCK_STEP_MS = 1500;

/**
 * Neon's own "busy, try again".
 *
 * 423 Locked, `project already has running conflicting operations, scheduling
 * of new ones is prohibited`. MEASURED LIVE 2026-08-17: a `build smoke` run
 * died at `upstream: 423` before the designer's schema could be applied, and
 * the whole paid run was lost to it — 10 passed, 14 failed, none of them about
 * the code under test.
 *
 * `waitForProject` ALREADY GUARDS THIS AND CANNOT CLOSE IT. It polls
 * `/operations` after every scheduling call and returns when none are pending —
 * but Neon's operations list is eventually consistent, so a poll issued
 * immediately after a POST can see the work before it is REGISTERED, find
 * nothing pending, and return clean. The next call is then refused. Waiting
 * longer up front would slow every build to fix a race that is about ordering
 * rather than duration.
 *
 * RETRYING IS SAFE HERE FOR ONE SPECIFIC REASON, and it is the whole argument:
 * 423 means Neon DID NOT DO IT. There is no partial project, no half-created
 * database, nothing to reconcile — the call was refused at the door. That is
 * what separates this from every other status, and why nothing else is retried.
 */
function neonLocked(status, body, text) {
  if (status !== 423) return false;
  const msg = String((body && body.message) || text || "");
  // The STATUS alone would be enough today, and the message is checked as well
  // so that a future 423 meaning something other than "busy" is not silently
  // retried six times before failing.
  return /conflicting operations|already has running/i.test(msg) || !msg;
}

async function neonApi(env, path, init) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await neonApiOnce(env, path, init);
    } catch (e) {
      if (!e || !e.locked || attempt >= NEON_LOCK_TRIES - 1) throw e;
      await new Promise((r) => setTimeout(r, NEON_LOCK_STEP_MS));
    }
  }
}

async function neonApiOnce(env, path, init) {
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
    // Marked here rather than decided by the caller, so the one place that
    // knows both the status and the body is the one place that judges it.
    if (neonLocked(r.status, body, text)) e.locked = true;
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
//
// A BLIP IS NOT AN ANSWER, AND THIS CACHED IT AS ONE. The catch swallowed every
// error and wrote `_orgId = null` — a value that means one specific thing, "this
// key cannot address /users/me, so it is org-scoped and needs no org id" — so a
// single 5xx or dropped connection during a first provision made every later
// build in that isolate create its Neon project in the PERSONAL account instead
// of the org. It succeeds, it is recorded, the site works: the project simply
// bills the wrong home and counts against the wrong project cap, with nothing
// logged. Per-isolate, so it heals on recycle, which is also why nobody would
// ever catch it.
//
// So a 4xx is cached and nothing else is. Only the client-error statuses mean
// "you may not ask this question"; a 5xx, a timeout and a network fault all mean
// "ask again", and the caller gets null for THIS call without that becoming a
// fact about the key.
let _orgId;
export async function neonOrgId(env) {
  if (_orgId !== undefined) return _orgId;
  try {
    const d = await neonApi(env, "/users/me/organizations");
    const orgs = (d && d.organizations) || [];
    _orgId = orgs.length ? orgs[0].id : null;
  } catch (e) {
    const st = e && e.status;
    if (st >= 400 && st < 500) {
      _orgId = null; // org-scoped key: /users/me is not addressable, and not needed
    } else {
      console.error("neon org lookup failed, not caching:", st || (e && e.message));
      return null; // transient — leave `_orgId` unset so the next build re-asks
    }
  }
  return _orgId;
}

/** Test seam: forget the resolved org so a case can drive the lookup again. */
export function _resetNeonOrgCache() { _orgId = undefined; }

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
const OP_BAD = new Set(["failed", "error"]);

/**
 * How far back a failed operation still counts as this call's.
 *
 * Exported so the test drives the real number rather than restating it — a
 * window asserted against a copy of itself proves nothing.
 *
 * The op being waited on was scheduled moments before this call, so anything
 * this wide is generous: the only thing that stretches the gap is the POST
 * itself being retried through the 423 lock budget. Both directions of being
 * wrong are graceful and neither is silent. Too WIDE and a retry inside the
 * window re-reports the previous attempt's failure — the bug below, bounded to
 * minutes instead of forever. Too NARROW and a failure from a heavily-retried
 * POST reads as history and surfaces later as a connection error, which is what
 * every unpolled failure already does.
 */
export const NEON_OP_WINDOW_MS = 120000;

export async function waitForProject(env, projectId, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  // A FAILURE THIS CALL DID NOT CAUSE IS NOT THIS CALL'S TO REPORT.
  //
  // The scan below used to read the WHOLE operations list — a project's entire
  // history — and this function runs on every build, not only at creation:
  // after createSiteDatabase, after enableNeonAuth, after enableDataApi. So one
  // Neon hiccup, ever, made that slug PERMANENTLY unbuildable. Every retry
  // reuses the project (lookupProject is keyed by slug), polls, re-finds the
  // same historical `failed` op and throws again — with a message about an
  // operation that stopped running days ago — and both enables are deliberately
  // fatal, so the route answers 502 "could not provision the database" forever
  // and the only escape is abandoning the slug. Measured 2026-08-21 against a
  // list holding one old `failed` op and nothing pending: it threw.
  //
  // `created_at` IS THE DISCRIMINATOR, and the obvious alternative was tried
  // first and is worse. Snapshotting the failures the FIRST poll shows and
  // judging only what appears afterwards needs no clock — but the first poll can
  // legitimately already hold OUR operation, failed, beside something still
  // pending, and that snapshot throws it away. `test/neon-wait.test.mjs` pins
  // exactly that case ("a failure is only reported once the work is quiet"), so
  // the coarse rule trades a permanent-unbuildable bug for a silent-miss one.
  //
  // AN OPERATION WITH NO USABLE TIMESTAMP IS JUDGED, deliberately. That is the
  // pre-fix behaviour, so nothing we cannot date is newly ignored, and every
  // real Neon operation carries `created_at` — the narrowing only ever applies
  // to a row that says how old it is.
  const startedAt = Date.now();
  const mine = (o) => {
    if (!OP_BAD.has(String(o && o.status))) return false;
    const at = Date.parse((o && o.created_at) || "");
    return !Number.isFinite(at) || at >= startedAt - NEON_OP_WINDOW_MS;
  };
  for (;;) {
    const d = await neonApi(env, `/projects/${projectId}/operations`);
    const ops = (d && d.operations) || [];
    const pending = ops.filter((o) => OP_PENDING.has(String(o && o.status)));
    if (!pending.length) {
      // A failed setup operation would otherwise surface later as a confusing
      // connection error, so surface it here where the cause is obvious.
      const bad = ops.find(mine);
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

/**
 * The half of a create that runs AFTER Neon has already made the project.
 *
 * NEON CREATES THE PROJECT WHEN THE POST RETURNS, so every throw from this
 * point on leaves a BILLED resource behind — and the only record a project has
 * is a Supabase row that has not been written yet. site-provision.mjs's
 * record-it-or-destroy-it rule was keyed on `createSiteProject` having RETURNED,
 * so neither of the two throws below could ever be cleaned up: the shape guard,
 * and `waitForProject` (a 90s deadline, or a failed operation). Measured
 * 2026-08-21 — Neon answered with project `proj-123`, this threw, and the error
 * carried nothing the caller could drop.
 *
 * So the id TRAVELS ON THE ERROR. One copy for both create functions, because a
 * second copy that forgets to attach it is the same silent leak again.
 *
 * The one case that still cannot be cleaned up is a POST whose response never
 * reaches us — the 30s `AbortSignal.timeout` in `neonApiOnce`, or a dropped
 * connection, after Neon has already created the project. There is no id to
 * drop and nothing in this repo reconciles Neon's project list against
 * Supabase, so that orphan is invisible. Left as a stated gap rather than
 * guessed at: a reconciliation sweep is a product decision, not a repair.
 */
async function projectFromCreate(env, d, name) {
  const projectId = (d && d.project && d.project.id) || null;
  const conn = (((d && d.connection_uris) || [])[0] || {}).connection_uri;
  if (!projectId || !conn) {
    throw Object.assign(new Error("neon create project: unexpected response"), {
      // SCRUBBED. This body holds `connection_uris`, which carry a PASSWORD, and
      // the detail is returned to the caller and logged — `neonApiOnce` already
      // scrubs for exactly this reason and this line did not. Measured
      // 2026-08-21: a response missing `project` put a live `postgres://` URI
      // straight into the error.
      detail: scrubSecrets(JSON.stringify(d)).slice(0, 300),
      // null when Neon told us nothing to drop; the caller's cleanup is a no-op
      // then, and the orphan (if any) is the invisible class described above.
      projectId,
      projectName: name,
    });
  }
  // The project exists but is still being built; nothing may touch it until quiet.
  try { await waitForProject(env, projectId); }
  catch (e) {
    if (e && typeof e === "object") { e.projectId = projectId; e.projectName = name; }
    throw e;
  }
  return {
    projectId,
    branchId: (d.branch && d.branch.id) || null,
    roleName: ((d.roles || [])[0] || {}).name || null,
    conn, // points at the project's default database
  };
}

// Create a user's Neon project. Returns everything needed to address it later.
export async function createUserProject(env, uid) {
  const name = projectNameForUser(uid);
  const project = { name, region_id: NEON_REGION };
  const org = await neonOrgId(env);
  if (org) project.org_id = org;

  const d = await neonApi(env, "/projects", {
    method: "POST",
    body: JSON.stringify({ project }),
  });
  return projectFromCreate(env, d, name);
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
  const name = projectNameForSite(slug);
  const project = { name, region_id: NEON_REGION };
  const org = await neonOrgId(env);
  if (org) project.org_id = org;

  const d = await neonApi(env, "/projects", { method: "POST", body: JSON.stringify({ project }) });
  // Scheduled, not built — and already BILLED. `projectFromCreate` owns the rest
  // so a throw carries the id the caller has to drop.
  return projectFromCreate(env, d, name);
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
    // ALREADY ON: FETCH THE CONFIG RATHER THAN ANSWERING null — the same
    // recovery `enableDataApi`'s already-branch grew on 2026-08-04, and the
    // asymmetry was the bug (2026-08-14 audit): a site whose first auth_info
    // save failed could NEVER recover, because every later build lands here
    // and null is the one answer the caller refuses to store. Best-effort on
    // top of best-effort — the GET's path is the one thing not measured
    // against a real project, so a 404/405 leaves info null exactly as
    // before, and a failed re-read must not turn a working retry into a
    // failed build.
    let info = null;
    try { info = await neonApi(env, `/projects/${projectId}/branches/${branchId}/auth`); }
    catch { /* the endpoint stays unknown until the next build tries again */ }
    return { enabled: true, already: true, info };
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
    // ALREADY ON: FETCH THE CONFIG RATHER THAN ANSWERING null.
    //
    // `info` carries the `url` a published site is reached through, and the
    // caller only stores it when it is present — so returning null here meant a
    // site whose first save failed could NEVER recover, because every rebuild
    // took this branch. The comment in site-provision.mjs already claimed a lost
    // endpoint "can be re-fetched by a later build"; this is what makes that
    // true. Every site built before 2026-08-04 needs it: `.conn` for
    // `.neon_conn` meant the save threw on all of them.
    //
    // Best-effort ON TOP of best-effort: already-enabled is success, and a
    // failure to re-read must not turn a working retry into a failed build.
    let info = null;
    try { info = await neonApi(env, `/projects/${projectId}/branches/${branchId}/data-api/${encodeURIComponent(dbName)}`); }
    catch { /* the endpoint stays unknown until the next build tries again */ }
    return { enabled: true, already: true, info };
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
