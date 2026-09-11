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
 * The real Code tab, out of the file, with a fake document.
 *
 * Same reason as the downloader: `siteCodeOpen` is a module-level `let` that
 * survives renders, and which file is open across a rebuild is exactly what is
 * being asked.
 */
function codeTab({ answer, open = "", slug = "fretwork-1", fail = false, groups = null, host } = {}) {
  // BOTH HALVES, because they are one hop. `loadSiteCode` fetches and hands the
  // answer to `drawSiteCode`, which draws and wires; carrying only the first
  // would drive a function whose whole body is now one call.
  const body = fn("async function loadSiteCode(site)") + "\n" + fn("function drawSiteCode(src)");
  host = host || { innerHTML: "", querySelectorAll: () => [] };
  const make = new Function("deps", [
    "const { document, apiFetch, stSrcFiles, stCodeTree, stOpenGroups, esc, ic, stSaveBlob } = deps;",
    "let siteCodeFiles = []; let siteCodeOpen = deps.open; let siteCodeOpenGroups = deps.groups;",
    body,
    "return { run: loadSiteCode, draw: drawSiteCode,",
    "  get open() { return siteCodeOpen; }, get files() { return siteCodeFiles; },",
    "  get groups() { return siteCodeOpenGroups; } };",
  ].join("\n"));
  let asked = 0;
  const t = make({
    open,
    groups,
    document: { getElementById: (id) => (id === "stCode" ? host : null) },
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
    esc: escFake, ic: () => "", stSaveBlob: () => {},
  });
  return { t, host, site: { slug }, fetches: () => asked };
}
const TREE = new Function("esc", "ic", "ST_CODE_GROUPS",
  fn("function stOpenGroups(") + "\n" + fn("function stCodeTree(") + "\nreturn { stOpenGroups, stCodeTree };")(
  escFake, () => "", [["page", "Pages"], ["part", "Components"], ["asset", "Made by the build"], ["shared", "Shared with every site"]]);

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

