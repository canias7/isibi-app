// PARKED (2026-11-03, park-old-way): the old-way half of test/site-map-everywhere.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { buildSiteMap, blocksOf, siteSlice, withMapNote, mapSend, mapCall, MAP_MARK } from "../../../builder/site-map.mjs";

const page = 'import Band1Hero from "@/routes/-parts/band-1-hero";\nimport Band2Today from "@/routes/-parts/band-2-today";\nimport Band3Split from "@/routes/-parts/band-3-split";\nfunction P() { return (<main><Band1Hero /><Band2Today /><Band3Split /></main>); }';
const parts = [
  { name: "band-1-hero", source: "export default function Band1Hero() { return <section><h1>Driftwood &amp; Daughters</h1><p>Surf, coffee and boards</p></section>; }" },
  { name: "band-2-today", source: "export default function Band2Today() { return <section><h2>Today's surf</h2><p>What that means for lessons</p></section>; }" },
  { name: "band-3-split", source: "export default function Band3Split() { return <section><h2>What people say after a session</h2></section>; }" },
];

// ── THE WIRING, READ FROM THE SOURCE ─────────────────────────────────────────
const SRC = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const CALL = /\bquickSend(?:Live)?\(env\b|\bpagesCall\(env\)|\bcallBuilderModel\(env\b/;
// Call sites left without the map, by the function they sit in, each for a reason.
const EXEMPT = {
  quickSend: "the transport's own definition",
  quickSendLive: "the transport's own definition",
  pagesCall: "the transport's own definition",
  writePhoneApp: "the phone-app product, not a site",
  newProjectTurn: "a new project has no site yet, so no site map (2026-11-02, agent-only)",
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
  'buildAndPublishPages:quickSend(env, "agent", budget)': "the site agent writing a new site: there is no site map yet, and the brief and plan are its first message",
  writeOneReplyNow: "the message's one reply: written only from the facts gathered over the message (oneReplyFacts), and checked against them; a map would hand it names the check must refuse",
  runAgentChange: "the site agent: the map is in its own first message (site-agent.mjs firstMessage), kept identical every round for the cache",
  'handleRequest:quickSend(env, "converse")': "the conversation: handed the verified owner's key facts by readConverseContext, never another owner's site",
  "handleRequest:jobSend(rJob, quickSend(env))": "the router: its own budgeted inventory and key facts (route-inventory.mjs)",
};

function enclosing(lines, i) {
  for (let j = i; j >= 0; j--) {
    const m = /^(?:async )?function ([A-Za-z0-9_]+)\(|^const ([A-Za-z0-9_]+) = /.exec(lines[j]);
    if (m) return m[1] || m[2];
  }
  return "";
}

test("every model-call site in worker.js carries the site map or is named with a reason", () => {
  const lines = SRC.split("\n");
  const sites = [];
  lines.forEach((l, i) => { if (CALL.test(l)) sites.push({ n: i + 1, line: l, fn: enclosing(lines, i) }); });
  assert.ok(sites.length >= 30, "the observer found the call sites (" + sites.length + ")");
  const used = new Set();
  const bare = [];
  for (const s of sites) {
    if (/\bmapped(?:Send|Call)\(/.test(s.line)) continue;
    const key = Object.keys(EXEMPT).find((k) => (k.includes(":") ? s.fn === k.split(":")[0] && s.line.includes(k.slice(k.indexOf(":") + 1)) : s.fn === k));
    if (key) { used.add(key); continue; }
    bare.push(s.n + " [" + s.fn + "] " + s.line.trim().slice(0, 120));
  }
  assert.deepEqual(bare, [], "model calls without the site map");
  assert.deepEqual(Object.keys(EXEMPT).filter((k) => !used.has(k)), [], "every exemption still names a real call site");
  const mapped = sites.filter((s) => /\bmapped(?:Send|Call)\(/.test(s.line)).length;
  assert.ok(mapped >= 20, "mapped sites counted (" + mapped + ")");
});

test("the edit and add-on transports carry the map for every step and lane", () => {
  const eq = SRC.split("\n").find((l) => /const eQuick = /.test(l));
  const aq = SRC.split("\n").find((l) => /const aQuick = /.test(l));
  assert.ok(eq && aq, "both transports found");
  assert.match(eq, /mappedSend\(env, ownerSlug,/);
  assert.match(aq, /mappedSend\(env, ownerSlug,/);
  // The page writers of the edit and the add-on reach the model through pagesCall.
  assert.equal((SRC.match(/mappedCall\(env, ownerSlug, "[a-z]+", pagesCall\(env\)/g) || []).length, 2);
});
