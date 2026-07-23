// Batch 327 — TEMPLATE RENDER (mustache-lite). {{key}} escaped, {{{key}}} raw, {{#key}}…{{/key}} sections +
// array iteration with {{.}}, {{^key}}…{{/key}} inverted, dot paths. Covers each, escaping, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 327");
const slug = "b327";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const rn = (template, data) => c.post(`/api/db/${slug}/template-render`, { template, data }, { token: A }).then((r) => r.json);

// --- Basic substitution + escaping ---
t.eq((await rn("Hello {{name}}!", { name: "Ada" })).rendered, "Hello Ada!", "substitutes a value");
t.eq((await rn("{{html}}", { html: "<b>&\"</b>" })).rendered, "&lt;b&gt;&amp;&quot;&lt;/b&gt;", "escapes HTML by default");
t.eq((await rn("{{{html}}}", { html: "<b>hi</b>" })).rendered, "<b>hi</b>", "triple-mustache is raw");

// --- Missing key → empty ---
t.eq((await rn("[{{missing}}]", {}).then((r) => r.rendered)), "[]", "a missing key renders empty");

// --- Dot paths ---
t.eq((await rn("{{user.name}}", { user: { name: "Bo" } })).rendered, "Bo", "dot paths resolve nested keys");

// --- Sections: truthy shows, falsy hides ---
t.eq((await rn("{{#show}}yes{{/show}}", { show: true })).rendered, "yes", "a truthy section renders");
t.eq((await rn("{{#show}}yes{{/show}}", { show: false })).rendered, "", "a falsy section is hidden");

// --- Inverted sections ---
t.eq((await rn("{{^empty}}none{{/empty}}", { empty: false })).rendered, "none", "inverted section shows when falsy");
t.eq((await rn("{{^empty}}none{{/empty}}", { empty: true })).rendered, "", "…and hides when truthy");

// --- Array iteration with {{.}} ---
t.eq((await rn("{{#items}}[{{.}}]{{/items}}", { items: ["a", "b", "c"] })).rendered, "[a][b][c]", "iterates a scalar array with {{.}}");

// --- Array of objects ---
t.eq((await rn("{{#users}}{{name}};{{/users}}", { users: [{ name: "x" }, { name: "y" }] })).rendered, "x;y;", "iterates objects, resolving fields");

// --- Empty array → nothing, inverted → shows ---
t.eq((await rn("{{#items}}x{{/items}}", { items: [] })).rendered, "", "an empty array section renders nothing");
t.eq((await rn("{{^items}}empty{{/items}}", { items: [] })).rendered, "empty", "…and its inverse shows");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/template-render`, { data: {} }, { token: A })).status, 400, "a missing template → 400");

t.done(); h.restore();
