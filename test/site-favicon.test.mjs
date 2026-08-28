// The designer-drawn tab icon (2026-08-28, owner's call: "in the design step,
// lets add a svg step, for the favicon").
//
// TWO HALVES. The VALIDATOR is driven — it is the security boundary between a
// model-written SVG and a document served from the site's own origin, so every
// refusal class is exercised rather than read. The WIRING is source-read,
// because the field's whole failure mode is the recorded one: a value decided
// correctly in one module and dropped at a hop nobody asserted — the layer
// twelve features in this repo have died in.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import {
  cleanFavicon, FAVICON_FIELD, FAVICON_TAGS, FAVICON_ATTRS, MAX_FAVICON,
} from "../builder/site-favicon.mjs";
import { mergeLook, currentStateNote, EDIT_FIELDS } from "../builder/site-edit.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

// Comments spell the things these tests assert about — the prose-contains-the-
// spelling trap, recorded in this repo nine-plus times — so every source scan
// below runs over a length-preserving blank of the WHOLE-LINE comments.
const blank = (src) => src.replace(/^\s*\/\/[^\n]*$/gm, (m) => " ".repeat(m.length));

/** A window from a landmark to the next top-level declaration — never bytes. */
function topLevel(src, opener) {
  const at = src.indexOf(opener);
  assert.ok(at >= 0, "anchor missing: " + opener);
  const rest = src.slice(at + opener.length);
  const end = rest.search(/\n(?:async\s+)?function\s|\nconst\s|\nexport\s/);
  assert.ok(end > 200, "window collapsed for: " + opener);
  return src.slice(at, at + opener.length + end);
}

const GOOD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#1a1a1a"/><stop offset="1" stop-color="#444"/>' +
  "</linearGradient></defs>" +
  '<rect width="64" height="64" rx="14" fill="url(#g)"/>' +
  '<path d="M18 40 L32 16 L46 40 Z" fill="#f4efe6"/></svg>';

/* ── the validator ──────────────────────────────────────────────────────── */

test("a clean mark passes, under OUR root", () => {
  const r = cleanFavicon('<?xml version="1.0" encoding="UTF-8"?>\n' + GOOD);
  assert.ok(r.svg, "a clean mark was refused: " + r.why);
  // The three things we own are always ours: the namespace (a mark without one
  // silently renders as nothing), the square size, and the validated viewBox.
  assert.match(r.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="64" height="64" viewBox="0 0 64 64"/);
  // The root's own inheritable presentation attribute survives — dropping it
  // would silently repaint every shape that inherits from the root.
  assert.match(r.svg, /^<svg [^>]*fill="none"/);
  // And the inner bytes are the model's own, VERBATIM — a re-serialiser is a
  // second writer that can normalise its way into a bug.
  const inner = GOOD.slice(GOOD.indexOf(">") + 1, GOOD.lastIndexOf("</svg>"));
  assert.ok(r.svg.includes(inner), "the inner bytes were rewritten");
});

