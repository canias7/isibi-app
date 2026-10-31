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
  PROJECT_LIST_KEY, PROJECT_BLOB_KEY, safeProjectPath, projectFileKind, overlayable, collectProject,
  applyOverlay, restoreOverlay, readProjectList, saveProject, readProjectFiles, overlayEntries, mirrorWanted, restoreStarterEntry,
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
    // THE STARTER VERSION (fix 4): on starter and kit files only, the image's hash.
    assert.equal(by["src/router.tsx"].starter, by["src/router.tsx"].sha256);
    assert.equal(by["src/components/ui/button.tsx"].starter, by["src/components/ui/button.tsx"].sha256);
    assert.equal(by["src/router.tsx"].starterBase64, undefined, "an unchanged starter file carried its starter bytes twice");
    for (const p of ["src/routes/index.tsx", "src/styles.css", "src/site-brand.ts", "public/fonts/inter.woff2"]) assert.equal(by[p].starter, undefined, p);
    // A REPLACED FILE records the image's hash and carries the image's bytes.
    const img = Buffer.from("the image's router\n");
    const replaced = collectProject({ app, fs, path, hash: sha, kitPaths: [], pristine: new Map([["src/router.tsx", img]]) });
    const r2 = replaced.files.find((f) => f.path === "src/router.tsx");
    assert.equal(r2.starter, sha(img));
    assert.deepEqual(Buffer.from(r2.starterBase64, "base64"), img);
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

/** An in-memory bucket that records what it was asked, with etags, `onlyIf` and custom metadata as R2 keeps them. */
function memBucket({ failPut = null } = {}) {
  const store = new Map();
  const meta = new Map();
  const log = [];
  let n = 0;
  const etagOf = (key) => { if (!meta.has(key)) meta.set(key, { etag: "e" + (++n), custom: {} }); return meta.get(key); };
  const obj = (key) => {
    const v = store.get(key);
    const m = etagOf(key);
    return { etag: m.etag, customMetadata: m.custom, text: async () => new TextDecoder().decode(v), arrayBuffer: async () => v.slice().buffer };
  };
  return {
    store, log, meta,
    async head(key) { log.push(["head", key]); return store.has(key) ? obj(key) : null; },
    async get(key) {
      log.push(["get", key]);
      return store.has(key) ? obj(key) : null;
    },
    async put(key, body, opts = {}) {
      log.push(["put", key]);
      if (failPut && failPut(key)) throw new Error("r2 down");
      const c = opts.onlyIf;
      if (c) {
        const cur = store.has(key) ? etagOf(key).etag : null;
        if (c.etagMatches != null && cur !== c.etagMatches) return null;
        if (c.etagDoesNotMatch === "*" && cur) return null;
      }
      store.set(key, typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body));
      meta.set(key, { etag: "e" + (++n), custom: { ...((opts && opts.customMetadata) || {}) } });
      return { etag: meta.get(key).etag };
    },
    async delete(key) { log.push(["delete", key]); store.delete(key); meta.delete(key); },
  };
}
const snapOf = (files) => ({ ok: true, files: Object.entries(files).map(([p, s]) => { const b = Buffer.from(s); return { path: p, size: b.length, sha256: sha(b), base64: b.toString("base64"), ...(overlayable(p) ? { starter: sha(b), starterSize: b.length } : {}) }; }) });
/** The keys under the site's blob folder, as hashes. */
const blobKeys = (b, slug) => [...b.store.keys()].filter((k) => k.startsWith("source/" + slug + "/blobs/")).map((k) => k.split("/").pop()).sort();

