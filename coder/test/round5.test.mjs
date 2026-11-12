// ROUND 5 OF THE LIVE TEST (2026-11-12, the owner: "Ok yes"): what the inventory of the bash tool found, and what the
// round itself finds, each fixed and kept fixed here.
import { test } from "node:test";
import assert from "node:assert/strict";

const S = await import("../container/server.mjs");

test("CD523 the low-memory warning sees the commands' memory cap on cgroup v1 too (Coder's Fly.io machines, live: \"8:memory:/coder-bash-…\"), as on v2; no cap (v2's \"max\", v1's huge number) leaves the machine's figure", () => {
  const meminfo = "MemTotal: 16000000 kB\nMemAvailable: 8000000 kB\n";
  const files = (map) => (f) => {
    if (f === "/proc/meminfo") return meminfo;
    const name = Object.keys(map).find((n) => f.endsWith("/" + n));
    if (name === undefined) throw Object.assign(new Error("ENOENT: " + f), { code: "ENOENT" });
    return map[name];
  };
  const v1 = "/sys/fs/cgroup/memory/coder-bash-x", v2 = "/sys/fs/cgroup/coder-bash-x";
  // v1 (the live machines): a 2 GB cap with 1.5 GB used leaves 0.5 GB, less than the machine's 7.6 GB.
  assert.equal(S.memAvailable(v1, files({ "memory.limit_in_bytes": "2147483648\n", "memory.usage_in_bytes": "1610612736\n" })), 512 * 1024 ** 2);
  // v2, as before.
  assert.equal(S.memAvailable(v2, files({ "memory.max": "4294967296\n", "memory.current": "1073741824\n" })), 3 * 1024 ** 3);
  // No cap: the machine's figure.
  assert.equal(S.memAvailable(v1, files({ "memory.limit_in_bytes": "9223372036854771712\n", "memory.usage_in_bytes": "1073741824\n" })), 8000000 * 1024);
  assert.equal(S.memAvailable(v2, files({ "memory.max": "max\n", "memory.current": "1073741824\n" })), 8000000 * 1024);
  // A v2 cgroup is never read with v1's names: its "max" means no cap, not a missing file.
  assert.equal(S.memAvailable(v2, files({ "memory.max": "max\n", "memory.current": "1\n", "memory.limit_in_bytes": "1024\n", "memory.usage_in_bytes": "0\n" })), 8000000 * 1024);
  // Neither pair readable: the machine's figure.
  assert.equal(S.memAvailable(v1, files({})), 8000000 * 1024);
  // A little over the cap (v1 can read so): nothing left.
  assert.equal(S.memAvailable(v1, files({ "memory.limit_in_bytes": "1073741824\n", "memory.usage_in_bytes": "1073750000\n" })), 0);
  // The cap alone when the machine's figure can't be read.
  assert.equal(S.memAvailable(v1, (f) => { if (f === "/proc/meminfo") throw new Error("no"); return f.endsWith("limit_in_bytes") ? "2147483648" : f.endsWith("usage_in_bytes") ? "0" : (() => { throw new Error("ENOENT"); })(); }), 2 * 1024 ** 3);
});

test("CD524 a picture smaller than Grok takes (under 8 pixels a side or 512 in all: live, xAI refused a 1x1 and an 8x8 and the whole turn ended) is enlarged, each pixel a block, with a white margin where a side is still short; read says its real size and that it was enlarged", async () => {
  const T = await import("../container/coder-tools.mjs");
  assert.equal(T.PIC_MIN_SIDE, 8);
  assert.equal(T.PIC_MIN_PIXELS, 512);
  assert.deepEqual(T.picMinFit(1, 1), { scale: 23, w: 23, h: 23 });
  assert.deepEqual(T.picMinFit(8, 8), { scale: 3, w: 24, h: 24 });
  assert.deepEqual(T.picMinFit(20, 20), { scale: 2, w: 40, h: 40 });
  assert.deepEqual(T.picMinFit(100, 1), { scale: 8, w: 800, h: 8 });
  assert.deepEqual(T.picMinFit(2000, 1), { scale: 1, w: 2000, h: 8 }, "at the size limit: a margin instead");
  for (const [w, h] of [[32, 16], [8, 64], [23, 23], [1000, 800]]) assert.equal(T.picMinFit(w, h), null, w + "x" + h + " fits as it is");
  assert.equal(T.picMinFit(0, 5), null);
  // With ImageMagick (as Coder's machine has it): a 1x1 and an 8x8 PNG come out 23x23 and 24x24, and read says so.
  const { execFileSync, spawnSync } = await import("node:child_process");
  if (spawnSync("sh", ["-c", "command -v convert"], { stdio: "ignore" }).status !== 0) return;
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const png = (w, h) => execFileSync("convert", ["-size", w + "x" + h, "xc:red", "png:-"]);
  for (const [w, h, W, H] of [[1, 1, 23, 23], [8, 8, 24, 24], [100, 1, 800, 8]]) {
    const p = await T.asPicture(png(w, h), "png");
    assert.equal(p.why, undefined, w + "x" + h);
    assert.deepEqual([p.w, p.h], [W, H], w + "x" + h + " shown as " + W + "x" + H);
  }
  const dir = await mkdtemp(join(tmpdir(), "coder-tiny-"));
  await writeFile(join(dir, "tiny.png"), png(1, 1));
  const tools = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const out = execFileSync("node", ["--no-warnings", tools, Buffer.from(JSON.stringify({ tool: "read", args: { path: "tiny.png" } })).toString("base64")], { cwd: dir }).toString();
  const j = JSON.parse(out.slice(T.PICS_MARK.length));
  assert.match(j.text, /^Picture: tiny\.png \(1×1, PNG, \d+ KB\), shown to you as a picture after these results, enlarged to 23×23 because Grok takes no picture under 8 pixels a side or 512 in all: each pixel became a block, with a white margin where a side was still short\.$/);
  assert.equal(j.pictures.length, 1);
});

