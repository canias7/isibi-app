// The `picture` layer: change a photograph on a page that already exists.
//
// WHY IT IS NEEDED. Photographs are bought at BUILD time from `@@IMG:…@@`
// tokens, and after that nothing could touch them. `budgetFor` buys none on a
// revise (a revise re-derives the same budget and the model writes fresh
// descriptions, so nothing matches what was bought last time — ~94 credits of
// new pictures for ones the owner already had), and no lane could swap one
// either. So "use a photo of MY shop instead of that one" had no path at all,
// and neither did filling a slot the build left empty.
//
// EVERY SLOT ON EVERY SITE IS EMPTY TODAY, which is what makes this the useful
// half rather than a refinement: the fal balance has never been funded, so no
// photograph has ever been generated and every `SafeImage` on every published
// site is drawing its placeholder. The owner's OWN photographs — a real shop
// photographed on a real phone — need no image model at all, and are better
// than a generated one for a business that has them.
//
// THE ALT TEXT IS THE HANDLE. A generated page writes
// `<SafeImage src="…" alt="The row of chairs, Saturday morning" ratio="4/3" />`,
// so every slot already carries a sentence describing the picture, written for a
// screen reader and perfectly suited to being matched against "the one of the
// chairs". Nothing new has to be stored to address them.
//
// NO PAGE MODEL CALL. The swap is a string replacement at a known offset, the
// way `site-text.mjs` edits words — so this costs one cheap classification and
// the picture itself, never the ~5 credits of regenerating a page.
//
// Plain module with its side effects injected, like `site-apply.mjs` beside it.

// ONE READING OF THE FILE-TO-ROUTE MAPPING, shared with the addon and page
// lanes. `readNeedsPlace` compares a route the model named against the pages
// this site has, and those arrive as file paths.
import { routeOf } from "./site-addon.mjs";
// THE LEXER IS `site-files.mjs`' AND IS RE-EXPORTED BELOW — see `codeOnly`.
import { codeOnly } from "./site-files.mjs";
import { modelsFor } from "./build-models.mjs";
// THE QUESTION BACK (2026-10-02), shared with every step (`builder/clarify.mjs`).
import { QUESTION_FIELD, askOf } from "./clarify.mjs";

/** A small call: matching a sentence to a list of sentences is not a design task. */
/**
 * THE PICKED MODEL, NOT A HARDCODED ONE (owner, 2026-08-31).
 *
 * Every small call on this platform was pinned to `claude-haiku-4-5`, so a
 * customer who had picked Grok still had Anthropic in their path — and when
 * Anthropic refused on billing, the whole cheap ladder went down with it while
 * builds carried on fine. Run 93 measured that: a `css` edit answered 503 in
 * 5.3s having spent nothing, and the lane it was testing never ran.
 *
 * DERIVED FROM THE TABLE rather than restated, so it cannot drift from the
 * picker, and it resolves to DEFAULT_PICKER — which is what a caller that
 * forgets to thread the picker gets. That is deliberately the platform default
 * and never Haiku: a forgotten hop should land on the model everything else
 * uses, not quietly back on the provider this change exists to leave.
 */
export const PICTURE_MODEL = modelsFor().quick;
export const PICTURE_MAX_TOKENS = 1200;

/** How many slots the model is shown. A page with more than this is a contact sheet. */
export const MAX_SLOTS = 60;

/** How many pictures one instruction may change. "Replace all the shop photos" is real. */
export const MAX_PICTURE_OPS = 8;

/**
 * WHICH PART OF A PICTURE SURVIVES THE CROP — the five `SafeImage` accepts.
 *
 * `centre` is in the list because putting a picture back is a real instruction,
 * and it is written by REMOVING the attribute rather than writing the word: a
 * centred picture and one that never had a focus are the same picture, so a site
 * put back is byte-identical to one that was never touched.
 */
export const FOCUS_VALUES = ["centre", "top", "bottom", "left", "right"];

/**
 * Every picture on the page, with the exact span of its `src` value.
 *
 * ONLY A LITERAL `alt` IS ADDRESSABLE, and that is a real limit rather than an
 * oversight. `{SPREADS.map((s) => <SafeImage alt={s.alt} …/>)}` is ONE element
 * rendering many pictures, so there is no single span to replace and no sentence
 * to match against — changing it means changing the data it maps over, which is
 * a page edit. Skipping it is what stops this layer half-doing that.
 *
 * The span is the VALUE, quotes excluded, so a replacement never has to guess
 * how the attribute was written. `src={null}` and `src={photo}` are recorded
 * with `expr: true` — the first is a slot a page can legitimately have and the
 * second is bound to something, so only the first is offered.
 */
export function imageSlots(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    const src = p.source;
    // `<SafeImage` and `<img` — the two things that draw a photograph. Every
    // other kit component that carries one draws it THROUGH SafeImage, but from
    // a prop rather than an attribute, so it is not addressable here.
    const re = /<(SafeImage|img)\b/g;
    let m;
    while ((m = re.exec(src))) {
      const open = m.index;
      // The element ends at the first `>` that is not inside a string or a
      // braced expression. A naive indexOf(">") stops inside `alt="a > b"`.
      const end = elementEnd(src, open);
      if (end < 0) continue;
      const el = src.slice(open, end);
      const alt = literalAttr(el, "alt");
      if (!alt) continue;
      const s = attrSpan(el, "src");
      if (!s) continue;
      // WHICH PART OF THE PICTURE SURVIVES THE CROP. Recorded alongside the
      // src because both are edits to ONE element and have to be written in one
      // back-to-front pass — applied separately, the first write moves the
      // second's offsets into the middle of an attribute.
      //
      // `focusInsertAt` is just past the tag name, which is a position that
      // exists on every element whether or not it has the attribute yet, and
      // needs no guess about where the other attributes end.
      const f = attrSpan(el, "focus");
      out.push({
        page: p.path, tag: m[1], alt,
        focus: f && !f.expr ? el.slice(f.from, f.to).trim() : "",
        // An EXPRESSION is not our slot — `focus={row.crop}` is a value the
        // site's own data decides, and overwriting it drops the binding. The
        // skip-rather-than-guess rule every other scanner here lives under.
        focusAt: f && !f.expr ? open + f.from : null,
        focusTo: f && !f.expr ? open + f.to : null,
        focusBound: !!(f && f.expr),
        focusInsertAt: open + m[0].length,
        // THE EXPRESSION'S TEXT IS KEPT, not flattened to null. Recorded as null
        // for every expression slot, `isEmptySlot` could not tell `src={null}`
        // — a slot waiting to be filled — from `src={row.photo}`, which is a
        // picture the site's own data decides. Both read as empty, so the model
        // would be offered a bound picture as a free slot and would overwrite
        // the binding with one photograph for every row.
        value: el.slice(s.from, s.to),
        expr: s.expr,
        at: open + s.from, to: open + s.to, quoted: !s.expr,
        // THE ELEMENT ITSELF: where its `<` is and where its opening tag ends.
        // A removal is found in the page's syntax tree BY THIS OFFSET, so the
        // photograph taken off is exactly the one this slot was read from —
        // never "the one with that description", which two pictures can share.
        from: open, end,
      });
      if (out.length >= MAX_SLOTS) return out;
    }
    // ── A KIT COMPONENT CARRYING ITS PICTURE AS PROPS ──────────────────────
    //
    // `<HeroSplit image={null} imageAlt="An acoustic guitar…" />` draws its
    // photograph THROUGH SafeImage, from props — which is what the note above
    // says is not addressable, and it is how every hero on the platform is
    // written. So the picture lane answered `no-slots` for "change the main
    // photo" on a site whose main photo is exactly that (lane sweep,
    // 2026-09-01, twice). The pair is addressable on the same terms as an
    // element: a LITERAL alt to match the sentence against, and one attribute
    // whose value is the picture. `image`/`imageAlt` is the kit's own naming
    // for a component that has one picture, and `src`/`alt` the other shape it
    // uses (`Figure`); anything else stays out, because a guess here writes a
    // URL into a prop that is not a picture.
    //
    // NO FOCUS on these. `focus` is SafeImage's own prop and a component may
    // not forward it, so a slot here is `focusBound` — the same word the bound
    // SafeImage uses — and `runPictureEdit` refuses a reframe on it as
    // "cannot", which is the honest answer.
    const comp = /<([A-Z][A-Za-z0-9]*)\b/g;
    let c;
    while ((c = comp.exec(src))) {
      if (c[1] === "SafeImage") continue;
      const open = c.index;
      const end = elementEnd(src, open);
      if (end < 0) continue;
      const el = src.slice(open, end);
      const pair = [["image", "imageAlt"], ["src", "alt"]].find(([pic, alt]) => literalAttr(el, alt) && attrSpan(el, pic));
      if (!pair) continue;
      const alt = literalAttr(el, pair[1]);
      const s = attrSpan(el, pair[0]);
      out.push({
        page: p.path, tag: c[1], alt,
        focus: "", focusAt: null, focusTo: null, focusBound: true, focusInsertAt: null,
        value: el.slice(s.from, s.to),
        expr: s.expr,
        at: open + s.from, to: open + s.to, quoted: !s.expr,
        from: open, end,
      });
      if (out.length >= MAX_SLOTS) return out;
    }
  }
  return out;
}

/** The index just past the element's opening tag. */
function elementEnd(src, from) {
  let depth = 0, quote = "";
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth = Math.max(0, depth - 1); continue; }
    if (c === ">" && !depth) return i + 1;
  }
  return -1;
}

/** A string-literal attribute's value, or "" for anything computed. */
function literalAttr(el, name) {
  const m = new RegExp("\\b" + name + '\\s*=\\s*"([^"]*)"').exec(el);
  return m ? m[1].trim() : "";
}

/**
 * Where an attribute's VALUE sits inside the element.
 *
 * `expr` covers `src={null}` and `src={photo}` alike; the caller separates them,
 * because a null is an empty slot to fill and a binding is a picture some other
 * value decides.
 */
