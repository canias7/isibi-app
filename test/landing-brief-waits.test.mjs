// Signing in never starts a build by itself (2026-10-30, the owner: "just by
// signing in, it sent me here"). A brief typed on the landing, or carried in
// `?q=`, waits in the start box until the person presses send.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const block = (from, to) => {
  const a = CHAT.indexOf(from);
  assert.ok(a >= 0, "landmark missing: " + from);
  const b = CHAT.indexOf(to, a + from.length);
  assert.ok(b > a, "end landmark missing: " + to);
  return CHAT.slice(a, b);
};

test("LBW1 after sign-in the held brief fills the start box and builds nothing", () => {
  const b = block("if (pendingSiteBrief) {", "fetchCredits();");
  assert.match(b, /getElementById\('stPrompt'\)/);
  assert.match(b, /ta\.value = b/);
  assert.doesNotMatch(b, /siteCreate\(/, "signing in starts a build");
});

test("LBW2 a ?q= brief for a signed-in visitor waits in the start box too", () => {
  const b = block("const firstBrief = params.get('q');", "// ?auth=");
  assert.match(b, /ta\.value = firstBrief/);
  assert.doesNotMatch(b, /siteCreate\(/, "a link starts a build");
});

test("LBW3 signed in, the landing is never shown in a signed-in state (2026-11-01: /home replaced it)", () => {
  // Was: enterLandingAuthed hid the landing's Sign in / Pricing nav. That
  // in-between screen is gone; both sign-in entries go to the app at /home.
  assert.ok(!CHAT.includes("function enterLandingAuthed("), "the signed-in landing is back");
  const b = block("function finishAuth() {", "\n}\n");
  assert.match(b, /enterApp\(\);/);
});
