// Carry-over batch 1 (2026-11-04): six protections the old router and lanes
// enforced, rebuilt as checks around the site agent. Driven through the real
// agent loop with a scripted model; the gates' own readers are tested too.
import test from "node:test";
import assert from "node:assert/strict";
import { runSiteAgent } from "../builder/site-agent.mjs";
import { PRICE_YES, REMOVE_YES, bigKind, providersIn, unchosenProviders, deadLinks, priceAskProblem } from "../builder/agent-gates.mjs";
import { changeReport, unaskedLines } from "../builder/agent-guard.mjs";
import { agentSaidTruth } from "../builder/agent-gates.mjs";

const HOME = 'import { Link } from "@tanstack/react-router";\nexport default function Home() { return <main><h1>Market Lane</h1><Link to="/about">About us</Link><p>Fresh bread daily.</p></main>; }\n';
const ABOUT = "export default function About() { return <main><h1>About</h1></main>; }\n";
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }, { path: "menu.tsx", source: ABOUT.replace("About", "Menu") }, { path: "visit.tsx", source: ABOUT.replace("About", "Visit") }];
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });

async function drive(calls, { request = "change it", history = "", review = null, unasked = null, pages = PAGES } = {}) {
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
    ...(review ? { review } : {}), ...(unasked ? { unasked } : {}),
  }, { request, history, pages, parts: [], model: "m", maxRounds: 10 });
  return { ag, answers };
}

// ── M-7: THE PRICE FIRST ─────────────────────────────────────────────────────
test("a new page on an edit is not written until the owner says yes to the price", async () => {
  const r = await drive([[use("write_file", { file: "gallery.tsx", source: ABOUT.replace("About", "Gallery") })]]);
  assert.ok(r.answers.length, "the observer is alive");
  assert.match(r.answers[0], /NOT WRITTEN.*new page.*credits/s);
  assert.ok(!r.ag.changed.includes("gallery.tsx"), "the page was written with no yes");
});

test("rewriting four existing files is refused at the fourth until the price is agreed", async () => {
  const w = (f) => use("write_file", { file: f, source: ABOUT.replace("About", "New " + f) });
  const r = await drive([[w("index.tsx"), w("about.tsx"), w("menu.tsx"), w("visit.tsx")]]);
  assert.equal(r.answers.slice(0, 3).filter((a) => /^Saved/.test(a)).length, 3);
  assert.match(r.answers[3], /NOT WRITTEN.*4 or more existing files/s);
});

test("the price question must state the price and offer the exact yes; then it ends the turn as a question", async () => {
  const r = await drive([[use("write_file", { file: "gallery.tsx", source: ABOUT })], [use("ask_owner", { question: "Add a gallery page?", options: ["Yes", "No"] })], [use("ask_owner", { question: "A gallery page costs about 6 to 22 credits. Go ahead?", options: [PRICE_YES, "No"] })]]);
  assert.match(r.answers[1], /must offer the answer exactly/);
  assert.equal(r.ag.ask && r.ag.ask.options[0], PRICE_YES);
  assert.equal(priceAskProblem({ text: "Go ahead?", options: [PRICE_YES, "No"] }), "the price question must say what it costs, in credits");
});

test("once the owner answered yes, the new page is written (control); small edits never ask (control)", async () => {
  const yes = await drive([[use("write_file", { file: "gallery.tsx", source: ABOUT })]], { request: "add a gallery\nYou asked: costs 6 to 22 credits\nThey answered: " + PRICE_YES });
  assert.match(yes.answers[0], /^Saved gallery\.tsx/);
  const small = await drive([[use("write_file", { file: "about.tsx", source: ABOUT.replace("About", "About us") })]]);
  assert.match(small.answers[0], /^Saved/);
  assert.equal(bigKind("-parts/hero", { orig: new Set(["index.tsx"]), written: new Set() }), "", "a new section on a page is an ordinary edit");
});

// ── M-8: NEVER CHOOSE A PROVIDER ─────────────────────────────────────────────
const PAY = 'export const hosts = ["api.stripe.com"];\nexport default async function (request: Request, site: SiteHelper) { return Response.json({}); }\n';
test("server code calling a provider the owner never named is refused; named in the chat, it is written", async () => {
  const r = await drive([[use("write_file", { file: "-parts/server-checkout", source: PAY })]], { request: "take payments\nThey answered: " + PRICE_YES });
  assert.match(r.answers[0], /NOT WRITTEN.*Stripe.*never named/s);
  const ok = await drive([[use("write_file", { file: "-parts/server-checkout", source: PAY })]], { request: "take payments\nThey answered: " + PRICE_YES, history: "Owner: we use Stripe for the till" });
  assert.match(ok.answers[0], /^Saved/);
  assert.deepEqual(providersIn("fetch('https://api.twilio.com/x')"), ["Twilio"]);
  assert.deepEqual(unchosenProviders(PAY, "pay with stripe please"), []);
});

