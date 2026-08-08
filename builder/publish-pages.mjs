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
 * Whose fault was this failure — ours, or the output's?
 *
 * THE RULE, owner's call 2026-08-08: every model call is billed on what it
 * really consumed, EXCEPT when the thing that broke was ours. A model that wrote
 * a page which does not compile did real work and produced a real answer; a
 * container that was drained mid-bundle did not, and charging for our own
 * downtime is the one bill nobody can be argued into accepting.
 *
 * This replaces the publish-only rule (2026-08-05), which was the same instinct
 * applied one notch too widely: it made EVERY placeholder free, including the
 * ones where the generator worked exactly as designed and simply wrote a page
 * with a type error in it. That is a result, not an outage.
 *
 * The stages, and which side each is on:
 *   published — the site went live. Charged, obviously, and it is in this set
 *               rather than short-circuiting past it so that there is exactly
 *               ONE place in this file that spends money. Two charge sites is
 *               how a build double-bills.
 *   validate  — the model returned no usable page. ITS OUTPUT. Charged.
 *   home      — the pages came back with no index.tsx. ITS OUTPUT. Charged.
 *   typecheck — the page does not compile. ITS OUTPUT, and the most common
 *               real failure there is. Charged.
 *   build     — the bundler stage. OURS.  <-- see below, this one is a judgement
 *   publish   — writing to storage threw. OURS.
 *   generate  — the model API never answered. OURS (and there is no usage to
 *               bill anyway, so this is belt and braces).
 *
 * `build` IS THE JUDGEMENT CALL AND IT IS DELIBERATELY GENEROUS. That stage
 * covers two different things wearing one name: a container killed underneath a
 * running build (ours — measured live, `vite build was killed by SIGTERM` 2.5s
 * into a 20s bundle, two seconds after a deploy), and a genuine vite error the
 * typecheck let through (the output's). Nothing in the error text reliably
 * separates them, so this fails toward NOT charging. The cost of being wrong
 * that way is a real bundler error going free, occasionally; the cost of being
 * wrong the other way is billing somebody for our own rollout, which is the
 * exact trust problem this rule exists to prevent.
 *
 * A stage nobody recognises reads as OURS, for the same reason: a failure mode
 * that has not been thought about is not one to hand the customer a bill for.
 */
export const CHARGED_STAGES = new Set(["published", "validate", "home", "typecheck"]);
export const ourFault = (stage) => !CHARGED_STAGES.has(String(stage || ""));

/**
 * What is still owed after a deposit, once the real usage is known.
 *
 * The schema call cannot bill the way the pages call does. It has to take
 * money BEFORE it runs — `use_credits` is atomic and row-locking, and it is the
 * only thing stopping an account with nothing in it from starting a paid model
 * call — but a flat fee is not "charge for what you use". So it deposits the
 * fee, then settles: positive means charge that much more, negative means give
 * that much back, zero means the deposit was right.
 *
 * A MISSING USAGE REPORT KEEPS THE DEPOSIT, and that is the important line. The
 * model answered — a schema came back and a database is about to be built on it
 * — so the call was not free to us and must not be free to them. Refunding on an
 * unreadable meter would make "the provider changed its usage field" into "every
 * build is free", which is the kind of silent revenue hole nobody notices for a
 * month. Zero is also the only answer that cannot over-charge.
 */
export function schemaSettlement(usage, deposit) {
  if (!usage) return 0;
  return pageCredits(usage) - (Number(deposit) || 0);
}

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
    // Named and flagged like every other outcome. Nothing was called, so there
    // is nothing to bill — but `charged: false` has to be SET rather than left
    // undefined, or a caller reading the field cannot tell "we did not charge"
    // from "this build predates the field".
    out.stage = "credits";
    out.charged = false;
    out.notes = "Your database is live, but there weren't enough credits left to write the pages.";
    return out;
  }

  // BILLED ON WHAT THE CALL CONSUMED, UNLESS THE FAILURE WAS OURS — owner's call
  // 2026-08-08. This is the third position this line has held and the reasoning
  // for each is worth keeping, because the two earlier ones were each right
  // about something the next one kept.
  //
  // (1) "Charge before the output is judged: the tokens were spent whether or
  //     not the result turns out to be usable." True about OUR cost, and it
  //     produced the measurement that killed it — a build spent 68 seconds,
  //     returned `pages: []`, and took 23 credits off an account granted 20.
  // (2) "If the customer got the placeholder, the pages call is free." Fixed
  //     that, and over-corrected: it made a model that wrote a page with a type
  //     error in it indistinguishable from our container dying. The first is a
  //     result — real work, really delivered, just not usable — and the second
  //     is an outage.
  // (3) Now: every model call bills on its measured usage, priced from the one
  //     RATES table, and `ourFault` decides which failures are exempt. The line
  //     is no longer "did they get a site" but "did WE break".
  //
  // `out.usage` is reported on every path either way, so what we spent with the
  // model stays visible whether or not it was billed — and `out.charged` says
  // which happened rather than leaving it to be inferred from `cost`.
  // The sentence the customer reads, and there are two of them now. Somebody who
  // sees a fallback page AND a balance drop has been charged for nothing twice
  // over, once in credits and once in trust — so a free attempt says so, and a
  // charged one says what it was charged for rather than leaving them to notice.
  const FREE = "You weren't charged for this attempt.";
  const PAID = "This attempt used credits — the pages were written, they just didn't work.";

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

  /**
   * Settle the bill for this attempt and hand back the sentence to say about it.
   *
   * THE ONLY PLACE THIS FUNCTION SPENDS MONEY, success included. An earlier
   * draft let the published path charge directly and left this for the failures,
   * which is two charge sites — and two is how a build eventually bills twice,
   * and how the source-read that asserts "the charge comes after the publish"
   * starts matching the wrong one of them.
   *
   * It takes the stage rather than a boolean, so adding a new way to fail means
   * naming it in `CHARGED_STAGES` — not remembering to pass `true` here. A
   * failure mode nobody classified reads as ours and is free, which is the
   * direction that costs money rather than trust.
   *
   * `gen` is closed over instead of passed: every call site has it in hand, and a
   * parameter is one more thing to get wrong on the path that bills people.
   */
  const settle = async (stage) => {
    if (ourFault(stage)) { out.charged = false; return FREE; }
    const c = pageCredits(sumUsage(gen.usage, priorUsage));
    out.cost += c;
    try { await deps.useCredits(c); } catch { /* never fail a build over the ledger */ }
    out.charged = true;
    return PAID;
  };

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
      : "The generator didn't produce a usable page.") + " " + await settle(out.stage);
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
    // STAGED, where it never used to be. Without a name this path fell through
    // `ourFault` as an unrecognised stage and went free — which is the safe
    // direction by design, and the wrong answer here: the model returned pages,
    // they simply were not a site. Naming it is what puts it on the charged side,
    // and the response gains a `stage` the other failure paths already had.
    out.stage = "home";
    out.notes = "The pages came back without a home page, so the site is showing its data model for now — send it again to retry. " +
      await settle(out.stage);
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
  // THE MODEL'S OWN WORDS TO THE CUSTOMER. This field has always been written
  // and always been thrown away — `notes` was returned on the response and
  // nothing in the client rendered it, so every build has paid for a few dozen
  // tokens of prose nobody read. It is the reply in the chat now, which is why
  // the tool's description was rewritten to ask for a summary rather than a
  // list of omissions: same field, same cap, same call, ~0.07 credits.
  //
  // Every path BELOW this line overwrites it with our own sentence, because a
  // failed build needs to say what failed rather than what was built.
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
    // THE SPLIT THAT MATTERS MOST IS HERE. `typecheck` is the model's page not
    // compiling — charged. `build` is the bundler stage, which is where a drained
    // container lands — free. Both arrive as `!built.ok` and only the stage tells
    // them apart, which is why `compile`'s catch sets one rather than leaving it
    // undefined.
    out.notes = [v.notes, "The pages didn't compile, so the site is showing its data model for now — send it again to retry.",
      await settle(built.stage)].filter(Boolean).join(" ");
    return out;
  }

  // ~20 R2 puts. Small, but it is the last thing between a compiled bundle and a
  // live site, and an unexplained gap at the end of a build had nowhere to be.
  const tPub = Date.now();
  await deps.publish(built.files);
  out.publishMs = Date.now() - tPub;
  out.page = "app";
  // STILL BILLED AFTER `publish`, AND THAT ORDERING IS NOW LOAD-BEARING FOR A
  // SECOND REASON. It was "a publish that throws leaves them with no site"; it is
  // also the whole implementation of `publish` being an our-fault stage. There is
  // no branch for it and there does not need to be — a throw here propagates out
  // of this function with `charged` never set and `useCredits` never called, so
  // the exemption is structural rather than a rule somebody has to maintain.
  // Moving this line above `publish` would silently start billing for our own
  // storage outages, which is why a test asserts the order.
  await settle("published");
  return out;
}
