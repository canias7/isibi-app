// FIX-ALL (2026-10-30): the router-era behaviours the site agent had lost,
// each driven through the real edit route (`worker.fetch` / the queue
// consumer) with supplied model answers, plus the plain modules' own cases.
// Properties, not spellings (docs/traps.md): what was saved, charged, written
// to the database and told, read from the stores and the stored reply.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { drive, fakeDb, use, page, HOME, HOME_NEW, USER } from "./fixtures/agent-fixall-route.mjs";
import { runSiteAgent, sendStoppable, CREDIT_CHECK_EVERY, UNREADABLE_TABLES, tableKey, toolsFor } from "../builder/site-agent.mjs";
import { writeAgentRows, undoRows, rowStatement, outcomeFacts, keyFacts, pickMedia } from "../builder/agent-outcome.mjs";

// THE AGENT TAKES THE MESSAGE HERE, as in site-agent-route.test.mjs.
delete process.env.GF_OLD_LANES;
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const between = (a, b) => { const i = W.indexOf(a); assert.ok(i > 0, "landmark " + a); const j = W.indexOf(b, i + a.length); assert.ok(j > i, "landmark " + b); return W.slice(i, j); };
const AGENT_FN = () => between("async function runAgentChange(", "async function recompileAndPublish(env, {");

/** Every tool result the agent was handed, in order, as text. */
const results = (seen) => seen.agent.flatMap((a) => {
  const last = a.messages[a.messages.length - 1];
  return Array.isArray(last.content) ? last.content.filter((b) => b && b.type === "tool_result").map((b) => String(b.content)) : [];
}).filter((x, i, all) => all.indexOf(x) === i);
const firstText = (seen) => seen.agent[0].messages[0].content.map((b) => b.text || "").join("\n");

// A plain Neon-shaped query over `fakeDb`, for the modules' own cases.
const queryOf = (db) => async (sql, params) => {
  let n = 0;
  const pg = String(sql).replace(/\?/g, () => "$" + (++n));
  const r = await db.answer(pg, params || []);
  const j = await r.json();
  if (r.status !== 200) { const e = new Error(j.message); e.code = j.code; throw e; }
  return j.rows.map((row) => Object.fromEntries(j.fields.map((f, i) => [f.name, row[i]])));
};

const LOAVES = { tables: [{ name: "loaves", columns: [{ name: "code", type: "text", pk: true }, { name: "name", type: "text" }, { name: "price", type: "text" }] }] };
const loavesDb = (extra = {}) => fakeDb({ spec: LOAVES, rows: { loaves: [{ code: "rye", name: "Rye", price: "5" }, { code: "sour", name: "Sourdough", price: "6" }] }, ...extra });
const HOME_ROWS = page("/", "<h1>Harbour Loaf</h1>{useRows(\"loaves\").map((l) => <p key={l.code}>{l.name}</p>)}");
const MENU_ROWS = page("/menu", "<h1>Menu</h1>{useRows(\"loaves\").map((l) => <p key={l.code}>{l.name} {l.price}</p>)}");

// ── 1. STOP ──────────────────────────────────────────────────────────────────
test("FX1 stop: a Stop read between rounds ends the run; nothing saved, nothing charged, told cancelled", async () => {
  const r = await drive({ mode: "job", ask: "Change the opening hours to 8am to 5pm.", cancelAfter: 1, rounds: [
    [use("write_file", { file: "index.tsx", source: HOME_NEW })],
    [use("build", {})],
    [use("finish", { summary: "Changed the hours." })],
  ] });
  assert.equal(r.status, 410, JSON.stringify(r.reply));
  assert.equal(r.reply.cancelled, true);
  assert.equal(r.reply.cost, 0);
  assert.equal(r.home, HOME, "the site is untouched");
  assert.equal(r.seen.agent.length, 1, "no model call after the Stop");
  assert.deepEqual(r.reserves, [], "nothing reserved for the agent's work");
});

test("FX1b stop: a model call in flight is abandoned and its transport aborted", async () => {
  let signal = null, stop = false;
  const deps = { send: (req, opts) => { signal = opts && opts.signal; setTimeout(() => { stop = true; }, 20); return new Promise(() => {}); }, stopped: () => stop };
  const t0 = Date.now();
  await assert.rejects(sendStoppable(deps, { messages: [] }), (e) => e.name === "AgentStopped");
  assert.ok(signal && signal.aborted, "the transport's signal was aborted");
  assert.ok(Date.now() - t0 < 5000);
  const r = await runSiteAgent({ send: async () => { throw new Error("never"); }, build: async () => ({ ok: true }), stopped: async () => true }, { request: "r", pages: [{ path: "index.tsx", source: HOME }] });
  assert.equal(r.stopped, "cancelled");
  assert.equal(r.rounds, 0);
});

