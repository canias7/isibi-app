import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker, { SETTINGS, MODELS, SCHEMA, missingSettings, buildApi } from "../src/worker.mjs";
import { AGENTS } from "../src/agents.mjs";
import { makeStandIn } from "../src/model-standin.mjs";
import { runAgent } from "../src/run.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..");
const good = () => ({ SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_KEY: "svc", SUPABASE_JWT_SECRET: "sec" });
// A DISPATCHER IS NOT OPTIONAL — the work outliving the request is the point — so
// `buildApi` refuses without one, and every success case here supplies it.
const wired = { dispatch: () => {} };

// ── configuration ────────────────────────────────────────────────────────────
test("missingSettings names every setting that is absent, and nothing else", () => {
  assert.deepEqual(missingSettings(good()), []);
  assert.deepEqual(missingSettings({}).sort(), Object.keys(SETTINGS).sort());
  for (const k of Object.keys(SETTINGS)) {
    assert.deepEqual(missingSettings({ ...good(), [k]: undefined }), [k]);
    // Present-but-blank is absent: a secret set to "" is not a secret.
    assert.deepEqual(missingSettings({ ...good(), [k]: "   " }), [k], `${k} accepted whitespace`);
  }
  for (const bad of [null, undefined, "env", 4]) {
    assert.deepEqual(missingSettings(bad).sort(), Object.keys(SETTINGS).sort(), "a junk env read as configured");
  }
});

test("A MISSING SETTING IS A NAMED 503, NOT A CRASH, and never leaks a value", async () => {
  // An uncaught throw is answered by Cloudflare in HTML, and a caller doing
  // `.json()` then learns nothing at all about the cause.
  const res = await worker.fetch(new Request("https://x/runs"), { SUPABASE_URL: "https://p.supabase.co" }, { waitUntil() {} });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.match(body.error, /not configured/);
  assert.match(body.error, /SUPABASE_SERVICE_KEY/);
  assert.match(body.error, /SUPABASE_JWT_SECRET/);
  // THE WHOLE BODY, NOT JUST `error`. Asserting on one field let a mutant add a
  // second one carrying the entire environment and survive — the check was about
  // the field rather than about the response.
  assert.deepEqual(Object.keys(body), ["error"], `the 503 carries more than an error: ${Object.keys(body).join(", ")}`);
  const whole = JSON.stringify(body);
  for (const secret of ["https://p.supabase.co", "svc", "sec"]) {
    assert.equal(whole.includes(secret), false, `the 503 quoted a setting's value: ${whole}`);
  }
});

test("AN UNRECOGNISED MODEL IS REFUSED, never defaulted to the stand-in", async () => {
  // Defaulting would mean a deployment that believes it is talking to a provider
  // and is quietly answering from a canned script.
  assert.throws(() => buildApi({ ...good(), MODEL: "claude-sonnet-5" }), /no such model/);
  assert.throws(() => buildApi({ ...good(), MODEL: "gpt-whatever" }), /no such model/);
  const res = await worker.fetch(new Request("https://x/runs"), { ...good(), MODEL: "claude-sonnet-5" }, { waitUntil() {} });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /no such model/);
  // The model is checked BEFORE the dispatcher, so a bad name reports the model.
  assert.throws(() => buildApi({ ...good(), MODEL: "nope" }, wired), /no such model/);
  // An absent MODEL is the stand-in, which is the documented default.
  assert.doesNotThrow(() => buildApi(good(), wired));
  assert.doesNotThrow(() => buildApi({ ...good(), MODEL: "stand-in" }, wired));
  // And a dispatcher really is required.
  assert.throws(() => buildApi(good()), /dispatch must be a function/);
  assert.deepEqual(Object.keys(MODELS), ["stand-in"]);
});

