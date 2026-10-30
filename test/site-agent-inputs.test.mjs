// WHAT THE OWNER BRINGS IN, FOR THE SITE AGENT (2026-10-30): attached files
// (`read_attachment`), their old website (`import_site`) and a pasted list
// (the bulk-rows rule, and `change_rows` taking a long list in one call).
// Every model answer is SUPPLIED; the fetches are stubbed. This proves the
// tools and the wiring, not what a real model would do with them.
import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { runSiteAgent, toolsFor, TOOL_NEEDS, agentSystem, agentAttachments, agentAttachmentsFromBlocks, csvText, MAX_TABLE_READ } from "../builder/site-agent.mjs";
import { pdfText } from "../builder/pdf-text.mjs";
import { drive } from "./fixtures/agent-route.mjs";
import { driveBuild, GOOD_DESIGN, BRIEF } from "./fixtures/build-route.mjs";

delete process.env.GF_OLD_LANES;

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==";
const pdfOf = (content) => {
  const z = deflateSync(Buffer.from(content, "latin1"));
  const head = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Length " + z.length + " /Filter /FlateDecode >>\nstream\n", "latin1");
  return Buffer.concat([head, z, Buffer.from("\nendstream\nendobj\n%%EOF\n", "latin1")]).toString("base64");
};
const MENU_PDF = pdfOf("BT /F1 12 Tf 72 700 Td (Sourdough loaf 4.50) Tj 0 -14 Td [(Rye) -300 (loaf 5.00)] TJ ET");
const PAGE = "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/')({ component: P })\nfunction P(){return <main>Hi</main>}\n";
const use = (name, input, id) => ({ type: "tool_use", id: id || name + Math.random().toString(36).slice(2, 7), name, input });

/** runSiteAgent with supplied rounds; answers every tool_result the agent was sent. */
async function agent(rounds, opts = {}, deps = {}) {
  const sent = [];
  const r = await runSiteAgent({
    send: async (req) => { sent.push(JSON.parse(JSON.stringify(req))); return { stop_reason: "tool_use", content: rounds[Math.min(sent.length - 1, rounds.length - 1)], usage: { input_tokens: 10, output_tokens: 10 } }; },
    build: async () => ({ ok: true }),
    ...deps,
  }, { request: "Change things.", pages: [{ path: "index.tsx", source: PAGE }], parts: [], model: "claude-sonnet-4-6", maxRounds: rounds.length, ...opts });
  const results = (i) => sent[i].messages.at(-1).content;
  return { r, sent, results };
}

test("SAI1 the new tools are offered only when wired: read_attachment with files, import_site with an importer", () => {
  assert.equal(TOOL_NEEDS.read_attachment, "attachment");
  assert.equal(TOOL_NEEDS.import_site, "importSite");
  const names = (d) => toolsFor(d).map((t) => t.name);
  assert.ok(!names({}).includes("read_attachment") && !names({}).includes("import_site"));
  assert.ok(names({ attachment: () => null }).includes("read_attachment"));
  assert.ok(names({ importSite: async () => ({}) }).includes("import_site"));
  assert.equal(names({}).at(-1), "finish", "finish stays last");
});

