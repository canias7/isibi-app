/**
 * ONE EDITABLE VIEW OF A SITE'S SOURCE: its pages and its own components, in a
 * single list that every rung already knows how to read.
 *
 * WHY THIS EXISTS (2026-09-11). A site's source has always been two stores —
 * `source/<slug>/pages.json` as `{path, source}` and `source/<slug>/parts.json`
 * as `{name, source}` — and the cheap edit rungs only ever saw the first. That
 * cost nothing while a component was a rarity and every word on the page lived
 * in the page. It stopped being free the day the band split began writing each
 * SECTION to its own file: the prose a customer asks to change is now in the
 * parts, and a `text` lane that reads only `pages` would look at a shell of
 * imports, find none of the words, and escalate a one-credit wording change to
 * a full page rewrite. Every time.
 *
 * THE ADAPTER IS HERE AND NOT IN THE RUNGS, and that is the whole design.
 * `textItems` and `applyEdits` key on `p.path` and NEVER interpret it — read,
 * both of them — so a part presented with a path is a page as far as they are
 * concerned. Teaching each rung about a second shape would be the same
 * knowledge in several places, and this repository has a name for that; one
 * mapping, in one file, driven both ways.
 *
 * THE ROUND TRIP IS THE CONTRACT. `splitEditable(editableFiles(pages, parts))`
 * must give back exactly what went in, or an edit silently moves a component
 * into the page list — where it would be counted against the page cap, put in
 * the nav manifest, published in `sitemap.xml` and stubbed by salvage. The
 * guard drives that identity rather than asserting it in prose.
 *
 * DEPENDENCY-FREE, so it can be imported by the container as readily as by the
 * Worker, and so the guard can drive it with nothing stubbed.
 */

/** The directory a component written for this site lives in, under `src/routes`. */
export const PART_DIR = "-parts/";

/**
 * The editable path for a stored part.
 *
 * IT IS `safePart`'s ANSWER, MINUS THE `src/routes/` THE STORES DO NOT CARRY.
 * `pages.json` holds `index.tsx`, not `src/routes/index.tsx`, so a part shown
 * beside one has to be relative in the same way or the two halves of a list
 * disagree about what a path is.
 */
export function partPath(name) {
  const n = String(name == null ? "" : name).trim();
  return n ? PART_DIR + n + ".tsx" : "";
}

/**
 * The stored part name behind an editable path, or `""` when it is a page.
 *
 * ANCHORED AND SUFFIXED, never a substring test: a PAGE legitimately called
 * `my-parts/x.tsx` is not a component, and reading it as one would file it into
 * `parts.json` and drop it off the site.
 */
export function partNameOf(path) {
  const p = typeof path === "string" ? path : "";
  if (!p.startsWith(PART_DIR) || !p.endsWith(".tsx")) return "";
  return p.slice(PART_DIR.length, -".tsx".length);
}

/**
 * ⚠ A QUOTE STRAIGHT AFTER A WORD CHARACTER IS PROSE, NOT A STRING — and this
 * is the one thing that makes reading a `.tsx` file lexically safe at all
 * (measured 2026-09-19, in `site-picture.mjs`, where this rule was born).
 *
 * JSX TEXT is full of apostrophes: *"somebody else's"*, *"We've played"*. Read
 * as string openers they swallow everything to the next one — the first attempt
 * at masking cost **29 real picture frames across 6 of the 100 corpus sites**,
 * an entire `<Gallery items={[…]}/>` vanishing because a contraction two
 * hundred characters above it opened a string nobody wrote. A false all-clear,
 * which this repository rates worse than a false alarm.
 *
 * In JavaScript a string NEVER opens directly after a letter or a digit — there
 * is no implicit concatenation — so the test costs nothing real. A BACKTICK is
 * exempt because `css\`…\`` is a tagged template, where a word character before
 * it is exactly the ordinary case.
 */
const AFTER_WORD = /[A-Za-z0-9]$/;

/**
 * ONE PASS OVER A SOURCE FILE: the code with its comments blanked, the same
 * with its string CONTENTS blanked too, and where every real string literal is.
 *
 * TWO VIEWS OF ONE FILE, BECAUSE ONE COPY CANNOT SERVE BOTH READERS — the
 * pattern `site-picture.mjs` already records. An import specifier is READ from
 * the copy that keeps string contents; whether a quote is a real literal
 * boundary can only be known from the copy that blanks them, because a quote
 * inside a string is not a quote. Both are LENGTH-PRESERVING, so one offset
 * means the same thing in either.
 */
