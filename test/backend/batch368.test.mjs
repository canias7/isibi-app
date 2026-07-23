// Batch 368 — TAX-EXEMPTION REGISTRY. One certificate per customer key, optional region + expiry; the check
// reports whether the customer is CURRENTLY exempt (expired certs read not-exempt). Covers register, status,
// re-register (upsert), expiry, list, revoke, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 368");
const slug = "b368";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const reg = (tok, body) => c.post(`/api/db/${slug}/tax-exempt`, body, { token: tok });
const status = (tok, cust) => c.get(`/api/db/${slug}/tax-exempt/${cust}`, { token: tok });

// --- Register ---
let r = (await reg(A, { customer: "acme-co", certificate: "CERT-123", region: "NY" })).json;
t.eq(r.exempt, true, "a fresh certificate is exempt");
t.eq(r.certificate, "CERT-123", "…with the cert id");
t.eq(r.region, "NY", "…and region");

// --- Status of an unknown customer ---
t.eq((await status(A, "nobody")).json.exempt, false, "an unregistered customer is not exempt");

// --- Re-register upserts ---
await reg(A, { customer: "acme-co", certificate: "CERT-456", region: "CA" });
t.eq((await status(A, "acme-co")).json.certificate, "CERT-456", "re-registering replaces the cert (upsert)");

// --- Expiry: a past `expires` reads not-exempt (hides the cert) ---
await reg(A, { customer: "lapsed-co", certificate: "OLD-1", expires: "2020-01-01" });
r = (await status(A, "lapsed-co")).json;
t.eq(r.exempt, false, "an expired certificate is not exempt");
t.eq(r.certificate, null, "…and the cert is hidden");

// --- A future expiry is still exempt ---
t.eq((await reg(A, { customer: "future-co", certificate: "F-1", expires: "2099-01-01" })).json.exempt, true, "a future expiry is still exempt");

// --- List ---
t.ok((await c.get(`/api/db/${slug}/tax-exempt`, { token: A }).then((x) => x.json)).certificates.length >= 3, "admin lists certificates");

// --- Revoke ---
t.eq((await c.del(`/api/db/${slug}/tax-exempt/acme-co`, { token: A })).json.revoked, true, "admin revokes a certificate");
t.eq((await status(A, "acme-co")).json.exempt, false, "…and the customer is no longer exempt");
t.eq((await c.del(`/api/db/${slug}/tax-exempt/ghost`, { token: A })).status, 404, "revoking an unknown customer → 404");

// --- Validation + authz ---
t.eq((await reg(A, { customer: "x" })).status, 400, "no certificate → 400");
t.eq((await reg(A, { customer: "bad customer!", certificate: "c" })).status, 400, "an invalid customer key → 400");
t.eq((await reg(A, { customer: "y", certificate: "c", expires: "not-a-date" })).status, 400, "a bad expiry → 400");
t.eq((await reg(B, { customer: "z", certificate: "c" })).status, 403, "a member can't register → 403");
t.eq((await c.get(`/api/db/${slug}/tax-exempt/acme-co`, { token: B })).status, 403, "a member can't read → 403");
t.eq((await c.post(`/api/db/${slug}/tax-exempt`, { customer: "w", certificate: "c" })).status, 401, "signed-out → 401");

t.done(); h.restore();
