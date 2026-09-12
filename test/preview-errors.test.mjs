// A PUBLISHED SITE'S RUNTIME ERRORS REACH THE WORKSPACE.
//
// THE DEFECT THIS CLOSES (2026-09-12, owner: "fix"). Every generated site
// carries `src/lib/error-reporting.ts`, which on any throw posts
// `{type:"isibi:runtime-error", report}` to `window.parent`. It was written for
// this panel and the panel never listened: `bindSiteNav`'s handler read
// `__siteErr` and `__siteNav` and nothing else, so the message arrived at a
// listener that dropped it.
//
// AND WHICH PREVIEW YOU ARE LOOKING AT IS WHAT DECIDED IT. `errShim` — the
// reporter that DOES reach `collectPreviewErr` — is injected by
// `sitePreviewHtml`, which serves the blob DRAFT preview only. A published site
// is framed at its own URL with no shim, so its own module is the only reporter
// it has. That is the ordinary case: the throw reached the visitor's console
// and our `/error` endpoint, and the owner watching the preview saw a blank
// panel and no badge.
//
// THE TWO ENDS ARE ASSERTED AGAINST EACH OTHER rather than both typed here. The
// wire string is read out of the template's own module and required in the
// browser, in both directions, so a rename of either end fails instead of going
// quiet — the recorded "two lists of the same thing", on a string whose whole
// job is to match.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const CHAT = fs.readFileSync(path.join(ROOT, "public/chat.js"), "utf8");
const REPORTER = fs.readFileSync(path.join(ROOT, "builder/lovable/template/src/lib/error-reporting.ts"), "utf8");

/** Cut a function out whole: its header to the line that closes it at column 0. */
const fn = (head) => {
  const at = CHAT.indexOf(head);
  assert.ok(at > 0, "chat.js no longer declares " + JSON.stringify(head));
  const end = CHAT.indexOf("\n}", at);
  assert.ok(end > at, head + " has no closing brace at column 0");
  return CHAT.slice(at, end + 2);
};

