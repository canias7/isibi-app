// A SITE CAN OFFER A DOCUMENT.
//
// `download-card` has been in the generator's shortlist since the kit was
// written, the corpus reaches for it 24 times, and **both upload gates sniffed
// images and nothing else** — so the platform put a download button in front of
// the model and had nowhere for the file to go. The component was reachable and
// the bytes were not, which is the on-disk-and-reachable-by-nothing property the
// 27 blocks and 196 examples were deleted for, arriving from the other side.
//
// The tests below are in four groups, and the ordering is the argument: what the
// bytes are, what the browser is told to do with them, what the routes do, and
// then the two ends of the prompt/kit agreement — because a kit that accepts a
// shape while the prompt still shows the old one is a fix nothing can use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  sniffImage, sniffUpload, maxBytesFor, dispositionFor, downloadNameFor,
  storeDownloadName, readDownloadName, DOWNLOAD_NAME_KEY, UPLOAD_EXTS,
  MAX_UPLOAD_BYTES, MAX_DOC_BYTES, MAX_VISITOR_UPLOAD_BYTES,
  handleUpload, handleUploadList, handleUploadDelete, handleVisitorUpload,
} from "../site-uploads.mjs";
import { CORPUS_DIR } from "./fixtures/corpus.mjs";

const ROOT = new URL("..", import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, ROOT)), "utf8");

// Written as a predicate over char codes rather than a regex range, because a
// range like /[\u0000-\u001f]/ is exactly what arrived in this file as two RAW
// control bytes and made `grep` skip it — the fifth recorded instance, caught by
// `test/source-bytes.test.mjs` an hour after that guard was written.
const hasControl = (s) => [...String(s)].some((c) => c.charCodeAt(0) < 32);
const bytes = (...head) => {
  const b = new Uint8Array(64);
  head.forEach((v, i) => { b[i] = v; });
  return b;
};
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
const SVG = new Uint8Array([...'<svg xmlns="http://www.w3.org/2000/svg"></svg>'].map((c) => c.charCodeAt(0)));

// ──────────────────────────────────────────────────── what the bytes actually are

test("a PDF and a zip are documents, and a picture is still a picture", () => {
  assert.deepEqual(sniffUpload(PDF), { mime: "application/pdf", ext: "pdf", kind: "doc" });
  assert.deepEqual(sniffUpload(ZIP), { mime: "application/zip", ext: "zip", kind: "doc" });
  // The image answers are byte-identical to what they always were, plus a kind.
  // Every existing caller of `sniffImage` — the photograph generator and the
  // logo lane — is untouched, and this is what proves the split rather than a
  // rewrite.
  assert.deepEqual(sniffUpload(PNG), { mime: "image/png", ext: "png", kind: "image" });
  assert.deepEqual(sniffImage(PNG), { mime: "image/png", ext: "png" });
});

test("SVG is refused by BOTH sniffers, and nothing about a document changed that", () => {
  // The reason is unchanged and is the whole reason `/u/` can serve inline at
  // all: an SVG is a document that can carry <script>, and an owner can link the
  // raw URL from their own page, at which point the browser renders it on this
  // origin whatever disposition we sent.
  assert.equal(sniffImage(SVG), null);
  assert.equal(sniffUpload(SVG), null);
  assert.equal(sniffUpload(SVG, "logo.svg"), null, "a declared extension must not open a door the bytes did not");
});

test("within the zip family the NAME picks the member, and only from the list", () => {
  // These four really are the same bytes — Office Open XML is a zip of XML parts
  // — so no magic number can separate them and the extension is the only signal
  // there is. It can only ever pick among types that are already equivalent:
  // every one is served `attachment` and none is rendered.
  assert.equal(sniffUpload(ZIP, "accounts.xlsx").ext, "xlsx");
  assert.equal(sniffUpload(ZIP, "accounts.xlsx").mime, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(sniffUpload(ZIP, "Terms.DOCX").ext, "docx", "the extension is read case-insensitively");
  assert.equal(sniffUpload(ZIP, "deck.pptx").ext, "pptx");
  // Anything else falls back rather than being trusted through.
  assert.equal(sniffUpload(ZIP, "thing.jar").ext, "zip");
  // A PROTOTYPE KEY IS NOT A MEMBER. `ZIP_MEMBERS["constructor"]` is truthy —
  // it is `Object.prototype.constructor` — so a plain truthiness lookup names
  // the file `.constructor` and hands the browser a FUNCTION as its content
  // type. That exact bug has shipped here once already, in the Stripe plan
  // lookup, which is why `Object.hasOwn` is the guard rather than truthiness.
  for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    const got = sniffUpload(ZIP, "budget." + key);
    assert.equal(got.ext, "zip", key + " was accepted as a zip member");
    assert.equal(got.mime, "application/zip");
  }
  assert.equal(sniffUpload(ZIP, "nodots").ext, "zip");
  assert.equal(sniffUpload(ZIP, "").ext, "zip");
});

