// PARKED (2026-11-03, park-old-way): the old-way half of test/frame-parallel.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE FRAME'S SIGN-UP AND PARTS ON ONE PAGE (2026-10-25, frame-parallel).
// Live on driftwood-and-daughters-5 (main b12dba52c): "a newsletter sign-up in
// the footer" had no table the frame call was told of, and one long message's
// parts each ran a whole-page rewrite — an existing page answered unchanged
// was retried into a rewrite, and parts on one page were each a rewrite of it.
// Every model answer here is supplied; nothing is spent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  frameTables, frameEditRequest, frameFileProblems, readFrameEdit, runFrameEdit, FRAME_EDIT_RULES,
} from "../../../builder/site-frame.mjs";
import { routeOnExisting } from "../../../builder/addon-existing.mjs";
import { planParts, newRequest, nextStep, jobBody, joinSamePage } from "../../../builder/request.mjs";
import { readHandOver } from "../../../builder/hand-over.mjs";

const SPEC = { tables: [
  { name: "newsletter_signups", access: "collect", columns: [{ name: "id", type: "uuid" }, { name: "email", type: "text", required: true }, { name: "created_at", type: "timestamptz" }] },
  { name: "menu_items", access: "display", columns: [{ name: "name", type: "text" }] },
  { name: "old_list", access: "collect", retired: true, columns: [{ name: "x", type: "text" }] },
] };
const HEADER = "import { Link } from \"@tanstack/react-router\";\nexport default function SiteHeader() { return <header><Link to=\"/\">Home</Link></header>; }\n";
const FOOTER = "export default function SiteFooter() { return <footer>Driftwood</footer>; }\n";
const PARTS = [{ name: "site-header", source: HEADER }, { name: "site-footer", source: FOOTER }];
const PAGES = [{ path: "src/routes/index.tsx", source: "export default function I() { return null; }" }];
const ROUTES = ["/", "/lessons", "/cafe"];
const reply = (input) => ({ content: [{ type: "tool_use", name: "edit_frame", input }], usage: { input_tokens: 10, output_tokens: 10 } });
const GOOD_FOOTER = "import { useState } from \"react\";\nimport { useCreateRow } from \"@/lib/rows\";\nexport default function SiteFooter() {\n  const add = useCreateRow(\"newsletter_signups\");\n  const [email, setEmail] = useState(\"\");\n  return <footer><a href=\"https://instagram.com/driftwood\">Instagram</a><form onSubmit={(e) => { e.preventDefault(); add.mutate({ email }); }}><input value={email} onChange={(e) => setEmail(e.target.value)} /><button>Sign up</button></form></footer>;\n}\n";

test("FP4 THE WORKER HANDS THE FRAME ITS TABLES — the written-frame call passes `tables` read from the site's own schema", () => {
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("const fOut = await runFrameEdit(");
  assert.ok(a > 0);
  const call = src.slice(a, src.indexOf("});", a));
  assert.match(call, /tables: await frameTablesOf\(env, ownerSlug\)/);
  assert.match(src, /async function frameTablesOf\(env, slug\)[\s\S]{0,600}frameTables\(r\.spec\)/);
});

test("FP6 AN UNCHANGED PAGE FOR SUCH A PART IS THE ANSWER — the no-change retry is skipped and the reply is `satisfied` at no cost", () => {
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(src, /const eExisting = !!\(eExistingHand && eExistingHand\.reason === "existing"\);/);
  assert.match(src, /const pWhy = pWhy0 === "no-change" && eExisting \? null : pWhy0;/);
  const a = src.indexOf("if (eExisting) {");
  assert.ok(a > 0);
  const blk = src.slice(a, a + 400);
  assert.match(blk, /satisfied: true/);
  assert.match(blk, /cost: 0/);
});

// ── parts on one page ──
const W = ["add a booking form to the Lessons page", "show the group sizes on the Lessons page", "add the Saturday surf club to the Cafe page"];
function rec3(pages) {
  const message = W.join(". ") + ".";
  const r0 = { intent: "edit", layer: "page", page: pages[0] };
  const planned = planParts(message, { ...r0, alsoAsked: W.slice(1) });
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const rec = newRequest({ key: "rqframepar00000001", uid: "u1", slug: "driftwood", message, picker: "grok", accepted: r0, parts: planned.parts });
  rec.parts.forEach((p, n) => { p.phase = "run"; p.route = { op: "edit", intent: "edit", layer: "page", page: pages[n], remove: false, rename: "", tab: false, handOver: null, cost: 1, handedOff: false, fromAddon: false }; p.targets = { writes: ["page:" + pages[n]], reads: [] }; p.status = "ready"; delete p.prep; });
  return rec;
}
