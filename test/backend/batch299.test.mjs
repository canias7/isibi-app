// Batch 299 — QR PAYLOAD BUILDER. Stateless: assemble the STRING to encode in a QR code for each type. Covers
// url, tel, sms, mailto, geo, wifi (with escaping + nopass), vcard (MECARD), validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 299");
const slug = "b299";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const qr = (body) => c.post(`/api/db/${slug}/qr`, body).then((r) => r.json);

t.eq((await qr({ type: "url", url: "https://isibi.ai" })).payload, "https://isibi.ai", "url payload passes through");
t.eq((await qr({ type: "tel", phone: "+15551234" })).payload, "tel:+15551234", "tel prefixes tel:");
t.eq((await qr({ type: "sms", phone: "+15551234", message: "hi" })).payload, "SMSTO:+15551234:hi", "sms builds SMSTO");
t.ok(/^mailto:jane@x\.dev\?subject=Hi/.test((await qr({ type: "mailto", email: "jane@x.dev", subject: "Hi" })).payload), "mailto builds a mailto: with query");
t.eq((await qr({ type: "geo", lat: 40.7, lng: -74 })).payload, "geo:40.7,-74", "geo builds geo:");

// wifi
let w = (await qr({ type: "wifi", ssid: "MyNet", password: "s3cret", encryption: "WPA" })).payload;
t.ok(/^WIFI:T:WPA;S:MyNet;P:s3cret;;$/.test(w), "wifi builds a WIFI: string");
let wn = (await qr({ type: "wifi", ssid: "Open", encryption: "nopass" })).payload;
t.ok(/^WIFI:T:NOPASS;S:Open;;$/.test(wn), "an open network omits the password");
let we = (await qr({ type: "wifi", ssid: "a;b,c" })).payload;
t.ok(/S:a\\;b\\,c;/.test(we), "special chars in the SSID are escaped");

// vcard (MECARD)
let v = (await qr({ type: "vcard", name: "Jane Doe", phone: "555", email: "j@x.dev" })).payload;
t.ok(/^MECARD:N:Jane Doe;/.test(v) && /TEL:555;/.test(v) && /EMAIL:j@x\.dev;/.test(v), "vcard builds a MECARD");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/qr`, { type: "url" })).status, 400, "a missing url → 400");
t.eq((await c.post(`/api/db/${slug}/qr`, { type: "geo", lat: 40 })).status, 400, "geo without lng → 400");
t.eq((await c.post(`/api/db/${slug}/qr`, { type: "wifi" })).status, 400, "wifi without ssid → 400");
t.eq((await c.post(`/api/db/${slug}/qr`, { type: "bogus", text: "x" })).status, 400, "an unknown type → 400");

t.done(); h.restore();
