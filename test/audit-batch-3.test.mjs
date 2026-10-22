// AUDIT BATCH 3 (2026-10-22): findings 21-24 of
// docs/audits/2026-10-17-builder-audit.md. Offline; nothing spent.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { saveDraftRecord, previousSidecar } from "../site-draft.mjs";
import { buildPrefix, STATE_DIR, HELD_ABSENT_BODY } from "../site-builds.mjs";
import { manifestFromCsv, mergeRedirects } from "../site-seo.mjs";
import { r2Conditional } from "./fixtures/request-flow.mjs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

function store() {
  const m = new Map(); let at = 1;
  return {
    m,
    get: async (k) => { const o = m.get(k); return o ? { etag: o.etag, text: async () => o.body } : null; },
    put: async (k, body, _ct, onlyIf) => {
      const cur = m.get(k);
      if (!r2Conditional(onlyIf || {}, cur ? { etag: cur.etag, at: cur.at } : null)) return null;
      const etag = crypto.createHash("md5").update(body).digest("hex");
      m.set(k, { body, etag, at: at++ }); return { etag };
    },
  };
}
const V = (n) => "0179" + String(n).padStart(10, "0") + "-abcdef";
const LIVE = "sitemeta/bakery.json";
const side = (routes, redirects = "") => JSON.stringify({ routesCsv: routes, redirectsCsv: redirects, verify: [] });

// ── A11-3 ────────────────────────────────────────────────────────────────────
async function renamedDraft() {
  const s = store();
  // Live: /, /about, /visit. Draft revision 1 renamed About to Our story.
  await s.put(LIVE, side("/,/about,/visit"));
  await s.put(buildPrefix("bakery", V(1)) + STATE_DIR + "sidecar.json", side("/,/our-story,/visit", "/about=/our-story"));
  assert.equal((await saveDraftRecord(s, "bakery", { version: V(1) })).ok, true);
  return s;
}

test("B3-1 A11-3 A LATER DRAFT SAVE KEEPS THE RENAME'S REDIRECT — under draft-first the previous manifest is the standing draft's staged sidecar, so the next save (renamed = null) still maps /about to /our-story, not home", async () => {
  const s = await renamedDraft();
  const got = await previousSidecar(s, "bakery", { draftFirst: true, liveKey: LIVE });
  assert.equal(got.from, "draft");
  const prev = manifestFromCsv(got.side.routesCsv, got.side.redirectsCsv);
  const red = mergeRedirects(prev, ["/", "/our-story", "/visit"], null);
  assert.equal(red["/about"], "/our-story");
  // CONTROL — the live sidecar alone (the old read) sends /about home.
  const live = JSON.parse(s.m.get(LIVE).body);
  assert.equal(mergeRedirects(manifestFromCsv(live.routesCsv, live.redirectsCsv), ["/", "/our-story", "/visit"], null)["/about"], "/");
});

test("B3-2 A11-3 WITHOUT DRAFT-FIRST, OR WITH NO READABLE STAGED SIDECAR, THE LIVE SIDECAR IS READ; AN UNREADABLE DRAFT RECORD THROWS (never read as no history)", async () => {
  const s = await renamedDraft();
  assert.equal((await previousSidecar(s, "bakery", { draftFirst: false, liveKey: LIVE })).from, "live");
  s.m.delete(buildPrefix("bakery", V(1)) + STATE_DIR + "sidecar.json");
  assert.equal((await previousSidecar(s, "bakery", { draftFirst: true, liveKey: LIVE })).from, "live");
  await s.put(buildPrefix("bakery", V(1)) + STATE_DIR + "sidecar.json", HELD_ABSENT_BODY);
  assert.equal((await previousSidecar(s, "bakery", { draftFirst: true, liveKey: LIVE })).from, "live");
  const none = store();
  assert.equal(await previousSidecar(none, "bakery", { draftFirst: true, liveKey: LIVE }), null);
  const bad = store();
  await bad.put("site-drafts/bakery.json", "{not json");
  await assert.rejects(previousSidecar(bad, "bakery", { draftFirst: true, liveKey: LIVE }));
});

test("B3-3 A11-3 WIRING — composePublish reads its previous manifest through previousSidecar with the draft-first switch, never the live key directly", () => {
  const at = worker.indexOf("async function composePublish(");
  const end = worker.indexOf("const redirects = mergeRedirects(prev, man.routes, renamed);", at);
  assert.ok(at > 0 && end > at, "both landmarks");
  const body = worker.slice(at, end);
  assert.match(body, /previousSidecar\(buildDeps\(env\), slug, \{ draftFirst: draftFirst\(env\), liveKey: siteMetaKey\(slug\) \}\)/);
  assert.doesNotMatch(body, /SITES_BUCKET\.get\(siteMetaKey\(slug\)\)/);
});
