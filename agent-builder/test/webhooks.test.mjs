import test from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERY_REFUSALS, DELIVERY_WINDOW_MS, ID_HEADER, SIG_HEADER, TS_HEADER,
  makeDeliveryApi, sameSignature, signDelivery, verifyDelivery,
} from "../src/webhooks.mjs";

const SECRET = "s3cr3t-endpoint";
const NOW = 1_700_000_000_000;
const row = (over = {}) => ({
  id: "wh1", tenantId: "t1", agentId: "a1", event: "order.paid", secret: SECRET, enabled: true, ...over,
});
const headers = (o) => new Headers(o);

test("⚠ THE ACCOUNT COMES FROM THE VERIFIED ENDPOINT, never from the payload", async () => {
  const body = JSON.stringify({ tenant: "somebody-else", tenant_id: "x", agent_id: "y", name: "evil.event" });
  const ts = String(NOW);
  const seen = await verifyDelivery({
    id: "wh1", headers: headers({ [SIG_HEADER]: await signDelivery(SECRET, ts, body), [TS_HEADER]: ts }),
    rawBody: body, readEndpoint: async () => row(), now: () => NOW,
  });
  assert.equal(seen.ok, true);
  // EVERY ONE OF THESE IS THE ROW'S, and the body carried a different value for three of them.
  assert.equal(seen.tenantId, "t1");
  assert.equal(seen.agentId, "a1");
  assert.equal(seen.event, "order.paid");
  // AND THE ANSWER CARRIES NOTHING ELSE — no secret, and no body field promoted to a field of
  // its own. A census rather than five absences, so a key added later is a red run.
  assert.deepEqual(Object.keys(seen).sort(), ["agentId", "event", "key", "ok", "tenantId"]);
});

test("⚠ THE SECRET NEVER LEAVES THE MODULE — not in an answer, not in a refusal", async () => {
  const ts = String(NOW);
  const answers = [];
  const body = "{}";
  answers.push(await verifyDelivery({
    id: "wh1", headers: headers({ [SIG_HEADER]: await signDelivery(SECRET, ts, body), [TS_HEADER]: ts }),
    rawBody: body, readEndpoint: async () => row(), now: () => NOW,
  }));
  for (const h of [{}, { [TS_HEADER]: ts }, { [SIG_HEADER]: "beef", [TS_HEADER]: ts }]) {
    answers.push(await verifyDelivery({
      id: "wh1", headers: headers(h), rawBody: body, readEndpoint: async () => row(), now: () => NOW,
    }));
  }
  const text = JSON.stringify(answers);
  assert.doesNotMatch(text, new RegExp(SECRET), "a secret reached an answer");
  // THE OBSERVER, ALIVE: the assertion above is a negative one, so prove the answers are real.
  assert.equal(answers[0].ok, true);
  assert.deepEqual(answers.slice(1).map((a) => a.why), ["no-signature", "no-signature", "bad-signature"]);
});

test("every refusal is named, and each names ITS OWN cause", async () => {
  const ts = String(NOW);
  const body = JSON.stringify({ a: 1 });
  const sig = await signDelivery(SECRET, ts, body);
  const ask = (over = {}) => verifyDelivery({
    id: "wh1", headers: headers({ [SIG_HEADER]: sig, [TS_HEADER]: ts, ...over.headers }),
    rawBody: over.rawBody === undefined ? body : over.rawBody,
    readEndpoint: over.readEndpoint ?? (async () => row()),
    now: over.now ?? (() => NOW),
  });
  // THE CONTROL FIRST, or every refusal below is satisfied by a verifier that refuses all.
  assert.equal((await ask()).ok, true);
  assert.equal((await ask({ headers: { [SIG_HEADER]: "" } })).why, "no-signature");
  assert.equal((await ask({ headers: { [TS_HEADER]: "" } })).why, "no-timestamp");
  assert.equal((await ask({ headers: { [TS_HEADER]: "not-a-number" } })).why, "no-timestamp");
  assert.equal((await ask({ rawBody: 7 })).why, "bad-body");
  assert.equal((await ask({ readEndpoint: async () => null })).why, "no-endpoint");
  assert.equal((await ask({ readEndpoint: async () => row({ enabled: false }) })).why, "disabled");
  assert.equal((await ask({ readEndpoint: async () => { throw new Error("down"); } })).why, "unavailable");
  assert.equal((await ask({ rawBody: JSON.stringify({ a: 2 }) })).why, "bad-signature");
  // ⚠ AN OUTAGE AND A MISSING ENDPOINT ARE SEPARATE, which is the pair that matters: reading a
  // read that failed as "no such endpoint" reports every customer's integration as deleted for
  // as long as the database is unreachable.
  assert.notEqual((await ask({ readEndpoint: async () => { throw new Error("down"); } })).why,
    (await ask({ readEndpoint: async () => null })).why);
  // AND EVERY REASON IS ON THE DECLARED LIST, so a new one cannot go unlisted.
  for (const why of ["no-signature", "no-timestamp", "bad-body", "no-endpoint", "disabled", "unavailable", "bad-signature", "stale"]) {
    assert.ok(DELIVERY_REFUSALS.includes(why), `${why} is not on DELIVERY_REFUSALS`);
  }
});

