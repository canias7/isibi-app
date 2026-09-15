// RUN THE REPAIR SCRIPTS AS REAL PROCESSES, AND READ THEIR EXIT CODES.
//
// Owner, 2026-09-15: *"Both verification commands can exit successfully on
// failure… Make verification an explicit mode that always checks its
// postconditions and exits nonzero when they fail. Test both commands as
// processes, including exit codes."*
//
// An exit code is not observable from inside the module. `main()` is not
// exported, `process.exitCode` is set on the way out, and a guard that imports
// the script and calls a helper is asserting about a different thing entirely —
// which is exactly how `--verify` came to print "0 verified, 1 not verified"
// and exit 0.
//
// SO THIS IS A PRELOAD, not a mock. `node --import <this> scripts/<x>.mjs
// --verify` installs one `fetch` before the script's own module graph loads,
// and that single seam covers BOTH halves: Supabase is plain `fetch`, and Neon
// is `@neondatabase/serverless`, which is `fetch` over HTTP. Nothing in either
// script is replaced, stubbed or re-implemented — the real `main()` runs, the
// real argument parsing runs, and the process exits however it really exits.
//
// The scenario is a JSON file named by `REPAIR_SCENARIO`, so one preload serves
// every case and a case is data rather than another fixture.
import fs from "node:fs";

const scenario = JSON.parse(fs.readFileSync(process.env.REPAIR_SCENARIO, "utf8"));
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Neon's own wire shape: rows are ARRAYS and `fields` names the columns. Its
 * driver does `c.map` over `fields`, so an object row makes it throw — the
 * recorded "a fixture in a different shape from reality", already paid for once
 * in the addon fixture.
 */
const rows = (list, cols) => json({
  command: "SELECT",
  rowCount: list.length,
  rows: list.map((r) => cols.map((c) => (r[c] === undefined ? null : r[c]))),
  fields: cols.map((c) => ({ name: c, dataTypeID: 25 })),
});
const pgError = (message) => json({ message }, 400);
const done = (command) => json({ command, rowCount: 1, rows: [], fields: [] });

// Every statement the scripts send, so a case can assert what was written and a
// `--verify` can be proved to have CONNECTED rather than merely parsed a flag.
const sent = [];
process.on("exit", () => {
  try { fs.writeFileSync(process.env.REPAIR_SENT || "/dev/null", JSON.stringify(sent, null, 1)); } catch { /* best effort */ }
  // ── THE SCENARIO IS WRITTEN BACK ────────────────────────────────────────
  //
  // `apply -> verify -> repeat` is three PROCESSES, and a fixture that reset
  // between them would prove nothing about the sequence: the verify would be
  // verifying the state the apply started from, and the repeat would be a first
  // run wearing a second run's name. What one process wrote is what the next
  // one reads, which is the whole claim.
  try {
    fs.writeFileSync(process.env.REPAIR_SCENARIO, JSON.stringify({
      ...scenario, sites: scenario.sites, meta: state.meta, metaTable: state.metaTable,
      tables: state.tables, fnDef: state.fnDef, counts: state.counts,
    }, null, 1));
  } catch { /* best effort */ }
});

/** The site's database, as this scenario holds it. Mutated by an apply. */
const state = {
  meta: scenario.meta === undefined ? null : scenario.meta,   // null = no schema row
  metaTable: scenario.metaTable !== false,                    // false = `_meta` does not exist
  tables: scenario.tables || {},                              // name -> { columns, grants, policies }
  fnDef: scenario.fnDef || "",
  counts: scenario.counts || {},
};

const catalogColumns = () => Object.entries(state.tables)
  .flatMap(([t, d]) => (d.columns || []).map((c) => ({ t, c, ty: "text" })));
const catalogGrants = () => Object.entries(state.tables).flatMap(([t, d]) => (d.grants || []).map((g) => ({ ...g, t })));
const catalogPolicies = () => Object.entries(state.tables).flatMap(([t, d]) => (d.policies || []).map((p) => ({ ...p, t })));

