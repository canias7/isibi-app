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

const isText = (v) => typeof v === "string" && v.trim() !== "";

export function memoryRest({ now = () => Date.now() } = {}) {
  const runs = new Map();                  // id -> { id, tenant_id, status, ... }
  const entries = new Map();               // id -> Map(seq -> body)
  const work = new Map();                  // id -> the run_work row
  // ── the automation side ───────────────────────────────────────────────────
  // MIRRORED THE SAME WAY AND FOR THE SAME REASON as the queue's rows above: the SQL
  // is proved on a real PostgreSQL 16 (`test/integration/pg-automations.mjs` and the
  // migration's own probes) and what this stands in for is the PROTOCOL — that the
  // cron, the store and the runner speak to those answers correctly.
  //
  // **WHERE IT IS DELIBERATELY LESS CAPABLE, and it is named rather than left to be
  // discovered: the DST arithmetic is NOT here.** `automation_next_at` is a local-time
  // calculation with two measured cases, and a JavaScript re-implementation of it
  // would be a second copy of the one thing this repository proved on the engine. A
  // row's `next_run_at` and `occurrence` are set by the test, and the advance is a
  // plain day. What IS here is every decision the cron reads: fresh versus stale,
  // filed versus already, disabled, paused.
  const agents = new Map();                // id -> { id, tenant_id, status }
  const autos = new Map();                 // id -> the automations row
  const execs = new Map();                 // run id -> the automation_runs row
  const events = new Map();                // id -> the events row, for the two dispatch halves
  // ── reference material and memory ─────────────────────────────────────────
  // **AND HERE IT IS DELIBERATELY LESS CAPABLE TOO, NAMED RATHER THAN DISCOVERED: the
  // SEARCH is a substring match, not `to_tsvector`/`ts_headline`.** Stemming, ranking and
  // the matched-passage excerpt are PostgreSQL's, proved on a real PostgreSQL 16; a
  // JavaScript re-implementation of them would be a second search engine that disagrees
  // with the one that ships. What IS here is the PROTOCOL the engine depends on — that a
  // hit carries a title and a version, that nothing found is an empty list, and that the
  // tenant and the agent are both in the filter.
  const know = new Map();                  // id -> the agent_knowledge row
  const mem = new Map();                   // id -> the agent_memory row
  const approvals = new Map();             // id -> the tool_approvals row
  const revocations = new Set();           // `<agent>\u0000<tool>` — one tool_revocations row each
  let tokens = 0;                          // claim tokens, minted per claim
  /** Canonical JSON: what `jsonb` equality amounts to here — key order normalised. */
  const canon = (v) => JSON.stringify(v, (_k, x) =>
    (x && typeof x === "object" && !Array.isArray(x))
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]]))
      : x);
  /**
   * A local time as an instant — the fake's stand-in for `agent.automation_next_at`.
   *
   * **DELIBERATELY NOT THE REAL ARITHMETIC, and this is the same declaration the maps
   * above carry**: it treats the zone as UTC, so a `wait until` here lands on today's or
   * tomorrow's UTC instant. The two daylight-saving cases are measured on a real
   * PostgreSQL; re-implementing them here would be a second copy of the one thing this
   * repository proved on the engine.
   */
  const untilLocal = (at, _zone) => {
    const m = /^(\d{2}):(\d{2})$/.exec(String(at ?? ""));
    const base = new Date(now());
    const cand = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(),
      m ? Number(m[1]) : 0, m ? Number(m[2]) : 0, 0, 0);
    return new Date(cand > now() ? cand : cand + 86400e3).toISOString();
  };

  /**
   * The logical slot an entry occupies, mirroring the four partial unique indexes.
   *
   * ⚠ **A `step` ENTRY'S SLOT INCLUDES ITS `mark` AND ITS `at`, because there is
   * deliberately NO unique index for it.** A pause writes one entry for a step and the
   * resume writes another for the same step, so "one entry per position" is not the rule
   * here — what is the rule is that a RETRY inside one delivery replays a byte-identical
   * body, which this slot reproduces exactly: same delivery, same clock, same mark, same
   * slot, and `already` comes back.
   */
  const logicalKey = (b) => b.kind === "started" || b.kind === "stopped" ? b.kind
    : b.kind === "model" ? `model:${b.step}`
    : b.kind === "step" ? `step:${b.step}:${b.mark}:${b.at}`
    : `tool:${b.step}:${b.index}`;
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
    //
    // ⚠ AND IT READ EITHER HEADER UNTIL 2026-09-17, WHICH IS THAT VERY TRAP IN THE
    // COMMENT WRITTEN AGAINST IT. PostgREST honours `Accept-Profile` on GET and HEAD
    // ONLY and `Content-Profile` on every other verb; **the other one is ignored, not
    // read as a fallback.** So a POST carrying only `accept-profile` had named no
    // schema at all — and ten of the fourteen capability operations were doing exactly
    // that while this fake, and the local shim, answered them happily. The rule is
    // `src/rest-profile.mjs`'s; it is not imported here, because a fake that asks the
    // product what correct means cannot disagree with it.
    const wantsRead = init.method === undefined || ["GET", "HEAD"].includes(String(init.method).toUpperCase());
    const profile = init.headers?.[wantsRead ? "accept-profile" : "content-profile"];
    if (profile !== "agent") {
      const fn = p.includes("/rpc/");
      return res(404, fn
        ? { code: "PGRST202", message: `Could not find the function in the schema "${profile ?? "public"}"` }
        : { code: "PGRST205", message: `Could not find the table in the schema "${profile ?? "public"}"` });
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
        // `executor` CARRIES THE COLUMN'S OWN DEFAULT, exactly as the migration writes
        // it: a row accepted through this door is the agent loop's until something
        // says otherwise, and the only thing that says otherwise is
        // `accept_automation_run`, in the same transaction.
        work.set(id, { run_id: id, tenant_id: tenant, kind: kind ?? "start", enqueued_at: now(), attempts: 0,
          claimed_by: null, claimed_at: null, lease_expires_at: null, claim_token: null, done_at: null, last_error: null,
          executor: "agent" });
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
      // ⚠ **THE EXECUTOR RIDES ON THE CLAIM, in the statement that says whose the work
      // is.** `kind` cannot carry it: `requeue_run` sets `kind = 'resume'`
      // unconditionally, so it says why a row is outstanding and never what it is.
      return res(200, { claimed: true, run_id: id, tenant_id: w.tenant_id, kind: w.kind, attempts: w.attempts,
        executor: w.executor ?? "agent",
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
      if (!["started", "model", "tool", "stopped", "step"].includes(entry.kind)) {
        return res(400, { code: "23514", message: 'new row violates check constraint "entry_kind_known"' });
      }
      const wantsStep = entry.kind === "model" || entry.kind === "tool" || entry.kind === "step";
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

    // ── the automation side ─────────────────────────────────────────────────

    if (p.endsWith("/automation_runs") && init.method === "GET") {
      const id = eq("id"), tenant = eq("tenant_id");
      const rows = [...execs.values()].filter((e) =>
        (id === null || e.id === id) && (tenant === null || e.tenant_id === tenant));
      return res(200, rows);
    }

    /**
     * `agent.accept_automation_run`, answer for answer.
     *
     * THE ORDER IS THE SECURITY ARGUMENT and it is the function's: whose automation is
     * this and is its agent taking work → has this occurrence already been filed →
     * disabled → paused → insert → accept the run → say which executor wants it.
     *
     * ⚠ **NOTHING IS WRITTEN ON EITHER REFUSAL.** A disabled automation and a paused
     * agent both have to leave the world exactly as it was, or turning one back on
     * would find work nobody asked for waiting in the queue.
     */
    if (p.endsWith("/rpc/accept_automation_run") && init.method === "POST") {
      const { p_tenant: tenant, p_automation_id: autoId, p_run_id: runId, p_trigger: trigger,
              p_occurrence: occ = null, p_input: given = {},
              p_event_id: eventId = null, p_event_depth: eventDepth = 0 } = body;
      if (typeof tenant !== "string" || tenant.trim() === "") return res(400, { message: "accept_automation_run: tenant must be a non-empty string" });
      if (!isText(runId)) return res(400, { message: "accept_automation_run: the execution needs a run id" });
      if (!["manual", "schedule", "event"].includes(trigger)) return res(400, { message: "accept_automation_run: a run is triggered manually, by a schedule or by an event" });
      const a = autos.get(autoId);
      if (!a || a.tenant_id !== tenant) return res(200, { ok: false, error: "no-automation" });
      const g = agents.get(a.agent_id);

      /**
       * ⚠ **AN EXECUTION HAS TWO IDENTITIES AND WHICH ONE APPLIES DEPENDS ON WHO ASKED.** An
       * occurrence is the SCHEDULE's; an event id is the EVENT's — `automation_runs_one_per_event`
       * — and a manual run has neither, which is why two presses are two executions.
       */
      let exec = occ === null ? null : [...execs.values()].find((e) => e.automation_id === autoId && e.occurrence === occ) ?? null;
      if (!exec && eventId !== null) {
        exec = [...execs.values()].find((e) => e.automation_id === autoId && e.event_id === eventId) ?? null;
      }
      let fresh = false;
      if (!exec) {
        if (!a.enabled) return res(200, { ok: false, error: "disabled" });
        if ((g?.status ?? null) !== "active") return res(200, { ok: false, error: "paused", status: g?.status ?? null });

        // THE INPUT, AGAINST WHAT THIS AUTOMATION SAYS IT ASKS FOR — the function's own
        // three refusals, in its own order, each writing nothing.
        const decl = Array.isArray(a.inputs) ? a.inputs : [];
        for (const k of Object.keys(given ?? {})) {
          if (!decl.some((d) => d?.name === k)) return res(200, { ok: false, error: "unknown-input", name: k });
          if (typeof given[k] !== "string") return res(200, { ok: false, error: "bad-input", name: k });
        }
        const vars = {};
        for (const d of decl) {
          if (!d || typeof d !== "object" || typeof d.name !== "string") return res(200, { ok: false, error: "bad-inputs" });
          const v = Object.hasOwn(given ?? {}, d.name) ? given[d.name] : (d.default ?? "");
          if (d.required === true && String(v).trim() === "") return res(200, { ok: false, error: "missing-input", name: d.name });
          vars[d.name] = String(v);
        }
        // EVERY MEMORY WITH ITS VERSION, read in this transaction — which is what makes a
        // correction reach the next execution and never this one.
        const snap = {};
        for (const m of mem.values()) {
          if (m.tenant_id === tenant && m.agent_id === a.agent_id) snap[m.key] = { value: m.value, version: m.version };
        }
        exec = {
          id: runId, automation_id: autoId, agent_id: a.agent_id, tenant_id: tenant, trigger, occurrence: occ,
          // THE SNAPSHOT. What runs is the configuration recorded HERE, which is what
          // makes an edit reach the next execution and never this one.
          steps: a.steps, zone: a.zone, outcomes: [], missed: null, finished_at: null,
          position: 0, vars, input: given ?? {}, memory: snap,
          waiting: null, wait_until: null, decisions: {},
          // WHAT IT HAS HEARD, AND WHICH EVENT STARTED IT. `{}` and `null` are the columns' own
          // defaults, and a fake answering `undefined` would let a store that had stopped reading
          // them look correct — the row reads as "nothing heard" either way.
          heard: {}, event_id: eventId, event_depth: eventDepth,
          // ⚠ THE COLUMNS' OWN DEFAULTS, and they are here because a fake that answered
          // `undefined` for them would let a store which had stopped reading them look
          // correct — the row read as a loop at its beginning either way.
          loops: {}, tries: {}, uses: [],
          created_at: new Date(now()).toISOString(),
        };
        execs.set(runId, exec);
        fresh = true;
      }
      // AN OCCURRENCE ALREADY FILED STARTS NOTHING — one copy of this answer, so the
      // probe and a racing twin cannot disagree.
      if (!fresh) return res(200, { ok: true, repeat: true, run_id: exec.id, occurrence: exec.occurrence, trigger: exec.trigger });

      runs.set(runId, { id: runId, tenant_id: tenant, status: "new", agent_name: null, model: null, limits: null, stop: null, created_at: "2026-09-15T00:00:00Z" });
      entries.set(runId, new Map());
      const entry = { kind: "started", at: now(), tenant, agent: "automation", model: "none", prompt: a.name, automation: autoId };
      entries.get(runId).set(0, entry);
      project(runId, entry);
      work.set(runId, { run_id: runId, tenant_id: tenant, kind: "start", enqueued_at: now(), attempts: 0,
        claimed_by: null, claimed_at: null, lease_expires_at: null, claim_token: null, done_at: null, last_error: null,
        // ⚠ IN THE SAME TRANSACTION as the work row, so there is no instant at which a
        // consumer could claim this row and route it to the agent loop.
        executor: "automation" });
      return res(200, { ok: true, repeat: false, run_id: runId, occurrence: exec.occurrence, trigger: exec.trigger, state: "queued" });
    }

    /** `agent.record_automation_occurrence` — a finished run with NO work row. */
    const recordOccurrence = (tenant, autoId, runId, occ, stop, missed) => {
      const a = autos.get(autoId);
      execs.set(runId, { id: runId, automation_id: autoId, agent_id: a?.agent_id ?? null,
        tenant_id: tenant, trigger: "schedule",
        occurrence: occ, steps: a?.steps ?? [], zone: a?.zone ?? null, outcomes: [], missed: missed ?? null,
        finished_at: new Date(now()).toISOString(),
        position: 0, vars: {}, input: {}, memory: {}, waiting: null, wait_until: null, decisions: {},
        loops: {}, tries: {}, uses: [],
        created_at: new Date(now()).toISOString() });
      runs.set(runId, { id: runId, tenant_id: tenant, status: "stopped", agent_name: "automation", model: "none",
        limits: null, stop, created_at: "2026-09-15T00:00:00Z" });
      entries.set(runId, new Map([
        [0, { kind: "started", at: now(), tenant, agent: "automation", model: "none", prompt: a?.name ?? "", automation: autoId }],
        [1, { kind: "stopped", at: now(), stop }],
      ]));
    };

    /** `agent.finish_automation_run` — the outcomes and the stop, through the fence. */
    if (p.endsWith("/rpc/finish_automation_run") && init.method === "POST") {
      const { p_run_id: id, p_worker: worker, p_token: token, p_outcomes: outcomes, p_stop: stop,
              p_position: pos = 0, p_vars: vars = {} } = body;
      if (!stop || typeof stop.reason !== "string") return res(400, { message: "finish_automation_run: an execution must say why it ended" });
      if (!Array.isArray(outcomes)) return res(400, { message: "finish_automation_run: the outcomes must be a list, one per step attempted" });
      const log = entries.get(id) ?? new Map();
      const seq = log.size === 0 ? 0 : Math.max(...log.keys()) + 1;
      // THROUGH `append_entry` ITSELF, never past it: the fence is what makes a
      // finish exclusive, and a fixture that wrote around it would be proving a
      // path that does not ship.
      const fenced = await fetch(`${u.origin}/rest/v1/rpc/append_entry`, {
        method: "POST", headers: init.headers,
        body: JSON.stringify({ p_run_id: id, p_seq: seq, p_worker: worker, p_token: token,
          p_body: { kind: "stopped", at: now(), stop } }),
      });
      const answer = JSON.parse(await fenced.text());
      if (answer?.ok !== true) return res(200, answer);
      const exec = execs.get(id);
      if (exec && exec.finished_at === null) {
        exec.outcomes = outcomes;
        exec.finished_at = new Date(now()).toISOString();
        exec.position = Math.max(exec.position ?? 0, Number.isInteger(pos) ? pos : 0);
        exec.vars = vars && typeof vars === "object" ? vars : exec.vars;
        // ⚠ THE PAUSE IS CLEARED, and it is not tidying: a finished execution still
        // carrying a deadline is one the scheduler would re-queue every minute for ever,
        // and a CHECK on the real table refuses the row that would say so.
        exec.waiting = null; exec.wait_until = null;
      }
      const w = work.get(id);
      if (w && w.claimed_by === worker && w.claim_token === token) {
        w.claimed_by = null; w.claimed_at = null; w.lease_expires_at = null; w.claim_token = null; w.done_at = now();
      }
      return res(200, { ...answer, finished: true });
    }

    /**
     * `agent.advance_automation_run` — one step's progress, fenced, in one transaction.
     *
     * **THROUGH `append_entry` ITSELF, never past it**, exactly as `finish` is: the fence is
     * the one wall that keeps two workers off a run, and a fixture that wrote around it
     * would be proving a path that does not ship.
     */
    if (p.endsWith("/rpc/advance_automation_run") && init.method === "POST") {
      const { p_run_id: id, p_worker: worker, p_token: token, p_entry: entry,
              p_position: pos, p_vars: vars, p_outcomes: outcomes, p_waiting: waiting = null,
              p_loops: loops = {}, p_tries: tries = {} } = body;
      if (!entry || entry.kind !== "step") return res(400, { message: 'advance_automation_run: a step\'s progress is recorded as a "step" entry' });
      if (!Array.isArray(outcomes)) return res(400, { message: "advance_automation_run: the outcomes must be a list, one per step attempted" });
      if (!vars || typeof vars !== "object" || Array.isArray(vars)) return res(400, { message: "advance_automation_run: the values must be an object of name to value" });
      if (!Number.isInteger(pos) || pos < 0) return res(400, { message: "advance_automation_run: the position must be a whole number of steps" });
      if (waiting !== null && (typeof waiting !== "object" || typeof waiting.step !== "string")) {
        return res(400, { message: "advance_automation_run: a pause has to say which step it is waiting at" });
      }
      // ⚠ CANNOT-TELL MUST NEVER READ AS A VALUE, exactly as the function refuses it: a null
      // loop state is a caller that did not say, and writing `{}` for it would tell the next
      // delivery that a loop half way through its rounds is at its beginning.
      if (!loops || typeof loops !== "object" || Array.isArray(loops)) {
        return res(400, { message: "advance_automation_run: the loop state must be an object of step id to progress" });
      }
      if (!tries || typeof tries !== "object" || Array.isArray(tries)) {
        return res(400, { message: "advance_automation_run: the attempt counts must be an object of step key to count" });
      }
      const log = entries.get(id) ?? new Map();
      const seq = log.size === 0 ? 0 : Math.max(...log.keys()) + 1;
      const fenced = await fetch(`${u.origin}/rest/v1/rpc/append_entry`, {
        method: "POST", headers: init.headers,
        body: JSON.stringify({ p_run_id: id, p_seq: seq, p_worker: worker, p_token: token, p_body: entry }),
      });
      const answer = JSON.parse(await fenced.text());
      if (answer?.ok !== true) return res(200, answer);

      const exec = execs.get(id);
      if (!exec) return res(200, { ...answer, advanced: false, why: "no-execution" });

      let until = null;
      if (waiting !== null) {
        // ⚠ A RE-PAUSE KEEPS THE DEADLINE IT ALREADY HAS, or a spurious delivery would
        // extend a wait for ever — a duplicate event doing harm.
        if (exec.wait_until !== null && exec.waiting?.step === waiting.step) until = exec.wait_until;
        else if (waiting.kind === "approval") until = new Date(now() + Math.max(1, Number(waiting.hours) || 1) * 3600e3).toISOString();
        else if (waiting.mode === "until") until = untilLocal(waiting.at, exec.zone);
        else until = new Date(now() + Math.max(1, Number(waiting.minutes) || 1) * 60e3).toISOString();
      }

      // ⚠ **THE OUTCOME COUNT IS WHAT MAY ONLY GROW, and the POSITION is free** — a `repeat`
      // moves it backwards by design, and a guard on it made every checkpoint inside round two
      // a silent no-op. The real function's own condition, mirrored.
      const moved = exec.finished_at === null
        && (Array.isArray(exec.outcomes) ? exec.outcomes.length : 0) <= outcomes.length;
      if (moved) {
        exec.position = pos; exec.vars = vars; exec.outcomes = outcomes;
        exec.waiting = waiting; exec.wait_until = until;
        exec.loops = loops; exec.tries = tries;
      }
      let released = null;
      if (waiting !== null) {
        const w = work.get(id);
        released = !!(w && w.claimed_by === worker && w.claim_token === token && (w.lease_expires_at ?? 0) > now());
        if (released) {
          w.claimed_by = null; w.claimed_at = null; w.lease_expires_at = null; w.claim_token = null; w.done_at = now();
        }
      }
      return res(200, { ...answer, advanced: moved, position: pos, waiting: waiting !== null, wait_until: until, released });
    }

    /**
     * `agent.emit_event` — one event, absorbed by its key.
     *
     * **THE FAKE IS AS CAPABLE AS THE FUNCTION IN THE ONE THING THE PRODUCT TURNS ON**: the key
     * is what makes a retried delivery one event, so the absorb is here and answers the WINNER's
     * id. What is deliberately NOT here is the depth arithmetic off the emitting run's own row —
     * that is proved on a real PostgreSQL, and a JavaScript copy of it would be a second version
     * of the one thing the database is the authority on.
     */
    if (p.endsWith("/rpc/emit_event") && init.method === "POST") {
      const { p_tenant: tenant, p_agent_id: agentId, p_id: id, p_name: name,
        p_payload: payload, p_source: source, p_key: key } = body;
      if (typeof key === "string" && key !== "") {
        const twin = [...events.values()].find((e) =>
          e.tenant_id === tenant && e.name === name && e.event_key === key);
        if (twin) return res(200, { ok: true, repeat: true, event_id: twin.id, name, depth: twin.depth ?? 0 });
      }
      events.set(id, {
        id, tenant_id: tenant, agent_id: agentId ?? null, name,
        payload: payload ?? {}, source: source ?? "person", event_key: key ?? null,
        depth: 0, at: now(), handled_at: null,
      });
      return res(200, { ok: true, repeat: false, event_id: id, name, depth: 0 });
    }

    /**
     * `agent.dispatch_events` — file what an event triggers, and wake what waited for it.
     *
     * ONE ANSWER PER EVENT, carrying `ring` — every run the event touched — because an event can
     * file a trigger AND wake a waiter, and a caller ringing only the first would leave the other
     * for the sweeper.
     */
    if (p.endsWith("/rpc/dispatch_events") && init.method === "POST") {
      const limit = Number.isInteger(body?.p_limit) ? body.p_limit : 25;
      const out = [];
      for (const e of [...events.values()].filter((x) => x.handled_at === null).slice(0, limit)) {
        const ring = [];
        let filed = 0, woke = 0;
        /**
         * ⚠ **IT CALLS THE ACCEPT RATHER THAN REIMPLEMENTING IT, exactly as the real function
         * does — and the first draft of this fake reimplemented it and cost a debugging round.**
         * The accept writes the run row, its FIRST JOURNAL ENTRY and the work row together; a
         * copy here wrote two of the three and the filed execution then claimed, ran and never
         * finished, for a reason that had nothing to do with events. *One producer of one shape*,
         * which is the same argument `accept_run` makes about its own three inserts.
         */
        for (const a of [...autos.values()].filter((x) =>
          x.tenant_id === e.tenant_id && x.agent_id === e.agent_id && x.enabled && x.on_event === e.name)) {
          const accepted = await fetch(`${u.origin}/rest/v1/rpc/accept_automation_run`, {
            method: "POST", headers: init.headers,
            body: JSON.stringify({
              p_tenant: e.tenant_id, p_automation_id: a.id, p_run_id: `ev-${e.id}-${a.id}`,
              p_trigger: "event", p_occurrence: null, p_input: {},
              p_event_id: e.id, p_event_depth: e.depth ?? 0,
            }),
          });
          const answer = JSON.parse(await accepted.text());
          if (answer?.ok === true) { filed += 1; ring.push(answer.run_id); }
        }
        // ⚠ AND WHAT WAS WAITING: `heard ? step` is what makes it exactly once, and the re-queue
        // is what makes it reach anybody — a `heard` written with the work row left done is the
        // stranding the real function had to be corrected for.
        for (const x of [...execs.values()].filter((v) =>
          v.tenant_id === e.tenant_id && v.agent_id === e.agent_id && v.finished_at === null
          && v.waiting?.kind === "event" && v.waiting?.name === e.name
          && !Object.hasOwn(v.heard ?? {}, v.waiting?.step))) {
          x.heard = { ...(x.heard ?? {}), [x.waiting.step]: { event_id: e.id, name: e.name, payload: e.payload, at: e.at } };
          const w = work.get(x.id);
          if (w) { w.done_at = null; w.claimed_by = null; w.claim_token = null; w.lease_expires_at = null; w.attempts = 0; }
          woke += 1; ring.push(x.id);
        }
        e.handled_at = now();
        out.push({ event_id: e.id, name: e.name, filed, woke, ring });
      }
      return res(200, out);
    }

    /**
     * `agent.hear_pending_event` — the arrival race's other half.
     *
     * **IT PUTS THE WORK BACK, in the same answer**, because that is the half the real function
     * was missing: a `heard` written against a run whose work row is done reaches nobody.
     */
    if (p.endsWith("/rpc/hear_pending_event") && init.method === "POST") {
      const { p_run_id: id, p_tenant: tenant } = body;
      const x = execs.get(id);
      if (!x || x.tenant_id !== tenant) return res(200, { ok: false, error: "no-execution" });
      if (x.finished_at !== null) return res(200, { ok: true, heard: false, why: "finished" });
      if (x.waiting?.kind !== "event") return res(200, { ok: true, heard: false, why: "not-waiting-for-an-event" });
      if (Object.hasOwn(x.heard ?? {}, x.waiting.step)) return res(200, { ok: true, heard: false, why: "already" });
      const since = Date.parse(x.waiting.since ?? x.created_at ?? 0);
      const found = [...events.values()]
        .filter((e) => e.tenant_id === tenant && e.agent_id === x.agent_id && e.name === x.waiting.name
          && Date.parse(e.at) >= since)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
      if (!found) return res(200, { ok: true, heard: false, why: "nothing-yet" });
      x.heard = { ...(x.heard ?? {}), [x.waiting.step]: { event_id: found.id, name: found.name, payload: found.payload, at: found.at } };
      const w = work.get(id);
      if (w) { w.done_at = null; w.claimed_by = null; w.claim_token = null; w.lease_expires_at = null; w.attempts = 0; }
      return res(200, { ok: true, heard: true, event_id: found.id, name: found.name, queued: "queued" });
    }

    /**
     * `agent.automation_children` — every automation of ONE agent, as a parent copies it in.
     *
     * **THE SCOPE IS THE WALL AND IT IS THE QUERY'S**, so both filters are here: the tenant
     * AND the agent. Two agents of one owner share a tenant, so a tenant filter alone would
     * let one agent's workflow run the other's.
     */
    if (p.endsWith("/rpc/automation_children") && init.method === "POST") {
      const { p_tenant: tenant, p_agent_id: agentId } = body;
      const rows = [...autos.values()]
        .filter((a) => a.tenant_id === tenant && a.agent_id === agentId)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map((a) => ({ id: a.id, name: a.name, version: a.version ?? 1, steps: a.steps ?? [], inputs: a.inputs ?? [] }));
      return res(200, rows);
    }

    /**
     * `agent.set_automation_plan` — the flattened plan, once, before the first step.
     *
     * **THE SAME FENCE EVERY WRITE PRESENTS**, refusal for refusal, and `set: false` is NOT
     * one of them: a redelivery whose first attempt already expanded finds the position
     * moved, which is the ordinary case rather than a fault.
     */
    if (p.endsWith("/rpc/set_automation_plan") && init.method === "POST") {
      const { p_run_id: id, p_worker: worker, p_token: token, p_steps: steps, p_uses: uses } = body;
      if (!Array.isArray(steps)) return res(400, { message: "set_automation_plan: the flattened steps must be a list" });
      if (!Array.isArray(uses)) return res(400, { message: "set_automation_plan: what was copied in must be a list" });
      const w = work.get(id);
      if (!w) return res(200, { ok: false, error: "no-work" });
      if (w.done_at !== null) return res(200, { ok: false, error: "finished" });
      if (w.claimed_by !== worker) return res(200, { ok: false, error: "not-holder" });
      if (w.claim_token !== token) return res(200, { ok: false, error: "bad-token" });
      if (w.lease_expires_at === null || w.lease_expires_at <= now()) {
        return res(200, { ok: false, error: "lease-expired" });
      }
      const exec = execs.get(id);
      const ok = !!exec && exec.finished_at === null && (exec.position ?? 0) === 0;
      if (ok) { exec.steps = steps; exec.uses = uses; }
      return res(200, { ok: true, set: ok, steps: steps.length });
    }

    /**
     * `agent.decide_automation_approval` — answer one waiting approval, once.
     *
     * The tenant is in the LOOKUP, so another account's execution and one that does not
     * exist are the same answer. The first decision stands; a second press is absorbed.
     */
    if (p.endsWith("/rpc/decide_automation_approval") && init.method === "POST") {
      const { p_tenant: tenant, p_run_id: id, p_step: step, p_verdict: verdict, p_note: note = null, p_by: by = null } = body;
      if (!isText(tenant)) return res(400, { message: "decide_automation_approval: tenant must be a non-empty string" });
      if (!["approved", "rejected"].includes(verdict)) return res(400, { message: 'decide_automation_approval: a decision is "approved" or "rejected"' });
      if (!isText(step)) return res(400, { message: "decide_automation_approval: say which step is being answered" });
      const exec = execs.get(id);
      if (!exec || exec.tenant_id !== tenant) return res(200, { ok: false, error: "no-execution" });
      if (exec.finished_at !== null) return res(200, { ok: false, error: "finished" });
      if (!exec.waiting || exec.waiting.kind !== "approval" || exec.waiting.step !== step) {
        return res(200, { ok: false, error: "not-waiting", waiting_for: exec.waiting?.step ?? null, kind: exec.waiting?.kind ?? null });
      }
      const had = exec.decisions?.[step] ?? null;
      if (!had) {
        exec.decisions = { ...(exec.decisions ?? {}), [step]: {
          verdict, ...(isText(note) ? { note: note.trim() } : {}), by: by ?? tenant,
          at: new Date(now()).toISOString(),
        } };
      }
      const w = work.get(id);
      let state = "not-found";
      if (w) {
        if (w.claimed_by !== null && (w.lease_expires_at ?? 0) > now()) state = "running";
        else { w.kind = "resume"; w.done_at = null; w.enqueued_at = now(); w.attempts = 0; w.last_error = null; state = "queued"; }
      }
      return res(200, { ok: true, repeat: had !== null, verdict: had?.verdict ?? verdict, step, queued: state });
    }

    /** `agent.resume_due_automations` — put every suspended execution whose time has come back. */
    if (p.endsWith("/rpc/resume_due_automations") && init.method === "POST") {
      const limit = Math.max(1, Number(body.p_limit) || 25);
      const due = [...execs.values()]
        .filter((e) => e.waiting !== null && e.finished_at === null && e.wait_until !== null && Date.parse(e.wait_until) <= now())
        .sort((a, b) => Date.parse(a.wait_until) - Date.parse(b.wait_until))
        .slice(0, limit);
      const out = [];
      for (const e of due) {
        const w = work.get(e.id);
        let state = "not-found";
        if (w) {
          if (w.claimed_by !== null && (w.lease_expires_at ?? 0) > now()) state = "running";
          else { w.kind = "resume"; w.done_at = null; w.enqueued_at = now(); w.attempts = 0; w.last_error = null; state = "queued"; }
        }
        out.push({ run_id: e.id, kind: e.waiting.kind, step: e.waiting.step, due_at: e.wait_until, action: state });
      }
      return res(200, out);
    }

    /** `agent.search_knowledge` — a substring stand-in for the real tsvector search. */
    if (p.endsWith("/rpc/search_knowledge") && init.method === "POST") {
      const { p_tenant: tenant, p_agent_id: agentId, p_query: query, p_limit: limit = 5 } = body;
      if (!isText(tenant)) return res(400, { message: "search_knowledge: tenant must be a non-empty string" });
      // NOTHING SEARCHED FOR IS NOTHING FOUND, and it is not every document.
      if (!isText(query)) return res(200, []);
      const words = String(query).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
      if (!words.length) return res(200, []);
      const hits = [...know.values()]
        .filter((k) => k.tenant_id === tenant && k.agent_id === agentId)
        .map((k) => {
          const hay = `${k.title} ${k.body}`.toLowerCase();
          const n = words.filter((w) => hay.includes(w)).length;
          return { k, n };
        })
        .filter((h) => h.n > 0)
        .sort((a, b) => b.n - a.n || a.k.title.toLowerCase().localeCompare(b.k.title.toLowerCase()))
        .slice(0, Math.max(1, Number(limit) || 5));
      return res(200, hits.map(({ k, n }) => ({
        id: k.id, title: k.title, version: k.version, format: k.format,
        text: k.body.slice(0, 200), rank: n,
      })));
    }

    /** `agent.request_tool_approval` — record that one tool call is waiting for a person.
     *
     * ⚠ IDEMPOTENT, AND THE IDENTITY IS `(run, step, idx)` — the partial unique key, which
     * is what makes a redelivery find the FIRST request rather than make a second one for
     * somebody to answer twice. The arguments are REPORTED against the stored hash and
     * never written over it: the row is what a person was shown and may already have
     * answered. Both properties are proved on a real engine in `test/integration/pg-schema.mjs`;
     * what this stands in for is the PROTOCOL.
     */
    if (p.endsWith("/rpc/request_tool_approval") && init.method === "POST") {
      const { p_tenant: tenant, p_run_id: runId, p_agent_id: agentId,
              p_step: step, p_idx: idx, p_tool: tool, p_args: args, p_hash: hash } = body;
      const run = runs.get(runId);
      if (!run || run.tenant_id !== tenant) return res(200, { ok: false, error: "no-run" });
      const key = `${runId}:${step}:${idx}`;
      if (!approvals.has(key)) {
        approvals.set(key, {
          id: `ap-${approvals.size + 1}`, tenant_id: tenant, run_id: runId, agent_id: agentId ?? null,
          step, idx, tool, args: args ?? {}, args_hash: hash,
          verdict: null, note: null, decided_by: null, requested_at: "2026-09-17T00:00:00Z",
        });
      }
      const row = approvals.get(key);
      return res(200, {
        ok: true, id: row.id, tool: row.tool, verdict: row.verdict, note: row.note,
        args_hash: row.args_hash, matches: row.args_hash === hash, requested_at: row.requested_at,
      });
    }

    /** `agent.revoked_tools` — which tools have been taken away from one agent.
     *
     * ⚠ A SET-RETURNING FUNCTION, SO THE ANSWER IS A BARE LIST OF STRINGS, which is the shape
     * `revokedTools` refuses anything else in favour of. Answering `[]` for an agent this
     * account does not own is the real function's own behaviour (the row is keyed on both), and
     * it is the fail-closed direction here: a revocation can only ever subtract.
     */
    if (p.endsWith("/rpc/revoked_tools") && init.method === "POST") {
      const { p_tenant: tenant, p_agent_id: agentId } = body;
      const a = agents.get(agentId);
      if (!a || a.tenant_id !== tenant) return res(200, []);
      return res(200, [...revocations]
        .filter((k) => k.split("\u0000")[0] === agentId)
        .map((k) => k.split("\u0000")[1]).sort());
    }

    /** `agent.revoke_agent_tool` — take one tool away now, and withdraw what waits for it.
     *
     * ⚠ THE SECOND HALF IS NOT OPTIONAL AND IS MIRRORED HERE: leaving a request pending would
     * let somebody approve a call the permission for which has just been withdrawn, which is
     * the approval and the permission disagreeing with the approval winning.
     */
    if (p.endsWith("/rpc/revoke_agent_tool") && init.method === "POST") {
      const { p_tenant: tenant, p_agent_id: agentId, p_tool: tool, p_by: by, p_note: note } = body;
      if (!by || !String(by).trim()) return res(200, { ok: false, error: "no-decider" });
      if (typeof tool !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(tool)) {
        return res(200, { ok: false, error: "bad-tool" });
      }
      const a = agents.get(agentId);
      if (!a || a.tenant_id !== tenant) return res(200, { ok: false, error: "no-agent" });
      revocations.add(`${agentId}\u0000${tool}`);
      let withdrew = 0;
      const put = [];
      for (const row of approvals.values()) {
        if (row.tenant_id === tenant && row.agent_id === agentId && row.tool === tool && row.verdict === null) {
          row.verdict = "revoked";
          row.decided_by = by;
          row.note = note ?? "the permission for this tool was withdrawn";
          withdrew++;
          // ⚠ AND THE RUN IS PUT BACK, mirrored rather than skipped: the revocation has just
          // answered that request instead of a person, and a run whose work row stays done is
          // a run stranded for ever. A fake that withdrew the request and left the row is the
          // exact defect the real function had until it was driven.
          const w = work.get(row.run_id);
          if (w && !(w.claimed_by && Date.parse(w.lease_expires_at ?? 0) > Date.now())) {
            w.kind = "resume"; w.done_at = null; w.attempts = 0; w.last_error = null;
            put.push(row.run_id);
          }
        }
      }
      return res(200, { ok: true, tool, withdrew, runs: put });
    }

    /** `agent.requeue_expired_approvals` — put back every run nobody answered in time.
     *
     * ⚠ THE ONE SWEEP HERE THAT IS NOT TENANT-SCOPED, and the CONDITION is mirrored rather than
     * simplified: a run is offered only when it has already ENDED nothing and when NOTHING it is
     * waiting for may still be answered. A fake that offered a run holding one live request
     * would wake it every tick for ever, which is the defect the real condition exists to stop.
     */
    if (p.endsWith("/rpc/requeue_expired_approvals") && init.method === "POST") {
      const lim = Math.min(Math.max(body?.p_limit ?? 25, 1), 100);
      const now = Date.now();
      const open = (r) => r.verdict === null;
      const past = (r) => r.expires_at !== null && r.expires_at !== undefined && Date.parse(r.expires_at) <= now;
      const out = [];
      const seen = new Set();
      for (const row of approvals.values()) {
        if (!open(row) || !past(row) || seen.has(row.run_id)) continue;
        // ⚠ THE MAP'S VALUES ARE THE BODIES THEMSELVES here, not `{seq, body}` rows — the shape
        // this fake keeps internally. A `.body?.kind` read answers `undefined` for every entry
        // and would make "has it ended" always false.
        const ended = [...(entries.get(row.run_id)?.values() ?? [])].some((e) => e?.kind === "stopped");
        const stillAnswerable = [...approvals.values()].some((b) =>
          b.run_id === row.run_id && open(b) && !past(b));
        if (ended || stillAnswerable) continue;
        const w = work.get(row.run_id);
        if (!w) continue;
        seen.add(row.run_id);
        // ⚠ A ROW SOMEBODY IS HOLDING IS REPORTED AS `held`, NOT SKIPPED — the real function's
        // own shape. Skipping it here would leave the CALLER's filter (`action === 'requeued'`
        // before it rings) undrivable, because nothing would ever hand it a row to skip; a
        // sweep survivor is what said so. *A fake less capable than the thing it stands in for
        // hides a defect exactly as well as one that is more.*
        if (w.claimed_by && Date.parse(w.lease_expires_at ?? 0) > now) {
          out.push({ run: row.run_id, tenant: row.tenant_id, action: "held", state: "running" });
        } else {
          w.kind = "resume"; w.done_at = null; w.attempts = 0; w.last_error = null;
          out.push({ run: row.run_id, tenant: row.tenant_id, action: "requeued", state: "queued" });
        }
        if (out.length >= lim) break;
      }
      return res(200, out);
    }

    /** `agent.restore_agent_tool` — lift a revocation. It does NOT re-open what it withdrew. */
    if (p.endsWith("/rpc/restore_agent_tool") && init.method === "POST") {
      const { p_tenant: tenant, p_agent_id: agentId, p_tool: tool } = body;
      const a = agents.get(agentId);
      if (!a || a.tenant_id !== tenant) return res(200, { ok: false, error: "no-agent" });
      const had = revocations.delete(`${agentId}\u0000${tool}`);
      return res(200, { ok: true, tool, lifted: had });
    }

    /** `agent.list_memory` — one agent's remembered facts, by name.
     *
     * ⚠ THE OWNERSHIP TEST IS THE REAL FUNCTION'S OWN (`agent.owns_agent`), and it is
     * mirrored rather than skipped: a fixture that answered every agent's memories would
     * be MORE forgiving than the thing it stands in for, and the wall this serves as the
     * far end of is the one a capability tool is entirely made of.
     */
    if (p.endsWith("/rpc/list_memory") && init.method === "POST") {
      const { p_tenant: tenant, p_agent_id: agentId } = body;
      const a = agents.get(agentId);
      if (!a || a.tenant_id !== tenant) return res(200, []);
      return res(200, [...mem.values()]
        .filter((m) => m.tenant_id === tenant && m.agent_id === agentId)
        .sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0))
        .map((m) => ({ id: m.id, name: m.key, value: m.value, version: m.version, source: m.source })));
    }

    /** `agent.tick_automations` — file what is due, and advance past it.
     *
     * The advance is a plain day here rather than `automation_next_at`'s local-time
     * arithmetic (see the note above the maps). Every DECISION the cron reads is
     * mirrored: the catch-up window, which is what stops downtime becoming a burst;
     * `filed` versus `already`; and the refusals, recorded rather than skipped.
     */
    if (p.endsWith("/rpc/tick_automations") && init.method === "POST") {
      const catchup = Math.max(0, body?.p_catchup_s ?? 3600) * 1000;
      const limit = Math.max(1, body?.p_limit ?? 25);
      const due = [...autos.values()]
        .filter((a) => a.enabled && a.schedule === "daily" && a.next_run_at !== null && a.next_run_at <= now())
        .sort((x, y) => x.next_run_at - y.next_run_at)
        .slice(0, limit);
      const out = [];
      for (const a of due) {
        const occ = a.occurrence_for ?? new Date(a.next_run_at).toISOString().slice(0, 10);
        const next = a.next_run_at + 86400000;
        const runId = `auto-${a.id}-${occ}`;
        if (now() - a.next_run_at <= catchup) {
          const accepted = await fetch(`${u.origin}/rest/v1/rpc/accept_automation_run`, {
            method: "POST", headers: init.headers,
            body: JSON.stringify({ p_tenant: a.tenant_id, p_automation_id: a.id, p_run_id: runId, p_trigger: "schedule", p_occurrence: occ }),
          });
          const answer = JSON.parse(await accepted.text());
          if (answer?.ok === true) {
            out.push({ automation_id: a.id, occurrence: occ, run_id: answer.run_id,
              action: answer.repeat === true ? "already" : "filed" });
          } else {
            // ⚠ **A REFUSED OCCURRENCE CARRIES NO `run_id`**, exactly as the function
            // builds it: there is no work row, so a doorbell for one would ring for a
            // run nothing will ever claim.
            recordOccurrence(a.tenant_id, a.id, runId, occ, { reason: answer?.error ?? "error" }, null);
            out.push({ automation_id: a.id, occurrence: occ, action: answer?.error ?? "error" });
          }
        } else {
          // TOO OLD TO RUN: recorded, counted, and jumped over.
          const total = Math.max(1, Math.round((next - a.next_run_at) / 86400000));
          recordOccurrence(a.tenant_id, a.id, runId, occ, { reason: "missed", occurrences: total }, total);
          out.push({ automation_id: a.id, occurrence: occ, action: "missed", occurrences: total });
        }
        a.next_run_at = next;
      }
      return res(200, out);
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
  return { fetch: counted, runs, entries, work, agents, autos, execs, know, mem, approvals, events };
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

