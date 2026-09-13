// EVERY RULE IN `public/styles.css` CAN MATCH SOMETHING THE APP SERVES.
//
// ── why this exists, and why it did not until now (2026-09-13) ───────────────
//
// The stylesheet was 7,210 lines and 484,036 bytes, and 1,293 of its 3,082 rules
// could not match any element this app is able to produce — 2,280 lines, 32.3%
// of the file, shipped to every visitor on every page load. CLAUDE.md has
// carried that measurement since 2026-09-12 with the cut DEFERRED, for a stated
// reason: "IT IS NOT CUT BECAUSE THE INSTRUMENT IS NOT GOOD ENOUGH YET". The
// crude scan had real false alarms — `mkt-c1`…`mkt-c14` come from
// `'<div class="mkt-cell mkt-c' + n + '">'` and `st-sev-low|medium|high` came
// from `'st-sev-' + severity`, so a class can be LIVE with its literal appearing
// nowhere — and this repository's bar is ZERO measured false alarms against the
// real corpus before a lint ships.
//
// This is that instrument, and the rate was measured rather than claimed:
//
//   • 781 dead class names, and ZERO of them occur anywhere in the served code.
//   • Both of the recorded false alarms are handled: `mkt-c*` reads LIVE through
//     the prefix rule (driven below), and `st-sev-*` is genuinely dead since the
//     handler that built it went with the rest of the dead set the same day.
//   • The three construction shapes a prefix/suffix reader cannot see —
//     `cls += '…'`, `[a, b].join('-')`, and a class that IS a bare variable —
//     were searched for in the served code and none exists.
//   • A real Chromium rendered all five served pages at two widths before and
//     after the cut and compared the FULL computed style of all 1,744 elements:
//     3 elements differed, all of them one running marquee's `transform`, and
//     the CONTROL (the same stylesheet rendered twice) differed the same way.
//
// ── what a failure here means ───────────────────────────────────────────────
//
// A new finding is a rule nothing can match. That is usually a class that was
// renamed on one side only, or a feature deleted without its styling — the shape
// that left `.lp-arc-tag`'s declaration block orphaned in this file for a day
// when the game builder was deleted. It can also be a class built in a way the
// reader below does not know about, which is a REAL bug in this guard: add the
// shape to `PREFIXES`/`SUFFIXES`, never the name to `KEEP`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "public/styles.css"), "utf8");

/**
 * Rules kept although nothing can reach them. EMPTY, and it should stay empty:
 * a name here is a rule we are choosing to ship to every visitor for a reason
 * worth writing down beside it. A class the reader cannot SEE does not belong
 * here — teach the reader instead, or every future blind spot hides in this list
 * exactly as the `client-routes` ratchet warns.
 */
const KEEP = [];

// ── the corpus: everything that can put a class on an element ────────────────
function corpusFiles() {
  const out = [];
  const add = (p) => { if (fs.existsSync(path.join(ROOT, p))) out.push(p); };
  for (const f of fs.readdirSync(path.join(ROOT, "public"))) {
    if (f.endsWith(".html") || f.endsWith(".js")) add("public/" + f);
  }
  add("public/vendor/qrcode.js");
  add("worker.js");
  for (const f of fs.readdirSync(ROOT)) if (f.endsWith(".mjs")) add(f);
  // The builder's modules compose the PUBLISHED site's markup, which is a
  // different document — but they also compose the platform's own error and
  // status pages, so they are read. Reading too much can only leave a dead rule
  // standing; reading too little invents a finding, and this repo rates a false
  // alarm worse than a miss.
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === "lovable" || e.name === "theme-candidates") continue;
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith(".mjs") || e.name.endsWith(".js")) add(path.join(d, e.name));
    }
  };
  walk("builder");
  return out;
}

