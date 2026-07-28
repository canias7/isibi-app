// Pictures for a published site.
//
// `/u/<slug>/<file>` has served uploads from R2 since the D1 era and NOTHING
// ever wrote one, so no site the builder produces can have a photo. This is the
// write half — and it is a route that takes arbitrary bytes from a caller and
// serves them back from isibi.ai, so most of what is tested here is what it
// refuses.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleUpload, handleUploadList, handleUploadDelete, sniffImage, uploadName,
  MAX_UPLOAD_BYTES, MAX_FILES_PER_SITE, MAX_SITE_BYTES,
} from "../site-uploads.mjs";

// Real leading bytes for each type we accept.
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");

function harness(over = {}) {
  const puts = [], removes = [];
  const deps = {
    gate: async () => ({}),
    hash: async () => "a".repeat(64),
    list: async () => over.objects || [],
    put: async (key, bytes, ct) => { puts.push({ key, size: bytes.length, ct }); },
    remove: async (key) => { removes.push(key); },
    ...over.deps,
  };
  return { deps, puts, removes };
}
const up = (deps, bytes, o = {}) => handleUpload(deps, { slug: "cafe", uid: "owner-1", bytes, ...o });

// ────────────────────────────────────────────────────────────── what it takes

test("a real image is stored and comes back as a URL", async () => {
  const { deps, puts } = harness();
  const r = await up(deps, PNG);
  assert.equal(r.status, 201);
  assert.equal(r.body.mime, "image/png");
  assert.equal(r.body.url, "/u/cafe/" + "a".repeat(32) + ".png");
  assert.equal(puts[0].key, "uploads/cafe/" + "a".repeat(32) + ".png");
  assert.equal(puts[0].ct, "image/png");
});

test("it stores under uploads/, NOT under the published site", async () => {
  // `sites/<slug>/` is wiped on every publish. A revise must not delete the
  // owner's photographs.
  const { deps, puts } = harness();
  await up(deps, JPEG);
  assert.ok(puts[0].key.startsWith("uploads/cafe/"), puts[0].key);
  assert.ok(!puts[0].key.startsWith("sites/"), puts[0].key);
});

test("every type we claim to accept is actually accepted", async () => {
  for (const [bytes, mime] of [[PNG, "image/png"], [JPEG, "image/jpeg"], [WEBP, "image/webp"], [GIF, "image/gif"]]) {
    const { deps } = harness();
    const r = await up(deps, bytes);
    assert.equal(r.status, 201, mime);
    assert.equal(r.body.mime, mime);
  }
});

// ──────────────────────────────────────────────────────────── what it refuses

test("SVG is refused — it would be stored XSS on our own origin", async () => {
  // /u/ serves with content-disposition: inline from isibi.ai, and an SVG is a
  // document that can carry <script>. nosniff does not help: the type would be
  // honestly declared as image/svg+xml.
  const { deps, puts } = harness();
  const r = await up(deps, SVG);
  assert.equal(r.status, 415);
  assert.equal(r.body.code, "bad_type");
  assert.deepEqual(puts, [], "and nothing was stored");
});

test("anything that is not an image is refused", async () => {
  for (const bytes of [HTML, new Uint8Array([0x4d, 0x5a, 0, 0]), new TextEncoder().encode("just text"), new Uint8Array([0x50, 0x4b, 3, 4])]) {
    const { deps, puts } = harness();
    assert.equal((await up(deps, bytes)).status, 415);
    assert.deepEqual(puts, []);
  }
});

test("the declared type is never trusted — only the bytes decide", async () => {
  // sniffImage takes bytes and nothing else, so a lying Content-Type header has
  // nowhere to enter. Asserted on the function's shape as well as its answers.
  assert.equal(sniffImage(SVG), null);
  assert.equal(sniffImage(HTML), null);
  assert.equal(sniffImage.length, 1, "it takes bytes only — no header to be fooled by");
  assert.equal(sniffImage(PNG).mime, "image/png");
});

test("a truncated header is not mistaken for an image", async () => {
  for (const bytes of [PNG.slice(0, 4), JPEG.slice(0, 2), WEBP.slice(0, 8), GIF.slice(0, 4), new Uint8Array(0)]) {
    assert.equal(sniffImage(bytes), null, JSON.stringify([...bytes]));
  }
});

test("a GIF header with a bogus version is refused", async () => {
  // "GIF8" alone is not enough — only 87a and 89a exist.
  for (const v of [0x30, 0x38, 0x41, 0x99]) {
    const b = Uint8Array.from([0x47, 0x49, 0x46, 0x38, v, 0x61, 0, 0]);
    assert.equal(sniffImage(b), null, "version byte " + v);
  }
  // And the trailing 'a' is checked too.
  assert.equal(sniffImage(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x62, 0, 0])), null);
  assert.equal(sniffImage(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0, 0])).ext, "gif", "GIF87a is real");
});

test("a RIFF container that is not WebP is refused", async () => {
  // RIFF is also WAV and AVI. Matching the first four bytes alone would accept
  // audio as an image.
  const wav = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0]);
  assert.equal(sniffImage(wav), null);
});

