// THE CODE TAB AND THE DOWNLOAD ARE REAL ON A REACT SITE (2026-09-08, owner on
// two screenshots of the workspace top bar: "2 different screens when theres a
// build and not , see , different buttons all around").
//
// The two bars differed on ONE flag, and it was not "has a build" — it was
// `isReact = !!(site.react && site.url)`, which gated the Code tab, the Download
// icon and the Publish button as `isReact ? '' : …`. Those three are the
// STATIC-SITE ERA'S, so they appeared only on a project that had never built,
// where Download and Publish were greyed and Code opened an empty two-pane
// editor. And nothing can make a non-react site any more: `siteCreate` writes no
// flag, `siteSend` routes every first message down the React path
// (`isBuild || site.react`), and `site-list.js` stamps `react: true` on every
// server row — so all three reached exactly one screen and did nothing on it.
// The dead-control finding for the fourth time in this app's own chrome.
//
// The owner's call was to make Code and Download REAL rather than delete them.
// What these guards hold:
//
//   • the zip really opens — round-tripped through Python's own `zipfile`,
//     because a header written one field short still LOOKS like an archive;
//   • the file names in the tree and in the zip are where the container really
//     writes, DERIVED from `build-server.mjs`'s own `safeRoute` / `safePart`
//     rather than typed here, so the two cannot drift;
//   • the route is the owner's own source and a stranger gets the 404 a missing
//     site gets, and "nothing stored" never wears that 404;
//   • both controls are drawn on BOTH screens, and Publish is gone.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
// THE REAL DRAWER, so "the code shown is the code served" is an identity rather
// than a second renderer's opinion — which is the whole reason a QR is stored as
// its payload and never as a picture.
import { qrSvg } from "../builder/site-qr.mjs";
// AND THE REAL MARK VALIDATORS, for the same reason: `writeSiteBrand` writes
// what these answer, so deriving the expectation from them is what makes "the
// bytes shown are the bytes written" an identity instead of a hope.
import { cleanFavicon, readWordmark } from "../builder/site-favicon.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");
const CHAT = read("../public/chat.js");
const CSS = read("../public/styles.css");
const SERVER = read("../builder/build-server.mjs");
const SiteZip = (await import("../public/site-zip.js")).default
  || (await import("../public/site-zip.js"));

/**
 * Whole-line comments blanked, LENGTH PRESERVED so offsets still line up.
 *
 * This change's own comments name `isReact ? '' :`, `Publish` and `stPub` while
 * explaining that they are gone — the recorded "prose contains the thing it
 * forbids", which here would let every absence assertion below pass by matching
 * the explanation of why the thing is absent.
 */
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");
const BARE = bare(CHAT);

/** A named function's source, out of a file. */
function fn(head, src = BARE) {
  const at = src.indexOf(head);
  assert.ok(at > 0, head + " is gone");
  const end = src.indexOf("\n}", at);
  assert.ok(end > at, head + " has no end");
  return src.slice(at, end + 2);
}

/**
 * A top-level one-line `const NAME = …;`, out of a file.
 *
 * FOR THE CONSTANTS A CARRIED FUNCTION REACHES FOR, and it exists because of a
 * miss caught here: `stCodeRows` names `ST_FIND_MAX` and `stCodeTree` names
 * `ST_ALL_OPEN`, and BOTH sit behind a short-circuit (`f.hits ? … : ''` and
 * `all ? … :`). A free identifier resolves when its line RUNS, so every case in
 * this file went on passing against a scope that had neither — which is this
 * repository's recorded free-identifier trap arriving through the one door it
 * cannot see: not a missing import, not a parse error, just an operand nothing
 * happened to evaluate. They are carried now, like the functions.
 */
function konst(name, src = BARE) {
  const m = src.match(new RegExp("^const " + name + " = .*;$", "m"));
  assert.ok(m, "const " + name + " is gone");
  return m[0];
}

/** A top-level `const NAME = [ … ];` that spans lines, out of a file. */
function konstBlock(name, close, src = BARE) {
  const at = src.indexOf("const " + name + " = ");
  assert.ok(at >= 0, "const " + name + " is gone");
  const end = src.indexOf("\n" + close, at);
  assert.ok(end > at, "const " + name + " has no end (" + close + ")");
  return src.slice(at, end + close.length + 1);
}

// ── THE ZIP, AGAINST AN IMPLEMENTATION NOBODY HERE WROTE ────────────────────

test("DRIVEN: the zip opens, and every file in it round-trips byte for byte", () => {
  // THE ONLY HONEST PROOF FOR THIS FORMAT. Reading the writer tells you the
  // fields are in the source; it cannot tell you the central directory's offset
  // is right, that the CRC matches, or that the archive opens at all — and each
  // of those fails a week later on the customer's own machine. Python's
  // `zipfile` is an implementation with no connection to ours.
  const files = [
    { name: "src/routes/index.tsx", text: "import { createFileRoute } from '@tanstack/react-router'\n\nexport const Route = createFileRoute('/')({ component: Home })\n" },
    { name: "src/routes/-parts/chord-diagram.tsx", text: "export function ChordDiagram() { return null }\n" },
    // NON-ASCII, because the UTF-8 flag (bit 11) is the difference between a
    // customer's own words and mojibake in whatever code page the archiver
    // guesses. A build's brand can be anything.
    { name: "src/routes/menu.tsx", text: "export const dish = 'Café crème — 3,50 €'\n" },
    // AND AN EMPTY FILE, which is the entry whose sizes and CRC are all zero —
    // the shape a writer that skips a length field still produces correctly.
    { name: "empty.txt", text: "" },
  ];
  const bytes = SiteZip.zipFiles(files);
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "gf-zip-"));
  const zip = path.join(dir, "t.zip");
  try {
    fs.writeFileSync(zip, Buffer.from(bytes));
    const script = [
      "import json,sys,zipfile",
      "z = zipfile.ZipFile(sys.argv[1])",
      "assert z.testzip() is None, 'a CRC in the archive is wrong'",
      "print(json.dumps({n: z.read(n).decode('utf-8') for n in z.namelist()}))",
    ].join("\n");
    const out = execFileSync("python3", ["-c", script, zip], { encoding: "utf8" });
    const back = JSON.parse(out);
    assert.deepEqual(Object.keys(back), files.map((f) => f.name), "the archive's names, in order");
    for (const f of files) assert.equal(back[f.name], f.text, f.name + " did not survive the round trip");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("DRIVEN: an empty list is a real (empty) archive, not a throw or junk", () => {
  const bytes = SiteZip.zipFiles([]);
  // Just the end-of-central-directory record: 22 bytes, and its signature.
  assert.equal(bytes.length, 22);
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x05, 0x06]);
  // AND EVERY JUNK SHAPE IS DROPPED RATHER THAN WRITTEN UNDER A GUESS. A name
  // this refuses is a path an archiver would create on the customer's disk.
  for (const junk of [null, undefined, "x", 7, {}, { name: "a" }, { text: "b" }, { name: "a", text: 7 }]) {
    assert.equal(SiteZip.zipFiles([junk]).length, 22, JSON.stringify(junk) + " was written into the archive");
  }
  assert.equal(SiteZip.zipFiles(null).length, 22, "a non-list is not a list of one");
});

test("DRIVEN: a name that would escape the folder is refused, never repaired", () => {
  // REFUSED, NOT CLEANED. A repaired name is a guessed name, and the files this
  // ships are named by us from a store we wrote — so a refusal means something
  // upstream is wrong and renaming it silently would hide that.
  for (const bad of ["../secret", "a/../../b", "/etc/passwd", "a\\b", "C:/x", "", "   ", ".", "a/./b", "a//b", "x\u0000y", "x\ny"]) {
    assert.equal(SiteZip.safeName(bad), "", JSON.stringify(bad) + " was admitted as an entry name");
  }
  assert.equal(SiteZip.safeName(["a"]), "", "String(['a']) is 'a' — a non-string is refused, never coerced");
  assert.equal(SiteZip.safeName("x".repeat(201)), "", "an unbounded name");
  // THE OBSERVER IS ALIVE: the names this really ships are admitted.
  assert.equal(SiteZip.safeName("src/routes/index.tsx"), "src/routes/index.tsx");
  assert.equal(SiteZip.safeName("src/routes/-parts/chord-diagram.tsx"), "src/routes/-parts/chord-diagram.tsx");
});

