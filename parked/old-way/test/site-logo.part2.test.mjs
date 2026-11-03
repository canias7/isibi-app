// PARKED (2026-11-03, park-old-way): the old-way half of test/site-logo.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// "Hey, this is my logo, put it there."
//
// The owner's own words for how this should work, after turning down a picker
// in the uploads panel. The attachment IS which picture — nothing to match,
// nothing to remember — which is why the whole layer needs no model call.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { withConfig } from "../../../site-config.mjs";
import { MARKS, markWire, markUrlOk } from "../../../builder/site-mark.mjs";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const b64 = (u8) => Buffer.from(u8).toString("base64");
const dataUrl = (u8, mime = "image/png") => `data:${mime};base64,${b64(u8)}`;
const sniff = (b) => (b && b[0] === 0x89 && b[1] === 0x50 ? { mime: "image/png", ext: "png" } : null);

const deps = (o = {}) => {
  const seen = { stored: 0, saved: [], published: 0 };
  return {
    seen,
    d: {
      sniff,
      store: async () => { seen.stored++; if (o.storeThrows) throw new Error("R2 down"); return "storeUrl" in o ? o.storeUrl : "/u/cafe/abc.png"; },
      save: async ({ logo }) => { seen.saved.push(logo); if (o.saveThrows) throw new Error("pg down"); },
      publish: async () => { seen.published++; return o.publish === undefined ? { ok: true, files: 21 } : o.publish; },
    },
  };
};

/* ── the layer's own boundary ────────────────────────────────────────────── */

test("THE LANE CANNOT REACH A MODEL OR THE DATABASE", () => {
  // The whole claim of this rung is that it costs nothing beyond the routing
  // call that already happened. A model call appearing in here would make that
  // false silently — the price is in the source, not in a comment.
  const src = fs.readFileSync(new URL("../builder/site-logo.mjs", import.meta.url), "utf8");
  for (const forbidden of ["anthropicMessages", "claude-", "generateSitePages", "sqlQuery", "sqlExec", "applySiteSchema"]) {
    assert.ok(!src.includes(forbidden), "the logo lane can reach " + forbidden);
  }
});

/* ── the wiring, which nothing else can see ──────────────────────────────── */

const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
const header = fs.readFileSync(new URL("../../../builder/lovable/template/src/components/ui/site-header.tsx", import.meta.url), "utf8");
const buildServer = fs.readFileSync(new URL("../../../builder/build-server.mjs", import.meta.url), "utf8");

/** The brand writer's body. Anchored on the function rather than sliced to a
 *  byte count — a well-commented insertion is what has repeatedly walked a
 *  fixed window off the thing it was written to guard. */
function brandWriter() {
  const i = buildServer.indexOf("function writeSiteBrand(");
  assert.ok(i > 0, "the brand writer moved — rescope this");
  const end = buildServer.indexOf("\nfunction ", i + 10);
  const block = buildServer.slice(i, end > i ? end : undefined);
  assert.ok(block.length > 400, "the brand-writer window is suspiciously small — rescope this");
  return block;
}