// THE PRODUCER'S OWN STRING, never retyped. `postMessage({ type: "…" })` in the
// template is the only place this value is authored.
const WIRE = (() => {
  const m = REPORTER.match(/postMessage\(\{\s*type:\s*"([^"]+)"/);
  assert.ok(m, "the template's reporter no longer postMessages a typed payload — re-derive this");
  return m[1];
})();

const { previewErrFromReport } = new Function(
  fn("function previewErrFromReport(report) {") + "\nreturn { previewErrFromReport };",
)();

test("the browser listens for exactly the type the template sends", () => {
  assert.equal(WIRE, "isibi:runtime-error",
    "the reporter's wire string moved to " + JSON.stringify(WIRE) + " — every site published before " +
    "that change still sends the old one, so the reader must accept both or those sites go unheard");
  // BOTH DIRECTIONS. The producer's literal must be in the consumer, and the
  // consumer must not have quietly grown a second spelling beside it.
  assert.ok(CHAT.includes("e.data.type === '" + WIRE + "'"),
    "chat.js does not compare the message type against " + JSON.stringify(WIRE) + " — the published site's reports are dropped");
  const spellings = (CHAT.match(/isibi:[a-z-]+/g) || []).filter((s, i, a) => a.indexOf(s) === i);
  assert.deepEqual(spellings, [WIRE],
    "chat.js carries more than one isibi: wire string: " + JSON.stringify(spellings));
});

test("the listener routes the report into the collector, and the draft shim still works", () => {
  const at = CHAT.indexOf("window.addEventListener('message'");
  assert.ok(at > 0, "the workspace no longer listens for frame messages at all");
  const end = CHAT.indexOf("\n}", at);
  assert.ok(end > at, "the message listener has no close — re-anchor this window");
  const body = CHAT.slice(at, end);
  // THE NEW BRANCH, reading the CALL rather than its position: `if (false) foo()`
  // leaves `foo(` exactly where a position check looks for it.
  assert.match(body, /if \(e\.data && e\.data\.type === 'isibi:runtime-error'\) \{ collectPreviewErr\(previewErrFromReport\(e\.data\.report\)\); return; \}/,
    "the runtime-error branch does not hand the report to collectPreviewErr");
  // THE CONTROL: the draft shim's own channel must still be there. A change
  // that replaced one reporter with the other would pass every assertion above
  // and silently take the draft preview's errors off.
  assert.match(body, /e\.data\.__siteErr.*collectPreviewErr\(e\.data\.__siteErr\)/,
    "the draft shim's own error channel is gone — the blob preview stopped reporting");
  // And the nav branch, which shares this listener and is what it was written for.
  assert.match(body, /e\.data\.__siteNav/, "preview link clicks stopped switching the page");
});

test("DRIVEN: a real report becomes a collector entry", () => {
  // The shape the template really sends, field for field (ErrorReport).
  const out = previewErrFromReport({
    message: "Cannot read properties of undefined (reading 'map')",
    stack: "TypeError: …\n  at Gear (/gear:12)",
    route: "/gear",
    source: "error_boundary",
  });
  assert.equal(out.msg, "Cannot read properties of undefined (reading 'map')");
  assert.equal(out.info, "/gear · error_boundary",
    "info must carry WHERE it broke and WHAT caught it — a boundary throw and a rejected promise need different fixes");
  // The stack is deliberately NOT carried: `collectPreviewErr` stores what the
  // badge shows, and an 8KB stack in a six-entry list is the payload, not the point.
  assert.equal(out.stack, undefined, "the stack reached the badge — it belongs in the POST, not here");
});

test("DRIVEN: every field is refused rather than coerced", () => {
  // `String(["a"])` is `"a"` — shipped as a real bug three times in this repo,
  // and this value arrives by postMessage from a frame, which is the one place
  // a caller-supplied shape is genuinely out of our hands.
  assert.equal(previewErrFromReport({ message: ["Cannot read properties"] }), null,
    "a one-element array passed as the message — String(['a']) is 'a', so this would read as a real sentence");
  assert.equal(previewErrFromReport({ message: { toString: () => "boom" } }), null, "an object coerced into a message");
  assert.equal(previewErrFromReport({ message: 42 }), null, "a number coerced into a message");
  assert.equal(previewErrFromReport({ message: "" }), null, "an empty message became an entry");
  assert.equal(previewErrFromReport({ message: "   " }), null, "a whitespace message became an entry");
  assert.equal(previewErrFromReport(null), null, "a missing report threw or answered an object");
  assert.equal(previewErrFromReport("boom"), null, "a bare string read as a report");
  assert.equal(previewErrFromReport(undefined), null, "undefined read as a report");
  // A GOOD MESSAGE WITH BAD COORDINATES IS STILL A REPORT. Losing the error
  // because the route came through wrong would be doing less than we can.
  const partial = previewErrFromReport({ message: "boom", route: ["/gear"], source: 7 });
  assert.equal(partial.msg, "boom");
  assert.equal(partial.info, "", "a non-string route or source was coerced into the info line");
  assert.equal(previewErrFromReport({ message: "boom", route: "/gear" }).info, "/gear",
    "a report with no source lost its route too — the join must drop the empty half, not the pair");
});

test("the collector tolerates the null this reader can answer", () => {
  // `collectPreviewErr(null)` happens on every refused report, so the two have
  // to agree. Driven rather than reasoned about: it reads `err && err.msg`.
  const src = fn("function collectPreviewErr(err) {");
  assert.match(src, /String\(err && err\.msg \|\| ''\)/,
    "collectPreviewErr no longer guards its argument — a refused report now throws inside the listener");
  assert.match(src, /list\.length >= 6/, "the six-per-page bound is gone");
  assert.match(src, /list\.some\(\(x\) => x\.msg === msg\)/,
    "the de-duplication is gone — a render loop would fill the badge with one error");
});
