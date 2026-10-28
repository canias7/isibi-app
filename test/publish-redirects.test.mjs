// THE REDIRECT MAP A PUBLISH WRITES IS CARRIED FROM THE LAST ONE — driven
// through the real edit route and served by the real dispatcher.
//
// RUN 49 (2026-09-28) IS WHY. It removed fold-lane-bakery's gallery page
// exactly as asked, and `/gallery` then answered a plain-text 404 where the
// publish was meant to leave a 301 to the home page. `/the-starter`, which had
// 301'd to `/starter` since run 39 moved that page, answered the same 404.
//
// THE CAUSE IS ONE READ. `composePublish` diffs this publish's routes against
// the previous publish's manifest — read back out of the sidecar
// (`sitemeta/<slug>.json`) — and hands it to `mergeRedirects`, which reads
// `prev.routes` and `prev.redirects`. The sidecar stores those two lists as
// `routesCsv` and `redirectsCsv`. So the parsed sidecar carried neither field:
// no gone page ever got a redirect, and every redirect already stored was
// dropped by the next publish. Only an explicit move pair survived, and only
// until the publish after it. `manifestFromCsv` is the one reader of that
// shape; the serve path has asked it since 2026-08-22 and the publish did not.
//
// WHY THE GUARDS DID NOT SEE IT. `mergeRedirects` is tested with the objects it
// wants; `composePublish` is guarded by source reads saying the sidecar IS read
// and IS handed over — never what the handed-over value looks like; and the
// serve tests write the sidecar by hand. Nothing ran a publish and then served
// what it wrote. That is the whole of what this file does: every sidecar here
// was written by the real edit route, and every answer came out of the real
// dispatcher.
//
// Every model answer is SUPPLIED (the one page edit's writer is a stub) and the
// site's own script is a stand-in answering as the real one does — its routes
// read off the page source the platform stored, its not-found an HTML document
// with a 404 status, a missing file a plain 404, every answer stamped.
// Since 2026-10-28 the redirect a visitor gets is the site's own: the stand-in
// asks the template's real `siteRedirect` (lib/site-addresses.ts) on a 404,
// as `server.ts` does, over the sidecar the real publish wrote.
import test from "node:test";
import { tweakInput, asEdits } from "./fixtures/tweak-edits.mjs";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { siteRoutes } from "../site-seo.mjs";
import { POINTER_KEY } from "../site-builds.mjs";
import { loadTemplate } from "./fixtures/template-ts.mjs";

const { siteRedirect } = await loadTemplate("lib/site-addresses.ts");

const USER = { id: "u-redir-1", email: "owner@example.com" };

// ─────────────────────────────────────────────────────────────────────────────
// THE SITE: fold-lane-bakery's five routes before run 39, none linking to
// another, so a removal nothing refuses and a move nothing blocks.
// ─────────────────────────────────────────────────────────────────────────────

const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";
const WELCOME = "<section className=\"welcome\"><h2>Welcome in</h2><p>Bread from the harbour, every morning.</p></section>";
const HOURS = "<section className=\"hours\"><h2>Opening hours</h2><p>Open from 7am on weekdays.</p></section>";
const STORED = [
  { path: "index.tsx", source: page("/", WELCOME + HOURS) },
  { path: "gallery.tsx", source: page("/gallery", "<section className=\"grid\"><h2>From the ovens</h2><p>Loaves, buns and the odd pie.</p></section>") },
  { path: "order.tsx", source: page("/order", "<section className=\"order\"><h2>Order a loaf</h2><p>Collect from nine.</p></section>") },
  { path: "the-starter.tsx", source: page("/the-starter", "<section className=\"starter\"><h2>The starter</h2><p>Fed every morning.</p></section>") },
  { path: "visit.tsx", source: page("/visit", "<section className=\"map\"><h2>Find us</h2><p>Quay Street, by the lifeboat station.</p></section>") },
];
// THE PAGE EDIT THAT KEEPS EVERY ROUTE — run 49's menu message stands for any
// publish that removes no page: the two home sections swapped, a pure block
// move the cheap writer's own checks accept.
const block = (src, cls) => (src.match(new RegExp("<section className=\"" + cls + "\"[^>]*>.*?</section>")) || [])[0] || null;
const swapHome = (src) => {
  const x = block(src, "welcome"), y = block(src, "hours");
  return x && y ? src.replace(x, "\u0000").replace(y, x).replace("\u0000", y) : src;
};

