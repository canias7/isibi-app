// Taking a site off the web, and putting it back.
//
// The property under test everywhere: going offline is NEVER a one-way door.
// The button this replaces posted to a route that did not exist and told the
// owner to try again, so the failure mode being guarded against is not "it
// breaks" — it is "it says it worked".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { wayBack, takeOffline, putBackOnline } from "../site-live.mjs";

const V = [{ id: "20260812-aaaa", at: 2, label: "Latest" }, { id: "20260811-bbbb", at: 1, label: "Older" }];

const deps = (o = {}) => {
  const seen = { wiped: 0, rolled: [], recompiled: 0 };
  return {
    seen,
    d: {
      versions: async () => ("versions" in o ? o.versions : V),
      hasSource: async () => ("hasSource" in o ? o.hasSource : true),
      wipe: async () => { seen.wiped++; if (o.wipeThrows) throw new Error("R2 down"); return 7; },
      rollback: async ({ id }) => { seen.rolled.push(id); return o.rollback === undefined ? { ok: true, files: 12 } : o.rollback; },
      recompile: async () => { seen.recompiled++; return o.recompile === undefined ? { ok: true, files: 12 } : o.recompile; },
    },
  };
};

// ── which way back ──────────────────────────────────────────────────────────

test("a version is preferred over a recompile — it is the exact bytes that were live", () => {
  assert.deepEqual(wayBack({ versions: V, hasSource: true }), { how: "version", id: "20260812-aaaa" });
});

test("the NEWEST version is the one chosen", () => {
  assert.equal(wayBack({ versions: V, hasSource: false }).id, V[0].id);
});

test("stored source is the fallback when there is no archive", () => {
  assert.deepEqual(wayBack({ versions: [], hasSource: true }), { how: "recompile" });
});

test("neither means no way back", () => {
  assert.deepEqual(wayBack({ versions: [], hasSource: false }), { how: null });
  assert.deepEqual(wayBack({}), { how: null });
});

test("a version entry with no id does not count as one", () => {
  assert.equal(wayBack({ versions: [{}, null], hasSource: false }).how, null);
});

// ── going offline ───────────────────────────────────────────────────────────

test("a site with a saved copy goes offline, and the files really are removed", async () => {
  const { d, seen } = deps();
  const r = await takeOffline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.live, false);
  assert.equal(seen.wiped, 1);
  assert.equal(r.removed, 7);
});

test("GOING OFFLINE IS REFUSED WITH NO WAY BACK, and nothing is wiped", async () => {
  // The whole point of the module. Wiping here turns a reversible action into a
  // permanent one, which is the bug this replaces rather than a new version of it.
  const { d, seen } = deps({ versions: [], hasSource: false });
  const r = await takeOffline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no-way-back");
  assert.equal(seen.wiped, 0, "a refused offline must not have deleted anything");
  assert.match(r.msg, /gone for good/);
});

test("the reply names what SURVIVES, not just what went", async () => {
  // Somebody taking their shop's site down mid-refit wants to hear the bookings
  // are still there before they hear a file count.
  const { d } = deps();
  const r = await takeOffline(d, { slug: "cafe" });
  assert.match(r.msg, /bookings/);
  assert.match(r.msg, /put the site back online/);
});

test("A FAILED WIPE SAYS THE SITE IS STILL UP — never that it worked", async () => {
  const { d } = deps({ wipeThrows: true });
  const r = await takeOffline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "wipe");
  assert.match(r.msg, /still up/);
});

test("an unreadable archive does not block a site that has source", async () => {
  const d = {
    versions: async () => { throw new Error("R2 list failed"); },
    hasSource: async () => true,
    wipe: async () => 3,
  };
  const r = await takeOffline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.back, "recompile");
});

test("no slug is refused rather than wiping a prefix built from undefined", async () => {
  const { d, seen } = deps();
  assert.equal((await takeOffline(d, {})).ok, false);
  assert.equal(seen.wiped, 0);
});

// ── coming back ─────────────────────────────────────────────────────────────

test("the newest version is restored, and nothing is recompiled", async () => {
  const { d, seen } = deps();
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.how, "version");
  assert.deepEqual(seen.rolled, ["20260812-aaaa"]);
  assert.equal(seen.recompiled, 0, "a restore is containerless — recompiling would cost time for nothing");
});

test("with no archive it recompiles from the stored source", async () => {
  const { d, seen } = deps({ versions: [] });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.how, "recompile");
  assert.equal(seen.recompiled, 1);
});

test("A VERSION THAT WILL NOT RESTORE FALLS THROUGH TO THE RECOMPILE", async () => {
  // The archive is best-effort by design — `listVersions` already skips an
  // unreadable manifest — and the source is a second, independent copy.
  // Refusing here would strand a site over a convenience path.
  const { d, seen } = deps({ rollback: { ok: false } });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.how, "recompile");
  assert.equal(seen.recompiled, 1);
});

test("…and a rollback that THROWS falls through too", async () => {
  const { d, seen } = deps();
  d.rollback = async () => { throw new Error("copy failed"); };
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(seen.recompiled, 1);
});

test("a failed restore with no source to fall back on is reported, never as success", async () => {
  const { d } = deps({ rollback: { ok: false }, hasSource: false });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "restore");
});

test("a failed recompile is reported, never as success", async () => {
  const { d } = deps({ versions: [], recompile: { ok: false } });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "recompile");
});

test("nothing to put back says so plainly", async () => {
  const { d, seen } = deps({ versions: [], hasSource: false });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no-way-back");
  assert.equal(seen.recompiled, 0);
});

test("coming back never mentions a cost, because there is none", async () => {
  const { d } = deps();
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.match(r.msg, /same address/);
  assert.ok(!/credit/i.test(r.msg));
});

// ── the module's own boundary ───────────────────────────────────────────────

test("THE LANE CANNOT REACH THE DATABASE OR A MODEL", () => {
  // Taking a site offline must never be able to touch the rows it exists to
  // preserve. The protection is that the calls are absent.
  const src = fs.readFileSync(new URL("../site-live.mjs", import.meta.url), "utf8");
  for (const forbidden of ["applySiteSchema", "sqlQuery", "sqlExec", "anthropicMessages", "generateSitePages", "neonDelete"]) {
    assert.ok(!src.includes(forbidden), "site-live must not be able to reach " + forbidden);
  }
});
