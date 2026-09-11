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
  usageOf,
  SITE_PAGES_MAX_TOKENS,
} from "./page-gen.mjs";
import { modelsFor } from "./build-models.mjs";
import { routeOf } from "./site-addon.mjs";
// NO IMPORT FROM `model-fanout.mjs` ANY MORE (2026-09-11). This module used to
// read `MAX_MODEL_FANOUT` for the `wide` refusal; the fan-out queues past that
// bound now, so nothing here has a reason to know how many calls run at once.
import { MAX_SECTIONS, MAX_TSX } from "./site-plan.mjs";

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
 * A BAND MAY DECLARE NOTHING AT TOP LEVEL BUT ITSELF.
 *
 * THE REASON THIS WAS WRITTEN FOR EXPIRED ON 2026-09-11 AND THE RULE STAYS —
 * said out loud, because a justification that is no longer true is how the next
 * session deletes a wall that still earns its place. It read: two bands that
 * both write `function formatPrice` produce a file with a duplicate
 * declaration, which vite refuses, and renaming one means rewriting every
 * reference to it. True while `assembleBands` concatenated. Each band is its
 * own module now, so two bands may both declare `formatPrice` and neither can
 * see the other.
 *
 * WHAT KEEPS IT: a band is ONE component, and the shell imports exactly one
 * default from each file. A band that declares a second top-level name has
 * either written a component nobody composes or split itself in two without
 * being asked — and `bandModule` would export only the one we named, silently
 * dropping the rest of what the model wrote. The prompt says helpers go INSIDE
 * (`bandPrompt`), so this is the wall under a rule the writer has already been
 * given, not a new constraint.
 *
 * IT IS NOW STRICTER THAN THE FILE NEEDS, and that is the open half: a band
 * with a top-level helper is refused and STUBBED, losing the whole section, for
 * a shape its own file would accept. Relaxing it means changing the prompt as
 * well, which is a generation change and not this one. Left as it was.
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
 * The components this site needs that the kit has not got — one agent each.
 *
 * ── WHY A PART IS A THING AND NOT PART OF THE PAGE (2026-09-11, owner: "one
 *    agent per thing like the design one, just make it wait if its requires
 *    from something to wait for other thing") ────────────────────────────────
 *
 * The design's `tsx` field DECLARES these; until today the page call wrote them,
 * which is why `planRefusal` refused to split a build that had any — its own
 * comment said so in as many words: "a band writes one section and cannot write
 * a part… A band step that writes parts is a later change, not a smaller one."
 * This is that change. A part is exactly the same kind of thing a band is — one
 * file, one component, one agent — so it gets one.
 *
 * A PART WAITS FOR NOTHING, and that is read off the declarations rather than
 * assumed. `tsxDirective` hands a part its NAME, what it DOES, its PROPS and its
 * import path, and every one of those is the design's answer, settled before any
 * of this runs. A band that imports the part reads the same four things. So
 * neither reads the other's source and there is no edge to draw — which is the
 * same answer the design graph reached for fifteen of its twenty-two fields, and
 * it is stated here so the next session does not add a wait nothing needs.
 *
 * Capped at `MAX_TSX`, the design's own ceiling, rather than a second number
 * beside it.
 */
export function partsOf(tsx) {
  const list = Array.isArray(tsx) ? tsx : [];
  return list
    .filter((t) => t && typeof t === "object" && !Array.isArray(t))
    .map((t) => ({
      name: String(t.name == null ? "" : t.name).trim(),
      does: String(t.does == null ? "" : t.does).trim(),
      props: String(t.props == null ? "" : t.props).trim(),
    }))
    // THE SAME TWO `tsxDirective` REQUIRES, so a part this fans out for is a
    // part the single-call path would also have been told to write. A row it
    // drops is a row nothing would have written either way.
    .filter((t) => t.name && t.does)
    .slice(0, MAX_TSX);
}

/**
 * The tool ONE part agent answers: a component's source, and nothing else.
 *
 * ONE PROPERTY FOR `BAND_TOOL`'s OWN REASON, and it bites harder here: the part
 * has a NAME the design assigned and the page's imports are written against it,
 * so a writer that could answer its own `name` would eventually answer one and
 * the page would import a file that is not there.
 */
export const PART_TOOL = {
  name: "write_part",
  description: "Return the source of ONE component for this site.",
  input_schema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description:
          "The component's source: its imports, then the component itself, exported as the default. " +
          "No route, and nothing else in the file.",
      },
    },
    required: ["source"],
  },
};

/**
 * What one part agent is asked.
 *
 * THE FOUR FACTS ARE `tsxDirective`'s OWN, and they are not re-worded here: the
 * name, what it does, its props and the import path other files will use. A
 * second wording would be "two lists of the same thing" between the agent that
 * WRITES the component and the page that IMPORTS it — and the half that drifted
 * would be the props, which is a page that does not compile.
 *
 * IT IS TOLD THE PAGE'S PLAN for the reason a band is: a component written with
 * no idea what page it lands on is a component in the wrong voice. It is NOT
 * told which band imports it, because that is not decided by anyone — every band
 * is being written at this moment and may or may not reach for it.
 */
