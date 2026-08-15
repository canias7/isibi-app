// THE AUDIT'S OWN `missed` LIST — the secondary findings that never entered the
// fix pipeline, verified live and fixed.
//
// One theme, and it is not the same as the confirmed findings': every one of
// these is a check or a rule that LOOKS right and answers the wrong question —
// SQL in the wrong dialect, an entity class nobody matched, a preset name
// standing in for a resolved pair, a missing branch, a missing ORDER BY, a stub
// that does not cover what the pages reference. None of them errors. That is why
// they survived an audit's worth of reading and needed measuring.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pageMeta } from "../site-meta.mjs";
import { acceptsVisitorUploads } from "../site-uploads.mjs";
import { dueJobs, MAX_JOBS_PER_TICK } from "../site-jobs.mjs";
import { lintPages } from "../builder/page-gen.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

// ── 1. DROP TRIGGER, in the wrong dialect ───────────────────────────────────

test("every DROP TRIGGER names its table, because Postgres requires it", () => {
  // `DROP TRIGGER [IF EXISTS] name ON table` — the table-less form is SQLite's.
  // The re-apply hygiene loop had no `ON`, so every statement was a syntax error
  // swallowed by a bare catch and the whole step has been dead since the
  // Postgres migration. What it cost is what its own comment describes: turning
  // `audit` or `history` OFF on a revise left the AFTER trigger standing,
  // firing into a side table on every subsequent write.
  //
  // Asserted over EVERY drop in the file rather than the one that was broken —
  // a second one written tomorrow fails the same way and would be just as quiet.
  const src = read("../site-schema.mjs");
  const drops = [...src.matchAll(/"DROP TRIGGER IF EXISTS "[^;]*/g)].map((m) => m[0]);
  assert.ok(drops.length >= 2, `only ${drops.length} DROP TRIGGER statements found — the scan stopped matching`);
  for (const d of drops) {
    assert.match(d, /\+\s*" ON "|\bON\b/, "a DROP TRIGGER with no ON clause is invalid Postgres: " + d.slice(0, 120));
  }
});

// ── 2. character references ─────────────────────────────────────────────────

const doc = (body) => "<html><body>" + body + "</body></html>";
const BASE = { brand: "Fade & Co", description: "A barber shop." };

