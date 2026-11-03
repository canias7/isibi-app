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
import { LIVE_ASK_TOOL, layerLine } from "../builder/route-shared.mjs";
import { routeInventory, pageFacts, INVENTORY_CHARS } from "../builder/route-inventory.mjs";
import { toXaiRequest } from "../builder/model-xai.mjs";
import { xaiHeaders, anthropicWire } from "../builder/build-call.mjs";

const LIVE = LIVE_ASK_TOOL.input_schema.properties;
const INTENT = LIVE.intent.description;
const LAYER = LIVE.layer.description;
const ALSO = LIVE.alsoAsked.description;
const REMOVE = LIVE.remove.description;
const RULES = [INTENT, LAYER, ALSO, LIVE.page.description, REMOVE].join("\n");
const count = (s, re) => (s.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length;
const SITE = { name: "Driftwood", url: "https://driftwood.gofarther.app", pages: ["/", "/lessons", "/visit"], tables: ["lessons", "lesson_bookings"] };
const sysOf = (req) => req.system.map((b) => b.text).join("");

test("a removal has one owner by what holds it, and an addon never removes", () => {
  assert.match(LAYER, /IT IS ALSO WHERE A REMOVAL IS WORKED OUT for anything taken off a page that stays/);
  assert.match(LAYER, /Three removals have their own owner instead: a whole page \("page" with `remove`\), a row the site stores \("data"\), and an item of the frame or the logo \("nav" or "logo" with `remove`\)\./);
  // PICTURE NO LONGER CLAIMS ONE: its clause sends a removal to look, and the flag names no picture.
  const picture = LAYER.split("\n").find((l) => l.startsWith("\"picture\" — "));
  assert.ok(picture, "the picture clause's landmark moved");
  assert.match(picture, /taking one off is "look"\./);
  assert.doesNotMatch(REMOVE, /layer "picture"/, "the remove flag still gives picture a removal");
  for (const l of ["page", "logo", "nav"]) assert.match(REMOVE, new RegExp("For layer \"" + l + "\": true"), l + " lost its removal");
  assert.match(INTENT, /A REMOVAL IS NEVER AN ADDON/);
  assert.match(INTENT, /NEVER ANSWER "ask" TO CHECK THAT THEY MEANT IT/);
});

test("a new menu link, footer link, contact detail or header button is the frame step's (edit + nav), never addon; new words and photographs stay addon", () => {
  assert.match(INTENT, /"edit" — [^\n]*a new item in the frame every page shares \(a menu link, a footer link, a contact detail, the header button\), which layer "nav" adds on every page/);
  const nav = LAYER.split("\n").find((l) => l.startsWith("\"nav\" — "));
  assert.match(nav, /IT ADDS TO THE FRAME AS WELL AS CHANGING IT: a new menu link, footer link, contact detail or header button is this layer\./);
  assert.match(nav, /a link to a page it lacks is "addon", the page first/);
  assert.doesNotMatch(RULES, /NEW menu link[^.]*intent "addon"|ADDING TO THE FRAME IS NOT AN EDIT|A NEW ITEM IN THE FRAME EVERY PAGE SHARES IS AN ADDITION/, "a frame addition is still sent to addon");
  assert.match(INTENT, /a new line of words or a new photograph on a page, even one that has some/);
  // The lane picker is told the live router's own line for a layer.
  assert.match(layerLine("nav"), /^THE FRAME EVERY PAGE SHARES/);
});

test("the guarded behaviours keep a sentence: the enforcement line, the sort scope, the crop, the header button, the address", () => {
  assert.match(LAYER, /THE LINE IS ENFORCEMENT AGAINST DISPLAY, AND WORDS LIKE BOOKINGS, CAPACITY, PLACES OR LIMIT DO NOT DECIDE IT/);
  assert.match(LAYER, /ACROSS THE WHOLE SITE, when they say so or name no page\. It cannot leave a page out/);
  assert.match(LAYER, /It reaches every word inside a page's sections, a button in a hero included, which "nav" cannot\./);
  assert.match(LAYER, /free, it moves the crop/);
  assert.match(LAYER, /"rename" — THE SITE'S WEB ADDRESS only/);
  assert.match(LAYER, /IT IS ALSO WHERE A PAGE IS DELETED: that page in `page`, `remove` true\./);
});

test("about half the rule text: the live tool's rules are at most 13,000 characters (25,272 before)", () => {
  assert.ok(RULES.length <= 13000, "the live rules grew back: " + RULES.length);
  assert.ok(RULES.length >= 6000, "the live rules lost their substance: " + RULES.length);
});

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

test("the inventory is budgeted: a large site is cut with a line saying so, and the 24-table cut is gone", () => {
  const tables = Array.from({ length: 60 }, (_, i) => ({ name: "t" + i, columns: Array.from({ length: 30 }, (_, j) => "column_" + j) }));
  const inv = routeInventory({ spec: { tables } });
  assert.ok(inv.length <= INVENTORY_CHARS + 40, "the inventory ran past its budget: " + inv.length);
  assert.match(inv, /… \(more not shown\)$/);
  const small = routeInventory({ spec: { tables: tables.slice(0, 30).map((t) => ({ name: t.name, columns: ["a"] })) } });
  assert.match(small, /- t29: a/, "a table past the 24th was cut");
  // SECTIONS GO FIRST: over budget, every page keeps its line and loses its section list.
  const pages = Array.from({ length: 8 }, (_, i) => ({ path: "src/routes/p" + i + ".tsx", route: "/p" + i, source: LESSONS }));
  const full = routeInventory({ pages });
  const tight = routeInventory({ pages, budget: full.length - 1 });
  assert.match(full, /sections: SectionHeader/);
  assert.doesNotMatch(tight, /sections:/, "the section lists were not the first thing cut");
  for (let i = 0; i < 8; i++) assert.match(tight, new RegExp("- /p" + i + ": "), "a page was cut before the sections");
});
