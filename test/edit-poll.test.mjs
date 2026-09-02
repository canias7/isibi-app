// Watching a queued edit from the browser.
//
// ── WHY THE LOGIC IS IN ITS OWN FILE, AND WHY THAT MATTERS HERE ───────────
//
// `chat.js` touches `document` at load, so nothing inside it can be driven by a
// test — only read. Every decision the polling makes is one where a wrong
// answer costs real money or a real site: whether a retry is the same edit or a
// new one, whether a terminal answer has been seen before, whether a dropped
// connection means "cancel". So they live in `public/edit-poll.js`, which runs
// in both places, and this file DRIVES them with literal inputs and a fake
// clock rather than asserting their spelling.
//
// The wiring in chat.js is read, because there is nothing to run it against —
// and those reads are anchored on order and absence, never on a call's shape.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const P = require("../public/edit-poll.js");
const CHAT_RAW = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

/**
 * Comments blanked, length preserved and string-aware.
 *
 * NOT OPTIONAL, AND THIS FILE PROVED IT. The 404 assertion below forbids the
 * words a leak would use — "not yours", "exists" — and the branch it guards is
 * wrapped in a comment EXPLAINING why those must not be said. Read raw, the
 * guard flagged the paragraph arguing for the rule as a breach of it. Ninth
 * recorded instance in this repo, several of them inside the guard written for
 * the trap.
 */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const CHAT = blankComments(CHAT_RAW);

test("the comment blanker leaves strings alone", () => {
  // The observer for the blanker itself: every assertion below is downstream of
  // it, and one that eats code makes them all lie in the direction of reporting
  // correct code as broken.
  const sample = "const a = 'lost track'; // not yours\nconst b = 1;\n";
  const out = blankComments(sample);
  assert.ok(out.includes("'lost track'"), "the blanker ate a string");
  assert.ok(!out.includes("not yours"), "the blanker stopped blanking comments");
  assert.equal(out.length, sample.length, "the blanker no longer preserves offsets");
});
const HTML = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

/** A localStorage that lives in a variable, so resume can be driven. */
function fakeStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

// ── ONE KEY PER ASK ───────────────────────────────────────────────────────

test("an idempotency key is the shape the server will accept", () => {
  const k = P.newIdemKey();
  // The server takes 16-64 of [A-Za-z0-9_-]; hex can never surprise it.
  assert.match(k, /^[0-9a-f]{32}$/);
  assert.notEqual(P.newIdemKey(), P.newIdemKey());
  // And it works without a CSPRNG, because a browser that has none must still
  // be able to send an edit rather than silently sending one with no key.
  let i = 0;
  const seeded = P.newIdemKey(() => ((i = (i + 7) % 16), i / 16));
  assert.match(seeded, /^[0-9a-f]{32}$/);
});

test("the key is minted once per submission and reused for the retry", () => {
  // THE PROPERTY THE WHOLE MECHANISM RESTS ON. The server's idempotency is
  // (uid, slug, op, idem_key), so a key minted per network ATTEMPT is by
  // definition a new job — two sets of model calls and two charges for one
  // ask, which is exactly what a retry after a lost response would produce.
  assert.match(CHAT, /editIdem\.set\(slug, EditPoll\.newIdemKey\(\)\)/,
    "the retry key is no longer minted per submission");
  // THE WINDOW CLOSES ON THE REAL NEIGHBOUR. It said `function watchEditJob(`,
  // and `escalatedEdit` was later inserted between the two — so this window
  // silently grew over a function it says nothing about. The overlapping-window
  // trap, and the version that bites is the one you introduce yourself.
  const open = CHAT.indexOf("function siteEdit(");
  const shut = CHAT.indexOf("function escalatedEdit(");
  assert.ok(open > 0 && shut > open, "the siteEdit window's landmarks are gone or out of order");
  const fn = CHAT.slice(open, shut);
  assert.ok(fn.length > 500, "the siteEdit window came out empty");
  // ── RE-ANCHORED 2026-09-01, AND IT WAS ASSERTING THE OPPOSITE ──────────
  //
  // This read "minted only when this is NOT a sideways hop", on the reasoning
  // that a hop is the same ask continuing. True while an escalate created
  // nothing on the server; false once the queue landed, because `edit_create`
  // keys on (uid, slug, op, idem_key) with NO LAYER IN IT — so a hop carrying
  // the first key matches the job that just escalated, comes back
  // `duplicate: true`, and the cheaper job is never filed at all.
  //
  // AND THE OLD ASSERTION PASSED ANYWAY, which is the part worth recording:
  // `lastIndexOf(guard, mint)` finds the guard whether the mint is inside it or
  // a hundred lines below it, so `guard < mint` was true either way. It read
  // as a check on placement and could only ever fail if the guard vanished.
  // Anchored on the guard's CLOSE now, which is the thing that actually
  // distinguishes inside from outside.
  const mint = fn.indexOf("editIdem.set(slug");
  const guard = fn.indexOf("if (!handedOff) {");
  const latch = fn.indexOf("editInFlight.add(");
  assert.ok(mint > 0 && guard > 0 && latch > guard, "the mint, the guard or the latch is gone");
  const guardEnd = fn.indexOf("}", latch);
  assert.ok(guardEnd > latch, "the first-submission guard never closes");
  assert.ok(mint > guardEnd,
    "the key is minted inside the first-submission guard, so a sideways hop re-files the job that just escalated");
  assert.match(fn, /idem: idem,/, "the key is no longer sent with the POST");
  // EXACTLY ONE MINT IN THE WHOLE FUNCTION. A sweep that left the guarded mint
  // alone and added a second at the point of use survived every check above —
  // the first `indexOf` found the guarded one and never looked further. A count
  // is what catches a mint being ADDED rather than moved.
  const mints = (fn.match(/EditPoll\.newIdemKey\(\)/g) || []).length;
  assert.equal(mints, 1, `siteEdit mints ${mints} keys — every one past the first is a second job for one ask`);
  assert.match(fn, /const idem = editIdem\.get\(slug\);/,
    "the key used in the POST is not read from the per-ask store");
});

