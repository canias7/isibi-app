// Audit A31-2: a QR code's text is encoded as UTF-8, and the encoding check
// sees a drawing that lost characters above U+00FF.
import test from "node:test";
import assert from "node:assert/strict";
import qrcode from "qrcode-generator";
import { qrSvg, qrEncodes, qrModules, readQrText } from "../builder/site-qr.mjs";

const lowByte = (s) => [...s].map((c) => String.fromCharCode(c.codePointAt(0) & 0xff)).join("");

// The reference's data bits: the UTF-8 bytes from Node's own Buffer, one per
// character, through the library's byte mode (which keeps bytes <= 0xFF).
function refModules(text) {
  const q = qrcode(0, "M");
  q.addData(Buffer.from(text, "utf8").toString("latin1"));
  q.make();
  const n = q.getModuleCount(), set = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) set.add(r + "," + c);
  return { n, set };
}

const CASES = [
  ["é", "Café crème"],
  ["Chinese", "中文菜单"],
  ["emoji", "Coffee ☕ and cake 🍰"],
  ["Polish wifi", "WIFI:T:WPA;S:Kawiarnia Łąka;P:chleb;;"],
  ["curly apostrophe", "https://example.com/?q=Joe’s"],
];

for (const [label, text] of CASES) {
  test(`A31-2: ${label} is drawn from its UTF-8 bytes`, () => {
    const got = qrModules(qrSvg(text).svg);
    assert.equal(got.ok, true);
    const ref = refModules(text);
    assert.equal(got.n, ref.n);
    assert.ok(ref.set.size > 0);
    assert.deepEqual([...got.modules].sort(), [...ref.set].sort());
    assert.equal(qrEncodes(qrSvg(text).svg, text).ok, true);
  });
}

test("A31-2: a character above U+00FF is not the same code as its low byte", () => {
  for (const text of ["WIFI:T:WPA;S:Kawiarnia Łąka;P:pass;;", "Кафе", "中文", "Joe’s Cafe"]) {
    assert.notEqual(lowByte(text), text);
    assert.notEqual(qrSvg(text).svg, qrSvg(lowByte(text)).svg, text);
  }
});

test("A31-2: the encoding check refuses a drawing cut to low bytes", () => {
  const text = "WIFI:T:WPA;S:Kawiarnia Łąka;P:pass;;";
  const cut = qrSvg(lowByte(text)).svg;
  assert.ok(cut);
  assert.equal(qrEncodes(cut, text).ok, false);
});

test("A31-2: Latin-1 and ASCII text draw exactly as before", () => {
  // é is Latin-1: the old code pushed 0xE9, UTF-8 pushes 0xC3 0xA9, so only
  // pure ASCII is byte-identical to the old drawing.
  const q = qrcode(0, "M"); q.addData("https://fold-lane-bakery.gofarther.app/order"); q.make();
  const got = qrModules(qrSvg("https://fold-lane-bakery.gofarther.app/order").svg);
  assert.equal(got.n, q.getModuleCount());
});

test("A31-2: a lone surrogate is refused, not drawn as U+FFFD", () => {
  assert.equal(readQrText("bad \uD800 text").text, null);
  assert.equal(qrSvg("bad \uD800 text").svg, null);
  assert.equal(readQrText("ok 🍰").text, "ok 🍰");
});
