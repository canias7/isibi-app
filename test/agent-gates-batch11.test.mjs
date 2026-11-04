// Carry-over batch 11 (2026-11-04, the owner: "fix 2, 3, 4"): what an addition
// set up, checked and told (2); words asked for that are in the code but hidden
// until opened (3); stored QR codes shown on a page by name (4).
import test from "node:test";
import assert from "node:assert/strict";
import { runSiteAgent, shownTexts } from "../builder/site-agent.mjs";
import { agentSaidTruth, hiddenWords } from "../builder/agent-gates.mjs";

const HOME = "export default function Home() {\n  return <main><h1>Market Lane</h1><a href=\"/book\">Book</a></main>;\n}\n";
const PAGES = [{ path: "index.tsx", source: HOME }];
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
    build: async () => ({ ok: true }), canAsk: () => true, applySchema: () => true, siteUrl: async () => "https://market.gofarther.app",
    ...deps,
  }, { request, pages: PAGES, parts: [], css: "", spec: { tables: [] }, model: "m", maxRounds: 14 });
  return { ag, answers };
}

const BOOK_BROKEN = 'export default function Book() {\n  return <main><h1>Book a class</h1></main>;\n}\n';
const BOOK_WIRED = 'import { useCreateRow } from "@/lib/rows";\nexport default function Book() {\n  const add = useCreateRow("bookings");\n  return <main><h1>Book a class</h1><form onSubmit={() => add({})}><input name="email" /></form></main>;\n}\n';
const REQ = [{ need: "visitors can book a class", uses: ["page:/book", "table:bookings"] }];

test("FIX2 an addition must name what it is for; a page that does not save to its table is handed back once, then told as not done", async () => {
  const r = await drive([
    [use("change_schema", { table: "bookings", create: { columns: [{ name: "email", type: "text" }], access: "collect" } })],
    [use("write_file", { file: "book.tsx", source: BOOK_BROKEN })], [use("build", {})],
    [use("finish", { summary: "Added booking." })],
    [use("finish", { summary: "Added booking.", requirements: REQ })],
    [use("finish", { summary: "Added booking.", requirements: REQ })],
    [use("finish", { summary: "Added booking.", requirements: REQ })],
  ], { request: "add a booking page\nThey answered: Yes, go ahead" });
  assert.ok(r.answers.some((a) => /finish again with `requirements`/.test(a)), "asked for its requirements");
  assert.ok(r.answers.some((a) => /THESE REQUIREMENTS ARE NOT MET YET:\n- visitors can book a class: \/book does not read or save bookings/.test(a)), r.answers.join(" | "));
  assert.deepEqual(r.ag.requirements.map((x) => x.state), ["missing"]);
  assert.match(agentSaidTruth("Added booking.", { requirements: r.ag.requirements }), /Not done yet: visitors can book a class \(\/book does not read or save bookings\)\./);
});

test("FIX2 a wired page passes and is told as set up and checked (control)", async () => {
  const r = await drive([
    [use("change_schema", { table: "bookings", create: { columns: [{ name: "email", type: "text" }], access: "collect" } })],
    [use("write_file", { file: "book.tsx", source: BOOK_WIRED })], [use("build", {})],
    [use("finish", { summary: "Added booking.", requirements: REQ })],
  ], { request: "add a booking page\nThey answered: Yes, go ahead" });
  assert.deepEqual(r.ag.requirements.map((x) => x.state), ["present"]);
  assert.match(agentSaidTruth("Added booking.", { requirements: r.ag.requirements }), /Set up and checked: visitors can book a class\./);
});

test("FIX3 words asked for that are in the code but not shown on first load are told as hidden; a cut reading proves nothing", async () => {
  const page = HOME.replace("</main>", '<details><summary>FAQ</summary><p>We bake at 4am</p></details></main>');
  const build = async () => ({ ok: true, render: { findings: [], texts: [{ route: "/", text: "Market Lane\nFAQ", complete: true }] } });
  const r = await drive([[use("read_files", { files: ["index.tsx"] })], [use("write_file", { file: "index.tsx", source: page })], [use("build", {})], [use("finish", { summary: "Added it." })]], { request: 'add a line saying "We bake at 4am"', deps: { build } });
  assert.deepEqual(r.ag.hiddenWords, ["We bake at 4am"]);
  assert.match(agentSaidTruth("Added it.", { hidden: r.ag.hiddenWords }), /On the page but hidden until opened.*“We bake at 4am”/);
  assert.deepEqual(hiddenWords('add "We bake at 4am"', new Map([["a", "We bake at 4am"]]), "We bake at 4am"), [], "shown (control)");
  assert.equal(shownTexts({ render: { findings: [] } }), null, "no reading is not 'hidden'");
});

test("FIX4 a stored QR code is shown by name through SITE_QRS; a name the site does not store is refused", async () => {
  const qrCodes = async () => [{ name: "menu", points: "https://market.gofarther.app/menu", label: "Our menu" }];
  const good = HOME.replace("</main>", '<img src={SITE_QRS["menu"].src} alt={SITE_QRS["menu"].label} /></main>').replace("export default", 'import { SITE_QRS } from "@/site-brand";\nexport default');
  const r = await drive([[use("site_qr_codes", { action: "list" })], [use("read_files", { files: ["index.tsx"] })], [use("write_file", { file: "index.tsx", source: good.replace('"menu"', '"wifi"') })], [use("build", {})], [use("finish", { summary: "x" })], [use("write_file", { file: "index.tsx", source: good })], [use("build", {})], [use("finish", { summary: "QR shown." })]], { deps: { qrCodes } });
  assert.match(r.answers[0], /To show one on a page: import \{ SITE_QRS \} from "@\/site-brand"; <img src=\{SITE_QRS\["menu"\]\.src\}/);
  assert.ok(r.answers.some((a) => /these QR codes are not stored on the site: wifi\. The stored ones are: menu/.test(a)), r.answers.join(" | "));
  assert.ok(r.ag.ok, r.ag.stopped);
});