test("the whole document is refused, never repaired — each class by name", () => {
  const cases = [
    ["<svg viewBox=\"0 0 64 64\"><scr" + "ipt>alert(1)</scr" + "ipt></svg>", /script/],
    ['<svg viewBox="0 0 64 64"><rect width="64" height="64" onload="x()"/></svg>', /onload/],
    ['<svg viewBox="0 0 64 64"><foreignObject><div>x</div></foreignObject></svg>', /foreignObject/],
    ['<svg viewBox="0 0 64 64"><use href="#x"/></svg>', /use/],
    ['<svg viewBox="0 0 64 64"><image href="http://e/x.png"/></svg>', /image/],
    ['<svg viewBox="0 0 64 64"><style>rect{fill:red}</style><rect width="1" height="1"/></svg>', /style/],
    ['<svg viewBox="0 0 64 64"><rect width="1" height="1" style="fill:red"/></svg>', /style/],
    ['<!DOCTYPE svg><svg viewBox="0 0 64 64"><rect width="1" height="1"/></svg>', /declaration/],
    ['<svg viewBox="0 0 64 64"><!-- x --><rect width="1" height="1"/></svg>', /declaration/],
    ['<svg viewBox="0 0 64 64"><text x="1" y="1">&nbsp;</text></svg>', /entity/],
    ['<svg viewBox="0 0 64 64"><rect width="1" height="1" fill="url(http://e)"/></svg>', /url/],
    ['<svg viewBox="0 0 64 64"><rect width="1" height="1" id="javascript:x"/></svg>', /script scheme/],
    ['<svg viewBox="0 0 64 64"><svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg></svg>', /nested/],
    ['<svg width="64" height="64"><rect width="1" height="1"/></svg>', /viewBox/],
    ['<svg viewBox="0 0 64 64"><rect width=64 height=64/></svg>', /name="value"/],
    ['<svg viewBox="0 0 64 64"><rect width="1" height="1"/></svg><b>x</b>', /after the mark/],
    ["<svg viewBox=\"0 0 64 64\"><SCR" + "IPT>x</SCR" + "IPT></svg>", /SCRIPT/],
    ['<svg viewBox="0 0 64 64"><g><rect width="1" height="1"/></svg>', /pair up/],
    ['<svg viewBox="0 0 64 64"/>', /empty/],
    ['<svg viewBox="0 0 64 64" xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="1" height="1"/></svg>', /xlink/],
  ];
  for (const [doc, why] of cases) {
    const r = cleanFavicon(doc);
    assert.equal(r.svg, null, "accepted: " + doc.slice(0, 60));
    assert.match(String(r.why), why, "the refusal does not name itself for: " + doc.slice(0, 60));
  }
});

test("an entity cannot spell the forbidden thing one byte at a time", () => {
  // `&#117;rl(` decodes to `url(` at XML parse time. The raw bytes carry no
  // `url(`, so a check on the raw value walks straight past it — the checks
  // run on the DECODED value, which is what the renderer will see.
  const r = cleanFavicon('<svg viewBox="0 0 64 64"><rect width="1" height="1" fill="&#117;rl(http://e)"/></svg>');
  assert.equal(r.svg, null);
  assert.match(String(r.why), /url/);
  const lt = cleanFavicon('<svg viewBox="0 0 64 64"><rect width="1" height="1" id="&lt;x"/></svg>');
  assert.equal(lt.svg, null);
});

test("the XML five and numeric entities are ordinary text", () => {
  const r = cleanFavicon('<svg viewBox="0 0 64 64"><text x="2" y="3">B&amp;B &#x2764;</text></svg>');
  assert.ok(r.svg, String(r.why));
});

test("the cap refuses over, admits under, and the field states the number", () => {
  const pad = '<svg viewBox="0 0 64 64"><path d="M0 0 ' + "L1 1 ".repeat(900) + 'Z"/></svg>';
  assert.ok(pad.length > MAX_FAVICON);
  assert.equal(cleanFavicon(pad).svg, null);
  assert.ok(cleanFavicon(GOOD).svg);
  // A cap enforced here and stated nowhere the model reads is a wall it walks
  // into — the run-52 lesson, one field over.
  assert.ok(FAVICON_FIELD.description.includes(String(MAX_FAVICON)),
    "the cap is enforced in code and stated nowhere the model reads");
});

test("the allow-lists hold their absences", () => {
  // The point of each absence, one line apiece — see the module. A name added
  // to either list is a decision about what can reach a customer's origin, so
  // the dangerous ones are pinned OUT by name.
  for (const t of ["script", "style", "use", "image", "foreignObject", "animate", "set", "a", "filter", "mask", "symbol"]) {
    assert.ok(!FAVICON_TAGS.has(t), "<" + t + "> crept into the favicon allow-list");
  }
  for (const a of ["href", "xlink:href", "style", "onload", "onclick", "filter", "xmlns"]) {
    assert.ok(!FAVICON_ATTRS.has(a), a + " crept into the attribute allow-list");
  }
});

test("non-strings are refused, never coerced", () => {
  // `String(["<svg…"])` is the array's own text — the coercion this repo has
  // shipped as a real bug three times.
  for (const v of [null, undefined, 42, ["<svg/>"], { svg: GOOD }]) {
    assert.equal(cleanFavicon(v).svg, null);
  }
});

