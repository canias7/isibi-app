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

// List rates over the platform's $0.008/credit basis, PER MODEL.
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
//
// IT WENT PER-MODEL ON 2026-08-08, with the Builder picker. Until then it was
// the Sonnet 5 column and nothing else, which was exactly right for a platform
// where every build call was Sonnet — and a silent 67% undercharge on output the
// moment one of them could be Opus. Wiring a model choice without the price
// beside it would have shipped that on the same day as "charge for what you
// use", which is the one combination this rule cannot survive.
//
// The four kinds are the same shape for every model: cache read is 0.1x fresh
// input and cache write 1.25x, so those columns are derived facts rather than
// independent numbers — kept written out because a table somebody can read
// against a price list beats one they have to recompute.
export const MODEL_RATES = {
  //                     fresh in   output    cache read  cache write
  "claude-opus-5": { in: 5e-6, out: 25e-6, cacheRead: 0.50e-6, cacheWrite: 6.25e-6 },
  "claude-sonnet-5": { in: 3e-6, out: 15e-6, cacheRead: 0.30e-6, cacheWrite: 3.75e-6 },
  "claude-haiku-4-5": { in: 1e-6, out: 5e-6, cacheRead: 0.10e-6, cacheWrite: 1.25e-6 },
};

// What a usage object that names no model is priced at. NOT a fallback: it is a
// fact about every usage object written before the picker existed, all of which
// came off Sonnet, and about every call on the platform that is not given a
// choice. Sonnet 5 has an intro rate ($2/$10) running to 2026-08-31; the LIST
// price is used, because the ledger should not need re-pricing the day it ends.
export const DEFAULT_RATE_MODEL = "claude-sonnet-5";

/** Kept as an export: it was the whole table, and nothing that reads it changed. */
export const RATES = MODEL_RATES[DEFAULT_RATE_MODEL];

// Derived, per column, so adding a dearer model updates it without anybody
// remembering to. Comparing on one field (or on in+out) would let a model that
// is cheaper on input and dearer on output slip past.
const DEAREST_RATES = Object.values(MODEL_RATES).reduce((a, b) => ({
  in: Math.max(a.in, b.in),
  out: Math.max(a.out, b.out),
  cacheRead: Math.max(a.cacheRead, b.cacheRead),
  cacheWrite: Math.max(a.cacheWrite, b.cacheWrite),
}));

/**
 * The rates a usage object should be priced at.
 *
 * AN UNRECOGNISED MODEL IS PRICED AT THE DEAREST KNOWN RATE, and the direction
 * is the decision. Only our own code can put a model id here — the customer
 * picks from a three-entry allow-list in `build-models.mjs` — so this branch
 * means somebody wired a model and did not price it. Failing cheap is a silent
 * undercharge that looks exactly like a working platform and gets noticed in a
 * month, if at all; failing dear is visible on the meter the first time it
 * happens, and visible mistakes get fixed. Same reasoning as the schema deposit,
 * which KEEPS the money when the meter is unreadable.
 *
 * A test asserts every model any picker can select is in the table, so this
 * branch should be unreachable in practice — that is what makes it safe to make
 * it the expensive one.
 */
export function ratesFor(model) {
  if (!model) return MODEL_RATES[DEFAULT_RATE_MODEL];
  if (Object.hasOwn(MODEL_RATES, model)) return MODEL_RATES[model];
  console.error("no rate for model", String(model).slice(0, 60), "- pricing at the dearest known rate");
  return DEAREST_RATES;
}

const CREDIT_USD = 0.008;

// A web search is billed PER SEARCH and not in tokens, so it is invisible to
// every other number here — a research call that ran four searches reports a few
// hundred tokens and costs $0.04 on top, five credits of it. Counting only the
// tokens would have understated a searching build by more than the tokens cost.
// $10 per 1,000 searches.
export const SEARCH_USD = 0.01;

// A photograph, likewise flat and likewise invisible in a token count — and by
// far the largest single line a build can carry. $0.15 is 18.75 credits, where
// the whole rest of a warm build is about 21, so ONE picture roughly doubles the
// price of a site. That ratio is why builder/site-images.mjs spends most of its
// length deciding how many to ask for rather than how to ask.
//
// It lives HERE, beside the token rates and the search rate, because this is the
// one table — the eval imports it rather than restating it, and a second copy is
// how the bill and our own accounting start disagreeing.
export const IMAGE_USD = 0.15;

