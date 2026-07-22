// Batch 145 — retention cohorts: of the actors first seen in a period, how many return in each
// later period. Computed over the app's own event-log table (any row = active that period).
// Each actor is cohorted by their FIRST active period; the grid shows % retained per offset.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 145");
const slug = "b145";
await c.ensure(slug);
await c.schema(slug, { tables: { events: { access: "feed", columns: [{ name: "event", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const MEMBER = (await c.signup(slug, "m@x.dev", "Str0ng-pass-9")).json.token;    // id2

// Seed activity across three days directly (the API stamps created_at = now, so we set it).
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const db = h.getDb(uuid);
const act = (owner, day) => db.prepare("INSERT INTO events (event, created_at, owner_id) VALUES (?,?,?)").run("ping", day + "T10:00:00.000Z", owner);
// Cohort 07-01 (U1,U2,U3):  U1 all 3 days · U2 days 1&3 (skips day2) · U3 day1 only
act(11, "2026-07-01"); act(11, "2026-07-02"); act(11, "2026-07-03");
act(12, "2026-07-01"); act(12, "2026-07-03");
act(13, "2026-07-01");
// Cohort 07-02 (U4,U5):  U4 days 2&3 · U5 day2 only
act(14, "2026-07-02"); act(14, "2026-07-03");
act(15, "2026-07-02");

const get = (q, tok) => c.get(`/api/db/${slug}/retention?table=events&period=day&offsets=3${q || ""}`, { token: tok || ADMIN });

let r = (await get()).json;
t.eq(r.period, "day", "period echoed");
t.eq(r.cohorts.length, 2, "two cohorts (07-01 and 07-02)");

const c1 = r.cohorts.find((x) => x.cohort === "2026-07-01");
const c2 = r.cohorts.find((x) => x.cohort === "2026-07-02");
t.eq(c1.size, 3, "cohort 07-01 has 3 actors");
t.eq(c2.size, 2, "cohort 07-02 has 2 actors");

// Cohort 07-01 retention: offset0 all 3; offset1 only U1 (U2 skipped, U3 gone); offset2 U1+U2.
t.eq(c1.retention[0].count, 3, "07-01 offset0 = 3 (the cohort itself)");
t.eq(c1.retention[0].pct, 100, "offset0 is always 100%");
t.eq(c1.retention[1].count, 1, "07-01 offset1 = 1 (only U1 active day2)");
t.eq(c1.retention[1].pct, 33.33, "07-01 offset1 = 33.33%");
t.eq(c1.retention[2].count, 2, "07-01 offset2 = 2 (U1 + U2 returned day3)");
t.eq(c1.retention[2].pct, 66.67, "07-01 offset2 = 66.67%");

// Cohort 07-02 retention: offset0 both; offset1 only U4; offset2 nobody (no day4 data).
t.eq(c2.retention[0].count, 2, "07-02 offset0 = 2");
t.eq(c2.retention[1].count, 1, "07-02 offset1 = 1 (U4 returned day3)");
t.eq(c2.retention[2].count, 0, "07-02 offset2 = 0 (no day4 activity)");

// Overall = size-weighted across cohorts (total 5 actors).
t.eq(r.overall[0].pct, 100, "overall offset0 = 100%");
t.eq(r.overall[1].count, 2, "overall offset1 count = 1+1");
t.eq(r.overall[1].pct, 40, "overall offset1 = 40% (2/5)");
t.eq(r.overall[2].count, 2, "overall offset2 count = 2+0");

// Retention is monotonic within a cohort is NOT guaranteed (skips allowed) — but offset0 == size.
t.ok(c1.retention[0].count === c1.size, "offset0 count equals cohort size");

// Guards.
t.eq((await get(null, MEMBER)).status, 403, "non-admin → 403");
t.eq((await c.get(`/api/db/${slug}/retention?table=events`)).status, 401, "signed-out → 401");
t.eq((await c.get(`/api/db/${slug}/retention?table=nope`, { token: ADMIN })).status, 404, "unknown table → 404");
t.eq((await c.get(`/api/db/${slug}/retention?table=events&period=year`, { token: ADMIN })).status, 400, "bad period → 400");
t.eq((await c.get(`/api/db/${slug}/retention?table=events&actor=nope`, { token: ADMIN })).status, 400, "bad actor col → 400");
// A window with no data → no cohorts, no crash.
t.eq((await get("&from=2020-01-01&to=2020-01-02")).json.cohorts.length, 0, "empty window → no cohorts");

t.done(); h.restore();
