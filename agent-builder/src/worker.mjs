/**
 * THE WORKER ENTRY POINT — the only file that knows it is running on Cloudflare.
 *
 * Everything below it takes its dependencies as arguments, so this is where the
 * real ones get chosen: the project, the store, the schema, the model, the queue.
 * That is the whole job.
 *
 * THREE HANDLERS, AND THEY ARE THREE DIFFERENT JOBS:
 *
 *   `fetch`     — the HTTP surface. Accepts work and answers 202. Runs nothing.
 *   `queue`     — the consumer. Claims a delivery and executes the run.
 *   `scheduled` — the sweeper. Offers dropped work again.
 *
 * **`ctx.waitUntil` IS NO LONGER THE DISPATCHER, and it is not a fallback
 * either.** It kept a run alive after the response, which is the right shape and
 * the wrong durability: the work existed only as a closure in one isolate, so an
 * eviction, a deploy or a crash lost it with nothing anywhere recording that a run
 * was meant to progress. The queue binding is REQUIRED — a missing one is a named
 * 503 like any other missing setting, because silently falling back to `waitUntil`
 * would mean a deployment that believes it is durable and is not.
 *
 * **CONFIGURATION IS CHECKED BEFORE ANYTHING ELSE, AND A GAP IS A NAMED 503.** A
 * Worker with a missing secret should not throw — an uncaught throw is answered by
 * Cloudflare in HTML, and a caller doing `.json()` then learns nothing about the
 * cause. It says which setting is missing and never what any of them contain.
 *
 * **AN UNRECOGNISED MODEL IS REFUSED, NOT DEFAULTED.** Falling back to the
 * stand-in would mean a deployment that believes it is talking to a provider and
 * is quietly answering from a canned script — the most expensive kind of silence.
 */

import { makeVerifier } from "./auth.mjs";
import { makeRunStore } from "./store.mjs";
import { makeAutomationStore } from "./automation-store.mjs";
import { makeCapabilities } from "./capabilities.mjs";
import { makeApprovals } from "./approvals.mjs";
import { makeWork } from "./work.mjs";
import { makeApi } from "./api.mjs";
import { makeDeliveryApi } from "./webhooks.mjs";
import { makeRunner } from "./runner.mjs";
import { makeStandIn } from "./model-standin.mjs";
import { AGENTS } from "./agents.mjs";

/**
 * The settings this Worker cannot run without, and what each is for.
 *
 * **THE JWT SIGNING SECRET IS NOT ONE OF THEM, DELIBERATELY** — see `OPTIONAL`
 * below and the long note at the top of `auth.mjs`. Asking an operator for the
 * credential that can MINT a token for any user, to do a job that only needs the
 * ability to CHECK one, is a bargain worth refusing.
 */
export const SETTINGS = Object.freeze({
  SUPABASE_URL: "the project's API URL",
  SUPABASE_SERVICE_KEY: "the service-role (or secret) key — the backend writes with it, and it never leaves the server",
  SUPABASE_PUBLISHABLE_KEY: "the publishable (or legacy anon) key — NOT a secret; it is what lets Supabase Auth be asked whether an HS256 token is genuine",
});

/**
 * Which of those must be a SECRET, and which may be a committed `var`.
 *
 * **THE DISTINCTION IS NOT COSMETIC: it decides what ends up in git.** The project
 * URL is public and the publishable key is designed to be handed to browsers, so
 * putting them in `wrangler.jsonc` costs nothing and makes the deployment one
 * command instead of three. The service key is the one credential that can read and
 * write every tenant's runs, so it is a secret, and a test asserts it is never a
 * `var` in the committed config.
 *
 * `SUPABASE_JWT_SECRET` is not here because it is not required at all; if an
 * operator opts into it, it belongs with the service key.
 */
export const SENSITIVE = Object.freeze(["SUPABASE_SERVICE_KEY", "SUPABASE_JWT_SECRET"]);

/**
 * Settings that change how this Worker behaves and that it runs fine without.
 *
 * `SUPABASE_JWT_SECRET` is an OPT-IN performance choice: with it, an HS256 token
 * is verified in this process; without it, Supabase is asked. A project on
 * asymmetric signing keys — which this one is — never needs it at all, because a
 * published key verifies locally with no secret.
 */
