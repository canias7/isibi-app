// The site's look, moved out of the site's own database and into the bucket the
// site is served from.
//
// THE ONE PROPERTY EVERYTHING ELSE HANGS OFF: a read that could not happen is
// not an empty config. That was learned by losing it — until 2026-08-14 the
// publish spine swallowed its own look-read error and fell through, so one
// transient blip during any cheap edit republished a live site with no theme, no
// stylesheet, default fonts and its slug as its title, reported the edit as a
// success, and archived the stripped version to history. Half the assertions
// below exist to keep the three cannot-tell paths apart from the one honest
// nothing-stored path.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CONFIG_KEY, CONFIG_FIELDS, LEGACY_META, LEGACY_KEYS,
  emptyConfig, readConfig, writeConfig, fromMetaRows, withConfig,
  loadConfig, saveConfig,
} from "../site-config.mjs";

const SRC = fs.readFileSync(new URL("../site-config.mjs", import.meta.url), "utf8");
// Comments argue every decision at length and therefore SPELL the things being
// asserted absent — a lint, a router guard, an absence check and a scope scan
// have each been caught by that here. Length-preserving, and asserted so,
// because a blanker that ate too much would report a clean file.
const blank = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
const CODE = blank(SRC);
assert.equal(CODE.length, SRC.length, "the blanker moved a byte");

const store = (seed = {}) => {
  const bucket = new Map(Object.entries(seed));
  const calls = { get: 0, put: 0, legacy: 0 };
  return {
    bucket, calls,
    get: async (k) => { calls.get++; return bucket.has(k) ? bucket.get(k) : null; },
    put: async (k, v) => { calls.put++; bucket.set(k, v); },
  };
};

const FULL = {
  look: { brand: "Fold Coffee", lang: "en" },
  css: ":root{--background:#fff}",
  logo: "/u/fold/logo.png",
  icon: "/u/fold/icon.png",
  verify: { google: "TOKEN" },
  langStrings: { es: { Book: "Reservar" } },
  // The chosen link-preview picture (2026-08-28): a BASENAME from the owner's
  // own uploads, re-validated against the live list on every read.
  share: "9a4c1e.jpg",
};

// ── THE KEY ──────────────────────────────────────────────────────────────────

test("the config is not stored where the public is served", () => {
  const k = CONFIG_KEY("fold-coffee");
  assert.equal(k, "config/fold-coffee.json");
  // `sites/<slug>/` is what the site's own Worker hands to anybody who asks, so
  // a customer's unpublished stylesheet, their verification tokens and their
  // translation cache must not live under it.
  assert.doesNotMatch(k, /^sites\//,
    "the config would be a public file — it holds verification tokens");
});

test("the legacy key list is derived and covers every MIGRATED field", () => {
  // A hand-written SELECT list is how one field stops being read while the other
  // five keep working — silently, since a missing key is just an absent value.
  //
  // `share` is the deliberate exception: it postdates the `_meta` era entirely,
  // so no site ever stored one there and a legacy name would be a search for a
  // row that cannot exist. Named here so a SECOND field without a legacy name
  // has to be a decision too, not a map entry somebody forgot.
  const legacyless = CONFIG_FIELDS.filter((f) => !LEGACY_META[f]);
  assert.deepEqual(legacyless, ["share"],
    "a migrated field lost its _meta name — the fallback cannot read it");
  assert.equal(LEGACY_KEYS.length, CONFIG_FIELDS.length - legacyless.length);
  for (const f of CONFIG_FIELDS) {
    if (legacyless.includes(f)) continue;
    assert.ok(LEGACY_KEYS.includes(LEGACY_META[f]));
  }
  // And the names are the ones already in every site's database. Getting one
  // wrong reads as a site that never had a look — and an UNFILTERED map would
  // interpolate 'undefined' into the legacy SELECT's IN list.
  assert.deepEqual([...LEGACY_KEYS].sort(),
    ["site_css", "site_icon", "site_lang_strings", "site_logo", "site_look", "site_verify"]);
  assert.ok(!LEGACY_KEYS.includes(undefined), "the filter is gone — the SELECT asks for 'undefined'");
});

// ── SHAPE ────────────────────────────────────────────────────────────────────