test("SAI2 attachments: listed in the first message, the tool offered, and absent with no files", async () => {
  const files = agentAttachments([{ name: "shop.png", data: "data:image/png;base64," + PNG }, { name: "prices.csv", text: "name,price\nRye,5" }]).files;
  assert.deepEqual(files.map((f) => [f.id, f.kind]), [["attachment-1", "image"], ["attachment-2", "csv"]]);
  const { sent } = await agent([[use("finish", { summary: "ok" })]], { attached: files });
  const first = sent[0].messages[0].content[0].text;
  assert.match(first, /attachment-1: shop\.png \(image, /);
  assert.match(first, /attachment-2: prices\.csv \(csv, /);
  assert.ok(sent[0].tools.some((t) => t.name === "read_attachment"));
  const none = await agent([[use("finish", { summary: "ok" })]]);
  assert.ok(!none.sent[0].tools.some((t) => t.name === "read_attachment"));
  assert.doesNotMatch(none.sent[0].messages[0].content[0].text, /ATTACHED/);
});

test("SAI3 read_attachment: an image as an image block, placed on request; a PDF, a CSV and a text file as text", async () => {
  const files = agentAttachments([
    { name: "shop.png", data: "data:image/png;base64," + PNG },
    { name: "menu.pdf", data: "data:application/pdf;base64," + MENU_PDF },
    { name: "prices.csv", text: "name,price,notes\n\"Rye, dark\",5,\nSpelt,6,new" },
  ]).files.concat(agentAttachments([{ name: "about.md", text: "We bake at dawn." }]).files.map((f) => ({ ...f, id: "attachment-9" })));
  const stored = [];
  const { results } = await agent([
    [use("read_attachment", { id: "attachment-1", place: true }, "i1"), use("read_attachment", { id: "attachment-2" }, "p1"), use("read_attachment", { id: "attachment-3" }, "c1"), use("read_attachment", { id: "attachment-9" }, "t1"), use("read_attachment", { id: "nope" }, "n1")],
    [use("finish", { summary: "read" })],
  ], { attached: files }, { pdfText, storeAttachment: async (f) => { stored.push(f.name); return { url: "/u/abc.png" }; } });
  const out = results(1);
  const by = (id) => out.find((b) => b.tool_use_id === id);
  assert.match(by("i1").content, /src="\/u\/abc\.png"/);
  assert.deepEqual(stored, ["shop.png"]);
  const img = out.find((b) => b.type === "image");
  assert.ok(img, "the image is sent as an image block");
  assert.equal(img.source.media_type, "image/png");
  assert.equal(img.source.data, PNG);
  assert.match(by("p1").content, /Sourdough loaf 4\.50/);
  assert.match(by("p1").content, /Rye loaf 5\.00/);
  assert.match(by("c1").content, /row 1: name=Rye, dark; price=5; notes=/);
  assert.match(by("c1").content, /row 2: name=Spelt; price=6; notes=new/);
  assert.match(by("t1").content, /We bake at dawn\./);
  assert.equal(by("n1").is_error, true);
});

test("SAI4 read_attachment: a PDF with no readable words, and no PDF reader, are told; long text is cut with `from`", async () => {
  const blank = pdfOf("q 1 0 0 1 0 0 cm Q");
  const long = "x".repeat(50000) + "END";
  const files = [{ id: "attachment-1", name: "scan.pdf", kind: "pdf", size: 10, data: blank }, { id: "attachment-2", name: "long.txt", kind: "text", size: long.length, text: long }];
  const { results } = await agent([[use("read_attachment", { id: "attachment-1" }, "a"), use("read_attachment", { id: "attachment-2" }, "b")], [use("read_attachment", { id: "attachment-2", from: 40000 }, "c")], [use("finish", { summary: "x" })]], { attached: files }, { pdfText });
  assert.equal(results(1)[0].is_error, true);
  assert.match(results(1)[0].content, /no readable text/);
  assert.match(results(1)[1].content, /from=40000/);
  assert.doesNotMatch(results(1)[1].content, /END/);
  assert.match(results(2)[0].content, /END/);
  const noReader = await agent([[use("read_attachment", { id: "attachment-1" }, "a")], [use("finish", { summary: "x" })]], { attached: files });
  assert.match(noReader.results(1)[0].content, /cannot be read here/);
  assert.equal(await pdfText("bm90IGEgcGRm"), "", "not a PDF: nothing");
});

test("SAI5 a build's held blocks become the agent's files, by the build's own ids", () => {
  const f = agentAttachmentsFromBlocks([{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } }, { type: "document", source: { type: "base64", media_type: "application/pdf", data: "BBBB" } }],
    [{ id: "attachment-1", name: "a.txt", kind: "text" }, { id: "attachment-2", name: "front.jpg", kind: "image" }, { id: "attachment-3", name: "menu.pdf", kind: "document" }]);
  assert.deepEqual(f.map((x) => [x.id, x.name, x.kind]), [["attachment-2", "front.jpg", "image"], ["attachment-3", "menu.pdf", "pdf"]]);
});

test("SAI6 import_site: runs the importer for an address in the owner's words, refuses any other, private or non-web address", async () => {
  const asked = [];
  const extract = { url: "https://oldbakery.co.uk/", name: "Old Bakery", pages: [{ url: "https://oldbakery.co.uk/", path: "/", title: "Home", headings: ["Fresh bread"], text: "Open 7 till 3." }], contact: { phones: ["0113 000"] }, photos: [], logo: null };
  const importer = async (href) => { asked.push(href); return { ok: true, extract, pictures: [{ id: "imported-logo", alt: "logo", url: "/u/logo.png" }, { id: "imported-1", alt: "", url: "", why: "it couldn't be downloaded" }] }; };
  const { results } = await agent([
    [use("import_site", { url: "oldbakery.co.uk" }, "ok"), use("import_site", { url: "https://evil.example.com" }, "other"), use("import_site", { url: "http://127.0.0.1/" }, "priv"), use("import_site", { url: "file:///etc/passwd" }, "file")],
    [use("finish", { summary: "x" })],
  ], { request: "Rebuild my site from oldbakery.co.uk and also see http://127.0.0.1/ and file:///etc/passwd" }, { importSite: importer });
  const by = (id) => results(1).find((b) => b.tool_use_id === id);
  assert.deepEqual(asked, ["https://oldbakery.co.uk/"], "only the owner's public address is fetched");
  assert.match(by("ok").content, /Old Bakery/);
  assert.match(by("ok").content, /Open 7 till 3\./);
  assert.match(by("ok").content, /0113 000/);
  assert.match(by("ok").content, /src="\/u\/logo\.png"/);
  assert.match(by("ok").content, /couldn't be downloaded/);
  for (const id of ["other", "priv", "file"]) assert.equal(by(id).is_error, true, id);
});

test("SAI7 import_site through the worker's wiring uses importSite's guarded fetch (a stub fetch answers the page)", async () => {
  const { importSite } = await import("../builder/site-import.mjs");
  const got = await importSite("https://oldbakery.co.uk/", { fetchText: async (u) => ({ ok: true, status: 200, contentType: "text/html", url: u, body: "<html><head><title>Old Bakery</title></head><body><h1>Fresh bread</h1><p>Open 7 till 3.</p></body></html>" }) });
  assert.equal(got.ok, true);
  const blocked = await importSite("http://169.254.169.254/", { fetchText: async () => { throw new Error("must not fetch"); } });
  assert.equal(blocked.ok, false);
  // The worker hands the agent this same importer (`agentInputDeps`).
  const src = (await import("node:fs")).readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("function agentInputDeps("), b = src.indexOf("async function runAgentChange(");
  assert.ok(a > 0 && b > a, "both landmarks exist");
  const body = src.slice(a, b);
  assert.match(body, /importSite\(href, \{ fetchText: importFetchText \}\)/);
  assert.match(body, /placeImportedPhotos\(/);
});

test("SAI8 the bulk-list rule: read the table first, one change_rows call, never invent a missing value", () => {
  const s = agentSystem(null, "");
  const i = s.search(/list the owner pastes or attaches/i);
  assert.ok(i > 0, "the rule is there");
  const rule = s.slice(i, i + 800);
  assert.match(rule, /read_table/);
  assert.match(rule, /ONE change_rows call/i);
  assert.match(rule, /never invent/i);
  assert.match(rule, /missing/i);
});

test("SAI9 a 200-row list is queued in one change_rows call, and read_table reads more than 20 when asked", async () => {
  const rows = Array.from({ length: 200 }, (_, n) => ({ name: "Item " + n, price: n }));
  let readN = 0;
  const { r, results } = await agent([[use("read_table", { table: "products", limit: 300 }, "rt"), use("change_rows", { table: "products", add: rows }, "cr")], [use("finish", { summary: "added 200" })]],
    { spec: { tables: [{ name: "products", columns: [{ name: "id" }, { name: "name" }, { name: "price" }] }] } },
    { readTable: async (t, n) => { readN = n; return []; } });
  assert.equal(results(1).find((b) => b.tool_use_id === "cr").is_error, undefined);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].add.length, 200);
  assert.equal(readN, 300);
  assert.ok(MAX_TABLE_READ >= 200);
});

test("SAI10 csvText: quotes, empty cells and tabs", () => {
  assert.match(csvText("a\tb\nx\t", "\t"), /row 1: a=x; b=/);
  assert.equal(csvText(""), "(no rows)");
});

for (const route of ["edit", "addon"]) {
  test("SAI11 " + route + ": the message's attachments reach the agent through the real route", async () => {
    const r = await drive({ route, ask: "Use the attached price list.", images: [{ name: "prices.csv", text: "name,price\nRye,5" }, { name: "shop.png", data: "data:image/png;base64," + PNG }],
      rounds: [[use("read_attachment", { id: "attachment-1" })], [use("finish", { summary: "Read it." })]] });
    assert.ok(r.seen.agent.length >= 2, JSON.stringify(r.reply).slice(0, 300));
    const first = r.seen.agent[0];
    assert.match(first.messages[0].content[0].text, /attachment-1: prices\.csv/);
    assert.match(first.messages[0].content[0].text, /attachment-2: shop\.png/);
    assert.ok(first.tools.some((t) => t.name === "read_attachment") && first.tools.some((t) => t.name === "import_site"));
    assert.match(JSON.stringify(r.seen.agent[1].messages.at(-1).content), /row 1: name=Rye; price=5/);
  });
}

test("SAI12 a first build: the attached image reaches the agent with its id and read_attachment", async () => {
  const agentCalls = [];
  const r = await driveBuild({
    design: { input: GOOD_DESIGN },
    body: { brief: BRIEF, images: [{ name: "front.png", data: "data:image/png;base64," + PNG }] },
    onFetch: async (url, init) => {
      if (!url.includes("/v1/messages")) return null;
      const b = JSON.parse(String((init && init.body) || "{}"));
      if (!(Array.isArray(b.tools) && b.tools.some((t) => t.name === "finish"))) return null;
      agentCalls.push(b);
      return new Response(JSON.stringify({ stop_reason: "tool_use", content: [use("finish", { summary: "stop" }, "f")], usage: { input_tokens: 10, output_tokens: 10 } }), { headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(agentCalls.length >= 1, "the agent ran: " + JSON.stringify(r.reply).slice(0, 300));
  assert.match(agentCalls[0].messages[0].content[0].text, /attachment-1: front\.png \(image/);
  assert.ok(agentCalls[0].tools.some((t) => t.name === "read_attachment"));
});