const hex32 = () => randomBytes(16).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/**
 * AN R2 STAND-IN THE WHOLE LIFE OF THE SITE RUNS AGAINST: every publish, the
 * restore and every visitor read the same store. A real prefix listing (the
 * restore finds versions by it) and R2's conditional put — a failed `onlyIf`
 * answers null, `etagDoesNotMatch: "*"` is create-if-absent — so an
 * activation R2 would refuse is refused here too.
 */
function r2(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(STORED)],
    ["source/" + slug + "/parts.json", "[]"],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet" }, css: "" })],
  ]);
  const etags = new Map();
  let n = 0;
  const text = (v) => (typeof v === "string" ? v
    : new TextDecoder().decode(v instanceof ArrayBuffer ? new Uint8Array(v) : v));
  const obj = (k) => {
    if (!store.has(k)) return null;
    const v = store.get(k);
    return {
      key: k, etag: etags.get(k), httpMetadata: {}, body: v,
      text: async () => v, json: async () => JSON.parse(v),
      arrayBuffer: async () => new TextEncoder().encode(v).buffer,
      writeHttpMetadata() {},
    };
  };
  return {
    store,
    async get(k) { return obj(k); },
    async head(k) { return store.has(k) ? { key: k, etag: etags.get(k) } : null; },
    async put(k, v, opts = {}) {
      const c = (opts && opts.onlyIf) || {};
      const had = store.has(k);
      if (c.etagMatches != null && (!had || etags.get(k) !== String(c.etagMatches))) return null;
      if (c.etagDoesNotMatch != null && had && (String(c.etagDoesNotMatch) === "*" || etags.get(k) === String(c.etagDoesNotMatch))) return null;
      store.set(k, text(v));
      etags.set(k, "e" + (++n));
      return obj(k);
    },
    async delete(k) { for (const x of (Array.isArray(k) ? k : [k])) { store.delete(x); etags.delete(x); } },
    async list({ prefix = "" } = {}) {
      return { objects: [...store.keys()].filter((x) => x.startsWith(prefix)).sort().map((key) => ({ key, size: store.get(key).length })), truncated: false };
    },
  };
}

/**
 * THE SITE'S OWN SCRIPT, answering as the real one does. Its routes are read
 * off the page source the platform stored — the editable copy activation
 * writes — through `siteRoutes`, the one mapping the publish uses too, so the
 * script and the manifest cannot disagree about which pages exist. Every
 * answer is stamped with the live version, as `stamp()` stamps them.
 */
function script(b, slug) {
  return {
    get: () => ({
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        // THE LIVE BUILD AND VERSION, off the pointer activation moved before
        // the script went up — so the publish's own wait for its new build
        // (`confirmSiteWorker`) is answered at once, as a live script answers it.
        const ptr = await b.get(POINTER_KEY(slug));
        const cur = ptr ? JSON.parse(await ptr.text()) : {};
        const version = cur.version || "";
        const stamp = { "x-site-build": cur.build || "", "x-site-version": version };
        // A FILE the script does not have: its own plain 404, never HTML.
        if ((p.split("/").pop() || "").includes(".")) return new Response("Not found", { status: 404, headers: stamp });
        const pages = JSON.parse(await (await b.get("source/" + slug + "/pages.json")).text());
        const routes = siteRoutes(pages).routes;
        const html = { ...stamp, "content-type": "text/html; charset=utf-8", "x-site-data": "own" };
        const at = p.toLowerCase().replace(/\/+$/, "") || "/";
        if (routes.includes(at)) return new Response("<!doctype html><html><body><div id=\"root\">page " + at + "</div></body></html>", { status: 200, headers: html });
        // AN ADDRESS THE SITE DOES NOT HAVE: a moved or deleted page goes
        // where it went, answered by the site's OWN redirect reader over its
        // own live sidecar — the template's real `siteRedirect`, as
        // `server.ts` asks it on a 404 (2026-10-28: the site's own Worker; the
        // platform no longer adds redirects to a script's answer).
        const moved = await siteRedirect({ SITES: b }, new URL(req.url), slug);
        if (moved) { for (const [k, v] of Object.entries(stamp)) moved.headers.set(k, v); return moved; }
        // Otherwise the branded not-found, a whole document with a 404 status
        // — what the container harness measured the real script answering
        // (`site-build.mjs`, "an undeclared route").
        return new Response("<!doctype html><html><body><div id=\"root\">That page isn't here.</div></body></html>", { status: 404, headers: html });
      },
    }),
  };
}