test("CM4 the store uploads only what changed, writes the list last, and deletes what the list no longer names", async () => {
  const b = memBucket();
  const first = await saveProject(b, "new-site", snapOf({ "src/router.tsx": "r1", "src/routes/index.tsx": "home", "src/routes/old.tsx": "old" }));
  assert.deepEqual(first, { ok: true, files: 3, uploaded: 3, removed: 0 });
  assert.deepEqual(b.log.filter((l) => l[0] === "put").at(-1), ["put", PROJECT_LIST_KEY("new-site")], "the list is written last");
  b.log.length = 0;
  const second = await saveProject(b, "new-site", snapOf({ "src/router.tsx": "r1", "src/routes/index.tsx": "home v2" }));
  // The old index bytes and /old's bytes are RETIRED, never deleted by the save that unreferenced them (fix A).
  assert.deepEqual(second, { ok: true, files: 2, uploaded: 1, removed: 0 });
  assert.deepEqual(b.log.filter((l) => l[0] === "put").map((l) => l[1]), [PROJECT_BLOB_KEY("new-site", sha(Buffer.from("home v2"))), PROJECT_LIST_KEY("new-site")], "only the changed file went up");
  assert.ok(b.store.has(PROJECT_BLOB_KEY("new-site", sha(Buffer.from("old")))), "the save that unreferenced the bytes deleted them");
  const list = await readProjectList(b, "new-site");
  assert.equal(list.state, "read");
  assert.deepEqual(list.files.map((f) => f.path), ["src/router.tsx", "src/routes/index.tsx"]);
  // THE FOLDER IS THE LIST, EXACTLY: every key under it is named, every name has a key.
  assert.deepEqual(blobKeys(b, "new-site"), [...new Set([...list.files.flatMap((f) => [f.sha256, f.starter].filter(Boolean)), ...Object.keys(list.retired)])].sort());
  assert.deepEqual(Object.keys(list.retired).sort(), [sha(Buffer.from("home")), sha(Buffer.from("old"))].sort());
  const got = await readProjectFiles(b, "new-site", list.files);
  assert.deepEqual(got.map((f) => f.source), ["r1", "home v2"]);
});

test("CM5 a failed save writes no list: a failed upload, a malformed snapshot, a failed compile", async () => {
  const b = memBucket({ failPut: (k) => k.endsWith(sha(Buffer.from("h"))) });
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
  const ea = W.indexOf("const pr = await storeProjectFolder(env, slug, mirror, built, fence);");
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
  assert.deepEqual(r.body.project.map((f) => f.path), ["package.json", "public/fonts/a.woff2", "src/router.tsx", "src/routes/index.tsx", "src/styles.css"]);
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
    const rr = snap.files.find((f) => f.path === "src/router.tsx");
    assert.equal(rr.starter, sha(Buffer.from("router\n")));
    assert.notEqual(rr.sha256, rr.starter);
    assert.equal(snap.files.find((f) => f.path === "src/components/ui/new.tsx").starter, undefined, "a file the image lacks was given a starter version");
    restoreOverlay({ app, fs, path, pristine: o.pristine });
    assert.equal(fs.readFileSync(path.join(app, "src/router.tsx"), "utf8"), "router\n", "the image's own file was not put back");
    assert.ok(!fs.existsSync(path.join(app, "src/components/ui/new.tsx")), "a file the image never had was left for the next site");
  } finally { fs.rmSync(app, { recursive: true, force: true }); }
});