test("CD525 a picture the owner attaches that is smaller than Grok takes is enlarged on Coder's machine before it goes to Grok, with a note saying so (round 5: xAI refused it and the turn ended); one that fits goes as it is, untouched; one that can't be enlarged is left out, with a note", async () => {
  const A = await import("../container/coder-agent.mjs");
  const T = await import("../container/coder-tools.mjs");
  // A 1x1 PNG's header (picSize reads only the header).
  const head = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0); b.writeUInt32BE(13, 8); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b.toString("base64"); };
  let asked = 0;
  const big = { type: "image/png", data: head(640, 480) };
  let r = await A.fitOwnerPics([big], async () => { asked++; return "{}"; });
  assert.equal(asked, 0, "a picture that fits is not touched");
  assert.deepEqual(r, { send: [big], notes: [] });
  r = await A.fitOwnerPics([{ type: "image/png", data: head(1, 1) }, big], async (x) => { asked++; return JSON.stringify({ type: "image/png", data: "QUJD", w: 23, h: 23, from: { w: 1, h: 1 } }); });
  assert.equal(asked, 1);
  assert.deepEqual(r.send, [{ type: "image/png", data: "QUJD" }, big]);
  assert.equal(r.notes.length, 1);
  assert.match(r.notes[0], /^the owner's picture 1 \(1×1 pixels\) is smaller than Grok takes \(at least 8 pixels a side and 512 in all\), so you get it enlarged to 23×23: each pixel became a block, with a white margin where a side was still short\.$/);
  r = await A.fitOwnerPics([{ type: "image/png", data: head(4, 4) }], async () => JSON.stringify({ why: "this machine has no ImageMagick to enlarge it" }));
  assert.deepEqual(r.send, [], "one that can't be enlarged is not sent to Grok");
  assert.match(r.notes[0], /^the owner's picture \(4×4 pixels\) is smaller than Grok takes .* and this machine has no ImageMagick to enlarge it, so it is not attached for you\.$/);
  r = await A.fitOwnerPics([{ type: "image/png", data: head(4, 4) }], async () => { throw new Error("no machine"); });
  assert.deepEqual(r.send, [], "the machine not answering: left out, not the turn ended");
  assert.match(r.notes[0], / and could not be enlarged, so it is not attached for you\.$/);
  // The picture types Coder takes, sized from their headers: GIF and WebP too.
  const gif = Buffer.concat([Buffer.from("GIF89a\x02\x00\x03\x00\x00\x00\x00", "latin1"), Buffer.alloc(20)]);
  assert.deepEqual(T.picSize(gif), { w: 2, h: 3 });
  const vp8l = Buffer.alloc(30); vp8l.write("RIFF", 0, "latin1"); vp8l.write("WEBPVP8L", 8, "latin1"); vp8l[20] = 0x2f; vp8l.writeUInt32LE(((5 - 1) << 14) | (7 - 1), 21);
  assert.deepEqual(T.picSize(vp8l), { w: 7, h: 5 });
  const vp8x = Buffer.alloc(30); vp8x.write("RIFF", 0, "latin1"); vp8x.write("WEBPVP8X", 8, "latin1"); vp8x[24] = 9; vp8x[27] = 2;
  assert.deepEqual(T.picSize(vp8x), { w: 10, h: 3 });
  // The machine's own tool, with ImageMagick: a 1x1 PNG comes back 23x23; a GIF comes back a PNG; one that fits, `same`.
  const { execFileSync, spawnSync } = await import("node:child_process");
  if (spawnSync("sh", ["-c", "command -v convert"], { stdio: "ignore" }).status !== 0) return;
  const pic = (w, h, kind) => execFileSync("convert", ["-size", w + "x" + h, "xc:blue", kind + ":-"]).toString("base64");
  let j = JSON.parse(await T.toolFitPicture({ type: "image/png", data: pic(1, 1, "png") }));
  assert.deepEqual([j.type, j.w, j.h, j.from], ["image/png", 23, 23, { w: 1, h: 1 }]);
  j = JSON.parse(await T.toolFitPicture({ type: "image/gif", data: pic(2, 3, "gif") }));
  assert.deepEqual([j.type, j.w, j.h], ["image/png", 20, 30]);
  j = JSON.parse(await T.toolFitPicture({ type: "image/jpeg", data: pic(6, 6, "jpeg") }));
  assert.equal(j.type, "image/jpeg");
  assert.ok(j.w >= 8 && j.h >= 8 && j.w * j.h >= 512, j.w + "x" + j.h);
  j = JSON.parse(await T.toolFitPicture({ type: "image/png", data: pic(40, 40, "png") }));
  assert.equal(j.same, true);
  // And through the tools script, as the agent asks for it (the fit_picture tool).
  const tools = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const out = execFileSync("node", ["--no-warnings", tools, Buffer.from(JSON.stringify({ tool: "fit_picture", args: { type: "image/png", data: pic(8, 8, "png") } })).toString("base64")]).toString();
  j = JSON.parse(out);
  assert.deepEqual([j.w, j.h], [24, 24]);
});

