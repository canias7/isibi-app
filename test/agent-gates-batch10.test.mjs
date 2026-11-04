// Carry-over batch 10 (2026-11-04, the owner: "fix 2 … fix 10"): a page that
// does not show is never saved (M-62), database parts known by code (M-31),
// the real cause of a failed AI call (M-73), what the business is before a
// first build (M-92), each run's answers kept (M-94), no look after server-only
// work (M-10), the small notes (M-86), held removals kept to bring back (M-27),
// and tools for the saved theme and the QR list (M-60).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent, brokenRoutes, sendCause, stoppedFacts, vagueBrief } from "../builder/site-agent.mjs";
import { agentSaidTruth } from "../builder/agent-gates.mjs";
import { touchesDatabase, splitParts } from "../builder/request.mjs";
import { agentSettingsPatch } from "../builder/agent-steps.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const HOME = "export default function Home() {\n  return <main><h1>Market Lane</h1></main>;\n}\n";
const MENU = "export default function Menu() {\n  return <main><h1>Menu</h1></main>;\n}\n";
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: MENU }];
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });

async function drive(calls, { request = "change it", deps = {}, opts = {} } = {}) {
  const answers = [];
  let round = 0;
  const ag = await runSiteAgent({
    send: async (req) => {
      const last = req.messages[req.messages.length - 1];
      if (round > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") answers.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
      const step = calls[round++] || [use("finish", { summary: "done" })];
      return { content: step, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    build: async () => ({ ok: true }), canAsk: () => true, saveSettings: () => true, siteUrl: async () => "https://market.gofarther.app",
    ...deps,
  }, { request, pages: PAGES, parts: [], css: "", model: "m", maxRounds: 12, ...opts });
  return { ag, answers };
}

test("M-62 a page this change wrote that does not show is held twice, then the run ends and nothing is saved", async () => {
  const blank = async () => ({ ok: true, render: { findings: [{ kind: "blank", route: "/menu", viewport: "phone" }] } });
  const r = await drive([[use("read_files", { files: ["menu.tsx"] })], [use("write_file", { file: "menu.tsx", source: MENU.replace("Menu</h1>", "Our menu</h1>") })], [use("build", {})], [use("finish", { summary: "x" })], [use("finish", { summary: "x" })], [use("finish", { summary: "x" })]], { deps: { build: blank } });
  assert.equal(r.answers.filter((a) => /THESE PAGES DO NOT SHOW/.test(a)).length, 2);
  assert.equal(r.ag.ok, false);
  assert.equal(r.ag.stopped, "page-broken");
  assert.match(stoppedFacts(r.ag), /a page it changed still did not show in the browser check \(\/menu\), so nothing was saved/);
  assert.deepEqual(brokenRoutes({ render: { findings: [{ kind: "image", route: "/" }] } }), [], "a missing image is not a page that does not show (control)");
});

test("M-31 code reads a database part from its words, not only the agent's flag", () => {
  assert.equal(touchesDatabase("add a bookings form on /classes"), true);
  assert.equal(touchesDatabase("make the heading on /about bigger"), false);
  const rec = { parts: [{ n: 0, at: 0, source: "route", words: "m", needs: [] }] };
  const made = splitParts(rec, 0, [{ instruction: "add a sign-up form on /join", pages: ["/join"] }, { instruction: "bigger heading on /about", pages: ["/about"] }]);
  assert.ok(!rec.parts[made[0]].targets, "runs alone");
  assert.deepEqual(rec.parts[made[1]].targets.writes, ["page:/about"]);
});

test("M-73 a failed AI call names its real cause", () => {
  assert.equal(sendCause(Object.assign(new Error("x"), { status: 402 })), "billing");
  assert.equal(sendCause(Object.assign(new Error("rate limit"), { status: 429 })), "busy");
  assert.equal(sendCause(Object.assign(new Error("x"), { name: "TimeoutError" })), "our-timeout");
  assert.equal(sendCause(Object.assign(new Error("x"), { status: 503 })), "provider-error");
  assert.equal(sendCause(new Error("fetch failed")), "unreachable");
  assert.match(stoppedFacts({ stopped: "send", sendWhy: "billing" }), /billing\), which is ours to fix, not yours/);
  assert.match(stoppedFacts({ stopped: "send", sendWhy: "our-timeout" }), /our builder's own time limit/);
});

test("M-92 a first build with no word of what the business is asks first, once", async () => {
  assert.equal(vagueBrief("make me a website"), true);
  assert.equal(vagueBrief("a site for my yoga studio in Bath"), false);
  const r = await drive([[use("start_build", { brief: "a website" })], [use("ask_owner", { question: "What's the business?", options: ["A shop", "A café"] })]], { request: "make me a website", deps: { startBuild: () => true }, opts: { pages: [], newProject: true } });
  assert.match(r.answers[0], /NOT STARTED: the owner has not said what the business or site is/);
  assert.equal(r.ag.startBuild, "");
  const ok = await drive([[use("start_build", { brief: "a bakery site" })]], { request: "build a site for my bakery in Leeds", deps: { startBuild: () => true }, opts: { pages: [], newProject: true } });
  assert.equal(ok.ag.startBuild, "a bakery site");
});

test("M-94 each run's own answers are kept, never the tools' results", async () => {
  const r = await drive([[use("read_files", { files: ["index.tsx"] })]]);
  assert.ok(r.ag.transcript.length >= 2);
  const first = JSON.parse(r.ag.transcript[0]);
  assert.deepEqual(first.content, [{ tool: "read_files", input: { files: ["index.tsx"] } }]);
  assert.doesNotMatch(r.ag.transcript.join(""), /Market Lane/, "a tool's answer (the file) is not kept");
  assert.match(W, /const runOnce = async \(ask, from\) => \{ const r = await runOnce0\(ask, from\); try \{ await keepAgentRun\(/);
  assert.match(W, /const AGENT_RUNS_MAX = 30;/);
});

test("M-10 no browser look after a change that only wrote server code", async () => {
  const fn = 'export const hosts = [];\nexport default async function (request: Request, site: SiteHelper) { return Response.json({}); }\n';
  const r = await drive([[use("write_file", { file: "-parts/server-ping", source: fn })], [use("look", { page: "/" })]], { request: "add a ping function\nThey answered: Yes, go ahead", deps: { look: async () => ({ ok: true }) } });
  assert.match(r.answers[1], /only wrote server code: nothing on the page changed/);
});

test("M-86 the small notes: starter entries added, styles checked, only when not already said", () => {
  assert.match(agentSaidTruth("Added the classes list.", { seeded: [{ table: "timetable", n: 3 }] }), /Added 3 starter entries to the new timetable list\./);
  assert.match(agentSaidTruth("Done.", { stylesChecked: true }), /Your new styles were checked on the pages\./);
  assert.equal(agentSaidTruth("New styles, checked.", { stylesChecked: true }), "New styles, checked.");
});

test("M-27 a removal held for Publish is kept to bring back, and never 'put back' by a failed save", () => {
  const fn = W.slice(W.indexOf("const holdRowsNow = async () => {"), W.indexOf("const writeRowsNow = async () => {"));
  assert.match(fn, /rowQuery\("SELECT \* FROM " \+ sqlIdent\(op\.table\) \+ " WHERE " \+ sqlIdent\(op\.pk \|\| "id"\) \+ " = \? LIMIT 1", \[id\]\)/);
  assert.match(fn, /await keepRemovedRows\(env, slug, gone\)/);
  assert.match(fn, /rowsOut\.heldRemoved = gone\.length;/);
  assert.doesNotMatch(fn, /rowsOut\.done = gone/, "never in the list a failed save puts back");
});

test("M-60 the saved theme and the stored QR codes can be changed", async () => {
  const qrCodes = async () => [{ name: "menu", points: "https://market.gofarther.app/old", label: "Our menu" }, { name: "wifi", points: "https://x.example/wifi", label: "Wi-Fi" }];
  const r = await drive([[use("set_theme", { theme: "nope" })], [use("set_theme", { theme: "glass" })], [use("site_qr_codes", { action: "list" })], [use("site_qr_codes", { action: "change", name: "menu", page: "/menu" })], [use("site_qr_codes", { action: "remove", name: "wifi" })]], { deps: { themes: () => ["glass", "editorial"], qrCodes } });
  assert.match(r.answers[0], /the themes are: glass, editorial/);
  assert.match(r.answers[1], /^Queued: the glass theme/);
  assert.match(r.answers[2], /- menu: Our menu → https:\/\/market\.gofarther\.app\/old/);
  assert.match(r.answers[3], /now opens https:\/\/market\.gofarther\.app\/menu/);
  assert.deepEqual(r.ag.settings.qr, [{ name: "menu", points: "https://market.gofarther.app/menu", label: "Our menu" }]);
  const patch = agentSettingsPatch({ look: { theme: "editorial" } }, r.ag.settings);
  assert.equal(patch.look.theme, "glass");
  assert.equal(patch.qr.length, 1);
});
