// Batch 133 — localization / i18n: per-locale translations, fallback, public read, admin write
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 133");
const slug = "b133";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const put = (body, tok) => c.post(`/api/db/${slug}/i18n`, body, { token: tok || ADMIN });
const dict = (locale, fb) => c.get(`/api/db/${slug}/i18n?locale=${locale}${fb ? "&fallback=" + fb : ""}`);

// Admin loads English + a partial French.
await put({ locale: "en", entries: { "home.title": "Welcome", "home.cta": "Sign up", "nav.about": "About" } });
await put({ locale: "fr", entries: { "home.title": "Bienvenue", "home.cta": "S'inscrire" } }); // nav.about NOT translated

// Public read (no token) returns the locale dict.
let en = (await dict("en")).json;
t.eq(en.values["home.title"], "Welcome", "EN title");
t.eq(Object.keys(en.values).length, 3, "3 EN keys");
let fr = (await dict("fr")).json;
t.eq(fr.values["home.title"], "Bienvenue", "FR title");
t.ok(!("nav.about" in fr.values), "FR has no about (untranslated) without fallback");

// Fallback fills the gaps from another locale.
let frFb = (await dict("fr", "en")).json;
t.eq(frFb.values["home.title"], "Bienvenue", "FR value wins over fallback");
t.eq(frFb.values["nav.about"], "About", "missing FR key falls back to EN");

// Single-key lookup with fallback.
t.eq((await c.get(`/api/db/${slug}/i18n/home.cta?locale=fr`)).json.value, "S'inscrire", "single key FR");
t.eq((await c.get(`/api/db/${slug}/i18n/nav.about?locale=fr&fallback=en`)).json.value, "About", "single key falls back");
t.eq((await c.get(`/api/db/${slug}/i18n/nav.about?locale=fr`)).json.value, null, "no fallback → null");

// Locales list.
t.eq((await c.get(`/api/db/${slug}/i18n/locales`)).json.locales.sort(), ["en", "fr"], "locales listed");

// Namespaces isolate different string sets.
await put({ namespace: "emails", locale: "en", entries: { "welcome.subject": "Hi!" } });
t.ok(!("welcome.subject" in (await dict("en")).json.values), "default namespace doesn't see emails ns");
t.eq((await c.get(`/api/db/${slug}/i18n?namespace=emails&locale=en`)).json.values["welcome.subject"], "Hi!", "emails namespace has its own keys");

// Single-entry upsert overwrites.
await put({ locale: "en", key: "home.title", value: "Welcome back" });
t.eq((await dict("en")).json.values["home.title"], "Welcome back", "single upsert overwrote");

// Writes require admin; reads don't.
t.eq((await put({ locale: "en", key: "x", value: "y" }, USER)).status, 403, "non-admin write → 403");
t.eq((await c.post(`/api/db/${slug}/i18n`, { locale: "en", key: "x", value: "y" })).status, 401, "signed-out write → 401");
t.eq((await dict("en")).status, 200, "read works with no token (public)");

// Delete a single locale's value, or all locales of a key.
await c.del(`/api/db/${slug}/i18n/home.cta?locale=fr`, { token: ADMIN });
t.eq((await c.get(`/api/db/${slug}/i18n/home.cta?locale=fr`)).json.value, null, "FR cta removed");
t.eq((await c.get(`/api/db/${slug}/i18n/home.cta?locale=en`)).json.value, "Sign up", "EN cta still there");
await c.del(`/api/db/${slug}/i18n/home.title`, { token: ADMIN }); // all locales
t.eq((await c.get(`/api/db/${slug}/i18n/home.title?locale=en`)).json.value, null, "title removed in all locales");

// Guards.
t.eq((await dict("")).status, 400, "read without locale → 400");
t.eq((await put({ key: "x", value: "y" })).status, 400, "write without locale → 400");

t.done(); h.restore();
