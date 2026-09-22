// THE JOB'S TRANSPORT, AND THE RECORD OF WHERE IT RAN.
//
// ── WHY THIS FILE EXISTS, AND IT IS THE SWEEP'S ANSWER ─────────────────────
//
// The first sweep over the container move killed 24 of 34 and left TEN
// survivors — every one of them in this half, and none in the duration or
// fallback halves. That split is the finding: those two came with guards of
// their own, and this one shipped with nothing but RE-ANCHORS of guards that
// already existed. A re-anchored guard proves the property it always proved;
// it says nothing about the property just added.
//
// So every survivor is a case below, named by what it would have let through:
//
//   the page call on the module's default transport   ← run 45's defect, exactly
//   the runner not handing its sender over            ← the same defect, one hop up
//   the env dropping the sender, or the stream flag
//   callFailure dropping `cause` or `wire`            ← the fields run 45 needed
//   the addon's catch recording only the message      ← what run 45 actually did
//   the container not saying where the job ran
//   the Worker claiming to be the container
//   the deadline never reaching the record

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { callFailure } from "../builder/build-call.mjs";
import { makeContainerEnv } from "../builder/container-env.mjs";
import { longPost } from "../builder/long-post.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
/** Comments explain the transport and therefore spell it — this repo's most-recorded own-goal in a guard. */
const bare = (s) => s.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");

const GATEWAY = { url: "https://gofarther.dev/api/job/abc", token: "t" };
const SB = { url: "https://ujrqdmmtcptvimazlhom.supabase.co" };

// ── the env carries the transport ───────────────────────────────────────────

test("the job env carries the sender and the stream flag, and the Worker's env carries neither", () => {
  const send = () => {};
  const env = makeContainerEnv({ gateway: GATEWAY, sb: SB, send });
  assert.equal(env.MODEL_SEND, send, "the job env dropped the sender it was handed — run 45's defect one hop up");
  assert.equal(env.MODEL_STREAM, true, "the job env does not ask the provider to stream");

  // TWO FIELDS, TWO QUESTIONS. A caller may want the sender without the stream
  // — that is how the two are tested apart, which run 45 could not be.
  const noStream = makeContainerEnv({ gateway: GATEWAY, sb: SB, send, stream: false });
  assert.equal(noStream.MODEL_SEND, send, "the sender went with the stream flag — they are separable on purpose");
  assert.equal(noStream.MODEL_STREAM, false);

  // A NON-FUNCTION IS NOT A SENDER. Anything else would reach `callModel` as a
  // fourth argument it would try to call.
  for (const junk of ["longPost", 1, {}, [], true]) {
    const e = makeContainerEnv({ gateway: GATEWAY, sb: SB, send: junk });
    assert.equal(e.MODEL_SEND, undefined, "a " + typeof junk + " was taken as the transport");
  }
  // AND ABSENT IS THE WORKER: nothing handed in means nothing on the env, which
  // is what keeps workerd byte-for-byte unchanged.
  const bare2 = makeContainerEnv({ gateway: GATEWAY, sb: SB });
  assert.equal(bare2.MODEL_SEND, undefined);
});

test("the RUNNER hands `longPost` over — the hop, not just the module", () => {
  // A TEXT READ, and it is the honest one here: `runJob` is driven elsewhere
  // with its own env handed in, which is exactly the shape that cannot see this
  // argument. What must be true is that the real launch path names the real
  // sender, so the two are read together.
  const src = bare(fs.readFileSync(new URL("../builder/container-job.mjs", import.meta.url), "utf8"));
  assert.match(src, /import \{ longPost \} from "\.\/long-post\.mjs";/, "the runner does not import the container's transport");
  assert.match(src, /makeContainerEnv\(\{[^\n]*send: longPost[^\n]*\}\)/, "the runner builds the job env without its transport — the page call would be back on undici's 300s ceiling");
  assert.match(src, /makeContainerEnv\(\{[^\n]*deadlineAt: launch\.deadlineAt[^\n]*\}\)/, "the launch's deadline never reaches the job env, so the record cannot say how long it had");
  // AND IT IS A REAL FUNCTION, not a name that resolves to undefined.
  assert.equal(typeof longPost, "function", "long-post.mjs does not export a callable transport");
});

// ── the two readers, and the page call that did not go through them ─────────

