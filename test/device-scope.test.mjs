// PER-DEVICE EDITS (owner, 2026-10-24).
//
// One site, never a phone copy. A change may be for some screen sizes only —
// phone, tablet, desktop, any subset, all three by default. The router decides
// which from the customer's words (the preview's device is a hint), the lanes
// are told, and the code checks: the page is measured at the three widths
// before and after, and a device not asked for must come out unchanged, or
// nothing is published.
//
// WHAT THIS ESTABLISHES, AND WHAT IT CANNOT. The route cases drive the real
// `POST /api/site/route` and `POST /api/site/<slug>/edit` with SUPPLIED model
// answers, built from what the router and the lanes are told to give, and a
// stubbed build service that answers the layout the way `build-server.mjs`
// does. The probe cases run the real fingerprint in a real Chromium. None of
// it shows which devices a real model picks, or a real kit page measured in
// the container: that is a paid press after a merge and a deploy.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pickTool, editTool } from "../builder/site-lanes.mjs";
import { ASK_TOOL, LIVE_ASK_TOOL, readRouting } from "../builder/site-ask.mjs";
import { VIEWPORTS } from "../builder/site-render.mjs";
import { editReplyFacts } from "../builder/site-reply.mjs";
import { newRequest, planParts, jobBody } from "../builder/request.mjs";
import {
  DEVICES, DEVICE_BANDS, deviceOfWidth, readDevices, readDeviceHint, deviceNote, compareLayouts, layoutProbe, readLayout, MAX_LAYOUT_ITEMS,
} from "../builder/device-scope.mjs";

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const hex32 = () => randomBytes(16).toString("hex");

// ─────────────────────────────────────────────────────────────────────────────
// ONE BREAKPOINT MAP, aligned with the kit, the render check and the preview.

test("the map: phone below 768, tablet 768–1023, desktop from 1024 — Tailwind's md and lg", () => {
  assert.deepEqual([...DEVICES], ["phone", "tablet", "desktop"]);
  assert.equal(deviceOfWidth(767), "phone");
  assert.equal(deviceOfWidth(768), "tablet");
  assert.equal(deviceOfWidth(1023), "tablet");
  assert.equal(deviceOfWidth(1024), "desktop");
  assert.equal(deviceOfWidth(-1), "");
  // The kit declares no breakpoints of its own, so Tailwind's defaults stand.
  const css = fs.readFileSync(new URL("../builder/lovable/template/src/styles.css", import.meta.url), "utf8");
  assert.ok(css.length > 0, "the kit's stylesheet was not read");
  assert.doesNotMatch(css, /--breakpoint-/, "the kit now declares its own breakpoints: the device map must follow them");
});

test("every width the render check and the preview use falls in its own band", () => {
  for (const vp of VIEWPORTS) assert.equal(deviceOfWidth(vp.width), vp.name, vp.name + " renders outside its band");
  for (const d of DEVICES) assert.equal(deviceOfWidth(DEVICE_BANDS[d].width), d);
  // The preview's frame widths, read from the stylesheet the page ships.
  const styles = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  for (const d of ["phone", "tablet"]) {
    const m = new RegExp('\\.st-stage\\[data-dev="' + d + '"\\] \\.st-frame \\{ width: (\\d+)px').exec(styles);
    assert.ok(m, "the preview's " + d + " width could not be found");
    assert.equal(deviceOfWidth(Number(m[1])), d, "the preview shows " + d + " at " + m[1] + "px, outside its band");
  }
  assert.equal(DEVICE_BANDS.tablet.width, 860, "the guard's tablet width is not the preview's");
});

