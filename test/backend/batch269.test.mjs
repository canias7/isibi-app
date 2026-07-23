// Batch 269 — WAIVERS. A member e-signs a versioned waiver (name + signature text); an admin reads the
// signatures. Covers define, public read, sign, mine, version bump invalidates a prior signature,
// signatures log (admin), delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 269");
const slug = "b269";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const define = (tok, doc, body) => c.post(`/api/db/${slug}/waivers/${doc}`, body, tok === null ? {} : { token: tok });
const read = (doc) => c.get(`/api/db/${slug}/waivers/${doc}`).then((r) => r.json);
const sign = (tok, doc, body) => c.post(`/api/db/${slug}/waivers/${doc}/sign`, body, { token: tok });
const mine = (tok, doc) => c.get(`/api/db/${slug}/waivers/${doc}/mine`, { token: tok }).then((r) => r.json);
const signatures = (tok, doc) => c.get(`/api/db/${slug}/waivers/${doc}/signatures`, { token: tok }).then((r) => r.json);
const del = (tok, doc) => c.del(`/api/db/${slug}/waivers/${doc}`, { token: tok });

// --- Define ---
t.eq((await define(A, "liability", { title: "Liability Waiver", body: "I agree...", version: "1" })).json.version, "1", "admin defines a waiver at v1");
t.eq((await read("liability")).waiver.title, "Liability Waiver", "public reads the waiver");

// --- Sign ---
t.eq((await mine(B, "liability")).signed, false, "before signing → signed:false");
t.eq((await sign(B, "liability", { name: "Bob B", signature: "Bob" })).json.signed, true, "member signs");
let m = await mine(B, "liability");
t.eq(m.signed, true, "…now signed");
t.ok(m.signed_at, "…with a timestamp");
await sign(C, "liability", { name: "Carol C" });

// --- Version bump invalidates a prior signature ---
await define(A, "liability", { title: "Liability Waiver", version: "2" });
t.eq((await mine(B, "liability")).version, "2", "current version bumped to 2");
t.eq((await mine(B, "liability")).signed, false, "…B's v1 signature no longer counts for v2");
await sign(B, "liability", { name: "Bob B" });
t.eq((await mine(B, "liability")).signed, true, "…re-signing v2 works");

// --- Signatures log (admin) ---
let sig = (await signatures(A, "liability")).signatures;
t.ok(sig.length >= 2, "admin reads the signature log");
t.ok(sig.some((s) => s.version === "2"), "…including v2 signatures");

// --- Delete ---
t.eq((await del(A, "liability")).json.deleted, true, "admin deletes the waiver");
t.eq((await read("liability")).status ?? 404, 404, "…gone");

// --- Validation + authz ---
t.eq((await define(A, "x", {})).json.version, "1", "version defaults to 1");
t.eq((await read("nope")).status ?? 404, 404, "unknown waiver → 404");
t.eq((await c.post(`/api/db/${slug}/waivers/x/sign`, {}, { token: B })).status, 400, "signing with no name → 400");
t.eq((await c.post(`/api/db/${slug}/waivers/x/sign`, { name: "x" })).status, 401, "signed-out sign → 401");
t.eq((await c.post(`/api/db/${slug}/waivers/ghost/sign`, { name: "x" }, { token: B })).status, 404, "signing a missing waiver → 404");
t.eq((await define(B, "hax", { title: "x" })).status, 403, "a member can't define → 403");
t.eq((await signatures(B, "x")).status ?? 403, 403, "a member can't read signatures → 403");
t.eq((await c.get(`/api/db/${slug}/waivers/x/signatures`, { token: B })).status, 403, "…confirmed 403");

t.done(); h.restore();
