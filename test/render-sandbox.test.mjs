// The boundary around model-written page code, and the discipline around a
// killed build step.
//
// WHAT THIS IS ABOUT. `dist/server/server.js` is the model's `src/routes/*.tsx`
// compiled, and the render check drives it to get a document. It used to do that
// with `await import(...)` INTO THE BUILD SERVICE'S OWN PROCESS, as root, with no
// timeout — `STEP_TIMEOUT` has only ever applied to subprocesses via `run()`, and
// `checkRender`'s own budget is a timer in the very event loop a synchronous
// `while (true)` in a component blocks. The Dockerfile deleted the prerender's
// privilege drop on the premise that "nothing in this image executes
// model-written code any more" and then contradicted itself four paragraphs
// later in the same comment block.
//
// EVERY TEST HERE DRIVES THE REAL THING. `build-server.mjs` listens on a port at
// import time and cannot be imported, which is exactly why the two modules under
// test were extracted out of it — this file is the reason they exist as modules
// at all.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runStep, killTree } from "../builder/run-step.mjs";
import { startSiteServer, renderAs, RENDER_CHILD } from "../builder/site-ssr.mjs";
import { checkRender, chromiumSandboxed } from "../builder/render-check.mjs";
import { renderNote } from "../builder/site-render.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A scratch directory that an unprivileged user can READ and TRAVERSE but not
 *  write into — which is what `/app` really is in the image (root-owned 0755).
 *  `mkdtemp` gives 0700, and a fixture LESS capable than the thing it stands in
 *  for hides bugs exactly as one that is more capable does: at 0700 a dropped
 *  child cannot even read the bundle, and the failure reads as the drop breaking
 *  the render rather than as a permission on a temp directory. */
function scratch(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "isibi-" + name + "-"));
  fs.chmodSync(dir, 0o755);
  return dir;
}

/** A stand-in for `dist/server/server.js`: a module whose default export has a
 *  `fetch`, which is the whole contract the child asks of it. */
function bundle(dir, name, body) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body);
  fs.chmodSync(file, 0o644);
  return file;
}

const source = (rel) =>
  fs.readFileSync(new URL(rel, import.meta.url), "utf8")
    // COMMENTS BLANKED, length-preserving and line-wise. Both files under test
    // explain these bugs at length, so their prose necessarily CONTAINS the
    // spellings being asserted absent — the trap this repo has recorded ten-plus
    // times, most recently inside a guard written the same day as the warning.
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

// ── a build step, killed all the way down ────────────────────────────────────

test("a timed-out step kills everything it started, not just its direct child", async () => {
  // THE BUG, MEASURED AS A DIFFERENTIAL. Every build step is `npx <tool>`, and
  // npm's exec runs the tool as its own child — so `child.kill("SIGKILL")`
  // signalled `npx` and left `vite`/`tsc` running. The control below is the old
  // implementation, verbatim in shape: no `detached`, a direct kill, and a
  // `resolve` beside it. It leaves the grandchild alive.
  const dir = scratch("kill");
  const mark = (n) => path.join(dir, "grandchild-" + n);

  const { spawn } = await import("node:child_process");
  const oldRun = (cmd, args, ms) => new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: dir });
    const to = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} resolve({ timedOut: true }); }, ms);
    child.on("close", () => { clearTimeout(to); resolve({ timedOut: false }); });
  });

  const script = (n) => "(sleep 1.2; echo yes > " + mark(n) + ") & sleep 60";

  await oldRun("sh", ["-c", script("old")], 400);
  await sleep(2000);
  assert.equal(fs.existsSync(mark("old")), true,
    "the control did not reproduce the bug — a grandchild survived nothing, so the check below proves nothing");

  const t0 = Date.now();
  const r = await runStep("sh", ["-c", script("new")], { cwd: dir, timeout: 400 });
  const waited = Date.now() - t0;
  await sleep(2000);
  assert.equal(fs.existsSync(mark("new")), false,
    "a step's grandchildren survived the timeout — one customer's vite can still be writing into dist when the next build's resetRoutes fires");

  // AND IT SETTLED ON THE CHILD'S `close` RATHER THAN BESIDE THE KILL. The old
  // timer called `resolve` on the line after `child.kill`, so `oneAtATime`
  // released while the tree was still alive — and it hardcoded `signal: null`,
  // because a promise resolved before the close event has no signal to report.
  // The signal is therefore the observable: it is the one thing only `close` can
  // supply, and `exitReason` needs it to tell a killed step from a failed one.
  assert.equal(r.signal, "SIGKILL",
    "the timeout resolved without waiting for the child to close — the tree may still be running when the caller resets the directory it writes into");
  assert.ok(waited >= 400, `run resolved in ${waited}ms, before its own timeout`);
  assert.match(r.err, /timed out after/, "the timed-out sentence exitReason reads is gone");
  assert.equal(r.code, -1);
});

