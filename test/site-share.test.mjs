// The share-image picker (2026-08-28, owner's call: "ok do 2").
//
// Which of the owner's OWN uploads is the link-preview picture. The platform's
// pick was "smallest content hash wins" — `siteUploadList` never sorts and a
// key is the SHA-256 of the file's own bytes — recorded 2026-08-14 as the
// residue of the og:image fix: the choice existed nowhere at any price.
//
// The module halves (`share` on the config, `uploadIsImage`) are driven
// directly; the route and the panel are asserted as WIRING, which is the layer
// twelve features have died in with every module beneath them fine.

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { CONFIG_FIELDS, emptyConfig, readConfig, writeConfig, withConfig } from "../site-config.mjs";
import { uploadIsImage, UPLOAD_EXTS } from "../site-uploads.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

// The comments around the route spell the things asserted here (the
// prose-contains-the-spelling trap, nine-plus recorded instances), so every
// source scan runs over a length-preserving blank of the whole-line comments.
const blank = (src) => src.replace(/^\s*(?:\/\/|#)[^\n]*$/gm, (m) => " ".repeat(m.length));

function windowOf(src, from, to) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, "anchor missing: " + from);
  const b = src.indexOf(to, a);
  assert.ok(b > a, "closing landmark missing: " + to);
  return src.slice(a, b);
}

/* ── the config field ────────────────────────────────────────────────────── */

test("`share` is a declared config field, so no other lane's patch can drop it", () => {
  // `withConfig` rebuilds its output from CONFIG_FIELDS alone — the same
  // mechanism that made `site_tokens` and `site_logo` their own keys: a value
  // stored outside the declared list is DESTROYED by the next unrelated patch.
  // With the field declared, a look edit keeps the choice by construction.
  assert.ok(CONFIG_FIELDS.includes("share"), "the choice is stored where the next patch wipes it");
  const kept = withConfig({ ...emptyConfig(), share: "9a4c.jpg" }, { css: "b{}" });
  assert.equal(kept.share, "9a4c.jpg", "a stylesheet edit dropped the owner's preview choice");
  // The round trip holds it, and a wrong type reads as absent rather than
  // reaching a URL.
  assert.equal(readConfig(writeConfig({ share: "9a4c.jpg" })).share, "9a4c.jpg");
  assert.equal(readConfig(writeConfig({ share: ["9a4c.jpg"] })).share, "",
    "an array-shaped choice was coerced rather than refused");
  // Clearing is a REAL value: "" must survive a merge, or the owner cannot go
  // back to the platform's pick.
  assert.equal(withConfig({ ...emptyConfig(), share: "9a4c.jpg" }, { share: "" }).share, "");
});

/* ── what may be chosen ──────────────────────────────────────────────────── */

test("uploadIsImage: documents are refused, every image extension passes", () => {
  // One truth table shared with the panel's kind label — two copies of "pdf or
  // a zip member is a document" is how a format added to one list turns up
  // choosable in the other. An og:image pointing at a document renders NOTHING
  // in a chat app's card, silently.
  for (const ext of ["png", "jpg", "webp", "gif"]) {
    assert.equal(uploadIsImage("a1b2." + ext), true, ext + " should be choosable");
  }
  for (const ext of UPLOAD_EXTS.filter((e) => !["png", "jpg", "webp", "gif"].includes(e))) {
    assert.equal(uploadIsImage("a1b2." + ext), false, ext + " is a document and must not be a preview");
  }
});

test("the upload list says WHO added each file, so the panel can withhold the button", () => {
  // `visitor` has to travel to the client: a button the server then refuses
  // teaches the owner a dead click, and a button that worked would hand a
  // stranger's form upload the business's preview slot.
  const w = blank(fs.readFileSync(new URL("../site-uploads.mjs", import.meta.url), "utf8"));
  const list = windowOf(w, "export async function handleUploadList(", "\nexport ");
  assert.match(list, /o\.visitor \? \{ visitor: true \} : \{\}/,
    "the list no longer marks visitor files — the panel offers the preview button on a stranger's upload");
  // And the kind label derives through the SAME reading the picker gates on.
  assert.match(list, /uploadIsImage\(name\)/,
    "the panel's image/document split stopped sharing the picker's reading");
});

