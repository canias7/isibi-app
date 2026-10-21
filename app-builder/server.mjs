// THE APP BUILDER'S SERVICE (2026-10-20). One route that matters:
// `POST /build` with a build request (`app-config.mjs`) answers the Android app
// file (a debug APK) — or JSON `{ error }`. One build at a time; a second while
// one runs answers 409. Builds run offline against the libraries the image
// warmed up, from a fresh copy of the template.
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, cp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { readBuild, capacitorConfig, nativeNames, BUNDLE_MAX_BYTES } from "./app-config.mjs";
import * as fsp from "node:fs/promises";
import { readExpoRequest, exportExpo, readExpoAndroid, buildExpoAndroid, EXPO_MAX_BYTES } from "./expo-preview.mjs";

const run = promisify(execFile);
const TEMPLATE = new URL("./template/", import.meta.url).pathname;
const EXPO_TEMPLATE = new URL("./expo/", import.meta.url).pathname;
const SELFTEST = new URL("./selftest/", import.meta.url).pathname;
const BUILD_MS = 15 * 60 * 1000;
let busy = false;
/** The background jobs: the last few, by id, each `{ state, at, result, apk }`. */
const jobs = new Map();
/** Run one job in the background (one at a time, like every build here) and answer its id. */
function startJob(work) {
  const id = randomBytes(8).toString("hex");
  const j = { state: "running", at: Date.now(), result: null, apk: null };
  jobs.set(id, j);
  for (const k of [...jobs.keys()].slice(0, Math.max(0, jobs.size - 5))) jobs.delete(k);
  busy = true;
  Promise.resolve().then(work).then((o) => { j.result = o.result; j.apk = o.apk || null; }, (e) => {
    console.error("job failed:", e && e.message ? e.message.slice(0, 500) : e);
    j.result = { ok: false, stage: "crash", errors: [String((e && e.message) || e).slice(0, 300)] };
  }).finally(() => { j.state = "done"; busy = false; });
  return id;
}

export async function buildApp(r, { template = TEMPLATE, exec = run } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "app-"));
  try {
    await cp(template, dir, { recursive: true });
    await writeFile(join(dir, "capacitor.config.json"), JSON.stringify(capacitorConfig(r), null, 2));
    if (r.mode === "bundled") {
      await rm(join(dir, "www"), { recursive: true, force: true });
      for (const f of r.files) {
        const to = join(dir, "www", f.path);
        await mkdir(dirname(to), { recursive: true });
        await writeFile(to, Buffer.from(f.data, "base64"));
      }
    }
    const gradleFile = join(dir, "android/app/build.gradle");
    const stringsFile = join(dir, "android/app/src/main/res/values/strings.xml");
    const named = nativeNames(await readFile(gradleFile, "utf8"), await readFile(stringsFile, "utf8"), r);
    await writeFile(gradleFile, named.gradle);
    await writeFile(stringsFile, named.strings);
    const env = { ...process.env };
    await exec("npx", ["cap", "sync", "android"], { cwd: dir, env, timeout: BUILD_MS });
    await exec("./gradlew", ["assembleDebug", "--offline", "--no-daemon", "-q"], { cwd: join(dir, "android"), env, timeout: BUILD_MS, maxBuffer: 16 * 1024 * 1024 });
    return await readFile(join(dir, "android/app/build/outputs/apk/debug/app-debug.apk"));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const parts = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > max) { reject(new Error("too large")); req.destroy(); } else parts.push(c); });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };

