// The pages a React build produced, and reaching them in the preview.
//
// THE BUG: a React build stored exactly one page — `{path:'/', name:'App'}` —
// however many routes it wrote. The picker only renders above one page, so a
// three-page site showed a dead "Homepage" label and the other two were
// unreachable in the preview. The information was already in hand: the build
// response lists every file written, and the steps panel was printing them as
// chips one panel over.
//
// public/chat.js is a browser script with no exports, so the function under test
// is lifted out of the source and evaluated. That is worth the awkwardness —
// this drives the REAL implementation rather than asserting that some text
// appears in a file, which is all a source-read could do.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

// The module-level constants `siteChipUrl` closes over, LIFTED FROM THE SAME
// SOURCE rather than restated here. A hand-written copy in a test is a third
// place the zone name lives, and the one nobody would think to update — which
// is how a test goes on passing against a function that has moved on.
const zoneConst = (chat.match(/^const SITE_ZONE = '[^']+';$/m) || [])[0];
const liveConst = (chat.match(/^const SITE_ZONE_LIVE = (?:true|false);$/m) || [])[0];
assert.ok(zoneConst && liveConst, "the site-zone constants are gone from chat.js; the chip tests check nothing");

/** Lift a function, optionally forcing the site zone on so both states are covered. */
const lift = (name, { live = null } = {}) => {
  const i = chat.indexOf("function " + name + "(");
  assert.ok(i > 0, name + " is gone; this file checks nothing");
  const end = chat.indexOf("\nfunction ", i + 10);
  assert.ok(end > i, "could not find the end of " + name);
  const consts = zoneConst + "\n"
    + (live === null ? liveConst : "const SITE_ZONE_LIVE = " + String(live) + ";") + "\n";
  // eslint-disable-next-line no-eval
  return eval(consts + chat.slice(i, end) + "\n" + name);   // newline: the slice can end on a comment
};
const reactRoutePages = lift("reactRoutePages");
const siteChipUrl = lift("siteChipUrl");
// BOTH STATES, DRIVEN EXPLICITLY, rather than whichever the flag happens to be.
// Pinned to one, half the behaviour goes uncovered the moment somebody flips
// the switch — and the flip is a one-line change, so it will happen without
// anybody thinking about this file. `siteChipUrl` above still reads the real
// flag, and one assertion below checks it agrees with one of these two.
const siteChipUrlLive = lift("siteChipUrl", { live: true });
const siteChipUrlDark = lift("siteChipUrl", { live: false });
const names = (files) => reactRoutePages(files).map((p) => p.name + " " + p.path);

test("every route file becomes a page, with home first", () => {
  // The exact build the owner was looking at: index, press, music.
  assert.deepEqual(names(["src/routes/index.tsx", "src/routes/press.tsx", "src/routes/music.tsx"]),
    ["Home /", "Press /press", "Music /music"]);
  // HOME FIRST whatever order they arrive in — it is the page the preview opens
  // on, so it has to be the one the picker shows selected.
  assert.equal(reactRoutePages(["src/routes/press.tsx", "src/routes/index.tsx"])[0].path, "/");
  // And the rest keep the model's order rather than being alphabetised: that
  // order matches the site's own nav far more often.
  assert.deepEqual(names(["src/routes/index.tsx", "src/routes/zebra.tsx", "src/routes/apple.tsx"]),
    ["Home /", "Zebra /zebra", "Apple /apple"]);
});

test("plumbing files are not pages", () => {
  // __root is the layout and routeTree.gen is generated — neither is somewhere a
  // visitor can go, and offering them in the picker is offering a broken link.
  assert.deepEqual(names(["src/routes/__root.tsx", "src/routes/index.tsx", "src/routes/routeTree.gen.tsx"]),
    ["Home /"]);
});

test("junk in the file list does not become junk in the picker", () => {
  // `files` comes off a response. A non-string, a missing extension or a stray
  // path must be skipped rather than rendered as a page named "undefined".
  assert.deepEqual(names([null, undefined, 42, {}, "", "readme.md", "src/routes/x.tsx"]), ["X /x"]);
  assert.deepEqual(names([]), []);
  assert.deepEqual(names(null), []);
  assert.deepEqual(names("src/routes/index.tsx"), [], "a bare string is not a list of files");
});

test("names are readable, and nesting is kept", () => {
  assert.deepEqual(names(["src/routes/index.tsx", "src/routes/about-us.tsx"]), ["Home /", "About us /about-us"]);
  // A folder route keeps its shape, which is what TanStack does with it.
  assert.deepEqual(names(["src/routes/shop/item.tsx"]), ["Item /shop/item"]);
  // `shop/index.tsx` is the folder's own page, not a page called "index".
  assert.deepEqual(names(["src/routes/shop/index.tsx"]), ["Shop /shop"]);
  // The same path twice (however it arrives) is one entry.
  assert.deepEqual(names(["src/routes/a.tsx", "src/routes/a.tsx"]), ["A /a"]);
});

test("the address chip shows a URL that would actually work", () => {
  // IT HAS BEEN WRONG TWICE, in opposite directions, and this is the string
  // people copy out of the preview and send to a customer. First it read
  // "gofarther.dev/s/hey/press" while the app was hash-routed and that page
  // lived at `#/press`; the fragment was added, and then the router moved to
  // browser history on 2026-08-09 and the fragment became the bug — `/s/hey/#/
  // press` loads the home page. Pages have real addresses, so does the chip.
  const react = { slug: "hey", react: true };
  assert.equal(siteChipUrlDark(react, "/press"), "gofarther.dev/s/hey/press");
  assert.equal(siteChipUrlDark(react, "/"), "gofarther.dev/s/hey/");
  assert.equal(siteChipUrlDark(react, null), "gofarther.dev/s/hey/");
  // THE TRAILING SLASH IS NOT COSMETIC — the bundle is referenced relatively, so
  // without it the browser resolves /s/assets/... and the page renders blank.
  assert.ok(siteChipUrlDark(react, "/").endsWith("/"), "the chip drops the trailing slash");
  // React or static, the address is the same shape now.
  assert.equal(siteChipUrlDark({ slug: "hey" }, "/press"), "gofarther.dev/s/hey/press");
  // No slug yet: say so rather than showing a broken link.
  assert.match(siteChipUrlDark({}, "/"), /Draft preview/);
  assert.match(siteChipUrlDark(null, "/"), /Draft preview/);
});

test("the live chip is whichever of the two the flag selects", () => {
  // The two tests around this one force the flag, so on their own they would
  // both pass against a `siteChipUrl` that had stopped reading it at all.
  const react = { slug: "hey", react: true };
  const real = siteChipUrl(react, "/press");
  assert.ok(
    real === siteChipUrlLive(react, "/press") || real === siteChipUrlDark(react, "/press"),
    "the chip is neither the live form nor the dark one: " + real,
  );
});

test("once the site zone is live the chip is the subdomain", () => {
  // Driven with the flag forced on, so turning it on for real is a one-line
  // change rather than a discovery. The slash rule survives the move: a bundle
  // referenced relatively needs it on either host.
  const react = { slug: "hey", react: true };
  assert.equal(siteChipUrlLive(react, "/"), "hey.gofarther.app/");
  assert.equal(siteChipUrlLive(react, "/press"), "hey.gofarther.app/press");
  assert.ok(siteChipUrlLive(react, "/").endsWith("/"));
  assert.match(siteChipUrlLive(null, "/"), /Draft preview/);
});

test("the preview follows the picked page", () => {
  // The label changed and the frame did not: `switchSitePage` only reloaded the
  // iframe when the page had `html` to load, which a React route never does.
  const i = chat.indexOf("function switchSitePage(");
  const block = chat.slice(i, chat.indexOf("\nfunction renderSites(", i));
  assert.ok(block.length > 300, "switchSitePage moved; this guard checks nothing");
  assert.match(block, /else if \(f && s\.react && s\.url\) f\.src =/,
    "picking a page on a React site changes the label and not the preview");
  // A REAL PATH, not a fragment. The hash was right while the app was
  // hash-routed and a real path 404'd; the Worker answers an extensionless path
  // with that route's prerendered HTML now, so the fragment stopped being the
  // mechanism and became the reason the frame stayed on the home page.
  assert.match(block, /\(path !== '\/' \? String\(path\)\.replace\(\/\^\\\/\/, ''\) : ''\)/,
    "the picked page is not addressed by path");
  // THE ABSENCE CHECK IS ON THE ASSIGNMENT LINE, not the block. The comment
  // above that line explains what the fragment used to do and so contains the
  // literal — scanned over the whole block this assertion is defeated by prose,
  // which is the comment-vs-code failure this repo has recorded more than once.
  const srcLine = (block.match(/^.*f\.src = s\.url.*$/m) || [""])[0];
  assert.ok(srcLine, "the preview src assignment is gone");
  assert.doesNotMatch(srcLine, /'#'/, "a fragment is inert under browser history");

  // And the first render agrees with it, or opening a site lands somewhere the
  // picker then disagrees about.
  const j = chat.indexOf("if (fr && isReact) {");
  assert.ok(j > 0, "the first-render branch is gone");
  // TO A LANDMARK, not a byte count: a window sized in characters stops
  // covering what it was written for the moment a comment is added above the
  // line, which is this repo's recurring source-guard bug.
  const first = chat.slice(j, chat.indexOf("} else if (fr && curHtml) {", j));
  assert.match(first, /\(at !== '\/' \? String\(at\)\.replace\(\/\^\\\/\/, ''\) : ''\)/,
    "the initial preview ignores the active page");
  const firstLine = (first.match(/^.*fr\.src = site\.url.*$/m) || [""])[0];
  assert.ok(firstLine, "the first-render src assignment is gone");
  assert.doesNotMatch(firstLine, /'#'/, "a fragment is inert under browser history");
});

test("a revise that reports no files keeps the pages it had", () => {
  // The fallback that caused this in the first place was unconditional. Left
  // that way, one response without a file list would collapse a five-page site
  // back to a single dead "Homepage" label.
  const i = chat.indexOf("const routed = reactRoutePages(wrote);");
  assert.ok(i > 0, "the route files are no longer turned into pages");
  const block = chat.slice(i, i + 500);
  assert.match(block, /if \(routed\.length\) s\.pages = routed;/);
  assert.match(block, /else if \(!Array\.isArray\(s\.pages\) \|\| !s\.pages\.length\)/,
    "an empty file list overwrites the pages a previous build established");
});

// ── the build steps ──────────────────────────────────────────────────────────

// Same lifting trick, but this function calls helpers — so it runs inside a
// `with` scope holding stubs for them. Driving it beats reading it: the whole
// risk in this change was arithmetic, and arithmetic is exactly what a source
// read cannot check.
const liveSteps = (() => {
  const i = chat.indexOf("function reactLiveStepsHTML(");
  const end = chat.indexOf("\nfunction ", i + 10);
  assert.ok(i > 0 && end > i, "reactLiveStepsHTML is gone");
  const ctx = {
    esc: (s) => String(s == null ? "" : s),
    stStepRow: (o) => JSON.stringify({ label: o.label, state: o.state }),
    stAgentsBody: () => "", stCodeBody: () => "", stImgsBody: () => "",
    siteBuild: null,
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function("ctx", "with (ctx) {" + chat.slice(i, end) + "\n return reactLiveStepsHTML; }")(ctx);
  return (build) => {
    ctx.siteBuild = build;
    return [...fn().matchAll(/\{"label":"([^"]+)","state":"([^"]+)"\}/g)].map((m) => m[1] + ":" + m[2]);
  };
})();

test("no build step claims to be generating images", () => {
  // IT DID, ON EVERY BUILD. Nothing on the React path generates an image — the
  // generator in worker.js is from the static-site era and is unreachable from
  // here, and nothing emits the `image` stream event this UI listens for. So the
  // row sat pending and then reported itself DONE: a step claiming work that was
  // never attempted.
  for (const rphase of ["generating", "compiling", "fixing", "publishing", "database"]) {
    const labels = liveSteps({ rphase, images: [] }).join(" ");
    assert.ok(!/image/i.test(labels), rphase + " still advertises an images step: " + labels);
  }
  // The receiving half stays, guarded on there BEING images, so it reports what
  // happened rather than what was planned — and lights up on its own if
  // generation is ever wired.
  assert.match(liveSteps({ rphase: "compiling", images: [{ url: "u", prompt: "p" }] }).join(" "),
    /Generated images:done/, "a build that really produced images could not show them");
});

test("every build phase shows the right steps in the right state", () => {
  // THE ARITHMETIC. Removing a phase from `order` used to silently re-point
  // three magic indices (`idx > 0`, `idx > 2`, `idx >= 4`) at the wrong steps;
  // they are named lookups now. This is the table that proves it, and it is the
  // check that would have caught the off-by-one.
  assert.deepEqual(liveSteps({ rphase: "generating" }),
    ["Writing the code:run", "Compiling React:wait"]);
  assert.deepEqual(liveSteps({ rphase: "compiling" }),
    ["Wrote the code:done", "Compiling React:run"]);
  assert.deepEqual(liveSteps({ rphase: "fixing" }),
    ["Wrote the code:done", "Fixing a build error:run"]);
  assert.deepEqual(liveSteps({ rphase: "publishing" }),
    ["Wrote the code:done", "Compiled React:done", "Publishing:run"]);
  assert.deepEqual(liveSteps({ rphase: "database" }),
    ["Wrote the code:done", "Compiled React:done", "Published:done", "Setting up the database:run"]);
  // A publishing row must not appear before publishing is reached — that was
  // `idx >= 4` against a list whose indices just moved.
  for (const rphase of ["generating", "compiling"]) {
    assert.ok(!liveSteps({ rphase }).some((r) => /^Publish/.test(r)), rphase + " claims to be publishing");
  }
});

test("a site built before the fix still gets its pages", () => {
  // FIXING THE BUILD PATH FIXED NOTHING ANYBODY ALREADY OWNED. The page list is
  // written at build time into localStorage, so every site that already existed
  // kept its single `{path:'/', name:'App'}` placeholder and went on showing a
  // dead "Homepage" label. The owner reloaded, saw the other two fixes land, and
  // this one apparently do nothing.
  //
  // The route files are recoverable: every build message keeps the list it
  // wrote, which is what the steps panel renders its chips from.
  const ctx = { reactRoutePages, lastBuildFiles: null, sitePages: null };
  for (const n of ["lastBuildFiles", "sitePages"]) {
    const i = chat.indexOf("function " + n + "(");
    const end = chat.indexOf("\nfunction ", i + 10);
    assert.ok(i > 0 && end > i, n + " is gone");
    // eslint-disable-next-line no-new-func
    ctx[n] = new Function("ctx", "with (ctx) {" + chat.slice(i, end) + "\n return " + n + "; }")(ctx);
  }
  const pages = (s) => ctx.sitePages(s).map((p) => p.name + " " + p.path);

  const legacy = {
    react: true,
    pages: [{ path: "/", name: "App", html: "" }],
    msgs: [{ r: "u", t: "hey" }, { r: "a", t: "built", build: { files: ["index.tsx", "press.tsx", "music.tsx"] } }],
  };
  assert.deepEqual(pages(legacy), ["Home /", "Press /press", "Music /music"]);
  // The NEWEST build wins — a revise that changed the pages must not be read
  // through an older message's list.
  legacy.msgs.push({ r: "a", t: "revised", build: { files: ["index.tsx", "book.tsx"] } });
  assert.deepEqual(pages(legacy), ["Home /", "Book /book"]);

  // Nothing to recover from: keep what is stored rather than emptying the picker.
  assert.deepEqual(pages({ react: true, pages: [{ path: "/", name: "App", html: "" }], msgs: [{ r: "u", t: "hey" }] }),
    ["App /"]);
  // A site whose pages were stored properly is left alone — INCLUDING when a
  // build message is sitting there to re-derive from. Only the single-entry
  // placeholder is a placeholder; anything else is the real list and re-deriving
  // it on every render would quietly overrule whatever is stored.
  const stored = {
    react: true,
    pages: [{ path: "/", name: "Home", html: "" }, { path: "/press", name: "Press", html: "" }],
    msgs: [{ r: "a", t: "built", build: { files: ["index.tsx", "menu.tsx", "extra.tsx"] } }],
  };
  assert.deepEqual(pages(stored), ["Home /", "Press /press"]);
  // A HYBRID RECORD: a static site later rebuilt as React can still be carrying
  // its one old page, and that page has html — which is what tells it apart from
  // the placeholder this recovery is for.
  assert.deepEqual(pages({ react: true, pages: [{ path: "/", name: "Home", html: "<h1>old</h1>" }],
    msgs: [{ r: "a", t: "built", build: { files: ["index.tsx", "press.tsx"] } }] }), ["Home /"]);
  // A STATIC site is untouched — its one page has real html and is not a
  // placeholder standing in for routes.
  assert.deepEqual(pages({ pages: [{ path: "/", name: "Home", html: "<h1>x</h1>" }] }), ["Home /"]);
});

// ── the menu's own styling ───────────────────────────────────────────────────

test("the page menu is on the current theme, not the one before it", () => {
  // IT NEVER GOT RESTYLED when the platform went black-and-white, and nobody saw
  // it because the picker never rendered — a React build stored one page, so
  // nothing above one ever opened this menu. Deriving the pages exposed three
  // dark-theme leftovers at once.
  const css = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const i = css.indexOf(".st-pagemenu {");
  assert.ok(i > 0, "the page menu styling is gone");
  const menu = css.slice(i, css.indexOf(".st-pi-path", i));

  // A SOLID SURFACE. It was `var(--panel-2)` — a 7% black tint on white — so the
  // menu was effectively transparent and the URL chip read straight through it.
  assert.match(menu, /\.st-pagemenu \{[^}]*background: #ffffff/,
    "the menu background is a tint again; whatever is behind it will show through");
  // The hover was rgba(255,255,255,.06): white on white, i.e. nothing.
  assert.ok(!/background: rgba\(255, ?255, ?255/.test(menu), "a white-on-white hover is back");
  // And the selected row painted the near-black --split gradient as a slab.
  assert.ok(!/--split/.test(menu), "the selected row is filled with the accent gradient again");
});

test("a page-menu row is never given on-accent text", () => {
  // THE PAIRING THAT BROKE. A late rebrand rule sets `color: var(--on-accent)`
  // — white — on every control with a near-black FILL. `.st-pageitem.on` was in
  // that list because those rows used to be dark; changing the row to a light
  // surface without leaving the list rendered the label white on white.
  //
  // The rule and the background have to agree, and this asserts the agreement
  // rather than either half: a row in the on-accent list must be dark-filled.
  const css = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const sweep = css.match(/^[^\n]*\.st-msg\.u\{color:var\(--on-accent\)\}/m);
  assert.ok(sweep, "the on-accent sweep rule moved; this guard checks nothing");
  assert.ok(!/\.st-pageitem\.on/.test(sweep[0]),
    "the page-menu row is back in the on-accent list, and its label will render white on white");
  // The controls left in it are the dark-filled ones, so the rule still has work
  // to do — an empty list would pass the check above for the wrong reason.
  assert.match(sweep[0], /\.st-msg\.u/);
  assert.match(sweep[0], /\.st-vtab\.on/);
});