test("an ordinary step reports its code, its signal and both streams", async () => {
  // The shape `exitReason` reads, unchanged by the move. The signal is the one
  // that has been lost before: a killed process closes with `code: null`, and
  // `null !== 0` reads as an ordinary failure.
  const ok = await runStep(process.execPath, ["-e", "console.log('OUT'); console.error('ERR')"], { timeout: 5000 });
  assert.equal(ok.code, 0);
  assert.match(ok.out, /OUT/);
  assert.match(ok.err, /ERR/);

  const killed = await runStep(process.execPath, ["-e", "process.kill(process.pid, 'SIGKILL')"], { timeout: 5000 });
  assert.equal(killed.signal, "SIGKILL", "run() drops the signal, so a SIGKILL reads as an ordinary non-zero exit");

  // A command that does not exist must come back as data, never as a rejection:
  // every caller treats the result as data, and a rejection would escape into
  // the build handler's catch-all as a stageless failure.
  const missing = await runStep("this-command-does-not-exist-isibi", [], { timeout: 5000 });
  assert.equal(missing.code, -1);
  assert.ok(missing.err.length > 0, "a spawn failure said nothing at all");
});

test("killTree answers rather than throwing, on a child that is already gone", () => {
  // It runs inside a timer callback, and an uncaught exception there is the whole
  // build service dying mid-build for every customer queued behind it.
  assert.equal(killTree(null), false);
  assert.equal(killTree({}), false);
  assert.doesNotThrow(() => killTree({ pid: 2147483647, kill() { throw new Error("ESRCH"); } }));
});

// ── the site's own server, in a process of its own ───────────────────────────

test("a wedged render does not stop the caller's clock", async () => {
  // THE CRITICAL, AS A DIFFERENTIAL. The first arm is the bug: the bundle
  // imported into this process and called, exactly as `loadSiteServer` did. The
  // second is the fix. The spin is bounded at 1.2s so the control can be
  // measured at all — a real hostile page spins forever, and the difference is
  // only in degree.
  const dir = scratch("wedge");
  const file = bundle(dir, "spin.mjs",
    "export default { fetch: async () => { const end = Date.now() + 1200; while (Date.now() < end) {} " +
    "return new Response('done'); } };\n");

  // IN-PROCESS: the event loop stops. Nothing scheduled can fire, which is why
  // no timeout anywhere in the old design could ever have bounded this.
  const mod = await import(pathToFileURL(file).href);
  let ticks = 0;
  let iv = setInterval(() => { ticks++; }, 20);
  await mod.default.fetch(new Request("http://127.0.0.1/"), {});
  clearInterval(iv);
  assert.ok(ticks <= 1,
    `the control ticked ${ticks} times during a synchronous render — it is not blocking, so the arm below proves nothing`);

  // ACROSS THE PROCESS BOUNDARY: the clock keeps running, the request is bounded,
  // and the reason names the route rather than blaming the page for throwing.
  const ssr = await startSiteServer(file, { requestMs: 600 });
  assert.equal(ssr.ok, true, ssr.why);
  try {
    ticks = 0;
    iv = setInterval(() => { ticks++; }, 20);
    await assert.rejects(() => ssr.fetch(new Request("http://127.0.0.1/")), /did not finish rendering/);
    assert.ok(ticks > 5,
      `the caller's event loop only turned ${ticks} times — the render is still blocking this process`);
    // AND THE SERVER IS MARKED DOWN, deliberately. It is single-threaded, so the
    // next request would time out too and the report would come back as "every
    // page threw" — a finding against pages nobody ever opened.
    assert.match(ssr.down(), /did not finish rendering/);
    // THE INTERVAL IS CLEARED IN THE `finally`, NOT AFTER THE ASSERTION ABOVE
    // IT, AND THAT PLACEMENT IS THE WHOLE POINT. Cleared inline, a failing
    // assertion skips the clear and leaves a live 20ms timer holding the event
    // loop open — so the FILE never exits and `npm test` runs forever with no
    // output at all. Measured: one wrong assertion here turned a 31-second
    // suite into a >600-second hang that had to be killed by PID, and the
    // reason was invisible because node's runner had emitted nothing.
    //
    // A test that WEDGES THE RUNNER when it fails is worse than one that fails:
    // the failure it was written to report is the one thing you cannot read.
  } finally { clearInterval(iv); ssr.stop(); }
});

