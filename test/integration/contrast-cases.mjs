// THE FALSE-ALARM RATE OF THE CONTRAST CHECK, measured rather than argued.
//
// `probe()`'s contrast pass ships its verdict to the CUSTOMER — on the build and
// on every edit lane — as "has text that is nearly invisible". So a wrong answer
// is not a noisy log line, it is us telling somebody their correct page is
// broken, which this repo rates strictly worse than the miss.
//
// It read `backgroundColor` only, and a gradient sets no background COLOUR. So
// the single most common hero there is — a photograph, a `from-black/60` scrim,
// white text — walked past both layers, reached `body`, and measured white on
// white: **1:1**, on every build of every picture-led site. Measured in this
// harness before the fix; the colour lint could not see it either, since
// `TAILWIND_PALETTE` lists no `white` or `black`.
//
// WHY THIS IS ITS OWN HARNESS AND NOT PART OF `site-build`: it needs no
// container, no dist and no model — a static page and the real `probe()` — so it
// costs about two seconds and can afford to carry the cases that PIN the
// boundary rather than only the two customer-facing shapes. `site-build` keeps
// those two, driven through a real compiled site.
//
// EVERY CASE IS BOTH DIRECTIONS. A check that stops reporting is
// indistinguishable from one that was fixed, so the true positives are as
// load-bearing as the false alarms.
import fs from "node:fs";
import http from "node:http";

const SRC = fs.readFileSync(new URL("../../builder/site-render.mjs", import.meta.url), "utf8");
// The probe is an inline function handed to `page.evaluate` as source, exactly
// as `render-check.mjs` does it — so this drives the REAL one rather than a copy.
const at = SRC.indexOf("function probe(");
const PROBE = SRC.slice(at, SRC.indexOf("\n}", SRC.indexOf("return out;", at)) + 2);
if (!PROBE.includes("solidBehind") || !PROBE.includes("coveredByPicture")) {
  console.error("could not lift probe() — rescope this harness");
  process.exit(1);
}

const PHOTO = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"8\" height=\"8\"><rect width=\"8\" height=\"8\" fill=\"%23888\"/></svg>')";
const PAGE = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; font-family: system-ui; }
  .hero { position:relative; height:320px; overflow:hidden; }
  .photo { position:absolute; inset:0; background-image:${PHOTO}; background-size:cover; }
  .scrim { position:absolute; inset:0; background-image:linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,0)); }
  .cap { position:absolute; left:24px; bottom:24px; }
  .cap h1 { font-size:40px; margin:0; }
  .cap p { font-size:16px; margin:6px 0 0; }
</style></head><body>${body}</body></html>`;

const COPY = "Walk in or book a chair online today, seven days a week.";
const cap = (colour) => `<div class="cap" style="color:${colour}"><h1>Sharp Fade Barbers</h1><p>${COPY}</p></div>`;

const CASES = [
  // ── correct pages, which must come back clean ──────────────────────────────
  ["a hero caption NESTED in the scrim", true,
    PAGE(`<div class="hero"><div class="photo"></div><div class="scrim">${cap("#fff")}</div></div>`)],
  ["a hero caption that is a SIBLING of the scrim", true,
    PAGE(`<div class="hero"><div class="photo"></div><div class="scrim"></div>${cap("#fff")}</div>`)],
  ["the same hero with dark text", true,
    PAGE(`<div class="hero"><div class="photo"></div><div class="scrim">${cap("#111")}</div></div>`)],
  ["an ordinary page with no picture at all", true,
    PAGE(`<div style="background:#fff;padding:40px"><p style="color:#111;font-size:16px">${COPY}</p></div>`)],
  // THE ONE THE ANCESTOR BRANCH ALONE CATCHES. A picture-backed wrapper with no
  // box of its own never enters `painted`, so `coveredByPicture` cannot see it —
  // measured: removing that branch makes this page report 1:1 while every other
  // case here stays clean, which is why the branch is not the redundancy it
  // looks like. Tailwind spells `display: contents` as `contents`.
  ["a picture-backed ancestor with no box (display:contents)", true,
    PAGE(`<div style="display:contents;background-image:${PHOTO}"><div style="display:contents"><p style="color:#fff;font-size:16px">${COPY}</p></div></div>`)],

  // ── genuinely unreadable text, which must keep being reported ──────────────
  ["grey copy on a dark page", false,
    PAGE(`<div style="background:#111;padding:40px"><p style="color:#3a3a3a;font-size:16px">${COPY}</p></div>`)],
  // THE GLOSS-BUTTON CASE, and it is what makes the ordering load-bearing:
  // `.bg-primary` is an OPAQUE colour with a gradient laid over it, so the colour
  // branch must run before the picture branch or every button label on a gloss
  // theme silently stops being checked.
  ["a gloss button label", false,
    `<!doctype html><html><body style="margin:0"><div style="background:#fff;padding:40px"><button style="background:#f2f2f2;background-image:linear-gradient(#fff,#eee);color:#e8e8e8;font-size:16px;padding:12px 20px">Book a chair now today</button></div></body></html>`],
  ["faint copy on white", false,
    PAGE(`<div style="background:#fff;padding:40px"><p style="color:#ededed;font-size:16px">${COPY}</p></div>`)],
];

const pages = new Map();
const server = http.createServer((req, res) => {
  const html = pages.get(req.url);
  if (!html) { res.writeHead(404); res.end("no"); return; }
  res.writeHead(200, { "content-type": "text/html" }); res.end(html);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let browser = null;
let pass = 0, fail = 0;
const ok = (what, cond, detail) => {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (detail ? "  -> " + detail : "")); }
};

try {
  const { chromium } = await import("playwright-core");
  const opts = { args: ["--no-sandbox", "--disable-dev-shm-usage"] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  browser = await chromium.launch(opts);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  for (const [name, wantClean, html] of CASES) {
    const url = "/" + Buffer.from(name).toString("hex");
    pages.set(url, html);
    await page.goto(`http://127.0.0.1:${port}${url}`, { waitUntil: "load" });
    const out = await page.evaluate(`(() => { ${PROBE}; return probe(); })()`);
    // THE OBSERVER MUST HAVE BEEN ALIVE. Four of these pass by an ABSENCE, and a
    // probe that scanned nothing satisfies all of them — the vacuous-clean
    // failure this repo has already shipped once in exactly this check.
    ok("the probe actually looked at " + name, out.scanned > 0, "scanned=" + out.scanned);
    const clean = out.contrast.length === 0;
    ok((wantClean ? "CLEAN: " : "REPORTED: ") + name, clean === wantClean,
      clean ? "clean" : out.contrast.map((c) => c.ratio + ":1").join(","));
  }
} catch (e) {
  console.error("harness failed:", (e && e.message) || e);
  fail++;
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
