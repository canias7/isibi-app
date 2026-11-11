// ALL OF CLAUDE CODE'S TOOLS ON CODER'S MACHINE (owner, 2026-11-07: "can we
// install all the tools we need?", about: "Claude Code comes with Python, Node,
// Ruby, PHP, Java, Go, Rust, C/C++, Docker, PostgreSQL, Redis, Chrome, gh and
// more"). The image's real build and every tool, tried as Coder's own user, are
// in .github/workflows/check-coder-image.yml (coder/test/machine-tools.sh);
// these check the rest on any computer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, chmod, stat, readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HERE = (p) => new URL("../" + p, import.meta.url);
const read = (p) => readFileSync(HERE(p), "utf8");
const { cleanEnv, SYSTEM_PATH, DEV_HOME } = await import("../container/coder-checks.mjs");
const { execIn, dataDirs } = await import("../container/server.mjs");
const { MACHINE_TOOLS } = await import("../container/coder-agent.mjs");

test("CD133 the AI's commands find every tool and keep what they install in their own home, never the project; a command run as root gets root's own folders only", async () => {
  const dev = cleanEnv("/data/home");
  assert.equal(dev.HOME, "/data/home", "a home of its own, not the project folder");
  const path = dev.PATH.split(":");
  assert.deepEqual(path.slice(0, 4), ["/data/home/.local/bin", "/data/home/.npm-global/bin", "/data/home/.cargo/bin", "/data/home/go/bin"], "its own installs first");
  for (const p of ["/opt/rbenv/shims", "/opt/node22/bin", "/opt/cargo/bin", "/usr/local/go/bin"]) assert.ok(path.includes(p), p);
  assert.ok(dev.PATH.endsWith(":" + SYSTEM_PATH + ":/usr/games:/usr/local/games"), "Ubuntu's own end of a user's PATH (live test: apt's cowsay is in /usr/games)");
  assert.ok(path.indexOf("/opt/node22/bin") < path.indexOf("/usr/local/bin"), "Node 22 first, like Claude Code's machine");
  assert.equal(dev.npm_config_prefix, "/data/home/.npm-global");
  assert.equal(dev.CARGO_HOME, "/data/home/.cargo");
  assert.equal(dev.GOPATH, "/data/home/go");
  assert.equal(dev.PIP_BREAK_SYSTEM_PACKAGES, "1", "pip installs for the user (its home), not the system");
  assert.equal(dev.RBENV_ROOT, "/opt/rbenv");
  assert.equal(dev.CHROME_PATH, "/usr/bin/google-chrome", "like Claude Code's machine");
  assert.equal(dev.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers");
  assert.equal(dev.NODE_PATH, "/opt/node22/lib/node_modules", "require(\"playwright\") from any folder");
  assert.equal(dev.DOCKER_HOST, "unix:///data/home/.docker-run/docker.sock", "dev's own Docker engine");
  assert.equal(cleanEnv().HOME, DEV_HOME);
  assert.equal(DEV_HOME, "/home/dev");
  // (Pass 9: Claude Code's cloud placeholders, "proxy-injected", and git's GIT_CONFIG_KEY_n setting names hold no secret.)
  for (const e of [dev, cleanEnv(null, { root: true })]) assert.deepEqual(Object.entries(e).filter(([k, v]) => /KEY|TOKEN|SECRET/.test(k) && !/^GIT_CONFIG_KEY_\d$/.test(k) && v !== "proxy-injected"), [], "no secrets in reach");
  // ROOT: only root's folders, so a program the AI left in its own folders never runs as root.
  const root = cleanEnv("/data/home", { root: true });
  assert.equal(root.PATH, SYSTEM_PATH);
  assert.equal(root.HOME, "/root");
  assert.deepEqual(Object.keys(root).filter((k) => /npm_config_prefix|CARGO|GOPATH|RBENV|RUSTUP|DOCKER|PIP_/.test(k)), []);
  assert.equal(SYSTEM_PATH, "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
  // execIn: `uid: null` (the setup script's apt lines) runs with root's environment; the AI's commands with their home.
  const dir = await mkdtemp(join(tmpdir(), "coder-env-"));
  const asRoot = await execIn(dir, "printf '%s|%s' \"$PATH\" \"$HOME\"", 10, { uid: null, gid: null });
  assert.equal(asRoot.output, SYSTEM_PATH + "|/root");
  const asDev = await execIn(dir, "printf '%s' \"$HOME\"", 10, { home: "/somewhere/home" });
  assert.equal(asDev.output, "/somewhere/home");
  const inTest = await execIn(dir, "printf '%s' \"$HOME\"", 10, { extraEnv: { PATH: "/evil", HOME: "/evil" } });
  assert.equal(inTest.output, dir, "a machine made in a test, given no home, keeps the project folder; extraEnv never replaces PATH or HOME");
  // The service gives the AI its home: /home/dev, or on Fly.io one on the chat's kept disk.
  const server = read("container/server.mjs");
  assert.match(server, /createApp\(\{ kept: bootKept\(\), gitVia: true, modelVia: true, room: true, sandbox: true, data: process\.env\.CODER_DATA \|\| null, image: process\.env\.CODER_IMAGE_REF \|\| imageId\(\), liveFetch: \(url, init\) => fetch\(url, init\), home: DEV_HOME, \.\.\.dataDirs\(process\.env\.CODER_DATA\), checker: true \}\)/);
  assert.match(server, /const u = await execIn\(dir, userPart, left, \{ bgDir, kill: true, home, /, "the setup script's own part");
  assert.match(server, /const r = await execIn\(dir, command, timeoutS, \{ bgDir, kill: !!tool, home, /, "every command and tool");
  assert.match(server, /const aptRun = apt \|\| \(\(dir, command, timeoutS, o\) => execIn\(dir, command, timeoutS, \{ \.\.\.o, uid: null, gid: null,/);
  const top = await mkdtemp(join(tmpdir(), "coder-data-"));
  const d = dataDirs(join(top, "data"), { setupRoot: join(top, "setup"), owner: null, dev: { uid: process.getuid(), gid: process.getgid() } });
  assert.equal(d.home, join(top, "data", "home"));
  const st = await stat(d.home);
  assert.ok(st.isDirectory());
  assert.equal(st.uid, process.getuid(), "the home is the AI's own");
  assert.equal(st.mode & 0o777, 0o755);
});

test("CD134 the image: Ubuntu 24.04 like Claude Code's machine; the small one by default (Cloudflare), every tool of Claude Code's in the full one (Fly.io); downloads checked; nothing of dev's on root's PATH", async () => {
  const D = read("container/Dockerfile");
  assert.match(D, /^ARG CODER_IMAGE=core$/m, "the default is the small image");
  assert.match(D, /^FROM ubuntu:24\.04 AS core$/m);
  assert.match(D, /^FROM core AS full$/m);
  assert.match(D, /^FROM \$\{CODER_IMAGE\} AS app$/m);
  assert.equal(D.match(/^FROM /gm).length, 7, "core, ruby-build, three Rubies, full, app");
  assert.match(read("wrangler.jsonc"), /"image": "\.\/container\/Dockerfile"/, "Cloudflare's build passes no image name: it gets the small one");
  assert.match(D, /^ENV CODER_IMAGE=full$/m, "the full image says so, so Coder is told its tools");
  // Every tool on Claude Code's list (its docs' "Installed tools", and its machine itself).
  const full = D.slice(D.indexOf("FROM core AS full"));
  const want = {
    python: /uv pytest mypy/, "python tools": /for t in poetry black ruff conan/,
    "node 22": /latest-v22\.x/, "node 24": /latest-v24\.x/, nvm: /nvm-sh\/nvm\/v0\.40\.3\/nvm\.sh/, "js tools": /npm install -g --no-fund --no-audit yarn pnpm bun eslint prettier/,
    ruby: /build-ruby 3\.1\.6 [0-9a-f]{64}[\s\S]*build-ruby 3\.2\.6 [0-9a-f]{64}[\s\S]*build-ruby 3\.3\.6 [0-9a-f]{64}/, rbenv: / rbenv /,
    php: /php-cli/, composer: /composer\.phar/, java: /openjdk-21-jdk-headless/, maven: /apache-maven-\$mv-bin\.tar\.gz/, gradle: /services\.gradle\.org\/versions\/current/,
    go: /go\.dev\/dl\/\?mode=json/, rust: /rustup-init -y --no-modify-path --profile minimal --component rustfmt,clippy/,
    "c/c++": /clang cmake ninja-build/, docker: /docker-ce docker-ce-cli containerd\.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras gh/,
    postgresql: /postgresql postgresql-contrib redis-server/, chrome: /chrome-for-testing\/last-known-good-versions-with-downloads\.json/,
    yq: /mikefarah\/yq\/v4/, everyday: /git-lfs tmux vim nano/,
    extras: /ffmpeg imagemagick poppler-utils pandoc strace lsof valgrind netcat-openbsd xvfb/, "python libraries": /numpy pandas openpyxl python-docx python-pptx pypdf pdfplumber reportlab markitdown requests pillow/,
    playwright: /npm install -g --no-fund --no-audit playwright && npm cache clean --force; \\\n\s+PLAYWRIGHT_BROWSERS_PATH=\/opt\/pw-browsers playwright install --with-deps chromium/, "check-tools": /tools\/docker tools\/check-tools tools\/sudo \/usr\/local\/bin\//,
  };
  for (const [what, re] of Object.entries(want)) assert.match(what === "ruby" || what === "node 22" ? D : full, re, what);
  // Each download is checked against its maker's sum (Chrome's has none published).
  assert.equal((D.match(/sha256sum -c -/g) || []).length, 6, "Node 22, Node 24, Go, Rust, Gradle, Composer");
  assert.equal((D.match(/sha512sum -c -/g) || []).length, 1, "Maven");
  assert.match(read("container/tools/build-ruby"), /echo "\$sum  ruby-\$v\.tar\.gz" \| sha256sum -c -/, "each Ruby");
  for (const f of [D, read("container/tools/build-ruby")]) assert.doesNotMatch(f, /curl -fsSLO? (?!--retry)/, "every download retries");
  // NOTHING OF DEV'S ON ROOT'S PATH: root's PATH is root's folders; what dev owns is never on it, nor linked into it.
  assert.match(D, /^ENV PATH=\/opt\/node22\/bin:\/usr\/local\/sbin:\/usr\/local\/bin:\/usr\/sbin:\/usr\/bin:\/sbin:\/bin$/m);
  assert.equal((D.match(/^ENV PATH=/gm) || []).length, 1);
  const devOwned = [...D.matchAll(/chown -R dev:dev ([^;\n]+)/g)].flatMap((m) => m[1].trim().split(/\s+/));
  assert.deepEqual(devOwned, ["/opt/rustup", "/opt/rbenv", "/opt/ruby-3.1.6", "/opt/ruby-3.2.6", "/opt/ruby-3.3.6"]);
  for (const m of D.matchAll(/ln -s "?([^"\s;]+)"? "?([^"\s;]+)"?/g)) for (const o of ["/opt/rustup", "/opt/rbenv", "/opt/ruby-", "/home/dev"]) assert.ok(!m[1].startsWith(o) || !/^\/usr\/(local\/)?s?bin\//.test(m[2]), m[0]);
  // The image keeps the package lists (the setup script's name check), and asks only Ubuntu afterwards.
  assert.doesNotMatch(D, /rm -rf \/var\/lib\/apt\/lists/);
  assert.match(D, /rm -f \/etc\/apt\/sources\.list\.d\/docker\.list \/etc\/apt\/sources\.list\.d\/github-cli\.list; apt-get update/);
});

test("CD135 the master key's jobs (step 4): sudo lets Coder's commands run one checked program as root, which installs Ubuntu packages and runs installed services, and refuses everything else; the databases start as on Claude Code's machine; Docker runs without admin rights", async () => {
  const sudoers = read("container/tools/coder-admin.sudoers").split("\n").filter((l) => l && !l.startsWith("#"));
  assert.deepEqual(sudoers, ["dev ALL=(root) NOPASSWD: /usr/local/sbin/coder-admin"], "one program, nothing else");
  const D = read("container/Dockerfile");
  assert.match(D, /COPY --chmod=0755 tools\/service tools\/coder-admin tools\/apt-get \/usr\/local\/sbin\/\nCOPY --chmod=0440 tools\/coder-admin\.sudoers \/etc\/sudoers\.d\/coder-admin\nRUN set -eu; visudo -cf \/etc\/sudoers\.d\/coder-admin; cp -p \/usr\/local\/sbin\/apt-get \/usr\/local\/sbin\/apt;/);
  assert.match(D, /printf 'local all all trust\\nhost all all 127\.0\.0\.1\/32 trust\\nhost all all ::1\/128 trust\\n' > \/etc\/postgresql\/16\/main\/pg_hba\.conf/);
  assert.match(D, /su postgres -c "createuser --superuser dev"/);
  // THE CHECKED PROGRAM refuses, before apt or service is ever asked: not a package, an apt option that runs
  // commands, no package, a service name that is a path, an unknown action, a service not installed, any other job.
  const admin = HERE("container/tools/coder-admin").pathname;
  const refused = (...args) => { try { execFileSync("bash", [admin, ...args], { stdio: "pipe", env: { PATH: "/usr/bin:/bin" } }); return false; } catch (e) { return e.status === 2; } };
  for (const args of [["install", "../evil"], ["install", "-oAPT::Update::Pre-Invoke::=touch /tmp/x"], ["install", "-o", "Dpkg::Options::=--force-all", "jq"], ["install"], ["install", "-y"], ["install", "Jq;id"],
    ["service", "../../bin/sh", "start"], ["service", "postgresql", "explode"], ["service", "no-such-service-here", "start"], ["remove", "git"], ["bash"], [], ["purge", "sudo"]]) assert.equal(refused(...args), true, JSON.stringify(args));
  const A = read("container/tools/coder-admin");
  assert.match(A, /^export PATH=\/usr\/sbin:\/usr\/bin:\/sbin:\/bin /m, "its own PATH, never the caller's");
  assert.match(A, /exec apt-get "\$\{apt_opts\[@\]\}" install -y --no-install-recommends "\$\{pkgs\[@\]\}"/);
  assert.match(A, /if \[\[ "\$proxy" =~ \^http:\/\/127\\\.0\\\.0\\\.1:\[0-9\]\{1,5\}\$ \]\]; then apt_opts=/, "apt through the gate when the network is limited");
  // THE COMMANDS CODER TYPES pass only those jobs on (and as root, go straight to the real ones).
  const S = read("container/tools/service"), G = read("container/tools/apt-get"), U = read("container/tools/sudo");
  assert.match(S, /exec \/usr\/bin\/sudo -n \/usr\/local\/sbin\/coder-admin service "\$1" "\$2"/);
  assert.match(G, /install\|update\)[\s\S]*exec \/usr\/bin\/sudo -n \/usr\/local\/sbin\/coder-admin "\$sub" "\$\{args\[@\]\}"/);
  assert.match(G, /remove\|purge\|autoremove\|upgrade\|full-upgrade\|dist-upgrade/);
  assert.match(U, /\[ "\$\(id -u\)" = 0 \] && exec \/usr\/bin\/sudo "\$@"/);
  assert.match(U, /apt-get\|apt\|\/usr\/bin\/apt-get\|\/usr\/bin\/apt\) n=\$\(basename "\$1"\); shift; exec "\/usr\/local\/sbin\/\$n" "\$@"/);
  if (process.getuid() !== 0) {
    // As an ordinary user (never as root here: these would then be real): refused before anything runs.
    const no = (file, ...args) => { try { execFileSync("bash", [HERE("container/tools/" + file).pathname, ...args], { stdio: "pipe" }); return false; } catch (e) { return e.status === 2; } };
    assert.equal(no("sudo", "bash", "-c", "id"), true, "sudo bash");
    assert.equal(no("sudo", "-u", "postgres", "psql"), true, "sudo -u");
    assert.equal(no("apt-get", "remove", "git"), true, "apt-get remove");
    assert.equal(no("apt-get", "-y", "dist-upgrade"), true, "apt-get dist-upgrade");
  }
  // DOCKER: dev's own engine, started by the docker command; never admin's.
  const W = read("container/tools/docker");
  assert.match(W, /^real=\/usr\/bin\/docker$/m);
  assert.match(W, /exec nohup dockerd-rootless\.sh >"\$log" 2>&1/);
  assert.match(W, /export DOCKER_HOST="\$\{DOCKER_HOST:-unix:\/\/\$XDG_RUNTIME_DIR\/docker\.sock\}"/);
  assert.doesNotMatch(W, /sudo|usermod|docker\.sock" *$|\/var\/run\/docker\.sock/);
  assert.match(D, /grep -q '\^dev:' \/etc\/subuid \|\| echo 'dev:100000:65536' >> \/etc\/subuid/);
  assert.doesNotMatch(D, /usermod -aG docker|groupadd docker|gpasswd/, "dev is never in the docker group (that would be admin rights)");
});

test("CD136 the full image is built for Fly.io only, built again only when Coder's machine changes, and checked on GitHub before any deploy; Coder is told its tools there", () => {
  const Y = read("../.github/workflows/deploy-coder.yml");
  assert.match(Y, /docker build --build-arg CODER_IMAGE=full --target full -t "\$base" container/);
  assert.match(Y, /docker build --build-arg CODER_IMAGE="\$base" -t "\$img" container/);
  assert.match(Y, /if docker manifest inspect "\$img" >\/dev\/null 2>&1; then/);
  const C = read("../.github/workflows/check-coder-image.yml");
  assert.match(C, /branches-ignore: \[main\]\n\s+paths:\n\s+- "coder\/container\/\*\*"/);
  assert.match(C, /docker build -t coder:core coder\/container/);
  assert.match(C, /docker build --build-arg CODER_IMAGE=full -t coder:full coder\/container/);
  assert.match(C, /docker run --rm --privileged -v \/tmp\/dev-home:\/home\/dev -v "\$PWD\/coder\/test:\/coder-test:ro" coder:full bash \/coder-test\/machine-tools\.sh/, "dev's home on a plain disk, as on Fly.io");
  assert.match(read("test/machine-tools.sh"), /node \/coder-test\/room-check\.mjs/, "the sealed room, with the real gate (step 3)");
  assert.match(read("../.github/workflows/deploy-coder.yml"), /node --test test\/root-safety\.test\.mjs test\/room\.test\.mjs/, "the deploy runs the room's root-only test");
  assert.doesNotMatch(C, /\$\{\{\s*secrets\./, "it uses no secrets");
  assert.match(C, /permissions:\n\s+contents: read/);
  // The tools are tried with the very environment the service gives the AI's commands.
  const T = read("test/machine-tools.sh");
  assert.match(T, /const \{ cleanEnv \} = await import\('\/app\/coder-checks\.mjs'\);/);
  assert.match(T, /setpriv --reuid=1001 --regid=1001 --clear-groups env -i/);
  for (const s of ["Ruby 3.1, 3.2, 3.3", "Media and documents", "Playwright with its Chromium, from any folder", "Debugging tools", "Docker without admin rights", "PostgreSQL and Redis", "Chrome and chromedriver", "The master key's jobs (step 4)", "...and nothing else", "Java, Maven, Gradle", "Rust", "Go"]) assert.ok(T.includes(s), s);
  // CODER KNOWS ITS TOOLS on the full image.
  for (const w of ["Ubuntu 24.04", "check-tools", "Python 3.12", "uv", "poetry", "pytest", "Node 22", "/opt/node24/bin", "nvm install", "yarn", "pnpm", "bun", "Ruby 3.3", "rbenv local", "PHP 8.3", "Composer", "Java 21", "Maven", "Gradle", "Go.", "Rust", "clippy", "clang", "cmake", "gh (it uses the owner's GitHub login, added by Coder's server, for this chat's own repositories only", "yq", "service postgresql start", "service redis-server start", "psql -d postgres", "Docker and docker compose work without admin rights", "/usr/bin/google-chrome", "--no-sandbox", "your home folder, never in the project", "Playwright", "require(\"playwright\")", "ffmpeg", "ImageMagick", "pdftotext", "pandoc", "pandas", "python-docx", "markitdown", "strace", "valgrind"]) assert.ok(MACHINE_TOOLS.includes(w), w);
  // Made by contextFor (at the start, and from disk again after a job's summary: CD222).
  assert.match(read("container/server.mjs"), /return \(env\.CODER_IMAGE === "full" \? \(t\.box \? MACHINE_ADMIN : MACHINE_TOOLS\) \+ "\\n\\n" : ""\) \+ style \+ /);
  assert.match(read("container/server.mjs"), /const context = contextFor\(notes, /);
});

test("CD154 the docker command sends its engine's downloads to Coder's gate where the engine is: today's engine runs in this machine's own network (gate at 127.0.0.1; GitHub's image check: through 10.0.2.2 it was \"network is unreachable\"); an older one, inside its own (this machine is 10.0.2.2 there); containers may reach this machine either way", async () => {
  const { spawnSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, symlinkSync } = await import("node:fs");
  // Only grep on the way (this computer's own Docker, if any, is never found).
  const tools = mkdtempSync(join(tmpdir(), "coder-dkt-"));
  symlinkSync(spawnSync("bash", ["-c", "command -v grep"], { encoding: "utf8" }).stdout.trim(), join(tools, "grep"));
  const BASH = spawnSync("bash", ["-c", "command -v bash"], { encoding: "utf8" }).stdout.trim();
  const W = readFileSync(HERE("container/tools/docker"), "utf8");
  const block = (W.match(/\n    if \[ -n "\$\{HTTPS_PROXY:-\}\$\{HTTP_PROXY:-\}" \]; then\n[\s\S]*?\n    fi\n/) || [""])[0];
  assert.ok(block, "the proxy part of the engine's start");
  const run = (script, envMore = {}) => {
    const bin = mkdtempSync(join(tmpdir(), "coder-dkr-"));
    if (script !== null) writeFileSync(join(bin, "dockerd-rootless.sh"), script, { mode: 0o755 });
    const r = spawnSync(BASH, ["-c", "set -u\n" + block + 'echo "${HTTPS_PROXY:-}|${http_proxy:-}|${DOCKERD_ROOTLESS_ROOTLESSKIT_DETACH_NETNS:-}|${DOCKERD_ROOTLESS_ROOTLESSKIT_DISABLE_HOST_LOOPBACK:-}"'], { env: { PATH: bin + ":" + tools, ...envMore }, encoding: "utf8" });
    return r.stdout.trim();
  };
  const today = '#!/bin/sh\n: "${DOCKERD_ROOTLESS_ROOTLESSKIT_DETACH_NETNS:=true}"\n';
  const gate = { HTTPS_PROXY: "http://127.0.0.1:40123", HTTP_PROXY: "http://127.0.0.1:40123" };
  assert.equal(run(today, gate), "http://127.0.0.1:40123|http://127.0.0.1:40123|true|false", "today's engine: the gate as it is here");
  assert.equal(run("#!/bin/sh\necho old\n", gate), "http://10.0.2.2:40123|http://10.0.2.2:40123||false", "an older engine: this machine from inside its network");
  assert.equal(run(null, gate), "http://10.0.2.2:40123|http://10.0.2.2:40123||false", "no start script found: the older way");
  // No gate (Full access): nothing set.
  assert.equal(run(today, {}), "|||", "no gate, no change");
});

test("CD155 the Trusted list has Docker Hub's both download sites and gcloud.google.com, as Claude Code's does (GitHub's image check, 2026-11-07: Docker's image files now come from production.cloudfront.docker.com, which the gate refused)", async () => {
  const { hostAllowed, normNetwork, DEFAULT_HOSTS } = await import("../container/coder-secrets.mjs");
  const trusted = normNetwork({ mode: "trusted" });
  for (const h of ["registry-1.docker.io", "auth.docker.io", "production.cloudflare.docker.com", "production.cloudfront.docker.com", "gcloud.google.com"]) {
    assert.ok(DEFAULT_HOSTS.includes(h), h);
    assert.equal(hostAllowed(h, trusted), true, h + " through the gate");
  }
  assert.equal(hostAllowed("evil.cloudfront.net", trusted), false);
});

test("CD156 Trusted is Claude Code's whole default list (owner, 2026-11-07, item 7: the \"www.\" versions were missing): every entry of its docs' list (test/fixtures/claude-code-trusted.txt, 204 entries) is in ours, and ours adds only four Linux and Go hosts", async () => {
  const { DEFAULT_HOSTS, hostAllowed, normNetwork } = await import("../container/coder-secrets.mjs");
  const cc = readFileSync(HERE("test/fixtures/claude-code-trusted.txt"), "utf8").split("\n").filter(Boolean);
  assert.equal(cc.length, 204);
  const missing = cc.filter((h) => !DEFAULT_HOSTS.includes(h));
  assert.deepEqual(missing, [], "missing from Trusted: " + missing.join(" "));
  assert.deepEqual(DEFAULT_HOSTS.filter((h) => !cc.includes(h)).sort(), ["deb.debian.org", "go.dev", "security.debian.org", "sh.rustup.rs"]);
  assert.equal(new Set(DEFAULT_HOSTS).size, DEFAULT_HOSTS.length, "no entry twice");
  const trusted = normNetwork({ mode: "trusted" });
  for (const h of ["www.github.com", "www.nodejs.org", "www.pypi.org", "www.rust-lang.org", "claude.ai", "api.anthropic.com", "www.anthropic.com"]) assert.equal(hostAllowed(h, trusted), true, h);
  assert.equal(hostAllowed("www.example.com", trusted), false);
});

test("CD163 every module Coder's service loads, directly or through another, is copied into the image (a new one left out would stop the machine at its start)", () => {
  const D = readFileSync(HERE("container/Dockerfile"), "utf8");
  const line = (D.match(/^COPY package\.json server\.mjs ([^\n]*) \.\/$/m) || [])[1] || "";
  const copied = new Set(["server.mjs", ...line.split(/\s+/)]);
  const seen = new Set(), todo = ["server.mjs"];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(HERE("container/" + f), "utf8");
    for (const m of src.matchAll(/(?:from\s+|import\(\s*)["']\.\/([\w.-]+\.mjs)["']/g)) todo.push(m[1]);
    for (const m of src.matchAll(/new URL\(\s*["']\.\/([\w.-]+\.(?:mjs|sh))["']/g)) todo.push(m[1]);
  }
  const missing = [...seen].filter((f) => !copied.has(f));
  assert.deepEqual(missing, [], "not in the image: " + missing.join(" "));
  assert.ok(seen.has("coder-security.mjs") && seen.has("coder-globs.mjs") && seen.has("coder-sandbox-init.sh"));
});
