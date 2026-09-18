/**
 * CONNECTIONS, AND ACTING THROUGH ONE.
 *
 * ⚠ **THESE ARE MODULE-LEVEL GUARDS ON PURPOSE, AND THIS DIRECTORY HAS PAID FOR THE LESSON
 * FIVE TIMES.** Every property below is also proved end to end by
 * `scripts/verify-connections.mjs` against a real PostgreSQL — and `npm run sweep` does not
 * run that, so *a property proven only by an instrument the sweep cannot run is a property
 * no mutant can be caught by*. What is here is what a deliberate breakage can be seen by.
 *
 * **NOTHING HERE TOUCHES A NETWORK OR A REAL PROVIDER.** `fetch` is a recorder, the provider
 * is `makeFakeProvider`, and the credential is a sentinel that must appear in no answer.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  makeConnections, CONNECTION_OPS, CONNECTION_RPC, CONNECTION_WRITES,
  MAX_CONNECTIONS, recordAction, traceFor,
} from "../src/connections.mjs";
import {
  makeFakeProvider, FAKE_ACTIONS, FAKE_WRITES, FAKE_PROVIDER, FAKE_OUTCOMES, FakeProviderError,
} from "../src/fake-provider.mjs";
import { argsHash } from "../src/approvals.mjs";

const SRC = path.join(import.meta.dirname, "..", "src");
const T = "tenant-1";
const AG = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CX = "11111111-2222-3333-4444-555555555555";
const RUN = "99999999-8888-7777-6666-555555555555";

/** ⚠ THE ONE STRING THAT MAY NEVER LEAVE. Distinctive, so a substring search cannot miss it. */
const SENTINEL = "SECRET-do-not-leak-c0ffee";

const OP = async (args = { to: "a@b.test" }) => `${RUN}:1:0:${await argsHash(args)}`;

/**
 * A recorder in PostgREST's shape. `answers` maps an RPC name to a function of its body, so a
 * case scripts only what it cares about; anything unscripted answers `{ok: true}`, which is
 * deliberately the SHAPE a caller reads rather than `null` — a fake that answered nothing
 * would make every case fail for its own reason.
 */