/**
 * THE PLATFORM ROUND IT: Supabase's RPCs, the owner, the one stubbed writer,
 * the dispatch upload. Installed once for a whole case, because the visitor
 * requests go through the same Worker as the publishes.
 */
function platform(slug, seen) {
  let reserved = 0;
  return async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push(fn);
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": reserved += Number(args.p_cost); return json({ ok: true, charged: Number(args.p_cost), cost: reserved, billing: "reserved" });
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize": seen.finals.push(args); return json(args.p_ok ? { ok: true, billing: "finalized" } : { ok: false, error: "not-published" });
        case "edit_refund": return json({ ok: true, refunded: reserved, billing: "reserved" });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (u.includes("/rpc/use_credits")) return json(Number(args.cost) || 0);
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.calls.push(tool);
      if (tool === TWEAK_TOOL.name) {
        const content = String((args.messages && args.messages[0] && args.messages[0].content) || "");
        const at = content.indexOf("\n\nTHE FILE (");
        const rest = content.slice(at + "\n\nTHE FILE (".length);
        const src = rest.slice(rest.indexOf(")\n") + 2);
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: asEdits({ source: swapHome(src) }, src) }], usage: { input_tokens: 1000, output_tokens: 500 } });
      }
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
}

/** One message through the real edit route, on either money path, against THE SITE'S OWN store. */
async function edit(worker, env, slug, mode, routed, ask, seen) {
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({
    layer: "look", page: "", remove: false, rename: "", tab: false,
    ...routed, instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20),
  });
  const ctx = makeCtx();
  if (mode === "job") {
    const id = hex32();
    env.SITES_BUCKET.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret: hex32(), at: Date.now() })));
    const before = seen.finals.length;
    await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
    await Promise.allSettled(ctx.pending);
    const fin = seen.finals[before];
    assert.ok(fin, "the queued job never finalized");
    return { status: fin.p_result.status, reply: JSON.parse(fin.p_result.body) };
  }
  const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
  const reply = await res.json().catch(() => null);
  await Promise.allSettled(ctx.pending);
  return { status: res.status, reply };
}

/** A visitor's request, through the real dispatcher, on the site's own address. */
async function visit(worker, env, slug, path) {
  const res = await worker.fetch(new Request("https://" + slug + ".gofarther.app" + path), env, makeCtx());
  return { status: res.status, location: res.headers.get("location"), type: res.headers.get("content-type") || "", version: res.headers.get("x-site-version"), cache: res.headers.get("cache-control") || "", text: await res.text() };
}

/** The live sidecar's two lists, exactly as stored. */
async function sidecar(b, slug) {
  const o = await b.get("sitemeta/" + slug + ".json");
  const s = o ? JSON.parse(await o.text()) : {};
  return { routesCsv: s.routesCsv, redirectsCsv: s.redirectsCsv };
}

const live = async (b, slug) => JSON.parse(await (await b.get(POINTER_KEY(slug))).text()).version;

/**
 * THE SITE'S LIFE, run 39 and run 49 in order: the starter page moved, a page
 * edit that keeps every route, the gallery page removed. Answers the store,
 * the Worker and the version each publish went live at.
 */
