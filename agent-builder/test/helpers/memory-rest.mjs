/**
 * A FAKE POSTGREST WHOSE RULES ARE THE PROVEN ONES.
 *
 * Its refusals and its derived `status` mirror what `test/integration/pg-schema.mjs`
 * proves against a real PostgreSQL 16. The split is deliberate: the SQL is proved
 * on the engine, and what this stands in for is the protocol — that the store
 * speaks to those rules correctly and that the loop and the API can drive it.
 *
 * ONE COPY, SHARED. Two copies of a fixture drift, and the one that drifts is the
 * one whose answers are being trusted.
 */
import { makeRunStore, DUPLICATE, POSITION_UNIQUE } from "../../src/store.mjs";

export function memoryRest() {
  const runs = new Map();                  // id -> { id, tenant_id, status, ... }
  const entries = new Map();               // id -> Map(seq -> body)
  const logicalKey = (b) => b.kind === "started" || b.kind === "stopped" ? b.kind
    : b.kind === "model" ? `model:${b.step}` : `tool:${b.step}:${b.index}`;
  const constraintFor = (key) => key === "started" ? "entries_one_started"
    : key === "stopped" ? "entries_one_stopped"
    : key.startsWith("model") ? "entries_one_model_per_step" : "entries_one_tool_per_slot";
  const res = (status, body) => ({
    ok: status < 300, status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  });
  const conflict = (c) => res(409, { code: DUPLICATE, message: `duplicate key value violates unique constraint "${c}"` });

  const fetch = async (url, init) => {
    const u = new URL(url);
    const p = u.pathname;
    const body = init.body ? JSON.parse(init.body) : undefined;
    const eq = (k) => { const v = u.searchParams.get(k); return v === null ? null : v.replace(/^eq\./, ""); };

    if (p.endsWith("/runs") && init.method === "POST") {
      if (runs.has(body.id)) return conflict("runs_pkey");
      runs.set(body.id, { ...body, status: "new", agent_name: null, model: null, limits: null, stop: null, created_at: "2026-09-15T00:00:00Z" });
      entries.set(body.id, new Map());
      return res(201);
    }
    if (p.endsWith("/runs") && init.method === "GET") {
      const id = eq("id"), tenant = eq("tenant_id"), status = eq("status");
      const rows = [...runs.values()].filter((r) =>
        (id === null || r.id === id) && (tenant === null || r.tenant_id === tenant) && (status === null || r.status === status));
      return res(200, rows);
    }
    if (p.endsWith("/run_entries") && init.method === "POST") {
      const log = entries.get(body.run_id);
      if (!log) return res(409, { code: "23503", message: "run_entries_run_id_fkey" });
      if (log.has(body.seq)) return conflict(POSITION_UNIQUE);
      const key = logicalKey(body.body);
      for (const b of log.values()) if (logicalKey(b) === key) return conflict(constraintFor(key));
      log.set(body.seq, body.body);
      // The projection the database maintains by trigger, mirrored here.
      const run = runs.get(body.run_id);
      if (body.body.kind === "started") {
        run.status = run.status === "new" ? "running" : run.status;
        run.agent_name = body.body.agent ?? null;
        run.model = body.body.model ?? null;
        run.limits = body.body.limits ?? null;
      } else if (body.body.kind === "stopped") {
        run.status = "stopped";
        run.stop = body.body.stop ?? null;
      }
      return res(201);
    }
    if (p.endsWith("/run_entries") && init.method === "GET") {
      const log = entries.get(eq("run_id")) ?? new Map();
      return res(200, [...log.entries()].sort((a, b) => a[0] - b[0]).map(([seq, b]) => ({ seq, body: b })));
    }
    throw new Error(`the memory rest does not serve ${init.method} ${p}`);
  };
  const calls = [];
  const counted = async (url, init) => { calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined }); return fetch(url, init); };
  counted.calls = calls;
  return { fetch: counted, runs, entries };
}
export const liveStore = () => {
  const rest = memoryRest();
  return { rest, store: makeRunStore({ fetch: rest.fetch, url: "https://p.supabase.co/", key: "svc" }) };
};

