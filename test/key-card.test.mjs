// THE KEY CARD (2026-10-30, owner: "when the model says add key, in the chat I
// want a server thing that pulls up and collects the key, WITHOUT THE MODEL
// TOUCHING IT").
//
//   1. The trigger: a reply names the keys still to add as `needKeys` (names
//      only, the site-secrets rule), from the server code and from the agent's
//      `request_key` tool, which takes a name and refuses a value.
//   2. The card: password boxes that POST straight to the owner's keys route.
//   3. The model never sees a value: a sentinel saved through the real keys
//      route, then an agent run through the real edit route with a stubbed
//      model transport, and the sentinel is in NO model request, stored object,
//      reply or log line. Only the push to the site's own Worker holds it (the
//      observer's proof of life).
//   4. A key typed into the message box is caught before it is sent.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { normalizeSecretName } from "../site-secrets.mjs";
import { keyAsk, needKeysOf, serviceOf, NEED_KEYS_MAX } from "../builder/key-card.mjs";
import { AGENT_TOOLS } from "../builder/site-agent.mjs";

const require = createRequire(import.meta.url);
const KeyCard = require("../public/key-card.js");
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const INDEX = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

delete process.env.GF_OLD_LANES;

const hex = (n) => randomBytes(n).toString("hex");
// Assembled from pieces so no real-looking key sits in one string.
const SENTINEL = ["sk", "live", "SENTINEL" + hex(12)].join("_");

// ── 1. THE TRIGGER ───────────────────────────────────────────────────────────

test("request_key is an agent tool that takes a name, never a value", () => {
  const t = AGENT_TOOLS.find((x) => x.name === "request_key");
  assert.ok(t, "the tool is offered");
  assert.deepEqual(Object.keys(t.input_schema.properties).sort(), ["name", "service", "why"]);
  assert.deepEqual(keyAsk({ name: "stripe secret key", why: "checkout" }), { ok: true, key: { name: "STRIPE_SECRET_KEY", service: "Stripe", why: "checkout" } });
  for (const k of ["value", "key", "secret", "token"]) assert.equal(keyAsk({ name: "A", [k]: "x" }).ok, false, k + " is refused");
  assert.equal(keyAsk({ name: "1BAD" }).ok, false);
  assert.equal(keyAsk({ name: ["A"] }).ok, false, "a non-string name is refused, not coerced");
});

