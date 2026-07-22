// Batch 64 — stage-gating / guarded transitions (state machine)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 64");
const slug = "b64";
await c.ensure(slug);
await c.schema(slug, { tables: { opps: { access: "feed",
  transitions: { stage: { prospecting: ["qualification", "closed_lost"], qualification: ["proposal", "closed_lost"], proposal: ["closed_won", "closed_lost"] } },
  columns: [{ name: "name", type: "text" }, { name: "stage", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const mk = await c.post(`/api/db/${slug}/rows/opps`, { name: "Deal", stage: "prospecting" }, { token: A });
t.ok(mk.json.ok, "create opp at prospecting");
const id = (await c.get(`/api/db/${slug}/rows/opps`)).json.rows[0].id;
const patch = (stage) => c.patch(`/api/db/${slug}/rows/opps/${id}`, { stage }, { token: A });

// legal step prospecting → qualification
t.ok((await patch("qualification")).json.ok, "prospecting → qualification (legal)");
// illegal skip qualification → closed_won
let bad = await patch("closed_won");
t.ok(bad.status === 409 && bad.json.code === "transition", "qualification → closed_won BLOCKED (409 transition)");
t.eq(bad.json.from, "qualification", "409 reports from=qualification");
// legal qualification → proposal
t.ok((await patch("proposal")).json.ok, "qualification → proposal (legal)");
// legal proposal → closed_won
t.ok((await patch("closed_won")).json.ok, "proposal → closed_won (legal)");
// from a terminal state, no declared moves → any move blocked
t.ok((await patch("prospecting")).status === 409, "closed_won → prospecting BLOCKED (terminal)");
// a PATCH that doesn't touch stage is unaffected
t.ok((await patch("closed_won") , (await c.patch(`/api/db/${slug}/rows/opps/${id}`, { name: "Renamed" }, { token: A })).json.ok), "non-stage PATCH unaffected");

t.done(); h.restore();
