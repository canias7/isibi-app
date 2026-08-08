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

const lift = (name) => {
  const i = chat.indexOf("function " + name + "(");
  assert.ok(i > 0, name + " is gone; this file checks nothing");
  const end = chat.indexOf("\nfunction ", i + 10);
  assert.ok(end > i, "could not find the end of " + name);
  // eslint-disable-next-line no-eval
  return eval(chat.slice(i, end) + "\n" + name);
};
const reactRoutePages = lift("reactRoutePages");
const siteChipUrl = lift("siteChipUrl");
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
  // IT DID NOT. For a React site it read "gofarther.dev/s/hey/press", and that
  // page does not live there: the app routes on the hash, so the server looks
  // for `sites/hey/press.html` and 404s. This is the string people copy out of
  // the preview to send to somebody.
  const react = { slug: "hey", react: true };
  assert.equal(siteChipUrl(react, "/press"), "gofarther.dev/s/hey/#/press");
  assert.equal(siteChipUrl(react, "/"), "gofarther.dev/s/hey/");
  assert.equal(siteChipUrl(react, null), "gofarther.dev/s/hey/");
  // THE TRAILING SLASH IS NOT COSMETIC — the bundle is referenced relatively, so
  // without it the browser resolves /s/assets/... and the page renders blank.
  assert.ok(siteChipUrl(react, "/").endsWith("/"), "the chip drops the trailing slash");
  // A static site has real paths and no hash.
  assert.equal(siteChipUrl({ slug: "hey" }, "/press"), "gofarther.dev/s/hey/press");
  // No slug yet: say so rather than showing a broken link.
  assert.match(siteChipUrl({}, "/"), /Draft preview/);
  assert.match(siteChipUrl(null, "/"), /Draft preview/);
});

test("the preview follows the picked page", () => {
  // The label changed and the frame did not: `switchSitePage` only reloaded the
  // iframe when the page had `html` to load, which a React route never does.
  const i = chat.indexOf("function switchSitePage(");
  const block = chat.slice(i, chat.indexOf("\nfunction renderSites(", i));
  assert.ok(block.length > 300, "switchSitePage moved; this guard checks nothing");
  assert.match(block, /else if \(f && s\.react && s\.url\) f\.src =/,
    "picking a page on a React site changes the label and not the preview");
  // The path goes in the HASH. A real path would need the server to answer
  // /s/<slug>/press with index.html, and it answers 404.
  assert.match(block, /\(path !== '\/' \? '#' \+ path : ''\)/, "the page is not addressed by hash");

  // And the first render agrees with it, or opening a site lands somewhere the
  // picker then disagrees about.
  const j = chat.indexOf("if (fr && isReact) {");
  const first = chat.slice(j, j + 900);
  assert.match(first, /\(at !== '\/' \? '#' \+ at : ''\)/, "the initial preview ignores the active page");
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