/* ── the field ──────────────────────────────────────────────────────────── */

test("the field says what the validator enforces, and what a refusal costs", () => {
  const d = FAVICON_FIELD.description;
  assert.equal(FAVICON_FIELD.type, "string");
  assert.match(d, /TAB ICON/i);
  assert.match(d, /16 pixels/, "the size the mark must read at");
  assert.match(d, /viewBox/, "the one structural requirement");
  assert.match(d, /no style attribute/i);
  assert.match(d, /no href/i);
  assert.match(d, /refused WHOLE/, "a partial repair is not on offer and the model must know");
  assert.match(d, /initials mark/, "the fallback, so a refusal is understood as degradation not breakage");
  assert.match(d, /leave it out to keep/i, "the revise contract: absent means unchanged");
});

/* ── the merge ──────────────────────────────────────────────────────────── */

test("junk can never replace a good stored mark; a valid answer does", () => {
  const stored = { favicon: GOOD };
  // The re-roll direction: a designed answer the validator refuses must fall
  // through to the stored mark, or one bad answer strips the mark for good —
  // the container refuses it on every later publish while the response says
  // the look changed.
  const junk = mergeLook(stored, { favicon: "<svg onload=x>" }, null, { instructed: true });
  assert.equal(junk.favicon, GOOD, "a refused answer replaced the stored mark");
  const fresh = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#b3541e"/></svg>';
  const ok = mergeLook(stored, { favicon: fresh }, null, { instructed: true });
  assert.equal(ok.favicon, fresh, "a valid answer did not replace the stored mark");
  // And silence keeps it — the whole reason the field is on EDIT_FIELDS.
  assert.ok(EDIT_FIELDS.includes("favicon"));
  const quiet = mergeLook(stored, {}, null, { instructed: true });
  assert.equal(quiet.favicon, GOOD);
});

test("the designer is shown the stored mark WHOLE — a truncated echo becomes the stored value", () => {
  // The css rule, one field over: `favicon` is replaced rather than merged, so
  // the model can only change the mark by handing the current document back —
  // and a `.slice()` in the note would have it hand back the truncated one,
  // which then REPLACES the stored mark.
  const long = '<svg viewBox="0 0 64 64"><path d="M0 0 ' + "L2 3 ".repeat(500) + 'Z" fill="#123"/></svg>';
  assert.ok(long.length > 2000 && long.length < MAX_FAVICON);
  assert.ok(cleanFavicon(long).svg, "the fixture mark must be valid or the note test is about junk");
  const note = currentStateNote({ favicon: long });
  assert.ok(note.includes(long), "the note truncated or dropped the stored mark");
  assert.match(note, /omit `favicon`/, "the keep-it instruction");
});

/* ── the wiring ─────────────────────────────────────────────────────────── */

test("the tool asks: after the theme, before the shape, compelled on a build", () => {
  const w = blank(worker);
  // The field itself, and its position — a tool's property order is its
  // generation order, so the mark is drawn with the world already decided.
  const at = w.indexOf("favicon: FAVICON_FIELD");
  assert.ok(at > 0, "the tool never asks for a favicon");
  const theme = w.indexOf("theme: {");
  const shape = w.indexOf("shape: SHAPE_FIELD");
  assert.ok(theme > 0 && shape > theme, "the anchors this ordering is asserted between are gone");
  assert.ok(at > theme && at < shape, "the favicon is not drawn between the theme and the shape");
  // Compelled on a BUILD — an unanswered mark is the name-hash initials — and
  // the required list is the build tool's, which a revise swaps out whole.
  assert.match(w, /required: \["brand", "slug", "backend", "description", "theme", "favicon", \.\.\.PLAN_REQUIRED\]/);
});

