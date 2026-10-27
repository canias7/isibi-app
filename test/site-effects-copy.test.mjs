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
    for (const m of read(f).matchAll(/from\s+"([^"]+)"/g)) assert.ok(EFFECT_MODULES.includes(m[1].replace(/^\.\//, "")), f + " imports " + m[1]);
  }
});

test("the platform sends with the same module the site carries", () => {
  assert.match(read("worker.js"), /import \{ postProviderEmail, postProviderSms \} from "\.\/site-providers\.mjs";/);
  assert.doesNotMatch(read("worker.js"), /async function postProviderEmail\(/);
});
