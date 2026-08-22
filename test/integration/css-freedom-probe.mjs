// FREE-FORM CSS vs THE 29 AXES — one paired call, same everything else.
//
// THE QUESTION, in the owner's words: "having the model make css freely without
// the 29 things vs with the 29 things". It is a fair question and the answer is
// not obvious, because the enums are gone — the model already writes real CSS on
// every axis, so what the list still supplies is the SELECTOR and the property
// allow-list, not a menu of looks.
//
// THE CONFOUND THIS IS BUILT AROUND. Hand the free arm a blank sheet and the
// axis arm a structured tool and you are not comparing free-vs-list, you are
// comparing no-guidance-vs-guidance, and free loses for a reason that has
// nothing to do with freedom. A model writing blind cannot know the kit stamps
// `[data-slot="button"]`; it would invent selectors that match no element on the
// page. So BOTH ARMS GET THE SAME PREAMBLE — the same brief, the same palette,
// the same hook list, the same note that the CSS lands after the theme's own
// stylesheet. The ONLY variable is the shape of the answer: 29 fields, or one.
//
// ARM B USES THE REAL FIELDS, lifted out of the real `design_schema` in the real
// `worker.js`, so its descriptions are production's rather than a paraphrase of
// them. An arm built from hand-written toy fields would measure a prompt nobody
// sends, which is the failure `schema-tool.mjs` exists to prevent.
//
// IT COSTS ABOUT TWO CENTS OF xAI AND ZERO PLATFORM CREDITS — no Neon project,
// no container, no publish, no account, no ledger. The `grok probe` reasoning
// verbatim: a full build to learn the same thing costs ~40-90 credits, and if
// the answer is "free-form drops the guards" the build fails somewhere
// downstream where the reason is much harder to read.
//
// IT DOES NOT RENDER, deliberately. Both stylesheets are written out as
// artifacts so they can go through the REAL container locally at $0 and be
// LOOKED AT side by side — which is the half of "is it any good" that no
// property check can answer, and this repo's most-recorded lesson.
import fs from "node:fs";
import path from "node:path";
import { readSchemaTool } from "./schema-tool.mjs";
import { toXaiRequest, fromXaiResponse, XAI_ENDPOINT } from "../../builder/model-xai.mjs";
import { BUILD_MODELS } from "../../builder/build-models.mjs";
import { STYLE_TARGETS, paletteFor } from "../../builder/site-theme.mjs";
import { normalizeSeeds } from "../../builder/site-seeds.mjs";
import { AXIS_DECLS, AXIS_RAMPS } from "../../builder/site-authored.mjs";
import { parseStyle } from "../../builder/site-style.mjs";

const KEY = process.env.XAI_API_KEY || "";
const MODEL = process.env.GROK_MODEL || BUILD_MODELS.grok.design;
const OUT = process.env.CSS_PROBE_OUT || "docs/css-freedom";
const BRIEF = process.env.CSS_PROBE_BRIEF ||
  "Fold Lane Bakery — a small sourdough bakery and coffee counter in Bristol. " +
  "Warm, unfussy, a bit crafted. Visitors read what is baked today with prices, " +
  "see the opening hours, and leave an order enquiry.";

if (!KEY || KEY === "not-a-key") {
  // AN HONEST STOP, NOT A PASS — the `grok probe` rule. A probe that goes green
  // when it could not run reads exactly like a working experiment.
  console.error("XAI_API_KEY is not set (or is the deploy placeholder) — nothing was probed.");
  process.exit(1);
}

const SEEDS = { name: "Fold Lane", paper: "#faf7f2", ink: "#1b1714", accent: "#b44a2e" };
const { theme } = normalizeSeeds(SEEDS);
if (!theme) { console.error("the fixture palette was refused — fix the seeds, not the probe"); process.exit(1); }

/* ---------------------------------------------------------------- the shared half */

const hooks = Object.entries(STYLE_TARGETS).map(([k, t]) => `  ${t.sel}  — ${t.said}`).join("\n");
const light = paletteFor(theme, "light");
const tokenLine = ["background", "foreground", "primary", "primary-foreground", "card", "muted",
  "muted-foreground", "border", "scrim"].map((k) => `--${k}`).join(", ");

