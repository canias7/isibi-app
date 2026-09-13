// Guards for scripts/addon-sweep.mjs — the harness that drives the ADD step on
// a live site. Kept to properties, not spellings, the way the other two
// harness guards are.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CASES, chooseCases, sitePathOf, watchJob, blindBackend, crashedRoutes, stopsRun, casesFor, askCase, shipped, askVerdict, ignoredNote, askLines } from "../scripts/addon-sweep.mjs";
import { ADD_KINDS, OWN_ADDS, DISPATCHED_ADDS, addLayer, MAX_MESSAGE } from "../builder/site-add.mjs";
import { routeOf } from "../builder/site-addon.mjs";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";
// The served page's bands, one copy shared with test/copy-design.test.mjs.
import { SECOND_QUOTES, gridBand, page } from "./fixtures/testimonial-bands.mjs";

const SRC = readFileSync(new URL("../scripts/addon-sweep.mjs", import.meta.url), "utf8");
/**
 * Length-preserving, LINE COMMENTS FIRST — the recorded blanker-order trap, and
 * this file needed one the hour `shipped()` was written: its own comment names
 * `verdict.startsWith("ok")` while explaining why that spelling went, so the
 * absence check below read its own prose as a surviving call site. "Prose
 * contains the thing it forbids", inside the guard written for it.
 */
function blank(src) {
  let out = "", i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "/") {
      let j = i; while (j < src.length && src[j] !== "\n") j++;
      out += " ".repeat(j - i); i = j; continue;
    }
    if (src[i] === "/" && src[i + 1] === "*") {
      let j = src.indexOf("*/", i + 2); j = j < 0 ? src.length : j + 2;
      out += src.slice(i, j).replace(/[^\n]/g, " "); i = j; continue;
    }
    out += src[i]; i++;
  }
  return out;
}
const CODE = blank(SRC);
// THE BLANKER'S OWN OBSERVER: the landmarks the absence checks are about to
// look for must have survived it, or a reader that ate the file satisfies every
// one of them perfectly.
assert.ok(CODE.includes("export function shipped(verdict)"), "the blanker ate the harness");
assert.ok(CODE.includes("if (shipped(verdict) && crashed.length)"), "the blanker ate the render downgrade");
const WF = readFileSync(new URL("../.github/workflows/lane-sweep.yml", import.meta.url), "utf8");
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("importing the harness runs nothing", () => {
  assert.ok(Array.isArray(CASES) && CASES.length > 0);
});

// ── THE TWO-LISTS RULE, POINTED AT THE HARNESS ─────────────────────────────
//
// A kind added to the step with no case is a kind the sweep silently skips and
// reports as "all passed"; a case for a kind the step does not have spends a
// credit asking for something the picker cannot name. Both directions, derived
// from the real `ADD_KINDS`.
test("every kind has a case and every case names kinds the step has", () => {
  const named = new Set(CASES.flatMap((c) => c.kinds));
  for (const k of ADD_KINDS) assert.ok(named.has(k), "`" + k + "` is a kind the sweep never exercises");
  for (const c of CASES) {
    assert.ok(Array.isArray(c.kinds) && c.kinds.length, c.name + ": names no kind");
    for (const k of c.kinds) assert.ok(ADD_KINDS.includes(k), c.name + ": names a kind the step does not have: " + k);
    assert.ok(ADD_KINDS.includes(c.name), c.name + ": a case's identity is a kind");
  }
  const ids = CASES.map((c) => c.name);
  assert.equal(new Set(ids).size, ids.length, "two cases share a name — which one is the verdict?");
  assert.ok(ADD_KINDS.length >= 6, "the observer is alive");
});

// The trace each refusal case reads off the page, and the reply a real
// addition of it carries — derived per case, so a case added without one
// fails the guard below by name rather than passing vacuously.
const REFUSAL_FIXTURES = {
  qr: { html: '<html><img src="/qr.svg" alt="Scan to ring and book"></html>', reply: { ok: true, added: [], changed: ["index.tsx"], moved: ["qr"] } },
  three: { html: "<html><canvas width=\"1096\" height=\"420\"></canvas></html>", reply: { ok: true, added: [], changed: ["index.tsx"], moved: ["three"] } },
  // `table` LEFT THIS LIST ON 2026-09-03: a table is never refused for want
  // of a database now (the first backend tier makes one), so the case has
  // one honest outcome and is judged with the other backend tiers below.
};

test("every case can be judged, and judges the site rather than the reply", () => {
  const same = { build: "b1", status: 200, html: "<html></html>", text: "Sheffield Beginner Guitar", hrefs: ["/"], routes: ["/"] };
  for (const c of CASES) {
    assert.equal(typeof c.ask, "string", c.name + ": no ask");
    assert.ok(c.ask.trim().length > 10, c.name + ": an ask too short to route");
    assert.equal(typeof c.check, "function", c.name + ": no check");
    // A REFUSAL CASE IS JUDGED BOTH WAYS (run 24): a refusal is honest only
    // when the thing was already on the page and the build stayed put; a
    // publish is honest only when it was not there, is now, and the build
    // moved. The refusal-only shape called run 24's real scene a LIE.
    if (Array.isArray(c.mayRefuse)) {
      const fx = REFUSAL_FIXTURES[c.name];
      assert.ok(fx, c.name + ": a refusal case with no two-way fixture — add one, or the check cannot be driven both ways");
      const with_ = { ...same, html: fx.html };
      assert.equal(c.check(with_, { ...with_ }, {}, {}).ok, true, c.name + ": a refusal on a site that has the thing, build unmoved, is not the honest pass");
      assert.equal(c.check(with_, { ...with_, build: "b2" }, {}, {}).ok, false, c.name + ": a moved build on a refusal passes");
      assert.equal(c.check(same, { ...same }, {}, {}).ok, false, c.name + ": a refusal on a site WITHOUT the thing passes — the refusal was wrong");
      assert.equal(c.check(same, { ...same, build: "b2" }, fx.reply, {}).ok, false, c.name + ": a claimed addition that left no trace on the page passes");
      // A SECOND ONE IS NOT AN ADDITION: the wall should have refused a site
      // that already carried the thing, so a publish there is a lie too.
      // Found by a survivor: with `!had` dropped the guard was silent.
      assert.equal(c.check(with_, { ...with_, build: "b2" }, fx.reply, {}).ok, false, c.name + ": a publish on a site that already had the thing passes — the wall should have refused");
      assert.equal(c.check(same, { ...with_, build: "b2" }, fx.reply, {}).ok, true, c.name + ": a real addition — not there, then there, build moved — is called a lie");
      assert.equal(c.check(same, { ...with_ }, fx.reply, {}).ok, false, c.name + ": a claimed addition with the build unmoved passes");
      continue;
    }
    if (c.hop) {
      assert.equal(c.check(same, same, {}, { hopped: c.hop }).ok, true);
      assert.equal(c.check(same, same, {}, {}).ok, false, c.name + ": passes without the hop");
      continue;
    }
    const v = c.check(same, { ...same }, { ok: true, added: [], changed: [] }, {});
    assert.equal(v.ok, false, c.name + ": passes against a site that did not change");
    assert.equal(typeof v.note, "string", c.name + ": gives no note");
  }
  // THE REFUSAL CASES ARE EXACTLY THE SINGLE FIELDS — a kind that left the
  // wall (table, 2026-09-03) must have left this list too.
  assert.deepEqual(CASES.filter((c) => Array.isArray(c.mayRefuse)).map((c) => c.name).sort(), Object.keys(REFUSAL_FIXTURES).sort());
});

