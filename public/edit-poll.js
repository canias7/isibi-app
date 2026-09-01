// Watching a queued edit: the decisions, separated from the browser.
//
// ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
//
// `chat.js` cannot be imported by a test — it touches `document` at load — so
// anything living inside it can only ever be asserted by READING it. Every
// decision here is one a wrong answer costs a customer real money or a real
// site: whether a retry is the same edit or a new one, whether a terminal
// status has been seen before, whether a dropped connection means "cancel".
//
// So they live in a file that runs in both places. The browser gets a global;
// `node --test` gets an object it can drive with literal inputs and a fake
// clock. Same code, one copy — the alternative is two, and this repo's own rule
// is that two lists of the same thing drift silently.
(function (root) {
  "use strict";

  /**
   * ONE KEY PER USER ACTION, REUSED FOR EVERY RETRY OF THAT ACTION.
   *
   * This is the whole of request-level idempotency on the client side. A key
   * minted per POST would make a retry after a lost response a SECOND job —
   * two sets of model calls, two charges, two publishes racing for one site —
   * which is precisely what the key exists to prevent. So it is minted when the
   * customer asks for something and carried until that ask is finished.
   *
   * 32 hex from the platform CSPRNG where there is one. `crypto.randomUUID`
   * would do as well; this shape is chosen because the server's own validator
   * takes 16–64 of `[A-Za-z0-9_-]` and a hex string can never surprise it.
   */
  function newIdemKey(rnd) {
    var out = "";
    if (!rnd && typeof crypto !== "undefined" && crypto.getRandomValues) {
      var b = new Uint8Array(16);
      crypto.getRandomValues(b);
      for (var i = 0; i < b.length; i++) out += b[i].toString(16).padStart(2, "0");
      return out;
    }
    var r = rnd || Math.random;
    for (var j = 0; j < 32; j++) out += Math.floor(r() * 16).toString(16);
    return out;
  }

  /** The poll's own ceilings. Named so a test asserts the shape, not the numbers. */
  var POLL_MIN_MS = 900;
  var POLL_MAX_MS = 8000;
  var POLL_JITTER = 0.3;

  /**
   * HOW LONG TO WAIT BEFORE LOOKING AGAIN — bounded backoff with jitter.
   *
   * An aggressive fixed interval is wrong twice: it is wasted work on an edit
   * that takes minutes, and every client that started together stays together,
   * so a queue that stalls produces a synchronised stampede the moment it
   * clears. The jitter is what breaks that up, and it is applied as a spread
   * around the delay rather than added to it, so the AVERAGE cadence is the
   * curve and not the curve plus a bias.
   *
   * BOUNDED AT BOTH ENDS. Never faster than 900ms, so a wedged job costs a few
   * requests a minute rather than hundreds; never slower than 8s, so a finished
   * edit does not sit unnoticed.
   */
  /**
   * The curve WITHOUT the jitter — the delay a median draw should produce.
   *
   * EXPOSED SO THE JITTER CAN BE ASSERTED AS UNBIASED. A sweep replacing the
   * two-sided spread with `base + r * spread` survived a symmetry check
   * perfectly: that form is symmetric about its OWN midpoint and simply shifted
   * upward, so every delay is longer than the curve says while looking evenly
   * spread. Comparing against this is the only way to see the shift.
   */
  function pollBaseMs(attempt) {
    var n = Number(attempt) || 0;
    if (n < 0) n = 0;
    return Math.min(POLL_MAX_MS, POLL_MIN_MS * Math.pow(1.6, n));
  }

  function pollDelayMs(attempt, rnd) {
    var base = pollBaseMs(attempt);
    var r = typeof rnd === "function" ? rnd() : Math.random();
    var spread = base * POLL_JITTER;
    var out = Math.round(base - spread + r * spread * 2);
    return Math.max(POLL_MIN_MS, Math.min(POLL_MAX_MS, out));
  }

  /**
   * Every terminal status, named. `running` is everything else.
   *
   * EXHAUSTIVE AND EXPLICIT, because the alternative — treating "not done" as
   * "still going" — polls a cancelled job for ever and shows a spinner over a
   * site that was never touched.
   */
  var TERMINAL = ["done", "failed", "cancelled", "lost"];

  function classify(status, review) {
    var s = typeof status === "string" ? status : "";
    // `needs_review` IS A STATE OF THE JOB, NOT A STATUS. It rides beside
    // `failed`/`lost` on the wire, and it is the one terminal outcome where the
    // customer must be stopped from simply trying again — so it outranks the
    // status it arrives with.
    if (review === true) return { terminal: true, kind: "needs_review", ok: false };
    if (s === "done") return { terminal: true, kind: "done", ok: true };
    if (TERMINAL.indexOf(s) >= 0) return { terminal: true, kind: s, ok: false };
    return { terminal: false, kind: "running", ok: false };
  }

  /**
   * A POLL THAT FAILED IS NOT AN EDIT THAT FAILED.
   *
   * 429, any 5xx, a timeout and a dropped connection all mean "ask again" — the
   * job is running in a queue consumer that has never heard of this browser.
   * The one thing a poll failure must NEVER do is resubmit the POST: that is a
   * second job for one ask, which is the charge the idempotency key exists to
   * prevent and which a retry here would walk straight past.
   *
   * 404 STOPS, AND SAYS NOTHING. It is the same answer a job belonging to
   * somebody else gets, deliberately — so it cannot be used to find out whether
   * an id exists. The customer is told the edit could not be followed, which is
   * all this side actually knows.
   */
  function shouldRetryPoll(status) {
    if (status === 0 || status === null || status === undefined) return true; // network / abort
    var n = Number(status);
    if (!isFinite(n)) return true;
    if (n === 429) return true;
    if (n >= 500) return true;
    return false;
  }

  /**
   * WHAT THE CUSTOMER IS TOLD, and it is never what a provider said.
   *
   * The poll route hands back `{ kind, phase }` and nothing else — the column
   * has nowhere to put a message, a stack or a request body — but "nothing to
   * leak" is a property of today's server, and this is the side that renders.
   * So the sentence is chosen HERE from a fixed set, and the only server text
   * ever shown is `msg`, which the handler wrote for a customer to read.
   */
  function outcomeMessage(kind) {
    if (kind === "cancelled") return "I stopped that edit — your site is untouched and you haven't been charged.";
    if (kind === "lost") return "That edit stopped before it finished. Your site is untouched and anything it cost has been refunded.";
    if (kind === "needs_review") {
      return "That edit stopped while it was publishing and I can't tell yet whether it went live, so I've paused " +
        "edits on this site until that's settled. Your site is still serving whatever it was serving before.";
    }
    return "That edit didn't finish. Your site is untouched and anything it cost has been refunded.";
  }

  /**
   * The watch: which job, how far, and whether its result has been used.
   *
   * ── APPLIED EXACTLY ONCE ──────────────────────────────────────────────
   *
   * A final response can arrive more than once — a retry that raced the first
   * answer, a resumed watch after a refresh, two tabs on one job. Applying it
   * twice would bump the preview twice, print the reply twice and, on a `data`
   * edit, offer an undo for rows already put back. `take()` is a one-shot latch:
   * the first caller gets the result and every later one gets null.
   */
  function makeWatch(job, slug) {
    var used = false;
    return {
      job: String(job || ""),
      slug: String(slug || ""),
      attempt: 0,
      // WHY IT STOPPED WATCHING, which is NOT the same as why the job stopped.
      stopped: "",
      take: function (result) {
        if (used) return null;
        used = true;
        return result;
      },
      taken: function () { return used; },
    };
  }

  /**
   * ── STOP WATCHING IS NOT CANCEL ────────────────────────────────────────
   *
   * Closing a tab, navigating away or losing the network stops this browser
   * looking. It must never stop the WORK: the job is running in a queue
   * consumer, the customer has been charged for it, and the site is mid-edit.
   * Cancelling on a lost connection would throw away paid work because somebody
   * switched apps.
   *
   * So there are two verbs and they are separate calls: `stopWatching` is local
   * and silent, `requestCancel` is a DELETE the server has to confirm.
   */
  function isCancelConfirmed(reply) {
    return !!(reply && reply.ok === true && (reply.cancel === true || reply.status === "cancelled"));
  }

  /**
   * A CANCEL REFUSED BECAUSE PUBLISHING STARTED IS NOT A CANCEL, and it is not
   * an error either — the edit is going to land. The right move is to keep
   * polling and report what actually happened.
   */
  function isCancelTooLate(status, reply) {
    return Number(status) === 409 || !!(reply && reply.error === "too-late");
  }

  // ── RESUMING AFTER A REFRESH ─────────────────────────────────────────────
  //
  // A queued edit outlives the page that started it, so a refresh must be able
  // to pick the same job back up rather than send a second one. The store is
  // per-slug and holds only the job id — never the body, never the marker,
  // never anything the server told us in confidence.
  var STORE_KEY = "gf.edit.watch.v1";

  function readStore(store) {
    try {
      var raw = (store || localStorage).getItem(STORE_KEY);
      var v = raw ? JSON.parse(raw) : null;
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (e) { return {}; }
  }

  function rememberJob(slug, job, store) {
    if (!slug || !job) return;
    try {
      var all = readStore(store);
      all[String(slug)] = { job: String(job), at: Date.now() };
      (store || localStorage).setItem(STORE_KEY, JSON.stringify(all));
    } catch (e) { /* a private window is not a reason to fail an edit */ }
  }

  function forgetJob(slug, store) {
    try {
      var all = readStore(store);
      delete all[String(slug)];
      (store || localStorage).setItem(STORE_KEY, JSON.stringify(all));
    } catch (e) { /* as above */ }
  }

  /**
   * The job to resume for this site, if any and if it is still worth resuming.
   *
   * STALE ENTRIES ARE DROPPED rather than polled. A job is bounded by the
   * consumer's fifteen minutes, so an entry older than an hour names something
   * that finished long ago — and polling it would answer 404 and tell the
   * customer their edit could not be followed, about an edit that succeeded.
   */
  function resumableJob(slug, now, store) {
    var all = readStore(store);
    var v = all[String(slug)];
    if (!v || typeof v.job !== "string" || !v.job) return null;
    var age = (Number(now) || Date.now()) - (Number(v.at) || 0);
    if (age > 3600000 || age < 0) return null;
    return v.job;
  }

  var api = {
    newIdemKey: newIdemKey,
    pollDelayMs: pollDelayMs,
    pollBaseMs: pollBaseMs,
    POLL_MIN_MS: POLL_MIN_MS,
    POLL_MAX_MS: POLL_MAX_MS,
    TERMINAL: TERMINAL,
    classify: classify,
    shouldRetryPoll: shouldRetryPoll,
    outcomeMessage: outcomeMessage,
    makeWatch: makeWatch,
    isCancelConfirmed: isCancelConfirmed,
    isCancelTooLate: isCancelTooLate,
    rememberJob: rememberJob,
    forgetJob: forgetJob,
    resumableJob: resumableJob,
    STORE_KEY: STORE_KEY,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EditPoll = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
