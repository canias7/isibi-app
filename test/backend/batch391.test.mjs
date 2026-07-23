// Batch 391 — MIME DETECT. Stateless magic-byte content sniffer from base64/hex. Covers PNG/JPEG/GIF/PDF/ZIP/
// GZIP/WEBP + unknown + category + validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 391");
const slug = "b391";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const hexToB64 = (hex) => { const bytes = hex.match(/.{2}/g).map((b) => parseInt(b, 16)); return Buffer.from(bytes).toString("base64"); };
const byB64 = (hex) => c.post(`/api/db/${slug}/mime-detect`, { base64: hexToB64(hex) }).then((r) => r.json);
const byHex = (hex) => c.post(`/api/db/${slug}/mime-detect`, { hex }).then((r) => r.json);

// --- Images ---
t.eq((await byB64("89504e470d0a1a0a0000")).mime, "image/png", "PNG magic");
t.eq((await byB64("ffd8ffe000104a464946")).mime, "image/jpeg", "JPEG magic");
t.eq((await byB64("474946383961010001")).mime, "image/gif", "GIF89a magic");
t.eq((await byB64("5249464624000000574542505650")).mime, "image/webp", "WEBP (RIFF…WEBP)");

// --- Documents / archives ---
t.eq((await byB64("255044462d312e34")).mime, "application/pdf", "PDF magic");
t.eq((await byB64("504b0304140000")).mime, "application/zip", "ZIP magic");
t.eq((await byB64("1f8b0800")).mime, "application/gzip", "GZIP magic");

// --- Category + ext ---
let r = await byB64("89504e470d0a1a0a");
t.eq(r.category, "image", "PNG category is image");
t.eq(r.ext, "png", "…ext png");
t.eq(r.detected, true, "…detected");

// --- Hex input works too ---
t.eq((await byHex("25504446")).mime, "application/pdf", "hex input detects PDF");
t.eq((await byHex("FF D8 FF")).mime, "image/jpeg", "hex with spaces/uppercase");

// --- Unknown ---
r = await byB64("00010203aabbcc");
t.eq(r.detected, false, "random bytes → not detected");
t.eq(r.mime, null, "…mime null");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/mime-detect`, {})).status, 400, "no input → 400");
t.eq((await c.post(`/api/db/${slug}/mime-detect`, { hex: "xyz" })).status, 400, "bad hex → 400");

t.done(); h.restore();