function attrSpan(el, name) {
  const q = new RegExp("\\b" + name + '\\s*=\\s*"').exec(el);
  if (q) {
    const from = q.index + q[0].length;
    const to = el.indexOf('"', from);
    return to < 0 ? null : { from, to, expr: false };
  }
  const b = new RegExp("\\b" + name + "\\s*=\\s*\\{").exec(el);
  if (!b) return null;
  const from = b.index + b[0].length;
  let depth = 1;
  for (let i = from; i < el.length; i++) {
    if (el[i] === "{") depth++;
    else if (el[i] === "}" && !--depth) return { from, to: i, expr: true };
  }
  return null;
}

/** A slot with nothing in it — what every picture on every site is today. */
export function isEmptySlot(slot) {
  if (!slot) return false;
  if (slot.expr) return String(slot.value ?? "").trim() === "" || /^null$/.test(String(slot.value ?? "").trim());
  return String(slot.value || "").trim() === "";
}

/**
 * HOW MANY EMPTY PICTURE FRAMES THIS CHANGE ADDED (2026-09-17).
 *
 * `countImageSlots` answers this for a BUILD, and its own comment says exactly
 * why it exists: *"a NEW page that wants one publishes with a placeholder and,
 * until this, said nothing about it. The customer is left looking at an empty
 * frame with no way to know it is theirs to fill."* It counts `@@IMG:` TOKENS —
 * and the addon's directive forbids tokens, so on that path it is always 0 and
 * the customer's sentence (`photoNote`) never fires. The defect that reader was
 * written to close, reaching every path but the one that adds pages.
 *
 * PER PAGE, AND ONLY THE INCREASE. An addon that edits the home page to add a
 * link must not report the home page's EXISTING empty frames as new spaces —
 * that is a true count of the wrong thing, which reads to a customer as "your
 * change made these". A page the change did not touch contributes nothing
 * because it is identical on both sides; a page it created has no before.
 *
 * NEGATIVE NEVER SUBTRACTS. A change that FILLS a frame leaves fewer empty
 * than it found, and letting that offset another page's new one would report a
 * net of zero over a page that really does have an empty frame on it.
 */
export function newEmptySlots(before, after) {
  return grew(before, after, (pages) => imageSlots(pages).filter(isEmptySlot));
}

/**
 * THE PER-PAGE INCREASE, SHARED BY BOTH COUNTERS.
 *
 * One machine, two readers: the rules above — per page, only the increase,
 * negative never subtracting — are the same argument whichever kind of picture
 * frame is being counted, and writing them twice is how the two come to
 * disagree about a page the change did not touch.
 */
function grew(before, after, read) {
  let n = 0;
  for (const g of grewBy(before, after, read).values()) n += g;
  return n;
}

/** The same increase, per page — what `grew` sums, and what a floor flag asks. */
function grewBy(before, after, read) {
  const by = (pages) => {
    const m = new Map();
    for (const f of read(pages)) m.set(f.page, (m.get(f.page) || 0) + 1);
    return m;
  };
  const was = by(before), now = by(after);
  const gain = new Map();
  for (const [page, count] of now) {
    const g = Math.max(0, count - (was.get(page) || 0));
    if (g) gain.set(page, g);
  }
  return gain;
}

/** How many list frames one reader will report. A page past this is a contact sheet. */
export const MAX_LIST_FRAMES = 200;

/**
 * ── A PICTURE A PAGE DRAWS FROM A LIST IN ITS OWN SOURCE (2026-09-19) ───────
 *
 * Owner, after run 51: *"Fix the mismatch between the gallery's seven empty
 * frames and the reply's 'one photo space.'"*
 *
 * The published `/gallery` renders **seven** empty picture frames and the
 * customer was told about **one**. Read out of the live bundle, the page is:
 *
 *     <SafeImage src="" alt="Harbour Loaf interior in warm morning light…" />
 *     <Gallery items={[{alt:"A crusty country loaf…", caption:"Country loaf"},
 *                      …five more…]} />
 *
 * `imageSlots` sees the first and is RIGHT not to see the other six: its
 * contract is a `src` SPAN it can replace and a LITERAL `alt` to match a
 * sentence against, which is what makes it the picture rung's addressability
 * reader. An item in a data array has neither, so widening it would offer the
 * rung slots it cannot edit — the note at the head of that function says so and
 * that limit stays.
 *
 * **BUT THE CUSTOMER'S SENTENCE IS ABOUT WHAT THEY SEE, NOT ABOUT WHAT THIS
 * LAYER CAN EDIT**, and those are two questions. This is the second one.
 *
 * ── THE SCALE, MEASURED OVER THE 100-SITE CORPUS ────────────────────────────
 *
 * **320 of these frames, in 60 of 324 page files, and EVERY ONE IS EMPTY** —
 * 254 carrying `src: null` explicitly and 66 with no picture key at all; zero
 * carry a url and zero carry a token. Counted by THIS function over the
 * corpus, not by a script beside it: a first measurement using a hand-written
 * scan answered 321/61, because it accepted a TEMPLATE-literal `alt` — a data
 * row whose count no reader of the source can know. The product refusing it is
 * the right answer and the ad-hoc number was the wrong instrument. So run 51's six are not a curiosity: this
 * is the ordinary shape of every gallery the platform has ever generated, and
 * not one of those frames has ever been counted by anything.
 *
 * ── THE RULE IS `alt`, AND IT IS THE KIT'S OWN ─────────────────────────────
 *
 * `Gallery` and `MediaGrid` both declare `items: { src?: string | null; alt?:
 * string; caption?: string | null }[]` — the SAME `src`/`alt` pair
 * `imageSlots`' component branch already calls "the kit's own naming for a
 * component that has one picture", here as object keys rather than attributes.
 * So this knows nothing about which components exist: an object literal
 * carrying a literal `alt` is a picture entry, because `alt` describes a
 * picture and nothing else in JSX, and it is EMPTY when no picture value sits
 * beside it.
 *
 * NESTED OBJECTS ARE SKIPPED, not descended into. A picture entry is flat by
 * construction, and an object holding another object is a data row of some
 * other kind whose inner entries are examined on their own account anyway.
 *
 * THE SCAN STARTS FROM A KEY, WHICH IS WHAT KEEPS IT CHEAP. A `.tsx` page is
 * mostly braces — every JSX expression opens one — so walking from each of them
 * is quadratic on a 48,000-character page. `OBJ_START` finds the `{` that
 * begins an object literal (a `{`, an identifier, a colon), which a JSX
 * expression brace is not.
 */
export function listFrames(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    const src = p.source;
    // ⚠ THE SCAN RUNS ON THE CODE, NOT ON THE FILE (2026-09-19). Owner: *"Don't
    // report arbitrary source objects as visible picture spaces. Comments
    // currently count."* REPRODUCED in all three shapes a page really carries —
    // `// { alt: "a stray note", src: null }`, a block comment holding an old
    // `items={[…]}`, and a jsdoc example — each counted as a picture space a
    // visitor can see, on a page that draws nothing of the kind. A comment is
    // the one part of a file guaranteed not to render.
    // ⚠ …AND A STRING IS NOT CODE EITHER (2026-09-19, the second correction).
    // Owner: *"A quoted example containing an object also counts as a picture.
    // Exclude strings and unused examples."* REPRODUCED in all three quoting
    // shapes — `"write { alt: 'A loaf', src: null }"`, its single-quoted mirror
    // and a template literal — each counted as a picture space on a page that
    // draws nothing of the kind.
    //
    // TWO VIEWS OF ONE FILE, AND THE SPLIT IS WHAT MAKES THAT POSSIBLE. A frame
    // is FOUND by its braces and READ by its values, and the values are strings
    // — so one copy cannot serve both: blanking string contents loses every
    // `alt` and keeping them lets a quoted example in. `mask` has comments and
    // string CONTENTS blanked and is what the braces are matched against;
    // `view` has only comments blanked and is what the body is read from. Both
    // are length-preserving, so one offset means the same thing in each.
    const view = codeOnly(src);
    const mask = codeOnly(src, true);
    const re = new RegExp(OBJ_START.source, "g");
    let m;
    while ((m = re.exec(mask))) {
      const close = objectEnd(mask, m.index);
      if (close < 0) continue;
      const body = view.slice(m.index + 1, close);
      const alt = literalKey(body, "alt");
      if (!alt) continue;
      // THE PICTURE'S OWN VALUE, or "" for a key that is not there. Both read
      // as empty and they are the same fact about the page — a frame with
      // nothing in it — which is why `isEmptySlot`'s `null` case and a missing
      // key are not separated here the way an attribute's are.
      const v = keyValue(body, "src");
      // AND WHETHER ITS NUMBER CAN BE ESTABLISHED AT ALL. A literal object is
      // not proof that it renders: only an array written where it renders puts
      // a number on the page. The walk runs on `mask` so a bracket inside a
      // string cannot be read as one.
      out.push({ page: p.path, alt, value: v, empty: !v || v === "null", counted: writtenWhereItRenders(mask, m.index) });
      if (out.length >= MAX_LIST_FRAMES) return out;
    }
  }
  return out;
}

