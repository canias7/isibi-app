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
import { makeWork } from "./work.mjs";
import { makeApi } from "./api.mjs";
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

  const store = makeRunStore({ fetch: doFetch, url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY, schema: SCHEMA });
  const work = makeWork({ fetch: doFetch, url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY, schema: SCHEMA });

  // **THE MESSAGE CARRIES A RUN ID AND NOTHING ELSE.** It is a doorbell: the
  // consumer learns whose run it is from the claim, in the same statement that
  // takes the work, so a stale or replayed message can never make this process act
  // as a tenant.
  const ring = notify ?? (async ({ runId }) => { await env[QUEUE_BINDING].send({ runId }); });

  return { store, work, send: make(), ring, doFetch, modelName };
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
  const { store, work, send } = parts(env, { notify, fetchImpl });
  return makeRunner({
    work, store, send, agents: AGENTS, now,
    // Passed through for a LOCAL driver only. The deployed Worker hands in neither,
    // so both fall back to `runner.mjs`'s own constants — and a test asserts that
    // this file never names a number of its own for them.
    ...(Number.isFinite(leaseTtlS) ? { leaseTtlS } : {}),
    ...(Number.isFinite(beatEveryMs) ? { beatEveryMs } : {}),
    onError: (e) => console.error("agent-runner", JSON.stringify(e)),
    onEvent: (e) => console.log("agent-runner", JSON.stringify(e)),
  });
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
  }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
}

export default {
  async fetch(request, env, ctx) {
    // Before the configuration check on purpose — see `health`.
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if ((path === "/health" || path === "/") && request.method === "GET") return health(env);

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
    try {
      const dropped = await runner.reclaimable({ graceS: SWEEP_GRACE_S, limit: SWEEP_LIMIT });
      for (const row of dropped) {
        await env[QUEUE_BINDING].send({ runId: row.runId });
      }
      console.log("agent-sweep", JSON.stringify({ offered: dropped.length }));
    } catch (e) {
      console.error("agent-sweep", String(e?.message ?? e));
    }
  },
};
