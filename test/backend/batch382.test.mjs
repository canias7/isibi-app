// Batch 382 — GEOFENCE. Stateless point-in-region test: circle (center+radius, with distance), bounding box, or
// polygon (ray casting). Covers each shape inside/outside + validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 382");
const slug = "b382";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const gf = (point, fence) => c.post(`/api/db/${slug}/geofence`, { point, fence }).then((r) => r.json);

// --- Circle: inside + distance ---
// SF ~ (37.7749,-122.4194). A point ~1km away should be inside a 5km circle.
let r = await gf({ lat: 37.7849, lon: -122.4194 }, { type: "circle", center: { lat: 37.7749, lon: -122.4194 }, radius_m: 5000 });
t.eq(r.inside, true, "a nearby point is inside a 5km circle");
t.ok(r.distance_m > 900 && r.distance_m < 1300, "…distance ~1.1km");
// Same point, tiny 100m circle → outside.
t.eq((await gf({ lat: 37.7849, lon: -122.4194 }, { type: "circle", center: { lat: 37.7749, lon: -122.4194 }, radius_m: 100 })).inside, false, "outside a 100m circle");

// --- Bounding box ---
const bbox = { type: "bbox", min_lat: 0, min_lon: 0, max_lat: 10, max_lon: 10 };
t.eq((await gf({ lat: 5, lon: 5 }, bbox)).inside, true, "a point inside the box");
t.eq((await gf({ lat: 5, lon: 15 }, bbox)).inside, false, "a point east of the box");
t.eq((await gf({ lat: 0, lon: 0 }, bbox)).inside, true, "a corner counts as inside");

// --- Polygon (a unit-ish square via ray casting) ---
const square = { type: "polygon", points: [{ lat: 0, lon: 0 }, { lat: 0, lon: 4 }, { lat: 4, lon: 4 }, { lat: 4, lon: 0 }] };
t.eq((await gf({ lat: 2, lon: 2 }, square)).inside, true, "center of the polygon is inside");
t.eq((await gf({ lat: 2, lon: 5 }, square)).inside, false, "a point outside the polygon");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/geofence`, { point: { lat: 200, lon: 0 }, fence: { type: "bbox", min_lat: 0, min_lon: 0, max_lat: 1, max_lon: 1 } })).status, 400, "an out-of-range point → 400");
t.eq((await c.post(`/api/db/${slug}/geofence`, { point: { lat: 1, lon: 1 }, fence: { type: "circle" } })).status, 400, "a circle missing center/radius → 400");
t.eq((await c.post(`/api/db/${slug}/geofence`, { point: { lat: 1, lon: 1 }, fence: { type: "polygon", points: [{ lat: 0, lon: 0 }] } })).status, 400, "a polygon with < 3 points → 400");
t.eq((await c.post(`/api/db/${slug}/geofence`, { point: { lat: 1, lon: 1 }, fence: { type: "bogus" } })).status, 400, "an unknown fence type → 400");

t.done(); h.restore();
