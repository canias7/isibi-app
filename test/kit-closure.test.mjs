// THE PROJECT A CUSTOMER DOWNLOADS HAS TO BUILD.
//
// The Code tab showed 28 files and the Download zipped the same 28 — and
// `src/routes/__root.tsx`, one of those 28, imports `@/components/ui/sonner`.
// So the zip carried the importer and not the module: `npm run build` on it
// could not resolve its own first import. The closure this module resolves is
// what closes that, and the explorer showing a real project falls out of it
// (owner, 2026-09-12, holding Lovable's tree beside ours: "look at all of this,
// we dont have all of it").
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kitClosure, kitSpecs, aliasPath, TRIES, MAX_KIT_FILES } from "../builder/kit-closure.mjs";
import { FOUNDATION_FILES } from "../builder/foundation-files.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");
const CHAT = read("../public/chat.js");
const WORKER = read("../worker.js");
const SERVER = read("../builder/build-server.mjs");
const TEMPLATE = path.join(here, "../builder/lovable/template");
const shared = Array.isArray(FOUNDATION_FILES) ? FOUNDATION_FILES : [];

/** A reader over a plain map, for the driven cases. */
const mapReader = (files) => (p) => (Object.hasOwn(files, p) ? files[p] : null);

test("DRIVEN: every import shape a real page uses is found, and nothing else is", () => {
  const src = [
    'import { Button } from "@/components/ui/button";',
    'import Chart from "@/components/ui/chart"',
    'export { Card } from "@/components/ui/card";',
    'const x = await import("@/components/ui/lazy");',
    'import React from "react";',                      // a package, never ours
    'import { a } from "./sibling";',                  // relative, never ours
    'const s = "@/components/ui/not-an-import";',      // a STRING, not a specifier
  ].join("\n");
  assert.deepEqual(kitSpecs(src), [
    "@/components/ui/button", "@/components/ui/chart",
    "@/components/ui/card", "@/components/ui/lazy",
  ], "the reader found the wrong set of specifiers");
  // A BARE STRING IS NOT AN IMPORT. A page that merely MENTIONS a path — in a
  // comment, in a class name, in prose — must not drag a file into the project.
  assert.ok(!kitSpecs(src).includes("@/components/ui/not-an-import"), "a plain string was read as an import");
});

test("DRIVEN: `@/` is `src/`, and nothing else is rewritten", () => {
  assert.equal(aliasPath("@/components/ui/button"), "src/components/ui/button");
  assert.equal(aliasPath("react"), "", "a package name was rewritten as a path");
  assert.equal(aliasPath("./x"), "", "a relative import was rewritten as a path");
  assert.equal(aliasPath(null), "", "a non-string was coerced");
});

test("DRIVEN: the extension order is the resolver — a file beats a directory", () => {
  // `.tsx` BEFORE the bare path, or `foo/` wins over `foo.tsx` and the project
  // gets a directory where the bundler takes the file.
  assert.ok(TRIES.indexOf(".tsx") < TRIES.indexOf(""), "the bare path is tried before the extensions");
  assert.ok(TRIES.indexOf(".tsx") < TRIES.indexOf("/index.tsx"), "a directory is tried before the file");
  const files = { "src/x.tsx": "FILE", "src/x/index.tsx": "DIR" };
  const r = kitClosure(['import a from "@/x";'], mapReader(files));
  assert.deepEqual(r.files, [{ path: "src/x.tsx", source: "FILE" }], "the directory won over the file");
});

test("DRIVEN: it follows transitively, and a cycle terminates", () => {
  const files = {
    "src/a.tsx": 'import b from "@/b";',
    "src/b.tsx": 'import c from "@/c";',
    // A CYCLE IS AN ORDINARY THING in a kit that re-exports through barrels, and
    // the failure is not a wrong answer, it is a build that never returns.
    "src/c.tsx": 'import a from "@/a";',
  };
  const r = kitClosure(['import a from "@/a";'], mapReader(files));
  assert.deepEqual(r.files.map((f) => f.path), ["src/a.tsx", "src/b.tsx", "src/c.tsx"]);
  assert.deepEqual(r.missing, []);
});