export const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, busy, routes: ["/build", "/expo", "/expo-android", "/selftest", "/jobs"] });
  // AN EXPO APP'S WEB VERSION (phase B): checked and exported, for the phones.
  if (req.method === "POST" && req.url === "/expo") {
    if (busy) return json(res, 409, { error: "busy" });
    busy = true;
    try {
      let body = null;
      try { body = JSON.parse(await readBody(req, Math.ceil(EXPO_MAX_BYTES * 1.2) + 50_000)); } catch { return json(res, 400, { error: "not a preview request" }); }
      const r = readExpoRequest(body);
      if (r.error) return json(res, 400, { error: r.error });
      return json(res, 200, await exportExpo(r, { template: EXPO_TEMPLATE, exec: run, fs: fsp, tmp: tmpdir() }));
    } catch (e) {
      console.error("expo preview failed:", e && e.message ? e.message.slice(0, 500) : e);
      return json(res, 500, { error: "the app could not be checked" });
    } finally { busy = false; }
  }
  // LONG JOBS RUN IN THE BACKGROUND (2026-10-21): a request held open past about
  // three minutes is cut between the Worker and this container while the build
  // goes on, and its answer is lost. So an Android build (and the self-test)
  // answers 202 with a job id at once; `GET /jobs/<id>` says how it stands, and
  // `GET /jobs/<id>/apk` hands over the app when it is done.
  const jm = req.url.match(/^\/jobs\/([a-f0-9]{16})(\/apk)?$/);
  if (req.method === "GET" && jm) {
    const j = jobs.get(jm[1]);
    if (!j) return json(res, 404, { error: "no such job" });
    if (jm[2]) {
      if (!j.apk) return json(res, 404, { error: "no app for this job" });
      res.writeHead(200, { "content-type": "application/vnd.android.package-archive" });
      return res.end(j.apk);
    }
    return json(res, 200, { state: j.state, ms: Date.now() - j.at, ...(j.result ? { result: j.result } : {}) });
  }
  // THE SELF-TEST (2026-10-21, owner: testing stays on Cloudflare): the hand-
  // built Harbour Loaf this image carries, built into an Android app here, and
  // what that did, with its own errors.
  if (req.method === "POST" && req.url === "/selftest") {
    if (busy) return json(res, 409, { error: "busy" });
    return json(res, 202, { job: startJob(async () => {
      const files = [];
      const walk = async (d, rel) => {
        for (const e of await fsp.readdir(d, { withFileTypes: true })) {
          const p = d + e.name, q = rel + e.name;
          if (e.isDirectory()) await walk(p + "/", q + "/"); else files.push({ path: q, source: await fsp.readFile(p, "utf8") });
        }
      };
      await walk(SELFTEST, "");
      // THE ANDROID BUILD ONLY (owner, 2026-10-21: "lets not worry about the web version rn").
      const apk = await buildExpoAndroid({ files, theme: null, appId: "dev.gofarther.selftest", name: "Self test" }, { template: EXPO_TEMPLATE, exec: run, fs: fsp, tmp: tmpdir() });
      return { result: { android: apk.ok ? { ok: true, bytes: apk.apk.length, ms: apk.ms } : apk } };
    }) });
  }
  // AN EXPO APP AS AN ANDROID APP (phase D), in the background: 202 { job }.
  if (req.method === "POST" && req.url === "/expo-android") {
    if (busy) return json(res, 409, { error: "busy" });
    let body = null;
    try { body = JSON.parse(await readBody(req, Math.ceil(EXPO_MAX_BYTES * 1.2) + 50_000)); } catch { return json(res, 400, { error: "not a build request" }); }
    const r = readExpoAndroid(body);
    if (r.error) return json(res, 400, { error: r.error });
    return json(res, 202, { job: startJob(async () => {
      const out = await buildExpoAndroid(r, { template: EXPO_TEMPLATE, exec: run, fs: fsp, tmp: tmpdir() });
      return out.ok ? { result: { ok: true, bytes: out.apk.length, ms: out.ms }, apk: out.apk } : { result: out };
    }) });
  }
  if (req.method !== "POST" || req.url !== "/build") return json(res, 404, { error: "not found", method: req.method, url: String(req.url).slice(0, 200) });
  if (busy) return json(res, 409, { error: "busy" });
  busy = true;
  const started = Date.now();
  try {
    let body = null;
    try { body = JSON.parse(await readBody(req, Math.ceil(BUNDLE_MAX_BYTES * 1.4) + 100_000)); } catch { return json(res, 400, { error: "not a build request" }); }
    const r = readBuild(body);
    if (r.error) return json(res, 400, { error: r.error });
    const apk = await buildApp(r);
    res.writeHead(200, { "content-type": "application/vnd.android.package-archive", "x-build-ms": String(Date.now() - started) });
    res.end(apk);
  } catch (e) {
    console.error("app build failed:", e && e.message ? e.message.slice(0, 500) : e);
    json(res, 500, { error: "the app could not be built" });
  } finally { busy = false; }
});

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) server.listen(8080, () => console.log("app builder on 8080"));
