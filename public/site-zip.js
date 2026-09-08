// A zip file, written in the browser, so a customer can download their code.
//
// ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
//
// `site-list.js`'s reason, and one of its own. `chat.js` touches `document` at
// load and can only ever be asserted by READING it — and a zip is the one thing
// in this app where reading proves nothing at all. Every byte here is an offset
// into a binary format: a header written one field short still LOOKS like a zip,
// still downloads, still has the right name in the browser's bar, and fails only
// when somebody double-clicks it a week later. So it lives in a file that runs
// in both places, and its guard round-trips the bytes through Python's own
// `zipfile` — an implementation nobody here wrote.
//
// ── STORED, NOT DEFLATED, AND THAT IS A DECISION ───────────────────────────
//
// Method 0 (STORE) writes each file's bytes as they are. `CompressionStream`
// exists in every browser this app supports and would make the download smaller,
// and it is not used, because it is async and because a deflate stream that is
// subtly wrong is exactly the failure this whole file is written to avoid. A
// site's source is a few pages of TSX — tens of kilobytes — so the compression
// buys a customer nothing they would notice and costs the one property that
// matters: that the archive opens.
//
// ── THE FORMAT, IN THE ORDER IT IS WRITTEN ─────────────────────────────────
//
//   per file:  local header (0x04034b50) + name + the bytes
//   then:      one central-directory header (0x02014b50) per file, in the same
//              order, each naming the offset its local header started at
//   last:      the end-of-central-directory record (0x06054b50)
//
// Every multi-byte number is little-endian. The general-purpose flag carries
// bit 11 (0x0800), which says the name is UTF-8 — without it a name outside
// ASCII is read in the archiver's own code page, which is how a file called
// `café.tsx` arrives as mojibake.

