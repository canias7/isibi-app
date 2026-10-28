// The site's own checkout, writes and sign-in carry the guards the platform
// used to put in front of them (2026-10-28): a repeated "Pay" is one checkout,
// a hung Stripe is bounded, and writes and sign-in tries are rate-limited.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTemplate } from "./fixtures/template-ts.mjs";

const T = (p) => fs.readFileSync(new URL("../builder/lovable/template/src/" + p, import.meta.url), "utf8");
const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("Pay pressed twice is one order and one Stripe session, kept in the site's own bucket", async () => {
  const { siteCheckout } = await loadTemplate("lib/site-pay.ts");
  const store = new Map();
  const SITES = { get: async (k) => (store.has(k) ? { text: async () => store.get(k) } : null), put: async (k, v) => { store.set(k, String(v)); } };
  const real = globalThis.fetch;
  let inserts = 0, sessions = 0;
  globalThis.fetch = async (u, init = {}) => {
    const url = String(u);
    if (url.endsWith("/sql")) {
      const q = JSON.parse(init.body).query;
      if (/^SELECT id/.test(q)) return Response.json({ rows: [{ id: 1, name: "Loaf", price: 4 }] });
      if (/^INSERT/.test(q)) { inserts++; return Response.json({ rows: [{ id: 7 + inserts }] }); }
      return Response.json({ rows: [] });
    }
    if (url.startsWith("https://api.stripe.com/")) {
      assert.ok(init.signal, "the Stripe call is not bounded");
      sessions++;
      return Response.json({ id: "cs_" + sessions, url: "https://checkout.stripe.com/c/" + sessions });
    }
    return new Response("{}", { status: 404 });
  };
  try {
    const tables = [{ name: "orders", columns: ["email"], payment: { from: "menu", name: "name", price: "price", currency: "gbp" } }, { name: "menu", access: "display" }];
    const env = { APP_CONN: "postgresql://x_app:p@ep-1.neon.tech/db", SITE_TABLES: JSON.stringify(tables), STRIPE_SECRET_KEY: "sk_owner", SITES, OWN_BUCKET: "1" };
    const url = new URL("https://shop.example.com/api/db/shop/checkout");
    const press = () => siteCheckout(new Request(url, { method: "POST", headers: { "idempotency-key": "press-abcdef12", "CF-Connecting-IP": "9.9.9.9" }, body: JSON.stringify({ table: "orders", items: [{ id: 1, qty: 1 }] }) }), env, url, "shop");
    const a = await (await press()).json();
    const b = await (await press()).json();
    assert.equal(inserts, 1, "a second press wrote a second order");
    assert.equal(sessions, 1, "a second press opened a second Stripe session");
    assert.equal(b.url, a.url);
    assert.equal(b.replay, true);
    assert.ok([...store.keys()].every((k) => k.startsWith("idem/checkout/")));
  } finally { globalThis.fetch = real; }
});

test("writes and sign-in tries are rate-limited by the site; reads are not", () => {
  const S = T("server.ts");
  const w = S.slice(S.indexOf("export async function ownDataWrite("), S.indexOf("\n}\n", S.indexOf("export async function ownDataWrite(")));
  assert.match(w, /const wait = tooMany\("write\|" \+ visitorIp\(request\), 60\);\s*if \(wait\) return limited\(wait\);/);
  const a = S.slice(S.indexOf("export async function ownAuth("), S.indexOf("\n}\n", S.indexOf("export async function ownAuth(")));
  assert.match(a, /if \(request\.method !== "GET" && request\.method !== "HEAD"\) \{\s*const wait = tooMany\("auth\|" \+ visitorIp\(request\), 20\);/);
  assert.match(a, /path\.split\("\/"\)\.includes\("\.\."\)\) return null;/, "a stepping-back path is not refused by the site itself");
});

test("the limiter refuses past its ceiling and resets per visitor", async () => {
  const { tooMany } = await loadTemplate("lib/site-limit.ts");
  for (let i = 0; i < 3; i++) assert.equal(tooMany("k|a", 3), 0);
  assert.ok(tooMany("k|a", 3) > 0, "the fourth try passed");
  assert.equal(tooMany("k|b", 3), 0, "another visitor was refused");
});

