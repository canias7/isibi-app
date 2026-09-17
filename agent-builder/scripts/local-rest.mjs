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
  create_automation: { args: ["p_tenant", "p_agent_id::uuid", "p_id::uuid", "p_name", "p_enabled::boolean", "p_schedule", "p_at_local::time", "p_zone", "p_steps::jsonb", "p_max::integer"], shape: "value" },
  update_automation: { args: ["p_tenant", "p_id::uuid", "p_name", "p_enabled::boolean", "p_schedule", "p_at_local::time", "p_zone", "p_steps::jsonb"], shape: "value" },
  accept_automation_run: { args: ["p_tenant", "p_automation_id::uuid", "p_run_id::uuid", "p_trigger", "p_occurrence::date"], shape: "value" },
  finish_automation_run: { args: ["p_run_id::uuid", "p_worker", "p_token::uuid", "p_outcomes::jsonb", "p_stop::jsonb"], shape: "value" },
  tick_automations: { args: ["p_catchup_s::integer", "p_limit::integer"], shape: "set" },
};

/**
 * The AUTHORED side's columns — the customer's own agents and conversations.
 *
 * A SEPARATE SET FROM THE RUNS', because they are a separate half of the schema and
 * reading one must never be able to name a column of the other.
 */
const AGENT_COLUMNS = new Set(["id", "tenant_id", "name", "instructions", "created_at", "updated_at",
  "last_message", "status", "tools"]);
const THREAD_COLUMNS = new Set(["id", "agent_id", "seq", "body", "created_at", "run_id",
  "run_status", "run_stop", "run_step", "run_model", "run_started_at", "run_stopped_at"]);

/** The automations' own columns, and their executions'. A third set, for a third half. */
const AUTOMATION_COLUMNS = new Set(["id", "agent_id", "tenant_id", "name", "enabled", "schedule",
  "at_local", "zone", "steps", "next_run_at", "created_at", "updated_at"]);
const EXECUTION_COLUMNS = new Set(["id", "automation_id", "tenant_id", "trigger", "occurrence",
  "steps", "zone", "outcomes", "missed", "created_at", "finished_at",
  "run_status", "run_stop", "run_started_at", "run_stopped_at"]);

export function startLocalRest({ db, port = 0, quiet = true } = {}) {
  if (!db) throw new TypeError("startLocalRest: db is required");

  /**
   * One statement, as `service_role`, and its answer as one line of text.
   *
   * `set role service_role` rather than running as the superuser, because
   * `service_role` is what the deployment really is — and the difference is
   * observable: a superuser bypasses row level security whatever FORCE says.
   */
  async function sql(statement) {
    const full = `set role service_role; ${statement}`;
    try {
      const { stdout } = await run("su", ["postgres", "-c",
        `psql -X -q -t -A -v ON_ERROR_STOP=1 -d ${db} -c ${shq(full)}`], { maxBuffer: 32 * 1024 * 1024 });
      return { ok: true, out: stdout.trim() };
    } catch (e) {
      return { ok: false, err: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() };
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

  /** `?a=eq.x` → `a = 'x'`, for the handful of columns the store filters on. */
  function whereOf(params, allowed) {
    const parts = [];
    for (const [k, v] of params) {
      if (!allowed.has(k)) continue;
      if (!v.startsWith("eq.")) continue;
      parts.push(`${JSON.stringify(k).replaceAll('"', '"')} = ${lit(v.slice(3))}`);
    }
    return parts.length ? `where ${parts.map((p) => p.replace(/^"?([a-z_]+)"?/, '"$1"')).join(" and ")}` : "";
  }

  function selectOf(params, allowed, fallback) {
    const raw = params.get("select");
    const cols = (raw ? raw.split(",") : fallback).map((c) => c.trim()).filter((c) => allowed.has(c));
    if (!cols.length) throw new Error("no readable columns were asked for");
    return cols.map((c) => `"${c}"`).join(", ");
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
        const vals = rows.map((r) =>
          `(${lit(r.id)}::uuid, ${lit(r.tenant_id)}, ${lit(r.name)}, ${lit(r.instructions)}, ` +
          `${r.status === undefined ? "default" : lit(r.status)}, ` +
          `${r.tools === undefined ? "default" : arr(r.tools)})`).join(", ");
        // A CTE, NOT A SUBQUERY: Postgres does not allow a data-modifying statement
        // inside `from (...)`, which is a syntax error rather than a refusal — so the
        // shim answered 400 and the route reported a save that had never been tried.
        const r = await sql(`with ins as (
            insert into agent.agents (id, tenant_id, name, instructions, status, tools) values ${vals}
            returning id, name, instructions, created_at, updated_at, status, tools)
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
        if (!sets.length) return send(400, { message: "nothing writable was asked for" });
        const where = whereOf(url.searchParams, AGENT_COLUMNS);
        // NEVER AN UNFILTERED UPDATE — the same rule the queue's PATCH follows, and for
        // the harder reason: without a filter this would rewrite every account's agents.
        if (!where) return send(400, { message: "a PATCH must name which rows" });
        const r = await sql(`with upd as (
            update agent.agents set ${sets.join(", ")} ${where}
            returning id, name, instructions, created_at, updated_at, status, tools)
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
      send(500, { message: String(e?.message ?? e) });
    }
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const { port: got } = server.address();
      resolve({ url: `http://127.0.0.1:${got}`, port: got, close: () => new Promise((r) => server.close(r)) });
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
