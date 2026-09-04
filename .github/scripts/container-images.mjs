// Build a container image ONLY when what it is built from changed (owner,
// 2026-09-04: "Ok yeah lets do that").
//
// WHY THIS EXISTS. `wrangler deploy` builds and pushes every container image
// whose `image` is a Dockerfile path, on EVERY deploy — measured today: 14 and
// 15 minutes per deploy, most of it the image build and the registry push, on
// two pushes that changed nothing under either Dockerfile. And a pushed image
// ROLLS the container: an instance started in the twenty minutes after a
// deploy may still be on the previous image, so every Worker-only push cost a
// twenty-minute hold before anything that builds could be fired (run 17 was
// lost inside that window). The registry push is also where both of today's
// deploy failures happened — a 500 after minutes of layer retries — on images
// identical to the ones already there.
//
// WHAT IT DOES. For each container whose `image` is a Dockerfile path:
//   1. the image's INPUTS are read off the Dockerfile — every path a COPY/ADD
//      names, plus the Dockerfile itself and its `.dockerignore` — and each is
//      resolved to the git object it is at HEAD (`git rev-parse HEAD:<path>`:
//      a blob for a file, a tree for a directory, content-addressed either
//      way). The image id is a hash over those, so it changes exactly when
//      something the image is built from changes, and never when a Worker
//      module that happens to live in the same directory does;
//   2. the registry ITSELF is asked whether `<name>:<id>` is there — a HEAD on
//      the tag's manifest (`/v2/<account>/<name>/manifests/<id>`) with a
//      five-minute pull credential minted through the account's containers
//      API, the way Wrangler's own `images delete` finds a tag. NOT `wrangler
//      containers images list`: that fetches ONE page of the registry catalog
//      (`/v2/_catalog?tags=true`) and never the next — measured on deploys
//      2017 and 2018 (2026-09-04): three repositories came back, the site
//      image's not among them though pushed three times and referenced by
//      the deploy, the game repository's tags the old eight-hex ones only —
//      so both images were rebuilt on every deploy. If the tag is not there,
//      the image is built and pushed under it (`wrangler containers build
//      <ctx> -t … -p`), once more on a failure, since the registry's 500s are
//      what failed twice today and a second attempt reuses every layer of the
//      first. A registry that CANNOT be asked (any answer but 200 or 404, or a
//      credential it will not mint) builds, and says so: a build is always
//      right and only slow, a wrong skip ships a stale image;
//   3. `wrangler.jsonc` IN THE CHECKOUT is rewritten to reference
//      `registry.cloudflare.com/<account>/<name>:<id>` — the FULL reference,
//      measured on deploy run 2016 (2026-09-04): Wrangler's config validator
//      (`isDockerfile`) parses a non-file image with `new URL("https://" +
//      image)`, and a bare `name:tag` is an invalid URL (the tag reads as a
//      port), so the step built and pushed the image and the deploy then
//      refused the config. The account id is the step's own env, never the
//      repository's config — and the deploy that follows builds nothing and
//      rolls nothing unless the reference moved.
//
// THE REPOSITORY'S OWN CONFIG IS UNCHANGED: it keeps the Dockerfile paths, so a
// hand `wrangler deploy` and `wrangler dev` behave exactly as they always did.
// Only the CI checkout is rewritten, after the tag it names is known to exist.
//
// WHAT A SKIP CANNOT DO. A wrong skip would ship a Worker against a stale
// image, which is why the id is derived from the inputs rather than from "did
// this push touch builder/": a push that touches only `builder/site-add.mjs`
// (a Worker module) reuses the image, a push that touches
// `builder/lovable/template/…` (copied into it) rebuilds. The base image
// (`node:22-slim`) and apt packages are NOT inputs — an upstream update reaches
// the image only when something here changes; to force a rebuild, change the
// Dockerfile (a comment is enough).
//
// DEPENDENCY-FREE AND DRIVEN: every decision is a pure function, driven in
// test/container-images.test.mjs with fakes for git and wrangler; `main` takes
// its deps so the test runs the whole flow without a registry.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Comments and trailing commas out of a JSONC text, strings left alone. */
export function stripJsonc(text) {
  let out = "";
  let i = 0;
  const s = String(text);
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      // A string, copied whole with its escapes.
      let j = i + 1;
      while (j < s.length && s[j] !== '"') { if (s[j] === "\\") j++; j++; }
      out += s.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "/" && s[i + 1] === "/") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "/" && s[i + 1] === "*") { const e = s.indexOf("*/", i + 2); i = e < 0 ? s.length : e + 2; continue; }
    out += c;
    i++;
  }
  // Trailing commas, outside strings (the strings are already copied whole,
  // so a comma-bracket pair inside one cannot be reached by this pass on the
  // comment-free text only if the string held it — handled by walking again).
  let res = "";
  i = 0;
  while (i < out.length) {
    const c = out[i];
    if (c === '"') {
      let j = i + 1;
      while (j < out.length && out[j] !== '"') { if (out[j] === "\\") j++; j++; }
      res += out.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === ",") {
      let k = i + 1;
      while (k < out.length && /\s/.test(out[k])) k++;
      if (out[k] === "]" || out[k] === "}") { i++; continue; }
    }
    res += c;
    i++;
  }
  return res;
}

