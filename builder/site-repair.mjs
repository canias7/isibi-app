// THE REPAIR PASS — what the render check found, handed to a cheap edit.
//
// Owner's call, 2026-08-24, after `the-lido-cafe` published with a dead booking
// form: *"after the page generation step, can there be a revise step that
// literally checks everything that it generated, checks what's wrong and fixes
// before launching it?"*
//
// THE CHECK ALREADY EXISTED AND ALREADY RAN. `checkRender` opens every route in
// a real browser at two widths on every build and reports what it finds. It was
// report-only by an explicit earlier decision, pending a false-alarm
// measurement. So this is not a new detector; it is the wire from the detector
// to a fix.
//
// ── WHY THIS IS NOT THE 2026-08-04 REPAIR PASS ──────────────────────────────
//
// That one re-ran `generateSitePages` — the whole ~36,000-token generator
// prompt, a fresh write of every page. Output is ~92% of what a build costs, so
// a failing build cost roughly TWICE a working one while a working one was
// already about break-even. It was removed and its tests were replaced by their
// inverse: *"a second call never happens"*.
//
// This edits ONE FILE. It is the `tweak` rung — Haiku, the page's own source,
// a short prompt — measured at ~3 credits against ~10 for a regeneration, with
// a refusal at ~1. The economics that killed the old one do not apply, and the
// distinction is worth keeping straight: that was a second GENERATION, this is
// a second EDIT.
//
// ── WHAT IT REUSES, AND WHY NOT A LINE OF IT IS COPIED ──────────────────────
//
// Every guard lives in `site-tweak.mjs` and is used from there: `sameProse`
// (calibrated at 0 false alarms over 1,640 real tweaks, catching a rewording on
// 329 of 329 pages), `routeIdOf`, the truncation floor, and `tweakLint`'s
// differential — *what this edit BROKE, never what the page was already
// carrying*. `readTweak` applies all of them in one place and makes no
// assumption about why the edit was asked for, so it is called unchanged.
//
// What could NOT be reused is the SYSTEM PROMPT. `TWEAK_RULES` opens "the
// customer has asked for one visual change" and lists `cannot` for anything
// that is not one — handed a page that threw, it is an instruction to refuse.
// So `tweakRequest` took a `rules` parameter and this module supplies its own.
// The alternative was a second copy of eight guards, which is exactly how five
// copies of one route mapping happened.

import { runTweak, MAX_TWEAK_CHARS } from "./site-tweak.mjs";
import { SERIOUS } from "./site-render.mjs";
import { routeOf } from "./site-addon.mjs";

/**
 * How many pages one build will pay to repair.
 *
 * A new build plans ONE page (site-plan's `MAX_PAGES`, 2026-08-28) and the
 * writer keeps at most 6 (page-gen's own `MAX_PAGES`, the tolerance for sites
 * built before that), so this is not really a cost bound — it is a sanity
 * bound. A render report naming every page as broken is far
 * more likely to be the check having a bad day than five independently broken
 * pages, and spending five calls on that is the false-alarm failure paying for
 * itself. Three is enough for the real case and small enough that a wrong
 * report cannot run away.
 *
 * WHAT IS DROPPED IS REPORTED, never silently cut — the rule this repo already
 * lives under: a bounded sweep that says nothing reads as "covered everything".
 */
export const MAX_REPAIRS = 3;

/**
 * What the model is told.
 *
 * SHORT, LIKE `TWEAK_RULES`, AND FOR THE SAME REASON: this rung's whole saving
 * is not sending the generator prompt. The components in front of it are the
 * ones already in the file.
 *
 * THE FAULT IS ASSERTED AS OBSERVED, and that sentence is load-bearing. A model
 * handed a page that looks reasonable will very often answer that it looks
 * reasonable — but this fault was watched happening in a browser, so "I can't
 * see anything wrong" is not an available answer. It still has `cannot`, which
 * escalates honestly rather than inviting a guess.
 *
 * THE CAUSE LIST IS FITTED TO TWO OBSERVED FAILURES AND IS MARKED AS SUCH.
 * `useFormField` outside `<FormItem>` on `the-lido-cafe`'s /book (2026-08-24)
 * and `message-scroller`, which this repo already records as having
 * "typechecked, bundled, and hard-crashed the page because its context lives in
 * an npm package and nothing said it needs a provider". Two instances is not a
 * distribution. It is offered as examples rather than a taxonomy, and it is the
 * first thing to re-measure once a handful of real reports exist.
 */
