// THE DEPLOY GATE (stage 3a, 2026-09-05, owner: "ok go").
//
// WHY THIS EXISTS. A deploy rolls the Worker, and the platform evicts the old
// isolates minutes later — run 17's queue invocation was cancelled nine minutes
// after a deploy with a customer's edit in flight, its lease lapsing under the
// sweep and the change lost. The isolate has no drain of its own, and until
// this the deploy workflow had no gate: the twenty-minute hold after a push
// was for humans and routes, never for the jobs the queue keeps delivering.
//
// WHAT IT DOES, three verbs run by deploy.yml, each a step:
//   set    before anything rolls: name this deploy (GITHUB_SHA) in one row of
//          private.platform_flags with an expiry. From that moment every
//          consumer of the PREVIOUS deploy — the isolates about to be evicted —
//          has its claims refused `deploy-gated` and re-sends them with a
//          delay; the new code, whose DEPLOY_ID is the gate's own, claims
//          straight through it.
//   drain  wait, up to DRAIN_MAX_S, for the live leases in edit_jobs to reach
//          zero, so a job running on the old code finishes before the roll —
//          then deploy REGARDLESS, said in the log: a generation is bounded at
//          thirty minutes, the wait at fourteen, and a job cut by the roll is
//          what stages 2a and 2c recover.
//   clear  after the deploy, `if: always()`. On FAILURE or CANCELLATION the
//          old Worker is still the live one and its id is not the gate's, so
//          our own id is cleared at once and it claims again. On SUCCESS the
//          gate is LEFT TO EXPIRE: the new isolates claim through it, and the
//          old ones — which keep receiving deliveries for minutes after a
//          deploy — defer until they are gone. A clear clears only its own id,
//          so an overlapping newer deploy's gate is never released by this one.
//
// NEVER FAILS THE DEPLOY. A gate that cannot be set, a drain that cannot read
// the database, a clear that cannot land: each is the deploy of yesterday —
// ungated — said loudly in the step's log, never a red run over a safety. The
// expiry on the gate is what bounds a workflow killed before its clear step.
//
// Every decision is a function taking its clock and its fetch, driven in
// test/deploy-gate.test.mjs; `main` is the thin wiring.

export const DEFAULT_TTL_S = 2700;   // 45 minutes: the drain (14) + the images + the deploy, and the propagation window after
export const DRAIN_MAX_S = 840;      // 14 minutes, under the queue's own fifteen
export const DRAIN_TICK_S = 15;
export const READ_FAILS_MAX = 3;     // a drain that cannot read the database three times running deploys, said so
export const DEPLOY_ID_RE = /^[A-Za-z0-9._-]{4,64}$/;
export const DEFAULT_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";

/** What the step's environment says, validated; a missing piece is named, never thrown. */
export function readEnv(env = {}) {
  const url = String(env.SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_KEY || "");
  const mint = String(env.CREDITS_MINT_SECRET || "");
  const deployId = DEPLOY_ID_RE.test(String(env.DEPLOY_ID || "")) ? String(env.DEPLOY_ID) : "";
  const ttl = Number.isFinite(Number(env.DEPLOY_GATE_TTL_S)) && Number(env.DEPLOY_GATE_TTL_S) >= 60 ? Math.trunc(Number(env.DEPLOY_GATE_TTL_S)) : DEFAULT_TTL_S;
  const maxS = Number.isFinite(Number(env.DRAIN_MAX_S)) && Number(env.DRAIN_MAX_S) >= 0 ? Math.trunc(Number(env.DRAIN_MAX_S)) : DRAIN_MAX_S;
  const outcome = String(env.DEPLOY_OUTCOME || "").toLowerCase();
  const missing = [!key && "SUPABASE_SERVICE_KEY", !mint && "CREDITS_MINT_SECRET", !deployId && "DEPLOY_ID"].filter(Boolean);
  return { url, key, mint, deployId, ttl, maxS, outcome, missing };
}

/** One mint-gated RPC through PostgREST. Answers {ok, status, body} and never throws. */
export async function rpc(fn, args, { url, key, mint, fetch: f = globalThis.fetch }) {
  try {
    const r = await f(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({ ...args, p_mint: mint }),
      signal: AbortSignal.timeout(15000),
    });
    // THE STATUS, NEVER THE BODY OF A REFUSAL: a PostgREST error quotes the
    // request that produced it, and this request carries the mint key.
    if (!r.ok) return { ok: false, status: r.status, body: null };
    const body = await r.json().catch(() => null);
    return { ok: !!(body && typeof body === "object" && !Array.isArray(body) && body.ok === true), status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: String((e && e.name) || e) };
  }
}

