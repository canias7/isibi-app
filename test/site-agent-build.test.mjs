// A FIRST BUILD WRITTEN BY THE SITE AGENT (2026-10-28), through the real
// `POST /api/site/react-build`: the real design call (a supplied answer), and
// in the page writer's place the agent, whose answers are supplied round by
// round. What this proves is the PATH: the agent gets the brief and an empty
// site, builds with the build's own compile, and its pages are what the build
// validates, compiles, stores and publishes; no page-writer call is made.
import test from "node:test";
import assert from "node:assert/strict";
import { driveBuild, GOOD_DESIGN, BRIEF } from "./fixtures/build-route.mjs";

delete process.env.GF_OLD_LANES;

const HOME = "import { createFileRoute } from '@tanstack/react-router'\nimport SiteHeader from './-parts/site-header'\nimport SiteFooter from './-parts/site-footer'\n" +
  "export const Route = createFileRoute('/')({ component: Home })\nfunction Home(){return <main><SiteHeader /><h1>Harbour Loaf</h1><p>Order loaves for collection.</p><SiteFooter /></main>}\n";
const HEADER = "export default function SiteHeader(){return <header>Harbour Loaf</header>}\n";
const FOOTER = "export default function SiteFooter(){return <footer>Leeds</footer>}\n";
const use = (name, input, id) => ({ type: "tool_use", id, name, input });

test("SAB1 a first build: the agent writes the site from the brief, builds, and its pages are published", async () => {
  const agent = [];
  const rounds = [
    [use("write_file", { file: "index.tsx", source: HOME }, "a1"), use("write_file", { file: "-parts/site-header", source: HEADER }, "a2"), use("write_file", { file: "-parts/site-footer", source: FOOTER }, "a3")],
    [use("build", {}, "b1")],
    [use("finish", { summary: "Built the home page with the header and footer." }, "f1")],
  ];
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF },
    onFetch: async (url, init) => {
      if (!url.includes("/v1/messages")) return null;
      const b = JSON.parse(String((init && init.body) || "{}"));
      if (!(Array.isArray(b.tools) && b.tools.some((t) => t.name === "finish"))) return null;
      agent.push(b);
      const c = rounds[Math.min(agent.length - 1, rounds.length - 1)];
      return new Response(JSON.stringify({ stop_reason: "tool_use", content: c, usage: { input_tokens: 2000, output_tokens: 900 } }), { headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(agent.length, 3, "three agent rounds: " + JSON.stringify(r.reply).slice(0, 400));
  assert.match(agent[0].messages[0].content[0].text, /none yet — this is a new site/);
  assert.match(agent[0].messages[0].content[0].text, /Harbour Loaf, a bakery in Leeds/);
  assert.ok(!r.seen.tools.includes("write_pages") && !r.seen.tools.includes("write_band"), "no page-writer call: " + r.seen.tools.join(","));
  const stored = [...r.store.entries()].find(([k]) => /^source\/[^/]+\/pages\.json$/.test(k));
  assert.ok(stored, "the pages are stored: " + JSON.stringify(r.reply).slice(0, 400));
  const pages = JSON.parse(stored[1]);
  assert.ok(pages.some((p) => p.path === "index.tsx" && p.source.includes("Order loaves for collection.")), "the agent's home page is the stored one");
  assert.equal(r.reply && r.reply.page, "app", "the site went up, not the placeholder: " + JSON.stringify(r.reply).slice(0, 300));
});

test("SAB2 a first build gives the agent `look`: it sees the page and, in words, what the browser check found", async () => {
  const agent = [];
  const rounds = [
    [use("write_file", { file: "index.tsx", source: HOME }, "a1"), use("write_file", { file: "-parts/site-header", source: HEADER }, "a2"), use("write_file", { file: "-parts/site-footer", source: FOOTER }, "a3")],
    [use("build", {}, "b1")],
    [use("look", { page: "/" }, "l1")],
    [use("finish", { summary: "Built the home page." }, "f1")],
    [use("finish", { summary: "Built the home page; the contrast flag was checked." }, "f2")],
  ];
  const PNG = "iVBORw0KGgo" + "A".repeat(100);
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF },
    compiler: {
      render: { ok: true, checked: 2, findings: [{ route: "/", viewport: "desktop", kind: "contrast", detail: "Order loaves" }] },
      shots: (body) => (Array.isArray(body.shots) ? body.shots : []).map((route) => ({ route, viewport: "desktop", height: 800, png: PNG })),
    },
    onFetch: async (url, init) => {
      if (!url.includes("/v1/messages")) return null;
      const b = JSON.parse(String((init && init.body) || "{}"));
      if (!(Array.isArray(b.tools) && b.tools.some((t) => t.name === "finish"))) return null;
      agent.push(b);
      const c = rounds[Math.min(agent.length - 1, rounds.length - 1)];
      return new Response(JSON.stringify({ stop_reason: "tool_use", content: c, usage: { input_tokens: 2000, output_tokens: 900 } }), { headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(agent.length >= 4, "rounds: " + agent.length + " " + JSON.stringify(r.reply).slice(0, 300));
  assert.ok(agent[0].tools.some((t) => t.name === "look"), "look is offered in a first build");
  const res = (i) => JSON.stringify(agent[i].messages.at(-1).content);
  assert.match(res(2), /nearly invisible/, "the build tool's answer names the finding");
  assert.match(res(3), /Screenshots of \//, "look answered with screenshots, not 'cannot be looked at here'");
  assert.doesNotMatch(res(3), /cannot be looked at here/);
  assert.match(res(3), /FIX THIS/);
  assert.match(res(4), /FIX THIS.*finish again|fix it, build, and finish again/, "the first finish is held once");
});
