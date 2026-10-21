// EVERY CHAT THIS BROWSER HOLDS REACHES THE SERVER (2026-10-21, the device check).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
test("once per page, after sign-in, every held chat is read from the server and written up where it has nothing newer", () => {
  const a = src.indexOf("async function chatSyncAll() {");
  const body = src.slice(a, src.indexOf("\n}\n", a));
  assert.ok(a > 0, "chatSyncAll is gone");
  assert.match(body, /if \(chatSyncStarted\) return;/, "it runs more than once a page");
  assert.match(body, /Auth\.accessToken\(\)/, "it runs signed out");
  assert.match(body, /await chatPull\(s\)/, "it does not go through the pull, which writes up what the server lacks");
  assert.match(body, /Promise\.all\(\[one\(\), one\(\), one\(\)\]\)/, "it is not bounded to three at a time");
  assert.match(src, /async function sitesFetchRemote\(force\) \{\n  chatSyncAll\(\)\.catch\(\(\) => \{\}\);/, "nothing starts it");
});
