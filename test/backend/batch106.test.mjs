// Batch 106 — per-key API rate limits: an admin caps a specific X-API-Key at N req/min
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 106");
const slug = "b106";
await c.ensure(slug);
await c.schema(slug, { tables: {
  items: { access: "feed", columns: [{ name: "title", type: "text" }] }, // public read, member writes own
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const read = (key) => c.get(`/api/db/${slug}/rows/items`, { headers: { "X-API-Key": key } });

// Mint a key WITH a per-key cap.
let m1 = await c.post(`/api/db/${slug}/apikeys`, { label: "capped", rpm: 3 }, { token: ADMIN });
t.ok(m1.status === 200 && m1.json.ok, "mint capped key ok");
t.eq(m1.json.rpm, 3, "mint echoes the rpm cap");
const K1 = m1.json.key;

// The cap surfaces in the admin listing.
let list = await c.get(`/api/db/${slug}/apikeys`, { token: ADMIN });
const shown = list.json.keys.find((k) => k.id === m1.json.id);
t.eq(shown.rpm, 3, "list shows the per-key rpm");

// 3 requests within the cap succeed, the 4th is throttled — even though these are
// public reads well under the shared per-IP cap (300/min).
t.eq((await read(K1)).status, 200, "req 1 within key cap");
t.eq((await read(K1)).status, 200, "req 2 within key cap");
t.eq((await read(K1)).status, 200, "req 3 within key cap");
let over = await read(K1);
t.eq(over.status, 429, "req 4 over the key cap → 429");
t.ok(/rate limit/i.test(over.json.error || ""), "429 mentions the rate limit");

// A second, uncapped key is NOT affected by K1's exhausted bucket (separate per-key bucket).
let m2 = await c.post(`/api/db/${slug}/apikeys`, { label: "unlimited" }, { token: ADMIN });
t.eq(m2.json.rpm, null, "no rpm → unlimited (null)");
const K2 = m2.json.key;
let allOk = true;
for (let i = 0; i < 6; i++) { if ((await read(K2)).status !== 200) allOk = false; }
t.ok(allOk, "uncapped key keeps working after another key is throttled");

// rpm normalisation: garbage/zero/negative → null (unlimited); strings coerce; huge values clamp.
t.eq((await c.post(`/api/db/${slug}/apikeys`, { label: "z", rpm: 0 }, { token: ADMIN })).json.rpm, null, "rpm:0 → null");
t.eq((await c.post(`/api/db/${slug}/apikeys`, { label: "n", rpm: -5 }, { token: ADMIN })).json.rpm, null, "negative rpm → null");
t.eq((await c.post(`/api/db/${slug}/apikeys`, { label: "s", rpm: "12" }, { token: ADMIN })).json.rpm, 12, "string rpm coerces to number");
t.eq((await c.post(`/api/db/${slug}/apikeys`, { label: "g", rpm: "abc" }, { token: ADMIN })).json.rpm, null, "non-numeric rpm → null");
t.eq((await c.post(`/api/db/${slug}/apikeys`, { label: "b", rpm: 9999999 }, { token: ADMIN })).json.rpm, 100000, "huge rpm clamps to 100000");

t.done(); h.restore();