test("a scope is a proper subset or nothing: all three, garbage and absence never narrow", () => {
  const marks = [];
  const mark = (r) => marks.push(r);
  assert.deepEqual(readDevices(["desktop", "phone"], mark), ["phone", "desktop"]);
  assert.equal(readDevices(["phone", "tablet", "desktop"], mark), null);
  assert.equal(readDevices(undefined, mark), null);
  assert.deepEqual(marks, []);
  assert.equal(readDevices("phone", mark), null);
  assert.equal(readDevices(["phone", "watch"], mark), null);
  assert.equal(readDevices([], mark), null);
  assert.deepEqual(marks, ["devices-unread", "devices-unread", "devices-unread"]);
  assert.equal(readDeviceHint("tablet"), "tablet");
  assert.equal(readDeviceHint("Tablet"), "");
  assert.equal(deviceNote(null), "");
  assert.equal(deviceNote(["phone", "tablet", "desktop"]), "");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE GUARD'S COMPARISON.

const L = (route, device, digest, n = 10) => ({ route, device, n, digest });
const BEFORE = [L("/", "phone", "p1"), L("/", "tablet", "t1"), L("/", "desktop", "d1"), L("/visit", "phone", "vp"), L("/visit", "tablet", "vt"), L("/visit", "desktop", "vd")];

test("the guard passes when only the asked-for device moved, and names it", () => {
  const after = BEFORE.map((x) => (x.device === "phone" && x.route === "/" ? { ...x, digest: "p2" } : x));
  assert.deepEqual(compareLayouts(BEFORE, after, ["phone"]), { ok: true, changed: [], unknown: [], touched: ["phone"], checked: true });
});

test("the guard refuses when a device not asked for moved, on any route", () => {
  const after = BEFORE.map((x) => (x.route === "/visit" && x.device === "desktop" ? { ...x, digest: "vd2" } : x.device === "phone" ? { ...x, digest: x.digest + "!" } : x));
  const v = compareLayouts(BEFORE, after, ["phone"]);
  assert.equal(v.ok, false);
  assert.deepEqual(v.changed, ["desktop"]);
  // The count is part of the fingerprint too.
  const fewer = BEFORE.map((x) => (x.device === "tablet" && x.route === "/" ? { ...x, n: 9 } : x));
  assert.deepEqual(compareLayouts(BEFORE, fewer, ["phone"]).changed, ["tablet"]);
});

test("cannot-tell is never unchanged: a missing before, route or device is unknown and refused", () => {
  assert.deepEqual(compareLayouts(null, BEFORE, ["phone"]).unknown, ["tablet", "desktop"]);
  assert.equal(compareLayouts(null, BEFORE, ["phone"]).ok, false);
  assert.deepEqual(compareLayouts(BEFORE, null, ["phone"]).unknown, ["tablet", "desktop"]);
  assert.deepEqual(compareLayouts([], [], ["phone"]).unknown, ["tablet", "desktop"]);
  const noTablet = BEFORE.filter((x) => !(x.route === "/visit" && x.device === "tablet"));
  assert.deepEqual(compareLayouts(BEFORE, noTablet, ["phone"]), { ok: false, changed: [], unknown: ["tablet"], touched: [], checked: true });
  assert.equal(readLayout([{ route: "/", device: "watch", n: 1, digest: "x" }, { route: "/", device: "phone", n: -1, digest: "x" }]), null);
});

test("an unscoped change is not checked at all", () => {
  assert.equal(compareLayouts(BEFORE, [], null).checked, false);
  assert.equal(compareLayouts(BEFORE, [], ["phone", "tablet", "desktop"]).ok, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE FINGERPRINT, IN A REAL CHROMIUM.

const PAGE = (extraCss, body) => "<!doctype html><html><head><style>body{margin:0;font:16px sans-serif} .hero{padding:40px;background:#eee} .hero h1{font-size:32px}" +
  " .grid{display:flex} .grid div{flex:1;padding:8px} " + extraCss + "</style></head><body>" + body + "</body></html>";
const BODY = "<header class=\"hero\"><h1>Fold Lane</h1><p>Bread every morning.</p></header><section class=\"grid\"><div>Loaves</div><div>Cakes</div></section><footer><p>Quay Street</p></footer>";

// THE BROWSER THE OTHER BROWSER CASES USE, skipped where there is none (CI).
const EXE = "/opt/pw-browsers/chromium";
const SKIP = !fs.existsSync(EXE) && "no browser here (Chromium is not installed)";

async function fingerprints(html) {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const out = {};
    for (const d of DEVICES) {
      const ctx = await browser.newContext({ viewport: { width: DEVICE_BANDS[d].width, height: DEVICE_BANDS[d].height }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.setContent(html, { waitUntil: "load" });
      out[d] = await page.evaluate(layoutProbe, MAX_LAYOUT_ITEMS);
      await ctx.close();
    }
    return out;
  } finally { await browser.close(); }
}
const changedAt = (a, b) => DEVICES.filter((d) => a[d].digest !== b[d].digest || a[d].n !== b[d].n);

test("probe: a phone-only change (size, order, hiding) moves the phone fingerprint alone", { skip: SKIP }, async () => {
  const before = await fingerprints(PAGE("", BODY));
  const again = await fingerprints(PAGE("", BODY));
  assert.deepEqual(changedAt(before, again), [], "the same page measured twice is not the same: the fingerprint is unstable");
  assert.ok(before.desktop.n >= 6, "the probe saw almost nothing on the page");
  const phoneOnly = "@media (max-width: 767px){ .hero h1{font-size:22px} .grid{flex-direction:column-reverse} footer{display:none} }";
  assert.deepEqual(changedAt(before, await fingerprints(PAGE(phoneOnly, BODY))), ["phone"]);
  const tabletOnly = "@media (min-width: 768px) and (max-width: 1023px){ .hero{padding:12px} }";
  assert.deepEqual(changedAt(before, await fingerprints(PAGE(tabletOnly, BODY))), ["tablet"]);
});

test("probe: a wrapper that shows nothing is not a change; an unscoped rule changes every width", { skip: SKIP }, async () => {
  const before = await fingerprints(PAGE("", BODY));
  // A page writer that wraps a block for a breakpoint adds an element at every
  // width while nothing a visitor sees moved.
  const wrapped = BODY.replace("<section class=\"grid\">", "<div class=\"wrap\"><section class=\"grid\">").replace("</section>", "</section></div>");
  assert.deepEqual(changedAt(before, await fingerprints(PAGE("", wrapped))), []);
  // A duplicated block shown at one width only, hidden at the others.
  const dup = BODY + "<p class=\"only-phone\">Call us</p>";
  assert.deepEqual(changedAt(before, await fingerprints(PAGE(".only-phone{display:none} @media (max-width: 767px){ .only-phone{display:block} }", dup))), ["phone"]);
  // Not scoped: every device moves, which is what the guard catches.
  assert.deepEqual(changedAt(before, await fingerprints(PAGE(".hero h1{color:#014421}", BODY))), ["phone", "tablet", "desktop"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// THROUGH THE REAL ROUTING ROUTE.

const OWNER = { id: "66666666-6666-6666-6666-666666666666", email: "owner@example.com" };

async function route(answer, extra = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const router = [];
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return json(OWNER);
    if (u.includes("/rpc/get_credits")) return json(50);
    if (u.includes("/rpc/use_credits")) return json(1);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.startsWith("https://api.anthropic.com/")) {
      router.push(JSON.parse(String((init && init.body) || "{}")));
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: ASK_TOOL.name, input: answer }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const message = "Make the headline smaller on phones only.";
    const site = { name: "device-scope", url: "https://device-scope.gofarther.app", pages: ["/", "/visit"], tables: [] };
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ message, site, picker: "sonnet", firstBuild: false, brief: message, qa: [], answering: false, attached: false, slug: "device-scope", hasSite: true, ...extra }),
    }), { ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: JSON.parse(await res.text()), router };
  } finally {
    globalThis.fetch = real;
  }
}

test("the router is sent the devices field and the preview's device as a hint", async () => {
  const r = await route({ intent: "edit", layer: "look" }, { device: "tablet" });
  assert.equal(r.status, 200);
  assert.equal(r.router.length, 1);
  const tool = (r.router[0].tools || []).find((t) => t && t.name === ASK_TOOL.name);
  assert.ok(tool && tool.input_schema.properties.devices, "the routing tool sent has no devices field");
  assert.deepEqual(tool.input_schema.properties.devices.items.enum, [...DEVICES]);
  assert.match(String(r.router[0].messages[0].content), /They are previewing the site on the tablet view\./);
  // No hint sent, none said; and a first build's tool is unchanged.
  const bare = await route({ intent: "edit", layer: "look" });
  assert.doesNotMatch(String(bare.router[0].messages[0].content), /previewing the site on/);
  const odd = await route({ intent: "edit", layer: "look" }, { device: "watch" });
  assert.doesNotMatch(String(odd.router[0].messages[0].content), /previewing the site on/);
  assert.ok(!ASK_TOOL.input_schema.properties.devices && LIVE_ASK_TOOL.input_schema.properties.devices);
});

test("the router's devices reach the page: a subset kept, all three and garbage dropped", async () => {
  const one = await route({ intent: "edit", layer: "look", devices: ["phone"] }, { device: "desktop" });
  assert.deepEqual(one.body.devices, ["phone"], "the route dropped the devices the router chose");
  assert.equal(one.body.layer, "look");
  const all = await route({ intent: "edit", layer: "look", devices: ["desktop", "tablet", "phone"] });
  assert.equal(all.body.devices, undefined);
  const bad = await route({ intent: "edit", layer: "look", devices: "phone" });
  assert.equal(bad.body.devices, undefined);
  assert.ok(JSON.stringify(bad.body.decision || {}).includes("devices-unread"), "an unreadable scope left no reason");
  // Never on an addition, a question or a build.
  const add = await route({ intent: "addon", devices: ["phone"] });
  assert.equal(add.body.devices, undefined);
  // And the reader agrees with the route.
  assert.deepEqual(readRouting({ content: [{ type: "tool_use", input: { intent: "edit", layer: "look", devices: ["tablet", "phone"] } }] }, { live: true, hasSite: true, pages: ["/"] }).devices, ["phone", "tablet"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// THROUGH THE REAL EDIT ROUTE: the css lane told, the publish guarded.

const T = { pick: pickTool().name, lane: editTool("css").name };
const USER = { id: "u-device-1", email: "owner@example.com" };
const pageSrc = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('" + route + "')({ component: Page })\nfunction Page(){ return <main>" + body + "</main> }\n";
const STORED = [
  { path: "index.tsx", source: pageSrc("/", "<section><h1>Welcome</h1><p>Bread every morning.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", "<section><h2>Find us</h2></section>") },
];
const LAYOUT_KEY = (slug) => "source/" + slug + "/layout.json";

function bucket(slug, layout) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(STORED)],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fold Lane", theme: "broadsheet" }, css: "" })],
  ]);
  if (layout) store.set(LAYOUT_KEY(slug), JSON.stringify({ at: "x", slug, layout }));
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

const PHONE_CSS = { css: "@media (max-width: 767px){ h1{font-size:22px} }" };

async function edit({ mode = "sync", devices, before = BEFORE, after = (b) => b, ask = "Make the headline smaller on phones only." }) {
  const slug = "dev-" + mode + "-" + hex32().slice(0, 8);
  const b = bucket(slug, before);
  const id = hex32(), secret = hex32();
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({ layer: "look", page: "", remove: false, rename: "", tab: false, ...(devices !== undefined ? { devices } : {}), instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20) });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { lanePrompts: [], debits: [], credited: [], rpc: [] };
  const row = { state: "routing", billing: "none", cost: 0, result: null };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": row.cost += Number(args.p_cost); row.billing = "reserved"; return json({ ok: true, charged: Number(args.p_cost), cost: row.cost, billing: "reserved" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize":
          if (args.p_result) row.result = args.p_result;
          if (args.p_ok) { row.state = "done"; if (row.billing === "reserved") row.billing = "finalized"; return json({ ok: true, billing: row.billing, cost: row.cost }); }
          return json({ ok: false, error: "not-published", state: row.state });
        case "edit_refund": { const was = row.billing; row.state = args.p_state || "failed"; if (was === "reserved") { row.billing = "refunded"; return json({ ok: true, refunded: row.cost }); } return json({ ok: true, refunded: 0, billing: was }); }
        case "edit_get": return json({ ok: true, job: id, slug, state: row.state, phase: null, cost: row.cost, billing: row.billing, result: row.result, needs_review: false, ms: 1000 });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 1); }
    if (u.includes("/rpc/credit_back")) { seen.credited.push(Number(args.amount) || 0); return new Response(null, { status: 204 }); }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json(u.includes("slug=eq." + slug) ? [{ uid: USER.id, brief: "", neon_db: "" }] : []);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      if (tool === T.pick) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { fields: ["css"] } }], usage: { input_tokens: 1000, output_tokens: 50 } });
      if (tool === T.lane) {
        seen.lanePrompts.push(JSON.stringify(args.messages || []));
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: PHONE_CSS }], usage: { input_tokens: 300, output_tokens: 60 } });
      }
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler({ layout: () => after(BEFORE.map((x) => ({ ...x }))) });
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    let status = 0, reply = null;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      const poll = await worker.fetch(new Request("https://gofarther.dev/api/site/edit/" + id, { headers: { Authorization: "Bearer t" } }), env, makeCtx());
      status = poll.status;
      reply = await poll.json().catch(() => null);
    } else {
      const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
      status = res.status;
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    const config = JSON.parse(b.store.get(CONFIG_KEY(slug)) || "{}");
    const saved = b.store.has(LAYOUT_KEY(slug)) ? JSON.parse(b.store.get(LAYOUT_KEY(slug))).layout : null;
    const live = [...b.store.keys()].filter((k) => k.startsWith("current/"));
    return { status, reply, config, saved, live, builds: c.calls.map((k) => k.body), seen, row: { ...row, result: undefined } };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}