// ── 2. CREDITS ───────────────────────────────────────────────────────────────
test("FX2 credits: an empty balance stops before the first round, as the request flow's credit pause", async () => {
  const r = await drive({ ask: "Change the opening hours.", balance: 0, rounds: [[use("finish", { summary: "x" })]] });
  assert.equal(r.status, 402);
  assert.equal(r.reply.error, "unbilled");
  assert.equal(r.reply.detail, "insufficient", "the shape request.mjs pauses a part on");
  assert.equal(r.reply.cost, 0);
  assert.equal(r.seen.agent.length, 0, "no model call");
  assert.deepEqual(r.seen.debits, []);
});

test("FX2b credits: asked again every few rounds with the running total; a no stops the run", async () => {
  const asked = [];
  let n = 0;
  const r = await runSiteAgent({
    send: async () => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t" + (++n), name: "read_files", input: { files: ["index.tsx"] } }], usage: { input_tokens: 400000, output_tokens: 20000 } }),
    build: async () => ({ ok: true }),
    affords: async (c) => { asked.push(c); return asked.length < 2; },
  }, { request: "r", pages: [{ path: "index.tsx", source: HOME }], model: "claude-sonnet-4-5" });
  assert.equal(r.stopped, "no-credits");
  assert.equal(r.rounds, CREDIT_CHECK_EVERY);
  assert.equal(asked.length, 2);
  assert.ok(asked[1] > asked[0], "the running total grows: " + asked);
});