export function partPrompt({ brief, spec, brand, lines, part } = {}) {
  const label = String(brand || "").trim();
  const p = part && typeof part === "object" ? part : {};
  const plan = bandPlan(lines, -1);
  return "Write ONE component for this site.\n\nBRIEF\n" + String(brief || "").trim() +
    (label ? "\n\nTHE SITE IS CALLED\n" + label : "") +
    (siteHasTables(spec)
      ? "\n\nTHE SCHEMA THAT EXISTS\n" + schemaDigest(spec)
      : "\n\nTHIS SITE'S DATA\nThere is none, and that is the design. Write the content in.") +
    (plan ? "\n\nTHE PAGE IT BELONGS TO, TOP TO BOTTOM\n" + plan : "") +
    "\n\nYOURS IS " + p.name + "\n" + p.does +
    (p.props ? "\nProps: " + p.props : "") +
    "\n\nHOW A COMPONENT IS WRITTEN\n" +
    "- Imports at the top, then the component, exported as the DEFAULT. Nothing else in the file.\n" +
    "- It is imported as `@/routes/-parts/" + p.name + "` — that name is already written into the page.\n" +
    "- No `createFileRoute` and no route of any kind: this is a component, never a page.\n" +
    "- Paint with the same kit tokens every other component uses, so it belongs to the theme.";
}

/**
 * The exact body sent for one part.
 *
 * THE CACHED SYSTEM BLOCK IS `pageRulesFor`'s, BYTE FOR BYTE — the page call's
 * and the band's. A part obeys the same rules about what the kit has and what
 * may never be imported, so a third variant would be a third cold cache prefix
 * for rules that are already warm, and a rule fixed for the page would have to
 * be fixed twice.
 */
export function partRequest({ brief, spec, brand, lines, part, model, kind = "", attachments } = {}) {
  const blocks = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  const text = partPrompt({ brief, spec, brand, lines, part });
  return {
    model: model || modelsFor().pages,
    max_tokens: SITE_PAGES_MAX_TOKENS,
    tools: [PART_TOOL],
    tool_choice: { type: "tool", name: "write_part" },
    system: [{ type: "text", text: pageRulesFor(spec, kind), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: blocks.length ? [...blocks, { type: "text", text }] : text }],
  };
}

/**
 * The SOURCE FILE a planned route's page is written to.
 *
 * THE PLAN SPEAKS IN ROUTES AND THE PAGE LIST SPEAKS IN FILES, and getting the
 * direction wrong here is not a cosmetic defect — it mounts the site's home page
 * at an address no visitor asks for. `plan.pages[].path` is a ROUTE (`"/"`; the
 * field's own description says so) and `shape[].path` is validated against that
 * same set, so what `bandsOf` is asked for is a route. What `validatePages`
 * stores, and what the container writes, is a FILE (`index.tsx`).
 *
 * WRITTEN AS `routeOf`'s INVERSE AND CHECKED AGAINST IT. `site-addon.mjs` owns
 * file→route and its own comment records a bug from a FIFTH private copy of
 * that mapping — so this does not re-implement the reading, it produces a
 * candidate and asks the real reader whether it round-trips. A route that does
 * not survive the trip answers `""`, which `splitPlan` reads as "do not split
 * this page" and the caller reads as today's single call: a refusal, never a
 * guess at a file name the rest of the pipeline would not recognise.
 */
