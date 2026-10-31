// THE CODE TAB MIRRORS THE SITE'S FOLDER (2026-10-31,
// `docs/plans/2026-10-31-code-mirror.md`). The owner: the Code tab and the
// site's files in storage are one set, "no one side having more than another".
// New sites only. What these guards hold, one block per step of the plan:
//
//   1. the container's snapshot is the project as it compiled (template files,
//      the site's kit closure, pages, parts, the stylesheet as a file, the
//      generated files), never node_modules, dist or the unused kit; the
//      Worker stores only what changed, the list last, and a failure writes no
//      list;
//   2. `/api/site/source` answers from the list when there is one, and an old
//      site's answer is unchanged;
//   3. the Code tab and the Download render that list as it is;
//   4. the compile lays the stored files over the template and puts the
//      image's own back afterwards;
//   5. the site agent reads the folder's other files, read only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  PROJECT_LIST_KEY, PROJECT_FILE_KEY, safeProjectPath, projectFileKind, overlayable, collectProject,
  applyOverlay, restoreOverlay, readProjectList, saveProject, readProjectFiles, overlayEntries, mirrorWanted,
} from "../builder/project-files.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { runSiteAgent } from "../builder/site-agent.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const SiteZip = (await import("../public/site-zip.js")).default || (await import("../public/site-zip.js"));

/** Whole-line comments blanked, length kept, so prose never satisfies a scan. */
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");

/** A fake app directory shaped like the container's `/app` after a compile. */
function fakeApp() {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), "gf-mirror-"));
  const put = (rel, body) => { const f = path.join(app, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
  put("package.json", "{}\n");
  put("vite.config.ts", "export default {}\n");
  put("build-server.mjs", "// the service, not the project\n");
  put("site-agent.mjs", "// a module beside it\n");
  put(".routes-base/__root.tsx", "base\n");
  put(".styles-base.css", "base css\n");
  put("node_modules/react/index.js", "x");
  put("dist/client/app.js", "x");
  // A COMPILED OUTPUT OR A PACKAGE FOLDER INSIDE A WALKED DIRECTORY is never the project either.
  put("public/dist/stale.js", "x");
  put("src/node_modules/pkg/index.js", "x");
  put("src/router.tsx", "router\n");
  put("src/lib/rows.ts", "rows\n");
  put("src/styles.css", "body{}\n");
  put("src/site-brand.ts", "brand\n");
  put("src/routes/__root.tsx", "root\n");
  put("src/routes/index.tsx", "home\n");
  put("src/routes/-parts/hero.tsx", "hero\n");
  put("src/components/ui/button.tsx", "button\n");
  put("src/components/ui/unused.tsx", "unused\n");
  put("src/components/charts/area.tsx", "area\n");
  put("public/favicon.svg", "<svg/>");
  put("public/fonts/inter.woff2", Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 1, 2, 255]));
  return app;
}

// ── STEP 1: THE SNAPSHOT AND ITS STORE ──────────────────────────────────────

test("CM1 the snapshot is the project: template files, the kit closure, pages, parts, styles and generated files; nothing else", () => {
  const app = fakeApp();
  try {
    const r = collectProject({ app, fs, path, hash: sha, kitPaths: ["src/components/ui/button.tsx", "src/lib/utils.ts"] });
    assert.equal(r.ok, true);
    assert.deepEqual(r.files.map((f) => f.path), [
      "package.json", "public/favicon.svg", "public/fonts/inter.woff2", "src/components/ui/button.tsx", "src/lib/rows.ts",
      "src/router.tsx", "src/routes/-parts/hero.tsx", "src/routes/__root.tsx", "src/routes/index.tsx", "src/site-brand.ts",
      "src/styles.css", "vite.config.ts",
    ], "the project's set");
    for (const f of r.files) {
      const bytes = fs.readFileSync(path.join(app, f.path));
      assert.equal(f.size, bytes.length, f.path);
      assert.equal(f.sha256, sha(bytes), f.path);
      assert.deepEqual(Buffer.from(f.base64, "base64"), bytes, f.path + " bytes");
    }
    // THE IMAGE FLAG: on starter and kit files only, true when nothing replaced them.
    const by = Object.fromEntries(r.files.map((f) => [f.path, f]));
    assert.equal(by["src/router.tsx"].image, true);
    assert.equal(by["src/components/ui/button.tsx"].image, true);
    for (const p of ["src/routes/index.tsx", "src/styles.css", "src/site-brand.ts", "public/fonts/inter.woff2"]) assert.equal(by[p].image, undefined, p);
    // A REPLACED FILE says it is not the image's copy.
    const replaced = collectProject({ app, fs, path, hash: sha, kitPaths: [], pristine: new Map([["src/router.tsx", Buffer.from("the image's router\n")]]) });
    assert.equal(replaced.files.find((f) => f.path === "src/router.tsx").image, false);
  } finally { fs.rmSync(app, { recursive: true, force: true }); }
});

