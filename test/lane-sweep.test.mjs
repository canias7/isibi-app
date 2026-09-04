// The lane sweep harness — guarded, because the canary harness was not and its
// bug reached a paid run.
//
// ── THE TWO-LISTS RULE, POINTED AT A TEST HARNESS ─────────────────────────
//
// The sweep carries a case per lane. The lanes live in `site-lanes.mjs`. Two
// lists of the same thing drift silently, and here the drift has a shape: a
// lane added to the product with no case is a lane the sweep silently skips
// and reports as "all lanes passed"; a case for a lane the product no longer
// has spends a credit asking for something that cannot be named. Both
// directions are asserted, derived from the real `LANE_FIELDS`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import { CASES, chooseLanes, confirmed } from "../scripts/lane-sweep.mjs";
import { LANE_FIELDS, OWN_LANES, DISPATCHED_LANES, VERB_LANES, ESCALATE_LANES } from "../builder/site-lanes.mjs";

test("importing the harness runs nothing", () => {
  // The guard at the bottom of the script keys on argv[1]. This test IS the
  // proof: it imported the module and got here without signing in or spending.
  assert.ok(Array.isArray(CASES) && CASES.length > 0);
});

test("every lane has a case and every case names a lane", () => {
  const cases = CASES.map((c) => c.lane);
  for (const f of LANE_FIELDS) assert.ok(cases.includes(f), "`" + f + "` is a lane the sweep never exercises");
  for (const c of cases) assert.ok(LANE_FIELDS.includes(c), "`" + c + "` is a case for a lane the product does not have");
  // A case's identity is its `key` when it has one (`forget`, the slug lane's
  // second job, 2026-09-02) and its lane otherwise — one verdict per identity.
  // Until the forget case, identity and lane were the same thing.
  const ids = CASES.map((c) => c.key || c.lane);
  assert.equal(new Set(ids).size, ids.length, "two cases share an identity — which one is the verdict?");
  for (const c of CASES.filter((x) => x.key)) assert.ok(c.held, "`" + c.key + "` is a second case for a lane and would run under `all` beside it");
  // THE OBSERVER IS ALIVE: the loops above pass vacuously over an empty list.
  assert.ok(LANE_FIELDS.length >= 20, `only ${LANE_FIELDS.length} lanes — this test may be scanning almost nothing`);
});

test("every case can be judged, and judges the site rather than the reply", () => {
  for (const c of CASES) {
    assert.equal(typeof c.ask, "string", "`" + c.lane + "` has no ask");
    assert.ok(c.ask.trim().length > 10, "`" + c.lane + "` has an ask too short to route");
    assert.equal(typeof c.check, "function", "`" + c.lane + "` has no check");
    // Driven with a before and an after that differ in nothing: a check that
    // passes here is a check that would pass on a site that did not change,
    // which is the exact lie the sweep exists to catch. Three stated
    // exceptions: `behavior` renders nothing yet, so its evidence is the
    // reply's `moved`; the held lanes are not judged by this harness; and a
    // lane whose CORRECT answer on this site is a refusal (`mayEscalate`) has
    // "the build did not move" as its pass — the first draft of this guard
    // flagged `backend` for exactly that, which was the guard being wrong.
    if (c.held || c.lane === "behavior" || Array.isArray(c.mayEscalate)) continue;
    const same = { build: "b1", html: "<html lang=\"en\"><title>T</title></html>", lang: "en", dir: "ltr", title: "T", ogTitle: "T",
      description: "d", locales: ["en"], root: ":root{--a:1}", sheetLen: 10, headerHtml: "<header>T</header>", headerText: "T",
      headerLink: "<a data-slot=\"site-link\">Go</a>", brandLink: "<a href=\"/\">T</a>", cta: { text: "Go", href: "tel:+441144960123" }, heroAlt: "x", slots: ["steps", "price-list"], canvas: false, icon: "<svg/>", qr: "", logo: "<svg/>", routes: ["/"] };
    const v = c.check(same, { ...same }, { ok: true, moved: [] }, {});
    assert.equal(v.ok, false, "`" + c.lane + "` passes against a site that did not change");
    assert.equal(typeof v.note, "string", "`" + c.lane + "` gives no note");
  }
});

test("the honest-refusal lanes are only the ones this site cannot serve", () => {
  // `backend` needs a database and the sweep's site has none, so an escalate
  // is the CORRECT answer there. Anything else claiming the same licence would
  // let a broken lane pass as a principled one.
  const may = CASES.filter((c) => Array.isArray(c.mayEscalate)).map((c) => c.lane);
  assert.deepEqual(may, ["backend"], "a lane other than backend is allowed to pass by escalating: " + JSON.stringify(may));
});

