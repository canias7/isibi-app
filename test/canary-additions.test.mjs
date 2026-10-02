// The additions batch (2026-10-02): run 90's five additions, word for word,
// through the real app — and what decides whether they passed.
//
// The scenario lives in canary-ui.mjs (`12-additions`), the verdict in
// canary-additions.mjs, and the canary's UI branch hands one to the other.
// Each is driven here with literal inputs: the scenario against the batch file
// run 90 routed, the wall with the requests a page makes, and the verdict with
// pages written by the menu editor's own writers — so "it landed" here means
// what the builder itself would read back.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { UI_SCENARIOS, wallRefusal, blocksPost, readUiScenario } from "../scripts/canary-ui.mjs";
import {
  additionRequestVerdict, additionReplyVerdict, storedAdditionsVerdict, servedAdditionsVerdict, additionsVerdict,
  telNumber, profileMatches, outsideChrome,
} from "../scripts/canary-additions.mjs";
import { applyNav, applyChromeList, applyAction, withAdded } from "../builder/site-nav.mjs";

const SPEC = UI_SCENARIOS["12-additions"];
const SLUG = "fold-lane-bakery";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const CANARY = read("../scripts/edit-canary.mjs");
const PAGES = ["index", "order", "starter", "visit", "gallery"].map((n) => ({ path: n + ".tsx", source: read(`./fixtures/run47/${n}.before.tsx`) }));
const OWN_SOURDOUGH = "/u/fold-lane-bakery/8e6bd4818b036cfcd639d1bb5ec6156c.jpg";
const LINE = '      <p className="mx-auto max-w-3xl px-6">We’re closed on bank holidays.</p>\n';
const PHOTO = `      <SafeImage src="${OWN_SOURDOUGH}" alt="A sourdough boule cooling after the morning bake" />\n`;

/**
 * The five additions as the builder makes them: the frame's three by the menu
 * editor's own writers in their addition form, and the line and the photograph
 * as the add-on's page call would place them on the Visit page.
 */
function delivered(pages, o = {}) {
  const want = { menu: true, social: true, button: true, words: true, photo: true, ...o };
  let out = pages;
  if (want.menu) out = applyNav(out, (items) => withAdded(items, [{ item: { label: "Order", href: "/order" }, after: "$end" }])).pages;
  if (want.social) out = applyChromeList(out, "social", (items) => withAdded(items, [{ item: { network: "instagram", href: o.instagram || "https://instagram.com/harbourloaf" }, after: "$end" }])).pages;
  if (want.button) out = applyAction(out, { label: "Call us", href: "tel:01174960000" }, false, "secondAction").pages;
  const extra = (want.words ? LINE : "") + (want.photo ? PHOTO : "");
  const on = o.on || "visit.tsx";
  return out.map((p) => (p.path !== on || !extra ? p : { ...p, source: p.source.replace(/\n(\s*)<\/SiteChrome>(?![\s\S]*<\/SiteChrome>)/, "\n" + extra + "$1</SiteChrome>") }));
}
const READ = (pages) => ({ pages, parts: [], complete: true });
const stored = (after, before = PAGES) => storedAdditionsVerdict({ spec: SPEC, before: READ(before), after: READ(after), slug: SLUG });
const failing = (v) => v.checks.filter((c) => !c.ok).map((c) => c.name);

// ── THE SCENARIO ────────────────────────────────────────────────────────────

test("the batch is run 90's five additions word for word, on the bakery, each walled to its own work", () => {
  const audit = JSON.parse(read("../scripts/router-probes/router-audit-1.json"));
  const run90 = ["A1", "A2", "A3", "A4", "A5"].map((id) => audit.probes.find((p) => p.id === id));
  assert.ok(run90.every((p) => p && p.site === SLUG), "the observer is alive: run 90's five are on the bakery");
  assert.deepEqual(SPEC.steps.map((s) => s.say), run90.map((p) => p.message), "a message is not run 90's own words");
  assert.equal(SPEC.site, SLUG);
  assert.equal(readUiScenario("12-additions", SLUG).ok, true);
  assert.equal(readUiScenario("12-additions", "fretwork-1").ok, false, "the scenario ran on another site");
  assert.equal(SPEC.adds, true);
  assert.ok(Number.isSafeInteger(SPEC.budget) && SPEC.budget > 0 && SPEC.budget <= 72, "the budget is not a bound the balance can meet");
  // THE THREE FRAME ITEMS ARE HANDED TO THE MENU EDITOR; the line and the
  // photograph make no edit at all.
  assert.deepEqual(SPEC.steps.map((s) => [s.hop || "", [...s.layers]]), [["nav", ["nav"]], ["nav", ["nav"]], ["nav", ["nav"]], ["", []], ["", []]]);
  assert.deepEqual(Object.keys(SPEC.additions).sort(), ["button", "menu", "photo", "social", "words"]);
});