/* ── the route ───────────────────────────────────────────────────────────── */

const w = blank(worker);
const route = windowOf(w, "} else if (sh) {", "} else if (nt) {");

test("the share route is dispatched, owner-gated, and GET answers the stored choice", () => {
  // The matcher, in the dispatch condition and the ownerSlug list both —
  // api-auth holds matchers ↔ condition in general; this pins the one that a
  // list edit would drop first.
  assert.match(w, /const sh = url\.pathname\.match\(\/\^\\\/api\\\/site\\\/\(\[a-z0-9\]\[a-z0-9-\]\{0,80\}\)\\\/share\$\/i\);/,
    "the /share matcher is gone");
  assert.match(route, /assertOwner\(ownerDeps, shslug, ou\.id\)/,
    "the share route is not behind the ownership gate");
  // The GET returns what is stored, or the panel cannot mark the chosen tile
  // and every click reads as setting a fresh choice.
  assert.match(route, /Response\.json\(\{ ok: true, share: shStored \}\)/,
    "the stored choice is write-only — the panel cannot show which file is chosen");
});

test("the backend read is the THREE-WAY one, so a blip cannot strand a pre-migration look", () => {
  // `siteBackendBySlug` answers null for "no database" AND "could not resolve
  // one". On the second, patching with no legacy ramp writes a fresh R2 config
  // over a `_meta` site's look — the stranding `site_lang_strings` records.
  // `siteBackendRowFresh` THROWS on cannot-tell and answers `{conn: null}`
  // only for a site that genuinely has none — which is the DEFAULT kind since
  // 2026-08-25, so requiring a conn (the verify route's shape) would 503 the
  // picker on every frontend-only site.
  assert.match(route, /siteBackendRowFresh\(env, shslug\)/,
    "the route reads the cached conn — cannot-tell reads as no-database and strands the look");
  const readTry = windowOf(route, "let shRow;", "const shconn");
  assert.match(readTry, /catch \(e\)/, "a failed backend read is not caught");
  assert.match(readTry, /status: 503/, "cannot-tell does not refuse — it proceeds and strands");
  assert.match(route, /readSiteConfig\(env, shslug, shconn\)/,
    "the config read does not carry the legacy ramp the row resolved");
  // And an unreadable config REFUSES rather than showing a blank picker whose
  // next POST writes over a choice that is already stored.
  const cfgAt = route.indexOf("readSiteConfig(env, shslug, shconn)");
  assert.match(route.slice(cfgAt, cfgAt + 400), /if \(!shCfg\.ok\)/,
    "an unreadable config proceeds as an empty one");
});

test("a choice is validated against the LIVE LIST: owner's own, an image, or refused", () => {
  // The three refusals, each a real failure it prevents. A name not in the
  // list cannot be stored (so the stored value can never address anything);
  // `!o.visitor` keeps a stranger's form upload out of the business's preview
  // slot (the 2026-08-13 `|| objs[0]` finding, closed at the choosing end
  // too); a document renders nothing in the chat app's card.
  assert.match(route, /shObjs\.find\(\(o\) => o && !o\.visitor && o\.key\.split\("\/"\)\.pop\(\) === shName\)/,
    "the choice is not matched against the owner's own live uploads");
  assert.match(route, /if \(!shHit\) return /, "a name outside the list is stored anyway");
  assert.match(route, /if \(!uploadIsImage\(shName\)\)/, "a document can be chosen as the preview");
  // A non-string, non-null `file` is REFUSED, never coerced: String(["a.png"])
  // is "a.png", the array-coercion bug this codebase has shipped three times.
  assert.match(route, /shBody\.file !== null && typeof shBody\.file !== "string"/,
    "a non-string choice is coerced rather than refused");
  // Clearing is expressible: null stores "" through the SAME patch call.
  assert.match(route, /patchSiteConfig\(env, shslug, shconn, \{ share: shFile \}\)/,
    "the choice does not go through the config patch — another lane's write will drop it");
});

