// Can Grok answer our REAL design_schema tool?
//
// THE CHEAPEST HONEST TEST OF THE ONE THING NOBODY KNOWS. Everything about the
// Grok integration is unit-tested except the question that decides whether it is
// usable at all: does a different provider return a well-formed object against
// an 80KB, 23-field, 13-required tool schema under a FORCED tool call? The whole
// pipeline is built on that answer arriving as structured output.
//
// It costs about two cents of xAI and ZERO platform credits: no Neon project, no
// container, no publish, no account, no ledger. A full build to learn the same
// thing costs ~130 credits and takes four minutes — and if the answer is "no",
// the build fails somewhere downstream where the reason is much harder to read.
//
// AND IT NEEDS NO DEPLOY. It calls xAI directly with the runner's own secret, so
// it answers before the Worker has ever seen the key.
//
// It drives the REAL pieces end to end: the real tool out of the real worker.js
// (`schema-tool.mjs`, shared with the schema eval), the real `toXaiRequest`, and
// the real `fromXaiResponse`. A probe built from a hand-written toy schema would
// prove Grok can fill in a toy schema, which is not the question.

import { readSchemaTool } from "./schema-tool.mjs";
import { toXaiRequest, fromXaiResponse, XAI_ENDPOINT } from "../../builder/model-xai.mjs";
import { BUILD_MODELS } from "../../builder/build-models.mjs";
import { normalizeSchema } from "../../site-schema.mjs";
import { resolveTheme, THEME_SHORTLIST } from "../../builder/site-theme-registry.mjs";
import { MODEL_RATES } from "../../builder/publish-pages.mjs";

const KEY = process.env.XAI_API_KEY || "";
const MODEL = process.env.GROK_MODEL || BUILD_MODELS.grok.design;
const BRIEF = process.env.GROK_BRIEF ||
  "A family-run Italian restaurant in Sheffield. Visitors read the menu with prices, " +
  "see the opening hours, and book a table with a short form — name, phone, date, time, party size.";

let pass = 0, fail = 0;
const ok = (good, name, detail) => {
  if (good) { pass++; console.log("  ok   " + name + (detail ? "  " + detail : "")); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  " + detail : "")); }
};

if (!KEY || KEY === "not-a-key") {
  // AN HONEST STOP, NOT A PASS. A probe that goes green when it could not run is
  // the failure this repo has recorded twice — a vacuous clean report reads
  // exactly like a working feature.
  console.error("XAI_API_KEY is not set (or is the deploy placeholder) — nothing was probed.");
  process.exit(1);
}

console.log("Grok probe — the real design_schema tool, one call\n");
const { tool, system } = await readSchemaTool();
console.log(`  tool: ${tool.name} · ${Object.keys(tool.input_schema.properties).length} fields · ` +
  `${tool.input_schema.required.length} required · ${JSON.stringify(tool).length} chars`);
console.log(`  model: ${MODEL}\n  brief: ${BRIEF.slice(0, 80)}...\n`);

// EXACTLY THE REQUEST `designSiteSchema` BUILDS, so what is measured is what
// production sends. The `cache_control` markers are included precisely because
// the translator is supposed to strip them — leaving them out would skip the
// case rather than test it.
const req = {
  model: MODEL,
  max_tokens: 8000,
  tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
  tool_choice: { type: "tool", name: "design_schema" },
  system: [{ type: "text", cache_control: { type: "ephemeral" }, text: system }],
  messages: [{ role: "user", content: BRIEF }],
};

const { body } = toXaiRequest(req);
ok(!JSON.stringify(body).includes("cache_control"), "the translator stripped cache_control");
ok(body.tool_choice && body.tool_choice.function.name === "design_schema", "the forced tool survived translation");

const t0 = Date.now();
const r = await fetch(XAI_ENDPOINT, {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "content-type": "application/json" },
  body: JSON.stringify(body),
});
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const raw = await r.text();
console.log(`\n  xAI answered ${r.status} in ${secs}s (${raw.length} bytes)`);
// THE SECONDS ARE A FINDING IN THEIR OWN RIGHT, not a progress line. A build
// dies somewhere past ~285s at the edge — measured twice on 2026-08-21 — and
// Sonnet's cold schema call is 29s of that budget. A designer four times slower
// spends the headroom the page call needs, so this number decides whether Grok
// is usable at all, separately from whether its answer is good.
console.log(`  (Sonnet's cold schema call is ~29s; a build dies past ~285s at the edge)\n`);
if (!r.ok) {
  // The provider's own words. This is where a wrong tool SHAPE lands, which is
  // the one thing the docs were ambiguous about — so the message is the fix.
  console.error("  the request was refused:\n  " + raw.slice(0, 600));
  process.exit(1);
}

let j = null;
try { j = JSON.parse(raw); } catch { console.error("  the response was not JSON"); process.exit(1); }
const out = fromXaiResponse(j);

/* ------------------------------------------------- did it answer at all */

const use = out.content.find((b) => b && b.type === "tool_use");
ok(!!use, "it made a tool call", use ? "" : "stop_reason=" + out.stop_reason + " blocks=" + out.content.map((b) => b.type).join(","));
ok(out.stop_reason !== "max_tokens", "it was not cut off at the token ceiling");
if (!use) { console.log(`\n${pass} passed, ${fail} failed — Grok did not use the tool.`); process.exit(1); }

const input = use.input;

/* --------------------------------------- is the answer actually complete */

