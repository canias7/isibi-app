// "Hey, this is my logo, put it there."
//
// The owner's own words for how this should work, after turning down a picker
// in the uploads panel. The attachment IS which picture — nothing to match,
// nothing to remember — which is why the whole layer needs no model call.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readLogoImage, logoRefusal, runLogoEdit, MAX_LOGO_BYTES } from "../builder/site-logo.mjs";
import { withConfig } from "../site-config.mjs";
import { MARKS, markWire, markUrlOk } from "../builder/site-mark.mjs";

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

/* ── reading the attached image ──────────────────────────────────────────── */

test("a real PNG data URL is read", () => {
  const r = readLogoImage(dataUrl(PNG), { sniff });
  assert.equal(r.ok, true);
  assert.equal(r.kind.ext, "png");
  assert.equal(r.bytes[0], 0x89);
});

test("NOTHING ATTACHED IS ITS OWN ANSWER, not a generic failure", () => {
  // The message has to say what to do — attach it — or the customer is left
  // with "that didn't work" and no idea that a file was the missing half.
  for (const empty of ["", null, undefined, 7, {}]) {
    assert.equal(readLogoImage(empty, { sniff }).reason, "none");
  }
  assert.match(logoRefusal("none"), /Attach/);
  assert.match(logoRefusal("none"), /📎/);
});

test("AN SVG IS REFUSED, and the message says what to send instead", () => {
  // `/u/` serves `content-disposition: inline` from the site's OWN origin, and
  // an SVG is a document that can carry `<script>` — accepting one is stored
  // XSS on a customer's domain, which `nosniff` does not help with because the
  // type would be declared honestly. `site-uploads.mjs` refuses it for exactly
  // this reason and one rule beats two.
  //
  // It is also the refusal most likely to annoy somebody: a logo is the single
  // most likely thing a business has as an SVG, because that is what a designer
  // hands them. So it must not read as "that didn't work".
  const r = readLogoImage("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", { sniff });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "svg");
  assert.match(logoRefusal("svg"), /PNG/);
});

test("…and an SVG dressed as a PNG is refused by the BYTES, not the label", () => {
  // The declared media type is whatever the caller wrote. Only the leading
  // bytes are an honest answer to "is this an image".
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const r = readLogoImage(dataUrl(svg, "image/png"), { sniff });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "not_an_image");
});

test("anything that is not a base64 image data URL is refused", () => {
  for (const bad of [
    "https://example.com/logo.png",
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/png,notbase64",
    "data:image/png;base64,not base64 at all!!",
  ]) {
    assert.equal(readLogoImage(bad, { sniff }).ok, false, JSON.stringify(bad) + " was accepted");
  }
});

test("something far too large is refused BEFORE it is decoded", () => {
  // A 30 MB string should not become a 22 MB Uint8Array on the way to being
  // refused — this runs on a Worker with a memory bound.
  const huge = "data:image/png;base64," + "A".repeat(MAX_LOGO_BYTES * 2);
  const r = readLogoImage(huge, { sniff });
  assert.equal(r.reason, "too_big");
  assert.match(logoRefusal("too_big"), /2 MB/);
});

test("…and the DECODED size is checked too, not only the base64 length", () => {
  // The pre-decode bound is about what is worth decoding; this is the real size
  // of the thing that would be stored, and only one of the two is the limit.
  // Driven at a size that passes the first check and fails the second.
  const big = new Uint8Array(MAX_LOGO_BYTES + 10);
  big[0] = 0x89; big[1] = 0x50;
  const r = readLogoImage(dataUrl(big), { sniff });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too_big");
});

test("with no sniffer at all nothing is accepted", () => {
  // Fails closed. A missing dependency must not become "every attachment is a
  // valid image", which would put arbitrary bytes on the site's own origin.
  assert.equal(readLogoImage(dataUrl(PNG), {}).ok, false);
  assert.equal(readLogoImage(dataUrl(PNG)).ok, false);
});

/* ── putting it on ───────────────────────────────────────────────────────── */

test("the logo is stored, saved and published, in that order", async () => {
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, true);
  assert.equal(r.url, "/u/cafe/abc.png");
  assert.equal(seen.stored, 1);
  assert.deepEqual(seen.saved, ["/u/cafe/abc.png"]);
  assert.equal(seen.published, 1);
});

