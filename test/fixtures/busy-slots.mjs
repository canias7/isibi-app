// THE PER-PROJECT BUSY STATE (audit A15-6 / #138, 2026-10-23), carried out of
// public/chat.js landmark to landmark for the harnesses that run the page's
// send and finish paths: `siteBusyBegin`, `siteBusyEnd`, `siteBusyAt`,
// `siteSlotSwap` and their two maps.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const CHAT = readFileSync(new URL("../../public/chat.js", import.meta.url), "utf8");
const HEAD = "// ── BUSY SLOTS BEGIN";
const TAIL = "// ── BUSY SLOTS END";
const a = CHAT.indexOf(HEAD);
const b = CHAT.indexOf(TAIL);
assert.ok(a > 0 && b > a && CHAT.indexOf(HEAD, a + 1) < 0, "the busy-slots block is gone from chat.js, or is not one");
export const BUSY_SLOTS = CHAT.slice(a, b);
