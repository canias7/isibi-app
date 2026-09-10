// A PAGE IS WRITTEN A BAND AT A TIME, IN PARALLEL (2026-09-09, owner: "im sure
// that one step doesn't have necessary wait for the other one to finish to
// start, so figure out if we can send different agents to do tasks at the same
// time" → the band split, "A").
//
// The page call is THE long one — its own header in `page-gen.mjs` says "seven
// to twelve minutes on a real brief" — and on a first build it writes ONE file,
// `index.tsx`, because `MAX_PAGES` in the plan is 1. One file cannot be written
// faster by one model. It CAN be written by several, because the design step
// already planned it as an ordered list of bands: `shape` answers
// `{ path, sections[] }`, each section one line naming the component that
// carries the band, what goes in it, and how it sits.
//
// So the unit of the split already exists and nothing new had to be designed.
// This module owns the three parts the split needs: which bands there are, what
// ONE agent is asked for, and how the answers become one file.
//
// ── A BAND IS A COMPONENT, NOT A FRAGMENT, AND THAT IS THE WHOLE DESIGN ──────
//
// The obvious split is for each agent to return the band's JSX and for us to
// paste the pieces inside one `function P()`. It breaks on the first band that
// needs state. Read a real generated page (`test/fixtures/corpus/accountant`):
//
//     function P() {
//       const [sent, setSent] = useState(false);      ← PAGE scope
//       return (<SiteChrome …> …bands… </SiteChrome>);
//     }
//
// A hook sits above the JSX, in the page function, visible to every band. Split
// into fragments and an agent writing band 4 has nowhere to put `useState` —
// and it cannot be known in advance which band will want one, so the failure
// arrives on a real customer's build rather than in a fixture.
//
// A band is therefore its own component:
//
//     function BandPrices() {
//       const [open, setOpen] = useState(false);      ← legal: it IS a component
//       return <section data-slot="prices">…</section>;
//     }
//
// Three problems close at once. Each band owns its state, no band can reach
// another's, and the page function collapses to a composition with no state of
// its own — which is why the SHELL below can be composed by us from the design
// instead of being generated at all.
//
// ── WHAT WE WRITE AND WHAT THE MODEL WRITES ─────────────────────────────────
//
//   ours    the imports (merged), the route declaration, the band names, the
//           `SiteChrome` shell and the order the bands sit in
//   theirs  the body of each band, and nothing else
//
// The band NAMES are assigned here rather than chosen by the model, which
// removes a whole class of collision by construction: two agents cannot pick
// the same name for different bands because neither picks at all.
import {
  importSpans,
  dedupeImports,
  pageRulesFor,
  siteHasTables,
  schemaDigest,
  SITE_PAGES_MAX_TOKENS,
} from "./page-gen.mjs";
import { modelsFor } from "./build-models.mjs";
import { MAX_SECTIONS } from "./site-plan.mjs";

/**
 * How many bands a page can be split into.
 *
 * DERIVED FROM THE FIELD THAT PRODUCES THEM, never a second number beside it.
 * `shape.sections` is capped at `MAX_SECTIONS` by the design tool itself, so a
 * separate ceiling here could only ever disagree with it — and the direction it
 * would disagree in is silent: a lower number drops bands the customer was
 * shown in the plan, and nothing anywhere would say so.
 */
export const MAX_BANDS = MAX_SECTIONS;

/** A band whose line is shorter than this says nothing a writer could act on. */
export const MIN_BAND_CHARS = 3;

/**
 * The bands of one page, in order, out of the design's `shape`.
 *
 * `shape` is a LIST OF PAGES (`[{ path, sections }]`), so this picks the entry
 * for the path asked for. A page with no entry answers `[]` rather than
 * throwing: `shape` is compelled on a build but this module also has to survive
 * a hand-made payload and a version skew, and "no plan for this page" is a real
 * answer that means "do not split it" — the caller falls back to the one call.
 *
 * The path is matched EXACTLY as the design wrote it. Normalising here would be
 * a second opinion about what a route is called, and `validatePages` already
 * owns that question one layer down.
 */
export function bandsOf(shape, path) {
  const want = typeof path === "string" ? path : "";
  if (!want || !Array.isArray(shape)) return [];
  const row = shape.find((s) => s && typeof s === "object" && !Array.isArray(s) && s.path === want);
  if (!row || !Array.isArray(row.sections)) return [];
  return row.sections
    .filter((l) => typeof l === "string" && l.trim().length >= MIN_BAND_CHARS)
    .slice(0, MAX_BANDS)
    .map((l) => l.trim());
}

