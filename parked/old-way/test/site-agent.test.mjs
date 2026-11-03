// PARKED (2026-11-03, park-old-way): the old-way half of test/site-agent.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The site agent (2026-10-28): the loop, its tools, the head start (rule 1),
// clearing the desk (rule 3) and the same opening every round (rule 4).
import test from "node:test";
import assert from "node:assert/strict";
import {
  runSiteAgent, compact, headStart, firstMessage, makeWorkspace, writableKey,
  AGENT_TOOLS, agentSystem, COMPACT_AT, COMPACT_MIN_SAVE, toolCounts, toolsFor, checkNotes, buildFailKind, commandKinds, projectOverview, dropSeenShots, pileSize, mustFixKinds,
} from "../../../builder/site-agent.mjs";

const PAGES = [
  { path: "index.tsx", source: "export default function Home(){return <h1>Home</h1>}" },
  { path: "visit.tsx", source: "export default function Visit(){return <p>Open 9-5</p>}" },
];
const PARTS = [{ name: "site-footer", source: "export default function F(){return <footer>Hi</footer>}" }];
const use = (name, input, id) => ({ type: "tool_use", name, input, ...(id ? { id } : {}) });
const answer = (...uses) => ({ content: uses, usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 5000 }, stop_reason: "tool_use" });

function scripted(rounds) {
  const sent = [];
  let i = 0;
  return { sent, send: async (req) => { sent.push(JSON.parse(JSON.stringify(req))); return rounds[Math.min(i++, rounds.length - 1)]; } };
}
const okBuild = async () => ({ ok: true });

// ── THE SWITCH AND THE WIRING (2026-10-28) ──────────────────────────────────
import { readFileSync } from "node:fs";
import { stoppedFacts, AGENT_TAKES_ALL, AGENT_CREDIT_CAP, historyText, sumUsage, asWriterAnswer, agentTakes, roundFacts, fileName, CSS_KEY, TOOL_NEEDS } from "../../../builder/site-agent.mjs";
import { jobSecrets } from "../../../builder/edit-job.mjs";

test("SA12 no switch and no spending limit", () => {
  assert.equal(AGENT_TAKES_ALL, true);
  const was = process.env.GF_OLD_LANES;
  try {
    delete process.env.GF_OLD_LANES; assert.equal(agentTakes(), true);
    process.env.GF_OLD_LANES = "1"; assert.equal(agentTakes(), false);
  } finally { if (was === undefined) delete process.env.GF_OLD_LANES; else process.env.GF_OLD_LANES = was; }
  assert.equal(AGENT_CREDIT_CAP, Infinity, "no spending limit");
  assert.match(stoppedFacts({ stopped: "credits", lastBuild: "fail" }), /spending limit.*Nothing on the site was changed; its last build had errors\./);
});

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const between = (a, b) => { const i = W.indexOf(a); assert.ok(i >= 0, "landmark: " + a); const j = W.indexOf(b, i); assert.ok(j > i, "landmark: " + b); return W.slice(i, j); };

