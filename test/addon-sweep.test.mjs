// Guards for scripts/addon-sweep.mjs — the harness that drives the ADD step on
// a live site. Kept to properties, not spellings, the way the other two
// harness guards are.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CASES, chooseCases, sitePathOf, watchJob, blindBackend } from "../scripts/addon-sweep.mjs";
import { ADD_KINDS, OWN_ADDS, DISPATCHED_ADDS, addLayer } from "../builder/site-add.mjs";
import { routeOf } from "../builder/site-addon.mjs";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";

const SRC = readFileSync(new URL("../scripts/addon-sweep.mjs", import.meta.url), "utf8");
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

test("the component case is judged on the words landing on the page, not on the reply's claim", () => {
  // FOUND BY A MUTANT: with the words check cut to `true`, the guard above
  // still passed, because it only drives the check against a site that did
  // not change — where `changed: []` fails it for another reason. A reply
  // that CLAIMS the home page changed, on a build that moved, with not a
  // word of the addition on the page, is the lie this check exists to catch.
  const c = CASES.find((x) => x.name === "component");
  const before = { build: "b1", text: "Sheffield Beginner Guitar. Lessons in Crookes.", hrefs: [], routes: ["/"] };
  const claimed = { ok: true, changed: ["index.tsx"], added: [] };
  const unchanged = { ...before, build: "b2" };
  assert.equal(c.check(before, unchanged, claimed, {}).ok, false, "a claimed change with no new words on the page passes");
  const landed = { ...before, build: "b2", text: before.text + " What students say. " + "A great teacher, patient and clear. ".repeat(4) };
  assert.equal(c.check(before, landed, claimed, {}).ok, true, "the real thing is called a lie");
  assert.equal(c.check(before, landed, { ok: true, changed: [], added: [] }, {}).ok, false, "words on the page with no page claimed changed passes");
  assert.equal(c.check(before, { ...landed, build: "b1" }, claimed, {}).ok, false, "an unmoved build passes");
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
  // Red on a lie, a lost answer, or a failure — never green by default.
  assert.match(SRC, /\/LIE\|NO ANSWER\|\^failed\$\/\.test\(r\.verdict\)/, "a failed case is a green run");
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