/** The `{` of an object literal: a brace, a key, a colon. A JSX brace is not one. */
const OBJ_START = /\{\s*(?:[A-Za-z_$][\w$]*|"[^"]*"|'[^']*')\s*:/;

/**
 * The source with every comment blanked, LENGTH-PRESERVING (2026-09-19).
 *
 * ⚠ ONE PASS FOR STRINGS AND COMMENTS TOGETHER, and that is not tidiness — it
 * is the only order that is correct in both directions. This repository's own
 * recorded trap is a `/*` inside a LINE comment opening a block that runs
 * thousands of characters; its mirror is a `//` inside a STRING — every
 * `href="https://…"` on every page — which a comment-first pass would read as
 * the start of a comment and blank the rest of the line with it. Tracking both
 * states in one walk makes each immune to the other.
 *
 * LENGTH-PRESERVING, SO AN OFFSET MEANS THE SAME THING IN BOTH — and since
 * 2026-09-19 that is load-bearing rather than tidy: `listFrames` matches braces
 * against the `maskStrings` copy and reads the body out of the plain one, at
 * the SAME offsets. A scan that blanked by deleting would hand back positions
 * into a string nobody else holds.
 *
 * `maskStrings` BLANKS WHAT IS INSIDE THE QUOTES AND KEEPS THE QUOTES, so a
 * quoted example (`"write { alt: 'A loaf', src: null }"`) has no braces left to
 * match while a quoted KEY (`{"src": …}`) still reads as one — the empty pair
 * `""` is what `OBJ_START` needs and all it needs. A TEMPLATE is blanked with
 * the rest, including anything inside `${…}`: the existing rule already refuses
 * an entry whose `alt` is a template, so a picture entry cannot live there, and
 * blanking it is consistent rather than a new judgement.
 *
 * NO REGEX-LITERAL STATE, and this is the one thing it does not model: a `/…/`
 * holding a quote could open a string here. Measured over the whole 100-site
 * corpus — every generated page there is — this changes NO page's reading, and
 * the direction of the risk is a MISSED frame rather than an invented one,
 * which is the safe side for a number offered to a customer.
 */
// THE BODY MOVED TO `site-files.mjs` ON 2026-09-20 AND IS RE-EXPORTED HERE,
// so every caller and every guard keeps the name it has always imported.
//
// WHY IT MOVED RATHER THAN FORKED: it gained a second caller — the import
// reader that decides whether a page really imports a component, which has to
// tell a commented-out import from a live one — and what it knows is a source
// file's LEXICAL structure, which is that module's subject and not this one's.
// A second copy is how a frame counter and an import reader come to disagree
// about what a comment is; the guard asserts the two names are one function.
//
// THE DOC COMMENT ABOVE IS THE CONTRACT AND STAYS HERE, because the rules it
// records — one pass for strings and comments together, length-preserving, the
// masked copy keeping its quotes, no regex-literal state — are what
// `listFrames` below rests on and where a reader of this file will look.
export { codeOnly };

/**
 * How far back a frame looks for the prop it is written into.
 *
 * MEASURED over the 100-site corpus: the furthest a counted entry sits from its
 * own `items={` is **815 characters** (`game-studio/press.tsx`, the last of a
 * long literal list). 600 would have lost 7 of the 297; 1000 finds all of them
 * and so does everything above it. 2000 is that measurement with real margin,
 * and a bound reached is UNCERTAINTY rather than a wrong number, so erring
 * large costs a backward walk and nothing else.
 */
const MAX_PROP_LOOKBACK = 2000;

/**
 * Is this entry's array written where it renders? (2026-09-19)
 *
 * ⚠ THIS REPLACES A DENY-LIST OF RUNTIME METHODS, and the replacement is the
 * owner's instruction and the measurement together. Owner: *"An unused image
 * array and an array filtered to zero still report visible picture spaces. A
 * literal object is not proof that it renders. Narrow numeric reporting to
 * cases where the count can actually be established; use uncertainty otherwise.
 * Don't keep adding individual runtime-method exceptions."*
 *
 * REPRODUCED, both of them, before anything was touched — a `const SHOTS = [{…},
 * {…}]` nothing on the page references, and `<Gallery items={SHOTS.filter((s) =>
 * s.featured)} />`, each reporting **an exact 2** where a visitor sees zero.
 *
 * THE OLD RULE LOOKED BACKWARD FOR `.map` / `.flatMap` / `Array.from` within 600
 * characters, and its structural failure is measurable: a generated page writes
 * its array as a module-scope `const` at the top and maps it in the JSX two
 * hundred lines below, so the call is nowhere near the object. **Over the whole
 * corpus that deny-list caught ZERO of the 23 runtime-decided frames** — three
 * `.map`s and a `.filter`, every one of them real. A list of methods can only
 * ever be extended; this asks the positive question instead, and answers all 23
 * without naming a single method.
 *
 * THE ONE SHAPE WHERE THE NUMBER IS ESTABLISHED is a literal array written
 * directly as a JSX attribute's value — `<Gallery items={[{…}, {…}]} />` — the
 * one place where what is written is what the browser draws. Anything else
 * (a named const, a spread, a call, a filter, a map, a ternary) is a value that
 * reaches the prop by some route this cannot see, and the honest answer is that
 * the count cannot be established. **MEASURED over the corpus: 297 of the 320
 * frames are in that shape, run 51's six included, and the 23 that are not are
 * exactly the runtime-decided ones.** So the narrowing costs no real page its
 * number and fixes every case the owner reported.
 *
 * THE WALK GOES OUTWARD THROUGH UNCLOSED BRACKETS, and the balance is what makes
 * it sound: a bracket pair that closed before this object is balanced away on
 * the way out, so the first `[` reached unclosed really is this entry's array
 * and the `{` outside it really is what that array sits in.
 *
 * ⚠ AND THE ARRAY MUST BE THE PROP'S WHOLE VALUE, WHICH THREE PROBED SHAPES
 * BOUGHT. A first cut asked only what the entry sits INSIDE, and measured
 * against real JSX that is not the same question:
 *
 *   ✗ `items={on ? A : [{…}]}`      the other branch may win — counted anyway
 *   ✗ `items={[...A, {…}]}`         the spread's elements are unseen
 *   ✗ `n={[{…}].length}`            a number, not a list of pictures
 *
 * Each sits inside a prop's expression container and none of them establishes
 * how many frames the page draws. So the container must hold the array and
 * NOTHING ELSE — whitespace-only on both sides, which is one statement of
 * "written where it renders" rather than three refusals — and the array's own
 * body must carry no `...`, because a spread's elements come from somewhere
 * this cannot see. A spread's literal entries really are on the page, so they
 * could have been a floor; they go to `more` instead, because the customer's
 * uncertain sentence is exactly right for a list whose length is data's to
 * decide and a floor invites them to count.
 *
 * A BOUND REACHED, OR ANY OTHER SHAPE, IS UNCERTAINTY — never a number. That is
 * the fail-closed direction here: a wrong `more` costs a vaguer sentence, and a
 * wrong `n` is the defect being fixed.
 */
function writtenWhereItRenders(src, at) {
  const seq = [];
  let depth = 0;
  const floor = Math.max(0, at - MAX_PROP_LOOKBACK);
  for (let i = at - 1; i >= floor; i--) {
    const c = src[i];
    if (c === ")" || c === "]" || c === "}") { depth++; continue; }
    if (c === "(" || c === "[" || c === "{") {
      if (depth) { depth--; continue; }
      seq.push(i);
      if (seq.length === 2) break;
    }
  }
  if (seq.length < 2) return false;
  const [open, hold] = seq;
  if (src[open] !== "[" || src[hold] !== "{") return false;
  // `attr={[` — the `=` immediately before the expression container, and an
  // attribute NAME immediately before that. Without the name test a bare `={`
  // could be an arrow body or a comparison; without the `=` the `{` is any JSX
  // expression at all, which is every list a page maps over.
  const eq = backFrom(src, hold);
  if (src[eq] !== "=") return false;
  // ⚠ THE NAME TEST IS ABSORBED BY THE `=` TEST, MEASURED AND DECLARED. Over 20
  // constructed shapes and the whole 100-site corpus, cutting this line changes
  // NO answer — every `= {` a real file writes has an attribute name in front
  // of it, and the shapes that reach a `{` some other way (`{...{…}}`, a
  // destructuring default, a comparison) are refused by the `=` above. It stays
  // because the PAIR is what a reader needs — a JSX prop is `name={value}`, and
  // half of that stated alone invites the other half to be dropped as noise —
  // and the sweep mutates the two together, because a sweep cannot say this and
  // the next session deletes what nothing appears to need.
  if (!/[A-Za-z0-9_$]/.test(src[backFrom(src, eq)] || "")) return false;
  // THE ARRAY OPENS THE EXPRESSION…
  if (backFrom(src, open) !== hold) return false;
  // …AND CLOSES IT, so nothing else is in there with it.
  const shut = arrayEnd(src, open);
  if (shut < 0 || backFrom(src, forward(src, shut)) !== shut || src[forward(src, shut)] !== "}") return false;
  // AND NO ELEMENT COMES FROM OUT OF SIGHT. Asked of the masked copy, so `...`
  // inside a caption is a caption.
  return !src.slice(open, shut).includes("...");
}

/** The index of the last non-space character before `i`, or -1. */
function backFrom(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  return j;
}

/** The index of the first non-space character after `i`, or the length. */
function forward(src, i) {
  let j = i + 1;
  while (j < src.length && /\s/.test(src[j])) j++;
  return j;
}

/**
 * The `]` matching the `[` at `from`, or -1 past the bound or unterminated.
 *
 * Every bracket kind is counted, because a `]` inside a nested object or call is
 * balanced by its own opener; a `]` inside a string is not, which is why this
 * reads the masked copy like everything else here. The forward bound is the
 * backward one: an array longer than that gives up, and giving up is
 * uncertainty, which is the same answer its own last entry would have reached
 * walking backward.
 *
 * ⚠ THE `-1` IS ABSORBED, MEASURED AND DECLARED — AND IT IS A BELT BEHIND A
 * BELT. Answering `end` instead changes NO answer over 20 constructed shapes
 * and the whole corpus, and neither does cutting the caller's own `shut < 0`,
 * and neither does cutting BOTH: what really refuses is the caller's last test,
 * that the character after the `]` is the expression's `}`, and at a bound, a
 * file end or index 0 it is never `}`. So the pair is not a pair — it is three
 * deep with only the outermost observable, and that outermost one is what the
 * sweep mutates. The two inner ones stay because this function's contract is
 * *"the matching `]`, or nothing"*, and a reader that answers an offset it did
 * not find is the trap this repository keeps recording.
 */
function arrayEnd(src, from) {
  let depth = 0;
  const end = Math.min(src.length, from + MAX_PROP_LOOKBACK);
  for (let i = from; i < end; i++) {
    const c = src[i];
    if (c === "[" || c === "{" || c === "(") { depth++; continue; }
    if (c === "]" || c === "}" || c === ")") { depth--; if (!depth) return c === "]" ? i : -1; }
  }
  return -1;
}

/** How far a shallow object literal may run before this stops believing it is one. */
const MAX_OBJ_CHARS = 4000;

/**
 * The body of the shallow object literal starting at `from`, or null.
 *
 * `null` for a nested object, an unterminated one, or one past the bound — each
 * of which is "not a picture entry", and answering null rather than guessing is
 * what keeps a data row of some other shape out of the count.
 */
function objectEnd(src, from) {
  let depth = 0, quote = "";
  const end = Math.min(src.length, from + MAX_OBJ_CHARS);
  for (let i = from; i < end; i++) {
    const c = src[i];
    if (quote) { if (c === quote && src[i - 1] !== "\\") quote = ""; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") { depth++; if (depth > 1) return -1; continue; }
    if (c === "}") { depth--; if (!depth) return i; }
  }
  return -1;
}

/**
 * A key's string-literal value, or "" for anything computed or absent.
 *
 * BOTH QUOTES, AND A BACKTICK IS NOT ONE. A generated page writes `"` (measured:
 * every one of the corpus's list frames does), but an object key is ordinary
 * TypeScript and `'` is as written as `"` — where a TEMPLATE is the tell that
 * the entry is a data ROW whose count is decided at runtime, which is exactly
 * what this must refuse. `imageSlots`' attribute reader stays double-only
 * because a JSX attribute is a different grammar.
 */
function literalKey(body, name) {
  const m = new RegExp(KEY_BEFORE + keyName(name) + "\\s*:\\s*(\"[^\"]*\"|'[^']*')").exec(body);
  return m ? m[2].slice(1, -1).trim() : "";
}

/** A key's value as written, or "" when the key is not there at all. */
function keyValue(body, name) {
  const m = new RegExp(KEY_BEFORE + keyName(name) + "\\s*:\\s*([^,}]*)").exec(body);
  if (!m) return "";
  return m[2].trim().replace(/^["'`]|["'`]$/g, "").trim();
}

/**
 * ⚠ A KEY MAY BE QUOTED, AND UNTIL 2026-09-19 THAT READ AS AN EMPTY FRAME.
 *
 * Owner: *"a filled entry with a quoted `"src"` key reads as empty."*
 * REPRODUCED: `{ alt: "A loaf", "src": "/u/s/abc.jpg" }` came back
 * `value: "", empty: true` — a photograph the owner paid for, offered to the
 * customer as a space nothing can fill — with the unquoted control reading
 * correctly. The mirror was live too: a quoted `"alt"` key was missed
 * ALTOGETHER, so that entry vanished from the count instead of misreading.
 *
 * ONE GRAMMAR, BOTH DIRECTIONS. `OBJ_START` already admitted a quoted key, so
 * the object was FOUND and then read by a reader that could not see its keys —
 * which is why the failure was a wrong number rather than a missing one. An
 * object key is ordinary TypeScript: `src`, `"src"` and `'src'` are one key
 * written three ways, and a reader that knows only the first is a second copy
 * of the grammar `OBJ_START` already states.
 *
 * THE CHARACTER BEFORE IT IS STILL THE WALL — `,`, `{`, whitespace or the
 * start — so `dataSrc:` cannot match `src` inside it. A quote is deliberately
 * NOT in that set: it belongs to the key, not to what precedes it.
 */
// EXPORTED because `site-images.mjs`' stray-image wall asks the same question of
// the same grammar (2026-09-19): which `src` in this source is an IMAGE's, as
// against an `href` or a word that merely ends in "src". A second spelling of it
// over there is how the finder and the corrector come to disagree about what an
// image reference is, which is the whole class this file already records.
export const KEY_BEFORE = "(^|[,{\\s])";
export const keyName = (name) => "(?:" + name + "|\"" + name + "\"|'" + name + "')";

/**
 * HOW MANY OF THOSE FRAMES THIS CHANGE ADDED — `newEmptySlots` one reader over.
 *
 * SAID APART FROM THE SLOTS, NEVER SUMMED INTO THEM, because the customer's two
 * sentences are different promises. `photoNote` offers to fill a slot; nothing
 * on this platform can fill one of these, so folding them into that count would
 * fix the number by shipping a bigger claim than the one it replaced.
 */
export function newListFrames(before, after) {
  // ── THE TWO KINDS ARE COUNTED APART, BECAUSE ONLY ONE IS A NUMBER ───────
  //
  // Owner, 2026-09-19: *"An empty mapped array renders zero frames but
  // currently reports 'at least 1'… don't treat runtime expressions as a
  // positive lower bound. Use wording without a number when the visible count
  // cannot be established."*
  //
  // `n` IS THE FRAMES WHOSE NUMBER IS ESTABLISHED — entries in a literal array
  // written where it renders, which is run 51's gallery and 297 of the corpus's
  // 320. An entry anywhere else bounds the page from NEITHER side: the array it
  // belongs to may reach the page holding six, one or none, so it can no more
  // floor the total than fix it, and a cut that counted it as one was the exact
  // count's mistake wearing a hedge.
  //
  // `more` IS "AND THERE ARE ALSO SOME WHOSE NUMBER I CANNOT ESTABLISH", which
  // earns a different sentence rather than a modifier on this one. With `n > 0`
  // it makes the number a floor — the established ones really are there; with
  // `n === 0` there is nothing to be a floor OF, and the customer hears no
  // number at all.
  //
  // ASKED OF WHAT THIS CHANGE ADDED, never of the whole site: a mapped gallery
  // sitting untouched on another page says nothing about this change's number.
  // Both halves go through `grewBy`, so the same per-page increase rule decides
  // each and neither can report the other's page.
  const empties = (pages) => listFrames(pages).filter((f) => f.empty);
  const gain = grewBy(before, after, (pages) => empties(pages).filter((f) => f.counted));
  let n = 0;
  for (const g of gain.values()) n += g;
  const more = grewBy(before, after, (pages) => empties(pages).filter((f) => !f.counted)).size > 0;
  return { n, more };
}

export const PICTURE_TOOL = {
  name: "choose_pictures",
  description: "Say which of this site's picture slots the instruction is about, and what should go in each one.",
  input_schema: {
    type: "object",
    properties: {
      pictures: {
        type: "array",
        description:
          "One entry per picture this instruction actually changes, and nothing else. A slot you do not mention " +
          "keeps whatever it has.\n" +
          "RETURN AN EMPTY ARRAY IF NO SLOT MATCHES. The list below is every picture the site has; if the thing " +
          "they are describing is not among them, saying so is correct and costs them nothing. Putting a photograph " +
          "of the wrong thing on a real business's home page is not.",
        items: {
          type: "object",
          properties: {
            page: { type: "string", description: "The page path, exactly as listed below." },
            alt: { type: "string", description: "The picture's description, copied EXACTLY from the list below. This is how the slot is identified." },
            file: {
              type: "string",
              description:
                "THE OWNER'S OWN PHOTOGRAPH, named exactly as listed under their uploads. PREFER THIS WHENEVER ONE " +
                "FITS — it is a real picture of their real business, it is free, and it is better than anything that " +
                "can be made up. Leave it out only when nothing they have uploaded suits this slot.",
            },
            describe: {
              type: "string",
              description:
                "Only when no uploaded photograph fits: a short description of the picture to MAKE for this slot. " +
                "Say what is in it, plainly — \"a barber's chair by a window in the late afternoon\". This costs the " +
                "owner real money for each one, so do not describe a picture nobody asked for.",
            },
            // ── TWO ANSWERS, BECAUSE THE CUSTOMER MEANS TWO THINGS (2026-09-29) ──
            //
            // `clear` was the only removal this tool had, and it EMPTIES the
            // slot: the kit then draws its placeholder — grey bands and the
            // photo's own description as a caption — in the same space. The
            // lane picker had been promised the opposite ("the slot that held
            // it goes with it"), and the customer who said "take the photo off"
            // got a grey box where the photo was (reproduced through the real
            // route and compiled with the real build, the Visit page of
            // `fold-lane-bakery`). Owner: *"distinguishes removing a photo
            // element from explicitly clearing a photo while keeping its
            // space."* So taking a photo off is `remove`, and keeping the space
            // is asked for by name.
            remove: {
              type: "boolean",
              description:
                "True to TAKE THE PHOTOGRAPH OFF THE PAGE: the picture and the space it sits in both go, and " +
                "nothing is drawn where it was. This is what \"take the photo off\", \"remove the picture\" and " +
                "\"we don't want a photo there\" mean. On its own — never with `clear`, `file`, `describe` or `focus`.",
            },
            clear: {
              type: "boolean",
              description:
                "ONLY when they ask to KEEP THE SPACE — \"empty the frame\", \"leave a space for a new photo\", " +
                "\"clear it until I send another\": the picture goes and the site's placeholder is drawn where it " +
                "was. To take a photograph off, use `remove`.",
            },
            focus: {
              type: "string",
              enum: ["centre", "top", "bottom", "left", "right"],
              description:
                "WHICH PART OF THE PICTURE TO KEEP when it has to be cropped to fit its space. Use this for \"his " +
                "head is cut off\", \"you can't see the sign\", \"it's chopping the top off\", \"show more of the " +
                "left\".\n" +
                "\"top\" keeps the top of the photograph — faces, heads, a shop sign. \"bottom\" keeps the bottom — " +
                "a table, a plate, the ground. \"left\" and \"right\" for a subject off to one side. \"centre\" is " +
                "the ordinary one and puts it back.\n" +
                "IT COSTS NOTHING AND CHANGES NO PHOTOGRAPH — it moves the crop of the picture already there. So " +
                "when somebody says a picture is cut off, this is the answer and a new picture is NOT: replacing it " +
                "charges them for an image they did not ask for and would very likely be cut off the same way.\n" +
                "ON ITS OWN, or alongside `file` when the new photograph needs framing too. Leave it out when the " +
                "framing is not what they are talking about.",
            },
          },
          required: ["page", "alt"],
        },
      },
      needsPlace: {
        type: "string",
        description:
          "The page they want a picture ON, when that page has NO slot for one — \"/about\". Only alongside an EMPTY " +
          "`pictures` array, and only when they are asking for a picture to be ADDED somewhere that has none.\n" +
          "THIS IS THE DIFFERENCE BETWEEN A REFUSAL AND THE WORK. Every slot the site has is listed below, so a page " +
          "that is not among them has nowhere to put a photograph and swapping cannot help — saying so here sends it " +
          "to the step that can add one. LEAVE IT OUT when they meant a slot that IS listed and you could not tell " +
          "which: ask them which instead (`question`) — guessing here costs them a page rewrite they did not ask for.",
      },
      // A QUESTION BACK (2026-10-02, builder/clarify.mjs): asked instead of acting, with nothing changed.
      question: QUESTION_FIELD,
    },
    required: ["pictures"],
  },
};

const PICTURE_SYSTEM =
  "You choose which photograph goes where on a small business's website. You are given every picture slot the " +
  "site has — each with the page it is on and the description already written for it — the photographs the owner " +
  "has uploaded, and one instruction from them.\n\n" +
  "MATCH ON WHAT THE PICTURE IS OF. The descriptions were written to say what each photograph shows, so \"the one " +
  "of the chairs\" is the slot whose description mentions chairs. When two could fit and only one was asked for, " +
  "change neither and ask them which (`question`).\n\n" +
  "USE WHAT THEY HAVE UPLOADED WHENEVER IT FITS. A real photograph of their real shop beats anything made up, and " +
  "it costs them nothing. Only describe a new picture when they have uploaded nothing that suits.\n\n" +
  "CHANGE ONLY WHAT THEY ASKED FOR. Every other picture is there because it was wanted.";

/** The slots and the owner's uploads, as text. */
export function pictureDigest(slots, library) {
  const out = [];
  const byPage = new Map();
  for (const s of Array.isArray(slots) ? slots : []) {
    if (!byPage.has(s.page)) byPage.set(s.page, []);
    byPage.get(s.page).push(s);
  }
  for (const [page, list] of byPage) {
    out.push("PAGE " + page);
    for (const s of list) out.push("  \"" + s.alt + "\"" + (isEmptySlot(s) ? "   (empty — no picture yet)" : ""));
  }
  if (!out.length) out.push("(this site has no picture slots at all)");
  const files = (Array.isArray(library) ? library : []).filter((f) => f && f.name).slice(0, 60);
  out.push("");
  out.push(files.length
    ? "PHOTOGRAPHS THE OWNER HAS UPLOADED\n" + files.map((f) => "  " + f.name).join("\n")
    : "PHOTOGRAPHS THE OWNER HAS UPLOADED\n  (none yet)");
  return out.join("\n");
}

export function pictureRequest({ instruction, slots, library, model = PICTURE_MODEL }) {
  return {
    model,
    max_tokens: PICTURE_MAX_TOKENS,
    tools: [PICTURE_TOOL],
    tool_choice: { type: "tool", name: "choose_pictures" },
    system: [{ type: "text", text: PICTURE_SYSTEM }],
    messages: [{
      role: "user",
      content: "THE PICTURES THIS SITE HAS\n" + pictureDigest(slots, library) +
        "\n\nWHAT THEY ASKED FOR\n" + String(instruction || "").trim().slice(0, 2000),
    }],
  };
}

/** Description length, matched to what the image model is actually given. */
export const MAX_DESCRIBE = 240;

/**
 * What came back, checked against the slots that were offered.
 *
 * A SLOT IS MATCHED ON PAGE **AND** ALT, never alt alone: two pages of one site
 * legitimately carry the same picture description, and a model naming only the
 * alt would change whichever the scan happened to find first — on a page nobody
 * mentioned. The same pair twice is one change, because a model listing a slot
 * again is repeating itself rather than asking for two edits.
 *
 * AN UPLOADED FILE MUST BE ONE THE OWNER REALLY HAS. It becomes a URL under
 * their own uploads prefix, so a name the model invented would publish a broken
 * image — which is the one outcome `SafeImage` cannot draw around.
 */
/**
 * The page a picture is wanted ON that has no slot for one, or null.
 *
 * BOUNDED TO A PAGE THE SITE REALLY HAS. The value decides which page a MODEL
 * CALL is spent rewriting, so an invented path buys a page edit for a page that
 * does not exist. The pages are right here in the slot list that was offered.
 *
 * A PAGE THAT ALREADY HAS A SLOT IS REFUSED, and that is the load-bearing half.
 * A model that both matched nothing AND named a page it was shown slots for has
 * contradicted itself: the honest reading is "I could not tell which of these
 * you meant", which is the cheap refusal, not a page rewrite. Without this,
 * every failure to match becomes a paid edit.
 */
export function readNeedsPlace(reply, slots) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = use && use.input && use.input.needsPlace;
  if (typeof raw !== "string") return null;
  const want = raw.trim().toLowerCase();
  if (!want.startsWith("/")) return null;
  const list = Array.isArray(slots) ? slots : [];
  if (!list.length) return null;
  // A SLOT'S `page` IS A FILE PATH AND `needsPlace` IS A ROUTE, and comparing
  // them raw is comparing two different things: `src/routes/index.tsx` never
  // equals `/`, so the refusal below could not fire and every unmatched
  // instruction naming any path would have bought a page rewrite. Found by
  // mutation — deleting this check changed nothing, because the tests reached
  // it through `startsWith("/")`, which had already refused every file path
  // they used. One guard masking another, and the fixture hid it.
  //
  // `routeOf` IS IMPORTED rather than reimplemented: the file-to-route mapping
  // has been written five times in this repo and each copy has been wrong at
  // least once (`menu/index.tsx` → `/menu/index`, `about.team.tsx` →
  // `/about.team`).
  if (list.some((sl) => sl && routeOf(sl.page) === want)) return null;
  return want;
}

export function readPictures(reply, slots, library) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = (use && use.input && use.input.pictures) || [];
  // ⚠ TWO PICTURES ON ONE PAGE WITH ONE DESCRIPTION ARE NOT ADDRESSABLE BY IT.
  // The description is the only handle the model has, so a page+alt that two
  // slots share names neither of them. It used to name the LAST one — a map
  // overwritten in scan order — which is a guess about which photograph the
  // customer meant, and a removal made on a guess takes the wrong one off.
  // Such an entry is refused by name (`same`), and every other entry proceeds.
  //
  // ONE PHOTOGRAPH READ TWICE IS STILL ONE. `imageSlots` scans elements and
  // then components' own props, and a picture written as a prop's value —
  // `media={<SafeImage … />}` — is met by both, with the SAME `src` span. That
  // is not two pictures, so the later reading stands, exactly as it always did.
  const bySlot = new Map(), shared = new Set();
  for (const s of Array.isArray(slots) ? slots : []) {
    const k = s.page + "\u0000" + s.alt;
    const was = bySlot.get(k);
    if (was && was.at !== s.at) shared.add(k);
    else bySlot.set(k, s);
  }
  const files = new Set((Array.isArray(library) ? library : []).map((f) => f && f.name).filter(Boolean));

  // ── CONTRADICTORY ACTIONS ARE AN INVALID ANSWER, NOT A CHOICE TO MAKE ──
  //
  // Taking a photograph off, keeping its space empty and putting another
  // picture there exclude one another; so does framing a picture that is
  // being taken off. An entry asking for more than one was answered by
  // precedence — `clear` beat a new picture, silently — which is a decision
  // about the customer's site made from a contradiction. It is refused by
  // name (`conflict`) and nothing is written for it; the entries beside it
  // are independent and still proceed. A new picture named both ways
  // (`file` and `describe`) is not one of these: `describe` is the tool's own
  // fallback for when no upload fits, read below as it always was.
  //
  // WHAT ONE PHOTOGRAPH IS ASKED FOR IS READ OVER EVERY ENTRY NAMING IT. The
  // same contradiction split across two entries — `remove` in one, `clear` in
  // the next — would otherwise be settled by `seen` below, which keeps the
  // first entry and drops the rest: a silent choice by order.
  const asksOf = (c) => ({
    remove: c.remove === true,
    clear: c.clear === true,
    swap: (typeof c.file === "string" && c.file.trim() !== "") || (typeof c.describe === "string" && c.describe.trim() !== ""),
    focus: c.focus !== undefined && c.focus !== null && c.focus !== "",
  });
  const keyOf = (c) => String(c.page || "") + "\u0000" + String(c.alt || "").trim();
  const asked = new Map();
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!c || typeof c !== "object") continue;
    const a = asksOf(c), was = asked.get(keyOf(c));
    asked.set(keyOf(c), was ? { remove: was.remove || a.remove, clear: was.clear || a.clear, swap: was.swap || a.swap, focus: was.focus || a.focus } : a);
  }

  const out = [], seen = new Set();
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!c || typeof c !== "object") continue;
    const key = keyOf(c);
    const slot = bySlot.get(key);
    if (!slot || seen.has(key)) continue;
    if (shared.has(key)) { out.push({ slot, refused: "same" }); seen.add(key); continue; }

    const asks = asked.get(key);
    if ((asks.remove && (asks.clear || asks.swap || asks.focus)) || (asks.clear && asks.swap)) {
      out.push({ slot, refused: "conflict" });
      seen.add(key);
      if (out.length >= MAX_PICTURE_OPS) break;
      continue;
    }
    if (asks.remove) {
      out.push({ slot, remove: true });
      seen.add(key);
      if (out.length >= MAX_PICTURE_OPS) break;
      continue;
    }

    // THE ENUM IS ENFORCED HERE, IN CODE, and not merely declared in the schema
    // above — a value the component does not know falls back to the middle, so
    // writing one is a change reported as applied that moves nothing. Refused on
    // a slot whose framing is BOUND to data, and on a bare `<img>`, which has no
    // such prop: writing it there emits an attribute that does nothing at all.
    // A REFUSED FRAMING IS NOT AN UNMATCHED PICTURE, and telling the customer it
    // was is the works-but-cannot-say-so disease. Measured: all four refusal
    // paths answered "I couldn't match that to any of the pictures on your
    // site" about a picture named correctly and found — the one sentence that
    // sends them looking for the wrong thing.
    //
    // TWO REASONS, because two are what the customer can act on. "It already
    // shows that" means stop asking; "I can't change that one's framing" means
    // this picture is decided elsewhere. A value the MODEL got wrong reports as
    // the second, which is accurate from their side of the screen.
    let refused = null, focus = null;
    if (c.focus !== undefined && c.focus !== null && c.focus !== "") {
      if (!FOCUS_VALUES.includes(c.focus) || slot.tag !== "SafeImage" || slot.focusBound) refused = "cannot";
      // ALREADY THAT WAY IS NOT A CHANGE. `centre` and an absent attribute are
      // the same picture, so putting a centred one back must not rewrite a file.
      else if (c.focus === (slot.focus || "centre")) refused = "already";
      else focus = c.focus;
    }
    // AN ENTRY CAN BE BOTH WORK AND A REFUSAL, and collapsing the two loses the
    // half that is silent. A swap that also named an impossible framing swaps —
    // and the framing was still asked for and still did not happen, so the
    // refusal rides along rather than being dropped. `refused` is a NOTE here;
    // what makes an entry work is having something to write.

    if (c.clear === true) { out.push({ slot, clear: true, focus, refused }); seen.add(key); }
    else if (typeof c.file === "string" && files.has(c.file)) { out.push({ slot, file: c.file, focus, refused }); seen.add(key); }
    else {
      const describe = String(c.describe || "").trim().slice(0, MAX_DESCRIBE);
      // A DESCRIPTION IS WHAT GETS PAID FOR, so an empty one is dropped rather
      // than sent: $0.15 to find out what an image model does with no prompt.
      //
      // A FRAMING CHANGE ON ITS OWN IS THE WHOLE POINT, though, and it costs
      // nothing: "his head is cut off" must not have to buy a new photograph to
      // be answered, and a replacement would very likely be cropped the same
      // way. So an entry carrying a focus and no picture is kept.
      if (!describe) { if (focus || refused) { out.push({ slot, focus, refused }); seen.add(key); } continue; }
      out.push({ slot, describe, focus, refused });
      seen.add(key);
    }
    if (out.length >= MAX_PICTURE_OPS) break;
  }
  return out;
}

