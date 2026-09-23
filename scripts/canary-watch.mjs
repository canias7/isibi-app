// The two decisions the edit canary was making wrongly, lifted out so they can
// be DRIVEN rather than read.
//
// Both were found by reviewing run 14 (2026-09-21), and both had the same
// shape: a wall the harness already had one field over, not applied here.
//
//   1. THE INSTRUCTION. `edit-canary.mjs` refuses to spend when the router
//      does not name a layer — "a blank layer costs nothing and proves
//      nothing" is its own comment — and one line above that refusal it read
//      the environment variable through a fallback to a hardcoded CTA-colour
//      ask. So run 14 was dispatched with an EMPTY instruction, silently
//      substituted a request nobody made, and spent on it. The routing answer
//      was correct for what was really sent and evidence about nothing
//      anybody wanted.
//
//      ⚠ THE SPELLING OF THAT FALLBACK IS NOT WRITTEN ANYWHERE IN THIS
//      REPOSITORY ANY MORE, INCLUDING IN PROSE. `test/canary-watch.test.mjs`
//      censuses for it over blanked comments, and the first cut of this file
//      quoted it in the paragraph above — which failed the guard written for
//      it. Tenth-plus recorded instance of that shape here.
//
//   2. THE WATCH. It ended only on HTTP 200. A finished edit hands back its
//      STORED REPLY, which keeps its own status — 422 for a compile failure,
//      503 for a model outage — under `x-gf-edit: final`. `EditPoll.readPoll`
//      exists precisely to tell that from the poll route's own transient 503,
//      and its comment says so in as many words. The harness reimplemented the
//      question as `status === 200` and polled past every completed failure
//      until its own loop ran out, then reported "no terminal answer".
//
// THESE LIVE HERE AND NOT IN `edit-canary.mjs` BECAUSE THAT FILE IS A SCRIPT.
// It has top-level await and it spends money; importing it to reach a function
// would run the harness. `codeRefusals`/`expectedCode` in `addon-sweep.mjs`
// are the precedent — a wall nobody can drive is a wall nobody is guarding, in
// the branch whose wrong answer costs credits.
import { createRequire } from "node:module";

// THE BROWSER'S OWN READER, NOT A SECOND COPY OF IT. `public/edit-poll.js` is
// a UMD and assigns `module.exports` when one exists, which is how
// `test/edit-poll.test.mjs` already drives it. Re-deriving the rule here would
// be two answers to one question, and the weaker one would win by being nearer.
const require = createRequire(import.meta.url);
export const EditPoll = require("../public/edit-poll.js");

/**
 * WHAT MAY BE SENT AS A PAID INSTRUCTION.
 *
 * NO DEFAULT, AND THAT IS THE WHOLE POINT. A default here is not a
 * convenience: it turns an operator's empty form field into a paid request for
 * something they did not ask for, and the run then reports a real routing
 * answer about it. Nothing downstream can tell that apart from the run
 * somebody meant to press.
 *
 * FAIL CLOSED ON A NON-STRING rather than coercing. `String(["a"])` is `"a"` —
 * this repo has shipped that as a real bug three times — so anything that is
 * not a string is refused rather than stringified into a plausible ask.
 *
 * The two refusals are NAMED separately because they are different operator
 * mistakes: `missing` is a form field nobody filled, `blank` is one holding
 * only whitespace, which looks filled in every UI that shows it.
 */
export function readInstruction(raw) {
  if (typeof raw !== "string") return { ok: false, why: raw === undefined || raw === null ? "missing" : "not-a-string" };
  if (raw === "") return { ok: false, why: "missing" };
  const instruction = raw.trim();
  if (!instruction) return { ok: false, why: "blank" };
  return { ok: true, instruction };
}

/** The sentence the refusal prints. One composer, so the two arms cannot drift. */
export function instructionRefusal(why) {
  const what = why === "blank" ? "held only whitespace" : why === "not-a-string" ? "was not readable as text" : "was empty";
  return `REFUSING TO SPEND: CANARY_INSTRUCTION ${what}. ` +
    "This harness has no default instruction — a substituted ask spends real credits on a request nobody made.";
}

