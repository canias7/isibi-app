// Batch 144 — conversion funnel: distinct actors through an ordered set of steps, computed
// over the app's own event-log table (one row per actor per step). Monotonic drop-off,
// dedup of repeated steps, window filter, admin-only.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 144");
const slug = "b144";
await c.ensure(slug);
// A `feed` table: each member owns their rows, owner_id is the actor.
await c.schema(slug, { tables: { events: { access: "feed", columns: [{ name: "event", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3
const C = (await c.signup(slug, "cc@x.dev", "Str0ng-pass-9")).json.token; // id4
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id5
const log = (ev, tok) => c.post(`/api/db/${slug}/rows/events`, { event: ev }, { token: tok });

// A completes all three (and logs signup TWICE — must dedup).
await log("signup", A); await log("signup", A); await log("activate", A); await log("purchase", A);
// B does signup + activate (drops before purchase).
await log("signup", B); await log("activate", B);
// C only signs up.
await log("signup", C);
// D signs up + purchases but SKIPS activate (out of order) + logs an unrelated step.
await log("signup", D); await log("purchase", D); await log("refund", D);

const funnel = (q, tok) => c.get(`/api/db/${slug}/funnel?table=events&steps=signup,activate,purchase${q || ""}`, { token: tok || ADMIN });

let r = (await funnel()).json;
t.eq(r.steps.length, 3, "three funnel steps");
t.eq(r.steps[0].count, 4, "signup: A,B,C,D = 4 (A's duplicate signup dedup'd)");
t.eq(r.steps[1].count, 2, "activate: only A,B did signup+activate = 2");
t.eq(r.steps[2].count, 1, "purchase: only A did all three (D skipped activate) = 1");
// Percentages.
t.eq(r.steps[0].pct_of_top, 100, "step 1 is 100% of top");
t.eq(r.steps[1].pct_of_top, 50, "activate = 50% of top (2/4)");
t.eq(r.steps[2].pct_of_top, 25, "purchase = 25% of top (1/4)");
t.eq(r.steps[1].pct_of_prev, 50, "activate = 50% of the previous step (2/4)");
t.eq(r.steps[2].pct_of_prev, 50, "purchase = 50% of the previous step (1/2)");
t.eq(r.overall_conversion, 25, "overall conversion top→last = 25%");

// The funnel is monotonic non-increasing.
t.ok(r.steps[0].count >= r.steps[1].count && r.steps[1].count >= r.steps[2].count, "counts never increase down the funnel");

// D's unrelated 'refund' step doesn't leak in — the IN-clause is scoped to the funnel steps,
// so D still counts only at 'signup' (they never activated), never inflating a later step.

// Window filter: everything was logged 'today', so today's window keeps all; a past window is empty.
const today = new Date(Date.now()).toISOString().slice(0, 10);
t.eq((await funnel(`&from=${today}`)).json.steps[0].count, 4, "from=today keeps all of today's events");
let past = (await funnel("&from=2020-01-01&to=2020-01-02")).json;
t.eq(past.steps[0].count, 0, "a past window → empty funnel");
t.eq(past.overall_conversion, 0, "empty funnel → 0% conversion");

// Guards.
t.eq((await funnel(null, A)).status, 403, "non-admin member → 403");
t.eq((await c.get(`/api/db/${slug}/funnel?table=events&steps=signup,activate`)).status, 401, "signed-out → 401");
t.eq((await c.get(`/api/db/${slug}/funnel?table=nope&steps=a,b`, { token: ADMIN })).status, 404, "unknown table → 404");
t.eq((await c.get(`/api/db/${slug}/funnel?table=events&steps=onlyone`, { token: ADMIN })).status, 400, "fewer than 2 steps → 400");
t.eq((await c.get(`/api/db/${slug}/funnel?table=events&steps=a,b&step_col=nope`, { token: ADMIN })).status, 400, "bad step_col → 400");
t.eq((await c.get(`/api/db/${slug}/funnel?table=events&steps=a,b&actor=nope`, { token: ADMIN })).status, 400, "bad actor col → 400");

t.done(); h.restore();