// EVERY WORD OF THIS GOES TO BOTH ARMS. If a sentence here is only true of one
// of them, the comparison is measuring that sentence rather than the shapes.
const PREAMBLE =
  `You are designing the look of a small business website.\n\n` +
  `THE BUSINESS\n${BRIEF}\n\n` +
  `THE PALETTE IS ALREADY DECIDED and is not yours to change. It ships as CSS custom\n` +
  `properties, in a :root block for light mode and a .dark block for dark, and they are\n` +
  `derived from three colours the designer already chose. Reference them, never restate\n` +
  `them: ${tokenLine} and the rest of the shadcn set.\n` +
  `\`--primary\` is the brand colour. \`--accent\` is NOT — in this palette it is a pale\n` +
  `hover surface.\n\n` +
  `THE MARKUP IS ALREADY BUILT and is not yours to change. It is a React app on Tailwind\n` +
  `v4 with a shadcn kit. These are the hooks every generated page really carries:\n${hooks}\n` +
  `  section  — every band of the page\n` +
  `  body     — the page ground\n\n` +
  `WHAT YOU WRITE IS APPENDED AFTER the theme's own stylesheet, so ordinary source order\n` +
  `decides it and you never need !important.\n\n` +
  `The site must work in BOTH light and dark mode, on a phone and on a laptop.`;

/* ------------------------------------------------------------------- the two arms */

const { tool: realTool } = await readSchemaTool();
const styleFields = ((realTool.input_schema.properties || {}).style || {}).properties || {};
if (Object.keys(styleFields).length < 20) {
  console.error(`only ${Object.keys(styleFields).length} style fields came out of the real tool — retarget this probe`);
  process.exit(1);
}

const ARMS = {
  // ARM A — one field. The model decides selectors, properties and structure.
  free: {
    label: "FREE — one `css` field, the model writes the stylesheet",
    tool: {
      name: "write_look",
      description: "Write this site's look as CSS.",
      input_schema: {
        type: "object",
        properties: {
          css: {
            type: "string",
            description:
              "The stylesheet for this site's look, as CSS. Real rules with selectors and " +
              "braces. It is appended after the theme's own stylesheet. Write as much or as " +
              "little as the business needs.",
          },
        },
        required: ["css"],
      },
    },
  },
  // ARM B — production's own 29 fields, descriptions and all.
  axes: {
    label: `AXES — the real ${Object.keys(styleFields).length} style fields out of worker.js`,
    tool: {
      name: "write_look",
      description: "Choose this site's look, one axis at a time. Every field is optional.",
      input_schema: { type: "object", properties: styleFields, required: [] },
    },
  },
};

/* --------------------------------------------------------------------- the measures */

/** Selectors a rule targets, and whether the page can possibly carry them. */
const OURS = [...Object.values(STYLE_TARGETS).map((t) => t.sel), "body", "section", ":root", ".dark",
  "html", "a", "::selection", "::view-transition-old", "::view-transition-new",
  ".bg-card", ".bg-primary", ".bg-popover", ".border-input", ".lucide", "h1", "h2", "h3", "h4"];

/** Rules, flattened. Good enough for counting — this is a report, not a parser. */
function rules(css) {
  const out = [];
  for (const m of String(css).matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const sel = m[1].replace(/\s+/g, " ").trim();
    if (sel) out.push({ sel, body: m[2].trim() });
  }
  return out;
}
const propsIn = (body) => [...String(body).matchAll(/(^|;)\s*([-a-zA-Z]+)\s*:/g)].map((m) => m[2]);

// The union of everything the 29 axes are allowed to write — arm B cannot leave
// it by construction, so what this measures is how far arm A goes beyond it.
const ALLOWED = new Set();
for (const spec of Object.values(AXIS_DECLS)) {
  if (spec.image) { ALLOWED.add("background-image"); continue; }
  for (const p of Object.keys(spec.props || {})) ALLOWED.add(p);
}