export function bandFile(route) {
  const r = typeof route === "string" ? route.trim() : "";
  if (!r.startsWith("/")) return "";
  const file = r === "/" ? "index.tsx" : r.replace(/^\//, "") + ".tsx";
  return routeOf(file) === r ? file : "";
}

/**
 * A page split into fewer than two bands is not a split.
 *
 * ONE band is the whole page with extra steps — a second request shape, a
 * fan-out, an assembler — for exactly the wall clock the single call already
 * takes. The gain is real from two upward, because the calls run together.
 */
export const MIN_BANDS = 2;

/**
 * WHY THIS GENERATION IS NOT SPLIT — one word, or `""` when nothing refuses.
 *
 * THE REASONS USED TO BE A SHRUG. `splitPlan` collapsed all four into `[]`, and
 * the caller collapsed that further into "the page was written in one call", so
 * the first live split build could say the fan-out had not run and could not say
 * WHY — four causes needing four different moves, wearing one silence. That is
 * this repository's own "a failure that cannot name itself", found on
 * `ridgeway-cycle-works` (2026-09-10) in the instrument written the same morning
 * to make the split readable.
 *
 * `tsx` IS GONE AS A REASON (2026-09-11, owner: "one agent per thing like the
 * design one"). It used to refuse here, because the design's `tsx` field
 * declares components the PAGE CALL wrote into `parts` and a band writes one
 * section — so a split build of such a site produced a page importing a file
 * nothing generated, which does not compile. The comment that stood here called
 * a band step that writes parts "a later change, not a smaller one". That is the
 * change: a part is its own agent now, in the same fan-out, and there is nothing
 * left to refuse.
 *
 * `wide` IS GONE TOO (2026-09-11, owner: "whatever the designer does then it
 * should go to the generate, if the designer does 9 the generate needs 9 if 8,
 * 8"). It stood for one day and refused a plan whose bands plus parts came to
 * more than the container would hold — `MAX_SECTIONS` (8) plus `MAX_TSX` (3) is
 * eleven against a bound of eight — so the page that most wants splitting, a
 * rich one that also needs something the kit has not got, was exactly the page
 * that could never split. Measured live on `ben-crowe-guitar`: `bands:wide`, and
 * a single call of 407,694 ms, the longest page call this platform has recorded.
 * `runFanout` QUEUES past its socket bound now, so eleven requests are eleven
 * agents running eight at a time, and there is nothing left to refuse.
 *
 * NOT REPLACED BY A HIGHER CEILING HERE, deliberately. `MAX_FANOUT_REQS` (16) is
 * the container's list bound and clears what these two producers can compose —
 * `bandsOf` slices at `MAX_BANDS`, `partsOf` at `MAX_TSX` — so a refusal in this
 * function could not fire for any input and would be a branch no sweep can kill
 * and the next session deletes. `test/page-parts.test.mjs` asserts that
 * clearance instead, so the day a product cap outgrows the list bound a test
 * goes red. And it is not the only wall: a list the container will not take
 * leaves the fire with no job id, which is `noFanoutError()` — the named
 * fallback to the single call that an older image mid-rollout already produces.
 *
 * A REVISE IS NOT SPLIT EITHER. It hands the model the site's existing pages to
 * work from (`priorPages`), and a band is written against a plan rather than
 * against a page that exists — so the two are different jobs, and doing the
 * second one under the first one's name would quietly rewrite a live site from
 * its plan.
 *
 * THE ORDER IS THE CODE'S ORDER, and that is a real limitation rather than a
 * ranking: a plan that declares `tsx` on a build whose door is also shut answers
 * `tsx`, because that is the condition that actually decided it. The reason
 * names the first wall met, never the only one standing.
 */
export function planRefusal({ shape, route, tsx, priorPages, mode } = {}) {
  if (priorPages || (mode && mode !== "build")) return "revise";
  // A ROUTE THIS PIPELINE CANNOT NAME A FILE FOR IS NOT SPLIT. `bandFile`
  // answers "" rather than guessing, and a guess here writes the page to a name
  // nothing downstream recognises.
  if (!bandFile(route)) return "route";
  const bands = bandsOf(shape, route).length;
  if (bands < MIN_BANDS) return "thin";
  return "";
}

/**
 * WHETHER TO SPLIT THIS GENERATION AT ALL.
 *
 * Answers the band lines, or `[]` meaning "use the one call". The caller reads
 * an empty answer as today's behaviour, so every refusal is a fallback to
 * something that already works rather than a failure.
 *
 * DERIVED FROM `planRefusal`, NEVER A SECOND COPY OF ITS CONDITIONS. Two lists
 * of the same thing is this repository's most-recorded silent drift, and the
 * subject here is the worst possible one: a refusal the lines disagree with is a
 * build that reports a reason it did not act on. The behaviour is byte-identical
 * to the four `return []`s this replaced.
 */
export function splitPlan(args = {}) {
  if (planRefusal(args)) return [];
  return bandsOf(args.shape, args.route);
}

/**
 * THE WHOLE DECISION, in one word, for a build that is about to fire.
 *
 * `planRefusal` knows the four reasons a PLAN cannot be split; two more live
 * above it in the caller and were just as silent — a synchronous build, which
 * cannot fan out at all because `/model` has only ever taken one request, and a
 * canary door that is shut. Answering them here rather than in `worker.js` is
 * what makes the whole ladder RUNNABLE: a decision spelled inline is provable
 * only by reading text, which this repository has recorded twice as certifying
 * the layer below the break.
 *
 * `door` IS A BOOLEAN AND NOT A THUNK, so this can be driven with its inputs
 * handed in. The cost, stated: the caller now asks the door on every fire rather
 * than only when the plan already split. It is a pure read of an environment
 * variable with no network and no side effect, and it buys the one distinction
 * that could not be made before — "the plan refused" told apart from "the flag
 * is off for this account".
 */
export function bandRefusal({ pages, canFire, door, shape, route, tsx, priorPages, mode } = {}) {
  if (!canFire) return "sync";
  if (pages !== 1) return "pages";
  const why = planRefusal({ shape, route, tsx, priorPages, mode });
  if (why) return why;
  if (!door) return "door";
  return "";
}

/**
 * Every word `bandRefusal` can answer, and the step name each becomes.
 *
 * A CENSUS DERIVES ITS SUBJECTS FROM HERE rather than listing them again, so a
 * seventh reason added next month is scanned by existing — which is the shape
 * that would have caught this whole class a day earlier. `bands:` is a PREFIX
 * the stage reader already recognises the way it recognises `prov:` and
 * `resume:`; the names stay short because `tr.at` truncates at 40 characters and
 * a truncated reason is a reason nobody can match on.
 *
 * `wide` CAME OFF 2026-09-11, and the census is what made removing it a decision
 * rather than a leftover: the list is asserted in BOTH directions, so a word no
 * producer can answer fails by staying. It is the first time that guard has
 * fired in the subtracting direction on this list.
 */
export const BAND_REFUSALS = ["sync", "pages", "revise", "route", "thin", "door", "nofanout"];
export const BAND_MARK = "bands:";

/**
 * One fan-out answer per band, paired BY POSITION with the band it was asked
 * for.
 *
 * THE INDEX IS THE PAIRING AND IT COMES OFF THE ENTRY, never off the loop:
 * `runFanout` stamps `i` on every entry precisely because the calls finish out
 * of order, and reading the list's own order here would undo that at the last
 * hop. An entry naming a position nothing planned is dropped rather than guessed
 * at.
 *
 * A CALL THAT FAILED BECOMES A BAND WITH NO SOURCE, which `bandProblems` reads
 * as "wrote nothing" and `assembleBands` stubs. So a failure arrives as a page
 * missing one section, not as a lost page — and the caller never has to know
 * which of the two happened to keep going.
 *
 * ── TWO OF THE THREE CHECKS BELOW ARE REDUNDANT TODAY, DELIBERATELY ────────
 *
 * MEASURED, not assumed, because a sweep cannot tell a second wall from a
 * missing test and the next session deletes what nothing appears to need.
 *
 * `Number.isInteger(a.i)` is redundant against `Map` itself: a non-integer key
 * is stored under a key `got.get(i)` never asks for, so the band comes out
 * empty either way. It stays because it says what `i` MEANS — a position in the
 * plan — where the Map's silence says nothing, and because a reader that later
 * keys by something else would have no wall at all.
 *
 * `a.state !== "done"` is redundant against `if (src)` for every entry
 * `runFanout` produces today: its failure branch carries `status`, `detail`,
 * `message` and `kind` and no `answer` at all, so `src` is `""` and the entry is
 * dropped one line later. It is NOT redundant against the shape this path is
 * one change away from: every band call rides `stream: true`, and a streamed
 * transcript folded back after a cut-off can carry a HALF-WRITTEN tool_use
 * beside its failure. Assembled, that is a band that compiles to something
 * nobody wrote — the one outcome worse than a missing section. The state is the
 * only thing that says the answer is whole.
 */
/**
 * The source one agent answered, out of a fan-out entry's raw reply.
 *
 * ONE READER FOR BOTH KINDS. A band and a part answer different TOOLS
 * (`write_band`, `write_part`) and the same SHAPE — one `tool_use` block with
 * one `source` string — so two readers would be "two lists of the same thing"
 * over the one expression that decides whether an agent's work is kept at all.
 * It does not check the tool's NAME, deliberately: `tool_choice` names it on the
 * way out, and a reader that re-checked it would refuse a perfectly good answer
 * the day either tool is renamed on one side only.
 */
export function answerSource(answer) {
  const use = (Array.isArray(answer && answer.content) ? answer.content : [])
    .find((b) => b && b.type === "tool_use");
  return use && use.input && typeof use.input.source === "string" ? use.input.source : "";
}

export function bandsFromAnswers(answers, lines) {
  const list = Array.isArray(lines) ? lines : [];
  const got = new Map();
  for (const a of Array.isArray(answers) ? answers : []) {
    if (!a || typeof a !== "object" || !Number.isInteger(a.i)) continue;
    if (a.state !== "done") continue;
    const src = answerSource(a.answer);
    if (src) got.set(a.i, src);
  }
  return list.map((line, i) => ({ name: bandName(line, i), line, source: got.get(i) || "" }));
}

/**
 * Write one page as N bands at once, and hand back what the ONE-CALL generator
 * hands back.
 *
 * THE RETURN SHAPE IS `generateSitePages`', deliberately and exactly:
 * `{ input: { pages: [...] }, usage }`. Everything downstream — `validatePages`,
 * the compile, the publish, `pageCredits` — then cannot tell which generator
 * ran, so none of it needed changing and none of it can drift. A second shape
 * here would be a second set of branches through the money path.
 *
 * THE USAGE IS SUMMED ACROSS THE CALLS AND THAT IS SOUND HERE for a reason that
 * does NOT generalise: every band is sent to the SAME model, so one rate column
 * prices all of them. The rule it must not break is `usageOf`'s own — a build's
 * design usage (Opus under `auto`) and its page usage (Sonnet) are priced from
 * two different rows and must never be merged. These are N readings of one row.
 *
 * ONE ROUNDING STILL. This answers a single usage object, so `pageCredits`
 * rounds once across the build exactly as it does for one call — N roundings
 * would charge a floor per band.
 */
export async function generateSiteBands({
  brief, spec, brand, attachments, model, kind = "", route, chrome, lines, tsx,
} = {}, keys, call, budget = null) {
  const file = bandFile(route);
  const bandLines = Array.isArray(lines) ? lines : [];
  // ── ONE AGENT PER THING, AND A PART IS A THING (2026-09-11) ────────────────
  //
  // The fan-out carries BOTH kinds: a band writes one section of the page, a
  // part writes one component the kit has not got. Neither waits for the other
  // — a part's whole input is its own declaration and a band that imports it
  // reads that same declaration, so there is no edge between them and nothing
  // here schedules one.
  //
  // THE BANDS COME FIRST AND THAT IS NOT COSMETIC: `bandsFromAnswers` pairs an
  // answer to a band BY ITS INDEX, so the bands must occupy 0…N-1 for that
  // pairing to be the identity it has always been. The parts follow, and their
  // own offset is what `partsFromAnswers` reads.
  const partList = partsOf(tsx);
  const reqs = [
    ...bandLines.map((line, i) => bandRequest({
      brief, spec, brand, lines: bandLines, index: i, name: bandName(line, i), model, kind, attachments,
    })),
    ...partList.map((part) => partRequest({
      brief, spec, brand, lines: bandLines, part, model, kind, attachments,
    })),
  ];
  // ONE CALL WITH N REQUESTS, not N calls: the container serialises separate
  // jobs, so a list is the only way they run together (see `model-fanout.mjs`).
  const answers = await call(keys, reqs, budget);
  const list = Array.isArray(answers) ? answers : [];
  const usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, model: reqs.length ? reqs[0].model : model };
  // ── WAS RUNNING THEM TOGETHER FASTER THAN RUNNING THEM IN TURN ─────────────
  //
  // `agentMs` is every band's own call time summed — what the work would have
  // cost one after another. `waveMs` is what the fan-out actually took, measured
  // in the CONTAINER by `runFanout` and stamped on every entry, so it survives
  // the job store, the report, the poll and the resume without a hop anybody can
  // forget. `agentMs - waveMs` is the overlap.
  //
  // WHY IT HAS TO BE THESE TWO AND NOT A COMPARISON WITH ANOTHER BUILD: the
  // single-call page step has measured 334,000-620,000 ms across ordinary
  // builds, so a spread that wide swallows any saving a split can produce. Two
  // numbers off ONE run need no baseline, which is the same argument the design
  // split's own pair was added for — and this is the half that was missing, so
  // the band split could be seen to RUN and not to PAY.
  //
  // A FAILED BAND'S TIME COUNTS: it was spent. And `waveMs` is read rather than
  // summed — every entry carries the same one, so the first finite value is the
  // answer and anything else is a fan-out that did not come from `runFanout`.
  //
  // ── AND ONE NUMBER PER BAND BESIDE THEM (2026-09-11, owner: "ok now the same
  //    for the generate step too") ─────────────────────────────────────────────
  //
  // `agentMs - waveMs` says what the fan-out saved and cannot say WHERE. A
  // fan-out costs its SLOWEST band — every other band answers and then waits —
  // so the only lever on the wall time is which band is the max, and the sum
  // hides exactly that. This is the FOURTH time on this instrument that
  // `runFanout` has measured the parts and a loop has kept only the total: the
  // design loop threw the per-call elapsed away until 2026-09-10, this path
  // threw its wall time away until the same day, and this is `a.ms` again, now
  // filed under the band that spent it.
  //
  // KEYED BY THE BAND'S POSITION, NEVER BY ITS NAME, and that is the one place
  // this differs from the design's identical pair. `bandName` is
  // `Band<n><Word>` — up to twenty-one characters — and `tr.at` cuts a key at
  // sixteen, so two bands whose words agree far enough in would arrive as ONE
  // key with the later silently overwriting the earlier: a wrong number wearing
  // a right one's name, which is the only way this instrument can LIE rather
  // than go quiet. The index is what `bandName`'s own comment calls the thing
  // that makes a band unique whatever the words do, it is short by
  // construction, and it is already what a chart of a page shows on its
  // vertical axis — band 1 is the top of the page.
  //
  // `+=` RATHER THAN `=`, for the tie: `agentMs` sums every finite `ms`, so the
  // parts can only add up to the whole if they are accumulated the same way.
  // Two entries under one index is a shape `runFanout` cannot produce (it maps
  // over the list), so this is not defending against a real fan-out — it is
  // what keeps the sum and the parts from disagreeing if one ever arrives.
  //
  // A BAND WHOSE INDEX CANNOT BE READ COUNTS IN THE SUM AND IS FILED NOWHERE.
  // The sum is the truth about what the attempt cost; a part that cannot be
  // named cannot be filed, and inventing a position for it would put one band's
  // time under another band's key.
  //
  // AND THE KEY CARRIES THE ROLE, since the fan-out holds two kinds of thing:
  // `b<n>` for a band and `p<n>` for a part. A bare index would file part 1 of a
  // seven-band page under `b8Ms` — a number that reads perfectly and names the
  // wrong kind of agent, which is the same "wrong number wearing a right one's
  // name" this whole key rule exists to refuse. `slotName` is the one place the
  // offset is applied, so the pairing and the timing cannot drift apart.
  let agentMs = 0;
  let waveMs = 0;
  const eachMs = {};
  for (const a of list) {
    const u = usageOf(a && a.answer, usage.model);
    usage.in += u.in; usage.out += u.out; usage.cacheRead += u.cacheRead; usage.cacheWrite += u.cacheWrite;
    if (a && Number.isFinite(a.ms)) {
      agentMs += a.ms;
      const slot = slotName(a.i, bandLines.length);
      if (slot) eachMs[slot] = (eachMs[slot] || 0) + a.ms;
    }
    if (!waveMs && a && Number.isFinite(a.waveMs)) waveMs = a.waveMs;
  }
  const bands = bandsFromAnswers(list, bandLines);
  // EVERY BAND EMPTY IS NOT A PAGE. `assembleBands` would answer a shell
  // composing N stubs — a page that compiles and says nothing — and the build
  // would publish it as a success. `input: null` is the same answer the one-call
  // generator gives when the model produced nothing usable, so `publishPages`
  // reports it the way it already reports that.
  if (!bands.some((b) => b.source)) {
    // THE TIMINGS RIDE THE EARLY RETURN TOO. A fan-out where every band failed
    // still spent the time, and it is the one outcome where knowing what the
    // attempt cost matters most — the recorded shape where an early return
    // quietly carries less than the late one.
    return { input: null, usage, bands: bands.length, wrote: 0, agentMs, waveMs, eachMs, shape: { stopReason: "no-bands", blocks: [] } };
  }
  // THE DECLARED COMPONENTS ARE READ FIRST, because their names are what the
  // band files must not collide with — and they cannot move, being already
  // written into the page by `tsxDirective`.
  const parts = partsFromAnswers(list, partList, bandLines.length);
  const { source, parts: bandFiles, refused } = assembleBands({
    route, chrome, bands, taken: parts.map((p) => p.name),
  });
  // THE PARTS RIDE OUT IN `parts`, NEVER IN `pages` — the same division
  // `write_pages` has always made, and for the same reason: a component in the
  // page list would be counted against the page cap, put in the nav manifest,
  // published in `sitemap.xml` and stubbed by salvage. Since 2026-09-11 the
  // BANDS ride there too, one file each.
  //
  // BAND FILES FIRST, AND THE COUNTS STAY APART. `bands`/`wrote` count bands
  // and `parts`/`wroteParts` count the design's declared components, exactly as
  // they did when a band was a local function — a row that added them up could
  // not be undone, and every instrument built on those four numbers keeps
  // reading what it has always read.
  const allParts = [...bandFiles, ...parts];
  return {
    input: { pages: [{ path: file, source }], ...(allParts.length ? { parts: allParts } : {}) },
    usage,
    bands: bands.length,
    wrote: bands.filter((b) => b.source).length,
    // WHAT WAS ASKED FOR AND WHAT CAME BACK, for the parts as for the bands.
    // A part that answered nothing is STUBBED, never dropped, and that is the
    // whole reason this path is safe to take at all: the design declared the
    // component, so a band may already have imported it, and a file that is not
    // there is not a page missing a section — it is `vite` refusing the build.
    // That is precisely the failure `planRefusal` refused `tsx` to avoid, and
    // dropping the part would walk straight back into it.
    parts: partList.length,
    wroteParts: parts.filter((p) => !p.stub).length,
    // THE OVERLAP, AS TWO NUMBERS — see the comment where they are summed, and
    // the design split's identical pair, which is stored the same way for the
    // same stated reason: a derived value beside the values it derives from is
    // two lists of the same thing, and the subtraction is free wherever it is
    // read.
    agentMs,
    waveMs,
    // ONE NUMBER PER BAND, so the sum above can say WHERE it went. See the
    // comment where it is built; `bandMarks` is what turns it into trace keys.
    eachMs,
    ...(refused.length ? { refused } : {}),
  };
}

