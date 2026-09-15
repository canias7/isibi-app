#!/usr/bin/env node
/**
 * THE MIGRATION, AGAINST A REAL POSTGRESQL. `npm run test:pg`.
 *
 * Every guarantee the schema claims is checked here by trying to break it, on a
 * real engine, in a throwaway database. The unit suite cannot do any of this: row
 * level security, partial unique indexes, generated columns, triggers and the
 * difference between JSON null and SQL NULL are all properties of Postgres, and a
 * fake would only ever tell us what we already believe.
 *
 * NOTHING HERE TYPES THE DDL. The schema comes out of the migration FILE, so what
 * is proved is what would be applied. A hand-copied `create table` in a test is a
 * second version of the schema, and the version that drifts is always the one
 * nobody is looking at.
 *
 * EVERY REFUSAL IS READ FOR ITS REASON. A refusal from the wrong gate looks
 * exactly like the wall working — "permission denied" when the point was a unique
 * index proves nothing about the index — so each case names the error it expects.
 * And each group has a CONTROL: a legitimate operation that must SUCCEED, without
 * which a database that refused everything would pass the whole file.
 *
 * It needs a running local cluster and does not touch Supabase. If it cannot find
 * one it says so and exits 0, because "no database here" is not a failing schema.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..", "..");
const MIGRATIONS = path.join(DIR, "supabase", "migrations");
const DB = `agent_schema_check_${process.pid}`;

const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function psql(sql, { db = DB, role = null, claims = null, expectFail = false } = {}) {
  // Roles and claims are set in the same session as the statement, which is the
  // only way a policy keyed on a request claim can be exercised at all.
  // `SET`, NOT `select set_config(...)`. The function form RETURNS A ROW, and with
  // `-t -A` that row lands in front of the real answer — which is how a count of 0
  // came back as the claims followed by 0 and every comparison failed. A harness
  // that contaminates its own output reports the product as broken.
  const prelude = [
    role ? `set role ${role};` : "",
    claims === null ? "" : `set "request.jwt.claims" = ${shq(claims)};`,
  ].filter(Boolean).join(" ");
  const full = `${prelude} ${sql}`;
  try {
    const out = execFileSync("su", ["postgres", "-c",
      `psql -X -q -t -A -v ON_ERROR_STOP=1 -d ${db} -c ${shq(full)}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (expectFail) return { ok: true, out: out.trim(), err: "" };
    return { ok: true, out: out.trim(), err: "" };
  } catch (e) {
    return { ok: false, out: "", err: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() };
  }
}

/**
 * SEVERAL STATEMENTS, ONE SESSION, SEPARATE TRANSACTIONS.
 *
 * Every other check here is its own `psql` PROCESS, so anything that persists at
 * SESSION scope rather than transaction scope is invisible to them — and that is
 * not hypothetical: a SQL mutation sweep widened the delete marker from
 * transaction-local to session-local and this file could not tell. Multiple `-c`
 * flags share one connection and each runs in its own transaction, which is the
 * only shape that separates the two.
 */