// ── THE BACKEND TIERS ARE JUDGED OFF THE REPLY'S OWN EVIDENCE (2026-09-03) ──
//
// A database leaves no mark on the page a mirror can read, so a table, a
// function, a connection and a job are judged on what the reply says the
// engine MADE — with the one thing the page can show (a changed page on a
// moved build) demanded where a page must call the thing, and the opposite
// demanded of a job, which changes no page.
test("the backend cases pass only on evidence, fail on a bare claim, and the job case fails on a moved build", () => {
  const same = { build: "b1", status: 200, html: "<html></html>", text: "x", hrefs: ["/"], routes: ["/"] };
  const moved = { ...same, build: "b2" };
  const by = (n) => CASES.find((c) => c.name === n);
  // THE JUDGE ITSELF, driven: a named thing on a changed page of a moved
  // build passes; a job on an unmoved build passes; a reply that was not ok
  // carries no evidence however full its list.
  assert.equal(blindBackend(same, moved, { ok: true, functions: ["f"], changed: ["index.tsx"] }, "functions", true).ok, true);
  assert.equal(blindBackend(same, same, { ok: true, jobs: [{ name: "j" }] }, "jobs", false).ok, true);
  assert.equal(blindBackend(same, moved, { ok: false, functions: ["f"], changed: ["index.tsx"] }, "functions", true).ok, false, "a failed reply's list counts as evidence");
  // A TABLE: the reply names one and the build moved; a claim with no table,
  // or an unmoved build, is not a pass.
  assert.equal(by("table").check(same, moved, { ok: true, tables: ["bookings"], added: [], changed: ["index.tsx"] }, {}).ok, true);
  assert.equal(by("table").check(same, moved, { ok: true, tables: [], added: [], changed: ["index.tsx"] }, {}).ok, false, "a publish that made no table passes");
  assert.equal(by("table").check(same, same, { ok: true, tables: ["bookings"] }, {}).ok, false, "an unmoved build passes");
  assert.match(by("table").check(same, moved, { ok: true, tables: ["bookings"], provisioned: true }, {}).note, /got its database/, "a first-touch provision is not said in the note");
  // A FUNCTION AND A CONNECTION: named in the reply, no creation error, and
  // a page changed on a moved build — a page has to call it.
  const fnOk = { ok: true, functions: ["bookings_on_day"], added: [], changed: ["index.tsx"] };
  assert.equal(by("function").check(same, moved, fnOk, {}).ok, true);
  assert.equal(by("function").check(same, moved, { ...fnOk, functions: [] }, {}).ok, false, "a publish that made no function passes");
  assert.equal(by("function").check(same, moved, { ...fnOk, functionErrors: [{ name: "bookings_on_day", error: "column d does not exist" }] }, {}).ok, false, "a function the database refused passes");
  assert.equal(by("function").check(same, moved, { ...fnOk, changed: [], added: [] }, {}).ok, false, "a function no page calls passes as a page change");
  assert.equal(by("function").check(same, same, fnOk, {}).ok, false, "an unmoved build passes");
  assert.equal(by("api").check(same, moved, { ok: true, apis: ["exchange_rate"], added: [], changed: ["prices.tsx"] }, {}).ok, true);
  assert.equal(by("api").check(same, moved, { ok: true, apis: [], added: [], changed: ["prices.tsx"] }, {}).ok, false, "a publish that made no connection passes");
  // A JOB: named, and the build UNMOVED — it changes no page; the honest
  // answer publishes nothing, and a moved build is the lie.
  const job = { ok: true, jobs: [{ name: "remind_tomorrow", fn: "bookings_due_tomorrow", everyMinutes: 1440 }], functions: ["bookings_due_tomorrow"], added: [], changed: [] };
  assert.equal(by("job").pageless, true, "the job case is not marked pageless — the runner would wait for a build that will not come");
  assert.equal(by("job").check(same, same, job, {}).ok, true, "the honest job answer — unmoved build — is called a lie");
  assert.equal(by("job").check(same, moved, job, {}).ok, false, "a job that moved the build passes");
  assert.equal(by("job").check(same, same, { ...job, jobs: [] }, {}).ok, false, "a job that scheduled nothing passes");
  assert.equal(by("job").check(same, same, { ...job, functionErrors: [{ name: "bookings_due_tomorrow" }] }, {}).ok, false, "a job whose builder failed to create passes");
  // Every backend case says it judged the reply, so a reader of the log
  // knows the page was not the evidence.
  for (const n of ["function", "api", "job"]) assert.match(by(n).check(same, moved, {}, {}).note, /judged off the reply/, n + ": the note pretends the page was read");
  // And every pageless case is a backend case with no page in its ask's answer.
  for (const c of CASES.filter((x) => x.pageless)) assert.ok(["job"].includes(c.name), c.name + ": marked pageless but its answer changes a page");
});