/**
 * THE WRAPPERS A PHOTOGRAPH MAY TAKE WITH IT: plain HTML containers that mean
 * nothing of their own. A landmark (`section`, `header`…), a link, a control, a
 * list item and every component (`Parallax`, `AspectRatio`, `Figure`…) are not
 * here — each can carry layout, a target, behaviour or meaning the photograph
 * does not own.
 */
export const BARE_CONTAINERS = ["div", "span", "figure", "picture"];

/**
 * WHERE A PHOTOGRAPH COMES OFF, read from the page's own syntax tree
 * (2026-09-29, owner: *"Use reliable TSX structure to identify the exact photo
 * element. Do not infer safe deletion solely from neighboring characters."*).
 *
 * `parse` is the injected TypeScript reader (`tweakParser()` in
 * `site-tweak.mjs`): the container has it and a Worker bundle does not. With
 * none — or a page it cannot read cleanly, or no element at the slot's own
 * offset — the answer is `unchecked`: nothing is cut on a guess.
 *
 * WHAT COMES OFF, and nothing else:
 *   * the photograph's own element — a self-closing `<SafeImage>` or `<img>`,
 *     found at EXACTLY the offset its slot was read from, standing as a child
 *     of an element or fragment. One written inside code — a condition, a map,
 *     an attribute such as `media={<SafeImage …/>}` — or carried as a prop of a
 *     larger block (`Figure`, `MediaObject`, a hero) is `part`: taking it off
 *     means changing that code or that block, which this step does not do;
 *   * then its wrapper, ONLY while that wrapper is demonstrably just the
 *     photograph's container (owner: *"Remove a wrapper only when it is
 *     demonstrably just the removed photo's container."*): one of
 *     `BARE_CONTAINERS`, with NO attributes at all (a class, a style, an id, a
 *     key, a handler, a role, a spread — any of them gives it a meaning of its
 *     own), whose only content is what is being removed, and itself a child
 *     of an element. Every other wrapper is kept, emptied.
 *
 * Its line goes with it when it has the line to itself, so the file reads as
 * though it had never been written. The span is in the ORIGINAL source; the
 * caller applies it with the page's other edits, back to front, in one pass.
 */