test("a config round-trips, and an absent field keeps the shape the call sites use", () => {
  assert.deepEqual(readConfig(writeConfig(FULL)), FULL);
  // The absent values are what the read sites already declare: null for the
  // three objects, "" for the strings. `if (!priorLook && !priorCss)` is a
  // real gate in the look lane and has to keep answering the same way.
  assert.deepEqual(emptyConfig(), { look: null, css: "", logo: "", icon: "", verify: null, langStrings: null, share: "" });
  assert.deepEqual(readConfig(writeConfig({})), emptyConfig());
});

test("a wrong type reads as absent rather than reaching the container", () => {
  const got = readConfig(JSON.stringify({ look: "a string", css: 42, logo: null, verify: [1, 2], langStrings: "no" }));
  assert.deepEqual(got, emptyConfig());
  // An ARRAY is `typeof "object"`, so the object-shaped fields have to exclude
  // one explicitly or a list reaches `mergeLook` as a look.
  assert.equal(readConfig(JSON.stringify({ look: [] })).look, null);
});

test("an unreadable stored object is null — never an empty config", () => {
  // A corrupt object means something wrote garbage. Publishing the site stripped
  // of its whole design is a far worse answer than refusing loudly.
  for (const bad of ["", "   ", "not json", "[]", "null", "7", '"a"', undefined, null, 7]) {
    assert.equal(readConfig(bad), null, `${JSON.stringify(bad)} must not read as a config`);
  }
});

// ── THE MERGE ────────────────────────────────────────────────────────────────

test("absent means unchanged, and null is a real value", () => {
  const next = withConfig(FULL, { css: ":root{--background:#000}" });
  assert.equal(next.css, ":root{--background:#000}");
  assert.deepEqual(next.look, FULL.look, "naming one field must not drop the other five");
  assert.equal(next.logo, FULL.logo);
  assert.deepEqual(next.verify, FULL.verify);

  // TAKING A LOGO OFF IS AN EDIT SOMEBODY MAKES, so the removal verbs have to be
  // storable. `undefined` is the only absence.
  assert.equal(withConfig(FULL, { logo: "" }).logo, "");
  assert.equal(withConfig(FULL, { verify: null }).verify, null);
  assert.equal(withConfig(FULL, { logo: undefined }).logo, FULL.logo);
  assert.deepEqual(withConfig(FULL, {}), FULL);
  assert.deepEqual(withConfig(FULL, null), FULL);
});

// ── THE FALLBACK ─────────────────────────────────────────────────────────────

test("_meta rows become a config, and a bad row loses one field rather than six", () => {
  const rows = [
    { k: "site_look", v: JSON.stringify(FULL.look) },
    { k: "site_css", v: FULL.css },
    { k: "site_logo", v: FULL.logo },
    { k: "site_icon", v: FULL.icon },
    { k: "site_verify", v: JSON.stringify(FULL.verify) },
    { k: "site_lang_strings", v: JSON.stringify(FULL.langStrings) },
  ];
  const { config, found } = fromMetaRows(rows);
  assert.equal(found, true);
  // `share` postdates `_meta`, so the fallback can never produce one — the
  // migrated six arrive and the picker's field is honestly absent.
  assert.deepEqual(config, { ...FULL, share: "" });

  // A bad `site_verify` row is no verification and a bad `site_lang_strings` is
  // a cold cache — exactly what the call sites tolerate today, per field.
  const partial = fromMetaRows([
    { k: "site_look", v: JSON.stringify(FULL.look) },
    { k: "site_verify", v: "{not json" },
    { k: "site_lang_strings", v: "]" },
  ]);
  assert.deepEqual(partial.config.look, FULL.look, "one bad row must not lose the look");
  assert.equal(partial.config.verify, null);
  assert.equal(partial.config.langStrings, null);
  assert.equal(partial.found, true);

  // `found` is what separates a site with nothing stored from a site with a
  // config, which is the only thing that decides whether to backfill.
  assert.equal(fromMetaRows([]).found, false);
  assert.equal(fromMetaRows(null).found, false);
  assert.equal(fromMetaRows([{ k: "schema", v: "{}" }]).found, false,
    "a backend key is not a config — the fallback must not backfill off one");
  assert.equal(fromMetaRows([{ k: "site_look", v: null }]).found, false);
});