test("⚠ THE WINDOW IS TWO-SIDED, and a signature cannot be reused outside it", async () => {
  const ts = String(NOW);
  const body = "{}";
  const sig = await signDelivery(SECRET, ts, body);
  const at = (t) => verifyDelivery({
    id: "wh1", headers: headers({ [SIG_HEADER]: sig, [TS_HEADER]: ts }),
    rawBody: body, readEndpoint: async () => row(), now: () => t,
  });
  assert.equal((await at(NOW)).ok, true);
  assert.equal((await at(NOW + DELIVERY_WINDOW_MS)).ok, true, "the edge is inside the window");
  assert.equal((await at(NOW + DELIVERY_WINDOW_MS + 1)).why, "stale");
  // ⚠ THE FUTURE HALF IS THE ONE A ONE-SIDED WINDOW MISSES: a sender that simply stamps a
  // delivery a year ahead would have a signature that never goes stale.
  assert.equal((await at(NOW - DELIVERY_WINDOW_MS - 1)).why, "stale");
  // AND THE TIMESTAMP IS INSIDE THE SIGNED TEXT, so moving it invalidates the signature rather
  // than merely shifting the window — driven, because a signature over the body alone would
  // pass this whole case and make the window bound nothing.
  const moved = await verifyDelivery({
    id: "wh1", headers: headers({ [SIG_HEADER]: sig, [TS_HEADER]: String(NOW + 1) }),
    rawBody: body, readEndpoint: async () => row(), now: () => NOW,
  });
  assert.equal(moved.why, "bad-signature");
});

test("the delivery's identity is the sender's when it gives one, and the signature when it does not", async () => {
  const ts = String(NOW);
  const body = "{}";
  const sig = await signDelivery(SECRET, ts, body);
  const ask = (h) => verifyDelivery({
    id: "wh1", headers: headers({ [SIG_HEADER]: sig, [TS_HEADER]: ts, ...h }),
    rawBody: body, readEndpoint: async () => row(), now: () => NOW,
  });
  const own = await ask({ [ID_HEADER]: " dlv-99 " });
  assert.equal(own.key, "dlv-99", "the sender's own id is not trimmed and taken");
  const derived = await ask({});
  assert.match(derived.key, /^sig:[0-9a-f]{64}$/);
  // ⚠ IT IS DETERMINISTIC OVER THE SAME DELIVERY, which is the whole property: the key is what
  // `agent.events_one_per_key` absorbs a retry on, so one that changed per attempt would
  // deduplicate nothing.
  assert.equal((await ask({})).key, derived.key);
  // AND IT IS NOT THE SECRET, nor derived in a way that leaks it — it is what the sender
  // already put in a header.
  assert.doesNotMatch(derived.key, new RegExp(SECRET));
});