test("the runner does not wait for the edge on a pageless case, and judges it the other way round", () => {
  assert.match(SRC, /if \(\(body\.ok === true && !c\.pageless\) \|\| extra\.hopOk\) \{/, "a pageless publish is waited for — ninety seconds looking for a build that will not come");
  const branch = SRC.indexOf("else if (c.pageless) {");
  const generic = SRC.indexOf("const moved = after.build !== before.build;\n      if (chk.ok && moved)", branch);
  assert.ok(branch > 0 && generic > branch, "the pageless verdict does not come before the moved-build verdict");
  assert.match(SRC.slice(branch, generic), /verdict = chk\.ok \? "ok" : "LIE"/, "a pageless case is not judged on its own check alone");
  assert.match(SRC.slice(branch, generic), /the build MOVED on a change that touches no page/, "a moved build on a pageless case is not named in the note");
});

test("the component case is judged on the words landing on the page, not on the reply's claim", async () => {
  // FOUND BY A MUTANT: with the words check cut to `true`, the guard above
  // still passed, because it only drives the check against a site that did
  // not change — where `changed: []` fails it for another reason. A reply
  // that CLAIMS the home page changed, on a build that moved, with not a
  // word of the addition on the page, is the lie this check exists to catch.
  //
  // RE-ANCHORED 2026-09-04, for the copy-the-first's-design check: the case
  // reads the served page's STRUCTURE now, so a snapshot here is what the
  // harness makes — `html`, with `text` read off it by the harness's own
  // `strip` — never the text-only object the first draft typed, which the
  // harness never produces. And what the page says is read the same way: the
  // served quote is `“<!-- -->First lesson…` (React's SSR marker between two
  // text nodes), which strips to `“ First lesson…` with a space, so the lost
  // sentence is taken from `lostSentences` itself rather than typed.
  const { strip, lostSentences } = await import("../scripts/addon-sweep.mjs");
  const c = CASES.find((x) => x.name === "component");
  const snap = (build, html) => ({ build, html, text: strip(html), hrefs: [], routes: ["/"] });
  const before = snap("b1", page());
  const claimed = { ok: true, changed: ["index.tsx"], added: [] };
  const unchanged = snap("b2", page());
  assert.equal(c.check(before, unchanged, claimed, {}).ok, false, "a claimed change with no new words on the page passes");
  const landed = snap("b2", page(gridBand(SECOND_QUOTES)));
  assert.equal(c.check(before, landed, claimed, {}).ok, true, "the real thing is called a lie: " + c.check(before, landed, claimed, {}).note);
  assert.equal(c.check(before, landed, { ok: true, changed: [], added: [] }, {}).ok, false, "words on the page with no page claimed changed passes");
  assert.equal(c.check(before, { ...landed, build: "b1" }, claimed, {}).ok, false, "an unmoved build passes");
  // A SECOND ONE (owner, 2026-09-04): run 35's shape — the section kept, its
  // quote rewritten, MORE words than before through more quotes — is a lie
  // the words check alone cannot see, because what was there is gone.
  const SAM = ["First lesson I walked out able to change between E and A without looking down.", "SH", "Sam H."];
  const had = snap("b1", page(gridBand([SAM])));
  const rewrote = snap("b2", page(gridBand([["Couldn’t hold a pick last month — now I play three chords.", "SH", "Sam H."], ...SECOND_QUOTES])));
  const v = c.check(had, rewrote, claimed, {});
  assert.equal(v.ok, false, "a page that rewrote what it said passes as an addition");
  const gone = lostSentences(had.text, rewrote.text);
  assert.ok(gone.length >= 1 && gone[0].includes("First lesson I walked out"), "the rewritten quote is not read as lost: " + JSON.stringify(gone));
  assert.ok(v.note.includes("LOST what the page said: " + JSON.stringify(gone[0])), "the note does not name the sentence that went: " + v.note);
  // The second band beside the first, the first intact, built like the first.
  const second = snap("b2", page(gridBand([SAM]), gridBand(SECOND_QUOTES)));
  const w = c.check(had, second, claimed, {});
  assert.equal(w.ok, true, "a second band beside the first, with the first intact, is called a lie: " + w.note);
  assert.match(w.note, /everything it said is still there; built the way the first one is/);
});

test("lostSentences reads the visible text: a sentence reworded, shortened or dropped is lost; more text, reordering and short fragments are not", async () => {
  const { lostSentences } = await import("../scripts/addon-sweep.mjs");
  const before = "Book a guitar lesson. First lesson I walked out able to change between E and A without looking down. Ring us on 0114.";
  assert.deepEqual(lostSentences(before, before + " A whole new band of words that was not there before."), [], "an addition reads as a loss");
  assert.deepEqual(lostSentences(before, "Ring us on 0114. First lesson I walked out able to change between E and A without looking down. Book a guitar lesson."), [], "a reordered page reads as a loss");
  assert.deepEqual(lostSentences(before, "Book a guitar lesson. First lesson and the fretboard stopped looking like a puzzle. Ring us on 0114."),
    ["First lesson I walked out able to change between E and A without looking down."]);
  assert.deepEqual(lostSentences("Short. Also short.", "Nothing of it."), [], "a fragment under the floor counts as a sentence");
  assert.deepEqual(lostSentences(before, before.replace(/\s+/g, "   ")), [], "whitespace reads as a change");
});

test("the refusal cases are driven to refusals the route really emits, and the hop names a real edit layer", () => {
  const b = W.slice(W.indexOf("\n          if (ad) {"), W.indexOf("\n          if (tx) {"));
  assert.ok(b.length > 1000, "the addon block is gone");
  for (const c of CASES.filter((x) => Array.isArray(x.mayRefuse))) {
    for (const token of c.mayRefuse) assert.ok(b.includes('error: "' + token + '"'), c.name + ": the route never answers error " + token);
  }
  for (const c of CASES.filter((x) => x.hop)) {
    assert.ok(EDIT_LAYERS.includes(c.hop), c.name + ": hops to a layer the edit route does not have");
    assert.equal(addLayer(c.name), c.hop, c.name + ": the harness expects a different layer from the step's own");
  }
  // The dispatched kinds are exactly the hop cases, both ways.
  assert.deepEqual(CASES.filter((x) => x.hop).map((x) => x.name).sort(), [...DISPATCHED_ADDS].sort());
  // And the refusal cases are own kinds the sweep's site cannot take.
  for (const c of CASES.filter((x) => Array.isArray(x.mayRefuse))) assert.ok(OWN_ADDS.includes(c.name));
});

test("the harness posts to the addon route, follows one hop to the edit route, and never touches the build route", () => {
  assert.match(SRC, /\/api\/site\/\$\{encodeURIComponent\(SLUG\)\}\/addon/, "the harness does not post to the addon route");
  // The post carries the zone a browser would (2026-09-03): a job's clock
  // time is read in it, and the site is in Sheffield.
  assert.match(SRC, /body: \{ instruction: c\.ask, picker: PICKER, idem: hex32\(\), tz: "Europe\/London" \}/, "the addon post does not carry the owner's zone");
  assert.match(SRC, /\/api\/site\/\$\{encodeURIComponent\(SLUG\)\}\/edit/, "the hop does not land on the edit route");
  assert.ok(!/react-build|react-revise|\/api\/site\/build/.test(SRC), "the harness reaches for the build route");
  // The hop is gated on the case AND on the reply naming that layer.
  assert.match(SRC, /if \(c\.hop && body\.escalate === true && body\.layer === c\.hop\)/, "the hop is not gated on the reply naming the case's layer");
  // A claimed publish waits for the build id to move; a refusal is read at
  // once — and so is a pageless answer (2026-09-03), whose build never moves.
  assert.match(SRC, /if \(\(body\.ok === true && !c\.pageless\) \|\| extra\.hopOk\) \{/, "a publish is not waited for");
  // Red on a lie, a lost answer, a broken page or a failure — never green by
  // default. The expression is READ OUT of the exit line and DRIVEN, rather
  // than matched by its spelling: the first draft pinned the three-word
  // regex, and the day BROKEN joined it (run 34) the guard reported the red
  // rule gone while it had grown — the recorded "assert the property, not
  // the spelling" trap.
  const exitAt = SRC.indexOf("const bad = results.filter((r) => ");
  assert.ok(exitAt > 0, "the exit line is missing");
  const exitLine = SRC.slice(exitAt, SRC.indexOf("\n", exitAt));
  const reSrc = exitLine.match(/\/((?:\\\/|[^/])+)\/\.test\(r\.verdict\)/);
  assert.ok(reSrc, "the exit line does not test the verdict with a regex");
  const red = new RegExp(reSrc[1]);
  for (const v of ["failed", "LIE: reply says ok but the build did not move", "NO ANSWER", "BROKEN"]) {
    assert.ok(red.test(v), `a "${v}" case is a green run`);
  }
  for (const v of ["ok", "ok (refused honestly)", "ok (job, no page)", "skipped"]) {
    assert.ok(!red.test(v), `a "${v}" case is a red run`);
  }
  assert.match(SRC.slice(exitAt), /process\.exit\(bad\.length \? 1 : 0\)/, "a red case does not end the run red");
});

// ── THE WATCH, DRIVEN (run 22, 2026-09-03) ─────────────────────────────────
//
// The first cut of `watchJob` sat at module scope and read `TOKEN`, a local of
// `main`: the first poll threw a ReferenceError five seconds after "watching",
// the harness died, and the job it had stopped watching went on to publish.
// Nothing static catches a free identifier that happens to be defined elsewhere
// in the file, so the loop is driven here with an injected reader and no sleep,
// and its text is read for the one name it must not use.
test("watchJob answers on the poll's four voices, from the arguments it is handed", async () => {
  const seq = (answers) => { let i = 0; return async () => answers[Math.min(i++, answers.length - 1)]; };
  const nap = async () => {};
  const running = { status: 202, headers: {}, json: { status: "claimed" } };
  const final = { status: 200, headers: { "x-gf-edit": "final" }, json: { ok: true } };
  // THE STORED REPLY, however many running polls precede it.
  assert.deepEqual(await watchJob("j1", "t", { get: seq([running, running, final]), nap }), final);
  // A 404 ENDS THE WATCH; a terminal state with no stored reply ends it too.
  assert.equal((await watchJob("j1", "t", { get: seq([{ status: 404, headers: {}, json: null }]), nap })).status, 404);
  assert.equal((await watchJob("j1", "t", { get: seq([{ status: 202, headers: {}, json: { status: "lost" } }]), nap })).json.status, "lost");
  // A WATCH THAT RUNS OUT ANSWERS NULL — NO ANSWER, never a refusal.
  assert.equal(await watchJob("j1", "t", { get: seq([running]), nap, looks: 3 }), null);
  // A POLL THAT FAILED IS NOT A JOB THAT FAILED: a null read is polled past.
  assert.deepEqual(await watchJob("j1", "t", { get: seq([null, final]), nap }), final);
  // THE PATH IT POLLS COMES FROM THE JOB IT WAS HANDED.
  let seen = null;
  await watchJob("abc123", "t", { get: async (p) => { seen = p; return final; }, nap });
  assert.equal(seen, "/api/site/edit/abc123");
  // AND THE TOKEN IS THE PARAMETER: the function's own text never names the
  // local it cannot see, and the default reader sends what it was given.
  const open = SRC.indexOf("export async function watchJob(job, token,");
  const shut = SRC.indexOf("\n}\n", open);
  assert.ok(open > 0 && shut > open, "watchJob moved");
  const fn = SRC.slice(open, shut);
  assert.doesNotMatch(fn, /\bTOKEN\b/, "watchJob reads TOKEN, which is a local of main and not in scope here");
  assert.match(fn, /call\("GET", p, \{ token \}\)/, "the default reader does not send the token it was handed");
});

// ── THE SITEMAP IS ITS OWN OBJECT AT THE EDGE (run 23, 2026-09-03) ──────────
//
// The build id had moved and the sitemap, cached separately, still listed the
// old routes for a while; the page case read it two seconds after the publish
// and called a real page a LIE. The snapshot is re-taken until the sitemap
// lists every new route, bounded, before the routes are read and judged.
test("a new route's sitemap listing is re-read, bounded, before the page case is judged", () => {
  const routes = SRC.indexOf("extra.newRoutes = (Array.isArray(body.added)");
  const judged = SRC.indexOf("const chk = c.check(before, after, body, extra);", routes);
  assert.ok(routes > 0 && judged > routes, "the new-route evidence or the verdict moved");
  const win = SRC.slice(routes, judged);
  const wait = win.match(/while \(extra\.newRoutes\.some\(\(p\) => !after\.routes\.includes\(p\)\) && Date\.now\(\) - t2 < (\d+)\)/);
  assert.ok(wait, "the sitemap is not re-read until it lists the new routes");
  assert.ok(Number(wait[1]) >= 60000, "the sitemap wait is shorter than an edge cache can lag");
  const retake = win.indexOf("after = await snapshot();");
  assert.ok(retake > 0, "the wait does not re-take the snapshot the verdict reads");
  assert.ok(win.indexOf("extra.newStatuses = {}") > retake, "the routes are read before the sitemap settles");
});

test("a decline is read off the kept replies, never guessed (run 28)", () => {
  // Three live declines were diagnosed from a boolean. The route now keeps
  // every designer's raw reply on the site's store; the harness reads it
  // back through the owner's answer route the moment a case is `declined`
  // and prints what each designer said, so the log carries the reason.
  const at = SRC.indexOf('String(body.error) === "declined"');
  assert.ok(at > 0, "the harness does not read a decline back");
  const block = SRC.slice(at, SRC.indexOf("\n    }\n", at));
  assert.match(block, /\/api\/site\/answer\?slug=\$\{encodeURIComponent\(SLUG\)\}&kind=addon/, "the kept replies are not read with kind=addon");
  assert.match(block, /token: TOKEN/, "the read is not the owner's — the route 404s a stranger");
  assert.match(block, /answered NOTHING/, "an unanswered designer is not said out loud");
  assert.match(block, /tool_use/, "a designer's tool answer is not printed");
  assert.match(block, /no kept reply to read/, "a missing record is silent — the shape run 90 warned about");
});

test("chooseCases refuses a stranger before anything is spent and forgives punctuation", () => {
  assert.deepEqual(chooseCases("all", CASES), CASES.map((c) => c.name));
  assert.deepEqual(chooseCases(" page, component. ", CASES), ["page", "component"]);
  assert.deepEqual(chooseCases("qr,qr", CASES), ["qr"]);
  assert.throws(() => chooseCases("page,nope", CASES), /not a case: "nope"/);
});

test("the reply's paths are read the way the module reads them", () => {
  for (const f of ["gallery.tsx", "src/routes/gallery.tsx", "index.tsx", "about.team.tsx", "_layout.tsx", "x.txt"]) {
    assert.equal(sitePathOf(f), routeOf(f), f);
  }
});

test("the workflow runs this harness behind the `addon` word and says what it costs", () => {
  const run = WF.split("\n").find((l) => /node scripts\/lane-sweep\.mjs/.test(l));
  assert.ok(run, "the sweep's run line is gone");
  assert.match(run, /"addon" \]; then node scripts\/addon-sweep\.mjs/, "the `addon` word does not run this harness");
  // DERIVED FROM THE CASES, so a renamed kind (section → component, the
  // owner's framing) cannot leave the form describing a case that no longer
  // exists.
  assert.match(WF, new RegExp("harness:\\n\\s+description: '[^']*addon \\(the ADD step[^']*" + CASES.map((c) => c.name).join(",")), "the harness input does not name the addon sweep and its cases, in order");
});

// ── the table case, after run 30 (2026-09-03) ────────────────────────────────

test("the table case asks for a thing no table the site has can hold, and passes only on a table made", () => {
  // Run 30 asked for "a booking form" on a site that already had a bookings
  // table; the designer reused it (right) and the check called it a LIE and
  // stopped the run. The ask is what makes a table the honest answer, so the
  // ask is pinned to name something the site's tables cannot hold and NOT the
  // thing they already do.
  const c = CASES.find((x) => x.name === "table");
  assert.ok(c, "no table case");
  assert.match(c.ask, /for sale/i, "the ask no longer names a thing the site cannot already store");
  assert.doesNotMatch(c.ask, /booking form|waiting list/i, "the ask names a thing fretwork-1 already holds (its booking form; the waiting-list table run 33 may have left), which makes a component the right answer and the check wrong");
  const before = { build: "b1", text: "", routes: ["/"] };
  const moved = { build: "b2", text: "", routes: ["/"] };
  assert.equal(c.check(before, moved, { ok: true, tables: ["waitlist"] }, {}).ok, true, "a made table on a moved build is the pass");
  assert.equal(c.check(before, { ...before }, { ok: true, tables: ["waitlist"] }, {}).ok, false, "a table with no publish is not");
  const reuse = c.check(before, moved, { ok: true, tables: [] }, {});
  assert.equal(reuse.ok, false);
  assert.match(reuse.note, /made no table/, "a publish without a table must say what that can mean, not only 'made []'");
  assert.match(c.check(before, moved, { ok: true, tables: ["waitlist"], provisioned: true }, {}).note, /got its database/);
});

// ── the site's own render verdict (run 34, 2026-09-04) ──────────────────────

test("a publish the site's render check calls broken is BROKEN, red, and stops the run — never a -parts route", () => {
  // The gear addon published with `render.findings` saying five real routes
  // threw and `renderNote` saying so; the harness read neither and would have
  // called it ok with the home page showing an error card to every visitor.
  // The decision is DRIVEN — run 34's own findings, as the reply carried them.
  const run34 = { ok: true, render: { ok: true, checked: 8, findings: [
    { route: "/-parts/chord-diagram", viewport: "phone", kind: "threw", detail: "the page did not load (404)" },
    { route: "/-parts/day-space-lookup", viewport: "phone", kind: "threw", detail: "the page did not load (404)" },
    { route: "/es/gear", viewport: "phone", kind: "threw", detail: "Error: useFormField should be used within <FormItem> at Ie (…)" },
    { route: "/es", viewport: "phone", kind: "threw", detail: "Minified React error #418" },
    { route: "/fr/gear", viewport: "phone", kind: "threw", detail: "Error: useFormField should be used within <FormItem> at Ie (…)" },
    { route: "/", viewport: "desktop", kind: "overflow", detail: "a band is wider than the page" },
  ] } };
  const crashed = crashedRoutes(run34);
  assert.deepEqual(crashed.map((f) => f.route), ["/es/gear", "/es", "/fr/gear"], "the three real routes that threw, and neither -parts 404 nor the overflow");
  // `blank` is the other serious kind; a mild finding is not.
  assert.equal(crashedRoutes({ render: { findings: [{ route: "/", kind: "blank", detail: "rendered nothing" }] } }).length, 1);
  assert.equal(crashedRoutes({ render: { findings: [{ route: "/", kind: "overflow" }, { route: "/", kind: "missing-alt" }] } }).length, 0);
  // A CONTAINER THAT WAS BUSY DOES NOT END A RUN (task #87). `slow` is the
  // check's own deadline, not a page that broke, and a run stopped on it is a
  // dispatch spent on nothing — which is what run 39 cost. The severity rule
  // lives in the check and this asks it, so the two cannot drift.
  assert.equal(crashedRoutes({ render: { findings: [{ route: "/", kind: "slow", detail: "Timeout 6000ms exceeded" }] } }).length, 0,
    "a navigation timeout is being read as a site that is down");
  // A reply with no render report answers NOTHING: cannot-tell is not broken.
  assert.deepEqual(crashedRoutes({ ok: true }), []);
  assert.deepEqual(crashedRoutes(null), []);
  assert.deepEqual(crashedRoutes({ render: { findings: "seven" } }), []);
  // A broken case ends the run the way a lie does; an honest verdict does not.
  for (const v of ["BROKEN", "LIE", "NO ANSWER"]) assert.equal(stopsRun(v), true, `${v} lets the run go on`);
  for (const v of ["ok", "ok (honest refusal)", "escalated", "failed", "skipped"]) assert.equal(stopsRun(v), false, `${v} stops the run`);
  // THE CHAIN: the loop asks both, the downgrade applies only to a verdict that
  // was ok, and it happens before the picture and the record are taken.
  const src = readFileSync(new URL("../scripts/addon-sweep.mjs", import.meta.url), "utf8");
  const loop = src.slice(src.indexOf("    const crashed = crashedRoutes(body);"), src.indexOf("    before = after;\n  }"));
  assert.ok(loop.length > 100, "the loop no longer reads the render verdict, or reads it after the record");
  // RE-ANCHORED, NOT APPEASED (2026-09-13): the spelling moved to `shipped()`
  // when the free-text ask gained a pass word of its own ("reported"), and the
  // property — a verdict that SHIPPED is downgraded, one that did not is left
  // alone — is what this asserts.
  assert.match(loop, /shipped\(verdict\) && crashed\.length/, "a verdict that was not ok is downgraded, or an ok one is not");
  assert.match(loop, /verdict = "BROKEN";/);
  assert.ok(loop.indexOf('verdict = "BROKEN";') < loop.indexOf("results.push("), "the record is taken before the downgrade");
  assert.match(loop, /if \(stopsRun\(verdict\)\)/, "the loop does not ask stopsRun");
});

// ─────────────────────────────────────────────────────────────────────────────
// A SENTENCE A PERSON TYPED (owner, 2026-09-13)
// ─────────────────────────────────────────────────────────────────────────────

test("a free-text ask replaces the case table, and says so rather than dropping it", () => {
  // THE DEFAULT IS UNTOUCHED. Every run that gives no ask reads exactly the
  // table it always read — asserted by IDENTITY, because a copy that happens to
  // be equal today is a second list of the same thing.
  assert.equal(casesFor(""), CASES);
  assert.equal(casesFor("   "), CASES);
  assert.equal(casesFor(null), CASES);
  assert.equal(casesFor(undefined), CASES);
  // AND AN ASK REPLACES IT WHOLE — one case, never a table with one more in it,
  // because the budget and the loop are both per-case and a stranger's sentence
  // beside nine fixtures is nine paid runs nobody asked for.
  const one = casesFor("Let people save the lessons they have booked");
  assert.equal(one.length, 1, "a free-text ask did not replace the table");
  assert.equal(one[0].name, "ask");
  assert.equal(one[0].ask, "Let people save the lessons they have booked");
  assert.equal(one[0].freeText, true);
  // NO KIND IS FORCED: which kind the sentence routes to is the answer under
  // test, so a fixture that named one would be marking its own homework.
  assert.deepEqual(one[0].kinds, []);
  // THE CHOOSER ACCEPTS IT, which is the hop that would silently drop it — run
  // 16's `kind,slug.` is this repository's own record of a filter eating the
  // one input that decides what the money buys.
  assert.deepEqual(chooseCases("all", one), ["ask"]);
  assert.deepEqual(chooseCases("ask", one), ["ask"]);
  // AND THE HARNESS REALLY USES THE RUN LIST, both where it chooses the names
  // and where it looks the case up. Two call sites, and a fix that moved only
  // the first would pick the name "ask" and then find no case for it.
  assert.match(SRC, /const RUN_CASES = casesFor\(ASK\);/, "main no longer builds the run list");
  assert.match(SRC, /chooseCases\(ASK \? "all" : WANT, RUN_CASES\)/, "the lane list still filters a free-text run");
  assert.match(SRC, /RUN_CASES\.find\(\(x\) => x\.name === name\)/, "the loop still looks the case up in the fixed table");
  assert.doesNotMatch(SRC, /chooseCases\(WANT, CASES\)/, "the old unconditional chooser is still there");
  // THE IGNORED LANE LIST IS SAID OUT LOUD, never dropped in silence.
  assert.match(SRC, /an ask was given, so the case list/, "a lane list given beside an ask disappears without a word");
});

test("the ask is capped at the route's OWN cap, taken from the route", () => {
  // DERIVED, NOT TYPED. A second number here would let the harness send words
  // the addon route slices off and then judge the answer on them.
  assert.match(SRC, /import \{ MAX_MESSAGE \} from "\.\.\/builder\/site-add\.mjs";/,
    "the cap is no longer the route's own");
  assert.match(SRC, /process\.env\.SWEEP_ASK \|\| ""\)\.trim\(\)\.slice\(0, MAX_MESSAGE\)/,
    "the ask is not bounded at the route's cap");
  assert.equal(typeof MAX_MESSAGE, "number");
  assert.ok(MAX_MESSAGE > 0);
  // A SENTENCE IS NOT A CASE NAME: it keeps its case and its punctuation, or
  // the step is asked a question no customer typed.
  const said = "Add a Members area — so people can SAVE what they booked.";
  assert.equal(casesFor(said)[0].ask, said);
});

