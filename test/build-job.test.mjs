// The job store the producer and the consumer both read.
//
// WHY THIS IS WORTH TESTING AT ALL. Every function here is one half of an
// agreement between two sides that never run together: the request writes an
// object and sends a message, and a queue consumer minutes later reads them.
// There is no type system between them and no round trip to catch a mismatch —
// a producer writing a shape the consumer refuses is a build that silently never
// happens, and a consumer that reads a shape loosely is a build charged to
// whatever `auth` happened to parse as.
//
// The wiring — that the route really hands off, that the consumer really calls
// the build — is in build-queue.test.mjs, where it is driven through the real
// router. This file is the vocabulary.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  JOB_KIND, JOB_PREFIX, JOB_VERSION,
  isJobId, jobKey, resultKey, newJobId,
  packJob, readJob, packResult, readResult, readMessage,
  replayRequest, pollDelayMs,
} from "../builder/build-job.mjs";

const SRC = fs.readFileSync(new URL("../builder/build-job.mjs", import.meta.url), "utf8");
const ID = "0123456789abcdef0123456789abcdef";

test("an id is 32 hex characters, and nothing else is one", () => {
  assert.ok(isJobId(ID));
  for (const bad of [
    "", "abc", ID + "0", ID.toUpperCase(), ID.slice(0, 31),
    "0123456789abcdef0123456789abcdeg",       // not hex
    "../../sites/smoke/index.html",
    null, undefined, 123, {}, [ID],
  ]) {
    assert.equal(isJobId(bad), false, `${JSON.stringify(bad)} was accepted as a job id`);
  }
  // AN ARRAY THAT STRINGIFIES TO A VALID ID IS STILL NOT ONE. `String(["a"])`
  // is `"a"` — the coercion this repo has shipped as a real bug three times, on
  // a role, on an access level and on a Stripe plan.
  assert.equal(isJobId([ID]), false, "an array carrying an id was accepted as one");
});

test("a key can only ever be built from an id we minted", () => {
  assert.equal(jobKey(ID), `${JOB_PREFIX}${ID}.json`);
  assert.equal(resultKey(ID), `${JOB_PREFIX}${ID}.result.json`);
  // THEY MUST DIFFER, and this is not pedantry: the producer's whole test for
  // "has the build answered" is whether the result object exists. One key for
  // both would make the job it just wrote read as an answer, and the request
  // would return before the consumer had even been handed the work.
  assert.notEqual(jobKey(ID), resultKey(ID));
  for (const bad of ["../etc", "", null, "sites/x"]) {
    assert.throws(() => jobKey(bad), /refusing/, `jobKey built a key from ${JSON.stringify(bad)}`);
    assert.throws(() => resultKey(bad), /refusing/, `resultKey built a key from ${JSON.stringify(bad)}`);
  }
  // AND UNDER A PREFIX NOTHING SERVES. `sites/<slug>/` is the public one; a job
  // carries a live access token, so it living outside that is the reason it may
  // hold one at all.
  assert.ok(!jobKey(ID).startsWith("sites/"), "jobs are under the prefix the public is served from");
});

test("newJobId produces an id isJobId accepts, from the randomness it is given", () => {
  // Injected rather than reached for, so this is a fact about the function and
  // not about whichever runtime happens to be running it.
  const id = newJobId((b) => { for (let i = 0; i < b.length; i++) b[i] = i; });
  assert.ok(isJobId(id), `newJobId produced ${id}, which isJobId refuses`);
  assert.equal(id, "000102030405060708090a0b0c0d0e0f");
  // LEADING ZEROES SURVIVE. A byte of 0 has to render as "00": dropped, the id
  // is 31 characters and every key built from it is refused — an intermittent
  // failure on roughly one build in sixteen, which is the worst kind.
  assert.equal(newJobId((b) => b.fill(0)), "0".repeat(32));
  assert.equal(newJobId((b) => b.fill(255)), "f".repeat(32));
  assert.equal(newJobId((b) => b.fill(1)), "01".repeat(16));
  // 16 bytes in, 32 characters out — a shorter buffer would be a shorter id.
  let seen = 0;
  newJobId((b) => { seen = b.length; });
  assert.equal(seen, 16, "the id is not 128 bits");
});

