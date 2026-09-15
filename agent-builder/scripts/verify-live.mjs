#!/usr/bin/env node
/**
 * VERIFY A DEPLOYED AGENT WORKER AGAINST ITS REAL DATABASE.
 *
 *   AGENT_URL=https://agent-builder-api.<sub>.workers.dev \
 *   AGENT_USER_EMAIL=… AGENT_USER_PASSWORD=… \
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SERVICE_KEY=… \
 *   node scripts/verify-live.mjs
 *
 * Five things, and every one of them is CHECKED rather than narrated:
 *
 *   1. a real customer signs in, starts the long stand-in task, is answered 202
 *      promptly, and can read progress and then the final result;
 *   2. a duplicate delivery and a simultaneous resume do not execute one run twice;
 *   3. an interrupted consumer is replaced by another that continues from saved
 *      progress, keeping the work already done — and an uncertain, non-repeatable
 *      action still refuses to be repeated;
 *   4. a consumer whose lease is gone cannot start new work or write to the log;
 *   5. **THE FENCE**: a paused holder whose lease has expired cannot write, a
 *      replacement claimed through a duplicate delivery can, and the same entry
 *      re-sent is absorbed while a DIFFERENT entry in the same slot is a conflict.
 *
 * **CHECK 5 IS THE BEFORE/AFTER, and it is deliberately not timing-dependent.** The
 * gap it closes was measured on the deployment of 2026-09-15: a consumer whose lease
 * was revoked kept writing for a further beat, because it only learns at its next
 * one. So the fence is proved by asking the database directly — claim, expire,
 * reclaim, then both parties write — which needs no pause and no luck, and asserts
 * out loud that the sweeper's grace has NOT expired when the replacement takes over.
 *
 * **HOW AN INTERRUPTION IS PRODUCED, SAID PLAINLY: the lease is revoked** with the
 * service key, which is exactly what the platform's own reclaim does to a consumer
 * that has died. What it does NOT reproduce is a consumer that dies mid-write; that
 * needs a real isolate to be killed at a chosen instant, and nothing here can do it.
 *
 * **THE SERVICE KEY IS READ FROM THE ENVIRONMENT, USED ONLY FOR THE QUEUE TABLE,
 * AND NEVER PRINTED.** The banner reports each setting's length.
 *
 * It also runs against the local stack (`npm run verify:local`), which is how the
 * script itself is exercised before anybody points it at a deployment. The only leg
 * that differs there is the sign-in: locally a token is supplied directly.
 */

const env = process.env;
const AGENT_URL = (env.AGENT_URL ?? "").replace(/\/+$/, "");
const SUPABASE_URL = (env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const PUB = env.SUPABASE_PUBLISHABLE_KEY ?? "";
const SVC = env.SUPABASE_SERVICE_KEY ?? "";
const SCHEMA = env.AGENT_SCHEMA ?? "agent";
/** How long to wait for the whole handover: a beat, then the grace, then a cron tick. */
const HANDOVER_MS = Number(env.HANDOVER_MS) || 300_000;
const STEP_MS = Number(env.POLL_MS) || 3_000;
/** How long to wait for a queue to re-offer work after a refusal. */
const SETTLE_MS = Number(env.SETTLE_MS) || 90_000;
/** The floor check 1 holds the long task to. Lowered only by a local driver. */
const MIN_LONG_MS = Number(env.MIN_LONG_MS) || 60_000;

let failed = 0;
const results = [];
const check = (what, cond, detail = "") => {
  if (!cond) failed++;
  results.push({ what, ok: !!cond, detail });
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};
const head = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 68 - t.length))}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isText = (v) => typeof v === "string" && v.trim() !== "";

if (!AGENT_URL || !SUPABASE_URL || !SVC) {
  console.error("need AGENT_URL, SUPABASE_URL and SUPABASE_SERVICE_KEY");
  process.exit(2);
}
console.log("settings:");
for (const [k, v] of [["AGENT_URL", AGENT_URL], ["SUPABASE_URL", SUPABASE_URL],
                      ["SUPABASE_PUBLISHABLE_KEY", PUB], ["SUPABASE_SERVICE_KEY", SVC]]) {
  console.log(`  ${k.padEnd(26)} ${k.endsWith("URL") ? v : v ? `set (${v.length} chars)` : "not set"}`);
}