test("DRIVEN: the CRC is a real CRC-32, not a number that merely differs", () => {
  // The value for "123456789" is the one every CRC-32 implementation agrees on;
  // a table built wrong produces a checksum that looks fine and fails on open.
  assert.equal(SiteZip.crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(SiteZip.crc32(new Uint8Array(0)), 0);
});

/**
 * The archive taken apart by its own offsets.
 *
 * A SECOND READER, BECAUSE THE FIRST ONE DOES NOT LOOK AT EVERYTHING. Python's
 * `zipfile` is the honest proof that the archive OPENS, and it reaches that
 * answer without consulting two of the fields we write: it decodes every name
 * using the CENTRAL directory's flag word (so a local header claiming the wrong
 * encoding is invisible to it) and it walks the central directory by its byte
 * SIZE (so the end record's entry count is invisible too). Both were driven and
 * measured: with either field wrong the round trip above passes unchanged.
 *
 * A streaming extractor reads the local header and nothing else, and plenty of
 * tools trust the count — so those two fields are the difference between an
 * archive that opens here and one that opens on the customer's machine. This
 * reader derives the truth from what the archive CONTAINS and compares it with
 * what the archive SAYS, which is the one comparison a single reader cannot make.
 */
function readArchive(bytes) {
  const b = Buffer.from(bytes);
  const eocd = b.length - 22;
  assert.ok(eocd >= 0 && b.readUInt32LE(eocd) === 0x06054b50, "no end-of-central-directory record");
  const said = { onDisk: b.readUInt16LE(eocd + 8), total: b.readUInt16LE(eocd + 10) };
  const cdSize = b.readUInt32LE(eocd + 12);
  const cdStart = b.readUInt32LE(eocd + 16);

  const central = [];
  for (let at = cdStart; at < cdStart + cdSize; ) {
    assert.equal(b.readUInt32LE(at), 0x02014b50, "central header #" + central.length + " has no signature");
    const nameLen = b.readUInt16LE(at + 28);
    central.push({
      flags: b.readUInt16LE(at + 8),
      time: b.readUInt16LE(at + 12),
      date: b.readUInt16LE(at + 14),
      at: b.readUInt32LE(at + 42),
      name: b.subarray(at + 46, at + 46 + nameLen).toString("utf8"),
    });
    at += 46 + nameLen + b.readUInt16LE(at + 30) + b.readUInt16LE(at + 32);
  }

  const local = central.map((c) => {
    assert.equal(b.readUInt32LE(c.at), 0x04034b50, "the local header for " + c.name + " has no signature");
    const nameLen = b.readUInt16LE(c.at + 26);
    return {
      flags: b.readUInt16LE(c.at + 6),
      time: b.readUInt16LE(c.at + 10),
      date: b.readUInt16LE(c.at + 12),
      name: b.subarray(c.at + 30, c.at + 30 + nameLen).toString("utf8"),
    };
  });
  return { said, central, local };
}

/** A DOS date and time word, decoded — never compared as the number we wrote. */
const dosStamp = (date, time) => ({
  y: 1980 + (date >> 9), m: (date >> 5) & 15, d: date & 31,
  h: time >> 11, min: (time >> 5) & 63,
});

test("DRIVEN: the archive's own declarations agree with what it contains", () => {
  const files = [
    { name: "src/routes/index.tsx", text: "export const a = 1\n" },
    { name: "src/routes/menu.tsx", text: "export const dish = 'Café crème'\n" },
    { name: "src/routes/-parts/chord-diagram.tsx", text: "export function C() { return null }\n" },
  ];
  const got = readArchive(SiteZip.zipFiles(files));

  // THE OBSERVER IS ALIVE. Everything below compares the archive's word against
  // its own contents, so it proves nothing at all if the contents are empty.
  assert.equal(got.central.length, files.length, "the central directory does not hold every file");
  assert.deepEqual(got.central.map((c) => c.name), files.map((f) => f.name));
  assert.deepEqual(got.local.map((l) => l.name), files.map((f) => f.name));

  // THE COUNT. Both of them: a reader that walks the directory by size never
  // looks at either, and a reader that trusts the count stops one file short.
  assert.equal(got.said.onDisk, files.length, "the end record undercounts the entries on this disk");
  assert.equal(got.said.total, files.length, "the end record undercounts the entries in total");

  // THE ENCODING, IN BOTH HEADERS AND AGREEING. Bit 11 says the name is UTF-8;
  // without it `Café crème` is read in whatever code page the archiver guesses.
  // A streaming extractor reads only the local one, so "the central directory
  // has it" is not the same claim.
  for (let i = 0; i < files.length; i++) {
    assert.equal(got.local[i].flags & 0x0800, 0x0800, files[i].name + ": the local header does not say the name is UTF-8");
    assert.equal(got.local[i].flags, got.central[i].flags,
      files[i].name + ": the two headers disagree about the name's encoding");
  }
});

test("DRIVEN: two downloads of an unchanged site are byte-identical", () => {
  // THE PROPERTY THE MODULE CLAIMS, and the reason the round trip above is
  // testable at all. A build's own clock is not a fact about the source, so the
  // stamp is the format's own epoch rather than `new Date()`.
  const files = [{ name: "src/routes/index.tsx", text: "export const a = 1\n" }];
  assert.ok(Buffer.from(SiteZip.zipFiles(files)).equals(Buffer.from(SiteZip.zipFiles(files))),
    "two downloads of the same unchanged site differ byte for byte");

  // AND THE STAMP IS DECODED, never compared against the number we wrote — so
  // this reads as the date it claims to be rather than as the source restated.
  const got = readArchive(SiteZip.zipFiles(files));
  for (const h of [].concat(got.local, got.central)) {
    assert.deepEqual(dosStamp(h.date, h.time), { y: 1980, m: 1, d: 1, h: 0, min: 0 },
      "an entry is stamped with something other than the format's own epoch");
  }
});

// ── WHERE A FILE LIVES, DERIVED FROM THE CONTAINER ──────────────────────────

test("DERIVED: the names in the tree and the zip are where the container writes", () => {
  // THE RULE EXISTS TWICE — once in `build-server.mjs`, which writes the files,
  // and once in `chat.js`, which shows and zips them — and this is what stops
  // the two drifting. The container's own functions are evaluated out of its
  // source, so a change there fails HERE rather than silently handing a
  // customer an archive whose layout is not their site's.
  const cut = (h) => { const a = SERVER.indexOf(h); assert.ok(a > 0, h + " is gone from build-server.mjs"); return SERVER.slice(a, SERVER.indexOf("\n}", a) + 2); };
  const safeRoute = new Function("path", cut("function safeRoute(") + "\nreturn safeRoute;")(path);
  const safePart = new Function("path", cut("function safePart(") + "\nreturn safePart;")(path);
  const stSrcPath = new Function(fn("function stSrcPath(") + "\nreturn stSrcPath;")();

  const pages = ["index.tsx", "prices.tsx", "gear.tsx", "src/routes/menu.tsx"];
  for (const p of pages) {
    assert.equal(stSrcPath({ path: p }), "src/routes/" + safeRoute(p), "page " + p);
  }
  const parts = ["chord-diagram", "week-strip", "seatmap"];
  for (const n of parts) {
    assert.equal(stSrcPath({ name: n }), "src/routes/" + safePart(n), "part " + n);
  }
  // AND THE OBSERVER IS ALIVE: those really are different shapes, so the two
  // loops above are not both proving the same branch.
  assert.notEqual(stSrcPath({ path: "index.tsx" }), stSrcPath({ name: "index" }));
  assert.match(stSrcPath({ name: "chord-diagram" }), /-parts\//, "a component is not published as a route");
  // Junk answers "" and the caller drops it.
  for (const junk of [null, undefined, 7, {}, { path: 7 }, { path: "" }]) assert.equal(stSrcPath(junk), "", JSON.stringify(junk));
});

test("DRIVEN: one list feeds both the tree and the download", () => {
  const stSrcPath = new Function(fn("function stSrcPath(") + "\nreturn stSrcPath;")();
  const stSrcFiles = new Function(fn("function stSrcFiles(") + "\n" + fn("function stSrcPath(") + "\nreturn stSrcFiles;")();
  const out = stSrcFiles({
    pages: [{ path: "index.tsx", source: "A" }, { path: "prices.tsx", source: "B" }],
    parts: [{ name: "chord-diagram", source: "C" }],
  });
  assert.deepEqual(out.map((f) => f.name), [
    "src/routes/index.tsx", "src/routes/prices.tsx", "src/routes/-parts/chord-diagram.tsx",
  ], "pages first, then the site's own parts");
  assert.deepEqual(out.map((f) => f.text), ["A", "B", "C"]);
  // The shape it answers is the shape the zip takes, with no adapter between —
  // an adapter is where a tree and a download start disagreeing.
  assert.equal(SiteZip.zipFiles(out).length > 22, true, "what the tab lists is what the zip writes");
  // AN ENTRY WITH NO SOURCE IS STILL DROPPED — there is nothing to show.
  assert.deepEqual(stSrcFiles({ pages: [{ path: "index.tsx" }], parts: null }), []);
  for (const junk of [null, undefined, {}, { pages: "x" }]) assert.deepEqual(stSrcFiles(junk), [], JSON.stringify(junk));
  // BUT AN ENTRY WITH SOURCE AND NO USABLE NAME IS REPORTED — inverted
  // deliberately 2026-09-11. It used to vanish: out of the tree, out of the zip
  // and out of the count, with no sentence anywhere, and if it was the only page
  // the panel said "Nothing stored for this site yet" about a store that had
  // something in it. It gets a real, unique, downloadable name and a note.
  const lost = stSrcFiles({ pages: [{ source: "no path" }], parts: [{ name: "Not A Kebab Name", source: "junk" }] });
  assert.deepEqual(lost.map((f) => f.name), ["unplaced/1.txt", "unplaced/2.txt"], "an unnameable file was dropped in silence");
  assert.deepEqual(lost.map((f) => f.text), ["no path", "junk"], "the content of an unplaced file was lost");
  for (const f of lost) {
    assert.ok(f.unplaced, "an unplaced file is not marked, so it reads as an ordinary part of the project");
    assert.ok(f.note, "an unplaced file says nothing about why it is unplaced");
    assert.ok(SiteZip.safeName(f.name), "an unplaced file's name is one the download refuses — the tree and the zip disagree again");
  }
  // THE PART RULE IS THE CONTAINER'S. `safePart` lowercases, trims and refuses a
  // non-kebab name, and the tree must refuse exactly what it refuses — a name
  // shown here that the container will not write is a file in the explorer that
  // no file on the site answers to.
  assert.equal(stSrcPath({ name: "  Chord-Diagram  " }), "src/routes/-parts/chord-diagram.tsx", "the part name is not normalised as safePart does");
  assert.equal(stSrcPath({ name: "Not A Kebab Name" }), "", "a name the container refuses was given a path anyway");
  assert.equal(stSrcPath({ name: "a:b" }), "", "a name the download refuses was given a path anyway");
});

// ── THE ROUTE ───────────────────────────────────────────────────────────────

const USER = { id: "u-owner" };

// EVERY CASE GETS ITS OWN SLUG, and that is not tidiness. `siteOwnerBySlug` is
// `memoize(_ownerCache, …)` — five minutes, per slug, across the whole module —
// so a case that answers "somebody else owns this" decides every later case that
// reuses the name. It did: the stranger case cached a foreign owner and the
// owner's own read then came back 404. The recorded trap, and the reason the
// stranger case was passing partly by luck.
let caseNo = 0;
async function callSource({ user = USER, slug = "gf-src-" + (++caseNo), owner = "u-owner", pages, parts, config, configFails = false, bucketFails = false } = {}) {
  const worker = await loadWorker();
  const reads = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return user ? json(user) : new Response("no", { status: 401 });
    if (u.includes("/rest/v1/site_backends")) return json(owner ? [{ uid: owner }] : []);
    return new Response("unavailable", { status: 503 });
  };
  const SITES_BUCKET = {
    async get(key) {
      reads.push(key);
      if (bucketFails) throw new Error("r2 down");
      if (key.endsWith("/pages.json")) return pages === undefined ? null : { text: async () => JSON.stringify(pages) };
      if (key.endsWith("/parts.json")) return parts === undefined ? null : { text: async () => JSON.stringify(parts) };
      // THE SITE'S CONFIG — where the favicon, the wordmark, the codes and the
      // stylesheet have always been stored, and what the assets half of the
      // answer is read from. `configFails` is the cannot-tell case: the source
      // must still arrive.
      if (key.startsWith("config/")) {
        if (configFails) throw new Error("config read blipped");
        return config === undefined ? null : { text: async () => JSON.stringify(config) };
      }
      return null;
    },
  };
  try {
    const req = new Request("https://gofarther.dev/api/site/source?slug=" + encodeURIComponent(slug), {
      headers: user ? { Authorization: "Bearer t" } : {},
    });
    const res = await worker.fetch(req, { SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null), reads };
  } finally { globalThis.fetch = real; }
}

test("DRIVEN: signed out is 401 and nothing of the site is read", async () => {
  const r = await callSource({ user: null });
  assert.equal(r.status, 401);
  assert.equal(r.reads.length, 0, "an unauthenticated caller reached the store");
});

test("DRIVEN: a site that is not yours is the 404 a missing site gets", async () => {
  // NOT A 403. A distinct refusal would tell whoever asks that the slug exists
  // and is taken, and a slug is claimable by whoever builds it first — the
  // answer route's rule one block up.
  const r = await callSource({ owner: "someone-else" });
  assert.equal(r.status, 404);
  assert.equal(r.body.error, "not found");
  assert.equal(r.reads.length, 0, "a stranger's request reached the store anyway");
  const none = await callSource({ owner: null });
  assert.equal(none.status, 404, "a site nobody owns answers the same way");
});

test("DRIVEN: no slug is 400, and a hostile one never reaches the store as given", async () => {
  assert.equal((await callSource({ slug: "" })).status, 400);
  assert.equal((await callSource({ slug: "../../etc" })).reads.every((k) => !k.includes("..")), true,
    "a traversal reached the bucket key");
});

test("DRIVEN: the owner gets their pages and their own parts", async () => {
  const r = await callSource({
    pages: [{ path: "index.tsx", source: "PAGE" }],
    parts: [{ name: "chord-diagram", source: "PART" }],
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.match(r.body.slug, /^gf-src-\d+$/, "the route answers about the slug it was asked for");
  assert.deepEqual(r.body.pages, [{ path: "index.tsx", source: "PAGE" }], "the store's own shape, unchanged");
  assert.deepEqual(r.body.parts, [{ name: "chord-diagram", source: "PART" }]);
  assert.equal(r.body.why, undefined, "a site with source does not carry the empty sentence");
  // RE-ANCHORED 2026-09-11: the config joined the reads when the explorer began
  // showing the files the build made. Being exactly two reads was never the
  // property — reading only THIS site's keys is, which is what the case has
  // always been called.
  for (const key of r.reads) {
    assert.ok(key.includes(r.body.slug), "it read some other site's key: " + key);
  }
  assert.deepEqual(r.reads.slice().sort(), [
    "config/" + r.body.slug + ".json",
    "source/" + r.body.slug + "/pages.json",
    "source/" + r.body.slug + "/parts.json",
  ], "the explorer's reads have drifted");
});

test("DRIVEN: nothing stored is ok:true with a sentence, never the stranger's 404", async () => {
  // THE RECORDED "a failure that cannot name itself". A site the customer owns
  // and has not yet published would otherwise answer "not found", and the next
  // session hunts a permission bug that is not there.
  const r = await callSource({ pages: undefined, parts: undefined });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.pages, []);
  assert.deepEqual(r.body.parts, []);
  assert.match(r.body.why, /not published/i, "it does not say WHICH empty this is");
  // A site with pages and no parts is the ordinary site and says nothing.
  const some = await callSource({ pages: [{ path: "index.tsx", source: "P" }], parts: undefined });
  assert.equal(some.body.why, undefined, "a site with no hand-written components is not 'nothing stored'");
  assert.deepEqual(some.body.parts, []);
  // A store that throws is the same shape as an empty one rather than a 500:
  // the readers already answer null on failure, and a code TAB that 500s takes
  // the workspace down for a read that changes nothing.
  const dead = await callSource({ bucketFails: true });
  assert.equal(dead.status, 200);
  assert.deepEqual(dead.body.pages, []);
});

test("the route READS and never repairs — it takes no lease and moves nothing", () => {
  const src = bare(read("../worker.js"));
  const at = src.indexOf('url.pathname === "/api/site/source"');
  assert.ok(at > 0, "the source route is gone");
  const block = src.slice(at, src.indexOf('url.pathname === "/api/site/reconcile"', at));
  // The window grew when the explorer began carrying the assets and the shared
  // foundation; the bound is re-derived rather than the property loosened.
  assert.ok(block.length > 200 && block.length < 8000, "re-derive this window");
  assert.match(block, /loadSiteSource\(env, sslug\)/, "it no longer reads the page source");
  assert.match(block, /loadSiteParts\(env, sslug\)/, "it no longer reads the site's own components");
  // THE THIRD ARGUMENT IS PINNED AS `null`, and that is the whole assertion:
  // `configDeps`' third argument is the legacy `_meta` fallback, so anything
  // else there puts a Postgres round trip in front of every explorer open — a
  // cost a read-only tab must not carry.
  //
  // ONE SPELLING, NOT TWO. The first draft added a negative beside this
  // (`configDeps(env, sslug, <a letter>` forbidden) and it went red against
  // correct code, because `null` begins with a letter — a guard reporting a
  // working route as broken, which this repository rates worse than a miss. The
  // positive match already pins the argument exactly.
  assert.match(block, /loadConfig\(configDeps\(env, sslug, null\), sslug\)/, "it no longer reads the files the build made, or it opens a database to do it");
  // `loadSiteSourceForEdit` REPAIRS the editable copy and is for the four
  // callers that go on to publish. A tab that only shows the code must not.
  assert.ok(!/loadSiteSourceForEdit/.test(block), "the code tab repairs state it only displays");
  for (const write of ["put(", "delete(", "edit_claim", "edit_reserve"]) {
    assert.ok(!block.includes(write), "the source route " + write + " — it is a read");
  }
});

// ── THE TWO CONTROLS, DRIVEN ────────────────────────────────────────────────
//
// Everything above this line reads. That is enough for a hop that either exists
// or does not, and it is NOT enough for a condition: `if (false) { … }` leaves
// the call it guards exactly where a source read looks for it, which is a trap
// this repository has recorded and which a sweep found here — the download's
// fetch and its nothing-to-zip sentence both survived a read. So the two
// handlers are evaluated out of `chat.js` and driven against fakes.

/** A block from a landmark to its matching brace — never a byte window. */
function block(head, src = BARE) {
  const at = src.indexOf(head);
  assert.ok(at > 0, head + " is gone");
  let depth = 0;
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(at, i + 1);
  }
  assert.fail(head + " has no closing brace");
}

const escFake = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * The real download handler, out of the file, with every free name handed in.
 *
 * `siteCodeFiles` is a module-level `let` the handler both READS and WRITES, so
 * it is declared in the scope this builds rather than passed as an argument — an
 * assignment to a parameter is one nothing outside the call can observe, and
 * whether the fetch's answer is cached is one of the things being asked.
 */
function downloader(deps) {
  const body = block("dl.onclick = async () => {");
  const at = body.indexOf("{");
  const make = new Function("deps", [
    "const { dl, apiFetch, stSrcFiles, sbToast, SiteZip, stSaveBlob, site } = deps;",
    "let siteCodeFiles = deps.cache || [];",
    "return { press: async () => " + body.slice(at) + ", get cache() { return siteCodeFiles; } };",
  ].join("\n"));
  return make(deps);
}

/** What a press of the button does, with the server and the disk recorded. */
function pressFixture({ cache = [], answer, slug = "fretwork-1", fail = false } = {}) {
  const asked = [];
  const saved = [];
  const said = [];
  const dl = { disabled: false, title: "Download your code" };
  const d = downloader({
    dl, cache, site: { slug },
    apiFetch: async (u) => {
      asked.push(u);
      if (fail) throw new Error("offline");
      return { ok: true, json: async () => answer };
    },
    stSrcFiles: (src) => {
      const out = [];
      for (const p of (src.pages || []).concat(src.parts || [])) out.push({ name: p.path || p.name, text: p.source });
      return out;
    },
    sbToast: (m) => said.push(m),
    SiteZip,
    stSaveBlob: (blob, name) => saved.push({ size: blob.size, name }),
  });
  return { d, dl, asked, saved, said };
}

test("DRIVEN: the download asks the server for itself, having never opened the tab", () => {
  // THE PRESS THAT HAD TO WORK. A customer can reach this button without ever
  // opening Code, so a handler that reads the tab's list alone downloads nothing
  // on the one press it is most likely to get. Reading the cache when it is full
  // is the optimisation; asking is the behaviour.
  const f = pressFixture({ answer: { ok: true, pages: [{ path: "src/routes/index.tsx", source: "export const a = 1\n" }] } });
  return f.d.press().then(() => {
    assert.equal(f.asked.length, 1, "the button never asked the server for the source");
    assert.match(f.asked[0], /^\/api\/site\/source\?slug=fretwork-1$/);
    assert.equal(f.saved.length, 1, "nothing reached the disk");
    assert.equal(f.saved[0].name, "fretwork-1.zip");
    assert.ok(f.saved[0].size > 22, "an EMPTY archive was saved — 22 bytes is the end record and nothing else");
    assert.deepEqual(f.said, [], "a working download said something went wrong");
    assert.equal(f.d.cache.length, 1, "the answer was not kept for the tab");
    // AND THE BUTTON COMES BACK. Its own `finally`, so a failed press does not
    // leave the control dead and reading "Getting your code…" for ever.
    assert.equal(f.dl.disabled, false);
    assert.equal(f.dl.title, "Download your code");
  });
});

test("DRIVEN: a site with nothing stored is TOLD, never handed an empty archive", () => {
  // A zip with no entries opens to an empty folder, which reads as "my code is
  // gone" — the worst thing this button could say to somebody who has just paid
  // for a build.
  const f = pressFixture({ answer: { ok: true, pages: [], parts: [], why: "nothing stored" } });
  return f.d.press().then(() => {
    assert.equal(f.saved.length, 0, "an empty archive was downloaded instead of a sentence");
    assert.equal(f.said.length, 1, "nothing was said at all");
    assert.match(f.said[0], /No code stored/i);
  });
});

test("DRIVEN: a server that cannot answer is said, and the tab's list is used when it has one", () => {
  const dead = pressFixture({ fail: true });
  return dead.d.press().then(() => {
    assert.equal(dead.saved.length, 0, "a failed fetch still downloaded something");
    assert.equal(dead.said.length, 1);
    assert.match(dead.said[0], /try again/i);
    assert.equal(dead.dl.disabled, false, "the button was left dead after a failure");

    // THE CACHE IS A CACHE: with the tab already filled, the press does not ask
    // again. This is the other half of the first case — together they say the
    // list is an optimisation rather than the source of truth.
    const warm = pressFixture({ cache: [{ name: "src/routes/index.tsx", text: "a\n" }], fail: true });
    return warm.d.press().then(() => {
      assert.equal(warm.asked.length, 0, "the button re-fetched source the tab had already loaded");
      assert.equal(warm.saved.length, 1, "the tab's own list did not reach the disk");
    });
  });
});

/**
 * The Code tab's host, as a fake that models the ONE thing this panel does to
 * the DOM: `drawSiteCode` writes the shell once, and the TREE is written into a
 * node inside it — again on every keystroke in the search box, without the shell
 * being touched. `host.innerHTML` reads back the composed document, which is
 * what a real element answers and what every case below reads.
 *
 * A FLAT STRING WOULD HIDE THE PROPERTY IT EXISTS TO PROVE. A fake whose
 * `innerHTML` only ever holds the last thing written to it cannot tell a tree
 * redraw from a whole-panel redraw — and "the search box does not rebuild the
 * panel" is the only thing keeping the customer's caret in the field and the
 * file they are reading where they left it.
 */
function codeHost(bind = () => []) {
  const st = { shell: "", rows: "", main: "", said: "", on: false, draws: 0 };
  const SLOT = '<div class="st-code-rows"></div>';
  // THE EDITOR COLUMN IS A SLOT TOO. `drawSiteCode` writes an EMPTY shell and
  // lets `paintFile` and `paintTree` fill a column each, so a fake that modelled
  // only the rows would read the bar and the source as missing from a panel that
  // has them — and, worse, would pass every "the panel was not rebuilt" case for
  // the wrong reason, since nothing would ever be written to the column a row
  // click repaints.
  const MAIN = '<div class="st-code-main"></div>';
  // THE BINDER UNDERSTANDS `[attr]` AND NOTHING ELSE, so anything compound is
  // answered with the empty list rather than handed to it. `closeMenu` asks for
  // `[data-srcmore][aria-expanded="true"]`, which the binder's `slice(1, -1)`
  // turned into a regular expression that does not compile — and the empty list
  // is the honest answer here anyway, since nothing in this fake is expanded.
  const simple = (sel) => /^\[[a-z-]+\]$/.test(sel);
  const ask = (html, sel) => (simple(sel) ? bind(html, sel) : []);
  const text = (key) => ({
    get innerHTML() { return st[key]; },
    // A REAL BROWSER CLAMPS, AND SO DOES THIS. Writing `innerHTML` takes the box's
    // children away, which collapses its scroll height and pulls `scrollTop` back
    // to zero — so a fake that let the number sit there would pass "the tree keeps
    // its place" with the restore deleted, which is the one thing that case exists
    // to catch. The offset is PER BOX (`<key>At`): repainting the editor column
    // must not move the tree beside it.
    set innerHTML(v) {
      st[key] = String(v);
      st[key + "At"] = 0;
      // THE BUTTON INSIDE IT IS DESTROYED WITH IT, which is the whole reason
      // `paintFile` rebinds: the handler closes over a `let` that the row click
      // reassigns, so a stale handler would read the RIGHT file — it is the
      // ELEMENT that does not survive. A fake that kept one object here would
      // make that case pass with the rebind deleted.
      if (key === "main") st.dl = null;
    },
    get textContent() { return st[key]; },
    set textContent(v) { st[key] = String(v); },
    get scrollTop() { return st[key + "At"] || 0; },
    set scrollTop(v) { st[key + "At"] = Number(v) || 0; },
    addEventListener: () => {},
    querySelectorAll: (sel) => ask(st[key], sel),
  });
  // THE EDITOR COLUMN ANSWERS `#stCodeDl` OUT OF WHAT IT WAS LAST TOLD, because
  // the Download button lives inside the markup `paintFile` replaces — so a
  // rebind that stopped happening would show up here as a button whose handler
  // belongs to the file before it.
  const column = () => {
    const node = text("main");
    node.querySelector = (sel) => (sel === "#stCodeDl" && st.main.includes('id="stCodeDl"') ? (st.dl = st.dl || { onclick: null }) : null);
    return node;
  };
  return {
    get innerHTML() {
      let out = st.shell;
      if (out.includes(SLOT)) out = out.replace(SLOT, '<div class="st-code-rows">' + st.rows + "</div>");
      if (out.includes(MAIN)) out = out.replace(MAIN, '<div class="st-code-main">' + st.main + "</div>");
      return out;
    },
    // EVERY ASSIGNMENT IS COUNTED. Writing here is what puts a brand-new
    // `.st-code` into the document and re-runs its entrance animation, so "the
    // panel was not rebuilt" is exactly "this setter did not run again".
    set innerHTML(v) { st.shell = String(v); st.rows = ""; st.main = ""; st.dl = null; st.draws += 1; },
    get draws() { return st.draws; },
    // The shell as `drawSiteCode` wrote it, with neither column spliced in — so
    // a case can ask whether it carries markup a painter also owns.
    get shell() { return st.shell; },
    // What the two nodes beside the rows were told, so a case can read the count
    // line and the clear button's class without a stylesheet.
    get said() { return st.said; },
    get filtering() { return st.on; },
    get dl() { return st.dl; },
    querySelector: (sel) => (sel === ".st-code-rows" ? text("rows")
      : sel === ".st-code-main" ? column()
      : sel === ".st-find-said" ? text("said")
      : sel === ".st-code-find" ? { classList: { toggle: (c, v) => { st.on = !!v; } } }
      : null),
    querySelectorAll: (sel) => ask(st.shell + st.rows + st.main, sel),
  };
}

/**
 * The real Code tab, out of the file, with a fake document.
 *
 * Same reason as the downloader: `siteCodeOpen` is a module-level `let` that
 * survives renders, and which file is open across a rebuild is exactly what is
 * being asked.
 */
function codeTab({ answer, open = "", slug = "fretwork-1", fail = false, groups = null, find = "", bind, host, save } = {}) {
  // BOTH HALVES, because they are one hop. `loadSiteCode` fetches and hands the
  // answer to `drawSiteCode`, which draws and wires; carrying only the first
  // would drive a function whose whole body is now one call.
  const body = fn("async function loadSiteCode(site)") + "\n" + fn("function drawSiteCode(src)");
  host = host || codeHost(bind);
  // THE SEARCH FIELD AND ITS CLEAR, as the two nodes `drawSiteCode` looks up by
  // id. `focus()` counts rather than no-ops, because "clearing puts the caret
  // back in the box" is a decision and a stub that swallowed it would leave the
  // case asserting nothing.
  const input = { value: find, focused: 0, focus() { this.focused += 1; }, oninput: null, onkeydown: null };
  const clear = { onclick: null };
  const els = { stCode: host, stCodeFind: input, stCodeFindX: clear };
  const make = new Function("deps", [
    "const { document, apiFetch, stSrcFiles, stCodeTree, stOpenGroups, esc, ic, stSaveBlob } = deps;",
    "const { stCodeFind, stFindBox, stFindSaid, stFindNone } = deps;",
    "const { ST_ROW_ACTS, stRowMenuHtml, stRowMenuAct, sbToast, stCodeFileHtml } = deps;",
    "let siteCodeFiles = []; let siteCodeOpen = deps.open; let siteCodeOpenGroups = deps.groups;",
    "let siteCodeFind = deps.find;",
    body,
    "return { run: loadSiteCode, draw: drawSiteCode,",
    "  get open() { return siteCodeOpen; }, get files() { return siteCodeFiles; },",
    "  get groups() { return siteCodeOpenGroups; }, get find() { return siteCodeFind; } };",
  ].join("\n"));
  let asked = 0;
  const t = make({
    open,
    groups,
    find,
    // `Object.hasOwn`, never truthiness — `els["constructor"]` is a function and
    // would be handed back as an element. The recorded trap, in a fake.
    document: { getElementById: (id) => (Object.hasOwn(els, id) ? els[id] : null) },
    apiFetch: async () => {
      asked += 1;
      if (fail) throw new Error("offline");
      return { ok: true, json: async () => answer };
    },
    // A STUB, and the only thing it owes `loadSiteCode` is the SHAPE that
    // function consumes — `{name, text, kind, note}`. `stSrcFiles` itself is
    // driven whole, against its real inputs, further up this file; what is under
    // test here is the tab that reads its answer. It forwards `note` and `kind`,
    // because a stub that flattened either would leave the cases below passing
    // on a shape the real producer never makes.
    stSrcFiles: (s) => {
      const out = [];
      for (const p of (s.pages || []).concat(s.parts || [])) out.push({ name: p.path || p.name, text: p.source, kind: "page", note: "" });
      for (const a of (s.assets || [])) out.push({ name: a.path, text: a.source, kind: "asset", note: a.note || "" });
      return out;
    },
    // THE REAL TREE RENDERER AND ITS FOLD READER, carried out of the file rather
    // than stubbed. `drawSiteCode` closes over both, so a bare scope throws
    // `stCodeTree is not defined` for a function that is perfectly correct —
    // this repository's recorded free-identifier trap, and the reason every name
    // a driven function reaches for comes from the FILE. A stub answering "" for
    // every shape would leave the case passing for the wrong reason.
    ...TREE,
    esc: escFake, ic: () => "", stSaveBlob: save || (() => {}),
  });
  return { t, host, input, clear, site: { slug }, fetches: () => asked };
}
// THE WHOLE RENDERER, carried out of the file: the tree builder, the collapse
// rule, the counter, the fold reader and the two row writers. Stubbing any one
// of them would leave a case passing against a rule this file did not write —
// and the collapse rule in particular is asked in two places (the renderer and
// the default-open chain), so a stub would hide exactly the drift it exists to
// prevent.
//
// RE-ANCHORED 2026-09-12, not appeased: `stDirTree` now calls `stSortTree` and
// `stCodeRows` calls `stFileIcon`, so this scope threw `stSortTree is not
// defined` for two functions that are perfectly correct — the free-identifier
// trap this comment already warns about, arriving through the door it describes.
// The property has not moved; the renderer has two more parts and they are
// carried like the rest.
const TREE = new Function("esc", "ic", "ST_CODE_GROUPS", [
  konst("ST_FIND_MAX"), konst("ST_ALL_OPEN"),
  fn("function stDirTree("), fn("function stSortTree("), fn("function stCollapse("),
  fn("function stDirCount("), fn("function stFileIcon("), fn("function stCodeFind("),
  fn("function stOpenGroups("), fn("function stFoldRow("), fn("function stCodeRows("),
  fn("function stCodeTree("), fn("function stFindBox("), fn("function stFindSaid("),
  fn("function stCodeFileHtml("),
  fn("function stFindNone("),
  konstBlock("ST_ROW_ACTS", "];"), fn("function stRowMenuHtml("), fn("function stRowMenuAct("),
  "return { stDirTree, stSortTree, stFileIcon, stCollapse, stDirCount, stOpenGroups, stCodeTree,",
  "  stCodeFileHtml,",
  "  stCodeFind, stFindBox, stFindSaid, stFindNone, ST_FIND_MAX,",
  "  ST_ROW_ACTS, stRowMenuHtml, stRowMenuAct };",
].join("\n"))(
  // AND `ic` ECHOES ITS NAME rather than answering "". It used to return the
  // empty string, which was fine while every row asked for the same glyph and
  // is a blindfold now that the icon is a DECISION: a case cannot assert which
  // icon a file got against a stub that draws none. The real `ic` emits an
  // <svg>; this emits the name it was asked for, which is the part under test.
  escFake, (n) => '<i data-ic="' + n + '"></i>',
  [["page", "Pages"], ["part", "Components"], ["asset", "Made by the build"], ["shared", "Shared with every site"]]);

const PAGES = (names) => ({ ok: true, pages: names.map((n) => ({ path: n, source: "// " + n + "\n" })) });

test("DRIVEN: the Code tab keeps the open file by NAME across a rebuild", async () => {
  const three = ["src/routes/index.tsx", "src/routes/menu.tsx", "src/routes/prices.tsx"];
  const a = codeTab({ answer: PAGES(three), open: "src/routes/prices.tsx" });
  await a.t.run(a.site);
  assert.equal(a.t.open, "src/routes/prices.tsx", "the file that was open is not the one shown");
  assert.match(a.host.innerHTML, /data-srcname="src\/routes\/prices\.tsx"/);
  assert.match(a.host.innerHTML, /class="st-file on" data-srcname="src\/routes\/prices\.tsx"/,
    "the open file is not the one marked open in the tree");

  // THE FAILURE THE NAME IS FOR. A rebuild adds or drops a part, so the file at
  // any given index is not the file that was there before — and the customer's
  // chosen file would silently become somebody else's.
  const b = codeTab({ answer: PAGES(["src/routes/-parts/new-band.tsx"].concat(three)), open: "src/routes/prices.tsx" });
  await b.t.run(b.site);
  assert.equal(b.t.open, "src/routes/prices.tsx",
    "a rebuild that added a file changed which file was open — the choice is kept by index, not by name");

  // AND A NAME THE SITE NO LONGER HAS FALLS BACK to the first file rather than
  // rendering an empty pane.
  const c = codeTab({ answer: PAGES(three), open: "src/routes/gone.tsx" });
  await c.t.run(c.site);
  assert.equal(c.t.open, three[0]);
  // THE OBSERVER IS ALIVE: the tree really holds every file, so the assertions
  // above are about a choice among several rather than about a list of one.
  for (const n of three) assert.ok(c.host.innerHTML.includes('data-srcname="' + n + '"'), n + " is missing from the tree");
});

test("DRIVEN: every way the tab can come up empty says WHICH empty it is", async () => {
  const nothing = codeTab({ answer: { ok: true, pages: [], parts: [], why: "nothing stored — this site has not published a build yet" } });
  await nothing.t.run(nothing.site);
  assert.match(nothing.host.innerHTML, /has not published a build yet/, "the server's own reason is not shown");
  assert.ok(!nothing.host.innerHTML.includes("st-code-tree"), "an empty two-pane editor was drawn over nothing");

  const dead = codeTab({ fail: true });
  await dead.t.run(dead.site);
  assert.match(dead.host.innerHTML, /Couldn’t read your code/, "a failed read draws no sentence");

  const noSlug = codeTab({ answer: PAGES(["src/routes/index.tsx"]), slug: "" });
  await noSlug.t.run(noSlug.site);
  assert.match(noSlug.host.innerHTML, /no address yet/);
});

test("DRIVEN: the READ ONLY pill is gone, and a file that needs a sentence gets one", async () => {
  // (1) THE PILL IS DELETED, ON PURPOSE (owner, 2026-09-12: "delete the thing
  // that says read only"), and this case is INVERTED rather than removed. It used
  // to assert the label was drawn, on the reasoning that a panel nobody can type
  // in should say so; the owner's call is that it was worth less than the space.
  // The absence is asserted so it cannot drift back in unnoticed, and the two
  // halves below prove the OBSERVER is alive — a bar that stopped being drawn at
  // all would satisfy an absence check by accident.
  const a = codeTab({ answer: PAGES(["src/routes/index.tsx"]) });
  await a.t.run(a.site);
  // THE CLASSES IN FULL, WITH THEIR QUOTES — a sweep survivor. `st-code-bar` is
  // a PREFIX of anything starting with it, so a renamed bar satisfied the bare
  // substring and the observer read as alive over a panel that had lost it. The
  // same trap as the pill's own check three lines down, met twice in one test.
  assert.ok(a.host.innerHTML.includes('class="st-code-bar"'), "the bar is gone, so the next assertion is measuring nothing");
  assert.ok(a.host.innerHTML.includes('class="st-code-fname"'), "the bar no longer names the open file");
  assert.ok(a.host.innerHTML.includes(">src/routes/index.tsx<"), "the bar draws no filename");
  // THE CLASS IN FULL, WITH ITS QUOTE. `st-code-ro` is a PREFIX of
  // `st-code-rows`, the search box's own row list, so the bare substring is in
  // every draw and this assertion failed on its first run against a panel with
  // no pill in it — the recorded "prose contains the thing it forbids", in
  // markup rather than in a comment.
  assert.ok(!/class="st-code-ro"/.test(a.host.innerHTML), "the READ ONLY pill is back");
  assert.ok(!/Read only/i.test(a.host.innerHTML), "the bar says read only again by another spelling");
  // AND NOTHING ABOUT THE PANEL'S BEHAVIOUR MOVED — only the sentence about it.
  // The code is still drawn into a <pre>, which is not typeable, and no editor
  // was wired in its place.
  assert.ok(a.host.innerHTML.includes("st-code-pre"), "the file is no longer drawn as a <pre>");
  assert.ok(!/contenteditable|<textarea/i.test(a.host.innerHTML), "the panel became editable, which is not what was asked");

  // (2) THE NOTE IS COMPUTED BY THE ROUTE AND HAS TO BE SHOWN. The site's
  // `src/styles.css` is the LAYER the build wrote over the template's base, not
  // the whole stylesheet — a customer reading it as the whole thing would find
  // most of their site's styling missing and report a bug we do not have. The
  // note is the only thing that says so, and `siteAssetFiles` sending one that
  // the tab drops is this repository's recorded "computed and never forwarded".
  const b = codeTab({
    answer: {
      ok: true,
      pages: [{ path: "src/routes/index.tsx", source: "// x\n" }],
      assets: [{ path: "src/styles.css", source: ":root{}", note: "the layer this build wrote over the shared base" }],
    },
    open: "src/styles.css",
  });
  await b.t.run(b.site);
  assert.match(b.host.innerHTML, /class="st-code-note">the layer this build wrote over the shared base</,
    "an asset's note was computed and never drawn — the stylesheet reads as the whole thing");

  // AND A FILE WITH NOTHING TO SAY GETS NO EMPTY BOX, because a bar of blank
  // space under every page reads as something that failed to load.
  const c = codeTab({ answer: PAGES(["src/routes/index.tsx"]) });
  await c.t.run(c.site);
  assert.ok(!c.host.innerHTML.includes("st-code-note"), "a file with no note was given an empty note box");
});

// ── THE TOP BAR: THE SAME CONTROLS, BUILT OR NOT ────────────────────────────

function topBar() {
  const at = BARE.indexOf('<div class="st-topbar">');
  assert.ok(at > 0, "the top bar is gone");
  const end = BARE.indexOf('<div class="st-body">', at);
  assert.ok(end > at, "the top bar has no end landmark — re-derive this window");
  return BARE.slice(at, end);
}

test("the Code tab and the Download are drawn whether or not the site has built", () => {
  const bar = topBar();
  // NEITHER IS GATED ON `isReact` ANY MORE, which was the whole defect: they
  // appeared only on the one screen where they had nothing to act on.
  assert.match(bar, /'<button type="button" class="st-vtab' \+ \(siteView === 'code' \? ' on' : ''\) \+ '" data-view="code">/,
    "the Code tab is gated again — the two screens can differ once more");
  assert.match(bar, /id="stDl"/, "the Download button is gone from the bar");
  assert.ok(!/isReact \? '' : '<button type="button" class="st-vtab' \+ \(siteView === 'code'/.test(bar),
    "the Code tab is hidden on a React site again");
  assert.ok(!/isReact \? '' : '<button type="button" class="st-icon" id="stDl"/.test(bar),
    "the Download is hidden on a React site again");
  // THE OBSERVER IS ALIVE: `isReact` still decides the two things it honestly
  // should — the Data tab (does this site have a database) and whether the
  // Download can act yet.
  assert.match(bar, /isReact && site\.backend/, "the Data tab no longer asks whether there is a database");
  assert.match(bar, /id="stDl"[\s\S]{0,400}?\(isReact \? '' : ' disabled'\)/,
    "the Download is not dimmed before the first build, so it is a control that lies");
});

// THE THIRD HOP, AND THE ONE THIS FILE SHIPPED BROKEN.
//
// Making Code real takes THREE hops: draw the tab, render the host, fetch into
// it. The two cases above guard the tab, and the case near the end of this file
// guards the loader — and nothing guarded the PANE, so `!isReact && siteView
// === 'code'` stayed on the branch that renders the host. `isReact` is true on
// every site that has ever built, so the branch was dead on every real site:
// the tab highlighted, the fetch fired, `loadSiteCode` found no `#stCode` and
// returned, and the chain fell through to the preview iframe. Found live on
// hartleys-barbers by the owner, a day after this shipped — a guard that proves
// the door and the delivery and never the room they open onto.
test("the Code PANE is reachable on a built site, and its host is the one the loader fills", () => {
  const at = BARE.indexOf("? siteCodeView(site)");
  assert.ok(at > 0, "the Code pane's branch is gone — nothing renders the code host");
  // The branch's own condition, back to the `:` that introduces it.
  const from = BARE.lastIndexOf(":", BARE.lastIndexOf("(", at));
  const cond = BARE.slice(from, at);
  // RE-ANCHORED 2026-09-09: this pinned `siteView === 'code'`. The stage's chain
  // reads a view resolved ONCE now (`stStageView`), because the mobile app
  // column had to be gated on what the stage is SHOWING and two readings of that
  // would drift. The property here is untouched — the pane keys on the view and
  // on nothing else — so it asks for the resolved name, and asserts that name is
  // really derived from `siteView` rather than being some other variable that
  // happens to fit.
  assert.ok(/stageView === 'code'/.test(cond), "the Code pane no longer keys on the view");
  assert.match(BARE, /const stageView = stStageView\(siteView,/,
    "`stageView` is not the resolved `siteView` any more, so the check above proves nothing about the view");
  assert.ok(!/isReact/.test(cond),
    "the Code pane is gated on `isReact` again — it is FALSE on every built site, " +
    "so Code would highlight the tab and render the preview, which is the live defect");

  // TWO LISTS OF THE SAME THING: the id the pane renders and the id the loader
  // looks up. Derived from each, never typed here — a rename in one place is
  // exactly how this hop goes quiet again, and `loadSiteCode` returns early on
  // a miss, so a drift would be silent in precisely the same way.
  const paneId = /id="([^"]+)"/.exec(
    BARE.slice(BARE.indexOf("function siteCodeView"), BARE.indexOf("async function loadSiteCode")),
  );
  const loaderId = /getElementById\('([^']+)'\)/.exec(
    BARE.slice(BARE.indexOf("async function loadSiteCode")),
  );
  assert.ok(paneId && loaderId, "could not read the host id from both halves — re-derive this check");
  assert.equal(paneId[1], loaderId[1],
    "the pane renders one id and the loader fills another, so the fetch lands nowhere");

  // AND THE EMPTY STATE IS STILL THE FUNCTION'S OWN. Dropping the outer gate is
  // only safe because `siteCodeView` asks the same question itself; without
  // this, a project that has never built would render a host nothing fills.
  const view = BARE.slice(BARE.indexOf("function siteCodeView"), BARE.indexOf("async function loadSiteCode"));
  assert.match(view, /site\.react && site\.url/,
    "siteCodeView no longer decides emptiness itself, and the pane now has no gate at all");
});