(function (root) {
  "use strict";

  /**
   * CRC-32, the checksum every zip entry carries.
   *
   * Table-driven and built once. A wrong CRC is the failure mode this format
   * hides best: the archive opens, the file extracts, and the checker complains
   * — or, on some tools, silently does not. The guard compares ours against
   * Python's for real source, which is the only way to know it is right.
   */
  var TABLE = null;
  function crcTable() {
    if (TABLE) return TABLE;
    TABLE = new Int32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[i] = c;
    }
    return TABLE;
  }

  function crc32(bytes) {
    var t = crcTable();
    var c = 0 ^ -1;
    for (var i = 0; i < bytes.length; i++) c = (c >>> 8) ^ t[(c ^ bytes[i]) & 0xff];
    return (c ^ -1) >>> 0;
  }

  /**
   * A string as UTF-8 bytes.
   *
   * `TextEncoder` is in every browser and in Node, so there is no fallback here
   * and no hand-rolled encoder to disagree with it — the recorded "two lists of
   * the same thing", which in this file would be two spellings of a customer's
   * own words.
   */
  function utf8(s) {
    return new TextEncoder().encode(String(s == null ? "" : s));
  }

  /**
   * WHAT MAY BE A NAME INSIDE THE ARCHIVE.
   *
   * REFUSES, NEVER REPAIRS. A zip entry name is a path an archiver will create
   * on the customer's own disk, so `../` in one is a file written outside the
   * folder they extracted to — the oldest bug this format has. Backslashes are
   * refused for the same reason (Windows reads one as a separator), and so is a
   * leading slash, which some tools read as absolute.
   *
   * Answering `""` rather than a cleaned-up name is deliberate: a name we had to
   * repair is a name we guessed at, and the caller drops the entry instead. The
   * files this ships are named by us from a store we wrote, so a refusal here
   * means something upstream is wrong and silently renaming it would hide that.
   */
  function safeName(n) {
    var s = typeof n === "string" ? n.trim() : "";
    if (!s || s.length > 200) return "";
    if (s.indexOf("\\") >= 0 || s.charAt(0) === "/" || s.indexOf(":") >= 0) return "";
    if (s.split("/").some(function (seg) { return seg === "" || seg === "." || seg === ".."; })) return "";
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(s)) return "";
    return s;
  }

  function u16(view, at, n) { view.setUint16(at, n & 0xffff, true); }
  function u32(view, at, n) { view.setUint32(at, n >>> 0, true); }

  /**
   * The DOS time and date every entry carries.
   *
   * FIXED, NOT `new Date()`. Two customers downloading the same unchanged site
   * get byte-identical archives, which is what makes this testable at all — and
   * a build's own timestamp is not a fact about the source. 1980-01-01 00:00 is
   * the epoch the format itself starts at, so it is the honest "no time here".
   */
  var DOS_TIME = 0;
  var DOS_DATE = 33; // (1980-1980) << 9 | 1 << 5 | 1

  /**
   * Files in, one zip out.
   *
   * Takes `[{ name, text }]` and answers a `Uint8Array`. An entry whose name
   * this refuses, or whose text is not a string, is DROPPED rather than written
   * under a guessed name; an empty list answers an empty archive, which is a
   * real zip that opens and contains nothing — not a throw, because the caller's
   * own gate decides whether there was anything to offer.
   */
  function zipFiles(files) {
    var list = [];
    var arr = Array.isArray(files) ? files : [];
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      if (!f || typeof f !== "object") continue;
      var name = safeName(f.name);
      if (!name || typeof f.text !== "string") continue;
      var body = utf8(f.text);
      list.push({ nameBytes: utf8(name), body: body, crc: crc32(body) });
    }

    var LOCAL = 30, CENTRAL = 46, EOCD = 22;
    var localSize = 0, centralSize = 0;
    for (var j = 0; j < list.length; j++) {
      localSize += LOCAL + list[j].nameBytes.length + list[j].body.length;
      centralSize += CENTRAL + list[j].nameBytes.length;
    }

    var out = new Uint8Array(localSize + centralSize + EOCD);
    var view = new DataView(out.buffer);
    var at = 0;
    var offsets = [];

    for (var a = 0; a < list.length; a++) {
      var e = list[a];
      offsets.push(at);
      u32(view, at, 0x04034b50);          // local file header
      u16(view, at + 4, 20);              // version needed
      u16(view, at + 6, 0x0800);          // flags: the name is UTF-8
      u16(view, at + 8, 0);               // method: stored
      u16(view, at + 10, DOS_TIME);
      u16(view, at + 12, DOS_DATE);
      u32(view, at + 14, e.crc);
      u32(view, at + 18, e.body.length);  // compressed size
      u32(view, at + 22, e.body.length);  // uncompressed size
      u16(view, at + 26, e.nameBytes.length);
      u16(view, at + 28, 0);              // extra field length
      at += LOCAL;
      out.set(e.nameBytes, at); at += e.nameBytes.length;
      out.set(e.body, at); at += e.body.length;
    }

    var cdStart = at;
    for (var b = 0; b < list.length; b++) {
      var c = list[b];
      u32(view, at, 0x02014b50);          // central directory header
      u16(view, at + 4, 20);              // version made by
      u16(view, at + 6, 20);              // version needed
      u16(view, at + 8, 0x0800);
      u16(view, at + 10, 0);
      u16(view, at + 12, DOS_TIME);
      u16(view, at + 14, DOS_DATE);
      u32(view, at + 16, c.crc);
      u32(view, at + 20, c.body.length);
      u32(view, at + 24, c.body.length);
      u16(view, at + 28, c.nameBytes.length);
      u16(view, at + 30, 0);              // extra
      u16(view, at + 32, 0);              // comment
      u16(view, at + 34, 0);              // disk number
      u16(view, at + 36, 0);              // internal attrs
      u32(view, at + 38, 0);              // external attrs
      u32(view, at + 42, offsets[b]);     // where its local header starts
      at += CENTRAL;
      out.set(c.nameBytes, at); at += c.nameBytes.length;
    }

    u32(view, at, 0x06054b50);            // end of central directory
    u16(view, at + 4, 0);                 // this disk
    u16(view, at + 6, 0);                 // disk with the central directory
    u16(view, at + 8, list.length);       // entries on this disk
    u16(view, at + 10, list.length);      // entries in total
    u32(view, at + 12, at - cdStart);     // central directory size
    u32(view, at + 16, cdStart);          // where it starts
    u16(view, at + 20, 0);                // comment length

    return out;
  }

  var api = { zipFiles: zipFiles, crc32: crc32, safeName: safeName };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SiteZip = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