export function photoRemoval(source, slot, parse) {
  if (!slot || (slot.tag !== "SafeImage" && slot.tag !== "img")) return { ok: false, reason: "part" };
  if (typeof parse !== "function" || typeof source !== "string" || !Number.isInteger(slot.from)) return { ok: false, reason: "unchecked" };
  let r;
  try { r = parse(source); } catch { return { ok: false, reason: "unchecked" }; }
  const file = r && r.file;
  if (!file || (Array.isArray(file.parseDiagnostics) && file.parseDiagnostics.length)) return { ok: false, reason: "unchecked" };
  let el = null;
  (function find(n) {
    if (el) return;
    if (r.isJsx(n) && n.getStart(file) === slot.from) { el = n; return; }
    n.forEachChild(find);
  })(file);
  if (!el || r.tagOf(el) !== slot.tag) return { ok: false, reason: "unchecked" };
  if (r.k(el) !== "JsxSelfClosingElement" || !isElementChild(r, el)) return { ok: false, reason: "part" };
  let target = el;
  const wrappers = [];
  for (;;) {
    const w = target.parent;
    if (!w || r.k(w) !== "JsxElement") break;
    if (!BARE_CONTAINERS.includes(r.tagOf(w)) || r.attrsOf(r.openOf(w)).length) break;
    const inside = contentOf(r, w);
    if (inside.length !== 1 || inside[0] !== target || !isElementChild(r, w)) break;
    wrappers.push(r.tagOf(w));
    target = w;
  }
  const span = ownLines(source, target.getStart(file), target.end);
  return { ok: true, from: span.from, to: span.to, wrappers };
}