export const OPTIONAL = Object.freeze({
  SUPABASE_JWT_SECRET: "opt-in: verify HS256 tokens locally instead of asking Supabase Auth on each one",
});

/** The queue binding. Named once, so the config and the code cannot disagree. */
export const QUEUE_BINDING = "RUN_QUEUE";

/** The models this Worker will run. A name not in here is refused. */
export const MODELS = Object.freeze({ "stand-in": makeStandIn });

/** The schema the store and the queue target. Named explicitly, never defaulted. */
export const SCHEMA = "agent";

/** How far back the sweeper looks, and how many runs it offers per tick. */
export const SWEEP_GRACE_S = 30;
export const SWEEP_LIMIT = 50;

/**
 * HOW LATE A SCHEDULED OCCURRENCE MAY BE AND STILL BE RUN — one hour.
 *
 * **THIS IS THE "WHAT HAPPENS TO MISSED OCCURRENCES" DECISION, and it is a decision
 * rather than a default.** A deploy, a platform blip or a short outage is minutes, so an
 * hour of slack means ordinary interruptions catch up silently and nobody notices. Past
 * that, an occurrence is no longer "today's nine o'clock": running it would fire
 * somebody's automation at a time they did not choose, hours later, with no warning. So
 * a stale occurrence is RECORDED as missed — with a count of how many went by — and the
 * schedule jumps to its next future occurrence.
 *
 * **THE TRADE, STATED: an outage of an hour and a half loses that day's run**, and the
 * history says so in as many words. The alternative loses the guarantee that an
 * automation only ever runs near the time it was set for.
 */
export const AUTOMATION_CATCHUP_S = 3600;

/**
 * HOW MANY AUTOMATIONS ONE TICK MAY FILE — the third thing standing between downtime
 * and a burst, and the weakest of them.
 *
 * The other two are in the database and are the real ones: the occurrence key makes a
 * day's run once-only however many times it is filed, and the advance moves a stale
 * automation straight to its next FUTURE occurrence rather than walking the ones it
 * missed. This is only a ceiling on one invocation's work — a large backlog drains over
 * several minutes rather than arriving at once — and at 25 a minute it is 1,500 an hour,
 * which is past anything this platform holds.
 */
export const AUTOMATION_TICK_LIMIT = 25;

/**
 * How many suspended executions one tick may wake.
 *
 * **ITS OWN NUMBER RATHER THAN THE TICK'S, because it bounds a different thing.** The tick
 * bounds how many SCHEDULES are advanced; this bounds how many PAUSED executions are put
 * back on the queue, and a platform can easily have far more of the second than the first —
 * every approval anybody is waiting on is one. The two would have to be pulled apart the
 * first time they mattered, so they are apart now.
 */
export const AUTOMATION_RESUME_LIMIT = 50;

/**
 * How many runs nobody answered in time one tick may put back.
 *
 * ITS OWN NUMBER for `AUTOMATION_RESUME_LIMIT`'s own reason: it bounds a third population.
 * Every gated tool call anybody has ever ignored is one of these, so on a platform where
 * people stop answering it is the largest of the three — and sharing a number with the
 * scheduler would make a backlog of one starve the other.
 */
export const APPROVAL_SWEEP_LIMIT = 50;

/**
 * How many undispatched events one tick may deliver.
 *
 * ⚠ **ITS OWN NUMBER, AND IT BOUNDS THE WIDEST POPULATION OF THE FIVE.** One event can file
 * several triggers and wake several waiters, so a tick's real work is events TIMES what each
 * one touches — and events arrive from outside (a webhook), which none of the other four do.
 * Sharing a number with the scheduler would let a burst of deliveries starve every schedule
 * on the platform, which is the failure a shared bound always eventually produces here.
 *
 * **AND THE BACKLOG IS SAFE BY CONSTRUCTION**: an event stays undispatched until it is
 * dispatched, so what one tick does not reach the next one does. Nothing is dropped; the
 * bound decides latency and never loss.
 */
export const EVENT_DISPATCH_LIMIT = 50;

const isText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * What is missing, by NAME. Answers `[]` when the Worker is configured.
 *
 * The names are safe to say out loud; the values are not, and none is read here
 * for any purpose but presence. **The queue binding is on this list**: a Worker
 * that cannot persist a delivery is not a working deployment.
 */
export function missingSettings(env) {
  return [...missingFor(env, "produce")];
}

