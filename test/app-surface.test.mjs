// An app is its own product, made by the same process as a site (2026-10-20,
// owner: "you don't need to have a website. You can just build an app" and
// "everything the same as the site … it's literally just the same process").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageRulesFor, APP_PAGE_RULES } from "../builder/page-gen.mjs";

const page = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("an app's screens are written with the site's rules plus the app's, which come last and win", () => {
  const site = pageRulesFor({});
  const app = pageRulesFor({ surface: "app" });
  assert.equal(app, site + APP_PAGE_RULES, "the same rules, with the app's after them");
  assert.ok(!site.includes("THIS IS A PHONE APP"), "a website's rules are unchanged");
  assert.match(APP_PAGE_RULES, /`AppChrome` from "@\/components\/ui\/app-chrome", never `SiteChrome`/);
  assert.match(APP_PAGE_RULES, /five at most/);
  assert.match(APP_PAGE_RULES, /Never mention a website/);
});

test("the kit carries the app's frame: a top bar and tabs from the same links", () => {
  const src = readFileSync(new URL("../builder/lovable/template/src/components/ui/app-chrome.tsx", import.meta.url), "utf8");
  assert.match(src, /export function AppChrome\(/);
  assert.match(src, /const tabs = links\.slice\(0, 5\);/);
  assert.match(src, /aria-label="Tabs"/);
  assert.doesNotMatch(src, /SiteFooter/, "an app has no footer");
  assert.match(readFileSync(new URL("../docs/components.md", import.meta.url), "utf8"), /app-chrome/);
});

test("the build is told it makes an app: the design is told first, and the pages are marked", () => {
  assert.match(worker, /const surface = body && body\.surface === "app" \? "app" : "site";/);
  assert.match(worker, /const designBrief = \(surface === "app" \? APP_DESIGN_NOTE : ""\) \+ briefWithLinks/);
  assert.match(worker, /if \(surface === "app"\) spec\.surface = "app";/);
  assert.match(worker, /THIS IS A PHONE APP, NOT A WEBSITE\. Design it as an app/);
});

test("the page: picking an app makes the project an app, sends it to the build, keeps it with the chat, and shows it in the phones", () => {
  assert.match(page, /const isApp = kindNow === 'android' \|\| kindNow === 'ios';/);
  assert.match(page, /\.\.\.\(isApp \? \{ surface: 'app', appOs: kindNow \} : \{\}\)/);
  assert.match(page, /surface: site\.surface === 'app' \? 'app' : undefined,/);
  assert.match(page, /surface: s\.surface === 'app' \? 'app' : undefined, appOs: s\.appOs === 'android' \|\| s\.appOs === 'ios' \? s\.appOs : undefined \};/, "the chat carries it, and which phone, to other devices");
  // Only the phone the app was made for shows it.
  assert.match(page, /\(madeFor\(v\) \? inside : words\)/, "the other phone stays empty");
  assert.match(page, /siteMobilePanel\(hasSite, siteMobileOs, appSrc, site\.appOs\)/);
  assert.match(page, /if \(c\.surface === 'app'\) s\.surface = 'app';/);
  assert.match(worker, /surface: b\.surface === "app" \? "app" : undefined,/);
  assert.match(page, /const appSrc = site\.surface === 'app' && site\.slug && typeof sitePreviewSrc === 'function' \? sitePreviewSrc\(site\) : '';/);
  assert.match(page, /siteMobilePanel\(hasSite, siteMobileOs, appSrc, site\.appOs\) \+/);
  assert.match(page, /<iframe class="st-mob-frame" title="The app"/);
  assert.doesNotMatch(page, /Build your website first, then ask me for the app/, "an app needs no website");
  assert.match(page, /'Download Android app'/);
  assert.match(page, /\.\.\.\(site\.surface === 'app' \? \{ mode: 'bundled' \} : \{\}\)/, "an app's download carries its own screens");
});

test("an app's screens are wrapped in AppChrome by the band assembler, a site's in SiteChrome", async () => {
  const { assembleBands } = await import("../builder/page-bands.mjs");
  const band = { name: "Hero", source: "export default function Hero() { return <section>Hi</section>; }" };
  const chrome = { name: "Harbour Loaf", tagline: "Bread", links: [{ label: "Home", href: "/" }] };
  const app = assembleBands({ route: "/", chrome, bands: [band], app: true }).source;
  assert.match(app, /import \{ AppChrome \} from "@\/components\/ui\/app-chrome";/);
  assert.match(app, /<AppChrome name="Harbour Loaf" links=/);
  assert.doesNotMatch(app, /SiteChrome|tagline/);
  const site = assembleBands({ route: "/", chrome, bands: [band] }).source;
  assert.match(site, /<SiteChrome name="Harbour Loaf" tagline="Bread"/);
  assert.doesNotMatch(site, /AppChrome/);
});