test("NOTHING IS SAVED IF THE UPLOAD FAILED", async () => {
  // Written the other way round, a failed upload leaves the site pointing at an
  // address that 404s — a broken-image glyph in the header of every page, which
  // is worse than the text it replaced.
  const { d, seen } = deps({ storeThrows: true });
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "store");
  assert.deepEqual(seen.saved, []);
  assert.equal(seen.published, 0);
});

test("…and nothing is published if the save failed", async () => {
  const { d, seen } = deps({ saveThrows: true });
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, false);
  assert.equal(seen.published, 0);
});

test("a store that answers NULL is a failure, not a logo of nothing", async () => {
  const { d, seen } = deps({ storeUrl: null });
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, false);
  assert.deepEqual(seen.saved, []);
});

test("A FAILED PUBLISH SAYS THE LOGO IS SAVED, because it is", async () => {
  // A real state and not "nothing happened": the next publish of this site — a
  // colour change, a typo fix — will carry it. Saying otherwise would have them
  // send it again for no reason.
  const { d } = deps({ publish: { ok: false } });
  const r = await runLogoEdit(d, { images: [dataUrl(PNG)] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "publish");
  assert.equal(r.url, "/u/cafe/abc.png");
  assert.match(r.msg, /saved your logo/i);
  assert.match(r.msg, /next change/);
});

test("the first usable attachment is the one used", async () => {
  const { d } = deps();
  const r = await runLogoEdit(d, { images: ["", dataUrl(PNG)] });
  assert.equal(r.ok, true);
});

test("a refusal never publishes and never saves", async () => {
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { images: ["data:image/svg+xml;base64,PHN2Zz4="] });
  assert.equal(r.ok, false);
  assert.equal(seen.stored, 0);
  assert.equal(seen.published, 0);
});

/* ── taking it off ───────────────────────────────────────────────────────── */

test("A REMOVAL NEEDS NO IMAGE, and is asked FIRST", async () => {
  // Checked before the attachment, or "take the logo off" is answered with
  // "attach a logo" — the opposite of what was asked, and it reads as the
  // builder not listening.
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { remove: true });
  assert.equal(r.ok, true);
  assert.equal(r.removed, true);
  assert.deepEqual(seen.saved, [""], "the stored logo was not cleared");
  assert.equal(seen.stored, 0);
  assert.equal(seen.published, 1);
  assert.match(r.msg, /name/, "the reply does not say what the header shows now");
});

test("removal is a REAL boolean, not anything truthy", async () => {
  // `remove: "false"` off a wire would otherwise take a customer's logo off.
  const { d, seen } = deps();
  const r = await runLogoEdit(d, { remove: "true", images: [dataUrl(PNG)] });
  assert.equal(r.ok, true);
  assert.equal(!!r.removed, false, "a string took the logo off");
  assert.deepEqual(seen.saved, ["/u/cafe/abc.png"]);
});