export const REPAIR_RULES =
  "You are fixing ONE broken file of a small business's website. It compiled and it shipped, and then a real " +
  "browser opened it and the page FAILED. What went wrong is below.\n\n" +
  "FIX THAT FAULT AND NOTHING ELSE. Everything the fault does not touch comes back exactly as it went in — the " +
  "same words, the same order, the same imports, the same formatting. You are not reviewing this file and you " +
  "are not improving it.\n\n" +
  "DO NOT CHANGE ANY OF THE WORDS A VISITOR READS. Not a heading, not a sentence, not a button label, not a " +
  "price. This is checked, and a file that comes back with different wording is thrown away.\n\n" +
  "DO NOT CHANGE THE PAGE'S ADDRESS. The `createFileRoute(\"…\")` line stays exactly as it is.\n\n" +
  "THE FAULT IS REAL — it was watched happening in a browser, not guessed at. So \"the page looks fine\" is not " +
  "an answer. If you genuinely cannot see what would cause it, answer `cannot` and the page ships as it is.\n\n" +
  "THINGS THAT CAUSE THIS: a component used outside the one it needs around it — shadcn's `FormLabel`, " +
  "`FormControl`, `FormDescription` and `FormMessage` all have to sit inside a `<FormItem>`, and that inside a " +
  "`<FormField>`; a hook called inside a condition or a loop; a value read off something that is undefined on " +
  "the first render, before any rows have arrived; a whole page body behind a condition that is false when the " +
  "list is still empty.";

/**
 * The findings that are worth paying to fix, one entry per PAGE.
 *
 * DEDUPED BY PAGE, because the check opens every route at desktop AND phone and
 * a crash is a crash at both — undeduped, the commonest real report would spend
 * two calls fixing one file, and the second would be handed a file the first
 * had already changed.
 *
 * ONLY `SERIOUS`. `threw` and `blank` mean a visitor sees nothing; `contrast`,
 * `overflow`, `image` and `logged` mean they see something imperfect, and those
 * are judgement calls that would fire on correct sites. This rung spends money
 * and rewrites a customer's page, so it gets the narrow half.
 *
 * ONLY PAGES THIS BUILD WROTE. A finding names a ROUTE; `routeOf` maps a page's
 * file path to its address. A route with no page behind it is the site's own
 * 404 or a nested layout, and there is no file to hand a model.
 *
 * NOTHING AT ALL WHEN THE CHECK COULD NOT RUN (`ok === false`), which is the
 * fail-safe direction and the one that matters most here: a browser that would
 * not start reports zero findings, and zero findings must never be read as a
 * clean site — but it must equally never be read as a broken one. No report, no
 * repair, no spend.
 */
