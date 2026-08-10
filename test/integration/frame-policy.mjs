// DOES THE PREVIEW PANE ACTUALLY LOAD?
//
// This exists because that question was answered "yes" twice from a header and
// was wrong both times. Framing takes TWO policies and they are served by two
// different responses on two different hostnames:
//
//   the SITE says who may frame it        → `frame-ancestors` (on <slug>.gofarther.app)
//   the WORKSPACE says what it may frame  → `frame-src`       (on gofarther.dev)
//
// Chrome refuses on either one and renders the SAME sentence — "This content is
// blocked. Contact the site owner to fix the issue." — so reading one header and
// finding it correct tells you nothing about whether the pane works. Measured
// 2026-08-10: the site's half was fixed, verified by curl, reported as done, and
// the pane stayed blank because the workspace was still refusing.
//
// WHAT IS REAL HERE AND WHAT IS NOT, stated because the distinction is the whole
// value: the policy strings are fetched from PRODUCTION, the origins are the real
// ones, and Chrome does the enforcing. Only the transport is faked — the headless
// browser has no outbound egress in this container (`curl` gets 200 from a site
// the browser answers ERR_CONNECTION_RESET for), so the two responses are served
// by route interception instead of over the wire. That means this proves the two
// policies work TOGETHER; `curl` is what proves the server really sends them.
//
// It has to be able to FAIL, which the first attempt at this could not: with no
// egress a naive harness reports "blocked" for the allowed origin and the refused
// one alike, and two identical falses read like a result. So every run also
// drives a stranger's origin, which MUST be blocked — if both answers agree, the
// harness is broken and says so rather than reporting a pass.
//
// $0: no model call, no Neon project, no build.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");
const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");

// Same discovery as site-runtime.mjs: whatever Chromium is already here. The
// pinned playwright build and the pre-installed one often disagree and the build
// number is not what this is about.
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const rels = ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"];
  const found = [];
  try {
    for (const dir of fs.readdirSync(root)) {
      for (const rel of rels) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) found.push(p);
      }
    }
  } catch { /* fall through to playwright's own lookup */ }
  found.sort((a, b) => Number(/headless/.test(a)) - Number(/headless/.test(b)));
  return found[0] || null;
}

// DELIBERATELY A HOSTNAME THAT DOES NOT EXIST. `harden` applies the site policy
// by MOUNT, so a 404 on the site zone carries exactly the headers a real site
// carries (verified) — and depending on a real customer site would make this go
// red the day the owner deletes it, for a reason that has nothing to do with
// framing. Whether any given site is up is `build smoke`'s job, not this one's.
const APP = process.env.APP_ORIGIN || "https://gofarther.dev";
const SITE = process.env.SITE_URL || "https://frame-policy-probe.gofarther.app/";
const MARK = "FRAME-POLICY-CHILD-RENDERED";

let passed = 0, failed = 0;
const ok = (cond, name, extra) => {
  if (cond) { passed++; console.log("  ok   " + name); }
  else { failed++; console.log("  FAIL " + name + (extra ? "\n       " + extra : "")); }
};

async function cspOf(url) {
  const r = await fetch(url, { redirect: "manual" });
  const csp = r.headers.get("content-security-policy");
  return { csp, status: r.status, xfo: r.headers.get("x-frame-options") };
}

console.log("frame policy — " + APP + " framing " + SITE);

const parent = await cspOf(APP + "/");
const child = await cspOf(SITE);

// A missing policy is not a pass. Without this the browser run below happens
// with `null` headers, which Chrome treats as "no restriction" — every check
// would go green on a platform serving no CSP at all.
ok(!!parent.csp, "the workspace serves a Content-Security-Policy", "got " + parent.status);
ok(!!child.csp, "the site zone serves a Content-Security-Policy", "got " + child.status);
// THE PRECONDITION THAT MATTERS IS WHICH POLICY, NOT WHETHER A SITE IS UP. If
// the site zone were handed the platform's app policy — the exact bug this file
// was written for — the browser run below would correctly report "blocked" and
// read as a framing regression, when the real fault is the mount detection.
// Named separately so the two cannot be confused in a red run.
ok(/frame-ancestors 'self' https:\/\//.test(child.csp || ""),
  "the site zone gets the WEBSITE policy, not the platform's",
  "got " + (child.csp || "").match(/frame-ancestors [^;]*/) + " — harden() is misreading the mount");
// X-Frame-Options has no syntax for "self plus one other origin", so any value
// on a published site either blocks the preview or is ignored.
ok(!child.xfo, "the site sends no X-Frame-Options", "got " + child.xfo);

if (failed) { console.log("\n" + passed + " passed, " + failed + " failed"); process.exit(1); }

const exe = findChromium();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

async function embedFrom(origin) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.route(origin + "/__frame-policy", (r) => r.fulfill({
    status: 200,
    headers: { "content-type": "text/html", "content-security-policy": parent.csp },
    body: '<!doctype html><meta charset=utf-8><iframe id=f src="' + SITE + '" width=600 height=300></iframe>',
  }));
  await p.route(SITE, (r) => r.fulfill({
    status: 200,
    headers: { "content-type": "text/html", "content-security-policy": child.csp },
    body: "<!doctype html><meta charset=utf-8><body><h1>" + MARK + "</h1>",
  }));
  await p.goto(origin + "/__frame-policy", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  const f = p.frames().find((x) => x.url().startsWith(SITE));
  let rendered = false;
  if (f) { try { rendered = (await f.content()).includes(MARK); } catch { /* opaque = not rendered */ } }
  await ctx.close();
  return rendered;
}

const fromApp = await embedFrom(APP);
const fromStranger = await embedFrom("https://not-the-platform.example");
await browser.close();

ok(fromApp, "the workspace can frame the site — this is the preview pane",
  "blocked. Check BOTH: frame-src on " + APP + " (" + (parent.csp.match(/frame-src [^;]*/) || ["absent"])[0] +
  ") and frame-ancestors on the site (" + (child.csp.match(/frame-ancestors [^;]*/) || ["absent"])[0] + ")");
ok(!fromStranger, "…and a stranger cannot", "the site is framable by anyone — clickjacking");
// THE HARNESS MUST BE ABLE TO FAIL. With no egress a broken run blocks both, and
// two identical answers read exactly like a working policy that is merely strict.
ok(fromApp !== fromStranger, "the harness discriminates (both answers agree = it proves nothing)");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
