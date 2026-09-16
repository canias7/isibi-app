/**
 * THE SQL MUTATION SPEC — the schema's guarantees, broken on purpose.
 *
 * WHY THIS EXISTS SEPARATELY. The JavaScript sweep runs the unit suite, which
 * cannot see a schema, so until now no database guarantee had been proved by
 * BREAKING the schema and watching a check go red. Sixty hand-written checks are
 * adversarial but they are not mechanical: nothing showed they would catch a
 * schema edited in a way nobody thought of. This closes that for the four
 * guarantees that matter most.
 *
 * FOCUSED, on the four claims the notes make loudest:
 *   tenant isolation · duplicate prevention · journal immutability ·
 *   whole-run deletion.
 *
 * Each mutant is a change that a careless edit could really make — a policy
 * loosened, a `unique` dropped, a raise turned into a return, a marker widened —
 * not a syntax error. A migration that will not apply proves nothing.
 *
 * NOT MUTATED, AND SAID OUT LOUD: `force row level security`. Removing it would
 * only be observable to a table OWNER who is not a superuser, and the harness's
 * owner IS one — superusers bypass row level security whatever FORCE says. So that
 * one line's effect is unverifiable here and a mutant of it would survive for a
 * reason that has nothing to do with the schema being right.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
// THE LAST MIGRATION WINS for anything it redefines, so a mutant must be aimed at
// the file that is actually in force. `agent.tenant_id()` is defined twice — once
// in the first migration and again in the second — and mutating the FIRST one would
// change nothing, because the second replaces it. That is an inert mutant waiting
// to happen, so the tenant mutants below name the LATEST file explicitly.
if (files.length < 1) { console.error(`no migrations in ${DIR}`); process.exit(1); }

/**
 * The LAST migration that defines a thing, found by asking the files rather than by
 * counting them.
 *
 * **A POSITION IS NOT AN IDENTITY.** This was `files[files.length - 1]`, which was
 * right for exactly as long as the tenant function lived in the newest migration —
 * and the moment a third migration arrived, every mutant aimed at "the latest" was
 * pointing at a file that does not contain them. Derived, it cannot go stale.
 */
const lastDefining = (needle) => {
  const hit = [...files].reverse().find((f) => fs.readFileSync(path.join(DIR, f), "utf8").includes(needle));
  if (!hit) { console.error(`no migration defines ${needle}`); process.exit(1); }
  return path.join(DIR, hit);
};

const SQL = path.join(DIR, files[0]);
const TENANT_FN = lastDefining("function agent.tenant_id()");
const WORK = lastDefining("create table if not exists agent.run_work");
const m = (label, from, to, control = false) => ({ label, files: [SQL], from, to, control });
const mTenant = (label, from, to) => ({ label, files: [TENANT_FN], from, to, control: false });
const mWork = (label, from, to, control = false) => ({ label, files: [WORK], from, to, control });

/**
 * A mutant aimed at whichever migration LAST defines a function.
 *
 * **THIS IS THE RECORDED TRAP ARRIVING A SECOND TIME, and it is why `lastDefining`
 * exists.** The fence migration redefines `claim_run`, `accept_run`, `beat_run` and
 * `release_run`, so every mutant that was aimed at the queue migration's copies of
 * them became INERT BY CONSTRUCTION the moment it landed — mutating dead code,
 * arriving through migration order. Asking the files which one is in force cannot go
 * stale, and a `-- no such function` would fail the pre-check rather than survive the
 * run.
 */
const FN = (name) => lastDefining(`function agent.${name}(`);
const mFn = (name) => (label, from, to, control = false) => ({ label, files: [FN(name)], from, to, control });
const mClaim = mFn("claim_run");
const mBeat = mFn("beat_run");
const mRelease = mFn("release_run");
const mAccept = mFn("accept_run");
const mAppend = mFn("append_entry");
const mSend = mFn("send_to_agent");
/**
 * The migration that adds the settings — the status, the selection and the shape
 * constraint. Found by a thing only IT defines, so it cannot be named by position.
 */
const SETTINGS = lastDefining("add column if not exists status text");
const mSettings = (label, from, to, control = false) => ({ label, files: [SETTINGS], from, to, control });
const mAuthored = mFn("authored_run");
const mThread = (label, from, to, control = false) =>
  ({ label, files: [lastDefining("create or replace view agent.agent_thread")], from, to, control });
/**
 * THE AUTOMATIONS MIGRATION, found by what it defines rather than by its position —
 * the same rule `lastDefining` exists for. `claim_run` is redefined THERE, so
 * `mClaim` above already points at this file for anything it touches; these are the
 * things only this migration has.
 */
const AUTOS = lastDefining("create table if not exists agent.automations");
const mAuto = (label, from, to, control = false) => ({ label, files: [AUTOS], from, to, control });