test("CD526 a monitor's end says its own time as Claude Code writes it: \"expired after 20s\" for a 20-second watch (round 5: it said \"1m\")", async () => {
  const A = await import("../container/coder-agent.mjs");
  const said = (ms, events) => A.monitorSaid({ id: "m1", desc: "watch", lines: [], end: { why: "limit", events, ms } });
  assert.match(said(20_000, 0), /expired after 20s with no events delivered/);
  assert.match(said(5_400_000, 3), /expired after 1h 30m with 3 events delivered\. Re-arm it if you still need the watch\./);
  assert.match(said(300_000, 1), /expired after 5m with 1 event delivered\./);
  assert.match(said(90_000, 0), /expired after 1m 30s with/);
  assert.match(said(0, 2), /expired with 2 events delivered\./, "no time known: none said");
});

test("CD527 a Monitor rule's card names the owner's rule as written (round 5: \"Your rule Bash asks first\" for the rule `ask: Monitor`); the deny sentence stays Claude Code's, which says Bash; the owner's own Bash rule is not renamed", async () => {
  const P = await import("../container/coder-perms.mjs");
  const decide = (rules, command, input = {}) => {
    const r = P.monitorRules(rules, "acceptEdits");
    return P.namedForMonitor(P.bashDecision(command, { mode: "acceptEdits", rules: r, cwd: "/w", workdirs: ["/w"], input: { command, ...input }, settings: P.MONITOR_SETTINGS }), r);
  };
  let d = decide({ allow: [], ask: ["Monitor"], deny: [] }, "echo hi");
  assert.equal(d.verdict, "ask");
  assert.equal(d.rule, "Monitor");
  assert.equal(d.why, "Your rule Monitor asks first for this command.");
  d = decide({ allow: [], ask: ["Monitor(echo:*)"], deny: [] }, "echo hi");
  assert.equal(d.why, "Your rule Monitor(echo:*) asks first for this command.");
  d = decide({ allow: [], ask: [], deny: ["Monitor(timeout_ms:*)"] }, "echo hi", { timeout_ms: 5000 });
  assert.equal(d.verdict, "deny");
  assert.equal(d.rule, "Monitor(timeout_ms:*)");
  assert.equal(d.why, "Permission to use Bash with command echo hi has been denied.", "Claude Code's own deny sentence");
  // The owner's own Bash rule, the same as a turned Monitor rule: either may have matched, so it is left as it is.
  d = decide({ allow: [], ask: ["Monitor", "Bash"], deny: [] }, "echo hi");
  assert.equal(d.why, "Your rule Bash asks first for this command.");
  // Not a monitor: nothing to rename.
  const plain = { allow: [], ask: ["Bash"], deny: [] };
  assert.equal(P.namedForMonitor(P.bashDecision("echo hi", { mode: "acceptEdits", rules: plain, cwd: "/w", workdirs: ["/w"], input: { command: "echo hi" } }), plain).why, "Your rule Bash asks first for this command.");
  assert.equal(P.namedForMonitor({ verdict: "allow" }, { named: {} }).verdict, "allow");
});