function wire(answers = {}) {
  const sent = [];
  const doFetch = async (url, init = {}) => {
    const name = String(url).split("/rpc/")[1] ?? null;
    const body = init.body ? JSON.parse(init.body) : null;
    sent.push({ url: String(url), method: init.method, headers: init.headers ?? {}, name, body });
    const rows = [];
    if (name === null) {
      return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
    }
    const f = Object.hasOwn(answers, name) ? answers[name] : null;
    const out = f ? await f(body) : { ok: true };
    if (out && out.__http) {
      return { ok: false, status: out.__http, text: async () => JSON.stringify({ message: out.message ?? "no" }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(out) };
  };
  return { sent, doFetch };
}

const leased = (extra = {}) => ({
  ok: true, connection: CX, provider: FAKE_PROVIDER, account: "someone@example.test",
  scopes: ["read", "send"], expiresAt: null, secret: SENTINEL, ...extra,
});

const build = (answers, adapters) => {
  const w = wire(answers);
  const via = makeConnections({ fetch: w.doFetch, url: "https://x.test", key: "k", adapters })
    .forTenant(T).forAgent(AG);
  return { via, sent: w.sent };
};

// ── the surface, and what cannot be said to it ───────────────────────────────

test("⚠ NOT ONE OPERATION TAKES A TENANT OR AN AGENT — the boundary is a closure", () => {
  const { via } = build({}, {});
  // THE CENSUS IS OVER THE REAL SURFACE, so an operation added without a name in
  // `CONNECTION_OPS` is not reachable and one named there must really exist.
  assert.deepEqual(Object.keys(via).sort(), [...CONNECTION_OPS].sort());
  for (const op of CONNECTION_OPS) assert.equal(typeof via[op], "function", `${op} is not a function`);
  // ⚠ AND THE SOURCE CARRIES NO PARAMETER FOR EITHER, which is what makes a tool argument
  // unable to become authority: there is nowhere to put one. Read off the module, with the
  // comments blanked, because this file explains the rule in prose.
  const blank = (t) => t.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  const src = blank(fs.readFileSync(path.join(SRC, "connections.mjs"), "utf8"));
  assert.ok(src.includes("forTenant(tenant)"), "the scanner cannot see the closure at all");
  for (const bad of ["p_tenant: args.", "p_agent_id: args.", "tenant: args.", "agent: args."]) {
    assert.ok(!src.includes(bad), `the module reads ${bad}`);
  }
  // THE TWO CLOSURES REFUSE RATHER THAN COERCE — `String(["t"])` is `"t"`.
  const made = makeConnections({ fetch: async () => ({}), url: "u", key: "k" });
  for (const bad of [undefined, null, "", "   ", ["t"], 7, {}]) {
    assert.throws(() => made.forTenant(bad), /tenant must be a non-empty string/, JSON.stringify(bad));
  }
  for (const bad of [undefined, null, "", "not-a-uuid", [AG], 7]) {
    assert.throws(() => made.forTenant(T).forAgent(bad), /agent must be a uuid/, JSON.stringify(bad));
  }
});

test("⚠ THE CREDENTIAL NEVER COMES OUT — a sentinel over every answer this module can give", async () => {
  const provider = makeFakeProvider();
  const scripts = [
    // every shape of answer `perform` has, plus the plain operations
    { name: "a read", go: (via) => via.perform({ connection: CX, action: "read_messages" }) },
    { name: "a write", go: async (via) => via.perform({ connection: CX, action: "send_message",
        args: { to: "a@b.test", body: "hi" }, operation: await OP() }) },
    { name: "the list", go: (via) => via.list() },
    { name: "a refresh", go: (via) => via.refresh({ id: CX, secret: SENTINEL }) },
    { name: "a connect", go: (via) => via.connect({ id: CX, provider: FAKE_PROVIDER, label: "l",
        account: "a@b.test", secret: SENTINEL }) },
  ];
  for (const s of scripts) {
    const { via, sent } = build({
      [CONNECTION_RPC.lease]: () => leased(),
      [CONNECTION_RPC.begin]: () => ({ ok: true, began: true }),
      [CONNECTION_RPC.settle]: () => ({ ok: true, settled: true }),
    }, { [FAKE_PROVIDER]: provider });
    const out = await s.go(via);
    assert.ok(!JSON.stringify(out ?? null).includes(SENTINEL), `${s.name} answered a credential`);
    // ⚠ AND THE OBSERVER IS ALIVE, PER CASE. Without this, "no answer carried the sentinel"
    // is satisfied by a case in which no credential was ever in play — and one of the five
    // really is that shape, which is why it is DECLARED rather than covered by a loose
    // condition: the list is a GET to a view that has no credential column, so there is
    // nothing for it to leak and its protection is the view's, asserted in its own case.
    const NOTHING_TO_LEAK = ["the list"];
    if (NOTHING_TO_LEAK.includes(s.name)) {
      assert.equal(sent.filter((r) => r.name === CONNECTION_RPC.lease).length, 0,
        `${s.name} took a lease after all, so it is not in this group`);
    } else {
      const wentIn = sent.some((r) => JSON.stringify(r.body ?? null).includes(SENTINEL))
        || sent.some((r) => r.name === CONNECTION_RPC.lease);
      assert.ok(wentIn, `${s.name} never had a credential to leak`);
    }
  }
});

test("⚠ AND NEITHER DOES AN ERROR, which is the path a leak takes unnoticed", async () => {
  // The provider is handed the right credential and refuses anyway, so its message is the
  // one a caller would log.
  const provider = makeFakeProvider({ script: () => "refused" });
  const { via } = build({ [CONNECTION_RPC.lease]: () => leased(),
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: true }),
    [CONNECTION_RPC.settle]: () => ({ ok: true, settled: true }) },
    { [FAKE_PROVIDER]: provider });
  const out = await via.perform({ connection: CX, action: "read_messages" });
  assert.equal(out.ok, false);
  assert.ok(!JSON.stringify(out).includes(SENTINEL), `the refusal carried it: ${JSON.stringify(out)}`);
  // AND THE PROVIDER'S OWN ERROR, thrown rather than returned.
  const e = new FakeProviderError("the credential was not accepted", { status: 401 });
  assert.ok(!`${e.message}${e.stack ?? ""}`.includes(SENTINEL));
  // ⚠ NOR ANYTHING IT KEEPS FOR A TEST TO READ, which is the other place a credential
  // quietly accumulates: a recorder that logged its lease would be a log holding secrets.
  assert.ok(!JSON.stringify(provider.seen()).includes(SENTINEL));
});

// ── the identity, and its two bounds ────────────────────────────────────────

