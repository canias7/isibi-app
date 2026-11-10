// FASTER DEPLOYS (owner, 2026-11-10: "yea do that lol, do it from now on"): the machine's
// tools are built once and kept on Fly.io; a deploy that changes only Coder's own files
// builds just the Dockerfile's last stage on top of them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = new URL("../../", import.meta.url).pathname;
const read = (p) => readFileSync(root + p, "utf8");

test("CD376 faster deploys: the tools image is named after what it is built from (the Dockerfile up to Coder's own stage, container/tools, the month), so it is built again only when those change; Coder's own files are not in its name", () => {
  const y = read(".github/workflows/deploy-coder.yml");
  const D = read("coder/container/Dockerfile");
  // The name's line from the deploy, run the way the deploy runs it (in coder/), with the month given.
  const line = y.match(/^\s+(base="registry\.fly\.io\/\$FLY_APP:coder-tools-[^\n]*)$/m)[1];
  const name = (month) => execFileSync("bash", ["-eo", "pipefail", "-c", "date() { echo " + month + "; }\n" + line + '\necho "$base"'], { cwd: root + "coder", env: { ...process.env, FLY_APP: "app-x" } }).toString().trim();
  // What it is made from.
  const at = D.search(/^FROM \$\{CODER_IMAGE\} AS app$/m);
  assert.ok(at > 0, "Coder's own stage starts FROM the image it is given");
  const cut = D.slice(0, at);
  assert.match(cut, /^FROM core AS full$/m, "every tool's stage is in the name");
  assert.doesNotMatch(cut, /server\.mjs|coder-agent\.mjs/, "Coder's own files are not: changing them keeps the tools");
  const tools = execFileSync("git", ["rev-parse", "HEAD:coder/container/tools"], { cwd: root }).toString().trim();
  const want = (month) => "registry.fly.io/app-x:coder-tools-" + createHash("sha256").update(cut + tools + "\n" + month + "\n").digest("hex").slice(0, 12);
  assert.equal(name("2026-11"), want("2026-11"));
  assert.notEqual(name("2026-12"), name("2026-11"), "built again once a month, to stay fresh");
  // Nothing else goes into the tools: before Coder's stage, files come only from container/tools.
  assert.doesNotMatch(cut, /^ADD |--mount=/m);
  let copies = 0;
  for (const m of cut.matchAll(/^COPY (?:--\S+ )*(.+) \S+$/gm)) {
    if (/--from=/.test(m[0])) continue;
    copies++;
    for (const src of m[1].split(/\s+/)) assert.match(src, /^tools\//, m[0]);
  }
  assert.ok(copies >= 3, "the tools' own files are copied in (and checked above)");
  // Coder's own stage is the last one, and the deploy builds it on the tools image.
  assert.match(D, /^ARG CODER_IMAGE=core$/m);
  assert.doesNotMatch(D.slice(at + 1), /^FROM /m, "Coder's own stage is the last one");
  assert.match(y, /docker build --build-arg CODER_IMAGE=full --target full -t "\$base" container\n/);
  assert.match(y, /docker build --build-arg CODER_IMAGE="\$base" -t "\$img" container /);
});
