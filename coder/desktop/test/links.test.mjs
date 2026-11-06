// The desktop app's link rules (owner, 2026-11-06: the desktop app).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { isInsideApp, isSafeOutside, HOME } = createRequire(import.meta.url)("../links.js");

test("D1 the app's own pages and GitHub's sign-in stay in the window; everything else goes to the browser", () => {
  assert.equal(HOME, "https://gofarther.dev/");
  for (const u of ["https://gofarther.dev/", "https://gofarther.dev/api/coder/github/callback?code=1&state=2", "https://github.com/login/oauth/authorize?client_id=x", "https://github.com/login", "https://github.com/session", "https://github.com/sessions/two-factor/app", "https://github.com/apps/gofarther-coder/installations/new", "https://github.com/settings/installations/123"])
    assert.equal(isInsideApp(u), true, u);
  for (const u of ["https://github.com/canias7/testingforclaude/pull/7", "https://github.com/", "https://gofarther.dev.evil.com/", "http://gofarther.dev/", "https://evil.com/?https://gofarther.dev/", "https://user:pw@gofarther.dev/", "https://gofarther.dev:8443/", "javascript:alert(1)", "file:///etc/passwd", "not a url"])
    assert.equal(isInsideApp(u), false, u);
  assert.equal(isSafeOutside("https://docs.stripe.com"), true);
  assert.equal(isSafeOutside("mailto:a@b.c"), true);
  for (const u of ["file:///etc/passwd", "javascript:alert(1)", "smb://x/y", "vscode://x"]) assert.equal(isSafeOutside(u), false, u);
});

test("D2 the app is locked down: no Node in the page, sandboxed, single window, only notifications and copying allowed", async () => {
  const { readFileSync } = await import("node:fs");
  const main = readFileSync(new URL("../main.js", import.meta.url), "utf8");
  assert.match(main, /contextIsolation: true, sandbox: true, nodeIntegration: false/);
  assert.match(main, /requestSingleInstanceLock\(\)/);
  assert.match(main, /done\(\["notifications", "clipboard-sanitized-write"\]\.includes\(permission\)\)/);
  assert.match(main, /\{ role: "editMenu" \}/, "copy and paste work on a Mac");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(pkg.devDependencies.electron, /^\d+\.\d+\.\d+$/, "exact versions");
  assert.equal(pkg.build.mac.artifactName, "GoFarther-mac.${ext}");
  assert.equal(pkg.build.win.artifactName, "GoFarther-windows.${ext}");
  // Unsigned for now: ad-hoc signed so Apple Silicon Macs open it (after "Open Anyway"), and the page knows it is in the app.
  assert.equal(pkg.build.mac.identity, "-"); assert.equal(pkg.build.mac.hardenedRuntime, false);
  assert.match(main, /app\.userAgentFallback = app\.userAgentFallback \+ " GoFartherDesktop\/" \+ app\.getVersion\(\);/);
});
