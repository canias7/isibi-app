// EVERY MODEL CALL THAT REASONS ABOUT AN EXISTING SITE EXPLORES IT (owner,
// 2026-10-26, "option b"): the file list up front, then read-only tools,
// instead of the pre-built site map. Replaces `site-map-everywhere`.
//
// The call sites are found in worker.js by pattern (`quickSend(env`,
// `quickSendLive(env`, `pagesCall(env)`, `callBuilderModel(env`), never by a
// hand list. Each one explores (`exploredSend(` / `exploredCall(` on its line),
// or is named as an exception with its reason. The site map is deleted (phase 5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CALL = /\bquickSend(?:Live)?\(env\b|\bpagesCall\(env\)|\bcallBuilderModel\(env\b/;

// NOT A SITE TO EXPLORE, each for a reason.
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
  generateSitePages: "the default transport only; every caller with a site passes its own send",
  actionTalk: "a progress line narrating the job's own facts every few seconds",
  writeProgressLine: "a progress line narrating the job's own facts",
  writeLateLine: "a progress line narrating the job's own facts",
  writeTaskLines: "a progress line narrating the job's own facts",
  translateStrings: "translates the strings it is handed; no site in scope",
  runSiteBuild: "a first build's seed rows, written before the site's address is chosen",
  'handleRequest:EDIT_BARE_STEPS.has(what)': "the keep check and the take-off judge only what they are handed",
  // THE REPLY WRITERS (owner, 2026-09-24: what a reply states comes from what the operations really did):
  composeModelReply: "a reply is written from the operations' results, never from the site",
  narrateBuild: "a reply is written from the build's results, never from the site",
  repeatNote: "a reply is written from the step's results, never from the site",
  wideningQuestion: "a reply is written from the step's results, never from the site",
  'handleRequest:quickSend(env, "reply", replyBudget)': "the security scan's reply is written from the scan's findings",
  diagnoseEnded: "the diagnosis investigates with its own read-only tools (diagnose.mjs: list_site, read_page, read_job, …)",
  'handleRequest:quickSend(env, "converse")': "the conversation is handed the verified owner's site read directly (readConverseContext: pages, tables, files)",
};

