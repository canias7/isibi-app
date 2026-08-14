// A MINIMAL PNG READER, because Node has none and the screenshot is the only
// thing that can say what was actually painted.
//
// Enough for what Chromium's screenshot returns and no more: 8-bit, RGB or
// RGBA, no interlace — anything else THROWS rather than returning plausible
// pixels, since a decoder that quietly mis-reads is worse here than one that
// refuses. zlib is built in; the rest is unfiltering scanlines per the spec.
//
// Used by `chart-ground-truth.mjs`. Self-tested by `test/png-read.test.mjs`
// against a screenshot of a known colour, because every caller's conclusion is
// only as good as this.
import zlib from "node:zlib";
export function decodePng(buf) {
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; ctype = body[9]; }
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8 || (ctype !== 6 && ctype !== 2)) throw new Error(`unsupported png depth=${depth} ctype=${ctype}`);
  const ch = ctype === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0, x = line[i];
      let v;
      if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
             v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
export const pixelAt = (img, x, y) => {
  const i = (Math.min(Math.max(y | 0, 0), img.h - 1)) * img.w * img.ch + (Math.min(Math.max(x | 0, 0), img.w - 1)) * img.ch;
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] };
};
