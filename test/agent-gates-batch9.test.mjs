// Carry-over batch 9 (2026-11-04, the owner: "fix 1,4,5,6,7,8,9,10,11,12,15"):
// removed entries brought back (M-27), split parts in order (M-61), database
// parts alone (M-31), entries keyed by content and lost answers not known
// (M-25, M-26), unstyled rules checked (M-49), translated wording kept (M-50),
// the old name (M-55), one language off (M-56), empty new lists (M-35, M-52),
// and reply facts whole (M-76).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent, readSplitWork } from "../builder/site-agent.mjs";
import { agentSaidTruth, droppedLanguages } from "../builder/agent-gates.mjs";
import { rowContentKey, writeAgentRows } from "../builder/agent-outcome.mjs";
import { splitParts } from "../builder/request.mjs";
import { agentSettingsPatch } from "../builder/agent-steps.mjs";
import { cutSaid, ONE_REPLY_MAX_TOKENS } from "../builder/one-reply.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const HOME = "export default function Home() {\n  return (\n    <main>\n      <h1>Market Lane</h1>\n      <p>Welcome to Market Lane.</p>\n    </main>\n  );\n}\n";
const PAGES = [{ path: "index.tsx", source: HOME }];
const SPEC = { tables: [{ name: "products", access: "display", columns: [{ name: "id" }, { name: "name" }] }] };
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });

