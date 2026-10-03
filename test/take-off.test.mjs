// THE TAKE-OFF CONTRACT, PIECE BY PIECE (2026-10-02, the owner's review of the
// whole-router audit's W2): *"Let the model identify the targets and have code
// validate them, without customer-word heuristics."*
//
// A removal on a list (`langs`, `qr`, `behavior`) is one small call whose
// answer is the names of the entries to take off (`takeOffTool`), and code
// compares those names with the stored list (`takeOffTargets`) by each lane's
// own rule. These cases hold each piece to that: what the model is shown and
// asked, how an answer is read, how a name is matched, what stays, and what
// the customer is told. The route that strings them together is driven in
// `test/partial-removal.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import {
  LANE_FIELDS, REMOVABLE_LANES, pickTool,
  takeOffLane, takeOffTool, takeOffRequest, readTakeOff, takeOffTargets, runTakeOff, takeOffRefusal, takeOffNote,
} from "../builder/site-lanes.mjs";
import { QUESTION_FIELD } from "../builder/clarify.mjs";

const PRICES = { name: "prices", points: "https://crookes.gofarther.app/prices", label: "Scan for prices" };
const RING = { name: "ring", points: "tel:+441140000000", label: "Scan to ring and book" };
const WIFI = { name: "wifi", points: "WIFI:T:WPA;S:Crookes;P:strings;;", label: "Scan to join our wifi" };
const FILTER = { control: "the filter chips", on: "pressing one", does: "shows one instrument", affects: "the list", result: "it narrows", source: "component" };
const TABS = { control: "the term tabs", on: "pressing one", does: "switches terms", affects: "the timetable", result: "the other term shows", source: "component" };
const answer = (input, name = "take_off") => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name, input }], usage: { input_tokens: 300, output_tokens: 20 } });

test("the lanes that keep a list are exactly the ones that take entries off by name, and the picker reads each removal as several or all", () => {
  assert.deepEqual(LANE_FIELDS.filter((f) => takeOffLane(f)).sort(), ["behavior", "langs", "qr"], "the take-off lanes moved");
  for (const f of ["behavior", "langs", "qr"]) assert.ok(REMOVABLE_LANES.includes(f), f + " takes entries off but is not removable");
  // A NAME THAT IS NOT A LIST LANE, OR AN INHERITED KEY, IS NOT ONE.
  for (const f of ["brand", "css", "lang", "__proto__", "constructor", "toString", "", 1, null, undefined, ["langs"]]) {
    assert.equal(takeOffLane(f), false, "takeOffLane(" + JSON.stringify(f) + ")");
  }
  // WHAT THE PICKER IS TOLD TAKING EACH OFF MEANS — several, or every one.
  const told = JSON.stringify(pickTool());
  assert.match(told, /qr — take QR codes off the site — the ones they name: one, several or every one/);
  assert.match(told, /langs — stop offering the site in one or more of its extra languages — the ones they name, or every one/);
});

test("the removal's tool answers a list of names and nothing else, and it is the only tool, forced", () => {
  for (const f of ["langs", "qr", "behavior"]) {
    const tool = takeOffTool(f);
    assert.equal(tool.name, "take_off");
    // RE-ANCHORED 2026-10-02 (the owner's review): and the one question back,
    // asked instead of naming an entry on a guess (`QUESTION_FIELD`).
    assert.deepEqual(Object.keys(tool.input_schema.properties), ["targets", "question"], f + ": the answer carries more than names");
    assert.equal(tool.input_schema.properties.question, QUESTION_FIELD);
    assert.deepEqual(tool.input_schema.required, ["targets"]);
    assert.equal(tool.input_schema.properties.targets.type, "array");
    assert.deepEqual(tool.input_schema.properties.targets.items, { type: "string" });
    assert.match(tool.input_schema.properties.targets.description, /every one of them when they asked for all to go/);
    assert.match(tool.input_schema.properties.targets.description, /Empty when nothing they named is in the list/);
    const req = takeOffRequest({ field: f, message: "x", value: [], model: "m-1" });
    assert.deepEqual(req.tools.map((t) => t.name), ["take_off"]);
    assert.deepEqual(req.tool_choice, { type: "tool", name: "take_off" });
    assert.equal(req.model, "m-1");
  }
  assert.throws(() => takeOffTool("brand"), /no list lane/);
  assert.throws(() => takeOffRequest({ field: "css", message: "x", value: "", model: "m" }), /no list lane/);
});

