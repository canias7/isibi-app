// Batch 98 — login history: each sign-in is recorded; a member sees their recent logins
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 98");
const slug = "b98";
await c.ensure(slug);
await c.schema(slug, { tables: { x: { access: "user", columns: [{ name: "a", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9"); // id1 (signup doesn't count as a login here)
await c.signup(slug, "b@x.dev", "Str0ng-pass-9"); // id2

// three logins for A (with a UA header), one for B
const login = (email, ua) => c.call("POST", `/api/db/${slug}/auth/login`, { body: { email, password: "Str0ng-pass-9" }, headers: ua ? { "User-Agent": ua } : {} });
let la = await login("a@x.dev", "TestBrowser/1.0");
await login("a@x.dev", "TestBrowser/1.0");
await login("a@x.dev", "OtherDevice/2.0");
await login("b@x.dev");
const A = la.json.token;
const B = (await login("b@x.dev")).json.token;

let g = (await c.get(`/api/db/${slug}/auth/logins`, { token: A })).json;
t.ok(g.ok, "logins ok");
t.eq(g.logins.length, 3, "A has 3 recorded logins");
t.ok(g.logins[0].at >= g.logins[1].at, "newest first");
t.ok(g.logins.some((l) => l.ua === "OtherDevice/2.0"), "user-agent captured");

// scoped to the caller — B doesn't see A's logins
let gb = (await c.get(`/api/db/${slug}/auth/logins`, { token: B })).json;
t.ok(gb.logins.length >= 1 && gb.logins.every((l) => l.ua !== "OtherDevice/2.0"), "B sees only their own logins");

// signed-out → 401
t.eq((await c.get(`/api/db/${slug}/auth/logins`)).status, 401, "signed-out → 401");

// login still works normally (returns a token) — capture never breaks auth
t.ok(la.json.ok && la.json.token, "login itself unaffected");

t.done(); h.restore();
