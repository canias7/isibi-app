// PARKED (2026-11-03, park-old-way): the old-way half of test/parallel-build.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// FOUR CHANGES (owner-approved, 2026-11-02, after northline-climbing on deploy
// 2302: a new message "Text my customers a reminder the day before their
// class" was filed as part p3 of an older request whose part p2 was paused for
// credits; the agent's answer never reached the page).
//   J  a new message never joins a request with a part paused, waiting or ended;
//   R  a paused part does not hold the one reply back, and a later finish owes a follow-up;
//   A  the agent asks with ask_owner (buttons), from a part too, and the answer resumes that part;
//   B  a first build: the foundation first, then the pages in parallel (helpers), shown as tasks.
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is supplied. Nothing is spent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as RQ from "../../../builder/request.mjs";
import * as O from "../../../builder/one-reply.mjs";
import { runSiteAgent, toolsFor, firstBuildSplitRefusal, MAX_HELPERS, SERVER_RULES } from "../../../builder/site-agent.mjs";
import { buildPartsOf } from "../../../builder/site-progress.mjs";
import { platform, sendMessage, settle, call, T } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { writtenPage } from "../../../test/fixtures/addon-route.mjs";

const NOW = 1_800_000_000_000;
const KA = "a".repeat(20), KB = "b".repeat(20);
const part = (n, status, extra = {}) => ({ n, words: "w" + n, at: n, needs: [], held: [], putOff: [], status, jobs: [], targets: null, ...extra });
const rec = (parts) => RQ.settleState({ key: KA, uid: "u1", slug: "northline-climbing", message: "one", ended: false, stop: false, joined: [], parts }, NOW);

const DESC = "Change the site description to say we bake overnight sourdough";
const ADD = "add an events page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });

test("J3 through the real routes: a request paused for credits; the next message is a request of its own, and the paused one keeps its parts", async () => {
  const compiler = installCompiler();
  const hold = {};
  const P = platform({ slug: "pb-j3-" + Math.random().toString(16).slice(2, 8), answers: {
    route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }, { intent: "edit", layer: "look" }],
    [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": "Overnight sourdough.",
    [T.adds]: () => { if (!hold.done) { hold.done = true; P.credits.balance = 0; } return { kinds: ["page"] }; }, "add:page": { page: [PAGE("/events", "Events")] }, [T.pages]: { pages: [writtenPage("/events")] },
  } });
  try {
    const a = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    await settle(P, a.key, { rounds: 10 });
    const before = P.record(a.key);
    assert.ok(before.parts.some((p) => p.status === "credits"), JSON.stringify(before.parts.map((p) => p.status)));
    P.credits.balance = 40; // topped up, as live (the new message's agent ran and charged); no tick has resumed the pause yet
    const b = await sendMessage(P, { message: "Text my customers a reminder the day before their class" });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(b.body.joined, undefined, "the new message joined the paused request");
    assert.equal(P.record(a.key).parts.length, before.parts.length, "the paused request took new parts");
    assert.ok(P.record(b.key), "the new message is not a request of its own: " + JSON.stringify(b.body).slice(0, 600));
    assert.equal(b.body.request.key, b.key);
  } finally { P.close(); compiler.uninstall(); }
});

// ── B ──────────────────────────────────────────────────────────────────────
const tsx = (route, h) => "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('" + route + "')({ component: P })\nfunction P(){return <main><h1>" + h + "</h1></main>}\n";
const use = (id, name, input) => ({ type: "tool_use", id, name, input });
const said = (content) => ({ content, usage: { input_tokens: 100, output_tokens: 50 } });

/** A first build's agent, answers supplied: the main agent by its round, each helper by the file it was handed. */
function firstBuild(mainRounds) {
  const calls = { main: 0, helpers: [], progress: [], builds: 0, concurrent: 0, peak: 0 };
  const send = async (req) => {
    const first = JSON.stringify(req.messages[0].content);
    const m = /has handed you ONE file to write: ([a-z-]+\.tsx)/.exec(first);
    if (m) {
      const file = m[1];
      const turn = req.messages.length;
      if (turn === 1) {
        calls.concurrent++; calls.peak = Math.max(calls.peak, calls.concurrent);
        await new Promise((ok) => setTimeout(ok, 5));
        calls.concurrent--;
        calls.helpers.push(file);
        return said([use("w" + file, "write_file", { file, source: tsx("/" + file.replace(".tsx", ""), file) })]);
      }
      return said([use("f" + file, "finish", { summary: file + " written" })]);
    }
    const r = mainRounds[calls.main++];
    return said(r || [use("fin", "finish", { summary: "done" })]);
  };
  return { calls, deps: { send, build: async () => { calls.builds++; return { ok: true }; }, progress: (stage, facts) => calls.progress.push([stage, facts]) } };
}
const DESC6 = "A climbing gym: home, classes, prices, team, events, contact";
const FOUNDATION = [use("h", "write_file", { file: "-parts/site-header", source: "export function SiteHeader(){return <nav>Home Classes Prices Team Events Contact</nav>}\n" }), use("i", "write_file", { file: "index.tsx", source: tsx("/", "Northline") })];