test("a bundle that will not load is a dead handle that says why, never a throw", async () => {
  const dir = scratch("bad");
  for (const [name, body, why] of [
    ["throws.mjs", "throw new Error('module scope exploded');\n", /would not load/],
    ["nodefault.mjs", "export const nope = 1;\n", /no fetch handler/],
    ["nofetch.mjs", "export default { };\n", /no fetch handler/],
  ]) {
    const ssr = await startSiteServer(bundle(dir, name, body), { startMs: 8000 });
    assert.equal(ssr.ok, false, name + " loaded when it should not have");
    assert.match(ssr.why, why, name + ": " + ssr.why);
    assert.equal(ssr.fetch, null, name + " handed back a fetch into a server that does not exist");
    assert.equal(ssr.down(), ssr.why, name + " reports healthy while being dead");
    ssr.stop();
  }
  // A path that is not there at all — the shape a moved output directory takes.
  const gone = await startSiteServer(path.join(dir, "not-here.mjs"), { startMs: 8000 });
  assert.equal(gone.ok, false);
  assert.ok(gone.why.length > 0, "a missing bundle came back with no reason");
});

test("stop() reaps the child, and is idempotent", async () => {
  const dir = scratch("stop");
  const file = bundle(dir, "ok.mjs", "export default { fetch: async () => new Response('hi') };\n");
  const ssr = await startSiteServer(file);
  assert.equal(ssr.ok, true, ssr.why);
  const port = ssr.port;
  ssr.stop();
  ssr.stop();                                   // idempotent, or the finally in the build handler double-kills
  await sleep(400);
  // The port is the observable: a reaped child is not listening on it.
  await assert.rejects(() => fetch("http://127.0.0.1:" + port + "/", { signal: AbortSignal.timeout(2000) }),
    "the child is still serving after stop() — one leaked server per build in a container shared by every customer");
});

test("renderAs refuses everything it cannot prove", () => {
  // A drop that silently did not happen is the failure this whole file is about,
  // so every answer other than a real unprivileged uid must be null.
  assert.equal(renderAs("this-user-does-not-exist-isibi"), null, "a user that is not in /etc/passwd was accepted");
  const root = typeof process.getuid === "function" && process.getuid() === 0;
  if (!root) {
    assert.equal(renderAs("nobody"), null, "asked for a setuid we do not have — spawn would throw EPERM and there would be no render check at all");
    return;
  }
  // ROOT IS REFUSED BY NAME. A passwd entry resolving to uid 0 is a drop to
  // nothing wearing the shape of one.
  assert.equal(renderAs("root"), null, "dropping to root was accepted as a privilege drop");
  const as = renderAs("nobody");
  assert.ok(as && as.uid > 0 && Number.isInteger(as.gid), "nobody did not resolve: " + JSON.stringify(as));
});