// THE FOUR REFUSALS, each recorded in CLAUDE.md as a real failure rather than a
// hypothetical: `display:none` blanks every list on the site, `position:fixed` on
// a section pins the page, `content:` is page copy arriving through a field
// nobody reviews, `!important` takes the decision away from the theme.
const DANGER = [
  [/display\s*:\s*none/i, "display:none — blanks whatever it lands on"],
  [/position\s*:\s*fixed/i, "position:fixed — pins an element over the page"],
  [/(^|[;{\s])content\s*:/i, "content: — page copy through a field nobody reviews"],
  [/!\s*important/i, "!important — takes the decision away from the theme"],
];

// THE FOUR GUARDS THE AXES CARRY FOR THE MODEL. Every one is a failure invisible
// on the machine that publishes the site, which is exactly why they are ours and
// not the model's to remember.
const GUARDS = [
  { name: "@media (hover: hover) around :hover", need: /:hover/, has: /@media[^{]*\(hover:\s*hover\)/,
    why: "on a touch screen :hover STICKS after a tap" },
  { name: ":focus-visible rather than :focus", need: /:focus/, has: /:focus-visible/,
    why: "a mouse click on a plain :focus leaves a ring behind" },
  { name: "prefers-reduced-motion honoured", need: /animation|transition/, has: /prefers-reduced-motion/,
    why: "motion nobody can switch off" },
  { name: "pointer-events:none on a fixed full-page layer", need: /position\s*:\s*fixed/, has: /pointer-events\s*:\s*none/,
    why: "a fixed layer swallows every click on the site" },
];

/* ------------------------------------------------------------------------ the call */

async function ask(arm) {
  const req = {
    model: MODEL,
    max_tokens: 8000,
    tools: [{ ...arm.tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: arm.tool.name },
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: PREAMBLE }],
    messages: [{ role: "user", content: "Design this site's look." }],
  };
  const { body } = toXaiRequest(req);
  const t0 = Date.now();
  const r = await fetch(XAI_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const raw = await r.text();
  if (!r.ok) return { ok: false, secs, why: raw.slice(0, 500) };
  let j = null;
  try { j = JSON.parse(raw); } catch { return { ok: false, secs, why: "the response was not JSON" }; }
  const out = fromXaiResponse(j);
  const use = out.content.find((b) => b && b.type === "tool_use");
  if (!use) return { ok: false, secs, why: "no tool call; stop_reason=" + out.stop_reason };
  return { ok: true, secs, input: use.input, usage: out.usage || {}, stop: out.stop_reason };
}

/**
 * IS THE ACCOUNT EMPTY, asked by NAME rather than left as one more failure.
 *
 * xAI answers a spent balance with `code: "permission-denied"` and a sentence
 * about credits — and that is not a fault in the probe, it is the platform's
 * DEFAULT BUILDER refusing every request. `upstreamKind` does exactly this for
 * Anthropic and for the same reason: "we are out of money" and "the probe is
 * broken" want completely different responses, and from a failed call they look
 * identical.
 */
const isBilling = (why) => /permission-denied/.test(String(why)) &&
  /credits|spending limit/i.test(String(why));

/* ------------------------------------------------------------------------ the run */

console.log("CSS freedom probe — free-form vs the 29 axes, one call each\n");
console.log(`  model : ${MODEL}`);
console.log(`  brief : ${BRIEF.slice(0, 70)}...`);
console.log(`  shared preamble: ${PREAMBLE.length} chars — IDENTICAL for both arms\n`);

fs.mkdirSync(OUT, { recursive: true });
const report = {};
// A PROBE THAT GOES GREEN HAVING ASKED NOTHING IS THE FAILURE THIS FILE'S OWN
// HEADER NAMES, and the first run did exactly that: both calls were refused in
// 0.1s, no CSS was produced, and the job reported SUCCESS. The missing-key path
// exited 1 and the failed-CALL path did not — the guard was on one door of two.
let failed = 0, billing = false;

for (const [key, arm] of Object.entries(ARMS)) {
  console.log(`\n${"─".repeat(72)}\n${arm.label}\n${"─".repeat(72)}`);
  const a = await ask(arm);
  if (!a.ok) {
    console.log(`  the call failed in ${a.secs}s: ${a.why}`);
    if (isBilling(a.why)) billing = true;
    report[key] = { failed: a.why, billing: isBilling(a.why) };
    failed++;
    continue;
  }

  // WHAT EACH ARM PRODUCES IS DIFFERENT IN KIND, so each is turned into the one
  // thing they can be compared as: the CSS that would reach the stylesheet.
  let css = "", axesUsed = 0, refused = [];
  if (key === "free") {
    css = String(a.input.css || "");
  } else {
    // Through the REAL parser, because "what the model sent" and "what would
    // ship" are different numbers and only the second one is the comparison.
    const p = parseStyle(a.input);
    axesUsed = Object.keys(p.style || {}).length + Object.keys(p.authored || {}).length;
    refused = (p.dropped || []).concat((p.refused || []).map((x) => x.axis + " (" + x.why + ")"));
    css = JSON.stringify(a.input, null, 1);
  }

  fs.writeFileSync(path.join(OUT, key + (key === "free" ? ".css" : ".json")), css);
  fs.writeFileSync(path.join(OUT, key + ".raw.json"), JSON.stringify(a.input, null, 1));

  const rs = key === "free" ? rules(css) : [];
  const sels = rs.map((r) => r.sel);
  const reach = sels.filter((s) => OURS.some((o) => s.includes(o)));
  const invented = sels.filter((s) => !OURS.some((o) => s.includes(o)));
  const written = key === "free"
    ? [...new Set(rs.flatMap((r) => propsIn(r.body)))]
    : [];
  const beyond = written.filter((p) => !ALLOWED.has(p));

  console.log(`  answered in ${a.secs}s · in ${a.usage.input_tokens ?? "?"} · out ${a.usage.output_tokens ?? "?"} · stop ${a.stop}`);
  if (key === "axes") {
    console.log(`  axes the model set : ${axesUsed} of ${Object.keys(styleFields).length}`);
    console.log(`  refused by parseStyle: ${refused.length ? refused.join(", ") : "none"}`);
    console.log(`  written to ${path.join(OUT, key + ".json")}`);
  } else {
    console.log(`  bytes of CSS       : ${css.length}`);
    console.log(`  rules              : ${rs.length}`);
    console.log(`  …reaching a real hook : ${reach.length}`);
    console.log(`  …selectors that match NOTHING the kit renders : ${invented.length}` +
      (invented.length ? "\n      " + [...new Set(invented)].slice(0, 8).join("\n      ") : ""));
    console.log(`  distinct properties : ${written.length}  (the 29 axes allow ${ALLOWED.size})`);
    console.log(`  …outside what any axis may write : ${beyond.length}` +
      (beyond.length ? "\n      " + beyond.slice(0, 14).join(", ") : ""));
    const hits = DANGER.filter(([re]) => re.test(css));
    console.log(`  REFUSED BY THE AXES, written anyway : ${hits.length}` +
      (hits.length ? "\n      " + hits.map(([, w]) => w).join("\n      ") : ""));
    const missed = GUARDS.filter((g) => g.need.test(css) && !g.has.test(css));
    console.log(`  GUARDS THE AXES CARRY, dropped here : ${missed.length} of ${GUARDS.filter((g) => g.need.test(css)).length} that applied` +
      (missed.length ? "\n      " + missed.map((g) => g.name + " — " + g.why).join("\n      ") : ""));
    report[key] = { bytes: css.length, rules: rs.length, reach: reach.length, invented: invented.length,
      props: written.length, beyond, danger: hits.map(([, w]) => w), missedGuards: missed.map((g) => g.name) };
  }
  if (key === "axes") report[key] = { axesUsed, refused, out: a.usage.output_tokens };
  report[key].secs = a.secs;
  report[key].tokens = { in: a.usage.input_tokens, out: a.usage.output_tokens };
}

// THE REPORT SAYS WHAT PRODUCED IT, because it is downloaded as an ARTIFACT and
// read days later with none of this run's context in the room. A bare
// `{free:…, axes:…}` cannot answer "which model", "when", or — the question that
// costs the most to get wrong — "did anything actually answer". `answered` is
// derived from the failure count rather than restated, so it cannot disagree
// with the exit status two blocks down.
report.meta = { model: MODEL, when: new Date().toISOString(), answered: failed === 0, billing };
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
console.log(`\n${"─".repeat(72)}`);
// GATED ON THERE BEING ANSWERS. On the refused run this line printed "Both
// answers are in <dir> — render them through the real container", pointing at a
// directory holding one report and no stylesheets. A closing line that claims
// more than happened is the same failure as a green tick on a run that asked
// nothing, one sentence smaller.
if (failed === 0) {
  console.log(`Both answers are in ${OUT}/ — render them through the real container to compare`);
  console.log(`what they LOOK like, which is the half no property check above can answer.`);
} else {
  console.log(`Nothing was written to compare — see ${OUT}/report.json for why.`);
}
console.log(`${"─".repeat(72)}`);

// THE FUNDING ANSWER IS STATED IN BOTH DIRECTIONS, not only when it is bad.
// A run where the account is fine says so in one line, because "no billing
// message" and "nobody looked" are the same silence otherwise — and settling
// whether xAI is funded is a question this probe gets asked on its own.
console.log(failed === 0
  ? `\nxAI ANSWERED — the account has credit (${MODEL}).`
  : `\nxAI DID NOT ANSWER on ${failed} of ${Object.keys(ARMS).length} arms.`);

if (billing) {
  // THE FINDING IS BIGGER THAN THE EXPERIMENT, so it is said in its own words.
  // `grok-4.6` is `DEFAULT_PICKER`, so an empty xAI balance is not this probe
  // being unable to run — it is every customer build on the platform refusing.
  console.error(`\nTHE xAI ACCOUNT IS OUT OF CREDIT.`);
  console.error(`grok is DEFAULT_PICKER, so this is not just the probe: no site can be`);
  console.error(`built right now, and a build fails at stage "design" in about a second.`);
}
if (failed) {
  console.error(`\n${failed} of ${Object.keys(ARMS).length} arms never answered — nothing was compared.`);
  process.exit(1);
}