const phoneMoved = (l) => l.map((x) => (x.device === "phone" ? { ...x, digest: x.digest + "-new" } : x));
const desktopToo = (l) => l.map((x) => (x.device === "phone" || (x.device === "desktop" && x.route === "/visit") ? { ...x, digest: x.digest + "-new" } : x));

test("a phone-only change: the css lane is told, the build is measured, only phone moved — published, with the facts", async () => {
  const r = await edit({ devices: ["phone"], after: phoneMoved });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.equal(r.reply.ok, true);
  assert.equal(r.seen.lanePrompts.length, 1);
  assert.match(r.seen.lanePrompts[0], /THIS CHANGE IS FOR PHONE ONLY/, "the css lane was not told the device scope");
  assert.match(r.seen.lanePrompts[0], /below 768px/);
  assert.ok(r.builds.length >= 1 && r.builds.every((p) => p.layout === true), "the publish did not ask the build for the layout");
  assert.deepEqual(r.reply.devices, { asked: ["phone"], changed: ["phone"] });
  assert.ok(r.config.css.includes("max-width: 767px"));
  // The new measurement is the next change's "before".
  assert.deepEqual(r.saved, phoneMoved(BEFORE));
  // The reply's facts say which devices.
  const facts = editReplyFacts(r.reply).facts.map((f) => f.text).join(" ");
  assert.match(facts, /for the phone view only\. The tablet and desktop views were measured before and after and are unchanged\./);
});