test("⚠ THE RECORD'S ACTION NAME IS BOUNDED, NEVER TRUNCATED", () => {
  assert.equal(recordAction(FAKE_PROVIDER, "send_message"), "fakemail_send_message");
  // A name that would overrun `agent.operations.action` is REFUSED. Truncating is two
  // different actions sharing one record, which is the one mistake the record prevents.
  assert.equal(recordAction("p".repeat(40), "a".repeat(40)), null);
  assert.equal(recordAction("Fakemail", "send"), null, "an upper-case provider is admitted");
  assert.equal(recordAction("fakemail", "send-message"), null, "a dash is admitted");
  // THE BOUNDARY, both sides, so the bound is the column's and not a round number.
  assert.equal(typeof recordAction("a".repeat(31), "b".repeat(32)), "string", "63 characters is refused");
  assert.equal(recordAction("a".repeat(32), "b".repeat(32)), null, "65 characters is admitted");
});

test("⚠ THE TRACE IS THE OPERATION'S OWN IDENTITY, so a retry can find its own earlier send", async () => {
  const op = await OP();
  assert.equal(traceFor(op), op);
  // STABLE ACROSS DELIVERIES — the same call gives the same trace, which is the whole of why
  // reconciliation can work at all.
  assert.equal(traceFor(await OP()), traceFor(await OP()));
  // AND DIFFERENT ARGUMENTS ARE A DIFFERENT TRACE, or one send would settle another.
  assert.notEqual(traceFor(await OP({ to: "a@b.test" })), traceFor(await OP({ to: "c@d.test" })));
  for (const bad of [undefined, null, "", "   ", ["x"], 7]) assert.equal(traceFor(bad), null);
});

// ── the order, which is the safety argument ─────────────────────────────────

test("⚠ AN ACTION NOBODY IMPLEMENTS NEVER REACHES A CREDENTIAL", async () => {
  const provider = makeFakeProvider();
  const { via, sent } = build({ [CONNECTION_RPC.lease]: () => leased() }, { [FAKE_PROVIDER]: provider });
  const out = await via.perform({ connection: CX, action: "delete_everything" });
  assert.equal(out.error, "no-such-action");
  assert.deepEqual(out.offered, [...FAKE_ACTIONS]);
  assert.equal(provider.calls(), 0, "the provider was called for an action it does not have");
  // ONE LEASE WAS TAKEN — the connection has to be resolved to know WHICH adapter to ask —
  // and no second one, and no operation record at all.
  assert.equal(sent.filter((r) => r.name === CONNECTION_RPC.begin).length, 0);
});

test("⚠ THE ADAPTER COMES FROM THE LEASE'S PROVIDER, never from an argument", async () => {
  const fake = makeFakeProvider();
  const other = makeFakeProvider();
  const { via } = build({ [CONNECTION_RPC.lease]: () => leased({ provider: "elsewhere" }) },
    { [FAKE_PROVIDER]: fake, elsewhere: other });
  // The call names nothing about a provider; the database said `elsewhere`, so that is the
  // adapter used — and a caller trying to name one has nowhere to put it.
  const out = await via.perform({ connection: CX, action: "read_messages", provider: FAKE_PROVIDER });
  assert.equal(out.ok, true);
  assert.equal(other.calls(), 1, "the provider the database named was not the one asked");
  assert.equal(fake.calls(), 0, "an argument chose the adapter");
});

test("a provider this deployment has no adapter for is refused by name", async () => {
  const { via } = build({ [CONNECTION_RPC.lease]: () => leased({ provider: "nobodys" }) }, {});
  const out = await via.perform({ connection: CX, action: "read_messages" });
  assert.equal(out.error, "no-adapter");
  assert.equal(out.provider, "nobodys");
  // ⚠ AND A REGISTRY IS ASKED WITH `Object.hasOwn`, so `constructor` is not an adapter.
  const { via: v2 } = build({ [CONNECTION_RPC.lease]: () => leased({ provider: "constructor" }) }, {});
  assert.equal((await v2.perform({ connection: CX, action: "read_messages" })).error, "no-adapter");
});