/**
 * Which thing the fan-out's slot `i` was asked for — `b<n>` or `p<n>`.
 *
 * THE OFFSET IS APPLIED IN EXACTLY ONE PLACE. The requests are built bands-then-
 * parts, so slot 7 of a seven-band page is part 1 — and every reader that works
 * that out for itself is another copy of the same arithmetic, with a stored row
 * as the thing they can disagree about. `bandsFromAnswers` pairs by raw index
 * because bands occupy 0…N-1 and that IS the raw index; this is for everything
 * past them.
 *
 * ZERO-BASED IN, ONE-BASED OUT, because band 1 is the top of the page and part 1
 * is the first component — the array's zero is not the reader's.
 */
export function slotName(i, bandCount) {
  if (!Number.isInteger(i) || i < 0) return "";
  const n = Number.isInteger(bandCount) && bandCount >= 0 ? bandCount : 0;
  return i < n ? "b" + (i + 1) : "p" + (i - n + 1);
}

/**
 * A component that stands in for a part whose agent answered nothing.
 *
 * IT RENDERS NOTHING AND IT COMPILES, which is the whole job. The design
 * declared this component and a band may already import it, so the alternative
 * is not "a page without it" — it is `vite` refusing a file that is not there,
 * and the build ending with a charged customer and no site.
 *
 * The default export is what the import expects; the props are swallowed so a
 * band calling it with the declared props still typechecks.
 */
