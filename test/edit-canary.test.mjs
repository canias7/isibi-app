// The canary harness itself.
//
// ── WHY A HARNESS GETS GUARDS ─────────────────────────────────────────────
//
// Because this one passed while testing nothing, and reported it as a pass.
//
// On 2026-09-01 the paid canary POSTed its edit with `layer: ""` and got a
// complete, clean round trip: 202 in 1.0s, queued, claimed, replayed, terminal
// in 7.9s, no errors anywhere. It had made no model call, run no lane, compiled
// nothing and published nothing — the edit route does not decide its own layer,
// `/api/site/route` does, and an edit posted without one matches none of the
// nine rungs and falls through to `escalate("layer")` for cost 0.
//
// Nothing about that run looked wrong. That is the whole reason these exist: a
// green harness proves the path it took, not the path it was meant to take, and
// the only defence is to make the harness refuse rather than to hope.
//
// SOURCE-READ, because the script signs in and spends money at import — there
// is nothing to drive. So each case is anchored on a property with both
// landmarks proved, never on an argument list.
import test from "node:test";
import assert from "node:assert/strict";
import fs, { readFileSync } from "node:fs";

const RAW = readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8");

/** Comments blanked, length preserved, string-aware — see edit-poll.test.mjs. */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const SRC = blankComments(RAW);

// NOT OPTIONAL HERE EITHER: every comment in that file explains the empty-layer
// failure, so a raw read finds `layer: ""` in prose and reports the fix as the
// bug. The "prose contains the thing it forbids" trap, tenth-odd instance.
test("the comment blanker leaves strings alone", () => {
  const sample = "const a = 'layer: \"\"'; // layer: \"\"\nconst b = 1;\n";
  const out = blankComments(sample);
  assert.ok(out.includes("'layer: \"\"'"), "the blanker ate a string");
  assert.equal(out.split("\n")[0].indexOf("//"), -1, "the blanker stopped blanking comments");
  assert.equal(out.length, sample.length, "the blanker no longer preserves offsets");
});

/**
 * The paid half only — the free checks legitimately post an empty instruction.
 *
 * ⚠ ANCHORED ON THE SECTION'S OWN HEADING, NOT ON A LINE OF CODE. This used to
 * open at `const before = await fetch(`, the balance read — which stopped being
 * a `fetch(` the moment that read was lifted into a function so the FREE half
 * could print the balance too, and five cases went red about a change that
 * touched none of what they assert. A landmark that is a line of code is a
 * claim about how that line is spelled; the heading is a claim about where the
 * paid half begins, which is what every case below actually means.
 */
const PAID_MARK = "PAID CANARY EDIT";
function paidHalf() {
  const at = SRC.indexOf(PAID_MARK);
  assert.ok(at > 0, "the paid half's opening landmark is gone");
  return SRC.slice(at);
}

test("the paid edit asks the router for its layer before it spends", () => {
  const paid = paidHalf();
  const routed = paid.indexOf('"/api/site/route"');
  const posted = paid.indexOf("/edit`");
  assert.ok(routed > 0, "the canary no longer routes — it cannot know which rung to ask for");
  assert.ok(posted > 0, "the canary no longer posts an edit at all");
  assert.ok(routed < posted, "the edit is posted before the router has named a layer");
});