test("⚠ EVERY WAY A CONNECTION IS UNUSABLE COMES BACK BY ITS OWN NAME", async () => {
  for (const why of ["no-connection", "disconnected", "revoked", "expired", "not-usable", "scope-missing"]) {
    const { via } = build({ [CONNECTION_RPC.lease]: () => ({ ok: false, error: why, why: "because" }) },
      { [FAKE_PROVIDER]: makeFakeProvider() });
    const out = await via.perform({ connection: CX, action: "read_messages" });
    assert.equal(out.ok, false, why);
    assert.equal(out.error, why, `the lease's own reason was lost: ${JSON.stringify(out)}`);
  }
  // AND THE ARGUMENTS ARE CHECKED BEFORE ANY OF IT, so a call naming nothing costs no lease.
  const { via, sent } = build({}, { [FAKE_PROVIDER]: makeFakeProvider() });
  assert.equal((await via.perform({})).error, "no-connection");
  assert.equal((await via.perform({ connection: "nope", action: "read_messages" })).error, "no-connection");
  assert.equal((await via.perform({ connection: CX })).error, "no-action");
  assert.equal(sent.length, 0, "a malformed call reached the database");
});

test("⚠ THE ACTION'S SCOPE IS ASKED OF THE DATABASE, which is where the grant lives", async () => {
  const asked = [];
  const { via } = build({ [CONNECTION_RPC.lease]: (b) => { asked.push(b.p_scopes); return leased(); } },
    { [FAKE_PROVIDER]: makeFakeProvider() });
  await via.perform({ connection: CX, action: "send_message", args: { to: "a", body: "b" }, operation: await OP() });
  // The second lease names the action's own scope; the refusal, when there is one, is the
  // database's and names what is missing rather than being compared here.
  assert.deepEqual(asked, [[], ["send"]]);
});

// ── a read takes no record; a write takes one ──────────────────────────────

test("⚠ A READ TAKES NO OPERATION RECORD — there is no duplicate to prevent", async () => {
  const { via, sent } = build({ [CONNECTION_RPC.lease]: () => leased() },
    { [FAKE_PROVIDER]: makeFakeProvider() });
  const out = await via.perform({ connection: CX, action: "read_messages" });
  assert.equal(out.ok, true);
  assert.equal(out.result.simulated, true, "the fake provider's answer is not labelled");
  assert.equal(sent.filter((r) => r.name === CONNECTION_RPC.begin).length, 0);
  assert.equal(sent.filter((r) => r.name === CONNECTION_RPC.settle).length, 0);
  // AND IT NEEDS NO IDENTITY AT ALL, which is what makes a read usable with no run behind it.
  assert.equal((await via.perform({ connection: CX, action: "read_messages", operation: undefined })).ok, true);
});

test("⚠ A READ THAT FAILED IS A FAILURE AND NEVER `unresolved`", async () => {
  const { via } = build({ [CONNECTION_RPC.lease]: () => leased() },
    { [FAKE_PROVIDER]: makeFakeProvider({ script: () => "timeout" }) });
  const out = await via.perform({ connection: CX, action: "read_messages" });
  assert.equal(out.error, "action-failed");
  assert.notEqual(out.error, "unresolved");
  assert.equal(out.uncertain, undefined, "a read was called uncertain");
});

test("⚠ A WRITE WITHOUT AN IDENTITY IS REFUSED, never sent", async () => {
  const provider = makeFakeProvider();
  const { via, sent } = build({ [CONNECTION_RPC.lease]: () => leased() }, { [FAKE_PROVIDER]: provider });
  const send = (operation) => via.perform({ connection: CX, action: "send_message",
    args: { to: "a@b.test", body: "hi" }, operation });
  assert.equal((await send(undefined)).error, "operation-required");
  assert.equal((await send(null)).error, "operation-required");
  for (const bad of ["", "no-colons", "x:y", 7, ["a"]]) {
    assert.equal((await send(bad)).error, "operation-unreadable", JSON.stringify(bad));
  }
  assert.equal(provider.calls(), 0, "a write with no identity reached the provider");
  assert.equal(sent.filter((r) => r.name === CONNECTION_RPC.begin).length, 0);
  // THE CONTROL: a real identity sends.
  assert.equal((await send(await OP())).ok, true);
  assert.equal(provider.calls(), 1);
});