test("CM2 the snapshot refuses past its caps rather than storing a partial project", () => {
  const app = fakeApp();
  try {
    fs.writeFileSync(path.join(app, "src", "big.txt"), Buffer.alloc(4_000_001));
    const r = collectProject({ app, fs, path, hash: sha });
    assert.equal(r.ok, false);
    assert.match(r.why, /over 4000000 bytes/);
  } finally { fs.rmSync(app, { recursive: true, force: true }); }
});

test("CM3 paths: only the project's own, never above it", () => {
  for (const ok of ["src/routes/index.tsx", "public/fonts/a.woff2", "package.json", "src/routes/blog.$slug.tsx"]) assert.equal(safeProjectPath(ok), ok);
  for (const bad of ["", "/etc/passwd", "src/../worker.js", "src//a.ts", "src\\a.ts", "build-server.mjs", "node_modules/x.js", "src/./a", "a\u0000b", 7, null]) {
    assert.equal(safeProjectPath(bad), "", JSON.stringify(bad));
  }
  assert.equal(projectFileKind("src/routes/-parts/hero.tsx"), "part");
  assert.equal(projectFileKind("src/routes/index.tsx"), "page");
  assert.equal(projectFileKind("src/styles.css"), "styles");
  assert.equal(projectFileKind("src/routeTree.gen.ts"), "generated");
  assert.equal(projectFileKind("public/qr-menu.svg"), "generated");
  assert.equal(projectFileKind("src/components/ui/button.tsx"), "kit");
  assert.equal(projectFileKind("src/lib/rows.ts"), "starter");
});

/** An in-memory bucket that records what it was asked. */
function memBucket({ failPut = null } = {}) {
  const store = new Map();
  const log = [];
  return {
    store, log,
    async get(key) {
      log.push(["get", key]);
      if (!store.has(key)) return null;
      const v = store.get(key);
      return { text: async () => new TextDecoder().decode(v), arrayBuffer: async () => v.slice().buffer };
    },
    async put(key, body) {
      log.push(["put", key]);
      if (failPut && failPut(key)) throw new Error("r2 down");
      store.set(key, typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body));
    },
    async delete(key) { log.push(["delete", key]); store.delete(key); },
  };
}
const snapOf = (files) => ({ ok: true, files: Object.entries(files).map(([p, s]) => { const b = Buffer.from(s); return { path: p, size: b.length, sha256: sha(b), base64: b.toString("base64"), ...(overlayable(p) ? { image: true } : {}) }; }) });