test("a HEX character reference is decoded, not shipped verbatim", () => {
  // MEASURED, not assumed: this template's React turns "Mo's Cuts & the
  // barber's chair" into `Mo&#x27;s Cuts &amp; the barber&#x27;s chair`, and the
  // old stripper matched `&[a-z]+;` and `&#\d+;` — neither of which touches
  // `&#x27;`. So every share preview and every per-page title derived from
  // prerendered text carried a literal `&#x27;` where an apostrophe belonged.
  const m = pageMeta(doc("<h1>Mo&#x27;s Cuts</h1>"), BASE);
  assert.ok(m.brand.startsWith("Mo's Cuts"), "hex entity survived into the title: " + m.brand);
  assert.ok(!/&#/.test(m.brand), m.brand);
});

test("the references it DID match are decoded rather than blanked", () => {
  // The other half, and it was a different mangling of the same name: matched
  // entities became a SPACE, so "Mo&#39;s Cuts" read as "Mo s Cuts".
  for (const [entity, want] of [["&#39;", "Mo's Cuts"], ["&apos;", "Mo's Cuts"], ["&#x2019;", "Mo’s Cuts"]]) {
    const m = pageMeta(doc("<h1>Mo" + entity + "s Cuts</h1>"), BASE);
    assert.equal(m.brand.split(" · ")[0], want, entity);
  }
  const amp = pageMeta(doc("<h1>Smith &amp; Sons</h1>"), BASE);
  assert.equal(amp.brand.split(" · ")[0], "Smith & Sons", "an ampersand in a trading name is about as ordinary as it gets");
});

test("a nonsense numeric reference is left alone rather than throwing", () => {
  // `String.fromCodePoint` raises on an invalid code point, and this runs on
  // every prerendered page of every publish — a malformed page must cost its own
  // meta at most.
  const m = pageMeta(doc("<h1>Odd &#x110000; and &#99999999; here</h1>"), BASE);
  assert.ok(typeof m.brand === "string" && m.brand.length > 0);
  const p = pageMeta(doc("<p>" + "A description long enough to be used, with &#xZZ; in it and more words after.".padEnd(60) + "</p>"), BASE);
  assert.ok(typeof p.description === "string");
});

test("a decoded angle bracket is safe because the writer escapes", () => {
  // Decode at the reader, escape at the writer. `&lt;script&gt;` is TEXT on the
  // page — it is what React renders for a literal string — so recovering it here
  // is faithful, and `metaTags`/`setTitle` escape it back on the way out.
  const m = pageMeta(doc("<h1>a &lt; b</h1>"), BASE);
  assert.equal(m.brand.split(" · ")[0], "a < b");
});

// ── 3. the pair bug, fourth instance ────────────────────────────────────────

const withPic = (extra) => ({ name: "t", columns: [{ name: "photo_url" }], ...extra });

test("visitor uploads ask the RESOLVED write axis, not the stamped preset", () => {
  // `normalizeSchema` STAMPS `access: "collect"` on any table that did not name
  // a preset, and the design tool tells the model to leave `access` out when it
  // declares a read/write pair — so this read a name nobody wrote. Both
  // directions were wrong.
  //
  // A pair with no writes at all was accepting files:
  assert.equal(acceptsVisitorUploads(withPic({ access: "collect", read: "public", write: "none" })), false,
    "a table nothing can write to accepted an upload");
  // …and a members' gallery — the exact shape this feature is for — was refused:
  assert.equal(acceptsVisitorUploads(withPic({ access: "collect", read: "public", write: "own" })), true,
    "a pair-declared members' gallery was refused");
});

test("the five presets behave exactly as they did", () => {
  // The fix must not move any site built on a preset name. `display` and `admin`
  // are the two whose write axis is `none`.
  for (const [access, want] of [["collect", true], ["user", true], ["feed", true], ["display", false], ["admin", false]]) {
    assert.equal(acceptsVisitorUploads(withPic({ access })), want, access);
  }
});

test("a picture column is still required, whatever the access", () => {
  // The other half of the gate, and it is what keeps this from being open image
  // hosting for anyone who knows a slug.
  assert.equal(acceptsVisitorUploads({ name: "t", access: "collect", columns: [{ name: "note" }] }), false);
  assert.equal(acceptsVisitorUploads(null), false);
});

// ── 4. the useRow lint gap ──────────────────────────────────────────────────

const SPEC = { tables: [{ name: "posts", access: "display", columns: [{ name: "title" }] }] };
const page = (body) => [{ path: "index.tsx", source: 'import { useRow } from "@/lib/rows";\n' + body }];

test("useRow against an undeclared table is reported, like its two siblings", () => {
  // `useRows` and `usePublicRows` both have an `if (!t)` branch and this did not,
  // so `useRow("ghost", id)` was the one table-name typo the lint stayed silent
  // about — the same compiles-then-404s class it catches everywhere else.
  const p = lintPages(page('useRow("ghost", id);'), SPEC).join(" ");
  assert.match(p, /ghost/, "an undeclared table read one row at a time is unreported");
  assert.match(p, /does not declare/);
  // A declared one is still clean, so this is not the check switched on for
  // everything.
  assert.deepEqual(lintPages(page('useRow("posts", id);'), SPEC), []);
});

test("all three read hooks refuse an undeclared table", () => {
  // Asserted together rather than one at a time: the gap existed because the
  // three loops were written separately, and a fourth added later would be just
  // as easy to write without the branch.
  for (const call of ['useRows("ghost")', 'usePublicRows("ghost")', 'useRow("ghost", id)']) {
    const p = lintPages(page("const x = " + call + ";"), SPEC).join(" ");
    assert.match(p, /does not declare/, call + " is not reported");
  }
});

// ── 5. the jobs drain's ordering ────────────────────────────────────────────

const job = (name, lastRun) => ({ owner_id: "u", slug: "s", name, schedule_minutes: 2, last_run: lastRun });

test("the stalest jobs run first, so the cap cannot starve anything", () => {
  // The filter can return more than the cap and the slice takes a fixed number —
  // so in READ ORDER the same first 25 win every tick and everything behind them
  // starves permanently, with each tick reporting a healthy run.
  const now = Date.parse("2026-08-15T12:00:00Z");
  const rows = [];
  for (let i = 0; i < MAX_JOBS_PER_TICK + 10; i++) {
    // Later index = MORE recently run, so read order is the opposite of the
    // right order and a stable slice would pick exactly the wrong ones.
    rows.push(job("j" + i, new Date(now - (60 - i) * 60000).toISOString()));
  }
  const due = dueJobs(rows, now);
  assert.equal(due.length, MAX_JOBS_PER_TICK);
  assert.equal(due[0].name, "j0", "the job that has waited longest did not run first");
  assert.ok(!due.some((r) => r.name === "j" + (rows.length - 1)), "the most recently run job took a slot");
});

test("a never-run job goes to the front", () => {
  // A site that has just been built, ahead of everything already ticking over.
  const now = Date.parse("2026-08-15T12:00:00Z");
  const rows = [
    job("old", new Date(now - 3600000).toISOString()),
    job("fresh", null),
    job("older", new Date(now - 7200000).toISOString()),
  ];
  const due = dueJobs(rows, now);
  assert.equal(due[0].name, "fresh");
  assert.deepEqual(due.map((r) => r.name), ["fresh", "older", "old"]);
});

test("the registry read is ordered too, or the window itself is arbitrary", () => {
  // `limit=200` unordered means that past 200 registered jobs some are never
  // LOOKED at, and the cap then slices an arbitrary window. The read's order and
  // the module's must agree rather than fight.
  const w = read("../worker.js");
  const at = w.indexOf("site_functions?enabled=is.true");
  assert.ok(at > 0, "the drain's registry read moved — rescope this");
  const q = w.slice(at, w.indexOf("`", at));
  assert.match(q, /order=last_run\.asc\.nullsfirst/, "the drain reads an arbitrary 200 rows");
  assert.match(q, /limit=200/, "the ceiling is gone — check the ordering argument still holds");
});

// ── 6 & 7. the render check's stub and its sandbox ──────────────────────────

test("an upload path is served, not 404'd", () => {
  // `/u/…` carries an extension, so it fell through to the asset branch and
  // 404'd out of the dist — a console error and a broken image on every
  // picture-led site AND every site with a logo, in a verdict that goes to the
  // customer. A false alarm, which this repo rates worse than the miss.
  const src = read("../builder/render-check.mjs");
  assert.match(src, /if \(p\.startsWith\("\/u\/"\)\)/, "uploads 404 inside the render check again");
  // A REAL IMAGE rather than a 204: the contrast pass asks whether text sits
  // over a picture, and a body-less response leaves nothing for it to see.
  const at = src.indexOf('p.startsWith("/u/")');
  const branch = src.slice(at, src.indexOf("\n    }", at));
  assert.match(branch, /image\/png/, "the upload stub no longer answers with an image");
  assert.match(branch, /ONE_PIXEL/, "the upload stub has no body");
});

test("the sandbox verdict is the ROOT check, never a launch outcome", async () => {
  // THE CORRECTION THAT MATTERS MOST HERE. A first draft "tried" a sandboxed
  // launch and reported success — and Playwright adds `--no-sandbox` ITSELF when
  // the parent is root, so the attempt always succeeded and the browser was
  // unsandboxed anyway. Measured against a real browser: launch with no
  // `--no-sandbox` in the arguments, ask the spawned process for its real argv,
  // and the flag is there. That draft would have shipped an unsandboxed browser
  // wearing `sandboxed: true` — strictly worse than the honest flag it replaced.
  //
  // So the verdict comes from the condition that decides it, and this asserts
  // exactly that rather than a launch result nothing can trust.
  const { chromiumSandboxed } = await import("../builder/render-check.mjs");
  assert.equal(typeof chromiumSandboxed(), "boolean");
  if (typeof process.getuid === "function") {
    assert.equal(chromiumSandboxed(), process.getuid() !== 0,
      "the verdict disagrees with the one thing that decides it");
  }
  const src = read("../builder/render-check.mjs");
  const at = src.indexOf("export async function launchChromium");
  assert.ok(at > 0, "launchChromium is gone — the flag is unconditional again");
  const body = src.slice(at, src.indexOf("\n}", at));
  assert.ok(body.length > 150, "the launchChromium window is empty — rescope this");
  assert.match(body, /chromiumSandboxed\(\)/, "the launch stopped asking, so the report is a guess");
  // The flag is still passed when we ARE root — Playwright would add it anyway,
  // so nothing new can fail, and omitting it would be a change with no benefit.
  assert.match(body, /"--no-sandbox"/, "root without the flag is a browser that refuses to start");
  // A try/catch here is what produced the false positive; there must not be one.
  assert.doesNotMatch(body, /catch/, "a fallback launch is back — that is what reported an unsandboxed browser as sandboxed");
});

test("the reported verdict agrees with the arguments actually sent", async () => {
  // THE GAP THE SWEEP FOUND, and it is this round's own defect one more time:
  // the source can compute the right answer and RETURN a different one.
  // Hardcoding `sandboxed: true` in the return survived everything above —
  // the verdict function was still correct, still called, and its answer
  // discarded.
  //
  // What has to hold is that the flag and the argv cannot disagree: a report
  // saying "sandboxed" while `--no-sandbox` went to the browser is precisely the
  // false reassurance the first draft shipped. Driven with a fake `chromium`, so
  // it needs no browser and asserts on what would really have been passed.
  const { launchChromium, chromiumSandboxed } = await import("../builder/render-check.mjs");
  let got = null;
  const fake = { launch: async (opts) => { got = opts; return { closed: false }; } };
  const out = await launchChromium(fake);
  assert.ok(got && Array.isArray(got.args), "launchChromium did not pass args at all");
  const flagged = got.args.includes("--no-sandbox");
  assert.equal(out.sandboxed, !flagged,
    `reported sandboxed=${out.sandboxed} while --no-sandbox was ${flagged ? "" : "not "}passed`);
  assert.equal(out.sandboxed, chromiumSandboxed(), "the launch reports something other than the verdict");
});

test("a report says when the browser was NOT sandboxed, and is silent when it was", async () => {
  // The `prerenderUnprivileged` rule: carried only when false, so an ordinary
  // report is byte-identical and the field's PRESENCE is the alarm.
  const { renderReport } = await import("../builder/site-render.mjs");
  assert.equal(Object.hasOwn(renderReport([], { ok: true }), "sandboxed"), false,
    "every report now claims a sandbox state, so the alarm is noise");
  assert.equal(Object.hasOwn(renderReport([], { ok: true, sandboxed: true }), "sandboxed"), false);
  assert.equal(renderReport([], { ok: true, sandboxed: false }).sandboxed, false,
    "an unsandboxed run reports as though it were confined");
});

test("both report returns carry the sandbox verdict", () => {
  // The wiring layer, where this repo has recorded twelve dead features: the
  // module is correct and unread if `checkRender` computes the flag and drops it.
  const src = read("../builder/render-check.mjs");
  const returns = [...src.matchAll(/renderReport\(seen, \{([^}]*)\}\)/g)].map((m) => m[1]);
  assert.ok(returns.length >= 2, `only ${returns.length} report returns found — the scan stopped matching`);
  for (const args of returns) {
    assert.match(args, /\bsandboxed\b/, "a report return drops the sandbox verdict: {" + args + "}");
  }
});

