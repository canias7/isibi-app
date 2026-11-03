// "Hey, this is my logo, put it there."
//
// The owner's own words for how this should work, after turning down a picker
// in the uploads panel. The attachment IS which picture — nothing to match,
// nothing to remember — which is why the whole layer needs no model call.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

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
