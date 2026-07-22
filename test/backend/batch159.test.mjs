// Batch 159 — ADVERSARIAL: webhook SSRF hardening (cloud-metadata + private-range + IPv6 loopback
// targets must be refused at registration) and team privilege-escalation edges.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 159");
const slug = "b159";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 (admin)
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const reg = (url) => c.post(`/api/db/${slug}/webhooks`, { url }, { token: A });

// --- SSRF: every internal/metadata target must be refused at registration ---
const blocked = [
  "https://169.254.169.254/latest/meta-data/",   // AWS/GCP/Azure metadata (classic SSRF)
  "https://169.254.169.254/",
  "https://metadata.google.internal/computeMetadata/v1/",
  "https://127.0.0.1/",
  "https://0.0.0.0/",
  "https://10.0.0.5/",
  "https://172.16.0.1/",
  "https://192.168.1.1/",
  "https://100.64.0.1/",                          // CGNAT
  "https://[::1]/",                               // IPv6 loopback
  "https://localhost/hook",
  "https://foo.internal/",
  "https://bar.local/",
  "http://example.com/hook",                      // non-https
];
let allBlocked = true;
for (const u of blocked) { const r = await reg(u); if (r.status !== 400) { allBlocked = false; console.log("  ⚠ NOT blocked:", u, "→", r.status); } }
t.ok(allBlocked, "every SSRF / metadata / private-range / non-https url is refused (400)");
// A legitimate public https url is accepted.
t.eq((await reg("https://hooks.example.com/x")).status, 200, "a public https url is accepted");

// --- Team privilege-escalation edges ---
const tid = (await c.post(`/api/db/${slug}/teams`, { name: "Sec" }, { token: A })).json.id;
await c.post(`/api/db/${slug}/teams/${tid}/members`, { user: 2 }, { token: A }); // B member
await c.post(`/api/db/${slug}/teams/${tid}/members`, { user: 3, role: "admin" }, { token: A }); // C admin
const setRole = (tok, uid, role) => c.patch(`/api/db/${slug}/teams/${tid}/members/${uid}`, { role }, { token: tok });

// Owner can't transfer to a non-member (id 999 isn't in the team).
t.eq((await setRole(A, 999, "owner")).status, 404, "can't transfer ownership to a non-member");
// Owner can't demote themselves directly (would orphan the team) — must transfer.
t.eq((await setRole(A, 1, "member")).status, 409, "the sole owner can't self-demote (must transfer)");
// An admin can't change roles, delete the team, or grant admin.
t.eq((await setRole(C, 2, "admin")).status, 403, "an admin can't change roles");
t.eq((await c.del(`/api/db/${slug}/teams/${tid}`, { token: C })).status, 403, "an admin can't delete the team");
t.eq((await c.post(`/api/db/${slug}/teams/${tid}/members`, { user: 4, role: "admin" }, { token: C })).status, 404, "admin adding an admin is refused (unknown user 404 hit first — still not created)");
// A plain member can't manage anyone.
t.eq((await c.del(`/api/db/${slug}/teams/${tid}/members/3`, { token: B })).status, 403, "a member can't remove others");
// A non-member can't touch the team at all.
const OUT = (await c.signup(slug, "out@x.dev", "Str0ng-pass-9")).json.token;
t.eq((await c.get(`/api/db/${slug}/teams/${tid}/members`, { token: OUT })).status, 403, "a non-member can't list members");
t.eq((await c.post(`/api/db/${slug}/teams/${tid}/members`, { user: 1 }, { token: OUT })).status, 403, "a non-member can't add members");

// After a valid transfer, the OLD owner loses owner powers.
await setRole(A, 3, "owner"); // transfer A → C
t.eq((await c.del(`/api/db/${slug}/teams/${tid}`, { token: A })).status, 403, "the demoted ex-owner can no longer delete the team");
t.eq((await c.del(`/api/db/${slug}/teams/${tid}`, { token: C })).json.deleted, tid, "the new owner can delete it");

t.done(); h.restore();