test("an uploaded mark is a FORM on the look, and setting one mark keeps the other", () => {
  // REWRITTEN 2026-09-07, AND ITS PREMISE IS DELIBERATELY INVERTED. This guard
  // used to assert the opposite — that the logo was its own config field and
  // NEVER a member of the look — because `mergeLook` rebuilds its output from
  // `EDIT_FIELDS` alone, so anything else stored there was dropped by the next
  // colour change. That reason expired when a mark became an `EDIT_FIELDS` key
  // in its own right (`wordmark`, `favicon`), which is exactly this repository's
  // "a rule true because of a layer below it expires when that layer moves".
  //
  // WHAT IS ASSERTED NOW is the invariant that survived the inversion: an upload
  // is stored in the same field and the same shape as a drawing, so whichever
  // was set last is what the site wears — and setting ONE mark must still leave
  // the other exactly as it was.
  const edit = fs.readFileSync(new URL("../../../builder/site-edit.mjs", import.meta.url), "utf8");
  for (const f of MARKS) {
    assert.match(edit, new RegExp('EDIT_FIELDS = \\[[^\\]]*"' + f + '"'),
      f + " is not on EDIT_FIELDS, so a look edit will drop the mark stored there");
  }
  assert.match(worker, /\[field\]: next \} \}, jobFence\(env, eJob\)\);/,
    "the logo rung no longer writes the mark as a form on the look");
  assert.match(worker, /const next = url \? \{ form: "image", url \} : markRemove\(c\.config, field\);/,
    "an upload is not stored as an `image` form, or a removal does not ask what is under it");
  // THE LOOK IS READ AND MERGED, NEVER PATCHED FIELD BY FIELD, and this is the
  // half that would be catastrophic to get wrong: `withConfig` replaces a named
  // config field WHOLE, so `{ look: { wordmark } }` takes the theme, the brand,
  // the description and every language off the site. Driven through the real
  // merge, because the first cut of this change did exactly that.
  const stripped = withConfig({ look: { theme: "Warm Brick", brand: "CGS" } }, { look: { wordmark: { form: "text" } } });
  assert.equal(stripped.look.theme, undefined,
    "withConfig started merging `look`, so the rung's read-then-spread is now belt and braces — say so rather than deleting it");
  const sv = worker.indexOf("save: async (patch) => {");
  const body = worker.slice(sv, worker.indexOf("\n                },", sv));
  assert.match(body, /const look = c\.config\.look[^\n]*\n[\s\S]*\.\.\.look,/,
    "the rung writes a look it did not read and merge, so one mark strips the rest of the design");
  assert.match(body, /if \(!c\.ok\) throw new Error/,
    "a look that could not be READ is written over anyway, which publishes a stripped site as a success");
  // AND `withConfig`'s ABSENT-MEANS-UNCHANGED STILL KEEPS THE OTHER SLOT.
  const both = withConfig({ look: { wordmark: { form: "image", url: "/u/s/logo.png" } } },
    { look: { wordmark: { form: "image", url: "/u/s/logo.png" }, favicon: { form: "image", url: "/u/s/new.png" } } });
  assert.equal(both.look.wordmark.url, "/u/s/logo.png", "setting the icon cleared the logo");
  assert.equal(both.look.favicon.url, "/u/s/new.png");
});

test("THE ROUTE IS REACHABLE AND THE CLIENT SENDS THE PICTURE", () => {
  // Both ends, because either alone passes while the wire is cut — which this
  // repo has recorded as the failure shape ten times over.
  assert.match(worker, /if \(eLayer === "logo"\)/, "the Worker has no logo branch");
  // Since 2026-10-23 (#162, A25-1) the picture step is sent the files too.
  assert.match(chat, /images: \(d\.layer === 'logo' \|\| d\.layer === 'picture'\)/, "the client never sends the attachment to the edit route");
  // RE-ANCHORED 2026-10-02: the files that go with the work start as this
  // message's own (`sendImgs`), and an answered question adds its request's.
  assert.match(chat, /let sendImgs = Array\.isArray\(imgs\) \? imgs\.slice\(0, 3\) : \[\];/, "the work's files are not the message's own");
  // RE-ANCHORED 2026-10-24: its fallback is the said climb, never the rewrite (`go`).
  assert.match(chat, /siteEdit\(site, d, run, origin, finish, climbed, sendImgs\)/, "siteEdit is not given the attachments");
});

test("…and the router can name the layer", () => {
  const ask = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  assert.match(ask, /EDIT_LAYERS = \[[^\]]*"logo"/, "the router cannot answer `logo`");
  assert.match(ask, /\\"logo\\" —/, "the layer is offered with no description, so nothing will pick it");
  // `remove` used to be documented as page-only. A logo removal rides the same
  // field, and a description that still says "only when layer is page" is a
  // rule that stops the model ever setting it here.
  //
  // WINDOWED TO THAT FIELD. The first draft searched the whole file and went red
  // on the `page` field one entry above, whose description says "only when layer
  // is page" and is CORRECT to — a false alarm on a sibling's right answer,
  // which is exactly the class of check this repo keeps recording.
  const rm = ask.indexOf("      remove: {");
  assert.ok(rm > 0, "the remove field is gone");
  const removeDesc = ask.slice(rm, ask.indexOf("\n      },", rm));
  assert.ok(!/Only when layer is \\"page\\"/.test(removeDesc), "remove is still documented as page-only");
  assert.match(removeDesc, /For layer \\"logo\\"/, "the model is never told remove applies to a logo");
  // An attachment is never a removal — otherwise "here's the new logo" could
  // take the old one off and put nothing back.
  assert.match(removeDesc, /ATTACHES[\s\S]{0,60}never a removal/, "nothing rules out a removal on a message carrying a picture");
});

