// Batch 337 — GEO DISTANCE. Stateless haversine distance + bearing between two coordinates. Covers a known
// distance, km/mi units, zero distance, bearing direction, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 337");
const slug = "b337";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const geo = (body) => c.post(`/api/db/${slug}/geo-distance`, body).then((r) => r.json);

// --- London ↔ Paris ≈ 344 km ---
let r = await geo({ from: { lat: 51.5074, lng: -0.1278 }, to: { lat: 48.8566, lng: 2.3522 } });
t.ok(r.distance > 330 && r.distance < 360, "London→Paris is ~344 km");
t.eq(r.unit, "km", "defaults to km");

// --- Same in miles ---
r = await geo({ from: { lat: 51.5074, lng: -0.1278 }, to: { lat: 48.8566, lng: 2.3522 }, unit: "mi" });
t.ok(r.distance > 205 && r.distance < 225, "…~214 mi in miles");
t.eq(r.unit, "mi", "unit echoed");

// --- Zero distance ---
r = await geo({ from: { lat: 40, lng: -70 }, to: { lat: 40, lng: -70 } });
t.eq(r.distance, 0, "same point → 0 distance");

// --- Bearing: due east ---
r = await geo({ from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 10 } });
t.ok(r.bearing > 89 && r.bearing < 91, "moving east → bearing ~90°");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/geo-distance`, { from: { lat: 0, lng: 0 } })).status, 400, "missing 'to' → 400");
t.eq((await c.post(`/api/db/${slug}/geo-distance`, { from: { lat: 200, lng: 0 }, to: { lat: 0, lng: 0 } })).status, 400, "an out-of-range lat → 400");

t.done(); h.restore();