export function repairBrief(report, pages, { prefixes = [] } = {}) {
  const r = report && typeof report === "object" ? report : null;
  if (!r || r.ok === false) return { work: [], dropped: 0 };

  const findings = Array.isArray(r.findings) ? r.findings : [];
  const list = Array.isArray(pages) ? pages : [];

  // route -> page, built once. `routeOf` is the ONE reading of file-to-address
  // in this repo and re-deriving it here is how the fifth copy of that mapping
  // would appear.
  const byRoute = new Map();
  for (const p of list) {
    if (!p || typeof p.path !== "string") continue;
    const route = routeOf(p.path);
    if (route && !byRoute.has(route)) byRoute.set(route, p);
  }

  // A LANGUAGE VARIANT IS THE SAME PAGE (run 34, 2026-09-04). The check opens
  // `/es/gear` and `/fr/gear` as routes of their own — they are, in the bundle
  // — and reports what threw there against THAT address; no stored page has
  // it, so the crash on the gear page reached this brief as "a route this
  // build has no page for" and bought nothing, on a site whose gear page was
  // down in three languages. The variant is `translatePages` over the primary
  // file, so its fault is the primary file's: a leading segment that is one
  // of the site's own language prefixes is taken off before the lookup, and
  // only those — `/de/gear` on a site with no German is still nobody's page.
  const known = new Set((Array.isArray(prefixes) ? prefixes : []).map((x) => String(x || "").replace(/^\/|\/$/g, "")).filter(Boolean));
  const primaryRoute = (route) => {
    const s = String(route || "/");
    const m = s.match(/^\/([^/]+)(\/.*)?$/);
    if (!m || !known.has(m[1])) return s;
    return m[2] || "/";
  };

  const perPage = new Map();
  for (const f of findings) {
    if (!f || !SERIOUS.has(f.kind)) continue;
    const page = byRoute.get(primaryRoute(f.route));
    if (!page) continue;
    if (!perPage.has(page.path)) perPage.set(page.path, { page, kinds: new Set(), details: [] });
    const e = perPage.get(page.path);
    e.kinds.add(f.kind);
    // DISTINCT DETAILS ONLY. The same crash at two widths is one sentence; two
    // genuinely different errors on one page are both worth sending.
    const d = String(f.detail == null ? "" : f.detail).trim();
    if (d && !e.details.includes(d)) e.details.push(d);
  }

  const all = [...perPage.values()].map((e) => ({
    path: e.page.path,
    route: routeOf(e.page.path),
    source: e.page.source,
    instruction: instructionFor(e.kinds, e.details),
  }));

  return { work: all.slice(0, MAX_REPAIRS), dropped: Math.max(0, all.length - MAX_REPAIRS) };
}

/**
 * The finding, turned into something a model can act on.
 *
 * THE DETAIL IS THE WHOLE VALUE and is passed through rather than summarised.
 * On the measured case it is `useFormField should be used within <FormItem>` —
 * which names the fault, the component and the fix in six words. Anything this
 * function did to "tidy" that would be throwing away the only part worth
 * sending.
 */
export function instructionFor(kinds, details) {
  const k = kinds instanceof Set ? kinds : new Set(Array.isArray(kinds) ? kinds : []);
  const d = (Array.isArray(details) ? details : []).filter(Boolean).slice(0, 3);
  const lead = k.has("threw")
    ? "A real browser opened this page and it crashed."
    : "A real browser opened this page and nothing rendered.";
  return d.length
    ? lead + "\n\n" + d.map((x) => "- " + String(x).slice(0, 400)).join("\n")
    : lead;
}

/**
 * One cheap attempt per broken page.
 *
 * NEVER THROWS, and that is the same contract `runTweak` carries one level
 * down. This sits in front of a build that has already succeeded — the pages
 * compiled, the site is about to publish — so a failure here has exactly one
 * correct outcome: publish what we have. An exception escaping would turn "the
 * repair was unavailable" into "the build failed", which is far worse than not
 * having built it.
 *
 * THE PAGES COME BACK WHOLE, changed or not, so the caller can hand the result
 * straight to a recompile without merging anything. A page this rung refused is
 * byte-identical to the one that went in.
 *
 * IN PARALLEL, because each call reads a different file and writes a different
 * file — there is nothing to serialise. Three Haiku calls at once cost the same
 * as three in a row and finish in a third of the time, which matters on a build
 * already at ~9 minutes against a 15-minute consumer ceiling.
 */