/**
 * WATCH A QUEUED EDIT THE WAY THE BROWSER DOES.
 *
 * `poll` is injected, so this is drivable with a literal sequence and a fake
 * clock. It must answer `{status, headers, json, text}` — the shape
 * `edit-canary.mjs`'s own `call` returns once it keeps its headers.
 *
 * FOUR OUTCOMES, AND THE FOURTH IS WHY THIS EXISTS:
 *
 *   `reply`   — a stored reply arrived, WHATEVER its status. This is the
 *               answer; 503 with the final header is a completed edit that
 *               failed, not a read that failed.
 *   `ended`   — the route described a terminal job with no stored reply to
 *               hand back (lost, cancelled, needs_review). `outcome` names it.
 *   `gone`    — 404. Also what a job belonging to somebody else gets.
 *   `timeout` — the watch ran out. THIS IS NOT A FACT ABOUT THE JOB. The job
 *               may have finished one second later; all that is established is
 *               that this harness stopped looking. Run 14 reported this as
 *               "the job did not finish", which is a claim the instrument
 *               cannot make.
 *
 * `retries` counts polls that failed transiently, so a run that spent its
 * whole watch retrying a 503 is distinguishable from one that waited on a
 * job that was genuinely still running. Without it the two log identically.
 */
export async function watchEdit(poll, opts = {}) {
  const tries = opts.tries == null ? 260 : opts.tries;
  const waitMs = opts.waitMs == null ? 3000 : opts.waitMs;
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const onTick = opts.onTick;
  const FINAL = EditPoll.FINAL_HEADER;

  let retries = 0;
  let last = null;
  for (let i = 0; i < tries; i++) {
    await sleep(waitMs);
    const q = await poll(i);
    last = q;
    // HEADER NAMES ARE CASE-INSENSITIVE ON THE WIRE. Node lowercases them on a
    // real response, but nothing guarantees that of a fixture or of the next
    // client this is pointed at — and a capital letter reading as "the server
    // did not send it" is the exact shape of every silent-absence bug here.
    // The KEYS are folded, not the needle: folding the needle alone looks like
    // a fix and answers undefined for `X-GF-Edit` just the same.
    const h = q && q.headers ? q.headers : {};
    let fin;
    for (const k of Object.keys(h)) if (String(k).toLowerCase() === FINAL) { fin = h[k]; break; }
    const act = EditPoll.readPoll(q && q.status, fin, q && q.json);
    if (act.act === "reply") return { kind: "reply", polls: i + 1, retries, q, final: true };
    if (act.act === "gone") return { kind: "gone", polls: i + 1, retries, q, final: false };
    if (act.act === "ended") return { kind: "ended", outcome: act.kind, polls: i + 1, retries, q, final: false };
    if (act.act === "retry") retries++;
    if (onTick) onTick(i, q, act);
  }
  return { kind: "timeout", polls: tries, retries, q: last, final: false };
}

/**
 * WHAT THE HARNESS MAY SAY ABOUT EACH OUTCOME, AND WHETHER THE CUSTOMER'S
 * COMPOSER MAY BE RUN AT ALL.
 *
 * `compose` is the field that matters. `editAnswer`'s first branch is
 * `if (!e) … return o.fallback()` — "a body we cannot read is not a refusal" —
 * so handing it a null body records the ~25-credit rewrite as the action the
 * page would take. Run 14 did exactly that and the bundle reported it as a
 * product finding. **A real browser polling a running job shows `running`; it
 * is never handed null.** So the composer runs on a stored reply and on
 * nothing else.
 */
