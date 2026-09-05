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
   * ONE KEY PER SUBMISSION, REUSED FOR EVERY RETRY OF THAT SUBMISSION.
   *
   * This is the whole of request-level idempotency on the client side. A key
   * minted per network ATTEMPT would make a retry after a lost response a
   * SECOND job — two sets of model calls, two charges, two publishes racing for
   * one site — which is precisely what the key exists to prevent. So it is
   * minted where a POST is decided and carried through every retry of it.
   *
   * SUBMISSION, NOT ASK, and the distinction is the sideways hop. It used to be
   * "one key per ask", which was true while an escalate created nothing on the
   * server: the hop reached a different lane inside one message and one key
   * described it honestly. The queue ended that. `edit_create` keys on
   * `(uid, slug, op, idem_key)` and THE LAYER IS NOT IN IT, so a hop carrying
   * the first key does not file the cheaper job — it matches the row that just
   * escalated, comes back `duplicate: true`, and the hop silently becomes a
   * no-op. One ask can be two submissions; `handedOff` bounds it at two.
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
    // A `done` JOB IS PUBLISHED — `edit_finalize` refuses to finalize one whose
    // `published_at` is null — so this must never fall through to the sentence
    // below, which says the site is untouched. It is reached only when a
    // finished job has no stored reply to hand back, which `edit_finalize`
    // should make impossible; kept because the direction of the error matters
    // more than its likelihood. Telling somebody their live change did not
    // happen is the one wrong answer here.
    if (kind === "done") return "That edit finished and your site has been updated — I just couldn't read back what changed. Reload to see it.";
    // A RECOVERED REPLY IS THE SWEEP'S, NOT THE HANDLER'S (stage 2a,
    // 2026-09-05). The job shipped — `edit_committed` recorded it — and its
    // consumer died before it could store what the change did, so the sweep
    // finalized it with a reply that says only that. The change IS live and
    // WAS charged for; the one wrong sentence here is any that says the site
    // is untouched or the money came back.
    if (kind === "recovered") return "✅ Your change was published — but the details of what it did were lost along the way. Reload the preview to see it.";
    if (kind === "cancelled") return "I stopped that edit — your site is untouched and you haven't been charged.";
    if (kind === "lost") return "That edit stopped before it finished. Your site is untouched and anything it cost has been refunded.";
    if (kind === "needs_review") {
      return "That edit stopped while it was publishing and I can't tell yet whether it went live, so I've paused " +
        "edits on this site until that's settled. Your site is still serving whatever it was serving before.";
    }
    return "That edit didn't finish. Your site is untouched and anything it cost has been refunded.";
  }

  /**
   * A STORED REPLY THE SWEEP WROTE, not the handler.
   *
   * `edit_sweep_lost` finalizes a job that committed and died before storing
   * its reply, with `{ ok: true, recovered: true, job, cost, build }` in the
   * consumer's own stored shape — so it reaches the browser through the
   * ordinary final-reply branch, whichever route filed the job. Both readers
   * ask this before they say what the change did, because neither can: the
   * layer, the pages and the words are exactly what was lost.
   *
   * `ok` IS REQUIRED beside the flag. A reply that says recovered and not ok
   * is not a shape anything writes, and reading it as a success would render
   * a green tick over a failure.
   */
  function isRecovered(body) {
    return !!(body && typeof body === "object" && body.ok === true && body.recovered === true);
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

  // THE SAME TWO STRINGS `builder/edit-job.mjs` EXPORTS, and they cannot be
  // imported from there: this file is a browser global. Two copies of one name,
  // which is a drift this repo has a rule about — so `test/edit-poll.test.mjs`
  // reads both and asserts they agree, rather than trusting either.
  //
  // DECLARED ABOVE THEIR USE, not beside the export list at the bottom: `var`
  // hoists the declaration and not the value, so a constant defined below
  // `readPoll` is undefined to anything that calls it during load.
  var FINAL_HEADER = "x-gf-edit";
  var FINAL_VALUE = "final";

  /**
   * THE POLL ROUTE'S TWO VOICES, AND HOW TO TELL THEM APART.
   *
   * A finished job hands back its STORED REPLY — byte for byte the object the
   * synchronous path returns — and that object has no job-state field, because
   * it never needed one. So `classify(body.status)` answered `running` on every
   * completed edit, and `!verdict.terminal` has no attempt bound: the browser
   * polled a finished, charged, PUBLISHED edit for ever, behind a spinner, on
   * every queued success and every queued escalate alike. Only the outcomes that
   * store no reply — lost, cancelled — ever terminated.
   *
   * The server now says which voice is speaking (`FINAL_HEADER`), because
   * neither the body nor the status can carry it:
   *
   *   * THE BODY cannot, since it is the synchronous reply unchanged — and
   *     changing it would break the one property that makes this rollback-safe,
   *     that both paths carry the same object.
   *   * THE STATUS cannot, since a stored reply keeps its own — 200 for a
   *     success, 422 for a compile failure, 503 for a model outage — while the
   *     poll route has its own 503 for a row it could not read. By number alone
   *     a stored 503 is a transient one, and gets retried until the client gives
   *     up on an edit that finished minutes ago.
   *
   * THE ORDER OF THESE FOUR IS LOAD-BEARING, so each one says why it sits where
   * it does.
   */
  function readPoll(status, finalHeader, body) {
    // 1. GONE FIRST. A 404 carries no header and is not worth retrying — it is
    //    also what a job belonging to somebody else gets, deliberately.
    if (status === 404) return { act: "gone" };
    // 2. THE ANSWER BEFORE THE RETRY, which is the whole point: a stored 422 or
    //    503 IS the outcome, and reading it as a transient failure polls past
    //    the thing being waited for.
    if (finalHeader === FINAL_VALUE) return { act: "reply" };
    // 3. A POLL THAT FAILED IS NOT AN EDIT THAT FAILED.
    if (shouldRetryPoll(status)) return { act: "retry" };
    // 4. AND OTHERWISE THE ROUTE IS DESCRIBING THE JOB — the branch taken when
    //    there is no stored reply to hand back at all.
    var v = classify(body && body.status, body && body.review);
    if (!v.terminal) return { act: "wait" };
    return { act: "ended", kind: v.kind };
  }

  /**
   * WHAT TO DO WITH AN ESCALATE: "hop", "up" or "lost".
   *
   * An escalate is the server saying this rung could not make the change, so
   * the change still has to happen one rung up. It arrives on BOTH paths — the
   * queued reply body IS the synchronous one — and until 2026-09-01 only the
   * synchronous path read it: `watchEditJob` applied every terminal answer as
   * an outcome, and `editReply` ends '✅ Done.', so a queued escalate told the
   * customer their change was made and never ran the revise that would have
   * made it.
   *
   * THE DECISION IS HERE AND THE ACTION IS IN `chat.js`, for the reason this
   * whole file exists: chat.js cannot be driven by a test, and "did we do the
   * cheap thing or the expensive thing" is a question about money.
   *
   *   "hop"  — the server named a DIFFERENT layer that can do it. One rung
   *            sideways, at that rung's price rather than a rewrite's.
   *   "up"   — no cheaper answer, or we already hopped once. The full revise.
   *   "lost" — we no longer hold the ask (a watch resumed after a refresh), so
   *            there is nothing to re-post. Telling them beats silently
   *            starting a ~25-credit rewrite for a sentence nobody re-typed.
   *
   * ONE HOP, BOUNDED HERE RATHER THAN TRUSTED FROM THE SERVER: `handedOff`
   * allows exactly one and only to a different layer, so no sequence of server
   * answers can loop two lanes against each other.
   *
   * `String(x)` IS NOT USED ON EITHER LAYER. `String(["page"])` is "page", and
   * this repo has shipped that coercion as a real bug four times — a
   * one-element array passing as a role, an access level, a language. A layer
   * that is not a string is not a layer.
   */
  function escalateAction(e, o) {
    var opt = o || {};
    if (!opt.hasAsk) return "lost";
    var named = e && typeof e.layer === "string" ? e.layer : "";
    // THE ADDON RUNG, BY NAME. An edit that names `addon` is saying "this
    // adds something the site does not have" (owner, 2026-09-02: "add will
    // always go in addon") — a page, a code, a scene. Before this, every
    // escalate that was not a sideways hop fell to `up`, the full revise:
    // ~25 credits and every page rewritten, for a request the middle rung
    // answers for a few. Decided before the hop bound, because the addon
    // route never escalates back to an edit, so it cannot loop.
    if (named === "addon") return "addon";
    if (opt.handedOff) return "up";
    var ours = typeof opt.layer === "string" ? opt.layer : "";
    if (named && named !== ours) return "hop";
    return "up";
  }

  var api = {
    FINAL_HEADER: FINAL_HEADER,
    FINAL_VALUE: FINAL_VALUE,
    readPoll: readPoll,
    escalateAction: escalateAction,
    newIdemKey: newIdemKey,
    pollDelayMs: pollDelayMs,
    pollBaseMs: pollBaseMs,
    POLL_MIN_MS: POLL_MIN_MS,
    POLL_MAX_MS: POLL_MAX_MS,
    TERMINAL: TERMINAL,
    classify: classify,
    shouldRetryPoll: shouldRetryPoll,
    outcomeMessage: outcomeMessage,
    isRecovered: isRecovered,
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