// ── M-45: NO LINKS TO PAGES THAT DO NOT EXIST ────────────────────────────────
test("a new link to a page the site lacks holds the finish twice, then the reply names it", async () => {
  const bad = HOME.replace('<p>Fresh', '<Link to="/gallery">Gallery</Link><p>Fresh');
  const r = await drive([[use("write_file", { file: "index.tsx", source: bad })], [use("build", {})], [use("finish", { summary: "Added a gallery link." })], [use("finish", { summary: "Added a gallery link." })], [use("finish", { summary: "Added a gallery link." })]]);
  assert.equal(r.answers.filter((a) => /LINKS TO PAGES THE SITE DOES NOT HAVE/.test(a)).length, 2);
  assert.ok(r.ag.ok);
  assert.deepEqual(r.ag.deadLinks, [{ file: "index.tsx", to: "/gallery" }]);
  assert.match(agentSaidTruth(r.ag.summary, { dead: r.ag.deadLinks }), /pages your site does not have: \/gallery/);
});

test("dead-link reader: params, the API, uploads, anchors and links already there are not flagged (controls)", () => {
  const files = new Map([["index.tsx", '<a href="/api/x"/><a href="/u/a.png"/><a href="/about#team"/><Link to="/products/42"/><a href="https://x.com/y"/><Link to={"/nope"}/>'], ["about.tsx", ""], ["products/$id.tsx", ""], ["-parts/header", '<Link to="/missing">x</Link>']]);
  assert.deepEqual(deadLinks(files).map((d) => d.to).sort(), ["/missing", "/nope"]);
});

test("a dead link the site already had does not hold this change (control)", async () => {
  const pages = [{ path: "index.tsx", source: HOME.replace("/about", "/old") }, ...PAGES.slice(1)];
  const r = await drive([[use("write_file", { file: "about.tsx", source: ABOUT.replace("About", "About us") })], [use("build", {})], [use("finish", { summary: "Renamed." })]], { pages });
  assert.ok(!r.answers.some((a) => /DOES NOT HAVE/.test(a)), r.answers.join(" | "));
  assert.ok(r.ag.ok);
});

// ── M-42: UNASKED REMOVALS ARE ASKED ABOUT ───────────────────────────────────
test("taking away a link the request never named: told once, then the owner is asked, and nothing is saved on the agent's word", async () => {
  const before = { pages: PAGES, parts: [], css: null };
  const request = "make the heading bigger";
  const deps = { review: (w) => (changeReport(before, w, request).review ? "BEFORE YOU FINISH, CHECK THESE" : ""), unasked: (w) => unaskedLines(changeReport(before, w, request)) };
  const cut = HOME.replace('<Link to="/about">About us</Link>', "").replace("<h1>", '<h1 className="text-6xl">');
  const r = await drive([[use("write_file", { file: "index.tsx", source: cut })], [use("build", {})], [use("finish", { summary: "Bigger heading." })], [use("finish", { summary: "Bigger heading." })]], { request, ...deps });
  assert.ok(r.answers.some((a) => /BEFORE YOU FINISH/.test(a)), "the agent was told first");
  assert.ok(r.ag.ask, "the owner was not asked");
  assert.match(r.ag.ask.text, /the link “About us” on the home page/);
  assert.deepEqual(r.ag.ask.options, [REMOVE_YES, "No, keep them"]);
  // the owner said yes: it goes through
  const ok = await drive([[use("write_file", { file: "index.tsx", source: cut })], [use("build", {})], [use("finish", { summary: "Bigger heading." })], [use("finish", { summary: "Bigger heading." })]], { request: request + "\nThey answered: " + REMOVE_YES, ...deps });
  assert.equal(ok.ag.ask, null);
  assert.ok(ok.ag.ok);
});

// ── M-66: THE REPLY NEVER CLAIMS WHAT FAILED ─────────────────────────────────
test("the agent's words carry what really failed; nothing is added when all went well (control)", () => {
  assert.equal(agentSaidTruth("Added 3 products.", {}), "Added 3 products.");
  assert.match(agentSaidTruth("Added 3 products.", { failed: ["2 entries in the products table could not be saved (no such entry, or the database refused it)."] }), /^Added 3 products\.\n\nWhat did not work: 2 entries/);
  assert.equal(agentSaidTruth("", { failed: ["x"] }), "");
});