test("DRIVEN: a file the project already has is WALKED but not sent again", () => {
  const files = {
    // `src/lib/utils.ts` is in the bundled set, and it imports things of its own
    // that the closure still has to carry. Skipping it whole would leave the
    // project short exactly the files nothing else imports.
    "src/lib/utils.ts": 'import deep from "@/lib/deep";',
    "src/lib/deep.ts": "export const deep = 1;",
  };
  const r = kitClosure(['import u from "@/lib/utils";'], mapReader(files), ["src/lib/utils.ts"]);
  assert.deepEqual(r.files.map((f) => f.path), ["src/lib/deep.ts"],
    "a file the project already has was sent again, or its own imports were dropped");
});

test("DRIVEN: an import that resolves to nothing is NAMED, never dropped", () => {
  const r = kitClosure(['import x from "@/components/ui/nope";'], mapReader({}));
  assert.deepEqual(r.files, []);
  assert.deepEqual(r.missing, ["@/components/ui/nope"],
    "a page importing a module that does not exist was passed over in silence");
});

test("DRIVEN: the cap is a ceiling, and reaching it is reported", () => {
  assert.ok(MAX_KIT_FILES >= 200, "the cap is below the range real sites need");
  const files = {};
  let src = "";
  for (let i = 0; i < MAX_KIT_FILES + 20; i++) { files["src/f" + i + ".tsx"] = "x"; src += 'import a from "@/f' + i + '";\n'; }
  const r = kitClosure([src], mapReader(files));
  assert.equal(r.files.length, MAX_KIT_FILES, "the cap did not hold");
  assert.equal(r.capped, true, "a truncated closure did not say so");
});

test("DRIVEN: the order is stable, so two builds of an unchanged site store the same bytes", () => {
  const files = { "src/z.tsx": "z", "src/a.tsx": "a", "src/m.tsx": "m" };
  const seed = ['import z from "@/z"; import m from "@/m"; import a from "@/a";'];
  const one = kitClosure(seed, mapReader(files)).files.map((f) => f.path);
  assert.deepEqual(one, ["src/a.tsx", "src/m.tsx", "src/z.tsx"], "the closure is not sorted");
});

test("DRIVEN: a specifier that climbs out of the project resolves to nothing", () => {
  // The specifiers come out of source a MODEL wrote. The container's reader is
  // fenced to the app directory and the Worker refuses the path again on the way
  // into the store; here the module itself must not invent a path either.
  const seen = [];
  const r = kitClosure(['import x from "@/../../etc/passwd";'], (p) => { seen.push(p); return null; });
  assert.deepEqual(r.files, []);
  assert.ok(seen.every((p) => p.startsWith("src/")), "a specifier escaped the src prefix: " + seen.join(", "));
});

