// THE MACHINE'S OWN DISK, ALL OF IT (live test, 2026-11-07): on Fly.io, `lsblk`
// showed the machine's own disk at 20 GB (/.fly-upper-layer) but `df` showed
// 7.8 GB on it: Fly.io had made the disk bigger, not the filesystem on it. At
// start the service grows the filesystem to fill its disk, and never holds up or
// stops the start.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { growOwnDisk, UPPER_DISK } = await import("../container/server.mjs");
const GB = 1024 ** 3;
const fly = ({ src = "/dev/vdb", type = "ext4", disk = 20 * GB, fs = 7.8 * GB } = {}) => {
  const grown = [];
  return {
    grown,
    deps: {
      root: true,
      run: (cmd, args) => { assert.deepEqual([cmd, args], ["findmnt", ["-n", "-o", "SOURCE,FSTYPE", "--nofsroot", UPPER_DISK]]); return { status: 0, stdout: src + " " + type + "\n" }; },
      read: (p) => { assert.equal(p, "/sys/class/block/" + src.replace(/\[.*$/, "").slice(5) + "/size"); return String(disk / 512) + "\n"; },
      statfs: (p) => { assert.equal(p, UPPER_DISK); return { bsize: 4096, blocks: Math.round(fs / 4096) }; },
      grow: (dev) => grown.push(dev),
    },
  };
};

test("CD146 the machine's own disk is grown to the size Fly.io gave it (7.8 GB of 20 before), once, while in use; anything unexpected, and nothing is done; the start is never held up", () => {
  assert.equal(UPPER_DISK, "/.fly-upper-layer");
  // THE LIVE CASE: a 20 GB disk with a 7.8 GB filesystem on it.
  const a = fly();
  assert.equal(growOwnDisk(a.deps), "growing");
  assert.deepEqual(a.grown, ["/dev/vdb"]);
  // AS FLY.IO SAYS IT (live test, 2026-11-07: "/dev/vdb[/upper] ext4", a folder on the disk; before, that was taken for no disk).
  const live = fly({ src: "/dev/vdb[/upper]" });
  assert.equal(growOwnDisk(live.deps), "growing");
  assert.deepEqual(live.grown, ["/dev/vdb"], "the disk itself");
  // ALREADY FULL SIZE (the next start, or a machine made at 20 GB): nothing.
  const b = fly({ fs: 19.6 * GB });
  assert.equal(growOwnDisk(b.deps), "full size");
  assert.deepEqual(b.grown, []);
  // NOT FLY.IO'S DISK, OR NOT ONE resize2fs GROWS WHILE IN USE: nothing.
  for (const o of [{ src: "none", type: "overlay" }, { src: "/dev/sda1" }, { type: "xfs" }, { src: "" , type: "" }, { src: "/dev/vdb[/upper]x" }, { src: "[/upper]" }]) {
    const c = fly(o);
    assert.equal(growOwnDisk(c.deps), "no disk to grow", JSON.stringify(o));
    assert.deepEqual(c.grown, []);
  }
  // ANYTHING UNEXPECTED (no findmnt, no /sys, a failed statfs): nothing, and no error.
  for (const broken of [{ run: () => { throw new Error("no findmnt"); } }, { read: () => { throw new Error("no /sys"); } }, { statfs: () => { throw new Error("gone"); } }, { read: () => "nonsense" }]) {
    const d = fly();
    assert.equal(growOwnDisk({ ...d.deps, ...broken }), broken.read && !String(broken.read).includes("throw") ? "full size" : "could not grow");
    assert.deepEqual(d.grown, []);
  }
  // ONLY AS ROOT (a test's machine, or a mistake, never tries).
  const e = fly();
  assert.equal(growOwnDisk({ ...e.deps, root: false }), "not root");
  assert.deepEqual(e.grown, []);
  // WIRING: the real service grows it before it starts listening, without waiting for it (resize2fs runs on its own);
  // the full image has resize2fs (e2fsprogs).
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /\n\s+console\.log\("coder: the machine's own disk: " \+ growOwnDisk\(\)\);\n\s+http\.createServer\(createApp\(\{ kept: bootKept\(\),/, "and says what it did, in the machine's log");
  assert.match(server, /grow = \(dev\) => \{ const c = spawn\("resize2fs", \[dev\], \{ stdio: "ignore", detached: true \}\); c\.on\("error", \(\) => \{\}\); c\.unref\(\); \}/, "started, never waited for");
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), /uidmap slirp4netns fuse-overlayfs iproute2 e2fsprogs \\\n/);
});