test("EVERY long call reads the job's transport — including the PAGE call, which did not", () => {
  // `generateSitePages` defaulted to `build-call.mjs`'s own export, which means
  // the default send and no stream WHICHEVER SIDE IT RUNS ON. That default is
  // right in workerd and was fatal in the container: run 45, 270,025ms,
  // `TypeError: fetch failed`, nothing published.
  const src = bare(WORKER);
  const at = src.indexOf("function pagesCall(env) {");
  assert.ok(at > 0, "pagesCall is gone — rescope this guard");
  const body = src.slice(at, src.indexOf("\n}", at));
  assert.match(body, /callModel\(keys, req, budget, modelSend\(env\), modelOpts\(env, null\)\)/,
    "the page call is back on the module's default transport — exactly run 45's defect");
  // …AND IT IS THE CALL `generateSitePages` REALLY HANDS DOWN.
  // RE-ANCHORED 2026-09-17: the forwarder gained `kind` and `keep` after the
  // call, so `call || pagesCall(env))` is no longer the end of the line. The
  // property is that the call it hands down is composed from THIS module's
  // readers rather than defaulted, which is what run 45 turned on.
  assert.match(src, /genPages\(keysFrom\(env\),[^\n]*call \|\| pagesCall\(env\)[,)]/,
    "generateSitePages no longer composes its call from this module's readers");

  // DRIVEN, so the two readers are not merely present but composed correctly.
  const pick = (name) => {
    const i = src.indexOf("const " + name + " = (env");
    assert.ok(i > 0, name + " moved — rescope this guard");
    return src.slice(i, src.indexOf("\n", i));
  };
  const seen = [];
  const make = new Function("callModel", `
    ${pick("modelSend")}
    ${pick("modelOpts")}
    ${src.slice(at, src.indexOf("\n}", at) + 2)}
    return pagesCall;
  `)((keys, req, budget, send, opts) => { seen.push({ send, opts }); });

  const send = () => {};
  make({ MODEL_SEND: send, MODEL_STREAM: true })("k", "r", 1);
  assert.equal(seen[0].send, send, "the page call did not receive the job's sender");
  assert.deepEqual(seen[0].opts, { stream: true }, "the page call did not ask the provider to stream");

  make({})("k", "r", 1);
  assert.equal(seen[1].send, null, "the Worker's page call invented a sender");
  assert.equal(seen[1].opts, null, "the Worker's page call invented an opts object — it must be byte-for-byte what it was");
});

// ── what a failed call says it was ──────────────────────────────────────────

test("callFailure keeps the four facts that tell three deaths apart — DRIVEN", () => {
  // A QUIET CONNECTION: no headers ever arrived and no bytes flowed. This is
  // the death streaming is supposed to fix.
  const quiet = new TypeError("fetch failed");
  quiet.cause = { code: "ECONNRESET", message: "socket hang up" };
  quiet.wire = { headersMs: -1, chars: 0 };
  assert.deepEqual(callFailure(quiet), { kind: "TypeError", cause: "ECONNRESET", headersMs: -1, chars: 0 });

  // A LIFETIME CAP: bytes HAD flowed when it died. Streaming cannot beat this
  // one, and without `chars` the two are indistinguishable — which is the whole
  // reason the 270-second story was a hypothesis and not a diagnosis.
  const capped = new TypeError("fetch failed");
  capped.cause = { code: "ECONNRESET" };
  capped.wire = { headersMs: -1, chars: 41231 };
  assert.equal(callFailure(capped).chars, 41231, "a death after bytes flowed reads the same as one before");

  // OUR OWN TIMER, which is already distinguishable and is kept in one shape.
  const mine = new Error("timed out");
  mine.name = "TimeoutError";
  assert.deepEqual(callFailure(mine), { kind: "TimeoutError" });

  // A CAUSE WITH NO CODE still says something rather than nothing.
  const noCode = new TypeError("fetch failed");
  noCode.cause = { message: "getaddrinfo ENOTFOUND api.x.ai" };
  assert.equal(callFailure(noCode).cause, "getaddrinfo ENOTFOUND api.x.ai");
  const strCause = new TypeError("x");
  strCause.cause = "plain string";
  assert.equal(callFailure(strCause).cause, "plain string");

  // BOUNDED, so nothing long rides out through the one free-text field.
  const long = new TypeError("x");
  long.cause = { message: "y".repeat(5000) };
  assert.ok(callFailure(long).cause.length <= 120, "the cause is unbounded");
  const longCode = new TypeError("x");
  longCode.cause = { code: "z".repeat(500) };
  assert.ok(callFailure(longCode).cause.length <= 60, "the cause code is unbounded");

  // JUNK ANSWERS AN EMPTY OBJECT, never a throw: this runs inside a catch.
  for (const junk of [null, undefined, "boom", 42, true]) assert.deepEqual(callFailure(junk), {});
  // AND IT READS NO HEADER, BODY OR URL — the property that makes it safe to
  // put on a trace, checked over the source rather than trusted.
  const mod = bare(fs.readFileSync(new URL("../builder/build-call.mjs", import.meta.url), "utf8"));
  const fnAt = mod.indexOf("export function callFailure(e) {");
  assert.ok(fnAt > 0, "callFailure moved — rescope this guard");
  const fn = mod.slice(fnAt, mod.indexOf("\n}", fnAt));
  for (const forbidden of ["headers", "body", "url", "req", "token", "key", "authorization"]) {
    assert.ok(!new RegExp("\\b" + forbidden + "\\b", "i").test(fn), "callFailure reads `" + forbidden + "` — a secret could ride out on it");
  }
});

