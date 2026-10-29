// THE SITE AGENT'S COMMAND LINE (2026-10-29): real commands in a real work
// folder, built from a stand-in template on disk.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sessionDir, prepareSandbox, writeSiteFiles, readSiteFiles, runCommand, sweepSessions, MAX_OUTPUT, SESSION_TTL_MS } from "../builder/agent-shell.mjs";

function template() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-shell-"));
  const app = path.join(root, "app");
  fs.mkdirSync(path.join(app, "src", "routes"), { recursive: true });
  fs.mkdirSync(path.join(app, "node_modules", ".bin"), { recursive: true });
  fs.writeFileSync(path.join(app, "package.json"), "{}");
  fs.writeFileSync(path.join(app, "src", "routes", "leftover.tsx"), "another build's page");
  fs.writeFileSync(path.join(app, "src", "styles.css"), "another build's css");
  const base = path.join(app, ".routes-base");
  fs.mkdirSync(base);
  fs.writeFileSync(path.join(base, "__root.tsx"), "root");
  fs.writeFileSync(path.join(app, ".styles-base.css"), "base css");
  return { root, app, base, runs: path.join(root, "runs") };
}

test("AS1 a work folder: the template copied, packages linked, the site's files written in, another build's left out", () => {
  const t = template();
  const dir = sessionDir(t.runs, "a".repeat(24));
  assert.equal(sessionDir(t.runs, "../etc"), null);
  assert.equal(prepareSandbox(dir, { app: t.app, routesBase: t.base }), true);
  assert.equal(prepareSandbox(dir, { app: t.app, routesBase: t.base }), false, "made once per run");
  assert.ok(fs.lstatSync(path.join(dir, "node_modules")).isSymbolicLink());
  writeSiteFiles(dir, { pages: [{ path: "index.tsx", source: "home" }, { path: "../evil.tsx", source: "x" }, { path: "shop/item.tsx", source: "item" }], parts: [{ name: "site-header", source: "h" }, { name: "../x", source: "x" }], css: null }, { routesBase: t.base, stylesBase: path.join(t.app, ".styles-base.css") });
  assert.ok(!fs.existsSync(path.join(dir, "src", "routes", "leftover.tsx")), "another build's page is gone");
  assert.ok(!fs.existsSync(path.join(dir, "src", "evil.tsx")));
  const back = readSiteFiles(dir, { routesBase: t.base });
  assert.deepEqual(back.pages.map((p) => p.path).sort(), ["index.tsx", "shop/item.tsx"], "the base __root.tsx is never the site's");
  assert.deepEqual(back.parts, [{ name: "site-header", source: "h" }]);
  assert.equal(back.css, "base css");
});

test("AS2 commands run in the work folder; an edit a command makes is read back", async () => {
  const t = template();
  const dir = sessionDir(t.runs, "b".repeat(24));
  prepareSandbox(dir, { app: t.app, routesBase: t.base });
  writeSiteFiles(dir, { pages: [{ path: "index.tsx", source: "Open 7am to 4pm" }], parts: [], css: "a{}" }, { routesBase: t.base });
  const g = await runCommand(dir, "grep -rn 'Open' src/routes");
  assert.equal(g.code, 0);
  assert.match(g.output, /src\/routes\/index\.tsx:1:Open 7am to 4pm/);
  const s = await runCommand(dir, "sed -i 's/7am to 4pm/8am to 5pm/' src/routes/index.tsx && rm -f src/routes/nothing.tsx && printf 'new' > src/routes/about.tsx");
  assert.equal(s.code, 0, s.output);
  const back = readSiteFiles(dir, { routesBase: t.base });
  assert.deepEqual(back.pages.sort((a, b) => a.path.localeCompare(b.path)), [{ path: "about.tsx", source: "new" }, { path: "index.tsx", source: "Open 8am to 5pm" }]);
  const bad = await runCommand(dir, "exit 3");
  assert.equal(bad.code, 3);
});

test("AS3 no secret of ours reaches a command; the time limit and the output cut hold", async () => {
  const t = template();
  const dir = sessionDir(t.runs, "c".repeat(24));
  prepareSandbox(dir, { app: t.app, routesBase: t.base });
  process.env.GF_TEST_SECRET_KEY = "sk-should-never-be-seen";
  try {
    const e = await runCommand(dir, "env");
    assert.doesNotMatch(e.output, /sk-should-never-be-seen|GF_TEST_SECRET_KEY/);
    assert.match(e.output, /HOME=/, "the observer saw the environment");
  } finally { delete process.env.GF_TEST_SECRET_KEY; }
  const t0 = Date.now();
  const slow = await runCommand(dir, "sleep 5", { timeoutMs: 300 });
  assert.ok(Date.now() - t0 < 3000, "stopped at the limit, not left to run: " + (Date.now() - t0) + " ms");
  assert.equal(slow.timedOut, true);
  assert.equal(slow.code, 124);
  const big = await runCommand(dir, "head -c " + (MAX_OUTPUT * 2) + " /dev/zero | tr '\\\\0' 'a'");
  assert.ok(big.output.length < MAX_OUTPUT + 100);
  assert.match(big.output, /output cut at 30000 characters/);
});

test("AS4 old work folders are swept; a folder that is not one is left alone", () => {
  const t = template();
  const old = sessionDir(t.runs, "d".repeat(24)), fresh = sessionDir(t.runs, "e".repeat(24));
  prepareSandbox(old, { app: t.app, routesBase: t.base });
  prepareSandbox(fresh, { app: t.app, routesBase: t.base });
  fs.writeFileSync(path.join(old, ".ready"), String(Date.now() - SESSION_TTL_MS - 1000));
  fs.mkdirSync(path.join(t.runs, "other"));
  assert.equal(sweepSessions(t.runs), 1);
  assert.ok(!fs.existsSync(old) && fs.existsSync(fresh) && fs.existsSync(path.join(t.runs, "other")));
});

import { renderAs } from "../builder/site-ssr.mjs";
test("AS5 as the unprivileged user: not root, and the image's own files cannot be changed", { skip: !renderAs() && "needs root and a `node` user (the container has both)" }, async () => {
  const t = template();
  const as = renderAs();
  const dir = sessionDir(t.runs, "f".repeat(24));
  fs.chmodSync(t.root, 0o755);
  prepareSandbox(dir, { app: t.app, routesBase: t.base, owner: as });
  writeSiteFiles(dir, { pages: [{ path: "index.tsx", source: "x" }] }, { routesBase: t.base, owner: as });
  const who = await runCommand(dir, "id -u", { as });
  assert.equal(who.output.trim(), String(as.uid));
  assert.notEqual(who.output.trim(), "0");
  const w = await runCommand(dir, "echo y > src/routes/index.tsx && echo ok", { as });
  assert.match(w.output, /ok/, "its own work folder is writable: " + w.output);
  const root = await runCommand(dir, "echo hacked > " + JSON.stringify(path.join(t.app, "package.json")) + " ; echo done", { as });
  assert.match(root.output, /Permission denied/);
  assert.equal(fs.readFileSync(path.join(t.app, "package.json"), "utf8"), "{}", "the template is untouched");
});