export function partStub(name) {
  const n = String(name == null ? "" : name).trim() || "Part";
  return "export default function " + n + "(_props: Record<string, unknown>) {\n" +
    "  return null;   // " + n + " could not be written on this build\n" +
    "}\n";
}

/**
 * One answer per part, paired BY POSITION with the part it was asked for.
 *
 * THE SAME RULE `bandsFromAnswers` FOLLOWS and for the same reason — the index
 * comes off the ENTRY, never off the loop, because the calls finish out of
 * order and reading the list's own order would undo that at the last hop. The
 * only difference is THE OFFSET: the parts sit after the bands in the request
 * list, so `a.i - n` is the whole of what tells a part's slot from a band's,
 * and it is the one expression here a mutant can change the answer through.
 *
 * THE RANGE LINE IS INERT TODAY AND IS KEPT DELIBERATELY, said out loud because
 * a sweep cannot tell a second wall from dead code and the next session deletes
 * what nothing appears to need. `got` is read at `0 … want.length - 1` and
 * nowhere else, so a key outside that span is never asked for and refusing it
 * changes no answer — MEASURED over 702 entry/clock/part combinations, which
 * agree exactly. It states the offset's contract for the day this is read some
 * other way (`[...got.values()]` would need it), and it is what catches a slip
 * in the line above.
 *
 * A `a.i < n` TEST WAS REMOVED FROM THE LOOP RATHER THAN KEPT AS THAT SECOND
 * WALL, and the difference matters: `a.i < n` is `at < 0` with the subtraction
 * done in the reader's head — one condition spelled twice, two lines apart,
 * which is "two lists of the same thing" with the smallest possible subject.
 * Two spellings of one wall are not two walls.
 */