test("CM4 the store uploads only what changed, writes the list last, and deletes what the list no longer names", async () => {
  const b = memBucket();
  const first = await saveProject(b, "new-site", snapOf({ "src/router.tsx": "r1", "src/routes/index.tsx": "home", "src/routes/old.tsx": "old" }));
  assert.deepEqual(first, { ok: true, files: 3, uploaded: 3, removed: 0 });
  assert.deepEqual(b.log.filter((l) => l[0] === "put").at(-1), ["put", PROJECT_LIST_KEY("new-site")], "the list is written last");
  b.log.length = 0;
  const second = await saveProject(b, "new-site", snapOf({ "src/router.tsx": "r1", "src/routes/index.tsx": "home v2" }));
  assert.deepEqual(second, { ok: true, files: 2, uploaded: 1, removed: 1 });
  assert.deepEqual(b.log.filter((l) => l[0] === "put").map((l) => l[1]), [PROJECT_FILE_KEY("new-site", "src/routes/index.tsx"), PROJECT_LIST_KEY("new-site")], "only the changed file went up");
  assert.ok(!b.store.has(PROJECT_FILE_KEY("new-site", "src/routes/old.tsx")), "the removed page's file is gone");
  const list = await readProjectList(b, "new-site");
  assert.equal(list.state, "read");
  assert.deepEqual(list.files.map((f) => f.path), ["src/router.tsx", "src/routes/index.tsx"]);
  // THE FOLDER IS THE LIST, EXACTLY: every key under it is named, every name has a key.
  const keys = [...b.store.keys()].filter((k) => k.startsWith("source/new-site/files/")).map((k) => k.slice("source/new-site/files/".length)).sort();
  assert.deepEqual(keys, list.files.map((f) => f.path).sort());
  const got = await readProjectFiles(b, "new-site", list.files);
  assert.deepEqual(got.map((f) => f.source), ["r1", "home v2"]);
});

test("CM5 a failed save writes no list: a failed upload, a malformed snapshot, a failed compile", async () => {
  const b = memBucket({ failPut: (k) => k.endsWith("index.tsx") });
  const r = await saveProject(b, "s", snapOf({ "src/router.tsx": "r", "src/routes/index.tsx": "h" }));
  assert.equal(r.ok, false);
  assert.ok(!b.store.has(PROJECT_LIST_KEY("s")), "a list was written over a project that did not store");
  const c = memBucket();
  assert.equal((await saveProject(c, "s", { ok: false, why: "too big" })).ok, false);
  assert.equal((await saveProject(c, "s", { ok: true, files: [{ path: "../x", size: 1, sha256: "0".repeat(64), base64: "eA==" }] })).ok, false);
  assert.equal((await saveProject(c, "s", null)).ok, false);
  assert.equal(c.store.size, 0, "a refused snapshot stored something");
});

test("CM6 the list's three states, and who mirrors: a first build starts it, a site with one keeps it, an old site is left alone", async () => {
  assert.equal((await readProjectList(memBucket(), "s")).state, "absent");
  const bad = memBucket(); bad.store.set(PROJECT_LIST_KEY("s"), new TextEncoder().encode("{nope"));
  assert.equal((await readProjectList(bad, "s")).state, "unreadable");
  assert.equal(mirrorWanted("read"), true);
  assert.equal(mirrorWanted("absent", { firstBuild: true }), true);
  assert.equal(mirrorWanted("absent"), false, "an old site would have started a folder");
  assert.equal(mirrorWanted("unreadable", { firstBuild: true }), false, "cannot-tell started a folder");
});

test("CM7 DRIVEN through the Worker: a first build mirrors, an old site does not, and a mirrored save stores the snapshot", async () => {
  const { codeMirrorApi } = await loadWorkerModule();
  const fresh = memBucket();
  assert.equal((await codeMirrorApi.projectMirror({ SITES_BUCKET: fresh }, "brand-new", { firstBuild: true })).on, true);
  const old = memBucket(); old.store.set("source/old-site/pages.json", new TextEncoder().encode(JSON.stringify([{ path: "index.tsx", source: "x" }])));
  assert.equal((await codeMirrorApi.projectMirror({ SITES_BUCKET: old }, "old-site", { firstBuild: true })).on, false, "a revise of an old site started a folder");
  assert.equal((await codeMirrorApi.projectMirror({ SITES_BUCKET: old }, "old-site")).on, false, "an edit of an old site started a folder");
  const m = await codeMirrorApi.projectMirror({ SITES_BUCKET: fresh }, "brand-new", { firstBuild: true });
  const saved = await codeMirrorApi.storeProjectFolder({ SITES_BUCKET: fresh }, "brand-new", m, { project: snapOf({ "src/router.tsx": "r" }) });
  assert.equal(saved.ok, true);
  assert.equal((await codeMirrorApi.projectMirror({ SITES_BUCKET: fresh }, "brand-new")).on, true, "an edit of a mirrored site stopped mirroring");
  assert.equal(await codeMirrorApi.storeProjectFolder({ SITES_BUCKET: old }, "old-site", { on: false, overlay: [] }, { project: snapOf({ "a.ts": "x" }) }), null);
  assert.equal(old.log.filter((l) => l[0] === "put").length, 0, "an old site was written to");
});