test("CM14 what the next compile is sent: stored starter and kit files that are not the image's copy, and only those", async () => {
  const files = [
    { path: "src/router.tsx", sha256: "a", starter: "a" }, { path: "src/lib/rows.ts", sha256: "b", starter: "a" },
    { path: "src/components/ui/a.tsx", sha256: "c" }, { path: "src/routes/index.tsx", sha256: "d" }, { path: "src/styles.css", sha256: "e" },
  ];
  assert.deepEqual(overlayEntries(files).map((f) => f.path), ["src/lib/rows.ts", "src/components/ui/a.tsx"]);
  const { codeMirrorApi } = await loadWorkerModule();
  const b = memBucket();
  const lib = Buffer.from("changed rows");
  await saveProject(b, "ov", { ok: true, files: [
    ...snapOf({ "src/router.tsx": "router" }).files,
    { path: "src/lib/rows.ts", size: lib.length, sha256: sha(lib), base64: lib.toString("base64"), starter: sha(Buffer.from("rows")), starterSize: 4, starterBase64: Buffer.from("rows").toString("base64") },
  ] });
  b.log.length = 0;
  const m = await codeMirrorApi.projectMirror({ SITES_BUCKET: b }, "ov");
  assert.deepEqual(m.overlay, [{ path: "src/lib/rows.ts", base64: lib.toString("base64") }]);
  assert.ok(!b.log.some((l) => l[1] === PROJECT_BLOB_KEY("ov", sha(Buffer.from("router")))), "a file the site never changed was read for the overlay");
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

// ── FIX 1 (2026-10-31, the owner): THE FOLDER'S WRITES ARE FENCED AND THE LIST IS MERGED ──

test("CM16 DRIVEN: a save whose turn was taken writes nothing under the folder, and never the list", async () => {
  const { codeMirrorApi } = await loadWorkerModule();
  const b = memBucket();
  const env = { SITES_BUCKET: b };
  await saveProject(b, "fz", snapOf({ "src/router.tsx": "r", "src/routes/index.tsx": "home" }));
  const m = await codeMirrorApi.projectMirror(env, "fz");
  // A NEWER HOLDER (fence 7) HAS WRITTEN THE EDITABLE COPY since this save (fence 3) began.
  await b.put("source/fz/pages.json", "[]", { customMetadata: { fence: "7" } });
  const listBefore = Buffer.from(b.store.get(PROJECT_LIST_KEY("fz"))).toString();
  b.log.length = 0;
  const r = await codeMirrorApi.storeProjectFolder(env, "fz", m, { project: snapOf({ "src/router.tsx": "r", "src/routes/index.tsx": "STALE", "src/routes/new.tsx": "n" }) }, { gen: 3, lost: false });
  assert.equal(r.ok, false, "a stale save stored its folder");
  assert.deepEqual(b.log.filter((l) => l[0] === "put" || l[0] === "delete"), [], "a stale save wrote under the folder");
  assert.equal(Buffer.from(b.store.get(PROJECT_LIST_KEY("fz"))).toString(), listBefore, "the newer list was overwritten");
  // A FENCE ALREADY LOST is refused before anything is read or written.
  b.log.length = 0;
  const lost = await codeMirrorApi.storeProjectFolder(env, "fz", m, { project: snapOf({ "src/routes/index.tsx": "x" }) }, { gen: 9, lost: true });
  assert.equal(lost.ok, false);
  assert.deepEqual(b.log.filter((l) => l[0] === "put" || l[0] === "delete"), []);
  // THE HOLDER ITSELF (fence 7) WRITES, and its list carries its fence.
  const own = await codeMirrorApi.storeProjectFolder(env, "fz", m, { project: snapOf({ "src/router.tsx": "r", "src/routes/index.tsx": "v2" }) }, { gen: 7, lost: false });
  assert.equal(own.ok, true, own.why);
  assert.equal(b.meta.get(PROJECT_LIST_KEY("fz")).custom.fence, "7", "the list was not written under the fence");
});

test("CM17 DRIVEN: two parts saved side by side from the same list, each adding a different file, both end up listed", async () => {
  const { codeMirrorApi } = await loadWorkerModule();
  const b = memBucket();
  const env = { SITES_BUCKET: b };
  await saveProject(b, "par", snapOf({ "src/router.tsx": "r", "src/routes/index.tsx": "home", "src/routes/old.tsx": "old" }));
  const mA = await codeMirrorApi.projectMirror(env, "par");
  const mB = await codeMirrorApi.projectMirror(env, "par");
  // Part A adds /about; part B adds /menu and takes /old off. Neither saw the other's file.
  const a = await codeMirrorApi.storeProjectFolder(env, "par", mA, { project: snapOf({ "src/router.tsx": "r", "src/routes/index.tsx": "home", "src/routes/old.tsx": "old", "src/routes/about.tsx": "about" }) }, { gen: 4, lost: false });
  const bb = await codeMirrorApi.storeProjectFolder(env, "par", mB, { project: snapOf({ "src/router.tsx": "r", "src/routes/index.tsx": "home", "src/routes/menu.tsx": "menu" }) }, { gen: 4, lost: false });
  assert.equal(a.ok, true, a.why);
  assert.equal(bb.ok, true, bb.why);
  const list = await readProjectList(b, "par");
  assert.deepEqual(list.files.map((f) => f.path), ["src/router.tsx", "src/routes/about.tsx", "src/routes/index.tsx", "src/routes/menu.tsx"], "a part's list dropped the other's file, or kept a removed one");
  assert.deepEqual(blobKeys(b, "par"), [...new Set([...list.files.flatMap((f) => [f.sha256, f.starter].filter(Boolean)), ...Object.keys(list.retired)])].sort(), "the folder and its list disagree");
});

test("CM18 the list write is conditional: a list that moved between the read and the write is read again and merged", async () => {
  const b = memBucket();
  await saveProject(b, "race", snapOf({ "src/routes/index.tsx": "home" }));
  const base = await readProjectList(b, "race");
  let raced = false;
  const r = await saveProject(b, "race", snapOf({ "src/routes/index.tsx": "home", "src/routes/a.tsx": "a" }), {
    base,
    putList: async (merge) => {
      for (let i = 0; i < 3; i++) {
        const o = await b.get(PROJECT_LIST_KEY("race"));
        const cur = await readProjectList(b, "race");
        if (!raced) { raced = true; await saveProject(b, "race", snapOf({ "src/routes/index.tsx": "home", "src/routes/b.tsx": "b" }), { base }); }
        if (await b.put(PROJECT_LIST_KEY("race"), JSON.stringify({ v: 2, ...merge(cur) }), { onlyIf: { etagMatches: o.etag } })) return true;
      }
      return false;
    },
  });
  assert.equal(r.ok, true);
  assert.deepEqual((await readProjectList(b, "race")).files.map((f) => f.path), ["src/routes/a.tsx", "src/routes/b.tsx", "src/routes/index.tsx"]);
});

// ── FIXES 2–7 AND THE SAME-PATH RACE (2026-10-31, the owner) ────────────────

const listBytes = (b, slug) => Buffer.from(b.store.get(PROJECT_LIST_KEY(slug))).toString();

test("CM19 fix 2: an interrupted save leaves the old list and every object it names untouched", async () => {
  let fail = false;
  const b = memBucket({ failPut: (k) => fail && k.endsWith(sha(Buffer.from("new b"))) });
  await saveProject(b, "half", snapOf({ "src/routes/a.tsx": "old a", "src/routes/b.tsx": "old b" }));
  const before = listBytes(b, "half");
  const blobsBefore = blobKeys(b, "half");
  fail = true;
  const r = await saveProject(b, "half", snapOf({ "src/routes/a.tsx": "new a", "src/routes/b.tsx": "new b" }));
  assert.equal(r.ok, false);
  assert.equal(listBytes(b, "half"), before, "the list moved under a save that did not finish");
  for (const k of blobsBefore) assert.ok(blobKeys(b, "half").includes(k), "an object the old list names was touched");
  const got = await readProjectFiles(b, "half", (await readProjectList(b, "half")).files);
  assert.deepEqual(got.map((f) => f.source), ["old a", "old b"], "the old project no longer reads whole");
});

test("CM20 the same-path race: two saves of one path leave a list whose entry names bytes that are stored and match", async () => {
  const b = memBucket();
  await saveProject(b, "sp", snapOf({ "src/routes/index.tsx": "v0" }));
  const base = await readProjectList(b, "sp");
  await Promise.all([
    saveProject(b, "sp", snapOf({ "src/routes/index.tsx": "from A" }), { base }),
    saveProject(b, "sp", snapOf({ "src/routes/index.tsx": "from B" }), { base }),
  ]);
  const list = await readProjectList(b, "sp");
  const [f] = await readProjectFiles(b, "sp", list.files);
  assert.ok(!f.missing, "the list names bytes that are not stored, or do not match");
  assert.ok(["from A", "from B"].includes(f.source));
});

test("CM21 fix 5: nothing re-uploaded when nothing changed, and a compile of an unchanged site costs one read", async () => {
  const { codeMirrorApi } = await loadWorkerModule();
  const b = memBucket();
  await saveProject(b, "cost", snapOf({ "src/router.tsx": "r", "src/routes/index.tsx": "h", "src/lib/rows.ts": "rows" }));
  b.log.length = 0;
  const again = await saveProject(b, "cost", snapOf({ "src/router.tsx": "r", "src/routes/index.tsx": "h", "src/lib/rows.ts": "rows" }));
  assert.equal(again.uploaded, 0);
  assert.deepEqual(b.log.filter((l) => l[0] === "put").map((l) => l[1]), [PROJECT_LIST_KEY("cost")], "an unchanged file was uploaded again");
  b.log.length = 0;
  const m = await codeMirrorApi.projectMirror({ SITES_BUCKET: b }, "cost");
  assert.deepEqual(m.overlay, []);
  assert.deepEqual(b.log, [["get", PROJECT_LIST_KEY("cost")]], "an unchanged site's compile read more than its list");
});

/** A list holding one starter file the site changed, its bytes stored. */
async function changedStarter(b, slug, { blob = true, corrupt = false } = {}) {
  const mine = Buffer.from("site's rows"), start = Buffer.from("starter rows");
  await saveProject(b, slug, { ok: true, files: [
    ...snapOf({ "src/routes/index.tsx": "h" }).files,
    { path: "src/lib/rows.ts", size: mine.length, sha256: sha(mine), base64: mine.toString("base64"), starter: sha(start), starterSize: start.length, starterBase64: start.toString("base64") },
  ] });
  if (!blob) b.store.delete(PROJECT_BLOB_KEY(slug, sha(mine)));
  if (corrupt) b.store.set(PROJECT_BLOB_KEY(slug, sha(mine)), new TextEncoder().encode("tampered"));
  return { mine, start };
}

test("CM22 fix 6 (and 3's hash check): a listed file that cannot be read, or whose bytes do not match, stops the compile by name; one blip is retried", async () => {
  const { codeMirrorApi } = await loadWorkerModule();
  const gone = memBucket(); await changedStarter(gone, "g1", { blob: false });
  const m1 = await codeMirrorApi.projectMirror({ SITES_BUCKET: gone }, "g1");
  assert.match(m1.blocked, /src\/lib\/rows\.ts could not be read/);
  assert.deepEqual(codeMirrorApi.projectBlocked(m1), { ok: false, stage: "project", error: m1.blocked, projectUnreadable: true });
  const bad = memBucket(); await changedStarter(bad, "g2", { corrupt: true });
  assert.match((await codeMirrorApi.projectMirror({ SITES_BUCKET: bad }, "g2")).blocked, /src\/lib\/rows\.ts/, "bytes that do not match the list were laid over the template");
  const flaky = memBucket(); const { mine } = await changedStarter(flaky, "g3");
  const real = flaky.get; let blip = true;
  flaky.get = async (k) => { if (blip && k.includes("/blobs/")) { blip = false; throw new Error("blip"); } return real(k); };
  const m3 = await codeMirrorApi.projectMirror({ SITES_BUCKET: flaky }, "g3");
  assert.equal(m3.blocked, undefined, "one blip stopped the compile");
  assert.deepEqual(m3.overlay, [{ path: "src/lib/rows.ts", base64: mine.toString("base64") }]);
  // BOTH COMPILES ASK BEFORE THE CONTAINER IS CALLED.
  const W = bare(read("../worker.js"));
  for (const [v, payload] of [["mirror", "const cPayload = JSON.stringify({"], ["bMirror", "const bPayload = JSON.stringify({"]]) {
    const at = W.indexOf(payload); const no = W.lastIndexOf("projectBlocked(" + v + ")", at);
    assert.ok(no > 0 && at - no < 400, "the " + v + " compile does not stop on an unreadable file");
  }
});

test("CM23 fix 3: a failed compile naming a changed starter file says so; the agent and the owner can put it back", async () => {
  const { codeMirrorApi } = await loadWorkerModule();
  const mirror = { overlay: [{ path: "src/lib/rows.ts", base64: "" }] };
  const failed = codeMirrorApi.noteProjectSuspects(mirror, { ok: false, error: "src/lib/rows.ts(3,1): error TS2322" });
  assert.deepEqual(failed.projectSuspects, ["src/lib/rows.ts"]);
  assert.match(failed.error, /restore_starter_file/);
  assert.equal(codeMirrorApi.noteProjectSuspects(mirror, { ok: false, error: "index.tsx(1,1): TS2322" }).projectSuspects, undefined, "a file the error does not name was blamed");
  assert.equal(codeMirrorApi.noteProjectSuspects(mirror, { ok: true }).projectSuspects, undefined);
  // THE RESTORE: the list entry takes the starter's hash, and its bytes read.
  const b = memBucket(); const { start } = await changedStarter(b, "rs");
  assert.equal((await codeMirrorApi.restoreStarterFile({ SITES_BUCKET: b }, "rs", "src/routes/index.tsx")).ok, false, "a page was 'restored'");
  assert.equal(restoreStarterEntry([{ path: "src/routes/index.tsx", size: 1, sha256: "b".repeat(64), starter: "a".repeat(64) }], "src/routes/index.tsx").ok, false, "a page carrying a starter hash was put back to it");
  const r = await codeMirrorApi.restoreStarterFile({ SITES_BUCKET: b }, "rs", "src/lib/rows.ts");
  assert.equal(r.ok, true, r.why);
  const list = await readProjectList(b, "rs");
  const e = list.files.find((f) => f.path === "src/lib/rows.ts");
  assert.equal(e.sha256, sha(start));
  assert.equal((await readProjectFiles(b, "rs", [e]))[0].source, "starter rows");
  assert.deepEqual((await codeMirrorApi.projectMirror({ SITES_BUCKET: b }, "rs")).overlay, [], "a restored file is still laid over the template");
  // THE AGENT'S TOOL: offered only when wired, and it calls the restore.
  const asked = [];
  const rounds = [answer(use("restore_starter_file", { file: "src/lib/rows.ts" })), answer(use("finish", { summary: "s" }))];
  let i = 0; const sent = [];
  await runSiteAgent({ send: async (q) => { sent.push(JSON.parse(JSON.stringify(q))); return rounds[Math.min(i++, rounds.length - 1)]; }, build: async () => ({ ok: true }), restoreStarter: async (p) => { asked.push(p); return { ok: true }; } },
    { request: "r", pages: [{ path: "index.tsx", source: "H" }], maxRounds: 2 });
  assert.deepEqual(asked, ["src/lib/rows.ts"]);
  assert.ok(sent[0].tools.some((t) => t.name === "restore_starter_file"));
  const { toolsFor } = await import("../builder/site-agent.mjs");
  assert.ok(!toolsFor({}).some((t) => t.name === "restore_starter_file"), "the tool was offered with nothing behind it");
});

test("CM24 DRIVEN: the owner's restore route is the owner's only", async () => {
  const b = memBucket(); await changedStarter(b, "own-rs");
  const worker = await loadWorker();
  const call = async (owner) => {
    const real = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const u = String((input && input.url) || input || "");
      const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
      if (u.includes("/auth/v1/user")) return json({ id: "u-owner" });
      if (u.includes("/rest/v1/site_backends")) return json([{ uid: owner }]);
      return new Response("x", { status: 503 });
    };
    try {
      const res = await worker.fetch(new Request("https://gofarther.dev/api/site/source/restore", { method: "POST", headers: { Authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ slug: owner === "u-owner" ? "own-rs" : "own-rs-x", path: "src/lib/rows.ts" }) }), { SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET: b }, makeCtx());
      return { status: res.status, body: await res.json() };
    } finally { globalThis.fetch = real; }
  };
  const before = listBytes(b, "own-rs");
  assert.equal((await call("someone-else")).status, 404);
  assert.equal(listBytes(b, "own-rs"), before);
  const ok = await call("u-owner");
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.notEqual(listBytes(b, "own-rs"), before);
});