test("Publish is gone, and the panel it opened is kept with the way back", () => {
  const bar = topBar();
  assert.ok(!/id="stPub"/.test(bar), "the Publish button is back on the bar");
  assert.ok(!/st-publish/.test(bar), "a publish button is drawn in the top bar");
  assert.ok(!/getElementById\('stPub'\)/.test(BARE), "the Publish handler outlived its button");
  // THE OBSERVER IS ALIVE. Share is the control that stayed, and its two
  // neighbours are still drawn — so this is an absence beside three presences,
  // not an assertion about a bar that was deleted.
  assert.match(bar, /id="stShare"/, "Share went too");
  assert.match(bar, /class="st-devs"/, "the device sizes went too");
  assert.match(bar, /id="stReload"/, "the refresh went too");
  // THE PANEL IS KEPT, the way `gif` and the effort dial were kept: it is the
  // only door to taking a site off the web, and that door had already been shut
  // on every real site by the `isReact` gate. Deleting the mechanism as well
  // would make putting it back a rewrite rather than a call site.
  assert.match(BARE, /function sitePublishPanel\(site\)/, "the publish panel was deleted with its button");
  assert.match(BARE, /function siteSetLive\(site, live\)/, "taking a site offline was deleted with the button");
  // AND IT HAS A DOOR AGAIN (2026-09-08, owner: "add the card").
  //
  // WHICH SPELLING MOVED: this last line pinned the note that said how to give
  // the panel a door — "add a Cloud card beside Submissions and Members that
  // calls…". That note was an instruction, and it has been carried out, so
  // pinning its wording would now hold the file to a to-do that is done.
  //
  // THE PROPERTY WAS NEVER THE NOTE. It was that removing Publish must not
  // strand the mechanism behind it, and a real call site satisfies that far
  // better than a comment describing one. Asserted here as reachability;
  // `test/visibility-card.test.mjs` holds the card itself.
  assert.match(BARE, /b\.dataset\.cloud === 'visibility'\) sitePublishPanel\(site\)/,
    "the panel is orphaned again — Publish is gone and nothing else opens it");
});

test("the Code tab's empty state says WHICH empty it is", () => {
  const view = fn("function siteCodeView(site)");
  // A tab that opens onto a blank editor is the dead control this app has found
  // four times in its own chrome. A sentence naming what is missing is not.
  assert.match(view, /appears here once the first draft is built/,
    "an unbuilt project gets an empty editor again");
  assert.match(view, /site\.react && site\.url/, "the empty state no longer asks whether the site has built");
  assert.match(view, /id="stCode"/, "the host the fetch fills is gone");
  assert.ok(!/st-code-tree/.test(view), "the tree is drawn before the source has been read");
});