test("CD528 GitHub busy or away for a moment (round 5: a 429 ended the whole turn before Grok started): tried again; still away with the chat's copy on its branch, the turn goes on with that copy and the chat says so; a new chat, another branch or a real refusal still ends it; the push at the end is tried again too", async () => {
  const S = await import("../container/server.mjs");
  const http = await import("node:http");
  const { spawn, execFileSync } = await import("node:child_process");
  const { mkdtemp, writeFile, readFile, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  // The words: busy (tried again, then the copy) or a real refusal (not).
  for (const s of ["fatal: unable to access 'https://coder.gofarther.dev/api/coder/git/a/b.git/': The requested URL returned error: 429", "The requested URL returned error: 502", "fatal: unable to access 'x': Could not resolve host: github.com", "error: RPC failed; curl 56 Recv failure: Connection reset by peer", "fatal: early EOF"]) assert.equal(S.gitBusy(s), true, s);
  for (const s of ["The requested URL returned error: 403", "The requested URL returned error: 404", "remote: Repository not found.", "fatal: could not read Username", ""]) assert.equal(S.gitBusy(s), false, s);
  assert.equal(S.gitAway("fatal: unable to access 'x': The requested URL returned error: 429"), "429, too many requests");
  assert.equal(S.gitAway("The requested URL returned error: 503"), "503, a problem on GitHub's side");
  assert.equal(S.gitAway("fatal: unable to access 'x': Could not resolve host: github.com\n"), "unable to access 'x': Could not resolve host: github.com");
  assert.deepEqual(S.GIT_NET_WAITS, [2000, 6000]);
  // "GitHub": git's own web server over a bare ana/shop, which can be made to answer 429, 503 or 403.
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
  const top = await mkdtemp(join(tmpdir(), "coder-gh429-")), seed = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(seed, "init", "-q", "-b", "main");
  await writeFile(join(seed, "README.md"), "# shop\n");
  git(seed, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(seed, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  await mkdir(join(top, "ana"));
  execFileSync("git", ["clone", "-q", "--bare", seed, join(top, "ana", "shop.git")]);
  const gh = { busy: 0, always: 0, asked: 0 };
  const srv = http.createServer((req, res) => {
    gh.asked++;
    if (gh.always) { res.writeHead(gh.always); return res.end("no"); }
    if (gh.busy > 0) { gh.busy--; res.writeHead(429); return res.end("too many requests"); }
    const u = new URL(req.url, "http://x");
    const p = spawn("/usr/lib/git-core/git-http-backend", [], { env: { PATH: process.env.PATH, GIT_PROJECT_ROOT: top, GIT_HTTP_EXPORT_ALL: "1", PATH_INFO: u.pathname, QUERY_STRING: u.search.slice(1), REQUEST_METHOD: req.method, CONTENT_TYPE: req.headers["content-type"] || "", HTTP_CONTENT_ENCODING: req.headers["content-encoding"] || "", GIT_PROTOCOL: req.headers["git-protocol"] || "", REMOTE_USER: "ana", REMOTE_ADDR: "127.0.0.1" } });
    req.pipe(p.stdin);
    const out = [];
    p.stdout.on("data", (c) => out.push(c));
    p.on("close", () => {
      const all = Buffer.concat(out), at = all.indexOf("\r\n\r\n");
      const headers = {}; let status = 200;
      for (const line of all.subarray(0, at).toString().split("\r\n")) { const i = line.indexOf(":"); const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim(); if (k === "status") status = parseInt(v, 10); else headers[k] = v; }
      res.writeHead(status, headers); res.end(all.subarray(at + 4));
    });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  try {
    const remote = "http://127.0.0.1:" + srv.address().port + "/";
    const root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));
    const dir = join(root, "shop-a429");
    const o = { dir, repo: "ana/shop", base: "main", branch: "coder/shop-a429", token: "", remote, gitRoot, root, netWaits: [5, 5] };
    // A new chat, GitHub busy once: tried again, cloned.
    gh.busy = 1;
    let p = await S.prepareRepo(o);
    assert.equal(p.ok, true, p.why);
    assert.equal(p.note, undefined);
    assert.equal(await readFile(join(dir, "README.md"), "utf8"), "# shop\n");
    // Coder's work on the chat's branch, pushed at the end with GitHub busy once: tried again, pushed.
    await writeFile(join(dir, "fix.js"), "x\n");
    gh.busy = 1;
    const pushed = await S.pushRepo({ dir, repo: "ana/shop", branch: "coder/shop-a429", message: "Fix", token: "", remote, gitRoot, root, netWaits: [5, 5] });
    assert.equal(pushed.ok, true, pushed.why);
    assert.match(git(join(top, "ana", "shop.git"), "ls-tree", "--name-only", "coder/shop-a429"), /^fix\.js$/m);
    // The next turn with GitHub answering 429 every time: tried three times, then the chat's copy, with the note.
    await writeFile(join(dir, "wip.txt"), "kept\n");
    gh.always = 429; gh.asked = 0;
    p = await S.prepareRepo(o);
    assert.equal(p.ok, true, p.why);
    assert.equal(p.note, "GitHub did not answer (429, too many requests), so Coder works from this chat's copy on its machine, as the last message left it. Its work is pushed to GitHub at the end, as always.");
    assert.equal(gh.asked, 3, "asked three times");
    assert.equal(await readFile(join(dir, "wip.txt"), "utf8"), "kept\n", "the copy as it was");
    assert.equal(git(dir, "rev-parse", "--abbrev-ref", "HEAD").trim(), "coder/shop-a429");
    // GitHub's server down (503): the same.
    gh.always = 503;
    p = await S.prepareRepo(o);
    assert.equal(p.ok, true, p.why);
    assert.match(p.note, /^GitHub did not answer \(503, a problem on GitHub's side\)/);
    // A real refusal (403) is not "busy": the turn ends, asked once.
    gh.always = 403; gh.asked = 0;
    p = await S.prepareRepo(o);
    assert.equal(p.ok, false);
    assert.match(p.why, /^could not reach ana\/shop on GitHub: .*403/);
    assert.equal(gh.asked, 1);
    // Another branch than the copy's: no copy of it to go on with.
    gh.always = 429;
    p = await S.prepareRepo({ ...o, branch: "coder/shop-other" });
    assert.equal(p.ok, false);
    assert.match(p.why, /^could not reach ana\/shop on GitHub: .*429/);
    // A new chat with GitHub away: nothing to go on with.
    p = await S.prepareRepo({ ...o, dir: join(root, "shop-b429"), branch: "coder/shop-b429" });
    assert.equal(p.ok, false);
    assert.match(p.why, /^could not reach ana\/shop on GitHub: .*429/);
    // GitHub back: the turn fetches as before, no note.
    gh.always = 0;
    p = await S.prepareRepo(o);
    assert.equal(p.ok, true, p.why);
    assert.equal(p.note, undefined);
  } finally { await new Promise((ok) => srv.close(ok)); }
});

test("CD529 working folders are looked up where Coder's commands run (round 5: `/tmp/r40-extra`, made by a command in the sandbox, was left out without a word, since the machine's own /tmp has none); one that is not there is said in the chat; the folder a cd left is checked there too", async () => {
  const S = await import("../container/server.mjs");
  const { mkdtemp, mkdir, symlink, writeFile, realpath } = await import("node:fs/promises");
  const { spawnSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  // The sandbox's own lookup, run here with plain bash: links followed, folders only, odd names kept whole, each answer in its place.
  const top = await realpath(await mkdtemp(join(tmpdir(), "coder-box-")));
  await mkdir(join(top, "a b'c"), { recursive: true });
  await mkdir(join(top, "real"));
  await symlink(join(top, "real"), join(top, "link"));
  await writeFile(join(top, "file.txt"), "x");
  const bash = async (script) => spawnSync("bash", ["-c", script]).stdout.toString();
  const got = await S.boxRealDirs(null, [join(top, "a b'c"), join(top, "link"), join(top, "file.txt"), join(top, "nope"), "relative", join(top, "bad\nname"), join(top, "real") + "/"], { exec: bash });
  assert.deepEqual(got, [join(top, "a b'c"), join(top, "real"), "", "", "", "", join(top, "real")]);
  assert.deepEqual(await S.boxRealDirs(null, ["x", ""], { exec: bash }), ["", ""], "nothing to look up: no script run");
  assert.deepEqual(await S.boxRealDirs(null, [join(top, "real")]), [""], "no sandbox: nothing found, never the machine's view by mistake");
  // extraDirsOf with the sandbox's view (`seen`): the sandbox's /tmp folder is found though the machine has none; one not
  // there anywhere is in `missing`, as written; `..`, a relative path and "/" are refused as before, unsaid.
  const box = { "/tmp/r40-extra": "/tmp/r40-extra", "/home/dev/r40-extra": "/home/dev/r40-extra", "/": "/" };
  const seen = async (paths) => paths.map((p) => box[p] || "");
  const out = await S.extraDirsOf(["/tmp/r40-extra", "~/r40-extra", "/tmp/r40-gone", "../x", "rel", "/", "/tmp/r40-extra"], "/home/dev", { seen });
  assert.deepEqual([...out], ["/tmp/r40-extra", "/home/dev/r40-extra"]);
  assert.deepEqual(out.missing, ["/tmp/r40-gone"]);
  // Without a sandbox: the machine's view, as before (and `missing` the same way).
  const here = await S.extraDirsOf([join(top, "link"), join(top, "file.txt"), join(top, "nope")], "/home/dev");
  assert.deepEqual([...here], [join(top, "real")]);
  assert.deepEqual(here.missing, [join(top, "file.txt"), join(top, "nope")]);
  // The note in the chat.
  assert.equal(S.missingDirsSaid(["/tmp/r40-gone"], "your rules", true), "The working folder /tmp/r40-gone (your rules) is not used in this message: it is not a folder where Coder's commands run (their sandbox, whose /tmp is its own).");
  assert.equal(S.missingDirsSaid(["/a", "~/b"], "this repository's .claude/settings.json"), "The working folders /a, ~/b (this repository's .claude/settings.json) are not used in this message: they are not folders where Coder's commands run.");
  assert.equal(S.missingDirsSaid([], "your rules"), "");
  // A cd into the sandbox's /tmp folder carries over: checked in the sandbox's view.
  const roots = ["/home/dev/projects/shop", "/tmp/r40-extra"];
  assert.equal(await S.cwdInside("/tmp/r40-extra", roots, { seen }), "/tmp/r40-extra");
  assert.equal(await S.cwdInside("/tmp/r40-gone", roots, { seen }), "");
  assert.equal(await S.cwdInside("/home/dev/r40-extra", roots, { seen }), "", "a folder outside the working folders");
  assert.equal(await S.cwdInside(join(top, "link"), [join(top, "real")]), join(top, "real"), "no sandbox: the machine's view, as before");
});

test("CD530 with Stop's choice off, the admin sandbox stays while what the stopped command left running is still in it (round 5: the stopped command was the last one, and the sandbox was ended with `setsid sleep 7001` in it); with none of them left, it goes as before", async () => {
  const S = await import("../container/server.mjs");
  const procs = new Map([[101, { pgrp: 101 }], [102, { pgrp: 102 }], [103, { pgrp: 103 }]]);
  const marks = { 101: "", 102: "aaaaaaaaaaaaaaaa", 103: "bbbbbbbbbbbbbbbb" };
  const o = { look: () => procs, read: (pid) => marks[pid] || "" };
  assert.equal(S.keptInBox(["aaaaaaaaaaaaaaaa"], o), true, "its process is still there");
  assert.equal(S.keptInBox(new Set(["bbbbbbbbbbbbbbbb", "cccccccccccccccc"]), o), true);
  assert.equal(S.keptInBox(["cccccccccccccccc"], o), false, "gone: the sandbox may go");
  assert.equal(S.keptInBox([], o), false, "nothing kept");
  assert.equal(S.keptInBox(["", null], o), false);
  // The sweep keeps the sandbox for them (quietly), and spares their processes (keepMarks), as for a running command's own.
  const { readFile } = await import("node:fs/promises");
  const server = await readFile(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const boxKept = BOX && \(live\.some\(\(j\) => j\.box\) \|\| keptInBox\(kept\)\) \? BOX : null;/);
  assert.match(server, /keepMarks: new Set\(\[\.\.\.live\.map\(\(j\) => j\.mark\)\.filter\(Boolean\), \.\.\.kept\]\)/);
});

test("CD531 Maven downloads through Coder's gate (round 5: it could download nothing, as Maven 3.9's resolver ignores Java's proxy settings unless told otherwise, and Coder's sealed network has no other way out)", async () => {
  const PX = await import("../container/coder-proxy.mjs");
  const t = PX.toolProxyEnv("http://127.0.0.1:4567", 4567, "localhost,127.0.0.1", "", "/srv/b.pem", "");
  assert.match(t.JAVA_TOOL_OPTIONS, / -Daether\.connector\.http\.useSystemProperties=true$/);
  // For real, where Maven is: its first download goes to the proxy Java's settings name (a stand-in that refuses it).
  const { spawnSync, spawn } = await import("node:child_process");
  if (spawnSync("sh", ["-c", "command -v mvn"], { stdio: "ignore" }).status !== 0) return;
  const http = await import("node:http");
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const seen = [];
  const srv = http.createServer((req, res) => { seen.push(req.method + " " + req.url); res.writeHead(403); res.end(); });
  srv.on("connect", (req, sock) => { seen.push("CONNECT " + req.url); sock.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n"); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  try {
    const port = srv.address().port;
    const dir = await mkdtemp(join(tmpdir(), "coder-mvn-"));
    await writeFile(join(dir, "settings.xml"), "<settings/>");
    const env = { PATH: process.env.PATH, HOME: dir, JAVA_TOOL_OPTIONS: PX.toolProxyEnv("http://127.0.0.1:" + port, port, "localhost", "", "", "").JAVA_TOOL_OPTIONS };
    const code = await new Promise((done) => { const p = spawn("mvn", ["-B", "-q", "-s", join(dir, "settings.xml"), "-Dmaven.repo.local=" + join(dir, "repo"), "help:help"], { cwd: dir, env, stdio: "ignore" }); const k = setTimeout(() => p.kill("SIGKILL"), 120_000); p.on("close", (c) => { clearTimeout(k); done(c); }); });
    assert.notEqual(code, 0, "the stand-in refused it");
    assert.ok(seen.some((s) => /^CONNECT repo\.maven\.apache\.org:443$/.test(s)), "Maven asked the gate: " + JSON.stringify(seen.slice(0, 3)));
  } finally { await new Promise((ok) => srv.close(ok)); }
});

test("CD532 the owner's /compact runs on the chat's machine with its hooks, as Claude Code's does (round 5: Coder's server made it, so PreCompact, PostCompact and SessionStart \"compact\" never ran): PreCompact as \"manual\" with the owner's words, its output to the summary; a block keeps the conversation; PostCompact gets the summary; SessionStart's context goes with it; Coder does not answer", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const H = await import("../container/coder-hooks.mjs");
  const K = await import("../container/coder-compact.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const history = [{ role: "user", content: "fix the totals" }, { role: "assistant", content: "", tool_calls: [call("read", { path: "src/totals.js" }, "r1")] }, { role: "tool", tool_call_id: "r1", content: "…" }, { role: "assistant", content: "Fixed." }];
  const run = async ({ hooks = {}, hookRun = () => ({}), answer = "THE SUMMARY", focus = "keep the API notes", messages = history } = {}) => {
    const events = [], seen = [], hookCalls = [];
    const r = await runCoder({
      send: async (req) => { seen.push(req); if (answer === null) throw new Error("down"); return { message: { role: "assistant", content: answer }, usage: { in: 5, out: 3 } }; },
      exec: async (x) => {
        const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
        if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push(input); const a = (await hookRun(input)) || {}; return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") }; }
        return { code: 0, output: "ok\n" };
      },
      emit: (e) => events.push(e),
      here: () => "/work/shop", root: "/work/shop", chatId: "shop-c1", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    }, { text: "", messages, compact: { focus }, hooks: H.hooksFrom({ hooks }, "settings").list });
    return { r, events, seen, hookCalls };
  };
  const hk = (matcher) => [{ matcher, hooks: [{ type: "command", command: "./h.sh" }] }];
  // Hooks for all three: each runs once, with Claude Code's inputs; PreCompact's output goes to the summary as instructions.
  let t = await run({ hooks: { PreCompact: hk("manual"), PostCompact: hk("manual"), SessionStart: hk("compact") }, hookRun: (i) => ({ stdout: i.hook_event_name === "PreCompact" ? "Keep the list of failing tests." : i.hook_event_name === "SessionStart" ? "Reminder: run pnpm test." : "" }) });
  assert.deepEqual(t.hookCalls.map((i) => i.hook_event_name), ["PreCompact", "PostCompact", "SessionStart"]);
  assert.deepEqual([t.hookCalls[0].trigger, t.hookCalls[0].custom_instructions], ["manual", "keep the API notes"]);
  assert.deepEqual([t.hookCalls[1].trigger, t.hookCalls[1].compact_summary], ["manual", "THE SUMMARY"]);
  assert.equal(t.hookCalls[2].source, "compact");
  assert.equal(t.seen.length, 1, "one model call: the summary; Coder does not answer");
  assert.equal(t.seen[0].tools.length, 0);
  assert.match(t.seen[0].messages[1].content, /The owner asks it to focus on: keep the API notes Keep the list of failing tests\.$/);
  assert.match(t.seen[0].messages[1].content, /fix the totals/);
  assert.equal(t.r.status, "done");
  assert.equal(t.r.messages.length, 1);
  assert.ok(K.isSummary(t.r.messages[0]));
  assert.match(t.r.messages[0].content, /the conversation before the owner's \/compact, focused on: keep the API notes\. The chat on the owner's page still shows all of it\.\)\nTHE SUMMARY\n\n\(Note from Coder's app, not the owner: SessionStart hook additional context: Reminder: run pnpm test\.\)$/);
  assert.deepEqual(t.r.messages[0].reread, ["src/totals.js"], "the files it worked on, read again by the next job");
  assert.deepEqual(t.r.compact, { done: true, from: 0, to: 4 });
  assert.deepEqual(t.events.map((e) => e.type), ["user", "note"]);
  assert.equal(t.events[0].text, "/compact keep the API notes");
  assert.equal(t.events[1].text, "Compacted: the conversation so far is now a summary for Coder (kept in focus: keep the API notes). The chat still shows it all.");
  // An "auto" matcher does not run for the owner's /compact; a "startup" SessionStart neither.
  t = await run({ hooks: { PreCompact: hk("auto"), SessionStart: hk("startup") }, focus: "" });
  assert.deepEqual(t.hookCalls, []);
  assert.equal(t.events[0].text, "/compact");
  // A PreCompact hook that blocks keeps the conversation whole: no summary made, the chat says why.
  t = await run({ hooks: { PreCompact: hk("manual") }, hookRun: () => ({ stdout: '{"decision":"block","reason":"not during a release"}' }) });
  assert.equal(t.seen.length, 0);
  assert.deepEqual(t.r.messages, history);
  assert.deepEqual(t.r.compact, { done: false });
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "A PreCompact hook kept the conversation from being summarized: not during a release"));
  // The summary not made: the conversation as it was, and an error in the chat.
  t = await run({ answer: null });
  assert.deepEqual(t.r.messages, history);
  assert.ok(t.events.some((e) => e.type === "error" && e.text === "The summary could not be made. Try again in a minute."));
  // Nothing to summarize.
  t = await run({ messages: [] });
  assert.deepEqual([t.seen.length, t.r.compact.done], [0, false]);
});

test("CD533 a /compact job's end, on Coder's server: the summary is the chat's history, and Rewind's marks inside what it summarized go (as before, when the server made it); a /compact a hook blocked leaves them", async () => {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const W = await import("../src/coder-watch.mjs");
  const m = new Map();
  const bucket = { async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const uid = "user-1234567890abcdef", id = "shop-cmp5";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const key = (f) => "coder/" + uid + "/" + id + "/" + f;
  const msgs = [], marks = [], evs = [];
  for (let t = 1; t <= 3; t++) { marks.push({ turn: t, ev: evs.length, msg: msgs.length }); msgs.push({ role: "user", content: "ask " + t }, { role: "assistant", content: "answer " + t }); evs.push({ type: "user", text: "ask " + t }, { type: "done", text: "answer " + t }); }
  const reset = async () => { await bucket.put(key("meta.json"), JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 3, saved: 3, status: "idle", at: Date.now(), marks })); await bucket.put(key("messages.json"), JSON.stringify(msgs)); await bucket.put(key("events.json"), JSON.stringify(evs)); };
  const mach = { bodies: [], running: false, result: null, claimed: false, events: [] };
  const box = () => ({ fetch: async (req) => {
    const u = new URL(req.url), J = (o) => Response.json(o);
    if (u.pathname === "/turn") { mach.bodies.push(await req.json()); mach.running = true; mach.result = null; mach.claimed = false; mach.events = [{ at: 1, type: "user", text: "/compact", compact: true }]; return J({ ok: true }); }
    if (u.pathname === "/state") return J({ running: mach.running, events: mach.events.slice(Number(u.searchParams.get("since")) || 0), next: mach.events.length, ...(mach.result ? { result: mach.result } : {}) });
    if (u.pathname === "/claim") { if (!mach.result || mach.claimed) return J({ ok: false }); mach.claimed = true; return J({ ok: true }); }
    if (u.pathname === "/push") return J({ ok: true, pushed: true, changed: false });
    return J({ ok: true });
  } });
  const fetchFn = async () => new Response("{}", { status: 404 });
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn, authUser: async () => ({ id: uid, email: "me@x.y" }), container: box });
  const coder = (req, who) => handleCoder(req, env, {}, { fetchFn, authUser: async () => who, container: box });
  // Made: the summary alone is the history; every mark was inside it.
  await reset();
  assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "/compact" }) })).status, 200);
  const summary = { role: "user", content: "(Summary …) THE SUMMARY" };
  mach.running = false; mach.events.push({ at: 2, type: "note", text: "Compacted: the conversation so far is now a summary for Coder. The chat still shows it all." });
  mach.result = { status: "done", summary: "", messages: [summary], compact: { done: true, from: 0, to: 6 } };
  await W.runWatchedJobs(env, { coder });
  const meta = JSON.parse(m.get(key("meta.json")));
  assert.equal(meta.status, "idle");
  assert.deepEqual(meta.marks, [], "the summarized messages' marks go");
  assert.deepEqual(JSON.parse(m.get(key("messages.json"))), [summary]);
  assert.ok(JSON.parse(m.get(key("events.json"))).some((e) => e.type === "note" && /^Compacted: /.test(e.text)), "the chat keeps everything, with the note");
  // Blocked by a PreCompact hook: the history as it was, the marks too.
  await reset();
  assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "/compact" }) })).status, 200);
  mach.running = false; mach.result = { status: "done", summary: "", messages: msgs, compact: { done: false } };
  await W.runWatchedJobs(env, { coder });
  assert.deepEqual(JSON.parse(m.get(key("meta.json"))).marks, marks);
  assert.deepEqual(JSON.parse(m.get(key("messages.json"))), msgs);
});