test("slug and kind never run under `all`", () => {
  const all = chooseLanes("all", CASES);
  assert.ok(!all.includes("slug"), "`all` would rename the site");
  assert.ok(!all.includes("kind"), "`all` would rebuild the site");
  // AND THEY DO RUN WHEN NAMED — held is not disabled.
  assert.deepEqual(chooseLanes("slug,kind", CASES), ["slug", "kind"]);
  // `all` covers everything else, derived rather than counted by hand.
  const expected = LANE_FIELDS.filter((f) => f !== "slug" && f !== "kind");
  assert.deepEqual([...all].sort(), [...expected].sort());
  // A NAME THE PRODUCT DOES NOT HAVE REFUSES, naming it and the real lanes.
  // It used to be dropped without a word, and run 16's `kind,slug.` — a full
  // stop after the last name — ran `kind` alone while the log read as a
  // complete pass: the rebuild happened, the rename never did.
  assert.throws(() => chooseLanes("css,nonsense,theme", CASES),
    (e) => /"nonsense"/.test(e.message) && e.message.includes("css") && e.message.includes("theme"),
    "a stranger is dropped instead of refused, or the refusal does not name it and the real lanes");
  // Punctuation at either end of a name is forgiven: `slug.` can only mean `slug`.
  assert.deepEqual(chooseLanes("kind,slug.", CASES), ["kind", "slug"], "run 16's own input");
  assert.deepEqual(chooseLanes(" css , theme. ", CASES), ["css", "theme"]);
  // ...and on a name in the MIDDLE of the list, which the whole-string trim
  // cannot reach — a sweep found the per-name trim unobserved without this.
  assert.deepEqual(chooseLanes("kind., slug", CASES), ["kind", "slug"], "a stray dot before the comma");
  assert.deepEqual(chooseLanes("all.", CASES), all);
  assert.deepEqual(chooseLanes("css,theme,css", CASES), ["css", "theme"], "a name typed twice runs once");
  assert.deepEqual(chooseLanes("", CASES), all, "an empty selection is `all`, which is the documented default");
});

// THE STRANGER REFUSES BEFORE ANYTHING IS SPENT. `chooseLanes` throws; the
// runner has to catch that and exit, and it has to do so ABOVE the sign-in,
// or a wrong name signs in, reads the balance and only then dies. Anchored
// on the call and the magic-link request. The try/catch is read off the
// call's own line — a spelling, pinned on purpose; if the runner ever
// splits it over lines, re-anchor here and say so.
test("a stranger in the lanes box exits the runner before sign-in", () => {
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  const main = src.indexOf("async function main()");
  const call = src.indexOf("lanes = chooseLanes(WANT, CASES)", main);
  const signIn = src.indexOf("generate_link", main);
  assert.ok(main > -1 && call > -1 && signIn > -1, "landmarks moved: main, the chooser call, or the sign-in");
  assert.ok(call < signIn, "the lanes are chosen after the sign-in");
  const line = src.slice(src.lastIndexOf("\n", call) + 1, src.indexOf("\n", call));
  assert.ok(/\btry\b/.test(line) && /\bcatch\b/.test(line) && /process\.exit\(1\)/.test(line),
    "the chooser's refusal is not caught and turned into an exit: " + line.trim());
});

test("the held lanes say why, and the partition still covers them", () => {
  for (const c of CASES.filter((x) => x.held)) {
    assert.ok(typeof c.held === "string" && c.held.length > 20, "`" + c.lane + "` is held with no reason");
    const inGroup = [OWN_LANES, DISPATCHED_LANES, VERB_LANES, ESCALATE_LANES].some((g) => g.includes(c.lane));
    assert.ok(inGroup, "`" + c.lane + "` is held but is not a real lane any more");
  }
});

test("the confirm word is read as a word, not as bytes", () => {
  // THE FIRST DISPATCH DIED ON THIS. The workflow's text box came through as
  // `spend ` with a trailing space and the raw comparison refused it — eleven
  // seconds, nothing spent, nothing learned. A gate that exists to prove a
  // person meant it must not refuse the person who meant it and typed a space.
  for (const yes of ["spend", "spend ", " spend", "SPEND", " Spend\n"]) {
    assert.equal(confirmed(yes), true, JSON.stringify(yes) + " should open the gate");
  }
  // AND STILL A GATE: any other word, nothing, and anything that is not a
  // string — `String(["spend"])` is "spend", the coercion this repo has shipped
  // as a bug four times.
  for (const no of ["", "yes", "spent", "spend now", "s p e n d", null, undefined, true, 1, ["spend"]]) {
    assert.equal(confirmed(no), false, JSON.stringify(no) + " should not open the gate");
  }
});

test("the harness refuses without the confirm word, and the workflow has no free trigger", () => {
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  // CONSULTED BEFORE ANYTHING THAT COSTS OR SIGNS IN. Both landmarks proved, so
  // a deleted gate cannot pass this as -1 < n.
  const gate = src.indexOf("if (!confirmed(process.env.SWEEP_CONFIRM))");
  const signIn = src.indexOf("generate_link");
  assert.ok(gate > 0, "the harness no longer consults the confirm word");
  assert.ok(signIn > 0, "the sign-in landmark moved");
  assert.ok(gate < signIn, "the confirm word is checked after signing in, so a refused run still mints a session");
  const wf = readFileSync(new URL("../.github/workflows/lane-sweep.yml", import.meta.url), "utf8");
  assert.doesNotMatch(wf, /^\s*push:/m, "the sweep can run on a push — the expensive thing would be the default");
  assert.doesNotMatch(wf, /^\s*schedule:/m, "the sweep can run on a schedule");
  assert.match(wf, /workflow_dispatch:/, "the sweep cannot be dispatched by hand");
  assert.match(wf, /SWEEP_CONFIRM: \$\{\{ github\.event\.inputs\.confirm \}\}/, "the confirm input never reaches the harness");
  // BUDGETED. A sweep that could not stop itself would be bounded only by the
  // owner's balance.
  assert.match(src, /spent > BUDGET/, "the budget is never checked between lanes");
});