test("the macro-enabled forms degrade to .zip rather than being named", () => {
  // `.xlsm`/`.docm` are the ones that carry executable macros. They are zips, so
  // they still upload; what they must never get is a name that tells the
  // visitor's own operating system to open them in Office. Pinned because the
  // obvious "completeness" edit is to add them to the map.
  assert.equal(sniffUpload(ZIP, "budget.xlsm").ext, "zip");
  assert.equal(sniffUpload(ZIP, "notes.docm").ext, "zip");
});

test("an empty archive is not a download", () => {
  // PK\x05\x06 is the end-of-central-directory record an EMPTY zip is made
  // entirely of. Accepting it means an owner uploads a file, is told it worked,
  // and hands their customers a zip with nothing in it.
  assert.equal(sniffUpload(bytes(0x50, 0x4b, 0x05, 0x06)), null);
  assert.equal(sniffUpload(bytes(0x50, 0x4b, 0x07, 0x08)), null);
});

test("a document gets more room than a photograph, and the cap follows the bytes", () => {
  assert.equal(maxBytesFor({ kind: "doc" }), MAX_DOC_BYTES);
  assert.equal(maxBytesFor({ kind: "image" }), MAX_UPLOAD_BYTES);
  // Fails toward the SMALLER cap when it cannot tell, which is the direction
  // that cannot be used to store something oversized.
  assert.equal(maxBytesFor(null), MAX_UPLOAD_BYTES);
  assert.equal(maxBytesFor({}), MAX_UPLOAD_BYTES);
  assert.ok(MAX_DOC_BYTES > MAX_UPLOAD_BYTES);
});

// ─────────────────────────────────────── what the browser is told to do with them

test("a picture is inline and a document is an attachment", () => {
  // An <img> pointing at an attachment renders nothing, and a PDF served inline
  // is opened in the browser's own viewer on this origin rather than saved —
  // which is not what a download button means.
  assert.equal(dispositionFor("image/png"), "inline");
  assert.equal(dispositionFor("image/jpeg", "cat.jpg"), "inline");
  assert.match(dispositionFor("application/pdf", "Budget.pdf"), /^attachment;/);
  assert.match(dispositionFor("application/zip", "pack.zip"), /^attachment;/);
  assert.match(dispositionFor("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a.xlsx"), /^attachment;/);
  // An unknown type is not a document — the safe direction is the one that does
  // not start offering downloads of things we did not classify.
  assert.equal(dispositionFor("application/octet-stream", "x.bin"), "inline");
  assert.equal(dispositionFor(null, "x"), "inline");
});

test("a document with no stored name is still an attachment", () => {
  // Every object written before this existed has no name. It must still not be
  // rendered inline just because we cannot say what to call it.
  assert.equal(dispositionFor("application/pdf"), "attachment");
  assert.equal(dispositionFor("application/pdf", ""), "attachment");
});

test("a filename cannot inject a header, whatever it contains", () => {
  // This value lands inside a quoted header parameter. A quote closes it and a
  // newline splits the response — and the allow-list means neither can survive
  // to be a problem, rather than being escaped correctly somewhere.
  const nasty = 'a" ; x=1' + String.fromCharCode(13, 10) + 'X-Evil: 1.pdf';
  const h = dispositionFor("application/pdf", nasty);
  assert.ok(!h.includes('"' + 'a"'), "a quote survived into the header");
  assert.ok(!hasControl(h), "a control character survived into the header");
  assert.equal(h.split('"').length - 1, 2, "exactly one quoted parameter");
});

