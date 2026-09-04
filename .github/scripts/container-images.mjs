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
//   2. the registry is asked whether `<name>:<id>` is already there
//      (`wrangler containers images list --json`); if not, the image is built
//      and pushed under that tag (`wrangler containers build <ctx> -t … -p`),
//      once more on a failure, since the registry's 500s are what failed twice
//      today and a second attempt reuses every layer of the first;
//   3. `wrangler.jsonc` IN THE CHECKOUT is rewritten to reference `<name>:<id>`
//      — a bare reference, which Wrangler expands to this account's registry
//      at deploy (`resolveImageName`), so no account id lives in the config —
//      and the deploy that follows builds nothing and rolls nothing unless the
//      reference moved.
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

/** Is `name:tag` already in the registry, by Wrangler's own JSON listing? */
export function present(listing, name, tag) {
  const rows = Array.isArray(listing) ? listing : [];
  return rows.some((r) => r && r.name === name && Array.isArray(r.tags) && r.tags.includes(tag));
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

/** Run the whole flow. Every side effect is a dep so the test can drive it. */
export async function main({ root, git, wrangler, log = console.log, write, read, exists } = {}) {
  const readText = read || ((p) => readFileSync(path.join(root, p), "utf8"));
  const has = exists || ((p) => existsSync(path.join(root, p)));
  const cfgText = readText("wrangler.jsonc");
  const { name: workerName, containers } = readContainers(cfgText);
  if (!containers.length) { log("no container is built from a Dockerfile — nothing to do"); return { images: [], config: cfgText }; }

  // THE INPUTS FIRST, ALL OF THEM, before the registry is asked anything: a
  // missing input fails here by name, before any build is started.
  const planned = containers.map((c) => {
    const ctx = String(c.context).replace(/^\.\//, "").replace(/\/+$/, "");
    const inputs = containerInputs({ context: ctx, dockerfileText: readText(`${ctx}/Dockerfile`), hasDockerignore: has(`${ctx}/.dockerignore`), git });
    const tag = imageId(inputs);
    return { ...c, ctx, tag, name: imageName(workerName, c.class_name), inputs };
  });

  const listing = wrangler.list();
  const images = [];
  let text = cfgText;
  for (const p of planned) {
    const ref = `${p.name}:${p.tag}`;
    let action = "reused";
    if (!present(listing, p.name, p.tag)) {
      action = "built";
      // ONCE MORE ON A FAILURE: today's two deploy failures were the registry
      // answering 500 after minutes of layer retries, and a second attempt
      // reuses every layer the first one built.
      let ok = wrangler.build(p.ctx, ref);
      if (!ok) { log(`build of ${ref} failed — trying once more`); ok = wrangler.build(p.ctx, ref); }
      if (!ok) throw new Error(`could not build and push ${ref} for ${p.class_name}`);
    }
    text = rewriteImage(text, p.image, ref);
    log(`IMAGE ${p.class_name}: ${action} ${ref}  (${p.inputs.length} inputs off ${p.ctx}/Dockerfile)`);
    images.push({ class_name: p.class_name, ref, action, inputs: p.inputs.length });
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
    list() {
      const r = run(["containers", "images", "list", "--json"], true);
      if (r.status !== 0) throw new Error(`wrangler containers images list failed (${r.status})`);
      // The JSON is the last thing printed; a banner or a warning may precede it.
      const text = String(r.stdout || "");
      const start = text.indexOf("[");
      if (start < 0) throw new Error("wrangler containers images list printed no JSON");
      return JSON.parse(text.slice(start));
    },
    build(ctx, ref) {
      const r = run(["containers", "build", ctx, "-t", ref, "-p"], false);
      return r.status === 0;
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  main({ root, git: gitObject(root), wrangler: wranglerCli(root) }).catch((e) => {
    console.error("FATAL:", (e && e.message) || e);
    process.exit(1);
  });
}
