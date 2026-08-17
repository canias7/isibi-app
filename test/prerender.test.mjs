// The prerender step: what it runs the model's code IN, and what it can say.
//
// THE THING BEING PROTECTED. Every route component the prerender executes was
// written by a model from a brief that this codebase already treats as
// attacker-controlled prose. It used to be `import()`ed straight into the build
// server's own process — so it ran with the service's privileges, in the loop
// that answers `/health`, in a container that is long-lived and shared by every
// customer on the platform. A `while (true)` in one page wedged the event loop
// and queued every other customer's build behind it; a write to
// `/app/.routes-base` or `src/components/**` survived `resetRoutes` and would
// have been in every LATER customer's build.
//
// The child is driven for real here — spawned, killed, fed a broken bundle —
// because its contract is the whole protection and a fake child would prove
// nothing about it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { routeOf } from "../builder/site-addon.mjs";
import { renderReport } from "../builder/site-render.mjs";

const CHILD = new URL("../builder/prerender-child.mjs", import.meta.url).pathname;
const SERVER = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

/** A throwaway ES module exporting `render`, so the child has a bundle to load. */
function fakeBundle(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prerender-"));
  const file = path.join(dir, "entry-server.js");
  fs.writeFileSync(file, body);
  return { file, dir };
}

/** Run the real child and collect its NDJSON. `killAfter` proves the flush. */
function runChild(entry, routes, { killAfter = 0 } = {}) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [CHILD, entry, JSON.stringify(routes)]);
    let out = "";
    let timer = null;
    child.stdout.on("data", (d) => {
      out += d;
      if (killAfter && out.split("\n").filter(Boolean).length >= killAfter && !timer) {
        timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 20);
      }
    });
    child.on("close", (code, signal) => {
      const lines = [];
      for (const raw of out.split("\n")) {
        const s = raw.trim();
        if (!s) continue;
        try { lines.push(JSON.parse(s)); } catch { lines.push({ unparseable: s }); }
      }
      done({ code, signal, lines, out });
    });
  });
}

