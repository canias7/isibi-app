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
  // Junk in the store is dropped rather than shown as an empty file.
  assert.deepEqual(stSrcFiles({ pages: [{ path: "index.tsx" }, { source: "no path" }], parts: null }), []);
  for (const junk of [null, undefined, {}, { pages: "x" }]) assert.deepEqual(stSrcFiles(junk), [], JSON.stringify(junk));
  assert.ok(stSrcPath, "the path rule is the one this list is built from");
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
async function callSource({ user = USER, slug = "gf-src-" + (++caseNo), owner = "u-owner", pages, parts, bucketFails = false } = {}) {
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
  assert.deepEqual(r.reads.sort(), ["source/" + r.body.slug + "/pages.json", "source/" + r.body.slug + "/parts.json"],
    "it read some other site's keys");
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
  assert.ok(block.length > 200 && block.length < 4000, "re-derive this window");
  assert.match(block, /loadSiteSource\(env, sslug\)/, "it no longer reads the page source");
  assert.match(block, /loadSiteParts\(env, sslug\)/, "it no longer reads the site's own components");
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
function codeTab({ answer, open = "", slug = "fretwork-1", fail = false } = {}) {
  const src = fn("async function loadSiteCode(site)");
  const host = { innerHTML: "", querySelectorAll: () => [] };
  const make = new Function("deps", [
    "const { document, apiFetch, stSrcFiles, esc, ic, stSaveBlob } = deps;",
    "let siteCodeFiles = []; let siteCodeOpen = deps.open;",
    src,
    "return { run: loadSiteCode, get open() { return siteCodeOpen; }, get files() { return siteCodeFiles; } };",
  ].join("\n"));
  const t = make({
    open,
    document: { getElementById: (id) => (id === "stCode" ? host : null) },
    apiFetch: async () => {
      if (fail) throw new Error("offline");
      return { ok: true, json: async () => answer };
    },
    stSrcFiles: (s) => {
      const out = [];
      for (const p of (s.pages || []).concat(s.parts || [])) out.push({ name: p.path || p.name, text: p.source });
      return out;
    },
    esc: escFake, ic: () => "", stSaveBlob: () => {},
  });
  return { t, host, site: { slug } };
}

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
  assert.ok(/siteView === 'code'/.test(cond), "the Code pane no longer keys on the view");
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
  const calls = [...BARE.matchAll(/loadSiteCode\(/g)];
  assert.equal(calls.length, 3, "expected the definition, the render hook and the file-picker redraw; found " + calls.length);

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
  const tabDl = fn("async function loadSiteCode(site)");
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
