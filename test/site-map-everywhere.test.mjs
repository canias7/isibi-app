// THE MAP IN EVERY CALL THAT REASONS ABOUT A SITE (2026-10-26, the owner:
// "isn't the map in everything already"). Live case: driftwood-and-daughters-5
// asked "Which component is the reviews section?" after being told the heading,
// because the page step saw `Band3Split` and no words.
//
// The wiring half is read from worker.js itself: every model-call site
// (`quickSend(`, `quickSendLive(`, `pagesCall(env)`, `callBuilderModel(`) is
// found by pattern, never by a hand list, and must either carry the map
// (`mappedSend(` / `mappedCall(` on its line) or be named below with a reason.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteMap, blocksOf, siteSlice, withMapNote, mapSend, mapCall, MAP_MARK } from "../builder/site-map.mjs";

const page = 'import Band1Hero from "@/routes/-parts/band-1-hero";\nimport Band2Today from "@/routes/-parts/band-2-today";\nimport Band3Split from "@/routes/-parts/band-3-split";\nfunction P() { return (<main><Band1Hero /><Band2Today /><Band3Split /></main>); }';
const parts = [
  { name: "band-1-hero", source: "export default function Band1Hero() { return <section><h1>Driftwood &amp; Daughters</h1><p>Surf, coffee and boards</p></section>; }" },
  { name: "band-2-today", source: "export default function Band2Today() { return <section><h2>Today's surf</h2><p>What that means for lessons</p></section>; }" },
  { name: "band-3-split", source: "export default function Band3Split() { return <section><h2>What people say after a session</h2></section>; }" },
];

test("blocks are listed in the order the page shows them, each with its first words", () => {
  const b = blocksOf(page, new Map(parts.map((p) => [p.name, p.source])));
  assert.deepEqual(b.map((x) => x.name), ["Band1Hero", "Band2Today", "Band3Split"]);
  assert.equal(b[2].words[0], "What people say after a session");
  assert.deepEqual(blocksOf("function P(){ return <main><h1>x</h1></main> }", new Map()), []);
});