export function watchReport(w) {
  if (!w) return { headline: "outcome unknown — the watch returned nothing", compose: false, pass: false };
  if (w.kind === "reply") {
    const st = w.q && w.q.status;
    return {
      headline: `a stored reply arrived (HTTP ${st}, ${EditPoll.FINAL_HEADER}: ${EditPoll.FINAL_VALUE})`,
      compose: true,
      // A COMPLETED FAILURE IS AN ANSWER AND NOT A PASS. The status is the
      // stored reply's own, so a 422 or a 503 here is the edit's outcome.
      pass: st >= 200 && st < 300,
    };
  }
  if (w.kind === "ended") {
    return {
      headline: `the job reached a terminal state with no stored reply: ${w.outcome}`,
      // NO STORED REPLY MEANS NOTHING TO COMPOSE FROM. The browser prints
      // `outcomeMessage(kind)` here, which is a fixed sentence and not the
      // handler's, so the harness prints the same one rather than inventing.
      compose: false,
      message: EditPoll.outcomeMessage(w.outcome),
      pass: false,
    };
  }
  if (w.kind === "gone") {
    return { headline: "the poll answered 404 — the job is gone, or is not this account's", compose: false, pass: false };
  }
  return {
    headline: `outcome unknown — the watch ran out after ${w.polls} polls (${w.retries} of them transient failures)`,
    // THE HONEST WORD IS "UNKNOWN". The job is running in a queue consumer
    // that has never heard of this harness; a watch that stopped looking
    // establishes nothing about whether it finished.
    compose: false,
    pass: false,
  };
}

/**
 * WHICH PAGES THE ROUTER IS TOLD THE SITE HAS — the browser's list, read the
 * browser's way.
 *
 * The router picks the page an edit is for, and the one check on that pick
 * (`readEdit` in `builder/site-ask.mjs`) compares it against the page list the
 * CALLER sent — an empty list skips it. `edit-canary.mjs` sent `pages: []` from
 * the day it was written, so every routing call it made was blind. Run 23
 * (2026-09-23) is what that costs: the places-left sentence routed to
 * `page=/book`, a route fretwork-1 does not have, the page rung escalated
 * `no-page`, and the run spent 2 credits on routing and edited nothing. Runs 17
 * and 21 routed the same sentence to `/` through the same empty list — luck,
 * not a reading.
 *
 * THE BROWSER DOES NOT ROUTE BLIND. `siteRoutesFetch` in `public/chat.js` fills
 * `site.pages` from `GET /api/site/routes?slug=`, and `siteRoute` sends those
 * paths, capped at 24. This is that read with the browser's own filter: a 2xx,
 * `ok: true`, a `routes` array, and only strings that start with `/`.
 *
 * CANNOT-TELL REFUSES; IT NEVER BECOMES AN EMPTY LIST. An empty list here is
 * not "the site has no pages", it is the blind router this exists to stop — and
 * a browser never sends one for a published site, because a failed read leaves
 * its list as it was. A harness has no earlier list to keep, so it stops before
 * the routing call, which is the first thing that spends.
 */
export const MAX_ROUTER_PAGES = 24;
export function readRoutes(status, body) {
  if (!(status >= 200 && status < 300)) return { ok: false, why: `status ${status}` };
  if (!body || typeof body !== "object" || body.ok !== true) return { ok: false, why: "the answer is not ok" };
  if (!Array.isArray(body.routes)) return { ok: false, why: "no routes list" };
  // STRINGS ONLY, never coerced: `String(["/menu"])` is "/menu", the recorded
  // coercion that has shipped three times here. The browser drops them too.
  const pages = body.routes.filter((p) => typeof p === "string" && p.charAt(0) === "/").slice(0, MAX_ROUTER_PAGES);
  if (!pages.length) return { ok: false, why: "no usable routes" };
  return { ok: true, pages };
}

/** The sentence the refusal prints. Nothing has been spent when it does. */
export function routesRefusal(slug, why) {
  return `REFUSING TO SPEND: could not read which pages ${slug} has (${why}). ` +
    "Routing without the site's page list lets the router name a page the site does not have.";
}
