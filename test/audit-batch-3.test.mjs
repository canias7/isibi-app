// AUDIT BATCH 3 (2026-10-22): findings 21-24 of
// docs/audits/2026-10-17-builder-audit.md. Offline; nothing spent.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { saveDraftRecord, previousSidecar } from "../site-draft.mjs";
import { buildPrefix, STATE_DIR, HELD_ABSENT_BODY } from "../site-builds.mjs";
import { manifestFromCsv, mergeRedirects } from "../site-seo.mjs";
import { carryPanelFields } from "../site-meta.mjs";
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

// ── A11-2 ────────────────────────────────────────────────────────────────────
const S = (o) => JSON.stringify(o);

test("B3-4 A11-2 PUBLISH KEEPS A PANEL CHANGE MADE AFTER THE DRAFT WAS STAGED — the verification tag always; the card and description when the live head differs from the staged head of the version that was live; an edit's description saved in the draft stands", () => {
  const prior = S({ description: "Bread.", image: "/u/b/a.jpg", origin: "https://b.gofarther.app", routesCsv: "/", redirectsCsv: "", verify: [] });
  const live = S({ description: "Fresh bread daily.", image: "/u/b/c.jpg", origin: "https://b.gofarther.app", routesCsv: "/", redirectsCsv: "", verify: [{ name: "google-site-verification", content: "tok" }] });
  const draft = S({ description: "Bread.", image: "/u/b/a.jpg", origin: "https://b.gofarther.app", routesCsv: "/,/visit", redirectsCsv: "/old=/", verify: [] });
  const out = JSON.parse(carryPanelFields(draft, live, prior));
  assert.deepEqual(out.verify, [{ name: "google-site-verification", content: "tok" }]);
  assert.equal(out.description, "Fresh bread daily.");
  assert.equal(out.image, "/u/b/c.jpg");
  assert.equal(out.routesCsv, "/,/visit"); assert.equal(out.redirectsCsv, "/old=/");
  // An edit's description in the draft, no panel change since: the draft's.
  const edited = S({ ...JSON.parse(draft), description: "Sourdough on the quay." });
  assert.equal(JSON.parse(carryPanelFields(edited, prior, prior)).description, "Sourdough on the quay.");
  // Nothing to carry: the same bytes back. Unreadable live: the version's own.
  assert.equal(carryPanelFields(draft, prior, prior), draft);
  assert.equal(carryPanelFields(draft, null, prior), draft);
  assert.equal(carryPanelFields(draft, "{bad", prior), draft);
  assert.equal(carryPanelFields(draft, S({ held: "absent" }), prior), draft);
  // No prior staged head: the verification tag only.
  const np = JSON.parse(carryPanelFields(draft, live, null));
  assert.equal(np.description, "Bread."); assert.equal(np.verify.length, 1);
});

test("B3-5 A11-2 WIRING — Publish (when it moves the pointer) and restore hand activation the version's sidecar through withPanelFields, never the staged bytes alone", () => {
  const pub = worker.indexOf("async function runPublication(");
  const pubEnd = worker.indexOf("const act = await activateBuild(deps, {", pub);
  assert.ok(pub > 0 && pubEnd > pub, "runPublication landmarks");
  assert.match(worker.slice(pub, pubEnd), /if \(j\.from !== j\.version\) sidecar = await withPanelFields\(deps, slug, sidecar, j\.from\);/);
  const rs = worker.indexOf("async function restoreVersion(");
  const rsEnd = worker.indexOf("putWorker:", rs);
  assert.ok(rs > 0 && rsEnd > rs, "restoreVersion landmarks");
  const r = worker.slice(rs, rsEnd);
  assert.match(r, /sidecar: await withPanelFields\(deps, slug, /);
  assert.doesNotMatch(r, /sidecar: typeof b\.sidecar === "string" \? b\.sidecar : undefined, sidecarKey/);
  assert.match(worker, /async function withPanelFields\(deps, slug, sidecar, prior\) \{[\s\S]{0,400}carryPanelFields\(sidecar, live, was\)/);
});
