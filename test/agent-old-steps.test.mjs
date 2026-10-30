// The old steps as the site agent's tools (2026-10-30, `builder/agent-steps.mjs`).
// Each tool: offered only when wired, its happy path queued into the agent's
// answer, its refusal path an error the agent reads, with stubbed deps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSiteAgent, toolsFor, toolCounts, roundFacts, TOOL_NEEDS } from "../builder/site-agent.mjs";
import { readSettingsInput, readLogoInput, readLanguagesInput, readRulesInput, readRenameInput, readAskInput, readQrInput, agentSettingsPatch } from "../builder/agent-steps.mjs";

const NEW = ["set_site_settings", "set_logo", "set_languages", "set_table_rules", "rename_page", "make_qr", "ask_owner"];
const PAGES = [
  { path: "index.tsx", source: 'import { Link } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: () => <Link to="/menu">Menu</Link> });' },
  { path: "menu.tsx", source: 'export const Route = createFileRoute("/menu")({ component: () => <h1>Menu</h1> });' },
];
const PARTS = [{ name: "site-footer", source: 'export default () => <a href="/menu">Our menu</a>;' }];
const TABLES = [{ name: "bookings", columns: [{ name: "id", type: "integer" }, { name: "email", type: "text" }, { name: "slot", type: "text" }], read: "none", write: "anyone" }];
const upload = async (n) => (String(n).endsWith("logo.png") ? { ok: true, name: "logo.png", url: "/u/s/logo.png" } : { ok: false, why: "not an upload" });

/** A scripted model: each round's tool calls, then finish. */
function scripted(rounds) {
  let i = 0;
  const seen = [];
  return {
    seen,
    send: async (req) => {
      seen.push(JSON.parse(JSON.stringify({ messages: req.messages, tools: req.tools })));
      const uses = rounds[i++] || [{ name: "finish", input: { summary: "done" } }];
      return { content: uses.map((u, k) => ({ type: "tool_use", id: "u" + i + "_" + k, name: u.name, input: u.input })), usage: { input_tokens: 10, output_tokens: 10 } };
    },
  };
}
const wired = (extra = {}) => ({ saveSettings: () => true, checkUpload: upload, saveRules: () => true, saveRedirects: () => true, siteUrl: async () => "https://shop.gofarther.app/", canAsk: () => true, build: async () => ({ ok: true }), ...extra });
const resultOf = (seen, round) => seen[round].messages.at(-1).content.filter((b) => b.type === "tool_result");

test("each new tool is offered only when its dependency is wired", () => {
  const none = toolsFor({ build: async () => ({ ok: true }) }).map((t) => t.name);
  for (const n of NEW) assert.equal(none.includes(n), false, n + " offered unwired");
  const all = toolsFor(wired()).map((t) => t.name);
  for (const n of NEW) { assert.ok(all.includes(n), n + " not offered wired"); assert.ok(Object.hasOwn(TOOL_NEEDS, n)); }
  assert.equal(all.at(-1), "finish");
});

test("set_site_settings: queued and returned; refusals named", async () => {
  const ok = await readSettingsInput({ title: "  Fold  Lane ", description: "Bread\nbaked daily", shareImage: "logo.png" }, { checkUpload: upload });
  assert.deepEqual(ok.settings, { name: "Fold Lane", description: "Bread baked daily", share: "logo.png" });
  assert.ok((await readSettingsInput({ description: "x".repeat(400) })).error);
  assert.ok((await readSettingsInput({ favicon: "other.png" }, { checkUpload: upload })).error);
  assert.ok((await readSettingsInput({ favicon: "logo.png" })).error, "no checker: refused");
  assert.ok((await readSettingsInput({})).error);
  assert.ok((await readSettingsInput({ name: "A", title: "B" })).error, "two different names are refused");
  assert.equal((await readSettingsInput({ name: "A", title: "A" })).settings.name, "A");
  assert.ok((await readSettingsInput({ name: ["a"] })).error, "an array is not coerced");
  const m = scripted([[{ name: "set_site_settings", input: { name: "New Name", description: "Fresh bread" } }]]);
  const r = await runSiteAgent({ ...wired(), send: m.send }, { request: "rename", pages: PAGES, parts: PARTS });
  assert.equal(r.ok, true);
  assert.deepEqual(r.settings, { name: "New Name", description: "Fresh bread" });
  assert.equal(r.changed.length, 0);
});