test("a name that is not written in Latin letters keeps its own characters", () => {
  // The bare `filename=` is ASCII by the spec, so it carries the stripped
  // fallback and `filename*=` carries the real one — which is the whole reason
  // both are sent. The alternative is a Greek business's download arriving
  // called `a1b2c3d4….pdf`, the same failure the favicon initials avoid.
  const h = dispositionFor("application/pdf", "κατάλογος.pdf");
  assert.match(h, /filename\*=UTF-8''/);
  assert.match(h, /%CE%BA/, "the real name is percent-encoded UTF-8");
  // `encodeURIComponent` escapes the quote and every control character, so the
  // starred half cannot inject a header either.
  const evil = dispositionFor("application/pdf", 'ø" ; y=2.pdf');
  assert.ok(!/"[^"]*"[^"]*"/.test(evil.replace(/^attachment; filename="[^"]*"/, "")), "a quote reached the starred form");
  assert.ok(!evil.slice(evil.indexOf("filename*")).includes('"'), "a quote reached the starred form");
});

test("an ordinary English filename sends ONE form, not two copies of itself", () => {
  const h = dispositionFor("application/pdf", "Budget 2026-27.pdf");
  assert.equal(h, 'attachment; filename="Budget 2026-27.pdf"');
  assert.ok(!h.includes("filename*"), "the starred form is only worth sending when it says something new");
});

// ─────────────────────────────────────────────────────── what a download is called

test("the extension is OURS and the stem is theirs", () => {
  // A file called `invoice.exe` whose bytes are a PDF comes back down as
  // `invoice.pdf`: the two can never disagree, because only one of them is
  // taken from the caller.
  assert.equal(downloadNameFor("invoice.exe", "pdf"), "invoice.pdf");
  assert.equal(downloadNameFor("Budget 2026-27.pdf", "pdf"), "Budget 2026-27.pdf");
  assert.equal(downloadNameFor("wire-the-north-2026.pdf", "pdf"), "wire-the-north-2026.pdf",
    "a hyphen is part of a real filename, not a separator to collapse");
  assert.equal(downloadNameFor("no-extension-at-all", "pdf"), "no-extension-at-all.pdf");
});

test("a download name can never carry a path or an invisible", () => {
  // `../` in a suggested filename is a request to write outside the downloads
  // folder, and `\p{Cf}` is where the bidi overrides live — the character that
  // makes `photos<RLO>gpj.exe` DISPLAY as `photosexe.jpg`, which is the oldest
  // filename spoof there is and is invisible in every log.
  // A PATH BECOMES ITS BASENAME, the way a browser does it — not a name with
  // every directory flattened into it, which is both ugly and a `..` away from
  // being a path again.
  assert.equal(downloadNameFor("../../etc/passwd", "pdf"), "passwd.pdf");
  assert.equal(downloadNameFor("a\\b\\c.pdf", "pdf"), "c.pdf");
  assert.equal(downloadNameFor("/tmp/x/report.pdf", "pdf"), "report.pdf");
  const rlo = downloadNameFor("holiday" + String.fromCharCode(0x202e) + "fdp.exe", "pdf");
  assert.ok(!/[‪-‮⁦-⁩]/u.test(rlo), "a bidi override survived: " + JSON.stringify(rlo));
  assert.ok(!hasControl(downloadNameFor("a" + String.fromCharCode(0) + "b.pdf", "pdf")));
});

test("a name that is only punctuation gets no name at all", () => {
  // Null, not a bare extension. The caller falls back to the hash name, which is
  // ugly and correct; `.pdf` alone is a hidden file on every unix-ish machine.
  assert.equal(downloadNameFor("", "pdf"), null);
  assert.equal(downloadNameFor("   ", "pdf"), null);
  assert.equal(downloadNameFor("...", "pdf"), null);
  assert.equal(downloadNameFor("/", "pdf"), null);
  assert.equal(downloadNameFor(null, "pdf"), null);
  assert.equal(downloadNameFor(".hidden", "pdf"), "hidden.pdf", "a leading dot is dropped, not kept");
});

test("a very long name is capped", () => {
  const out = downloadNameFor("x".repeat(500) + ".pdf", "pdf");
  assert.ok(out.length <= 65, "got " + out.length);
  assert.ok(out.endsWith(".pdf"));
});

test("the stored form round-trips exactly, and an unreadable one is not guessed at", () => {
  // ONE PLACE KNOWS THE ENCODING. The upload route writes this and the serve
  // route reads it, ~6,000 lines apart, and a contract shared between two call
  // sites with no function in the middle is the shape this repo has recorded a
  // dozen times.
  for (const n of ["Budget 2026-27.pdf", "κατάλογος.pdf", "報告書.pdf", "a b c.zip"]) {
    const stored = storeDownloadName(n);
    assert.ok(!/[^\x20-\x7e]/.test(stored), "the stored value must be ASCII: " + stored);
    assert.equal(readDownloadName(stored), n);
  }
  assert.equal(storeDownloadName(null), null);
  assert.equal(storeDownloadName(""), null);
  assert.equal(readDownloadName("%E0%A4%A"), "", "a value we cannot decode is one we did not write");
  assert.equal(readDownloadName(undefined), "");
  assert.equal(readDownloadName(7), "");
});

