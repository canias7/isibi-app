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
function holdRowLock(runId, { db = DB, seconds = 8, waitMs = 6000 } = {}) {
  const sql = `begin; select 1 from agent.run_work where run_id='${runId}' for update; select pg_sleep(${seconds}); commit;`;
  const child = spawn("su", ["postgres", "-c",
    `psql -X -q -d ${db} -c ${shq(sql)}`], { stdio: "ignore", detached: true });
  const held = () => psql(`select count(*) from pg_locks l
      join pg_class c on c.oid = l.relation
      join pg_stat_activity a on a.pid = l.pid
     where c.relname = 'run_work' and l.mode = 'RowShareLock' and l.granted
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

  console.log("\n── the log and the work go together ──");
  check("deleting the run takes its work row with it",
    psql(`delete from agent.runs where id='${Q1}';`, asWriter).ok
    && jget(`select count(*) from agent.run_work where run_id='${Q1}';`) === "0");
  check("...and its log",
    jget(`select count(*) from agent.run_entries where run_id='${Q1}';`) === "0");
} finally {
  try {
    execFileSync("su", ["postgres", "-c", `psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)}`],
      { stdio: ["ignore", "pipe", "pipe"] });
  } catch { /* best effort */ }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) { console.log("FAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
