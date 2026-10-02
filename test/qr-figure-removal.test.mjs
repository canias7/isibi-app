// WHERE A QR CODE'S FIGURE COMES OFF, read from the page's own syntax tree
// (2026-10-02, the whole-router audit's W2).
//
// `codeFigureRemoval` is what keeps a removed code from leaving its figure on
// the page reading a binding the publish no longer writes. Driven here on its
// own, with the real parser the container uses (`tweakParser`), so each rule
// it holds is a case: what comes off, what stays, and what is refused because
// it cannot come off without changing more than the code itself. The route's
// half — the look step taking the cuts, refusing, and publishing — is
// `partial-removal.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { codeFigureRemoval } from "../builder/site-picture.mjs";
import { tweakParser } from "../builder/site-tweak.mjs";

const parse = await tweakParser();
const IMPORTS = "import { Figure } from '@/components/ui/figure'\nimport { SITE_QRS, SITE_QR, SITE_QR_LABEL } from '@/site-brand'\n";
const page = (body) => IMPORTS + "export default function P() {\n  return (\n    <main>\n" + body + "    </main>\n  );\n}\n";
const PRICES = "      <Figure caption={SITE_QRS.prices.label}><img src={SITE_QRS.prices.src} alt={SITE_QRS.prices.label} /></Figure>\n";
const RING = "      <Figure caption={SITE_QRS.ring.label}><img src={SITE_QRS.ring.src} alt={SITE_QRS.ring.label} /></Figure>\n";
const TOP = "      <h1>Crookes Guitar School</h1>\n";
const GONE = { names: ["prices"], first: false };
/** The source with the cuts made back to front, as the route makes them. */
function cut(src, r) {
  let s = src;
  for (const c of [...r.cuts].reverse()) s = s.slice(0, c.from) + s.slice(c.to);
  return s;
}

test("the control: the container's parser is here, so every case below is read by it", () => {
  assert.equal(typeof parse, "function", "no parser — every case would read `unchecked`");
  assert.equal(parse(page(TOP)).file.parseDiagnostics.length, 0, "the sample page does not parse");
});

test("a figure that reads the removed code comes off whole, on its own lines; the other code's figure stays", () => {
  const src = page(TOP + PRICES + RING);
  const r = codeFigureRemoval(src, GONE, parse);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.cuts.length, 1);
  assert.equal(cut(src, r), page(TOP + RING));
});

test("a bare wrapper holding only the figure goes with it; a wrapper with its own attributes stays, emptied", () => {
  const bare = "      <div>\n  " + PRICES + "      </div>\n";
  const r1 = codeFigureRemoval(page(TOP + bare + RING), GONE, parse);
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.equal(cut(page(TOP + bare + RING), r1), page(TOP + RING), "the bare wrapper was left behind");
  const styled = "      <div className=\"py-8\">\n  " + PRICES + "      </div>\n";
  const r2 = codeFigureRemoval(page(TOP + styled + RING), GONE, parse);
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(cut(page(TOP + styled + RING), r2), page(TOP + "      <div className=\"py-8\">\n      </div>\n" + RING), "a wrapper with a meaning of its own was taken off");
});

test("a figure whose caption is the page's own words keeps the caption: only the code's own element comes off", () => {
  const own = "      <Figure caption=\"Our price list\"><img src={SITE_QRS.prices.src} alt=\"Prices\" /></Figure>\n";
  const r = codeFigureRemoval(page(TOP + own), GONE, parse);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(cut(page(TOP + own), r), page(TOP + "      <Figure caption=\"Our price list\"></Figure>\n"));
});

test("the same code shown twice comes off in both places, the cuts in order and apart", () => {
  const src = page(TOP + PRICES + RING + PRICES);
  const r = codeFigureRemoval(src, GONE, parse);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.cuts.length, 2);
  assert.ok(r.cuts[0].to <= r.cuts[1].from, "the cuts overlap or are out of order");
  assert.equal(cut(src, r), page(TOP + RING));
});

test("the old single-code binding follows the FIRST code, and only when the first is the one removed", () => {
  const legacy = "      <Figure caption={SITE_QR_LABEL}><img src={SITE_QR} alt={SITE_QR_LABEL} /></Figure>\n";
  const src = page(TOP + legacy + RING);
  const r = codeFigureRemoval(src, { names: ["prices"], first: true }, parse);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(cut(src, r), page(TOP + RING));
  assert.deepEqual(codeFigureRemoval(src, { names: ["ring"], first: false }, parse).cuts.length, 1, "the ring code's figure was not found");
  const kept = codeFigureRemoval(page(TOP + legacy), { names: ["ring"], first: false }, parse);
  assert.deepEqual(kept, { ok: true, cuts: [] }, "the first code's figure came off when another code was removed");
});

test("a list drawn from every code by a computed key is left alone — it draws from the list that stays", () => {
  const map = "      {[\"prices\", \"ring\"].map((n) => <img key={n} src={SITE_QRS[n].src} />)}\n";
  assert.deepEqual(codeFigureRemoval(page(TOP + map), GONE, parse), { ok: true, cuts: [] });
});

test("REFUSED, not guessed: inside a condition, inside prose, or beside a code that stays", () => {
  const cond = "      {SITE_QRS.prices && <Figure caption={SITE_QRS.prices.label}><img src={SITE_QRS.prices.src} /></Figure>}\n";
  assert.deepEqual(codeFigureRemoval(page(TOP + cond), GONE, parse), { ok: false, reason: "part" }, "a figure inside a condition was cut");
  const prose = "      <p>Scan {SITE_QRS.prices.label} to see what an hour costs.</p>\n";
  assert.deepEqual(codeFigureRemoval(page(TOP + prose), GONE, parse), { ok: false, reason: "part" }, "a sentence was cut with the code");
  const both = "      <div><img src={SITE_QRS.prices.src} alt={SITE_QRS.ring.label} /></div>\n";
  assert.deepEqual(codeFigureRemoval(page(TOP + both), GONE, parse), { ok: false, reason: "part" }, "an element reading a code that stays was cut");
});

test("a binding used as a tag name is refused, never read as the element around it", () => {
  // It parses and would not compile; what must not happen is the section
  // around it being taken for the code's own element and cut whole.
  const tag = "      <section className=\"py-8\"><SITE_QRS.prices.src /></section>\n";
  assert.deepEqual(codeFigureRemoval(page(TOP + tag), GONE, parse), { ok: false, reason: "part" });
});

test("cannot tell is never nothing to cut: no parser, or a page that does not parse, is `unchecked`", () => {
  assert.deepEqual(codeFigureRemoval(page(TOP + PRICES), GONE, null), { ok: false, reason: "unchecked" });
  assert.deepEqual(codeFigureRemoval(page(TOP + PRICES).replace("</main>", "</mian>"), GONE, parse), { ok: false, reason: "unchecked" });
  assert.deepEqual(codeFigureRemoval(42, GONE, parse), { ok: false, reason: "unchecked" });
});

test("nothing to look for needs no parser: no code gone, a page that reads no code, or only an import of the bindings", () => {
  assert.deepEqual(codeFigureRemoval(page(TOP + PRICES), { names: [], first: false }, null), { ok: true, cuts: [] });
  assert.deepEqual(codeFigureRemoval("export default function P() { return <main><h1>Hi</h1></main>; }\n", GONE, null), { ok: true, cuts: [] });
  assert.deepEqual(codeFigureRemoval(page(TOP), GONE, parse), { ok: true, cuts: [] }, "the import of the bindings was read as a figure");
});