test("the source is fetched once the host is on the page, and the download asks for itself", () => {
  // THE HOOK. Cutting this leaves `loadSiteCode` perfect and the tab
  // permanently on 'Loading your code…' — the wiring trap, which is how the
  // progress panel and the picker both shipped.
  assert.match(BARE, /if \(isReact && siteView === 'code'\) loadSiteCode\(site\);/,
    "nothing fills the Code tab — it will sit on its loading line for ever");
  // THE FETCH HAS EXACTLY TWO MENTIONS: itself, and the render hook above. It
  // used to have three, the third being the file picker's redraw — which went
  // back through the network to change which file was highlighted. Being three
  // was never the property; being the only thing that ASKS THE SERVER is, and
  // that is what makes the count worth keeping now rather than before.
  const calls = [...BARE.matchAll(/loadSiteCode\(/g)];
  assert.equal(calls.length, 2, "expected the definition and the render hook; found " + calls.length);
  // AND THE REDRAW NEVER FETCHES. A fold and a file pick are display changes, so
  // a blip on a re-fetch must not be able to replace the panel with "couldn't
  // read your code just now" — which is what routing either back through
  // `loadSiteCode` would do. Both handlers redraw from the answer in hand.
  const draw = fn("function drawSiteCode(src)");
  assert.ok(draw.length > 800, "re-derive the draw function's window");
  assert.ok(!/loadSiteCode\(/.test(draw), "a click in the Code tab goes back to the network");
  // RE-ANCHORED 2026-09-12, not appeased. This asked each handler for
  // `drawSiteCode(src)` by name, and that spelling moved for a reason: rebuilding
  // the panel re-ran the entrance animation `styles.css` puts on `.st-code`, so
  // every click made the whole thing drop 8px and fade (measured; see
  // `stCodeFileHtml`). What is being asserted has not changed — a click REDRAWS
  // FROM THE ANSWER IN HAND rather than going back to the network — so each
  // handler is now asked for the painter it calls instead. `paintTree` is on both
  // because a fold and a file pick both change which rows are drawn.
  for (const [what, attr, paints] of [
    ["the file picker", "data-srcname", /paintFile\(\);[\s\S]{0,40}paintTree\(\)/],
    ["the folder", "data-srcfold", /paintTree\(\)/],
  ]) {
    const at = draw.indexOf("[" + attr + "]");
    assert.ok(at > 0, what + " is no longer wired");
    assert.match(draw.slice(at, at + 900), paints, what + " does not redraw");
  }

  // THE DOWNLOAD FETCHES RATHER THAN READING THE TAB'S CACHE ALONE. A customer
  // may press it having never opened Code; reading the cache alone makes the
  // button work or not depending on where they clicked first.
  const dl = BARE.slice(BARE.indexOf("const dl = document.getElementById('stDl');"));
  const body = dl.slice(0, dl.indexOf("\n  };") + 5);
  assert.ok(body.length > 200, "re-derive the download handler's window");
  assert.match(body, /apiFetch\('\/api\/site\/source\?slug='/, "the download cannot get the source on its own");
  assert.match(body, /SiteZip\.zipFiles\(files\)/, "the download no longer writes a zip");
  assert.match(body, /No code stored for this site yet/, "an empty archive ships instead of a sentence");
  assert.ok(!/curHtml/.test(body), "the download still writes the static-site era's stored HTML");
  // AND THE ZIP IS LOADED BEFORE THE SCRIPT THAT USES IT.
  const html = read("../public/index.html");
  const zipAt = html.indexOf('src="/site-zip.js"');
  const chatAt = html.indexOf('src="/chat.js"');
  assert.ok(zipAt > 0, "site-zip.js is never loaded, so the download throws on the first press");
  assert.ok(zipAt < chatAt, "site-zip.js loads after chat.js");
});

test("ONE saver, so the two downloads cannot drift", () => {
  // The tab's per-file Download and the bar's whole-site zip both reach the
  // disk through `stSaveBlob`. Two copies of "make a blob URL, click a link,
  // revoke it" is the recorded 'two lists of the same thing', and the half that
  // drifts is the revoke — a leak nobody sees.
  assert.match(BARE, /function stSaveBlob\(blob, filename\)/, "the one saver is gone");
  // A FLOOR, NOT A COUNT — re-anchored 2026-09-12, not appeased. This read
  // `=== 3` (the definition and the two downloads) and went red the moment the
  // row menu added an HONEST third caller, reporting a feature as broken that
  // was working: the recorded "assert the property, not the spelling", in its
  // counting form. The property was never how MANY callers there are; it is that
  // every one of them reaches the disk through this function and none writes its
  // own blob-click-revoke. The floor keeps the observer alive, and the windows
  // below are where the real assertion lives.
  const uses = [...BARE.matchAll(/stSaveBlob\(/g)];
  assert.ok(uses.length >= 3, "the definition and at least two downloads; found " + uses.length);
  assert.match(fn("function stSaveBlob(blob, filename)"), /revokeObjectURL/, "the blob URL is never revoked");
  // SCOPED TO THE TWO HANDLERS, not the file. The media side mints blob URLs all
  // over `chat.js` for generated images and video, and a whole-file count would
  // flag every one of them — a check that reports correct code, which this
  // repository's own rule says is worse than no check. The property is that
  // NEITHER site download writes its own copy of "blob, click, revoke".
  const dlBody = BARE.slice(BARE.indexOf("const dl = document.getElementById('stDl');"));
  const barDl = dlBody.slice(0, dlBody.indexOf("\n  };") + 5);
  // The tab's per-file download moved with the rest of the drawing when the
  // fetch and the draw were split; which function holds it was never the
  // property, reaching the disk through the one saver is.
  const tabDl = fn("function drawSiteCode(src)");
  assert.ok(barDl.length > 200 && tabDl.length > 400, "re-derive these two windows");
  // The row menu's Download is the third, and it reaches the disk the same way —
  // through the deps handed to `stRowMenuAct`, which is where its `save` comes
  // from. Windowed on the decision rather than the handler, since the menu's own
  // function must never touch a blob at all.
  const rowAct = fn("function stRowMenuAct(act, file, deps)");
  for (const [what, body] of [["the top bar's zip", barDl], ["the tab's per-file download", tabDl], ["the row menu's download", tabDl]]) {
    assert.ok(!/createObjectURL/.test(body), what + " makes its own blob URL instead of using the saver");
    assert.match(body, /stSaveBlob\(/, what + " no longer reaches the disk through the one saver");
  }
  assert.ok(!/createObjectURL|stSaveBlob/.test(rowAct),
    "the row menu's decision reaches the disk itself instead of through the `save` dep it is handed — which also makes it undrivable");
  assert.match(tabDl, /save: \(t, n\) => stSaveBlob\(/, "the row menu's `save` dep is not the one saver");
});

test("the Code host fills its stage, and the file tree keeps its scroll", () => {
  // A sweep took the `opacity` off a disabled card icon once and every markup
  // assertion stayed green. The same shape here: without this the two-pane
  // editor collapses to its content and the tree stops scrolling, which no
  // assertion about the markup can see.
  assert.match(CSS, /\.st-codewrap \{[^}]*flex: 1[^}]*min-height: 0/, "the code host has no layout");
  assert.match(CSS, /\.st-codewrap > \* \{[^}]*flex: 1/, "what the host holds does not fill it");
  // THE OBSERVER IS ALIVE: the editor it holds still has its own rules.
  assert.match(CSS, /\.st-code \{[^}]*height: 100%/, "the editor lost its height");
  // THE SCROLL MOVED OFF `.st-code-tree` AND THE PROPERTY DID NOT (2026-09-12).
  // This read `\.st-code-tree \{[^}]*overflow-y: auto`, which went red for the
  // search box: the column is a fixed head over a scroller now, because a box
  // that must stay put cannot live inside the thing that scrolls past it. The
  // property was never "that selector carries overflow" — it is that the rows
  // scroll INSIDE a column that does not, so the head stays and the panel never
  // grows a second scrollbar. Both halves asserted, since either alone passes on
  // a column that scrolls as a whole.
  assert.match(CSS, /\.st-code-rows \{[^}]*overflow-y: auto/, "the file tree lost its scroll");
  assert.match(CSS, /\.st-code-rows \{[^}]*min-height: 0/, "the scroller cannot shrink, so the whole column scrolls instead");
  assert.match(CSS, /\.st-code-tree \{[^}]*min-height: 0/, "the tree column cannot bound its scroller");
  assert.ok(!/\.st-code-tree \{[^}]*overflow-y: auto/.test(CSS),
    "the column scrolls as well as its rows — the search box scrolls away with them");

  // AND THE COLUMN MUST NOT GROW TO FIT ITS WIDEST ROW (owner, 2026-09-12:
  // "everytime i click it the screen vibrates"). `flex: 0 0 210px` sets only the
  // BASIS; a flex item's automatic minimum size (`min-width: auto`) then refuses
  // to shrink it below its widest row's min-content width, so opening a folder
  // with a long label widened the column and shut it narrowed it again — moving
  // the editor beside it sideways on every click.
  //
  // IT WAS FREE UNTIL THE SEARCH BOX AND SO NOBODY WROTE IT DOWN: this rule
  // carried `overflow-y: auto`, and any overflow but `visible` makes that
  // automatic minimum ZERO. Moving the scroll to `.st-code-rows` took the floor
  // with it — the recorded "a rule true because of a layer below it expires when
  // that layer moves", and the width was true BECAUSE of the overflow.
  // MEASURED in a real browser over seven fold states: 193px throughout before
  // the search box, then 209px or 224px depending on which folders were open,
  // and constant again with this line. Both halves asserted, because the basis
  // alone is what looks sufficient and is not.
  const col = CSS.slice(CSS.indexOf(".st-code-tree {"), CSS.indexOf("}", CSS.indexOf(".st-code-tree {")));
  assert.ok(col.includes(".st-code-tree {"), "the tree column rule is gone");
  assert.match(col, /flex: 0 0 210px/, "the column lost its fixed basis");
  assert.match(col, /min-width: 0/,
    "the column can grow to its widest row again — every fold click moves the editor beside it");

  // AND EVERY SCROLLING BOX IN THE PANEL RESERVES ITS SCROLLBAR'S LANE (owner on
  // WINDOWS, 2026-09-12, the THIRD report of the same symptom on this panel).
  // Folding a group is precisely what changes the rows box's height, so it is
  // precisely what makes the scrollbar appear and disappear — measured across
  // the real fold states: open PAGES and it scrolls, fold it and it fits, open
  // `shared/src` and it scrolls again. On Windows that bar is CLASSIC and takes
  // ~17px out of the CONTENT box, so in a 210px column every file name jumps
  // sideways on every click.
  //
  // THIS IS THE ONE PROPERTY ON THIS PANEL THE RENDER CANNOT PROVE. Headless
  // Chromium uses OVERLAY scrollbars, which take no width, so a render reads 0px
  // whether the column is steady or jumping — the recorded "a negative assertion
  // must prove its observer is alive", pointed at a browser. So the SHEET is the
  // assertion, and it is derived: every box in the panel that scrolls must carry
  // the gutter, found by walking the rules rather than naming today's two.
  const scrollers = [...CSS.matchAll(/\.(st-code-[a-z-]+) \{([^}]*)\}/g)]
    .filter((m) => /overflow(-[xy])?: auto/.test(m[2]));
  assert.ok(scrollers.length >= 2,
    "found " + scrollers.length + " scrolling boxes in the panel — the scan is not finding them, so what follows proves nothing");
  for (const [, name, body] of scrollers) {
    const gutter = body.match(/scrollbar-gutter:\s*([^;]+);/);
    assert.ok(gutter,
      "`." + name + "` scrolls without reserving the scrollbar's lane — on Windows its contents jump sideways every time it crosses between fitting and scrolling");
    // ONE LANE, ON THE END SIDE. `stable both-edges` reserves a second lane at
    // the start as well, which is ~17px more taken out of a 210px column for
    // nothing — it stops the jump and costs a fifth of the tree's width, so the
    // value is asserted rather than its prefix.
    assert.equal(gutter[1].trim(), "stable",
      "`." + name + "` reserves its gutter as `" + gutter[1].trim() + "` — a second lane the panel has no room for");
  }
});

// ── THE WHOLE PROJECT, NOT TWO FILES ────────────────────────────────────────
//
// Owner, 2026-09-11, holding our explorer beside Lovable's: *"we do have a
// favicon but it doesnt show in the code tab"*. It did not, and the reason was
// that this route read two R2 objects and nothing else — while the favicon had
// been sitting in `config/<slug>.json` as the SVG text the model drew, carried
// into every version's `state/config.json`, and served at `/icon.svg`, for as
// long as the favicon step has existed.

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#104148"/></svg>';
const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32"><text x="0" y="24">SKC</text></svg>';

test("DRIVEN: the favicon the build drew reaches the explorer, out of what was already stored", async () => {
  const r = await callSource({
    pages: [{ path: "index.tsx", source: "<h1>Saltmarsh</h1>" }],
    config: { look: { favicon: { form: "svg", svg: ICON }, wordmark: { form: "svg", svg: MARK } } },
  });
  assert.equal(r.status, 200);
  const at = (p) => r.body.assets.find((a) => a.path === p);
  // THE PATH IS THE CONTAINER'S OWN (`build-server.mjs` writes `public/icon.svg`),
  // because a tree with different names in it is a drawing of a project rather
  // than the project.
  assert.ok(at("public/icon.svg"), "the favicon is still missing from the explorer");
  assert.ok(at("public/logo.svg"), "the drawn wordmark is missing");
  // THE BYTES SHOWN ARE THE BYTES WRITTEN, and that is a stronger claim than
  // "what was stored". Both the explorer and `writeSiteBrand` read the mark
  // through `cleanFavicon`/`cleanWordmark`, which normalise — a favicon is
  // forced square — so the file on disk is not the raw stored string and
  // asserting against the raw string would pin the explorer to something the
  // project has not got. Derived from the real producers rather than typed.
  assert.equal(at("public/icon.svg").source, cleanFavicon(ICON).svg, "the favicon shown is not the one the build writes");
  assert.equal(at("public/logo.svg").source, readWordmark(MARK).svg, "the wordmark shown is not the one the build writes");
  // AND NOT ONE NEW BYTE WAS STORED FOR IT. Every read this route makes is a
  // read; a write here would be a second copy of a customer's own artwork.
  assert.ok(r.reads.some((k) => k.startsWith("config/")), "the config was never read");
});

test("DRIVEN: a code is drawn by the same function the build draws it with", async () => {
  // A STORED PICTURE WAS REFUSED ON PURPOSE — it would be a second copy of
  // `points` that can disagree with it — so the explorer re-derives, and it must
  // re-derive through `qrSvg` rather than a second renderer's opinion.
  const points = "https://saltmarsh-kayak-co-2.gofarther.app/tides";
  const r = await callSource({
    pages: [{ path: "index.tsx", source: "x" }],
    config: { look: { qr: [{ name: "tides", points, label: "Scan for tides" }] } },
  });
  const drawn = r.body.assets.find((a) => a.path === "public/qr-tides.svg");
  assert.ok(drawn, "a stored code produced no file");
  assert.equal(drawn.source, qrSvg(points).svg, "the code shown is not the code served");
});

test("DRIVEN: the site's own stylesheet is shown, and says what it is", async () => {
  const css = ".hero { letter-spacing: -0.02em; }";
  const r = await callSource({ pages: [{ path: "index.tsx", source: "x" }], config: { css } });
  const sheet = r.body.assets.find((a) => a.path === "src/styles.css");
  assert.ok(sheet, "the site's stylesheet is missing");
  assert.equal(sheet.source, css);
  // IT IS A LAYER, NOT THE WHOLE FILE, and the note is what keeps that honest:
  // the served sheet is the shared base, then the theme, then this. Showing a
  // third of a file as all of it would be the instrument lying.
  assert.match(sheet.note || "", /theme/i, "the partial stylesheet is shown as if it were the whole file");
});

test("DRIVEN: a site with no marks and no stylesheet has no assets, not empty ones", async () => {
  // An empty file in a tree reads as a file the build made and did not fill.
  const r = await callSource({ pages: [{ path: "index.tsx", source: "x" }], config: { look: { theme: "slate" } } });
  assert.deepEqual(r.body.assets, [], "a site with nothing drawn was given files anyway");
});

test("DRIVEN: an UPLOADED mark is not a file — only a drawing is", async () => {
  // A MARK HAS THREE FORMS and only one of them is bytes we hold. `{form:"svg"}`
  // is a drawing the model made and the container writes to `public/`;
  // `{form:"image", url}` is a picture the customer UPLOADED, which lives at
  // that URL and for which the build writes no file at all. Showing one here
  // would invent a path the project has not got — and, worse, would put a URL
  // string in the pane where a customer expects the file's contents, and in the
  // download where they expect an image.
  //
  // THE SWEEP FOUND THIS UNDRIVEN: nothing here had ever handed the route an
  // uploaded mark, so a reader that took `m.url` as the source passed.
  const r = await callSource({
    pages: [{ path: "index.tsx", source: "x" }],
    config: {
      look: {
        favicon: { form: "image", url: "https://gofarther.dev/u/u-owner/icon.png" },
        wordmark: { form: "image", url: "https://gofarther.dev/u/u-owner/logo.png" },
      },
    },
  });
  assert.deepEqual(r.body.assets, [],
    "an uploaded mark was shown as a file: " + JSON.stringify(r.body.assets));
  // AND `{form:"text"}` IS NOT A FILE EITHER — the wordmark is then the brand
  // name set in type by the page, with nothing written to `public/`.
  const t = await callSource({
    pages: [{ path: "index.tsx", source: "x" }],
    config: { look: { wordmark: { form: "text" }, favicon: { form: "initials" } } },
  });
  assert.deepEqual(t.body.assets, [], "a mark with no drawing behind it was given a file");
  // THE OBSERVER IS ALIVE: the same route, the same shape of config, a DRAWING
  // in it — and two files come back. Without this the case above passes for a
  // route that answers `[]` to everything.
  const drawn = await callSource({
    pages: [{ path: "index.tsx", source: "x" }],
    config: { look: { favicon: { form: "svg", svg: ICON }, wordmark: { form: "svg", svg: MARK } } },
  });
  assert.deepEqual(drawn.body.assets.map((a) => a.path), ["public/icon.svg", "public/logo.svg"]);
});

test("DRIVEN: a config that could not be read loses the assets and never the source", async () => {
  // CANNOT-TELL IS NO ASSETS, NEVER A FAILED REQUEST. The source is the half the
  // customer came for, and losing the tree because a second read blipped is the
  // worse answer by a distance.
  const r = await callSource({ pages: [{ path: "index.tsx", source: "<h1>Saltmarsh</h1>" }], configFails: true });
  assert.equal(r.status, 200, "a blipped config read took the whole explorer down");
  assert.deepEqual(r.body.pages.map((p) => p.path), ["index.tsx"]);
  assert.deepEqual(r.body.assets, []);
});

test("DRIVEN: the shared foundation rides along, marked apart from the site's own files", async () => {
  const r = await callSource({ pages: [{ path: "index.tsx", source: "x" }] });
  const shared = r.body.shared.map((f) => f.path);
  // THE SCAFFOLD A CUSTOMER'S PROJECT IS BUILT FROM — the entry points, the root
  // route, the data layer and the configuration.
  for (const need of ["src/router.tsx", "src/server.ts", "src/routes/__root.tsx", "src/lib/rows.ts", "package.json", "vite.config.ts"]) {
    assert.ok(shared.includes(need), "the shared foundation is missing " + need);
  }
  for (const f of r.body.shared) assert.ok(typeof f.source === "string" && f.source.length, f.path + " came through empty");
  // NEVER THE KIT, and never a compiled bundle. 3,394 files and 9.5 MB is a
  // dependency, not a customer's project — and it would be in every isolate.
  assert.ok(!shared.some((p) => p.startsWith("src/components/")), "the kit was dumped into the tree");
  assert.ok(!shared.some((p) => p.includes("assets/") || p.endsWith(".map")), "a compiled bundle reached the tree");
  // NEVER THE TEMPLATE'S DEMO ROUTES: the image deletes them, so they are in no
  // generated site and showing one is showing a file that is not there.
  for (const gone of ["src/routes/index.tsx", "src/routes/book.tsx", "src/routes/account.tsx", "src/routes/manage.tsx"]) {
    assert.ok(!shared.includes(gone), "a demo route the image deletes is shown as part of the project: " + gone);
  }
  // AND NOT `site-brand.ts`: the template's copy is a stub the container
  // overwrites per build, so a shared copy is the one entry that would mislead.
  assert.ok(!shared.includes("src/site-brand.ts"), "the stub site-brand.ts is shown as a shared file");
  // THE TWO HALVES STAY APART IN THE ANSWER rather than being flagged inside one
  // list: a platform file and a customer's own file are different things, and a
  // boolean on a row is a distinction one careless reader drops.
  assert.ok(!r.body.pages.some((p) => shared.includes(p.path)), "a shared file was served as one of the site's pages");
});

test("DRIVEN: a site with components and no pages is not told it has nothing", async () => {
  // The sentence keyed on `pages.length` alone, so this shape got a `why` that
  // was false — and the browser, seeing files, never showed it. The real gap it
  // leaves is the other way round: a store with parts in it reading as empty.
  const r = await callSource({ parts: [{ name: "tide-window-chart", source: "export default () => null;" }] });
  assert.equal(r.status, 200);
  assert.equal(r.body.why, undefined, "a site whose components are stored was told nothing is stored");
  assert.deepEqual(r.body.parts.map((p) => p.name), ["tide-window-chart"]);
});

test("DRIVEN: a site with nothing stored still says so", async () => {
  const r = await callSource({});
  assert.match(r.body.why || "", /not published a build yet/, "the empty case lost its sentence");
});

test("DRIVEN END TO END: the favicon reaches the explorer AND the download", async () => {
  // THE OWNER'S OWN TEST (2026-09-11): *"we do have a favicon but it doesnt show
  // in the code tab"*. Driven from the route's answer, through the browser's own
  // list builder, into a real archive — because "the route returns it" and "the
  // customer can see and save it" are two different claims and only the second
  // is what was asked for.
  const r = await callSource({
    pages: [{ path: "index.tsx", source: "SHELL" }],
    parts: [{ name: "band-1-hero", source: "HERO" }],
    config: { look: { favicon: { form: "svg", svg: ICON } }, css: ".hero{}" },
  });
  const stSrcFiles = new Function(
    "ST_CODE_GROUPS",
    fn("function stSrcFiles(") + "\n" + fn("function stSrcPath(") + "\nreturn stSrcFiles;",
  )([]);
  const files = stSrcFiles(r.body);
  const names = files.map((f) => f.name);

  // IN THE EXPLORER, under the path the container writes it to.
  assert.ok(names.includes("public/icon.svg"), "the favicon is not in the tree: " + names.join(", "));
  // AND THE WHOLE PROJECT BESIDE IT — the customer's own files, what the build
  // made, and the shared scaffold, each in its own group.
  assert.ok(names.includes("src/routes/index.tsx") && names.includes("src/routes/-parts/band-1-hero.tsx"));
  assert.ok(names.includes("src/styles.css"), "the site's own stylesheet is not in the tree");
  assert.ok(names.includes("src/router.tsx") && names.includes("package.json"), "the shared scaffold is not in the tree");
  assert.ok(!names.some((n) => n.startsWith("src/components/")), "the kit was dumped into the tree");
  const kinds = new Set(files.map((f) => f.kind));
  assert.deepEqual([...kinds].sort(), ["asset", "page", "part", "shared"], "the four groups are not all present");

  // AND IN THE DOWNLOAD — the same list, no adapter between, which is what keeps
  // the tree and the zip from disagreeing.
  const bytes = SiteZip.zipFiles(files.map((f) => ({ name: f.name, text: f.text })));
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "gf-src-"));
  const zip = path.join(dir, "site.zip");
  try {
    fs.writeFileSync(zip, Buffer.from(bytes));
    const script = [
      "import json,sys,zipfile",
      "z = zipfile.ZipFile(sys.argv[1])",
      "assert z.testzip() is None",
      "print(json.dumps({n: z.read(n).decode('utf-8') for n in z.namelist()}))",
    ].join("\n");
    const back = JSON.parse(execFileSync("python3", ["-c", script, zip], { encoding: "utf8" }));
    // THE COUNTER, THE TREE AND THE ARCHIVE ARE ONE SET. Any two disagreeing is
    // the defect this whole entry is about.
    assert.deepEqual(Object.keys(back).sort(), names.slice().sort(), "the download holds a different set from the tree");
  // ONE PATH, ONE FILE. `src/styles.css` is claimed by the shared base AND by
  // the site's own layer; showing both would put it in the tree twice under two
  // headings, and the archive collapses two entries of one name — so the tree
  // would list a file the download does not hold. The site's own wins.
  assert.equal(names.filter((n) => n === "src/styles.css").length, 1, "one path is in the tree twice");
  assert.equal(back["src/styles.css"], ".hero{}", "the shared base overwrote the site's own stylesheet");
    assert.equal(back["public/icon.svg"], cleanFavicon(ICON).svg, "the favicon in the archive is not the one the build writes");
    assert.ok(back["src/router.tsx"] && back["package.json"], "the shared scaffold did not survive into the archive");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

const TREE_FILES = [
  { name: "src/routes/index.tsx", kind: "page" },
  { name: "src/routes/-parts/band-1-hero.tsx", kind: "part" },
  { name: "public/icon.svg", kind: "asset" },
  { name: "src/routes/__root.tsx", kind: "shared" },
  { name: "package.json", kind: "shared" },
];
/**
 * Every node of TREE_FILES open — the four groups AND the folder inside each.
 *
 * DERIVED FROM THE RENDERER'S OWN CHAIN, never typed out, because the key a
 * folder is drawn under comes from the collapse rule (`src/routes/-parts` is ONE
 * node, not three) and a hand-typed key is a second copy of that rule. It would
 * pass today and silently open nothing the day the rule moves — the shape this
 * file exists to catch.
 */
const ALL_OPEN = new Set(TREE_FILES.flatMap((f) => [...TREE.stOpenGroups(TREE_FILES, f.name, null)]));

test("DRIVEN: the tree NESTS by real folders, and a file row carries its own name", () => {
  const { stCodeTree } = TREE;
  const files = TREE_FILES;
  // EVERY FOLDER OPEN, because what this case asserts is the SHAPE and the
  // names — which a folded folder simply does not draw. Folding has its own case
  // below; conflating the two would make this one go red for a change to the
  // fold default, reporting the names as wrong.
  const html = stCodeTree(files, "public/icon.svg", ALL_OPEN);
  for (const label of ["Pages", "Components", "Made by the build", "Shared with every site"]) {
    assert.ok(html.includes(label), "the tree has no " + label + " heading");
  }
  // A HEADING OVER NOTHING reads as something missing rather than absent.
  assert.ok(!stCodeTree([{ name: "a.tsx", kind: "page" }], "a.tsx", ALL_OPEN).includes("Made by the build"),
    "an empty group was given a heading");
  // THE FOLDERS CARRY THE PATH AND THE FILE ROW CARRIES ITS OWN NAME (owner,
  // 2026-09-11, drawing `1. / 1.a. / 2.`). The old tree printed the path AS TEXT
  // on every row — `-parts/` nine times over — and stripped `src/routes/` in the
  // customer's own groups while keeping it everywhere else, which is half a
  // hierarchy. Now there is one rule: a folder row is a folder, a file row is a
  // name.
  for (const base of ["index.tsx", "band-1-hero.tsx", "icon.svg", "__root.tsx", "package.json"]) {
    assert.ok(html.includes(">" + base + "<"), "a file row does not carry its own name: " + base);
  }
  assert.ok(!/>[^<]*\/[^<]*<\/span><\/button>/.test(html.replace(/class="st-code-d[\s\S]*?<\/button>/g, "")),
    "a file row still prints a path where a folder should be");
  // A CHAIN OF ONE-CHILD DIRECTORIES IS ONE ROW. Without it the Pages group is
  // `src` then `routes` then one file — two rows of nothing and two clicks.
  assert.ok(html.includes(">src/routes<"), "the one-child chain was not collapsed into a single folder row");
  assert.ok(html.includes(">src/routes/-parts<"), "a component's folder chain was not collapsed");
  assert.ok(!/>src<\/span>/.test(html), "a one-child directory was drawn as its own row");
  // AND A GROUP'S ROOT FILE HAS NO FOLDER AT ALL: `package.json` sits straight
  // under its heading, which is what keeps a flat group flat.
  assert.match(html, /data-srcfold="shared"[\s\S]*?data-srcname="package\.json"/, "a root file was given a folder");
  // THE OPEN FILE IS MARKED, and the data attribute is the FULL name the click
  // handler looks a file up by — never the display name, because two folders can
  // hold files of the same basename.
  assert.match(html, /data-srcname="public\/icon\.svg"[^>]*/, "the open file cannot be looked up by what the row carries");
  assert.ok(/class="st-file on"[^>]*data-srcname="public\/icon\.svg"/.test(html), "the open file is not marked open");
});

test("DRIVEN: depth is on the row, and it is the depth the folder really sits at", () => {
  // THE INDENT IS THE ONLY THING THAT MAKES NESTING VISIBLE, and it is a number
  // the row carries rather than a wrapper element — so nothing about the markup
  // says a row is nested except this. It shipped wrong once: the rule setting it
  // sat ABOVE `.st-file`'s `padding` shorthand, lost on source order, and every
  // file drew flush left under folders it was supposed to be inside.
  const { stCodeTree } = TREE;
  const deep = [
    { name: "src/lib/rows.ts", kind: "shared" },
    { name: "src/lib/utils.ts", kind: "shared" },
    { name: "src/server.ts", kind: "shared" },
    { name: "package.json", kind: "shared" },
  ];
  const open = new Set(TREE.stOpenGroups(deep, "src/lib/rows.ts", null));
  const html = stCodeTree(deep, "src/lib/rows.ts", open);
  // THE WHOLE OPENING TAG, not the part before the attribute we searched for:
  // `style` is written after `data-srcfold`, so a window ending at the needle
  // finds no depth on any row and reports a correctly nested tree as flat.
  const at = (needle) => {
    const i = html.indexOf(needle);
    assert.ok(i > 0, "no row carries " + needle);
    const row = html.slice(html.lastIndexOf("<button", i), html.indexOf(">", i) + 1);
    const m = /--d:(\d+)/.exec(row);
    return m ? Number(m[1]) : 0;
  };
  assert.equal(at('data-srcfold="shared"'), 0, "the group heading is indented");
  assert.equal(at('data-srcfold="shared/src"'), 1, "a folder inside a group is not one step in");
  assert.equal(at('data-srcfold="shared/src/lib"'), 2, "a folder inside a folder is not two steps in");
  assert.equal(at('data-srcname="src/lib/rows.ts"'), 3, "a file is not indented under the folder holding it");
  assert.equal(at('data-srcname="src/server.ts"'), 2, "a file beside a folder is at the folder's depth instead of its own");
  assert.equal(at('data-srcname="package.json"'), 1, "a group's own root file is indented as though it were in a folder");
  // AND THE SHEET REALLY APPLIES IT, below both rules that set `padding` whole.
  const pad = CSS.lastIndexOf(".st-code-d, .st-file { padding-left:");
  assert.ok(pad > 0, "nothing indents a nested row, so the tree draws flat");
  assert.ok(pad > CSS.indexOf(".st-file {") && pad > CSS.indexOf(".st-code-d {"),
    "the indent is written above a `padding` shorthand that overrides it — the tree draws flat");
  // AND IT READS THE DEPTH. Existing-and-positioned is not the property: a rule
  // that indents every row by a FIXED step satisfies both and draws a tree where
  // nothing is inside anything — the markup carrying the right `--d` all the
  // while. A sweep survivor until this line, because the case above proves what
  // the ROWS say and this is the only thing that proves the sheet listens.
  assert.match(CSS.slice(pad, CSS.indexOf("}", pad)), /var\(--d/,
    "the indent ignores --d, so every row draws at one step whatever its depth");
});

/* ───────────────────────── THE FOLDERS FOLD ─────────────────────────
 * Owner, 2026-09-11, holding the tree: *"components you click and the 8 or 0 or
 * whatever how many they appear"*. A heading became a folder that opens, and it
 * carries its count — which is the half that makes a FOLDED group honest rather
 * than a hidden one.
 */
// The class must end at the quote or at a space, never mid-word: `st-file` is a
// prefix of `st-file-ic` and `st-file-n`, so a loose match counts three rows per
// file and every count below would be wrong in the same direction.
const rows = (html, cls) => [...html.matchAll(new RegExp('class="' + cls + '( [^"]*)?"', "g"))].map((m) => m[0]);

test("DRIVEN: every folder says how many are in it, open or shut", () => {
  const { stCodeTree } = TREE;
  const shut = stCodeTree(TREE_FILES, "src/routes/index.tsx", new Set());
  // THE COUNT IS THE WHOLE OF WHAT A SHUT FOLDER SAYS. Without it a folded group
  // is a heading over nothing, which reads as the thing being missing — the same
  // failure the empty-group rule one case up exists to avoid, wearing a fold.
  for (const [key, n] of [["page", 1], ["part", 1], ["asset", 1], ["shared", 2]]) {
    const at = shut.indexOf('data-srcfold="' + key + '"');
    assert.ok(at > 0, "the " + key + " folder is gone");
    assert.match(shut.slice(at, shut.indexOf("</button>", at)),
      new RegExp('class="st-code-count">' + n + "<"), "the " + key + " folder does not say it holds " + n);
  }
  // AND A FOLDER SAYS IT TOO, AT ANY DEPTH — which the group headings alone did
  // not cover, so a folder reporting 0 over nine files survived a sweep. It is
  // the same honesty rule one level down, and it counts the whole subtree rather
  // than the folder's own files: `src` holding nothing but `lib/` still says 5.
  const deep = [
    { name: "src/lib/rows.ts", kind: "shared" },
    { name: "src/lib/utils.ts", kind: "shared" },
    { name: "src/lib/deep/one.ts", kind: "shared" },
    { name: "src/server.ts", kind: "shared" },
  ];
  const tree = stCodeTree(deep, "src/server.ts", new Set(["shared", "shared/src", "shared/src/lib"]));
  for (const [key, n] of [["shared", 4], ["shared/src", 4], ["shared/src/lib", 3], ["shared/src/lib/deep", 1]]) {
    const where = tree.indexOf('data-srcfold="' + key + '"');
    assert.ok(where > 0, "there is no " + key + " folder row");
    assert.match(tree.slice(where, tree.indexOf("</button>", where)),
      new RegExp('class="st-code-count">' + n + "<"),
      key + " does not say it holds " + n + " — a folder that miscounts is worse than one that is shut");
  }
  // SHUT DRAWS NO FILES, OPEN DRAWS THEM ALL. Both directions, because a tree
  // that always draws its files is a tree that never folded, and one that never
  // draws them is a tree nothing can open.
  assert.equal(rows(shut, "st-file").length, 0, "a shut folder still lists its files");
  assert.equal(rows(stCodeTree(TREE_FILES, "src/routes/index.tsx", ALL_OPEN), "st-file").length, TREE_FILES.length,
    "an open folder does not list its files");
  // ONE FOLDER AT A TIME: opening Components must not open anything else — and
  // with the tree nested, opening the GROUP reveals its folder rather than its
  // files, which is the point of nesting and is asserted rather than assumed.
  const group = stCodeTree(TREE_FILES, "src/routes/index.tsx", new Set(["part"]));
  assert.equal(rows(group, "st-file").length, 0, "opening a group jumped straight past its folders to its files");
  assert.ok(group.includes('data-srcfold="part/src/routes/-parts"'), "opening a group did not reveal the folder inside it");
  const one = stCodeTree(TREE_FILES, "src/routes/index.tsx", new Set(["part", "part/src/routes/-parts"]));
  assert.equal(rows(one, "st-file").length, 1, "opening one folder opened another");
  assert.ok(one.includes('data-srcname="src/routes/-parts/band-1-hero.tsx"'), "the folder that was opened is not the one that listed its files");
});

test("DRIVEN: a folder is a control — reachable, and it says whether it is open", () => {
  const { stCodeTree } = TREE;
  const html = stCodeTree(TREE_FILES, "src/routes/index.tsx", new Set(["part"]));
  // A BUTTON, not a div with a click handler. The tree is now navigable by
  // keyboard and the state is announced; a `<div onclick>` is neither, and no
  // assertion about the click handler can see the difference.
  for (const key of ["page", "part", "asset", "shared"]) {
    const at = html.indexOf('data-srcfold="' + key + '"');
    const head = html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1);
    assert.match(head, /^<button type="button"/, "the " + key + " folder is not a button");
    assert.match(head, key === "part" ? /aria-expanded="true"/ : /aria-expanded="false"/,
      "the " + key + " folder does not say whether it is open");
    assert.equal(/class="st-code-h on/.test(head), key === "part",
      "the " + key + " folder's open class disagrees with what it announces");
  }
});

test("DRIVEN: `null` is not an empty Set — the first draw opens the folder holding the open file", () => {
  const { stOpenGroups, stCodeTree } = TREE;
  // THE THIRD STATE. Until the customer folds anything there is no choice to
  // remember and one folder is derived; an EMPTY SET is a customer who closed
  // every folder, and re-deriving for them would re-open one on the next click,
  // for ever. The recorded "cannot-tell must never read as a value".
  // THE WHOLE CHAIN, not just the group: with the tree nested, opening `page`
  // alone would reveal the folder `src/routes` and stop there, leaving the file
  // on screen one click away in the explorer that is showing it.
  assert.deepEqual([...stOpenGroups(TREE_FILES, "src/routes/index.tsx", null)], ["page", "page/src/routes"]);
  assert.deepEqual([...stOpenGroups(TREE_FILES, "src/routes/index.tsx", new Set())], [],
    "a customer who closed every folder gets one re-opened");
  // DERIVED FROM THE OPEN FILE, never a hardcoded `page`. A rebuild can replace
  // the file list while the chosen file is a component, so a fixed default would
  // fold the folder holding the file being shown. The chain is derived through
  // the SAME collapse rule the renderer uses, so `src/routes/-parts` is one key.
  for (const [name, keys] of [
    ["src/routes/-parts/band-1-hero.tsx", ["part", "part/src/routes/-parts"]],
    ["public/icon.svg", ["asset", "asset/public"]],
    ["package.json", ["shared"]],
  ]) {
    assert.deepEqual([...stOpenGroups(TREE_FILES, name, null)], keys, name + " does not open the chain holding it");
    assert.ok(stCodeTree(TREE_FILES, name, null).includes('data-srcname="' + name + '"'),
      "the file on screen is in a folder the tree drew shut");
  }
  // A NAME THAT NAMES NOTHING falls to the first group rather than to none — an
  // explorer that opens onto four shut folders is one a customer must click to
  // see anything at all.
  for (const junk of ["", "nope.tsx", null, undefined]) {
    assert.deepEqual([...stOpenGroups(TREE_FILES, junk, null)], ["page"], JSON.stringify(junk));
  }
  // A CHOICE IS HONOURED WHATEVER IT HOLDS, including a key no group has.
  assert.deepEqual([...stOpenGroups(TREE_FILES, "src/routes/index.tsx", new Set(["nope"]))], ["nope"]);
  // A NON-SET IS NOT A CHOICE, so each of these falls to the derived chain
  // rather than being taken as one. The duck-typed object is the case that
  // matters: `new Set(chosen)` inside the toggle THROWS on anything that is not
  // iterable, so admitting one by shape would turn a click into an exception.
  for (const junk of [[], "page", { has: () => true }, 0]) {
    assert.deepEqual([...stOpenGroups(TREE_FILES, "src/routes/index.tsx", junk)], ["page", "page/src/routes"],
      "a " + typeof junk + " was read as a stored choice");
  }
  assert.deepEqual([...stOpenGroups(null, "x", null)], ["page"], "a missing file list throws instead of drawing");

  // A COLLAPSED CHAIN WITH ANOTHER FOLDER BELOW IT — the shape every fixture
  // above lacks, and a sweep survivor until it was added. The walk has to skip
  // as many segments as the chain SWALLOWED (`a/b/c` is three) before looking
  // for the next folder; advancing one at a time leaves the walk comparing
  // `b` against a node that holds `e`, it stops, and the folder holding the file
  // on screen is drawn SHUT — in the explorer that is showing that file.
  //
  // TREE_FILES cannot see it: `src/routes/-parts` swallows every segment there
  // is, so there is nothing after the chain for the walk to get wrong.
  const nested = [
    { name: "a/b/c/d.ts", kind: "page" },
    { name: "a/b/c/e/f.ts", kind: "page" },
  ];
  assert.deepEqual([...stOpenGroups(nested, "a/b/c/e/f.ts", null)], ["page", "page/a/b/c", "page/a/b/c/e"],
    "the walk lost the folder below a collapsed chain");
  assert.ok(stCodeTree(nested, "a/b/c/e/f.ts", null).includes('data-srcname="a/b/c/e/f.ts"'),
    "the file on screen sits in a folder the tree drew shut");
});

test("DRIVEN THROUGH THE TAB: a click really folds, and the fold survives the redraw", async () => {
  // THE CHAIN, not the function. `stOpenGroups` answering correctly says nothing
  // about whether anybody STORES what the click computed — a handler that builds
  // a new Set and drops it leaves every case above green and the folder shut for
  // ever. This repository's most-shipped failure, so it is driven end to end.
  const clicks = new Map();
  // RE-ANCHORED 2026-09-12, not appeased: the rows are written into a node
  // INSIDE the shell now, so the binder is handed that node's own HTML by
  // `codeHost` rather than reading one flat string off the host. The property —
  // a click really folds and the fold survives — has not moved.
  const a = codeTab({
    answer: { ok: true, pages: [{ path: "src/routes/index.tsx", source: "// page\n" }], assets: [{ path: "public/icon.svg", source: "<svg/>" }] },
    open: "src/routes/index.tsx",
    bind: (html, sel) => {
      const attr = sel.slice(1, -1);
      return [...String(html).matchAll(new RegExp(attr + '="([^"]*)"', "g"))]
        .map((m) => ({ dataset: { [attr === "data-srcfold" ? "srcfold" : "srcname"]: m[1] }, set onclick(f) { clicks.set(attr + ":" + m[1], f); } }));
    },
  });
  const host = a.host;
  await a.t.run(a.site);
  assert.equal(a.t.groups, null, "the tab stored a choice nobody made");
  assert.equal(rows(host.innerHTML, "st-file").length, 1, "the first draw is not one chain open");

  // THE CLICK OPENS A SECOND CHAIN — and the one holding the open file stays
  // open, which is what materialising the derived default before toggling buys.
  // TWO CLICKS, because the tree nests: the group, then the folder inside it.
  clicks.get("data-srcfold:asset")();
  assert.deepEqual([...a.t.groups].sort(), ["asset", "page", "page/src/routes"],
    "the click did not store the fold");
  assert.equal(rows(host.innerHTML, "st-file").length, 1, "opening a group jumped past its folder to its files");
  clicks.get("data-srcfold:asset/public")();
  assert.equal(rows(host.innerHTML, "st-file").length, 2, "the folder that was clicked did not open");

  // AND SHUTTING IT AGAIN IS THE SAME CLICK. A handler that only ever adds is a
  // folder that opens once and never closes.
  clicks.get("data-srcfold:asset/public")();
  assert.equal(rows(host.innerHTML, "st-file").length, 1, "a second click did not shut the folder");
  clicks.get("data-srcfold:asset")();
  assert.deepEqual([...a.t.groups].sort(), ["page", "page/src/routes"], "shutting the group did not store it");

  // THE FOLD SURVIVES A RE-FETCH, because it is the customer's preference and
  // not a property of the answer. A rebuild must not silently re-open folders.
  clicks.get("data-srcfold:page")();
  clicks.get("data-srcfold:page/src/routes")();
  assert.deepEqual([...a.t.groups], [], "every folder shut is not a state the tab can hold");
  await a.t.run(a.site);
  assert.deepEqual([...a.t.groups], [], "a re-fetch threw the customer's folds away");
  assert.equal(rows(host.innerHTML, "st-file").length, 0, "a re-fetch re-opened a folder the customer shut");

  // AND A CLICK NEVER GOES BACK TO THE NETWORK. Two fetches, six clicks.
  assert.equal(a.fetches(), 2, "a fold or a file pick re-fetched the whole project");
});

test("the folder's chevron turns, and its name wraps rather than truncating", () => {
  // THE CLASS THE MARKUP WRITES IS THE CLASS THE SHEET PAINTS, asked in both
  // directions — a rule on a class nothing draws is a rule that paints nothing.
  const html = TREE.stCodeTree(TREE_FILES, "src/routes/index.tsx", new Set(["page"]));
  for (const cls of ["st-code-caret", "st-code-hn", "st-code-count"]) {
    assert.ok(html.includes('class="' + cls + '"'), "the tree draws no " + cls);
    assert.match(CSS, new RegExp("\\." + cls + " \\{"), "the sheet paints no " + cls);
  }
  // BOTH KINDS OF FOLD TURN THEIR CARET, and the group heading alone was the
  // spelling once — which left every FOLDER drawing a shut caret over its own
  // open contents, the one state a disclosure triangle exists to report.
  for (const cls of ["st-code-h", "st-code-d"]) {
    assert.match(CSS, new RegExp("\\." + cls + "\\.on \\.st-code-caret[^{]*\\{[^}]*rotate\\(-90deg\\)"),
      "a ." + cls + " caret never turns, so it looks shut whether it is or not");
    assert.match(CSS, new RegExp("\\." + cls + " \\{[^}]*cursor: pointer"), "a ." + cls + " does not read as clickable");
    assert.match(CSS, new RegExp("\\." + cls + ":hover \\{"), "a ." + cls + " gives no sign it can be pressed");
  }
  // THE NAME WRAPS. The column is 210px and the caret and the count take ~40 of
  // it, so "SHARED WITH EVERY SITE" no longer fits on one line — and an ellipsis
  // there reads as a heading somebody cut. `min-width: 0` is what lets a flex
  // item shrink below its own text at all.
  assert.match(CSS, /\.st-code-hn \{[^}]*min-width: 0/, "the folder name cannot shrink, so the count is pushed off the row");
  assert.ok(!/\.st-code-hn \{[^}]*text-overflow/.test(CSS), "the folder name truncates instead of wrapping");
  // THE COUNT IS HARD RIGHT, so four of them line up down the column.
  assert.match(CSS, /\.st-code-count \{[^}]*margin-left: auto/, "the counts no longer line up");
  // AND A FOLDED GROUP PUTS TWO HEADINGS SIDE BY SIDE, which the spacing rule
  // has to know about — the old one only knew heading-after-file.
  assert.match(CSS, /\.st-code-h \+ \.st-code-h[^{]*\{/, "two folded folders run together");
});

// ───────────────────────────────────────────────────────────────────────────
// THE TREE READS LIKE A PROJECT: TYPED ICONS AND A–Z (2026-09-12, owner holding
// Lovable's explorer beside ours: "ok do that").
//
// Two things were wrong and both were invisible to every case above. Every row
// asked `ic('code', 13)`, so a readme, a lock file and a stylesheet drew the
// same chevron pair; and `stDirTree` never sorted, so the project root came out
// in whatever order the file list arrived in — the hand-chosen reading order
// `builder/gen-foundation.mjs` lists its paths in, which is the wrong order for
// finding one file among twenty-five.

test("DRIVEN: a file's icon comes from its own name, one kind at a time", () => {
  const { stFileIcon } = TREE;
  // THE PAIRS ARE THE CONTRACT. Each is a real file the explorer shows today.
  const want = [
    ["README.md", "doc"], ["AGENTS.md", "doc"], ["notes.txt", "doc"],
    ["package.json", "braces"], ["tsconfig.kit.json", "braces"], ["components.json", "braces"],
    ["src/styles.css", "paint"],
    ["public/icon.svg", "image"], ["public/card.png", "image"], ["a.JPEG", "image"],
    [".gitignore", "sliders"], [".prettierrc", "sliders"], [".prettierignore", "sliders"],
    ["package-lock.json", "lock"], ["bun.lock", "lock"],
    ["src/routes/index.tsx", "code"], ["vite.config.ts", "code"], ["eslint.config.js", "code"],
    ["src/server.ts", "code"], ["builder/x.mjs", "code"],
  ];
  for (const [name, icon] of want) {
    assert.equal(stFileIcon(name), icon, name + " draws " + JSON.stringify(stFileIcon(name)) + ", not " + JSON.stringify(icon));
  }
  // THE FALLBACK IS REACHED AND IS `code`, never nothing. A blank icon column is
  // worse than a slightly wrong glyph, and an extension nobody has taught this
  // function is source until proven otherwise.
  assert.equal(stFileIcon("thing.wat"), "code", "an unknown extension drew something other than code");
  assert.equal(stFileIcon("Makefile"), "code", "an extensionless NON-dotfile was read as configuration");
  assert.equal(stFileIcon(""), "code", "a nameless row threw or drew nothing");
  assert.equal(stFileIcon(null), "code", "a missing name threw");
  // THE LOCK RULE IS BY NAME, NOT BY EXTENSION, which is the one rule here that
  // has to beat the extension it also matches: `package-lock.json` IS json, and
  // braces would be true and useless where a padlock says "the pinned one".
  assert.equal(stFileIcon("package-lock.json"), "lock", "the lock file fell through to its extension");
  assert.notEqual(stFileIcon("lockers.json"), "lock", "a file merely containing 'lock' was read as a lock file");
  assert.notEqual(stFileIcon("unlock.ts"), "lock", "a file merely containing 'lock' was read as a lock file");
});

test("DERIVED: every icon the resolver can answer is one the icon table has", () => {
  // TWO LISTS OF THE SAME THING, and the drift is silent: `ic()` answers
  // `ST_ICONS[name] || ''`, so a renamed or dropped glyph draws an EMPTY <svg> —
  // a blank column where an icon was, with nothing failing anywhere. Derived
  // from the resolver's own returns rather than from a list beside it.
  const src = fn("function stFileIcon(");
  const answers = [...src.matchAll(/return '([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(answers.length >= 6, "only " + answers.length + " icon answers found — this check is measuring nothing");
  const table = BARE.slice(BARE.indexOf("const ST_ICONS = {"), BARE.indexOf("\n};", BARE.indexOf("const ST_ICONS = {")));
  for (const name of new Set(answers)) {
    assert.match(table, new RegExp("^  " + name + ": '", "m"),
      "stFileIcon can answer " + JSON.stringify(name) + " and ST_ICONS has no such glyph — those rows draw an empty svg");
  }

  // AND EVERY GLYPH ANY CALLER ASKS FOR BY NAME, which is the same silence one
  // step wider. The half above covers the resolver's own answers; it cannot see
  // `ic('x', 12)` written into the search box, and a sweep found exactly that —
  // the clear button drawing an empty <svg> with every case still green.
  // Derived from the calls rather than from a list beside them, so the next
  // glyph anybody reaches for is covered by existing. MEASURED over the real
  // file before it shipped: 18 names asked for, 0 missing.
  const asked = [...new Set([...BARE.matchAll(/\bic\('([a-zA-Z]+)'/g)].map((m) => m[1]))];
  assert.ok(asked.length >= 15, "only " + asked.length + " ic() calls found — this half is measuring nothing");
  for (const name of asked) {
    assert.match(table, new RegExp("^  " + name + ": '", "m"),
      "something calls ic(" + JSON.stringify(name) + ") and ST_ICONS has no such glyph — it draws an empty svg and nothing fails");
  }
});

test("DRIVEN: the tree is A–Z with the dotfiles first, and folders still lead", () => {
  const { stDirTree } = TREE;
  // DELIBERATELY SHUFFLED, and in the shape the real list arrives in: the root
  // comes out of FOUNDATION_PATHS in reading order, which is exactly what this
  // is here to stop the tree inheriting.
  const files = ["vite.config.ts", "README.md", ".prettierrc", "package.json", "AGENTS.md",
    ".gitignore", "package-lock.json", "tsconfig.json", "src/router.tsx", "public/icon.svg"]
    .map((name) => ({ name, kind: "shared" }));
  const root = stDirTree(files);
  assert.deepEqual(root.files.map((f) => f.base), [
    ".gitignore", ".prettierrc", "AGENTS.md", "package-lock.json", "package.json",
    "README.md", "tsconfig.json", "vite.config.ts",
  ], "the root is not A–Z with the dotfiles at the top");
  // FOLDERS A–Z TOO, and they are a Map whose ORDER is what the renderer walks.
  assert.deepEqual([...root.dirs.keys()], ["public", "src"], "the folders are not sorted");
  // AND THE SORT REACHES EVERY LEVEL, not just the root.
  const deep = stDirTree(["a/z.tsx", "a/b.tsx", "a/m.tsx"].map((name) => ({ name, kind: "page" })));
  assert.deepEqual(deep.dirs.get("a").files.map((f) => f.base), ["b.tsx", "m.tsx", "z.tsx"],
    "a nested folder kept its insertion order");
  // CASE-INSENSITIVE, WITH A TOTAL ORDER. `README.md` must not sort above
  // `package.json` just for being capitalised, and two names differing only in
  // case must still come out in a fixed order rather than swapping per engine.
  //
  // THE INPUT ORDER IS THE WHOLE OF THE SECOND HALF, and the first draft of this
  // case got it wrong: it fed `["b.tsx", "A.tsx", "a.tsx"]`, where the tie-break
  // and INSERTION order happen to agree, so dropping the tie-break entirely
  // survived the sweep. `Array.sort` is stable, so an equal comparison keeps the
  // order the list arrived in — which is exactly the thing this sort exists to
  // stop the tree depending on. Feeding the lowercase one FIRST is what separates
  // "ordered by name" from "ordered by whatever arrived first".
  const cased = stDirTree(["a.tsx", "A.tsx", "b.tsx"].map((name) => ({ name, kind: "page" })));
  assert.deepEqual(cased.files.map((f) => f.base), ["A.tsx", "a.tsx", "b.tsx"],
    "the order is case-sensitive, or the tie between two spellings fell back to the order the list arrived in");
});

test("the rendered rows really carry their icons, and the drawn order is the sorted one", () => {
  const { stCodeTree, stOpenGroups } = TREE;
  const files = ["README.md", ".gitignore", "package-lock.json", "src/styles.css"]
    .map((name) => ({ name, kind: "shared", text: "x" }));
  // EVERY FOLDER OPEN. The default-open chain opens only the chain holding the
  // chosen file, so `src` would be folded and its row simply absent — which is
  // what the first draft of this case asserted against, and the renderer was
  // right. Folding has its own cases above.
  const html = stCodeTree(files, "README.md", new Set(files.flatMap((f) => [...stOpenGroups(files, f.name, null)])));
  // THE OBSERVER IS ALIVE FIRST: `ic` is a stub in this file, and if it stopped
  // echoing, every assertion below would pass over an empty string.
  assert.ok(html.includes('data-ic='), "the icon stub drew nothing — every icon assertion here is vacuous");
  for (const [name, icon] of [["README.md", "doc"], [".gitignore", "sliders"], ["package-lock.json", "lock"]]) {
    const at = html.indexOf('data-srcname="' + name + '"');
    assert.ok(at > 0, "no row for " + name);
    const row = html.slice(at, html.indexOf("</button>", at));
    assert.match(row, new RegExp('data-ic="' + icon + '"'), name + " did not draw the " + icon + " icon");
  }
  // AND THE ROWS COME OUT IN THE SORTED ORDER, which is the half a tree-shape
  // assertion cannot see: `stDirTree` could sort and the renderer still walk
  // something else.
  const order = [...html.matchAll(/data-srcname="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ["src/styles.css", ".gitignore", "package-lock.json", "README.md"],
    "the drawn order is not folders-then-files-A-Z");
});

// ───────────────────────────────────────────────────────────────────────────
// THE SEARCH BOX (2026-09-12, owner holding Lovable's "Search code" beside
// ours: "add the search box too").
//
// It searches the CODE and not only the names, which is the whole reason the box
// can carry that label: every file's text is already in the browser, so matching
// contents costs no request — and a box named "Search code" that filtered
// filenames alone would be this app's dead control wearing a new coat.

const FIND_FILES = [
  { name: "src/routes/index.tsx", kind: "page", text: "export function Home() { return <Booking /> }\n" },
  { name: "src/routes/-parts/Booking.tsx", kind: "part", text: "// the booking band\nexport function Booking() {}\n" },
  { name: "README.md", kind: "shared", text: "A site built with Go Farther.\n" },
  { name: "package.json", kind: "shared", text: '{ "name": "gofarther-site" }\n' },
];

test("DRIVEN: the filter matches a name OR the code inside, and counts what it found", () => {
  const { stCodeFind } = TREE;
  const names = (r) => r.files.map((f) => f.name);

  // NOTHING TYPED IS NOT A FILTER. The whole list comes back, `on` is false, and
  // the count line above the tree stays empty — a tree that always says
  // "4 of 4 files" is a label, not a sign that something is filtered.
  const idle = stCodeFind(FIND_FILES, "");
  assert.equal(idle.on, false);
  assert.equal(idle.files, FIND_FILES, "an empty query copied the list instead of handing it back");
  assert.equal(idle.shown, 4);
  assert.equal(idle.total, 4);
  for (const blank of ["   ", "\t\n"]) assert.equal(stCodeFind(FIND_FILES, blank).on, false, "whitespace read as a query");

  // BY NAME — and the row carries NO number, because the thing that matched is
  // the name already on the row.
  const byName = stCodeFind(FIND_FILES, "package");
  assert.deepEqual(names(byName), ["package.json"]);
  assert.equal(byName.files[0].hits, 0, "a name match invented a hit count for contents that do not match");
  assert.equal(byName.shown, 1);
  assert.equal(byName.total, 4, "the total is the filtered count, so the count line can never say what was hidden");

  // BY CONTENTS — the case the whole feature exists for. `README.md` says
  // nothing about farther in its NAME.
  const byText = stCodeFind(FIND_FILES, "Go Farther");
  assert.deepEqual(names(byText), ["README.md"]);
  assert.equal(byText.files[0].hits, 1, "a contents match did not say how many times");

  // BOTH AT ONCE, and the count is still the contents' — a file whose name AND
  // body match is one row with a real number on it.
  const both = stCodeFind(FIND_FILES, "booking");
  assert.deepEqual(names(both), ["src/routes/index.tsx", "src/routes/-parts/Booking.tsx"]);
  assert.equal(both.files[0].hits, 1, "the page's own <Booking /> was not counted");
  assert.equal(both.files[1].hits, 2, "the part's name matched but its two mentions were not counted");

  // CASE-INSENSITIVE IN BOTH HALVES. A customer typing `BOOKING` and getting
  // nothing would read as the search being broken.
  assert.deepEqual(names(stCodeFind(FIND_FILES, "BOOKING")), names(both), "the search is case-sensitive");

  // NOTHING MATCHES IS AN EMPTY LIST WITH `on` TRUE, never the whole list back.
  // Falling back to "show everything" is how a filter silently stops filtering.
  const none = stCodeFind(FIND_FILES, "kayak");
  assert.equal(none.on, true);
  assert.deepEqual(names(none), []);
  assert.equal(none.total, 4, "a no-match answer forgot how big the project is");

  // THE ORIGINALS ARE NEVER TOUCHED. The filtered entries are copies, so a
  // `hits` from one search cannot ride along into the next, or into the zip.
  assert.ok(!Object.hasOwn(FIND_FILES[1], "hits"), "the filter wrote its count onto the project's own file list");
});

test("DRIVEN: the filter refuses what it is not given, and never throws on a short file", () => {
  const { stCodeFind } = TREE;
  // `String(["a"])` IS `"a"` — this repository's recorded coercion, three
  // shipped bugs deep. A coerced array here would filter the whole tree down to
  // whatever its one element spells, silently.
  for (const junk of [["package"], 0, null, undefined, {}, 42]) {
    const r = stCodeFind(FIND_FILES, junk);
    assert.equal(r.on, false, "a " + typeof junk + " was read as a query");
    assert.equal(r.files.length, 4);
  }
  // A MISSING LIST IS AN EMPTY ONE, not a throw — the tab draws before a fetch
  // has ever answered.
  assert.deepEqual(stCodeFind(null, "x").files, []);
  assert.deepEqual(stCodeFind(undefined, "").files, []);
  // A FILE WITH NO TEXT is still matchable by name, and does not throw. The
  // explorer's `unplaced/` entries and any future row are this shape.
  const odd = [{ name: "unplaced/1.txt", kind: "page" }, { name: "a.tsx", kind: "page", text: null }];
  assert.deepEqual(stCodeFind(odd, "unplaced").files.map((f) => f.name), ["unplaced/1.txt"]);
  assert.deepEqual(stCodeFind(odd, "zzz").files, []);
});

test("DRIVEN: the hit count stops at a number a 210px column can hold", () => {
  const { stCodeFind, ST_FIND_MAX } = TREE;
  assert.equal(typeof ST_FIND_MAX, "number", "the ceiling is gone, so the next assertion measures nothing");
  // A ONE-LETTER QUERY AGAINST THE LOCK FILE is the real shape: 310,981 bytes
  // with tens of thousands of hits, counted on every keystroke.
  const many = [{ name: "package-lock.json", kind: "shared", text: "e".repeat(5000) }];
  const r = stCodeFind(many, "e");
  assert.ok(r.files[0].hits > ST_FIND_MAX, "the count stopped at or below the ceiling, so the row can never say 99+");
  assert.equal(r.files[0].hits, ST_FIND_MAX + 1, "the counting ran past the ceiling instead of stopping just above it");
  // AND THE CEILING IS A DISPLAY DECISION THAT CANNOT CHANGE THE ANSWER: one hit
  // is enough to be in the list, so stopping early never drops a file.
  assert.equal(r.shown, 1);
  // NON-OVERLAPPING, which is what "3 matches" means to a reader. Counting
  // overlaps would answer 3 here where a person counts 2.
  assert.equal(stCodeFind([{ name: "a", kind: "page", text: "aaaa" }], "aa").files[0].hits, 2,
    "overlapping matches were counted, so the number is not the number a reader sees");
});

test("DRIVEN: a filtered tree is drawn OPEN, and the customer's own folds are left alone", () => {
  const { stCodeTree, stCodeFind } = TREE;
  const shut = new Set();          // every folder closed, deliberately
  // THE CONTROL FIRST: with those folds and no query, the tree is four headings
  // and not one file — so the next assertion is measuring the `all` flag and not
  // a tree that was open anyway.
  const folded = stCodeTree(FIND_FILES, "README.md", shut);
  assert.equal(rows(folded, "st-file").length, 0, "the fixture's folds do not actually fold, so this case proves nothing");

  const found = stCodeFind(FIND_FILES, "booking");
  const open = stCodeTree(found.files, "README.md", shut, found.on);
  assert.equal(rows(open, "st-file").length, 2, "the matches are hidden inside folders the search left shut");
  assert.ok(open.includes('data-srcname="src/routes/-parts/Booking.tsx"'), "a match two folders deep never reached the tree");
  // AND THE STORED FOLDS ARE UNTOUCHED, so clearing the box puts the tree back
  // exactly as the customer left it. `shut` is the state, and it is still empty.
  assert.equal(shut.size, 0, "drawing a search wrote folders into the customer's stored choice");
});

test("DRIVEN: a row says how many times, only when the CONTENTS matched", () => {
  const { stCodeTree, stCodeFind, ST_FIND_MAX } = TREE;
  const draw = (q) => stCodeTree(stCodeFind(FIND_FILES, q).files, "README.md", new Set(), true);
  const row = (html, name) => html.slice(html.indexOf('data-srcname="' + name + '"'), html.indexOf("</button>", html.indexOf('data-srcname="' + name + '"')));

  const both = draw("booking");
  assert.match(row(both, "src/routes/-parts/Booking.tsx"), /class="st-file-hits">2</, "the part's two mentions are not on its row");
  assert.match(row(both, "src/routes/index.tsx"), /class="st-file-hits">1</, "the page's one mention is not on its row");
  // A NAME-ONLY MATCH CARRIES NOTHING, which is what makes a numberless row
  // self-explanatory: it matched the name you can read on it.
  assert.ok(!row(draw("package"), "package.json").includes("st-file-hits"),
    "a name-only match drew a count, so the number no longer means what it says");
  // AND AN UNFILTERED TREE HAS NO NUMBERS AT ALL — the ordinary state of this
  // panel, which the filter must not leave a mark on.
  assert.ok(!stCodeTree(FIND_FILES, "README.md", new Set(), false).includes("st-file-hits"));

  // THE CEILING'S LABEL IS DERIVED FROM THE CEILING, so raising one cannot leave
  // the other saying the old number.
  const many = stCodeFind([{ name: "a.tsx", kind: "page", text: "e".repeat(5000) }], "e");
  assert.ok(stCodeTree(many.files, "a.tsx", new Set(), true).includes(">" + ST_FIND_MAX + "+<"),
    "a file past the ceiling drew a raw count rather than " + ST_FIND_MAX + "+");
});

test("DRIVEN: the box, the count line and the no-match sentence all say what they are", () => {
  const { stFindBox, stFindSaid, stFindNone } = TREE;

  // THE FIELD CARRIES THE QUERY BACK, ESCAPED. It is rendered as an attribute,
  // so a quote in the query would end it and everything after would be markup.
  const box = stFindBox('a" onfocus="x');
  assert.ok(box.includes('id="stCodeFind"'), "the field is not the one the handler looks up");
  assert.ok(!box.includes('onfocus="x'), "a quote in the query escaped the value attribute");
  assert.ok(box.includes("&quot;"), "the query was dropped rather than escaped");
  // IT SAYS WHAT IT SEARCHES. "Search files" would be the false-promise version.
  assert.match(box, /placeholder="Search files and code"/);
  assert.match(box, /aria-label="Search files and code"/);
  // THE CLEAR IS ALWAYS DRAWN and shown by a class — drawing it in and out per
  // keystroke would rebuild the row holding the input and throw the customer out
  // of the box they are typing in.
  assert.ok(stFindBox("").includes('id="stCodeFindX"'), "the clear button is absent until something is typed");
  assert.ok(stFindBox("x").includes('class="st-code-find on"'), "a query does not mark the box, so the clear stays hidden");
  assert.ok(!stFindBox("").includes('class="st-code-find on"'), "an empty box is marked as filtering");
  // AND THE COUNT LINE IS IN THE MARKUP EMPTY, for the same reason.
  assert.ok(stFindBox("").includes('id="stCodeFindSaid"'));

  // THE COUNT IS A SIGN, NOT A LABEL: empty unless something is filtered.
  assert.equal(stFindSaid({ on: false, shown: 4, total: 4 }), "");
  assert.equal(stFindSaid(null), "");
  assert.equal(stFindSaid({ on: true, shown: 2, total: 25 }), "2 of 25 files");
  assert.equal(stFindSaid({ on: true, shown: 0, total: 1 }), "0 of 1 file", "one file is still called files");

  // AND NOTHING MATCHING IS A SENTENCE NAMING THE QUERY. An empty column is
  // indistinguishable from a project whose files are gone.
  assert.match(stFindNone("kayak"), /No file matches .kayak./);
  assert.match(stFindNone("  kayak  "), /.kayak./, "the sentence quoted the customer's own spaces");
});

test("DRIVEN THROUGH THE TAB: typing filters the tree and rebuilds nothing else", async () => {
  // THE PROPERTY THAT KEEPS THE CARET IN THE BOX, and no assertion about the
  // filter can see it: `drawSiteCode` replaces the whole panel's HTML, so a
  // keystroke that went back through it would destroy the input mid-word and
  // scroll the file being read back to its first line.
  const clicks = new Map();
  const a = codeTab({
    answer: {
      ok: true,
      pages: [{ path: "src/routes/index.tsx", source: "<Booking />\n" }, { path: "src/routes/menu.tsx", source: "// menu\n" }],
      assets: [{ path: "public/icon.svg", source: "<svg/>" }],
    },
    open: "src/routes/index.tsx",
    bind: (html, sel) => {
      const attr = sel.slice(1, -1);
      return [...String(html).matchAll(new RegExp(attr + '="([^"]*)"', "g"))]
        .map((m) => ({ dataset: { srcfold: m[1], srcname: m[1] }, set onclick(f) { clicks.set(attr + ":" + m[1], f); } }));
    },
  });
  await a.t.run(a.site);
  const shellOf = (h) => String(h).slice(0, String(h).indexOf('<div class="st-code-rows">'));
  const before = shellOf(a.host.innerHTML);
  assert.ok(before.includes('id="stCodeFind"'), "the tab drew no search box");
  assert.ok(typeof a.input.oninput === "function", "nothing is listening to the box — it is a dead control");

  // TYPE. Only the rows change; the shell — which holds the input and the open
  // file's <pre> — is byte-for-byte what it was.
  a.input.value = "booking";
  a.input.oninput();
  assert.equal(a.t.find, "booking", "the keystroke was not stored, so a later redraw would forget it");
  assert.equal(shellOf(a.host.innerHTML), before, "a keystroke rebuilt the panel around the box being typed in");
  assert.equal(rows(a.host.innerHTML, "st-file").length, 1, "the filter did not narrow the tree");
  assert.ok(a.host.innerHTML.includes('data-srcname="src/routes/index.tsx"'));
  assert.equal(a.host.said, "1 of 3 files", "the count line does not say the tree is filtered");
  assert.equal(a.host.filtering, true, "the box is not marked, so its clear button stays hidden");

  // THE OPEN FILE DOES NOT MOVE, even when the query excludes it. Typing in a
  // box must never swap out what you are reading.
  a.input.value = "icon";
  a.input.oninput();
  assert.equal(a.t.open, "src/routes/index.tsx", "the search changed which file is open");
  assert.equal(rows(a.host.innerHTML, "st-file").length, 1);

  // AND A FOLD CLICKED WHILE A QUERY IS UP STORES THE WHOLE PROJECT'S CHAIN, not
  // the filtered one — a sweep survivor until this was driven. The first click
  // has no stored choice, so it materialises the derived default; derived from
  // the FILTERED list that default loses the open file entirely (it is not in
  // the results) and collapses to the bare group, so clearing the box would show
  // the folder holding the file on screen shut.
  assert.equal(a.t.groups, null, "the fixture already has a stored fold, so this measures nothing");
  clicks.get("data-srcfold:asset")();
  assert.deepEqual([...a.t.groups].sort(), ["asset", "page", "page/src/routes"],
    "a fold clicked during a search stored a chain derived from the search results");

  // NOTHING MATCHING IS THE SENTENCE, and the tree is not simply empty.
  a.input.value = "kayak";
  a.input.oninput();
  assert.equal(rows(a.host.innerHTML, "st-file").length, 0);
  assert.match(a.host.innerHTML, /st-find-none/, "an empty result is a blank column with nothing said");
  assert.match(a.host.innerHTML, /No file matches/);
  assert.equal(a.host.said, "0 of 3 files");

  // A FILTERED ROW IS STILL A CONTROL. The rows are rebuilt on every keystroke,
  // so the handlers have to be rebound with them — without it the tree goes
  // quiet the first time anybody searches.
  a.input.value = "menu";
  a.input.oninput();
  assert.ok(clicks.has("data-srcname:src/routes/menu.tsx"), "a row drawn by the search has no click handler");
  clicks.get("data-srcname:src/routes/menu.tsx")();
  assert.equal(a.t.open, "src/routes/menu.tsx", "clicking a search result did not open it");

  // AND NOTHING WENT BACK TO THE NETWORK. One fetch, five keystrokes, one click.
  assert.equal(a.fetches(), 1, "a keystroke re-fetched the whole project");
});

test("DRIVEN THROUGH THE TAB: the box clears two ways, and Escape stops where it is", async () => {
  const a = codeTab({
    answer: { ok: true, pages: [{ path: "src/routes/index.tsx", source: "// page\n" }] },
    open: "src/routes/index.tsx", find: "kayak",
  });
  await a.t.run(a.site);
  // THE STORED QUERY SURVIVES THE DRAW — a filter kept inside the render would
  // empty itself every time the builder answered.
  assert.equal(rows(a.host.innerHTML, "st-file").length, 0, "the query the tab came up with was ignored");
  assert.match(a.host.innerHTML, /value="kayak"/, "the field came up empty over a filtered tree");

  // AND THE OPEN FILE IS STILL CHOSEN FROM THE WHOLE PROJECT. A sweep survivor
  // until this was driven: the keystroke path never recomputes it, so the only
  // way to see the wrong reading is a FULL draw with a query already up — a
  // reload, or a fold click. Picked from the results, a query naming another
  // file opens that one instead, and the customer's file does not come back when
  // the box is cleared.
  const swap = codeTab({
    answer: { ok: true, pages: [{ path: "src/routes/index.tsx", source: "// page\n" }, { path: "src/routes/menu.tsx", source: "// menu\n" }] },
    open: "src/routes/index.tsx", find: "menu",
  });
  await swap.t.run(swap.site);
  assert.equal(swap.t.open, "src/routes/index.tsx", "a stored search picked which file is open");
  assert.equal(rows(swap.host.innerHTML, "st-file").length, 1, "the tree was not filtered, so this case proves nothing");

  // THE CLEAR BUTTON puts the tree back AND the caret back — clearing a search
  // is almost always the start of the next one.
  assert.ok(typeof a.clear.onclick === "function", "the clear button does nothing");
  a.clear.onclick();
  assert.equal(a.input.value, "", "the field still shows the query it no longer has");
  assert.equal(a.t.find, "");
  assert.equal(rows(a.host.innerHTML, "st-file").length, 1, "clearing did not put the tree back");
  assert.equal(a.input.focused, 1, "the caret was left outside the box that was just cleared");

  // ESCAPE CLEARS TOO — and STOPS, because the document's own Escape handler
  // closes whatever overlay is open. Without the stop, emptying the box would
  // also shut the panel being searched in.
  let stopped = 0;
  a.input.value = "menu";
  a.input.oninput();
  assert.equal(rows(a.host.innerHTML, "st-file").length, 0);
  a.input.onkeydown({ key: "Escape", stopPropagation: () => { stopped += 1; } });
  assert.equal(a.t.find, "", "Escape did not clear the search");
  assert.equal(stopped, 1, "Escape went on to the document, which closes the panel");
  assert.equal(rows(a.host.innerHTML, "st-file").length, 1);

  // ANY OTHER KEY IS NOT SWALLOWED, or the box would eat every shortcut the app
  // has while the caret is in it.
  let other = 0;
  a.input.onkeydown({ key: "a", stopPropagation: () => { other += 1; } });
  assert.equal(other, 0, "the field stops every key, not only Escape");
});

test("the search box's classes are the ones the sheet paints, and the field is not in the scroll", () => {
  // THE CLASS THE MARKUP WRITES IS THE CLASS THE SHEET PAINTS, asked in both
  // directions — a rule on a class nothing draws paints nothing, and a class
  // nothing paints is an unstyled control.
  const html = TREE.stFindBox("x") + TREE.stCodeTree(TREE.stCodeFind(FIND_FILES, "booking").files, "README.md", new Set(), true);
  for (const cls of ["st-code-find", "st-find-ic", "st-find-in", "st-find-x", "st-find-said", "st-file-hits"]) {
    assert.ok(html.includes(cls), "the box draws no " + cls);
    assert.match(CSS, new RegExp("\\." + cls + "[ .:{]"), "the sheet paints no " + cls);
  }
  assert.match(CSS, /\.st-find-none \{/, "the no-match sentence is unstyled");
  // THE CLEAR IS HIDDEN UNTIL THERE IS SOMETHING TO CLEAR, and shown by the
  // class the renderer writes — the two halves have to agree or the button is
  // either always there or never.
  assert.match(CSS, /\.st-find-x \{[^}]*display: none/, "the clear button shows over an empty box");
  assert.match(CSS, /\.st-code-find\.on \.st-find-x \{[^}]*display: flex/, "the clear button never appears");
  // THE COUNT LINE TAKES NO ROOM WHEN IT SAYS NOTHING, which is what makes it a
  // sign rather than a permanent label.
  assert.match(CSS, /\.st-find-said:empty \{[^}]*display: none/, "an empty count line still holds a gap above the tree");
  // AND THE FIELD SITS OUTSIDE THE SCROLLER. Both are in the tree column, and
  // only one of them scrolls.
  assert.match(CSS, /\.st-code-find \{[^}]*flex: none/, "the search box shrinks as the tree grows");
  assert.match(CSS, /\.st-code-tree \{[^}]*flex-direction: column/, "the column is not a head over a scroller");
});

// ───────────────────────────────────────────────────────────────────────────
// THE ROW MENU (2026-09-12, owner: "add the ... menu on each row").
//
// Three entries, because the panel does not write: rename, delete and new-file
// would each promise something the Code tab cannot do. Everything it offers acts
// on ONE file's bytes, which is also why folders have no handle.

test("DRIVEN: each menu entry reads the field it says it does", () => {
  const { stRowMenuAct } = TREE;
  const file = { name: "src/routes/-parts/tide-window-chart.tsx", text: "a\nb\nc\n" };
  const copied = [], saved = [];
  const deps = { copy: (t) => copied.push(t), save: (t, n) => saved.push([n, t]) };

  // COPY PATH is the FULL path, not the basename — it is what you paste into an
  // import, and two files can share a basename across folders.
  assert.match(stRowMenuAct("path", file, deps), /Path copied/);
  assert.deepEqual(copied, [file.name], "copy path copied something other than the path");

  // COPY CONTENTS is the WHOLE file. The pane clips at 120,000 characters so a
  // megabyte cannot lock the tab; a copy that silently lost the end would be the
  // lying instrument the clip exists to avoid, one control over.
  copied.length = 0;
  assert.match(stRowMenuAct("text", file, deps), /Copied tide-window-chart\.tsx — 4 lines/);
  assert.deepEqual(copied, [file.text], "copy contents copied something other than the file's own text");
  const big = { name: "a.tsx", text: "x".repeat(200000) };
  stRowMenuAct("text", big, deps);
  assert.equal(copied[1].length, 200000, "the copy was clipped to what the pane shows");

  // DOWNLOAD hands the saver the bytes and the BASENAME — a file called
  // `src/routes/index.tsx` must not try to reach the disk as a path.
  assert.equal(stRowMenuAct("file", file, deps), "", "download toasted, where the browser's own download bar says it");
  assert.deepEqual(saved, [["tide-window-chart.tsx", file.text]], "download saved the wrong name or the wrong bytes");

  // A FILE IT CANNOT FIND DOES NOTHING AND SAYS NOTHING, rather than copying the
  // empty string under a "copied" toast — this app's own "doing less than was
  // asked while saying it was done".
  copied.length = 0; saved.length = 0;
  for (const missing of [null, undefined, {}, { text: "x" }]) {
    assert.equal(stRowMenuAct("path", missing, deps), "", "a nameless file was acted on");
    assert.equal(stRowMenuAct("text", missing, deps), "");
  }
  assert.deepEqual(copied, [], "something was copied for a file that is not there");
  assert.deepEqual(saved, [], "something was saved for a file that is not there");
  // AN EMPTY FILE IS SAID, not silently "copied".
  assert.match(stRowMenuAct("text", { name: "e.txt", text: "" }, deps), /Nothing to copy/);
  assert.deepEqual(copied, [], "an empty file was copied under a success sentence");
  // AN ENTRY NOBODY DEFINED DOES NOTHING.
  assert.equal(stRowMenuAct("rename", file, deps), "", "an unknown action did something");
  // AND IT NEVER REACHES A CLIPBOARD OR A DISK ITSELF — the deps are the whole
  // of its access, which is what makes it drivable at all.
  assert.doesNotThrow(() => stRowMenuAct("path", file, {}), "the decision needs its deps to exist");
  assert.doesNotThrow(() => stRowMenuAct("file", file, {}));
});

test("DERIVED: the menu draws one entry per action, and every glyph is one the table has", () => {
  const { stRowMenuHtml, ST_ROW_ACTS } = TREE;
  const html = stRowMenuHtml();
  assert.ok(ST_ROW_ACTS.length >= 3, "only " + ST_ROW_ACTS.length + " actions — this check is measuring nothing");
  assert.equal([...html.matchAll(/data-act="/g)].length, ST_ROW_ACTS.length,
    "the menu and its list disagree about how many entries there are");
  for (const [act, label, icon] of ST_ROW_ACTS) {
    assert.ok(html.includes('data-act="' + act + '"'), act + " is in the list and not in the menu");
    assert.ok(html.includes(label), act + " draws no words");
    assert.ok(html.includes('data-ic="' + icon + '"'), act + " draws no glyph");
  }
  // NOTHING HERE WRITES. The entries are read-only by construction and the panel
  // has no editor behind them; a Rename or Delete would be a control promising
  // what the Code tab cannot do.
  assert.ok(!/Rename|Delete|New file/i.test(html), "the menu offers something the read-only panel cannot do");
  assert.match(html, /role="menu"/, "the menu is not announced as one");
  assert.equal([...html.matchAll(/role="menuitem"/g)].length, ST_ROW_ACTS.length, "the entries are not announced as menu items");
});

test("DRIVEN: the handle is on every file and on no folder", () => {
  const { stCodeTree, stOpenGroups } = TREE;
  const html = stCodeTree(TREE_FILES, "src/routes/index.tsx",
    new Set(TREE_FILES.flatMap((f) => [...stOpenGroups(TREE_FILES, f.name, null)])));
  const fileRows = rows(html, "st-file");
  assert.ok(fileRows.length >= 3, "only " + fileRows.length + " file rows — this check is measuring nothing");
  assert.equal([...html.matchAll(/data-srcmore="/g)].length, fileRows.length,
    "the handle count does not match the file count — a file has none, or a folder has one");
  // EVERY HANDLE NAMES ITS OWN FILE, so the menu cannot open on the wrong one and
  // a screen reader is not read a column of identical "More" buttons.
  for (const m of html.matchAll(/data-srcname="([^"]+)"/g)) {
    assert.ok(html.includes('data-srcmore="' + m[1] + '"'), m[1] + " has a row and no handle");
  }
  assert.ok(!/data-srcfold="[^"]*"[^>]*data-srcmore/.test(html), "a folder was given a handle over bytes it does not have");
  // AND THE SPOKEN NAME IS THE ONE ON THE ROW — the basename, not the path. A
  // sweep survivor: nothing read the label's contents, so "More for
  // src/routes/-parts/tide-window-chart.tsx" passed, which is the folder chain
  // read aloud on every row of a deep tree.
  for (const m of html.matchAll(/data-srcmore="([^"]+)"[^>]*aria-label="More for ([^"]+)"/g)) {
    assert.equal(m[2], m[1].split("/").pop(), "the handle is announced as the whole path rather than the name on the row");
  }
  assert.ok([...html.matchAll(/aria-label="More for /g)].length === fileRows.length, "a handle has no spoken name at all");
  const folder = html.slice(html.indexOf('data-srcfold="page/src/routes"'));
  assert.ok(!folder.slice(0, folder.indexOf("</button>")).includes("data-srcmore"), "the folder row carries a handle");
  // THE WRAPPER IS REAL AND `--d` STAYED ON THE FILE BUTTON. A `<button>` inside
  // a `<button>` is invalid and browsers HOIST the inner one out, so the two have
  // to be siblings; and the depth variable moving up would indent the handle with
  // the name and push it off a deep row.
  assert.ok(html.includes('<div class="st-file-row">'), "the row is not a wrapper, so the handle nests in the file button");
  assert.match(html, /<div class="st-file-row"><button type="button" class="st-file[^"]*"[^>]*style="--d:/,
    "`--d` is no longer on the file button");
  assert.ok(!/<div class="st-file-row"[^>]*style="--d:/.test(html), "the depth moved onto the wrapper");
});

test("DRIVEN THROUGH THE TAB: the handle opens one menu, and it shuts again", async () => {
  const clicks = new Map();
  const a = codeTab({
    answer: { ok: true, pages: [{ path: "src/routes/index.tsx", source: "// a\n" }, { path: "src/routes/menu.tsx", source: "// b\n" }] },
    open: "src/routes/index.tsx",
    bind: (html, sel) => {
      const attr = sel.slice(1, -1);
      return [...String(html).matchAll(attr + '="([^"]*)"')].map(() => ({}));
    },
  });
  await a.t.run(a.site);
  // THE MENU IS RENDERED ONCE FOR THE WHOLE TREE, outside the scrolling row list:
  // twenty-eight rows would otherwise carry twenty-eight hidden menus and a
  // second place for the open state to live.
  const shell = a.host.innerHTML.slice(0, a.host.innerHTML.indexOf('<div class="st-code-rows">'));
  assert.equal([...a.host.innerHTML.matchAll(/id="stRowMenu"/g)].length, 1, "there is not exactly one menu");
  assert.ok(shell.includes('id="stRowMenu"') || a.host.innerHTML.indexOf('id="stRowMenu"') > a.host.innerHTML.indexOf("</div>"),
    "the menu is inside the row list, where every keystroke in the search box rebuilds it");
  // AND IT IS DRAWN SHUT. A menu that comes up open is one nobody asked for.
  assert.ok(!/id="stRowMenu"[^>]*class="[^"]*open/.test(a.host.innerHTML), "the menu is drawn already open");
  assert.match(a.host.innerHTML, /data-srcmore="src\/routes\/menu\.tsx"[^>]*aria-expanded="false"/,
    "a handle does not say whether its menu is open");
});

/**
 * A BINDER THAT ANSWERS REAL BUTTONS, so a case can press one.
 *
 * The menu case above only needs to COUNT rows, so it hands back bare objects.
 * Everything below presses a row and reads what happened, which needs the
 * `dataset` the real handler looks its file up by and somewhere for the handler
 * to be written. `press` takes the LAST element bound under that value, because
 * a repaint binds the whole tree again and the stale ones are what a customer
 * cannot click.
 */
function pressable({ ghost = "" } = {}) {
  const seen = [];
  const row = (key, val) => {
    const b = {
      dataset: { [key]: val }, onclick: null,
      getAttribute: () => "false", setAttribute: () => {},
      classList: { add() {}, remove() {} },
    };
    seen.push(b);
    return b;
  };
  const bind = (html, sel) => {
    const attr = sel.slice(1, -1);
    const key = attr.replace(/^data-/, "");
    const out = [...String(html).matchAll(new RegExp(attr + '="([^"]*)"', "g"))].map((m) => row(key, m[1]));
    // A ROW NAMING A FILE THE PROJECT HAS NOT GOT. The tree cannot draw one, so
    // nothing reachable from the markup drives the handler's "I could not find
    // it" leg — and that leg is what stands between a stale row and
    // `stCodeFileHtml(undefined)`, which throws and takes the panel with it.
    if (ghost && key === "srcname") out.push(row(key, ghost));
    return out;
  };
  return {
    bind,
    press(key, val) {
      const b = seen.filter((x) => x.dataset[key] === val).pop();
      assert.ok(b, "nothing in the tree is marked " + key + '="' + val + '"');
      assert.ok(b.onclick, key + '="' + val + '" was drawn with no handler — it does nothing when clicked');
      b.onclick();
    },
  };
}
const TWO_PAGES = { ok: true, pages: [
  { path: "src/routes/index.tsx", source: "// home\n" },
  { path: "src/routes/menu.tsx", source: "// menu\n" },
] };

test("DRIVEN: a row click repaints the file and the tree, and NEVER the panel", async () => {
  const hands = pressable();
  const a = codeTab({ answer: TWO_PAGES, open: "src/routes/index.tsx", bind: hands.bind });
  await a.t.run(a.site);
  const drawn = a.host.draws;
  assert.equal(drawn, 1, "the first draw did not happen exactly once");
  assert.match(a.host.innerHTML, /class="st-code-fname">src\/routes\/index\.tsx</, "the bar does not name the open file");

  hands.press("srcname", "src/routes/menu.tsx");

  // THE PANEL WAS NOT REBUILT, and that is the whole of it. Writing the host's
  // `innerHTML` puts a brand-new `.st-code` into the document, and `styles.css`
  // gives that element an entrance animation — written for a TAB SWITCH, back
  // when nothing else built this panel. MEASURED in a real browser: a rebuild
  // here drops the whole panel 8px, fades it to zero and slides it back over
  // 220ms, on every single row press. The owner's words were "the screen
  // vibrates every time I click on one of them", twice.
  assert.equal(a.host.draws, drawn,
    "a row click rebuilt the whole panel, so its entrance animation runs again and the panel twitches on every press");
  // AND IT REALLY REPAINTED, so the line above is not passing on a click that
  // did nothing at all — which is the cheapest way for this case to go quiet.
  assert.equal(a.t.open, "src/routes/menu.tsx", "the click did not change which file is open");
  assert.match(a.host.innerHTML, /class="st-code-fname">src\/routes\/menu\.tsx</, "the bar still names the file before it");
  assert.match(a.host.innerHTML, /class="st-file on"[^>]*data-srcname="src\/routes\/menu\.tsx"/, "the tree does not mark the file now open");
  assert.ok(!/class="st-file on"[^>]*data-srcname="src\/routes\/index\.tsx"/.test(a.host.innerHTML),
    "the tree still marks the file before it as open");
});

test("DRIVEN: a fold click repaints the tree and leaves the file being read alone", async () => {
  const hands = pressable();
  const a = codeTab({ answer: TWO_PAGES, open: "src/routes/index.tsx", bind: hands.bind });
  await a.t.run(a.site);
  const drawn = a.host.draws;
  const main = a.host.querySelector(".st-code-main").innerHTML;
  const rows = a.host.querySelector(".st-code-rows").innerHTML;
  assert.ok(main.includes("st-code-pre"), "the editor column was never filled, so this case can prove nothing");
  assert.ok(rows.includes('data-srcname="src/routes/menu.tsx"'), "the tree was never filled");

  hands.press("srcfold", "page");

  assert.equal(a.host.draws, drawn, "a fold click rebuilt the whole panel, which is the twitch one row over");
  // A FOLD CHANGES NOTHING ABOUT THE FILE BEING READ, so rebuilding the editor
  // beside it is a `<pre>` thrown back to its first line for a click that was
  // about the tree. The search box's own argument, one control over.
  assert.equal(a.host.querySelector(".st-code-main").innerHTML, main,
    "folding a directory rebuilt the editor beside it, scrolling the file being read back to the top");
  assert.notEqual(a.host.querySelector(".st-code-rows").innerHTML, rows, "the fold changed nothing in the tree");
  assert.ok(!a.host.querySelector(".st-code-rows").innerHTML.includes('data-srcname="src/routes/menu.tsx"'),
    "the group was folded and its files are still drawn");
});

test("DRIVEN: the Download button follows the file that is open NOW", async () => {
  const saved = [];
  const hands = pressable();
  const a = codeTab({
    answer: TWO_PAGES, open: "src/routes/index.tsx", bind: hands.bind,
    save: (blob, name) => saved.push(name),
  });
  await a.t.run(a.site);
  assert.ok(a.host.dl && a.host.dl.onclick, "the Download button was never bound on the first draw");
  a.host.dl.onclick();
  assert.deepEqual(saved, ["index.tsx"], "the first press did not save the open file");

  hands.press("srcname", "src/routes/menu.tsx");

  // THE BUTTON LIVES INSIDE WHAT `paintFile` REPLACES, so the element that was
  // bound no longer exists — a repaint that did not rebind leaves a dead control
  // in the bar, and a dead control is this app's own recorded finding.
  assert.ok(a.host.dl && a.host.dl.onclick, "the Download button is dead after a row click — nothing rebound it");
  a.host.dl.onclick();
  assert.deepEqual(saved, ["index.tsx", "menu.tsx"], "Download saved the file that WAS open, not the one on screen");
});

test("DRIVEN: the tree keeps its place across a click, and a NEW QUERY starts at the top", async () => {
  const hands = pressable();
  const a = codeTab({ answer: TWO_PAGES, open: "src/routes/index.tsx", bind: hands.bind });
  await a.t.run(a.site);
  const at = () => a.host.querySelector(".st-code-rows").scrollTop;

  a.host.querySelector(".st-code-rows").scrollTop = 140;
  hands.press("srcname", "src/routes/menu.tsx");
  assert.equal(at(), 140, "a row click threw the tree back to the top — a customer reading a file near the bottom loses their place on every press");

  a.host.querySelector(".st-code-rows").scrollTop = 90;
  hands.press("srcfold", "page");
  assert.equal(at(), 90, "a fold click threw the tree back to the top");

  // AND A NEW SET OF RESULTS IS A NEW LIST. Holding an offset into it lands the
  // customer in the middle of matches they have not seen, so the search box
  // resets rather than `paintTree` guessing which of the two it is serving.
  a.host.querySelector(".st-code-rows").scrollTop = 70;
  a.input.value = "menu";
  a.input.oninput();
  assert.equal(at(), 0, "a new query kept a scroll offset into the list before it");
});

test("DRIVEN: clicking the file that is ALREADY open changes nothing at all", async () => {
  const hands = pressable();
  const a = codeTab({ answer: TWO_PAGES, open: "src/routes/index.tsx", bind: hands.bind });
  await a.t.run(a.site);
  // WHERE THE CUSTOMER HAD READ TO. Repainting the editor replaces the scroller
  // inside it, so the file jumps back to line 1 — for a click that asked for the
  // file already on screen. The cheapest possible way to lose somebody's place.
  a.host.querySelector(".st-code-main").scrollTop = 300;
  hands.press("srcname", "src/routes/index.tsx");
  assert.equal(a.host.querySelector(".st-code-main").scrollTop, 300,
    "clicking the open file repainted it, scrolling the customer back to its first line");
  assert.equal(a.t.open, "src/routes/index.tsx", "the open file changed");
});

test("DRIVEN: a row naming a file the project has not got does nothing, and does not throw", async () => {
  const hands = pressable({ ghost: "src/routes/gone.tsx" });
  const a = codeTab({ answer: TWO_PAGES, open: "src/routes/index.tsx", bind: hands.bind });
  await a.t.run(a.site);
  // A STALE ROW IS AN ORDINARY THING — the tree is rebuilt from a list that can
  // have changed under it. Reading the file as `undefined` and painting anyway
  // throws inside the renderer and leaves the panel half drawn, which is a worse
  // answer than the click doing nothing.
  hands.press("srcname", "src/routes/gone.tsx");
  assert.equal(a.t.open, "src/routes/index.tsx", "a row naming nothing changed which file is open");
  assert.match(a.host.innerHTML, /class="st-code-fname">src\/routes\/index\.tsx</, "the bar no longer names a file");
});

test("DRIVEN: the pane clips a huge file and escapes every file", async () => {
  const big = "x".repeat(130000);
  const a = codeTab({
    answer: { ok: true, pages: [
      { path: "src/routes/big.tsx", source: big },
      { path: "src/routes/evil.tsx", source: '<script>alert(1)</script>\n' },
    ] },
    open: "src/routes/big.tsx",
  });
  await a.t.run(a.site);
  // CLIPPED FOR DISPLAY ONLY. A `<pre>` of a megabyte locks the tab; the zip and
  // the Download still carry the whole file, which `stSrcFiles` feeds and the
  // saver reads — so the clip must not be able to reach either.
  const shown = a.host.innerHTML.match(/<code>(x*)<\/code>/);
  assert.ok(shown, "the source is not in the pane at all");
  assert.equal(shown[1].length, 120000, "the pane is not clipping — it drew " + shown[1].length + " characters");
  assert.equal(a.t.files.find((f) => f.name === "src/routes/big.tsx").text.length, 130000,
    "the clip reached the stored file, so the download would lose the end of it");
  // AND THE GUTTER COUNTS THE LINES IT ACTUALLY DREW, not the ones it clipped off.
  assert.match(a.host.innerHTML, /<pre class="st-code-gutter" aria-hidden="true">1<\/pre>/, "the gutter is not numbering the clipped text");

  // ESCAPED, because a customer's own page source is full of tags and one of them
  // is `<script>`. The panel shows code; it must never run it.
  const b = codeTab({
    answer: { ok: true, pages: [{ path: "src/routes/evil.tsx", source: '<script>alert(1)</script>\n' }] },
    open: "src/routes/evil.tsx",
  });
  await b.t.run(b.site);
  assert.ok(!b.host.innerHTML.includes("<script>"), "the pane put the file's own <script> into the page unescaped");
  assert.match(b.host.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, "the file's source is not shown at all");
});

test("DRIVEN: the shell is empty in both columns, so neither is written in two places", async () => {
  const a = codeTab({ answer: TWO_PAGES, open: "src/routes/index.tsx" });
  await a.t.run(a.site);
  // ONE PRODUCER PER COLUMN. The shell used to carry the whole editor inline, so
  // a repaint needed a SECOND copy of that markup — two lists of the same thing,
  // with the copy that drifts being the one nothing clicks.
  assert.match(a.host.shell, /<div class="st-code-main"><\/div>/, "the shell writes the editor column itself");
  assert.match(a.host.shell, /<div class="st-code-rows"><\/div>/, "the shell writes the tree itself");
  assert.ok(!/st-code-pre|stCodeDl|st-code-fname/.test(a.host.shell), "the shell carries markup `paintFile` also owns");
  assert.ok(!/st-file|st-code-h/.test(a.host.shell), "the shell carries markup `paintTree` also owns");
  // AND BOTH WERE FILLED, or the four lines above pass on a panel that drew nothing.
  assert.match(a.host.innerHTML, /st-code-pre/, "the editor column was never filled");
  assert.match(a.host.innerHTML, /data-srcname=/, "the tree was never filled");
});

test("the row menu's classes are the ones the sheet paints, and the handle hides until you point at it", () => {
  const html = TREE.stRowMenuHtml() + TREE.stCodeTree(TREE_FILES, "src/routes/index.tsx", new Set(["page", "page/src/routes"]));
  for (const cls of ["st-file-row", "st-file-more", "st-row-menu", "st-row-item", "st-row-ic"]) {
    assert.ok(html.includes(cls), "nothing draws a " + cls);
    assert.match(CSS, new RegExp("\\." + cls + "[ .:{,]"), "the sheet paints no " + cls);
  }
  // HIDDEN UNTIL HOVER, AND REACHABLE BY KEYBOARD. `:focus-within` is not
  // politeness — a handle that is `display: none` cannot be focused at all, so
  // without it the menu is mouse-only.
  assert.match(CSS, /\.st-file-more \{[^}]*display: none/, "the handle is on every row all the time");
  assert.match(CSS, /\.st-file-row:hover \.st-file-more[^{]*\{[^}]*display: flex/, "the handle never appears");
  assert.match(CSS, /:focus-within \.st-file-more/, "the handle cannot be reached by keyboard");
  // THE MENU ESCAPES THE 210px COLUMN. It is placed off the handle's rect, and
  // the column scrolls — anything but `fixed` is clipped by the one box it has
  // to get out of.
  assert.match(CSS, /\.st-row-menu \{[^}]*position: fixed/, "the menu is clipped by the tree column");
  assert.match(CSS, /\.st-row-menu\.open \{[^}]*display: block/, "the menu never opens");
  assert.ok(!/\.st-row-menu \{[^}]*display: block/.test(CSS), "the menu is drawn open by default");
  // AND IT IS OPAQUE — a sweep survivor, and the defect the render caught before
  // this shipped. `--panel` is `rgba(51,49,61,0.055)`: 5.5% ink, which reads as a
  // surface on the media side's dark chrome and as nothing at all on cream, so
  // the tree rows underneath show straight through the menu and both sets of
  // words fight. Asserted as ONE background declaration that is the paper, since
  // a second one appended after it is what the sweep did and what a later edit
  // borrowing the other dropdown's styling would do.
  const menuRule = CSS.slice(CSS.indexOf(".st-row-menu {"), CSS.indexOf("}", CSS.indexOf(".st-row-menu {")));
  assert.ok(menuRule.includes(".st-row-menu {"), "the menu rule is gone");
  assert.equal([...menuRule.matchAll(/background:/g)].length, 1, "the menu has two backgrounds — the later one wins and may be see-through");
  assert.match(menuRule, /background: var\(--bg\)/, "the menu no longer paints on the paper, so the tree reads through it");
  assert.ok(!/background: var\(--panel/.test(menuRule), "the menu paints with a translucent token and the rows show through it");
  // THE ROW IS A FLEX PAIR, so the name takes the space and the handle sits at
  // the end rather than wrapping to its own line.
  assert.match(CSS, /\.st-file-row \{[^}]*display: flex/, "the row is not a flex pair");
  assert.match(CSS, /\.st-file-row > \.st-file \{[^}]*flex: 1/, "the name does not take the row's width");
  // AND THE HEADING SPACING FOLLOWED THE WRAPPER. `.st-file` is no longer a
  // sibling of the next group heading; pinned here because nothing about the
  // markup can see a rule that quietly stopped matching.
  assert.match(CSS, /\.st-file-row \+ \.st-code-h/, "a group heading after files runs straight into them");
  assert.ok(!/\.st-file \+ \.st-code-h/.test(CSS), "the spacing rule still names a sibling that no longer exists");
});
