// FIRE AND STORE — the half that lets the Worker stop waiting.
//
// WHY IT EXISTS: moving the model CALL into the container was only half the
// job. The Worker still held the socket for the whole generation, on the side
// with a hard fifteen-minute consumer cap — so runs 38 and 39 both died at the
// budget having published nothing, at ~13 minutes and ~6 credits each.
//
// `POST /model/start` answers in milliseconds with an id and does the work in
// the background; `GET /model/result?id=` says whether it is finished. No
// single consumer invocation is ever long, and the cap stops binding.
//
// WHAT A SOURCE READ CAN AND CANNOT SEE. `build-server.mjs` listens on a port
// at import time, so it cannot be imported here. The properties below are
// therefore asserted on the source — on PROPERTIES rather than spellings, which
// is this repo's most repeated own-goal — and the ROUTING half is driven for
// real in `test/integration/site-build.mjs`, which starts the actual server
// with no keys and reads the named refusal back out of the job store.
//
// THE ONE PROPERTY NEITHER CAN SHOW is that the busy counter really holds
// across a ten-minute generation with nothing connected. That was measured by
// hand against the real server with a bogus key, so the call made a real
// round trip: `busy={"busy":true,"jobs":1,"sinceMs":82}` with
// `result=pending`, three polls running. It is held here by composition:
// `oneAtATime` increments `_busy` SYNCHRONOUSLY at the door (its own contract,
// guarded in container-hold.test.mjs) and this route calls it without awaiting.
// Both halves are asserted below, because either one alone is worthless.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SERVER_SRC = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

/** Whole-line comments blanked, length-preservingly. This route is documented
 *  at length in its own source — the prose spells `oneAtATime`, `await`,
 *  `touchedAt` and `delete` while ARGUING about them — so a scan over the raw
 *  text matches the explanation and passes against code that stopped doing it.
 *  Length-preserving so every offset below still points at the real line. */
const blank = (src) =>
  src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

const S = blank(SERVER_SRC);

/** The `/model/start` handler's own body, bounded by the route that follows it
 *  rather than by a byte count — a window sized in bytes is outrun by the next
 *  comment somebody writes, which this repo has recorded ten-plus times. */
function startBody() {
  const at = S.indexOf('req.url === "/model/start"');
  assert.ok(at > 0, "the container has no /model/start route — the Worker has nothing to fire at");
  const next = S.indexOf('req.url.startsWith("/model/result")', at);
  assert.ok(next > at, "the /model/result route no longer follows /model/start — the window has no end");
  return S.slice(at, next);
}

/** The `/model/result` handler's own body, bounded by the plain `/model` route
 *  below it — which must keep existing, since the whole design is that the
 *  synchronous path is untouched. */
function resultBody() {
  const at = S.indexOf('req.url.startsWith("/model/result")');
  assert.ok(at > 0, "the container has no /model/result route — a fired job could never be read back");
  const next = S.indexOf('req.url === "/model"', at);
  assert.ok(next > at, "the synchronous /model route no longer follows — the window has no end");
  return S.slice(at, next);
}