const missing = tool.input_schema.required.filter((k) => input[k] === undefined || input[k] === null);
ok(missing.length === 0, "all 13 required fields are present", missing.length ? "missing: " + missing.join(", ") : "");

ok(typeof input.brand === "string" && input.brand.length > 0, "brand", input.brand ? `"${input.brand}"` : "");
ok(/^[a-z0-9-]+$/.test(String(input.slug || "")), "slug is well-formed", String(input.slug || ""));
// `tables` STOPPED BEING REQUIRED ON 2026-08-25 — a first build is
// frontend-only by the owner's design, so a trattoria brochure declaring NO
// tables is the CORRECT answer, and this probe failed it for a day ("tables:
// not an array" over a designed omission — a false alarm on a right answer,
// which this repo rates worse than the miss). Absent is a pass; declared must
// be an array, since that is the shape the schema asks for.
ok(input.tables === undefined || (Array.isArray(input.tables) && input.tables.length > 0),
  "tables, when declared, are a non-empty array",
  input.tables === undefined ? "none declared — frontend-only, the designed first-build answer"
    : Array.isArray(input.tables) ? input.tables.map((t) => t && t.name).join(", ") : "not an array");

// THE SEED FIELD IS THE ONE SONNET KEEPS DROPPING, so it is the interesting
// comparison rather than a formality: an unseeded display table is an empty list
// forever and a form that reads it has nothing to choose.
const rawTables = Array.isArray(input.tables) ? input.tables : [];
const displays = rawTables.filter((t) => t && (t.access === "display" || (t.read === "public" && t.write === "none")));
const seeded = displays.filter((t) => Array.isArray((input.seed || {})[t.name]) && input.seed[t.name].length > 0);
ok(displays.length === 0 || seeded.length === displays.length, "every display table got seed rows",
  `${seeded.length}/${displays.length} seeded`);

// THE THEME AND THE PLAN — the compelled look field since 2026-08-27 (the
// registry's return: the designer picks a name, the model's own css waits to
// be asked) and the blocks most likely to defeat a model merely filling in a
// form. THROUGH THE REAL `resolveTheme`, NEVER A SHAPE RESTATED HERE — this
// probe's own recorded lesson: its seeds-era check restated a field shape,
// reported two perfect Grok answers as failures, and nearly bought a
// "tolerance fix" to a normaliser that was already correct. So it asks the
// registry the only question production asks: does this name resolve? The
// shortlist line is INFORMATION, not a gate — the enum is advisory, and a
// registry name off the shortlist still builds.
const pickedTheme = resolveTheme(input.theme);
ok(!!pickedTheme, "the theme it picked is one the registry resolves",
  pickedTheme ? `"${input.theme}" (${pickedTheme.label || "no label"})` : "got: " + JSON.stringify(input.theme).slice(0, 120));
if (pickedTheme) console.log(`  (${THEME_SHORTLIST.includes(input.theme) ? "on" : "OFF"} the 100-name shortlist enum)`);
ok(Array.isArray(input.pages) && input.pages.length > 0, "the plan names pages",
  Array.isArray(input.pages) ? input.pages.map((p) => p && p.path).join(" ") : "");
ok(Array.isArray(input.components) && input.components.length > 0, "the plan names a component manifest",
  Array.isArray(input.components) ? input.components.length + " components" : "");

/* ------------------------------- does OUR OWN normaliser accept the answer */

// THE REAL GATE, and the reason this probe is worth more than "it returned
// JSON". `normalizeSchema` is an allow-list: a field in a shape it does not
// recognise is DROPPED SILENTLY, so an answer that looks fine above can still
// arrive at the database with its guarantees stripped. Gated on tables being
// DECLARED — a frontend-only answer has nothing to normalise, and driving
// `undefined` through here was a TypeError that took the probe down after
// every check above had passed (a crash is the one report shape that says
// nothing).
if (rawTables.length) {
  const norm = normalizeSchema({ tables: rawTables });
  ok(norm.tables.length === rawTables.length, "our normaliser keeps every table",
    norm.tables.length + " of " + rawTables.length);
  const named = norm.tables.map((t) => t.name).filter(Boolean);
  ok(named.length === norm.tables.length, "every table survived with a name", named.join(", "));
}

/* --------------------------------------------------- what it cost, measured */

const u = out.usage;
const rate = MODEL_RATES[MODEL];
const usd = rate
  ? u.input_tokens * rate.in + u.output_tokens * rate.out + u.cache_read_input_tokens * rate.cacheRead
  : null;
console.log(`\n  usage: in ${u.input_tokens} · out ${u.output_tokens} · cached ${u.cache_read_input_tokens}`);
ok(!!rate, "the model has a rate row", rate ? "" : MODEL + " is unpriced — it would bill at the dearest rate");
if (usd !== null) console.log(`  cost:  $${usd.toFixed(4)} (${Math.ceil(usd / 0.008)} credits at our rate)`);
// Sonnet's measured cold schema call, for the comparison this whole exercise is
// about — from build-models.mjs's own SCHEMA_PROFILE, not a guess.
console.log(`  Sonnet's measured cold schema call is 21 credits.`);

console.log("\n  what it designed:");
console.log("  " + JSON.stringify({ brand: input.brand, slug: input.slug, tables: (input.tables || []).map((t) => ({ name: t.name, access: t.access || `${t.read}/${t.write}` })) }, null, 2).replace(/\n/g, "\n  "));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
