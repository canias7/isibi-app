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
import { buildRepairOn } from "./visual-review.mjs";

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
export function repairBrief(report, pages, opts = null) {
  // UNDER `BUILD_REPAIR` (2026-10-22, ideas #12/#13): `runtime` adds the
  // route's structured browser errors and the named cause to the instruction,
  // and `tried` leaves out a page whose failure was already tried this build.
  // Without opts the brief is exactly what it was.
  const runtime = !!(opts && opts.runtime);
  const tried = opts && opts.tried instanceof Set ? opts.tried : null;
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

  const perPage = new Map();
  for (const f of findings) {
    if (!f || !SERIOUS.has(f.kind)) continue;
    const page = byRoute.get(String(f.route || "/"));
    if (!page) continue;
    if (!perPage.has(page.path)) perPage.set(page.path, { page, kinds: new Set(), details: [] });
    const e = perPage.get(page.path);
    e.kinds.add(f.kind);
    // DISTINCT DETAILS ONLY. The same crash at two widths is one sentence; two
    // genuinely different errors on one page are both worth sending.
    const d = String(f.detail == null ? "" : f.detail).trim();
    if (d && !e.details.includes(d)) e.details.push(d);
  }

  const all = [...perPage.values()].map((e) => {
    const route = routeOf(e.page.path);
    const base = instructionFor(e.kinds, e.details);
    const extra = runtime ? runtimeLines(r, route) : "";
    const w = { path: e.page.path, route, source: e.page.source, instruction: extra ? base + "\n\n" + extra : base };
    if (runtime || tried) w.signature = failureSignature(e.page.path, [...e.kinds].sort().join(",") + " " + e.details.join(" | "));
    return w;
  }).filter((w) => !(tried && tried.has(w.signature)));

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
export async function repairPages({ report, pages, send, runtime = false, tried = null } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const out = { pages: list, repaired: [], refused: [], usage: [], dropped: 0 };
  if (typeof send !== "function") return out;

  const brief = runtime || tried ? repairBrief(report, list, { runtime, tried }) : repairBrief(report, list);
  out.dropped = brief.dropped;
  if (!brief.work.length) return out;
  if (tried instanceof Set) for (const w of brief.work) if (w.signature) tried.add(w.signature);

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

// ══ THE BUILD REPAIR (2026-10-22, owner-approved ideas #11, #12, #13) ════════
//
// #11: a page that will not COMPILE gets ONE try at a fix from the build's own
// pages model before salvage stubs it — its source and the exact compile
// errors for that file in, a fixed page out, one recompile. Never worse: a
// fix that does not compile leaves salvage to do exactly what it did before.
// The runtime half (a page that compiles and crashes in the browser) is the
// repair pass above, extended rather than duplicated: under the switch its
// instruction carries the route's structured browser errors (#12).
//
// #13: the instruction names the real cause where the message shows one
// (`namedCause`), never a symptom, and a page whose failure signature was
// already tried in this build is never tried again (`failureSignature`).
//
// BEHIND A SWITCH, OFF BY DEFAULT: `BUILD_REPAIR`, read the way
// `VISUAL_REVIEW` is. Off, `publishPages` gets no `compileRepair` and the
// render repair's instruction is byte-identical to what it was.

// The switch lives beside `visualReviewOn` in `visual-review.mjs`: the Worker
// must not import this module (`test/spine-repair.test.mjs`), so it reads the
// switch there; re-exported here for this module's readers.
export { buildRepairOn };

/** How much of a compile error one page's instruction carries. */
export const MAX_COMPILE_ERROR = 2000;

/**
 * What one failure IS, stripped of what changes between two runs of the same
 * fault: line and column numbers, the container's working directory, hashes
 * and runs of whitespace. Two failures with one signature are one failure, and
 * the second is never paid for.
 */
export function failureSignature(path, message) {
  const m = String(message == null ? "" : message)
    .replace(/(?:\/[\w.@-]+)*\/src\//g, "src/")
    .replace(/\b[0-9a-f]{8,}\b/gi, "#")
    .replace(/[:(]\d+(?:[:,]\d+)?\)?/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 400);
  return String(path || "") + "\u0000" + m;
}

/**
 * THE REAL CAUSE, NAMED, where the message shows it — or null, and then the
 * raw error is all the model gets (a guess here would be worse than nothing).
 * Each rule reads a form the tools really print; the sentence says what is
 * wrong in the page, not what the bundler tripped over.
 */
export function namedCause(message) {
  const t = String(message == null ? "" : message);
  let m;
  if ((m = t.match(/"([^"]+)" is not exported by "([^"]+)"/)))
    return `The page imports \`${m[1]}\` from \`${shortPath(m[2])}\`, and that module has no export by that name. Import a name it does export, or stop using \`${m[1]}\`.`;
  if ((m = t.match(/Module ['"]+([^'"]+)['"]+ has no exported member ['"]([^'"]+)['"]/)))
    return `The page imports \`${m[2]}\` from \`${shortPath(m[1])}\`, and that module has no export by that name. Import a name it does export, or stop using \`${m[2]}\`.`;
  if ((m = t.match(/(?:failed to resolve import|Could not resolve) ["']([^"']+)["']/i)) || (m = t.match(/Cannot find module ['"]([^'"]+)['"]/)))
    return `The module \`${m[1]}\` does not exist in this project. Import from a module that exists, or remove the import and what uses it.`;
  if ((m = t.match(/Identifier ['"]([^'"]+)['"] has already been declared/)) || (m = t.match(/Duplicate identifier ['"]([^'"]+)['"]/)))
    return `\`${m[1]}\` is declared twice in the page (often an import repeated). Keep exactly one.`;
  if ((m = t.match(/\b([A-Za-z_$][\w$]*) is not defined\b/)) || (m = t.match(/Cannot find name ['"]([^'"]+)['"]/)))
    return `\`${m[1]}\` is used but never imported or defined in the page. Import it from where it lives, or stop using it.`;
  if ((m = t.match(/Cannot read propert(?:y|ies) of (undefined|null) \(reading ['"]([^'"]+)['"]\)/)))
    return `The page reads \`.${m[2]}\` off a value that is ${m[1]} when it first renders (often before data arrives). Guard it.`;
  if ((m = t.match(/\b(use[A-Z]\w*) (?:must|should) be used within (?:an? )?<?([\w.]+)>?/)))
    return `\`${m[1]}\` is called outside the \`${m[2]}\` it needs around it. Wrap that part of the page in \`${m[2]}\`.`;
  // A BUNDLER LINE THAT NAMES A FILE BUT WHOSE FAULT IS INSIDE IT. "Error
  // transforming route file /app/src/routes/x.tsx" reads like a path problem;
  // the SyntaxError after it is the cause.
  if ((m = t.match(/Error transforming route file \S+?:?\s+(SyntaxError:[^\n]+)/)))
    return `The file's path is fine; the fault is inside it: ${m[1].trim().slice(0, 200)}`;
  // A PATH THE ROUTER OR BUNDLER CANNOT USE is the file's fault, not its code's.
  if (/ENOENT|no such file or directory|Invalid route path/i.test(t))
    return "The error is about a file path, not the code: an import names a file that is not there, or the route path is not valid.";
  if ((m = t.match(/(?:SyntaxError|ERROR): ([^\n]+)/)))
    return `The page has a syntax error: ${m[1].trim().slice(0, 200)}. Fix the code at that place.`;
  return null;
}
function shortPath(p) {
  const s = String(p || "");
  const at = s.lastIndexOf("/src/");
  return at >= 0 ? s.slice(at + 1) : s;
}

/** The lines of a multi-line compile output that belong to one file. */
export function errorsForFile(text, file) {
  const bare = String(file || "").replace(/^(?:src\/)?routes\//, "");
  if (!bare) return "";
  const lines = String(text || "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("routes/" + bare)) continue;
    out.push(lines[i]);
    // tsc's continuation lines are indented under the line that names the file.
    for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]) && !/routes\//.test(lines[j]); j++) out.push(lines[j]);
  }
  return out.join("\n").slice(0, MAX_COMPILE_ERROR);
}

/**
 * What the compile repair model is told: the repair pass's own rules (same
 * words, same address) for the other fault — the file did not build.
 */
export const COMPILE_REPAIR_RULES =
  "You are fixing ONE file of a small business's website that DID NOT BUILD. The compiler's exact errors are below, " +
  "and where the real cause is clear it is named first.\n\n" +
  "FIX WHAT STOPS IT BUILDING AND NOTHING ELSE. Everything else comes back exactly as it went in — the same words, " +
  "the same order, the same formatting. You are not reviewing or improving this file.\n\n" +
  "DO NOT CHANGE ANY OF THE WORDS A VISITOR READS. This is checked, and a file that comes back with different wording " +
  "is thrown away.\n\n" +
  "DO NOT CHANGE THE PAGE'S ADDRESS. The `createFileRoute(\"…\")` line stays exactly as it is.\n\n" +
  "Import only names the module really exports; if a component does not exist, use plain elements in its place. " +
  "If you genuinely cannot see how to make it build, answer `cannot` and the page is replaced with a placeholder.";

/** One page's compile instruction: the cause where it is clear, then the tools' own words. */
export function compileInstruction({ path, error, typeErrors, cited } = {}) {
  const viteFor = errorsForFile(error, path);
  const tscFor = errorsForFile(typeErrors, path);
  const own = String(error || "").slice(0, MAX_COMPILE_ERROR);
  const cause = namedCause(own) || namedCause(tscFor);
  const parts = ["This page did not build."];
  if (cause) parts.push("THE CAUSE: " + cause);
  parts.push("THE BUNDLER SAID:\n" + own);
  if (tscFor) parts.push("THE TYPE CHECKER SAID ABOUT THIS FILE:\n" + tscFor);
  if (Array.isArray(cited) && cited.length) parts.push("THE LINES IT POINTS AT:\n" + cited.slice(0, 4).join("\n"));
  return { text: parts.join("\n\n"), signature: failureSignature(path, viteFor || own), cause };
}

/**
 * The pages a failed compile names that this build wrote, each with its
 * instruction — capped at MAX_REPAIRS, a page already tried with the same
 * signature left out (reported, never silently).
 */
export function compileBrief({ error, typeErrors, pages, cited, tried, citations } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const byPath = new Map(list.filter((p) => p && typeof p.path === "string").map((p) => [p.path, p]));
  const seen = new Set();
  const work = [];
  const skipped = [];
  for (const c of Array.isArray(citations) ? citations : []) {
    const bare = String((c && c.file) || "").replace(/^(?:src\/)?routes\//, "");
    const page = byPath.get(bare);
    if (!page || seen.has(bare)) continue;
    seen.add(bare);
    const ins = compileInstruction({ path: bare, error, typeErrors, cited: (Array.isArray(cited) ? cited : []).filter((l) => String(l).startsWith(bare + ":")) });
    if (tried instanceof Set && tried.has(ins.signature)) { skipped.push({ path: bare, reason: "same-error" }); continue; }
    work.push({ path: bare, route: routeOf(bare), source: page.source, instruction: ins.text, signature: ins.signature, cause: ins.cause });
  }
  return { work: work.slice(0, MAX_REPAIRS), dropped: Math.max(0, work.length - MAX_REPAIRS), skipped };
}

/**
 * ONE try per page that did not build, on the build's own pages model. Never
 * throws; the pages come back whole; usage rides back on every path; each
 * page's signature is recorded in `tried` BEFORE the call, so nothing in this
 * build pays for that failure again.
 */
export async function compileRepairPages({ error, typeErrors, pages, cited, citations, send, model, tried } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const out = { pages: list, repaired: [], refused: [], skipped: [], usage: [], dropped: 0, causes: [] };
  if (typeof send !== "function") return out;
  const brief = compileBrief({ error, typeErrors, pages: list, cited, citations, tried });
  out.dropped = brief.dropped;
  out.skipped = brief.skipped;
  if (!brief.work.length) return out;
  const results = await Promise.all(brief.work.map(async (w) => {
    if (tried instanceof Set) tried.add(w.signature);
    if (w.cause) out.causes.push({ path: w.path, cause: w.cause.slice(0, 200) });
    if (typeof w.source !== "string" || w.source.length > MAX_TWEAK_CHARS) return { w, res: { ok: false, reason: "too-big", usage: null } };
    let res;
    try {
      res = await runTweak({ instruction: w.instruction, path: w.route || w.path, source: w.source, send, rules: COMPILE_REPAIR_RULES, heading: "WHY IT DID NOT BUILD", ...(model ? { model } : {}) });
    } catch (e) { res = { ok: false, reason: "send", usage: null, error: e }; }
    return { w, res };
  }));
  const fixed = new Map();
  for (const { w, res } of results) {
    if (res && res.usage) out.usage.push(res.usage);
    if (res && res.ok && typeof res.source === "string") { fixed.set(w.path, res.source); out.repaired.push({ path: w.path, route: w.route }); }
    else out.refused.push({ path: w.path, route: w.route, reason: (res && res.reason) || "unknown" });
  }
  if (fixed.size) out.pages = list.map((p) => (p && fixed.has(p.path) ? { ...p, source: fixed.get(p.path) } : p));
  return out;
}

/**
 * The route's structured browser errors (#12) as instruction lines, for the
 * render repair under the switch: kind, message, where it was thrown, and the
 * cause where it is clear (#13).
 */
export function runtimeLines(report, route) {
  const errs = (report && Array.isArray(report.runtimeErrors) ? report.runtimeErrors : []).filter((e) => e && e.route === route);
  if (!errs.length) return "";
  const lines = errs.slice(0, 5).map((e) => "- " + e.kind + ": " + String(e.message).slice(0, 300) + (e.source ? " (at " + e.source + ")" : ""));
  const cause = errs.map((e) => namedCause(e.message)).find(Boolean);
  return (cause ? "THE CAUSE: " + cause + "\n\n" : "") + "THE BROWSER'S ERRORS ON THIS PAGE:\n" + lines.join("\n");
}