test("A REFUSAL IS NEVER ESCALATED to a full revise", () => {
  // The rung above cannot put a logo in a header either — it would spend ~27
  // credits rewriting pages and end with the same missing logo, which reads as
  // the builder ignoring what was asked.
  const i = worker.indexOf('if (eLayer === "logo")');
  const block = worker.slice(i, worker.indexOf('if (eLayer === "text")', i));
  assert.ok(block.length > 400, "the logo branch window is not reading the branch");
  assert.ok(!/return escalate\(lOut/.test(block), "a logo refusal escalates into a paid revise");
  assert.match(block, /msg: lOut\.msg/, "the module's own sentence is dropped");
});

// ── REACHABLE, WHICH IS THE HALF THAT KEEPS DYING ───────────────────────────

test("the whole tab-icon wire holds, end to end", () => {
  // `remove` was decided by `readEdit` and dropped by the route for the entire
  // life of the logo layer, and then AGAIN for page deletion — both found only
  // by a live run answering `undefined`. Every hop is asserted here rather than
  // after the fact.
  const ask = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const c = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");

  // 1. the model can say it
  assert.match(ask, /\n {6}tab: \{\n {8}type: "boolean"/);
  // 2. readEdit reads it, scoped to the layer that has two slots, and strictly
  assert.match(ask, /layer === "logo" && input && input\.tab === true/);
  // 3. the route returns it
  assert.match(w, /tab: routed\.intent === "edit" && routed\.tab === true \? true : undefined,/);
  // 4. the client posts it back as a real boolean
  assert.match(c, /\n {6}tab: d\.tab === true,/);
  // 5. the worker hands it to the module
  //    — never on a hand-over (2026-10-02, the whole-router audit's W1; driven in
  //    `handover-route.test.mjs`).
  assert.match(w, /tab: !eHanded && !!\(eb && eb\.tab === true\) \}\);/);
});