/** The Worker's name and every container whose image is a Dockerfile path. */
export function readContainers(jsoncText) {
  const cfg = JSON.parse(stripJsonc(jsoncText));
  const name = String(cfg.name || "");
  if (!name) throw new Error("wrangler.jsonc has no name");
  const all = Array.isArray(cfg.containers) ? cfg.containers : [];
  const containers = all
    .filter((c) => c && typeof c.image === "string" && /(^|\/)Dockerfile$/.test(c.image))
    .map((c) => ({ class_name: String(c.class_name || ""), image: c.image, context: c.image_build_context || path.posix.dirname(c.image) }));
  return { name, containers };
}

/**
 * Every source path a COPY or ADD names, in order: flags skipped, a
 * `--from=` stage's sources skipped (they are not in the build context), the
 * last argument (the destination) dropped. The same reading as
 * test/dockerfile.test.mjs's, kept here because this file runs at deploy.
 */
export function copySources(dockerfileText) {
  const out = [];
  for (const m of String(dockerfileText).matchAll(/^(?:COPY|ADD)\s+(.+?)\s*$/gm)) {
    const parts = m[1].trim().split(/\s+/);
    if (parts.some((p) => p.startsWith("--from="))) continue;
    const args = parts.filter((p) => !p.startsWith("--"));
    if (args.length < 2) continue;
    for (const src of args.slice(0, -1)) out.push(src.replace(/\/+$/, ""));
  }
  return out;
}

/** The registry name for a container: the Worker's name and the class, lowercased. */
export function imageName(workerName, className) {
  return `${workerName}-${className}`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

/**
 * The image id: a hash over `path\0object-id` for every input, in order. The
 * inputs are the Dockerfile, the `.dockerignore` when there is one, and each
 * COPY source under the build context. Sixteen hex characters — a git object
 * id is forty, and a tag this long cannot collide by accident.
 */
export function imageId(inputs) {
  const h = createHash("sha256");
  for (const { path: p, oid } of inputs) {
    if (!oid || !/^[0-9a-f]{40,64}$/.test(String(oid))) throw new Error(`no git object for ${p}`);
    h.update(`${p}\0${oid}\n`);
  }
  return h.digest("hex").slice(0, 16);
}

/** The Cloudflare API base Wrangler uses; its knob is honoured below. */
export const API_BASE = "https://api.cloudflare.com/client/v4";

/** The manifest media types a registry answers a HEAD for — Wrangler's own list. */
const MANIFEST_ACCEPT = "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json";

/**
 * A five-minute PULL credential for the registry, minted through the account's
 * containers API exactly as Wrangler's `getCreds` does: the registry's Basic
 * user is `v1` and the password is the token. Pull only — this step reads.
 * Answers the whole `Authorization` value.
 */
export async function registryCredentials({ fetch, api = API_BASE, apiToken, accountId, registry }) {
  if (!apiToken) throw new Error("CLOUDFLARE_API_TOKEN is not set — the registry cannot be asked");
  const url = `${api}/accounts/${accountId}/containers/registries/${encodeURIComponent(registry)}/credentials`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiration_minutes: 5, permissions: ["pull"] }),
  });
  if (!r.ok) throw new Error(`registry credentials: ${r.status}`);
  const body = await r.json();
  const password = body && body.result && body.result.password;
  if (typeof password !== "string" || !password) throw new Error("registry credentials: no password in the answer");
  return "Basic " + Buffer.from(`v1:${password}`).toString("base64");
}