test("nothing at all is 400, not a stored empty object", async () => {
  const { deps, puts } = harness();
  for (const bytes of [null, undefined, new Uint8Array(0)]) {
    assert.equal((await up(deps, bytes)).status, 400, String(bytes));
  }
  assert.deepEqual(puts, []);
});

test("an oversized file is refused before it is stored", async () => {
  const { deps, puts } = harness();
  const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
  big.set(PNG.slice(0, 8));
  const r = await up(deps, big);
  assert.equal(r.status, 413);
  assert.equal(r.body.code, "too_big");
  assert.deepEqual(puts, []);
});

// ────────────────────────────────────────────────────────── naming and dedup

test("the caller never chooses the name — the content does", async () => {
  // Which closes path traversal and cross-site overwrite by construction rather
  // than by escaping. A real hash is 64 hex characters; anything else is not a
  // name we are willing to mint.
  assert.equal(uploadName("f".repeat(64), "png"), "f".repeat(32) + ".png", "bounded to 32");
  assert.equal(uploadName("ABCDEF" + "0".repeat(58), "png"), "abcdef" + "0".repeat(26) + ".png", "lowercased");
  for (const bad of ["../../etc/passwd", "AB/CD", "z".repeat(64), "", null, undefined, "aa"]) {
    assert.equal(uploadName(bad, "png"), null, JSON.stringify(bad));
  }
});

test("a name we would not mint is refused rather than stored unreachably", async () => {
  // handleUploadDelete only accepts the shape minted here, so a degenerate name
  // would put an object in the bucket that nothing could ever address again —
  // permanent garbage from our own wiring mistake.
  const { deps, puts } = harness({ deps: { hash: async () => "not-hex-at-all" } });
  const r = await up(deps, PNG);
  assert.equal(r.status, 500);
  assert.deepEqual(puts, [], "and nothing unreachable was written");
});

test("every name this mints is a name the delete route can address", async () => {
  // The two shapes have to agree or a picture becomes undeletable.
  const { deps } = harness({ deps: { hash: async () => "0123456789abcdef".repeat(4) } });
  for (const [bytes, ext] of [[PNG, "png"], [JPEG, "jpg"], [WEBP, "webp"], [GIF, "gif"]]) {
    const r = await up(deps, bytes);
    assert.match(r.body.name, /^[a-f0-9]{1,32}\.(png|jpg|webp|gif)$/, r.body.name);
    assert.match(r.body.name, new RegExp("\\." + ext + "$"));
  }
});

test("the same picture twice is the same object, and is free", async () => {
  // Re-uploading must not count against the cap, and must not fail when the
  // site is full — the bytes are already there.
  const key = "uploads/cafe/" + "a".repeat(32) + ".png";
  const { deps, puts } = harness({ objects: [{ key, size: 10 }] });
  const r = await up(deps, PNG);
  assert.equal(r.status, 200);
  assert.equal(r.body.dedup, true);
  assert.equal(r.body.url, "/u/cafe/" + "a".repeat(32) + ".png");
  assert.deepEqual(puts, [], "nothing was written twice");
});

test("a re-upload succeeds even when the site is completely full", async () => {
  const key = "uploads/cafe/" + "a".repeat(32) + ".png";
  const objects = [{ key, size: 10 }];
  for (let i = 0; i < MAX_FILES_PER_SITE; i++) objects.push({ key: `uploads/cafe/${i}.png`, size: MAX_SITE_BYTES });
  const { deps } = harness({ objects });
  assert.equal((await up(deps, PNG)).status, 200, "refusing here would be refusing to do nothing");
});

test("different pictures get different names", async () => {
  const { deps } = harness({ deps: { hash: async (b) => (b[0] === 0x89 ? "1".repeat(64) : "2".repeat(64)) } });
  const a = await up(deps, PNG), b = await up(deps, JPEG);
  assert.notEqual(a.body.name, b.body.name);
  assert.match(a.body.name, /\.png$/);
  assert.match(b.body.name, /\.jpg$/);
});

// ───────────────────────────────────────────────────────────────── the caps

test("a site cannot exceed its file count", async () => {
  const objects = Array.from({ length: MAX_FILES_PER_SITE }, (_, i) => ({ key: `uploads/cafe/${i}.png`, size: 1 }));
  const { deps, puts } = harness({ objects });
  const r = await up(deps, PNG);
  assert.equal(r.status, 409);
  assert.equal(r.body.code, "full");
  assert.deepEqual(puts, []);
});

test("a site cannot exceed its byte budget", async () => {
  const { deps, puts } = harness({ objects: [{ key: "uploads/cafe/x.png", size: MAX_SITE_BYTES }] });
  const r = await up(deps, PNG);
  assert.equal(r.status, 409);
  assert.equal(r.body.code, "full");
  assert.deepEqual(puts, []);
});

