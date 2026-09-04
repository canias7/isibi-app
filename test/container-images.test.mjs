// A CONTAINER IMAGE IS BUILT ONLY WHEN ITS INPUTS CHANGED (owner, 2026-09-04).
//
// `wrangler deploy` builds and pushes every Dockerfile-backed image on every
// push — 14 and 15 minutes today on two pushes that changed nothing under
// either Dockerfile — and every pushed image rolls the container, which is the
// twenty-minute hold after each deploy. `.github/scripts/container-images.mjs`
// derives each image's id from the git objects the Dockerfile copies, builds
// only when that tag is not in the registry, and rewrites the CHECKOUT's
// config to reference it. Every decision is a pure function, driven here; the
// flow runs with fakes for git and wrangler; the workflow wiring is read.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  stripJsonc, readContainers, copySources, imageName, imageId, present, rewriteImage, containerInputs, main,
} from "../.github/scripts/container-images.mjs";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const CONFIG = fs.readFileSync(path.join(ROOT, "wrangler.jsonc"), "utf8");
const WORKFLOW = fs.readFileSync(path.join(ROOT, ".github/workflows/deploy.yml"), "utf8");
const SCRIPT = fs.readFileSync(path.join(ROOT, ".github/scripts/container-images.mjs"), "utf8");
// A 32-hex account id, the shape Wrangler's `resolveImageName` accepts.
const ACCOUNT = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

/* ───────────────────────────── the pure parts ───────────────────────────── */

test("stripJsonc removes comments and trailing commas outside strings, and nothing inside them", () => {
  const src = `{\n  // a comment with "quotes" and https://a.b/c\n  "url": "https://x.y/z", /* block */\n  "list": [1, 2,],\n  "q": "a // not a comment /* nor this */",\n}`;
  const parsed = JSON.parse(stripJsonc(src));
  assert.deepEqual(parsed, { url: "https://x.y/z", list: [1, 2], q: "a // not a comment /* nor this */" });
  assert.equal(JSON.parse(stripJsonc('{"e":"\\"//\\""}')).e, '"//"', "an escaped quote inside a string is not the end of it");
});

test("the real config names the Worker and both Dockerfile-backed containers, with their build contexts", () => {
  const { name, containers } = readContainers(CONFIG);
  assert.equal(name, "isibi-app");
  assert.deepEqual(containers.map((c) => [c.class_name, c.image, c.context]), [
    ["GameBuildContainer", "./builder-game/Dockerfile", "./builder-game"],
    ["SiteBuildContainer", "./builder/Dockerfile", "./builder"],
  ]);
  // A container already on a registry reference is NOT one this step touches.
  const { containers: none } = readContainers('{"name":"w","containers":[{"class_name":"A","image":"w-a:abc"}]}');
  assert.equal(none.length, 0);
  // An explicit build context wins over the Dockerfile's directory.
  const { containers: ctx } = readContainers('{"name":"w","containers":[{"class_name":"A","image":"./x/Dockerfile","image_build_context":"./y"}]}');
  assert.equal(ctx[0].context, "./y");
});

test("copySources reads every COPY/ADD source, skips flags and staged sources, drops the destination", () => {
  assert.deepEqual(copySources("COPY a.js b.js ./\nCOPY dir/ ./dir/\nADD tarball.tgz /opt/\n"), ["a.js", "b.js", "dir", "tarball.tgz"]);
  assert.deepEqual(copySources("COPY --chown=node:node x.mjs ./\n"), ["x.mjs"], "a flag was read as a path");
  assert.deepEqual(copySources("COPY --from=builder /app/dist/ ./dist/\n"), [], "a staged source is not in the build context");
  assert.deepEqual(copySources("RUN echo COPY not a copy\n# COPY commented ./\n"), []);
  // The real Dockerfile: the template, the service and the theme directory are all inputs.
  const real = copySources(fs.readFileSync(path.join(ROOT, "builder/Dockerfile"), "utf8"));
  for (const must of ["lovable/template/package.json", "lovable/template", "build-server.mjs", "site-qr-list.mjs", "theme-candidates"]) {
    assert.ok(real.includes(must), `the real Dockerfile's ${must} is not read as an input`);
  }
});

test("imageName is the Worker and the class, lowercased and registry-safe", () => {
  assert.equal(imageName("isibi-app", "SiteBuildContainer"), "isibi-app-sitebuildcontainer");
  assert.equal(imageName("W", "A B"), "w-a-b");
});