function enclosing(lines, i) {
  for (let j = i; j >= 0; j--) {
    const m = /^(?:async )?function ([A-Za-z0-9_]+)\(|^const ([A-Za-z0-9_]+) = /.exec(lines[j]);
    if (m) return m[1] || m[2];
  }
  return "";
}
const keyOf = (table, s) => Object.keys(table).find((k) => (k.includes(":") ? s.fn === k.split(":")[0] && s.line.includes(k.slice(k.indexOf(":") + 1)) : s.fn === k));

test("every model call that reasons about a site explores it, or is named with a reason", () => {
  const lines = SRC.split("\n");
  const sites = [];
  lines.forEach((l, i) => { if (CALL.test(l)) sites.push({ n: i + 1, line: l, fn: enclosing(lines, i) }); });
  assert.ok(sites.length >= 30, "the observer found the call sites (" + sites.length + ")");
  const used = new Set();
  const bare = [];
  let explored = 0, mapped = 0;
  for (const s of sites) {
    if (/\bexplored(?:Send|Call)\(/.test(s.line)) { explored++; continue; }
    const k = keyOf(EXEMPT, s);
    if (k) { used.add(k); if (/\bmapped(?:Send|Call)\(/.test(s.line)) mapped++; continue; }
    if (/\bmapped(?:Send|Call)\(/.test(s.line)) { mapped++; bare.push(s.n + " [" + s.fn + "] still on the map: " + s.line.trim().slice(0, 110)); continue; }
    bare.push(s.n + " [" + s.fn + "] " + s.line.trim().slice(0, 120));
  }
  assert.deepEqual(bare, [], "model calls that neither explore nor are named");
  assert.deepEqual(Object.keys(EXEMPT).filter((k) => !used.has(k)), [], "every name still names a real call site");
  assert.ok(explored >= 8, "explored sites counted (" + explored + ")");
});

test("the edit and add-on transports explore for every step, and every edit call is named", () => {
  const at = SRC.indexOf("const eQuick = ");
  const eq = SRC.slice(at, SRC.indexOf("{\n", at));
  assert.match(eq, /EDIT_BARE_STEPS\.has\(what\) \? jobSend\(eJob, quickSend\(env, what, eJob && eJob\.budget\)\)\s*: exploredSend\(env, ownerSlug, jobSend\(eJob,/);
  const aq = SRC.split("\n").find((l) => /const aQuick = /.test(l));
  assert.match(aq, /exploredSend\(env, ownerSlug, aCounted\(jobSend\(aJob, quickSend\(/);
  assert.doesNotMatch(eq + aq, /mappedSend/);
  assert.equal((SRC.match(/\beQuick\(\)/g) || []).length, 0, "an edit call sent under no name");
  const names = [...new Set([...SRC.matchAll(/\beQuick\("([a-z_-]+)"/g)].map((m) => m[1]))];
  for (const n of ["pick_lanes", "lane", "tweak", "data", "rules", "text", "nav", "frame", "picture", "rename"]) assert.ok(names.includes(n), n);
  const bareSet = /const EDIT_BARE_STEPS = new Set\(\[([^\]]*)\]\)/.exec(SRC)[1];
  assert.deepEqual([...bareSet.matchAll(/"([a-z_-]+)"/g)].map((m) => m[1]).sort(), ["keep_check", "take_off"]);
  // Both page writers and the page rung's file picker explore; no page writer carries the map.
  assert.equal((SRC.match(/exploredCall\(env, ownerSlug, jobCall\((?:eJob|aJob), pagesCall\(env\)\)\)/g) || []).length, 2);
  assert.ok(!SRC.includes("mappedCall("), "no call carries the map through a page writer");
  assert.match(SRC, /const ePick = [^\n]*exploredSend\(env, ownerSlug, jobSend\(eJob, quickSend\(env, "file-pick"\)\)\)/);
});

test("the map slices the steps used to carry are gone from the steps that explore", () => {
  for (const k of ['mapFor("frame"', 'mapFor("addon"', 'mapFor("rowNote"']) assert.ok(!SRC.includes(k), k);
});

test("the router explores, fast: at most two looks, its table names read for the owner, never on a part", async () => {
  const { ROUTER_MAX_LOOKS } = await import("../builder/site-explore.mjs");
  assert.equal(ROUTER_MAX_LOOKS, 2);
  assert.match(SRC, /\{ send: exploredSend\(env, rDigest\.owned === true && !rPart \? rDigest\.slug : "", jobSend\(rJob, quickSend\(env\)\), \{ cap: ROUTER_MAX_LOOKS, names: Array\.isArray\(rDigest\.filled\) \? rDigest\.filled : \[\] \}\), classify:/);
  // exploreLooks never lets the env setting lift the router's cap.
  const at = SRC.indexOf("function exploreLooks(");
  assert.match(SRC.slice(at, SRC.indexOf("\n}\n", at)), /Number\.isInteger\(cap\) \? Math\.min\(v, cap\) : v/);
  // routeDigest says whose site it verified; nothing else hands the router an inventory.
  assert.match(SRC, /return \{ site: out, filled, pagesFilled, pagesComplete: pagesFilled, owned: \(await owned\) === true, slug \};/);
  assert.ok(!SRC.includes("routeInventory("), "the router is handed an inventory");
});

test("PHASE 5: the site map is gone — no module, no store, no reader, no note", async () => {
  const { existsSync } = await import("node:fs");
  for (const f of ["../builder/site-map.mjs", "../builder/route-inventory.mjs"]) assert.ok(!existsSync(new URL(f, import.meta.url)), f + " is back");
  for (const k of ["sitemap.json", "sitemaps/", "refreshSiteMap", "currentSiteMap", "restoreSiteMap", "loadSiteMap", "siteMapNote", "mappedSend", "mappedCall", "mapFor(", "buildSiteMap", "site-map.mjs"]) assert.ok(!SRC.includes(k), "worker.js still has " + k);
  const docker = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.ok(docker.includes("builder/site-explore.mjs") && !docker.includes("builder/site-map.mjs") && !docker.includes("builder/route-inventory.mjs"));
});