test("the free-text verdict reports every outcome, and fails only the hollow one", () => {
  const c = askCase("anything");
  const before = { build: "b1", text: "x".repeat(100), routes: ["/"] };
  const after = (build, len = 100) => ({ build, text: "x".repeat(len), routes: ["/"] });
  // A PUBLISH THAT MADE SOMETHING: reported, and the note carries the database,
  // the pages and the coverage.
  const made = c.check(before, after("b2", 400), {
    ok: true, added: ["src/routes/account.tsx"], changed: [], tables: [{ name: "saved_lessons" }],
    coverage: { total: 3, covered: 2, elsewhere: 1, unsupported: 0, unreadable: 0 },
    requirements: [{ need: "a member sees only their own saved lessons", status: "elsewhere", step: "page" }],
    coverNote: "Still to do: a member sees only their own saved lessons.",
  }, { askKinds: ["table", "page"] });
  assert.equal(made.ok, true);
  assert.match(made.note, /tables \["saved_lessons"\]/);
  assert.match(made.note, /routed to: \["table","page"\]/);
  assert.match(made.note, /coverage 2\/3 covered, 1 handed on, 0 unsupported, 0 unreadable/);
  assert.match(made.note, /STILL OWED: "a member sees only their own saved lessons" \(elsewhere → page\)/);
  assert.match(made.note, /the customer was told:/);
  assert.match(made.note, /build moved/);
  // AN HONEST REFUSAL IS REPORTED, NOT FAILED — refusing with a reason is the
  // product working, which the canary entry records as a decision.
  const refused = c.check(before, after("b1"), { ok: false, error: "already", msg: "your site already has one" }, {});
  assert.equal(refused.ok, true, "a named refusal is being read as a failure");
  assert.match(refused.note, /refused: already/);
  // THE ONE FALSIFIABLE CLAUSE: success, and nothing made, changed or said.
  const hollow = c.check(before, after("b1"), { ok: true }, {});
  assert.equal(hollow.ok, false, "a success that did nothing and said nothing is passing");
  assert.match(hollow.note, /FAILED: it reported success and added nothing/);
  // AND A SUCCESS THAT MADE NOTHING BUT EXPLAINED ITSELF IS NOT HOLLOW — that
  // is the whole point of the coverage work, and reading it as a failure would
  // punish the step for telling the truth.
  const explained = c.check(before, after("b1"), {
    ok: true, coverage: { total: 1, covered: 0, elsewhere: 0, unsupported: 1, unreadable: 0 },
    requirements: [{ need: "see the history of what changed", status: "unsupported", why: "nothing here can show it" }],
  }, {});
  assert.equal(explained.ok, true);
  assert.match(explained.note, /STILL OWED: "see the history of what changed" \(unsupported: nothing here can show it\)/);
  // AN ANSWER WITH NO COVERAGE AT ALL IS SAID, because "nothing outstanding"
  // and "the question was never answered" are different readings.
  assert.match(c.check(before, after("b2"), { ok: true, changed: ["src/routes/index.tsx"] }, {}).note,
    /coverage: the answer carried none/);
  // AND AN INVALID PROPERTY IS COUNTED AND NAMED to the developer.
  assert.match(c.check(before, after("b2"), { ok: true, tables: [{ name: "t" }], invalidProps: ["encryptAtRest"] }, {}).note,
    /guarantee\(s\) the tool does not offer: \["encryptAtRest"\]/);
});