test("THE DROP IS PROVEN BY A REFUSED WRITE, with a control that can fail", async (t) => {
  // PROVEN, NOT READ. The old prerender's own lesson: a check that "tries" the
  // confinement and reports success always succeeds, because the platform quietly
  // does the unconfined thing for you. So this measures the one thing the drop
  // exists to buy — model code cannot write into the `/app` tree the NEXT
  // customer's build reuses — and it measures the control too, because "EACCES"
  // with no root arm could be a permission problem of the fixture's own making.
  //
  // SKIPS RATHER THAN PASSING when it cannot run. It needs root and an
  // unprivileged user; a security check that silently goes green on every machine
  // that cannot run it is worse than no check.
  const root = typeof process.getuid === "function" && process.getuid() === 0;
  const as = root ? renderAs("nobody") : null;
  if (!as) return t.skip("needs root and an unprivileged user; the drop cannot be exercised here");

  const dir = scratch("drop");
  const target = path.join(dir, "written-by-the-model");
  const file = bundle(dir, "writer.mjs",
    'import fs from "node:fs";\n' +
    "export default { fetch: async () => {\n" +
    "  try { fs.writeFileSync(" + JSON.stringify(target) + ', "x"); return new Response("WROTE"); }\n' +
    '  catch (e) { return new Response("REFUSED:" + (e && e.code)); }\n' +
    "} };\n");

  const ask = async (drop) => {
    const ssr = await startSiteServer(file, { as: drop });
    assert.equal(ssr.ok, true, (drop ? "dropped" : "root") + " server did not start: " + ssr.why);
    try {
      assert.equal(ssr.unprivileged, !!drop, "the handle reports a confinement that does not match what was asked for");
      return await (await ssr.fetch(new Request("http://127.0.0.1/"))).text();
    } finally { ssr.stop(); await sleep(150); }
  };

  // THE CONTROL FIRST. Without it, a refusal proves only that something in the
  // fixture is unwritable.
  assert.equal(await ask(null), "WROTE",
    "the control could not write either — the fixture is unwritable for some other reason, so the refusal below proves nothing");
  fs.rmSync(target, { force: true });

  assert.match(await ask(as), /^REFUSED:/,
    "model-written code could write into the shared build tree — cross-tenant, since resetRoutes restores src/routes and nothing else");
  assert.equal(fs.existsSync(target), false, "it reported a refusal and the file is there");
});

// ── the check says when it could not run, instead of blaming the site ────────

test("a server that never started is reported as such, not as every page throwing", async () => {
  // THE FALSE ALARM. `loadSiteServer` returned null on any failure, `serveDist`
  // gated its whole SSR branch on it, and under Start `dist/client` holds no HTML
  // — so every route 404'd, `page.goto` came back not-ok, and `readPage` turned
  // that into a `threw` finding for EVERY route at EVERY width, on a build that
  // compiled and published perfectly. `renderReport` still said `ok: true`, so
  // the customer was told their site's every page threw an error — from the one
  // check whose charter is that a false alarm is worse than a miss.
  const dir = scratch("nodocs");                       // no index.html: what Start really emits
  const r = await checkRender(dir, ["/", "/menu"], null);
  assert.equal(r.ok, false, "a missing server was reported as a successful look at the site");
  assert.match(r.error, /server/i, "the reason does not name the server, so it reads as a fault in the pages");
  assert.equal(r.checked, 0, "it claims to have looked at pages it never opened");
  assert.deepEqual(r.findings, [], "a build with no server produced findings against its pages");
  assert.equal(renderNote(r), "", "the customer is told something about a check that never ran");
});