test("sameSignature compares length first and then every character", () => {
  assert.equal(sameSignature("abcd", "abcd"), true);
  assert.equal(sameSignature("abcd", "abce"), false);
  assert.equal(sameSignature("abcd", "abcde"), false, "a longer string must not match");
  assert.equal(sameSignature("abcd", "abc"), false);
  // REFUSED, NEVER COERCED: `String(["abcd"])` is `"abcd"`, this repository's most-repeated
  // value trap, and a header is caller-supplied.
  for (const bad of [null, undefined, 7, ["abcd"], "", "   ", {}]) {
    assert.equal(sameSignature(bad, "abcd"), false, `${JSON.stringify(bad)} matched`);
    assert.equal(sameSignature("abcd", bad), false, `${JSON.stringify(bad)} matched the other way`);
  }
});

test("⚠ THE DELIVERY ROUTE: 202 on a signed delivery, 401 on everything else, 503 on our own outage", async () => {
  const emitted = [];
  const built = (over = {}) => makeDeliveryApi({
    readEndpoint: async (id) => (id === "wh1" ? row() : null),
    emit: over.emit ?? (async (a) => { emitted.push(a); return { ok: true, repeat: false }; }),
    newId: () => "ev1", now: () => NOW,
  });
  const body = JSON.stringify({ amount: 42 });
  const ts = String(NOW);
  const sig = await signDelivery(SECRET, ts, body);
  const post = (api, h, b = body, path = "/deliver/wh1") =>
    api.fetch(new Request(`https://x${path}`, { method: "POST", body: b, headers: h }));

  const good = await post(built(), { [SIG_HEADER]: sig, [TS_HEADER]: ts });
  assert.equal(good.status, 202, "a signed delivery was not accepted");
  assert.deepEqual(await good.json(), { accepted: true, repeat: false });
  assert.equal(good.headers.get("cache-control"), "no-store");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].source, "webhook");
  assert.equal(emitted[0].tenant, "t1");

  // ⚠ ONE SENTENCE AND ONE STATUS FOR EVERY REFUSAL, or this is an oracle: a sender could tell
  // a real endpoint from an invented one by reading the difference.
  const sentences = new Set();
  for (const [h, b, path] of [
    [{ [TS_HEADER]: ts }, body, "/deliver/wh1"],
    [{ [SIG_HEADER]: "beef", [TS_HEADER]: ts }, body, "/deliver/wh1"],
    [{ [SIG_HEADER]: sig, [TS_HEADER]: ts }, JSON.stringify({ amount: 43 }), "/deliver/wh1"],
    [{ [SIG_HEADER]: sig, [TS_HEADER]: ts }, body, "/deliver/nope"],
  ]) {
    const res = await post(built(), h, b, path);
    assert.equal(res.status, 401, `${path} with ${JSON.stringify(h)} answered ${res.status}`);
    sentences.add(JSON.stringify(await res.json()));
  }
  assert.equal(sentences.size, 1, `four causes gave ${sentences.size} different answers`);

  // OUR OWN OUTAGE IS A 503, because a sender retries one and gives up on a 401 — and the key
  // is what makes that retry safe.
  const down = await post(built({ emit: async () => { throw new Error("down"); } }), { [SIG_HEADER]: sig, [TS_HEADER]: ts });
  assert.equal(down.status, 503);
  // A CHAIN TOO DEEP IS OURS AND NOT THEIRS, so it is a 503 too; any other refusal is a 400.
  const deep = await post(built({ emit: async () => ({ ok: false, error: "too-deep" }) }), { [SIG_HEADER]: sig, [TS_HEADER]: ts });
  assert.equal(deep.status, 503);
  const nope = await post(built({ emit: async () => ({ ok: false, error: "bad-name" }) }), { [SIG_HEADER]: sig, [TS_HEADER]: ts });
  assert.equal(nope.status, 400);

  // A REPEAT IS A SUCCESS AND SAYS SO, or a well-behaved sender retries for ever.
  const again = await post(built({ emit: async () => ({ ok: true, repeat: true }) }), { [SIG_HEADER]: sig, [TS_HEADER]: ts });
  assert.equal(again.status, 202);
  assert.deepEqual(await again.json(), { accepted: true, repeat: true });
});