function scanSource(src) {
  const s = typeof src === "string" ? src : "";
  let code = "", mask = "", quote = "", qAt = -1, i = 0;
  const strings = [];
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (quote) {
      // AN ESCAPE AND ITS VICTIM MOVE TOGETHER, or a `\"` ends the string and
      // the rest of the line reads as code. Two characters in, two out.
      if (c === "\\" && s[i + 1] !== undefined) { code += c + s[i + 1]; mask += "  "; i += 2; continue; }
      if (c === quote) { code += c; mask += c; strings.push({ at: qAt, end: i }); quote = ""; i++; continue; }
      // A NEWLINE SURVIVES EVEN INSIDE A MASKED TEMPLATE, so a line count is
      // the file's own whichever copy is being read.
      code += c; mask += (c === "\n" ? "\n" : " ");
      i++;
      continue;
    }
    if ((c === '"' || c === "'") && !AFTER_WORD.test(code)) { quote = c; qAt = i; code += c; mask += c; i++; continue; }
    if (c === "`") { quote = c; qAt = i; code += c; mask += c; i++; continue; }
    if (c === "/" && d === "/") {
      while (i < s.length && s[i] !== "\n") { code += " "; mask += " "; i++; }
      continue;
    }
    if (c === "/" && d === "*") {
      const end = s.indexOf("*/", i + 2);
      const stop = end === -1 ? s.length : end + 2;
      for (; i < stop; i++) { const ch = s[i] === "\n" ? "\n" : " "; code += ch; mask += ch; }
      continue;
    }
    code += c; mask += c;
    i++;
  }
  return { code, mask, strings };
}

/**
 * A SOURCE FILE'S CODE, WITH ITS COMMENTS BLANKED — and optionally its string
 * CONTENTS too. Length-preserving either way.
 *
 * IT MOVED HERE FROM `site-picture.mjs` ON 2026-09-20, WHEN IT GAINED A SECOND
 * CALLER, and it moved rather than forked. It is a fact about a source file's
 * lexical structure, which is this module's subject and not the picture
 * reader's; a second copy is how a frame counter and an import reader come to
 * disagree about what a comment is. `site-picture.mjs` RE-EXPORTS it, so every
 * caller keeps the name it has always imported and the guard asserts the two
 * are the same function by identity.
 */
export function codeOnly(src, maskStrings = false) {
  const s = scanSource(src);
  return maskStrings ? s.mask : s.code;
}

