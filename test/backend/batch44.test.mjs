import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 44");
const slug = "b44";
await c.ensure(slug);
await c.schema(slug, { tables: {
  places: { access: "feed", geo: { lat: "latitude", lng: "longitude" }, columns: { name: "text", latitude: "real", longitude: "real" } },
  autos: { access: "feed", columns: { name: "text", lat: "real", lng: "real" } }, // auto-detect lat/lng
  plain: { access: "feed", columns: { name: "text" } },
}});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
// SF ~37.7749,-122.4194 ; Oakland ~37.8044,-122.2712 (~13km) ; NYC ~40.7128,-74.0060 (far)
const P = (name, la, lo) => c.post(`/api/db/${slug}/rows/places`, { name, latitude: la, longitude: lo }, { token: A });
await P("SF", 37.7749, -122.4194);
await P("Oakland", 37.8044, -122.2712);
await P("NYC", 40.7128, -74.0060);
await P("Berkeley", 37.8715, -122.2730); // ~16km from SF

// within 20km of SF -> SF, Oakland, Berkeley (not NYC), sorted by distance (SF first)
let r = await c.get(`/api/db/${slug}/rows/places/near?lat=37.7749&lng=-122.4194&radius=20`);
const names = r.json.rows.map(x=>x.name);
t.ok(!names.includes("NYC"), "NYC excluded (>20km)");
t.ok(names[0] === "SF", "nearest first = SF (distance 0)");
t.ok(r.json.rows[0]._distance_km === 0, "SF distance_km = 0");
t.ok(names.includes("Oakland") && names.includes("Berkeley"), "Oakland + Berkeley within 20km");
t.ok(r.json.rows.every((x,i,a)=> i===0 || a[i-1]._distance_km <= x._distance_km), "sorted ascending by distance");

// tight radius 5km -> just SF
r = await c.get(`/api/db/${slug}/rows/places/near?lat=37.7749&lng=-122.4194&radius=5`);
t.eq(r.json.rows.map(x=>x.name), ["SF"], "radius 5km -> only SF");

// auto-detected lat/lng columns
await c.post(`/api/db/${slug}/rows/autos`, { name: "here", lat: 1.0, lng: 1.0 }, { token: A });
await c.post(`/api/db/${slug}/rows/autos`, { name: "far", lat: 50.0, lng: 50.0 }, { token: A });
r = await c.get(`/api/db/${slug}/rows/autos/near?lat=1.0&lng=1.0&radius=100`);
t.eq(r.json.rows.map(x=>x.name), ["here"], "auto-detected lat/lng works");

// missing coords -> 400
t.ok((await c.get(`/api/db/${slug}/rows/places/near?radius=5`)).status === 400, "no lat/lng -> 400");
// table without geo -> 400
t.ok((await c.get(`/api/db/${slug}/rows/plain/near?lat=1&lng=1`)).status === 400, "non-geo table -> 400");
t.done(); h.restore();
