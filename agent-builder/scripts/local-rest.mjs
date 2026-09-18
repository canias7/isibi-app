/**
 * A POSTGREST-SHAPED FRONT DOOR ON A LOCAL POSTGRESQL. Development only.
 *
 * **WHY THIS EXISTS, STATED PLAINLY.** The whole pipe — the Worker's real handler,
 * the real auth, the real queue, the real journal — can only be driven end to end
 * against a database it can WRITE to, and writing to the hosted project needs a
 * service credential. This shim lets the same code run against a real PostgreSQL
 * with the real migrations applied, so the triggers, the generated columns, the
 * partial unique indexes and the claim's conditional UPDATE are all the genuine
 * article and only the HTTP translation is local.
 *
 * **WHAT IT IS NOT: it is not Supabase, and nothing here should be read as proving
 * the hosted deployment works.** It speaks the subset of PostgREST that `store.mjs`
 * and `work.mjs` actually use, and it is deliberately narrow so that it cannot
 * quietly become more capable than the real thing — the one fixture failure this
 * project has already paid for once.
 *
 * NEVER DEPLOY THIS. It holds no authentication of its own: it is reachable only on
 * localhost and it assumes every caller is the backend, exactly as PostgREST does
 * once a service key has been accepted.
 */

import { execFile } from "node:child_process";
import http from "node:http";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * How long one statement may take before the shim calls it wedged. Generous on purpose: a
 * real statement here runs in milliseconds, so this only ever bites something that is stuck,
 * and a bound tight enough to catch a slow query would report a working database as broken.
 */
export const SQL_TIMEOUT_MS = 30_000;

/** A SQL string literal. Doubling the quote is the whole of it. */
const lit = (v) => `'${String(v).replaceAll("'", "''")}'`;
/**
 * A `text[]` literal, built from its elements rather than from a joined string.
 *
 * `array[...]` with each element quoted, so a name carrying a quote or a comma
 * cannot become two elements — the shape `'{a,b}'::text[]` gets wrong. An absent or
 * unreadable list is an EMPTY array, never a null: the column is `not null` and the
 * product's own reader treats a selection it cannot read as none.
 */
const arr = (v) => (Array.isArray(v) && v.length
  ? `array[${v.map((x) => lit(x)).join(", ")}]::text[]`
  : `'{}'::text[]`);
/** A SQL string literal for a shell argument, since psql is reached through `su`. */
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** The columns `store.mjs` is allowed to ask for, so a `select=` cannot be injected. */
const RUN_COLUMNS = new Set(["id", "tenant_id", "status", "agent_name", "model", "limits", "stop", "created_at", "stopped_at"]);
const ENTRY_COLUMNS = new Set(["seq", "body", "run_id", "kind", "step", "idx", "at"]);
/**
 * The queue's own columns, readable and (for the lease) writable.
 *
 * **ONLY THE LEASE FIELDS MAY BE WRITTEN, and that is not a convenience.** The
 * verification needs to revoke a lease — that is what "a consumer was interrupted"
 * looks like from outside — and it must not be able to reach `done_at` or
 * `tenant_id`, because a shim that can rewrite the work's identity is a shim that can
 * make a verification pass for the wrong reason.
 */
const WORK_COLUMNS = new Set(["run_id", "tenant_id", "kind", "enqueued_at", "attempts",
  "claimed_by", "claimed_at", "lease_expires_at", "claim_token", "done_at", "last_error"]);
const WORK_WRITABLE = new Set(["lease_expires_at"]);