/**
 * The local component name for one band.
 *
 * `Band<n><Word>` — the index first, so the name is unique whatever the words
 * do, and a word from the line after it so a person reading the file can tell
 * which band is which. The index alone would compile and would make the Code
 * tab unreadable.
 *
 * THE INDEX IS WHAT MAKES IT UNIQUE, and that is deliberate rather than lazy:
 * two bands can legitimately open with the same word ("Prices for members",
 * "Prices for visitors") and a name derived from the words alone would collide
 * on exactly the page most likely to have been planned carefully.
 *
 * The word is taken from the line's letters only and capitalised. A line with
 * no letters at all (punctuation, another script) answers the bare `Band<n>`,
 * which is still a legal identifier — never an empty suffix, and never a name
 * starting with a digit.
 */
export function bandName(line, i) {
  const n = Number.isInteger(i) && i >= 0 ? i + 1 : 1;
  const word = String(line == null ? "" : line)
    .replace(/[^A-Za-z ]+/g, " ")
    .trim()
    .split(/\s+/)[0] || "";
  const tail = word ? word[0].toUpperCase() + word.slice(1, 16).toLowerCase() : "";
  return "Band" + n + tail;
}

/**
 * One band's answer, split into the part that must move to the top of the file
 * and the part that stays where it is.
 *
 * IMPORTS ARE READ BY `page-gen`'s OWN READER, imported rather than rewritten.
 * A band's source is a module header followed by code, which is the exact shape
 * `importSpans` was written for — and a second reader here would be the
 * recorded "two lists of the same thing" with the worst subject available: the
 * two would eventually disagree about where a header ENDS, and the one that
 * ends it early swallows the top of the band into an import span, silently.
 *
 * `decls` is every name declared at the TOP LEVEL of what is left. It is read
 * by line start rather than by parsing, and that is measured rather than
 * assumed: across the 324 real generated pages in `test/fixtures/corpus` there
 * are 972 top-level declarations and every single one begins at column 0, with
 * ZERO indented `function` or `class` declarations anywhere. A real parser here
 * would have to know when it is inside JSX — where `didn't` is text and not an
 * unterminated string, this repository's own recorded trap — to answer a
 * question the corpus already answers by looking at the left margin.
 */
export function splitBand(source) {
  const src = String(source == null ? "" : source);
  const spans = importSpans(src);
  const end = spans.length ? spans[spans.length - 1][1] : 0;
  const imports = spans.map(([s, e]) => src.slice(s, e).trim()).filter(Boolean);
  const body = src.slice(end).replace(/^\s+/, "");
  const decls = [];
  for (const line of body.split("\n")) {
    const m = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (m) decls.push(m[1]);
  }
  return { imports, body, decls };
}

/**
 * Everything wrong with one band's answer, as sentences — empty when it is fine.
 *
 * A BAND MAY DECLARE NOTHING AT TOP LEVEL BUT ITSELF, and this is the rule that
 * keeps assembly free of a rename pass. Two bands that both write
 * `function formatPrice` produce a file with a duplicate declaration, which
 * vite refuses outright — and renaming one of them means renaming every
 * reference to it in that band's source, which is a source rewrite this
 * repository has no business doing on the money path. Helpers go INSIDE the
 * component, which is ordinary JavaScript and costs the writer nothing.
 *
 * So the check is exact: one top-level declaration, and it is the name we
 * assigned. Anything else is refused and the band is stubbed, which is
 * salvage's own precedent — a page missing one band beats no page at all.
 */
export function bandProblems(name, source) {
  const out = [];
  const { body, decls } = splitBand(source);
  if (!body.trim()) return ["wrote nothing"];
  if (!decls.length) return ["declared no component"];
  const extra = decls.filter((d) => d !== name);
  if (extra.length) out.push("declared " + extra.join(", ") + " beside " + name + " — a helper belongs inside the component");
  if (!decls.includes(name)) out.push("did not declare " + name);
  // An export inside a page file is not an error a bundler reports usefully:
  // `export default` twice in one file is a parse failure with a line number in
  // the assembled file, which points at nothing anybody wrote.
  if (/^\s*export\s/m.test(body)) out.push("exported " + name + " — a band is a local component");
  return out;
}

/**
 * What a band that could not be written leaves behind.
 *
 * A COMMENT AND NOTHING DRAWN. The alternative — an apology card on the page —
 * was considered and is worse: a band is one section of a scroll, the page
 * either side of it is whole, and a visitor who never knew a fourth band was
 * planned reads a complete site. An apology tells them something is broken.
 *
 * It is still a real component with a real name, because the shell composes the
 * bands by name and a missing one is a page that does not compile — the failure
 * this exists to avoid, arriving one line later.
 */