/**
 * What a particular job is missing.
 *
 * **PRODUCING AND CONSUMING NEED DIFFERENT THINGS, and pretending otherwise was
 * over-strict in one direction and imprecise in both.** Accepting work needs
 * somewhere to ring; executing it needs nothing but the project, because the row is
 * the work and the message was only a doorbell. A local driver that supplies its
 * own transport is a producer with no binding, and that is a real configuration
 * rather than a broken one.
 */
function missingFor(env, job) {
  const missing = Object.keys(SETTINGS).filter((k) => !isText(env?.[k]));
  if (job === "produce") {
    const q = env?.[QUEUE_BINDING];
    if (!q || typeof q.send !== "function") missing.push(QUEUE_BINDING);
  }
  return missing;
}

/** Everything the three handlers are built from, so they cannot be built differently. */
function parts(env, { notify, fetchImpl } = {}) {
  const modelName = isText(env.MODEL) ? env.MODEL : "stand-in";
  const make = Object.hasOwn(MODELS, modelName) ? MODELS[modelName] : null;
  if (!make) throw new TypeError(`no such model: ${modelName}`);
  const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);

  const wire = { fetch: doFetch, url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY, schema: SCHEMA };
  const work = makeWork(wire);
  // **THE STORE'S WRITER IS THE QUEUE'S FENCE, and it is wired here because this is
  // the only file that gets to choose the real things.** `work.append` is
  // `agent.append_entry`, which validates the holder, the token, the work being
  // unfinished and the lease inside the same transaction as the insert. The store
  // refuses to be built without it, so there is no deployment in which a journal
  // write goes out unfenced — and `service_role` has no INSERT on the log anyway,
  // which is the wall behind the wiring.
  const store = makeRunStore({ ...wire, appendEntry: work.append });

  // **THE MESSAGE CARRIES A RUN ID AND NOTHING ELSE.** It is a doorbell: the
  // consumer learns whose run it is from the claim, in the same statement that
  // takes the work, so a stale or replayed message can never make this process act
  // as a tenant.
  const ring = notify ?? (async ({ runId }) => { await env[QUEUE_BINDING].send({ runId }); });

  // THE SECOND EXECUTOR'S OWN READS AND WRITES. Same wire, same key, same schema; the
  // queue's RPCs are `work`'s and are shared, because an automation execution IS a run.
  const automations = makeAutomationStore(wire);

  // ⚠ WHAT AN AGENT'S TOOLS CAN REACH — the same wire again, and UNSCOPED here on
  // purpose. `makeCapabilities` has no account attached to it; the runner applies the
  // tenant from the claim and the agent from the run's own journal entry, per delivery,
  // which is the one point where both are known and neither has been through a model.
  const capabilities = makeCapabilities(wire);

  // ⚠ WHERE A CALL THAT NEEDS A PERSON GOES TO ASK — the same wire again, and unscoped
  // here for the same reason: the runner binds it to the account from the claim and to
  // the run being delivered, which is the one point where both are known.
  const approvals = makeApprovals(wire);

  return { store, work, automations, capabilities, approvals, send: make(), ring, doFetch, modelName };
}

/**
 * Build the HTTP handler for one environment. Exported so a test — and the local
 * runner — can build exactly what the Worker builds.
 */
export function buildApi(env, { now, newId, notify, fetchImpl } = {}) {
  // A caller that hands in its own `notify` is supplying the transport, so the
  // binding is not required of it. The deployed Worker hands in nothing.
  const missing = missingFor(env, typeof notify === "function" ? "consume" : "produce");
  if (missing.length) throw new TypeError(`not configured: ${missing.join(", ")}`);
  const { store, work, ring } = parts(env, { notify, fetchImpl });

  return makeApi({
    // THE VERIFIER GETS THE PROJECT, NOT A SECRET. It picks its own strategy from
    // the token in front of it: a published key where the project publishes one,
    // Supabase Auth for a legacy HS256 token, and the local secret only if an
    // operator set one.
    verify: makeVerifier({
      url: env.SUPABASE_URL,
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      fetch: fetchImpl ?? globalThis.fetch.bind(globalThis),
      ...(isText(env.SUPABASE_JWT_SECRET) ? { secret: env.SUPABASE_JWT_SECRET } : {}),
      onRefusal: (r) => console.error("agent-auth", JSON.stringify(r)),
    }),
    store, work, notify: ring,
    agents: AGENTS,
    now, newId,
    onError: (e) => console.error("agent-api", JSON.stringify(e)),
  });
}