test("the slice says everything about the site, the step's own section first", () => {
  const map = buildSiteMap({
    pages: [{ path: "src/routes/index.tsx", source: page }], parts,
    spec: { tables: [{ name: "lessons", columns: [{ name: "id", pk: true }, { name: "name", notnull: true }] }] },
    rowCounts: { lessons: 9 }, redirects: { "/team": "/our-crew" }, languages: { lang: "en", extra: ["kw"] },
  });
  const s = siteSlice(map, "page");
  assert.doesNotMatch(s, /Today's date/, "dates are on hold (owner, 2026-10-26)");
  assert.ok(s.indexOf("Band2Today") < s.indexOf("Band3Split"), "in page order");
  assert.match(s, /Band3Split — "What people say after a session"/);
  assert.match(s, /lessons \(9 rows\): id, name\*/);
  assert.match(s, /\/team → \/our-crew/);
  assert.match(s, /Languages: en, kw/);
  const d = siteSlice(map, "data");
  assert.ok(d.indexOf("Tables") < d.indexOf("Pages"), "a data step reads tables first");
  assert.equal(siteSlice(null, "page"), "");
});

test("the note rides the system turn once, after the step's own rules; the customer's turn is untouched", () => {
  const a = withMapNote({ system: "RULES", messages: [{ role: "user", content: "do it" }] }, "MAP");
  assert.match(a.system, new RegExp("^RULES\\n\\n" + MAP_MARK + "[^]*MAP$"));
  assert.equal(a.messages[0].content, "do it");
  assert.equal(withMapNote(a, "MAP"), a, "never twice");
  const b = withMapNote({ system: [{ type: "text", text: "R" }], messages: [] }, "MAP");
  assert.equal(b.system.length, 2);
  assert.match(withMapNote({ messages: [] }, "MAP").system, /MAP$/);
  const same = { system: "x", messages: [{ role: "user", content: "x" }] };
  assert.equal(withMapNote(same, ""), same, "an empty slice sends the call as it was");
});

test("the transports carry the note and fail open", async () => {
  let got = null;
  await mapSend(async (r) => { got = r; return 1; }, async () => "M")({ system: "S", messages: [] });
  assert.match(got.system, /M$/);
  await mapSend(async (r) => { got = r; return 1; }, async () => { throw new Error("no map"); })({ system: "S", messages: [] });
  assert.equal(got.system, "S");
  await mapCall(async (k, r, b) => { got = [k, r, b]; }, async () => "M")("K", { system: "S", messages: [] }, 7);
  assert.equal(got[0], "K"); assert.equal(got[2], 7); assert.match(got[1].system, /M$/);
});

// ── THE WIRING, READ FROM THE SOURCE ─────────────────────────────────────────
const SRC = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CALL = /\bquickSend(?:Live)?\(env\b|\bpagesCall\(env\)|\bcallBuilderModel\(env\b/;
// Call sites left without the map, by the function they sit in, each for a reason.
const EXEMPT = {
  quickSend: "the transport's own definition",
  quickSendLive: "the transport's own definition",
  pagesCall: "the transport's own definition",
  writePhoneApp: "the phone-app product, not a site",
  chatWindowFor: "compacts the chat transcript, not the site",
  designRequest: "a first build's design: no site yet; a revise hands the current spec itself",
  designSiteSchema: "a first build's design: no site yet; a revise hands the current spec itself",
  designSiteWaves: "a first build's design: no site yet",
  designSiteGraph: "a first build's design: no site yet",
  generateSitePages: "the default transport only; every caller with a site passes a mapped send",
  composeModelReply: "already handed the map (mapFor reply) in its context",
  diagnoseEnded: "already handed the whole map (mapFor diagnose)",
  actionTalk: "a progress line narrating the job's own facts every few seconds",
  writeProgressLine: "a progress line narrating the job's own facts",
  writeLateLine: "a progress line narrating the job's own facts",
  writeTaskLines: "a progress line narrating the job's own facts",
  translateStrings: "translates the strings it is handed; no site in scope",
  runSiteBuild: "a first build's seed rows, written before the site's address is chosen",
  'handleRequest:quickSend(env, "converse")': "the conversation: handed the verified owner's key facts by readConverseContext, never another owner's site",
  "handleRequest:jobSend(rJob, quickSend(env))": "the router: its own budgeted inventory and key facts (route-inventory.mjs)",
  "handleRequest:EDIT_BARE_STEPS.has(what)": "the keep check judges only the before and after it is handed",
};

function enclosing(lines, i) {
  for (let j = i; j >= 0; j--) {
    const m = /^(?:async )?function ([A-Za-z0-9_]+)\(|^const ([A-Za-z0-9_]+) = /.exec(lines[j]);
    if (m) return m[1] || m[2];
  }
  return "";
}

test("every model-call site in worker.js explores the site, carries the site map, or is named with a reason", () => {
  const lines = SRC.split("\n");
  const sites = [];
  lines.forEach((l, i) => { if (CALL.test(l)) sites.push({ n: i + 1, line: l, fn: enclosing(lines, i) }); });
  assert.ok(sites.length >= 30, "the observer found the call sites (" + sites.length + ")");
  const used = new Set();
  const bare = [];
  for (const s of sites) {
    if (/\b(?:mapped|explored)(?:Send|Call)\(/.test(s.line)) continue;
    const key = Object.keys(EXEMPT).find((k) => (k.includes(":") ? s.fn === k.split(":")[0] && s.line.includes(k.slice(k.indexOf(":") + 1)) : s.fn === k));
    if (key) { used.add(key); continue; }
    bare.push(s.n + " [" + s.fn + "] " + s.line.trim().slice(0, 120));
  }
  assert.deepEqual(bare, [], "model calls without the site map");
  assert.deepEqual(Object.keys(EXEMPT).filter((k) => !used.has(k)), [], "every exemption still names a real call site");
  const carried = sites.filter((s) => /\b(?:mapped|explored)(?:Send|Call)\(/.test(s.line)).length;
  assert.ok(carried >= 20, "explored or mapped sites counted (" + carried + ")");
});

test("the edit and add-on transports carry the map for every step and lane", () => {
  const eq = SRC.split("\n").find((l) => /const eQuick = /.test(l));
  const aq = SRC.split("\n").find((l) => /const aQuick = /.test(l));
  assert.ok(eq && aq, "both transports found");
  const eqAt = SRC.indexOf("const eQuick = ");
  const eqBody = SRC.slice(eqAt, SRC.indexOf("{\n", eqAt));
  assert.match(eqBody, /EDIT_EXPLORE_STEPS\.has\(what\) \? exploredSend\(env, ownerSlug, jobSend\(eJob,/);
  assert.match(aq, /mappedSend\(env, ownerSlug,/);
  // The edit's page writer explores; the add-on's still reaches the map (its phase is 3).
  assert.equal((SRC.match(/exploredCall\(env, ownerSlug, jobCall\(eJob, pagesCall\(env\)\)\)/g) || []).length, 1);
  assert.equal((SRC.match(/mappedCall\(env, ownerSlug, "[a-z]+", pagesCall\(env\)/g) || []).length, 1);
});

test("the map read for a call is built from everything the site holds", () => {
  const at = SRC.indexOf("async function refreshSiteMap(");
  const end = SRC.indexOf("\n}\n", at);
  assert.ok(at > 0 && end > at);
  const body = SRC.slice(at, end);
  for (const k of ["rowCounts:", "redirects", "languages:", "spec:", "parts:", "pages:", "css:"]) assert.ok(body.includes(k), k);
  const note = SRC.slice(SRC.indexOf("function siteMapNote("), SRC.indexOf("const mappedSend"));
  assert.match(note, /siteMapNow\(env, slug\)/);
  assert.match(note, /siteSlice\(m, k/);
});

// ── EXPLORING INSTEAD OF THE MAP (owner, 2026-10-26, "option b") ─────────────
test("phase 1: the page rung and the look door's lanes explore, by the name each call is sent under", () => {
  const set = /const EDIT_EXPLORE_STEPS = new Set\(\[([^\]]*)\]\)/.exec(SRC);
  assert.ok(set, "the explore set found");
  const names = [...set[1].matchAll(/"([a-z_-]+)"/g)].map((m) => m[1]);
  for (const n of ["pick_lanes", "lane", "lane-correction", "tweak"]) assert.ok(names.includes(n), n);
  // Every named edit call is either exploring, bare by reason, or not yet moved: found by pattern.
  const called = [...new Set([...SRC.matchAll(/\beQuick\("([a-z_-]+)"/g)].map((m) => m[1]))];
  assert.ok(called.length >= 4, "the observer found named calls");
  const bare = /const EDIT_BARE_STEPS = new Set\(\[([^\]]*)\]\)/.exec(SRC)[1];
  assert.deepEqual(called.filter((n) => !names.includes(n) && !bare.includes('"' + n + '"')), []);
  assert.match(SRC, /runTweak\(\{[^]{0,400}send: eQuick\("tweak"\)/);
  assert.match(SRC, /const ePick = [^\n]*exploredSend\(env, ownerSlug, jobSend\(eJob, quickSend\(env, "file-pick"\)\)\)/);
});
