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
import { makeRunStore, DUPLICATE } from "../../src/store.mjs";
import { makeWork } from "../../src/work.mjs";

export function memoryRest({ now = () => Date.now() } = {}) {
  const runs = new Map();                  // id -> { id, tenant_id, status, ... }
  const entries = new Map();               // id -> Map(seq -> body)
  const work = new Map();                  // id -> the run_work row
  let tokens = 0;                          // claim tokens, minted per claim
  /** Canonical JSON: what `jsonb` equality amounts to here — key order normalised. */
  const canon = (v) => JSON.stringify(v, (_k, x) =>
    (x && typeof x === "object" && !Array.isArray(x))
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]]))
      : x);
  const logicalKey = (b) => b.kind === "started" || b.kind === "stopped" ? b.kind
    : b.kind === "model" ? `model:${b.step}` : `tool:${b.step}:${b.index}`;
  const res = (status, body) => ({
    ok: status < 300, status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  });
  const conflict = (c) => res(409, { code: DUPLICATE, message: `duplicate key value violates unique constraint "${c}"` });

  /**
   * The projection `agent.project_entry` maintains by trigger, mirrored. Lifted out
   * of the insert path so the ONE writer below drives it — two copies of a
   * projection is how a fake starts disagreeing with the engine.
   */
  const project = (runId, entry) => {
    const run = runs.get(runId);
    if (!run) return;
    if (entry.kind === "started") {
      run.status = run.status === "new" ? "running" : run.status;
      run.agent_name = entry.agent ?? null;
      run.model = entry.model ?? null;
      run.limits = entry.limits ?? null;
    } else if (entry.kind === "stopped") {
      run.status = "stopped";
      run.stop = entry.stop ?? null;
    }
  };

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
    // **THE DIRECT DOOR IS SHUT HERE TOO, and that is not decoration.** The
    // migration revokes INSERT on `agent.run_entries` from `service_role`, so a
    // fixture that still accepted this POST would be MORE capable than the database
    // — and a code path that only works against the fake is exactly what a fake
    // exists to catch.
    if (p.endsWith("/run_entries") && init.method === "POST") {
      return res(403, { code: "42501", message: "permission denied for table run_entries" });
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
        project(id, entry);
      }
      if (!work.has(id)) {
        work.set(id, { run_id: id, tenant_id: tenant, kind: kind ?? "start", enqueued_at: now(), attempts: 0,
          claimed_by: null, claimed_at: null, lease_expires_at: null, claim_token: null, done_at: null, last_error: null });
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
      // A NEW TOKEN EVERY TIME, including for the same worker name claiming a run it
      // held before: the token identifies the CLAIM and not the claimer.
      w.claim_token = `tok-${++tokens}`;
      return res(200, { claimed: true, run_id: id, tenant_id: w.tenant_id, kind: w.kind, attempts: w.attempts,
        claim_token: w.claim_token, lease_expires_at: w.lease_expires_at });
    }

    if (p.endsWith("/rpc/beat_run") && init.method === "POST") {
      const { p_run_id: id, p_worker: worker, p_token: token, p_ttl_s: ttl } = body;
      if (token === null || token === undefined) return res(400, { message: "beat_run: the claim token is required" });
      const w = work.get(id);
      // A LOST CLAIM CANNOT BE REVIVED: expired, held by somebody else, or held under
      // a token that has since been replaced, is false.
      if (!w || w.claimed_by !== worker || w.claim_token !== token || w.done_at !== null || !(w.lease_expires_at > now())) return res(200, false);
      w.lease_expires_at = now() + ttl * 1000;
      return res(200, true);
    }

    if (p.endsWith("/rpc/release_run") && init.method === "POST") {
      const { p_run_id: id, p_worker: worker, p_token: token, p_done: done, p_error: error } = body;
      if (token === null || token === undefined) return res(400, { message: "release_run: the claim token is required" });
      const w = work.get(id);
      // ONLY THE HOLDER MAY RELEASE, AND ONLY WHILE ITS LEASE IS LIVE — a lapsed
      // holder marking a run done is the stale-writer problem one key over.
      if (!w || w.claimed_by !== worker || w.claim_token !== token || !(w.lease_expires_at > now())) return res(200, false);
      w.claimed_by = null; w.claimed_at = null; w.lease_expires_at = null; w.claim_token = null;
      w.done_at = done ? now() : null; w.last_error = error ?? null;
      return res(200, true);
    }

    // ── the fence ───────────────────────────────────────────────────────────
    // **MIRRORING `agent.append_entry` ANSWER FOR ANSWER.** The ordering matters and
    // is the same as the function's: the claim first (so a stale writer never learns
    // anything about the log), then the LOGICAL slot with the bodies COMPARED, then
    // the position. A fixture that checked the position first would answer `position`
    // where the engine answers `already`, and the store's counter would then drift.
    if (p.endsWith("/rpc/append_entry") && init.method === "POST") {
      const { p_run_id: id, p_seq: seq, p_body: entry, p_worker: worker, p_token: token } = body;
      if (typeof worker !== "string" || worker.trim() === "") return res(400, { message: "append_entry: worker must be a non-empty string" });
      if (token === null || token === undefined) return res(400, { message: "append_entry: the claim token is required" });
      if (!Number.isInteger(seq) || seq < 0) return res(400, { message: "append_entry: seq must be a non-negative integer" });
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return res(400, { message: "append_entry: the entry must be a JSON object" });

      const w = work.get(id);
      if (!w) return res(200, { ok: false, why: "no-work" });
      if (w.done_at !== null) return res(200, { ok: false, why: "finished" });
      if (w.claimed_by === null || w.claimed_by !== worker) return res(200, { ok: false, why: "not-holder" });
      if (w.claim_token === null || w.claim_token !== token) return res(200, { ok: false, why: "bad-token" });
      if (w.lease_expires_at === null || !(w.lease_expires_at > now())) return res(200, { ok: false, why: "lease-expired" });

      const log = entries.get(id);
      if (!log) return res(400, { code: "23503", message: "run_entries_run_id_fkey" });

      const key = logicalKey(entry);
      for (const [at, b] of log.entries()) {
        if (logicalKey(b) !== key) continue;
        // **THE BODIES ARE COMPARED, not merely the slot.** Identical is a retry and
        // is a success; different is two writers and is not. Compared as canonical
        // JSON because that is what `jsonb` equality amounts to for the entries this
        // product writes — key order normalised, values exact.
        return res(200, canon(b) === canon(entry)
          ? { ok: true, stored: false, already: true, seq: at }
          : { ok: false, why: "conflict", seq: at });
      }
      if (log.has(seq)) return res(200, { ok: false, why: "position", seq });

      // The table's own refusals, which the function does not absorb: a malformed
      // entry raises rather than becoming one of the nine answers.
      if (!["started", "model", "tool", "stopped"].includes(entry.kind)) {
        return res(400, { code: "23514", message: 'new row violates check constraint "entry_kind_known"' });
      }
      const wantsStep = entry.kind === "model" || entry.kind === "tool";
      const hasStep = entry.step !== undefined && entry.step !== null;
      const hasIdx = entry.index !== undefined && entry.index !== null;
      if (wantsStep !== hasStep || (entry.kind === "tool") !== hasIdx) {
        return res(400, { code: "23514", message: 'new row violates check constraint "entry_position_matches_kind"' });
      }

      log.set(seq, entry);
      project(id, entry);
      return res(200, { ok: true, stored: true, seq });
      // **ONE THING THE REAL FUNCTION HAS THAT THIS DOES NOT: a `unique_violation`
      // handler after the insert.** It is a backstop for a race between a fenced write
      // and `accept_run`'s unfenced seq 0, and a single-threaded fake cannot produce
      // one — so this is a place where the fixture is LESS capable, named rather than
      // left to be discovered. It cannot hide a bug: the handler re-asks the same two
      // questions this fake answers above, and the real engine is where it is proved
      // (`test/integration/pg-schema.mjs`).
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

/**
 * A store and a queue over one fake, which is what the API and the runner need.
 *
 * **THE STORE'S WRITER IS THE QUEUE'S FENCE, exactly as the Worker wires it.** A
 * fixture that handed the store some other appender would be testing a wiring that
 * does not ship.
 */
export const liveStore = (opts = {}) => {
  const rest = memoryRest(opts);
  const wire = { fetch: rest.fetch, url: "https://p.supabase.co/", key: "svc" };
  const work = makeWork(wire);
  return { rest, store: makeRunStore({ ...wire, appendEntry: work.append }), work };
};

/**
 * A run with a claimed work row, which is what a journal needs.
 *
 * **IT GOES THROUGH `accept_run` AND `claim_run`, never straight into the maps.** A
 * hold built by hand would be a hold no claim ever issued, and the thing under test
 * is precisely that a journal carries one the database recognises. `entry` is the
 * log's first entry, because `accept_run` will not take anything else.
 */
export async function holdRun({ work, rest }, { runId, tenant = "t1", worker = `w-${runId}`, entry = null, ttlS = 90 } = {}) {
  await work.accept({
    runId, tenant, kind: "start",
    entry: entry ?? { kind: "started", at: 0, tenant, agent: "support", model: "m", prompt: "go", limits: { steps: 8 } },
  });
  const claim = await work.claim({ runId, worker, ttlS });
  if (!claim.claimed) throw new Error(`holdRun: ${runId} was not claimable`);
  if (rest) rest.fetch.calls.length = 0;   // so a test's first call is its own
  return { worker: claim.worker ?? worker, token: claim.token, tenant: claim.tenant };
}