test("the paid edit carries every field the router decided", () => {
  const paid = paidHalf();
  const at = paid.indexOf("/edit`");
  const body = paid.slice(at, paid.indexOf("console.log", at));
  // `layer` is the one that broke; the rest are carried because a canary that
  // only forwards today's field breaks the day its instruction routes to a rung
  // that needs one of the others. `siteEdit` sends all five.
  for (const f of ["layer", "page", "remove", "rename", "tab"]) {
    assert.ok(new RegExp("\\b" + f + ":").test(body), `the edit POST drops \`${f}\``);
  }
  assert.match(body, /rd\.layer/, "the layer is not taken from the router's answer");
  // AND NOT HARDCODED. A canary that names its own layer stops testing the
  // routing hop that failed, which is the one thing it now exists to cover.
  assert.doesNotMatch(body, /layer:\s*["'](look|page|data|text|nav)["']/,
    "the canary picks its own layer instead of asking");
});

test("no layer means no spend, and it is a refusal rather than a guess", () => {
  const paid = paidHalf();
  const gate = paid.indexOf("REFUSING TO SPEND");
  const posted = paid.indexOf("/edit`");
  assert.ok(gate > 0, "the canary no longer refuses to spend without a layer");
  assert.ok(gate < posted, "the refusal comes after the edit has already been posted");
  const branch = paid.slice(paid.lastIndexOf("if (", gate), gate);
  assert.match(branch, /rd\.intent !== "edit"/, "an answer that is not an edit still buys an edit");
  assert.match(branch, /!rd\.layer/, "a missing layer still buys an edit");
  assert.match(paid.slice(gate, gate + 400), /process\.exit\(1\)/,
    "the refusal does not actually stop the run");
});

test("a terminal answer is not a pass — the edit has to have published", () => {
  const paid = paidHalf();
  // THE OTHER HALF OF THE SAME LESSON. The broken run DID reach a terminal
  // state, in 7.9 seconds, and exited 0. `done` certifies the transport; only
  // `ok: true` certifies that a rung ran, compiled and published.
  const exit = paid.lastIndexOf("process.exit(");
  assert.ok(exit > 0, "the canary no longer sets an exit code");
  const tail = paid.slice(exit);
  assert.match(tail, /published/, "the exit code no longer depends on the edit having published");
  assert.doesNotMatch(tail, /process\.exit\(done \?/,
    "a terminal answer counts as a pass again — that is what the broken run returned");
  assert.match(paid, /const published = [^;]*\.ok === true/,
    "publication is judged by something other than the reply's own ok flag");
});

// ── THE PREFLIGHT, AND THE CONTROL THAT WENT STALE UNDER IT ────────────────
//
// `shaMatches` is a pure top-level declaration, so it is CUT AND DRIVEN rather
// than read: a source scan can see that a floor is written and cannot see what
// it answers, and the one direction that matters here is the cheap pass — a
// two-character expectation matching every sha there is.
function cut(name) {
  const at = RAW.indexOf(`function ${name}(`);
  assert.ok(at > 0, `${name} is gone from the canary`);
  const end = RAW.indexOf("\n}\n", at);
  assert.ok(end > at, `${name}'s closing brace is not where a cut can find it`);
  return new Function(`${RAW.slice(at, end + 3)}; return ${name};`)();
}

test("a sha match is floored at 7 on BOTH sides, and cannot-tell is a refusal", () => {
  const shaMatches = cut("shaMatches");
  assert.equal(shaMatches("28e46e91ab", "28e46e91abcdef"), true, "a real prefix stopped matching");
  assert.equal(shaMatches("28e46e91ab", "ffffffffffff"), false, "a wrong sha matched");
  // THE CHEAP PASS IS THE ONE THAT COSTS MONEY: a short expectation must not
  // match by being short, in EITHER position.
  assert.equal(shaMatches("28e46e91ab", "28e"), false, "a 3-character expectation passed");
  assert.equal(shaMatches("28e", "28e46e91ab"), false, "a 3-character reading passed");
  // CANNOT-TELL IS A REFUSAL, NEVER A MATCH — an unstamped image and a route
  // that failed both arrive as "".
  assert.equal(shaMatches("", ""), false, "two absences matched each other");
  assert.equal(shaMatches("28e46e91ab", ""), false, "an absent expectation matched");
});

test("the preflight requires both eligibilities, not just the deploy identifiers", () => {
  const pre = SRC.slice(SRC.indexOf("PREFLIGHT"), SRC.indexOf("ZERO-COST CONFIRMATIONS"));
  assert.ok(pre.length > 400, "the preflight came out empty");
  // BOTH, and required rather than printed. `async` off means the edit runs in
  // the Worker's isolate bounded by this connection; `runner` off means the job
  // was never handed to the site's own container. Either one makes a green
  // result a statement about a path that is not the one under test.
  assert.match(pre, /check\(\s*"async is true",\s*rAsync === true/, "`async` is no longer required");
  assert.match(pre, /check\(\s*"runner is true",\s*rRunner === true/, "`runner` is no longer required");
  // AND THE TWO READERS STILL HAVE TO AGREE, asked with no expectation set.
  assert.match(pre, /the two deploy readers agree/, "the two-reader agreement check is gone");
});

// ⚠ THE CASE THAT WOULD HAVE CAUGHT THE SEVENTEEN-DAY DRIFT. Check 2 was
// written 2026-09-01 as "a non-canary still receives the SYNCHRONOUS shape",
// which was true while `EDIT_ASYNC_CANARY` named one slug. The everyone door
// opened on 2026-09-04 (`dacc9b51`) and nothing here asserted the control at
// all, so the demand went on standing for a state the platform had left — and
// a failed free check REFUSES TO SPEND, so it would have blocked every paid
// dispatch for a reason unrelated to the code under test.
test("the control's expected shape is DERIVED from its own eligibility", () => {
  const free = SRC.slice(SRC.indexOf("ZERO-COST CONFIRMATIONS"), SRC.indexOf("INVENTORY — before"));
  assert.ok(free.length > 400, "the free half came out empty");
  // The expectation comes from the runtime read, and the two shapes are both
  // expressible — so whichever way the platform's flags are set, the property
  // asserted is that the route follows the site's OWN answer.
  assert.match(free, /const want = cAsync \?/, "the control's expectation is no longer derived");
  assert.match(free, /got === want/, "the control no longer compares what it got with what it derived");
  // AND THE OLD HARDCODED DEMAND IS GONE, not merely accompanied. A second copy
  // of the expectation is the thing that went stale.
  assert.doesNotMatch(free, /still receives the SYNCHRONOUS shape/,
    "the hardcoded sync-only demand is back — it will go stale the next time a flag moves");
});

test("an unreadable control is outstanding coverage, never a refusal to spend", () => {
  const free = SRC.slice(SRC.indexOf("ZERO-COST CONFIRMATIONS"), SRC.indexOf("INVENTORY — before"));
  const at = free.indexOf("cRuntime.status !== 200");
  assert.ok(at > 0, "the control's readability test is gone");
  // The unreadable arm SAYS so and calls no `check(` — `/api/site/runtime` is
  // owner-scoped, so a control the building account does not own answers the
  // 404 a missing site gets, and that is a fact about a DIFFERENT site.
  const arm = free.slice(at, free.indexOf("} else {", at));
  assert.match(arm, /OUTSTANDING/, "the unreadable control no longer says its coverage is outstanding");
  assert.doesNotMatch(arm, /check\(/,
    "an unreadable control counts as a failed check again, so it blocks a paid run about another site");
  // The readable arm is still a real wall: a mismatch there IS a defect.
  assert.match(free.slice(free.indexOf("} else {", at)), /check\(`\$\{CONTROL\}/,
    "the readable control stopped asserting anything");
});

// ⚠ THE WORKFLOW MUST INSTALL WHAT THE SCRIPT IMPORTS, AND THIS IS THE ONE
// GUARD THAT COMPARES THE CONSUMER'S ENVIRONMENT WITH THE CODE.
//
// For months the canary imported `node:https` and nothing else, so the
// workflow needed no install step and had none. Then it gained
// `editBrowserReply` from `addon-sweep.mjs` — one line — and pulled a 44-file
// closure behind it wanting `qrcode-generator` and `@neondatabase/serverless`.
// Run 6 (2026-09-21) died in ONE SECOND on `ERR_MODULE_NOT_FOUND`, before the
// preflight and before any network call.
//
// THE PROPERTY, NOT THE INSTANCE: walk the real transitive imports, and if the
// closure reaches ANY bare specifier, the workflow that runs it must install.
// A test pinned to the two package names today would go quiet the moment a
// third arrives — which is exactly how the step came to be missing.
test("the workflow installs what the canary's import closure needs", () => {
  const ROOT = new URL("../", import.meta.url).pathname;
  const seen = new Set(); const bare = new Map();
  const tryPaths = (p) => [p, p + ".mjs", p + ".js"].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
  (function walk(file) {
    if (!file || seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?:^|\n)\s*import[^;]*?from\s*["']([^"']+)["']/g)) {
      const spec = m[1];
      if (spec.startsWith("node:")) continue;
      if (spec.startsWith(".")) walk(tryPaths(new URL(spec, "file://" + file).pathname));
      else if (!bare.has(spec)) bare.set(spec, file.slice(ROOT.length));
    }
  })(ROOT + "scripts/edit-canary.mjs");

  // THE OBSERVER IS PROVED ALIVE FIRST — a walk that resolved nothing would
  // find no bare specifier and pass about an empty set.
  assert.ok(seen.size >= 2, `the import walk only reached ${seen.size} file(s)`);

  const wf = fs.readFileSync(new URL("../.github/workflows/edit-canary.yml", import.meta.url), "utf8");
  const installs = /\bnpm\s+(ci|install)\b/.test(wf);
  if (bare.size) {
    assert.ok(installs,
      `the canary's closure needs ${[...bare.keys()].join(", ")} (via ${[...bare.values()].join(", ")}) ` +
      "and edit-canary.yml has no npm install step — the run dies on ERR_MODULE_NOT_FOUND before it checks anything");
  }
  // AND EVERY ONE MUST REALLY BE DECLARED, or `npm ci` installs a lockfile
  // that does not contain it and the step passes while the script still throws.
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
  for (const [spec, from] of bare) {
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    assert.ok(declared.has(name), `${from} imports ${name}, which package.json does not declare`);
  }
});

test("the free checks still cost nothing, and the paid one is still opt-in", () => {
  // The four confirmations lean on `escalate("empty")`, which answers cost 0
  // before any model call — so they must keep posting an EMPTY instruction.
  const free = SRC.slice(SRC.indexOf("ZERO-COST CONFIRMATIONS"), SRC.indexOf(PAID_MARK));
  assert.ok(free.length > 400, "the free half came out empty");
  assert.ok((free.match(/instruction: ""/g) || []).length >= 3,
    "a free check stopped sending an empty instruction, so it now costs money");
  assert.doesNotMatch(free, /api\/site\/route/,
    "the free half routes — a routing call is a real charge and this half must stay free");
  // AND SPENDING IS STILL A SWITCH, defaulting off.
  assert.match(SRC, /const SPEND = process\.env\.CANARY_SPEND === "1"/, "the spend switch is gone");
  assert.match(SRC, /if \(!SPEND\)/, "the paid half no longer checks the switch");
  assert.match(SRC, /if \(failed\)/, "the paid edit runs even when a free check failed");
});
