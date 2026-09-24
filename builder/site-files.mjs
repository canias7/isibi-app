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

/**
 * THE LOCAL NAMES THIS SOURCE BINDS ONE OF THE SITE'S OWN COMPONENTS UNDER —
 * `[]` when it does not import that component, `null` when an import of it
 * binds through a clause `bindingsOf` cannot read (a namespace, a side effect,
 * a dynamic import). `bindingsOf`'s three answers, over every import of that
 * one component.
 *
 * IT EXISTS FOR THE PAGE PRESERVATION CHECK (2026-09-24), which asks something
 * `partUses` cannot: once a rewrite has taken the IMPORT LINE out as well, does
 * the page still draw the tag the import used to bind? `partUses` answers
 * nothing about a component a source no longer imports — correctly, it asks
 * about the source it is given — so the names have to come from the BEFORE and
 * the placement test runs over the AFTER. Exported rather than re-derived: a
 * second reader of an import clause is this module's own recorded drift.
 */
export function partBindings(src, name, inPart) {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) return [];
  const out = [];
  for (const m of importSpecs(src).specs) {
    if (!specNames(m.spec, n, inPart)) continue;
    const b = bindingsOf(m.clause, m.kind);
    if (b === null) return null;
    out.push(...b);
  }
  return [...new Set(out)];
}

/**
 * WHERE THIS SOURCE FIRST DRAWS `<Name` FOR ANY OF THESE NAMES, or -1 —
 * `partUses`' own placement test, over the same masked copy, so a `<Name`
 * inside a string is text a visitor reads and never a component on the page.
 * The offset is valid against the REAL source (the mask is length-preserving),
 * which is what lets a caller ask which heading the component sat under. A name
 * that is not an identifier answers nothing rather than being built into a
 * pattern.
 */
export function tagAt(src, names) {
  const list = (Array.isArray(names) ? names : []).filter((x) => typeof x === "string" && IDENT.test(x));
  if (!list.length) return -1;
  const { mask } = importSpecs(src);
  let best = -1;
  for (const b of list) {
    const m = new RegExp("<\\s*" + esc(b) + "(?![\\w$])").exec(mask);
    if (m && (best < 0 || m.index < best)) best = m.index;
  }
  return best;
}

/** Does this source draw `<Name` for any of these names — `tagAt` as a yes or no. */
export function drawsTag(src, names) {
  return tagAt(src, names) >= 0;
}

/** `specNames` RUN BACKWARDS: the two spellings it admits, as capture groups. */
const PART_SPEC = new RegExp("(?:^|/)" + esc(PART_DIR) + "([^/]+)$");
const SIBLING_SPEC = /^\.\/([^/]+)$/;

/**
 * EVERY COMPONENT OF THIS SITE'S OWN THAT THIS SOURCE IMPORTS — `[{name,
 * clause, kind, spec}]`, read off the SPECIFIER rather than off a stored list.
 *
 * `spec` IS THE SPECIFIER EXACTLY AS WRITTEN, extension and all, because it is
 * a JOIN KEY. `partEligible` has to learn which JSX tag names one of these
 * components, and the binding is in the import clause — which a real parser
 * already reads. Carrying the raw string lets that join be an equality against
 * the parser's own `moduleSpecifier`, instead of a SECOND reader of the
 * `-parts/` convention sitting beside the two regexes below. `name` is still
 * the extension-stripped answer every existing caller reads.
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
    out.push({ name, clause: m.clause, kind: m.kind, spec: m.spec });
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
