// PARKED (2026-11-03, park-old-way): the old-way half of test/site-alias.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// RENAMING A SITE (owner, 2026-08-29: "now the slug lane" → "yeah do the alias
// one"). The last unbuilt lane on the platform, and the one whose failure mode
// is permanent: a rename leaves the old address 301ing to the new one forever,
// so every decision here is one nobody can take back.
//
// WHAT THIS FILE IS MOSTLY ABOUT is that distinction. Everywhere else on this
// platform a wrong answer is visible and undoable, and the bias is toward
// acting. Here it inverts — twice, in two different places — and both inversions
// are asserted, because they read as timidity to anyone who does not know why.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  cleanAlias, resolveAlias, renameRows, aliasRefusal, readRename, readForget,
  RENAME_TOOL, renameRequest, ALIAS_SQL, MAX_ALIAS,
} from "../../../builder/site-alias.mjs";
import { LANE_FIELDS, OWN_LANES, DISPATCHED_LANES, UNBUILT_LANES, laneLayer, laneUnbuilt } from "../../../builder/site-lanes.mjs";
import { EDIT_LAYERS } from "../../../builder/route-shared.mjs";

const worker = readFileSync("worker.js", "utf8");
const bare = (s) => s.split("\n").map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
const w = bare(worker);

/* ── the write order is the recovery story ──────────────────────────────── */

test("the OLD name is recorded before the new one is made current", () => {
  const r = renameRows({ slug: "shoeroom-1", uid: "u", from: "shoeroom-1", to: "sunset-shoes" });
  assert.equal(r.demote.alias, "shoeroom-1");
  assert.equal(r.demote.current, false);
  assert.equal(r.promote.alias, "sunset-shoes");
  assert.equal(r.promote.current, true);
  // BOTH ROWS CARRY THE STORAGE SLUG, never the new name — the alias is an
  // address and the slug is the key, and confusing them is the one mistake this
  // whole design exists to make impossible.
  assert.equal(r.demote.slug, "shoeroom-1");
  assert.equal(r.promote.slug, "shoeroom-1");
  // A no-op rename produces nothing to write.
  assert.equal(renameRows({ slug: "s", uid: "u", from: "same", to: "same" }), null);
  assert.equal(renameRows({ slug: "s", uid: "u", from: "ok-name", to: "café" }), null);

  // THE ORDER IS ASSERTED IN THE WORKER TOO, because the object above cannot
  // enforce it — the failure between the two writes has to be the harmless one.
  const at = w.indexOf("const badOld = await putAlias(rows.demote);");
  const then = w.indexOf("const badNew = await putAlias(rows.promote);");
  assert.ok(at > 0, "the rename no longer records the old name");
  assert.ok(then > at, "the new name is made current BEFORE the old one is claimed — a failure between them frees an address a live site still redirects from");
});

/* ── the chain ──────────────────────────────────────────────────────────── */

