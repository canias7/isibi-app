// Batch 169 — ADVERSARIAL: geo /near distance correctness. Known distances within tolerance, the
// same point = 0, the radius boundary, and the classic edge cases a naive formula gets wrong:
// the ANTIMERIDIAN (±180° longitude) and the POLES (converging longitude lines).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 169");
const slug = "b169";
await c.ensure(slug);
await c.schema(slug, { tables: { places: { access: "feed", geo: { lat: "lat", lng: "lng" }, columns: [{ name: "name", type: "text" }, { name: "lat", type: "real" }, { name: "lng", type: "real" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const P = (name, lat, lng) => c.post(`/api/db/${slug}/rows/places`, { name, lat, lng }, { token: A });
const near = (lat, lng, radius) => c.get(`/api/db/${slug}/rows/places/near?lat=${lat}&lng=${lng}&radius=${radius}`).then((r) => r.json.rows);
const distOf = (rows, name) => { const r = rows.find((x) => x.name === name); return r ? r._distance_km : null; };

await P("SF", 37.7749, -122.4194);
await P("Oakland", 37.8044, -122.2712);   // ~13 km from SF
await P("NYC", 40.7128, -74.0060);        // ~4130 km from SF

// --- Known distances within tolerance ---
let big = await near(37.7749, -122.4194, 6000);
t.eq(distOf(big, "SF"), 0, "same point → distance 0");
t.ok(Math.abs(distOf(big, "Oakland") - 13) < 3, "SF→Oakland ≈ 13 km (±3)");
t.ok(Math.abs(distOf(big, "NYC") - 4130) < 150, "SF→NYC ≈ 4130 km (±150)");
t.ok(big.every((x, i, a) => i === 0 || a[i - 1]._distance_km <= x._distance_km), "results sorted ascending by distance");

// --- ANTIMERIDIAN: two points straddling ±180° are actually CLOSE, not ~40000 km apart ---
await P("east", 0, 179.9);
let am = await near(0, -179.9, 60); // 0.2° of longitude at the equator ≈ 22 km
t.ok(am.some((x) => x.name === "east"), "a point at lng 179.9 IS found near lng -179.9 (antimeridian handled)");
t.ok(Math.abs(distOf(am, "east") - 22) < 6, "the cross-antimeridian distance ≈ 22 km, not ~40000 km");
// Sanity: a genuinely far longitude is NOT wrongly pulled in.
await P("halfway", 0, 90);
t.ok(!near(0, -179.9, 60).then ? false : !(await near(0, -179.9, 60)).some((x) => x.name === "halfway"), "a point 90° away is NOT within 60 km");

// --- POLES: near the north pole, two far-apart longitudes are still physically close ---
await P("poleA", 89.95, 0);
await P("poleB", 89.95, 180);  // opposite longitude, but both ~5.5 km from the pole → ~11 km apart
let pole = await near(89.95, 0, 40);
t.ok(pole.some((x) => x.name === "poleB"), "near the pole, the opposite-longitude point is close (found within 40 km)");
t.ok(distOf(pole, "poleB") < 20, "…and its distance is small (~11 km), not a longitude-sized overestimate");

// --- Radius boundary excludes the far ones ---
let tight = await near(37.7749, -122.4194, 5);
t.eq(tight.map((x) => x.name).sort().join(","), "SF", "radius 5 km → only SF");

t.done(); h.restore();
