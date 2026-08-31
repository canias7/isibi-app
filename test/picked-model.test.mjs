// EVERY SMALL CALL GOES OUT ON THE MODEL ITS CALLER CHOSE.
//
// THE OUTAGE THIS EXISTS FOR — run 93, 2026-08-31. Eight modules each carried a
// hardcoded `claude-haiku-4-5`, so a customer who had picked Grok still had
// Anthropic in their path. Anthropic refused on billing and the entire cheap
// ladder went down at once — the intent router, the lane picker, and every rung
// from `text` to `tweak` — while builds carried on fine, because generation was
// already on the picked model. A `css` edit answered 503 in 5.3 seconds having
// spent nothing, and the lane it was bought to test never ran.
//
// AND THE HALF A SWEEP FOUND. Threading a `model` parameter through is only half
// the job: `routeMessage` took one and did not pass it to `askRequest`, so the
// router quietly fell back to the module default. A sweep caught it, nothing
// else did, and the reason is that every static check passes — the parameter is
// there, the constant is derived, the module reads perfectly. Only DRIVING it
// shows the value never reaching the wire. That is what this file does: each
// runner is called with a sentinel model and a fake `send`, and the request that
// would have gone to a provider is inspected.
//
// `site-tweak` DOES NOT TAKE A `deps` OBJECT — its `send` is a named argument —
// so it is driven in its own shape rather than forced into the others'.
import test from "node:test";
import assert from "node:assert/strict";
import { pickLanes } from "../builder/site-lanes.mjs";
import { routeMessage } from "../builder/site-ask.mjs";
import { runTextEdit, runDataEdit } from "../builder/site-apply.mjs";
import { runNavEdit } from "../builder/site-nav.mjs";
import { runPictureEdit } from "../builder/site-picture.mjs";
import { runRulesEdit } from "../builder/site-rules.mjs";
import { runTweak } from "../builder/site-tweak.mjs";
import { modelsFor, BUILD_MODELS } from "../builder/build-models.mjs";

// A REAL PAGE, not a stub. Three of these runners look for something to work on
// before they will send at all — nav wants menu slots, picture wants an image
// with alt text, data wants a list — and a thin fixture makes them return early,
// which reads exactly like a runner that never sends. It cost three rounds here.
const PAGE = `import { SiteChrome } from "@/components/ui/site-chrome";
import { SafeImage } from "@/components/ui/safe-image";
export default function P() {
  return (
    <SiteChrome name="Acme" links={[{ label: "Menu", href: "/menu" }]} action={{ label: "Book", href: "/book" }}>
      <SafeImage src="@@IMG:a quiet room@@" alt="A quiet room with wooden chairs" ratio="4/3" />
      <p>Ring us on 020 7000 0000</p>
      <ul><li>Flat white 3.20</li><li>Filter 2.60</li></ul>
    </SiteChrome>
  );
}`;
const PAGES = [{ path: "index.tsx", source: PAGE }];
// `rows` is what `runDataEdit` filters on — without it the runner answers
// `no-data` and never reaches its request.
const TABLES = [{ name: "bookings", access: "collect", columns: [{ name: "email", type: "text" }], rows: [{ id: 1, email: "a@b.test" }] }];

const SENTINEL = "sentinel-model-4.6";

/** Capture the outgoing request and stop — nothing here wants a reply. */
function wire() {
  const seen = [];
  return { seen, send: async (req) => { seen.push(req); throw new Error("captured"); } };
}

const RUNNERS = [
  ["pickLanes", (d, model) => pickLanes(d, { message: "make the footer darker", model })],
  ["routeMessage", (d, model) => routeMessage(d, { message: "make the footer darker", site: { pages: ["/"] }, model })],
  ["runTextEdit", (d, model) => runTextEdit(d, { instruction: "change the phone number", pages: PAGES, model })],
  ["runDataEdit", (d, model) => runDataEdit(d, { instruction: "put the filter first", tables: TABLES, recent: {}, pages: PAGES, model })],
  ["runNavEdit", (d, model) => runNavEdit(d, { instruction: "rename the menu link", pages: PAGES, routes: ["/"], model })],
  ["runPictureEdit", (d, model) => runPictureEdit(d, { instruction: "swap the photo", pages: PAGES, model })],
  ["runRulesEdit", (d, model) => runRulesEdit(d, { instruction: "make email required", tables: TABLES, model })],
  ["runTweak", (d, model) => runTweak({ instruction: "make the heading bigger", path: "index.tsx", source: PAGE, send: d.send, model })],
];

test("every runner sends on the model it was given, not its module's default", async () => {
  for (const [name, run] of RUNNERS) {
    const w = wire();
    try { await run({ send: w.send }, SENTINEL); } catch { /* the fake always throws */ }
    // THE RUNNER MUST HAVE REACHED ITS REQUEST. A fixture too thin to give it
    // anything to do returns early and sends nothing, which would let every
    // assertion below pass over an empty list.
    assert.equal(w.seen.length, 1, name + " never sent a request — its fixture is too thin to prove anything");
    assert.equal(w.seen[0].model, SENTINEL,
      name + " ignored the model it was given and sent " + w.seen[0].model + " — the caller's picker is not reaching the wire");
  }
});

test("and with no model given, each falls back to the picker table — never to a provider", async () => {
  // THE DEFAULT MATTERS AS MUCH AS THE PARAMETER. A caller that forgets to
  // thread the picker should land on the model everything else uses, not
  // quietly back on the provider this whole change exists to stop depending on.
  const quicks = new Set(Object.keys(BUILD_MODELS).map((k) => modelsFor(k).quick));
  for (const [name, run] of RUNNERS) {
    const w = wire();
    try { await run({ send: w.send }, undefined); } catch { /* the fake always throws */ }
    assert.equal(w.seen.length, 1, name + " never sent a request");
    assert.equal(w.seen[0].model, modelsFor().quick,
      name + " falls back to " + w.seen[0].model + " rather than the default picker's model");
    assert.ok(quicks.has(w.seen[0].model), name + " falls back to a model no picker resolves to");
  }
});
