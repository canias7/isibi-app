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
import { makeWork } from "../../src/work.mjs";

export function memoryRest({ now = () => Date.now() } = {}) {
  const runs = new Map();                  // id -> { id, tenant_id, status, ... }
  const entries = new Map();               // id -> Map(seq -> body)
  const work = new Map();                  // id -> the run_work row
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
    // ── the queue's RPCs ────────────────────────────────────────────────────
    // MIRRORING `agent.run_work`'s functions statement for statement. The SQL is
    // proved on a real engine in `test/integration/pg-schema.mjs`; what this stands
    // in for is the PROTOCOL — that `work.mjs` speaks to those answers correctly
    // and that the API and the runner can be driven over them.
    //
    // THE LEASE ARITHMETIC USES AN INJECTED CLOCK, because the one branch that
    // matters most — a lease lost half way through a run — is otherwise reachable
    // only by sitting still for ninety seconds.
    // **THE SCHEMA MUST BE NAMED, exactly as PostgREST requires.** `agent` is not
    // `public`, so a call that does not send the profile header is asking the wrong
    // schema — and the real answer to that is a 404 naming no such function, not a
    // quiet success. The fixture refuses it, because a fixture that is MORE
    // forgiving than the thing it stands in for hides the bug it exists to find.
    const profile = init.headers?.["content-profile"] ?? init.headers?.["accept-profile"];
    if (p.includes("/rpc/") && profile !== "agent") {
      return res(404, { code: "PGRST202", message: `Could not find the function in the schema "${profile ?? "public"}"` });
    }

    const liveLease = (w) => w.claimed_by !== null && w.lease_expires_at > now();
    const stateOf = (w) => w.done_at !== null ? "finished" : liveLease(w) ? "running" : "queued";

    if (p.endsWith("/rpc/accept_run") && init.method === "POST") {
      const { p_run_id: id, p_tenant: tenant, p_entry: entry, p_kind: kind } = body;
      if (typeof tenant !== "string" || tenant.trim() === "") return res(400, { message: "accept_run: tenant must be a non-empty string" });
      if (!entry || entry.kind !== "started") return res(400, { message: "accept_run: the first entry must be a \"started\" entry" });
      if (!runs.has(id)) {
        runs.set(id, { id, tenant_id: tenant, status: "new", agent_name: null, model: null, limits: null, stop: null, created_at: "2026-09-15T00:00:00Z" });
        entries.set(id, new Map());
      }
      // A retry must never attach to another tenant's run: the primary key is the
      // id ALONE, so without this the same id from a stranger would be absorbed.
      if (runs.get(id).tenant_id !== tenant) return res(403, { code: "42501", message: `accept_run: run ${id} is not this tenant's` });
      const log = entries.get(id);
      if (!log.has(0) && ![...log.values()].some((b) => b.kind === "started")) {
        log.set(0, entry);
        const run = runs.get(id);
        run.status = run.status === "new" ? "running" : run.status;
        run.agent_name = entry.agent ?? null;
        run.model = entry.model ?? null;
        run.limits = entry.limits ?? null;
      }
      if (!work.has(id)) {
        work.set(id, { run_id: id, tenant_id: tenant, kind: kind ?? "start", enqueued_at: now(), attempts: 0,
          claimed_by: null, claimed_at: null, lease_expires_at: null, done_at: null, last_error: null });
      }
      const w = work.get(id);
      return res(200, { run_id: id, tenant_id: tenant, state: stateOf(w), attempts: w.attempts });
    }

    if (p.endsWith("/rpc/requeue_run") && init.method === "POST") {
      const { p_run_id: id, p_tenant: tenant } = body;
      const w = work.get(id);
      // NOT FOUND, NEVER FORBIDDEN — another tenant's run reads the same as one
      // that does not exist.
      if (!w || w.tenant_id !== tenant) return res(200, { state: "not-found" });
      if (liveLease(w)) return res(200, { state: "running", attempts: w.attempts });
      w.kind = "resume"; w.done_at = null; w.enqueued_at = now(); w.last_error = null; w.attempts = 0;
      return res(200, { state: "queued", attempts: 0 });
    }

    if (p.endsWith("/rpc/claim_run") && init.method === "POST") {
      const { p_run_id: id, p_worker: worker, p_ttl_s: ttl } = body;
      if (typeof worker !== "string" || worker.trim() === "") return res(400, { message: "claim_run: worker must be a non-empty string" });
      if (!(ttl > 0)) return res(400, { message: "claim_run: ttl must be a positive number of seconds" });
      const w = work.get(id);
      // THE ONE CONDITIONAL UPDATE. A duplicate delivery and two resumes lose here.
      if (!w || w.done_at !== null || liveLease(w)) return res(200, { claimed: false });
      w.claimed_by = worker; w.claimed_at = now(); w.lease_expires_at = now() + ttl * 1000; w.attempts += 1;
      return res(200, { claimed: true, run_id: id, tenant_id: w.tenant_id, kind: w.kind, attempts: w.attempts, lease_expires_at: w.lease_expires_at });
    }

    if (p.endsWith("/rpc/beat_run") && init.method === "POST") {
      const { p_run_id: id, p_worker: worker, p_ttl_s: ttl } = body;
      const w = work.get(id);
      // A LOST LEASE CANNOT BE REVIVED: expired, or held by somebody else, is false.
      if (!w || w.claimed_by !== worker || w.done_at !== null || !(w.lease_expires_at > now())) return res(200, false);
      w.lease_expires_at = now() + ttl * 1000;
      return res(200, true);
    }

    if (p.endsWith("/rpc/release_run") && init.method === "POST") {
      const { p_run_id: id, p_worker: worker, p_done: done, p_error: error } = body;
      const w = work.get(id);
      // ONLY THE HOLDER MAY RELEASE.
      if (!w || w.claimed_by !== worker) return res(200, false);
      w.claimed_by = null; w.claimed_at = null; w.lease_expires_at = null;
      w.done_at = done ? now() : null; w.last_error = error ?? null;
      return res(200, true);
    }

    if (p.endsWith("/rpc/sweep_run_work") && init.method === "POST") {
      const grace = (body?.p_grace_s ?? 30) * 1000;
      const limit = Math.max(1, body?.p_limit ?? 50);
      // SELECTED ON THE LEASE, NEVER ON ELAPSED TIME.
      const rows = [...work.values()]
        .filter((w) => w.done_at === null && (w.claimed_by === null || w.lease_expires_at <= now() - grace))
        .sort((a, b) => a.enqueued_at - b.enqueued_at)
        .slice(0, limit)
        .map((w) => ({ run_id: w.run_id, tenant_id: w.tenant_id, kind: w.kind, attempts: w.attempts, last_error: w.last_error }));
      return res(200, rows);
    }

    throw new Error(`the memory rest does not serve ${init.method} ${p}`);
  };
  const calls = [];
  const counted = async (url, init) => { calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined }); return fetch(url, init); };
  counted.calls = calls;
  return { fetch: counted, runs, entries, work };
}

/** A store and a queue over one fake, which is what the API and the runner need. */
export const liveStore = (opts = {}) => {
  const rest = memoryRest(opts);
  const wire = { fetch: rest.fetch, url: "https://p.supabase.co/", key: "svc" };
  return { rest, store: makeRunStore(wire), work: makeWork(wire) };
};