test("a job round-trips, and anything that is not one is refused", () => {
  const j = packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer tok", body: '{"brief":"a barber"}', uid: "u-1", at: 1234 });
  assert.equal(j.v, JOB_VERSION);
  const back = readJob(j);
  assert.deepEqual(back, { url: "https://gofarther.dev/api/site/react-build", auth: "Bearer tok", body: '{"brief":"a barber"}', uid: "u-1", at: 1234 });
  // A VERSION BUMP REFUSES RATHER THAN REINTERPRETS. The fields a wrong reading
  // would misplace are the auth token and the body.
  assert.equal(readJob({ ...j, v: JOB_VERSION + 1 }), null);
  assert.equal(readJob({ ...j, v: undefined }), null);
  // A TRUNCATED OR HAND-EDITED OBJECT IS NOT A JOB.
  assert.equal(readJob({ ...j, url: "" }), null, "a job with no url was accepted");
  assert.equal(readJob({ ...j, body: "" }), null, "a job with no body was accepted");
  assert.equal(readJob({ ...j, body: 42 }), null, "a non-string body was accepted");
  assert.equal(readJob({ ...j, auth: null }), null, "a non-string auth was accepted");
  for (const bad of [null, undefined, "a string", 7, [j]]) {
    assert.equal(readJob(bad), null, `${JSON.stringify(bad)} was read as a job`);
  }
  // AN EMPTY TOKEN IS A LEGAL JOB. The build's own `authUser` refuses it and
  // answers 401, which is the honest answer; refusing it here would turn a
  // signed-out caller's build into silence instead.
  assert.ok(readJob(packJob({ url: "u", auth: "", body: "{}" })), "a job with no token was refused before the build could 401");
});

test("a result round-trips, and an unusable one is null rather than guessed at", () => {
  const r = packResult({ status: 200, type: "application/json", body: '{"ok":true}', uid: "u-1" });
  assert.deepEqual(readResult(r), { status: 200, type: "application/json", body: '{"ok":true}', uid: "u-1" });
  // EVERY STATUS THE BUILD REALLY ANSWERS WITH SURVIVES. The refusals are the
  // half most likely to be quietly mangled, because the tests that drive a
  // build drive the success.
  for (const s of [200, 401, 402, 409, 422, 500, 501, 503]) {
    assert.equal(readResult(packResult({ status: s, body: "{}" })).status, s);
  }
  assert.equal(readResult({ ...r, status: 99 }), null, "an impossible status was read as a result");
  assert.equal(readResult({ ...r, status: 600 }), null);
  assert.equal(readResult({ ...r, status: "200" }), null, "a stringified status was read as a result");
  assert.equal(readResult({ ...r, body: null }), null);
  assert.equal(readResult({ ...r, v: JOB_VERSION + 1 }), null);
  for (const bad of [null, undefined, "x", [r]]) assert.equal(readResult(bad), null);
  // A MISSING STATUS BECOMES 500 ON THE WAY IN, NOT ON THE WAY OUT. Packing a
  // Response whose status could not be read must not produce an object that
  // then reads back as a 200.
  assert.equal(packResult({ body: "{}" }).status, 500);
  assert.equal(packResult({ status: NaN, body: "{}" }).status, 500);
  // An empty body is legal — a 204 has one — and must not read as a broken
  // envelope, which would tell a customer we lost an answer we have.
  assert.ok(readResult(packResult({ status: 204, body: "" })), "an empty body was read as an unusable result");
});

test("the consumer acts on our own message shape and nothing else", () => {
  assert.deepEqual(readMessage({ kind: JOB_KIND, id: ID }), { id: ID });
  for (const bad of [
    null, undefined, "a string", 7, [{ kind: JOB_KIND, id: ID }],
    { id: ID },                                  // no kind
    { kind: "something-else", id: ID },
    { kind: JOB_KIND },                          // no id
    { kind: JOB_KIND, id: "nope" },
    { kind: JOB_KIND, id: [ID] },
  ]) {
    assert.equal(readMessage(bad), null, `${JSON.stringify(bad)} was read as a build to run`);
  }
});