test("MEASURED: the closure over 100 real generated sites, and the defect it closes", () => {
  const corpus = path.join(here, "fixtures/corpus");
  const readKit = (rel) => {
    const full = path.resolve(TEMPLATE, rel);
    if (full !== TEMPLATE && !full.startsWith(TEMPLATE + path.sep)) return null;
    try { return fs.statSync(full).isFile() ? fs.readFileSync(full, "utf8") : null; } catch { return null; }
  };
  const have = shared.map((f) => f.path);
  const dirs = fs.readdirSync(corpus).filter((d) => fs.statSync(path.join(corpus, d)).isDirectory());
  // THE OBSERVER IS ALIVE before anything is concluded from what it did not find.
  assert.ok(dirs.length >= 50, "the corpus is not there — everything below would be vacuous (" + dirs.length + " sites)");
  assert.ok(shared.length >= 20, "the shared set is not loaded");

  let worst = 0, worstBytes = 0, sitesScanned = 0;
  const everMissing = new Set();
  for (const d of dirs) {
    const dir = path.join(corpus, d);
    const pages = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx")).map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
    if (!pages.length) continue;
    sitesScanned += 1;
    const r = kitClosure([...pages, ...shared.map((f) => f.source)], readKit, have);
    for (const m of r.missing) everMissing.add(m);
    assert.equal(r.capped, false, d + " hit the cap — the closure has stopped being a closure");
    assert.ok(r.files.length > 0, d + " resolved no kit files at all, which no real site does");
    worst = Math.max(worst, r.files.length);
    worstBytes = Math.max(worstBytes, r.files.reduce((n, f) => n + f.source.length, 0));
  }
  assert.ok(sitesScanned >= 50, "only " + sitesScanned + " sites had pages");
  // ZERO UNRESOLVED, ACROSS EVERY SITE. This is the number that says the
  // resolver understands the import shapes real generated pages use — if it
  // starts missing some, the Download stops building again and quietly.
  assert.deepEqual([...everMissing], [], "imports resolved to nothing: " + [...everMissing].join(", "));
  // AND THE SIZE IS WHY THIS IS SENT WITH THE SOURCE RATHER THAN LAZY-LOADED.
  // The kit is 3,394 files and 17 MB; a SITE needs this. If that stops being
  // true the design has to change, so the bound is asserted rather than trusted.
  assert.ok(worst <= 120, "the worst closure is " + worst + " files — it was 53 when this shipped; past ~120 it stops being something to send eagerly");
  assert.ok(worstBytes <= 600000, "the worst closure is " + worstBytes + " bytes — it was 126,082 when this shipped");
});

test("MEASURED: the shared set's own first import is what the Download was missing", () => {
  const root = shared.find((f) => f.path === "src/routes/__root.tsx");
  assert.ok(root, "`src/routes/__root.tsx` is not in the shared set — re-derive this case");
  const specs = kitSpecs(root.source);
  assert.ok(specs.length > 0, "the file every site ships imports nothing from the kit, which is the premise of this change");
  // THE DEFECT, NAMED: this file was in the zip and these were not.
  const readKit = (rel) => { try { return fs.readFileSync(path.join(TEMPLATE, rel), "utf8"); } catch { return null; } };
  const r = kitClosure([root.source], readKit, shared.map((f) => f.path));
  assert.ok(r.files.length > 0, "nothing resolves from __root.tsx, so this case proves nothing");
  assert.deepEqual(r.missing, [], "the file every site ships has an import that does not resolve: " + r.missing.join(", "));
});

