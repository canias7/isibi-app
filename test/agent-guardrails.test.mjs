// THE SITE AGENT'S SIX GUARDRAILS (2026-10-30, `builder/agent-guard.mjs`),
// through the REAL edit route with the agent's (and the text rung's) answers
// SUPPLIED round by round, as `site-agent-route.test.mjs` drives it:
//   G1 nothing else changed: one check before finishing, on an unasked loss only
//   G2 only the part asked for: a scoped part's writes outside it are refused
//   G3 one automatic retry, then stop
//   G4 the version is named from the agent's own summary
//   G5 a `text` answer takes the cheap text rung, and falls back to the agent
//   G6 the undo facts
// ⚠ SUPPLIED-MODEL PROOF ONLY: nothing here says what a real model would answer.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { POINTER_KEY } from "../site-builds.mjs";
import { textItems } from "../builder/site-apply.mjs";
import { changeReport, reviewNote, scopeGuard, versionName, undoFacts, undoSentence, workspaceDiff, retryAfterStop } from "../builder/agent-guard.mjs";
import { readFileSync } from "node:fs";
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

delete process.env.GF_OLD_LANES;

const USER = { id: "u-guard-1", email: "owner@example.com" };
const hex = (n) => randomBytes(n).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const page = (route, inner) => "import { createFileRoute } from '@tanstack/react-router'\n" +
  "export const Route = createFileRoute('" + route + "')({ component: P })\nfunction P(){return <main>" + inner + "</main>}\n";
const HOME = page("/", "<h1>Harbour Loaf</h1><p>Open 7am to 4pm.</p><a href=\"/menu\">See the menu</a>");
const MENU = page("/menu", "<h1>Menu</h1><p>Sourdough</p>");
const CSS = ":root{--brand:#123}";
const ROUND = { input_tokens: 3000, output_tokens: 800, cache_read_input_tokens: 9000 };
const PREV = "01790468089054-8btpep";

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: MENU }])],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf" }, css: CSS })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

const use = (name, input) => ({ type: "tool_use", id: "t" + hex(3), name, input });
const say = (text) => ({ type: "text", text });

async function drive({ ask, rounds, body = {}, text = null, pointer = false }) {
  const slug = "guard-" + hex(4);
  const b = bucket(slug);
  if (pointer) b.store.set(POINTER_KEY(slug), JSON.stringify({ version: PREV, build: "" }));
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const reqBody = JSON.stringify({ layer: "page", instruction: ask, picker: "sonnet", idem: "idem" + hex(8), ...body });
  const seen = { agent: [], text: 0, debits: [] };
  let n = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(500);
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.includes("/v1/messages") || u.includes("/chat/completions") || u.includes("x.ai")) {
      const tools = Array.isArray(args.tools) ? args.tools.map((t) => t.name || (t.function && t.function.name)) : [];
      if (tools.includes("finish")) {
        seen.agent.push(args);
        const r = rounds[Math.min(n++, rounds.length - 1)];
        return json({ stop_reason: r.some((x) => x.type === "tool_use") ? "tool_use" : "end_turn", content: r, usage: ROUND });
      }
      if (tools.includes("write_text_edits")) { seen.text++; return text ? json(text) : new Response("down", { status: 503 }); }
      return new Response("no stub", { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: reqBody }), env, ctx);
    const reply = await res.json().catch(() => null);
    await Promise.allSettled(ctx.pending);
    const pages = JSON.parse(b.store.get("source/" + slug + "/pages.json"));
    const all = [...b.store.values()].join("\n");
    return { status: res.status, reply, seen, store: b.store, all, home: pages.find((p) => p.path === "index.tsx").source, menu: (pages.find((p) => p.path === "menu.tsx") || {}).source, compiles: c.calls.length };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}

const sentBack = (r) => r.seen.agent.some((a) => JSON.stringify(a.messages).includes("BEFORE YOU FINISH"));

