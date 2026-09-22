/**
 * THE HTTP SURFACE — start a run, read it, resume it.
 *
 * A `fetch(request)` handler, which is what a Cloudflare Worker wants. Nothing in
 * here is bound to Cloudflare: `verify`, `store`, `work`, `notify`, `now` and
 * `newId` are all handed in, so the whole thing runs in a test with no network, no
 * database, no model and no deployment.
 *
 * THE ORDER OF EVERY REQUEST IS THE SECURITY ARGUMENT, and it is the same four
 * steps every time:
 *
 *   1. verify the token — the ONLY thing that decides who is asking;
 *   2. take the tenant from the VERIFIED claims;
 *   3. build a store scoped to that tenant;
 *   4. then, and only then, look at what was asked for.
 *
 * **THE BODY IS NEVER AUTHORITY.** The tenant comes from step 2 and the store
 * built in step 3 takes no tenant argument at all, so there is nowhere for a body
 * field to be mistaken for one. A body that carries a tenant is REFUSED rather
 * than ignored, because a silent drop lets somebody believe it worked.
 *
 * **NOTHING IN THIS FILE EXECUTES A RUN, AND THAT IS THE POINT OF THE QUEUE.** A
 * run is ACCEPTED here — written down, durably, in one transaction — and executed
 * by `runner.mjs` when a delivery arrives. The two are deliberately far apart:
 *
 *   ACCEPTING is fast, transactional and must never be lost. It writes the run
 *   row, the run's first journal entry (so the prompt outlives the request that
 *   carried it) and the work row, together or not at all.
 *
 *   NOTIFYING is a doorbell. It carries a run id and no authority, and it is
 *   allowed to FAIL: the work is already durable, so a lost delivery costs
 *   latency and never work — the sweeper offers it again. The response says
 *   whether the doorbell rang rather than pretending it always does.
 *
 * That ordering is what replaced `ctx.waitUntil`. `waitUntil` kept the work alive
 * after the response, which is the right shape and the wrong durability: the work
 * existed only as a closure in one isolate, and an eviction or a deploy took it
 * with nothing anywhere saying a run was ever meant to progress.
 */

import { bearerOf } from "./auth.mjs";
import { startedEntry, limitsToJson } from "./journal.mjs";

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...extra },
});

/**
 * A REFUSAL SAYS NOTHING ABOUT WHY. The verifier knows whether a token was
 * expired, forged or unsigned, and that belongs in a log — telling the caller
 * turns the endpoint into an oracle for probing tokens. One sentence, one status.
 */
const unauthorized = () => json(401, { error: "unauthorized" }, { "www-authenticate": "Bearer" });

/** Not found, never forbidden — see the store: the difference is information. */
const notFound = () => json(404, { error: "not found" });

const isText = (v) => typeof v === "string" && v.trim() !== "";

/** The keys a caller may never set. Their presence is a refusal, not a filter. */
export const FORBIDDEN_BODY_KEYS = Object.freeze(["tenant", "tenant_id", "tenantId"]);

/** What a run looks like on the wire. Derived from the log, never stored. */
export function runView({ runId, state, run }) {
  const stop = state.stop ?? null;
  return {
    runId,
    status: state.status,
    steps: state.used.steps,
    used: state.used,
    // A pending tool call is why a run cannot be resumed, so it is visible rather
    // than something a caller has to infer from a failed resume.
    pending: state.pending.map((p) => ({ step: p.step, name: p.name })),
    problems: state.problems,
    stop,
    text: stop && stop.reason === "answered" ? (stop.text ?? null) : null,
    agent: run?.agent_name ?? state.agent ?? null,
    model: run?.model ?? state.model ?? null,
    // ⚠ **WHICH PARENT THIS RUN BELONGS TO, and the two ride together or not at all.**
    // A delegated child is a run a customer can read like any other, and without this the
    // link is a fact only the log holds — so a person looking at a specialist's run could
    // not tell it apart from one they started themselves. `replay` refuses one half without
    // the other, so there is no shape here that names a parent and not its delegation.
    //
    // PRESENT OR ABSENT, never `null`: every run accepted before delegation existed answers
    // exactly what it answered before, byte for byte.
    ...(state.delegatedBy === null ? {} : { delegatedBy: state.delegatedBy, delegation: state.delegation }),
  };
}

