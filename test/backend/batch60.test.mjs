// Batch 60 — server-side image resize / transform on upload (photon)
// NOTE: photon is wasm and unavailable offline; the harness stub models get_width/
// get_height + non-empty encode output, so this exercises the request plumbing +
// format/ext selection. Actual pixel resizing is verified live by the owner.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 60");

const slug = "b60";
await c.ensure(slug); // makes siteBackendBySlug resolve → the upload route sees a live site

const b64 = (arr) => Buffer.from(arr).toString("base64");
const pngURL = "data:image/png;base64," + b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const pdfURL = "data:application/pdf;base64," + b64([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);

const up = (body) => c.post(`/api/db/${slug}/upload`, body);

// 1) Plain upload, no transform → stored as-is (PNG).
let r1 = await up({ name: "a.png", data: pngURL });
t.ok(r1.status === 200 && r1.json.ok, "plain upload ok");
t.ok(r1.json.type === "image/png" && /\.png$/.test(r1.json.url), "plain upload keeps png type + ext");

// 2) Re-encode to WEBP.
let r2 = await up({ name: "a.png", data: pngURL, format: "webp" });
t.ok(r2.json.ok && r2.json.type === "image/webp" && /\.webp$/.test(r2.json.url), "format:webp → webp type + ext");

// 3) Resize (max) + re-encode to JPEG via a `resize` object.
let r3 = await up({ name: "a.png", data: pngURL, resize: { max: 50, format: "jpeg", quality: 70 } });
t.ok(r3.json.ok && r3.json.type === "image/jpeg" && /\.jpg$/.test(r3.json.url), "resize+jpeg → jpeg type + .jpg ext");

// 4) Resize only (no format) keeps the source type.
let r4 = await up({ name: "a.png", data: pngURL, resize: { w: 40, h: 30 } });
t.ok(r4.json.ok && r4.json.type === "image/png" && /\.png$/.test(r4.json.url), "resize without format keeps png");

// 5) PDF is NOT an image → transform ignored even if a format is asked.
let r5 = await up({ name: "d.pdf", data: pdfURL, format: "webp" });
t.ok(r5.json.ok && r5.json.type === "application/pdf" && /\.pdf$/.test(r5.json.url), "pdf ignores transform, stays pdf");

// 6) A bad format string is ignored (no-op), original kept.
let r6 = await up({ name: "a.png", data: pngURL, format: "tiff" });
t.ok(r6.json.ok && r6.json.type === "image/png", "unknown format ignored → original kept");

// 7) Top-level shortcut params (max) work too.
let r7 = await up({ name: "a.png", data: pngURL, max: 32 });
t.ok(r7.json.ok && r7.json.type === "image/png", "top-level max shortcut works");

t.done();
h.restore();
