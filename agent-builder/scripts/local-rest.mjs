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
/** A SQL string literal for a shell argument, since psql is reached through `su`. */
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** The columns `store.mjs` is allowed to ask for, so a `select=` cannot be injected. */
const RUN_COLUMNS = new Set(["id", "tenant_id", "status", "agent_name", "model", "limits", "stop", "created_at", "stopped_at"]);
const ENTRY_COLUMNS = new Set(["seq", "body", "run_id", "kind", "step", "idx", "at"]);

/** Every RPC, with how its answer comes back. A name not here is a 404. */
const RPCS = {
  accept_run: { args: ["p_run_id::uuid", "p_tenant", "p_entry::jsonb", "p_kind"], shape: "value" },
  requeue_run: { args: ["p_run_id::uuid", "p_tenant"], shape: "value" },
  claim_run: { args: ["p_run_id::uuid", "p_worker", "p_ttl_s::integer"], shape: "value" },
  beat_run: { args: ["p_run_id::uuid", "p_worker", "p_ttl_s::integer"], shape: "value" },
  release_run: { args: ["p_run_id::uuid", "p_worker", "p_done::boolean", "p_error"], shape: "value" },
  sweep_run_work: { args: ["p_grace_s::integer", "p_limit::integer"], shape: "set" },
};

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
      if (p === "/rest/v1/run_entries" && req.method === "POST") {
        const r = await sql(`insert into agent.run_entries (run_id, seq, body) values (${lit(body.run_id)}::uuid, ${Number(body.seq)}, ${lit(JSON.stringify(body.body))}::jsonb);`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(201);
      }
      if (p === "/rest/v1/run_entries" && req.method === "GET") {
        const cols = selectOf(url.searchParams, ENTRY_COLUMNS, ["seq", "body"]);
        const r = await sql(`select coalesce(json_agg(t order by t.seq), '[]')::text from (select ${cols} from agent.run_entries ${whereOf(url.searchParams, ENTRY_COLUMNS)}) t;`);
        if (!r.ok) { const e = errorBody(r.err); return send(e.status, e.body); }
        return send(200, JSON.parse(r.out || "[]"));
      }

      // ── the queue's functions ─────────────────────────────────────────────
      const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(p);
      if (rpc && req.method === "POST") {
        const spec = RPCS[rpc[1]];
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
