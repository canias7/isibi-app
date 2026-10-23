// AUDIT A11-4 (2026-10-23): A HEAD PATCHED WITHOUT A NEW SCRIPT REACHES A
// WARM ISOLATE. The verification, share-picture and SEO panels and the rename
// lane patch `sitemeta/<slug>.json` and tell the owner it is live; the site
// script read that file once per isolate, so a warm one kept the old head
// until Cloudflare recycled it. The real `server.ts`, transpiled with only its
// three imports stood in for, serves one isolate's requests: a patch is
// served once `META_TTL_MS` has passed, not before; a failed re-read keeps the
// head it held.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const SLUG = "hdttl";
const SERVER_SRC = new URL("../builder/lovable/template/src/server.ts", import.meta.url);

async function siteScript() {
  const src = readFileSync(SERVER_SRC, "utf8");
  const imports = [
    'import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";',
    'import { SITE_BUILD, SITE_SLUG, SITE_VERSION, SITE_PARENT } from "./site-brand";',
    'import { setSiteMeta, type SiteMeta } from "./site-runtime";',
  ];
  for (const i of imports) assert.ok(src.includes(i), "the site script's imports moved — rescope this: " + i);
  let body = src;
  for (const i of imports) body = body.replace(i, "");
  const head = [
    "let __meta = null;",
    "const setSiteMeta = (m) => { __meta = m; };",
    "const createStartHandler = () => async () => new Response(JSON.stringify(__meta));",
    "const defaultStreamHandler = null;",
    "const SITE_BUILD = 'b';",
    "const SITE_SLUG = " + JSON.stringify(SLUG) + ";",
    "const SITE_VERSION = '';",
    "const SITE_PARENT = '';",
  ].join("\n");
  const js = ts.transpileModule(head + "\n" + body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await import("data:text/javascript;base64," + Buffer.from(js + "\n//" + Math.random()).toString("base64"))).default;
}

test("HT1 ONE WARM ISOLATE: a patched description is served after the head's lifetime, not before; a failed re-read keeps the head already held; reads stay one per lifetime", async (t) => {
  let now = 1_800_000_000_000;
  t.mock.method(Date, "now", () => now);
  const m = new Map([["sitemeta/" + SLUG + ".json", JSON.stringify({ description: "old words" })], ["sites/" + SLUG + "/site.live", "1"]]);
  let reads = 0, failing = false;
  const env = { SITES: {
    get: async (k) => { if (k.startsWith("sitemeta/")) { reads++; if (failing) throw new Error("r2 blip"); } return m.has(k) ? { body: null, text: async () => m.get(k), writeHttpMetadata() {} } : null; },
    head: async (k) => (m.has(k) ? {} : null),
  } };
  const script = await siteScript();
  const seen = async () => { const r = await script.fetch(new Request("https://x.gofarther.app/"), env); return (JSON.parse(await r.text()) || {}).description; };
  assert.equal(await seen(), "old words");
  m.set("sitemeta/" + SLUG + ".json", JSON.stringify({ description: "new words" }));
  now += 5_000;
  assert.equal(await seen(), "old words", "the head was re-read on every request");
  assert.equal(reads, 1);
  now += 30_000;
  assert.equal(await seen(), "new words", "a warm isolate still serves the head it read first");
  assert.equal(reads, 2);
  failing = true;
  now += 31_000;
  assert.equal(await seen(), "new words", "a failed re-read dropped the head it held");
  assert.equal(reads, 3);
  assert.equal(await seen(), "new words");
  assert.equal(reads, 3, "a failed read is retried on every request");
});
