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

test("the key is minted once per ask and reused for the retry", () => {
  // THE PROPERTY THE WHOLE MECHANISM RESTS ON. The server's idempotency is
  // (uid, slug, op, idem_key), so a key minted per ATTEMPT is by definition a
  // new job — two sets of model calls and two charges for one ask, which is
  // exactly what a retry after a lost response would produce.
  assert.match(CHAT, /editIdem\.set\(slug, EditPoll\.newIdemKey\(\)\)/,
    "the retry key is no longer minted per ask");
  const fn = CHAT.slice(CHAT.indexOf("function siteEdit("), CHAT.indexOf("function watchEditJob("));
  assert.ok(fn.length > 500, "the siteEdit window came out empty");
  // Minted only when this is NOT a sideways hop — a hop is the same ask
  // continuing and must carry the same key.
  const mint = fn.indexOf("editIdem.set(slug");
  const guard = fn.lastIndexOf("if (!handedOff) {", mint);
  assert.ok(guard >= 0 && guard < mint, "the key is minted outside the first-submission guard");
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
  const fn = CHAT.slice(CHAT.indexOf("function siteEdit("), CHAT.indexOf("function watchEditJob("));
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
  assert.match(w, /shouldRetryPoll\(r\.status\)/, "transient failures are no longer retried");
  assert.match(w, /w\.attempt > 400/, "the retry loop is unbounded");
});

test("a 404 while polling says nothing about whether a job exists", () => {
  const w = CHAT.slice(CHAT.indexOf("function watchEditJob("), CHAT.indexOf("function cancelEditJob("));
  const at404 = w.indexOf("r.status === 404");
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
  const done = w.indexOf("verdict.kind === 'done'");
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
  assert.match(CHAT, /verdict\.kind === 'needs_review'\) editBlocked\.add\(slug\)/, "a review outcome does not block the site");
  assert.match(CHAT, /e\.error === 'needs-review'\) \{ editBlocked\.add\(slug\)/, "the server's own refusal does not block the site");
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
  const fn = CHAT.slice(CHAT.indexOf("function siteEdit("), CHAT.indexOf("function watchEditJob("));
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