test("CM8 the wiring: the container sends a snapshot only when asked and only after a compile; the Worker asks, stores it after the editable copy, and never on a failed save", () => {
  const SERVER = bare(read("../builder/build-server.mjs"));
  const okAt = SERVER.indexOf("return send(res, 200, { ok: true, files: dist,");
  const snapAt = SERVER.indexOf("collectProject({");
  const viteFail = SERVER.indexOf('stage: "build", error: exitReason("vite build"');
  assert.ok(okAt > 0 && snapAt > 0 && viteFail > 0, "a landmark is gone");
  assert.ok(viteFail < snapAt && snapAt < okAt, "the snapshot is not taken between a passed compile and the answer");
  assert.match(SERVER.slice(snapAt - 400, snapAt), /if \(payload\.project === true\)/, "the snapshot is not gated on the Worker's ask");
  assert.match(SERVER.slice(okAt, okAt + 600), /\.\.\.projectOut \}\);/, "the answer does not carry the snapshot");
  const W = bare(read("../worker.js"));
  // BOTH COMPILE PAYLOADS ASK AND SEND THE OVERLAY.
  for (const [name, v] of [["cPayload", "mirror"], ["bPayload", "bMirror"]]) {
    const at = W.indexOf("const " + name + " = JSON.stringify({");
    assert.ok(at > 0, name + " is gone");
    const body = W.slice(at, W.indexOf("});", at));
    assert.ok(body.includes("project: " + v + ".on || undefined"), name + " does not ask for the snapshot");
    assert.ok(body.includes("projectFiles: " + v + ".overlay.length ? " + v + ".overlay : undefined"), name + " does not send the overlay");
  }
  // THE EDIT PATH STORES IT ONLY WHEN THE EDITABLE COPY STORED, INSIDE afterActivate.
  const ea = W.indexOf("const pr = await storeProjectFolder(env, slug, mirror, built);");
  assert.ok(ea > 0);
  assert.match(W.slice(ea - 200, ea), /if \(!unsaved\.length\) \{\s*$/, "the edit path stores the folder over a failed save");
  // THE BUILD PATH STORES IT AFTER THE MARKER, which a failed save returns before.
  const ba = W.indexOf("await storeProjectFolder(env, slug, bMirror, { project: projectBuilt });");
  const ret = W.lastIndexOf("if (!editableStored) {", ba);
  const head = W.lastIndexOf("await writeHead(buildDeps(env), slug, bVersion);", ba);
  assert.ok(ba > 0 && ret > 0 && ret < head && head < ba, "the build path stores the folder before the copy is known stored");
});

// ── STEP 2: THE ROUTE ANSWERS FROM THE LIST ─────────────────────────────────

let caseNo = 0;
async function callSource(bucket, slug) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json({ id: "u-owner" });
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: "u-owner" }]);
    return new Response("unavailable", { status: 503 });
  };
  try {
    const req = new Request("https://gofarther.dev/api/site/source?slug=" + slug, { headers: { Authorization: "Bearer t" } });
    const res = await worker.fetch(req, { SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET: bucket }, makeCtx());
    return { status: res.status, body: await res.json() };
  } finally { globalThis.fetch = real; }
}