/** Build the consumer. The only thing in the deployment that executes a run. */
export function buildRunner(env, { now, notify, fetchImpl, leaseTtlS, beatEveryMs } = {}) {
  // THE CONSUMER NEVER PRODUCES. It claims, executes and releases; the only thing
  // that sends a message is the sweeper, and that is a different handler.
  const missing = missingFor(env, "consume");
  if (missing.length) throw new TypeError(`not configured: ${missing.join(", ")}`);
  const { store, work, automations, capabilities, approvals, send } = parts(env, { notify, fetchImpl });
  return makeRunner({
    work, store, automations, capabilities, approvals, send, agents: AGENTS, now,
    // Passed through for a LOCAL driver only. The deployed Worker hands in neither,
    // so both fall back to `runner.mjs`'s own constants — and a test asserts that
    // this file never names a number of its own for them.
    ...(Number.isFinite(leaseTtlS) ? { leaseTtlS } : {}),
    ...(Number.isFinite(beatEveryMs) ? { beatEveryMs } : {}),
    onError: (e) => console.error("agent-runner", JSON.stringify(e)),
    onEvent: (e) => console.log("agent-runner", JSON.stringify(e)),
  });
}

/**
 * The automation store on its own, for the scheduler.
 *
 * It asks for the CONSUMER's configuration — the project and nothing else — because
 * reading the schedule and writing an execution need no queue. The `scheduled` handler
 * rings the doorbell itself and asks for the full deployment before it gets here.
 */
export function buildAutomations(env, { fetchImpl } = {}) {
  const missing = missingFor(env, "consume");
  if (missing.length) throw new TypeError(`not configured: ${missing.join(", ")}`);
  return parts(env, { fetchImpl }).automations;
}

/**
 * The inbound delivery handler.
 *
 * ⚠ **ITS OWN BUILDER, AND `consume` IS THE RIGHT DEMAND.** A delivery writes an EVENT and
 * rings nothing: what the event triggers is the cron's job, and the cron already asks for the
 * whole deployment. So this needs no queue binding — which is also why it cannot accidentally
 * become a second producer.
 *
 * **IT TAKES THE TWO OPERATIONS AND NOT THE STORE**, so the surface it can reach is two
 * functions rather than everything an automation store can do. `webhookForDelivery` is the
 * one reader of a secret anywhere in this product, and handing it over by name is what keeps
 * that countable.
 */
export function buildDelivery(env, { fetchImpl } = {}) {
  const missing = missingFor(env, "consume");
  if (missing.length) throw new TypeError(`not configured: ${missing.join(", ")}`);
  const automations = parts(env, { fetchImpl }).automations;
  return makeDeliveryApi({
    readEndpoint: (id) => automations.webhookForDelivery(id),
    emit: (args) => automations.emit(args),
    onError: (e) => console.error("agent-deliver", JSON.stringify(e)),
  });
}

/**
 * The approvals store, for the ONE thing that is not tenant-scoped.
 *
 * ⚠ ITS OWN BUILDER rather than a field on `buildAutomations`' return, because the two are
 * different stores and folding them together is how one of them quietly stops being built.
 * `consume` is the right configuration demand: this reads and re-queues rows and produces
 * nothing itself — the RINGING is the caller's, which is `scheduled`, and that asks for the
 * whole deployment already.
 */
export function buildApprovals(env, { fetchImpl } = {}) {
  const missing = missingFor(env, "consume");
  if (missing.length) throw new TypeError(`not configured: ${missing.join(", ")}`);
  return parts(env, { fetchImpl }).approvals;
}

const configGap = (e) => new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
  status: 503, headers: { "content-type": "application/json; charset=utf-8" },
});