test("the child renders each route and says it is finished", async () => {
  const { file, dir } = fakeBundle(
    'export async function render(p) { return "<main>" + p + " ok</main>"; }');
  try {
    const r = await runChild(file, ["/", "/book"]);
    assert.equal(r.code, 0, "a clean run exits 0");
    assert.deepEqual(r.lines.filter((l) => l.p).map((l) => l.p), ["/", "/book"]);
    assert.match(r.lines[0].body, /\/ ok/);
    assert.ok(r.lines.some((l) => l.done === true),
      "no terminator — the parent cannot tell a finished run from a killed one");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("A PAGE THAT THROWS COSTS ONLY ITS OWN SNAPSHOT", async () => {
  // The reason the loop is per-route rather than one call that either works or
  // does not: four good pages are worth having, and the site publishes either
  // way. `err` and `body` are separate keys so the parent cannot read a thrown
  // route's message as markup.
  const { file, dir } = fakeBundle(
    'export async function render(p) { if (p === "/bad") throw new Error("kaboom"); return "<main>ok</main>"; }');
  try {
    const r = await runChild(file, ["/", "/bad", "/last"]);
    const bad = r.lines.find((l) => l.p === "/bad");
    assert.match(bad.err, /kaboom/);
    assert.equal(bad.body, undefined, "a thrown route must not also carry markup");
    assert.equal(r.lines.filter((l) => typeof l.body === "string").length, 2, "the other two still rendered");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("A KILLED CHILD STILL DELIVERS WHAT IT HAD — the reason this is NDJSON", async () => {
  // THE WHOLE POINT OF LINE-AT-A-TIME. A page that never returns is exactly the
  // case the subprocess exists for, and with one JSON object written at the end
  // the SIGKILL would take every earlier route's snapshot with it — one
  // pathological page costing the entire site rather than itself.
  const { file, dir } = fakeBundle(
    'export async function render(p) { if (p === "/hang") { for (;;) {} } return "<main>ok</main>"; }');
  try {
    const r = await runChild(file, ["/", "/two", "/hang", "/never"], { killAfter: 2 });
    assert.equal(r.signal, "SIGKILL", "the harness did not actually kill it — this proves nothing");
    const got = r.lines.filter((l) => typeof l.body === "string").map((l) => l.p);
    assert.deepEqual(got, ["/", "/two"], "the routes rendered before the kill were lost");
    assert.ok(!r.lines.some((l) => l.done === true), "a killed run must not claim it finished");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a bundle that will not load is one named fatal, not four silent routes", async () => {
  const { file, dir } = fakeBundle("this is not valid javascript {{{");
  try {
    const r = await runChild(file, ["/", "/book"]);
    const fatal = r.lines.find((l) => l.fatal);
    assert.ok(fatal, "a broken bundle produced no fatal line");
    assert.ok(!r.lines.some((l) => l.p), "no route can have rendered");
    // AND EXACTLY ONE VERDICT. `finish()` exits from a write callback rather
    // than synchronously, so a straight-line script carries on past a fatal and
    // prints a second, contradictory answer about the same run.
    assert.equal(r.lines.filter((l) => l.fatal).length, 1, "two fatals for one run");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a bundle with no render export says so rather than rendering nothing", async () => {
  const { file, dir } = fakeBundle("export const nope = 1;");
  try {
    const r = await runChild(file, ["/"]);
    assert.match(r.lines.find((l) => l.fatal).fatal, /no render/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("THE CHILD WRITES NOTHING — which is what lets it run with no write access", async () => {
  // The security property stated as a property of the FILE rather than of a
  // test run: a child that touches the filesystem cannot be dropped to a user
  // that cannot write, and the drop is the only thing standing between a
  // hostile brief and every later customer's build.
  const src = fs.readFileSync(CHILD, "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  for (const bad of [/\bfs\b/, /writeFile/, /mkdir/, /node:fs/, /appendFile/]) {
    assert.ok(!bad.test(src), "the prerender child touches the filesystem (" + bad + ")");
  }
  // And it holds no other capability worth having: no network, no subprocess.
  for (const bad of [/node:child_process/, /node:net/, /\bfetch\(/]) {
    assert.ok(!bad.test(src), "the prerender child gained a capability it does not need (" + bad + ")");
  }
});

test("the parent runs it as a subprocess, bounded, and drops privileges when it can", () => {
  assert.match(SERVER, /run\(process\.execPath, \[PRERENDER_CHILD,/,
    "the render is not spawned — model-written code is back in the build server's event loop");
  // BOUNDED BY THE SAME MECHANISM AS EVERY OTHER STEP, which is the availability
  // half of the fix: `run` is the one function with STEP_TIMEOUT and a SIGKILL
  // behind it, and using anything else here would be a step with no timeout.
  const runFn = SERVER.slice(SERVER.indexOf("function run(cmd, args, env"), SERVER.indexOf("function collectDist"));
  assert.match(runFn, /STEP_TIMEOUT/, "run() lost its timeout");
  assert.match(runFn, /kill\("SIGKILL"\)/, "run() no longer kills a step that overran");

  // The drop itself. uid 0 is not a drop, and without the `> 0` a misconfigured
  // passwd row would hand model code root while reading here exactly like
  // success.
  const at = SERVER.indexOf("const PRERENDER_AS");
  assert.ok(at > 0, "the privilege drop is gone");
  const decl = SERVER.slice(at, SERVER.indexOf("})();", at));
  assert.match(decl, /uid > 0/, "uid 0 would be accepted as a privilege drop");
  assert.match(decl, /process\.getuid\(\) !== 0/, "a non-root container must not try to drop and fail");
  assert.match(SERVER, /PRERENDER_AS \|\| undefined/, "the resolved uid is not handed to the spawn");
});

test("whether the drop actually happened is REPORTED, never assumed", () => {
  // "We thought this was sandboxed" is worse than knowing it is not: the drop
  // depends on the container running as root and on the user existing, neither
  // of which this code can guarantee, so the answer rides on every build.
  //
  // THE PREMISE IS ASSERTED FIRST, because it stopped holding. Under Start the
  // document is rendered per REQUEST by the site's own Worker, so the build has
  // no prerender step and nothing to report about it — the field is ABSENT from
  // the response rather than emptied, deliberately, since an empty list would
  // read as "the prerender ran and produced nothing", which is the one state
  // that used to mean every page published blank.
  //
  // Written as the pair rather than deleted: the sandbox reasoning below is
  // still correct and still worth keeping, and if the step is ever re-wired
  // this goes red until the reporting comes back with it. A guard whose feature
  // has gone is replaced by its inverse here, never quietly dropped — the
  // `@/examples/*` lint precedent.
  const runs = /await timed\("preMs"[\s\S]{0,80}?prerender\(\)\)/.test(SERVER);
  if (runs) {
    assert.match(SERVER, /prerenderUnprivileged: !!pre\.unprivileged/,
      "the build response no longer says whether the render was dropped");
  } else {
    // COMMENTS BLANKED BEFORE JUDGING AN ABSENCE. The note in `build-server.mjs`
    // explaining that these fields are gone NAMES them, so a bare scan of the
    // source finds the word it was written to forbid and fails against a correct
    // file. Recorded here twice before; this is the third.
    const code = SERVER.replace(/\/\/[^\n]*/g, "");
    assert.ok(!/prerenderUnprivileged/.test(code),
      "the build reports a prerender sandbox for a step it no longer runs");
  }
  const df = fs.readFileSync(new URL("../builder/Dockerfile", import.meta.url), "utf8");
  assert.match(df, /^ENV PRERENDER_USER=\S+/m, "the image names no unprivileged user for the render");
  assert.ok(!/^USER /m.test(df),
    "the image switched to a non-root user — the build service itself writes src/routes and dist, " +
    "and only root can hand a subprocess a different uid, so this breaks both halves");
});

test("EVERY exit from prerender() says whether it was sandboxed", () => {
  // A field carried on some returns and not others reads as "not sandboxed" on
  // the paths that omit it — which is the alarming answer, given for free by an
  // early return that has nothing to do with privileges.
  const body = SERVER.slice(SERVER.indexOf("async function prerender()"), SERVER.indexOf("\nfunction writeTheme("));
  assert.ok(body.length > 500, "prerender() moved — rescope this");
  const returns = body.match(/return \{[^}]*done[^}]*\}/g) || [];
  assert.ok(returns.length >= 4, "only " + returns.length + " returns found — the scan stopped working");
  for (const r of returns) assert.match(r, /unprivileged/, "a prerender exit that does not report the sandbox: " + r);
});

test("the SSR build failure carries the compiler's own reason", () => {
  // It said "ssr build failed" — four words naming the step we already knew,
  // which is the exact sentence exit-reason.mjs exists to abolish, on the one
  // failure that costs every snapshot on a site.
  //
  // COMMENTS BLANKED BEFORE THE ABSENCE IS JUDGED, and the first draft of this
  // test proved why by failing against the fix: the comment explaining the bug
  // contains the bug's own spelling. Blanked rather than removed, so every
  // offset the assertions below rely on stays where it is.
  const body = SERVER.slice(SERVER.indexOf("async function prerender()"), SERVER.indexOf("\nfunction writeTheme("))
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  assert.ok(body.length > 500, "prerender() moved — rescope this");
  assert.ok(!/ssr build failed/.test(body), "the four-word non-reason is back");
  assert.match(body, /exitReason\("the ssr build", ssr\)/, "the ssr failure no longer reports why");
  assert.match(body, /exitReason\("the renderer", child\)/, "a killed renderer no longer reports why");
});

test("a route the renderer never reached is named, with its reason", () => {
  // Named individually rather than as one "*: killed" line: the question a
  // reader has is which pages lost their snapshot — and with the reason
  // attached, so a kill is not read as the page having rendered nothing.
  const body = SERVER.slice(SERVER.indexOf("async function prerender()"), SERVER.indexOf("\nfunction writeTheme("));
  assert.ok(body.length > 500, "prerender() moved — rescope this");
  assert.match(body, /for \(const p of routes\) if \(!seen\.has\(p\)\)/,
    "routes the child never answered for are silently dropped");
});

// ── ONE READING OF THE FILE-TO-URL MAPPING ──────────────────────────────────

test("the container asks routeOf rather than keeping a copy", () => {
  // FIXING THE CONTAINER'S COPY ALONE WOULD HAVE BEEN WORSE THAN THE BUG. The
  // published route manifest comes from siteRoutes → routeOf, so a container
  // prerendering `/about/team` against a manifest still saying `/about.team`
  // makes Round 7's fallback answer 404 for a page that used to load through
  // the SPA path. Two readings of one mapping is the repo's "path-shape
  // mismatch" family; the answer is one function, not two that agree.
  // The IMPORT, not its exact member list: `fileForRoute` joined it when the
  // publish path needed the same mapping, and a pin on the one name would have
  // made that correct change arrive as a red test.
  assert.match(SERVER, /import \{[^}]*\brouteOf\b[^}]*\} from "\.\/site-addon\.mjs"/,
    "build-server.mjs no longer imports the shared mapping");
  const fn = SERVER.slice(SERVER.indexOf("function routePaths()"), SERVER.indexOf("\n// WHO THE PRERENDER RUNS AS"));
  assert.ok(fn.length > 100, "routePaths moved — rescope this");
  assert.match(fn, /routeOf\(base \+ name\)/, "routePaths computes its own route again");
  assert.ok(!/endsWith\("\/index"\)|=== "index"/.test(fn),
    "routePaths has grown a second copy of the index rule");
  // The `$` filter stays HERE and is load-bearing: routeOf passes a `$` through
  // on purpose so siteRoutes can mark a site dynamic, and the prerender has no
  // concrete address to render.
  assert.match(fn, /name\.includes\("\$"\)/, "a dynamic route would now be prerendered at a literal `$` path");
});

test("TanStack's flat form is a directory separator, not a character", () => {
  assert.equal(routeOf("about.team.tsx"), "/about/team");
  assert.equal(routeOf("src/routes/about.team.tsx"), "/about/team");
  assert.equal(routeOf("shop/about.team.tsx"), "/shop/about/team");
  // An index at the end of a flat chain drops, exactly as it does in a directory.
  assert.equal(routeOf("about.index.tsx"), "/about");
  // A trailing `_` opts a segment out of nesting; the URL is unchanged.
  assert.equal(routeOf("about_.team.tsx"), "/about/team");
});

test("a pathless layout has no address, and answers so for every caller", () => {
  // A leading `_` is a layout, not a page: nothing should route to it, list it
  // in a sitemap, or render it to a snapshot. `__root` falls out of the same
  // rule rather than needing a filter of its own.
  assert.equal(routeOf("_layout.tsx"), "");
  assert.equal(routeOf("__root.tsx"), "");
  assert.equal(routeOf("shop/_layout.tsx"), "");
});

test("the shapes that already worked still answer exactly what they did", () => {
  // The mapping is read by four callers and a regression here is a page-edit
  // layer that cannot find a page — which has happened, and was measured live.
  assert.equal(routeOf("index.tsx"), "/");
  assert.equal(routeOf("gallery.tsx"), "/gallery");
  assert.equal(routeOf("shop/index.tsx"), "/shop");
  assert.equal(routeOf("shop/item.tsx"), "/shop/item");
  assert.equal(routeOf("src/routes/index.tsx"), "/");
  assert.equal(routeOf("weird.txt"), "");
  assert.equal(routeOf(""), "");
  // A `$` PASSES THROUGH. siteRoutes reads it as "this site is dynamic, publish
  // no route list at all"; swallowing it here would turn that into a confident,
  // wrong list of static routes.
  assert.equal(routeOf("shop/$id.tsx"), "/shop/$id");
});

// ── THE RENDER CHECK'S OWN HONESTY ──────────────────────────────────────────

test("a run that stopped at the time budget does not read as a clean sweep", () => {
  // Without this the report was byte-identical to one that looked at every page
  // and found nothing — "we checked and it was fine" said about pages nobody
  // opened. Live renderMs sits at ~30s against a 25s loop budget, so this is
  // the ordinary path rather than the edge.
  const full = renderReport([{ route: "/", viewport: "phone" }]);
  const cut = renderReport([{ route: "/", viewport: "phone" }], { cut: true });
  assert.equal(full.partial, undefined, "an untruncated report must be byte-identical to what it always was");
  assert.equal(cut.partial, true);
  assert.equal(cut.ok, true, "what did run really ran — this is not a broken harness");
  assert.deepEqual(Object.keys(full), Object.keys(cut).filter((k) => k !== "partial"),
    "truncation changed the report's shape beyond the one flag");
});

test("the loop actually sets it when it stops early", () => {
  const src = fs.readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(Date\.now\(\) > until\) \{ cut = true; break; \}/,
    "the time-budget break no longer records that it fired");
  // ANCHORED ON THE PROPERTY, NOT THE ARGUMENT LIST. This named
  // `renderReport(seen, { cut })` exactly and went red the moment a second
  // honest field was added beside it — a test about word order, which is this
  // repo's most repeated own-goal. What has to hold is that EVERY report this
  // function returns carries the flag: a run that both truncated and failed
  // otherwise loses one of the two facts.
  const returns = [...src.matchAll(/renderReport\(seen, \{([^}]*)\}\)/g)].map((m) => m[1]);
  assert.ok(returns.length >= 2, `only ${returns.length} report returns found — the scan stopped matching`);
  for (const args of returns) {
    assert.match(args, /\bcut\b/, "a report return drops the truncation flag: {" + args + "}");
  }
});

test("A MALFORMED URL CANNOT KILL THE BUILD SERVICE", () => {
  // `decodeURIComponent` throws on a bad percent-sequence, and an uncaught throw
  // in a Node request handler does not 500 — it kills the process. That is the
  // whole build service, mid-build, for every customer queued behind it, and
  // Cloudflare reports the restart as "the container is not running". The input
  // is a model-written href: `/services/50%-off` is enough, and it is
  // deterministic for that site — every rebuild kills the container again.
  const src = fs.readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
  // ANCHORED ON THE NAME, NOT THE PARAMETER LIST. Written `serveDist(dir)` this
  // went red the day the function grew a second argument — a test about word
  // order failing a change it has no opinion about, which is this repo's most
  // repeated own-goal.
  const at = src.indexOf("function serveDist(");
  assert.ok(at > 0, "serveDist moved — rescope this");
  const body = src.slice(at, src.indexOf("\n}\n", at));
  assert.match(body, /try \{ p = decodeURIComponent\([a-z]+\); \} catch \{ p = [a-z]+; \}/,
    "the decode is unguarded again — one bad href takes the whole container down");
  assert.ok(!/^\s*const p = decodeURIComponent/m.test(body), "an unguarded decode is back");

  // Driven, not only read: the guard is worth nothing if the fallback throws too.
  const decode = (raw) => { const bare = String(raw).split("?")[0]; try { return decodeURIComponent(bare); } catch { return bare; } };
  assert.equal(decode("/services/50%-off"), "/services/50%-off", "the real failing input must come back as itself");
  assert.equal(decode("/a%2Fb"), "/a/b", "a valid sequence must still decode");
  assert.equal(decode("/x?q=50%"), "/x", "the query is still cut before decoding");
});

test("the sandbox verdict survives BOTH hops to the response", () => {
  // Twelve recorded times, a feature has been built correctly and left dead at
  // one silent wiring link — and the layer that gets missed is always the one
  // that cannot be imported. Asserted at each hop, because either alone passes
  // while the wire is cut one step further along.
  const pub = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.match(pub, /bd\.prerenderUnprivileged === false\) out\.prerenderUnprivileged = false/,
    "publish-pages drops the sandbox verdict on the floor");
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /prerenderUnprivileged: pages\.prerenderUnprivileged === false \? false : undefined/,
    "the route drops the sandbox verdict on the floor");

  // CARRIED ONLY WHEN FALSE, deliberately, at both hops. The ordinary response
  // stays byte-identical to what it was, and the field's PRESENCE is the alarm
  // rather than its value — which is the shape that cannot be misread as
  // reassurance by a caller that forgot to check it.
  assert.ok(!/prerenderUnprivileged: !!/.test(pub) && !/prerenderUnprivileged: !!/.test(worker),
    "the verdict is now carried on every build — a truthy field nobody reads is not a warning");
});

// THE DROP, DRIVEN. Everything above asserts the drop is WIRED; this asserts it
// WORKS, which is a different claim and the one the protection rests on.
//
// It needs root (only root can hand a subprocess another uid) and it needs an
// unprivileged user to exist, so it SKIPS rather than passing when it cannot
// run — a security check that silently goes green on every CI machine is worse
// than no check at all. Measured 2026-08-14 in a root container: undropped the
// render wrote into the build service's own directory (`wrote=YES`), and
// dropped to uid 65534 the identical page came back `refused:EACCES` while
// still rendering perfectly. That pair IS the finding and its fix.
const canDrop = (() => {
  try {
    if (typeof process.getuid !== "function" || process.getuid() !== 0) return null;
    const row = fs.readFileSync("/etc/passwd", "utf8").split("\n").find((l) => l.startsWith("nobody:"));
    if (!row) return null;
    const f = row.split(":");
    return { uid: Number(f[2]), gid: Number(f[3]) };
  } catch { return null; }
})();

test("A DROPPED RENDER CANNOT WRITE, and an undropped one can", { skip: canDrop ? false : "needs root and an unprivileged user" }, async () => {
  // World-readable, because /app is: the child must still be able to READ the
  // bundle it renders. Putting the fixture somewhere only root can read would
  // prove the drop by breaking the feature, which proves nothing.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drop-"));
  const target = path.join(dir, "POISONED");
  const entry = path.join(dir, "entry-server.js");
  fs.writeFileSync(entry,
    'import fs from "node:fs";\n' +
    'export async function render() {\n' +
    '  try { fs.writeFileSync(' + JSON.stringify(target) + ', "x"); return "<main>wrote</main>"; }\n' +
    '  catch (e) { return "<main>refused:" + e.code + "</main>"; }\n' +
    '}\n');
  // The fixture readable by all; the DIRECTORY writable only by its owner,
  // which is what /app is and what makes the two runs differ.
  fs.chmodSync(dir, 0o755);
  fs.chmodSync(entry, 0o644);

  const run = (opts) => new Promise((done) => {
    const c = spawn(process.execPath, [CHILD, entry, JSON.stringify(["/"])], opts);
    let o = ""; c.stdout.on("data", (d) => { o += d; });
    c.on("close", () => done(o));
  });

  const asRoot = await run({});
  assert.match(asRoot, /wrote/, "the hazard is not reachable here, so the fix below proves nothing");
  assert.ok(fs.existsSync(target), "undropped, model code really does write into the build service's world");
  fs.rmSync(target, { force: true });

  const dropped = await run(canDrop);
  assert.match(dropped, /refused:EACCES/, "THE DROP DID NOT STOP THE WRITE — model code can still poison the shared container");
  assert.ok(!fs.existsSync(target), "the file landed anyway");
  // AND IT STILL RENDERS. A sandbox that also breaks the feature is not one
  // anybody keeps: the point is that the child needs no write access at all.
  assert.match(dropped, /"p":"\/"/, "the dropped render produced no page — the drop broke the feature it protects");
  fs.rmSync(dir, { recursive: true, force: true });
});