/** Every RPC, with how its answer comes back. A name not here is a 404. */
const RPCS = {
  accept_run: { args: ["p_run_id::uuid", "p_tenant", "p_entry::jsonb", "p_kind"], shape: "value" },
  requeue_run: { args: ["p_run_id::uuid", "p_tenant"], shape: "value" },
  claim_run: { args: ["p_run_id::uuid", "p_worker", "p_ttl_s::integer"], shape: "value" },
  beat_run: { args: ["p_run_id::uuid", "p_worker", "p_token::uuid", "p_ttl_s::integer"], shape: "value" },
  release_run: { args: ["p_run_id::uuid", "p_worker", "p_token::uuid", "p_done::boolean", "p_error"], shape: "value" },
  sweep_run_work: { args: ["p_grace_s::integer", "p_limit::integer"], shape: "set" },
  // THE FENCE. It is an RPC like the others here, which is the point: the shim
  // translates HTTP and the guarantee is the function's.
  append_entry: { args: ["p_run_id::uuid", "p_seq::integer", "p_body::jsonb", "p_worker", "p_token::uuid"], shape: "value" },
  // THE SEND. The site builder's `agent-store.mjs` reaches this, which is what makes
  // the whole flow — a typed message, a queued run, an answer read back — drivable
  // against a real PostgreSQL. Six arguments and not one of them is structured, so
  // there is nothing here for a caller to hand over but ids and words.
  send_to_agent: { args: ["p_tenant", "p_agent_id::uuid", "p_message_id::uuid", "p_body", "p_send_key", "p_run_id::uuid"], shape: "value" },
  // ── automations ───────────────────────────────────────────────────────────
  // THE SAME TRANSLATION AND THE SAME GUARANTEES: these are the product's own
  // functions, called as they are called in production, so what is local here is the
  // HTTP hop and nothing else. `tick_automations` answers a SET, like the sweeper.
  // ⚠ THE THREE TRIGGER PARAMETERS ARE HERE BECAUSE THE FUNCTIONS TAKE THEM, and a shim
  // whose list is short is one that drops what a caller really sent — which is how this
  // shim once hid a dropped `status`. A weekly schedule with no `p_days` is refused by the
  // database's own `automations_schedule_is_whole`, so leaving them out reports the SITE as
  // broken for a fault of the fixture's.
  create_automation: { args: ["p_tenant", "p_agent_id::uuid", "p_id::uuid", "p_name", "p_enabled::boolean", "p_schedule", "p_at_local::time", "p_zone", "p_steps::jsonb", "p_max::integer", "p_inputs::jsonb", "p_days::text[]", "p_on_date::date", "p_on_event"], shape: "value" },
  update_automation: { args: ["p_tenant", "p_id::uuid", "p_name", "p_enabled::boolean", "p_schedule", "p_at_local::time", "p_zone", "p_steps::jsonb", "p_inputs::jsonb", "p_days::text[]", "p_on_date::date", "p_on_event"], shape: "value" },
  // ⚠ THE PATCH IS A SEPARATE DOOR FROM THE REPLACE, and the shim says so by serving both.
  // `update_automation` is what the screen's form does (it shows every field and sends every
  // field); this is what a TOOL does (a model names the one thing it was asked to change).
  patch_automation: { args: ["p_tenant", "p_id::uuid", "p_patch::jsonb", "p_expect_version::integer"], shape: "value" },
  // The zone a schedule is written in, read and never written by the authoring path.
  read_agent_settings: { args: ["p_tenant", "p_agent_id::uuid"], shape: "value" },
  accept_automation_run: { args: ["p_tenant", "p_automation_id::uuid", "p_run_id::uuid", "p_trigger", "p_occurrence::date", "p_input::jsonb", "p_event_id::uuid", "p_event_depth::integer"], shape: "value" },
  finish_automation_run: { args: ["p_run_id::uuid", "p_worker", "p_token::uuid", "p_outcomes::jsonb", "p_stop::jsonb", "p_position::integer", "p_vars::jsonb"], shape: "value" },
  tick_automations: { args: ["p_catchup_s::integer", "p_limit::integer"], shape: "set" },
  // ── triggers: inbound deliveries and internal events ──────────────────────
  // **THE SECRET IS THE ROW'S AND `webhook_for_delivery` IS THE ONE FUNCTION THAT ANSWERS
  // IT**, which is why it is here rather than being read off the table: the shim serves the
  // real function, so what the engine gets locally is what it gets in production. It takes
  // no tenant, because the account is what a delivery ANSWERS.
  webhook_for_delivery: { args: ["p_id::uuid"], shape: "value" },
  list_webhooks: { args: ["p_tenant", "p_agent_id::uuid"], shape: "value" },
  create_webhook: { args: ["p_tenant", "p_agent_id::uuid", "p_id::uuid", "p_name", "p_event", "p_secret", "p_max::integer"], shape: "value" },
  set_webhook_enabled: { args: ["p_tenant", "p_id::uuid", "p_enabled::boolean"], shape: "value" },
  delete_webhook: { args: ["p_tenant", "p_id::uuid"], shape: "value" },
  // THE DEPTH IS NOT IN THIS LIST AS A CALLER'S ARGUMENT BY ACCIDENT: `p_max_depth` is the
  // function's own default and nothing sends one, so the ceiling cannot be reset from
  // outside. `p_from_run` is what the depth is really taken from.
  emit_event: { args: ["p_tenant", "p_agent_id::uuid", "p_id::uuid", "p_name", "p_payload::jsonb", "p_source", "p_key", "p_from_run::uuid"], shape: "value" },
  dispatch_events: { args: ["p_limit::integer"], shape: "set" },
  hear_pending_event: { args: ["p_run_id::uuid", "p_tenant"], shape: "value" },
  // ── richer workflows, reference material and memory ───────────────────────
  // THE SAME TRANSLATION AGAIN. `advance_automation_run` is the one worth naming: it
  // reaches `append_entry` inside its own transaction, so driving it through this shim
  // exercises the real fence rather than a stand-in for it.
  advance_automation_run: { args: ["p_run_id::uuid", "p_worker", "p_token::uuid", "p_entry::jsonb", "p_position::integer", "p_vars::jsonb", "p_outcomes::jsonb", "p_waiting::jsonb", "p_loops::jsonb", "p_tries::jsonb"], shape: "value" },
  // ── subworkflows: what a parent may copy in, and where the flat plan is kept ──
  // **NEITHER IS A SHIM DECISION.** The scope is `automation_children`'s own query and the
  // fence is `set_automation_plan`'s own, so a runner that expanded somebody else's
  // workflow, or wrote a plan it had no claim on, is refused HERE by the real function.
  automation_children: { args: ["p_tenant", "p_agent_id::uuid"], shape: "value" },
  set_automation_plan: { args: ["p_run_id::uuid", "p_worker", "p_token::uuid", "p_steps::jsonb", "p_uses::jsonb"], shape: "value" },
  decide_automation_approval: { args: ["p_tenant", "p_run_id::uuid", "p_step", "p_verdict", "p_note", "p_by"], shape: "value" },
  resume_due_automations: { args: ["p_limit::integer"], shape: "set" },
  search_knowledge: { args: ["p_tenant", "p_agent_id::uuid", "p_query", "p_limit::integer"], shape: "set" },
  agent_memory_snapshot: { args: ["p_tenant", "p_agent_id::uuid"], shape: "value" },
  // ── what an agent's own tools reach ───────────────────────────────────────
  // THE SAME FUNCTIONS THE CUSTOMER'S SCREEN CALLS, which is the whole point of the
  // capability layer: there is no second implementation for a tool to drift from, so
  // driving a tool through this shim exercises exactly what a person pressing the
  // button exercises.
  owns_agent: { args: ["p_tenant", "p_agent_id::uuid"], shape: "value" },
  // ── a tool call a person has to say yes to ────────────────────────────────
  // BOTH SIDES OF ONE DECISION, and they are reached by different callers on purpose:
  // the ENGINE asks (`request_tool_approval`, from the run loop) and the SITE answers
  // (`decide_tool_approval`, from a route behind a verified session). Driving both
  // through this shim is what makes "the run stops, a person presses, the run carries
  // on" a thing that really happened rather than a thing two fakes agreed about.
  request_tool_approval: { args: ["p_tenant", "p_run_id::uuid", "p_agent_id::uuid", "p_step::integer", "p_idx::integer", "p_tool", "p_args::jsonb", "p_hash", "p_id::uuid"], shape: "value" },
  decide_tool_approval: { args: ["p_tenant", "p_id::uuid", "p_verdict", "p_note", "p_by"], shape: "value" },
  pending_approvals: { args: ["p_tenant", "p_agent_id::uuid", "p_limit::integer"], shape: "set" },
  run_approvals: { args: ["p_tenant", "p_run_id::uuid"], shape: "set" },
  // ── expiry, revocation and cancellation ───────────────────────────────────
  // A permission taken away, an approval withdrawn, and a run stopped: three verbs the
  // SITE reaches (from a route behind a verified session) plus one the ENGINE reads on
  // every delivery. `revoked_tools` is set-returning and answers a bare list of strings.
  revoke_agent_tool: { args: ["p_tenant", "p_agent_id::uuid", "p_tool", "p_by", "p_note"], shape: "value" },
  restore_agent_tool: { args: ["p_tenant", "p_agent_id::uuid", "p_tool"], shape: "value" },
  revoked_tools: { args: ["p_tenant", "p_agent_id::uuid"], shape: "set" },
  revoke_tool_approval: { args: ["p_tenant", "p_id::uuid", "p_by", "p_note"], shape: "value" },
  cancel_run: { args: ["p_tenant", "p_run_id::uuid", "p_by", "p_reason"], shape: "value" },
  // ⚠ THE ONE SWEEP THAT IS NOT TENANT-SCOPED — see `approvals.mjs`. It is reached only
  // from `worker.scheduled`, and it is what ends a run nobody answered in time.
  requeue_expired_approvals: { args: ["p_limit::integer"], shape: "set" },
  list_knowledge: { args: ["p_tenant", "p_agent_id::uuid"], shape: "set" },
  read_knowledge: { args: ["p_tenant", "p_source_id::uuid"], shape: "value" },
  list_memory: { args: ["p_tenant", "p_agent_id::uuid"], shape: "set" },
  save_memory: { args: ["p_tenant", "p_agent_id::uuid", "p_key", "p_value", "p_id::uuid", "p_source", "p_max::integer"], shape: "value" },
  delete_memory: { args: ["p_tenant", "p_agent_id::uuid", "p_key"], shape: "value" },
  list_automations: { args: ["p_tenant", "p_agent_id::uuid"], shape: "set" },
  read_automation: { args: ["p_tenant", "p_id::uuid"], shape: "value" },
  set_automation_enabled: { args: ["p_tenant", "p_id::uuid", "p_enabled::boolean"], shape: "value" },
  list_executions: { args: ["p_tenant", "p_automation_id::uuid", "p_limit::integer"], shape: "set" },
  read_execution: { args: ["p_tenant", "p_id::uuid"], shape: "value" },
  // ── the operation record ──────────────────────────────────────────────────
  operation_check: { args: ["p_tenant", "p_op_key", "p_action", "p_args_hash"], shape: "value" },
  operation_record: { args: ["p_tenant", "p_op_key", "p_action", "p_args_hash", "p_run_id::uuid", "p_outcome::jsonb"], shape: "value" },
  // ⚠ THE IN-FLIGHT PAIR. `operation_begin` claims a slot with NO outcome and
  // `operation_settle` fills it in write-once, which is what makes "sent, outcome unknown" a
  // state a caller can reconcile from rather than a gap.
  operation_begin: { args: ["p_tenant", "p_op_key", "p_action", "p_args_hash", "p_run_id::uuid"], shape: "value" },
  operation_settle: { args: ["p_tenant", "p_op_key", "p_action", "p_args_hash", "p_outcome::jsonb"], shape: "value" },
  // ── connections to things outside ─────────────────────────────────────────
  //
  // ⚠ `lease_connection` IS THE ONE DOOR TO A CREDENTIAL and it is an RPC like the others,
  // which is the point: the shim translates HTTP and the guarantee is the function's.
  connect_provider: { args: ["p_tenant", "p_agent_id::uuid", "p_id::uuid", "p_provider", "p_label", "p_account", "p_scopes::text[]", "p_secret", "p_refresh", "p_expires::timestamptz", "p_max::integer"], shape: "value" },
  disconnect_connection: { args: ["p_tenant", "p_agent_id::uuid", "p_id::uuid", "p_why"], shape: "value" },
  revoke_connection: { args: ["p_tenant", "p_agent_id::uuid", "p_id::uuid", "p_why"], shape: "value" },
  lease_connection: { args: ["p_tenant", "p_agent_id::uuid", "p_id::uuid", "p_scopes::text[]"], shape: "value" },
  refresh_connection: { args: ["p_tenant", "p_agent_id::uuid", "p_id::uuid", "p_secret", "p_refresh", "p_expires::timestamptz"], shape: "value" },
};

