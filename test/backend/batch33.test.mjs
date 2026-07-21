// Batch 33 — Polls (one vote per member, change your vote)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 33");

const slug = "b33";
await c.ensure(slug);
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token;

const P = "best-logo";
// A votes red, B votes blue, C votes red
let r = await c.post(`/api/db/${slug}/poll/${P}/red`, {}, { token: A });
t.ok(r.json.counts.red === 1 && r.json.total === 1 && r.json.mine === "red", "A votes red -> red:1, mine red");
await c.post(`/api/db/${slug}/poll/${P}/blue`, {}, { token: B });
r = await c.post(`/api/db/${slug}/poll/${P}/red`, {}, { token: C });
t.ok(r.json.counts.red === 2 && r.json.counts.blue === 1 && r.json.total === 3, "tally red:2 blue:1 total:3");

// one vote per member: C changes vote red -> blue (total stays 3)
r = await c.post(`/api/db/${slug}/poll/${P}/blue`, {}, { token: C });
t.ok(r.json.counts.red === 1 && r.json.counts.blue === 2 && r.json.total === 3, "C re-votes -> red:1 blue:2 total still 3");
t.ok(r.json.mine === "blue", "C's mine is now blue");

// GET state (anon: counts but mine null)
r = await c.get(`/api/db/${slug}/poll/${P}`);
t.ok(r.json.total === 3 && r.json.mine === null, "anon GET -> total 3, mine null");
r = await c.get(`/api/db/${slug}/poll/${P}`, { token: A });
t.ok(r.json.mine === "red", "A GET -> mine red");

// withdraw vote (DELETE)
r = await c.del(`/api/db/${slug}/poll/${P}`, { token: A });
t.ok(r.json.total === 2 && r.json.mine === null && r.json.counts.red === 0 || r.json.counts.red === undefined, "A withdraws -> total 2, red gone");

// vote needs auth + option
t.ok((await c.post(`/api/db/${slug}/poll/${P}/red`, {})).status === 401, "vote needs auth -> 401");
t.ok((await c.post(`/api/db/${slug}/poll/${P}`, {}, { token: A })).status === 400, "vote without option -> 400");

t.done();
h.restore();
