// Batch 121 — bill of materials: create/replace, multi-level explosion, cycle detection
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 121");
const slug = "b121";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const setBom = (body, tok) => c.post(`/api/db/${slug}/bom`, body, { token: tok || ADMIN });
const explode = (product, qty) => c.get(`/api/db/${slug}/bom/${product}/explode?qty=${qty}`, { token: ADMIN });
const compMap = (arr) => Object.fromEntries(arr.map((x) => [x.component, x.qty]));

// A bike = 2 wheels + 1 frame. A wheel = 1 rim + 30 spokes. (wheel is a sub-assembly.)
t.eq((await setBom({ product: "bike", lines: [{ component: "wheel", qty: 2 }, { component: "frame", qty: 1 }] })).status, 200, "create bike BOM");
await setBom({ product: "wheel", lines: [{ component: "rim", qty: 1 }, { component: "spoke", qty: 30 }] });

// Explode 1 bike → leaf components only (rim, spoke, frame), wheel is a sub-assembly.
let e = await explode("bike", 1);
t.eq(e.status, 200, "explode → 200");
const leaves = compMap(e.json.components);
t.eq(leaves.frame, 1, "1 frame per bike");
t.eq(leaves.rim, 2, "2 rims (2 wheels × 1 rim)");
t.eq(leaves.spoke, 60, "60 spokes (2 wheels × 30)");
t.ok(!("wheel" in leaves), "the sub-assembly is not a leaf component");
t.ok(e.json.subassemblies.some((s) => s.component === "wheel" && s.qty === 2), "wheel listed as a sub-assembly (qty 2)");

// Explode 5 bikes → everything scales.
let e5 = compMap((await explode("bike", 5)).json.components);
t.eq(e5.spoke, 300, "5 bikes → 300 spokes");
t.eq(e5.frame, 5, "5 frames");

// Fractional component quantities.
await setBom({ product: "cake", lines: [{ component: "flour_kg", qty: 0.5 }, { component: "egg", qty: 3 }] });
let cake = compMap((await explode("cake", 4)).json.components);
t.eq(cake.flour_kg, 2, "0.5kg × 4 cakes = 2kg (fractional exact)");
t.eq(cake.egg, 12, "3 eggs × 4");

// Deeper nesting: a component that shares a leaf aggregates across branches.
await setBom({ product: "combo", lines: [{ component: "bike", qty: 1 }, { component: "wheel", qty: 1 }] }); // combo = 1 bike + 1 spare wheel
let combo = compMap((await explode("combo", 1)).json.components);
t.eq(combo.rim, 3, "rims aggregate across bike (2) + spare wheel (1)");
t.eq(combo.spoke, 90, "spokes aggregate: 60 + 30");

// Read + list.
let got = (await c.get(`/api/db/${slug}/bom/bike`, { token: ADMIN })).json;
t.eq(got.lines.length, 2, "bike BOM has 2 lines");
t.ok((await c.get(`/api/db/${slug}/bom`, { token: ADMIN })).json.boms.some((b) => b.product === "bike" && b.component_count === 2), "list shows component_count");

// Replace (upsert) a BOM.
await setBom({ product: "bike", lines: [{ component: "wheel", qty: 2 }, { component: "frame", qty: 1 }, { component: "seat", qty: 1 }] });
t.eq((await c.get(`/api/db/${slug}/bom/bike`, { token: ADMIN })).json.lines.length, 3, "BOM replaced with 3 lines");

// Cycle detection.
await setBom({ product: "a", lines: [{ component: "b", qty: 1 }] });
await setBom({ product: "b", lines: [{ component: "a", qty: 1 }] });
let cyc = await explode("a", 1);
t.eq(cyc.status, 409, "cyclic BOM → 409");
t.eq(cyc.json.code, "cycle", "409 carries cycle code");

// Guards.
t.eq((await setBom({ product: "x", lines: [{ component: "x", qty: 1 }] })).status, 400, "self-component → 400");
t.eq((await setBom({ product: "y", lines: [] })).status, 400, "no lines → 400");
t.eq((await setBom({ lines: [{ component: "a", qty: 1 }] })).status, 400, "missing product → 400");
t.eq((await explode("nonexistent", 1)).status, 404, "explode a product with no BOM → 404");
t.eq((await c.del(`/api/db/${slug}/bom/cake`, { token: ADMIN })).status, 200, "delete a BOM");
t.eq((await c.get(`/api/db/${slug}/bom/cake`, { token: ADMIN })).status, 404, "deleted BOM is gone");
t.eq((await setBom({ product: "z", lines: [{ component: "q", qty: 1 }] }, USER)).status, 403, "non-admin → 403");
t.eq((await c.post(`/api/db/${slug}/bom`, { product: "z", lines: [] })).status, 401, "signed-out → 401");

t.done(); h.restore();
