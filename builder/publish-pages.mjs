// Deciding what actually gets published.
//
// This is the part of a build that spends money and chooses what a visitor ends
// up seeing: whether the caller can be billed at all, what the call actually
// cost, and whether to publish or fall back. It lived inside worker.js, which
// cannot be imported, so none of it was ever tested — and it is exactly where a
// silent bug is expensive rather than merely wrong.
//
// It used to decide one more thing — whether to pay for a repair pass, and
// whether that repair was an improvement worth keeping. That is gone; see the
// note at the call site for the measurement it went on.
//
// Everything it touches is injected, the way site-data.mjs takes its database
// functions, so the real decision logic can be driven against fakes with no
// model call, no container and no R2.

import { validatePages, lintPages } from "./page-gen.mjs";

// Sonnet 5 rates over the platform's $0.008/credit basis.
//
// THE ONE TABLE. Until 2026-08-04 there were two: this one, which priced ALL
// input at the fresh rate, and the eval's, which priced cache reads and writes
// properly — so what a customer was billed and what we told ourselves a build
// cost were computed from different numbers.
//
// A cache read is a TENTH of fresh input and the cached prefix is 27,170 tokens,
// far the largest input component, so flattening the three kinds overcharged a
// warm build by ~9 credits — 35%. Measured: 35 charged against a true 26.
//
// It got worse the same day rather than being long-standing. `usedIn` used to be
// `input_tokens` alone, so cached tokens were not counted AT ALL (21 credits);
// counting them was right and pricing them at 10x was not, and the bill moved
// 21 -> 35 without anyone deciding it should.
export const RATES = {
  in: 3e-6,          // fresh input
  out: 15e-6,        // output, and adaptive thinking is billed in here too
  cacheRead: 0.30e-6,   // 0.1x — the whole reason the system block is cached
  cacheWrite: 3.75e-6,  // 1.25x, paid once per cache window
};
const CREDIT_USD = 0.008;

// A web search is billed PER SEARCH and not in tokens, so it is invisible to
// every other number here — a research call that ran four searches reports a few
// hundred tokens and costs $0.04 on top, five credits of it. Counting only the
// tokens would have understated a searching build by more than the tokens cost.
// $10 per 1,000 searches.
export const SEARCH_USD = 0.01;

/** Dollars at list price. Exported so nothing has to keep a second copy. */
export const pageCost = ({ in: fresh = 0, out = 0, cacheRead = 0, cacheWrite = 0, searches = 0 } = {}) =>
  fresh * RATES.in + out * RATES.out + cacheRead * RATES.cacheRead + cacheWrite * RATES.cacheWrite +
  searches * SEARCH_USD;

/**
 * Add up usage from more than one call.
 *
 * Research and generation are two separate model calls whose costs land on one
 * bill, and summing them has to happen on the OBJECT — adding the credit totals
 * instead would round each up to a whole credit and charge twice for the
 * rounding. Same reason `pageCredits` takes the object rather than two numbers.
 */
export const sumUsage = (...parts) => {
  const total = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, searches: 0 };
  for (const p of parts) {
    if (!p) continue;
    for (const k of Object.keys(total)) total[k] += Number(p[k]) || 0;
  }
  return total;
};

// Whole credits, minimum one — a generation that produced anything at all was
// not free. Takes the usage OBJECT, not two summed numbers: summing is what
// threw away the distinction between the three input kinds in the first place.
export const pageCredits = (usage) => Math.max(1, Math.ceil(pageCost(usage) / CREDIT_USD));

// Don't start a call the caller plainly cannot pay for. Deliberately a floor and
// not the worst case (~45 credits at the token ceiling): a new account is granted
// 20, and gating on the maximum would mean nobody ever got a page on their first
// build. A typical small site spends 10-20.
export const MIN_CREDITS = 8;

/**
 * The source lines a compiler error points at, so a failure explains itself.
 *
 * Bounded on every axis — how many citations, how long a line, how much total —
 * because this rides in a response and the input is model-written. Unknown files
 * and out-of-range lines are skipped rather than guessed at.
 */