// ── G1 ─────────────────────────────────────────────────────────────────────
test("G1a an unasked removal (the hours and the menu link) is sent back once; the agent puts them back and the save keeps them", async () => {
  const LOSSY = page("/", "<h1>Harbour Bread</h1>");
  const FIXED = HOME.replace("Harbour Loaf", "Harbour Bread");
  const r = await drive({ ask: "Rename the heading to Harbour Bread.", rounds: [
    [use("write_file", { file: "index.tsx", source: LOSSY })], [use("build", {})], [use("finish", { summary: "Renamed the heading." })],
    [use("write_file", { file: "index.tsx", source: FIXED })], [use("build", {})], [use("finish", { summary: "Renamed the heading." })],
  ] });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.ok(sentBack(r), "the agent was asked about what it took away");
  const note = JSON.stringify(r.seen.agent[3].messages);
  assert.match(note, /See the menu/, "the lost link is named");
  assert.match(note, /Open 7am to 4pm/, "the lost words are named");
  assert.equal(r.home, FIXED, "what was put back is what was saved");
  assert.equal(r.seen.agent.length, 6);
  assert.deepEqual(r.reply.preserved.unasked.filter((i) => i.kind !== "text"), [], "nothing unasked is left but the reworded heading");
});

test("G1b an asked removal is not sent back, and a broad request answers the check by finishing again", async () => {
  const NOLINK = HOME.replace("<a href=\"/menu\">See the menu</a>", "");
  const r = await drive({ ask: "Take the See the menu link off the home page.", rounds: [
    [use("write_file", { file: "index.tsx", source: NOLINK })], [use("build", {})], [use("finish", { summary: "Took the menu link off." })],
  ] });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.equal(sentBack(r), false, "an asked removal is never questioned");
  assert.equal(r.seen.agent.length, 3);
  assert.equal(r.home, NOLINK);
  const broad = await drive({ ask: "Redesign the home page completely.", rounds: [
    [use("write_file", { file: "index.tsx", source: page("/", "<h1>Harbour Loaf</h1>") })], [use("build", {})], [use("finish", { summary: "A new home page." })],
    [use("finish", { summary: "A new home page; the redesign replaces the old sections." })],
  ] });
  assert.equal(broad.reply.ok, true);
  assert.ok(sentBack(broad), "asked once");
  assert.equal(broad.seen.agent.length, 4, "and only once");
  assert.match(broad.reply.msg, /Also changed, not named in the request: .*See the menu/, "what it kept reaches the reply's facts");
});