test("THE CHAIN: resolved in the container, stored on both publish paths, answered, shown", () => {
  // A HOP NOBODY LISTS IS A HOP NOBODY GUARDS — this repository's own most
  // repeated defect, and this value crosses five boundaries. Each link is read
  // where it lives rather than in one place that could drift from all of them.

  // 1. THE CONTAINER RESOLVES IT and hands it up on the success reply.
  assert.match(SERVER, /import \{ kitClosure \} from "\.\/kit-closure\.mjs";/, "the container does not import the resolver");
  assert.match(SERVER, /function siteKitFiles\(\)/, "the container has no closure step");
  assert.match(SERVER, /const k = siteKitFiles\(\);/, "the closure step is never called");
  const okLine = SERVER.slice(SERVER.indexOf("{ ok: true, files: dist"));
  assert.match(okLine.slice(0, 900), /\.\.\.kitOut/, "the success reply does not carry the closure");
  // A THROW HERE MUST NOT LOSE A BUILT SITE: the files are compiled and paid for.
  const kitBlock = SERVER.slice(SERVER.indexOf("let kitOut = {};"), SERVER.indexOf("{ ok: true, files: dist"));
  assert.ok(kitBlock.length > 50 && kitBlock.length < 1200, "re-derive the closure block's window");
  assert.match(kitBlock, /catch \(e\)/, "a closure that throws takes the publish down with it");
  assert.match(kitBlock, /kitError/, "a closure that failed says nothing");

  // THE SEEDS ARE THE DIRECTORY, not what we were sent — a salvage stub or a
  // repair round writes pages we never posted, and their imports count too.
  const seedFn = SERVER.slice(SERVER.indexOf("function siteKitFiles() {"), SERVER.indexOf("function resetRoutes() {"));
  assert.ok(seedFn.length > 400, "re-derive the closure function's window");
  assert.match(seedFn, /walk\(ROUTES\);/, "the closure is seeded from the payload, so a salvaged page's imports are missed");
  // AND ITS READER IS FENCED TO THE APP DIRECTORY. Every specifier it is handed
  // came out of source a MODEL wrote, so `@/../../etc/passwd` is a shape that
  // can really arrive — `path.resolve` and a prefix test, never concatenation.
  assert.match(seedFn, /const full = path\.resolve\(APP, rel\);/, "the reader builds its path by concatenation");
  assert.match(seedFn, /if \(full !== APP && !full\.startsWith\(APP \+ path\.sep\)\) return null;/,
    "the container's reader is unfenced — a specifier can climb out of the app directory");

  // 2. THE WORKER STORES IT, on BOTH publish paths. The build path and the edit
  // spine are different functions and the recorded trap is fixing one.
  assert.match(WORKER, /const KIT_KEY = \(slug\) => "source\/" \+ String\(slug\)\.toLowerCase\(\) \+ "\/kit\.json";/,
    "the kit has no key");
  const saves = [...WORKER.matchAll(/await saveSiteKit\(env, slug, /g)];
  assert.equal(saves.length, 2, "expected the build path and the publish spine; found " + saves.length + " stores");
  // AND NEITHER IS BEHIND A DEAD BRANCH. A POSITION IS NOT A BEHAVIOUR — this
  // repository's own recorded trap, and a sweep proved it here: `if (false)
  // await saveSiteKit(…)` leaves the call exactly where a count or an ordering
  // finds it, so the store reads as wired while nothing is ever written. Each
  // call's OWN condition is read.
  for (const m of saves) {
    const line = WORKER.slice(WORKER.lastIndexOf("\n", m.index) + 1, WORKER.indexOf("\n", m.index));
    assert.ok(!/if \(false\)|if \(0\)/.test(line), "a kit store is behind a dead branch: " + line.trim());
    assert.match(line.trim(), /^(await saveSiteKit|if \(Array\.isArray\(built\.kit\)\) await saveSiteKit)/,
      "a kit store is gated on something other than the answer carrying a kit: " + line.trim());
  }
  // AND THE BUILD PATH REMEMBERS WHAT THE CONTAINER SENT, on a live condition.
  const keep = WORKER.slice(WORKER.indexOf("if (built && typeof built === \"object\" && Array.isArray(built.kit)) kitBuilt = built.kit;"));
  assert.ok(keep.length > 0, "the build path never remembers the closure the container sent");
  assert.ok(!/if \(false\) kitBuilt/.test(WORKER), "the build path's capture is behind a dead branch");
  // AND EACH SITS BESIDE THE PARTS STORE IT MIRRORS, so a publish that writes
  // one writes the other.
  for (const m of [...WORKER.matchAll(/await saveSiteParts\(env, slug, [a-zA-Z]+\);/g)]) {
    const after = WORKER.slice(m.index, m.index + 600);
    assert.match(after, /await saveSiteKit\(env, slug, /, "a publish path stores the parts and not the kit");
  }

  // 3. THE STORE SUBTRACTS WHAT THE BROWSER ALREADY GETS, derived from the
  // bundle itself rather than from a second list in the image.
  const save = WORKER.slice(WORKER.indexOf("async function saveSiteKit("), WORKER.indexOf("async function loadSiteKit("));
  assert.ok(save.length > 300, "re-derive the save function's window");
  assert.match(save, /foundationPaths\(\)/, "the store does not subtract the bundled files, so the tree shows them twice");
  assert.match(save, /!have\.has\(f\.path\)/, "the subtraction is not applied");
  // AND THE PATH IS REFUSED A SECOND TIME HERE. The specifiers that produced
  // these paths came out of source a MODEL wrote; the container's reader is
  // fenced to the app directory and this is the wall on the way into a
  // customer's zip, where a `..` must never reach.
  assert.match(save, /startsWith\("\/"\)/, "the store admits an absolute path");
  assert.match(save, /includes\("\.\."\)/, "the store admits a path that climbs out of the project");

  // 4. THE ROUTE ANSWERS IT.
  assert.match(WORKER, /loadSiteKit\(env, sslug\)/, "the source route does not read the kit");
  assert.match(WORKER, /\n        kit: sKit,/, "the source route does not answer the kit");

  // 5. THE BROWSER LISTS IT, under its own heading.
  assert.match(CHAT, /\['kit', 'Design system'\]/, "the explorer has no group for it");
  assert.match(CHAT, /for \(const f of \(src && Array\.isArray\(src\.kit\)\) \? src\.kit : \[\]\)/,
    "the browser never reads the kit off the answer");
  assert.match(CHAT, /kind: 'kit'/, "the files are read but not marked, so they land in no group");
});

test("ONE LIST STILL FEEDS THE TREE AND THE DOWNLOAD, kit included", () => {
  // The whole point is the ZIP. A tree that shows the components and a download
  // that omits them is the same broken project with a nicer picture of it.
  const fn = (head) => {
    const at = CHAT.indexOf(head);
    assert.ok(at > 0, "gone: " + head);
    return CHAT.slice(at, CHAT.indexOf("\n}", at) + 2);
  };
  const stSrcFiles = new Function(fn("function stSrcFiles(src) {") + "\n" + fn("function stSrcPath(f) {") + "\nreturn stSrcFiles;")();
  const out = stSrcFiles({
    pages: [{ path: "index.tsx", source: 'import { Button } from "@/components/ui/button";' }],
    shared: [{ path: "src/routes/__root.tsx", source: "root" }],
    kit: [
      { path: "src/components/ui/button.tsx", source: "BUTTON" },
      { path: "src/components/ui/sonner.tsx", source: "SONNER" },
    ],
  });
  const names = out.map((f) => f.name);
  assert.ok(names.includes("src/components/ui/button.tsx"), "the imported component is not in the list the zip is built from");
  assert.ok(names.includes("src/components/ui/sonner.tsx"), "the module __root.tsx imports is not in the list");
  assert.equal(out.find((f) => f.name === "src/components/ui/button.tsx").kind, "kit", "it landed in the wrong group");
  assert.equal(out.find((f) => f.name === "src/components/ui/button.tsx").text, "BUTTON", "the contents did not survive");
  // A SITE THAT HAS NOT PUBLISHED SINCE THIS SHIPPED — every site, the day it
  // does — shows exactly what it showed before, with no error and no gap.
  const before = stSrcFiles({ pages: [{ path: "index.tsx", source: "x" }], shared: [] });
  assert.deepEqual(before.map((f) => f.name), ["src/routes/index.tsx"], "a site with no stored kit changed");
  // AND A HOSTILE ENTRY IS REFUSED RATHER THAN NAMED INTO THE ZIP.
  const hostile = stSrcFiles({ pages: [], shared: [], kit: [{ path: "src/ok.tsx", source: "a" }, { path: "", source: "b" }, { path: "src/bad.tsx" }] });
  assert.deepEqual(hostile.map((f) => f.name), ["src/ok.tsx"], "a nameless or sourceless kit entry reached the list");
});

test("DRIVEN: the store subtracts what the browser already gets, DERIVED from the bundle", () => {
  // A SWEEP SURVIVED A HARDCODED LIST HERE, and reading the source could not
  // tell one from the other: `foundationPaths()` is called either way. What
  // separates them is behaviour — a file that is in the bundle TODAY must be
  // subtracted, whatever its name is, so the function is carried out and run
  // against the real bundle.
  const fnOut = (head, close) => {
    const at = WORKER.indexOf(head);
    assert.ok(at > 0, "gone: " + head);
    const end = WORKER.indexOf(close, at);
    assert.ok(end > at, "no close for: " + head);
    return WORKER.slice(at, end + close.length);
  };
  // `KIT_KEY` IS CARRIED TOO. A function lifted out of the file resolves its
  // free names when a LINE RUNS, not when the scope is built — this
  // repository's own recorded trap, and it arrived here through the door the
  // entry describes: without it the store threw `KIT_KEY is not defined` inside
  // its own catch and answered `false`, which reads exactly like a refused write.
  const konst = (name) => {
    const at = WORKER.indexOf("const " + name + " = ");
    assert.ok(at > 0, "gone: " + name);
    return WORKER.slice(at, WORKER.indexOf("\n", at));
  };
  const scope = new Function("FOUNDATION_FILES", [
    "let FOUNDATION_PATH_SET = null;",
    konst("KIT_KEY"),
    fnOut("function foundationPaths() {", "\n}"),
    fnOut("async function saveSiteKit(env, slug, kit) {", "\n}"),
    "return { saveSiteKit, foundationPaths };",
  ].join("\n"));

  const put = [];
  const env = { SITES_BUCKET: { put: async (key, body) => { put.push({ key, body }); } } };
  // THE REAL BUNDLE, so "is this file already sent" is answered by the thing
  // that actually sends it.
  const real = scope(FOUNDATION_FILES);
  const bundled = shared[0] && shared[0].path;
  assert.ok(bundled, "the shared set is empty — this case would prove nothing");

  return real.saveSiteKit(env, "s", [
    { path: bundled, source: "ALREADY BUNDLED" },
    { path: "src/components/ui/button.tsx", source: "BUTTON" },
    { path: "/etc/passwd", source: "ABSOLUTE" },
    { path: "src/../../secrets.env", source: "CLIMBING" },
    { path: "", source: "NAMELESS" },
    { path: "src/ok.tsx" },
  ]).then((ok) => {
    assert.equal(ok, true, "the store refused a healthy write");
    assert.equal(put.length, 1, "expected exactly one object written");
    assert.equal(put[0].key, "source/s/kit.json", "the kit went to the wrong key");
    const stored = JSON.parse(put[0].body);
    assert.deepEqual(stored, [{ path: "src/components/ui/button.tsx", source: "BUTTON" }],
      "the store kept something it should have dropped, or dropped the one file it should keep");

    // AND THE SUBTRACTION IS DERIVED, not a list that happens to contain today's
    // names: handed a DIFFERENT bundle, it subtracts THAT one's paths instead.
    const other = scope([{ path: "src/components/ui/button.tsx", source: "x" }]);
    const put2 = [];
    return other.saveSiteKit({ SITES_BUCKET: { put: async (k, b) => { put2.push(b); } } }, "s",
      [{ path: "src/components/ui/button.tsx", source: "BUTTON" }, { path: "src/components/ui/card.tsx", source: "CARD" }]
    ).then(() => {
      assert.deepEqual(JSON.parse(put2[0]).map((f) => f.path), ["src/components/ui/card.tsx"],
        "the subtraction is a hardcoded list — it did not follow the bundle it was given");
    });
  });
});

test("DRIVEN: a bucket that will not take the write is said, never thrown", () => {
  const fnOut = (head, close) => {
    const at = WORKER.indexOf(head);
    const end = WORKER.indexOf(close, at);
    return WORKER.slice(at, end + close.length);
  };
  const at = WORKER.indexOf("const KIT_KEY = ");
  const scope = new Function("FOUNDATION_FILES", "console", [
    "let FOUNDATION_PATH_SET = null;",
    WORKER.slice(at, WORKER.indexOf("\n", at)),
    fnOut("function foundationPaths() {", "\n}"),
    fnOut("async function saveSiteKit(env, slug, kit) {", "\n}"),
    "return { saveSiteKit };",
  ].join("\n"))([], { error: () => {} });
  // A PUBLISH IS LIVE BY THE TIME THIS RUNS. A store that throws here would take
  // down a site that is already serving, for the sake of a file listing.
  return scope.saveSiteKit({ SITES_BUCKET: { put: async () => { throw new Error("r2 down"); } } }, "s", [{ path: "src/a.tsx", source: "a" }])
    .then((ok) => assert.equal(ok, false, "a failed store did not report itself"));
});