/** The furthest back an import clause may reach from its own specifier. */
const MAX_CLAUSE = 600;
/** `import … from "` · `import "` · `export … from "` · `import("` · `require("`. */
const IMPORT_HEAD = /(?:(?:^|[\s;{}()=,])(import|export)\s+([^'"`;]*?)\s+from\s*$)|(?:(?:^|[\s;{}()])(import)\s*$)|(?:\b(?:import|require)\s*\(\s*$)/;
const IDENT = /^[A-Za-z_$][\w$]*$/;
const EXT = /\.(?:tsx|ts|jsx|js|mjs|cjs)$/;

/**
 * EVERY MODULE SPECIFIER THIS SOURCE REALLY IMPORTS — `{spec, clause, kind,
 * start, end}`, one entry per import.
 *
 * ⚠ WHY THE SUBSTRING TEST IT REPLACES WAS WRONG (2026-09-20). `importsPart`
 * searched the RAW source for the path, so a commented-out import, a block
 * comment quoting one, and a string that happens to contain one all read as
 * imports. MEASURED through the addon route on all three shapes: a photograph
 * in a component the gallery does not import was published, billed, and
 * reported `configured` — the reporting crediting it to a page whose only
 * mention of that component is a line somebody commented out.
 *
 * A COMMENT IS NOT CODE AND A QUOTED EXAMPLE IS NOT AN IMPORT, and telling
 * those two apart takes two different mechanisms. The comment half is the
 * lexer: the scan runs on `codeOnly`, so a `//` or `/* *​/` region is blank
 * before anything looks for a path. The quoted half is POSITION: a specifier is
 * a string literal sitting immediately after `from`, after `import`, or inside
 * `import(`/`require(` — and `const hint = "import … from '…/-parts/x'"` sits
 * after an `=`, so it is not one. A substring test cannot express that at all.
 *
 * THE LITERAL BOUNDARIES COME FROM THE MASKED COPY AND THE VALUE FROM THE
 * PLAIN ONE, because a quote inside a string is not a boundary — which is
 * exactly how the quoted example above hides a second, inner pair.
 */
export function importSpecs(src) {
  const sc = scanSource(src);
  const out = [];
  for (const { at, end } of sc.strings) {
    if (sc.code[at] === "`") continue;
    const head = sc.mask.slice(Math.max(0, at - MAX_CLAUSE), at);
    const m = IMPORT_HEAD.exec(head);
    if (!m) continue;
    const kind = m[1] || m[3] || "call";
    out.push({
      spec: sc.code.slice(at + 1, end),
      clause: (m[2] || "").trim(),
      kind,
      start: Math.max(0, at - MAX_CLAUSE) + m.index,
      end,
    });
  }
  return { specs: out, code: sc.code, mask: sc.mask };
}

/**
 * DOES THIS SPECIFIER NAME THAT COMPONENT — the path convention `PART_DIR`
 * states, asked of a WHOLE specifier rather than of a substring.
 *
 * WHICH SPELLINGS COUNT DEPENDS ON WHERE THE SOURCE ITSELF LIVES. From a PAGE
 * (`src/routes/<x>.tsx`) it is the `-parts/` form: both the `@/routes/-parts/x`
 * every prompt teaches and the relative `./-parts/x` TypeScript also resolves.
 *
 * ⚠ FROM A COMPONENT A SIBLING IS ALSO `./x`, WITH NO `-parts/` IN IT AT ALL.
 * MEASURED before admitting it: the only spelling ANY prompt teaches is
 * `@/routes/-parts/<name>`, and the 100-site corpus contains ZERO `-parts/`
 * files at all — it predates components — so there is no evidence either way
 * about what a model writes between two siblings. What decides it is the
 * asymmetry rather than a guess: a relative `./x` from inside `-parts/` can
 * resolve to NOTHING BUT `-parts/x.tsx`, so admitting it has a false-alarm rate
 * of zero BY CONSTRUCTION, while missing it hands the compiler a dangling
 * import — and, here, silently detaches a nested component from its page.
 *
 * AND `inPart` IS THE DISCRIMINATOR THAT KEEPS IT SAFE: from a PAGE, `./x`
 * means `src/routes/x.tsx` — another page — so the sibling form is asked of
 * component sources and of nothing else.
 *
 * NO ESCAPING, AND THAT IS THE WHOLE POINT OF COMPARING WHOLE SPECIFIERS. The
 * substring form had to escape the name because it built a PATTERN out of it,
 * and `qr.card` unescaped matched `qrxcard`. Equality has no pattern to abuse,
 * and `photo-wall-2` cannot satisfy `photo-wall` for the same reason — where
 * the old `(?![\w-])` was a guard bolted on beside the same bug.
 */
function specNames(spec, name, inPart) {
  const s = String(spec == null ? "" : spec).trim().replace(EXT, "");
  if (!s || !name) return false;
  const tail = PART_DIR + name;
  if (s === tail || s.endsWith("/" + tail)) return true;
  return inPart === true && s === "./" + name;
}

/** A regex-safe copy of an identifier read out of somebody else's source. */
const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * THE LOCAL NAMES AN IMPORT CLAUSE BINDS, or `null` when the clause is one this
 * cannot read — which is an answer and not a failure.
 *
 * `null` MEANS "CANNOT TELL" AND EVERY CALLER READS IT AS UNCERTAINTY. A
 * namespace import (`* as N`) can render through a member (`<N.Band/>`); a
 * side-effect import binds nothing; a dynamic `import()` binds its result
 * somewhere this cannot follow; a re-export binds no local name at all. None of
 * those establishes placement and none of them refutes it either, so they are
 * kept apart from the one shape that really is a definite negative: a clause
 * that binds names, none of which the file ever mentions again.
 *
 * ⚠ `null` AND `[]` ARE THE SAME ANSWER TO THE ONE CALLER, MEASURED RATHER
 * THAN REASONED ABOUT: `partUses` reads `bound === null || !bound.length` as
 * one condition, so swapping either `null` below for `[]` changes no verdict —
 * driven over a re-export, a dynamic import, a side-effect import and a
 * namespace import, all four `unsure` either way. The distinction is kept
 * because the two say different things to a reader (*nothing to go on* against
 * *a clause that really binds nothing*), and because a later caller that wants
 * to tell them apart must not have to re-derive one; the sweep mutates the
 * OBSERVABLE half — a non-import kind handed a name it never bound, which
 * turns every one of those four into a definite `unused`.
 */
function bindingsOf(clause, kind) {
  if (kind !== "import") return null;
  const c = String(clause || "").replace(/^type\s+/, "").trim();
  if (!c) return null;
  if (/\*\s*as\s/.test(c)) return null;
  const out = [];
  const brace = c.indexOf("{");
  const head = (brace === -1 ? c : c.slice(0, brace)).replace(/,\s*$/, "").trim();
  if (head) {
    if (!IDENT.test(head)) return null;
    out.push(head);
  }
  if (brace !== -1) {
    const close = c.lastIndexOf("}");
    if (close < brace) return null;
    for (const piece of c.slice(brace + 1, close).split(",")) {
      const p = piece.trim().replace(/^type\s+/, "");
      if (!p) continue;
      const m = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(p);
      if (!m) return null;
      out.push(m[2] || m[1]);
    }
  }
  return out;
}

/**
 * HOW THIS SOURCE USES EACH OF THOSE COMPONENTS — a Map of name → `"rendered"`
 * | `"unsure"` | `"unused"`, holding only the ones it really imports.
 *
 * ⚠ AN IMPORT IS NOT A PLACEMENT (2026-09-20). Owner: *"routedSources treats an
 * unused import as placement… the photograph exists in the component file, the
 * gallery never renders it, yet coverage becomes configured."* REPRODUCED
 * through the addon route: a page importing `photo-wall` and rendering nothing
 * answered exactly what a page rendering it answered.
 *
 * THE TWO QUESTIONS ARE TWO AND BOTH ARE WANTED. The withholding cascade asks
 * *does this file DEPEND on that component* — where a dangling import breaks
 * `vite` whether or not anything renders it, so `importsPart` stays what it is.
 * The reporting asks *does a visitor on this page SEE it*, which an unused
 * import cannot answer.
 *
 * THREE ANSWERS, BECAUSE THE MIDDLE ONE IS THE POINT (owner: *"Where placement
 * cannot be established, preserve uncertainty"*):
 *
 *   rendered — a bound name appears as `<Name`, which is placement
 *   unused   — the clause binds names and the file mentions none of them
 *              again: a DEFINITE negative, and the only one claimed here
 *   unsure   — anything else. A binding used as a value (`[Band]`, a prop, a
 *              ternary) really can reach the page through a path no reader of
 *              the source can follow, and so can a namespace member, a dynamic
 *              import and a clause shape this cannot parse.
 *
 * THE DIRECTION IS DELIBERATE AND ASYMMETRIC. Reading a placed component as
 * `unused` costs the customer a *"Still to do"* about something that is on
 * their site; reading an unplaced one as `unsure` costs a sentence inviting
 * them to look. So `unused` is claimed only when the evidence is airtight and
 * everything else falls to `unsure`.
 *
 * THE IMPORT STATEMENTS ARE BLANKED BEFORE THE USE TEST, or a binding would
 * always be "mentioned again" by its own clause — and by every OTHER import's,
 * which is why all of them go rather than only this component's.
 *
 * ⚠ AND THE TWO TESTS READ TWO DIFFERENT COPIES, WHICH IS THE WHOLE OF THE
 * 2026-09-20 CORRECTION. Owner: *"Import PhotoWall normally. Set const example
 * = '<PhotoWall/>'. Render {example}… The saved page renders escaped text and
 * zero images. Coverage still becomes configured… Exclude string contents from
 * placement evidence while preserving real JSX usage and uncertainty for
 * indirect usage."* REPRODUCED here on all three quoting shapes — single,
 * double and template — each answering `rendered`, byte for byte what the
 * genuinely rendered control answered. `importSpecs` had excluded a quoted
 * example by POSITION and this scan searched string contents again, one line
 * further down.
 *
 *   drawn (PLACEMENT) reads the MASKED copy — a `<Name` between quotes is text
 *     a visitor reads, never a component a visitor sees. Real JSX survives
 *     masking because it is code: `<Band title="a <Band/> example"/>` keeps its
 *     own opening tag and loses only the attribute's contents.
 *   seen (THE MENTION) reads the CODE copy — a name mentioned ANYWHERE, a
 *     string included, defeats the definite negative and falls to `unsure`.
 *
 * ⚠ THE SECOND HALF IS NOT SYMMETRY AND MASKING BOTH WOULD BREAK THE ASYMMETRY
 * RULE ABOVE. `scanSource` masks a template literal WHOLE, `${…}` included, so
 * a binding referenced only in an interpolation (`` `${Band}` ``) would read
 * `unused` — a DEFINITE negative over a file that really does reference it.
 * The same goes for the lexer's own recorded limitation: a quote opening after
 * `>` in JSX prose swallows to the next one, and reading the mention off the
 * code copy turns that into uncertainty rather than a false absence. `unused`
 * stays claimed only where it is airtight.
 */
export function partUses(src, names, inPart) {
  const out = new Map();
  const list = [...new Set((Array.isArray(names) ? names : [])
    .map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean))];
  if (!list.length) return out;
  const { specs, code, mask } = importSpecs(src);
  if (!specs.length) return out;
  // BOTH COPIES ARE LENGTH-PRESERVING, so one set of offsets blanks the import
  // statements out of each and a position means the same thing in either.
  //
  // ⚠ AND ONLY THE CODE COPY'S BLANKING IS OBSERVABLE TODAY, MEASURED RATHER
  // THAN REASONED ABOUT. The placement test looks for `<Name`, and an import
  // statement cannot contain a `<` — so blanking the MASKED copy changes no
  // verdict: over the 324-file corpus (every one of them importing something)
  // and eleven constructed import spellings, ZERO blanked regions hold a `<`
  // and ZERO files read differently with it and without it. It is kept because
  // the two copies are ONE idea — the same file, the same offsets, blanked the
  // same way, so that an import statement is never its own evidence — and a
  // reader finding one blanked and the other not would have to re-derive why.
  // The sweep mutates the PAIR, which the code copy's own half kills: unblanked
  // there, a binding is always "mentioned again" by its own clause and every
  // `unused` becomes `unsure`.
  const blank = (s) => {
    let r = s;
    for (const m of specs) r = r.slice(0, m.start) + " ".repeat(m.end + 1 - m.start) + r.slice(m.end + 1);
    return r;
  };
  const rest = blank(code);
  const shown = blank(mask);
  for (const n of list) {
    const mine = specs.filter((m) => specNames(m.spec, n, inPart));
    if (!mine.length) continue;
    let bound = [];
    for (const m of mine) {
      const b = bindingsOf(m.clause, m.kind);
      if (b === null) { bound = null; break; }
      bound.push(...b);
    }
    if (bound === null || !bound.length) { out.set(n, "unsure"); continue; }
    const drawn = bound.some((b) => new RegExp("<\\s*" + esc(b) + "(?![\\w$])").test(shown));
    if (drawn) { out.set(n, "rendered"); continue; }
    const seen = bound.some((b) => new RegExp("(^|[^\\w$])" + esc(b) + "([^\\w$]|$)").test(rest));
    out.set(n, seen ? "unsure" : "unused");
  }
  return out;
}

/**
 * DOES THIS SOURCE IMPORT THAT COMPONENT — the ONE definition, and it lives
 * here because it is a fact about the path convention `PART_DIR` above states
 * and about nothing else.
 *
 * IT WAS A CLOSURE INSIDE `deadQrs` UNTIL 2026-09-20, which was right while it
 * had one caller. It has several now — the withholding cascade, and the
 * file→route association `routedSources` needs to say which PAGE a component's
 * photograph is on — and this repository's most-repeated defect is two lists of
 * one thing drifting apart. A second copy here would be a component the cascade
 * withholds and the reporting still credits to a page, or the reverse.
 *
 * IT IS THE COMPILE QUESTION AND STAYS ONE. A component this file imports and
 * never renders is still a component whose absence breaks the build, so the
 * cascade must keep withholding for it; `partUses` above is the PLACEMENT
 * question, which is a different one.
 */
export function importsPart(src, name, inPart) {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) return false;
  return importSpecs(src).specs.some((m) => specNames(m.spec, n, inPart));
}

/** One source, one component: `"rendered"` | `"unsure"` | `"unused"` | `"none"`. */
export function partUse(src, name, inPart) {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) return "none";
  return partUses(src, [n], inPart).get(n) || "none";
}