test("the sidecar takes effect now, RE-DERIVED through the one reader, best-effort", () => {
  // The verify route's pattern: the site's own Worker reads its head out of the
  // sidecar, so patching that one key is the whole deployment. The value comes
  // from `siteOgImage` — the ONE reader of the precedence — never composed
  // here, or the sidecar and the next publish drift about what the preview is.
  assert.match(route, /await siteOgImage\(env, shslug, null\)/,
    "the sidecar patch composes its own copy of the precedence");
  assert.match(route, /side\.image = img \|\| ""/,
    "the recomputed preview never reaches the sidecar");
  // Best-effort: a failed sidecar patch is a delay (next publish), never a lost
  // save — the catch must not rethrow, and the response says WHICH of the two
  // happened, because "saved" and "live right now" are different facts.
  const sideAt = route.indexOf("let shLive = false;");
  assert.ok(sideAt > 0, "the live flag is gone");
  const sideBlock = route.slice(sideAt);
  const sideCatch = sideBlock.indexOf("catch (e)");
  assert.ok(sideCatch > 0 && !/\bthrow\b/.test(sideBlock.slice(sideCatch)),
    "a failed sidecar patch fails the save the owner already made");
  assert.match(sideBlock, /live: shLive/,
    "the response does not say whether the change is live or waiting for a publish");
  // ORDERING: the config is patched BEFORE the recompute reads it back, or the
  // sidecar is derived from the choice the owner just replaced.
  const patchAt = route.indexOf("patchSiteConfig(env, shslug, shconn, { share: shFile })");
  const recomputeAt = route.indexOf("await siteOgImage(env, shslug, null)");
  assert.ok(patchAt > 0 && recomputeAt > patchAt,
    "the sidecar is recomputed from the config the patch has not written yet");
});

/* ── the panel ───────────────────────────────────────────────────────────── */

test("the panel fetches the choice, offers the button on eligible tiles only, and posts it", () => {
  const c = blank(chat);
  const files = windowOf(c, "async function siteFiles(site)", "\nfunction siteEmails");
  // The stored choice rides beside the list — a failed read degrades to no
  // badge, never to a dead panel.
  assert.match(files, /\/share'\)\.then\(\(r\) => r\.json\(\)\)\.catch\(\(\) => \(\{\}\)\)/,
    "the panel never learns which file is chosen");
  // Only a PICTURE the OWNER added gets the button: the server refuses both
  // other cases, and a button it would refuse teaches a dead click.
  assert.match(files, /const canShare = !doc && !f\.visitor;/,
    "the preview button is offered on documents or on a visitor's upload");
  // The click posts the toggle — the current choice clears, another sets — and
  // the toast reads the server's `live` flag rather than promising "now" about
  // a change that is waiting for the next publish.
  assert.match(files, /body: JSON\.stringify\(\{ file: wasOn \? null : name \}\)/,
    "the panel cannot clear a choice, or posts a shape the route refuses");
  assert.match(files, /d2\.live \?/,
    "the toast promises 'now' about a change that may be waiting for a publish");
});

test("the toggle's active state is a filled row, not a colour alone", () => {
  // The kit's own status discipline: state carried by fill and a check mark,
  // so it survives greyscale and anyone who cannot separate the hues.
  assert.match(styles, /\.fl-share-on\{background:var\(--text\);color:var\(--bg\)/,
    "the chosen tile's state is not visibly filled");
  // The check mark is spelled as the file's own `\u2713` escape convention.
  assert.match(chat, /Link preview \\u2713/, "the active label lost its mark");
});
