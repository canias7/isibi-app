// THE SIGNED-IN PROJECTS PAGE (2026-10-30): the "Your sites" cards.
//
// A read-only audit of the start screen found cards that shared one id (so
// opening or deleting one acted on another), a delete that answered 200 while
// the site's record survived (so the card came back), draft thumbnails lost on
// a re-render, blank white cards, and an in-flight list bringing a deleted
// site back. Each is driven here through the code that ships: `SiteList`
// itself, and the real Worker's `DELETE /api/site/<slug>` with Supabase's
// answers supplied.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

const require = createRequire(import.meta.url);
const SiteList = require("../public/site-list.js");
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

// ── 1. ONE CARD, ONE ID ─────────────────────────────────────────────────────

test("two server rows carrying the same chat are two cards with two ids", () => {
  const out = SiteList.merge([{ id: "site_1", slug: "bakery-1" }],
    [{ slug: "bakery-1", chat: "site_1" }, { slug: "bakery-2", chat: "site_1" }], true);
  assert.equal(out.length, 2, "both sites are drawn");
  const ids = out.map((s) => s.id);
  assert.equal(new Set(ids).size, 2, "two cards share one id: " + ids.join(", "));
  const bySlug = Object.fromEntries(out.map((s) => [s.slug, s.id]));
  assert.equal(bySlug["bakery-1"], "site_1", "the slug match keeps the local record");
  assert.equal(bySlug["bakery-2"], "srv_bakery-2", "the second row stands as itself");
});

test("the slug match wins even when the chat-only row is listed first", () => {
  const out = SiteList.merge([{ id: "site_1", slug: "bakery-1" }],
    [{ slug: "bakery-2", chat: "site_1" }, { slug: "bakery-1", chat: "site_1" }], true);
  const bySlug = Object.fromEntries(out.map((s) => [s.slug, s.id]));
  assert.equal(bySlug["bakery-1"], "site_1");
  assert.equal(bySlug["bakery-2"], "srv_bakery-2");
});

test("a slugless workspace is adopted by one row only, and not drawn again as in flight", () => {
  const out = SiteList.merge([{ id: "site_9", name: "Cafe" }],
    [{ slug: "cafe-1", chat: "site_9" }, { slug: "cafe-2", chat: "site_9" }], true);
  assert.deepEqual(out.map((s) => s.id).sort(), ["site_9", "srv_cafe-2"]);
});

test("a slug deleted this session is never drawn from a list read before the delete", () => {
  const gone = new Set(["bakery-1"]);
  const out = SiteList.merge([{ id: "site_1", slug: "bakery-1" }], [{ slug: "bakery-1" }, { slug: "cafe-1" }], true, gone);
  assert.deepEqual(out.map((s) => s.slug), ["cafe-1"]);
  // and offline (no server answer) the local record stays off the screen too
  assert.deepEqual(SiteList.merge([{ id: "site_1", slug: "bakery-1" }], null, false, gone), []);
  // the observer is alive: without the set the site is drawn
  assert.equal(SiteList.merge([{ id: "site_1", slug: "bakery-1" }], [{ slug: "bakery-1" }], true).length, 1);
});

// ── 3/4. THE THUMBNAIL ──────────────────────────────────────────────────────

test("cardThumb: a ready draft wins, not-ready falls back to live, nothing is `empty`", () => {
  const s = { slug: "b-1", url: "https://b-1.gofarther.app/", react: true };
  assert.deepEqual(SiteList.cardThumb(s, "https://d.example/", ""), { kind: "src", value: "https://d.example/" });
  assert.deepEqual(SiteList.cardThumb(s, "", ""), { kind: "src", value: s.url });
  assert.deepEqual(SiteList.cardThumb(s, undefined, ""), { kind: "src", value: s.url });
  assert.deepEqual(SiteList.cardThumb({ id: "x", html: "" }, "", "<p>hi</p>"), { kind: "srcdoc", value: "<p>hi</p>" });
  assert.deepEqual(SiteList.cardThumb({ id: "x" }, "", ""), { kind: "empty" });
});

/** Strip `//` comment lines, so a guard never passes on prose. */
const code = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");

