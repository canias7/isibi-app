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
import { execFileSync, spawn } from "node:child_process";
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

/**
 * HOLD A ROW LOCK FROM ANOTHER SESSION, so the ONE line that makes the fence atomic can
 * be observed at all.
 *
 * **A SWEEP HAD TO POINT THIS OUT.** Removing `for update` from `agent.append_entry`
 * SURVIVED every check in this file, and it is not an inert mutant — it is the whole
 * atomicity argument. It survived because every other check here is a SEQUENTIAL `psql`
 * process, and a lock only means anything under concurrency. So this starts a second
 * session that takes the row lock and sleeps holding it, and waits until the lock is
 * VISIBLE in `pg_locks` rather than guessing with a sleep — a fixed pause would make the
 * check flaky in the direction that reports the product as broken.
 *
 * `SELECT … FOR UPDATE` takes a `RowShareLock` on the TABLE plus a tuple lock, and the
 * table-level one is what is polled for: it is granted only once the statement has run,
 * so seeing it means the row is held.
 */
function holdRowLock(runId, { db = DB, seconds = 8, waitMs = 6000, table = "run_work", where = null } = {}) {
  // ⚠ THE TABLE IS A PARAMETER RATHER THAN A SECOND COPY OF THIS FUNCTION. `skip locked` in
  // `resume_due_automations` is the same property one relation over, and a second copy is
  // how the two drift.
  const pred = where ?? `run_id='${runId}'`;
  const sql = `begin; select 1 from agent.${table} where ${pred} for update; select pg_sleep(${seconds}); commit;`;
  const child = spawn("su", ["postgres", "-c",
    `psql -X -q -d ${db} -c ${shq(sql)}`], { stdio: "ignore", detached: true });
  const held = () => psql(`select count(*) from pg_locks l
      join pg_class c on c.oid = l.relation
      join pg_stat_activity a on a.pid = l.pid
     where c.relname = '${table}' and l.mode = 'RowShareLock' and l.granted
       and a.pid <> pg_backend_pid();`, { db }).out;
  let waited = 0;
  while (waited < waitMs && held() === "0") {
    try { execFileSync("sleep", ["0.2"], { stdio: "ignore" }); } catch { /* best effort */ }
    waited += 200;
  }
  return {
    ok: held() !== "0",
    release: () => { try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } } },
  };
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
  // **THE OWNER, AND IT IS A SEPARATE ROLE FROM THE WRITER SINCE THE FENCE.**
  // `service_role` no longer holds INSERT on `agent.run_entries` — the whole point of
  // the fence is that the runtime role cannot write the log directly — so the checks
  // below that are about the TABLE's own constraints (generated columns, the four
  // unique indexes, the position key, the kind check) are driven as the owner, which
  // is a superuser here. They are about what the table refuses, not about who may ask.
  // The grant itself is checked separately, as a grant.
  const asOwner = {};
  const claimT1 = { role: "authenticated", claims: '{"tenant_id":"t1"}' };
  const claimT2 = { role: "authenticated", claims: '{"tenant_id":"t2"}' };

  console.log("\n── the log is the only writer, and the engine derives the rest ──");
  allowed("a run is created with an id and a tenant and nothing else",
    `insert into agent.runs (id, tenant_id) values ('${T1}','t1'), ('${T2}','t2');`, asOwner);
  check("a run with no entries yet is 'new'",
    psql(`select status from agent.runs where id='${T1}';`, asOwner).out === "new");

  const STARTED = `{"kind":"started","at":0,"tenant":"t1","agent":"support","model":"claude-sonnet-5","limits":{"steps":8,"wallMs":"Infinity","tokens":1000}}`;
  allowed("a started entry is appended",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 0, '${STARTED}');`, asOwner);
  check("...and the engine moved the run to 'running'",
    psql(`select status from agent.runs where id='${T1}';`, asOwner).out === "running");
  check("...and derived the agent name and model from the log, not from the caller",
    psql(`select agent_name || '/' || model from agent.runs where id='${T1}';`, asOwner).out === "support/claude-sonnet-5");

  console.log("\n── the positional columns are GENERATED from the body ──");
  const MODEL1 = `{"kind":"model","at":1,"step":1,"ms":1200,"text":"checking","usage":null,"costMicros":null,"toolCalls":[{"id":"c0","name":"look","args":{"q":"x"}},{"id":"c1","name":"charge","args":{}}]}`;
  allowed("a model entry is appended",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 1, '${MODEL1}');`, asOwner);
  check("kind, step and index are read out of the body",
    psql(`select kind || ':' || step || ':' || coalesce(idx::text,'-') from agent.run_entries where run_id='${T1}' and seq=1;`, asOwner).out === "model:1:-");
  allowed("a tool result is appended",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 2, '{"kind":"tool","at":2,"step":1,"index":0,"name":"look","ms":40,"ok":true,"value":{"hit":1}}');`, asOwner);
  check("a tool entry's slot is read out of the body",
    psql(`select step || ',' || idx from agent.run_entries where run_id='${T1}' and seq=2;`, asOwner).out === "1,0");

  console.log("\n── UNKNOWN USAGE IS NOT ZERO, AND NOT MISSING ──");
  const usage = psql(`select jsonb_typeof(body->'usage') || '|' || (body ? 'usage')::text || '|' || (body->'usage' = 'null'::jsonb)::text || '|' || (body->'usage' = '0'::jsonb)::text from agent.run_entries where run_id='${T1}' and seq=1;`, asOwner).out;
  check("an unreported usage is stored as JSON null", usage.startsWith("null|"), usage);
  // `::text` of a boolean is 'true'/'false'. psql's own -t -A shorthand is t/f, and
  // comparing against the shorthand read three correct answers as failures.
  check("...the key is still THERE (absent would be a third meaning)", usage.split("|")[1] === "true", usage);
  check("...it equals JSON null", usage.split("|")[2] === "true", usage);
  check("...and it is NOT zero", usage.split("|")[3] === "false", usage);

  console.log("\n── AN UNLIMITED LIMIT SURVIVES STORAGE ──");
  const lim = psql(`select (limits->>'wallMs') || '|' || jsonb_typeof(limits->'wallMs') || '|' || (limits->>'tokens') from agent.runs where id='${T1}';`, asOwner).out;
  check("an unbounded limit is kept as the string Infinity", lim === "Infinity|string|1000", lim);

  console.log("\n── NO DUPLICATE ENTRIES: each of the five ways ──");
  refused("a second started entry", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 20, '{"kind":"started","at":9}');`, "entries_one_started", asOwner);
  refused("a second model answer for one step", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 21, '{"kind":"model","at":9,"step":1,"ms":1}');`, "entries_one_model_per_step", asOwner);
  refused("a second result for one tool slot", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 22, '{"kind":"tool","at":9,"step":1,"index":0,"ok":true}');`, "entries_one_tool_per_slot", asOwner);
  refused("the same position twice", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 1, '{"kind":"model","at":9,"step":99,"ms":1}');`, "run_entries_pkey", asOwner);
  allowed("CONTROL: a DIFFERENT step and a different slot are both fine",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 3, '{"kind":"tool","at":3,"step":1,"index":1,"name":"charge","ms":9,"ok":false,"error":"declined"}'), ('${T1}', 4, '{"kind":"model","at":4,"step":2,"ms":900,"text":"done","toolCalls":[],"usage":{"inputTokens":5,"outputTokens":2},"costMicros":11}');`, asOwner);

  console.log("\n── A MALFORMED ENTRY CANNOT BE STORED AT ALL ──");
  refused("a model entry with no step", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 30, '{"kind":"model","at":9,"ms":1}');`, "entry_position_matches_kind", asOwner);
  refused("a tool entry with no index", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 31, '{"kind":"tool","at":9,"step":2,"ok":true}');`, "entry_position_matches_kind", asOwner);
  refused("a started entry carrying a step", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 32, '{"kind":"started","at":9,"step":1}');`, "entry_position_matches_kind", asOwner);
  refused("an entry of an unknown kind", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 33, '{"kind":"nope","at":9}');`, "entry_kind_known", asOwner);
  refused("an entry for a run that does not exist", `insert into agent.run_entries (run_id, seq, body) values ('99999999-9999-9999-9999-999999999999', 0, '{"kind":"started","at":0}');`, "run_entries_run_id_fkey", asOwner);

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
    psql(`select body->>'text' from agent.run_entries where run_id='${T1}' and seq=1;`, asOwner).out === "checking");
  check("a tool's own result is still the one it returned",
    psql(`select body->'value'->>'hit' from agent.run_entries where run_id='${T1}' and seq=2;`, asOwner).out === "1");
  check("a failed tool kept its own error text",
    psql(`select body->>'error' from agent.run_entries where run_id='${T1}' and seq=3;`, asOwner).out === "declined");

  console.log("\n── the stop reason is preserved verbatim ──");
  allowed("a stopped entry is appended",
    `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 5, '{"kind":"stopped","at":5,"stop":{"reason":"bound","bound":"steps","limit":8,"used":8}}');`, asOwner);
  const stop = psql(`select status || '|' || (stop->>'reason') || '|' || (stop->>'bound') || '|' || (stop->>'limit') from agent.runs where id='${T1}';`, asOwner).out;
  check("the run is stopped and the reason names the bound that ended it", stop === "stopped|bound|steps|8", stop);
  refused("a second stopped entry", `insert into agent.run_entries (run_id, seq, body) values ('${T1}', 40, '{"kind":"stopped","at":9,"stop":{}}');`, "entries_one_stopped", asOwner);

  console.log("\n── TENANT ISOLATION ──");
  allowed("t2 gets a log of its own",
    `insert into agent.run_entries (run_id, seq, body) values ('${T2}', 0, '{"kind":"started","at":0,"agent":"other","model":"m"}');`, asOwner);
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
  check("claims naming a tenant nobody owns see nothing",
    psql(`select count(*) from agent.runs;`, { role: "authenticated", claims: '{"sub":"user-nobody"}' }).out === "0");
  check("claims with NEITHER a tenant nor a subject see nothing",
    psql(`select count(*) from agent.runs;`, { role: "authenticated", claims: '{"email":"a@b.c"}' }).out === "0");
  check("a tenant that matches nothing sees nothing",
    psql(`select count(*) from agent.runs;`, { role: "authenticated", claims: '{"tenant_id":"nobody"}' }).out === "0");
  check("CONTROL: the same session with real claims DOES see its run",
    psql(`select count(*) from agent.runs;`, claimT1).out === "1");

  console.log("\n── THE TENANT FALLS BACK TO THE SIGNED-IN SUBJECT ──");
  // Supabase does not put a `tenant_id` claim in a JWT, so without this a real
  // signed-in customer matches no rows for ever. Driving the real HTTP API is what
  // exposed that; these checks are what stop it coming back.
  allowed(`a run owned by a bare subject id`,
    `insert into agent.runs (id, tenant_id) values ('66666666-6666-6666-6666-666666666666','subject-99');`, asOwner);
  check("a token carrying only `sub` sees the run owned by that subject",
    psql(`select count(*) from agent.runs;`, { role: "authenticated", claims: '{"sub":"subject-99"}' }).out === "1");
  check("...and still sees nothing belonging to anybody else",
    psql(`select count(*) from agent.runs where tenant_id <> 'subject-99';`, { role: "authenticated", claims: '{"sub":"subject-99"}' }).out === "0");
  check("AN EXPLICIT tenant_id WINS over the subject",
    psql(`select coalesce(string_agg(tenant_id,','),'-') from agent.runs;`,
      { role: "authenticated", claims: '{"tenant_id":"subject-99","sub":"t1"}' }).out === "subject-99");
  check("...and the same token with the two swapped sees the other one",
    psql(`select coalesce(string_agg(tenant_id,','),'-') from agent.runs where tenant_id='subject-99';`,
      { role: "authenticated", claims: '{"tenant_id":"t1","sub":"subject-99"}' }).out === "-");
  allowed(`clean up the subject run`, `delete from agent.runs where id='66666666-6666-6666-6666-666666666666';`, asOwner);

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
  check("the tool result is still there", psql(`select count(*) from agent.run_entries where run_id='${T1}' and seq=2;`, asOwner).out === "1");
  refused("...and it cannot be done inside a transaction that touches nothing else",
    `begin; delete from agent.run_entries where run_id='${T1}' and seq=2; commit;`, "cannot be deleted on its own", {});

  console.log("\n── retention still works, and takes the log with it ──");
  check("t2's log exists before the delete (or the next check proves nothing)",
    psql(`select count(*) from agent.run_entries where run_id='${T2}';`, asOwner).out === "1");
  allowed("the writer can delete a run", `delete from agent.runs where id='${T2}';`, asWriter);
  check("...and its entries went with it",
    psql(`select count(*) from agent.run_entries where run_id='${T2}';`, asOwner).out === "0");
  check("...and the run is gone too", psql(`select count(*) from agent.runs where id='${T2}';`, asOwner).out === "0");

  console.log("\n── the marker does not leak past the transaction that set it ──");
  // IN ONE SESSION, WHICH IS THE WHOLE POINT. Every other check here runs in its
  // own psql process, so a SESSION-level marker would be invisible to them — and it
  // was: a SQL mutation sweep widened the marker from transaction-local to
  // session-local and this file did not notice. A pooled connection reuses
  // sessions, so a marker that survives a commit lets the NEXT statement on that
  // connection delete an entry on its own.
  allowed(`a throwaway run to delete alongside`, `insert into agent.runs (id, tenant_id) values ('${T3}','t1');`, asOwner);
  // THE ONE THAT MATTERS: deleting one run must not authorise deleting ANOTHER
  // run's entries, even in the same transaction. Both statements in one `psql -c`
  // share a transaction, which is what makes this observable at all.
  refused("deleting one run does not authorise deleting another run's entries, even in one transaction",
    `delete from agent.runs where id='${T3}'; delete from agent.run_entries where run_id='${T1}' and seq=2;`,
    "cannot be deleted on its own", {});
  check("...and the refusal took the whole statement with it, so the throwaway run is still there",
    psql(`select count(*) from agent.runs where id='${T3}';`, asOwner).out === "1");
  allowed("the throwaway run deletes cleanly on its own", `delete from agent.runs where id='${T3}';`, asOwner);

  // AND ACROSS TWO TRANSACTIONS IN ONE SESSION, which is the only way a
  // session-scoped marker is distinguishable from a transaction-scoped one. The
  // run delete commits; the entry delete that follows must still be refused.
  allowed(`a second throwaway run`, `insert into agent.runs (id, tenant_id) values ('${T3}','t1');`, asOwner);
  {
    const r = psqlSession([
      `delete from agent.runs where id='${T3}';`,          // its own transaction, committed
      `delete from agent.run_entries where run_id='${T1}' and seq=2;`,
    ]);
    check("the marker does not survive the transaction that set it", !r.ok && r.err.includes("cannot be deleted on its own"),
      r.ok ? "the entry delete was ALLOWED in a later transaction of the same session" : r.err.split("\n")[0]);
    check("...and the committed run delete really did commit, so the session was live",
      psql(`select count(*) from agent.runs where id='${T3}';`, asOwner).out === "0");
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
       ('${T5}', 0, '{"kind":"started","at":0,"agent":"a","model":"m"}');`, asOwner);
  allowed("both delete in ONE statement and both logs go with them",
    `delete from agent.runs where id in ('${T4}','${T5}');`, asOwner);
  check("...neither log survived",
    psql(`select count(*) from agent.run_entries where run_id in ('${T4}','${T5}');`, asOwner).out === "0");
  refused("and in a fresh session too",
    `delete from agent.run_entries where run_id='${T1}' and seq=2;`, "cannot be deleted on its own", {});
  check("CONTROL: the log that survived all of that is intact",
    psql(`select count(*) from agent.run_entries where run_id='${T1}';`, asOwner).out === "6",
    psql(`select count(*) from agent.run_entries where run_id='${T1}';`, asOwner).out);

  // ══════════════════════════════════════════════════════════════════════════
  // THE DURABLE QUEUE. Exclusivity is a property of one conditional UPDATE, and
  // a conditional UPDATE is a property of Postgres — so it is proved here and
  // the in-memory fake in the unit tests mirrors these answers.
  // ══════════════════════════════════════════════════════════════════════════
  const Q1 = "aaaaaaaa-0000-0000-0000-000000000001";
  const Q2 = "aaaaaaaa-0000-0000-0000-000000000002";
  const QS = `{"kind":"started","at":0,"tenant":"t1","agent":"support","model":"m","prompt":"go","limits":{"steps":4}}`;
  const jget = (sql, opts = asWriter) => psql(sql, opts).out;
  /**
   * The claim token currently on a work row, as a SQL expression.
   *
   * Every check here is its own `psql` PROCESS, so a token cannot be kept in a
   * variable between them — and READING IT OUT OF THE ROW is the right fixture
   * anyway: it is what the current holder was handed, so a check that uses it is
   * asking "may the holder do this", which is the question. A stale token is written
   * out literally where a check is about a stale one.
   */
  const tokOf = (id) => `(select claim_token from agent.run_work where run_id='${id}')`;

  console.log("\n── accepting work is one transaction or nothing ──");
  allowed("a run, its first entry and its work row are accepted together",
    `select agent.accept_run('${Q1}'::uuid, 't1', '${QS}'::jsonb);`, asWriter);
  check("...the run exists and is already 'running'",
    jget(`select status from agent.runs where id='${Q1}';`) === "running", jget(`select status from agent.runs where id='${Q1}';`));
  check("...its prompt is durable before anything executed",
    jget(`select body->>'prompt' from agent.run_entries where run_id='${Q1}' and seq=0;`) === "go");
  check("...and the work is outstanding",
    jget(`select (done_at is null and claimed_by is null) from agent.run_work where run_id='${Q1}';`) === "t");
  check("accept answers the state it left the work in",
    jget(`select agent.accept_run('${Q1}'::uuid, 't1', '${QS}'::jsonb) ->> 'state';`) === "queued");
  check("A REPEATED ACCEPT WRITES NO SECOND ENTRY",
    jget(`select count(*) from agent.run_entries where run_id='${Q1}';`) === "1",
    jget(`select count(*) from agent.run_entries where run_id='${Q1}';`));
  refused("A RETRY FROM ANOTHER TENANT CANNOT TAKE OVER THE RUN ID",
    `select agent.accept_run('${Q1}'::uuid, 't2', '${QS}'::jsonb);`, "is not this tenant's", asWriter);
  refused("an entry that is not a 'started' entry is refused",
    `select agent.accept_run('${Q2}'::uuid, 't1', '{"kind":"model","at":0,"step":1}'::jsonb);`,
    'must be a "started" entry', asWriter);
  refused("a blank tenant is refused", `select agent.accept_run('${Q2}'::uuid, '  ', '${QS}'::jsonb);`,
    "tenant must be a non-empty string", asWriter);
  check("CONTROL: none of those refusals created a run",
    jget(`select count(*) from agent.runs where id='${Q2}';`) === "0");

  console.log("\n── the claim is the one gate, and it is exclusive ──");
  check("the first claim succeeds and answers the tenant",
    jget(`select agent.claim_run('${Q1}'::uuid, 'w1', 90) ->> 'tenant_id';`) === "t1");
  check("A SECOND CLAIM WHILE THE LEASE IS LIVE GETS NOTHING",
    jget(`select agent.claim_run('${Q1}'::uuid, 'w2', 90) ->> 'claimed';`) === "false",
    jget(`select agent.claim_run('${Q1}'::uuid, 'w2', 90)::text;`));
  check("...and the row still belongs to the first holder",
    jget(`select claimed_by from agent.run_work where run_id='${Q1}';`) === "w1");
  check("the claim counts attempts, so a run that keeps failing can be given up on",
    Number(jget(`select attempts from agent.run_work where run_id='${Q1}';`)) >= 1);
  refused("a blank worker cannot claim", `select agent.claim_run('${Q1}'::uuid, '', 90);`,
    "worker must be a non-empty string", asWriter);
  refused("a claim with no lease length is refused", `select agent.claim_run('${Q1}'::uuid, 'w3', 0);`,
    "ttl must be a positive number of seconds", asWriter);

  console.log("\n── every claim carries a token, and it is what a holder presents ──");
  check("the claim minted a token",
    jget(`select (claim_token is not null)::text from agent.run_work where run_id='${Q1}';`) === "true");
  check("...and the claim ANSWERED it, so the claimer never has to ask separately",
    jget(`select (agent.claim_run('${Q1}'::uuid, 'wX', 90) ? 'claim_token')::text;`) === "false",
    "that claim should have been refused — the lease is live");
  check("a claimed row is four facts or none — the constraint says so",
    jget(`select count(*) from pg_constraint where conname='run_work_claim_whole';`) === "1");
  refused("a claimed row cannot exist without its token",
    `update agent.run_work set claim_token = null where run_id='${Q1}';`, "run_work_claim_whole", asWriter);

  console.log("\n── the lease is a liveness check, not a duration cap ──");
  check("the holder may extend its own lease",
    jget(`select agent.beat_run('${Q1}'::uuid, 'w1', ${tokOf(Q1)}, 90);`) === "t");
  check("NOBODY ELSE MAY EXTEND IT",
    jget(`select agent.beat_run('${Q1}'::uuid, 'w2', ${tokOf(Q1)}, 90);`) === "f");
  check("NOR MAY THE HOLDER WITH A TOKEN THAT IS NOT THE CURRENT ONE",
    jget(`select agent.beat_run('${Q1}'::uuid, 'w1', gen_random_uuid(), 90);`) === "f",
    "a stale claim extended a live lease");
  refused("a beat with no token at all is refused BY NAME, never treated as not needing one",
    `select agent.beat_run('${Q1}'::uuid, 'w1', null, 90);`, "claim token is required", asWriter);
  refused("...and so is a release", `select agent.release_run('${Q1}'::uuid, 'w1', null, true, null);`,
    "claim token is required", asWriter);
  refused("...and so is an append",
    `select agent.append_entry('${Q1}'::uuid, 9, '{"kind":"model","at":9,"step":9}'::jsonb, 'w1', null);`,
    "claim token is required", asWriter);
  // THE EXPIRY, FORCED. A lease that has lapsed is claimable by anybody and
  // revivable by nobody — the two halves that stop two workers on one run.
  psql(`update agent.run_work set lease_expires_at = now() - interval '1 second' where run_id='${Q1}';`, asWriter);
  check("A LAPSED LEASE CANNOT BE REVIVED BY ITS OWN HOLDER",
    jget(`select agent.beat_run('${Q1}'::uuid, 'w1', ${tokOf(Q1)}, 90);`) === "f",
    "a worker whose lease had gone extended it anyway");
  check("...and the work is reclaimable",
    jget(`select count(*) from agent.sweep_run_work(0, 50) as t where t ->> 'run_id' = '${Q1}';`) === "1",
    jget(`select agent.sweep_run_work(0,50)::text;`));
  check("A LAPSED LEASE IS CLAIMABLE BY SOMEBODY ELSE",
    jget(`select agent.claim_run('${Q1}'::uuid, 'w2', 90) ->> 'claimed';`) === "true");
  check("...and the first holder can no longer release it",
    jget(`select agent.release_run('${Q1}'::uuid, 'w1', gen_random_uuid(), true, null);`) === "f",
    "a worker released a claim it no longer held");

  console.log("\n── letting go, and asking again ──");
  check("the holder releases as done",
    jget(`select agent.release_run('${Q1}'::uuid, 'w2', ${tokOf(Q1)}, true, null);`) === "t");
  check("...and finished work is not swept up",
    jget(`select count(*) from agent.sweep_run_work(0, 50);`) === "0",
    jget(`select agent.sweep_run_work(0,50)::text;`));
  check("...nor claimable",
    jget(`select agent.claim_run('${Q1}'::uuid, 'w9', 90) ->> 'claimed';`) === "false");
  check("a resume puts it back, and resets the attempt count",
    jget(`select agent.requeue_run('${Q1}'::uuid, 't1') ->> 'state';`) === "queued");
  check("...the attempts really are back to zero",
    jget(`select attempts from agent.run_work where run_id='${Q1}';`) === "0");
  check("...and the kind records that it was asked for again",
    jget(`select kind from agent.run_work where run_id='${Q1}';`) === "resume");
  check("ANOTHER TENANT'S RESUME IS NOT FOUND, never forbidden",
    jget(`select agent.requeue_run('${Q1}'::uuid, 't2') ->> 'state';`) === "not-found");
  check("a resume of a run that does not exist is the same answer",
    jget(`select agent.requeue_run('99999999-9999-9999-9999-999999999999'::uuid, 't1') ->> 'state';`) === "not-found");
  check("A RESUME WHILE A LIVE LEASE IS HELD ANSWERS 'running' AND TOUCHES NOTHING",
    jget(`select agent.claim_run('${Q1}'::uuid, 'w4', 90) ->> 'claimed';`) === "true"
    && jget(`select agent.requeue_run('${Q1}'::uuid, 't1') ->> 'state';`) === "running"
    && jget(`select claimed_by from agent.run_work where run_id='${Q1}';`) === "w4",
    "a resume mid-run disturbed the holder's lease");
  check("...nor its token, so the holder can still write",
    jget(`select (claim_token is not null)::text from agent.run_work where run_id='${Q1}';`) === "true");
  check("a release that is not 'done' leaves the work outstanding for another delivery",
    jget(`select agent.release_run('${Q1}'::uuid, 'w4', ${tokOf(Q1)}, false, 'it fell over');`) === "t"
    && jget(`select (done_at is null) from agent.run_work where run_id='${Q1}';`) === "t");
  check("...and a released row keeps no token",
    jget(`select (claim_token is null)::text from agent.run_work where run_id='${Q1}';`) === "true");
  check("...and it says why",
    jget(`select last_error from agent.run_work where run_id='${Q1}';`) === "it fell over");

  // **A LONG RUN IS NOT A DROPPED RUN, and this is the check a mutation sweep had
  // to point out was missing.** Selecting on elapsed time instead of on the lease
  // would take a healthy hour-long run away from the worker doing it — and every
  // other check here passed with that change in place, because none of them had a
  // run that was BOTH old and alive.
  // **THE TOKEN IS SET TOO, or the whole-claim constraint refuses this UPDATE and the
  // row stays unclaimed** — which is exactly how this pair failed the moment the token
  // arrived: the fixture produced an UNCLAIMED old row, so "not swept" was being asked
  // of something that ought to be swept. A fixture that cannot build the state under
  // test reports the product as broken.
  allowed("age a claimed run by two hours, lease still live",
    `update agent.run_work set enqueued_at = now() - interval '2 hours',
          claimed_by = 'w-alive', claimed_at = now(), lease_expires_at = now() + interval '80 seconds',
          claim_token = gen_random_uuid()
        where run_id='${Q1}';`, asWriter);
  check("A RUN GOING FOR TWO HOURS WITH A LIVE LEASE IS NOT SWEPT",
    jget(`select count(*) from agent.sweep_run_work(30, 50) as t;`) === "0",
    jget(`select agent.sweep_run_work(30,50)::text;`));
  check("...nor claimable by anybody else", jget(`select agent.claim_run('${Q1}'::uuid, 'w-other', 90) ->> 'claimed';`) === "false");
  // THE CONTROL for that pair: the same old row IS swept once its lease lapses, so
  // the refusal above is about the lease and not about the row being unreachable.
  psql(`update agent.run_work set lease_expires_at = now() - interval '60 seconds' where run_id='${Q1}';`, asWriter);
  check("CONTROL: the same old run IS swept once its lease has lapsed",
    jget(`select count(*) from agent.sweep_run_work(30, 50) as t where t ->> 'run_id' = '${Q1}';`) === "1");
  // Put the lease back before releasing: a LAPSED holder may no longer release, which
  // is the point of the check two sections down, and this is cleanup rather than a
  // subject.
  psql(`update agent.run_work set lease_expires_at = now() + interval '60 seconds' where run_id='${Q1}';`, asWriter);
  psql(`select agent.release_run('${Q1}'::uuid, 'w-alive', ${tokOf(Q1)}, false, null);`, asWriter);

  console.log("\n── the queue is the backend's alone ──");
  refused("a signed-in customer cannot read the queue",
    `select count(*) from agent.run_work;`, "permission denied", claimT1);
  refused("...nor write to it", `update agent.run_work set done_at = now();`, "permission denied", claimT1);
  // **THREE WALLS STAND BETWEEN A CUSTOMER AND A CLAIM, and the gate is named so
  // that removing one SHOWS.** Measured, in this order: the function grant refuses
  // first (`permission denied for function claim_run`); with EXECUTE granted, the
  // table grant refuses (`for table run_work`); with both granted, RLS with no
  // policies matches no rows and the claim answers `claimed: false`. Only with all
  // three gone does a customer take the work — which is what the sweep's
  // three-wall mutant proves.
  //
  // A check that asked only for "permission denied" passed with the function grant
  // widened, because the table's refusal wears the same two words. Naming the
  // object is the difference between a wall and a coincidence.
  refused("...nor take a claim through the function — and the FUNCTION grant is the gate",
    `select agent.claim_run('${Q1}'::uuid, 'thief', 90);`, "permission denied for function claim_run", claimT1);
  refused("...nor accept work for themselves",
    `select agent.accept_run('${Q2}'::uuid, 't1', '${QS}'::jsonb);`, "permission denied", claimT1);
  refused("anon is walled at the schema", `select count(*) from agent.run_work;`, "permission denied", { role: "anon" });
  check("CONTROL: the writer can still do all of it",
    psql(`select count(*) from agent.run_work;`, asWriter).ok);
  check("RLS is enabled and forced on the queue, with no policy to match",
    jget(`select relrowsecurity::text || ',' || relforcerowsecurity::text from pg_class where oid='agent.run_work'::regclass;`) === "true,true");
  check("...and there are no policies on it at all",
    jget(`select count(*) from pg_policies where schemaname='agent' and tablename='run_work';`) === "0");

  // ══════════════════════════════════════════════════════════════════════════
  // THE FENCE: a journal write must present the claim it is writing under.
  //
  // **THIS IS THE SECTION THAT PROVES THE DEMONSTRATED GAP IS CLOSED.** The hole was
  // measured on the live deployment: a consumer whose lease had been revoked kept
  // writing for a further beat, because "do I still hold this" was answered from a
  // FLAG in its own process. Every check here asks the database instead, at write
  // time, in the same transaction as the insert.
  //
  // NONE OF IT DEPENDS ON THE SWEEPER'S GRACE, and the three-party scenario below
  // asserts that out loud: the replacement claims the run while `sweep_run_work(30)`
  // still refuses to offer it, because `claim_run` takes a lapsed lease with no grace
  // at all. A wider grace would not have closed this.
  // ══════════════════════════════════════════════════════════════════════════
  const F1 = "bbbbbbbb-0000-0000-0000-000000000001";
  const FS = `{"kind":"started","at":0,"tenant":"t1","agent":"support","model":"m","prompt":"go","limits":{"steps":8}}`;
  const M1 = `{"kind":"model","at":1,"step":1,"ms":10,"text":"one","toolCalls":[],"usage":null,"costMicros":null}`;
  const M1DIFF = `{"kind":"model","at":1,"step":1,"ms":99,"text":"SOMETHING ELSE","toolCalls":[],"usage":null,"costMicros":null}`;
  const M2 = `{"kind":"model","at":2,"step":2,"ms":10,"text":"two","toolCalls":[],"usage":null,"costMicros":null}`;
  const M3 = `{"kind":"model","at":3,"step":3,"ms":10,"text":"three","toolCalls":[],"usage":null,"costMicros":null}`;
  const app = (seq, body, worker, token) =>
    `select agent.append_entry('${F1}'::uuid, ${seq}, '${body}'::jsonb, '${worker}', ${token});`;

  console.log("\n── THE DIRECT DOOR IS SHUT, and the before/after is measured ──");
  allowed("a run is accepted, which is the only thing that writes seq 0",
    `select agent.accept_run('${F1}'::uuid, 't1', '${FS}'::jsonb);`, asWriter);
  check("...and `accept_run` still wrote the log's first entry, although the writer has no INSERT",
    jget(`select body->>'prompt' from agent.run_entries where run_id='${F1}' and seq=0;`) === "go",
    "SECURITY DEFINER is what makes that possible and it is the only thing that needs it");

  // **THE MIGRATION'S OWN REVOKE IS ASSERTED FIRST, BEFORE THIS CHECK TOUCHES ANY
  // GRANT — and a sweep is why.** The before/after demonstration below grants INSERT
  // and revokes it again as the OWNER, which re-establishes the state whatever the
  // migration did: the mutant that deletes `revoke insert … from service_role`
  // SURVIVED, because this file was putting the state back for it. A check that repairs
  // what it is testing proves nothing about the thing that was supposed to have done it.
  check("THE MIGRATION ITSELF REVOKED THE WRITER'S INSERT — asked before anything here changes a grant",
    jget(`select has_table_privilege('service_role','agent.run_entries','INSERT')::text;`) === "false",
    "the writer can still insert, so the migration's revoke did not happen");

  // **THE BEFORE/AFTER, ON THE SAME DATABASE, IN BOTH DIRECTIONS.** A stale write is
  // attempted as `service_role` with the grant RESTORED, then with it revoked again —
  // so what is measured is the grant and not a coincidence.
  psql(`grant insert on agent.run_entries to service_role;`, {});
  const beforeOk = psql(`insert into agent.run_entries (run_id, seq, body) values ('${F1}', 90, '${M3}'::jsonb);`, asWriter).ok;
  check("BEFORE: with the old grant, the writer could put an entry in the log directly", beforeOk,
    "the before-state could not be reproduced, so the after-state proves less than it looks");
  psql(`delete from agent.runs where id='${F1}'; select agent.accept_run('${F1}'::uuid, 't1', '${FS}'::jsonb);`, {});
  psql(`revoke insert on agent.run_entries from service_role;`, {});
  refused("AFTER: the writer cannot put an entry in the log directly at all",
    `insert into agent.run_entries (run_id, seq, body) values ('${F1}', 90, '${M3}'::jsonb);`,
    "permission denied for table run_entries", asWriter);
  check("...and it is the INSERT that went, not the read",
    psql(`select count(*) from agent.run_entries where run_id='${F1}';`, asWriter).ok,
    "the writer lost SELECT too, which would break every resume");
  check("the privilege itself says so, rather than being inferred from an error",
    jget(`select has_table_privilege('service_role','agent.run_entries','INSERT')::text || ','
           || has_table_privilege('service_role','agent.run_entries','SELECT')::text;`) === "false,true");

  console.log("\n── a write presents the claim, and every refusal is its own ──");
  check("with no claim at all, a write is refused",
    JSON.parse(jget(app(1, M1, "wA", "gen_random_uuid()"))).why === "not-holder");
  const claimA = jget(`select agent.claim_run('${F1}'::uuid, 'wA', 90) ->> 'claim_token';`);
  check("the claim answered a token", /^[0-9a-f-]{36}$/.test(claimA), claimA);
  check("the holder writes", JSON.parse(jget(app(1, M1, "wA", `'${claimA}'`))).stored === true);
  check("A WRONG WORKER IS `not-holder`",
    JSON.parse(jget(app(2, M2, "wOther", `'${claimA}'`))).why === "not-holder");
  check("A WRONG TOKEN IS `bad-token` — right name, replaced claim",
    JSON.parse(jget(app(2, M2, "wA", "gen_random_uuid()"))).why === "bad-token",
    "the two refusals are not the same fact and must not read the same");
  check("CONTROL: none of those refusals wrote anything",
    jget(`select count(*) from agent.run_entries where run_id='${F1}';`) === "2");

  console.log("\n── a duplicate is read precisely, and the bodies decide ──");
  check("THE SAME ENTRY AGAIN IS `already`, at the seq it really occupies",
    (() => { const a = JSON.parse(jget(app(1, M1, "wA", `'${claimA}'`)));
             return a.already === true && a.ok === true && a.seq === 1; })(),
    jget(app(1, M1, "wA", `'${claimA}'`)));
  check("...and at ANOTHER seq it is still `already`, naming where the entry really is",
    (() => { const a = JSON.parse(jget(app(7, M1, "wA", `'${claimA}'`)));
             return a.already === true && a.seq === 1; })());
  check("...and KEY ORDER DOES NOT MATTER, because `jsonb` equality does not care",
    JSON.parse(jget(app(7, `{"step":1,"kind":"model","text":"one","at":1,"ms":10,"usage":null,"costMicros":null,"toolCalls":[]}`, "wA", `'${claimA}'`))).already === true);
  check("A DIFFERENT BODY IN THE SAME LOGICAL SLOT IS A `conflict`, NEVER A DUPLICATE",
    (() => { const a = JSON.parse(jget(app(8, M1DIFF, "wA", `'${claimA}'`)));
             return a.ok === false && a.why === "conflict" && a.seq === 1; })(),
    jget(app(8, M1DIFF, "wA", `'${claimA}'`)));
  check("A TAKEN POSITION IS `position`, which is a different problem with a different fix",
    (() => { const a = JSON.parse(jget(app(1, M2, "wA", `'${claimA}'`)));
             return a.ok === false && a.why === "position"; })());
  check("CONTROL: the log still holds exactly what it held",
    jget(`select count(*) from agent.run_entries where run_id='${F1}';`) === "2");
  refused("a blank worker cannot append — it RAISES rather than becoming `not-holder`",
    app(9, M3, "", `'${claimA}'`), "worker must be a non-empty string", asWriter);
  refused("A MALFORMED ENTRY RAISES BY NAME rather than becoming one of the answers",
    app(9, `{"kind":"nope","at":9}`, "wA", `'${claimA}'`), "entry_kind_known", asWriter);
  refused("...and so does a model entry with no step",
    app(9, `{"kind":"model","at":9,"ms":1}`, "wA", `'${claimA}'`), "entry_position_matches_kind", asWriter);

  console.log("\n══ THE THREE-PARTY SCENARIO: a paused holder, an expired lease, a replacement ══");
  // **THE EXACT SHAPE THAT WAS MEASURED LIVE.** The old consumer is paused (it simply
  // makes no call for a while), its lease expires, and a DUPLICATE DELIVERY claims the
  // run before the sweeper would ever offer it. Then both try to write.
  psql(`update agent.run_work set lease_expires_at = now() - interval '1 second' where run_id='${F1}';`, asWriter);

  // THE PAUSED HOLDER, BEFORE ANYBODY ELSE TOUCHES THE ROW. Its name and its token are
  // both still the current ones, so `lease-expired` is the only thing that can refuse
  // it — which is the reading that matters: it is refused for being LATE, not for
  // having been replaced.
  check("the paused holder's write is refused `lease-expired` — before any replacement exists",
    JSON.parse(jget(app(2, M2, "wA", `'${claimA}'`))).why === "lease-expired",
    jget(app(2, M2, "wA", `'${claimA}'`)));
  check("...and its beat agrees, so the process is told to stop as well as stopped",
    jget(`select agent.beat_run('${F1}'::uuid, 'wA', '${claimA}', 90);`) === "f");
  // **AND IT CANNOT END THE RUN EITHER — asked HERE, while its name and token are both
  // still the current ones, which is the only state that tests the lease condition.** A
  // sweep found this missing: the later "the old consumer cannot end the run" check runs
  // after a replacement has taken the row, so `claimed_by` refuses it and the lease
  // condition is never reached. Removing `and lease_expires_at > now()` from
  // `release_run` survived every check in this file.
  check("A LAPSED HOLDER CANNOT END THE RUN, although its name and token are current",
    jget(`select agent.release_run('${F1}'::uuid, 'wA', '${claimA}', true, null);`) === "f",
    "a holder whose lease had gone marked the run done mid-flight");
  check("...and the work really is still outstanding",
    jget(`select (done_at is null and claimed_by = 'wA')::text from agent.run_work where run_id='${F1}';`) === "true");

  // **THE SWEEPER WOULD NOT HAVE OFFERED IT YET, and that is the point.** So nothing
  // below is the grace period doing the work, and widening the grace would change
  // none of it.
  check("THE SWEEPER'S GRACE HAS NOT EXPIRED — it will not offer this run",
    jget(`select count(*) from agent.sweep_run_work(30, 50) as t where t ->> 'run_id' = '${F1}';`) === "0",
    "the grace had already lapsed, so this scenario would not be the one asked for");
  const claimB = jget(`select agent.claim_run('${F1}'::uuid, 'wB', 90) ->> 'claim_token';`);
  check("...and a DUPLICATE DELIVERY claims it anyway, because `claim_run` has no grace",
    /^[0-9a-f-]{36}$/.test(claimB) && claimB !== claimA, `A ${claimA} / B ${claimB}`);

  check("THE OLD CONSUMER'S WRITE FAILS", JSON.parse(jget(app(2, M2, "wA", `'${claimA}'`))).ok === false,
    jget(app(2, M2, "wA", `'${claimA}'`)));
  check("THE REPLACEMENT'S WRITE SUCCEEDS", JSON.parse(jget(app(2, M2, "wB", `'${claimB}'`))).stored === true,
    jget(app(2, M2, "wB", `'${claimB}'`)));
  check("...and the log holds the replacement's entry and not the old consumer's",
    jget(`select body->>'text' from agent.run_entries where run_id='${F1}' and seq=2;`) === "two");
  check("the old consumer cannot end the run either",
    jget(`select agent.release_run('${F1}'::uuid, 'wA', '${claimA}', true, null);`) === "f",
    "a stale holder marked a run done that somebody else was working on");

  // **AND THE SAME SCENARIO WITH A SHARED NAME, which is what the token is FOR.**
  // Everything above would also be refused by the worker name; this is the case that
  // only a per-claim token can catch.
  psql(`update agent.run_work set lease_expires_at = now() - interval '1 second' where run_id='${F1}';`, asWriter);
  const claimB2 = jget(`select agent.claim_run('${F1}'::uuid, 'wB', 90) ->> 'claim_token';`);
  check("a reclaim BY THE SAME NAME mints a different token", claimB2 !== claimB, `${claimB} → ${claimB2}`);
  check("...and the previous claim's write is refused `bad-token` although the name matches",
    JSON.parse(jget(app(3, M3, "wB", `'${claimB}'`))).why === "bad-token",
    "a worker holding a replaced claim wrote under a name that still looked current");
  check("CONTROL: the current claim writes", JSON.parse(jget(app(3, M3, "wB", `'${claimB2}'`))).stored === true);

  console.log("\n── THE LOCK, OBSERVED — the one line the whole change is about ──");
  // **A SWEEP PROVED NO SEQUENTIAL CHECK CAN SEE THIS.** Removing `for update` from
  // `agent.append_entry` survived every other check in this file, and it is the atomicity
  // argument itself: without it, the holder/token/lease checks and the insert are no
  // longer serialised against a concurrent reclaim.
  //
  // So a second session takes the row lock and holds it. A fenced write must WAIT — and
  // `lock_timeout` turns waiting into an observable refusal, which is the only way a
  // sequential harness can tell "it waited" from "it went ahead". It runs HERE because
  // `wB` holds a live claim at this point; a fresh claim would need the run outstanding,
  // which it is not by the end of the section below.
  {
    // A MODEL ENTRY OF ITS OWN, because `M3` is already in the log by now and the fence
    // would answer `already` — which is correct and would make the control meaningless.
    const M40 = `{"kind":"model","at":40,"step":40,"ms":10,"text":"the lock check","toolCalls":[],"usage":null,"costMicros":null}`;
    const lock = holdRowLock(F1);
    check("a second session is holding the work row (or the next check proves nothing)", lock.ok,
      "the concurrent lock never became visible in pg_locks");
    if (lock.ok) {
      const blocked = psql(`set lock_timeout = '1500ms'; select agent.append_entry('${F1}'::uuid, 40, '${M40}'::jsonb, 'wB', '${claimB2}');`,
        { ...asWriter, expectFail: true });
      check("A FENCED WRITE WAITS FOR A CONCURRENT HOLDER OF THE WORK ROW",
        !blocked.ok && /lock timeout|canceling statement due to lock/i.test(blocked.err),
        blocked.ok ? "it went ahead while another session held the row" : blocked.err.split("\n")[0]);
      check("...and nothing was written while it waited",
        jget(`select count(*) from agent.run_entries where run_id='${F1}' and seq=40;`) === "0");
    }
    lock.release();
    // THE CONTROL, and it is what makes the refusal above about the LOCK rather than
    // about the write being wrong: the same write, with nobody holding the row, stores.
    // The lock holder is killed rather than waited out, so this also proves the release
    // worked — a leaked lock would make every later check here time out.
    execFileSync("sleep", ["0.6"], { stdio: "ignore" });
    const free = jget(`select agent.append_entry('${F1}'::uuid, 40, '${M40}'::jsonb, 'wB', '${claimB2}')::text;`);
    check("CONTROL: the same write succeeds once the row is free", JSON.parse(free || "{}").stored === true, free);
  }

  console.log("\n── and a finished run takes no more writes ──");
  check("the holder releases as done", jget(`select agent.release_run('${F1}'::uuid, 'wB', '${claimB2}', true, null);`) === "t");
  check("a write to finished work is refused `finished`",
    JSON.parse(jget(app(4, `{"kind":"stopped","at":4,"stop":{"reason":"answered"}}`, "wB", `'${claimB2}'`))).why === "finished");
  check("a write to a run with no work row at all is refused `no-work`",
    JSON.parse(jget(`select agent.append_entry('${Q2}'::uuid, 0, '${FS}'::jsonb, 'wZ', gen_random_uuid());`)).why === "no-work");

  console.log("\n── the fence is the backend's alone ──");
  refused("a signed-in customer cannot call the fence",
    app(5, M3, "wB", `'${claimB2}'`), "permission denied for function append_entry", claimT1);
  check("...and the function is SECURITY DEFINER, which is why the grant is the wall",
    jget(`select prosecdef::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='agent' and p.proname='append_entry';`) === "true");
  check("...with an empty search_path pinned, so nothing resolves out of a caller's schema",
    jget(`select coalesce(array_to_string(proconfig,','),'-') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='agent' and p.proname='append_entry';`) === 'search_path=""');
  // **ASSERTED AS THE PROPERTY: every overload requires the token.** An unfenced
  // `beat_run(uuid, text, integer)` left beside the new one would be exactly the bypass
  // door this migration exists to close — a holder keeping a lease alive without
  // proving which claim it holds — and it would make a named-argument call ambiguous
  // as well.
  check("EVERY OVERLOAD OF beat_run AND release_run REQUIRES THE TOKEN",
    jget(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='agent' and p.proname in ('beat_run','release_run')
             and pg_get_function_identity_arguments(p.oid) not like '%p_token uuid%';`) === "0",
    jget(`select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
           from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='agent' and p.proname in ('beat_run','release_run');`));
  check("...exactly one of each remains",
    jget(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='agent' and p.proname in ('beat_run','release_run');`) === "2");
  allowed("clean up the fence's run", `delete from agent.runs where id='${F1}';`, asWriter);

  // ══ what a person WROTE, which is not what RAN ════════════════════════════
  //
  // `agent.agents` and `agent.agent_messages` hold the customer's own agents and
  // the messages typed to them. They are mutable and deletable, which is why they
  // are not in the journal — and the checks below are about exactly two things:
  // whose rows they are, and the one row this product must not be able to store.
  console.log("\n── the authored agents, and whose they are ──");

  const AUTH_A1 = "aaaaaaaa-0000-4000-8000-000000000001";   // t1's
  const AUTH_A2 = "aaaaaaaa-0000-4000-8000-000000000002";   // t2's
  const AUTH_M1 = "bbbbbbbb-0000-4000-8000-000000000001";

  allowed("the writer stores an agent for t1",
    `insert into agent.agents (id, tenant_id, name, instructions)
     values ('${AUTH_A1}', 't1', 'Booking assistant', 'Answer questions about opening hours.');`, asWriter);
  allowed("...and one for t2",
    `insert into agent.agents (id, tenant_id, name, instructions)
     values ('${AUTH_A2}', 't2', 'Somebody else''s', 'Not yours.');`, asWriter);

  // THE WHOLE POINT, ASKED AS A REAL CUSTOMER rather than as the writer that
  // bypasses the policies.
  check("a customer sees their own agent",
    psql(`select count(*) from agent.agents;`, claimT1).out === "1");
  check("...and only their own — the other account's is invisible",
    psql(`select count(*) from agent.agents where id='${AUTH_A2}';`, claimT1).out === "0");
  check("a customer with no claims at all sees nothing",
    psql(`select count(*) from agent.agents;`, { role: "authenticated", claims: "" }).out === "0");
  check("claims that will not parse see nothing",
    psql(`select count(*) from agent.agents;`, { role: "authenticated", claims: "not json" }).out === "0");
  // The subject fallback is what a real Supabase token carries, so it is exercised
  // as itself rather than assumed equivalent to an explicit tenant_id.
  check("a real token's `sub` reaches its own rows",
    psql(`select count(*) from agent.agents;`,
      { role: "authenticated", claims: '{"sub":"t1"}' }).out === "1");

  // ⚠ THE CLIENT CANNOT WRITE AT ALL. Ownership is the server's to decide, so the
  // browser's role has no INSERT, UPDATE or DELETE — a missing grant, not a policy
  // it could ever satisfy.
  refused("a customer cannot create an agent, even for themselves",
    `insert into agent.agents (id, tenant_id, name, instructions)
     values ('cccccccc-0000-4000-8000-000000000001', 't1', 'Mine', 'Mine.');`,
    "permission denied", claimT1);
  refused("a customer cannot edit their own agent",
    `update agent.agents set name='Renamed' where id='${AUTH_A1}';`, "permission denied", claimT1);
  refused("a customer cannot delete their own agent",
    `delete from agent.agents where id='${AUTH_A1}';`, "permission denied", claimT1);
  refused("anon has nothing here", `select count(*) from agent.agents;`,
    "permission denied", { role: "anon", claims: "" });

  // ⚠ AND THE WRITER CANNOT CROSS TENANTS BY UPDATE either — not because of a
  // policy (it bypasses those) but because the API is the only caller and derives
  // the tenant from a verified token. Stated as the limit it is: this is an
  // application guarantee, and the check below is the READ side, which is the half
  // the database really owns.
  check("t2 cannot see t1's agent by id",
    psql(`select count(*) from agent.agents where id='${AUTH_A1}';`, claimT2).out === "0");

  console.log("\n── the messages, and the row that must not exist ──");
  allowed("the writer stores a message",
    `insert into agent.agent_messages (id, agent_id, body)
     values ('${AUTH_M1}', '${AUTH_A1}', 'what needs reordering today?');`, asWriter);
  check("its owner can read it",
    psql(`select count(*) from agent.agent_messages where agent_id='${AUTH_A1}';`, claimT1).out === "1");
  check("⚠ ANOTHER ACCOUNT CANNOT READ THE CONVERSATION",
    psql(`select count(*) from agent.agent_messages;`, claimT2).out === "0");
  refused("a customer cannot write a message either",
    `insert into agent.agent_messages (id, agent_id, body)
     values ('dddddddd-0000-4000-8000-000000000001', '${AUTH_A1}', 'typed by the client');`,
    "permission denied", claimT1);

  // **THE FAKE REPLY IS IMPOSSIBLE, NOT MERELY DISCOURAGED.** No model is wired to
  // this feature, so a row claiming to have come from the agent is a lie the
  // database refuses to hold — which is a wall a client bug cannot walk past.
  refused("⚠ NOTHING CAN BE STORED AS HAVING COME FROM THE AGENT",
    `insert into agent.agent_messages (id, agent_id, role, body)
     values ('eeeeeeee-0000-4000-8000-000000000001', '${AUTH_A1}', 'agent', 'Sure, I will do that!');`,
    "agent_messages_role_check", asWriter);
  refused("...nor as any other speaker",
    `insert into agent.agent_messages (id, agent_id, role, body)
     values ('eeeeeeee-0000-4000-8000-000000000002', '${AUTH_A1}', 'assistant', 'hello');`,
    "agent_messages_role_check", asWriter);
  refused("an empty message is refused",
    `insert into agent.agent_messages (id, agent_id, body)
     values ('eeeeeeee-0000-4000-8000-000000000003', '${AUTH_A1}', '   ');`,
    "agent_messages_body_check", asWriter);
  refused("a nameless agent is refused",
    `insert into agent.agents (id, tenant_id, name, instructions)
     values ('ffffffff-0000-4000-8000-000000000001', 't1', '  ', 'x');`,
    "agents_name_check", asWriter);

  console.log("\n── the two facts the engine owns ──");
  // `updated_at` really moves, which this repository's OTHER product gets wrong:
  // it has a column whose comment promises a bump that nothing performs.
  const authBefore = jget(`select updated_at from agent.agents where id='${AUTH_A1}';`);
  psql(`update agent.agents set name='Booking assistant 2' where id='${AUTH_A1}';`, asWriter);
  check("an edit bumps updated_at",
    jget(`select updated_at from agent.agents where id='${AUTH_A1}';`) !== authBefore, `was ${authBefore}`);
  const authBeforeMsg = jget(`select updated_at from agent.agents where id='${AUTH_A1}';`);
  psql(`insert into agent.agent_messages (id, agent_id, body)
        values ('bbbbbbbb-0000-4000-8000-000000000002', '${AUTH_A1}', 'and the 10-gauge sets?');`, asWriter);
  check("a new message makes its agent recent, so the list cannot sink mid-conversation",
    jget(`select updated_at from agent.agents where id='${AUTH_A1}';`) !== authBeforeMsg);
  check("messages carry a total order the database assigns",
    jget(`select count(distinct seq) from agent.agent_messages where agent_id='${AUTH_A1}';`) === "2");

  console.log("\n── the list screen's one read ──");
  // `agent.agent_overview` is what the agents list draws a row from: the agent,
  // plus the last thing said to it. It exists so the preview line is one plain
  // request instead of an embedded child select whose behaviour nothing here can
  // run. So the thing to drive is that the derived column is RIGHT, and that the
  // view is not a hole through the row level security under it.
  check("the view answers one row per agent, not one per message",
    jget(`select count(*) from agent.agent_overview where tenant_id='t1';`) === "1",
    jget(`select count(*) from agent.agent_overview where tenant_id='t1';`));
  // THE LAST one, not the first. A1 has two messages and the older one sorts
  // first by every ordering except the one the view asks for, so a view that
  // ordered ascending would pass a count check and fail this.
  check("the preview line is the LAST message",
    jget(`select last_message from agent.agent_overview where id='${AUTH_A1}';`) === "and the 10-gauge sets?",
    jget(`select last_message from agent.agent_overview where id='${AUTH_A1}';`));
  // NULL, never the empty string: a body cannot be blank (the check above refuses
  // one), so NULL can only mean "nothing said yet" and the caller never guesses.
  check("an agent nobody has written to has a NULL preview, not an empty one",
    jget(`select coalesce(last_message, '<null>') from agent.agent_overview where id='${AUTH_A2}';`) === "<null>");
  check("the view carries the fields the list row draws",
    jget(`select name || '|' || instructions || '|' || (created_at is not null)::text || '|' || (updated_at is not null)::text
            from agent.agent_overview where id='${AUTH_A1}';`)
      === "Booking assistant 2|Answer questions about opening hours.|true|true");

  // THE SAFETY ARGUMENT, DRIVEN. Without `security_invoker` a view runs as its
  // owner and every tenant's agents would come back to anyone who can select
  // from it — the one way this object can be worse than no object at all.
  check("it is declared security_invoker",
    jget(`select (select count(*) from pg_options_to_table(c.reloptions)
                   where option_name = 'security_invoker' and option_value = 'true')
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'agent' and c.relname = 'agent_overview';`) === "1");
  check("one tenant reading the view sees its own agent",
    psql(`select count(*) from agent.agent_overview;`, claimT1).out === "1");
  // THE OBSERVER IS ALIVE: the same read as the account next door answers 1 too,
  // so "0 for the other tenant" below is isolation and not an empty view.
  check("...and the other tenant sees its own, which is what makes the next line evidence",
    psql(`select count(*) from agent.agent_overview;`, claimT2).out === "1");
  check("neither tenant can see the other's row through the view",
    psql(`select count(*) from agent.agent_overview where id='${AUTH_A2}';`, claimT1).out === "0" &&
    psql(`select count(*) from agent.agent_overview where id='${AUTH_A1}';`, claimT2).out === "0");
  // A MESSAGE IS A SECOND RELATION UNDER THE VIEW and has its own policy, so the
  // preview line is a separate reach that has to be refused separately: t2 can
  // see its own row and must not see t1's WORDS through it.
  check("a tenant with no messages of its own still gets a NULL preview rather than somebody else's",
    psql(`select coalesce(last_message, '<null>') from agent.agent_overview where tenant_id='t2';`, claimT2).out === "<null>");
  check("no claims at all reads nothing through the view",
    psql(`select count(*) from agent.agent_overview;`, { role: "authenticated", claims: "" }).out === "0");
  refused("anon cannot reach the view at all",
    `select count(*) from agent.agent_overview;`, "permission denied", { role: "anon" });

  console.log("\n── bringing one agent over from a browser ──");
  // `agent.import_agent` is the only write on this side that is more than one
  // statement, and the only reason it exists is that the import can be pressed
  // twice: the local copy is never deleted, so a failure must leave NOTHING
  // behind rather than half an agent for somebody to find and tidy up.
  const IMP = jget(`select agent.import_agent('t1', 'Imported assistant', 'Brought over from a browser.',
    '[{"body":"first thing I asked","at":"2026-09-01T10:00:00Z"},
      {"body":"second thing","at":"2026-09-01T10:05:00Z"},
      {"body":"third, with no time at all"}]'::jsonb);`);
  check("it answers the new agent's id", /^[0-9a-f-]{36}$/.test(IMP), IMP);
  check("the agent landed under the tenant the CALLER named",
    jget(`select tenant_id || '|' || name from agent.agents where id='${IMP}';`)
      === "t1|Imported assistant");
  check("all three messages landed",
    jget(`select count(*) from agent.agent_messages where agent_id='${IMP}';`) === "3");
  // ARRAY ORDER IS THE CONVERSATION'S ORDER. The third message has no time at
  // all, so an implementation that ordered on `created_at` would put it first
  // or last by accident; `seq` is assigned as each row goes in.
  check("the thread reads back in the order it was typed",
    jget(`select string_agg(body, ' / ' order by seq) from agent.agent_messages where agent_id='${IMP}';`)
      === "first thing I asked / second thing / third, with no time at all");
  check("a message's own time is kept when the browser knew it",
    jget(`select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
            from agent.agent_messages where agent_id='${IMP}' and seq = (
              select min(seq) from agent.agent_messages where agent_id='${IMP}');`)
      === "2026-09-01 10:00");
  // Losing a message's time is worth far less than losing the message, so an
  // absent or unparseable one becomes now() instead of failing the import.
  check("...and a message with no time still arrives, dated now",
    jget(`select (created_at > now() - interval '1 minute')::text
            from agent.agent_messages where agent_id='${IMP}'
           order by seq desc limit 1;`) === "true");
  check("the imported agent shows its last message on the list screen",
    jget(`select last_message from agent.agent_overview where id='${IMP}';`)
      === "third, with no time at all");
  check("an import with no messages is an agent with an empty thread, not a refusal",
    /^[0-9a-f-]{36}$/.test(jget(`select agent.import_agent('t1', 'Empty one', 'Nothing said yet.', '[]'::jsonb);`)));

  // ── ALL OF IT OR NONE OF IT ────────────────────────────────────────────────
  const beforeRollback = jget(`select count(*) from agent.agents where tenant_id='t1';`);
  refused("an import carrying a blank message is refused whole",
    `select agent.import_agent('t1', 'Half an agent', 'Should not survive.',
      '[{"body":"this one is fine"},{"body":"   "}]'::jsonb);`,
    "agent_messages_body_check", asWriter);
  // THE POINT OF THE WHOLE FUNCTION, and the one thing a loop of inserts could
  // not give: the agent from the refused import is not there either.
  check("...and it left NO agent behind",
    jget(`select count(*) from agent.agents where tenant_id='t1';`) === beforeRollback,
    `was ${beforeRollback}, now ${jget(`select count(*) from agent.agents where tenant_id='t1';`)}`);
  check("...and no message either",
    jget(`select count(*) from agent.agent_messages m
           where m.body = 'this one is fine';`) === "0");
  // A FORGED SPEAKER IS DROPPED, NOT REFUSED, and that is the right shape here:
  // `role` is not part of the payload the function reads, so a caller who sends
  // one is not making a request the function can honour or decline — the column
  // default and its `check (role = 'user')` decide, and they cannot be reached.
  // The assertion is therefore about the ROW, not about an error.
  const FAKE = jget(`select agent.import_agent('t1', 'Fake reply', 'x',
    '[{"body":"hi","role":"agent"},{"body":"there","role":"assistant"}]'::jsonb);`);
  check("a payload naming the agent as the speaker stores the person as the speaker anyway",
    jget(`select string_agg(distinct role, ',') from agent.agent_messages where agent_id='${FAKE}';`)
      === "user");
  check("...and both messages are still there, so nothing was quietly dropped with it",
    jget(`select count(*) from agent.agent_messages where agent_id='${FAKE}';`) === "2");
  refused("a mangled payload is refused rather than read as an empty conversation",
    `select agent.import_agent('t1', 'Mangled', 'x', '"not an array"'::jsonb);`,
    "messages must be a JSON array", asWriter);
  refused("...including a null one",
    `select agent.import_agent('t1', 'Mangled', 'x', null);`,
    "messages must be a JSON array", asWriter);
  refused("a nameless import is refused by the table's own gate",
    `select agent.import_agent('t1', '  ', 'x', '[]'::jsonb);`,
    "agents_name_check", asWriter);

  // ── AND A CUSTOMER CANNOT CALL IT AT ALL ───────────────────────────────────
  // It takes the tenant as an ARGUMENT, so this grant is the only thing between
  // one account and another's rows. `execute` defaults to PUBLIC on a new
  // function, which is exactly why the migration revokes it by name.
  // RE-ANCHORED 2026-09-15: the four-argument signature is DROPPED rather than
  // left beside the five-argument one — Postgres would keep both as an overload
  // set, and a caller that forgot the import key would silently get the version
  // with no identity at all. The property is unchanged; the signature moved.
  check("only service_role may execute it",
    jget(`select has_function_privilege('service_role',
            'agent.import_agent(text,text,text,jsonb,text)', 'execute')::text || '|' ||
          has_function_privilege('authenticated',
            'agent.import_agent(text,text,text,jsonb,text)', 'execute')::text || '|' ||
          has_function_privilege('anon',
            'agent.import_agent(text,text,text,jsonb,text)', 'execute')::text;`)
      === "true|false|false");
  refused("a signed-in customer calling it for their OWN tenant is still refused",
    `select agent.import_agent('t1', 'Mine surely', 'x', '[]'::jsonb, null);`,
    "permission denied", claimT1);

  psql(`delete from agent.agents where tenant_id='t1' and id <> '${AUTH_A1}';`, asWriter);

  console.log("\n── the import can be pressed twice ──");
  // ATOMIC IS NOT IDEMPOTENT, and the gap between them is one lost response: the
  // agent is created, the answer never arrives, the local record is still
  // unmarked, and the obvious thing to do is press again. Without an identity
  // that made a second agent carrying a second copy of the conversation.
  const KEY1 = "11111111-2222-4333-8444-555555555555";   // a browser record's id
  const FIRST = jget(`select agent.import_agent('t1', 'Retried', 'Brought over twice.',
    '[{"body":"one"},{"body":"two"}]'::jsonb, '${KEY1}');`);
  const AGAIN = jget(`select agent.import_agent('t1', 'Retried', 'Brought over twice.',
    '[{"body":"one"},{"body":"two"}]'::jsonb, '${KEY1}');`);
  check("pressing it again answers the SAME agent",
    FIRST === AGAIN, `${FIRST} vs ${AGAIN}`);
  check("...and there is still only one",
    jget(`select count(*) from agent.agents where tenant_id='t1' and import_key='${KEY1}';`) === "1");
  // THE HALF THAT IS EASY TO GET WRONG: answering the existing id while running
  // the message loop anyway doubles the conversation on every press.
  check("...with its conversation intact and NOT doubled",
    jget(`select count(*) from agent.agent_messages where agent_id='${FIRST}';`) === "2",
    jget(`select count(*) from agent.agent_messages where agent_id='${FIRST}';`));
  check("...in the order it was typed, still",
    jget(`select string_agg(body, ',' order by seq) from agent.agent_messages where agent_id='${FIRST}';`)
      === "one,two");
  // A RETRY CARRYING DIFFERENT WORDS DOES NOT REWRITE THE AGENT EITHER. The
  // identity decides, and the first press is what landed; a second press is a
  // retry, not an edit, and treating it as one would let a stale browser
  // overwrite an agent somebody has since changed on another machine.
  const SAME = jget(`select agent.import_agent('t1', 'Different name now', 'Different instructions.',
    '[{"body":"three"}]'::jsonb, '${KEY1}');`);
  check("a retry with different content is still the same agent",
    SAME === FIRST);
  check("...and did not overwrite what landed first",
    jget(`select name from agent.agents where id='${FIRST}';`) === "Retried");
  check("...and added no message",
    jget(`select count(*) from agent.agent_messages where agent_id='${FIRST}';`) === "2");

  // THE SCOPE IS THE TENANT'S, and that is the half that has to be in the
  // database: two accounts holding the same local id each import their own.
  const T2SAME = jget(`select agent.import_agent('t2', 'T2 has the same local id', 'Theirs.',
    '[{"body":"t2 only"}]'::jsonb, '${KEY1}');`);
  check("another account importing the SAME local id gets its own agent",
    T2SAME !== FIRST, `${T2SAME} vs ${FIRST}`);
  check("...under its own tenant",
    jget(`select tenant_id from agent.agents where id='${T2SAME}';`) === "t2");
  check("...and cannot see or touch the first account's",
    psql(`select count(*) from agent.agents where id='${FIRST}';`, claimT2).out === "0");

  // WITHOUT A KEY, NOTHING IS DEDUPLICATED — an agent made the ordinary way has
  // no import identity, and any number of those may exist. Asserted so the
  // partial index cannot quietly become a total one.
  const N1 = jget(`select agent.import_agent('t1', 'No key A', 'x', '[]'::jsonb, null);`);
  const N2 = jget(`select agent.import_agent('t1', 'No key B', 'x', '[]'::jsonb, null);`);
  check("two imports with no key are two agents", N1 !== N2);
  check("...and an empty key counts as no key, not as a shared one",
    jget(`select agent.import_agent('t1', 'Blank key A', 'x', '[]'::jsonb, '  ');`)
      !== jget(`select agent.import_agent('t1', 'Blank key B', 'x', '[]'::jsonb, '');`));
  check("an agent created the ordinary way carries no import identity",
    jget(`select count(*) from agent.agents where tenant_id='t1' and import_key is null;`) >= "4");

  // THE WALL IS THE INDEX, so it refuses a second row even when nothing goes
  // through the function — which is what makes the function's `on conflict` a
  // loser-safe race rather than the only guard.
  refused("the database itself refuses a second import of one local record",
    `insert into agent.agents (id, tenant_id, name, instructions, import_key)
     values (gen_random_uuid(), 't1', 'Sneaked in', 'x', '${KEY1}');`,
    "agents_one_import_per_tenant", asWriter);
  // CAST TO TEXT: psql prints a bare boolean as `t`, not `true`, so the first
  // version of this line compared "t" with "true" and failed correct SQL.
  check("the index is partial, so it is about imports and nothing else",
    jget(`select (indexdef like '%WHERE (import_key IS NOT NULL)%')::text from pg_indexes
           where schemaname='agent' and indexname='agents_one_import_per_tenant';`) === "true",
    jget(`select coalesce(indexdef,'<no such index>') from pg_indexes
           where schemaname='agent' and indexname='agents_one_import_per_tenant';`));
  // AND THE OLD SIGNATURE IS GONE rather than left as an overload: a caller that
  // forgot the new argument would otherwise get the version with no identity.
  check("there is exactly ONE import_agent, and it takes the key",
    jget(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='agent' and p.proname='import_agent';`) === "1");
  check("...and it is still service_role only",
    jget(`select has_function_privilege('service_role','agent.import_agent(text,text,text,jsonb,text)','execute')::text
          || '|' || has_function_privilege('authenticated','agent.import_agent(text,text,text,jsonb,text)','execute')::text;`)
      === "true|false");

  psql(`delete from agent.agents where tenant_id in ('t1','t2') and id <> '${AUTH_A1}' and id <> '${AUTH_A2}';`, asWriter);

  console.log("\n── deleting an agent takes its conversation ──");
  allowed("the writer deletes the agent", `delete from agent.agents where id='${AUTH_A1}';`, asWriter);
  check("...and its messages went with it",
    jget(`select count(*) from agent.agent_messages where agent_id='${AUTH_A1}';`) === "0");
  allowed("clean up the other account's agent", `delete from agent.agents where id='${AUTH_A2}';`, asWriter);

  console.log("\n── the log and the work go together ──");
  check("deleting the run takes its work row with it",
    psql(`delete from agent.runs where id='${Q1}';`, asWriter).ok
    && jget(`select count(*) from agent.run_work where run_id='${Q1}';`) === "0");
  check("...and its log",
    jget(`select count(*) from agent.run_entries where run_id='${Q1}';`) === "0");

  // ══ sending a message to an authored agent starts a run ═══════════════════
  //
  // THE WHOLE POINT OF THIS SECTION IS THAT IT IS ONE TRANSACTION. Everything
  // below is asked of `agent.send_to_agent` and never of the tables underneath
  // it: a check that inserted a message itself and then called `accept_run`
  // would be testing a second implementation of the thing under test.
  console.log("\n── sending a message starts a run ──");
  const SA  = "5a5a5a5a-0000-4000-8000-00000000a001";   // tenant t1's agent
  const SB  = "5a5a5a5a-0000-4000-8000-00000000b001";   // tenant t2's agent
  const MSG1  = "5a5a5a5a-0000-4000-8000-00000000ee01";
  const MSG2  = "5a5a5a5a-0000-4000-8000-00000000ee02";
  const MSG3  = "5a5a5a5a-0000-4000-8000-00000000ee03";
  const R1  = "5a5a5a5a-0000-4000-8000-00000000fa01";
  const R2  = "5a5a5a5a-0000-4000-8000-00000000fa02";
  const R3  = "5a5a5a5a-0000-4000-8000-00000000fa03";
  const INSTR = "Answer as a friendly bike shop. Never quote a price.";
  // The stand-in's own shape: labelled, and the label travels with the text. The
  // view has to hand this back verbatim, because the screen reads it from there.
  const ANSWER = "[simulated] we open at nine";

  const send = (a, mid, body, key, rid, tenant = "t1") =>
    jget(`select agent.send_to_agent('${tenant}','${a}','${mid}',${shq(body)},${shq(key)},'${rid}');`);

  allowed("an agent to send to", `insert into agent.agents (id, tenant_id, name, instructions)
      values ('${SA}','t1','Bike shop',${shq(INSTR)});`, asWriter);
  allowed("...and one belonging to somebody else",
    `insert into agent.agents (id, tenant_id, name, instructions)
      values ('${SB}','t2','Theirs','Theirs.');`, asWriter);

  const first = send(SA, MSG1, "when do you open?", "key-1", R1);
  check("the send answers ok", /"ok"\s*:\s*true/.test(first), first);
  check("...and it is not a repeat", /"repeat"\s*:\s*false/.test(first), first);
  check("...and the work is queued", /"state"\s*:\s*"queued"/.test(first), first);
  check("the message is stored",
    jget(`select body from agent.agent_messages where id='${MSG1}';`) === "when do you open?");
  check("...as a user message and nothing else",
    jget(`select role from agent.agent_messages where id='${MSG1}';`) === "user");
  check("...and it names the run it started",
    jget(`select run_id from agent.agent_messages where id='${MSG1}';`) === R1);
  check("the run exists under the same tenant",
    jget(`select tenant_id from agent.runs where id='${R1}';`) === "t1");
  check("...and it has work on the queue",
    jget(`select count(*) from agent.run_work where run_id='${R1}' and done_at is null;`) === "1");
  check("...and a log with exactly its first entry",
    jget(`select count(*) from agent.run_entries where run_id='${R1}';`) === "1");

  // ── the snapshot ─────────────────────────────────────────────────────────
  check("the run's first entry carries the instructions as they are NOW",
    jget(`select body ->> 'instructions' from agent.run_entries where run_id='${R1}' and seq=0;`) === INSTR);
  check("...and the conversation it was given, which is empty for a first message",
    jget(`select body ->> 'history' from agent.run_entries where run_id='${R1}' and seq=0;`) === "[]");
  check("...and which authored agent and which message started it",
    jget(`select (body ->> 'authoredAgent') || '|' || (body ->> 'message')
           from agent.run_entries where run_id='${R1}' and seq=0;`) === `${SA}|${MSG1}`);
  check("...and the prompt the caller sent",
    jget(`select body ->> 'prompt' from agent.run_entries where run_id='${R1}' and seq=0;`) === "when do you open?");

  // ⚠ THE WALL: A CALLER HAS NOWHERE TO PUT ANY OF THIS. The function takes six
  // arguments and not one of them is an entry, a model, a bound, an instruction or
  // a history — so there is no forged-entry case to write, which is the point.
  // What the arguments CAN carry is checked instead: the ids and the words typed.
  // ASSERTED AS THE PROPERTY RATHER THAN THE SPELLING: `jsonb` is the only type an
  // entry, a bound list or a history could arrive as, and none of the arguments is
  // one. Argument NAMES are deliberately not compared — a rename is not a widening.
  check("no argument of the send is a jsonb, so nothing structured can be handed to it",
    jget(`select count(*) from (
            select ty.typname from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              cross join unnest(p.proargtypes) as a(oid)
              join pg_type ty on ty.oid = a.oid
             where n.nspname = 'agent' and p.proname = 'send_to_agent') k
           where k.typname = 'jsonb';`) === "0");
  check("...and there are exactly six of them, so one cannot be added unnoticed",
    jget(`select p.pronargs::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'agent' and p.proname = 'send_to_agent';`) === "6",
    jget(`select pg_get_function_identity_arguments(p.oid) from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'agent' and p.proname = 'send_to_agent';`));
  // ASSERTED AS THE PROPERTY, NOT THE SPELLING — this was pinned to the whole JSON
  // string and went red on an honest change to the bounds it is about. What matters
  // is that the shape names all three things and that the numbers reaching the log
  // are the ones this function answers, which the next check reads.
  check("...so the run's shape is the server's own, not a caller's",
    jget(`select (agent.authored_run() ?& array['agent','model','limits'])::text
            || '|' || (agent.authored_run() ->> 'agent')
            || '|' || jsonb_typeof(agent.authored_run() -> 'limits')
            || '|' || (jsonb_typeof(agent.authored_run() -> 'limits') = 'object'
                       and (select count(*) from jsonb_each(agent.authored_run() -> 'limits')) >= 4)::text;`)
      === "true|authored|object|true",
    jget(`select agent.authored_run()::text;`));
  check("...and they reach the log exactly as declared",
    jget(`select (body -> 'limits')::text || '|' || (body ->> 'model') || '|' || (body ->> 'agent')
           from agent.run_entries where run_id='${R1}' and seq=0;`)
      === `${jget(`select (agent.authored_run() -> 'limits')::text;`)}|stand-in|authored`);
  // ⚠ toolCalls MUST NOT BE ZERO: it is a run TOTAL, and the engine stops a run
  // whose total is already spent — so a zero budget stops it before its first
  // model call and an authored agent would answer nothing at all.
  check("...with a tool budget the engine can actually start on",
    jget(`select (agent.authored_run() -> 'limits' ->> 'toolCalls')::int > 0;`) === "t");
  // ⚠ AND IT MUST EXCEED ONE CALL, NOT MERELY BE ABOVE ZERO. `stoppedBy` asks
  // `used >= limit`, so a budget of one is a budget already spent the instant one
  // call is made: MEASURED in the engine's own suite, an authored agent holding a
  // tool stopped `{reason:"spent", bound:"toolCalls", limit:1, used:1}` after its
  // call and never reached the step that answers. Zero let the run not start; one
  // let it not finish.
  check("...and enough of one that a run which calls a tool can still answer",
    jget(`select (agent.authored_run() -> 'limits' ->> 'toolCalls')::int > 1;`) === "t",
    jget(`select agent.authored_run() -> 'limits' ->> 'toolCalls';`));


  const forged = send(SA, MSG2, "again", "key-2", R2);
  check("a second send starts a second run", /"ok"\s*:\s*true/.test(forged), forged);
  check("...whose instructions are the agent's own row",
    jget(`select body ->> 'instructions' from agent.run_entries where run_id='${R2}' and seq=0;`) === INSTR);
  check("...and its history is the conversation that really happened",
    jget(`select jsonb_array_length((body -> 'history')) from agent.run_entries where run_id='${R2}' and seq=0;`) === "1");
  check("...whose one turn is the real first message",
    jget(`select body -> 'history' -> 0 ->> 'user' from agent.run_entries where run_id='${R2}' and seq=0;`) === "when do you open?");
  check("...with no answer, because that run has not finished",
    jget(`select (body -> 'history' -> 0 -> 'agent') is null or (body -> 'history' -> 0 -> 'agent') = 'null'::jsonb
           from agent.run_entries where run_id='${R2}' and seq=0;`) === "t");

  // ── the duplicate send ───────────────────────────────────────────────────
  const again = send(SA, "5a5a5a5a-0000-4000-8000-00000000eedd", "when do you open?", "key-1",
                     "5a5a5a5a-0000-4000-8000-00000000fadd");
  check("a repeated send is absorbed", /"repeat"\s*:\s*true/.test(again), again);
  check("...answering the message that already landed", again.includes(MSG1), again);
  check("...and the run it already started", again.includes(R1), again);
  // THE STORED BODY, so a caller echoes the conversation rather than its own
  // request. Driven with a retry that carries DIFFERENT text under the same key —
  // a client bug, and the one case where the two answers diverge.
  const reworded = send(SA, "5a5a5a5a-0000-4000-8000-00000000eede", "WHEN DO YOU OPEN???", "key-1",
                        "5a5a5a5a-0000-4000-8000-00000000fade");
  check("...and a retry with different words is answered with what is really stored",
    /"body"\s*:\s*"when do you open\?"/.test(reworded), reworded);
  // ⚠ AND THE ANSWER SAYS THE TWO DISAGREE. Without this a caller reads `ok` and is
  // handed the original message, which from a browser is indistinguishable from its
  // EDIT having been saved — so an edited retry after a lost response is thrown away
  // silently. It is a fact about the two bodies, not a refusal: the earlier message is
  // real and nothing is wrong with it.
  check("...and says the words it absorbed are not the words that were sent",
    /"mismatch"\s*:\s*true/.test(reworded), reworded);
  check("...while an identical retry says they are the same",
    /"mismatch"\s*:\s*false/.test(again), again);
  check("...which did not overwrite the message either",
    jget(`select body from agent.agent_messages where id='${MSG1}';`) === "when do you open?");
  check("...so there is still one message for that key",
    jget(`select count(*) from agent.agent_messages where agent_id='${SA}' and send_key='key-1';`) === "1");
  check("...and NO second run was minted",
    jget(`select count(*) from agent.runs where id='5a5a5a5a-0000-4000-8000-00000000fadd';`) === "0");
  check("...and nothing was put on the queue for it",
    jget(`select count(*) from agent.run_work where run_id='5a5a5a5a-0000-4000-8000-00000000fadd';`) === "0");

  // ── somebody else's agent ────────────────────────────────────────────────
  const stranger = send(SB, "5a5a5a5a-0000-4000-8000-00000000eeaa", "hello", "key-x",
                        "5a5a5a5a-0000-4000-8000-00000000faaa", "t1");
  check("sending to another account's agent is refused", /"error"\s*:\s*"no-agent"/.test(stranger), stranger);
  check("...and it reads the same as an agent that does not exist",
    /"error"\s*:\s*"no-agent"/.test(send("5a5a5a5a-0000-4000-8000-00000000c0ff", "5a5a5a5a-0000-4000-8000-00000000eeab",
      "hello", "key-y", "5a5a5a5a-0000-4000-8000-00000000faab", "t1")));
  check("...and wrote no message",
    jget(`select count(*) from agent.agent_messages where agent_id='${SB}';`) === "0");
  check("...and minted no run",
    jget(`select count(*) from agent.runs where id='5a5a5a5a-0000-4000-8000-00000000faaa';`) === "0");

  // ── a send with no key ───────────────────────────────────────────────────
  refused("a send with no key is refused rather than accepted unkeyed",
    `select agent.send_to_agent('t1','${SA}','5a5a5a5a-0000-4000-8000-00000000eeba','hi','','${R3}');`,
    "needs its own key", asWriter);
  check("...and it wrote nothing",
    jget(`select count(*) from agent.agent_messages where id='5a5a5a5a-0000-4000-8000-00000000eeba';`) === "0");

  // ── an answer reaches the next run's history, and an edit does not ───────
  //
  // The engine writes a `stopped` entry; the run's `stop` column is projected off
  // it by trigger. Written through `append_entry`'s own door would need a claim,
  // so this inserts the entry as the OWNER — which is honest about what is being
  // checked here: the HISTORY READ, not the fence.
  psql(`insert into agent.run_entries (run_id, seq, body) values ('${R1}', 1,
        ${shq(`{"kind":"model","at":1700000000001,"step":1,"ms":12,"text":${JSON.stringify(ANSWER)},"toolCalls":[],"usage":null,"costMicros":null}`)}::jsonb);`);
  psql(`insert into agent.run_entries (run_id, seq, body) values ('${R1}', 2,
        ${shq(`{"kind":"stopped","at":1700000000002,"stop":{"reason":"answered","text":${JSON.stringify(ANSWER)}}}`)}::jsonb);`);
  check("the run's stop is projected",
    jget(`select stop ->> 'reason' from agent.runs where id='${R1}';`) === "answered");

  allowed("the customer edits the agent's instructions afterwards",
    `update agent.agents set instructions='Completely different now.' where id='${SA}';`, asWriter);
  check("⚠ the run already accepted still carries the instructions it was started with",
    jget(`select body ->> 'instructions' from agent.run_entries where run_id='${R1}' and seq=0;`) === INSTR);

  const third = send(SA, MSG3, "and on sundays?", "key-3", R3);
  check("a later send carries the NEW instructions", /"ok"\s*:\s*true/.test(third)
    && jget(`select body ->> 'instructions' from agent.run_entries where run_id='${R3}' and seq=0;`)
       === "Completely different now.");
  check("...and the history holds the earlier turn WITH its answer",
    jget(`select body -> 'history' -> 0 ->> 'agent' from agent.run_entries where run_id='${R3}' and seq=0;`)
      === "[simulated] we open at nine");
  check("...in the order it was said",
    jget(`select (body -> 'history' -> 0 ->> 'user') || '|' || (body -> 'history' -> 1 ->> 'user')
           from agent.run_entries where run_id='${R3}' and seq=0;`) === "when do you open?|again");

  // ── the history read: three properties a sweep proved unguarded ───────
  //
  // THREE MUTANTS SURVIVED EVERY CHECK ABOVE AND NONE OF THEM WAS INERT: the newest
  // turns taken oldest-first, a turn whose run is gone dropped by an inner join, and
  // an unfinished run's text handed over as though it were an answer. They survived
  // because the conversation above is three turns long and every one of those turns
  // has a run — so the coverage could not reach the cases at all. That is the sweep
  // doing the one thing hand-written coverage cannot: reading the checks adversarially.
  //
  // EACH ON ITS OWN AGENT, so no count above moves. The prior conversation is
  // INSERTED rather than sent: what is under test here is the history READ, and every
  // check above already drives the writer.
  const SLONG  = "5a5a5a5a-0000-4000-8000-00000000a0ff";
  const LMSG   = "5a5a5a5a-0000-4000-8000-00000000ef01";
  const LRUN   = "5a5a5a5a-0000-4000-8000-00000000fb01";
  const TURNS  = Number(jget(`select agent.history_turns();`));
  check("the history bound is a number these checks can exceed",
    Number.isInteger(TURNS) && TURNS > 0, String(TURNS));
  allowed("an agent with a longer conversation than the window",
    `insert into agent.agents (id, tenant_id, name, instructions)
      values ('${SLONG}','t1','Long','Be brief.');`, asWriter);
  // TURNS + 3, so the window cannot reach the first turn however it is ordered.
  allowed("...and the turns behind it",
    `insert into agent.agent_messages (id, agent_id, body)
       select gen_random_uuid(), '${SLONG}', 'turn ' || g from generate_series(1, ${TURNS + 3}) g;`, asWriter);
  check("...all of them stored",
    jget(`select count(*) from agent.agent_messages where agent_id='${SLONG}';`) === String(TURNS + 3));
  const onLong = send(SLONG, LMSG, "and now?", "key-long", LRUN);
  check("a send on top of a long conversation is accepted", /"ok"\s*:\s*true/.test(onLong), onLong);
  check(`...and the history handed over is capped at the window (${TURNS})`,
    jget(`select jsonb_array_length(body -> 'history') from agent.run_entries
           where run_id='${LRUN}' and seq=0;`) === String(TURNS));
  // ⚠ THE NEWEST TURNS, AND THEN IN THE ORDER THEY WERE SAID. Ordered ascending
  // inside the window instead, a customer's long conversation is pinned to the first
  // screen it ever had and the model never sees what was just said to it.
  check("...and they are the NEWEST turns, oldest of them first",
    jget(`select (body -> 'history' -> 0 ->> 'user') || '|' || (body -> 'history' -> -1 ->> 'user')
           from agent.run_entries where run_id='${LRUN}' and seq=0;`)
      === `turn 4|turn ${TURNS + 3}`);
  check("...so the first turn of all is not in it",
    jget(`select count(*) from agent.run_entries e,
            jsonb_array_elements(e.body -> 'history') t
           where e.run_id='${LRUN}' and e.seq=0 and t ->> 'user' = 'turn 1';`) === "0");
  // ⚠ A TURN WHOSE RUN IS GONE IS STILL THE CONVERSATION THAT HAPPENED. Every turn
  // above is run-less — which is what an imported conversation looks like, and what a
  // retained-away run leaves behind — so an inner join answers an EMPTY history and
  // sends the model a conversation it never had, the customer's own questions missing.
  check("...and a turn with no run at all is handed over, with a null answer",
    jget(`select count(*) from agent.run_entries e,
            jsonb_array_elements(e.body -> 'history') t
           where e.run_id='${LRUN}' and e.seq=0 and t -> 'agent' = 'null'::jsonb;`) === String(TURNS));

  // ⚠ AND A STOP THAT IS NOT AN ANSWER CONTRIBUTES NO TEXT. `case when reason =
  // 'answered'` is the same rule `run.mjs` and `api.mjs` apply, in a third place and
  // deliberately: a run stopped by a bound may carry partial text, and passing that on
  // as the agent's answer puts words in its mouth it never finished saying. No stop the
  // engine writes today carries `text` unless it answered — so the fixture writes the
  // one that could, which is the whole reason the wall is there.
  const SSTOP = "5a5a5a5a-0000-4000-8000-00000000a0fe";
  const SM1   = "5a5a5a5a-0000-4000-8000-00000000ef02";
  const SR1   = "5a5a5a5a-0000-4000-8000-00000000fb02";
  const SM2   = "5a5a5a5a-0000-4000-8000-00000000ef03";
  const SR2   = "5a5a5a5a-0000-4000-8000-00000000fb03";
  allowed("an agent whose first run stopped without answering",
    `insert into agent.agents (id, tenant_id, name, instructions)
      values ('${SSTOP}','t1','Stopper','Be brief.');`, asWriter);
  check("its first send is accepted", /"ok"\s*:\s*true/.test(send(SSTOP, SM1, "are you there?", "key-s1", SR1)));
  psql(`insert into agent.run_entries (run_id, seq, body) values ('${SR1}', 1,
        ${shq('{"kind":"stopped","at":1700000000003,"stop":{"reason":"spent","bound":"steps","text":"half of an answ"}}')}::jsonb);`);
  check("...and its stop is projected as something other than an answer",
    jget(`select stop ->> 'reason' from agent.runs where id='${SR1}';`) === "spent");
  check("...carrying text all the same, which is what makes this checkable",
    jget(`select stop ->> 'text' from agent.runs where id='${SR1}';`) === "half of an answ");
  const afterStop = send(SSTOP, SM2, "still there?", "key-s2", SR2);
  check("the next send is accepted", /"ok"\s*:\s*true/.test(afterStop), afterStop);
  check("...and it is given that turn's QUESTION",
    jget(`select body -> 'history' -> 0 ->> 'user' from agent.run_entries
           where run_id='${SR2}' and seq=0;`) === "are you there?");
  check("...with NO answer, because that run never answered",
    jget(`select (body -> 'history' -> 0 -> 'agent' = 'null'::jsonb)::text
           from agent.run_entries where run_id='${SR2}' and seq=0;`) === "true");

  // ── the thread the screen draws ──────────────────────────────────────────
  //
  // `agent.agent_thread` is the ONE read behind a conversation: every message,
  // and the state of whatever run it started. It exists because the answer is
  // never copied into a message row — so a result has to be joined at read time,
  // and doing that in JavaScript over two requests would be a second place a
  // message could end up wearing another run's outcome.
  console.log("\n── the thread the screen draws ──");
  const SBMSG = "5a5a5a5a-0000-4000-8000-00000000ee0b";
  allowed("a message for the other account's agent, so the isolation checks below have an observer",
    `insert into agent.agent_messages (id, agent_id, body) values ('${SBMSG}','${SB}','theirs');`, asWriter);

  check("one row per message, never one per run or one per entry",
    jget(`select count(*) from agent.agent_thread where agent_id='${SA}';`) === "3",
    jget(`select count(*) from agent.agent_thread where agent_id='${SA}';`));
  check("a finished run's outcome arrives with its message",
    jget(`select run_status || '|' || (run_stop ->> 'reason') || '|' || (run_stop ->> 'text')
           from agent.agent_thread where id='${MSG1}';`) === `stopped|answered|${ANSWER}`,
    jget(`select coalesce(run_status,'<null>') || '|' || coalesce(run_stop ->> 'text','<null>')
           from agent.agent_thread where id='${MSG1}';`));
  check("...and its progress is the log's own highest step",
    jget(`select run_step from agent.agent_thread where id='${MSG1}';`) === "1");
  // ⚠ MEASURED, AND IT CORRECTED AN EXPECTATION WRITTEN HERE FIRST: a run that is
  // only QUEUED reads `running`, not `new`. `agent.runs.status` is projected off
  // the LOG by trigger, and `accept_run` writes the `started` entry in the same
  // transaction as the work row — so "a run has begun" is true from the instant it
  // is accepted, and `new` is reachable only for a run row with no log at all.
  //
  // **SO THE STEP IS WHAT SEPARATES QUEUED FROM WORKING, and that is the reading
  // the screen has to use**: `running` with no step is accepted and untouched;
  // `running` with a step is a run going through it. The queue's own row would say
  // it more directly and is deliberately NOT joined — `authenticated` has nothing
  // on `agent.run_work`, not even SELECT, so a `security_invoker` view reaching it
  // would answer NULL for every customer and read as a run that never started.
  check("a run that is only queued has begun but taken no step",
    jget(`select run_status || '|' || coalesce(run_stop::text,'<null>') || '|' || coalesce(run_step::text,'<null>')
           from agent.agent_thread where id='${MSG2}';`) === "running|<null>|<null>",
    jget(`select run_status from agent.agent_thread where id='${MSG2}';`));
  check("...and the queue is where its waiting really lives, unreadable through the view",
    jget(`select count(*) from agent.run_work where run_id='${R2}' and done_at is null and claimed_by is null;`) === "1");
  // A MESSAGE THAT NEVER STARTED ANYTHING IS STILL A MESSAGE — every imported
  // conversation is this shape, and a view that dropped it would delete somebody's
  // writing from their own screen.
  check("a message with no run at all is present with nothing beside it",
    jget(`select body || '|' || coalesce(run_id::text,'<null>') || '|' || coalesce(run_status,'<null>')
           from agent.agent_thread where id='${SBMSG}';`) === "theirs|<null>|<null>");
  check("the view carries the order the thread is read by",
    jget(`select count(distinct seq) from agent.agent_thread where agent_id='${SA}';`) === "3");
  // ⚠ A CENSUS OVER EVERY COLUMN THE STORE ASKS FOR, because a column the view does
  // not have is a 400 the customer reads as "couldn't load this conversation" — and
  // `run_model` really was missing from the first cut while every unit guard passed,
  // the fixture having answered a column the database did not have. Named one by one
  // rather than counted, so a rename is caught as well as a removal.
  for (const col of ["id", "agent_id", "seq", "body", "created_at", "run_id",
                     "run_status", "run_stop", "run_step", "run_model", "run_started_at", "run_stopped_at",
                     // THE TWO FACTS THAT TELL A WAITING RUN FROM A STRANDED ONE FROM A WORKING
                     // ONE. Missing, the store's reader answers `working` for all three — which
                     // is the defect they were added for, and the one `run_model` already
                     // records the shape of: a column the fixture had and the database did not.
                     "run_open_calls", "run_awaiting"]) {
    check(`the view carries ${col}`,
      jget(`select count(*) from information_schema.columns
             where table_schema='agent' and table_name='agent_thread' and column_name='${col}';`) === "1");
  }
  check("...and the model it answers is the run's own",
    jget(`select run_model from agent.agent_thread where id='${MSG1}';`) === "stand-in",
    jget(`select coalesce(run_model,'<null>') from agent.agent_thread where id='${MSG1}';`));

  // THE SAFETY ARGUMENT, DRIVEN — and here it spans three relations rather than
  // two, because `run_step` reaches the log as well.
  check("it is declared security_invoker",
    jget(`select (select count(*) from pg_options_to_table(c.reloptions)
                   where option_name = 'security_invoker' and option_value = 'true')
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'agent' and c.relname = 'agent_thread';`) === "1");
  check("a tenant reading the thread sees its own conversation, answer and all",
    psql(`select count(*) from agent.agent_thread where agent_id='${SA}' and run_stop is not null;`, claimT1).out === "1");
  // THE OBSERVER IS ALIVE: the account next door reads its own message through the
  // very same view, so the two zeros below are isolation and not an empty view.
  check("...and the other tenant reads its own, which is what makes the next line evidence",
    psql(`select count(*) from agent.agent_thread where agent_id='${SB}';`, claimT2).out === "1");
  check("neither tenant reads the other's conversation through the view",
    psql(`select count(*) from agent.agent_thread where agent_id='${SB}';`, claimT1).out === "0" &&
    psql(`select count(*) from agent.agent_thread where agent_id='${SA}';`, claimT2).out === "0");

  // ⚠ THE RUN IS A SECOND RELATION UNDER THE VIEW AND HAS ITS OWN POLICY, so a
  // pointer at a run that is not the reader's must answer NULL rather than a
  // status. Built as the OWNER because no legitimate path can make one — a run is
  // accepted under its own message's tenant — which is exactly why it has to be
  // driven rather than argued: this is the case `security_invoker` is for.
  const OTHER_RUN = "5a5a5a5a-0000-4000-8000-00000000fa0b";
  const CROSS_MSG = "5a5a5a5a-0000-4000-8000-00000000ee0c";
  psql(`insert into agent.runs (id, tenant_id, status) values ('${OTHER_RUN}','t2','running');`);
  psql(`insert into agent.agent_messages (id, agent_id, body, run_id)
          values ('${CROSS_MSG}','${SA}','whose run is this?','${OTHER_RUN}');`);
  check("the owner can see that pointer, which is what makes the next line about the policy",
    jget(`select run_status from agent.agent_thread where id='${CROSS_MSG}';`) === "running");
  check("⚠ a reader who owns the message but not the run gets NO status rather than another tenant's",
    psql(`select coalesce(run_status,'<null>') || '|' || coalesce(run_step::text,'<null>')
           from agent.agent_thread where id='${CROSS_MSG}';`, claimT1).out === "<null>|<null>");
  check("...and the message itself is still theirs to read",
    psql(`select body from agent.agent_thread where id='${CROSS_MSG}';`, claimT1).out === "whose run is this?");
  psql(`delete from agent.agent_messages where id='${CROSS_MSG}';`);
  psql(`delete from agent.runs where id='${OTHER_RUN}';`);

  check("no claims at all reads nothing through the thread",
    psql(`select count(*) from agent.agent_thread;`, { role: "authenticated", claims: "" }).out === "0");
  // ⚠ TWO DIFFERENT WALLS, AND A REFUSAL CAN ONLY ASK ONE OF THEM. `anon` holds no
  // USAGE on the schema, so every read as anon answers "permission denied for schema
  // agent" whatever table grants exist — which is exactly why GRANTING anon SELECT on
  // this view SURVIVED this file. MEASURED, by the SQL sweep. So the gate is NAMED, and
  // the grant is asked DIRECTLY: `has_table_privilege` reads the table privilege alone
  // and is the only reader here that can see that mutant at all.
  check("anon holds no select on the thread view",
    jget(`select has_table_privilege('anon','agent.agent_thread','select')::text;`) === "false");
  // ⚠ NOT `information_schema.role_table_grants` — it shows only grants whose grantee
  // or grantor is a CURRENTLY ENABLED role, and this runs as `postgres`, so it answered
  // 0 for `anon` AND 0 for `authenticated`: a negative assertion with a dead observer,
  // which is the trap this file's own rules name. The observer check is what caught it.
  // `pg_class.relacl` is the grant itself and does not care who is asking.
  const grantsTo = (role) => jget(`select count(*) from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
     where n.nspname = 'agent' and a.grantee = '${role}'::regrole;`);
  check("...nor anything else on any relation in the schema", grantsTo("anon") === "0");
  check("...with the same census reading the signed-in role's real grants, so it is alive",
    Number(grantsTo("authenticated")) > 0, grantsTo("authenticated"));
  refused("...and anon cannot reach the schema it lives in either",
    `select count(*) from agent.agent_thread;`, "permission denied for schema agent", { role: "anon" });

  // ── the role constraint, still one value ─────────────────────────────────
  refused("nothing can be stored as having come from the agent",
    `insert into agent.agent_messages (id, agent_id, role, body)
      values ('5a5a5a5a-0000-4000-8000-00000000eebb','${SA}','agent','I am the agent.');`,
    "agent_messages_role_check", asWriter);
  check("...so an answer is read from the run and never from a message row",
    jget(`select count(*) from agent.agent_messages where agent_id='${SA}' and role <> 'user';`) === "0");

  // ── who may call it ─────────────────────────────────────────────────────
  check("send_to_agent is the server's alone",
    jget(`select has_function_privilege('service_role','agent.send_to_agent(text,uuid,uuid,text,text,uuid)','execute')::text
          || '|' || has_function_privilege('authenticated','agent.send_to_agent(text,uuid,uuid,text,text,uuid)','execute')::text
          || '|' || has_function_privilege('anon','agent.send_to_agent(text,uuid,uuid,text,text,uuid)','execute')::text;`)
      === "true|false|false");

  // ── retention takes the run and leaves the writing ──────────────────────
  allowed("a run is retained away", `delete from agent.runs where id='${R1}';`, asWriter);
  check("⚠ the message it belonged to is still there",
    jget(`select body from agent.agent_messages where id='${MSG1}';`) === "when do you open?");
  check("...with its pointer cleared rather than dangling",
    jget(`select run_id is null from agent.agent_messages where id='${MSG1}';`) === "t");
  // AND THE SCREEN STILL DRAWS IT. A retained-away run takes its answer with it,
  // which is the honest outcome — what must not happen is the message vanishing
  // from the conversation along with it.
  check("...and the thread still draws it, with the answer gone rather than the message",
    jget(`select body || '|' || coalesce(run_status,'<null>') || '|' || coalesce(run_stop ->> 'text','<null>')
           from agent.agent_thread where id='${MSG1}';`) === "when do you open?|<null>|<null>");

  // ── the agent's settings, and what a run is allowed ──────────────────────
  //
  // Two columns and a refusal. What is proved here cannot be proved anywhere else:
  // a CHECK constraint, a default applied to rows that already existed, and a
  // function's behaviour when it must refuse without writing anything.
  console.log("\n── settings: a status and a selection of tools ──");
  const SN  = "5a5a5a5a-0000-4000-8000-00000000a0a9";   // t1's agent that named neither column
  const SP  = "5a5a5a5a-0000-4000-8000-00000000a0aa";   // t1's paused agent
  const ST  = "5a5a5a5a-0000-4000-8000-00000000a0bb";   // t1's agent with a tool
  const SBORN = "5a5a5a5a-0000-4000-8000-00000000a0cc"; // t1's agent CREATED paused
  const SJ  = "5a5a5a5a-0000-4000-8000-00000000a0dd";   // the id a refused create would have used
  const MSG6 = "5a5a5a5a-0000-4000-8000-00000000ee06";
  const MSG7 = "5a5a5a5a-0000-4000-8000-00000000ee07";
  const MSG8 = "5a5a5a5a-0000-4000-8000-00000000ee08";
  const R6  = "5a5a5a5a-0000-4000-8000-00000000fa06";
  const R7  = "5a5a5a5a-0000-4000-8000-00000000fa07";
  const R8  = "5a5a5a5a-0000-4000-8000-00000000fa08";

  // AN INSERT THAT NAMES NEITHER COLUMN IS THE CASE THE DEFAULTS ARE FOR, and it is
  // every agent on the platform: the writer that creates one does not know about
  // these columns. **`active` IS NOT A GUESS** — an agent somebody wrote before this
  // migration is one they expect to answer, and defaulting to `paused` would have
  // stopped every conversation there is.
  allowed("an agent inserted without naming either column",
    `insert into agent.agents (id, tenant_id, name, instructions)
      values ('${SN}','t1','Older',${shq(INSTR)});`, asWriter);
  check("...is active",
    jget(`select status from agent.agents where id='${SN}';`) === "active");
  check("...and one that named no tools may call nothing",
    jget(`select coalesce(array_length(tools,1),0)::text from agent.agents where id='${SN}';`) === "0");
  check("...with an empty selection rather than a null one, so there is no unknown state",
    // `::text` ON A BOOLEAN IS `true`, NOT `t` — psql's own `-t -A` rendering of an
    // uncast boolean is the single letter, and the cast asks Postgres for the word.
    // Compared against the wrong one, this read as a NULL selection on a column that
    // cannot hold one.
    jget(`select (tools is not null)::text from agent.agents where id='${SN}';`) === "true");

  // ⚠ AND AN INSERT THAT NAMES `status` IS THE OTHER HALF, which is what a create
  // really sends now. The pair is the whole of "default to active only when status
  // is omitted": the row above proves the DEFAULT, this one proves the column takes
  // an answer at creation rather than only at an update. The route dropped the field
  // for a day, so the only thing claiming an agent was paused was the checkbox.
  allowed("an agent inserted AS paused",
    `insert into agent.agents (id, tenant_id, name, instructions, status, tools)
      values ('${SBORN}','t1','Asleep',${shq(INSTR)},'paused',array['echo']);`, asWriter);
  check("...is paused from the moment it exists",
    jget(`select status from agent.agents where id='${SBORN}';`) === "paused");
  check("...with the selection it was created with",
    jget(`select array_to_string(tools,',') from agent.agents where id='${SBORN}';`) === "echo");
  // THE SAME CHECK GUARDS THE CREATE PATH, so a status the platform cannot read is
  // refused by the DATABASE even if every layer above it were to stop looking.
  refused("...and a status the schema does not know is refused at INSERT too",
    `insert into agent.agents (id, tenant_id, name, instructions, status)
      values ('${SJ}','t1','Junk',${shq(INSTR)},'asleep');`,
    "agents_status_check", asWriter);
  check("...with no row made",
    jget(`select count(*) from agent.agents where id='${SJ}';`) === "0");

  // ── the shape constraint ─────────────────────────────────────────────────
  // What it enforces is a SHAPE. Whether a name is a real tool is decided by a
  // positive lookup in code, so these refusals are about what could never be sent
  // to a model at all.
  refused("a status the schema does not know is refused",
    `update agent.agents set status='retired' where id='${SN}';`,
    "agents_status_check", asWriter);
  refused("...and so is an empty one",
    `update agent.agents set status='' where id='${SN}';`,
    "agents_status_check", asWriter);
  refused("a tool name outside the provider's own grammar is refused",
    `update agent.agents set tools=array['echo','has a space'] where id='${SN}';`,
    "agents_tools_shape", asWriter);
  refused("...and a NULL among the names is refused rather than stored",
    `update agent.agents set tools=array['echo',null]::text[] where id='${SN}';`,
    "agents_tools_shape", asWriter);
  refused("...and a name longer than a provider accepts",
    `update agent.agents set tools=array[repeat('e',65)] where id='${SN}';`,
    "agents_tools_shape", asWriter);
  refused("...and more names than one agent may hold",
    `update agent.agents set tools=(select array_agg('t' || g) from generate_series(1,33) g) where id='${SN}';`,
    "agents_tools_shape", asWriter);
  // THE CONTROLS, without which a table that refused every update would pass all six.
  allowed("the control: a real selection is stored", `update agent.agents set tools=array['echo'] where id='${SN}';`, asWriter);
  allowed("...and pausing is allowed", `update agent.agents set status='paused' where id='${SN}';`, asWriter);
  allowed("...and so is resuming", `update agent.agents set status='active', tools='{}'::text[] where id='${SN}';`, asWriter);
  // AND THE LIMIT IS THE STATED ONE, at its boundary rather than one either side.
  allowed("...and exactly the ceiling is allowed",
    `update agent.agents set tools=(select array_agg('t' || g) from generate_series(1,32) g) where id='${SN}';`, asWriter);
  psql(`update agent.agents set tools='{}'::text[] where id='${SN}';`, asWriter);

  // ── the selection reaches the run's own log ──────────────────────────────
  allowed("an agent with a tool selected",
    `insert into agent.agents (id, tenant_id, name, instructions, tools)
      values ('${ST}','t1','Tooled',${shq(INSTR)},array['echo']);`, asWriter);
  const tooled = send(ST, MSG6, "check the pipe", "key-tools", R6);
  check("its send is accepted", /"ok"\s*:\s*true/.test(tooled), tooled);
  check("⚠ and the run's first entry records the selection, so a later edit cannot reach it",
    jget(`select (body -> 'tools')::text from agent.run_entries where run_id='${R6}' and seq=0;`) === '["echo"]');
  // THE CONTROL that makes that line evidence: an agent with nothing ticked records
  // an EMPTY list, not an absent key — "allowed nothing" and "not an authored run"
  // are different facts and the engine reads them differently.
  const bare = send(SN, MSG7, "and this one", "key-bare", R7);
  check("...and an agent with nothing ticked records an empty list rather than no key",
    jget(`select (body -> 'tools')::text || '|' || (body ? 'tools')::text
           from agent.run_entries where run_id='${R7}' and seq=0;`) === "[]|true", bare);
  // AND THE EDIT REALLY CANNOT REACH IT. The column moves; the log does not.
  psql(`update agent.agents set tools='{}'::text[] where id='${ST}';`, asWriter);
  check("...and unticking it afterwards leaves the accepted run's own record alone",
    jget(`select (body -> 'tools')::text from agent.run_entries where run_id='${R6}' and seq=0;`) === '["echo"]');
  check("...while the agent itself now says what it says now",
    jget(`select coalesce(array_length(tools,1),0)::text from agent.agents where id='${ST}';`) === "0");

  // ── a paused agent refuses new work and cancels none ─────────────────────
  allowed("a paused agent",
    `insert into agent.agents (id, tenant_id, name, instructions, status)
      values ('${SP}','t1','Resting',${shq(INSTR)},'paused');`, asWriter);
  const paused = send(SP, MSG8, "are you there?", "key-paused", R8);
  check("the send is refused, and the refusal names itself",
    /"ok"\s*:\s*false/.test(paused) && /"error"\s*:\s*"paused"/.test(paused), paused);
  // ⚠ AND NOTHING AT ALL WAS WRITTEN. Saving the words would put a question in the
  // conversation that nothing will ever answer, and would spend the browser's own
  // retry key on it — so the typed text stays in the box instead.
  check("...and no message was stored",
    jget(`select count(*) from agent.agent_messages where id='${MSG8}';`) === "0");
  check("...and no run was accepted",
    jget(`select count(*) from agent.runs where id='${R8}';`) === "0");
  check("...and nothing reached the queue",
    jget(`select count(*) from agent.run_work where run_id='${R8}';`) === "0");
  // THE CONTROL: resuming it makes the same send work, so the refusal was the
  // status and not something else about this agent.
  psql(`update agent.agents set status='active' where id='${SP}';`, asWriter);
  const resumed = send(SP, MSG8, "are you there?", "key-paused", R8);
  check("the control: resuming it lets the same press through",
    /"ok"\s*:\s*true/.test(resumed) && /"repeat"\s*:\s*false/.test(resumed), resumed);

  // ⚠ A RETRY OF A PRESS THAT ALREADY LANDED IS STILL ABSORBED WHILE PAUSED — and
  // this is the order the whole pause rests on. The key is asked as a READ before
  // the status is asked, so a press whose answer was lost is answered with what it
  // produced however the agent is configured now. Refusing it would tell somebody
  // their message failed while it was being worked on, and would leave the
  // conversation showing it twice.
  psql(`update agent.agents set status='paused' where id='${SP}';`, asWriter);
  const pausedRetry = send(SP, "5a5a5a5a-0000-4000-8000-00000000ee09", "are you there?", "key-paused",
                     "5a5a5a5a-0000-4000-8000-00000000fa09");
  check("a retry of a press that landed is absorbed even though the agent is paused",
    /"ok"\s*:\s*true/.test(pausedRetry) && /"repeat"\s*:\s*true/.test(pausedRetry), pausedRetry);
  check("...answering the message it really made",
    new RegExp(`"message_id"\\s*:\\s*"${MSG8}"`).test(pausedRetry), pausedRetry);
  check("...and the run it really started",
    new RegExp(`"run_id"\\s*:\\s*"${R8}"`).test(pausedRetry), pausedRetry);
  check("...while minting nothing new",
    jget(`select count(*) from agent.runs where id='5a5a5a5a-0000-4000-8000-00000000fa09';`) === "0");
  // AND A PAUSE CANCELS NOTHING. The run accepted before the pause is untouched:
  // still on the queue, still with its log, because a pause blocks new work and
  // stopping work already asked for would be cancellation wearing a pause's clothes.
  check("⚠ and the run accepted before the pause is still there to be run",
    jget(`select count(*) from agent.run_work where run_id='${R8}' and done_at is null;`) === "1");
  check("...with its log intact",
    jget(`select count(*) from agent.run_entries where run_id='${R8}';`) === "1");
  check("...and its message still in the conversation",
    jget(`select body from agent.agent_messages where id='${MSG8}';`) === "are you there?");

  // ── two presses racing, in two transactions ──────────────────────────────
  //
  // ⚠ **THE PROBE MAKES THIS BRANCH REACHABLE ONLY UNDER REAL CONCURRENCY, which is
  // why it needed a real second session.** A second press in the SAME call finds the
  // row on the read and returns before the insert; what is left is the twin that has
  // inserted and NOT yet committed, where the probe sees nothing, the insert blocks
  // on the unique index, and `on conflict do nothing` is the only thing standing
  // between one message and two. A mutant that assumed the insert always won
  // SURVIVED every check above.
  // ⚠ IDS NOBODY ELSE IN THIS FILE USES, and asserted so rather than assumed:
  // `…ee0b` was already `SBMSG` three hundred lines up, so "the id this call would
  // have used was never written" was reading somebody else's row and reported a
  // correct product as broken. A fixture that collides is a fixture about the wrong
  // thing.
  const RACE = "5a5a5a5a-0000-4000-8000-00000000cc01";   // the twin's message
  const MINE = "5a5a5a5a-0000-4000-8000-00000000cc02";   // the id this call would mint
  const RRUN = "5a5a5a5a-0000-4000-8000-00000000cc03";
  check("the race fixture's ids are unused before it starts",
    jget(`select count(*) from agent.agent_messages where id in ('${RACE}','${MINE}');`) === "0"
    && jget(`select count(*) from agent.runs where id='${RRUN}';`) === "0");
  const twin = spawn("su", ["postgres", "-c",
    `psql -X -q -d ${DB} -c ${shq(`set role service_role; begin; ` +
      `insert into agent.agent_messages (id, agent_id, body, send_key) ` +
      `values ('${RACE}','${SN}','racing','key-race'); select pg_sleep(3); commit;`)}`],
    { stdio: "ignore", detached: true });
  // Long enough for the twin's INSERT to be in flight and short enough to be inside
  // its three-second hold — the window this branch lives in.
  try { execFileSync("sleep", ["1"], { stdio: "ignore" }); } catch { /* best effort */ }
  const raced = send(SN, MINE, "racing", "key-race", RRUN);
  check("a press that lost the race is absorbed rather than duplicated",
    /"ok"\s*:\s*true/.test(raced) && /"repeat"\s*:\s*true/.test(raced), raced);
  check("...answering the TWIN's message, not the one this call minted",
    new RegExp(`"message_id"\\s*:\\s*"${RACE}"`).test(raced), raced);
  check("...and the id this call would have used was never written",
    jget(`select count(*) from agent.agent_messages where id='${MINE}';`) === "0");
  check("...and there is exactly one message under that key",
    jget(`select count(*) from agent.agent_messages where agent_id='${SN}' and send_key='key-race';`) === "1");
  check("...and the loser started no run",
    jget(`select count(*) from agent.runs where id='${RRUN}';`) === "0");
  try { process.kill(-twin.pid, "SIGKILL"); } catch { try { twin.kill("SIGKILL"); } catch { /* gone */ } }

  // ── the list screen reads both, through the view ─────────────────────────
  check("the overview carries the status",
    jget(`select status from agent.agent_overview where id='${SP}';`) === "paused");
  check("...and the selection",
    jget(`select tools::text from agent.agent_overview where id='${ST}';`) === "{}");
  // ⚠ RE-ANCHORED FROM A COUNT ONTO THE ROWS THEMSELVES. It read `count(*) === "1"`,
  // which is a claim about how many fixtures this file happens to have paused —
  // adding one made it red for a reason that has nothing to do with tenancy. What it
  // is about is WHICH rows a tenant sees, so it names them, and the claim is
  // strictly stronger for it.
  const minePaused = jget(`select coalesce(string_agg(id::text, ',' order by id), '') from agent.agents
                             where tenant_id='t1' and status='paused';`);
  check("the observer is alive: t1 really has paused agents to see", minePaused.length > 0, minePaused);
  check("...and a tenant reads its own rows through it and no others",
    psql(`select coalesce(string_agg(id::text, ',' order by id), '') from agent.agent_overview
            where status='paused';`, claimT1).out === minePaused,
    psql(`select coalesce(string_agg(id::text, ',' order by id), '') from agent.agent_overview
            where status='paused';`, claimT1).out);
  check("...where the other tenant sees none of them",
    psql(`select count(*) from agent.agent_overview where status='paused';`,
         { role: "authenticated", claims: '{"tenant_id":"t2"}' }).out === "0");

  // ══════════════════════════════════════════════════════════════════════════
  // AUTOMATIONS: ONE EXECUTION PER OCCURRENCE, AND WHAT A REFUSAL LEAVES BEHIND
  //
  // The once-a-day guarantee is a PARTIAL UNIQUE INDEX, the snapshot is a column
  // written at acceptance, the catch-up window is arithmetic over local dates, and
  // the pause is a join. Not one of those is observable from a fake: the index needs
  // a real conflict, the local-date arithmetic needs a real time zone database, and
  // `security_invoker` on a view is only a fact about a real planner.
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── automations: what an account configures ──");
  const AG_ON = "aa000000-0000-0000-0000-0000000000a1";
  const AG_OFF = "aa000000-0000-0000-0000-0000000000a2";
  const AG_T2 = "aa000000-0000-0000-0000-0000000000a3";
  const AU1 = "bb000000-0000-0000-0000-0000000000b1";
  const AU2 = "bb000000-0000-0000-0000-0000000000b2";
  const AU_T2 = "bb000000-0000-0000-0000-0000000000b3";
  const STEPS = `'[{"id":"s1","type":"weekday","days":["mon"]},{"id":"s2","type":"note","text":"open up"}]'::jsonb`;
  allowed("an agent to hang automations on",
    `insert into agent.agents (id, tenant_id, name, instructions, status) values
       ('${AG_ON}','t1','Shop','help','active'),
       ('${AG_OFF}','t1','Resting','help','paused'),
       ('${AG_T2}','t2','Theirs','help','active');`, asOwner);

  const created = jget(`select agent.create_automation('t1','${AG_ON}','${AU1}','Daily note',
    true, 'daily', '09:00'::time, 'Europe/London', ${STEPS}, 20)::text;`);
  check("an automation is created and answers its own id", /"ok"\s*:\s*true/.test(created) && created.includes(AU1), created);
  // THE FIRST INSTANT IS COMPUTED AT CREATION, so a schedule is due without anything
  // having to notice it later.
  check("...with its first occurrence already computed",
    jget(`select next_run_at is not null from agent.automations where id='${AU1}';`) === "t");

  refused("a daily schedule with no time is not a schedule",
    `insert into agent.automations (id, tenant_id, agent_id, name, schedule, zone, next_run_at)
       values (gen_random_uuid(),'t1','${AG_ON}','x','daily','Europe/London', now());`,
    "automations_schedule_is_whole", asOwner);
  refused("...and a manual one carrying a time is a control nothing reads",
    `insert into agent.automations (id, tenant_id, agent_id, name, schedule, at_local)
       values (gen_random_uuid(),'t1','${AG_ON}','x','manual','09:00'::time);`,
    "automations_schedule_is_whole", asOwner);
  refused("a stored time is whole minutes",
    `insert into agent.automations (id, tenant_id, agent_id, name, schedule, at_local, zone, next_run_at)
       values (gen_random_uuid(),'t1','${AG_ON}','x','daily','09:00:30'::time,'UTC', now());`,
    "automations_at_is_whole_minutes", asOwner);
  refused("a workflow longer than the cap is refused by the COLUMN",
    `insert into agent.automations (id, tenant_id, agent_id, name, schedule, steps)
       values (gen_random_uuid(),'t1','${AG_ON}','x','manual',
               (select jsonb_agg(jsonb_build_object('type','note','text','x')) from generate_series(1,21)));`,
    "automations_steps_shaped", asOwner);
  allowed("THE CONTROL: a manual automation with no time and a workflow at the cap",
    `insert into agent.automations (id, tenant_id, agent_id, name, schedule, steps)
       values ('${AU2}','t1','${AG_ON}','Run on demand','manual',
               (select jsonb_agg(jsonb_build_object('type','note','text','x')) from generate_series(1,20)));`, asOwner);

  // THE CEILING IS THE CALLER'S, and it counts what this account already holds.
  const overCap = jget(`select agent.create_automation('t1','${AG_ON}',gen_random_uuid(),'One too many',
    true,'manual',null,null,'[]'::jsonb, 2)::text;`);
  check("the automation ceiling is enforced where the row is written", /"error"\s*:\s*"too-many"/.test(overCap), overCap);

  console.log("\n── automations: one execution per occurrence ──");
  const R_MAN1 = "cc000000-0000-0000-0000-0000000000c1";
  const R_MAN2 = "cc000000-0000-0000-0000-0000000000c2";
  const R_OCC1 = "cc000000-0000-0000-0000-0000000000c3";
  const R_OCC2 = "cc000000-0000-0000-0000-0000000000c4";
  const R_OCC3 = "cc000000-0000-0000-0000-0000000000c5";

  const man1 = jget(`select agent.accept_automation_run('t1','${AU1}','${R_MAN1}','manual',null)::text;`);
  check("a manual run is accepted", /"ok"\s*:\s*true/.test(man1) && /"repeat"\s*:\s*false/.test(man1), man1);
  check("...and it made a run", jget(`select count(*) from agent.runs where id='${R_MAN1}';`) === "1");
  // ⚠ **THE EXECUTOR IS SET IN THE SAME TRANSACTION AS THE WORK ROW**, so there is no
  // instant at which a consumer could claim this row and route it to the agent loop.
  check("...and the work row says which executor wants it",
    jget(`select executor from agent.run_work where run_id='${R_MAN1}';`) === "automation");
  check("...and the journal's first entry names the automation",
    jget(`select body->>'automation' from agent.run_entries where run_id='${R_MAN1}' and seq=0;`) === AU1);
  // AND THE COLUMN ADMITS THOSE TWO AND NOTHING ELSE: an executor this deployment has
  // no code for would be a work row nothing can ever run, sitting claimable for ever.
  refused("the executor column admits only the executors that exist",
    `update agent.run_work set executor='whatever' where run_id='${R_MAN1}';`,
    "run_work_executor_known", asOwner);
  // AND THE CLAIM ANSWERS IT — the one statement that says whose the work is.
  const claimed = jget(`select agent.claim_run('${R_MAN1}','w-auto',90)::text;`);
  check("the claim carries the executor, in the statement that says whose the work is",
    /"executor"\s*:\s*"automation"/.test(claimed), claimed);

  // A MANUAL RUN HAS NO OCCURRENCE, so the once-a-day index does not apply to it: two
  // presses of Run now are two executions, which is what the button means.
  const man2 = jget(`select agent.accept_automation_run('t1','${AU1}','${R_MAN2}','manual',null)::text;`);
  check("a second manual run is its own execution", /"repeat"\s*:\s*false/.test(man2), man2);
  check("...so the partial index really is partial",
    jget(`select count(*) from agent.automation_runs where automation_id='${AU1}' and occurrence is null;`) === "2");

  // ⚠ **AND A BARE `on conflict do nothing` IS ONLY SAFE WHILE THIS IS THE WHOLE LIST.**
  // `accept_automation_run` names no conflict target, because both of this table's unique
  // things mean the same fact — already filed — and a check constraint and a foreign key
  // are not absorbed by such a clause at all. **A THIRD unique thing added later would be
  // absorbed too, silently**, so the list is asserted rather than left in a comment.
  const uniques = jget(`select coalesce(string_agg(c.conname, ',' order by c.conname), '(none)')
                          from pg_constraint c
                         where c.conrelid = 'agent.automation_runs'::regclass
                           and c.contype in ('p','u','x');`);
  const uIx = jget(`select coalesce(string_agg(i.relname, ',' order by i.relname), '(none)')
                      from pg_index x join pg_class i on i.oid = x.indexrelid
                     where x.indrelid = 'agent.automation_runs'::regclass and x.indisunique;`);
  // ⚠ RE-ANCHORED, NOT APPEASED: it is THREE now, because an event is a third identity and
  // an occurrence is a DATE — two events of one day are two events, so the occurrence index
  // cannot serve for them. The PROPERTY is unchanged and is what matters: every unique thing
  // on this table means "already filed", and `accept_automation_run` PROBES each one before
  // the insert, so meeting any of them is an answer rather than an exception.
  check("⚠ automation_runs has exactly THREE unique things, and all three mean already-filed",
    uniques === "automation_runs_pkey" &&
    uIx === "automation_runs_one_per_event,automation_runs_one_per_occurrence,automation_runs_pkey",
    `${uniques} / ${uIx}`);
  // AND EACH ONE IS REALLY PROBED, read out of the function Postgres is running rather than
  // out of a file: an identity the insert can meet and the probe cannot see is an exception
  // where an answer belongs.
  const probes = jget(`select pg_get_functiondef(p.oid) from pg_proc p
                        join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'agent' and p.proname = 'accept_automation_run';`);
  check("...and the accept probes all three before it writes anything",
    /and occurrence = p_occurrence/.test(probes) && /and event_id = p_event_id/.test(probes) &&
    /and id = p_run_id/.test(probes),
    probes.slice(0, 120));

  // ⚠ **AND A MANUAL RUN RE-ACCEPTED UNDER THE SAME RUN ID IS A REPEAT — which is the
  // whole of what makes `run_automation` safe to repeat.** The tool DERIVES its run id
  // from the call it belongs to (`<run>:<step>:<index>:<the arguments' own hash>`), so a
  // redelivery asks for the execution it already made rather than a second one. Without
  // this the two lines above would be the whole story and the tool would need
  // `repeatable: false`, which is a control that holds, is approved, and then refuses.
  const manSame = jget(`select agent.accept_automation_run('t1','${AU1}','${R_MAN2}','manual',null)::text;`);
  check("⚠ the SAME manual run id asked for twice is one execution, not two",
    /"ok"\s*:\s*true/.test(manSame) && /"repeat"\s*:\s*true/.test(manSame), manSame);
  check("...answering the execution that was really filed", manSame.includes(R_MAN2), manSame);
  check("...and the second ask wrote nothing at all",
    jget(`select count(*) from agent.automation_runs where automation_id='${AU1}' and occurrence is null;`) === "2" &&
    jget(`select count(*) from agent.run_work where run_id='${R_MAN2}';`) === "1");

  const occ1 = jget(`select agent.accept_automation_run('t1','${AU1}','${R_OCC1}','schedule','2026-09-21'::date)::text;`);
  check("a scheduled occurrence is accepted once", /"repeat"\s*:\s*false/.test(occ1), occ1);
  // ⚠ **THE DUPLICATE LOSES IN THE DATABASE.** A second tick, a redelivered tick and a
  // hand-run of the same minute all arrive here, and every one of them loses on one
  // index with its insert a no-op — not on a check in the scheduler, which would be a
  // race wearing a wall's clothes.
  const occDup = jget(`select agent.accept_automation_run('t1','${AU1}','${R_OCC2}','schedule','2026-09-21'::date)::text;`);
  check("...and a second accept for the SAME occurrence is a repeat", /"repeat"\s*:\s*true/.test(occDup), occDup);
  check("...answering the run id that was really filed", occDup.includes(R_OCC1), occDup);
  check("...and the id it would have used was never written",
    jget(`select count(*) from agent.runs where id='${R_OCC2}';`) === "0");
  check("...and no second work row was made",
    jget(`select count(*) from agent.run_work where run_id='${R_OCC2}';`) === "0");
  check("...leaving exactly one execution for that day",
    jget(`select count(*) from agent.automation_runs where automation_id='${AU1}' and occurrence='2026-09-21';`) === "1");
  // THE CONTROL: the NEXT day is a different occurrence and is accepted, so the
  // refusal above is about the occurrence and not about the automation being spent.
  const occNext = jget(`select agent.accept_automation_run('t1','${AU1}','${R_OCC3}','schedule','2026-09-22'::date)::text;`);
  check("THE CONTROL: the next day is a new execution", /"repeat"\s*:\s*false/.test(occNext), occNext);

  // ⚠ **THE RACING TWIN, AND IT IS THE ONLY PATH THE RE-READ IS ON.** Every check above
  // reaches the duplicate through the PROBE — the occurrence is already committed, so
  // the insert is never attempted. What that leaves undriven is the case the unique
  // index exists for: two transactions inserting the same occurrence at the same
  // instant, where the loser's `on conflict do nothing` returns NO ROW and has to go
  // back and read what the winner filed. A sweep said so: `v_new := true` survived
  // every sequential check in this file, and under it the loser would have created a
  // SECOND run for the same day — the whole once-a-day guarantee, gone, only under
  // concurrency.
  const RACE_OCC = "2026-09-24";
  const RACE_A = "cc000000-0000-0000-0000-0000000000ca";
  const RACE_B = "cc000000-0000-0000-0000-0000000000cb";
  {
    // The winner accepts inside an open transaction and sleeps holding it.
    const winner = spawn("su", ["postgres", "-c",
      `psql -X -q -d ${DB} -c ${shq(`begin; select agent.accept_automation_run('t1','${AU1}','${RACE_A}','schedule','${RACE_OCC}'::date); select pg_sleep(6); commit;`)}`],
      { stdio: "ignore", detached: true });
    // WAIT FOR THE INSERT TO HAVE HAPPENED, not for a guessed number of milliseconds:
    // the row is uncommitted and invisible, so what is polled for is the table lock the
    // insert takes. A fixed pause would make this flaky in the direction that reports
    // the product as broken.
    let waited = 0;
    const holding = () => psql(`select count(*) from pg_locks l
        join pg_class c on c.oid = l.relation
        join pg_stat_activity a on a.pid = l.pid
       where c.relname = 'automation_runs' and l.mode = 'RowExclusiveLock' and l.granted
         and a.pid <> pg_backend_pid();`).out;
    while (waited < 8000 && holding() === "0") {
      try { execFileSync("sleep", ["0.2"], { stdio: "ignore" }); } catch { /* best effort */ }
      waited += 200;
    }
    check("the observer is alive: a twin really is holding an uncommitted occurrence", holding() !== "0");
    // The loser asks for the SAME occurrence under its own run id. It blocks on the
    // index until the winner commits, and then has to answer about the winner's row.
    const raced = jget(`select agent.accept_automation_run('t1','${AU1}','${RACE_B}','schedule','${RACE_OCC}'::date)::text;`);
    check("a racing twin is told the occurrence is already filed", /"repeat"\s*:\s*true/.test(raced), raced);
    check("...answering the WINNER's run id, not the one it minted", raced.includes(RACE_A), raced);
    check("...and the id it would have used was never written",
      jget(`select count(*) from agent.runs where id='${RACE_B}';`) === "0");
    check("...and it started no work",
      jget(`select count(*) from agent.run_work where run_id='${RACE_B}';`) === "0");
    check("...leaving exactly one execution for that day",
      jget(`select count(*) from agent.automation_runs where automation_id='${AU1}' and occurrence='${RACE_OCC}';`) === "1");
    try { process.kill(-winner.pid, "SIGKILL"); } catch { try { winner.kill("SIGKILL"); } catch { /* gone */ } }
  }

  refused("a scheduled execution without an occurrence is a row the guarantee cannot see",
    `insert into agent.automation_runs (id, automation_id, tenant_id, trigger, occurrence, steps)
       values ('${"dd000000-0000-0000-0000-0000000000d1"}','${AU1}','t1','schedule',null,'[]'::jsonb);`,
    "automation_runs_occurrence_matches_trigger", asOwner);

  // ⚠ **THE FOREIGN KEY IS DEFERRED, NOT ABSENT — and that distinction is the whole
  // reason `accept_automation_run` can probe the occurrence BEFORE it makes the run.**
  // A deferred constraint that had been dropped instead would let an execution point at
  // nothing for ever, so it is checked at COMMIT rather than not at all.
  const orphan = psqlSession([
    `insert into agent.automation_runs (id, automation_id, tenant_id, trigger, occurrence, steps)
       values ('${"dd000000-0000-0000-0000-0000000000d2"}','${AU1}','t1','schedule','2030-01-01'::date,'[]'::jsonb);`,
  ], asOwner);
  check("an execution naming no run is refused at COMMIT — the FK is deferred, not gone",
    !orphan.ok && /automation_runs_id_fkey|foreign key/i.test(orphan.err), orphan.err.split("\n")[0]);

  console.log("\n── automations: the configuration is the one recorded at acceptance ──");
  // **AN EDIT REACHES THE NEXT EXECUTION AND NEVER THIS ONE.** The steps are copied into
  // the execution when it is accepted, which is what makes "already-accepted work keeps
  // its recorded workflow" a property of the schema rather than of a convention.
  const edited = jget(`select agent.update_automation('t1','${AU1}','Renamed', true, 'daily','09:00'::time,'Europe/London',
    '[{"id":"s1","type":"note","text":"CHANGED"}]'::jsonb)::text;`);
  check("the automation is edited", /"ok"\s*:\s*true/.test(edited), edited);
  check("...and the execution accepted before the edit still holds what it was given",
    jget(`select steps::text from agent.automation_runs where id='${R_OCC1}';`).includes("open up"));
  check("...where an execution accepted AFTER it holds the new configuration",
    jget(`select agent.accept_automation_run('t1','${AU1}','${"cc000000-0000-0000-0000-0000000000c6"}','schedule','2026-09-23'::date)::text;`)
    !== "" && jget(`select steps::text from agent.automation_runs where occurrence='2026-09-23';`).includes("CHANGED"));

  console.log("\n── automations: a refusal leaves the world exactly as it was ──");
  // ⚠ NOTHING IS WRITTEN ON EITHER REFUSAL — not the execution, not a run, not a work
  // row — or turning something back on would find work nobody asked for waiting.
  const AU_OFF = "bb000000-0000-0000-0000-0000000000b4";
  const AU_PAUSED = "bb000000-0000-0000-0000-0000000000b5";
  allowed("a disabled automation, and one on a paused agent",
    `insert into agent.automations (id, tenant_id, agent_id, name, enabled, schedule) values
       ('${AU_OFF}','t1','${AG_ON}','Off', false, 'manual'),
       ('${AU_PAUSED}','t1','${AG_OFF}','On a resting agent', true, 'manual');`, asOwner);
  for (const [what, id, reason] of [["disabled", AU_OFF, "disabled"], ["on a paused agent", AU_PAUSED, "paused"]]) {
    const runId = `ee000000-0000-0000-0000-00000000${reason === "disabled" ? "e001" : "e002"}`;
    const answer = jget(`select agent.accept_automation_run('t1','${id}','${runId}','manual',null)::text;`);
    check(`an automation ${what} refuses, by name`, new RegExp(`"error"\\s*:\\s*"${reason}"`).test(answer), answer);
    check(`...and wrote no execution`, jget(`select count(*) from agent.automation_runs where id='${runId}';`) === "0");
    check(`...no run`, jget(`select count(*) from agent.runs where id='${runId}';`) === "0");
    check(`...and nothing on the queue`, jget(`select count(*) from agent.run_work where run_id='${runId}';`) === "0");
  }
  // OWNERSHIP IS ENFORCED WHERE THE WRITE HAPPENS, and another account's automation
  // reads the same as one that does not exist.
  allowed("an automation belonging to the other account",
    `insert into agent.automations (id, tenant_id, agent_id, name, schedule)
       values ('${AU_T2}','t2','${AG_T2}','Theirs','manual');`, asOwner);
  // ⚠ NAMED `autoStranger` RATHER THAN `stranger`: this file already has one, and a
  // re-anchor that lands in a scope it did not write makes `node --test` report the
  // WHOLE file as one failing test — the recorded shape, met while writing this block.
  const autoStranger = jget(`select agent.accept_automation_run('t1','${AU_T2}','${"ee000000-0000-0000-0000-0000000000e3"}','manual',null)::text;`);
  check("a stranger cannot start another account's automation", /"error"\s*:\s*"no-automation"/.test(autoStranger), autoStranger);
  check("...and cannot tell it from one that is not there",
    /"error"\s*:\s*"no-automation"/.test(
      jget(`select agent.accept_automation_run('t1','${"bb000000-0000-0000-0000-00000000ffff"}','${"ee000000-0000-0000-0000-0000000000e4"}','manual',null)::text;`)));

  console.log("\n── automations: finishing is fenced, like every other write ──");
  const tokenOf = (id) => `(select claim_token from agent.run_work where run_id='${id}')`;
  const wrongFinish = jget(`select agent.finish_automation_run('${R_MAN1}','w-auto',
    '00000000-0000-0000-0000-000000000000'::uuid, '[]'::jsonb, '{"reason":"done"}'::jsonb)::text;`);
  check("a finish under the wrong token is refused", /"ok"\s*:\s*false/.test(wrongFinish), wrongFinish);
  check("...and wrote no outcomes",
    jget(`select outcomes::text from agent.automation_runs where id='${R_MAN1}';`) === "[]");
  check("...and left the run running",
    jget(`select status from agent.runs where id='${R_MAN1}';`) === "running");
  const rightFinish = jget(`select agent.finish_automation_run('${R_MAN1}','w-auto', ${tokenOf(R_MAN1)},
    '[{"id":"s1","outcome":"ran"}]'::jsonb, '{"reason":"done","result":"open up"}'::jsonb)::text;`);
  check("THE CONTROL: the holder's own token finishes it", /"ok"\s*:\s*true/.test(rightFinish), rightFinish);
  check("...writing the outcomes",
    jget(`select outcomes::text from agent.automation_runs where id='${R_MAN1}';`).includes('"ran"'));
  check("...stopping the run through its own journal",
    jget(`select status from agent.runs where id='${R_MAN1}';`) === "stopped");
  check("...with the result readable off the run, not copied into the execution",
    jget(`select stop->>'result' from agent.runs where id='${R_MAN1}';`) === "open up");
  check("...and taking the work off the queue",
    jget(`select done_at is not null from agent.run_work where run_id='${R_MAN1}';`) === "t");
  check("...and the execution has no status column of its own to disagree with it",
    jget(`select count(*) from information_schema.columns
           where table_schema='agent' and table_name='automation_runs'
             and column_name in ('status','result','error');`) === "0");

  console.log("\n── automations: the schedule, downtime, and daylight saving ──");
  // THE TWO MEASURED CASES. A local time either does not exist on the spring day or
  // happens twice on the autumn one, and both are properties of a real time zone
  // database rather than of arithmetic anybody can reason out.
  check("a daily 09:00 in London lands at 08:00Z in summer",
    jget(`select to_char(agent.automation_next_at('09:00'::time,'Europe/London','2026-06-01 10:00+00'::timestamptz)
            at time zone 'UTC','YYYY-MM-DD HH24:MI');`) === "2026-06-02 08:00");
  check("...and at 09:00Z in winter, without the row changing",
    jget(`select to_char(agent.automation_next_at('09:00'::time,'Europe/London','2026-12-01 10:00+00'::timestamptz)
            at time zone 'UTC','YYYY-MM-DD HH24:MI');`) === "2026-12-02 09:00");
  // ⚠ **AND TODAY'S OWN OCCURRENCE IS A DIFFERENT BRANCH, which a sweep had to point
  // out.** Both checks above are asked from AFTER the local time, so both fall through
  // to the "tomorrow" return and the candidate line is never the answer — a mutant that
  // read the candidate in UTC survived them both. Asked from BEFORE it, today's 09:00
  // London is 08:00Z and the candidate line IS the answer.
  check("asked before the time, it answers TODAY's occurrence, still in the right zone",
    jget(`select to_char(agent.automation_next_at('09:00'::time,'Europe/London','2026-06-01 06:00+00'::timestamptz)
            at time zone 'UTC','YYYY-MM-DD HH24:MI');`) === "2026-06-01 08:00");
  check("...and in winter, where the same clock time is an hour later in UTC",
    jget(`select to_char(agent.automation_next_at('09:00'::time,'Europe/London','2026-12-01 06:00+00'::timestamptz)
            at time zone 'UTC','YYYY-MM-DD HH24:MI');`) === "2026-12-01 09:00");
  // A LOCAL TIME THAT DOES NOT EXIST still has to answer an instant, or the spring
  // forward would stop an automation for ever.
  check("a local time inside the spring-forward gap still answers an instant",
    jget(`select agent.automation_next_at('01:30'::time,'Europe/London','2027-03-27 12:00+00'::timestamptz) is not null;`) === "t");

  const AU_DUE = "bb000000-0000-0000-0000-0000000000b6";
  const AU_STALE = "bb000000-0000-0000-0000-0000000000b7";
  allowed("one automation due now and one a week overdue",
    `insert into agent.automations (id, tenant_id, agent_id, name, enabled, schedule, at_local, zone, next_run_at) values
       ('${AU_DUE}','t1','${AG_ON}','Due', true,'daily','09:00'::time,'UTC', now() - interval '1 minute'),
       ('${AU_STALE}','t1','${AG_ON}','Stale', true,'daily','09:00'::time,'UTC', now() - interval '7 days');`, asOwner);
  const ticked = jget(`select coalesce(jsonb_agg(t), '[]'::jsonb)::text from agent.tick_automations(3600, 25) t;`);
  check("the tick files what is fresh", /"action"\s*:\s*"filed"/.test(ticked), ticked);
  // ⚠ **DOWNTIME IS NOT A BURST.** A week away produces ONE record saying how many
  // occurrences went by — not seven executions on a customer's schedule.
  check("...and records what is stale as MISSED rather than running it",
    /"action"\s*:\s*"missed"/.test(ticked), ticked);
  check("...counting the occurrences that went by, in LOCAL DATES",
    /"occurrences"\s*:\s*[2-9]/.test(ticked), ticked);
  check("...leaving exactly one record for the week, not one per day",
    jget(`select count(*) from agent.automation_runs where automation_id='${AU_STALE}';`) === "1");
  check("...with no work row, because nothing is going to run it",
    jget(`select count(*) from agent.run_work w join agent.automation_runs r on r.id = w.run_id
           where r.automation_id='${AU_STALE}';`) === "0");
  check("...and the missed record is finished, so the history shows it",
    jget(`select finished_at is not null from agent.automation_runs where automation_id='${AU_STALE}';`) === "t");
  // BOTH ROWS ADVANCE PAST WHAT WAS HANDLED, which is what stops the next tick
  // filing the same day again.
  check("every automation the tick touched is advanced into the future",
    jget(`select count(*) from agent.automations where id in ('${AU_DUE}','${AU_STALE}') and next_run_at > now();`) === "2");
  check("...so a second tick a moment later finds nothing",
    jget(`select count(*) from agent.tick_automations(3600, 25);`) === "0");

  console.log("\n── automations: an account reads its own, through an invoker view ──");
  // `security_invoker` IS THE WHOLE SAFETY ARGUMENT for a view over two RLS tables:
  // without it the view runs as its OWNER and is a hole through both policies.
  check("the history view is security_invoker",
    jget(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='agent' and c.relname='automation_history'
             and c.reloptions::text like '%security_invoker=%true%';`) === "1");
  const mineAutos = jget(`select coalesce(string_agg(id::text, ',' order by id),'') from agent.automations where tenant_id='t1';`);
  check("the observer is alive: t1 really has automations to see", mineAutos.length > 0, mineAutos);
  check("...and a tenant reads exactly its own",
    psql(`select coalesce(string_agg(id::text, ',' order by id),'') from agent.automations;`, claimT1).out === mineAutos);
  check("...where the other account sees none of them",
    psql(`select count(*) from agent.automations where tenant_id='t1';`, claimT2).out === "0");
  check("an account reads its own execution history through the view",
    Number(psql(`select count(*) from agent.automation_history;`, claimT1).out) > 0);
  check("...and none of the other account's",
    psql(`select count(*) from agent.automation_history where tenant_id='t1';`, claimT2).out === "0");
  // A CUSTOMER MAY READ AND NEVER WRITE. The executions are the platform's record of
  // what ran; an account that could edit one could rewrite its own history.
  refused("an account cannot write an execution of its own",
    `insert into agent.automation_runs (id, automation_id, tenant_id, trigger, steps)
       values (gen_random_uuid(),'${AU1}','t1','manual','[]'::jsonb);`, "denied", claimT1);
  refused("...nor delete one", `delete from agent.automation_runs where id='${R_MAN1}';`, "denied", claimT1);

  // ══════════════════════════════════════════════════════════════════════════
  // WAITING, APPROVING AND RESUMING — what a suspended execution may do
  //
  // A suspended execution is the one state in this schema where a row is meant to sit
  // still, off the queue, holding nothing. Everything below is about what may and may
  // not happen to it while nobody is running it, and each is driven through the real
  // function rather than read off the migration.
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── waiting: progress moves forward only, and a pause releases ──");
  const R_W1 = "cc000000-0000-0000-0000-0000000000d1";
  const WSTEPS = `'[{"id":"s1","type":"note","text":"one"},{"id":"s2","type":"approval","ask":"ok?","hours":24,"on_timeout":"reject"},{"id":"s3","type":"note","text":"two"}]'::jsonb`;
  allowed("an automation with an approval in it",
    `update agent.automations set steps = ${WSTEPS} where id='${AU2}';`, asOwner);
  const acc = jget(`select agent.accept_automation_run('t1','${AU2}','${R_W1}','manual',null)::text;`);
  check("an execution to suspend", /"ok"\s*:\s*true/.test(acc), acc);
  const hold = jget(`select agent.claim_run('${R_W1}','w-1',90)::text;`);
  const TOK = (JSON.parse(hold).claim_token ?? "").trim();
  check("...claimed, with a token", TOK.length > 0, hold);

  // ONE STEP DONE, THEN THE PAUSE — the two calls a real delivery makes.
  const adv1 = jget(`select agent.advance_automation_run('${R_W1}','w-1','${TOK}',
    '{"kind":"step","step":1,"at":1,"mark":"progress","done":1}'::jsonb, 1,
    '{"a":"one"}'::jsonb, '[{"id":"s1","outcome":"ran"}]'::jsonb, null)::text;`);
  check("a step's progress is recorded and the row moves",
    /"ok"\s*:\s*true/.test(adv1) && /"advanced"\s*:\s*true/.test(adv1), adv1);
  const adv2 = jget(`select agent.advance_automation_run('${R_W1}','w-1','${TOK}',
    '{"kind":"step","step":1,"at":1,"mark":"waiting","done":2}'::jsonb, 1,
    '{"a":"one"}'::jsonb, '[{"id":"s1","outcome":"ran"},{"id":"s2","outcome":"waiting"}]'::jsonb,
    '{"kind":"approval","step":"s2","ask":"ok?","hours":24,"on_timeout":"reject"}'::jsonb)::text;`);
  check("...and a pause resolves its deadline from the hours it was given",
    /"waiting"\s*:\s*true/.test(adv2) && /"released"\s*:\s*true/.test(adv2), adv2);
  check("...23 hours out at least, which is the database's own arithmetic",
    jget(`select wait_until > now() + interval '23 hours' from agent.automation_runs where id='${R_W1}';`) === "t");
  // ⚠ THE WORKER IS RELEASED AND THE WORK IS OFF THE QUEUE — a suspended execution
  // holds nothing at all, which is what makes waiting free.
  check("⚠ the worker is released and the work is done",
    jget(`select coalesce(claimed_by,'-') || '|' || (done_at is not null)::text
            from agent.run_work where run_id='${R_W1}';`) === "-|true");
  check("...and the journal holds one entry per event, the pause included",
    jget(`select string_agg((body->>'step') || ':' || (body->>'mark'), ',' order by seq)
            from agent.run_entries where run_id='${R_W1}' and body->>'kind'='step';`) === "1:progress,1:waiting");

  // ⚠ PROGRESS MAY ONLY MOVE FORWARD. A stale worker re-delivering an older position
  // must not rewind an execution that has already gone further.
  // ⚠ IT HAS TO BE RE-QUEUED FIRST. The pause RELEASED the work — that is the whole
  // point of it — so `claim_run` refuses a suspended execution, which is correct and is
  // what made the first draft of this check hand an empty token to the transaction.
  const cannot = jget(`select agent.claim_run('${R_W1}','w-2',90)::text;`);
  check("⚠ a suspended execution cannot be claimed — the work is off the queue",
    /"claimed"\s*:\s*false/.test(cannot), cannot);
  jget(`select agent.requeue_run('${R_W1}','t1')::text;`);
  const claim2 = jget(`select agent.claim_run('${R_W1}','w-2',90)::text;`);
  const TOK2 = (JSON.parse(claim2).claim_token ?? "").trim();
  const stale = jget(`select agent.advance_automation_run('${R_W1}','w-2','${TOK2}',
    '{"kind":"step","step":0,"at":9,"mark":"progress","done":0}'::jsonb, 0,
    '{}'::jsonb, '[]'::jsonb, null)::text;`);
  check("⚠ a stale advance does NOT move the row", /"advanced"\s*:\s*false/.test(stale), JSON.stringify(stale));
  check("...so the position and the values are the ones that were really reached",
    jget(`select position || '|' || (vars->>'a') from agent.automation_runs where id='${R_W1}';`) === "1|one");

  /**
   * ⚠ **AND A LOWER POSITION WITH MORE OUTCOMES DOES MOVE IT — which is a LOOP's second
   * round, and is the case a position guard makes impossible.**
   *
   * This guard used to carry `position <= p_position` as well, and that half asserted a
   * defect: a `repeat` re-enters its body BELOW the high-water mark the first round reached,
   * so every checkpoint inside round two was a silent no-op and the execution was stranded
   * at the position after the loop with nothing waiting and nothing finished. MEASURED end
   * to end before it was fixed. The stale case above is the CONTROL: fewer outcomes is still
   * refused, which is what the guard was ever for.
   */
  // ⚠ ITS OWN ID: `…d3` is `R_M1`'s, five hundred lines down, and reusing it failed two
  // checks about memory snapshots. The third instance of that collision in this one long body.
  const R_LOOP = "cc000000-0000-0000-0000-0000000000e7";
  jget(`select agent.accept_automation_run('t1','${AU2}','${R_LOOP}','manual',null)::text;`);
  const holdL = jget(`select agent.claim_run('${R_LOOP}','w-l',90)::text;`);
  const TOKL = (JSON.parse(holdL).claim_token ?? "").trim();
  jget(`select agent.advance_automation_run('${R_LOOP}','w-l','${TOKL}',
    '{"kind":"step","step":2,"at":20,"mark":"progress","done":2}'::jsonb, 2,
    '{}'::jsonb, '[{"id":"s1","outcome":"ran"},{"id":"s2","outcome":"ran"}]'::jsonb, null)::text;`);
  const backwards = jget(`select agent.advance_automation_run('${R_LOOP}','w-l','${TOKL}',
    '{"kind":"step","step":1,"at":21,"mark":"progress","done":3}'::jsonb, 1,
    '{}'::jsonb,
    '[{"id":"s1","outcome":"ran"},{"id":"s2","outcome":"ran"},{"id":"s2#1.1","outcome":"ran"}]'::jsonb,
    null, '{"s1":{"at":1,"of":2,"list":[],"as":null}}'::jsonb)::text;`);
  check("⚠ a LOWER position with MORE outcomes does move it — a loop's second round",
    /"advanced"\s*:\s*true/.test(backwards), JSON.stringify(backwards));
  check("...and the row really went back to that position, with the extra outcome recorded",
    jget(`select position || '|' || jsonb_array_length(outcomes) || '|' || (loops->'s1'->>'at')
            from agent.automation_runs where id='${R_LOOP}';`) === "1|3|1");
  const fewer = jget(`select agent.advance_automation_run('${R_LOOP}','w-l','${TOKL}',
    '{"kind":"step","step":9,"at":22,"mark":"progress","done":1}'::jsonb, 9,
    '{}'::jsonb, '[{"id":"s1","outcome":"ran"}]'::jsonb, null)::text;`);
  check("⚠ THE CONTROL: FEWER outcomes is still refused, however far forward the position",
    /"advanced"\s*:\s*false/.test(fewer), JSON.stringify(fewer));
  check("...so the row is where the loop really left it",
    jget(`select position || '|' || jsonb_array_length(outcomes) from agent.automation_runs where id='${R_LOOP}';`) === "1|3");
  // ⚠ AND THE LOOP STATE IS REFUSED RATHER THAN COERCED: cannot-tell must never read as
  // "no loops", which would tell the next delivery that a loop is at its beginning.
  const OUT3 = `'[{"id":"s1","outcome":"ran"},{"id":"s2","outcome":"ran"},{"id":"s2#1.1","outcome":"ran"}]'::jsonb`;
  refused("⚠ a loop state that is not an object is REFUSED by name",
    `select agent.advance_automation_run('${R_LOOP}','w-l','${TOKL}',
      '{"kind":"step","step":1,"at":23,"mark":"progress","done":3}'::jsonb, 1,
      '{}'::jsonb, ${OUT3}, null, '[]'::jsonb);`,
    "loop state must be an object", asWriter);
  refused("...and so are the attempt counts",
    `select agent.advance_automation_run('${R_LOOP}','w-l','${TOKL}',
      '{"kind":"step","step":1,"at":24,"mark":"progress","done":3}'::jsonb, 1,
      '{}'::jsonb, ${OUT3}, null, '{}'::jsonb, 'null'::jsonb);`,
    "attempt counts must be an object", asWriter);
  allowed("THE CONTROL: the same call with both of them shaped right is accepted",
    `select agent.advance_automation_run('${R_LOOP}','w-l','${TOKL}',
      '{"kind":"step","step":1,"at":25,"mark":"progress","done":3}'::jsonb, 1,
      '{}'::jsonb, ${OUT3}, null, '{}'::jsonb, '{}'::jsonb);`, asWriter);
  jget(`select agent.release_run('${R_LOOP}','w-l','${TOKL}',true,null)::text;`);

  // ⚠ A RE-PAUSE KEEPS THE DEADLINE IT ALREADY HAS. Resolving it again from now would
  // let a duplicate delivery extend a wait indefinitely — a duplicate doing harm.
  const before = jget(`select wait_until::text from agent.automation_runs where id='${R_W1}';`);
  jget(`select agent.advance_automation_run('${R_W1}','w-2','${TOK2}',
    '{"kind":"step","step":1,"at":10,"mark":"waiting","done":2}'::jsonb, 1,
    '{"a":"one"}'::jsonb, '[{"id":"s1","outcome":"ran"},{"id":"s2","outcome":"waiting"}]'::jsonb,
    '{"kind":"approval","step":"s2","ask":"ok?","hours":24,"on_timeout":"reject"}'::jsonb)::text;`);
  check("⚠ a RE-PAUSE at the same step does not restart the clock",
    jget(`select wait_until::text from agent.automation_runs where id='${R_W1}';`) === before, before);

  console.log("\n── approving: one answer stands, and it must be waiting for it ──");
  const yes = jget(`select agent.decide_automation_approval('t1','${R_W1}','s2','approved','looks right','u1')::text;`);
  check("a decision is accepted and puts the work back on the queue",
    /"ok"\s*:\s*true/.test(yes) && /"queued"\s*:\s*"queued"/.test(yes), yes);
  check("...recorded with who answered and what they said",
    jget(`select (decisions->'s2'->>'verdict') || '|' || (decisions->'s2'->>'note') || '|' || (decisions->'s2'->>'by')
            from agent.automation_runs where id='${R_W1}';`) === "approved|looks right|u1");
  // ⚠ THE FIRST DECISION STANDS. By the time a second press arrives the execution may
  // already have carried on, so changing the answer changes what a run did.
  const twice = jget(`select agent.decide_automation_approval('t1','${R_W1}','s2','rejected','changed my mind','u1')::text;`);
  check("⚠ a SECOND decision is absorbed and says so, and the first stands",
    /"repeat"\s*:\s*true/.test(twice) && /"verdict"\s*:\s*"approved"/.test(twice), twice);
  check("...and nothing was overwritten",
    jget(`select decisions->'s2'->>'note' from agent.automation_runs where id='${R_W1}';`) === "looks right");
  // NOT FOUND, NEVER FORBIDDEN: the account next door and a run that does not exist
  // answer identically, because the difference is information.
  const theirs = jget(`select agent.decide_automation_approval('t2','${R_W1}','s2','approved',null,'u2')::text;`);
  check("⚠ the account next door cannot answer this account's approval",
    /"error"\s*:\s*"no-execution"/.test(theirs), theirs);
  const wrongStep = jget(`select agent.decide_automation_approval('t1','${R_W1}','s9','approved',null,'u1')::text;`);
  check("a step it is not waiting at is refused by name, writing nothing",
    /"error"\s*:\s*"not-waiting"/.test(wrongStep), wrongStep);
  check("...and no decision was invented for it",
    jget(`select (decisions ? 's9') from agent.automation_runs where id='${R_W1}';`) === "f");

  // ⚠ **TWO PRESSES AT THE SAME INSTANT, WHICH IS THE ONLY THING THE UPDATE'S PREDICATE IS FOR —
  // and a sweep survivor is what said so.** Every check above reaches the second press through
  // the PROBE (`v_had := v_exec.decisions -> p_step`), so the UPDATE is never even attempted and
  // `and not (decisions ? p_step)` decides nothing. Cut that predicate and all of them stay
  // green: MEASURED as a survivor over the whole suite.
  //
  // **WHAT IT COSTS UNDER CONCURRENCY IS THE FUNCTION'S OWN PROMISE.** Both callers probe before
  // either commits, so both see no decision and both enter the block; without the predicate the
  // loser's UPDATE matches the row anyway and OVERWRITES the winner. Two people pressing
  // opposite ways are then each told their own verdict stands while only the last is stored —
  // and the comment on this function says "The first decision stands; a second press is absorbed
  // and says so." *An approval that can be silently replaced is the one thing this must not be.*
  {
    const R_RACE = "cc000000-0000-0000-0000-0000000000e1";
    jget(`select agent.accept_automation_run('t1','${AU2}','${R_RACE}','manual',null)::text;`);
    const cR = jget(`select agent.claim_run('${R_RACE}','w-race',90)::text;`);
    const TOKR = (JSON.parse(cR).claim_token ?? "").trim();
    jget(`select agent.advance_automation_run('${R_RACE}','w-race','${TOKR}',
      '{"kind":"step","step":1,"at":1,"mark":"waiting","done":1}'::jsonb, 0,
      '{}'::jsonb, '[{"id":"s1","outcome":"waiting"}]'::jsonb,
      '{"kind":"approval","step":"s1","ask":"ok?","hours":24,"on_timeout":"reject"}'::jsonb)::text;`);
    check("the race's own execution really is waiting for an approval",
      jget(`select waiting->>'step' from agent.automation_runs where id='${R_RACE}';`) === "s1");
    // The winner decides inside an open transaction and sleeps holding its row lock.
    const winner = spawn("su", ["postgres", "-c",
      `psql -X -q -d ${DB} -c ${shq(`begin; select agent.decide_automation_approval('t1','${R_RACE}','s1','approved','the winner','u1'); select pg_sleep(6); commit;`)}`],
      { stdio: "ignore", detached: true });
    // POLLED FOR THE LOCK, never a guessed pause — the winner's row is uncommitted and
    // invisible, so the lock is the only thing that says it has really written.
    let waited = 0;
    const holdingRow = () => psql(`select count(*) from pg_locks l
        join pg_class c on c.oid = l.relation
        join pg_stat_activity a on a.pid = l.pid
       where c.relname = 'automation_runs' and l.mode = 'RowExclusiveLock' and l.granted
         and a.pid <> pg_backend_pid();`).out;
    while (waited < 8000 && holdingRow() === "0") {
      try { execFileSync("sleep", ["0.2"], { stdio: "ignore" }); } catch { /* best effort */ }
      waited += 200;
    }
    check("the observer is alive: a twin really is holding an undecided approval",
      holdingRow() !== "0");
    // The loser presses the OPPOSITE way. It blocks on the row until the winner commits, and
    // Postgres then re-checks the predicate against the committed version.
    const racedYes = jget(`select agent.decide_automation_approval('t1','${R_RACE}','s1','rejected','the loser','u2')::text;`);
    check("⚠ a racing OPPOSITE press is absorbed, not applied",
      /"repeat"\s*:\s*true/.test(racedYes), racedYes);
    check("...and it is told the WINNER's verdict rather than its own",
      /"verdict"\s*:\s*"approved"/.test(racedYes), racedYes);
    check("...and the stored decision is the winner's, note and all",
      jget(`select (decisions->'s1'->>'verdict') || '|' || (decisions->'s1'->>'note') || '|' || (decisions->'s1'->>'by')
              from agent.automation_runs where id='${R_RACE}';`) === "approved|the winner|u1");
    check("...and exactly one decision exists for that step",
      jget(`select jsonb_array_length(jsonb_path_query_array(decisions, '$.keyvalue() ? (@.key == "s1")'))
              from agent.automation_runs where id='${R_RACE}';`) === "1");
    try { process.kill(-winner.pid, "SIGKILL"); } catch { try { winner.kill("SIGKILL"); } catch { /* gone */ } }
  }

  console.log("\n── resuming: what is due, oldest first, and only what was re-queued ──");
  const R_W2 = "cc000000-0000-0000-0000-0000000000d2";
  jget(`select agent.accept_automation_run('t1','${AU2}','${R_W2}','manual',null)::text;`);
  const c3 = jget(`select agent.claim_run('${R_W2}','w-3',90)::text;`);
  const TOK3 = (JSON.parse(c3).claim_token ?? "").trim();
  jget(`select agent.advance_automation_run('${R_W2}','w-3','${TOK3}',
    '{"kind":"step","step":1,"at":1,"mark":"waiting","done":1}'::jsonb, 1, '{}'::jsonb,
    '[{"id":"s1","outcome":"waiting"}]'::jsonb,
    '{"kind":"wait","step":"s1","mode":"for","minutes":30}'::jsonb)::text;`);
  // NOT DUE YET: the tick must leave it exactly where it is.
  check("a suspended execution that is not due is woken by nothing",
    jget(`select count(*) from agent.resume_due_automations(25) t
            where (t->>'run_id') = '${R_W2}';`) === "0");
  jget(`update agent.automation_runs set wait_until = now() - interval '1 minute' where id='${R_W2}';`);
  const due = jget(`select string_agg((t->>'run_id') || ':' || (t->>'action'), ',') from agent.resume_due_automations(25) t;`);
  check("⚠ once it is due it is re-queued, and the answer says so",
    due === `${R_W2}:queued`, due);
  check("...and the work row really is back on the queue",
    jget(`select kind || '|' || (done_at is null)::text from agent.run_work where run_id='${R_W2}';`) === "resume|true");
  // ⚠ A PAUSE AND ITS DEADLINE GO TOGETHER, in both directions. The first draft of the
  // setup below cleared `waiting` and left `wait_until`, and was refused by this — which
  // is the constraint doing its job and is worth its own check rather than a workaround.
  refused("⚠ clearing a pause without its deadline is refused",
    `update agent.automation_runs set waiting = null where id='${R_W1}';`,
    "automation_runs_wait_is_whole", asOwner);
  refused("...and a pause with no deadline is refused too",
    `update agent.automation_runs set wait_until = null where id='${R_W1}';`,
    "automation_runs_wait_is_whole", asOwner);

  // A FINISHED EXECUTION IS NEVER WOKEN — there is nothing left to resume.
  jget(`update agent.automation_runs set finished_at = now(), waiting = null, wait_until = null where id='${R_W1}';`);
  check("a finished execution is not woken, whatever its deadline said",
    jget(`select count(*) from agent.resume_due_automations(25) t where (t->>'run_id') = '${R_W1}';`) === "0");
  // AND A FINISHED EXECUTION MAY NOT BE LEFT WAITING, which is a state nothing resumes.
  refused("⚠ a finished execution cannot also be waiting",
    `update agent.automation_runs set waiting = '{"kind":"wait","step":"s1"}'::jsonb where id='${R_W1}';`,
    "automation_runs_finished_is_not_waiting", asOwner);

  // ══════════════════════════════════════════════════════════════════════════
  // REFERENCE MATERIAL — the real search, and who may read it
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── knowledge: a real tsvector search, scoped to one agent of one account ──");
  const K1 = "dd000000-0000-0000-0000-0000000000e1";
  const K2 = "dd000000-0000-0000-0000-0000000000e2";
  const KT2 = "dd000000-0000-0000-0000-0000000000e3";
  allowed("reference material for two accounts",
    `insert into agent.agent_knowledge (id, tenant_id, agent_id, title, body) values
       ('${K1}','t1','${AG_ON}','Price list','Boiler service is 95 pounds including parts. A gutter clean is 60.'),
       ('${K2}','t1','${AG_ON}','Opening hours','The workshop is open eight until five on weekdays.'),
       ('${KT2}','t2','${AG_T2}','Their prices','Boiler service is 200 pounds.');`, asOwner);

  // ⚠ THE SEARCH IS POSTGRESQL'S OWN, and this is the one place to see it: `pricing`
  // finds `price` because the `english` configuration STEMS, which `simple` would not.
  const hit = jget(`select coalesce(string_agg(t->>'title', ',' order by t->>'title'),'')
                      from agent.search_knowledge('t1','${AG_ON}','boiler pricing',5) t;`);
  check("⚠ the search really searches — one source matched, BY STEM", hit === "Price list", hit);
  check("...and the answer is the MATCHED passage with its version",
    /95/.test(jget(`select t->>'text' from agent.search_knowledge('t1','${AG_ON}','boiler',5) t limit 1;`)) &&
    jget(`select t->>'version' from agent.search_knowledge('t1','${AG_ON}','boiler',5) t limit 1;`) === "1");
  // ⚠ A QUERY WITH NOTHING SEARCHABLE IN IT FINDS NOTHING, NOT EVERYTHING. "There was
  // nothing to look for" is a different answer from "there was, and it matched nothing".
  check("⚠ a query of nothing but stopwords finds NOTHING",
    jget(`select count(*) from agent.search_knowledge('t1','${AG_ON}','the and of',5) t;`) === "0");
  check("...and so does an empty one",
    jget(`select count(*) from agent.search_knowledge('t1','${AG_ON}','   ',5) t;`) === "0");
  check("⚠ the account next door searching the same agent finds nothing at all",
    jget(`select count(*) from agent.search_knowledge('t2','${AG_ON}','boiler',5) t;`) === "0");
  check("...and its OWN agent finds only its own",
    jget(`select coalesce(string_agg(t->>'title',','),'') from agent.search_knowledge('t2','${AG_T2}','boiler',5) t;`)
      === "Their prices");
  check("a search of ANOTHER agent of the same account finds nothing",
    jget(`select count(*) from agent.search_knowledge('t1','${AG_OFF}','boiler',5) t;`) === "0");

  // ⚠ TWO SOURCES OF ONE NAME IS A RETRIEVAL ANSWER NOBODY CAN ACT ON — which of them?
  refused("two sources of one name per agent is refused, case-insensitively",
    `insert into agent.agent_knowledge (id, tenant_id, agent_id, title, body)
       values (gen_random_uuid(),'t1','${AG_ON}','  PRICE LIST  ','again');`,
    "agent_knowledge_one_title_per_agent", asOwner);
  allowed("THE CONTROL: the same name under a DIFFERENT agent is fine",
    `insert into agent.agent_knowledge (id, tenant_id, agent_id, title, body)
       values (gen_random_uuid(),'t1','${AG_OFF}','Price list','theirs');`, asOwner);
  refused("a source with nothing in it is not a source",
    `insert into agent.agent_knowledge (id, tenant_id, agent_id, title, body)
       values (gen_random_uuid(),'t1','${AG_ON}','Blank','');`, "check", asOwner);
  refused("a format this platform cannot render is refused by name",
    `insert into agent.agent_knowledge (id, tenant_id, agent_id, title, body, format)
       values (gen_random_uuid(),'t1','${AG_ON}','Pdf','x','pdf');`, "agent_knowledge_format_known", asOwner);

  // ⚠ A VERSION SAYS WHICH TEXT A RUN QUOTED, so it moves on the BODY and on nothing else.
  jget(`update agent.agent_knowledge set body = 'Boiler service is 115 pounds from October.' where id='${K1}';`);
  check("⚠ editing the material BUMPS its version",
    jget(`select version from agent.agent_knowledge where id='${K1}';`) === "2");
  jget(`update agent.agent_knowledge set title = 'Prices' where id='${K1}';`);
  check("⚠ ...and RENAMING it does NOT — a version is about the TEXT",
    jget(`select version || '|' || title from agent.agent_knowledge where id='${K1}';`) === "2|Prices");
  check("...and `updated_at` moved for both", 
    jget(`select updated_at > created_at from agent.agent_knowledge where id='${K1}';`) === "t");

  console.log("\n── knowledge: a customer reads their own and writes none of it ──");
  check("an account reads its own reference material",
    jget(`select count(*) from agent.agent_knowledge;`, claimT1) === "3");
  check("...and none of the other account's",
    jget(`select count(*) from agent.agent_knowledge where tenant_id='t2';`, claimT1) === "0");
  refused("a client may not write reference material directly",
    `insert into agent.agent_knowledge (id, tenant_id, agent_id, title, body)
       values (gen_random_uuid(),'t1','${AG_ON}','Sneaky','x');`, "denied", claimT1);
  refused("...nor edit it", `update agent.agent_knowledge set body='x' where id='${K1}';`, "denied", claimT1);
  refused("...nor delete it", `delete from agent.agent_knowledge where id='${K1}';`, "denied", claimT1);
  refused("and `anon` reads none of it at all",
    `select count(*) from agent.agent_knowledge;`, "denied", { role: "anon" });

  // ══════════════════════════════════════════════════════════════════════════
  // MEMORY — scoped by a unique index rather than by a filter anybody remembers
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── memory: (account, agent, name) is the identity, in the database ──");
  allowed("a memory for each of three (account, agent) pairs",
    `insert into agent.agent_memory (id, tenant_id, agent_id, key, value) values
       (gen_random_uuid(),'t1','${AG_ON}','tone','formal'),
       (gen_random_uuid(),'t1','${AG_OFF}','tone','chatty'),
       (gen_random_uuid(),'t2','${AG_T2}','tone','theirs');`, asOwner);
  // ⚠ THE SCOPE IS IN THE KEY. Without it "one value per name" is something every
  // writer has to check, and two writers racing would both pass their own check.
  refused("⚠ two values for one name on one agent is refused BY THE INDEX",
    `insert into agent.agent_memory (id, tenant_id, agent_id, key, value)
       values (gen_random_uuid(),'t1','${AG_ON}','tone','sneaky');`,
    "agent_memory_one_per_key", asOwner);
  check("THE CONTROL: two agents of one account keep their own",
    jget(`select string_agg(value, ',' order by value) from agent.agent_memory where tenant_id='t1' and key='tone';`)
      === "chatty,formal");
  refused("a name that is not an identifier can never be reached by {{a name}}",
    `insert into agent.agent_memory (id, tenant_id, agent_id, key, value)
       values (gen_random_uuid(),'t1','${AG_ON}','Not A Name','x');`, "check", asOwner);
  refused("a source nothing writes is refused, so provenance cannot say anything",
    `insert into agent.agent_memory (id, tenant_id, agent_id, key, value, source)
       values (gen_random_uuid(),'t1','${AG_ON}','other','x','somewhere');`,
    "agent_memory_source_known", asOwner);

  jget(`update agent.agent_memory set value='chatty' where tenant_id='t1' and agent_id='${AG_ON}' and key='tone';`);
  check("⚠ correcting a memory bumps its version", 
    jget(`select version from agent.agent_memory where tenant_id='t1' and agent_id='${AG_ON}' and key='tone';`) === "2");
  jget(`update agent.agent_memory set value='chatty' where tenant_id='t1' and agent_id='${AG_ON}' and key='tone';`);
  check("...and saving the SAME value is not a correction",
    jget(`select version from agent.agent_memory where tenant_id='t1' and agent_id='${AG_ON}' and key='tone';`) === "2");

  console.log("\n── memory: the snapshot an execution is given ──");
  const snap = jget(`select agent.agent_memory_snapshot('t1','${AG_ON}')::text;`);
  check("⚠ the snapshot carries the value AND the version",
    /"value"\s*:\s*"chatty"/.test(snap) && /"version"\s*:\s*2/.test(snap), snap);
  check("⚠ ...and it is scoped to the account", 
    jget(`select agent.agent_memory_snapshot('t2','${AG_ON}')::text;`) === "{}");
  check("an agent with nothing remembered answers {} — a real answer, not an absence",
    jget(`select agent.agent_memory_snapshot('t1','${AG_T2}')::text;`) === "{}");
  // ⚠ AND THE SNAPSHOT IS TAKEN AT ACCEPTANCE, which is what makes a correction reach
  // the NEXT execution and never one already under way.
  const R_M1 = "cc000000-0000-0000-0000-0000000000d3";
  jget(`select agent.accept_automation_run('t1','${AU2}','${R_M1}','manual',null)::text;`);
  check("an execution is given the memories as they stood when it was accepted",
    jget(`select (memory->'tone'->>'value') || ' v' || (memory->'tone'->>'version')
            from agent.automation_runs where id='${R_M1}';`) === "chatty v2");
  jget(`update agent.agent_memory set value='formal again' where tenant_id='t1' and agent_id='${AG_ON}' and key='tone';`);
  check("⚠ ...and a correction afterwards cannot reach it",
    jget(`select memory->'tone'->>'value' from agent.automation_runs where id='${R_M1}';`) === "chatty");
  const R_M2 = "cc000000-0000-0000-0000-0000000000d4";
  jget(`select agent.accept_automation_run('t1','${AU2}','${R_M2}','manual',null)::text;`);
  check("...while the NEXT execution gets the corrected one, at its new version",
    jget(`select (memory->'tone'->>'value') || ' v' || (memory->'tone'->>'version')
            from agent.automation_runs where id='${R_M2}';`) === "formal again v3");

  /**
   * ⚠ **WHAT FORGETTING REACHES: three places, and a delete reaches ONE.**
   *
   * The milestone's own words: *define how forgetting a memory affects future retrieval and
   * existing run snapshots; report those semantics clearly rather than implying deletion
   * erases historical records.* So it is DEFINED here, on a real database, as three separate
   * readings of one delete — and the thing that makes them three is that each is a different
   * relation, not three views of one.
   *
   * | place | what a delete does to it |
   * |---|---|
   * | `agent.agent_memory` — what a NEW snapshot is built from | the row is gone |
   * | `agent.automation_runs.memory` — an execution ALREADY accepted | untouched |
   * | `agent.run_entries` — what the journal quoted | untouched |
   *
   * The second and third are on purpose and are the same rule the instruction snapshot
   * follows: a run executes what it was accepted with. Reporting a delete as "erased" would
   * be a claim about two relations it never touched.
   */
  console.log("\n── memory: what forgetting reaches, and what it does not ──");
  const FG_KEY = "greeting";
  jget(`select agent.save_memory('t1','${AG_ON}','${FG_KEY}','hello there',null,'person',100)::text;`);
  check("a fact is saved to be forgotten",
    jget(`select value from agent.agent_memory where tenant_id='t1' and agent_id='${AG_ON}' and key='${FG_KEY}';`)
      === "hello there");
  // AN EXECUTION IS ACCEPTED WHILE IT IS STILL THERE, so its snapshot holds it.
  const FG_RUN = "cc000000-0000-0000-0000-0000000000f1";
  jget(`select agent.accept_automation_run('t1','${AU2}','${FG_RUN}','manual',null)::text;`);
  check("an execution accepted before the delete holds the fact",
    jget(`select memory->'${FG_KEY}'->>'value' from agent.automation_runs where id='${FG_RUN}';`) === "hello there");
  // AND THE JOURNAL QUOTES IT, which is the third place — written through the fence, as a
  // step's own progress, exactly as a `knowledge` or `memory` step's outcome really is.
  const fgHold = jget(`select (agent.claim_run('${FG_RUN}','w-forget',90))->>'claim_token';`);
  const fgSeq = jget(`select coalesce(max(seq), -1) + 1 from agent.run_entries where run_id='${FG_RUN}';`);
  // ⚠ THE BODY IS THE **THIRD** ARGUMENT — `(run_id, seq, body, worker, token)`. My own first
  // draft wrote it last and the statement errored, which `jget` returns as an empty string, so
  // the check failed about the journal rather than about the call. This file's own recorded
  // argument-order trap; the answer is asserted now, so a refused call is its own failure.
  const fgWrote = jget(`select agent.append_entry('${FG_RUN}'::uuid, ${fgSeq},
          '{"kind":"step","at":1,"step":1,"mark":"progress","outcomes":[{"id":"s1","type":"memory","outcome":"ran","result":"hello there"}]}'::jsonb,
          'w-forget', '${fgHold}')::text;`);
  check("the journal quotes what the step really used",
    /"stored"\s*:\s*true/.test(fgWrote)
    && /hello there/.test(jget(`select body::text from agent.run_entries where run_id='${FG_RUN}' and kind='step';`)),
    `${fgHold} @${fgSeq} -> ${fgWrote}`);

  // ── THE DELETE ────────────────────────────────────────────────────────────────────
  const fgAnswer = jget(`select agent.delete_memory('t1','${AG_ON}','${FG_KEY}')::text;`);
  check("the delete says it found one", /"forgot"\s*:\s*true/.test(fgAnswer), fgAnswer);
  /**
   * ⚠ **THE ANSWER CARRIES THE REACH AND IT IS THE FUNCTION'S OWN, not the caller's.** Both
   * doors report it (an agent's `forget` tool and the site's route) and both read it from
   * here — so a note about what a delete reaches cannot drift from what a delete does.
   */
  check("⚠ ...and it says what it reaches: later runs yes, accepted runs no, history no",
    /"futureRuns"\s*:\s*true/.test(fgAnswer)
    && /"acceptedRuns"\s*:\s*false/.test(fgAnswer)
    && /"runHistory"\s*:\s*false/.test(fgAnswer), fgAnswer);
  check("...and it names the fact it forgot, so an answer can be tied to an ask",
    new RegExp(`"key"\\s*:\\s*"${FG_KEY}"`).test(fgAnswer), fgAnswer);

  check("1/3 — the row is gone, so it is not remembered any more",
    jget(`select count(*) from agent.agent_memory where tenant_id='t1' and agent_id='${AG_ON}' and key='${FG_KEY}';`)
      === "0");
  check("⚠ 1/3 — and a NEW snapshot does not carry it, which is what 'future retrieval' means",
    jget(`select (agent.agent_memory_snapshot('t1','${AG_ON}') ? '${FG_KEY}')::text;`) === "false");
  check("⚠ 2/3 — an execution ALREADY ACCEPTED still resolves it, at the version it was given",
    jget(`select memory->'${FG_KEY}'->>'value' from agent.automation_runs where id='${FG_RUN}';`) === "hello there");
  check("⚠ 3/3 — and the journal still holds what it quoted",
    /hello there/.test(jget(`select body::text from agent.run_entries where run_id='${FG_RUN}' and kind='step';`)));
  // THE CONTROL, without which "still there" is satisfied by a delete that did nothing at
  // all: the OTHER memory of the same agent is untouched, and the row really went.
  check("the control — the agent's other memories are untouched",
    jget(`select value from agent.agent_memory where tenant_id='t1' and agent_id='${AG_ON}' and key='tone';`)
      === "formal again");

  // ── FORGETTING TWICE, AND ACROSS ACCOUNTS ─────────────────────────────────────────
  const fgTwice = jget(`select agent.delete_memory('t1','${AG_ON}','${FG_KEY}')::text;`);
  check("⚠ forgetting it again is OK and says there was nothing — not a failure, and not a removal",
    /"ok"\s*:\s*true/.test(fgTwice) && /"forgot"\s*:\s*false/.test(fgTwice), fgTwice);
  check("...and the reach is still stated, because it is about how forgetting works",
    /"futureRuns"\s*:\s*true/.test(fgTwice), fgTwice);
  /**
   * ⚠ **SCOPED BY (ACCOUNT, AGENT), AND THE TWO LAYERS SEPARATE DIFFERENTLY — measured, after
   * my own first draft asked for a shape the schema forbids.**
   *
   * `agent.agents.id` is a PRIMARY KEY on the id ALONE, so two accounts cannot share an agent.
   * A cross-account delete therefore names the other account's OWN agent, and
   * `delete_memory` answers `no-agent` for one that is not theirs — which is the function's
   * wall. The INDEX's own scope is a different question, and the shape that separates it is a
   * memory row carrying a mismatched pair, which only the owner can insert. Both are driven,
   * because a claim about the index proved through the function is a claim about the function.
   */
  jget(`select agent.save_memory('t1','${AG_ON}','shared','ours',null,'person',100)::text;`);
  jget(`select agent.save_memory('t2','${AG_T2}','shared','theirs',null,'person',100)::text;`);
  const fgAcross = jget(`select agent.delete_memory('t2','${AG_T2}','shared')::text;`);
  check("the other account's delete answers about its own", /"forgot"\s*:\s*true/.test(fgAcross), fgAcross);
  check("⚠ ...and OURS is still there, so one account's forgetting is not another's",
    jget(`select value from agent.agent_memory where tenant_id='t1' and agent_id='${AG_ON}' and key='shared';`)
      === "ours");
  check("⚠ ...and an agent that is not this account's is `no-agent`, never a silent no-op",
    /"error"\s*:\s*"no-agent"/.test(jget(`select agent.delete_memory('t2','${AG_ON}','shared')::text;`)));
  // AND THE OTHER DIRECTION: two agents of ONE account, which a tenant filter cannot tell
  // apart at all — only the agent id does.
  jget(`select agent.save_memory('t1','${AG_OFF}','shared','the sibling''s',null,'person',100)::text;`);
  jget(`select agent.delete_memory('t1','${AG_ON}','shared')::text;`);
  check("⚠ ...and a sibling agent of the SAME account keeps its own",
    jget(`select value from agent.agent_memory where tenant_id='t1' and agent_id='${AG_OFF}' and key='shared';`)
      === "the sibling's");
  // ⚠ AND THE INDEX'S OWN SCOPE, at the layer the function cannot reach: a row whose account
  // and agent do not belong together is a DIFFERENT slot, so "one value per name" is per pair
  // rather than per name. Inserted as the owner, because that is the only writer that can
  // make such a row at all — which is also why the function's wall above is the real one.
  allowed("a memory row carrying a mismatched (account, agent) pair is its own slot",
    `insert into agent.agent_memory (id, tenant_id, agent_id, key, value)
       values (gen_random_uuid(),'t2','${AG_ON}','shared','neither''s');`, asOwner);
  check("⚠ ...so the index scopes by the PAIR and not by the name",
    jget(`select count(*) from agent.agent_memory where key='shared';`, asOwner) === "2");
  check("...and forgetting one pair leaves the other, which is what the index buys",
    /"forgot"\s*:\s*false/.test(jget(`select agent.delete_memory('t1','${AG_ON}','shared')::text;`)));

  console.log("\n── memory: a customer reads their own and writes none of it ──");
  // RE-ANCHORED, NOT APPEASED: this read `count(*) === "2"`, which is a claim about how many
  // fixtures this file happens to have — so adding a memory above made it red for a reason
  // that has nothing to do with tenancy. It names the ROWS now, against the set `t1` really
  // owns, with its observer proved alive: strictly stronger than the number it replaced, and
  // the same correction this file already records one view over.
  check("an account reads its own memories",
    jget(`select count(*) from agent.agent_memory;`, claimT1)
      === jget(`select count(*) from agent.agent_memory where tenant_id='t1';`, asOwner));
  check("...and the observer is alive — there really are some to read",
    Number(jget(`select count(*) from agent.agent_memory;`, claimT1)) > 0);
  check("...and none of the other account's",
    jget(`select count(*) from agent.agent_memory where tenant_id='t2';`, claimT1) === "0");
  check("...and the other account really has some, so that zero is a wall and not an empty table",
    Number(jget(`select count(*) from agent.agent_memory where tenant_id='t2';`, asOwner)) > 0);
  refused("a client may not write a memory directly",
    `insert into agent.agent_memory (id, tenant_id, agent_id, key, value)
       values (gen_random_uuid(),'t1','${AG_ON}','sneaky','x');`, "denied", claimT1);
  refused("...nor correct one", `update agent.agent_memory set value='x' where key='tone';`, "denied", claimT1);
  refused("and `anon` reads none of it at all",
    `select count(*) from agent.agent_memory;`, "denied", { role: "anon" });

  console.log("\n── what an automation asks for ──");
  refused("an input list longer than the cap is refused by the COLUMN",
    `update agent.automations set inputs =
       (select jsonb_agg(jsonb_build_object('name','a'||g,'label','A','required',false,'default','')) from generate_series(1,9) g)
     where id='${AU2}';`, "automations_inputs_shaped", asOwner);
  allowed("THE CONTROL: a list at the cap is accepted",
    `update agent.automations set inputs =
       (select jsonb_agg(jsonb_build_object('name','a'||g,'label','A','required',false,'default','')) from generate_series(1,8) g)
     where id='${AU2}';`, asOwner);
  allowed("one real declaration",
    `update agent.automations set inputs = '[{"name":"topic","label":"What it is about","required":true,"default":""}]'::jsonb
     where id='${AU2}';`, asOwner);
  const R_IN = "cc000000-0000-0000-0000-0000000000d5";
  const badIn = jget(`select agent.accept_automation_run('t1','${AU2}','${R_IN}','manual',null,'{"nonsense":"x"}'::jsonb)::text;`);
  check("⚠ an answer nothing asked for is NAMED rather than dropped",
    /"error"\s*:\s*"unknown-input"/.test(badIn) && /nonsense/.test(badIn), badIn);
  check("...having written nothing at all",
    jget(`select count(*) from agent.automation_runs where id='${R_IN}';`) === "0");
  const missing = jget(`select agent.accept_automation_run('t1','${AU2}','${R_IN}','manual',null,'{}'::jsonb)::text;`);
  check("a required answer left out is refused before anything is written",
    /"error"\s*:\s*"(missing-input|bad-inputs)"/.test(missing), missing);
  const goodIn = jget(`select agent.accept_automation_run('t1','${AU2}','${R_IN}','manual',null,'{"topic":"boiler"}'::jsonb)::text;`);
  check("THE CONTROL: the answer it asked for is accepted", /"ok"\s*:\s*true/.test(goodIn), goodIn);
  check("...and is snapshotted on the execution, in `input` AND seeded into `vars`",
    jget(`select (input->>'topic') || '|' || (vars->>'topic') from agent.automation_runs where id='${R_IN}';`) === "boiler|boiler");

  // ⚠ **ITS OWN IDS, AND A CENSUS THAT THEY ARE FREE BEFORE ANYTHING IS WRITTEN.** This file
  // is one long body whose fixtures share a database, and it already records two collisions:
  // the first draft of this block reused `cc000000…e1`, which is `R_RACE` four hundred lines
  // up, so the required-list refusal met a committed row, answered `repeat: true`, and
  // reported a correct product as broken. A census makes the next one a sentence.
  check("⚠ this block's own execution ids are unused before it starts",
    jget(`select count(*) from agent.automation_runs where id::text like 'ab000000-%';`) === "0");
  // ⚠ **AN ANSWER IS READ AS ITS DECLARED KIND, AND A DECLARED LIST WAS UNSUPPLIABLE.**
  // MEASURED before the fix: this read demanded a STRING of every answer, so a real list
  // came back `bad-input` — while the site's own route had already read it as a list and
  // sent it — and the only value a declared list could hold was text, which `repeat … each`
  // then refuses at run time as *"not a list"*. So a loop over a declared list was a
  // control nobody could ever use, at either end.
  const R_TY = "ab000000-0000-0000-0000-000000000001";
  allowed("an automation that asks for a list, a number and some text",
    `update agent.automations set inputs = '[
       {"name":"lines","label":"Lines","required":false,"default":"","type":"list"},
       {"name":"count","label":"How many","required":false,"default":"","type":"number"},
       {"name":"topic","label":"What it is about","required":true,"default":"","type":"text"}]'::jsonb
     where id='${AU2}';`, asOwner);
  const tyTyped = jget(`select agent.accept_automation_run('t1','${AU2}','${R_TY}','manual',null,
      '{"lines":["a","b"],"count":2,"topic":"boiler"}'::jsonb)::text;`);
  check("⚠ a LIST answer is accepted for a declared list", /"ok"\s*:\s*true/.test(tyTyped), tyTyped);
  check("...and `vars` holds it as a REAL list, which is the only thing a loop can go through",
    jget(`select (vars->'lines')::text from agent.automation_runs where id='${R_TY}';`) === '["a", "b"]');
  check("...and a number stays a number, never its own text",
    jget(`select jsonb_typeof(vars->'count') || '/' || (vars->>'count') from agent.automation_runs where id='${R_TY}';`)
      === "number/2");
  check("...and the text is text, exactly as every automation stored before types held it",
    jget(`select jsonb_typeof(vars->'topic') from agent.automation_runs where id='${R_TY}';`) === "string");

  // ⚠ REFUSED BY KIND AND BY NAME, NEVER COERCED — and each refusal SAYS which kind it
  // wanted, because "that did not arrive" is not something a form can act on. Every one of
  // these is the shape the site's own reader already refuses, so the two doors agree.
  for (const [what, body, wanted] of [
    ["a string where a list was declared", '{"lines":"a,b","topic":"t"}', "list"],
    ["a number where a list was declared", '{"lines":7,"topic":"t"}', "list"],
    ["a list holding a list", '{"lines":[["a"]],"topic":"t"}', "list-of-text"],
    ["a string where a number was declared", '{"count":"2","topic":"t"}', "number"],
    ["a list where text was declared", '{"topic":["t"]}', "text"],
  ]) {
    const r = jget(`select agent.accept_automation_run('t1','${AU2}',
        'ab000000-0000-0000-0000-000000000003','manual',null,'${body}'::jsonb)::text;`);
    check(`...${what} is refused, naming what it wanted`,
      /"error"\s*:\s*"bad-input"/.test(r) && r.includes(`"wanted": "${wanted}"`), r);
  }
  check("...and not one of them wrote an execution",
    jget(`select count(*) from agent.automation_runs where id='ab000000-0000-0000-0000-000000000003';`) === "0");

  // ⚠ **AN UNANSWERED NAME IS FILLED WITH THE EMPTY VALUE OF ITS OWN KIND**, so `{{name}}`
  // is never a reference to something absent — and for a list that is `[]`, which a loop
  // goes round nought times over and says so. Reading it as `""` is what made a loop over
  // an unanswered list fail rather than do nothing.
  const R_EMPTY = "ab000000-0000-0000-0000-000000000002";
  const tyBare = jget(`select agent.accept_automation_run('t1','${AU2}','${R_EMPTY}','manual',null,
      '{"topic":"boiler"}'::jsonb)::text;`);
  check("an automation run with only its required answer is accepted", /"ok"\s*:\s*true/.test(tyBare), tyBare);
  check("...and the unanswered list is the EMPTY LIST, not a blank string",
    jget(`select (vars->'lines')::text from agent.automation_runs where id='${R_EMPTY}';`) === "[]");
  // AND THE NUMBER IS THE ONE KIND WITH NO EMPTY VALUE, so it is blank rather than zero —
  // `Number("")` is 0, and a zero nobody tyTyped is the coercion this file records elsewhere.
  check("...and an unanswered number is blank rather than a zero nobody tyTyped",
    jget(`select (vars->>'count') = '' from agent.automation_runs where id='${R_EMPTY}';`) === "t");
  // A REQUIRED LIST LEFT EMPTY IS UNANSWERED, which is what an empty box is on a form.
  allowed("an automation whose list has to be answered",
    `update agent.automations set inputs = '[{"name":"lines","label":"Lines","required":true,"default":"","type":"list"}]'::jsonb
     where id='${AU2}';`, asOwner);
  const tyEmptyReq = jget(`select agent.accept_automation_run('t1','${AU2}',
      'ab000000-0000-0000-0000-000000000004','manual',null,'{"lines":[]}'::jsonb)::text;`);
  check("a required list answered with nothing in it is unanswered",
    /"error"\s*:\s*"missing-input"/.test(tyEmptyReq) && tyEmptyReq.includes("lines"), tyEmptyReq);
  const tyOneReq = jget(`select agent.accept_automation_run('t1','${AU2}',
      'ab000000-0000-0000-0000-000000000005','manual',null,'{"lines":["a"]}'::jsonb)::text;`);
  check("THE CONTROL: one thing in it is an answer", /"ok"\s*:\s*true/.test(tyOneReq), tyOneReq);

  // ⚠ **A NON-EMPTY DEFAULT WAS NEVER DRIVEN, and a sweep survivor is what said so.** Both
  // declarations above set `"default":""`, so the line that reads one
  // (`v_json := to_jsonb(coalesce(v_d ->> 'default', ''))`) had no case anywhere: a mutant
  // that ignored the default entirely would have passed this file. Four properties, two
  // calls, and the fourth is the one the survivor was really about.
  allowed("an automation whose text input has a real default and whose list has one too",
    `update agent.automations set inputs = '[
       {"name":"topic","label":"Topic","required":true,"default":"boilers","type":"text"},
       {"name":"lines","label":"Lines","required":false,"default":"a,b","type":"list"}]'::jsonb
     where id='${AU2}';`, asOwner);
  const R_DFLT = "ab000000-0000-0000-0000-000000000006";
  const tyDflt = jget(`select agent.accept_automation_run('t1','${AU2}','${R_DFLT}','manual',null,
      '{}'::jsonb)::text;`);
  // A DEFAULT SATISFIES `required`, because whether something is blank is asked AFTER the
  // fill. Without this, an automation with a default could never run unanswered — which is
  // the whole point of having one.
  check("an unanswered REQUIRED text input is accepted when it has a default",
    /"ok"\s*:\s*true/.test(tyDflt), tyDflt);
  check("...and the default is what the run carries",
    jget(`select vars->>'topic' from agent.automation_runs where id='${R_DFLT}';`) === "boilers");
  // ⚠ AND A LIST NEVER REACHES ITS DEFAULT: the empty-list arm comes first, so a default on
  // a list input is unreachable by construction. THAT is why the declaration's default is
  // read as TEXT and never as raw JSON — a `"a,b"` read as a list would be exactly the
  // coercion the kind loop refuses, and no door can even store a non-text default
  // (`typeof d.default === "string" ? d.default : ""`, in the site's `cleanWorkflow` and the
  // engine's `readInputs` alike).
  check("...and a list ignores its own default, which is the empty list either way",
    jget(`select (vars->'lines')::text from agent.automation_runs where id='${R_DFLT}';`) === "[]");
  const R_ANS = "ab000000-0000-0000-0000-000000000007";
  const tyAns = jget(`select agent.accept_automation_run('t1','${AU2}','${R_ANS}','manual',null,
      '{"topic":"radiators"}'::jsonb)::text;`);
  check("THE CONTROL: an answer beats the default", /"ok"\s*:\s*true/.test(tyAns)
    && jget(`select vars->>'topic' from agent.automation_runs where id='${R_ANS}';`) === "radiators", tyAns);

  // ⚠ **AND `0` IS A REAL ANSWER, which nothing drove either.** The block above answers a
  // number with `2` against an input that is NOT required, so whether a number counts as
  // answered could not be observed: the run is accepted either way. `0` against a REQUIRED
  // number is the one shape that separates them, and it is this repository's own recorded
  // falsy-zero defect asked of a form (`Number("")` is `0`, and `0` is not nothing).
  allowed("an automation whose number has to be answered",
    `update agent.automations set inputs = '[
       {"name":"count","label":"How many","required":true,"default":"","type":"number"}]'::jsonb
     where id='${AU2}';`, asOwner);
  const R_ZERO = "ab000000-0000-0000-0000-000000000008";
  const tyZero = jget(`select agent.accept_automation_run('t1','${AU2}','${R_ZERO}','manual',null,
      '{"count":0}'::jsonb)::text;`);
  check("⚠ a required number answered with ZERO is answered", /"ok"\s*:\s*true/.test(tyZero), tyZero);
  check("...and the run carries the zero rather than a blank",
    jget(`select (vars->'count')::text from agent.automation_runs where id='${R_ZERO}';`) === "0");
  // THE CONTROL, without which "zero is accepted" could be true because the input was never
  // required at all: the same declaration, left unanswered, is refused BY NAME.
  const tyNoNum = jget(`select agent.accept_automation_run('t1','${AU2}',
      'ab000000-0000-0000-0000-000000000009','manual',null,'{}'::jsonb)::text;`);
  check("THE CONTROL: the same number left out is refused",
    /"error"\s*:\s*"missing-input"/.test(tyNoNum) && tyNoNum.includes("count"), tyNoNum);


  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── the capability operations: what a person's screen and their agent BOTH run ──");
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠ THESE ARE THE FUNCTIONS THE SITE'S ROUTES AND THE ENGINE'S TOOLS BOTH CALL, which
  // is the only arrangement in which "the same underlying operation" is a fact rather
  // than a claim: the two products are separate Workers and neither may import the other,
  // so a shared JavaScript module is not available and the database is what is left.
  //
  // Every refusal below is read for ITS OWN REASON, because a refusal from the wrong gate
  // looks exactly like the wall working — and every group carries a CONTROL that must
  // succeed, without which a database refusing everything would pass this file.
  check("⚠ ownership answers a BOOLEAN, so 'not yours' and 'not there' are one answer",
    jget(`select agent.owns_agent('t1','${AG_ON}')::text || '|' || agent.owns_agent('t2','${AG_ON}')::text
            || '|' || agent.owns_agent('t1','00000000-0000-4000-8000-000000000000')::text;`) === "true|false|false");

  check("listing the reference material answers this agent's own",
    jget(`select count(*) from agent.list_knowledge('t1','${AG_ON}') t;`) === "2");
  check("⚠ ...and the list carries NO material, so a tool is not the cheap way to pull every document",
    jget(`select (t ? 'body')::text from agent.list_knowledge('t1','${AG_ON}') t limit 1;`) === "false");
  check("⚠ ...and the account next door gets nothing rather than a refusal",
    jget(`select count(*) from agent.list_knowledge('t2','${AG_ON}') t;`) === "0");
  check("reading one source whole DOES carry it",
    /Boiler service/.test(jget(`select agent.read_knowledge('t1','${K1}')->>'body';`)));
  check("⚠ ...and the account next door reads nothing at all",
    jget(`select coalesce(agent.read_knowledge('t2','${K1}')::text,'NULL');`) === "NULL");

  // ── memory ────────────────────────────────────────────────────────────────
  const MEMA = "ee000000-0000-0000-0000-0000000000c1";
  const saved = jget(`select agent.save_memory('t1','${AG_ON}','cap_tone','formal','${MEMA}')::text;`);
  check("a memory is created, at version 1",
    /"saved"\s*:\s*"created"/.test(saved) && /"version"\s*:\s*1/.test(saved), saved);
  check("⚠ saving the SAME words again is the same fact at the same version",
    /"saved"\s*:\s*"unchanged"/.test(jget(`select agent.save_memory('t1','${AG_ON}','cap_tone','formal',null)::text;`)));
  check("...and the row really did not move",
    jget(`select version::text from agent.agent_memory where tenant_id='t1' and agent_id='${AG_ON}' and key='cap_tone';`) === "1");
  check("⚠ THE CONTROL: different words DO move it",
    /"saved"\s*:\s*"corrected"/.test(jget(`select agent.save_memory('t1','${AG_ON}','cap_tone','chatty',null)::text;`)) &&
    jget(`select version::text from agent.agent_memory where tenant_id='t1' and agent_id='${AG_ON}' and key='cap_tone';`) === "2");

  // EACH REFUSAL BY ITS OWN NAME, or "it refused" is satisfied by a function that refuses
  // everything for some other reason.
  for (const [what, call, why] of [
    ["a name that is not an identifier", `agent.save_memory('t1','${AG_ON}','Not A Name','x',null)`, "bad-name"],
    ["nothing to remember", `agent.save_memory('t1','${AG_ON}','cap_x','   ',null)`, "empty"],
    ["longer than one memory can be", `agent.save_memory('t1','${AG_ON}','cap_x',repeat('a',4001),null)`, "too-long"],
    ["a source nobody can account for", `agent.save_memory('t1','${AG_ON}','cap_x','v',null,'somewhere')`, "bad-source"],
    ["the account next door's agent", `agent.save_memory('t2','${AG_ON}','cap_x','v',null)`, "no-agent"],
  ]) {
    check(`⚠ ${what} is refused as \`${why}\``,
      jget(`select ${call}->>'error';`) === why, jget(`select ${call}::text;`));
  }
  check("...and not one of those wrote a row",
    jget(`select count(*) from agent.agent_memory where tenant_id='t1' and agent_id='${AG_ON}' and key='cap_x';`) === "0");
  check("⚠ the ceiling is asked only for a name this agent does NOT already hold",
    jget(`select agent.save_memory('t1','${AG_ON}','cap_new','v',null,'person',1)->>'error';`) === "too-many" &&
    jget(`select agent.save_memory('t1','${AG_ON}','cap_tone','again',null,'person',1)->>'saved';`) === "corrected");
  // ⚠ WHAT MAKES `pause_automation` SAFE TO REPEAT: it is a write of the CALLER'S OWN
  // value to a named row, so the end state does not depend on how many times it ran. The
  // ANSWER is identical too, which is what lets a redelivery finish the call rather than
  // having to tell a resumed run apart from a first attempt.
  //
  // ⚠ IT SITS HERE, PAST THE AUTOMATION SECTION, ON PURPOSE. It toggles `AU1`'s own
  // `enabled`, and doing that mid-scenario up there would change the state the disabled
  // and paused refusals are asked in — a check that alters what a later one is about. It
  // leaves the row exactly as it found it, and nothing after this reads it.
  const off1 = jget(`select agent.set_automation_enabled('t1','${AU1}',false)::text;`);
  const off2 = jget(`select agent.set_automation_enabled('t1','${AU1}',false)::text;`);
  check("⚠ turning an automation off twice leaves it off, with the same answer",
    /"enabled"\s*:\s*false/.test(off1) && off1 === off2, `${off1} / ${off2}`);
  check("⚠ THE CONTROL: turning it back on really does change it",
    /"enabled"\s*:\s*true/.test(jget(`select agent.set_automation_enabled('t1','${AU1}',true)::text;`)));
  check("forgetting says whether there WAS one, rather than failing when there was not",
    jget(`select agent.delete_memory('t1','${AG_ON}','cap_tone')->>'forgot';`) === "true" &&
    jget(`select agent.delete_memory('t1','${AG_ON}','cap_tone')->>'forgot';`) === "false");
  check("⚠ ...and the account next door cannot forget anything of this agent's",
    jget(`select agent.delete_memory('t2','${AG_ON}','anything')->>'error';`) === "no-agent");

  // ── automations ───────────────────────────────────────────────────────────
  check("listing the automations answers this agent's own, counting steps rather than carrying them",
    Number(jget(`select count(*) from agent.list_automations('t1','${AG_ON}') t;`)) >= 1 &&
    jget(`select (t ? 'steps')::text from agent.list_automations('t1','${AG_ON}') t limit 1;`) === "true" &&
    jget(`select jsonb_typeof(t->'steps') from agent.list_automations('t1','${AG_ON}') t limit 1;`) === "number");
  check("⚠ ...and reading one DOES carry them, as a list",
    jget(`select jsonb_typeof(agent.read_automation('t1','${AU2}')->'steps');`) === "array");
  check("⚠ ...and the account next door reads nothing",
    jget(`select coalesce(agent.read_automation('t2','${AU2}')::text,'NULL');`) === "NULL");

  check("⚠ a null `enabled` is REFUSED, never read as 'turn it off'",
    jget(`select agent.set_automation_enabled('t1','${AU2}',null)->>'error';`) === "bad-enabled");
  check("⚠ ...and the account next door's attempt answers no-automation and writes nothing",
    jget(`select agent.set_automation_enabled('t2','${AU2}',false)->>'error';`) === "no-automation");
  const wasOn = jget(`select enabled::text from agent.automations where id='${AU2}';`);
  check("THE CONTROL: the owner really can turn it off, and the row moves",
    jget(`select agent.set_automation_enabled('t1','${AU2}',false)->>'ok';`) === "true" &&
    jget(`select enabled::text from agent.automations where id='${AU2}';`) === "false", wasOn);
  jget(`select agent.set_automation_enabled('t1','${AU2}',${wasOn});`);

  // ── what an execution did ─────────────────────────────────────────────────
  check("an execution history is scoped to the account",
    Number(jget(`select count(*) from agent.list_executions('t1','${AU2}',10) t;`)) >= 0 &&
    jget(`select count(*) from agent.list_executions('t2','${AU2}',10) t;`) === "0");
  check("⚠ ...and its limit is CLAMPED rather than refused, at both ends",
    jget(`select count(*) from agent.list_executions('t1','${AU2}',-5) t;`) === jget(`select count(*) from agent.list_executions('t1','${AU2}',1) t;`));

  // ── the grants ────────────────────────────────────────────────────────────
  // ⚠ ASKED AS A PRIVILEGE, NEVER AS A REFUSAL. `authenticated` holds no USAGE on this
  // schema, so every call as that role answers `permission denied for schema agent`
  // whatever the function grants are — which is this repository's own recorded "a refusal
  // from the wrong gate looks exactly like the wall working", and only `has_function_privilege`
  // can see past it.
  for (const fn of ["agent.owns_agent(text, uuid)", "agent.list_knowledge(text, uuid)",
                    "agent.save_memory(text, uuid, text, text, uuid, text, integer)",
                    "agent.delete_memory(text, uuid, text)",
                    "agent.set_automation_enabled(text, uuid, boolean)",
                    "agent.read_execution(text, uuid)"]) {
    check(`⚠ only the backend may call ${fn.split("(")[0]}`,
      jget(`select has_function_privilege('service_role','${fn}','execute')::text || '|'
              || has_function_privilege('authenticated','${fn}','execute')::text || '|'
              || has_function_privilege('anon','${fn}','execute')::text;`) === "true|false|false");
  }
  check("⚠ every one of them pins an empty search_path and runs as its owner",
    jget(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname='agent'
              and p.proname in ('owns_agent','list_knowledge','read_knowledge','list_memory','save_memory',
                                'delete_memory','list_automations','read_automation','set_automation_enabled',
                                'list_executions','read_execution')
              -- ⚠ THE VALUE IS STORED WITH ITS QUOTES -- search_path="" and not
              -- search_path= -- read off pg_proc rather than guessed. The first write of
              -- this line asked for the unquoted form and reported eleven correct
              -- functions as broken. (And its comment then used backticks, INSIDE a
              -- template literal, which ended the string: prose carrying the thing it
              -- is quoting, in the one place that cannot hold it.)
              and p.prosecdef and 'search_path=""' = any(p.proconfig);`) === "11");



  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── a tool call a person has to say yes to ──");
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠ EVERY DIRECT READ OF THE TABLE BELOW IS `asOwner`, and that is the table's own
  // guarantee rather than a workaround: `force row level security` filters `service_role`
  // as well, so `jget`'s default reader answers NO ROWS — indistinguishable from a row
  // that was never written. MEASURED: six checks reported the schema as broken that way
  // before the reader was named.
  //
  // ⚠ THE PROPERTIES HERE ARE POSTGRES'S OWN and are not checkable anywhere else: a
  // partial unique key on `(run_id, step, idx)`, a CHECK that a decision is whole, a
  // `for update` lock deciding a race, and a grant surface where a client may READ its
  // own and write none of it.
  const AP_RUN = "ee000000-0000-0000-0000-0000000000e1";
  const AP_T2 = "ee000000-0000-0000-0000-0000000000e2";
  allowed("two runs to ask about, one per account",
    `insert into agent.runs (id, tenant_id, status) values
       ('${AP_RUN}','t1','running'), ('${AP_T2}','t2','running');`, asOwner);

  const askedOnce = jget(`select agent.request_tool_approval('t1','${AP_RUN}','${AG_ON}',1,0,
    'run_automation','{"id":"a-7"}'::jsonb,'hash-one')::text;`);
  check("a request is recorded and answers pending, with nothing decided",
    /"ok"\s*:\s*true/.test(askedOnce) && /"verdict"\s*:\s*null/.test(askedOnce)
    && /"matches"\s*:\s*true/.test(askedOnce), askedOnce);
  const apId = jget(`select id::text from agent.tool_approvals where run_id='${AP_RUN}' and step=1 and idx=0;`, asOwner);

  // ⚠ ASKING AGAIN FINDS THE FIRST REQUEST. A redelivery must not make a second thing
  // for somebody to answer twice — and the identity is the POSITION, so this is the
  // partial unique key doing the work rather than the caller remembering.
  const askedTwice = jget(`select agent.request_tool_approval('t1','${AP_RUN}','${AG_ON}',1,0,
    'run_automation','{"id":"a-7"}'::jsonb,'hash-one')::text;`);
  check("⚠ asking again finds the FIRST request rather than making a second",
    askedTwice.includes(apId) &&
    jget(`select count(*) from agent.tool_approvals where run_id='${AP_RUN}';`, asOwner) === "1", askedTwice);

  // ⚠ DIFFERENT ARGUMENTS ARE REPORTED, NEVER WRITTEN OVER. The stored row is what a
  // person was shown and may already have answered.
  const drifted = jget(`select agent.request_tool_approval('t1','${AP_RUN}','${AG_ON}',1,0,
    'run_automation','{"id":"SOMETHING-ELSE"}'::jsonb,'hash-two')::text;`);
  check("⚠ a call whose arguments moved reads as NOT matching, and the row is untouched",
    /"matches"\s*:\s*false/.test(drifted) &&
    jget(`select args_hash from agent.tool_approvals where id='${apId}';`, asOwner) === "hash-one", drifted);
  check("...and two calls at DIFFERENT positions are two requests",
    /"ok"\s*:\s*true/.test(jget(`select agent.request_tool_approval('t1','${AP_RUN}','${AG_ON}',1,1,
      'pause_automation','{}'::jsonb,'hash-three')::text;`)) &&
    jget(`select count(*) from agent.tool_approvals where run_id='${AP_RUN}';`, asOwner) === "2");

  check("⚠ a run that is not this account's reads as absent, and writes nothing",
    jget(`select agent.request_tool_approval('t2','${AP_RUN}','${AG_ON}',9,0,
      'run_automation','{}'::jsonb,'h')->>'error';`) === "no-run" &&
    jget(`select count(*) from agent.tool_approvals where step=9;`, asOwner) === "0");

  // ── deciding ──────────────────────────────────────────────────────────────
  check("⚠ a verdict that is not a verdict is refused, and nothing is written",
    jget(`select agent.decide_tool_approval('t1','${apId}','maybe','','someone')->>'error';`) === "bad-verdict" &&
    jget(`select coalesce(verdict,'NULL') from agent.tool_approvals where id='${apId}';`, asOwner) === "NULL");
  check("⚠ a decision nobody can be tied to is refused — this is what 'an authorized user' rests on",
    jget(`select agent.decide_tool_approval('t1','${apId}','approved','','   ')->>'error';`) === "no-decider" &&
    jget(`select coalesce(verdict,'NULL') from agent.tool_approvals where id='${apId}';`, asOwner) === "NULL");
  check("⚠ the account next door cannot decide this account's request",
    jget(`select agent.decide_tool_approval('t2','${apId}','approved','','them')->>'error';`) === "no-request" &&
    jget(`select coalesce(verdict,'NULL') from agent.tool_approvals where id='${apId}';`, asOwner) === "NULL");

  // THE CONTROL, without which every refusal above is satisfied by a function that
  // refuses everything.
  psql(`update agent.run_work set done_at = now(), claimed_by = null
          where run_id = '${AP_RUN}';`);
  psql(`insert into agent.run_work (run_id, tenant_id, kind, done_at)
        select '${AP_RUN}','t1','start', now()
        where not exists (select 1 from agent.run_work where run_id='${AP_RUN}');`);
  const approvedIt = jget(`select agent.decide_tool_approval('t1','${apId}','approved','go on','owner@example.test')::text;`);
  check("THE CONTROL: the owner really can approve, and the row is whole",
    /"ok"\s*:\s*true/.test(approvedIt) && /"repeat"\s*:\s*false/.test(approvedIt) &&
    jget(`select verdict || '|' || decided_by || '|' || (decided_at is not null)::text
            from agent.tool_approvals where id='${apId}';`, asOwner) === "approved|owner@example.test|true", approvedIt);
  // ⚠ AND IT PUT THE RUN BACK ON THE QUEUE — through `requeue_run`, which is the
  // function a person pressing "try again" already uses. This is the whole of the
  // durable wait: there is no second queue anywhere in this schema.
  check("⚠ ...and the run went back on the queue, unclaimed, as a resume",
    jget(`select coalesce(done_at::text,'NULL') || '|' || kind || '|' || coalesce(claimed_by,'NULL')
            from agent.run_work where run_id='${AP_RUN}';`, asOwner) === "NULL|resume|NULL");

  check("⚠ THE FIRST DECISION STANDS — a second press re-reads the winner's answer",
    /"repeat"\s*:\s*true/.test(jget(`select agent.decide_tool_approval('t1','${apId}','rejected','no','someone-else')::text;`)) &&
    jget(`select verdict || '|' || decided_by from agent.tool_approvals where id='${apId}';`, asOwner) === "approved|owner@example.test");

  refused("⚠ a HALF decision is refused by the check constraint, not by us",
    `update agent.tool_approvals set verdict = 'rejected', decided_at = null, decided_by = null where id='${apId}';`,
    "tool_approvals_decision_is_whole", asOwner);

  // ── reading ───────────────────────────────────────────────────────────────
  check("what is waiting is this account's, oldest first, and a decided one is gone from it",
    jget(`select count(*) from agent.pending_approvals('t1','${AG_ON}',20) t;`) === "1" &&
    jget(`select count(*) from agent.pending_approvals('t2','${AG_ON}',20) t;`) === "0");
  check("one run's list carries the verdict and the hash the decision is bound to",
    jget(`select count(*) from agent.run_approvals('t1','${AP_RUN}') t;`) === "2" &&
    jget(`select count(*) from agent.run_approvals('t2','${AP_RUN}') t;`) === "0");

  // ── the grants ────────────────────────────────────────────────────────────
  check("⚠ a client may READ its own waiting calls and WRITE none of it",
    jget(`select has_table_privilege('authenticated','agent.tool_approvals','select')::text || '|'
            || has_table_privilege('authenticated','agent.tool_approvals','insert')::text || '|'
            || has_table_privilege('authenticated','agent.tool_approvals','update')::text || '|'
            || has_table_privilege('anon','agent.tool_approvals','select')::text;`, asOwner) === "true|false|false|false");
  for (const fn of ["agent.request_tool_approval(text, uuid, uuid, integer, integer, text, jsonb, text, uuid)",
                    "agent.decide_tool_approval(text, uuid, text, text, text)",
                    "agent.pending_approvals(text, uuid, integer)",
                    "agent.run_approvals(text, uuid)"]) {
    check(`⚠ only the backend may call ${fn.split("(")[0]}`,
      jget(`select has_function_privilege('service_role','${fn}','execute')::text || '|'
              || has_function_privilege('authenticated','${fn}','execute')::text || '|'
              || has_function_privilege('anon','${fn}','execute')::text;`) === "true|false|false");
  }
  check("⚠ and RLS is FORCED, so even the table's owner is filtered",
    jget(`select relrowsecurity::text || '|' || relforcerowsecurity::text
            from pg_class where oid = 'agent.tool_approvals'::regclass;`, asOwner) === "true|true");
  check("⚠ every one of the four pins an empty search_path and runs as its owner",
    jget(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname='agent'
              and p.proname in ('request_tool_approval','decide_tool_approval',
                                'pending_approvals','run_approvals')
              and p.prosecdef and 'search_path=""' = any(p.proconfig);`) === "4");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── AN OPERATION HAPPENS ONCE, HOWEVER MANY TIMES IT IS DELIVERED ──");
  // ══════════════════════════════════════════════════════════════════════════
  // The engine half is demonstrated by `npm run verify:ops`; what is proved HERE is what the
  // DATABASE guarantees on its own, including the things no JavaScript check can see.
  {
    const OT = "op-tenant-1";
    const OA = "dddddddd-1111-4111-8111-dddddddddddd";
    const OKEY = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa:3:0";
    const HASH = "abc123";
    psql(`insert into agent.agents (id, tenant_id, name, instructions)
          values ('${OA}', '${OT}', 'Ops', 'x');`, asWriter);

    // FRESH, then a claim, then a repeat — the three answers, in order.
    check("an unseen operation is `fresh`",
      jget(`select agent.operation_check('${OT}', '${OKEY}', 'save_memory', '${HASH}') ->> 'state';`) === "fresh");
    check("recording it answers that it was ours to record",
      jget(`select agent.operation_record('${OT}', '${OKEY}', 'save_memory', '${HASH}', null,
             '{"ok": true, "saved": "created"}'::jsonb)::text;`) === "true");
    check("⚠ ...and the same key now answers `repeat` WITH THE OUTCOME",
      jget(`select agent.operation_check('${OT}', '${OKEY}', 'save_memory', '${HASH}') -> 'outcome' ->> 'saved';`) === "created");
    check("recording it AGAIN answers that somebody else had it",
      jget(`select agent.operation_record('${OT}', '${OKEY}', 'save_memory', '${HASH}', null,
             '{"ok": true, "saved": "corrected"}'::jsonb)::text;`) === "false");
    check("⚠ ...and the FIRST outcome still stands — a record does not move",
      jget(`select outcome ->> 'saved' from agent.operations where tenant_id='${OT}' and op_key='${OKEY}';`) === "created");

    // ⚠ THE SAME KEY WITH DIFFERENT ARGUMENTS, WHICH IS THE REQUIREMENT'S OWN CASE.
    check("⚠ the same key with DIFFERENT arguments is `mismatch`, never a second operation",
      jget(`select agent.operation_check('${OT}', '${OKEY}', 'save_memory', 'something-else') ->> 'state';`) === "mismatch");
    check("⚠ ...and the same key for a different ACTION is a mismatch too",
      jget(`select agent.operation_check('${OT}', '${OKEY}', 'delete_memory', '${HASH}') ->> 'state';`) === "mismatch");

    // ⚠ THE KEY IS THE ACCOUNT'S. One key, two accounts, two operations — or one account's
    // retry would be answered with another's outcome.
    check("⚠ the same key in another account is `fresh`",
      jget(`select agent.operation_check('op-tenant-2', '${OKEY}', 'save_memory', '${HASH}') ->> 'state';`) === "fresh");

    // AN OUTCOME IS REQUIRED. A row with none would be a claim a retry cannot be answered
    // from, and `unfinished` exists to name it rather than read it as a repeat with nothing.
    refused("an operation record with no outcome is refused",
      `select agent.operation_record('${OT}', 'no-outcome:1:0', 'save_memory', '${HASH}', null, null);`,
      "an outcome is required", asWriter);

    // THE SHAPE CONSTRAINTS, each read for ITS OWN name.
    refused("a key with whitespace in it is refused",
      `insert into agent.operations (tenant_id, op_key, action, args_hash, outcome)
       values ('${OT}', 'a key:1:0', 'save_memory', '${HASH}', '{}'::jsonb);`,
      "operations_key_shaped", asWriter);
    refused("an action that is not an identifier is refused",
      `insert into agent.operations (tenant_id, op_key, action, args_hash, outcome)
       values ('${OT}', 'k1:1:0', 'Save Memory', '${HASH}', '{}'::jsonb);`,
      "operations_action_shaped", asWriter);
    refused("a hash with a quote in it is refused",
      `insert into agent.operations (tenant_id, op_key, action, args_hash, outcome)
       values ('${OT}', 'k2:1:0', 'save_memory', 'ab''c', '{}'::jsonb);`,
      "operations_hash_shaped", asWriter);
    allowed("THE CONTROL: an ordinary record really is accepted",
      `insert into agent.operations (tenant_id, op_key, action, args_hash, outcome)
       values ('${OT}', 'k3:1:0', 'save_memory', '${HASH}', '{"ok": true}'::jsonb);`, asWriter);

    // ⚠ A RECORD CANNOT BE REWRITTEN OR REMOVED, BY ANYBODY THE PLATFORM RUNS AS. Asked as a
    // PRIVILEGE rather than as a refusal: `authenticated` holds no USAGE on this schema, so a
    // refusal there would say nothing about the table grant.
    check("⚠ the writer may insert and read and NOTHING else",
      jget(`select has_table_privilege('service_role', 'agent.operations', 'INSERT')::text || ' '
                 || has_table_privilege('service_role', 'agent.operations', 'SELECT')::text || ' '
                 || has_table_privilege('service_role', 'agent.operations', 'UPDATE')::text || ' '
                 || has_table_privilege('service_role', 'agent.operations', 'DELETE')::text;`) === "true true false false");
    check("a tenant may read its own records and write none",
      jget(`select has_table_privilege('authenticated', 'agent.operations', 'SELECT')::text || ' '
                 || has_table_privilege('authenticated', 'agent.operations', 'INSERT')::text;`) === "true false");
    check("⚠ ...and RLS is enabled AND forced, so the table's owner is not exempt either",
      jget(`select relrowsecurity::text || ' ' || relforcerowsecurity::text
              from pg_class where oid = 'agent.operations'::regclass;`) === "true true");
    check("only the backend may call either helper",
      jget(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname='agent' and p.proname in ('operation_check','operation_record')
               and has_function_privilege('service_role', p.oid, 'EXECUTE')
               and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
               and not has_function_privilege('anon', p.oid, 'EXECUTE');`) === "2");
    /**
     * ⚠ **EVERY WRAPPER AND BOTH HELPERS PIN AN EMPTY `search_path` AND RUN AS THEIR OWNER.**
     *
     * **RE-ANCHORED, NOT APPEASED.** This read `=== "8"` — a hand-typed count, which is this
     * repository's own "two copies of one thing": it fires on every honest addition (it did,
     * the day `patch_automation_once` arrived) and it says nothing about the property. What
     * matters is that NONE of them is missing the pin, so the question is asked as a
     * comparison between how many exist and how many are right, with the names of any that
     * are not — and a floor, so an empty set cannot satisfy it.
     */
    const pinnable = `n.nspname='agent'
               and (p.proname like '%\\_once' or p.proname in ('operation_check','operation_record'))`;
    const pinned = `p.prosecdef and 'search_path=""' = any(p.proconfig)`;
    const allWrappers = jget(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where ${pinnable};`);
    const unpinned = jget(`select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where ${pinnable} and not (${pinned});`);
    check("⚠ every wrapper and both helpers pin an empty search_path and run as their owner",
      Number(allWrappers) >= 8 && unpinned === "",
      `${allWrappers} such functions; unpinned: ${unpinned || "(none)"}`);

    // ⚠ A WRAPPER DOES THE WORK ONCE AND THE ROW PROVES IT. This is the whole guarantee, in
    // the database, with no engine in front of it.
    const MK = `${OKEY.slice(0, -3)}:9:0`;
    const memOf = () => jget(`select coalesce(max(value || '/v' || version), '(none)') from agent.agent_memory
                               where tenant_id='${OT}' and agent_id='${OA}' and key='tone';`);
    check("the wrapper writes the fact", jget(`select agent.save_memory_once('${OT}', '${MK}', '${HASH}', null,
             '${OA}'::uuid, 'tone', 'formal', null, 'run', 100) ->> 'saved';`) === "created" && memOf() === "formal/v1",
      memOf());
    psql(`select agent.save_memory('${OT}', '${OA}'::uuid, 'tone', 'casual', null, 'person', 100);`, asWriter);
    check("somebody corrects it, through the UNCHANGED function", memOf() === "casual/v2", memOf());
    check("⚠ the same wrapper call again is a REPEAT and writes nothing",
      jget(`select (agent.save_memory_once('${OT}', '${MK}', '${HASH}', null,
             '${OA}'::uuid, 'tone', 'formal', null, 'run', 100) -> 'repeat')::text;`) === "true" && memOf() === "casual/v2",
      memOf());
    check("⚠ ...and a DIFFERENT call in that slot is refused, having written nothing",
      jget(`select agent.save_memory_once('${OT}', '${MK}', 'other-hash', null,
             '${OA}'::uuid, 'tone', 'breezy', null, 'run', 100) ->> 'error';`) === "operation-mismatch" && memOf() === "casual/v2",
      memOf());
    // AND A GENUINE REFUSAL IS NOT SWALLOWED BY THE WRAPPER. The record arbitrates a lost
    // race; it must not turn a real refusal into a quiet success.
    check("⚠ a refusal from the inner function comes through the wrapper as itself",
      jget(`select agent.save_memory_once('${OT}', '${OKEY.slice(0, -3)}:11:0', '${HASH}', null,
             '${OA}'::uuid, 'Bad Name', 'x', null, 'run', 100) ->> 'error';`) === "bad-name");
    check("⚠ ...and a refusal is recorded, so its retry answers the same thing rather than re-running",
      jget(`select count(*) from agent.operations where tenant_id='${OT}' and op_key='${OKEY.slice(0, -3)}:11:0';`) === "1");
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── EXPIRY, REVOCATION AND CANCELLATION ──");
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠ FOUR DIFFERENT FACTS, and collapsing any two loses a real distinction: nobody answered
  // in time; somebody withdrew a decision; somebody took a TOOL away; somebody stopped the
  // RUN. Every read of `agent.tool_approvals` below is `asOwner`, because `force row level
  // security` filters `service_role` too and a filtered read is indistinguishable from a row
  // that was never written.
  {
    const XT = "rv-tenant-1";
    const XA = "cccccccc-1111-4111-8111-cccccccccccc";
    const XA2 = "cccccccc-2222-4222-8222-cccccccccccc";
    const R1 = "ff000000-0000-0000-0000-0000000000f1";
    const R2 = "ff000000-0000-0000-0000-0000000000f2";
    const R3 = "ff000000-0000-0000-0000-0000000000f3";
    allowed("two agents of one account, and three runs to act on",
      `insert into agent.agents (id, tenant_id, name, instructions) values
         ('${XA}', '${XT}', 'Rv', 'x'), ('${XA2}', '${XT}', 'Sibling', 'x');
       insert into agent.runs (id, tenant_id, status) values
         ('${R1}','${XT}','running'), ('${R2}','${XT}','running'), ('${R3}','${XT}','running');`, asOwner);

    // ── 1. THE WINDOW ─────────────────────────────────────────────────────
    const asked = jget(`select agent.request_tool_approval('${XT}','${R1}','${XA}',1,0,
      'run_automation','{"id":"a-1"}'::jsonb,'h1')::text;`);
    check("a request is stamped with a window, and reads as neither decided nor expired",
      /"expiresAt"\s*:\s*"/.test(asked) && /"verdict"\s*:\s*null/.test(asked)
      && /"expired"\s*:\s*false/.test(asked), asked);
    // ⚠ THE WINDOW IS THE SERVER'S FUNCTION, not a number written twice. A caller-chosen one
    // is a window a model can widen, and this is the wall that closes an unanswered request.
    check("⚠ the window is exactly `approval_window()` past the request, not a second copy of it",
      jget(`select (expires_at = requested_at + agent.approval_window())::text
              from agent.tool_approvals where run_id='${R1}' and step=1 and idx=0;`, asOwner) === "true");
    const ap1 = jget(`select id::text from agent.tool_approvals where run_id='${R1}' and step=1 and idx=0;`, asOwner);

    // ⚠ A ROW WRITTEN BEFORE THIS MIGRATION HAS NO WINDOW, AND THAT READS AS *NO WINDOW*
    // rather than as expired. The only safe direction: the other reading refuses every
    // request in flight the moment this ships.
    allowed("a request from before the window existed", `update agent.tool_approvals set expires_at = null where id='${ap1}';`, asOwner);
    check("⚠ a request with NO window is not expired — absent is not closed",
      /"expired"\s*:\s*false/.test(jget(`select agent.request_tool_approval('${XT}','${R1}','${XA}',1,0,
        'run_automation','{"id":"a-1"}'::jsonb,'h1')::text;`)));
    allowed("...and it is given one back for the checks below",
      `update agent.tool_approvals set expires_at = requested_at + agent.approval_window() where id='${ap1}';`, asOwner);

    // ── 2. AN UNANSWERED REQUEST PAST ITS WINDOW ──────────────────────────
    allowed("the window closes", `update agent.tool_approvals set expires_at = now() - interval '1 minute' where id='${ap1}';`, asOwner);
    const late = jget(`select agent.request_tool_approval('${XT}','${R1}','${XA}',1,0,
      'run_automation','{"id":"a-1"}'::jsonb,'h1')::text;`);
    check("⚠ an unanswered request past its window reads `expired`",
      /"verdict"\s*:\s*"expired"/.test(late) && /"expired"\s*:\s*true/.test(late), late);
    // ⚠ AND NOTHING WENT ROUND STAMPING IT. Expiry is DERIVED from the clock, so the column
    // still says nobody decided — which is true, and is why there is no second writer.
    check("⚠ ...and the VERDICT COLUMN is still null, because expiry is derived and not written",
      jget(`select coalesce(verdict, 'NULL') from agent.tool_approvals where id='${ap1}';`, asOwner) === "NULL");
    check("⚠ an expired request CANNOT BE DECIDED — the window closed",
      jget(`select agent.decide_tool_approval('${XT}','${ap1}','approved','ok','person-1')->>'error';`) === "expired");
    check("...and nothing was written by that attempt",
      jget(`select coalesce(verdict, 'NULL') || '/' || coalesce(decided_by, 'NULL')
              from agent.tool_approvals where id='${ap1}';`, asOwner) === "NULL/NULL");
    // ⚠ A DECISION ALREADY MADE STANDS, however long ago the window closed — it was made in
    // time, and the repeat check is deliberately asked BEFORE the window for that reason.
    allowed("a second request, decided and then left to go stale",
      `select agent.request_tool_approval('${XT}','${R1}','${XA}',2,0,'pause_automation','{}'::jsonb,'h2');`, asOwner);
    const ap2 = jget(`select id::text from agent.tool_approvals where run_id='${R1}' and step=2;`, asOwner);
    check("a fresh request is decided inside its window",
      jget(`select agent.decide_tool_approval('${XT}','${ap2}','approved','fine','person-1')->>'verdict';`) === "approved");
    allowed("...and then the window closes", `update agent.tool_approvals set expires_at = now() - interval '1 day' where id='${ap2}';`, asOwner);
    const stood = jget(`select agent.request_tool_approval('${XT}','${R1}','${XA}',2,0,'pause_automation','{}'::jsonb,'h2')::text;`);
    check("⚠ a DECIDED request keeps its verdict past the window — it was answered in time",
      /"verdict"\s*:\s*"approved"/.test(stood) && /"expired"\s*:\s*false/.test(stood), stood);
    check("⚠ ...and deciding it again answers the FIRST decision rather than the window",
      jget(`select agent.decide_tool_approval('${XT}','${ap2}','rejected','no','person-2')->>'verdict';`) === "approved");

    // `revoked` IS NOT A VERDICT A DECISION MAY SET: withdrawing is its own verb, so a caller
    // cannot reach it through the approve/reject door and skip that function's own rules.
    check("⚠ a decision cannot set `revoked` — that is its own verb",
      jget(`select agent.decide_tool_approval('${XT}','${ap1}','revoked','x','person-1')->>'error';`) === "bad-verdict");
    // ⚠ A DECISION IS WHOLE OR ABSENT (`tool_approvals_decision_is_whole`), so a raw verdict
    // has to carry its decider and its time — which is why these two set all three. Written
    // after the first draft set only `verdict` and was refused by the wrong gate.
    refused("...and the column itself refuses anything but the three",
      `update agent.tool_approvals set verdict = 'maybe', decided_at = now(), decided_by = 'x' where id='${ap1}';`,
      "tool_approvals_verdict_known", asOwner);
    allowed("THE CONTROL: `revoked` really is one of the three the column admits",
      `update agent.tool_approvals set verdict = 'revoked', decided_at = now(), decided_by = 'x' where id='${ap1}';
       update agent.tool_approvals set verdict = null, decided_at = null, decided_by = null where id='${ap1}';`, asOwner);

    // ── 3. WITHDRAWING ONE REQUEST ────────────────────────────────────────
    allowed("a third request, pending", `select agent.request_tool_approval('${XT}','${R2}','${XA}',1,0,'run_automation','{}'::jsonb,'h3');`, asOwner);
    const ap3 = jget(`select id::text from agent.tool_approvals where run_id='${R2}' and step=1;`, asOwner);
    const withdrew = jget(`select agent.revoke_tool_approval('${XT}','${ap3}','person-1','asked by mistake')::text;`);
    check("⚠ a pending request can be WITHDRAWN, which is not a rejection",
      /"ok"\s*:\s*true/.test(withdrew) &&
      jget(`select verdict || '/' || decided_by || '/' || note from agent.tool_approvals where id='${ap3}';`, asOwner)
        === "revoked/person-1/asked by mistake", withdrew);
    check("⚠ withdrawing puts the run back on the queue, so it is not left waiting for ever",
      jget(`select (claimed_by is null and done_at is null)::text from agent.run_work where run_id='${R2}';`) === "true"
      || jget(`select count(*) from agent.run_work where run_id='${R2}';`) === "0");
    check("a withdrawal nobody can be tied to is refused",
      jget(`select agent.revoke_tool_approval('${XT}','${ap3}','   ',null)->>'error';`) === "no-decider");
    check("⚠ another account's request is `no-request`, never `forbidden`",
      jget(`select agent.revoke_tool_approval('rv-tenant-2','${ap3}','person-1',null)->>'error';`) === "no-request");

    // ── 4. TAKING A TOOL AWAY ─────────────────────────────────────────────
    allowed("a pending request for the tool about to be taken away",
      `select agent.request_tool_approval('${XT}','${R3}','${XA}',1,0,'run_automation','{}'::jsonb,'h4');`, asOwner);
    const tookAway = jget(`select agent.revoke_agent_tool('${XT}','${XA}','run_automation','person-1','not this agent')::text;`);
    check("⚠ a tool can be taken away from one agent",
      /"ok"\s*:\s*true/.test(tookAway) &&
      jget(`select count(*) from agent.tool_revocations where tenant_id='${XT}' and agent_id='${XA}' and tool='run_automation';`) === "1",
      tookAway);
    // ⚠ AND EVERY REQUEST STILL WAITING FOR IT GOES WITH IT. Leaving one pending would let
    // somebody approve a call the permission for which has just been withdrawn — the approval
    // and the permission disagreeing, with the approval winning.
    check("⚠ ...and every request still waiting for that tool is withdrawn with it",
      jget(`select verdict from agent.tool_approvals where run_id='${R3}' and step=1;`, asOwner) === "revoked");
    check("⚠ a revoked permission is not REQUESTED at all — nobody is asked a settled question",
      /"revokedPermission"\s*:\s*true/.test(jget(`select agent.request_tool_approval('${XT}','${R3}','${XA}',7,0,
        'run_automation','{}'::jsonb,'h5')::text;`)) &&
      jget(`select count(*) from agent.tool_approvals where run_id='${R3}' and step=7;`, asOwner) === "0");
    check("the engine reads what is revoked for one agent",
      jget(`select coalesce(string_agg(t, ','), 'NONE') from agent.revoked_tools('${XT}','${XA}') as t;`) === "run_automation");

    /**
     * ⚠ **AND A REQUEST WHOSE RUN HAS ALREADY ENDED IS LEFT ALONE — MEASURED, AND WITHOUT THIS
     * A FINISHED RUN WENT BACK ON THE QUEUE FOR EVER.** `verdict is null` matches an EXPIRED
     * request too (an expiry is derived from the clock and deliberately never written as a
     * verdict), so a run the expiry sweep had already run to a stop still had an undecided
     * request here — and the withdraw loop REQUEUED it. Read off `verify:send`: the delivery
     * re-ran it from its recorded position, met its own `stopped` entry at the fence, was
     * released UNFINISHED as `conflict`, and `sweep_run_work` offered it again every minute;
     * `attempts` reached 4 and was climbing.
     *
     * Two things are asserted, because they are two properties: the request is NOT decided
     * (writing `decided_by` over an unanswerable request would record a person deciding a call
     * already dealt with — `decide_tool_approval` refuses a finished run), and the run is NOT
     * put back. **Its CONTROL is the run beside it that is still going**, which must still be
     * withdrawn and requeued — without that, both assertions are satisfied by a revocation
     * that stopped withdrawing anything at all.
     */
    const RD = "ff000000-0000-0000-0000-0000000000f4";   // a run that has ENDED
    const RL = "ff000000-0000-0000-0000-0000000000f5";   // a run that is still going
    allowed("a run that has ended and one that has not, each waiting on the same tool",
      `insert into agent.runs (id, tenant_id, status) values ('${RD}','${XT}','running'), ('${RL}','${XT}','running');
       insert into agent.run_work (run_id, tenant_id, kind, done_at) values
         ('${RD}','${XT}','start', now()), ('${RL}','${XT}','start', now());
       select agent.request_tool_approval('${XT}','${RD}','${XA2}',1,0,'forget','{}'::jsonb,'hd');
       select agent.request_tool_approval('${XT}','${RL}','${XA2}',1,0,'forget','{}'::jsonb,'hl');
       insert into agent.run_entries (run_id, seq, body) values
         ('${RD}', 9, '{"kind":"stopped","at":1,"stop":{"reason":"failed"}}'::jsonb);`, asOwner);
    const both = jget(`select agent.revoke_agent_tool('${XT}','${XA2}','forget','person-9',null)::text;`);
    check("⚠ a revocation leaves a request alone when its run has already ended",
      jget(`select coalesce(verdict,'UNDECIDED') from agent.tool_approvals where run_id='${RD}';`, asOwner)
        === "UNDECIDED", both);
    check("⚠ ...and does NOT put that finished run back on the queue",
      jget(`select (done_at is not null)::text from agent.run_work where run_id='${RD}';`, asOwner) === "true");
    check("⚠ CONTROL: the run beside it that is still going IS withdrawn and put back",
      jget(`select verdict from agent.tool_approvals where run_id='${RL}';`, asOwner) === "revoked"
      && jget(`select (done_at is null)::text from agent.run_work where run_id='${RL}';`, asOwner) === "true"
      && /"withdrew"\s*:\s*1/.test(both), both);
    allowed("lift it again so the section's later checks read what they expect",
      `select agent.restore_agent_tool('${XT}','${XA2}','forget');`, asOwner);
    // ⚠ SCOPED TO THE AGENT, WHICH IS THE WALL NO TENANT FILTER CAN SEE: both agents share an
    // owner, so only the agent id tells them apart.
    check("⚠ ...and the SIBLING agent of the same account is unaffected",
      jget(`select coalesce(string_agg(t, ','), 'NONE') from agent.revoked_tools('${XT}','${XA2}') as t;`) === "NONE");
    check("...and another account reads nothing at all",
      jget(`select coalesce(string_agg(t, ','), 'NONE') from agent.revoked_tools('rv-tenant-2','${XA}') as t;`) === "NONE");
    check("a revocation nobody can be tied to is refused, and writes nothing",
      jget(`select agent.revoke_agent_tool('${XT}','${XA}','pause_automation','','x')->>'error';`) === "no-decider" &&
      jget(`select count(*) from agent.tool_revocations where agent_id='${XA}';`) === "1");
    check("a tool name that is not one is refused BY NAME, not stored",
      jget(`select agent.revoke_agent_tool('${XT}','${XA}','not a tool name!','person-1',null)->>'error';`) === "bad-tool");
    check("⚠ an agent of another account is `no-agent`, and nothing is written",
      jget(`select agent.revoke_agent_tool('rv-tenant-2','${XA}','pause_automation','person-1',null)->>'error';`) === "no-agent" &&
      jget(`select count(*) from agent.tool_revocations where agent_id='${XA}';`) === "1");
    check("revoking the same tool twice is one revocation",
      /"ok"\s*:\s*true/.test(jget(`select agent.revoke_agent_tool('${XT}','${XA}','run_automation','person-2',null)::text;`)) &&
      jget(`select count(*) from agent.tool_revocations where agent_id='${XA}';`) === "1");

    // ⚠ A REVOCATION THAT LANDS BETWEEN A REQUEST AND THE PRESS must not be approvable. A
    // DECLARED second wall: `revoke_agent_tool` withdraws what is pending, so this covers the
    // row it raced rather than the ordinary case.
    allowed("a request made before the tool was taken away",
      `insert into agent.tool_approvals (id, tenant_id, run_id, agent_id, step, idx, tool, args, args_hash, expires_at)
       values (gen_random_uuid(), '${XT}','${R3}','${XA}',8,0,'run_automation','{}'::jsonb,'h6', now() + interval '1 day');`, asOwner);
    const raced = jget(`select id::text from agent.tool_approvals where run_id='${R3}' and step=8;`, asOwner);
    check("⚠ a request whose PERMISSION was withdrawn cannot be decided",
      jget(`select agent.decide_tool_approval('${XT}','${raced}','approved','ok','person-1')->>'error';`) === "revoked-permission");

    // ── 5. LIFTING A REVOCATION ───────────────────────────────────────────
    const lifted = jget(`select agent.restore_agent_tool('${XT}','${XA}','run_automation')::text;`);
    check("a revocation can be lifted", /"lifted"\s*:\s*true/.test(lifted) &&
      jget(`select count(*) from agent.tool_revocations where agent_id='${XA}';`) === "0", lifted);
    // ⚠ AND IT DOES NOT BRING BACK WHAT IT WITHDREW. Those were answered — by the revocation —
    // and re-opening them would put a decision in front of somebody who has already made one.
    check("⚠ ...and the requests it withdrew stay withdrawn — the agent asks again if it still wants the call",
      jget(`select verdict from agent.tool_approvals where run_id='${R3}' and step=1;`, asOwner) === "revoked");
    check("lifting one that is not there says so rather than pretending",
      /"lifted"\s*:\s*false/.test(jget(`select agent.restore_agent_tool('${XT}','${XA}','run_automation')::text;`)));

    // ── 6. THE PRIVILEGES ON THE NEW TABLE ────────────────────────────────
    // ASKED AS PRIVILEGES rather than as refusals: `authenticated` holds no USAGE on the
    // schema, so a refusal says nothing about the table grant.
    check("⚠ no role may EDIT a revocation — added or lifted, never edited",
      jget(`select has_table_privilege('service_role','agent.tool_revocations','UPDATE')::text || '/'
                || has_table_privilege('authenticated','agent.tool_revocations','UPDATE')::text;`) === "false/false");
    check("a customer may READ its own revocations and write none of them",
      jget(`select has_table_privilege('authenticated','agent.tool_revocations','SELECT')::text || '/'
                || has_table_privilege('authenticated','agent.tool_revocations','INSERT')::text || '/'
                || has_table_privilege('authenticated','agent.tool_revocations','DELETE')::text;`) === "true/false/false");
    check("row level security is on AND forced, so the owner is not quietly exempt",
      jget(`select relrowsecurity::text || '/' || relforcerowsecurity::text
              from pg_class where oid = 'agent.tool_revocations'::regclass;`) === "true/true");

    // ⚠ AND THE POLICY IS ITS OWN QUESTION — ASKING THE PRIVILEGE SAYS NOTHING ABOUT IT.
    // The three checks above ask `has_table_privilege`, which is exactly right for the GRANT
    // and blind to the RLS policy; the comment introducing them reasons that a refusal would
    // come from the schema gate, which is TRUE OF THIS TABLE'S WRITES and false of its reads:
    // `grant usage on schema agent to authenticated` is in three migrations, so a customer
    // really does reach this table and `using (tenant_id = agent.tenant_id())` is the only
    // thing between one account and another's revocations.
    //
    // NOTHING ASKED IT UNTIL A SQL MUTANT WIDENING IT TO `using (true)` SURVIVED A WHOLE
    // SWEEP. So it is asked as a REAL CUSTOMER, the way every other table's isolation is,
    // with the OWNER's count of both rows as the observer — without which "sees one" is
    // satisfied by there being only one revocation in the table.
    const XT2 = "rv-tenant-2";
    const XA3 = "cccccccc-3333-4333-8333-cccccccccccc";
    const seenBy = (t) => psql(`select count(*) from agent.tool_revocations;`,
      { role: "authenticated", claims: `{"tenant_id":"${t}"}` }).out;
    allowed("a second account, with an agent of its own", `insert into agent.agents (id, tenant_id, name, instructions)
       values ('${XA3}', '${XT2}', 'Next door', 'x');`, asOwner);
    check("...and one revocation for EACH account, so neither read is about an empty table",
      /"ok"\s*:\s*true/.test(jget(`select agent.revoke_agent_tool('${XT}','${XA}','run_automation','person-1',null)::text;`))
      && /"ok"\s*:\s*true/.test(jget(`select agent.revoke_agent_tool('${XT2}','${XA3}','run_automation','person-9',null)::text;`))
      && jget(`select count(*) from agent.tool_revocations;`) === "2");
    check("⚠ a customer reads its OWN account's revocation and no other", seenBy(XT) === "1");
    check("⚠ ...and so does the account next door — one each, never both", seenBy(XT2) === "1");
    // The two ways a token fails, each its own reading: `agent.tenant_id()` answers NULL, and
    // `tenant_id = NULL` is NULL rather than true, so the policy matches no rows.
    check("a customer with no claims at all, and one whose claims will not parse, read none",
      psql(`select count(*) from agent.tool_revocations;`,
        { role: "authenticated", claims: "" }).out === "0"
      && psql(`select count(*) from agent.tool_revocations;`,
        { role: "authenticated", claims: "not json" }).out === "0");
    allowed("lift both and take the second account away, so section 7 reads what it expects",
      `select agent.restore_agent_tool('${XT}','${XA}','run_automation');
       select agent.restore_agent_tool('${XT2}','${XA3}','run_automation');
       delete from agent.agents where id='${XA3}';`, asOwner);

    // ── 7. CANCELLING A RUN ───────────────────────────────────────────────
    const C1 = "ff000000-0000-0000-0000-0000000000c1";
    allowed("a run part way through, with work claimed and a request waiting",
      `insert into agent.runs (id, tenant_id, status) values ('${C1}','${XT}','running');
       insert into agent.run_entries (run_id, seq, body) values
         ('${C1}', 0, '{"kind":"started","at":1}'::jsonb),
         ('${C1}', 1, '{"kind":"model","at":2,"step":1,"text":"","toolCalls":[{"id":"c0","name":"run_automation","args":{}}],"usage":{"inputTokens":1,"outputTokens":1}}'::jsonb),
         ('${C1}', 2, '{"kind":"tool","at":3,"step":1,"index":0,"name":"run_automation","ms":1,"ok":true,"value":{}}'::jsonb);
       insert into agent.run_work (run_id, tenant_id, claimed_by, claimed_at, lease_expires_at, claim_token)
         values ('${C1}','${XT}','worker-1', now(), now() + interval '90 seconds', gen_random_uuid());
       insert into agent.tool_approvals (id, tenant_id, run_id, agent_id, step, idx, tool, args, args_hash, expires_at)
         values (gen_random_uuid(), '${XT}','${C1}','${XA}',2,0,'pause_automation','{}'::jsonb,'h7', now() + interval '1 day');`, asOwner);
    const cancelled = jget(`select agent.cancel_run('${XT}','${C1}','person-1','changed my mind')::text;`);
    check("⚠ a run can be stopped, and the answer says WHAT HAD ALREADY COMPLETED",
      /"ok"\s*:\s*true/.test(cancelled) && /"completedSteps"\s*:\s*1/.test(cancelled)
      && /"completedCalls"\s*:\s*1/.test(cancelled), cancelled);
    // ⚠ AND IT DOES NOT CLAIM THEY WERE UNDONE, which is the requirement in as many words.
    check("⚠ ...and it says so rather than implying a rollback",
      /was not undone/.test(cancelled), cancelled);
    // ⚠ THE STOP IS NESTED UNDER `stop`, WHICH IS `stoppedEntry`'S OWN SHAPE and is what
    // `agent.project_entry` reads (`new.body -> 'stop'`). The first draft of `cancel_run` wrote
    // these at the top level: `status` still went to `stopped` — that arm only looks at `kind`
    // — and `agent.runs.stop` stayed NULL, so a cancelled run read as ended with nothing saying
    // how. Asserted through the PROJECTION as well as the entry, because that is what a reader
    // actually gets.
    check("exactly ONE stop entry, naming the cancellation and who asked for it",
      jget(`select count(*) from agent.run_entries where run_id='${C1}' and body->>'kind'='stopped';`, asOwner) === "1" &&
      jget(`select (body->'stop'->>'reason') || '/' || (body->'stop'->>'cancelledBy') || '/' || (body->'stop'->>'note')
              from agent.run_entries where run_id='${C1}' and body->>'kind'='stopped';`, asOwner)
        === "cancelled/person-1/changed my mind");
    check("⚠ ...and the RUN's own projection carries it, which is what any reader gets",
      jget(`select (stop->>'reason') || '/' || (stop->>'cancelledBy') || '/' || (stop->>'completedSteps')
              from agent.runs where id='${C1}';`, asOwner) === "cancelled/person-1/1");
    check("⚠ the run reads as stopped, which is the LOG's own projection and not a column somebody set",
      jget(`select status from agent.runs where id='${C1}';`, asOwner) === "stopped");
    // PENDING WORK STOPS. The row is released and marked done, so nothing is delivered again
    // and whoever holds it fails its next checkpoint — the fence doing the stopping.
    check("⚠ the work is released and marked done, so nothing is delivered again",
      jget(`select (claimed_by is null and claim_token is null and done_at is not null)::text
              from agent.run_work where run_id='${C1}';`) === "true");
    check("⚠ and anything waiting for a person is withdrawn, not left on somebody's screen",
      jget(`select verdict from agent.tool_approvals where run_id='${C1}' and step=2;`, asOwner) === "revoked");
    // A SECOND CANCELLATION IS NOT A SECOND STOP. Its stop is what it ended as, and
    // overwriting it would lose that.
    const again = jget(`select agent.cancel_run('${XT}','${C1}','person-2',null)::text;`);
    check("⚠ cancelling twice answers what really happened and writes no second stop",
      /"repeat"\s*:\s*true/.test(again) && /"alreadyStopped"\s*:\s*true/.test(again) &&
      jget(`select count(*) from agent.run_entries where run_id='${C1}' and body->>'kind'='stopped';`, asOwner) === "1", again);
    check("...and the first stop is untouched, so a cancelled run stays cancelled by whoever cancelled it",
      jget(`select body->'stop'->>'cancelledBy' from agent.run_entries where run_id='${C1}' and body->>'kind'='stopped';`, asOwner) === "person-1");
    check("a cancellation nobody can be tied to is refused",
      jget(`select agent.cancel_run('${XT}','${C1}','  ',null)->>'error';`) === "no-decider");
    check("⚠ another account's run is `no-run`, and nothing is written",
      jget(`select agent.cancel_run('rv-tenant-2','${C1}','person-1',null)->>'error';`) === "no-run");

    // ⚠ A SUSPENDED AUTOMATION HAS ITS WAIT RELEASED, or the resume tick would wake something
    // that has been stopped.
    const C2 = "ff000000-0000-0000-0000-0000000000c2";
    allowed("a suspended automation execution", `
      insert into agent.automations (id, tenant_id, agent_id, name, steps, zone)
        values ('${C2}', '${XT}', '${XA}', 'w', '[{"id":"s1","type":"note","text":"x","out":null}]'::jsonb, 'UTC');
      insert into agent.runs (id, tenant_id, status) values ('${C2}','${XT}','running');
      insert into agent.run_entries (run_id, seq, body) values ('${C2}', 0, '{"kind":"started","at":1}'::jsonb);
      insert into agent.automation_runs (id, automation_id, tenant_id, trigger, steps, zone, waiting, wait_until)
        values ('${C2}', '${C2}', '${XT}', 'manual', '[{"id":"s1","type":"note","text":"x","out":null}]'::jsonb, 'UTC',
                '{"step":"s1","kind":"wait"}'::jsonb, now() + interval '1 hour');`, asOwner);
    const stoppedWait = jget(`select agent.cancel_run('${XT}','${C2}','person-1','no longer needed')::text;`);
    check("⚠ a cancelled execution's WAIT is released, so nothing wakes it later",
      /"releasedWait"\s*:\s*true/.test(stoppedWait) &&
      jget(`select (waiting is null and wait_until is null and finished_at is not null)::text
              from agent.automation_runs where id='${C2}';`) === "true", stoppedWait);

    // ── 7b. A RUN NOBODY ANSWERED IS PUT BACK, OR IT IS STRANDED FOR EVER ──
    // ⚠ BOTH OF THESE WERE FOUND BY DRIVING THE FEATURE AND NEITHER WAS OBVIOUS. A run waiting
    // for a person has its work row marked DONE, and `decide_tool_approval` is what puts it
    // back — so anything that answers a request INSTEAD of a person has to put it back too, or
    // the run reads as `running` for ever with nothing on any screen and no row to claim.
    const S1 = "ff000000-0000-0000-0000-0000000000s1".replace("s1", "a1");
    const S2 = "ff000000-0000-0000-0000-0000000000s2".replace("s2", "a2");
    allowed("two runs waiting for a person, with their work rows done as a held run's is", `
      insert into agent.runs (id, tenant_id, status) values ('${S1}','${XT}','running'), ('${S2}','${XT}','running');
      insert into agent.run_work (run_id, tenant_id, done_at) values ('${S1}','${XT}', now()), ('${S2}','${XT}', now());
      insert into agent.tool_approvals (id, tenant_id, run_id, agent_id, step, idx, tool, args, args_hash, expires_at)
        values (gen_random_uuid(),'${XT}','${S1}','${XA}',1,0,'remember','{}'::jsonb,'hA', now() - interval '1 minute'),
               (gen_random_uuid(),'${XT}','${S2}','${XA}',1,0,'remember','{}'::jsonb,'hB', now() + interval '1 day');`, asOwner);
    const swept = jget(`select coalesce(string_agg(t ->> 'run', ','), 'NONE') from agent.requeue_expired_approvals(25) as t;`);
    check("⚠ a run whose window closed is put back on the queue", swept === S1, swept);
    check("...and its work row really is claimable again",
      jget(`select (done_at is null and attempts = 0 and kind = 'resume')::text from agent.run_work where run_id='${S1}';`) === "true");
    // ⚠ AND A RUN SOMEBODY CAN STILL ANSWER IS LEFT ALONE, which is what stops this waking the
    // same run every minute for ever: a run holding one expired and one live request would be
    // requeued, hold again on the live one, and be requeued again.
    check("⚠ ...and a run somebody can still answer is left for them to answer",
      jget(`select (done_at is not null)::text from agent.run_work where run_id='${S2}';`) === "true");
    // ⚠ AND A RUN THAT HAS ALREADY ENDED IS NOT OFFERED, which is what stops a finished run
    // being delivered once a minute for the rest of time. **The first draft of this check was
    // VACUOUS** — an `||` that was satisfied by `S1` having no stop entry, which it did not —
    // so the run is really ended here first and the assertion is unconditional.
    allowed("the requeued run then ends, as a delivery would end it",
      `insert into agent.run_entries (run_id, seq, body) values
         ('${S1}', 0, '{"kind":"started","at":1}'::jsonb),
         ('${S1}', 1, '{"kind":"stopped","at":2,"stop":{"reason":"answered","text":"done"}}'::jsonb);`, asOwner);
    check("⚠ ...and a run that has already ended is not offered again",
      jget(`select count(*) from agent.requeue_expired_approvals(25) as t where t ->> 'run' = '${S1}';`) === "0");

    // ...AND A REVOCATION ANSWERS A REQUEST TOO, so it has to put its runs back as well.
    const S3 = "ff000000-0000-0000-0000-0000000000a3";
    allowed("a third run waiting on a tool about to be taken away", `
      insert into agent.runs (id, tenant_id, status) values ('${S3}','${XT}','running');
      insert into agent.run_work (run_id, tenant_id, done_at) values ('${S3}','${XT}', now());
      insert into agent.tool_approvals (id, tenant_id, run_id, agent_id, step, idx, tool, args, args_hash, expires_at)
        values (gen_random_uuid(),'${XT}','${S3}','${XA2}',1,0,'forget','{}'::jsonb,'hC', now() + interval '1 day');`, asOwner);
    const revokedBack = jget(`select agent.revoke_agent_tool('${XT}','${XA2}','forget','person-1',null)::text;`);
    check("⚠ taking a tool away puts back every run it just answered, and says which",
      /"withdrew"\s*:\s*1/.test(revokedBack) && revokedBack.includes(S3) &&
      jget(`select (done_at is null and kind = 'resume')::text from agent.run_work where run_id='${S3}';`) === "true",
      revokedBack);

    // ── 8. THE FUNCTIONS THEMSELVES ───────────────────────────────────────
    check("⚠ every new function is `security definer` with an EMPTY search_path",
      jget(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'agent'
               and p.proname in ('revoke_agent_tool','restore_agent_tool','revoked_tools',
                                 'revoke_tool_approval','cancel_run','requeue_expired_approvals')
               and p.prosecdef and 'search_path=""' = any(p.proconfig);`) === "6");
    // `approval_window` is the one that is NOT definer, deliberately: it reads nothing.
    check("...and the window function reads nothing, so it needs no privilege of its own",
      // `provolatile` is of type "char", which has no `text || "char"` operator at all — so
      // without the cast the statement RAISES and `jget` answers "", which reads as a wrong
      // value rather than as a broken query.
      jget(`select (not prosecdef)::text || '/' || provolatile::text from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
             where n.nspname='agent' and p.proname='approval_window';`) === "true/i");
    check("⚠ none of the five is callable by a customer — the backend alone, as with every operation here",
      jget(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'agent'
               and p.proname in ('revoke_agent_tool','restore_agent_tool','revoked_tools',
                                 'revoke_tool_approval','cancel_run','requeue_expired_approvals')
               and has_function_privilege('authenticated', p.oid, 'EXECUTE');`) === "0");
    check("THE CONTROL: the backend really may call all five",
      jget(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'agent'
               and p.proname in ('revoke_agent_tool','restore_agent_tool','revoked_tools',
                                 'revoke_tool_approval','cancel_run','requeue_expired_approvals')
               and has_function_privilege('service_role', p.oid, 'EXECUTE');`) === "6");

    // ── 9. WHAT THE TWO LIST VIEWS SAY ABOUT AN EXPIRED REQUEST ───────────
    // ⚠ THEY ANSWER DIFFERENTLY ON PURPOSE. `pending_approvals` is what a screen draws as
    // "waiting for you", and a closed window is not waiting for anybody. `run_approvals` is
    // one run's whole story, where the expired row is exactly what explains the run.
    // ⚠ BOTH ANSWER `setof jsonb`, so a row IS the object — `where id = …` would be asking
    // about a column neither has, and the first draft did exactly that.
    //
    // ⚠ AND THIS SECTION MAKES ITS OWN EXPIRED ROW rather than reusing `ap1`. The first draft
    // read `ap1`, which by now is `revoked` — section 4's `revoke_agent_tool` withdrew every
    // pending request for that tool, which is the product being exactly right. So the
    // "expired is not offered" check would have passed because the row was WITHDRAWN, and the
    // projection check failed for the same reason. *A fixture that drifts under a later
    // section's correct behaviour tests something other than what it says.*
    allowed("an expired request of its own, for a tool nothing has revoked",
      `select agent.request_tool_approval('${XT}','${R1}','${XA}',6,0,'pause_automation','{}'::jsonb,'h8');
       update agent.tool_approvals set expires_at = now() - interval '1 minute'
        where run_id='${R1}' and step=6;`, asOwner);
    const apX = jget(`select id::text from agent.tool_approvals where run_id='${R1}' and step=6;`, asOwner);
    check("⚠ an expired request is NOT offered as something to answer",
      jget(`select count(*) from agent.pending_approvals('${XT}','${XA}',100) as t
             where t ->> 'id' = '${apX}';`) === "0");
    check("⚠ ...but a run's own list PROJECTS it as expired, because it is what explains the run",
      jget(`select t ->> 'verdict' from agent.run_approvals('${XT}','${R1}') as t
             where t ->> 'id' = '${apX}';`) === "expired");
    allowed("a request inside its window, for the control",
      `select agent.request_tool_approval('${XT}','${R1}','${XA}',5,0,'pause_automation','{}'::jsonb,'h9');`, asOwner);
    check("THE CONTROL: a pending request inside its window IS offered",
      jget(`select count(*) from agent.pending_approvals('${XT}','${XA}',100) as t
             where (t ->> 'step')::int = 5;`) === "1");
    check("...and a WITHDRAWN request is not offered either, for a different reason",
      jget(`select count(*) from agent.pending_approvals('${XT}','${XA}',100) as t
             where t ->> 'id' = '${ap1}';`) === "0" &&
      jget(`select t ->> 'verdict' from agent.run_approvals('${XT}','${R1}') as t
             where t ->> 'id' = '${ap1}';`) === "revoked");
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── WHAT A RUN IS REALLY DOING ──");
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠ **ONE WORD WAS DOING FIVE JOBS.** `agent.runs.status` is `new | running | stopped` and
  // is right about what it says; the CONVERSATION reader turned `running` into `working`, so
  // a run really thinking, a run waiting for a person and a run nothing will ever deliver
  // again all read as *working*, for ever. These two columns are the facts that tell them
  // apart, and they are checked HERE because the view is the only place they exist — a unit
  // guard can only ever assert what a fixture answered.
  {
    const ST = "st-tenant-1";
    // ⚠ **ITS OWN IDS, AND THEY ARE PROVED UNUSED BEFORE ANYTHING IS WRITTEN.** The first
    // draft reused `dddddddd-1111-…`, which an agent five hundred lines up already owns, so
    // the whole section failed on `agents_pkey` and reported thirteen correct behaviours as
    // broken. This file is one long body and its fixtures share a database: *a fixture that
    // collides with an id somewhere else in the file reports the product as broken*, and it
    // is recorded in this repository twice over. The census below is what makes it a
    // sentence rather than a cascade.
    const SG = "55aa55aa-1111-4111-8111-55aa55aa55aa";
    const W_OK = "55aa55aa-0000-4000-8000-0000000000a1";   // working: a batch fully answered
    const W_OPEN = "55aa55aa-0000-4000-8000-0000000000a2"; // unresolved: a call with no result
    const W_ASK = "55aa55aa-0000-4000-8000-0000000000a3";  // waiting: a person can answer
    const M_OK = "55aa55aa-0000-4000-8000-0000000000b1";
    const M_OPEN = "55aa55aa-0000-4000-8000-0000000000b2";
    const M_ASK = "55aa55aa-0000-4000-8000-0000000000b3";
    check("this section's own ids are not somebody else's",
      jget(`select (select count(*) from agent.agents where id='${SG}')
                 + (select count(*) from agent.runs where id in ('${W_OK}','${W_OPEN}','${W_ASK}'))
                 + (select count(*) from agent.agent_messages where id in ('${M_OK}','${M_OPEN}','${M_ASK}'));`) === "0");
    allowed("an account with three runs in three different real states",
      `insert into agent.agents (id, tenant_id, name, instructions) values ('${SG}','${ST}','St','x');
       insert into agent.runs (id, tenant_id, status) values
         ('${W_OK}','${ST}','running'), ('${W_OPEN}','${ST}','running'), ('${W_ASK}','${ST}','running');
       insert into agent.agent_messages (id, agent_id, body, run_id) values
         ('${M_OK}','${SG}','answered batch','${W_OK}'),
         ('${M_OPEN}','${SG}','a call with no result','${W_OPEN}'),
         ('${M_ASK}','${SG}','waiting on a person','${W_ASK}');`, asOwner);

    /** One model entry asking for `n` calls, and `answered` of them answered. */
    const batch = (run, n, answered) => {
      const calls = Array.from({ length: n }, (_, i) => `{"id":"c${i}","name":"remember","args":{}}`).join(",");
      psql(`insert into agent.run_entries (run_id, seq, body) values ('${run}', 0, '{"kind":"started","at":1}'::jsonb),
              ('${run}', 1, '{"kind":"model","at":2,"step":1,"text":"","toolCalls":[${calls}]}'::jsonb);`, asOwner);
      for (let i = 0; i < answered; i += 1) {
        psql(`insert into agent.run_entries (run_id, seq, body) values
                ('${run}', ${2 + i}, '{"kind":"tool","at":3,"step":1,"index":${i},"name":"remember","ms":1,"ok":true}'::jsonb);`, asOwner);
      }
    };
    batch(W_OK, 2, 2);
    batch(W_OPEN, 3, 1);
    batch(W_ASK, 1, 0);

    // ── THE COUNT COMES OUT OF THE LOG, which is the whole argument for it: the log is the
    // record, so the record can answer how far a batch got.
    check("a batch that was fully answered has NO open calls",
      jget(`select run_open_calls from agent.agent_thread where id='${M_OK}';`) === "0",
      jget(`select run_open_calls::text from agent.agent_thread where id='${M_OK}';`));
    check("⚠ a batch stopped part way counts EVERY call it never recorded",
      jget(`select run_open_calls from agent.agent_thread where id='${M_OPEN}';`) === "2",
      jget(`select run_open_calls::text from agent.agent_thread where id='${M_OPEN}';`));
    // AND IT NEVER GOES NEGATIVE. A log holding more tool entries than a model asked for is
    // not a state this product can write, but the view reads whatever is there — and a
    // negative count would read as a value to whichever branch tests `> 0`.
    psql(`insert into agent.run_entries (run_id, seq, body) values
            ('${W_OK}', 9, '{"kind":"tool","at":3,"step":1,"index":7,"name":"remember","ms":1,"ok":true}'::jsonb);`, asOwner);
    check("...and an impossible log floors at zero rather than answering a negative",
      jget(`select run_open_calls from agent.agent_thread where id='${M_OK}';`) === "0",
      jget(`select run_open_calls::text from agent.agent_thread where id='${M_OK}';`));
    psql(`delete from agent.run_entries where run_id='${W_OK}' and seq=9;`, asOwner);

    // ── WAITING MEANS A PERSON CAN STILL ANSWER, and each of the three ways that stops being
    // true is driven, because reading any of them as waiting leaves a run in a state whose
    // only exit is a decision nobody can make.
    // ⚠ **BOTH READERS MUST BE ABLE TO READ IT, AND THE SERVER IS THE ONE THAT NEARLY COULD
    // NOT.** `security_invoker` reads every relation as the CALLER, so the approvals lateral
    // needs the caller's own SELECT — measured: `authenticated` had it and `service_role` did
    // not, so the site's thread read would have failed `permission denied for table
    // tool_approvals` on every conversation with a message in it. Asked as a PRIVILEGE and
    // then DRIVEN as both roles over a row that really exists, because a lateral is never
    // evaluated for a row that is not there: read against an empty table the view answers
    // happily and the permission is never checked.
    for (const who of ["service_role", "authenticated"]) {
      check(`${who} may read the approvals the view reaches`,
        jget(`select has_table_privilege('${who}','agent.tool_approvals','select')::text;`) === "true");
    }
    check("a run with no request at all is not waiting for anybody",
      jget(`select run_awaiting::text from agent.agent_thread where id='${M_OPEN}';`) === "false",
      jget(`select coalesce(run_awaiting::text,'<read failed>') from agent.agent_thread where id='${M_OPEN}';`));
    const stAsk = jget(`select agent.request_tool_approval('${ST}','${W_ASK}','${SG}',1,0,
      'remember','{}'::jsonb,'sh1') ->> 'id';`);
    check("THE CONTROL: a pending request inside its window IS waiting",
      jget(`select run_awaiting::text from agent.agent_thread where id='${M_ASK}';`) === "true");
    // ⚠ AND IT IS THE RUN'S OWN REQUEST, never any request of this account's — without this
    // line, one person's unanswered question would put every one of their runs in the
    // waiting state.
    check("...and a request on ANOTHER run does not make this one wait",
      jget(`select run_awaiting::text from agent.agent_thread where id='${M_OK}';`) === "false");
    psql(`update agent.tool_approvals set expires_at = now() - interval '1 minute'
           where id='${stAsk}';`, asOwner);
    check("⚠ a request whose window has CLOSED is not waiting — nobody can answer it",
      jget(`select run_awaiting::text from agent.agent_thread where id='${M_ASK}';`) === "false");
    psql(`update agent.tool_approvals set expires_at = now() + interval '1 hour' where id='${stAsk}';`, asOwner);
    check("...back inside its window it waits again, which is what makes that line about the clock",
      jget(`select run_awaiting::text from agent.agent_thread where id='${M_ASK}';`) === "true");
    // `(p_tenant, p_id, p_verdict, p_note, p_by)` — five, and the note comes BEFORE the
    // decider. The first draft wrote six in another order and Postgres refused the call, so
    // the two checks under it failed about a decision that never happened.
    const decided = jget(`select agent.decide_tool_approval('${ST}','${stAsk}','approved',null,'person-1')::text;`);
    check("the decision really landed, which is what makes the next line about waiting",
      /"ok"\s*:\s*true/.test(decided), decided);
    check("⚠ a request somebody has ANSWERED is not waiting either",
      jget(`select run_awaiting::text from agent.agent_thread where id='${M_ASK}';`) === "false",
      jget(`select coalesce(run_awaiting::text,'<read failed>') from agent.agent_thread where id='${M_ASK}';`));

    // ── AND A CANCELLED RUN CARRIES HOW FAR IT GOT, which is the one honest thing to say
    // about it. *Don't claim completed effects were undone.*
    const cancelled = jget(`select agent.cancel_run('${ST}','${W_OPEN}','person-1','changed my mind')::text;`);
    check("cancelling reports what had already completed rather than implying a rollback",
      /"completedSteps"\s*:\s*1/.test(cancelled) && /"completedCalls"\s*:\s*1/.test(cancelled)
      && /was not undone/.test(cancelled), cancelled);
    check("⚠ the stop the CONVERSATION reads names the reason, who, and the counts",
      jget(`select (run_stop ->> 'reason') || '|' || (run_stop ->> 'cancelledBy') || '|' ||
                   (run_stop ->> 'completedSteps') || '|' || (run_stop ->> 'completedCalls')
              from agent.agent_thread where id='${M_OPEN}';`) === "cancelled|person-1|1|1",
      jget(`select coalesce(run_stop::text,'<null>') from agent.agent_thread where id='${M_OPEN}';`));
    // ⚠ AND THE STATUS REALLY MOVED, which is the half the first draft of `cancel_run` got
    // wrong: it wrote the reason at the TOP level of the entry body, so `status` went to
    // `stopped` (that arm only reads `kind`) while `agent.runs.stop` stayed NULL — a run
    // reading as ended with nothing saying how.
    check("...and the run reads as stopped, so the two halves of the projection agree",
      jget(`select run_status from agent.agent_thread where id='${M_OPEN}';`) === "stopped");

    // ── THE ISOLATION, THROUGH THE SAME TWO COLUMNS. They read three relations between them
    // — the log and the approvals — so `security_invoker` has to hold for both or a customer
    // could count another account's pending calls.
    const stClaim = { role: "authenticated", claims: `{"tenant_id":"${ST}"}` };
    const otherClaim = { role: "authenticated", claims: '{"tenant_id":"st-tenant-2"}' };
    check("the owning account reads its own counts through the view",
      psql(`select run_open_calls || '|' || run_awaiting::text from agent.agent_thread where id='${M_ASK}';`,
        stClaim).out === "1|false");
    check("⚠ ...and the account next door reads no row at all, so those numbers are theirs alone",
      psql(`select count(*) from agent.agent_thread where agent_id='${SG}';`, otherClaim).out === "0");
  }

// ══════════════════════════════════════════════════════════════════════════
// THE FIFTEEN A SWEEP FOUND, AND EVERY ONE WAS A GAP HERE
//
// ⚠ **THE SQL SWEEP RAN AND FIFTEEN MUTANTS SURVIVED — not one of them the schema's.**
// Each property is proved end to end by a `verify:*` script, and `npm run sweep:sql` runs
// THIS file and `authored-run.test.mjs` and nothing else. *A property proven only by an
// instrument the sweep cannot run is a property no mutant can be caught by*, which this
// directory has now recorded five times. They belong here: they are database guarantees,
// and this is the instrument a SQL mutant can be seen by.
//
// ⚠ AND ONE ATTRIBUTION IN THE NOTES WAS WRONG, found by measuring rather than reading:
// the stopword refusal and the memory scope were recorded as `test:pg`'s and were
// `verify:wf`'s. Measured by applying the mutant to the current tree — 763 passed, 0
// failed, with the wall deleted.
// ══════════════════════════════════════════════════════════════════════════
{
  console.log("\n── the fifteen a sweep found ──");
  // ⚠ ITS OWN IDS, AND A CENSUS THAT THEY ARE UNUSED. Reusing one cost this file seven
  // checks earlier today and thirteen in an earlier round.
  const SW_T = "sw-tenant-1", SW_T2 = "sw-tenant-2";
  const SW_AG = "ffff0000-0000-0000-0000-00000000a001";
  const SW_A1 = "ffff0000-0000-0000-0000-00000000b001";
  const SW_A2 = "ffff0000-0000-0000-0000-00000000b002";
  const SW_R1 = "ffff0000-0000-0000-0000-00000000c001";
  const SW_R2 = "ffff0000-0000-0000-0000-00000000c002";
  const SW_R3 = "ffff0000-0000-0000-0000-00000000c003";
  const SW_R4 = "ffff0000-0000-0000-0000-00000000c004";
  const mine = [SW_AG, SW_A1, SW_A2, SW_R1, SW_R2, SW_R3, SW_R4];
  check("this section's own ids are not somebody else's",
    jget(`select count(*) from agent.agents where id in ('${mine.join("','")}')`) === "0" &&
    jget(`select count(*) from agent.automations where id in ('${mine.join("','")}')`) === "0" &&
    jget(`select count(*) from agent.runs where id in ('${mine.join("','")}')`) === "0");

  const ONE = `'[{"id":"s1","type":"note","text":"hello"}]'::jsonb`;
  jget(`insert into agent.agents (id, tenant_id, name, instructions)
        values ('${SW_AG}','${SW_T}','Shop','Answer.');`);
  jget(`select agent.create_automation('${SW_T}','${SW_AG}','${SW_A1}','One',true,'manual',null,'UTC',${ONE})::text;`);
  jget(`select agent.create_automation('${SW_T}','${SW_AG}','${SW_A2}','Two',true,'manual',null,'UTC',${ONE})::text;`);

  // ── 1 & 2: EITHER IDENTITY IS ABSORBED, and a redelivery is answered rather than raised ──
  // A MANUAL execution has no occurrence, so the primary key is the only thing a repeated
  // `run_automation` can meet — and it used to meet it as an EXCEPTION, which reads to a
  // caller as a failure about work that really is queued and will run.
  const first = jget(`select agent.accept_automation_run('${SW_T}','${SW_A1}','${SW_R1}','manual',null)::text;`);
  check("a manual execution is accepted", /"ok"\s*:\s*true/.test(first) && !/"repeat"\s*:\s*true/.test(first), first);
  const twice = jget(`select agent.accept_automation_run('${SW_T}','${SW_A1}','${SW_R1}','manual',null)::text;`);
  check("⚠ the SAME run id again reads as a repeat rather than raising",
    /"repeat"\s*:\s*true/.test(twice) && twice.includes(SW_R1), twice);
  check("...and there is still exactly one execution and one work row",
    jget(`select count(*) from agent.automation_runs where automation_id='${SW_A1}';`) === "1" &&
    jget(`select count(*) from agent.run_work where run_id='${SW_R1}';`) === "1");
  // AND THE OCCURRENCE IS ABSORBED TOO, which is the other half of a bare `on conflict`.
  jget(`select agent.accept_automation_run('${SW_T}','${SW_A2}','${SW_R2}','schedule','2026-09-21')::text;`);
  const occTwice = jget(`select agent.accept_automation_run('${SW_T}','${SW_A2}','${SW_R3}','schedule','2026-09-21')::text;`);
  check("⚠ the same OCCURRENCE under a NEW run id is the first one's repeat",
    /"repeat"\s*:\s*true/.test(occTwice) && occTwice.includes(SW_R2), occTwice);
  check("...and no second execution was filed for it",
    jget(`select count(*) from agent.automation_runs where automation_id='${SW_A2}';`) === "1");

  // ── 3: A RUN ID BELONGING TO ANOTHER AUTOMATION IS NOT THIS ONE'S REPEAT ──
  // The probe is scoped to the automation, so pointing one execution's record at another's
  // is a caller error and meets the primary key — never a silent "already filed".
  // ⚠ MEASURED RATHER THAN GUESSED: I expected `automation_runs_pkey` and the answer is the
  // function's OWN raise — the insert meets the primary key, `on conflict do nothing` absorbs
  // it, and the re-read, which IS scoped to this automation, finds nothing. That is a better
  // gate to name than the constraint, because it is the one that separates "another
  // automation's run id" from "this automation's repeat": drop the scope and the very same
  // call answers `repeat: true` about work that is not this automation's.
  refused("⚠ a run id belonging to ANOTHER automation is not read as this one's repeat",
    `select agent.accept_automation_run('${SW_T}','${SW_A2}','${SW_R1}','manual',null);`,
    "conflicted with a row that is not there", asWriter);
  check("...and nothing was filed for the automation it was pointed at",
    jget(`select count(*) from agent.automation_runs where id='${SW_R1}' and automation_id='${SW_A2}';`) === "0");

  // ── 5 & 6: THE FIRST DECISION STANDS, AND IT NAMES WHO ANSWERED ──
  const SW_R5 = "ffff0000-0000-0000-0000-00000000c005";
  jget(`select agent.accept_automation_run('${SW_T}','${SW_A1}','${SW_R5}','manual',null)::text;`);
  const hold5 = jget(`select agent.claim_run('${SW_R5}','w-s',90)::text;`);
  const TOK5 = (JSON.parse(hold5).claim_token ?? "").trim();
  jget(`select agent.advance_automation_run('${SW_R5}','w-s','${TOK5}',
    '{"kind":"step","step":0,"at":1,"mark":"waiting","done":1}'::jsonb, 0, '{}'::jsonb,
    '[{"id":"s1","outcome":"waiting"}]'::jsonb,
    '{"kind":"approval","step":"s1","ask":"ok?","hours":24,"on_timeout":"reject"}'::jsonb)::text;`);
  const yes5 = jget(`select agent.decide_automation_approval('${SW_T}','${SW_R5}','s1','approved',null,null)::text;`);
  check("a decision is accepted", /"ok"\s*:\s*true/.test(yes5), yes5);
  // ⚠ **WITH NO DECIDER NAMED IT IS THE ACCOUNT THAT ANSWERED**, never a literal: a decision
  // nobody can be tied to is one nobody can be asked about afterwards.
  check("⚠ the stored decision names the account that answered",
    jget(`select decisions->'s1'->>'by' from agent.automation_runs where id='${SW_R5}';`) === SW_T);
  const no5 = jget(`select agent.decide_automation_approval('${SW_T}','${SW_R5}','s1','rejected','no',null)::text;`);
  check("⚠ a SECOND decision is absorbed and does not change the answer",
    /"repeat"\s*:\s*true/.test(no5) || /"verdict"\s*:\s*"approved"/.test(no5), no5);
  check("...and the FIRST verdict is what the row still holds",
    jget(`select decisions->'s1'->>'verdict' from agent.automation_runs where id='${SW_R5}';`) === "approved");

  // ── 7, 8 & 9: THE RESUME TICK — one taker, nothing finished, and a bound ──
  const due = (id, over = "") => {
    jget(`select agent.accept_automation_run('${SW_T}','${SW_A1}','${id}','manual',null)::text;`);
    const h = jget(`select agent.claim_run('${id}','w-d',90)::text;`);
    const t = (JSON.parse(h).claim_token ?? "").trim();
    jget(`select agent.advance_automation_run('${id}','w-d','${t}',
      '{"kind":"step","step":0,"at":2,"mark":"waiting","done":1}'::jsonb, 0, '{}'::jsonb,
      '[{"id":"s1","outcome":"waiting"}]'::jsonb,
      '{"kind":"wait","step":"s1","mode":"for","minutes":30}'::jsonb)::text;`);
    jget(`update agent.automation_runs set wait_until = now() - interval '5 minutes' ${over} where id='${id}';`);
  };
  const SW_D1 = "ffff0000-0000-0000-0000-00000000d001";
  const SW_D2 = "ffff0000-0000-0000-0000-00000000d002";
  const SW_D3 = "ffff0000-0000-0000-0000-00000000d003";
  due(SW_D1); due(SW_D2); due(SW_D3);
  const bounded = jget(`select count(*) from agent.resume_due_automations(2);`);
  check("⚠ the resume batch is BOUNDED, so one tick cannot wake everything after an outage",
    bounded === "2", `it woke ${bounded} of three`);
  /**
   * ⚠ **A FINISHED EXECUTION IS NEVER PUT BACK, AND THE WALL IS THE CONSTRAINT RATHER THAN THE
   * CLAUSE — which this check used to get backwards, vacuously.** It set `finished_at` on a
   * waiting row and asserted the tick did not return it. MEASURED: that UPDATE is REFUSED by
   * `automation_runs_finished_is_not_waiting` (`finished_at is null or waiting is null`), so the
   * row never reached the state the check describes — `finished_at` was still null, its deadline
   * was still in the future, and the tick answered the EMPTY STRING, which `!"".includes(id)`
   * satisfies trivially. **It had never once been in the state it was about**, and a SQL sweep
   * survivor is what said so: removing `and ar.finished_at is null` from
   * `resume_due_automations` changed nothing any check could see.
   *
   * That clause is a **DECLARED SECOND WALL and its mutant is INERT BY CONSTRUCTION** — measured
   * on a real database, zero rows can ever be both waiting and finished, so `waiting is not
   * null` already excludes every finished execution. So what is asserted here is the property
   * that really holds: the state is IMPOSSIBLE, and the tick still answers about the rows that
   * are legitimately due (the observer, without which "it did not return D4" is satisfied by a
   * tick that returns nothing at all).
   */
  const SW_D4 = "ffff0000-0000-0000-0000-00000000d004";
  due(SW_D4);
  // ⚠ READ FOR ITS OWN GATE: a refusal from another one looks exactly like this wall working.
  refused("⚠ a finished execution cannot also be waiting — the state is IMPOSSIBLE",
    `update agent.automation_runs set finished_at = now() where id='${SW_D4}';`,
    "automation_runs_finished_is_not_waiting", asOwner);
  /**
   * ⚠ **AND THE QUERY ITSELF WAS THE ROOT OF THE VACUITY — it had ALWAYS errored.**
   * `resume_due_automations` answers `setof jsonb`, so there is no `run_id` COLUMN to aggregate:
   * `select string_agg(run_id::text, ',') from agent.resume_due_automations(25)` is a syntax
   * error, and **`jget` answers the EMPTY STRING for a statement that failed** — so a broken
   * query read exactly like *"the tick found nothing"*, which is what `!after.includes(id)` was
   * quietly satisfied by. *Cannot-tell wearing a value's clothes*, in the harness's own reader.
   * The other call sites in this file all say `t->>'run_id'`; this one did not.
   */
  const after = jget(`select coalesce(string_agg(t->>'run_id', ','), '-') from agent.resume_due_automations(25) t;`);
  check("⚠ OBSERVER ALIVE: the tick really does answer the executions that ARE due",
    after.includes(SW_D4), after);
  check("⚠ ...and a FINISHED execution is not among them, because it cannot be waiting at all",
    jget(`select count(*) from agent.automation_runs where waiting is not null and finished_at is not null;`)
      === "0");
  // ⚠ **`for update skip locked` — TWO TICKS NEVER TAKE THE SAME ROW**, and a sequential
  // harness cannot see that: a lock only means anything under concurrency. A second session
  // holds the row and `lock_timeout` turns WAITING into an observable refusal.
  const SW_D5 = "ffff0000-0000-0000-0000-00000000d005";
  due(SW_D5);
  const lock = holdRowLock(null, { table: "automation_runs", where: `id='${SW_D5}'`, seconds: 6 });
  check("the second session really holds the row, which is what makes the next line about locking", lock.ok);
  const skipped = psql(`set lock_timeout = '2s'; select count(*) from agent.resume_due_automations(25);`, asWriter);
  lock.release();
  check("⚠ a row another tick is holding is SKIPPED rather than waited for",
    skipped.ok && !/lock timeout/i.test(skipped.err ?? ""), `${skipped.out} ${skipped.err ?? ""}`);

  // ── 10 & 11: NOTHING TO LOOK FOR IS NOT EVERYTHING ──
  jget(`insert into agent.agent_knowledge (id, tenant_id, agent_id, title, body)
        values (gen_random_uuid(),'${SW_T}','${SW_AG}','Prices','A boiler service is ninety-five pounds.'),
               (gen_random_uuid(),'${SW_T}','${SW_AG}','Hours','Open eight until five.');`);
  check("THE CONTROL: a real query really finds something",
    jget(`select count(*) from agent.search_knowledge('${SW_T}','${SW_AG}','boiler',5);`) === "1");
  check("⚠ a query of nothing but stopwords finds NOTHING, not everything",
    jget(`select count(*) from agent.search_knowledge('${SW_T}','${SW_AG}','the and of',5);`) === "0");
  check("⚠ ...and an empty query finds nothing either, for its own reason",
    jget(`select count(*) from agent.search_knowledge('${SW_T}','${SW_AG}','   ',5);`) === "0");

  // ── 12: A MEMORY'S SCOPE IS (ACCOUNT, AGENT) ──
  // ⚠ TWO ACCOUNTS SHARING AN AGENT ID is the only shape that separates the two scopes, and
  // it is reachable: an id is a uuid, not something one account owns.
  jget(`insert into agent.agents (id, tenant_id, name, instructions)
        values ('${SW_AG}','${SW_T2}','Theirs','Answer.') on conflict do nothing;`);
  allowed("one account remembers a name",
    `insert into agent.agent_memory (id, tenant_id, agent_id, key, value)
     values (gen_random_uuid(),'${SW_T}','${SW_AG}','tone','formal');`, asWriter);
  allowed("⚠ ...and the account next door remembers the SAME name for the SAME agent id",
    `insert into agent.agent_memory (id, tenant_id, agent_id, key, value)
     values (gen_random_uuid(),'${SW_T2}','${SW_AG}','tone','chatty');`, asWriter);
  check("...and each reads only its own",
    jget(`select value from agent.agent_memory where tenant_id='${SW_T}' and key='tone';`) === "formal" &&
    jget(`select value from agent.agent_memory where tenant_id='${SW_T2}' and key='tone';`) === "chatty");

  // ── 13: A `step` ENTRY MUST NAME WHERE IT GOT TO ──
  const SW_R6 = "ffff0000-0000-0000-0000-00000000c006";
  jget(`select agent.accept_automation_run('${SW_T}','${SW_A1}','${SW_R6}','manual',null)::text;`);
  const hold6 = jget(`select agent.claim_run('${SW_R6}','w-e',90)::text;`);
  const TOK6 = (JSON.parse(hold6).claim_token ?? "").trim();
  refused("⚠ a `step` entry that names no step is refused — progress with no position is no progress",
    `select agent.append_entry('${SW_R6}', 1, '{"kind":"step","at":3,"mark":"progress","done":0}'::jsonb,
      'w-e','${TOK6}');`,
    "entry_position_matches_kind", asWriter);
  refused("...and one carrying an INDEX is refused too, because that is a tool slot's shape",
    `select agent.append_entry('${SW_R6}', 1, '{"kind":"step","step":0,"index":0,"at":3,"mark":"progress","done":0}'::jsonb,
      'w-e','${TOK6}');`,
    "entry_position_matches_kind", asWriter);
  allowed("THE CONTROL: the same entry naming its step is stored",
    `select agent.append_entry('${SW_R6}', 1, '{"kind":"step","step":0,"at":3,"mark":"progress","done":0}'::jsonb,
      'w-e','${TOK6}');`, asWriter);

  // ── 14 & 15: AN OPERATION RECORD SAYS WHAT HAPPENED, AND IS THE ACCOUNT'S ──
  // ⚠ **RE-ANCHORED 2026-09-18, NOT APPEASED: `outcome` WAS `not null` AND IS NULLABLE NOW.**
  // This check used to insert a null outcome and require the COLUMN to refuse it, on the
  // reasoning that "a row exists only once its outcome is known, because claim and outcome
  // are one transaction". True of every caller then, and false of the one item 8 adds: an
  // OUTBOUND call cannot be in the caller's transaction, so *sent, outcome unknown* is a
  // real state and `outcome is null` IS it. The property it was really about — **a repeat
  // answered with nothing is not an answer** — is unchanged and is asserted here against
  // the two things that now carry it.
  //
  // (1) THE ONE-TRANSACTION DOOR STILL REFUSES IT, so a caller that has an answer cannot
  // reach the in-flight state by forgetting to pass one. Asked of the FUNCTION, because
  // that is where the wall moved to.
  refused("⚠ `operation_record` still refuses a null outcome — the in-flight state has its own door",
    `select agent.operation_record('${SW_T}','k1','remember','h1','${SW_R1}',null);`,
    "an outcome is required", asWriter);
  // (2) AND THE NULL IS NAMED RATHER THAN READ AS A REPEAT. Without this the relaxation
  // would let a retry be answered with nothing at all, which is the defect the `not null`
  // was standing in front of.
  allowed("THE CONTROL: an in-flight row is claimed through `operation_begin`",
    `select agent.operation_begin('${SW_T}','k1','remember','h1','${SW_R1}');`, asWriter);
  check("⚠ ...and an outcome-less row reads `unfinished`, never a repeat with nothing in it",
    jget(`select agent.operation_check('${SW_T}','k1','remember','h1') ->> 'state';`) === "unfinished");
  check("...and it carries NO outcome key rather than a null one",
    jget(`select (agent.operation_check('${SW_T}','k1','remember','h1') ? 'outcome')::text;`) === "false");
  allowed("...and settling it fills the answer in",
    `select agent.operation_settle('${SW_T}','k1','remember','h1','{"saved":"created"}'::jsonb);`, asWriter);
  check("⚠ ...after which it reads `repeat` and answers what happened",
    jget(`select agent.operation_check('${SW_T}','k1','remember','h1') -> 'outcome' ->> 'saved';`) === "created");
  check("⚠ ...and a second settle CANNOT rewrite it — write-once by `outcome is null` in the WHERE",
    jget(`select agent.operation_settle('${SW_T}','k1','remember','h1','{"saved":"corrected"}'::jsonb) ->> 'settled';`) === "false");
  check("...so the FIRST answer still stands",
    jget(`select outcome ->> 'saved' from agent.operations where tenant_id='${SW_T}' and op_key='k1';`) === "created");
  // ⚠ **THE FIVE PROPERTIES `operation_begin` AND `operation_settle` REST ON, DRIVEN HERE —
  // because they were driven ONLY where a SQL sweep cannot see them.** Every one of them is
  // proved by `verify:ops` and by the engine's own suite, and the SQL sweep runs NEITHER: it runs
  // this file and `authored-run` alone. Five mutants over these two functions survived a full
  // run for exactly that reason — this file mentioned them four times in total, all about
  // settling an existing row. *A property proven only by an instrument the sweep cannot run is a
  // property no mutant can be caught by*, and this directory records that trap; here it is, in
  // the money path's own idempotency.
  const OPK = "ops-drive-1";
  allowed("a slot is claimed once", `select agent.operation_begin('${SW_T}','${OPK}','send','hA');`, asWriter);
  check("⚠ ...and beginning it AGAIN does not claim it — a second caller must not also send",
    jget(`select agent.operation_begin('${SW_T}','${OPK}','send','hA') ->> 'began';`) === "false");
  check("⚠ ...and the second caller is told it is UNFINISHED rather than a repeat with no answer",
    jget(`select agent.operation_begin('${SW_T}','${OPK}','send','hA') ->> 'state';`) === "unfinished");
  // THE IDENTITY IS THE ACTION AND THE ARGUMENTS, so one slot cannot serve different work.
  check("⚠ a DIFFERENT action on the same key is a mismatch, not a claim",
    jget(`select agent.operation_begin('${SW_T}','${OPK}','cancel','hA') ->> 'error';`) === "mismatch");
  check("⚠ ...and so are different ARGUMENTS under the same action",
    jget(`select agent.operation_begin('${SW_T}','${OPK}','send','hB') ->> 'error';`) === "mismatch");
  check("...and neither of those wrote anything over the slot",
    jget(`select action || '|' || args_hash || '|' || coalesce(outcome::text,'-')
            from agent.operations where tenant_id='${SW_T}' and op_key='${OPK}';`) === "send|hA|-");
  // SETTLING COMPARES THE IDENTITY TOO, or another call's answer lands on this slot.
  check("⚠ settling under different ARGUMENTS settles nothing",
    jget(`select agent.operation_settle('${SW_T}','${OPK}','send','hB','{"sent":"wrong"}'::jsonb) ->> 'ok';`) === "false");
  check("...and the slot is still unanswered",
    jget(`select coalesce(outcome::text,'-') from agent.operations
           where tenant_id='${SW_T}' and op_key='${OPK}';`) === "-");
  refused("⚠ settling with NO outcome is refused, so an answer of nothing cannot be stored",
    `select agent.operation_settle('${SW_T}','${OPK}','send','hA',null);`,
    "an outcome is required", asWriter);
  check("...and THE CONTROL: the matching identity really does settle it",
    jget(`select agent.operation_settle('${SW_T}','${OPK}','send','hA','{"sent":"right"}'::jsonb) ->> 'settled';`) === "true");
  check("...leaving the answer that was really given",
    jget(`select outcome ->> 'sent' from agent.operations
           where tenant_id='${SW_T}' and op_key='${OPK}';`) === "right");

  // ⚠ **AND A GENUINE REFUSAL FROM THE INNER CALL MUST COME OUT AS ITSELF, not as a lost race.**
  // Every `_once` wrapper runs its inner function inside a subtransaction that catches
  // EVERYTHING, because the race can be lost in two places — the record's own key, and the inner
  // function's. What decides which it was is whether a committed twin exists: one does, so the
  // twin's answer stands; none does, so the failure is ours and is RE-RAISED with its own code.
  // **Swallowing it turns a real refusal into a silent `ok: false`, which is the direction that
  // loses work** — and that is what the mutant over the re-raise does. Undriven until now, and
  // undriven here for the same reason as the rest of this block: it is proved by `verify:ops`,
  // which the SQL sweep does not run.
  // ⚠ **AND FINDING A FAILURE THE INNER CALL REALLY RAISES TOOK A MEASUREMENT.** The obvious
  // one — a value past the column's 4000 cap — does NOT raise: `save_memory` asks the length
  // ITSELF and returns `{ok: false, error: 'too-long'}`, so the wrapper records that as an
  // ordinary outcome and the call succeeds. Measured, after a first draft of this check went red
  // saying "it was ALLOWED". Every sentence-shaped refusal in that function is the same: the
  // name's grammar, an empty value, the length, the source, the cap. **So the raise has to come
  // from something the function does NOT pre-validate**, and a `p_id` that already belongs to a
  // different memory is exactly that: the lookup is BY KEY, finds nothing for a new name, and
  // the insert then meets the primary key.
  const DUP_ID = "ffff0000-0000-0000-0000-00000000d001";
  check("a memory exists under a known id, for the raise to collide with",
    jget(`select agent.save_memory('${SW_T}','${SW_AG}','holder','mine','${DUP_ID}','person',100) ->> 'ok';`) === "true");
  refused("⚠ a refusal from INSIDE `save_memory_once` is re-raised, not reported as a lost race",
    `select agent.save_memory_once('${SW_T}','ops-raise-1','hR',null,'${SW_AG}','collider','v','${DUP_ID}','person',100);`,
    "duplicate key value violates unique constraint", asWriter);
  check("...and no operation record was left claiming that slot",
    jget(`select count(*) from agent.operations where tenant_id='${SW_T}' and op_key='ops-raise-1';`) === "0");
  check("...and THE CONTROL: the same call with a value the column accepts succeeds",
    jget(`select agent.save_memory_once('${SW_T}','ops-raise-2','hR',null,'${SW_AG}','reraise','short',null,'person',100) ->> 'ok';`) === "true");
  // ⚠ **FIVE OF THE SIX `_once` WRAPPERS CARRY THIS SAME BLOCK AND HAVE NO MUTANT AT ALL** —
  // `accept_automation_run_once`, `create_automation_once`, `update_automation_once`,
  // `set_automation_enabled_once`, `delete_memory_once`. Measured: one re-raise mutant exists in
  // the spec, for `save_memory_once`. So this check covers the one breakage that can be caught
  // and the asymmetry is recorded rather than implied to be covered.

  check("the owning account reads its own operation record",
    psql(`select count(*) from agent.operations where op_key='k1';`,
      { role: "authenticated", claims: `{"tenant_id":"${SW_T}"}` }).out === "1");
  check("⚠ ...and the account next door reads none of it",
    psql(`select count(*) from agent.operations;`,
      { role: "authenticated", claims: `{"tenant_id":"${SW_T2}"}` }).out === "0");
}

// ── TRIGGERS: a weekly schedule, a one-off, and an event ─────────────────────
{
  console.log("\n── TRIGGERS: weekly, once, and an event that both files and wakes ──");
  const TG = "tg1", TG2 = "tg2";
  const A_TG = "dd000000-0000-0000-0000-00000000ff01";
  const A_TG2 = "dd000000-0000-0000-0000-00000000ff02";
  const AU_WK = "dd000000-0000-0000-0000-00000000ff11";
  const AU_ONCE = "dd000000-0000-0000-0000-00000000ff12";
  const AU_EV = "dd000000-0000-0000-0000-00000000ff13";
  const EV1 = "dd000000-0000-0000-0000-00000000ff21";
  const EV2 = "dd000000-0000-0000-0000-00000000ff22";
  const R_EV = "dd000000-0000-0000-0000-00000000ff31";
  const WH1 = "dd000000-0000-0000-0000-00000000ff41";
  // ⚠ ITS OWN IDS, AND PROVED UNUSED FIRST. This file is one long body whose fixtures share a
  // database, and a collision has cost it three sections already — the last one reported
  // thirteen correct behaviours as broken on `agents_pkey`.
  check("the trigger fixtures' ids are unused before this section",
    psql(`select count(*) from agent.agents where id in ('${A_TG}','${A_TG2}');`, asOwner).out === "0"
    && psql(`select count(*) from agent.automations where id in ('${AU_WK}','${AU_ONCE}','${AU_EV}');`, asOwner).out === "0"
    && psql(`select count(*) from agent.events;`, asOwner).out === "0");

  /**
   * ⚠ **THE ENGINE REACHES EVENTS ONLY THROUGH FUNCTIONS, and that is asserted rather than
   * discovered.** `service_role` holds no SELECT on `agent.events` or `agent.webhooks` — it has
   * `BYPASSRLS`, which is about policies and not about grants — so every read it makes goes
   * through a `security definer` function whose own filter decides what it sees. That is
   * `run_work`'s posture, and it is why the direct reads in this section are the OWNER's.
   *
   * It was found the expensive way: the first draft of this section read the tables as the
   * writer and six checks failed saying nothing, which reads exactly like a broken dispatcher.
   */
  check("⚠ `service_role` holds no direct read on the events table — only the functions",
    psql(`select has_table_privilege('service_role','agent.events','select')::text;`, asOwner).out === "false");
  check("⚠ ...nor on the endpoints table, which holds a secret in a column",
    psql(`select has_table_privilege('service_role','agent.webhooks','select')::text;`, asOwner).out === "false");
  check("THE CONTROL: it can execute the functions that read them for it",
    psql(`select has_function_privilege('service_role','agent.dispatch_events(integer)','execute')::text;`, asOwner).out === "true"
    && psql(`select has_function_privilege('service_role','agent.emit_event(text,uuid,uuid,text,jsonb,text,text,uuid,integer)','execute')::text;`, asOwner).out === "true");

  allowed("two accounts' agents to hang triggers on",
    `insert into agent.agents (id, tenant_id, name, instructions, status) values
       ('${A_TG}','${TG}','Shop','help','active'),
       ('${A_TG2}','${TG2}','Theirs','help','active');`, asOwner);

  // ── the two new schedules ──────────────────────────────────────────────────
  const wk = jget(`select agent.create_automation('${TG}','${A_TG}','${AU_WK}','Mondays and Fridays',
    true, 'weekly', '09:00'::time, 'Europe/London', '[]'::jsonb, 20, '[]'::jsonb,
    array['mon','fri']::text[])::text;`);
  check("a WEEKLY automation is created and answers its own id", /"ok"\s*:\s*true/.test(wk) && wk.includes(AU_WK), wk);
  // ⚠ THE NEXT INSTANT IS COMPUTED BY `automation_next_run` AND NOT BY `automation_next_at`.
  // The old one answers the next occurrence of a DAILY time, so a weekly schedule would be
  // filed every single day — which is the whole reason the new function exists. What proves it
  // is that the instant really lands on a chosen day, in the automation's own zone.
  check("⚠ ...and its next instant is on one of the days it names",
    ["mon", "fri"].includes(jget(
      `select lower(to_char(next_run_at at time zone 'Europe/London', 'Dy')) from agent.automations where id='${AU_WK}';`)),
    jget(`select next_run_at at time zone 'Europe/London' from agent.automations where id='${AU_WK}';`));
  check("...and the day list is stored in the week's own order",
    jget(`select days::text from agent.automations where id='${AU_WK}';`) === "{mon,fri}");

  refused("a weekly schedule with NO days is refused, because it would never come due",
    `update agent.automations set days='{}'::text[] where id='${AU_WK}';`,
    "automations_schedule_is_whole", asOwner);
  refused("a day nothing recognises is refused rather than ignored",
    `update agent.automations set days=array['mon','funday']::text[] where id='${AU_WK}';`,
    "automations_days_known", asOwner);

  const once = jget(`select agent.create_automation('${TG}','${A_TG}','${AU_ONCE}','One report',
    true, 'once', '09:00'::time, 'UTC', '[]'::jsonb, 20, '[]'::jsonb, null, '2099-12-25'::date)::text;`);
  check("a ONE-OFF automation is created", /"ok"\s*:\s*true/.test(once) && once.includes(AU_ONCE), once);
  check("...and its instant is that day in its own zone",
    jget(`select to_char(next_run_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from agent.automations where id='${AU_ONCE}';`)
      === "2099-12-25 09:00");
  // ⚠ **A ONE-OFF THAT HAS FIRED HAS NO NEXT INSTANT, AND THAT ABSENCE IS HOW IT SAYS SO** —
  // which is why `once` is the one schedule whose `next_run_at` the wholeness check leaves
  // alone. A constraint demanding one would make a fired one-off an unrepresentable row.
  allowed("...and a fired one-off may have none, which is how it says it is done",
    `update agent.automations set next_run_at=null where id='${AU_ONCE}';`, asOwner);
  check("⚠ a one-off whose day has passed answers NO next instant at all",
    jget(`select agent.automation_next_run('once','09:00'::time,'UTC',null,'2020-01-01'::date, now()) is null;`) === "t");
  // THE CONTROL: the same call before the day really does answer one, so the null above is
  // about the day having passed rather than about the function answering nothing.
  check("THE CONTROL: before its day, a one-off answers an instant",
    jget(`select agent.automation_next_run('once','09:00'::time,'UTC',null,'2099-01-01'::date, now()) is not null;`) === "t");

  // ── an event both FILES and WAKES, in one transaction ──────────────────────
  const ev = jget(`select agent.create_automation('${TG}','${A_TG}','${AU_EV}','On a payment',
    true, 'manual', null, 'UTC', '[]'::jsonb, 20, '[]'::jsonb, null, null, 'order.paid')::text;`);
  check("an automation may listen for an EVENT while still being run by hand",
    /"ok"\s*:\s*true/.test(ev), ev);
  refused("an event name that is not an identifier is refused",
    `update agent.automations set on_event='Order Paid!' where id='${AU_EV}';`,
    "automations_on_event_shaped", asOwner);

  const emitted = jget(`select agent.emit_event('${TG}','${A_TG}','${EV1}','order.paid',
    '{"amount":42}'::jsonb,'person','k-1')::text;`);
  check("an event is emitted and answers its own id", /"ok"\s*:\s*true/.test(emitted), emitted);
  const twice = jget(`select agent.emit_event('${TG}','${A_TG}','${EV2}','order.paid',
    '{"amount":42}'::jsonb,'person','k-1')::text;`);
  // ⚠ **THE SAME KEY IS THE SAME EVENT, which is what makes a retried webhook delivery safe.**
  check("⚠ the same key twice is ONE event, and the second says so",
    /"repeat"\s*:\s*true/.test(twice) && twice.includes(EV1),
    twice);
  // ⚠ ...AND THE SECOND EVENT'S OWN ID IS NOT IN THE TABLE, which is the property rather than
  // a count: a count is a claim about every fixture this section has, and the id is a claim
  // about the absorb.
  check("...and the id the second call minted was never written",
    psql(`select count(*) from agent.events where id='${EV2}';`, asOwner).out === "0");

  const fired = jget(`select agent.dispatch_events(25)::text;`);
  check("dispatching it FILES an execution for the automation that listens",
    /"filed"\s*:\s*1/.test(fired), fired);
  check("...and the execution's trigger says an event started it",
    jget(`select trigger from agent.automation_runs where automation_id='${AU_EV}';`) === "event");
  check("...and it carries the event it came from",
    jget(`select event_id from agent.automation_runs where automation_id='${AU_EV}';`) === EV1);
  check("...and the event is stamped handled, which is what makes it exactly once",
    psql(`select handled_at is not null from agent.events where id='${EV1}';`, asOwner).out === "t");
  check("⚠ a second dispatch files nothing, because the stamp is the gate",
    jget(`select count(*) from agent.dispatch_events(25);`) === "0");
  check("...and there is still exactly one execution of it",
    jget(`select count(*) from agent.automation_runs where automation_id='${AU_EV}';`) === "1");
  // AND ONE PER EVENT, enforced by the index rather than by the stamp alone.
  refused("⚠ two executions of one automation for one event are refused by the index",
    `insert into agent.automation_runs (id, tenant_id, automation_id, agent_id, trigger, steps, zone, event_id)
     values ('${R_EV}','${TG}','${AU_EV}','${A_TG}','event','[]'::jsonb,'UTC','${EV1}');`,
    "automation_runs_one_per_event", asOwner);

  // ── the arrival race, both halves ──────────────────────────────────────────
  const R_WAIT = "dd000000-0000-0000-0000-00000000ff51";
  // ⚠ AN EXECUTION'S ID IS A RUN'S ID (`automation_runs_id_fkey`), and `run_work.kind` is
  // `start | resume` — both found by driving this rather than by reading, and both are the
  // schema being right. A hand-built pause has to stand up the same three rows a real accept
  // does, or it is testing a shape the platform cannot hold.
  allowed("an execution suspended on an event wait",
    `insert into agent.runs (id, tenant_id) values ('${R_WAIT}','${TG}');
     insert into agent.automation_runs
       (id, tenant_id, automation_id, agent_id, trigger, steps, zone, position, waiting)
     values ('${R_WAIT}','${TG}','${AU_EV}','${A_TG}','manual','[]'::jsonb,'UTC',0,
       jsonb_build_object('kind','event','name','order.shipped','step','s1',
                          'since', (now() - interval '1 minute')::text));`, asOwner);
  allowed("...and a work row for it, marked done the way a pause leaves one",
    `insert into agent.run_work (run_id, tenant_id, kind, executor, done_at)
     values ('${R_WAIT}','${TG}','start','automation', now());`, asOwner);

  const EV3 = "dd000000-0000-0000-0000-00000000ff23";
  jget(`select agent.emit_event('${TG}','${A_TG}','${EV3}','order.shipped','{"who":"dpd"}'::jsonb)::text;`);
  const woke = jget(`select agent.dispatch_events(25)::text;`);
  check("⚠ dispatching WAKES an execution that was already waiting", /"woke"\s*:\s*1/.test(woke), woke);
  check("...and what it heard is on the row, under the step that was waiting",
    jget(`select heard -> 's1' ->> 'name' from agent.automation_runs where id='${R_WAIT}';`) === "order.shipped");
  check("...and the payload came with it, which is what the step binds",
    jget(`select heard -> 's1' -> 'payload' ->> 'who' from agent.automation_runs where id='${R_WAIT}';`) === "dpd");
  // ⚠ **AND THE WORK IS BACK ON THE QUEUE**, without which the event would be recorded against
  // a run nothing will ever deliver — a stranding, which is what milestone 9 exists to stop.
  check("⚠ ...AND THE WORK ROW IS BACK ON THE QUEUE, or the event reaches nobody",
    jget(`select done_at is null from agent.run_work where run_id='${R_WAIT}';`) === "t");
  check("⚠ a second event of the same name does not apply twice",
    (() => {
      const EV4 = "dd000000-0000-0000-0000-00000000ff24";
      jget(`select agent.emit_event('${TG}','${A_TG}','${EV4}','order.shipped','{"who":"other"}'::jsonb)::text;`);
      jget(`select count(*) from agent.dispatch_events(25);`);
      return jget(`select heard -> 's1' ->> 'name' from agent.automation_runs where id='${R_WAIT}';`) === "order.shipped"
        && jget(`select heard -> 's1' -> 'payload' ->> 'who' from agent.automation_runs where id='${R_WAIT}';`) === "dpd";
    })());

  // THE OTHER HALF: an event that arrived BEFORE the pause was recorded.
  const R_RACE = "dd000000-0000-0000-0000-00000000ff52";
  const EV5 = "dd000000-0000-0000-0000-00000000ff25";
  jget(`select agent.emit_event('${TG}','${A_TG}','${EV5}','order.refunded','{"n":1}'::jsonb)::text;`);
  jget(`select count(*) from agent.dispatch_events(25);`);   // dispatched with nobody waiting
  allowed("an execution that reaches its wait AFTER the event was dispatched",
    `insert into agent.runs (id, tenant_id) values ('${R_RACE}','${TG}');
     insert into agent.automation_runs
       (id, tenant_id, automation_id, agent_id, trigger, steps, zone, position, waiting)
     values ('${R_RACE}','${TG}','${AU_EV}','${A_TG}','manual','[]'::jsonb,'UTC',0,
       jsonb_build_object('kind','event','name','order.refunded','step','s1',
                          'since', (now() - interval '1 hour')::text));`, asOwner);
  allowed("...and its work row, released by the pause",
    `insert into agent.run_work (run_id, tenant_id, kind, executor, done_at)
     values ('${R_RACE}','${TG}','start','automation', now());`, asOwner);
  const heard = jget(`select agent.hear_pending_event('${R_RACE}','${TG}')::text;`);
  check("⚠ THE RACE'S OTHER HALF: an event that got there first is still heard",
    /"heard"\s*:\s*true/.test(heard), heard);
  check("⚠ ...AND IT PUTS THE WORK BACK, in the same transaction as the hearing",
    jget(`select done_at is null from agent.run_work where run_id='${R_RACE}';`) === "t", heard);
  check("...and asking again is `already`, so one event is applied once",
    /"already"/.test(jget(`select agent.hear_pending_event('${R_RACE}','${TG}')::text;`)));
  // ⚠ BOUNDED BY WHEN THE PAUSE BEGAN, or an event from last week would satisfy a wait set up
  // this morning — a workflow resuming on news it was never waiting for.
  const R_LATE = "dd000000-0000-0000-0000-00000000ff53";
  allowed("an execution whose wait began AFTER every event of that name",
    `insert into agent.runs (id, tenant_id) values ('${R_LATE}','${TG}');
     insert into agent.automation_runs
       (id, tenant_id, automation_id, agent_id, trigger, steps, zone, position, waiting)
     values ('${R_LATE}','${TG}','${AU_EV}','${A_TG}','manual','[]'::jsonb,'UTC',0,
       jsonb_build_object('kind','event','name','order.refunded','step','s1',
                          'since', (now() + interval '1 hour')::text));`, asOwner);
  check("⚠ an event OLDER than the pause is not heard",
    /"nothing-yet"/.test(jget(`select agent.hear_pending_event('${R_LATE}','${TG}')::text;`)));
  check("an account cannot hear another account's execution",
    /"no-execution"/.test(jget(`select agent.hear_pending_event('${R_RACE}','${TG2}')::text;`)));

  // ── a chain of events is bounded ──────────────────────────────────────────
  /**
   * ⚠ **THE DEPTH COMES FROM THE EMITTING RUN AND NOT FROM THE CALL, which is what makes the
   * bound one a caller cannot widen — and my own first fixture got it the other way round.** It
   * passed `p_max_depth := 0` with no `p_from_run` and expected a refusal; with no emitting run
   * the depth is 0, `0 > 0` is false, and the emit was correctly ACCEPTED. So the fixture has to
   * stand up an execution already at the bound and emit FROM it.
   */
  const R_DEEP = "dd000000-0000-0000-0000-00000000ff61";
  allowed("an execution already as deep as a chain may go",
    `insert into agent.runs (id, tenant_id) values ('${R_DEEP}','${TG}');
     insert into agent.automation_runs
       (id, tenant_id, automation_id, agent_id, trigger, steps, zone, event_depth)
     values ('${R_DEEP}','${TG}','${AU_EV}','${A_TG}','manual','[]'::jsonb,'UTC',4);`, asOwner);
  const deep = jget(`select agent.emit_event('${TG}','${A_TG}',gen_random_uuid(),'loop.step',
    '{}'::jsonb,'run',null,'${R_DEEP}')::text;`);
  check("⚠ an event emitted FROM a run at the bound is refused BY NAME",
    /"too-deep"/.test(deep), deep);
  // THE CONTROL: the same emit from a shallower run really is accepted, so the refusal above is
  // about the depth and not about the call.
  const R_SHALLOW = "dd000000-0000-0000-0000-00000000ff62";
  allowed("...and one with room left",
    `insert into agent.runs (id, tenant_id) values ('${R_SHALLOW}','${TG}');
     insert into agent.automation_runs
       (id, tenant_id, automation_id, agent_id, trigger, steps, zone, event_depth)
     values ('${R_SHALLOW}','${TG}','${AU_EV}','${A_TG}','manual','[]'::jsonb,'UTC',1);`, asOwner);
  const shallow = jget(`select agent.emit_event('${TG}','${A_TG}',gen_random_uuid(),'loop.step',
    '{}'::jsonb,'run',null,'${R_SHALLOW}')::text;`);
  check("THE CONTROL: with depth left, the same emit is accepted and says how deep it is",
    /"ok"\s*:\s*true/.test(shallow) && /"depth"\s*:\s*2/.test(shallow), shallow);

  // ── the endpoint's secret has exactly one reader ───────────────────────────
  const made = jget(`select agent.create_webhook('${TG}','${A_TG}','${WH1}','Payments','order.paid','a-signing-secret-of-a-real-length-32+')::text;`);
  check("an endpoint is created", /"ok"\s*:\s*true/.test(made), made);
  check("⚠ the DELIVERY reader answers the secret and the account it belongs to",
    /a-signing-secret-of-a-real-length/.test(jget(`select agent.webhook_for_delivery('${WH1}')::text;`))
    && jget(`select agent.webhook_for_delivery('${WH1}') ->> 'tenant_id';`) === TG);
  check("⚠ ...and the LIST reader never does, so the secret has one reader and not two",
    !/a-signing-secret-of-a-real-length/.test(jget(`select agent.list_webhooks('${TG}','${A_TG}')::text;`)),
    jget(`select agent.list_webhooks('${TG}','${A_TG}')::text;`));
  check("a disabled endpoint answers nothing at all, so turning one off really stops it",
    (() => {
      jget(`select agent.set_webhook_enabled('${TG}','${WH1}',false)::text;`);
      const off = jget(`select agent.webhook_for_delivery('${WH1}')::text;`);
      jget(`select agent.set_webhook_enabled('${TG}','${WH1}',true)::text;`);
      return off === "" || off === "\\N" || /^null$/i.test(off);
    })());
  check("⚠ `authenticated` holds NOTHING on the endpoints table, because the secret is a column of it",
    jget(`select has_table_privilege('authenticated','agent.webhooks','select')::text;`) === "false");
  check("⚠ ...and cannot execute the one function that answers a secret",
    jget(`select has_function_privilege('authenticated','agent.webhook_for_delivery(uuid)','execute')::text;`) === "false");
  check("THE CONTROL: `service_role` can, because that is the caller a delivery runs as",
    jget(`select has_function_privilege('service_role','agent.webhook_for_delivery(uuid)','execute')::text;`) === "true");
  check("an account cannot delete another account's endpoint",
    /"no-webhook"/.test(jget(`select agent.delete_webhook('${TG2}','${WH1}')::text;`)));
  check("THE CONTROL: its owner can",
    /"ok"\s*:\s*true/.test(jget(`select agent.delete_webhook('${TG}','${WH1}')::text;`)));

  // ── the tick knows the two new schedules are due ───────────────────────────
  check("⚠ the tick considers every schedule that is not manual",
    (() => {
      jget(`update agent.automations set next_run_at = now() - interval '1 minute'
             where id in ('${AU_WK}','${AU_ONCE}');`);
      jget(`update agent.automations set days=array['mon','fri']::text[] where id='${AU_WK}';`);
      const rows = jget(`select count(*) from agent.tick_automations(3600, 25);`);
      return Number(rows) >= 2;
    })(), jget(`select count(*) from agent.tick_automations(3600, 25);`));
  /**
   * ⚠ **A ONE-OFF IS NEVER DUE AGAIN ONCE ITS DAY HAS GONE — and my first assertion here was
   * about a state the platform cannot produce.** It forced `AU_ONCE`'s `next_run_at` into the
   * past while its DATE was still 2099, ticked, and expected no next instant: the function
   * correctly answered that date again, because it has not happened yet. A real one-off is due
   * AT its instant, so the honest fixture is a date that really has gone by.
   */
  const AU_GONE = "dd000000-0000-0000-0000-00000000ff14";
  const gone = jget(`select agent.create_automation('${TG}','${A_TG}','${AU_GONE}','Yesterday',
    true, 'once', '09:00'::time, 'UTC', '[]'::jsonb, 20, '[]'::jsonb, null,
    (current_date - 1)::date)::text;`);
  check("a one-off on a day that has gone is created with no next instant at all",
    /"ok"\s*:\s*true/.test(gone)
    && jget(`select next_run_at is null from agent.automations where id='${AU_GONE}';`) === "t", gone);
  check("⚠ ...so the tick never considers it, which is the whole of what `once` means",
    (() => {
      const before = jget(`select count(*) from agent.automation_runs where automation_id='${AU_GONE}';`);
      jget(`select count(*) from agent.tick_automations(3600, 25);`);
      return before === "0"
        && jget(`select count(*) from agent.automation_runs where automation_id='${AU_GONE}';`) === "0";
    })());
  // AND THE ONE THAT REALLY FIRES LOSES ITS INSTANT, driven by making its date today and its
  // instant due — which is the state a real one-off is in at the moment it runs.
  check("⚠ a one-off that FIRES has no next instant afterwards",
    (() => {
      jget(`update agent.automations set on_date = current_date, at_local = '00:01'::time,
             next_run_at = now() - interval '1 minute' where id='${AU_ONCE}';`);
      jget(`select count(*) from agent.tick_automations(3600, 25);`);
      return jget(`select next_run_at is null from agent.automations where id='${AU_ONCE}';`) === "t";
    })(), jget(`select next_run_at from agent.automations where id='${AU_ONCE}';`));
}

// ── CONNECTIONS: ownership, scopes, and a credential with one door ───────────
//
// ⚠ **THE POINT OF DRIVING THIS ON A REAL DATABASE is that the credential's protection is a
// PRIVILEGE and a VIEW's column list, neither of which a unit test can see.** The engine's
// own store can be perfect and still hand a secret to a screen if `connection_list` selects
// it, or if `authenticated` holds a grant on the table.
{
  console.log("\n── CONNECTIONS: whose it is, what it may reach, and the one door ──");
  const CX_T = "cx1", CX_T2 = "cx2";
  const CX_A1 = "ee000000-0000-0000-0000-0000000000a1";
  const CX_A2 = "ee000000-0000-0000-0000-0000000000a2";  // a SIBLING of CX_A1, same account
  const CX_B1 = "ee000000-0000-0000-0000-0000000000b1";  // the other account's agent
  const CX_1 = "ee000000-0000-0000-0000-0000000000c1";
  const CX_2 = "ee000000-0000-0000-0000-0000000000c2";
  const CX_3 = "ee000000-0000-0000-0000-0000000000c3";
  const CX_4 = "ee000000-0000-0000-0000-0000000000c4";
  const CX_5 = "ee000000-0000-0000-0000-0000000000c5";
  const CX_6 = "ee000000-0000-0000-0000-0000000000c6";
  const SECRET = "fake-token-do-not-use-0001";
  // THE ROLE PROBE'S OWN ROW AND CREDENTIAL, so what it leases is in a state it set itself
  // rather than whatever the checks above left `CX_1` in.
  const CX_R = "ee000000-0000-0000-0000-0000000000c7";
  const R_SECRET = "fake-token-do-not-use-0009";
  // ⚠ **AND TWO MORE FOR THE TWO SWEEP SURVIVORS, EACH ITS OWN ROW — because reusing `CX_5`
  // for them is the very trap the census below exists for, and it cost this pass.** `CX_5` is
  // the SIBLING agent's row (`rawRow` writes it under `CX_A2`), so a lease or refresh named
  // under `CX_A1` finds nothing and answers `no-connection`: three new checks reported correct
  // behaviour as broken, for the fixture's reason rather than the product's. *An id is not a
  // scratch value; it carries an owner and a state.*
  const CX_EXP = "ee000000-0000-0000-0000-0000000000c8";
  const CX_NR = "ee000000-0000-0000-0000-0000000000c9";
  // ⚠ **WHAT IS IN THE ROW IS AN OWNER QUESTION, AND SAYING SO IS THIS SECTION'S OWN
  // FINDING.** `jget` defaults to `asWriter` (`service_role`), and four checks below read a
  // credential column or forced a clock with it — green only because the Worker's role could
  // `select secret` and `update` the table. That is exactly the privilege the block at the end
  // of this section closes, so those checks were EXERCISING A DOOR THAT SHOULD NOT EXIST.
  // They ask the owner now, which is the honest instrument for "what does the row hold" and
  // for putting a row into a state on purpose; the refusals below then mean something.
  //
  // ⚠ **AND IT IS NOT CALLED `asOwner`, DELIBERATELY: THIS FILE ALREADY HAS ONE.** The fence
  // section near the top declares `const asOwner = {}` — no `set role` at all, which reaches
  // the owner because `psql` runs `su postgres`. The two would be the same role by two
  // spellings, and a second `asOwner` in a nested scope SHADOWS it: legal, silent, and a
  // reader who carried either definition into the other's block would be reasoning about the
  // wrong handle. Named apart, there is nothing to carry.
  const asRowOwner = { role: "postgres" };

  // ⚠ THE IDS ARE ITS OWN, AND THAT IS ASSERTED RATHER THAN HOPED. This file is one long
  // body sharing one database, and a fixture id reused from five hundred lines up has
  // already cost it a whole section reporting correct behaviour as broken — twice. A census
  // here makes a future collision one sentence instead of a cascade.
  check("⚠ this section's fixture ids are unused before it starts",
    jget(`select count(*) from (
            select id from agent.agents where id in ('${CX_A1}','${CX_A2}','${CX_B1}')
            union all select id from agent.connections) x;`) === "0");

  jget(`insert into agent.agents (id, tenant_id, name, instructions) values
          ('${CX_A1}','${CX_T}','post','mail'),
          ('${CX_A2}','${CX_T}','other','mail'),
          ('${CX_B1}','${CX_T2}','theirs','mail');`);

  // ── whose agent it is ──
  check("a connection is stored for this account's own agent",
    jget(`select agent.connect_provider('${CX_T}','${CX_A1}','${CX_1}','fakemail','Work mail',
            'someone@example.test', array['read','send'], '${SECRET}', 'fake-refresh-0001',
            now() + interval '1 hour') ->> 'ok';`) === "true");
  check("⚠ ...and the answer NEVER carries the credential",
    !jget(`select agent.connect_provider('${CX_T}','${CX_A1}','${CX_1}','fakemail','Work mail',
            'someone@example.test', array['read','send'], '${SECRET}')::text;`).includes(SECRET));
  check("⚠ another account's agent is `no-agent` — the same answer a missing one gets",
    jget(`select agent.connect_provider('${CX_T}','${CX_B1}','${CX_2}','fakemail','x','a@b.test',
            '{}'::text[], '${SECRET}') ->> 'error';`) === "no-agent");
  check("...and so is an agent that is not there at all",
    jget(`select agent.connect_provider('${CX_T}','ee000000-0000-0000-0000-00000000dead','${CX_2}',
            'fakemail','x','a@b.test','{}'::text[],'${SECRET}') ->> 'error';`) === "no-agent");
  refused("a connection with no credential is refused rather than stored empty",
    `select agent.connect_provider('${CX_T}','${CX_A1}','${CX_2}','fakemail','x','a@b.test',
       '{}'::text[], '  ');`,
    "a credential is required", asWriter);

  // ── ONE LIVE ROW PER PROVIDER ACCOUNT, and the old one is the RECORD ──
  check("⚠ reconnecting the same provider account replaces the live row",
    jget(`select agent.connect_provider('${CX_T}','${CX_A1}','${CX_3}','fakemail','Work mail',
            'someone@example.test', array['read'], 'fake-token-do-not-use-0002', 'fake-refresh-0001',
            now() + interval '1 hour') ->> 'ok';`) === "true");
  check("...so exactly one row is active for that (agent, provider, account)",
    jget(`select count(*) from agent.connections where tenant_id='${CX_T}' and agent_id='${CX_A1}'
            and provider='fakemail' and account='someone@example.test' and status='active';`) === "1");
  check("⚠ ...and the OLD row is kept as `disconnected` with its reason, not deleted",
    jget(`select status || '/' || stopped_why from agent.connections where id='${CX_1}';`)
      === "disconnected/replaced by a new connection");
  // THE CONTROL for the partial index: a second ACTIVE row for one provider account is the
  // thing that must be impossible, and it is the INDEX rather than the function that says so.
  refused("⚠ two ACTIVE rows for one (agent, provider, account) are impossible",
    `insert into agent.connections (id, tenant_id, agent_id, provider, label, account, secret)
     values ('${CX_4}','${CX_T}','${CX_A1}','fakemail','again','someone@example.test','s');`,
    "connections_one_live_per_account", { role: "postgres" });
  check("...while a disconnected row alongside it is fine, which is what makes it the record",
    jget(`select count(*) from agent.connections where tenant_id='${CX_T}'
            and agent_id='${CX_A1}' and account='someone@example.test';`) === "2");
  // ⚠ **A REPEATED PRESS MUST LEAVE ITS OWN CONNECTION ALIVE, AND THIS IS THE DEFECT IT WAS
  // WRITTEN FOR.** `connect_provider` disconnects the live row for that provider account
  // before inserting, and without `id <> p_id` that row IS the one a retry is about:
  // measured, press then press again answered `{ok: true, repeat: true}` with the connection
  // `disconnected / replaced by a new connection` and the lease refusing it. The caller is
  // told "already connected" about a credential it has just destroyed — so `repeat: true`
  // alone is NOT the property, and asserting only that is what let it through.
  check("a repeated press under the same id is absorbed and answers that row",
    jget(`select agent.connect_provider('${CX_T}','${CX_A1}','${CX_3}','fakemail','Work mail',
            'someone@example.test', array['read'], 'x') ->> 'repeat';`) === "true");
  check("⚠ ...and the connection is STILL ACTIVE, not replaced by itself",
    jget(`select status from agent.connections where id='${CX_3}';`) === "active");
  check("⚠ ...and it can still be leased, which is what a caller told `repeat` believes",
    jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_3}') ->> 'ok';`) === "true");

  // ── THE SHAPE CONSTRAINTS, each read for ITS OWN name, with a control ──
  const rawRow = (id, extra) =>
    `insert into agent.connections (id, tenant_id, agent_id, provider, label, account, secret${extra.cols})
     values ('${id}','${CX_T}','${CX_A2}',${extra.vals});`;
  refused("a provider that is not an identifier is refused",
    rawRow(CX_5, { cols: "", vals: `'Fake Mail','l','a@b.test','s'` }),
    "connections_provider_check", { role: "postgres" });
  refused("a label that is only whitespace is refused",
    rawRow(CX_5, { cols: "", vals: `'fakemail','   ','a@b.test','s'` }),
    "connections_label_check", { role: "postgres" });
  refused("a label with untrimmed edges is refused, so two labels cannot differ by a space",
    rawRow(CX_5, { cols: "", vals: `'fakemail',' l ','a@b.test','s'` }),
    "connections_label_shaped", { role: "postgres" });
  refused("a scope with a space in it is refused",
    rawRow(CX_5, { cols: ", scopes", vals: `'fakemail','l','a@b.test','s', array['read all']` }),
    "connections_scopes_shaped", { role: "postgres" });
  refused("a NULL among the scopes is refused",
    rawRow(CX_5, { cols: ", scopes", vals: `'fakemail','l','a@b.test','s', array['read',null]` }),
    "connections_scopes_shaped", { role: "postgres" });
  refused("a status this schema does not know is refused",
    rawRow(CX_5, { cols: ", status", vals: `'fakemail','l','a@b.test','s','wobbly'` }),
    "connections_status_known", { role: "postgres" });
  allowed("THE CONTROL: the same row within every constraint is stored",
    rawRow(CX_5, { cols: ", scopes", vals: `'fakemail','l','a@b.test','s', array['read']` }),
    { role: "postgres" });

  // ── THE ONE DOOR, AND THE FOUR REFUSALS EACH BY ITS OWN NAME ──
  check("⚠ leasing a live connection hands back the credential — the one place it is selected",
    jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_3}') ->> 'secret';`)
      === "fake-token-do-not-use-0002");
  check("⚠ a SIBLING agent of the same account cannot lease it — the wall no tenant filter sees",
    jget(`select agent.lease_connection('${CX_T}','${CX_A2}','${CX_3}') ->> 'error';`) === "no-connection");
  check("...and neither can the account next door",
    jget(`select agent.lease_connection('${CX_T2}','${CX_A1}','${CX_3}') ->> 'error';`) === "no-connection");
  check("⚠ a scope it was not granted is refused BY NAME, never sent with less permission",
    jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_3}', array['read','send'])
            -> 'missing' ->> 0;`) === "send");
  check("...and the refusal says what WAS granted, so the fix is readable",
    jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_3}', array['send']) ->> 'error';`)
      === "scope-missing");
  check("THE CONTROL: a scope it really holds leases",
    jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_3}', array['read']) ->> 'ok';`) === "true");

  // EXPIRED IS THE CLOCK'S, AND IS DERIVED RATHER THAN STAMPED.
  jget(`update agent.connections set expires_at = now() - interval '1 minute' where id='${CX_3}';`,
       asRowOwner);
  check("⚠ an expired credential is refused BY NAME, with whether a refresh could fix it",
    jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_3}') ->> 'error';`) === "expired");
  check("...and the row is still marked `active`, because nothing goes round stamping it",
    jget(`select status from agent.connections where id='${CX_3}';`) === "active");
  check("⚠ ...while the VIEW folds the clock in, so a reader sees `expired` with no writer",
    jget(`select status from agent.connection_list where id='${CX_3}';`) === "expired");
  check("...and the view says a refresh is possible without handing over the means",
    jget(`select refreshable from agent.connection_list where id='${CX_3}';`) === "t");
  check("⚠ ...because `refreshable` is a GENERATED column, so it cannot disagree with the secret",
    jget(`select count(*) from information_schema.columns
           where table_schema='agent' and table_name='connections'
             and column_name='refreshable' and is_generated='ALWAYS';`) === "1");

  // A REFRESH IS THE CLOCK'S ANSWER.
  check("refreshing rotates the credential and the expiry",
    jget(`select agent.refresh_connection('${CX_T}','${CX_A1}','${CX_3}','fake-token-do-not-use-0003',
            null, now() + interval '1 hour') ->> 'ok';`) === "true");
  check("...and the lease hands back the NEW credential",
    jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_3}') ->> 'secret';`)
      === "fake-token-do-not-use-0003");
  check("⚠ ...and a provider that does not rotate its refresh credential keeps the one it had",
    jget(`select refresh_secret from agent.connections where id='${CX_3}';`, asRowOwner)
      === "fake-refresh-0001");
  refused("a refresh with no credential is refused rather than blanking the one that works",
    `select agent.refresh_connection('${CX_T}','${CX_A1}','${CX_3}','');`,
    "a credential is required", asWriter);
  // ⚠ **AND A PROVIDER WITH NOTHING TO REFRESH WITH IS ITS OWN REFUSAL — a sweep survivor, and
  // the two are easy to conflate.** The case above is the CALLER sending no new credential; this
  // is the ROW holding no refresh credential, which is a real provider shape (`refresh_secret`
  // is nullable precisely because some providers have none). Nothing drove it, so removing the
  // branch answered `ok` and rotated the secret of a connection that can never be refreshed
  // again — a control that reports success and changes the wrong thing.
  check("⚠ a connection with no refresh credential is refused `not-refreshable`",
    (() => {
      // ITS OWN ROW, MADE THROUGH THE REAL DOOR with no refresh credential — which is the
      // provider shape being tested, not a column blanked behind the function's back.
      jget(`select agent.connect_provider('${CX_T}','${CX_A1}','${CX_NR}','fakemail',
              'No refresh','nr@example.test',array['read'],'fake-token-do-not-use-0010') ->> 'ok';`);
      const out = jget(`select agent.refresh_connection('${CX_T}','${CX_A1}','${CX_NR}','rotated-0001')::text;`);
      // THE WALL IS THAT NOTHING WAS WRITTEN, not merely that the answer says so.
      const kept = jget(`select secret from agent.connections where id='${CX_NR}';`, asRowOwner);
      return /"error"\s*:\s*"not-refreshable"/.test(out) && kept === "fake-token-do-not-use-0010";
    })());
  check("...and `refreshable` says so too, without anyone reading the credential",
    jget(`select refreshable::text from agent.connection_list where id='${CX_NR}';`) === "false");

  // ── DISCONNECTED AND REVOKED ARE TWO STATES BECAUSE THEY NEED TWO SENTENCES ──
  check("a person disconnecting says so, in their own words",
    jget(`select agent.disconnect_connection('${CX_T}','${CX_A1}','${CX_3}','I do not use it') ->> 'status';`)
      === "disconnected");
  check("⚠ ...and the CREDENTIAL IS DESTROYED, not merely flagged",
    jget(`select (secret <> 'fake-token-do-not-use-0003' and refresh_secret is null)
            from agent.connections where id='${CX_3}';`, asRowOwner) === "t");
  check("⚠ ...so the one door refuses it by name and carries their reason",
    jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_3}') ->> 'why';`) === "I do not use it");
  check("disconnecting twice is a success that says so, never somebody else's connection",
    jget(`select agent.disconnect_connection('${CX_T}','${CX_A1}','${CX_3}') ->> 'repeat';`) === "true");
  check("⚠ ...and a refresh CANNOT revive it — only granting again can",
    jget(`select agent.refresh_connection('${CX_T}','${CX_A1}','${CX_3}','new') ->> 'error';`)
      === "disconnected");

  jget(`select agent.connect_provider('${CX_T}','${CX_A1}','${CX_6}','fakenote','Notes','n@example.test',
          array['write'], 'fake-token-do-not-use-0004');`);
  check("a provider withdrawing the grant is `revoked`, which is a different fact",
    jget(`select agent.revoke_connection('${CX_T}','${CX_A1}','${CX_6}','they withdrew it') ->> 'status';`)
      === "revoked");
  check("⚠ ...and the one door tells the two apart, because the remedies differ",
    jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_6}') ->> 'error';`) === "revoked");
  check("...and a revocation destroys the credential too",
    jget(`select (secret <> 'fake-token-do-not-use-0004') from agent.connections where id='${CX_6}';`,
         asRowOwner) === "t");
  check("a status nothing recognises cannot be stored at all — the CHECK is the wall",
    (() => {
      jget(`update agent.connections set status='revoked' where id='${CX_5}';`, asRowOwner);
      jget(`update agent.connections set status='active' where id='${CX_5}';`, asRowOwner);
      const r = psql(`update agent.connections set status='half' where id='${CX_5}';`,
        { role: "postgres", expectFail: true });
      return !r.ok && r.err.includes("connections_status_known");
    })());
  // ⚠ **AND THE `not-usable` BRANCH IS NOT A BELT — IT IS REACHABLE, AND A SWEEP SURVIVOR IS
  // HOW THAT WAS FOUND.** The comment that used to sit here said the CHECK made that branch
  // unreachable, so the refusal was asserted by proving an unknown status cannot be WRITTEN.
  // That reasoning covers a status nothing recognises and **misses `'expired'`, which is one of
  // the four the CHECK admits** — a legal value, not `'active'`, and with no clock set it walks
  // past the disconnected, revoked and expires_at arms to land on exactly this one. With the
  // branch removed the door LEASES it: a credential handed out for a connection whose own row
  // says it is expired. *A wall nobody can drive is a wall nobody is guarding* — and the reason
  // nobody could drive it was a wrong claim about which states are reachable, in the comment.
  check("⚠ a STORED `expired` with no clock is refused by name, not leased",
    (() => {
      jget(`select agent.connect_provider('${CX_T}','${CX_A1}','${CX_EXP}','fakemail',
              'Stored expired','exp@example.test',array['read'],'fake-token-do-not-use-0011') ->> 'ok';`);
      // `'expired'` is a status the CHECK ADMITS, so the owner can really put a row in it —
      // which is the whole point: this is a legal state, not a forced impossibility.
      jget(`update agent.connections set status='expired', expires_at = null where id='${CX_EXP}';`,
           asRowOwner);
      const out = jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_EXP}')::text;`);
      // BOTH halves: the refusal by name, and that no credential came back with it.
      return /"error"\s*:\s*"not-usable"/.test(out) && /"status"\s*:\s*"expired"/.test(out)
        && !out.includes("fake-token");
    })());
  check("...with the observer alive: the same row leases cleanly once it is active again",
    (() => {
      jget(`update agent.connections set status='active' where id='${CX_EXP}';`, asRowOwner);
      return jget(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_EXP}') ->> 'ok';`) === "true";
    })());

  // ── THE CREDENTIAL'S PROTECTION IS A PRIVILEGE AND A COLUMN LIST ──
  //
  // ⚠ ASKED AS PRIVILEGES, NEVER AS REFUSALS. `authenticated` holds no USAGE on this schema
  // in a fresh cluster, so every read as that role answers `permission denied for schema
  // agent` whatever the table grants are — this file has already recorded a check that
  // passed for exactly that wrong reason.
  check("⚠ `authenticated` CANNOT read either credential column",
    jget(`select coalesce(bool_or(has_column_privilege('authenticated','agent.connections',c,'select')), false)
            from unnest(array['secret','refresh_secret']) c;`) === "f");
  check("...and cannot write the table at all",
    jget(`select coalesce(bool_or(has_table_privilege('authenticated','agent.connections',p)), false)
            from unnest(array['insert','update','delete']) p;`) === "f");
  // ⚠ **THE GRANT IT DOES HOLD IS WHAT MAKES THE VIEW WORK, and leaving it out was a real
  // defect my own check passed over.** A `security_invoker` view runs as the CALLER, so with
  // no column grant here `authenticated` reading the view is refused `permission denied for
  // table connections` — the screen shows nothing. The first version of this check asked
  // `count <> '0'`, which an EMPTY answer satisfies, so it was green over a broken view.
  check("⚠ ...but it CAN read every non-secret column, or the view is unreadable",
    jget(`select count(*) from information_schema.columns c
           where c.table_schema='agent' and c.table_name='connections'
             and c.column_name not in ('secret','refresh_secret')
             and not has_column_privilege('authenticated','agent.connections',c.column_name,'select');`)
      === "0");
  check("...and the view itself", 
    jget(`select has_table_privilege('authenticated','agent.connection_list','select');`) === "t");
  check("⚠ the view selects NEITHER secret, so there is nothing for a reader to widen",
    jget(`select count(*) from information_schema.columns
           where table_schema='agent' and table_name='connection_list'
             and column_name in ('secret','refresh_secret');`) === "0");
  // ⚠ **AND THE SAME QUESTIONS OF `service_role`, WHICH IS THE ROLE THIS ENGINE RUNS AS — a
  // real finding, measured rather than reviewed.** The migration's own header says the
  // credential has ONE DOOR and it is not a read; that was true of the SCHEMA and false of
  // the PRIVILEGES, because `grant select on table` includes `secret`. Measured before the
  // fix: `has_column_privilege('service_role',…,'secret','select')` answered TRUE and the
  // ACL read `service_role=arw/postgres`, so the Worker could have asked PostgREST for every
  // customer's credential in one query. All five functions are `security definer`, so the
  // CALLING role needs no table grant to use them — which is what makes closing it free.
  check("⚠ `service_role` CANNOT read either credential column either",
    jget(`select coalesce(bool_or(has_column_privilege('service_role','agent.connections',c,'select')), false)
            from unnest(array['secret','refresh_secret']) c;`) === "f");
  check("...and cannot write the table at all",
    jget(`select coalesce(bool_or(has_table_privilege('service_role','agent.connections',p)), false)
            from unnest(array['insert','update','delete']) p;`) === "f");
  check("⚠ ...but CAN read every non-secret column, or the Worker's own list is unreadable",
    jget(`select count(*) from information_schema.columns c
           where c.table_schema='agent' and c.table_name='connections'
             and c.column_name not in ('secret','refresh_secret')
             and not has_column_privilege('service_role','agent.connections',c.column_name,'select');`) === "0");
  // ⚠ **DRIVEN AS THAT ROLE, and the three CONTROLS are what make the refusals mean
  // something**: a wall that also closed the one door would satisfy every negative below.
  check("⚠ ...and connecting still works AS that role — `security definer`, so no grant needed",
    (() => {
      const r = psql(`select agent.connect_provider('${CX_T}','${CX_A1}','${CX_R}','fakemail',`
        + `'Role probe','role@example.test',array['read'],'${R_SECRET}') ->> 'ok';`,
        { role: "service_role" });
      return r.ok && r.out === "true";
    })());
  check("⚠ ...and the ONE DOOR still opens for it — the lease answers the credential",
    (() => {
      const r = psql(`select agent.lease_connection('${CX_T}','${CX_A1}','${CX_R}') ->> 'secret';`,
        { role: "service_role" });
      return r.ok && r.out === R_SECRET;
    })());
  check("...and so does the view it really reads",
    (() => {
      const r = psql(`select count(*) > 0 from agent.connection_list where tenant_id='${CX_T}';`,
        { role: "service_role" });
      return r.ok && r.out === "t";
    })());
  check("⚠ ...while a DIRECT read of the credential is refused by the column grant",
    (() => {
      const r = psql(`select secret from agent.connections;`,
        { role: "service_role", expectFail: true });
      return !r.ok && /permission denied for (table|column|relation) connections/.test(r.err);
    })());
  check("⚠ ...and so is `select *`, because Postgres checks the columns a query NAMES",
    (() => {
      const r = psql(`select * from agent.connections;`, { role: "service_role", expectFail: true });
      return !r.ok && /permission denied/.test(r.err);
    })());
  check("...and a direct write of one",
    (() => {
      const r = psql(`update agent.connections set secret='mine' where id='${CX_R}';`,
        { role: "service_role", expectFail: true });
      return !r.ok && /permission denied/.test(r.err);
    })());
  // ⚠ **A CENSUS OVER WHICH BODIES READ A STORED CREDENTIAL AT ALL, so a sixth function that
  // gains one fails by existing.** Exactly two do, and each for its own reason: the LEASE
  // reads it out (that is the one door) and the REFRESH reads it to keep a rotation token a
  // provider did not replace. The others write the column and never read the row's value
  // back, which is why they are not on this list — and what they ANSWER is checked below,
  // because writing a secret and handing one out are different things.
  check("⚠ ...and exactly TWO bodies read a stored credential: the one door, and the refresh",
    jget(`select coalesce(string_agg(p.proname, ',' order by p.proname), '') from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='agent' and (p.prosrc like '%v_row.secret%' or p.prosrc like '%.refresh_secret%');`)
      === "lease_connection,refresh_connection");
  // THE OBSERVER, ALIVE: the four besides the lease WRITE the column and never select it into
  // an answer, which is what the sentence above is really about. Asked of what they ANSWER.
  for (const [fn, call] of [
    ["connect_provider", `agent.connect_provider('${CX_T}','${CX_A1}','${CX_2}','fakemail','l',
       'probe@example.test','{}'::text[],'${SECRET}')`],
    ["refresh_connection", `agent.refresh_connection('${CX_T}','${CX_A1}','${CX_2}','${SECRET}')`],
    ["disconnect_connection", `agent.disconnect_connection('${CX_T}','${CX_A1}','${CX_2}')`],
    ["revoke_connection", `agent.revoke_connection('${CX_T}','${CX_A1}','${CX_2}')`],
  ]) {
    check(`...and ${fn}'s own answer carries no credential`,
      !jget(`select ${call}::text;`).includes(SECRET));
  }
  // THE OBSERVER, ALIVE: without this the four checks above are satisfied by a probe that
  // never reaches a credential at all. `CX_5` is the sibling agent's row, so the call names
  // `CX_A2` — the agent that really owns it.
  check("...with the observer alive: `lease_connection`'s answer really does carry one",
    jget(`select agent.lease_connection('${CX_T}','${CX_A2}','${CX_5}') ->> 'secret';`) === "s");

  // ── RLS, AND WHAT THE ACCOUNT NEXT DOOR SEES ──
  check("row level security is enabled AND forced on agent.connections",
    jget(`select relrowsecurity and relforcerowsecurity from pg_class
           where oid = 'agent.connections'::regclass;`) === "t");
  check("every connection function is `security definer` with an empty search_path",
    jget(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='agent' and p.proname in ('connect_provider','disconnect_connection',
             'revoke_connection','lease_connection','refresh_connection')
             and p.prosecdef and p.proconfig @> array['search_path=""'];`) === "5");
  // ⚠ **THE OBSERVER IS THE OWNER'S OWN READ, AND IT IS ASSERTED AS A NUMBER RATHER THAN AS
  // `<> '0'`.** A read that is REFUSED answers the empty string, which satisfies `<> '0'` —
  // so the loose form is green both when the view works and when nothing can read it, which
  // is exactly how the missing column grant above got this far.
  const cxMine = psql(`select count(*) from agent.connection_list;`,
    { role: "authenticated", claims: `{"tenant_id":"${CX_T}"}` }).out;
  const cxHeld = jget(`select count(*) from agent.connections where tenant_id='${CX_T}';`);
  check("the owning account reads its own connections through the view, and ALL of them",
    cxMine === cxHeld && /^[1-9][0-9]*$/.test(cxMine), `${cxMine} of ${cxHeld}`);
  check("⚠ ...and the account next door reads none of them",
    psql(`select count(*) from agent.connection_list;`,
      { role: "authenticated", claims: `{"tenant_id":"${CX_T2}"}` }).out === "0");
  check("⚠ ...and `select *` on the table is refused for that role — the grant is a LIST",
    !psql(`select * from agent.connections;`,
      { role: "authenticated", claims: `{"tenant_id":"${CX_T}"}`, expectFail: true }).ok);
}

// ── AN EDIT THAT CHANGES ONLY WHAT IT NAMES, AND A ZONE NOBODY GUESSED ────────
//
// ⚠ **BOTH OF THESE ARE THIS ROUND'S FIXES AND BOTH NEEDED A REAL DATABASE, for the same
// reason the connections section above does: what they turn on is a ROW LOCK, a set of CHECK
// constraints and a function calling another function inside one transaction. A fake store
// cannot refuse a half-whole schedule, cannot serialise two callers, and cannot tell a
// preserved field from one a patch wrote back unchanged.
{
  console.log("\n── EDITING AN AUTOMATION, AND THE ZONE A SCHEDULE IS LOCAL TO ──");
  const PT = "patch-t";
  const PA = "dd000000-0000-0000-0000-0000000000a1";
  const PB = "dd000000-0000-0000-0000-0000000000a2";   // a sibling agent, same account
  const P1 = "dd000000-0000-0000-0000-0000000000b1";
  const P2 = "dd000000-0000-0000-0000-0000000000b2";
  psql(`insert into agent.agents (id, tenant_id, name, instructions)
        values ('${PA}'::uuid, '${PT}', 'Payroll agent', 'i'),
               ('${PB}'::uuid, '${PT}', 'Sibling', 'i')
        on conflict do nothing;`, asOwner);

  // ── THE ZONE IS A SETTING, READ AND NEVER GUESSED ──
  check("an agent with no zone set answers null rather than a default",
    jget(`select (agent.read_agent_settings('${PT}', '${PA}'::uuid) ->> 'zone' is null)::text;`) === "true");
  psql(`update agent.agents set zone = 'Europe/London' where id = '${PA}'::uuid;`, asOwner);
  check("...and once a person sets one, that is what it answers",
    jget(`select agent.read_agent_settings('${PT}', '${PA}'::uuid) ->> 'zone';`) === "Europe/London");
  // ⚠ **A ZONE THE SERVER CANNOT USE READS AS ABSENT, and only a real PostgreSQL can say
  // which names those are.** The column's length check cannot ask whether a name MEANS
  // anything; a stale one would otherwise reach a schedule and raise several layers from the
  // setting that is wrong.
  psql(`update agent.agents set zone = 'Mars/Olympus' where id = '${PA}'::uuid;`, asOwner);
  check("⚠ a zone this server does not know reads as none, not as itself",
    jget(`select (agent.read_agent_settings('${PT}', '${PA}'::uuid) ->> 'zone' is null)::text;`) === "true");
  check("...and `zone_is_usable` is what says so, both ways",
    jget(`select agent.zone_is_usable('Europe/London')::text || ' '
                 || agent.zone_is_usable('Mars/Olympus')::text || ' '
                 || agent.zone_is_usable('')::text || ' '
                 || coalesce(agent.zone_is_usable(null)::text, 'null');`) === "true false false false");
  psql(`update agent.agents set zone = 'Europe/London' where id = '${PA}'::uuid;`, asOwner);
  check("⚠ another account cannot read this agent's settings — the same answer a missing one gets",
    jget(`select agent.read_agent_settings('other-tenant', '${PA}'::uuid) ->> 'error';`) === "no-agent");

  // ── A STORED AUTOMATION, DISABLED, SCHEDULED, ZONED, WITH AN INPUT ──
  const made = jget(`select agent.create_automation('${PT}', '${PA}'::uuid, '${P1}'::uuid,
      'Payroll', false, 'daily', '23:00', 'Europe/London',
      '[{"id":"s1","type":"note","text":"hello {{customer}}","out":null}]'::jsonb, 20,
      '[{"name":"customer","label":"customer","required":false,"default":"","type":"text"}]'::jsonb)
      ->> 'ok';`);
  check("a disabled daily automation with an input exists", made === "true", made);
  const shape = () => jget(`select enabled::text || ' | ' || schedule || ' | ' || coalesce(at_local::text, '-')
      || ' | ' || coalesce(zone, '-') || ' | ' || jsonb_array_length(inputs)::text
      || ' | ' || jsonb_array_length(steps)::text || ' | v' || version::text
      || ' | ' || case when next_run_at is null then 'no-instant' else 'armed' end
      from agent.automations where id = '${P1}'::uuid;`);
  const BEFORE = shape();
  check("...and it reads as it was written",
    BEFORE === "false | daily | 23:00:00 | Europe/London | 1 | 1 | v1 | armed", BEFORE);

  // ⚠ **THE DEFECT, AT THE DATABASE: a rename must change the name and NOTHING else.**
  check("⚠ a rename changes the name and leaves every other field exactly as it was",
    jget(`select agent.patch_automation('${PT}', '${P1}'::uuid, '{"name":"Payroll (renamed)"}'::jsonb) ->> 'ok';`) === "true"
    && shape() === BEFORE
    && jget(`select name from agent.automations where id = '${P1}'::uuid;`) === "Payroll (renamed)",
    shape());

  // ── EVERY TYPE REFUSED RATHER THAN COERCED, and nothing written on any of them ──
  const junk = [
    ['{"enabled":"false"}', "bad-enabled"], ['{"enabled":1}', "bad-enabled"],
    ['{"name":7}', "bad-name"], ['{"name":"   "}', "bad-name"],
    ['{"schedule":"hourly"}', "bad-schedule"], ['{"schedule":["daily"]}', "bad-schedule"],
    ['{"atLocal":"9am"}', "bad-time"], ['{"atLocal":"09:00:30"}', "bad-time"],
    ['{"atLocal":"24:00"}', "bad-time"],
    ['{"zone":"Mars/Olympus"}', "bad-zone"], ['{"zone":7}', "bad-zone"],
    ['{"steps":"none"}', "bad-steps"], ['{"inputs":{}}', "bad-inputs"],
    ['{"days":"mon"}', "bad-days"], ['{"days":[1]}', "bad-days"],
    ['{"onDate":"2026-13-45"}', "bad-date"], ['{"onDate":"soon"}', "bad-date"],
    ['{"onEvent":7}', "bad-event"],
    ['{"nonsense":1}', "bad-field"], ['{"name":"X","nonsense":1}', "bad-field"],
    ['[]', "bad-patch"], ['"x"', "bad-patch"], ['7', "bad-patch"],
  ];
  let refused = 0;
  for (const [patch, want] of junk) {
    const got = jget(`select agent.patch_automation('${PT}', '${P1}'::uuid, '${patch}'::jsonb) ->> 'error';`);
    if (got === want) refused += 1; else check(`${patch} → ${want}`, false, `answered ${got}`);
  }
  check(`⚠ every unreadable value is refused BY NAME (${refused}/${junk.length})`, refused === junk.length);
  // ⚠ AND NOT ONE OF THEM CHANGED ANYTHING — asked AFTER all of them, because a refusal that
  // writes half a patch is the failure mode a per-case check would miss.
  check("⚠ ...and not one of them touched the row",
    shape() === BEFORE && jget(`select name from agent.automations where id = '${P1}'::uuid;`) === "Payroll (renamed)",
    shape());
  // ⚠ AN UNKNOWN KEY IS NAMED, because "that could not be saved" gives nobody anything to do.
  check("...and an unknown field is named in the answer",
    jget(`select agent.patch_automation('${PT}', '${P1}'::uuid, '{"nonsense":1}'::jsonb) ->> 'field';`) === "nonsense");

  // ── AN EXPLICIT CHANGE REALLY CHANGES, which is what makes the preserving a claim ──
  check("⚠ THE CONTROL: an explicit enable really enables, and only that",
    jget(`select agent.patch_automation('${PT}', '${P1}'::uuid, '{"enabled":true}'::jsonb) ->> 'ok';`) === "true"
    && shape() === BEFORE.replace("false |", "true |"), shape());
  check("⚠ ...and clearing the schedule clears its time and its instant, keeping the zone",
    jget(`select agent.patch_automation('${PT}', '${P1}'::uuid, '{"schedule":"manual","atLocal":null}'::jsonb) ->> 'ok';`) === "true"
    && shape() === "true | manual | - | Europe/London | 1 | 1 | v1 | no-instant", shape());
  /**
   * ⚠ **A HALF-WHOLE SCHEDULE IS A REFUSAL WITH A NAME, NOT A RAISE — and this assertion was
   * RE-ANCHORED because the product got better.**
   *
   * It read "refused by the column", and it was: `daily` with no time reached
   * `agent.automation_next_run`, which raises, and the caller got an HTTP 400 with three
   * PL/pgSQL context lines. That is the shape this whole round exists to remove, so
   * `patch_automation` now checks the RESOLVED combination and answers `bad-time` as a VALUE.
   * The constraint is still what makes it true and still catches anything that does not come
   * through here — proved separately below, against the table.
   */
  const halfWhole = jget(`select agent.patch_automation('${PT}', '${P1}'::uuid, '{"schedule":"daily"}'::jsonb)::text;`);
  check("⚠ a daily schedule with no time is refused BY NAME, as a value rather than a raise",
    JSON.parse(halfWhole).error === "bad-time" && JSON.parse(halfWhole).ok === false, halfWhole);
  check("...and the row is still what it was", shape() === "true | manual | - | Europe/London | 1 | 1 | v1 | no-instant", shape());
  // ⚠ **AND THE COLUMN IS STILL THE WALL, which only a real database can show.** The refusal
  // above is the ANSWER; this is what stops a writer that never asked. Driven straight at the
  // table, so the constraint is proved alive rather than assumed behind a function.
  const raw = psql(`update agent.automations set schedule = 'daily', at_local = null, next_run_at = null
                     where id = '${P1}'::uuid;`, asOwner);
  check("⚠ ...and the CONSTRAINT refuses the same row to a writer that did not ask",
    raw.err !== null && /automations_schedule_is_whole/.test(String(raw.err)), String(raw.err).slice(0, 110));

  // ── EVERY SCHEDULE THE COLUMN HOLDS, WRITTEN BY THE PATCH ──
  //
  // ⚠ **THE POINT OF DOING THIS HERE is that `automations_schedule_is_whole` is what really
  // decides, and it RAISES.** A weekly schedule with no days, a one-off with no date, a manual
  // one carrying a time: each is a row Postgres will not hold, and the patch's job is to
  // produce whole ones from partial calls. A fake store cannot refuse any of them.
  const P3 = "dd000000-0000-0000-0000-0000000000b3";
  jget(`select agent.create_automation('${PT}', '${PA}'::uuid, '${P3}'::uuid,
      'Every trigger', true, 'weekly', '09:00', 'Europe/London', '[]'::jsonb, 20, '[]'::jsonb,
      '{mon,thu}'::text[], null, null) ->> 'ok';`);
  const trig = () => jget(`select schedule || ' | ' || coalesce(at_local::text, '-') || ' | ' || days::text
      || ' | ' || coalesce(on_date::text, '-') || ' | ' || coalesce(on_event, '-')
      || ' | ' || case when next_run_at is null then 'no-instant' else 'armed' end
      from agent.automations where id = '${P3}'::uuid;`);
  check("a weekly automation exists, armed", trig() === "weekly | 09:00:00 | {mon,thu} | - | - | armed", trig());
  check("⚠ moving only the DAYS keeps the time and re-arms the instant",
    jget(`select agent.patch_automation('${PT}', '${P3}'::uuid, '{"days":["sat","sun"]}'::jsonb) ->> 'ok';`) === "true"
    && trig() === "weekly | 09:00:00 | {sat,sun} | - | - | armed", trig());
  // ⚠ **REFUSED BY NAME rather than by a raise from the arithmetic.** MEASURED before the fix:
  // `{"days": []}` on a weekly automation reached `agent.automation_next_run`, which raises *a
  // weekly schedule needs at least one day* with three context lines. The answer names the field.
  check("⚠ a weekly schedule with NO days is refused BY NAME, and the row is untouched",
    JSON.parse(jget(`select agent.patch_automation('${PT}', '${P3}'::uuid, '{"days":[]}'::jsonb)::text;`)).error === "bad-days"
    && trig() === "weekly | 09:00:00 | {sat,sun} | - | - | armed", trig());
  // AND EVERY OTHER HALF-WHOLE COMBINATION, each by its own name. Two directions per schedule:
  // a field it needs and has not got, and a field it must not have and does.
  for (const [patch, want] of [
    ['{"schedule":"once","onDate":null}', "bad-date"],
    ['{"schedule":"daily","days":["mon"]}', "bad-days"],
    ['{"schedule":"weekly","onDate":"2027-01-01"}', "bad-date"],
    ['{"schedule":"manual"}', "bad-schedule"],
  ]) {
    const got = JSON.parse(jget(`select agent.patch_automation('${PT}', '${P3}'::uuid, '${patch}'::jsonb)::text;`));
    check(`⚠ ...and ${patch} is ${want}`, got.error === want && got.ok === false, JSON.stringify(got));
  }
  check("...and none of them moved the row", trig() === "weekly | 09:00:00 | {sat,sun} | - | - | armed", trig());
  check("⚠ becoming a one-off clears the days and takes the date",
    jget(`select agent.patch_automation('${PT}', '${P3}'::uuid,
            '{"schedule":"once","onDate":"2027-03-01","days":[]}'::jsonb) ->> 'ok';`) === "true"
    && trig() === "once | 09:00:00 | {} | 2027-03-01 | - | armed", trig());
  check("⚠ an event name is stored beside whatever schedule it has",
    jget(`select agent.patch_automation('${PT}', '${P3}'::uuid, '{"onEvent":"order.paid"}'::jsonb) ->> 'ok';`) === "true"
    && trig() === "once | 09:00:00 | {} | 2027-03-01 | order.paid | armed", trig());
  check("⚠ ...and clearing it is explicit, and leaves the schedule alone",
    jget(`select agent.patch_automation('${PT}', '${P3}'::uuid, '{"onEvent":null}'::jsonb) ->> 'ok';`) === "true"
    && trig() === "once | 09:00:00 | {} | 2027-03-01 | - | armed", trig());
  check("⚠ and back to manual clears the time, the date and the instant together",
    jget(`select agent.patch_automation('${PT}', '${P3}'::uuid,
            '{"schedule":"manual","atLocal":null,"onDate":null}'::jsonb) ->> 'ok';`) === "true"
    && trig() === "manual | - | {} | - | - | no-instant", trig());

  // ── ENABLING RE-ARMS EVERY SCHEDULE, NOT ONLY A DAILY ONE ──
  //
  // ⚠ **THE GAP THIS CLOSES, and only a real database shows it**: `set_automation_enabled`
  // recomputed the next instant for `schedule = 'daily'` alone, so a weekly or one-off
  // automation disabled for a fortnight came back with an instant in the past — the backlog
  // burst the scheduler exists to avoid, which its own comment describes and the code named one
  // schedule for. The instant is READ, before and after, because "it re-armed" is a claim about
  // a value moving forward.
  jget(`select agent.patch_automation('${PT}', '${P3}'::uuid,
          '{"schedule":"weekly","atLocal":"09:00","days":["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb) ->> 'ok';`);
  psql(`update agent.automations set enabled = false, next_run_at = now() - interval '14 days'
         where id = '${P3}'::uuid;`, asOwner);
  const behind = jget(`select next_run_at::text from agent.automations where id = '${P3}'::uuid;`);
  check("a disabled weekly automation is a fortnight behind", behind !== "", behind);
  const rearmed = JSON.parse(jget(`select agent.set_automation_enabled('${PT}', '${P3}'::uuid, true)::text;`));
  check("⚠ ENABLING IT RE-ARMS THE INSTANT FORWARD — for a weekly one too",
    rearmed.ok === true
    && jget(`select (next_run_at > now())::text from agent.automations where id = '${P3}'::uuid;`) === "true",
    `${behind} -> ${jget(`select next_run_at::text from agent.automations where id = '${P3}'::uuid;`)}`);
  // AND TURNING IT OFF LEAVES THE INSTANT ALONE, which the wholeness check requires: a
  // scheduled row is whole only WITH one, and the enabled flag is what the tick reads.
  const armedAt = jget(`select next_run_at::text from agent.automations where id = '${P3}'::uuid;`);
  jget(`select agent.set_automation_enabled('${PT}', '${P3}'::uuid, false) ->> 'ok';`);
  check("...and turning it off leaves the instant alone",
    jget(`select next_run_at::text from agent.automations where id = '${P3}'::uuid;`) === armedAt);

  // ── STOPPING ONE EXECUTION, UNDER ITS OPERATION RECORD ──
  //
  // ⚠ **THE WRAPPER IS WHAT MAKES A REDELIVERY ANSWER RATHER THAN ACT, and `cancel_run` is
  // where an agent's reach had to be proved against a real journal**: the stop is an ENTRY, the
  // status is PROJECTED off it, and the counts come from rows. None of that exists in a fake.
  const RUNX = "dd000000-0000-0000-0000-0000000000c1";
  psql(`insert into agent.runs (id, tenant_id, model, status)
        values ('${RUNX}'::uuid, '${PT}', 'stand-in', 'running') on conflict do nothing;`, asOwner);
  psql(`insert into agent.automation_runs (id, automation_id, tenant_id, agent_id, trigger, steps, zone)
        values ('${RUNX}'::uuid, '${P3}'::uuid, '${PT}', '${PA}'::uuid, 'manual', '[]'::jsonb, 'Europe/London')
        on conflict do nothing;`, asOwner);
  const CKEY = "99999999-9999-4999-8999-999999999999:71:0";
  const cancelOnce = (hash = "cafe7171") => JSON.parse(jget(`select agent.cancel_run_once('${PT}', '${CKEY}',
      '${hash}', null, '${RUNX}'::uuid, 'agent:${PA}', 'not needed')::text;`));
  // ⚠ NOT `first`: this block already declares one for the patch wrapper, and a second `const`
  // in one scope makes node report the whole FILE as failing. The recorded trap, met here.
  const stopped1 = cancelOnce();
  check("⚠ an execution is stopped, and what it had done is COUNTED rather than undone",
    stopped1.ok === true && stopped1.repeat === false
    && Number.isInteger(stopped1.completedSteps) && Number.isInteger(stopped1.completedCalls),
    JSON.stringify(stopped1).slice(0, 200));
  check("...and the run's own journal says who stopped it and why",
    jget(`select (stop ->> 'reason') || ' / ' || (stop ->> 'cancelledBy') || ' / ' || (stop ->> 'note')
            from agent.runs where id = '${RUNX}'::uuid;`) === `cancelled / agent:${PA} / not needed`);
  check("⚠ ...and the status is PROJECTED off the entry, not written beside it",
    jget(`select status from agent.runs where id = '${RUNX}'::uuid;`) === "stopped");
  const twice = cancelOnce();
  check("⚠ a redelivery answers the first attempt rather than stopping it again",
    twice.repeat === true && (twice.ok === true), JSON.stringify(twice).slice(0, 160));
  check("⚠ ...and a DIFFERENT call in that slot is refused",
    cancelOnce("other-hash").error === "operation-mismatch");

  // ── THE VERSION FENCE, AND WHAT IT REALLY COVERS ──
  check("a stale version is refused, and says which one it has",
    jget(`select agent.patch_automation('${PT}', '${P1}'::uuid, '{"name":"Z"}'::jsonb, 99) ->> 'error';`) === "stale"
    && jget(`select (agent.patch_automation('${PT}', '${P1}'::uuid, '{"name":"Z"}'::jsonb, 99) -> 'version')::text;`) === "1");
  check("...and the right version goes through",
    jget(`select agent.patch_automation('${PT}', '${P1}'::uuid, '{"name":"Z"}'::jsonb, 1) ->> 'ok';`) === "true"
    && jget(`select name from agent.automations where id = '${P1}'::uuid;`) === "Z");
  // ⚠ **`version` MOVES ON A CHANGE OF STEPS AND ON NOTHING ELSE — measured, not assumed**,
  // because the fence's scope is exactly that and a note claiming more would be false.
  check("⚠ a change of STEPS moves the version",
    jget(`select (agent.patch_automation('${PT}', '${P1}'::uuid,
            '{"steps":[{"id":"s1","type":"note","text":"hello {{customer}}","out":null},
                       {"id":"s2","type":"note","text":"and again","out":null}]}'::jsonb) -> 'version')::text;`) === "2");
  check("⚠ ...and a rename does not, so a parent's workflow snapshot stays honest",
    jget(`select (agent.patch_automation('${PT}', '${P1}'::uuid, '{"name":"Z2"}'::jsonb) -> 'version')::text;`) === "2");

  // ── WHOSE IT IS ──
  check("another account's automation is `no-automation`, not something to rewrite",
    jget(`select agent.patch_automation('other-tenant', '${P1}'::uuid, '{"name":"theirs"}'::jsonb) ->> 'error';`) === "no-automation");
  check("...and the row is untouched", jget(`select name from agent.automations where id = '${P1}'::uuid;`) === "Z2");

  // ── THE WRAPPER: A RETRY OF A COMPLETED EDIT CANNOT OVERWRITE A NEWER CHANGE ──
  //
  // ⚠ **THE LAST CLAUSE OF THE REQUIREMENT, and it is a stronger guarantee than a version
  // check: it holds even when the newer change moved a field this patch never named.**
  const PKEY = "99999999-9999-4999-8999-999999999999:41:0";
  const PHASH = "cafe4141";
  const once = (patch, hash = PHASH) => jget(`select agent.patch_automation_once('${PT}', '${PKEY}', '${hash}',
      null, '${P1}'::uuid, '${patch}'::jsonb, null)::text;`);
  const first = once('{"name":"From the tool"}');
  check("the wrapper does the edit once", JSON.parse(first).ok === true
    && jget(`select name from agent.automations where id = '${P1}'::uuid;`) === "From the tool", first);
  psql(`update agent.automations set name = 'Corrected by a person' where id = '${P1}'::uuid;`, asOwner);
  const again = once('{"name":"From the tool"}');
  check("⚠ a redelivery answers the first attempt and writes NOTHING",
    JSON.parse(again).repeat === true
    && jget(`select name from agent.automations where id = '${P1}'::uuid;`) === "Corrected by a person", again);
  check("⚠ ...and a DIFFERENT edit in that slot is refused, having written nothing",
    JSON.parse(once('{"name":"Something else"}', "other-hash")).error === "operation-mismatch"
    && jget(`select name from agent.automations where id = '${P1}'::uuid;`) === "Corrected by a person");

  // ── TWO CALLERS AT ONCE: THE LOCK IS WHAT MAKES DISJOINT EDITS BOTH SURVIVE ──
  //
  // ⚠ **THIS IS THE CHECK THAT CANNOT BE FAKED.** `patch_automation` takes `for update` BEFORE
  // it resolves anything, so a second caller waits and then reads what the first committed —
  // which is why two edits naming DIFFERENT fields both stand. Resolving against an unlocked
  // read would have the second write its own stale value over the first, and a unit test with
  // one process in it cannot tell the two apart.
  jget(`select agent.create_automation('${PT}', '${PA}'::uuid, '${P2}'::uuid,
      'Concurrent', true, 'manual', null, 'Europe/London', '[]'::jsonb, 20, '[]'::jsonb) ->> 'ok';`);
  // ⚠ **REALLY CONCURRENT: TWO SESSIONS, ONE HOLDING THE ROW.** A sequential pair proves
  // nothing about the lock — the second call would read the first's committed value either
  // way. `A` renames it and SITS INSIDE ITS TRANSACTION; `B` starts a moment later and asks
  // to disable it, blocks on `A`'s lock, and only then resolves. With the lock where it is, B
  // reads A's name and preserves it; resolving before locking would have B write the name it
  // read BEFORE A committed, and A's rename would be gone.
  const race = (() => {
    const one = (patch, hold) => `psql -X -q -t -A -d ${DB} -c ${shq(
      `begin; select agent.patch_automation('${PT}', '${P2}'::uuid, '${patch}'::jsonb);`
      + (hold ? ` select pg_sleep(1.2);` : "") + ` commit;`)}`;
    try {
      execFileSync("su", ["postgres", "-c",
        `${one('{"name":"Renamed by A"}', true)} & sleep 0.4; ${one('{"enabled":false}', false)}; wait`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return { ok: true, err: "" };
    } catch (e) { return { ok: false, err: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() }; }
  })();
  const after = jget(`select name || ' / ' || enabled::text from agent.automations where id = '${P2}'::uuid;`);
  check("⚠ TWO CONCURRENT EDITS NAMING DIFFERENT FIELDS BOTH SURVIVE",
    race.ok && after === "Renamed by A / false", `${race.err || ""} row: ${after}`);
  // AND THE LOCK IS THERE, read off the function's own body — the property the concurrency
  // above rests on, asked directly so a rewrite that dropped it is red even if the sequential
  // case still passes.
  check("⚠ ...and the lock is taken BEFORE anything is resolved",
    (() => {
      const body = jget(`select pg_get_functiondef('agent.patch_automation(text,uuid,jsonb,integer)'::regprocedure);`);
      const lock = body.indexOf("for update");
      const firstResolve = body.indexOf("p_patch ? 'name'");
      return lock > 0 && firstResolve > lock;
    })(), "the patch resolves a field before it holds the row");
}

// ── EVERY `_once` WRAPPER TAKES ITS INNER FUNCTION'S PARAMETERS ───────────────
//
// ⚠ **THE RULE, AND IT COST THREE DEMONSTRATIONS AT ONCE.** A wrapper's parameter list is
// `p_tenant`, its own three bookkeeping arguments, and then the inner function's parameters
// after `p_tenant` — in that order, with the same types. That is the rule the local
// PostgREST shim DERIVES each wrapper's argument list from rather than writing eleven lists
// out twice, so a wrapper that does not follow it is a shim sending arguments the database
// will not accept: measured, `run_automation` answered
// `HTTP 400 … accept_automation_run_once(...) does not exist` on an inner function, a
// wrapper and a shim that were each correct alone.
//
// **ASKED OF `pg_proc`, SO IT IS ABOUT WHAT WOULD REALLY BE APPLIED** — not about the text of
// a file, and not about one wrapper somebody remembered. A parameter added to any of the six
// inner functions fails here by existing.
{
  console.log("\n── EVERY `_once` WRAPPER FOLLOWS ITS INNER FUNCTION ──");
  /**
   * ⚠ **DERIVED FROM THE DATABASE, NOT LISTED — and the list it replaces was already one
   * wrapper short.** Every `*_once` the schema really has must obey the rule, so a wrapper
   * added next month is covered by existing rather than by somebody remembering this array.
   * `patch_automation_once` is the one that proved it: written and not named here.
   *
   * The catalog is the ONE reader, and the shim's own `ONCE_OF` is a separate list in a
   * separate product — which is why the derivation is asked of `pg_proc` rather than of it.
   */
  const WRAPPED = jget(`select coalesce(string_agg(left(p.proname, length(p.proname) - 5), ',' order by p.proname), '')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'agent' and p.proname like '%\\_once';`).split(",").filter(Boolean);
  check("⚠ the wrapper census is derived from the schema and found some",
    WRAPPED.length >= 7 && WRAPPED.includes("patch_automation"),
    `it reads ${JSON.stringify(WRAPPED)}`);
  // THE OWN FOUR, in the order the wrappers really declare them.
  const OWN = ["p_tenant text", "p_op_key text", "p_args_hash text", "p_op_run uuid"];
  const params = (name) => {
    const rows = jget(`select coalesce(string_agg(t, '|' order by t), '') from (
        select pg_get_function_arguments(p.oid) as t from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'agent' and p.proname = '${name}') x;`);
    return rows === "" ? [] : rows.split("|");
  };
  // ⚠ EACH NAME MUST RESOLVE TO EXACTLY ONE FUNCTION. An overload is the other half of this
  // defect — a call with the old arity matches both and is refused `is not unique` — so the
  // census would be meaningless without it, and it is what the migration's own drops buy.
  for (const inner of WRAPPED) {
    const i = params(inner);
    const w = params(`${inner}_once`);
    check(`⚠ exactly one agent.${inner} and one agent.${inner}_once`,
      i.length === 1 && w.length === 1, `${i.length} inner, ${w.length} wrapper`);
    if (i.length !== 1 || w.length !== 1) continue;
    // `pg_get_function_arguments` writes `name type DEFAULT expr`; the DEFAULT is the
    // wrapper's business and not the rule, so it is cut off both sides before comparing.
    const bare = (list) => list.split(",").map((a) => a.trim().split(/\s+DEFAULT\s+/i)[0].trim());
    const innerArgs = bare(i[0]);
    const wrapArgs = bare(w[0]);
    const want = [...OWN, ...innerArgs.slice(1)];
    check(`⚠ agent.${inner}_once takes its own four and then ${inner}'s own`,
      wrapArgs.length === want.length && wrapArgs.every((a, n) => a === want[n]),
      `wrapper ${JSON.stringify(wrapArgs)} / wanted ${JSON.stringify(want)}`);
    // THE OBSERVER, PROVED ALIVE TWO WAYS. A census over an EMPTY inner list would pass
    // every wrapper, which is the shape a renamed function produces — so the inner list is
    // asserted non-trivial. And the COMPARATOR is asked to discriminate: the same lists with
    // one parameter missing must NOT satisfy it, which is exactly the shape the defect had
    // and is a claim about this check rather than about the schema.
    check(`...and ${inner} really has parameters to follow`, innerArgs.length >= 2,
      JSON.stringify(innerArgs));
    const short = want.slice(0, -1);
    check(`...and this census would have CAUGHT ${inner}_once missing one`,
      !(wrapArgs.length === short.length && wrapArgs.every((a, n) => a === short[n])),
      `a wrapper one short would have passed: ${JSON.stringify(short)}`);
  }
}

} finally {
  try {
    execFileSync("su", ["postgres", "-c", `psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)}`],
      { stdio: ["ignore", "pipe", "pipe"] });
  } catch { /* best effort */ }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) { console.log("FAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