/**
 * Dollars at list price, for ONE call. Exported so nothing keeps a second copy.
 *
 * `model` selects the column. A usage object that does not name one is priced at
 * the default — see `DEFAULT_RATE_MODEL` for why that is a fact rather than a
 * guess. Searches and images are flat: a server-side web search is $0.01 and a
 * generated photograph $0.15 whichever model asked for them, so they are the two
 * terms here that do not move with the column.
 */
export const pageCost = ({ in: fresh = 0, out = 0, cacheRead = 0, cacheWrite = 0, searches = 0, images = 0, model } = {}) => {
  const r = ratesFor(model);
  return fresh * r.in + out * r.out + cacheRead * r.cacheRead + cacheWrite * r.cacheWrite +
    searches * SEARCH_USD + images * IMAGE_USD;
};

/**
 * Dollars for several calls that land on one bill.
 *
 * THIS SUMS MONEY, NOT TOKENS, and that changed with the Builder picker. It
 * used to be `sumUsage`, which merged the four token counts into one object and
 * priced the result once — correct exactly while every call in a build was on
 * the same model. Under `auto` the designer is Opus and the pages are Sonnet, so
 * a merged object has no honest rate to be priced at: adding the tokens would
 * charge one call at the other's price, whichever column won.
 *
 * The property `sumUsage` existed for survives unchanged, and is the reason this
 * returns dollars rather than credits: rounding happens ONCE, in `pageCredits`.
 * Rounding each call up to a whole credit and adding those would charge twice
 * for the rounding.
 */
export const totalCost = (...parts) => parts.reduce((sum, p) => sum + (p ? pageCost(p) : 0), 0);

// Whole credits, minimum one — a generation that produced anything at all was
// not free. Takes the usage OBJECTS, never numbers already summed: collapsing
// them is what threw away the distinction between the three input kinds in the
// first place, and now also between two models.
export const pageCredits = (...parts) => Math.max(1, Math.ceil(totalCost(...parts) / CREDIT_USD));

// Don't start a call the caller plainly cannot pay for. Deliberately a floor and
// not the worst case (~45 credits at the token ceiling): a new account is granted
// 20, and gating on the maximum would mean nobody ever got a page on their first
// build. A typical small site spends 10-20.
export const MIN_CREDITS = 8;

/**
 * What a COLD schema call really costs, measured.
 *
 * From `build smoke` 2026-08-13: `in 236 · out 1490 · cacheRead 0 ·
 * cacheWrite 19008`. A cold call rather than a warm one on purpose — this
 * feeds a gate, and a gate that under-estimates takes the customer's money and
 * then refuses to finish, which is the exact bug it exists to stop. Over-
 * estimating costs an occasional "top up" to somebody who would just have
 * squeezed through on a warm cache; that is the cheap direction.
 *
 * RE-MEASURED 2026-08-13, AND IT HAD DRIFTED 42% ON THE TERM THAT DOMINATES.
 * The 2026-08-08 figures were `out 1319 · cacheWrite 13357` → 9 credits, so
 * `buildFloor` said 17 and a 20-credit grant sailed through; the call then cost
 * 12 and left 7, under `MIN_CREDITS` 8. So the gate waved through a build that
 * could not finish and the customer was charged 12 for a placeholder — the
 * precise failure this constant exists to prevent, recurring because the number
 * stopped being true. The schema prompt has grown since (the 17 style axes among
 * other things) and this will drift again: it is a measurement, so re-take it
 * when the tool changes rather than trusting the comment.
 *
 * THE CONSEQUENCE, STATED: `buildFloor` is now 20, which is exactly the new-
 * account grant, so a cold first build is REFUSED UP FRONT — with a refund,
 * having spent nothing. That is strictly better than the old behaviour, where
 * the same customer was charged 12 credits and handed a placeholder. It is not
 * a fix for the underlying limit: a new account still cannot get pages on a
 * cold cache, and closing THAT means raising the grant, which is a decision
 * about money rather than a number to correct here.
 */
export const SCHEMA_PROFILE = { in: 236, out: 1490, cacheRead: 0, cacheWrite: 19008 };

/**
 * The balance a build needs BEFORE it starts, for a given designer model.
 *
 * THE BUG THIS EXISTS FOR, measured live and caused by the picker: the route
 * charged for the schema call, THEN `publishPages` read the ledger, found less
 * than `MIN_CREDITS` and refused to generate. A new account granted 20 credits
 * spent 15 on a cold Opus schema call and got a placeholder — charged for a
 * site it never received.
 *
 * That is not the generation-failed case the charging rule was written for. The
 * pages model was never called at all: we spent their budget on step one and
 * then declined to do step two, which is ours and not theirs. So the whole
 * build is affordable before anything is spent, or nothing is.
 */
