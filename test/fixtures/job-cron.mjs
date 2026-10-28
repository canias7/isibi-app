// DRIVE THE REAL SCHEDULED-JOB TICK (the SITE's own runner since 2026-10-27): the selector, the atomic claim, and the
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
 * Run the SITE's real tick (2026-10-27): its own runner reads its own `_jobs`,
 * selects what is due, claims each run with a conditional UPDATE and calls the
 * site's function. The store below EVALUATES that UPDATE's condition against
 * the stored row and persists only on a match — it does not know what the
 * condition is supposed to be, and a form it cannot read throws.
 *
 * `rows` are `_jobs` rows. Returns what the tick did: the store afterwards,
 * every statement, the claims, and every call of the site's own function.
 */
export async function runCron({ rows, now, fnAnswer = [], spec = null } = {}) {
  const store = rows.map((r) => ({ ...r }));
  const t = await tick({ store, now, fnAnswer, spec, runs: 1 });
  return { store, sql: t.sql, fnCalls: t.fnCalls, patches: t.claims };
}

/** The claim the site's runner really writes for this row, without its function being called. */
export async function claimUrl(row, _opts = {}, now = Date.now()) {
  const store = [{ ...row, last_run: row.last_run }];
  const t = await tick({ store, now, fnAnswer: [], runs: 1, force: true });
  return t.claims[0] || null;
}

/**
 * Two overlapping wakes of the same site, BOTH READING THE ROW BEFORE EITHER
 * CLAIMS — the race the conditional claim exists for.
 */
export async function claimTwice(row, now) {
  const store = [{ ...row }];
  const t = await tick({ store, now, fnAnswer: [], runs: 2 });
  return { won: t.won, stored: store[0] };
}

async function tick({ store, now, fnAnswer, spec = null, runs = 1, force = false }) {
  const { loadTemplate } = await import("./template-ts.mjs");
  const { runDueJobs, runOneJob } = await loadTemplate("lib/site-jobs-run.ts");
  const sql = [], fnCalls = [], claims = [], won = [];
  const declared = spec || { jobs: store.map((r) => ({ name: r.name, fn: r.spec && r.spec.fn })).filter((j) => j.fn) };
  const env = { APP_CONN: "postgresql://x_app:p@ep-1.neon.tech/x", SITE_SPEC: JSON.stringify(declared) };
  const realFetch = globalThis.fetch;
  const thaw = freeze(now);
  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === "string" ? input : input.url);
    if (!url.endsWith("/sql")) return json({});
    const { query, params = [] } = JSON.parse(init.body || "{}");
    sql.push(query);
    if (/^SELECT name, spec, schedule_minutes, enabled, last_run, last_result, updated_at FROM _jobs/.test(query)) return json({ rows: store.map((r) => ({ ...r })) });
    let m = /^UPDATE _jobs SET last_run=\$1 WHERE name=\$2 AND (last_run IS NULL|last_run=\$3) RETURNING name$/.exec(query);
    if (m) {
      claims.push({ query, params });
      const row = store.find((r) => r.name === params[1]);
      const ok = row && (m[1] === "last_run IS NULL" ? row.last_run == null : row.last_run != null && String(row.last_run) === String(params[2]));
      won.push(!!ok);
      if (ok) row.last_run = params[0];          // CONDITIONAL PERSISTENCE: only a match writes
      return json({ rows: ok ? [{ name: row.name }] : [] });
    }
    if (/^UPDATE _jobs/.test(query) && /last_run/.test(query)) throw new Error("job-cron fixture: a claim form it cannot evaluate: " + query);
    if (/^UPDATE _jobs SET last_result=\$1 WHERE name=\$2$/.test(query)) {
      const row = store.find((r) => r.name === params[1]);
      if (row) row.last_result = params[0];
      return json({ rows: [] });
    }
    if (/^SELECT "[a-z0-9_]+"\(\) AS out$/.test(query)) {
      fnCalls.push(query);
      return json({ rows: [{ out: JSON.stringify(fnAnswer) }] });
    }
    return json({ rows: [] });
  };
  try {
    if (force) await runOneJob(env, env.APP_CONN, { ...store[0] });
    else await Promise.all(Array.from({ length: runs }, () => runDueJobs(env)));
  } finally {
    globalThis.fetch = realFetch;
    thaw();
  }
  return { sql, fnCalls, claims, won };
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