// ── the backend's own view of the queue, for the interruption ────────────────
const rest = async (method, path, { body, prefer } = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SVC, authorization: `Bearer ${SVC}`, "content-type": "application/json",
      [method === "GET" ? "accept-profile" : "content-profile"]: SCHEMA,
      ...(prefer ? { prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return parsed;
};
const workRow = async (runId) =>
  (await rest("GET", `run_work?run_id=eq.${runId}&select=run_id,tenant_id,kind,attempts,claimed_by,lease_expires_at,done_at,last_error`))?.[0] ?? null;
const entryKinds = async (runId) =>
  (await rest("GET", `run_entries?run_id=eq.${runId}&select=seq,body&order=seq.asc`) ?? []).map((r) => r.body.kind);
const entriesOf = async (runId) =>
  (await rest("GET", `run_entries?run_id=eq.${runId}&select=seq,body&order=seq.asc`) ?? []).map((r) => r.body);
/** Revoke the lease. This is what a dead consumer looks like from the outside. */
const revokeLease = (runId) =>
  rest("PATCH", `run_work?run_id=eq.${runId}`, { body: { lease_expires_at: new Date(Date.now() - 60_000).toISOString() } });

// ── who is asking ───────────────────────────────────────────────────────────
let token = env.AGENT_USER_TOKEN ?? "";
let tenant = null;
head("0. the deployment, and a real customer");

const healthRes = await fetch(`${AGENT_URL}/health`);
const healthBody = await healthRes.json().catch(() => ({}));
check("GET /health answers", healthRes.ok, `HTTP ${healthRes.status}`);
check("the deployment is configured", healthBody.ok === true, JSON.stringify(healthBody.missing ?? []));
check("it is running the stand-in", healthBody.model === "stand-in", `model: ${healthBody.model}`);
check("both verification agents are registered",
  Array.isArray(healthBody.agents) && healthBody.agents.includes("slow") && healthBody.agents.includes("guarded"),
  JSON.stringify(healthBody.agents ?? []));
const VERSION = healthBody.version ?? "(no version metadata binding)";
console.log(`      version:   ${VERSION}`);
console.log(`      deployed:  ${healthBody.deployedAt ?? "—"}`);

/**
 * A THROWAWAY CUSTOMER, created server-side and deleted afterwards.
 *
 * **NO EMAIL IS SENT.** `email_confirm: true` on the admin API creates a confirmed
 * user outright, which is the difference between this and an ordinary sign-up —
 * an earlier round of this work consumed one of the project's 200 daily sends by
 * signing up the normal way, and that is a cost a verification has no business
 * incurring.
 *
 * It exists because the verification's first claim is "a real customer signs in",
 * and that cannot be shown with a token minted here. Only used when no credentials
 * were supplied; the id is reported so it can be removed even if this run dies.
 */
const VERIFY_EMAIL_PREFIX = "agent-verify-";
let madeUser = null;
if (!token && !env.AGENT_USER_EMAIL) {
  const email = `${VERIFY_EMAIL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SVC, authorization: `Bearer ${SVC}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const body = await r.json().catch(() => ({}));
  check("a throwaway customer is created without sending mail", r.ok && isText(body.id),
    r.ok ? `id ${body.id}` : `HTTP ${r.status} ${JSON.stringify(body).slice(0, 160)}`);
  if (!r.ok) { console.log("\ncannot continue without a customer"); process.exit(1); }
  madeUser = { id: body.id, email };
  console.log(`      created:   ${email}`);
  env.AGENT_USER_EMAIL = email;
  env.AGENT_USER_PASSWORD = password;
}

if (!token) {
  // A REAL SIGN-IN, not a token minted here. That is the whole point of the leg.
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: PUB, "content-type": "application/json" },
    body: JSON.stringify({ email: env.AGENT_USER_EMAIL, password: env.AGENT_USER_PASSWORD }),
  });
  const body = await r.json().catch(() => ({}));
  check("a real customer signs in", r.ok && typeof body.access_token === "string",
    r.ok ? "" : `HTTP ${r.status} ${JSON.stringify(body).slice(0, 160)}`);
  if (!r.ok) { console.log("\ncannot continue without a signed-in customer"); process.exit(1); }
  token = body.access_token;
} else {
  check("a customer token was supplied", true, "AGENT_USER_TOKEN (the sign-in leg is skipped)");
}
// The tenant, read out of the token the way the Worker reads it.
try {
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  tenant = claims.tenant_id ?? claims.sub ?? null;
} catch { /* left null */ }
check("the token names a tenant", typeof tenant === "string" && tenant !== "", `tenant: ${tenant}`);