/** `specNames` RUN BACKWARDS: the two spellings it admits, as capture groups. */
const PART_SPEC = new RegExp("(?:^|/)" + esc(PART_DIR) + "([^/]+)$");
const SIBLING_SPEC = /^\.\/([^/]+)$/;

/**
 * EVERY COMPONENT OF THIS SITE'S OWN THAT THIS SOURCE IMPORTS — `[{name,
 * clause, kind}]`, read off the SPECIFIER rather than off a stored list.
 *
 * WHY OFF THE FILE AND NOT OFF `parts.json`: the store answers what the SITE
 * has, and the question every caller here asks is what THIS FILE depends on. A
 * caller holding no store read — and the cheap tweak rung is one deliberately,
 * because it costs nothing when it works — would otherwise have to fetch one to
 * ask, and an UNREADABLE store would become a cannot-tell in a decision whose
 * answer is sitting in the source it is already holding.
 *
 * IT IS `specNames` RUN BACKWARDS, and the guard DRIVES that identity rather
 * than asserting it in prose: every name this answers for a specifier,
 * `specNames` must accept for that same specifier and that same `inPart`, or
 * two readers of one path convention have drifted — this repository's most
 * repeated defect. The two regexes are built from `PART_DIR` itself for the
 * same reason.
 */
