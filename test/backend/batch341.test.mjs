// Batch 341 — CHECKSUM. Stateless hash of a text payload (sha-256 default, sha-1, sha-512). Covers a known
// digest, determinism, difference on change, algo selection, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 341");
const slug = "b341";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const ck = (body) => c.post(`/api/db/${slug}/checksum`, body).then((r) => r.json);

// --- Known SHA-256 of "abc" ---
let r = await ck({ text: "abc" });
t.eq(r.hash, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "SHA-256 of 'abc' matches the known digest");
t.eq(r.algo, "sha-256", "defaults to sha-256");
t.eq(r.length, 64, "…64 hex chars");

// --- Deterministic + change-sensitive ---
t.eq((await ck({ text: "hello" })).hash, (await ck({ text: "hello" })).hash, "same input → same hash");
t.ok((await ck({ text: "hello" })).hash !== (await ck({ text: "hellO" })).hash, "a one-char change changes the hash");

// --- Known SHA-1 of "abc" ---
r = await ck({ text: "abc", algo: "sha-1" });
t.eq(r.hash, "a9993e364706816aba3e25717850c26c9cd0d89d", "SHA-1 of 'abc' matches");
t.eq(r.length, 40, "…40 hex chars");

// --- SHA-512 length ---
t.eq((await ck({ text: "abc", algo: "sha512" })).length, 128, "SHA-512 → 128 hex chars");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/checksum`, {})).status, 400, "a missing text → 400");
t.eq((await c.post(`/api/db/${slug}/checksum`, { text: "x", algo: "md5" })).status, 400, "an unsupported algo → 400");

t.done(); h.restore();
