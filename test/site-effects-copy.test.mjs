// The site template's copies of the follow-up modules are the platform's own,
// byte for byte (builder/gen-site-effects.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EFFECT_MODULES, EFFECTS_DIR, declarationOf, exportsOf } from "../builder/gen-site-effects.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("every copy equals its source, and each declaration names its exports", () => {
  assert.ok(EFFECT_MODULES.length >= 8);
  for (const f of EFFECT_MODULES) {
    const src = read(f);
    assert.equal(read(EFFECTS_DIR + "/" + f), src, f + " differs from the platform's: run node builder/gen-site-effects.mjs");
    assert.equal(read(EFFECTS_DIR + "/" + f.replace(/\.mjs$/, ".d.mts")), declarationOf(src), f + " declaration");
    assert.ok(exportsOf(src).length > 0, f);
  }
});

test("the copied modules import only each other", () => {
  for (const f of EFFECT_MODULES) {
    for (const m of read(f).matchAll(/^\s*(?:import|export)\b[^;\n]*?\bfrom\s+"([^"]+)"/gm)) assert.ok(EFFECT_MODULES.includes(m[1].replace(/^\.\//, "")), f + " imports " + m[1]);
  }
});

// 2026-10-29: the prebuilt senders (the site's after-submission effects and
// its jobs runner) were deleted; a site that sends writes its own server code.
// So no template file and not the platform keeps a provider sender.
test("nobody keeps a prebuilt sender", () => {
  const dir = new URL("../builder/lovable/template/src/lib/", import.meta.url);
  const files = fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
  assert.ok(files.includes("site-functions.ts"), "landmark: the template's lib");
  for (const f of files) {
    const src = fs.readFileSync(new URL(f, dir), "utf8");
    assert.doesNotMatch(src, /site-providers\.mjs|function postProvider(Email|Sms)\(/, f);
  }
  assert.ok(!EFFECT_MODULES.includes("site-providers.mjs"));
  assert.doesNotMatch(read("worker.js"), /async function postProviderEmail\(/);
});
