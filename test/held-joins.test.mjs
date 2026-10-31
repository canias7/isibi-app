// THE JOINS A TAKEN-OUT PART LEAVES BEHIND (2026-10-31): live, the flat-white
// part ran on "…to the café menu, , and ." Each part now runs on a clean sentence.
import test from "node:test";
import assert from "node:assert/strict";
import { heldParts, tidyJoins } from "../builder/site-ask.mjs";

const M = "Add a flat white for £3.20 to the café menu, add a Gallery page, and put our phone number 0113 496 0000 in the header.";
const A = "Add a flat white for £3.20 to the café menu", B = "add a Gallery page", C = "put our phone number 0113 496 0000 in the header";

test("HJ1 each part of the live message runs on its own clean sentence", () => {
  assert.equal(heldParts(M, [B, C]).run, "Add a flat white for £3.20 to the café menu.");
  assert.equal(heldParts(M, [A, C]).run, "add a Gallery page.");
  assert.equal(heldParts(M, [A, B]).run, "put our phone number 0113 496 0000 in the header.");
});

test("HJ2 only joins at the gaps go: the customer's own words are kept", () => {
  assert.equal(tidyJoins("Change the hours and then add a map."), "Change the hours and then add a map.");
  assert.equal(tidyJoins("Serve fish and chips on Friday."), "Serve fish and chips on Friday.");
  assert.equal(tidyJoins("Make it blue; , and ."), "Make it blue.");
  assert.equal(tidyJoins(", and then add a map"), "add a map");
  assert.equal(heldParts("Make the logo bigger and add a map.", ["add a map"]).run, "Make the logo bigger.");
});