test("needKeys: unset names from the evidence, then asked ones; set ones dropped; the site-secrets rule", () => {
  const ev = { keys: [{ name: "STRIPE_SECRET_KEY", set: false }, { name: "RESEND_API_KEY", set: true }, { name: "TWILIO_AUTH_TOKEN", set: null }, { name: "bad name!", set: false }] };
  const out = needKeysOf({ evidence: ev, asked: [{ name: "openai_api_key", service: "OpenAI", why: "chat" }, { name: "STRIPE_SECRET_KEY" }], keysSet: ["RESEND_API_KEY"] });
  assert.deepEqual(out.map((k) => k.name), ["STRIPE_SECRET_KEY", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY"]);
  assert.equal(out[0].service, "Stripe");
  assert.equal(needKeysOf({ asked: Array.from({ length: 20 }, (_, i) => ({ name: "K" + i })) }).length, NEED_KEYS_MAX);
  assert.equal(needKeysOf({ asked: [{ name: "A" }], keysSet: ["A"] }).length, 0, "a set key is never asked for");
  assert.equal(serviceOf("NOPE"), "");
  for (const k of out) assert.deepEqual(Object.keys(k).filter((x) => !["name", "service", "why"].includes(x)), [], "names only, no other field");
});

test("the browser's key-name rule is site-secrets' rule", () => {
  for (const s of ["stripe_key", "Stripe-Key", " a b ", "1abc", "", "A".repeat(64), "A".repeat(65), "é", "x_Y-z", null, 7]) {
    assert.equal(KeyCard.keyName(s), normalizeSecretName(s), JSON.stringify(s));
  }
  assert.deepEqual(KeyCard.needKeys([{ name: "a" }, { name: "A" }, { name: "!" }, null]).map((k) => k.name), ["A"]);
});

// ── 4. A KEY IN THE MESSAGE BOX ─────────────────────────────────────────────

test("key-shaped text is found, named, and taken out; ordinary words are not", () => {
  const live = ["sk", "live", "abcdefghijklmnop"].join("_");
  const wh = ["whsec", "abcdefghijklmnopqr"].join("_");
  const rs = ["re", "abcdefghijklmnop"].join("_");
  const oa = ["sk", "proj", "abcdefghijklmnopqrstuvwxyz"].join("-");
  const f = KeyCard.keyShaped("use " + live + " and " + wh + " and " + rs + " and " + oa);
  assert.deepEqual(f.map((x) => x.name), ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "OPENAI_API_KEY"]);
  assert.equal(KeyCard.withoutKeys("my key is " + live + " thanks"), "my key is thanks");
  for (const ok of ["redo the hero", "make the re_do button", "sk_live is the prefix", "ask about pricing", "skip the test section"]) assert.equal(KeyCard.keyShaped(ok).length, 0, ok);
});

test("the message box refuses to send a key: the guard sits before siteSend, on both send buttons", () => {
  const a = CHAT.indexOf("if (t && typeof siteKeyShapedStop === 'function' && siteKeyShapedStop(site, ta)) return;");
  const b = CHAT.indexOf("ta.value = ''; draft.t = ''; siteSend(t);");
  assert.ok(a > 0 && b > a, "the guard runs before the message is sent");
  assert.ok(CHAT.includes("typeof siteKeyShapedStop === 'function' && siteKeyShapedStop(null, ta)) return;"), "the new-site box too");
  assert.ok(INDEX.indexOf('src="/key-card.js"') > 0 && INDEX.indexOf('src="/key-card.js"') < INDEX.indexOf('src="/chat.js"'), "loaded before chat.js");
});

// ── 2. THE CARD ─────────────────────────────────────────────────────────────

const cardSrc = () => {
  const a = CHAT.indexOf("const siteKeyCards = new Map();");
  const b = CHAT.indexOf("// Secrets — encrypted per-site vault.");
  assert.ok(a > 0 && b > a, "both landmarks");
  return CHAT.slice(a, b);
};

test("the card: password boxes, no autocomplete or spellcheck, and a value goes only to the keys route", () => {
  const src = cardSrc();
  assert.match(src, /type="password" autocomplete="off" spellcheck="false"/);
  const rq = KeyCard.saveRequest("shop-1", "STRIPE_SECRET_KEY", "v");
  assert.equal(rq.url, "/api/site/shop-1/secrets");
  assert.equal(rq.init.method, "POST");
  assert.deepEqual(JSON.parse(rq.init.body), { name: "STRIPE_SECRET_KEY", value: "v" });
  // Where a value could leak from the card: none of these appear in it.
  const code = src.replace(/\/\/[^\n]*/g, "");
  assert.ok(code.includes("inp.value"), "the observer reads the code that handles values");
  for (const bad of ["localStorage", "sessionStorage", "sitesSave", ".msgs", "console.", "sbToast", "siteSend", "chatStore", "track("]) assert.ok(!code.includes(bad), "the card never touches " + bad);
  assert.match(code, /c\.set\.add\(k\.name\); inp\.value = '';/, "a saved key's box is cleared");
  assert.ok(code.includes("': set'"), "a saved key says set");
});

test("every reply that carries needKeys offers the card: edit, add-on and build", () => {
  assert.ok(CHAT.includes("siteKeyCardOffer === 'function') siteKeyCardOffer(o.origin, e.needKeys);"));
  assert.ok(CHAT.includes("siteKeyCardOffer === 'function') siteKeyCardOffer(o.origin, a.needKeys);"));
  assert.ok(CHAT.includes("siteKeyCardOffer === 'function') siteKeyCardOffer(origin, d && d.needKeys);"));
  assert.ok(CHAT.includes("siteKeyCardAttach === 'function') siteKeyCardAttach();\n    thread.querySelectorAll('[data-copy]')"), "re-attached after the thread is redrawn");
});

// ── 3. THE MODEL NEVER SEES IT, THROUGH THE REAL ROUTES ─────────────────────

const USER = { id: "u-keycard-1", email: "owner@example.com" };
const SITE_CONN = "postgres://u:p@ep-keycard.neon.tech/neondb";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const neon = (cols, rows, command = "SELECT") => json({ command, rowCount: rows.length, rows: rows.map((r) => cols.map((c) => r[c] === undefined ? null : r[c])), fields: cols.map((c) => ({ name: c, dataTypeID: 25 })) });
const page = (route, inner) => "import { createFileRoute } from '@tanstack/react-router'\n" +
  "export const Route = createFileRoute('" + route + "')({ component: P })\nfunction P(){return <main>" + inner + "</main>}\n";
const use = (name, input) => ({ type: "tool_use", id: "t" + hex(3), name, input });
const ROUND = { input_tokens: 3000, output_tokens: 800, cache_read_input_tokens: 9000 };

function bucket(slug, chatKey) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: page("/", "<h1>Shop</h1>") }])],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Shop" }, css: ":root{}" })],
    ["chat/" + USER.id + "/" + chatKey + ".json", JSON.stringify({ v: 1, rev: 1, msgs: [{ r: "u", t: "add stripe checkout" }, { r: "a", t: "It needs your Stripe key." }] })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, typeof v === "string" ? v : String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

async function harness(fn) {
  const slug = "keycard-" + hex(4);
  const chatKey = "site_1760000000000_" + hex(3);
  const b = bucket(slug, chatKey);
  const secrets = new Map(); // the site's `_secrets`: name -> { cipher, hint }
  const seen = { model: [], pushed: [], outbound: [], rpc: [], logs: [] };
  let rounds = [], n = 0, reserved = 0, failInsert = false;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const body = String((init && init.body) || "");
    seen.outbound.push({ u, body });
    let args = {};
    try { args = JSON.parse(body || "{}"); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      seen.rpc.push(rpc[1]);
      switch (rpc[1]) {
        case "edit_reserve": reserved += Number(args.p_cost); return json({ ok: true, charged: Number(args.p_cost), cost: reserved, billing: "reserved" });
        case "edit_finalize": return json({ ok: true, billing: "finalized" });
        case "edit_refund": return json({ ok: true, refunded: reserved, billing: "reserved" });
        default: return json({ ok: true, granted: true, claimed: true, alive: true, state: "routing", billing: "none", uid: USER.id, slug });
      }
    }
    if (u.includes("/rpc/use_credits")) return json(Number(args.cost) || 0);
    if (u.includes("/rpc/get_credits")) return json(500);
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_project")) return json([{ uid: USER.id, neon_project: "p", neon_branch: "b", neon_role: "owner", neon_conn: SITE_CONN }]);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "sitedb" }]);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.includes("neon.tech/sql")) {
      const q = String(args.query || ""), p = Array.isArray(args.params) ? args.params : [];
      if (/^SELECT name, hint, created_at FROM _secrets/i.test(q)) return neon(["name", "hint", "created_at"], [...secrets].map(([name, v]) => ({ name, hint: v.hint, created_at: "2026-10-30" })));
      if (/^SELECT name FROM _secrets/i.test(q)) return neon(["name"], [...secrets.keys()].sort().map((name) => ({ name })));
      if (/^INSERT INTO _secrets/i.test(q) && failInsert) return json({ message: "insert failed: " + JSON.stringify(p) }, 500);
      if (/^INSERT INTO _secrets/i.test(q)) { secrets.set(p[0], { cipher: p[1], hint: p[2] }); return neon([], [], "INSERT"); }
      return neon([], []);
    }
    if (/\/workers\/dispatch\/namespaces\/[^/]+\/scripts\/[^/]+\/secrets/.test(u)) { seen.pushed.push(args); return json({ success: true, result: {} }); }
    if (u.includes("/v1/messages") || u.includes("x.ai")) {
      const tools = Array.isArray(args.tools) ? args.tools.map((t) => t.name || (t.function && t.function.name)) : [];
      seen.model.push(body);
      if (tools.includes("finish")) return json({ stop_reason: "tool_use", content: rounds[Math.min(n++, rounds.length - 1)], usage: ROUND });
      return new Response("no stub", { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const logged = ["log", "info", "warn", "error", "debug"].map((k) => [k, console[k]]);
  for (const [k] of logged) console[k] = (...a) => { seen.logs.push(a.map((x) => { try { return typeof x === "string" ? x : JSON.stringify(x) ?? String(x); } catch { return String(x); } }).join(" ")); };
  const c = installCompiler({});
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", SITE_OWN_DATA: "1", ...dispatchEnv() };
    const call = async (path, method, payload) => {
      const ctx = makeCtx();
      const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + path, { method, headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: payload == null ? undefined : JSON.stringify(payload) }), env, ctx);
      const text = await res.text();
      await Promise.allSettled(ctx.pending);
      return { status: res.status, text };
    };
    return await fn({ slug, chatKey, call, seen, secrets, store: b.store, setRounds: (r) => { rounds = r; n = 0; }, failInserts: () => { failInsert = true; } });
  } finally {
    c.uninstall();
    for (const [k, f] of logged) console[k] = f;
    globalThis.fetch = real;
  }
}