test("CM9 DRIVEN: a site with a list gets exactly its folder: no bundled starter files, no kit list, no assets", async () => {
  const slug = "gf-mirror-" + (++caseNo);
  const b = memBucket();
  const font = Buffer.from([0x77, 0x4f, 0x46, 0x32, 9, 255]);
  await saveProject(b, slug, { ok: true, files: [
    ...snapOf({ "package.json": "{}", "src/router.tsx": "router", "src/routes/index.tsx": "home", "src/styles.css": "body{}" }).files,
    { path: "public/fonts/a.woff2", size: font.length, sha256: sha(font), base64: font.toString("base64") },
  ] });
  b.log.length = 0;
  const r = await callSource(b, slug);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.project.map((f) => f.path), ["package.json", "src/router.tsx", "src/routes/index.tsx", "src/styles.css", "public/fonts/a.woff2"]);
  assert.equal(r.body.project.find((f) => f.path === "src/routes/index.tsx").source, "home");
  assert.equal(r.body.project.find((f) => f.path === "public/fonts/a.woff2").base64, font.toString("base64"), "a binary file is not carried as its bytes");
  for (const k of ["shared", "kit", "assets"]) assert.equal(r.body[k], undefined, k + " was assembled beside the folder");
  assert.equal(r.body.reads.project, true);
  const reads = b.log.filter((l) => l[0] === "get").map((l) => l[1]);
  assert.ok(!reads.some((k) => k.startsWith("config/") || k.endsWith("/kit.json")), "the config or the kit list was read: " + reads.join(", "));
});

test("CM10 DRIVEN: an old site (no list) gets today's answer unchanged", async () => {
  const slug = "gf-mirror-" + (++caseNo);
  const b = memBucket();
  b.store.set("source/" + slug + "/pages.json", new TextEncoder().encode(JSON.stringify([{ path: "index.tsx", source: "P" }])));
  const r = await callSource(b, slug);
  assert.equal(r.body.project, undefined);
  assert.ok(Array.isArray(r.body.shared) && r.body.shared.length > 0, "the old answer lost its shared files");
  assert.deepEqual(r.body.pages, [{ path: "index.tsx", source: "P" }]);
  assert.equal(r.body.reads.project, undefined, "an absent list was said as unreadable");
});

// ── STEP 3: THE TAB AND THE DOWNLOAD RENDER THE LIST AS IT IS ───────────────

const CHAT = bare(read("../public/chat.js"));
function fn(head) {
  const at = CHAT.indexOf(head);
  assert.ok(at > 0, head + " is gone");
  return CHAT.slice(at, CHAT.indexOf("\n}", at) + 2);
}
const stSrcFiles = new Function(fn("function stSrcFiles(") + "\n" + fn("function stSrcPath(") + "\nreturn stSrcFiles;")();

test("CM11 the tab's list is the folder's list, file for file, with nothing added", () => {
  const project = [
    { path: "package.json", size: 2, sha256: "a".repeat(64), source: "{}" },
    { path: "src/routes/index.tsx", size: 4, sha256: "b".repeat(64), source: "home" },
    { path: "public/fonts/a.woff2", size: 3, sha256: "c".repeat(64), base64: "AAEC" },
    { path: "src/lib/rows.ts", size: 9, sha256: "d".repeat(64), missing: true },
  ];
  const out = stSrcFiles({ project, pages: [{ path: "index.tsx", source: "home" }], shared: [{ path: "src/router.tsx", source: "x" }], kit: [{ path: "src/components/ui/a.tsx", source: "y" }] });
  assert.deepEqual(out.map((f) => f.name), project.map((f) => f.path), "the tab shows more or fewer files than the folder");
  assert.equal(out[1].text, "home");
  assert.equal(out[2].base64, "AAEC");
  assert.match(out[3].note, /could not be read/);
  // AN OLD ANSWER STILL ASSEMBLES AS BEFORE.
  assert.ok(stSrcFiles({ pages: [{ path: "index.tsx", source: "P" }], shared: [{ path: "src/router.tsx", source: "x" }] }).some((f) => f.kind === "shared"));
});