/**
 * ⚠ THE `_once` WRAPPERS ARE DERIVED FROM THE SIX, NEVER TYPED AGAIN.
 *
 * Each takes `p_tenant` followed by its own four and then the plain function's remaining
 * parameters, in that order — so a parameter added to any of the six reaches its wrapper
 * here by construction. Eleven argument lists written out twice is how a shim comes to
 * serve a function the database no longer has, and this shim's whole value is that it is
 * not more forgiving than the real thing.
 */
const ONCE_OF = ["save_memory", "delete_memory", "set_automation_enabled",
  "accept_automation_run", "create_automation", "update_automation", "patch_automation",
  // ⚠ STOPPING ONE EXECUTION IS A WRITE AN AGENT MAY MAKE NOW, so it has a record like every
  // other. A person's press still goes through `cancel_run` itself, from the site's own route.
  "cancel_run"];
for (const name of ONCE_OF) {
  const inner = RPCS[name];
  if (!inner) throw new Error(`local-rest: ${name} is not served, so ${name}_once cannot be derived`);
  const [tenant, ...rest] = inner.args;
  if (tenant !== "p_tenant") throw new Error(`local-rest: ${name}'s first parameter is not p_tenant`);
  RPCS[`${name}_once`] = {
    args: ["p_tenant", "p_op_key", "p_args_hash", "p_op_run::uuid", ...rest],
    shape: "value",
  };
}

/**
 * The AUTHORED side's columns — the customer's own agents and conversations.
 *
 * A SEPARATE SET FROM THE RUNS', because they are a separate half of the schema and
 * reading one must never be able to name a column of the other.
 */
const AGENT_COLUMNS = new Set(["id", "tenant_id", "name", "instructions", "created_at", "updated_at",
  // ⚠ `zone` IS THE SETTING THE AUTHORING PATH READS AND A PERSON SETS. A shim that did not
  // serve it would refuse the settings form's own select and report the wiring as broken.
  "last_message", "status", "tools", "zone"]);
/**
 * ⚠ **`agent.connection_list`'s COLUMNS, AND NEITHER CREDENTIAL IS ON THE LIST — because the
 * VIEW does not have them.** A shim that passed a column list through would let a caller ask
 * for `secret` and get a 42703 that reads like the shim being narrow, when the real reason is
 * that the view protects it; naming the columns here makes the shim agree with the database
 * about what exists. `refreshable` is a generated column, which is exactly why a screen can
 * be told a refresh is possible without anybody reading the credential.
 */
const CONNECTION_COLUMNS = new Set(["id", "tenant_id", "agent_id", "provider", "label", "account",
  "scopes", "status", "refreshable", "expires_at", "stopped_why", "created_at", "updated_at"]);
const THREAD_COLUMNS = new Set(["id", "agent_id", "seq", "body", "created_at", "run_id",
  "run_status", "run_stop", "run_step", "run_model", "run_started_at", "run_stopped_at",
  // ⚠ THE TWO THAT TELL FIVE STATES APART. A shim that refuses a column the view really has
  // reports the product as broken, and one that ignores the list would hide a route asking
  // for a column that does not exist — which is why this is a SET and not a pass-through.
  "run_open_calls", "run_awaiting"]);

/** The automations' own columns, and their executions'. A third set, for a third half. */
const AUTOMATION_COLUMNS = new Set(["id", "agent_id", "tenant_id", "name", "enabled", "schedule",
  "at_local", "zone", "steps", "inputs", "version", "next_run_at", "created_at", "updated_at",
  // ⚠ **THE THREE TRIGGER COLUMNS WERE MISSING, and this set is the one place that can see
  // it.** `20260918050000_agent_triggers.sql` added `days`, `on_date` and `on_event` to the
  // table and nothing added them here — a latent gap rather than a live one, because every
  // reader of them today goes through `list_automations`, which is an RPC. The rule stands
  // whether or not anything is reading yet: *a shim LESS capable than the thing it stands in
  // for hides a defect exactly as well as one that is more*, and the day a check reads a
  // weekly schedule's days off the table it must not be refused by this list.
  "days", "on_date", "on_event"]);
