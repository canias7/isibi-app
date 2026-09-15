/**
 * THE WORKER ENTRY POINT — the only file that knows it is running on Cloudflare.
 *
 * Everything below it takes its dependencies as arguments, so this is where the
 * real ones get chosen: the JWT secret, the Supabase URL and key, the schema, the
 * model, and the background dispatcher. That is the whole job.
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
import { makeApi } from "./api.mjs";
import { makeStandIn } from "./model-standin.mjs";
import { AGENTS } from "./agents.mjs";

/** The settings this Worker needs, and what each is for. */
export const SETTINGS = Object.freeze({
  SUPABASE_URL: "the project's API URL",
  SUPABASE_SERVICE_KEY: "the service-role key — the backend writes with it, and it never leaves the server",
  SUPABASE_JWT_SECRET: "the project's JWT secret, so a customer's token can be verified",
});

/** The models this Worker will run. A name not in here is refused. */
export const MODELS = Object.freeze({ "stand-in": makeStandIn });

/** The schema the store targets. Named explicitly rather than left to a default. */
export const SCHEMA = "agent";

const isText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * What is missing, by NAME. Answers `[]` when the Worker is configured.
 *
 * The names are safe to say out loud; the values are not, and none is read here
 * for any purpose but presence.
 */
export function missingSettings(env) {
  return Object.keys(SETTINGS).filter((k) => !isText(env?.[k]));
}

/**
 * Build the handler for one environment. Exported so a test — and the local
 * runner — can build exactly what the Worker builds.
 */
export function buildApi(env, { dispatch, now, newId } = {}) {
  const missing = missingSettings(env);
  if (missing.length) throw new TypeError(`not configured: ${missing.join(", ")}`);
  const modelName = isText(env.MODEL) ? env.MODEL : "stand-in";
  const make = Object.hasOwn(MODELS, modelName) ? MODELS[modelName] : null;
  if (!make) throw new TypeError(`no such model: ${modelName}`);

  return makeApi({
    verify: makeVerifier({ secret: env.SUPABASE_JWT_SECRET }),
    // THE SCHEMA IS PASSED EXPLICITLY. It has a default in the store, and a
    // default is the thing that silently keeps working while meaning something
    // else — a project whose exposed schemas change, or a second schema added
    // later, would both be invisible.
    store: makeRunStore({ fetch: globalThis.fetch.bind(globalThis), url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY, schema: SCHEMA }),
    send: make(),
    agents: AGENTS,
    dispatch, now, newId,
    onError: (e) => console.error("agent-api", JSON.stringify(e)),
  });
}

export default {
  async fetch(request, env, ctx) {
    let api;
    try {
      api = buildApi(env, {
        // **THE DISPATCHER, AND ITS HONEST LIMIT.** `waitUntil` keeps the work
        // alive after the response goes out, which is exactly what is wanted and
        // is NOT unlimited: a Worker invocation has a wall-clock ceiling, so a run
        // longer than that needs a queue or a container behind this same seam.
        // Nothing above this line changes when that arrives.
        dispatch: (task) => ctx.waitUntil(Promise.resolve().then(task).catch((e) => {
          console.error("agent-dispatch", String(e?.message ?? e));
        })),
      });
    } catch (e) {
      // Named, and with no value in it.
      return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
        status: 503, headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    return api.fetch(request);
  },
};
