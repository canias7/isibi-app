// PARKED (2026-11-03, park-old-way): the old-way half of test/site-text.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// Changing the words without paying for a rebuild.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractText, applyEdit, applyEdits , staleContactLinks } from "../../../builder/site-text.mjs";

const PAGE = `import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useRows } from "@/lib/rows";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const drinks = useRows("drinks", { order: "name", dir: "asc" });
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Fold Coffee</h1>
      <p className="mt-3 text-muted-foreground">Filter, espresso and pastries, seven days a week.</p>
      <Link to="/menu" className="underline">See the menu</Link>
      <Button aria-label="Book">Book a table</Button>
      <img src="/logo.png" alt="Our shopfront" />
    </main>
  );
}
`;

// ── the seam ──────────────────────────────────────────────────────────────────

const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");

// THE SPINE the text route now calls. These properties moved out of the route
// when `recompileAndPublish` was extracted — not because they stopped mattering,
// but because they became true for EVERY caller of it rather than for this one
// route. Windowed to the function so the guards follow the behaviour.
function spine() {
  const i = worker.indexOf("async function recompileAndPublish(env, {");
  assert.ok(i > 0, "the shared spine is gone");
  const end = worker.indexOf("\nasync function siteOgImage(", i);
  assert.ok(end > i, "could not find the end of the spine");
  return worker.slice(i, end);
}
function textRoute() {
  const i = worker.indexOf("if (tx) {");
  assert.ok(i > 0, "the text route is gone");
  const end = worker.indexOf("\n          if (vr) {", i);
  assert.ok(end > i, "could not find the end of the text route");
  return worker.slice(i, end);
}

// ── A NUMBER CHANGED IN THE WORDS AND NOT IN THE CALL LINK ──────────────────

const telPages = [{
  path: "index.tsx",
  source: `<a href="tel:+441132000000">0113 200 0000</a>\n<SiteChrome action={{ label: "Call now", href: "tel:+441132000000" }} />`,
}];

test("the text lane carries it and the client says it", () => {
  // Computed and rendered by nothing is this repo's most-recorded failure.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // DERIVED, not pinned to today's spelling: whatever else the Worker imports
  // from this module, it must import the name it calls, or the text path is a
  // ReferenceError. This test caught exactly that — my first edit targeted an
  // import line that does not exist and the name was never brought in.
  const imp = w.match(/import \{([^}]*)\} from "\.\/builder\/site-text\.mjs"/);
  assert.ok(imp, "the Worker imports the text module");
  assert.ok(imp[1].split(",").map((x) => x.trim()).includes("staleContactLinks"),
    "the Worker must import the name it calls: " + imp[1]);
  assert.match(w, /const staleTel = staleContactLinks\(eMail\.pages, out\.edits\)/);
  assert.match(w, /staleTel: staleTel\.length \? staleTel\.slice\(0, 4\) : undefined,/);
  const c = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /Array\.isArray\(e\.staleTel\)/);
  // BOTH SENTENCES, AND KEYED ON THE SCHEME. With one sentence for both, a
  // stale email link is reported as a Call link that "still dials"
  // hello@cutlerrow.com — which reads as the builder having lost track of what
  // it changed. Found by mutation; the branch was covered by nothing.
  assert.match(c, /the Call link still dials/);
  assert.match(c, /the email link still sends to/);
  assert.match(c, /\/\^mailto:\/\.test\(stale\[0\]\.href/);
});

// ── AND THE mailto: LINK THAT GOES STALE WITH IT ────────────────────────────

const mailPages = [{ path: "index.tsx", source: `<a href="mailto:hello@cutlerrow.com">Email us</a>` }];
