// DRIVE THE REAL SCHEDULED-JOB TICK: the selector, the atomic claim, and the
// function call — against a store that really evaluates the claim's condition.
//
// WHY A FILTER-HONOURING STORE RATHER THAN A RECORDING STUB. The thing under
// test is a CONDITIONAL WRITE: `jobDeps().stamp` PATCHes `site_functions` with
// a filter that decides whether this tick may run the job at all, and reads the
// answer's row count as "did I win". A stub that records the URL and answers
// `[row]` proves the URL was built; it cannot tell a claim that WOULD have been
// refused from one that lands, which is the entire question. So this evaluates
// the PostgREST filter against a stored row and persists only on a match —
// the fake R2 in `test/site-builds.test.mjs` honouring `onlyIf` is the
// precedent, and the reason is the same.
//
// AND IT IS THE REAL CONSTRUCTION, NOT A REPLACEMENT RULE. Nothing here knows
// what the claim's condition is SUPPOSED to be. It parses whatever
// `worker.js` sends and applies it. A guard that reimplemented the intended
// rule here would agree with itself whatever the product did — which is the
// shape of the guard that let the reported defect ship: it asserted the
// spelling of the dueness ternary and never asked whether the selector and the
// claim answered the same question.
import { loadWorkerModule } from "./worker-harness.mjs";

const SUPABASE = "https://ujrqdmmtcptvimazlhom.supabase.co";

/** Which slugs have already run a tick in this process, and what they declared. */
const SEEN = new Map();

/**
 * One PostgREST filter, applied to one row.
 *
 * Only the operators this path really sends are implemented, and an operator
 * it does not know THROWS rather than passing — a filter silently ignored is a
 * claim that reads as unconditional, which is the failure this fixture exists
 * to be able to see.
 */
function passes(row, column, spec) {
  const s = String(spec);
  // `not.is.null` — PostgREST's negation prefix. Handled explicitly rather
  // than falling to the throw below, because the cron's own read uses it and a
  // fixture that cannot parse the read never reaches the claim at all: the
  // first run of this file reported ZERO function calls for that reason and
  // not for the product's, which reads exactly like the defect under test.
  if (s.startsWith("not.")) return !passes(row, column, s.slice(4));
  const [op, ...rest] = s.split(".");
  const want = rest.join(".");
  const got = row[column];
  if (op === "is") {
    if (want === "null") return got == null;
    if (want === "true") return got === true;
    if (want === "false") return got === false;
    throw new Error("job-cron fixture: unknown is-value " + want);
  }
  // ⚠ A NULL COLUMN MATCHES NEITHER `eq` NOR `neq`, which is SQL's own
  // three-valued logic and NOT a nicety — found by a mutation sweep
  // (2026-09-19). `String(null)` is the string `"null"`, so a filter of
  // `last_run=eq.null` against a row that has never run read as a MATCH here
  // and as no match in Postgres, where `col = NULL` is NULL and the row is not
  // returned. A claim built that way would take every never-run job on the
  // platform and this fixture would have called it correct: the recorded trap
  // of a fake that is MORE permissive than the thing it stands in for, in the
  // one operator the whole compare-and-swap rests on.
  if (op === "eq") return got != null && String(got) === want;
  if (op === "neq") return got != null && String(got) !== want;
  // TIMESTAMP COMPARISONS ARE MADE ON THE INSTANT, not on the string, because
  // Postgres compares `timestamptz` values and PostgREST hands it a literal.
  // `"2026-09-16T22:00:00.000Z"` and `"2026-09-16T22:00:00+00:00"` are the same
  // moment and different strings, and a string comparison here would report a
  // correct claim as refused for a reason the database does not have.
  if (op === "lt" || op === "lte" || op === "gt" || op === "gte") {
    if (got == null) return false;                    // NULL compares false, as in SQL
    const a = Date.parse(String(got)), b = Date.parse(want);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return op === "lt" ? a < b : op === "lte" ? a <= b : op === "gt" ? a > b : a >= b;
  }
  throw new Error("job-cron fixture: unknown operator " + op + " (filter " + column + "=" + spec + ")");
}

/** `or=(a.is.null,a.lt.X)` — split at the top level only. */
function splitTop(s) {
  const out = [];
  let depth = 0, at = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { out.push(s.slice(at, i)); at = i + 1; }
  }
  out.push(s.slice(at));
  return out.filter((x) => x.length);
}

/** One `or=(…)` / `and=(…)` member: `column.op.value`. */
function member(row, m) {
  const i = m.indexOf(".");
  if (i < 0) throw new Error("job-cron fixture: unreadable filter member " + m);
  return passes(row, m.slice(0, i), m.slice(i + 1));
}

/**
 * Does this row satisfy every filter in the query string?
 *
 * `select`, `order` and `limit` are not filters and are skipped by name — a
 * blanket "ignore what I do not recognise" is how a real condition gets dropped.
 */