test("⚠ A WRITE THAT CANNOT BE RECORDED IS NOT ATTEMPTED", async () => {
  // ⚠ IT TAKES ITS OWN ADAPTER, and that is worth saying: `<provider>_<action>` for the fake
  // provider is 21 characters against the column's 64, so there is no way to overrun it with
  // a real action — my first fixture used a 39-character provider and `send_message`, which
  // is 52 and fits. The arithmetic had to be done rather than assumed.
  const LONG_P = "p".repeat(39), LONG_A = "send_a_message_with_a_very_long_name";
  assert.ok(`${LONG_P}_${LONG_A}`.length > 64, "the fixture does not overrun the column");
  let ran = 0;
  const wordy = { provider: LONG_P, actions: [LONG_A], writes: [LONG_A], scopes: {},
    run: async () => { ran++; return { ok: true }; } };
  const { via } = build({ [CONNECTION_RPC.lease]: () => leased({ provider: LONG_P }) },
    { [LONG_P]: wordy });
  const out = await via.perform({ connection: CX, action: LONG_A,
    args: { to: "a", body: "b" }, operation: await OP() });
  assert.equal(out.error, "action-unrecordable");
  assert.equal(ran, 0, "it was sent under a name nothing could record");
  // THE CONTROL: the same adapter under a short name really does run, so the refusal is
  // about the NAME's length and not about the adapter being unusable.
  const short = { ...wordy, provider: "shortp" };
  const { via: v2 } = build({ [CONNECTION_RPC.lease]: () => leased({ provider: "shortp" }),
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: true }),
    [CONNECTION_RPC.settle]: () => ({ ok: true, settled: true }) }, { shortp: short });
  assert.equal((await v2.perform({ connection: CX, action: LONG_A,
    args: { to: "a", body: "b" }, operation: await OP() })).ok, true);
  assert.equal(ran, 1);
});

test("⚠ AN ALREADY-DONE WRITE ANSWERS WHAT IT DID AND SENDS NOTHING", async () => {
  const provider = makeFakeProvider();
  const { via } = build({
    [CONNECTION_RPC.lease]: () => leased(),
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: false, state: "repeat",
      outcome: { ok: true, result: { message: "fake-msg-1" } } }),
  }, { [FAKE_PROVIDER]: provider });
  const out = await via.perform({ connection: CX, action: "send_message",
    args: { to: "a@b.test", body: "hi" }, operation: await OP() });
  assert.equal(out.ok, true);
  assert.equal(out.repeat, true);
  assert.equal(provider.calls(), 0, "a repeat sent a second message");
  // ⚠ THE ANSWER IS WHAT IT DID THE FIRST TIME — a historical fact, not a reading of now.
  assert.equal(out.result.result.message, "fake-msg-1");
  assert.match(out.say, /had already been done/);
});

test("a record that does not agree with this call refuses and sends nothing", async () => {
  const provider = makeFakeProvider();
  const { via } = build({
    [CONNECTION_RPC.lease]: () => leased(),
    [CONNECTION_RPC.begin]: () => ({ ok: false, error: "mismatch", action: "fakemail_something_else" }),
  }, { [FAKE_PROVIDER]: provider });
  const out = await via.perform({ connection: CX, action: "send_message",
    args: { to: "a", body: "b" }, operation: await OP() });
  assert.equal(out.ok, false);
  assert.equal(out.error, "mismatch");
  assert.equal(provider.calls(), 0);
});

test("a definite refusal is settled as a failure, so a redelivery is answered rather than sent", async () => {
  const provider = makeFakeProvider({ script: () => "refused" });
  const settled = [];
  const { via } = build({
    [CONNECTION_RPC.lease]: () => leased(),
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: true }),
    [CONNECTION_RPC.settle]: (b) => { settled.push(b.p_outcome); return { ok: true, settled: true }; },
  }, { [FAKE_PROVIDER]: provider });
  const out = await via.perform({ connection: CX, action: "send_message",
    args: { to: "a", body: "b" }, operation: await OP() });
  assert.equal(out.error, "action-failed");
  assert.equal(settled.length, 1, "a definite refusal left the record in flight");
  assert.equal(settled[0].ok, false);
  // ⚠ AND IT IS NOT `unresolved`: the provider answered, so nothing happened.
  assert.notEqual(out.error, "unresolved");
});

// ── the uncertain write, which is the milestone's own case ──────────────────

