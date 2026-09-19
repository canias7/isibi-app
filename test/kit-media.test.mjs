// THE MEDIA COMPONENTS A CUSTOMER'S OWN URL GOES INTO (2026-09-19).
//
// Three kit parts take a URL somebody supplies — `video-embed` for YouTube and
// Vimeo, `video-player` for a file, `audio-player` for a sound file — and the
// addon's whole media flow ends at one of them. This drives the REAL template
// files with react-dom/server: a signature list says what props exist, and only
// a render says what the component does with them.
//
// ⚠ THE DEFECT THIS FILE WAS OPENED FOR. `video-embed` stamped `data-slot` on
// its FALLBACK branch and on nothing else, so a video that WORKS was invisible
// to every reader that counts slots — `curl … | grep -o 'data-slot="[^"]*"'`,
// which is how "what does this site really use" is answered with no auth and no
// publish, and the css lane, which is required to target by `data-slot`. Both
// consequences were backwards: a working video read as no video at all, and a
// BROKEN one was the only kind that showed up. Recorded as open since
// 2026-09-17 and measured still present before this was written.
//
// NOTHING HERE TOUCHES A NETWORK. An embed is an `<iframe src>` and a player is
// a `<video src>`; the markup is the subject and no third party is asked for
// anything — which is also why these are safe to run in CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderKit } from "./fixtures/site-render.mjs";
import fs from "node:fs";
import path from "node:path";

const EMBED = "src/components/ui/video-embed.tsx";
const PLAYER = "src/components/ui/video-player.tsx";
const AUDIO = "src/components/ui/audio-player.tsx";

/** Every `data-slot` value in a rendered fragment, in order. */
const slots = (html) => [...html.matchAll(/data-slot="([^"]*)"/g)].map((m) => m[1]);

