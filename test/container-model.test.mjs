// THE CONTAINER CAN MAKE THE MODEL CALL — the wiring, at both ends.
//
// This is the layer this repo has recorded TWELVE dead features in, every one
// of them the same shape: a module that was correct, a caller that never
// reached it, and a suite that stayed green. Three hops have to hold and each
// fails silently on its own:
//
//   the Worker SETS the keys on the container's start config
//   the container TAKES them out of its own environment  (build-keys.test.mjs)
//   the container's /model route CALLS THROUGH with them
//
// The middle one is proven by driving real processes. The other two are source
// reads, because `worker.js` cannot be imported and `build-server.mjs` listens
// on a port at import time — so both are asserted on PROPERTIES rather than
// spellings, which is the own-goal this repo has recorded most often.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { keyEnv, SECRET_ENV, BUILDER_CALL_MS } from "../builder/build-call.mjs";
import { WORKER_SRC } from "./fixtures/build-path.mjs";

const SERVER_SRC = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

/** Whole-line comments blanked, length-preservingly — a scan over prose that
 *  ARGUES for a rule matches the rule's own spelling and passes against code
 *  that no longer does it. This file's subject is documented at length in both
 *  sources it reads, so the trap is live rather than theoretical. */
const blank = (src) =>
  src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

test("keyEnv carries exactly the two names, and only when they have a value", () => {
  const env = { ANTHROPIC_API_KEY: "sk-a", XAI_API_KEY: "xai-b", SUPABASE_SERVICE_KEY: "srv", SITES: {} };
  assert.deepEqual(keyEnv(env), { ANTHROPIC_API_KEY: "sk-a", XAI_API_KEY: "xai-b" },
    "the container must get the two provider keys and nothing else off env");
});

