// PARKED (2026-11-03, park-old-way): the old-way half of test/site-seed.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The top-up that fills starter rows the designer left out.
//
// `seed` is a REQUIRED field on `design_schema` and the model omits it anyway —
// twice in a row on 2026-08-12, on real builds, with nothing noticing. The site
// publishes with an empty price list and a booking form whose Service select has
// no options, permanently, because nothing can write to a `display` table after
// the build. So the edges that matter here are: does it fire ONLY when there is
// a gap (a build the designer got right must cost nothing), can it ever put rows
// somewhere they do not belong, and can it fail a build.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  seedGaps, seedRequest, readSeedRows, topUpSeed, mergeSeed,
  SEED_MODEL, MAX_GAP_TABLES, MAX_GAP_ROWS,
} from "../../../builder/site-seed.mjs";

const SPEC = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "name" }, { name: "price" }] },
    { name: "bookings", access: "collect", columns: [{ name: "customer_name" }] },
  ],
};
const reply = (rows, usage) => ({
  content: [{ type: "tool_use", name: "write_rows", input: { rows } }],
  usage: usage || { input_tokens: 900, output_tokens: 300 },
});
/** Records every request so a test can assert a call was NOT made. */
const sender = (out) => {
  const sent = [];
  return { sent, deps: { send: async (req) => { sent.push(req); return out; } } };
};

// ─────────────────────────────────────────────────────────────────────────────
// THE NET MUST SURVIVE THE MODEL'S OWN TABLE SHAPES, found by the 2026-08-13
// audit. `seedGaps` reads the RAW designer output — the shapes `normalizeSchema`
// deliberately tolerates arrive here FIRST, and it ran outside topUpSeed's try:
// a map-shaped `tables` threw `object is not iterable` and crashed the build on
// exactly the branch the module exists to rescue; a string-shaped one silently
// reported no gaps on a schema that had them.

const GAP_TABLE = { name: "services", access: "display", columns: [{ name: "title", type: "text" }] };

test("a dead provider and a junk answer are not the same message on the wire", () => {
  // `failed` is the ONLY discriminator. The module sets it when the model CALL
  // threw; a call that RETURNED junk answers with the same empty `rows` and the
  // same `gaps`, so both lanes' responses were byte-identical — and the customer's
  // site has an empty price list either way, so nobody could say which happened.
  const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const carried = [...worker.matchAll(/[aA]?[sS]eedTopUp = \{ gaps: [\s\S]{0,240}?\};/g)].map((m) => m[0]);
  assert.equal(carried.length, 2, `found ${carried.length} seed-top-up reports, expected the build lane and the addon lane`);
  for (const c of carried) {
    assert.match(c, /failed === true \? \{ failed: true \} : \{\}/,
      "a lane drops the flag, so a provider outage and a junk answer read identically: " + c.slice(0, 90));
  }
});
