// Carry-over batch 6 (2026-11-04): stale tel:/mailto: links, new pages nothing
// links to, a page the site does not have, files the build put back, progress
// lines that never claim a save, and the node_modules check back in the suite.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { runSiteAgent, roundFacts } from "../builder/site-agent.mjs";
import { staleContactLinks, unlinkedNewPages, pageNotThere, agentSaidTruth } from "../builder/agent-gates.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const HOME = 'import { Link } from "@tanstack/react-router";\nexport default function Home() {\n  return (\n    <main>\n      <h1>Market Lane</h1>\n      <a href="tel:02079460000">Call 020 7946 0000</a>\n      <Link to="/about">About</Link>\n    </main>\n  );\n}\n';
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: "export default function A() { return <main><h1>About</h1></main>; }\n" }];
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });

async function drive(calls, { request = "change it" } = {}) {
  const answers = [];
  let round = 0;
  const ag = await runSiteAgent({
    send: async (req) => {
      const last = req.messages[req.messages.length - 1];
      if (round > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") answers.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
      const step = calls[round++] || [use("finish", { summary: "done" })];
      return { content: step, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    build: async () => ({ ok: true }), canAsk: () => true,
  }, { request, pages: PAGES, parts: [], model: "m", maxRounds: 12 });
  return { ag, answers };
}

test("M-47 a changed number whose tel: link still dials the old one holds the finish once; then the reply says so", async () => {
  const bad = HOME.replace("Call 020 7946 0000", "Call 020 7946 1111");
  const r = await drive([[use("write_file", { file: "index.tsx", source: bad })], [use("build", {})], [use("finish", { summary: "New number." })], [use("finish", { summary: "New number." })]], { request: "our number is now 020 7946 1111" });
  assert.equal(r.answers.filter((a) => /STILL DIAL OR WRITE/.test(a)).length, 1);
  assert.deepEqual(r.ag.staleLinks, ["tel:02079460000"]);
  assert.match(agentSaidTruth("New number.", { stale: r.ag.staleLinks }), /These links still go to the old details: tel:02079460000/);
  assert.deepEqual(staleContactLinks(HOME, HOME.replace(/0000/g, "1111")), [], "number and link changed together (control)");
  assert.deepEqual(staleContactLinks('<a href="mailto:old@x.com">old@x.com</a>', '<a href="mailto:old@x.com">new@x.com</a>'), ["mailto:old@x.com"]);
});

test("M-48 a new page nothing links to holds the finish once; then the reply says it", async () => {
  const r = await drive([[use("write_file", { file: "gallery.tsx", source: "export default function G() { return <main/>; }\n" })], [use("build", {})], [use("finish", { summary: "Added." })], [use("finish", { summary: "Added." })]], { request: "add a gallery page\nThey answered: Yes, go ahead" });
  assert.equal(r.answers.filter((a) => /NOTHING LINKS TO THE NEW PAGE \/gallery/.test(a)).length, 1);
  assert.deepEqual(r.ag.unlinked, ["/gallery"]);
  assert.match(agentSaidTruth("Added.", { unlinked: r.ag.unlinked }), /Nothing links to \/gallery yet/);
  const files = new Map([["index.tsx", HOME + '<Link to="/gallery">G</Link>'], ["gallery.tsx", ""]]);
  assert.deepEqual(unlinkedNewPages(files, new Set(["index.tsx"])), [], "linked (control)");
});

test("M-64 a page the site lacks: the agent is stopped once before its first change, to ask", async () => {
  assert.equal(pageNotThere("change the heading on the gallery page", PAGES), "gallery");
  assert.equal(pageNotThere("change the heading on the about page", PAGES), "");
  assert.equal(pageNotThere("add a gallery page", PAGES), "", "making one is asked for (control)");
  const r = await drive([[use("write_file", { file: "index.tsx", source: HOME.replace("Market Lane", "Market") })], [use("ask_owner", { question: "There is no gallery page. Which page do you mean?", options: ["Home", "About"] })]], { request: "change the heading on the gallery page" });
  assert.match(r.answers[0], /WAIT: the owner named the “gallery” page and this site has no such page \(its pages: \/, \/about\)/);
  assert.ok(r.ag.ask);
  assert.deepEqual(r.ag.changed, []);
});

test("M-71 files the build put back are told as unchanged", () => {
  assert.match(agentSaidTruth("Updated the about page.", { putBack: ["about.tsx"] }), /These couldn't be changed \(they didn't build\) and were left as they were: the \/about page\./);
  assert.match(W, /putBack: out && out\.salvaged && Array\.isArray\(out\.salvaged\.kept\) \? out\.salvaged\.kept : \[\]/);
});

test("M-78 a workspace write is work in progress, never said as done before the save", () => {
  const f = roundFacts([{ use: use("write_file", { file: "about.tsx" }), r: { text: "Saved" } }, { use: use("delete_file", { file: "menu.tsx" }), r: { text: "Removed" } }]);
  assert.deepEqual(f, [{ state: "doing", text: "Writing the /about page (saved when the change is done)." }, { state: "doing", text: "Taking off the /menu page (saved when the change is done)." }]);
});

test("M-95 the repository's node_modules check runs in the suite again", () => {
  assert.ok(existsSync(new URL("./no-generated-deps.test.mjs", import.meta.url)));
  assert.ok(!existsSync(new URL("../parked/old-way/test/no-generated-deps.test.mjs", import.meta.url)));
});