globalThis.fetch = async (input, init) => {
  const url = String((input && input.url) || input || "");

  // ── SUPABASE ────────────────────────────────────────────────────────────
  if (url.includes("/rest/v1/site_backends")) {
    if ((init && init.method) === "PATCH") {
      sent.push({ supabase: "PATCH site_backends", url });
      if (scenario.refWriteFails) return json({ message: "no" }, 500);
      for (const s of scenario.sites) if (url.includes("slug=eq." + s.slug) && !String(s.neon_db || "").trim()) s.neon_db = JSON.parse(String(init.body)).neon_db;
      return json([{ ok: true }]);
    }
    return json(scenario.sites.map((s) => ({ slug: s.slug, uid: s.uid, neon_db: s.neon_db })));
  }
  if (url.includes("/rest/v1/site_project")) {
    return json(scenario.projects.map((p) => ({ slug: p.slug, neon_conn: p.neon_conn })));
  }

  // ── THE SITE'S OWN PUBLIC RPC ROUTE ─────────────────────────────────────
  //
  // The call `/status` really makes. Answered from the SAME function body the
  // SQL side holds, so "the three numbers agree" cannot be satisfied by a stub
  // that answers each reader separately.
  const rpc = /\/api\/db\/([^/]+)\/data\/rpc\/(\w+)/.exec(url);
  if (rpc) {
    sent.push({ route: rpc[2], slug: rpc[1] });
    const from = state.countsFrom || (/FROM\s+(\w+)/i.exec(state.fnDef) || [])[1] || "";
    return json(state.counts[from] === undefined ? 0 : state.counts[from]);
  }

  // ── NEON, over HTTP ─────────────────────────────────────────────────────
  let q = "";
  try { q = JSON.parse(String((init && init.body) || "{}")).query || ""; } catch { /* not ours */ }
  if (!q) return json({}, 404);
  // WHICH DATABASE THIS STATEMENT REALLY WENT TO. The first defect in this
  // round is that identity was asked about one connection while the queries
  // went to another, so the database a statement was sent to is recorded and
  // asserted, never assumed.
  let db = "";
  try { db = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, "")) || ""; } catch { /* */ }
  const at = String((init && init.headers && (init.headers["Neon-Connection-String"] || init.headers["neon-connection-string"])) || "");
  if (at) { try { db = decodeURIComponent(new URL(at).pathname.replace(/^\/+/, "")); } catch { /* */ } }
  sent.push({ db, q: q.replace(/\s+/g, " ").slice(0, 160) });

  if (/current_database/i.test(q)) return rows([{ db: scenario.serverDb === undefined ? db : scenario.serverDb }], ["db"]);
  if (/^\s*SELECT 1\s*$/i.test(q)) return rows([{ "?column?": 1 }], ["?column?"]);
  if (/information_schema\.columns/i.test(q)) return rows(catalogColumns(), ["t", "c", "ty"]);
  if (/role_table_grants/i.test(q)) return rows(catalogGrants(), ["t", "g", "p", "lvl", "col"]);
  if (/pg_policies/i.test(q)) return rows(catalogPolicies(), ["t", "c", "q", "w"]);
  if (/pg_trigger/i.test(q)) return rows([], ["t", "g"]);
  if (/CREATE TABLE IF NOT EXISTS _meta/i.test(q)) {
    if (scenario.metaCreateFails) return pgError("permission denied for schema public");
    state.metaTable = true;
    return done("CREATE");
  }
  if (/INSERT INTO _meta/i.test(q)) {
    if (!state.metaTable) return pgError('relation "_meta" does not exist');
    let body = null;
    try { body = JSON.parse(String((init && init.body) || "{}")).params[0]; } catch { /* */ }
    state.meta = body;
    return done("INSERT");
  }
  if (/FROM _meta/i.test(q)) {
    if (!state.metaTable) return pgError('relation "_meta" does not exist');
    return state.meta ? rows([{ v: state.meta }], ["v"]) : rows([], ["v"]);
  }
  if (/pg_get_functiondef/i.test(q)) return rows(state.fnDef ? [{ def: state.fnDef }] : [], ["def"]);
  if (/CREATE OR REPLACE FUNCTION/i.test(q)) {
    state.fnDef = q;
    // The rewritten body decides what the function now counts.
    const m = /FROM\s+(\w+)/i.exec(q);
    if (m) state.countsFrom = m[1];
    return done("CREATE");
  }
  const cnt = /SELECT COUNT\(\*\)::int AS n FROM "(\w+)"/i.exec(q);
  if (cnt) return rows([{ n: state.counts[cnt[1]] === undefined ? 0 : state.counts[cnt[1]] }], ["n"]);
  const call = /SELECT (\w+)\(\) AS n/i.exec(q);
  if (call) {
    const from = state.countsFrom || (/FROM\s+(\w+)/i.exec(state.fnDef) || [])[1] || "";
    return rows([{ n: state.counts[from] === undefined ? 0 : state.counts[from] }], ["n"]);
  }
  return done("SELECT");
};