test("Stripe is told 200 when a site cannot take its message, never a 5xx it would retry for days", () => {
  const at = W.indexOf('url.pathname.startsWith("/api/stripe/site/") && request.method === "POST"');
  const block = W.slice(at, W.indexOf("\n    }\n", at));
  assert.match(block, /return own \|\| Response\.json\(\{ ok: true, ignored:/);
  assert.doesNotMatch(block, /siteAnswers\(/);
});

test("a site's connection is filled from the OWNER's keys only — never its database login or addresses", async () => {
  const { ownerKeys, PLATFORM_GIVEN } = await loadTemplate("lib/owner-keys.ts");
  const env = { APP_CONN: "postgresql://x_app:SECRET@ep/db", DATA_API_BASE: "https://d", SITE_SPEC: "{}", WEATHER_KEY: "wk", lower: "x" };
  assert.deepEqual(ownerKeys(env), { WEATHER_KEY: "wk" });
  assert.deepEqual(ownerKeys(env, ["APP_CONN", "WEATHER_KEY"]), { WEATHER_KEY: "wk" });
  for (const k of ["APP_CONN", "DATA_API_BASE", "AUTH_BASE", "SITE_TABLES", "SITE_SPEC", "OWNER_EMAIL"]) assert.ok(PLATFORM_GIVEN.has(k), k);
  // Driven: a connection that asks for {{APP_CONN}} never sends it.
  const { siteApi } = await loadTemplate("lib/site-connect.ts");
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (u) => { asked.push(String(u)); return Response.json({ ok: 1 }); };
  try {
    const spec = { apis: [{ name: "leak", url: "https://api.example.com/?c={{APP_CONN}}", method: "GET" }] };
    const u = new URL("https://x.gofarther.app/api/db/x/api/leak");
    await siteApi(new Request(u), { ...env, SITE_SPEC: JSON.stringify(spec) }, u, "x");
    assert.ok(asked.every((a) => !a.includes("SECRET")), "the site's database login was sent out: " + asked.join(" "));
  } finally { globalThis.fetch = real; }
});

test("two submissions at once send ONE owner email; a missed one is counted and told next time", async () => {
  const { driveWrite, memBucket } = await import("./fixtures/site-effects-drive.mjs");
  const tables = [{ name: "bookings", access: "collect", notify: true }];
  const B = memBucket();
  const env = { OWNER_EMAIL: "owner@x.co", NOTIFY: "1", RESEND_KEY: "re_k", EMAIL_FROM: "shop@x.co", SITES: B };
  const sends = (r) => r.calls.filter((c) => /resend/.test(c.url)).length;
  const a = await driveWrite({ tables, env, sent: '{"name":"A"}', body: '[{"id":1,"name":"A"}]' });
  const b = await driveWrite({ tables, env, sent: '{"name":"B"}', body: '[{"id":2,"name":"B"}]' });
  assert.equal(sends(a) + sends(b), 1, "two emails for one cooldown window");
  // THE CLAIM IS A CONDITIONAL WRITE: of two claimers that both read "nothing
  // there", the bucket lets exactly one write.
  const C = memBucket();
  const tries = await Promise.all([1, 2].map(() => C.put("effects/notify/x", "1", { onlyIf: { etagDoesNotMatch: "*" } })));
  assert.equal(tries.filter(Boolean).length, 1);
  const effects = fs.readFileSync(new URL("../builder/lovable/template/src/lib/site-effects.ts", import.meta.url), "utf8");
  assert.match(effects, /B\.put\(key, at, \{ onlyIf: \{ etagDoesNotMatch: "\*" \} \}\)/, "the claim is not conditional");
  // The one held back by the window is counted (the next email says so)…
  assert.equal(B.map.get("effects/missed/barber").v, "1", "the held-back submission was not counted");
  // …and so is one that cannot go (no key), in the site's own bucket…
  B.map.delete("effects/notify/barber");
  await driveWrite({ tables, env: { ...env, RESEND_KEY: "" }, sent: '{"name":"C"}', body: '[{"id":3,"name":"C"}]' });
  assert.equal(B.map.get("effects/missed/barber").v, "2", "a missed notification was not counted");
  // …and the next one that goes takes the count.
  B.map.delete("effects/notify/barber");
  await driveWrite({ tables, env, sent: '{"name":"D"}', body: '[{"id":4,"name":"D"}]' });
  assert.equal(B.map.get("effects/missed/barber").v, "0", "the count was not taken by the next email");
});