test("THE CHAIN — resolution sits before the rewrite, and a rename republishes", () => {
  // hop 1: the serve path resolves BEFORE the path rewrite, because the rewrite
  // builds `/s/<slug>/` and needs the STORAGE slug. Resolving after it would
  // send every renamed site's request to a prefix that does not exist.
  const resolve = w.indexOf("const row = await aliasRowFor(env, zoneSlug);");
  const rewrite = w.indexOf('url.pathname = "/s/" + zoneSlug +');
  assert.ok(resolve > 0, "the serve path never resolves an alias");
  assert.ok(rewrite > resolve, "the alias is resolved AFTER the path is rewritten, so a renamed site 404s");

  // hop 2: an old name 301s, permanently — a temporary redirect consolidates
  // nothing, which is the same argument the `/s/` redirect already makes.
  const win = w.slice(resolve, rewrite);
  assert.match(win, /Response\.redirect\([^)]*301\)/, "an old address does not permanently redirect to the new one");

  // …AND THE RESOLVED SLUG IS ACTUALLY USED. Found by a sweep (2026-08-29):
  // deleting the assignment SURVIVED, because everything above tested the
  // ORDERING of two landmarks and nothing tested the line between them. Without
  // it a renamed site is looked up correctly and then served from `/s/<public
  // name>/` — a prefix that does not exist — so the rename resolves and 404s.
  // The wiring trap again: every piece right, one hop cut.
  assert.match(win, /zoneSlug = out\.slug/,
    "the resolved storage slug is never assigned back, so a renamed site is served from a prefix that does not exist");

  // hop 3: a name is not free just because we could not check. Handing one out
  // on a failed lookup is how two sites end up sharing an address.
  assert.match(w, /takenByAlias === null/, "a failed alias lookup reads as a free name");
  // …AND A SITE'S OWN STORAGE NAME IS NEVER TAKEN FROM IT (run 18, 2026-09-02:
  // the way back from crookes-guitar to fretwork-1 was refused as "taken by
  // another site", because the storage slug IS a site — this one). The site
  // check is skipped for the site's own slug; test/site-public-url.test.mjs
  // drives the way back and reads the rows and the head.
  assert.match(w, /wanted === ownerSlug \? false : await siteNameTaken\(env, wanted\)/,
    "the site check does not exempt the site's own storage name, so a rename cannot be undone");

  // hop 4: THE HEAD FOLLOWS THE ADDRESS WITHOUT A COMPILE. The canonical link
  // and og:url are read per request out of the R2 sidecar's `origin`; the
  // branch patches that one key the moment the alias is current (the share and
  // verify routes' pattern). It used to republish instead — and the spine baked
  // the STORAGE slug, so the republish would have named the old address anyway.
  // Run 17 (2026-09-02), the first live rename: alias live, canonical stale.
  const branch = w.indexOf('if (eLayer === "rename") {');
  assert.ok(branch > 0, "there is no rename branch in the worker");
  const end = w.indexOf('if (eLayer === "nav") {', branch);
  assert.ok(end > branch, "the rename branch has no end — this window would run to the end of the file");
  const body = w.slice(branch, end);
  const patch = body.indexOf("side.origin = addressOf(wanted);");
  assert.ok(patch > 0, "a rename does not patch the sidecar's origin, so its canonical keeps naming the old address");
  assert.ok(patch > body.indexOf("const badNew = await putAlias(rows.promote);"), "the head is patched before the new name is current");
  assert.match(body.slice(patch, patch + 300), /SITES_BUCKET\.put\(siteMetaKey\(ownerSlug\)/, "the patched sidecar is never written back");
  assert.ok(!/publishStep\(|recompileAndPublish\(/.test(body), "the rename branch still republishes — a compile a lost lease can leave half-done, for a head one R2 write deploys");

  // hop 5: EVERY WRITER OF THE CANONICAL DERIVES IT FROM THE PUBLIC NAME. Both
  // publish sites passed `siteUrlFor` the storage slug, so a renamed site's next
  // colour change would have put the old address straight back.
  assert.ok(!/siteUrlFor\(slug, "https:\/\/" \+ APP_ZONE\)/.test(w), "a publish site still builds the sidecar's origin from the storage slug");
  assert.ok(!/siteUrlFor\(env,/.test(w), "a caller hands siteUrlFor the env where it wants a name");
  const uses = (w.match(/await publicUrlFor\(env, slug\)/g) || []).length;
  assert.ok(uses >= 4, "the public address reaches fewer writers than it has (spine, build, resume reply, checkout return): " + uses);
  const at = w.indexOf("async function publicUrlFor(");
  assert.ok(at > 0, "there is no one reader of the public address");
  assert.match(w.slice(at, w.indexOf("\n}", at)), /await publicNameFor\(env, slug\)/, "publicUrlFor does not ask the alias table");
});

test("THE FORGET CHAIN — the serve path asks what a row-less label's site is called now, and answers gone", () => {
  // hop 1: the no-row case passes the site's current name, looked up by the
  // label as a slug, or the resolver has nothing to tell a forgotten storage
  // name from a never-renamed site.
  const resolve = w.indexOf("const out = resolveAlias(zoneSlug, seen, now);");
  assert.ok(resolve > 0, "the serve path no longer resolves an alias");
  const nowAt = w.lastIndexOf("const now = ", resolve);
  assert.ok(nowAt > 0 && resolve - nowAt < 400, "the current-name lookup is not beside the resolve");
  assert.match(w.slice(nowAt, resolve), /: await publicNameFor\(env, zoneSlug\)/, "a label with no row is served without asking what its site is called now");
  // hop 2: gone is a 404 that is never cached — the name may be a site again.
  const gone = w.indexOf("if (out.gone) {", resolve);
  const redirect = w.indexOf("if (out.redirect) {", resolve);
  assert.ok(gone > resolve && redirect > gone, "a gone address is not answered before the redirect is considered");
  assert.match(w.slice(gone, redirect), /status: 404/, "a gone address is not a 404");
  assert.match(w.slice(gone, redirect), /"cache-control": "no-store"/, "a gone address's 404 can be cached past the name's next life");
  // hop 3: our own `/s/<slug>/` reaches the site under its CURRENT name.
  assert.match(w, /siteHostFor\(await publicNameFor\(env, sm2\[1\]\.toLowerCase\(\)\)\)/, "/s/<slug>/ redirects to the storage name, which a forget can take away");
  // hop 4: the lane deletes by alias AND slug AND not-current, in one request
  // that hands back what it removed — nothing removed is a stranger — and the
  // current name is refused by name before anything is deleted.
  const branch = w.indexOf('if (eLayer === "rename") {');
  const body = w.slice(branch, w.indexOf('if (eLayer === "nav") {', branch));
  assert.match(body, /former: await formerNamesFor\(env, ownerSlug\)/, "the model is not shown the site's old names");
  assert.match(body, /site_aliases\?alias=eq\.\$\{encodeURIComponent\(drop\)\}&slug=eq\.\$\{encodeURIComponent\(ownerSlug\)\}&current=is\.false/, "the delete is not scoped to this site's own old names");
  assert.match(body, /method: "DELETE"/, "nothing is deleted");
  assert.match(body, /Prefer: "return=representation"/, "the delete does not hand back what it removed, so a stranger reads as forgotten");
  const live = body.indexOf("if (drop === current)");
  assert.ok(live > 0 && live < body.indexOf('method: "DELETE"'), "the current name is not refused before the delete");
  assert.match(body, /forgetAlias\(ownerSlug, drop\)/, "the lane's own isolate keeps serving the forgotten name");
});