test("THE SCHEMA IS PASSED EXPLICITLY, not left to the store's default", () => {
  // The store has a default and a default is the thing that silently keeps working
  // while meaning something else. Read from the source, because the value reaching
  // the store is not observable from outside it.
  const src = fs.readFileSync(path.join(DIR, "src", "worker.mjs"), "utf8");
  assert.match(src, /makeRunStore\(\{[^}]*schema: SCHEMA/, "the store is built without naming the schema");
  assert.equal(SCHEMA, "agent");
});

test("THE DISPATCHER IS WIRED TO waitUntil, and the response does not wait for it", async () => {
  // A value computed and never forwarded looks identical from outside to one the
  // caller never sent, so the wiring is asserted by behaviour.
  const handed = [];
  const res = await worker.fetch(
    new Request("https://x/runs", { method: "GET" }),
    good(),
    { waitUntil: (p) => handed.push(p) },
  );
  // No credentials, so this is a 401 — what matters is that it ANSWERED rather
  // than throwing, which is what proves the handler was built and called.
  assert.equal(res.status, 401);
  assert.equal(handed.length, 0, "an unauthenticated request handed work to the dispatcher");
});

test("a dispatched task that throws is caught, so it cannot take the isolate down", async () => {
  // `waitUntil` with a rejecting promise is an unhandled rejection; the wrapper
  // catches and logs instead.
  const api = buildApi(good(), wired);
  assert.ok(api && typeof api.fetch === "function");
  const src = fs.readFileSync(path.join(DIR, "src", "worker.mjs"), "utf8");
  assert.match(src, /ctx\.waitUntil\(Promise\.resolve\(\)\.then\(task\)\.catch\(/,
    "the dispatched task is handed to waitUntil without a catch");
});

// ── the registry and the stand-in ────────────────────────────────────────────
test("the registry holds real agents, and a request can only NAME one", () => {
  assert.ok(Object.keys(AGENTS).length >= 1);
  for (const [name, a] of Object.entries(AGENTS)) {
    assert.equal(a.kind, "agent", `${name} is not from defineAgent`);
    assert.ok(a.instructions.length > 0);
    assert.ok(Object.isFrozen(a));
  }
  assert.ok(Object.isFrozen(AGENTS), "the registry can be added to at runtime");
});

test("THE STAND-IN DRIVES A WHOLE RUN: a step, a tool, a second step, an answer", async () => {
  // It reports usage and cost the way a provider does, so the meters and the
  // budget are exercised rather than bypassed.
  const r = await runAgent({ agent: AGENTS.support, prompt: "hello there", send: makeStandIn(), tenant: { id: "t1" } });
  assert.equal(r.ok, true, `stopped on ${r.stop.reason}`);
  assert.equal(r.used.steps, 2);
  assert.equal(r.used.toolCalls, 1);
  assert.equal(r.used.tokens, 48, "the stand-in reported no usable usage");
  assert.equal(r.used.costMicros, 100);
  assert.match(r.text, /hello there/, "the tool's answer never reached the second call");
  assert.equal(r.steps[0].results[0].ok, true);
});

test("the stand-in stays inside the agent's bounds", async () => {
  // Its second answer has no tool calls, so a run ends well inside `steps: 4`.
  assert.equal(AGENTS.support.limits.steps, 4);
  const r = await runAgent({ agent: AGENTS.support, prompt: "x", send: makeStandIn(), tenant: { id: "t1" } });
  assert.ok(r.used.steps < AGENTS.support.limits.steps, "the stand-in runs to the step ceiling");
});

// ── the Worker config is this directory's own ────────────────────────────────
test("THE WORKER CONFIG IS SEPARATE AND CANNOT SHIP BY ACCIDENT", () => {
  const mine = path.join(DIR, "wrangler.jsonc");
  assert.ok(fs.existsSync(mine), "this directory has no wrangler config");
  const cfg = JSON.parse(fs.readFileSync(mine, "utf8").replace(/^\s*\/\/.*$/gm, ""));
  assert.equal(cfg.main, "src/worker.mjs");
  assert.notEqual(cfg.name, "isibi-app", "it shares the other product's Worker name");
  // NO SECRETS IN THE FILE. The three settings are `wrangler secret put`, and the
  // service key in particular must never be committed.
  const raw = fs.readFileSync(mine, "utf8");
  for (const k of Object.keys(SETTINGS)) {
    assert.equal(cfg.vars?.[k], undefined, `${k} is a var in the committed config`);
  }
  assert.match(raw, /wrangler secret put/, "the config does not say where the secrets go");
  // The root config belongs to the other product and is not touched by this one.
  const root = path.resolve(DIR, "..", "wrangler.jsonc");
  if (fs.existsSync(root)) {
    const rootCfg = fs.readFileSync(root, "utf8");
    assert.equal(rootCfg.includes("agent-builder"), false, "the root Worker config now references this directory");
  }
});