test("the addon's page failure records the cause and the timing, not just the message", () => {
  const src = bare(WORKER);
  const at = src.indexOf(`aMark("pages", "fail"`);
  assert.ok(at > 0, "the addon's page-failure mark is gone — rescope this guard");
  const line = src.slice(at, src.indexOf("\n", at));
  assert.match(line, /\.\.\.callFailure\(e\)/, "the failure records only the message again — which is all run 45 left behind");
  assert.match(line, /ms: Date\.now\(\) - aPagesT0/, "the failure does not say how long the call had been running — the number that makes 270s falsifiable");
  // AND THE NAME IS IMPORTED, or it is a ReferenceError inside a catch — the
  // one place a throw is hardest to see.
  assert.match(src, /import \{[^}]*\bcallFailure\b[^}]*\} from "\.\/builder\/build-call\.mjs"/, "callFailure is used without being imported");
});

// ── where the job ran ───────────────────────────────────────────────────────

test("the record says where the job ran, and ABSENT is the Worker", () => {
  const env = makeContainerEnv({ gateway: GATEWAY, sb: SB, send: () => {}, deadlineAt: 1_900_000_000_000 });
  assert.equal(env.JOB_WHERE, "container", "the container no longer says where the job is running");
  assert.equal(env.JOB_DEADLINE_AT, 1_900_000_000_000, "the launch's deadline never reaches the record");
  // A DEADLINE THAT IS NOT ONE IS LEFT OFF rather than recorded as zero.
  for (const junk of [0, -1, NaN, Infinity, "soon", null, undefined]) {
    const e = makeContainerEnv({ gateway: GATEWAY, sb: SB, deadlineAt: junk });
    assert.equal(e.JOB_DEADLINE_AT, undefined, "a deadline of " + JSON.stringify(junk) + " was recorded");
  }

  // THE READER, DRIVEN. Only the runner can set `JOB_WHERE`, so the default
  // cannot flatter itself — a Worker run that called itself the container would
  // make the whole record worthless in the one direction it is for.
  const src = bare(WORKER);
  const pick = (name) => {
    const i = src.indexOf("const " + name + " = (env");
    assert.ok(i > 0, name + " moved — rescope this guard");
    return src.slice(i, src.indexOf("\n", i));
  };
  const detailAt = src.indexOf("const jobRunDetail = (env) => ({");
  assert.ok(detailAt > 0, "jobRunDetail moved — rescope this guard");
  const scope = new Function(`
    ${pick("jobWhere")}
    ${src.slice(detailAt, src.indexOf("});", detailAt) + 3)}
    return { jobWhere, jobRunDetail };
  `)();

  assert.equal(scope.jobWhere(env), "container");
  assert.equal(scope.jobWhere({}), "worker", "a Worker run claims to be the container");
  assert.equal(scope.jobWhere(undefined), "worker");
  assert.equal(scope.jobWhere({ JOB_WHERE: "Container" }), "worker", "the location is matched loosely — only the runner's own word counts");
  assert.equal(scope.jobWhere({ JOB_WHERE: true }), "worker");

  const d = scope.jobRunDetail(env);
  assert.equal(d.where, "container");
  assert.equal(d.deadlineAt, 1_900_000_000_000);
  assert.ok(typeof d.deadlineInMs === "number", "the record does not say how long is left");
  assert.deepEqual(scope.jobRunDetail({}), { where: "worker" }, "a Worker run records a deadline it does not have");
});

test("every trace's FIRST mark says where it is running — both routes", () => {
  const src = bare(WORKER);
  const marks = [...src.matchAll(/editTrace\.mark\("run", "ok", jobRunDetail\(env\)\)/g)];
  assert.equal(marks.length, 2, `the run mark is on ${marks.length} routes, expected both the edit and the addon`);
  // AND IT SITS ON THE LINE AFTER THE TRACE IS MADE, so it cannot be recorded
  // for a trace that does not exist and cannot be pushed below a failure.
  const news = [...src.matchAll(/editTrace = newTrace\(\{ slug: ownerSlug, uid: ou\.id \}\);/g)];
  assert.equal(news.length, 2, "the trace is created somewhere other than the two routes");
  for (const n of news) {
    const after = src.slice(n.index, n.index + 260);
    assert.match(after, /editTrace\.mark\("run", "ok", jobRunDetail\(env\)\)/,
      "a trace is created without recording where it is running — the gap that made run 45 unfalsifiable");
  }
  // FENCED: the record never costs the job. A throw here would be a job lost to
  // its own diagnostics.
  assert.match(src, /try \{ editTrace\.mark\("run", "ok", jobRunDetail\(env\)\); \} catch/, "the run mark is not fenced");
});
