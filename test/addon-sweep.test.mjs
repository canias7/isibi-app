// Guards for scripts/addon-sweep.mjs — the harness that drives the ADD step on
// a live site. Kept to properties, not spellings, the way the other two
// harness guards are.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CASES, chooseCases, sitePathOf, watchJob, blindBackend, crashedRoutes, stopsRun, casesFor, askCase, shipped, askVerdict, ignoredNote, askLines, photoLines, customerLines, browserReply, httpOkOf, BROWSER_FNS, inventoryOf, inventoryDiff, inventoryLines, inventoryRefusals, IMAGE_READING, qrOpens, qrPublished, codeRefusals, expectedCode } from "../scripts/addon-sweep.mjs";
import { qrSvg } from "../builder/site-qr.mjs";
import { healthImage } from "../builder/build-lane.mjs";
import { ADD_KINDS, OWN_ADDS, DISPATCHED_ADDS, PLACING_ADDS, addLayer, MAX_MESSAGE, shownSchema } from "../builder/site-add.mjs";
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
  // ── RE-ANCHORED 2026-09-17: THE HOP CASES ARE THE KINDS THAT HOP ALONE ───
  //
  // Each harness case posts ONE ask, so what it exercises is a kind on its own
  // — and `PLACING_ADDS` joined `DISPATCHED_ADDS` in that answer: a photograph
  // by itself is still the picture rung's, and one beside a page or a component
  // is designed here because this step makes the slot. `addLayer` above is the
  // right reader for exactly that reason (it answers what the KIND is), and
  // `DISPATCHED_ADDS` alone is empty today, so pinning to it would have made
  // this a comparison of two empty lists.
  assert.deepEqual(CASES.filter((x) => x.hop).map((x) => x.name).sort(), [...DISPATCHED_ADDS, ...PLACING_ADDS].sort());
  assert.ok(CASES.some((x) => x.hop), "no case hops any more — this block asserts nothing");
  // And the refusal cases are kinds this step designs, which the sweep's site
  // cannot take.
  for (const c of CASES.filter((x) => Array.isArray(x.mayRefuse))) assert.ok(OWN_ADDS.includes(c.name) || PLACING_ADDS.includes(c.name));
});