// ───────────────────────────────────────────────────────────── through the routes

const harness = ({ objects = [], owner = "owner-1" } = {}) => {
  const puts = [];
  const removes = [];
  return {
    puts, removes,
    deps: {
      gate: async (_s, uid) => (uid === owner ? {} : { error: { status: 404, body: { error: "no such site" } } }),
      hash: async () => "b".repeat(64),
      list: async () => objects,
      put: async (key, b, ct, meta) => { puts.push({ key, size: b.length, ct, meta }); },
      remove: async (key) => { removes.push(key); },
    },
  };
};

test("an owner can upload a PDF, and it is stored under the name they picked", async () => {
  const { deps, puts } = harness();
  const r = await handleUpload(deps, { slug: "cafe", uid: "owner-1", bytes: PDF, filename: "Menu spring.pdf" });
  assert.equal(r.status, 201);
  assert.equal(r.body.kind, "doc");
  assert.equal(r.body.mime, "application/pdf");
  assert.equal(r.body.download, "Menu spring.pdf");
  assert.match(r.body.url, /^\/u\/cafe\/b{32}\.pdf$/, "the STORED name is still the content hash");
  assert.equal(puts.length, 1);
  assert.equal(puts[0].ct, "application/pdf");
  assert.equal(readDownloadName(puts[0].meta[DOWNLOAD_NAME_KEY]), "Menu spring.pdf");
});

test("a document may be bigger than a photograph, and each is told the right limit", async () => {
  const big = (head, n) => { const b = new Uint8Array(n); head.forEach((v, i) => { b[i] = v; }); return b; };
  const sevenMB = 7_000_000;

  const doc = await handleUpload(harness().deps, { slug: "cafe", uid: "owner-1", bytes: big([0x25, 0x50, 0x44, 0x46, 0x2d], sevenMB), filename: "brochure.pdf" });
  assert.equal(doc.status, 201, "a 7 MB brochure is exactly what the larger cap exists for");

  const img = await handleUpload(harness().deps, { slug: "cafe", uid: "owner-1", bytes: big([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], sevenMB), filename: "hero.png" });
  assert.equal(img.status, 413);
  assert.equal(img.body.max, MAX_UPLOAD_BYTES);
  assert.match(img.body.error, /5 MB/, "an image is told the image limit");

  const huge = await handleUpload(harness().deps, { slug: "cafe", uid: "owner-1", bytes: big([0x25, 0x50, 0x44, 0x46, 0x2d], MAX_DOC_BYTES + 1), filename: "x.pdf" });
  assert.equal(huge.status, 413);
  assert.equal(huge.body.max, MAX_DOC_BYTES);
  assert.match(huge.body.error, /10 MB/, "a document is told the document limit");
});

test("the refusal names what we DO take, both halves of it", async () => {
  const r = await handleUpload(harness().deps, { slug: "cafe", uid: "owner-1", bytes: SVG, filename: "logo.svg" });
  assert.equal(r.status, 415);
  assert.equal(r.body.code, "bad_type");
  assert.match(r.body.error, /PNG/i);
  assert.match(r.body.error, /PDF/i, "a refusal that lists only the picture formats teaches the wrong limit");
});

test("a re-upload keeps the name the first one was stored under", async () => {
  // The key is the content hash, so these really are the same file. Rewriting
  // the metadata would rename a download that pages already link to by name.
  const key = "uploads/cafe/" + "b".repeat(32) + ".pdf";
  const { deps, puts } = harness({ objects: [{ key, size: 10, download: storeDownloadName("Original.pdf") }] });
  const r = await handleUpload(deps, { slug: "cafe", uid: "owner-1", bytes: PDF, filename: "Renamed.pdf" });
  assert.equal(r.status, 200);
  assert.equal(r.body.dedup, true);
  assert.equal(r.body.download, "Original.pdf");
  assert.equal(puts.length, 0, "nothing is written for a file that is already there");
});