/** What the corpus can NAME: whole literals, and the fragments concatenation extends. */
export function vocabulary(corpus) {
  const literals = new Set();
  for (const m of corpus.matchAll(/[A-Za-z_][A-Za-z0-9_-]{0,80}/g)) literals.add(m[0]);

  // A PREFIX IS THE TAIL OF THE LITERAL, NOT THE LITERAL. The first draft
  // anchored on the opening quote and so missed `'<div class="mkt-cell mkt-c' + n`
  // — the exact recorded false alarm — because that string starts with `<`.
  // What survives across a `+` is the last identifier run before the quote.
  const tail = (s) => { const m = /([A-Za-z][A-Za-z0-9_-]*)$/.exec(s); return m ? m[1] : ""; };
  const head = (s) => { const m = /^([A-Za-z0-9_-]+)/.exec(s); return m ? m[1] : ""; };
  const prefixes = new Set();
  const suffixes = new Set();
  for (const m of corpus.matchAll(/(['"])((?:\\.|(?!\1)[^\\])*)\1\s*\+/g)) { const t = tail(m[2]); if (t) prefixes.add(t); }
  for (const m of corpus.matchAll(/`((?:\\.|[^`\\])*?)\$\{/g)) { const t = tail(m[1]); if (t) prefixes.add(t); }
  for (const m of corpus.matchAll(/\+\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g)) { const h = head(m[2]); if (h) suffixes.add(h); }
  for (const m of corpus.matchAll(/\}((?:\\.|[^`\\])*?)`/g)) { const h = head(m[1]); if (h) suffixes.add(h); }
  return { literals, prefixes, suffixes };
}

/** Why a class can appear, or null. Generous by design: it may only ever MISS. */
export function liveReason(cls, v) {
  if (v.literals.has(cls)) return "literal";
  for (const p of v.prefixes) if (p.length >= 3 && cls.startsWith(p)) return "prefix:" + p;
  for (const s of v.suffixes) if (s.length >= 4 && cls.endsWith(s)) return "suffix:" + s;
  return null;
}

/** Every rule in a stylesheet, depth-aware, with its at-rule path. */
export function cssRules(src) {
  const out = [];
  let i = 0, depth = 0, selStart = 0;
  const stack = [];
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < src.length && src[j] !== c) { if (src[j] === "\\") j++; j++; } i = j + 1; continue; }
    if (c === "{") {
      const sel = src.slice(selStart, i).trim();
      if (/^@/.test(sel)) { stack.push({ sel, depth }); depth++; i++; selStart = i; continue; }
      let j = i + 1, d = 1;
      while (j < src.length && d > 0) {
        const k = src[j];
        if (k === "/" && src[j + 1] === "*") { const e = src.indexOf("*/", j); j = e < 0 ? src.length : e + 2; continue; }
        if (k === '"' || k === "'") { let q = j + 1; while (q < src.length && src[q] !== k) { if (src[q] === "\\") q++; q++; } j = q + 1; continue; }
        if (k === "{") d++;
        if (k === "}") d--;
        j++;
      }
      out.push({ sel, start: selStart, end: j, at: stack.map((s) => s.sel) });
      i = j; selStart = i; continue;
    }
    if (c === "}") { while (stack.length && stack[stack.length - 1].depth === depth - 1) stack.pop(); depth--; i++; selStart = i; continue; }
    i++;
  }
  return out;
}

/**
 * The classes in ONE selector that nothing can name.
 *
 * CONJUNCTIVE, which is the whole of the reading: `.a.b` needs both, and a
 * descendant chain needs every ancestor, so `.view-gallery.active` dies on
 * `view-gallery` however common `active` is. Anything that is not a class —
 * an element, `:root`, `*`, an attribute — is always reachable, because this
 * scan only ever answers about classes.
 */
export function deadClassesIn(sel, v) {
  const flat = sel.replace(/::?[a-z-]+\(/gi, " ").replace(/\)/g, " ");
  const out = [];
  for (const part of flat.split(/\s+|>|\+|~/).filter(Boolean)) {
    for (const m of part.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) {
      if (!liveReason(m[1], v)) out.push(m[1]);
    }
  }
  return out;
}

/** Every rule no element the app can build would match. */
export function unreachable(css, v) {
  const found = [];
  for (const r of cssRules(css)) {
    if (r.at.some((a) => /@keyframes|@font-face|@property|@counter-style/i.test(a))) continue;
    const sels = r.sel.split(",").map((s) => s.trim()).filter(Boolean);
    if (!sels.length) continue;
    const per = sels.map((s) => deadClassesIn(s, v));
    if (per.some((d) => d.length === 0)) continue;
    found.push({ sel: r.sel.replace(/\/\*[\s\S]*?\*\//g, "").trim(), names: [...new Set(per.flat())] });
  }
  return found;
}

const FILES = corpusFiles();
const CORPUS = FILES.map((p) => fs.readFileSync(path.join(ROOT, p), "utf8")).join("\n/* file boundary */\n");
const VOCAB = vocabulary(CORPUS);

test("the reader is alive before anything it says is believed", () => {
  // A NEGATIVE ASSERTION MUST PROVE ITS OBSERVER. Every claim below is of the
  // form "nothing is dead", which an empty corpus or a broken parser satisfies
  // perfectly. Floors first, and derived from what is really there rather than
  // set by eye.
  assert.ok(FILES.length >= 120, "the corpus is " + FILES.length + " files — this scan is not scanning");
  assert.ok(FILES.includes("public/index.html"), "the app's own page is not in the corpus");
  assert.ok(FILES.includes("public/chat.js"), "the app's own script is not in the corpus");
  assert.ok(FILES.includes("worker.js"), "the Worker is not in the corpus");
  assert.ok(VOCAB.literals.size >= 30000, "only " + VOCAB.literals.size + " literals — the corpus is not being read");
  assert.ok(VOCAB.prefixes.size >= 50, "only " + VOCAB.prefixes.size + " prefixes — concatenation is not being read");
  assert.ok(cssRules(CSS).length >= 1500, "only " + cssRules(CSS).length + " rules parsed — the parser is not parsing");

  // AND IT REALLY REFUSES A NAME. Without this the whole file passes on a
  // `liveReason` that answers "literal" for everything.
  assert.equal(liveReason("no-such-class-anywhere-xyzzy", VOCAB), null, "the reader admits a name nothing has");
  assert.equal(liveReason("st-code", VOCAB), "literal", "the reader does not see a class the app really writes");
});

test("a class built by concatenation reads as LIVE — the recorded false alarm, driven", () => {
  // `mkt-c1`…`mkt-c14` exist only as `'<div class="mkt-cell mkt-c' + n + '">'`.
  // A bag-of-words reader calls all fourteen dead and takes the marketing reel's
  // stills with them. This is the case the deferred cut was deferred FOR, so it
  // is driven rather than trusted.
  for (let n = 1; n <= 14; n++) {
    assert.ok(liveReason("mkt-c" + n, VOCAB), "mkt-c" + n + " reads as dead — the prefix rule stopped working");
  }
  // DRIVEN OVER A FIXTURE TOO, so the case survives the marketing page being
  // rewritten: the same shape in a corpus of its own.
  const v = vocabulary(`x = '<div class="thing zz-c' + n + '">'; y = \`ww-\${kind}\`; z = pre + '-tail';`);
  assert.ok(liveReason("zz-c7", v), "a `'…prefix' + n` class reads as dead");
  assert.ok(liveReason("ww-blue", v), "a template-literal class reads as dead");
  assert.ok(liveReason("anything-tail", v), "a `x + '-suffix'` class reads as dead");
  assert.equal(liveReason("zz-d7", v), null, "the fixture reader admits a name the fixture cannot build");
});

test("the selector reading is CONJUNCTIVE, so a compound dies on either half", () => {
  const v = vocabulary("'alive-one' 'alive-two'");
  assert.deepEqual(deadClassesIn(".alive-one", v), []);
  assert.deepEqual(deadClassesIn(".alive-one.alive-two", v), []);
  assert.deepEqual(deadClassesIn(".alive-one.gone-x", v), ["gone-x"], "a compound survived a dead half");
  assert.deepEqual(deadClassesIn(".gone-x .alive-one", v), ["gone-x"], "a descendant chain survived a dead ancestor");
  assert.deepEqual(deadClassesIn("div > .alive-one", v), [], "an element selector was read as a class");
  assert.deepEqual(deadClassesIn(":root", v), [], "a pseudo-class was read as a class");
  assert.deepEqual(deadClassesIn(".alive-one:has(.gone-x)", v), ["gone-x"], "a class inside :has() is not read");
});

test("every rule in the stylesheet can match something the app serves", () => {
  const found = unreachable(CSS, VOCAB);
  const kept = new Set(KEEP);
  const news = found.filter((f) => !f.names.every((n) => kept.has(n)));
  assert.deepEqual(news.map((f) => f.sel.slice(0, 80) + "   [" + f.names.join(", ") + "]"), [],
    news.length + " rule(s) in public/styles.css cannot match anything this app can build. "
    + "Either the class was renamed on one side only, the feature was deleted without its styling, "
    + "or it is built in a shape the reader above does not know — in which case teach the reader, "
    + "never add the name to KEEP.");

  // THE RATCHET'S OTHER HALF: a name on KEEP that is no longer dead must leave,
  // or the list stops describing anything and the next dead rule hides behind
  // its length. `client-routes.test.mjs` learnt this the same way.
  const stillDead = new Set(found.flatMap((f) => f.names));
  assert.deepEqual(KEEP.filter((n) => !stillDead.has(n)), [], "a name on KEEP is reachable again — take it off");
});

test("PLANTED: a rule nothing can reach is found", () => {
  // The case above is an absence, and an absence proves nothing unless the same
  // reader finds a defect deliberately put in front of it. Appended to the REAL
  // stylesheet against the REAL vocabulary, so it exercises the shipped path.
  const planted = CSS + "\n.a-class-this-repo-has-never-had{color:red}\n";
  const found = unreachable(planted, VOCAB);
  assert.equal(found.length, 1, "the planted dead rule was not the only finding");
  assert.deepEqual(found[0].names, ["a-class-this-repo-has-never-had"]);

  // And a planted rule whose class IS served must NOT be found — the control
  // that separates "finds dead rules" from "finds every rule".
  assert.deepEqual(unreachable(CSS + "\n.st-code .st-file{color:red}\n", VOCAB), []);
});

test("the stylesheet parses: braces balance and no rule is left empty", () => {
  // NOT COSMETIC. On 2026-09-12 the game-builder deletion took the FIRST line of
  // `.lp-arc-tag{position:absolute;…letter-spacing:.12em;` and left its second
  // and third, so `public/styles.css` shipped an orphaned declaration block and
  // a stray `}` for a day. A browser recovers from that by discarding text until
  // the next `}` — silently, so the only tell is a rule that stopped applying.
  let d = 0, i = 0, line = 1;
  const stray = [];
  while (i < CSS.length) {
    const c = CSS[i];
    if (c === "\n") line++;
    if (c === "/" && CSS[i + 1] === "*") {
      const e = CSS.indexOf("*/", i);
      line += (CSS.slice(i, e < 0 ? CSS.length : e + 2).match(/\n/g) || []).length;
      i = e < 0 ? CSS.length : e + 2; continue;
    }
    if (c === '"' || c === "'") { let j = i + 1; while (j < CSS.length && CSS[j] !== c) { if (CSS[j] === "\\") j++; j++; } i = j + 1; continue; }
    if (c === "{") d++;
    if (c === "}") { d--; if (d < 0) { stray.push(line); d = 0; } }
    i++;
  }
  assert.deepEqual(stray, [], "a closing brace with nothing open at line(s) " + stray.join(", ")
    + " — a rule lost its selector, and everything after it until the next `}` is silently discarded");
  assert.equal(d, 0, d + " unclosed block(s) — the rest of the file is swallowed by one of them");
  assert.equal((CSS.match(/\{\s*\}/g) || []).length, 0, "a rule with an empty body is left over");
});