test("agentSettingsPatch merges into the stored look and keeps the rest", () => {
  const p = agentSettingsPatch({ look: { brand: "A", theme: "t1", langs: ["es"] } }, { name: "B", wordmark: "/u/s/logo.png", share: "logo.png" });
  assert.equal(p.look.theme, "t1");
  assert.deepEqual(p.look.langs, ["es"]);
  assert.equal(p.look.brand, "B");
  assert.deepEqual(p.look.wordmark, { form: "image", url: "/u/s/logo.png" });
  assert.equal(p.share, "logo.png");
  assert.deepEqual(agentSettingsPatch({ look: {} }, { share: "" }), { share: "" });
});

test("set_logo: an upload to the header or the tab; refusals", async () => {
  assert.deepEqual((await readLogoInput({ upload: "/u/s/logo.png" }, { checkUpload: upload })).settings, { wordmark: "/u/s/logo.png" });
  assert.deepEqual((await readLogoInput({ upload: "logo.png", target: "icon" }, { checkUpload: upload })).settings, { favicon: "/u/s/logo.png" });
  assert.deepEqual((await readLogoInput({ remove: true })).settings, { wordmark: "" });
  assert.ok((await readLogoInput({ upload: "x.png" }, { checkUpload: upload })).error);
  assert.ok((await readLogoInput({ upload: "logo.png", target: "footer" }, { checkUpload: upload })).error);
  assert.ok((await readLogoInput({})).error);
});

test("set_languages: tags, the whole list, refusals", () => {
  assert.deepEqual(readLanguagesInput({ langs: ["es", "fr", "es"] }).settings, { langs: ["es", "fr"] });
  assert.deepEqual(readLanguagesInput({ langs: [] }).settings, { langs: [] });
  assert.deepEqual(readLanguagesInput({ lang: "pt-BR" }).settings, { lang: "pt-BR" });
  assert.ok(readLanguagesInput({ langs: "es" }).error);
  assert.ok(readLanguagesInput({ lang: "Spanish" }).error);
  assert.ok(readLanguagesInput({ lang: "es", langs: ["es"] }).error);
  assert.ok(readLanguagesInput({}).error);
});

test("set_table_rules: read as the rules step reads; a wider read needs the owner's words", () => {
  const r = readRulesInput({ table: "bookings", maxRows: 50, oncePerUser: ["email"] }, TABLES, ["limit it"]);
  assert.deepEqual(r.changes, [{ table: "bookings", oncePerUser: ["email"], maxRows: 50 }]);
  const wide = readRulesInput({ table: "bookings", read: "public" }, TABLES, ["limit it"]);
  assert.match(wide.error, /ask_owner/);
  const grounded = readRulesInput({ table: "bookings", read: "public", readWords: "let everyone see bookings" }, TABLES, ["please let everyone see bookings"]);
  assert.equal(grounded.changes[0].read, "public");
  assert.ok(readRulesInput({ table: "nope", maxRows: 3 }, TABLES).error);
  assert.ok(readRulesInput({ table: "bookings" }, TABLES).error);
  assert.ok(readRulesInput({ table: "bookings", maxRows: 3 }, []).error);
  assert.deepEqual(readRulesInput({ table: "bookings", write: "anyone" }, TABLES).already.length, 1);
});

test("set_table_rules through the agent: queued, counted, never when unwired", async () => {
  const m = scripted([[{ name: "set_table_rules", input: { table: "bookings", maxRows: 20 } }]]);
  const r = await runSiteAgent({ ...wired(), send: m.send }, { request: "at most 20 bookings", pages: PAGES, parts: PARTS, spec: { tables: TABLES } });
  assert.deepEqual(r.rules, [{ table: "bookings", maxRows: 20 }]);
  assert.equal(toolCounts([{ name: "set_table_rules" }]).ruleChanges, 1);
});

test("rename_page: the file moves, links in pages and components follow, the move is recorded", async () => {
  const r = readRenameInput({ from: "/menu", to: "/food" }, [...PAGES, { path: "-parts/site-footer", source: PARTS[0].source }]);
  assert.deepEqual(r.redirect, { from: "/menu", to: "/food" });
  assert.ok(r.files.some((f) => f.path === "food.tsx"));
  assert.ok(!r.files.some((f) => f.path === "menu.tsx"));
  assert.ok(r.files.every((f) => !f.source.includes('"/menu"')));
  assert.ok(readRenameInput({ from: "/", to: "/home" }, PAGES).error);
  assert.ok(readRenameInput({ from: "/menu", to: "/" }, PAGES).error);
  assert.ok(readRenameInput({ from: "/nope", to: "/x" }, PAGES).error);
  const m = scripted([[{ name: "rename_page", input: { from: "/menu", to: "/food" } }], [{ name: "build", input: {} }]]);
  const a = await runSiteAgent({ ...wired(), send: m.send }, { request: "rename", pages: PAGES, parts: PARTS });
  assert.equal(a.ok, true);
  assert.deepEqual(a.redirects, { "/menu": "/food" });
  assert.ok(a.pages.some((p) => p.path === "food.tsx") && !a.pages.some((p) => p.path === "menu.tsx"));
  assert.ok(a.parts.find((p) => p.name === "site-footer").source.includes('"/food"'));
  const f = roundFacts([{ use: { name: "rename_page", input: { from: "/menu", to: "/food" } }, r: { text: "x" } }]);
  assert.ok(f.some((x) => x.text.includes("/food")));
});