test("⚠ AN UNCERTAIN WRITE IS RECONCILED, NEVER RE-SENT — and it finds its own earlier send", async () => {
  // ⚠ THE SHAPE IS "IT LANDED AND THE RECORD WAS NEVER FILLED IN" — a process that died
  // between the provider's answer and the settle. So the provider needs no script at all:
  // the first call really sends, and what makes the second delivery interesting is that the
  // RECORD says `unfinished`. (My first version scripted a timeout on call 2, which is the
  // RECONCILIATION — a different case, and it is the one below.)
  const provider = makeFakeProvider();
  const op = await OP();
  const settled = [];
  const answers = {
    [CONNECTION_RPC.lease]: () => leased(),
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: true }),
    [CONNECTION_RPC.settle]: (b) => { settled.push(b.p_outcome); return { ok: true, settled: true }; },
  };
  const { via } = build(answers, { [FAKE_PROVIDER]: provider });
  const first = await via.perform({ connection: CX, action: "send_message",
    args: { to: "a@b.test", body: "hi" }, operation: op });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(provider.mailbox("someone@example.test").length, 1);

  // NOW THE REDELIVERY. The record says `unfinished`, so it must ask rather than send.
  const { via: v2 } = build({ ...answers,
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: false, state: "unfinished" }) },
    { [FAKE_PROVIDER]: provider });
  const again = await v2.perform({ connection: CX, action: "send_message",
    args: { to: "a@b.test", body: "hi" }, operation: op });
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.equal(again.reconciled, true);
  // ⚠ ONE MESSAGE. That is the whole property.
  assert.equal(provider.mailbox("someone@example.test").length, 1, "it sent a second message");
  assert.match(again.say, /checked rather than doing it again/);
  // AND IT REALLY ASKED: one send plus one reconciliation, which is what "asked instead of
  // sending" looks like from the provider's side.
  assert.equal(provider.calls(), 2, JSON.stringify(provider.seen()));
  assert.deepEqual(provider.seen().map((c) => c.action), ["send_message", "reconcile:send_message"]);
  // ⚠ AND THE RECORD WAS SETTLED FROM THE ANSWER rather than left in flight, so a THIRD
  // delivery is a plain repeat. TWO settles, and the count is the point: the first send
  // settled its own slot and the reconciliation settled again after the redelivery found the
  // slot in flight — which is the state a real death between send and settle leaves.
  assert.equal(settled.length, 2, JSON.stringify(settled));
  assert.equal(settled.at(-1).ok, true, "the reconciliation settled a failure");
  assert.equal(settled.at(-1).result.reconciled, true, "the settled outcome does not say it was checked");
});

test("⚠ A TIMEOUT ON A WRITE IS RECONCILED IN THE SAME CALL, and one message exists", async () => {
  // The SEND times out, and the reconciliation that follows finds it had landed — which is
  // the fake provider's own shape: it appends to the mailbox and then the script decides.
  let sends = 0;
  const provider = makeFakeProvider({ script: ({ action }) => {
    if (action === "send_message") { sends++; return sends === 1 ? "ok" : "timeout"; }
    return "ok";
  } });
  const op = await OP();
  const answers = {
    [CONNECTION_RPC.lease]: () => leased(),
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: true }),
    [CONNECTION_RPC.settle]: () => ({ ok: true, settled: true }),
  };
  // First: a clean send, so there is something in the mailbox carrying this trace.
  const { via } = build(answers, { [FAKE_PROVIDER]: provider });
  await via.perform({ connection: CX, action: "send_message", args: { to: "a@b.test", body: "hi" }, operation: op });
  // Second: the same operation, a send that times out — but the slot is fresh, so it sends,
  // and the timeout is what makes it reconcile. The trace is already there from the first.
  const { via: v2 } = build(answers, { [FAKE_PROVIDER]: provider });
  const out = await v2.perform({ connection: CX, action: "send_message",
    args: { to: "a@b.test", body: "hi" }, operation: op });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.reconciled, true);
  assert.match(out.say, /did not answer, but I checked/);
});

test("⚠ AND WHEN IT CANNOT BE SETTLED IT IS `unresolved`, WHICH IS NOT A FAILURE", async () => {
  // The send times out and the RECONCILIATION times out too — nobody can tell.
  const provider = makeFakeProvider({ script: () => "timeout" });
  const settled = [];
  const { via } = build({
    [CONNECTION_RPC.lease]: () => leased(),
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: true }),
    [CONNECTION_RPC.settle]: (b) => { settled.push(b.p_outcome); return { ok: true, settled: true }; },
  }, { [FAKE_PROVIDER]: provider });
  const out = await via.perform({ connection: CX, action: "send_message",
    args: { to: "a@b.test", body: "hi" }, operation: await OP() });
  assert.equal(out.ok, false);
  assert.equal(out.error, "unresolved");
  assert.equal(out.uncertain, true);
  assert.match(out.say, /may or may not have gone out/);
  assert.match(out.say, /asking again could do it twice/);
  // ⚠ AND THE RECORD STAYS IN FLIGHT, which is what lets a later delivery try again to LEARN.
  assert.equal(settled.length, 0, "an unknown was settled as though it were known");
});