test("imageId moves with any input's object and with the input list, and refuses a missing object", () => {
  const a = [{ path: "b/Dockerfile", oid: "a".repeat(40) }, { path: "b/x.mjs", oid: "b".repeat(40) }];
  const id = imageId(a);
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.equal(imageId(a.map((x) => ({ ...x }))), id, "the same inputs give the same id — it is content, not time");
  assert.notEqual(imageId([a[0], { path: "b/x.mjs", oid: "c".repeat(40) }]), id, "a changed source does not change the id");
  assert.notEqual(imageId([{ path: "b/Dockerfile", oid: "d".repeat(40) }, a[1]]), id, "a changed Dockerfile does not change the id");
  assert.notEqual(imageId([a[0]]), id, "an input dropped from the list does not change the id");
  assert.notEqual(imageId([a[1], a[0]]), id, "order is part of the id");
  assert.throws(() => imageId([{ path: "b/x.mjs", oid: null }]), /no git object/);
  assert.throws(() => imageId([{ path: "b/x.mjs", oid: "not-an-oid" }]), /no git object/);
});

test("present asks for the name AND the tag, off Wrangler's own JSON listing", () => {
  const listing = [{ name: "isibi-app-sitebuildcontainer", tags: ["76813f4e3fe90bd7", "old"] }, { name: "other", tags: ["76813f4e3fe90bd7"] }];
  assert.equal(present(listing, "isibi-app-sitebuildcontainer", "76813f4e3fe90bd7"), true);
  assert.equal(present(listing, "isibi-app-sitebuildcontainer", "zzz"), false, "a tag the registry lacks reads as present");
  assert.equal(present(listing, "isibi-app-gamebuildcontainer", "76813f4e3fe90bd7"), false, "another repository's tag reads as ours");
  assert.equal(present(null, "x", "y"), false);
  assert.equal(present([{ name: "x" }], "x", "y"), false);
});

test("rewriteImage replaces exactly one image path with a reference, and refuses zero or two", () => {
  const out = rewriteImage(CONFIG, "./builder/Dockerfile", "isibi-app-sitebuildcontainer:abc");
  assert.match(out, /"image": "isibi-app-sitebuildcontainer:abc"/);
  assert.doesNotMatch(out, /"image": "\.\/builder\/Dockerfile"/);
  assert.match(out, /"image": "\.\/builder-game\/Dockerfile"/, "the other container's path must stay for its own rewrite");
  assert.equal(out.length - CONFIG.length, '"isibi-app-sitebuildcontainer:abc"'.length - '"./builder/Dockerfile"'.length, "something other than the one value moved");
  assert.throws(() => rewriteImage(CONFIG, "./nowhere/Dockerfile", "x:y"), /found 0/);
  assert.throws(() => rewriteImage(CONFIG + '\n"image": "./builder/Dockerfile"', "./builder/Dockerfile", "x:y"), /found 2/);
});

test("containerInputs: the Dockerfile, the dockerignore when there is one, then every COPY source under the context", () => {
  const git = (p) => ({ "b/Dockerfile": "1".repeat(40), "b/.dockerignore": "2".repeat(40), "b/x.mjs": "3".repeat(40), "b/dir": "4".repeat(40) })[p] || null;
  const inputs = containerInputs({ context: "./b/", dockerfileText: "COPY x.mjs ./\nCOPY dir/ ./dir/\n", hasDockerignore: true, git });
  assert.deepEqual(inputs.map((i) => i.path), ["b/Dockerfile", "b/.dockerignore", "b/x.mjs", "b/dir"]);
  const none = containerInputs({ context: "b", dockerfileText: "COPY x.mjs ./\n", hasDockerignore: false, git });
  assert.deepEqual(none.map((i) => i.path), ["b/Dockerfile", "b/x.mjs"]);
  assert.throws(() => containerInputs({ context: "b", dockerfileText: "COPY ghost.mjs ./\n", hasDockerignore: false, git }), /ghost\.mjs, which is not in git/);
});

/* ─────────────────── against this repository, at HEAD ─────────────────── */

