/**
 * A PROVIDER THAT SAYS IT IS FAKE — and it is the honest half of milestone 8.
 *
 * The milestone's own words: *use a clearly labeled fake provider for now* and *design
 * explicitly for providers without idempotency support: uncertain writes need
 * reconciliation, not blind retries.* So this is not a mock of somebody's API. It is a
 * provider with the one property that makes the hard part hard — **it cannot tell a retry
 * from a new request** — plus the one that makes the hard part solvable, which is that you
 * can ask it what it already has.
 *
 * ⚠ **IT IS LABELLED IN THREE PLACES AND NONE OF THEM IS A COMMENT.** Its provider name is
 * `fakemail`, every answer carries `simulated: true`, and `describe()` says in a sentence
 * that nothing leaves this process. The redundancy is deliberate and is the same argument
 * the stand-in model makes: a field is gone the moment somebody copies an answer into an
 * email, and a name travels with it.
 *
 * ── ⚠ WHAT IT DELIBERATELY DOES NOT HAVE ────────────────────────────────────
 *
 * **NO IDEMPOTENCY KEY.** `send` mints a new message id every time it is called, so two
 * calls are two messages — which is the whole reason `agent.operations` has an in-flight
 * state and why `perform` reconciles instead of re-sending. A fake that absorbed duplicates
 * would make the platform's retry protection untestable by making it unnecessary.
 *
 * **NO NETWORK, NO CLOCK OF ITS OWN, AND NO RANDOMNESS.** The mailbox is a Map, ids come
 * from a counter, and what happens to each call is decided by an injected `script`. A fake
 * that cannot be made to time out cannot demonstrate a timeout, and one that fails at random
 * cannot demonstrate anything twice.
 *
 * ── THE CREDENTIAL ──────────────────────────────────────────────────────────
 *
 * It really checks the credential — an action called with the wrong one is refused — because
 * a fake that ignores it would make "the credential reached the provider" unprovable, which
 * is half of what the connection machinery is for. **And it never puts one in an answer, in
 * an error message or in anything it stores**: `test/connections.test.mjs` asserts that with
 * a sentinel, over every answer this file can produce.
 *
 * ⚠ **THE PROVIDER KNOWS ITS OWN CREDENTIAL AND THE LEASE CARRIES ONE — which is the shape a
 * real provider has, and the first draft of this file got it wrong.** It compared
 * `lease.secret` against `lease.expect`, a field it had invented: a real lease out of
 * `agent.lease_connection` carries `secret` and nothing to check it against, so every call
 * through the real store was refused `unauthorised` and four of my own guards failed for a
 * reason that has nothing to do with the product. *A fake in a different shape from reality
 * produces a specific wrong answer*, and this one produced the most plausible of all: a
 * credential that does not work.
 */

/** What a caller may ask this provider to do. A positive list; code, never data. */
export const FAKE_ACTIONS = Object.freeze(["read_messages", "send_message"]);

/** Which of them change something at the provider, so a failure means "may have happened". */
export const FAKE_WRITES = Object.freeze(["send_message"]);

/** The scopes it recognises, so a lease asking for one it was not granted is refused. */
export const FAKE_SCOPES = Object.freeze({ read_messages: "read", send_message: "send" });

export const FAKE_PROVIDER = "fakemail";

/** How a scripted call can end, and each is a different thing for a caller to do about it. */
export const FAKE_OUTCOMES = Object.freeze(["ok", "timeout", "refused", "unauthorised"]);

const isText = (v) => typeof v === "string" && v.trim() !== "";

/**
 * A FAILURE THAT MAY HAVE LANDED IS ITS OWN ERROR, and the flag is on the error rather
 * than in its message. A caller that read a message to decide would be parsing prose to
 * choose between reconciling and reporting.
 */
export class FakeProviderError extends Error {
  constructor(why, { uncertain = false, status = 0 } = {}) {
    super(`fakemail: ${why}`);
    this.name = "FakeProviderError";
    this.why = why;
    /** TRUE when the provider may have done the work and we did not hear. */
    this.uncertain = uncertain;
    this.status = status;
  }
}

/**
 * Stand a fake provider up.
 *
 * @param {object} opts
 * @param {(call: {action: string, n: number}) => string} [opts.script] what each call does,
 *   one of `FAKE_OUTCOMES`. Called with the action and how many calls have been made. The
 *   default is `"ok"` for everything, because the ordinary path must not need a script.
 * @param {string} [opts.secret] the credential it accepts. **Omitted means it accepts any
 *   non-empty one**, which is right for a driver that does not care and is why the ordinary
 *   path needs no setting — a fake that demanded a match by default would make every
 *   demonstration configure a credential to prove something else.
 */