/**
 * WHERE A REMOVED QR CODE'S FIGURE COMES OFF, read from the page's own syntax
 * tree (2026-10-02, the whole-router audit's W2).
 *
 * A page shows a code through its binding — `SITE_QRS.<name>` (or
 * `SITE_QRS["<name>"]`), and the list's FIRST code also through the older
 * `SITE_QR` / `SITE_QR_LABEL` — which every publish writes from the stored
 * list. A code taken off the list with its figure left on the page leaves the
 * page reading a binding that is no longer there, and `SITE_QRS.prices.src`
 * throws as the page renders. So the look step takes the code and its figure
 * off together, or neither (`worker.js`).
 *
 * `gone` is what comes off: `{ names, first }` — the codes' names, and `first`
 * when the list's first code is among them, so the old single bindings name it.
 * A reference to any other code, and a code read by a computed key
 * (`SITE_QRS[k]`, which reads whatever codes the list still has), STAYS.
 *
 * WHAT COMES OFF, and nothing else — `photoRemoval`'s rules for a binding:
 *   * the element a reference to a code coming off is written on — reached
 *     from the reference only through the binding's own member chain
 *     (`.src`, `.label`), its braces and an attribute, or as an element's
 *     child. A reference inside any other code — a condition, a map, a
 *     template, a call — is `part`: changing that code is not this step's;
 *   * then its parent, while that parent holds nothing but what is coming off
 *     AND is either an element whose own attributes read a code coming off
 *     (the `<Figure caption={SITE_QRS.x.label}>` a placement writes) or one of
 *     `BARE_CONTAINERS` with no attributes at all. Any other wrapper is kept,
 *     emptied, as a photograph's is;
 *   * never an element that also shows a code that stays, or carries words of
 *     its own between its tags: those are `part` — they are not the code's to
 *     take, and taking them would take the customer's words.
 *
 * With no parser, or a page it cannot read cleanly, the answer is `unchecked`.
 * A page that names no code binding at all is answered without one.
 *
 * Answers `{ ok: true, cuts: [{ from, to }] }` — spans in the ORIGINAL source,
 * none inside another, empty when the page shows none of these codes — or
 * `{ ok: false, reason }`. The caller applies the cuts back to front.
 */
export function codeFigureRemoval(source, gone, parse) {
  const names = gone && Array.isArray(gone.names) ? gone.names.filter((n) => typeof n === "string" && n) : [];
  const first = !!(gone && gone.first === true);
  if (typeof source !== "string") return { ok: false, reason: "unchecked" };
  if ((!names.length && !first) || !/\bSITE_QRS?(?:_LABEL)?\b/.test(source)) return { ok: true, cuts: [] };
  if (typeof parse !== "function") return { ok: false, reason: "unchecked" };
  let r;
  try { r = parse(source); } catch { return { ok: false, reason: "unchecked" }; }
  const file = r && r.file;
  if (!file || (Array.isArray(file.parseDiagnostics) && file.parseDiagnostics.length)) return { ok: false, reason: "unchecked" };
  // EVERY REFERENCE TO A CODE'S OWN BINDING, each marked coming off or staying.
  // Imports bind the names and show nothing, so they are not walked.
  const refs = [];
  (function walk(n) {
    const kind = r.k(n);
    if (kind === "ImportDeclaration") return;
    const viaQrs = (kind === "PropertyAccessExpression" || kind === "ElementAccessExpression")
      && r.k(n.expression) === "Identifier" && n.expression.text === "SITE_QRS";
    if (viaQrs) {
      let key = null;
      if (kind === "PropertyAccessExpression") key = n.name && typeof n.name.text === "string" ? n.name.text : null;
      else if (n.argumentExpression && ["StringLiteral", "NoSubstitutionTemplateLiteral"].includes(r.k(n.argumentExpression))) key = n.argumentExpression.text;
      refs.push({ node: n, gone: key !== null && names.includes(key) });
      return;
    }
    if (kind === "Identifier" && (n.text === "SITE_QR" || n.text === "SITE_QR_LABEL")
      && !(n.parent && r.k(n.parent) === "PropertyAccessExpression" && n.parent.name === n)) {
      refs.push({ node: n, gone: first });
      return;
    }
    n.forEachChild(walk);
  })(file);
  const goneRefs = refs.filter((x) => x.gone);
  if (!goneRefs.length) return { ok: true, cuts: [] };
  const keptRefs = refs.filter((x) => !x.gone);
  const within = (outer, node) => node.getStart(file) >= outer.getStart(file) && node.end <= outer.end;
  const ownWords = (el) => {
    let words = false;
    (function walk(n) {
      if (words) return;
      if (r.k(n) === "JsxText" && !n.containsOnlyTriviaWhiteSpaces && n.getText(file).trim()) { words = true; return; }
      n.forEachChild(walk);
    })(el);
    return words;
  };
  const targets = [];
  for (const ref of goneRefs) {
    // UP THE BINDING'S OWN MEMBER CHAIN — `SITE_QRS.x` to `SITE_QRS.x.src` —
    // and nowhere else: anything between the binding and its braces is code.
    let n = ref.node;
    while (n.parent && ["PropertyAccessExpression", "ElementAccessExpression"].includes(r.k(n.parent)) && n.parent.expression === n) n = n.parent;
    const brace = n.parent;
    if (!brace || r.k(brace) !== "JsxExpression") return { ok: false, reason: "part" };
    let el = null;
    const holder = brace.parent;
    if (holder && r.k(holder) === "JsxAttribute") {
      const open = holder.parent && holder.parent.parent;
      el = open && r.k(open) === "JsxOpeningElement" ? open.parent : open;
    } else if (holder && r.k(holder) === "JsxElement") {
      el = holder;
    }
    if (!el || !["JsxElement", "JsxSelfClosingElement"].includes(r.k(el))) return { ok: false, reason: "part" };
    let target = el;
    for (;;) {
      const w = target.parent;
      if (!w || r.k(w) !== "JsxElement") break;
      const attrs = r.attrsOf(r.openOf(w));
      const readsGone = goneRefs.some((x) => attrs.some((a) => within(a, x.node)));
      const bare = BARE_CONTAINERS.includes(r.tagOf(w)) && !attrs.length;
      const inside = contentOf(r, w);
      if (!(readsGone || bare) || inside.length !== 1 || inside[0] !== target) break;
      target = w;
    }
    if (!isElementChild(r, target)) return { ok: false, reason: "part" };
    if (keptRefs.some((x) => within(target, x.node)) || ownWords(target)) return { ok: false, reason: "part" };
    if (!targets.includes(target)) targets.push(target);
  }
  // ONE CUT PER OUTERMOST TARGET: a figure's caption and its image are both
  // references, and both climb to the same figure.
  const outer = targets.filter((t) => !targets.some((o) => o !== t && within(o, t)));
  const cuts = outer
    .map((t) => ownLines(source, t.getStart(file), t.end))
    .sort((a, b) => a.from - b.from);
  return { ok: true, cuts };
}