export async function repairPages({ report, pages, send, model, prefixes } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const out = { pages: list, repaired: [], refused: [], usage: [], dropped: 0 };
  if (typeof send !== "function") return out;

  const brief = repairBrief(report, list, { prefixes });
  out.dropped = brief.dropped;
  if (!brief.work.length) return out;

  const results = await Promise.all(brief.work.map(async (w) => {
    // SIZE IS CHECKED BEFORE PAYING, which `runTweak` also does — kept here as
    // well so the refusal is reported against the page by name rather than as
    // an anonymous `too-big` in a list.
    if (typeof w.source !== "string" || w.source.length > MAX_TWEAK_CHARS) {
      return { w, res: { ok: false, reason: "too-big", usage: null } };
    }
    let res;
    try {
      res = await runTweak({
        instruction: w.instruction,
        path: w.route || w.path,
        source: w.source,
        send,
        rules: REPAIR_RULES,
        heading: "WHAT WENT WRONG",
        // THE PICKED MODEL, when the caller names one (the addon's `quick`
        // slot); `runTweak`'s own default otherwise, which is what the build
        // has always sent. Every small call follows the picker (2026-08-31).
        ...(model ? { model } : {}),
      });
    } catch (e) {
      // `runTweak` documents that it never throws. Held anyway, and said so
      // rather than left looking load-bearing: this is one `await` inside a
      // `Promise.all`, so a rejection here would take the whole repair down and
      // with it a build that had already succeeded.
      res = { ok: false, reason: "send", usage: null, error: e };
    }
    return { w, res };
  }));

  const fixed = new Map();
  for (const { w, res } of results) {
    // THE USAGE IS KEPT ON EVERY PATH, refusals included — the call really
    // happened and the customer is charged for what was used, which is the rule
    // the whole billing tier is built on.
    if (res && res.usage) out.usage.push(res.usage);
    if (res && res.ok && typeof res.source === "string") {
      fixed.set(w.path, res.source);
      out.repaired.push({ path: w.path, route: w.route });
    } else {
      out.refused.push({ path: w.path, route: w.route, reason: (res && res.reason) || "unknown" });
    }
  }

  if (fixed.size) out.pages = list.map((p) => (p && fixed.has(p.path) ? { ...p, source: fixed.get(p.path) } : p));
  return out;
}

/**
 * What the customer is told, and it is deliberately quiet.
 *
 * A REPAIR IS NOT AN ACHIEVEMENT TO ANNOUNCE. The customer asked for a website;
 * that one page needed a second pass is our business, not theirs, and a line
 * saying so invites them to go and look for damage on a page that is now fine.
 * Empty string on the ordinary path, so a build that repaired nothing — and a
 * build that repaired something successfully — read identically.
 *
 * WHAT DOES GET SAID is the case where a page is still broken after the
 * attempt, because that is a thing they can act on: they can ask for that page
 * again. Named, since "something is wrong somewhere" is not actionable.
 */
export function repairNote(result) {
  const r = result && typeof result === "object" ? result : null;
  if (!r) return "";
  const stuck = (Array.isArray(r.refused) ? r.refused : []).map((x) => x && x.route).filter(Boolean);
  if (!stuck.length) return "";
  return stuck.length === 1
    ? `One page — ${stuck[0]} — isn't rendering properly. Ask me to rebuild it and I'll have another go.`
    : `Some pages aren't rendering properly (${stuck.slice(0, 3).join(", ")}). Ask me to rebuild them and I'll have another go.`;
}

/**
 * THE REPAIR ROUND ON THE PUBLISH SPINE (owner, 2026-09-04: *"try to fix it,
 * if not fix, send as it is"*).
 *
 * Run 34's gear addon published a page the render check had just watched crash
 * — the build has this pass (`publishPages`, `deps.repair`) and the addon, which
 * publishes through `recompileAndPublish`, did not: the spine's reason for the
 * EDIT lanes getting none ("re-checking pages the customer just changed by
 * hand") was written before an addon existed, and an addon's page is a page a
 * model just wrote, exactly as a build's. So the decision lives here, where it
 * can be driven with fakes, and the spine only calls it and reads the answer.
 *
 * FOUR ANSWERS, EACH NAMED, so the caller can say which happened:
 *   - `ran: false, why: "no-report"`  the check could not run — nothing to act on
 *   - `ran: false, why: "clean"`      nothing serious on a page this publish wrote
 *   - `ran: false, why: "time"`       there is work, and the job's clock cannot fit
 *                                     a model call, a compile and the publish; the
 *                                     routes are named and NOTHING is spent
 *   - `ran: true`                     the calls were made; `built` is the second
 *                                     compile when it succeeded (ship that, store
 *                                     those pages), null when it did not (ship the
 *                                     original — never worse than not trying),
 *                                     `failed` naming the stage
 *
 * ONE ATTEMPT AND NEVER THROWS — `publishPages`'s own two rules, for the same
 * reason: this sits in front of a compile that already succeeded, and the only
 * correct outcome of anything going wrong here is to publish what we have.
 *
 * THE USAGE IS KEPT ON EVERY PATH THAT SPENT, refusals and a failed recompile
 * included: the model calls really happened and the ledger prices what was used.
 */