test("the removal is shown each entry by the name to answer with, then their words as written", () => {
  const langs = takeOffRequest({ field: "langs", message: "Stop offering the site in Spanish.", value: ["fr", "es"], model: "m" });
  assert.equal(langs.messages[0].content,
    "The extra languages on their site (`langs`), each by the name to answer with:\n- fr\n- es\n\nWhat they asked for:\nStop offering the site in Spanish.");
  const qr = takeOffRequest({ field: "qr", message: "Take both codes off.", value: [PRICES, RING], model: "m" });
  assert.equal(qr.messages[0].content,
    "The QR codes on their site (`qr`), each by the name to answer with:\n" +
    "- prices — “Scan for prices”, scanning it opens https://crookes.gofarther.app/prices\n" +
    "- ring — “Scan to ring and book”, scanning it opens tel:+441140000000\n\nWhat they asked for:\nTake both codes off.");
  // THE OLD SINGLE-CODE SHAPE IS ONE CODE NAMED `qr`, as every reader reads it.
  const legacy = takeOffRequest({ field: "qr", message: "Take the code off.", value: { points: "tel:1", label: "Ring us" }, model: "m" });
  assert.match(legacy.messages[0].content, /^- qr — “Ring us”, scanning it opens tel:1$/m);
  const beh = takeOffRequest({ field: "behavior", message: "Stop the tabs switching.", value: [FILTER, TABS], model: "m" });
  assert.match(beh.messages[0].content, /^- 1 — the filter chips — pressing one — shows one instrument\n- 2 — the term tabs — pressing one — switches terms$/m);
  const none = takeOffRequest({ field: "langs", message: "x", value: [], model: "m" });
  assert.match(none.messages[0].content, /:\n\(none\)\n\nWhat they asked for:/);
  // THE WORDS WHOLE, never rewritten (2026-10-03: they were cut at 2,000; the
  // route keeps a site's message to the size policy and refuses one past it).
  const words = "a".repeat(2050) + " and take French off";
  const long = takeOffRequest({ field: "langs", message: words, value: ["fr"], model: "m" });
  assert.ok(long.messages[0].content.endsWith("\n" + words), "the message was cut");
  // THE SYSTEM WORDS: name only what was asked; never the nearest entry.
  const sys = langs.system.map((b) => b.text).join("\n");
  assert.match(sys, /NAME ONLY WHAT THEY ASKED TO TAKE OFF/);
  assert.match(sys, /when they asked for every one to go, name every entry/);
  assert.match(sys, /Never answer with the nearest entry/);
  assert.match(sys, /If they named nothing that could be taken off, answer an empty list/);
  assert.equal(langs.tools[0].cache_control.type, "ephemeral");
  assert.equal(langs.system[0].cache_control.type, "ephemeral");
});

test("an answer is read as names only: a missing or wrong tool, or no list, is unreadable; a non-name is dropped, never coerced", () => {
  assert.deepEqual(readTakeOff(answer({ targets: ["es", " de ", "", 3, ["fr"], null, { x: 1 }] })), { ok: true, targets: ["es", "de"] });
  assert.deepEqual(readTakeOff(answer({ targets: [] })), { ok: true, targets: [] });
  assert.deepEqual(readTakeOff(answer({ targets: ["a".repeat(120)] })).targets, ["a".repeat(80)]);
  for (const bad of [answer({ targets: "es" }), answer({}), answer({ targets: ["es"] }, "edit_site"), answer(null), { content: [] }, {}, null, undefined, "x"]) {
    assert.deepEqual(readTakeOff(bad), { ok: false, targets: [] }, JSON.stringify(bad));
  }
});

test("code checks each name by the lane's own rule: what is on the list comes off, what is not is said, and the rest stays in order", () => {
  // LANGUAGES: a tag whatever its case (BCP-47), and nothing looser.
  assert.deepEqual(takeOffTargets("langs", ["fr", "es", "de"], ["ES", "de"]), { matched: ["es", "de"], unknown: [], kept: ["fr"], all: false });
  assert.deepEqual(takeOffTargets("langs", ["fr", "es"], ["es-ES", "Spanish"]), { matched: [], unknown: ["es-ES", "Spanish"], kept: ["fr", "es"], all: false });
  assert.deepEqual(takeOffTargets("langs", ["fr"], ["de"]), { matched: [], unknown: ["de"], kept: ["fr"], all: false },
    "THE OWNER'S CASE: one language on the list, another named — nothing comes off");
  assert.deepEqual(takeOffTargets("langs", ["fr", "es"], ["fr", "es"]), { matched: ["fr", "es"], unknown: [], kept: [], all: true });
  assert.deepEqual(takeOffTargets("langs", ["fr", "fr"], ["fr"]), { matched: ["fr"], unknown: [], kept: [], all: true }, "a repeated tag is all gone when named");
  assert.deepEqual(takeOffTargets("langs", ["fr", "es"], ["de", "de", " de "]).unknown, ["de"], "an unknown name is said once");
  assert.deepEqual(takeOffTargets("langs", ["fr", "es"], [3, null, ["es"], ""]), { matched: [], unknown: [], kept: ["fr", "es"], all: false }, "a non-name took something off");
  // QR CODES: by the one rule every code name is read by (`qrName`).
  assert.deepEqual(takeOffTargets("qr", [PRICES, RING, WIFI], ["Prices", "wifi"]), { matched: ["prices", "wifi"], unknown: [], kept: [RING], all: false });
  assert.deepEqual(takeOffTargets("qr", [PRICES], ["wifi"]), { matched: [], unknown: ["wifi"], kept: [PRICES], all: false },
    "THE OWNER'S CASE: one code on the list, another named — nothing comes off");
  assert.deepEqual(takeOffTargets("qr", [PRICES, RING], ["Scan for prices"]).matched, [], "a caption is not a name");
  assert.deepEqual(takeOffTargets("qr", [PRICES, RING], ["prices", "ring"]), { matched: ["prices", "ring"], unknown: [], kept: [], all: true });
  assert.deepEqual(takeOffTargets("qr", { points: "tel:1", label: "Ring us" }, ["qr"]), { matched: ["qr"], unknown: [], kept: [], all: true }, "the old shape");
  // CONTROLS: by their number in the list, exactly.
  assert.deepEqual(takeOffTargets("behavior", [FILTER, TABS], ["2"]), { matched: ["2"], unknown: [], kept: [FILTER], all: false });
  assert.deepEqual(takeOffTargets("behavior", [FILTER, TABS], ["two", "3", "the term tabs"]), { matched: [], unknown: ["two", "3", "the term tabs"], kept: [FILTER, TABS], all: false });
  // NOTHING ON THE LIST, NOTHING TO TAKE.
  assert.deepEqual(takeOffTargets("langs", [], ["es"]), { matched: [], unknown: ["es"], kept: [], all: false });
  assert.throws(() => takeOffTargets("brand", "x", ["x"]), /no list lane/);
});