/** A node written as a child of an element or fragment — not inside code, not an attribute value. */
function isElementChild(r, n) {
  const p = n && n.parent;
  return !!p && (r.k(p) === "JsxElement" || r.k(p) === "JsxFragment");
}

/** What an element holds, less whitespace between tags and comment-only braces. */
function contentOf(r, el) {
  return r.childrenOf(el).filter((c) =>
    !(r.k(c) === "JsxText" && c.containsOnlyTriviaWhiteSpaces) && !(r.k(c) === "JsxExpression" && !c.expression));
}

/** The span widened to whole lines when it stands alone on them. */
function ownLines(src, from, to) {
  const start = src.lastIndexOf("\n", from - 1) + 1;
  const nl = src.indexOf("\n", to);
  const stop = nl < 0 ? src.length : nl;
  if (/^[ \t]*$/.test(src.slice(start, from)) && /^[ \t]*$/.test(src.slice(to, stop))) {
    return { from: start, to: nl < 0 ? src.length : nl + 1 };
  }
  return { from, to };
}

/**
 * Put the chosen pictures into the stored source.
 *
 * BACK TO FRONT, and that is not a detail. Each replacement changes the length
 * of the file, so applied in order every offset after the first lands wherever
 * the text has moved to — silently, in the middle of an attribute. The same
 * reason `site-text.mjs` applies its edits in reverse.
 *
 * `src={null}` BECOMES `src="…"`, quotes and all: the recorded span is the value
 * inside the braces, so writing a bare URL there would emit `src={https://…}`,
 * which is not valid TSX. The braces are replaced along with what they held.
 */
export function applyPictures(pages, choices) {
  // THE COPY HERE IS BELT-AND-BRACES AND SAYS SO RATHER THAN PRETENDING TO BE
  // TESTED. A mutant removing it survived the whole suite, correctly: every
  // changed page is written back as `{ ...page, source }`, a fresh object, so
  // nothing is mutated either way. It is kept because that guarantee is an
  // emergent property of a line one edit away from changing, and the failure it
  // would cause — the caller's stored pages silently rewritten before the
  // compile that decides whether to keep them — is unrecoverable.
  const byPath = new Map((Array.isArray(pages) ? pages : []).map((p) => [p.path, { ...p }]));
  const perPage = new Map();
  for (const c of Array.isArray(choices) ? choices : []) {
    // A FOCUS-ONLY CHOICE CARRIES NO URL and is still work. Gated on the url
    // alone, "his head is cut off" would be read, priced, reported — and
    // dropped here before anything was written. So is a removal, which
    // carries neither: its `cut` is the span `photoRemoval` found.
    if (!c || !c.slot || (c.url === undefined && !c.focus && !c.cut)) continue;
    if (!perPage.has(c.slot.page)) perPage.set(c.slot.page, []);
    perPage.get(c.slot.page).push(c);
  }
  const changed = [], overlapped = [];
  for (const [path, list] of perPage) {
    const page = byPath.get(path);
    if (!page) continue;
    // ONE SORTED LIST OF EDITS, NOT TWO PASSES. The framing and the photograph
    // are two writes to one element, and a second pass over offsets the first
    // pass moved lands in the middle of an attribute. Collected first, then
    // applied back to front together.
    const edits = [];
    for (const c of list) {
      const s = c.slot;
      // A REMOVAL IS ONE MORE EDIT IN THE SAME PASS, at offsets read from the
      // same source as every other one here — never a second pass that looks
      // the rest up again by description, which two pictures can share.
      if (c.cut) { edits.push({ at: c.cut.from, to: c.cut.to, text: "" }); continue; }
      if (c.url !== undefined && c.url !== null) {
        const value = JSON.stringify(String(c.url || ""));
        // The braces are part of what is replaced when the attribute was written
        // as an expression, so `src={null}` and `src=""` both end up `src="…"`.
        edits.push({
          at: s.quoted ? s.at : s.at - 1,
          to: s.quoted ? s.to : s.to + 1,
          text: s.quoted ? value.slice(1, -1) : value,
        });
      }
      if (!c.focus) continue;
      // `centre` REMOVES the attribute rather than writing the word, so a
      // picture put back looks exactly like one that never had a focus.
      const back = c.focus === "centre";
      if (s.focusAt != null) {
        // A stored value to replace — or, putting it back, the whole attribute
        // including the ` focus="` in front of it and the quote behind.
        edits.push(back
          ? { at: s.focusAt - ' focus="'.length, to: s.focusTo + 1, text: "" }
          : { at: s.focusAt, to: s.focusTo, text: c.focus });
      } else if (!back) {
        edits.push({ at: s.focusInsertAt, to: s.focusInsertAt, text: ' focus="' + c.focus + '"' });
      }
    }
    if (!edits.length) continue;
    // ⚠ TWO EDITS THAT OVERLAP CANNOT BOTH BE RIGHT, and applying them back to
    // front would write one into the middle of the other. Nothing on this page
    // is written and the caller is told which page it was. A BACKSTOP:
    // `runPictureEdit` allows one choice per slot and refuses, before this
    // runs, a removal whose span holds another chosen photograph — so it
    // fails closed rather than trying to choose.
    edits.sort((a, b) => b.at - a.at);
    if (edits.some((e, i) => i > 0 && e.to > edits[i - 1].at)) { overlapped.push(path); continue; }
    let src = page.source;
    for (const e of edits) src = src.slice(0, e.at) + e.text + src.slice(e.to);
    byPath.set(path, { ...page, source: src });
    changed.push(path);
  }
  return { pages: [...byPath.values()], changed, overlapped };
}

/** The four token kinds, in the shape `pageCredits` prices. One price table, everywhere. */
export function pictureUsage(reply, model = PICTURE_MODEL) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    model,
  };
}

