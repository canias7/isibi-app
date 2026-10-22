// THEIR CURRENT SITE, READ FOR A REBUILD, IN THE BUILD'S TALK (2026-10-22):
// the import's own steps said from what really happened, and the 3D model's
// literal lines.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildStepFacts, talkBuildStepFacts, model3dTalkLine } from "../builder/site-progress.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const texts = (f) => f.map((x) => x.state + ": " + x.text);

test("importing: said as it starts", () => {
  assert.deepEqual(texts(buildStepFacts({ s: "importing" })), ["doing: Reading their current site…"]);
  assert.deepEqual(texts(talkBuildStepFacts({ s: "importing" })), ["doing: Reading their current site…"], "the talk record hears it too");
});

test("import: the pages really read, or that it could not be read and the build goes on from the message", () => {
  assert.deepEqual(texts(buildStepFacts({ s: "import", ok: true, pages: 4, photos: 9 })), ["decided: Read 4 pages from their current site, to rebuild it from. Nothing is built yet."]);
  assert.deepEqual(texts(buildStepFacts({ s: "import", ok: true, pages: 1 })), ["decided: Read one page from their current site, to rebuild it from. Nothing is built yet."]);
  const failed = ["notdone: Couldn't read their current site, so the site is being built from their message alone."];
  assert.deepEqual(texts(buildStepFacts({ s: "import", ok: false, pages: 0, photos: 0 })), failed);
  assert.deepEqual(texts(buildStepFacts({ s: "import", ok: "true", pages: 3 })), failed, "a non-boolean is never read as read");
  assert.deepEqual(texts(buildStepFacts({ s: "import", ok: true, pages: 0 })), failed, "no pages is not a read");
});

test("importphotos: the photos really copied, and the ones that could not be", () => {
  assert.deepEqual(texts(buildStepFacts({ s: "importphotos", placed: 5, missing: 0 })), ["prepared: Using 5 of their photos from their current site on the pages. Not published yet."]);
  assert.deepEqual(texts(buildStepFacts({ s: "importphotos", placed: 1, missing: 2 })), [
    "prepared: Using one of their photos from their current site on the pages. Not published yet.",
    "notdone: Could not copy 2 photos from their current site.",
  ]);
  assert.deepEqual(buildStepFacts({ s: "importphotos", placed: 0, missing: 0 }), []);
});

test("the build marks the import's steps: importing before the read, import after it, importphotos after the copy", () => {
  const w = read("worker.js");
  const a = w.indexOf('tr.at("importing", {});');
  const b = w.indexOf("const got = await importSite(importTarget");
  const c = w.indexOf('tr.at("import", { ok: !!imported');
  assert.ok(a > 0 && b > a && c > b);
  assert.ok(w.indexOf('tr.at("importphotos", { placed: imp.placed.length') > c);
  // Their own attached photos are counted without the imported ones, so no photo is said twice.
  assert.match(w, /const ownPlaced = ownPhotos\.placed\.length - fromImport\.placed\.length/);
  assert.match(w, /if \(ownPlaced \|\| ownMissing\) tr\.at\("ownphotos", \{ placed: ownPlaced, missing: ownMissing \}\);/);
});

test("model3dTalkLine: the page's own wording, from what the route saw", () => {
  assert.equal(model3dTalkLine("start"), "Making your 3D model…");
  assert.equal(model3dTalkLine("started", { cost: 150 }), "Started — 150 credits reserved. This usually takes a few minutes.");
  assert.equal(model3dTalkLine("started", { cost: 0 }), "");
  assert.equal(model3dTalkLine("queued", { position: 2 }), "Waiting in line at the 3D service (2 ahead)…");
  assert.equal(model3dTalkLine("shaping", { mins: 0 }), "Shaping and texturing the model…");
  assert.equal(model3dTalkLine("shaping", { mins: 4 }), "Shaping and texturing the model — 4 min so far…");
  assert.equal(model3dTalkLine("finishing", { page: "/shop" }), "Saving it to your files and putting it on /shop…");
  assert.equal(model3dTalkLine("finishing", { page: "/" }), "Saving it to your files and putting it on the home page…");
  assert.equal(model3dTalkLine("end", { text: "Your 3D model is on /shop. It cost 150 credits." }), "Your 3D model is on /shop. It cost 150 credits.");
  assert.equal(model3dTalkLine("end", { text: ["x"] }), "");
  assert.equal(model3dTalkLine("nope"), "");
});
