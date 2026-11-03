// PARKED (2026-11-03, park-old-way): the old-way half of test/site-order.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
import { PICTOGRAPH } from "../../../test/fixtures/pictograph.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  sortSlots, applySort, sortDigest, sortColumns, sortReply, sortRefusal, SORT_DIRS, MAX_SORT_SLOTS,
} from "../../../builder/site-order.mjs";
import { DATA_TOOL, readSortChange, dataRequest, runDataEdit } from "../../../builder/site-apply.mjs";
import { GENERATED_DIR } from "../../../test/fixtures/generated.mjs";

const page = (p, body) => ({ path: p, source: `export default function P() {\n  ${body}\n  return null;\n}\n` });
const TABLES = [
  { name: "dishes", columns: ["name", "price", "category"], rows: [{ id: 1, name: "Fade" }] },
  { name: "hours", columns: ["day", "opens"], rows: [{ id: 1, day: "Monday" }] },
];

function reply(order) {
  return { content: [{ type: "tool_use", input: { changes: [], order } }] };
}

// ── THE LANE ────────────────────────────────────────────────────────────────

const dataReply = (input) => ({ content: [{ type: "tool_use", input }] });

test("the worker hands the pages to the data lane and publishes only a reorder", () => {
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('if (eLayer === "data")');
  assert.ok(at > 0);
  const end = w.indexOf('if (eLayer === "rules")', at);
  assert.ok(end > at);
  const block = w.slice(at, end);
  // WITHOUT THE PAGES THE WHOLE FEATURE IS DEAD and every test above still
  // passes — the module is correct and never asked.
  assert.match(block, /runDataEdit\([\s\S]*?pages: eSrc/);
  // AND THE ANSWER REACHES THE CUSTOMER, at both ends of the wire.
  assert.match(block, /sortMsg: dOut\.sortMsg/);
  const c = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /e\.sortMsg/);
});

test("the sort is charged like every other model call on this lane", () => {
  // A refusal used to answer `cost: 0`, which was honest when the only refusal
  // was "nothing matched" and stopped being so the moment a reorder could be
  // refused after a paid call.
  // RE-ANCHORED 2026-09-05 (stage 1a-ii): the rung reserves through its
  // `before` hook now — once the model has answered and BEFORE the first row
  // is written — so a refusal that comes after that hook answers the cost the
  // hook already took (`dBilled ? dCost`), and charges through `eCharge` only
  // when the hook never ran (nothing matched, or the model failed). The
  // property is unchanged: a refusal after a paid call is never `cost: 0`.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('if (eLayer === "data")');
  const block = w.slice(at, w.indexOf('if (eLayer === "rules")', at));
  const refusal = block.indexOf('ok: false, error: dOut.reason');
  assert.ok(refusal > 0);
  assert.match(block.slice(refusal, refusal + 200), /cost: dBilled \? dCost : await eCharge\(dOut\.usage\)/);
});