test("a body that is not an object is an event with no details, never a refusal", async () => {
  const emitted = [];
  const api = makeDeliveryApi({
    readEndpoint: async () => row(),
    emit: async (a) => { emitted.push(a); return { ok: true }; },
    newId: () => "ev1", now: () => NOW,
  });
  const ts = String(NOW);
  for (const body of ["[1,2]", '"hello"', "null", "not json at all", ""]) {
    const sig = await signDelivery(SECRET, ts, body);
    const res = await api.fetch(new Request("https://x/deliver/wh1", {
      method: "POST", body, headers: new Headers({ [SIG_HEADER]: sig, [TS_HEADER]: ts }),
    }));
    // THE SIGNATURE PROVED WHO SENT IT, so refusing would let a sender's formatting decide
    // whether a real, verified delivery counts. `agent.events.payload` is an object by its own
    // constraint, so `{}` is what such a delivery really carries.
    assert.equal(res.status, 202, `a ${JSON.stringify(body)} body answered ${res.status}`);
  }
  assert.equal(emitted.length, 5);
  for (const e of emitted) assert.deepEqual(e.payload, {}, JSON.stringify(e.payload));
});

test("a body past the bound is refused before it is parsed", async () => {
  const emitted = [];
  const api = makeDeliveryApi({
    readEndpoint: async () => row(), emit: async (a) => { emitted.push(a); return { ok: true }; },
    newId: () => "ev1", now: () => NOW, maxBody: 32,
  });
  const ts = String(NOW);
  const body = JSON.stringify({ a: "x".repeat(64) });
  const res = await api.fetch(new Request("https://x/deliver/wh1", {
    method: "POST", body, headers: new Headers({ [SIG_HEADER]: await signDelivery(SECRET, ts, body), [TS_HEADER]: ts }),
  }));
  assert.equal(res.status, 401);
  assert.equal(emitted.length, 0, "an over-long body reached the emitter");
  // THE CONTROL: the same delivery under the bound really is accepted, so the refusal above is
  // about the length and not about the signature.
  const small = JSON.stringify({ a: 1 });
  const ok = await api.fetch(new Request("https://x/deliver/wh1", {
    method: "POST", body: small, headers: new Headers({ [SIG_HEADER]: await signDelivery(SECRET, ts, small), [TS_HEADER]: ts }),
  }));
  assert.equal(ok.status, 202);
});

test("⚠ NO SIGNATURE MEANS NO SECRET IS EVEN READ, so a probe of invented ids costs nothing", async () => {
  let reads = 0;
  const api = makeDeliveryApi({
    readEndpoint: async () => { reads += 1; return row(); },
    emit: async () => ({ ok: true }), newId: () => "ev1", now: () => NOW,
  });
  for (let i = 0; i < 20; i += 1) {
    await api.fetch(new Request(`https://x/deliver/made-up-${i}`, { method: "POST", body: "{}" }));
  }
  assert.equal(reads, 0, `${reads} secrets were read for deliveries with no signature at all`);
  // THE CONTROL: a signed one really does read the row, so the zero above is the shortcut
  // rather than a handler that reads nothing.
  const ts = String(NOW);
  await api.fetch(new Request("https://x/deliver/wh1", {
    method: "POST", body: "{}", headers: new Headers({ [SIG_HEADER]: await signDelivery(SECRET, ts, "{}"), [TS_HEADER]: ts }),
  }));
  assert.equal(reads, 1);
});

test("makeDeliveryApi refuses to exist without the two operations, and owns one path shape", () => {
  assert.throws(() => makeDeliveryApi({}), /readEndpoint must be a function/);
  assert.throws(() => makeDeliveryApi({ readEndpoint: async () => null }), /emit must be a function/);
  const api = makeDeliveryApi({ readEndpoint: async () => null, emit: async () => ({ ok: true }) });
  assert.equal(api.handles("/deliver/wh1", "POST"), true);
  assert.equal(api.handles("/deliver/wh1/", "POST"), true, "a trailing slash is the same path");
  assert.equal(api.handles("/deliver/wh1", "GET"), false);
  assert.equal(api.handles("/deliver", "POST"), false);
  assert.equal(api.handles("/deliver/a/b", "POST"), false);
  assert.equal(api.handles("/runs", "POST"), false);
});
