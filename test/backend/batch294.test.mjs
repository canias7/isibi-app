// Batch 294 — vCARD. A stateless generator turning contact fields into a .vcf (vCard 3.0). Covers full card,
// name splitting, field escaping, optional fields, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 294");
const slug = "b294";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const gen = (body) => c.post(`/api/db/${slug}/vcard`, body);

// --- Full card ---
let r = await gen({ name: "Jane Doe", email: "jane@x.dev", phone: "+1 555 1234", org: "Acme, Inc", title: "CEO", url: "https://x.dev" });
t.eq(r.status, 200, "generates a vCard");
const v = r.text;
t.ok(/BEGIN:VCARD[\s\S]*END:VCARD/.test(v), "wraps in VCARD");
t.ok(/VERSION:3.0/.test(v), "declares version 3.0");
t.ok(/FN:Jane Doe/.test(v), "carries the formatted name");
t.ok(/N:Doe;Jane;;;/.test(v), "splits N into last;first when not given");
t.ok(/EMAIL;TYPE=INTERNET:jane@x.dev/.test(v), "includes the email");
t.ok(/TEL:\+1 555 1234/.test(v), "includes the phone");
t.ok(/ORG:Acme\\, Inc/.test(v), "escapes the comma in ORG");
t.ok(/TITLE:CEO/.test(v), "includes the title");
t.ok(/URL:https:\/\/x.dev/.test(v), "includes the URL");

// --- Explicit first/last ---
r = await gen({ first: "Bob", last: "Smith" });
t.ok(/FN:Bob Smith/.test(r.text), "builds FN from first/last");
t.ok(/N:Smith;Bob;;;/.test(r.text), "uses the given N parts");

// --- Optional fields omitted ---
r = await gen({ name: "Solo" });
t.ok(!/EMAIL/.test(r.text) && !/TEL/.test(r.text), "omits absent fields");

// --- Validation ---
t.eq((await gen({})).status, 400, "no name → 400");

t.done(); h.restore();