export function localParts(src, inPart) {
  const out = [];
  for (const m of importSpecs(src).specs) {
    const s = String(m.spec == null ? "" : m.spec).trim().replace(EXT, "");
    if (!s) continue;
    const p = PART_SPEC.exec(s);
    const q = p ? null : (inPart === true ? SIBLING_SPEC.exec(s) : null);
    const name = p ? p[1] : (q ? q[1] : "");
    if (!name) continue;
    out.push({ name, clause: m.clause, kind: m.kind });
  }
  return out;
}

/** A value whose meaning is fixed by its own text, with nothing computed. */
const LITERAL_VALUE = /^(?:'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?|true|false|null|undefined)$/;

/** A value that is one name and nothing else, so its meaning is that name's. */
const ONE_NAME = /^[A-Za-z_$][\w$]*$/;

/** How many page-local names one prop's closure may reach before it is unread. */
const MAX_CLOSURE = 64;

/** The `}` closing the `{` at `at`, or -1. Reads a copy with strings blanked. */
function closeBrace(mask, at, limit) {
  let depth = 0;
  for (let i = at; i < limit; i++) {
    const c = mask[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/**
 * THE FIRST OF `stops` AT DEPTH ZERO FROM `from`, or `limit`. A closing bracket
 * at depth zero stops too: it is the end of whatever block the scan began in,
 * and running past it would read the next declaration as part of this one.
 */
function depthStop(mask, from, limit, stops) {
  let d = 0;
  for (let i = from; i < limit; i++) {
    const c = mask[i];
    if (c === "{" || c === "(" || c === "[") d++;
    else if (c === "}" || c === ")" || c === "]") { if (d === 0) return i; d--; }
    else if (d === 0 && stops.includes(c)) return i;
  }
  return limit;
}

/**
 * THE NAMES AN EXPRESSION READS — every identifier in it that is not a MEMBER
 * name, as a Set.
 *
 * IT OVER-COLLECTS ON PURPOSE AND THE ASYMMETRY IS THE WHOLE ARGUMENT. Reading
 * a name that is not really a read (an object-literal key, a label, a callback
 * parameter that happens to share a page name) can only ADD an entry to a
 * closure, and an entry whose text does not move changes no answer. MISSING a
 * real read is the other direction, and it is precisely the hole this module is
 * being asked to close: a value whose meaning moved through a name nobody
 * followed. So there is no key filter and no keyword list — a keyword resolves
 * to no page-local declaration and drops out by itself.
 *
 * A MEMBER NAME IS THE ONE THING EXCLUDED, because `a.b` and `a?.b` really do
 * read `a` and never `b`, and `b` there can collide with a page name for
 * reasons that have nothing to do with the value.
 *
 * READ THE MASKED COPY: a name inside somebody's sentence is not a read.
 */
function readsIn(masked) {
  const out = new Set();
  const re = /[A-Za-z_$][\w$]*/g;
  let m;
  while ((m = re.exec(masked))) {
    let k = m.index - 1;
    while (k >= 0 && /\s/.test(masked[k])) k--;
    if (k >= 0 && masked[k] === ".") continue;
    out.add(m[0]);
  }
  return out;
}

/** Every name a binding pattern introduces — over-collecting, for `readsIn`'s reason. */
function patternNames(masked) {
  return [...readsIn(masked)].filter((n) => IDENT.test(n));
}

/**
 * EVERY NAME THIS SOURCE DECLARES FOR ITSELF, AND THE TEXT THAT DECIDES WHAT
 * EACH ONE MEANS — a Map of name → `{texts, masks, literal}`.
 *
 * ⚠ WHY THIS EXISTS, AND IT IS A DEFECT REPORT RATHER THAN A DESIGN NOTE. The
 * prop reader below used to compare a prop's own TEXT, which is a claim about
 * how the value is SPELLED and not about what it MEANS. Reproduced through the
 * real edit route: a tweak asked to count places left moved the arithmetic one
 * line up the page —
 *
 *     const { data: rawBookingCount } = useRpc(…);
 *     const bookingCount = 6 - Number(rawBookingCount ?? 0);
 *
 * — and left `bookingCount={Number(bookingCount ?? 0)}` byte-identical. Every
 * prop expression matched, the contract was satisfied, and the page shipped
 * telling a full day it had six places going spare. THE VALUE A COMPONENT
 * RECEIVES IS ITS EXPRESSION PLUS THE DEFINITION OF EVERY PAGE NAME THAT
 * EXPRESSION READS, transitively; anything short of that is a spelling check.
 *
 * WHAT COUNTS AS A DECLARATION: an import (the module a name comes from is what
 * it means), a `function` declaration with its whole body, and every
 * `const`/`let`/`var` declarator with its binder AND its initialiser — the
 * binder included, because `const { data: a }` and `const { total: a }` are two
 * different values wearing one name.
 *
 * SCOPE IS NOT RESOLVED AND THAT IS DELIBERATE — there is no parser here, so a
 * declaration anywhere in the file is a candidate for a name used anywhere else.
 * It is `readsIn`'s asymmetry one layer up: over-collecting can only add a
 * closure entry, and a name declared twice keeps BOTH texts (`texts` is a list)
 * so a change to either is visible and neither reads as literal.
 *
 * `literal` IS THE EXISTING CHOICE-VERSUS-COMPUTATION LINE, ONE INDIRECTION
 * OUT: a plain name bound once to a literal is a choice the receiving component
 * already distinguishes, exactly as an inline `columns={3}` is.
 */
export function localBindings(src) {
  const { specs, code, mask } = importSpecs(src);
  return bindingsIn(specs, code, mask);
}

function bindingsIn(specs, code, mask) {
  const out = new Map();
  const add = (name, at, to, literal) => {
    if (!IDENT.test(name)) return;
    const text = code.slice(at, to).trim();
    const e = out.get(name);
    if (!e) { out.set(name, { texts: [text], masks: [mask.slice(at, to).trim()], literal }); return; }
    if (e.texts.includes(text)) return;
    e.texts.push(text);
    e.masks.push(mask.slice(at, to).trim());
    e.literal = false;
  };

  for (const m of specs) {
    const names = bindingsOf(m.clause, m.kind);
    if (names === null) continue;
    for (const n of names) add(n, m.start, m.end + 1, false);
  }

  const fn = /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g;
  let f;
  while ((f = fn.exec(mask))) {
    const body = mask.indexOf("{", f.index + f[0].length);
    const end = body === -1 ? -1 : closeBrace(mask, body, mask.length);
    add(f[1], f.index, end === -1 ? mask.length : end + 1, false);
  }

  const dec = /\b(?:const|let|var)\s+/g;
  let d;
  while ((d = dec.exec(mask))) {
    let i = d.index + d[0].length;
    for (let n = 0; n < 16 && i < mask.length; n++) {
      const eq = depthStop(mask, i, mask.length, "=,;");
      const binder = mask.slice(i, eq);
      const end = mask[eq] === "=" ? depthStop(mask, eq + 1, mask.length, ",;") : eq;
      const init = mask[eq] === "=" ? mask.slice(eq + 1, end).trim() : "";
      const one = ONE_NAME.test(binder.trim());
      for (const name of patternNames(binder)) {
        add(name, i, end, one && LITERAL_VALUE.test(init));
      }
      if (mask[end] !== ",") break;
      i = end + 1;
    }
  }
  return out;
}

/**
 * WHAT ONE PROP VALUE REALLY DEPENDS ON — `{reads, fingerprint, allLiteral}`,
 * the page's own declarations its free names resolve to, TRANSITIVELY.
 *
 * A NAME THIS FILE DOES NOT DECLARE CONTRIBUTES NOTHING, and that is
 * cannot-tell making no claim rather than an answer: `Number`, a callback's own
 * parameter and a name from a module this reader could not read all land there.
 * THE COST IS STATED because it is real — a value whose meaning moves ONLY
 * through such a name moves invisibly to this check. What is closed is every
 * hop that is written down in the page itself, which is where the reproduced
 * defect lived and where a one-page writer is able to move something at all.
 *
 * THE FINGERPRINT IS SORTED BY NAME, never by the order the walk met them, or
 * moving a band down the page would re-order the closure of a prop nothing
 * touched — the same reason the comparison below is a multiset and not a list.
 *
 * THE CAP IS CANNOT-FINISH AND READS AS A COMPUTATION (`allLiteral: false`): a
 * dependency chain too tangled to walk to its end is not a choice the receiving
 * component already distinguishes.
 */
function closureOf(masked, binds) {
  const seen = new Map();
  const queue = [masked];
  let all = true;
  while (queue.length) {
    for (const name of readsIn(queue.shift())) {
      if (seen.has(name)) continue;
      const b = binds.get(name);
      if (!b) continue;
      if (seen.size >= MAX_CLOSURE) { all = false; queue.length = 0; break; }
      seen.set(name, b);
      if (!b.literal) all = false;
      for (const t of b.masks) queue.push(t);
    }
  }
  const reads = [...seen.keys()].sort().map((n) => ({
    name: n, text: seen.get(n).texts.join(" | "), literal: seen.get(n).literal,
  }));
  return {
    reads,
    fingerprint: reads.map((r) => r.name + "\u0001" + r.text).join("\u0002"),
    allLiteral: all,
  };
}

/**
 * THE OPENING TAGS OF `<Binding …>` IN THIS SOURCE — `[{from, to}]` spanning
 * each one's props, or `null` when a tag cannot be read to its end.
 *
 * `null` IS CANNOT-TELL AND EVERY CALLER TREATS IT AS MAKING NO CLAIM. An
 * unterminated tag means the props were never enumerated, which is a different
 * thing from a tag that has none.
 *
 * THE TERMINATOR IS A `>` AT DEPTH ZERO, and the depth count is what makes it
 * safe: `onPick={() => go()}` and `count={a > b}` both hold a `>` that is not
 * the end of a tag, and both sit inside braces. Read off the MASKED copy, so a
 * `>` inside a string cannot end a tag either.
 */
function openTags(mask, binding) {
  const out = [];
  const head = new RegExp("<\\s*" + esc(binding) + "(?![\\w$])", "g");
  let m;
  while ((m = head.exec(mask))) {
    const from = m.index + m[0].length;
    let depth = 0, end = -1, i = from;
    for (; i < mask.length; i++) {
      const c = mask[i];
      if (c === "{" || c === "(" || c === "[") depth++;
      else if (c === "}" || c === ")" || c === "]") depth--;
      else if (c === ">" && depth <= 0) { end = i; break; }
    }
    if (end === -1) return null;
    out.push({ from, to: mask[end - 1] === "/" ? end - 1 : end });
    head.lastIndex = end + 1;
  }
  return out;
}

/**
 * THE PROPS IN ONE OPENING TAG — `[{prop, value, literal}]`, or `null` when the
 * span holds a shape this cannot enumerate.
 *
 * TWO COPIES, ONE OFFSET, AND WHICH ONE ANSWERS WHAT IS THE WHOLE CARE HERE —
 * the asymmetry `partUses` above already records, for the same reason:
 *
 *   the BOUNDARIES come from the MASKED copy — a quote or a brace inside a
 *     string is not a boundary, and reading them off the plain source is how a
 *     prop value swallows the rest of the tag;
 *   the VALUE comes from the CODE copy — masked, `tone="light"` and
 *     `tone="dark"` are the same four blanks, so a comparison built on the
 *     masked text would call every literal swap identical and this whole check
 *     would go quiet on exactly the changes it is meant to wave through;
 *   whether the value is LITERAL is decided on the MASKED inner text, so a `+`
 *     or a `?` inside somebody's sentence cannot make a string read as a
 *     computation.
 */
function propsIn(code, mask, from, to) {
  const out = [];
  let i = from;
  while (i < to) {
    if (/\s/.test(mask[i])) { i++; continue; }
    // A SPREAD IS A PROP LIST THIS CANNOT ENUMERATE, so it is recorded as one
    // un-named, non-literal binding rather than skipped: `{...props}` really
    // can carry a computed value into the component, and dropping it would be
    // a silent hole in the one question this function exists to answer.
    if (mask[i] === "{") {
      const close = closeBrace(mask, i, to);
      if (close === -1) return null;
      out.push({ prop: "...", value: code.slice(i, close + 1), inner: mask.slice(i + 1, close), literal: false });
      i = close + 1;
      continue;
    }
    const nm = /^[A-Za-z_$][\w$:.-]*/.exec(mask.slice(i, to));
    if (!nm) return null;
    const prop = nm[0];
    let j = i + prop.length;
    while (j < to && /\s/.test(mask[j])) j++;
    // A BARE PROP IS `true` AND CARRIES NOTHING COMPUTED.
    if (mask[j] !== "=") { out.push({ prop, value: "", inner: "", literal: true }); i = j; continue; }
    j++;
    while (j < to && /\s/.test(mask[j])) j++;
    const q = mask[j];
    if (q === '"' || q === "'") {
      const close = mask.indexOf(q, j + 1);
      if (close === -1 || close >= to) return null;
      out.push({ prop, value: code.slice(j, close + 1), inner: "", literal: true });
      i = close + 1;
      continue;
    }
    if (q === "{") {
      const close = closeBrace(mask, j, to);
      if (close === -1) return null;
      out.push({
        prop,
        value: code.slice(j, close + 1),
        inner: mask.slice(j + 1, close),
        literal: LITERAL_VALUE.test(mask.slice(j + 1, close).trim()),
      });
      i = close + 1;
      continue;
    }
    return null;
  }
  return out;
}

/**
 * WHAT THIS SOURCE PASSES INTO EACH OF ITS OWN COMPONENTS — a Map of component
 * name → `{props, readable}`, where `props` is every prop on every element of
 * it and `readable` is false when nothing about its props was established.
 *
 * WHY THE PROPS AND NOT THE ELEMENTS: a value's MEANING is settled in the
 * component that receives it, and this is the only place a page's source states
 * which values those are. A caller comparing two versions of one page can then
 * ask whether an edit changed something whose interpretation lives in a file it
 * never opened — which no reading of the page alone can answer.
 *
 * `readable: false` IS CANNOT-TELL AND MAKES NO CLAIM EITHER WAY, which is the
 * standing rule for every reader in this module: a clause whose bindings cannot
 * be read (`* as N`, a re-export, a dynamic import), a tag that does not
 * terminate, or a prop shape this cannot enumerate all land there. A caller
 * must not read an unreadable component as one whose props did not move.
 *
 * ⚠ A PROP IS ITS EXPRESSION AND ITS CLOSURE, NEVER ITS TEXT (2026-09-22). Each
 * prop carries `closure` — a fingerprint of every page-local declaration the
 * value reads, transitively, from `closureOf` — and `literal` is now the
 * CHOICE-versus-COMPUTATION line asked of that whole dependency rather than of
 * the spelling at the call site. The two together are what a comparison needs:
 * an edit that moves arithmetic one line up the page leaves the call site
 * byte-identical and changes what the component receives, and a reader that
 * compares only the text calls that unchanged. `reads` is the same closure in
 * full, so a refusal can NAME the declaration that moved instead of pointing at
 * a prop whose text is the same on both sides.
 */
export function partProps(src, inPart) {
  const out = new Map();
  const mine = localParts(src, inPart);
  if (!mine.length) return out;
  const { specs, code, mask } = importSpecs(src);
  const binds = bindingsIn(specs, code, mask);
  for (const { name, clause, kind } of mine) {
    const prev = out.get(name);
    if (prev && !prev.readable) continue;
    const bound = bindingsOf(clause, kind);
    if (bound === null || !bound.length) { out.set(name, { props: [], readable: false }); continue; }
    const props = prev ? prev.props.slice() : [];
    let ok = true;
    for (const b of bound) {
      const tags = openTags(mask, b);
      if (tags === null) { ok = false; break; }
      for (const t of tags) {
        const got = propsIn(code, mask, t.from, t.to);
        if (got === null) { ok = false; break; }
        for (const p of got) {
          const cl = closureOf(p.inner, binds);
          props.push({
            prop: p.prop,
            value: p.value,
            closure: cl.fingerprint,
            reads: cl.reads,
            // A NAME STANDING ALONE MEANS WHAT ITS DECLARATION MEANS, so a prop
            // bound once to a literal through one name is the same CHOICE an
            // inline literal is — `columns={cols}` over `const cols = 3` is
            // `columns={3}` one indirection out, and the fingerprint carries
            // the 3, so changing it to a 4 is still seen. Anything with an
            // operator in it is a computation whatever its parts are.
            literal: p.literal || (ONE_NAME.test(p.inner.trim()) && cl.reads.length > 0 && cl.allLiteral),
          });
        }
        if (!ok) break;
      }
      if (!ok) break;
    }
    out.set(name, ok ? { props, readable: true } : { props: [], readable: false });
  }
  return out;
}

/**
 * The pages and the parts as ONE list of `{path, source}`.
 *
 * PAGES FIRST, PARTS AFTER, and the order is load-bearing for the text lane:
 * `textItems` walks this list and stops one past `MAX_TEXT_ITEMS`, so a site
 * big enough to hit the cap shows the page's own words before its components'.
 * Reversed, a long component could push every page string past the cap and send
 * an ordinary site to the expensive lane.
 *
 * A part with no usable name is DROPPED rather than given a made-up path — it
 * could not be written back under a name we invented, and a file that cannot
 * round-trip must never enter a list whose whole contract is that it does.
 */
export function editableFiles(pages, parts) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (p && typeof p.path === "string" && typeof p.source === "string") out.push({ path: p.path, source: p.source });
  }
  for (const p of Array.isArray(parts) ? parts : []) {
    if (!p || typeof p.source !== "string") continue;
    const path = partPath(p.name);
    if (path) out.push({ path, source: p.source });
  }
  return out;
}

/**
 * The one list, back into the two stores it came from.
 *
 * THE NAME COMES BACK OFF THE PATH, never carried alongside it. A second field
 * riding the entry would be a copy of the same fact, and the rungs in between
 * rebuild these objects freely (`applyEdits` maps to `{path, source}` twice) —
 * so anything but the path would not survive the trip that this function's
 * whole job is to complete.
 */
export function splitEditable(files) {
  const pages = [];
  const parts = [];
  for (const f of Array.isArray(files) ? files : []) {
    if (!f || typeof f.path !== "string" || typeof f.source !== "string") continue;
    const name = partNameOf(f.path);
    if (name) parts.push({ name, source: f.source });
    else pages.push({ path: f.path, source: f.source });
  }
  return { pages, parts };
}