test("a phone-only change that also moved desktop is refused: nothing published, the stylesheet put back, refunded (job)", async () => {
  const r = await edit({ mode: "job", devices: ["phone"], after: desktopToo });
  assert.equal(r.reply.ok === true, false, JSON.stringify(r.reply));
  const result = r.reply.result || r.reply;
  assert.equal(result.error, "compile");
  assert.deepEqual(result.devices, { asked: ["phone"], changed: ["desktop"], unknown: [] });
  assert.match(String(result.msg), /meant for the phone view only, but it also changed the desktop view/);
  assert.equal(r.config.css, "", "the stylesheet the lane wrote was left in the store");
  assert.deepEqual(r.saved, BEFORE, "a refused publish replaced the stored layout");
  assert.equal(r.seen.rpc.some((x) => x.fn === "edit_committed"), false, "a refused publish was committed");
  assert.equal(r.row.billing === "finalized", false, "a refused change was billed");
});

test("with no stored before, a scoped change cannot be checked and is refused, never assumed unchanged", async () => {
  const r = await edit({ devices: ["phone"], before: null, after: phoneMoved });
  assert.equal(r.status, 422);
  assert.deepEqual(r.reply.devices, { asked: ["phone"], changed: [], unknown: ["tablet", "desktop"] });
  assert.match(String(r.reply.msg), /couldn.t be compared/);
  assert.equal(r.config.css, "");
});