const EXECUTION_COLUMNS = new Set(["id", "automation_id", "agent_id", "tenant_id", "trigger", "occurrence",
  "steps", "zone", "outcomes", "missed", "created_at", "finished_at",
  "run_status", "run_stop", "run_started_at", "run_stopped_at",
  "position", "vars", "input", "memory", "waiting", "wait_until", "decisions",
  // ⚠ THE DURABLE LOOP AND RETRY STATE, and `uses` beside them. **A shim LESS capable than
  // the thing it stands in for hides a defect exactly as well as one that is more**, and
  // this set is the whole of what a read may name: leaving these out would refuse the
  // store's own select and report the wiring as broken, or — worse, if the filter were
  // silent — answer a restart that a loop is at its beginning.
  "loops", "tries", "uses",
  // ⚠ THE EVENT SIDE, AND `heard` IS THE ONE THAT COST A DEFECT. The set above already
  // carried the warning two lines up and the set itself was not extended: `heard` was
  // dropped from every read, `plainObject(undefined)` answered `{}`, and a suspended
  // execution that really had heard its event RE-PAUSED for ever. Measured, through the
  // whole dispatcher, with the engine, the store and the migration all correct.
  "heard", "event_id", "event_depth"]);

/**
 * Reference material and memory — a fourth and fifth set, for the same reason as the
 * third: reading one must never be able to name a column of another.
 */
const KNOWLEDGE_COLUMNS = new Set(["id", "tenant_id", "agent_id", "title", "body", "format",
  "version", "created_at", "updated_at"]);
const MEMORY_COLUMNS = new Set(["id", "tenant_id", "agent_id", "key", "value", "source",
  "version", "created_at", "updated_at"]);

export function startLocalRest({ db, port = 0, quiet = true } = {}) {
  if (!db) throw new TypeError("startLocalRest: db is required");

  /**
   * One statement, as `service_role`, and its answer as one line of text.
   *
   * `set role service_role` rather than running as the superuser, because
   * `service_role` is what the deployment really is — and the difference is
   * observable: a superuser bypasses row level security whatever FORCE says.
   */
  /**
   * ⚠ **IT CANNOT WAIT FOR EVER, AND WHAT MADE THAT NECESSARY IS A MACHINE THIS RAN ON
   * FOR MONTHS WITHOUT SHOWING IT.**
   *
   * `su postgres` needs no password for ROOT, which is what this session and the sweeps run
   * as — so locally the child answers in milliseconds. As any other user `su` prints
   * `Password: ` and BLOCKS ON STDIN, and `execFile` hands the child a pipe nobody ever
   * writes to or closes, so it waits for ever. MEASURED as a non-root caller: `Password: `
   * and no exit, ended only by an 8-second bound.
   *
   * **WHAT THAT COST: every `agent deploy` run for a whole day read `cancelled`.** A GitHub
   * runner is the user `runner` and has no PostgreSQL, so one request that passes the profile
   * gate reached here and never came back — `fetch` gave up at undici's 300-second headers
   * timeout, and the hung child then kept `node --test` alive until the job's own
   * `timeout-minutes: 45` killed it. GitHub reports a timed-out job as CANCELLED, which reads
   * exactly like a run superseded by a later push, so twelve runs in a row said nothing.
   *
   * Two bounds, because they answer different questions. **Closing stdin** turns an
   * authentication prompt into EOF, so a machine that cannot reach Postgres is told so at
   * once rather than at the timeout. **The timeout** is the belt for anything else that can
   * hang — a wedged psql, a lock nobody releases — and it is generous, because a slow
   * statement must not be mistaken for a wedged one.
   */
  async function sql(statement) {
    const full = `set role service_role; ${statement}`;
    try {
      const stdout = await new Promise((resolve, reject) => {
        const child = execFile("su", ["postgres", "-c",
          `psql -X -q -t -A -v ON_ERROR_STOP=1 -d ${db} -c ${shq(full)}`],
          { maxBuffer: 32 * 1024 * 1024, timeout: SQL_TIMEOUT_MS },
          (e, out) => (e ? reject(e) : resolve(out)));
        // EOF rather than silence. Without this a password prompt is an indefinite wait.
        child.stdin?.end();
      });
      return { ok: true, out: stdout.trim() };
    } catch (e) {
      const said = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
      // A KILLED CHILD SAYS SO, because "it timed out" and "Postgres refused it" need
      // different things done about them and an empty `err` is neither.
      return { ok: false, err: e.killed ? `psql did not answer within ${SQL_TIMEOUT_MS}ms${said ? ` — ${said}` : ""}` : said };
    }
  }

  /**
   * Postgres's own words, turned back into the error body PostgREST would send.
   *
   * **THE DUPLICATE CODE AND THE CONSTRAINT NAME ARE BOTH LOAD-BEARING.**
   * `store.mjs` reads them to tell "this entry is already recorded" from "that
   * position is taken", and getting either wrong here would make the fixture
   * disagree with the thing it stands in for.
   */
  function errorBody(err) {
    const dup = /duplicate key value violates unique constraint "([^"]+)"/.exec(err);
    if (dup) return { status: 409, body: { code: "23505", message: `duplicate key value violates unique constraint "${dup[1]}"`, details: dup[1] } };
    if (/is not this tenant's/.test(err)) return { status: 403, body: { code: "42501", message: err.split("\n")[0] } };
    if (/permission denied/.test(err)) return { status: 403, body: { code: "42501", message: err.split("\n")[0] } };
    return { status: 400, body: { code: "P0001", message: err.split("\n").slice(0, 2).join(" ") } };
  }

/**
 * ⚠ **A COLUMN THIS SHIM DOES NOT KNOW IS REFUSED, NEVER DROPPED — and it was dropped
 * until 2026-09-18, silently, which is how a whole feature came to be demonstrated over a
 * store that could not have worked.**
 *
 * `selectOf` filtered the asked-for list against its allow-list and carried on with
 * whatever survived, so a store selecting a column this set had not been extended with got
 * a 200 and a row WITHOUT it. The reader below then read the absence as a value — `{}` for
 * `heard`, which an event wait reads as "nothing heard yet" — and a suspended execution
 * re-paused for ever with the engine, the store and the migration all correct. *A filter on
 * somebody's input is a silent drop; a check is a sentence*, and this shim's whole value is
 * that it is not more forgiving than the real thing.
 *
 * **PostgREST REFUSES IT TOO, so this is the faithful behaviour as well as the loud one**:
 * an unknown column is `400 42703`, in its own words, naming the column and the relation.
 */