export function rowMatches(row, params) {
  for (const [k, v] of params) {
    if (k === "select" || k === "order" || k === "limit" || k === "offset") continue;
    if (k === "or") { if (!splitTop(v.replace(/^\(|\)$/g, "")).some((m) => member(row, m))) return false; continue; }
    if (k === "and") { if (!splitTop(v.replace(/^\(|\)$/g, "")).every((m) => member(row, m))) return false; continue; }
    if (!passes(row, k, v)) return false;
  }
  return true;
}

/**
 * Run the real cron tick.
 *
 * `rows` are `site_functions` rows as PostgREST would hand them back. `now` is
 * the instant the tick runs at — faked, because the selector and the claim both
 * read `Date.now()` and a schedule whose disagreement only shows at a clock
 * edge is exactly the bug that never gets caught otherwise.
 *
 * Returns what the tick DID: every request it made, the store as it stands
 * afterwards, and every SQL statement that reached the site's database — which
 * is what "runJob skipped with zero function calls" is read from.
 */
export async function runCron({ rows, now, fnAnswer = [], spec = null, connection = null } = {}) {
  const mod = await loadWorkerModule();
  const store = rows.map((r) => ({ ...r }));
  // ⚠ ONE SLUG PER TICK, REFUSED RATHER THAN TOLERATED. `worker.js` memoizes
  // the slug→connection lookup at MODULE scope and caches the site's schema per
  // connection, so a second tick on the same slug reads the FIRST tick's
  // declared jobs: `callFn` answers "this job is no longer part of the site"
  // and the run reports ZERO function calls. MEASURED — two `runCron` calls on
  // one slug, the second `fnCalls: 0` with the product entirely correct — and
  // zero function calls is exactly what the defect under test looks like, so a
  // fixture that let this through would report a working claim as broken.
  // Deriving the connection from the slug does NOT fix it (the connection read
  // never happens on the second call), so the constraint is stated instead.
  // A SECOND TICK ON THE SAME SLUG IS FINE WHEN IT DECLARES THE SAME JOBS —
  // which is the duplicate-protection case, where re-ticking one site is the
  // whole point and the warm cache is telling the truth. What is refused is a
  // slug reused for a DIFFERENT set of jobs, where the cache is a lie.
  for (const s of new Set(store.map((r) => r.slug))) {
    const names = store.filter((r) => r.slug === s).map((r) => r.name).sort().join(",");
    const had = SEEN.get(s);
    if (had != null && had !== names) throw new Error("job-cron fixture: slug '" + s + "' already ran a tick declaring [" +
      had + "] and this one declares [" + names + "]. The Worker caches the connection per slug and the schema per " +
      "connection, so this tick would read the previous case's jobs and report zero function calls. Give it its own slug.");
    SEEN.set(s, names);
  }
  const conn = connection || "postgres://u:p@h/" + String((store[0] && store[0].slug) || "db");
  const requests = [];
  const sql = [];
  const fnCalls = [];
  // THE SITE'S OWN SCHEMA, because `callFn` re-reads it and refuses a job the
  // site no longer declares — the right behaviour, and the reason a first
  // attempt at this fixture reported zero function calls for a reason that was
  // not the claim's. It declares the rows' own jobs unless a case says otherwise.
  const schema = spec || {
    jobs: store.map((r) => ({ name: r.name, fn: r.spec && r.spec.fn })).filter((j) => j.fn),
    functions: store.map((r) => ({ name: r.spec && r.spec.fn, internal: true })).filter((f) => f.name),
  };

  const realFetch = globalThis.fetch;
  const thaw = freeze(now);
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const method = (init.method || "GET").toUpperCase();
    requests.push({ method, url: url.href });

    if (url.origin === SUPABASE && url.pathname === "/rest/v1/site_functions") {
      const params = [...url.searchParams.entries()];
      if (method === "GET") return json(store.filter((r) => rowMatches(r, params)));
      if (method === "PATCH") {
        const body = JSON.parse(init.body || "{}");
        const hit = store.filter((r) => rowMatches(r, params));
        for (const r of hit) Object.assign(r, body);       // CONDITIONAL PERSISTENCE: only a match writes
        return json(hit.map((r) => ({ ...r })));
      }
    }
    // THE CONNECTION TAKES TWO READS, and both are answered because the job's
    // `callFn` resolves the site's database through `siteBackendBySlug` — one
    // row short and the connection is null, which `callFn` reports as "the
    // site's database is unreachable" and which looks exactly like a claim that
    // was refused.
    if (url.origin === SUPABASE && url.pathname === "/rest/v1/site_backends") {
      // `neon_db` VARIES WITH THE SLUG TOO: the Worker builds the final
      // connection as `connForDatabase(neon_conn, neon_db)`, so a fixed
      // database name would collapse every site back onto one connection —
      // and the schema cache is keyed on the connection, not the slug.
      const want = (url.searchParams.get("slug") || "").replace(/^eq\./, "");
      return json([{ neon_db: "site_" + want.replace(/[^a-z0-9]+/g, "_"), uid: "u1", brief: "" }]);
    }
    if (url.origin === SUPABASE && url.pathname === "/rest/v1/site_project") {
      return json([{ uid: "u1", neon_project: "p", neon_branch: "b", neon_role: "r", neon_conn: conn }]);
    }
    if (url.origin === SUPABASE) return json([]);
    // The Neon serverless driver is fetch over HTTP, so the site's own SQL
    // arrives here too — which is what makes "zero function calls" observable.
    const text = typeof init.body === "string" ? init.body : "";
    let q = null;
    try { q = JSON.parse(text); } catch { /* not a Neon call */ }
    if (q && typeof q.query === "string") {
      sql.push(q.query);
      // Neon's driver hands rows back as ARRAYS with a `fields` list — its own
      // wire shape, and an object row makes it throw `c.map`.
      if (/_meta/.test(q.query)) {
        return json({ command: "SELECT", rowCount: 1, fields: [{ name: "v", dataTypeID: 25 }], rows: [[JSON.stringify(schema)]] });
      }
      fnCalls.push(q.query);
      return json({ command: "SELECT", rowCount: 1, fields: [{ name: "out", dataTypeID: 114 }], rows: [[JSON.stringify(fnAnswer)]] });
    }
    return json({});
  };

  try {
    await mod.runScheduledSiteJobs({ SUPABASE_SERVICE_KEY: "svc" }, { waitUntil() {} });
  } finally {
    globalThis.fetch = realFetch;
    thaw();
  }
  // `fnCalls` IS SEPARATE FROM `sql` AND THAT IS THE POINT. "runJob skipped
  // with zero function calls" is a claim about the site's own function, and
  // `callFn` issues a schema read BEFORE it — so counting statements would make
  // a job that was claimed and then correctly refused (the site no longer
  // declares it) look identical to one the claim never let start.
  return { requests, store, sql, fnCalls, patches: requests.filter((r) => r.method === "PATCH") };
}

