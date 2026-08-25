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

/* --------------------------------------- and the BUILD really goes through it */

test("THE BUILD'S PAGE GENERATION IS MADE IN THE CONTAINER, and the edit lanes are not", () => {
  // THE WIRE, which is the half a module test cannot see. `/model` shipped
  // UNREACHABLE on purpose so it could be proven before anything depended on
  // it — and a route nothing calls is exactly the state twelve features in this
  // repo have shipped and stayed in.
  const w = blank(WORKER_SRC);

  // ONE caller into the module carries a container caller, and it is the BUILD's.
  const calls = [...w.matchAll(/generateSitePages\(env,[\s\S]*?\);/g)].map((m) => m[0]);
  assert.ok(calls.length >= 3, `expected the build and both edit lanes to generate; found ${calls.length}`);
  const viaContainer = calls.filter((c) => /containerPagesCall\(/.test(c));
  assert.equal(viaContainer.length, 1,
    `${viaContainer.length} generation calls go through the container — the build path must, and the two edit lanes must not`);
  // …and it is the one inside `buildAndPublishPages`, not one of the lanes. The
  // brief it sends is the build's own composed directive, which no edit lane
  // has: an edit sends the customer's instruction.
  assert.match(viaContainer[0], /briefWithLayout\(\{ brief, plan/,
    "the container call is not the build's own generation — an edit lane is being routed through it");

  // AND THE LANES STAY ON THE WORKER. Explicit rather than implied by the count
  // above, because a lane silently gaining the hop buys a new failure mode on
  // the CHEAP path for a call that takes seconds.
  for (const c of calls.filter((x) => !/containerPagesCall\(/.test(x))) {
    assert.ok(!/containerPagesCall/.test(c), "an edit lane now makes its model call in the container");
  }
});

test("the container hop preserves a provider's own answer rather than flattening it", () => {
  // THIS IS THE HALF THAT DECIDES WHAT THE CUSTOMER IS TOLD. `upstreamKind`
  // parses `detail` for the provider's error type and the one sentence that
  // names an empty account; the build route reports `upstream` as "the numeric
  // status from the model API and nothing else"; and `isCallTimeout` reads
  // `e.name`. A hop that threw a bare Error would turn a real 429 — retry in a
  // minute — into an undiagnosable container fault, on every build.
  const hop = blank(WORKER_SRC);
  const at = hop.indexOf("function containerPagesCall(");
  assert.ok(at > 0, "containerPagesCall is gone — rescope this guard");
  const body = hop.slice(at, hop.indexOf("\n}", at));
  // THE ASSIGNMENT, NOT THE WORD. The first draft asked whether each field
  // appeared anywhere in the function and every one of them does — `fail.status`
  // is read to decide the retry, `status: null` is written when the container
  // itself was unreachable. So a mutant DELETING the line that puts the
  // provider's status on the error SURVIVED: a presence standing in for a
  // property, in the guard written for exactly that. A real 429 would have
  // reached the route as `upstream: null`, which means "no provider answered" —
  // so "wait a minute and try again" would read as a container fault.
  // THE TWO SIDES SPELL THE CLASS DIFFERENTLY, and that is the pairing rather
  // than an inconsistency: `/model` answers a JSON `{status, detail, kind}` —
  // `name` on a plain object would read as the error's own — and an Error
  // carries it as `name`, which is what `isCallTimeout` asks for.
  for (const [onError, fromFail, why] of [
    ["status", "status", "the route reports `upstream` from it, and null is itself the signal that no provider answered"],
    ["detail", "detail", "`upstreamKind` parses it for the billing sentence and the one that names an empty account"],
    ["name", "kind", "`isCallTimeout` reads it, so a timeout would stop being one"],
  ]) {
    // Assigned onto the error FROM the failure, whichever way it is spelled — a
    // direct assignment or `defineProperty`, since `name` is not writable the
    // ordinary way on every engine.
    const assigned = new RegExp(`e\\.${onError}\\s*=\\s*[^;]*fail\\.${fromFail}|defineProperty\\(e, "${onError}"[\\s\\S]{0,120}fail\\.${fromFail}`);
    assert.match(body, assigned, `the re-thrown failure does not carry the container's \`${fromFail}\` — ${why}`);
  }

  // AND THE DECISION IS THE MODULE'S, not a second copy of it. Two readings of
  // "was money spent" is how one comes to say yes while the other says no, and
  // the shape of that disagreement is a customer billed twice.
  assert.match(body, /if \(!retryHere\(/, "the hop decides for itself whether a retry is safe");
  assert.match(hop, /import \{[^}]*\bretryHere\b[^}]*\} from "\.\/builder\/build-call\.mjs"/,
    "retryHere is used without being imported — a ReferenceError on the build path");
});

test("WHICH SIDE MADE THE CALL RIDES ON THE RESPONSE", () => {
  // Without this the change is UNMEASURABLE: a build that used the container and
  // one that fell back to the Worker produce the same pages, the same cost and
  // the same site. Whether generation got out from under the consumer's
  // fifteen-minute cap would be a thing nobody could ever check.
  const w = blank(WORKER_SRC);
  // Written by the hop…
  assert.match(w, /out\.via = "container"/, "the container path does not record itself");
  assert.match(w, /out\.via = "worker"/, "the fallback does not record itself");
  // …carried off the build function…
  assert.match(w, /if \(genPath\.via\) out\.genVia = genPath\.via;/,
    "the build's result drops which side made the call");
  // …and onto the wire. Both ends, because either alone passes with the wire cut.
  assert.match(w, /genVia: pages\.genVia \|\| undefined/,
    "the response literal does not carry genVia — the field would be computed and dropped");
});

test("AND IT RIDES ON THE ROW THAT SURVIVES, not only the response", () => {
  // THE RESPONSE IS THE THING THIS PLATFORM KEEPS LOSING. The edge resets a
  // build's socket at around 285 seconds and that has happened ELEVEN recorded
  // times — runs 35, 36, 37 and 38 all finished with nobody holding the answer.
  // So a measurement that lives only on the response is one this platform has a
  // measured history of never seeing, and `genVia` is the only thing that says
  // whether the ten-minute call got out from under the consumer's cap.
  const w = blank(WORKER_SRC);
  assert.match(w, /mark\?\.\("img", \{ viaContainer:/,
    "the trace does not record which side made the call — the one row that survives a reset says nothing about it");
  // A NUMBER, because `makeTrace` takes only finite numbers and drops everything
  // else SILENTLY. That rule is deliberate — it is what stops a connection
  // string or a model's prose reaching a trace by accident — so a string here
  // would be a field written, dropped and never noticed.
  assert.match(w, /viaContainer: genPath\.via === "container" \? 1 : 0/,
    "the trace field is not a finite number, so makeTrace drops it and the mark says nothing");
});

test("A BUILD KILLED MID-GENERATION STILL SAYS THE HOP WAS MADE", () => {
  // THE `img` MARK NEEDS GENERATION TO HAVE RETURNED, and the builds worth
  // asking about are exactly the ones where it did not. MEASURED, run 38
  // (`northgroup-4`): design 181,636ms, generation cut at 595,900ms by
  // `BUILD_BUDGET_MS`, `done: true ok: false`, and NO `img` step in the row at
  // all — so the one question the container move exists to settle was
  // unanswerable on the build that most needed answering.
  //
  // THE `pages` MARK IS WRITTEN ON THE WAY OUT EITHER WAY (run 38's row has one,
  // carrying `ms: 595900, buildMs: 0, credits: 0`), which is what makes it the
  // right place for a fact about a build that died.
  const w = blank(WORKER_SRC);
  // The attempt is recorded BEFORE the answer, or a hop that never comes back
  // leaves nothing behind.
  assert.match(w, /out\.tried = 1;/,
    "the container hop does not record that it was attempted, so a build cut off mid-generation says nothing about it");
  const attempt = w.indexOf("out.tried = 1;");
  const fetched = w.indexOf("http://build/model");
  assert.ok(attempt > 0 && fetched > attempt,
    "the attempt is recorded AFTER the fetch — which is exactly the ordering that loses a hop that never returns");
  // AND IT IS THE CALLER'S OBJECT, WHICH IS THE HALF RUN 39 PROVED WAS MISSING.
  // `genPath` was declared inside `buildAndPublishPages` and carried out on its
  // return value — and that function THROWS when generation is aborted, so
  // `pages = await buildAndPublishPages(...)` never assigns and the route is
  // left holding the placeholder literal it declared beside the call. Run 39's
  // mark came back `{ms: 608372, buildMs: 0, credits: 0}` with neither field, on
  // the one run bought to read them. The measurement had moved from "the
  // response" (destroyed by the edge reset) to "the return value" (destroyed by
  // a throw) — unreadable on exactly the builds it exists for, twice over.
  assert.match(w, /genPathOut/,
    "buildAndPublishPages does not take the caller's object, so a build that throws loses which side made the call");
  assert.match(w, /genPathOut: genPath,/,
    "the build call site does not hand its own object in — the flag would die with the stack again");
  // …and onto the row, as numbers, read off THAT object rather than the result.
  assert.match(w, /\.\.\.\(genPath\.tried \? \[\["genTried", 1\]\] : \[\]\)/,
    "the pages mark reads genTried off the build's RESULT — the object a thrown build never produces");
  assert.match(w, /\.\.\.\(genPath\.via \? \[\["genVia", genPath\.via === "container" \? 1 : 0\]\] : \[\]\)/,
    "the pages mark reads genVia off the build's RESULT, or not as a finite number — makeTrace drops the second silently");
  // THE ROUTE OWNS IT, and that is the whole fix: declared where the placeholder
  // literal is, so it is in scope for the mark whether the build returned or not.
  const litAt = w.indexOf('let pages = { page: "placeholder"');
  const ownAt = w.indexOf("const genPath = {};", litAt);
  const callAt = w.indexOf("pages = await buildAndPublishPages", litAt);
  assert.ok(litAt > 0 && ownAt > litAt && callAt > ownAt,
    "genPath is not declared by the route between the placeholder literal and the build call — a throw loses it");

  // AND THE WATCH READS THE ONE THAT SURVIVES. Anchored on `img` alone it prints
  // nothing for a build that died, which is the state this whole test is about.
  const watch = blank(fs.readFileSync(new URL("../scripts/build-as-owner.mjs", import.meta.url), "utf8"));
  assert.match(watch, /s === "pages"/,
    "the owner watch does not read the pages step, so a build killed mid-generation reports no path at all");
  assert.match(watch, /container-holding/,
    "the watch has no wording for a hop that never came back — the third case, and the informative one on a dead build");
});

test("the /model body cap fits the largest request the Worker can send", async () => {
  // FOUND BY MEASURING RATHER THAN BY READING, and the failure it prevents is a
  // silence. `/model` shared `MAX_BODY` with `/build`, which is 4MB — fine for a
  // bare page request (34,763 characters, measured) and far under what a build
  // carrying an ATTACHMENT sends. That would have answered 413, the Worker's hop
  // would have read it as "no provider was reached", and `retryHere` would have
  // correctly made the call here instead — so every build with a picture or a
  // price list attached would quietly keep running its ten-minute call on the
  // side with a fifteen-minute cap. It would have looked exactly like the
  // feature working.
  const ctx = await import("../builder/site-context.mjs");
  // DERIVED FROM THE CAPS THAT DECIDE IT, never restated. Two numbers written
  // down twice is how one rises and the other does not — and the symptom of
  // that is not an error, it is attachment builds silently going back to the
  // capped side.
  //
  // THE PROMPT HALF IS BUILT RATHER THAN GUESSED. A first draft wrote 40,000 for
  // it and the DATA prompt alone is 42,201 characters — an understatement in the
  // one direction that matters, since this bound exists to be a ceiling. The
  // real request is the one thing here that can be asked directly.
  const { pagesRequest } = await import("../builder/page-gen.mjs");
  const prompt = JSON.stringify({
    req: pagesRequest({ brief: "a barber shop in Leeds", spec: { tables: [{ name: "bookings", access: "collect", columns: [{ name: "at", type: "text" }] }] },
      brand: "Sharp Fade", attachments: [], model: "claude-sonnet-5", priorPages: null }),
    callMs: BUILDER_CALL_MS,
  }).length;
  assert.ok(prompt > 30000, `the page request measured ${prompt} characters — too small to be the real prompt`);
  const worst = prompt + ctx.BLOCK_TOTAL + ctx.TEXT_TOTAL;
  const src = blank(SERVER_SRC);
  const cap = src.match(/const MAX_MODEL_BODY = ([^;]+);/);
  assert.ok(cap, "/model no longer has its own body cap — it is back on /build's, which an attachment overruns");
  const bytes = Function(`"use strict"; return (${cap[1]});`)();
  assert.ok(bytes > worst,
    `MAX_MODEL_BODY is ${bytes} and the largest request the Worker can send is ${worst} — every build with an attachment would 413 and fall back`);

  // AND THE ROUTE USES IT. A cap declared and not read is the same silence with
  // a constant to point at.
  const at = src.indexOf('req.url === "/model"');
  const body = src.slice(at, src.indexOf('req.url !== "/build"', at));
  assert.match(body, /mBody\.length > MAX_MODEL_BODY/, "the /model route still measures against /build's cap");
  // …and `/build` keeps its own, which is a memory decision about the dist and
  // has nothing to do with a prompt.
  assert.match(src, /const MAX_BODY = /, "the /build cap is gone — the dist payload is now unbounded");
});

test("THE OWNER'S OWN WATCH READS IT, or it is carried and read by nobody", () => {
  // THE LAST HOP, AND IT IS THE ONE THIS REPO KEEPS LOSING. `genVia` on the
  // response and `viaContainer` on the trace are both correct and both invisible
  // if nothing prints them — which is the shape twelve dead features here have
  // taken, every one of them right at both ends with the wire cut.
  //
  // `build as owner` is what watches a real build, and it already reads `db=`
  // and `tables=` straight off the trace for exactly this reason: run 34's
  // response-based log line "never executed, on the very run that proved it".
  const src = fs.readFileSync(new URL("../scripts/build-as-owner.mjs", import.meta.url), "utf8")
    .split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");
  assert.match(src, /steps\.find\(\(s\) => s && s\.s === "img"\)/,
    "the watch does not look at the img mark, so the one thing it carries is unread");
  assert.match(src, /viaContainer/, "the watch reads the img mark and not the field on it");
  // AND IT REACHES THE LINE. Computed into a variable the summary does not
  // include is the same silence one statement later — which is precisely how
  // `oneClickBlocked` and eleven others came to be computed by nobody's reader.
  const line = src.match(/const shape = \[([^\]]*)\]/);
  assert.ok(line, "the trace summary no longer assembles a shape line — rescope this guard");
  assert.match(line[1], /\bvia\b/, "which side made the call is computed and left out of the line that prints");
});