// ── 3. CHARGE ONLY AFTER THE SAVE LANDS ──────────────────────────────────────
const SAVE = [[use("write_file", { file: "index.tsx", source: HOME_NEW })], [use("build", {})], [use("finish", { summary: "Changed the hours." })]];
test("FX3 no job: a save that fails charges nothing", async () => {
  const r = await drive({ ask: "Change the hours.", failCompileFrom: 2, rounds: SAVE });
  assert.equal(r.reply.ok, false, JSON.stringify(r.reply));
  assert.equal(r.reply.cost, 0);
  assert.equal(r.seen.debits.reduce((a, b) => a + b, 0) - r.seen.credits.reduce((a, b) => a + b, 0), 0, "nothing kept: " + JSON.stringify([r.seen.debits, r.seen.credits]));
  assert.equal(r.home, HOME);
});
test("FX3b no job: a save that lands is charged once, after it", async () => {
  const r = await drive({ ask: "Change the hours.", rounds: SAVE });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.equal(r.home, HOME_NEW);
  assert.equal(r.seen.debits.filter((d) => d > 0).length, 1);
  assert.ok(r.reply.cost > 0);
});
test("FX3c every failure after a charge reports cost 0 and hands back what was taken (a job's end refunds its reserves)", () => {
  const fn = AGENT_FN();
  const from = fn.indexOf("const fail = async (status, body) =>");
  assert.ok(from > 0);
  assert.match(fn.slice(from, from + 400), /refund\(took\)[\s\S]*cost: 0/);
  const after = fn.slice(fn.indexOf("if (job) await charge();"), fn.indexOf("// THE SAVE LANDED"));
  assert.ok(after.length > 100);
  assert.doesNotMatch(after, /cost: took/, "no failure keeps the charge");
  const fails = after.match(/return fail\(/g) || [];
  assert.ok(fails.length >= 5, "schema, database, settings, stylesheet and compile failures: " + fails.length);
});

// ── 4. HONEST REPLIES ────────────────────────────────────────────────────────
test("FX4 the reply's facts come from what the save did; the agent's words are only its own", async () => {
  const r = await drive({ ask: "Change the hours.", rounds: [SAVE[0], SAVE[1], [use("finish", { summary: "Added a gallery page and changed the hours." })]] });
  assert.equal(r.reply.ok, true);
  const facts = r.reply.facts;
  assert.ok(Array.isArray(facts) && facts.length >= 2);
  assert.match(facts[0], /home page/);
  const own = facts.filter((f) => /gallery/i.test(f));
  assert.equal(own.length, 1);
  assert.match(own[0], /^In the agent's own words: /, "the claim is never stated as a fact");
  assert.ok(!r.pages.some((p) => /gallery/.test(p.path)));
});

// ── 5. TABLE WRITES ──────────────────────────────────────────────────────────
const ROWS = (extra = []) => [[use("change_rows", { table: "loaves", update: [{ id: "rye", set: { price: "7" } }] }), ...extra], [use("write_file", { file: "index.tsx", source: HOME_NEW })], [use("build", {})], [use("finish", { summary: "Rye is 7." })]];
test("FX5 rows: by the table's own key, before the publish, told from what the database answered", async () => {
  const db = loavesDb();
  const r = await drive({ ask: "Rye costs 7 now; change the hours.", db, rounds: ROWS() });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.equal(db.tables.get("loaves").find((x) => x.code === "rye").price, "7");
  assert.ok(r.reply.facts.some((f) => /loaves table: changed 1 entry/.test(f)), r.reply.facts.join(" | "));
  assert.ok([...db.meta.keys()].some((k) => /^agent-row:/.test(k)), "the write carries its journal key");
});
test("FX5b rows: a save that fails puts the entries back", async () => {
  const db = loavesDb();
  const r = await drive({ ask: "Rye costs 7 now; change the hours.", db, failCompileFrom: 2, rounds: ROWS() });
  assert.equal(r.reply.ok, false);
  assert.equal(db.tables.get("loaves").find((x) => x.code === "rye").price, "5", "put back");
  assert.match(r.reply.msg, /put back/);
  assert.equal([...db.meta.keys()].filter((k) => /^agent-row:/.test(k)).length, 0, "the journal key goes with it");
});
test("FX5c rows: the same job run again writes nothing twice (journal key)", async () => {
  const db = loavesDb();
  const q = queryOf(db);
  const ops = [{ table: "loaves", pk: "code", add: [{ name: "Spelt", price: "8" }], update: [], remove: ["sour"] }];
  const a = await writeAgentRows({ ops, query: q, key: "job-123456789" });
  assert.equal(a.done.length, 2);
  const b = await writeAgentRows({ ops, query: q, key: "job-123456789" });
  assert.equal(b.already, 2);
  assert.equal(db.tables.get("loaves").filter((x) => x.name === "Spelt").length, 1);
  const u = await undoRows({ done: b.done, query: q });
  assert.ok(u.ok);
  assert.deepEqual(db.tables.get("loaves").map((x) => x.code).sort(), ["rye", "sour"]);
  assert.match(rowStatement({ table: "loaves", pk: "code", kind: "remove", id: "x" }).sql, /WHERE "code" = \?/);
  assert.equal(tableKey(LOAVES.tables[0]), "code");
});

// ── 6. DATABASE AND REQUIREMENTS ─────────────────────────────────────────────
test("FX6 a site with no database is offered additions and gets one made before they apply; missing keys are facts", () => {
  const fn = AGENT_FN();
  assert.match(fn, /!conn && noDb && uid && neonConfigured\(env\) \? \{ applySchema: \(\) => true \}/);
  const prov = fn.indexOf("conn = await ensureSiteBackend(env, slug, uid"), apply = fn.indexOf("sr = await applyAgentSchema(env, slug, conn, schemaOps, job)");
  assert.ok(prov > 0 && apply > prov);
  const f = keyFacts([{ name: "server-pay", source: "export default async (req, site) => { const k = site.key(\"STRIPE_KEY\"); return new Response(k ? 'ok' : 'no'); }" }], []);
  assert.equal(f.length, 1);
  assert.match(f[0], /STRIPE_KEY, which is NOT set yet/);
  assert.deepEqual(keyFacts([{ name: "server-pay", source: "site.key(\"STRIPE_KEY\")" }], ["STRIPE_KEY"]), []);
});

// ── 7. CAN'T TELL IS NOT "NO TABLES" ─────────────────────────────────────────
test("FX7 tables that cannot be read are told as such, and no entry is changed on an assumption", async () => {
  const db = fakeDb({ spec: LOAVES, failAll: true });
  const r = await drive({ ask: "Rye costs 7 now.", db, rounds: [[use("change_rows", { table: "loaves", update: [{ id: "rye", set: { price: "7" } }] })], [use("finish", { summary: "Could not." })]] });
  assert.match(firstText(r.seen), /could not be read just now/);
  assert.doesNotMatch(firstText(r.seen), /has no tables/);
  const said = results(r.seen).join("\n");
  assert.ok(said.includes(UNREADABLE_TABLES), said);
  assert.doesNotMatch(said, /this site has no tables/);
});

// ── 8. SORT ──────────────────────────────────────────────────────────────────
test("FX8 sort_table orders the list on every page that reads it, checked against the columns", async () => {
  const db = loavesDb();
  const r = await drive({ ask: "List the loaves by price, dearest first.", db, pages: [{ path: "index.tsx", source: HOME_ROWS }, { path: "menu.tsx", source: MENU_ROWS }], rounds: [
    [use("sort_table", { table: "loaves", by: "spiciness" })],
    [use("sort_table", { table: "loaves", by: "price", direction: "desc" })],
    [use("build", {})], [use("finish", { summary: "Sorted." })],
  ] });
  const said = results(r.seen).join("\n");
  assert.match(said, /loaves has nothing called spiciness/);
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  for (const p of r.pages) assert.match(p.source, /useRows\("loaves", \{ order: "price", dir: "desc" \}\)/, p.path);
  assert.ok(r.reply.facts.some((f) => /ordered by price \(descending\) on 2 pages/.test(f)), r.reply.facts.join(" | "));
});

// ── 9. MEDIA ─────────────────────────────────────────────────────────────────
test("FX9 attach_media answers the hosted address of the owner's video; anything else is refused", async () => {
  const r = await drive({ ask: "Put my intro video on the home page.", media: ["intro.mp4", "logo.png"], rounds: [
    [use("attach_media", { upload: "logo.png" }), use("attach_media", { upload: "intro.mp4" })],
    [use("finish", { summary: "Found it." })],
  ] });
  const said = results(r.seen).join("\n");
  assert.match(said, /not one of the owner's uploaded videos or recordings/);
  assert.ok(said.includes("/u/" + r.slug + "/intro.mp4"), said);
  assert.deepEqual(pickMedia([{ kind: "audio", name: "a.mp3", url: "/u/s/a.mp3" }], "a.mp3").url, "/u/s/a.mp3");
});

// ── 10. PROGRESS ─────────────────────────────────────────────────────────────
test("FX10 progress is recorded whenever the job keeps a record, not only with the talk on", () => {
  const fn = AGENT_FN();
  assert.match(fn, /const talk = !!\(job && job\.progress && typeof job\.progress\.mark === "function"\);/);
  assert.doesNotMatch(fn, /job\.progress\.talk/);
  assert.match(fn, /job\.progress\.mark\("applied", facts/);
});

// ── 11. THE SITE'S ADDRESS ───────────────────────────────────────────────────
test("FX11 rename_site: checked when asked, the alias rows written only after the save landed", async () => {
  const ok = await drive({ ask: "Move the site to sunset-loaf and change the hours.", rounds: [[use("rename_site", { to: "sunset-loaf" })], ...SAVE] });
  assert.equal(ok.reply.ok, true, JSON.stringify(ok.reply));
  const posts = ok.seen.aliases.filter((a) => a.method === "POST");
  assert.equal(posts.length, 2, "the old name demoted, the new one promoted");
  assert.ok(posts.some((p) => p.body.alias === "sunset-loaf" && p.body.current === true), JSON.stringify(posts));
  assert.ok(ok.reply.facts.some((f) => /sunset-loaf/.test(f) && /old address still works/.test(f)));
  const bad = await drive({ ask: "Move the site and change the hours.", failCompileFrom: 2, rounds: [[use("rename_site", { to: "sunset-loaf" })], ...SAVE] });
  assert.equal(bad.reply.ok, false);
  assert.equal(bad.seen.aliases.filter((a) => a.method !== "GET").length, 0, "nothing moved for a failed save");
});
test("FX11b forget_old_address: never the current address, never another site's", async () => {
  const r = await drive({ ask: "Forget the old addresses.", aliases: { "old-loaf": { slug: "someone-else", current: false } }, rounds: [
    [use("forget_old_address", { name: "old-loaf" })], [use("finish", { summary: "x" })],
  ] });
  assert.match(results(r.seen).join("\n"), /not one of this site.s old addresses/);
  assert.equal(r.seen.aliases.filter((a) => a.method === "DELETE").length, 0);
});

test("FX12 the new tools are offered only where wired", () => {
  const names = toolsFor({}).map((t) => t.name);
  for (const n of ["sort_table", "attach_media", "rename_site", "forget_old_address"]) assert.ok(!names.includes(n), n);
  const all = toolsFor({ sortTables: () => true, media: () => ({}), address: () => ({}) }).map((t) => t.name);
  for (const n of ["sort_table", "attach_media", "rename_site", "forget_old_address"]) assert.ok(all.includes(n), n);
  assert.ok(outcomeFacts({ summary: "s" }).at(-1).startsWith("In the agent's own words"));
  void USER;
});