export function bandStub(name, line) {
  const why = String(line == null ? "" : line).replace(/\*\//g, "*").slice(0, 120);
  return "function " + name + "() {\n" +
    "  // This band could not be written" + (why ? ": " + why : "") + "\n" +
    "  return null;\n" +
    "}";
}

/**
 * The page's own shell, composed from the DESIGN rather than generated.
 *
 * `SiteChrome` takes the site's identity and navigation — name, tagline, links,
 * action — every one of which the design step has already answered by the time
 * a band is written. So there is nothing here for a model to decide, and asking
 * one to decide it anyway would be a second opinion about the site's own name.
 *
 * IT CARRIES NO STATE, and it cannot: every band owns its own (see the header).
 * That is what makes this a plain composition rather than a page function with
 * hooks in it, and it is why the shell can be a template at all.
 */
export function pageShell({ route, chrome, names }) {
  const path = typeof route === "string" && route ? route : "/";
  const c = chrome && typeof chrome === "object" ? chrome : {};
  const attrs = ["name", "tagline", "links", "action"]
    .filter((k) => c[k] !== undefined && c[k] !== null && c[k] !== "")
    .map((k) => (typeof c[k] === "string" ? `${k}=${JSON.stringify(c[k])}` : `${k}={${JSON.stringify(c[k])}}`));
  const kids = (Array.isArray(names) ? names : []).map((n) => `      <${n} />`).join("\n");
  return [
    `export const Route = createFileRoute(${JSON.stringify(path)})({ component: P });`,
    "",
    "function P() {",
    "  return (",
    `    <SiteChrome${attrs.length ? " " + attrs.join(" ") : ""}>`,
    kids,
    "    </SiteChrome>",
    "  );",
    "}",
  ].filter((l) => l !== "").join("\n");
}

/** The two imports the shell itself needs, whatever the bands asked for. */
export const SHELL_IMPORTS = [
  'import { createFileRoute } from "@tanstack/react-router";',
  'import { SiteChrome } from "@/components/ui/site-chrome";',
];

/**
 * The tool ONE agent answers: a band's source, and nothing else.
 *
 * ONE PROPERTY IS THE WALL RATHER THAN THE RULE, which is this repository's
 * standing preference and is worth more here than anywhere. A band writer that
 * could answer a `path`, a `name` or a list of `pages` would eventually answer
 * one, and the assembler would then be arbitrating between a name we assigned
 * and a name the model preferred — on eight calls at once, where the two that
 * disagree are the two that collide. There is nowhere to put any of it.
 */
export const BAND_TOOL = {
  name: "write_band",
  description: "Return the source of ONE band component for this page.",
  input_schema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description:
          "The band's source: its imports, then exactly one top-level `function` declaration " +
          "— the component named in the instructions — and nothing else. No route, no export.",
      },
    },
    required: ["source"],
  },
};

/**
 * The page, top to bottom, with the band being written marked.
 *
 * A BAND IS TOLD ABOUT ITS NEIGHBOURS AND NEVER SHOWN THEM. It has to know they
 * exist — otherwise band 3 writes its own hero, band 5 repeats the prices, and
 * every agent closes with a call to action, which is what "one page, one job"
 * has spent four builds teaching the single-call path not to do. It cannot be
 * shown their SOURCE, because there is none: they are being written at the same
 * moment, and that is the whole point of the split.
 *
 * The design's own lines are the answer. They were written to describe the page
 * as a whole, they are the same lines every other agent is reading, and they
 * cost nothing to send.
 */
export function bandPlan(lines, index) {
  const list = Array.isArray(lines) ? lines : [];
  return list
    .map((l, i) => (i + 1) + ". " + String(l == null ? "" : l) + (i === index ? "   ← YOURS" : ""))
    .join("\n");
}

/**
 * What one agent is asked, as the user message.
 *
 * THE BRIEF ARRIVES ALREADY COMPOSED, exactly as `pagesRequest` takes it — the
 * caller runs `briefWithLayout`, so the layout, the images, the QR bindings and
 * the 3D scene reach a band through the ONE composer the single-call path uses.
 * A second composer here would be "two lists of the same thing" pointed at the
 * directives, and the half that drifted would be the half that tells a band a
 * canvas was asked for.
 *
 * THE SCHEMA CLAUSE IS `pagesPrompt`'s, WORD FOR WORD, for the reason that one
 * gives: on a site with no database "there is none, and that is the design" is
 * the fact of the matter, and a heading promising a schema that came out empty
 * reads as an omission the model should fill.
 */
