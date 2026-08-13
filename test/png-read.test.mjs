// The PNG reader is the floor under every pixel conclusion `chart-ground-truth`
// draws, so it is checked against bytes with a known answer rather than trusted.
// A decoder that mis-reads returns plausible colours, which is exactly the kind
// of wrong that reads as a result.
import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { decodePng, pixelAt } from "../test/integration/png-read.mjs";

/** A real PNG, built here, so the test does not depend on a fixture file. */
function png(w, h, rgba, filter = 0) {
  const ch = 4, stride = w * ch;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = filter;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = rgba(x, y);
      const i = y * (stride + 1) + 1 + x * ch;
      // `Sub` predicts from the pixel to the left, so the stored byte is the
      // difference — which is what makes this exercise the unfilter path.
      const left = x ? rgba(x - 1, y) : [0, 0, 0, 0];
      const src = filter === 1 ? [r - left[0], g - left[1], b - left[2], a - left[3]] : [r, g, b, a];
      raw[i] = src[0] & 255; raw[i + 1] = src[1] & 255; raw[i + 2] = src[2] & 255; raw[i + 3] = src[3] & 255;
    }
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function crc32(buf) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
}

test("reads back the exact colours it was given", () => {
  const img = decodePng(png(4, 3, (x, y) => [x * 60, y * 80, 7, 255]));
  assert.equal(img.w, 4);
  assert.equal(img.h, 3);
  assert.deepEqual(pixelAt(img, 0, 0), { r: 0, g: 0, b: 7 });
  assert.deepEqual(pixelAt(img, 3, 2), { r: 180, g: 160, b: 7 });
});

test("unfilters a Sub-filtered scanline", () => {
  // Filter 0 stores raw bytes, so a decoder that ignored filtering entirely
  // would pass the test above and fail here — which is the point of it.
  const img = decodePng(png(4, 2, (x, y) => [x * 10 + y, 5, 9, 255], 1));
  assert.deepEqual(pixelAt(img, 3, 1), { r: 31, g: 5, b: 9 });
});

test("a colour is read at the pixel asked for, not a neighbour", () => {
  const img = decodePng(png(3, 3, (x, y) => (x === 1 && y === 2 ? [1, 2, 3, 255] : [200, 200, 200, 255])));
  assert.deepEqual(pixelAt(img, 1, 2), { r: 1, g: 2, b: 3 });
  assert.deepEqual(pixelAt(img, 1, 1), { r: 200, g: 200, b: 200 });
});

test("out-of-range coordinates clamp rather than read past the buffer", () => {
  const img = decodePng(png(2, 2, () => [9, 9, 9, 255]));
  assert.deepEqual(pixelAt(img, 99, 99), { r: 9, g: 9, b: 9 });
  assert.deepEqual(pixelAt(img, -5, -5), { r: 9, g: 9, b: 9 });
});

test("an unsupported png is refused, not guessed at", () => {
  // 16-bit or palette data would decode to plausible nonsense. Refusing is the
  // direction that cannot produce a wrong measurement.
  const bad = png(2, 2, () => [1, 2, 3, 255]);
  bad[24] = 16;                                   // IHDR bit depth
  assert.throws(() => decodePng(bad), /unsupported png/);
});