test("CD534 only the owner's variables that look secret are hidden in the chat (round 5: with a variable set to `false`, every \"false\" in the chat showed as \"[hidden]\"): by name (KEY, TOKEN, SECRET, PASSWORD, AUTH, …) or by value (a key's shape, a login in a web address, a long mix of letters and digits)", async () => {
  const R = await import("../src/coder-routes.mjs");
  for (const [n, v] of [["CODER_RESPOND_TO_BASH_COMMANDS", "false"], ["NODE_ENV", "production"], ["PORT", "8080"], ["CODER_SHELL", "/bin/zsh"], ["BYPASS_CACHE", "true"], ["DATABASE_URL", "postgres://db:5432/app"], ["HOME_URL", "https://example.com/a1b2c3d4e5f6g7"], ["TOOLS_DIR", "/opt/tools/bin1234567890"], ["CODER_BASH_EDIT_DIFF", "1"], ["SHORT_KEY", "abc"]]) assert.equal(R.secretVar(n, v), false, n + "=" + v);
  for (const [n, v] of [["STRIPE_KEY", "abcd1234"], ["API_KEY", "test"], ["OPENAI_APIKEY", "x1y2z3w4"], ["DB_PASSWORD", "hunter22"], ["GITHUB_TOKEN", "anything"], ["MY_SECRET", "plainword"], ["AUTH", "basic-x"], ["AWS_CREDENTIALS", "abcd"], ["DATABASE_URL", "postgres://app:s3cretpw@db:5432/app"], ["DB_URL", "postgres://secret-pass@db"], ["SOME_VALUE", "9f8e7d6c5b4a39281706"], ["X", "sk-proj-abcdefghijklmnop1234"], ["GH", "ghp_abcdefghijklmnopqrstuvwxyz12"]]) assert.equal(R.secretVar(n, v), true, n + "=" + v);
  // In the chat: the secret one hidden, the plain one shown.
  const vals = Object.entries({ CODER_RESPOND_TO_BASH_COMMANDS: "false", STRIPE_KEY: "rk_9988776655" }).filter(([k, v]) => R.secretVar(k, v)).map(([, v]) => v);
  const evs = R.hideIn([{ type: "done", text: "Set it to false; the key rk_9988776655 is in place." }], vals);
  assert.equal(evs[0].text, "Set it to false; the key [hidden] is in place.");
});