test("the two slots are two _meta keys, and the icon reaches the container from BOTH publish paths", () => {
  // The container rewrites `site-brand.ts` on EVERY build, so a path that does
  // not send the stored icon sends nothing and the site falls back to its
  // initials. That is exactly the bug `priorLogo` exists to prevent, one key
  // over — a customer who sent a favicon and then fixed a typo would have
  // watched it vanish.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // TWO FIELDS, ONE PER SLOT, and the lane names which. A wordmark is legible at
  // a few hundred pixels and a smear at 16, so a site can have both and setting
  // one must not clear the other.
  // RE-ANCHORED 2026-09-07. This pinned the rung's two-key patch
  // (`icon ? { icon: … } : { logo: … }`), which went when a mark became ONE
  // look field carrying a form. THE PROPERTY IS UNCHANGED: the rung still
  // decides WHICH of the two slots it is writing, from the module's own answer
  // and not from a flag re-read here, so setting one cannot touch the other.
  assert.match(w, /const field = Object\.prototype\.hasOwnProperty\.call\(patch, "icon"\) \? "favicon" : "wordmark";/,
    "the rung no longer picks its slot from the module's own patch");
  // AND A FAILED SAVE MUST THROW. `runLogoEdit` catches `deps.save` and answers
  // "I couldn't save that just now — your site is unchanged", which is the
  // honest refusal; swallowing the store's `{ok:false}` instead publishes and
  // tells the customer their logo landed while nothing holds it. Found by
  // mutation — deleting the throw passed the whole suite.
  const sv = w.indexOf("save: async (patch) => {");
  assert.ok(sv > 0, "the logo lane's save dep is gone");
  assert.match(w.slice(sv, w.indexOf("\n                },", sv)), /if \(!w\.ok\) throw new Error\(w\.error\);/,
    "the logo lane swallows a failed save, so a lost logo reads as a success");
  // read on the cheap-edit spine AND on the build path — RE-ANCHORED 2026-09-07
  // off the four bindings that moved (`{ look, css, logo, icon, … }`,
  // `priorIcon = cfg.config.icon`, `icon: icon || ""` on the spine and
  // `icon: priorIcon` on the revise) and onto the ONE projection that replaced
  // them. The property is the same and is now stronger: a path cannot read the
  // marks and send half of them, because both halves come from one call.
  assert.match(w, /marks = markWire\(cfg\.config\);/);
  assert.match(w, /priorLook = lookWithMarks\(cfg\.config\);/);
  // and sent on both
  assert.match(w, /\n {10}icon: marks\.icon,/);
  assert.match(w, /\.\.\.markWire\(\{ look \}\),/);
  // …AND "BOTH" WAS TWO HOPS OF ONE PATH. This test's own title says both
  // publish paths and neither assertion above reached the cheap-edit spine:
  // `icon: icon || ""` matched `buildAndPublishPages` alone, and
  // `icon: priorIcon` is the route feeding that same function. So the spine —
  // which is what the icon lane ITSELF publishes through, along with every
  // text fix, colour change and picture swap — read `site_icon` out of `_meta`
  // and never put it on the wire, and this guard was green throughout. Vacuous
  // by scope, on the one path the feature lives on.
  //
  // DERIVED FROM `logo`, NOT A LIST OF THE HOPS THERE ARE TODAY. The pair
  // travels together by construction: same `_meta` read, same `writeSiteBrand`
  // call, same silent loss when a payload omits one — so "everywhere one goes,
  // the other goes" is the property, and a fourth hop written tomorrow is
  // covered without anybody remembering this file.
  // DERIVED FROM `logo`, NOT A LIST OF THE HOPS THERE ARE TODAY — and since
  // 2026-09-07 the derivation is DRIVEN rather than scanned. The old form
  // walked every `logo:` line in worker.js and demanded an `icon:` within the
  // next few properties; with the four fields spread from one projection there
  // is no longer a line to walk, and a scan that finds nothing passes
  // vacuously. So the property — "everywhere one goes the other goes" — is
  // asked of the projection itself, which is now the only thing that can carry
  // a mark to the container.
  const hops = [...w.matchAll(/markWire\(/g)];
  assert.ok(hops.length >= 3,
    "the scan found only " + hops.length + " markWire call sites, so it has stopped scanning");
  for (const [store, want] of [[{ logo: "/u/s/a.png" }, "logo"], [{ icon: "/u/s/b.png" }, "icon"]]) {
    const wire = markWire(store);
    assert.equal(wire[want], store[want], "markWire dropped the " + want + " it was given");
    assert.ok(Object.prototype.hasOwnProperty.call(wire, "logo") && Object.prototype.hasOwnProperty.call(wire, "icon"),
      "a mark reached the wire without its sibling: " + JSON.stringify(wire));
  }
  // ...which used to need both SELECTs to ask for it, or the read was of a row
  // that was never fetched and every publish silently dropped the icon.
  //
  // SINCE 2026-08-24 THAT IS A PROPERTY OF THE STORE RATHER THAN A SCAN. The six
  // config fields are one R2 object and `loadConfig` answers with all of them or
  // refuses, so there is no key list a read can leave the icon out of — what has
  // to hold is only that both are still fields.
  const cfg = fs.readFileSync(new URL("../../../site-config.mjs", import.meta.url), "utf8");
  assert.match(cfg, /CONFIG_FIELDS = \[[^\]]*"logo"[^\]]*"icon"/,
    "the two slots are no longer both part of a site's config, so a publish can drop one");
});

test("readEdit RETURNS the flag, not merely computes it", async () => {
  // A mutant deleting `...tab` from the return survived the whole suite: the
  // source guard asserted the expression that DECIDES it, which was still there,
  // while the value never left the router. The eleventh time in this repo a
  // guard has watched the layer below the break.
  const { readEdit } = await import("../builder/site-ask.mjs");
  assert.equal(readEdit({ layer: "logo", tab: true }).tab, true);
  // Scoped to the layer that HAS two slots — a flag on a layer that cannot act
  // on it is one nothing reads, which is how this repo's dead features start.
  assert.equal(readEdit({ layer: "look", tab: true }).tab, undefined);
  assert.equal(readEdit({ layer: "logo" }).tab, undefined);
  // And it combines with `remove`, which is what makes "take the favicon off"
  // hit the right slot rather than clearing the header logo.
  const both = readEdit({ layer: "logo", tab: true, remove: true });
  assert.equal(both.tab, true);
  assert.equal(both.remove, true);
  // Nothing merely truthy.
  for (const v of ["false", 1, {}, []]) assert.equal(readEdit({ layer: "logo", tab: v }).tab, undefined, String(v));
});
