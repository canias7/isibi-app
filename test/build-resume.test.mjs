// THE RESUME RECORD — driven, because every decision in it is one two DIFFERENT
// consumer invocations have to agree on.
//
// The module has no R2, no queue and no clock, so none of this is a source read:
// every branch below is the real function against a literal. That matters most
// for the two halves nothing else can check — what a poll answer means, and what
// has already been taken from somebody's ledger.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  RESUME_PREFIX, RESUME_KIND, RESUME_VERSION, RESUME_POLL_SECONDS, RESUME_FIRST_SECONDS,
  RESUME_DEADLINE_MS, RESUME_SLACK_MS, RESUME_MAX_LOOKS, CHARGE_STEPS,
  MAX_DELAY_SECONDS,
  isResumeId, resumeKey, packResume, readResume, alreadyCharged, withCharged, resumeDecision,
  packResumeMessage, readResumeMessage, nextLook, queueDelay,
} from "../builder/build-resume.mjs";
import { JOB_KIND, readMessage } from "../builder/build-job.mjs";
import { BUILDER_CALL_MS, retryHere } from "../builder/build-call.mjs";

const ID = "a".repeat(32);
const DESIGN = { brand: "Fold Coffee", plan: { pages: [{ name: "Home", path: "/" }] }, css: ":root{}" };
const GOOD = { id: ID, auth: "Bearer t", uid: "u1", slug: "cafe", lane: "build-k-cafe", genId: "g-1", firedAt: 1000, charged: [], looks: 0, design: DESIGN };