/** The claim URL `jobDeps().stamp` really builds, without running a tick. */
export async function claimUrl(row, opts = {}, now = Date.now()) {
  const mod = await loadWorkerModule();
  let seen = null;
  const realFetch = globalThis.fetch;
  const thaw = freeze(now);
  globalThis.fetch = async (input, init = {}) => {
    seen = { url: new URL(typeof input === "string" ? input : input.url), body: JSON.parse(init.body || "{}") };
    return json([]);
  };
  try {
    await mod.jobDeps({ SUPABASE_SERVICE_KEY: "svc" }, row, opts).stamp(row);
  } finally {
    globalThis.fetch = realFetch;
    thaw();
  }
  return seen;
}

/**
 * Two overlapping runners claiming ONE row, which is the shape the claim
 * exists for: Cloudflare's cron ticks overlap when a tick outlasts its
 * two-minute interval, so two of them can read the same job as due.
 *
 * BOTH READ THE ROW FIRST AND THEN BOTH PATCH, in that order, because that is
 * what makes it a race — a fixture that re-read between the two would be
 * testing a sequence nobody runs.
 */
export async function claimTwice(row, now) {
  const mod = await loadWorkerModule();
  const stored = { ...row };
  const realFetch = globalThis.fetch;
  const thaw = freeze(now);
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const params = [...url.searchParams.entries()];
    const hit = rowMatches(stored, params) ? [stored] : [];
    for (const r of hit) Object.assign(r, JSON.parse(init.body || "{}"));
    return json(hit.map((r) => ({ ...r })));
  };
  try {
    const a = mod.jobDeps({ SUPABASE_SERVICE_KEY: "svc" }, row).stamp(row);
    const b = mod.jobDeps({ SUPABASE_SERVICE_KEY: "svc" }, row).stamp(row);
    return { won: (await Promise.all([a, b])).map((x) => x.won), stored };
  } finally {
    globalThis.fetch = realFetch;
    thaw();
  }
}

function json(v) {
  return new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
}

/**
 * Freeze the clock at `now` and hand back the restore.
 *
 * BOTH DOORS, because the two halves under test use different ones: the
 * selector and the claim's cutoff read `Date.now()`, and the stamp WRITES
 * `new Date().toISOString()` — which does not go through `Date.now` at all. A
 * fixture that faked only the first left the stamp landing at the real wall
 * clock, so "what did this tick write" could not be asserted exactly, in the
 * one field the whole claim turns on.
 */
function freeze(now) {
  const RealDate = globalThis.Date;
  const t = Number(now);
  class Frozen extends RealDate {
    constructor(...a) { super(...(a.length ? a : [t])); }
    static now() { return t; }
  }
  globalThis.Date = Frozen;
  return () => { globalThis.Date = RealDate; };
}