test("CM25 fix 4: a starter file the site never changed follows the image's newer copy; one it changed is kept", async () => {
  const b = memBucket();
  const s1 = Buffer.from("starter v1"), s2 = Buffer.from("starter v2"), mine = Buffer.from("site's own");
  await saveProject(b, "up", { ok: true, files: [
    { path: "src/router.tsx", size: s1.length, sha256: sha(s1), base64: s1.toString("base64"), starter: sha(s1), starterSize: s1.length },
    { path: "src/lib/rows.ts", size: mine.length, sha256: sha(mine), base64: mine.toString("base64"), starter: sha(s1), starterSize: s1.length, starterBase64: s1.toString("base64") },
  ] });
  const list = await readProjectList(b, "up");
  assert.deepEqual(overlayEntries(list.files).map((f) => f.path), ["src/lib/rows.ts"], "the unchanged file would hold the image's fix back, or the changed one would be lost");
  // THE IMAGE MOVED TO v2: the compile used it for the unchanged file, and the save records it.
  const app = fakeApp();
  try {
    fs.writeFileSync(path.join(app, "src/router.tsx"), s2);
    const o = applyOverlay({ app, fs, path, files: [{ path: "src/lib/rows.ts", base64: mine.toString("base64") }] });
    const snap = collectProject({ app, fs, path, hash: sha, pristine: o.pristine });
    const r = snap.files.find((f) => f.path === "src/router.tsx");
    assert.deepEqual([r.sha256, r.starter], [sha(s2), sha(s2)]);
    const k = snap.files.find((f) => f.path === "src/lib/rows.ts");
    assert.equal(k.sha256, sha(mine), "the site's change was lost");
    assert.notEqual(k.starter, k.sha256);
  } finally { fs.rmSync(app, { recursive: true, force: true }); }
});

