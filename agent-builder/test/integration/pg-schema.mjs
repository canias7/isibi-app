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
                     "run_status", "run_stop", "run_step", "run_model", "run_started_at", "run_stopped_at"]) {
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
} finally {
  try {
    execFileSync("su", ["postgres", "-c", `psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)}`],
      { stdio: ["ignore", "pipe", "pipe"] });
  } catch { /* best effort */ }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) { console.log("FAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