test("DRIVEN: the bar says READ ONLY, and a file that needs a sentence gets one", async () => {
  // TWO SMALL THINGS THE SWEEP FOUND UNGUARDED, and both are a customer being
  // told something true that nothing was keeping true.
  //
  // (1) THE PANEL HAS NEVER BEEN EDITABLE AND NEVER SAID SO, which leaves
  // somebody clicking into a file wondering whether they may type in it. It is
  // a label, so it can be deleted without anything failing — which is exactly
  // why it needs a driver rather than a reading.
  const a = codeTab({ answer: PAGES(["src/routes/index.tsx"]) });
  await a.t.run(a.site);
  assert.match(a.host.innerHTML, /class="st-code-ro">Read only</,
    "the Code tab no longer says it is read only — a customer cannot tell whether they may type in it");

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
  for (const [what, attr] of [["the file picker", "data-srcname"], ["the folder", "data-srcgroup"]]) {
    const at = draw.indexOf("[" + attr + "]");
    assert.ok(at > 0, what + " is no longer wired");
    assert.match(draw.slice(at, at + 400), /drawSiteCode\(src\)/, what + " does not redraw");
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
  const uses = [...BARE.matchAll(/stSaveBlob\(/g)];
  assert.equal(uses.length, 3, "expected the definition and both downloads; found " + uses.length);
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
  for (const [what, body] of [["the top bar's zip", barDl], ["the tab's per-file download", tabDl]]) {
    assert.ok(!/createObjectURL/.test(body), what + " makes its own blob URL instead of using the saver");
    assert.match(body, /stSaveBlob\(/, what + " no longer reaches the disk through the one saver");
  }
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
  assert.match(CSS, /\.st-code-tree \{[^}]*overflow-y: auto/, "the file tree lost its scroll");
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
const ALL_OPEN = new Set(["page", "part", "asset", "shared"]);

test("DRIVEN: the tree groups the project, and a shared file keeps its real path", () => {
  const { stCodeTree } = TREE;
  const files = TREE_FILES;
  // EVERY FOLDER OPEN, because what this case asserts is the DISPLAY NAMES and
  // the marking — which a folded folder simply does not draw. Folding has its
  // own case below; conflating the two would make this one go red for a change
  // to the fold default, reporting the names as wrong.
  const html = stCodeTree(files, "public/icon.svg", ALL_OPEN);
  for (const label of ["Pages", "Components", "Made by the build", "Shared with every site"]) {
    assert.ok(html.includes(label), "the tree has no " + label + " heading");
  }
  // A HEADING OVER NOTHING reads as something missing rather than absent.
  assert.ok(!stCodeTree([{ name: "a.tsx", kind: "page" }], "a.tsx", ALL_OPEN).includes("Made by the build"),
    "an empty group was given a heading");
  // THE PREFIX IS DROPPED IN THE CUSTOMER'S OWN GROUPS ONLY. `src/routes/` is
  // noise repeated down the first two; on the SHARED root route, stripping it
  // makes a platform file read as one sitting beside the customer's pages.
  assert.ok(html.includes(">index.tsx<"), "a page kept a prefix every file in its group shares");
  assert.ok(html.includes(">-parts/band-1-hero.tsx<"), "a component's display name is wrong");
  assert.ok(html.includes(">src/routes/__root.tsx<"), "the shared root route lost its path and reads as the customer's own");
  assert.ok(html.includes(">public/icon.svg<") && html.includes(">package.json<"), "a real path was mangled");
  // THE OPEN FILE IS MARKED, and the data attribute is the full name the click
  // handler looks a file up by — never the display name.
  assert.match(html, /data-srcname="public\/icon\.svg"[^>]*/, "the open file cannot be looked up by what the row carries");
  assert.ok(/class="st-file on"[^>]*data-srcname="public\/icon\.svg"/.test(html), "the open file is not marked open");
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
    const at = shut.indexOf('data-srcgroup="' + key + '"');
    assert.ok(at > 0, "the " + key + " folder is gone");
    assert.match(shut.slice(at, shut.indexOf("</button>", at)),
      new RegExp('class="st-code-count">' + n + "<"), "the " + key + " folder does not say it holds " + n);
  }
  // SHUT DRAWS NO FILES, OPEN DRAWS THEM ALL. Both directions, because a tree
  // that always draws its files is a tree that never folded, and one that never
  // draws them is a tree nothing can open.
  assert.equal(rows(shut, "st-file").length, 0, "a shut folder still lists its files");
  assert.equal(rows(stCodeTree(TREE_FILES, "src/routes/index.tsx", ALL_OPEN), "st-file").length, TREE_FILES.length,
    "an open folder does not list its files");
  // ONE FOLDER AT A TIME: opening Components must not open anything else.
  const one = stCodeTree(TREE_FILES, "src/routes/index.tsx", new Set(["part"]));
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
    const at = html.indexOf('data-srcgroup="' + key + '"');
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
  assert.deepEqual([...stOpenGroups(TREE_FILES, "src/routes/index.tsx", null)], ["page"]);
  assert.deepEqual([...stOpenGroups(TREE_FILES, "src/routes/index.tsx", new Set())], [],
    "a customer who closed every folder gets one re-opened");
  // DERIVED FROM THE OPEN FILE, never a hardcoded `page`. A rebuild can replace
  // the file list while the chosen file is a component, so a fixed default would
  // fold the folder holding the file being shown.
  for (const [name, kind] of [["src/routes/-parts/band-1-hero.tsx", "part"], ["public/icon.svg", "asset"], ["package.json", "shared"]]) {
    assert.deepEqual([...stOpenGroups(TREE_FILES, name, null)], [kind], name + " does not open its own folder");
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
  for (const junk of [[], "page", { has: () => true }, 0]) {
    assert.deepEqual([...stOpenGroups(TREE_FILES, "src/routes/index.tsx", junk)], ["page"],
      "a " + typeof junk + " was read as a stored choice");
  }
  assert.deepEqual([...stOpenGroups(null, "x", null)], ["page"], "a missing file list throws instead of drawing");
});

test("DRIVEN THROUGH THE TAB: a click really folds, and the fold survives the redraw", async () => {
  // THE CHAIN, not the function. `stOpenGroups` answering correctly says nothing
  // about whether anybody STORES what the click computed — a handler that builds
  // a new Set and drops it leaves every case above green and the folder shut for
  // ever. This repository's most-shipped failure, so it is driven end to end.
  const clicks = new Map();
  const host = {
    innerHTML: "",
    querySelectorAll(sel) {
      const attr = sel.slice(1, -1);
      const out = [...String(this.innerHTML).matchAll(new RegExp(attr + '="([^"]*)"', "g"))]
        .map((m) => ({ dataset: { [attr === "data-srcgroup" ? "srcgroup" : "srcname"]: m[1] }, set onclick(f) { clicks.set(attr + ":" + m[1], f); } }));
      return out;
    },
  };
  const a = codeTab({
    answer: { ok: true, pages: [{ path: "src/routes/index.tsx", source: "// page\n" }], assets: [{ path: "public/icon.svg", source: "<svg/>" }] },
    open: "src/routes/index.tsx", host,
  });
  await a.t.run(a.site);
  assert.equal(a.t.groups, null, "the tab stored a choice nobody made");
  assert.equal(rows(host.innerHTML, "st-file").length, 1, "the first draw is not one folder open");

  // THE CLICK OPENS THE OTHER FOLDER — and the one holding the open file stays
  // open, which is what materialising the derived default before toggling buys.
  clicks.get("data-srcgroup:asset")();
  assert.deepEqual([...a.t.groups].sort(), ["asset", "page"], "the click did not store the fold");
  assert.equal(rows(host.innerHTML, "st-file").length, 2, "the folder that was clicked did not open");

  // AND SHUTTING IT AGAIN IS THE SAME CLICK. A handler that only ever adds is a
  // folder that opens once and never closes.
  clicks.get("data-srcgroup:asset")();
  assert.deepEqual([...a.t.groups], ["page"], "a second click did not shut the folder");
  assert.equal(rows(host.innerHTML, "st-file").length, 1);

  // THE FOLD SURVIVES A RE-FETCH, because it is the customer's preference and
  // not a property of the answer. A rebuild must not silently re-open folders.
  clicks.get("data-srcgroup:page")();
  assert.deepEqual([...a.t.groups], [], "every folder shut is not a state the tab can hold");
  await a.t.run(a.site);
  assert.deepEqual([...a.t.groups], [], "a re-fetch threw the customer's folds away");
  assert.equal(rows(host.innerHTML, "st-file").length, 0, "a re-fetch re-opened a folder the customer shut");

  // AND A CLICK NEVER GOES BACK TO THE NETWORK. One fetch, three clicks.
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
  assert.match(CSS, /\.st-code-h\.on \.st-code-caret \{[^}]*rotate\(-90deg\)/,
    "the chevron never turns, so a folder looks shut whether it is or not");
  assert.match(CSS, /\.st-code-h \{[^}]*cursor: pointer/, "a folder does not read as clickable");
  assert.match(CSS, /\.st-code-h:hover \{/, "a folder gives no sign it can be pressed");
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
