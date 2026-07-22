// Batch 101 — JSON shape validation: validate the inner fields of a json column on write
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 101");
const slug = "b101";
await c.ensure(slug);
await c.schema(slug, { tables: {
  events: { access: "admin",
    jsonShapes: { payload: { type: "string", count: "number", tags: "array", active: "boolean" } },
    columns: [{ name: "name", type: "text" }, { name: "payload", type: "json" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const post = (b) => c.post(`/api/db/${slug}/rows/events`, b, { token: ADMIN });

// a well-formed payload passes
let ok = await post({ name: "good", payload: { type: "click", count: 3, tags: ["a"], active: true } });
t.ok(ok.json.ok, "valid json shape accepted");
// and round-trips as parsed json
let row = (await c.get(`/api/db/${slug}/rows/events/1`, { token: ADMIN })).json.row;
t.eq(row.payload.count, 3, "json stored + parsed back");

// missing required inner field → 400
t.eq((await post({ name: "x", payload: { type: "click", count: 1, tags: [] } })).status, 400, "missing 'active' → 400");
// wrong inner type → 400
t.eq((await post({ name: "x", payload: { type: "click", count: "three", tags: [], active: true } })).status, 400, "count not a number → 400");
t.eq((await post({ name: "x", payload: { type: "click", count: 1, tags: "nope", active: true } })).status, 400, "tags not an array → 400");
// payload not an object → 400
t.eq((await post({ name: "x", payload: [1, 2, 3] })).status, 400, "payload array (not object) → 400");

// column absent entirely → allowed (shape only checks when present)
t.ok((await post({ name: "no-payload" })).json.ok, "omitting the json column is allowed");

// the error message names the offending field
let err = (await post({ name: "x", payload: { type: "click", count: 1, tags: [] } })).json;
t.ok(/payload\.active/.test(err.error || ""), "error names payload.active");

t.done(); h.restore();