test("every render applies a cached draft, and 'not ready' is never cached as final", () => {
  const c = code(CHAT);
  const at = c.indexOf("view.querySelectorAll('.st-card').forEach((card) => {");
  const end = c.indexOf("view.querySelectorAll('[data-sid]')", at);
  assert.ok(at > 0 && end > at, "the card loop moved; this guard checks nothing");
  const loop = c.slice(at, end);
  assert.match(loop, /SiteList\.cardThumb\(s, s\.slug \? cardThumbSeen\.get\(s\.slug\) : ''/, "the render does not read the cached draft");
  assert.doesNotMatch(loop, /!cardThumbSeen\.has\(s\.slug\)/, "a slug seen once is skipped on every later render");
  const f0 = c.indexOf("function cardThumbDraft(slug)");
  const f1 = c.indexOf("function siteAdopt(", f0);
  assert.ok(f0 > 0 && f1 > f0, "cardThumbDraft moved");
  const fn = c.slice(f0, f1);
  assert.match(fn, /if \(u\) cardThumbSeen\.set\(slug, u\)/, "an empty answer is cached as final");
  assert.doesNotMatch(fn, /cardThumbSeen\.set\(slug, ''\)/);
  assert.match(fn, /querySelectorAll\('#viewSites iframe\[data-thumb\]'\)/, "the answer is written into the frame that asked, which a re-render detached");
});

test("thumbnails run no scripts, and an unfinished card is a placeholder, not a blank frame", () => {
  const c = code(CHAT);
  const at = c.indexOf('<div class="st-grid-h">Your sites</div>');
  const end = c.indexOf('class="st-card-meta"', at);
  assert.ok(at > 0 && end > at);
  const card = c.slice(at, end);
  assert.match(card, /<iframe sandbox="" /);
  assert.doesNotMatch(card, /allow-scripts/);
  assert.match(card, /\.kind === 'empty'[^]*<span class="st-card-sub">Not finished<\/span>/, "an unfinished card still draws an empty frame");
});

// ── 7. THE DELETE BUTTON ────────────────────────────────────────────────────

test("the delete asks for an unfinished site too, finds its chat by slug, and remembers the slug", () => {
  const c = code(CHAT);
  const at = c.indexOf("view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {");
  const end = c.indexOf("\n  });", at);
  assert.ok(at > 0 && end > at, "the delete handler moved");
  const h = c.slice(at, end);
  assert.match(h, /if \(entry && !entry\.slug\) \{\s*if \(!\(await goConfirm\(/, "an unfinished site goes at one press");
  assert.doesNotMatch(h, /[^.\w]alert\(/, "the browser's alert is back in the delete");
  assert.match(h, /x\.slug === goneSlug\) : null\); if \(gone\) chatDelete\(gone\)/, "the chat is looked up by the card's id alone");
  assert.match(h, /sitesDeletedSlugs\.add\(goneSlug\)/, "a deleted slug can be drawn again by a stale list");
  assert.match(h, /dr\.status === 409/, "a refusal over running work reads as 'still live'");
});

// ── 2. THE SERVER'S DELETE ──────────────────────────────────────────────────

const UID = "11111111-2222-3333-4444-555555555555";
/**
 * Drive `DELETE /api/site/<slug>` through the real Worker, with Supabase's
 * answers supplied: `fail` names a table whose DELETE answers 503, `running`
 * how many open jobs the site has (`null`: the read fails).
 */
async function del(slug, { fail = "", running = 0 } = {}) {
  const worker = await loadWorker();
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input && input.url ? input.url : input);
    const method = String(init.method || (input && input.method) || "GET").toUpperCase();
    sent.push(method + " " + url);
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/auth/v1/user")) return json({ id: UID });
    if (url.includes("/rest/v1/edit_jobs")) {
      if (running === null) return json({ message: "down" }, 503);
      return json(Array.from({ length: running }, (_, i) => ({ id: "j" + i, state: "running" })));
    }
    if (method === "DELETE") {
      if (fail && url.includes("/rest/v1/" + fail + "?")) return json({ message: "unavailable" }, 503);
      return new Response(null, { status: 204 });
    }
    if (url.includes("/rest/v1/site_backends")) return json([{ uid: UID, chat: "" }]);
    if (url.includes("/rest/v1/")) return json([]);
    return new Response("{}", { status: 404 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug, { method: "DELETE", headers: { Authorization: "Bearer t" } }),
      { SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null), sent };
  } finally { globalThis.fetch = real; }
}
const deletes = (sent, table) => sent.filter((l) => l.startsWith("DELETE ") && l.includes("/rest/v1/" + table + "?"));

test("CONTROL: a delete whose rows all go answers 200", async () => {
  const r = await del("pp-ok-1");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(deletes(r.sent, "site_backends").length, 1);
});

test("a site_backends delete that fails is an error, not a 200, so the card stays to retry", async () => {
  const r = await del("pp-row-1", { fail: "site_backends" });
  assert.equal(deletes(r.sent, "site_backends").length, 1, "the row delete was never tried");
  assert.notEqual(r.status, 200);
  assert.equal(r.body && r.body.ok, false);
});

test("a site_project delete that fails is an error, and the ownership row is kept for the retry", async () => {
  const r = await del("pp-proj-1", { fail: "site_project" });
  assert.notEqual(r.status, 200);
  assert.equal(deletes(r.sent, "site_backends").length, 0, "the ownership row went, so the retry answers 404");
});

test("a running build or edit is refused before anything is torn down", async () => {
  const r = await del("pp-run-1", { running: 1 });
  assert.equal(r.status, 409);
  assert.equal(r.sent.filter((l) => l.startsWith("DELETE ")).length, 0, "something was deleted under a running job");
  const u = await del("pp-run-2", { running: null });
  assert.equal(u.status, 503, "a job count that cannot be read reads as nothing running");
  assert.equal(u.sent.filter((l) => l.startsWith("DELETE ")).length, 0);
});

// ── ROUND 2 (2026-10-30): A SHARED CHAT, AND A BUILD WITH NO JOB ROW ────────

const CHAT_ID = "site_shared_1";
/**
 * The same delete, with a bucket: `shared` is what the "another site of this
 * owner carries this chat" read answers (true / false / "fail"), and `mark` is
 * the build-running mark's age in ms (undefined: none; "bad": the read throws).
 */
async function delB(slug, { shared = false, mark, running = 0 } = {}) {
  const worker = await loadWorker();
  const sent = [];
  const objects = new Map([["chat/" + UID + "/" + CHAT_ID + ".json", "{}"]]);
  if (typeof mark === "number") objects.set("build-running/" + slug + ".json", JSON.stringify({ uid: UID, at: Date.now() - mark, token: "t" }));
  const bucket = {
    async get(k) {
      if (mark === "bad" && k.startsWith("build-running/")) throw new Error("r2 down");
      return objects.has(k) ? { text: async () => objects.get(k), json: async () => JSON.parse(objects.get(k)) } : null;
    },
    async put(k, v) { objects.set(k, String(v)); },
    async delete(k) { sent.push("R2DELETE " + k); objects.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return objects.has(k) ? {} : null; },
  };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input && input.url ? input.url : input);
    const method = String(init.method || (input && input.method) || "GET").toUpperCase();
    sent.push(method + " " + url);
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/auth/v1/user")) return json({ id: UID });
    if (url.includes("/rest/v1/edit_jobs")) return json(Array.from({ length: running }, (_, i) => ({ id: "j" + i, state: "running" })));
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (url.includes("/rest/v1/site_backends") && url.includes("slug=neq.")) {
      if (shared === "fail") return json({ message: "down" }, 503);
      if (shared === "garbled") return new Response("<html>", { status: 200 });
      return json(shared ? [{ slug: "other-1" }] : []);
    }
    if (url.includes("/rest/v1/site_backends")) return json([{ uid: UID, chat_id: CHAT_ID }]);
    if (url.includes("/rest/v1/")) return json([]);
    return new Response("{}", { status: 404 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug, { method: "DELETE", headers: { Authorization: "Bearer t" } }),
      { SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET: bucket }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null), sent, objects };
  } finally { globalThis.fetch = real; }
}
const chatKey = "chat/" + UID + "/" + CHAT_ID + ".json";