/**
 * `makeApi({ verify, store, work, notify, agents, now, newId, onError })`
 *
 * `agents` is a registry of `defineAgent` results by name. A caller NAMES an
 * agent; it can never describe one. An agent is code — tools, instructions and
 * bounds — and letting a request supply that would be letting a request supply
 * code.
 */
export function makeApi(opts = {}) {
  const { verify, store, work, notify } = opts;
  if (typeof verify !== "function") throw new TypeError("makeApi: verify must be a function");
  if (!store || typeof store.forTenant !== "function") throw new TypeError("makeApi: store must come from makeRunStore");
  if (!work || typeof work.accept !== "function" || typeof work.requeue !== "function") {
    throw new TypeError("makeApi: work must come from makeWork");
  }
  if (typeof notify !== "function") throw new TypeError("makeApi: notify must be a function");
  const registry = new Map(Object.entries(opts.agents ?? {}));
  if (registry.size === 0) throw new TypeError("makeApi: agents must hold at least one agent");
  for (const [name, a] of registry) {
    if (!a || a.kind !== "agent") throw new TypeError(`makeApi: agents.${name} must come from defineAgent`);
  }
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const newId = typeof opts.newId === "function" ? opts.newId : () => crypto.randomUUID();
  const onError = typeof opts.onError === "function" ? opts.onError : () => {};

  /**
   * Ring the doorbell, and NEVER let it fail the request.
   *
   * The work is committed by the time this runs, so the only thing a failure
   * changes is how soon the run starts. Answering 500 here would tell a caller
   * their run was rejected when it is sitting in the queue, ready — the worst of
   * both readings.
   */
  async function ring(runId, tenant) {
    try { await notify({ runId, tenant }); return true; }
    catch (e) {
      onError({ at: "notify", runId, tenant, error: String(e?.message ?? e) });
      return false;
    }
  }

  async function readBody(request) {
    let text;
    try { text = await request.text(); } catch { return { bad: json(400, { error: "could not read the body" }) }; }
    // NO BODY IS AN EMPTY BODY, not a malformed one. A resume carries nothing, and
    // reading "" as broken JSON refused every legitimate resume — which is what
    // this did on its first run.
    if (text.trim() === "") return { body: {} };
    let body;
    try { body = JSON.parse(text); } catch { return { bad: json(400, { error: "body must be JSON" }) }; }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return { bad: json(400, { error: "body must be a JSON object" }) };
    }
    // `Object.hasOwn`, never truthiness: every object literal has a truthy
    // `constructor`, and a truthiness check here would refuse every request.
    const smuggled = FORBIDDEN_BODY_KEYS.filter((k) => Object.hasOwn(body, k));
    if (smuggled.length) {
      return { bad: json(400, {
        error: "the tenant comes from the token, never the body",
        rejected: smuggled,
      }) };
    }
    return { body };
  }

  return {
    async fetch(request) {
      // ── 1 and 2: who is asking ────────────────────────────────────────────
      const token = bearerOf(request);
      const who = await verify(token);
      if (!who?.ok) {
        // The reason goes to the log and NOT to the caller.
        onError({ at: "verify", reason: who?.reason ?? "no-token" });
        return unauthorized();
      }

      // ── 3: a store that cannot be asked about anybody else ────────────────
      const scoped = store.forTenant(who.tenant);

      // ── 4: and only now, what was asked ───────────────────────────────────
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const m = /^\/runs\/([^/]+)(\/resume)?$/.exec(path);

      try {
        if (path === "/runs" && request.method === "GET") {
          return json(200, { runs: await scoped.resumable() });
        }

        if (path === "/runs" && request.method === "POST") {
          const { body, bad } = await readBody(request);
          if (bad) return bad;
          if (!isText(body.prompt)) return json(400, { error: "prompt must be a non-empty string" });
          if (!isText(body.agent)) return json(400, { error: "agent must be a non-empty string" });
          const agent = registry.get(body.agent);
          // An unknown agent is a 400 and not a 404: the run does not exist yet,
          // and the thing that is wrong is the request.
          if (!agent) return json(400, { error: "no such agent" });

          const runId = newId();

          // **THE LOG'S FIRST ENTRY IS WRITTEN HERE, and that is what makes the
          // work durable rather than merely recorded.** It carries the prompt, the
          // agent, the model and the bounds, so once `accept` commits, everything
          // needed to execute this run exists in the database and the request can
          // go away. Built with the SAME `startedEntry` as the SDK path, because
          // two producers of one entry shape is how a resumed run ends up with a
          // subtly different conversation.
          const entry = startedEntry({
            at: now(), tenant: who.tenant, agent: agent.name, model: agent.model,
            prompt: body.prompt, limits: limitsToJson(agent.limits),
          });

          // ONE TRANSACTION: the run, its first entry and its work row. Nothing is
          // acknowledged until all three are committed, so there is no state where
          // a caller holds an id for a run that cannot run.
          const accepted = await work.accept({ runId, tenant: who.tenant, entry, kind: "start" });

          const delivered = await ring(runId, who.tenant);

          // 202: accepted, not finished. Nothing above executed anything, and
          // `delivered` says whether the doorbell rang rather than implying it
          // always does — an undelivered run is queued and will be swept up.
          return json(202, { runId, status: accepted.state, delivered }, { location: `/runs/${runId}` });
        }

        if (m && m[2] === "/resume" && request.method === "POST") {
          const runId = decodeURIComponent(m[1]);
          const { bad } = await readBody(request);
          if (bad) return bad;
          // `load`, NOT `open`: this route reads a run and asks for it to be picked
          // up again. It never writes an entry, and since the fence a writer has to
          // present a claim — which an HTTP request does not hold and must not be
          // able to fabricate.
          const open = await scoped.load(runId);        // authorises, or throws not-found

          // A FINISHED RUN IS NOT QUEUED. `runAgent` would refuse to execute it
          // anyway, and so would the runner — three walls, deliberately: this one
          // makes the answer immediate and cheap, and the others make it true even
          // if something ever calls past here.
          if (open.state.status === "stopped") {
            return json(200, {
              ...runView({ runId, state: open.state, run: open.run }),
              resumed: false, reason: "already-finished",
            });
          }
          if (open.state.problems.length) {
            return json(409, { error: "this run's log cannot be read", problems: open.state.problems });
          }
          const name = open.run?.agent_name ?? open.state.agent;
          const agent = isText(name) ? registry.get(name) : undefined;
          // The agent comes from the STORED run, not from the resume request — a
          // resume that could name a different agent would be a way to run one
          // agent's tools over another's conversation.
          if (!agent) return json(409, { error: "the agent this run was started with is not registered", agent: name ?? null });

          // **TWO SIMULTANEOUS RESUMES ARE SETTLED IN THE DATABASE, NOT HERE.**
          // `requeue_run` locks the row and answers `running` when a live lease is
          // already held, so the second press never becomes a second delivery. A
          // check in this process would be a race wearing a wall's clothes.
          const again = await work.requeue({ runId, tenant: who.tenant });
          if (again.state === "not-found") return notFound();
          if (again.state === "running") {
            return json(202, {
              ...runView({ runId, state: open.state, run: open.run }),
              resumed: false, reason: "already-running",
            }, { location: `/runs/${runId}` });
          }

          const delivered = await ring(runId, who.tenant);
          return json(202, { runId, status: "queued", resumed: true, delivered }, { location: `/runs/${runId}` });
        }

        if (m && !m[2] && request.method === "GET") {
          const runId = decodeURIComponent(m[1]);
          const open = await scoped.load(runId);         // authorises, or throws not-found
          return json(200, runView({ runId, state: open.state, run: open.run }));
        }

        return json(404, { error: "not found" });
      } catch (e) {
        // A run that is not this tenant's, or does not exist, reads the same.
        if (e?.code === "not-found") return notFound();
        onError({ at: "fetch", tenant: who.tenant, error: String(e?.message ?? e) });
        return json(500, { error: "internal error" });
      }
    },
  };
}
