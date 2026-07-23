// Batch 234 — EMAIL OPEN/CLICK TRACKING. A 1×1 pixel logs an open, a click-redirect logs a click + 302s,
// and the admin reads open/click/CTR stats. Covers the pixel response, open logging, click redirect + log,
// unique counts, CTR, campaign filter, bad-target guard, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 234");
const slug = "b234";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const open = (camp, r) => c.get(`/api/db/${slug}/track-email/open?c=${camp}&r=${encodeURIComponent(r)}`);
const click = (camp, r, u) => c.get(`/api/db/${slug}/track-email/click?c=${camp}&r=${encodeURIComponent(r)}&u=${encodeURIComponent(u)}`);
const stats = (tok, camp) => c.get(`/api/db/${slug}/track-email/stats${camp ? "?campaign=" + camp : ""}`, { token: tok }).then((r) => r.json);

// --- Open returns a GIF pixel ---
let res = await open("launch", "u1@x.io");
t.eq(res.status, 200, "open returns 200");
t.ok(res.text.startsWith("GIF"), "…a GIF pixel");

// --- Log opens (u1 twice, u2 once) ---
await open("launch", "u1@x.io"); // 2nd open by u1
await open("launch", "u2@x.io");
let s = await stats(A, "launch");
t.eq(s.opens, 3, "3 total opens");
t.eq(s.unique_opens, 2, "…2 unique recipients");

// --- Click redirects (302) + logs ---
res = await click("launch", "u1@x.io", "https://dest.example/landing");
t.eq(res.status, 302, "click returns a 302 redirect");
t.eq(res.location, "https://dest.example/landing", "…to the target URL");
await click("launch", "u2@x.io", "https://dest.example/other");
s = await stats(A, "launch");
t.eq(s.clicks, 2, "2 clicks logged");
t.eq(s.unique_clicks, 2, "…2 unique clickers");
t.ok(Math.abs(s.ctr - 66.67) < 0.1, "CTR = clicks/opens = 2/3 ≈ 66.67%");

// --- Campaign isolation ---
await open("newsletter", "z@x.io");
t.eq((await stats(A, "newsletter")).opens, 1, "another campaign is counted separately");
t.eq((await stats(A, "launch")).opens, 3, "…launch unchanged");

// --- Bad click target guarded ---
t.eq((await c.get(`/api/db/${slug}/track-email/click?c=launch&r=x&u=javascript:alert(1)`)).status, 400, "a non-http(s) target → 400");
t.eq((await c.get(`/api/db/${slug}/track-email/click?c=launch&r=x`)).status, 400, "no target → 400");

// --- Open with a missing campaign still returns a pixel (never a broken image) ---
res = await c.get(`/api/db/${slug}/track-email/open`);
t.eq(res.status, 200, "open with no campaign still returns 200");
t.ok(res.text.startsWith("GIF"), "…still a GIF");

// --- Stats authz ---
t.eq((await c.get(`/api/db/${slug}/track-email/stats`, { token: B })).status, 403, "a member can't read stats → 403");
t.eq((await c.get(`/api/db/${slug}/track-email/stats`)).status, 401, "signed-out stats → 401");

t.done(); h.restore();