/** What the customer is told. Names the picture, because they cannot see a src. */
export function pictureReply({ used = [], made = [], cleared = [], framed = [], removed = [], refused = [], failed = 0 } = {}) {
  const bits = [];
  const name = (c) => "“" + c.slot.alt + "”";
  if (used.length) bits.push("put your own photograph" + (used.length > 1 ? "s" : "") + " on " + used.map(name).join(", "));
  if (made.length) bits.push("made " + (made.length === 1 ? "a new picture" : made.length + " new pictures") + " for " + made.map(name).join(", "));
  if (cleared.length) bits.push("took the picture off " + cleared.map(name).join(", "));
  // A PHOTOGRAPH TAKEN OFF WITH ITS SPACE, said as that — not as the clear
  // above, whose space stays for another picture.
  if (removed.length) bits.push("took " + removed.map(name).join(", ") + (removed.length === 1 ? " off the page" : " off"));
  // ITS OWN SENTENCE, AND IT SAYS WHICH WAY IT MOVED. "Adjusted the framing" is
  // not something the owner can check against the page; "shows the top" is.
  // NAMED SEPARATELY FROM A SWAP, or a framing change on a picture that was
  // also replaced reads as though the replacement is what fixed it.
  if (framed.length) {
    const where = (c) => c.focus === "centre" ? "the middle again" : "the " + c.focus;
    bits.push("moved " + framed.map((c) => name(c) + " to show " + where(c)).join(", "));
  }
  let msg = bits.length ? "✅ " + bits.join(", ").replace(/^./, (c) => c.toUpperCase()) + "." : "";
  // THE REFUSALS, NAMED. Folded into the generic "I couldn't match that" they
  // read as the picture not existing, which is the one thing that is certainly
  // not true — the model found it and copied its description back.
  const already = refused.filter((r) => r.refused === "already");
  const cannot = refused.filter((r) => r.refused === "cannot");
  const same = refused.filter((r) => r.refused === "same");
  const conflict = refused.filter((r) => r.refused === "conflict");
  const part = refused.filter((r) => r.refused === "part");
  const unchecked = refused.filter((r) => r.refused === "unchecked");
  const notes = [];
  const them = (list) => (list.length === 1 ? "it as it was" : "them as they were");
  if (already.length) {
    // READ OFF THE SLOT, NOT THE CHOICE. A refused entry carries no focus of its
    // own — that is what refusing it means — so the choice's field is null and
    // the sentence came out "already shows the null". What is true and useful is
    // what the picture shows TODAY.
    const has = (r) => (r.slot.focus || "centre") === "centre" ? "the middle" : "the " + r.slot.focus;
    notes.push(already.map(name).join(", ") + (already.length === 1 ? " already shows " : " already show ") +
      has(already[0]) + ".");
  }
  if (cannot.length) {
    notes.push("I couldn't change the framing of " + cannot.map(name).join(", ") +
      " — that one's decided by the page itself.");
  }
  // THE REFUSALS OF THIS ROUND, EACH SAYING WHAT WAS LEFT. None of them wrote
  // anything, and none was turned into a different change.
  if (same.length) {
    notes.push("More than one photo on the page is described as " + same.map(name).join(", ") +
      ", so I couldn't tell which you meant and left " + them(same) + ".");
  }
  if (conflict.length) {
    notes.push("I got conflicting instructions for " + conflict.map(name).join(", ") +
      " and left " + them(conflict) + " — say " + (conflict.length === 1 ? "whether" : "for each whether") +
      " to take it off, keep its space empty, or put another photo there.");
  }
  if (part.length) {
    notes.push("I couldn't take " + part.map(name).join(", ") + " off on " + (part.length === 1 ? "its" : "their") +
      " own — it's part of a bigger block on the page — so I left " + them(part) +
      ". Say “empty that photo” to keep its space, or ask for the block to be taken off.");
  }
  if (unchecked.length) {
    notes.push("I couldn't check how " + unchecked.map(name).join(", ") + " sits on the page just now, so I left " +
      them(unchecked) + ".");
  }
  if (!msg && notes.length) return notes.join(" ");
  if (!msg) msg = "I couldn't match that to any of the pictures on your site.";
  if (notes.length) msg += " " + notes.join(" ");
  // A PICTURE THAT COULD NOT BE MADE IS SAID OUT LOUD. It leaves the slot
  // exactly as it was, which looks identical to a change that was never asked
  // for — and the owner has to know before they go looking for it.
  if (failed) msg += " " + (failed === 1 ? "One picture" : failed + " pictures") + " couldn't be made just now — those slots are unchanged.";
  return msg;
}

/**
 * The whole picture layer.
 *
 * `deps.send(request)`      → the Messages API response.
 * `deps.library()`          → the owner's uploaded photographs: [{name, url}].
 * `deps.generate(describe)` → a made picture's URL, or null. May be absent.
 *
 * ESCALATES ONLY WHEN THE SITE HAS NO PICTURE SLOTS AT ALL. A model that read
 * the slots and matched none does NOT escalate: the rungs above cannot swap a
 * photograph either, so sending them up spends ~25 credits to fail differently.
 * The same call `runDataEdit` and `runRulesEdit` both make.
 *
 * A PICTURE THAT CANNOT BE MADE IS NOT A FAILED EDIT. `generate` returning null
 * — no image model configured, no balance, a refused prompt — leaves that slot
 * alone and the others still change. Refusing the whole batch would mean an
 * owner who asked for one uploaded photograph and one made one gets neither.
 *
 * `deps.parser()` → the page reader `photoRemoval` needs, or null. Asked for
 * only when an answer takes a photograph off; with none, that removal is
 * refused as `unchecked` and everything else still runs.
 */
export async function runPictureEdit(deps, { instruction, pages, model = PICTURE_MODEL } = {}) {
  const slots = imageSlots(pages);
  if (!slots.length) return { ok: false, escalate: true, reason: "no-slots", usage: null };

  let library = [];
  try { library = (await deps.library()) || []; } catch { library = []; }

  let reply;
  try { reply = await deps.send(pictureRequest({ instruction, slots, library, model })); }
  catch (e) { return { ok: false, escalate: false, reason: "send", error: e, usage: null }; }
  const usage = pictureUsage(reply, model);
  // A QUESTION BACK (2026-10-02): the model could not tell which photograph is
  // meant without a detail they left out. Nothing is changed; the route asks it.
  const ask = askOf(reply);
  if (ask) return { ok: false, escalate: false, reason: "ask", ask, usage };

  const all = readPictures(reply, slots, library);
  // ── A REMOVAL IS CHECKED AGAINST THE PAGE BEFORE ANYTHING IS WRITTEN ──────
  //
  // Each one is found in the page's own syntax tree at its slot's own offset
  // (`photoRemoval`). One that cannot be taken off safely becomes a refusal
  // naming the photograph — `part` or `unchecked` — and is NEVER turned into
  // a clear or widened to the block around it. The others proceed.
  if (all.some((c) => c.remove)) {
    let parse = null;
    try { parse = typeof deps.parser === "function" ? await deps.parser() : null; } catch { parse = null; }
    const sources = new Map((Array.isArray(pages) ? pages : []).map((p) => [p && p.path, p && p.source]));
    for (const c of all) {
      if (!c.remove) continue;
      const cut = photoRemoval(sources.get(c.slot.page), c.slot, parse);
      if (cut.ok) c.cut = { from: cut.from, to: cut.to };
      else { delete c.remove; c.refused = cut.reason; }
    }
    // A REMOVAL THAT WOULD TAKE ANOTHER CHOSEN PHOTOGRAPH WITH IT — one written
    // inside its own attribute, `fallback={<SafeImage … />}` — cannot be done
    // beside that photograph's own change: the one would be written into the
    // span the other deletes. Both are refused as a conflict before anything
    // is applied, and every other entry proceeds. (Found by probing the
    // overlap guard in `applyPictures`, which this makes a backstop.)
    const works = (c) => !!(c.cut || c.clear || c.file || c.describe || c.focus);
    for (const c of all) {
      if (!c.cut) continue;
      const inside = all.filter((o) => o !== c && works(o) && o.slot.page === c.slot.page &&
        Number.isInteger(o.slot.from) && o.slot.from >= c.cut.from && o.slot.from < c.cut.to);
      if (!inside.length) continue;
      for (const o of [c, ...inside]) {
        for (const k of ["cut", "remove", "clear", "file", "describe"]) delete o[k];
        o.focus = null;
        o.refused = "conflict";
      }
    }
  }
  const refused = all.filter((c) => c.refused);
  // WORK IS HAVING SOMETHING TO WRITE, not the absence of a refusal — an entry
  // can be both, and splitting on the note drops a real swap on the floor.
  const picked = all.filter((c) => c.cut || c.clear || c.file || c.describe || c.focus);
  // EVERY ENTRY REFUSED IS AN ANSWER, NOT A MISS. Falling through to the
  // no-match branch below would report a picture the model found and named as
  // one it could not find — and would send an "already that way" to the
  // needs-place escalation, buying a page rewrite to do nothing.
  if (!picked.length && refused.length) {
    return { ok: false, escalate: false, reason: "no-change", usage, refused, msg: pictureReply({ refused }) };
  }
  if (!picked.length) {
    // ── NOWHERE TO PUT IT IS NOT "I COULD NOT TELL WHICH" ───────────────────
    //
    // This lane fills a slot that already exists — `imageSlots` finds
    // `<SafeImage>` and `<img>`, and inserting a new element into arbitrary TSX
    // is exactly the guess that breaks a page. So "add a photo to the about
    // page", on a page that has none, came back as a REFUSAL: the one shape of
    // picture request this layer's own description advertises and the code
    // cannot do.
    //
    // SIDEWAYS, NOT UP. The layer that CAN is `page` — one page, one model call
    // — whose description already covers "add a block built from parts the page
    // already has", and a `SafeImage` is a part the kit has. The rung ABOVE
    // rewrites every page of the site to add one picture, which is the wrong
    // answer at roughly twice the price.
    //
    // THE MODEL DECIDES, because it is the only party that has just read every
    // slot on the site. Guessing here would send a mistyped SWAP to a page
    // rewrite it never needed. An absent `needsPlace` keeps the honest refusal.
    const place = readNeedsPlace(reply, slots);
    if (place) return { ok: false, escalate: true, reason: "needs-place", layer: "page", page: place, usage };
    return { ok: false, escalate: false, reason: "no-match", usage, msg: pictureReply({}) };
  }

  const byName = new Map((Array.isArray(library) ? library : []).map((f) => [f && f.name, f && f.url]).filter(([n]) => n));
  const resolved = [], used = [], made = [], cleared = [], framed = [], removed = [];
  let failed = 0;
  for (const c of picked) {
    if (c.cut) { resolved.push(c); removed.push(c); continue; }
    if (c.focus) framed.push(c);
    // A FRAMING CHANGE WITH NO PICTURE IS THE COMMON CASE and costs nothing —
    // no image model, no money. It carries no url, so without this it falls
    // through to the generate branch and is counted as a picture that could not
    // be made, on the one instruction that never wanted one.
    if (c.focus && !c.clear && !c.file && !c.describe) { resolved.push(c); continue; }
    if (c.clear) { resolved.push({ ...c, url: "" }); cleared.push(c); continue; }
    if (c.file) { resolved.push({ ...c, url: byName.get(c.file) || "" }); used.push(c); continue; }
    if (typeof deps.generate !== "function") { failed++; continue; }
    let url = null;
    try { url = await deps.generate(c.describe); } catch { url = null; }
    if (!url) { failed++; continue; }
    resolved.push({ ...c, url });
    made.push(c);
  }
  if (!resolved.length) return { ok: false, escalate: false, reason: "nothing-made", usage, failed, msg: pictureReply({ failed }) };

  const { pages: next, changed, overlapped } = applyPictures(pages, resolved);
  if (overlapped.length) {
    return { ok: false, escalate: false, reason: "overlap", usage, msg: "That picture change couldn't be applied safely, so I left your site as it was." };
  }
  return {
    ok: true, pages: next, changed, used, made, cleared, framed, removed, refused, failed, usage,
    msg: pictureReply({ used, made, cleared, framed, removed, refused, failed }),
  };
}
