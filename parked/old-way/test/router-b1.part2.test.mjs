// PARKED (2026-11-03, park-old-way): the old-way half of test/router-b1.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// ── ROUTER B1 (2026-10-25): NO QUESTIONS ON A PART, A SITE INVENTORY, ONE
//    RULE OF EACH, A PER-SITE CACHE PIN ─────────────────────────────────────
//
// The router audit's plan steps 2–4 and its cache step
// (`docs/audits/2026-10-25-router-audit.md`, `docs/history/2026-10-25-router-b1.md`).
// These guard the properties, not the spelling: each rule is said once on a
// site that exists, the tie-break is one, a removal has one owner by what
// holds it, a new frame item is the frame step's, the first build is sent
// what it always was, a part is told questions are closed, the inventory
// reaches the request after the stable prefix, and the pin reaches the wire.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LIVE_ASK_TOOL, layerLine } from "../../../builder/route-shared.mjs";
import { routeInventory, pageFacts, INVENTORY_CHARS } from "../../../builder/route-inventory.mjs";
import { toXaiRequest } from "../../../builder/model-xai.mjs";
import { xaiHeaders, anthropicWire } from "../../../builder/build-call.mjs";

const LIVE = LIVE_ASK_TOOL.input_schema.properties;
const INTENT = LIVE.intent.description;
const LAYER = LIVE.layer.description;
const ALSO = LIVE.alsoAsked.description;
const REMOVE = LIVE.remove.description;
const RULES = [INTENT, LAYER, ALSO, LIVE.page.description, REMOVE].join("\n");
const count = (s, re) => (s.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length;
const SITE = { name: "Driftwood", url: "https://driftwood.gofarther.app", pages: ["/", "/lessons", "/visit"], tables: ["lessons", "lesson_bookings"] };
const sysOf = (req) => req.system.map((b) => b.text).join("");

const said = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: LIVE_ASK_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });

const LESSONS = `import { usePublicRows } from "@/lib/rows";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
function Lessons() {
  const rows = usePublicRows<{ title: string }>(
    "lessons", {});
  return (<SiteChrome links={[{ label: "Home", href: "/" }, { label: "Lessons", href: "/lessons" }]} action={{ label: "Call us", href: "tel:0123" }}>
    <SectionHeader title="x" /><h1 className="t">Surf lessons</h1><Button>Go</Button></SiteChrome>);
}`;
const SPEC = { tables: [
  { name: "lessons", access: "display", columns: [{ name: "id", pk: true }, { name: "title", notnull: true }, { name: "price", notnull: true }, { name: "spots", notnull: true, default: 8 }] },
  { name: "lesson_bookings", access: "collect", columns: [{ name: "email", notnull: true }] },
] };

test("the inventory: each table's columns, each page's sections and tables, the frame's items — read from the site's files, never a row", () => {
  const f = pageFacts(LESSONS);
  assert.deepEqual(f.reads, ["lessons"]);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.components, ["SectionHeader"], "a primitive or a missing section was listed");
  assert.deepEqual(f.headings, ["Surf lessons"]);
  const inv = routeInventory({ pages: [{ path: "src/routes/lessons.tsx", route: "/lessons", source: LESSONS }], spec: SPEC });
  assert.match(inv, /- lessons: id, title\*, price\*, spots=/);
  assert.match(inv, /- lesson_bookings: email\*/);
  assert.match(inv, /- \/lessons: headings: "Surf lessons"; sections: SectionHeader; reads lessons/);
  assert.match(inv, /- menu: Home → \/; Lessons → \/lessons/);
  assert.match(inv, /- header button: Call us → tel:0123/);
  // A PART IS SHOWN NO PAGE WORDS: another part's heading change never changes its request (R11).
  const noWords = routeInventory({ pages: [{ path: "src/routes/lessons.tsx", route: "/lessons", source: LESSONS }], spec: SPEC, words: false });
  assert.doesNotMatch(noWords, /Surf lessons|headings:/);
  assert.match(noWords, /- \/lessons: sections: SectionHeader; reads lessons/);
  const w = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /let rDigest = await routeDigest\(env, ru, rb, \{ keepPages: !!rScope, words: !rPart \}\);/);
  assert.match(w, /const whole = await routeDigest\(env, ru, rb, \{ words: !rPart \}\);/);
  // WHAT COULD NOT BE READ IS LEFT OUT, never said as none.
  assert.equal(routeInventory({ pages: null, spec: null }), "");
  assert.match(routeInventory({ pages: null, spec: { tables: [] } }), /^Tables[^\n]*\n- none$/);
});