test("CM26 fix 7: the agent's shell starts from the site's folder", () => {
  const W = bare(read("../worker.js"));
  const at = W.indexOf("function agentShell(env, slug) {");
  const body = W.slice(at, W.indexOf("\n}", at));
  assert.match(body, /mirrorP = projectMirror\(env, slug\)/);
  assert.match(body, /if \(mirror\.blocked\) return \{ ok: false, error: mirror\.blocked \};/, "a shell would start without an unreadable file");
  assert.match(body, /projectFiles: mirror\.overlay/);
  const S = bare(read("../builder/build-server.mjs"));
  const r = S.slice(S.indexOf('req.url === "/agent-run"'), S.indexOf('req.url === "/agent-call"'));
  const w = r.indexOf("writeSiteFiles(dir"), a = r.indexOf("applyOverlay({ app: dir, fs, path, files: p.projectFiles");
  const run = r.indexOf("runCommand(dir");
  assert.ok(w > 0 && a > w && run > a, "the shell's copy is not overlaid before the command runs");
  // DRIVEN: the overlay lands in a session folder.
  const dir = fakeApp();
  try {
    applyOverlay({ app: dir, fs, path, files: [{ path: "src/lib/rows.ts", base64: Buffer.from("site rows").toString("base64") }] });
    assert.equal(fs.readFileSync(path.join(dir, "src/lib/rows.ts"), "utf8"), "site rows");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── FIX A (2026-10-31, the owner): RETIRED, THEN DELETED BY A LATER SAVE ────

test("CMA1 a hash no entry names is retired with its time, deleted only by a later save over an hour on, and un-retired when named again", async () => {
  const b = memBucket();
  let t = 1_000_000;
  const clock = () => t;
  await saveProject(b, "ret", snapOf({ "src/routes/index.tsx": "v1" }), { now: clock });
  const v1 = sha(Buffer.from("v1"));
  await saveProject(b, "ret", snapOf({ "src/routes/index.tsx": "v2" }), { now: clock });
  assert.equal((await readProjectList(b, "ret")).retired[v1], t, "the unreferenced hash was not retired with its time");
  assert.ok(b.store.has(PROJECT_BLOB_KEY("ret", v1)));
  t += 30 * 60 * 1000;
  await saveProject(b, "ret", snapOf({ "src/routes/index.tsx": "v2", "src/routes/a.tsx": "a" }), { now: clock });
  assert.ok(b.store.has(PROJECT_BLOB_KEY("ret", v1)), "deleted before its hour was up");
  t += 31 * 60 * 1000;
  const r = await saveProject(b, "ret", snapOf({ "src/routes/index.tsx": "v2", "src/routes/a.tsx": "a" }), { now: clock });
  assert.equal(r.removed, 1);
  assert.ok(!b.store.has(PROJECT_BLOB_KEY("ret", v1)), "a hash retired over an hour ago was kept");
  assert.equal((await readProjectList(b, "ret")).retired[v1], undefined, "a deleted hash stayed on the map");
  // UN-RETIRED: bytes named again come off the map and are never deleted.
  const v2 = sha(Buffer.from("v2"));
  await saveProject(b, "ret", snapOf({ "src/routes/index.tsx": "v3", "src/routes/a.tsx": "a" }), { now: clock });
  assert.ok(Object.hasOwn((await readProjectList(b, "ret")).retired, v2));
  t += 10 * 60 * 1000; // within the hour, so only the un-retire can take it off the map
  await saveProject(b, "ret", snapOf({ "src/routes/index.tsx": "v2", "src/routes/a.tsx": "a" }), { now: clock });
  const after = await readProjectList(b, "ret");
  assert.equal(after.retired[v2], undefined, "a hash named again stayed retired");
  assert.ok(b.store.has(PROJECT_BLOB_KEY("ret", v2)), "bytes named again were deleted");
  const [f] = await readProjectFiles(b, "ret", after.files.filter((x) => x.path === "src/routes/index.tsx"));
  assert.equal(f.source, "v2");
});

test("CMA2 the race: a save writing the same bytes during another save's cleanup keeps its blob", async () => {
  const b = memBucket();
  let t = 0;
  const clock = () => t;
  const X = "the same bytes", hx = sha(Buffer.from(X));
  await saveProject(b, "rc", snapOf({ "src/routes/index.tsx": X }), { now: clock });
  await saveProject(b, "rc", snapOf({ "src/routes/index.tsx": "other" }), { now: clock });
  t += 2 * 60 * 60 * 1000;
  // SAVE B starts from a list that does not name X, so it uploads X's bytes ...
  const baseB = await readProjectList(b, "rc");
  // ... and SAVE A's cleanup deletes X right after B's upload, before B's switch.
  const realPut = b.put.bind(b);
  let cleanupRan = false;
  b.put = async (k, body, o) => {
    const r = await realPut(k, body, o);
    if (!cleanupRan && k === PROJECT_BLOB_KEY("rc", hx)) {
      cleanupRan = true;
      await saveProject(b, "rc", snapOf({ "src/routes/index.tsx": "other", "src/routes/z.tsx": "z" }), { now: clock });
      assert.ok(!b.store.has(PROJECT_BLOB_KEY("rc", hx)), "the race was not staged: A's cleanup did not delete X");
    }
    return r;
  };
  const r = await saveProject(b, "rc", snapOf({ "src/routes/index.tsx": "other", "src/routes/z.tsx": "z", "src/routes/x.tsx": X }), { base: baseB, now: clock });
  assert.equal(r.ok, true, r.why);
  assert.ok(b.store.has(PROJECT_BLOB_KEY("rc", hx)), "B's blob was lost to A's cleanup");
  const list = await readProjectList(b, "rc");
  const got = await readProjectFiles(b, "rc", list.files);
  assert.ok(got.every((f) => !f.missing), "the list names bytes that are not stored");
  assert.equal(list.retired[hx], undefined);
});

// ── FIX B (2026-10-31, the owner): "RESTORE ORIGINAL" IN THE CODE TAB ───────

test("CMB1 DRIVEN: the route marks a starter file the site changed, and only that one", async () => {
  const slug = "gf-mirror-" + (++caseNo);
  const b = memBucket();
  await changedStarter(b, slug);
  // AND AN UNCHANGED STARTER FILE beside it (its bytes are its starter version).
  const extra = snapOf({ "src/router.tsx": "r" }).files[0];
  const cur = await readProjectList(b, slug);
  await b.put(PROJECT_BLOB_KEY(slug, extra.sha256), Buffer.from("r"));
  await b.put(PROJECT_LIST_KEY(slug), JSON.stringify({ v: 2, files: [...cur.files, { path: extra.path, size: extra.size, sha256: extra.sha256, starter: extra.starter, starterSize: 1 }], retired: {} }));
  const r = await callSource(b, slug);
  const by = Object.fromEntries(r.body.project.map((f) => [f.path, f]));
  assert.equal(by["src/lib/rows.ts"].changed, true);
  assert.equal(by["src/router.tsx"].changed, undefined, "an unchanged starter file was offered a restore");
  assert.equal(by["src/routes/index.tsx"].changed, undefined, "a page was offered a restore");
});

test("CMB2 the menu offers Restore original on a changed starter file only, and it calls the owner's restore then reloads the tab", () => {
  const tree = new Function(fn("function stRowRestorable(") + "\n" + fn("function stSrcFiles(") + "\n" + fn("function stSrcPath(") + "\nreturn { stRowRestorable, stSrcFiles };")();
  const files = tree.stSrcFiles({ project: [
    { path: "src/lib/rows.ts", size: 1, sha256: "b".repeat(64), changed: true, source: "x" },
    { path: "src/lib/utils.ts", size: 1, sha256: "d".repeat(64), source: "y" },
  ] });
  assert.equal(tree.stRowRestorable(files[0]), true, "the changed file lost its restore");
  assert.equal(tree.stRowRestorable(files[1]), false);
  assert.equal(tree.stRowRestorable({ kind: "kit", changed: true }), false, "an old site's row was offered a restore");
  assert.match(CHAT, /\['restore', 'Restore original', 'history'\]/);
  // THE OPENER HIDES IT PER ROW, AND THE PRESS CALLS THE ROUTE, THEN READS THE TAB AGAIN.
  assert.match(CHAT, /if \(rs\) rs\.hidden = !stRowRestorable\(files\.find\(\(x\) => x\.name === menuFor\)\);/);
  const at = CHAT.indexOf("if (it.dataset.act === 'restore') {");
  assert.ok(at > 0);
  const body = CHAT.slice(at, CHAT.indexOf("return;\n      }", at));
  assert.match(body, /if \(!stRowRestorable\(f\)\) return;/);
  assert.match(body, /apiFetch\('\/api\/site\/source\/restore', \{ method: 'POST'/);
  assert.match(body, /JSON\.stringify\(\{ slug: src\.slug, path: f\.name \}\)/);
  assert.match(body, /loadSiteCode\(\{ slug: src\.slug \}\)/);
  assert.match(read("../public/styles.css"), /\.st-row-item\[hidden\] \{ display: none; \}/, "a hidden entry would still show");
});

test("CMA3 the race after the switch: bytes another save names again between this save's switch and its cleanup are kept", async () => {
  const b = memBucket();
  let t = 0;
  const clock = () => t;
  const X = "old bytes", hx = sha(Buffer.from(X));
  await saveProject(b, "rc2", snapOf({ "src/routes/index.tsx": X }), { now: clock });
  await saveProject(b, "rc2", snapOf({ "src/routes/index.tsx": "new" }), { now: clock });
  t += 2 * 60 * 60 * 1000;
  // THIS SAVE'S LIST WRITE DOOMS X; RIGHT AFTER IT, ANOTHER SAVE'S LIST NAMES X AGAIN.
  const r = await saveProject(b, "rc2", snapOf({ "src/routes/index.tsx": "new", "src/routes/b.tsx": "b" }), {
    now: clock,
    putList: async (m) => {
      const cur = await readProjectList(b, "rc2");
      const next = m(cur);
      await b.put(PROJECT_LIST_KEY("rc2"), JSON.stringify({ v: 2, ...next }));
      await b.put(PROJECT_LIST_KEY("rc2"), JSON.stringify({ v: 2, files: [...next.files, { path: "src/routes/x.tsx", size: 9, sha256: hx }], retired: next.retired }));
      return true;
    },
  });
  assert.equal(r.ok, true);
  assert.ok(b.store.has(PROJECT_BLOB_KEY("rc2", hx)), "bytes the current list names were deleted by the cleanup");
});