test("an action that cannot be checked afterwards says so rather than pretending", async () => {
  const provider = makeFakeProvider({ script: () => "timeout" });
  // An adapter with no way to look: the answer is still `unresolved` and it says WHY.
  const blind = { ...provider, reconcilable: () => false };
  const { via } = build({
    [CONNECTION_RPC.lease]: () => leased(),
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: true }),
  }, { [FAKE_PROVIDER]: blind });
  const out = await via.perform({ connection: CX, action: "send_message",
    args: { to: "a", body: "b" }, operation: await OP() });
  assert.equal(out.error, "unresolved");
  assert.equal(out.reconcilable, false);
  assert.match(out.why, /cannot be checked/);
});

test("⚠ AND A RECONCILIATION THAT SAYS IT DEFINITELY DID NOT HAPPEN DOES NOT SEND EITHER", async () => {
  // The send times out and the trace is nowhere, so it is known NOT to have landed. The
  // honest answer is a failure with its reason — not a retry inside this call, because this
  // engine never retries a call by itself.
  const provider = makeFakeProvider({ script: ({ action }) => (action === "send_message" ? "timeout" : "ok") });
  const settled = [];
  const { via } = build({
    [CONNECTION_RPC.lease]: () => leased(),
    [CONNECTION_RPC.begin]: () => ({ ok: true, began: true }),
    [CONNECTION_RPC.settle]: (b) => { settled.push(b.p_outcome); return { ok: true, settled: true }; },
  }, { [FAKE_PROVIDER]: provider });
  const out = await via.perform({ connection: CX, action: "send_message",
    args: { to: "a@b.test", body: "hi" }, operation: await OP() });
  assert.equal(out.ok, false);
  assert.equal(out.error, "action-failed");
  assert.equal(out.reconciled, true);
  assert.equal(settled.length, 1, "a known non-event was left in flight");
  assert.equal(settled[0].error, "not-done");
  assert.match(out.say, /did not go out/);
  assert.equal(provider.mailbox("someone@example.test").length, 0, "it sent after finding it had not");
});

// ── the fake provider itself ────────────────────────────────────────────────

test("⚠ THE FAKE PROVIDER SAYS IT IS FAKE, in its name and in every answer", async () => {
  const provider = makeFakeProvider();
  assert.equal(provider.provider, FAKE_PROVIDER);
  assert.match(FAKE_PROVIDER, /fake/);
  const d = provider.describe();
  assert.equal(d.simulated, true);
  assert.match(d.say, /nothing is sent anywhere/);
  const out = provider.run("read_messages", {}, { secret: "s", account: "a" });
  assert.equal(out.simulated, true);
  const sent = provider.run("send_message", { to: "x", body: "y" }, { secret: "s", account: "a" });
  assert.equal(sent.simulated, true);
});

test("⚠ IT HAS NO IDEMPOTENCY — a second call is a second message, which is why reconciling matters", () => {
  const provider = makeFakeProvider();
  const lease = { secret: "s", account: "a" };
  const one = provider.run("send_message", { to: "x", body: "y", trace: "t" }, lease);
  const two = provider.run("send_message", { to: "x", body: "y", trace: "t" }, lease);
  assert.notEqual(one.message, two.message, "the fake absorbed a duplicate, so it cannot show the problem");
  assert.equal(provider.mailbox("a").length, 2);
});

test("⚠ IT REALLY CHECKS THE CREDENTIAL, or 'the credential reached the provider' is unprovable", () => {
  // ⚠ THE PROVIDER IS TOLD WHICH CREDENTIAL IS GOOD — the shape a real one has. A lease
  // carries a secret and nothing to compare it against, which is what the first draft of the
  // fake got wrong.
  const provider = makeFakeProvider({ secret: "right" });
  assert.throws(() => provider.run("read_messages", {}, { secret: "wrong", account: "a" }),
    /credential was not accepted/);
  assert.throws(() => provider.run("read_messages", {}, { account: "a" }),
    /credential was not accepted/);
  // THE CONTROL.
  assert.equal(provider.run("read_messages", {}, { secret: "right", account: "a" }).count, 0);
});