function psqlSession(statements, { db = DB, role = null, claims = null } = {}) {
  const parts = [];
  if (role) parts.push(`set role ${role};`);
  if (claims !== null) parts.push(`set "request.jwt.claims" = ${shq(claims)};`);
  parts.push(...statements);
  const cs = parts.map((x) => `-c ${shq(x)}`).join(" ");
  try {
    execFileSync("su", ["postgres", "-c", `psql -X -q -t -A -v ON_ERROR_STOP=1 -d ${db} ${cs}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, err: "" };
  } catch (e) {
    return { ok: false, err: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() };
  }
}

/** Apply a whole file. `-f`, not `-c`: psql's `\\i` is a meta-command and `-c` takes only SQL. */
function psqlFile(file, { db = DB } = {}) {
  try {
    execFileSync("su", ["postgres", "-c", `psql -X -q -v ON_ERROR_STOP=1 -d ${db} -f ${file}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, err: "" };
  } catch (e) {
    return { ok: false, err: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() };
  }
}

// ── the harness ──────────────────────────────────────────────────────────────
let pass = 0; const failures = [];
const check = (what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok    ${what}`); }
  else { failures.push(`${what}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ""}`); }
};
/** A statement that must be refused, BY THE NAMED GATE and not by another one. */
const refused = (what, sql, gate, opts = {}) => {
  const r = psql(sql, { ...opts, expectFail: true });
  if (r.ok) return check(what, false, "it was ALLOWED");
  check(what, r.err.includes(gate), `refused by the wrong gate: ${r.err.split("\n")[0]}`);
};
/** The control for every group of refusals. */
const allowed = (what, sql, opts = {}) => {
  const r = psql(sql, opts);
  check(what, r.ok, r.err.split("\n")[0]);
};

// ── is there a cluster? ──────────────────────────────────────────────────────
try {
  execFileSync("su", ["postgres", "-c", "psql -X -tAc 'select 1'"], { stdio: ["ignore", "pipe", "pipe"] });
} catch {
  console.log("No local PostgreSQL that `su postgres` can reach — skipping the schema check.");
  console.log("  start one with:  pg_ctlcluster 16 main start");
  console.log("This is the environment, not the schema. Exiting 0.");
  process.exit(0);
}

const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
if (!files.length) { console.error(`no migrations in ${MIGRATIONS}`); process.exit(1); }
console.log(`applying ${files.length} migration(s) to a throwaway database ${DB}\n`);

try {
  execFileSync("su", ["postgres", "-c",
    `psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)} -c ${shq(`create database ${DB};`)}`],
    { stdio: ["ignore", "pipe", "pipe"] });

  // Supabase's roles are part of the platform, not of this migration, so the
  // check creates them the way the platform would before applying anything.
  // DERIVED FROM THE PLATFORM, NOT INVENTED. On Supabase `service_role` carries
  // BYPASSRLS, and the first version of this check created it without — so the
  // writer was refused by the very policies it is supposed to be exempt from, and
  // forty checks failed for a reason that does not exist in production. A fixture
  // in a different shape from reality is worse than no fixture, because it
  // produces a specific wrong answer.
  //
  // IT ALSO NAMES A REAL LIMIT OF THIS DESIGN, stated rather than glossed: because
  // the writer bypasses row level security, the policies protect the READ path.
  // Nothing in the database stops a writer that passes the wrong tenant_id; that
  // is the application's job, and `createRun` is the only place it is decided.
  //
  // THE ATTRIBUTES ARE FORCED, NOT JUST CREATED. Roles are CLUSTER-WIDE rather
  // than per-database, so a role left behind by an earlier run already exists —
  // and a `create if not exists` then skips it and keeps whatever attributes it
  // had. That is how this check spent a round reporting the writer as blocked by
  // its own policies: a `service_role` from an earlier session had no BYPASSRLS
  // and the create was a no-op. An idempotent create is not an idempotent
  // DEFINITION.
  psql(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  end $$;
  alter role authenticated nologin nobypassrls;
  alter role service_role  nologin bypassrls;
  alter role anon          nologin nobypassrls;`);

  for (const f of files) {
    const src = path.join(MIGRATIONS, f);
    // Copied where `postgres` can read it: this repo's checkout is not readable by
    // that user, and a permission error here would read as a broken migration.
    const tmp = path.join("/tmp", `agent-mig-${process.pid}-${f}`);
    fs.copyFileSync(src, tmp); fs.chmodSync(tmp, 0o644);
    const r = psqlFile(tmp);
    check(`the migration applies: ${f}`, r.ok, r.err.split("\n").slice(0, 2).join(" "));
    fs.rmSync(tmp, { force: true });
    if (!r.ok) throw new Error("the migration did not apply; nothing below would mean anything");
  }

  const T1 = "11111111-1111-1111-1111-111111111111";
  const T2 = "22222222-2222-2222-2222-222222222222";
  // A third run, deleted late, purely so the marker check has a real run delete to
  // sit in the same session as.
  const T3 = "33333333-3333-3333-3333-333333333333";
  const asWriter = { role: "service_role" };
  const claimT1 = { role: "authenticated", claims: '{"tenant_id":"t1"}' };
  const claimT2 = { role: "authenticated", claims: '{"tenant_id":"t2"}' };

  console.log("\n── the log is the only writer, and the engine derives the rest ──");
  allowed("a run is created with an id and a tenant and nothing else",
    `insert into agent.runs (id, tenant_id) values ('${T1}','t1'), ('${T2}','t2');`, asWriter);
  check("a run with no entries yet is 'new'",
    psql(`select status from agent.runs where id='${T1}';`, asWriter).out === "new");

  const STARTED = `{"kind":"started","at":0,"tenant":"t1","agent":"support","model":"claude-sonnet-5","limits":{"steps":8,"wallMs":"Infinity","tokens":1000}}`;
  allowed("a started entry is appended",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 0, '${STARTED}');`, asWriter);
  check("...and the engine moved the run to 'running'",
    psql(`select status from agent.runs where id='${T1}';`, asWriter).out === "running");
  check("...and derived the agent name and model from the log, not from the caller",
    psql(`select agent_name || '/' || model from agent.runs where id='${T1}';`, asWriter).out === "support/claude-sonnet-5");

  console.log("\n── the positional columns are GENERATED from the body ──");
  const MODEL1 = `{"kind":"model","at":1,"step":1,"ms":1200,"text":"checking","usage":null,"costMicros":null,"toolCalls":[{"id":"c0","name":"look","args":{"q":"x"}},{"id":"c1","name":"charge","args":{}}]}`;
  allowed("a model entry is appended",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 1, '${MODEL1}');`, asWriter);
  check("kind, step and index are read out of the body",
    psql(`select kind || ':' || step || ':' || coalesce(idx::text,'-') from agent.run_entries where run_id='${T1}' and seq=1;`, asWriter).out === "model:1:-");
  allowed("a tool result is appended",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 2, '{"kind":"tool","at":2,"step":1,"index":0,"name":"look","ms":40,"ok":true,"value":{"hit":1}}');`, asWriter);
  check("a tool entry's slot is read out of the body",
    psql(`select step || ',' || idx from agent.run_entries where run_id='${T1}' and seq=2;`, asWriter).out === "1,0");

  console.log("\n── UNKNOWN USAGE IS NOT ZERO, AND NOT MISSING ──");
  const usage = psql(`select jsonb_typeof(body->'usage') || '|' || (body ? 'usage')::text || '|' || (body->'usage' = 'null'::jsonb)::text || '|' || (body->'usage' = '0'::jsonb)::text from agent.run_entries where run_id='${T1}' and seq=1;`, asWriter).out;
  check("an unreported usage is stored as JSON null", usage.startsWith("null|"), usage);
  // `::text` of a boolean is 'true'/'false'. psql's own -t -A shorthand is t/f, and
  // comparing against the shorthand read three correct answers as failures.
  check("...the key is still THERE (absent would be a third meaning)", usage.split("|")[1] === "true", usage);
  check("...it equals JSON null", usage.split("|")[2] === "true", usage);
  check("...and it is NOT zero", usage.split("|")[3] === "false", usage);

  console.log("\n── AN UNLIMITED LIMIT SURVIVES STORAGE ──");
  const lim = psql(`select (limits->>'wallMs') || '|' || jsonb_typeof(limits->'wallMs') || '|' || (limits->>'tokens') from agent.runs where id='${T1}';`, asWriter).out;
  check("an unbounded limit is kept as the string Infinity", lim === "Infinity|string|1000", lim);

  console.log("\n── NO DUPLICATE ENTRIES: each of the five ways ──");
  refused("a second started entry", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 20, '{"kind":"started","at":9}');`, "entries_one_started", asWriter);
  refused("a second model answer for one step", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 21, '{"kind":"model","at":9,"step":1,"ms":1}');`, "entries_one_model_per_step", asWriter);
  refused("a second result for one tool slot", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 22, '{"kind":"tool","at":9,"step":1,"index":0,"ok":true}');`, "entries_one_tool_per_slot", asWriter);
  refused("the same position twice", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 1, '{"kind":"model","at":9,"step":99,"ms":1}');`, "run_entries_pkey", asWriter);
  allowed("CONTROL: a DIFFERENT step and a different slot are both fine",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 3, '{"kind":"tool","at":3,"step":1,"index":1,"name":"charge","ms":9,"ok":false,"error":"declined"}'), ('${T1}', 4, '{"kind":"model","at":4,"step":2,"ms":900,"text":"done","toolCalls":[],"usage":{"inputTokens":5,"outputTokens":2},"costMicros":11}');`, asWriter);

  console.log("\n── A MALFORMED ENTRY CANNOT BE STORED AT ALL ──");
  refused("a model entry with no step", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 30, '{"kind":"model","at":9,"ms":1}');`, "entry_position_matches_kind", asWriter);
  refused("a tool entry with no index", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 31, '{"kind":"tool","at":9,"step":2,"ok":true}');`, "entry_position_matches_kind", asWriter);
  refused("a started entry carrying a step", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 32, '{"kind":"started","at":9,"step":1}');`, "entry_position_matches_kind", asWriter);
  refused("an entry of an unknown kind", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 33, '{"kind":"nope","at":9}');`, "entry_kind_known", asWriter);
  refused("an entry for a run that does not exist", `insert into agent.run_entries (run_id, seq, body) values ('99999999-9999-9999-9999-999999999999', 0, '{"kind":"started","at":0}');`, "run_entries_run_id_fkey", asWriter);

  console.log("\n── APPEND-ONLY: history cannot be rewritten ──");
  // AS THE OWNER, WITH NO ROLE SET. Run as the writer this was refused by a
  // MISSING GRANT — the right outcome for the wrong reason, and it proved nothing
  // about the trigger. The owner has every privilege and bypasses the policies, so
  // only the trigger can be what stops it.
  refused("an entry cannot be edited, even by a caller with every privilege",
    `update agent.run_entries set body = '{"kind":"model","at":1,"step":1,"text":"tampered"}' where run_id='${T1}' and seq=1;`,
    "append-only", {});
  refused("...and a client is stopped one step earlier, by having no such grant",
    `update agent.run_entries set body = '{}' where run_id='${T1}' and seq=1;`,
    "permission denied", claimT1);
  check("the model's own answer is still the one it gave",
    psql(`select body->>'text' from agent.run_entries where run_id='${T1}' and seq=1;`, asWriter).out === "checking");
  check("a tool's own result is still the one it returned",
    psql(`select body->'value'->>'hit' from agent.run_entries where run_id='${T1}' and seq=2;`, asWriter).out === "1");
  check("a failed tool kept its own error text",
    psql(`select body->>'error' from agent.run_entries where run_id='${T1}' and seq=3;`, asWriter).out === "declined");

  console.log("\n── the stop reason is preserved verbatim ──");
  allowed("a stopped entry is appended",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 5, '{"kind":"stopped","at":5,"stop":{"reason":"bound","bound":"steps","limit":8,"used":8}}');`, asWriter);
  const stop = psql(`select status || '|' || (stop->>'reason') || '|' || (stop->>'bound') || '|' || (stop->>'limit') from agent.runs where id='${T1}';`, asWriter).out;
  check("the run is stopped and the reason names the bound that ended it", stop === "stopped|bound|steps|8", stop);
  refused("a second stopped entry", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 40, '{"kind":"stopped","at":9,"stop":{}}');`, "entries_one_stopped", asWriter);

  console.log("\n── TENANT ISOLATION ──");
  allowed("t2 gets a log of its own",
    `insert into agent.run_entries (run_id, seq, body) values ('${T2}', 0, '{"kind":"started","at":0,"agent":"other","model":"m"}');`, asWriter);
  check("a tenant sees exactly its own runs",
    psql(`select count(*) from agent.runs;`, claimT1).out === "1" && psql(`select tenant_id from agent.runs;`, claimT1).out === "t1");
  check("a tenant sees exactly its own entries",
    psql(`select count(*) from agent.run_entries;`, claimT1).out === "6", psql(`select count(*) from agent.run_entries;`, claimT1).out);
  check("the other tenant sees only its own, and only one entry",
    psql(`select count(*) from agent.run_entries;`, claimT2).out === "1");
  check("a tenant cannot read another tenant's run BY ID",
    psql(`select count(*) from agent.runs where id='${T2}';`, claimT1).out === "0");
  check("a tenant cannot read another tenant's entries BY RUN ID",
    psql(`select count(*) from agent.run_entries where run_id='${T2}';`, claimT1).out === "0");

  console.log("\n── AND IT FAILS CLOSED ──");
  check("no claims at all sees nothing",
    psql(`select count(*) from agent.runs;`, { role: "authenticated", claims: "" }).out === "0");
  check("claims that are not JSON see nothing, and do not error the query",
    psql(`select count(*) from agent.runs;`, { role: "authenticated", claims: "not json at all" }).out === "0");
  check("claims with no tenant see nothing",
    psql(`select count(*) from agent.runs;`, { role: "authenticated", claims: '{"sub":"user-1"}' }).out === "0");
  check("a tenant that matches nothing sees nothing",
    psql(`select count(*) from agent.runs;`, { role: "authenticated", claims: '{"tenant_id":"nobody"}' }).out === "0");
  check("CONTROL: the same session with real claims DOES see its run",
    psql(`select count(*) from agent.runs;`, claimT1).out === "1");

  console.log("\n── a client reads and writes nothing ──");
  refused("a client cannot create a run", `insert into agent.runs (id, tenant_id) values ('33333333-3333-3333-3333-333333333333','t1');`, "permission denied", claimT1);
  refused("a client cannot append an entry", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 60, '{"kind":"model","step":60}');`, "permission denied", claimT1);
  refused("a client cannot change a run", `update agent.runs set status='new' where tenant_id='t1';`, "permission denied", claimT1);
  refused("a client cannot delete a run", `delete from agent.runs where tenant_id='t1';`, "permission denied", claimT1);
  refused("an anonymous caller cannot even read", `select count(*) from agent.runs;`, "permission denied", { role: "anon", claims: '{"tenant_id":"t1"}' });

  console.log("\n── A SINGLE ENTRY CANNOT BE DELETED WHILE ITS RUN REMAINS ──");
  // Losing one entry corrupts the log in the one way a reader cannot SEE: a model
  // entry whose tool result is gone replays as a call still PENDING, and `problems`
  // is empty, because a deleted entry is indistinguishable from one never written.
  // Measured before the fix — a completed `charge` came back pending.
  refused("a client cannot delete an entry (no such grant)",
    `delete from agent.run_entries where run_id='${T1}' and seq=2;`, "permission denied", claimT1);
  refused("nor can the writer",
    `delete from agent.run_entries where run_id='${T1}' and seq=2;`, "permission denied", asWriter);
  refused("NOR CAN A CALLER WITH EVERY PRIVILEGE — the trigger, not the grant",
    `delete from agent.run_entries where run_id='${T1}' and seq=2;`, "cannot be deleted on its own", {});
  check("the tool result is still there", psql(`select count(*) from agent.run_entries where run_id='${T1}' and seq=2;`, asWriter).out === "1");
  refused("...and it cannot be done inside a transaction that touches nothing else",
    `begin; delete from agent.run_entries where run_id='${T1}' and seq=2; commit;`, "cannot be deleted on its own", {});

  console.log("\n── retention still works, and takes the log with it ──");
  check("t2's log exists before the delete (or the next check proves nothing)",
    psql(`select count(*) from agent.run_entries where run_id='${T2}';`, asWriter).out === "1");
  allowed("the writer can delete a run", `delete from agent.runs where id='${T2}';`, asWriter);
  check("...and its entries went with it",
    psql(`select count(*) from agent.run_entries where run_id='${T2}';`, asWriter).out === "0");
  check("...and the run is gone too", psql(`select count(*) from agent.runs where id='${T2}';`, asWriter).out === "0");

  console.log("\n── the marker does not leak past the transaction that set it ──");
  // IN ONE SESSION, WHICH IS THE WHOLE POINT. Every other check here runs in its
  // own psql process, so a SESSION-level marker would be invisible to them — and it
  // was: a SQL mutation sweep widened the marker from transaction-local to
  // session-local and this file did not notice. A pooled connection reuses
  // sessions, so a marker that survives a commit lets the NEXT statement on that
  // connection delete an entry on its own.
  allowed(`a throwaway run to delete alongside`, `insert into agent.runs (id, tenant_id) values ('${T3}','t1');`, asWriter);
  // THE ONE THAT MATTERS: deleting one run must not authorise deleting ANOTHER
  // run's entries, even in the same transaction. Both statements in one `psql -c`
  // share a transaction, which is what makes this observable at all.
  refused("deleting one run does not authorise deleting another run's entries, even in one transaction",
    `delete from agent.runs where id='${T3}'; delete from agent.run_entries where run_id='${T1}' and seq=2;`,
    "cannot be deleted on its own", {});
  check("...and the refusal took the whole statement with it, so the throwaway run is still there",
    psql(`select count(*) from agent.runs where id='${T3}';`, asWriter).out === "1");
  allowed("the throwaway run deletes cleanly on its own", `delete from agent.runs where id='${T3}';`, asWriter);

  // AND ACROSS TWO TRANSACTIONS IN ONE SESSION, which is the only way a
  // session-scoped marker is distinguishable from a transaction-scoped one. The
  // run delete commits; the entry delete that follows must still be refused.
  allowed(`a second throwaway run`, `insert into agent.runs (id, tenant_id) values ('${T3}','t1');`, asWriter);
  {
    const r = psqlSession([
      `delete from agent.runs where id='${T3}';`,          // its own transaction, committed
      `delete from agent.run_entries where run_id='${T1}' and seq=2;`,
    ]);
    check("the marker does not survive the transaction that set it", !r.ok && r.err.includes("cannot be deleted on its own"),
      r.ok ? "the entry delete was ALLOWED in a later transaction of the same session" : r.err.split("\n")[0]);
    check("...and the committed run delete really did commit, so the session was live",
      psql(`select count(*) from agent.runs where id='${T3}';`, asWriter).out === "0");
  }

  // TWO RUNS IN ONE STATEMENT, both with logs. This is why the marker APPENDS
  // rather than replaces: a multi-row delete fires the BEFORE trigger once per row
  // and the cascades all run afterwards, so a marker that held only the last id
  // would leave every earlier run's log unauthorised and the delete would fail.
  const T4 = "44444444-4444-4444-4444-444444444444";
  const T5 = "55555555-5555-5555-5555-555555555555";
  allowed("two more runs, each with a log",
    `insert into agent.runs (id, tenant_id) values ('${T4}','t1'), ('${T5}','t1');
     insert into agent.run_entries (run_id, seq, body) values
       ('${T4}', 0, '{"kind":"started","at":0,"agent":"a","model":"m"}'),
       ('${T5}', 0, '{"kind":"started","at":0,"agent":"a","model":"m"}');`, asWriter);
  allowed("both delete in ONE statement and both logs go with them",
    `delete from agent.runs where id in ('${T4}','${T5}');`, asWriter);
  check("...neither log survived",
    psql(`select count(*) from agent.run_entries where run_id in ('${T4}','${T5}');`, asWriter).out === "0");
  refused("and in a fresh session too",
    `delete from agent.run_entries where run_id='${T1}' and seq=2;`, "cannot be deleted on its own", {});
  check("CONTROL: the log that survived all of that is intact",
    psql(`select count(*) from agent.run_entries where run_id='${T1}';`, asWriter).out === "6",
    psql(`select count(*) from agent.run_entries where run_id='${T1}';`, asWriter).out);
} finally {
  try {
    execFileSync("su", ["postgres", "-c", `psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)}`],
      { stdio: ["ignore", "pipe", "pipe"] });
  } catch { /* best effort */ }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) { console.log("FAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