export const buildFloor = (designModel) =>
  pageCredits({ ...SCHEMA_PROFILE, model: designModel }) + MIN_CREDITS;

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
  // A LIST, BECAUSE THE SCHEMA STEP CAN BE MORE THAN ONE CALL and the two are
  // not on the same model. When the designer omits its required `seed`, a small
  // Haiku call fills the gap — so the step's real cost is a Sonnet-or-Opus call
  // plus a Haiku one, and adding their token counts into a single object would
  // price one at the other's rate. That is the `sumUsage` bug this file already
  // paid for. `pageCredits` is variadic: it prices each part at its own model's
  // rates, sums the DOLLARS, and rounds once. A single usage still works exactly
  // as it did, and an empty or missing report still keeps the deposit.
  const parts = (Array.isArray(usage) ? usage : [usage]).filter(Boolean);
  if (!parts.length) return 0;
  return pageCredits(...parts) - (Number(deposit) || 0);
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
 * The route id a file path declares, so a stub can stand in for a real page.
 *
 * It has to agree with `tsr generate`'s own convention EXACTLY, because the
 * generated route tree is what the rest of the site's `<Link to="…">` calls
 * typecheck against — a stub declaring `/memberships` where the tree expects
 * `/membership` is a second compile error rather than a repair.
 */