test("⚠ A TIMEOUT IS UNCERTAIN ON A WRITE AND CERTAIN ON A READ", () => {
  const provider = makeFakeProvider({ script: () => "timeout" });
  const lease = { secret: "s", account: "a" };
  try { provider.run("send_message", { to: "x", body: "y" }, lease); assert.fail("no throw"); }
  catch (e) { assert.equal(e.uncertain, true, "a write that timed out is called certain"); }
  try { provider.run("read_messages", {}, lease); assert.fail("no throw"); }
  catch (e) { assert.equal(e.uncertain, false, "a read that timed out is called uncertain"); }
  // AND A DEFINITE REFUSAL IS CERTAIN EVEN ON A WRITE, which is the pair that makes the
  // distinction about what HAPPENED rather than about which kind of action it was.
  const refuser = makeFakeProvider({ script: () => "refused" });
  try { refuser.run("send_message", { to: "x", body: "y" }, lease); assert.fail("no throw"); }
  catch (e) { assert.equal(e.uncertain, false); }
  // Every outcome the script may name is one this provider really answers differently.
  assert.equal(new Set(FAKE_OUTCOMES).size, FAKE_OUTCOMES.length);
});

test("reconciliation matches on the trace, and says when it has nothing to match on", () => {
  const provider = makeFakeProvider();
  const lease = { secret: "s", account: "a" };
  provider.run("send_message", { to: "x", body: "y", trace: "t-1" }, lease);
  assert.deepEqual(
    { known: true, done: true },
    (({ known, done }) => ({ known, done }))(provider.reconcile("send_message", { trace: "t-1" }, lease)));
  assert.equal(provider.reconcile("send_message", { trace: "t-2" }, lease).done, false);
  assert.equal(provider.reconcile("send_message", {}, lease).known, false);
});

// ── the lists, and what the writes are ─────────────────────────────────────

test("the declared lists are about the real surface", () => {
  assert.equal(CONNECTION_WRITES.every((n) => CONNECTION_OPS.includes(n)), true);
  assert.ok(!CONNECTION_WRITES.includes("list"), "a read is named a write");
  // ⚠ `perform` IS ON THE WRITE LIST AND IS THE ONE WHOSE ANSWER DEPENDS ON ITS ARGUMENT —
  // `read_messages` and `send_message` both go through it. That is why a tool's own flag is
  // censused against the ADAPTER's `writes` rather than against this list.
  assert.ok(CONNECTION_WRITES.includes("perform"));
  assert.equal(FAKE_WRITES.every((a) => FAKE_ACTIONS.includes(a)), true);
  assert.ok(FAKE_ACTIONS.some((a) => !FAKE_WRITES.includes(a)), "every action writes, so the split is untested");
  assert.equal(MAX_CONNECTIONS, 20);
  // Every action the adapter offers names a scope, or a lease could be taken for an action
  // whose permission nobody asked about.
  const provider = makeFakeProvider();
  for (const a of FAKE_ACTIONS) assert.equal(typeof provider.scopes[a], "string", a);
});

test("⚠ THE PROFILE HEADER COMES FROM THE METHOD — the rule, not this module's choice", async () => {
  const { via, sent } = build({ [CONNECTION_RPC.lease]: () => leased() }, { [FAKE_PROVIDER]: makeFakeProvider() });
  await via.list();
  await via.perform({ connection: CX, action: "read_messages" });
  const read = sent.find((r) => r.method === "GET");
  const write = sent.find((r) => r.method === "POST");
  assert.ok(read && write, "the module did not make both kinds of request");
  assert.equal(read.headers["accept-profile"], "agent");
  assert.equal(read.headers["content-profile"], undefined);
  assert.equal(write.headers["content-profile"], "agent");
  assert.equal(write.headers["accept-profile"], undefined);
});

test("⚠ THE LIST READS THE VIEW AND IS SCOPED BOTH WAYS", async () => {
  const { via, sent } = build({}, {});
  await via.list();
  const url = sent[0].url;
  assert.match(url, /connection_list\?/, "it reads the table rather than the view");
  assert.ok(url.includes(`tenant_id=eq.${T}`), url);
  assert.ok(url.includes(`agent_id=eq.${AG}`), url);
  // ⚠ AND IT CANNOT ASK FOR A CREDENTIAL, because the view has no such column — asserted as
  // the absence of any request for one, which is what a `select=` naming it would look like.
  assert.ok(!url.includes("secret"), url);
});