async function drive(calls, { request = "change it", deps = {}, spec = SPEC } = {}) {
  const answers = [];
  let round = 0;
  const ag = await runSiteAgent({
    send: async (req) => {
      const last = req.messages[req.messages.length - 1];
      if (round > 0 && last && Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") answers.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
      const step = calls[round++] || [use("finish", { summary: "done" })];
      return { content: step, stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
    },
    build: async () => ({ ok: true }), canAsk: () => true, saveSettings: () => true, applySchema: () => true,
    ...deps,
  }, { request, pages: PAGES, parts: [], css: "", spec, model: "m", maxRounds: 12 });
  return { ag, answers };
}

test("M-27 removed entries are kept and offered back; the agent can list them (visitors' never)", async () => {
  const removedRows = async () => [{ table: "products", pk: "id", row: { id: 7, name: "Rye", created_at: "x" }, at: 0 }, { table: "orders", pk: "id", row: { id: 1, email: "a@b.c" }, at: 0 }];
  const spec = { tables: [...SPEC.tables, { name: "orders", access: "collect", columns: [{ name: "id" }, { name: "email" }] }] };
  const r = await drive([[use("removed_entries", {})]], { deps: { removedRows }, spec });
  assert.match(r.answers[0], /"table":"products".*"values":\{"name":"Rye"\}/);
  assert.doesNotMatch(r.answers[0], /a@b\.c/, "a visitor's entry is never shown");
  assert.match(agentSaidTruth("Removed Rye.", { removedRows: 1 }), /The removed entry is kept: ask and I'll bring it back\./);
  assert.match(W, /try \{ await keepRemovedRows\(env, slug, rowsOut\.done\); \}/);
});

test("M-61 a split part can wait for an earlier one; the engine reads it as needs", () => {
  const w = readSplitWork([{ instruction: "add a shop page", pages: ["/shop"] }, { instruction: "link /shop from the menu", pages: ["/"], after: [1] }]);
  assert.deepEqual(w.parts[1].after, [1]);
  assert.match(readSplitWork([{ instruction: "a", pages: ["/a"], after: [2] }, { instruction: "b", pages: ["/b"] }]).error, /EARLIER parts/);
  const rec = { parts: [{ n: 0, at: 0, source: "route", words: "m", needs: [] }] };
  const made = splitParts(rec, 0, w.parts);
  assert.equal(made.length, 2);
  assert.deepEqual(rec.parts[made[1]].needs, [made[0]]);
});

test("M-31 a split part that changes the database runs alone (no page targets: the whole site)", () => {
  const rec = { parts: [{ n: 0, at: 0, source: "route", words: "m", needs: [] }] };
  const made = splitParts(rec, 0, [{ instruction: "add a products table and list it on /shop", pages: ["/shop"], database: true }, { instruction: "about", pages: ["/about"] }]);
  assert.ok(!rec.parts[made[0]].targets, "no page targets: it counts as writing the whole site");
  assert.deepEqual(rec.parts[made[1]].targets.writes, ["page:/about"]);
});

test("M-25 entries are journaled by what they are: a re-run in another order skips the same entries and writes a different one", async () => {
  const meta = new Map(), written = [];
  const query = async (sql, params) => {
    if (/^SELECT v FROM _meta/.test(sql)) { const v = meta.get(params[0]); return v ? [{ v }] : []; }
    const k = params.find((x) => typeof x === "string" && x.startsWith("agent-row:"));
    written.push(params);
    if (typeof k === "string" && k.startsWith("agent-row:")) meta.set(k, JSON.stringify({ row: { ok: 1 } }));
    return [{ row: JSON.stringify({ ok: 1 }) }];
  };
  await writeAgentRows({ ops: [{ table: "products", pk: "id", add: [{ name: "A" }, { name: "B" }] }], query, key: "job12345678" });
  const n = written.length;
  const again = await writeAgentRows({ ops: [{ table: "products", pk: "id", add: [{ name: "B" }, { name: "C" }, { name: "A" }] }], query, key: "job12345678" });
  assert.equal(again.already, 2, "A and B were done already, whatever their order");
  assert.equal(written.length, n + 1, "only C is written");
  assert.notEqual(rowContentKey("job12345678", "t", { kind: "add", values: { a: 1 } }), rowContentKey("job12345678", "t", { kind: "add", values: { a: 2 } }));
  assert.equal(rowContentKey("job12345678", "t", { kind: "add", values: { a: 1, b: 2 } }), rowContentKey("job12345678", "t", { kind: "add", values: { b: 2, a: 1 } }));
});

test("M-26 a write whose answer was lost is told as not confirmed, never as failed", async () => {
  const query = async (sql) => { if (/^SELECT v FROM _meta/.test(sql)) return []; throw new Error("fetch failed: socket reset"); };
  const r = await writeAgentRows({ ops: [{ table: "products", pk: "id", add: [{ name: "A" }] }], query, key: "job12345678" });
  assert.equal(r.unknown, 1);
  assert.equal(r.failed, 0);
  assert.match(r.facts.join(" "), /could not be confirmed \(the database's answer was lost\): check them in Data/);
});

test("M-49 the agent's first save checks the style rules it wrote", () => {
  assert.match(W, /\.\.\.\(verify && r\.cssChanged && typeof r\.css === "string" \? \{ verifyCss: changedSelectors\(typeof css === "string" \? css : "", r\.css\) \} : \{\}\),/);
  assert.match(W, /out = await save\(ag, \{ verify: true \}\);/);
  assert.equal((W.match(/out = await save\(ag\);/g) || []).length, 1, "the retry's save checks nothing (one round)");
});

test("M-50 the owner's wording on a translated page is kept as that language's own", async () => {
  const translations = async (tag) => (tag === "es" ? { "Welcome to Market Lane.": "Bienvenido a Market Lane." } : null);
  const r = await drive([[use("change_translation", { lang: "es", from: "Bienvenido a Market Lane.", to: "Bienvenidos a Market Lane." })]], { deps: { translations } });
  assert.match(r.answers[0], /^Queued: the es wording/);
  assert.equal(r.ag.settings.langOverrides.es[0].said, "Bienvenidos a Market Lane.");
  const patch = agentSettingsPatch({ langOverrides: {} }, r.ag.settings);
  assert.equal(patch.langOverrides.es["Welcome to Market Lane."].said, "Bienvenidos a Market Lane.");
  const miss = await drive([[use("change_translation", { lang: "es", from: "Hola", to: "Adiós" })]], { deps: { translations } });
  assert.match(miss.answers[0], /is not on the site's es pages/);
});

test("M-55 a new site name with the old one still in a file holds the finish once; then the reply names it", async () => {
  const r = await drive([[use("set_site_settings", { name: "Lane Bakery" })], [use("finish", { summary: "Renamed." })], [use("finish", { summary: "Renamed." })]], { request: "rename the business to Lane Bakery", deps: { oldName: "Market Lane" } });
  assert.equal(r.answers.filter((a) => /still say “Market Lane”/.test(a)).length, 1);
  assert.deepEqual(r.ag.oldNameLeft, ["index.tsx"]);
  assert.match(agentSaidTruth("Renamed.", { oldName: r.ag.oldNameLeft }), /Your old name is still on the home page\./);
});

test("M-56 a language list that drops one the owner did not name is refused", async () => {
  const r = await drive([[use("set_languages", { langs: [] })], [use("set_languages", { langs: ["fr"] })]], { request: "take spanish off", deps: { currentLangs: ["es", "fr"] } });
  assert.match(r.answers[0], /NOT QUEUED: this list would also take off French \(fr\)/);
  assert.match(r.answers[1], /^Queued/);
  assert.deepEqual(droppedLanguages(["es"], [], "remove es").unnamed, []);
});

test("M-35 M-52 a new list a page shows with no entries holds the finish once; then the reply says it starts empty", async () => {
  const page = HOME.replace("<p>", '<List table="classes" /><p>');
  const r = await drive([[use("change_schema", { table: "classes", create: { columns: [{ name: "title", type: "text" }], access: "public" } })], [use("read_files", { files: ["index.tsx"] })], [use("write_file", { file: "index.tsx", source: page })], [use("build", {})], [use("finish", { summary: "Added classes." })], [use("finish", { summary: "Added classes." })]], { request: "list our classes on the home page\nThey answered: Yes, go ahead" });
  assert.equal(r.answers.filter((a) => /has no entries, so the page will show an empty list/.test(a)).length, 1, r.answers.join(" | "));
  assert.deepEqual(r.ag.emptyLists, ["classes"]);
  assert.match(agentSaidTruth("Added.", { emptyLists: ["classes"] }), /The classes list starts empty/);
});

test("M-76 the reply writer gets words whole up to generous bounds, a cut marked", () => {
  assert.equal(cutSaid("abc", 5), "abc");
  assert.equal(cutSaid("abcdef", 3), "abc… [cut]");
  assert.equal(ONE_REPLY_MAX_TOKENS, 1200);
  const O = readFileSync(new URL("../builder/one-reply.mjs", import.meta.url), "utf8");
  assert.match(O, /"THEIR MESSAGE:\\n" \+ cutSaid\(String\(message \|\| ""\), 12000\)/);
  assert.match(O, /asked: cutSaid\(String\(p\.words \|\| ""\), 2000\)/);
});