test("the harness posts to the addon route, follows one hop to the edit route, and never touches the build route", () => {
  assert.match(SRC, /\/api\/site\/\$\{encodeURIComponent\(SLUG\)\}\/addon/, "the harness does not post to the addon route");
  // The post carries the zone a browser would (2026-09-03): a job's clock
  // time is read in it, and the site is in Sheffield.
  assert.match(SRC, /body: \{ instruction: c\.ask, picker: PICKER, idem: hex32\(\), tz: "Europe\/London" \}/, "the addon post does not carry the owner's zone");
  assert.match(SRC, /\/api\/site\/\$\{encodeURIComponent\(SLUG\)\}\/edit/, "the hop does not land on the edit route");
  // RE-ANCHORED, NOT APPEASED (2026-09-15). The needle was the bare prefix
  // `/api/site/build`, and `/api/site/build-health` — the free, read-only
  // cold-start image probe the pre-flight reads — contains it. That is this
  // file's own recorded trap, "a needle that can match a LONGER NAME cannot
  // prove a class", met from the forbidding side: the ban was reporting a
  // diagnostic as the paid route that makes a whole site. The PROPERTY is the
  // build route itself, so the path must END there.
  const NEVER = /react-build|react-revise|\/api\/site\/build(?![-\w])/;
  assert.ok(!NEVER.test(SRC), "the harness reaches for the build route");
  // AND THE OBSERVER IS PROVED ALIVE, in both directions — a ban nobody can
  // trip is a ban nobody is enforcing, and the whole reason this one moved is
  // that it was matching the wrong thing.
  assert.ok(NEVER.test('call("POST", "/api/site/build", {'), "the ban no longer catches the build route it exists for");
  assert.ok(NEVER.test("/api/site/react-build"), "the ban no longer catches the react build route");
  assert.ok(!NEVER.test('call("GET", "/api/site/build-health", { token })'), "the ban still reads the health probe as the build route");
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
  // RE-ANCHORED, NOT APPEASED (2026-09-18): `tables` was `[{ name: … }]` here
  // and the route sends NAMES — `mergeAddonSchema` does `added.push(copy.name)`,
  // driven. It passed because the harness's `names()` tolerates both shapes, and
  // it was the BROWSER's composer (`a.tables.join(', ')`) that exposed it, the
  // moment this report started printing the customer's real screen: the sentence
  // read "now storing [object Object]". A fixture in a shape the route never
  // sends, found by a reader that had never looked — *derive a fixture from its
  // real producer*, met in the guard for a reader of the producer's output.
  const made = c.check(before, after("b2", 400), {
    ok: true, added: ["src/routes/account.tsx"], changed: [], tables: ["saved_lessons"],
    coverage: { total: 3, covered: 2, elsewhere: 1, unsupported: 0, unreadable: 0 },
    requirements: [{ need: "a member sees only their own saved lessons", status: "elsewhere", step: "page" }],
    coverNote: "Still to do: a member sees only their own saved lessons.",
    // RE-ANCHORED AGAIN (2026-09-18): `x` carries the POST's own `status` now,
    // because the browser's selection reads it before it reads the body, and a
    // `check` that never receives it can only report NOT COMPOSED. That is the
    // WIRE, and driving it here is what makes the hop drivable at all — this
    // file's own recorded "a value computed and never forwarded".
  }, { askKinds: ["table", "page"], status: 200 });
  assert.equal(made.ok, true);
  assert.match(made.note, /tables \["saved_lessons"\]/);
  assert.match(made.note, /routed to: \["table","page"\]/);
  assert.match(made.note, /coverage 2\/3 covered, 1 handed on, 0 unsupported, 0 unreadable/);
  assert.match(made.note, /STILL OWED: "a member sees only their own saved lessons" \(elsewhere → page\)/);
  // RE-ANCHORED TWICE, NOT APPEASED. It was `/the customer was told:/`, which
  // was the property "the coverage sentence reaches the report" only while
  // `coverNote` was the ONLY sentence printed; then "sentence by sentence",
  // which was the per-field breakdown. The property now is STRICTLY STRONGER
  // and is two claims: the customer's real screen — the browser's own
  // `addonReplyText`, EXECUTED — and the server's sentence carried whole and
  // NAMED beneath it. Neither substitutes for the other: the first is what a
  // person sees, the second is which field it came from.
  //
  // AND A THIRD TIME (2026-09-18), onto `addonAnswer` — the browser SELECTS
  // before it composes, and the harness ran the success composer on every
  // outcome. The status the reader was handed is asserted with it, or a
  // hardcoded 200 inside `customerLines` satisfies this exactly.
  assert.match(made.note, /the customer's screen \(the browser's own addonAnswer, executed, HTTP 200\)/);
  assert.match(made.note, /▸ .*Still to do: a member sees only their own saved lessons\./,
    "the browser's composition never reaches the report — " + made.note);
  assert.match(made.note, /▸ .*now storing saved_lessons/,
    "the customer's own sentence does not name the table this change made");
  assert.match(made.note, /server sentences carried whole \(1\):/);
  assert.match(made.note, /· coverNote: "Still to do: a member sees only their own saved lessons\."/);
  assert.match(made.note, /build moved/);
  // AN HONEST REFUSAL IS REPORTED, NOT FAILED — refusing with a reason is the
  // product working, which the canary entry records as a decision.
  const refused = c.check(before, after("b1"), { ok: false, error: "already", msg: "your site already has one" }, {});
  assert.equal(refused.ok, true, "a named refusal is being read as a failure");
  assert.match(refused.note, /refused: already/);
  // …AND ITS SENTENCE IS THE ONE THE CUSTOMER REALLY GOT. A refusal's whole
  // reply is `msg`, and until this the report printed `coverNote` or nothing —
  // so the one outcome whose entire customer-facing text lives in one field was
  // the outcome that lost it.
  assert.match(refused.note, /· msg: "your site already has one"/,
    "a refusal's own sentence never reaches the report");
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

test("the photograph numbers reach the report on every outcome, and absent is not zero", () => {
  // *"Add the photo response fields to the harness output, including failure
  // responses."* (owner, 2026-09-18). MEASURED before this was written:
  // `pictures`, `pictureNote`, `photos` and `lostPhotos` occurred ZERO times in
  // the harness, so a run bought to prove a photograph was bought, preserved
  // and placed came back with no reading of any of it.
  const bought = photoLines({ ok: true, pictures: 1, photos: 0, pictureNote: "Made 1 photograph for the site." }).join("\n");
  assert.match(bought, /bought 1;/);
  assert.match(bought, /empty frames left 0;/);
  assert.match(bought, /existing ones LOST 0/);
  assert.match(bought, /the picture sentence: "Made 1 photograph for the site\."/);
  // ABSENT IS NOT ZERO, AND THE TWO READINGS ARE THE POINT. `photos` rides
  // every success; `pictures` rides only a change that really bought one — so
  // "it shipped and bought none" and "the request never reached the purchase"
  // are different facts, and a bare 0 for either collapses them.
  const none = photoLines({ ok: true, photos: 2 }).join("\n");
  assert.match(none, /bought \(not said\);/, "a success that bought none is being reported as a zero purchase");
  assert.match(none, /empty frames left 2;/);
  const refused = photoLines({ ok: false, error: "lost-photos", lostPhotos: ["/u/fw/a1.jpg", "/u/fw/b2.jpg"] }).join("\n");
  assert.match(refused, /bought \(not said\); empty frames left \(not said\);/,
    "a refusal's absent counts read as zeroes — 'bought none' and 'never got there' are one line");
  assert.match(refused, /existing ones LOST 2 — \["\/u\/fw\/a1\.jpg","\/u\/fw\/b2\.jpg"\]/,
    "the photographs a refusal says would have been lost are not named");
  // AND A REPLY WITH NOTHING IN IT STILL SAYS SO, every field, rather than
  // printing nothing — a blank line and "no photograph was involved" are two
  // readings this run cannot afford to collapse.
  for (const shape of [{}, null, undefined, "nonsense", []]) {
    const lines = photoLines(shape);
    assert.equal(lines.length, 2, JSON.stringify(shape) + " prints " + JSON.stringify(lines));
    assert.match(lines[0], /photographs: bought \(not said\)/);
    assert.match(lines[1], /the picture sentence: \(none/);
  }
  // THE PICTURE SENTENCE IS PRINTED VERBATIM AND NEVER SUMMARISED. It is the
  // one thing that can tell four identical blank frames apart — bought,
  // unaffordable, refused by the provider, none asked for — so a word of our
  // own in its place would be the harness deciding which of the four it was.
  const sorry = "Couldn’t make the photographs this time, so the pictures are placeholders — the site is otherwise fine.";
  assert.ok(photoLines({ ok: true, photos: 1, pictureNote: sorry }).join("\n").includes(sorry),
    "the provider-failure sentence is being reworded rather than quoted");
});

test("the whole customer reply is reported, not one sentence of it, and the set is discovered from the reply", () => {
  // *"Capture the complete customer reply as well as pictureNote."* `coverNote`
  // alone was printed, which is one sentence of several — and a REFUSAL's whole
  // reply is `msg`, so the one outcome whose entire customer-facing text lives
  // in a single field was the outcome that lost it.
  const many = customerLines({
    ok: true,
    coverNote: "I've set that up, but I can't confirm from here that …",
    pictureNote: "Made 1 photograph for the site.",
    keptPartsNote: "I've left tide-chart as it was.",
  }).join("\n");
  assert.match(many, /server sentences carried whole \(3\):/, many);
  for (const k of ["coverNote", "pictureNote", "keptPartsNote"]) assert.match(many, new RegExp("· " + k + ": \""));
  const refused = customerLines({ ok: false, error: "qr-dependency", msg: "I haven't put the code up — it opens /gallery, which didn't make it." }).join("\n");
  assert.match(refused, /· msg: "I haven't put the code up/, refused);
  // ── THE SCREEN ITSELF, EXECUTED (2026-09-18) ───────────────────────────────
  //
  // *"customerLines currently reports 'NOTHING' for a response whose browser
  // formatter produces the success sentence, placeholder explanation and missing
  // link warning. Reuse or execute the existing formatter; don't create another
  // composition."* (owner). The per-field breakdown above is complete for what
  // the browser prints VERBATIM — the census below proves that rule — and says
  // nothing about what it COMPOSES, which is most of what a customer reads.
  const composed = customerLines({
    ok: true, added: ["src/routes/gallery.tsx"], changed: ["src/routes/index.tsx"],
    photos: 1, unlinked: ["/gallery"],
  }, 200).join("\n");
  assert.match(composed, /the customer's screen \(the browser's own \w+, executed, HTTP 200\)/, composed);
  assert.match(composed, /▸ ✅ Done — added \/gallery, updated \/\./, "the success sentence is missing — " + composed);
  assert.match(composed, /upload yours in the Data panel/, "the placeholder explanation is missing — " + composed);
  assert.match(composed, /Nothing links to \/gallery yet/, "the missing-link warning is missing — " + composed);
  // …and the reply it was composed from carries NOT ONE of the `*Note` fields,
  // so this is exactly the shape that used to read "NOTHING". Asserted rather
  // than assumed, or the case above could be passing on a sentence it quoted.
  assert.match(composed, /server sentences carried whole: NONE/,
    "this case no longer isolates the composed half — " + composed);
  // NOTHING AT ALL IS STILL A SENTENCE, not a blank: a reply the browser
  // composes to nothing but "✅ Done." carries no server sentence, and saying
  // which half is empty is the reading.
  assert.match(customerLines({ ok: true }).join("\n"), /server sentences carried whole: NONE/);
  assert.match(customerLines().join("\n"), /server sentences carried whole: NONE/);
  // AN EMPTY STRING IS NOT A SENTENCE EITHER — the route writes `undefined` for
  // an absent note, and a `""` that slipped through would print as a quoted
  // nothing and read as the customer having been told something.
  assert.match(customerLines({ coverNote: "", pictureNote: "   " }).join("\n"), /server sentences carried whole: NONE/);
  // AND THE COMPOSER IS THE PAGE'S OWN, not a copy: `browserReply` loads
  // `public/chat.js` and executes `addonReplyText` out of it, so a change to the
  // browser's wording changes this report with no second edit — which is the
  // owner's *"don't create another composition"* as a property rather than a
  // promise. A composer that could not be loaded says so and never guesses.
  const got = browserReply({ ok: true, added: ["src/routes/gallery.tsx"] }, true);
  assert.equal(got.ok, true, "the browser's composer did not load: " + got.why);
  assert.match(got.text, /added \/gallery/);
  // A FILE PATH IN, A ROUTE OUT — `sitePathOf` is the page's own reader and the
  // report inherits it by executing the page rather than re-implementing it.
  assert.ok(!got.text.includes("src/routes/"), "a raw file path reached the customer's screen: " + got.text);
  // AND THE PAGE'S TAIL IS PART OF THE SCREEN. `renderTail` prints `renderNote`
  // — what the render check found, which the route puts on every reply that has
  // one — and it is the half a person reads as "and here is what is wrong with
  // it". A composer that ran `addonReplyText` alone would look right on every
  // clean reply and lose exactly the ones worth reading; nothing had a
  // `renderNote` in it until a sweep mutant dropped the tail and survived.
  const tailed = browserReply({ ok: true, added: ["src/routes/gallery.tsx"], renderNote: "  /gallery threw on load.  " }, true);
  assert.match(tailed.text, /\/gallery threw on load\./, "the render note never reaches the screen: " + tailed.text);
  assert.match(customerLines({ ok: true, added: ["src/routes/gallery.tsx"], renderNote: "/gallery threw on load." }, 200).join("\n"),
    /▸ \/gallery threw on load\./, "the render note is not a line of the customer's screen");
  // ── THE CENSUS, BOTH WAYS ──────────────────────────────────────────────────
  //
  // The set is DISCOVERED from the reply (`msg`, then every `*Note` carrying a
  // string) rather than typed here, because a second list of the server's
  // sentence fields is the recorded two-copies trap and the copy that drifts is
  // always the reader's. This is what makes the discovery rule sufficient: every
  // sentence the BROWSER prints verbatim must be a field that rule reaches.
  const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const at = chat.indexOf("function addonReplyText(a) {");
  assert.ok(at > 0, "the browser's addon composer moved — this census is reading nothing");
  const body = chat.slice(at, chat.indexOf("\nfunction ", at + 10));
  const verbatim = [...body.matchAll(/out \+= . . \+ a\.(\w+);/g)].map((m) => m[1]);
  assert.ok(verbatim.length >= 3, "the census found " + verbatim.length + " verbatim sentence prints — it is reading the wrong window");
  for (const f of verbatim) {
    assert.ok(f === "msg" || /Note$/.test(f),
      `the browser prints a.${f} verbatim to the customer and the harness's discovery rule (msg + *Note) cannot reach it`);
    // …and each is really picked up, driven rather than reasoned about.
    assert.match(customerLines({ [f]: "a sentence" }).join("\n"), new RegExp("· " + f + ": \"a sentence\""));
  }
});

test("the browser's own selection decides which screen a reply gets, status included, and no external action runs", () => {
  // Owner, 2026-09-18: *"browserReply invokes the success formatter on refusals.
  // For {ok:false, error:"lost-photos", msg:"…"} the harness labels '✅ Done.' as
  // the customer's screen. The browser's addonAnswer instead displays the warning
  // plus msg. Respect the browser's actual response selection, including HTTP
  // status… Drive a refusal and a successful response through the real browser
  // handling, with no external actions."*
  //
  // THE ROUND BEFORE THIS FIXED COMPOSITION AND LEFT SELECTION RE-IMPLEMENTED.
  // `addonReplyText` is the SUCCESS composer and was run unconditionally, which
  // is the two-copies trap one layer up from where it was just closed: the
  // browser SELECTS first (escalate / no body / non-2xx-or-ok:false / applied)
  // and only the last branch composes.

  // ── 1. THE REPORTED REFUSAL, DRIVEN ────────────────────────────────────────
  const REF = { ok: false, error: "lost-photos", msg: "Nothing was published and nothing was charged." };
  const refused = browserReply(REF, httpOkOf(422));
  assert.equal(refused.ok, true, "the browser's handling did not load: " + refused.why);
  assert.equal(refused.text, "⚠️ Nothing was published and nothing was charged.",
    "a refusal is not getting the browser's own refusal screen: " + JSON.stringify(refused.text));
  assert.ok(!/✅ Done/.test(refused.text), "THE REPORTED DEFECT: the success composer ran on a refusal — " + refused.text);
  // …and through the reader the run really uses, where the label has to say which
  // function was executed — a report headed `addonReplyText` over a refusal is
  // the defect wearing the fix's own words.
  const refLines = customerLines(REF, 422).join("\n");
  assert.match(refLines, /the customer's screen \(the browser's own addonAnswer, executed, HTTP 422\)/, refLines);
  assert.match(refLines, /▸ ⚠️ Nothing was published and nothing was charged\./, refLines);
  assert.ok(!/✅ Done/.test(refLines), "the reported defect, through customerLines — " + refLines);

  // ── 2. A SUCCESS, THROUGH THE SAME HANDLING ────────────────────────────────
  //
  // The control: the same entry point, the same seams, the branch that DOES
  // compose. Without it, "refusals no longer say Done" is satisfied by a reader
  // that says nothing about anything.
  const OK = { ok: true, added: ["src/routes/gallery.tsx"], changed: ["src/routes/index.tsx"], unlinked: ["/gallery"] };
  const won = browserReply(OK, httpOkOf(200));
  assert.equal(won.ok, true, won.why);
  assert.match(won.text, /^✅ Done — added \/gallery, updated \/\./, won.text);
  assert.match(won.text, /Nothing links to \/gallery yet/, won.text);
  assert.match(customerLines(OK, 200).join("\n"), /▸ ✅ Done — added \/gallery/);

  // ── 3. THE STATUS IS LOAD-BEARING, and only one pair proves it ─────────────
  //
  // `{ok:false}` reaches the refusal branch at ANY status (`!httpOk || !a.ok`),
  // so the reported pair cannot show the status being read at all. A body that
  // claims success at a failing status is the shape where the two disagree —
  // and it is the real one: a 422 is what this route answers when a publish did
  // not land, and reading a stale `ok:true` off it would report a change that
  // never happened as done.
  const CLAIMS = { ok: true, added: ["src/routes/gallery.tsx"] };
  assert.match(browserReply(CLAIMS, httpOkOf(200)).text, /✅ Done — added \/gallery/,
    "the control failed: a 200 with ok:true must reach the success composer");
  const atFail = browserReply(CLAIMS, httpOkOf(422));
  assert.ok(!/✅ Done/.test(atFail.text),
    "the HTTP status is not being read — a body claiming success at 422 reached the success composer: " + atFail.text);
  assert.equal(atFail.shown, false, "nothing is shown on that branch; the browser falls instead");
  // AND `msg` WINS OVER THE BODY'S OWN `ok` at a failing status, which is the
  // half a customer actually sees.
  assert.equal(browserReply({ ok: true, msg: "the body says both", added: ["src/routes/gallery.tsx"] }, httpOkOf(422)).text,
    "⚠️ the body says both");

  // ── 4. CANNOT-TELL REFUSES, in both directions ─────────────────────────────
  //
  // `undefined` is an answer the browser never has and this harness can. Reading
  // it as `false` reports a refusal screen over a successful change; as `true`
  // it is the reported defect. Three states, and the third is a refusal.
  assert.equal(httpOkOf(200), true);
  assert.equal(httpOkOf(299), true);
  assert.equal(httpOkOf(300), false);
  assert.equal(httpOkOf(199), false);
  assert.equal(httpOkOf(422), false);
  for (const junk of [undefined, null, NaN, "200", Infinity, {}]) {
    assert.equal(httpOkOf(junk), null, "a status of " + JSON.stringify(String(junk)) + " is cannot-tell, never a branch");
  }
  const blind = browserReply(OK, httpOkOf(undefined));
  assert.equal(blind.ok, false, "a reply with no status was composed anyway");
  assert.equal(blind.text, "", "a refusal to compose must carry no text");
  assert.match(blind.why, /status was not recorded/);
  assert.match(customerLines(OK).join("\n"), /the customer's screen: NOT COMPOSED/);

  // ── 5. NO EXTERNAL ACTION, AND THE TWO EXPENSIVE ONES ARE RECORDED ─────────
  //
  // The browser's other two branches do not print — they ACT: an escalate posts
  // a SECOND paid request to the edit route, and a fall starts the ~25-credit
  // rewrite. Both are injected recorders here, so a harness reading a reply can
  // never spend; and both are REPORTED, because a run that printed only the text
  // would be silent about the expensive half of what the browser would do.
  const hop = browserReply({ escalate: true, layer: "picture" }, httpOkOf(200));
  assert.equal(hop.ok, true, hop.why);
  assert.equal(hop.shown, false, "an escalate shows nothing — it hops");
  assert.equal(hop.text, "", "an escalate must not compose a screen");
  assert.equal(hop.actions.length, 1, JSON.stringify(hop.actions));
  assert.match(hop.actions[0], /SECOND, PAID request to the edit route \(layer "picture"\)/, hop.actions[0]);
  const fell = browserReply({ ok: false, error: "qr-dependency" }, httpOkOf(422));
  assert.equal(fell.shown, false, "a refusal with no msg shows nothing — it falls to the rewrite");
  assert.deepEqual(fell.actions, ["start the FULL ~25-credit rewrite (the browser's `fallback`)"], JSON.stringify(fell.actions));
  assert.deepEqual(browserReply(null, httpOkOf(500)).actions,
    ["start the FULL ~25-credit rewrite (the browser's `fallback`)"], "a body that would not parse falls too");
  // …and both are on the report, labelled as NOT having happened.
  const hopLines = customerLines({ escalate: true, layer: "picture" }, 200).join("\n");
  assert.match(hopLines, /the browser would then \(NOT done here — recorded only\), 1:/, hopLines);
  assert.match(hopLines, /↳ post a SECOND, PAID request/, hopLines);
  assert.match(hopLines, /nothing was shown — this reply takes a branch that acts instead of printing/, hopLines);
  // A SUCCESS RECORDS THE CREDIT REFRESH AND NOTHING ELSE. `siteById` answers
  // null here — the harness holds no browser record — so the whole local-record
  // mutation block is skipped and `sitesSave` is unreachable, which is what
  // makes "no external action" a property of the seams rather than of care.
  assert.deepEqual(won.actions, ["refresh the credit balance"], JSON.stringify(won.actions));
  for (const r of [refused, atFail, fell, hop]) {
    assert.ok(!r.actions.some((a) => /stored site list/.test(a)),
      "the browser's own site list was written from a harness read: " + JSON.stringify(r.actions));
  }

  // ── 6. THE ENTRY POINT IS THE BROWSER'S, and the cut set is closed ─────────
  //
  // Every branch above returned `ok: true`, which is the closure proof: the cut
  // functions are evaluated in a scope holding nothing but the five injected
  // seams, so a bare call to anything else is a ReferenceError caught into
  // `ok: false` — this file's own free-identifier trap, answered by driving
  // rather than by a grep. What a name census adds is the ENTRY: the selection
  // must be `addonAnswer`, or a later edit could quietly point this back at the
  // success composer with every branch still loading.
  assert.ok(BROWSER_FNS.includes("addonAnswer"), "the browser's selection is not in the executed set");
  assert.ok(BROWSER_FNS.includes("applyAddonResult"), "the applied branch is not in the executed set");
  assert.ok(BROWSER_FNS.includes("alsoTail"), "the real call site's third term is missing");
  const chatSrc = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  for (const n of BROWSER_FNS) {
    assert.ok(chatSrc.includes("function " + n + "("), "the executed set names " + n + ", which is gone from chat.js");
  }
  // ⚠ …AND EVERY COMPOSER THE REPLY TEXT CALLS MUST BE IN IT (2026-09-19). The
  // set is the whole of what the cut source has in scope, so a sentence added to
  // `addonReplyText` whose helper is not named here is a `ReferenceError` on the
  // first reply that reaches it — the reader answers `{ok: false}` and a paid run
  // comes back with no customer screen at all. That is what `listPhotoNote` did
  // the hour it was written, caught by a route case rather than here; this is the
  // half that makes the NEXT one fail at the guard.
  //
  // DERIVED FROM `addonReplyText`'S OWN BODY, never a list beside it: every name
  // it calls that `chat.js` defines as a top-level function has to be in the set.
  // A call to something chat.js does NOT define is somebody else's — a global, a
  // method, an injected seam — and is not this census's business.
  const bodyAt = chatSrc.indexOf("function addonReplyText(");
  assert.ok(bodyAt > 0, "addonReplyText is gone from chat.js");
  const bodyEnd = chatSrc.indexOf("\n}", bodyAt);
  assert.ok(bodyEnd > bodyAt, "addonReplyText has no end in chat.js");
  const called = new Set();
  for (const m of chatSrc.slice(bodyAt, bodyEnd).matchAll(/(^|[^\w$.])([a-z][\w$]*)\s*\(/g)) called.add(m[2]);
  const defined = new Set();
  for (const m of chatSrc.matchAll(/(^|\n)function ([A-Za-z_$][\w$]*)\(/g)) defined.add(m[2]);
  const missing = [...called].filter((n) => defined.has(n) && !BROWSER_FNS.includes(n));
  assert.deepEqual(missing, [],
    "addonReplyText calls " + JSON.stringify(missing) + ", which the cut source will not have in scope");
  // THE OBSERVER IS ALIVE, so the empty answer above is a pass and not a scan
  // that matched nothing: the two it definitely calls are found.
  assert.ok(called.has("photoNote") && called.has("listPhotoNote"),
    "the call scan found neither photo sentence — it is reading the wrong body");
  // AND THE BROWSER REALLY HANDS ITS RESPONSE'S `ok` TO IT — read at the call
  // site, so the harness's `httpOk` is the same thing the page's is.
  assert.match(chatSrc, /return addonAnswer\(r && r\.ok, a, \{/,
    "the browser's addon call no longer hands addonAnswer its response's own ok — the harness's status is modelling something else");
  // AND A BODY THAT WOULD NOT PARSE IS `null` THERE, which is why it is `null`
  // here. That coercion is MEASURED INERT today — every non-success branch of
  // `addonAnswer` converges on the fall — so this is what pins it to the page's
  // own reader rather than to a choice somebody made: the correspondence is the
  // claim, and the sweep mutates the line as a pair with it.
  assert.match(chatSrc, /const a = await r\.json\(\)\.catch\(\(\) => null\);/,
    "the browser no longer reads an unparseable body as null — the harness is modelling something else");
  assert.match(CODE, /\(reply && typeof reply === "object"\) \? reply : null/,
    "the harness no longer hands on what the browser's own reader would");

  // ── 7. AND THE STATUS IS REALLY PUT ON THE WIRE ────────────────────────────
  //
  // The reader above is proved by driving; the PRODUCER is one line in the
  // runner that no module test can reach — `extra` is built beside the POST —
  // and a reader handed nothing answers NOT COMPOSED on every case of a paid
  // run. A value computed and never forwarded is this repository's most
  // repeated defect, and the run this instrument exists for is the one place
  // it would cost money to discover.
  assert.match(CODE, /const extra = \{ status: p && p\.status \}/,
    "the POST's status is not carried to the check — every reply would read NOT COMPOSED");
});

test("the report reads the photographs and the reply on a refusal, which is the outcome that used to lose them", () => {
  // The free-text branch runs `check` on EVERY outcome — that is asserted
  // elsewhere — so the property here is that these two readers are asked
  // UNCONDITIONALLY and never behind `r.ok`. A 422 is where it matters: it
  // carries `lostPhotos` and `msg` and nothing else about what happened.
  const c = askCase("add a gallery page with a photo of the workshop");
  const before = { build: "b1", text: "x".repeat(100), routes: ["/"] };
  const after = { build: "b1", text: "x".repeat(100), routes: ["/"] };
  const lost = c.check(before, after, {
    ok: false, error: "lost-photos", cost: 0,
    lostPhotos: ["/u/ag/86833f9a21022de9a22d55cd6bc3ba0d.jpg"],
    msg: "I'd have taken a photograph off your site doing that, so I've left it alone.",
  }, { status: 422 });
  assert.equal(lost.ok, true, "a named refusal is being read as a failure");
  assert.match(lost.note, /existing ones LOST 1 — \["\/u\/ag\/86833f9a21022de9a22d55cd6bc3ba0d\.jpg"\]/,
    "the refusal's own lost-photograph list never reaches the report");
  // …AND THE FOURTH READING IS ABSENT RATHER THAN ZERO on a refusal, which is
  // the honest pair: a Worker that predates the field and a change that added
  // no list frame are two different facts, and a 422 carries neither.
  assert.match(lost.note, /list frames nothing can fill \(not said\)/, lost.note);
  assert.match(lost.note, /· msg: "I'd have taken a photograph off your site/);
  assert.match(lost.note, /refused: lost-photos/);
  // AND THE SCREEN IS THE REFUSAL'S OWN (2026-09-18, re-anchored not appeased —
  // this guard is about the refusal outcome, so it is where the refusal SCREEN
  // belongs). The harness ran the SUCCESS composer here and labelled a 422 that
  // published nothing `✅ Done.`; the browser shows the warning and the `msg`.
  assert.match(lost.note, /▸ ⚠️ I'd have taken a photograph off your site doing that, so I've left it alone\./, lost.note);
  assert.ok(!/✅ Done/.test(lost.note), "the success composer ran on a 422 — " + lost.note);
  // AND ON A SUCCESS, the numbers and the sentence both.
  const ok = c.check(before, { build: "b2", text: "x".repeat(400), routes: ["/", "/gallery"] }, {
    ok: true, added: ["src/routes/gallery.tsx"], changed: ["src/routes/index.tsx"],
    pictures: 1, photos: 0, listPhotos: 6, pictureNote: "Made 1 photograph for the site.",
    coverNote: "I've set that up, but I can't confirm from here that …",
  }, { askKinds: ["page", "photo"], status: 200 });
  // RE-ANCHORED 2026-09-19, NOT APPEASED: the line gained a fourth reading, and
  // the property was never the spelling — it is that every photograph fact the
  // reply carries reaches the report. `listPhotos` is here because run 51
  // reported "empty frames left 1" over a page a browser measured at SEVEN, and
  // a report printing only `photos` would repeat that understatement in the
  // instrument bought to catch it.
  assert.match(ok.note, /photographs: bought 1; empty frames left 0; list frames nothing can fill 6; existing ones LOST 0/, ok.note);
  assert.match(ok.note, /the picture sentence: "Made 1 photograph for the site\."/);
  // RE-ANCHORED, NOT APPEASED: "sentence by sentence" was the per-field
  // breakdown's own wording. Both halves are asserted now — the screen a person
  // sees, and the two server sentences named beneath it.
  assert.match(ok.note, /▸ ✅ Done — added \/gallery, updated \/\..*Made 1 photograph for the site\./, ok.note);
  assert.match(ok.note, /server sentences carried whole \(2\):/, ok.note);
  // THE WIRING, by the branch rather than by position: a `check` that computed
  // these and left them off the note is the recorded value-never-forwarded
  // defect, which is exactly how the harness came to be photograph-blind.
  assert.match(CODE, /const pics = photoLines\(r\)/, "the check no longer reads the photograph fields");
  // THE STATUS IS PART OF THAT WIRE. Re-anchored onto the property rather than
  // the old spelling `customerLines(r)`: the reader must be handed the POST's
  // own status, and the two cases above — 422 and 200, two screens from one
  // reader — are what prove it arrives rather than being hardcoded.
  assert.match(CODE, /const told = customerLines\(r, x && x\.status\)/, "the check no longer hands the reader the response's status");
  assert.match(CODE, /\\n {6}\$\{pics\}/, "the photograph lines are computed and never printed");
  assert.match(CODE, /\\n {6}\$\{told\}/, "the customer's sentences are computed and never printed");
});

test("the before/after inventory is the stored source, and a lost thing is said loudly", () => {
  // *"Record a fresh before-inventory of routes, QR codes and existing image
  // references… Don't treat guessed filenames or sitemap entries alone as a
  // complete inventory."* (owner, 2026-09-18). `GET /api/site/source` IS the
  // store: the page list, the components, and `assets`, which carries each
  // code's file name AND the drawing the build bakes.
  const src = (over = {}) => ({
    ok: true,
    pages: [{ path: "src/routes/index.tsx", source: '<SafeImage src="/u/ag/a1.jpg" alt="the bench"/>' }],
    parts: [{ name: "gallery-band", source: '<SafeImage src="/u/ag/b2.jpg" alt="a chair"/>' }],
    assets: [{ path: "public/icon.svg", source: "<svg/>" }, { path: "public/qr-wifi.svg", source: qrSvg("https://ag.gofarther.app/").svg }],
    ...over,
  });
  const before = inventoryOf(src(), "ag");
  assert.deepEqual(before.routes, ["/"]);
  assert.deepEqual(before.qrFiles, ["qr-wifi.svg"], "a code is not being found by the emitter's own naming");
  // A PHOTOGRAPH INSIDE A COMPONENT IS A PHOTOGRAPH — reading only the pages is
  // the defect this repository fixed one milestone ago, and an inventory that
  // repeated it would report a component's picture as newly lost.
  assert.deepEqual(before.photos, ["/u/ag/a1.jpg", "/u/ag/b2.jpg"]);
  // …AND THE LEGACY SINGLE CODE IS `qr.svg`, with no name in it at all: a
  // `qr-` prefix typed here would miss it on exactly the oldest sites.
  assert.deepEqual(inventoryOf(src({ assets: [{ path: "public/qr.svg", source: "x" }] }), "ag").qrFiles, ["qr.svg"]);
  // ANOTHER SITE'S UPLOADS ARE NOT OURS.
  assert.deepEqual(inventoryOf(src(), "other").photos, [], "the inventory counts a different site's pictures as this one's");

  const after = inventoryOf(src({
    pages: [
      { path: "src/routes/index.tsx", source: '<SafeImage src="/u/ag/a1.jpg" alt="the bench"/>' },
      { path: "src/routes/gallery.tsx", source: '<SafeImage src="/u/ag/c3.jpg" alt="new"/><img src="/qr-gallery.svg"/>' },
    ],
    // THE COMPONENT IS GONE, AND ITS PICTURE WITH IT — which is the shape the
    // loss line exists for. `src()` SPREADS over its base, so leaving `parts`
    // out would have kept the component and the case would have asserted
    // nothing; measured as `photosLost: []` before this line was written.
    parts: [],
    assets: [
      { path: "public/icon.svg", source: "<svg/>" },
      { path: "public/qr-wifi.svg", source: qrSvg("https://ag.gofarther.app/").svg },
      { path: "public/qr-gallery.svg", source: qrSvg("https://ag.gofarther.app/gallery").svg },
    ],
  }), "ag");
  const d = inventoryDiff(before, after);
  assert.deepEqual(d.routesAdded, ["/gallery"]);
  assert.deepEqual(d.qrsAdded, ["qr-gallery.svg"]);
  assert.deepEqual(d.photosAdded, ["/u/ag/c3.jpg"]);
  // THE LOSS IS THE FINDING THIS EXISTS FOR, and it must not be something a
  // reader has to spot by comparing two lists of paths.
  assert.deepEqual(d.photosLost, ["/u/ag/b2.jpg"], "the component's picture went with the component and nothing noticed");
  const lines = inventoryLines(before, after, {}).join("\n");
  assert.match(lines, /⚠ THIS CHANGE LOST 1: \["photograph \/u\/ag\/b2\.jpg"\]/, lines);
  // A READ THAT FAILED IS NOT AN EMPTY DIFF. `null` on either side has to say so
  // — an inventory nobody took and a change that moved nothing print the same
  // zeroes otherwise.
  for (const [b, a] of [[null, after], [before, null], [null, null]]) {
    assert.match(inventoryLines(b, a, {}).join("\n"), /inventory: NOT TAKEN/, `${!b}/${!a} reported a comparison it could not make`);
  }
  assert.deepEqual(inventoryLines(null, after, {}).length, 1, "a missing inventory still printed a diff");
});

test("a QR's destination is read off the drawing, against every address the site has", () => {
  // *"Decode the generated QR and assert that it opens the actual new gallery
  // URL. Discover its name from the result instead of assuming 'gallery'."*
  // The NAME comes from whichever file appeared in the diff; the DESTINATION is
  // established by re-encoding each candidate and comparing module for module —
  // `qrEncodes`, the guard's own comparison, shared so the live check and the
  // guard cannot disagree about our own artwork.
  const origin = "https://ag.gofarther.app";
  const urls = [origin + "/", origin + "/gallery", origin + "/about"];
  const hit = qrOpens(qrSvg(origin + "/gallery").svg, urls);
  assert.equal(hit.ok, true, JSON.stringify(hit));
  assert.equal(hit.url, origin + "/gallery", "the code's own address is not the one reported");
  // THE OBSERVER PROVED ALIVE IN THE OTHER DIRECTION — a code for an address
  // the site has NOT got is not a match, and saying so is the whole point: a
  // code for /galery is perfectly scannable and opens a 404.
  const miss = qrOpens(qrSvg(origin + "/galery").svg, urls);
  assert.equal(miss.ok, false, "a code for an address this site has not got is being read as a match");
  assert.match(miss.why, /opens none of the 3 address/, miss.why);
  // AN UNREADABLE DRAWING IS ITS OWN ANSWER, never "the wrong address": one is
  // a broken picture and the other is a wrong destination, and they need
  // different fixes.
  assert.match(qrOpens("<svg/>", urls).why, /could not be read/);
  assert.match(qrOpens(qrSvg(origin + "/").svg, []).why, /no candidate address/, "an empty candidate list passed for free");
  // AND THE REPORT NAMES THE ADDRESS THAT WAS WANTED, both ways round, so a
  // code that opens a real page which is not the NEW one is still a finding.
  // THE FIXTURES ARE `inventoryOf`'S OWN OUTPUT, not hand-built shapes: a
  // hand-built one carries no `complete`, which this reader has an answer for,
  // and the recorded rule is to derive a fixture from its real producer.
  const inv = (assets, pages) => inventoryOf({
    ok: true, reads: { pages: true, parts: true, assets: true },
    pages: pages.map((p) => ({ path: "src/routes/" + p, source: "" })), parts: [], assets,
  }, "ag");
  const lines = (want) => inventoryLines(
    inv([], ["index.tsx"]),
    inv([{ path: "public/qr-g.svg", source: "<svg/>" }], ["index.tsx", "gallery.tsx"]),
    { opens: { "qr-g.svg": hit }, want },
  ).join("\n");
  assert.match(lines(origin + "/gallery"), /STORED settings: opens https:\/\/ag\.gofarther\.app\/gallery {2}✓/);
  assert.match(lines(origin + "/about"), /✗ the address asked for was https:\/\/ag\.gofarther\.app\/about/);
  // A COMPLETE PAIR SAYS NOTHING ABOUT PRESERVATION BEING UNVERIFIED — the
  // control for the ⚠ line, without which that warning could be unconditional.
  assert.ok(!lines(origin + "/gallery").includes("PRESERVATION UNVERIFIED"), lines(origin + "/gallery"));
  // A BROWSER THAT NEVER LOOKED IS NOT A PAGE WITH NO PICTURES.
  const blind = inv([], []);
  assert.match(inventoryLines(blind, blind, { drew: null }).join("\n"), /NOBODY LOOKED/);
  // ── LOADED AND PLACED ARE TWO QUESTIONS (2026-09-18) ──────────────────────
  //
  // RE-ANCHORED, NOT APPEASED: "1 of them rendering NOTHING" folded two
  // failures into one count. A file that never arrived and a file that arrived
  // into a box of no size need different fixes, and only the first is what a
  // 404 on the image produces — so they are counted apart, and the second was
  // invisible to `naturalWidth` altogether.
  const drew = inventoryLines(blind, blind, { drew: [
    { src: "/u/ag/c3.jpg", alt: "new", w: 1600, h: 1200, box: { w: 720, h: 540 }, y: 1180, under: "Our work" },
    { src: "/qr-g.svg", alt: "", w: 0, h: 0, box: { w: 0, h: 0 }, y: 40, under: "" },
    { src: "/u/ag/d4.jpg", alt: "hidden", w: 800, h: 600, box: { w: 0, h: 0 }, y: 90, under: "" },
  ] }).join("\n");
  assert.match(drew, /3 drawn, 1 whose file loaded NOTHING, 1 loaded but laid out to NO SIZE/, drew);
  assert.match(drew, /\(BLANK\).*"\/qr-g\.svg"/, "a picture that decoded to nothing is not named: " + drew);
  assert.match(drew, /placed 720×540 at y=1180 under "Our work"/, "the picture's real placement never reaches the report: " + drew);
  assert.match(drew, /placed 0×0 \(NO SIZE\) at y=90 .*"\/u\/ag\/d4\.jpg"/,
    "a picture that loaded and renders at no size is not named: " + drew);
  // AND AN OLDER READER'S SHAPE — no `box` at all — prints the file size and no
  // placement, rather than a fabricated one.
  const old = inventoryLines(blind, blind, { drew: [{ src: "/u/ag/c3.jpg", alt: "", w: 1600, h: 1200 }] }).join("\n");
  assert.match(old, /file 1600×1200 "\/u\/ag\/c3\.jpg"/, old);
  assert.ok(!/placed/.test(old), "a placement was invented for a reading that has none: " + old);
  // ── AND THE READING ITSELF IS DRIVEN, against a fake DOM ──────────────────
  //
  // It runs inside a real browser, so no unit case can call it — which is *a
  // wall nobody can drive is a wall nobody is guarding* on a READING, where
  // being wrong costs a report that says the picture is fine when it is not.
  // `IMAGE_READING` is the SOURCE `page.evaluate` is handed, so `new Function`
  // with `document` and `window` as parameters runs exactly what the browser
  // runs — the shape `browserComposer` already uses one function over.
  const img = (o) => ({
    currentSrc: o.src, naturalWidth: o.nw, naturalHeight: o.nh, complete: true,
    getAttribute: (k) => (k === "src" ? o.src : k === "alt" ? (o.alt || "") : null),
    getBoundingClientRect: () => ({ width: o.bw, height: o.bh, top: o.top }),
    previousElementSibling: o.prev || null, parentElement: null,
    matches: () => false, querySelector: () => null,
  });
  const h2 = { matches: (s) => s.includes("h2"), querySelector: () => null, textContent: "  Our   work  ", previousElementSibling: null, parentElement: null };
  const big = img({ src: "/u/ag/c3.jpg", alt: "new", nw: 1600, nh: 1200, bw: 719.6, bh: 540.2, top: 1180, prev: h2 });
  const flatOne = img({ src: "/u/ag/d4.jpg", alt: "hidden", nw: 800, nh: 600, bw: 0, bh: 0, top: 90 });
  const read = new Function("document", "window", "return (" + IMAGE_READING + ")")({ images: [big, flatOne] }, { scrollY: 0 });
  // THE BOX IS THE RENDERED RECT AND NOT THE FILE'S OWN SIZE, which is the
  // whole distinction: this picture's bytes are 1600×1200 and it is laid out at
  // 720×540, and a reading that took `naturalWidth` for both could never see a
  // container collapse.
  assert.deepEqual(read[0].box, { w: 720, h: 540 }, "the box is not the rendered rect: " + JSON.stringify(read[0]));
  assert.deepEqual([read[0].w, read[0].h], [1600, 1200], "the file's own size was lost");
  assert.equal(read[0].y, 1180, "the offset down the document is wrong");
  assert.equal(read[0].under, "Our work", "the nearest heading is not read, or its whitespace is not folded");
  // AND THE ONE THAT MATTERS: bytes arrived, box is nothing.
  assert.deepEqual([flatOne.naturalWidth > 0, read[1].box], [true, { w: 0, h: 0 }]);
  assert.equal(read[1].under, "", "a picture under no heading is given one");
  // ⚠ AND IT MUST NOT REFERENCE ANYTHING OUTSIDE ITSELF: Playwright ships the
  // TEXT to the page, so a free identifier throws in the browser and comes back
  // as "the image read failed" — the recorded free-identifier trap with a
  // browser between the two halves. `new Function` with exactly two parameters
  // is the check: anything else it reaches is a global that may not be there.
  for (const name of ["SITE", "SLUG", "sitePathOf", "photoUrls", "require", "process"]) {
    assert.ok(!new RegExp("\\b" + name + "\\b").test(IMAGE_READING),
      "the reading reaches `" + name + "`, which does not exist in the page");
  }
  // THE WIRING, by the branch: the harness takes BOTH reads from the same route,
  // the before one immediately before the post, and asks the browser about the
  // page the change made. A value computed and never printed is the recorded
  // defect this whole round is about.
  assert.match(CODE, /const srcBefore = await call\("GET", `\/api\/site\/source\?slug=/, "the before-inventory is not read from the store");
  const post = CODE.indexOf("/addon`, { token: TOKEN, body: { instruction: c.ask");
  assert.ok(post > 0 && CODE.indexOf("const srcBefore =") > 0 && CODE.indexOf("const srcBefore =") < post,
    "the before-inventory is taken after the money has gone");
  assert.match(CODE, /extra\.qrOpens\[file\] = qrOpens\(/, "the codes this change added are never decoded");
  assert.match(CODE, /extra\.drew = await imagesOn\(/, "nothing asks a browser whether the picture renders");
  assert.match(CODE, /for \(const line of inventoryLines\(invBefore, extra\.invAfter, \{[^}]*\}\)\) console\.log/,
    "the inventory is computed and never printed");
  // AND THE ADDRESS THAT WAS WANTED IS FORWARDED. `want` was a parameter this
  // function has always accepted and NOBODY passed, so the ✓/✗ above has never
  // once printed in a live run — the recorded value-never-forwarded defect, in
  // the reader for the claim the run is bought to make. It is the route THIS
  // change added, discovered from the reply rather than typed.
  assert.match(CODE, /const wantUrl = \(extra\.newRoutes && extra\.newRoutes\.length\)/,
    "the expected address is not derived from the route this change added");
  assert.match(CODE, /inventoryLines\(invBefore, extra\.invAfter, \{[^}]*want: wantUrl[^}]*\}\)/,
    "the expected address is computed and never handed to the reader");
});

test("publication is read off the PUBLISHED file, not the stored settings", () => {
  // *"Discover QR filenames from the inventory, then GET the actual published
  // SVG from the public site and verify that response against the expected
  // gallery URL. The source endpoint regenerates QR drawings from settings;
  // comparing those does not establish publication."* (owner, 2026-09-18).
  const origin = "https://ag.gofarther.app";
  const urls = [origin + "/", origin + "/gallery"];
  const svg = qrSvg(origin + "/gallery").svg;
  const res = (over = {}) => ({ status: 200, text: svg, headers: { "content-type": "image/svg+xml" }, ...over });

  // THE CLAIM: served, and it opens the address that was asked for.
  const good = qrPublished(res(), urls);
  assert.deepEqual(
    { served: good.served, ok: good.ok, url: good.url, status: good.status },
    { served: true, ok: true, url: origin + "/gallery", status: 200 },
    JSON.stringify(good));
  assert.equal(good.bytes, Buffer.byteLength(svg, "utf8"), "the served size is not the file's own");

  // FOUR ANSWERS, AND THEY NEED FOUR DIFFERENT FIXES. Not served at all is the
  // one this correction exists for: the settings are perfect and no visitor can
  // scan anything, which the stored reading cannot see by construction.
  const missing = qrPublished({ status: 404, text: "not found", headers: {} }, urls);
  assert.equal(missing.served, false);
  assert.match(missing.why, /answered 404 — the code is in this site's settings and is NOT published/);
  // A 200 THAT IS NOT A DRAWING — and the test is whether the answer IS an SVG
  // document rather than whether it CONTAINS one. MEASURED on fretwork-1's real
  // home page: a `/<svg[\s>]/` test passes it at 58,642 bytes, because a React
  // page is full of inline icons. That reading reports a MISSING FILE as a
  // BROKEN DRAWING, which points at the wrong fix.
  const page = qrPublished({ status: 200, text: `<!DOCTYPE html><html><body><svg viewBox="0 0 24 24"><path d="M0 0h24"/></svg></body></html>`, headers: { "content-type": "text/html" } }, urls);
  assert.equal(page.served, false, "an HTML page carrying an inline icon is being read as a published drawing");
  assert.match(page.why, /are not an SVG document \(text\/html\)/, page.why);
  // …with its CONTROL: a real drawing with an XML prolog and a doctype in front
  // of it is still a drawing, so the test is not "starts with `<svg`" literally.
  const prologued = qrPublished(res({ text: `<?xml version="1.0"?>\n<!DOCTYPE svg>\n` + svg }), urls);
  assert.equal(prologued.served, true, "a prolog is being read as something other than an SVG");
  assert.equal(prologued.ok, true);
  // SERVED AND OPENING THE WRONG PAGE is a third finding, distinct from both.
  const wrong = qrPublished(res({ text: qrSvg(origin + "/").svg }), urls);
  assert.equal(wrong.served, true);
  assert.equal(wrong.url, origin + "/", "a published code's real destination is not being reported");
  // AND A FETCH THAT NEVER ANSWERED ESTABLISHES NOTHING IN EITHER DIRECTION.
  const none = qrPublished(null, urls);
  assert.equal(none.served, false);
  assert.match(none.why, /did not answer at all — nothing was established/);

  // THE HEADERS ARRIVE IN EITHER OF THE HARNESS'S TWO SHAPES — a `Headers` from
  // `site()`, a plain object from `call()` — so the reader asks for a `get`
  // rather than assuming one. A fixture in only one shape would hide the other.
  const h = new Headers({ "content-type": "text/html" });
  assert.match(qrPublished({ status: 200, text: "<html></html>", headers: h }, urls).why, /\(text\/html\)/);

  // ── THE TWO OBSERVATIONS ARE PRINTED AS TWO LINES, NEVER MERGED ───────────
  //
  // *"Keep the stored inventory and public-site observations distinct."*
  const inv = (assets) => inventoryOf({
    ok: true, reads: { pages: true, parts: true, assets: true },
    pages: [{ path: "src/routes/index.tsx", source: "" }], parts: [], assets,
  }, "ag");
  const both = inventoryLines(inv([]), inv([{ path: "public/qr-g.svg", source: svg }]), {
    opens: { "qr-g.svg": qrOpens(svg, urls) },
    published: { "qr-g.svg": missing },
    want: origin + "/gallery",
  }).join("\n");
  assert.match(both, /code qr-g\.svg — STORED settings: opens https:\/\/ag\.gofarther\.app\/gallery {2}✓/, both);
  assert.match(both, /code qr-g\.svg — PUBLISHED file: ⚠ NOT ON THE SITE/, both);
  // THE DISAGREEMENT IS THE FINDING, and it must be legible as one: the stored
  // reading says ✓ and the published one says the file is not there.
  assert.ok(both.includes("STORED settings: opens") && both.includes("PUBLISHED file: ⚠"),
    "a code whose settings are right and which was never published reads as a pass: " + both);
  // NOBODY FETCHED IT IS NOT "IT IS NOT THERE".
  const unasked = inventoryLines(inv([]), inv([{ path: "public/qr-g.svg", source: svg }]), {
    opens: { "qr-g.svg": qrOpens(svg, urls) },
  }).join("\n");
  assert.match(unasked, /PUBLISHED file: NOT FETCHED — nobody asked the public site for it/, unasked);

  // THE WIRING: the harness really fetches it, from the PUBLIC origin, under the
  // name the inventory diff discovered — and a check that only read the module
  // would pass with this hop deleted.
  assert.match(CODE, /extra\.qrPublished\[file\] = qrPublished\(await site\("\/" \+ file\), urls\)/,
    "the published file is never fetched — only the stored settings are read");
  assert.match(CODE, /published: extra\.qrPublished/, "the published reading is computed and never printed");
});

test("an incomplete inventory stops the run before spending, and never reads as preserved", () => {
  // *"Make inventory completeness observable. The source endpoint currently
  // converts failed storage reads into empty lists with HTTP 200 and ok:true. An
  // incomplete before-read must stop this test before spending; an incomplete
  // after-read must make preservation unverified. Checking HTTP status alone is
  // insufficient."* (owner, 2026-09-18).
  const src = (reads) => ({
    ok: true, reads,
    pages: [{ path: "src/routes/index.tsx", source: `<SafeImage src="/u/ag/a1.jpg" alt="x" />` }],
    parts: [], assets: [],
  });
  const all = { pages: true, parts: true, assets: true };

  // THREE STATES, AND `null` IS THE ONE THAT MATTERS MOST — an older Worker
  // cannot say, and reading its silence as "complete" is how this instrument
  // goes back to reporting an unread store as an empty site.
  assert.equal(inventoryOf(src(all), "ag").complete, true);
  assert.equal(inventoryOf(src({ ...all, parts: false }), "ag").complete, false);
  assert.deepEqual(inventoryOf(src({ ...all, parts: false }), "ag").missing, ["parts"]);
  assert.equal(inventoryOf(src(undefined), "ag").complete, null, "a Worker that says nothing is being read as having said yes");
  assert.deepEqual(inventoryOf(src(undefined), "ag").missing, []);
  // A NON-BOOLEAN IS NOT A YES: `reads: {pages: "true"}` is cannot-tell.
  assert.equal(inventoryOf(src({ ...all, assets: "true" }), "ag").complete, false);

  // THE GATE. `[]` means go, and every other answer names its own fix.
  assert.deepEqual(inventoryRefusals(inventoryOf(src(all), "ag"), { status: 200 }), []);
  const stops = (inv, status = 200) => inventoryRefusals(inv, { status }).join(" | ");
  assert.match(stops(inventoryOf(src({ ...all, pages: false }), "ag")), /INCOMPLETE — \["pages"\]/);
  assert.match(stops(inventoryOf(src(undefined), "ag")), /does not say which of its stores it really read/);
  assert.match(stops(null, 0), /could not be read at all — \/api\/site\/source answered nothing/);
  assert.match(stops(null, 401), /answered 401/);
  // THE THREE REASONS ARE THREE SENTENCES, because they point at three fixes: a
  // route that did not answer, a Worker that cannot say, and a store that
  // failed. Collapsing them is how a person retries the wrong thing.
  const three = [stops(null, 500), stops(inventoryOf(src(undefined), "ag")), stops(inventoryOf(src({ ...all, parts: false }), "ag"))];
  assert.equal(new Set(three).size, 3, "two of the three refusals say the same thing: " + JSON.stringify(three));

  // AN INCOMPLETE AFTER-READ MAKES PRESERVATION UNVERIFIED, and the ± counts are
  // said NOT to be evidence — an empty list from a store that failed reads
  // exactly like a site with none.
  const before = inventoryOf(src(all), "ag");
  const after = inventoryOf({ ...src({ ...all, parts: false }), pages: [] }, "ag");
  const lines = inventoryLines(before, after, { drew: null }).join("\n");
  assert.match(lines, /⚠ PRESERVATION UNVERIFIED — the after read is INCOMPLETE \(\["parts"\] could not be read\)/, lines);
  assert.match(lines, /NOT evidence that nothing was lost/);
  // A LOSS SEEN ACROSS AN INCOMPLETE PAIR IS STILL SAID: incompleteness makes an
  // ABSENCE untrustworthy, never a PRESENCE, so both warnings appear together.
  assert.match(lines, /⚠ THIS CHANGE LOST 2/, lines);
  // AN OLDER WORKER ON EITHER SIDE IS THE SAME WARNING WITH ITS OWN REASON.
  assert.match(inventoryLines(inventoryOf(src(undefined), "ag"), before, { drew: null }).join("\n"),
    /the before read cannot say which stores it reached/);
  // THE CONTROL: a complete pair says none of it, or the warning is unconditional.
  assert.ok(!inventoryLines(before, before, { drew: null }).join("\n").includes("PRESERVATION UNVERIFIED"));

  // THE WIRING — and only a scan can see it, because the exit lives in `main`.
  // BEFORE THE POST is the whole property: a refusal after the money has gone is
  // a note, not a refusal.
  const gate = CODE.indexOf("const invNo = inventoryRefusals(invBefore, { status: srcBefore.status })");
  assert.ok(gate > 0, "the before-inventory is never asked whether it is good enough to spend against");
  const post = CODE.indexOf("/addon`, { token: TOKEN, body: { instruction: c.ask");
  assert.ok(gate < post, "the inventory gate sits after the money has gone");
  // ⚠ THE BRANCH BY ITS OWN CONDITION, NEVER BY POSITION. `if (false) { … }`
  // leaves `process.exit(1)` exactly where a search finds it — the recorded "a
  // positional guard cannot see a dead branch", which is how the deploy
  // pre-flight's own gate survived its first sweep two rounds ago and how this
  // one survived its first. The condition is the assertion; `main` is not
  // exported and `process.exit` is not observable without spawning the script
  // against a live site and a token, so this is as close as a unit case gets.
  const branch = CODE.indexOf("if (invNo.length) {", gate);
  assert.ok(branch > gate && branch < post, "the refusal list is computed and never looked at");
  assert.ok(CODE.indexOf("process.exit(1)", branch) > branch && CODE.indexOf("process.exit(1)", branch) < post,
    "an unusable before-inventory prints and carries on spending");
  assert.match(CODE.slice(branch, post), /REFUSING TO SPEND/, "the refusal does not announce itself");
  assert.match(CODE.slice(branch, post), /nothing was posted and nothing was charged/,
    "the refusal does not say that nothing was spent");
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
      // THE PER-STEP INPUT CAPTURE, DERIVED FROM ITS REAL PRODUCER. A
      // hand-typed entry here is a second copy of `shownSchema`, and this
      // fixture is the whole evidence for schema receipt — if the shape drifts
      // the harness prints a headline about fields the record does not carry.
      shownSteps: [
        { kind: "function", ...shownSchema({ tables: ["bookings"], columns: { bookings: ["bike text", "drop_off_day date"] }, hasDatabase: true }) },
        { kind: "page", ...shownSchema({ tables: ["bookings"], columns: { bookings: ["bike text", "drop_off_day date"] }, functions: ["count_by_day"], hasDatabase: true }) },
      ],
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

  // ── SCHEMA RECEIPT, WHICH IS WHAT THE NEXT RUN IS BOUGHT FOR ───────────────
  //
  // `shownSteps` had been RECORDED AND NEVER READ: the route has written it
  // since it shipped and nothing printed it, so a run bought to prove the
  // function designer saw a column would have come back without the receipt.
  // This repository's own wiring defect, in the instrument built to settle it.
  assert.match(all, /what each designer was SHOWN about the database/,
    "the per-step input capture is not printed at all");
  assert.match(all, /· function — database: YES — 1 table\(s\): \["bookings"\]/,
    "a step's headline does not carry hasDatabase and the tables it was shown");
  assert.match(all, /"columns":\{"bookings":\["bike text","drop_off_day date"\]\}/,
    "the columns a designer was shown are not printed, which is the whole claim");
  assert.match(all, /· page — database: YES/, "only the first step is printed");
  // `hasDatabase: false` beside real tables is run 47's defect, so NO must read
  // as loudly as YES rather than as an absence.
  const off = askLines({ coverage: { counts: {}, shownSteps: [{ kind: "function", tables: [], columns: {}, hasDatabase: false }] } }, ["function"]);
  assert.match(off.join("\n"), /· function — database: NO — 0 table\(s\): \[\]/,
    "a designer told the site has NO database — run 47's defect — does not read as such");
  // AND AN EMPTY CAPTURE IS A SENTENCE, not a blank: "no step was recorded" and
  // "no step saw anything" are two readings a blank collapses into one.
  const noneShown = askLines({ coverage: { counts: { covered: 1 } } }, ["qr"]).join("\n");
  assert.match(noneShown, /what each designer was SHOWN about the database/);
  assert.match(noneShown, /\(none recorded/, "a record with no capture reads as a designer that was shown nothing");

  // ABSENCE IS A SENTENCE. "Nothing was recorded" and "nothing was
  // outstanding" are two readings a blank collapses into one.
  const none = askLines({}, []);
  assert.equal(none.length, 2, "an answer with no coverage prints something other than the two lines");
  assert.match(none[1], /no coverage record/i, "an answer with no coverage reads as nothing outstanding");
  assert.deepEqual(askLines({ coverage: null }, []), none);
  assert.deepEqual(askLines(null, null), none, "a missing record is not said");
  // An empty record still says it IS a record — the counts line separates it.
  // RE-ANCHORED, NOT APPEASED (2026-09-16): this asserted a LENGTH of 2, which
  // was the property "there is a counts line and nothing else" only while the
  // shown-steps block did not exist. An empty record now also says its capture
  // is empty, which is more said and not less — so the assertion is the two
  // lines by their content, and the absence of any REQUIREMENT line, which is
  // what "empty" was ever about.
  const bare = askLines({ coverage: { counts: {} } }, ["qr"]);
  assert.match(bare[1], /coverage record: \{\}/, "an empty coverage record reads as no record at all");
  assert.equal(bare.filter((l) => /^ {5}· (covered|elsewhere|unsupported):/.test(l)).length, 0,
    "an empty record printed a requirement line");
  assert.notEqual(bare.join("\n"), none.join("\n"),
    "an empty record and a missing one read the same, which is the reading the counts line exists to separate");
  // And nothing in it may throw on a hostile shape: this is a model's answer,
  // read back off R2, not something the harness wrote.
  for (const junk of [{ coverage: { requirements: "no", unreadable: 3, invalidProps: {} } },
                      { coverage: { counts: null, handedTo: "x" } }]) {
    assert.doesNotThrow(() => askLines(junk, "not a list"));
  }
  assert.match(SRC, /if \(c\.freeText\) for \(const line of askLines\(ans, extra\.askKinds\)\) console\.log\(line\);/,
    "the record block prints inline again");
});

// ─────────────────────────────────────────────────────────────────────────────
// WHICH CODE IS ANSWERING, ASKED BEFORE ANYTHING IS SPENT (2026-09-15)
// ─────────────────────────────────────────────────────────────────────────────
//
// Owner: *"Verify that both the Worker and the container executing the test use
// the merged changes. Elapsed rollout time alone is insufficient evidence."*
//
// The decision was SPLIT OUT of the fetching wrapper precisely so it could be
// driven — reachable only through two authenticated routes and a live cold
// container, it was this repository's recorded "a wall nobody can drive is a
// wall nobody is guarding", in the one branch whose wrong answer costs credits
// AND produces a complete, plausible, green-looking result about code that is
// not under test.

// RE-ANCHORED, NOT APPEASED (2026-09-18). Every case below was written when the
// only reasons not to spend were about WHICH CODE, so each called `codeRefusals`
// with no `queued` and expected `[]` on a match. Queued work is a separate,
// unconditional requirement now, and a case about the deploy sha that also fails
// for the async reason is a case about two things — so these hold `queued: true`
// and stay about their own subject. `refusals` is that isolation spelled once;
// the async property itself is driven directly in the case below them, which is
// the only place that may leave it out.
const refusals = (o = {}) => codeRefusals({ queued: true, ...o });

test("a matching pair spends, and a short sha matches by prefix", () => {
  const sha = "3d7acaf5e1b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0";
  const img = "16cb42353dc4a343";
  assert.deepEqual(refusals({ deploy: sha, image: img, runtimeDeploy: sha, expectDeploy: sha, expectImage: img }), [],
    "an exact match on both halves is refusing to spend");
  // A SHORT SHA IS WHAT A PERSON TYPES INTO THE FORM. Either side may be the
  // shorter one — the answer is the full sha and the expectation is usually the
  // seven characters off a PR page, but a workflow that starts binding the full
  // one must not become a refusal.
  assert.deepEqual(refusals({ deploy: sha, runtimeDeploy: sha, expectDeploy: "3d7acaf" }), []);
  assert.deepEqual(refusals({ deploy: "3d7acaf", runtimeDeploy: "3d7acaf", expectDeploy: sha }), []);
  // AND SEVEN IS A FLOOR ON BOTH SIDES, or a three-character expectation
  // matches a third of every sha there is by coincidence.
  assert.equal(refusals({ deploy: sha, expectDeploy: "3d7" }).length, 1,
    "a prefix too short to be evidence is being read as a match");
  assert.equal(refusals({ deploy: "3d7", expectDeploy: sha }).length, 1,
    "an answer too short to be evidence is being read as a match");
});

test("a mismatch on either half refuses, and names which half and both values", () => {
  const sha = "3d7acaf5", other = "a4d0f5e5";
  const img = "16cb42353dc4a343", was = "e35d9f28b49f5f2c";
  // THE WORKER HALF.
  const d = refusals({ deploy: other, image: img, expectDeploy: sha, expectImage: img });
  assert.equal(d.length, 1, JSON.stringify(d));
  assert.match(d[0], /worker deploy/, "the refusal does not say which half disagreed");
  assert.ok(d[0].includes(other) && d[0].includes(sha), "the refusal does not name both values: " + d[0]);
  // THE CONTAINER HALF, which is the one a clock gets wrong: the Worker rolls
  // first and an instance started seconds later is still on the old image.
  const i = refusals({ deploy: sha, image: was, expectDeploy: sha, expectImage: img });
  assert.equal(i.length, 1, JSON.stringify(i));
  assert.match(i[0], /container image/, "the refusal does not say which half disagreed");
  assert.ok(i[0].includes(was) && i[0].includes(img), "the refusal does not name both values: " + i[0]);
  // BOTH AT ONCE ARE BOTH SAID — a person reading one line and fixing it would
  // otherwise buy a second run to be told about the other.
  assert.equal(refusals({ deploy: other, image: was, expectDeploy: sha, expectImage: img }).length, 2);
  // AN IMAGE ID IS MATCHED WHOLE. A prefix of a hash is not a weaker claim, it
  // is a different one; the ids are sixteen hex characters by construction.
  assert.equal(refusals({ image: img, expectImage: img.slice(0, 8) }).length, 1,
    "half an image id is being read as a match");
});

test("cannot-tell refuses, and the `unstamped` case is taken from the real reader", () => {
  // THE RECORDED RULE, in the branch where being wrong is expensive: an
  // `unstamped` image, a route that failed, an absent sha — each is "do not
  // spend", never "close enough". DERIVED from `healthImage` rather than typed,
  // because what an unstamped container really produces here is that reader's
  // answer and a second copy of it would drift.
  const unstamped = healthImage("ok tmpl-7 unstamped");
  assert.equal(unstamped, "", "healthImage no longer answers empty for an unstamped image — this case is asserting nothing");
  const no = refusals({ deploy: "3d7acaf5", image: unstamped, expectDeploy: "3d7acaf5", expectImage: "16cb42353dc4a343" });
  assert.equal(no.length, 1);
  assert.match(no[0], /cannot tell/, "an unreadable image reads as a value: " + no[0]);
  // A ROUTE THAT ANSWERED NOTHING AT ALL is the same reading, both halves.
  assert.match(refusals({ expectDeploy: "3d7acaf5" })[0], /cannot tell/);
  assert.match(refusals({ expectImage: "16cb42353dc4a343" })[0], /cannot tell/);
  // AND THE STAMPED ANSWER THE SAME READER PRODUCES IS A MATCH, which is the
  // control without which every case above passes for the wrong reason.
  assert.deepEqual(refusals({ image: healthImage("ok tmpl-7 16cb42353dc4a343"), expectImage: "16cb42353dc4a343" }), []);
});

test("the two readers of the deploy must agree, and that is asked with no expectation set", () => {
  // `build-health` and `runtime` each read `deployIdOf(env)` out of their own
  // isolate. A disagreement means a roll is in flight and the honest answer to
  // "which code is answering" is "both" — a fact about the platform, not about
  // what this caller wanted, so it is asked whether or not an expectation was
  // given.
  const split = refusals({ deploy: "3d7acaf5", runtimeDeploy: "a4d0f5e5" });
  assert.equal(split.length, 1, "a run mid-roll is being allowed to spend");
  assert.match(split[0], /roll is in flight/, split[0]);
  assert.ok(split[0].includes("3d7acaf5") && split[0].includes("a4d0f5e5"), "the refusal does not name both answers");
  // ONE READER THAT COULD NOT TELL IS NOT A DISAGREEMENT — it is the absence of
  // a second opinion, and with no expectation set there is nothing to refuse.
  assert.deepEqual(refusals({ deploy: "3d7acaf5", runtimeDeploy: "" }), []);
  assert.deepEqual(refusals({ deploy: "", runtimeDeploy: "a4d0f5e5" }), []);
  // AND A RUN THAT DEMANDED NOTHING AND SAW A SETTLED PLATFORM SPENDS — as long
  // as queued work is established, which is the one demand it does not get to
  // skip.
  assert.deepEqual(refusals({ deploy: "3d7acaf5", image: "16cb42353dc4a343", runtimeDeploy: "3d7acaf5" }), []);
  assert.deepEqual(refusals({}), []);
});

test("queued work is required before any paid post, and it is not a box the caller can forget", () => {
  // *"Require async=true before the paid POST for this test; false or unreadable
  // must stop it."* (owner, 2026-09-18). `async` off means the addon runs inside
  // the Worker's isolate, bounded by the customer's own connection at ~270 s —
  // run 45 died at 270,025 ms with the credits gone.
  //
  // UNCONDITIONAL, and that is the property. The `expect*` pair asks "is this
  // the build I meant" and has nothing to answer when nothing was demanded;
  // this asks "can the work survive at all", which is true of every run. As a
  // caller's flag it would be an input, and an input cannot be the wall — a
  // forgotten box fails OPEN, which is the direction that spends.
  assert.deepEqual(codeRefusals({ queued: true, deploy: "3d7acaf5", runtimeDeploy: "3d7acaf5" }), [],
    "queued work is on and a settled platform is still refusing");
  // OFF AND CANNOT-TELL ARE DIFFERENT SENTENCES. One is a switch somebody can
  // turn on; the other is a route that did not answer, and reading the second as
  // the first sends a person to flip a flag that is already set.
  const off = codeRefusals({ queued: false, deploy: "3d7acaf5", runtimeDeploy: "3d7acaf5" });
  assert.equal(off.length, 1, JSON.stringify(off));
  assert.match(off[0], /queued work is OFF/, off[0]);
  assert.match(off[0], /270 s/, "the refusal does not say what goes wrong: " + off[0]);
  for (const blind of [undefined, null, "", "true", 1, {}]) {
    const no = codeRefusals({ queued: blind, deploy: "3d7acaf5", runtimeDeploy: "3d7acaf5" });
    assert.equal(no.length, 1, `queued=${JSON.stringify(blind)} spent: ${JSON.stringify(no)}`);
    assert.match(no[0], /could not read whether queued work is on/,
      `queued=${JSON.stringify(blind)} reads as the switch being off: ${no[0]}`);
  }
  // A CALL WITH NO ARGUMENT AT ALL still must not throw — the default argument
  // is what lets the wrapper hand over a partial answer — and it must refuse,
  // because nothing in it establishes anything.
  assert.equal(codeRefusals().length, 1, "a call with no argument throws, or answers go");
  assert.match(codeRefusals()[0], /could not read whether queued work is on/);
  // AND THE WRAPPER REALLY HANDS THE ROUTE'S OWN ANSWER OVER, with no default
  // between them: `runtime` is `{}` when the route failed, and `|| false` there
  // would turn "nobody answered" into "the switch is off".
  const open = CODE.indexOf("async function whichCode(token) {");
  const fn = CODE.slice(open, CODE.indexOf("\n}\n", open));
  assert.ok(open > 0, "whichCode moved");
  // THE ANSWER IS HANDED OVER RAW — no `||`, no `=== true`, no coercion of any
  // kind. A sweep survivor is why this is the exact expression rather than a
  // forbidden-spelling list: `runtime.async || false` and `runtime.async ===
  // true` are DIFFERENT spellings of one defect, and each turns "nobody
  // answered" into "the switch is off", which is a different sentence pointing
  // at a different fix. Anything but the bare read is a transformation.
  assert.match(fn, /codeRefusals\(\{[^}]*\bqueued: runtime\.async,[^}]*\}\)/,
    "the runtime route's async answer does not reach the decision unchanged");
});

test("the caller's demand is read off the environment, and both names are the ones the workflow sends", () => {
  // THE HOP FROM A BOX ON A FORM TO THE DECISION THAT SPENDS MONEY. It lived
  // in two module constants and a sweep killed it: two mutants cutting the
  // expectations out of the call SURVIVED every guard, because a constant
  // handed over and a constant not handed over look identical from outside.
  // It takes the environment now, so the hop is driven rather than read.
  assert.deepEqual(expectedCode({ SWEEP_EXPECT_DEPLOY: "3d7acaf5", SWEEP_EXPECT_IMAGE: "16cb42353dc4a343" }),
    { expectDeploy: "3d7acaf5", expectImage: "16cb42353dc4a343" });
  // AN UNSET BOX IS NO DEMAND, which is every run before today.
  assert.deepEqual(expectedCode({}), { expectDeploy: "", expectImage: "" });
  assert.deepEqual(expectedCode(), { expectDeploy: "", expectImage: "" });
  // A PASTED VALUE CARRIES WHITESPACE, and an image id pasted off a deploy log
  // can carry capitals — the answer side is lowercased, so the comparison is
  // about the id and not the keyboard. A sha is NOT lowercased: git's own are
  // lower already, and folding a case here would hide a value that is not one.
  assert.deepEqual(expectedCode({ SWEEP_EXPECT_DEPLOY: "  3d7acaf5\n", SWEEP_EXPECT_IMAGE: " 16CB42353DC4A343 " }),
    { expectDeploy: "3d7acaf5", expectImage: "16cb42353dc4a343" });
  // AND THE TWO NAMES ARE THE WORKFLOW'S OWN, both ways: a name this reads and
  // the form does not send arrives empty for ever, and a name the form sends
  // and nothing reads is a box that does nothing. Derived from the yaml.
  const sends = [...WF.matchAll(/^ {10}(SWEEP_EXPECT_\w+): \$\{\{ github\.event\.inputs\.(\w+) \}\}$/gm)];
  assert.equal(sends.length, 2, "the workflow does not forward exactly the two expectations: " + JSON.stringify(sends.map((m) => m[1])));
  for (const [, envName, input] of sends) {
    assert.ok(CODE.includes("env." + envName), "the workflow sends " + envName + " and nothing reads it");
    assert.match(WF, new RegExp("^ {6}" + input + ":$", "m"), "the workflow forwards an input it does not offer: " + input);
  }
  const reads = [...CODE.matchAll(/env\.(SWEEP_EXPECT_\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(reads)].sort(), sends.map((m) => m[1]).sort(),
    "the harness reads an expectation the workflow never sends, or the other way round");
});

test("the pre-flight runs before anything is spent, reads both halves, and is wired to the workflow's two boxes", () => {
  // THE WIRING, which is the hop this whole class of defect lives in: a
  // decision perfectly correct and never called. Read by its own call rather
  // than by position — but the POSITION is the property here, so both.
  const at = CODE.indexOf("await whichCode(TOKEN);");
  assert.ok(at > 0, "main no longer asks which code is answering");
  for (const spend of ["await openBrowser();", "const start = await balance();"]) {
    const s = CODE.indexOf(spend);
    assert.ok(s > at, "the pre-flight runs after `" + spend + "` — a refusal there has already started the run");
  }
  // IT READS BOTH HALVES OUT OF THE ONE ROUTE THAT ANSWERS BOTH, and asks the
  // second reader for the disagreement check.
  const open = CODE.indexOf("async function whichCode(token) {");
  const shut = CODE.indexOf("\n}\n", open);
  assert.ok(open > 0 && shut > open, "whichCode moved");
  const fn = CODE.slice(open, shut);
  assert.match(fn, /\/api\/site\/build-health/, "the pre-flight does not ask for the container's cold-start image");
  assert.match(fn, /\/api\/site\/runtime\?slug=/, "the pre-flight has no second reader of the deploy");
  assert.match(fn, /healthImage|health\.image/, "the pre-flight does not read the image off the route's own answer");
  assert.match(fn, /codeRefusals\(\{/, "the pre-flight decides for itself instead of asking the driven decision");
  // THE CALLER'S DEMAND REACHES THE DECISION — the one hop a driven case cannot
  // reach, since the wrapper needs two authenticated routes and a cold
  // container. Read as the PROPERTY (the whole pair is spread into the call),
  // never as the key spellings, so renaming a key is not a red run.
  assert.match(fn, /codeRefusals\(\{[^}]*\.\.\.want[^}]*\}\)/, "the caller's expectations never reach the decision");
  assert.match(fn, /const want = expectedCode\(process\.env\)/, "the pre-flight reads the environment some other way");
  // AND THE REFUSAL IS ACTED ON. `if (false) { … }` leaves `process.exit(1)`
  // exactly where a search finds it — the recorded "a positional guard cannot
  // see a dead branch", which is how this survived its first sweep. The BRANCH
  // is what is asserted, by its own condition.
  const gate = fn.indexOf("if (no.length) {");
  assert.ok(gate > 0, "the refusal list is computed and never looked at");
  assert.ok(fn.indexOf("process.exit(1)", gate) > gate, "a refusal prints and carries on spending");
  // AND THE WORKFLOW OFFERS BOTH BOXES AND FORWARDS BOTH. A `workflow_dispatch`
  // input only exists once the workflow is on the default branch, so the pair —
  // the input and the env line — is what makes the box appear AND arrive.
  for (const [input, env] of [["expect_deploy", "SWEEP_EXPECT_DEPLOY"], ["expect_image", "SWEEP_EXPECT_IMAGE"]]) {
    assert.match(WF, new RegExp("^ {6}" + input + ":$", "m"), "the workflow has no " + input + " input");
    assert.match(WF, new RegExp(env + ": \\$\\{\\{ github\\.event\\.inputs\\." + input + " \\}\\}"), input + " never reaches the harness");
  }
  // The descriptions say what a person needs to know to use them: that the run
  // REFUSES rather than warns, and that the two halves are separate.
  const block = WF.slice(WF.indexOf("      expect_deploy:"), WF.indexOf("\npermissions:"));
  assert.ok(block.length > 200 && block.indexOf("      expect_image:") > 0, "the two inputs are not adjacent — this window is reading something else");
  assert.match(block, /refuses before spending[\s\S]*refuses before spending/, "an input does not say the run refuses rather than warns");
  assert.match(block, /roll separately/, "the image input does not say the two halves roll separately");
});

// ── THE JOB TIER: WHAT WAS PERSISTED, AND FIRING IT ───────────────────────────
//
// A job is the one kind whose work does not happen inside the addon request: the
// request registers a row and a later cron tick runs it. So a run that reads only
// the reply proves the designer answered and NOTHING about whether the schedule
// was written down, what zone it was written in, or whether the runner works.
//
// Every assertion here drives the real functions. The two that decide whether a
// live job gets FIRED are the ones that matter: a press that ran the wrong job,
// or ran one nobody asked for, spends nothing but can send real messages on a
// site whose owner has pasted a provider key.
test("the jobs read tells unreadable from none, and keys by name", async () => {
  const { jobRows } = await import("../scripts/addon-sweep.mjs");
  // CANNOT-TELL IS ITS OWN ANSWER. The route answers 503 rather than an empty
  // list on a bad read, and collapsing that into `{}` here would report a broken
  // reader as a site that scheduled nothing — the wrong answer in the direction
  // that reads as the feature being absent.
  for (const bad of [null, undefined, {}, { jobs: null }, { jobs: "two" }, "no"]) {
    assert.equal(jobRows(bad), null, `an unreadable answer must not read as a site with no jobs: ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(jobRows({ jobs: [] }), {}, "a site with no jobs is an empty map, not null");
  const rows = jobRows({ jobs: [
    { name: "remind_tomorrow", fn: "bookings_due_tomorrow", everyMinutes: 1440, at: "09:00", tz: "Europe/London", enabled: true, lastRun: null, lastResult: null },
    { name: "tidy", everyMinutes: 60, at: null, tz: null, enabled: false, lastRun: "2026-09-16T09:00:00Z", lastResult: "cleared 3" },
    { name: "", everyMinutes: 15 },
  ] });
  assert.deepEqual(Object.keys(rows).sort(), ["remind_tomorrow", "tidy"], "a nameless row has no identity and must be dropped");
  assert.equal(rows.remind_tomorrow.at, "09:00");
  assert.equal(rows.remind_tomorrow.tz, "Europe/London", "the zone is the one field on the row no model chose — losing it loses the whole clock-time claim");
  // WHICH FUNCTION IT RUNS (owner, 2026-09-16: "an identical count is not proof
  // of which function was called"). On run 50 the job and its function shared a
  // name, which is what made the omission invisible.
  assert.equal(rows.remind_tomorrow.fn, "bookings_due_tomorrow");
  assert.equal(rows.tidy.fn, "", "a row whose reference is gone must read empty, not absent — that job can never run");
  assert.equal(rows.tidy.enabled, false);
  assert.equal(rows.tidy.lastResult, "cleared 3");
  // NULL RATHER THAN A CHEERFUL DEFAULT, the route's own rule carried through:
  // a job that has never run and a job whose last run sent nothing are different
  // facts, and "" for both invents a sentence for the first.
  assert.equal(rows.remind_tomorrow.lastRun, null);
  assert.equal(rows.remind_tomorrow.lastResult, null);
});

test("which jobs this run added is derived from the two reads, never from the reply", async () => {
  const { newJobs } = await import("../scripts/addon-sweep.mjs");
  assert.deepEqual(newJobs({ a: {} }, { a: {}, b: {}, c: {} }), ["b", "c"]);
  assert.deepEqual(newJobs({ a: {} }, { a: {} }), [], "nothing new is an empty list");
  // EITHER READ UNREADABLE ANSWERS `[]`. "I could not tell" must never arrive as
  // "it added nothing" — and it must never arrive as "it added everything on the
  // site" either, which is what a null BEFORE would produce if it read as {}.
  assert.deepEqual(newJobs(null, { a: {}, b: {} }), [], "an unreadable before-read must not make every job look new");
  assert.deepEqual(newJobs({ a: {} }, null), []);
});

test("the Run now press refuses rather than guessing which job to fire", async () => {
  const { jobToRun } = await import("../scripts/addon-sweep.mjs");
  const have = { remind_tomorrow: {}, tidy: {} };
  // BLANK IS THE DEFAULT AND IT PRESSES NOTHING. The press really runs the job.
  for (const off of ["", "   ", undefined, null]) {
    assert.equal(jobToRun(off, ["remind_tomorrow"], have).run, false, `${JSON.stringify(off)} must not fire anything`);
  }
  // `auto` IS "THE ONE THIS RUN ADDED", never "the first job on the site".
  assert.deepEqual(jobToRun("auto", ["remind_tomorrow"], have), { run: true, name: "remind_tomorrow" });
  const none = jobToRun("auto", [], have);
  assert.equal(none.run, false, "auto must not fall through to a pre-existing job when this run added none");
  assert.match(none.why, /added no job/);
  const many = jobToRun("auto", ["a", "b"], have);
  assert.equal(many.run, false, "auto must refuse rather than pick one of two");
  assert.match(many.why, /name one/, "the refusal must say what to do about it");
  // A NAME IS CHECKED AGAINST THE SITE, so a typo is a refusal and not a quiet
  // no-op — and it is matched case-insensitively against the REAL name, which is
  // what the press is keyed by.
  assert.deepEqual(jobToRun("Remind_Tomorrow", [], have), { run: true, name: "remind_tomorrow" });
  const typo = jobToRun("remind_tommorow", [], have);
  assert.equal(typo.run, false);
  assert.match(typo.why, /no scheduled job called/);
  // AND AN UNREADABLE LIST FIRES NOTHING. With no list there is no way to check a
  // name against the site, and pressing anyway is pressing blind.
  assert.equal(jobToRun("auto", ["x"], null).run, false, "an unreadable jobs list must not be pressed against");
  assert.equal(jobToRun("remind_tomorrow", [], null).run, false);
});

test("the job lines say the zone, and say so even when there is nothing to say", async () => {
  const { jobLines } = await import("../scripts/addon-sweep.mjs");
  // "NOBODY LOOKED" AND "THE SITE SCHEDULED NOTHING" ARE DIFFERENT READINGS, the
  // rule the coverage lines already follow. An absent line collapses them.
  assert.match(jobLines(null, null, null).join("\n"), /COULD NOT BE READ/);
  assert.match(jobLines({}, {}, null).join("\n"), /scheduled jobs on the site: none/);
  const before = {};
  const after = { remind_tomorrow: { everyMinutes: 1440, at: "09:00", tz: "Europe/London", enabled: true, lastRun: null, lastResult: null } };
  const one = jobLines(before, after, null).join("\n");
  assert.match(one, /this run added \["remind_tomorrow"\]/);
  assert.match(one, /runs \(NO FUNCTION\)/, "a job with no reference must say so — it can never run");
  assert.match(jobLines(before, { j: { fn: "count_it", everyMinutes: 60, at: null, tz: null, enabled: true } }, null).join("\n"),
    /· j: runs count_it\(\)/, "the function it runs must be printed even when it differs from the job's name");
  assert.match(one, /at 09:00 Europe\/London every 1440m/, "the clock time must be printed with its zone");
  assert.match(one, /lastRun never/);
  // A TIME WITH NO ZONE IS THE DEFECT THIS LINE EXISTS TO SHOW, so it is named
  // rather than left blank — "09:00" reads as a working schedule either way.
  const noTz = jobLines(before, { j: { everyMinutes: 1440, at: "09:00", tz: null, enabled: true } }, null).join("\n");
  assert.match(noTz, /at 09:00 \(NO ZONE\)/, "a clock time whose zone was lost must say so");
  // A PLAIN INTERVAL HAS NO CLOCK TIME AND MUST NOT INVENT ONE.
  assert.match(jobLines(before, { j: { everyMinutes: 60, at: null, tz: null, enabled: true } }, null).join("\n"), /every 60m/);
  // THE PRESS IS REPORTED IN BOTH DIRECTIONS, and a press that did not happen
  // says WHY — a silent absence reads as a press that ran and found nothing.
  assert.match(jobLines(before, after, { run: true, name: "remind_tomorrow", status: 200, sent: 0, result: "no email provider key in Secrets" }).join("\n"),
    /ran remind_tomorrow now: 200 sent 0 — "no email provider key in Secrets"/);
  assert.match(jobLines(before, after, { run: false, why: "not asked for" }).join("\n"), /did not run any job now: not asked for/);
});

test("a re-read that failed after the press says the outcome could not be verified", async () => {
  const { jobLines } = await import("../scripts/addon-sweep.mjs");
  // THE REGRESSION THIS CASE EXISTS FOR. The first draft folded the post-press
  // re-read back into the pre-press map with `|| extra.jobsAfter`, so a re-read
  // that FAILED printed the pre-press stamp -- `lastRun never` -- which reads as
  // a press that did nothing at all. Cannot-tell arriving as a value, in the
  // instrumentation written to stop exactly that.
  const before = {};
  const after = { remind_tomorrow: { everyMinutes: 1440, at: "09:00", tz: "Europe/London", enabled: true, lastRun: null, lastResult: null } };
  const ran = { run: true, name: "remind_tomorrow", status: 200, sent: 2, result: "Sent 2." };

  const unreadable = jobLines(before, after, ran, null).join("\n");
  assert.match(unreadable, /COULD NOT BE VERIFIED/, "a failed re-read must say the persisted outcome is unknown");
  assert.doesNotMatch(unreadable, /persisted: lastRun/, "a failed re-read must print no stamp at all");
  assert.doesNotMatch(unreadable, /STILL never/, "and must not present the PRE-press stamp as the outcome");
  // The route's own answer is still reported -- that claim is sound, and it is a
  // different claim from what was written to the row.
  assert.match(unreadable, /ran remind_tomorrow now: 200 sent 2/);

  // A RE-READ THAT SUCCEEDED BUT LOST THE JOB is the same unknown, not a pass:
  // the row it was asked about is not in the answer, so nothing can be said.
  const gone = jobLines(before, after, ran, { something_else: {} }).join("\n");
  assert.match(gone, /COULD NOT BE VERIFIED/);
  assert.match(gone, /"remind_tomorrow" is not in the re-read/);

  // AND THE CONTROL, without which the two above pass over a function that
  // never reports a stamp at all: a good re-read prints the persisted values.
  const ok = jobLines(before, after, ran, { remind_tomorrow: { everyMinutes: 1440, at: "09:00", tz: "Europe/London", enabled: true, lastRun: "2026-09-17T08:00:00Z", lastResult: "Sent 2." } }).join("\n");
  assert.match(ok, /persisted: lastRun 2026-09-17T08:00:00Z {2}lastResult "Sent 2\."/);
  assert.doesNotMatch(ok, /COULD NOT BE VERIFIED/);

  // A RUN THAT RECORDED NOTHING is its own reading: the re-read worked and the
  // stamp is still absent, which is a real defect and not an unreadable answer.
  const stampless = jobLines(before, after, ran, { remind_tomorrow: { everyMinutes: 1440, at: "09:00", tz: "Europe/London", enabled: true, lastRun: null, lastResult: null } }).join("\n");
  assert.match(stampless, /persisted: lastRun STILL never/, "a press whose stamp never landed must be visible as such, not as an unreadable answer");
  assert.doesNotMatch(stampless, /COULD NOT BE VERIFIED/);
  assert.match(stampless, /CANNOT BE COMPARED/, "a row with nothing recorded is neither agreement nor disagreement");
});

test("the route's answer and the persisted result are COMPARED, not just printed", async () => {
  const { jobLines } = await import("../scripts/addon-sweep.mjs");
  // THE CHECK THE LIVE RUN IS BOUGHT FOR: "Run now returning 3 AND the fresh
  // persisted result agreeing". Two lines a reader has to hold in their head is
  // how a disagreement gets skimmed past -- and a disagreement is a real state,
  // because `recordJobOutcome` writes the row and that write can fail on its own.
  const before = {};
  const after = { count_bookings: { everyMinutes: 1440, at: "23:00", tz: "Europe/London", enabled: true, lastRun: null, lastResult: null } };
  const row = (lastResult) => ({ count_bookings: { everyMinutes: 1440, at: "23:00", tz: "Europe/London", enabled: true, lastRun: "2026-09-17T22:00:00Z", lastResult } });
  const ran = (result) => ({ run: true, name: "count_bookings", status: 200, sent: 0, result });

  const agree = jobLines(before, after, ran("3 bookings in total."), row("3 bookings in total.")).join("\n");
  assert.match(agree, /AGREE/);
  assert.doesNotMatch(agree, /DISAGREE/, "`AGREE` must not be matched out of the word DISAGREE");

  const differ = jobLines(before, after, ran("3 bookings in total."), row("2 bookings in total.")).join("\n");
  assert.match(differ, /DISAGREE/);
  // BOTH VALUES ARE NAMED, or the line says there is a problem and not what it is.
  assert.match(differ, /route "3 bookings in total\." vs row "2 bookings in total\."/);

  // AND A PRESS THAT DID NOT HAPPEN COMPARES NOTHING -- there is no route answer
  // to compare against, so claiming agreement would be inventing one.
  const none = jobLines(before, after, { run: false, why: "not asked for" }, row("3 bookings in total.")).join("\n");
  assert.doesNotMatch(none, /AGREE|DISAGREE|CANNOT BE COMPARED/);
});

test("the harness reads the registry before the post, and the press is its own switch", async () => {
  const src = readFileSync(new URL("../scripts/addon-sweep.mjs", import.meta.url), "utf8");
  // BEFORE THE POST, or "this run added it" is a claim nobody can make: the site
  // may have carried a job of that name since a run in March. Asserted as an
  // ORDER against the post's own line rather than as a position in the file.
  const readAt = src.indexOf("const jobsBefore = jobRows(");
  const postAt = src.indexOf(`/addon\`, { token: TOKEN, body: { instruction: c.ask`);
  assert.ok(readAt > 0, "the before-read is gone");
  assert.ok(postAt > 0, "the addon post moved — this window is reading something else");
  assert.ok(readAt < postAt, "the jobs registry is read AFTER the change, so nothing can say which job is new");
  // THE PRESS IS OFF BY DEFAULT. An env var that defaulted to `auto` would fire a
  // real job on every free-text run, and on a site with a provider key that sends.
  assert.match(src, /SWEEP_RUN_JOB \|\| ""/, "the press must default to pressing nothing");
  // AND THE LAST READ FOLLOWS THE PRESS. `lastRun`/`lastResult` are written by the
  // route after the run, so a single read taken before it cannot carry them back.
  const pressAt = src.indexOf("body: { name: pick.name, run: true }");
  assert.ok(pressAt > 0, "the Run now press is gone");
  assert.ok(src.indexOf("jobRows(", pressAt) > pressAt, "nothing re-reads the registry after the press, so lastResult can never be seen");
  // AND IT LANDS IN ITS OWN FIELD WITH NO FALLBACK. `|| extra.jobsAfter` here is
  // the stale-value defect: an unreadable verification would print the pre-press
  // stamp and read as a press that did nothing.
  const verifyAt = src.indexOf("extra.jobsVerify = jobRows(", pressAt);
  assert.ok(verifyAt > pressAt, "the post-press read does not land in its own field");
  const verifyLine = src.slice(verifyAt, src.indexOf("\n", verifyAt));
  assert.doesNotMatch(verifyLine, /\|\|/, "the post-press read falls back to a stale value instead of reporting that it failed");
  // AND THE LINES ARE PRINTED, asserted by the branch's OWN CONDITION rather
  // than by the call's position. `if (false) for (… of jobLines(…))` leaves
  // `jobLines(` exactly where a search looks for it — this repository's
  // "a positional guard cannot see a dead branch", and it is what survived
  // this change's first sweep. Everything read back off a live job would be
  // computed and thrown away, which is the wiring defect in its purest form.
  const printAt = src.indexOf("for (const line of jobLines(");
  assert.ok(printAt > 0, "nothing prints the job lines");
  const cond = src.slice(src.lastIndexOf("\n", printAt) + 1, printAt);
  assert.match(cond, /if \(c\.freeText\)/, "the job lines are printed under some other condition than a free-text ask");
  assert.doesNotMatch(cond, /false/, "the job lines are computed and never printed");
  // AND ALL FOUR MAPS REACH IT. Dropping the fourth argument makes `verify`
  // `undefined`, which is falsy — so every press would report "could not be
  // verified" over a re-read that worked perfectly. The map computed and never
  // forwarded, one hop along from the branch above; a sweep survivor is why
  // this line exists rather than the call's mere presence being the assertion.
  const args = src.slice(printAt, src.indexOf("\n", printAt));
  for (const a of ["extra.jobsBefore", "extra.jobsAfter", "extra.ranJob", "extra.jobsVerify"]) {
    assert.ok(args.includes(a), `the job lines are composed without ${a}`);
  }
  // THE WORKFLOW OFFERS THE BOX AND FORWARDS IT — a dispatch input that is not
  // forwarded is a control that answers, wrongly.
  assert.match(WF, /^ {6}run_job:$/m, "the workflow has no run_job input");
  assert.match(WF, /SWEEP_RUN_JOB: \$\{\{ github\.event\.inputs\.run_job \}\}/, "run_job never reaches the harness");
  // AND THE DESCRIPTION SAYS THE PRESS IS REAL. This is the one input on the form
  // that can cause a message to be sent to a real person.
  const blk = WF.slice(WF.indexOf("      run_job:"), WF.indexOf("\npermissions:"));
  assert.match(blk, /BLANK = do not press/, "the input does not say that blank presses nothing");
  assert.match(blk, /IT REALLY RUNS/, "the input does not say the press really runs the job");
});

test("the owner's jobs route answers which function each job runs", async () => {
  // THE ROUTE'S HALF OF THE SAME FIX. Reading it off the SPEC is the property:
  // `runJob` does `spec.fn`, so a second copy stored elsewhere could disagree
  // with what the runner would really call.
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("jobs: jrows.map((j) => ({");
  assert.ok(at > 0, "the jobs listing moved — this window is reading something else");
  const block = w.slice(at, w.indexOf("\n            });", at));
  assert.match(block, /fn: j\.spec && typeof j\.spec === "object" && typeof j\.spec\.fn === "string" \? j\.spec\.fn : ""/,
    "the jobs route does not answer the persisted function reference, off the spec the runner reads");
  // AND IT IS EMPTY RATHER THAN ABSENT for a row that lost it — a job with no
  // reference can never run, and a missing key reads as "not asked about".
  assert.doesNotMatch(block, /fn: [^\n]*\?\s*j\.spec\.fn\s*:\s*undefined/, "an absent reference must read as empty, not undefined");
});