// ── the last two raw-access reads in schemaDigest ───────────────────────────

test("a team table declared as a PAIR is still described as shared", async () => {
  // THE PAIR BUG, fifth instance and the consequential one. `normalizeSchema`
  // stamps `access: "collect"` on any table that did not name a preset, and the
  // design tool tells the model to leave `access` out when it declares a pair —
  // so a team table spelled `{read:"own", write:"own"}` arrived at this gate
  // wearing "collect", the SHARED WITH THE TEAM line was never printed, and the
  // generator wrote "your notes" on a table the whole team reads and edits.
  const { schemaDigest } = await import("../builder/page-gen.mjs");
  const table = { name: "notes", columns: [{ name: "body" }], teamScope: true };
  const asPreset = schemaDigest({ tables: [{ ...table, access: "user" }] });
  const asPair = schemaDigest({ tables: [{ ...table, access: "collect", read: "own", write: "own" }] });
  assert.match(asPreset, /SHARED WITH THE TEAM/, "the preset form stopped saying it");
  assert.match(asPair, /SHARED WITH THE TEAM/, "a pair-declared team table is described as private");
});

test("one fact is stated the same way however the access was spelled", async () => {
  // The line below the team one had it too: a pair-declared display table was
  // stamped "collect" and got a `usePublicRows` line its preset-declared twin
  // does not. Harmless in itself and exactly the inconsistency that makes a
  // digest untrustworthy — the model is told a different thing about two tables
  // that behave identically.
  const { schemaDigest } = await import("../builder/page-gen.mjs");
  const table = { name: "menu", columns: [{ name: "dish" }] };
  const asPreset = schemaDigest({ tables: [{ ...table, access: "display" }] });
  const asPair = schemaDigest({ tables: [{ ...table, access: "collect", read: "public", write: "none" }] });
  assert.equal(/usePublicRows:/.test(asPreset), /usePublicRows:/.test(asPair),
    "the same table described two ways depending on how it was spelled");
});