export function makeFakeProvider(opts = {}) {
  const script = typeof opts.script === "function" ? opts.script : () => "ok";
  const expect = isText(opts.secret) ? opts.secret : null;
  /** account → [{id, to, body, trace}] */
  const boxes = new Map();
  let calls = 0;
  let minted = 0;
  /** Every call, for a test to read. ⚠ THE CREDENTIAL IS NOT RECORDED HERE — see `describe`. */
  const seen = [];

  const box = (account) => {
    if (!boxes.has(account)) boxes.set(account, []);
    return boxes.get(account);
  };

  /**
   * ⚠ **THE CREDENTIAL IS CHECKED AND THEN FORGOTTEN.** It is compared and never stored,
   * never logged, and never put in the refusal — an `unauthorised` answer that quoted the
   * credential it rejected would be the leak this whole design is about, arriving through
   * an error path.
   */
  const bad = (lease) => !isText(lease?.secret) || (expect !== null && lease.secret !== expect);

  function run(action, args, lease) {
    calls += 1;
    seen.push({ action, n: calls, account: lease?.account ?? null });
    const fate = script({ action, n: calls });

    // WHAT THE SCRIPT SAYS HAPPENS FIRST, because a timeout at the provider happens
    // whether or not the credential was any good — and reading them the other way round
    // would make an outage indistinguishable from a rejected credential.
    if (fate === "timeout") {
      // ⚠ **A TIMEOUT ON A WRITE IS UNCERTAIN AND ON A READ IS NOT.** The request may have
      // arrived; for a read that costs nothing and for a write it is the whole problem.
      throw new FakeProviderError("the provider did not answer in time",
        { uncertain: FAKE_WRITES.includes(action), status: 0 });
    }
    if (fate === "refused") {
      // A DEFINITE NO. The provider answered, so nothing happened.
      throw new FakeProviderError("the provider refused the request", { uncertain: false, status: 400 });
    }
    if (fate === "unauthorised" || bad(lease)) {
      throw new FakeProviderError("the credential was not accepted", { uncertain: false, status: 401 });
    }

    if (action === "read_messages") {
      const rows = box(lease.account).map((m) => ({ id: m.id, to: m.to, body: m.body }));
      return { simulated: true, provider: FAKE_PROVIDER, account: lease.account,
               count: rows.length, messages: rows };
    }

    // ⚠ **NO IDEMPOTENCY. A SECOND CALL IS A SECOND MESSAGE**, which is what makes a blind
    // retry the wrong answer and reconciliation the right one.
    minted += 1;
    const id = `fake-msg-${minted}`;
    box(lease.account).push({ id, to: args.to, body: args.body, trace: args.trace ?? null });
    return { simulated: true, provider: FAKE_PROVIDER, account: lease.account,
             sent: true, message: id };
  }

  /**
   * ASK THE PROVIDER WHAT IT ALREADY HAS — the reconciliation half.
   *
   * ⚠ **IT MATCHES ON A TRACE THE ACTION PUT IN THE MESSAGE, and that is a real technique
   * with a real limit.** Where a payload can carry a marker, an uncertain write can be
   * settled by looking for it; where it cannot, reconciliation is not available at all and
   * the honest answer stays *unknown* for ever. `perform` says which of the two it is
   * rather than retrying, because a blind retry on this provider sends a second message.
   *
   * It is deliberately NOT a scripted call: a reconcile that can itself time out is a real
   * thing, and it is modelled by the script seeing its own action — so this counts as a
   * call and can be made to fail like any other.
   */
  function reconcile(action, args, lease) {
    calls += 1;
    seen.push({ action: `reconcile:${action}`, n: calls, account: lease?.account ?? null });
    const fate = script({ action: `reconcile:${action}`, n: calls });
    if (fate === "timeout") {
      throw new FakeProviderError("the provider did not answer the reconciliation in time",
        { uncertain: false, status: 0 });
    }
    if (fate === "unauthorised" || bad(lease)) {
      throw new FakeProviderError("the credential was not accepted", { uncertain: false, status: 401 });
    }
    if (!isText(args?.trace)) return { simulated: true, known: false, why: "nothing to match on" };
    const found = box(lease.account).find((m) => m.trace === args.trace);
    return found
      ? { simulated: true, known: true, done: true, message: found.id }
      : { simulated: true, known: true, done: false };
  }

  return Object.freeze({
    provider: FAKE_PROVIDER,
    actions: FAKE_ACTIONS,
    writes: FAKE_WRITES,
    scopes: FAKE_SCOPES,
    run,
    reconcile,
    /** WHICH ACTIONS CAN BE SETTLED WITHOUT SENDING AGAIN. `send_message` carries a trace. */
    reconcilable: (action) => action === "send_message",
    /**
     * WHAT THIS IS, IN A SENTENCE, so a screen or a log can say it without knowing anything
     * about providers. **No credential and no message body**: it describes the adapter, not
     * the traffic.
     */
    describe: () => ({
      provider: FAKE_PROVIDER, simulated: true, actions: FAKE_ACTIONS,
      say: "a fake provider that runs entirely inside this process — nothing is sent anywhere",
    }),
    // ── for a test to read, and nothing here holds a credential ──
    calls: () => calls,
    seen: () => seen.slice(),
    mailbox: (account) => box(account).map((m) => ({ ...m })),
  });
}
