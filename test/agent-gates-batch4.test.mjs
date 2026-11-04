// Carry-over batch 4 (2026-11-04): the last high gaps — one page named, one
// page changed; "phones only" read from the words; one-time reminders; words
// asked for are on the site; no facts of the agent's own; the held schema tried
// on a copy; helpers never guess.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent } from "../builder/site-agent.mjs";
import { namedScope, repeatingDates, missingWords, newFacts, agentSaidTruth } from "../builder/agent-gates.mjs";
import { devicesInWords } from "../builder/device-scope.mjs";
import { scopeGuard } from "../builder/agent-guard.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const HOME = "export default function Home() { return <main><h1>Market Lane</h1><p>Call 020 7946 0000</p></main>; }\n";
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: "export default function A() { return <main><h1>About</h1></main>; }\n" }, { path: "menu.tsx", source: "export default function M() { return <main><h1>Menu</h1></main>; }\n" }];
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });

async function drive(calls, { request = "change it", deps = {} } = {}) {
  const answers = [];
  let round = 0;
  const ag = await runSiteAgent({
    send: async (req) => {
      const last = req.messages[req.messages.length - 1];
      if (round > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") answers.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
      const step = calls[round++] || [use("finish", { summary: "done" })];
      return { content: step, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    build: async () => ({ ok: true }),
    ...deps,
  }, { request, pages: PAGES, parts: [], model: "m", maxRounds: 12 });
  return { ag, answers };
}

// ── M-43 ─────────────────────────────────────────────────────────────────────
test("a message naming one page is scoped to it; site-wide words or two pages leave it open", () => {
  assert.deepEqual(namedScope("Make the heading on the about page bigger", PAGES), ["/about"]);
  assert.deepEqual(namedScope("on /menu, add a line about vegan bread", PAGES), ["/menu"]);
  assert.deepEqual(namedScope("change the home page intro", PAGES), ["/"]);
  assert.equal(namedScope("Make the about page and the menu page match", PAGES), null);
  assert.equal(namedScope("change the colours on the about page", PAGES), null, "a look change is site-wide");
  assert.equal(namedScope("add a gallery page", PAGES), null, "a page the site lacks names no scope");
  assert.equal(namedScope("call the menu page food", PAGES), null, "a move reaches another address");
  const guard = scopeGuard({ pages: PAGES, parts: [], routes: namedScope("the about page heading", PAGES) });
  assert.equal(guard("about.tsx"), "");
  assert.match(guard("menu.tsx"), /only about \/about/);
  assert.match(W, /const mayWrite = scopeGuard\(\{ pages, parts, routes: scope \|\| agentNamedScope\(request, pages\), look \}\);/);
});

// ── M-44 ─────────────────────────────────────────────────────────────────────
test("'phones only' is read from the words and reaches the layout check; a device only mentioned is not a limit", () => {
  assert.deepEqual(devicesInWords("make the menu bigger on phones only"), ["phone"]);
  assert.deepEqual(devicesInWords("desktop only: make it wider"), ["desktop"]);
  assert.equal(devicesInWords("it looks bad on my phone"), null);
  assert.equal(devicesInWords("make the heading bigger"), null);
  assert.match(W, /const devScope = readDevices\(devices\) \|\| readDevices\(devicesInWords\(words\)\);/);
  assert.match(W, /\.\.\.\(devScope \? \{ devices: devScope \} : \{\}\),/, "the save's layout check is handed the scope");
});

// ── M-46 ─────────────────────────────────────────────────────────────────────
test("a reminder for one date must be guarded to fire once; a repeat asked for, or a guarded one, is written", async () => {
  const src = (extra = "") => 'export const hosts = [];\nexport const on = ["cron:0 9 3 3 *"];\nexport default async function (request: Request, site: SiteHelper) { ' + extra + 'return Response.json({}); }\n';
  const r = await drive([[use("write_file", { file: "-parts/server-remind", source: src() })]], { request: "remind me on the 3rd of March to restock\nThey answered: Yes, go ahead" });
  assert.match(r.answers[0], /NOT WRITTEN: cron:0 9 3 3 \* comes round again/);
  const guarded = await drive([[use("write_file", { file: "-parts/server-remind", source: src("if (new Date().getUTCFullYear() !== 2027) return Response.json({}); ") })]], { request: "remind me on the 3rd of March\nThey answered: Yes, go ahead" });
  assert.match(guarded.answers[0], /^Saved/);
  assert.deepEqual(repeatingDates(src(), "remind me every month on the 3rd"), [], "a repeat asked for (control)");
  assert.deepEqual(repeatingDates('on = ["cron:0 9 * * 1"]', "remind me on monday"), [], "a weekday schedule is not a date");
});

// ── M-67 ─────────────────────────────────────────────────────────────────────
test("words the owner asked for, missing after the change, hold the finish once; then the reply names them", async () => {
  const r = await drive([[use("write_file", { file: "about.tsx", source: PAGES[1].source.replace("About", "About us") })], [use("build", {})], [use("finish", { summary: "Done." })], [use("finish", { summary: "Done." })]], { request: 'Make the about heading say "Baked since 1982"' });
  assert.equal(r.answers.filter((a) => /ASKED FOR THESE WORDS/.test(a)).length, 1);
  assert.deepEqual(r.ag.missingWords, ["Baked since 1982"]);
  assert.match(agentSaidTruth("Done.", { missing: r.ag.missingWords }), /Not on the site yet: “Baked since 1982”/);
  assert.deepEqual(missingWords('change "Old words" to "New words"', new Map([["a", "<h1>New words</h1>"]])), [], "the old words quoted are not asked for (control)");
});

// ── M-69 ─────────────────────────────────────────────────────────────────────
test("a phone number, email or price nobody gave holds the finish once; ones the owner or the site gave pass", async () => {
  const add = PAGES[1].source.replace("<h1>About</h1>", "<h1>About</h1><p>Call 0161 496 0123 or write to hello@marketlane.co.uk. Loaves from £4.50.</p>");
  const r = await drive([[use("write_file", { file: "about.tsx", source: add })], [use("build", {})], [use("finish", { summary: "Added contact details." })], [use("finish", { summary: "Added contact details." })]], { request: "add our contact details to the about page" });
  assert.equal(r.answers.filter((a) => /NOT IN THE OWNER'S WORDS/.test(a)).length, 1);
  assert.deepEqual(r.ag.newFacts.sort(), ["0161 496 0123", "hello@marketlane.co.uk", "£4.50"].sort());
  assert.match(agentSaidTruth("Added.", { facts: r.ag.newFacts }), /Please check these details, which you didn't give me/);
  assert.deepEqual(newFacts(HOME, "<p>Call 020 7946 0000</p>", ""), [], "the site's own number (control)");
  assert.deepEqual(newFacts("", "<p>hello@marketlane.co.uk £4.50</p>", "our email is hello@marketlane.co.uk and loaves are £4.50"), [], "the owner's words (control)");
});

// ── M-21 ─────────────────────────────────────────────────────────────────────
test("the agent's held schema is tried on a copy first, as the add-on's is", () => {
  const fn = W.slice(W.indexOf("async function applyAgentSchema("), W.indexOf("async function applyAgentSchema(") + 3000);
  assert.match(fn, /const writer = await backendWriter\(env, slug, \{ rehearse: \{ mark: \(\) => \{\} \} \}\);/);
});

// ── M-90 ─────────────────────────────────────────────────────────────────────
test("a helper, who cannot ask, is told to mark a gap rather than guess", () => {
  const src = readFileSync(new URL("../builder/site-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /You cannot ask the owner: where your brief leaves a choice only they can make, or a fact they did not give, never guess/);
});