test("a working video embed is countable, and so is the fallback", () => {
  // THE WORKING BRANCH — the one the defect made invisible.
  const ok = renderKit(EMBED, "VideoEmbed", { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  assert.deepEqual(slots(ok), ["video-embed"], "a working video embed carries no data-slot, so nothing can count it");
  assert.match(ok, /<iframe/, "the working branch did not render an iframe — this case tests nothing");
  // AND THE FALLBACK, which already worked and must go on working: the two
  // together are what make the slot mean "this page has a video embed on it"
  // rather than "this page has a broken one".
  const bad = renderKit(EMBED, "VideoEmbed", { url: "not a video at all" });
  assert.deepEqual(slots(bad), ["video-embed"], "the fallback lost its data-slot");
  assert.match(bad, /Video unavailable/, "the fallback did not render its own panel");
  assert.doesNotMatch(bad, /<iframe/, "the fallback rendered an iframe for an unparseable url");
});

test("the privacy-preserving host is what a supplied url becomes", () => {
  // The component's own reason for existing: a small business's site must not
  // drop a tracking cookie on a visitor who never pressed play. Every shape a
  // customer really pastes, and the id carried through each.
  const cases = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/123456789", "player.vimeo.com/video/123456789?dnt=1"],
    ["https://vimeo.com/video/123456789", "player.vimeo.com/video/123456789?dnt=1"],
  ];
  for (const [url, want] of cases) {
    const html = renderKit(EMBED, "VideoEmbed", { url });
    assert.ok(html.includes(want), url + " did not become " + want + " — got: " + html.slice(0, 200));
    // AND THE ORIGINAL HOST IS GONE, which is the half that is really about
    // privacy: rendering the right embed beside the tracking one would pass a
    // substring check and set the cookie anyway.
    assert.doesNotMatch(html, /src="https:\/\/(www\.)?youtube\.com|src="https:\/\/vimeo\.com/,
      url + " reached the page as the tracking host");
  }
});

test("the title and the ratio a designer supplies reach the markup", () => {
  // The props `siteComponentApi` promises the page writer, driven: a prop that
  // is offered and ignored is a dead control one layer down.
  const html = renderKit(EMBED, "VideoEmbed", {
    url: "https://youtu.be/abc123", title: "The workshop tour", ratio: "4/3",
  });
  assert.match(html, /title="The workshop tour"/, "the supplied title did not reach the iframe");
  assert.match(html, /aspect-ratio:\s*4\/3/, "the supplied ratio did not reach the style");
  // THE DEFAULTS ARE THE SIGNATURE'S, so a designer that names neither gets
  // what the page writer was told it would get.
  const bare = renderKit(EMBED, "VideoEmbed", { url: "https://youtu.be/abc123" });
  assert.match(bare, /title="Video"/);
  assert.match(bare, /aspect-ratio:\s*16\/9/);
});

test("a hosted video carries its captions, its poster and its slot", () => {
  // CAPTIONS ARE THE OPTION MOST EASILY LOST. `video-player` declares
  // `captions?: {src, label, lang, default}[]` and the page writer is shown
  // that signature; a component that took the prop and rendered no <track>
  // would be a site promising subtitles it does not serve.
  const html = renderKit(PLAYER, "VideoPlayer", {
    src: "/u/fw/tour.mp4",
    poster: "/u/fw/tour.jpg",
    title: "The workshop tour",
    captions: [
      { src: "/u/fw/tour.en.vtt", label: "English", lang: "en", default: true },
      { src: "/u/fw/tour.cy.vtt", label: "Cymraeg", lang: "cy" },
    ],
  });
  assert.ok(slots(html).includes("video-player"), "a hosted video carries no data-slot");
  assert.match(html, /src="\/u\/fw\/tour\.mp4"/, "the supplied src did not reach the video element");
  assert.match(html, /poster="\/u\/fw\/tour\.jpg"/, "the supplied poster did not reach the video element");
  const tracks = [...html.matchAll(/<track[^>]*>/g)].map((m) => m[0]);
  assert.equal(tracks.length, 2, "both caption tracks did not render: " + JSON.stringify(tracks));
  assert.match(tracks[0], /srcLang="en"|srclang="en"/, "the first track lost its language");
  assert.match(tracks[0], /label="English"/, "the first track lost its label");
  assert.match(tracks[1], /label="Cymraeg"/, "the second track lost its label");
  // `playsInline` IS NOT OPTIONAL and the component's own header says why:
  // without it iOS Safari takes any playing video fullscreen, which is
  // invisible on every desktop browser used to build the page.
  assert.match(html, /playsinline|playsInline/i, "playsInline is gone, and iOS takes the video fullscreen");
});

test("a sound file plays from the url it was given, with a way out if it cannot", () => {
  const html = renderKit(AUDIO, "AudioPlayer", { src: "/u/fw/interview.mp3", title: "The interview" });
  assert.ok(slots(html).includes("audio-player"), "a sound file carries no data-slot");
  assert.match(html, /<audio[^>]*controls/, "the browser's own controls are gone");
  assert.match(html, /src="\/u\/fw\/interview\.mp3"/, "the supplied src did not reach the audio element");
  assert.match(html, /The interview/, "the supplied title did not render");
  // THE FALLBACK IS A REAL LINK to the same file — a browser that cannot play
  // the format still lets somebody have it.
  assert.match(html, /<a href="\/u\/fw\/interview\.mp3"/, "a browser that cannot play the file is offered nothing");
  // AND A TITLELESS ONE RENDERS, because `title` is optional in the signature.
  const bare = renderKit(AUDIO, "AudioPlayer", { src: "/u/fw/interview.mp3" });
  assert.match(bare, /<audio[^>]*controls/);
});

// ── EVERY PACKAGE A RENDER GUARD LOADS IS DECLARED AT THE ROOT ──────────────
//
// ⚠ THIS EXISTS BECAUSE CI WENT RED FOR FOUR PUSHES AND LOCAL STAYED GREEN.
// `renderKit` loads the REAL template file and falls through to `require` for
// any bare specifier — which resolves here, where the template's own
// `node_modules` is installed, and does not in `unit.yml`, which runs
// `npm ci` at the ROOT and nothing else. `video-player.tsx` imports
// `lucide-react`; the root did not declare it; CI answered
// `Cannot find module 'lucide-react'` on two cases while every local run
// passed. This repository's own recorded trap — *a CI step that does not
// install what the tests import* — and it is only catchable by a census,
// because a new kit component pulling in a new package looks like nothing at
// all until somebody reads the run.
//
// THE CENSUS IS OVER WHAT THE GUARDS REALLY LOAD, derived from their own
// `renderKit` calls rather than from a list typed here, so a component added
// to a render guard next month brings its packages with it.
test("every package the render guards load is declared at the root", () => {
  const ROOT = path.join(import.meta.dirname, "..");
  const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");
  const declared = new Set(Object.keys(
    JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).devDependencies || {}));

  // WHICH FILES — off the guards' own calls. `renderKit("<path>", …)`.
  const files = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, "test")).filter((x) => x.endsWith(".test.mjs"))) {
    const src = fs.readFileSync(path.join(ROOT, "test", f), "utf8");
    for (const m of src.matchAll(/renderKit\(\s*"([^"]+)"/g)) files.add(m[1]);
    // …and the ones behind a constant, which is how this file names them.
    for (const m of src.matchAll(/=\s*"(src\/components\/ui\/[a-z0-9-]+\.tsx)"/g)) files.add(m[1]);
  }
  assert.ok(files.size >= 3, "the census found no rendered kit files — its observer is dead: " + files.size);

  // WHICH PACKAGES — every bare specifier, walked transitively through the
  // `@/` imports the resolver follows, because a component's own import of a
  // kit helper is how a package arrives without appearing in the guard.
  const seen = new Set(), need = new Map();
  const walk = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const abs = path.join(TEMPLATE, rel);
    if (!fs.existsSync(abs)) return;
    for (const m of fs.readFileSync(abs, "utf8").matchAll(/^\s*import[^"']*["']([^"']+)["']/gm)) {
      const id = m[1];
      if (id.startsWith("@/")) {
        const base = path.join("src", id.slice(2));
        for (const ext of [".tsx", ".ts"]) if (fs.existsSync(path.join(TEMPLATE, base + ext))) walk(base + ext);
        continue;
      }
      if (id.startsWith(".") || id.startsWith("/")) continue;
      // `react` and `react-dom/server` are handed in by the resolver itself
      // and are declared anyway; a scoped or sub-path import declares its
      // PACKAGE (`@scope/name`, or the first segment).
      const pkg = id.startsWith("@") ? id.split("/").slice(0, 2).join("/") : id.split("/")[0];
      if (!need.has(pkg)) need.set(pkg, rel);
    }
  };
  for (const f of files) walk(f);
  assert.ok(need.size >= 1, "no packages were found at all — the import scan is dead");

  const missing = [...need].filter(([p]) => !declared.has(p));
  assert.deepEqual(missing, [],
    "these packages are loaded by a render guard and NOT declared in the root package.json, "
    + "so CI cannot resolve them however green this machine is: "
    + missing.map(([p, from]) => p + " (from " + from + ")").join(", "));
});