async function lifeOfTheSite(mode) {
  const slug = "redir-" + mode + "-" + hex32().slice(0, 8);
  const b = r2(slug);
  const seen = { rpc: [], finals: [], calls: [] };
  const real = globalThis.fetch;
  globalThis.fetch = platform(slug, seen);
  const c = installCompiler();
  const worker = await loadWorker();
  const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv(), SITE_WORKERS: script(b, slug) };
  const versions = {};
  const done = () => { c.uninstall(); globalThis.fetch = real; };
  try {
    const moved = await edit(worker, env, slug, mode, { layer: "page", page: "/the-starter", rename: "/starter" }, "Move the starter page to /starter.", seen);
    assert.equal(moved.status, 200, "the move did not publish: " + JSON.stringify(moved.reply));
    versions.moved = await live(b, slug);
    const kept = await edit(worker, env, slug, mode, { layer: "page", page: "/" }, "On the home page put the opening hours above the welcome.", seen);
    assert.equal(kept.status, 200, "the page edit did not publish: " + JSON.stringify(kept.reply));
    assert.deepEqual(seen.calls, [TWEAK_TOOL.name], "the page edit was not the one supplied cheap writer");
    versions.kept = await live(b, slug);
    const removed = await edit(worker, env, slug, mode, { layer: "page", page: "/gallery", remove: true }, "Remove the gallery page.", seen);
    assert.equal(removed.status, 200, "the removal did not publish: " + JSON.stringify(removed.reply));
    assert.deepEqual(removed.reply.removed, ["gallery.tsx"], "the removal took something else");
    versions.removed = await live(b, slug);
    assert.ok(versions.moved < versions.kept && versions.kept < versions.removed, "three publishes did not go live in order: " + JSON.stringify(versions));
  } catch (e) { done(); throw e; }
  return { slug, b, worker, env, versions, seen, done };
}

for (const mode of ["sync", "job"]) {
  test("a publish carries the redirects the last one stored, and a removed page gets its own (" + mode + ")", async () => {
    const s = await lifeOfTheSite(mode);
    try {
      // THE SIDECAR EACH PUBLISH WROTE, read at each version's own staged state.
      const staged = async (v) => {
        const o = await s.b.get("builds/" + s.slug + "/" + v + "/state/sidecar.json");
        const j = JSON.parse(await o.text());
        return { routesCsv: j.routesCsv, redirectsCsv: j.redirectsCsv };
      };
      // THE MOVE'S OWN PUBLISH: the explicit pair, which worked before too.
      assert.deepEqual(await staged(s.versions.moved),
        { routesCsv: "/,/gallery,/order,/starter,/visit", redirectsCsv: "/the-starter=/starter" }, "the move's publish");
      // THE EDIT AFTER IT KEEPS EVERY ROUTE, AND THE MOVE'S REDIRECT WITH THEM.
      // Before the fix this read `redirectsCsv: ""` — the move forgotten by
      // the very next publish, which is what run 49's first message did.
      assert.deepEqual(await staged(s.versions.kept),
        { routesCsv: "/,/gallery,/order,/starter,/visit", redirectsCsv: "/the-starter=/starter" }, "the page edit dropped the move's redirect");
      // THE REMOVAL: the gone page to the home page, newest first, and the
      // move still there. Before the fix: `redirectsCsv: ""`.
      assert.deepEqual(await staged(s.versions.removed),
        { routesCsv: "/,/order,/starter,/visit", redirectsCsv: "/gallery=/,/the-starter=/starter" }, "the removal wrote no redirect");
      // …AND WHAT ACTIVATION PUT LIVE IS THAT SAME SIDECAR.
      assert.deepEqual(await sidecar(s.b, s.slug), await staged(s.versions.removed), "the live sidecar is not the removal's");
    } finally { s.done(); }
  });
}