const auth = { authorization: `Bearer ${token}` };
const api = async (method, path, body) => {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method, headers: { ...auth, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
  return { status: res.status, body: parsed, text };
};
const start = async (agent, prompt) => {
  const t0 = Date.now();
  const r = await api("POST", "/runs", { agent, prompt });
  return { ...r, ms: Date.now() - t0 };
};
const view = async (runId) => (await api("GET", `/runs/${runId}`)).body;

/** Poll until `done(v)` or the budget runs out. Reports every change it saw. */
async function watch(runId, done, budgetMs, label) {
  const seen = [];
  const t0 = Date.now();
  let v = null;
  while (Date.now() - t0 < budgetMs) {
    v = await view(runId);
    const last = seen[seen.length - 1];
    if (!last || last.steps !== v?.steps || last.status !== v?.status) {
      seen.push({ at: Date.now() - t0, steps: v?.steps, status: v?.status });
      if (label) console.log(`      +${String(Date.now() - t0).padStart(7)} ms  ${label} status=${String(v?.status).padEnd(8)} steps=${v?.steps}`);
    }
    if (done(v, seen)) break;
    await sleep(STEP_MS);
  }
  return { view: v, seen, ms: Date.now() - t0 };
}

const runIds = {};

// ════════════════════════════════════════════════════════════════════════════
head("1. a real customer runs the long stand-in task");
// ════════════════════════════════════════════════════════════════════════════
const first = await start("slow", "verify: take your time");
runIds.long = first.body?.runId ?? null;
check("starting a run is accepted", first.status === 202, `HTTP ${first.status} ${first.text.slice(0, 140)}`);
check(`the response came back promptly (${first.ms} ms)`, first.ms < 5_000, `${first.ms} ms`);
check("the doorbell rang", first.body?.delivered === true, JSON.stringify(first.body));
console.log(`      run:       ${runIds.long}`);

if (runIds.long) {
  // Committed before the answer: the prompt is already in the log.
  const early = await entriesOf(runIds.long);
  check("the prompt was committed before the response", early[0]?.prompt === "verify: take your time",
    `first entry: ${JSON.stringify(early[0]).slice(0, 120)}`);
  check("nothing had executed yet", early.length === 1, `${early.length} entries`);

  const w = await watch(runIds.long, (v) => v?.status === "stopped", HANDOVER_MS, "long ");
  check("the run finished", w.view?.status === "stopped", `status: ${w.view?.status}`);
  check("it answered", w.view?.stop?.reason === "answered", JSON.stringify(w.view?.stop).slice(0, 160));
  check(`the work lasted at least ${(MIN_LONG_MS / 1000).toFixed(0)} s (${(w.ms / 1000).toFixed(1)} s)`,
    w.ms >= MIN_LONG_MS, `${w.ms} ms`);
  check("progress was readable WHILE it ran",
    w.seen.filter((x) => x.status === "running" && x.steps > 0).length >= 3,
    w.seen.map((x) => `${x.steps}@${x.at}ms`).join(" "));
  check("the steps only ever went up", w.seen.every((x, i) => i === 0 || x.steps >= w.seen[i - 1].steps));
  check("the final result is retrievable", /worked through/.test(w.view?.text ?? ""), w.view?.text ?? "");

  // And it is in the hosted database, not only on the wire.
  const kinds = await entryKinds(runIds.long);
  const models = kinds.filter((k) => k === "model").length;
  const tools = kinds.filter((k) => k === "tool").length;
  check("the stored log matches the run", models === w.view?.steps && tools === w.view?.used?.toolCalls,
    `log: ${models} model, ${tools} tool | view: ${w.view?.steps} steps, ${w.view?.used?.toolCalls} tool calls`);
  check("the queue let the work go", (await workRow(runIds.long))?.done_at !== null);
}

// ════════════════════════════════════════════════════════════════════════════
head("2. one run, one execution");
// ════════════════════════════════════════════════════════════════════════════
const second = await start("slow", "verify: exclusivity");
runIds.exclusive = second.body?.runId ?? null;
check("a second run starts", second.status === 202, `HTTP ${second.status}`);
console.log(`      run:       ${runIds.exclusive}`);

if (runIds.exclusive) {
  // Wait until it is genuinely in flight — a lease held by a real consumer.
  const going = await watch(runIds.exclusive, (v) => v?.steps >= 1, 120_000, "excl ");
  check("it is being worked on", going.view?.steps >= 1, `steps: ${going.view?.steps}`);
  const held = await workRow(runIds.exclusive);
  check("a consumer holds the lease", typeof held?.claimed_by === "string" && held.claimed_by !== "",
    `claimed_by: ${held?.claimed_by}`);

  // (a) A RESUME MID-RUN IS NOT A SECOND DELIVERY.
  const [r1, r2] = await Promise.all([
    api("POST", `/runs/${runIds.exclusive}/resume`),
    api("POST", `/runs/${runIds.exclusive}/resume`),
  ]);
  for (const [i, r] of [r1, r2].entries()) {
    check(`resume ${i + 1} mid-run is refused as already-running`,
      r.status === 202 && r.body?.resumed === false && r.body?.reason === "already-running",
      `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
  }
  // ...and it did not disturb the holder.
  const still = await workRow(runIds.exclusive);
  check("the holder's lease was untouched", still?.claimed_by === held?.claimed_by,
    `${held?.claimed_by} → ${still?.claimed_by}`);

  // (b) A SECOND CLAIM IS THE GATE, and it is the database's.
  const claimed = await rest("POST", "rpc/claim_run",
    { body: { p_run_id: runIds.exclusive, p_worker: "verify-intruder", p_ttl_s: 90 } });
  check("a second claim while the lease is live gets nothing", claimed?.claimed === false,
    JSON.stringify(claimed).slice(0, 160));

  // (c) AND THE LOG PROVES NOTHING RAN TWICE.
  const done = await watch(runIds.exclusive, (v) => v?.status === "stopped", HANDOVER_MS, "excl ");
  check("it finished", done.view?.status === "stopped", `status: ${done.view?.status}`);
  const kinds = await entryKinds(runIds.exclusive);
  const models = kinds.filter((k) => k === "model").length;
  check("exactly one model answer per step — nothing was executed twice",
    models === done.view?.steps, `${models} model entries for ${done.view?.steps} steps`);
  check("no run was charged for a duplicate tool call",
    kinds.filter((k) => k === "tool").length === done.view?.used?.toolCalls,
    `${kinds.filter((k) => k === "tool").length} tool entries, ${done.view?.used?.toolCalls} counted`);
}

// ════════════════════════════════════════════════════════════════════════════
head("3. an interrupted consumer is replaced, and progress is kept");
// ════════════════════════════════════════════════════════════════════════════
const third = await start("slow", "verify: handover");
runIds.handover = third.body?.runId ?? null;
check("a third run starts", third.status === 202, `HTTP ${third.status}`);
console.log(`      run:       ${runIds.handover}`);

if (runIds.handover) {
  const mid = await watch(runIds.handover, (v) => v?.steps >= 2, 120_000, "hand ");
  const before = await workRow(runIds.handover);
  const stepsBefore = mid.view?.steps ?? 0;
  const entriesBefore = (await entryKinds(runIds.handover)).length;
  check("it has made real progress before the interruption", stepsBefore >= 2, `steps: ${stepsBefore}`);
  console.log(`      interrupting: holder ${before?.claimed_by}, ${stepsBefore} steps, ${entriesBefore} entries`);

  // THE INTERRUPTION. Revoking the lease is what the platform's own reclaim does to
  // a consumer that has died.
  await revokeLease(runIds.handover);
  check("the lease was revoked", new Date((await workRow(runIds.handover))?.lease_expires_at) < new Date());

  // A DIFFERENT CONSUMER MUST TAKE IT OVER. The handover costs a beat, then the
  // sweep's grace, then a cron tick — so this is allowed to be slow.
  let taken = null;
  const t0 = Date.now();
  while (Date.now() - t0 < HANDOVER_MS) {
    const row = await workRow(runIds.handover);
    if (row?.claimed_by && row.claimed_by !== before?.claimed_by) { taken = row; break; }
    if (row?.done_at) { taken = row; break; }
    await sleep(5_000);
  }
  check("another consumer picked the run up", taken !== null,
    taken ? `new holder: ${taken.claimed_by ?? "(finished)"} after ${((Date.now() - t0) / 1000).toFixed(0)}s`
          : `no handover within ${HANDOVER_MS / 1000}s`);

  const after = await watch(runIds.handover, (v) => v?.status === "stopped", HANDOVER_MS, "hand ");
  check("the run finished after the handover", after.view?.status === "stopped", `status: ${after.view?.status}`);
  check("it answered", after.view?.stop?.reason === "answered", JSON.stringify(after.view?.stop).slice(0, 140));

  // **THE WORK ALREADY DONE WAS KEPT, NOT REDONE.** The steps only ever went up, and
  // the log holds exactly one model answer per step — a restart would show both a
  // step count that fell back and duplicate entries, and the database would refuse
  // the duplicates, so a restart could not even complete.
  const kinds = await entryKinds(runIds.handover);
  const models = kinds.filter((k) => k === "model").length;
  check("the steps never went backwards across the handover",
    after.seen.every((x, i) => i === 0 || x.steps >= after.seen[i - 1].steps),
    after.seen.map((x) => `${x.steps}@${x.at}ms`).join(" "));
  check("the resumed run continued rather than restarting",
    models === after.view?.steps && after.view?.steps > stepsBefore,
    `${models} model entries, ${after.view?.steps} steps, ${stepsBefore} before the interruption`);
  check("every stage still ran exactly once", kinds.filter((k) => k === "tool").length === after.view?.used?.toolCalls,
    `${kinds.filter((k) => k === "tool").length} tool entries`);
}

// ════════════════════════════════════════════════════════════════════════════
head("4. a lost lease stops the work and writes nothing; an uncertain action stays blocked");
// ════════════════════════════════════════════════════════════════════════════
const fourth = await start("guarded", "verify: blocked");
runIds.guarded = fourth.body?.runId ?? null;
check("the guarded run starts", fourth.status === 202, `HTTP ${fourth.status}`);
console.log(`      run:       ${runIds.guarded}   (its tool is NOT repeatable)`);

if (runIds.guarded) {
  // Wait for a tool call to be in flight: a model entry written, its result not yet.
  let inFlight = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 180_000) {
    const kinds = await entryKinds(runIds.guarded);
    const models = kinds.filter((k) => k === "model").length;
    const tools = kinds.filter((k) => k === "tool").length;
    if (models > tools) { inFlight = { models, tools, kinds }; break; }
    await sleep(2_000);
  }
  check("a non-repeatable tool call is in flight", inFlight !== null,
    inFlight ? `${inFlight.models} model, ${inFlight.tools} tool` : "never caught one mid-call");

  if (inFlight) {
    const entriesAtRevoke = inFlight.models + inFlight.tools + 1;   // + the started entry
    await revokeLease(runIds.guarded);
    console.log(`      lease revoked with ${entriesAtRevoke} entries written`);

    // **THE WRITE THAT WAS IN FLIGHT MUST NEVER LAND.** Its tool finished inside the
    // consumer; the journal gate is what stops the result being recorded.
    const settle = Date.now();
    let grew = null;
    while (Date.now() - settle < HANDOVER_MS) {
      const kinds = await entryKinds(runIds.guarded);
      const row = await workRow(runIds.guarded);
      if (row?.done_at) { grew = { kinds, row }; break; }
      await sleep(5_000);
    }
    check("the run came off the queue", grew !== null,
      grew ? `last_error: ${String(grew.row.last_error).slice(0, 80)}` : "still outstanding");

    if (grew) {
      const v = await view(runIds.guarded);
      const models = grew.kinds.filter((k) => k === "model").length;
      const tools = grew.kinds.filter((k) => k === "tool").length;
      // The in-flight result was refused, so there is one more model answer than
      // there are tool results — the pending call.
      check("the in-flight tool result was NEVER written", models > tools,
        `${models} model, ${tools} tool`);
      check("no stop was written, so the log was left as the next holder needs it",
        !grew.kinds.includes("stopped"), `log: ${grew.kinds.join(",")}`);
      check("the run still reads as running", v?.status === "running", `status: ${v?.status}`);
      check("the pending non-repeatable call is VISIBLE",
        Array.isArray(v?.pending) && v.pending.some((p) => p.name === "commit"),
        JSON.stringify(v?.pending));
      check("a missing tool result is NOT reported as a corrupt log",
        Array.isArray(v?.problems) && v.problems.length === 0, JSON.stringify(v?.problems));

      // AND IT STAYS BLOCKED. Asking again must refuse again, for the same reason,
      // and must not run the tool a second time.
      const again = await api("POST", `/runs/${runIds.guarded}/resume`);
      check("a resume is accepted but changes nothing", again.status === 202, `HTTP ${again.status}`);
      await sleep(SETTLE_MS);
      const stillKinds = await entryKinds(runIds.guarded);
      check("the uncertain action was NOT repeated",
        stillKinds.filter((k) => k === "tool").length === tools,
        `${stillKinds.filter((k) => k === "tool").length} tool results, was ${tools}`);
      check("and it is off the queue again", (await workRow(runIds.guarded))?.done_at !== null);
      const last = await workRow(runIds.guarded);
      check("the queue says why it stopped", /cannot-resume|commit/.test(String(last?.last_error ?? "")),
        String(last?.last_error).slice(0, 120));
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 5. THE FENCE: a write must present the claim it is writing under
// ════════════════════════════════════════════════════════════════════════════
// **THE SCENARIO THE GAP WAS MEASURED IN, on the hosted database, deterministically.**
// A holder is paused (it simply does not write for a while), its lease expires, and a
// DUPLICATE DELIVERY claims the run before the sweeper would ever offer it. The old
// holder's write must fail and the replacement's must succeed.
//
// It runs on a run of its own, accepted through the service key and claimed
// immediately so no real consumer can take it, and released as done at the end so the
// cron never runs it. Nothing here makes a model call.
head("5. the fence: a stale holder cannot write, and a replacement can");
{
  const fenceRun = crypto.randomUUID();
  const started = {
    kind: "started", at: Date.now(), tenant, agent: "no-such-agent-fence-probe",
    model: "stand-in", prompt: "the fence probe never executes", limits: { steps: 1 },
  };
  const m1 = { kind: "model", at: 1, step: 1, ms: 10, text: "one", toolCalls: [], usage: null, costMicros: null };
  const m1diff = { ...m1, ms: 99, text: "SOMETHING ELSE" };
  const m2 = { kind: "model", at: 2, step: 2, ms: 10, text: "two", toolCalls: [], usage: null, costMicros: null };
  const append = (seq, body, worker, token) =>
    rest("POST", "rpc/append_entry", { body: { p_run_id: fenceRun, p_seq: seq, p_body: body, p_worker: worker, p_token: token } });

  const accepted = await rest("POST", "rpc/accept_run",
    { body: { p_run_id: fenceRun, p_tenant: tenant, p_entry: started, p_kind: "start" } });
  check("a run is accepted for the probe", accepted?.state === "queued", JSON.stringify(accepted).slice(0, 120));
  runIds.fence = fenceRun;

  // **THE DIRECT DOOR IS SHUT ON THE HOSTED DATABASE TOO.** This is the half that
  // makes the fence unbypassable rather than merely preferred, and it is checked
  // against the deployment's own credential rather than inferred from the migration.
  const direct = await fetch(`${SUPABASE_URL}/rest/v1/run_entries`, {
    method: "POST",
    headers: { apikey: SVC, authorization: `Bearer ${SVC}`, "content-type": "application/json", "content-profile": SCHEMA },
    body: JSON.stringify({ run_id: fenceRun, seq: 90, body: m2 }),
  });
  const directBody = await direct.text();
  check("the service key CANNOT insert an entry directly any more", direct.status === 403,
    `HTTP ${direct.status} — ${directBody.slice(0, 120)}`);
  check("...and it says so as a privilege rather than as a constraint",
    /permission denied/i.test(directBody), directBody.slice(0, 120));

  const a = await rest("POST", "rpc/claim_run", { body: { p_run_id: fenceRun, p_worker: "probe-A", p_ttl_s: 90 } });
  check("the claim answers a token", isText(a?.claim_token), JSON.stringify(a).slice(0, 140));
  check("the holder's write is stored", (await append(1, m1, "probe-A", a?.claim_token))?.stored === true);

  // The two duplicate readings, which must never collapse into one.
  const same = await append(1, m1, "probe-A", a?.claim_token);
  check("THE SAME ENTRY RE-SENT IS `already`, not an error", same?.already === true && same?.ok === true,
    JSON.stringify(same));
  const differs = await append(8, m1diff, "probe-A", a?.claim_token);
  check("A DIFFERENT ENTRY IN THE SAME SLOT IS A `conflict`", differs?.ok === false && differs?.why === "conflict",
    JSON.stringify(differs));

  // THE PAUSE AND THE EXPIRY. No replacement yet, so the only thing that can refuse
  // the holder is the lease itself.
  await rest("PATCH", `run_work?run_id=eq.${fenceRun}`, { body: { lease_expires_at: new Date(Date.now() - 1000).toISOString() } });
  const late = await append(2, m2, "probe-A", a?.claim_token);
  check("A PAUSED HOLDER WHOSE LEASE EXPIRED IS REFUSED `lease-expired`",
    late?.ok === false && late?.why === "lease-expired", JSON.stringify(late));

  // **AND THE SWEEPER'S GRACE HAS NOT EXPIRED**, which is what makes this the gap that
  // was demonstrated rather than one a wider grace would have covered.
  const offered = await rest("POST", "rpc/sweep_run_work", { body: { p_grace_s: 30, p_limit: 50 } });
  check("THE SWEEPER WOULD NOT HAVE OFFERED IT YET",
    Array.isArray(offered) && !offered.some((r) => r.run_id === fenceRun),
    `${Array.isArray(offered) ? offered.length : "?"} row(s) offered`);

  // **WHAT "A DUPLICATE DELIVERY" AMOUNTS TO HERE, so nobody reads more into it than is
  // there.** A delivery's ONLY effect on exclusivity is that the consumer calls
  // `claim_run` — so this calls the same function the same way, which makes the fence
  // provable without waiting for a message to arrive twice. The real delivery path is
  // covered by the other checks, and by different ones: check 2 races two resumes and a
  // second claim against a LIVE lease through the deployment, and check 3 has a real
  // second consumer of the deployed Worker take over a run whose lease was revoked.
  // Read the three together.
  const bClaim = await rest("POST", "rpc/claim_run", { body: { p_run_id: fenceRun, p_worker: "probe-B", p_ttl_s: 90 } });
  check("A DUPLICATE DELIVERY CLAIMS IT ANYWAY — `claim_run` has no grace",
    bClaim?.claimed === true && bClaim?.claim_token !== a?.claim_token, JSON.stringify(bClaim).slice(0, 140));

  const old = await append(2, m2, "probe-A", a?.claim_token);
  check("THE OLD CONSUMER'S WRITE FAILS", old?.ok === false, JSON.stringify(old));
  const fresh = await append(2, m2, "probe-B", bClaim?.claim_token);
  check("THE REPLACEMENT'S WRITE SUCCEEDS", fresh?.stored === true, JSON.stringify(fresh));

  // The token is the half a shared worker NAME cannot cover, so it is proved on its
  // own: reclaim under the SAME name and the previous claim is still refused.
  await rest("PATCH", `run_work?run_id=eq.${fenceRun}`, { body: { lease_expires_at: new Date(Date.now() - 1000).toISOString() } });
  const b2 = await rest("POST", "rpc/claim_run", { body: { p_run_id: fenceRun, p_worker: "probe-B", p_ttl_s: 90 } });
  check("a reclaim BY THE SAME NAME mints a different token", b2?.claim_token !== bClaim?.claim_token);
  const stale = await append(3, { ...m2, at: 3, step: 3, text: "three" }, "probe-B", bClaim?.claim_token);
  check("...and the replaced claim is refused `bad-token` although the NAME still matches",
    stale?.why === "bad-token", JSON.stringify(stale));

  const released = await rest("POST", "rpc/release_run",
    { body: { p_run_id: fenceRun, p_worker: "probe-B", p_token: b2?.claim_token, p_done: true, p_error: "fence probe" } });
  check("the probe releases its run so no consumer ever sees it", released === true, String(released));
  const closed = await append(4, { ...m2, at: 4, step: 4 }, "probe-B", b2?.claim_token);
  check("a write to finished work is refused `finished`", closed?.why === "finished", JSON.stringify(closed));

  // The probe's rows go: it is an instrument, not a customer's run.
  const gone = await fetch(`${SUPABASE_URL}/rest/v1/runs?id=eq.${fenceRun}`, {
    method: "DELETE", headers: { apikey: SVC, authorization: `Bearer ${SVC}`, "content-profile": SCHEMA },
  });
  check("the probe's run is deleted", gone.ok, `HTTP ${gone.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// **THE THROWAWAY CUSTOMER GOES.** Best effort here, and the workflow removes any
// that a failed run left behind — because a script that dies half way through is
// exactly when cleanup matters and exactly when it does not run.
if (madeUser) {
  head("cleaning up");
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${madeUser.id}`, {
      method: "DELETE", headers: { apikey: SVC, authorization: `Bearer ${SVC}` },
    });
    check("the throwaway customer is deleted", r.ok, `HTTP ${r.status} — ${madeUser.email}`);
  } catch (e) {
    check("the throwaway customer is deleted", false, `${String(e?.message ?? e)} — ${madeUser.email} is still there`);
  }
}

head("what was verified");
console.log(`  endpoint:  ${AGENT_URL}`);
console.log(`  version:   ${VERSION}`);
console.log(`  tenant:    ${tenant}`);
for (const [k, v] of Object.entries(runIds)) console.log(`  run ${k.padEnd(10)} ${v}`);
console.log(`\n  ${results.filter((r) => r.ok).length} passed, ${failed} failed`);
if (failed) {
  console.log("\nFAILURES:");
  for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.what}${r.detail ? ` — ${r.detail}` : ""}`);
}
console.log("\nWHAT FENCING DOES NOT DO, stated because it is the thing most easily");
console.log("believed: it stops the RECORD of an action, never the action. A tool call");
console.log("already sent cannot be recalled by a database. A stale worker refused its");
console.log("write leaves a model answer with no result — a PENDING call — and if that");
console.log("tool is not `repeatable` the run refuses to resume rather than firing it");
console.log("again. Check 4 is that refusal; check 5 is the fence. They are different");
console.log("guarantees and neither replaces the other.");
console.log("\nNOT VERIFIED HERE, and it cannot be from outside: crossing a consumer");
console.log("invocation's own wall-clock ceiling. The design answer is that the lease");
console.log("lapses and the run is resumed from the log — the same mechanism check 3");
console.log("exercises — but the ceiling itself has not been reached by any run.");
process.exit(failed === 0 ? 0 : 1);