test("the stamped preset is not even bound in the digest's scope", () => {
  // THE FIX, rather than a tidy-up. A variable holding the preset a table never
  // declared, in the one function that describes tables to the model, is a trap
  // that has been fallen into once per reader — six times across this file. With
  // nothing to reach for, the mistake cannot be made here again.
  //
  // ANCHORED AT THE TOP OF THE CALLBACK, not at `const rw`. Sliced from `rw` the
  // window opens BELOW the line a re-binding would be inserted on, so the mutant
  // that puts `const access` back sat outside it and survived — my own
  // overlapping-window bug, in the guard written to stop the thing it missed.
  const src = read("../builder/page-gen.mjs");
  const at = src.indexOf("const tableLines = tables.map((t) => {");
  assert.ok(at > 0, "the digest's table loop moved — rescope this");
  const body = src.slice(at, src.indexOf("return lines", at));
  assert.ok(body.length > 2000, "the digest window is small — rescope this");
  const code = body.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.doesNotMatch(code, /const access\s*=/, "the stamped preset is bound in this scope again");
  assert.doesNotMatch(code, /(?<![.\w$])access\s*===/, "a gate reads the stamped preset again");
});

// ── the three stale claims ──────────────────────────────────────────────────

test("the clarify gate's comment names the intent it actually resolves to", async () => {
  // `FALLBACK_WITH_SITE` is `addon`, so a gated clarify on an existing site —
  // which is every revise, i.e. exactly where the gate is closed — is overruled
  // into an ADDON, not a build. Right either way (both are work, never a
  // paragraph); the sentence named the one it is not.
  const { FALLBACK_WITH_SITE, readRouting } = await import("../builder/site-ask.mjs");
  const reply = { content: [{ type: "tool_use", input: { intent: "clarify", question: { text: "?", options: ["a", "b"] } } }] };
  assert.equal(readRouting(reply, { canClarify: false, hasSite: true }).intent, FALLBACK_WITH_SITE);
  assert.equal(FALLBACK_WITH_SITE, "addon", "the fallback moved — re-read the comment beside the gate");
  const src = read("../builder/site-ask.mjs");
  const at = src.indexOf("CLARIFY IS GATED BY THE CALLER");
  assert.ok(at > 0, "the gate comment is gone — rescope this");
  const note = src.slice(at, src.indexOf("if (input.intent === \"clarify\"", at));
  assert.doesNotMatch(note, /simply overruled into a build/, "the stale claim is back");
});