// AUDIT A33-3 (2026-10-23): a previous sidecar that cannot be read made the
// publish write empty route and redirect lists over it, permanently.
for (const mode of ["sync", "job"]) {
  test("A33-3 a publish whose previous sidecar cannot be read is refused, and every stored redirect stays (" + mode + ")", async () => {
    const s = await lifeOfTheSite(mode);
    try {
      const before = await sidecar(s.b, s.slug);
      assert.equal(before.redirectsCsv, "/gallery=/,/the-starter=/starter", "the fixture's redirects are not stored");
      const V = await live(s.b, s.slug);
      const key = "sitemeta/" + s.slug + ".json";
      const get = s.b.get;
      let reads = 0;
      const refunds = s.seen.rpc.filter((f) => f === "edit_refund").length;
      // ONLY THE COMPOSE STEP'S READ OF THE PREVIOUS SIDECAR, found by its own
      // frame: other steps of a publish read the same key for other reasons.
      const fromCompose = () => /composePublish/.test(new Error().stack || "");
      s.b.get = async (k) => { if (k === key && fromCompose()) { reads++; throw new Error("gateway 502"); } return get(k); };
      const r = await edit(s.worker, s.env, s.slug, mode, { layer: "page", page: "/" }, "On the home page put the opening hours above the welcome.", s.seen);
      s.b.get = get;
      // A QUEUED JOB IS REFUNDED; THE SYNCHRONOUS ROUTE ANSWERS AS IT DOES FOR A STAGE THAT FAILED.
      if (mode === "job") assert.equal(s.seen.rpc.filter((f) => f === "edit_refund").length, refunds + 1, "the refused publish was not refunded: " + JSON.stringify(r.reply));
      assert.match(String(r.reply && r.reply.msg), /our build service/, JSON.stringify(r.reply));
      assert.ok(reads >= 2, "the sidecar was not read again before giving up: " + reads);
      assert.notEqual(r.status, 200, "the publish went through: " + JSON.stringify(r.reply));
      assert.equal(await live(s.b, s.slug), V, "a new version went live");
      assert.deepEqual(await sidecar(s.b, s.slug), before, "the stored redirects were overwritten");
      // CONTROL: one failed read, then a good one, publishes and keeps them.
      let once = 0;
      s.b.get = async (k) => { if (k === key && fromCompose() && !once++) throw new Error("gateway 502"); return get(k); };
      const ok = await edit(s.worker, s.env, s.slug, mode, { layer: "page", page: "/" }, "On the home page put the opening hours above the welcome.", s.seen);
      s.b.get = get;
      assert.equal(ok.status, 200, JSON.stringify(ok.reply));
      assert.equal((await sidecar(s.b, s.slug)).redirectsCsv, "/gallery=/,/the-starter=/starter");
    } finally { s.done(); }
  });
}