test("CM12 DRIVEN: the Download zips the folder's files, a binary one byte for byte, and never an unreadable one as empty", () => {
  const font = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 200, 255]);
  const files = stSrcFiles({ project: [
    { path: "src/routes/index.tsx", size: 4, sha256: "b".repeat(64), source: "home é" },
    { path: "public/fonts/a.woff2", size: font.length, sha256: sha(font), base64: font.toString("base64") },
    { path: "src/lib/rows.ts", size: 9, sha256: "d".repeat(64), missing: true },
  ] });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gf-mirror-zip-"));
  try {
    const zip = path.join(dir, "t.zip");
    fs.writeFileSync(zip, Buffer.from(SiteZip.zipFiles(files)));
    const out = execFileSync("python3", ["-c", "import json,sys,zipfile,base64\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint(json.dumps({n: base64.b64encode(z.read(n)).decode() for n in z.namelist()}))", zip], { encoding: "utf8" });
    const back = JSON.parse(out);
    assert.deepEqual(Object.keys(back), ["src/routes/index.tsx", "public/fonts/a.woff2"]);
    assert.equal(Buffer.from(back["src/routes/index.tsx"], "base64").toString("utf8"), "home é");
    assert.deepEqual(Buffer.from(back["public/fonts/a.woff2"], "base64"), font);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── STEP 4: THE COMPILE STARTS FROM THE FOLDER ──────────────────────────────

test("CM13 the overlay lays stored starter and kit files over the template and puts the image's own back", () => {
  const app = fakeApp();
  try {
    const b64 = (s) => Buffer.from(s).toString("base64");
    const o = applyOverlay({ app, fs, path, files: [
      { path: "src/router.tsx", base64: b64("stored router\n") },
      { path: "src/components/ui/new.tsx", base64: b64("stored kit\n") },
      { path: "src/routes/index.tsx", base64: b64("a stale page") },
      { path: "src/styles.css", base64: b64("stale css") },
      { path: "src/site-brand.ts", base64: b64("stale brand") },
      { path: "../escape.txt", base64: b64("x") },
    ] });
    assert.equal(fs.readFileSync(path.join(app, "src/router.tsx"), "utf8"), "stored router\n");
    assert.equal(fs.readFileSync(path.join(app, "src/components/ui/new.tsx"), "utf8"), "stored kit\n");
    assert.equal(fs.readFileSync(path.join(app, "src/routes/index.tsx"), "utf8"), "home\n", "a page was laid over the build's own");
    assert.equal(fs.readFileSync(path.join(app, "src/styles.css"), "utf8"), "body{}\n", "the stylesheet was laid over the build's own");
    assert.equal(fs.readFileSync(path.join(app, "src/site-brand.ts"), "utf8"), "brand\n", "a generated file was laid over");
    assert.ok(!fs.existsSync(path.join(path.dirname(app), "escape.txt")), "the overlay wrote above the app");
    assert.deepEqual(o.refused.sort(), ["../escape.txt", "src/routes/index.tsx", "src/site-brand.ts", "src/styles.css"]);
    // THE SNAPSHOT TAKEN NOW SAYS THE ROUTER IS NOT THE IMAGE'S COPY.
    const snap = collectProject({ app, fs, path, hash: sha, kitPaths: ["src/components/ui/new.tsx"], pristine: o.pristine });
    assert.equal(snap.files.find((f) => f.path === "src/router.tsx").image, false);
    assert.equal(snap.files.find((f) => f.path === "src/components/ui/new.tsx").image, false, "a file the image lacks read as the image's");
    restoreOverlay({ app, fs, path, pristine: o.pristine });
    assert.equal(fs.readFileSync(path.join(app, "src/router.tsx"), "utf8"), "router\n", "the image's own file was not put back");
    assert.ok(!fs.existsSync(path.join(app, "src/components/ui/new.tsx")), "a file the image never had was left for the next site");
  } finally { fs.rmSync(app, { recursive: true, force: true }); }
});

test("CM14 what the next compile is sent: stored starter and kit files that are not the image's copy, and only those", async () => {
  const files = [
    { path: "src/router.tsx", image: true }, { path: "src/lib/rows.ts", image: false },
    { path: "src/components/ui/a.tsx", image: false }, { path: "src/routes/index.tsx" }, { path: "src/styles.css" },
  ];
  assert.deepEqual(overlayEntries(files).map((f) => f.path), ["src/lib/rows.ts", "src/components/ui/a.tsx"]);
  const { codeMirrorApi } = await loadWorkerModule();
  const b = memBucket();
  const lib = Buffer.from("changed rows");
  await saveProject(b, "ov", { ok: true, files: [
    ...snapOf({ "src/router.tsx": "router" }).files,
    { path: "src/lib/rows.ts", size: lib.length, sha256: sha(lib), base64: lib.toString("base64"), image: false },
  ] });
  b.log.length = 0;
  const m = await codeMirrorApi.projectMirror({ SITES_BUCKET: b }, "ov");
  assert.deepEqual(m.overlay, [{ path: "src/lib/rows.ts", base64: lib.toString("base64") }]);
  assert.ok(!b.log.some((l) => l[1] === PROJECT_FILE_KEY("ov", "src/router.tsx")), "an image-identical file was read for the overlay");
  // THE CONTAINER APPLIES IT AFTER THE RESET AND PUTS IT BACK IN `finally`.
  const SERVER = bare(read("../builder/build-server.mjs"));
  const m2 = /\n      resetRoutes\(\);\s*overlay = applyOverlay\(\{ app: APP, fs, path, files: payload\.projectFiles \}\);/.exec(SERVER);
  assert.ok(m2, "the overlay is not applied right after the reset");
  const reset = m2.index;
  assert.ok(SERVER.indexOf("    } finally {\n      if (overlay) restoreOverlay(", reset) > reset, "the overlay is never put back");
});

// ── STEP 5: THE AGENT READS THE FOLDER ──────────────────────────────────────

const use = (name, input) => ({ type: "tool_use", name, input, id: "t" + Math.random().toString(36).slice(2) });
const answer = (...uses) => ({ content: uses, usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "tool_use" });

test("CM15 the agent reads a project file by its path, read only; without a folder it is no such file", async () => {
  const run = async (deps) => {
    const sent = [];
    const rounds = [answer(use("read_files", { files: ["src/lib/rows.ts", "index.tsx"] })), answer(use("write_file", { file: "src/lib/rows.ts", source: "hacked" })), answer(use("finish", { summary: "s" }))];
    let i = 0;
    const r = await runSiteAgent({ send: async (req) => { sent.push(JSON.parse(JSON.stringify(req))); return rounds[Math.min(i++, rounds.length - 1)]; }, build: async () => ({ ok: true }), ...deps },
      { request: "r", pages: [{ path: "index.tsx", source: "HOME" }], maxRounds: 3 });
    const results = sent.at(-1).messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((x) => x.type === "tool_result");
    return { r, results };
  };
  const b = memBucket();
  await saveProject(b, "ag", snapOf({ "src/lib/rows.ts": "export const rows = 1;", "src/routes/index.tsx": "HOME" }));
  const { codeMirrorApi } = await loadWorkerModule();
  const withFolder = await run({ projectFile: codeMirrorApi.projectFileReader({ SITES_BUCKET: b }, "ag") });
  assert.match(withFolder.results[0].content, /export const rows = 1;/, "the project file was not read");
  assert.match(withFolder.results[0].content, /HOME/);
  assert.doesNotMatch(withFolder.results[0].content, /No such file/);
  assert.equal(withFolder.results[1].is_error, true, "a project file was writable");
  assert.ok(!withFolder.r.changed.includes("src/lib/rows.ts"));
  const without = await run({ projectFile: codeMirrorApi.projectFileReader({ SITES_BUCKET: memBucket() }, "none") });
  assert.match(without.results[0].content, /No such file: src\/lib\/rows\.ts/);
  // A BINARY FILE OF THE FOLDER IS NOT TEXT FOR THE AGENT, and is not even fetched.
  const fb = memBucket();
  const font = Buffer.from([0x77, 0x4f, 0x46, 0x32]);
  await saveProject(fb, "fb", { ok: true, files: [{ path: "public/fonts/a.woff2", size: 4, sha256: sha(font), base64: font.toString("base64") }] });
  fb.log.length = 0;
  assert.equal(await codeMirrorApi.projectFileReader({ SITES_BUCKET: fb }, "fb")("public/fonts/a.woff2"), null);
  assert.deepEqual(fb.log.map((l) => l[1]), [PROJECT_LIST_KEY("fb")], "a binary file was fetched for the agent");
});