test("a failed removal does not claim the logo is gone", async () => {
  const { d } = deps({ publish: { ok: false } });
  const r = await runLogoEdit(d, { remove: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "publish");
});

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

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const header = fs.readFileSync(new URL("../builder/lovable/template/src/components/ui/site-header.tsx", import.meta.url), "utf8");
const buildServer = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

test("THE HEADER CAN ACTUALLY SHOW ONE", () => {
  // The gap this closes: `SiteHeader` took `brand: string` and there was no
  // image slot anywhere in the frame, so a business with a logo could not use it.
  assert.match(header, /import \{ SITE_LOGO \} from "@\/site-brand"/, "the header cannot see the logo");
  assert.match(header, /<img[\s\S]{0,200}src=\{SITE_LOGO\}/, "the header does not render it");
  // The name is the ALT, which is what makes the fallback the site everyone has
  // today rather than an empty box.
  assert.match(header, /src=\{SITE_LOGO\}[\s\S]{0,120}alt=\{brand\}/, "the logo has no alt, so a failed image is a blank header");
  // A wide wordmark with no bound pushes the nav off the right-hand edge, and
  // the person who notices is a visitor who cannot find the booking link.
  assert.match(header, /max-w-\[\d+px\]/, "the logo is unbounded and can push the nav off the page");
});

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

test("the site's logo is BAKED IN, not read from the injected head", () => {
  // Every route is prerendered to HTML BEFORE `injectMeta` runs, so a component
  // reading a `<meta>` would render without it on the server and with it in the
  // browser: a hydration mismatch, and a header that visibly flips from the name
  // to the logo on every page load.
  // ANCHORED ON THE PROPERTY, NOT THE FUNCTION'S NAME. This asserted
  // `writeSiteLogo(` — one of two writers of `site-brand.ts`, merged into one
  // `writeSiteBrand` when the language and the mark joined the logo there. Two
  // writers of one generated file is one of them silently losing, which is why
  // they were merged; a test pinned to either name is a test about word order.
  assert.match(buildServer, /site-brand\.ts/, "the container no longer writes the brand module");
  assert.match(buildServer, /SITE_LOGO = " \+ JSON\.stringify\(/, "the logo is not written into it");
  assert.match(buildServer, /writeSiteBrand\(\{[^}]*logo: payload\.logo/,
    "the brand writer is defined and never handed the payload's logo");
  assert.ok(!/site-logo["']\s*\)|name="site-logo"/.test(fs.readFileSync(new URL("../site-meta.mjs", import.meta.url), "utf8")),
    "the logo is being injected into the head, which cannot survive prerendering");
});

test("THE CONTAINER WRITES IT ON EVERY BUILD, including when there is none", () => {
  // This container is long-lived and serves every build on the platform, so a
  // file left behind by the last site is that site's logo on this one's header
  // — the leak `resetRoutes` and the per-build icon already guard against.
  const block = brandWriter();
  assert.match(block, /writeFileSync/, "nothing is written");
  assert.ok(!/if \(!\w+\)\s*return/.test(block),
    "an absent value skips the write, so the previous site's brand stays on disk");
});

test("only a shape that cannot be a javascript: URL is written", () => {
  // The value ends up in a `src` inside generated TypeScript. It comes from our
  // own `_meta` today, and "it came from us" is how the first person to reach
  // that row by some other route gets an XSS on a customer's site.
  const block = brandWriter();
  // RE-ANCHORED 2026-09-07, AND DRIVEN RATHER THAN READ. This matched the
  // literal `^https:\/\/` inside the baker, and that regex pair moved: it was
  // written out TWICE — here and in `siteIconFrom` — for one rule about what may
  // reach a customer's generated `src`, which is the recorded "two lists of the
  // same thing" with the worst possible subject. `markUrlOk` owns it now, and
  // asking the rule what it REFUSES is a stronger check than finding a fragment
  // of it in a file: a regex can be present and wrong.
  for (const bad of [
    "javascript:alert(1)", "JaVaScRiPt:x", "data:text/html;base64,PHNjcmlwdD4=",
    "http://e.test/x.png", "//e.test/x.png", "/x.png", "u/s/a.png",
    " javascript:x", "https://e.test/x .png", 'https://e.test/"x.png',
  ]) assert.ok(!markUrlOk(bad), "markUrlOk admits " + JSON.stringify(bad) + " into a generated src");
  // …and the shapes it MUST admit, or the guard would pass by refusing all.
  for (const good of ["https://cdn.test/logo.png", "/u/fretwork-1/96e1caf.png"]) {
    assert.ok(markUrlOk(good), "markUrlOk refuses " + good);
  }
  assert.match(block, /markUrlOk\(raw\)/, "the baker no longer asks the shared rule");
  assert.match(block, /JSON\.stringify\(logoValue\)/, "the value is not quoted safely into the module");
  // AND THE CHECK HAS TO DECIDE THE VALUE, not merely exist. A mutant replacing
  // `logoOk ? raw : ""` with `raw` left both assertions above intact — the
  // pattern was still in the file and the value was still quoted — while every
  // shape the check exists to refuse went straight into a customer's `src`.
  // Computed and dropped, which is the class this whole guard is about.
  assert.match(block, /logoValue\s*=\s*markUrlOk\(raw\)\s*\?/,
    "the shape check is computed and then discarded — every refused shape is written anyway");
});

test("BOTH PUBLISH PATHS CARRY THE STORED LOGO", () => {
  // The container writes `site-brand.ts` on EVERY build, so a path that does not
  // send the stored value sends nothing — and nothing means empty. Without the
  // build half, a customer who attached a logo and then asked for any page
  // change would watch it disappear with no error and nothing to point at.
  // ANCHORED ON THE KEY, NOT ON THE KEY LIST. This was pinned to the exact
  // string `'site_look','site_tokens','site_logo'` and went red on a correct
  // change the day a fourth stored look concern (`site_style`) was added beside
  // it — a test about word order failing a feature it has no opinion about.
  // What it actually protects is that every `_meta` read feeding a publish asks
  // for the logo, so it is asserted of each of them.
  //
  // ASSERTED OF THE TWO PATHS THAT BUILD A CONTAINER PAYLOAD, and not of every
  // stored-look read — which is where two drafts of this went wrong in a way
  // worth recording. Pinned to the exact key list, it went red the day
  // `site_style` was added beside the logo: a test about word order failing a
  // feature it has no opinion about. Widened to "every read naming site_look",
  // it flagged the router's context read; widened to "every read naming
  // site_tokens", it flagged the look-edit lane — and BOTH of those are correct
  // code, because neither builds a payload: they store and then publish through
  // `recompileAndPublish`, which does its own read. There is no precise textual
  // discriminator for "this read reaches the container", so the guard is the
  // pair of variables that actually carry it plus the two payloads below.
  //
  // THE READ-SIDE HALF IS NOW A PROPERTY OF THE STORE. Since 2026-08-24 the six
  // config fields are one R2 object and `loadConfig` answers with every one of
  // them or refuses, so a payload path CANNOT read the palette and miss the
  // logo: there is no key list to leave it out of. What is asserted instead is
  // that the logo is still one of the six, and that both payloads carry it.
  assert.match(fs.readFileSync(new URL("../site-config.mjs", import.meta.url), "utf8"),
    /CONFIG_FIELDS = \[[^\]]*"logo"/,
    "the logo is no longer part of a site's config, so a publish path can miss it again");
  // …and that each payload path really binds it, which the read cannot promise:
  // loading a config and then not destructuring the logo out of it is the
  // select-and-drop shape this repo has lost a feature to before.
  // RE-ANCHORED 2026-09-07 (one mark, several forms). This pinned four
  // spellings — the spine's `({ look, css, logo, icon, … } = cfg.config)`,
  // `priorLogo = cfg.config.logo`, a bare `logo,` in the payload and
  // `logo: priorLogo` — and every one of them moved when the header mark became
  // ONE field carrying a form. THE PROPERTY IS UNCHANGED and is the reason this
  // guard exists: the container rewrites `site-brand.ts` on every build, so a
  // publish path that does not put the stored mark on the wire takes it off the
  // site. What changed is that the four wire fields are no longer bound one at a
  // time — they come from ONE projection, `markWire`, which is what makes
  // "a path cannot carry the logo and miss the icon" true by construction
  // instead of by four assertions that can each go stale alone.
  assert.match(worker, /marks = markWire\(cfg\.config\);/,
    "the spine loads the config and does not project the marks out of it");
  assert.match(worker, /priorLook = lookWithMarks\(cfg\.config\);/,
    "the build path loads the config and does not resolve the marks out of it");
  assert.match(worker, /\n\s+logo: marks\.logo,\n/,
    "recompileAndPublish does not send the header mark to the container");
  assert.match(worker, /\.\.\.markWire\(\{ look \}\),/,
    "a revise does not carry the stored marks");
  assert.match(worker, /logo: logo \|\| "",/, "the build path does not send one");
  // AND THE PROJECTION REALLY PROJECTS BOTH MARKS, driven rather than read: a
  // `markWire` that answered only the header would satisfy every match above.
  assert.deepEqual(Object.keys(markWire({ logo: "/u/s/a.png", icon: "/u/s/b.png" })).sort(),
    ["favicon", "icon", "logo", "wordmark"],
    "markWire does not carry all four wire fields, so a payload can still drop one");
});

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
  const edit = fs.readFileSync(new URL("../builder/site-edit.mjs", import.meta.url), "utf8");
  for (const f of MARKS) {
    assert.match(edit, new RegExp('EDIT_FIELDS = \\[[^\\]]*"' + f + '"'),
      f + " is not on EDIT_FIELDS, so a look edit will drop the mark stored there");
  }
  assert.match(worker, /\[field\]: next \} \}\);/,
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
  assert.match(chat, /images: d\.layer === 'logo'/, "the client never sends the attachment to the edit route");
  assert.match(chat, /siteEdit\(site, d, t, origin, finish, go, imgs\)/, "siteEdit is not given the attachments");
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

// ── THE TAB ICON IS A SECOND SLOT, NOT A SMALLER LOGO ───────────────────────

test("the tab icon is stored under its own key, leaving the logo alone", async () => {
  const saved = [];
  const out = await runLogoEdit({
    sniff: () => ({ mime: "image/png", ext: "png" }),
    store: async () => "/u/x/abc.png",
    save: async (patch) => { saved.push(patch); },
    publish: async () => ({ ok: true, files: 3 }),
  }, { images: ["data:image/png;base64,aaaa"], tab: true });
  assert.equal(out.ok, true);
  assert.equal(out.target, "icon");
  // ONE KEY, and it must be the icon — writing `logo` here would put a wordmark
  // in the header nobody asked to change, and writing both would silently
  // replace the other piece of artwork.
  assert.deepEqual(saved, [{ icon: "/u/x/abc.png" }]);
  assert.match(out.msg, /tab/i);
});

test("without the flag it is still the header logo, byte for byte as before", async () => {
  const saved = [];
  const out = await runLogoEdit({
    sniff: () => ({ mime: "image/png", ext: "png" }),
    store: async () => "/u/x/abc.png",
    save: async (patch) => { saved.push(patch); },
    publish: async () => ({ ok: true, files: 3 }),
  }, { images: ["data:image/png;base64,aaaa"] });
  assert.equal(out.target, "logo");
  assert.deepEqual(saved, [{ logo: "/u/x/abc.png" }]);
  assert.match(out.msg, /header/i);
});

test("NOTHING MERELY TRUTHY SENDS ARTWORK TO THE TAB", async () => {
  // The rule `remove` already lives under one field over. A `tab` arriving as
  // the string "false" — which is truthy — must not take a wordmark off the
  // header and put it in a 16-pixel box.
  for (const tab of ["false", "true", 1, {}, []]) {
    const saved = [];
    await runLogoEdit({
      sniff: () => ({ mime: "image/png", ext: "png" }),
      store: async () => "/u/x/a.png",
      save: async (p) => { saved.push(p); },
      publish: async () => ({ ok: true }),
    }, { images: ["data:image/png;base64,aaaa"], tab });
    assert.deepEqual(saved, [{ logo: "/u/x/a.png" }], String(tab));
  }
});

test("a removal hits the slot it was asked about, and says what it goes back to", async () => {
  const saved = [];
  const out = await runLogoEdit({
    save: async (p) => { saved.push(p); },
    publish: async () => ({ ok: true, files: 2 }),
  }, { remove: true, tab: true });
  assert.equal(out.ok, true);
  assert.equal(out.target, "icon");
  assert.deepEqual(saved, [{ icon: "" }]);
  // Removing the tab icon does not leave the tab blank — the site returns to the
  // mark drawn from its initials, which is what every site has until one is sent.
  assert.match(out.msg, /initials/i);
  assert.doesNotMatch(out.msg, /header shows your name/i);
});

test("a failed publish names the right thing in both slots", async () => {
  for (const [tab, word] of [[true, /tab icon/i], [false, /logo/i]]) {
    const out = await runLogoEdit({
      sniff: () => ({ mime: "image/png", ext: "png" }),
      store: async () => "/u/x/a.png",
      save: async () => {},
      publish: async () => ({ ok: false }),
    }, { images: ["data:image/png;base64,aaaa"], tab });
    assert.equal(out.ok, false);
    assert.equal(out.reason, "publish");
    assert.match(out.msg, word);
  }
});

// ── REACHABLE, WHICH IS THE HALF THAT KEEPS DYING ───────────────────────────

test("the whole tab-icon wire holds, end to end", () => {
  // `remove` was decided by `readEdit` and dropped by the route for the entire
  // life of the logo layer, and then AGAIN for page deletion — both found only
  // by a live run answering `undefined`. Every hop is asserted here rather than
  // after the fact.
  const ask = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const c = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

  // 1. the model can say it
  assert.match(ask, /\n {6}tab: \{\n {8}type: "boolean"/);
  // 2. readEdit reads it, scoped to the layer that has two slots, and strictly
  assert.match(ask, /layer === "logo" && input && input\.tab === true/);
  // 3. the route returns it
  assert.match(w, /tab: routed\.intent === "edit" && routed\.tab === true \? true : undefined,/);
  // 4. the client posts it back as a real boolean
  assert.match(c, /\n {6}tab: d\.tab === true,/);
  // 5. the worker hands it to the module
  assert.match(w, /tab: eb && eb\.tab === true \}\);/);
});

test("the two slots are two _meta keys, and the icon reaches the container from BOTH publish paths", () => {
  // The container rewrites `site-brand.ts` on EVERY build, so a path that does
  // not send the stored icon sends nothing and the site falls back to its
  // initials. That is exactly the bug `priorLogo` exists to prevent, one key
  // over — a customer who sent a favicon and then fixed a typo would have
  // watched it vanish.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
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
  const cfg = fs.readFileSync(new URL("../site-config.mjs", import.meta.url), "utf8");
  assert.match(cfg, /CONFIG_FIELDS = \[[^\]]*"logo"[^\]]*"icon"/,
    "the two slots are no longer both part of a site's config, so a publish can drop one");
});