export function bandPrompt({ brief, spec, brand, lines, index, name } = {}) {
  const label = String(brand || "").trim();
  const plan = bandPlan(lines, index);
  return "Write ONE band of this page.\n\nBRIEF\n" + String(brief || "").trim() +
    (label ? "\n\nTHE SITE IS CALLED\n" + label + " — it is already the page title." : "") +
    (siteHasTables(spec)
      ? "\n\nTHE SCHEMA THAT EXISTS\n" + schemaDigest(spec)
      : "\n\nTHIS SITE'S DATA\nThere is none, and that is the design. Write the content into the band.") +
    (plan ? "\n\nTHE PAGE, TOP TO BOTTOM\n" + plan : "") +
    "\n\nYOURS IS " + name + "\nWrite that band and no other. The bands above and below yours are being " +
    "written at the same time by someone else — do not write them, do not repeat them, and do not " +
    "close the page.\n\nHOW A BAND IS WRITTEN\n" +
    "- Imports at the top, then EXACTLY ONE top-level declaration: `function " + name + "() { … }`.\n" +
    "- A helper goes INSIDE " + name + ". A second top-level name collides with another band and the page does not compile.\n" +
    "- No `export` of any kind, and no `createFileRoute`: the page's route, its header, its navigation and its footer are already written.\n" +
    "- Return one `<section>`, styled the way the rest of this site is styled.";
}

/**
 * The exact body sent for one band.
 *
 * THE CACHED SYSTEM BLOCK IS THE PAGE CALL'S OWN, BYTE FOR BYTE, and that is
 * the single most valuable decision here. `pageRulesFor` is ~27,000 tokens of
 * rules that a band has to obey exactly as a page does — which components exist,
 * what a chart may do, what may never be imported — so a band-specific rules
 * block would be both a second copy of every one of those rules AND a cold cache
 * prefix. Sharing it means the eight calls of a fan-out read a prefix that every
 * ordinary build has already made warm, and a rule fixed for the page call is
 * fixed for the bands in the same edit.
 *
 * `max_tokens` IS THE PAGE CALL'S TOO, and deliberately not a smaller number
 * sized to one band. That constant's own comment settles it: max_tokens is a
 * CEILING, not a reservation — a band that finishes in 3,000 is billed for
 * 3,000 either way — so the only thing a tight ceiling buys is a cheaper
 * failure, and a truncated tool_use block is a whole band lost after being paid
 * for.
 *
 * THE ATTACHMENTS ARE THE CALLER'S CALL, and the trade is real either way: sent
 * to every band they are paid for N times, and sent to none a band cannot write
 * the picture the customer attached for it. They ride the user message, after
 * both cached blocks, for `pagesRequest`'s own reason.
 */
export function bandRequest({
  brief, spec, brand, lines, index, name, model, kind = "", attachments,
} = {}) {
  const blocks = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  const text = bandPrompt({ brief, spec, brand, lines, index, name });
  return {
    model: model || modelsFor().pages,
    max_tokens: SITE_PAGES_MAX_TOKENS,
    tools: [BAND_TOOL],
    tool_choice: { type: "tool", name: "write_band" },
    system: [{ type: "text", text: pageRulesFor(spec, kind), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: blocks.length ? [...blocks, { type: "text", text }] : text }],
  };
}

/**
 * Every band's answer, as one page file.
 *
 * ORDER IS THE DESIGN'S ORDER, not the order the answers came back in. The
 * whole point of running the bands at once is that they finish out of order,
 * and a page assembled in finishing order is a page whose hero is wherever the
 * fastest agent happened to land. The caller hands them in `shape` order and
 * this preserves it; nothing here sorts.
 *
 * THE IMPORTS ARE MERGED BY `dedupeImports`, which is page-gen's own and is
 * measured at 0 false alarms over 3,736 real files. Every band will import
 * `react` and most will import a kit component, so the raw concatenation is
 * full of repeats — and a repeated import is the exact failure that killed run
 * 90's build in the bundler (`Identifier 'createFileRoute' has already been
 * declared`). This is that wall doing the job it was built for.
 *
 * A band with problems is STUBBED rather than dropped: dropping it would leave
 * the shell composing a name nothing declares, which does not compile — the
 * whole-page failure, arriving one line later than the band's own.
 */
export function assembleBands({ route, chrome, bands }) {
  const list = (Array.isArray(bands) ? bands : []).filter((b) => b && typeof b === "object" && typeof b.name === "string" && b.name);
  const refused = [];
  const bodies = [];
  const imports = [...SHELL_IMPORTS];
  for (const b of list) {
    const why = bandProblems(b.name, b.source);
    if (why.length) {
      refused.push({ name: b.name, line: b.line || "", why });
      bodies.push(bandStub(b.name, b.line));
      continue;
    }
    const { imports: got, body } = splitBand(b.source);
    imports.push(...got);
    bodies.push(body.replace(/\s+$/, ""));
  }
  const names = list.map((b) => b.name);
  const source = imports.join("\n") + "\n" +
    pageShell({ route, chrome, names }) + "\n\n" +
    bodies.join("\n\n") + "\n";
  // Merged AFTER the file is whole, because `importSpans` reads a header and
  // the header is only correct once every band's imports sit at the top.
  return { source: dedupeImports(source).source, refused };
}