/**
 * WHAT IS DEPLOYED, ANSWERED WITHOUT A TOKEN.
 *
 * A deployment cannot be verified if there is no way to ask which version answered,
 * and reading it off a `wrangler deployments list` afterwards is a different
 * question — that says what was uploaded, not what is serving. So this is the one
 * unauthenticated route, and it is deliberately narrow:
 *
 *   - the version id and tag, from Cloudflare's own `version_metadata` binding;
 *   - which model this deployment runs, which is the fact a verification most needs
 *     (a Worker quietly answering from a canned script is the expensive silence);
 *   - the schema, and WHETHER it is configured, by NAME — exactly what the 503
 *     already says to any caller, so this adds nothing a stranger could not learn by
 *     sending one request.
 *
 * **IT NEVER CARRIES A SETTING'S VALUE, A TENANT, A RUN OR A COUNT.** It is answered
 * BEFORE the configuration check, so an unconfigured deployment can still say what
 * it is — which is the moment the question is asked most often.
 */
/**
 * **`no-store`, BECAUSE THIS ROUTE IS READ TO DECIDE WHETHER A DEPLOY LANDED.**
 * A 200 with no cache directive is cacheable by anything between the reader and the
 * Worker, and the one question this route exists to answer — WHICH version is
 * serving — is the one question a cached body answers wrongly while looking
 * perfectly healthy.
 *
 * **IT IS NOT A FIX FOR PROPAGATION, and must not be read as one.** A new version
 * reaches Cloudflare's edges over some seconds, so an edge can honestly answer with
 * the version it is still running; `no-store` only removes the OTHER explanation, so
 * that a reader which keeps asking is really asking. What makes a version claim
 * trustworthy is asking until the expected id comes back — see the deploy workflow's
 * wait step, which fails the run when it never does.
 */
const HEALTH_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function health(env) {
  const missing = missingSettings(env);
  const v = env?.CF_VERSION_METADATA ?? null;
  // **THE MODEL IS ECHOED AS CONFIGURED, NOT AS RESOLVED**, and whether this Worker
  // can actually run it is its own field. A deployment whose `MODEL` names something
  // the Worker does not know answers 503 on every request while `missingSettings`
  // sees nothing wrong — so reporting `ok: true` there would be the one lie this
  // route could tell. A sweep found it: with the model hardcoded to the default,
  // nothing could see the difference.
  const model = isText(env?.MODEL) ? env.MODEL : "stand-in";
  const modelKnown = Object.hasOwn(MODELS, model);
  return new Response(JSON.stringify({
    ok: missing.length === 0 && modelKnown,
    service: "agent-builder-api",
    version: v?.id ?? null,
    tag: v?.tag ?? null,
    deployedAt: v?.timestamp ?? null,
    model,
    modelKnown,
    schema: SCHEMA,
    agents: Object.keys(AGENTS),
    missing,
  }), { status: 200, headers: HEALTH_HEADERS });
}

/**
 * WHETHER A PATH IS A DELIVERY, asked WITHOUT building anything.
 *
 * ⚠ **A ROUTE'S SHAPE IS NOT CONFIGURATION, and asking the built handler would invert the
 * order**: an unconfigured deployment would fall through to `buildApi`, which answers a 503
 * naming the settings — for a path that needs none of the same ones. It is the same object's
 * own predicate, built with two throwaway operations, so the shape is declared in exactly one
 * place and this cannot drift from what the handler really serves.
 */
const delivery = makeDeliveryApi({ readEndpoint: async () => null, emit: async () => ({ ok: false }) });