export function partsFromAnswers(answers, parts, bandCount) {
  const list = Array.isArray(answers) ? answers : [];
  const want = Array.isArray(parts) ? parts : [];
  const n = Number.isInteger(bandCount) && bandCount >= 0 ? bandCount : 0;
  const got = new Map();
  for (const a of list) {
    if (!a || a.state !== "done" || !Number.isInteger(a.i)) continue;
    const at = a.i - n;
    if (at < 0 || at >= want.length) continue;
    const src = answerSource(a.answer);
    if (src) got.set(at, src);
  }
  // `{ name, source }` IS `write_pages`' OWN SHAPE FOR A PART, and handing
  // `validatePages` anything else would make the two generators produce
  // different things for one declaration. It owns what a component may be
  // called, refuses an empty one and repairs duplicate imports — all of which
  // a split answer needs exactly as much as a single-call one, and none of
  // which is re-decided here.
  return want.map((p, i) => {
    const source = got.get(i) || "";
    return source ? { name: p.name, source } : { name: p.name, source: partStub(p.name), stub: true };
  });
}

/**
 * One band's position, as a key the trace can store a number under.
 *
 * `b1Ms` … `bNMs`, ONE-BASED, because that is how a person counts the bands
 * down a page and how every chart of one is labelled — band 1 is the top. The
 * index arriving here is zero-based, which is the array's business and not the
 * reader's.
 *
 * THE KEY IS REFUSED, NEVER REPAIRED. A position that is not a whole number is
 * not a position, and `b[object Object]Ms` or `bNaNMs` on a stored row is worse
 * than a silence: it reads like a band that took no time. Presence is the
 * signal here as everywhere on this mark.
 *
 * IT MUST BE A STRING, and that is the recorded coercion trap rather than
 * fussiness: `Object.entries` hands string keys, and `/^b\d+$/.test(["b3"])`
 * is TRUE because `test` coerces — so a one-element array would key a band.
 *
 * ── AND THE KEY CARRIES THE ROLE (2026-09-11, owner: "one agent per thing like
 *    the design one") ────────────────────────────────────────────────────────
 *
 * The fan-out holds two kinds of thing now — a BAND writes one section of the
 * page and a PART writes one component — so the slot name arriving here is
 * `b<n>` or `p<n>` and not a bare index. `slotName` is the one place that is
 * decided; this only refuses what it cannot read. A bare index would file part
 * 1 of a seven-band page under `b8Ms`: a number that reads perfectly and names
 * the wrong kind of agent, which is exactly the "wrong number wearing a right
 * one's name" this whole key rule exists to refuse.
 *
 * ── TWO WALLS THE DESIGN'S `agentMark` HAS AND THIS DELIBERATELY DOES NOT ────
 *
 * There is no truncation check, because a slot cannot reach sixteen characters
 * without thirteen digits, and no already-taken check, because every key this
 * makes is a letter, digits and `Ms` while the six fixed keys (`bands`,
 * `wrote`, `parts`, `wroteParts`, `agentMs`, `waveMs`) are words — they cannot
 * collide. Both are stated rather than copied: a wall that cannot fire reads as
 * a test gap for ever and the next session deletes it wondering what it was
 * for. `agentMark` needs both because an AGENT's key comes from a name.
 *
 * And there is deliberately NO ceiling at `MAX_BANDS` or `MAX_TSX`:
 * `generateSiteBands` takes its lines and its parts as arguments, so a caller
 * handing more than the plan allows would have the extra ones' times silently
 * dropped — the worse failure of the two, since the sum would then disagree
 * with the parts and nothing would say why.
 */