function unknownColumn(rel, column) {
  const e = new Error(`column ${rel}.${column} does not exist`);
  e.pgrst = { status: 400, body: { code: "42703", message: `column ${rel}.${column} does not exist`, details: null, hint: null } };
  return e;
}

/**
 * The reserved query parameters, which are NOT filters.
 *
 * **A LIST OF WHAT IS NOT A COLUMN, so that everything else is one.** The other way round —
 * a list of what is a filter — is what let an unknown one through: a key nobody recognised
 * read as neither, and neither is exactly a silent drop.
 */
const NOT_A_FILTER = new Set(["select", "order", "limit", "offset", "on_conflict", "columns",
  "and", "or", "not"]);

/** Does this value look like a PostgREST filter at all? `eq.x`, `is.null`, `gt.3` … */
const FILTER_SHAPE = /^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|not)\./;

  /** `?a=eq.x` → `a = 'x'`, for the handful of columns the store filters on. */
  function whereOf(params, allowed, rel = "relation") {
    const parts = [];
    for (const [k, v] of params) {
      if (NOT_A_FILTER.has(k)) continue;
      // ⚠ A FILTER-SHAPED VALUE ON AN UNKNOWN COLUMN IS REFUSED. Skipping it is worse than
      // dropping a select column: the row set comes back WIDER than was asked for, so a
      // read scoped to one account could answer another's.
      if (!FILTER_SHAPE.test(v)) continue;
      if (!allowed.has(k)) throw unknownColumn(rel, k);
      if (!v.startsWith("eq.")) continue;
      parts.push(`${JSON.stringify(k).replaceAll('"', '"')} = ${lit(v.slice(3))}`);
    }
    return parts.length ? `where ${parts.map((p) => p.replace(/^"?([a-z_]+)"?/, '"$1"')).join(" and ")}` : "";
  }

  function selectOf(params, allowed, fallback, rel = "relation") {
    const raw = params.get("select");
    const cols = (raw ? raw.split(",") : fallback).map((c) => c.trim()).filter((c) => c !== "");
    for (const c of cols) if (!allowed.has(c)) throw unknownColumn(rel, c);
    if (!cols.length) throw new Error("no readable columns were asked for");
    return cols.map((c) => `"${c}"`).join(", ");
  }

  /**
   * ⚠ WHICH SCHEMA A REQUEST NAMED, BY PostgREST'S OWN RULE — and until 2026-09-17 this
   * shim had no profile handling at all.
   *
   * `Accept-Profile` is honoured on `GET` and `HEAD`; `Content-Profile` on every other
   * verb; **the other one is IGNORED, not read as a fallback.** So a POST carrying only
   * `accept-profile: agent` has named NO schema, resolves against the default one, and is
   * answered out of the schema cache where these relations do not exist.
   *
   * **THAT IS THE WALL THAT WAS MISSING, AND IT COST A MEASURED DEFECT.** Ten of the
   * fourteen capability operations sent `accept-profile` on a POST — among them the
   * `read_automation` pre-check `pause_automation` and `run_automation` each make first —
   * and this shim answered every one of them happily, because it read the path and ignored
   * the headers. So `npm run verify:tools` passed 78 checks over a store that could not
   * have worked against a real PostgREST. *A shim more permissive than the thing it stands
   * in for hides a defect exactly as well as one that is less capable*, and this is the
   * third recorded instance of that class in this file's own neighbourhood.
   *
   * It is deliberately NOT a resolver: nothing here looks in `public`, because these
   * relations are only ever in `agent`. What it does is refuse in PostgREST's own words,
   * so a store that names the wrong header fails HERE rather than in production.
   */
  const EXPOSED = new Set(["agent"]);
  /**
   * HOW MANY REQUESTS THIS GATE TURNED AWAY. Handed back so a demonstration can assert it
   * refused NOTHING — which is a negative assertion, so the same demonstration has to probe
   * the gate itself and prove it alive in that process. Without the counter, "everything
   * passed" and "the gate was never built" read identically from outside.
   */
  let refusedProfiles = 0;
  const READ_VERBS = new Set(["GET", "HEAD"]);
  const profileHeaderFor = (method) => (READ_VERBS.has(String(method ?? "").toUpperCase())
    ? "accept-profile" : "content-profile");
  /** `{ok: true, schema}`, or `{ok: false, status, body}` in PostgREST's own shape. */
  function profileOf(req, what) {
    const wanted = profileHeaderFor(req.method);
    const named = req.headers[wanted];
    // ABSENT means the default schema, which is not where any of this lives. PostgREST
    // answers out of its schema cache, and the code differs by what was asked for:
    // a relation is PGRST205, a function is PGRST202.
    if (typeof named !== "string" || !named.trim()) {
      const other = wanted === "accept-profile" ? "content-profile" : "accept-profile";
      const sent = typeof req.headers[other] === "string" ? ` (it sent ${other} instead, which PostgREST ignores on ${req.method})` : "";
      return what.kind === "function"
        ? { ok: false, status: 404, body: { code: "PGRST202", message: `Could not find the function public.${what.name} in the schema cache${sent}` } }
        : { ok: false, status: 404, body: { code: "PGRST205", message: `Could not find the table 'public.${what.name}' in the schema cache${sent}` } };
    }
    if (!EXPOSED.has(named.trim())) {
      return { ok: false, status: 406, body: { code: "PGRST106", message: `The schema must be one of the following: ${[...EXPOSED].join(", ")}` } };
    }
    return { ok: true, schema: named.trim() };
  }

  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      const p = url.pathname;
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : undefined;
      if (!quiet) console.log(`  [rest] ${req.method} ${p}`);

      // ⚠ THE PROFILE IS CHECKED ONCE, ABOVE EVERY ROUTE, which is stricter than a check
      // per route: a relation added below cannot be reached without naming its schema,
      // because there is nowhere to add one that is not already behind this.
      if (p.startsWith("/rest/v1/")) {
        const rest = p.slice("/rest/v1/".length);
        const asked = rest.startsWith("rpc/")
          ? { kind: "function", name: rest.slice("rpc/".length) }
          : { kind: "relation", name: rest };
        const prof = profileOf(req, asked);
        if (!prof.ok) { refusedProfiles += 1; return send(prof.status, prof.body); }
      }

      // ── the tables ────────────────────────────────────────────────────────
      if (p === "/rest/v1/runs" && req.method === "POST") {
        const r = await sql(`insert into agent.runs (id, tenant_id) values (${lit(body.id)}::uuid, ${lit(body.tenant_id)});`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(201);
      }
      if (p === "/rest/v1/runs" && req.method === "GET") {
        const cols = selectOf(url.searchParams, RUN_COLUMNS, ["id", "tenant_id", "status"]);
        const order = url.searchParams.get("order") === "created_at.asc" ? "order by created_at asc" : "";
        const limit = /^\d+$/.test(url.searchParams.get("limit") ?? "") ? `limit ${url.searchParams.get("limit")}` : "";
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from agent.runs ${whereOf(url.searchParams, RUN_COLUMNS)} ${order} ${limit}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      // **THE DIRECT DOOR IS NOT SERVED, and it would not work if it were.** The
      // migration revokes INSERT on `agent.run_entries` from `service_role`, and this
      // shim runs as `service_role` exactly so that difference is real — so the honest
      // answer here is the refusal PostgREST would give, not a translation nobody can
      // use. Entries go through `rpc/append_entry`.
      if (p === "/rest/v1/run_entries" && req.method === "POST") {
        return send(403, { code: "42501", message: "permission denied for table run_entries" });
      }
      if (p === "/rest/v1/run_entries" && req.method === "GET") {
        const cols = selectOf(url.searchParams, ENTRY_COLUMNS, ["seq", "body"]);
        const r = await sql(`select coalesce(json_agg(t order by t.seq), '[]')::text from (select ${cols} from agent.run_entries ${whereOf(url.searchParams, ENTRY_COLUMNS)}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }

      if (p === "/rest/v1/run_work" && req.method === "GET") {
        const cols = selectOf(url.searchParams, WORK_COLUMNS, [...WORK_COLUMNS]);
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from agent.run_work ${whereOf(url.searchParams, WORK_COLUMNS)}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/run_work" && req.method === "PATCH") {
        const sets = Object.keys(body ?? {}).filter((k) => WORK_WRITABLE.has(k));
        if (!sets.length) return send(400, { message: "nothing writable was asked for" });
        const where = whereOf(url.searchParams, WORK_COLUMNS);
        // NEVER AN UNFILTERED UPDATE. A PATCH with no filter would rewrite the lease
        // on every run in the database, which is not a thing any caller means.
        if (!where) return send(400, { message: "a PATCH must name which rows" });
        const assign = sets.map((k) => `"${k}" = ${body[k] === null ? "null" : `${lit(body[k])}::timestamptz`}`).join(", ");
        const r = await sql(`update agent.run_work set ${assign} ${where};`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(204);
      }

      // **RETENTION, WHICH THE HOSTED API SERVES AND THIS SHIM DID NOT.** The fence
      // probe removes its own run afterwards — it is an instrument, not a customer's
      // work — and a shim that is LESS capable than the thing it stands in for reports
      // the product as broken. Only `id=eq.` is accepted, so it can never be a
      // statement about more than one run.
      if (p === "/rest/v1/runs" && req.method === "DELETE") {
        const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
        if (!/^[0-9a-fA-F-]{36}$/.test(id)) return send(400, { message: "runs DELETE needs id=eq.<uuid>" });
        const r = await sql(`delete from agent.runs where id = ${lit(id)}::uuid;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(204);
      }

      // ── the customer's own agents and conversations ───────────────────────
      //
      // Enough for `agent-store.mjs` to be driven end to end: make an agent, ask
      // whose it is, and read a conversation with the state of the run each message
      // started. Narrow on purpose — the same reason the runs half is.
      if (p === "/rest/v1/agents" && req.method === "POST") {
        const rows = Array.isArray(body) ? body : [body];
        // ⚠ A COLUMN THE CALLER DID NOT NAME MUST FALL TO THE DATABASE'S OWN DEFAULT,
        // which is how PostgREST behaves and is the whole of "active only when status
        // is omitted". This shim wrote a FIXED column list, so a status the route
        // really sent was dropped here exactly as the route was dropping it — a shim
        // LESS capable than the thing it stands in for hides a defect precisely as
        // well as one that is more, and that is how this one stayed invisible.
        //
        // `default` PER COLUMN rather than per row, because `store.create` posts ONE
        // row and what varies is which of its columns are absent. It is NOT a licence
        // for a mixed batch: PostgREST refuses those outright (PGRST102, "all object
        // keys must match"), so a shim that accepted one would be more capable than
        // the real thing — the same trap from the other side.
        // ⚠ `zone` IS THE THIRD COLUMN THIS LIST HAD TO GAIN, and it is the same trap the
        // paragraph above records: a fixed list here drops a value the route really sent, and
        // the route then reads its own save back as though nobody had asked. Measured — with
        // this line unchanged the settings form answered 200 and stored nothing.
        // **`null` IS A VALUE HERE AND `undefined` IS SILENCE**, so `lit(null)` (which is
        // `null`) is a real clear and only an absent key falls to `default`.
        const vals = rows.map((r) =>
          `(${lit(r.id)}::uuid, ${lit(r.tenant_id)}, ${lit(r.name)}, ${lit(r.instructions)}, ` +
          `${r.status === undefined ? "default" : lit(r.status)}, ` +
          `${r.tools === undefined ? "default" : arr(r.tools)}, ` +
          `${r.zone === undefined ? "default" : lit(r.zone)})`).join(", ");
        // A CTE, NOT A SUBQUERY: Postgres does not allow a data-modifying statement
        // inside `from (...)`, which is a syntax error rather than a refusal — so the
        // shim answered 400 and the route reported a save that had never been tried.
        const r = await sql(`with ins as (
            insert into agent.agents (id, tenant_id, name, instructions, status, tools, zone) values ${vals}
            returning id, name, instructions, created_at, updated_at, status, tools, zone)
          select coalesce(json_agg(t), '[]')::text from ins t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(201, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agents" && req.method === "GET") {
        const cols = selectOf(url.searchParams, AGENT_COLUMNS, ["id"]);
        const limit = /^\d+$/.test(url.searchParams.get("limit") ?? "") ? `limit ${url.searchParams.get("limit")}` : "";
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from agent.agents ${whereOf(url.searchParams, AGENT_COLUMNS)} ${limit}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agents" && req.method === "PATCH") {
        // ⚠ `tools` IS AN ARRAY AND IS WRITTEN AS ONE. Passed through `lit` it would
        // become the string `echo` and Postgres would refuse the whole update — which
        // reads from the route as a save that failed rather than as a shim that
        // cannot write the column.
        const sets = ["name", "instructions", "status"].filter((k) => typeof body?.[k] === "string")
          .map((k) => `"${k}" = ${lit(body[k])}`);
        if (Array.isArray(body?.tools)) sets.push(`"tools" = ${arr(body.tools)}`);
        // ⚠ **THE ZONE IS ASKED BY PRESENCE, NOT BY TYPE, and the two differ for exactly one
        // value.** `typeof x === "string"` — the filter the three above use — drops an
        // explicit `null`, which is how somebody CLEARS a zone; PostgREST writes whatever key
        // the body carries. So absent leaves the stored value alone and `null` really clears.
        if (body && Object.hasOwn(body, "zone")) sets.push(`"zone" = ${lit(body.zone)}`);
        if (!sets.length) return send(400, { message: "nothing writable was asked for" });
        const where = whereOf(url.searchParams, AGENT_COLUMNS);
        // NEVER AN UNFILTERED UPDATE — the same rule the queue's PATCH follows, and for
        // the harder reason: without a filter this would rewrite every account's agents.
        if (!where) return send(400, { message: "a PATCH must name which rows" });
        const r = await sql(`with upd as (
            update agent.agents set ${sets.join(", ")} ${where}
            returning id, name, instructions, created_at, updated_at, status, tools, zone)
          select coalesce(json_agg(t), '[]')::text from upd t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agents" && req.method === "DELETE") {
        const where = whereOf(url.searchParams, AGENT_COLUMNS);
        if (!where) return send(400, { message: "a DELETE must name which rows" });
        const r = await sql(`with del as (delete from agent.agents ${where} returning id, name, instructions, created_at, updated_at)
          select coalesce(json_agg(t), '[]')::text from del t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      /**
       * ── reference material and memory ──────────────────────────────────────
       *
       * TWO TABLES, ONE SHAPE OF HANDLER, and it is deliberately written out twice rather
       * than abstracted over a table name: the column SETS are what stop a `select=` naming
       * a column of another half, and a shared helper taking the table AND the set as
       * arguments would be one call site away from being handed the wrong pair.
       *
       * **A COLUMN THE CALLER DID NOT NAME FALLS TO THE DATABASE'S OWN DEFAULT** — the
       * recorded lesson from `agents`, applied here before it could cost anything: the
       * version and the source belong to the column, and a shim writing a fixed list would
       * be writing a second copy of them in JavaScript.
       */
      if (p === "/rest/v1/agent_knowledge" && req.method === "POST") {
        const rows = Array.isArray(body) ? body : [body];
        const vals = rows.map((r) =>
          `(${lit(r.id)}::uuid, ${lit(r.tenant_id)}, ${lit(r.agent_id)}::uuid, ${lit(r.title)}, ${lit(r.body)}, ` +
          `${r.format === undefined ? "default" : lit(r.format)})`).join(", ");
        const r = await sql(`with ins as (
            insert into agent.agent_knowledge (id, tenant_id, agent_id, title, body, format) values ${vals}
            returning id, title, format, version, created_at, updated_at)
          select coalesce(json_agg(t), '[]')::text from ins t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(201, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agent_knowledge" && req.method === "GET") {
        const cols = selectOf(url.searchParams, KNOWLEDGE_COLUMNS, ["id"]);
        const order = url.searchParams.get("order") === "updated_at.desc" ? "order by updated_at desc" : "order by lower(title) asc";
        const limit = /^\d+$/.test(url.searchParams.get("limit") ?? "") ? `limit ${url.searchParams.get("limit")}` : "";
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from agent.agent_knowledge ${whereOf(url.searchParams, KNOWLEDGE_COLUMNS)} ${order} ${limit}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agent_knowledge" && req.method === "PATCH") {
        const sets = ["title", "body", "format"].filter((k) => typeof body?.[k] === "string")
          .map((k) => `"${k}" = ${lit(body[k])}`);
        if (!sets.length) return send(400, { message: "nothing writable was asked for" });
        const where = whereOf(url.searchParams, KNOWLEDGE_COLUMNS);
        if (!where) return send(400, { message: "a PATCH must name which rows" });
        const r = await sql(`with upd as (
            update agent.agent_knowledge set ${sets.join(", ")} ${where}
            returning id, title, format, version, created_at, updated_at)
          select coalesce(json_agg(t), '[]')::text from upd t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agent_knowledge" && req.method === "DELETE") {
        const where = whereOf(url.searchParams, KNOWLEDGE_COLUMNS);
        if (!where) return send(400, { message: "a DELETE must name which rows" });
        const r = await sql(`with del as (delete from agent.agent_knowledge ${where} returning id, title)
          select coalesce(json_agg(t), '[]')::text from del t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }

      if (p === "/rest/v1/agent_memory" && req.method === "POST") {
        const rows = Array.isArray(body) ? body : [body];
        const vals = rows.map((r) =>
          `(${lit(r.id)}::uuid, ${lit(r.tenant_id)}, ${lit(r.agent_id)}::uuid, ${lit(r.key)}, ${lit(r.value)}, ` +
          `${r.source === undefined ? "default" : lit(r.source)})`).join(", ");
        // ⚠ `Prefer: resolution=merge-duplicates` IS AN UPSERT, and this shim honours it
        // because the route depends on it: saving a memory is "set this name to this
        // value", and a caller that had to know whether the name existed would be doing
        // the unique index's job in JavaScript.
        const prefer = String(req.headers["prefer"] ?? "");
        const onConflict = prefer.includes("merge-duplicates")
          ? `on conflict (tenant_id, agent_id, key) do update set value = excluded.value, source = excluded.source`
          : "";
        const r = await sql(`with ins as (
            insert into agent.agent_memory (id, tenant_id, agent_id, key, value, source) values ${vals}
            ${onConflict}
            returning id, key, value, source, version, created_at, updated_at)
          select coalesce(json_agg(t), '[]')::text from ins t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(201, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agent_memory" && req.method === "GET") {
        const cols = selectOf(url.searchParams, MEMORY_COLUMNS, ["id"]);
        const limit = /^\d+$/.test(url.searchParams.get("limit") ?? "") ? `limit ${url.searchParams.get("limit")}` : "";
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from agent.agent_memory ${whereOf(url.searchParams, MEMORY_COLUMNS)} order by key asc ${limit}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agent_memory" && req.method === "DELETE") {
        const where = whereOf(url.searchParams, MEMORY_COLUMNS);
        if (!where) return send(400, { message: "a DELETE must name which rows" });
        const r = await sql(`with del as (delete from agent.agent_memory ${where} returning id, key)
          select coalesce(json_agg(t), '[]')::text from del t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }

      // ── automations ───────────────────────────────────────────────────────
      if (p === "/rest/v1/automations" && req.method === "GET") {
        const cols = selectOf(url.searchParams, AUTOMATION_COLUMNS, ["id"]);
        const order = url.searchParams.get("order") === "updated_at.desc" ? "order by updated_at desc" : "";
        const limit = /^\d+$/.test(url.searchParams.get("limit") ?? "") ? `limit ${url.searchParams.get("limit")}` : "";
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from agent.automations ${whereOf(url.searchParams, AUTOMATION_COLUMNS)} ${order} ${limit}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/automations" && req.method === "PATCH") {
        // THE TOGGLE IS THE ONLY PATCH THE STORE MAKES, and `enabled` is the only column
        // it writes — everything else about an automation goes through a transaction,
        // because a schedule is three columns that must agree.
        if (typeof body?.enabled !== "boolean") return send(400, { message: "nothing writable was asked for" });
        const where = whereOf(url.searchParams, AUTOMATION_COLUMNS);
        // NEVER AN UNFILTERED UPDATE: without a filter this would switch every account's
        // automations on or off at once.
        if (!where) return send(400, { message: "a PATCH must name which rows" });
        const r = await sql(`with upd as (
            update agent.automations set enabled = ${body.enabled ? "true" : "false"} ${where}
            returning id, agent_id, name, enabled, schedule, at_local, zone, steps, next_run_at, updated_at)
          select coalesce(json_agg(t), '[]')::text from upd t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/automations" && req.method === "DELETE") {
        const where = whereOf(url.searchParams, AUTOMATION_COLUMNS);
        if (!where) return send(400, { message: "a DELETE must name which rows" });
        const r = await sql(`with del as (delete from agent.automations ${where} returning id, name)
          select coalesce(json_agg(t), '[]')::text from del t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if ((p === "/rest/v1/automation_runs" || p === "/rest/v1/automation_history") && req.method === "GET") {
        const rel = p.endsWith("automation_runs") ? "agent.automation_runs" : "agent.automation_history";
        const cols = selectOf(url.searchParams, EXECUTION_COLUMNS, ["id"]);
        const order = url.searchParams.get("order") === "created_at.desc" ? "order by created_at desc" : "";
        const limit = /^\d+$/.test(url.searchParams.get("limit") ?? "") ? `limit ${url.searchParams.get("limit")}` : "";
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from ${rel} ${whereOf(url.searchParams, EXECUTION_COLUMNS)} ${order} ${limit}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/connection_list" && req.method === "GET") {
        // ⚠ **NO `select=` MEANS EVERY COLUMN, because that is what PostgREST does.** A
        // fallback of `["id"]` made this shim LESS capable than the thing it stands in for and
        // the list came back as a row of ids — a screen with no labels, reported as the
        // product being broken. The store deliberately sends no `select`, because the view has
        // no credential to leave out.
        const cols = selectOf(url.searchParams, CONNECTION_COLUMNS, [...CONNECTION_COLUMNS]);
        const order = url.searchParams.get("order") === "created_at.desc" ? "order by created_at desc" : "";
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from agent.connection_list ${whereOf(url.searchParams, CONNECTION_COLUMNS)} ${order}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agent_overview" && req.method === "GET") {
        const cols = selectOf(url.searchParams, AGENT_COLUMNS, ["id", "name"]);
        const order = url.searchParams.get("order") === "updated_at.desc" ? "order by updated_at desc" : "";
        const limit = /^\d+$/.test(url.searchParams.get("limit") ?? "") ? `limit ${url.searchParams.get("limit")}` : "";
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from agent.agent_overview ${whereOf(url.searchParams, AGENT_COLUMNS)} ${order} ${limit}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }
      if (p === "/rest/v1/agent_thread" && req.method === "GET") {
        const cols = selectOf(url.searchParams, THREAD_COLUMNS, ["id", "body"]);
        // `seq.desc` is the only order the store asks for, and it is what makes a long
        // conversation read at its live end rather than its oldest screen.
        const order = url.searchParams.get("order") === "seq.desc" ? "order by seq desc" : "order by seq asc";
        const limit = /^\d+$/.test(url.searchParams.get("limit") ?? "") ? `limit ${url.searchParams.get("limit")}` : "";
        const r = await sql(`select coalesce(json_agg(t), '[]')::text from (select ${cols} from agent.agent_thread ${whereOf(url.searchParams, THREAD_COLUMNS)} ${order} ${limit}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }

      // ── the queue's functions ─────────────────────────────────────────────
      const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(p);
      if (rpc && req.method === "POST") {
        // `Object.hasOwn`, never truthiness: `RPCS["constructor"]` is truthy and has
        // no `args`, so a lookup by a caller-supplied name has to ask for ownership.
        // This product's own recorded rule, one line of shim over.
        const spec = Object.hasOwn(RPCS, rpc[1]) ? RPCS[rpc[1]] : null;
        if (!spec) return send(404, { message: `no function ${rpc[1]}` });
        const args = spec.args.map((a) => {
          const [name, cast] = a.split("::");
          const v = body?.[name];
          if (v === undefined || v === null) return "null";
          const text = typeof v === "object" ? JSON.stringify(v) : String(v);
          /**
           * ⚠ **A `text[]` IS CONVERTED BY POSTGRES, NEVER BY THIS SHIM.** PostgREST turns a
           * JSON array into a Postgres array, and the honest local translation is to hand the
           * JSON over and let `jsonb_array_elements_text` do it — because building `{a,b}` by
           * hand needs array-literal escaping, which is a parser, which is this repository's
           * own "flat scans where depth matters" trap living in a fixture.
           *
           * THE ORDER IS ASKED FOR RATHER THAN RELIED ON (`with ordinality`), because the
           * day list's order is stored and read back, so a conversion that reordered it
           * would be a shim deciding what a customer saved.
           */
          if (cast === "text[]") {
            return `(select coalesce(array_agg(x order by n), '{}'::text[])`
              + ` from jsonb_array_elements_text(${lit(text)}::jsonb) with ordinality as t(x, n))`;
          }
          return cast ? `${lit(text)}::${cast}` : lit(text);
        }).join(", ");
        const call = `agent.${rpc[1]}(${args})`;
        const statement = spec.shape === "set"
          ? `select coalesce(json_agg(t), '[]')::text from ${call} as t;`
          : `select to_jsonb(${call})::text;`;
        const r = await sql(statement);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "null"));
      }

      return send(404, { message: `the local rest does not serve ${req.method} ${p}` });
    } catch (e) {
      // A REFUSAL THIS SHIM RAISED ON PURPOSE ARRIVES AS PostgREST'S OWN ANSWER, not as a
      // 500: a store reading a 500 as "the service is down" would retry a request that can
      // never succeed, and the one thing the caller needs is the column's name.
      if (e?.pgrst) return send(e.pgrst.status, e.pgrst.body);
      send(500, { message: String(e?.message ?? e) });
    }
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const { port: got } = server.address();
      resolve({
        url: `http://127.0.0.1:${got}`, port: got,
        /**
         * ⚠ **IT DESTROYS OPEN CONNECTIONS, because `server.close` alone WAITS for them.**
         * A case that fails mid-request leaves a socket open and never reaches the end of its
         * own body — the cleanup runs in an `after` hook, correctly, and then blocks anyway.
         * That is the second half of what turned one failed assertion into a 45-minute job
         * timeout: nothing was still working, and nothing could exit either.
         */
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
        /** How many requests the profile gate turned away. See `refusedProfiles`. */
        refusedProfiles: () => refusedProfiles,
      });
    });
  });
}

// Runnable on its own, for poking at by hand.
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = process.env.LOCAL_DB;
  if (!db) { console.error("set LOCAL_DB to a database with the migrations applied"); process.exit(2); }
  const s = await startLocalRest({ db, port: Number(process.env.PORT) || 8788, quiet: false });
  console.log(`local rest for ${db} on ${s.url}`);
}