test("THE WORK IS QUEUED THROUGH oneAtATime, or the container is stopped mid-generation", () => {
  const body = startBody();
  // This is the load-bearing one. `SiteBuildContainer` has a five-minute idle
  // timeout and `onActivityExpired` asks `/busy` before stopping — and `/busy`
  // reads `_busy`, which only `oneAtATime` moves. A generation started outside
  // it makes this container look idle the instant the Worker walks away, so
  // the first thing that happens after the fire is the idle clock starting on
  // work that takes ten minutes.
  assert.match(body, /oneAtATime\(/,
    "the fired job does not go through oneAtATime — nothing holds the busy counter, so the container is stopped five minutes into a ten-minute generation");
});

test("…AND IT IS NOT AWAITED, which is the entire point of the route", () => {
  const body = startBody();
  // Awaited, this is `/model` with extra steps: the socket is held for the
  // whole generation and the consumer's fifteen-minute cap binds exactly as
  // before. The response must go back with an id and nothing else.
  assert.ok(!/await\s+oneAtATime\(/.test(body),
    "the fired job is awaited — the response would wait out the whole generation, which is the bug this route exists to fix");
  // And the answer really is the id rather than the model's reply.
  assert.match(body, /send\(res,\s*200,\s*\{\s*ok:\s*true,\s*id\s*\}\)/,
    "the 200 does not hand back the job id — the caller has nothing to poll with");
  assert.ok(!/send\(res,\s*200,[^\n]*answer/.test(body),
    "the start route answers with the model's reply — then it is the synchronous route wearing a new name");
});

test("A FAILED GENERATION IS RECORDED, never left pending for ever", () => {
  const body = startBody();
  // Two failures if the catch goes. The job stays at `pending` for its whole
  // TTL, so a caller polls until its own deadline for an answer that is never
  // coming — indistinguishable from a slow model. And `oneAtATime` returns a
  // promise this route deliberately does not await, so a rejection escaping is
  // an unhandled one, which in a Node request handler kills the process and
  // takes every other build on this container with it.
  assert.match(body, /catch\s*\(e\)\s*\{/,
    "the fired job does not catch its own failure — it would sit at pending for ever and the rejection would be unhandled");
  assert.match(body, /state:\s*"failed"/,
    "a failed generation is not stored as failed — the caller cannot tell it apart from one still running");
});

test("THE FAILURE SHAPE IS PRESERVED, so a real 429 does not wear a container fault", () => {
  const body = startBody();
  // The Worker parses `detail` for the provider's error type, reports
  // `upstream` as the numeric status and nothing else, and `retryHere` reads
  // `status` to decide whether money was already spent. Flattened to a
  // message, a rate limit the customer should retry in a minute arrives
  // looking like our container being broken.
  for (const field of ["status", "detail", "message", "kind"]) {
    assert.match(body, new RegExp(`\\b${field}:`),
      `the stored failure drops \`${field}\` — the Worker cannot tell a provider refusal from a container fault`);
  }
  assert.match(body, /status:\s*\(e\s*&&\s*e\.status\)\s*\|\|\s*null/,
    "the provider's numeric status is not carried through — retryHere cannot tell whether tokens were already spent");
  assert.match(body, /kind:\s*String\(\(e\s*&&\s*e\.name\)/,
    "the error class is not carried — a timeout and a refusal read alike, and only one of them is safe to retry");
});

test("THE CEILING IS OURS: the budget hands out the CAPPED number, not the asked one", () => {
  const body = startBody();
  // The same rule the synchronous route already states. A caller asking for an
  // hour would hold a container lane for an hour; the composed build budget
  // legitimately asks for LESS, and honouring that is what stops a call
  // outliving the build that wanted it.
  //
  // ASSERTED AS A COMPOSITION, because the presence of the capping expression
  // is not the property. A sweep proved it: a mutant that left
  // `Math.min(want, BUILDER_CALL_MS)` exactly where it was — as a dead line —
  // and handed `capMs` the raw `payload.callMs` instead SURVIVED a check that
  // only looked for the expression. A presence standing in for a property is
  // this repo's most-recorded test failure and this was another one.
  const cap = /const (\w+) = Number\.isFinite\(want\) && want > 0 \? Math\.min\(want, BUILDER_CALL_MS\) : BUILDER_CALL_MS;/.exec(body);
  assert.ok(cap, "the start route does not cap the caller's callMs at BUILDER_CALL_MS at all");
  const capped = cap[1];
  // The budget must return THAT name — the capped one — and nothing else.
  assert.match(body, new RegExp(`capMs:\\s*\\(\\)\\s*=>\\s*${capped}\\b`),
    `the budget does not hand out \`${capped}\` — the cap is computed and then not used, so a caller could hold a lane for as long as it liked`);
  // And it must not reach past the cap to the raw request on the way out.
  const budgetLine = /const budget = \{[^}]*\}/.exec(body);
  assert.ok(budgetLine, "the budget object is not built here");
  assert.ok(!/payload/.test(budgetLine[0]),
    "the budget reads the request body directly — whatever the cap above says, the caller's own number is what reaches the call");
});

test("THE BODY IS CAPPED BEFORE IT IS BUFFERED, and the socket is really cut", () => {
  const body = startBody();
  // A generation request reaches ~13.6MB with attachments; without a cap this
  // is an unauthenticated way to make the container buffer whatever somebody
  // sends. `MAX_MODEL_BODY` is the same constant the synchronous route uses —
  // two numbers would drift, and the direction they drift in is one route
  // silently refusing a build the other accepts.
  //
  // The three halves are asserted apart for the reason the cap above needed
  // to be: naming the constant is not enforcing it. Compared, acted on, and
  // answered — a mutant can leave any one of the three standing.
  assert.match(body, /sBody\.length > MAX_MODEL_BODY/,
    "the start route buffers the request without comparing it to the cap");
  assert.match(body, /req\.destroy\(\)/,
    "an oversized body is flagged and the socket is left open — the container goes on buffering it");
  assert.match(body, /413/, "an oversized body is not refused with 413");
});

test("THE JOB STORE IS BOUNDED, and refuses rather than growing", () => {
  const src = blank(SERVER_SRC);
  assert.match(src, /const MAX_MODEL_JOBS\s*=\s*\d+/,
    "there is no cap on the job store — a leak here is a container holding whole model answers, megabytes each, for the rest of its life");
  const body = startBody();
  assert.match(body, /MODEL_JOBS\.size\s*>=\s*MAX_MODEL_JOBS/,
    "the cap is declared and never checked");
  assert.match(body, /429/, "an over-capacity start is not refused — the store would grow without bound");
});

test("THE SWEEP IS KEYED ON touchedAt, NEVER ON startedAt", () => {
  const src = blank(SERVER_SRC);
  const at = src.indexOf("function sweepModelJobs");
  assert.ok(at > 0, "nothing sweeps the job store");
  const body = src.slice(at, src.indexOf("\n}", at));
  // A generation legitimately runs for ten minutes and a poll refreshes it, so
  // a start-time TTL deletes a job while it is still being produced — and the
  // caller then reads `unknown`, which means "this container lost the work".
  // It would be the one answer that is definitely wrong.
  assert.match(body, /touchedAt/,
    "the sweep is keyed on the start time — a ten-minute generation would be deleted from under the caller producing it");
  // And it must be longer than the hold, or a job ages out while its caller is
  // still entitled to it.
  const ttl = /const MODEL_JOB_TTL_MS\s*=\s*([\d\s*_]+);/.exec(src);
  assert.ok(ttl, "the job TTL is not declared");
  // eslint-disable-next-line no-eval
  const ms = eval(ttl[1]);
  assert.ok(ms >= 30 * 60 * 1000,
    `the job TTL (${ms}ms) is under MAX_BUSY_HOLD_MS — an answer could age out while the container is still being held for it`);
});

test("A FINISHED JOB IS NOT DELETED ON READ", () => {
  const body = resultBody();
  // A queue delivers AT LEAST once, so a duplicated resume message must find
  // the same answer. Deleted on read, the second delivery gets `unknown` —
  // which reads as the container having been recycled, and loses a generation
  // that really did finish. The sweep is what bounds the store, not the read.
  assert.ok(!/MODEL_JOBS\.delete/.test(body),
    "reading a result deletes it — a duplicated queue delivery would lose a generation that really finished");
});

test("UNKNOWN IS ITS OWN ANSWER AND MUST NOT READ AS PENDING", () => {
  const body = resultBody();
  // A container recycled mid-generation has LOST the work however it was
  // stored. A caller told "pending" there polls until its own deadline for an
  // answer nobody is producing; told "unknown" it can start again.
  assert.match(body, /state:\s*"unknown"/,
    "an id the store does not have is not reported as unknown");
  const unknownAt = body.indexOf('state: "unknown"');
  const pendingAt = body.indexOf('state: "pending"');
  assert.ok(unknownAt > 0 && pendingAt > unknownAt,
    "the missing-job answer does not come before the pending answer — a lost job could be reported as still running");
  // All three states must be distinguishable, or the caller has no decision to
  // make: pending means poll, done means take it, failed means read the shape,
  // unknown means the work is gone.
  for (const s of ["pending", "done", "failed", "unknown"]) {
    assert.match(body, new RegExp(`state:\\s*"${s}"`),
      `the result route cannot answer \`${s}\` — that state is unreachable`);
  }
});

test("READING A RESULT REFRESHES IT, so polling cannot sweep the job out", () => {
  const body = resultBody();
  // The sweep is keyed on `touchedAt` and the poll is what moves it. Without
  // this the refresh never happens on the one path that proves somebody is
  // still waiting, so a long generation is swept mid-flight by its own caller.
  assert.match(body, /job\.touchedAt\s*=\s*Date\.now\(\)/,
    "a poll does not refresh the job — the sweep would delete a live generation from under the caller polling it");
});

test("THE SYNCHRONOUS ROUTE IS UNTOUCHED — this is an addition, not a replacement", () => {
  const src = blank(SERVER_SRC);
  // Every existing build goes through `/model`, and it is what the cheap edit
  // lanes and the compile hop still use. Replacing it rather than adding
  // beside it would move the whole platform onto a path nothing has driven.
  assert.match(src, /req\.method === "POST" && req\.url === "\/model"\s*\)/,
    "the synchronous /model route is gone — every existing caller would 404");
});

test("THE ID IS UNGUESSABLE, not a counter", () => {
  const body = startBody();
  // The container is shared by every build on the platform. A sequential id
  // would let one build read another's generation back out of the store.
  assert.match(body, /randomUUID\(\)/,
    "the job id is not a UUID — a guessable id lets one build read another's answer");
  const src = blank(SERVER_SRC);
  assert.match(src, /import \{[^}]*randomUUID[^}]*\} from "node:crypto"/,
    "randomUUID is used and never imported — a ReferenceError on the one route that fires the generation");
});

// ── the model call rides `longPost`, never Node's fetch ──────────────────────
//
// Node's fetch is undici; undici's headers timeout is 300 seconds and cannot be
// raised from the request. A non-streaming provider sends headers only when the
// whole generation is done, and generations here measure 333–620s — so every
// fired generation died at exactly 300s, status-less, classified `no-request`,
// refired into the same wall and stopped (runs 41 and 42, four for four). The
// container's own `node:https` sender is the way out, and these hold it at both
// ends: every model call site passes it, and the function itself really works —
// driven against a live local server, because "the parameter is declared and
// passed" survived a mutant here once before while every generation still ran
// on the transport being avoided.
test("every model call in the container carries longPost", () => {
  // DERIVED over every CALL site (the import line names it too, so calls are
  // matched by the leading `await `): a third call site added later is covered
  // without anybody remembering this file.
  // To the end of the statement, not to the first `)` — the first argument is
  // `keysFrom(BUILD_KEYS)`, and a flat `[^)]*` scan stops inside it. This repo
  // has recorded that exact miss five times; this was the sixth.
  const calls = [...SERVER_SRC.matchAll(/await callBuilderModel\((.+)\);/g)];
  assert.ok(calls.length >= 2, `expected the two model call sites, found ${calls.length} — rescope this guard`);
  for (const c of calls) {
    assert.match(c[1], /longPost/, "a model call site does not pass the transport — that call runs on undici's 300s headers timeout");
  }
  // And the transport is the node module's `.request`, with no fetch anywhere
  // inside it — the 300s wall coming back in through the function built to
  // avoid it would be the quietest possible regression.
  const w = fnWindow("function longPost(");
  assert.match(w, /\.request\(/, "longPost does not use node http/https");
  assert.ok(!/\bfetch\(/.test(w), "longPost calls fetch — the exact ceiling it exists to avoid");
  // A rejection on abort carries the SIGNAL'S OWN REASON — a TimeoutError —
  // so `retryHere` refuses to bill a second call for a timeout, rather than
  // misreading it as a request that never went out and refiring forever.
  assert.match(w, /signal\.reason/, "an aborted call does not carry the signal's reason — a timeout would be classified no-request and refired");
});

function fnWindow(anchor) {
  const at = SERVER_SRC.indexOf(anchor);
  assert.ok(at > 0, anchor + " is gone — rescope this guard");
  let d = 0;
  for (let i = SERVER_SRC.indexOf("{", at); i < SERVER_SRC.length; i++) {
    const ch = SERVER_SRC[i];
    if (ch === "{") d++;
    else if (ch === "}") { d--; if (d === 0) return SERVER_SRC.slice(at, i + 1); }
  }
  assert.fail("unbalanced braces after " + anchor);
}

// DRIVEN, with the function's real text lifted out of the source — the server
// listens at import time, so it cannot be imported; running a copy typed here
// would prove the copy. The local server answers over plain http, which the
// function serves protocol-faithfully for exactly this reason.
test("longPost survives late headers, reports a refusal, and aborts as a TimeoutError", async (t) => {
  const { createServer } = await import("node:http");
  const httpsMod = (await import("node:https")).default;
  const httpMod = (await import("node:http")).default;
  const longPost = new Function("http", "https", "return " + fnWindow("function longPost("))(httpMod, httpsMod);

  let seen = null;
  const srv = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      seen = { method: req.method, headers: req.headers, body };
      if (req.url === "/slow") {
        // HEADERS DELAYED past the request being fully sent — the shape a
        // non-streaming generation has, and the shape undici's fetch kills.
        setTimeout(() => { res.writeHead(200, { "content-type": "application/json" }); res.end('{"answer":42}'); }, 150);
      } else if (req.url === "/refuse") {
        res.writeHead(429); res.end("busy");
      } // /never: no answer at all — the abort case.
    });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  t.after(() => srv.close());

  const r = await longPost(base + "/slow", { method: "POST", headers: { "content-type": "application/json" }, body: '{"q":1}' });
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { answer: 42 });
  assert.equal(seen.body, '{"q":1}');
  assert.equal(seen.headers["content-length"], "7", "content-length is not the payload's own");
  // NO accept-encoding: fetch always sends one, so its absence is the proof the
  // request did not ride fetch — and it is what keeps the body identity-encoded,
  // since nothing here decompresses.
  assert.equal(seen.headers["accept-encoding"], undefined, "an accept-encoding header went out — the answer may come back compressed with nothing to decompress it");

  const bad = await longPost(base + "/refuse", { method: "POST", body: "x" });
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 429);
  assert.equal(await bad.text(), "busy");

  await assert.rejects(
    () => longPost(base + "/never", { method: "POST", body: "x", signal: AbortSignal.timeout(120) }),
    (e) => e && e.name === "TimeoutError",
    "an aborted call must reject with the signal's TimeoutError, or retryHere reads it as no-request and refires",
  );
});
