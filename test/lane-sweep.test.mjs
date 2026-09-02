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
  assert.equal(new Set(cases).size, cases.length, "a lane has two cases — which one is the verdict?");
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
  // A name the product does not have is dropped, not guessed at.
  assert.deepEqual(chooseLanes("css,nonsense,theme", CASES), ["css", "theme"]);
  assert.deepEqual(chooseLanes("", CASES), all, "an empty selection is `all`, which is the documented default");
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
  // The two held lanes publish without a `moved` list: a rebuild ships a whole
  // new build, a rename republishes the head (canonical, og:url). Both are
  // read after the edge, or the seventh sweep calls them liars the way the
  // third called the theme lane one.
  assert.match(gate, /body\.hopped === "build"/, "a followed rebuild is judged before the edge serves it");
  assert.match(gate, /c\.newSlug/, "a rename is judged before the edge serves the republished head");
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
  assert.equal(slug.check({}, {}, {}, { newStatus: 200, oldStatus: 301, oldLocation: "https://crookes-guitar.gofarther.app/" }).ok, true);
  assert.equal(slug.check({}, {}, {}, { newStatus: 200, oldStatus: 200, oldLocation: "" }).ok, false, "an old address that still answers is not a rename");
  assert.equal(slug.check({}, {}, {}, { newStatus: 404, oldStatus: 301, oldLocation: "https://crookes-guitar.gofarther.app/" }).ok, false, "a new address that does not answer is not a rename");
  assert.equal(slug.check({}, {}, {}, { newStatus: 200, oldStatus: 301, oldLocation: "https://fretwork-1.gofarther.app/" }).ok, false, "a redirect elsewhere is not this rename");
  const kind = CASES.find((x) => x.lane === "kind");
  assert.equal(kind.hop, "build", "the kind case does not follow the escalate to the rebuild route");
  const b = { build: "a", html: "<h1>old</h1>", title: "Old", slots: [] };
  assert.equal(kind.check(b, { build: "b", html: "<h1>new</h1>", title: "New", slots: ["booking"] }, {}, { rebuilt: true }).ok, true);
  assert.equal(kind.check(b, { ...b }, {}, { rebuilt: true }).ok, false, "an unchanged site passes as rebuilt");
  assert.equal(kind.check(b, { build: "b", html: "<h1>new</h1>", title: "New", slots: [] }, {}, { rebuilt: false }).ok, false, "a rebuild that did not publish passes");
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
  const both = src.indexOf("if (c.newSlug) {");
  assert.ok(both > 0 && src.indexOf("extra.oldLocation", both) > both, "the rename is not read off both addresses");
  assert.match(src.slice(both, both + 600), /redirect: "manual"/, "the old address is followed, so its 301 can never be seen");
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