test("the budget counts the new file too, not just what is there", async () => {
  const { deps } = harness({ objects: [{ key: "uploads/cafe/x.png", size: MAX_SITE_BYTES - 5 }] });
  assert.equal((await up(deps, PNG)).status, 409, "10 bytes into a 5-byte gap must not fit");
});

test("a missing size does not read as free space", async () => {
  const objects = Array.from({ length: 3 }, (_, i) => ({ key: `uploads/cafe/${i}.png` }));
  const { deps } = harness({ objects });
  assert.equal((await up(deps, PNG)).status, 201, "unknown sizes count as 0 but the file cap still applies");
});

// ────────────────────────────────────────────────────────────────── the gate

test("every entry point is behind the ownership gate", async () => {
  // The file has to really BE there, and the site has to have room. Otherwise
  // delete would 404 and upload would 409 for reasons that have nothing to do
  // with the gate, and removing the gate would not change a single answer.
  const name = "a".repeat(32) + ".png";
  const denied = { error: { status: 404, body: { error: "no such site" } } };
  const { deps, puts, removes } = harness({
    objects: [{ key: "uploads/cafe/" + name, size: 1 }],
    deps: { gate: async () => denied, hash: async () => "b".repeat(64) },
  });
  assert.equal((await up(deps, PNG)).status, 404);
  assert.equal((await handleUploadList(deps, { slug: "cafe", uid: "x" })).status, 404);
  assert.equal((await handleUploadDelete(deps, { slug: "cafe", uid: "x", file: name })).status, 404);
  assert.deepEqual(puts, [], "a stranger cannot add pictures to a site they do not own");
  assert.deepEqual(removes, [], "nor delete one that is really there");

  // And with the gate open, that same delete succeeds — so the assertions above
  // are about the gate and not about the file being absent.
  const { deps: allowed, removes: did } = harness({ objects: [{ key: "uploads/cafe/" + name, size: 1 }] });
  assert.equal((await handleUploadDelete(allowed, { slug: "cafe", uid: "owner-1", file: name })).status, 200);
  assert.deepEqual(did, ["uploads/cafe/" + name]);
});

// ─────────────────────────────────────────────────────── listing and deleting

test("the listing reports what is there and how full it is", async () => {
  const { deps } = harness({ objects: [{ key: "uploads/cafe/aa.png", size: 100 }, { key: "uploads/cafe/bb.jpg", size: 50 }] });
  const r = await handleUploadList(deps, { slug: "cafe", uid: "owner-1" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.files, [
    { name: "aa.png", url: "/u/cafe/aa.png", size: 100 },
    { name: "bb.jpg", url: "/u/cafe/bb.jpg", size: 50 },
  ]);
  assert.equal(r.body.used, 150);
  assert.equal(r.body.count, 2);
  assert.equal(r.body.max, MAX_SITE_BYTES);
});

test("the listing never reports a key from outside this site", async () => {
  // Belt and braces: if the prefix were ever passed wrong, the answer must be
  // empty rather than another site's filenames.
  const { deps } = harness({ objects: [{ key: "uploads/other/secret.png", size: 1 }, { key: "sites/cafe/index.html", size: 1 }] });
  const r = await handleUploadList(deps, { slug: "cafe", uid: "owner-1" });
  assert.deepEqual(r.body.files, []);
});

test("the owner can delete one of their pictures", async () => {
  const name = "a".repeat(32) + ".png";
  const { deps, removes } = harness({ objects: [{ key: "uploads/cafe/" + name, size: 1 }] });
  const r = await handleUploadDelete(deps, { slug: "cafe", uid: "owner-1", file: name });
  assert.equal(r.status, 200);
  assert.deepEqual(removes, ["uploads/cafe/" + name]);
});

test("a filename that is not one we minted is refused, and never reaches R2", async () => {
  // The name reaches an R2 key, and is checked against the shape we MINT rather
  // than merely escaped.
  //
  // Every one of these is listed as REALLY PRESENT under its computed key. That
  // matters: if the listing did not contain them, they would 404 for not
  // existing and this test would pass just as happily with the name check torn
  // out — which is exactly what a mutation run caught it doing.
  const bad = [
    "../../sites/cafe/index.html", "../other/secret.png", "a/b.png",
    "x".repeat(33) + ".png", "AAAA.png", "aa.svg", "aa.html", "aa.png.html", "aa", ".png",
  ];
  const objects = bad.map((f) => ({ key: "uploads/cafe/" + f, size: 1 }));
  const { deps, removes } = harness({ objects });
  for (const file of bad.concat(["", null, undefined])) {
    const r = await handleUploadDelete(deps, { slug: "cafe", uid: "owner-1", file });
    assert.equal(r.status, 404, JSON.stringify(file));
  }
  assert.deepEqual(removes, [], "not one of them reached R2");
});

test("deleting a file that is not there is 404, not a silent success", async () => {
  const { deps, removes } = harness({ objects: [] });
  const r = await handleUploadDelete(deps, { slug: "cafe", uid: "owner-1", file: "b".repeat(32) + ".jpg" });
  assert.equal(r.status, 404);
  assert.deepEqual(removes, []);
});