test("a free-text run is judged as SHIPPED where a case run is, so a broken publish is still BROKEN", () => {
  // THE TWO WORDS THAT MEAN SHIPPED. `startsWith("ok")` was written inline
  // twice and is right for the table and silently wrong for "reported" — a
  // stranger's sentence could publish a page the site's own render check calls
  // broken and print a clean word with no picture.
  assert.equal(shipped("ok"), true);
  assert.equal(shipped("ok (honest refusal)"), true);
  assert.equal(shipped("reported"), true);
  for (const v of ["refused", "escalated", "failed", "failed (server)", "LIE", "BROKEN", "NO ANSWER", ""]) {
    assert.equal(shipped(v), false, `${v} is being read as a shipped verdict`);
  }
  // AND BOTH CALL SITES ASK IT — the render downgrade and the screenshot.
  assert.doesNotMatch(CODE, /verdict\.startsWith\("ok"\)/, "a call site still reads the word inline");
  assert.match(SRC, /if \(shipped\(verdict\) && crashed\.length\)/, "the render downgrade no longer covers a reported publish");
  assert.match(SRC, /if \(shipped\(verdict\) && after\.build !== before\.build\)/, "a reported publish takes no screenshot");
  // A REPORTED VERDICT DOES NOT STOP THE RUN; a lie still does.
  assert.equal(stopsRun("reported"), false);
  assert.equal(stopsRun("refused"), false);
  assert.equal(stopsRun("LIE"), true);
});

