// Batch 357 — BASE64. Stateless base64 / base64url encode + decode for UTF-8 text.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 357");
const slug = "b357";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const b64 = (body) => c.post(`/api/db/${slug}/base64`, body).then((r) => r.json);

// --- Encode (known value) ---
t.eq((await b64({ text: "hello", mode: "encode" })).result, "aGVsbG8=", "'hello' → aGVsbG8=");

// --- Decode round-trip ---
t.eq((await b64({ text: "aGVsbG8=", mode: "decode" })).result, "hello", "aGVsbG8= → hello");

// --- UTF-8 ---
let enc = (await b64({ text: "café ☕", mode: "encode" })).result;
t.eq((await b64({ text: enc, mode: "decode" })).result, "café ☕", "UTF-8 round-trips");

// --- base64url (no padding, - and _) ---
let r = await b64({ text: "<<subjects>>", mode: "encode", urlsafe: true });
t.ok(!/[+/=]/.test(r.result), "urlsafe output has no + / or = chars");
t.eq((await b64({ text: r.result, mode: "decode", urlsafe: true })).result, "<<subjects>>", "…and decodes back");

// --- urlsafe auto-detected on decode ---
let std = (await b64({ text: "??>>", mode: "encode" })).result;
let urls = std.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
t.eq((await b64({ text: urls, mode: "decode" })).result, "??>>", "decode auto-handles url-safe input");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/base64`, {})).status, 400, "missing text → 400");
t.eq((await c.post(`/api/db/${slug}/base64`, { text: "!!not base64!!", mode: "decode" })).status, 400, "invalid base64 on decode → 400");
t.eq((await c.post(`/api/db/${slug}/base64`, { text: "x", mode: "bogus" })).status, 400, "an unknown mode → 400");

t.done(); h.restore();