export function bandMark(at) {
  if (typeof at !== "string" || !/^[bp]\d+$/.test(at)) return "";
  return at + "Ms";
}

/**
 * The fan-out's numbers, as the trace can store them — ONE projection.
 *
 * `tr.at` keeps FINITE NUMBERS ONLY and drops everything else silently: a
 * deliberate wall, so a model's prose or a connection string can never reach a
 * trace by accident, and a trap for anything handed to a mark unprojected.
 *
 * A SHAPE IT CANNOT READ ANSWERS ZEROS rather than nothing, so the four fixed
 * keys are on the row either way — a missing key and a key reading 0 are the
 * same thing from a stored trace, and inventing a number would be worse than
 * both. The PER-BAND keys are the opposite rule and deliberately so: a band
 * that did not run has no key at all, because `b3Ms: 0` reads as a band that
 * answered instantly. The four can afford a zero; a per-band key cannot.
 *
 * The design split's `waveMarks` is the same projection one path over, and the
 * two are NOT shared: this one keys by position and that one by name, which is
 * the whole difference between a fan-out of bands a model planned and a fan-out
 * of agents we named. One function answering both would need a mode.
 */
export function bandMarks(fan) {
  const f = fan && typeof fan === "object" ? fan : {};
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const marks = {
    bands: num(f.bands), wrote: num(f.wrote),
    // THE PARTS ARE COUNTED BESIDE THE BANDS, not folded into them: they are a
    // different kind of thing and a row that added them up could not say
    // whether a build wrote seven bands or five bands and two components.
    parts: num(f.parts), wroteParts: num(f.wroteParts),
    agentMs: num(f.agentMs), waveMs: num(f.waveMs),
  };
  const each = f.eachMs && typeof f.eachMs === "object" ? f.eachMs : {};
  for (const [at, ms] of Object.entries(each)) {
    const key = bandMark(at);
    if (!key) continue;
    if (typeof ms === "number" && Number.isFinite(ms)) marks[key] = ms;
  }
  return marks;
}

/** Where a component written for this site is imported from. */
export const PART_IMPORT = "@/routes/-parts/";

/**
 * A band's COMPONENT name as the FILE name that holds it.
 *
 * DERIVED FROM `bandName` RATHER THAN BUILT BESIDE IT, so the two can never
 * name different things. The import the shell writes and the file the
 * container writes are the two halves of one fact, and a second reading of the
 * band's own line — the shape this repository calls "two lists of the same
 * thing" — would eventually disagree about a band whose word had a digit in
 * it. `bandName` answers `Band<n><Word>` and nothing else, so the kebab of it
 * always satisfies `safePart`'s `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`.
 */