const spec = [
  // ── TENANT ISOLATION ──────────────────────────────────────────────────────
  m("SQL/isolation: the runs policy stops comparing the tenant",
    "  using (tenant_id = agent.tenant_id())\n  with check (tenant_id = agent.tenant_id());",
    "  using (true)\n  with check (true);"),
  m("SQL/isolation: the runs policy reads any tenant it is asked about",
    "  using (tenant_id = agent.tenant_id())", "  using (tenant_id = tenant_id)"),
  // NOT "remove the tenant comparison from the entries policy": that mutant
  // SURVIVED and was proved INERT by measurement. `agent.runs` is itself under row
  // level security, so the policy's subquery is already filtered to this tenant —
  // the comparison is a deliberate second wall, declared as such in the migration.
  // What IS testable is whether the entries policy restricts anything at all.
  m("SQL/isolation: the entries policy stops restricting anything",
    "  using (exists (\n    select 1 from agent.runs r\n     where r.id = run_entries.run_id and r.tenant_id = agent.tenant_id()))",
    "  using (true)"),
  // NO MUTANTS ON THE FIRST MIGRATION'S `agent.tenant_id()`. Two were tried and
  // both SURVIVED, and both were INERT BY CONSTRUCTION: the second migration
  // replaces that function, so editing the first one changes nothing that runs.
  // This is the same trap as mutating dead code, arriving through migration order.
  // Their replacements below target the definition actually in force.
  m("SQL/isolation: a client is granted the writer's privileges",
    "grant select on agent.runs, agent.run_entries to authenticated;",
    "grant select, insert, update, delete on agent.runs, agent.run_entries to authenticated;"),

  // The tenant fallback, aimed at the migration that actually defines it.
  mTenant("SQL/isolation: the subject fallback is gone, so no real Supabase token matches anything",
    "    nullif(claims ->> 'sub', '')          -- otherwise the signed-in subject",
    "    null"),
  mTenant("SQL/isolation: the SUBJECT wins over an explicit tenant_id",
    "    nullif(claims ->> 'tenant_id', ''),   -- explicit, and it wins\n    nullif(claims ->> 'sub', '')          -- otherwise the signed-in subject",
    "    nullif(claims ->> 'sub', ''),\n    nullif(claims ->> 'tenant_id', '')"),
  // THE SENTINEL MUST OWN A ROW AT THE MOMENT THE CHECK LOOKS, or the mutant is
  // inert: `subject-99` was tried and survived, because the run owned by that
  // subject is created and deleted in a later section than the fail-closed checks.
  // `t1` owns a run for the whole file.
  mTenant("SQL/isolation: unreadable claims FAIL OPEN",
    "exception when others then\n  -- Claims that will not parse are not a tenant. Anything we cannot read as an\n  -- identity is not an identity.\n  return null;",
    "exception when others then\n  return 't1';"),
  mTenant("SQL/isolation: the tenant is a constant instead of the verified claim",
    "  return coalesce(\n    nullif(claims ->> 'tenant_id', ''),   -- explicit, and it wins\n    nullif(claims ->> 'sub', '')          -- otherwise the signed-in subject\n  );",
    "  return 't1';"),

  // ── DUPLICATE PREVENTION ──────────────────────────────────────────────────
  m("SQL/duplicates: a run may be started twice",
    "create unique index entries_one_started", "create index entries_one_started"),
  m("SQL/duplicates: a run may be finished twice",
    "create unique index entries_one_stopped", "create index entries_one_stopped"),
  m("SQL/duplicates: two model answers for one step",
    "create unique index entries_one_model_per_step", "create index entries_one_model_per_step"),
  m("SQL/duplicates: two results for one tool slot",
    "create unique index entries_one_tool_per_slot", "create index entries_one_tool_per_slot"),
  m("SQL/duplicates: the model-answer rule keys on the run and not the step",
    "on agent.run_entries (run_id, step) where kind = 'model';",
    "on agent.run_entries (run_id, step, seq) where kind = 'model';"),
  m("SQL/duplicates: a malformed entry can be stored",
    "  constraint entry_position_matches_kind check (", "  constraint entry_position_matches_kind check (true) and not ("),

  // ── JOURNAL IMMUTABILITY ──────────────────────────────────────────────────
  m("SQL/immutability: an entry can be edited after it was written",
    "  raise exception 'agent.run_entries is append-only: entry (run %, seq %) cannot be updated',\n    old.run_id, old.seq\n    using errcode = 'restrict_violation';",
    "  return new;"),
  m("SQL/immutability: the append-only trigger is never attached",
    "create trigger entries_append_only\n  before update on agent.run_entries",
    "create trigger entries_append_only\n  before truncate on agent.run_entries"),

  // ── WHOLE-RUN DELETION ────────────────────────────────────────────────────
  m("SQL/deletion: a lone entry can be deleted while its run remains",
    // `position` answers 0 or a positive index, never -1, so this guard can never
    // fire and every lone delete is allowed. `>= 0` would be the opposite mistake:
    // always refusing, which breaks retention and would die for the wrong reason.
    "              coalesce(nullif(current_setting('agent.deleting_run', true), ''), '')) = 0 then",
    "              coalesce(nullif(current_setting('agent.deleting_run', true), ''), '')) = -1 then"),
  m("SQL/deletion: the delete wall is never attached",
    "create trigger entries_only_with_their_run\n  before delete on agent.run_entries",
    "create trigger entries_only_with_their_run\n  before truncate on agent.run_entries"),
  // NO MUTANT FOR `set_config`'s is_local FLAG. Flipping it to session scope was
  // tried and SURVIVED, and was then proved INERT by measurement rather than
  // hunted: the marker still did not outlive the transaction, checked three ways
  // including re-creating a run under the same id in a later transaction of the
  // same session. The security of the wall rests on the marker NAMING THE RUN —
  // which has its own mutant below — not on the flag. See the migration's own note.
  m("SQL/deletion: the marker stops naming WHICH run, so one delete authorises another's entries",
    "  if position(old.run_id::text || ',' in", "  if position('' in"),
  m("SQL/deletion: the marker REPLACES instead of appending, breaking a multi-row delete",
    "    coalesce(nullif(current_setting('agent.deleting_run', true), ''), '') || old.id::text || ',',",
    "    old.id::text || ',',"),
  m("SQL/deletion: deleting a run leaves its log behind",
    "references agent.runs (id) on delete cascade", "references agent.runs (id) on delete no action"),
  m("SQL/deletion: the marker is set by nothing, so retention cannot work either",
    "create trigger runs_delete_marks\n  before delete on agent.runs",
    "create trigger runs_delete_marks\n  before truncate on agent.runs"),

  // ── THE DURABLE QUEUE: EXACTLY ONE EXECUTION ──────────────────────────────
  // The claim is a single conditional UPDATE and every one of these breaks one of
  // its conditions. They are the difference between "one run executes once" and
  // "a duplicate delivery pays for the same model calls twice".
  mClaim("SQL/queue: the claim stops being exclusive, so a duplicate delivery runs the same run",
    "     and (claimed_by is null or lease_expires_at <= now())",
    "     and (claimed_by is null or true)"),
  mClaim("SQL/queue: a lapsed lease is never reclaimable, so a dropped run is stranded for ever",
    "     and (claimed_by is null or lease_expires_at <= now())",
    "     and claimed_by is null"),
  mClaim("SQL/queue: finished work is claimable again",
    "   where run_id = p_run_id\n     and done_at is null\n     and (claimed_by is null",
    "   where run_id = p_run_id\n     and (claimed_by is null"),
  mClaim("SQL/queue: the claim no longer answers whose run it is, so a consumer must trust the message",
    "    'tenant_id', v_row.tenant_id,", "    'tenant_id', null,"),
  mClaim("SQL/queue: the claim stops counting attempts, so a run that keeps failing never gives up",
    "         attempts = attempts + 1", "         attempts = attempts"),
  mClaim("SQL/queue: THE CLAIM DOES NOT ANSWER ITS TOKEN, so no holder can ever write",
    "    'claim_token', v_row.claim_token,", "    'claim_token', null,"),
  mClaim("SQL/queue: A RECLAIM REUSES THE PREVIOUS CLAIM'S TOKEN, so a displaced worker keeps writing",
    "         claim_token = gen_random_uuid(),", "         claim_token = coalesce(claim_token, gen_random_uuid()),"),

  // ── THE LEASE ─────────────────────────────────────────────────────────────
  mBeat("SQL/queue: A LAPSED LEASE CAN BE REVIVED, so two workers run one run",
    "     and done_at is null\n     and lease_expires_at > now()\n  returning true into v_ok;",
    "     and done_at is null\n  returning true into v_ok;"),
  mBeat("SQL/queue: anybody may extend anybody's lease",
    "     and claimed_by = p_worker\n     and claim_token = p_token\n     and done_at is null",
    "     and done_at is null"),
  mBeat("SQL/queue: THE BEAT IGNORES THE TOKEN, so a replaced claim keeps its lease alive",
    "     and claim_token = p_token\n     and done_at is null", "     and done_at is null"),
  mBeat("SQL/queue: a beat with no token at all is accepted",
    "  if p_token is null then\n    raise exception 'beat_run: the claim token is required';\n  end if;",
    "  -- no token needed"),
  mRelease("SQL/queue: a worker that lost its lease may still release somebody else's claim",
    "   where run_id = p_run_id\n     and claimed_by = p_worker\n     and claim_token = p_token\n     and lease_expires_at > now()",
    "   where run_id = p_run_id"),
  mRelease("SQL/queue: A LAPSED HOLDER MAY STILL END THE RUN, mid-flight",
    "     and claim_token = p_token\n     and lease_expires_at > now()\n  returning true into v_ok;",
    "     and claim_token = p_token\n  returning true into v_ok;"),
  mRelease("SQL/queue: a released row keeps its token, so the dead holder can write again",
    "         claim_token = null,\n         done_at = case when p_done then now()",
    "         done_at = case when p_done then now()"),
  mRelease("SQL/queue: releasing always marks the work done, so a retryable failure is never retried",
    "         done_at = case when p_done then now() else null end,", "         done_at = now(),"),
  mWork("SQL/queue: the sweeper selects on ELAPSED TIME, so a long healthy run is taken away",
    "   where done_at is null\n     and (claimed_by is null or lease_expires_at <= now() - make_interval(secs => p_grace_s))",
    "   where done_at is null\n     and enqueued_at <= now() - make_interval(secs => p_grace_s)"),
  mWork("SQL/queue: the sweeper offers finished work too",
    "   where done_at is null\n     and (claimed_by is null or lease_expires_at <= now()",
    "   where true\n     and (claimed_by is null or lease_expires_at <= now()"),

  // ── ACCEPTING WORK ────────────────────────────────────────────────────────
  mAccept("SQL/queue: A RETRY CAN ATTACH TO ANOTHER TENANT'S RUN ID",
    "  if not exists (select 1 from agent.runs where id = p_run_id and tenant_id = p_tenant) then",
    "  if not exists (select 1 from agent.runs where id = p_run_id) then"),
  mAccept("SQL/queue: accept stops writing the first entry, so the prompt is not durable",
    "  insert into agent.run_entries (run_id, seq, body) values (p_run_id, 0, p_entry)\n  on conflict do nothing;",
    "  -- no entry written"),
  mAccept("SQL/queue: accept stops writing the work row, so nothing will ever run it",
    "  insert into agent.run_work (run_id, tenant_id, kind)\n  values (p_run_id, p_tenant, p_kind)\n  on conflict (run_id) do nothing\n  returning * into v_existing;",
    "  select * into v_existing from agent.run_work where run_id = p_run_id;"),
  mAccept("SQL/queue: any entry may be the first one, so a run can start mid-log",
    "  if p_entry is null or p_entry ->> 'kind' is distinct from 'started' then",
    "  if false then"),

  // ── ASKING AGAIN ──────────────────────────────────────────────────────────
  mWork("SQL/queue: A RESUME MID-RUN BECOMES A SECOND DELIVERY",
    "  if v_row.claimed_by is not null and v_row.lease_expires_at > now() then\n    return jsonb_build_object('state', 'running', 'attempts', v_row.attempts);\n  end if;",
    "  if false then\n    return jsonb_build_object('state', 'running', 'attempts', v_row.attempts);\n  end if;"),
  mWork("SQL/queue: a resume can reach another tenant's run",
    "   where run_id = p_run_id and tenant_id = p_tenant\n     for update;",
    "   where run_id = p_run_id\n     for update;"),
  mWork("SQL/queue: a resume does not put the work back",
    "     set kind = 'resume', done_at = null, enqueued_at = now(), last_error = null,",
    "     set kind = 'resume', enqueued_at = now(), last_error = null,"),

  // ── WHO MAY TOUCH THE QUEUE ───────────────────────────────────────────────
  mWork("SQL/queue: a signed-in customer is granted the queue",
    "grant select, insert, update, delete on agent.run_work to service_role;",
    "grant select, insert, update, delete on agent.run_work to service_role, authenticated;"),
  // NOT "a customer may call the claim function" ON ITS OWN: that mutant SURVIVED
  // and was proved INERT by measurement rather than hunted. Widening the EXECUTE
  // grant alone changes nothing a customer can do, because the function is SECURITY
  // INVOKER and the UPDATE inside it then meets the TABLE grant — and with that
  // widened too it meets forced RLS with no policies, which matches no rows. Three
  // walls, so no single one of them can be killed, which is exactly the recorded
  // "two redundant defences cannot be killed one at a time".
  //
  // What IS testable is the pair coming down together. MEASURED: with the function
  // grant widened, the table granted and RLS off, a customer's claim comes back
  // `claimed: true` — it really takes the work.
  mWork("SQL/queue: ALL THREE WALLS DOWN — a customer really can claim another tenant's work",
    "alter table agent.run_work enable row level security;\nalter table agent.run_work force row level security;\n\nrevoke all on agent.run_work from anon, authenticated;\ngrant select, insert, update, delete on agent.run_work to service_role;",
    "revoke all on agent.run_work from anon;\ngrant select, insert, update, delete on agent.run_work to service_role, authenticated;\ngrant execute on function agent.claim_run(uuid, text, integer) to authenticated;"),
  mWork("SQL/queue: the work row outlives its run",
    "  run_id            uuid primary key references agent.runs(id) on delete cascade,",
    "  run_id            uuid primary key references agent.runs(id) on delete no action,"),

  // ── THE FENCE: a write must present the claim it is writing under ─────────
  // **EVERY ONE OF THESE IS THE MEASURED GAP COMING BACK.** The hole was that
  // ownership was answered from a flag in the consumer's own process; each mutant
  // below removes one of the four things the database now checks at write time, or
  // one of the two readings that keep a retry apart from a second writer.
  mAppend("SQL/fence: THE WORK ROW IS NOT LOCKED, so a reclaim fits between the check and the write",
    "  select * into v_work from agent.run_work where run_id = p_run_id for update;",
    "  select * into v_work from agent.run_work where run_id = p_run_id;"),
  mAppend("SQL/fence: THE HOLDER IS NOT CHECKED — anybody may write to anybody's run",
    "  if v_work.claimed_by is null or v_work.claimed_by is distinct from p_worker then\n    return jsonb_build_object('ok', false, 'why', 'not-holder');\n  end if;",
    "  -- no holder check"),
  mAppend("SQL/fence: THE TOKEN IS NOT CHECKED, so a displaced worker sharing a name writes on",
    "  if v_work.claim_token is null or v_work.claim_token is distinct from p_token then\n    return jsonb_build_object('ok', false, 'why', 'bad-token');\n  end if;",
    "  -- no token check"),
  mAppend("SQL/fence: THE LEASE IS NOT CHECKED, so a paused holder writes for as long as it likes",
    "  if v_work.lease_expires_at is null or v_work.lease_expires_at <= now() then\n    return jsonb_build_object('ok', false, 'why', 'lease-expired');\n  end if;",
    "  -- no lease check"),
  mAppend("SQL/fence: FINISHED WORK STILL TAKES WRITES",
    "  if v_work.done_at is not null then\n    return jsonb_build_object('ok', false, 'why', 'finished');\n  end if;",
    "  -- finished work is writable"),
  mAppend("SQL/fence: a run with no work row is written to anyway",
    "  if v_work.run_id is null then\n    return jsonb_build_object('ok', false, 'why', 'no-work');\n  end if;",
    "  -- no work row needed"),
  mAppend("SQL/fence: A DIFFERENT ENTRY IN THE SAME SLOT IS READ AS A DUPLICATE",
    "    if v_body = p_body then\n      return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', v_seq);\n    end if;\n    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', v_seq);",
    "    return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', v_seq);"),
  mAppend("SQL/fence: AN IDENTICAL RETRY IS READ AS A CONFLICT, so a lost answer kills a paid-for run",
    "    if v_body = p_body then", "    if false then"),
  // **THE ANCHOR CARRIES THE `conflict` LINE AFTER IT, and that is not tidiness.**
  // The `already` answer occurs TWICE — once in the main path and once in the
  // unique-violation handler, which is a deliberate redundancy — so the shorter
  // anchor was AMBIGUOUS and the pre-check refused it. Naming the neighbour is what
  // makes it the main path's.
  mAppend("SQL/fence: the `already` answer does not say where the entry really is",
    "return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', v_seq);\n    end if;\n    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', v_seq);",
    "return jsonb_build_object('ok', true, 'stored', false, 'already', true, 'seq', null);\n    end if;\n    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', v_seq);"),
  // **THE LEADING NEWLINE PINS THE INDENT, and without it this anchor is a SUBSTRING
  // of the handler's own copy** (six spaces contains four) — the recorded "a mutant
  // whose anchor is a substring of another's", arriving through indentation.
  mAppend("SQL/fence: a taken position is reported as a conflict, so the caller stops instead of moving up",
    "\n    return jsonb_build_object('ok', false, 'why', 'position', 'seq', p_seq);",
    "\n    return jsonb_build_object('ok', false, 'why', 'conflict', 'seq', p_seq);"),
  mAppend("SQL/fence: an empty or blank worker is accepted",
    "  if p_worker is null or btrim(p_worker) = '' then\n    raise exception 'append_entry: worker must be a non-empty string';\n  end if;",
    "  -- any worker will do"),
  mAppend("SQL/fence: A NULL TOKEN IS READ AS NOT NEEDING ONE",
    "  if p_token is null then\n    raise exception 'append_entry: the claim token is required';\n  end if;",
    "  -- no token needed"),
  mAppend("SQL/fence: THE SERVICE ROLE KEEPS ITS DIRECT INSERT, so the fence can be walked around",
    "revoke insert on agent.run_entries from service_role;", "-- the direct door stays open"),
  mAppend("SQL/fence: the fence is granted to signed-in customers",
    "grant execute on function agent.append_entry(uuid, integer, jsonb, text, uuid) to service_role;",
    "grant execute on function agent.append_entry(uuid, integer, jsonb, text, uuid) to service_role, authenticated;"),
  mAppend("SQL/fence: a claimed row may exist with no token",
    "  or (claimed_by is not null and claimed_at is not null and lease_expires_at is not null and claim_token is not null)",
    "  or (claimed_by is not null and claimed_at is not null and lease_expires_at is not null)"),
  mAppend("SQL/fence/CONTROL (comment only)", "-- FENCING THE JOURNAL:", "-- FENCING THE JOURNAL (control):", true),

  // ── SENDING A MESSAGE STARTS A RUN ────────────────────────────────────────
  //
  // The guarantees the notes make loudest about it: one press is one message and one
  // run, the run's shape is the server's, the snapshot is read in the transaction, and
  // the answer is read from the run because a message row cannot hold one.
  mSend("SQL/send: THE KEY IS NOT REQUIRED, so an unkeyed send inserts every time",
    "  if v_key is null then\n    raise exception 'send_to_agent: a send needs its own key, or a retry cannot be told from a new message';\n  end if;",
    "  -- an unkeyed send is fine"),
  // ⚠ NOT `on conflict do nothing` (bare) — MEASURED INERT, on two throwaway
  // databases built from these same migrations. A bare clause still absorbs the
  // send-key conflict, so a duplicate press answers `repeat: true` with one
  // message and one run either way; the ONLY observable difference is which
  // refusal a REUSED MESSAGE ID gets (`agent_messages_pkey` as written, the
  // function's own "conflicted with a row that is not there" bare) and both
  // refuse having written nothing. So the clause is DELETED instead, which
  // attacks the guarantee itself: a retry then RAISES where it must answer.
  //
  // (That "row that is not there" branch is reachable rather than paranoid —
  // under READ COMMITTED a racing press can have its insert skipped by a row
  // that is not committed yet and is therefore invisible to the select below.)
  mSend("SQL/send: the duplicate is not absorbed, so a retry is refused instead of answered",
    "    on conflict (agent_id, send_key) where send_key is not null\n    do nothing\n    returning * into v_msg;",
    "    returning * into v_msg;"),
  mSend("SQL/send: AN ABSORBED PRESS STARTS A SECOND RUN ANYWAY",
    "    return jsonb_build_object(\n      'ok', true, 'repeat', true,",
    "    v_msg.id := v_msg.id; return jsonb_build_object(\n      'ok', true, 'repeat', false,"),
  mSend("SQL/send: the ownership check is dropped, so any tenant may write to any agent",
    "  select * into v_agent from agent.agents\n   where id = p_agent_id and tenant_id = p_tenant;",
    "  select * into v_agent from agent.agents\n   where id = p_agent_id;"),
  mSend("SQL/send: a missing agent is a raise rather than a named answer",
    "    return jsonb_build_object('ok', false, 'error', 'no-agent');",
    "    raise exception 'send_to_agent: no such agent';"),
  mSend("SQL/send: the instructions come from nowhere, so a run is started without them",
    "    'instructions', v_agent.instructions,", "    'instructions', null,"),
  mSend("SQL/send: THE HISTORY IS OLDEST-FIRST, so a long conversation is pinned to its first screen",
    "       order by m.seq desc\n       limit agent.history_turns()", "       order by m.seq asc\n       limit agent.history_turns()"),
  mSend("SQL/send: the new message is given to the run as history as well as a prompt",
    "         and m.id <> v_msg.id", "         and true"),
  mSend("SQL/send: a turn whose run never answered is dropped along with its question",
    "        left join agent.runs r on r.id = m.run_id", "        join agent.runs r on r.id = m.run_id"),
  mSend("SQL/send: an unfinished run's text is handed over as though it were an answer",
    "             case when r.stop ->> 'reason' = 'answered' then r.stop ->> 'text' end as answer",
    "             r.stop ->> 'text' as answer"),
  // The two lines the 2026-09-16 review added, each attacked where it decides something.
  mSend("SQL/send: AN ABSORBED PRESS NEVER SAYS ITS WORDS DIFFER, so an edited retry is lost silently",
    "      'mismatch', (v_msg.body is distinct from p_body),",
    "      'mismatch', false,"),
  mSend("SQL/send: the mismatch is answered for every retry, so an ordinary one reads as an edit",
    "      'mismatch', (v_msg.body is distinct from p_body),",
    "      'mismatch', true,"),
  mSend("SQL/send: the message is not linked to the run it started",
    "  update agent.agent_messages set run_id = p_run_id where id = v_msg.id;", "  -- no link"),
  // ⚠ THIS WAS A NO-OP STATEMENT APPENDED AFTER THE ACCEPT — a mutant whose
  // label named a reorder and whose text added `perform 1;`, which changes
  // nothing and SURVIVED the sweep saying exactly that. The property is what the
  // absorb branch buys: skip it and a duplicate press runs straight past, mints a
  // second run under the new id and links it to nothing — the orphan the queue
  // would then execute. Expressible as one line, and observable.
  // RE-ANCHORED: the absorbed answer has ONE producer now, reached by `not v_new`,
  // so the branch to skip is that one rather than a second copy of it.
  mSend("SQL/send: THE ABSORB BRANCH IS SKIPPED, so a duplicate press mints a second run linked to nothing",
    "  if not v_new then\n    return jsonb_build_object(", "  if false then\n    return jsonb_build_object("),
  mSend("SQL/send: it is granted to signed-in customers, who could then start work as anybody",
    "grant execute on function agent.send_to_agent(text, uuid, uuid, text, text, uuid) to service_role;",
    "grant execute on function agent.send_to_agent(text, uuid, uuid, text, text, uuid) to service_role, authenticated;"),
  // RE-ANCHORED, NOT APPEASED. This spanned the next line to be unambiguous, and the
  // `mismatch` line landed between them — caught by the generator's census before the
  // run, which is the whole reason that census exists. It reaches BACKWARD now, to the
  // comment above the field, so a line added below it cannot break it again.
  mSend("SQL/send: the answer echoes what was sent rather than what is stored",
    "      -- for and absorbed.\n      'body', v_msg.body,", "      -- for and absorbed.\n      'body', p_body,"),
  // RE-ANCHORED ONTO THE BOUNDS AS THEY ARE: `toolCalls` moved from 1 to 2 the day a
  // tool became reachable, measured — a budget of one is one already spent.
  mAuthored("SQL/send: the run's bounds are widened",
    "      'steps', 3,\n      'toolCalls', 2,", "      'steps', 16,\n      'toolCalls', 64,"),
  mAuthored("SQL/send: THE TOOL BUDGET IS ZERO, which stops every authored run before its first call",
    "      'toolCalls', 2,\n      'parallelTools', 8,", "      'toolCalls', 0,\n      'parallelTools', 8,"),
  mThread("SQL/thread: the view is NOT security_invoker, so it is a hole through RLS on three tables",
    "create or replace view agent.agent_thread\n  with (security_invoker = true) as",
    "create or replace view agent.agent_thread as"),
  mThread("SQL/thread: a message with no run is dropped from the conversation",
    "from agent.agent_messages m\nleft join agent.runs r on r.id = m.run_id",
    "from agent.agent_messages m\njoin agent.runs r on r.id = m.run_id"),
  mThread("SQL/thread: the progress is a count of entries rather than the log's highest step",
    "  select max(e.step) as step from agent.run_entries e where e.run_id = m.run_id",
    "  select count(*)::int as step from agent.run_entries e where e.run_id = m.run_id"),
  mThread("SQL/thread: anon can read the conversation",
    "revoke all on agent.agent_thread from anon;", "grant select on agent.agent_thread to anon;"),
  mThread("SQL/link: a retained run takes the customer's writing with it",
    "alter table agent.agent_messages add column if not exists run_id uuid\n  references agent.runs (id) on delete set null;",
    "alter table agent.agent_messages add column if not exists run_id uuid\n  references agent.runs (id) on delete cascade;"),
  mThread("SQL/link: the send key is unique per TENANT rather than per conversation",
    "create unique index if not exists messages_one_send_per_agent\n  on agent.agent_messages (agent_id, send_key)\n  where send_key is not null;",
    "create unique index if not exists messages_one_send_per_agent\n  on agent.agent_messages (send_key)\n  where send_key is not null;"),
  // RE-ANCHORED: `send_to_agent` now lives in the settings migration, whose header is
  // its own. A control has to be a comment in the file the mutants really target.
  mSend("SQL/send/CONTROL (comment only)",
    "-- ── the one transaction, now with a status and a selection ───────────────────",
    "-- ── the one transaction, with a status and a selection ──────────────────────", true),


  // ── the settings: a status, a selection, and what a run may call ──────────
  //
  // The two columns are the first thing on this side a PERSON configures, and the
  // pause is the first refusal that is not about ownership. Every mutant here is an
  // edit somebody could really make: a default flipped, a check widened, a gate
  // moved, a key dropped out of the entry.
  mSettings("SQL/settings: a new agent defaults to PAUSED, stopping every conversation there is",
    "add column if not exists status text not null default 'active'",
    "add column if not exists status text not null default 'paused'"),
  mSettings("SQL/settings: the status column admits anything at all",
    "check (status in ('active', 'paused'));", "check (status is not null);"),
  mSettings("SQL/settings: the cap on a stored selection is lifted",
    "coalesce(array_length(tools, 1), 0) <= 32", "coalesce(array_length(tools, 1), 0) <= 3200"),
  mSettings("SQL/settings: a name outside the provider's grammar can be stored",
    "and array_to_string(tools, ',') ~ '^([a-zA-Z0-9_-]{1,64}(,[a-zA-Z0-9_-]{1,64})*)?$'",
    "and array_to_string(tools, ',') ~ '^(.{1,64}(,.{1,64})*)?$'"),
  mSettings("SQL/settings: a NULL among the tool names is stored rather than refused",
    "and array_position(tools, null) is null", "and true"),
  mSettings("SQL/settings: the list screen stops reading the status",
    "  last.body as last_message,\n  a.status,\n  a.tools",
    "  last.body as last_message,\n  null::text as status,\n  a.tools"),
  mSettings("⚠ SQL/send: a paused agent starts work anyway",
    "    if v_agent.status <> 'active' then", "    if false then"),
  mSettings("⚠ SQL/send: the pause is asked BEFORE the key, so a lost answer cannot be retried",
    "  select * into v_msg from agent.agent_messages\n   where agent_id = p_agent_id and send_key = v_key;\n\n  if v_msg.id is null then",
    "  select * into v_msg from agent.agent_messages\n   where agent_id = p_agent_id and send_key = v_key;\n\n  if true then"),
  mSettings("⚠ SQL/send: a racing twin's press is treated as a new message",
    "    v_new := v_msg.id is not null;", "    v_new := true;"),
  mSettings("SQL/send: the run is started with no selection whatever the agent holds",
    "    'tools',        to_jsonb(v_agent.tools),", "    'tools',        '[]'::jsonb,"),
  mSettings("SQL/send: the selection never reaches the run's own record",
    "    'tools',        to_jsonb(v_agent.tools),\n", ""),
  mSettings("SQL/settings: the tool budget goes back to one, which lets a run start and not finish",
    "      'steps', 3,\n      'toolCalls', 2,", "      'steps', 3,\n      'toolCalls', 1,"),
  mSettings("SQL/settings/CONTROL (comment only)",
    "-- AGENT SETTINGS: A STATUS, AND A SELECTION OF TOOLS.",
    "-- Agent settings: a status, and a selection of tools.", true),

  // ── automations: once per occurrence, and what a refusal leaves behind ────
  //
  // Every one of these is an edit somebody could really make while tidying: a
  // `unique` dropped, a deferral removed, a gate turned off, a window widened, an
  // advance forgotten. Not one is a syntax error — a migration that will not apply
  // proves nothing.
  mAuto("⚠ SQL/automations: the once-per-occurrence index stops being unique",
    "create unique index if not exists automation_runs_one_per_occurrence",
    "create index if not exists automation_runs_one_per_occurrence"),
  mAuto("⚠ SQL/automations: the execution's FK stops being DEFERRED, so no accept can probe first",
    "                            deferrable initially deferred,", "                            ,"),
  mAuto("SQL/automations: a schedule need not be whole",
    "  constraint automations_schedule_is_whole check (\n    (schedule = 'manual' and at_local is null and next_run_at is null)",
    "  constraint automations_schedule_is_whole check (\n    true or (schedule = 'manual' and at_local is null and next_run_at is null)"),
  mAuto("SQL/automations: a stored time need not be whole minutes",
    "    at_local is null or (date_part('second', at_local) = 0", "    true or (date_part('second', at_local) = 0"),
  mAuto("SQL/automations: the workflow cap on the column is lifted",
    "jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 20",
    "jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 2000"),
  mAuto("SQL/automations: an execution's occurrence need not match its trigger",
    "    (trigger = 'manual'   and occurrence is null)", "    true or (trigger = 'manual'   and occurrence is null)"),
  mAuto("SQL/automations: the executor column admits an executor nothing can run",
    "add constraint run_work_executor_known check (executor in ('agent', 'automation'));",
    "add constraint run_work_executor_known check (executor is not null);"),

  mAuto("⚠ SQL/accept: a DISABLED automation starts work anyway",
    "    if not v_enabled then", "    if false then"),
  mAuto("⚠ SQL/accept: a PAUSED agent's automations start work anyway",
    "    if v_status is distinct from 'active' then", "    if false then"),
  mAuto("⚠ SQL/accept: the tenant leaves the lookup, so a stranger can start it",
    "   where a.id = p_automation_id and a.tenant_id = p_tenant;",
    "   where a.id = p_automation_id;"),
  mAuto("⚠ SQL/accept: the work row is never told which executor wants it",
    "  update agent.run_work set executor = 'automation' where run_id = p_run_id;",
    "  perform 1;"),
  mAuto("⚠ SQL/accept: a duplicate occurrence is treated as a new execution",
    "    v_new := v_exec.id is not null;", "    v_new := true;"),
  mAuto("⚠ SQL/accept: the execution is filed with no configuration, so an edit reaches it",
    "      (p_run_id, p_automation_id, p_tenant, p_trigger, p_occurrence, v_steps, v_zone)",
    "      (p_run_id, p_automation_id, p_tenant, p_trigger, p_occurrence, '[]'::jsonb, v_zone)"),

  mAuto("⚠ SQL/tick: the catch-up window becomes unbounded, so downtime IS a burst",
    "           <= make_interval(secs => greatest(0, coalesce(p_catchup_s, 3600))) then",
    "           <= make_interval(secs => 3650 * 86400) then"),
  mAuto("⚠ SQL/tick: the schedule is never advanced, so the same day is filed for ever",
    "      update agent.automations set next_run_at = v_next where id = r.id;",
    "      perform 1;"),
  mAuto("SQL/tick: a week of missed occurrences is counted as one",
    "        v_total := greatest(1, (v_next at time zone r.zone)::date - v_occ);",
    "        v_total := 1;"),
  mAuto("SQL/record: an occurrence recorded unrun is left unfinished, so no history shows it",
    "     p_missed, now())", "     p_missed, null)"),

  mAuto("⚠ SQL/finish: the outcomes are written even when the fence refused",
    "  if coalesce((v_answer -> 'ok')::boolean, false) is not true then\n    return v_answer;\n  end if;\n\n  -- `finished_at is null` IS WHAT MAKES A RETRY KEEP THE FIRST WRITER'S OUTCOMES.",
    "  if false then\n    return v_answer;\n  end if;\n\n  -- `finished_at is null` IS WHAT MAKES A RETRY KEEP THE FIRST WRITER'S OUTCOMES."),
  mAuto("⚠ SQL/finish: the work is never released, so it is claimed again for ever",
    "  perform agent.release_run(p_run_id, p_worker, p_token, true, null);", "  perform 1;"),

  mAuto("⚠ SQL/automations: the history view runs as its OWNER, past both policies",
    "  with (security_invoker = true)", "  with (security_invoker = false)"),
  mAuto("⚠ SQL/automations: an account reads every account's automations",
    "create policy automations_own_tenant on agent.automations\n  for all\n  using (tenant_id = agent.tenant_id())",
    "create policy automations_own_tenant on agent.automations\n  for all\n  using (true)"),
  mAuto("⚠ SQL/automations: an account may write its own execution history",
    "grant select on agent.automations, agent.automation_runs, agent.automation_history\n  to authenticated, service_role;",
    "grant select, insert, update, delete on agent.automations, agent.automation_runs, agent.automation_history\n  to authenticated, service_role;"),

  mAuto("⚠ SQL/schedule: the local time is read in UTC, so daylight saving moves it",
    "  v_cand  := (v_today + p_at_local) at time zone p_zone;",
    "  v_cand  := (v_today + p_at_local) at time zone 'UTC';"),
  mAuto("SQL/automations/CONTROL (comment only)",
    "-- ⚠ **THE ONCE-PER-OCCURRENCE GUARANTEE, IN THE DATABASE.**",
    "-- The once-per-occurrence guarantee, in the database.", true),

  // ── THE CONTROL: comment-only, and it MUST survive ────────────────────────
  m("SQL/CONTROL (comment only)", "-- ============================================================================\n-- AGENT RUNS:",
    "-- ============================================================================\n-- AGENT RUNS (control):", true),
  mWork("SQL/queue/CONTROL (comment only)", "-- THE DURABLE QUEUE.", "-- THE DURABLE QUEUE (control).", true),
];

// THE PRE-CHECK. Every anchor exactly once IN ITS OWN FILE, and a replacement that
// differs. Reading one file for every mutant is how two correct anchors were
// reported as missing: the tenant and queue mutants target their own migrations,
// not the first.
let bad = 0;
const text = new Map();
for (const s of spec) {
  const f = s.files[0];
  if (!text.has(f)) text.set(f, fs.readFileSync(f, "utf8"));
  const n = text.get(f).split(s.from).length - 1;
  if (n !== 1) { console.error(`ANCHOR ${n === 0 ? "NOT FOUND" : `AMBIGUOUS (${n})`}: ${s.label}`); bad++; }
  if (s.from === s.to) { console.error(`REPLACEMENT IS THE ANCHOR: ${s.label}`); bad++; }
}
if (bad) { console.error(`\n${bad} anchor problems — spec NOT written.`); process.exit(1); }
fs.writeFileSync(process.argv[2], JSON.stringify(spec, null, 1));
console.log(`${spec.length} SQL mutants (${spec.filter((s) => s.control).length} control), every anchor unique.`);