/**
 * Is `name:tag` in the registry? A HEAD on the tag's manifest under the
 * account: 200 is yes, 404 is no, and ANYTHING ELSE IS "COULD NOT TELL" —
 * answered as `null`, never as either, because the two wrong readings cost
 * different things (a stale image shipped, or minutes of a needless build)
 * and that is the caller's decision, not this function's.
 */
export async function manifestPresent({ fetch, registry, accountId, auth, name, tag }) {
  const url = `https://${registry}/v2/${accountId}/${name}/manifests/${tag}`;
  const r = await fetch(url, { method: "HEAD", headers: { Authorization: auth, Accept: MANIFEST_ACCEPT } });
  if (r.status === 200) return { present: true, status: 200 };
  if (r.status === 404) return { present: false, status: 404 };
  return { present: null, status: r.status };
}

/** The config with ONE image path replaced by a reference; anything but exactly one is an error. */
export function rewriteImage(jsoncText, imagePath, ref) {
  const needle = `"image": ${JSON.stringify(imagePath)}`;
  const n = jsoncText.split(needle).length - 1;
  if (n !== 1) throw new Error(`expected ${needle} exactly once in wrangler.jsonc, found ${n}`);
  return jsoncText.replace(needle, `"image": ${JSON.stringify(ref)}`);
}

