// Batch 143 — app-facing analytics read: the app's OWN admin reads back the traffic it
// fires with /track (daily aggregate counts), over a window, with filters + a zero-filled
// day series for charts. Admin-only; distinct from the isibi-owner platform dashboard.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 143");
const slug = "b143";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1 (admin)
const MEMBER = (await c.signup(slug, "m@x.dev", "Str0ng-pass-9")).json.token;    // id2 (user)

// Seed _analytics deterministically (mirrors what /track writes, minus its fire-and-forget timing).
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const db = h.getDb(uuid);
db.prepare("CREATE TABLE IF NOT EXISTS _analytics (day TEXT, event TEXT, path TEXT, n INTEGER DEFAULT 0, PRIMARY KEY(day,event,path))").run();
const seed = (day, event, path, n) => db.prepare("INSERT INTO _analytics (day,event,path,n) VALUES (?,?,?,?)").run(day, event, path, n);
seed("2026-07-01", "view", "/home", 10);
seed("2026-07-01", "view", "/about", 3);
seed("2026-07-01", "signup", "", 2);
seed("2026-07-02", "view", "/home", 5);
seed("2026-07-04", "click", "/buy", 4);
seed("2026-06-01", "view", "/home", 99); // OUTSIDE the queried window — must be excluded

const get = (q, tok) => c.get(`/api/db/${slug}/analytics${q}`, { token: tok || ADMIN });

// Window 07-01..07-05: totals + breakdowns exclude the 06-01 row.
let r = (await get("?from=2026-07-01&to=2026-07-05")).json;
t.eq(r.total, 24, "total over the window (10+3+2+5+4, excludes out-of-window 99)");
t.eq(r.byEvent.view, 18, "byEvent view = 10+3+5");
t.eq(r.byEvent.signup, 2, "byEvent signup = 2");
t.eq(r.byEvent.click, 4, "byEvent click = 4");
t.eq(r.events, ["click", "signup", "view"], "distinct events, sorted");
// byPath is an array sorted by count desc.
t.eq(r.byPath[0].path, "/home", "top path is /home");
t.eq(r.byPath.find((x) => x.path === "/home").n, 15, "/home = 10+5");
t.eq(r.byPath.find((x) => x.path === "/about").n, 3, "/about = 3");
t.ok(!r.byPath.some((x) => x.path === ""), "the empty-path signup isn't listed as a path");

// Zero-filled day series: 5 continuous days, gaps filled with 0.
t.eq(r.series.length, 5, "series has one point per day in the window");
t.eq(r.series.map((s) => s.day), ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"], "series days are continuous");
t.eq(r.series.map((s) => s.n), [15, 5, 0, 4, 0], "series counts, with 07-03 and 07-05 zero-filled");

// event= filter narrows everything.
let rv = (await get("?from=2026-07-01&to=2026-07-05&event=view")).json;
t.eq(rv.total, 18, "event=view total");
t.ok(rv.byEvent.view === 18 && !rv.byEvent.click, "event filter drops other events");

// path= filter.
let rp = (await get("?from=2026-07-01&to=2026-07-05&path=/home")).json;
t.eq(rp.total, 15, "path=/home total = 10+5");

// A reversed window is normalized (from>to swapped), not empty.
t.eq((await get("?from=2026-07-05&to=2026-07-01")).json.total, 24, "reversed from/to is normalized");

// ?days= path: a row stamped 'today' shows up within a 1-day window.
const today = new Date(Date.now()).toISOString().slice(0, 10);
seed(today, "view", "/live", 7);
let rd = (await get("?days=1")).json;
t.eq(rd.total, 7, "days=1 window captures today's row only");
t.eq(rd.series.length, 1, "days=1 → single-day series");
t.eq(rd.series[0].day, today, "the single series day is today");

// Guards.
t.eq((await get("?days=7", MEMBER)).status, 403, "a non-admin member → 403");
t.eq((await c.get(`/api/db/${slug}/analytics?days=7`)).status, 401, "signed-out → 401");
// Empty backend / no data → zeros, not a crash.
t.eq((await get("?from=2020-01-01&to=2020-01-03")).json.total, 0, "a window with no data → total 0");

t.done(); h.restore();
