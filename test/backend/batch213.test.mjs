// Batch 213 — GIVEAWAY / SWEEPSTAKES. Members enter an open giveaway (once each), an admin randomly draws
// winners. Covers open, enter (dedup, only while open), public read (entries/mine), draw (winners come from
// entrants, count respected), closed-after-draw, list, delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 213");
const slug = "b213";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const toks = [A];
for (const e of ["b", "c", "d", "e", "f"]) toks.push((await c.signup(slug, `${e}@x.dev`, "Str0ng-pass-9")).json.token);
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const ids = h.getDb(uuid).prepare("SELECT id FROM _users").all().map((r) => r.id);
const open = (tok, key, body) => c.post(`/api/db/${slug}/giveaways/${key}`, body || {}, tok === null ? {} : { token: tok });
const enter = (tok, key) => c.post(`/api/db/${slug}/giveaways/${key}/enter`, {}, { token: tok });
const draw = (tok, key, body) => c.post(`/api/db/${slug}/giveaways/${key}/draw`, body || {}, { token: tok });
const read = (tok, key) => c.get(`/api/db/${slug}/giveaways/${key}`, tok ? { token: tok } : {}).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/giveaways`).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/giveaways/${key}`, { token: tok });

// --- Open (admin) ---
t.eq((await open(A, "prize", { title: "Win a Mug" })).json.status, "open", "admin opens a giveaway");

// --- Enter (members, dedup) ---
for (const tk of toks.slice(1)) await enter(tk, "prize"); // b..f enter (5)
t.eq((await enter(toks[1], "prize")).json.already, true, "entering twice is idempotent");
t.eq((await read(null, "prize")).entries, 5, "5 distinct entries");
t.eq((await read(toks[1], "prize")).mine, true, "an entrant sees mine:true");
t.eq((await read(A, "prize")).mine, false, "a non-entrant sees mine:false");

// --- Draw (admin) — winners must be actual entrants ---
const entrantIds = new Set(h.getDb(uuid).prepare("SELECT user_id FROM _giveaway_entries WHERE giveaway='prize'").all().map((r) => r.user_id));
let d = (await draw(A, "prize", { count: 2 })).json;
t.eq(d.winners.length, 2, "drew 2 winners");
t.ok(d.winners.every((w) => entrantIds.has(w)), "every winner is a real entrant");
t.eq(new Set(d.winners).size, 2, "winners are distinct");

// --- Closed after draw ---
t.eq((await read(null, "prize")).status, "drawn", "status is drawn");
t.eq((await enter(toks[1], "prize")).status, 409, "entries are closed after the draw");
t.eq((await draw(A, "prize")).status, 409, "can't draw twice → 409");

// --- Count clamps to entrant pool ---
await open(A, "small", {});
await enter(toks[1], "small"); await enter(toks[2], "small");
t.eq((await draw(A, "small", { count: 10 })).json.winners.length, 2, "asking for more winners than entrants yields all entrants");

// --- Draw with no entries ---
await open(A, "empty", {});
t.eq((await draw(A, "empty")).status, 400, "drawing with no entries → 400");

// --- List (public) ---
t.ok((await list()).giveaways.length >= 3, "public lists giveaways");

// --- Delete ---
t.eq((await del(A, "small")).json.deleted, true, "admin deletes a giveaway");
t.eq((await read(null, "small")).ok ?? false, false, "…it's gone");

// --- Validation + authz ---
t.eq((await enter(toks[1], "nope")).status, 404, "entering a missing giveaway → 404");
t.eq((await open(toks[1], "hax")).status, 403, "a member can't open → 403");
t.eq((await draw(toks[1], "prize")).status, 403, "a member can't draw → 403");
t.eq((await del(toks[1], "prize")).status, 403, "a member can't delete → 403");
t.eq((await c.post(`/api/db/${slug}/giveaways/prize/enter`, {})).status, 401, "signed-out enter → 401");

t.done(); h.restore();