test("the owner can delete a document — the gate is derived, not a second list", async () => {
  // A name this route refuses is a file the owner can upload and can never
  // remove, and two lists drifting apart is exactly how that happens.
  for (const ext of UPLOAD_EXTS) {
    const name = "c".repeat(32) + "." + ext;
    const { deps, removes } = harness({ objects: [{ key: "uploads/cafe/" + name, size: 1 }] });
    const r = await handleUploadDelete(deps, { slug: "cafe", uid: "owner-1", file: name });
    assert.equal(r.status, 200, ext + " could be uploaded and not deleted");
    assert.deepEqual(removes, ["uploads/cafe/" + name]);
  }
  assert.ok(UPLOAD_EXTS.includes("pdf") && UPLOAD_EXTS.includes("png"), "the list is not empty in a way that makes the loop vacuous");
  // And a shape we never mint is still refused before it reaches R2.
  const { deps, removes } = harness();
  assert.equal((await handleUploadDelete(deps, { slug: "cafe", uid: "owner-1", file: "../../x.pdf" })).status, 404);
  assert.equal((await handleUploadDelete(deps, { slug: "cafe", uid: "owner-1", file: "c".repeat(32) + ".exe" })).status, 404);
  assert.deepEqual(removes, []);
});

test("the listing says which is which, and what a document is called", async () => {
  const { deps } = harness({ objects: [
    { key: "uploads/cafe/aa.png", size: 100 },
    { key: "uploads/cafe/bb.pdf", size: 200, download: storeDownloadName("Menu spring.pdf") },
    { key: "uploads/cafe/cc.xlsx", size: 300 },
  ] });
  const r = await handleUploadList(deps, { slug: "cafe", uid: "owner-1" });
  assert.deepEqual(r.body.files, [
    { name: "aa.png", url: "/u/cafe/aa.png", size: 100, kind: "image" },
    { name: "bb.pdf", url: "/u/cafe/bb.pdf", size: 200, kind: "doc", download: "Menu spring.pdf" },
    { name: "cc.xlsx", url: "/u/cafe/cc.xlsx", size: 300, kind: "doc" },
  ]);
});

test("A VISITOR STILL CANNOT SEND A DOCUMENT, and that is the line", async () => {
  // The owner's route and the visitor's are different things and are treated as
  // such. That endpoint is unauthenticated by design — a customer attaching a
  // photo to a booking has no account — so anyone who knows a slug can call it,
  // and its purpose is "send a photo of the job". A stranger putting a PDF or a
  // zip on a business's own domain is a malware-hosting hole, not a feature.
  const vdeps = {
    tableFor: async () => ({ name: "jobs", access: "collect", columns: [{ name: "photo" }] }),
    throttle: async () => ({ ok: true }),
    hash: async () => "d".repeat(64),
    list: async () => [],
    put: async () => {},
  };
  for (const [b, what] of [[PDF, "a PDF"], [ZIP, "a zip"]]) {
    const r = await handleVisitorUpload(vdeps, { slug: "cafe", table: "jobs", bytes: b, ip: "1.2.3.4" });
    assert.equal(r.status, 415, what + " was accepted from a stranger");
  }
  // …and the picture it exists for still works, or the assertions above pass on
  // an endpoint that refuses everything.
  assert.equal((await handleVisitorUpload(vdeps, { slug: "cafe", table: "jobs", bytes: PNG, ip: "1.2.3.4" })).status, 201);
  assert.ok(MAX_VISITOR_UPLOAD_BYTES < MAX_DOC_BYTES);
});

// ────────────────────────────────────────────────────────────────── the wiring