/** `set`: the gate named for this deploy. Says what it replaced. */
export async function gateSet(cfg, deps = {}) {
  const log = deps.log || console.log;
  if (cfg.missing.length) { log(`deploy gate: NOT SET — missing ${cfg.missing.join(", ")}; this deploy rolls ungated, as every deploy before 2026-09-05 did`); return { set: false, why: "missing" }; }
  const r = await rpc("deploy_gate_set", { p_deploy_id: cfg.deployId, p_ttl: cfg.ttl }, { ...cfg, fetch: deps.fetch });
  if (!r.ok) { log(`deploy gate: NOT SET — the RPC answered ${r.status || r.error}; this deploy rolls ungated`); return { set: false, why: "rpc" }; }
  const b = r.body;
  log(`deploy gate: set for ${cfg.deployId} until ${b.expires_at}` + (b.previous ? ` (took over from ${b.previous}${b.previous_active ? ", which was still live" : ""})` : ""));
  return { set: true, previous: b.previous || null, previousActive: b.previous_active === true };
}

/**
 * `drain`: wait for the live leases to reach zero, or for the clock, or for a
 * database that will not answer — and say which. Never longer than `maxS`.
 */
export async function drainWait(cfg, deps = {}) {
  const log = deps.log || console.log;
  const now = deps.now || (() => Date.now());
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const tickS = deps.tickS || DRAIN_TICK_S;
  if (cfg.missing.filter((m) => m !== "DEPLOY_ID").length) { log("deploy drain: NOT WAITING — no database credentials in this step; deploying now"); return { drained: false, why: "missing", waitedS: 0, looks: 0 }; }
  const start = now();
  let fails = 0;
  let looks = 0;
  for (;;) {
    const r = await rpc("deploy_gate_read", { p_deploy: null }, { ...cfg, fetch: deps.fetch });
    looks++;
    const waitedS = Math.round((now() - start) / 1000);
    if (!r.ok) {
      fails++;
      log(`deploy drain: could not read the live leases (${r.status || r.error}), ${fails} of ${READ_FAILS_MAX}`);
      if (fails >= READ_FAILS_MAX) { log(`deploy drain: the database will not answer — deploying now, after ${waitedS}s`); return { drained: false, why: "unread", waitedS, looks }; }
    } else {
      fails = 0;
      const live = Number(r.body.live) || 0;
      const rows = Array.isArray(r.body.rows) ? r.body.rows : [];
      if (live === 0) { log(`deploy drain: no live leases after ${waitedS}s — deploying`); return { drained: true, why: "zero", waitedS, looks }; }
      log(`deploy drain: ${live} live lease${live === 1 ? "" : "s"} after ${waitedS}s — ` + rows.slice(0, 5).map((x) => `${x.slug} ${x.state} (${x.left_s}s left)`).join(", "));
    }
    if (now() - start + tickS * 1000 > cfg.maxS * 1000) { log(`deploy drain: still waiting after ${waitedS}s — deploying REGARDLESS; a job cut by the roll is what the sweeps recover`); return { drained: false, why: "time", waitedS, looks }; }
    await sleep(tickS * 1000);
  }
}

/**
 * `clear`: on a deploy that did not succeed, clear our own id so the old Worker
 * — still the live one — claims at once; on success leave the gate to expire.
 */
export async function gateClear(cfg, deps = {}) {
  const log = deps.log || console.log;
  if (cfg.outcome === "success") { log(`deploy gate: left to expire for ${cfg.deployId || "(no id)"} — the new isolates claim through it, the old ones defer until they are gone`); return { cleared: false, why: "success" }; }
  if (cfg.missing.length) { log(`deploy gate: NOT CLEARED — missing ${cfg.missing.join(", ")}; the gate expires on its own`); return { cleared: false, why: "missing" }; }
  const r = await rpc("deploy_gate_clear", { p_deploy_id: cfg.deployId }, { ...cfg, fetch: deps.fetch });
  if (!r.ok) { log(`deploy gate: NOT CLEARED — the RPC answered ${r.status || r.error}; the gate expires on its own`); return { cleared: false, why: "rpc" }; }
  if (r.body.cleared === true) { log(`deploy gate: cleared ${cfg.deployId} after a deploy that ${cfg.outcome || "did not succeed"} — the live Worker claims again`); return { cleared: true, why: cfg.outcome }; }
  log(`deploy gate: ${cfg.deployId} was not the gate's (${r.body.holder || "nobody"} holds it) — left as it is`);
  return { cleared: false, why: "other" };
}

export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const verb = String(argv[0] || "");
  const cfg = readEnv(env);
  if (verb === "set") return gateSet(cfg, deps);
  if (verb === "drain") return drainWait(cfg, deps);
  if (verb === "clear") return gateClear(cfg, deps);
  (deps.log || console.log)(`deploy gate: unknown verb "${verb}" — expected set, drain or clear; nothing done`);
  return { why: "verb" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // NEVER A NON-ZERO EXIT: a safety must not fail the deploy it protects.
  main().catch((e) => { console.log("deploy gate: threw, nothing done —", String((e && e.message) || e)); });
}