export function bandFileName(name) {
  return String(name == null ? "" : name)
    .replace(/([a-z])([A-Z0-9])/g, "$1-$2")
    .replace(/([0-9])([A-Za-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * A file name for this band that no component on the site has already taken.
 *
 * A DESIGN MAY DECLARE A COMPONENT CALLED `band-1-hero`. Nothing stops it —
 * `TSX_ITEM.name` asks for a kebab name and every kebab string is legal — and
 * the collision is not cosmetic: `validatePages` refuses the second entry of a
 * duplicated name, so one of the two files is never written and the page
 * importing it does not compile. That is `vite` refusing the build, which is
 * the failure the whole part path exists to avoid.
 *
 * THE BAND'S NAME IS THE ONE THAT MOVES, never the declared component's: the
 * declared name is already written into the page by `tsxDirective`, so it
 * cannot move without a source rewrite. The band's is ours on both sides —
 * this function names the file AND the import in the same pass — so moving it
 * costs nothing and is invisible.
 */
export function freeBandFile(base, used) {
  const b = String(base == null ? "" : base) || "band";
  const taken = used instanceof Set ? used : new Set();
  if (!taken.has(b)) return b;
  for (let n = 2; n <= 99; n += 1) if (!taken.has(b + "-" + n)) return b + "-" + n;
  return b + "-99";
}

/**
 * One band, as a module of its own.
 *
 * THE BODY IS KEPT VERBATIM AND THE EXPORT IS APPENDED, which is the whole
 * transformation. `bandProblems` requires a band to declare itself and NOT to
 * export — the band writer answers a component, and what kind of file holds it
 * has always been the assembler's business, not the model's. So separating the
 * bands needed no prompt change and no re-training: the contract the agents
 * are held to is byte-for-byte the one they were held to when every band went
 * into one file.
 *
 * `export default` because that is what a file under `-parts/` is: `partPrompt`
 * says so to the model, `partStub` writes one, and `tsxDirective` tells the
 * page to import the default. One rule for what lives in that directory,
 * whoever wrote the file.
 */
export function bandModule(name, imports, body) {
  const head = (Array.isArray(imports) ? imports : []).filter(Boolean).join("\n");
  return (head ? head + "\n\n" : "") + String(body || "").replace(/\s+$/, "") +
    "\n\nexport default " + String(name) + ";\n";
}

/**
 * Every band's answer, as a page shell plus ONE FILE PER BAND.
 *
 * IT USED TO CONCATENATE (owner, 2026-09-11, on our explorer beside Lovable's:
 * *"their stuff is files organized ours is all on one file"*). The fan-out has
 * always been N agents writing N self-contained components; this function was
 * the one place they stopped being separate things. Now each lands at
 * `src/routes/-parts/<file>.tsx` and `index.tsx` keeps what is genuinely the
 * page: the route export and the `SiteChrome` composition `pageShell` already
 * built. NOTHING NEW IS GENERATED — the same N answers, at N paths.
 *
 * ORDER IS THE DESIGN'S ORDER, not the order the answers came back in. The
 * whole point of running the bands at once is that they finish out of order,
 * and a page assembled in finishing order is a page whose hero is wherever the
 * fastest agent happened to land. The caller hands them in `shape` order and
 * this preserves it; nothing here sorts.
 *
 * THE CROSS-BAND IMPORT MERGE IS GONE, AND SO IS THE PROBLEM IT SOLVED. The
 * old header held every band's imports at once, so two bands importing `Card`
 * produced a duplicate declaration and run 90 died in the bundler on exactly
 * that. Each band now owns its own header, so the repeats cannot meet;
 * `dedupeImports` still runs over the SHELL, whose imports this function
 * writes itself, and `validatePages` runs `undupe` over every part, so a band
 * that repeats an import INSIDE its own file is still repaired.
 *
 * A band with problems is STUBBED rather than dropped, and it is stubbed as a
 * FILE: dropping it would leave the shell importing a module that is not
 * there, which is `vite` refusing the build rather than a page missing a
 * section — a strictly worse failure than the local stub it replaces.
 */
export function assembleBands({ route, chrome, bands, taken }) {
  const list = (Array.isArray(bands) ? bands : []).filter((b) => b && typeof b === "object" && typeof b.name === "string" && b.name);
  const refused = [];
  const parts = [];
  const imports = [...SHELL_IMPORTS];
  const names = [];
  const used = new Set(
    (Array.isArray(taken) ? taken : [])
      .map((n) => String(n == null ? "" : n).trim().toLowerCase())
      .filter(Boolean),
  );
  for (const b of list) {
    const file = freeBandFile(bandFileName(b.name), used);
    used.add(file);
    names.push(b.name);
    imports.push('import ' + b.name + ' from "' + PART_IMPORT + file + '";');
    const why = bandProblems(b.name, b.source);
    if (why.length) {
      refused.push({ name: b.name, line: b.line || "", why });
      parts.push({ name: file, source: bandModule(b.name, [], bandStub(b.name, b.line)), stub: true });
      continue;
    }
    const { imports: got, body } = splitBand(b.source);
    parts.push({ name: file, source: bandModule(b.name, got, body) });
  }
  const source = imports.join("\n") + "\n\n" + pageShell({ route, chrome, names }) + "\n";
  return { source: dedupeImports(source).source, parts, refused };
}