test("NOTHING HERE PERFORMS I/O, and nothing here reads a clock", () => {
  // Both are properties of the FILE rather than of a run. A module that reached
  // for a bucket could not be driven; one that reached for `Date.now()` could
  // not be driven PAST ITS OWN DEADLINE, which is the case that matters.
  const src = fs.readFileSync(new URL("../builder/build-resume.mjs", import.meta.url), "utf8")
    .split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");
  assert.ok(!/\bfetch\s*\(/.test(src), "the resume module fetches — a mistake here would be a mistake about the network");
  assert.ok(!/\.put\(|\.get\(|\.delete\(/.test(src), "the resume module reaches a store — the caller must do every read and write");
  assert.ok(!/Date\.now\(\)/.test(src), "the resume module reads the clock — its deadline branch could never be driven");
  assert.ok(!/Math\.random/.test(src), "the resume module reaches for randomness — its answers must be reproducible");
});

test("THE KEY IS BUILT ONLY FROM AN ID WE MINTED", () => {
  assert.equal(resumeKey(ID), `${RESUME_PREFIX}${ID}.resume.json`);
  assert.match(resumeKey(ID), /^jobs\//, "the record must live under the prefix nothing serves — it holds an access token");
  for (const bad of ["", "../etc", "AAAA", "a".repeat(31), 42, null, undefined, ["a".repeat(32)]]) {
    assert.throws(() => resumeKey(bad), /did not mint/, `a key was built from ${JSON.stringify(bad)}`);
  }
  assert.equal(isResumeId("a".repeat(32)), true);
  assert.equal(isResumeId("A".repeat(32)), false, "an uppercase id is not the shape we mint");
});

test("A ROUND TRIP KEEPS EVERY FIELD A LATER INVOCATION NEEDS", () => {
  const back = readResume(packResume(GOOD));
  assert.ok(back, "a record we just wrote does not read back");
  for (const k of ["id", "auth", "uid", "slug", "lane", "genId", "firedAt"]) {
    assert.equal(back[k], GOOD[k], `\`${k}\` did not survive the round trip`);
  }
});

test("THE LANE IS REQUIRED — the answer lives in ONE container's memory", () => {
  // `laneName(slug)` resolves to a specific instance and the generation's answer
  // is in that instance's own Map. A resume that asked a different lane gets
  // `unknown` from a container that never had the work, which reads as a lost
  // generation on a build that is perfectly fine.
  assert.equal(readResume(packResume({ ...GOOD, lane: "" })), null,
    "a record with no lane reads back as resumable — it could never find its own answer");
  assert.equal(readResume(packResume({ ...GOOD, genId: "" })), null,
    "a record with no container job id reads back as resumable — there is nothing to ask about");
});

test("THE DESIGN IS REQUIRED, AND CARRIED OPAQUELY", () => {
  // It came out of a model call the customer has already paid for and, between
  // the two invocations, this record is the ONLY place it exists. A resume
  // without it has the generated pages and nothing to publish them as; asking
  // for it again would charge twice for one design.
  for (const bad of [null, undefined, "{}", [], 0]) {
    assert.equal(readResume(packResume({ ...GOOD, design: bad })), null,
      `a record whose design is ${JSON.stringify(bad)} reads back as resumable`);
  }
  // OPAQUE: what is inside is the route's own schema and changes with the design
  // tool. A validator here would be a second opinion about a shape that already
  // has one, and the day they disagree the resume refuses a good design.
  const odd = { anythingAtAll: 1, nested: { deep: [1, 2] } };
  assert.deepEqual(readResume(packResume({ ...GOOD, design: odd })).design, odd,
    "the design was reshaped on the way through — this module must not have an opinion about it");
  assert.deepEqual(readResume(packResume(GOOD)).design, DESIGN);
});

test("A RECORD THAT IS NOT WHAT WE WROTE IS REFUSED, not worked around", () => {
  // Unlike most tolerant readers here. A half-parsed record hands a live access
  // token and a charge history to code that acts on both — and a build that
  // cannot be resumed ends with the stand-in still up, which is exactly what a
  // build with no resume mechanism does.
  assert.equal(readResume(null), null);
  assert.equal(readResume([packResume(GOOD)]), null, "an array must not read as a record");
  assert.equal(readResume("{}"), null, "a string must not read as a record");
  assert.equal(readResume({ ...packResume(GOOD), v: RESUME_VERSION + 1 }), null,
    "a record from another version is reinterpreted rather than refused — the fields misread are the token and the charges");
  assert.equal(readResume({ ...packResume(GOOD), kind: "something-else" }), null,
    "a record of another kind is accepted — a key collision would be read as a build to resume");
  assert.equal(readResume({ ...packResume(GOOD), firedAt: 0 }), null,
    "a record with no fire time is accepted — its deadline could never be computed");
  assert.equal(readResume({ ...packResume(GOOD), firedAt: -5 }), null,
    "a record fired in the past-before-epoch is accepted");
});

test("`charged` IS A CLOSED VOCABULARY, and junk cannot grow it", () => {
  // A free-form name is a typo away from a second charge for work already paid
  // for, with nothing reporting it.
  const r = readResume(packResume({ ...GOOD, charged: ["deposit", "deposit", "nonsense", 7, null, "pages"] }));
  assert.deepEqual(r.charged, ["deposit", "pages"], "unknown or duplicated charge steps survived normalisation");
  assert.deepEqual(readResume(packResume({ ...GOOD, charged: "deposit" })).charged, [],
    "a bare string was read as a list of charges");
  for (const s of CHARGE_STEPS) {
    assert.equal(typeof s, "string");
  }
  assert.ok(CHARGE_STEPS.includes("deposit") && CHARGE_STEPS.includes("schema") && CHARGE_STEPS.includes("pages"),
    "the three things a build takes from the ledger are not all named");
});

test("A STEP ALREADY TAKEN IS NEVER TAKEN AGAIN", () => {
  // The SEQUENTIAL half of exactly-once. The concurrent half is the caller's
  // claim on the record, because a queue delivers at least once.
  const r = readResume(packResume({ ...GOOD, charged: ["deposit", "schema"] }));
  assert.equal(alreadyCharged(r, "deposit"), true);
  assert.equal(alreadyCharged(r, "schema"), true);
  assert.equal(alreadyCharged(r, "pages"), false, "the pages call reads as already charged before it has run");
  assert.equal(alreadyCharged(null, "deposit"), false, "a missing record must not read as already charged");
  assert.equal(alreadyCharged({}, "deposit"), false);
});

test("RECORDING A CHARGE RETURNS A NEW RECORD, and refuses an unknown step LOUDLY", () => {
  const r = readResume(packResume(GOOD));
  const after = withCharged(r, "pages");
  assert.deepEqual(after.charged, ["pages"]);
  assert.deepEqual(r.charged, [], "withCharged mutated the record — 'what is stored' and 'what we think is stored' would be one variable");
  assert.deepEqual(withCharged(after, "pages").charged, ["pages"], "recording the same step twice grew the list");
  // Dropped silently, the caller believes the charge is recorded and the NEXT
  // look charges again — the one bug this record exists to prevent.
  assert.throws(() => withCharged(r, "photos"), /not a charge step/,
    "an unrecognised charge step is dropped silently rather than refused");
});

test("THE RESUME MESSAGE HAS ITS OWN KIND, and the build's reader refuses it", () => {
  // `readMessage` in build-job.mjs answers only `site-build`. That refusal is
  // right — running a from-nothing build for a resume message would charge a
  // whole second design — and it means the consumer MUST dispatch on kind, or a
  // resume is logged and dropped with no build.
  const m = packResumeMessage(ID);
  assert.equal(m.kind, RESUME_KIND);
  assert.deepEqual(readResumeMessage(m), { id: ID });
  assert.notEqual(RESUME_KIND, JOB_KIND, "the two message kinds are the same string — one would be run as the other");
  assert.equal(readMessage(m), null, "a resume message reads as a from-nothing build — it would re-run and re-charge the design");
  assert.equal(readResumeMessage({ kind: JOB_KIND, id: ID }), null,
    "a from-nothing build message reads as a resume — it would resume a build that was never fired");
  for (const bad of [null, undefined, [], "x", { kind: RESUME_KIND }, { kind: RESUME_KIND, id: "nope" }]) {
    assert.equal(readResumeMessage(bad), null, `a junk message was accepted: ${JSON.stringify(bad)}`);
  }
  assert.throws(() => packResumeMessage("nope"), /did not mint/,
    "a message was enqueued for an id we did not mint");
});

test("THE CLAIM WRITES ONE LOOK MORE AND NOTHING ELSE", () => {
  // It is written back with `onlyIf: { etagMatches }` BEFORE any money moves,
  // so an invocation that is about to discover it lost the race must not have
  // changed anything on the way.
  const r = readResume(packResume({ ...GOOD, looks: 2, charged: ["deposit"] }));
  const n = nextLook(r);
  assert.equal(n.looks, 3);
  assert.equal(r.looks, 2, "nextLook mutated the record it was handed");
  for (const k of ["id", "auth", "uid", "slug", "lane", "genId", "firedAt", "design"]) {
    assert.deepEqual(n[k], r[k], `the claim changed \`${k}\` — an invocation that loses the race would have altered it anyway`);
  }
  assert.deepEqual(n.charged, r.charged, "the claim touched the charge list");
  assert.equal(nextLook({}).looks, 1, "a record with no look count does not start at one");
  assert.equal(nextLook({ looks: -3 }).looks, 1, "a nonsense look count was carried forward rather than reset");
});

test("THE DELAY IS A WHOLE NUMBER OF SECONDS INSIDE CLOUDFLARE'S OWN CEILING", () => {
  // Past 24 hours is not a slower resume — it is a `send()` the platform
  // REFUSES, and the build stops there with nobody coming back. The class that
  // shipped nothing on three consecutive merges here.
  assert.equal(queueDelay(60), 60);
  assert.equal(queueDelay(MAX_DELAY_SECONDS), MAX_DELAY_SECONDS);
  assert.equal(queueDelay(MAX_DELAY_SECONDS + 1), MAX_DELAY_SECONDS, "a delay past the platform's ceiling was passed through");
  assert.equal(queueDelay(1e9), MAX_DELAY_SECONDS);
  assert.equal(queueDelay(12.7), 12, "a fractional delay was passed through — the field is documented in whole seconds");
  for (const bad of [0, -5, NaN, Infinity, null, undefined, "soon", {}]) {
    assert.equal(queueDelay(bad), 0, `a nonsense delay was passed through: ${JSON.stringify(bad)}`);
  }
  assert.equal(MAX_DELAY_SECONDS, 24 * 60 * 60, "the ceiling is not Cloudflare's documented 24 hours");
  // And every delay the decision can produce must survive the clamp unchanged,
  // or the schedule and what is actually sent would disagree.
  for (const s of [RESUME_FIRST_SECONDS, RESUME_POLL_SECONDS]) {
    assert.equal(queueDelay(s), s, `the schedule produces ${s}s, which the clamp changes`);
  }
});

// ── THE DECISION ────────────────────────────────────────────────────────────

const at = (ms) => 1000 + ms;

test("DONE HANDS BACK THE ANSWER", () => {
  const d = resumeDecision({ poll: { state: "done", answer: { content: [] } }, record: GOOD, now: at(300_000) });
  assert.equal(d.act, "finish");
  assert.ok(d.answer, "the answer is not carried out of the decision — the caller has nothing to publish");
});

test("PENDING WAITS, AND THE FIRST LOOK IS LATER THAN THE REST", () => {
  // Nothing has ever come back inside four minutes — the five measured samples
  // are 333,716 · 340,277 · 595,900 · 608,372 · 619,822 ms — so a 60s first look
  // would spend five invocations to be told `pending`.
  const first = resumeDecision({ poll: { state: "pending" }, record: { ...GOOD, looks: 0 }, now: at(1000) });
  assert.equal(first.act, "wait");
  assert.equal(first.delaySeconds, RESUME_FIRST_SECONDS);
  const later = resumeDecision({ poll: { state: "pending" }, record: { ...GOOD, looks: 3 }, now: at(300_000) });
  assert.equal(later.act, "wait");
  assert.equal(later.delaySeconds, RESUME_POLL_SECONDS);
});

test("THE POLL INTERVAL IS WELL INSIDE THE CONTAINER'S IDLE WINDOW", () => {
  // `SiteBuildContainer.sleepAfter` is five minutes and every request through
  // the proxy pushes it to now+5m. The busy counter is the primary keep-alive;
  // this is what stops the hook ever having to fire. A poll interval at or past
  // the idle window is a container stopped with the answer in its memory.
  assert.ok(RESUME_POLL_SECONDS * 1000 < 5 * 60 * 1000 / 2,
    `the poll interval (${RESUME_POLL_SECONDS}s) is not comfortably inside the five-minute idle window`);
  assert.ok(RESUME_FIRST_SECONDS * 1000 < 5 * 60 * 1000,
    `the first look (${RESUME_FIRST_SECONDS}s) is past the container's idle window — the answer could be gone before anybody asks`);
});

test("PAST THE DEADLINE IT STOPS, because no answer is coming", () => {
  // The container caps the call with its own AbortSignal at `BUILDER_CALL_MS`,
  // so a generation still `pending` past that has not been aborted by its own
  // clock either — nothing is producing it.
  const d = resumeDecision({ poll: { state: "pending" }, record: { ...GOOD, looks: 5 }, now: at(RESUME_DEADLINE_MS + 1) });
  assert.equal(d.act, "stop");
  assert.equal(d.why, "deadline");
  // And exactly AT the deadline it is still waiting — an off-by-one here gives
  // up on a generation one millisecond from answering.
  assert.equal(resumeDecision({ poll: { state: "pending" }, record: { ...GOOD, looks: 5 }, now: at(RESUME_DEADLINE_MS) }).act, "wait");
  assert.equal(RESUME_DEADLINE_MS, BUILDER_CALL_MS + RESUME_SLACK_MS,
    "the deadline is not derived from the container's own call cap — the two could disagree about when to give up");
  assert.ok(RESUME_SLACK_MS > 0, "there is no slack for the fire, the queue and the poll itself");
});

test("A BOUND ON THE LOOKS AS WELL AS ON THE CLOCK", () => {
  // Beside the clock rather than instead of it: the clock is what SHOULD end
  // this, the count is what ends it if a clock is broken or a record is edited.
  const d = resumeDecision({ poll: { state: "pending" }, record: { ...GOOD, looks: RESUME_MAX_LOOKS }, now: at(1000) });
  assert.equal(d.act, "stop");
  assert.equal(d.why, "looks");
  // Generous enough that no honest build reaches it — the deadline lands ~11
  // minutes in, which is ~11 looks at the interval above.
  const honest = 1 + Math.ceil((RESUME_DEADLINE_MS - RESUME_FIRST_SECONDS * 1000) / (RESUME_POLL_SECONDS * 1000));
  assert.ok(RESUME_MAX_LOOKS > honest * 2,
    `the look cap (${RESUME_MAX_LOOKS}) is close to what an honest build needs (${honest}) — a slow but working build would be cut off`);
});

test("A PROVIDER'S OWN REFUSAL STOPS — the tokens are already gone", () => {
  // `status` is documented as the numeric status from the model API and nothing
  // else, so its presence IS the proof a request was answered. Retrying spends
  // them twice AND replaces a message the customer can act on with a second
  // identical failure.
  const d = resumeDecision({ poll: { state: "failed", status: 429, detail: "rate_limit", message: "slow down" }, record: GOOD, now: at(5000) });
  assert.equal(d.act, "stop");
  assert.equal(d.why, "upstream");
  assert.equal(d.status, 429);
  assert.equal(d.detail, "rate_limit", "the provider's error type is dropped — the Worker cannot name the cause");
  // A 400 is a refusal too, and an empty account answers with one.
  assert.equal(resumeDecision({ poll: { state: "failed", status: 400 }, record: GOOD, now: at(5000) }).act, "stop");
});

test("A TIMEOUT STOPS TOO, and for a different reason", () => {
  // It has no status and may have spent everything, and retrying is a second
  // ten-minute wait stacked on the first — the exact clock this change exists
  // to get under. Named apart from the provider refusal, or an operator cannot
  // tell "they refused us" from "nobody answered".
  //
  // BOTH SPELLINGS, because one abort reaches workerd as `TimeoutError` and
  // Node as `AbortError` — a cross-engine difference this repo has been bitten
  // by twice, and one that here decides whether somebody is billed twice.
  for (const poll of [
    { state: "failed", kind: "TimeoutError", message: "the operation was aborted" },
    { state: "failed", kind: "AbortError", message: "aborted" },
  ]) {
    const d = resumeDecision({ poll, record: GOOD, now: at(5000) });
    assert.equal(d.act, "stop", `a timeout was retried: ${JSON.stringify(poll)}`);
    assert.equal(d.why, "timeout");
  }
});

test("THE MONEY RULE IS `retryHere`, NEVER A SECOND COPY OF IT", () => {
  // Composed rather than reimplemented — and the first draft DID reimplement
  // it, matching the word "timeout" in the MESSAGE. That is the anti-pattern
  // `isCallTimeout` was written to prevent: a message belongs to the runtime,
  // an error's `name` belongs to the abort. Driven from both ends here, so the
  // day `retryHere` changes its mind this follows rather than disagreeing.
  const cases = [
    { state: "failed", status: 429, kind: "Error" },
    { state: "failed", status: 400, kind: "Error" },
    { state: "failed", kind: "TimeoutError" },
    { state: "failed", kind: "AbortError" },
    { state: "failed", kind: "Error", message: "XAI_API_KEY is not set" },
    { state: "failed", kind: "TypeError", message: "fetch failed" },
    // THE THREE THAT DISCRIMINATE, and finding them cost a sweep. A message
    // that MENTIONS an abort or a timeout while the error's own NAME says
    // otherwise: `retryHere` retries these — nothing was spent, no status —
    // and a message-matching copy refuses them, stranding a build that could
    // have finished for free.
    //
    // My first attempt at this test used "generation timed out after 600000ms"
    // and the mutant SURVIVED, because "timed out" does not contain the string
    // "timeout" — so the copy and the real rule happened to agree on the one
    // case I had chosen to tell them apart. A witness that cannot discriminate
    // is not a witness.
    { state: "failed", kind: "Error", message: "the request was aborted by the proxy" },
    { state: "failed", kind: "TypeError", message: "fetch failed: connection abort" },
    { state: "failed", kind: "Error", message: "upstream timeout" },
    // Kept as well, because it documents `retryHere`'s own accepted trade: a
    // container that got an answer and failed sending it back is retried and
    // the account pays twice, bounded at one extra call.
    { state: "failed", kind: "Error", message: "generation timed out after 600000ms" },
  ];
  for (const poll of cases) {
    const d = resumeDecision({ poll, record: GOOD, now: at(5000) });
    assert.equal(d.act === "here", retryHere(poll),
      `the resume decision and retryHere disagree about ${JSON.stringify(poll)} — a money rule in two places`);
  }
});

test("A FAILURE WITH NO REQUEST BEHIND IT IS RETRIED IN THE WORKER", () => {
  // A key the container was not given, egress refusing the provider, an answer
  // that is not a model answer. Nothing was spent, so making the call here
  // costs a wait and no money — against a customer with no site.
  const d = resumeDecision({ poll: { state: "failed", status: null, kind: "Error", message: "XAI_API_KEY is not set" }, record: GOOD, now: at(5000) });
  assert.equal(d.act, "here");
  assert.equal(d.why, "no-request");
  assert.match(d.message, /XAI_API_KEY/, "the reason is dropped — an operator cannot tell a missing key from blocked egress");
});

test("UNKNOWN MEANS THE CONTAINER LOST THE WORK, and is retried rather than mourned", () => {
  // The container's own TTL is far longer than this deadline, so inside the
  // window `unknown` is a recycled instance rather than an answer that aged
  // out. Nothing is producing the generation anywhere.
  const d = resumeDecision({ poll: { state: "unknown" }, record: { ...GOOD, looks: 2 }, now: at(120_000) });
  assert.equal(d.act, "here");
  assert.equal(d.why, "lost");
});

test("AN UNREADABLE ANSWER IS NOT A FINISHED GENERATION", () => {
  // It falls in with `pending` — bounded by the same clock, which is what stops
  // "we could not read it" becoming an infinite poll. Reading it as `done`
  // would publish a site from nothing; reading it as `failed` would give up on
  // a generation that is still running.
  for (const poll of [null, undefined, {}, { state: "" }, { state: "banana" }, "done", []]) {
    const d = resumeDecision({ poll, record: { ...GOOD, looks: 1 }, now: at(1000) });
    assert.equal(d.act, "wait", `an unreadable poll answer was acted on: ${JSON.stringify(poll)}`);
  }
  // …and it is still bounded.
  assert.equal(resumeDecision({ poll: {}, record: { ...GOOD, looks: 1 }, now: at(RESUME_DEADLINE_MS + 1) }).act, "stop");
});

test("A DONE ANSWER WINS OVER THE DEADLINE", () => {
  // The clock decides when to stop WAITING, never what to do with an answer
  // that is already in hand. Throwing one away because the poll was late is the
  // most expensive mistake available here: the tokens are spent either way.
  const d = resumeDecision({ poll: { state: "done", answer: { ok: 1 } }, record: { ...GOOD, looks: RESUME_MAX_LOOKS }, now: at(RESUME_DEADLINE_MS * 10) });
  assert.equal(d.act, "finish", "a finished generation past the deadline was discarded");
});
