// Batch 236 — BACK-IN-STOCK / PRICE-DROP NOTIFY. A visitor asks to be told when an item is available/
// cheaper; the admin lists pending subscribers and fires them (marking notified). Covers subscribe (public),
// dedup, kind separation, admin list, fire (returns emails + marks notified), re-subscribe after notify,
// unsubscribe, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 236");
const slug = "b236";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const sub = (item, body) => c.post(`/api/db/${slug}/notify-me/${item}`, body).then((r) => r.json);
const list = (tok, item, q) => c.get(`/api/db/${slug}/notify-me/${item}${q || ""}`, { token: tok }).then((r) => r.json);
const fire = (tok, item, body) => c.post(`/api/db/${slug}/notify-me/${item}/fire`, body || {}, { token: tok }).then((r) => r.json);
const unsub = (item, email) => c.del(`/api/db/${slug}/notify-me/${item}?email=${encodeURIComponent(email)}`).then((r) => r.json);

// --- Subscribe (public) ---
t.eq((await sub("sku-1", { email: "Fan@x.io" })).subscribed, true, "public subscribes to an item");
await sub("sku-1", { email: "two@x.io" });
await sub("sku-1", { email: "fan@x.io" }); // dedup (case-insensitive lowercased)
t.eq((await list(A, "sku-1")).pending, 2, "two distinct pending subscribers (dedup)");

// --- Kind separation ---
await sub("sku-1", { email: "fan@x.io", kind: "price_drop" });
t.eq((await list(A, "sku-1")).pending, 3, "a different kind is a separate subscription");
t.eq((await list(A, "sku-1", "?kind=price_drop")).pending, 1, "…filter by kind");

// --- Fire back_in_stock: returns emails + marks notified ---
let f = await fire(A, "sku-1"); // default kind back_in_stock
t.eq(f.notified, 2, "fired 2 back-in-stock subscribers");
t.ok(f.emails.includes("fan@x.io") && f.emails.includes("two@x.io"), "…returns the email list to send");
t.eq((await list(A, "sku-1", "?kind=back_in_stock")).pending, 0, "…now none pending for that kind");
t.eq((await list(A, "sku-1", "?kind=price_drop")).pending, 1, "…the price_drop sub is untouched");

// --- Firing again notifies nobody (already sent) ---
t.eq((await fire(A, "sku-1")).notified, 0, "re-firing notifies nobody new");

// --- Re-subscribing after a notify re-arms it ---
await sub("sku-1", { email: "fan@x.io" });
t.eq((await list(A, "sku-1", "?kind=back_in_stock")).pending, 1, "re-subscribing clears the notified flag");

// --- Unsubscribe ---
t.eq((await unsub("sku-1", "fan@x.io")).unsubscribed, true, "unsubscribe works");
t.eq((await list(A, "sku-1", "?kind=back_in_stock")).pending, 0, "…back to 0 pending");

// --- Validation + authz ---
t.eq((await sub("sku-1", { email: "bad" })).status ?? 400, 400, "a bad email → 400");
t.eq((await c.post(`/api/db/${slug}/notify-me/sku-1`, { email: "bad" })).status, 400, "…confirmed 400");
t.eq((await list(B, "sku-1")).status ?? 403, 403, "a member can't list subscribers → 403");
t.eq((await c.get(`/api/db/${slug}/notify-me/sku-1`, { token: B })).status, 403, "…confirmed 403");
t.eq((await c.post(`/api/db/${slug}/notify-me/sku-1/fire`, {}, { token: B })).status, 403, "a member can't fire → 403");

t.done(); h.restore();