test("CD535 a monitor's end says its own time limit, not the time from just before its command started to its deadline (the live check after deploy 138: a 20-second monitor \"expired after 21 seconds\")", async () => {
  const S = await import("../container/server.mjs");
  const A = await import("../container/coder-agent.mjs");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const log = join(mkdtempSync(join(tmpdir(), "mon535-")), "bg-1.log");
  writeFileSync(log, "");
  const at = Date.now() - 22_000;
  // Its command started at `at`; its deadline was set 1.3 seconds later, once it ran: 21.3 seconds in all.
  const j = { project: "shop-m535", id: "job1", pid: 999535, log, command: "sleep 300", desc: "r41 watch", mark: "0123456789abc535", monitor: true, readAt: 0, part: "", pending: [], dropped: 0, end: { code: null, why: "limit", at: Date.now() }, told: false, stopping: "limit", at, deadline: at + 21_300, limitMs: 20_000 };
  S.JOBS.set(j.pid, j);
  try {
    const news = S.monitorNews("shop-m535");
    assert.equal(news.length, 1);
    assert.equal(news[0].end.ms, 20_000);
    assert.match(A.monitorSaid(news[0]), /expired after 20s with no events delivered/);
  } finally { S.JOBS.delete(j.pid); }
  // Where a monitor is started, its own limit goes with it.
  const { readFile } = await import("node:fs/promises");
  const server = await readFile(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /\.\.\.\(monitor \? \{ limitMs: monitorMs\(limitMs\) \} : \{\}\)/);
});

