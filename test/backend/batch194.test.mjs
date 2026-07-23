// Batch 194 — PER-MEMBER SETTINGS (key→value store). Each member keeps arbitrary JSON settings for
// themselves. Covers set/get one, bulk get/set, JSON value types, delete, per-member isolation, guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 194");
const slug = "b194";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id1
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id2
const all = (tok) => c.get(`/api/db/${slug}/settings`, { token: tok }).then((r) => r.json.settings);
const getOne = (tok, k) => c.get(`/api/db/${slug}/settings/${k}`, { token: tok }).then((r) => r.json);
const setOne = (tok, k, value) => c.post(`/api/db/${slug}/settings/${k}`, { value }, { token: tok });
const bulk = (tok, body) => c.post(`/api/db/${slug}/settings`, body, tok === null ? {} : { token: tok });
const delOne = (tok, k) => c.del(`/api/db/${slug}/settings/${k}`, { token: tok });

// --- Empty, then set one ---
t.eq(await all(B), {}, "no settings yet → {}");
t.eq((await setOne(B, "theme", "dark")).status, 200, "set theme=dark");
t.eq((await getOne(B, "theme")).value, "dark", "get theme → dark");
t.eq((await getOne(B, "missing")).found, false, "an unset key → found:false");

// --- Bulk set + JSON value types ---
await bulk(B, { lang: "en", layout: { cols: 3, dense: true }, tags: [1, 2, 3] });
let s = await all(B);
t.eq([s.theme, s.lang, s.layout.cols, s.tags[2]], ["dark", "en", 3, 3], "bulk set; object + array values preserved");

// --- Overwrite + delete ---
await setOne(B, "theme", "light");
t.eq((await getOne(B, "theme")).value, "light", "overwrite theme → light");
t.eq((await delOne(B, "theme")).json.deleted, true, "delete theme");
t.eq((await getOne(B, "theme")).found, false, "…now unset");
t.ok(!("theme" in (await all(B))), "…and gone from the bulk view");

// --- Per-member isolation ---
await setOne(C, "theme", "solarized");
t.eq((await getOne(C, "theme")).value, "solarized", "C has their own theme");
t.eq((await getOne(B, "theme")).found, false, "…B's is still unset (independent)");
t.ok(!("lang" in (await all(C))), "C doesn't see B's lang");

// --- Validation + guards ---
t.eq((await bulk(B, [1, 2, 3])).status, 400, "bulk set with a non-object → 400");
t.eq((await c.get(`/api/db/${slug}/settings`)).status, 401, "signed-out get → 401");
t.eq((await bulk(null, { a: 1 })).status, 401, "signed-out bulk set → 401");

t.done(); h.restore();