/** The inputs of one container, resolved to git objects. `git(path)` answers an oid or null. */
export function containerInputs({ context, dockerfileText, hasDockerignore, git }) {
  const ctx = String(context).replace(/^\.\//, "").replace(/\/+$/, "");
  const at = (rel) => (ctx ? `${ctx}/${rel}` : rel);
  const paths = [at("Dockerfile")];
  if (hasDockerignore) paths.push(at(".dockerignore"));
  for (const src of copySources(dockerfileText)) paths.push(at(src.replace(/^\.\//, "")));
  return paths.map((p) => {
    const oid = git(p);
    if (!oid) throw new Error(`the Dockerfile copies ${p}, which is not in git at HEAD — the image cannot be built from this commit`);
    return { path: p, oid };
  });
}

/**
 * Run the whole flow. Every side effect is a dep so the test can drive it:
 * `tagPresent(name, tag)` answers `{ present: true | false | null, status }`
 * — the registry's own word (`manifestPresent`), or `null` when it could not
 * be had; `wrangler.build(ctx, tag)` builds and pushes.
 */
export async function main({ root, git, wrangler, tagPresent, accountId, registry = "registry.cloudflare.com", log = console.log, write, read, exists } = {}) {
  const readText = read || ((p) => readFileSync(path.join(root, p), "utf8"));
  const has = exists || ((p) => existsSync(path.join(root, p)));
  if (typeof tagPresent !== "function") throw new Error("no way to ask the registry was handed in");
  const cfgText = readText("wrangler.jsonc");
  const { name: workerName, containers } = readContainers(cfgText);
  if (!containers.length) { log("no container is built from a Dockerfile — nothing to do"); return { images: [], config: cfgText }; }
  // THE ACCOUNT, FIRST: the reference the config will carry names it, and
  // Wrangler refuses a reference that does not (see the header). Asked before
  // anything is built, so a missing id costs nothing.
  if (!/^[a-f0-9]{32}$/i.test(String(accountId || ""))) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set (or is not an account id) — the image reference must name this account's registry");

  // THE INPUTS FIRST, ALL OF THEM, before the registry is asked anything: a
  // missing input fails here by name, before any build is started.
  const planned = containers.map((c) => {
    const ctx = String(c.context).replace(/^\.\//, "").replace(/\/+$/, "");
    const inputs = containerInputs({ context: ctx, dockerfileText: readText(`${ctx}/Dockerfile`), hasDockerignore: has(`${ctx}/.dockerignore`), git });
    const tag = imageId(inputs);
    return { ...c, ctx, tag, name: imageName(workerName, c.class_name), inputs };
  });

  const images = [];
  let text = cfgText;
  for (const p of planned) {
    // THE BUILD TAG IS SHORT (`wrangler containers build -t` pushes it into
    // this account's namespace itself); THE CONFIG'S REFERENCE IS FULL.
    const tag = `${p.name}:${p.tag}`;
    const ref = `${registry}/${accountId}/${tag}`;
    // THE REGISTRY IS ASKED FOR THIS TAG BY NAME, and what it answered is
    // printed with the verdict — deploys 2017 and 2018 (2026-09-04) rebuilt
    // both images off a listing that had never carried them, and the step had
    // printed nothing that could say so.
    let asked;
    try { asked = await tagPresent(p.name, p.tag); }
    catch (e) { asked = { present: null, status: String((e && e.message) || e) }; }
    const present = asked && asked.present === true;
    const status = asked ? asked.status : "no answer";
    let action = "reused";
    if (!present) {
      action = "built";
      // COULD NOT TELL IS NOT "NOT THERE", and it is not "there" either: a
      // build is always right and only slow, so that is what happens — said
      // out loud, or a registry refusing every deploy would read as a slow one.
      if (!asked || asked.present !== false) log(`registry could not be asked for ${tag} (${status}) — building, which is always right and only slow`);
      // ONCE MORE ON A FAILURE: today's two deploy failures were the registry
      // answering 500 after minutes of layer retries, and a second attempt
      // reuses every layer the first one built.
      let ok = wrangler.build(p.ctx, tag);
      if (!ok) { log(`build of ${tag} failed — trying once more`); ok = wrangler.build(p.ctx, tag); }
      if (!ok) throw new Error(`could not build and push ${tag} for ${p.class_name}`);
    }
    text = rewriteImage(text, p.image, ref);
    log(`IMAGE ${p.class_name}: ${action} ${tag}  (registry answered ${status}; ${p.inputs.length} inputs off ${p.ctx}/Dockerfile)`);
    images.push({ class_name: p.class_name, ref, tag, action, status, inputs: p.inputs.length });
  }
  (write || ((p, t) => writeFileSync(path.join(root, p), t)))("wrangler.jsonc", text);
  return { images, config: text };
}

// ── the real deps ────────────────────────────────────────────────────────────

function gitObject(root) {
  return (p) => {
    const r = spawnSync("git", ["rev-parse", "--verify", "-q", `HEAD:${p}`], { cwd: root, encoding: "utf8" });
    const out = String(r.stdout || "").trim();
    return r.status === 0 && /^[0-9a-f]{40,64}$/.test(out) ? out : null;
  };
}

function wranglerCli(root) {
  const version = process.env.WRANGLER_VERSION || "";
  if (!version) throw new Error("WRANGLER_VERSION is not set — it must match the deploy step's wranglerVersion");
  const run = (args, capture) => spawnSync("npx", ["--yes", `wrangler@${version}`, ...args], { cwd: root, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", maxBuffer: 1 << 26 });
  return {
    build(ctx, ref) {
      const r = run(["containers", "build", ctx, "-t", ref, "-p"], false);
      return r.status === 0;
    },
  };
}

/**
 * The real `tagPresent`: one credential for the run, minted on the first ask,
 * then a HEAD per tag. Whatever fails here is a "could not tell" that `main`
 * turns into a build and a sentence.
 */
function registryProbe({ accountId, registry, apiToken, api }) {
  let auth = null;
  return async (name, tag) => {
    if (!auth) auth = await registryCredentials({ fetch, api, apiToken, accountId, registry });
    return manifestPresent({ fetch, registry, accountId, auth, name, tag });
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  // Wrangler's own knobs for the registry host and the API base, honoured for
  // the same reason Wrangler honours them; the defaults are the ones it uses.
  const registry = process.env.CLOUDFLARE_CONTAINER_REGISTRY || "registry.cloudflare.com";
  const api = process.env.CLOUDFLARE_API_BASE_URL || API_BASE;
  main({
    root, git: gitObject(root), wrangler: wranglerCli(root),
    tagPresent: registryProbe({ accountId, registry, apiToken: process.env.CLOUDFLARE_API_TOKEN || "", api }),
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    registry,
  }).catch((e) => {
    console.error("FATAL:", (e && e.message) || e);
    process.exit(1);
  });
}