test("keyEnv OMITS a missing key rather than sending undefined", () => {
  // The start config is serialised. A property whose value is undefined is not
  // "set to nothing" — it can arrive as the literal string "undefined", which
  // reaches the provider as a bad key and comes back 401: a real provider
  // status wearing the costume of a deploy we have to fix. Absent instead
  // produces the container's own named refusal, which says what to do.
  const out = keyEnv({ XAI_API_KEY: "xai-b" });
  assert.deepEqual(out, { XAI_API_KEY: "xai-b" });
  assert.equal("ANTHROPIC_API_KEY" in out, false, "an absent key must not appear as a property at all");
  for (const bad of ["", 0, null, false, ["sk"], {}]) {
    assert.deepEqual(keyEnv({ ANTHROPIC_API_KEY: bad }), {}, `unusable value passed on: ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(keyEnv(null), {}, "a missing env must not throw the container's constructor");
});

test("keyEnv does not mutate what it is handed", () => {
  // Unlike `takeKeys` in build-keys.mjs, which removes what it reads BECAUSE
  // nothing downstream may see it. This one is given the Worker's live
  // bindings, which the Worker still needs for its own design call.
  const env = { ANTHROPIC_API_KEY: "sk-a" };
  keyEnv(env);
  assert.equal(env.ANTHROPIC_API_KEY, "sk-a", "keyEnv must not strip the Worker's own key");
});

test("the two env names are one list, shared by both readings", () => {
  // Three surfaces have to agree: the Worker reads these off its bindings, the
  // Worker sets them on the start config, and the container deletes them from
  // process.env. A second spelling anywhere ends with a key set under the name
  // nothing reads — a 401 on a deploy that reported success.
  assert.deepEqual(Object.keys(SECRET_ENV).sort(), ["anthropic", "xai"]);
  assert.deepEqual(Object.values(SECRET_ENV).sort(), ["ANTHROPIC_API_KEY", "XAI_API_KEY"]);
});

test("SiteBuildContainer sets envVars from keyEnv, never from the whole env", () => {
  const src = blank(WORKER_SRC);
  const at = src.indexOf("class SiteBuildContainer");
  assert.ok(at > 0, "SiteBuildContainer is gone — rescope this guard");
  const body = src.slice(at, src.indexOf("\nasync function", at) + 1 || undefined).slice(0, 4000);
  assert.match(body, /this\.envVars\s*=\s*keyEnv\(env\)/,
    "the container's start config must carry the keys, through the ONE narrow reading");
  // NEVER THE WHOLE `env`. That object carries the R2 buckets, the dispatch
  // namespace, the Supabase service key and the site secrets key — all of which
  // the render check's child (which runs model-written page code) would then be
  // able to read.
  assert.doesNotMatch(body, /this\.envVars\s*=\s*(?:env|\{\s*\.\.\.\s*env)/,
    "the whole env must never become the container's environment");
});

test("the /model route calls through with the container's own taken keys", () => {
  const src = blank(SERVER_SRC);
  const at = src.indexOf('req.url === "/model"');
  assert.ok(at > 0, "the /model route is gone — rescope this guard");
  const body = src.slice(at, src.indexOf('req.url !== "/build"', at));
  assert.ok(body.length > 200, "the /model window is empty — this check would be vacuous");

  assert.match(body, /callBuilderModel\(\s*keysFrom\(BUILD_KEYS\)/,
    "the model call must read the keys taken out of process.env, not process.env itself");

  // THROUGH `oneAtATime`, and the busy counter is why. The point of moving
  // generation here is that the Worker walks away — and the moment it does the
  // library's inflight counter reaches zero, the sleepAfter clock starts, and
  // `onActivityExpired` asks /busy whether to stop this container. A call the
  // counter cannot see is a container killed mid-generation at five minutes.
  assert.match(body, /oneAtATime\(/,
    "a /model call the busy counter cannot see is one onActivityExpired will stop mid-call");

  // The caller may ask for LESS (the composed build budget) and never for more.
  assert.match(body, /Math\.min\(\s*want\s*,\s*BUILDER_CALL_MS\s*\)/,
    "the ceiling must be ours; a bound that lives only in the caller is one the next caller forgets");
});

test("a failed /model call answers with the provider's shape, not a flattened message", () => {
  const src = blank(SERVER_SRC);
  const at = src.indexOf('req.url === "/model"');
  const body = src.slice(at, src.indexOf('req.url !== "/build"', at));
  // `upstreamKind` in the Worker parses `detail` for the provider's error type
  // and the one actionable billing sentence, and the build route reports
  // `upstream` as the numeric status and nothing else. A 429 that came back
  // looking like a container fault loses both.
  for (const field of ["status", "detail"]) {
    assert.match(body, new RegExp(`\\b${field}:`), `a failed /model must carry ${field} so the Worker can still diagnose it`);
  }
});

test("build-call.mjs is still a leaf the container can package", () => {
  // The container image COPYs this file and `model-xai.mjs` and nothing else of
  // the prompt tier — `pagesRequest` reaches fifteen modules, three of them at
  // the repo ROOT and outside the `builder/` Docker build context, where
  // `COPY ../` is not legal. A new import here is a container that will not
  // start, reported by Cloudflare as "the container is not running".
  const src = fs.readFileSync(new URL("../builder/build-call.mjs", import.meta.url), "utf8");
  assert.deepEqual((src.match(/from "[^"]+"/g) || []).sort(), [`from "./model-xai.mjs"`],
    "build-call.mjs grew an import — it must stay a leaf the container can package");
  assert.ok(BUILDER_CALL_MS > 0, "the call ceiling must be a real number on both sides of the wire");
});

test("the Dockerfile ships what the /model route imports", () => {
  const df = fs.readFileSync(new URL("../builder/Dockerfile", import.meta.url), "utf8");
  for (const f of ["build-call.mjs", "model-xai.mjs", "build-keys.mjs"]) {
    assert.match(df, new RegExp(`\\b${f.replace(".", "\\.")}\\b`), `${f} is not COPYd into the build image`);
  }
});