// ── LOADING ──────────────────────────────────────────────────────────────────

test("a stored config is read, and the database is never consulted", async () => {
  const s = store({ "config/fold.json": writeConfig(FULL) });
  let legacyCalls = 0;
  const got = await loadConfig({ ...s, legacy: async () => { legacyCalls++; return []; } }, "fold");
  assert.equal(got.ok, true);
  assert.equal(got.from, "r2");
  assert.deepEqual(got.config, FULL);
  // The whole point of the move: once a site's config is in R2, serving it needs
  // no database at all.
  assert.equal(legacyCalls, 0, "R2 answered and the database was still asked");
});

test("A READ THAT THROWS IS NOT AN EMPTY CONFIG", async () => {
  // The load-bearing one. Both stores, because either alone leaves the other
  // looking sufficient — and both produce the identical disaster if read as
  // nothing stored: a live site republished with its whole design gone.
  const thrower = { get: async () => { throw new Error("R2 down"); }, put: async () => {} };
  const a = await loadConfig(thrower, "fold");
  assert.equal(a.ok, false);
  assert.equal(a.why, "store");

  const b = await loadConfig({
    get: async () => null,
    put: async () => {},
    legacy: async () => { throw new Error("Neon down"); },
  }, "fold");
  assert.equal(b.ok, false);
  assert.equal(b.why, "legacy");

  const c = await loadConfig({ get: async () => "{not json", put: async () => {} }, "fold");
  assert.equal(c.ok, false);
  assert.equal(c.why, "unreadable");

  // …and each names something different, or an operator reading a log cannot
  // tell a bucket outage from a corrupt object from a database blip.
  assert.equal(new Set([a.why, b.why, c.why]).size, 3);
});

test("nothing stored anywhere is an honest answer, not a refusal", async () => {
  // A site that has genuinely never been configured must proceed — refusing here
  // would mean no site could ever have a first publish.
  const fresh = await loadConfig(store(), "fold");
  assert.equal(fresh.ok, true);
  assert.equal(fresh.from, "none");
  assert.deepEqual(fresh.config, emptyConfig());

  // A site with NO DATABASE supplies no legacy reader at all, which is the state
  // every frontend-only site is in.
  const s = store();
  const noDb = await loadConfig(s, "fold");
  assert.equal(noDb.ok, true);
  assert.equal(noDb.from, "none");

  // And a database that answers with no config rows is the same answer.
  const empty = await loadConfig({ ...store(), legacy: async () => [{ k: "schema", v: "{}" }] }, "fold");
  assert.equal(empty.ok, true);
  assert.equal(empty.from, "none");
});

test("an existing site falls back to its database and is backfilled", async () => {
  const s = store();
  const got = await loadConfig({
    ...s,
    legacy: async () => [
      { k: "site_look", v: JSON.stringify(FULL.look) },
      { k: "site_css", v: FULL.css },
    ],
  }, "fold");
  assert.equal(got.ok, true);
  assert.equal(got.from, "legacy");
  assert.deepEqual(got.config.look, FULL.look);
  assert.equal(got.config.css, FULL.css);

  // BACKFILLED, so the fallback is a ramp rather than a permanent second read.
  assert.equal(s.calls.put, 1, "the fallback did not backfill — every read stays slow for ever");
  assert.deepEqual(readConfig(s.bucket.get("config/fold.json")).look, FULL.look);

  // And the second read is answered by R2 with the database untouched.
  let after = 0;
  const again = await loadConfig({ ...s, legacy: async () => { after++; return []; } }, "fold");
  assert.equal(again.from, "r2");
  assert.equal(after, 0);
});

test("a failed backfill costs a slow read, never the read", async () => {
  const got = await loadConfig({
    get: async () => null,
    put: async () => { throw new Error("R2 write down"); },
    legacy: async () => [{ k: "site_css", v: FULL.css }],
  }, "fold");
  assert.equal(got.ok, true, "a best-effort write failure must not fail the read it rode on");
  assert.equal(got.config.css, FULL.css);
});

// ── WRITING ──────────────────────────────────────────────────────────────────

