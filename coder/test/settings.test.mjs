// SETTINGS (the owner, 2026-11-10: "yea do all 4, plus do the 2 u left out optional , the setting put it in setings"):
// Coder's own, from the gear's menu, for all the owner's chats: the longest a background command may run, whether stopping
// one also stops what it started in the background, and the low-disk warning (Claude Code's CLAUDE_CODE_WARN_DISK_FREE_GIB).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const R = await import("../src/coder-routes.mjs");
const W = await import("../src/coder-watch.mjs");
const SV = await import("../container/server.mjs");
const A = await import("../container/coder-agent.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

function fakeBucket(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const UID = "user-1234567890abcdef";
const ENV = { CODER_ON: "on", CODER_USERS: "me@x.y", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev" };
const deps = { authUser: async () => ({ id: UID, email: "me@x.y" }), container: () => null };
const go = async (bucket, init) => {
  const r = await R.handleCoder(new Request("https://gofarther.dev/api/coder/settings", { ...(init || {}), headers: { "content-type": "application/json" } }), { ...ENV, CODER_BUCKET: bucket }, {}, deps);
  return { status: r.status, data: await r.json() };
};
const KEY = "coder/" + UID + "/settings.json";

test("CD380 Settings, part 1: the longest a background command may run (2 hours unless raised, 24 at most), Stop's choice for what a command started in the background (on unless turned off), and the low-disk warning (2 GB unless changed, 0 is off); saved on the account, checked, and sent with each message to the chat's machine, which keeps its work awake that long", async () => {
  // THE DEFAULTS, AND WHAT IS ACCEPTED.
  const b = fakeBucket({ [KEY]: JSON.stringify({ model: "grok-4.7", effort: "medium", pickV: 2, mode: "acceptEdits" }) });
  assert.deepEqual((await go(b)).data.prefs, { bgHours: 2, endDetached: true, diskWarnGib: 2, hooks: "" });
  for (const [bad, why] of [[{ bgHours: 3 }, /one of 2, 4, 8, 12, 24 hours/], [{ bgHours: 48 }, /one of/], [{ endDetached: "no" }, /on or off/], [{ diskWarnGib: 3 }, /one of 0, 1, 2, 5, 10, 20 GB/]]) {
    const x = await go(b, { method: "POST", body: JSON.stringify({ prefs: bad }) });
    assert.equal(x.status, 400, JSON.stringify(bad)); assert.match(x.data.error, why);
  }
  // A change keeps the rest, and the model, effort and mode as they were.
  let x = await go(b, { method: "POST", body: JSON.stringify({ prefs: { bgHours: 8 } }) });
  assert.equal(x.status, 200);
  assert.deepEqual(x.data.prefs, { bgHours: 8, endDetached: true, diskWarnGib: 2, hooks: "" });
  x = await go(b, { method: "POST", body: JSON.stringify({ prefs: { endDetached: false, diskWarnGib: 0 } }) });
  assert.deepEqual(x.data.prefs, { bgHours: 8, endDetached: false, diskWarnGib: 0, hooks: "" });
  const saved = JSON.parse(b.m.get(KEY));
  assert.deepEqual([saved.model, saved.effort, saved.pickV, saved.mode, saved.bgHours, saved.endDetached, saved.diskWarnGib], ["grok-4.7", "medium", 2, "acceptEdits", 8, false, 0]);
  assert.deepEqual((await go(b)).data.pick, { model: "grok-4.7", effort: "medium", mode: "acceptEdits" });
  // The effort picker's own save keeps the settings.
  await go(b, { method: "POST", body: JSON.stringify({ model: "grok-4.7", effort: "high", pickV: 2 }) });
  assert.deepEqual((await go(b)).data.prefs, { bgHours: 8, endDetached: false, diskWarnGib: 0, hooks: "" });
  // WHAT THE MACHINE IS GIVEN with each message.
  assert.deepEqual(R.machinePrefs(JSON.parse(b.m.get(KEY))), { bgMaxMs: 8 * 3_600_000, endDetached: false, diskWarnGib: 0 });
  assert.deepEqual(R.machinePrefs({}), { bgMaxMs: 7_200_000, endDetached: true, diskWarnGib: 2 });
  assert.match(read("src/coder-routes.mjs"), /effort: pick\.effort, prefs: machinePrefs\(saved\), hooks: machineHooks\(saved\), memory, setup,/);
  // THE MACHINE: its time limits, and its tool's words (Grok is told the longest it may ask for).
  assert.equal(SV.bashTimeouts({}, { bgMaxMs: 8 * 3_600_000 }).bgMaxMs, 8 * 3_600_000);
  assert.equal(SV.bashTimeouts({}, { bgMaxMs: 99 * 3_600_000 }).bgMaxMs, 24 * 3_600_000, "24 hours at most");
  assert.equal(SV.bashTimeouts({}, {}).bgMaxMs, 7_200_000);
  assert.equal(SV.bashTimeouts({ BASH_DEFAULT_TIMEOUT_MS: String(5 * 3_600_000) }, { bgMaxMs: 4 * 3_600_000 }).bgDefaultMs, 4 * 3_600_000, "a default past the longest is cut to it");
  assert.equal(SV.bgLimitMs(6 * 3_600_000, SV.bashTimeouts({}, { bgMaxMs: 8 * 3_600_000 })), 6 * 3_600_000);
  const bash = A.toolsFor(A.CODER_TOOLS, { bgMaxMs: 8 * 3_600_000 }).find((t) => t.function.name === "bash").function;
  assert.match(bash.description, /up to 28800000 \(8 hours\)/);
  assert.match(bash.parameters.properties.timeout.description, /at most 28800000\)/);
  assert.equal(A.toolsFor(A.CODER_TOOLS, {}), A.CODER_TOOLS, "2 hours: the tools as they are (the prompt cache keeps them)");
  // THE SERVER keeps the chat's machine awake that long (and 5 minutes more), and watches the chat 15 minutes more.
  assert.deepEqual(W.holdDecision({ background: 1, backgroundMs: 3 * 3_600_000, bgMaxMs: 4 * 3_600_000 }), { hold: true, why: "background" });
  assert.deepEqual(W.holdDecision({ background: 1, backgroundMs: 3 * 3_600_000 }), { hold: false, why: "stuck" }, "a machine from before: 2 hours");
  assert.deepEqual(W.holdDecision({ background: 1, backgroundMs: 25 * 3_600_000, bgMaxMs: 99 * 3_600_000 }), { hold: false, why: "stuck" }, "24 hours at most");
  const wb = fakeBucket();
  await W.watchBackground(wb, { uid: UID, email: "me@x.y", id: "shop-m1", maxMs: 8 * 3_600_000 }, 1000);
  assert.equal(JSON.parse(wb.m.get(W.bgKey(UID, "shop-m1"))).max, 8 * 3_600_000 + 15 * 60_000);
  await W.watchBackground(wb, { uid: UID, email: "me@x.y", id: "shop-m2" }, 1000);
  assert.equal("max" in JSON.parse(wb.m.get(W.bgKey(UID, "shop-m2"))), false, "2 hours: as before");
  assert.match(read("src/coder-routes.mjs"), /watchBackground\(bucket, \{ uid, email: user\.email, id, maxMs: machinePrefs\(await getJson\(bucket, settingsKey\(uid\), \{\}\)\)\.bgMaxMs \}\)/);
  // The machine says its limit in its /busy answer.
  SV.usePrefs({ bgMaxMs: 4 * 3_600_000 });
  assert.equal(SV.busyState(new Map(), Date.now(), new Map()).bgMaxMs, 4 * 3_600_000);
  SV.usePrefs({});
});

test("CD380b Stop's choice: on (the default), stopping a background command also ends what it started under setsid or timeout; off, those go on (Claude Code 2.1.322 leaves them), and the sweep before Coder's save keeps them too; and the low-disk warning, Claude Code's own words, said once while the disk stays low", async () => {
  // STOP. A job whose process group is gone already: what matters is whether its mark's processes are ended or kept.
  SV.usePrefs({});
  SV.KEPT_MARKS.clear();
  SV.stopJob({ pid: 999999, mark: "0123456789abcdef" }, "stopped");
  assert.equal(SV.KEPT_MARKS.size, 0, "on: nothing kept, its marked processes are ended");
  SV.usePrefs({ endDetached: false });
  SV.stopJob({ pid: 999998, mark: "fedcba9876543210" }, "stopped");
  assert.deepEqual([...SV.KEPT_MARKS], ["fedcba9876543210"], "off: its mark is kept");
  SV.usePrefs({});
  SV.KEPT_MARKS.clear();
  const server = read("container/server.mjs");
  assert.match(server, /const keep = PREFS\.endDetached === false;/);
  assert.match(server, /if \(!keep\) endMarked\(j\.mark, hard \? "SIGKILL" : "SIGTERM"\);/);
  assert.match(server, /const kept = keep && PREFS\.endDetached === false \? \[\.\.\.KEPT_MARKS\] : \[\];/);
  assert.match(server, /if \(!live\.length && !kept\.length\) \{/, "with kept ones, the sweep spares their processes instead of ending all");
  // THE LOW-DISK WARNING: Claude Code's reminder, word for word, with "owner".
  assert.equal(A.DISK_LOW(1.5 * 1024 ** 3), "Disk space is low: 1.5 GB free on the filesystem holding the working directory. If you need room, delete temporary files that you made. Ask the owner before you delete any other file. If that does not free enough, tell the owner.");
  assert.equal(A.diskSize(300 * 1024 ** 2), "300 MB");
  const say = (content) => ({ message: { role: "assistant", content }, usage: { in: 1, out: 1 } });
  let free = 1.5 * 1024 ** 3;
  const run = async (gib = 2) => {
    const sent = [], events = [];
    await A.runCoder({ send: async (req) => { sent.push(req.messages); return say("ok"); }, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), diskFree: () => free, root: "/work/disk-test" }, { text: "hi", diskWarnGib: gib });
    return { told: sent[0].some((m) => m.appNote === true && String(m.content).includes("Disk space is low: ")), shown: events.some((e) => e.type === "note" && String(e.text).startsWith("Disk space is low: ")) };
  };
  A.DISK_TOLD.clear();
  assert.deepEqual(await run(), { told: true, shown: true }, "below 2 GB: told, and the chat says it");
  assert.deepEqual(await run(), { told: false, shown: false }, "still low: not said again");
  free = 9 * 1024 ** 3;
  assert.deepEqual(await run(), { told: false, shown: false }, "back above the line");
  free = 1 * 1024 ** 3;
  assert.deepEqual(await run(), { told: true, shown: true }, "low again: said again");
  A.DISK_TOLD.clear();
  assert.deepEqual(await run(0), { told: false, shown: false }, "off");
  assert.match(server, /diskFree: \(\) => \{ try \{ const f = statfsSync\(dir\); return Number\(f\.bavail\) \* Number\(f\.bsize\); \} catch \{ return null; \} \},/);
  assert.match(server, /noBg: t\.noBg, diskWarnGib: PREFS\.diskWarnGib,/);
});

test("CD380c the page: Settings in the gear's menu opens a dialog with the three, each saved when it changes", () => {
  assert.match(read("public/index.html"), /<button type="button" role="menuitem" id="gfSettings">Settings<\/button><button type="button" role="menuitem" id="gfNotify">Notifications<\/button>/);
  assert.match(read("public/app.js"), /\$\('gfSettings'\)\.addEventListener\('click', \(\) => \{ \$\('gfMenu'\)\.hidden = true; [^\n]*new CustomEvent\('gf:settings'\)\); \}\);/);
  const page = read("public/coder.js");
  assert.match(page, /window\.addEventListener\('gf:settings', \(\) => \{ showSettings\(\); \}\);/);
  assert.match(page, /const BG_HOURS = \[2, 4, 8, 12, 24\], DISK_GIB = \[0, 1, 2, 5, 10, 20\];/);
  assert.match(page, /body: JSON\.stringify\(\{ prefs: \{ \[field\]: value \} \}\)/);
  for (const words of ["Longest one may run", "Stopping one also stops what it started in the background", "Warn Coder when the disk has less than"]) assert.ok(page.includes(words), words);
  assert.deepEqual([...read("src/coder-routes.mjs").matchAll(/export const BG_HOURS = (\[[^\]]+\]), DISK_GIB = (\[[^\]]+\]);/g)].map((m) => [m[1], m[2]]), [["[2, 4, 8, 12, 24]", "[0, 1, 2, 5, 10, 20]"]], "the page offers what the server takes");
});