test("the free-text branch runs the check on EVERY outcome, and reads the record before it", () => {
  // Every other branch decides a verdict first and calls the check only on the
  // shapes it expects, so a refusal or an escalate on a stranger's sentence
  // would print one line and never reach the coverage lines the run was bought
  // for. Read by its own condition, never by position: `if (false)` leaves a
  // call exactly where a position check looks for it.
  const chain = SRC.slice(SRC.indexOf("    let verdict, note;"), SRC.indexOf("    // THE SITE'S OWN RENDER VERDICT IS READ"));
  assert.ok(chain.length > 400, "the verdict chain moved and this window is empty");
  assert.match(chain, /else if \(c\.freeText\) \{/, "the free-text branch is gone from the verdict chain");
  const branch = chain.slice(chain.indexOf("else if (c.freeText) {"));
  assert.match(branch.slice(0, 400), /const chk = c\.check\(before, after, body, extra\);/,
    "the free-text branch no longer runs the check");
  // RE-ANCHORED, NOT APPEASED (2026-09-13): this read the ternary's own
  // spelling, and the ternary went — the sweep survived `refused` mutated to
  // `LIE` right here, because nothing could DRIVE it, so the decision became
  // `askVerdict()` and the case above drives all five outcomes. What stays is
  // the property this window is about: the branch must not decide its own word.
  assert.match(branch.slice(0, 700), /verdict = askVerdict\(\{/, "the free-text branch decides a verdict the guards cannot drive");
  assert.doesNotMatch(branch.slice(0, 700), /\? "failed \(server\)"/, "the chain is back to inline arms");
  // THE RECORD IS READ BEFORE THE VERDICT, because the check PRINTS the kinds
  // and a record fetched after it has nothing to print into.
  const readAt = SRC.indexOf("      extra.askKinds = Array.isArray(ans.kinds)");
  const chainAt = SRC.indexOf("    let verdict, note;");
  assert.ok(readAt > 0, "the developer record is no longer read for a free-text ask");
  assert.ok(readAt < chainAt, "the record is read after the verdict, so the kinds cannot reach the note");
  // AND THE COVERAGE RECORD REACHES THE DEVELOPER. Its three lines were three
  // separate survivors as inline `console.log`s; they are `askLines()` now and
  // the case above drives every one of them. Here: only that the call is made,
  // read by its own condition rather than by position.
  assert.match(SRC, /if \(c\.freeText\) for \(const line of askLines\(ans, extra\.askKinds\)\) console\.log\(line\);/,
    "the coverage record is not printed, which is what the run was bought for");
});

test("the workflow offers the ask, and hands it to the harness", () => {
  // A NEW `workflow_dispatch` INPUT ONLY EXISTS ONCE THE WORKFLOW IS ON THE
  // DEFAULT BRANCH — GitHub reads the form off the default branch's copy — so
  // this pair is what makes the box appear at all.
  assert.match(WF, /^ {6}ask:$/m, "the workflow has no ask input");
  assert.match(WF, /SWEEP_ASK: \$\{\{ github\.event\.inputs\.ask \}\}/, "the ask never reaches the harness");
  // The description must say what it DOES to the case list, because a box that
  // silently overrides another box is the run-16 shape in a form.
  const block = WF.slice(WF.indexOf("      ask:"), WF.indexOf("      picker:"));
  assert.match(block, /replaces the case list/i, "the input does not say that it replaces the case list");
  assert.match(block, /REPORTS/, "the input does not say the run reports rather than judges");
});

// ── THE THREE DECISIONS THE FIRST SWEEP COULD NOT OBSERVE ──────────────────
//
// Five mutants survived the first pass and every one of them was the same
// shape: an inline expression inside `main()` — a `console.log`, a ternary arm
// — that no test could reach, so `if (false)` around it left every landmark
// exactly where a source read looks for them. The recorded "a positional guard
// cannot see a dead branch". Each is a named function now, driven here.

test("a refusal is the product working, and a free-text verdict says so", () => {
  // THE ONE THAT MATTERS: `refused` and `LIE` are both unshipped, so the
  // screenshot and the render downgrade behave identically — the only thing
  // that differs is the RUN'S EXIT CODE, which is why nothing caught it.
  assert.equal(askVerdict({ status: 422, escalated: false, claimedOk: false, checkOk: true }), "refused");
  assert.equal(askVerdict({ status: 422, escalated: false, claimedOk: false, checkOk: false }), "refused",
    "a refusal is being judged by a check written for words the customer never used");
  // Every other outcome, in the order the shape decides them.
  assert.equal(askVerdict({ status: 503, escalated: false, claimedOk: false, checkOk: true }), "failed (server)");
  assert.equal(askVerdict({ status: 500, escalated: true, claimedOk: true, checkOk: true }), "failed (server)",
    "a 5xx must outrank an escalate — a server that died did not decide anything");
  assert.equal(askVerdict({ status: 200, escalated: true, claimedOk: true, checkOk: true }), "escalated");
  assert.equal(askVerdict({ status: 200, escalated: false, claimedOk: true, checkOk: true }), "reported");
  assert.equal(askVerdict({ status: 200, escalated: false, claimedOk: true, checkOk: false }), "LIE",
    "the one failing shape — a success that did nothing and said nothing");
  // And the shipped/unshipped split those words land in.
  assert.equal(shipped(askVerdict({ status: 200, escalated: false, claimedOk: true, checkOk: true })), true);
  for (const v of [{ status: 422, escalated: false, claimedOk: false, checkOk: true },
                   { status: 200, escalated: true, claimedOk: true, checkOk: true },
                   { status: 200, escalated: false, claimedOk: true, checkOk: false }]) {
    assert.equal(shipped(askVerdict(v)), false, "an unshipped verdict is being photographed");
  }
  assert.match(SRC, /verdict = askVerdict\(\{ status: p\.status, escalated, claimedOk, checkOk: chk\.ok \}\);/,
    "the free-text branch decides its own word inline again");
});

test("an ignored case list is a sentence, never a silent drop", () => {
  // RUN 16: a filter on a person's input is a silent drop; a check is a
  // sentence. Two boxes decide what the money buys and one of them loses.
  assert.deepEqual(ignoredNote("", "component"), [], "a run with no ask says something about a list it is using");
  assert.deepEqual(ignoredNote("   ", "component"), []);
  assert.deepEqual(ignoredNote("add a thing", ""), [], "there was no list to ignore");
  assert.deepEqual(ignoredNote("add a thing", "all"), [], "`all` is the default, not a choice being overridden");
  const said = ignoredNote("add a thing", "component,page");
  assert.equal(said.length, 1);
  assert.match(said[0], /component,page/, "the sentence does not name the list it is dropping");
  assert.match(said[0], /not used/i, "the sentence does not say the list was dropped");
  // The cut is its own sentence, and it reads the RAW ask — the bounded one
  // can never be over the cap, so reading it would make this unsayable.
  const long = "x".repeat(MAX_MESSAGE + 40);
  const cut = ignoredNote(long.slice(0, MAX_MESSAGE), "all", long);
  assert.equal(cut.length, 1, "a cut ask says nothing about having been cut");
  assert.match(cut[0], new RegExp(String(MAX_MESSAGE)), "the sentence does not say what it was cut to");
  assert.deepEqual(ignoredNote("short", "all", "short"), [], "an uncut ask is being reported as cut");
  // Both at once.
  assert.equal(ignoredNote(long.slice(0, MAX_MESSAGE), "qr", long).length, 2);
  assert.match(SRC, /for \(const line of ignoredNote\(ASK, WANT, process\.env\.SWEEP_ASK\)\) console\.log\(line\);/,
    "main says it inline again, where nothing can drive it");
});

test("the coverage record reaches the developer, line by line", () => {
  // THIS IS WHAT THE RUN WAS BOUGHT FOR. Three separate mutants silenced three
  // of these lines and the whole suite stayed green.
  const kinds = ["table", "page"];
  const full = askLines({
    coverage: {
      counts: { covered: 1, elsewhere: 1, unsupported: 1 },
      requirements: [
        { need: "keep a record of every change", status: "unsupported", why: "the tool offers no history guarantee" },
        { need: "show them on the page", status: "elsewhere", step: "page" },
        { need: "store the bookings", status: "covered", by: "bookings" },
      ],
      unreadable: [{ need: 17, why: "not a string" }],
      invalidProps: ["encryptAtRest"],
      handedTo: { page: 1 },
    },
  }, kinds);
  const all = full.join("\n");
  assert.match(full[0], /the picker chose: \["table","page"\]/, "the run cannot say which kinds were chosen");
  assert.match(all, /coverage record: .*"covered":1/, "the counts are not printed");
  assert.match(all, /unsupported: "keep a record of every change" — the tool offers no history guarantee/,
    "a requirement's own reason is not printed");
  assert.match(all, /elsewhere: "show them on the page" → page/, "the hand-off is not printed");
  assert.match(all, /covered: "store the bookings" — bookings/, "what covered it is not printed");
  assert.match(all, /UNREADABLE \(not a string\): 17/, "an unreadable requirement is dropped in silence");
  assert.match(all, /properties the tool does not offer: \["encryptAtRest"\]/,
    "a model-authored property the engine drops is never named");
  assert.match(all, /handed to: \{"page":1\}/, "the hand-off map is not printed");
  // ABSENCE IS A SENTENCE. "Nothing was recorded" and "nothing was
  // outstanding" are two readings a blank collapses into one.
  const none = askLines({}, []);
  assert.equal(none.length, 2, "an answer with no coverage prints something other than the two lines");
  assert.match(none[1], /no coverage record/i, "an answer with no coverage reads as nothing outstanding");
  assert.deepEqual(askLines({ coverage: null }, []), none);
  assert.deepEqual(askLines(null, null), none, "a missing record is not said");
  // An empty record still says it IS a record — the counts line separates it.
  const bare = askLines({ coverage: { counts: {} } }, ["qr"]);
  assert.equal(bare.length, 2);
  assert.match(bare[1], /coverage record: \{\}/, "an empty coverage record reads as no record at all");
  // And nothing in it may throw on a hostile shape: this is a model's answer,
  // read back off R2, not something the harness wrote.
  for (const junk of [{ coverage: { requirements: "no", unreadable: 3, invalidProps: {} } },
                      { coverage: { counts: null, handedTo: "x" } }]) {
    assert.doesNotThrow(() => askLines(junk, "not a list"));
  }
  assert.match(SRC, /if \(c\.freeText\) for \(const line of askLines\(ans, extra\.askKinds\)\) console\.log\(line\);/,
    "the record block prints inline again");
});