test("a claimed success with an unmoved build is a lie, and an escalate that moved it is too", () => {
  // The two halves of "judge the site, not the reply", read off the verdict
  // logic. Property, not spelling: each is the presence of the check.
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  assert.match(src, /reply says ok but the build did not move/, "a success that published nothing is not called a lie");
  assert.match(src, /AND THE BUILD MOVED, which an escalate must never do/, "an escalate that published is not called a lie");
  assert.match(src, /verdict === "LIE" \|\| verdict === "NEEDS REVIEW" \|\| verdict === "NO ANSWER"\) \{ console\.log\(`STOPPING/,
    "the sweep does not stop on a lie");
  // AND AN HONEST "ALREADY SO" IS NEITHER. The second sweep stopped on the css
  // lane answering "Your site already looks like that" - ok, nothing moved,
  // nothing published - because a build that did not move read as a lie.
  const already = src.indexOf('verdict = "ok (already so)"');
  const lie = src.indexOf("reply says ok but the build did not move");
  assert.ok(already > 0, "an already-satisfied ask is no longer recognised, so it is called a lie");
  assert.ok(lie > 0 && already < lie, "already-so is judged after the unmoved-build lie, so it never wins");
  // THE CONDITION, NOT THE NEIGHBOURHOOD. The first draft looked 400 characters
  // back from the verdict and found "lookNote" - in the COMMENT above the branch.
  // A sweep deleting the requirement from the code survived it. Prose contains
  // the thing it requires; anchor on the `else if (` that opens this branch.
  const cond = src.slice(src.lastIndexOf("else if (", already), already);
  assert.ok(cond.length > 20 && cond.length < 400, "the already-so condition could not be isolated");
  assert.match(cond, /body\.lookNote/, "already-so is not keyed on the server's own lookNote");
});

test("a claimed success waits for the edge before the site is judged", () => {
  // THE THIRD SWEEP'S FALSE ALARM. The theme lane published noir; the harness
  // read the site seconds before the new script was what the edge served, saw
  // the old build id, and called it a lie. Property: between the reply and the
  // snapshot there is a bounded wait for the build id to move, taken only on a
  // reply that claims a change - an escalate must be read at once, because for
  // it a moved build IS the lie.
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  // Keyword-free: the reply became `let body` when the build hop arrived (it
  // replaces the body with the rebuild's answer), and the old `const` landmark
  // reported the wait as gone for a change that had not touched it.
  const reply = src.indexOf("body = (reply && reply.json) || {};");
  const start = src.indexOf("const t1 = Date.now();");
  // The probe's id is read into a value since run 13 (a missing id must not
  // count as a moved one), and the snapshot is a `let` because it can be
  // re-taken; both spellings moved for that reason.
  const wait = src.indexOf('const id = probe.headers.get("x-site-build") || "";');
  const snap = src.indexOf("let after = await snapshot();");
  assert.ok(reply > 0 && start > 0 && wait > 0 && snap > 0, "a landmark is gone");
  assert.ok(reply < start && start < wait && wait < snap, "the edge wait does not sit between the reply and the snapshot");
  // THE CONDITION THAT OPENS THE WAIT, taken from the `if (` that closes on
  // the wait's own first line rather than from a byte window.
  const gateAt = src.lastIndexOf("if (", start);
  assert.ok(gateAt > 0 && start - gateAt < 400, "the wait's own condition could not be isolated");
  const gate = src.slice(gateAt, start);
  assert.match(gate, /body\.ok === true/, "the wait is not gated on a claimed success");
  assert.match(gate, /body\.moved/, "the wait is not gated on something having moved - an already-so would wait the full bound");
  // A followed rebuild ships a whole new build without a `moved` list, and is
  // read after the edge, or the seventh sweep calls it a liar the way the
  // third called the theme lane one.
  assert.match(gate, /body\.hopped === "build"/, "a followed rebuild is judged before the edge serves it");
  // A RENAME MOVES THE ADDRESS, NOT THE BUILD (2026-09-02): the head is
  // patched in R2 and nothing compiles, so `c.newSlug` LEFT this gate — the
  // build-id wait would spin its full bound for an id that never moves — and
  // the rename has a wait of its own, on the new address answering with its
  // own canonical, after which the sweep reads the site at its new name.
  assert.ok(!/c\.newSlug/.test(gate), "a rename waits for a build id that a rename never moves");
  const rWait = src.indexOf("const tR = Date.now();");
  assert.ok(rWait > start && rWait < snap, "the rename's own wait is missing, or sits outside the wait-then-snapshot order");
  assert.match(src.slice(rWait - 200, rWait), /c\.newSlug/, "the rename wait is not gated on the rename case");
  const rBody = src.slice(rWait, snap);
  assert.match(rBody, /rel="canonical"/, "the rename wait does not read the canonical at the new address");
  assert.match(rBody, /SITE = `https:\/\/\$\{newSlug\}\.gofarther\.app`/, "after a rename the sweep keeps reading the OLD address, which 301s");
  // BOTH ADDRESSES, UP TO THE ALIAS CACHE'S LIFETIME (run 19): the old
  // address kept serving the site for a while after the rename — an edge
  // holding the row it cached before, 300 s per isolate — and a wait on the
  // new address alone called a correct rename a lie.
  assert.match(rBody, /https:\/\/\$\{PUBLIC\}\.gofarther\.app\//, "the rename wait does not watch the old address's redirect");
  assert.match(rBody, /old\.status >= 300 && old\.status < 400/, "the old address is not required to redirect before the rename is judged");
  // The break itself, not the window: a sweep can leave `oldOk` computed and
  // drop it from the condition, which every line above still passes.
  assert.match(rBody, /if \((?:headOk && oldOk|oldOk && headOk)\) break;/, "the wait ends before the old address redirects");
  const bound = /Date\.now\(\) - tR < (\d+)/.exec(rBody);
  assert.ok(bound && Number(bound[1]) >= 300000, "the rename wait is shorter than the alias cache's five-minute lifetime: " + (bound && bound[1]));
  // …and is judged with the build UNMOVED, by its own rule, before the generic
  // one that reads an unmoved build as a lie.
  // (`c.newSlug || forgot` since 2026-09-02: a forget is judged by the same
  // rule — addresses, the row, the build unmoved.)
  const rv = src.indexOf("else if (c.newSlug || forgot) {");
  const generic = src.indexOf("const moved = after.build !== before.build;");
  assert.ok(rv > 0 && generic > rv, "a rename is judged by the generic rule, which calls an unmoved build a lie");
  // The verdict's own expression, not the window: a sweep found `still`
  // computed and then left out of the verdict, which the window could not see.
  assert.match(src.slice(rv, generic), /verdict = chk\.ok && (?:still|after\.build === before\.build) \? "ok" : "LIE"/, "a rename that moved the build passes");
  // AND THE FLIPPED ASK IS THE ONE SENT — the wiring hop: a target decided at
  // run time and the case's fixed ask posted anyway would rename to a name
  // the site already has and read as "refused as coded".
  assert.match(src, /instruction: ask, layer: "look"/, "the runner posts the case's fixed ask rather than the one chosen at run time");
  // A FAILED LANE IS A RED RUN (run 17): "failed" ended a green run.
  const exitRule = src.slice(src.indexOf("const bad = results.filter"), src.indexOf("process.exit(bad.length"));
  assert.match(exitRule, /failed/, "a failed lane leaves the run green");
  assert.match(src.slice(start, wait), /90000|60000|75000/, "the wait is unbounded");
  // A MISSING ID IS NOT A MOVED ID (run 13, 2026-09-02): one probe without
  // the header broke the wait at once and the snapshot read the old build,
  // so a correct edit was called a lie. The break needs a real id that
  // differs, and the snapshot that follows must show that id or be re-taken.
  const brk = src.slice(wait, src.indexOf("break;", wait));
  assert.match(brk, /^const id = probe\.headers\.get\("x-site-build"\) \|\| "";/, "the probe's id is not read into a value");
  const loopBody = src.slice(start, snap);
  assert.match(loopBody, /if \(id && id !== before\.build\) \{ seen = id; break; \}/, "the wait breaks on an empty id, or does not record the id it saw");
  const retake = src.slice(snap, src.indexOf("const claimedOk", snap));
  assert.match(retake, /after\.build !== seen/, "a snapshot from an edge still on the old script is not re-taken");
  assert.match(retake, /after = await snapshot\(\)/, "the re-take does not replace the snapshot");
  assert.match(retake, /i < \d/, "the re-take is unbounded");
});

test("the wordmark check reads the served mark's own bytes, since the brand link already carries one", () => {
  // THE FOURTH SWEEP'S FALSE ALARM, then the second ask. The lane bakes its
  // drawing to /logo.svg and the header shows <img src="/logo.svg">; the first
  // check looked for an inline <svg> in the header and called a working lane a
  // liar. The site now HAS a mark, so a second ask ("redraw it as CGS") leaves
  // the brand link byte-identical — the evidence is the file itself changing.
  const c = CASES.find((x) => x.lane === "wordmark");
  const link = '<a href="/"><img src="/logo.svg" alt="Crookes Guitar School"/></a>';
  const before = { brandLink: link, logo: '<svg viewBox="0 0 120 40"><text>DI:</text></svg>' };
  const after = { brandLink: link, logo: '<svg viewBox="0 0 160 40"><text>CGS</text></svg>' };
  assert.equal(c.check(before, after, {}).ok, true, "a redrawn /logo.svg behind an unchanged brand link is not recognised");
  assert.equal(c.check(before, before, {}).ok, false, "an unchanged mark passes");
  assert.equal(c.check(before, { ...after, brandLink: '<a href="/">Crookes Guitar School</a>' }, {}).ok, false, "a brand link that lost its mark passes");
  assert.equal(c.check(before, { ...after, logo: "" }, {}).ok, false, "a mark that stopped being served passes");
  assert.match(c.check(before, after, {}).note, /logo\.svg \d+→\d+ bytes/, "the note does not carry the byte counts");
});

test("the held lanes are verified when named: a rename on both addresses, a rebuild on the site", () => {
  const slug = CASES.find((x) => x.lane === "slug");
  assert.equal(slug.newSlug, "crookes-guitar", "the rename case does not say which address it claims");
  // RE-RUNNABLE: the target flips to whichever name the site does not have.
  assert.equal(slug.flip("fretwork-1", "fretwork-1"), "crookes-guitar");
  assert.equal(slug.flip("crookes-guitar", "fretwork-1"), "fretwork-1", "a site already at the new name is not asked back to its storage name");
  assert.match(slug.askFor("fretwork-1"), /"fretwork-1"/, "the flipped ask does not name the flipped target");
  const ok = { newSlug: "crookes-guitar", newStatus: 200, oldStatus: 301, oldLocation: "https://crookes-guitar.gofarther.app/", newCanonical: "https://crookes-guitar.gofarther.app/" };
  assert.equal(slug.check({}, {}, {}, ok).ok, true);
  assert.equal(slug.check({}, {}, {}, { ...ok, oldStatus: 200, oldLocation: "" }).ok, false, "an old address that still answers is not a rename");
  assert.equal(slug.check({}, {}, {}, { ...ok, newStatus: 404 }).ok, false, "a new address that does not answer is not a rename");
  assert.equal(slug.check({}, {}, {}, { ...ok, oldLocation: "https://fretwork-1.gofarther.app/" }).ok, false, "a redirect elsewhere is not this rename");
  // RUN 17'S EXACT STATE (2026-09-02): both addresses right, the head at the
  // new one still naming the old. The alias was live; the sidecar was not.
  assert.equal(slug.check({}, {}, {}, { ...ok, newCanonical: "https://fretwork-1.gofarther.app/" }).ok, false, "a new address whose canonical names the old one passes as a rename");
  assert.equal(slug.check({}, {}, {}, { ...ok, newCanonical: "" }).ok, false, "a new address with no canonical passes as a rename");
  // And the flipped direction judges by the same rule, with the names swapped.
  assert.equal(slug.check({}, {}, {}, { newSlug: "fretwork-1", newStatus: 200, oldStatus: 301, oldLocation: "https://fretwork-1.gofarther.app/", newCanonical: "https://fretwork-1.gofarther.app/" }).ok, true);
  const kind = CASES.find((x) => x.lane === "kind");
  assert.equal(kind.hop, "build", "the kind case does not follow the escalate to the rebuild route");
  const b = { build: "a", html: "<h1>old</h1>", title: "Old", slots: [] };
  assert.equal(kind.check(b, { build: "b", html: "<h1>new</h1>", title: "New", slots: ["booking"] }, {}, { rebuilt: true }).ok, true);
  assert.equal(kind.check(b, { ...b }, {}, { rebuilt: true }).ok, false, "an unchanged site passes as rebuilt");
  assert.equal(kind.check(b, { build: "b", html: "<h1>new</h1>", title: "New", slots: [] }, {}, { rebuilt: false }).ok, false, "a rebuild that did not publish passes");
});

test("the slug lane's second job — forget — is its own held case, chosen by key", () => {
  // Owner, 2026-09-02: "i want that" — an old address stops answering and the
  // name is free. A `key` on the case, because the table names each lane once.
  const f = CASES.find((x) => x.key === "forget");
  assert.ok(f, "there is no forget case");
  assert.equal(f.lane, "slug", "forget is not the slug lane's job");
  assert.ok(typeof f.held === "string" && f.held.length > 20, "forget is not held with a reason");
  assert.ok(!chooseLanes("all", CASES).includes("forget"), "`all` would forget an address for good");
  assert.deepEqual(chooseLanes("forget", CASES), ["forget"]);
  assert.match(f.formerAsk("crookes-guitar"), /"crookes-guitar"/, "the ask does not name the address to forget");
  const ok = { forgot: "crookes-guitar", goneStatus: 404, currentStatus: 200, rowGone: true };
  assert.equal(f.check({}, {}, {}, ok).ok, true);
  assert.equal(f.check({}, {}, {}, { ...ok, goneStatus: 301 }).ok, false, "an old address that still redirects passes as forgotten");
  assert.equal(f.check({}, {}, {}, { ...ok, goneStatus: 200 }).ok, false, "an old address that still serves passes as forgotten");
  assert.equal(f.check({}, {}, {}, { ...ok, currentStatus: 404 }).ok, false, "a site that stopped answering passes");
  assert.equal(f.check({}, {}, {}, { ...ok, rowGone: false }).ok, false, "a row still there passes");
  // The runner looks a case up by its key, skips the forget before spending
  // when the site has no old name, and judges it with the build unmoved.
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  assert.match(src, /CASES\.find\(\(x\) => \(x\.key \|\| x\.lane\) === lane\)/, "the runner finds cases by lane alone, so the forget case is unreachable");
  const skip = src.indexOf('verdict: "skipped"');
  assert.ok(skip > 0 && skip < src.indexOf("const p = await call(\"POST\""), "a site with no old name is not skipped before the post");
  assert.match(src, /else if \(c\.newSlug \|\| forgot\) \{/, "a forget is judged by the generic rule, which reads an unmoved build as a lie");
  assert.match(src, /current=is\.false&select=alias/, "the forget's target is not read off the alias table");
});

test("the runner follows kind to the rebuild route only on that escalate, and reads a rename off both addresses", () => {
  // `kind` is the one lane whose honest answer is "this is a rebuild", and the
  // chatbox follows that escalate to the rebuild route. The runner does the
  // same, ONCE, gated on the case saying so AND the reply escalating there -
  // a css lane that happened to answer escalate:build must not buy a rebuild.
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  const hop = src.indexOf('c.hop === "build" && body.escalate === true && body.reason === "build"');
  assert.ok(hop > 0, "the build hop is not gated on the case and the escalate");
  const post = src.indexOf('"/api/site/react-revise"');
  assert.ok(post > hop, "the rebuild route is called outside the hop");
  const watch = src.indexOf("/api/site/build/${bjob}");
  assert.ok(watch > post, "the rebuild is not watched to its end");
  // WATCHED TO A TERMINAL ANSWER: 202 is "still building", anything else ends
  // the watch. Then the body becomes the rebuild's own answer, marked as such.
  assert.match(src.slice(watch, watch + 400), /q\.status !== 202/, "the watch does not read 202 as pending");
  assert.match(src.slice(watch, watch + 900), /hopped: "build"/, "the rebuild's answer is not marked as the hop's");
  // The snapshot is taken AFTER the hop, so the site read is the rebuilt one.
  // (`let`, since run 13: a snapshot from a stale edge is re-taken.)
  assert.ok(src.indexOf("let after = await snapshot();") > watch, "the site is read before the rebuild finishes");
  // The evidence block is the `if (c.newSlug) {` that reads `extra.oldLocation`
  // (the rename wait, added 2026-09-02, opens on `body.ok === true && c.newSlug`).
  const both = src.indexOf("    if (c.newSlug) {");
  assert.ok(both > 0 && src.indexOf("extra.oldLocation", both) > both, "the rename is not read off both addresses");
  assert.match(src.slice(both, both + 900), /redirect: "manual"/, "the old address is followed, so its 301 can never be seen");
  // THE OLD ADDRESS IS THE NAME THE SITE HAD, not SITE — which has moved on
  // to the new name by the time the evidence is read — and the sweep then
  // remembers the new name as the one a second rename flips away from.
  assert.match(src.slice(both, both + 900), /https:\/\/\$\{PUBLIC\}\.gofarther\.app\//, "the old address is read from SITE, which already points at the new name");
  assert.match(src.slice(both, both + 1200), /PUBLIC = newSlug/, "a second rename in the same run would flip from the wrong name");
  // AND THE SWEEP FOLLOWS AN ALIAS ONCE AT THE START, so a renamed site is not
  // read as "does not answer 200" through its own 301.
  const follow = src.indexOf("let PUBLIC = SLUG;");
  assert.ok(follow > 0 && follow < src.indexOf("let before = await snapshot();"), "the public name is not resolved before the first snapshot");
  assert.match(src.slice(follow, follow + 700), /SITE = `https:\/\/\$\{PUBLIC\}\.gofarther\.app`/, "a 301 from the storage name is not followed to where the site lives");
});

test("the action check wants the words changed AND the link kept, read off the header's own button", () => {
  // THE SEVENTH SWEEP. The rung changed the words and moved the button from
  // the dial link to "/" - a request about wording cost the page its one
  // working control - and the check, reading a `site-link` slot the new
  // anchor no longer carried, called it a lie for the wrong reason.
  const c = CASES.find((x) => x.lane === "action");
  // THE ASK NAMES THE LINK (run 12: the words alone were "already so" and the
  // link stayed "/"), so the pass is the words AND a dial link to the number,
  // whichever way the model spells a UK number.
  assert.match(c.ask, /0114 496 0123/, "the ask does not name the number the button must ring");
  const b = { cta: { text: "Your first lesson is free", href: "/" } };
  for (const href of ["tel:+441144960123", "tel:01144960123", "tel:+44 114 496 0123", "tel:0114 496 0123", "tel:+44-114-496-0123"]) {
    assert.equal(c.check(b, { cta: { text: "Book a free lesson", href } }, {}).ok, true, "the right words on the dial link " + href + " is not a pass");
  }
  const lost = c.check(b, { cta: { text: "Book a free lesson", href: "/" } }, {});
  assert.equal(lost.ok, false, "the right words on a link to the page itself passes");
  assert.match(lost.note, /NOT the dial link/, "the note does not say the link is wrong");
  assert.equal(c.check(b, { cta: { text: "Your first lesson is free", href: "tel:+441144960123" } }, {}).ok, false, "unchanged words pass");
  assert.equal(c.check(b, { cta: { text: "Book a free lesson", href: "tel:+441144960124" } }, {}).ok, false, "a dial link to a different number passes");
  assert.equal(c.check({ cta: { text: "", href: "" } }, { cta: { text: "", href: "" } }, {}).ok, false, "a site with no button passes");
  // The snapshot reads the header's last non-language anchor, by position.
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  const cta = src.indexOf("cta: (() => {");
  assert.ok(cta > 0, "the snapshot no longer reads the call-to-action");
  assert.match(src.slice(cta, src.indexOf("})(),", cta)), /lang=/, "the language switches are not excluded, so the last anchor is a language");
});

test("a reply that shipped is never already-so, and the edge is waited for on any claimed publish", () => {
  // The qr lane's look step says "already so" for a stored code and the page
  // step behind it publishes to place it; the nav rung reports `changed`, not
  // `moved`. The seventh sweep judged both before the edge served them.
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  const already = src.indexOf('verdict = "ok (already so)"');
  const cond = src.slice(src.lastIndexOf("else if (", already), already);
  assert.match(cond, /body\.changed/, "already-so is not refused for a reply that changed pages");
  assert.match(cond, /body\.files/, "already-so is not refused for a reply that published files");
  const start = src.indexOf("const t1 = Date.now();");
  const gate = src.slice(src.lastIndexOf("if (", start), start);
  assert.match(gate, /body\.changed/, "the edge wait ignores a reply that changed pages");
  assert.match(gate, /body\.files/, "the edge wait ignores a reply that published files");
});

test("the three check accepts a component-only publish, and still refuses a scene that went or a build that did not move", () => {
  // RUN 14 (2026-09-02): the slower pick published as a part-only change —
  // `changed: []`, `files: 25`, the page byte-identical — and the check, keyed
  // on the page list alone, called it a lie and stopped the run before kind
  // and slug. Any of the three signs of a publish is a publish.
  const c = CASES.find((x) => x.lane === "three");
  const b = { canvas: true, build: "b1", html: "<html>x</html>" };
  const a = { canvas: true, build: "b2", html: "<html>x</html>" };
  assert.equal(c.check(b, a, { changed: [], files: 25 }).ok, true, "a component-only publish (files, no page listed) is refused");
  assert.match(c.check(b, a, { changed: [], files: 25 }).note, /component only/, "the note does not say the change was in a component");
  assert.equal(c.check(b, a, { changed: ["index.tsx"], files: 25 }).ok, true, "a page change is refused");
  assert.equal(c.check(b, { ...a, html: "<html>y</html>" }, {}).ok, true, "a moved page with no reply fields is refused");
  assert.equal(c.check(b, { ...a, canvas: false }, { changed: [], files: 25 }).ok, false, "a scene that went passes");
  assert.equal(c.check(b, { ...a, build: "b1" }, { changed: [], files: 25 }).ok, false, "an unmoved build passes");
  assert.equal(c.check(b, a, { changed: [], files: 0 }).ok, false, "nothing shipped and an unchanged page passes");
});

test("the qr check demands the page show the code, not only serve it", () => {
  // THE FIFTH SWEEP. /qr.svg decoded exactly to the payload asked for and the
  // page referenced it zero times: the lane bakes the file and nothing places
  // the figure. A check that stopped at the decode would call an invisible
  // change a success. Driven with a real code for the asked payload.
  const c = CASES.find((x) => x.lane === "qr");
  const qrcode = require("qrcode-generator");
  const q = qrcode(2, "M"); q.addData("tel:01144960123"); q.make();
  const n = q.getModuleCount(); const quiet = 4; const size = n + quiet * 2;
  let d = "";
  for (let r = 0; r < n; r++) { let c0 = -1; for (let cc = 0; cc <= n; cc++) { const dark = cc < n && q.isDark(r, cc); if (dark && c0 < 0) c0 = cc; if (!dark && c0 >= 0) { d += `M${c0 + quiet} ${r + quiet}h${cc - c0}v1h-${cc - c0}z`; c0 = -1; } } }
  const svg = `<svg viewBox="0 0 ${size} ${size}"><path d="${d}"/></svg>`;
  // AN EDIT NOW, NOT AN ADDITION (owner, 2026-09-02: "add will always go in
  // addon"): the ask changes the caption of the code the site has, so the
  // pass needs the code unchanged, shown, AND the new caption on the page.
  const before = { qr: "", html: "<html></html>" };
  const shown = "<html><img src=\"/qr.svg\" alt=\"Scan to ring and book\">Scan to ring and book</html>";
  assert.equal(c.check(before, { qr: svg, html: shown }, {}).ok, true, "a shown, correct code with the new caption is not accepted");
  assert.equal(c.check(before, { qr: svg, html: "<html>Scan to ring and book</html>" }, {}).ok, false, "a served but unshown code passes");
  assert.equal(c.check(before, { qr: svg, html: "<html><img src=\"/qr.svg\"></html>" }, {}).ok, false, "a shown code with the old caption passes");
  assert.equal(c.check(before, { qr: "<svg viewBox=\"0 0 33 33\"><path d=\"M4 4h7v1h-7z\"/></svg>", html: shown }, {}).ok, false, "a shown but wrong code passes");
  assert.match(c.ask, /^Change /, "the ask must be an edit of the code the site has, not an addition");
});

test("the langs case asks for a language the site lacks, reads the variant's WORDS, and prints the spine's own account (2026-09-04)", async () => {
  // fretwork-1 served /es and /fr in English for three days while this case
  // called the lane proven: it asked for the two languages the site already
  // had (a re-run answers "already" and publishes nothing) and judged the
  // switcher and the head, never a translated word. The spine's translation
  // call had failed on every publish and said so only in the Worker's log.
  const { strip } = await import("../scripts/addon-sweep.mjs");
  const c = CASES.find((x) => x.lane === "langs");
  assert.ok(c, "no langs case");
  // RUN 38 ADDED GERMAN and left the site at its three-language cap, so the
  // ask is the inverse: German off. Asking for a language the site has
  // answers already-so and publishes nothing; a fourth is refused at the cap.
  assert.match(c.ask, /Stop offering the site in German/, "the ask does not take German off");
  assert.equal(c.variant, "/es", "the case does not read the Spanish page, the one whose cache was poisoned");
  assert.equal(c.gone, "/de", "the case does not say which prefix must stop answering");
  const primaryHtml = "<html><body><header><nav><a>Cymraeg</a><a>Français</a><a>Español</a></nav></header><main><h1>Book a guitar lesson</h1>" +
    "<p>Lessons in Crookes for complete beginners, taught one to one.</p>" +
    "<p>First lesson I walked out able to change between E and A without looking down.</p>" +
    "<p>Ring us on 0114 496 0123 to book a free first lesson today.</p></main></body></html>";
  const a = { html: primaryHtml, headerText: "Cymraeg Français Español" };
  const spanish = "Reserva una clase de guitarra Clases en Crookes para principiantes absolutos, uno a uno. " +
    "En la primera clase salí sabiendo cambiar entre Mi y La sin mirar el mástil. " +
    "Llámanos al 0114 496 0123 y reserva hoy una primera clase gratuita.";
  const account = [{ tag: "es", missing: 88, ok: true }, { tag: "fr", missing: 88, ok: true }];
  const good = c.check({}, a, { langs: account }, { variant: { status: 200, build: "b2", text: spanish }, gone: { status: 404 } });
  assert.equal(good.ok, true, good.note);
  assert.match(good.note, /3 of 3 primary sentences translated away/, good.note);
  assert.match(good.note, /\/de answers 404 \(gone\)/, good.note);
  assert.match(good.note, /the spine's account: \[\{"tag":"es"/, "the reply's per-language outcome is not printed");
  // THE FAILURE THIS CASE EXISTS TO CATCH: the variant serves the primary's words.
  const failed = [{ tag: "es", missing: 88, ok: false, why: "call", error: "anthropic 400 — credit balance too low" }];
  const english = c.check({}, a, { langs: failed }, { variant: { status: 200, build: "b2", text: strip(primaryHtml) }, gone: { status: 404 } });
  assert.equal(english.ok, false, "a variant in the primary's own words passes as translated");
  assert.match(english.note, /0 of 3 primary sentences translated away/, english.note);
  assert.match(english.note, /"why":"call","error":"anthropic 400 — credit balance too low"/, "the reason the spine gave is not in the note");
  // A variant that does not answer, a switcher that kept the language, a
  // prefix still served, or nothing read at all: none is a pass.
  assert.equal(c.check({}, a, { langs: account }, { variant: { status: 404, build: "", text: "" }, gone: { status: 404 } }).ok, false, "a 404 variant passes");
  assert.equal(c.check({}, { html: primaryHtml, headerText: "Cymraeg Français Español Deutsch" }, { langs: account }, { variant: { status: 200, build: "b2", text: spanish }, gone: { status: 404 } }).ok, false, "a switcher that kept the language passes");
  const stillServed = c.check({}, a, { langs: account }, { variant: { status: 200, build: "b2", text: spanish }, gone: { status: 200 } });
  assert.equal(stillServed.ok, false, "a prefix still served after the language was taken off passes");
  assert.match(stillServed.note, /\/de answers 200 \(STILL SERVED\)/, stillServed.note);
  assert.equal(c.check({}, a, {}, {}).ok, false, "no variant read at all passes");
  // AND THE RUNNER READS THE VARIANT for a case that names one, until the
  // build the home page is on serves it, and the prefix that must be gone
  // until an edge stops serving the old build's copy; both go to the check.
  const src = readFileSync(new URL("../scripts/lane-sweep.mjs", import.meta.url), "utf8");
  const at = src.indexOf("if (c.variant) {");
  assert.ok(at > 0, "the runner never reads the variant page");
  const block = src.slice(at, src.indexOf("extra.variant = {", at) + 200);
  assert.match(block, /await site\(c\.variant\)/, "the variant is not fetched through the harness's own reader");
  assert.match(block, /=== after\.build\) break;/, "the variant is not re-read until the home page's build serves it");
  assert.match(block, /text: v && v\.status === 200 \? words\(v\.text\) : ""/, "the variant's words are not read off its HTML");
  const goneAt = src.indexOf("if (c.gone) {");
  assert.ok(goneAt > at, "the runner never reads the prefix that must be gone");
  const goneBlock = src.slice(goneAt, src.indexOf("extra.gone = {", goneAt) + 60);
  assert.match(goneBlock, /await site\(c\.gone\)/, "the gone prefix is not fetched through the harness's own reader");
  assert.match(goneBlock, /g\.status === 200 && \(g\.headers\.get\("x-site-build"\) \|\| ""\) !== after\.build/, "a stale edge copy of the removed prefix is read as the language still served");
  assert.ok(goneAt < src.indexOf("const chk = c.check(before, after, body, extra);"), "the prefix is read after the check that needs it");
});