test("one removal is one call; an empty list asks no one; a failed, cut-off or unreadable answer takes nothing off", async () => {
  const sent = [];
  const send = (reply) => async (req) => { sent.push(req); if (reply instanceof Error) throw reply; return reply; };
  const ok = await runTakeOff({ send: send(answer({ targets: ["es"] })) }, { field: "langs", message: "m", value: ["fr", "es"], model: "x" });
  assert.equal(sent.length, 1);
  assert.equal(ok.ok, true); assert.equal(ok.failed, false);
  assert.deepEqual([ok.matched, ok.unknown, ok.kept, ok.all, ok.targets], [["es"], [], ["fr"], false, ["es"]]);
  assert.ok(ok.usage, "the call's usage was not carried for billing");
  sent.length = 0;
  const empty = await runTakeOff({ send: send(answer({ targets: ["es"] })) }, { field: "langs", message: "m", value: [], model: "x" });
  assert.equal(sent.length, 0, "a removal was asked about an empty list");
  assert.deepEqual([empty.ok, empty.matched, empty.usage], [true, [], null]);
  const down = await runTakeOff({ send: send(new Error("503")) }, { field: "langs", message: "m", value: ["fr"], model: "x" });
  assert.deepEqual([down.ok, down.failed, down.matched], [false, true, undefined]);
  const cut = await runTakeOff({ send: send({ ...answer({ targets: ["fr"] }), stop_reason: "max_tokens" }) }, { field: "langs", message: "m", value: ["fr"], model: "x" });
  assert.deepEqual([cut.ok, cut.failed, cut.error.truncated], [false, true, true]);
  const unread = await runTakeOff({ send: send(answer({ targets: "fr" })) }, { field: "langs", message: "m", value: ["fr"], model: "x" });
  assert.deepEqual([unread.ok, unread.failed, unread.matched], [false, false, undefined]);
  await assert.rejects(() => runTakeOff({ send: send(answer({ targets: [] })) }, { field: "css", message: "m", value: "", model: "x" }), /no list lane/);
});

test("what the customer is told: three different facts, three sentences, and a note for a name that was not there", () => {
  assert.equal(takeOffRefusal("langs", { ok: true, unknown: ["de"] }, ["fr"]),
    "This site has no extra language `de` — its only extra language is `fr`.");
  assert.equal(takeOffRefusal("qr", { ok: true, unknown: ["wifi"] }, [PRICES, RING]),
    "This site has no QR code `wifi` — its QR codes are `prices`, `ring`.");
  assert.equal(takeOffRefusal("langs", { ok: true, unknown: ["a", "b", "c", "d"] }, ["fr"]),
    "This site has no extra language `a` or `b` or `c` — its only extra language is `fr`.");
  assert.equal(takeOffRefusal("langs", { ok: true, unknown: [] }, ["fr", "es"]),
    "Nothing you asked to take off is on this site — its extra languages are `fr`, `es`.");
  assert.equal(takeOffRefusal("behavior", { ok: false }, [FILTER, TABS]),
    "I couldn't tell which control to take off — its controls are `1` (the filter chips), `2` (the term tabs). Say which one.");
  assert.equal(takeOffRefusal("qr", { ok: true, unknown: [] }, []), "This site has no QR codes to take off.");
  assert.equal(takeOffRefusal("brand", { ok: true }, "x"), "I couldn't take that off.");
  assert.equal(takeOffNote("langs", ["de"]), "There was no extra language `de` to take off, so that part changed nothing.");
  assert.equal(takeOffNote("qr", ["wifi", "menu"]), "There was no QR code `wifi` or `menu` to take off, so that part changed nothing.");
  assert.equal(takeOffNote("langs", []), "");
  assert.equal(takeOffNote("langs", "de"), "");
  assert.equal(takeOffNote("brand", ["x"]), "");
});