test("control: an unscoped change is not told anything and not checked, and still stores its layout", async () => {
  const r = await edit({ devices: undefined, ask: "Make the headline smaller.", after: desktopToo });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.doesNotMatch(r.seen.lanePrompts[0], /ONLY\. Make it inside the same page/);
  assert.equal(r.reply.devices, undefined);
  assert.deepEqual(r.saved, desktopToo(BEFORE));
  // All three posted is the same as none.
  const all = await edit({ devices: ["phone", "tablet", "desktop"], after: desktopToo });
  assert.equal(all.status, 200);
  assert.equal(all.reply.devices, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PAGE: the preview's device goes out with the routing call, the router's
// devices go out with the edit and survive a hand-over, and the preview
// switches to a device the change was for.

const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const cutFn = (head) => {
  const a = CHAT.indexOf("\n" + head);
  assert.ok(a > 0, head + " is gone from chat.js");
  const b = CHAT.indexOf("\n}\n", a);
  return CHAT.slice(a, b + 3);
};

test("the page sends its preview device to the router, and the router's devices to the edit", () => {
  // Landmarks first, then what lies between them.
  const routeAt = CHAT.indexOf("apiFetch('/api/site/route', {");
  const routeEnd = CHAT.indexOf("})).then(async (r) => {", routeAt);
  assert.ok(routeAt > 0 && routeEnd > routeAt, "the routing call's landmarks moved");
  assert.match(CHAT.slice(routeAt, routeEnd), /\n\s*device: typeof siteDevice === .string. \? siteDevice : undefined,/, "the routing call does not send the preview's device");
  const editAt = CHAT.indexOf("apiFetch('/api/site/' + encodeURIComponent(slug) + '/edit', {");
  const editEnd = CHAT.indexOf("instruction: instruction,", editAt);
  assert.ok(editAt > 0 && editEnd > editAt, "the edit call's landmarks moved");
  assert.match(CHAT.slice(editAt, editEnd), /devices: Array\.isArray\(d\.devices\) && d\.devices\.length \? d\.devices : undefined,/);
  // A hop between steps keeps the scope: the real hand-over.
  const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
  assert.deepEqual(EditPoll.handOver({ layer: "look", devices: ["phone"] }, { layer: "page", page: "/" }, {}).devices, ["phone"]);
  assert.equal(EditPoll.handOver({ layer: "look" }, { layer: "page", page: "/" }, {}).devices, undefined);
});

test("the preview switches to a device the change was for, and stays put for every screen", () => {
  const run = (start, facts) => {
    const stage = { dev: start, setAttribute(k, v) { this.dev = v; } };
    const buttons = DEVICES.map((d) => ({ dataset: { dev: d }, on: d === start }));
    for (const b of buttons) b.classList = { toggle: (c, v) => { b.on = !!v; } };
    const sb = { document: { getElementById: (id) => (id === "stStage" ? stage : null), querySelectorAll: () => buttons } };
    vm.runInNewContext("var siteDevice = " + JSON.stringify(start) + ";" + cutFn("function siteDeviceShow(d) {") + "; siteDeviceShow(" + JSON.stringify(facts === undefined ? null : facts) + "); this.out = siteDevice;", sb);
    return { device: sb.out, stage: stage.dev, on: buttons.filter((b) => b.on).map((b) => b.dataset.dev) };
  };
  assert.deepEqual(run("desktop", { asked: ["phone"], changed: ["phone"] }), { device: "phone", stage: "phone", on: ["phone"] });
  assert.deepEqual(run("desktop", { asked: ["phone", "tablet"], changed: ["tablet"] }), { device: "tablet", stage: "tablet", on: ["tablet"] });
  // Already on a device it changed: stays there.
  assert.equal(run("phone", { asked: ["phone", "tablet"], changed: ["phone", "tablet"] }).device, "phone");
  // Every screen, or no facts: the preview is left alone.
  assert.deepEqual(run("tablet", undefined), { device: "tablet", stage: "tablet", on: ["tablet"] });
  assert.equal(run("tablet", { asked: ["phone", "tablet", "desktop"], changed: [] }).device, "tablet");
  // And it runs where the edit's result is applied.
  assert.match(cutFn("function applyEditResult(e, o) {"), /siteDeviceShow\(e\.devices\);/);
});

// ─────────────────────────────────────────────────────────────────────────────
// A REQUEST THE SERVER FINISHES: the accepted answer's devices reach the job
// it files, the edit route's own body.

test("a request the server takes on files its edit with the router's devices", () => {
  const MSG = "Make the headline smaller on phones only.";
  const routed = { intent: "edit", layer: "look", devices: ["phone"] };
  const rec = newRequest({ key: "rqdevice0000000001", uid: "u1", slug: "fold-lane", message: MSG, picker: "sonnet", accepted: routed, parts: planParts(MSG, routed).parts });
  const b = jobBody(rec, 0, "run", "rqdevice0000000001-p0-1");
  assert.equal(b.url, "/api/site/fold-lane/edit");
  assert.deepEqual(b.body.devices, ["phone"]);
  const plain = newRequest({ key: "rqdevice0000000002", uid: "u1", slug: "fold-lane", message: MSG, picker: "sonnet", accepted: { intent: "edit", layer: "look" }, parts: planParts(MSG, { intent: "edit", layer: "look" }).parts });
  assert.equal(jobBody(plain, 0, "run", "rqdevice0000000002-p0-1").body.devices, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE BUILD SERVICE'S RENDER CHECK takes the fingerprint at the three widths
// when it is asked, and the service asks it when the publish does.

test("the render check fingerprints every route at phone, tablet and desktop when asked, and not otherwise", { skip: SKIP }, async () => {
  const os = await import("node:os");
  const path = await import("node:path");
  const { checkRender } = await import("../builder/render-check.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "device-render-"));
  const had = process.env.CHROMIUM_PATH;
  if (!had) process.env.CHROMIUM_PATH = EXE;
  try {
    fs.writeFileSync(path.join(dir, "index.html"), PAGE("@media (max-width: 767px){ .hero h1{font-size:22px} }", BODY));
    const layout = [];
    const r = await checkRender(dir, ["/"], null, null, { layout });
    assert.ok(r.checked > 0, "the check looked at nothing");
    assert.deepEqual(layout.map((x) => x.device).sort(), ["desktop", "phone", "tablet"]);
    assert.ok(layout.every((x) => x.route === "/" && x.n > 0 && typeof x.digest === "string"));
    assert.deepEqual(readLayout(layout), layout);
    // The phone's fingerprint is the phone width's own, not a copy.
    assert.notEqual(layout.find((x) => x.device === "phone").digest, layout.find((x) => x.device === "desktop").digest);
    const none = await checkRender(dir, ["/"], null, null, {});
    assert.equal(none.layout, undefined);
  } finally {
    if (!had) delete process.env.CHROMIUM_PATH;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the build service hands the check its layout array when the publish asks, and answers it beside the render", () => {
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, (m) => " ".repeat(m.length));
  assert.ok(src.includes("checkRender(CLIENT_DIST"), "the render check call is gone, so this scan reads nothing");
  assert.match(src, /\.\.\.\(payload\.layout === true \? \{ layout \} : \{\}\)/, "the layout the publish asked for is not handed to the check");
  assert.match(src, /\.\.\.\(layout\.length \? \{ layout \} : \{\}\)/, "the layout is not answered");
});
