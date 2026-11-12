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