test("every input of both real images is a git object at HEAD, and the ids are stable", () => {
  const git = (p) => {
    const r = spawnSync("git", ["rev-parse", "--verify", "-q", `HEAD:${p}`], { cwd: ROOT, encoding: "utf8" });
    const o = String(r.stdout || "").trim();
    return r.status === 0 && /^[0-9a-f]{40,64}$/.test(o) ? o : null;
  };
  const { name, containers } = readContainers(CONFIG);
  for (const c of containers) {
    const ctx = c.context.replace(/^\.\//, "");
    const inputs = containerInputs({ context: ctx, dockerfileText: fs.readFileSync(path.join(ROOT, ctx, "Dockerfile"), "utf8"), hasDockerignore: fs.existsSync(path.join(ROOT, ctx, ".dockerignore")), git });
    assert.ok(inputs.length >= 3, `${c.class_name}: too few inputs (${inputs.length})`);
    assert.ok(inputs[0].path.endsWith("/Dockerfile"), "the Dockerfile itself is the first input");
    assert.equal(imageId(inputs), imageId(inputs));
    // The site image's inputs are the ones the container really carries — a
    // Worker module living in builder/ (site-add.mjs, edit-job.mjs) is NOT one,
    // so a change to it must not rebuild the image.
    if (c.class_name === "SiteBuildContainer") {
      const paths = inputs.map((i) => i.path);
      assert.ok(paths.includes("builder/build-server.mjs") && paths.includes("builder/lovable/template") && paths.includes("builder/.dockerignore"));
      assert.ok(!paths.includes("builder/site-add.mjs") && !paths.includes("builder/edit-job.mjs") && !paths.includes("builder/page-gen.mjs"),
        "a Worker-side module counts as an image input — every Worker push would rebuild the image");
    }
    assert.equal(imageName(name, c.class_name), `isibi-app-${c.class_name.toLowerCase()}`);
  }
});

/* ───────────────────────────── the flow, driven ─────────────────────────── */

function harness({ listing, buildOk = () => true, gitMissing = [] } = {}) {
  const oids = new Map();
  const git = (p) => {
    if (gitMissing.includes(p)) return null;
    if (!oids.has(p)) oids.set(p, (oids.size + 1).toString(16).padStart(40, "0"));
    return oids.get(p);
  };
  const calls = { list: 0, builds: [], writes: [], logs: [] };
  const wrangler = {
    list: () => { calls.list++; return typeof listing === "function" ? listing() : listing; },
    build: (ctx, ref) => { calls.builds.push([ctx, ref]); return buildOk(calls.builds.length, ref); },
  };
  const deps = {
    root: ROOT, git, wrangler, accountId: ACCOUNT,
    log: (s) => calls.logs.push(s),
    write: (p, t) => calls.writes.push([p, t]),
    read: (p) => fs.readFileSync(path.join(ROOT, p), "utf8"),
    exists: (p) => fs.existsSync(path.join(ROOT, p)),
  };
  return { deps, calls };
}

test("an image already in the registry is REUSED: no build, the config references it", async () => {
  // Learn the ids from a first run against an empty registry, then answer them.
  const first = harness({ listing: [] });
  const out1 = await main(first.deps);
  assert.equal(out1.images.length, 2);
  assert.equal(first.calls.builds.length, 2, "an empty registry builds both");
  // The listing's names are stripped of the account prefix, as Wrangler's
  // `handleListImagesCommand` strips them — so the fixture is built off the
  // short tag, the shape the real listing has.
  const known = out1.images.map((i) => ({ name: i.tag.split(":")[0], tags: [i.tag.split(":")[1]] }));

  const { deps, calls } = harness({ listing: known });
  const out = await main(deps);
  assert.equal(calls.builds.length, 0, "an image already there was built again");
  assert.deepEqual(out.images.map((i) => i.action), ["reused", "reused"]);
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.writes[0][0], "wrangler.jsonc");
  const written = calls.writes[0][1];
  for (const i of out.images) assert.match(written, new RegExp(`"image": ${JSON.stringify(i.ref)}`), `${i.ref} not in the written config`);
  assert.doesNotMatch(written, /"image": "\.\/builder/, "a Dockerfile path survived the rewrite — the deploy would build it");
  // THE FULL REFERENCE, under this account's registry (deploy run 2016,
  // 2026-09-04: Wrangler's config validator parses the image as a URL, and a
  // bare `name:tag` is an invalid one — the tag reads as a port).
  for (const i of out.images) {
    assert.match(i.ref, new RegExp(`^registry\\.cloudflare\\.com/${ACCOUNT}/isibi-app-(game|site)buildcontainer:[0-9a-f]{16}$`), `not a full registry reference: ${i.ref}`);
    assert.doesNotThrow(() => new URL(`https://${i.ref}`), "Wrangler's validator would refuse this reference");
    assert.equal(i.tag, i.ref.slice(i.ref.lastIndexOf("/") + 1), "the build tag is not the reference's own name:tag");
  }
});

test("without an account id nothing is asked, built or written — the reference could not name the registry", async () => {
  const { deps, calls } = harness({ listing: [] });
  for (const bad of [undefined, "", "not-an-account-id"]) {
    await assert.rejects(() => main({ ...deps, accountId: bad }), /CLOUDFLARE_ACCOUNT_ID/);
  }
  assert.equal(calls.list + calls.builds.length + calls.writes.length, 0);
});

test("an image the registry lacks is BUILT under its id, from its own context, and pushed", async () => {
  const { deps, calls } = harness({ listing: [{ name: "isibi-app-gamebuildcontainer", tags: ["stale"] }] });
  const out = await main(deps);
  assert.deepEqual(out.images.map((i) => i.action), ["built", "built"]);
  assert.deepEqual(calls.builds.map(([ctx]) => ctx), ["builder-game", "builder"], "the build context is the Dockerfile's directory");
  for (const [, ref] of calls.builds) assert.match(ref, /^isibi-app-(game|site)buildcontainer:[0-9a-f]{16}$/);
  assert.equal(calls.list, 1, "the registry is asked once, before any build");
});

test("a failed build is tried once more; a second failure fails the deploy and writes nothing", async () => {
  const once = harness({ listing: [], buildOk: (n) => n !== 1 });
  const out = await main(once.deps);
  assert.equal(once.calls.builds.length, 3, "the first image's failed build was not retried exactly once");
  assert.equal(out.images.length, 2);
  const never = harness({ listing: [], buildOk: () => false });
  await assert.rejects(() => main(never.deps), /could not build and push/);
  assert.equal(never.calls.writes.length, 0, "a config referencing an image that does not exist was written");
});

test("an input git does not have fails by name BEFORE the registry is asked or anything is built", async () => {
  const { deps, calls } = harness({ listing: [], gitMissing: ["builder/site-qr-list.mjs"] });
  await assert.rejects(() => main(deps), /site-qr-list\.mjs, which is not in git/);
  assert.equal(calls.list + calls.builds.length + calls.writes.length, 0);
});

/* ─────────────────────────────── the wiring ─────────────────────────────── */

test("the deploy runs the step between the queue check and the Wrangler deploy, with the same Wrangler version", () => {
  const queue = WORKFLOW.indexOf("- name: ensure the build queue exists");
  const images = WORKFLOW.indexOf("- name: container images (built only when their inputs changed)");
  const deploy = WORKFLOW.indexOf("- name: Deploy with Wrangler");
  assert.ok(queue > 0 && images > queue && deploy > images, "the image step is not between the queue check and the deploy");
  const step = WORKFLOW.slice(images, deploy);
  assert.match(step, /run: node \.github\/scripts\/container-images\.mjs/);
  assert.match(step, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/, "the step cannot reach the registry");
  assert.match(step, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  const stepVersion = (step.match(/WRANGLER_VERSION: "([^"]+)"/) || [])[1];
  const actionVersion = (WORKFLOW.slice(deploy).match(/wranglerVersion: "([^"]+)"/) || [])[1];
  assert.ok(stepVersion && actionVersion, "one of the two Wrangler versions is missing");
  assert.equal(stepVersion, actionVersion, "the CLI that lists and pushes is not the one that deploys");
  // The script runs Wrangler at exactly that version, and refuses to guess one.
  assert.match(SCRIPT, /`wrangler@\$\{version\}`/);
  assert.match(SCRIPT, /WRANGLER_VERSION is not set/);
  // The account id the reference names is the step's env, never the config's.
  assert.match(SCRIPT, /accountId: process\.env\.CLOUDFLARE_ACCOUNT_ID,/, "the reference cannot name the account");
  assert.match(SCRIPT, /const ref = `\$\{registry\}\/\$\{accountId\}\/\$\{tag\}`;/, "the reference is not registry/account/name:tag");
  assert.doesNotMatch(CONFIG, /registry\.cloudflare\.com/, "an account's registry path is committed in the config");
  // The repository's own config still builds from the Dockerfiles: only the checkout is rewritten.
  assert.match(CONFIG, /"image": "\.\/builder\/Dockerfile"/);
  assert.match(CONFIG, /"image": "\.\/builder-game\/Dockerfile"/);
  // And the action deploys from the rewritten checkout — it must not re-check out.
  assert.equal((WORKFLOW.match(/uses: actions\/checkout@/g) || []).length, 1, "a second checkout would discard the rewrite");
});