test("a sentinel saved through the keys route reaches the site's Worker and NOTHING the model, the chat or the logs can read", async () => {
  await harness(async ({ chatKey, call, seen, secrets, store, setRounds, failInserts }) => {
    // The card's own request, byte for byte.
    const rq = KeyCard.saveRequest("x", "STRIPE_SECRET_KEY", SENTINEL);
    const saved = await call("/secrets", "POST", JSON.parse(rq.init.body));
    assert.equal(saved.status, 200, saved.text);
    assert.deepEqual(JSON.parse(saved.text), { ok: true, name: "STRIPE_SECRET_KEY", replaced: false });
    // PROOF OF LIFE: the observer sees the sentinel where it must go, once.
    assert.equal(seen.pushed.length, 1);
    assert.equal(seen.pushed[0].text, SENTINEL, "the value went to the site's own Worker");
    assert.equal(seen.outbound.filter((o) => o.body.includes(SENTINEL)).length, 1, "and to nothing else on the network");
    assert.ok(secrets.has("STRIPE_SECRET_KEY"));
    assert.ok(!JSON.stringify([...secrets.values()]).includes(SENTINEL), "the database row holds no value");

    // The next agent run: the owner asks, the agent lists the keys, asks for one more, and finishes.
    setRounds([
      [use("list_keys", {})],
      [use("request_key", { name: "resend api key", service: "Resend", why: "Sends the order emails" }), use("request_key", { name: "X", value: "nope" })],
      [use("finish", { summary: "Checked the keys." })],
    ]);
    const before = seen.model.length;
    const ed = await call("/edit", "POST", { layer: "page", page: "/", instruction: "is my stripe key in?", picker: "sonnet", idem: "idem" + hex(8), chat: chatKey });
    assert.equal(ed.status, 200, ed.text);
    const reply = JSON.parse(ed.text);
    const runs = seen.model.slice(before);
    assert.ok(runs.length >= 3, "the agent really ran: " + runs.length);
    // The agent learnt only the NAME.
    assert.ok(runs.some((r) => r.includes("The owner has set these keys (names only): STRIPE_SECRET_KEY.")), "list_keys answered the name");
    assert.ok(runs.some((r) => r.includes("request_key takes a NAME only")), "a value handed to request_key was refused");
    // The reply carries the card's trigger, names only.
    assert.deepEqual(reply.needKeys, ([{ name: "RESEND_API_KEY", service: "Resend", why: "Sends the order emails" }]));

    // THE SENTINEL IS NOWHERE ELSE.
    for (const r of seen.model) assert.ok(!r.includes(SENTINEL), "a model request carried the value");
    assert.ok(!ed.text.includes(SENTINEL) && !saved.text.includes(SENTINEL), "a reply carried the value");
    for (const [k, v] of store) assert.ok(!String(v).includes(SENTINEL), "stored object " + k + " carried the value");
    assert.equal(seen.outbound.filter((o) => o.body.includes(SENTINEL)).length, 1, "after the run, still only the one push");
    // THE LOG OBSERVER IS ALIVE: a store failure is logged, and the line names
    // no value even though the failing statement's error quotes its parameters.
    failInserts();
    const broke = await call("/secrets", "POST", { name: "OTHER_KEY", value: SENTINEL });
    assert.equal(broke.status, 503);
    assert.ok(!broke.text.includes(SENTINEL));
    assert.ok(seen.logs.some((l) => l.includes("secrets:")), "the failure was logged");
    assert.ok(!seen.logs.some((l) => l.includes(SENTINEL)), "a log line carried the value");
  });
});