test("SA13 both routes hand this turn's part to the agent when it is on, before any lane (2026-10-30: the part's own words, held-back parts taken out)", () => {
  const edit = between("// ── THE SITE AGENT (2026-10-28", "// ── THE SEVENTEEN LANES ARE THE FRONT DOOR");
  assert.match(edit, /if \(agentTakes\(\) && !\(eJob && eJob\.prepare === true\)\) \{\n\s+const agParts/);
  assert.match(edit, /runAgentChange\(env, \{[^]*words: eRun,/);
  const add = between("// ── THE SITE AGENT TAKES AN ADDITION TOO", "// ── AN ENTRY THIS REQUEST HAS ALREADY SAVED");
  assert.match(add, /if \(agentTakes\(\) && !\(aJob && aJob\.prepare === true\)\) \{/);
  assert.match(add, /runAgentChange\(env, \{[^]*words: aInstruction,/);
  // and the router splits a site's message into parts again (parallel agents, 2026-10-30)
  assert.doesNotMatch(W, /const rKey = agentTakes\(\)/);
  assert.match(W, /const rKey = !rJob && requestFlowOn\(env\)/);
});

test("SA25 the router is skipped for a site's message the request flow cannot take; the look tool is wired to compile-only screenshots", () => {
  const route = between('if (url.pathname === "/api/site/route" && request.method === "POST") {', "if (rKey) {");
  assert.match(route, /if \(agentTakes\(\) && !rJob && ru && !rKey\) \{/);
  // A NEW PROJECT IS THE AGENT'S (2026-11-02, agent-only); a build question's answer goes on to the build.
  assert.match(route, /if \(rb\.firstBuild === true && answerClaim\(rb\) !== undefined\) return Response\.json\(\{ ok: true, intent: "build", cost: 0, agent: true \}\);\n\s+return Response\.json\(await newProjectTurn\(env,/);
  const fn = between("async function runAgentChange(", "async function recompileAndPublish(env, {");
  assert.match(fn, /look: \(w, route\) => recompileAndPublish\(env, \{[^}]*compileOnly: true[^}]*shotRoutes: \[route\]/);
  assert.match(W, /shots: \(compileOnly && Array\.isArray\(shotRoutes\) && shotRoutes\.length \? shotRoutes : vrShots\) \|\| undefined,/);
  assert.match(W, /shots: built && Array\.isArray\(built\.shots\) \? built\.shots : \[\],/);
});

test("SA27 the build hands the page writer's place to the agent, building with the build's own compile", () => {
  const gen = between("    agentWrite: agentTakes()", "    generate: async () => {");
  assert.match(gen, /agentWrite: agentTakes\(\) && !resumeCall && !\(spec && spec\.surface === "app"\) \? async \(\{ compile \}\) => \{/);
  assert.match(gen, /build: async \(w\) => agentBuildAnswer\(await compile\(w\.pages, w\.parts\)\),/);
  assert.match(gen, /look: async \(w, route\) => agentBuildAnswer\(await compile\(w\.pages, w\.parts, \{ shots: \[route\] \}\)\),/);
  assert.match(gen, /request: briefWithLayout\(\{ brief, plan, tsx, gif, qr, three, images: imgBrief, media, devices: deviceWishes \}\)/);
  assert.match(gen, /return asWriterAnswer\(ag, agModel\);/);
  const P = readFileSync(new URL("../../../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.match(P, /let gen = typeof deps\.agentWrite === "function" \? await deps\.agentWrite\(\{ compile: deps\.compile \}\) : await deps\.generate\(\);/);
});

test("SA29 the container is wired: a work folder per agent run, in the site's lane; both agents get it", () => {
  const fn = between("function agentShell(env, slug) {", "async function runAgentChange(");
  assert.match(fn, /getContainer\(env\.SITE_BUILD_CONTAINER, laneName\(slug\)\)/);
  assert.match(fn, /new Request\("http:\/\/build\/agent-run"/);
  // 2026-10-31 (the owner's fix 7): the shell is also sent the site's stored files to lay over its copy.
  assert.match(fn, /body: JSON\.stringify\(\{ session, command, files, \.\.\.\(mirror\.overlay\.length \? \{ projectFiles: mirror\.overlay \} : \{\}\) \}\)/);
  assert.match(between("async function runAgentChange(", "async function recompileAndPublish(env, {"), /run: agentShell\(env, slug\),/);
  assert.match(between("    agentWrite: agentTakes()", "    generate: async () => {"), /run: agentShell\(env, slug\),/);
  const B = readFileSync(new URL("../../../builder/build-server.mjs", import.meta.url), "utf8");
  const route = B.slice(B.indexOf('req.url === "/agent-run"'), B.indexOf('req.url === "/model"'));
  assert.ok(route.length > 200, "the container's route is there");
  assert.match(route, /const as = renderAs\(\);/);
  assert.match(route, /runCommand\(dir, p\.command, \{ as \}\)/);
  assert.match(route, /readSiteFiles\(dir/);
});