test("a visitor at the removed page's address is sent home, and nothing else changes", async () => {
  const s = await lifeOfTheSite("sync");
  try {
    const V = s.versions.removed;
    // THE ONE RUN 49 GOT WRONG. It answered a plain 404, `Not found` and no
    // version stamp — the dispatcher's own last resort after the script's
    // not-found and an empty redirect lookup, byte for byte what the live
    // site served. Before the fix this case reads exactly that.
    const g = await s.worker.fetch(new Request("https://" + s.slug + ".gofarther.app/gallery"), s.env, makeCtx());
    assert.equal(g.status, 301, "/gallery answered " + g.status + " " + (await g.text()).slice(0, 80));
    assert.equal(g.headers.get("location"), "https://" + s.slug + ".gofarther.app/");
    assert.equal(g.headers.get("cache-control"), "public, max-age=600", "a 301 with no lifetime is cached for ever — a restored page would stay unreachable");
    // THE QUERY STRING TRAVELS WITH IT, and a trailing slash is the same page.
    assert.equal((await visit(s.worker, s.env, s.slug, "/gallery?ref=menu&x=1")).location, "https://" + s.slug + ".gofarther.app/?ref=menu&x=1");
    assert.equal((await visit(s.worker, s.env, s.slug, "/gallery/")).location, "https://" + s.slug + ".gofarther.app/");
    // THE MOVE FROM TWO PUBLISHES AGO STILL LANDS ON ITS PAGE.
    const st = await visit(s.worker, s.env, s.slug, "/the-starter");
    assert.equal(st.status, 301, "/the-starter answered " + st.status);
    assert.equal(st.location, "https://" + s.slug + ".gofarther.app/starter");
    // THE SITE'S OWN PAGES ARE UNTOUCHED.
    for (const p of ["/", "/order", "/starter", "/visit"]) {
      const r = await visit(s.worker, s.env, s.slug, p);
      assert.equal(r.status, 200, p + " answered " + r.status);
      assert.equal(r.version, V, p + " was served by another version");
      assert.equal(r.location, null, p + " was redirected");
    }
    // AN ADDRESS THAT WAS NEVER A PAGE IS STILL A 404, with nowhere to go.
    const nope = await visit(s.worker, s.env, s.slug, "/nonexistent-page");
    assert.equal(nope.status, 404, "an address in no map became " + nope.status);
    assert.equal(nope.location, null);
    // A MISSING FILE IS STILL THE SCRIPT'S OWN PLAIN 404, never a redirect —
    // and the stamp says the script's answer was passed through untouched.
    for (const p of ["/assets/definitely-missing.js", "/gallery.png"]) {
      const miss = await visit(s.worker, s.env, s.slug, p);
      assert.equal(miss.status, 404, p + " answered " + miss.status);
      assert.equal(miss.location, null, p + " was redirected");
      assert.equal(miss.version, V, p + ": the script's own answer was not the one served");
      assert.equal(miss.text, "Not found", p + " was handed something other than the script's own 404");
    }
  } finally { s.done(); }
});

test("a restored page serves itself again, and the next publish keeps it that way", async () => {
  const s = await lifeOfTheSite("sync");
  try {
    // THE FREE RESTORE, through the real route, to the version before the
    // removal — the one run 49's recovery is pressed for.
    const res = await s.worker.fetch(new Request("https://gofarther.dev/api/site/" + s.slug + "/versions/restore", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify({ id: s.versions.kept }),
    }), s.env, makeCtx());
    const rb = await res.json().catch(() => null);
    assert.equal(res.status, 200, "the restore refused: " + JSON.stringify(rb));
    assert.equal(await live(s.b, s.slug), s.versions.kept, "the restore did not put the version back");
    // THE GALLERY IS A PAGE AGAIN, answered by the script, not a 301.
    const g = await visit(s.worker, s.env, s.slug, "/gallery");
    assert.equal(g.status, 200, "the restored page answered " + g.status + " → " + g.location);
    assert.equal(g.version, s.versions.kept);
    // THE RESTORED SIDECAR IS THE VERSION'S OWN: no redirect from a live page,
    // and the move from before it still there.
    assert.deepEqual(await sidecar(s.b, s.slug),
      { routesCsv: "/,/gallery,/order,/starter,/visit", redirectsCsv: "/the-starter=/starter" }, "the restore put back a different map");
    assert.equal((await visit(s.worker, s.env, s.slug, "/the-starter")).location, "https://" + s.slug + ".gofarther.app/starter");
    // AND A PUBLISH AFTER THE RESTORE diffs against the restored map, so the
    // page that came back is not redirected by it, and the move is still kept.
    const again = await edit(s.worker, s.env, s.slug, "sync", { layer: "page", page: "/" }, "On the home page put the opening hours above the welcome.", s.seen);
    assert.equal(again.status, 200, "the publish after the restore failed: " + JSON.stringify(again.reply));
    assert.deepEqual(await sidecar(s.b, s.slug),
      { routesCsv: "/,/gallery,/order,/starter,/visit", redirectsCsv: "/the-starter=/starter" }, "the publish after the restore changed the map");
    const g2 = await visit(s.worker, s.env, s.slug, "/gallery");
    assert.equal(g2.status, 200, "after the next publish the restored page answered " + g2.status);
  } finally { s.done(); }
});
