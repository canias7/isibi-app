// THE WORDS IN A PDF, WITHOUT A LIBRARY (2026-10-30, the owner: the site agent
// reads what the owner attaches).
//
// Neither the Worker bundle nor the container image has a PDF reader (no
// pdf.js in package.json, no poppler in the Dockerfile), and adding either
// means a heavier bundle or an image rebuild. Most PDFs an owner attaches — a
// menu, a price list exported from Word or Canva — keep their words in
// Flate-compressed content streams as `(text) Tj` / `[(te) -20 (xt)] TJ`, and
// that much is readable with the platform's own `DecompressionStream`, which
// both the Worker and Node 22 have.
//
// WHAT IT CANNOT READ, said rather than guessed: a scanned PDF (pictures of
// words), and fonts that map their own codes (CID / Identity-H, common in
// Asian-language PDFs and some designers' exports) come back empty or as
// noise; the caller tells the agent "no readable text" when nothing comes back.
// Never throws.

const MAX_STREAMS = 400;
const MAX_INFLATED = 8 * 1024 * 1024;

const latin1 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return s; };

async function inflate(bytes) {
  try {
    const ds = new DecompressionStream("deflate");
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  } catch { return null; }
}

function unescapeLiteral(s) {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3}|\r?\n)/g, (_, c) => {
    if (c === "n") return "\n"; if (c === "r") return "\r"; if (c === "t") return "\t";
    if (c === "b" || c === "f") return ""; if (c === "(" || c === ")" || c === "\\") return c;
    if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8) & 255);
    return "";
  });
}
const hexString = (h) => { const t = h.replace(/\s+/g, ""); let s = ""; for (let i = 0; i + 1 < t.length; i += 2) s += String.fromCharCode(parseInt(t.slice(i, i + 2), 16)); return s; };

/** The text shown by one content stream, in reading order as written. */
export function contentText(content) {
  let out = "";
  const re = /\((?:\\[\s\S]|[^\\)])*\)\s*(?:Tj|'|")|\[((?:\\[\s\S]|[^\]\\])*)\]\s*TJ|<([0-9A-Fa-f\s]+)>\s*Tj|\b(?:T\*|Td|TD|ET)\b/g;
  let m;
  while ((m = re.exec(content))) {
    const tok = m[0];
    if (/^(T\*|Td|TD|ET)$/.test(tok)) { if (out && !out.endsWith("\n")) out += "\n"; continue; }
    if (tok.startsWith("(")) { out += unescapeLiteral(tok.slice(1, tok.lastIndexOf(")"))); continue; }
    if (tok.startsWith("<")) { out += hexString(m[2]); continue; }
    const parts = /\((?:\\[\s\S]|[^\\)])*\)|<[0-9A-Fa-f\s]*>|-?\d+(?:\.\d+)?/g;
    let p;
    while ((p = parts.exec(m[1]))) {
      const x = p[0];
      if (x.startsWith("(")) out += unescapeLiteral(x.slice(1, -1));
      else if (x.startsWith("<")) out += hexString(x.slice(1, -1));
      else if (Number(x) < -200) out += " ";
    }
  }
  return out;
}

/** The readable words of a PDF, from its bytes or base64; "" when none. */
export async function pdfText(input) {
  try {
    const bytes = typeof input === "string" ? Uint8Array.from(atob(input.replace(/\s+/g, "")), (c) => c.charCodeAt(0)) : input instanceof Uint8Array ? input : null;
    if (!bytes || latin1(bytes.subarray(0, 5)) !== "%PDF-") return "";
    const raw = latin1(bytes);
    const re = /<<((?:(?!>>\s*stream)[\s\S]){0,2000})>>\s*stream\r?\n/g;
    let m, n = 0, inflated = 0;
    const texts = [];
    while ((m = re.exec(raw)) && n < MAX_STREAMS) {
      n++;
      const start = m.index + m[0].length;
      const end = raw.indexOf("endstream", start);
      if (end < 0) break;
      const dict = m[1];
      if (/\/Subtype\s*\/Image/.test(dict)) continue;
      // The data ends before the end-of-line that precedes `endstream`; a
      // decompressor refuses anything after the compressed data.
      // A stated /Length is believed when it fits; otherwise the line end goes.
      let stop = end;
      const len = (dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/) || [])[1];
      if (len && start + Number(len) <= end) stop = start + Number(len);
      else { if (stop > start && bytes[stop - 1] === 10) stop--; if (stop > start && bytes[stop - 1] === 13) stop--; }
      let body = bytes.subarray(start, stop);
      if (/\/FlateDecode/.test(dict)) {
        const d = await inflate(body);
        if (!d) continue;
        inflated += d.length;
        if (inflated > MAX_INFLATED) break;
        body = d;
      } else if (/\/Filter/.test(dict)) continue;
      const s = latin1(body);
      if (!/\bBT\b/.test(s)) continue;
      const t = contentText(s);
      if (t.trim()) texts.push(t);
      re.lastIndex = end;
    }
    return texts.join("\n").replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  } catch { return ""; }
}
