// Audits A30-4 and A30-5: a press arriving while the first is still upstream
// waits for its answer instead of writing a second row, and a stored answer is
// handed back only to a request with the same contents.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeIdem, idemFingerprint } from "../site-idem.mjs";

const KEY = "3f9c2b1a4d5e6f708192a3b4c5d6e7f8";
const OK = { status: 201, body: '{"id":7}', ct: "application/json" };

/** The proxy's own order: read, then (on a miss) the upstream, then write; release always. */
async function press(store, fp, upstream) {
  const idem = store.for("shop", "data/bookings", KEY, { fp });
  try {
    const prior = await idem.read();
    if (prior) return { replay: true, v: prior };
    const v = await upstream();
    await idem.write(v);
    return { replay: false, v };
  } finally { idem.release(); }
}

test("a double-click: the second press waits for the first and is replayed, one upstream write", async () => {
  const store = makeIdem();
  let writes = 0, open;
  const gate = new Promise((r) => { open = r; });
  const slow = async () => { writes++; await gate; return OK; };
  const fp = await idemFingerprint('{"slot":"10:00"}');
  const a = press(store, fp, slow);
  const b = press(store, fp, slow);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(writes, 1, "the second press reached the upstream while the first was in flight");
  open();
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra.replay, false);
  assert.equal(rb.replay, true);
  assert.equal(writes, 1);
});

test("a first press that is refused releases the second, which goes through on its own", async () => {
  const store = makeIdem();
  let calls = 0;
  const fp = await idemFingerprint("{}");
  const a = press(store, fp, async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return { status: 409, body: "{}", ct: "application/json" }; });
  const b = press(store, fp, async () => { calls++; return OK; });
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra.v.status, 409);
  assert.equal(rb.replay, false);
  assert.equal(rb.v.status, 201);
  assert.equal(calls, 2);
});

test("a first press that throws still releases the key", async () => {
  const store = makeIdem();
  const fp = await idemFingerprint("{}");
  await assert.rejects(press(store, fp, async () => { throw new Error("upstream down"); }));
  const r = await Promise.race([press(store, fp, async () => OK), new Promise((r) => setTimeout(() => r("stuck"), 500))]);
  assert.notEqual(r, "stuck", "a thrown press left the key claimed");
  assert.equal(r.replay, false);
});

test("changed contents under the same key are a new submission, never the earlier answer", async () => {
  const kv = new Map();
  const io = { get: async (id) => kv.get(id) || null, put: async (id, v) => { kv.set(id, v); } };
  const store = makeIdem(io);
  const ten = await idemFingerprint('{"slot":"10:00"}');
  const eleven = await idemFingerprint('{"slot":"11:00"}');
  assert.notEqual(ten, eleven);
  await press(store, ten, async () => OK);
  let reached = 0;
  const r = await press(store, eleven, async () => { reached++; return { ...OK, body: '{"id":8}' }; });
  assert.equal(r.replay, false, "an 11:00 booking was answered with the 10:00 one");
  assert.equal(reached, 1);
  // AND ACROSS ISOLATES: a fresh store reading the shared layer compares too.
  const other = makeIdem(io);
  assert.equal((await press(other, eleven, async () => OK)).replay, true);
  assert.equal((await makeIdem(io).for("shop", "data/bookings", KEY, { fp: ten }).read()), null, "the shared layer replayed other contents");
});

test("the same contents with a fresh spam-check token are the same submission", async () => {
  const a = await idemFingerprint(JSON.stringify({ slot: "10:00", "cf-turnstile-response": "t1" }));
  const b = await idemFingerprint(JSON.stringify({ slot: "10:00", "cf-turnstile-response": "t2" }));
  const c = await idemFingerprint(JSON.stringify({ slot: "10:00" }));
  assert.equal(a, b);
  assert.equal(a, c);
  assert.notEqual(await idemFingerprint("not json"), await idemFingerprint("not json!"));
});