// ── THE WALL ────────────────────────────────────────────────────────────────

test("the wall opens the add-on step for this site alone, and holds every edit to the add-on's own hand-over", () => {
  const [frame, , , words] = SPEC.steps;
  const at = (step, method, pathname, body) => wallRefusal({ method, pathname, body: body ? JSON.stringify(body) : null, scenario: SPEC, step });
  // Let out: the routing call (even for a message that makes no edit), the
  // add-on request for this site, the menu editor's edit carrying the flag,
  // and every read.
  assert.equal(at(words, "POST", "/api/site/route", { message: words.say }), "");
  assert.equal(at(frame, "POST", `/api/site/${SLUG}/addon`, { instruction: frame.say }), "");
  assert.equal(at(words, "POST", `/api/site/${SLUG}/addon`, { instruction: words.say }), "");
  assert.equal(at(frame, "POST", `/api/site/${SLUG}/edit`, { layer: "nav", addition: true, instruction: frame.say }), "");
  assert.equal(at(frame, "GET", `/api/site/edit/${"1".repeat(32)}`), "");
  // Stopped: the menu editor without the flag (a router that sent the message
  // straight there), any other layer, any edit for the line, another site's
  // add-on, and the work no scenario asks for.
  assert.match(at(frame, "POST", `/api/site/${SLUG}/edit`, { layer: "nav", instruction: frame.say }), /not an addition the add-on step handed over/);
  assert.match(at(frame, "POST", `/api/site/${SLUG}/edit`, { layer: "nav", addition: "true" }), /not an addition/, "a flag that is not true was taken as one");
  assert.match(at(frame, "POST", `/api/site/${SLUG}/edit`, { layer: "text", addition: true }), /text layer/);
  assert.match(at(words, "POST", `/api/site/${SLUG}/edit`, { layer: "nav", addition: true }), /nav layer/);
  assert.match(at(words, "POST", `/api/site/${SLUG}/edit`, { layer: "text" }), /text layer/);
  assert.match(at(frame, "POST", "/api/site/fretwork-1/addon", {}), /never asks for/);
  assert.match(at(frame, "POST", "/api/site/fretwork-1/edit", { layer: "nav", addition: true }), /not this scenario's site/);
  for (const p of ["/api/site/react-build", "/api/site/build", "/api/site/react-revise"]) assert.match(at(frame, "POST", p, {}), /never asks for/);
  // AND EVERY OTHER SCENARIO KEEPS THE ADD-ON SHUT, the bakery's included.
  for (const name of Object.keys(UI_SCENARIOS).filter((n) => n !== "12-additions")) {
    const sc = UI_SCENARIOS[name];
    assert.match(wallRefusal({ method: "POST", pathname: `/api/site/${sc.site}/addon`, body: "{}", scenario: sc, step: sc.steps[0] }), /never asks for/, `${name} let the add-on step through`);
  }
  assert.equal(blocksPost("POST", `/api/site/${SLUG}/addon`), true, "with no scenario the add-on is let through");
});

// ── WHAT LEFT THE PAGE, AND WHAT EACH JOB STORED ────────────────────────────

/** One message's record, as the driver keeps it: the page's own requests and answers. */
function stepRecord(step, o = {}) {
  const job = (n) => String(n).repeat(32);
  const net = [{ method: "POST", path: "/api/site/route", req: { message: o.routedWords || step.say }, res: { ok: true, intent: o.intent || "addon", cost: 2 } }];
  if (o.intent && o.intent !== "addon") return { n: 1, say: step.say, sent: true, network: net, replies: ["⚠️ x"], reply: "⚠️ x" };
  net.push({ method: "POST", path: `/api/site/${SLUG}/addon`, req: { instruction: step.say }, res: { ok: true, job: job(1) } });
  if (step.hop) {
    net.push({ method: "GET", path: `/api/site/edit/${job(1)}`, final: true, res: { ok: false, escalate: true, layer: "nav", kind: "frame", cost: 0 } });
    if (!o.noEdit) net.push({ method: "POST", path: `/api/site/${SLUG}/edit`, req: { instruction: step.say, layer: o.editLayer || "nav", ...(o.flag === false ? {} : { addition: true }) }, res: { ok: true, job: job(2) } });
    if (!o.noEdit) net.push({ method: "GET", path: `/api/site/edit/${job(2)}`, final: true, res: o.navReply || { ok: true, layer: "nav", cost: 2 } });
  } else {
    if (o.extraEdit) net.push({ method: "POST", path: `/api/site/${SLUG}/edit`, req: { instruction: step.say, layer: "text" }, res: { ok: true, job: job(3) } });
    net.push({ method: "GET", path: `/api/site/edit/${job(1)}`, final: true, res: o.addReply || { ok: true, kinds: ["words"], changed: ["/visit"], cost: 4 } });
  }
  const shown = o.shown || "✅ Done.";
  return { n: 1, say: step.say, sent: true, network: net, replies: [shown], reply: shown };
}

test("what left the page: the words routed to the add-on step, and only the add-on's hand-over reaches the menu editor", () => {
  const [frame, , , words] = SPEC.steps;
  assert.equal(additionRequestVerdict(stepRecord(frame), SLUG, frame).ok, true);
  assert.equal(additionRequestVerdict(stepRecord(words), SLUG, words).ok, true);
  const bad = {
    "routed to an edit": additionRequestVerdict(stepRecord(frame, { intent: "edit" }), SLUG, frame),
    "routed other words": additionRequestVerdict(stepRecord(frame, { routedWords: "Add Order." }), SLUG, frame),
    "an edit without the flag": additionRequestVerdict(stepRecord(frame, { flag: false }), SLUG, frame),
    "an edit at another layer": additionRequestVerdict(stepRecord(frame, { editLayer: "page" }), SLUG, frame),
    "no hand-over edit": additionRequestVerdict(stepRecord(frame, { noEdit: true }), SLUG, frame),
    "an edit beside the line": additionRequestVerdict(stepRecord(words, { extraEdit: true }), SLUG, words),
    // THE ROUTER'S OWN ANSWER IS READ, not inferred from an add-on request
    // being there: an edit can hand its sentence to the add-on step too.
    "routed to an edit that then reached the add-on": additionRequestVerdict((() => {
      const r = stepRecord(words);
      r.network[0] = { ...r.network[0], res: { ok: true, intent: "edit", layer: "text", cost: 2 } };
      return r;
    })(), SLUG, words),
  };
  for (const [why, v] of Object.entries(bad)) assert.equal(v.ok, false, `${why} passed: ${JSON.stringify(v)}`);
});

test("what each job stored: the hand-over and the menu editor's success, or the add-on's own success, shown as a success", () => {
  const [frame, , , words] = SPEC.steps;
  assert.equal(additionReplyVerdict(stepRecord(frame), frame).ok, true);
  assert.equal(additionReplyVerdict(stepRecord(words), words).ok, true);
  assert.match(additionReplyVerdict(stepRecord(frame, { navReply: { ok: false, error: "no-change", layer: "nav" } }), frame).why, /did not succeed/);
  assert.match(additionReplyVerdict(stepRecord(frame, { noEdit: true }), frame).why, /1 stored reply/);
  assert.match(additionReplyVerdict(stepRecord(words, { addReply: { ok: false, error: "not-landed", msg: "x" } }), words).why, /not-landed/);
  assert.match(additionReplyVerdict(stepRecord(words, { shown: "⚠️ I couldn't add that." }), words).why, /not a success/);
});

// ── THE STORED SOURCE ───────────────────────────────────────────────────────

test("the five additions, written by the builder's own writers, pass every stored check; the observers read the bakery as it is", () => {
  const v = stored(delivered(PAGES));
  assert.deepEqual(failing(v), [], JSON.stringify(v.checks.filter((c) => !c.ok)));
  assert.ok(v.checks.length >= 12, "a check went missing");
  // The frame object is what is blanked, and only it.
  assert.ok(outsideChrome(PAGES[0].source).includes("const CHROME = {<chrome>}"), "the observer is not alive: no frame object was found");
  assert.equal(outsideChrome(PAGES[2].source), PAGES[2].source, "a page with no frame object is not returned whole");
});

test("each way a delivery can go wrong fails its own stored check", () => {
  const cases = {
    "the menu item on all pages but one": [delivered(PAGES).map((p) => (p.path === "order.tsx" ? delivered([PAGES[1]], { menu: false })[0] : p)), /menu gained "Order"/],
    "one menu written over every page": [delivered(applyNav(PAGES, [{ label: "Today's bake", href: "/" }, { label: "Order", href: "/order" }]).pages, { menu: false }), /menu gained "Order"/],
    "the button replaced, not joined": [delivered(applyAction(PAGES, { label: "Call us", href: "tel:01174960000" }, false, "action").pages, { button: false }), /kept its button/],
    "the Instagram link to another account": [delivered(PAGES, { instagram: "https://instagram.com/someoneelse" }), /instagram link/],
    "no line": [delivered(PAGES, { words: false }), /gained one line/],
    "no photograph": [delivered(PAGES, { photo: false }), /one more photograph/],
    "the line and photograph on the home page": [delivered(PAGES, { on: "index.tsx" }), /byte for byte as it was outside its frame/],
    "a line the Visit page loses": [delivered(PAGES).map((p) => (p.path === "visit.tsx" ? { ...p, source: p.source.replace("Come to the bakery", "Come along") } : p)), /still says everything/],
    // The second button right and the first one changed beside it.
    "the first button changed beside a right second one": [delivered(applyAction(PAGES, { label: "Order now", href: "/order" }, false, "action").pages), /kept its button/],
    // One more photograph, and not of what was asked for.
    "a new photograph of something else": [delivered(PAGES, { photo: false }).map((p) => (p.path === "visit.tsx" ? { ...p, source: p.source.replace(LINE, LINE + '      <SafeImage src="/u/fold-lane-bakery/64eee06cebae214308ea0142e5163286.jpg" alt="Harbour Loaf on a Bristol side street in the early morning" />\n') } : p)), /one more photograph, and its description is about sourdough/],
  };
  for (const [why, [after, re]] of Object.entries(cases)) {
    const names = failing(stored(after));
    assert.ok(names.some((n) => re.test(n)), `${why}: no check failed for it (${JSON.stringify(names)})`);
  }
  // A READ THAT DID NOT ANSWER PROVES NOTHING.
  const half = storedAdditionsVerdict({ spec: SPEC, before: READ(PAGES), after: { ...READ(delivered(PAGES)), complete: false }, slug: SLUG });
  assert.ok(failing(half).includes("both source reads are complete"));
});

test("a telephone link is read by its number, and a profile by its host and path", () => {
  assert.equal(telNumber("tel:01174960000"), "01174960000");
  assert.equal(telNumber("tel:+44 117 496 0000"), "01174960000");
  assert.equal(telNumber("tel:0117-496-0000"), "01174960000");
  assert.equal(telNumber("/call"), "");
  assert.equal(telNumber("tel:"), "");
  const want = SPEC.additions.social;
  for (const ok of ["https://instagram.com/harbourloaf", "https://www.instagram.com/harbourloaf/", "https://instagram.com/HarbourLoaf"]) assert.equal(profileMatches(ok, want), true, ok);
  for (const bad of ["https://instagram.com/harbourloaf2", "https://evil.example/harbourloaf", "instagram.com/harbourloaf", "javascript:alert(1)"]) assert.equal(profileMatches(bad, want), false, bad);
});

// ── WHAT A VISITOR IS SERVED ────────────────────────────────────────────────

const page = ({ menu = true, call = true, insta = true, line = false, photo = false } = {}) =>
  "<html><body><header><nav><a href=\"/\">Today&#x27;s bake</a><a href=\"/visit\">Visit</a>" + (menu ? "<a href=\"/order\">Order</a>" : "") + "</nav>" +
  "<a href=\"/order\">Order a loaf</a>" + (call ? "<a href=\"tel:01174960000\"><span>Call us</span></a>" : "") + "</header>" +
  "<main><h1>Come to the bakery</h1>" + (line ? "<p>We’re closed on bank holidays.</p>" : "") + (photo ? `<img src="${OWN_SOURDOUGH}" alt="A sourdough boule cooling after the morning bake">` : "") + "</main>" +
  "<footer><a href=\"/\">Today&#x27;s bake</a>" + (insta ? "<a href=\"https://instagram.com/harbourloaf\" aria-label=\"instagram\"></a>" : "") + "</footer></body></html>";

test("the published pages show the five to a visitor, and each missing one fails its own check", () => {
  const all = { "/": page(), "/visit": page({ line: true, photo: true }), "/order": page(), "/gallery": page() };
  const v = servedAdditionsVerdict({ spec: SPEC, served: all });
  assert.deepEqual(failing(v), [], JSON.stringify(v.checks.filter((c) => !c.ok)));
  const cases = {
    "a header without Order": [{ ...all, "/order": page({ menu: false }) }, /links "Order"/],
    "a header without Call us": [{ ...all, "/": page({ call: false }) }, /Call us/],
    "a footer without Instagram": [{ ...all, "/gallery": page({ insta: false }) }, /footer links/],
    "Visit without the line": [{ ...all, "/visit": page({ photo: true }) }, /closed on bank holidays/],
    "Visit without the photograph": [{ ...all, "/visit": page({ line: true }) }, /photograph described/],
  };
  for (const [why, [served, re]] of Object.entries(cases)) {
    const names = failing(servedAdditionsVerdict({ spec: SPEC, served }));
    assert.ok(names.some((n) => re.test(n)), `${why}: no check failed (${JSON.stringify(names)})`);
  }
  assert.ok(failing(servedAdditionsVerdict({ spec: SPEC, served: {} })).includes("the published pages were read"), "nothing read passed");
});

// ── THE WHOLE VERDICT, AND THE CANARY'S USE OF IT ───────────────────────────

test("the whole verdict passes only when every message landed and published, in order", () => {
  const steps = SPEC.steps.map((s) => stepRecord(s, s.hop ? {} : { addReply: { ok: true, changed: ["/visit"], cost: 4 } }));
  const served = { "/": page(), "/visit": page({ line: true, photo: true }), "/order": page(), "/gallery": page() };
  const args = { spec: SPEC, steps, chain: { verified: true, links: 5 }, before: READ(PAGES), after: READ(delivered(PAGES)), served, slug: SLUG };
  const v = additionsVerdict(args);
  assert.deepEqual(failing(v), [], JSON.stringify(v.checks.filter((c) => !c.ok)));
  assert.ok(failing(additionsVerdict({ ...args, chain: { verified: true, links: 4 } })).some((n) => /all 5 messages published/.test(n)), "four publishes passed for five messages");
  const unsent = additionsVerdict({ ...args, steps: steps.slice(0, 3) });
  assert.ok(failing(unsent).includes("message 4 was sent") && failing(unsent).includes("message 5 was sent"), "a message never sent passed");
});

test("the canary judges the batch by that verdict inside the paid branch, after the chain, closes its money, and keeps it", () => {
  const branch = CANARY.indexOf("if (UI_ASK) {");
  const gate = CANARY.indexOf("if (!SPEND)");
  assert.ok(branch > 0 && gate > branch, "the mode's branch or the spend gate is gone");
  const win = CANARY.slice(branch, gate);
  const sentGate = win.indexOf("if (SPEND && ui.sent) {");
  const chainAt = win.indexOf("chain = chainVerdict(");
  const at = win.indexOf("if (UI_ASK.scenario.adds) {");
  const end = win.indexOf("if (UI_ASK.scenario.publishes === 0)", at);
  assert.ok(sentGate > 0 && chainAt > sentGate && at > chainAt && end > at, "the additions are not judged after the chain, inside the paid branch");
  const block = win.slice(at, end);
  assert.match(block, /additionsVerdict\(\{/, "the additions are never judged");
  assert.match(block, /steps: ui\.steps, chain,/, "the steps or the chain are not handed to the verdict");
  assert.match(block, /complete: BEFORE\.readsComplete === true/, "the before-read's completeness is not carried");
  assert.match(block, /complete: after\.readsComplete === true/, "the after-read's completeness is not carried");
  assert.match(block, /readFileSync\(`\$\{EVID\}\/after\/route\$\{file\}\.html`/, "the served pages are not the after-read's own");
  assert.match(block, /for \(const c of additions\.checks\) check\(c\.name, c\.ok, c\.why\)/, "a failed addition does not fail the run");
  assert.match(block, /moneyVerdict\(\{ start: ui\.balance\.start, end: ui\.balance\.end, routeCosts: routeCostsOf\(ui\.steps\), jobs: jobRecords \}\)/, "the money is not closed");
  // THE SERVED FILES ARE NAMED AS THE INVENTORY WRITES THEM.
  assert.match(CANARY, /const file = \(r === "\/" \? "_home" : r\.replace\(\/\[\^a-z0-9\]\+\/gi, "_"\)\);\n\s+writeFileSync\(`\$\{EVID\}\/\$\{label\}\/route\$\{file\}\.html`, html\);/, "the inventory names its page files some other way");
  const write = win.slice(win.indexOf("writeFileSync(`${EVID}/ui.json`"));
  assert.match(write, /chain, removal, additions \}/, "ui.json does not carry the additions verdict");
  assert.match(write, /additions \$\{additions\.ok \? "ALL LANDED" : "NOT ALL LANDED"\}/, "ui.txt does not say whether the additions landed");
  assert.match(CANARY, /import \{ additionsVerdict \} from "\.\/canary-additions\.mjs"/);
});