export function citedLines(error, pages, max = 4) {
  const byPath = new Map((pages || []).map((p) => [p.path, String(p.source || "").split("\n")]));
  const out = [];
  const seen = new Set();
  for (const m of String(error || "").matchAll(/(?:src\/routes\/)?([\w.$/-]+\.tsx)\((\d+),(\d+)\)/g)) {
    const key = m[1] + ":" + m[2];
    if (seen.has(key)) continue;
    seen.add(key);
    const lines = byPath.get(m[1]);
    const line = lines && lines[Number(m[2]) - 1];
    if (typeof line !== "string") continue;
    out.push(`${m[1]}:${m[2]}: ${line.trim().slice(0, 200)}`);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * brief + schema → route files → compile → published dist.
 *
 * Best-effort by design: it runs AFTER the database has been provisioned and the
 * schema applied, so a generator or compiler failure still leaves the caller a
 * working backend and a placeholder — a build that half-worked, not one that was
 * lost. The return says which landed, so a fallback is never mistaken for a site.
 *
 * ONE model call, always. `generate` is called exactly once and its cost is the
 * build's cost; there is no second attempt to sum or to choose between.
 *
 * deps:
 *   generate()      → { input, truncated?, usage }            the model call
 *                     usage: { in, out, cacheRead, cacheWrite } — the four kinds
 *                     kept APART, because they are priced 1x / 5x / 0.1x / 1.25x
 *   compile(pages)  → { ok, files?, error?, stage? }           the build container
 *   publish(dist)   → void                                     write to storage
 *   readCredits()   → number
 *   useCredits(n)   → void
 *
 * `priorUsage` is what an EARLIER model call in this same build already spent —
 * today that is the web-research step, which runs before page generation. It is
 * carried here rather than billed where it happens so that it obeys the same
 * one-sentence rule as everything else on this path: **if the customer got the
 * placeholder, they were not charged.** Billing it at its own call site would
 * mean a build that searched the web and then failed to publish took credits for
 * nothing, which is precisely the outcome this function was rewritten to stop.
 */
export async function publishPages(deps, { spec, slug, priorUsage } = {}) {
  const out = { page: "placeholder", files: [], notes: "", problems: [], cost: 0, buildMs: 0 };

  // Fails CLOSED: if the ledger cannot be read we do not generate. A caller who
  // cannot be billed does not get a paid call, at the cost of falling back to the
  // placeholder when the ledger merely hiccups.
  let balance = 0;
  try { balance = await deps.readCredits(); } catch { balance = 0; }
  if (!(balance >= MIN_CREDITS)) {
    out.notes = "Your database is live, but there weren't enough credits left to write the pages.";
    return out;
  }

  // CHARGED FOR A PUBLISHED APP, NOT FOR A PLACEHOLDER — owner's call
  // 2026-08-05, and the reversal of what this comment used to say ("BEFORE the
  // output is judged: the tokens were spent whether or not the result turns out
  // to be usable").
  //
  // That was true about our costs and wrong about the customer's. Measured live:
  // a build spent 68 seconds, produced `pages: []`, published the placeholder,
  // and took 23 credits — off an account granted 20. It cost exactly what a
  // working site cost and delivered nothing, which is the most expensive
  // possible outcome for the person paying.
  //
  // The rule is now one sentence anybody can check: **if the customer got the
  // placeholder, the pages call is free.** It applies to all three ways of
  // getting there — no pages, no home page, and a compile failure — because from
  // the customer's side those are one event: they asked for a site and did not
  // get one. `out.usage` is still reported on every path, so what WE spent with
  // the model is still visible even when nothing is billed.
  //
  // The schema call is billed separately and still is: the database really is
  // live and usable, and a revise reuses it.
  const charge = async (g) => {
    const c = pageCredits(sumUsage(g.usage, priorUsage));
    out.cost += c;
    try { await deps.useCredits(c); } catch { /* never fail a build over the ledger */ }
  };
  // The sentence the customer reads. Appended to every placeholder note rather
  // than left implicit — somebody who sees a fallback page AND a balance drop
  // has been charged for nothing twice over, once in credits and once in trust.
  const FREE = "You weren't charged for the pages on this attempt.";

  // `buildMs` is what the caller waited for. It was summed across attempts when
  // there were two; with one call it is simply that call, and the accumulator is
  // kept so the field never silently changes meaning if a second one returns.
  const compile = async (pages) => {
    const t0 = Date.now();
    let bd;
    try { bd = await deps.compile(pages); }
    catch (e) { bd = { ok: false, stage: "build", error: "the build service is unreachable: " + String((e && e.message) || e).slice(0, 200) }; }
    out.buildMs += Date.now() - t0;
    // THE CONTAINER'S OWN SPLIT, carried through rather than discarded. `buildMs`
    // is what the Worker waited for and includes reaching the container at all;
    // these say where the time went inside it. Kept on the FAILURE path too — a
    // build that died in typecheck still spent that time, and a slow typecheck is
    // the symptom that says the kit has grown, not the site.
    if (bd) for (const k of ["routesMs", "tscMs", "viteMs"]) {
      if (typeof bd[k] === "number") out[k] = (out[k] || 0) + bd[k];
    }
    // WHICH TEMPLATE BUILT THIS. Cloudflare rolls a container image out
    // asynchronously, so a build minutes after a deploy can still be served by
    // the previous image — and its published bundle is that older code. Carried
    // out so a caller can compare it against its own checkout instead of
    // diagnosing a bug that was already fixed.
    if (bd && typeof bd.templateId === "string") out.templateId = bd.templateId;
    return bd || { ok: false, stage: "build", error: "the build service returned nothing" };
  };

  /**
   * Compile, and try once more if the CONTAINER died rather than the code.
   *
   * NOT THE REPAIR PASS THAT WAS REMOVED, and the distinction is the whole
   * justification: that one re-ran the MODEL, which is ~80% of what a build
   * costs, to guess again at pages that had half-worked. This re-runs nothing but
   * the container, on pages that already exist and have already passed
   * typecheck. No model call, no tokens, ~15-40s.
   *
   * Measured live 2026-08-05: `vite build was killed by SIGTERM (no output)`,
   * 2.5 seconds into a bundle that normally takes 20. `build smoke` had started
   * two seconds after a deploy finished, and Cloudflare rolls the container image
   * out ASYNCHRONOUSLY — so the instance was being drained underneath a build
   * that was already running. The same asynchrony that produces the "container
   * template is behind" failure, wearing a different face.
   *
   * `stage: "typecheck"` is NEVER retried, and that exclusion is what stops this
   * being a slow no-op on the common failure: a page that does not compile does
   * not compile the second time either, and the customer would wait another 40
   * seconds for the same placeholder. Anything at `stage: "build"` gets one more
   * go — a genuine bundler error (an import tsc allowed and vite cannot resolve)
   * is deterministic too, so the cost of being generous here is one wasted
   * container run on a rare path, against catching every future spelling of "the
   * process was killed" without a list of signals to keep up to date.
   *
   * No delay between the two. Starting a fresh container instance has its own
   * cold start, which is the spacing — and a sleep would be a guess at how long
   * a rollout takes, tuned against nothing.
   */
  const compileWithRetry = async (pages) => {
    let bd = await compile(pages);
    out.builds = 1;
    if (!bd.ok && bd.stage === "build") {
      out.retriedBuild = String(bd.error || "").slice(0, 200);
      bd = await compile(pages);
      out.builds = 2;
    }
    return bd;
  };

  // THE MODEL CALL, TIMED. It is the slowest single thing in a build and it was
  // folded into one `pages` number alongside the container compile and ~20 R2
  // puts, so "the build took four minutes" could not be attributed to any of
  // them. `buildMs` already splits out the compile; these split out the rest.
  const tGen = Date.now();
  const gen = await deps.generate();
  out.genMs = Date.now() - tGen;
  // THE FOUR TOKEN KINDS, kept rather than collapsed into a credit total.
  // `charge` prices them and threw the breakdown away — so the SCHEMA call
  // reported its cache-read and cache-write counts while the pages call, the one
  // that actually costs money, reported a single number. Whether PAGE_RULES's
  // ~27k-token cached prefix is paying for itself is answerable only from these.
  out.usage = gen.usage || null;
  // KEPT APART from `out.usage`, deliberately. Two model calls with different
  // models and different rates land on one bill, and folding them into one
  // number would make the question the four-kind split exists to answer — is the
  // cached prefix paying for itself — unanswerable again the moment a build
  // searches.
  if (priorUsage) out.priorUsage = priorUsage;
  const v = validatePages(gen.input);
  if (!v.pages.length) {
    // THE ONE BRANCH THAT THREW ITS REASONS AWAY. `validatePages` works out
    // exactly why each page was refused — a bad path, a duplicate, an empty
    // source — and this returned a one-line note and no `stage`, so a build that
    // spent 23 credits on 10,297 output tokens reported `stage:-, problems:[]`
    // and could not say which of four things had happened. Measured live
    // 2026-08-04; the branch immediately below already kept them, so this was
    // the odd one out rather than a policy.
    //
    // Same lesson as `upstream: null` and the `cited` lines: the response is the
    // only place a failure can be diagnosed from, because the pages are gone the
    // moment this returns.
    out.stage = "validate";
    out.problems = v.problems;
    out.error = v.problems.length
      ? "every page was refused: " + v.problems.slice(0, 3).join(" · ").slice(0, 300)
      : gen.shape
        ? "the model never called the tool — stop_reason " + gen.shape.stopReason +
          ", blocks [" + gen.shape.blocks.join(", ") + "]"
        : "the generator called the tool with no pages in it";
    out.notes = (gen.truncated
      ? "The pages came out longer than one pass allows — try a simpler brief."
      : "The generator didn't produce a usable page.") + " " + FREE;
    return out;
  }
  // A SITE WITH NO HOME PAGE IS NOT A SITE. `validatePages` only FLAGS a missing
  // index.tsx — it has no basis for picking which of five pages should be home —
  // so without this the root URL, the one address a customer actually shares,
  // renders nothing while the build reports success.
  //
  // Not introduced by dropping the repair: the old code retried on this and, if
  // the retry was no better, published the first attempt exactly as it was. The
  // repair only made it rarer. Refusing is the honest answer either way, and the
  // placeholder at least explains itself.
  if (!v.pages.some((p) => p.path === "index.tsx")) {
    out.problems = v.problems;
    out.notes = "The pages came back without a home page, so the site is showing its data model for now — send it again to retry. " + FREE;
    return out;
  }

  const problems = v.problems.concat(lintPages(v.pages, spec));
  const built = await compileWithRetry(v.pages);

  // THERE IS NO REPAIR PASS. Removed 2026-08-04, owner's call, on the first real
  // measurement of what a build costs: output is 80% of it, and a repair is a
  // second whole generation — it does not amend a file, it re-writes every page.
  // So a failing build cost ~2x a working one at a moment when a working one is
  // already about break-even against the 22 credits charged for it.
  //
  // The measurement that made it defensible: the eval scored 0/3 and all eleven
  // errors were ONE component call, which is not what a repair is for. A
  // systematic mismatch is paid for once, in the kit or in the rules, and a
  // repair pass paying for it again on every build is the expensive way to not
  // fix it. FIRST-TRY IS NOW THE ONLY RATE THAT MATTERS — if it falls, the fix
  // is whatever the eval's error column names, not a second call.
  //
  // What this costs, stated plainly so it is a decision and not a regression: a
  // generator miss is now a placeholder immediately. The backend is still live
  // and a revise re-runs the whole thing, so the recovery is the customer
  // sending it again rather than us paying to guess twice.
  out.files = v.pages.map((p) => "src/routes/" + p.path);
  out.problems = problems;
  out.notes = v.notes;
  if (!built.ok) {
    out.stage = built.stage;
    out.error = String(built.error || "").slice(0, 400);
    // THE LINE tsc IS POINTING AT. A compile error names `file(line,col)` and
    // nothing else, so diagnosing one means guessing what the model wrote — and
    // the pages are gone the moment this returns, because only the eval saves
    // them. A whole round was spent inferring `TS2344: Type 'PublicBooking' does
    // not satisfy the constraint 'Row'` from its file and column alone.
    //
    // The source is the caller's OWN site, so there is nothing to leak, and it
    // is capped hard: the first few citations, one line each.
    out.cited = citedLines(built.error, v.pages);
    out.notes = [v.notes, "The pages didn't compile, so the site is showing its data model for now — send it again to retry.", FREE].filter(Boolean).join(" ");
    return out;
  }

  // ~20 R2 puts. Small, but it is the last thing between a compiled bundle and a
  // live site, and an unexplained gap at the end of a build had nowhere to be.
  const tPub = Date.now();
  await deps.publish(built.files);
  out.publishMs = Date.now() - tPub;
  out.page = "app";
  // BILLED LAST, once the site is actually live. Every earlier return is a
  // placeholder and costs the customer nothing; this is the one path where they
  // received what they asked for. After `publish` rather than before, because a
  // publish that throws leaves them with no site.
  await charge(gen);
  return out;
}