export default {
  async fetch(request, env, ctx) {
    // Before the configuration check on purpose — see `health`.
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if ((path === "/health" || path === "/") && request.method === "GET") return health(env);

    /**
     * ⚠ **THE ONE OTHER ROUTE WITH NO BEARER TOKEN, AND IT IS DISPATCHED HERE RATHER THAN
     * INSIDE THE API FOR EXACTLY THAT REASON.** `api.fetch` verifies a token before it looks
     * at a path; an unauthenticated route added above that gate would make the gate an
     * exception a later reader has to notice, and the next route added there would be open by
     * accident. A delivery proves who sent it with a SIGNATURE instead, and the account it
     * belongs to is the endpoint row's — never the payload's.
     *
     * **IT IS BEFORE THE CONFIGURATION CHECK'S `buildApi` AND AFTER ITS OWN**, so a gap is
     * still the named 503 rather than a throw Cloudflare answers in HTML.
     */
    if (delivery.handles(path, request.method)) {
      let door;
      try { door = buildDelivery(env); }
      catch (e) { return configGap(e); }
      return door.fetch(request);
    }

    let api;
    try { api = buildApi(env); }
    catch (e) { return configGap(e); }          // Named, and with no value in it.
    return api.fetch(request);
  },

  /**
   * A delivery arrived.
   *
   * **EVERY MESSAGE IS ACKED, EVEN A FAILED ONE, AND THAT IS ON PURPOSE: THERE IS
   * EXACTLY ONE RETRY AUTHORITY.** The work row decides whether a run is offered
   * again, and the sweeper does the offering. Letting the queue retry as well would
   * give two mechanisms redelivering the same run on different clocks — the queue
   * re-delivering while the row is still claimed, the claim refusing, and the
   * message eventually dead-lettering for a reason that has nothing to do with the
   * run. One authority, and it is the one that can see the run's state.
   */
  async queue(batch, env, ctx) {
    let runner;
    try { runner = buildRunner(env); }
    catch (e) {
      // Nothing can be executed, so nothing is acked: this is the one case where
      // the queue's own retry is the right mechanism, because the work row cannot
      // be read to decide anything.
      console.error("agent-queue", String(e?.message ?? e));
      for (const m of batch.messages) m.retry();
      return;
    }
    for (const m of batch.messages) {
      const runId = m.body?.runId;
      if (!isText(runId)) {
        // A message we cannot read names no run. Retrying it forever helps nobody,
        // and no work is lost: if a run really is outstanding, its ROW says so and
        // the sweeper will find it.
        console.error("agent-queue", JSON.stringify({ at: "message", why: "no runId" }));
        m.ack();
        continue;
      }
      try {
        const out = await runner.deliver(runId);
        console.log("agent-queue", JSON.stringify({ runId, why: out.why }));
      } catch (e) {
        // `deliver` is documented never to throw; if it ever does, the run's row is
        // still the record and the sweeper is still the retry.
        console.error("agent-queue", JSON.stringify({ runId, error: String(e?.message ?? e) }));
      }
      m.ack();
    }
  },

  /**
   * The sweeper. What makes a lost doorbell cost latency instead of work.
   *
   * It re-rings rather than executing: a tick is a short invocation and a run is
   * not, so the delivery goes back through the queue and is claimed by a consumer
   * with a full invocation of its own.
   */
  async scheduled(event, env, ctx) {
    // The sweeper DOES produce — it puts dropped work back on the queue — so it
    // asks for the full deployment configuration rather than the consumer's.
    const missing = missingSettings(env);
    if (missing.length) { console.error("agent-sweep", `not configured: ${missing.join(", ")}`); return; }
    let runner;
    try { runner = buildRunner(env); }
    catch (e) { console.error("agent-sweep", String(e?.message ?? e)); return; }
    // ── job one: offer dropped work again ─────────────────────────────────
    try {
      const dropped = await runner.reclaimable({ graceS: SWEEP_GRACE_S, limit: SWEEP_LIMIT });
      for (const row of dropped) {
        await env[QUEUE_BINDING].send({ runId: row.runId });
      }
      console.log("agent-sweep", JSON.stringify({ offered: dropped.length }));
    } catch (e) {
      console.error("agent-sweep", String(e?.message ?? e));
    }

    /**
     * ── job two: file what the schedule says is due ────────────────────────
     *
     * ⚠ **ITS OWN `try`, AND THAT IS THE POINT OF PUTTING IT HERE AT ALL.** The sweeper
     * above is the recovery for every dropped run in the deployment, and a scheduler
     * that threw would take it down with it — a broken schedule stopping the thing that
     * fixes everything else. Two jobs, two blocks, and neither can silence the other.
     *
     * **IT RE-USES THIS CRON RATHER THAN ADDING ONE.** The tick already runs every
     * minute because the lease is 90 seconds; a daily schedule needs nothing finer than
     * a minute, so a second trigger would be a second thing to configure for no gain.
     *
     * **THE FUNCTION FILES AND THIS RINGS.** The work is committed by the time a run id
     * comes back, so a ring that fails costs latency and never work: the row is
     * claimable and the next sweep offers it. That is the same argument the HTTP door
     * makes about its own doorbell.
     */
    let automations;
    try { automations = buildAutomations(env); }
    catch (e) { console.error("agent-schedule", String(e?.message ?? e)); return; }
    try {
      const filed = await automations.tick({
        catchupS: AUTOMATION_CATCHUP_S, limit: AUTOMATION_TICK_LIMIT,
      });
      const tally = {};
      const errors = [];
      let rung = 0;
      for (const row of filed) {
        const action = typeof row?.action === "string" ? row.action : "?";
        tally[action] = (tally[action] ?? 0) + 1;
        if (action === "error") errors.push(String(row?.error ?? "").slice(0, 200));
        const runId = row?.run_id;
        // ONLY A FILED EXECUTION HAS SOMETHING TO DELIVER. A missed or refused
        // occurrence is already finished and has no work row at all, so ringing for one
        // would be a doorbell for a run nothing will ever claim.
        if (action === "filed" && isText(runId)) {
          try { await env[QUEUE_BINDING].send({ runId }); rung += 1; }
          catch (e) { console.error("agent-schedule", JSON.stringify({ runId, ring: String(e?.message ?? e) })); }
        }
      }
      // COUNTS, AND THE ERRORS THEMSELVES. A tally says the scheduler ran; an error
      // string is the only thing that can say WHICH automation cannot be scheduled, and
      // a zone the time zone database no longer carries is exactly that shape.
      console.log("agent-schedule", JSON.stringify({ touched: filed.length, rung, ...tally }));
      for (const e of errors.slice(0, 5)) console.error("agent-schedule", e);
    } catch (e) {
      console.error("agent-schedule", String(e?.message ?? e));
    }

    /**
     * ── job three: wake every execution whose wait is over ──────────────────
     *
     * ⚠ **ITS OWN `try` FOR THE SAME REASON THE SCHEDULER HAS ONE.** A workflow that
     * pauses is suspended with its worker released and its work row marked done, so this
     * is the ONLY thing in the deployment that puts a timed wait back on the queue — the
     * sweeper cannot, by design, because a row that is done is nothing to deliver. If a
     * throw here were allowed to escape into the scheduler's block, one broken automation
     * would strand every waiting execution on the platform.
     *
     * **ONE STATEMENT FOR BOTH KINDS OF PAUSE.** A timed wait whose deadline has passed
     * and an approval nobody answered in time are the same fact about the table; the
     * difference between them is what the STEP does when it resumes, which is the
     * executor's business and not this loop's.
     *
     * **ONLY A ROW IT REALLY RE-QUEUED IS RUNG.** An execution somebody is already holding
     * answers `running` — a doorbell for that is a delivery `claim_run` refuses, so it is
     * latency spent to learn nothing.
     */
    try {
      const due = await automations.resumeDue({ limit: AUTOMATION_RESUME_LIMIT });
      let woke = 0;
      const kinds = {};
      for (const row of due) {
        const action = typeof row?.action === "string" ? row.action : "?";
        kinds[`${typeof row?.kind === "string" ? row.kind : "?"}:${action}`] =
          (kinds[`${typeof row?.kind === "string" ? row.kind : "?"}:${action}`] ?? 0) + 1;
        const runId = row?.run_id;
        if (action === "queued" && isText(runId)) {
          try { await env[QUEUE_BINDING].send({ runId }); woke += 1; }
          catch (e) { console.error("agent-resume", JSON.stringify({ runId, ring: String(e?.message ?? e) })); }
        }
      }
      console.log("agent-resume", JSON.stringify({ due: due.length, woke, ...kinds }));
    } catch (e) {
      console.error("agent-resume", String(e?.message ?? e));
    }

    /**
     * ── job four: put back every run nobody answered in time ────────────────
     *
     * ⚠ **ITS OWN `try`, FOR THE REASON THE THREE ABOVE HAVE ONE**: four jobs, four blocks,
     * and none may silence another. This is the newest and least load-bearing of them, so
     * it is last — a throw here must not cost the deployment its sweeper.
     *
     * **AND IT IS THE ONLY THING THAT ENDS A RUN NOBODY ANSWERED.** A run waiting for a
     * person has its work row marked done, and `agent.decide_tool_approval` is what puts it
     * back. Nobody deciding means nothing putting it back: measured, a redelivery answered
     * `not-claimable` and the run sat reading as `running` with a correct refusal nothing
     * could reach. The function only offers a run whose windows have ALL closed, so this
     * cannot wake something a person can still answer.
     *
     * **ONLY A ROW IT REALLY RE-QUEUED IS RUNG**, exactly as above: a run somebody is
     * holding answers `running`, and a doorbell for that is a delivery `claim_run` refuses.
     */
    try {
      const stale = await buildApprovals(env).expiredApprovals({ limit: APPROVAL_SWEEP_LIMIT });
      let rung = 0;
      for (const row of stale) {
        const runId = row?.run;
        if (row?.action === "requeued" && isText(runId)) {
          try { await env[QUEUE_BINDING].send({ runId }); rung += 1; }
          catch (e) { console.error("agent-expired", JSON.stringify({ runId, ring: String(e?.message ?? e) })); }
        }
      }
      // ⚠ **TWO NUMBERS BECAUSE THEY REALLY DIFFER.** The function reports every run whose
      // windows have closed and says per row whether it could put it back, so `closed` is
      // what the tick looked at and `rung` is what it could act on — a run somebody is
      // holding is `held` and is deliberately not rung. They were always equal until the
      // function started saying which, which made this line unable to tell an operator
      // anything and the filter above it unable to be driven.
      console.log("agent-expired", JSON.stringify({ closed: stale.length, rung }));
    } catch (e) {
      console.error("agent-expired", String(e?.message ?? e));
    }

    /**
     * ── job five: deliver every event nobody has dispatched yet ──────────────
     *
     * ⚠ **ITS OWN `try`, FOR THE REASON THE FOUR ABOVE HAVE ONE**: five jobs, five blocks,
     * and none may silence another.
     *
     * **ONE FUNCTION DOES BOTH HALVES OF WHAT AN EVENT MEANS, and they are one transaction
     * per event deliberately.** An event both TRIGGERS automations that listen for it and
     * WAKES executions already waiting on it, and doing those in two statements would let a
     * run be woken for an event whose triggers were never filed. `for update skip locked`
     * means two ticks cannot dispatch the same event, so a slow one does not block the rest.
     *
     * **AND THE RING IS SEPARATE FROM THE DISPATCH, exactly as the scheduler's is.** The
     * work is committed by the time a run id comes back, so a ring that fails costs latency
     * and never work — the row is claimable and the sweeper offers it.
     */
    try {
      const dispatched = await automations.dispatchEvents({ limit: EVENT_DISPATCH_LIMIT });
      /**
       * ⚠ **WHAT IT ANSWERS IS `filed` AND `woke`, AND THE FIRST DRAFT TALLIED AN `action`
       * THAT DOES NOT EXIST.** `agent.dispatch_events` answers
       * `{event_id, name, filed, woke, ring}` — there is no `action` anywhere in it — so
       * every row fell to the `"?"` bucket and the line read `{"events":1,"rung":0,"?":1}`
       * for a tick that had really filed an execution. **A log that always says the same
       * thing is a log nobody can read a tick by**, which is this product's own
       * `requeue_expired_approvals` finding one job over: a line whose numbers cannot move
       * is a line that is not an instrument.
       *
       * The two numbers are kept APART because they are different facts: `filed` is how
       * many executions an event STARTED, `woke` is how many suspended ones it let carry
       * on. An operator reading one total could not tell an event that triggered ten
       * automations from one that released ten waiters.
       */
      let filed = 0;
      let woke = 0;
      let rung = 0;
      for (const row of dispatched) {
        filed += Number.isInteger(row?.filed) ? row.filed : 0;
        woke += Number.isInteger(row?.woke) ? row.woke : 0;
        // EVERY RUN ONE EVENT TOUCHED, which is a LIST rather than one id: an event can file
        // a trigger AND wake a waiter, and ringing only the first would leave the other
        // waiting for the sweeper. A row that changed nothing carries none.
        // ⚠ THE KEY IS `ring`, WHICH IS WHAT THE FUNCTION REALLY ANSWERS — the first draft
        // read `runs` and would have rung nothing at all, with every other line correct.
        const runs = Array.isArray(row?.ring) ? row.ring : [];
        for (const runId of runs) {
          if (!isText(runId)) continue;
          try { await env[QUEUE_BINDING].send({ runId }); rung += 1; }
          catch (e) { console.error("agent-events", JSON.stringify({ runId, ring: String(e?.message ?? e) })); }
        }
      }
      console.log("agent-events", JSON.stringify({ events: dispatched.length, filed, woke, rung }));
    } catch (e) {
      console.error("agent-events", String(e?.message ?? e));
    }
  },
};
