// Batch 201 — BADGES / ACHIEVEMENTS. An admin defines badges and awards them to members (once each);
// members read their own; anyone reads the catalog. Covers define/update, catalog + holder counts, award
// (idempotent), my-badges, holders, revoke, delete-cascades-awards, authz + validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 201");
const slug = "b201";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3 member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (em) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(em)[0].id;
const define = (tok, key, body) => c.post(`/api/db/${slug}/badges/${key}`, body, tok === null ? {} : { token: tok });
const catalog = () => c.get(`/api/db/${slug}/badges`);
const award = (tok, key, user) => c.post(`/api/db/${slug}/badges/${key}/award`, { user }, { token: tok });
const revoke = (tok, key, user) => c.del(`/api/db/${slug}/badges/${key}/award/${user}`, { token: tok });
const holders = (tok, key) => c.get(`/api/db/${slug}/badges/${key}/holders`, { token: tok });
const mine = (tok) => c.get(`/api/db/${slug}/badges/mine`, { token: tok });
const delBadge = (tok, key) => c.del(`/api/db/${slug}/badges/${key}`, { token: tok });
const bId = idOf("b@x.dev"), cId = idOf("c@x.dev");

// --- Define (admin) ---
t.eq((await define(A, "early", { name: "Early Bird", description: "Joined early", icon: "🐦" })).json.key, "early", "admin defines a badge");
t.eq((await define(A, "pro", { name: "Pro" })).json.name, "Pro", "…and a second");

// --- Catalog (public) with holder counts ---
let cat = (await catalog()).json.badges;
t.eq(cat.length, 2, "catalog lists both badges");
t.eq(cat.find((x) => x.key === "early").holders, 0, "…with 0 holders initially");

// --- Award (admin, idempotent) ---
t.eq((await award(A, "early", bId)).json.awarded, true, "admin awards a badge");
t.eq((await award(A, "early", bId)).json.already, true, "…awarding again is idempotent");
await award(A, "early", cId);
t.eq((await catalog()).json.badges.find((x) => x.key === "early").holders, 2, "holder count reflects 2 awards");

// --- My badges (member) ---
t.eq((await mine(B)).json.badges.length, 1, "B sees 1 earned badge");
t.eq((await mine(B)).json.badges[0].name, "Early Bird", "…with the badge's name joined in");
t.eq((await mine(A)).json.badges.length, 0, "the admin (unawarded) has none");

// --- Holders (admin) ---
t.eq((await holders(A, "early")).json.holders.length, 2, "holders lists both members");

// --- Revoke (admin) ---
t.eq((await revoke(A, "early", cId)).json.revoked, true, "admin revokes C's badge");
t.eq((await mine(C)).json.badges.length, 0, "…C now has none");
t.eq((await revoke(A, "early", cId)).status, 404, "revoking again → 404");

// --- Update via re-define (upsert) ---
t.eq((await define(A, "early", { name: "Early Adopter" })).json.name, "Early Adopter", "re-defining updates the name");
t.eq((await mine(B)).json.badges[0].name, "Early Adopter", "…reflected in B's badge");

// --- Delete cascades awards ---
t.eq((await delBadge(A, "early")).json.deleted, true, "admin deletes the badge");
t.eq((await mine(B)).json.badges.length, 0, "…and B's award is gone");
t.eq((await catalog()).json.badges.length, 1, "…catalog down to 1");

// --- Validation + authz ---
t.eq((await define(A, "x", {})).status, 400, "define with no name → 400");
t.eq((await award(A, "pro", 999999)).status, 404, "awarding a non-existent user → 404");
t.eq((await award(A, "ghost", bId)).status, 404, "awarding a non-existent badge → 404");
t.eq((await define(B, "hax", { name: "n" })).status, 403, "a member can't define → 403");
t.eq((await award(B, "pro", cId)).status, 403, "a member can't award → 403");
t.eq((await holders(B, "pro")).status, 403, "a member can't read holders → 403");
t.eq((await mine(null)).status, 401, "signed-out my-badges → 401");

t.done(); h.restore();