test("CONTROL: a chat no other site carries goes with its site", async () => {
  const r = await delB("pp-chat-1");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.sent.some((l) => l.includes("slug=neq.pp-chat-1")), "the sharing check never ran: " + r.sent.join("\n"));
  assert.equal(r.objects.has(chatKey), false, "the site's own chat survived");
});

test("a chat another of the owner's sites carries is kept", async () => {
  const r = await delB("pp-chat-2", { shared: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.objects.has(chatKey), true, "deleting one site wiped the other's conversation");
  assert.ok(!r.sent.includes("R2DELETE " + chatKey));
});

test("a sharing check that cannot be read keeps the chat", async () => {
  const r = await delB("pp-chat-3", { shared: "fail" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.objects.has(chatKey), true, "'cannot tell' read as 'no other site'");
  const g = await delB("pp-chat-4", { shared: "garbled" });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.objects.has(chatKey), true, "an unreadable answer read as 'no other site'");
});

test("a build running in a Worker (its mark, no job row) refuses the delete with the job refusal", async () => {
  const r = await delB("pp-mark-1", { mark: 60_000 });
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.match(r.body.error, /still being built or edited/);
  assert.equal(r.sent.filter((l) => l.startsWith("DELETE ") || l.startsWith("R2DELETE ")).length, 0, "something was torn down under a running build");
  assert.equal(r.objects.has(chatKey), true);
});

test("a stale mark (a build that died without clearing it) does not block the delete", async () => {
  const r = await delB("pp-mark-2", { mark: 31 * 60_000 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

test("a mark that cannot be read refuses with 503, not a delete", async () => {
  const r = await delB("pp-mark-3", { mark: "bad" });
  assert.equal(r.status, 503, JSON.stringify(r.body));
  assert.equal(r.sent.filter((l) => l.startsWith("DELETE ")).length, 0);
});

test("runSiteBuild writes the mark when its slug is decided and clears its own when it ends", () => {
  const W = code(fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8"));
  const at = W.indexOf("async function runSiteBuild(");
  const end = W.indexOf("\nasync function ", at + 10);
  assert.ok(at > 0 && end > at, "runSiteBuild moved");
  const fn = W.slice(at, end);
  assert.match(fn, /rec\.identify\(slug, bu\.id\);\s*if \(!\(env\.SITE_BUILD_CONTAINER && env\.SITE_BUILD_CONTAINER\.local === true\)\) bMark\.slug = slug;\s*if \(bMark\.slug\) await writeBuildMark\(env, slug, bu\.id, bMark\.token\);/);
  assert.match(fn, /\}\)\(\)\.finally\(\(\) => clearBuildMark\(env, bMark\.slug, bMark\.token\)\), bHeld\.parts\);/);
});