test("a second click while the first POST is unresolved does nothing", () => {
  const open = CHAT.indexOf("function siteEdit(");
  const shut = CHAT.indexOf("function escalatedEdit(");
  assert.ok(open > 0 && shut > open, "the siteEdit window's landmarks are gone or out of order");
  const fn = CHAT.slice(open, shut);
  assert.match(fn, /if \(editInFlight\.has\(slug\)\) return;/, "a double submission is no longer refused");
  assert.match(fn, /editInFlight\.add\(slug\)/, "nothing marks the edit in flight");
  // AND EVERY SYNCHRONOUS EXIT RELEASES IT, or the site is locked for the
  // session after one failure. Counted rather than enumerated, so a new exit
  // that forgets is visible as a number falling.
  const clears = (fn.match(/clearFlight\(\)/g) || []).length;
  assert.ok(clears >= 4, `only ${clears} release points — an exit that never releases locks the site`);
  assert.match(fn, /\.catch\(\(err\) => \{ clearFlight\(\)/, "a thrown POST leaves the site locked");
});

// ── THE POLL ──────────────────────────────────────────────────────────────

test("polling backs off, is bounded at both ends, and is jittered", () => {
  // BOUNDED BELOW so a wedged job costs a few requests a minute rather than
  // hundreds, and ABOVE so a finished edit is not left sitting unnoticed.
  for (let a = 0; a < 40; a++) {
    for (const r of [0, 0.5, 1]) {
      const ms = P.pollDelayMs(a, () => r);
      assert.ok(ms >= P.POLL_MIN_MS && ms <= P.POLL_MAX_MS, `attempt ${a} r=${r} gave ${ms}`);
    }
  }
  // IT GROWS. A fixed interval is wasted work on an edit that takes minutes.
  assert.ok(P.pollDelayMs(0, () => 0.5) < P.pollDelayMs(4, () => 0.5), "the delay does not back off");
  assert.equal(P.pollDelayMs(30, () => 0.5), P.POLL_MAX_MS, "the backoff never reaches its ceiling");
  // AND IT IS JITTERED. Without this every client that started together stays
  // together, so a queue that stalls clears into a synchronised stampede.
  const lo = P.pollDelayMs(3, () => 0);
  const hi = P.pollDelayMs(3, () => 1);
  assert.ok(hi > lo, "the delay is identical whatever the random source says — no jitter");
  // Spread AROUND the delay rather than added to it, so the average cadence is
  // the curve and not the curve plus a bias.
  const mid = P.pollDelayMs(3, () => 0.5);
  assert.ok(Math.abs((lo + hi) / 2 - mid) <= 1, "the jitter is not symmetric about its own midpoint");
  // AND SYMMETRY ALONE IS NOT ENOUGH. `base + r * spread` is symmetric about
  // its own midpoint too — it is simply the whole curve shifted upward, so
  // every delay is longer than intended while looking evenly spread. A sweep
  // survived the check above on exactly that. The property is that the MEDIAN
  // DRAW IS THE CURVE: unbiased, not merely even.
  for (const n of [0, 1, 3, 7]) {
    assert.equal(P.pollDelayMs(n, () => 0.5), Math.round(P.pollBaseMs(n)),
      `attempt ${n}: the median delay is not the backoff curve — the jitter is biased`);
    assert.ok(P.pollDelayMs(n, () => 0) < P.pollBaseMs(n) || P.pollBaseMs(n) === P.POLL_MIN_MS,
      `attempt ${n}: the low end never goes below the curve, so the spread is one-sided`);
  }
  // A nonsense attempt is not a zero-delay spin.
  assert.ok(P.pollDelayMs(-5, () => 0.5) >= P.POLL_MIN_MS);
  assert.ok(P.pollDelayMs("x", () => 0.5) >= P.POLL_MIN_MS);
});

test("every terminal status is named, and needs_review outranks its status", () => {
  assert.deepEqual(P.classify("done"), { terminal: true, kind: "done", ok: true });
  for (const s of ["failed", "cancelled", "lost"]) {
    assert.deepEqual(P.classify(s), { terminal: true, kind: s, ok: false });
  }
  for (const s of ["queued", "claimed", "routing", "editing", "building", "verifying", "publishing", "", "wat"]) {
    assert.equal(P.classify(s).terminal, false, `${s} was treated as terminal`);
  }
  // `needs_review` RIDES BESIDE a status and outranks it: it is the one outcome
  // where the customer must be stopped from simply trying again.
  assert.deepEqual(P.classify("lost", true), { terminal: true, kind: "needs_review", ok: false });
  assert.deepEqual(P.classify("done", true), { terminal: true, kind: "needs_review", ok: false });
  // A NON-STRING IS NOT TERMINAL, rather than coerced into one.
  assert.equal(P.classify(["done"]).terminal, false);
  assert.equal(P.classify(null).terminal, false);
  // The list the module publishes is the list it acts on, in both directions.
  assert.deepEqual([...P.TERMINAL].sort(), ["cancelled", "done", "failed", "lost"]);
});

test("a transient poll failure retries the POLL and never the POST", () => {
  for (const s of [0, null, undefined, 429, 500, 502, 503, 504, 599]) {
    assert.equal(P.shouldRetryPoll(s), true, `${s} should be retried`);
  }
  for (const s of [200, 202, 400, 401, 403, 404, 409]) {
    assert.equal(P.shouldRetryPoll(s), false, `${s} should not be retried`);
  }
  // AND THE RETRY IS A GET. The one thing a poll failure must never do is
  // resubmit the edit — a second job for one ask, walking straight past the
  // idempotency key.
  const w = CHAT.slice(CHAT.indexOf("function watchEditJob("), CHAT.indexOf("function cancelEditJob("));
  assert.ok(w.length > 500, "the watch window came out empty");
  assert.doesNotMatch(w, /method: 'POST'/, "the watcher can POST — a retry would resubmit the edit");
  // RE-ANCHORED: the retry decision moved into `readPoll`, which is DRIVEN
  // above rather than read. What this window still owns is that the watcher
  // acts on that decision and bounds the loop.
  assert.match(w, /read\.act === 'retry'/, "transient failures are no longer retried");
  assert.match(w, /w\.attempt > 400/, "the retry loop is unbounded");
});

test("a 404 while polling says nothing about whether a job exists", () => {
  const w = CHAT.slice(CHAT.indexOf("function watchEditJob("), CHAT.indexOf("function cancelEditJob("));
  // RE-ANCHORED: a 404 is `readPoll`'s `gone`, driven above. This window owns
  // what the branch SAYS, which is the half that could leak an oracle.
  const at404 = w.indexOf("read.act === 'gone'");
  assert.ok(at404 > 0, "a 404 is no longer handled distinctly");
  const branch = w.slice(at404, at404 + 700);
  // The server answers 404 both for a job that is not yours and for one that
  // does not exist, deliberately. Anything here that told the two apart would
  // put the oracle back on the client side.
  assert.doesNotMatch(branch, /not yours|another user|belongs to|exists/i,
    "the 404 branch tells the customer something about whose job it is");
  assert.match(branch, /lost track/, "the 404 branch no longer says what it actually knows");
});

// ── EXACTLY ONCE ──────────────────────────────────────────────────────────

test("a completed result is applied once however many times it arrives", () => {
  const w = P.makeWatch("j1", "s1");
  assert.equal(w.taken(), false);
  assert.deepEqual(w.take({ ok: true }), { ok: true });
  assert.equal(w.taken(), true);
  // A final answer can arrive more than once: a retry that raced the first, a
  // resumed watch after a refresh, two tabs on one job. Applying twice bumps
  // the preview twice and, on a `data` edit, offers an undo for rows already
  // back.
  assert.equal(w.take({ ok: true }), null);
  assert.equal(w.take({ ok: true }), null);
  // AND THE LATCH IS PER WATCH, not global — two jobs must not share one.
  assert.deepEqual(P.makeWatch("j2", "s1").take({ ok: true }), { ok: true });
});

test("the terminal branch takes the same latch the success branch does", () => {
  // OTHERWISE ONE FINAL ANSWER PRINTS TWICE. A failed job's message goes
  // through a different branch from a done job's result, and a latch that only
  // covered the success path would let a duplicate terminal poll re-announce a
  // failure — with a second credit refresh behind it.
  const w = CHAT.slice(CHAT.indexOf("function watchEditJob("), CHAT.indexOf("function cancelEditJob("));
  assert.match(w, /if \(w\.take\(true\) === null\) return;/,
    "the non-success terminal branch is not latched, so it can fire twice");
  const done = w.indexOf("read.act === 'reply'");
  const latch = w.indexOf("w.take(true)");
  assert.ok(done > 0 && latch > done, "the terminal latch runs before the success branch");
});

// ── STOP WATCHING IS NOT CANCEL ───────────────────────────────────────────

test("cancelled is shown only when the server confirms it", () => {
  assert.equal(P.isCancelConfirmed({ ok: true, cancel: true }), true);
  assert.equal(P.isCancelConfirmed({ ok: true, status: "cancelled" }), true);
  // AN ABORTED FETCH SAYS NOTHING ABOUT THE JOB. It means this browser stopped
  // asking; the work is in a queue consumer that has never heard of it.
  assert.equal(P.isCancelConfirmed(null), false);
  assert.equal(P.isCancelConfirmed({ ok: false }), false);
  assert.equal(P.isCancelConfirmed({ cancel: true }), false);
  assert.equal(P.isCancelConfirmed({ ok: true }), false);
});

test("a cancel refused because publishing started keeps watching", () => {
  assert.equal(P.isCancelTooLate(409, null), true);
  assert.equal(P.isCancelTooLate(200, { error: "too-late" }), true);
  assert.equal(P.isCancelTooLate(200, { ok: true, cancel: true }), false);
  // THE EDIT IS GOING TO LAND, so the right move is to keep polling and report
  // what actually happened rather than announcing a cancel that did not occur.
  const c = CHAT.slice(CHAT.indexOf("function cancelEditJob("), CHAT.indexOf("function resumeEditJob("));
  assert.ok(c.length > 300, "the cancel window came out empty");
  const paths = (c.match(/watchEditJob\(/g) || []).length;
  assert.ok(paths >= 4, `only ${paths} of the cancel's outcomes resume watching — one of them gives up on a live edit`);
  assert.match(c, /\.catch\(\(\) => \{ watchEditJob\(/, "a failed cancel stops watching a job that is still running");
});

test("nothing in the watcher cancels, and nothing on unload does either", () => {
  const w = CHAT.slice(CHAT.indexOf("function watchEditJob("), CHAT.indexOf("function cancelEditJob("));
  // CLOSING THE UI MUST NOT CANCEL QUEUED WORK. It is paid for and the site is
  // mid-edit; cancelling because somebody switched apps throws that away.
  assert.doesNotMatch(w, /method: 'DELETE'/, "the watcher itself can cancel");
  assert.doesNotMatch(CHAT, /(beforeunload|pagehide|visibilitychange)[\s\S]{0,300}?\/api\/site\/edit\//,
    "something cancels a queued edit when the page goes away");
});

// ── RESUME ────────────────────────────────────────────────────────────────

test("a refresh resumes the same job instead of sending another edit", () => {
  const store = fakeStore();
  assert.equal(P.resumableJob("s1", Date.now(), store), null);
  P.rememberJob("s1", "j1", store);
  assert.equal(P.resumableJob("s1", Date.now(), store), "j1");
  // PER SITE, so two sites in one browser do not resume each other's job.
  assert.equal(P.resumableJob("s2", Date.now(), store), null);
  P.forgetJob("s1", store);
  assert.equal(P.resumableJob("s1", Date.now(), store), null);
});

test("a stale entry is dropped rather than polled", () => {
  const store = fakeStore();
  P.rememberJob("s1", "j1", store);
  // A job is bounded by the consumer's fifteen minutes, so an hour-old entry
  // names something long finished — and polling it answers 404 and tells the
  // customer their edit could not be followed, about an edit that succeeded.
  assert.equal(P.resumableJob("s1", Date.now() + 3600001, store), null);
  assert.equal(P.resumableJob("s1", Date.now() + 60000, store), "j1");
  // A clock that went backwards is not a fresh job either.
  assert.equal(P.resumableJob("s1", Date.now() - 10000, store), null);
});

test("the store holds only a job id, never a body or a marker", () => {
  const store = fakeStore();
  P.rememberJob("s1", "j1", store);
  const raw = store.getItem(P.STORE_KEY);
  const parsed = JSON.parse(raw);
  assert.deepEqual(Object.keys(parsed.s1).sort(), ["at", "job"]);
  // NOTHING THE SERVER TOLD US IN CONFIDENCE. The replay marker in particular
  // is the credential that proves a request came from the queue consumer, and
  // it never reaches a client at all — but the store is the place a future
  // change would be tempted to put one.
  assert.ok(!/secret|marker|authorization|bearer|body/i.test(raw), "the resume store carries more than an id");
});

test("a private window is not a reason to fail an edit", () => {
  // Every accessor is wrapped, because a browser set to block site data throws
  // on `getItem` rather than answering null — and an edit that cannot be sent
  // because a convenience failed is a worse bug than losing the convenience.
  const hostile = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(P.resumableJob("s1", Date.now(), hostile), null);
  assert.doesNotThrow(() => P.rememberJob("s1", "j1", hostile));
  assert.doesNotThrow(() => P.forgetJob("s1", hostile));
});

// ── WHAT IS SHOWN ─────────────────────────────────────────────────────────

test("needs_review is a clear non-success state that blocks the next edit", () => {
  const msg = P.outcomeMessage("needs_review");
  assert.match(msg, /can't tell yet whether it went live/);
  // THE LIVE SITE STAYS VISIBLE and is said to. A customer told only that
  // something failed will assume their site is down.
  assert.match(msg, /still serving whatever it was serving before/);
  // AND THE FRONTEND STOPS THE NEXT EDIT rather than spending a round trip to
  // be refused. The server refuses too — `edit_create` answers needs-review —
  // so this is the second of two, not the only one.
  assert.match(CHAT, /if \(editBlocked\.has\(slug\)\) \{ finish/, "a blocked site can still be edited from the UI");
  // BOTH ROUTES IN, and they are genuinely different: a job that ENDED under
  // review reaches the watcher as a job state, while a site already under review
  // is refused by `edit_create` and arrives as an error in a reply body. Counted
  // rather than spelled, because both moved once already — the state one when
  // `classify` stopped being the watcher's reader, the reply one when both paths
  // started sharing `editAnswer`.
  assert.match(CHAT, /=== 'needs_review'\) editBlocked\.add\(slug\)/, "a review outcome does not block the site");
  assert.match(CHAT, /e\.error === 'needs-review'\) \{ editBlocked\.add\(o\.slug\)/, "the server's own refusal does not block the site");
  const blocks = (CHAT.match(/editBlocked\.add\(/g) || []).length;
  assert.equal(blocks, 2, `${blocks} places block a site — both routes in must exist and neither may be duplicated`);
});

test("no raw internal detail is ever rendered", () => {
  const w = CHAT.slice(CHAT.indexOf("function watchEditJob("), CHAT.indexOf("function resumeEditJob("));
  // The poll route answers `{ kind, phase }` and the column has nowhere to put
  // a provider message — but "nothing to leak" is a property of today's server,
  // and this is the side that renders.
  for (const bad of ["e.kind", "e.failedPhase", "e.phase", "e.stack", "err.message", "e.detail"]) {
    assert.ok(w.indexOf("finish('⚠️ ' + " + bad) < 0, `${bad} is rendered to the customer`);
  }
  // Only the sentence the handler wrote for a customer, or a fixed one.
  assert.match(w, /e\.msg === 'string' && e\.msg\) \|\| EditPoll\.outcomeMessage\(/,
    "the outcome sentence is no longer chosen from a fixed set");
});

// ── THE FLAG-OFF PATH ─────────────────────────────────────────────────────

test("with no job in the reply the synchronous path runs exactly as before", () => {
  // THE CLOSING LANDMARK IS THE NEXT SIBLING, not the next function this test
  // happens to know the name of. It was `function watchEditJob(`, and
  // `escalatedEdit` was later inserted between the two — so the window silently
  // grew to cover a function this case says nothing about, which is this repo's
  // recorded overlapping-window trap. Derived from the real neighbour instead.
  const open = CHAT.indexOf("function siteEdit(");
  const shut = CHAT.indexOf("function escalatedEdit(");
  assert.ok(open > 0 && shut > open, "the siteEdit window's landmarks are gone or out of order");
  const fn = CHAT.slice(open, shut);
  // ONE BRANCH, AND IT NEEDS A JOB. Flag off, the reply carries none, so
  // nothing below it changes — which is what makes the rollback a variable
  // rather than a revert.
  assert.match(fn, /if \(e && e\.ok && e\.job && !e\.result\) \{/,
    "the job branch is no longer gated on a job actually being present");
  const branch = fn.indexOf("e.ok && e.job");
  const published = fn.indexOf("scheduleCreditRefresh()");
  assert.ok(branch > 0 && published > branch, "the job branch does not precede the synchronous success path");
  // AND THE WATCHER IS LOADED BEFORE THE THING THAT CALLS IT.
  const poll = HTML.indexOf("/edit-poll.js");
  const chat = HTML.indexOf("/chat.js");
  assert.ok(poll > 0 && chat > 0, "a script tag is missing");
  assert.ok(poll < chat, "edit-poll.js loads after chat.js, so EditPoll is undefined when chat.js runs");
});

// ── AN ESCALATE IS NOT AN OUTCOME ─────────────────────────────────────────
//
// Found by the first paid canary, 2026-09-01, and it was live behind the flag.
// The queued reply body IS the synchronous one, but only the synchronous path
// read the escalate: `watchEditJob` applied every terminal answer as an outcome
// and `editReply` ends '✅ Done.', so a queued edit that could not be made told
// the customer it had been, bumped the preview to show an unchanged site, and
// never ran the revise that is the whole safety argument for trying a cheap
// rung first.

test("escalateAction: a hop only when the server names a DIFFERENT layer", () => {
  assert.equal(P.escalateAction({ escalate: true, layer: "page" }, { layer: "picture", hasAsk: true }), "hop");
  // THE SAME LAYER IS NOT A HOP. Re-posting at the rung that just refused is a
  // second charge for the same refusal, and two lanes naming each other would
  // loop — which is why the bound lives on this side and not the server's.
  assert.equal(P.escalateAction({ escalate: true, layer: "picture" }, { layer: "picture", hasAsk: true }), "up");
  // NO NAME, NO CHEAPER ANSWER. Straight up the ladder.
  assert.equal(P.escalateAction({ escalate: true }, { layer: "look", hasAsk: true }), "up");
  assert.equal(P.escalateAction({ escalate: true, layer: "" }, { layer: "look", hasAsk: true }), "up");
});

test("escalateAction: exactly one hop, however the server answers", () => {
  // `handedOff` is the bound, and it must beat a named layer — otherwise a pair
  // of lanes each naming the other bills a round trip per exchange for ever.
  assert.equal(P.escalateAction({ escalate: true, layer: "page" }, { layer: "picture", handedOff: true, hasAsk: true }), "up");
});

test("escalateAction: a layer that is not a string is not a layer", () => {
  // `String(["page"])` is "page" — shipped as a real bug in this repo four
  // times over (a role, an access level, a language, a language again). A hop
  // decided from a coerced array would post at a layer nobody named.
  for (const bad of [["page"], { layer: "page" }, 7, true, null, undefined]) {
    assert.equal(P.escalateAction({ escalate: true, layer: bad }, { layer: "picture", hasAsk: true }), "up",
      "a non-string layer was read as a layer: " + JSON.stringify(bad));
  }
  // AND THE OBSERVER IS ALIVE: the same call with a real string does hop, so
  // the loop above is not passing because nothing can ever hop.
  assert.equal(P.escalateAction({ escalate: true, layer: "page" }, { layer: "picture", hasAsk: true }), "hop");
});

test("escalateAction: without the ask it neither hops nor spends", () => {
  // A watch resumed after a refresh holds the job id and nothing else. Falling
  // through to `fallback` there would start a ~25-credit rewrite on page load
  // for a sentence nobody re-typed, so the honest answer is to say so.
  assert.equal(P.escalateAction({ escalate: true, layer: "page" }, { layer: "picture", hasAsk: false }), "lost");
  assert.equal(P.escalateAction({ escalate: true }, { hasAsk: false }), "lost");
  // MISSING OPTIONS ARE NOT AN ASK EITHER — `hasAsk` absent must not read as
  // present, or a caller that forgets to pass it spends money silently.
  assert.equal(P.escalateAction({ escalate: true, layer: "page" }, {}), "lost");
  assert.equal(P.escalateAction({ escalate: true }, undefined), "lost");
});

test("the queued path routes an escalate through the same one decision", () => {
  // THE WATCHER DELEGATES RATHER THAN RENDERING. It had its own tail once, and
  // that tail is where all three of this day's defects lived.
  const wOpen = CHAT.indexOf("function watchEditJob(");
  const wShut = CHAT.indexOf("function cancelEditJob(");
  assert.ok(wOpen > 0 && wShut > wOpen, "the watchEditJob window's landmarks are gone or out of order");
  const w = CHAT.slice(wOpen, wShut);
  assert.match(w, /return editAnswer\(/, "the queued watcher no longer hands its reply to the shared reader");
  // AND IT DECIDES NOTHING ITSELF about what the reply means. Each of these was
  // a real second copy: the escalate check, the preview bump and the reply.
  assert.doesNotMatch(w, /escalatedEdit\(/, "the watcher kept its own escalate branch — a second copy of one decision");
  assert.doesNotMatch(w, /previewV/, "the watcher kept its own preview bump");
  assert.doesNotMatch(w, /editReply\(/, "the watcher kept its own reply rendering");
  // AFTER THE ONCE-ONLY LATCH, or one answer arriving twice hops twice.
  const take = w.indexOf("w.take(e)");
  const hand = w.indexOf("return editAnswer(");
  assert.ok(take > 0 && hand > take, "the reply is handed on before the exactly-once latch");

  // ── AND THE SHARED READER PUTS THE ESCALATE BEFORE THE APPLIER ──────────
  const aOpen = CHAT.indexOf("function editAnswer(");
  const aShut = CHAT.indexOf("function applyEditResult(");
  assert.ok(aOpen > 0 && aShut > aOpen, "the editAnswer window's landmarks are gone or out of order");
  const a = CHAT.slice(aOpen, aShut);
  const esc = a.indexOf("escalatedEdit(");
  const applied = a.indexOf("applyEditResult(");
  assert.ok(esc > 0 && applied > 0, "editAnswer no longer both escalates and applies");
  assert.ok(esc < applied,
    "an escalate is read after the applier, so a site that did not change is reported as changed");
});

test("one escalate decision, not two", () => {
  // The two paths carry the same body and must read it the same way; two copies
  // drift, and the drift is silent. `escalatedEdit` is the only reader, so the
  // synchronous branch must delegate rather than keep its own hop.
  const calls = (CHAT.match(/escalatedEdit\(/g) || []).length;
  // ONE DEFINITION AND ONE CALLER — `editAnswer`, which is itself the single
  // reader both paths reach. Three mentions meant the watcher still had its own
  // branch, which is how this started.
  assert.equal(calls, 2, "escalatedEdit has " + calls + " mentions — anything but one definition and one caller is a second copy");
  // AND THE DECISION ITSELF IS NOT RE-MADE IN chat.js. Anything comparing a
  // server-named layer against our own outside the poll module is a second copy
  // of the rule this file drives.
  const body = CHAT.slice(CHAT.indexOf("function escalatedEdit("), CHAT.indexOf("function watchEditJob("));
  assert.ok(body.includes("EditPoll.escalateAction("),
    "escalatedEdit decides for itself instead of asking the module a test can drive");
});

test("a hop is a new submission, so it carries a new key", () => {
  const open = CHAT.indexOf("function siteEdit(");
  const shut = CHAT.indexOf("function escalatedEdit(");
  assert.ok(open > 0 && shut > open, "the siteEdit window's landmarks are gone or out of order");
  const fn = CHAT.slice(open, shut);
  const mint = fn.indexOf("editIdem.set(");
  const latch = fn.indexOf("editInFlight.add(");
  assert.ok(mint > 0 && latch > 0, "the key mint or the in-flight latch is gone");
  // THE MINT IS OUTSIDE THE `!handedOff` BLOCK and the latch is inside it —
  // `edit_create` keys on (uid, slug, op, idem_key) with no layer in it, so a
  // hop reusing the first key matches the job that just escalated, comes back
  // `duplicate: true`, and the cheaper job is never filed at all.
  const guard = fn.indexOf("if (!handedOff) {");
  const guardEnd = fn.indexOf("}", fn.indexOf("editInFlight.add("));
  assert.ok(guard > 0 && guardEnd > guard, "the handedOff guard is gone");
  assert.ok(latch > guard && latch < guardEnd, "the in-flight latch left the handedOff guard");
  assert.ok(mint > guardEnd, "the key is still minted only for a first submission, so a sideways hop re-files the escalated job");
});

test("the live watch is handed the ask it needs to act on an escalate", () => {
  const open = CHAT.indexOf("function siteEdit(");
  const shut = CHAT.indexOf("function escalatedEdit(");
  const fn = CHAT.slice(open, shut);
  assert.ok(open > 0 && shut > open, "the siteEdit window's landmarks are gone or out of order");
  // The 202 branch starts the watch, and without the instruction that watch can
  // only ever answer "lost" — a queued escalate would then never reach the
  // revise, which is the bug this whole block exists to close, one hop over.
  assert.match(fn, /watchEditJob\(site, d, e\.job, origin, finish, fallback, instruction, imgs\)/,
    "the queued watch is started without the ask, so an escalate cannot hop or fall back");
});

// ── THE POLL'S TWO VOICES ─────────────────────────────────────────────────
//
// The defect this closes was live behind the canary flag and is the largest of
// the three found on 2026-09-01: a finished job hands back its STORED REPLY,
// which has no job-state field, so `classify(undefined)` answered `running` and
// the browser polled a finished, charged, PUBLISHED edit for ever. `wait` has
// no attempt bound, so it never even gave up. Every queued success and every
// queued escalate — only the outcomes that store no reply terminated at all.

test("readPoll: a stored reply is the answer, whatever status it carries", () => {
  const F = P.FINAL_VALUE;
  // The four a stored reply really wears: a success, a compile refusal, a model
  // outage, and an escalate. Every one of them is the END of the edit.
  for (const st of [200, 422, 503, 409]) {
    assert.deepEqual(P.readPoll(st, F, { ok: false }), { act: "reply" }, `${st} with the final header`);
  }
});

test("readPoll: a stored 503 is not a transient one", () => {
  // THE WHOLE POINT OF THE HEADER. By status alone these are the same number:
  // one is the poll route failing to read a row, the other is the edit's own
  // answer. Read as transient, the second is retried until the client gives up
  // on an edit that finished minutes ago.
  assert.deepEqual(P.readPoll(503, P.FINAL_VALUE, null), { act: "reply" });
  assert.deepEqual(P.readPoll(503, null, null), { act: "retry" });
  assert.deepEqual(P.readPoll(429, null, null), { act: "retry" });
});

test("readPoll: the running job still waits, and the ended one still ends", () => {
  // No header: the route is describing the JOB, not handing back a reply.
  assert.deepEqual(P.readPoll(202, null, { status: "routing" }), { act: "wait" });
  assert.deepEqual(P.readPoll(202, null, { status: "lost" }), { act: "ended", kind: "lost" });
  assert.deepEqual(P.readPoll(202, null, { status: "cancelled" }), { act: "ended", kind: "cancelled" });
  // `needs_review` outranks the status it rides beside, exactly as it does in
  // `classify` — this must not be re-decided here.
  assert.deepEqual(P.readPoll(202, null, { status: "failed", review: true }), { act: "ended", kind: "needs_review" });
});

test("readPoll: gone is checked first, and says nothing", () => {
  // A 404 carries no header and is not worth retrying. It is also what a job
  // belonging to somebody else gets, so nothing may distinguish the two.
  assert.deepEqual(P.readPoll(404, null, null), { act: "gone" });
  // AND IT WINS OVER EVERYTHING, including a header a hostile answer set.
  assert.deepEqual(P.readPoll(404, P.FINAL_VALUE, { status: "done" }), { act: "gone" });
});

test("readPoll: the header must match exactly", () => {
  // Anything else is the poll route talking. A loose check here would read a
  // stray header as an answer and end the watch on a running job.
  for (const bad of ["", "FINAL", "final ", "x", null, undefined, true, 1, ["final"]]) {
    const out = P.readPoll(202, bad, { status: "routing" });
    assert.equal(out.act, "wait", "a header of " + JSON.stringify(bad) + " was read as final");
  }
  // AND THE OBSERVER IS ALIVE — the same call with the real value does end it.
  assert.deepEqual(P.readPoll(202, P.FINAL_VALUE, { status: "routing" }), { act: "reply" });
});

test("the header the client waits for is the one the server sends", () => {
  // TWO COPIES OF ONE NAME, unavoidably: `public/edit-poll.js` is a browser
  // global and cannot import from `builder/`. So they are compared rather than
  // trusted — the drift this repo has a rule about, caught rather than assumed.
  const src = readFileSync(new URL("../builder/edit-job.mjs", import.meta.url), "utf8");
  const h = /export const FINAL_HEADER = "([^"]+)"/.exec(src);
  const v = /export const FINAL_VALUE = "([^"]+)"/.exec(src);
  assert.ok(h && v, "the server no longer exports the final-reply header");
  assert.equal(P.FINAL_HEADER, h[1], "the client waits for a header the server does not send");
  assert.equal(P.FINAL_VALUE, v[1], "the client waits for a value the server does not send");
  // AND THE ROUTE ACTUALLY SETS IT. The constant existing is the plumbing; this
  // is the connection — the hop this repo has lost twelve features at.
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /\[FINAL_HEADER\]: FINAL_VALUE/,
    "the poll route never stamps the final-reply header, so the client cannot tell a finished job from a running one");
});

test("a done job never wears the failure sentence", () => {
  // `edit_finalize` refuses to finalize a job whose `published_at` is null, so
  // `done` means published. Reached only when a finished job has no stored
  // reply — which should be impossible, and whose wrong answer would be telling
  // somebody their live change did not happen.
  const msg = P.outcomeMessage("done");
  assert.doesNotMatch(msg, /untouched|didn't finish|refunded/,
    "a published edit is described as one that did not happen");
  assert.match(msg, /updated/, "the done sentence does not say the site changed");
});

test("the key mint is not conditional, however the condition is written", () => {
  // A SWEEP SURVIVOR, 2026-09-01. The placement check above compares the mint's
  // offset against the guard's CLOSE, which catches the mint being moved back
  // inside the block — and misses an `if (!handedOff)` added inline on the mint
  // statement itself, because that leaves the offset exactly where it was.
  // Position cannot see a condition; only the statement can.
  const open = CHAT.indexOf("function siteEdit(");
  const shut = CHAT.indexOf("function editAnswer(");
  assert.ok(open > 0 && shut > open, "the siteEdit window's landmarks are gone or out of order");
  const fn = CHAT.slice(open, shut);
  const lines = fn.split("\n").filter((l) => l.includes("editIdem.set("));
  assert.equal(lines.length, 1, `${lines.length} statements mint a key — one submission, one key`);
  assert.doesNotMatch(lines[0], /\bif\b|\?|&&|\|\|/,
    "the mint is conditional, so a sideways hop can carry the first key and re-file the job that just escalated");
});

test("the shared applier does everything the site's own state needs", () => {
  // A SWEEP SURVIVOR, 2026-09-01. The undo halves were guarded and the DELETED
  // PAGE was not — so the line that drops a removed page from the picker could
  // be deleted with the suite green. That is the exact defect this extraction
  // was written to fix, on the queued side, surviving on the shared side.
  const open = CHAT.indexOf("function applyEditResult(");
  const shut = CHAT.indexOf("function escalatedEdit(");
  assert.ok(open > 0 && shut > open, "the applier window's landmarks are gone or out of order");
  const a = CHAT.slice(open, shut);
  // A DELETED PAGE LEAVES THE PICKER. Told it is gone and still offered it is
  // the same lie either way, and a queued `page` edit is the path that had it
  // wrong for real.
  assert.match(a, /e\.removed/, "the applier never reads which pages went");
  assert.match(a, /s\.pages = s\.pages\.filter\(/, "a deleted page is left in the picker");
  // THE PREVIEW, or the change reads as not applied.
  assert.match(a, /previewV/, "nothing busts the preview, so a published change looks like nothing happened");
  // AND THE BALANCE, since an edit that cost credits must not leave a stale one
  // on screen.
  assert.match(a, /scheduleCreditRefresh\(\)/, "the balance is never refreshed after an edit");
});

test("no ask means no spend, on the failure path as well as the escalate", () => {
  // THE SECOND SWEEP SURVIVOR. `escalateAction` answers "lost" without an ask,
  // and that is driven above — but a plain FAILURE reply takes a different
  // branch, and there `o.fallback()` on a watch that has none is both a throw
  // and, if it ever gained one, a ~25-credit rewrite nobody re-typed.
  //
  // UNREACHABLE TODAY and said so rather than asserted as live: `resumeEditJob`
  // is the only caller that omits the ask and it has no callers of its own. It
  // is guarded because what makes it unreachable is one wire away from changing.
  const open = CHAT.indexOf("function editAnswer(");
  const shut = CHAT.indexOf("function applyEditResult(");
  assert.ok(open > 0 && shut > open, "the editAnswer window's landmarks are gone or out of order");
  const a = CHAT.slice(open, shut);
  const guard = a.indexOf("typeof o.fallback !== 'function'");
  assert.ok(guard > 0, "a reply with no ask behind it still reaches the fallback");
  // BEFORE the call it protects, and both landmarks proved.
  const call = a.indexOf("return o.fallback();");
  assert.ok(call > 0, "the failure branch no longer falls back at all");
  assert.ok(guard < call, "the no-ask guard runs after the fallback it exists to prevent");
});

test("escalateAction: an escalate that names the addon rung goes there, not to the revise", () => {
  // Owner, 2026-09-02: "add will always go in addon". The edit route says so
  // with `layer: "addon"`; before this the client had two answers for a
  // server-named layer - a sideways hop, or the full ~25-credit revise - and
  // the middle rung was unreachable from an edit.
  assert.equal(P.escalateAction({ escalate: true, layer: "addon", reason: "addon" }, { layer: "look", hasAsk: true }), "addon");
  // Even after a hop: the addon never escalates back to an edit, so it cannot loop.
  assert.equal(P.escalateAction({ escalate: true, layer: "addon" }, { layer: "look", handedOff: true, hasAsk: true }), "addon");
  // Never without the sentence to hand over.
  assert.equal(P.escalateAction({ escalate: true, layer: "addon" }, { layer: "look", hasAsk: false }), "lost");
  // And a reason alone is not a layer: the decision reads the layer the server named.
  assert.equal(P.escalateAction({ escalate: true, reason: "addon" }, { layer: "look", hasAsk: true }), "up");
});