test("rename_page under a part's scope (combined with the guardrails): a move touching a file outside it is refused whole", async () => {
  // The scope allows only the menu page: the move would also rewrite index.tsx and the footer.
  const mayWrite = (k) => (k === "menu.tsx" || k === "food.tsx" ? "" : "outside this part: " + k);
  const m = scripted([[{ name: "rename_page", input: { from: "/menu", to: "/food" } }]]);
  const a = await runSiteAgent({ ...wired(), mayWrite, send: m.send }, { request: "rename", pages: PAGES, parts: PARTS });
  const res = resultOf(m.seen, 1)[0];
  assert.equal(res.is_error, true);
  assert.match(String(res.content), /outside this part/);
  assert.deepEqual(a.redirects, {});
  assert.deepEqual(a.pages.map((p) => p.path).sort(), ["index.tsx", "menu.tsx"]);
  // the same move with nothing in its way still lands (the control)
  const m2 = scripted([[{ name: "rename_page", input: { from: "/menu", to: "/food" } }], [{ name: "build", input: {} }]]);
  const b = await runSiteAgent({ ...wired(), mayWrite: () => "", send: m2.send }, { request: "rename", pages: PAGES, parts: PARTS });
  assert.deepEqual(b.redirects, { "/menu": "/food" });
});

test("rename_page unbuilt is held at finish", async () => {
  const m = scripted([[{ name: "rename_page", input: { from: "/menu", to: "/food" } }], [{ name: "finish", input: { summary: "x" } }], [{ name: "build", input: {} }]]);
  await runSiteAgent({ ...wired(), send: m.send }, { request: "rename", pages: PAGES, parts: PARTS });
  assert.equal(resultOf(m.seen, 2)[0].is_error, true);
});

test("make_qr: a picture of the page's address; refusals", async () => {
  const q = readQrInput({ page: "/menu" }, "https://shop.gofarther.app/");
  assert.equal(q.text, "https://shop.gofarther.app/menu");
  assert.match(q.src, /^data:image\/svg\+xml;base64,/);
  assert.match(Buffer.from(q.src.split(",")[1], "base64").toString(), /<svg/);
  assert.ok(readQrInput({ page: "menu" }, "https://a.b").error);
  assert.ok(readQrInput({ page: "/menu" }, "").error);
  assert.ok(readQrInput({}).error);
  const m = scripted([[{ name: "make_qr", input: { page: "/" } }]]);
  await runSiteAgent({ ...wired(), send: m.send }, { request: "qr", pages: PAGES, parts: PARTS });
  assert.match(resultOf(m.seen, 1)[0].content, /data:image\/svg\+xml;base64,/);
});

test("ask_owner: ends the run with the question; nothing queued is returned", async () => {
  assert.ok(readAskInput({ question: "Which?", options: ["A"] }).error);
  assert.ok(readAskInput({ question: "Which?", options: ["A", "B", "C", "D", "E"] }).error);
  assert.ok(readAskInput({ question: "", options: ["A", "B"] }).error);
  assert.ok(readAskInput({ question: "Which?", options: ["A", "a"] }).error);
  const m = scripted([[{ name: "set_site_settings", input: { name: "X" } }, { name: "ask_owner", input: { question: "Which page?", options: ["Home", "Menu"] } }]]);
  const r = await runSiteAgent({ ...wired(), send: m.send }, { request: "make it", pages: PAGES, parts: PARTS });
  assert.equal(r.ok, true);
  assert.deepEqual(r.ask, { text: "Which page?", options: ["Home", "Menu"] });
  assert.deepEqual(r.settings, {});
  assert.equal(m.seen.length, 1, "no round after the question");
});

test("a helper is refused the saving tools", async () => {
  const m = scripted([[{ name: "set_site_settings", input: { name: "X" } }, { name: "write_file", input: { file: "menu.tsx", source: "x" } }]]);
  const r = await runSiteAgent({ ...wired(), send: m.send }, { request: "x", pages: PAGES, parts: PARTS, onlyWrite: "menu.tsx", maxRounds: 2 });
  assert.equal(resultOf(m.seen, 1)[0].is_error, true);
  assert.deepEqual(r.settings, {});
});