export function routeIdFor(path) {
  const bare = String(path || "").replace(/^(?:src\/)?routes\//, "").replace(/\.tsx$/i, "");
  const parts = bare.split("/").filter(Boolean);
  // `index` names its PARENT — `index.tsx` is "/", `blog/index.tsx` is "/blog".
  if (parts[parts.length - 1] === "index") parts.pop();
  return "/" + parts.join("/");
}

/**
 * A valid route file that says, in plain words, that this one page is unfinished.
 *
 * STANDING IN FOR THE PAGE RATHER THAN DELETING IT is the whole design, and it is
 * forced by the route tree: every other page's `<Link to="/memberships">` is typed
 * against the generated tree, so removing the file turns ONE broken page into a
 * compile error on every page that links to it. Replacing it keeps the route, so
 * nothing else in the site has to change.
 *
 * `validateSearch` is permissive for the same reason. A price row navigating with
 * `search: { service: r.name }` is typed against the DESTINATION's validator, so a
 * stub with none makes that call a type error — the cascade again, one prop over.
 *
 * The link home is a `<Link>`, never `<a href="/">`. A published site is mounted
 * under a basepath on the preview origin, where a plain anchor leaves the site.
 */
export function stubPage(path) {
  const id = routeIdFor(path);
  return `import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("${id}")({
  component: Unfinished,
  validateSearch: (search: Record<string, unknown>) => search,
});

function Unfinished() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Still being written
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        This page isn't finished yet
      </h1>
      <p className="text-muted-foreground">
        The rest of the site is live. Ask for this page again and it'll be written properly.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium"
      >
        Back to the home page
      </Link>
    </main>
  );
}
`;
}

/**
 * What to stub after a typecheck failure — or why nothing can be.
 *
 * A ONE-PAGE MISTAKE COST THE WHOLE SITE, and that was the commonest outcome
 * there is: the eval measures ~40% of generations failing to compile, usually on
 * one file, and the customer got a bare data-model placeholder instead of the
 * five pages that were fine. Measured live 2026-08-09 — a gym site died on one
 * bad import in `memberships.tsx` and published nothing else.
 *
 * NOT THE REPAIR PASS THAT WAS REMOVED. That one re-ran the MODEL — ~80% of what
 * a build costs — to guess again at every page. This re-runs the container on
 * source we already have, with one file replaced by a constant. No model call, no
 * tokens, ~15-40s.
 *
 * Three refusals, each of which would otherwise buy a wasted container run:
 *
 *   - THE HOME PAGE MUST SURVIVE. Stubbing it leaves the one address a customer
 *     shares rendering an apology, and the header that navigates to everything
 *     else lives inside the page source we just threw away — so the visitor lands
 *     on a dead end. Same rule the `home` stage already enforces on a build with
 *     no index at all, applied to the page being unusable rather than absent.
 *   - A FILE WE DID NOT WRITE means the error is in the template or the kit, and
 *     no amount of stubbing pages will fix it.
 *   - NOTHING NAMED means the compiler failed somewhere with no file citation,
 *     which is not a page problem either.
 *   - A PAGE THAT ALREADY WORKS is not one to replace with an apology. See
 *     `live` below: this is the refusal that keeps salvage from being a
 *     regression on every site that already exists.
 *
 * `live` IS WHAT THE SITE IS SERVING RIGHT NOW, and without it this feature was
 * only ever right about first builds. The framing — "their site with one page
 * reading 'this page isn't finished yet', instead of nothing" — is true when the
 * alternative is nothing. On a REVISE the alternative is their old working site:
 * pre-salvage, a revise whose pages failed to compile deliberately left the
 * published site untouched, so "change the phone number in the header" could not
 * cost them anything. With salvage and no `live`, one page failing to compile
 * publishes a stub OVER a live, working menu — the customer asked for a phone
 * number and lost a page. Recoverable by asking again or restoring a version,
 * and still not a trade anybody chose.
 *
 * A NEW page that fails is still stubbed, which is the whole value: it was never
 * on the site, so a placeholder is strictly better than the whole build falling
 * back. The rule is therefore about what would be DESTROYED, not about build vs
 * revise — a first build passes an empty `live` and behaves exactly as before.
 *
 * `foreign` is returned rather than folded into `reason` because a kit file
 * turning up here is US shipping something broken — `fallbackSeed`, `require()`
 * and `FaqAccordion` all really happened — and that has to be findable without
 * re-running a build. It is carried out on the response for that reason; the
 * comment here used to claim the eval read it, and nothing did.
 */
export function salvagePlan(error, pages, live) {
  const known = new Set((pages || []).map((p) => p.path));
  const published = live instanceof Set ? live : new Set(Array.isArray(live) ? live : []);
  const stub = new Set();
  const foreign = new Set();
  const kept = new Set();
  for (const m of String(error || "").matchAll(/((?:[\w.$-]+\/)*[\w.$-]+\.tsx?)\((\d+),(\d+)\)/g)) {
    const cited = m[1];
    const bare = cited.replace(/^(?:src\/)?routes\//, "");
    // A path is OURS only when stripping the routes prefix lands on a page this
    // build actually wrote. `src/components/ui/faq.tsx` never will, which is what
    // separates a page mistake from a kit one.
    if (!known.has(bare)) { foreign.add(cited); continue; }
    if (published.has(bare)) kept.add(bare); else stub.add(bare);
  }
  if (foreign.size) return { stub: [], foreign: [...foreign], kept: [], reason: "the error is in a file the build didn't write" };
  if (kept.size) {
    // REFUSED WHOLESALE, not partially. Stubbing the new pages and leaving the
    // working one broken publishes a site that is worse than either outcome: the
    // customer's change is half-landed and a page they had is still failing. The
    // caller's fallback — leave the published site exactly as it is — is the
    // answer they had before salvage existed, and it is the safe one.
    return { stub: [], foreign: [], kept: [...kept].sort(), reason: "the page that failed is one the site is already serving" };
  }
  if (!stub.size) return { stub: [], foreign: [], kept: [], reason: "the error names no page" };
  if (stub.has("index.tsx")) return { stub: [], foreign: [], kept: [], reason: "the home page is the one that failed" };
  return { stub: [...stub].sort(), foreign: [], kept: [], reason: "" };
}

/**
 * Was this step KILLED rather than having failed?
 *
 * The container reports it through `exitReason`, whose whole job is to say why a
 * step that wrote nothing exited — so this matches the shape that function
 * produces and a test drives the real `exitReason` to prove the two agree rather
 * than restating its wording by hand. A hand-copied regex here is a second
 * spelling of one fact, and the direction it drifts in is a customer charged for
 * our container being stopped.
 *
 * Deliberately narrow: it is the SIGNAL that makes this unambiguous. A step that
 * exited non-zero having printed a real diagnosis is the code's problem whatever
 * the signal fields say, and `exitReason` returns that text in preference to
 * this shape — so the two cannot both match.
 */
export function wasKilled(error) {
  return /\bwas killed by SIG[A-Z]+\b/.test(String(error || ""));
}

/**
 * Which pages came back as stubs, as one sentence for the customer.
 *
 * Empty string when nothing was stubbed, so the ordinary build carries no field
 * and the client's note block is unchanged — the same shape `imageNote` uses, and
 * the reason a site that published cleanly does not gain a line about salvage.
 */
export function salvageNote(stubbed) {
  const names = (stubbed || []).map((p) => String(p).replace(/\.tsx$/i, ""));
  if (!names.length) return "";
  const many = names.length > 1;
  return "The " + names.join(", ") + (many ? " pages didn't compile, so they're" : " page didn't compile, so it's") +
    " showing a short placeholder for now. The rest of the site is live — ask for " +
    (many ? "those pages" : "that page") + " again and I'll write " + (many ? "them" : "it") + " properly.";
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
 *   publish(dist, pages) → void                                write to storage
 *                     `pages` is the SOURCE that produced `dist`, so a later
 *                     revise can edit it instead of regenerating from nothing.
 *   readCredits()   → number
 *   useCredits(n)   → number: the credits ACTUALLY collected, which may be less
 *                     than n. The ledger is a gate, not a till — `use_credits`
 *                     debits zero and refuses when the balance is short — so a
 *                     dep that returns nothing here is a fake more capable than
 *                     the real thing, and that is how this shipped charging
 *                     nothing while reporting `charged: true`.
 *
 * `livePages` is what this slug is SERVING right now — the paths of the pages a
 * visitor can load today, empty on a first build. It exists for exactly one
 * decision, in `salvagePlan`: a page that already works is never replaced with
 * an apology, because the alternative on a revise is the customer's old working
 * site rather than nothing.
 *
 * `priorUsage` is what an EARLIER model call in this same build already spent —
 * today that is the web-research step, which runs before page generation. It is
 * carried here rather than billed where it happens so that it obeys the same
 * one-sentence rule as everything else on this path: **if the customer got the
 * placeholder, they were not charged.** Billing it at its own call site would
 * mean a build that searched the web and then failed to publish took credits for
 * nothing, which is precisely the outcome this function was rewritten to stop.
 */
export async function publishPages(deps, { spec, slug, priorUsage, livePages } = {}) {
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
  // TWO PAID SENTENCES, BECAUSE ONE OF THEM WAS A LIE ON A REAL BUILD. Seen
  // live 2026-08-10: `stage: validate`, `the generator called the tool with no
  // pages in it`, under a message reading "the pages were written, they just
  // didn't work". No pages were written — that is the whole reason the stage
  // fired. Somebody reading it goes looking for pages that do not exist, and it
  // is the worst possible moment to be inaccurate, because the same message is
  // telling them they have been charged.
  //
  // `validate` covers three different things and only one of them wrote
  // anything: every page refused (it did), the tool called empty, and the model
  // never calling the tool at all. The charge is the same for all three — we
  // really did pay for those tokens, which is what `CHARGED_STAGES` says — so
  // what changes is only the description of what the money bought.
  const PAID = "This attempt used credits — the pages were written, they just didn't work.";
  const PAID_NOTHING = "This attempt used credits — the model was called and didn't return a page.";

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
    if (bd) for (const k of ["routesMs", "tscMs", "viteMs", "preMs", "renderMs"]) {
      if (typeof bd[k] === "number") out[k] = (out[k] || 0) + bd[k];
    }
    // WHAT THE BROWSER SAW, from the compile that produced the files being kept.
    //
    // ASSIGNED rather than accumulated, unlike the timings beside it, and the
    // difference matters on a salvaged build: `compile` runs again with the bad
    // page stubbed, and it is that second run whose pages get published. Merging
    // the two would report findings about a file the customer never receives.
    // A failed compile never reaches the render step at all, so it carries none.
    if (bd && bd.render && typeof bd.render === "object") out.render = bd.render;
    // WHY A PAGE HAS NO SNAPSHOT. The container reports per-route prerender
    // skips ("rendered no text", a throw during SSR) on every build, and
    // nothing in production carried them (2026-08-13 audit) — so a page whose
    // snapshot silently failed was indistinguishable from one that never had a
    // problem, until a link preview showed an empty card. Assigned like
    // `render`, from the compile whose files are kept; bounded, because it is
    // a diagnosis and not a transcript.
    if (bd && Array.isArray(bd.prerenderSkipped) && bd.prerenderSkipped.length) {
      out.prerenderSkipped = bd.prerenderSkipped.slice(0, 6).map((s) => String(s).slice(0, 200));
    }
    // THE LOOK THAT FAILED SOFT. `writeTheme` and `writeFonts` never fail a
    // build — a site whose data layer is live must not be lost over a typeface —
    // so they return `applied:false` with a sentence saying what happened
    // instead. Both were reported on every build and forwarded by nothing, so
    // the failure they exist to describe was invisible everywhere.
    //
    // Latent today, and the class is not: `themeCss` was executed over all 500
    // registry themes with 0 nulls and 0 throws, but a stored `site_look.theme`
    // naming a theme LATER REMOVED from the registry — a deletion this repo
    // performs regularly — would make every subsequent publish of that site
    // ship the default look while reporting success, for ever.
    //
    // Carried only when something went wrong, so a build where both applied is
    // byte-identical on the wire and the field's presence is the signal.
    const soft = [];
    for (const [what, r] of [["theme", bd && bd.theme], ["fonts", bd && bd.fonts]]) {
      if (!r || typeof r !== "object" || r.applied !== false) continue;
      const said = (Array.isArray(r.notes) ? r.notes : []).map((s) => String(s).slice(0, 160));
      soft.push({ what, notes: said.slice(0, 2) });
    }
    if (soft.length) out.lookSoft = soft;
    // WAS THE RENDER SANDBOXED. The prerender executes model-written page code,
    // and it is dropped to an unprivileged user so it cannot write to the shared
    // container — but the drop needs the service to be running as root and needs
    // that user to exist, neither of which the code can guarantee. So the answer
    // is reported rather than assumed: "we thought this was sandboxed" is a
    // worse position than knowing it is not. Carried only when it is FALSE, so
    // the ordinary response is byte-identical and the field's presence is
    // itself the alarm.
    if (bd && bd.prerenderUnprivileged === false) out.prerenderUnprivileged = false;
    // WHICH TEMPLATE BUILT THIS. Cloudflare rolls a container image out
    // asynchronously, so a build minutes after a deploy can still be served by
    // the previous image — and its published bundle is that older code. Carried
    // out so a caller can compare it against its own checkout instead of
    // diagnosing a bug that was already fixed.
    if (bd && typeof bd.templateId === "string") out.templateId = bd.templateId;
    if (!bd) return { ok: false, stage: "build", error: "the build service returned nothing" };
    // A KILLED STEP IS OURS, WHICHEVER STEP IT WAS KILLED IN.
    //
    // Measured live 2026-08-09: a revise came back `stage: "typecheck"` with
    // `tsc was killed by SIGTERM (no output)`. That is the container being
    // drained under a running build — the documented `stage: "build"` failure —
    // and it arrived wearing the one stage that is CHARGED and never RETRIED,
    // because the drain happened while `tsc` was the step running rather than
    // `vite`. So our own rollout lost the customer's revise and billed them for
    // it, and which of those two happens comes down to timing.
    //
    // `build` was described as "the judgement call... nothing in the error text
    // separates them", and that is true of a genuine bundler error. A SIGNAL is
    // not that: the process never got to judge the code at all, so there is
    // nothing ambiguous to weigh. Reclassifying it at the boundary means the
    // existing retry and the existing `ourFault` both do the right thing with no
    // second rule to keep in step — and `salvagePlan` stops being offered a
    // "typecheck failure" naming no page.
    if (!bd.ok && wasKilled(bd.error)) { out.killedAt = bd.stage; bd = { ...bd, stage: "build" }; }
    return bd;
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
    // PHOTOGRAPHS RIDE THE SAME RULE, deliberately not their own. They are priced
    // from the same table as tokens and searches, rounded in the same single
    // rounding, and exempted by the same `ourFault` — one rule rather than two
    // that can disagree about a build that half-worked.
    //
    // The cost of that, stated: a build whose pages fail to TYPECHECK is a
    // charged stage, and by then the pictures have already been bought — so
    // somebody can pay for six photographs and be shown the placeholder page.
    // Bounded rather than ignored: the images land in `uploads/<slug>/`, which is
    // the owner's own image library and is deliberately NOT wiped by a publish,
    // so they still have every picture they paid for and a revise can use them.
    const c = pageCredits(gen.usage, priorUsage, out.images ? { images: out.images.made } : null);
    // WHAT WAS BILLED AND WHAT WAS COLLECTED ARE TWO NUMBERS, and conflating
    // them is what let this path charge nothing for months. `use_credits` is a
    // gate: a bill larger than the balance debits ZERO and answers -1 rather
    // than throwing, so `await`ing it and moving on reported a charge that had
    // not happened. `out.cost` is now what actually left the ledger — the
    // number that matches the customer's balance — and `out.billed` is what the
    // work really cost, so the shortfall stays visible instead of vanishing.
    out.billed = (out.billed || 0) + c;
    let took = 0;
    try {
      const got = await deps.useCredits(c);
      // A dep that reports nothing is the legacy void contract; treat it as
      // having taken the full amount rather than silently reading 0, or every
      // older caller would start reporting free builds.
      took = typeof got === "number" ? Math.max(0, got) : c;
    } catch { took = 0; /* never fail a build over the ledger */ }
    out.cost += took;
    // `charged` is about the LEDGER, not about the intent. A build that billed
    // 21 and collected 0 must not tell the customer it used their credits.
    out.charged = took > 0;
    // DERIVED FROM WHAT THE MODEL RETURNED, not passed in. `settle` takes a stage
    // rather than a flag precisely so a new failure mode has to be classified in
    // one place instead of remembered at each call site, and a wording parameter
    // would put that back — three call sites, each free to describe the same
    // outcome differently. `gen.input` is the tool payload `validatePages` reads,
    // so this asks the same object the same question: did any page arrive at all.
    // True on `home`, `typecheck` and `published`, which all have pages by then.
    const wrote = !!(gen && gen.input && Array.isArray(gen.input.pages) && gen.input.pages.length);
    return took > 0 ? (wrote ? PAID : PAID_NOTHING) : FREE;
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
        // FOUR MODEL FAILURES USED TO PRINT ONE SENTENCE, so a real build could
        // not be diagnosed the next day: no `pages` key, an empty list, a list
        // whose every entry had no code, and a tool call that never happened.
        // The third is now a `problems` entry (see `validatePages`) and the first
        // two are separated here. `out` is the output-token count, which is the
        // one number that tells "the model said almost nothing" apart from "the
        // model wrote a whole site and we dropped every page of it".
        : (!gen.input || !Array.isArray(gen.input.pages)
            ? "the generator called the tool with no `pages` list at all"
            : "the generator called the tool with an empty `pages` list") +
          " (" + ((gen.usage && gen.usage.out) || 0) + " output tokens)";
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

  /**
   * Buy the photographs the pages asked for — or leave them as placeholders.
   *
   * HERE, and not earlier or later, for three reasons. The pages must exist,
   * because the tokens are in them. The model call must have HAPPENED, because
   * what it cost is the reserve the affordability check subtracts, and measured
   * beats estimated on a decision this expensive. And it must be before the
   * compile, because a URL replaces a token inside a string literal — which
   * cannot change whether the page typechecks, but has to be there before the
   * bundle is built, since editing minified output afterwards is not a thing to
   * attempt.
   *
   * IT CANNOT FAIL A BUILD. Every failure — no dep wired, the image model down,
   * the bucket refusing — leaves the pages exactly as written, and a token with
   * no picture behind it becomes an empty `src`, which is `SafeImage`'s designed
   * placeholder and the look every site this platform has published so far has
   * had. So the worst case is not a broken site, it is today's site.
   */
  let pages = v.pages;
  if (typeof deps.images === "function") {
    // MEASURED, not estimated: generation has already happened, so this is what
    // this build really cost rather than a guess at what a build costs. A guess
    // low here spends the pages' own budget on pictures and cannot pay for the
    // pages; a guess high refuses photographs somebody could afford.
    const reserve = pageCredits(gen.usage, priorUsage);
    try {
      const r = await deps.images(v.pages, { balance, reserve });
      if (r && Array.isArray(r.pages) && r.pages.length === v.pages.length) pages = r.pages;
      out.images = {
        made: Math.max(0, Number(r && r.made) || 0),
        // What the FAMILY asked for, before the balance cut it down. Carried
        // apart from `budget` because on its own `budget` cannot say whether a
        // site with no pictures was never meant to have any or simply could not
        // afford them — and those read the same on the published page.
        planned: Math.max(0, Number(r && r.planned) || 0),
        budget: Math.max(0, Number(r && r.budget) || 0),
        // What the pages asked for beyond what they got. The difference between
        // "this site has no photographs" and "this site wanted twelve" is not
        // visible from `made` alone, and only one of those is a problem.
        overflow: Math.max(0, Number(r && r.overflow) || 0),
      };
      if (r && r.error) out.images.error = String(r.error).slice(0, 200);
    } catch (e) {
      // Named rather than swallowed. A site that silently has no pictures looks
      // exactly like a site that was never meant to, and this is the one field
      // that can tell them apart after the build has returned.
      out.images = { made: 0, planned: 0, budget: 0, overflow: 0, error: String((e && e.message) || e).slice(0, 200) };
    }
  }

  let built = await compileWithRetry(pages);

  /**
   * ONE PAGE THAT DOES NOT COMPILE USED TO COST THE WHOLE SITE.
   *
   * `tsc --noEmit` runs over the app, so a single `TS2305` in `memberships.tsx`
   * failed the build and the customer got the data-model placeholder — no home
   * page, no price list, no booking form, none of the five files that were
   * perfectly fine. With ~40% of generations failing to compile (measured over
   * eight eval runs), that is the ordinary outcome and not an edge case.
   *
   * So the failing pages are replaced with a stub that says so, and the container
   * runs once more. What the customer gets is their site with one page reading
   * "this page isn't finished yet", instead of nothing.
   *
   * WHY THIS IS NOT THE REPAIR PASS: `salvagePlan`'s comment carries the argument
   * — no model call, no tokens, one container run on source that already exists.
   * The removal was about paying for a second GENERATION; this pays for a second
   * COMPILE, which is the cheap half.
   *
   * The stage stays `typecheck` on a salvaged build and the charge is unchanged:
   * the pages were written and the model was paid for either way, and a customer
   * whose site publishes has been served better than one whose site did not.
   */
  if (!built.ok && built.stage === "typecheck") {
    const plan = salvagePlan(built.error, pages, livePages);
    out.salvage = { stubbed: plan.stub, foreign: plan.foreign, kept: plan.kept, reason: plan.reason };
    if (plan.stub.length) {
      // THE FIRST FAILURE IS WHAT GETS DIAGNOSED, not the second. A salvaged build
      // returns `ok`, so without keeping these the error that actually happened is
      // gone — and it is the only record of what the generator got wrong. `stage`
      // is deliberately NOT set here: it names an OUTCOME, and a build that went on
      // to publish did not end at the typecheck.
      out.error = String(built.error || "").slice(0, 400);
      out.cited = citedLines(built.error, pages);
      const bad = new Set(plan.stub);
      const patched = pages.map((p) => (bad.has(p.path) ? { ...p, source: stubPage(p.path) } : p));
      // THE RETRY WRAPPER, not the bare compile. A container drained mid-build
      // is the exact race `compileWithRetry` exists for — measured live twice —
      // and this call had no second attempt, so unlucky rollout timing turned a
      // salvageable site into the data-model placeholder for a reason that had
      // nothing to do with the customer's pages. The money is unaffected either
      // way; what was lost was the outcome.
      const second = await compileWithRetry(patched);
      out.builds = (out.builds || 0) + 1;
      if (second.ok) {
        built = second;
        // THE STUB IS WHAT GETS STORED, and a revise therefore edits the stub
        // rather than the source that would not compile. Handing the model back
        // its own broken file invites it to keep the broken line — and the stub
        // reads unmistakably as unfinished, which is the instruction.
        pages = patched;
        out.salvaged = plan.stub;
      } else {
        out.salvage.secondStage = second.stage;
        out.salvage.secondError = String(second.error || "").slice(0, 200);
      }
    }
  }

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
  // THE SOURCE GOES WITH THE BUNDLE, and that is what makes a revise an EDIT.
  //
  // Until this the generator was handed only the brief and the schema, and the
  // container wiped `src/routes` before every build — so a revise rewrote every
  // page of the site from scratch. "Change the phone number in the header"
  // regenerated all the copy on every page: on topic, because the original
  // brief anchors it, and not the same words. That is the other half of what
  // the owner reported as "changing pages changes the stuff inside the site" —
  // the publish gap was real and so is this.
  //
  // Passed to `publish` rather than stored here, because this module owns no
  // storage: the Worker decides where it goes, the way it does for the dist.
  await deps.publish(built.files, pages);
  out.publishMs = Date.now() - tPub;
  out.page = "app";
  // SAY WHICH PAGE DID NOT MAKE IT. A visitor finding the stub by clicking the
  // header would otherwise be the first anybody hears of it, and the owner is the
  // one who can ask for it again.
  //
  // ITS OWN FIELD, NOT APPENDED TO `notes`, and that is the whole point of the
  // shape. `notes` is the model's summary and renders as one paragraph in
  // `.st-msg`, so a caveat glued onto the end of it is buried mid-sentence —
  // exactly the failure recorded for `contextNote`, where "couldn't read your
  // link" ended up in the middle of a run-on. This joins `contextNote`,
  // `imagesNote` and `tokensNote` in the separate note element, and is composed
  // HERE for the reason all three are: the client is a plain script that cannot
  // import this module, and a second copy there drifts toward naming a page that
  // published perfectly well.
  out.salvageNote = salvageNote(out.salvaged);
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
