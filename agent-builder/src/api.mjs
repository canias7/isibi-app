/**
 * THE HTTP SURFACE — start a run, read it, resume it.
 *
 * A `fetch(request)` handler, which is what a Cloudflare Worker wants. Nothing in
 * here is bound to Cloudflare: `verify`, `store`, `send`, `dispatch`, `now` and
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
 * **THE WORK IS NOT THE REQUEST.** A run can outlive the connection that asked
 * for it, so starting one writes the run down, hands the work to `dispatch`, and
 * answers 202 immediately. `dispatch` is where the infrastructure goes —
 * `ctx.waitUntil` for short work, a queue or a container for long — and until one
 * is wired, a caller passes whatever it has. Nothing in this file waits for a run
 * to finish.
 */

import { runAgent } from "./run.mjs";
import { bearerOf } from "./auth.mjs";
import { stoppedEntry } from "./journal.mjs";

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
  };
}

/**
 * `makeApi({ verify, store, agents, send, dispatch, now, newId })`
 *
 * `agents` is a registry of `defineAgent` results by name. A caller NAMES an
 * agent; it can never describe one. An agent is code — tools, instructions and
 * bounds — and letting a request supply that would be letting a request supply
 * code.
 */
export function makeApi(opts = {}) {
  const { verify, store, agents, send, dispatch } = opts;
  if (typeof verify !== "function") throw new TypeError("makeApi: verify must be a function");
  if (!store || typeof store.forTenant !== "function") throw new TypeError("makeApi: store must come from makeRunStore");
  if (typeof send !== "function") throw new TypeError("makeApi: send must be a function");
  if (typeof dispatch !== "function") throw new TypeError("makeApi: dispatch must be a function");
  const registry = new Map(Object.entries(agents ?? {}));
  if (registry.size === 0) throw new TypeError("makeApi: agents must hold at least one agent");
  for (const [name, a] of registry) {
    if (!a || a.kind !== "agent") throw new TypeError(`makeApi: agents.${name} must come from defineAgent`);
  }
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const newId = typeof opts.newId === "function" ? opts.newId : () => crypto.randomUUID();
  const onError = typeof opts.onError === "function" ? opts.onError : () => {};

  /**
   * Run the work, and MAKE SURE IT ENDS SOMEWHERE VISIBLE.
   *
   * A dispatched task that throws would leave a run reading as `running` for ever
   * — indistinguishable from one still going, which is the state nobody can act
   * on. So an unexpected throw is written into the log as a stop, best effort, and
   * reported through `onError` either way.
   */
  async function execute({ scoped, runId, agent, prompt, from, journal }) {
    try {
      return await runAgent({
        agent, send, journal,
        tenant: { id: scoped.tenant },
        ...(from ? { from } : { prompt }),
      });
    } catch (e) {
      onError({ at: "execute", runId, tenant: scoped.tenant, error: String(e?.message ?? e) });
      try {
        await journal.append(stoppedEntry({
          at: now(), stop: { reason: "crashed", error: String(e?.message ?? e) },
        }));
      } catch (e2) {
        // Nothing left to write with. Said out loud rather than swallowed: this is
        // the one path that can leave a run looking unfinished.
        onError({ at: "execute-stop", runId, tenant: scoped.tenant, error: String(e2?.message ?? e2) });
      }
      return null;
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

          // THE RUN IS WRITTEN DOWN BEFORE THE ANSWER GOES OUT, so the id handed
          // back is one a GET can already resolve. Dispatching first and creating
          // later would hand out an id that does not exist yet.
          const runId = newId();
          const { journal } = await scoped.create(runId);

          dispatch(() => execute({ scoped, runId, agent, prompt: body.prompt, journal }));

          // 202: accepted, not finished. Nothing above waited for the run.
          return json(202, { runId, status: "queued" }, { location: `/runs/${runId}` });
        }

        if (m && m[2] === "/resume" && request.method === "POST") {
          const runId = decodeURIComponent(m[1]);
          const { bad } = await readBody(request);
          if (bad) return bad;
          const open = await scoped.open(runId);        // authorises, or throws not-found

          // A FINISHED RUN IS NOT DISPATCHED. `runAgent` would refuse to execute it
          // anyway — that is proved separately — and the two walls are deliberate:
          // this one makes the answer immediate and cheap, and that one makes it
          // true even if something ever calls past here.
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

          dispatch(() => execute({ scoped, runId, agent, from: open.entries, journal: open.journal }));
          return json(202, { runId, status: "resuming", resumed: true }, { location: `/runs/${runId}` });
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