test("the container prefers the owner's icon, declares its real type, and keeps the drawn mark as the fallback", () => {
  const b = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  // ANCHORED ON THE PROPERTY, NOT THE SPELLING. This pinned the whole
  // destructuring list verbatim, so adding a SEVENTH field beside it — `mode`,
  // 2026-08-18 — turned a correct change red with a message about an icon.
  // A test about word order, which is this repo's most-repeated own-goal. What
  // matters is that the function takes the sent icon under a different name
  // from the resolved one, since that renaming is what makes the fallback gate
  // below readable at all.
  assert.match(b, /function writeSiteBrand\(\{[^}]*\bicon: sent\b[^}]*\}\)/);
  assert.match(b, /writeSiteBrand\(\{[^)]*icon: payload\.icon/);
  // THE DRAWN MARK IS BEHIND THE OWNER'S, not instead of it: a site with no
  // stored icon must behave byte-identically to before this existed.
  // …AND THIS ONE WAS THE SAME OWN-GOAL THE COMMENT ABOVE WARNS ABOUT, twice
  // over: it pinned the call as `initialsMark(title)` verbatim, so giving the
  // mark the site's palette turned a correct change red — and its `{0,200}`
  // byte window was outrun by the comment explaining that argument. Bounded by
  // the branch's own close and asserted on the ARGUMENTS rather than the text.
  const fallback = b.slice(b.indexOf("if (!icon) {"), b.indexOf("// ONLY AN ABSOLUTE https URL"));
  assert.ok(fallback.length > 100, "the drawn-mark fallback moved — rescope this");
  assert.match(fallback, /initialsMark\(\s*title\s*,\s*seeds\s*\)/,
    "the drawn mark is no longer given the site's own palette, so its colour is a hash of the name again");
  // AND THE PALETTE HAS TO REACH THAT CALL, which is the layer this repo has
  // lost twelve features in: `markGround` can be perfectly correct and never
  // reached, and the only symptom is a tab icon in a colour nobody chose.
  assert.match(b, /function writeSiteBrand\(\{[^}]*\bseeds\b[^}]*\}\)/,
    "writeSiteBrand does not take the seeds");
  assert.match(b, /writeSiteBrand\(\{[^)]*seeds: payload\.seeds/,
    "the call site does not pass the seeds, so the mark falls back to the name hash on every build");
  // AND THE OWNER'S ANSWER HAS TO REACH THAT GATE. `writeSiteBrand` writes
  // files, so no unit test can drive it — and a mutation setting `icon` to null
  // outright SURVIVED everything: the gate above still reads correctly, the
  // drawn mark still appears, and the owner's icon is silently discarded on
  // every build. Asserted as the data flow rather than the expression, so a
  // legitimate rewrite of the ternary passes and a severed one does not.
  assert.match(b, /let icon = [^;\n]*own\.href[^;\n]*;/, "the resolved icon must reach the gate");
  assert.match(b, /let iconType = [^;\n]*own\.type[^;\n]*;/, "the resolved type must reach the module");
  // THE BOUNDARY, STATED: this proves the wiring and not the render. Only
  // `site build`, against the real container, can prove a published document
  // carries the owner's icon — a source-read is a one-way filter here.
  // AND THE TYPE IS PER ICON. `image/svg+xml` was hardcoded in the document,
  // which is a lie about an owner's PNG and a browser may refuse it.
  assert.match(b, /export const SITE_ICON_TYPE = /);
  const root = fs.readFileSync(
    new URL("../builder/lovable/template/src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /rel: "icon", href: SITE_ICON, type: SITE_ICON_TYPE/);
  assert.doesNotMatch(root, /type: "image\/svg\+xml"/);
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