// ── G2 ─────────────────────────────────────────────────────────────────────
test("G2 a part scoped to /menu: a write to the home page is refused with the reason; the menu page is saved", async () => {
  const MENU2 = MENU.replace("Sourdough", "Sourdough and rye");
  const r = await drive({ ask: "Add rye to the menu.", body: { layer: "page", scope: { pages: ["/menu"] } }, rounds: [
    [use("write_file", { file: "index.tsx", source: HOME.replace("Harbour Loaf", "X") }), use("write_file", { file: "menu.tsx", source: MENU2 }), use("write_file", { file: "styles.css", source: ":root{}" })],
    [use("build", {})], [use("finish", { summary: "Added rye to the menu." })],
  ] });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  const res = JSON.stringify(r.seen.agent[1].messages.at(-1));
  assert.match(res, /index\.tsx is outside it/);
  assert.match(res, /not the site's look/);
  assert.equal(r.home, HOME, "the page outside the part is untouched");
  assert.equal(r.menu, MENU2);
  const free = await drive({ ask: "Change both.", rounds: [
    [use("write_file", { file: "index.tsx", source: HOME.replace("Harbour Loaf", "Harbour Bread") })], [use("build", {})], [use("finish", { summary: "Renamed." })],
  ] });
  assert.match(free.home, /Harbour Bread/, "no scope: written anywhere, as before");
});

// ── G3 ─────────────────────────────────────────────────────────────────────
test("G3a a run that stops without finishing is run once more from the files it left, and that run's save lands", async () => {
  const NEW = HOME.replace("7am to 4pm", "8am to 5pm");
  const r = await drive({ ask: "Change the hours to 8am to 5pm.", rounds: [
    [use("write_file", { file: "index.tsx", source: NEW })], [say("Let me think.")],
    [use("build", {})], [use("finish", { summary: "Hours now 8am to 5pm." })],
  ] });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.equal(r.reply.agent.retried, "no-tool");
  assert.match(r.seen.agent[2].messages[0].content[0].text, /A FIRST ATTEMPT AT THIS DID NOT FINISH/);
  assert.equal(r.home, NEW, "the first run's file, saved by the second");
});

test("G3b the retry happens exactly once, then the customer is told and nothing is charged", async () => {
  const r = await drive({ ask: "Change the hours.", rounds: [[use("write_file", { file: "index.tsx", source: HOME.replace("7am", "9am") })], [say("hmm")]] });
  assert.equal(r.reply.ok, false);
  assert.equal(r.reply.error, "agent-stopped");
  assert.match(r.reply.msg, /tried twice/);
  assert.equal(r.seen.agent.length, 3, "first run two rounds, the retry one");
  assert.equal(r.home, HOME);
  assert.deepEqual(r.seen.debits, []);
});

// ── G4 ─────────────────────────────────────────────────────────────────────
test("G4 the version is named from the agent's summary, not the fixed label", async () => {
  const r = await drive({ ask: "Change the hours to 8am to 5pm.", rounds: [
    [use("write_file", { file: "index.tsx", source: HOME.replace("7am to 4pm", "8am to 5pm") })], [use("build", {})],
    [use("finish", { summary: "Opening hours now 8am to 5pm. Nothing else changed." })],
  ] });
  assert.equal(r.reply.ok, true);
  assert.equal(r.reply.version, "Opening hours now 8am to 5pm");
  assert.ok(r.all.includes("Opening hours now 8am to 5pm"), "the stored version carries the name");
  assert.ok(!r.all.includes("Changed by the site agent"));
});

// ── G5 ─────────────────────────────────────────────────────────────────────
test("G5a a `text` answer takes the cheap text rung: one quick call, no agent", async () => {
  const items = textItems([{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: MENU }]);
  const id = items.findIndex((i) => i.text === "Open 7am to 4pm.");
  assert.ok(id >= 0);
  const r = await drive({ ask: "Change the hours to Open 8am to 5pm.", body: { layer: "text" }, rounds: [[use("finish", { summary: "x" })]],
    text: { stop_reason: "tool_use", content: [use("write_text_edits", { edits: [{ id, to: "Open 8am to 5pm." }] })], usage: { input_tokens: 900, output_tokens: 40 } } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.equal(r.reply.layer, "text");
  assert.equal(r.reply.cheap, true);
  assert.equal(r.seen.text, 1);
  assert.equal(r.seen.agent.length, 0, "the agent never ran");
  assert.match(r.home, /Open 8am to 5pm\./);
  assert.equal(r.menu, MENU);
});

test("G5b when the text rung fails, the agent takes the message", async () => {
  const NEW = HOME.replace("7am to 4pm", "8am to 5pm");
  const r = await drive({ ask: "Change the hours to 8am to 5pm.", body: { layer: "text" }, rounds: [
    [use("write_file", { file: "index.tsx", source: NEW })], [use("build", {})], [use("finish", { summary: "Hours now 8am to 5pm." })],
  ] });
  assert.ok(r.seen.text >= 1, "the cheap rung was tried");
  assert.equal(r.reply.layer, "agent");
  assert.equal(r.reply.ok, true);
  assert.equal(r.home, NEW);
});

// ── G6 ─────────────────────────────────────────────────────────────────────
test("G6 a removed page and a photograph taken off reach the reply as undo facts, with the version before", async () => {
  const HOME_PIC = HOME.replace("<p>", "<img src=\"/a.jpg\" alt=\"loaf\" /><p>");
  const r0 = changeReport({ pages: [{ path: "index.tsx", source: HOME_PIC }] }, { pages: [{ path: "index.tsx", source: HOME }] }, "x");
  assert.ok(Array.isArray(r0.items));
  const r = await drive({ ask: "Remove the menu page and its link.", rounds: [
    [use("delete_file", { file: "menu.tsx" }), use("write_file", { file: "index.tsx", source: HOME.replace("<a href=\"/menu\">See the menu</a>", "") })],
    [use("build", {})], [use("finish", { summary: "Removed the menu page." })],
  ] });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(r.reply.undo.pagesRemoved, ["/menu"]);
  // the version before is read before the agent runs, and handed to the facts only when a save landed
  const fn = W.slice(W.indexOf("async function runAgentChange("), W.indexOf("async function recompileAndPublish(env, {"));
  const ptr = fn.indexOf("readPointer(buildDeps(env), slug)"), run = fn.indexOf("await runOnce(ask0, start)"); // the first run (combined 2026-10-30: the request carries the old steps' context); from the carry when one waits (2026-10-31)
  assert.ok(ptr > 0 && run > ptr);
  assert.match(fn, /undoFacts\(\{ before, after, version: out \? restoreTo : ""/);
  assert.match(undoSentence({ pagesRemoved: ["/menu"], restoreTo: PREV }), new RegExp("previous version \\(" + PREV + "\\)"));
  const u = undoFacts({ before: { pages: [{ path: "index.tsx", source: HOME_PIC }] }, after: { pages: [{ path: "index.tsx", source: HOME }] }, version: PREV, rowsRemoved: 2 });
  assert.deepEqual(u, { photosTakenOff: 1, rowsRemoved: 2, restoreTo: PREV });
});

// ── the pure parts ─────────────────────────────────────────────────────────
test("G7 the module: names, retries, diffs and the check's observers are alive", () => {
  assert.equal(versionName("Added a gallery page; linked it", "x"), "Added a gallery page");
  assert.equal(versionName("", "Change the hours"), "Change the hours");
  assert.equal(versionName("", ""), "Changed by the site agent");
  assert.ok(versionName("word ".repeat(40), "").length <= 60);
  assert.doesNotMatch(versionName("Stored key sk_live_abcdef1234567890 for payments", ""), /sk_live/);
  assert.equal(retryAfterStop("credits"), false);
  for (const s of ["rounds", "time", "no-tool", "too-long", "send"]) assert.equal(retryAfterStop(s), true);
  const d = workspaceDiff({ pages: [{ path: "a.tsx", source: "1" }, { path: "b.tsx", source: "2" }] }, { pages: [{ path: "a.tsx", source: "9" }] });
  assert.deepEqual(d, { changed: ["a.tsx", "b.tsx"], removed: ["b.tsx"], cssChanged: false });
  const rep = changeReport({ pages: [{ path: "index.tsx", source: HOME }] }, { pages: [{ path: "index.tsx", source: page("/", "<h1>Harbour Loaf</h1>") }] }, "make it calm");
  assert.ok(rep.items.length >= 3, "the observer saw the losses");
  assert.equal(rep.review, true);
  assert.match(reviewNote(rep), /See the menu/);
  // words alone taken away (the link and heading kept) are asked about; a one-for-one rewording is not
  const textOnly = changeReport({ pages: [{ path: "index.tsx", source: HOME }] }, { pages: [{ path: "index.tsx", source: HOME.replace("<p>Open 7am to 4pm.</p>", "") }] }, "make it calm");
  assert.equal(textOnly.review, true);
  assert.match(reviewNote(textOnly), /Open 7am to 4pm/);
  const reworded = changeReport({ pages: [{ path: "index.tsx", source: HOME }] }, { pages: [{ path: "index.tsx", source: HOME.replace("Open 7am to 4pm.", "Open early.") }] }, "make it calm");
  assert.equal(reworded.review, false);
  assert.equal(reviewNote(reworded), "");
  const g = scopeGuard({ pages: [{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: MENU }], routes: ["/menu"] });
  assert.equal(g("menu.tsx"), "");
  assert.notEqual(g("index.tsx"), "");
  assert.equal(scopeGuard({ pages: [], routes: null }), null);
});