test("saving writes the whole config and reports its own failure", async () => {
  const s = store();
  const ok = await saveConfig(s, "fold", FULL);
  assert.equal(ok.ok, true);
  assert.deepEqual(readConfig(s.bucket.get("config/fold.json")), FULL);

  // A discarded boolean here is a customer told their colour change landed while
  // the next publish serves the old one — the shape `refundCredits` was already
  // caught by. It answers rather than throwing, so no caller can lose a build to
  // a config write.
  const bad = await saveConfig({ put: async () => { throw new Error("nope"); } }, "fold", FULL);
  assert.equal(bad.ok, false);
  assert.match(bad.error, /nope/);
});

test("a bad patch cannot store a bad shape", async () => {
  const s = store();
  await saveConfig(s, "fold", { look: "a string", css: 42, nonsense: true });
  // ON THE STORED BYTES, not on what the reader hands back. `readConfig`
  // normalises too, so asserting the round trip is satisfied by a writer that
  // stores whatever it was given — a mutant dropping `normalize` from
  // `writeConfig` survived exactly that. What the write side owes is that the
  // object in the bucket is the declared fields and nothing else: an
  // operator reads it by hand, and a caller's stray keys would accumulate there
  // for the life of the site.
  const raw = JSON.parse(s.bucket.get("config/fold.json"));
  assert.deepEqual(Object.keys(raw).sort(), [...CONFIG_FIELDS].sort(),
    "the stored object is not exactly the declared fields");
  assert.equal(raw.look, null, "a wrong type was stored rather than normalised away");
  assert.equal(raw.css, "");
  assert.deepEqual(readConfig(s.bucket.get("config/fold.json")), emptyConfig());
});

// ── THE MODULE'S OWN BOUNDARIES ──────────────────────────────────────────────

test("nothing here reaches a bucket, a database or the network by itself", () => {
  // Asserted rather than intended: the caller does every read and write, so a
  // mistake in this file cannot be a mistake about a binding. Comments blanked
  // first — the docstring argues R2 and Neon at length and therefore spells both.
  for (const forbidden of [/\bfetch\(/, /SITES_BUCKET/, /sqlQuery/, /\bimport\s/, /\brequire\(/]) {
    assert.doesNotMatch(CODE, forbidden, `site-config.mjs must stay a leaf: ${forbidden}`);
  }
});

// ── THE WIRING, WHICH IS WHERE THIS DIES SILENTLY ────────────────────────────

test("the Worker reads and writes through this module and nowhere else", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /import \{[^}]*loadConfig[^}]*\} from "\.\/site-config\.mjs"/,
    "worker.js does not import the config store — a name it never imported is a ReferenceError on the build path");
  // BOTH ENDS, because either alone passes while the other is cut.
  assert.match(w, /async function readSiteConfig\(env, slug, db\)/, "the Worker has no config reader");
  assert.match(w, /async function patchSiteConfig\(env, slug, db, patch\)/, "the Worker has no config writer");
  assert.ok((w.match(/readSiteConfig\(env,/g) || []).length >= 4, "fewer readers than lanes — the scan stopped matching");
  assert.ok((w.match(/patchSiteConfig\(env,/g) || []).length >= 5, "fewer writers than lanes — the scan stopped matching");

  // AND NOTHING READS OR WRITES A CONFIG FIELD OUT OF `_meta` ANY MORE. This is
  // the absence that makes one-store true rather than merely likely: a lane that
  // keeps its own query is a lane that can leave a field out, which is the exact
  // shape `site_logo` and `site_verify` each had their own derived guard for.
  for (const k of LEGACY_KEYS) {
    assert.doesNotMatch(w, new RegExp("_meta[^\\n]*'" + k + "'"),
      k + " is read or written through `_meta` again — the look has two stores, and whichever is read first wins");
  }
  // …and the ONE place `_meta` is still named for a config key is the fallback's
  // own query, which is derived from this module rather than restated.
  assert.match(w, /LEGACY_KEYS\.map\(\(k\) => "'" \+ k \+ "'"\)\.join\(","\)/,
    "the fallback's key list is hand-written, so a rename reads as a site that never had a look");
});