export async function repairRound({ report, pages, send, model, prefixes, compile, room = true } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const r = report && typeof report === "object" ? report : null;
  if (!r || r.ok === false) return { ran: false, why: "no-report", repaired: [], refused: [], usage: [], dropped: 0 };
  const brief = repairBrief(r, list, { prefixes });
  const routes = brief.work.map((w) => w.route || w.path);
  if (!brief.work.length) return { ran: false, why: "clean", repaired: [], refused: [], usage: [], dropped: brief.dropped };
  if (!room) return { ran: false, why: "time", routes, repaired: [], refused: [], usage: [], dropped: brief.dropped };
  if (typeof send !== "function" || typeof compile !== "function") {
    return { ran: false, why: "no-deps", routes, repaired: [], refused: [], usage: [], dropped: brief.dropped };
  }

  let rep;
  try {
    rep = await repairPages({ report: r, pages: list, send, model, prefixes });
  } catch (e) {
    // `repairPages` documents that it never throws; held anyway, because the
    // one thing this must never do is turn a build that succeeded into one
    // that did not.
    return { ran: true, built: null, pages: null, failed: "repair", repaired: [], refused: routes.map((route) => ({ route, reason: "send" })), usage: [], dropped: brief.dropped, error: String((e && e.message) || e).slice(0, 160) };
  }
  const base = { ran: true, repaired: rep.repaired.map((x) => x.route || x.path), refused: rep.refused, usage: rep.usage, dropped: rep.dropped };
  if (!rep.repaired.length) return { ...base, built: null, pages: null, failed: "refused" };

  let second = null;
  try { second = await compile(rep.pages); } catch (e) { second = { ok: false, stage: "compile", error: String((e && e.message) || e) }; }
  if (second && second.ok === true && second.files) return { ...base, built: second, pages: rep.pages };
  return { ...base, built: null, pages: null, failed: String((second && second.stage) || "compile") };
}

/**
 * What the customer is told about the round, in the reply's render sentence.
 *
 * QUIET ON SUCCESS, `repairNote`'s rule: a page that needed a second pass and
 * got one is our business. What IS said is the two cases the customer can act
 * on — a fix that was tried and did not hold, and a fix there was no time to
 * try — each naming the page, each ending "published as it is", because that
 * is the owner's rule and the customer should know the page is up and wrong
 * rather than down.
 */
export function repairRoundNote(round) {
  const x = round && typeof round === "object" ? round : null;
  if (!x) return "";
  const names = (list) => (Array.isArray(list) ? list : []).map((v) => (v && typeof v === "object" ? v.route || v.path : v)).filter(Boolean);
  if (x.ran === false && x.why === "time") {
    const at = names(x.routes);
    return at.length ? `I ran out of time to try a fix for ${at.slice(0, 3).join(", ")}, so it's published as it is.` : "";
  }
  if (x.ran === true && !x.built) {
    const at = names(x.refused).concat(names(x.repaired));
    return at.length ? `I tried a fix for ${at.slice(0, 3).join(", ")} and it didn't hold, so it's published as it was.` : "";
  }
  if (x.ran === true && x.built) {
    // A page the round could not fix beside one it did: the stuck one is
    // named, `repairNote`'s own sentence.
    return repairNote({ refused: x.refused });
  }
  return "";
}