test("a server that dies PART-WAY turns the whole report honest", async () => {
  // The other half: some pages may have been looked at before it went, and every
  // one after that failed for a reason that is ours rather than the site's.
  const dir = scratch("halfway");
  fs.writeFileSync(path.join(dir, "index.html"), "<html></html>");
  let why = "";
  const r = await checkRender(dir, ["/"], async () => new Response("x"), () => why || (why = "the site's server stopped (SIGKILL)"));
  assert.equal(r.ok, false);
  assert.match(r.error, /stopped/);
  assert.equal(renderNote(r), "");
});

test("the sandbox verdict is never a default, on any path out", () => {
  // THE FAIL-OPEN. `sandboxed` was a local initialised to `true` and overwritten
  // only after the browser launched, so every failure before that — a port that
  // would not listen, a missing playwright-core, a Chromium that would not start
  // — reported a run whose sandbox state was never determined AS CONFINED.
  // `renderReport` omits the field when it is true, and by its own contract an
  // absent field reads as "the browser confined the code".
  //
  // ASSERTED AS A PROPERTY OF THE SOURCE, because the behavioural half can only
  // discriminate when the test process is root: on a non-root runner
  // `chromiumSandboxed()` is true and a hardcoded `true` is indistinguishable
  // from the honest answer. Said plainly rather than left looking like live
  // protection everywhere.
  const src = source("../builder/render-check.mjs");
  const calls = [...src.matchAll(/renderReport\(([^;]*?)\)\s*;/g)].map((m) => m[1]);
  assert.ok(calls.length >= 4, `only ${calls.length} report returns found — the scan stopped matching`);
  for (const args of calls) {
    assert.match(args, /\bsandboxed\b/, "a report return drops the sandbox verdict: renderReport(" + args + ")");
    assert.doesNotMatch(args, /sandboxed\s*:\s*(?:true|false)\b/,
      "a report return hardcodes the sandbox verdict: renderReport(" + args + ")");
  }
  assert.doesNotMatch(src, /\bsandboxed\s*=\s*(?:true|false)\b/,
    "the verdict has a literal default again — every failure before the browser launches would report it");
});

test("…and the verdict it reports really is the uid answer", async () => {
  // The behavioural half. It discriminates only when this process is ROOT — which
  // is the case that matters, since the build service runs as root in the image —
  // and is deliberately vacuous on an unprivileged runner rather than pretending
  // otherwise.
  const r = await checkRender(scratch("verdict"), ["/"], null);
  assert.equal(r.sandboxed === false, chromiumSandboxed() === false,
    "the failure path reported a sandbox state that is not the real one");
  if (chromiumSandboxed()) {
    assert.equal(Object.hasOwn(r, "sandboxed"), false, "a confined run raised the alarm, so the alarm is noise");
  }
});

// ── the wiring, which is where twelve features have died ─────────────────────

