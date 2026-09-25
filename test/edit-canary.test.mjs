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

// ── THE CAPTURE CARRIES WHAT THE SCREEN WOULD DO, NOT ONLY WHAT IT SAYS ─────
//
// ⚠ RUN 12 (2026-09-21). `editBrowserReply` has returned `actions` since it
// was written — a record of what the real browser would do beside printing —
// and this canary read `.text` alone, so an escalate wrote an EMPTY
// `customer-reply.txt` and the whole evidence bundle was silent about the
// ~25-credit rewrite the page would then start. `customerLines`, the ADDON
// sweep's reader one function over, had printed the actions for weeks.
//
// THE WIRING TRAP IN ITS PLAINEST FORM: the producer was perfect, the consumer
// dropped the field, and from outside "the helper did not record one" and "we
// did not read it" are the same absence. The helper half is DRIVEN in
// `test/edit-browser-reply.test.mjs`; this half is the hop.
test("the reply capture reads the browser's ACTIONS, not only its text", () => {
  // Landmark to landmark, and BOTH asserted — a missing end landmark makes
  // `slice(a, -1)` swallow the file and every assertion inside it vacuous.
  //
  // ⚠ ON CODE, NEVER ON A HEADING COMMENT. `SRC` is the BLANKED source, so
  // "THE CUSTOMER'S OWN SCREEN" — the obvious landmark, and the one this case
  // was first written against — is whitespace by the time it is searched for.
  // This file's own recorded trap, met writing the guard for it.
  //
  // ⚠ AND IT IS ANCHORED ON THE DECLARATION, NOT ON ITS INITIALIZER
  // (re-anchored 2026-09-21). This was `const said = editBrowserReply(`, which
  // is a claim about HOW the composer is reached — so it went red the moment
  // run 14's correction made that call conditional on there being a stored
  // reply to compose from, reporting an honest fix as the capture going away.
  // What this case is actually about is the block where the screen is
  // composed and recorded, and `const said =` is where that begins however
  // the composer is called. The observer below proves `editBrowserReply` is
  // still really in it, so widening the landmark costs no coverage.
  const at = SRC.indexOf("const said =");
  assert.ok(at > 0, "the reply-capture block's opening landmark is gone");
  // CLOSED ON THE NEXT CODE SIBLING, not on the section heading under it, for
  // the same reason — and searched FROM the opening one so the two cannot
  // cross.
  //
  // ⚠ RE-ANCHORED 2026-09-25 (run 32). This closed on `await inventory("after")`
  // until the after-read learned to wait for this job's version: the call gained
  // an argument and a block now sits between the capture and it. The next code
  // sibling of the capture is that block's first line, so the window is exactly
  // as wide as it was.
  const end = SRC.indexOf("const body = done && done.json", at);
  assert.ok(end > at, "the reply-capture block's closing landmark is gone or moved above it");
  const block = SRC.slice(at, end);
  assert.ok(block.length > 300, "the capture block came out too small to assert over: " + block.length);
  // THE OBSERVER PROVED ALIVE BEFORE ANY OF THIS IS BELIEVED — the block must
  // really be the one that composes the screen.
  assert.match(block, /editBrowserReply\(/, "the capture no longer runs the browser's own selection");
  // THE PROPERTY: the actions are READ, PRINTED and WRITTEN TO THE ARTIFACT.
  // Three separate readers, because a run whose log is gone still has the
  // file and a run read live still has the log.
  assert.match(block, /said\.actions/, "the capture stopped reading the helper's `actions`");
  assert.match(block, /writeFileSync\(`\$\{EVID\}\/customer-reply\.txt`/, "the capture no longer writes the reply artifact");
  const written = block.slice(block.indexOf("writeFileSync(`${EVID}/customer-reply.txt`"));
  assert.match(written, /sActs|actions/, "the ARTIFACT is written without the actions — only the console has them");
  // AND `shown` SEPARATES "ACTED" FROM "ANSWERED EMPTY". Without it an
  // escalate and a composer that answered "" write the same blank file, which
  // is what made run 12's capture unreadable.
  assert.match(block, /said\.shown|\bshown\b/, "the capture cannot tell an acting branch from an empty answer");
});

test("the router is told the site's pages, read above the routing call (run 23)", () => {
  // RUN 23 (2026-09-23) ROUTED BLIND. The digest sent `pages: []`, so the
  // router named `/book` — a route fretwork-1 does not have — and `readEdit`'s
  // check against the real list never ran: 2 credits for routing, nothing
  // edited. The browser sends the list `GET /api/site/routes` answers.
  const paid = paidHalf();
  const read = paid.indexOf("/api/site/routes?slug=");
  const routed = paid.indexOf('"/api/site/route"');
  assert.ok(read > 0, "the canary no longer reads the site's page list — the router routes blind");
  assert.ok(routed > read, "the page list is read after the routing call has already spent");
  const between = paid.slice(read, routed);
  assert.match(between, /readRoutes\(/, "the page list is not read through the shared reader");
  // THE REFUSAL SITS BETWEEN THE READ AND THE SPEND, on the reader's own
  // answer, and it really stops the run. The condition is asserted as well as
  // the call: `if (false)` would keep every landmark where it is.
  const refuse = between.indexOf("routesRefusal(");
  assert.ok(refuse > 0, "an unreadable page list no longer refuses");
  assert.match(between.slice(between.lastIndexOf("if (", refuse), refuse), /!RP\.ok/,
    "the refusal no longer depends on the page list being unreadable");
  assert.match(between.slice(refuse, refuse + 200), /process\.exit\(1\)/, "the refusal does not stop the run");
  // THE DEFECT ITSELF: the digest carried an empty page list.
  const dAt = between.indexOf("const digest");
  assert.ok(dAt > 0, "the routing digest is gone or moved below the routing call");
  const digestLine = between.slice(dAt, between.indexOf("\n", dAt));
  assert.doesNotMatch(digestLine, /pages:\s*\[\s*\]/, "the router is sent an empty page list again — run 23's defect");
  assert.match(digestLine, /pages:\s*RP\.pages/, "the digest does not send the list that was read");
  // AND THE RECORD SAYS WHAT THE ROUTER WAS TOLD — run 23's bundle had the
  // router's answer and nowhere the list it answered from.
  assert.match(paid, /routing\.json`,\s*JSON\.stringify\(\{[^\n]*\bsite:\s*digest\b/,
    "routing.json no longer records the digest the router was sent");
});

test("the after-read waits for THIS job's own version, and an unverified comparison passes nothing (run 32)", () => {
  // RUN 32 (2026-09-25) READ THE PREVIOUS BUILD: the after-inventory ran as
  // soon as the stored reply arrived, 7.9 s after the publish, and compared the
  // old page with itself. The decisions are driven in canary-watch.test.mjs;
  // this is the wiring — each hop between them, in the order that makes the
  // after-read evidence about this job.
  const paid = paidHalf();
  const target = paid.indexOf("afterReadTarget(");
  const wait = paid.indexOf("awaitVersion(", target);
  const after = paid.indexOf('await inventory("after"');
  const verdict = paid.indexOf("afterReadVerdict(");
  assert.ok(target > 0, "the after-read no longer asks which version it must see");
  assert.ok(wait > target, "the after-read no longer waits for that version");
  assert.ok(after > wait, "the after-inventory is read before the wait — run 32's defect");
  assert.ok(verdict > after, "the verdict is reached before the pages it judges were read");

  // THE TARGET IS THIS JOB'S, found in the site's own version list by the job
  // id the POST answered — never "whatever is newest".
  const tLine = paid.slice(target, paid.indexOf("\n", target));
  // THE JOB THE POST ANSWERED, handed over as itself — `job: ""` would still
  // spell the word and look up nothing.
  assert.match(tLine, /[{,]\s*job\s*[,}]/, "the target is not looked up by this job's id");
  const list = paid.slice(paid.lastIndexOf("const versionList", target), target);
  assert.match(list, /\/versions`/, "the version list is not the site's own versions route");

  // THE LIVE READ IS THE SITE'S OWN HEADER, the one the restore mode reads too.
  const live = paid.indexOf("const liveRead");
  assert.ok(live > target && live < wait, "the live read is gone or moved — the observer is alive");
  assert.match(paid.slice(live, wait), /headers\.get\("x-site-version"\)/, "the wait no longer reads the site's own version header");

  // THE WAIT IS ON THE TARGET, and the pages are read at it only when it came.
  assert.match(paid.slice(wait, paid.indexOf("\n", wait)), /expect:\s*TARGET\.id/, "the wait is not for the target version");
  const aLine = paid.slice(after, paid.indexOf("\n", after));
  assert.match(aLine, /WAIT\.kind === "match" \? TARGET\.id/, "the pages are held to the target even when the wait did not see it");

  // EVERY PAGE RECORDS THE VERSION IT WAS READ AT — the one reading that names
  // the build that served it.
  const inv = SRC.indexOf("async function inventory(");
  const invEnd = SRC.indexOf("\n}\n", inv);
  assert.ok(inv > 0 && invEnd > inv, "the inventory function is gone — the observer is alive");
  const invBody = SRC.slice(inv, invEnd);
  assert.match(invBody, /x-site-version/, "a page read no longer records its version");
  assert.match(invBody, /version:\s*got\.version/, "the recorded page drops the version it was read at");

  // THE RECORD CARRIES THE VERDICT, and the checks that compare the two reads
  // are inside a VERIFIED branch — the condition asserted, not only the call,
  // because `if (true)` keeps every landmark where it is.
  assert.match(paid, /comparison:\s*\{\s*\.\.\.VERDICT/, "compare.json no longer carries the verdict");
  assert.match(paid, /versionBefore:[^\n]*versionAfter:/, "compare.json no longer records each page's two versions");
  const gate = paid.indexOf("if (VERDICT.verified) {");
  assert.ok(gate > 0, "the preservation checks are no longer gated on a verified comparison");
  const photos = paid.indexOf('check("no route lost an on-page photograph"', gate);
  const parts = paid.indexOf('check("the stored components are preserved"', gate);
  const other = paid.indexOf("} else {", gate);
  assert.ok(photos > gate && parts > gate && other > parts, "a preservation check runs outside the verified branch");
  assert.match(paid.slice(other, other + 400), /UNVERIFIED/, "an unverified comparison is not said to be unverified");
  // AND THE LAST LINE SAYS WHICH COMPARISON THE RUN HAS.
  const tail = paid.slice(paid.lastIndexOf("CANARY PASSED"));
  assert.match(tail, /SAID/, "the verdict on the transport no longer carries the verdict on the comparison");
});