test("CD536 Coder is told never to print only the values of the owner's variables that look secret (the owner: \"yes change it\"; round 5's live check: Grok refused `echo $R41_PLAIN`, a variable set to `false`, as it was told \"never print their values\" of every variable; Claude Code has no such rule): the same check that hides them in the chat", async () => {
  const S = await import("../container/server.mjs");
  const C = await import("../container/coder-checks.mjs");
  const R = await import("../src/coder-routes.mjs");
  assert.equal(R.secretVar, C.secretVar, "the chat's hiding and Coder's instructions use one check");
  assert.equal(S.varsNote({ R41_PLAIN: "false", NODE_ENV: "production", R41_TOKEN: "r41abc123xyz", DATABASE_URL: "postgres://app:pw@db/app" }), "\n\nENVIRONMENT VARIABLES the owner set for this repo (available to your commands): R41_PLAIN, NODE_ENV, R41_TOKEN, DATABASE_URL. Never print the values of those that look secret: R41_TOKEN, DATABASE_URL (the chat hides them)");
  assert.equal(S.varsNote({ PORT: "8080", CODER_SHELL_DIR: "/opt/tools" }), "\n\nENVIRONMENT VARIABLES the owner set for this repo (available to your commands): PORT, CODER_SHELL_DIR", "none secret: no rule at all");
  assert.equal(S.varsNote({}), "");
  assert.equal(S.varsNote(null), "");
  const { readFile } = await import("node:fs/promises");
  const server = await readFile(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(server, /\(available to your commands; never print their values\)/, "the old rule for every variable is gone");
  assert.match(server, /\+ varsNote\(ownerVars\) \+ netNote \+/);
});