test("the build service does not import the model's bundle into its own process", () => {
  const src = source("../builder/build-server.mjs");
  const ssr = source("../builder/site-ssr.mjs");
  // A dynamic import of the server bundle IS the bug — the wedge, the shared
  // filesystem, and the module registry that grew by several megabytes a build
  // and was never collected, because Node keys the ESM registry on the whole URL
  // (query included, which is what the cache-buster added) and has no unload.
  for (const [name, text] of [["build-server.mjs", src], ["site-ssr.mjs", ssr]]) {
    assert.doesNotMatch(text, /\bimport\s*\(/,
      name + " loads a module at runtime — if that is the site's server bundle, the boundary is gone");
  }
  assert.match(source("../builder/render-server-child.mjs"), /\bawait import\(/,
    "the child no longer loads the bundle, so nothing does");
  // AND THE CACHE-BUSTER MUST NOT COME BACK WITH IT. A fresh process has an empty
  // registry; a busted specifier in one is the leak, not the guard.
  assert.doesNotMatch(source("../builder/render-server-child.mjs"), /\?b=|\?v=/,
    "the child busts its own module cache — that is what retained every build's bundle for the life of the container");
});

test("the check is handed the server AND whether it is down, and the server is stopped", () => {
  const src = source("../builder/build-server.mjs");
  const start = src.indexOf("startSiteServerForCheck()");
  const call = src.indexOf("checkRender(CLIENT_DIST");
  assert.ok(start > 0 && call > start, "the server is no longer started before the check runs");
  const win = src.slice(start, call + 400);
  // BOTH HALVES, AND FROM THE SAME HANDLE. The fetch alone is what made a bundle
  // that would not load read as every page of the site throwing. Read off the
  // call's own line rather than with a `[^)]*` window, which cannot cross the
  // `)` in `routePaths()` — a guard about punctuation, failing correct code.
  const callLine = src.slice(call, src.indexOf("\n", call));
  const args = [...callLine.matchAll(/([A-Za-z_$][\w$]*)\.(fetch|down)\b/g)];
  assert.deepEqual(args.map((m) => m[2]).sort(), ["down", "fetch"],
    "the check is not told whether the server is down, so it will blame the pages for it: " + callLine.trim());
  assert.equal(new Set(args.map((m) => m[1])).size, 1,
    "the fetch and the liveness answer come from different objects, which can disagree: " + callLine.trim());
  // UNGATED, for the reason it always was: a bundle that will not load is exactly
  // when a render report matters most, so gating on it silences the one thing
  // that would say so.
  assert.ok(!/if\s*\(\s*ssr(?:\.ok|Fetch)?\s*\)|ssr\.ok\s*\?/.test(win),
    "the check is gated on the server starting — a server that will not start silences the report that would say so");
  // AND STOPPED, whatever happened. One leaked child per build is the module
  // registry leak this replaced, wearing a process instead.
  assert.match(win, /finally\s*\{[^}]*\.stop\(\)/,
    "the site's server is not stopped in a finally — a build that throws leaks a child process");
});

test("the response says when the drop did NOT happen, and never that it did", () => {
  const src = source("../builder/build-server.mjs");
  const okLine = src.slice(src.indexOf("{ ok: true, files: dist"));
  const lit = okLine.slice(0, okLine.indexOf("\n"));
  assert.ok(/\bok: true\b/.test(lit), "the ok:true response literal moved — rescope this");
  // THE `prerenderUnprivileged` RULE with `sandboxed`'s reporting shape: carried
  // only when FALSE, so an ordinary response is byte-identical and the field's
  // PRESENCE is the alarm. Derived from the handle, never a constant.
  assert.match(lit, /ssrUnprivileged/, "the build response no longer says whether model code was confined");
  assert.match(lit, /ssr\.unprivileged\s*\?\s*\{\s*\}\s*:\s*\{\s*ssrUnprivileged:\s*false\s*\}/,
    "the field is not the negative alarm derived from the handle — a hardcoded or always-present value is the fail-open this replaces");
});

test("the child is spawned from the service's own directory, and writes nothing", () => {
  // NOT FROM `APP` OR THE CWD: it is part of the build SERVICE, not of the
  // template the service builds, and `APP_DIR` is a sandbox in every harness.
  assert.ok(fs.existsSync(RENDER_CHILD), "the spawned child is not on disk: " + RENDER_CHILD);
  assert.equal(path.dirname(RENDER_CHILD), path.dirname(new URL("../builder/site-ssr.mjs", import.meta.url).pathname));

  // THE PROPERTY THAT MAKES THE PRIVILEGE DROP POSSIBLE AT ALL. A child that
  // touched the filesystem could not be run as a user that cannot write, so the
  // parent does every write there is. Asserted on the file rather than on a run,
  // because a write it does not happen to make today is still a capability.
  const kid = source("../builder/render-server-child.mjs");
  for (const bad of [/\bfrom\s*["']node:fs["']/, /\bfrom\s*["']node:child_process["']/, /\bwriteFileSync\b/, /\bmkdirSync\b/]) {
    assert.doesNotMatch(kid, bad, "the render child reached for a capability it must not have: " + bad);
  }
});