test("both container payloads carry the mark — derived from the icon hops", () => {
  // The spine is the half that is easy to miss: the container writes the tab
  // icon on EVERY build, so a payload that does not carry the stored mark takes
  // it off because somebody fixed a typo. Derived from the OWNER-icon hops the
  // mark sits beside, so a third publish path that gains an `icon:` without a
  // `favicon:` fails here without anybody remembering this file.
  const w = blank(worker);
  const hops = [...w.matchAll(/icon: icon \|\| "",/g)];
  assert.ok(hops.length >= 2, "the two container payloads stopped carrying the owner icon hop");
  for (const h of hops) {
    const window = w.slice(h.index, h.index + 900);
    assert.match(window, /favicon: /, "a container payload carries the owner icon and not the designer's mark");
  }
  // And the build args read it off the MERGED look, so a revise that does not
  // mention the mark keeps it.
  const args = w.indexOf("icon: priorIcon,");
  assert.ok(args > 0, "the build args' icon hop is gone");
  assert.match(w.slice(args, args + 500), /favicon: look\.favicon/,
    "the build path does not hand the stored mark to the build");
});

test("the container: owner's icon, then the designer's mark, then the initials", () => {
  const s = blank(server);
  assert.match(s, /from "\.\/site-favicon\.mjs"/, "the container never imports the validator");
  const body = topLevel(s, "function writeSiteBrand(");
  assert.match(body.slice(0, 200), /favicon/, "writeSiteBrand is never handed the mark");
  const own = body.indexOf("siteIconFrom(");
  const drawn = body.indexOf("cleanFavicon(");
  const initials = body.indexOf("initialsMark(");
  assert.ok(own > 0 && drawn > 0 && initials > 0, "a rung of the precedence is gone");
  assert.ok(own < drawn && drawn < initials,
    "the precedence is not owner → designer → initials; a model must not outrank a person");
  // Validated AGAIN here — version skew and hand-written payloads reach this
  // route directly, and the mark is served from the site's own origin.
  assert.match(body, /cleanFavicon\(favicon\)/);
  // AND THE RAW VALUE IS READ NOWHERE ELSE. "cleanFavicon is called" is a
  // presence, and a presence is satisfied by calling it and writing the RAW
  // bytes anyway — the validated-then-discarded shape this repo has recorded
  // a dozen times. So: outside the signature, the validation call and the
  // refusal log, the identifier must not appear in the function at all.
  // Strings are blanked too (single-line, the only kind this function has):
  // the refusal log and the template's own `/favicon.svg` fallback both SPELL
  // the word, and a word in a string literal is not a read of the value.
  const reads = body
    .replace("cleanFavicon(favicon)", "")
    .replace("if (favicon && !mark.svg)", "")
    .replace("favicon: faviconDrawn", "")
    .replace(/^function writeSiteBrand\([^)]*\)/, "")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
  assert.ok(!/\bfavicon\b/.test(reads),
    "writeSiteBrand reads the RAW favicon somewhere other than the validator");
  // The drawn path sits INSIDE the owner-icon fallthrough — the literal gate is
  // the precedence, and `if (true)` here is a model outranking a person.
  const gate = body.indexOf("if (!icon) {");
  assert.ok(gate > 0 && gate < drawn, "the designer's mark is not gated on the owner having no icon");
  // Reported only once the bytes are down: the assignment sits after the write,
  // or a failed write reports a designed mark on a site serving the template's.
  // NOT `faviconDrawn = ` bare — that matches the `let … = false` declaration
  // above the write and the ordering passes vacuously: the wrong-occurrence
  // trap, caught by this test's own first run.
  const write = body.indexOf("writeFileSync(iconPath");
  const report = body.indexOf("faviconDrawn = !!mark.svg");
  assert.ok(write > 0 && report > write, "the report does not wait for the write");
  // And the call site passes the payload's own field.
  assert.match(s, /favicon: payload\.favicon/);
});

test("the reply calls it the tab icon, not our field name", () => {
  assert.match(chat, /favicon: 'the tab icon'/);
});

test("the router knows a tab-icon ask is the cheap look layer", () => {
  // Without this sentence every layer below it is unreachable for the one
  // message shape it serves — the publicView lesson, which has cost a whole
  // site twice: a capability nobody is told about is one nobody routes to.
  const ask = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const at = ask.indexOf('\\"look\\" — colour, theme');
  assert.ok(at > 0, "the look layer's description is gone");
  assert.match(ask.slice(at, at + 400), /TAB ICON/, "the look layer never mentions the tab icon");
});