test("the replayed request carries what the build reads off a request, and nothing stale", async () => {
  // MEASURED, NOT TRIMMED BY INSTINCT: the build touches `request` three times —
  // authUser, readJsonBody, useQuota — and all three read only the Authorization
  // header and the body.
  const req = replayRequest({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer tok", body: '{"brief":"a barber"}' });
  assert.equal(req.method, "POST");
  assert.equal(req.url, "https://gofarther.dev/api/site/react-build");
  assert.equal(req.headers.get("authorization"), "Bearer tok");
  assert.equal(req.headers.get("content-type"), "application/json");
  assert.deepEqual(await req.json(), { brief: "a barber" });
  // NO STALE content-length. The body has been through JSON.parse and back, so
  // a copied header would describe bytes that no longer exist — and
  // `readJsonBody` checks that header FIRST and refuses on it.
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    assert.equal(Number(declared), new TextEncoder().encode('{"brief":"a barber"}').length,
      "content-length describes something other than the body being sent");
  }
  // WITH NO TOKEN THERE IS NO HEADER, rather than an empty one. `authUser` and
  // `useQuota` both slice a bearer prefix off whatever is there; an empty header
  // is a token of "" presented as though one were sent.
  const anon = replayRequest({ url: "https://gofarther.dev/x", auth: "", body: "{}" });
  assert.equal(anon.headers.get("authorization"), null);
});

test("a job round-trips all the way into a request the build can read", async () => {
  // THE PROPERTY THAT SPANS BOTH SIDES: what the producer stores is what the
  // consumer runs. Asserted as a composition rather than against two fixtures
  // that agree with each other and with neither end — the `routeOf` lesson.
  const stored = JSON.parse(JSON.stringify(packJob({
    url: "https://gofarther.dev/api/site/react-build",
    auth: "Bearer tok",
    body: JSON.stringify({ brief: "a café in Lisbon", slug: "cafe" }),
    uid: "u-1",
    at: 1,
  })));
  const job = readJob(stored);
  assert.ok(job, "a job did not survive the JSON round trip R2 puts it through");
  const req = replayRequest(job);
  assert.equal(req.headers.get("authorization"), "Bearer tok");
  assert.deepEqual(await req.json(), { brief: "a café in Lisbon", slug: "cafe" });
});

test("the wait is fast for a refusal and slow for a build, and bounded", () => {
  // The two answers are minutes apart: a refusal — unauthenticated, no credit,
  // a name already taken — comes back in about a second, and a real build in
  // six to twelve minutes. One interval serves neither.
  assert.ok(pollDelayMs(0) <= 500, "the first look is too slow — every refusal reads as a hang");
  let prev = 0;
  for (let i = 0; i < 40; i++) {
    const d = pollDelayMs(i);
    assert.ok(d >= prev, `the delay went backwards at attempt ${i}`);
    assert.ok(d > 0, "a zero delay is a spin");
    assert.ok(d <= 5000, `the delay is unbounded at attempt ${i} (${d}ms)`);
    prev = d;
  }
  // IT REALLY BACKS OFF. A flat interval satisfies every assertion above.
  assert.ok(pollDelayMs(30) > pollDelayMs(0), "the delay never grows — a 12-minute build is polled at refusal speed");
  // Nonsense in is the first interval, never NaN — a NaN delay is a timer that
  // fires immediately, which is the spin this bounds.
  for (const bad of [null, undefined, "x", -5]) {
    assert.ok(Number.isFinite(pollDelayMs(bad)) && pollDelayMs(bad) > 0, `pollDelayMs(${JSON.stringify(bad)}) is not a usable delay`);
  }
  // Twelve minutes of polling has to be affordable. At these intervals a real
  // build costs a few hundred R2 reads, not tens of thousands.
  let t = 0, reads = 0;
  while (t < 12 * 60 * 1000) { t += pollDelayMs(reads); reads++; }
  assert.ok(reads < 400, `a 12-minute build would cost ${reads} reads`);
});

test("the module performs no I/O — a mistake here cannot be a mistake about a bucket", () => {
  // The whole reason this is a module: the caller does every read and write, so
  // every decision above is drivable with nothing but literals. A `fetch` or a
  // bucket reference appearing here would make that false silently.
  const code = SRC.replace(/^[ \t]*\/\/[^\n]*/gm, (m) => " ".repeat(m.length)).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  for (const forbidden of ["fetch(", "SITES_BUCKET", "BUILD_QUEUE", ".put(", ".get(", "process."]) {
    assert.ok(!code.includes(forbidden), `build-job.mjs reaches for ${forbidden} — it is no longer a pure vocabulary`);
  }
  // …and the blanking really removed the comments, or the sweep above is
  // reporting a clean file it never read.
  assert.ok(code.includes("export function isJobId"), "the comment blanker ate the source");
  assert.ok(!code.includes("access token"), "the comment blanker left the prose in, so the sweep proved nothing");
});