test("a refused save does not echo the value, and an oversized body is refused unread", async () => {
  await harness(async ({ call, seen }) => {
    const bad = await call("/secrets", "POST", { name: "1BAD", value: SENTINEL });
    assert.equal(bad.status, 400);
    assert.ok(!bad.text.includes(SENTINEL));
    const big = await call("/secrets", "POST", { name: "BIG", value: SENTINEL + "x".repeat(20000) });
    assert.equal(big.status, 413);
    assert.ok(!big.text.includes(SENTINEL));
    assert.equal(seen.pushed.length, 0, "nothing was pushed");
    assert.ok(!seen.logs.some((l) => l.includes(SENTINEL)));
  });
});

test("a stranger cannot save a key on someone else's site", async () => {
  await harness(async ({ call, seen }) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (i, init) => {
      const u = String((i && i.url) || i || "");
      if (u.includes("/rest/v1/site_backends")) return json([{ uid: "someone-else", brief: "", neon_db: "sitedb" }]);
      return realFetch(i, init);
    };
    try {
      const r = await call("/secrets", "POST", { name: "STRIPE_SECRET_KEY", value: SENTINEL });
      assert.ok(r.status === 403 || r.status === 404, String(r.status));
      assert.equal(seen.pushed.length, 0);
    } finally { globalThis.fetch = realFetch; }
  });
});