test("the serve route decides the disposition rather than hardcoding inline", () => {
  // A source-read, because this is the wiring layer: `dispositionFor` can be
  // perfectly correct and called by nothing, which is the shape this repo has
  // recorded a dozen times.
  const w = read("worker.js");
  const i = w.indexOf('url.pathname.match(/^\\/u\\/');
  assert.ok(i > 0, "the /u/ route moved — re-anchor this check");
  const win = w.slice(i, i + 1400);
  assert.match(win, /"content-disposition": dispositionFor\(/, "the /u/ route still hardcodes a disposition");
  assert.match(win, /readDownloadName\(/, "the stored name never reaches the header");
  assert.ok(!/"content-disposition": "inline"/.test(win), "a hardcoded inline survives beside the call");
});

test("the listing surfaces the stored download name, or the header has nothing to say", () => {
  const w = read("worker.js");
  const i = w.indexOf("async function siteUploadList");
  assert.ok(i > 0);
  const win = w.slice(i, w.indexOf("\n}", i));
  assert.match(win, new RegExp("customMetadata\\[" + DOWNLOAD_NAME_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\]|customMetadata\\[DOWNLOAD_NAME_KEY\\]"),
    "the download name is dropped between R2 and the module");
  assert.match(win, /include: \["customMetadata"\]/, "R2 only returns custom metadata when it is asked for");
});

test("the upload route passes the filename and bounds on the LARGER cap", () => {
  const w = read("worker.js");
  const i = w.indexOf("r = await handleUpload(udeps");
  assert.ok(i > 0, "the upload call moved — re-anchor this check");
  const win = w.slice(Math.max(0, i - 1400), i + 500);
  assert.match(win, /filename: url\.searchParams\.get\("name"\)/, "the name never reaches the module");
  // The content-length pre-check runs before a byte has been read, so it cannot
  // know which cap applies. Gating it on the smaller one refuses every document.
  assert.match(win, /cl > MAX_DOC_BYTES/, "the pre-check refuses documents it should accept");
  assert.ok(!/cl > MAX_UPLOAD_BYTES/.test(win), "the old image-only bound survives");
});

// ─────────────────────────────────── the kit and the prompt have to agree

test("DownloadCard's href is optional AND the rules say to leave it off", () => {
  // BOTH ENDS, because a kit that accepts the shape while the prompt still shows
  // the old one is a fix nothing can use — the `fallbackSeed` lesson, where the
  // type was corrected and the resolved shape in PAGE_RULES was not.
  const card = read("builder/lovable/template/src/components/ui/download-card.tsx");
  assert.match(card, /href\?: string/, "href is still required, so an honest page cannot compile");
  // `<a href="" download>` RELOADS THE CURRENT PAGE — a Download button that
  // appears to work and does nothing, invisible to tsc, to the lint and to every
  // test here. The card must not render an anchor with nothing behind it.
  // ANCHORED ON `{href`, not on `href` — the first draft matched `href?: string`
  // in the type two lines above, so a mutation replacing the whole condition
  // with `{true` SURVIVED the sweep. A vacuous match reads exactly like
  // coverage.
  assert.match(card, /\{href\s*\n?\s*\?/, "the anchor is not gated on there being an href");
  assert.match(card, /:\s*<span[^>]*>Not available yet/, "there is no else branch — the anchor is unconditional");

  const api = read("builder/component-api.mjs");
  assert.match(api, /DownloadCard\(name: string, description\?: string, size\?: number, href\?: string\)/,
    "the derived API still describes the old signature to the model");

  const rules = read("builder/page-gen.mjs");
  const i = rules.indexOf("A DOCUMENT TO DOWNLOAD");
  assert.ok(i > 0, "the rules never mention a document");
  const win = rules.slice(i, i + 900);
  assert.match(win, /leave \\?`href\\?` OFF/i, "the rule does not say to leave the address off");
  assert.match(win, /NEVER point it at a route/i, "the rule does not forbid the thing every exemplar used to do");
});

test("no corpus page writes a DownloadCard href", () => {
  // All 34 of them pointed at a ROUTE or at `#dl`, so every one downloaded a
  // page's HTML or reloaded the current page. Swept corpus-wide because fixing
  // the component alone would have been undone by the examples — the same
  // reasoning as the `#/` href sweep.
  //
  // THE ORIGINAL REASON IS GONE AND THE HONEST REMAINDER IS WEAKER. This ran
  // over TWO corpora, and the stronger of them — `builder/family-exemplars.mjs`,
  // the baked pages the model was actually SHOWN — was deleted with the families
  // on 2026-08-20, so "those are what the model copies" is no longer true of
  // anything. What is left is `src/family-pages`, which ships in nothing and
  // reaches no prompt: it is test data, kept because several checks calibrate
  // their false-alarm rate against it.
  //
  // It stays for that narrower reason: a corpus is only evidence while it is
  // correct, and the link lane reads hrefs out of these pages. Costs nothing.
  const sweep = (src, floor, what) => {
    const calls = src.match(/<DownloadCard\b[\s\S]{0,400}?\/>/g) || [];
    // A scan that silently stopped matching reports a clean corpus, which is the
    // most reassuring possible way to say nothing was checked.
    assert.ok(calls.length >= floor, what + ": only " + calls.length + " DownloadCard calls found — the scan stopped matching");
    assert.deepEqual(calls.filter((c) => /\shref=/.test(c)), [], what + ": a download still points at a route");
  };

  const dir = CORPUS_DIR;
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : (e.name.endsWith(".tsx") ? [join(d, e.name)] : []));
  sweep(walk(dir).map((f) => readFileSync(f, "utf8")).join("\n"), 30, "the family pages on disk");
});