test("deleting a site deletes its config — a slug's next owner must not inherit it", () => {
  // THE SHARPEST INHERITANCE OF THE PRIVATE PREFIXES. The config holds the
  // site's whole design AND its Search Console tokens, and it lives outside
  // `sites/<slug>/` so the publish wipe walks past it. Left behind, whoever
  // claims the slug next serves a stranger's stylesheet until their first
  // publish — and a stranger's verification tag from the very first request,
  // which is a standing way for the previous owner to claim the new owner's
  // site at Google. Same class as the Neon projects, the version archive and
  // the meta sidecar, and the reason each of those has its own line there.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const del = w.indexOf("async function deleteSiteFor");
  assert.ok(del > 0, "the delete path is gone");
  const body = w.slice(del, w.indexOf("\n}", w.indexOf("domainsReleased", del)));
  const live = body.indexOf("deleteSitePrefix(env, dslug)");
  const cfg = body.indexOf("CONFIG_KEY(dslug)");
  assert.ok(live > 0, "the live sweep is gone — re-point this guard");
  assert.ok(cfg > 0, "a deleted site's config would outlive it, tokens and all");
  // AFTER the live files, like every other by-slug cleanup: the published files
  // are what the caller asked to take down, so a failure here must not answer an
  // error and tell them their site is still up when it is not.
  assert.ok(live < cfg, "the config is swept before the published files, so a failure there hides the takedown");
  // AND THE WHOLE FAMILY, because adding a fifth private prefix and forgetting
  // this line is exactly how the first four each became a leak in turn.
  for (const [k, why] of [
    ["deleteAllVersions(", "the version archive"],
    ["P_ORPHANS(dslug)", "the orphan marker"],
    ["siteMetaKey(dslug)", "the meta sidecar"],
    ['"backups/" + dslug', "the nightly backups"],
  ]) assert.ok(body.includes(k), why + " outlives a deleted site");
});

test("A MISSING BUCKET THROWS — it must never read as a site with no look", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("function configDeps(env, slug, db)");
  assert.ok(at > 0, "configDeps is gone");
  const fn = w.slice(at, w.indexOf("\n}\n", at));
  // `SITES_BUCKET` is also what SERVES the site, so its absence is not a
  // degradation to ride out — and answering null would send every publish down
  // the nothing-stored path and republish live sites stripped of their design.
  assert.match(fn, /if \(!env\.SITES_BUCKET\) throw/,
    "a missing bucket answers instead of throwing, so cannot-tell reads as nothing-stored");
  // THE LEGACY READER IS OMITTED FOR A SITE WITH NO DATABASE, which is the whole
  // point of the move: a frontend-only site has nothing in Neon to fall back to.
  assert.match(fn, /if \(db\) deps\.legacy =/,
    "the fallback is unconditional, so a site with no database cannot be read at all");
});

test("a write refuses when the current config could not be read", () => {
  // Writing over a config nobody could read is how a site loses five fields to
  // keep one. `patchSiteConfig` answers rather than throwing, so a config write
  // can never lose a build that has already succeeded.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("async function patchSiteConfig(env, slug, db, patch)");
  const fn = w.slice(at, w.indexOf("\n}\n", at));
  assert.match(fn, /if \(!cur\.ok\) return \{ ok: false/,
    "a patch writes over a config it could not read");
  assert.match(fn, /withConfig\(cur\.config, patch\)/,
    "the patch replaces the config rather than merging into it");
});

test("THE FALLBACK IS READ-ONLY — nothing ever writes back to the database", () => {
  // One writer, or the two stores drift and whichever is read first wins. The
  // legacy dep is a reader by construction: it takes no value and its answer is
  // only ever consumed.
  const load = CODE.slice(CODE.indexOf("export async function loadConfig"));
  assert.ok(load.length > 400, "could not find loadConfig — this check would be vacuous");
  assert.match(load, /deps\.legacy\(\)/, "the fallback must call legacy with nothing to write");
  assert.doesNotMatch(load, /deps\.legacy\([^)]/, "the legacy reader was handed an argument — it is a reader");
  // And the whole module offers no write-to-legacy surface at all.
  assert.doesNotMatch(CODE, /legacyPut|writeLegacy|saveLegacy/);
});
