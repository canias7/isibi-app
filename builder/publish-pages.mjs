// Deciding what actually gets published.
//
// This is the part of a build that spends money and chooses what a visitor ends
// up seeing: whether to pay for a repair pass, whether the repair was an
// improvement worth keeping, and whether to publish at all. It lived inside
// worker.js, which cannot be imported, so none of it was ever tested — and it is
// exactly where a silent bug is expensive rather than merely wrong.
//
// Everything it touches is injected, the way site-data.mjs takes its database
// functions, so the real decision logic can be driven against fakes with no
// model call, no container and no R2.

import { validatePages, lintPages } from "./page-gen.mjs";

// Sonnet 5 rates over the platform's $0.008/credit basis. Whole credits, minimum
// one — a generation that produced anything at all was not free.
const RATE_IN = 3e-6, RATE_OUT = 15e-6, CREDIT_USD = 0.008;
export const pageCredits = (usedIn, usedOut) =>
  Math.max(1, Math.ceil((usedIn * RATE_IN + usedOut * RATE_OUT) / CREDIT_USD));

// Don't start a call the caller plainly cannot pay for. Deliberately a floor and
// not the worst case (~45 credits at the token ceiling): a new account is granted
// 20, and gating on the maximum would mean nobody ever got a page on their first
// build. A typical small site spends 10-20.
export const MIN_CREDITS = 8;

const buildFailureLine = (bd) =>
  (bd && bd.stage === "typecheck" ? "TypeScript rejected the pages:\n" : "The build failed:\n") +
  String((bd && bd.error) || "unknown build failure").slice(0, 4000);

/**
 * brief + schema → route files → compile → published dist.
 *
 * Best-effort by design: it runs AFTER the database has been provisioned and the
 * schema applied, so a generator or compiler failure still leaves the caller a
 * working backend and a placeholder — a build that half-worked, not one that was
 * lost. The return says which landed, so a fallback is never mistaken for a site.
 *
 * deps:
 *   generate(fix?)  → { input, truncated?, usedIn, usedOut }   the model call
 *   compile(pages)  → { ok, files?, error?, stage? }           the build container
 *   publish(dist)   → void                                     write to storage
 *   readCredits()   → number
 *   useCredits(n)   → void
 */
export async function publishPages(deps, { spec, slug } = {}) {
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

  // Charged on what the call actually used, and BEFORE the output is judged: the
  // tokens were spent whether or not the result turns out to be usable.
  const charge = async (g) => {
    const c = pageCredits(g.usedIn, g.usedOut);
    out.cost += c;
    try { await deps.useCredits(c); } catch { /* never fail a build over the ledger */ }
  };

  // Summed rather than last-writer: two attempts really did cost two builds, and
  // reporting only the second understates what the caller waited for.
  const compile = async (pages) => {
    const t0 = Date.now();
    let bd;
    try { bd = await deps.compile(pages); }
    catch (e) { bd = { ok: false, stage: "build", error: "the build service is unreachable: " + String((e && e.message) || e).slice(0, 200) }; }
    out.buildMs += Date.now() - t0;
    return bd || { ok: false, stage: "build", error: "the build service returned nothing" };
  };

  const gen = await deps.generate();
  await charge(gen);
  let v = validatePages(gen.input);
  if (!v.pages.length) {
    out.notes = gen.truncated
      ? "The pages came out longer than one pass allows — try a simpler brief."
      : "The generator didn't produce a usable page.";
    return out;
  }
  let problems = v.problems.concat(lintPages(v.pages, spec));
  let built = await compile(v.pages);

  // One repair pass, on a compile failure OR on a lint problem. Both matter: a
  // page that lists a `collect` table typechecks, bundles, and then 403s the
  // moment a visitor opens it, which is the failure nobody sees before shipping.
  if (!built.ok || problems.length) {
    const why = (built.ok ? [] : [buildFailureLine(built)]).concat(problems);
    let retry = null;
    try { retry = await deps.generate({ pages: v.pages, problems: why }); }
    catch { /* the first attempt stands */ }
    if (retry) {
      await charge(retry);
      const v2 = validatePages(retry.input);
      if (v2.pages.length) {
        const p2 = v2.problems.concat(lintPages(v2.pages, spec));
        const b2 = await compile(v2.pages);
        // Only keep the retry when it is actually BETTER — it compiles where the
        // first did not, or it compiles with fewer problems left in it. A retry
        // that merely compiles is not an improvement on one that already did.
        if (b2.ok && (!built.ok || p2.length < problems.length)) { v = v2; problems = p2; built = b2; }
      }
    }
  }

  out.files = v.pages.map((p) => "src/routes/" + p.path);
  out.problems = problems;
  out.notes = v.notes;
  if (!built.ok) {
    out.stage = built.stage;
    out.error = String(built.error || "").slice(0, 400);
    out.notes = [v.notes, "The pages didn't compile, so the site is showing its data model for now — send it again to retry."].filter(Boolean).join(" ");
    return out;
  }

  await deps.publish(built.files);
  out.page = "app";
  return out;
}