test("the seeding note no longer says an owner-write route does not exist", () => {
  // It does — `handleOwnerWrite`, whose own docstring says it closes exactly
  // that gap. The seeding CONCLUSION is untouched and still right: a café should
  // not have to type its whole menu into a data panel before the site is worth
  // showing anybody.
  const schema = read("../site-schema.mjs");
  const owner = read("../site-owner.mjs");
  assert.match(owner, /export async function handleOwnerWrite/, "the owner-write route is gone — the old note was right after all");
  assert.doesNotMatch(schema, /no\s*\n?\/\/ owner-write route exists|no owner-write route exists/,
    "the seeding note claims a route that exists does not");
  assert.match(schema, /Starter content for the tables a visitor READS/, "the seeding note is gone — rescope this");
});

test("build-smoke does not promise that a revise buys no photographs", () => {
  // `budgetFor` replaced the flat `revise ? 0` rule: a revise on a site that
  // shows NO photograph buys them, which is exactly a smoke site whose first
  // build could not afford any. The comment guarded a real fal bill.
  const src = read("../test/integration/build-smoke.mjs");
  assert.doesNotMatch(src, /A revise buys none, so funding this one cannot/, "the stale guarantee is back");
  assert.match(src, /budgetFor/, "the note no longer says what replaced the old rule");
});
