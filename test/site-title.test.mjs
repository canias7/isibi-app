// The app's own title, link previews, install manifest and sign-in subtitle
// describe the site builder. The media side was deleted on 2026-09-12, and its
// tagline ("AI video, image & voice") stayed in the tab title until 2026-10-16.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), "utf8");
const html = read("index.html");
const manifest = JSON.parse(read("site.webmanifest"));
const chat = read("chat.js");

const TITLE = "Go Farther · AI website builder";
const PREVIEW_TITLE = "Go Farther — AI website builder";
const LINE = "Describe your business and get a published website.";

const meta = (attr, name) => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  assert.ok(m, `${name} meta is present`);
  return m[1];
};

test("the tab title names the site builder", () => {
  const m = html.match(/<title>([^<]*)<\/title>/);
  assert.ok(m, "<title> is present");
  assert.equal(m[1].replace(/&amp;/g, "&"), TITLE);
});

test("link previews describe the site builder", () => {
  assert.equal(meta("property", "og:title"), PREVIEW_TITLE);
  assert.equal(meta("name", "twitter:title"), PREVIEW_TITLE);
  assert.equal(meta("property", "og:description"), LINE);
  assert.equal(meta("name", "twitter:description"), LINE);
});

test("the install manifest describes the site builder", () => {
  assert.equal(manifest.description, LINE);
});

test("the sign-in subtitle is the same line in the markup and in chat.js", () => {
  const m = html.match(/id="authSub">([^<]*)</);
  assert.ok(m, "authSub is present");
  assert.equal(m[1], LINE);
  assert.ok(chat.includes(`'${LINE}'`), "chat.js sets the same default subtitle");
});

test("no title, preview or subtitle still offers video, images or voice", () => {
  const shown = [html.match(/<head>[\s\S]*<\/head>/)[0], manifest.description, LINE];
  assert.ok(shown[0].length > 0);
  for (const text of shown) assert.doesNotMatch(text, /video|voice/i);
  assert.doesNotMatch(chat, /Create AI video/);
});
